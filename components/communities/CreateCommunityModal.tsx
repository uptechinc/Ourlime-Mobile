import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, InteractionManager, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, CheckSquare, ChevronDown, ImagePlus, RefreshCw, Square, Trash2, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { CommunityService, type CommunityAvailability } from '@/lib/services/CommunityService';
import { communityMediaService } from '@/lib/services/CommunityMediaService';
import type { CommunityCardModel, CommunityCategory, CommunityCreateField, CommunityValidationResult, CreateCommunityInput } from '@/lib/types/community';
import CustomModal from '@/components/ui/CustomModal';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';

type CreateCommunityModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (community: CommunityCardModel) => void;
  categories: CommunityCategory[];
  categoriesLoading?: boolean;
  onRetryCategories?: () => void;
};

const communityService = CommunityService.getInstance();
const slugify = (value: string): string => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export default function CreateCommunityModal({ visible, onClose, onCreated, categories, categoriesLoading = false, onRetryCategories }: CreateCommunityModalProps) {
  const { colors } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const titleInputRef = useRef<TextInput>(null);
  const slugInputRef = useRef<TextInput>(null);
  const fieldOffsets = useRef<Partial<{ [field in CommunityCreateField]: number }>>({});
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [verifiedMembersOnly, setVerifiedMembersOnly] = useState(false);
  const [postingPermission, setPostingPermission] = useState<CreateCommunityInput['postingPermission']>('members');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [selectedBanner, setSelectedBanner] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [availability, setAvailability] = useState<CommunityAvailability | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<CommunityValidationResult>({ valid: true });
  const [categoryExpanded, setCategoryExpanded] = useState(false);
  const [validationScrollTarget, setValidationScrollTarget] = useState(0);
  const [validationScrollGeneration, setValidationScrollGeneration] = useState(0);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [slugTouched, title]);

  useEffect(() => {
    if (!visible || title.trim().length < 3 || slug.length < 3) {
      setAvailability(null);
      return;
    }
    setCheckingAvailability(true);
    const timeout = setTimeout(() => {
      void communityService.checkAvailability(title.trim(), slug).then(setAvailability).catch(() => setAvailability(null)).finally(() => setCheckingAvailability(false));
    }, 450);
    return () => clearTimeout(timeout);
  }, [slug, title, visible]);

  const handlePickBanner = async (): Promise<void> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission is required to select a community banner.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [3, 1], quality: 0.88 });
    if (!result.canceled && result.assets[0]) {
      setSelectedBanner(result.assets[0]);
      setImageUrl('');
    }
  };

  const reset = (): void => {
    setTitle('');
    setSlug('');
    setSlugTouched(false);
    setDescription('');
    setIsPrivate(false);
    setVerifiedMembersOnly(false);
    setPostingPermission('members');
    setCategoryId(null);
    setImageUrl('');
    setSelectedBanner(null);
    setTermsAccepted(false);
    setAvailability(null);
    setUploadProgress(0);
    setValidation({ valid: true });
    setCategoryExpanded(false);
    setValidationScrollTarget(0);
    setValidationScrollGeneration(0);
  };

  const markField = (field: CommunityCreateField) => ({ nativeEvent: { layout: { y } } }: { nativeEvent: { layout: { y: number } } }): void => {
    fieldOffsets.current[field] = y;
  };

  const showValidation = (result: CommunityValidationResult): void => {
    setValidation(result);
    if (result.valid) return;
    if (result.field === 'category') setCategoryExpanded(true);
    const offset = fieldOffsets.current[result.field] ?? 0;
    const targetOffset = result.field === 'title' ? 0 : Math.max(0, offset - 18);

    Keyboard.dismiss();
    setValidationScrollTarget(targetOffset);
    setValidationScrollGeneration((generation) => generation + 1);
    scrollRef.current?.scrollTo({ y: targetOffset, animated: true });

    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        if (result.field === 'title') titleInputRef.current?.focus();
        if (result.field === 'slug' || result.field === 'availability') slugInputRef.current?.focus();
      }, 350);
    });
  };

  const handleClose = (): void => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleCreate = async (): Promise<void> => {
    if (submitting) return;
    const input: CreateCommunityInput = { title: title.trim(), slug, description: description.trim(), isPrivate, verifiedMembersOnly, postingPermission, categoryId, imageUrl: imageUrl.trim() || null, termsAccepted };
    const validationResult = communityService.validateCreateInput(input, availability);
    if (!validationResult.valid) { showValidation(validationResult); return; }
    setValidation({ valid: true });
    setSubmitting(true);
    try {
      const uploadedUrl = selectedBanner ? (await communityMediaService.uploadBanner(selectedBanner, setUploadProgress)).downloadUrl : imageUrl.trim() || null;
      const community = await communityService.createCommunity({ ...input, imageUrl: uploadedUrl });
      onCreated(community);
      reset();
      onClose();
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : 'Community could not be created.');
    } finally {
      setSubmitting(false);
    }
  };

  const availabilityColor = availability?.nameAvailable && availability.slugAvailable ? colors.successText : colors.destructiveText;
  const bannerPreview = selectedBanner?.uri || imageUrl.trim();

  return (
    <>
      <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" presentationStyle="overFullScreen" onRequestClose={handleClose}>
        <SwipeDismissSurface visible={visible} onDismiss={handleClose} handleColor={colors.border} disabled={submitting} accessibilityLabel="Swipe down to close community creation" style={{ flex: 1, backgroundColor: colors.canvas }}>
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}><Text style={{ flex: 1, fontSize: 20, fontWeight: '900', color: colors.text }}>Create community</Text><TouchableOpacity onPress={handleClose} accessibilityLabel="Close create community"><X size={24} color={colors.icon} /></TouchableOpacity></View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView key={`community-form-${validationScrollGeneration}`} ref={scrollRef} contentOffset={{ x: 0, y: validationScrollTarget }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingBottom: 50 }}>
              <View onLayout={markField('title')}><Text style={{ color: colors.secondaryText, fontWeight: '800', marginBottom: 7 }}>Community name</Text>
              <TextInput ref={titleInputRef} autoFocus={!validation.valid && validation.field === 'title'} value={title} onChangeText={(value) => { setTitle(value); setValidation({ valid: true }); }} maxLength={80} placeholder="Give your community a name" placeholderTextColor={colors.mutedText} style={{ backgroundColor: colors.input, borderWidth: 1, borderColor: !validation.valid && validation.field === 'title' ? colors.destructive : colors.border, borderRadius: 14, padding: 13, color: colors.text }} />
              {!validation.valid && validation.field === 'title' ? <Text accessibilityRole="alert" style={{ marginTop: 5, color: colors.destructiveText, fontSize: 12 }}>{validation.message}</Text> : null}</View>
              <Text style={{ alignSelf: 'flex-end', color: colors.mutedText, fontSize: 11, marginTop: 4 }}>{title.length}/80</Text>

              <View onLayout={markField('slug')}><Text style={{ color: colors.secondaryText, fontWeight: '800', marginTop: 12, marginBottom: 7 }}>Community URL</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 12 }}><Text style={{ color: colors.mutedText }}>ourlime.com/communities/</Text><TextInput ref={slugInputRef} autoFocus={!validation.valid && (validation.field === 'slug' || validation.field === 'availability')} value={slug} onChangeText={(value) => { setSlugTouched(true); setSlug(slugify(value)); }} autoCapitalize="none" maxLength={60} style={{ flex: 1, paddingVertical: 13, color: colors.text }} /></View>
              <View onLayout={markField('availability')} style={{ minHeight: 22, flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>{checkingAvailability ? <><ActivityIndicator size="small" color={colors.accent} /><Text style={{ marginLeft: 6, color: colors.mutedText, fontSize: 11 }}>Checking availability…</Text></> : availability ? <><Check size={14} color={availabilityColor} /><Text style={{ marginLeft: 5, color: availabilityColor, fontSize: 11, fontWeight: '700' }}>{availability.nameAvailable && availability.slugAvailable ? 'Name and URL are available' : 'Name or URL is already in use'}</Text></> : null}</View>
              {availability?.suggestions.map((suggestion) => <TouchableOpacity key={suggestion} onPress={() => { setSlugTouched(true); setSlug(suggestion); }}><Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 12, marginTop: 4 }}>Use {suggestion}</Text></TouchableOpacity>)}
              {!validation.valid && (validation.field === 'slug' || validation.field === 'availability') ? <Text accessibilityRole="alert" style={{ marginTop: 5, color: colors.destructiveText, fontSize: 12 }}>{validation.message}</Text> : null}</View>

              <Text style={{ color: colors.secondaryText, fontWeight: '800', marginTop: 15, marginBottom: 7 }}>Description</Text>
              <TextInput value={description} onChangeText={setDescription} maxLength={300} multiline placeholder="What is this community about?" placeholderTextColor={colors.mutedText} style={{ minHeight: 112, textAlignVertical: 'top', backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 13, color: colors.text }} />
              <Text style={{ alignSelf: 'flex-end', color: colors.mutedText, fontSize: 11, marginTop: 4 }}>{description.length}/300</Text>

              <Text style={{ color: colors.secondaryText, fontWeight: '800', marginTop: 15, marginBottom: 8 }}>Banner</Text>
              {bannerPreview ? <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}><CachedImage uri={bannerPreview} recyclingKey={`new-community-banner-${bannerPreview}`} style={{ width: '100%', height: 120 }} contentFit="cover" /><TouchableOpacity onPress={() => { setSelectedBanner(null); setImageUrl(''); }} style={{ position: 'absolute', top: 8, right: 8, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.destructive }}><Trash2 size={17} color="#fff" /></TouchableOpacity></View> : <TouchableOpacity onPress={() => void handlePickBanner()} style={{ height: 112, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}><ImagePlus size={28} color={colors.accent} /><Text style={{ marginTop: 7, color: colors.secondaryText, fontWeight: '800' }}>Pick and crop banner</Text><Text style={{ marginTop: 3, color: colors.mutedText, fontSize: 11 }}>3:1 crop · JPG, PNG, GIF or WebP</Text></TouchableOpacity>}
              {!selectedBanner ? <TextInput value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" keyboardType="url" placeholder="Or paste an image URL" placeholderTextColor={colors.mutedText} style={{ marginTop: 9, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 13, color: colors.text }} /> : null}

              <View onLayout={markField('category')}><Text style={{ color: colors.secondaryText, fontWeight: '800', marginTop: 18, marginBottom: 8 }}>Category</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Select a community category" onPress={() => setCategoryExpanded((expanded) => !expanded)} style={{ minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: !validation.valid && validation.field === 'category' ? colors.destructive : colors.border, backgroundColor: colors.input, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, color: categoryId ? colors.text : colors.mutedText, fontWeight: '800' }}>{categories.find((category) => category.id === categoryId)?.name ?? 'Select a category'}</Text>
                <ChevronDown size={19} color={colors.icon} />
              </TouchableOpacity>
              {categoryExpanded ? categoriesLoading ? <View style={{ minHeight: 62, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.accent} /><Text style={{ marginTop: 5, color: colors.mutedText }}>Loading categories…</Text></View> : categories.length === 0 ? <TouchableOpacity onPress={onRetryCategories} style={{ marginTop: 8, minHeight: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', backgroundColor: colors.control }}><RefreshCw size={17} color={colors.icon} /><Text style={{ marginLeft: 7, color: colors.secondaryText, fontWeight: '800' }}>Categories unavailable · Retry</Text></TouchableOpacity> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 9 }}>{categories.map((category) => <TouchableOpacity key={category.id} onPress={() => { setCategoryId(category.id); setCategoryExpanded(false); setValidation({ valid: true }); }} style={{ marginRight: 7, marginBottom: 7, borderRadius: 999, paddingHorizontal: 11, minHeight: 44, justifyContent: 'center', backgroundColor: categoryId === category.id ? colors.selectedControl : colors.control }}><Text style={{ color: categoryId === category.id ? colors.selectedText : colors.secondaryText, fontSize: 12, fontWeight: '800' }}>{category.name}</Text></TouchableOpacity>)}</View> : null}
              {!validation.valid && validation.field === 'category' ? <Text accessibilityRole="alert" style={{ marginTop: 5, color: colors.destructiveText, fontSize: 12 }}>{validation.message}</Text> : null}</View>

              <View style={{ marginTop: 15, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.text }}>Private community</Text><Text style={{ color: colors.mutedText, marginTop: 3, fontSize: 12 }}>New members must request access.</Text></View><Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ false: colors.disabled, true: '#6ee7b7' }} thumbColor={isPrivate ? colors.accent : colors.surface} /></View>
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.text }}>Verified members only</Text><Text style={{ color: colors.mutedText, marginTop: 3, fontSize: 12 }}>Require Ourlime identity verification before joining.</Text></View><Switch value={verifiedMembersOnly} onValueChange={setVerifiedMembersOnly} trackColor={{ false: colors.disabled, true: '#6ee7b7' }} thumbColor={verifiedMembersOnly ? colors.accent : colors.surface} /></View>
              </View>

              <Text style={{ color: colors.secondaryText, fontWeight: '800', marginTop: 18, marginBottom: 8 }}>Who can post?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>{(['everyone', 'members', 'admins', 'owner'] as const).map((permission) => <TouchableOpacity key={permission} onPress={() => setPostingPermission(permission)} style={{ marginRight: 7, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: postingPermission === permission ? colors.selectedControl : colors.control }}><Text style={{ color: postingPermission === permission ? colors.selectedText : colors.secondaryText, textTransform: 'capitalize', fontWeight: '800', fontSize: 12 }}>{permission}</Text></TouchableOpacity>)}</ScrollView>

              <TouchableOpacity onLayout={markField('terms')} onPress={() => { setTermsAccepted((accepted) => !accepted); setValidation({ valid: true }); }} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 22, padding: 13, borderRadius: 14, borderWidth: !validation.valid && validation.field === 'terms' ? 1 : 0, borderColor: colors.destructive, backgroundColor: colors.warningSurface }}>
                {termsAccepted ? <CheckSquare size={21} color={colors.accent} /> : <Square size={21} color={colors.icon} />}
                <Text style={{ flex: 1, marginLeft: 9, color: colors.warningText, fontSize: 12, lineHeight: 18 }}>I confirm this name and branding do not impersonate another person, organization, or protected identity, and I agree to Ourlime’s community terms.</Text>
              </TouchableOpacity>
              {!validation.valid && validation.field === 'terms' ? <Text accessibilityRole="alert" style={{ marginTop: 5, color: colors.destructiveText, fontSize: 12 }}>{validation.message}</Text> : null}

              {submitting && selectedBanner ? <View style={{ marginTop: 16 }}><Text style={{ color: colors.mutedText, fontSize: 12 }}>Uploading banner · {Math.round(uploadProgress * 100)}%</Text><View style={{ height: 5, marginTop: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.disabled }}><View style={{ width: `${Math.round(uploadProgress * 100)}%`, height: '100%', backgroundColor: colors.accent }} /></View></View> : null}
              <TouchableOpacity disabled={submitting} onPress={() => void handleCreate()} style={{ marginTop: 24, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.accent, opacity: submitting ? 0.5 : 1 }}>{submitting ? <ActivityIndicator color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: '900', fontSize: 16 }}>Create community</Text>}</TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
        </SwipeDismissSurface>
      </Modal>
      <CustomModal visible={Boolean(error)} title="Community not created" message={error ?? ''} type="error" onClose={() => setError(null)} />
    </>
  );
}
