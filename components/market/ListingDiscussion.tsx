import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { nativeEngagementService, type DiscussionComment } from '@/lib/services/NativeEngagementService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import DiscussionReportModal from './DiscussionReportModal';

type ListingDiscussionProps = { ownerId: string; productId: string; sellerId: string; canMutate: boolean; parentId?: string };
export default function ListingDiscussion({ ownerId, productId, sellerId, canMutate, parentId }: ListingDiscussionProps) {
  const { colors } = useAppTheme();
  const [comments, setComments] = useState<DiscussionComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const load = useCallback(async (next?: string | null) => {
    try {
      const page = await nativeEngagementService.page(ownerId, 'product', productId, parentId, next);
      setComments((current) => next ? [...new Map([...current, ...page.comments].map((comment) => [comment.id, comment])).values()] : page.comments);
      setCursor(page.cursor); setError(null);
    } catch { setError('Discussion could not be loaded. Tap retry.'); }
  }, [ownerId, parentId, productId]);
  useEffect(() => { void load(); }, [load]);
  const send = async () => {
    if (busy || !canMutate || !text.trim()) return;
    setBusy(true);
    try { await nativeEngagementService.mutate(ownerId, { kind: 'product', targetId: productId, action: 'comment', parentId, text }); setText(''); await load(); }
    catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Comment failed. Your text is retained.'); }
    finally { setBusy(false); }
  };
  return <View style={{ gap: 10, padding: 12, borderColor: colors.border, borderWidth: 1, borderRadius: 12 }}>
    <Text style={{ color: colors.text, fontWeight: '700' }}>{parentId ? 'Replies' : 'Listing discussion'}</Text>
    {error ? <Pressable onPress={() => void load()} style={{ padding: 12 }}><Text style={{ color: colors.destructive }}>{error}</Text></Pressable> : null}
    {comments.map((comment) => <View key={comment.id} style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: '600' }}>{comment.authorName}{comment.userId === sellerId ? ' · Seller' : ''}</Text>
      <Text style={{ color: colors.mutedText }}>{comment.date}</Text>
      <Text style={{ color: colors.text }}>{comment.text}</Text>
      {canMutate && !comment.removed ? <Pressable onPress={() => setReportId(comment.id)} style={{ padding: 12 }}><Text style={{ color: colors.secondaryText }}>Report</Text></Pressable> : null}
      {!parentId && !comment.removed ? <Pressable onPress={() => setReplyId(replyId === comment.id ? null : comment.id)} style={{ padding: 12 }}><Text style={{ color: colors.accentText }}>Replies ({comment.replyCount})</Text></Pressable> : null}
      {canMutate && comment.userId === ownerId && !comment.removed ? <Pressable onPress={() => {
        void nativeEngagementService.mutate(ownerId, { kind: 'product', targetId: productId, action: 'delete_comment', commentId: comment.id, parentId }).then(() => load()).catch(() => setError('Deletion failed. Retry.'));
      }} style={{ padding: 12 }}><Text style={{ color: colors.destructive }}>Delete my comment</Text></Pressable> : null}
      {replyId === comment.id ? <ListingDiscussion ownerId={ownerId} productId={productId} sellerId={sellerId} canMutate={canMutate} parentId={comment.id} /> : null}
    </View>)}
    {cursor ? <Pressable onPress={() => void load(cursor)} style={{ padding: 12 }}><Text style={{ color: colors.accentText }}>Load more</Text></Pressable> : null}
    {canMutate ? <><TextInput accessibilityLabel={parentId ? 'Reply' : 'Comment'} value={text} onChangeText={setText} multiline maxLength={5000} placeholder="Ask about this listing" placeholderTextColor={colors.mutedText} style={{ color: colors.text, backgroundColor: colors.input, padding: 12 }} />
      <Pressable disabled={busy || !text.trim()} accessibilityRole="button" onPress={() => void send()} style={{ padding: 14 }}><Text style={{ color: colors.accentText }}>{busy ? 'Sending…' : 'Send'}</Text></Pressable></> : null}
    {reportId ? <DiscussionReportModal ownerId={ownerId} kind="product" targetId={productId} commentId={reportId} parentId={parentId} onClose={() => setReportId(null)} /> : null}
  </View>;
}
