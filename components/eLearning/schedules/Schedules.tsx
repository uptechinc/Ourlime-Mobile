import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Alert,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Switch,
  Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Calendar, Copy, Download, Grid, List, Plus, X } from 'lucide-react-native';

type RecurringType = 'weekly' | 'monthly';

interface Schedule {
    id: string;
    subject: string;
    startTime: string;
    endTime: string;
    day: string;
    status: 'upcoming' | 'passed';
    color: string;
    isRecurring: boolean;
    recurringType: RecurringType;
    weekNumber?: number;
    monthNumber?: number;
    reminders: {
        email: boolean;
        whatsapp: boolean;
    };
}

interface FormData {
    subject: string;
    startTime: string;
    endTime: string;
    day: string;
    color: string;
    isRecurring: boolean;
    recurringType: RecurringType;
    reminders: {
        email: boolean;
        whatsapp: boolean;
    };
}

interface Template {
    name: string;
    schedules: Omit<Schedule, 'id' | 'status'>[];
}
export const Schedule = () => {
  const exportToCalendar = () => {
    // Implement the export functionality here
    Alert.alert('Export to Calendar', 'This feature is not implemented yet.');
  };
  const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
    const [templateName, setTemplateName] = useState('');
// Types
const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const timeSlots = [
  "8:00", "9:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00",
  "17:00", "18:00", "19:00", "20:00",
  "21:00", "22:00", "23:00"
];
const colors = ['#00ff5e', '#ff0000', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080'];
const recurringTypes: RecurringType[] = ['weekly', 'monthly'];

const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedSchedules, setSelectedSchedules] = useState<string[]>([]);

    const [showTemplateListModal, setShowTemplateListModal] = useState(false);

    const [formData, setFormData] = useState<FormData>({
        subject: '',
        startTime: '8:00',
        endTime: '9:00',
        day: 'Monday',
        color: '#00ff5e',
        isRecurring: false,
        recurringType: 'weekly',
        reminders: {
            email: true,
            whatsapp: false
        }
    });

  const handleSubmit = () => {
    // Implement the submit functionality here
    Alert.alert('Submit', 'This feature is not implemented yet.');
  };

  const handleEdit = () => {
    // Implement the edit functionality here
    Alert.alert('Edit', 'This feature is not implemented yet.');
  };

  const resetForm = () => {
    setFormData({
      subject: '',
      startTime: '8:00',
      endTime: '9:00',
      day: 'Monday',
      color: '#00ff5e',
      isRecurring: false,
      recurringType: 'weekly',
      reminders: {
        email: true,
        whatsapp: false
      }
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 }}>
          <View style={{ justifyContent: 'space-between',  marginBottom: 24, gap:'8'}}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>Class Schedule</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center',  flexWrap: 'wrap', gap: 8, rowGap: 12, columnGap: 12 }}>
              <TouchableOpacity onPress={() => setViewMode('grid')}>
                <Grid color={viewMode === 'grid' ? '#000' : '#aaa'} size={20} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setViewMode('calendar')}>
                <Calendar color={viewMode === 'calendar' ? '#000' : '#aaa'} size={20} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowTemplateListModal(true)}>
                <List size={20} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity onPress={exportToCalendar}>
                <Download size={20} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowTemplateModal(true)}>
                <Copy size={20} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAddForm(true)} style={{ flexDirection: 'row', backgroundColor: '#16a34a', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center'}}>
                <Plus size={16} color="#fff" />
                <Text style={{ color: '#fff', marginLeft: 4 }}>Add Class</Text>
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={{ height: 256, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="green" />
            </View>
          ) : viewMode === 'grid' ? (
            <View>
              {timeSlots.map((time) => (
                <View key={time} style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>{time}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    {daysOfWeek.map((day) => (
                      <View key={`${day}-${time}`} style={{ width: '18%', height: 64, backgroundColor: '#f3f4f6', borderRadius: 6 }} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ paddingVertical: 32 }}>
              <Text style={{ textAlign: 'center', color: '#6b7280' }}>Calendar view coming soon...</Text>
            </View>
          )}
        </View>

        <Modal visible={showAddForm || showEditForm} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, position: 'relative' }}>
              <TouchableOpacity
                onPress={() => {
                  showAddForm ? setShowAddForm(false) : setShowEditForm(false);
                  resetForm();
                }}
                style={{ position: 'absolute', top: 16, right: 16 }}
              >
                <X size={20} color="#555" />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
                {showAddForm ? 'Add New Class' : 'Edit Class'}
              </Text>
              <TextInput
                placeholder="Subject"
                value={formData.subject}
                onChangeText={(text) => setFormData({ ...formData, subject: text })}
                style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 16 }}
              /> 
              <View style={{ justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ marginBottom: 8 }}>Start Time</Text>
                  <View style={[{ width: '48%' }, { borderWidth: 1, borderColor: '#ccc', borderRadius: 8}]}>
                    <Picker
                      mode="dropdown"
                      selectedValue={formData.startTime}
                      onValueChange={(value) => setFormData({ ...formData, startTime: value })}>
                      {timeSlots.map((time) => <Picker.Item key={time} label={time} value={time} />)}
                    </Picker>
                  </View>
              </View>
              <View style={{justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ marginBottom: 8 }}>End Time</Text>
                  <View style={[{ width: '48%' }, { borderWidth: 1, borderColor: '#ccc', borderRadius: 8 }]}>
                      <Picker
                        mode="dropdown"
                        selectedValue={formData.endTime}
                        onValueChange={(value) => setFormData({ ...formData, endTime: value })}>
                        {timeSlots.map((time) => <Picker.Item key={time} label={time} value={time} />)}
                      </Picker>
                    </View>
              </View>
              <Text style={{ marginBottom: 8 }}>Day</Text>
              <View style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8 }}>
                <Picker
                  selectedValue={formData.day}
                  onValueChange={(value) => setFormData({ ...formData, day: value })}>
                  {daysOfWeek.map((day) => <Picker.Item key={day} label={day} value={day} />)}
                </Picker>
              </View>
              <Text style={{ marginBottom: 8 }}>Color</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {colors.map((color) => (
                  <Pressable
                    key={color}
                    onPress={() => setFormData({ ...formData, color })}
                    style={[{ width: 24, height: 24, borderRadius: 12 }, {
                      backgroundColor: color,
                      borderWidth: formData.color === color ? 2 : 0,
                    }]}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text>Recurring</Text>
                <Switch
                  value={formData.isRecurring}
                  onValueChange={(value) => setFormData({ ...formData, isRecurring: value })}
                />
              </View>
              {formData.isRecurring && (
                <View>
                  <Text style={{ marginBottom: 8 }}>Recurring Type</Text>
                  <View style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8 }}>
                    <Picker
                      selectedValue={formData.recurringType}
                      onValueChange={(value) => setFormData({ ...formData, recurringType: value })}>
                      {recurringTypes.map((type) => <Picker.Item key={type} label={type} value={type} />)}
                    </Picker>
                  </View>
                </View>
              )}
              <Text style={{ marginBottom: 8 }}>Reminders</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Switch
                    value={formData.reminders.email}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      reminders: { ...formData.reminders, email: value },
                    })}
                  />
                  <Text style={{ marginLeft: 8 }}>Email</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Switch
                    value={formData.reminders.whatsapp}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      reminders: { ...formData.reminders, whatsapp: value },
                    })}
                  />
                  <Text style={{ marginLeft: 8 }}>WhatsApp</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={showAddForm ? handleSubmit : handleEdit}
                style={{ backgroundColor: '#16a34a', paddingVertical: 10, borderRadius: 8 }}
              >
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>{showAddForm ? 'Add Class' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}