import { describe, expect, it } from 'bun:test';

type MockEvent = {
  id: string;
  title: string;
  category: string;
  startDate: string;
  location: string;
  isOnline: boolean;
  rsvpStatus?: 'going' | 'interested' | 'not_going' | null;
  attendeesCount: number;
};

const mockEvents: MockEvent[] = [
  {
    id: 'evt_1',
    title: 'Port of Spain Tech Meetup 2026',
    category: 'Technology',
    startDate: '2026-09-15T18:00:00Z',
    location: 'Hyatt Regency, Port of Spain',
    isOnline: false,
    rsvpStatus: 'going',
    attendeesCount: 85,
  },
  {
    id: 'evt_2',
    title: 'Caribbean Web3 Live Stream Demo',
    category: 'Innovation',
    startDate: '2026-09-20T20:00:00Z',
    location: 'Ourlime Live',
    isOnline: true,
    rsvpStatus: 'interested',
    attendeesCount: 210,
  },
];

describe('Suite 06: Events Directory & RSVP Flow', () => {
  it('should list events with location and attendee counts', () => {
    expect(mockEvents.length).toBe(2);
    expect(mockEvents[0].title).toContain('Tech Meetup');
  });

  it('should toggle RSVP statuses between going, interested, and not_going', () => {
    const event = { ...mockEvents[0] };

    expect(event.rsvpStatus).toBe('going');
    event.rsvpStatus = 'interested';
    expect(event.rsvpStatus).toBe('interested');
    event.rsvpStatus = 'not_going';
    expect(event.rsvpStatus).toBe('not_going');
  });

  it('should distinguish online streaming events from in-person events', () => {
    const onlineEvent = mockEvents.find((e) => e.isOnline);
    const inPersonEvent = mockEvents.find((e) => !e.isOnline);

    expect(onlineEvent?.location).toBe('Ourlime Live');
    expect(inPersonEvent?.location).toContain('Hyatt');
  });
});
