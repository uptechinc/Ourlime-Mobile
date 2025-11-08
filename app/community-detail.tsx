import React from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import CommunityDetail from '../mobile/CommunityDetail';

export default function CommunityDetailScreen() {
  const handleNavigateToProfile = (userId: string) => {
    console.log('TODO: Navigate to profile:', userId);
    // router.push(`/profile/${userId}`);
  };

  const handleNavigateToCommunities = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <CommunityDetail
        communityId="demo-community-123"
        onNavigateToProfile={handleNavigateToProfile}
        onNavigateToCommunities={handleNavigateToCommunities}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
});

