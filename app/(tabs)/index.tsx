import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SplashScreen from 'expo-splash-screen';
import MiddleSection from "@/components/home/MiddleSection";
import AppHeader from "@/components/ui/AppHeader";
import CreatePostModal from "@/components/home/MiddleSection/MiddleSectionComponent/CreatePostModal";
import NotificationsModal from "@/components/home/NotificationsModal";
import { AuthService } from "@/lib/services/AuthService";
import { useProfileResource } from '@/lib/hooks/useProfileResource';
import PostUploadProgressBanner from '@/components/home/PostUploadProgressBanner';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppDrawer } from '@/lib/contexts/AppDrawerContext';
import IdentityVerificationModal from '@/components/jobs/IdentityVerificationModal';
import {
  POST_VERIFICATION_REQUIRED_MESSAGE,
  postAuthorizationService,
} from '@/lib/services/PostAuthorizationService';

const authService = AuthService.getInstance();

export default function FeedsScreen() {
  const { open: openDrawer } = useAppDrawer();
  const { colors } = useAppTheme();
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const currentUser = authService.getCurrentUser();
  const { resource: profileResource } = useProfileResource({ kind: 'own', userId: currentUser?.uid ?? '' });
  const userProfile = profileResource.data?.profile ?? null;
  const profileError = profileResource.error?.message ?? null;

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  const handleCreatePost = () => {
    if (!postAuthorizationService.canCreatePost(userProfile)) {
      setIsVerificationModalOpen(true);
      return;
    }
    setIsCreatePostModalOpen(true);
  };



  if (!userProfile) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }} edges={['top', 'left', 'right']}>
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
        backgroundColor: colors.canvas,
      }}
    >
      <AppHeader
        showLogo={true}
        logoType="both"
        onMenuPress={openDrawer}
        onNotificationPress={() => setIsNotificationsModalOpen(true)}
        profilePictureUrl={userProfile.profilePicture}
      />

      <PostUploadProgressBanner userId={userProfile.uid} />
      <MiddleSection
        userProfile={userProfile}
        onCreatePost={handleCreatePost}
      />

      {isCreatePostModalOpen && (
        <CreatePostModal
          setTogglePostForm={setIsCreatePostModalOpen}
          userProfile={userProfile}
        />
      )}

      <NotificationsModal
        visible={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
      />
      <IdentityVerificationModal
        isOpen={isVerificationModalOpen}
        onClose={() => setIsVerificationModalOpen(false)}
        verificationStatus={userProfile.verificationStatus}
        message={POST_VERIFICATION_REQUIRED_MESSAGE}
      />

    </View>
  );
}
