import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Sparkles } from "lucide-react-native";

type CaptionProps = {
  caption: string;
  onCaptionChange: (value: string) => void;
};

export const Caption = ({ caption, onCaptionChange }: CaptionProps) => {
  const characterCount = caption.length;
  const isNearLimit = characterCount > 400;

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          placeholder="What's on your mind?"
          value={caption}
          onChangeText={onCaptionChange}
          style={[
            styles.input,
            isNearLimit && { borderColor: "#EF4444" },
          ]}
          placeholderTextColor="#9CA3AF"
          multiline
          textAlignVertical="top"
          maxLength={500}
        />
        <View style={styles.iconContainer}>
          <Sparkles size={18} color="#10B981" />
        </View>
      </View>
      <View style={styles.footer}>
        <Text
          style={[
            styles.characterCount,
            isNearLimit && { color: "#EF4444" },
            characterCount === 500 && { fontWeight: "700" },
          ]}
        >
          {characterCount}/500
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 20,
  },
  inputContainer: {
    position: "relative",
  },
  input: {
    width: "100%",
    minHeight: 140,
    padding: 16,
    paddingRight: 48,
    fontSize: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    color: "#111827",
    lineHeight: 24,
  },
  iconContainer: {
    position: "absolute",
    top: 16,
    right: 16,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  characterCount: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
  },
});