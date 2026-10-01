import { useState } from "react";
import {
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import CustomModal from "@/components/ui/CustomModal";

type PollModalProps = {
  onClose: () => void;
  communityId: string;
};

export default function PollModal({ onClose, communityId }: PollModalProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]); // Default 2 options
  const [dialogState, setDialogState] = useState<{
    visible: boolean;
    type: 'error' | 'success' | 'info' | 'warning';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const handleAddOption = () => {
    if (options.length < 5) {
      setOptions([...options, ""]);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async () => {
    if (!question.trim() || options.some((opt) => !opt.trim())) {
      setDialogState({
        visible: true,
        type: 'warning',
        title: 'Missing Details',
        message: 'Please fill out the question and all options.',
      });
      return;
    }

    try {
      setDialogState({
        visible: true,
        type: 'success',
        title: 'Poll Created',
        message: 'Your poll has been created successfully!',
        onConfirm: () => {
          setDialogState((prev) => ({ ...prev, visible: false }));
          onClose();
        },
      });
    } catch (error) {
      console.error("Error creating poll:", error);
      setDialogState({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'Unable to create poll. Please try again.',
      });
    }
  };

  // If you want to conditionally hide/show this modal, you can add a prop `isOpen` and do:
  // if (!isOpen) return null;

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={onClose} // Android back button
    >
      {/* Overlay */}
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
        }}
      >
        {/* Modal content */}
        <View
          style={{
            backgroundColor: "#fff",
            width: "90%",
            borderRadius: 8,
            padding: 16,
            maxHeight: "80%",
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            Create a Poll
          </Text>

          {/* Question Input */}
          <TextInput
            style={{
              borderColor: "#ccc",
              borderWidth: 1,
              borderRadius: 6,
              paddingHorizontal: 10,
              paddingVertical: 8,
              marginBottom: 8,
              fontSize: 14,
            }}
            placeholder="Poll Question"
            value={question}
            onChangeText={setQuestion}
          />

          {/* Options */}
          {options.map((option, index) => (
            <TextInput
              key={index}
              style={{
                borderColor: "#ccc",
                borderWidth: 1,
                borderRadius: 6,
                paddingHorizontal: 10,
                paddingVertical: 8,
                marginBottom: 8,
                fontSize: 14,
              }}
              placeholder={`Option ${index + 1}`}
              value={option}
              onChangeText={(text) => handleOptionChange(index, text)}
            />
          ))}

          {/* Add Option Button */}
          {options.length < 5 && (
            <TouchableOpacity
              onPress={handleAddOption}
              style={{
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  color: "blue",
                }}
              >
                + Add Option
              </Text>
            </TouchableOpacity>
          )}

          {/* Action Buttons */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              style={[
                {
                  borderRadius: 6,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                },
                { backgroundColor: "#ccc" },
              ]}
            >
              <Text
                style={{
                  color: "#000",
                  fontSize: 14,
                  textAlign: "center",
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              style={[
                {
                  borderRadius: 6,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                },
                { backgroundColor: "#90EE90" },
              ]}
            >
              <Text
                style={{
                  color: "#000",
                  fontSize: 14,
                  textAlign: "center",
                }}
              >
                Submit Poll
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <CustomModal
        visible={dialogState.visible}
        type={dialogState.type}
        title={dialogState.title}
        message={dialogState.message}
        onConfirm={dialogState.onConfirm}
        onClose={() => setDialogState((prev) => ({ ...prev, visible: false }))}
      />
    </Modal>
  );
}

// // Example styling
// const styles = StyleSheet.create({
//   overlay: {
//     flex: 1,
//     backgroundColor: "rgba(0,0,0,0.5)",
//     justifyContent: "center",
//     alignItems: "center",
//     padding: 16,
//   },
//   modalContainer: {
//     backgroundColor: "#fff",
//     width: "90%",
//     borderRadius: 8,
//     padding: 16,
//     maxHeight: "80%",
//   },
//   title: {
//     fontSize: 18,
//     fontWeight: "600",
//     marginBottom: 12,
//     textAlign: "center",
//   },
//   input: {
//     borderColor: "#ccc",
//     borderWidth: 1,
//     borderRadius: 6,
//     paddingHorizontal: 10,
//     paddingVertical: 8,
//     marginBottom: 8,
//     fontSize: 14,
//   },
//   addOptionButton: {
//     marginBottom: 12,
//   },
//   addOptionButtonText: {
//     color: "blue",
//   },
//   buttonRow: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     marginTop: 8,
//   },
//   button: {
//     borderRadius: 6,
//     paddingVertical: 10,
//     paddingHorizontal: 16,
//   },
//   buttonText: {
//     color: "#000",
//     fontSize: 14,
//     textAlign: "center",
//   },
// });
