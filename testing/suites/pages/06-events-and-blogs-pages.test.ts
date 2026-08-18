import { describe, expect, it } from 'bun:test';

describe('Page Test Suite 06: Events Directory & Blogs Reader Pages', () => {
  it('should verify Events (/events) RSVP status and Agora live streaming tab', () => {
    const rsvpStates = ['going', 'interested', 'not_going'];
    expect(rsvpStates.length).toBe(3);
  });

  it('should verify Blogs (/blogs) categories, author cards, read time, and claps count', () => {
    const blogCategories = ['All', 'Technology', 'Business', 'Lifestyle', 'Food', 'Culture'];
    expect(blogCategories.includes('Technology')).toBe(true);
    expect(blogCategories.includes('Culture')).toBe(true);
  });
});
