import { useState } from 'react';
import AdminCollectionWorkspace from '@/components/admin/AdminCollectionWorkspace';
import type { AdminToolbarSegments } from '@/components/admin/AdminToolbar';

type StickerView = 'packs' | 'stickers';

const isStickerView = (value: string): value is StickerView => value === 'packs' || value === 'stickers';

export default function AdminStickersRoute() {
	const [view, setView] = useState<StickerView>('packs');
	// Packs / Stickers are two views of different content, so they are toolbar segments (not filters).
	const segments: AdminToolbarSegments = {
		value: view,
		options: [
			{ value: 'packs', label: 'Packs' },
			{ value: 'stickers', label: 'Stickers' },
		],
		onChange: (next) => {
			if (isStickerView(next)) setView(next);
		},
	};
	return view === 'packs' ? (
		<AdminCollectionWorkspace key="sticker_packs" kind="sticker_packs" title="Sticker Packs" subtitle="Review, publish, disable, and remove packs" segments={segments} />
	) : (
		<AdminCollectionWorkspace key="stickers" kind="stickers" title="Stickers" subtitle="Review, publish, disable, and remove sticker assets" segments={segments} />
	);
}
