// Feeds
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 30 }}>Welcome to Ourlime!</Text>

      <TouchableOpacity
        style={{ backgroundColor: '#007AFF', padding: 15, borderRadius: 8, marginBottom: 15, width: 200, alignItems: 'center' }}
        onPress={() => router.push('/(auth)/login')}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Login</Text>
      </TouchableOpacity>

      {/* todo: add signup */}

      <TouchableOpacity
        style={{ backgroundColor: '#34C759', padding: 15, borderRadius: 8, marginBottom: 15, width: 200, alignItems: 'center' }}
        onPress={() => router.push('/eLearning/page')}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>eLearning</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ backgroundColor: '#FF9500', padding: 15, borderRadius: 8, marginBottom: 15, width: 200, alignItems: 'center' }}
        onPress={() => router.push('/communities/[id]/page')}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Communities</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ backgroundColor: '#AF52DE', padding: 15, borderRadius: 8, marginBottom: 15, width: 200, alignItems: 'center' }}
        onPress={() => router.push('/communities/page')}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Community</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ backgroundColor: '#FF3B30', padding: 15, borderRadius: 8, marginBottom: 15, width: 200, alignItems: 'center' }}
        onPress={() => router.push('/jobs/page')}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Jobs</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ backgroundColor: '#5856D6', padding: 15, borderRadius: 8, marginBottom: 15, width: 200, alignItems: 'center' }}
        onPress={() => router.push('/events/page')}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Events</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ backgroundColor: '#5856D6', padding: 15, borderRadius: 8, marginBottom: 15, width: 200, alignItems: 'center' }}
        onPress={() => router.push('/blogs/page')}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Blogs</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ backgroundColor: '#34C759', padding: 15, borderRadius: 8, marginBottom: 15, width: 200, alignItems: 'center' }}
        onPress={() => router.push('/chat/page')}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Chat</Text>
      </TouchableOpacity>
    </View>
  );
}
