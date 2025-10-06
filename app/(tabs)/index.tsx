import React, { useState } from "react";
import { router } from "expo-router";
import { View, StyleSheet } from "react-native";
import MiddleSection from "@/components/home/MiddleSection";
import { Reel } from "@/types/userTypes";
import SlideOutMenu from "@/components/ui/SlideOutMenu";
import { MenuItem } from "../../lib/types/componentProps";
import AppHeader from "@/components/ui/AppHeader";

export default function FeedsScreen() {
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const handleCommentClick = (postId: string) => {
    setActivePostId(postId);
    setIsCommentModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCommentModalOpen(false);
    setActivePostId(null);
  };

  const handleCreatePost = () => {
    // TODO: Implement create post navigation
    console.log("Create post clicked");
  };

  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  const handleCloseMenu = () => {
    setIsMenuVisible(false);
  };

  const menuItems: MenuItem[] = [
    {
      id: "1",
      title: "Communities",
      icon: "people",
      onPress: () => router.push("/communities/page"),
    },
    {
      id: "2",
      title: "Events",
      icon: "calendar",
      onPress: () => router.push("/events/page"),
    },
    {
      id: "3",
      title: "Jobs",
      icon: "briefcase",
      onPress: () => router.push("/jobs/page"),
    },
    {
      id: "4",
      title: "Market",
      icon: "storefront",
      onPress: () => router.push("/market/page"),
    },
    {
      id: "5",
      title: "Blogs",//blogs page
      icon: "book",
      onPress: () => router.push("/blogs/page"),
    },
    {
      id: "6",
      title: "E-Learning",
      icon: "school",
      onPress: () => router.push("/eLearning/page"),
    },
    {
      id: "7",
      title: "Community Detail Demo",
      icon: "people-circle",
      onPress: () => router.push("/community-detail"),
    },
    {
      id: "8",
      title: "Chat", 
      icon: "chatbubbles",
      onPress: () => router.push("/chat/page"),

    },
    {
      id: "9",
      title: "Blogs", //Redo blogs (id: 5)
      icon: "book",
      onPress: () => router.push("/blogs/[id]/page"),
    },
    {
      id: "divider1",
      title: "",
      icon: "",
      isDivider: true,
    },
    // {
    //   id: "7",
    //   title: "Notifications",
    //   icon: "notifications",
    //   onPress: () => console.log("Notifications pressed"),
    // },
    // {
    //   id: "8",
    //   title: "Messages",
    //   icon: "chatbubbles",
    //   onPress: () => console.log("Messages pressed"),
    // },
    {
      id: "9",
      title: "Profile",
      icon: "person",
      onPress: () => router.push("/(tabs)/Profile"),
    },
  ];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#F2F2F7",
      }}
    >
      <AppHeader title="OurLime" onMenuPress={handleMenuPress} />

      <MiddleSection
        onCommentClick={handleCommentClick}
        isCommentModalOpen={isCommentModalOpen}
        activePostId={activePostId}
        currentUserId="TODO_USER_ID" // TODO: Get from auth context
        onCloseModal={handleCloseModal}
        onCreatePost={handleCreatePost}
        setSelectedReel={setSelectedReel}
      />

      <SlideOutMenu
        isVisible={isMenuVisible}
        onClose={handleCloseMenu}
        menuItems={menuItems}
      />
    </View>
  );
}
