import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { Save, Send, X, XCircle, Plus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';

/* ─────────── Types ─────────── */
interface CreateEventModalProps {
  visible: boolean;
  onClose: () => void;
}
type MediaSource = { url: string; type: 'image' | 'video'; isVerified: boolean };

type CreateEventForm = {
  title: string;
  date: string;
  time: string;
  endDate: string;
  endTime: string;
  location: string;
  summary: string;
  coverMedia: string | null;
  additionalMedia: MediaSource[];
  tags: string[];
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  category: string;
};

/* ─────────── Component ─────────── */
export default function CreateEventModal({ visible, onClose }: CreateEventModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTag, setCurrentTag] = useState('');
  const [currentMediaUrl, setCurrentMediaUrl] = useState('');
  const [formData, setFormData] = useState<CreateEventForm>({
    title: '',
    date: '',
    time: '',
    endDate: '',
    endTime: '',
    location: '',
    summary: '',
    coverMedia: null,
    additionalMedia: [],
    tags: [],
    recurrence: 'none',
    category: '',
  });

  /* ───────── File handling ───────── */
  const pickCoverImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      const f = res.assets[0];
      if (f.fileSize && f.fileSize > 5 * 1024 * 1024) {
        Toast.show({ type: 'error', text1: 'File > 5 MB – pick a smaller one' });
        return;
      }
      setFormData(p => ({ ...p, coverMedia: f.uri }));
    }
  };
  const removeCoverImage = () => setFormData(p => ({ ...p, coverMedia: null }));

  /* ───────── Helpers ───────── */
  const addTag = () => {
    if (currentTag && !formData.tags.includes(currentTag)) {
      setFormData(p => ({ ...p, tags: [...p.tags, currentTag] }));
      setCurrentTag('');
    }
  };
  const removeTag = (tag: string) =>
    setFormData(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }));

  const addMedia = () => {
    if (currentMediaUrl.trim()) {
      setFormData(p => ({
        ...p,
        additionalMedia: [
          ...p.additionalMedia,
          { url: currentMediaUrl.trim(), type: 'image', isVerified: false },
        ],
      }));
      setCurrentMediaUrl('');
    }
  };
  const removeMedia = (i: number) =>
    setFormData(p => ({
      ...p,
      additionalMedia: p.additionalMedia.filter((_, idx) => idx !== i),
    }));

  const isValid =
    !!formData.title && !!formData.date && !!formData.time && !!formData.coverMedia;

  const handleSubmit = async () => {
    if (!isValid) {
      Toast.show({ type: 'error', text1: 'Fill required fields first' });
      return;
    }
    try {
      setIsSubmitting(true);
      console.log('Creating event:', { ...formData, createdAt: new Date().toISOString() });
      Toast.show({ type: 'success', text1: 'Event created!' });
      resetForm();
      onClose();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Failed to create event' });
    } finally {
      setIsSubmitting(false);
    }
  };
  const resetForm = () => {
    setFormData({
      title: '',
      date: '',
      time: '',
      endDate: '',
      endTime: '',
      location: '',
      summary: '',
      coverMedia: null,
      additionalMedia: [],
      tags: [],
      recurrence: 'none',
      category: '',
    });
    setCurrentTag('');
    setCurrentMediaUrl('');
  };

  /* ───────── UI ───────── */
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'center',
          paddingHorizontal: 12,
        }}
      >
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 20,
            maxHeight: '92%',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 14,
              paddingHorizontal: 20,
              borderBottomWidth: 0.5,
              borderColor: '#e5e7eb',
            }}
          >
            <View>
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>
                Create New Event
              </Text>
              <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Host a gathering, workshop, or celebration
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <XCircle size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
            {/* Title */}
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#374151', marginBottom: 4 }}>
              Title <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <TextInput
              placeholder="Event title"
              value={formData.title}
              onChangeText={v => setFormData(p => ({ ...p, title: v }))}
              style={{
                borderWidth: 1,
                borderColor: '#d1d5db',
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                fontSize: 14,
                marginBottom: 12,
              }}
            />

            {/* Dates & Times */}
            {[
              { label: 'Start Date', key: 'date', ph: 'YYYY-MM-DD' },
              { label: 'Start Time', key: 'time', ph: 'HH:MM' },
            ].map(field => (
              <View key={field.key} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '500', color: '#374151', marginBottom: 4 }}>
                  {field.label} <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  placeholder={field.ph}
                  value={(formData as any)[field.key]}
                  onChangeText={v => setFormData(p => ({ ...p, [field.key]: v }))}
                  style={{
                    borderWidth: 1,
                    borderColor: '#d1d5db',
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                    fontSize: 14,
                  }}
                />
              </View>
            ))}

            {/* End date/time */}
            {[
              { label: 'End Date', key: 'endDate', ph: 'YYYY-MM-DD' },
              { label: 'End Time', key: 'endTime', ph: 'HH:MM' },
            ].map(field => (
              <View key={field.key} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '500', color: '#374151', marginBottom: 4 }}>
                  {field.label} <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  placeholder={field.ph}
                  value={(formData as any)[field.key]}
                  onChangeText={v => setFormData(p => ({ ...p, [field.key]: v }))}
                  style={{
                    borderWidth: 1,
                    borderColor: '#d1d5db',
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                    fontSize: 14,
                  }}
                />
              </View>
            ))}

            {/* Recurrence */}
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#374151', marginBottom: 4 }}>
              Recurrence
            </Text>
            <TextInput
              placeholder="none | daily | weekly | monthly"
              value={formData.recurrence}
              onChangeText={v =>
                setFormData(p => ({ ...p, recurrence: v as CreateEventForm['recurrence'] }))
              }
              style={{
                borderWidth: 1,
                borderColor: '#d1d5db',
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                fontSize: 14,
                marginBottom: 12,
              }}
            />

            {/* Location */}
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#374151', marginBottom: 4 }}>
              Location
            </Text>
            <TextInput
              placeholder="Venue or online link"
              value={formData.location}
              onChangeText={v => setFormData(p => ({ ...p, location: v }))}
              style={{
                borderWidth: 1,
                borderColor: '#d1d5db',
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                fontSize: 14,
                marginBottom: 12,
              }}
            />

            {/* Summary */}
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#374151', marginBottom: 4 }}>
              Summary
            </Text>
            <TextInput
              placeholder="Quick summary"
              multiline
              value={formData.summary}
              onChangeText={v => setFormData(p => ({ ...p, summary: v }))}
              style={{
                borderWidth: 1,
                borderColor: '#d1d5db',
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 8,
                fontSize: 14,
                height: 100,
                textAlignVertical: 'top',
                marginBottom: 12,
              }}
            />

            {/* Cover */}
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#374151', marginBottom: 4 }}>
              Cover Image <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            {formData.coverMedia ? (
              <View style={{ marginBottom: 12 }}>
                <Image
                  source={{ uri: formData.coverMedia }}
                  style={{ width: '100%', height: 180, borderRadius: 10 }}
                />
                <TouchableOpacity
                  onPress={removeCoverImage}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    backgroundColor: '#ef4444',
                    borderRadius: 12,
                    padding: 4,
                  }}
                >
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={pickCoverImage}
                style={{
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: '#d1d5db',
                  borderRadius: 10,
                  paddingVertical: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Plus size={28} color="#737373" />
                <Text style={{ fontSize: 12, color: '#737373', marginTop: 6 }}>
                  Tap to pick an image ≤ 5 MB
                </Text>
              </TouchableOpacity>
            )}

            {/* Additional media */}
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#374151', marginBottom: 4 }}>
              Additional Media (URL)
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <TextInput
                placeholder="https://…"
                value={currentMediaUrl}
                onChangeText={setCurrentMediaUrl}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                  fontSize: 14,
                }}
              />
              <TouchableOpacity
                onPress={addMedia}
                style={{
                  backgroundColor: '#01eb53',
                  borderRadius: 8,
                  padding: 8,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Plus size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {formData.additionalMedia.map((m, i) => (
                <View
                  key={i}
                  style={{
                    width: 90,
                    height: 90,
                    marginRight: 10,
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  <Image source={{ uri: m.url }} style={{ width: '100%', height: '100%' }} />
                  <TouchableOpacity
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      backgroundColor: '#ef4444',
                      padding: 2,
                      borderRadius: 10,
                    }}
                    onPress={() => removeMedia(i)}
                  >
                    <X size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            {/* Tags */}
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#374151', marginTop: 12, marginBottom: 4 }}>
              Tags
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <TextInput
                placeholder="Add a tag"
                value={currentTag}
                onChangeText={setCurrentTag}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                  fontSize: 14,
                }}
              />
              <TouchableOpacity
                onPress={addTag}
                style={{
                  backgroundColor: '#01eb53',
                  borderRadius: 8,
                  padding: 8,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Plus size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {formData.tags.map(tag => (
                <View
                  key={tag}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: '#f3f4f6',
                    borderRadius: 14,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    marginTop: 6,
                  }}
                >
                  <Text>{tag}</Text>
                  <TouchableOpacity hitSlop={8} onPress={() => removeTag(tag)}>
                    <X size={12} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Category */}
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#374151', marginTop: 12, marginBottom: 4 }}>
              Category
            </Text>
            <TextInput
              placeholder="e.g. Cultural"
              value={formData.category}
              onChangeText={v => setFormData(p => ({ ...p, category: v }))}
              style={{
                borderWidth: 1,
                borderColor: '#d1d5db',
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                fontSize: 14,
                marginBottom: 20,
              }}
            />
          </ScrollView>

          {/* Footer */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: 12,
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderTopWidth: 0.5,
              borderColor: '#e5e7eb',
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              disabled={isSubmitting}
              style={{ paddingVertical: 10, paddingHorizontal: 16 }}
            >
              <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!isValid || isSubmitting}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor:'#01eb53',
                borderRadius: 8,
                paddingVertical: 10,
                paddingHorizontal: 16,
                //opacity: !isValid || isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? <Save size={18} color="#000" /> : <Send size={18} color="#fff" />}
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                {isSubmitting ? 'Saving…' : 'Publish Event'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
