import React, { useState, useRef } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Text, Image } from 'react-native';

type Friend = {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
};

type DescriptionProps = {
    description: string;
    friendsList: Friend[];
    selectedMentions: string[];
    onDescriptionChange: (value: string) => void;
    onMentionAdd: (userName: string) => void;
    onMentionRemove: (userName: string) => void;
};

export const Description = ({
    description,
    friendsList,
    selectedMentions,
    onDescriptionChange,
    onMentionAdd
}: DescriptionProps) => {
    const [showFriends, setShowFriends] = useState(false);
    const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
    const [cursorPosition, setCursorPosition] = useState(0);
    const textareaRef = useRef<TextInput>(null);

    const handleInput = (value: string) => {
        const cursorPos = cursorPosition;
        const textBeforeCursor = value.slice(0, cursorPos);
        const words = textBeforeCursor.split(' ');
        const currentWord = words[words.length - 1];

        if (currentWord.startsWith('@')) {
            const searchTerm = currentWord.slice(1).toLowerCase();
            const filtered = friendsList.filter(friend =>
                friend.userName.toLowerCase().includes(searchTerm) ||
                friend.firstName.toLowerCase().includes(searchTerm) ||
                friend.lastName.toLowerCase().includes(searchTerm)
            );
            setFilteredFriends(filtered);
            setShowFriends(true);
        } else {
            setShowFriends(false);
        }
        onDescriptionChange(value);
    };

    const handleSelectionChange = (e: any) => {
        setCursorPosition(e.nativeEvent.selection.start);
    };

    const insertMention = (friend: Friend) => {
        if (!textareaRef.current) return;
        if (selectedMentions.includes(friend.userName)) {
            setShowFriends(false);
            return;
        }
        const text = description;
        const beforeMention = text.slice(0, cursorPosition).replace(/@\w*$/, '');
        const afterMention = text.slice(cursorPosition);
        const mentionText = `@${friend.userName} `;
        const newText = beforeMention + mentionText + afterMention;
        onDescriptionChange(newText);
        onMentionAdd(friend.userName);
        setShowFriends(false);
        setTimeout(() => {
            textareaRef.current?.focus();
        }, 0);
    };

    return (
        <View style={{ position: 'relative', marginBottom: 16 }}>
            <TextInput
                ref={textareaRef}
                value={description}
                onChangeText={handleInput}
                onSelectionChange={handleSelectionChange}
                placeholder="Write your post... Use @ to mention friends"
                style={{
                    width: '100%',
                    padding: 16,
                    backgroundColor: '#f9fafb',
                    borderRadius: 16,
                    minHeight: 120,
                    fontSize: 16,
                    textAlignVertical: 'top',
                }}
                multiline
                numberOfLines={5}
                placeholderTextColor="#888"
            />
            {showFriends && filteredFriends.length > 0 && (
                <View
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        backgroundColor: '#fff',
                        borderRadius: 16,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                        elevation: 4,
                        marginTop: 8,
                        zIndex: 50,
                        borderWidth: 1,
                        borderColor: '#eee',
                        maxHeight: 192,
                    }}
                >
                    <FlatList
                        data={filteredFriends}
                        keyExtractor={item => item.id}
                        style={{ maxHeight: 192 }}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    padding: 12,
                                    gap: 12,
                                }}
                                onPress={() => insertMention(item)}
                            >
                                {item.profileImage ? (
                                    <Image
                                        source={{ uri: item.profileImage }}
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 20,
                                            marginRight: 12,
                                            backgroundColor: '#e5e7eb',
                                        }}
                                    />
                                ) : (
                                    <View
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 20,
                                            marginRight: 12,
                                            backgroundColor: '#e5e7eb',
                                        }}
                                    />
                                )}
                                <View>
                                    <Text style={{ fontWeight: '500', color: '#111827' }}>
                                        {item.firstName} {item.lastName}
                                    </Text>
                                    <Text style={{ fontSize: 13, color: '#6b7280' }}>
                                        @{item.userName}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            )}
        </View>
    );
};
