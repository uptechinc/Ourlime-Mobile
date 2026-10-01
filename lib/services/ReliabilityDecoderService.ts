import type { BlogDraftPayload, CartLine, CartMutation, CartSnapshot, CatalogPage, ContentDraft, MarketProduct, MarketVariant, PublicationReceipt, TaskDraftPayload } from '@/lib/types/reliability';
import type { BlogListItem, BlogPage } from '@/lib/types/blog';


/** Decode untrusted disk and Firebase values before they enter domain state. */
export class ReliabilityDecoderService {
  public object(value: unknown): { [key: string]: unknown } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Saved data is malformed and has been preserved for recovery.');
    return value as { [key: string]: unknown };
  }
  public string(value: unknown): string {
    if (typeof value !== 'string') throw new Error('Expected text in saved data.');
    return value;
  }
  public number(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Expected a finite number.');
    return value;
  }
  public integer(value: unknown): number {
    const number = this.number(value);
    if (!Number.isSafeInteger(number) || number < 0) throw new Error('Invalid revision or quantity.');
    return number;
  }
  public strings(value: unknown): string[] {
    if (!Array.isArray(value)) throw new Error('Expected a list.');
    return value.map((item: unknown) => this.string(item));
  }
  public list<TValue>(value: unknown, decode: (item: unknown) => TValue): TValue[] {
    if (!Array.isArray(value)) throw new Error('Expected a list.');
    return value.map(decode);
  }
  public line = (value: unknown): CartLine => {
    const line = this.object(value);
    const quantity = this.integer(line.quantity);
    if (quantity > 99) throw new Error('Cart quantities cannot exceed 99.');
    return { id: this.string(line.id), productId: this.string(line.productId), variantId: this.string(line.variantId), quantity,
      title: this.string(line.title), variantLabel: this.string(line.variantLabel), image: line.image === null ? null : this.string(line.image),
      price: this.number(line.price), currency: this.string(line.currency), revision: this.integer(line.revision), removed: line.removed === true };
  };
  public mutation = (value: unknown): CartMutation => {
    const mutation = this.object(value);
    return { id: this.string(mutation.id), lineId: this.string(mutation.lineId), baseRevision: this.integer(mutation.baseRevision), line: this.line(mutation.line) };
  };
  public cart = (value: unknown): CartSnapshot => {
    const cart = this.object(value);
    return { revision: this.integer(cart.revision), lines: this.list(cart.lines, this.line), pending: this.list(cart.pending, this.mutation),
      conflicts: this.list(cart.conflicts, (item) => { const conflict = this.object(item); return { mutation: this.mutation(conflict.mutation), remote: this.line(conflict.remote) }; }) };
  };
  public blog(value: unknown): BlogDraftPayload {
    const draft = this.object(value);
    if (draft.type !== 'blog' && draft.type !== 'article') throw new Error('Invalid blog type.');
    return { title: this.string(draft.title), type: draft.type, excerpt: this.string(draft.excerpt), content: this.string(draft.content), coverImage: this.string(draft.coverImage),
      categoryId: this.string(draft.categoryId), readTime: this.number(draft.readTime), tags: this.strings(draft.tags), sources: this.list(draft.sources, (item) => {
        const source = this.object(item);
        return { title: this.string(source.title), url: this.string(source.url), author: this.string(source.author), publishDate: this.string(source.publishDate), type: this.string(source.type), citation: this.string(source.citation), isVerified: source.isVerified === true };
      }) };
  }
  public task(value: unknown): TaskDraftPayload {
    const draft = this.object(value);
    if (!['todo', 'in-progress', 'done'].includes(this.string(draft.status))) throw new Error('Invalid task status.');
    if (!['low', 'medium', 'high', 'urgent'].includes(this.string(draft.priority))) throw new Error('Invalid task priority.');
    return { title: this.string(draft.title), description: this.string(draft.description), status: draft.status as TaskDraftPayload['status'], priority: draft.priority as TaskDraftPayload['priority'],
      assignee: this.string(draft.assignee), assignees: this.strings(draft.assignees), dueDate: draft.dueDate === null ? null : this.string(draft.dueDate), estimatedTime: this.number(draft.estimatedTime), tags: this.strings(draft.tags) };
  }
  public receipt(value: unknown): PublicationReceipt | null {
    if (value === null) return null;
    const receipt = this.object(value);
    return { operationId: this.string(receipt.operationId), destinationId: this.string(receipt.destinationId), publishedAt: this.string(receipt.publishedAt) };
  }
  public draft = (value: unknown): ContentDraft => {
    const draft = this.object(value);
    const common = { id: this.string(draft.id), ownerId: this.string(draft.ownerId), name: this.string(draft.name), revision: this.integer(draft.revision), localRevision: this.integer(draft.localRevision), syncedLocalRevision: this.integer(draft.syncedLocalRevision),
      editId: this.string(draft.editId), operationId: this.string(draft.operationId), lastSavedAt: this.string(draft.lastSavedAt), deleted: draft.deleted === true, receipt: this.receipt(draft.receipt), conflictOf: draft.conflictOf === null ? null : this.string(draft.conflictOf) };
    if (draft.kind === 'blog' && draft.projectId === null) return { ...common, kind: 'blog', projectId: null, payload: this.blog(draft.payload) };
    if (draft.kind === 'task') return { ...common, kind: 'task', projectId: this.string(draft.projectId), payload: this.task(draft.payload) };
    throw new Error('Unsupported draft kind.');
  };
  public marketVariant = (value: unknown): MarketVariant => {
    const variant = this.object(value);
    return { id: this.string(variant.id), productId: this.string(variant.productId), label: this.string(variant.label), price: this.number(variant.price), currency: this.string(variant.currency), stock: this.integer(variant.stock), available: variant.available === true, image: variant.image === null ? null : this.string(variant.image),
      colorName: typeof variant.colorName === 'string' ? variant.colorName : null, colorCode: typeof variant.colorCode === 'string' ? variant.colorCode : null, sizeName: typeof variant.sizeName === 'string' ? variant.sizeName : null, sku: typeof variant.sku === 'string' ? variant.sku : null };
  };
  public marketProduct = (value: unknown): MarketProduct => {
    const product = this.object(value);
    const condition = product.condition;
    if (condition !== undefined && condition !== null && !['new', 'like_new', 'good', 'fair', 'refurbished'].includes(this.string(condition))) throw new Error('Invalid product condition.');
    const optionalText = (value: unknown): string | null => typeof value === 'string' ? value : null;
    const optionalNumber = (value: unknown): number | null => typeof value === 'number' ? this.number(value) : null;
    return { id: this.string(product.id), title: this.string(product.title), shortDescription: typeof product.shortDescription === 'string' ? product.shortDescription : '', description: this.string(product.description), category: this.string(product.category), images: this.strings(product.images), sellerId: this.string(product.sellerId), sellerName: this.string(product.sellerName), sellerVerified: product.sellerVerified === true, available: product.available === true, unavailableReason: product.unavailableReason === null ? null : this.string(product.unavailableReason), variants: this.list(product.variants, this.marketVariant),
      condition: condition as MarketProduct['condition'] ?? null, brand: optionalText(product.brand), sku: optionalText(product.sku), tags: Array.isArray(product.tags) ? this.strings(product.tags) : [], rating: optionalNumber(product.rating), ratingCount: typeof product.ratingCount === 'number' ? this.integer(product.ratingCount) : 0, popularity: typeof product.popularity === 'number' ? this.number(product.popularity) : 0, originalPrice: optionalNumber(product.originalPrice), salePrice: optionalNumber(product.salePrice), isOnSale: product.isOnSale === true, deliveryAvailable: typeof product.deliveryAvailable === 'boolean' ? product.deliveryAvailable : null, pickupAvailable: typeof product.pickupAvailable === 'boolean' ? product.pickupAvailable : null, returnsAllowed: typeof product.returnsAllowed === 'boolean' ? product.returnsAllowed : null, returnPolicy: optionalText(product.returnPolicy), warranty: optionalText(product.warranty) };
  };
  public catalogPage = (value: unknown): CatalogPage => {
    const page = this.object(value);
    const cursor = page.cursor === null ? null : this.object(page.cursor);
    return { products: this.list(page.products, this.marketProduct), cursor: cursor ? { search: this.string(cursor.search), category: this.string(cursor.category), title: this.string(cursor.title), id: this.string(cursor.id) } : null };
  };
  public blogListItem = (value: unknown): BlogListItem => {
    const item = this.object(value);
    const author = item.author && typeof item.author === 'object' ? item.author as { id?: unknown; name?: unknown; avatar?: unknown; isVerified?: unknown } : {};
    const text = (entry: unknown, fallback = '') => typeof entry === 'string' ? entry : fallback;
    const count = (entry: unknown) => typeof entry === 'number' && Number.isFinite(entry) ? entry : 0;
    const status = item.status;
    return {
      id: text(item.id),
      userId: text(item.userId),
      title: text(item.title),
      excerpt: text(item.excerpt),
      coverImage: text(item.coverImage),
      type: item.type === 'article' ? 'article' : 'blog',
      categoryId: text(item.categoryId),
      categoryName: text(item.categoryName, 'General'),
      tags: Array.isArray(item.tags) ? this.strings(item.tags) : [],
      readTime: count(item.readTime),
      createdAtMs: typeof item.createdAtMs === 'number' && Number.isFinite(item.createdAtMs) ? item.createdAtMs : null,
      status: status === 'draft' || status === 'scheduled' || status === 'archived' || status === 'removed' ? status : 'published',
      author: { id: text(author.id), name: text(author.name, 'Ourlime Author'), avatar: text(author.avatar), isVerified: author.isVerified === true },
      likesCount: count(item.likesCount),
      commentsCount: count(item.commentsCount),
      viewsCount: count(item.viewsCount),
    };
  };
  public blogPage = (value: unknown): BlogPage => {
    const page = this.object(value);
    return {
      items: Array.isArray(page.items) ? page.items.map(this.blogListItem).filter((item) => item.id) : [],
      page: typeof page.page === 'number' && page.page > 0 ? page.page : 1,
      total: typeof page.total === 'number' && page.total >= 0 ? page.total : 0,
      popularTags: Array.isArray(page.popularTags) ? this.strings(page.popularTags) : [],
    };
  };
}
export const reliabilityDecoder = new ReliabilityDecoderService();
