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
    </View>
  );
}
