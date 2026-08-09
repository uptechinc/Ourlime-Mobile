import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { useRouter } from 'expo-router';

type MentionTextProps = {
  content: string;
  style?: StyleProp<TextStyle>;
  mentionStyle?: StyleProp<TextStyle>;
  onMentionPress?: (username: string) => void;
};

export default function MentionText({
  content,
  style,
  mentionStyle,
  onMentionPress,
}: MentionTextProps) {
  const router = useRouter();

  if (!content) return null;

  // Match @username pattern (alphanumeric, underscores, hyphens)
  const regex = /(@[\w.-]+)/g;
  const parts = content.split(regex);

  const handlePress = (token: string) => {
    const username = token.replace(/^@/, '');
    if (onMentionPress) {
      onMentionPress(username);
    } else {
      router.push(`/profile/${username}` as any);
    }
  };

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (part.startsWith('@') && part.length > 1) {
          return (
            <Text
              key={`${part}-${index}`}
              onPress={() => handlePress(part)}
              style={[
                { color: '#059669', fontWeight: '800' },
                mentionStyle,
              ]}
            >
              {part}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}
