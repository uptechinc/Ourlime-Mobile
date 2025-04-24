import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
// import { Heart, MessageCircle, Trash2, X } from 'lucide-react-native'; // Example icon library
// import {
//   // Commented out Firebase stuff
//   addDoc,
//   collection,
//   query,
//   where,
//   getDocs,
//   deleteDoc,
//   onSnapshot,
//   writeBatch,
//   serverTimestamp,
//   increment,
//   doc,
//   updateDoc,
//   arrayRemove,
//   getDoc,
//   setDoc
// } from 'firebase/firestore';
// import { db, auth } from '@/lib/firebaseConfig';

// Placeholder sub-components (convert them to RN too)
import CreateCommunityPost from "@/components/communities/CreateCommunityPosts";
import CommunityPostCommentsModal from "@/components/communities/CommunityPostCommentsModal";
import PostEventModal from "@/components/events/PostEventModal";
import EventsList from "@/components/events/EventsList";
import EventCommentModal from "@/components/events/EventCommentModal";
import ConfirmationModal from "@/components/ConfirmationModal";
import PollModal from "@/components/PollModal";
import PollList from "@/components/PollList";

// Types: Replace or comment out if not used
// import { Community, CommunityMember } from '@/types/communityTypes';
// import { BasePost } from '@/types/userTypes';
// import { uploadFile } from '@/helpers/firebaseStorage';

