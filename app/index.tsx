// Feeds
import { View, Text, Button } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View>
      <Text>Welcome to Ourlime!</Text>
      <Button title="Login" onPress={() => router.push('/(auth)/login')} />
      <Button title="Sign Up" onPress={() => router.push('/(auth)/signup')} />
      <Button title="eLearning" onPress={() => router.push('/eLearning/page')} />
      <Button title="Communities" onPress={() => router.push('/communities/[id]/page')} />
      <Button title="Community" onPress={() => router.push('/communities/page')} />
      <Button title="Jobs" onPress={() =>router.push('/jobs/page')} />
      <Button title="Events" onPress={() => router.push('/events/page')} />
    </View>
  );
}
