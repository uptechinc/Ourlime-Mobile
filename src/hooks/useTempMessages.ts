// src/hooks/useTempMessages.ts
import { useState } from 'react';
import { useProfileStore } from '@/src/store/useProfileStore';

export const useTempMessages = () => {
    const [loading, setLoading] = useState(false);
    const userData = useProfileStore.getState();

    const getTempMessages = async (receiverId: string, productId: string) => {
        setLoading(true);
        try {
            const response = await fetch(
                `/api/temp-messaging/${receiverId}?senderId=${userData.id}&productId=${productId}`
            );
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching temp messages:', error);
            return { messages: [] };
        } finally {
            setLoading(false);
        }
    };

    const sendTempMessage = async (receiverId: string, message: string, productContext: {
        productTitle: string,
        productImage: string,
        colorVariant: string | null,
        sizeVariant: string | null,
        price: string | null
    }) => {
        setLoading(true);
        try {
            const response = await fetch('/api/temp-messaging', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receiverId,
                    message,
                    senderId: userData.id,
                    productContext
                })
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error sending temp message:', error);
            return {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        } finally {
            setLoading(false);
        }
    };
    
    return { sendTempMessage, getTempMessages, loading };
};
