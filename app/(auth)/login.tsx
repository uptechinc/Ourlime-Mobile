import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';

// Import the SVG as a React component
import BackgroundSVG from '../../assets/images/login/background.svg';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  return (
      <View className="flex-1 w-full h-full">
        {/* Background SVG */}
        <View className="absolute inset-0">
          <BackgroundSVG width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
        </View>

        {/* Login Form Container */}
        <View className="absolute inset-0 bg-black/40 flex justify-center px-6">
          <View className="w-full max-w-md mx-auto">
            {/* Logo and Title */}
            <View className="flex-row items-center">
              <Text className="text-xl font-bold text-white">Welcome back to</Text>
              <Text className="text-green-400 font-bold ml-1">Ourlime</Text>
            </View>

            <Text className="text-4xl font-bold text-white my-2">Sign back in.</Text>

            {/* Signup Link */}
            <View className="flex-row items-center">
              <Text className="text-md font-bold text-white/80">Don't have an account?</Text>
              <TouchableOpacity onPress={() => router.push('/auth/signup')}>
                <Text className="text-green-400 font-bold ml-2">Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Input Fields with Proper Spacing */}
            <View className="mt-6 space-y-5">
              <TextInput
                  className="w-full rounded-xl border border-white/20 bg-white/10 p-4 text-white placeholder-white/60"
                  placeholder="Email Address"
                  placeholderTextColor="#aaa"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
              />

              <TextInput
                  className="mt-4 w-full rounded-xl border border-white/20 bg-white/10 p-4 text-white placeholder-white/60"
                  placeholder="Password"
                  placeholderTextColor="#aaa"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
              />
            </View>


            {/* Forgot Password */}
            <TouchableOpacity>
              <Text className="text-sm text-white/80 mt-4">Forgot password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity className="mt-6 w-full bg-green-500 p-4 rounded-xl items-center">
              <Text className="text-white font-bold text-lg">Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
  );
}
