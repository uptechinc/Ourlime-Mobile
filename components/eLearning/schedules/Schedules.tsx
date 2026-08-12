import { useEffect, useState, useCallback } from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    ScrollView, 
    Modal, 
    Alert, 
    ActivityIndicator,
    Dimensions,
    Switch
} from 'react-native';
import { useProfileStore } from '@/src/store/useProfileStore';
// TODO: Comment out Firebase setup for later implementation
// import { TestReminderService } from '@/lib/schedule/test/TestReminderService';

type RecurringType = 'weekly' | 'monthly';

type Schedule = {
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
};

type FormData = {
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
    showStartTimeDropdown: boolean;
    showEndTimeDropdown: boolean;
};

type Template = {
    name: string;
    schedules: Omit<Schedule, 'id' | 'status'>[];
};

export default function Schedules() {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
    const [templateName, setTemplateName] = useState('');

    const userData = useProfileStore();
    const timeSlots = ["8:00", "9:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"];
    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const colors = ['#00ff5e', '#ff0000', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080'];

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
        },
        showStartTimeDropdown: false,
        showEndTimeDropdown: false
    });

    const fetchSchedules = useCallback(async () => {
        if (!userData.id) return;
        setLoading(true);

        try {
            // TODO: Replace with actual API call when Firebase is implemented
            // const response = await fetch(`/api/schedules?userId=${userData.id}`);
            // const data = await response.json();

            // Mock data for now
            const mockSchedules: Schedule[] = [
                {
                    id: '1',
                    subject: 'Mathematics',
                    startTime: '9:00',
                    endTime: '10:00',
                    day: 'Monday',
                    status: 'upcoming',
                    color: '#00ff5e',
                    isRecurring: true,
                    recurringType: 'weekly',
                    reminders: { email: true, whatsapp: false }
                },
                {
                    id: '2',
                    subject: 'Physics',
                    startTime: '14:00',
                    endTime: '15:00',
                    day: 'Wednesday',
                    status: 'upcoming',
                    color: '#ff0000',
                    isRecurring: false,
                    recurringType: 'weekly',
                    reminders: { email: true, whatsapp: true }
                }
            ];

            const updatedSchedules = mockSchedules.map((schedule: Schedule) => ({
                ...schedule,
                status: determineStatus(schedule)
            }));
            setSchedules(updatedSchedules);
        } catch (error) {
            console.error('Error fetching schedules:', error);
        } finally {
            setLoading(false);
        }
    }, [userData.id]);

    // Fetch schedules on component mount
    useEffect(() => {
        fetchSchedules();
    }, [fetchSchedules]);

    const handleSubmit = async () => {
        if (!validateTimeConflicts({
            id: '',
            subject: formData.subject,
            startTime: formData.startTime,
            endTime: formData.endTime,
            day: formData.day,
            status: 'upcoming',
            color: formData.color,
            isRecurring: formData.isRecurring,
            recurringType: formData.recurringType,
            reminders: formData.reminders
        } as Schedule)) {
            Alert.alert('Time Conflict', 'Time slot conflict! Please choose a different time.');
            return;
        }

        try {
            let schedulesToAdd: Schedule[] = [];

            if (formData.isRecurring) {
                if (formData.recurringType === 'weekly') {
                    for (let week = 0; week < 4; week++) {
                        schedulesToAdd.push({
                            id: `schedule_${Date.now()}_${week}`,
                            subject: formData.subject,
                            startTime: formData.startTime,
                            endTime: formData.endTime,
                            day: formData.day,
                            status: 'upcoming',
                            color: formData.color,
                            isRecurring: formData.isRecurring,
                            recurringType: formData.recurringType,
                            reminders: formData.reminders,
                            weekNumber: week + 1
                        });
                    }
                } else {
                    for (let month = 0; month < 3; month++) {
                        schedulesToAdd.push({
                            id: `schedule_${Date.now()}_${month}`,
                            subject: formData.subject,
                            startTime: formData.startTime,
                            endTime: formData.endTime,
                            day: formData.day,
                            status: 'upcoming',
                            color: formData.color,
                            isRecurring: formData.isRecurring,
                            recurringType: formData.recurringType,
                            reminders: formData.reminders,
                            monthNumber: month + 1
                        });
                    }
                }
            } else {
                schedulesToAdd.push({
                    id: `schedule_${Date.now()}`,
                    subject: formData.subject,
                    startTime: formData.startTime,
                    endTime: formData.endTime,
                    day: formData.day,
                    status: 'upcoming',
                    color: formData.color,
                    isRecurring: formData.isRecurring,
                    recurringType: formData.recurringType,
                    reminders: formData.reminders
                });
            }

            // TODO: Replace with actual API call when Firebase is implemented
            // const response = await fetch('/api/schedules', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({
            //         userId: userData.id,
            //         schedules: schedulesToAdd
            //     })
            // });

            // if (response.ok) {
            //     await fetchSchedules();
            //     setShowAddForm(false);
            //     resetForm();
            // }

            // For now, just add to local state
            setSchedules(prev => [...prev, ...schedulesToAdd]);
            setShowAddForm(false);
            resetForm();
        } catch (error) {
            console.error('Error adding schedule:', error);
        }
    };

    const handleEdit = async () => {
        if (!selectedSchedule) return;

        try {
            // TODO: Replace with actual API call when Firebase is implemented
            // const response = await fetch('/api/schedules', {
            //     method: 'PUT',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({
            //         userId: userData.id,
            //         scheduleId: selectedSchedule.id,
            //         updatedSchedule: formData
            //     })
            // });

            // if (response.ok) {
            //     await fetchSchedules();
            //     setShowEditForm(false);
            //     resetForm();
            // }

            // For now, just update local state
            setSchedules(prev => prev.map(schedule => 
                schedule.id === selectedSchedule.id 
                    ? { ...schedule, ...formData }
                    : schedule
            ));
            setShowEditForm(false);
            resetForm();
        } catch (error) {
            console.error('Error updating schedule:', error);
        }
    };

    const handleDelete = async () => {
        if (!selectedSchedule) return;

        try {
            // TODO: Replace with actual API call when Firebase is implemented
            // const response = await fetch(`/api/schedules?userId=${userData.id}&scheduleId=${selectedSchedule.id}`, {
            //     method: 'DELETE'
            // });

            // if (response.ok) {
            //     await fetchSchedules();
            //     setShowDeleteConfirm(false);
            //     setSelectedSchedule(null);
            // }

            // For now, just remove from local state
            setSchedules(prev => prev.filter(schedule => schedule.id !== selectedSchedule.id));
            setShowDeleteConfirm(false);
            setSelectedSchedule(null);
        } catch (error) {
            console.error('Error deleting schedule:', error);
        }
    };

    const exportToCalendar = () => {
        // TODO: Implement calendar export for React Native
        Alert.alert('Export', 'Calendar export functionality coming soon!');
    };

    const saveAsTemplate = async (name: string) => {
        if (!name.trim() || !userData.id) return;

        const newTemplate = {
            name,
            schedules: selectedSchedules.map(id => {
                const schedule = schedules.find(s => s.id === id);
                if (!schedule) return null;
                const { id: _, status: __, ...rest } = schedule;
                return rest;
            }).filter(Boolean) as Omit<Schedule, 'id' | 'status'>[]
        };

        try {
            // TODO: Replace with actual API call when Firebase is implemented
            // const response = await fetch('/api/schedules/template', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({
            //         userId: userData.id,
            //         template: newTemplate
            //     })
            // });

            // if (response.ok) {
            //     setTemplates(prev => [...prev, newTemplate]);
            //     setTemplateName('');
            //     setShowTemplateModal(false);
            // }

            // For now, just add to local state
            setTemplates(prev => [...prev, newTemplate]);
            setTemplateName('');
            setShowTemplateModal(false);
        } catch (error) {
            console.error('Error saving template:', error);
        }
    };

    // Helper functions
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
            },
            showStartTimeDropdown: false,
            showEndTimeDropdown: false
        });
    };

    const determineStatus = (schedule: Schedule): 'upcoming' | 'passed' => {
        const now = new Date();
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const today = days[now.getDay() - 1];
        const currentHour = now.getHours();

        const scheduleHour = parseInt(schedule.startTime);
        const scheduleDay = schedule.day;
        const dayIndex = days.indexOf(scheduleDay);
        const todayIndex = days.indexOf(today);

        if (dayIndex > todayIndex || (dayIndex === todayIndex && scheduleHour > currentHour)) {
            return 'upcoming';
        }
        return 'passed';
    };

    const validateTimeConflicts = (newSchedule: Schedule): boolean => {
        return !schedules.some(existing =>
            existing.day === newSchedule.day &&
            existing.id !== newSchedule.id &&
            ((parseInt(newSchedule.startTime) >= parseInt(existing.startTime) &&
                parseInt(newSchedule.startTime) < parseInt(existing.endTime)) ||
                (parseInt(newSchedule.endTime) > parseInt(existing.startTime) &&
                    parseInt(newSchedule.endTime) <= parseInt(existing.endTime)))
        );
    };

    const renderTimeSlot = (day: string, time: string) => {
        const slotSchedules = schedules.filter(schedule =>
            schedule.day === day && schedule.startTime === time
        );

        return slotSchedules.map(schedule => (
            <View
                key={schedule.id}
                style={{ 
                    backgroundColor: schedule.color,
                    padding: 4,
                    borderRadius: 6,
                    marginBottom: 2,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <TouchableOpacity
                        onPress={() => {
                            setSelectedSchedules(prev =>
                                prev.includes(schedule.id)
                                    ? prev.filter(id => id !== schedule.id)
                                    : [...prev, schedule.id]
                            );
                        }}
                        style={{
                            width: 12,
                            height: 12,
                            backgroundColor: selectedSchedules.includes(schedule.id) ? '#10b981' : '#ffffff',
                            borderWidth: 1,
                            borderColor: '#d1d5db',
                            borderRadius: 2
                        }}
                    />
                    <TouchableOpacity
                        onPress={() => {
                            setSelectedSchedule(schedule);
                            setFormData({
                                subject: schedule.subject,
                                startTime: schedule.startTime,
                                endTime: schedule.endTime,
                                day: schedule.day,
                                color: schedule.color,
                                isRecurring: schedule.isRecurring,
                                recurringType: schedule.recurringType || 'weekly',
                                reminders: schedule.reminders,
                                showStartTimeDropdown: false,
                                showEndTimeDropdown: false
                            });
                            setShowEditForm(true);
                        }}
                        style={{ flex: 1 }}
                    >
                        <Text style={{ fontSize: 10, fontWeight: '500', color: '#111827' }}>
                            {schedule.subject}
                        </Text>
                        <Text style={{ fontSize: 8, color: '#374151' }}>
                            {`${schedule.startTime}-${schedule.endTime}`}
                        </Text>
                        {schedule.isRecurring && (
                            <Text style={{ fontSize: 8, fontStyle: 'italic', color: '#6b7280' }}>
                                {schedule.recurringType === 'weekly' ? 'Weekly' : 'Monthly'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        ));
    };

    const screenWidth = Dimensions.get('window').width;

    return (
        <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
            <View style={{ 
                backgroundColor: '#ffffff', 
                borderRadius: 12, 
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
                padding: 16,
                margin: 16
            }}>
                {/* Enhanced Header with View Toggle and Actions */}
                <View style={{ 
                    flexDirection: 'row', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: 24,
                    flexWrap: 'wrap',
                    gap: 12
                }}>
                    <Text style={{ fontSize: 20, fontWeight: '600', color: '#1f2937' }}>
                        Class Schedule
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {/* View Toggle */}
                        <View style={{ 
                            flexDirection: 'row', 
                            backgroundColor: '#f3f4f6', 
                            borderRadius: 8, 
                            padding: 4 
                        }}>
                            <TouchableOpacity
                                onPress={() => setViewMode('grid')}
                                style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                    backgroundColor: viewMode === 'grid' ? '#ffffff' : 'transparent'
                                }}
                            >
                                <Text style={{ 
                                    fontSize: 16, 
                                    fontWeight: '500',
                                    color: viewMode === 'grid' ? '#1f2937' : '#6b7280'
                                }}>
                                    ⬜
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setViewMode('calendar')}
                                style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                    backgroundColor: viewMode === 'calendar' ? '#ffffff' : 'transparent'
                                }}
                            >
                                <Text style={{ 
                                    fontSize: 16, 
                                    fontWeight: '500',
                                    color: viewMode === 'calendar' ? '#1f2937' : '#6b7280'
                                }}>
                                    📅
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Action Buttons */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity
                                onPress={exportToCalendar}
                                style={{
                                    padding: 8,
                                    borderRadius: 6,
                                    backgroundColor: '#f3f4f6'
                                }}
                            >
                                <Text style={{ fontSize: 14, color: '#6b7280' }}>⬇️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setShowTemplateModal(true)}
                                style={{
                                    padding: 8,
                                    borderRadius: 6,
                                    backgroundColor: '#f3f4f6'
                                }}
                            >
                                <Text style={{ fontSize: 14, color: '#6b7280' }}>📋</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setShowTemplateListModal(true)}
                                style={{
                                    padding: 8,
                                    borderRadius: 6,
                                    backgroundColor: '#f3f4f6'
                                }}
                            >
                                <Text style={{ fontSize: 14, color: '#6b7280' }}>📚</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setShowAddForm(true)}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    backgroundColor: '#10b981',
                                    borderRadius: 8
                                }}
                            >
                                <Text style={{ fontSize: 14, color: '#ffffff' }}>➕</Text>
                                <Text style={{ fontSize: 12, color: '#ffffff', fontWeight: '500' }}>
                                    Add
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Schedule Content */}
                {loading ? (
                    <View style={{ 
                        flex: 1, 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        height: 256 
                    }}>
                        <ActivityIndicator size="large" color="#10b981" />
                    </View>
                ) : viewMode === 'grid' ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ minWidth: screenWidth - 48 }}>
                            <View style={{ flexDirection: 'row' }}>
                                {/* Fixed Time Column */}
                                <View style={{ 
                                    width: 60, 
                                    backgroundColor: '#ffffff',
                                    zIndex: 10
                                }}>
                                    <View style={{ height: 40 }} />
                                    {timeSlots.map((time) => (
                                        <View key={time} style={{ 
                                            height: 40, 
                                            flexDirection: 'row', 
                                            alignItems: 'center', 
                                            justifyContent: 'flex-end', 
                                            paddingRight: 8 
                                        }}>
                                            <Text style={{ fontSize: 10, color: '#6b7280' }}>
                                                {time}
                                            </Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Schedule Grid */}
                                <View style={{ flex: 1 }}>
                                    {/* Days Header */}
                                    <View style={{ 
                                        flexDirection: 'row', 
                                        gap: 2, 
                                        marginBottom: 12 
                                    }}>
                                        {daysOfWeek.map(day => (
                                            <View key={day} style={{ 
                                                flex: 1, 
                                                alignItems: 'center' 
                                            }}>
                                                <Text style={{ 
                                                    fontSize: 10, 
                                                    fontWeight: '500', 
                                                    color: '#374151' 
                                                }}>
                                                    {day}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>

                                    {/* Schedule Grid */}
                                    {timeSlots.map((time) => (
                                        <View key={time} style={{ 
                                            flexDirection: 'row', 
                                            gap: 2, 
                                            marginBottom: 4 
                                        }}>
                                            {daysOfWeek.map(day => (
                                                <View
                                                    key={`${day}-${time}`}
                                                    style={{
                                                        flex: 1,
                                                        minHeight: 40,
                                                        position: 'relative'
                                                    }}
                                                >
                                                    {renderTimeSlot(day, time)}
                                                </View>
                                            ))}
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                ) : (
                    <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                        <Text style={{ fontSize: 16, color: '#6b7280' }}>
                            Calendar view coming soon...
                        </Text>
                    </View>
                )}
            </View>

            {/* Add/Edit Form Modal */}
            <Modal
                visible={showAddForm || showEditForm}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => {
                    if (showAddForm) {
                        setShowAddForm(false);
                    } else {
                        setShowEditForm(false);
                    }
                    resetForm();
                }}
            >
                <View style={{ 
                    flex: 1, 
                    backgroundColor: '#ffffff', 
                    padding: 16 
                }}>
                    <View style={{ 
                        flexDirection: 'row', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        marginBottom: 16 
                    }}>
                        <Text style={{ fontSize: 18, fontWeight: '600' }}>
                            {showAddForm ? 'Add New Class' : 'Edit Class'}
                        </Text>
                        <TouchableOpacity
                            onPress={() => {
                                if (showAddForm) {
                                    setShowAddForm(false);
                                } else {
                                    setShowEditForm(false);
                                }
                                resetForm();
                            }}
                        >
                            <Text style={{ fontSize: 24, color: '#6b7280' }}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ flex: 1 }}>
                        <View style={{ gap: 16 }}>
                            {/* Subject Input */}
                            <View>
                                <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                                    Subject
                                </Text>
                                <TextInput
                                    style={{
                                        borderWidth: 1,
                                        borderColor: '#d1d5db',
                                        borderRadius: 8,
                                        padding: 12,
                                        fontSize: 16
                                    }}
                                    placeholder="Enter subject name"
                                    value={formData.subject}
                                    onChangeText={(text) => setFormData({ ...formData, subject: text })}
                                />
                            </View>

                            {/* Time Selection */}
                            <View style={{ flexDirection: 'row', gap: 16 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                                        Start Time
                                    </Text>
                                    <View style={{ position: 'relative' }}>
                                        <TouchableOpacity
                                            onPress={() => setFormData({ ...formData, showStartTimeDropdown: !formData.showStartTimeDropdown })}
                                            style={{
                                                borderWidth: 1,
                                                borderColor: '#d1d5db',
                                                borderRadius: 8,
                                                padding: 12,
                                                backgroundColor: '#ffffff',
                                                flexDirection: 'row',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <Text style={{
                                                fontSize: 16,
                                                color: formData.startTime ? '#111827' : '#9ca3af'
                                            }}>
                                                {formData.startTime || 'Select start time'}
                                            </Text>
                                            <Text style={{ 
                                                fontSize: 16, 
                                                color: '#9ca3af',
                                                transform: [{ rotate: formData.showStartTimeDropdown ? '180deg' : '0deg' }]
                                            }}>▼</Text>
                                        </TouchableOpacity>
                                        
                                        {formData.showStartTimeDropdown && (
                                            <View style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                right: 0,
                                                backgroundColor: '#ffffff',
                                                borderWidth: 1,
                                                borderColor: '#d1d5db',
                                                borderRadius: 8,
                                                marginTop: 4,
                                                maxHeight: 200,
                                                zIndex: 1000,
                                                shadowColor: '#000',
                                                shadowOffset: { width: 0, height: 2 },
                                                shadowOpacity: 0.1,
                                                shadowRadius: 4,
                                                elevation: 5
                                            }}>
                                            <ScrollView showsVerticalScrollIndicator={false}>
                                                {timeSlots.map(time => (
                                                    <TouchableOpacity
                                                        key={time}
                                                        onPress={() => {
                                                            setFormData({ 
                                                                ...formData, 
                                                                startTime: time, 
                                                                showStartTimeDropdown: false 
                                                            });
                                                        }}
                                                        style={{
                                                            padding: 12,
                                                            borderBottomWidth: 1,
                                                            borderBottomColor: '#f3f4f6',
                                                            backgroundColor: formData.startTime === time ? '#f0f9ff' : 'transparent'
                                                        }}
                                                    >
                                                        <Text style={{
                                                            fontSize: 14,
                                                            color: formData.startTime === time ? '#0ea5e9' : '#374151',
                                                            fontWeight: formData.startTime === time ? '600' : '400'
                                                        }}>
                                                            {time}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                        )}
                                    </View>
                                </View>
                                
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                                        End Time
                                    </Text>
                                    <View style={{ position: 'relative' }}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (!formData.startTime) {
                                                    Alert.alert('Select Start Time First', 'Please select a start time before choosing an end time.');
                                                    return;
                                                }
                                                setFormData({ ...formData, showEndTimeDropdown: !formData.showEndTimeDropdown });
                                            }}
                                            style={{
                                                borderWidth: 1,
                                                borderColor: '#d1d5db',
                                                borderRadius: 8,
                                                padding: 12,
                                                backgroundColor: '#ffffff',
                                                flexDirection: 'row',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                opacity: !formData.startTime ? 0.5 : 1
                                            }}
                                            disabled={!formData.startTime}
                                        >
                                            <Text style={{
                                                fontSize: 16,
                                                color: formData.endTime ? '#111827' : '#9ca3af'
                                            }}>
                                                {formData.endTime || 'Select end time'}
                                            </Text>
                                            <Text style={{ 
                                                fontSize: 16, 
                                                color: '#9ca3af',
                                                transform: [{ rotate: formData.showEndTimeDropdown ? '180deg' : '0deg' }]
                                            }}>▼</Text>
                                        </TouchableOpacity>
                                        
                                        {formData.showEndTimeDropdown && (
                                            <View style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                right: 0,
                                                backgroundColor: '#ffffff',
                                                borderWidth: 1,
                                                borderColor: '#d1d5db',
                                                borderRadius: 8,
                                                marginTop: 4,
                                                maxHeight: 200,
                                                zIndex: 1000,
                                                shadowColor: '#000',
                                                shadowOffset: { width: 0, height: 2 },
                                                shadowOpacity: 0.1,
                                                shadowRadius: 4,
                                                elevation: 5
                                            }}>
                                            <ScrollView showsVerticalScrollIndicator={false}>
                                                {timeSlots
                                                    .filter(time => parseInt(time) > parseInt(formData.startTime))
                                                    .map(time => (
                                                        <TouchableOpacity
                                                            key={time}
                                                            onPress={() => {
                                                                setFormData({ 
                                                                    ...formData, 
                                                                    endTime: time, 
                                                                    showEndTimeDropdown: false 
                                                                });
                                                            }}
                                                            style={{
                                                                padding: 12,
                                                                borderBottomWidth: 1,
                                                                borderBottomColor: '#f3f4f6',
                                                                backgroundColor: formData.endTime === time ? '#f0f9ff' : 'transparent'
                                                            }}
                                                        >
                                                            <Text style={{
                                                                fontSize: 14,
                                                                color: formData.endTime === time ? '#0ea5e9' : '#374151',
                                                                fontWeight: formData.endTime === time ? '600' : '400'
                                                            }}>
                                                                {time}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                            </ScrollView>
                                        </View>
                                        )}
                                    </View>
                                </View>
                            </View>

                            {/* Day Selection */}
                            <View>
                                <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                                    Day
                                </Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        {daysOfWeek.map(day => (
                                            <TouchableOpacity
                                                key={day}
                                                onPress={() => setFormData({ ...formData, day })}
                                                style={{
                                                    paddingHorizontal: 16,
                                                    paddingVertical: 8,
                                                    borderRadius: 6,
                                                    backgroundColor: formData.day === day ? '#10b981' : '#f3f4f6'
                                                }}
                                            >
                                                <Text style={{ 
                                                    color: formData.day === day ? '#ffffff' : '#374151',
                                                    fontSize: 14
                                                }}>
                                                    {day}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>

                            {/* Color Selection */}
                            <View>
                                <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                                    Color
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                                    {colors.map(color => (
                                        <TouchableOpacity
                                            key={color}
                                            onPress={() => setFormData({ ...formData, color })}
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 16,
                                                backgroundColor: color,
                                                borderWidth: formData.color === color ? 3 : 0,
                                                borderColor: '#ffffff'
                                            }}
                                        />
                                    ))}
                                </View>
                            </View>

                            {/* Recurring Schedule */}
                            <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Switch
                                        value={formData.isRecurring}
                                        onValueChange={(value) => setFormData({
                                            ...formData,
                                            isRecurring: value
                                        })}
                                        trackColor={{ false: '#d1d5db', true: '#10b981' }}
                                        thumbColor="#ffffff"
                                    />
                                    <Text style={{ fontSize: 14, fontWeight: '500' }}>
                                        Recurring Schedule
                                    </Text>
                                </View>
                                {formData.isRecurring && (
                                    <View style={{ marginTop: 8 }}>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                {['weekly', 'monthly'].map(type => (
                                                    <TouchableOpacity
                                                        key={type}
                                                        onPress={() => setFormData({
                                                            ...formData,
                                                            recurringType: type as RecurringType
                                                        })}
                                                        style={{
                                                            paddingHorizontal: 16,
                                                            paddingVertical: 8,
                                                            borderRadius: 6,
                                                            backgroundColor: formData.recurringType === type ? '#10b981' : '#f3f4f6'
                                                        }}
                                                    >
                                                        <Text style={{ 
                                                            color: formData.recurringType === type ? '#ffffff' : '#374151',
                                                            fontSize: 14
                                                        }}>
                                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </ScrollView>
                                    </View>
                                )}
                            </View>

                            {/* Reminders */}
                            <View>
                                <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                                    Reminders
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 16 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Switch
                                            value={formData.reminders.email}
                                            onValueChange={(value) => setFormData({
                                                ...formData,
                                                reminders: { ...formData.reminders, email: value }
                                            })}
                                            trackColor={{ false: '#d1d5db', true: '#10b981' }}
                                            thumbColor="#ffffff"
                                        />
                                        <Text style={{ fontSize: 14 }}>Email</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Switch
                                            value={formData.reminders.whatsapp}
                                            onValueChange={(value) => setFormData({
                                                ...formData,
                                                reminders: { ...formData.reminders, whatsapp: value }
                                            })}
                                            trackColor={{ false: '#d1d5db', true: '#10b981' }}
                                            thumbColor="#ffffff"
                                        />
                                        <Text style={{ fontSize: 14 }}>WhatsApp</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Submit Button */}
                            <TouchableOpacity
                                onPress={showAddForm ? handleSubmit : handleEdit}
                                style={{
                                    paddingVertical: 12,
                                    backgroundColor: '#10b981',
                                    borderRadius: 8,
                                    alignItems: 'center',
                                    marginTop: 16
                                }}
                            >
                                <Text style={{ 
                                    fontSize: 16, 
                                    color: '#ffffff', 
                                    fontWeight: '500' 
                                }}>
                                    {showAddForm ? 'Add Class' : 'Save Changes'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* Template Modal */}
            <Modal
                visible={showTemplateModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowTemplateModal(false)}
            >
                <View style={{ 
                    flex: 1, 
                    backgroundColor: '#ffffff', 
                    padding: 16 
                }}>
                    <View style={{ 
                        flexDirection: 'row', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        marginBottom: 16 
                    }}>
                        <Text style={{ fontSize: 18, fontWeight: '600' }}>
                            Save as Template
                        </Text>
                        <TouchableOpacity onPress={() => setShowTemplateModal(false)}>
                            <Text style={{ fontSize: 24, color: '#6b7280' }}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ gap: 16 }}>
                        <TextInput
                            placeholder="Template Name"
                            style={{
                                borderWidth: 1,
                                borderColor: '#d1d5db',
                                borderRadius: 8,
                                padding: 12,
                                fontSize: 16
                            }}
                            value={templateName}
                            onChangeText={setTemplateName}
                        />
                        
                        <ScrollView style={{ maxHeight: 160 }}>
                            {selectedSchedules.map(id => {
                                const schedule = schedules.find(s => s.id === id);
                                return schedule && (
                                    <View key={id} style={{ 
                                        padding: 8, 
                                        backgroundColor: '#f9fafb', 
                                        borderRadius: 8, 
                                        marginBottom: 8 
                                    }}>
                                        <Text style={{ fontSize: 14, fontWeight: '500' }}>
                                            {schedule.subject}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                            {schedule.day} {schedule.startTime}-{schedule.endTime}
                                        </Text>
                                    </View>
                                );
                            })}
                        </ScrollView>

                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowTemplateModal(false);
                                    setSelectedSchedules([]);
                                }}
                                style={{
                                    flex: 1,
                                    paddingVertical: 12,
                                    borderWidth: 1,
                                    borderColor: '#d1d5db',
                                    borderRadius: 8,
                                    alignItems: 'center'
                                }}
                            >
                                <Text style={{ fontSize: 16, color: '#374151' }}>
                                    Cancel
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    saveAsTemplate(templateName);
                                    setSelectedSchedules([]);
                                }}
                                style={{
                                    flex: 1,
                                    paddingVertical: 12,
                                    backgroundColor: '#10b981',
                                    borderRadius: 8,
                                    alignItems: 'center'
                                }}
                                disabled={selectedSchedules.length === 0 || !templateName.trim()}
                            >
                                <Text style={{ 
                                    fontSize: 16, 
                                    color: '#ffffff', 
                                    fontWeight: '500' 
                                }}>
                                    Save Template
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                visible={showDeleteConfirm}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDeleteConfirm(false)}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 16
                }}>
                    <View style={{
                        backgroundColor: '#ffffff',
                        borderRadius: 12,
                        padding: 24,
                        width: '100%',
                        maxWidth: 320
                    }}>
                        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
                            Delete Schedule
                        </Text>
                        <Text style={{ color: '#6b7280', marginBottom: 24 }}>
                            Are you sure you want to delete this schedule?
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                                onPress={() => setShowDeleteConfirm(false)}
                                style={{
                                    flex: 1,
                                    paddingVertical: 12,
                                    borderWidth: 1,
                                    borderColor: '#d1d5db',
                                    borderRadius: 8,
                                    alignItems: 'center'
                                }}
                            >
                                <Text style={{ fontSize: 16, color: '#374151' }}>
                                    Cancel
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleDelete}
                                style={{
                                    flex: 1,
                                    paddingVertical: 12,
                                    backgroundColor: '#ef4444',
                                    borderRadius: 8,
                                    alignItems: 'center'
                                }}
                            >
                                <Text style={{ fontSize: 16, color: '#ffffff', fontWeight: '500' }}>
                                    Delete
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Template List Modal */}
            <Modal
                visible={showTemplateListModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowTemplateListModal(false)}
            >
                <View style={{ 
                    flex: 1, 
                    backgroundColor: '#ffffff', 
                    padding: 16 
                }}>
                    <View style={{ 
                        flexDirection: 'row', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        marginBottom: 16 
                    }}>
                        <Text style={{ fontSize: 18, fontWeight: '600' }}>
                            Saved Templates
                        </Text>
                        <TouchableOpacity onPress={() => setShowTemplateListModal(false)}>
                            <Text style={{ fontSize: 24, color: '#6b7280' }}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ flex: 1 }}>
                        {templates.map((template, index) => (
                            <View key={index} style={{ 
                                borderWidth: 1, 
                                borderColor: '#e5e7eb', 
                                borderRadius: 8, 
                                padding: 16, 
                                marginBottom: 16 
                            }}>
                                <Text style={{ fontSize: 16, fontWeight: '500', marginBottom: 8 }}>
                                    {template.name}
                                </Text>
                                {template.schedules.map((schedule, idx) => (
                                    <View key={idx} style={{ 
                                        backgroundColor: '#f9fafb', 
                                        padding: 8, 
                                        borderRadius: 6, 
                                        marginBottom: 8 
                                    }}>
                                        <Text style={{ fontSize: 14, fontWeight: '500' }}>
                                            {schedule.subject}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                            {schedule.day} {schedule.startTime}-{schedule.endTime}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ))}
                    </ScrollView>

                    <TouchableOpacity
                        onPress={() => setShowTemplateListModal(false)}
                        style={{
                            paddingVertical: 16,
                            backgroundColor: '#f3f4f6',
                            borderRadius: 8,
                            alignItems: 'center'
                        }}
                    >
                        <Text style={{ fontSize: 16, color: '#374151' }}>
                            Close
                        </Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        </View>
    );
}

