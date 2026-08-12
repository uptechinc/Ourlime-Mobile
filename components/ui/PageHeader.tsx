import {
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import type { PageHeaderProps } from '../../lib/types/componentProps';

/**
 * Universal page header component with back button and centered title
 * @param title - The title text to display in the center
 * @param showBackButton - Whether to show the back button (default: true)
 * @param onBackPress - Callback function when back button is pressed
 * @param backgroundColor - Background color of the header (default: '#f9fafb')
 * @param borderBottomColor - Color of the bottom border (default: '#e5e7eb')
 * @param rightComponent - Optional component to render on the right side
 * @returns PageHeader component
 */
export default function PageHeader({
  title,
  showBackButton = true,
  onBackPress,
  backgroundColor = '#f9fafb',
  borderBottomColor = '#e5e7eb',
  rightComponent,
}: PageHeaderProps) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: Platform.OS === 'ios' ? 8 : 12,
          paddingBottom: 12,
          backgroundColor,
          borderBottomWidth: 1,
          borderBottomColor,
        }}
      >
        {/* Left side - Back button */}
        <View style={{ width: 40 }}>
          {showBackButton && (
            <TouchableOpacity
              onPress={onBackPress}
              style={{
                padding: 8,
              }}
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color="#333" />
            </TouchableOpacity>
          )}
        </View>

        {/* Center - Title */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '600',
              color: '#333',
            }}
          >
            {title}
          </Text>
        </View>

        {/* Right side - Optional component or spacer */}
        <View style={{ width: 40, alignItems: 'flex-end' }}>
          {rightComponent}
        </View>
      </View>
    </SafeAreaView>
  );
}