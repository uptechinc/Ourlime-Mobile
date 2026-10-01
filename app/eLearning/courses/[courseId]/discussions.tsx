import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MessageCircle, Send } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { courseInteractionService } from '@/lib/services/CourseInteractionService';
import type { CourseDiscussion, DiscussionCursor } from '@/lib/types/course';

export default function CourseDiscussionsScreen() {
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { activeUserId, nativeSession, retryNativeSession } = useAppData();
  const [items, setItems] = useState<CourseDiscussion[]>([]);
  const [cursor, setCursor] = useState<DiscussionCursor | null>(null);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestGenerationRef = useRef(0);
  const operationIdRef = useRef('discussion_' + Date.now().toString(36));

  const loadPage = useCallback(async (pageCursor: DiscussionCursor | null, replace: boolean) => {
    if (!courseId || !activeUserId || nativeSession.status !== 'ready' || nativeSession.uid !== activeUserId) return;
    const generation = ++requestGenerationRef.current;
    if (replace) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    try {
      const page = await courseInteractionService.getDiscussions(courseId, pageCursor);
      if (generation !== requestGenerationRef.current) return;
      setItems((currentItems) => replace ? page.items : [...currentItems, ...page.items.filter((nextItem) => !currentItems.some((currentItem) => currentItem.id === nextItem.id))]);
      setCursor(page.cursor);
    } catch (loadError) {
      console.error('[CourseDiscussionsScreen] Load failed:', loadError);
      if (generation === requestGenerationRef.current) setError('Discussions could not be loaded. Check your connection and try again.');
    } finally {
      if (generation === requestGenerationRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [activeUserId, courseId, nativeSession.status, nativeSession.uid]);

  useEffect(() => {
    void loadPage(null, true);
    return () => { requestGenerationRef.current += 1; };
  }, [loadPage]);

  const handleSend = async () => {
    const message = body.trim();
    if (!message || !courseId || sending) return;
    setSending(true);
    try {
      await courseInteractionService.createDiscussion(courseId, message, operationIdRef.current);
      setBody('');
      operationIdRef.current = 'discussion_' + Date.now().toString(36);
      await loadPage(null, true);
    } catch (sendError) {
      console.error('[CourseDiscussionsScreen] Send failed:', sendError);
      setError('Your message was not confirmed. Your text is still here so you can retry.');
    } finally {
      setSending(false);
    }
  };

  const connecting = Boolean(activeUserId) && (nativeSession.status === 'idle' || nativeSession.status === 'bridging');
  return (
    <View style={styles.container}>
      <PageHeader title="Course discussions" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.content}>
        {connecting ? <View style={styles.center}><ActivityIndicator color={colors.accent} /><Text style={styles.muted}>Connecting your secure learning session…</Text></View> : null}
        {nativeSession.status === 'retryable_failure' ? <View style={styles.center}><Text style={styles.errorText}>The secure learning session could not connect.</Text><TouchableOpacity onPress={retryNativeSession} style={styles.retryButton}><Text style={styles.buttonText}>Try Again</Text></TouchableOpacity></View> : null}
        {!connecting && nativeSession.status !== 'retryable_failure' ? (
          <FlatList
            data={items}
            keyExtractor={(discussion) => discussion.id}
            contentContainerStyle={items.length ? styles.list : styles.emptyList}
            refreshing={loading && items.length > 0}
            onRefresh={() => void loadPage(null, true)}
            onEndReached={() => { if (cursor && !loadingMore) void loadPage(cursor, false); }}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={loading ? <ActivityIndicator color={colors.accent} /> : <View style={styles.center}><MessageCircle size={42} color={colors.mutedText} /><Text style={styles.title}>{error ? 'Discussions unavailable' : 'No discussions yet'}</Text><Text style={styles.muted}>{error ?? 'Ask the first question about this course.'}</Text>{error ? <TouchableOpacity onPress={() => void loadPage(null, true)} style={styles.retryButton}><Text style={styles.buttonText}>Try Again</Text></TouchableOpacity> : null}</View>}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.accent} /> : null}
            renderItem={({ item }) => <View style={styles.card}><View style={styles.row}><Text style={styles.author}>{item.authorName ?? 'Account unavailable'}</Text><Text style={styles.date}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Sending'}</Text></View><Text style={styles.body}>{item.body}</Text><Text style={styles.replyCount}>{item.replyCount} {item.replyCount === 1 ? 'reply' : 'replies'}</Text></View>}
          />
        ) : null}
        {nativeSession.status === 'ready' ? <View style={styles.composer}><TextInput value={body} onChangeText={setBody} editable={!sending} multiline maxLength={4000} placeholder="Ask a question or start a discussion" placeholderTextColor={colors.mutedText} style={styles.input} /><TouchableOpacity accessibilityRole="button" accessibilityLabel="Send discussion" onPress={() => void handleSend()} disabled={!body.trim() || sending} style={[styles.sendButton, (!body.trim() || sending) && styles.disabled]}>{sending ? <ActivityIndicator color={colors.onAccent} /> : <Send size={20} color={colors.onAccent} />}</TouchableOpacity></View> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas }, content: { flex: 1 }, list: { padding: 16, gap: 12, paddingBottom: 24 }, emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 }, title: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }, muted: { color: colors.mutedText, fontSize: 13, lineHeight: 19, textAlign: 'center' }, errorText: { color: colors.destructiveText, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 15, gap: 9 }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, author: { color: colors.text, fontWeight: '800', flex: 1 }, date: { color: colors.mutedText, fontSize: 12 }, body: { color: colors.text, fontSize: 15, lineHeight: 22 }, replyCount: { color: colors.accentText, fontSize: 12, fontWeight: '700' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }, input: { flex: 1, minHeight: 44, maxHeight: 120, color: colors.text, backgroundColor: colors.input, borderColor: colors.border, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 11 }, sendButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.45 }, retryButton: { minHeight: 44, justifyContent: 'center', backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 18 }, buttonText: { color: colors.onAccent, fontWeight: '800' },
});
