import { useState, useEffect } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MiddleSection from "@/components/home/MiddleSection";
import SlideOutMenu from "@/components/ui/SlideOutMenu";
import { MenuItem } from "../../lib/types/componentProps";
import AppHeader from "@/components/ui/AppHeader";
import CreatePostModal from "@/components/home/MiddleSection/MiddleSectionComponent/CreatePostModal";
import NotificationsModal from "@/components/home/NotificationsModal";
import { AuthService, type UserProfile } from "@/lib/services/AuthService";
import type { PostItem } from "@/lib/services/PostService";
import { DiagnosticLogService } from "@/lib/services/DiagnosticLogService";

const authService = AuthService.getInstance();
const diagnosticLogService = DiagnosticLogService.getInstance();

export default function FeedsScreen() {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [createdPost, setCreatedPost] = useState<PostItem | null>(null);

  useEffect(() => {
    return authService.subscribeToAuthState((currentUser) => {
      if (!currentUser) {
        setUserProfile(null);
        setProfileError('Firebase Auth did not return an authenticated user.');
        diagnosticLogService.warn('FeedsScreen', 'profile:no-auth-user');
        return;
      }
      setProfileError(null);
      diagnosticLogService.info('FeedsScreen', 'profile:start', { uid: currentUser.uid });
      void authService.getUserProfile(currentUser.uid)
        .then((profile) => {
          const resolvedProfile = profile ?? {
            uid: currentUser.uid,
            firstName: currentUser.displayName?.split(' ')[0] || 'Ourlime',
            lastName: currentUser.displayName?.split(' ').slice(1).join(' ') || 'User',
            userName: currentUser.email?.split('@')[0] || 'ourlime_user',
            email: currentUser.email || '',
            accountType: 'regular',
            profilePicture: currentUser.photoURL,
          };
          setUserProfile(resolvedProfile);
          diagnosticLogService.success('FeedsScreen', 'profile', {
            uid: currentUser.uid,
            source: profile ? 'firestore' : 'firebase-auth-fallback',
            hasProfilePicture: Boolean(resolvedProfile.profilePicture),
            firstName: resolvedProfile.firstName,
          });
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unknown profile query error';
          setProfileError(message);
          diagnosticLogService.error('FeedsScreen', 'profile', error, { uid: currentUser.uid });
        });
    });
  }, []);

  const handleCreatePost = () => {
    setIsCreatePostModalOpen(true);
  };

  const handlePostCreated = (post: PostItem) => {
    setCreatedPost(post);
    setIsCreatePostModalOpen(false);
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
      title: "Blogs",
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
      title: "Chat",
      icon: "chatbubbles",
      onPress: () => router.push("/chat/page"),
    },
    {
      id: "divider1",
      title: "",
      icon: "",
      isDivider: true,
    },
    {
      id: "8",
      title: "Settings",
      icon: "settings",
      onPress: () => router.push("/(tabs)/Profile"),
    },
    {
      id: "9",
      title: "Saved Items",
      icon: "bookmark",
      onPress: () => router.push("/(tabs)/Profile"),
    },
    {
      id: "10",
      title: "Profile",
      icon: "person",
      onPress: () => router.push("/(tabs)/Profile"),
    },
    {
      id: "divider2",
      title: "",
      icon: "",
      isDivider: true,
    },
    {
      id: "11",
      title: "Log Out",
      icon: "log-out",
      onPress: async () => {
        await authService.logout();
        router.replace("/(auth)/login");
      },
    },
  ];

  if (!userProfile) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }} edges={['top', 'left', 'right']}>
        {profileError ? (
          <View style={{ paddingHorizontal: 28, alignItems: 'center' }}>
            <Text style={{ color: '#991b1b', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>Could not load your profile</Text>
            <Text style={{ marginTop: 8, color: '#7f1d1d', textAlign: 'center' }}>{profileError}</Text>
            <Text style={{ marginTop: 8, color: '#6b7280', fontSize: 12, textAlign: 'center' }}>Check Metro for [Ourlime.Mobile][AuthService] logs.</Text>
          </View>
        ) : <ActivityIndicator size="large" color="#10b981" />}
      </SafeAreaView>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#F2F2F7",
      }}
    >
      <AppHeader
        showLogo={true}
        logoType="both"
        onMenuPress={handleMenuPress}
        onNotificationPress={() => setIsNotificationsModalOpen(true)}
      />

      <MiddleSection
        userProfile={userProfile}
        createdPost={createdPost}
        onCreatePost={handleCreatePost}
      />

      {isCreatePostModalOpen && (
        <CreatePostModal
          setTogglePostForm={setIsCreatePostModalOpen}
          userProfile={userProfile}
          onCreatePost={handlePostCreated}
        />
      )}

      <NotificationsModal
        visible={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
      />

      <SlideOutMenu
        isVisible={isMenuVisible}
        onClose={handleCloseMenu}
        menuItems={menuItems}
      />
    </View>
  );
}
