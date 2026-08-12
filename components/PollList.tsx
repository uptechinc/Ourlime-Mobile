import { useEffect, useState } from "react";
import {
  Alert,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";

// ---------------------------------------------------------------------------
// NOTE: The following Firebase imports and calls are commented out.
//       Uncomment and adapt them for your React Native Firebase environment.
//
// import { collection, onSnapshot, doc, updateDoc, getDoc, query, where } from 'firebase/firestore';
// ---------------------------------------------------------------------------

// For local storage in React Native, you'd typically use @react-native-async-storage/async-storage
// We'll leave the logic commented out or simplified for demonstration.
//
// import AsyncStorage from '@react-native-async-storage/async-storage';

type PollOption = {
  option: string;
  votes: number;
};

type Poll = {
  id: string;
  question: string;
  options: PollOption[];
  communityId: string;
};

type PollListProps = {
  communityId: string;
};

export default function PollList({ communityId }: PollListProps) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [hasVoted, setHasVoted] = useState<{ [key: string]: boolean }>({});
  const [userVotes, setUserVotes] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    // In React Native, you might retrieve data from AsyncStorage, for example:
    // (We leave the actual logic commented out for clarity.)
    // const loadStorage = async () => {
    //   try {
    //     const storedVotes = await AsyncStorage.getItem('pollVotes');
    //     const storedUserVotes = await AsyncStorage.getItem('userVotes');
    //     if (storedVotes) setHasVoted(JSON.parse(storedVotes));
    //     if (storedUserVotes) setUserVotes(JSON.parse(storedUserVotes));
    //   } catch (err) {
    //     console.warn('Error loading local storage', err);
    //   }
    // };
    // loadStorage();

    // Example: Firestore query to fetch polls for a community
    // const pollsQuery = query(
    //   collection(db, 'polls'),
    //   where('communityId', '==', communityId)
    // );
    //
    // const unsubscribe = onSnapshot(pollsQuery, (snapshot) => {
    //   const fetchedPolls = snapshot.docs.map((d) => {
    //     const data = d.data();
    //     return {
    //       id: d.id,
    //       question: data.question,
    //       options: Array.isArray(data.options)
    //         ? data.options
    //         : Object.values(data.options || {}),
    //       communityId: data.communityId,
    //     } as Poll;
    //   });
    //   setPolls(fetchedPolls);
    // });

    // For demonstration, let's just set some mock data
    const mockData: Poll[] = [
      {
        id: "poll1",
        question: "Which mobile framework do you prefer?",
        options: [
          { option: "React Native", votes: 10 },
          { option: "Flutter", votes: 5 },
          { option: "Swift", votes: 3 },
        ],
        communityId,
      },
      {
        id: "poll2",
        question: "Favorite backend platform?",
        options: [
          { option: "Firebase", votes: 7 },
          { option: "Supabase", votes: 2 },
          { option: "AWS Amplify", votes: 4 },
        ],
        communityId,
      },
    ];
    setPolls(mockData);

    return () => {
      // if (unsubscribe) unsubscribe();
    };
  }, [communityId]);

  const handleVote = async (pollId: string, optionIndex: number) => {
    if (hasVoted[pollId]) return; // Prevent multiple votes

    try {
      // Firestore logic might look like this:
      //
      // const pollRef = doc(db, 'polls', pollId);
      // const pollSnap = await getDoc(pollRef);
      // if (!pollSnap.exists()) return;
      //
      // let pollData = pollSnap.data();
      // let optionsArray = Array.isArray(pollData.options)
      //   ? pollData.options
      //   : Object.values(pollData.options || {});
      //
      // optionsArray[optionIndex] = {
      //   ...optionsArray[optionIndex],
      //   votes: optionsArray[optionIndex].votes + 1,
      // };
      //
      // await updateDoc(pollRef, { options: optionsArray });

      // Simulate local data updates:
      setPolls((prevPolls) => {
        return prevPolls.map((poll) => {
          if (poll.id !== pollId) return poll;
          const updatedOptions = [...poll.options];
          updatedOptions[optionIndex] = {
            ...updatedOptions[optionIndex],
            votes: updatedOptions[optionIndex].votes + 1,
          };
          return { ...poll, options: updatedOptions };
        });
      });

      // Mark as voted
      const updatedVotes = { ...hasVoted, [pollId]: true };
      setHasVoted(updatedVotes);
      const updatedUserVotes = { ...userVotes, [pollId]: optionIndex };
      setUserVotes(updatedUserVotes);

      // In RN, you'd store in AsyncStorage (hashed out):
      // await AsyncStorage.setItem('pollVotes', JSON.stringify(updatedVotes));
      // await AsyncStorage.setItem('userVotes', JSON.stringify(updatedUserVotes));
    } catch (error) {
      console.error("Error voting:", error);
      Alert.alert("Error", "Error registering your vote");
    }
  };

  return (
    <ScrollView
      style={{
        marginTop: 16,
        paddingHorizontal: 12,
      }}
    >
      {polls.length > 0 && (
        <Text
          style={{
            fontSize: 18,
            fontWeight: "600",
            marginBottom: 12,
          }}
        >
          Community Polls
        </Text>
      )}

      {polls.map((poll) => (
        <View
          key={poll.id}
          style={{
            backgroundColor: "#fff",
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
            elevation: 2, // shadow on Android
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "500",
              marginBottom: 8,
            }}
          >
            {poll.question}
          </Text>

          {poll.options.map((opt, index) => {
            const isVoted = hasVoted[poll.id];
            const isUserVote = userVotes[poll.id] === index;
            return (
              <TouchableOpacity
                key={index}
                onPress={() => handleVote(poll.id, index)}
                style={[
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",

                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 4,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    marginBottom: 8,
                  },
                  isVoted &&
                    isUserVote && {
                      backgroundColor: "green",
                      borderColor: "green",
                    },
                ]}
                disabled={isVoted}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: "#333",
                  }}
                >
                  {opt.option}
                </Text>
                <Text
                  style={[
                    {
                      fontSize: 12,
                      color: "#666",
                    },
                    isVoted && isUserVote && { color: "#fff" },
                  ]}
                >
                  {opt.votes} votes
                </Text>
              </TouchableOpacity>
            );
          })}

          {hasVoted[poll.id] && (
            <Text
              style={{
                color: "green",
                marginTop: 4,
                fontSize: 14,
              }}
            >
              You have voted!
            </Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

// const styles = StyleSheet.create({
//   container: {
//     marginTop: 16,
//     paddingHorizontal: 12,
//   },
//   heading: {
//     fontSize: 18,
//     fontWeight: "600",
//     marginBottom: 12,
//   },
//   pollCard: {
//     backgroundColor: "#fff",
//     padding: 12,
//     borderRadius: 6,
//     marginBottom: 16,
//     elevation: 2, // shadow on Android
//   },
//   pollQuestion: {
//     fontSize: 16,
//     fontWeight: "500",
//     marginBottom: 8,
//   },
//   optionButton: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",

//     borderWidth: 1,
//     borderColor: "#ccc",
//     borderRadius: 4,
//     paddingVertical: 8,
//     paddingHorizontal: 12,
//     marginBottom: 8,
//   },
//   optionButtonVoted: {
//     backgroundColor: "green",
//     borderColor: "green",
//   },
//   optionText: {
//     fontSize: 14,
//     color: "#333",
//   },
//   optionVotes: {
//     fontSize: 12,
//     color: "#666",
//   },
//   votedText: {
//     color: "green",
//     marginTop: 4,
//     fontSize: 14,
//   },
// });
