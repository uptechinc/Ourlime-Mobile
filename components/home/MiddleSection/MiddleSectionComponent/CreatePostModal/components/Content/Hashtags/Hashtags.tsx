import React from 'react';
import { View, TextInput, TouchableOpacity, Text, ScrollView } from 'react-native';

type HashtagsProps = {
    hashtags: string[];
    hashtagInput: string;
    onHashtagInputChange: (value: string) => void;
    onHashtagAdd: (tag: string) => void;
    onHashtagRemove: (tag: string) => void;
};

export const Hashtags = ({
    hashtags,
    hashtagInput,
    onHashtagInputChange,
    onHashtagAdd,
    onHashtagRemove
}: HashtagsProps) => {
    const handleHashtagSubmit = (e: any) => {
        if (e.nativeEvent.key === 'Enter' && hashtagInput.trim()) {
            const tag = hashtagInput.trim().startsWith('#')
                ? hashtagInput.trim()
                : `#${hashtagInput.trim()}`;
            if (!hashtags.includes(tag)) {
                onHashtagAdd(tag);
            }
            onHashtagInputChange('');
        }
    };

    return (
        <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, backgroundColor: '#f9fafb', borderRadius: 16, padding: 12 }}>
                <Text style={{ color: '#6b7280', fontSize: 18, marginRight: 4 }}>#</Text>
                <TextInput
                    placeholder="Add hashtags (press Enter)"
                    value={hashtagInput}
                    onChangeText={onHashtagInputChange}
                    onKeyPress={handleHashtagSubmit}
                    style={{ flex: 1, backgroundColor: 'transparent' }}
                    placeholderTextColor="#888"
                />
            </View>
            <ScrollView
                horizontal={false}
                contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                style={{}}
            >
                {hashtags.map(tag => (
                    <View
                        key={tag}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            backgroundColor: 'rgba(16,185,129,0.1)', // greenTheme/10
                            borderRadius: 999,
                            marginRight: 8,
                            marginBottom: 8,
                        }}
                    >
                        <Text style={{ color: '#10b981', fontWeight: '500', fontSize: 14, marginRight: 6 }}>{tag}</Text>
                        <TouchableOpacity
                            onPress={() => onHashtagRemove(tag)}
                            style={{ padding: 4, borderRadius: 999 }}
                        >
                            <Text style={{ color: '#10b981', fontSize: 14 }}>&times;</Text>
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};
