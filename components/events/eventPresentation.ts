import type { Event, EventStatus } from '@/types/eventTypes';

/** Formatting and filter options shared by the events screens (same wording and rules as the website). */
export const EVENT_CATEGORIES = ['Cultural', 'Sports and Recreation', 'Educational', 'Corporate', 'Parties and Celebrations'] as const;

export const EVENT_RECURRENCE_OPTIONS = [
  { key: 'none', label: 'Does not repeat' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
] as const;

export const ACCESSIBILITY_OPTIONS = [
  { value: 'wheelchair-access', label: 'Wheelchair accessible' },
  { value: 'sign-language', label: 'Sign language' },
  { value: 'hearing-loop', label: 'Hearing loop' },
  { value: 'accessible-parking', label: 'Accessible parking' },
  { value: 'quiet-space', label: 'Quiet space' },
  { value: 'assistance', label: 'Assistance available' },
] as const;

export type EventDateFilter = 'all' | 'today' | 'week' | 'month' | 'upcoming';
export type EventFormatFilter = 'all' | 'online' | 'inperson';
export type EventPriceFilter = 'all' | 'free' | 'paid';
export type EventSort = 'soonest' | 'newest' | 'distance' | 'popularity';
export type EventViewMode = 'grid' | 'list' | 'calendar';
export type Coordinates = { lat: number; lng: number };

export const DATE_OPTIONS: { value: EventDateFilter; label: string }[] = [
  { value: 'all', label: 'Any time' }, { value: 'today', label: 'Today' }, { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' }, { value: 'upcoming', label: 'Upcoming' },
];
export const FORMAT_OPTIONS: { value: EventFormatFilter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'online', label: 'Online' }, { value: 'inperson', label: 'In-person' },
];
export const PRICE_OPTIONS: { value: EventPriceFilter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'free', label: 'Free' }, { value: 'paid', label: 'Paid' },
];
export const RADIUS_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Anywhere' }, { value: 5, label: '≤ 5 km' }, { value: 10, label: '≤ 10 km' }, { value: 25, label: '≤ 25 km' }, { value: 50, label: '≤ 50 km' },
];
export const SORT_LABELS: { [key in EventSort]: string } = { soonest: 'Soonest', newest: 'Newest', distance: 'Distance', popularity: 'Popularity' };

