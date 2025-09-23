import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Dimensions,
} from "react-native";
// import { auth } from '@/lib/firebaseConfig';
// import { toast } from 'react-hot-toast';
// import { Moment } from '@/types/momentTypes';
// import { ProfileImage } from '@/types/userTypes';
import Icon from "react-native-vector-icons/Feather";
// import Video from 'react-native-video'; // Uncomment if using react-native-video

const SCREEN_WIDTH = Dimensions.get("window").width;

interface MomentUser {
  userName: string;
  profileImage?: string;
}

interface Moment {
  id: string;
  videoUrl: string;
  user: MomentUser;
  timeRemaining: string;
}

interface MomentsSectionProps {
  profileImage: { imageURL?: string } | null;
}

const MomentsSection: React.FC<MomentsSectionProps> = ({ profileImage }) => {
  const [videoFile, setVideoFile] = useState<any>(null); // TODO: Use react-native-image-picker
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [selectedMoment, setSelectedMoment] = useState<Moment | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  // TODO: Implement video validation for React Native if needed
  const validateVideo = async (file: any): Promise<boolean> => {
    // For now, always return true
    return true;
  };

  const handleVideoSelect = async () => {
    // TODO: Use react-native-image-picker to select video
    // Example: const result = await launchImageLibrary({ mediaType: 'video' });
    // if (result.assets && result.assets.length > 0) { ... }
  };

  const handleUploadMoment = async () => {
    // if (!videoFile || !auth.currentUser) return;
    setIsUploading(true);
    try {
      // TODO: Implement upload logic for React Native
      // Use fetch or axios to upload videoFile
      // Show success/failure feedback
      setVideoFile(null);
      setPreviewUrl(null);
      fetchMoments();
    } catch (error) {
      // TODO: Show error feedback
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  // const fetchMoments = async () => {
  //     setIsLoading(true);
  //     try {
  //         // TODO: Fetch moments from API or local store for React Native
  //         // setMoments([]);
  //     } catch (error) {
  //         // TODO: Show error feedback
  //         console.error(error);
  //     } finally {
  //         setIsLoading(false);
  //     }
  // };

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = direction === "left" ? -320 : 320;
    // TODO: Use scrollTo for ScrollView in React Native
    // scrollRef.current.scrollTo({ x: ... })
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  useEffect(() => {
    fetchMoments();
    // const interval = setInterval(fetchMoments, 60000);
    // return () => clearInterval(interval);
  }, []);

  const fetchMoments = async () => {
    setIsLoading(true);
    try {
      // Dummy data for moments
      const dummyMoments: Moment[] = [
        {
          id: "moment1",
          videoUrl:
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          user: {
            userName: "johndoe",
            profileImage:
              "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
          },
          timeRemaining: "2h left",
        },
        {
          id: "moment2",
          videoUrl:
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
          user: {
            userName: "alicesmith",
            profileImage:
              "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face",
          },
          timeRemaining: "5h left",
        },
        {
          id: "moment3",
          videoUrl:
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          user: {
            userName: "mikej",
            profileImage:
              "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
          },
          timeRemaining: "1d left",
        },
        {
          id: "moment4",
          videoUrl:
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
          user: {
            userName: "sarahw",
            profileImage:
              "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
          },
          timeRemaining: "3h left",
        },
        {
          id: "moment5",
          videoUrl:
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
          user: {
            userName: "davidb",
            profileImage:
              "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face",
          },
          timeRemaining: "6h left",
        },
        {
          id: "moment6",
          videoUrl:
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
          user: {
            userName: "emmad",
            profileImage:
              "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face",
          },
          timeRemaining: "12h left",
        },
        {
          id: "moment7",
          videoUrl:
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
          user: {
            userName: "alexchen",
            profileImage:
              "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face",
          },
          timeRemaining: "4h left",
        },
        {
          id: "moment8",
          videoUrl:
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
          user: {
            userName: "maria_g",
            profileImage:
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face",
          },
          timeRemaining: "8h left",
        },
        {
          id: "moment9",
          videoUrl:
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
          user: {
            userName: "james_w",
            profileImage:
              "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&h=150&fit=crop&crop=face",
          },
          timeRemaining: "1d left",
        },
        {
          id: "moment10",
          videoUrl:
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4",
          user: {
            userName: "lisa_k",
            profileImage:
              "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face",
          },
          timeRemaining: "2d left",
        },
        {
          id: "moment11",
          videoUrl:
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
          user: {
            userName: "tom_r",
            profileImage:
              "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150&h=150&fit=crop&crop=face",
          },
          timeRemaining: "6h left",
        },
        {
          id: "moment12",
          videoUrl:
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
          user: {
            userName: "sophie_m",
            profileImage:
              "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face",
          },
          timeRemaining: "9h left",
        },
      ];

      // Simulate API delay
      setTimeout(() => {
        setMoments(dummyMoments);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error("Error fetching moments:", error);
      setIsLoading(false);
    }
  };

  return (
    <View style={{ 
       marginBottom: 32, 
       marginTop: 32,
    //   backgroundColor: '#fff',
    //   borderRadius: 20,
    //   padding: 20,
    //   shadowColor: '#000',
    //   shadowOffset: {
    //     width: 0,
    //     height: 4,
    //   },
    //   shadowOpacity: 0.08,
    //   shadowRadius: 12,
    //   elevation: 8,
    //   borderWidth: 1,
    //   borderColor: 'rgba(0, 0, 0, 0.05)',
    }}>
      {/* Header Section */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#f0fdf4',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: '#dcfce7',
          }}>
            <Icon name="camera" size={20} color="#10b981" />
          </View>
          <View>
            <Text style={{ 
              fontSize: 20, 
              fontWeight: "700", 
              color: '#111827',
              letterSpacing: -0.5,
            }}>
              Moments
            </Text>
            <Text style={{ 
              fontSize: 14, 
              color: '#6b7280',
              marginTop: 2,
            }}>
              Share your daily moments
            </Text>
          </View>
        </View>
        
        {/* <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={() => handleScroll("left")}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#f8f9fa",
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#e5e7eb',
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 2,
              },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}
            activeOpacity={0.7}
          >
            <Icon name="chevron-left" size={18} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleScroll("right")}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#f8f9fa",
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#e5e7eb',
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 2,
              },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}
            activeOpacity={0.7}
          >
            <Icon name="chevron-right" size={18} color="#374151" />
          </TouchableOpacity>
        </View> */}
      </View>

      {/* Moments ScrollView */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingRight: 16,
        }}
        style={{ marginHorizontal: -4 }}
      >
        {/* Upload Moment Card - Redesigned */}
        <View style={{
          width: 100,
          marginRight: 16,
          alignItems: 'center',
        }}>
          <View style={{
            width: 100,
            aspectRatio: 9 / 16,
            backgroundColor: '#f8f9fa',
            borderRadius: 20,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: '#d1d5db',
            overflow: 'hidden',
            position: 'relative',
            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: 2,
            },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 3,
          }}>
            {!videoFile ? (
              <TouchableOpacity
                onPress={handleVideoSelect}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                }}
                activeOpacity={0.8}
              >
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#10b981',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                  shadowColor: '#10b981',
                  shadowOffset: {
                    width: 0,
                    height: 4,
                  },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}>
                  <Icon name="plus" size={24} color="#fff" />
                </View>
                <Text style={{ 
                  fontSize: 12, 
                  color: '#6b7280', 
                  textAlign: 'center',
                  fontWeight: '600',
                  lineHeight: 16,
                }}>
                  Add{'\n'}Moment
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1, position: 'relative' }}>
                {previewUrl ? (
                  <Image
                    source={{ uri: previewUrl }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : null}
                <TouchableOpacity
                  onPress={handleUploadMoment}
                  disabled={isUploading}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.6)",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 18,
                  }}
                  activeOpacity={0.8}
                >
                  {isUploading ? (
                    <ActivityIndicator size="large" color="#fff" />
                  ) : (
                    <>
                      <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 8,
                      }}>
                        <Icon name="upload" size={20} color="#fff" />
                      </View>
                      <Text style={{ 
                        fontSize: 11, 
                        color: "#fff", 
                        textAlign: 'center',
                        fontWeight: '600',
                      }}>
                        Upload
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Moments List - Redesigned */}
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <View key={index} style={{ width: 100, marginRight: 16, alignItems: 'center' }}>
              <View style={{
                width: 100,
                aspectRatio: 9 / 16,
                backgroundColor: '#f3f4f6',
                borderRadius: 20,
                marginBottom: 8,
              }} />
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#e5e7eb',
                marginBottom: 8,
              }} />
              <View style={{
                width: 60,
                height: 12,
                backgroundColor: '#e5e7eb',
                borderRadius: 6,
              }} />
            </View>
          ))
        ) : (
          moments.map((moment) => (
            <TouchableOpacity
              key={moment.id}
              style={{
                width: 100,
                marginRight: 16,
                alignItems: 'center',
              }}
              activeOpacity={0.9}
              onPress={() => setSelectedMoment(moment)}
            >
              <View style={{
                width: 100,
                aspectRatio: 9 / 16,
                borderRadius: 20,
                overflow: "hidden",
                backgroundColor: "#000",
                position: 'relative',
                shadowColor: '#000',
                shadowOffset: {
                  width: 0,
                  height: 4,
                },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 6,
                borderWidth: 2,
                borderColor: '#fff',
              }}>
                <Image
                  source={{ uri: moment.videoUrl }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
                {/* Gradient Overlay */}
                <View style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 40,
                  //background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                }} />
                {/* Play Icon */}
                <View style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Icon name="play" size={12} color="#fff" />
                </View>
              </View>
              
              {/* User Avatar */}
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                overflow: "hidden",
                borderWidth: 3,
                borderColor: "#fff",
                backgroundColor: "#e5e7eb",
                marginTop: -20,
                marginBottom: 8,
                shadowColor: '#000',
                shadowOffset: {
                  width: 0,
                  height: 2,
                },
                shadowOpacity: 0.15,
                shadowRadius: 6,
                elevation: 4,
              }}>
                {moment.user.profileImage ? (
                  <Image
                    source={{ uri: moment.user.profileImage }}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{
                    width: 40,
                    height: 40,
                    backgroundColor: '#10b981',
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 16, color: '#fff', fontWeight: 'bold' }}>
                      {moment.user.userName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              
              {/* User Info */}
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Text style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: "#111827",
                  textAlign: 'center',
                }}>
                  @{moment.user.userName}
                </Text>
                <View style={{
                  backgroundColor: '#f3f4f6',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                }}>
                  <Text style={{ 
                    fontSize: 10, 
                    color: "#6b7280",
                    fontWeight: '500',
                  }}>
                    {moment.timeRemaining}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Full-screen Moment Viewer - Redesigned */}
      <Modal
        visible={!!selectedMoment}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedMoment(null)}
      >
        <View style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.95)",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <View style={{
            width: SCREEN_WIDTH - 32,
            maxWidth: 400,
            position: "relative",
            borderRadius: 20,
            overflow: 'hidden',
          }}>
            {/* Close Button */}
            <TouchableOpacity
              onPress={() => setSelectedMoment(null)}
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                zIndex: 10,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(0,0,0,0.5)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.7}
            >
              <Icon name="x" size={24} color="#fff" />
            </TouchableOpacity>
            
            {/* Mute Button */}
            <TouchableOpacity
              onPress={toggleMute}
              style={{
                position: "absolute",
                top: 20,
                left: 20,
                zIndex: 10,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(0,0,0,0.5)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.7}
            >
              <Icon
                name={isMuted ? "volume-x" : "volume-2"}
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
            
            {/* Video Content */}
            {selectedMoment && (
              <Image
                source={{ uri: selectedMoment.videoUrl }}
                style={{
                  width: "100%",
                  height: 500,
                  backgroundColor: "#000",
                }}
                resizeMode="cover"
              />
            )}
            
            {/* Bottom Info */}
            {selectedMoment && (
              <View style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: 20,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  overflow: 'hidden',
                  borderWidth: 2,
                  borderColor: '#fff',
                }}>
                  {selectedMoment.user.profileImage ? (
                    <Image
                      source={{ uri: selectedMoment.user.profileImage }}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={{
                      width: 40,
                      height: 40,
                      backgroundColor: '#10b981',
                      borderRadius: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 16, color: '#fff', fontWeight: 'bold' }}>
                        {selectedMoment.user.userName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                    @{selectedMoment.user.userName}
                  </Text>
                  <Text style={{ color: '#d1d5db', fontSize: 14 }}>
                    {selectedMoment.timeRemaining}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default MomentsSection;
