import CustomModal from '@/components/ui/CustomModal';

type ConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName: string;
  action: "remove" | "ban";
};

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  userName,
  action,
}: ConfirmationModalProps) {
  const actionText = action === "remove" ? "remove" : "ban";
  const actionTitle = action === "remove" ? "Remove Member" : "Ban Member";
  const actionDescription =
    action === "remove"
      ? `Are you sure you want to remove ${userName} from this community?`
      : `Are you sure you want to ban ${userName} from this community? This action cannot be undone.`;

  return <CustomModal visible={isOpen} type="danger" title={actionTitle} message={actionDescription} confirmText={actionText.charAt(0).toUpperCase() + actionText.slice(1)} cancelText="Cancel" onConfirm={onConfirm} onClose={onClose} />;
}
