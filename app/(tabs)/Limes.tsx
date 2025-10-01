import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  RefreshControl,
  StatusBar,
  Platform,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/Feather";
import { BlurView } from "expo-blur";
import Video from "react-native-video";

// Import existing components
import ReelCardSection from "@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/ReelCardSection";
import ExpandedReel from "@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/ExpandedReel/ExpandedReel";
import CreateLimeModal from '@/components/limes/CreateLimeModal';
import CommentModal from '@/components/limes/CommentModal';
import { Reel } from "@/types/userTypes"; // Updated to support both video and image

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Mock data for personal user created limes
const mockPersonalLimes: Reel[] = [
  {
    id: "personal1",
    userId: "current_user_id",
    media: {
      type: "image",
      typeUrl: "https://picsum.photos/400/600?random=100",
      fileName: "my_lime1.jpg",
      duration: 0,
    },
    visibility: "public",
    category: "Personal",
    caption: "My first lime creation! 🎬",
    createdAt: new Date(),
    user: {
      firstName: "You",
      lastName: "User",
      userName: "you",
      profileImage:
        "https://ui-avatars.com/api/?name=You+User&background=10b981&color=fff",
    },
    stats: {
      likes: 15,
      comments: 3,
      shares: 1,
    },
    likes: ["user1", "user2"],
  },
  {
    id: "personal2",
    userId: "current_user_id",
    media: {
      type: "image",
      typeUrl: "https://picsum.photos/400/600?random=101",
      fileName: "my_lime2.jpg",
      duration: 0,
    },
    visibility: "public",
    category: "Personal",
    caption: "Another amazing moment captured! ✨",
    createdAt: new Date(),
    user: {
      firstName: "You",
      lastName: "User",
      userName: "you",
      profileImage:
        "https://ui-avatars.com/api/?name=You+User&background=10b981&color=fff",
    },
    stats: {
      likes: 28,
      comments: 7,
      shares: 2,
    },
    likes: ["user1", "user2", "user3"],
  },
];

