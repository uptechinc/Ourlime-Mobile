import type { AdsTone } from '@/components/ads/AdsUi';

/** Chip tones matching the website's NextUI chip colours for each ads value. */
export function displayTypeTone(displayType: string): AdsTone {
  switch (displayType) {
    case 'digital': return 'info';
    case 'social': return 'purple';
    case 'physical': return 'success';
    default: return 'neutral';
  }
}

export function bookingStatusTone(status: string): AdsTone {
  switch (status) {
    case 'completed': return 'success';
    case 'active': return 'info';
    case 'paid': return 'purple';
    case 'pending_payment': return 'warning';
    case 'cancelled':
    case 'disputed': return 'danger';
    default: return 'neutral';
  }
}

export function offerStatusTone(status: string): AdsTone {
  switch (status) {
    case 'active': return 'success';
    case 'paused': return 'warning';
    case 'completed': return 'info';
    case 'archived': return 'danger';
    default: return 'neutral';
  }
}

export function verificationTone(status: string): AdsTone {
  switch (status) {
    case 'verified': return 'success';
    case 'pending': return 'warning';
    case 'rejected':
    case 'suspended': return 'danger';
    default: return 'neutral';
  }
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
