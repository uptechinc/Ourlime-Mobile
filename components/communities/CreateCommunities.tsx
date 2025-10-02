import React, { SetStateAction, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  // Platform,  <-- (Potentially needed if you want to handle platform-specific logic)
} from "react-native";

// ---------------------------------------------------------------------------
// NOTE: The following Firebase-related imports are commented out to focus on UI.
//
// import { uploadFile } from '@/helpers/firebaseStorage';
// import { db } from '@/lib/firebaseConfig';
// import { addDoc, collection } from 'firebase/firestore';
// import { getAuth } from 'firebase/auth';
// ---------------------------------------------------------------------------

// Create a placeholder or a type for Communities if you have it in your RN project
// interface Communities {
//   id: string;
//   name: string;
//   communityImage: string;
//   memberCount: number;
//   members: string[];
//   category: string;
//   isPublic: boolean;
//   posts: any[];
// }

interface CreateCommunitiesProps {
  setToggleCommunityForm: React.Dispatch<SetStateAction<boolean>>;
  setCommunities: React.Dispatch<SetStateAction<any[]>>; // or React.Dispatch<SetStateAction<Communities[]>>
}

export default function CreateCommunities({
  setToggleCommunityForm,
  setCommunities,
}: CreateCommunitiesProps) {
  const [communityName, setCommunityName] = useState<string>("");
  const [communityImage, setCommunityImage] = useState<any>(null); // In RN, you typically handle images differently
  const [category, setCategory] = useState<string>("");
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);

  // In React Native, you’d often use ImagePicker or a similar library to pick images
  const fileInputRef = useRef(null);

  const closeForm = () => {
    setToggleCommunityForm((prev: boolean) => !prev);
  };

  const handleCreateCommunity = async () => {
    if (!communityName || !category || !communityImage) {
      Alert.alert("Error", "All fields are required.");
      return;
    }

    setLoading(true);
    try {
      // ---------------------------------------------------------------------------
      // NOTE: In a React Native environment, you'd handle image upload with a library
      // or a custom function. For example, using react-native-image-picker or expo-image-picker.
      // We'll hash out the Firebase calls here to focus on UI:
      //
      // const auth = getAuth();
      // const currentUser = auth.currentUser;
      // if (!currentUser) {
      //   Alert.alert('Error', 'You must be logged in to create a community.');
      //   setLoading(false);
      //   return;
      // }
      //
      // // 1) Upload the community image
      // const imageUrl = await uploadFile(communityImage, `images/communities/thumbnails/${communityImage.name}`);
      //
      // // 2) Create the new community object
      // const newCommunity: Omit<Communities, 'id'> = {
      //   name: communityName,
      //   communityImage: imageUrl,
      //   memberCount: 1,
      //   members: [currentUser.uid],
      //   category: category,
      //   isPublic: isPublic,
      //   posts: []
      // };
      //
      // // 3) Save to Firestore
      // const docRef = await addDoc(collection(db, 'communities'), newCommunity);
      //
      // // 4) Update local state
      // setCommunities((prev) => [...prev, { ...newCommunity, id: docRef.id }]);
      // ---------------------------------------------------------------------------

      // Simulate success
      Alert.alert("Success", "Community created successfully!");
      setLoading(false);
      setToggleCommunityForm(false);

      // Example local state update (no actual image upload)
      setCommunities((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          name: communityName,
          communityImage: "https://picsum.photos/200", // Placeholder
          memberCount: 1,
          members: ["dummyUserId"],
          category: category,
          isPublic: isPublic,
          posts: [],
        },
      ]);
    } catch (error) {
      Alert.alert("Error", "Error creating community. Please try again.");
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  // In RN, you'd typically open an ImagePicker here. We’ll just store a dummy file reference for now.
  const handleImageChange = () => {
    // e.g., launching an Image Picker and setting the result to `communityImage`
    // setCommunityImage(resultFromImagePicker);
    Alert.alert(
      "Image",
      "In React Native, use an image picker library to select images."
    );
  };

  // We’ll render this as a Modal or a direct view. Adjust as needed:
  return (
    <Modal
      transparent
      animationType="slide"
      visible={true}
      onRequestClose={closeForm}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            backgroundColor: "#fff",
            marginHorizontal: 20,
            borderRadius: 8,
            padding: 16,
            // Optionally give a maxHeight to allow scrolling inside
          }}
        >
          {/* HEADER */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <TouchableOpacity
              onPress={closeForm}
              style={{
                padding: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  color: "#444",
                }}
              >
                X
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCreateCommunity}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor: "#28A745",
                borderRadius: 4,
              }}
              disabled={loading}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 16,
                }}
              >
                {loading ? "Creating..." : "Create Community"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* COMMUNITY NAME */}
          <View
            style={{
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                marginBottom: 8,
                color: "#444",
                fontWeight: "600",
              }}
            >
              Community Name
            </Text>
            <TextInput
              style={{
                height: 40,
                borderColor: "#CCC",
                borderWidth: 1,
                borderRadius: 4,
                paddingHorizontal: 8,
              }}
              placeholder="Enter community name"
              value={communityName}
              onChangeText={(text) => setCommunityName(text)}
            />
          </View>

          {/* COMMUNITY IMAGE */}
          <View
            style={{
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                marginBottom: 8,
                color: "#444",
                fontWeight: "600",
              }}
            >
              Community Image
            </Text>
            <TouchableOpacity
              onPress={handleImageChange}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                backgroundColor: "#007AFF",
                borderRadius: 4,
                alignSelf: "flex-start",
              }}
            >
              <Text
                style={{
                  color: "#fff",
                }}
              >
                Upload Image
              </Text>
            </TouchableOpacity>

            {communityImage && (
              <View
                style={{
                  marginTop: 12,
                  alignItems: "flex-start",
                }}
              >
                {/* 
                  If you actually had a local URI from an image picker:
                  <Image
                    source={{ uri: communityImage?.uri }}
                    style={styles.imagePreview}
                  />
                */}
                <Image
                  source={{ uri: "https://picsum.photos/200" }}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 6,
                    resizeMode: "cover",
                  }}
                />
              </View>
            )}
          </View>

          {/* CATEGORY */}
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                marginBottom: 8,
                color: "#444",
                fontWeight: "600",
              }}
            >
              Category
            </Text>
            <TextInput
              style={{
                height: 40,
                borderColor: "#CCC",
                borderWidth: 1,
                borderRadius: 4,
                paddingHorizontal: 8,
              }}
              placeholder="Enter community category"
              value={category}
              onChangeText={(text) => setCategory(text)}
            />
          </View>

          {/* PRIVACY TOGGLE (Optional) */}
          <View
            style={[
              {
                marginBottom: 16,
              },
              { flexDirection: "row", alignItems: "center" },
            ]}
          >
            <TouchableOpacity
              onPress={() => setIsPublic(!isPublic)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                backgroundColor: "#6c757d",
                borderRadius: 4,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                }}
              >
                {isPublic ? "Public" : "Private"}
              </Text>
            </TouchableOpacity>
            <Text style={{ marginLeft: 8 }}>
              {isPublic
                ? "Community is publicly visible"
                : "Community is private and requires approval"}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// // Basic example styling. Customize to match your brand/theme.
