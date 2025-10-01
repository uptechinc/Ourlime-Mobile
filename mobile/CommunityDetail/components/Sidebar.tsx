import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  FlatList,
} from 'react-native';
import { styles } from '../styles';
import { mockMembers, mockCommunityData } from '../data.mock';

interface SidebarProps {
  onNavigateToProfile?: (userId: string) => void;
  onRemoveUser?: (userId: string) => void;
  onBanUser?: (userId: string) => void;
}

export default function Sidebar({ 
  onNavigateToProfile,
  onRemoveUser,
  onBanUser 
}: SidebarProps) {
  const renderMember = ({ item }: { item: any }) => (
    <View style={styles.sidebarMemberItem}>
      <Pressable 
        onPress={() => onNavigateToProfile?.(item.userId)}
        style={styles.sidebarMemberPressable}
      >
        <Image 
          source={{ uri: item.profileImage || '/images/avatar.jpg' }} 
          style={styles.sidebarMemberAvatar}
        />
        <View style={styles.sidebarMemberInfo}>
          <Text style={styles.sidebarMemberName}>
            {item.firstName} {item.lastName}
          </Text>
          <Text style={styles.sidebarMemberUsername}>@{item.userName}</Text>
          <Text style={styles.sidebarMemberRole}>{item.role}</Text>
        </View>
      </Pressable>
      
      {mockCommunityData.userId === 'current-user-id' && item.userId !== 'current-user-id' && (
        <View style={styles.sidebarMemberActions}>
          <Pressable 
            onPress={() => onRemoveUser?.(item.userId)}
            style={styles.sidebarMemberActionButton}
          >
            <Text style={styles.sidebarRemoveButtonText}>Remove</Text>
          </Pressable>
          <Pressable 
            onPress={() => onBanUser?.(item.userId)}
            style={styles.sidebarMemberActionButton}
          >
            <Text style={styles.sidebarBanButtonText}>Ban</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.sidebar}>
      {/* Community Details */}
      <View style={styles.sidebarSection}>
        <Text style={styles.sidebarSectionTitle}>Details</Text>
        <View style={styles.sidebarDetails}>
          <Text style={styles.sidebarDetailText}>
            Created: {new Date(mockCommunityData.createdAt.seconds * 1000).toLocaleDateString()}
          </Text>
          <Text style={styles.sidebarDetailText}>
            Status: {mockCommunityData.isPrivate ? 'Private' : 'Public'}
          </Text>
          <Text style={styles.sidebarDetailText}>
            Members: {mockMembers.length}
          </Text>
          <Text style={styles.sidebarDetailText}>
            Online: 76 Members
          </Text>
        </View>
      </View>

      {/* Members List */}
      <View style={styles.sidebarSection}>
        <Text style={styles.sidebarSectionTitle}>Members ({mockMembers.length})</Text>
        <FlatList
          data={mockMembers}
          renderItem={renderMember}
          keyExtractor={(item) => item.userId}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          style={styles.sidebarMembersList}
        />
      </View>

      {/* Friends in Community */}
      <View style={styles.sidebarSection}>
        <Text style={styles.sidebarSectionTitle}>Your Friends Here</Text>
        <View style={styles.sidebarFriendsPlaceholder}>
          <Text style={styles.sidebarPlaceholderText}>
            Alex Thompson, Jessica Brown
          </Text>
        </View>
      </View>
    </View>
  );
}
