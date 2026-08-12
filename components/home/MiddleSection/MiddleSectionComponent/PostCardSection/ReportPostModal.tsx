import { useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/Feather';
import {
  ModerationService,
  REPORT_REASONS,
  type ReportReasonCategory,
  type ReportEvidenceDraft,
} from '@/lib/services/ModerationService';
import type { PostItem } from '@/lib/services/PostService';
import CustomModal, { type CustomModalType } from '@/components/ui/CustomModal';

type ReportPostModalProps = {
  visible: boolean;
  post: PostItem;
  onClose: () => void;
};

const moderationService = ModerationService.getInstance();

export default function ReportPostModal({ visible, post, onClose }: ReportPostModalProps) {
  const [category, setCategory] = useState<ReportReasonCategory | null>(null);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<ReportEvidenceDraft[]>([]);
  const [feedback, setFeedback] = useState<{ title: string; message: string; type: CustomModalType } | null>(null);

  const handleClose = () => {
    if (submitting) return;
    setCategory(null);
    setReason('');
    setDescription('');
    setEvidenceFiles([]);
    onClose();
  };

  const handlePickEvidence = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFeedback({ title: 'Permission needed', message: 'Allow photo access to attach report evidence.', type: 'warning' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 3 - evidenceFiles.length),
      quality: 0.85,
    });
    if (result.canceled) return;
    const accepted: ReportEvidenceDraft[] = [];
    const rejected: string[] = [];
    result.assets.slice(0, 3 - evidenceFiles.length).forEach((asset, index) => {
      const fileName = asset.fileName ?? `report-evidence-${Date.now()}-${index}.jpg`;
      if ((asset.fileSize ?? 0) > 10 * 1024 * 1024) rejected.push(`${fileName} exceeds 10 MB.`);
      else accepted.push({ uri: asset.uri, fileName, mimeType: asset.mimeType ?? undefined, fileSize: asset.fileSize });
    });
    setEvidenceFiles((current) => [...current, ...accepted].slice(0, 3));
    if (rejected.length > 0) setFeedback({ title: 'Evidence not added', message: rejected.join('\n'), type: 'warning' });
  };

  const handleSubmit = async () => {
    if (!category || !reason || submitting) return;
    setSubmitting(true);
    try {
      await moderationService.reportPost({
        targetId: post.id,
        reportedUserId: post.userId,
        reasonCategory: category,
        reason,
        description,
        contentUrl: post.media[0]?.typeUrl,
        evidenceFiles,
      });
      setSubmitting(false);
      handleClose();
      setFeedback({ title: 'Report submitted', message: 'Our moderation team will review this post.', type: 'success' });
    } catch (error: unknown) {
      setFeedback({ title: 'Report not submitted', message: error instanceof Error ? error.message : 'Please try again', type: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'left', 'right']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
          {category ? <TouchableOpacity onPress={() => { setCategory(null); setReason(''); }} style={{ padding: 7 }}><Icon name="arrow-left" size={22} color="#374151" /></TouchableOpacity> : null}
          <View style={{ flex: 1, marginLeft: category ? 5 : 0 }}><Text style={{ color: '#111827', fontSize: 18, fontWeight: '800' }}>Report Post</Text><Text style={{ color: '#6b7280', fontSize: 12 }}>Help us keep Ourlime safe</Text></View>
          <TouchableOpacity onPress={handleClose} style={{ padding: 7 }}><Icon name="x" size={22} color="#374151" /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
          <View style={{ padding: 13, borderRadius: 14, backgroundColor: '#f9fafb', marginBottom: 18 }}><Text numberOfLines={3} style={{ color: '#4b5563' }}>{post.caption || post.description || 'Post content'}</Text></View>
          {!category ? (
            <View>
              <Text style={{ marginBottom: 12, color: '#111827', fontWeight: '800' }}>What type of issue is this?</Text>
              {(Object.entries(REPORT_REASONS) as [ReportReasonCategory, (typeof REPORT_REASONS)[ReportReasonCategory]][]).map(([key, group]) => (
                <TouchableOpacity key={key} onPress={() => setCategory(key)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#e5e7eb' }}><Icon name="alert-circle" size={19} color="#c64d53" /><Text style={{ flex: 1, marginLeft: 11, color: '#374151', fontWeight: '700' }}>{group.label}</Text><Icon name="chevron-right" size={19} color="#9ca3af" /></TouchableOpacity>
              ))}
            </View>
          ) : (
            <View>
              <Text style={{ marginBottom: 12, color: '#111827', fontWeight: '800' }}>Why are you reporting this post?</Text>
              {REPORT_REASONS[category].reasons.map((item) => (
                <TouchableOpacity key={item} onPress={() => setReason(item)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 9, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: reason === item ? '#ef4444' : '#e5e7eb', backgroundColor: reason === item ? '#fef2f2' : '#ffffff' }}><View style={{ width: 19, height: 19, borderRadius: 10, borderWidth: 2, borderColor: reason === item ? '#ef4444' : '#d1d5db', alignItems: 'center', justifyContent: 'center' }}>{reason === item ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#ef4444' }} /> : null}</View><Text style={{ flex: 1, marginLeft: 11, color: reason === item ? '#991b1b' : '#374151', fontWeight: '600' }}>{item}</Text></TouchableOpacity>
              ))}
              {reason ? <TextInput value={description} onChangeText={setDescription} multiline maxLength={2000} placeholder="Additional details (optional)" style={{ minHeight: 105, marginTop: 10, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', textAlignVertical: 'top' }} /> : null}
              {reason ? (
                <View style={{ marginTop: 14 }}>
                  <TouchableOpacity onPress={() => void handlePickEvidence()} disabled={evidenceFiles.length >= 3} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: '#c64d53', borderRadius: 14 }}>
                    <Icon name="paperclip" size={18} color="#c64d53" /><Text style={{ marginLeft: 8, color: '#991b1b', fontWeight: '700' }}>Add evidence ({evidenceFiles.length}/3, 10 MB each)</Text>
                  </TouchableOpacity>
                  {evidenceFiles.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>{evidenceFiles.map((file, index) => <View key={`${file.uri}-${index}`} style={{ marginRight: 9 }}><Image source={{ uri: file.uri }} style={{ width: 84, height: 84, borderRadius: 10 }} /><TouchableOpacity onPress={() => setEvidenceFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={{ position: 'absolute', right: 3, top: 3, width: 23, height: 23, borderRadius: 12, backgroundColor: '#111827cc', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={14} color="#ffffff" /></TouchableOpacity></View>)}</ScrollView> : null}
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
        {category ? <View style={{ padding: 15, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}><TouchableOpacity disabled={!reason || submitting} onPress={() => void handleSubmit()} style={{ alignItems: 'center', borderRadius: 17, paddingVertical: 13, backgroundColor: reason ? '#dc2626' : '#d1d5db' }}>{submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={{ color: '#ffffff', fontWeight: '800' }}>Submit Report</Text>}</TouchableOpacity></View> : null}
      </SafeAreaView>
    </Modal>
    <CustomModal visible={feedback !== null} type={feedback?.type} title={feedback?.title ?? ''} message={feedback?.message ?? ''} onClose={() => setFeedback(null)} />
    </>
  );
}
