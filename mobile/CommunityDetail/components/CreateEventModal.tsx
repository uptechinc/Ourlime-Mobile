import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  SafeAreaView,
  ScrollView,
  Image,
} from 'react-native';
import { styles } from '../styles';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (eventData: any) => void;
}

export default function CreateEventModal({ 
  isOpen, 
  onClose, 
  onSubmit 
}: CreateEventModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');

  const handleSubmit = () => {
    console.log('TODO: Create event with data:', { 
      title, 
      description, 
      date, 
      time, 
      location, 
      maxAttendees 
    });
    onSubmit?.({ title, description, date, time, location, maxAttendees });
    // Reset form
    setTitle('');
    setDescription('');
    setDate('');
    setTime('');
    setLocation('');
    setMaxAttendees('');
    onClose();
  };

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderContent}>
            <Pressable onPress={onClose} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseButtonText}>✕</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Host Event</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>
        
        <ScrollView 
          style={styles.modalContent}
          contentContainerStyle={styles.modalContentContainer}
        >
          <View style={styles.createForm}>
            <Text style={styles.formLabel}>Event Title</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="What's the event about?"
            />

            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your event..."
              multiline
              numberOfLines={4}
            />

            <View style={styles.dateTimeRow}>
              <View style={styles.dateTimeInput}>
                <Text style={styles.formLabel}>Date</Text>
                <TextInput
                  style={styles.textInput}
                  value={date}
                  onChangeText={setDate}
                  placeholder="MM/DD/YYYY"
                />
              </View>
              <View style={styles.dateTimeInput}>
                <Text style={styles.formLabel}>Time</Text>
                <TextInput
                  style={styles.textInput}
                  value={time}
                  onChangeText={setTime}
                  placeholder="HH:MM"
                />
              </View>
            </View>

            <Text style={styles.formLabel}>Location</Text>
            <TextInput
              style={styles.textInput}
              value={location}
              onChangeText={setLocation}
              placeholder="Where will it be held?"
            />

            <Text style={styles.formLabel}>Max Attendees</Text>
            <TextInput
              style={styles.textInput}
              value={maxAttendees}
              onChangeText={setMaxAttendees}
              placeholder="How many people can attend?"
              keyboardType="numeric"
            />

            <View style={styles.modalActions}>
              <Pressable onPress={onClose} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSubmit} style={styles.submitButton}>
                <Text style={styles.submitButtonText}>Create Event</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
