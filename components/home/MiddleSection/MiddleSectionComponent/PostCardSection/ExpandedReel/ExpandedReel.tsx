import React, { useState, useRef, useEffect, LegacyRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  StyleSheet,
  Platform,
  StatusBar,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import Video, { VideoRef } from 'react-native-video';
// import { auth } from '@/lib/firebaseConfig'; // TODO: Setup Firebase later
import { Reel } from '@/types/userTypes';
import CommentSection from './CommentSection/CommentSection';
// import toast from 'react-hot-toast'; // TODO: Setup toast notifications later

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ReelUser {
    firstName: string;
    lastName: string;
    userName: string;
    profileImage?: string;
    emailVerified?: boolean;
}

interface ExpandedReelProps {
    reel: Reel & { user: ReelUser };
    onClose: () => void;
    onCommentClick: (postId: string) => void;
    onDataUpdate?: () => void;
}

interface ActionButtonProps {
    icon: string;
    label?: string;
    onPress?: () => void;
    active?: boolean;
    disabled?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, onPress, active = false, disabled = false }) => (
    <View style={styles.actionButtonContainer}>
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            style={[
                styles.actionButton,
                active && styles.actionButtonActive,
                disabled && styles.actionButtonDisabled
            ]}
        >
            <Icon name={icon} size={28} color={active ? '#ef4444' : '#fff'} />
        </TouchableOpacity>
        {label && <Text style={styles.actionButtonLabel}>{label}</Text>}
    </View>
);

