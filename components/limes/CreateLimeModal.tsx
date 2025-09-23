import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { X, Upload, Eye, EyeOff, Users, Globe, Sparkles, TrendingUp, Heart, Laugh, Lightbulb, VideoIcon as Video, Youtube, BookOpen, Compass } from 'lucide-react-native';
// import { makeReelService } from '@/lib/home/MiddleSection/Reels/MakeReelService'; // TODO: Setup service later
// import { storage } from '@/lib/firebaseConfig'; // TODO: Setup Firebase later
// import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // TODO: Setup Firebase later
// import { useProfileStore } from '@/src/store/useProfileStore'; // TODO: Setup store later
// import toast from 'react-hot-toast'; // TODO: Setup toast notifications later

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Define available categories with their icons
const categories = [
  { name: 'Following', icon: <Heart size={20} color="#ec4899" /> },
  { name: 'Comedy', icon: <Laugh size={20} color="#f59e0b" /> },
  { name: 'Educational', icon: <Lightbulb size={20} color="#eab308" /> },
  { name: 'DIY', icon: <Video size={20} color="#ef4444" /> },
  { name: 'Music', icon: <Youtube size={20} color="#6366f1" /> },
  { name: 'Explore', icon: <Compass size={20} color="#06b6d4" /> },
];

interface CreateLimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}