export const STATUS_BADGES: { [key in EventStatus]?: { label: string; tone: 'warning' | 'info' | 'danger' | 'success' | 'muted' } } = {
  draft: { label: 'Draft', tone: 'warning' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  sold_out: { label: 'Sold out', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  completed: { label: 'Completed', tone: 'success' },
  archived: { label: 'Archived', tone: 'muted' },
  removed: { label: 'Removed', tone: 'muted' },
};

/** "Mar 4 · 6:00 PM - 9:00 PM" on one day, otherwise "Mar 4 - Mar 6" (the website's card format). */
export function formatEventRange(startValue: string, endValue: string): string {
  const start = new Date(startValue);
  const end = new Date(endValue || startValue);
  if (Number.isNaN(start.getTime())) return 'Date to be announced';
  const month = (date: Date): string => date.toLocaleString('en-US', { month: 'short' });
  const time = (date: Date): string => date.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
  if (Number.isNaN(end.getTime()) || start.toDateString() === end.toDateString()) {
    return `${month(start)} ${start.getDate()} · ${time(start)}${Number.isNaN(end.getTime()) ? '' : ` - ${time(end)}`}`;
  }
  return `${month(start)} ${start.getDate()} - ${month(end)} ${end.getDate()}`;
}

/** The detail page's long form: "Monday, March 4, 2026, 6:00 PM - 9:00 PM". */
export function formatEventLong(startValue: string, endValue: string): string {
  const start = new Date(startValue);
  const end = new Date(endValue || startValue);
  if (Number.isNaN(start.getTime())) return 'Date to be announced';
  const day = (date: Date): string => date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const time = (date: Date): string => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
  if (Number.isNaN(end.getTime())) return `${day(start)}, ${time(start)}`;
  return day(start) === day(end) ? `${day(start)}, ${time(start)} - ${time(end)}` : `${day(start)}, ${time(start)} - ${day(end)}, ${time(end)}`;
}

export function daysRemaining(startValue: string): number {
  return Math.ceil((new Date(startValue).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function daysLeftLabel(days: number): string {
  if (days <= 0) return 'Today!';
  if (days === 1) return 'Tomorrow';
  return `${days}d left`;
}

export function distanceKm(from: Coordinates, to: Coordinates): number {
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(value));
}

export function eventDistance(event: Event, location: Coordinates | null): number | null {
  if (!location || typeof event.lat !== 'number' || typeof event.lng !== 'number') return null;
  return distanceKm(location, { lat: event.lat, lng: event.lng });
}

export function accessibilityLabel(value: string): string {
  return ACCESSIBILITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export type EventFilters = {
  search: string;
  category: string;
  tags: string[];
  date: EventDateFilter;
  format: EventFormatFilter;
  price: EventPriceFilter;
  accessibility: string[];
  radiusKm: number | null;
};

export const DEFAULT_EVENT_FILTERS: EventFilters = { search: '', category: 'All', tags: [], date: 'all', format: 'all', price: 'all', accessibility: [], radiusKm: null };

/** The website's events page filter (search, category, tags, when, format, price, accessibility, distance). */
export function matchesEventFilters(event: Event, filters: EventFilters, location: Coordinates | null): boolean {
  const query = filters.search.trim().toLowerCase();
  const tags = event.tags ?? [];
  const start = new Date(event.startDate);
  const now = Date.now();
  const matchesSearch = !query || [event.title, event.description ?? '', event.summary, event.location, event.category ?? '', event.organizer?.name ?? '', ...tags]
    .some((value) => value.toLowerCase().includes(query));
  const matchesCategory = filters.category === 'All' || event.category === filters.category;
  const matchesTags = filters.tags.length === 0 || filters.tags.some((tag) => tags.includes(tag));
  const matchesDate = filters.date === 'all'
    || (filters.date === 'today' && start.toDateString() === new Date().toDateString())
    || (filters.date === 'week' && start.getTime() >= now && start.getTime() <= now + 7 * 86400000)
    || (filters.date === 'month' && start.getTime() >= now && start.getTime() <= now + 30 * 86400000)
    || (filters.date === 'upcoming' && start.getTime() > now);
  const matchesFormat = filters.format === 'all' || (filters.format === 'online' ? event.isVirtual === true : event.isVirtual !== true);
  const isPaid = event.isFree === false && event.ticketPrice != null && Number(event.ticketPrice) > 0;
  const matchesPrice = filters.price === 'all' || (filters.price === 'free' ? !isPaid : isPaid);
  const access = event.accessibility ?? [];
  const matchesAccessibility = filters.accessibility.length === 0 || (access.length > 0 && filters.accessibility.every((item) => access.includes(item)));
  let matchesDistance = true;
  if (filters.radiusKm != null && location) {
    const distance = eventDistance(event, location);
    matchesDistance = distance !== null && distance <= filters.radiusKm;
  }
  return matchesSearch && matchesCategory && matchesTags && matchesDate && matchesFormat && matchesPrice && matchesAccessibility && matchesDistance;
}

export function sortEvents(events: Event[], sort: EventSort, location: Coordinates | null, attendeeCounts: { [eventId: string]: number }): Event[] {
  const time = (value: string | undefined): number => (value ? new Date(value).getTime() || 0 : 0);
  return [...events].sort((left, right) => {
    if (sort === 'soonest') return time(left.startDate) - time(right.startDate);
    if (sort === 'newest') return (time(right.createdAt) - time(left.createdAt)) || (time(right.startDate) - time(left.startDate));
    if (sort === 'distance') {
      const leftDistance = eventDistance(left, location);
      const rightDistance = eventDistance(right, location);
      if (leftDistance === null && rightDistance === null) return 0;
      if (leftDistance === null) return 1;
      if (rightDistance === null) return -1;
      return leftDistance - rightDistance;
    }
    const popularity = (event: Event): number => attendeeCounts[event.id ?? ''] ?? 0;
    return (popularity(right) - popularity(left)) || (right.likeCount - left.likeCount);
  });
}