// Mock data for demonstration
const mockReels: Reel[] = [
  {
    id: "1",
    userId: "user1",
    media: {
      type: "image",
      typeUrl: "https://picsum.photos/400/600?random=1",
      fileName: "reel1.jpg",
      duration: 0,
    },
    visibility: "public",
    category: "Comedy",
    caption: "Check out this amazing sunset! 🌅",
    createdAt: new Date(),
    user: {
      firstName: "John",
      lastName: "Doe",
      userName: "johndoe",
      profileImage:
        "https://ui-avatars.com/api/?name=John+Doe&background=10b981&color=fff",
    },
    stats: {
      likes: 42,
      comments: 8,
      shares: 3,
    },
    likes: ["user1", "user2", "user3"],
  },
  {
    id: "2",
    userId: "user2",
    media: {
      type: "image",
      typeUrl: "https://picsum.photos/400/600?random=2",
      fileName: "reel2.jpg",
      duration: 0,
    },
    visibility: "public",
    category: "Educational",
    caption: "Learning something new every day! 📚",
    createdAt: new Date(),
    user: {
      firstName: "Jane",
      lastName: "Smith",
      userName: "janesmith",
      profileImage:
        "https://ui-avatars.com/api/?name=Jane+Smith&background=6366f1&color=fff",
    },
    stats: {
      likes: 128,
      comments: 15,
      shares: 7,
    },
    likes: ["user1", "user2", "user3", "user4"],
  },
  {
    id: "3",
    userId: "user3",
    media: {
      type: "image",
      typeUrl: "https://picsum.photos/400/600?random=3",
      fileName: "reel3.jpg",
      duration: 0,
    },
    visibility: "public",
    category: "DIY",
    caption: "Quick DIY project that anyone can do! 🔨",
    createdAt: new Date(),
    user: {
      firstName: "Mike",
      lastName: "Johnson",
      userName: "mikej",
      profileImage:
        "https://ui-avatars.com/api/?name=Mike+Johnson&background=ef4444&color=fff",
    },
    stats: {
      likes: 89,
      comments: 12,
      shares: 5,
    },
    likes: ["user1", "user2"],
  },
  {
    id: "4",
    userId: "user4",
    media: {
      type: "image",
      typeUrl: "https://picsum.photos/400/600?random=4",
      fileName: "reel4.jpg",
      duration: 0,
    },
    visibility: "public",
    category: "Music",
    caption: "Chill vibes and good music 🎵",
    createdAt: new Date(),
    user: {
      firstName: "Sarah",
      lastName: "Wilson",
      userName: "sarahw",
      profileImage:
        "https://ui-avatars.com/api/?name=Sarah+Wilson&background=8b5cf6&color=fff",
    },
    stats: {
      likes: 256,
      comments: 23,
      shares: 12,
    },
    likes: ["user1", "user2", "user3", "user4", "user5"],
  },
  {
    id: "5",
    userId: "user5",
    media: {
      type: "image",
      typeUrl: "https://picsum.photos/400/600?random=5",
      fileName: "reel5.jpg",
      duration: 0,
    },
    visibility: "public",
    category: "Gaming",
    caption: "Epic gaming moment! 🎮",
    createdAt: new Date(),
    user: {
      firstName: "Alex",
      lastName: "Chen",
      userName: "alexc",
      profileImage:
        "https://ui-avatars.com/api/?name=Alex+Chen&background=f59e0b&color=fff",
    },
    stats: {
      likes: 189,
      comments: 18,
      shares: 9,
    },
    likes: ["user1", "user2", "user3"],
  },
  {
    id: "6",
    userId: "user6",
    media: {
      type: "image",
      typeUrl: "https://picsum.photos/400/600?random=6",
      fileName: "reel6.jpg",
      duration: 0,
    },
    visibility: "public",
    category: "Travel",
    caption: "Adventure awaits! ✈️",
    createdAt: new Date(),
    user: {
      firstName: "Emma",
      lastName: "Davis",
      userName: "emmad",
      profileImage:
        "https://ui-avatars.com/api/?name=Emma+Davis&background=06b6d4&color=fff",
    },
    stats: {
      likes: 312,
      comments: 31,
      shares: 15,
    },
    likes: ["user1", "user2", "user3", "user4", "user5", "user6"],
  },
  {
    id: "7",
    userId: "user7",
    media: {
      type: "image",
      typeUrl: "https://picsum.photos/400/600?random=7",
      fileName: "reel7.jpg",
      duration: 0,
    },
    visibility: "public",
    category: "Food",
    caption: "Delicious homemade recipe!",
    createdAt: new Date(),
    user: {
      firstName: "David",
      lastName: "Brown",
      userName: "davidb",
      profileImage:
        "https://ui-avatars.com/api/?name=David+Brown&background=ef4444&color=fff",
    },
    stats: {
      likes: 167,
      comments: 14,
      shares: 6,
    },
    likes: ["user1", "user2", "user3", "user4"],
  },
  {
    id: "8",
    userId: "user8",
    media: {
      type: "image",
      typeUrl: "https://picsum.photos/400/600?random=8",
      fileName: "reel8.jpg",
      duration: 0,
    },
    visibility: "public",
    category: "Art",
    caption: "Creative process in action! 🎨",
    createdAt: new Date(),
    user: {
      firstName: "Lisa",
      lastName: "Garcia",
      userName: "lisag",
      profileImage:
        "https://ui-avatars.com/api/?name=Lisa+Garcia&background=ec4899&color=fff",
    },
    stats: {
      likes: 298,
      comments: 27,
      shares: 11,
    },
    likes: ["user1", "user2", "user3", "user4", "user5", "user6", "user7"],
  },
];