export default function CreateLimeModal({ isOpen, onClose, onSuccess }: CreateLimeModalProps) {
  // TODO: Setup user store when available
  // const userId = useProfileStore(state => state.id);
  const userId = 'temp-user-id'; // Temporary placeholder
  
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [selectedCategory, setSelectedCategory] = useState('For You');
  const [selectedFile, setSelectedFile] = useState<any>(null); // Changed from File to any for React Native
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [caption, setCaption] = useState('');
  // const fileInputRef = useRef<HTMLInputElement>(null); // Not needed in React Native
  // const videoRef = useRef<HTMLVideoElement>(null); // Not needed in React Native

  // TODO: Handle escape key for React Native if needed
  // useEffect(() => {
  //   const handleEsc = (e: KeyboardEvent) => {
  //     if (e.key === 'Escape') onClose();
  //   };
  //   
  //   window.addEventListener('keydown', handleEsc);
  //   return () => window.removeEventListener('keydown', handleEsc);
  // }, [onClose]);
  
  // TODO: Handle body scroll prevention for React Native if needed
  // useEffect(() => {
  //   if (isOpen) {
  //     document.body.style.overflow = 'hidden';
  //   } else {
  //     document.body.style.overflow = 'auto';
  //   }
  //   
  //   return () => {
  //     document.body.style.overflow = 'auto';
  //   };
  // }, [isOpen]);

  // TODO: Handle file selection for React Native using image picker
  const handleFileSelect = () => {
    // TODO: Implement React Native image picker
    // This would typically use react-native-image-picker or expo-image-picker
    Alert.alert(
      'Select Video',
      'Choose how you want to select a video',
      [
        { text: 'Camera', onPress: () => console.log('Camera selected') },
        { text: 'Gallery', onPress: () => console.log('Gallery selected') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
    
    // Placeholder implementation
    const mockFile = {
      uri: 'mock-video-uri',
      type: 'video/mp4',
      size: 1024 * 1024, // 1MB
      name: 'mock-video.mp4'
    };
    
    setSelectedFile(mockFile);
    setPreview('mock-video-preview-uri');
    setVideoDuration(30); // Mock 30 second duration
  };

  // Trigger file selection
  const handleUploadClick = () => {
    handleFileSelect();
  };

  // Remove selected file
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreview(null);
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!selectedFile || !userId) {
      Alert.alert('Error', 'Please select a video file');
      return;
    }
    
    try {
      setIsUploading(true);
      
      // Create a simulated progress update
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + 5;
        });
      }, 300);
      
      // TODO: Upload to Firebase Storage when setup
      // const timestamp = Date.now();
      // const uniqueFileName = `${timestamp}_${selectedFile.name}`;
      // const storageRef = ref(storage, `reels/${userId}/${uniqueFileName}`);
      // 
      // const snapshot = await uploadBytes(storageRef, selectedFile, {
      //   contentType: 'video/mp4',
      //   customMetadata: { type: 'reel' }
      // });
      // 
      // const url = await getDownloadURL(snapshot.ref);
      
      // Mock upload delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // TODO: Create reel document when service is available
      // const reelData = {
      //   userId,
      //   type: 'reel',
      //   visibility,
      //   category: selectedCategory,
      //   caption: caption,
      //   media: {
      //     type: 'video',
      //     typeUrl: url,
      //     fileName: uniqueFileName,
      //     duration: videoDuration
      //   }
      // };
      // 
      // const result = await makeReelService.createReel(reelData);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Mock success
      Alert.alert('Success', 'Lime created successfully!');
      setTimeout(() => {
        onSuccess();
        onClose();
        setSelectedFile(null);
        setPreview(null);
        setVisibility('public');
        setSelectedCategory('For You');
        setCaption('');
        setUploadProgress(0);
        setIsUploading(false);
      }, 1000);
      
    } catch (error) {
      console.error('Error creating lime:', error);
      Alert.alert('Error', 'Failed to create lime. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };
  
  // If modal is not open, don't render anything
  if (!isOpen) return null;
  
  return (
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
      }}>
        <View style={{
          backgroundColor: 'white',
          width: '100%',
          maxWidth: screenWidth * 0.95,
          maxHeight: screenHeight * 0.9,
          borderRadius: 16,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 8,
        }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 20,
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb',
          }}>
            <Text style={{
              fontSize: 24,
              fontWeight: '600',
              color: '#1f2937',
            }}>Create a Lime</Text>
            <TouchableOpacity 
              onPress={onClose}
              style={{
                padding: 4,
                borderRadius: 20,
              }}
              disabled={isUploading}
            >
              <X size={24} color="#374151" />
            </TouchableOpacity>
          </View>
            
          {/* Body */}
          <ScrollView style={{
            padding: 20,
            maxHeight: screenHeight * 0.7,
          }} showsVerticalScrollIndicator={false}>
            {/* Visibility selection */}
            <View style={{
              marginBottom: 24,
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '500',
                marginBottom: 8,
                color: '#374151',
              }}>Who can see your lime?</Text>
              <View style={{
                flexDirection: 'row',
                gap: 8,
              }}>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: visibility === 'public' ? '#10b981' : '#f3f4f6',
                  }}
                  onPress={() => setVisibility('public')}
                >
                  <Globe size={16} color={visibility === 'public' ? 'white' : '#374151'} />
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: visibility === 'public' ? 'white' : '#374151',
                  }}>
                    Public
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: visibility === 'friends' ? '#10b981' : '#f3f4f6',
                  }}
                  onPress={() => setVisibility('friends')}
                >
                  <Users size={16} color={visibility === 'friends' ? 'white' : '#374151'} />
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: visibility === 'friends' ? 'white' : '#374151',
                  }}>
                    Friends
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: visibility === 'private' ? '#10b981' : '#f3f4f6',
                  }}
                  onPress={() => setVisibility('private')}
                >
                  <EyeOff size={16} color={visibility === 'private' ? 'white' : '#374151'} />
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: visibility === 'private' ? 'white' : '#374151',
                  }}>
                    Only me
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Category selection */}
            <View style={{
              marginBottom: 24,
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '500',
                marginBottom: 8,
                color: '#374151',
              }}>Category</Text>
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.name}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: 8,
                      minWidth: '30%',
                      flex: 1,
                      backgroundColor: selectedCategory === category.name ? '#10b981' : '#f3f4f6',
                      borderWidth: 1,
                      borderColor: selectedCategory === category.name ? '#10b981' : 'transparent',
                    }}
                    onPress={() => setSelectedCategory(category.name)}
                  >
                    {category.icon}
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '500',
                      color: selectedCategory === category.name ? '#10b981' : '#374151',
                    }}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
                
            {/* Caption input */}
            <View style={{
              marginBottom: 24,
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '500',
                marginBottom: 8,
                color: '#374151',
              }}>Caption (optional)</Text>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Add a caption to your lime..."
                style={{
                  width: '100%',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  borderRadius: 8,
                  fontSize: 16,
                  textAlignVertical: 'top',
                  minHeight: 80,
                }}
                multiline={true}
                maxLength={150}
                textAlignVertical="top"
              />
              <View style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                marginTop: 4,
              }}>
                <Text style={{
                  fontSize: 12,
                  color: '#6b7280',
                }}>{caption.length}/150</Text>
              </View>
            </View>
                
            {/* Video upload area */}
            <View style={{
              marginBottom: 24,
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '500',
                marginBottom: 8,
                color: '#374151',
              }}>Upload your video</Text>
              
              {!preview ? (
                <TouchableOpacity 
                  onPress={handleUploadClick}
                  style={{
                    borderWidth: 2,
                    borderStyle: 'dashed',
                    borderColor: '#d1d5db',
                    borderRadius: 8,
                    padding: 32,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f9fafb',
                  }}
                >
                  <Upload size={32} color="#9ca3af" style={{
                    marginBottom: 8,
                  }} />
                  <Text style={{
                    fontSize: 16,
                    color: '#6b7280',
                    marginBottom: 4,
                  }}>Tap to upload a video</Text>
                  <Text style={{
                    fontSize: 14,
                    color: '#9ca3af',
                  }}>MP4, WebM or other video formats (max 60 seconds)</Text>
                </TouchableOpacity>
              ) : (
                <View style={{
                  position: 'relative',
                  borderRadius: 8,
                  overflow: 'hidden',
                  aspectRatio: 9/16,
                  backgroundColor: 'black',
                }}>
                  <Image
                    source={{ uri: preview }}
                    style={{
                      width: '100%',
                      height: '100%',
                    }}
                    resizeMode="contain"
                  />
                  
                  {!isUploading && (
                    <TouchableOpacity
                      onPress={handleRemoveFile}
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: 20,
                        padding: 4,
                      }}
                    >
                      <X size={20} color="white" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
                
            {/* Upload progress */}
            {isUploading && (
              <View style={{
                marginBottom: 24,
              }}>
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}>
                  <Text style={{
                    fontSize: 14,
                    color: '#6b7280',
                  }}>Uploading...</Text>
                  <Text style={{
                    fontSize: 14,
                    color: '#6b7280',
                  }}>{uploadProgress}%</Text>
                </View>
                <View style={{
                  width: '100%',
                  height: 8,
                  backgroundColor: '#e5e7eb',
                  borderRadius: 4,
                }}>
                  <View 
                    style={{
                      height: '100%',
                      backgroundColor: '#10b981',
                      borderRadius: 4,
                      width: `${uploadProgress}%`,
                    }} 
                  />
                </View>
              </View>
            )}
          </ScrollView>
          
          {/* Footer with submit button */}
          <View style={{
            padding: 20,
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            backgroundColor: '#f9fafb',
            flexDirection: 'row',
            justifyContent: 'flex-end',
          }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                marginRight: 8,
                borderRadius: 8,
              }}
              disabled={isUploading}
            >
              <Text style={{
                fontSize: 16,
                color: '#374151',
              }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              style={{
                paddingHorizontal: 24,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: (!selectedFile || isUploading) ? '#d1d5db' : '#10b981',
              }}
              disabled={!selectedFile || isUploading}
            >
              <Text style={{
                fontSize: 16,
                fontWeight: '500',
                color: 'white',
              }}>
                {isUploading ? 'Uploading...' : 'Create Lime'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
} 