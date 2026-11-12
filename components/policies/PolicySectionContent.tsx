import { Text, View } from 'react-native';
import { policyDocumentService, type PolicySection } from '@/lib/services/PolicyDocumentService';
import type { AppThemeColors } from '@/lib/contexts/ThemeContext';

type PolicySectionContentProps = { section: PolicySection; colors: AppThemeColors };

/** A policy section's paragraphs and bulleted lists, as the website renders them. */
export default function PolicySectionContent({ section, colors }: PolicySectionContentProps) {
  const blocks = policyDocumentService.toBlocks(section);
  return (
    <View style={{ gap: 10 }}>
      {blocks.map((block, blockIndex) => block.kind === 'paragraph' ? (
        <Text key={`paragraph-${blockIndex}`} selectable style={{ color: colors.secondaryText, fontSize: 15, lineHeight: 23 }}>{block.text}</Text>
      ) : (
        <View key={`list-${blockIndex}`} style={{ gap: 8 }}>
          {block.items.map((itemText, itemIndex) => (
            <View key={`${blockIndex}-${itemIndex}`} style={{ flexDirection: 'row', paddingLeft: 4 }}>
              <View style={{ width: 6, height: 6, marginTop: 9, borderRadius: 3, backgroundColor: '#10b981' }} />
              <Text selectable style={{ flex: 1, marginLeft: 10, color: colors.secondaryText, fontSize: 15, lineHeight: 23 }}>{itemText}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
