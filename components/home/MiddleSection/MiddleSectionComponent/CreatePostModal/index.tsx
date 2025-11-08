import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  Dimensions,
  KeyboardAvoidingView,
  Animated,
} from "react-native";
import {
  X,
  Type,
  Hash,
  Video,
  Globe,
  Users,
  Lock,
  ImageIcon,
  Smile,
  Send,
  Sparkles,
} from "lucide-react-native";
// import { storage } from '@/lib/firebaseConfig';
// import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
// import { useProfileStore } from '@/src/store/useProfileStore';
import { Caption } from "./components/Content/Caption/Caption";
import { Description } from "./components/Content/Description/Description";
import { Poll } from "./components/Content/Poll/Poll";
import { MediaUpload } from "./components/Content/MediaUpload/MediaUpload";
import { Hashtags } from "./components/Content/Hashtags/Hashtags";
import * as ImagePicker from "expo-image-picker";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

interface Friend {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
}

interface MediaItem {
  type: "image" | "video";
  typeUrl: string;
  fileName: string;
}

interface PostData {
  userId: string;
  type: "regular" | "poll";
  caption: string;
  description: string;
  visibility: string;
  hashtags: string[];
  mentions: string[];
  friendReferences: string[];
  media?: MediaItem[];
  pollData?: {
    options: { id: string; text: string }[];
    duration: number;
    image: string | null;
    endTime: Date;
  };
}

interface ReelData {
  userId: string;
  type: "reel";
  visibility: string;
  media: {
    type: "video";
    typeUrl: string;
    fileName: string;
    duration: number;
  };
}

interface CreatePostModalProps {
  setTogglePostForm: React.Dispatch<React.SetStateAction<boolean>>;
  profilePicture: string;
  onCreatePost: () => void;
}

const { height: SCREEN_HEIGHT} = Dimensions.get("window");

