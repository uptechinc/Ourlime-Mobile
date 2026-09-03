import { View, Text, Image, StyleSheet } from 'react-native';
import type { ContentBlock } from '@/lib/types/blog';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { Info, AlertTriangle, CheckCircle2, Quote } from 'lucide-react-native';

type RichBlogContentProps = {
  content: string | ContentBlock[];
};

export default function RichBlogContent({ content }: RichBlogContentProps) {
  const { colors, isDark } = useAppTheme();

  if (typeof content === 'string') {
    const paragraphs = content.split('\n\n').filter((p) => p.trim().length > 0);
    return (
      <View style={styles.container}>
        {paragraphs.map((paragraph, index) => (
          <Text key={`p-${index}`} style={[styles.paragraph, { color: colors.text }]}>
            {paragraph.trim()}
          </Text>
        ))}
      </View>
    );
  }

  if (!Array.isArray(content) || content.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.paragraph, { color: colors.mutedText, fontStyle: 'italic' }]}>
          No article body provided.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {content.map((block, index) => {
        switch (block.type) {
          case 'heading': {
            const level = block.level || 2;
            const headingStyle = level === 1 ? styles.h1 : level === 2 ? styles.h2 : level === 3 ? styles.h3 : styles.h4;
            return (
              <Text key={`block-${index}`} style={[headingStyle, { color: colors.text }]}>
                {block.content}
              </Text>
            );
          }

          case 'paragraph':
            return (
              <Text key={`block-${index}`} style={[styles.paragraph, { color: colors.text }]}>
                {block.content}
              </Text>
            );

          case 'image':
            return (
              <View key={`block-${index}`} style={styles.imageBlock}>
                {block.src ? (
                  <Image
                    source={{ uri: block.src }}
                    style={styles.image}
                    resizeMode="cover"
                  />
                ) : null}
                {block.caption ? (
                  <Text style={[styles.caption, { color: colors.mutedText }]}>
                    {block.caption}
                  </Text>
                ) : null}
              </View>
            );

          case 'list': {
            const isOrdered = block.style?.listType === 'ordered';
            return (
              <View key={`block-${index}`} style={styles.listContainer}>
                {block.items?.map((item, itemIdx) => (
                  <View key={`item-${itemIdx}`} style={styles.listItem}>
                    <Text style={[styles.bullet, { color: '#10b981' }]}>
                      {isOrdered ? `${itemIdx + 1}.` : '•'}
                    </Text>
                    <Text style={[styles.listText, { color: colors.text }]}>
                      {item.title ? <Text style={{ fontWeight: '700' }}>{item.title}: </Text> : null}
                      {item.content || ''}
                    </Text>
                  </View>
                ))}
              </View>
            );
          }

          case 'quote':
            return (
              <View key={`block-${index}`} style={[styles.quoteBlock, { backgroundColor: isDark ? '#064e3b22' : '#ecfdf5', borderColor: '#10b981' }]}>
                <Quote size={20} color="#10b981" style={{ marginBottom: 4 }} />
                <Text style={[styles.quoteText, { color: colors.text }]}>
                  "{block.content}"
                </Text>
                {block.author ? (
                  <Text style={[styles.quoteAuthor, { color: colors.mutedText }]}>
                    — {block.author}
                  </Text>
                ) : null}
              </View>
            );

          case 'callout': {
            const calloutType = block.style?.calloutType || 'info';
            const bg = calloutType === 'warning' ? (isDark ? '#78350f33' : '#fffbeb') : calloutType === 'success' ? (isDark ? '#064e3b33' : '#ecfdf5') : (isDark ? '#1e3a8a33' : '#eff6ff');
            const border = calloutType === 'warning' ? '#f59e0b' : calloutType === 'success' ? '#10b981' : '#3b82f6';
            const IconComponent = calloutType === 'warning' ? AlertTriangle : calloutType === 'success' ? CheckCircle2 : Info;
            return (
              <View key={`block-${index}`} style={[styles.calloutBlock, { backgroundColor: bg, borderColor: border }]}>
                <View style={styles.calloutHeader}>
                  <IconComponent size={18} color={border} />
                  {block.title ? (
                    <Text style={[styles.calloutTitle, { color: border }]}>{block.title}</Text>
                  ) : null}
                </View>
                <Text style={[styles.calloutText, { color: colors.text }]}>{block.content}</Text>
              </View>
            );
          }

          case 'conclusion':
            return (
              <View key={`block-${index}`} style={[styles.conclusionBlock, { backgroundColor: colors.surface, borderColor: '#10b981' }]}>
                <Text style={[styles.conclusionTitle, { color: colors.text }]}>Conclusion</Text>
                <Text style={[styles.paragraph, { color: colors.text, marginBottom: 0 }]}>{block.content}</Text>
              </View>
            );

          default:
            return block.content ? (
              <Text key={`block-${index}`} style={[styles.paragraph, { color: colors.text }]}>
                {block.content}
              </Text>
            ) : null;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 16,
    fontWeight: '400',
  },
  h1: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    marginTop: 22,
    marginBottom: 12,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 10,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  h4: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
  },
  imageBlock: {
    marginVertical: 18,
    borderRadius: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 16,
  },
  caption: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 6,
  },
  listContainer: {
    marginVertical: 10,
    paddingLeft: 4,
    gap: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 24,
  },
  listText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
  },
  quoteBlock: {
    borderLeftWidth: 4,
    padding: 16,
    borderRadius: 12,
    marginVertical: 18,
  },
  quoteText: {
    fontSize: 16,
    lineHeight: 24,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  quoteAuthor: {
    fontSize: 13,
    marginTop: 8,
    fontWeight: '600',
  },
  calloutBlock: {
    borderLeftWidth: 4,
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  calloutText: {
    fontSize: 14,
    lineHeight: 22,
  },
  conclusionBlock: {
    borderTopWidth: 3,
    padding: 18,
    borderRadius: 16,
    marginVertical: 20,
  },
  conclusionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
});
