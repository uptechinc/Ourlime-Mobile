import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

// If using firebase/firestore in RN, set up your config properly and import from react-native-firebase or your custom config.
// import {
//   addDoc,
//   serverTimestamp,
//   collection,
//   getDocs,
//   query,
//   where
// } from 'firebase/firestore';
// import { db, auth } from '@/lib/firebaseConfig'; // Hashed out until ready

// Replace this with your actual React Native version of PostMedia
// e.g. a simple image or video component
import PostMedia from "./PostMedia"; // or placeholder

interface CommunityPostCommentsModalProps {
  communityVariantDetailsId: string;
  onClose: () => void;
}

const CommunityPostCommentsModal: React.FC<CommunityPostCommentsModalProps> = ({
  communityVariantDetailsId,
  onClose,
}) => {
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [commentReply, setCommentReply] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [postDetails, setPostDetails] = useState<any | null>(null); // Replace `any` with a typed interface if you have one
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replies, setReplies] = useState<{ [key: string]: any[] }>({});

  // ----------------------------------------------------------------
  // Example placeholders: Fetch post details, comments, and replies
  // ----------------------------------------------------------------
  const loadPostDetails = async () => {
    setIsLoading(true);
    try {
      // Example hashed-out call to fetch data from Firestore or an API
      /*
      const fetchedPosts = await fetchCommunityPosts(communityVariantDetailsId);
      setPostDetails(fetchedPosts[0]);
      */
      // Mock data:
      setPostDetails({
        id: communityVariantDetailsId,
        mediaDetails: [],
        author: { firstName: "Sam", lastName: "Tester" },
        createdAt: new Date(),
        // ...
      });
    } catch (error) {
      console.error("Error fetching post details:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCommentsAndReplies = async () => {
    setIsLoading(true);
    try {
      // Example hashed-out logic
      /*
      const fetchedComments = await fetchCommunityPostComments(communityVariantDetailsId);
      setComments(fetchedComments);

      // For each comment, fetch replies similarly
      const repliesData: { [key: string]: any[] } = {};
      for (const comment of fetchedComments) {
        const fetchedReplies = await fetchRepliesForCommunityPostComments('communityVariantDetailsCommentsReplies', comment.id);
        repliesData[comment.id] = fetchedReplies;
      }
      setReplies(repliesData);
      */
      // Mocked data
      const exampleComments = [
        {
          id: "comment1",
          comment: "Hello from RN!",
          createdAt: new Date(),
          userData: { firstName: "Jane", lastName: "Doe", profileImage: "" },
        },
      ];
      setComments(exampleComments);
      setReplies({
        comment1: [
          {
            id: "reply1",
            reply: "This is a reply in RN!",
            createdAt: new Date(),
            userData: {
              firstName: "Someone",
              lastName: "Else",
              profileImage: "",
            },
          },
        ],
      });
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPostDetails();
    fetchCommentsAndReplies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityVariantDetailsId]);

  // ----------------------------------------------------------------
  // Handlers for posting comments & replies
  // ----------------------------------------------------------------
  const handleSubmit = async () => {
    if (!comment.trim()) return;
    // Example hashed-out logic:
    /*
    try {
      const commentData = {
        comment,
        createdAt: serverTimestamp(),
        communityVariantDetailsId,
        userId: auth.currentUser?.uid
      };
      await addDoc(collection(db, 'communityVariantDetailsComments'), commentData);
    } catch (e) {
      console.error('Error adding comment:', e);
    }
    */
    setComment("");
    fetchCommentsAndReplies();
  };

  const handleReply = async (commentId: string) => {
    if (!commentReply.trim()) return;
    /*
    try {
      const replyData = {
        commentReply,
        createdAt: serverTimestamp(),
        communityVariantDetailsCommentsId: commentId,
        userId: auth.currentUser?.uid
      };
      await addDoc(collection(db, 'communityVariantDetailsCommentsReplies'), replyData);
    } catch (e) {
      console.error('Error adding reply:', e);
    }
    */
    setCommentReply("");
    fetchCommentsAndReplies();
  };

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <Modal
      animationType="slide"
      transparent
      visible={true}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <View
          style={{
            backgroundColor: "#FFF",
            borderRadius: 8,
            maxHeight: "90%",
            overflow: "hidden",
          }}
        >
          <TouchableOpacity
            style={{
              alignSelf: "flex-end",
              padding: 8,
            }}
            onPress={onClose}
            accessibilityLabel="Close modal"
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              X
            </Text>
          </TouchableOpacity>

          {/* Post Media Section */}
          {postDetails?.mediaDetails?.length > 0 && (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PostMedia media={postDetails.mediaDetails} />
            </View>
          )}

          <Text
            style={{
              fontSize: 12,
              color: "#666",
              paddingHorizontal: 16,
              marginBottom: 8,
            }}
          >
            Posted by {postDetails?.author?.firstName}{" "}
            {postDetails?.author?.lastName} on{" "}
            {postDetails?.createdAt?.toLocaleString?.()}
          </Text>

          {/* Comments Section */}
          <View
            style={{
              flex: 1,
              paddingHorizontal: 16,
              paddingBottom: 8,
              minHeight: 200,
            }}
          >
            {isLoading ? (
              <ActivityIndicator />
            ) : (
              <ScrollView>
                {comments.map((c) => (
                  <View
                    key={c.id}
                    style={{
                      marginBottom: 12,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                      }}
                    >
                      <Image
                        source={{
                          uri:
                            c.userData?.profileImage ||
                            "https://placekitten.com/40/40",
                        }}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          marginRight: 8,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "bold",
                          }}
                        >
                          {c.userData?.firstName} {c.userData?.lastName}
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            color: "#333",
                          }}
                        >
                          {c.comment}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: "#999",
                            marginTop: 4,
                          }}
                        >
                          {c.createdAt?.toLocaleString?.()}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          setReplyingTo(replyingTo === c.id ? null : c.id)
                        }
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            color: "#217AFF",
                          }}
                        >
                          Reply
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Replies */}
                    {replies[c.id]?.length > 0 && (
                      <View
                        style={{
                          marginLeft: 48,
                          marginTop: 8,
                        }}
                      >
                        {replies[c.id].map((replyItem) => (
                          <View
                            key={replyItem.id}
                            style={{
                              flexDirection: "row",
                              marginBottom: 8,
                            }}
                          >
                            <Image
                              source={{
                                uri:
                                  replyItem.userData?.profileImage ||
                                  "https://placekitten.com/32/32",
                              }}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                marginRight: 8,
                              }}
                            />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  fontSize: 14,
                                  fontWeight: "bold",
                                }}
                              >
                                {replyItem.userData?.firstName}{" "}
                                {replyItem.userData?.lastName}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 13,
                                  color: "#333",
                                }}
                              >
                                {replyItem.reply}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: "#999",
                                  marginTop: 4,
                                }}
                              >
                                {replyItem.createdAt?.toLocaleString?.()}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Reply Input */}
                    {replyingTo === c.id && (
                      <View
                        style={{
                          flexDirection: "row",
                          marginLeft: 48,
                          marginTop: 8,
                          alignItems: "flex-start",
                        }}
                      >
                        <TextInput
                          style={{
                            flex: 1,
                            borderWidth: 1,
                            borderColor: "#DDD",
                            borderRadius: 4,
                            padding: 8,
                            marginRight: 8,
                            minHeight: 40,
                          }}
                          placeholder="Write your reply..."
                          value={commentReply}
                          onChangeText={setCommentReply}
                          multiline
                        />
                        <TouchableOpacity
                          style={{
                            backgroundColor: "#29a329",
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 6,
                            justifyContent: "center",
                          }}
                          onPress={() => handleReply(c.id)}
                        >
                          <Text style={{ color: "white" }}>Reply</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Comment Input Box */}
          <View
            style={{
              flexDirection: "row",
              borderTopWidth: 1,
              borderTopColor: "#CCC",
              padding: 8,
            }}
          >
            <TextInput
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: "#DDD",
                borderRadius: 4,
                padding: 8,
                minHeight: 40,
              }}
              placeholder="Write your comment..."
              multiline
              value={comment}
              onChangeText={setComment}
            />
            <TouchableOpacity
              style={{
                backgroundColor: "#29a329",
                paddingHorizontal: 16,
                paddingVertical: 10,
                marginLeft: 8,
                borderRadius: 6,
                justifyContent: "center",
              }}
              onPress={handleSubmit}
            >
              <Text style={{ color: "white" }}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default CommunityPostCommentsModal;

