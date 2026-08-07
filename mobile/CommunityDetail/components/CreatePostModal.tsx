import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '../styles';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (postData: any) => void;
}

export default function CreatePostModal({ 
  isOpen, 
  onClose, 
  onSubmit 
}: CreatePostModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleSubmit = () => {
    console.log('TODO: Create post with data:', { title, content, selectedImage });
    onSubmit?.({ title, content, selectedImage });
    setTitle('');
    setContent('');
    setSelectedImage(null);
    onClose();
  };

  const handleImageSelect = () => {
    console.log('TODO: Open image picker');
    // Mock image selection
    setSelectedImage('https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=200&fit=crop');
  };

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        {/* Modern Header with Gradient */}
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderContent}>
            <Pressable onPress={onClose} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseButtonText}>✕</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Create Post</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>
        
        <ScrollView 
          style={styles.modalContent}
          contentContainerStyle={styles.modalContentContainer}
        >
          <View style={styles.createForm}>
            <Text style={styles.formLabel}>Post Title</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="What's on your mind?"
              multiline
            />

            <Text style={styles.formLabel}>Content</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={content}
              onChangeText={setContent}
              placeholder="Share your thoughts with the community..."
              multiline
              numberOfLines={6}
            />

            <Text style={styles.formLabel}>Add Media (Optional)</Text>
            <Pressable onPress={handleImageSelect} style={styles.imageSelectButton}>
              {selectedImage ? (
                <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>📷 Add Photo</Text>
                </View>
              )}
            </Pressable>

            <View style={styles.modalActions}>
              <Pressable onPress={onClose} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSubmit} style={styles.submitButton}>
                <Text style={styles.submitButtonText}>Post to Community</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
