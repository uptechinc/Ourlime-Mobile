import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlogsAndArticlesService, type BlogListItem } from '@/lib/blogs&articles/BlogsAndArticlesService';
import UserAvatar from '@/components/ui/UserAvatar';

const blogService = BlogsAndArticlesService.getInstance();

export default function BlogDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [blog, setBlog] = useState<BlogListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBlog = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try { setBlog(await blogService.getPost(id)); }
    catch (loadError: unknown) {
      console.error('[BlogDetailScreen.loadBlog]', loadError);
      setError('This blog could not be loaded.');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void loadBlog(); }, [loadBlog]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}><Ionicons name="chevron-back" size={26} color="#0f172a" /></TouchableOpacity>
        <Text style={{ flex: 1, marginLeft: 10, fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Blog</Text>
        {blog ? <TouchableOpacity onPress={() => void Share.share({ message: `${blog.title}\nhttps://ourlime.com/blogs/${blog.id}` })} style={{ padding: 4 }}><Ionicons name="share-outline" size={22} color="#475569" /></TouchableOpacity> : null}
      </View>
      {loading ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#10b981" /></View> : error || !blog ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}><Text style={{ color: '#475569' }}>{error || 'Blog not found.'}</Text><TouchableOpacity onPress={() => void loadBlog()} style={{ marginTop: 14, backgroundColor: '#10b981', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 999 }}><Text style={{ color: '#fff', fontWeight: '800' }}>Retry</Text></TouchableOpacity></View> : <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
        {blog.coverImage ? <Image source={{ uri: blog.coverImage }} style={{ width: '100%', height: 230 }} resizeMode="cover" /> : null}
        <View style={{ padding: 20, backgroundColor: '#fff' }}>
          {blog.category ? <Text style={{ color: '#059669', fontWeight: '800', textTransform: 'uppercase' }}>{blog.category}</Text> : null}
          <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: '900', color: '#0f172a', marginTop: 8 }}>{blog.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}><UserAvatar profileImage={blog.author.avatar} firstName={blog.author.name} size={42} /><View style={{ marginLeft: 10 }}><Text style={{ color: '#0f172a', fontWeight: '800' }}>{blog.author.name}</Text><Text style={{ color: '#64748b', marginTop: 2 }}>{blog.readTime || 1} min read</Text></View></View>
          <Text style={{ color: '#334155', lineHeight: 24, fontSize: 16, marginTop: 24 }}>{blog.excerpt || 'This article does not have a text summary yet.'}</Text>
          {blog.tags.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 22 }}>{blog.tags.map((tag) => <View key={tag.name} style={{ backgroundColor: '#ecfdf5', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 }}><Text style={{ color: '#047857', fontWeight: '700' }}>#{tag.name}</Text></View>)}</View> : null}
        </View>
      </ScrollView>}
    </SafeAreaView>
  );
}
