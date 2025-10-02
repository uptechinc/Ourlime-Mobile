import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

type PostFooterProps = {
    isSubmitting: boolean;
    friendsCount: number;
    isDisabled: boolean;
    onEmojiClick: () => void;
    onPost: () => void;
    postType: 'regular' | 'poll' | 'reel';
};

export const PostFooter = ({
    isSubmitting,
    friendsCount,
    isDisabled,
    onEmojiClick,
    onPost
}: PostFooterProps) => {
    return (
        <View
            style={{
                flexDirection: 'column',
                gap: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: '#e5e7eb',
                marginTop: 'auto',
            }}
        >
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    marginBottom: 8,
                }}
            >
                <TouchableOpacity
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#f9fafb',
                        borderRadius: 12,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        marginRight: 8,
                    }}
                    onPress={onEmojiClick}
                    disabled={isSubmitting || isDisabled}
                >
                    <Icon name="smile" size={18} color="#374151" />
                    <Text
                        style={{
                            color: '#374151',
                            fontSize: 14,
                            marginLeft: 6,
                        }}
                    >
                        Add Emoji
                    </Text>
                </TouchableOpacity>
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#f9fafb',
                        borderRadius: 12,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        marginRight: 8,
                    }}
                >
                    <Icon name="users" size={18} color="#374151" />
                    <Text
                        style={{
                            color: '#374151',
                            fontSize: 14,
                            marginLeft: 6,
                        }}
                    >
                        {friendsCount} Friends
                    </Text>
                </View>
            </View>
            <TouchableOpacity
                onPress={onPost}
                disabled={isSubmitting || isDisabled}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    paddingVertical: 8,
                    paddingHorizontal: 24,
                    width: '100%',
                    backgroundColor: (isSubmitting || isDisabled) ? '#f3f4f6' : '#10b981',
                }}
            >
                {isSubmitting ? (
                    <>
                        <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                        <Text
                            style={{
                                color: '#fff',
                                fontSize: 16,
                                fontWeight: '500',
                            }}
                        >
                            Posting...
                        </Text>
                    </>
                ) : (
                    <>
                        <Text
                            style={{
                                color: '#fff',
                                fontSize: 16,
                                fontWeight: '500',
                            }}
                        >
                            Share Post
                        </Text>
                        <Icon name="upload" size={16} color="#fff" style={{ marginLeft: 8 }} />
                    </>
                )}
            </TouchableOpacity>
        </View>
    );
};

