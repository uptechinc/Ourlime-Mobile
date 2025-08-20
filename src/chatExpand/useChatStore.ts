import { create } from 'zustand';

interface ChatState {
    windowSize: 'closed' | 'compact' | 'full';
    activeTab: 'friends' | 'business' | 'discover';
    selectedChat: string | null;
    setWindowSize: (size: 'closed' | 'compact' | 'full') => void;
    setActiveTab: (tab: 'friends' | 'business' | 'discover') => void;
    setSelectedChat: (chatId: string | null) => void;
    openBusinessChat: (receiverId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
    windowSize: 'closed',
    activeTab: 'friends',
    selectedChat: null,
    setWindowSize: (size) => set({ windowSize: size }),
    setActiveTab: (tab) => set({ activeTab: tab }),
    setSelectedChat: (chatId) => set({ selectedChat: chatId }),
    openBusinessChat: (receiverId) => set({ 
        windowSize: 'compact',
        activeTab: 'business',
        selectedChat: receiverId 
    })
}));
