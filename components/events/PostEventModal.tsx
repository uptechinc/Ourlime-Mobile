import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ---------------------------------------------------------------------------
// NOTE: The following Firebase references are commented out. Uncomment and
//       adapt them for your React Native project:
//
// import { db, auth, storage } from '@/lib/firebaseConfig';
// import { addDoc, collection, updateDoc, doc } from 'firebase/firestore';
// import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
// ---------------------------------------------------------------------------

interface PostEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  communityVariantId?: string;
}

export default function PostEventModal({
  isOpen,
  onClose,
  communityVariantId,
}: PostEventModalProps) {
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState("");
  const [summary, setSummary] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [recurrence, setRecurrence] = useState<string>("none");
  // const userId = auth.currentUser?.uid; // Example if using Firebase Auth

  const [selectedFiles, setSelectedFiles] = useState<any[]>([]); // Typically you'd store a URI from an image picker
  const [previews, setPreviews] = useState<string[]>([]);

  const recurrenceOptions = [
    { label: "One-time Event", value: "none" },
    { label: "Weekly", value: "weekly" },
    { label: "Monthly", value: "monthly" },
    { label: "Yearly", value: "yearly" },
  ];

  // Generate local previews if using base64 or local URIs
  useEffect(() => {
    // In React Native, you typically have file URIs from an image picker
    // For demonstration, we convert them into `previews` if needed
    if (selectedFiles.length > 0) {
      // If your selectedFiles have .uri property, you can do something like:
      setPreviews(selectedFiles.map((file) => file.uri)); // or file.base64
    } else {
      setPreviews([]);
    }
  }, [selectedFiles]);

  // Simulates file selection
  const handleFileSelect = async () => {
    Alert.alert("Select Image", "Use a React Native image picker here.");
    // Example pseudo-logic:
    // const result = await launchImagePicker();
    // if (!result.canceled) {
    //   setSelectedFiles([...selectedFiles, ...result.assets]);
    // }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Example: if you want to require fields
    if (!title || !summary || !startDate || !endDate || !location) {
      Alert.alert("Missing fields", "Please fill all required fields.");
      return;
    }
    try {
      // Example usage with Firestore:
      // let imageUrl = '';
      // if (selectedFiles.length > 0) {
      //   const file = selectedFiles[0];
      //   const storageRef = ref(storage, `eventImages/${Date.now()}_${file.fileName}`);
      //   const uploadResult = await uploadBytes(storageRef, file);
      //   imageUrl = await getDownloadURL(uploadResult.ref);
      // }

      // const eventData: any = {
      //   title,
      //   summary,
      //   startDate,
      //   endDate,
      //   location,
      //   recurrence,
      //   userId, // Or however you track the user
      //   ...(imageUrl && { image: imageUrl }),
      // };

      // if (communityVariantId) {
      //   eventData.communityVariantId = communityVariantId;
      // }

      // const eventRef = await addDoc(collection(db, 'events'), eventData);

      Alert.alert("Success", "Event created successfully!");
      // Reset form
      setTitle("");
      setDescription("");
      setSummary("");
      setStartDate("");
      setEndDate("");
      setLocation("");
      setRecurrence("none");
      setSelectedFiles([]);
      onClose();
    } catch (error) {
      console.error("Error adding event:", error);
      Alert.alert("Error", "Failed to add event. Please try again.");
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      transparent
      visible={isOpen}
      onRequestClose={onClose}
      animationType="slide"
    >
      {/* Overlay */}
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          padding: 16,
        }}
      >
        {/* Container */}
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 8,
            padding: 16,
            maxHeight: "90%",
            minWidth: "90%",
            alignSelf: "center",
          }}
        >
          {/* Close Button */}
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 2,
            }}
            onPress={onClose}
          >
            <Text
              style={{
                fontSize: 22,
                color: "#666",
              }}
            >
              ✕
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            Create Event
          </Text>

          <ScrollView
            style={{
              marginBottom: 16,
            }}
          >
            {/* Title */}
            <TextInput
              style={{
                borderColor: "#ccc",
                borderWidth: 1,
                borderRadius: 6,
                paddingHorizontal: 10,
                paddingVertical: 8,
                marginBottom: 12,
                fontSize: 14,
              }}
              placeholder="Event Title"
              value={title}
              onChangeText={setTitle}
            />

            {/* Summary */}
            <TextInput
              style={[
                {
                  borderColor: "#ccc",
                  borderWidth: 1,
                  borderRadius: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  marginBottom: 12,
                  fontSize: 14,
                },
                { height: 80 },
              ]}
              multiline
              placeholder="Event Summary"
              value={summary}
              onChangeText={setSummary}
            />

            {/* Location */}
            <TextInput
              style={{
                borderColor: "#ccc",
                borderWidth: 1,
                borderRadius: 6,
                paddingHorizontal: 10,
                paddingVertical: 8,
                marginBottom: 12,
                fontSize: 14,
              }}
              placeholder="Location"
              value={location}
              onChangeText={setLocation}
            />

            {/* Date Fields */}
            <Text
              style={{
                marginBottom: 4,
                color: "#333",
                fontWeight: "500",
                fontSize: 14,
              }}
            >
              Start Date
            </Text>
            <TouchableOpacity
              style={{
                borderColor: "#ccc",
                borderWidth: 1,
                borderRadius: 6,
                paddingHorizontal: 10,
                paddingVertical: 12,
                marginBottom: 12,
              }}
              onPress={() =>
                Alert.alert("Select Start Date", "Use a date picker")
              }
            >
              <Text style={{ color: startDate ? "#000" : "#999" }}>
                {startDate || "Select start date"}
              </Text>
            </TouchableOpacity>

            <Text
              style={{
                marginBottom: 4,
                color: "#333",
                fontWeight: "500",
                fontSize: 14,
              }}
            >
              End Date
            </Text>
            <TouchableOpacity
              style={{
                borderColor: "#ccc",
                borderWidth: 1,
                borderRadius: 6,
                paddingHorizontal: 10,
                paddingVertical: 12,
                marginBottom: 12,
              }}
              onPress={() =>
                Alert.alert("Select End Date", "Use a date picker")
              }
            >
              <Text style={{ color: endDate ? "#000" : "#999" }}>
                {endDate || "Select end date"}
              </Text>
            </TouchableOpacity>

            {/* Recurrence Option */}
            <Text
              style={{
                marginBottom: 4,
                color: "#333",
                fontWeight: "500",
                fontSize: 14,
              }}
            >
              Repeat Event
            </Text>
            <ScrollView
              horizontal
              style={{
                marginBottom: 12,
              }}
            >
              {recurrenceOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    {
                      borderColor: "#ccc",
                      borderWidth: 1,
                      borderRadius: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      marginRight: 8,
                    },
                    recurrence === option.value && {
                      backgroundColor: "#4caf50",
                      borderColor: "#4caf50",
                    },
                  ]}
                  onPress={() => setRecurrence(option.value)}
                >
                  <Text
                    style={{
                      color: recurrence === option.value ? "#fff" : "#333",
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* File upload section */}
            <View
              style={{
                borderWidth: 2,
                borderColor: "#ccc",
                borderStyle: "dashed",
                borderRadius: 6,
                padding: 16,
                alignItems: "center",
              }}
            >
              <TouchableOpacity
                onPress={handleFileSelect}
                style={{
                  backgroundColor: "#eee",
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 6,
                }}
              >
                <Text
                  style={{
                    color: "#333",
                  }}
                >
                  Upload event image
                </Text>
              </TouchableOpacity>

              {previews.length > 0 && (
                <ScrollView
                  horizontal
                  style={{
                    marginTop: 12,
                  }}
                >
                  {previews.map((preview, index) => (
                    <View
                      key={index}
                      style={{
                        position: "relative",
                        marginRight: 8,
                      }}
                    >
                      <Image
                        source={{ uri: preview }}
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 6,
                          backgroundColor: "#ccc",
                        }}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        onPress={() => removeFile(index)}
                        style={{
                          position: "absolute",
                          top: -6,
                          right: -6,
                          backgroundColor: "red",
                          borderRadius: 12,
                          width: 24,
                          height: 24,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#fff", fontWeight: "bold" }}>
                          ✕
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </ScrollView>

          {/* Submit button */}
          <TouchableOpacity
            style={{
              backgroundColor: "#90EE90",
              padding: 12,
              borderRadius: 6,
              alignItems: "center",
              alignSelf: "flex-end",
              marginTop: 4,
            }}
            onPress={handleSubmit}
          >
            <Text
              style={{
                color: "#000",
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              Post Event
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Basic example styling
// const styles = StyleSheet.create({
//   overlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     justifyContent: 'center',
//     padding: 16,
//   },
//   modalContainer: {
//     backgroundColor: '#fff',
//     borderRadius: 8,
//     padding: 16,
//     maxHeight: '90%',
//     minWidth: '90%',
//     alignSelf: 'center',
//   },
//   closeButton: {
//     position: 'absolute',
//     top: 8,
//     right: 8,
//     zIndex: 2,
//   },
//   closeButtonText: {
//     fontSize: 22,
//     color: '#666',
//   },
//   modalTitle: {
//     fontSize: 18,
//     fontWeight: '600',
//     textAlign: 'center',
//     marginBottom: 12,
//   },
//   scrollArea: {
//     marginBottom: 16,
//   },
//   input: {
//     borderColor: '#ccc',
//     borderWidth: 1,
//     borderRadius: 6,
//     paddingHorizontal: 10,
//     paddingVertical: 8,
//     marginBottom: 12,
//     fontSize: 14,
//   },
//   label: {
//     marginBottom: 4,
//     color: '#333',
//     fontWeight: '500',
//     fontSize: 14,
//   },
//   datePicker: {
//     borderColor: '#ccc',
//     borderWidth: 1,
//     borderRadius: 6,
//     paddingHorizontal: 10,
//     paddingVertical: 12,
//     marginBottom: 12,
//   },
//   recurrenceRow: {
//     marginBottom: 12,
//   },
//   recurrenceButton: {
//     borderColor: '#ccc',
//     borderWidth: 1,
//     borderRadius: 6,
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     marginRight: 8,
//   },
//   recurrenceButtonActive: {
//     backgroundColor: '#4caf50',
//     borderColor: '#4caf50',
//   },
//   fileUploadContainer: {
//     borderWidth: 2,
//     borderColor: '#ccc',
//     borderStyle: 'dashed',
//     borderRadius: 6,
//     padding: 16,
//     alignItems: 'center',
//   },
//   fileUploadButton: {
//     backgroundColor: '#eee',
//     paddingVertical: 10,
//     paddingHorizontal: 16,
//     borderRadius: 6,
//   },
//   fileUploadText: {
//     color: '#333',
//   },
//   previewScroll: {
//     marginTop: 12,
//   },
//   previewWrapper: {
//     position: 'relative',
//     marginRight: 8,
//   },
//   previewImage: {
//     width: 80,
//     height: 80,
//     borderRadius: 6,
//     backgroundColor: '#ccc',
//   },
//   removePreviewButton: {
//     position: 'absolute',
//     top: -6,
//     right: -6,
//     backgroundColor: 'red',
//     borderRadius: 12,
//     width: 24,
//     height: 24,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   submitButton: {
//     backgroundColor: '#90EE90',
//     padding: 12,
//     borderRadius: 6,
//     alignItems: 'center',
//     alignSelf: 'flex-end',
//     marginTop: 4,
//   },
//   submitButtonText: {
//     color: '#000',
//     fontWeight: '600',
//     fontSize: 14,
//   },
// });