export default function LimesScreen() {
  const [reels, setReels] = useState<Reel[]>(mockReels);
  const [personalLimes, setPersonalLimes] = useState<Reel[]>(mockPersonalLimes);
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);
  const [showTrendingReels, setShowTrendingReels] = useState(false);

  const handleSetSelectedReel = (reel: Reel | null) => {
    setSelectedReel(reel);
  };
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId] = useState("current_user_id"); // TODO: Get from auth context

  // Handle refresh
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // TODO: Implement actual data fetching
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, []);

  // Handle comment click
  const handleCommentClick = (postId: string) => {
    setActivePostId(postId);
    setIsCommentModalOpen(true);
  };

  // Handle close modals
  const handleCloseCommentModal = () => {
    setIsCommentModalOpen(false);
    setActivePostId(null);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const handleCloseExpandedReel = () => {
    setSelectedReel(null);
  };

  // Handle create lime success
  const handleCreateSuccess = () => {
    // TODO: Refresh reels data
    console.log("Lime created successfully!");
  };

  // Handle data update
  const handleDataUpdate = () => {
    // TODO: Refresh reels data
    console.log("Data updated");
  };

  // Handle like
  const handleLike = (reelId: string) => {
    console.log("Liked reel:", reelId);
    // TODO: Implement like functionality
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
      <StatusBar barStyle="light-content" backgroundColor="#ffffff" />

      {/* Custom Header */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          //paddingTop: Platform.OS === "ios" ? 0 : 20,
        }}
      >
        <LinearGradient
          colors={["#ffffff", "#ffffff"]}
          style={{ paddingHorizontal: 20, paddingVertical: 16 }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "rgba(16, 185, 129, 0.5)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Icon name="film" size={24} color="#000000" />
              </View>
              <Text style={{ fontSize: 24, fontWeight: "bold", color: "#000000" }}>
                Limes
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ marginRight: 16 }}>
                <Text
                  style={{ color: "#000000", fontSize: 14, fontWeight: "600" }}
                >
                  {reels.length} Limes
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity
                  onPress={() => setShowTrendingReels(!showTrendingReels)}
                  style={{ marginRight: 16 }}
                >
                  <Icon
                    name={showTrendingReels ? "grid" : "play"}
                    size={20}
                    color="#000000"
                  />
                </TouchableOpacity>
                <Icon
                  name="search"
                  size={20}
                  color="#000000"
                  style={{ marginLeft: 16 }}
                />
                <Icon
                  name="bell"
                  size={20}
                  color="#000000"
                  style={{ marginLeft: 16 }}
                />
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Main Content */}
      {!showTrendingReels && (
        <ScrollView
          style={{ flex: 1, marginTop: 80, marginBottom: 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#10b981"
              colors={["#10b981"]}
            />
          }
        >
          {/* Hero Section */}
          <View
            style={{
              margin: 20,
              borderRadius: 20,
              overflow: "hidden",
              elevation: 8,
              shadowColor: "#10b981",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
            }}
          >
            <LinearGradient
              colors={["#10b981", "#059669", "#047857"]}
              style={{ padding: 24 }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={{ alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: "bold",
                    color: "#fff",
                    textAlign: "center",
                    marginBottom: 8,
                  }}
                >
                  Create Amazing Limes
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    color: "rgba(255, 255, 255, 0.8)",
                    textAlign: "center",
                    marginBottom: 24,
                    lineHeight: 22,
                  }}
                >
                  Share your stories, moments, and creativity with the world
                </Text>

                {/* <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      borderRadius: 25,
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.3)",
                    }}
                    onPress={() => setIsCreateModalOpen(true)}
                    activeOpacity={0.8}
                  >
                    <Icon name="plus" size={20} color="#fff" />
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 16,
                        fontWeight: "600",
                        marginLeft: 8,
                      }}
                    >
                      Create Lime
                    </Text>
                  </TouchableOpacity>
                </View> */}
              </View>
            </LinearGradient>
          </View>

          {/* Personal Limes Section */}
          <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>
                Your Limes
              </Text>
              <TouchableOpacity>
                <Text
                  style={{ color: "#10b981", fontSize: 14, fontWeight: "500" }}
                >
                  See All
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 20 }}
            >
              {/* Create New Lime Card */}
              <TouchableOpacity
                style={{
                  width: 120,
                  height: 160,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderStyle: "dashed",
                  borderColor: "#10b981",
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 16,
                }}
                onPress={() => setIsCreateModalOpen(true)}
                activeOpacity={0.8}
              >
                <View style={{ alignItems: "center" }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: "rgba(16, 185, 129, 0.2)",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 8,
                    }}
                  >
                    <Icon name="plus" size={20} color="#10b981" />
                  </View>
                  <Text
                    style={{
                      color: "#10b981",
                      fontSize: 12,
                      fontWeight: "500",
                      textAlign: "center",
                    }}
                  >
                    Create New Lime
                  </Text>
                </View>
              </TouchableOpacity>
              {personalLimes.map((lime, index) => (
                <TouchableOpacity
                  key={lime.id}
                  style={{ marginRight: 16 }}
                  onPress={() => setSelectedReel(lime)}
                  activeOpacity={0.8}
                >
                  <View
                    style={{
                      width: 120,
                      height: 160,
                      borderRadius: 12,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <Image
                      source={{ uri: lime.media.typeUrl }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />

                    {/* Gradient Overlay */}
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.8)"]}
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 60,
                      }}
                    />

                    {/* Stats */}
                    <View
                      style={{
                        position: "absolute",
                        bottom: 8,
                        left: 8,
                        right: 8,
                        zIndex: 10,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 4,
                        }}
                      >
                        <Icon name="heart" size={12} color="#fff" />
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 10,
                            marginLeft: 4,
                            fontWeight: "600",
                          }}
                        >
                          {lime.stats?.likes || 0}
                        </Text>
                      </View>
                      <Text
                        style={{ color: "#fff", fontSize: 10, lineHeight: 12 }}
                        numberOfLines={2}
                      >
                        {lime.caption}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Categories Section */}
          {/* <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 16 }}>Explore Categories</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 20 }}
            >
              {['For You', 'Following', 'Comedy', 'Educational', 'DIY', 'Music', 'Explore'].map((category, index) => (
                <View key={category} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 12, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                  <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '500' }}>{category}</Text>
                </View>
              ))}
            </ScrollView>
          </View> */}

          {/* Stats Section */}
          {/* <View style={{ marginHorizontal: 16, marginBottom: 24 }}>
            <View
              style={{
                backgroundColor: "#ffffff",
                borderRadius: 18,
                padding: 24,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-around",
                borderWidth: 1,
                borderColor: "#e5e7eb",
                height: 150,
                marginTop: 16,
              }}
            >
              <View style={{ alignItems: "center", flex: 1 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 30,
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <Icon name="film" size={20} color="#10b981" />
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "bold",
                    color: "#10b981",
                    marginBottom: 4,
                  }}
                >
                  {personalLimes.length}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    textAlign: "center",
                    fontWeight: "500",
                  }}
                >
                  Your Limes
                </Text>
              </View>
              <View
                style={{
                  width: 1,
                  height: 60,
                  backgroundColor: "#e5e7eb",
                  marginHorizontal: 16,
                }}
              />
              <View style={{ alignItems: "center", flex: 1 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 30,
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <Icon name="heart" size={20} color="#10b981" />
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "bold",
                    color: "#10b981",
                    marginBottom: 4,
                  }}
                >
                  {personalLimes.reduce(
                    (sum: number, lime: Reel) => sum + (lime.stats?.likes || 0),
                    0
                  )}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    textAlign: "center",
                    fontWeight: "500",
                  }}
                >
                  Your Likes
                </Text>
              </View>
              <View
                style={{
                  width: 1,
                  height: 60,
                  backgroundColor: "#e5e7eb",
                  marginHorizontal: 16,
                }}
              />
              <View style={{ alignItems: "center", flex: 1 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 30,
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <Icon name="message-circle" size={20} color="#10b981" />
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "bold",
                    color: "#10b981",
                    marginBottom: 4,
                  }}
                >
                  {personalLimes.reduce(
                    (sum: number, lime: Reel) => sum + (lime.stats?.comments || 0),
                    0
                  )}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    textAlign: "center",
                    fontWeight: "500",
                  }}
                >
                  Your Comments
                </Text>
              </View>
            </View>
          </View> */}
        </ScrollView>
      )}

      {/* Trending Reels Section - Below Header Vertical Scrolling */}
      {showTrendingReels && (
        <View
          style={{
            flex: 1,
            backgroundColor: "#000000",
            marginTop: 80,
            marginBottom: 80,
          }}
        >
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            snapToInterval={SCREEN_HEIGHT - 160} // Account for both margins
            snapToAlignment="start"
            decelerationRate="fast"
            pagingEnabled
            contentContainerStyle={{ paddingBottom: 0 }}
          >
            {reels.map((reel, index) => (
              <View
                key={reel.id}
                style={{
                  width: SCREEN_WIDTH,
                  height: SCREEN_HEIGHT - 160, // Account for both margins
                  position: "relative",
                  alignSelf: "center",
                  marginBottom: 0,
                  backgroundColor: "#000000",
                }}
              >
                {/* Media Content with proper spacing */}
                <View style={{ 
                  width: SCREEN_WIDTH,
                  height: SCREEN_HEIGHT - 100, // Shrink to create black borders
                  position: "relative",
                  borderRadius: 0,
                  overflow: "hidden",
                  marginTop: 0, // Top black border
                  marginBottom: 0, // Bottom black border
                }}> 
                  {reel.media.type === "video" ? (
                    <Video
                      source={{ uri: reel.media.typeUrl }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                      repeat
                      muted
                      paused={false}
                    />
                  ) : (
                    <Image
                      source={{ uri: reel.media.typeUrl }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  )}

                  {/* Gradient Overlay */}
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.8)"]}
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 200,
                    }}
                  />
                </View>
                
                {/* User Info - Bottom Left */}
                <View
                  style={{
                    position: "absolute",
                    bottom: 100,
                    left: 16,
                    zIndex: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <Image
                      source={{
                        uri:
                          reel.user.profileImage ||
                          "https://ui-avatars.com/api/?name=User",
                      }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        borderWidth: 2,
                        borderColor: "#fff",
                      }}
                    />
                    <View style={{ marginLeft: 12 }}>
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 16,
                          fontWeight: "600",
                        }}
                      >
                        {reel.user.userName}
                      </Text>
                      <Text
                        style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}
                      >
                        Follow
                      </Text>
                    </View>
                  </View>

                  {/* Caption */}
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 14,
                      lineHeight: 20,
                      maxWidth: SCREEN_WIDTH * 0.7,
                    }}
                  >
                    {reel.caption}
                  </Text>
                </View>
                
                {/* Action Buttons - Right Side */}
                <View
                  style={{
                    position: "absolute",
                    right: 16,
                    bottom: 120, // Move up to avoid bottom nav
                    alignItems: "center",
                    zIndex: 10,
                  }}
                >
                  {/* Like Button */}
                  <TouchableOpacity
                    style={{ alignItems: "center", marginBottom: 20 }}
                    onPress={() => handleLike(reel.id)}
                  >
                    <View
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: "rgba(0,0,0,0.3)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="heart" size={24} color="#fff" />
                    </View>
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 12,
                        marginTop: 4,
                        fontWeight: "600",
                      }}
                    >
                      {reel.stats?.likes || 0}
                    </Text>
                  </TouchableOpacity>

                  {/* Comment Button */}
                  <TouchableOpacity
                    style={{ alignItems: "center", marginBottom: 20 }}
                    onPress={() => handleCommentClick(reel.id)}
                  >
                    <View
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: "rgba(0,0,0,0.3)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="message-circle" size={24} color="#fff" />
                    </View>
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 12,
                        marginTop: 4,
                        fontWeight: "600",
                      }}
                    >
                      {reel.stats?.comments || 0}
                    </Text>
                  </TouchableOpacity>

                  {/* Share Button */}
                  <TouchableOpacity
                    style={{ alignItems: "center", marginBottom: 20 }}
                  >
                    <View
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: "rgba(0,0,0,0.3)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="share" size={24} color="#fff" />
                    </View>
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 12,
                        marginTop: 4,
                        fontWeight: "600",
                      }}
                    >
                      {reel.stats?.shares || 0}
                    </Text>
                  </TouchableOpacity>

                  {/* More Options */}
                  <TouchableOpacity style={{ alignItems: "center" }}>
                    <View
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: "rgba(0,0,0,0.3)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="more-vertical" size={24} color="#fff" />
                    </View>
                  </TouchableOpacity>
                </View>
                {/* Music/Title Bar - Bottom */}
                <View
                  style={{
                    position: "absolute",
                    bottom: 20,
                    left: 16,
                    right: 80,
                    zIndex: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: "rgba(16, 185, 129, 0.2)",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 8,
                      }}
                    >
                      <Icon name="music" size={16} color="#10b981" />
                    </View>
                    <Text
                      style={{ color: "#fff", fontSize: 12, flex: 1 }}
                      numberOfLines={1}
                    >
                      Original sound - {reel.user.userName}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Floating Action Button */}
      {/* <View style={{ position: 'absolute', bottom: 30, right: 20, zIndex: 50 }}>
        <TouchableOpacity 
          style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
          onPress={() => setIsCreateModalOpen(true)}
          activeOpacity={0.8}
        >
          <Icon name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View> */}

      {/* Modals */}
      {selectedReel && (
        <ExpandedReel
          reel={selectedReel}
          onClose={handleCloseExpandedReel}
          onCommentClick={handleCommentClick}
          onDataUpdate={handleDataUpdate}
        />
      )}

      <CreateLimeModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSuccess={handleCreateSuccess}
      />
      {/*Have to work on a share modal as well as adjust comment modal*/}
      <CommentModal
        reelId={activePostId || ""}
        isOpen={isCommentModalOpen}
        onClose={handleCloseCommentModal}
      />
    </SafeAreaView>
  );
}
