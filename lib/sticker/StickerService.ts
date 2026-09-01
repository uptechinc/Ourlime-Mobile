import { db } from '@/lib/firebaseConfig';
import {
    collection,
    query,
    orderBy,
    onSnapshot,
} from 'firebase/firestore';
import type { Sticker, StickerPack, StickerSearchParams } from '@/lib/types/sticker';
import { ApiService } from '@/lib/services/ApiService';

const PACKS_COLLECTION = 'stickerPacks';
const STICKERS_COLLECTION = 'stickers';

export function normalizeStickerUrl(url: string | undefined): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return url;
    }
    const webBaseUrl = ApiService.getInstance().getBaseUrl();
    if (url.startsWith('/')) {
        return `${webBaseUrl}${url}`;
    }
    return `${webBaseUrl}/${url}`;
}

// Exact fallback sticker packs matching web
export const DEFAULT_PACKS: StickerPack[] = [
    { id: 'reactions', name: 'Reactions', description: 'Express yourself with classic reaction faces', icon: normalizeStickerUrl('/images/stickers/reactions/Laughing.png'), coverImage: '', folder: 'reactions', order: 0, enabled: true },
    { id: 'greetings', name: 'Greetings', description: 'Say hello, thank you, and more', icon: normalizeStickerUrl('/images/stickers/greetings/Hello.png'), coverImage: '', folder: 'greetings', order: 1, enabled: true },
    { id: 'emotions', name: 'Emotions', description: 'Love, hugs, and feelings', icon: normalizeStickerUrl('/images/stickers/emotions/Heart Eyes.png'), coverImage: '', folder: 'emotions', order: 2, enabled: true },
    { id: 'thinking', name: 'Thinking', description: 'When you need a moment to think', icon: normalizeStickerUrl('/images/stickers/thinking/Thinking.png'), coverImage: '', folder: 'thinking', order: 3, enabled: true },
    { id: 'funny', name: 'Funny', description: 'Silly stickers for laughs', icon: normalizeStickerUrl('/images/stickers/funny/Bozo.png'), coverImage: '', folder: 'funny', order: 4, enabled: true },
];

