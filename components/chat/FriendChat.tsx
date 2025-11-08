import { useRouter } from "expo-router";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

const mockFriends = [
    {
        name: 'John Doe',
        photo: 'https://www.w3schools.com/w3images/avatar2.png'
    },
    {
        name: 'Jane Doe',
        photo: 'https://www.w3schools.com/howto/img_avatar2.png'
    }
];

// const openChat = () => {
//     router.push('chat/demo' as any)
// }

export default function FriendChats() {

    const router = useRouter();

    return (
        mockFriends.map((friend) => (
            <View>
                <TouchableOpacity onPress={() => router.push('/chat/[id]/page')} style={{
                    display: 'flex', flexDirection: 'row', justifyContent: "flex-start", alignItems: 'center',
                    marginTop: 3, marginBottom: 3
                }}>
                    <Image
                        source={{ uri: friend.photo }}
                        style={{ width: 42, height: 42, borderRadius: 24, marginRight: 20, alignSelf: 'flex-start' }}
                    />
                    <Text style={{ fontSize: 24, fontWeight: "bold" }}>{friend.name}</Text>
                </TouchableOpacity>
            </View >
        ))
    );
}