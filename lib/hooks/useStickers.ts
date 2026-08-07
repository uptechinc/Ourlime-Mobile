import { useState, useEffect, useMemo } from 'react';
import { stickerService } from '@/lib/sticker/StickerService';
import type { Sticker, StickerPack } from '@/lib/types/sticker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_KEY = 'sticker_recently_used';
const MAX_RECENT = 20;

/**
 * useStickers — mirrors the web's useStickers hook.
 * Subscribes to real Firestore stickerPacks + stickers collections.
 */
export function useStickers(searchQuery: string = '', activePackId: string = '') {
    const [packs, setPacks] = useState<StickerPack[]>([]);
    const [allStickers, setAllStickers] = useState<Sticker[]>([]);
    const [recentlyUsed, setRecentlyUsed] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const unsubPacks = stickerService.subscribeToPacks((p) => {
            setPacks(p);
            setLoading(false);
        });
        return unsubPacks;
    }, []);

    useEffect(() => {
        const unsubStickers = stickerService.subscribeToAllStickers((s) => {
            setAllStickers(s);
        });
        return unsubStickers;
    }, []);

    // Load recently used from AsyncStorage
    useEffect(() => {
        AsyncStorage.getItem(RECENT_KEY)
            .then((raw) => {
                if (raw) setRecentlyUsed(JSON.parse(raw) as string[]);
            })
            .catch(() => {});
    }, []);

    const addRecentlyUsed = async (stickerId: string) => {
        setRecentlyUsed((prev) => {
            const updated = [stickerId, ...prev.filter((id) => id !== stickerId)].slice(0, MAX_RECENT);
            AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated)).catch(() => {});
            return updated;
        });
    };

    const filteredStickers = useMemo(() => {
        if (searchQuery) {
            return stickerService.searchStickers(allStickers, { query: searchQuery });
        }
        if (activePackId && activePackId !== 'all') {
            return allStickers.filter((s) => s.packId === activePackId);
        }
        return allStickers;
    }, [allStickers, searchQuery, activePackId]);

    const recentStickers = useMemo(
        () =>
            recentlyUsed
                .map((id) => allStickers.find((s) => s.id === id))
                .filter(Boolean) as Sticker[],
        [recentlyUsed, allStickers]
    );

    return {
        packs,
        stickers: filteredStickers,
        recentStickers,
        allStickers,
        loading,
        addRecentlyUsed,
    };
}
