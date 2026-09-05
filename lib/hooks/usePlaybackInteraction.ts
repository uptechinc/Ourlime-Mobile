import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import type { VideoPlayer } from 'expo-video';
import { playbackInteractionService, type PlaybackSpeed } from '@/lib/services/PlaybackInteractionService';

export function usePlaybackInteraction(player: VideoPlayer, active: boolean, speed: PlaybackSpeed = 1) {
  const focused = useIsFocused();
  const eligible = active && focused;
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const session = useMemo(() => playbackInteractionService.createSession({
    time: () => player.currentTime,
    duration: () => player.duration,
    playing: () => player.playing,
    seek: (time) => { player.currentTime = time; },
    play: () => player.play(),
    pause: () => player.pause(),
    rate: (rate) => { player.playbackRate = rate; },
  }), [player]);
  const [snapshot, setSnapshot] = useState(session.snapshot());
  useEffect(() => {
    session.setActive(eligible && AppState.currentState === 'active');
    if (!eligible) { try { player.pause(); } catch { /* Released. */ } }
    const listener = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      session.setActive(eligible && state === 'active');
      if (state !== 'active') { try { player.pause(); } catch { /* Released. */ } }
    });
    const timer = setInterval(() => setSnapshot(session.tick()), 100);
    return () => { clearInterval(timer); listener.remove(); session.setActive(false); };
  }, [eligible, player, session]);
  useEffect(() => { session.setSpeed(speed); }, [session, speed]);
  return { session, snapshot, isPlaybackActive: eligible && foreground, refresh: () => setSnapshot(session.snapshot()) };
}
