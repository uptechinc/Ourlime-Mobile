import { Stack } from 'expo-router';
import "./globals.css";
export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