const CommunityDetailScreen: React.FC = () => {
  const { id } = useLocalSearchParams();
  const communityVariantId = id ? String(id) : "";

  // If using Firebase Auth: const currentUserId = auth.currentUser?.uid;
  const currentUserId = "demoUserId"; // Temporary placeholder

  // State variables
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isEventCommentModalOpen, setIsEventCommentModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [isCommunityPostModalOpen, setIsCommunityPostModalOpen] =
    useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Just placeholders for the data you want to display
  const [members, setMembers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [likeCounts, setLikeCounts] = useState<{ [key: string]: number }>({});

  const [communityData, setCommunityData] = useState<any | null>(null);

  // Edit community states
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [communityImage, setCommunityImage] = useState<any>(null);

  // Confirmation modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string>("");
  const [modalAction, setModalAction] = useState<"remove" | "ban" | null>(null);

  // Banned check
  const [isBanned, setIsBanned] = useState(false);

  // Community-level likes
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // “Friends in Communities”
  const [friendsInCommunities, setFriendsInCommunities] = useState<
    {
      firstName: string;
      lastName: string;
      userName: string;
      communityIds: string[];
    }[]
  >([]);

  // ----------------------------------------
  // Example placeholders for loading data
  // ----------------------------------------
  const loadCommunityData = useCallback(async () => {
    // Example: You would fetch from your server or do a direct Firestore query
    // For now, just mock data
    setCommunityData({
      id: communityVariantId,
      title: "Demo Community Title",
      description: "This is a React Native converted example!",
      userId: "adminUserId",
      isPrivate: false,
      createdAt: new Date().toISOString(),
    });
    // setIsLiked(...) etc.
  }, [communityVariantId]);

  const loadMembers = useCallback(async () => {
    // Mocked data
    setMembers([
      {
        userId: "adminUserId",
        firstName: "Admin",
        lastName: "Owner",
        userName: "admino",
      },
      {
        userId: "demoFriend2",
        firstName: "Jane",
        lastName: "Doe",
        userName: "janedoe",
      },
    ]);
  }, []);

  const loadPosts = useCallback(async () => {
    // Mocked data
    setPosts([
      {
        id: "post1",
        timestamp: new Date().toISOString(),
        title: "My First Post",
        content: "This is a sample post in the community.",
        author: {
          firstName: "Admin",
          lastName: "Owner",
          profileImage: "https://placekitten.com/200/200", // placeholder
          role: "Admin",
        },
        mediaDetails: [],
      },
    ]);
  }, []);

  // You can set up all your useEffects similarly
  useEffect(() => {
    loadCommunityData();
    loadMembers();
    loadPosts();
  }, [loadCommunityData, loadMembers, loadPosts]);

  // ----------------------------------------
  // Handlers (Firebase or fetch calls hashed out)
  // ----------------------------------------
  const handleLike = async (postId: string) => {
    // if (!currentUserId) return;
    const currentLikeState = likedPosts[postId] || false;
    setLikedPosts((prev) => ({ ...prev, [postId]: !currentLikeState }));

    // Example call to an API or Firebase
    /*
    try {
      const response = await fetch('/api/communities/like', { ... });
    } catch (error) {
      console.error('Error liking post:', error);
    }
    */
  };

  const handleDeletePost = async (postId: string) => {
    // if (communityData?.userId !== currentUserId) return; // must be admin
    // Example hashed-out Firestore:
    /*
    try {
      const postDocRef = doc(db, 'communityVariantDetails', postId);
      await deleteDoc(postDocRef);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
    }
    */
    console.log("handleDeletePost pressed for", postId);
  };

  const handleCommunityLike = async () => {
    // Example hashed-out logic:
    /*
    if (!currentUserId) return;
    try {
      const likesRef = doc(db, 'communityVariantMembershipAndLikeCount', communityVariantId);
      ...
    } catch (error) {
      console.error('Error updating community like:', error);
    }
    */
    setIsLiked(!isLiked);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
  };

  // For removing/banning users
  const removeUserFromCommunity = async (userId: string) => {
    // if (communityData?.userId !== currentUserId) return;
    // ...
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  };
  const banUserFromCommunity = async (userId: string) => {
    // ...
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  // For editing community
  const handleEditSubmit = async () => {
    // if (communityImage) { ... } // use an image picker in RN
    // ...
    setIsEditFormOpen(false);
    console.log("Community updated (mock).");
  };

  // Basic modals toggles
  const openCommentsModal = (postId: string) => {
    setSelectedPostId(postId);
    setIsPostModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedUserId(null);
    setSelectedUserName("");
    setModalAction(null);
  };

  // Banned check / friends data would be similar—comment out or mock

  // ----------------------------------------
  // Rendering
  // ----------------------------------------
  if (isBanned) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "bold",
            color: "red",
            marginBottom: 8,
          }}
        >
          Access Denied
        </Text>
        <Text
          style={{
            color: "#333",
          }}
        >
          You have been banned from this community and cannot access its
          content.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: "#F3F4F6",
        paddingTop: 24,
        paddingHorizontal: 16,
      }}
    >
      {/* Community Header */}
      {communityData ? (
        <View
          style={{
            backgroundColor: "#FFF",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
            shadowColor: "#000",
            elevation: 2,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
            }}
          >
            {communityData.title}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: "#666",
              marginVertical: 8,
            }}
          >
            {communityData.description}
          </Text>

          {/* Action Buttons */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            {!members.some((m) => m.userId === currentUserId) && (
              <TouchableOpacity
                style={{
                  backgroundColor: "#b1fab1",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                }}
                onPress={() => console.log("Join community pressed")}
              >
                <Text
                  style={{
                    color: "#000",
                  }}
                >
                  Join Community
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
              }}
              onPress={handleCommunityLike}
            >
              {/* Replace with your icon usage */}
              <Text style={{ color: isLiked ? "green" : "gray" }}>♥</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                {
                  borderWidth: 1,
                  borderColor: "#ccc",
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                },
                { marginLeft: 8 },
              ]}
              onPress={() => console.log("Share pressed")}
            >
              <Text>Share</Text>
            </TouchableOpacity>

            {communityData.userId === currentUserId && (
              <TouchableOpacity
                style={{
                  marginLeft: 8,
                  backgroundColor: "#b1fab1",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                }}
                onPress={() => {
                  setIsEditFormOpen((prev) => !prev);
                  setEditTitle(communityData.title || "");
                  setEditDescription(communityData.description || "");
                  setEditImageUrl(communityData.imageUrl || "");
                  setEditIsPrivate(communityData.isPrivate || false);
                }}
              >
                <Text
                  style={{
                    color: "#000",
                  }}
                >
                  {isEditFormOpen ? "Cancel Edit" : "Edit Community"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <ActivityIndicator />
      )}

      {/* Edit Form */}
      {isEditFormOpen && (
        <View
          style={{
            backgroundColor: "#FFF",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
            elevation: 2,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "bold",
              marginBottom: 8,
            }}
          >
            Edit Community
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: "#DDD",
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 6,
              marginBottom: 10,
            }}
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder="Community Title"
          />
          <TextInput
            style={[
              {
                borderWidth: 1,
                borderColor: "#DDD",
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 6,
                marginBottom: 10,
              },
              { height: 80 },
            ]}
            value={editDescription}
            onChangeText={setEditDescription}
            placeholder="Describe your community"
            multiline
          />

          {/* For image picking, you'll need an external library. This is just a placeholder. */}
          <TouchableOpacity
            style={{
              backgroundColor: "#EEE",
              padding: 8,
              borderRadius: 8,
              marginBottom: 8,
            }}
            onPress={() => console.log("Open RN image picker")}
          >
            <Text>Change Banner Image</Text>
          </TouchableOpacity>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <TouchableOpacity
              style={{
                width: 20,
                height: 20,
                borderWidth: 1,
                borderColor: "#333",
                marginRight: 8,
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() => setEditIsPrivate(!editIsPrivate)}
            >
              {editIsPrivate ? <Text>✔</Text> : null}
            </TouchableOpacity>
            <Text>Make this community private</Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              marginTop: 8,
            }}
          >
            <TouchableOpacity
              style={[
                {
                  backgroundColor: "#b1fab1",
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                  marginLeft: 8,
                },
                { backgroundColor: "#ccc" },
              ]}
              onPress={() => setIsEditFormOpen(false)}
            >
              <Text>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                backgroundColor: "#b1fab1",
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
                marginLeft: 8,
              }}
              onPress={handleEditSubmit}
            >
              <Text>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Buttons (Events & Posts) */}
      <View style={{ flexDirection: "row", marginVertical: 8 }}>
        <TouchableOpacity
          style={[
            {
              backgroundColor: "#b1fab1",
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
            },
            { marginRight: 8 },
          ]}
          onPress={() => setIsCommunityPostModalOpen(true)}
        >
          <Text
            style={{
              color: "#000",
            }}
          >
            Create Post +
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            backgroundColor: "#b1fab1",
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
          }}
          onPress={() => setIsEventModalOpen(true)}
        >
          <Text
            style={{
              color: "#000",
            }}
          >
            Host Event +
          </Text>
        </TouchableOpacity>
      </View>

      {/* Events */}
      <View
        style={{
          marginBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: "#000",
          paddingBottom: 8,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "bold",
            marginBottom: 8,
          }}
        >
          Community Events
        </Text>
        {/* Replace with real logic or remove if not needed */}
        <EventsList
          communityVariantId={communityVariantId}
          userId={currentUserId}
        />
      </View>

      {/* Polls */}
      <PollList communityId={communityVariantId} />

      {/* Posts */}
      {posts.map((post) => {
        const userHasLiked = likedPosts[post.id] || false;
        return (
          <View
            key={post.id}
            style={{
              backgroundColor: "#FFF",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
              elevation: 1,
            }}
          >
            {/* Media */}
            {post.mediaDetails?.length ? (
              <Image
                source={{ uri: post.mediaDetails[0].mediaUrl }}
                style={{
                  width: "100%",
                  height: 200,
                  borderRadius: 8,
                  marginBottom: 8,
                  resizeMode: "cover",
                }}
              />
            ) : null}

            {/* Author */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Image
                source={{ uri: post.author.profileImage }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  marginRight: 8,
                }}
              />
              <View>
                <Text
                  style={{
                    fontWeight: "bold",
                  }}
                >
                  {post.author.firstName} {post.author.lastName}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: "#666",
                  }}
                >
                  {post.author.role}
                </Text>
              </View>
            </View>

            <Text
              style={{
                marginTop: 4,
                fontWeight: "bold",
                fontSize: 16,
              }}
            >
              {post.title}
            </Text>
            <Text
              style={{
                marginTop: 2,
                color: "#333",
              }}
            >
              {post.content}
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: "#666",
                }}
              >
                {new Date(post.timestamp).toLocaleString()}
              </Text>
              {/* Admin can delete */}
              {communityData?.userId === currentUserId && (
                <TouchableOpacity onPress={() => handleDeletePost(post.id)}>
                  <Text style={{ color: "red" }}>Delete</Text>
                  {/* Or an icon if you prefer */}
                </TouchableOpacity>
              )}
            </View>

            {/* Like / Comment */}
            <View style={{ flexDirection: "row", marginTop: 8 }}>
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                }}
                onPress={() => handleLike(post.id)}
              >
                <Text style={{ color: userHasLiked ? "green" : "gray" }}>
                  ♥
                </Text>
                <Text style={{ marginLeft: 4 }}>
                  {userHasLiked ? "Liked" : "Like"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  {
                    flexDirection: "row",
                    alignItems: "center",
                  },
                  { marginLeft: 16 },
                ]}
                onPress={() => openCommentsModal(post.id)}
              >
                <Text>💬</Text>
                <Text style={{ marginLeft: 4 }}>Comment</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {/* Right section details (members, etc.) — place them wherever you want */}
      {communityData && (
        <View
          style={{
            backgroundColor: "#FFF",
            borderRadius: 8,
            padding: 16,
            marginTop: 16,
            marginBottom: 32,
            elevation: 1,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            Details
          </Text>
          <Text>
            Created:{" "}
            {communityData.createdAt
              ? new Date(communityData.createdAt).toLocaleDateString()
              : "N/A"}
          </Text>
          <Text>Status: {communityData.isPrivate ? "Private" : "Public"}</Text>
          <Text style={{ marginTop: 8 }}>Online: 76 Members</Text>

          <TouchableOpacity
            style={[
              {
                backgroundColor: "#b1fab1",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
              },
              { marginTop: 8 },
            ]}
            onPress={() => setIsCommunityPostModalOpen(true)}
          >
            <Text
              style={{
                color: "#000",
              }}
            >
              Create Post +
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              {
                backgroundColor: "#b1fab1",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
              },
              { marginTop: 8 },
            ]}
            onPress={() => setIsEventModalOpen(true)}
          >
            <Text
              style={{
                color: "#000",
              }}
            >
              Host Event +
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              {
                backgroundColor: "#b1fab1",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
              },
              { marginTop: 8 },
            ]}
            onPress={() => setIsPollModalOpen(true)}
          >
            <Text
              style={{
                color: "#000",
              }}
            >
              Create Poll +
            </Text>
          </TouchableOpacity>

          <Text
            style={[
              {
                fontSize: 16,
                fontWeight: "bold",
              },
              { marginTop: 16 },
            ]}
          >
            Join Your Friends
          </Text>
          {friendsInCommunities
            .filter((f) => f.communityIds.includes(communityVariantId))
            .map((friend, idx) => (
              <Text key={idx} style={{ color: "#666" }}>
                {friend.firstName} {friend.lastName} @{friend.userName}
              </Text>
            ))}
        </View>
      )}

      {/* Modals */}
      {isPostModalOpen && selectedPostId && (
        <CommunityPostCommentsModal
          communityVariantDetailsId={selectedPostId}
          onClose={() => setIsPostModalOpen(false)}
        />
      )}
      {isCommunityPostModalOpen && (
        <CreateCommunityPost
          communityVariantId={communityVariantId}
          setTogglePostForm={() => setIsCommunityPostModalOpen(false)}
          profilePicture=""
        />
      )}
      {isEventModalOpen && (
        <PostEventModal
          isOpen={isEventModalOpen}
          onClose={() => setIsEventModalOpen(false)}
          communityVariantId={communityVariantId}
        />
      )}
      {isEventCommentModalOpen && (
        <EventCommentModal
          onClose={() => setIsEventCommentModalOpen(false)}
          eventId={selectedEventId || ""}
        />
      )}
      {isModalOpen && (
        <ConfirmationModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onConfirm={modalAction === "remove" ? () => null : () => null}
          userName={selectedUserName}
          action={modalAction || "remove"}
        />
      )}
      {isPollModalOpen && (
        <PollModal
          onClose={() => setIsPollModalOpen(false)}
          communityId={communityVariantId}
        />
      )}
    </ScrollView>
  );
};

