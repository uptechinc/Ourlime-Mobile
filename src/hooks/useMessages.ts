import { useState } from 'react';
import { useProfileStore } from '@/src/store/useProfileStore';

export const useMessages = () => {
    const [loading, setLoading] = useState(false);
    const userData = useProfileStore.getState();

    const getMessages = async (receiverId: string) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/messaging/${receiverId}?senderId=${userData.id}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching messages:', error);
            return { messages: [] };
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async (receiverId: string, message: string) => {
        setLoading(true);
        try {
            const response = await fetch('/api/messaging', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receiverId,
                    message,
                    senderId: userData.id
                })
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error sending message:', error);
            return {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        } finally {
            setLoading(false);
        }
    };

    return { sendMessage, getMessages, loading };
};
