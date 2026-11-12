import { TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { PROJECT_COLOR_OPTIONS } from '@/components/projectManagement/projectColors';

type ProjectColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
};

/** Website ProjectColorPicker: eight soft colour swatches, stored as Tailwind classes. */
export default function ProjectColorPicker({ value, onChange, disabled = false }: ProjectColorPickerProps) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {PROJECT_COLOR_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={option.label}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: option.hex, alignItems: 'center', justifyContent: 'center', borderWidth: selected ? 3 : 0, borderColor: colors.surface, opacity: disabled ? 0.6 : 1, elevation: selected ? 3 : 0 }}
          >
            {selected ? <Check size={16} color="#ffffff" strokeWidth={3} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