// const styles = StyleSheet.create({
//   overlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     justifyContent: 'center',
//     padding: 16
//   },
//   modalContainer: {
//     backgroundColor: '#FFF',
//     borderRadius: 8,
//     maxHeight: '90%',
//     overflow: 'hidden'
//   },
//   closeButton: {
//     alignSelf: 'flex-end',
//     padding: 8
//   },
//   closeButtonText: {
//     fontSize: 16,
//     fontWeight: '600'
//   },
//   mediaWrapper: {
//     alignItems: 'center',
//     justifyContent: 'center'
//   },
//   postInfo: {
//     fontSize: 12,
//     color: '#666',
//     paddingHorizontal: 16,
//     marginBottom: 8
//   },
//   commentsContainer: {
//     flex: 1,
//     paddingHorizontal: 16,
//     paddingBottom: 8,
//     minHeight: 200
//   },
//   commentBlock: {
//     marginBottom: 12
//   },
//   commentHeader: {
//     flexDirection: 'row',
//     alignItems: 'flex-start'
//   },
//   commentAvatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     marginRight: 8
//   },
//   commentAuthor: {
//     fontSize: 14,
//     fontWeight: 'bold'
//   },
//   commentText: {
//     fontSize: 13,
//     color: '#333'
//   },
//   commentTimestamp: {
//     fontSize: 11,
//     color: '#999',
//     marginTop: 4
//   },
//   replyButton: {
//     fontSize: 13,
//     color: '#217AFF'
//   },
//   replyBlock: {
//     marginLeft: 48,
//     marginTop: 8
//   },
//   singleReply: {
//     flexDirection: 'row',
//     marginBottom: 8
//   },
//   replyAvatar: {
//     width: 32,
//     height: 32,
//     borderRadius: 16,
//     marginRight: 8
//   },
//   replyInputRow: {
//     flexDirection: 'row',
//     marginLeft: 48,
//     marginTop: 8,
//     alignItems: 'flex-start'
//   },
//   replyInput: {
//     flex: 1,
//     borderWidth: 1,
//     borderColor: '#DDD',
//     borderRadius: 4,
//     padding: 8,
//     marginRight: 8,
//     minHeight: 40
//   },
//   sendReplyBtn: {
//     backgroundColor: '#29a329',
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     borderRadius: 6,
//     justifyContent: 'center'
//   },
//   commentFormContainer: {
//     flexDirection: 'row',
//     borderTopWidth: 1,
//     borderTopColor: '#CCC',
//     padding: 8
//   },
//   commentInput: {
//     flex: 1,
//     borderWidth: 1,
//     borderColor: '#DDD',
//     borderRadius: 4,
//     padding: 8,
//     minHeight: 40
//   },
//   postBtn: {
//     backgroundColor: '#29a329',
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     marginLeft: 8,
//     borderRadius: 6,
//     justifyContent: 'center'
//   }
// });
