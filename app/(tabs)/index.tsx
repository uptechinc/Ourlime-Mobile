import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from 'expo-router';
import { draftExpiryService } from '@/lib/services/DraftExpiryService';
import { Text, View } from "react-native";
import { FeedSkeleton } from "@/components/ui/Skeleton";
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

  // Drafts expire 7 days after creation: checked here (no Cloud Function) each time the app's feed opens.
  useEffect(() => {
    if (currentUser?.uid) void draftExpiryService.runOnFeedOpen(currentUser.uid);
  }, [currentUser?.uid]);

  // Tapping a draft reminder lands here with ?drafts=post: open the composer on its drafts list.
  const router = useRouter();
  const { drafts: draftsParam } = useLocalSearchParams<{ drafts?: string }>();
  const [openComposerOnDrafts, setOpenComposerOnDrafts] = useState(false);
  useEffect(() => {
    if (draftsParam !== 'post' || !userProfile) return;
    setOpenComposerOnDrafts(true);
    setIsCreatePostModalOpen(true);
    router.setParams({ drafts: undefined });
  }, [draftsParam, router, userProfile]);

  const handleCreatePost = () => {
    if (!postAuthorizationService.canCreatePost(userProfile)) {
      setIsVerificationModalOpen(true);
      return;
    }
    setIsCreatePostModalOpen(true);
  };



  if (!userProfile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top', 'left', 'right']}>
        {profileError ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
            <Text style={{ color: '#991b1b', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>Could not load your profile</Text>
            <Text style={{ marginTop: 8, color: '#7f1d1d', textAlign: 'center' }}>{profileError}</Text>
            <Text style={{ marginTop: 8, color: '#6b7280', fontSize: 12, textAlign: 'center' }}>Check Metro for [Ourlime.Mobile][AuthService] logs.</Text>
          </View>
        ) : (
          <View style={{ flex: 1, padding: 16 }}>
            <FeedSkeleton />
          </View>
        )}
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
          setTogglePostForm={(open) => {
            setIsCreatePostModalOpen(open);
            if (!open) setOpenComposerOnDrafts(false);
          }}
          initialShowDrafts={openComposerOnDrafts}
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
