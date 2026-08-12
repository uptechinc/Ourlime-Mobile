import { useState } from 'react';
import { ActivityIndicator, Modal, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { CommunityService, type CommunitySummary } from '@/lib/services/CommunityService';
import CustomModal from '@/components/ui/CustomModal';

type CreateCommunityModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (community: CommunitySummary) => void;
};

const communityService = CommunityService.getInstance();

export default function CreateCommunityModal({ visible, onClose, onCreated }: CreateCommunityModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const community = await communityService.createCommunity({ title, description, isPrivate });
      setTitle('');
      setDescription('');
      setIsPrivate(false);
      onCreated(community);
      onClose();
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : 'Community could not be created');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
            <Text style={{ flex: 1, fontSize: 20, fontWeight: '900', color: '#0f172a' }}>Create community</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close create community"><X size={24} color="#475569" /></TouchableOpacity>
          </View>
          <View style={{ padding: 18 }}>
            <Text style={{ color: '#334155', fontWeight: '800', marginBottom: 7 }}>Community name</Text>
            <TextInput value={title} onChangeText={setTitle} maxLength={80} placeholder="Give your community a name" placeholderTextColor="#94a3b8" style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, padding: 13, color: '#0f172a' }} />
            <Text style={{ color: '#334155', fontWeight: '800', marginTop: 18, marginBottom: 7 }}>Description</Text>
            <TextInput value={description} onChangeText={setDescription} maxLength={500} multiline placeholder="What is this community about?" placeholderTextColor="#94a3b8" style={{ minHeight: 120, textAlignVertical: 'top', backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, padding: 13, color: '#0f172a' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, padding: 14, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' }}>
              <View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: '#0f172a' }}>Private community</Text><Text style={{ color: '#64748b', marginTop: 3, fontSize: 12 }}>New members must request access.</Text></View>
              <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ false: '#cbd5e1', true: '#6ee7b7' }} thumbColor={isPrivate ? '#10b981' : '#fff'} />
            </View>
            <TouchableOpacity disabled={submitting || title.trim().length < 3} onPress={() => void handleCreate()} style={{ marginTop: 24, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#10b981', opacity: submitting || title.trim().length < 3 ? 0.5 : 1 }}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Create community</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
      <CustomModal visible={Boolean(error)} title="Community not created" message={error ?? ''} type="error" onClose={() => setError(null)} />
    </>
  );
}
