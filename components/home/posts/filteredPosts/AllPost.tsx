import React from 'react';
import { View, Text, Image, TextInput, ScrollView, StyleSheet } from 'react-native';
import { Heart, MessageCircle, Share } from 'lucide-react-native';
import type { SocialPosts } from '@/app/types/global';

function formatDate(time: number | { seconds: number }): string {
  // Accepts either a JS timestamp or a Firestore Timestamp-like object
  let date: Date;
  if (typeof time === 'object' && 'seconds' in time) {
    date = new Date(time.seconds * 1000);
  } else {
    date = new Date(time);
  }
  return date.toLocaleDateString();
}

export default function AllPosts({ allPosts }: { allPosts: SocialPosts[] }) {
  return (
    <ScrollView>
      {allPosts
        .sort((a, b) => {
          const ta = typeof a.time === 'object' && 'seconds' in a.time ? a.time.seconds : a.time;
          const tb = typeof b.time === 'object' && 'seconds' in b.time ? b.time.seconds : b.time;
          return tb - ta;
        })
        .map((post, index) => (
          <View
            key={index}
            style={{
              marginBottom: 20,
              marginTop: 20,
              flexDirection: 'column',
              justifyContent: 'center',
              borderRadius: 16,
              backgroundColor: 'white',
              padding: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ height: 48, width: 48, overflow: 'hidden', borderRadius: 24, backgroundColor: '#eee', marginRight: 8 }}>
                <Image
                  source={typeof post.profileImage === 'string' ? { uri: post.profileImage } : undefined}
                  style={{ height: '100%', width: '100%', resizeMode: 'cover' }}
                />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '600' }}>{post.username}</Text>
              <Text style={{ marginLeft: 'auto', fontSize: 13, color: '#888' }}>{formatDate(post.time)}</Text>
            </View>
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 16 }}>{post.content}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                {post.type.video?.length > 1 && (
                  <View style={{ width: '100%', height: 240, backgroundColor: '#00000022', justifyContent: 'center', alignItems: 'center', borderRadius: 8 }}>
                    <Text style={{ color: '#888' }}>[Video playback here]</Text>
                  </View>
                )}
                {post.type.image?.length > 1 && (
                  <Image
                    source={{ uri: post.type.image }}
                    style={{ maxHeight: 260, width: '100%', resizeMode: 'cover', borderRadius: 8 }}
                  />
                )}
              </View>
              <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Heart size={20} color="#e11d48" style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 16 }}>{post.likes ?? 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MessageCircle size={20} color="#6b7280" style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 16 }}>{post.comments ?? 0}</Text>
                </View>
                <Share size={20} color="#2563eb" style={{ marginLeft: 8 }} />
                {/* Avatar group placeholder */}
                <View style={{ marginLeft: 'auto', flexDirection: 'row-reverse' }}>
                  {[...Array(3)].map((_, idx) => (
                    <Image
                      key={idx}
                      source={require('@/assets/images/transparentLogo.png')}
                      style={{ width: 28, height: 28, borderRadius: 14, marginLeft: -8, borderWidth: 2, borderColor: '#fff' }}
                    />
                  ))}
                </View>
              </View>
              <View style={{ marginTop: 8 }}>
                <TextInput
                  placeholder="Type your comment here..."
                  style={{ height: 48, width: '100%', borderColor: '#e5e7eb', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, backgroundColor: '#fafafa' }}
                  multiline
                />
              </View>
            </View>
          </View>
        ))}
    </ScrollView>
  );
}
