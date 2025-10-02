import React from 'react';
import { View, Text, Image } from 'react-native';

interface User {
    firstName: string;
    lastName: string;
    userName: string;
    profileImage?: string;
}

interface Post {
    user: User;
    // Add other post fields as needed
}

interface PostCardProps {
    post: Post;
}

export default function PostCard({ post }: PostCardProps) {
    return (
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image
                    source={{ uri: post.user.profileImage || 'https://ui-avatars.com/api/?name=User' }}
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5e7eb' }}
                    resizeMode="cover"
                />
                <View style={{ marginLeft: 12 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#111827' }}>{post.user.firstName} {post.user.lastName}</Text>
                    <Text style={{ fontSize: 13, color: '#6b7280' }}>{post.user.userName}</Text>
                </View>
            </View>
            {/* Add more post content rendering here */}
        </View>
    );
}