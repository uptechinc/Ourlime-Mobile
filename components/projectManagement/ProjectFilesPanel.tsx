import { useMemo, useState } from 'react';
import { Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { File, FileArchive, FileImage, FileText, FolderOpen, Search, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { EmptyPanel, PanelHeader, PremiumNotice } from '@/components/projectManagement/ProjectPanelParts';
import { formatFileSize } from '@/components/projectManagement/projectFormat';
import { projectEntitlementService } from '@/lib/services/ProjectEntitlementService';
import type { ProjectRecord, Task, TeamMember } from '@/lib/types/project';

type ProjectFilesPanelProps = {
  project: ProjectRecord;
  tasks: Task[];
  teamMembers: TeamMember[];
  onOpenUpgrade: () => void;
  onSelectTask: (task: Task) => void;
};

type FileFilter = 'all' | 'image' | 'document' | 'archive' | 'other';
const FILTERS: { value: FileFilter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'image', label: 'Images' }, { value: 'document', label: 'Docs' }, { value: 'archive', label: 'Archives' }, { value: 'other', label: 'Other' },
];

function matchesFilter(type: string, filter: FileFilter): boolean {
  if (filter === 'image') return type.startsWith('image/');
  if (filter === 'document') return type.includes('pdf') || type.includes('word') || type.includes('document') || type.includes('text');
  if (filter === 'archive') return type.includes('zip') || type.includes('rar') || type.includes('tar');
  if (filter === 'other') return !type.startsWith('image/') && !type.includes('pdf') && !type.includes('zip');
  return true;
}

export function FileTypeIcon({ type, size = 20 }: { type: string; size?: number }) {
  if (type.startsWith('image/')) return <FileImage size={size} color="#3b82f6" />;
  if (type.includes('pdf') || type.includes('text')) return <FileText size={size} color="#ef4444" />;
  if (type.includes('zip') || type.includes('tar') || type.includes('rar')) return <FileArchive size={size} color="#f59e0b" />;
  return <File size={size} color="#64748b" />;
}

export async function openAttachment(url: string): Promise<void> {
  try { await Linking.openURL(url); } catch { toast.error('This file could not be opened.'); }
}

/** Website ProjectFilesTab: every task attachment in one vault, with storage used, search and type filters. */
export default function ProjectFilesPanel({ project, tasks, teamMembers, onOpenUpgrade, onSelectTask }: ProjectFilesPanelProps) {
  const { colors } = useAppTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FileFilter>('all');
  const isPremium = projectEntitlementService.isPremium(project);

  const files = useMemo(() => {
    const names = new Map(teamMembers.map((member) => [member.id, member.name]));
    return tasks.flatMap((task) => task.attachments.map((attachment) => ({ ...attachment, task, uploadedByName: names.get(attachment.uploadedBy) || 'Team Member' })));
  }, [tasks, teamMembers]);
  const visibleFiles = files.filter((file) => {
    const term = search.trim().toLowerCase();
    return (!term || file.name.toLowerCase().includes(term) || file.task.title.toLowerCase().includes(term)) && matchesFilter(file.type || '', filter);
  });
  const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
  const maxBytes = projectEntitlementService.getLimits(project).maxFileUploadBytes;
  const percent = Math.min(100, Math.round((totalBytes / maxBytes) * 100));

  return (
    <View style={{ gap: 12 }}>
      <PanelHeader
        icon={<FolderOpen size={18} color={colors.accent} />}
        title="Project File Vault"
        description={`${files.length} project file${files.length !== 1 ? 's' : ''} stored across tasks`}
        action={(
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.secondaryText, fontSize: 12 }}>Storage Used</Text>
              <Text style={{ color: colors.secondaryText, fontSize: 12, fontWeight: '700' }}>{formatFileSize(totalBytes)} / {formatFileSize(maxBytes)}</Text>
            </View>
            <View style={{ height: 7, borderRadius: 999, backgroundColor: colors.control, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${percent}%`, backgroundColor: percent > 85 ? '#ef4444' : percent > 60 ? '#f59e0b' : '#10b981' }} />
            </View>
          </View>
        )}
      />
      {!isPremium ? <PremiumNotice title="Free plan storage:" message="10 MB per file. Upgrade to Premium for uploads up to 1 GB." actionLabel="Upgrade" onUpgrade={onOpenUpgrade} /> : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <Search size={16} color={colors.mutedText} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search files by name or task..." placeholderTextColor={colors.mutedText} style={{ flex: 1, color: colors.text, fontSize: 14 }} />
        {search ? <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}><X size={16} color={colors.mutedText} /></TouchableOpacity> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FILTERS.map((option) => {
          const selected = option.value === filter;
          return (
            <TouchableOpacity key={option.value} onPress={() => setFilter(option.value)} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : colors.surface }}>
              <Text style={{ color: selected ? colors.onAccent : colors.secondaryText, fontSize: 12, fontWeight: '800' }}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {visibleFiles.length === 0 ? (
        <EmptyPanel icon={<FolderOpen size={26} color={colors.mutedText} />} title="No project files found" message={files.length === 0 ? 'Files attached to tasks appear here.' : 'Try a different search or filter.'} />
      ) : (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          {visibleFiles.map((file, index) => (
            <View key={`${file.task.id}-${file.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border }}>
              <FileTypeIcon type={file.type || ''} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{file.name}</Text>
                <TouchableOpacity onPress={() => onSelectTask(file.task)}><Text numberOfLines={1} style={{ color: colors.accent, fontSize: 11, fontWeight: '700' }}>{file.task.title}</Text></TouchableOpacity>
                <Text numberOfLines={1} style={{ color: colors.mutedText, fontSize: 11 }}>{formatFileSize(file.size)} · {file.uploadedByName} · {file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => void openAttachment(file.url)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.control }}>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>Open</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
