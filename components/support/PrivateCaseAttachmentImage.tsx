import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';

import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { supportTicketService } from '@/lib/services/SupportTicketService';

type PrivateCaseAttachmentImageProps = {
	attachmentId: string;
	fileName: string;
};

export default function PrivateCaseAttachmentImage({
	attachmentId,
	fileName,
}: PrivateCaseAttachmentImageProps) {
	const { colors } = useAppTheme();
	const [url, setUrl] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let active = true;
		void supportTicketService
			.getAttachmentPreviewUrl(attachmentId)
			.then((previewUrl) => {
				if (active) setUrl(previewUrl);
			})
			.catch(() => {
				if (active) setFailed(true);
			});
		return () => {
			active = false;
		};
	}, [attachmentId]);

	if (failed) {
		return (
			<Text style={{ marginTop: 6, color: colors.mutedText, fontSize: 11 }}>
				Private image unavailable · {fileName}
			</Text>
		);
	}

	if (!url) {
		return (
			<View
				style={{
					height: 140,
					marginTop: 8,
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<ActivityIndicator color={colors.accent} />
			</View>
		);
	}

	return (
		<Image
			source={{ uri: url }}
			accessibilityLabel={fileName}
			resizeMode="cover"
			style={{
				width: 220,
				height: 180,
				marginTop: 8,
				borderRadius: 14,
				backgroundColor: colors.border,
			}}
		/>
	);
}
