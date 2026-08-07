import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import UserAvatar from '@/components/ui/UserAvatar';

type CreatePostSectionProps = {
  onCreatePost: () => void;
  profileImageUrl?: string | null;
  userInitial?: string;
};

export const CreatePostSection = ({
  onCreatePost,
  profileImageUrl,
  userInitial = 'U',
}: CreatePostSectionProps) => {
  return (
    <TouchableOpacity
      onPress={onCreatePost}
      activeOpacity={0.85}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Avatar Circle */}
        <View style={{ marginRight: 14, flexShrink: 0 }}>
          <UserAvatar profileImage={profileImageUrl} firstName={userInitial} size={52} />
        </View>

        {/* Input prompt pill */}
        <View style={{ flex: 1 }}>
          <View style={{
            borderWidth: 1,
            borderColor: '#e5e7eb',
            borderRadius: 9999,
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: '#ffffff',
          }}>
            <Text style={{ color: '#6b7280', fontSize: 14, fontWeight: '500' }}>
              Tell us what&apos;s on your mind
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Action Buttons */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 14, paddingLeft: 4 }}>
        <TouchableOpacity onPress={onCreatePost} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="image" size={18} color="#10b981" />
          <Text style={{ color: '#374151', fontSize: 14, fontWeight: '600' }}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCreatePost} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="smile" size={18} color="#f59e0b" />
          <Text style={{ color: '#374151', fontSize: 14, fontWeight: '600' }}>Feeling</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};