// Exact fallback stickers matching web
export const DEFAULT_STICKERS: Sticker[] = [
    // Reactions
    { id: 'react_1', name: 'Laughing', packId: 'reactions', category: 'reaction', keywords: ['laugh', 'funny', 'lol', 'haha'], imageUrl: normalizeStickerUrl('/images/stickers/reactions/Laughing.png'), width: 200, height: 200, order: 0, enabled: true, isAnimated: false },
    { id: 'react_2', name: 'Confused', packId: 'reactions', category: 'reaction', keywords: ['confused', 'what', 'huh', 'unsure'], imageUrl: normalizeStickerUrl('/images/stickers/reactions/Confused.png'), width: 200, height: 200, order: 1, enabled: true, isAnimated: false },
    { id: 'react_3', name: 'Surprised', packId: 'reactions', category: 'reaction', keywords: ['surprised', 'shocked', 'wow', 'omg'], imageUrl: normalizeStickerUrl('/images/stickers/reactions/Surprised .png'), width: 200, height: 200, order: 2, enabled: true, isAnimated: false },
    { id: 'react_4', name: 'Annoyed', packId: 'reactions', category: 'reaction', keywords: ['annoyed', 'irritated', 'frustrated', 'ugh'], imageUrl: normalizeStickerUrl('/images/stickers/reactions/Annoyed.png'), width: 200, height: 200, order: 3, enabled: true, isAnimated: false },
    { id: 'react_5', name: 'Smug', packId: 'reactions', category: 'reaction', keywords: ['smug', 'proud', 'self-satisfied', 'cool'], imageUrl: normalizeStickerUrl('/images/stickers/reactions/Smug.png'), width: 200, height: 200, order: 4, enabled: true, isAnimated: false },
    { id: 'react_6', name: 'Derp', packId: 'reactions', category: 'reaction', keywords: ['derp', 'silly', 'dumb', 'goofy'], imageUrl: normalizeStickerUrl('/images/stickers/reactions/Derp.png'), width: 200, height: 200, order: 5, enabled: true, isAnimated: false },
    { id: 'react_7', name: 'Mischievous', packId: 'reactions', category: 'reaction', keywords: ['mischievous', 'sneaky', 'devil', 'trouble'], imageUrl: normalizeStickerUrl('/images/stickers/reactions/Mischievous .jpeg'), width: 200, height: 200, order: 6, enabled: true, isAnimated: false },
    { id: 'react_8', name: 'Worried', packId: 'reactions', category: 'reaction', keywords: ['worried', 'anxious', 'nervous', 'concerned'], imageUrl: normalizeStickerUrl('/images/stickers/reactions/Worried.png'), width: 200, height: 200, order: 7, enabled: true, isAnimated: false },
    { id: 'react_9', name: 'Pleading', packId: 'reactions', category: 'reaction', keywords: ['pleading', 'begging', 'please', 'sad'], imageUrl: normalizeStickerUrl('/images/stickers/reactions/Pleading.png'), width: 200, height: 200, order: 8, enabled: true, isAnimated: false },
    { id: 'react_10', name: 'Sleepy', packId: 'reactions', category: 'reaction', keywords: ['sleepy', 'tired', 'zzz', 'sleep'], imageUrl: normalizeStickerUrl('/images/stickers/reactions/Sleepy.png'), width: 200, height: 200, order: 9, enabled: true, isAnimated: false },
    { id: 'react_11', name: 'Dancing', packId: 'reactions', category: 'reaction', keywords: ['dancing', 'happy', 'celebrate', 'party'], imageUrl: normalizeStickerUrl('/images/stickers/reactions/Dancing.png'), width: 200, height: 200, order: 10, enabled: true, isAnimated: false },

    // Greetings
    { id: 'greet_1', name: 'Hello', packId: 'greetings', category: 'greeting', keywords: ['hello', 'hi', 'hey', 'wave'], imageUrl: normalizeStickerUrl('/images/stickers/greetings/Hello.png'), width: 200, height: 200, order: 0, enabled: true, isAnimated: false },
    { id: 'greet_2', name: 'Cheers', packId: 'greetings', category: 'greeting', keywords: ['cheers', 'toast', 'celebrate', 'drink'], imageUrl: normalizeStickerUrl('/images/stickers/greetings/Cheers.png'), width: 200, height: 200, order: 1, enabled: true, isAnimated: false },
    { id: 'greet_3', name: 'Thank You', packId: 'greetings', category: 'greeting', keywords: ['thank', 'thanks', 'grateful', 'appreciate'], imageUrl: normalizeStickerUrl('/images/stickers/greetings/Thank you.png'), width: 200, height: 200, order: 2, enabled: true, isAnimated: false },
    { id: 'greet_4', name: "You're Welcome", packId: 'greetings', category: 'greeting', keywords: ['welcome', 'np', 'no problem', 'anytime'], imageUrl: normalizeStickerUrl('/images/stickers/greetings/You’re welcome.png'), width: 200, height: 200, order: 3, enabled: true, isAnimated: false },
    { id: 'greet_5', name: 'Good Job', packId: 'greetings', category: 'greeting', keywords: ['good job', 'well done', 'congrats', 'bravo'], imageUrl: normalizeStickerUrl('/images/stickers/greetings/Good Job.png'), width: 200, height: 200, order: 4, enabled: true, isAnimated: false },

    // Emotions
    { id: 'emo_1', name: 'Heart Eyes', packId: 'emotions', category: 'emotion', keywords: ['heart', 'love', 'crush', 'adore'], imageUrl: normalizeStickerUrl('/images/stickers/emotions/Heart Eyes.png'), width: 200, height: 200, order: 0, enabled: true, isAnimated: false },
    { id: 'emo_2', name: 'Huggie', packId: 'emotions', category: 'emotion', keywords: ['hug', 'huggie', 'embrace', 'warm'], imageUrl: normalizeStickerUrl('/images/stickers/emotions/Huggie.png'), width: 200, height: 200, order: 1, enabled: true, isAnimated: false },
    { id: 'emo_3', name: 'Relaxed', packId: 'emotions', category: 'emotion', keywords: ['relaxed', 'chill', 'calm', 'zen'], imageUrl: normalizeStickerUrl('/images/stickers/emotions/Relaxed.png'), width: 200, height: 200, order: 2, enabled: true, isAnimated: false },
    { id: 'emo_4', name: 'Teasing', packId: 'emotions', category: 'emotion', keywords: ['teasing', 'playful', 'wink', 'flirty'], imageUrl: normalizeStickerUrl('/images/stickers/emotions/Teasing_.png'), width: 200, height: 200, order: 3, enabled: true, isAnimated: false },
    { id: 'emo_5', name: 'Stop', packId: 'emotions', category: 'emotion', keywords: ['stop', 'halt', 'no', 'enough'], imageUrl: normalizeStickerUrl('/images/stickers/emotions/Stop.png'), width: 200, height: 200, order: 4, enabled: true, isAnimated: false },

    // Thinking
    { id: 'think_1', name: 'Thinking', packId: 'thinking', category: 'thinking', keywords: ['thinking', 'hmm', 'wonder', 'consider'], imageUrl: normalizeStickerUrl('/images/stickers/thinking/Thinking.png'), width: 200, height: 200, order: 0, enabled: true, isAnimated: false },
    { id: 'think_2', name: 'Detective', packId: 'thinking', category: 'thinking', keywords: ['detective', 'investigate', 'spy', 'mystery'], imageUrl: normalizeStickerUrl('/images/stickers/thinking/Detective .png'), width: 200, height: 200, order: 1, enabled: true, isAnimated: false },
    { id: 'think_3', name: 'Taking Notes', packId: 'thinking', category: 'thinking', keywords: ['notes', 'writing', 'pay attention', 'learning'], imageUrl: normalizeStickerUrl('/images/stickers/thinking/Taking Notes.png'), width: 200, height: 200, order: 2, enabled: true, isAnimated: false },

    // Funny
    { id: 'fun_1', name: 'Bozo', packId: 'funny', category: 'funny', keywords: ['bozo', 'clown', 'silly', 'joke'], imageUrl: normalizeStickerUrl('/images/stickers/funny/Bozo.png'), width: 200, height: 200, order: 0, enabled: true, isAnimated: false },
    { id: 'fun_2', name: 'Music', packId: 'funny', category: 'funny', keywords: ['music', 'song', 'dance', 'rhythm'], imageUrl: normalizeStickerUrl('/images/stickers/funny/Music.png'), width: 200, height: 200, order: 1, enabled: true, isAnimated: false },
    { id: 'fun_3', name: 'Just Here', packId: 'funny', category: 'funny', keywords: ['lurking', 'present', 'here', 'watching'], imageUrl: normalizeStickerUrl('/images/stickers/funny/Just here.jpeg'), width: 200, height: 200, order: 2, enabled: true, isAnimated: false },
    { id: 'fun_4', name: 'What', packId: 'funny', category: 'funny', keywords: ['what', 'expression', 'face', 'reaction'], imageUrl: normalizeStickerUrl('/images/stickers/funny/W.E2.png'), width: 200, height: 200, order: 3, enabled: true, isAnimated: false },
    { id: 'fun_5', name: 'Wow', packId: 'funny', category: 'funny', keywords: ['wow', 'expression', 'face', 'reaction'], imageUrl: normalizeStickerUrl('/images/stickers/funny/WE1.png'), width: 200, height: 200, order: 4, enabled: true, isAnimated: false },
];

