import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';

type CaptionProps = {
    caption: string;
    onCaptionChange: (value: string) => void;
};

export const Caption = ({ caption, onCaptionChange }: CaptionProps) => {
    return (
        <View style={styles.container}>
            <TextInput
                placeholder="What's on your mind?"
                value={caption}
                onChangeText={onCaptionChange}
                style={styles.input}
                placeholderTextColor="#888"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 16,
    },
    input: {
        width: '100%',
        padding: 16,
        fontSize: 18,
        backgroundColor: '#f9fafb', // gray-50
        borderRadius: 16,
        borderWidth: 0,
    },
});
