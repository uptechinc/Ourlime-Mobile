import { ActivityIndicator, Modal, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BarChart3, CheckSquare, Flag, Plus, Trash2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { CommunityPoll } from '@/lib/types/community';
import type { ResourceState } from '@/lib/types/resourceState';
import CustomModal from '@/components/ui/CustomModal';

type CommunityPollsWorkspaceProps = {
  resource: ResourceState<CommunityPoll[]>;
  canCreate: boolean;
  createRequestKey: number;
  onRetry: () => void;
  onCreate: (question: string, options: string[], durationHours: number, allowMultiple: boolean) => Promise<void>;
  onVote: (pollId: string, optionIndex: number) => Promise<void>;
  onDelete: (poll: CommunityPoll) => void;
  onReport: (poll: CommunityPoll) => void;
};

export default function CommunityPollsWorkspace({ resource, canCreate, createRequestKey, onRetry, onCreate, onVote, onDelete, onReport }: CommunityPollsWorkspaceProps) {
  const { colors } = useAppTheme();
  const [createVisible, setCreateVisible] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [durationHours, setDurationHours] = useState('24');
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (createRequestKey > 0 && canCreate) setCreateVisible(true);
  }, [canCreate, createRequestKey]);

  const handleCreate = async (): Promise<void> => {
    const cleanOptions = options.map((option) => option.trim());
    const duration = Number(durationHours);
    if (!question.trim() || cleanOptions.some((option) => !option) || !Number.isFinite(duration) || duration <= 0) {
      setFeedback('Enter a question, two to five complete options, and a valid duration.');
      return;
    }
    setBusy(true);
    try {
      await onCreate(question.trim(), cleanOptions, duration, allowMultiple);
      setQuestion(''); setOptions(['', '']); setDurationHours('24'); setAllowMultiple(false); setCreateVisible(false);
    } catch (error: unknown) {
      setFeedback(error instanceof Error ? error.message : 'Poll could not be created.');
    } finally { setBusy(false); }
  };

  if (!resource.data && (resource.status === 'hydrating' || resource.status === 'idle')) return <ActivityIndicator color={colors.accent} style={{ marginVertical: 32 }} />;
  if (!resource.data && resource.status === 'error') return <View style={{ padding: 28, alignItems: 'center' }}><Text style={{ color: colors.destructiveText, textAlign: 'center' }}>{resource.error?.message ?? 'Polls could not be loaded.'}</Text><TouchableOpacity onPress={onRetry} style={{ marginTop: 12, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent, fontWeight: '800' }}>Retry</Text></TouchableOpacity></View>;

  return <View style={{ margin: 16 }}><View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}><BarChart3 size={20} color={colors.accent} /><Text style={{ flex: 1, marginLeft: 7, color: colors.text, fontWeight: '900', fontSize: 18 }}>Community polls</Text>{canCreate ? <TouchableOpacity onPress={() => setCreateVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11, backgroundColor: colors.accent }}><Plus size={15} color={colors.onAccent} /><Text style={{ marginLeft: 4, color: colors.onAccent, fontWeight: '900', fontSize: 12 }}>Create</Text></TouchableOpacity> : null}</View>{resource.data?.length ? resource.data.map((poll) => <View key={poll.id} style={{ marginBottom: 13, padding: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}><View style={{ flexDirection: 'row', alignItems: 'flex-start' }}><View style={{ flex: 1 }}><Text style={{ color: colors.mutedText, fontSize: 10, fontWeight: '900' }}>POLL · {poll.isExpired ? 'EXPIRED' : poll.allowMultiple ? 'MULTIPLE CHOICE' : 'ONE CHOICE'}</Text><Text style={{ marginTop: 7, color: colors.text, fontWeight: '900', fontSize: 18 }}>{poll.question}</Text></View><TouchableOpacity onPress={() => onReport(poll)} style={{ padding: 6 }}><Flag size={16} color={colors.icon} /></TouchableOpacity>{poll.permissions.canDelete ? <TouchableOpacity onPress={() => onDelete(poll)} style={{ padding: 6 }}><Trash2 size={16} color={colors.destructive} /></TouchableOpacity> : null}</View><View style={{ marginTop: 14 }}>{poll.options.map((option, optionIndex) => { const percentage = poll.totalVotes ? Math.round(option.voteCount / poll.totalVotes * 100) : 0; return <TouchableOpacity key={option.id} disabled={!poll.permissions.canVote || busy} onPress={() => { setBusy(true); void onVote(poll.id, optionIndex).catch((error: unknown) => setFeedback(error instanceof Error ? error.message : 'Vote could not be saved.')).finally(() => setBusy(false)); }} style={{ minHeight: 52, marginBottom: 9, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: option.selectedByViewer ? colors.accent : colors.border, backgroundColor: colors.control }}><View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${percentage}%`, backgroundColor: option.selectedByViewer ? '#6ee7b7' : colors.disabled }} /><View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 }}><Text style={{ flex: 1, color: colors.text, fontWeight: '800' }}>{option.text}</Text><Text style={{ color: colors.secondaryText, fontWeight: '900' }}>{percentage}%</Text><Text style={{ marginLeft: 6, color: colors.mutedText, fontSize: 11 }}>{option.voteCount}</Text></View></TouchableOpacity>; })}</View><Text style={{ color: colors.mutedText, fontSize: 11 }}>{poll.totalVotes} total votes · ends {new Date(poll.expiresAt).toLocaleString()}</Text></View>) : <View style={{ alignItems: 'center', padding: 30 }}><BarChart3 size={40} color={colors.accent} /><Text style={{ marginTop: 10, color: colors.text, fontWeight: '900' }}>No polls yet</Text><Text style={{ marginTop: 4, color: colors.mutedText }}>Ask the community its first question.</Text></View>}
    <Modal visible={createVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreateVisible(false)}><SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}><View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}><Text style={{ flex: 1, color: colors.text, fontSize: 20, fontWeight: '900' }}>Create poll</Text><TouchableOpacity onPress={() => setCreateVisible(false)}><X size={23} color={colors.icon} /></TouchableOpacity></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingBottom: 45 }}><Text style={{ color: colors.secondaryText, fontWeight: '800', marginBottom: 7 }}>Question</Text><TextInput value={question} onChangeText={setQuestion} maxLength={180} placeholder="What would you like to ask?" placeholderTextColor={colors.mutedText} style={{ padding: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text }} /><Text style={{ color: colors.secondaryText, fontWeight: '800', marginTop: 17, marginBottom: 7 }}>Answer options</Text>{options.map((option, index) => <TextInput key={index} value={option} onChangeText={(value) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} maxLength={80} placeholder={`Option ${index + 1}`} placeholderTextColor={colors.mutedText} style={{ marginBottom: 8, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text }} />)}{options.length < 5 ? <TouchableOpacity onPress={() => setOptions((current) => [...current, ''])} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}><Plus size={16} color={colors.accent} /><Text style={{ marginLeft: 5, color: colors.accentText, fontWeight: '800' }}>Add option</Text></TouchableOpacity> : null}<Text style={{ color: colors.secondaryText, fontWeight: '800', marginTop: 17, marginBottom: 7 }}>Duration in hours</Text><TextInput value={durationHours} onChangeText={setDurationHours} keyboardType="decimal-pad" placeholder="24" placeholderTextColor={colors.mutedText} style={{ padding: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text }} /><View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, padding: 13, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}><CheckSquare size={19} color={colors.accent} /><View style={{ flex: 1, marginLeft: 9 }}><Text style={{ color: colors.text, fontWeight: '800' }}>Allow multiple selections</Text><Text style={{ color: colors.mutedText, fontSize: 11, marginTop: 2 }}>Members can choose more than one answer.</Text></View><Switch value={allowMultiple} onValueChange={setAllowMultiple} /></View><TouchableOpacity disabled={busy} onPress={() => void handleCreate()} style={{ marginTop: 22, minHeight: 49, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>{busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: '900' }}>Create poll</Text>}</TouchableOpacity></ScrollView></SafeAreaView></Modal>
    <CustomModal visible={Boolean(feedback)} title="Community poll" message={feedback ?? ''} type="error" onClose={() => setFeedback(null)} />
  </View>;
}
