import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { styles } from '../styles';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (pollData: any) => void;
}

export default function CreatePollModal({ 
  isOpen, 
  onClose, 
  onSubmit 
}: CreatePollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [endDate, setEndDate] = useState('');

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = () => {
    console.log('TODO: Create poll with data:', { 
      question, 
      options: options.filter(opt => opt.trim() !== ''),
      endDate 
    });
    onSubmit?.({ question, options: options.filter(opt => opt.trim() !== ''), endDate });
    // Reset form
    setQuestion('');
    setOptions(['', '']);
    setEndDate('');
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
            <Text style={styles.modalTitle}>Create Poll</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>
        
        <ScrollView 
          style={styles.modalContent}
          contentContainerStyle={styles.modalContentContainer}
        >
          <View style={styles.createForm}>
            <Text style={styles.formLabel}>Poll Question</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={question}
              onChangeText={setQuestion}
              placeholder="What would you like to ask the community?"
              multiline
              numberOfLines={3}
            />

            <Text style={styles.formLabel}>Options</Text>
            {options.map((option, index) => (
              <View key={index} style={styles.pollOptionRow}>
                <TextInput
                  style={[styles.textInput, styles.pollOptionInput]}
                  value={option}
                  onChangeText={(value) => updateOption(index, value)}
                  placeholder={`Option ${index + 1}`}
                />
                {options.length > 2 && (
                  <Pressable 
                    onPress={() => removeOption(index)}
                    style={styles.removeOptionButton}
                  >
                    <Text style={styles.removeOptionText}>✕</Text>
                  </Pressable>
                )}
              </View>
            ))}

            {options.length < 6 && (
              <Pressable onPress={addOption} style={styles.addOptionButton}>
                <Text style={styles.addOptionText}>+ Add Option</Text>
              </Pressable>
            )}

            <Text style={styles.formLabel}>End Date (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="MM/DD/YYYY"
            />

            <View style={styles.modalActions}>
              <Pressable onPress={onClose} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSubmit} style={styles.submitButton}>
                <Text style={styles.submitButtonText}>Create Poll</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
