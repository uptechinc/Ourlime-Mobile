import { useEffect, useMemo, useRef } from 'react';
import { PanResponder, Text, View } from 'react-native';
import { playbackInteractionService, type PlaybackSession, type PlaybackSnapshot } from '@/lib/services/PlaybackInteractionService';

type PlaybackSeekBarProps = {
  session: PlaybackSession;
  snapshot: PlaybackSnapshot;
  onChange: () => void;
  onSeekingChange?: (seeking: boolean) => void;
};
export function PlaybackSeekBar({ session, snapshot, onChange, onSeekingChange }: PlaybackSeekBarProps) {
  const width = useRef(0);
  const start = useRef(0);
  const ownsGesture = useRef(false);
  const callbacks = useRef({ onChange, onSeekingChange });
  callbacks.current = { onChange, onSeekingChange };
  useEffect(() => () => {
    session.cancel(false);
    if (ownsGesture.current) callbacks.current.onSeekingChange?.(false);
    ownsGesture.current = false;
  }, [session]);
  useEffect(() => {
    if (snapshot.status !== 'dragging' && ownsGesture.current) {
      ownsGesture.current = false;
      callbacks.current.onSeekingChange?.(false);
    }
  }, [snapshot.status]);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => session.snapshot().duration > 0,
    onMoveShouldSetPanResponder: () => session.snapshot().duration > 0,
    onPanResponderGrant: (event) => {
      if (!session.begin()) return;
      start.current = event.nativeEvent.locationX;
      ownsGesture.current = true;
      callbacks.current.onSeekingChange?.(true);
      session.preview(start.current, width.current);
      callbacks.current.onChange();
    },
    onPanResponderMove: (_event, gesture) => {
      session.preview(start.current + gesture.dx, width.current);
      callbacks.current.onChange();
    },
    onPanResponderRelease: (_event, gesture) => {
      session.preview(start.current + gesture.dx, width.current);
      session.commit();
      if (ownsGesture.current) callbacks.current.onSeekingChange?.(false);
      ownsGesture.current = false;
      callbacks.current.onChange();
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: () => {
      session.cancel();
      if (ownsGesture.current) callbacks.current.onSeekingChange?.(false);
      ownsGesture.current = false;
      callbacks.current.onChange();
    },
  }), [session]);
  const progress = snapshot.duration > 0 ? snapshot.time / snapshot.duration * 100 : 0;
  const interacting = snapshot.status !== 'idle';
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 120 }}>
      {interacting || snapshot.error ? <Text pointerEvents="none" style={{ alignSelf: 'center', backgroundColor: '#000c', color: '#fff', padding: 5, borderRadius: 6 }}>
        {snapshot.error || `${playbackInteractionService.formatTime(snapshot.time)} / ${playbackInteractionService.formatTime(snapshot.duration)}`}
      </Text> : null}
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Video position"
        accessibilityValue={{ min: 0, max: snapshot.duration, now: snapshot.time }}
        accessibilityState={{ disabled: !snapshot.duration }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (!session.begin()) return;
          session.preview(snapshot.time + (event.nativeEvent.actionName === 'increment' ? 5 : -5), snapshot.duration);
          session.commit();
          onChange();
        }}
        onLayout={(event) => { width.current = event.nativeEvent.layout.width; }}
        {...responder.panHandlers}
        style={{ height: 44, justifyContent: 'flex-end' }}
      >
        <View pointerEvents="none" style={{ height: interacting ? 4 : 2, backgroundColor: '#ffffff55' }}>
          <View style={{ height: '100%', width: `${progress}%`, backgroundColor: '#10b981' }} />
          {interacting ? <View style={{ position: 'absolute', left: `${Math.min(98, progress)}%`, bottom: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' }} /> : null}
        </View>
      </View>
    </View>
  );
}