// const styles = StyleSheet.create({
//   modalOverlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.4)',
//     justifyContent: 'center',
//   },
//   formContainer: {
//     backgroundColor: '#fff',
//     marginHorizontal: 20,
//     borderRadius: 8,
//     padding: 16,
//     // Optionally give a maxHeight to allow scrolling inside
//   },
//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginBottom: 16,
//   },
//   closeButton: {
//     padding: 8,
//   },
//   closeButtonText: {
//     fontSize: 18,
//     color: '#444',
//   },
//   createButton: {
//     paddingVertical: 8,
//     paddingHorizontal: 12,
//     backgroundColor: '#28A745',
//     borderRadius: 4,
//   },
//   createButtonText: {
//     color: '#fff',
//     fontSize: 16,
//   },
//   inputWrapper: {
//     marginBottom: 16,
//   },
//   label: {
//     marginBottom: 8,
//     color: '#444',
//     fontWeight: '600',
//   },
//   input: {
//     height: 40,
//     borderColor: '#CCC',
//     borderWidth: 1,
//     borderRadius: 4,
//     paddingHorizontal: 8,
//   },
//   uploadButton: {
//     paddingVertical: 10,
//     paddingHorizontal: 12,
//     backgroundColor: '#007AFF',
//     borderRadius: 4,
//     alignSelf: 'flex-start',
//   },
//   uploadButtonText: {
//     color: '#fff',
//   },
//   previewContainer: {
//     marginTop: 12,
//     alignItems: 'flex-start',
//   },
//   imagePreview: {
//     width: 100,
//     height: 100,
//     borderRadius: 6,
//     resizeMode: 'cover',
//   },
//   publicToggle: {
//     paddingVertical: 6,
//     paddingHorizontal: 10,
//     backgroundColor: '#6c757d',
//     borderRadius: 4,
//   },
//   publicToggleText: {
//     color: '#fff',
//   },
// });
