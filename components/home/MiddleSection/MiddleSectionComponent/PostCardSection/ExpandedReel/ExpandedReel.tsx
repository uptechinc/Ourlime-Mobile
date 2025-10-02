import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, Dimensions, ActivityIndicator } from 'react-native';
// import { auth } from '@/lib/firebaseConfig';
//import { Reel } from '@/types/userTypes';
// import toast from 'react-hot-toast';
import Icon from 'react-native-vector-icons/Feather';
import CommentSection from './CommentSection/CommentSection';
import Video from 'react-native-video'; 

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

interface ReelUser {
    firstName: string;
    lastName: string;
    userName: string;
    profileImage?: string;
    emailVerified?: boolean;
}

interface ExpandedReelProps {
  reel: any; // TODO: Replace with actual Reel type
    onClose: () => void;
    onCommentClick: (postId: string) => void;
    onDataUpdate?: () => void;
}

const ExpandedReel = ({ reel, onClose, onCommentClick, onDataUpdate }: ExpandedReelProps) => {
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(true);
    const [isLiked, setIsLiked] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [likingInProgress, setLikingInProgress] = useState(false);
    const [localLikeCount, setLocalLikeCount] = useState(reel.likes?.length || 0);

  // const currentUserId = auth.currentUser?.uid;
  const currentUserId = 'TODO_USER_ID'; // TODO: Replace with actual user id

    useEffect(() => {
    // TODO: Check if current user has liked this reel
            setIsLiked(false);
    setLocalLikeCount(reel.likes?.length || 0);
    }, [reel.likes, currentUserId]);

  const handleLike = async () => {
        if (!currentUserId) {
      // TODO: Show login error
            return;
        }
    if (likingInProgress) return;
        setLikingInProgress(true);
        const wasLiked = isLiked;
        setIsLiked(!wasLiked);
    setLocalLikeCount((prev: number) => wasLiked ? prev - 1 : prev + 1);
    try {
      // TODO: Implement like API call
        } catch (error) {
            setIsLiked(wasLiked);
      setLocalLikeCount((prev: number) => wasLiked ? prev + 1 : prev - 1);
        } finally {
            setLikingInProgress(false);
        }
    };

  return (
    <View style={{
      position: 'absolute',
      left: 0, top: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.9)',
      zIndex: 9999,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    }}>
      <View style={{
        width: SCREEN_WIDTH > 800 ? 800 : SCREEN_WIDTH - 16,
        height: SCREEN_HEIGHT * 0.9,
        backgroundColor: '#000',
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
        flexDirection: 'row',
      }}>
        {/* Video Section */}
        <View style={{ flex: 1, position: 'relative', justifyContent: 'center', alignItems: 'center' }}>
          {/* Video Section: Use react-native-video for playback */}
          <Video
            source={{ uri: reel.media.typeUrl }}
            style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
            resizeMode="contain"
            paused={!isPlaying}
            muted={isMuted}
            repeat
          />
          {/* Play/Pause Overlay */}
          <TouchableOpacity
                    style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginLeft: -40,
              marginTop: -40,
              zIndex: 10,
              opacity: isPlaying ? 0.7 : 1,
            }}
            onPress={() => setIsPlaying(!isPlaying)}
            activeOpacity={0.7}
          >
            <Icon name={isPlaying ? 'pause-circle' : 'play-circle'} size={80} color="#fff" />
          </TouchableOpacity>
          {/* Top Bar */}
          <View style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            zIndex: 20,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
                borderWidth: 2, borderColor: '#fff', marginRight: 8,
              }}>
                {reel.user.profileImage ? (
                  <Image source={{ uri: reel.user.profileImage }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                ) : (
                  <View style={{ width: 40, height: 40, backgroundColor: '#e5e7eb', borderRadius: 20 }} />
                )}
              </View>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                                        {reel.user.userName}
              </Text>
                                        {reel.user.emailVerified && (
                <Icon name="check-circle" size={16} color="#10b981" style={{ marginLeft: 6 }} />
              )}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                padding: 8,
                borderRadius: 9999,
                backgroundColor: 'rgba(0,0,0,0.3)',
                marginLeft: 8,
              }}
            >
              <Icon name="x" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          {/* Action Buttons */}
          <View style={{
            position: 'absolute',
            right: 16,
            top: '40%',
            zIndex: 20,
            alignItems: 'center',
            gap: 24,
          }}>
            <TouchableOpacity onPress={handleLike} disabled={likingInProgress} style={{ alignItems: 'center', marginBottom: 16 }}>
              <Icon name="heart" size={32} color={isLiked ? '#ef4444' : '#fff'} />
              <Text style={{ color: '#fff', marginTop: 4 }}>{localLikeCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowComments(true)} style={{ alignItems: 'center', marginBottom: 16 }}>
              <Icon name="message-circle" size={32} color="#fff" />
              <Text style={{ color: '#fff', marginTop: 4 }}>{reel.stats?.comments || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', marginBottom: 16 }}>
              <Icon name="share" size={32} color="#fff" />
              <Text style={{ color: '#fff', marginTop: 4 }}>{reel.stats?.shares || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsMuted(!isMuted)} style={{ alignItems: 'center' }}>
              <Icon name={isMuted ? 'volume-x' : 'volume-2'} size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        {/* Comment Section (Desktop) */}
        {SCREEN_WIDTH > 800 && showComments && (
          <View style={{
            width: 400,
            height: '100%',
            backgroundColor: '#fff',
            borderTopRightRadius: 20,
            borderBottomRightRadius: 20,
            overflow: 'hidden',
          }}>
                            <CommentSection
                                reelId={reel.id}
                                onClose={() => setShowComments(false)}
                                onCommentAdded={onDataUpdate}
                            />
          </View>
        )}
      </View>
      {/* Comment Section (Mobile) */}
      {SCREEN_WIDTH <= 800 && (
        <Modal
          visible={showComments}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowComments(false)}
        >
          <View style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}>
            <View style={{
              height: SCREEN_HEIGHT * 0.7,
              backgroundColor: '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: 'hidden',
            }}>
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
    );
};

export default ExpandedReel;

