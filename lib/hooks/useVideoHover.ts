import { useRef, useCallback, useState } from 'react';
import { isMobile } from 'react-device-detect';
import type { VideoRefs, VideoHoverHandler } from '@/lib/types/video';

export const useVideoHover = () => {
    const videoRefs = useRef<VideoRefs>([]);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const handleVideoHover: VideoHoverHandler = useCallback((index, isHovering) => {
        if (!isMobile) {
            setHoveredIndex(isHovering ? index : null);
            const video = videoRefs.current[index];
            if (video) {
                if (isHovering) {
                    // Use a promise to handle autoplay restrictions
                    video.play().catch(() => {
                        console.log('Autoplay prevented by browser');
                    });
                } else {
                    video.pause();
                    video.currentTime = 0;
                }
            }
        }
    }, []);

    return { videoRefs, handleVideoHover, hoveredIndex };
}; 