import { db } from '@/lib/firebaseConfig';
import { collection, doc, getDoc, getDocs, runTransaction, query, where, documentId, limit } from 'firebase/firestore';
import { nativeSessionService } from './NativeSessionService';
import { durableWorkService } from './DurableWorkService';
import { reliabilityDecoder } from './ReliabilityDecoderService';
import { contentDraftService } from './ContentDraftService';
import { pageAccessService } from './PageAccessService';
import type { CartLine, CartMutation, CartSnapshot, MarketProduct, MarketVariant } from '@/lib/types/reliability';

export class CartSyncService {
  private static instance: CartSyncService;
  private queues = new Map<string, Promise<void>>();
  private synchronizations = new Map<string, Promise<CartSnapshot>>();
  public static getInstance(): CartSyncService { return this.instance ??= new CartSyncService(); }
  private enqueue<TValue>(ownerId: string, operation: () => Promise<TValue>): Promise<TValue> {
    const result = (this.queues.get(ownerId) ?? Promise.resolve()).then(operation);
    this.queues.set(ownerId, result.then(() => {}, () => {}));
    return result;
  }
  public async load(ownerId: string): Promise<CartSnapshot> {
    nativeSessionService.assertOwner(ownerId);
    return (await durableWorkService.read(ownerId, 'cart', 'current', reliabilityDecoder.cart))?.value ?? { revision: 0, lines: [], pending: [], conflicts: [] };
  }
  private async persist(ownerId: string, cart: CartSnapshot): Promise<void> {
    const stored = await durableWorkService.read(ownerId, 'cart', 'current', reliabilityDecoder.cart);
    await durableWorkService.write(ownerId, 'cart', 'current', cart, stored?.revision ?? 0);
  }
  public async setQuantity(ownerId: string, product: MarketProduct, variant: MarketVariant, quantity: number): Promise<CartSnapshot> {
    pageAccessService.assertMutation('/market');
    return this.enqueue(ownerId, async () => {
      const cart = await this.load(ownerId);
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99 || (quantity > 0 && (!product.available || !variant.available || quantity > variant.stock))) throw new Error('Choose an available quantity between 1 and 99.');
      const id = cart.lines.find((line) => line.productId === product.id && line.variantId === variant.id)?.id ?? `${product.id.length}_${product.id}${variant.id}`;
      const previous = cart.lines.find((line) => line.id === id);
      if (cart.conflicts.some((conflict) => conflict.mutation.lineId === id)) throw new Error('Resolve this line’s quantity conflict first.');
      if (quantity > 0 && (!previous || previous.removed) && cart.lines.filter((line) => !line.removed).length >= 100) throw new Error('A cart can contain at most 100 variants.');
      const line: CartLine = { id, productId: product.id, variantId: variant.id, title: product.title, variantLabel: variant.label, image: variant.image ?? product.images[0] ?? null,
        price: variant.price, currency: variant.currency, quantity, revision: previous?.revision ?? 0, removed: quantity === 0 };
      // Coalesce only mutations never sent. A timeout retains the same ID until acknowledged.
      const mutation: CartMutation = { id: await contentDraftService.newId(), lineId: id, baseRevision: previous?.revision ?? 0, line };
      cart.lines = [...cart.lines.filter((entry) => entry.id !== id), line];
      cart.pending.push(mutation);
      await this.persist(ownerId, cart);
      return cart;
    });
  }
  public async remove(ownerId: string, existingLine: CartLine): Promise<CartSnapshot> {
    pageAccessService.assertMutation('/market');
    return this.enqueue(ownerId, async () => {
      const cart = await this.load(ownerId);
      const previous = cart.lines.find((line) => line.id === existingLine.id) ?? existingLine;
      if (cart.conflicts.some((conflict) => conflict.mutation.lineId === previous.id)) throw new Error('Resolve this line’s quantity conflict first.');
      const line: CartLine = { ...previous, quantity: 0, removed: true };
      cart.lines = [...cart.lines.filter((entry) => entry.id !== line.id), line];
      cart.pending.push({ id: await contentDraftService.newId(), lineId: line.id, baseRevision: previous.revision, line });
      await this.persist(ownerId, cart);
      return cart;
    });
  }
  public async resolve(ownerId: string, lineId: string, keep: 'local' | 'remote'): Promise<CartSnapshot> {
    pageAccessService.assertMutation('/market');
    return this.enqueue(ownerId, async () => {
      const cart = await this.load(ownerId);
      const conflict = cart.conflicts.find((entry) => entry.mutation.lineId === lineId);
      if (!conflict) return cart;
      cart.conflicts = cart.conflicts.filter((entry) => entry !== conflict);
      const line = keep === 'remote' ? conflict.remote : { ...conflict.mutation.line, revision: conflict.remote.revision };
      cart.lines = [...cart.lines.filter((entry) => entry.id !== lineId), line];
      if (keep === 'local') cart.pending.push({ id: await contentDraftService.newId(), lineId, baseRevision: conflict.remote.revision, line });
      await this.persist(ownerId, cart);
      return cart;
    });
  }
  public async sync(ownerId: string): Promise<CartSnapshot> {
    const existing = this.synchronizations.get(ownerId);
    if (existing) return existing;
    const synchronization = this.synchronize(ownerId).finally(() => { this.synchronizations.delete(ownerId); });
    this.synchronizations.set(ownerId, synchronization);
    return synchronization;
  }
  private async synchronize(ownerId: string): Promise<CartSnapshot> {
      await nativeSessionService.ensure(ownerId);
      const database = db;
      const metadataReference = doc(database, 'users', ownerId, 'marketCart', 'current');
      // Network requests never hold the local editing queue. Bound one flush to 100 writes.
      for (let processed = 0; processed < 100; processed += 1) {
        const pending = await this.enqueue(ownerId, () => this.load(ownerId));
        const mutation = pending.pending.find((entry) => !pending.conflicts.some((conflict) => conflict.mutation.lineId === entry.lineId));
        if (!mutation) break;
        nativeSessionService.assertOwner(ownerId);
        const result = await runTransaction(database, async (transaction) => {
          const reference = doc(database, 'users', ownerId, 'cartLines', mutation.lineId);
          const receiptReference = doc(database, 'users', ownerId, 'cartOperations', mutation.id);
          const [lineSnapshot, receipt, metadata] = await Promise.all([transaction.get(reference), transaction.get(receiptReference), transaction.get(metadataReference)]);
          const remote = lineSnapshot.exists() ? reliabilityDecoder.line(lineSnapshot.data()) : null;
          if (receipt.exists()) return { conflict: false, line: reliabilityDecoder.line(receipt.data()?.line) };
          if ((remote?.revision ?? 0) !== mutation.baseRevision) return { conflict: true, line: remote ?? { ...mutation.line, quantity: 0, removed: true, revision: 0 } };
          const count = Number(metadata.data()?.lineCount ?? 0) + (mutation.line.removed ? 0 : 1) - (remote && !remote.removed ? 1 : 0);
          if (count > 100 || count < 0) throw new Error('Cart line limit reached.');
          const line = { ...mutation.line, revision: mutation.baseRevision + 1 };
          transaction.set(reference, line);
          transaction.set(metadataReference, { revision: Number(metadata.data()?.revision ?? 0) + 1, lineCount: count, lastLineId: line.id, mutationId: mutation.id });
          transaction.set(receiptReference, { lineId: line.id, revision: line.revision, line });
          return { conflict: false, line };
        });
        nativeSessionService.assertOwner(ownerId);
        await this.enqueue(ownerId, async () => {
        const cart = await this.load(ownerId);
        cart.pending = cart.pending.filter((entry) => entry.id !== mutation.id);
        if (result.conflict) {
          // Preserve the newest local intent for this line as the conflict version.
          const later = cart.pending.filter((entry) => entry.lineId === mutation.lineId);
          cart.conflicts.push({ mutation: later[later.length - 1] ?? mutation, remote: result.line });
          cart.pending = cart.pending.filter((entry) => entry.lineId !== mutation.lineId);
        } else {
          const next = cart.pending.find((entry) => entry.lineId === mutation.lineId);
          if (next) { next.baseRevision = result.line.revision; next.line.revision = result.line.revision; }
          else cart.lines = [...cart.lines.filter((entry) => entry.id !== mutation.lineId), result.line];
        }
        await this.persist(ownerId, cart);
        });
      }
      const linesReference = collection(database, 'users', ownerId, 'cartLines');
      const snapshot = await getDocs(query(linesReference, where('removed', '==', false), limit(100)));
      const documents = [...snapshot.docs];
      const local = await this.enqueue(ownerId, () => this.load(ownerId));
      const missing = local.lines.filter((line) => !line.removed && !documents.some((document) => document.id === line.id)).map((line) => line.id);
      // Fetch tombstones only for locally visible lines, rather than every historical removal.
      for (let offset = 0; offset < missing.length; offset += 30) {
        const removed = await getDocs(query(linesReference, where(documentId(), 'in', missing.slice(offset, offset + 30)), limit(30)));
        documents.push(...removed.docs);
      }
      const metadata = await getDoc(metadataReference);
      return this.enqueue(ownerId, async () => {
      const cart = await this.load(ownerId);
      cart.revision = Math.max(cart.revision, reliabilityDecoder.integer(metadata.data()?.revision ?? 0));
      nativeSessionService.assertOwner(ownerId);
      for (const document of documents) {
        if (cart.conflicts.some((entry) => entry.mutation.lineId === document.id) || cart.pending.some((entry) => entry.lineId === document.id)) continue;
        const remote = reliabilityDecoder.line(document.data());
        const previous = cart.lines.find((line) => line.id === document.id);
        if (!previous || remote.revision >= previous.revision) cart.lines = [...cart.lines.filter((line) => line.id !== document.id), remote];
      }
      await this.persist(ownerId, cart);
      return cart;
    });
  }
}
export const cartSyncService = CartSyncService.getInstance();
