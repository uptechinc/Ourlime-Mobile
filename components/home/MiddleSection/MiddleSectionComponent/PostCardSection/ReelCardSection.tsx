import { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  Dimensions, 
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import Video from 'react-native-video';
import { Reel } from '@/types/userTypes';
// import { auth } from '@/lib/firebaseConfig'; // TODO: Setup Firebase later
// import toast from 'react-hot-toast'; // TODO: Setup toast notifications later

const SCREEN_WIDTH = Dimensions.get('window').width;
const isMobile = SCREEN_WIDTH < 768;

type ReelCardProps = {
    reels: Reel[];
    onCommentClick: (postId: string) => void;
    setSelectedReel: (reel: Reel | null) => void;
};

const ReelCardSection = ({ reels, onCommentClick, setSelectedReel }: ReelCardProps) => {
    const hoveredIndex: number | null = null; // hover is web-only; always null on RN
    const [likingReels, setLikingReels] = useState<Set<string>>(new Set());
    
    // const currentUser = auth.currentUser; // TODO: Get from auth context
    const currentUser: { uid: string } | null = null; // TODO: Replace with actual user


    const handleLike = async (reelId: string) => {
        if (!currentUser) {
            // TODO: Show login error
            console.log('Please log in to like reels');
            return;
        }

        // Prevent multiple rapid clicks
        if (likingReels.has(reelId)) {
            return;
        }

        setLikingReels(prev => {
            const newSet = new Set(prev);
            newSet.add(reelId);
            return newSet;
        });

        try {
            // TODO: Implement API call when backend is ready
            // const response = await fetch(`/api/reels/${reelId}/like`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //     },
            //     body: JSON.stringify({ userId: currentUser.uid }),
            // });

            // const data = await response.json();

            // if (!response.ok) {
            //     throw new Error(data.message || 'Failed to update like status');
            // }
            
            console.log('Like functionality - TODO: Implement API call');
            
        } catch (error) {
            console.error('Error liking reel:', error);
            // TODO: Show error toast
            console.log('Failed to update like status');
        } finally {
            setLikingReels(prev => {
                const newSet = new Set(prev);
                newSet.delete(reelId);
                return newSet;
            });
        }
    };

    const handleComment = (reelId: string) => {
        onCommentClick(reelId);
    };

    // Check if current user has liked a reel
    const isReelLiked = (reel: Reel) => {
        if (!currentUser) return false;
        
        const userId = (currentUser as { uid: string }).uid;
        
        // Handle different possible structures for likes
        if (Array.isArray(reel.likes)) {
            return reel.likes.includes(userId);
        }
        
        // If likes is an object with user IDs as keys
        if (reel.likes && typeof reel.likes === 'object') {
            return Object.prototype.hasOwnProperty.call(reel.likes, userId);
        }
        
        // Default to false if likes is not in expected format
        return false;
    };

    // Get like count safely
    const getLikeCount = (reel: Reel) => {
        if (Array.isArray(reel.likes)) {
            return reel.likes.length;
        }
        
        if (reel.likes && typeof reel.likes === 'object') {
            return Object.keys(reel.likes).length;
        }
        
        return reel.stats?.likes || 0;
    };

    if (!reels || reels.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Icon name="film" size={20} color="#10b981" />
                    <Text style={styles.headerTitle}>Limes</Text>
                </View>
                <TouchableOpacity
                    style={styles.createButton}
                    activeOpacity={0.8}
                >
                    <Icon name="plus" size={16} color="#fff" />
                    <Text style={styles.createButtonText}>Create Lime</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.reelsContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    snapToInterval={SCREEN_WIDTH * 0.45}
                    snapToAlignment="start"
                    decelerationRate="fast"
                >
                    {/* Create Lime Card */}
                    <TouchableOpacity
                        style={styles.createLimeCard}
                        activeOpacity={0.8}
                    >
                        <View style={styles.createLimeContent}>
                            <View style={styles.createLimeIcon}>
                                <Icon name="plus" size={24} color="#10b981" />
                            </View>
                            <Text style={styles.createLimeText}>Create a new lime</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Reel Cards */}
                    {reels.map((reel, idx) => (
                        <TouchableOpacity
                            key={reel.id}
                            style={styles.reelCard}
                            onPress={() => setSelectedReel(reel)}
                            activeOpacity={0.9}
                        >
                            <View style={styles.videoContainer}>
                                {reel.media.type === 'video' ? (
                                    <Video
                                        source={{ uri: reel.media.typeUrl }}
                                        style={styles.video}
                                        resizeMode="cover"
                                        muted
                                        repeat
                                        paused={hoveredIndex !== idx}
                                        pointerEvents="none"
                                    />
                                ) : (
                                    <Image
                                        source={{ uri: reel.media.typeUrl }}
                                        style={styles.video}
                                        resizeMode="cover"
                                    />
                                )}
                                
                                {/* Overlay */}
                                <View style={[
                                    styles.overlay,
                                    { opacity: isMobile ? 1 : (hoveredIndex === idx ? 1 : 0) }
                                ]} />

                                {/* User Info */}
                                <View style={[
                                    styles.userInfo,
                                    { 
                                        transform: [{ 
                                            translateY: isMobile ? 0 : (hoveredIndex === idx ? 0 : 100) 
                                        }] 
                                    }
                                ]}>
                                    <View style={styles.userAvatar}>
                                        <Image
                                            source={{ 
                                                uri: reel.user.profileImage || 'https://ui-avatars.com/api/?name=User'
                                            }}
                                            style={styles.avatarImage}
                                            resizeMode="cover"
                                        />
                                    </View>
                                    <View style={styles.userDetails}>
                                        <Text style={styles.userName} numberOfLines={1}>
                                            {reel.user.userName}
                                        </Text>
                                        <Text style={styles.likeCount}>
                                            {getLikeCount(reel)} likes
                                        </Text>
                                    </View>
                                </View>

                                {/* Action Buttons - Desktop Only */}
                                {!isMobile && (
                                    <View style={[
                                        styles.actionButtons,
                                        { 
                                            opacity: hoveredIndex === idx ? 1 : 0,
                                            transform: [{ 
                                                translateX: hoveredIndex === idx ? 0 : 20 
                                            }] 
                                        }
                                    ]}>
                                        <TouchableOpacity
                                            style={[
                                                styles.actionButton,
                                                isReelLiked(reel) && styles.likedButton
                                            ]}
                                            onPress={() => handleLike(reel.id)}
                                            disabled={likingReels.has(reel.id)}
                                        >
                                            <Icon 
                                                name="heart" 
                                                size={16} 
                                                color={isReelLiked(reel) ? "#fff" : "#fff"} 
                                            />
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={() => handleComment(reel.id)}
                                        >
                                            <Icon name="message-circle" size={16} color="#fff" />
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity style={styles.actionButton}>
                                            <Icon name="share" size={16} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Play Button Overlay - Desktop Only */}
                                {!isMobile && (
                                    <View style={[
                                        styles.playButtonContainer,
                                        { 
                                            opacity: hoveredIndex === idx ? 1 : 0,
                                            transform: [{ 
                                                scale: hoveredIndex === idx ? 1 : 0.5 
                                            }] 
                                        }
                                    ]}>
                                        <View style={styles.playButton}>
                                            <Icon name="play" size={20} color="#fff" />
                                        </View>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
  container: {
            width: '100%', 
            gap: 24,
            backgroundColor: '#fff',
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            marginHorizontal: 4,
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: 4,
            },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 8,
            borderWidth: 1,
            borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  header: {
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
    paddingHorizontal: 8,
  },
  headerLeft: {
                    flexDirection: 'row', 
                    alignItems: 'center', 
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  createButton: {
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        gap: 8, 
    paddingHorizontal: 16,
    paddingVertical: 8,
                        backgroundColor: '#10b981', 
                        borderRadius: 25,
                        shadowColor: '#10b981',
                        shadowOffset: {
                            width: 0,
                            height: 2,
                        },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 3,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reelsContainer: {
    position: 'relative',
  },
  scrollContent: {
                    flexDirection: 'row', 
                    gap: 16, 
                    paddingBottom: 16,
                    paddingHorizontal: 4,
  },
  createLimeCard: {
                        width: SCREEN_WIDTH * 0.45,
                        aspectRatio: 9 / 16,
                        borderRadius: 20,
                        borderWidth: 2,
                        borderStyle: 'dashed',
                        borderColor: '#d1d5db',
                        backgroundColor: '#f8f9fa',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 8,
                        shadowColor: '#000',
                        shadowOffset: {
                            width: 0,
                            height: 2,
                        },
                        shadowOpacity: 0.05,
                        shadowRadius: 4,
                        elevation: 2,
  },
  createLimeContent: {
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
  createLimeIcon: {
                        width: 48, 
                        height: 48, 
                        borderRadius: 24, 
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        alignItems: 'center', 
                        justifyContent: 'center', 
  },
  createLimeText: {
    fontSize: 14,
                        color: '#6b7280', 
                        textAlign: 'center',
                        fontWeight: '500',
  },
  reelCard: {
                            width: SCREEN_WIDTH * 0.45,
                            aspectRatio: 9 / 16,
                            borderRadius: 20,
                            overflow: 'hidden',
                            marginRight: 8,
                            shadowColor: '#000',
                            shadowOffset: {
                                width: 0,
                                height: 4,
                            },
                            shadowOpacity: 0.15,
                            shadowRadius: 8,
                            elevation: 6,
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  overlay: {
                            position: 'absolute', 
    top: 0,
                            left: 0, 
                            right: 0, 
                            bottom: 0, 
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  userInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userAvatar: {
                                    width: 32, 
                                    height: 32, 
                                    borderRadius: 16, 
                                    overflow: 'hidden', 
                                    borderWidth: 2, 
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  likeCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  actionButtons: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'column',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
                                alignItems: 'center', 
    justifyContent: 'center',
  },
  likedButton: {
    backgroundColor: '#ef4444',
  },
  playButtonContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
                                        alignItems: 'center', 
    justifyContent: 'center',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.2)',
                                        alignItems: 'center', 
    justifyContent: 'center',
  },
});

export default ReelCardSection;