/**
 * StickerService — queries `stickerPacks` and `stickers` Firestore collections,
 * with web URL normalization and fallback seed data matching Ourlime-Web.
 */
export class StickerService {
    private static instance: StickerService;

    private constructor() {}

    public static getInstance(): StickerService {
        if (!StickerService.instance) {
            StickerService.instance = new StickerService();
        }
        return StickerService.instance;
    }

    /**
     * Real-time subscription to sticker packs.
     * Uses default web packs if Firestore returns empty.
     */
    public subscribeToPacks(callback: (packs: StickerPack[]) => void): () => void {
        const q = query(collection(db, PACKS_COLLECTION), orderBy('order', 'asc'));
        return onSnapshot(
            q,
            (snapshot) => {
                const packs = snapshot.docs
                    .map((d) => {
                        const data = d.data();
                        return {
                            id: d.id,
                            ...data,
                            icon: normalizeStickerUrl(data.icon),
                        } as StickerPack;
                    })
                    .filter((p) => p.enabled !== false);

                if (packs.length === 0) {
                    callback(DEFAULT_PACKS);
                } else {
                    callback(packs);
                }
            },
            (error) => {
                console.error('[StickerService.subscribeToPacks]', error);
                callback(DEFAULT_PACKS);
            }
        );
    }

    /**
     * Real-time subscription to all stickers.
     * Uses default web stickers if Firestore returns empty.
     */
    public subscribeToAllStickers(callback: (stickers: Sticker[]) => void): () => void {
        const q = query(collection(db, STICKERS_COLLECTION), orderBy('order', 'asc'));
        return onSnapshot(
            q,
            (snapshot) => {
                const stickers = snapshot.docs
                    .map((d) => {
                        const data = d.data();
                        return {
                            id: d.id,
                            ...data,
                            imageUrl: normalizeStickerUrl(data.imageUrl),
                        } as Sticker;
                    })
                    .filter((s) => s.enabled !== false);

                if (stickers.length === 0) {
                    callback(DEFAULT_STICKERS);
                } else {
                    callback(stickers);
                }
            },
            (error) => {
                console.error('[StickerService.subscribeToAllStickers]', error);
                callback(DEFAULT_STICKERS);
            }
        );
    }

    /**
     * Search / filter stickers client-side
     */
    public searchStickers(stickers: Sticker[], params: StickerSearchParams): Sticker[] {
        let results = [...stickers];

        if (params.packId) {
            results = results.filter((s) => s.packId === params.packId);
        }

        if (params.category) {
            results = results.filter(
                (s) => s.category.toLowerCase() === params.category!.toLowerCase()
            );
        }

        if (params.query) {
            const q = params.query.toLowerCase().trim();
            results = results.filter(
                (s) =>
                    s.name.toLowerCase().includes(q) ||
                    s.keywords.some((k) => k.toLowerCase().includes(q)) ||
                    s.category.toLowerCase().includes(q)
            );
        }

        return results;
    }
}

export const stickerService = StickerService.getInstance();