export default function CreatePostModal({
  setTogglePostForm,
  profilePicture,
  onCreatePost,
}: CreatePostModalProps) {
  // const userId = useProfileStore(state => state.id);
  const userId = "TODO_USER_ID"; // TODO: Replace with actual user id from store

  // Post Type State
  const [postType, setPostType] = useState<"regular" | "poll" | "reel">(
    "regular"
  );
  const [visibility, setVisibility] = useState("public");

  // Content States
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);

  // Media States
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]); // TODO: Use react-native-image-picker or similar
  const [previews, setPreviews] = useState<string[]>([]);
  const [videoDuration, setVideoDuration] = useState<number>(0);

  // Poll States
  const [pollOptions, setPollOptions] = useState([
    { id: "1", text: "" },
    { id: "2", text: "" },
  ]);
  const [pollDuration, setPollDuration] = useState("24");
  const [pollImage, setPollImage] = useState<string | null>(null);

  // Hashtag States
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");

  // Friends List State
  const [friendsList, setFriendsList] = useState<Friend[]>([]);

  // Submit State
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // TODO: Fetch friends from API or local store for React Native
    // setFriendsList([]);
  }, [userId]);

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission needed",
            "Sorry, we need camera roll permissions to make this work!"
          );
        }
      }
    })();
  }, []);

  const handleFileSelect = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:
          postType === "reel"
            ? ImagePicker.MediaTypeOptions.Videos
            : ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: postType !== "reel",
        quality: 0.8,
        videoMaxDuration: postType === "reel" ? 60 : undefined,
      });

      if (!result.canceled && result.assets) {
        const newFiles = result.assets.map((asset) => ({
          uri: asset.uri,
          type:
            asset.type ||
            (asset.uri.includes(".mp4") || asset.uri.includes(".mov")
              ? "video"
              : "image"),
          fileName:
            asset.fileName ||
            `file_${Date.now()}.${asset.type === "video" ? "mp4" : "jpg"}`,
          fileSize: asset.fileSize,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
        }));

        setSelectedFiles((prev) => [...prev, ...newFiles]);
        setPreviews((prev) => [...prev, ...newFiles.map((f) => f.uri)]);

        if (postType === "reel" && newFiles[0]?.duration) {
          setVideoDuration(newFiles[0].duration);
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const handlePost = async () => {
    if (isPostDisabled) {
      Alert.alert(
        "Invalid Post",
        "Please add some content to your post before submitting."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const postData: PostData | ReelData =
        postType === "reel"
          ? {
              userId,
              type: "reel",
              visibility,
              media: {
                type: "video",
                typeUrl: selectedFiles[0]?.uri || "",
                fileName: selectedFiles[0]?.fileName || "",
                duration: videoDuration,
              },
            }
          : {
              userId,
              type: postType,
              caption,
              description,
              visibility,
              hashtags,
              mentions: selectedMentions,
              friendReferences: [],
              media: selectedFiles.map((file) => ({
                type: file.type === "video" ? "video" : "image",
                typeUrl: file.uri,
                fileName: file.fileName || "",
              })),
              ...(postType === "poll" && {
                pollData: {
                  options: pollOptions.filter((opt) => opt.text.trim()),
                  duration: parseInt(pollDuration),
                  image: pollImage,
                  endTime: new Date(
                    Date.now() + parseInt(pollDuration) * 60 * 60 * 1000
                  ),
                },
              }),
            };

      // TODO: Replace with actual API call
      // const response = await fetch('/api/posts/create', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify(postData),
      // });

      // For now, simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("Post created:", postData);
      Alert.alert("Success", "Your post has been created!", [
        {
          text: "OK",
          onPress: () => {
            setTogglePostForm(false);
            onCreatePost?.();
            // Reset form
            setCaption("");
            setDescription("");
            setSelectedFiles([]);
            setPreviews([]);
            setHashtags([]);
            setSelectedMentions([]);
            setPostType("regular");
            setVisibility("public");
          },
        },
      ]);
    } catch (error) {
      console.error("Error creating post:", error);
      Alert.alert("Error", "Failed to create post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPostDisabled =
    postType === "reel"
      ? !selectedFiles.length
      : !caption &&
        !description &&
        !selectedFiles.length &&
        (postType === "poll"
          ? !pollOptions.some((opt) => opt.text.trim())
          : false);

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setTogglePostForm(false)}
    >
      <SafeAreaView style={{ flex: 1}}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          {/* Blurred Background Overlay */}
          <BlurView
            intensity={30}
            tint="dark"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setTogglePostForm(false)}
            />
          </BlurView>

          {/* Modal Container */}
          <View
            style={{
              flex: 1,
              backgroundColor: "#ffffff",
            }}
          >
              {/* Header */}
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingTop: Platform.OS === "ios" ? 20 : 16,
                  paddingBottom: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: "#F3F4F6",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 16,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setTogglePostForm(false)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: "#F9FAFB",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={20} color="#6B7280" />
                  </TouchableOpacity>

                  <View style={{ flex: 1, alignItems: "center" }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "700",
                        color: "#111827",
                      }}
                    >
                      {postType === "reel"
                        ? "Create Reel"
                        : postType === "poll"
                        ? "Create Poll"
                        : "Create Post"}
                    </Text>
                  </View>

                  <View style={{ width: 40 }} />
                </View>

                {/* Post Type Selector */}
                <View
                  style={{
                    flexDirection: "row",
                    backgroundColor: "#F9FAFB",
                    borderRadius: 16,
                    padding: 4,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setPostType("regular")}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor:
                        postType === "regular" ? "#FFFFFF" : "transparent",
                      shadowColor:
                        postType === "regular" ? "#10B981" : "transparent",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: postType === "regular" ? 2 : 0,
                    }}
                  >
                    <Type
                      size={16}
                      color={postType === "regular" ? "#10B981" : "#9CA3AF"}
                    />
                    <Text
                      style={{
                        marginLeft: 6,
                        fontSize: 13,
                        fontWeight: "600",
                        color: postType === "regular" ? "#10B981" : "#9CA3AF",
                      }}
                    >
                      Post
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setPostType("poll")}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor:
                        postType === "poll" ? "#FFFFFF" : "transparent",
                      shadowColor:
                        postType === "poll" ? "#10B981" : "transparent",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: postType === "poll" ? 2 : 0,
                    }}
                  >
                    <Hash
                      size={16}
                      color={postType === "poll" ? "#10B981" : "#9CA3AF"}
                    />
                    <Text
                      style={{
                        marginLeft: 6,
                        fontSize: 13,
                        fontWeight: "600",
                        color: postType === "poll" ? "#10B981" : "#9CA3AF",
                      }}
                    >
                      Poll
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setPostType("reel")}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor:
                        postType === "reel" ? "#FFFFFF" : "transparent",
                      shadowColor:
                        postType === "reel" ? "#10B981" : "transparent",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: postType === "reel" ? 2 : 0,
                    }}
                  >
                    <Video
                      size={16}
                      color={postType === "reel" ? "#10B981" : "#9CA3AF"}
                    />
                    <Text
                      style={{
                        marginLeft: 6,
                        fontSize: 13,
                        fontWeight: "600",
                        color: postType === "reel" ? "#10B981" : "#9CA3AF",
                      }}
                    >
                      Reel
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Scrollable Content */}
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                  paddingBottom: 120,
                  flexGrow: 1,
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                {/* User Profile Card */}
                <View
                  style={{
                    marginHorizontal: 20,
                    marginTop: 16,
                    backgroundColor: "#F9FAFB",
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      overflow: "hidden",
                      borderWidth: 3,
                      borderColor: "#10B981",
                    }}
                  >
                    <Image
                      source={{ uri: profilePicture }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#111827",
                        marginBottom: 8,
                      }}
                    >
                      You
                    </Text>
                    {/* Visibility Selector */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => setVisibility("public")}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 20,
                          backgroundColor:
                            visibility === "public" ? "#DBEAFE" : "#F3F4F6",
                          borderWidth: 1,
                          borderColor:
                            visibility === "public" ? "#3B82F6" : "transparent",
                        }}
                      >
                        <Globe
                          size={12}
                          color={
                            visibility === "public" ? "#3B82F6" : "#6B7280"
                          }
                        />
                        <Text
                          style={{
                            marginLeft: 4,
                            fontSize: 11,
                            fontWeight: "600",
                            color:
                              visibility === "public" ? "#3B82F6" : "#6B7280",
                          }}
                        >
                          Public
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setVisibility("friends")}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 20,
                          backgroundColor:
                            visibility === "friends" ? "#ECFDF5" : "#F3F4F6",
                          borderWidth: 1,
                          borderColor:
                            visibility === "friends"
                              ? "#10B981"
                              : "transparent",
                        }}
                      >
                        <Users
                          size={12}
                          color={
                            visibility === "friends" ? "#10B981" : "#6B7280"
                          }
                        />
                        <Text
                          style={{
                            marginLeft: 4,
                            fontSize: 11,
                            fontWeight: "600",
                            color:
                              visibility === "friends" ? "#10B981" : "#6B7280",
                          }}
                        >
                          Friends
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setVisibility("private")}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 20,
                          backgroundColor:
                            visibility === "private" ? "#FEF2F2" : "#F3F4F6",
                          borderWidth: 1,
                          borderColor:
                            visibility === "private"
                              ? "#EF4444"
                              : "transparent",
                        }}
                      >
                        <Lock
                          size={12}
                          color={
                            visibility === "private" ? "#EF4444" : "#6B7280"
                          }
                        />
                        <Text
                          style={{
                            marginLeft: 4,
                            fontSize: 11,
                            fontWeight: "600",
                            color:
                              visibility === "private" ? "#EF4444" : "#6B7280",
                          }}
                        >
                          Private
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Content Section */}
                <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                  {postType === "reel" ? (
                    <View>
                      <MediaUpload
                        selectedFiles={selectedFiles}
                        previews={previews}
                        onFilesSelect={handleFileSelect}
                        onFileRemove={(index) => {
                          setSelectedFiles((prev) =>
                            prev.filter((_, i) => i !== index)
                          );
                          setPreviews((prev) =>
                            prev.filter((_, i) => i !== index)
                          );
                        }}
                        isReel={true}
                      />
                      {selectedFiles.length > 0 && (
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: 14,
                            backgroundColor: "#F9FAFB",
                            borderRadius: 12,
                            marginTop: 12,
                            borderWidth: 1,
                            borderColor: "#E5E7EB",
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <Video size={16} color="#10B981" />
                            <Text
                              style={{
                                marginLeft: 8,
                                fontSize: 13,
                                fontWeight: "600",
                                color: "#374151",
                              }}
                            >
                              Duration: {Math.round(videoDuration)}s
                            </Text>
                          </View>
                          {selectedFiles[0]?.fileSize && (
                            <Text
                              style={{
                                fontSize: 13,
                                color: "#6B7280",
                              }}
                            >
                              {(
                                selectedFiles[0].fileSize /
                                (1024 * 1024)
                              ).toFixed(2)}{" "}
                              MB
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  ) : (
                    <>
                      {/* Text Post Section */}
                      <Caption caption={caption} onCaptionChange={setCaption} />

                      <Description
                        description={description}
                        friendsList={friendsList}
                        selectedMentions={selectedMentions}
                        onDescriptionChange={setDescription}
                        onMentionAdd={(userName) =>
                          setSelectedMentions((prev) => [...prev, userName])
                        }
                        onMentionRemove={(userName) =>
                          setSelectedMentions((prev) =>
                            prev.filter((m) => m !== userName)
                          )
                        }
                      />

                      {/* Image Upload Section */}
                      {postType === "poll" ? (
                        <Poll
                          pollOptions={pollOptions}
                          pollDuration={pollDuration}
                          pollImage={pollImage}
                          onOptionAdd={() =>
                            setPollOptions((prev) => [
                              ...prev,
                              { id: String(prev.length + 1), text: "" },
                            ])
                          }
                          onOptionRemove={(id) =>
                            setPollOptions((prev) =>
                              prev.filter((opt) => opt.id !== id)
                            )
                          }
                          onOptionUpdate={(id, text) =>
                            setPollOptions((prev) =>
                              prev.map((opt) =>
                                opt.id === id ? { ...opt, text } : opt
                              )
                            )
                          }
                          onDurationChange={setPollDuration}
                          onImageUpload={(file) => {
                            // TODO: Image upload logic
                          }}
                          onImageRemove={() => setPollImage(null)}
                        />
                      ) : (
                        <View style={{ marginBottom: 20 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginBottom: 12,
                            }}
                          >
                            <ImageIcon size={20} color="#10B981" />
                            <Text
                              style={{
                                marginLeft: 8,
                                fontSize: 16,
                                fontWeight: "600",
                                color: "#111827",
                              }}
                            >
                              Add Photos/Videos
                            </Text>
                          </View>
                          <MediaUpload
                            selectedFiles={selectedFiles}
                            previews={previews}
                            onFilesSelect={handleFileSelect}
                            onFileRemove={(index) => {
                              setSelectedFiles((prev) =>
                                prev.filter((_, i) => i !== index)
                              );
                              setPreviews((prev) =>
                                prev.filter((_, i) => i !== index)
                              );
                            }}
                          />
                        </View>
                      )}

                      <Hashtags
                        hashtags={hashtags}
                        hashtagInput={hashtagInput}
                        onHashtagInputChange={setHashtagInput}
                        onHashtagAdd={(tag) =>
                          setHashtags((prev) => [...prev, tag])
                        }
                        onHashtagRemove={(tag) =>
                          setHashtags((prev) => prev.filter((t) => t !== tag))
                        }
                      />
                    </>
                  )}
                </View>
              </ScrollView>

              {/* Fixed Footer with Action Button */}
              <View
                style={{
                    paddingHorizontal: 20,
                    paddingTop: 16,
                    paddingBottom: Platform.OS === "ios" ? 34 : 20,
                    borderTopWidth: 1,
                    borderTopColor: "#F3F4F6",
                    backgroundColor: "#FFFFFF",
                }}
              >
                <TouchableOpacity
                  onPress={handlePost}
                  disabled={isSubmitting || isPostDisabled}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 16,
                    paddingVertical: 16,
                    backgroundColor:
                      isSubmitting || isPostDisabled ? "#E5E7EB" : "#10B981",
                    shadowColor: "#10B981",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isPostDisabled ? 0 : 0.3,
                    shadowRadius: 8,
                    elevation: isPostDisabled ? 0 : 4,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <ActivityIndicator
                        size="small"
                        color="#FFFFFF"
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: 16,
                          fontWeight: "700",
                        }}
                      >
                        Posting...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Send
                        size={18}
                        color="#FFFFFF"
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: 16,
                          fontWeight: "700",
                        }}
                      >
                        {postType === "reel"
                          ? "Share Reel"
                          : postType === "poll"
                          ? "Create Poll"
                          : "Share Post"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
