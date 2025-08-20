import React from 'react';
import { View, Text, Image } from 'react-native';

export const ProfileSection = () => {
    // Placeholder data for demonstration
    const profileImage = undefined;
    const firstName = 'John';
    const lastName = 'Doe';
    const userName = 'johndoe';
    const friendsCount = 42;
    const postsCount = 17;
    const followingCount = 8;

    return (
        <View style={{ paddingVertical: 4 }}>
            {/* Profile Info */}
            <View style={{ flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden', marginBottom: 6, borderWidth: 2, borderColor: '#bbf7d0', backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }}>
                    {profileImage ? (
                        <Image
                            source={{ uri: profileImage }}
                            style={{ width: 56, height: 56, borderRadius: 28 }}
                            resizeMode="cover"
                        />
                    ) : (
                        <Text style={{ fontSize: 18, color: '#6b7280', fontWeight: 'bold' }}>
                            {firstName.charAt(0)}{lastName.charAt(0)}
                        </Text>
                    )}
                </View>
                <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#111827', lineHeight: 18 }}>{firstName} {lastName}</Text>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>@{userName}</Text>
            </View>
            {/* Stats Grid */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: 10, alignItems: 'center', paddingVertical: 6, marginHorizontal: 2 }}>
                    <Text style={{ fontWeight: 'bold', color: '#10b981', fontSize: 14 }}>{friendsCount}</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>Friends</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: 10, alignItems: 'center', paddingVertical: 6, marginHorizontal: 2 }}>
                    <Text style={{ fontWeight: 'bold', color: '#10b981', fontSize: 14 }}>{postsCount}</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>Posts</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: 10, alignItems: 'center', paddingVertical: 6, marginHorizontal: 2 }}>
                    <Text style={{ fontWeight: 'bold', color: '#10b981', fontSize: 14 }}>{followingCount}</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>Following</Text>
                </View>
            </View>
        </View>
    );
};

