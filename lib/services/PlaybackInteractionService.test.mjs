import { describe, expect, test } from 'bun:test';
import { playbackInteractionService } from './PlaybackInteractionService.ts';
function fixture() {
  const player = { time: 12, duration: 0, playing: true, speed: 1, seeks: [], plays: 0, fail: false, now: 0 };
  const session = playbackInteractionService.createSession({
    time: () => player.time, duration: () => player.duration, playing: () => player.playing,
    pause: () => { player.playing = false; }, play: () => { player.playing = true; player.plays++; },
    seek: (time) => { if (player.fail) throw Error('failed'); player.seeks.push(time); },
    rate: (speed) => { player.speed = speed; },
  }, () => player.now);
  session.setActive(true);
  return { player, session };
}
describe('PlaybackInteractionService', () => {
  test('uses late-loaded duration and measured track width', () => {
    const { player, session } = fixture();
    expect(session.begin()).toBe(false);
    player.duration = 120;
    expect(session.begin()).toBe(true);
    session.preview(150, 300);
    session.commit();
    expect(player.seeks).toEqual([60]);
  });
  test('does not snap to stale progress while dragging or settling', () => {
    const { player, session } = fixture(); player.duration = 120;
    session.begin(); session.preview(90, 120);
    expect(session.tick().time).toBe(90);
    session.commit(); expect(session.tick().time).toBe(90);
    expect(player.playing).toBe(false);
    player.time = 90; session.tick();
    expect(player.playing).toBe(false);
    player.time = 12; session.tick();
    expect(session.snapshot().time).toBe(90);
    player.time = 90; session.tick(); session.tick();
    expect(player.playing).toBe(true);
    expect(player.plays).toBe(1);
  });
  test('rewinds, clamps endpoints, and ignores invalid geometry', () => {
    const { player, session } = fixture(); player.duration = 120;
    session.begin(); session.preview(5, 120); expect(session.snapshot().time).toBe(5);
    session.preview(-50, 120); expect(session.snapshot().time).toBe(0);
    session.preview(150, 120); expect(session.snapshot().time).toBe(120);
    session.preview(0, 0); expect(session.snapshot().time).toBe(120);
  });
  test('a paused player stays paused after seeking', () => {
    const { player, session } = fixture(); player.duration = 120; player.playing = false;
    session.begin(); session.preview(30, 120); session.commit();
    player.time = 30; session.tick(); session.tick(); expect(player.plays).toBe(0);
  });
  test('cancel restores prior playback but deactivation never resumes', () => {
    const { player, session } = fixture(); player.duration = 120;
    session.begin(); session.preview(30, 120); session.cancel();
    expect(session.snapshot().time).toBe(12); expect(player.plays).toBe(1);
    session.begin(); session.commit(); session.setActive(false);
    player.time = 12; session.tick(); expect(player.plays).toBe(1);
  });
  test('slow and failed seeks have a bounded failure state', () => {
    const { player, session } = fixture(); player.duration = 120;
    session.begin(); session.preview(80, 120); session.commit(); player.now = 2600;
    expect(session.tick().status).toBe('idle'); expect(session.snapshot().error).not.toBeNull();
    player.fail = true; session.begin(); session.commit();
    expect(session.snapshot().status).toBe('idle'); expect(player.playing).toBe(true);
  });
  test('temporary speed restores selected rate and never survives deactivation', () => {
    const { player, session } = fixture();
    session.setSpeed(1.5); session.beginHold(); expect(player.speed).toBe(2);
    session.endHold(); expect(player.speed).toBe(1.5);
    session.beginHold(); session.setActive(false);
    expect(player.speed).toBe(1.5); expect(session.snapshot().holding).toBe(false);
  });
  test('holding is ignored while paused or scrubbing', () => {
    const { player, session } = fixture(); player.duration = 120; player.playing = false;
    session.beginHold(); expect(player.speed).toBe(1);
    session.begin(); session.beginHold(); expect(player.speed).toBe(1);
  });
  test('sessions remain independent and reject nonfinite durations', () => {
    const first = fixture(); const second = fixture();
    first.player.duration = Infinity; expect(first.session.begin()).toBe(false);
    first.session.setSpeed(2); expect(second.player.speed).toBe(1);
    expect(playbackInteractionService.formatTime(NaN)).toBe('0:00');
    expect(playbackInteractionService.formatTime(91)).toBe('1:31');
  });
});