export default CommunityDetailScreen;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#F3F4F6',
//     paddingTop: 24,
//     paddingHorizontal: 16
//   },
//   bannedContainer: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center'
//   },
//   bannedTitle: {
//     fontSize: 18,
//     fontWeight: 'bold',
//     color: 'red',
//     marginBottom: 8
//   },
//   bannedDesc: {
//     color: '#333'
//   },
//   headerCard: {
//     backgroundColor: '#FFF',
//     borderRadius: 8,
//     padding: 16,
//     marginBottom: 16,
//     shadowColor: '#000',
//     elevation: 2
//   },
//   headerTitle: {
//     fontSize: 18,
//     fontWeight: 'bold'
//   },
//   headerDescription: {
//     fontSize: 14,
//     color: '#666',
//     marginVertical: 8
//   },
//   actionRow: {
//     flexDirection: 'row',
//     alignItems: 'center'
//   },
//   joinButton: {
//     backgroundColor: '#b1fab1',
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     borderRadius: 8
//   },
//   joinButtonText: {
//     color: '#000'
//   },
//   iconButton: {
//     flexDirection: 'row',
//     alignItems: 'center'
//   },
//   shareButton: {
//     borderWidth: 1,
//     borderColor: '#ccc',
//     borderRadius: 8,
//     paddingHorizontal: 12,
//     paddingVertical: 8
//   },
//   editButton: {
//     marginLeft: 8,
//     backgroundColor: '#b1fab1',
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     borderRadius: 8
//   },
//   editButtonText: {
//     color: '#000'
//   },
//   editForm: {
//     backgroundColor: '#FFF',
//     borderRadius: 8,
//     padding: 16,
//     marginBottom: 16,
//     elevation: 2
//   },
//   editFormTitle: {
//     fontSize: 16,
//     fontWeight: 'bold',
//     marginBottom: 8
//   },
//   input: {
//     borderWidth: 1,
//     borderColor: '#DDD',
//     borderRadius: 6,
//     paddingHorizontal: 8,
//     paddingVertical: 6,
//     marginBottom: 10
//   },
//   changeBannerBtn: {
//     backgroundColor: '#EEE',
//     padding: 8,
//     borderRadius: 8,
//     marginBottom: 8
//   },
//   checkboxRow: {
//     flexDirection: 'row',
//     alignItems: 'center'
//   },
//   checkbox: {
//     width: 20,
//     height: 20,
//     borderWidth: 1,
//     borderColor: '#333',
//     marginRight: 8,
//     alignItems: 'center',
//     justifyContent: 'center'
//   },
//   saveCancelRow: {
//     flexDirection: 'row',
//     justifyContent: 'flex-end',
//     marginTop: 8
//   },
//   saveCancelButton: {
//     backgroundColor: '#b1fab1',
//     paddingHorizontal: 16,
//     paddingVertical: 8,
//     borderRadius: 8,
//     marginLeft: 8
//   },
//   eventsContainer: {
//     marginBottom: 16,
//     borderBottomWidth: 1,
//     borderBottomColor: '#000',
//     paddingBottom: 8
//   },
//   eventsHeader: {
//     fontSize: 16,
//     fontWeight: 'bold',
//     marginBottom: 8
//   },
//   postCard: {
//     backgroundColor: '#FFF',
//     borderRadius: 8,
//     padding: 16,
//     marginBottom: 16,
//     elevation: 1
//   },
//   postImage: {
//     width: '100%',
//     height: 200,
//     borderRadius: 8,
//     marginBottom: 8,
//     resizeMode: 'cover'
//   },
//   postAuthorRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 8
//   },
//   authorImage: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     marginRight: 8
//   },
//   postAuthorName: {
//     fontWeight: 'bold'
//   },
//   postAuthorRole: {
//     fontSize: 12,
//     color: '#666'
//   },
//   postTitle: {
//     marginTop: 4,
//     fontWeight: 'bold',
//     fontSize: 16
//   },
//   postContent: {
//     marginTop: 2,
//     color: '#333'
//   },
//   postFooterRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     marginTop: 8
//   },
//   postTime: {
//     fontSize: 12,
//     color: '#666'
//   },
//   detailsCard: {
//     backgroundColor: '#FFF',
//     borderRadius: 8,
//     padding: 16,
//     marginTop: 16,
//     marginBottom: 32,
//     elevation: 1
//   },
//   detailsTitle: {
//     fontSize: 16,
//     fontWeight: 'bold'
//   }
// });