const ExpandedReel = ({ reel, onClose, onCommentClick, onDataUpdate }: ExpandedReelProps) => {
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(true);
    const [isLiked, setIsLiked] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [seekPreview, setSeekPreview] = useState({ time: 0, visible: false });
    const [showIcon, setShowIcon] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [likingInProgress, setLikingInProgress] = useState(false);
    const [localLikeCount, setLocalLikeCount] = useState(reel.likes?.length || 0);
    const [isLoading, setIsLoading] = useState(true);

    const videoRef = useRef<HTMLVideoElement>(null);
    // const currentUserId = auth.currentUser?.uid; // TODO: Get from auth context
    const currentUserId = 'TODO_USER_ID'; // TODO: Replace with actual user id

    // Check if current user has liked this reel
    useEffect(() => {
        if (!currentUserId) {
            setIsLiked(false);
            setLocalLikeCount(0);
            return;
        }
        
        // Handle different possible structures for likes
        let isCurrentUserLiked = false;
        let likeCount = 0;
        
        if (Array.isArray(reel.likes)) {
            isCurrentUserLiked = reel.likes.includes(currentUserId);
            likeCount = reel.likes.length;
        } else if (reel.likes && typeof reel.likes === 'object') {
            isCurrentUserLiked = Object.prototype.hasOwnProperty.call(reel.likes, currentUserId);
            likeCount = Object.keys(reel.likes).length;
        }
        
        setIsLiked(isCurrentUserLiked);
        setLocalLikeCount(likeCount);
    }, [reel.likes, currentUserId]);

    useEffect(() => {
        // TODO: Handle body scroll prevention for React Native if needed
        // if (Platform.OS === 'web') {
        //     document.body.style.overflow = 'hidden';
        //     return () => {
        //         document.body.style.overflow = 'auto';
        //     };
        // }
    }, []);

    const handleVideoPress = () => {
        if (videoRef.current) {
            if (isPlaying) {
                // videoRef.current.pause(); // TODO: Implement pause for react-native-video
            } else {
                // videoRef.current.play(); // TODO: Implement play for react-native-video
            }
            setIsPlaying(!isPlaying);
            setShowIcon(true);
            setTimeout(() => setShowIcon(false), 1500);
        }
    };

    const handleLike = async () => {
        if (!currentUserId) {
            // TODO: Show login error
            console.log('Please log in to like reels');
            return;
        }

        if (likingInProgress) {
            return;
        }

        setLikingInProgress(true);

        // Optimistic update
        const wasLiked = isLiked;
        setIsLiked(!wasLiked);
        setLocalLikeCount(prev => wasLiked ? prev - 1 : prev + 1);

        try {
            // TODO: Implement API call when backend is ready
            // const response = await fetch(`/api/reels/${reel.id}/like`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //     },
            //     body: JSON.stringify({ userId: currentUserId }),
            // });

            // const data = await response.json();

            // if (!response.ok) {
            //     throw new Error(data.message || 'Failed to update like status');
            // }

            // Update based on server response
            // setIsLiked(data.liked);
            
        } catch (error) {
            console.error('Error liking reel:', error);
            // TODO: Show error toast
            console.log('Failed to update like status');
            
            // Revert optimistic update on error
            setIsLiked(wasLiked);
            setLocalLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
        } finally {
            setLikingInProgress(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const VideoProgressBar = () => (
        <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
                <View
                    style={[
                        styles.progressFill,
                        { width: `${(currentTime / duration) * 100}%` }
                    ]}
                />
                <View
                    style={[
                        styles.progressActive,
                        { 
                            width: isDragging
                                ? `${seekPreview.time}%`
                                : `${(currentTime / duration) * 100}%`
                        }
                    ]}
                />
            </View>

            <View style={styles.timeContainer}>
                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                <View style={styles.playbackControls}>
                    <TouchableOpacity
                        onPress={() => {
                            if (videoRef.current) {
                                // TODO: Implement playback rate control for react-native-video
                                const newRate = Math.max(0.5, playbackRate - 0.5);
                                setPlaybackRate(newRate);
                            }
                        }}
                        style={styles.playbackButton}
                    >
                        <Icon name="rewind" size={16} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.playbackRateText}>{playbackRate}x</Text>
                    <TouchableOpacity
                        onPress={() => {
                            if (videoRef.current) {
                                // TODO: Implement playback rate control for react-native-video
                                const newRate = Math.min(2, playbackRate + 0.5);
                                setPlaybackRate(newRate);
                            }
                        }}
                        style={styles.playbackButton}
                    >
                        <Icon name="fast-forward" size={16} color="#fff" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
        </View>
    );

    return (
        <Modal
            visible={true}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.9)" />
            <View style={styles.container}>
                <View style={styles.contentContainer}>
                    <View style={styles.videoContainer}>
                        <TouchableOpacity 
                            style={styles.videoTouchArea}
                            onPress={handleVideoPress}
                            activeOpacity={1}
                        >
                            {reel.media.type === 'video' ? (
                                <Video
                                    ref={videoRef as unknown as LegacyRef<VideoRef>}
                                    source={{ uri: reel.media.typeUrl }}
                                    style={styles.video}
                                    resizeMode="contain"
                                    repeat
                                    muted={isMuted}
                                    paused={!isPlaying}
                                    onLoad={() => setIsLoading(false)}
                                    onError={(error) => {
                                        console.error('Video error:', error);
                                        setIsLoading(false);
                                    }}
                                />
                            ) : (
                                <Image
                                    source={{ uri: reel.media.typeUrl }}
                                    style={styles.video}
                                    resizeMode="contain"
                                    onLoad={() => setIsLoading(false)}
                                    onError={() => {
                                        console.error('Image error');
                                        setIsLoading(false);
                                    }}
                                />
                            )}
                            
                            {isLoading && (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color="#10b981" />
                                </View>
                            )}

                            {reel.media.type === 'video' && (
                                <View style={[
                                    styles.playPauseOverlay,
                                    { opacity: showIcon ? 1 : 0 }
                                ]}>
                                    <Icon 
                                        name={isPlaying ? "pause-circle" : "play-circle"} 
                                        size={64} 
                                        color="rgba(255,255,255,0.8)" 
                                    />
                                </View>
                            )}

                            <View style={styles.gradientOverlay} />
                        </TouchableOpacity>

                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.userInfo}>
                                <View style={styles.avatarContainer}>
                                    <Image
                                        source={{ 
                                            uri: reel.user.profileImage || 'https://ui-avatars.com/api/?name=User'
                                        }}
                                        style={styles.avatar}
                                        resizeMode="cover"
                                    />
                                </View>
                                <View>
                                    <View style={styles.userNameContainer}>
                                        <Text style={styles.userName}>{reel.user.userName}</Text>
                                        {reel.user.emailVerified && (
                                            <Icon name="check-circle" size={16} color="#10b981" />
                                        )}
                                    </View>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={onClose}
                                style={styles.closeButton}
                            >
                                <Icon name="x" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.actionButtonsContainer}>
                            <ActionButton
                                icon="heart"
                                label={localLikeCount.toString()}
                                onPress={handleLike}
                                active={isLiked}
                                disabled={likingInProgress}
                            />
                            <ActionButton
                                icon="message-circle"
                                label={(reel.stats?.comments || 0).toString()}
                                onPress={() => setShowComments(!showComments)}
                            />
                            <ActionButton
                                icon="share"
                                label={(reel.stats?.shares || 0).toString()}
                            />
                            {reel.media.type === 'video' && (
                                <ActionButton
                                    icon={isMuted ? "volume-x" : "volume-2"}
                                    onPress={() => setIsMuted(!isMuted)}
                                />
                            )}
                        </View>

                        {reel.media.type === 'video' && <VideoProgressBar />}
                    </View>

                    {/* Comments Section - Desktop */}
                    {SCREEN_WIDTH > 800 && showComments && (
                        <View style={styles.desktopCommentsContainer}>
                            <CommentSection
                                reelId={reel.id}
                                onClose={() => setShowComments(false)}
                                onCommentAdded={onDataUpdate}
                            />
                        </View>
                    )}
                </View>

                {/* Comments Section - Mobile */}
                {SCREEN_WIDTH <= 800 && showComments && (
                    <Modal
                        visible={showComments}
                        animationType="slide"
                        transparent={true}
                        onRequestClose={() => setShowComments(false)}
                    >
                        <View style={styles.mobileCommentsOverlay}>
                            <View style={styles.mobileCommentsContainer}>
                                <CommentSection
                                    reelId={reel.id}
                                    onClose={() => setShowComments(false)}
                                    onCommentAdded={onDataUpdate}
                                />
                            </View>
                        </View>
                    </Modal>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  contentContainer: {
    flexDirection: SCREEN_WIDTH > 800 ? 'row' : 'column',
    width: '100%',
    maxWidth: SCREEN_WIDTH > 800 ? 1200 : SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH > 800 ? SCREEN_HEIGHT * 0.9 : SCREEN_HEIGHT * 0.8,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  videoTouchArea: {
    flex: 1,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  playPauseOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -32,
    marginTop: -32,
    zIndex: 20,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    // TODO: Add gradient overlay using react-native-linear-gradient
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    zIndex: 30,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  actionButtonsContainer: {
    position: 'absolute',
    right: 16,
    top: '40%',
    zIndex: 30,
    alignItems: 'center',
    gap: 24,
  },
  actionButtonContainer: {
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 12,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  actionButtonActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    zIndex: 30,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 2,
  },
  progressActive: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  playbackButton: {
    padding: 4,
  },
  playbackRateText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  desktopCommentsContainer: {
    width: 400,
    height: '100%',
    backgroundColor: '#fff',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  mobileCommentsOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  mobileCommentsContainer: {
    height: SCREEN_HEIGHT * 0.7,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
});

export default ExpandedReel;