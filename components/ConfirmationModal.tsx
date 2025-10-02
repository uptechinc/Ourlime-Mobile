import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName: string;
  action: "remove" | "ban";
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  userName,
  action,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const actionText = action === "remove" ? "remove" : "ban";
  const actionTitle = action === "remove" ? "Remove Member" : "Ban Member";
  const actionDescription =
    action === "remove"
      ? `Are you sure you want to remove ${userName} from this community?`
      : `Are you sure you want to ban ${userName} from this community? This action cannot be undone.`;

  return (
    <Modal
      transparent
      visible={isOpen}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: "80%",
            backgroundColor: "#fff",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              marginBottom: 12,
            }}
          >
            {actionTitle}
          </Text>
          <Text
            style={{
              color: "#555",
              marginBottom: 16,
            }}
          >
            {actionDescription}
          </Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                marginRight: 12,
              }}
            >
              <Text
                style={[
                  {
                    color: "#fff",
                    fontSize: 14,
                  },
                  { color: "#555" },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              style={{
                backgroundColor: "#f33",
                borderRadius: 4,
                paddingVertical: 8,
                paddingHorizontal: 12,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 14,
                }}
              >
                {actionText.charAt(0).toUpperCase() + actionText.slice(1)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// const styles = StyleSheet.create({
//   overlay: {
//     flex: 1,
//     backgroundColor: "rgba(0,0,0,0.5)",
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   modalContainer: {
//     width: "80%",
//     backgroundColor: "#fff",
//     borderRadius: 8,
//     padding: 16,
//   },
//   title: {
//     fontSize: 18,
//     fontWeight: "bold",
//     marginBottom: 12,
//   },
//   description: {
//     color: "#555",
//     marginBottom: 16,
//   },
//   buttonsRow: {
//     flexDirection: "row",
//     justifyContent: "flex-end",
//   },
//   cancelButton: {
//     paddingVertical: 8,
//     paddingHorizontal: 12,
//     marginRight: 12,
//   },
//   confirmButton: {
//     backgroundColor: "#f33",
//     borderRadius: 4,
//     paddingVertical: 8,
//     paddingHorizontal: 12,
//   },
//   buttonText: {
//     color: "#fff",
//     fontSize: 14,
//   },
// });
