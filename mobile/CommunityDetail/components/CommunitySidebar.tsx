import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Image,
  ScrollView,
  Platform,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { mockMembers, mockCommunityData } from '../data.mock';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const SIDEBAR_WIDTH = screenWidth * 0.88;

interface CommunitySidebarProps {
  isVisible: boolean;
  onClose: () => void;
  onNavigateToProfile?: (userId: string) => void;
  onRemoveUser?: (userId: string) => void;
  onBanUser?: (userId: string) => void;
}

export default function CommunitySidebar({ 
  isVisible, 
  onClose,
  onNavigateToProfile,
  onRemoveUser,
  onBanUser
}: CommunitySidebarProps) {
  const slideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 85,
          friction: 15,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 85,
          friction: 15,
          useNativeDriver: true,
        }),
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 300,
          delay: 50,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SIDEBAR_WIDTH,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(headerOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, slideAnim, overlayOpacity, scaleAnim, headerOpacity]);

  const renderMember = ({ item }: { item: any }) => (
    <Animated.View
      style={{
        opacity: headerOpacity,
        transform: [{
          translateY: headerOpacity.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0],
          })
        }]
      }}
    >
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingVertical: 16,
          marginHorizontal: 16,
          marginVertical: 2,
          borderRadius: 16,
          backgroundColor: '#fff',
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 1,
          },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 2,
        }}
        onPress={() => onNavigateToProfile?.(item.userId)}
        activeOpacity={0.7}
      >
        <Image 
          source={{ uri: item.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face' }} 
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            marginRight: 16,
            borderWidth: 2,
            borderColor: '#e5e7eb',
          }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 16,
            color: '#1a1a1a',
            fontWeight: '600',
            marginBottom: 2,
          }}>
            {item.firstName} {item.lastName}
          </Text>
          <Text style={{
            fontSize: 13,
            color: '#6b7280',
            fontWeight: '400',
          }}>
            @{item.userName}
          </Text>
          <Text style={{
            fontSize: 12,
            color: '#10b981',
            fontWeight: '500',
          }}>
            {item.role}
          </Text>
        </View>
        
        {mockCommunityData.userId === 'current-user-id' && item.userId !== 'current-user-id' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => onRemoveUser?.(item.userId)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: '#fef2f2',
                borderWidth: 1,
                borderColor: '#fecaca',
              }}
            >
              <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '600' }}>
                Remove
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onBanUser?.(item.userId)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: '#fef2f2',
                borderWidth: 1,
                borderColor: '#fecaca',
              }}
            >
              <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '600' }}>
                Ban
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.6)" barStyle="light-content" />
      <View style={{
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
      }}>
        {/* Enhanced Overlay with Blur */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: overlayOpacity,
          }}
        >
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={20}
              tint="dark"
              style={{
                flex: 1,
              }}
            >
              <TouchableOpacity
                style={{
                  flex: 1,
                }}
                onPress={onClose}
                activeOpacity={1}
              />
            </BlurView>
          ) : (
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
              }}
              onPress={onClose}
              activeOpacity={1}
            />
          )}
        </Animated.View>

        {/* Modern Sidebar Container */}
        <Animated.View
          style={{
            width: SIDEBAR_WIDTH,
            height: '100%',
            backgroundColor: '#fafafa',
            shadowColor: '#000',
            shadowOffset: {
              width: -4,
              height: 0,
            },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 20,
            transform: [
              { translateX: slideAnim },
              { scale: scaleAnim }
            ],
          }}
        >
          <SafeAreaView style={{
            flex: 1,
          }}>
            {/* Modern Header with Gradient */}
            <Animated.View
              style={{
                opacity: headerOpacity,
                transform: [{
                  translateY: headerOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  })
                }]
              }}
            >
              <LinearGradient
                colors={['#10b981', '#059669', '#047857']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingHorizontal: 24,
                  paddingVertical: 32,
                  borderBottomLeftRadius: 24,
                  borderBottomRightRadius: 24,
                }}
              >
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 20,
                }}>
                  <TouchableOpacity 
                    onPress={onClose} 
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      justifyContent: 'center',
                      alignItems: 'center',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                  
                  <View style={{
                    flex: 1,
                    alignItems: 'center',
                  }}>
                    <Text style={{
                      fontSize: 20,
                      fontWeight: '700',
                      color: '#fff',
                      marginBottom: 4,
                      textShadowColor: 'rgba(0,0,0,0.1)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 2,
                    }}>
                      {mockCommunityData.title}
                    </Text>
                    <Text style={{
                      fontSize: 14,
                      color: 'rgba(255,255,255,0.9)',
                      fontWeight: '400',
                    }}>
                      {mockMembers.length} Members
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Community Details */}
            <Animated.View
              style={{
                opacity: headerOpacity,
                transform: [{
                  translateY: headerOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  })
                }]
              }}
            >
              <View style={{
                backgroundColor: '#fff',
                margin: 16,
                padding: 20,
                borderRadius: 16,
                shadowColor: '#000',
                shadowOffset: {
                  width: 0,
                  height: 2,
                },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 3,
              }}>
                <Text style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  color: '#1a1a1a',
                  marginBottom: 16,
                }}>
                  Community Details
                </Text>
                <View style={{ gap: 8 }}>
                  <Text style={{
                    fontSize: 14,
                    color: '#6b7280',
                  }}>
                    Created: {new Date(mockCommunityData.createdAt.seconds * 1000).toLocaleDateString()}
                  </Text>
                  <Text style={{
                    fontSize: 14,
                    color: '#6b7280',
                  }}>
                    Status: {mockCommunityData.isPrivate ? 'Private' : 'Public'}
                  </Text>
                  <Text style={{
                    fontSize: 14,
                    color: '#6b7280',
                  }}>
                    Online: 76 Members
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Members List */}
            <ScrollView 
              style={{
                flex: 1,
                paddingTop: 8,
              }} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: 20,
              }}
            >
              <View style={{
                paddingHorizontal: 16,
                marginBottom: 16,
              }}>
                <Text style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  color: '#1a1a1a',
                  marginBottom: 12,
                }}>
                  Members ({mockMembers.length})
                </Text>
              </View>
              <FlatList
                data={mockMembers}
                renderItem={renderMember}
                keyExtractor={(item) => item.userId}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}
