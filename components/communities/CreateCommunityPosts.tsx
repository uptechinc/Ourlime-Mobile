import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ---------------------------------------------------------------------------
// NOTE: The following Firebase imports and references are commented out.
//       Uncomment and adapt for your RN project when integrating backend.
//
// import { auth, db, storage } from '@/lib/firebaseConfig';
// import { addDoc, collection } from 'firebase/firestore';
// import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
// ---------------------------------------------------------------------------

// TYPES (Adjust as needed)
interface CreatePostProp {
  setTogglePostForm: React.Dispatch<React.SetStateAction<boolean>>;
  profilePicture: string;
  communityVariantId: string; // Add community variant ID prop
}

export default function CreateCommunityPost({
  setTogglePostForm,
  profilePicture,
  communityVariantId,
}: CreatePostProp) {
  const [caption, setCaption] = useState("");
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<
    "public" | "private" | "friends"
  >("public");

  // In React Native, you can't directly select multiple files with an <input>.
  // Typically, you'd integrate a library for picking images/videos.
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // Closes the modal
  const handleClose = () => {
    setTogglePostForm(false);
  };

  // Stubbed out method to simulate "selecting files"
  const handleFileSelect = async () => {
    Alert.alert(
      "Select Media",
      "Use an image picker library here to choose images/videos."
    );
    // Example pseudo-logic:
    // const result = await launchImagePicker();
    // if (!result.canceled) {
    //   const newFiles = result.assets;
    //   setSelectedFiles([...selectedFiles, ...newFiles]);
    //   setPreviews([...previews, ...newFiles.map(file => file.uri)]);
    // }
  };

  // Remove file from selected list
  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles];
    const newPreviews = [...previews];
    newFiles.splice(index, 1);
    newPreviews.splice(index, 1);

    setSelectedFiles(newFiles);
    setPreviews(newPreviews);
  };

  // Create post action (Firebase logic hashed out)
  const handlePost = async () => {
    // In a React Native environment, you'd do something like:
    // if (!auth.currentUser) return;

    try {
      // -----------------------------------------------------------------------
      // // 1) Create the main post data
      // const postData = {
      //   title,
      //   caption,
      //   visibility,
      //   createdAt: new Date(),
      //   userId: auth.currentUser.uid,
      //   communityVariantId,
      // };
      //
      // // 2) Add the post to communityVariantDetails
      // const postRef = collection(db, 'communityVariantDetails');
      // const docRef = await addDoc(postRef, postData);
      //
      // // 3) Upload selected files
      // if (selectedFiles.length > 0) {
      //   const uploadPromises = selectedFiles.map(async (file) => {
      //     const storageRef = ref(storage, `communityPosts/${docRef.id}/${file.fileName}`);
      //     const uploadResult = await uploadBytes(storageRef, file);
      //     const downloadURL = await getDownloadURL(uploadResult.ref);
      //
      //     const summaryData = {
      //       type: file.type.split('/')[0],
      //       typeUrl: downloadURL,
      //       communityVariantDetailsId: docRef.id,
      //     };
      //     await addDoc(collection(db, 'communityVariantDetailsSummary'), summaryData);
      //   });
      //   await Promise.all(uploadPromises);
      // }
      // -----------------------------------------------------------------------

      // Simulate success for UI
      Alert.alert(
        "Post Created",
        "Your community post has been created successfully!"
      );

      // Reset fields
      setCaption("");
      setTitle("");
      setSelectedFiles([]);
      setPreviews([]);
      setVisibility("public");
      setTogglePostForm(false);
    } catch (error) {
      console.error("Error creating post:", error);
      Alert.alert("Error", "Error creating post. Please try again.");
    }
  };

  return (
    <Modal transparent visible onRequestClose={handleClose}>
      {/* Outer overlay */}
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
        }}
      >
        {/* Inner container */}
        <View
          style={{
            backgroundColor: "#fff",
            marginHorizontal: 16,
            borderRadius: 12,
            padding: 16,
            maxHeight: "90%",
          }}
        >
          {/* Close button */}
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              padding: 6,
              zIndex: 10,
            }}
            onPress={handleClose}
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

          {/* Header (Profile, Visibility) */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Image
              source={{ uri: profilePicture }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: "#ccc",
              }}
              resizeMode="cover"
            />
            <View style={{ marginLeft: 10 }}>
              <Text
                style={{
                  fontWeight: "600",
                  fontSize: 16,
                  marginBottom: 4,
                }}
              >
                Create Post
              </Text>
              {/* Simple text-based "Picker" for visibility */}
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={{
                    marginRight: 6,
                    fontSize: 14,
                    color: "#555",
                  }}
                >
                  Visibility:
                </Text>
                <TouchableOpacity
                  style={[
                    {
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      marginRight: 6,
                      backgroundColor: "#e0e0e0",
                      borderRadius: 4,
                    },
                    visibility === "public" && {
                      backgroundColor: "#4caf50",
                    },
                  ]}
                  onPress={() => setVisibility("public")}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#fff",
                    }}
                  >
                    Public
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    {
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      marginRight: 6,
                      backgroundColor: "#e0e0e0",
                      borderRadius: 4,
                    },
                    visibility === "private" && {
                      backgroundColor: "#4caf50",
                    },
                  ]}
                  onPress={() => setVisibility("private")}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#fff",
                    }}
                  >
                    Private
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    {
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      marginRight: 6,
                      backgroundColor: "#e0e0e0",
                      borderRadius: 4,
                    },
                    visibility === "friends" && {
                      backgroundColor: "#4caf50",
                    },
                  ]}
                  onPress={() => setVisibility("friends")}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#fff",
                    }}
                  >
                    Friends Only
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Title input */}
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: "#ccc",
              borderRadius: 6,
              paddingHorizontal: 10,
              paddingVertical: 8,
              marginBottom: 6,
              fontSize: 14,
            }}
            placeholder="Add a title..."
            value={title}
            onChangeText={setTitle}
          />

          {/* Caption input */}
          <TextInput
            style={[
              {
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 6,
                paddingHorizontal: 10,
                paddingVertical: 8,
                marginBottom: 6,
                fontSize: 14,
              },
              { marginBottom: 10 },
            ]}
            placeholder="Add a caption..."
            value={caption}
            onChangeText={setCaption}
          />

          {/* File select area */}
          <View
            style={{
              borderWidth: 2,
              borderStyle: "dashed",
              borderRadius: 8,
              borderColor: "#ccc",
              padding: 16,
              alignItems: "center",
              marginTop: 8,
            }}
          >
            <TouchableOpacity
              style={{
                backgroundColor: "#eee",
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 6,
                marginBottom: 8,
              }}
              onPress={handleFileSelect}
            >
              <Text
                style={{
                  color: "#333",
                  fontSize: 14,
                }}
              >
                Browse Files
              </Text>
            </TouchableOpacity>
            <Text
              style={{
                color: "#777",
                fontSize: 12,
              }}
            >
              or drag & drop media files here
            </Text>
          </View>

          {/* Previews */}
          {previews.length > 0 && (
            <FlatList
              data={previews}
              keyExtractor={(_, index) => index.toString()}
              numColumns={3}
              columnWrapperStyle={{ justifyContent: "flex-start" }}
              style={{ marginVertical: 10 }}
              renderItem={({ item, index }) => (
                <View
                  style={{
                    position: "relative",
                    marginRight: 8,
                    marginBottom: 8,
                  }}
                >
                  <Image
                    source={{ uri: item }}
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: 6,
                    }}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
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
                    onPress={() => removeFile(index)}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 14,
                      }}
                    >
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}

          {/* Post button */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              marginTop: 16,
            }}
          >
            <TouchableOpacity
              style={{
                backgroundColor: "#4caf50",
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 6,
              }}
              onPress={handlePost}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 14,
                }}
              >
                Post
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Example styles
// const styles = StyleSheet.create({
//   overlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     justifyContent: 'center',
//   },
//   container: {
//     backgroundColor: '#fff',
//     marginHorizontal: 16,
//     borderRadius: 12,
//     padding: 16,
//     maxHeight: '90%',
//   },
//   closeButton: {
//     position: 'absolute',
//     top: 10,
//     right: 10,
//     padding: 6,
//     zIndex: 10,
//   },
//   closeButtonText: {
//     fontSize: 22,
//     color: '#666',
//   },
//   headerRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 16,
//   },
//   profileImage: {
//     width: 48,
//     height: 48,
//     borderRadius: 24,
//     backgroundColor: '#ccc',
//   },
//   titleText: {
//     fontWeight: '600',
//     fontSize: 16,
//     marginBottom: 4,
//   },
//   label: {
//     marginRight: 6,
//     fontSize: 14,
//     color: '#555',
//   },
//   visibilityOption: {
//     paddingHorizontal: 8,
//     paddingVertical: 4,
//     marginRight: 6,
//     backgroundColor: '#e0e0e0',
//     borderRadius: 4,
//   },
//   activeOption: {
//     backgroundColor: '#4caf50',
//   },
//   visibilityText: {
//     fontSize: 12,
//     color: '#fff',
//   },
//   input: {
//     borderWidth: 1,
//     borderColor: '#ccc',
//     borderRadius: 6,
//     paddingHorizontal: 10,
//     paddingVertical: 8,
//     marginBottom: 6,
//     fontSize: 14,
//   },
//   fileDropArea: {
//     borderWidth: 2,
//     borderStyle: 'dashed',
//     borderRadius: 8,
//     borderColor: '#ccc',
//     padding: 16,
//     alignItems: 'center',
//     marginTop: 8,
//   },
//   browseButton: {
//     backgroundColor: '#eee',
//     paddingHorizontal: 14,
//     paddingVertical: 8,
//     borderRadius: 6,
//     marginBottom: 8,
//   },
//   browseButtonText: {
//     color: '#333',
//     fontSize: 14,
//   },
//   dropAreaText: {
//     color: '#777',
//     fontSize: 12,
//   },
//   previewContainer: {
//     position: 'relative',
//     marginRight: 8,
//     marginBottom: 8,
//   },
//   previewImage: {
//     width: 90,
//     height: 90,
//     borderRadius: 6,
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
//   removePreviewButtonText: {
//     color: '#fff',
//     fontSize: 14,
//   },
//   postButton: {
//     backgroundColor: '#4caf50',
//     paddingHorizontal: 16,
//     paddingVertical: 8,
//     borderRadius: 6,
//   },
//   postButtonText: {
//     color: '#fff',
//     fontSize: 14,
//   },
// });
