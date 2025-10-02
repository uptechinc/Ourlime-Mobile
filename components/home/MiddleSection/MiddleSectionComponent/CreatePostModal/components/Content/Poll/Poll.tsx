import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';

type PollOption = {
    id: string;
    text: string;
};

type PollProps = {
    pollOptions: PollOption[];
    pollDuration: string;
    pollImage: string | null;
    onOptionAdd: () => void;
    onOptionRemove: (id: string) => void;
    onOptionUpdate: (id: string, text: string) => void;
    onDurationChange: (duration: string) => void;
    onImageUpload: (file: any) => void;
    onImageRemove: () => void;
};

export const Poll = ({
    pollOptions,
    pollDuration,
    pollImage,
    onOptionAdd,
    onOptionRemove,
    onOptionUpdate,
    onDurationChange,
    onImageUpload,
    onImageRemove
}: PollProps) => {
    // File/image picking logic for React Native would use expo-image-picker or react-native-image-picker
    // Here, we just show a placeholder for the upload button
    return (
        <View style={{ gap: 16 }}>
            {/* Poll Options */}
            <View style={{ gap: 12 }}>
                {pollOptions.map((option, index) => (
                    <View key={option.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TextInput
                            placeholder={`Option ${index + 1}`}
                            value={option.text}
                            onChangeText={text => onOptionUpdate(option.id, text)}
                            style={{ flex: 1, padding: 12, backgroundColor: '#f9fafb', borderRadius: 12, fontSize: 16 }}
                        />
                        {index > 1 && (
                            <TouchableOpacity
                                onPress={() => onOptionRemove(option.id)}
                                style={{ padding: 8, borderRadius: 12, backgroundColor: '#fee2e2' }}
                            >
                                <Text style={{ color: '#ef4444', fontSize: 18 }}>−</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
                {pollOptions.length < 4 && (
                    <TouchableOpacity
                        onPress={onOptionAdd}
                        style={{ width: '100%', padding: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: '#e5e7eb', borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                    >
                        <Text style={{ color: '#10b981', fontSize: 18, marginRight: 8 }}>＋</Text>
                        <Text style={{ color: '#6b7280', fontWeight: '500' }}>Add Option</Text>
                    </TouchableOpacity>
                )}
            </View>
            {/* Poll Duration */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 14, color: '#6b7280', marginRight: 8 }}>Poll Duration:</Text>
                <View style={{ flex: 1, backgroundColor: '#f9fafb', borderRadius: 12 }}>
                    <Picker
                        selectedValue={pollDuration}
                        onValueChange={onDurationChange}
                        style={{ padding: 8 }}
                        dropdownIconColor="#10b981"
                    >
                        <Picker.Item label="24 hours" value="24" />
                        <Picker.Item label="2 days" value="48" />
                        <Picker.Item label="3 days" value="72" />
                        <Picker.Item label="1 week" value="168" />
                    </Picker>
                </View>
            </View>
            {/* Poll Image Upload */}
            <View style={{ marginTop: 16 }}>
                {!pollImage ? (
                    <TouchableOpacity
                        style={{
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 24,
                            borderWidth: 2,
                            borderStyle: 'dashed',
                            borderRadius: 16,
                            borderColor: '#d1d5db',
                            backgroundColor: '#f9fafb',
                        }}
                        // onPress should open image picker
                        onPress={() => {}}
                    >
                        <Text style={{ fontSize: 32, color: '#9ca3af', marginBottom: 8 }}>⬆️</Text>
                        <Text style={{ color: '#4b5563', fontWeight: '500', marginBottom: 2 }}>Add an image to your poll</Text>
                        <Text style={{ fontSize: 13, color: '#9ca3af' }}>Tap to upload</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ position: 'relative', aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', marginTop: 8 }}>
                        <Image
                            source={{ uri: pollImage }}
                            style={{ width: '100%', height: '100%', borderRadius: 16, resizeMode: 'cover' }}
                        />
                        <TouchableOpacity
                            onPress={onImageRemove}
                            style={{ position: 'absolute', top: 8, right: 8, padding: 8, backgroundColor: '#ef4444', borderRadius: 999 }}
                        >
                            <Text style={{ color: '#fff', fontSize: 16 }}>×</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
};