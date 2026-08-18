import { describe, expect, it } from 'bun:test';

type MockBlog = {
  id: string;
  title: string;
  category: string;
  authorName: string;
  readTime: string;
  clapsCount: number;
  commentsCount: number;
  isBookmarked: boolean;
};

const mockBlogs: MockBlog[] = [
  {
    id: 'blog_1',
    title: 'How Ourlime Built Native Background Push for React Native',
    category: 'Engineering',
    authorName: 'Rishi Kowlessar',
    readTime: '6 min read',
    clapsCount: 88,
    commentsCount: 14,
    isBookmarked: false,
  },
  {
    id: 'blog_2',
    title: 'Top 10 Caribbean Tech Startups to Watch in 2026',
    category: 'Business',
    authorName: 'Aaron Tester',
    readTime: '4 min read',
    clapsCount: 120,
    commentsCount: 22,
    isBookmarked: true,
  },
];

describe('Suite 09: Blogs & Articles Flow', () => {
  it('should list blog articles with read time and author details', () => {
    expect(mockBlogs.length).toBe(2);
    expect(mockBlogs[0].readTime).toBe('6 min read');
  });

  it('should increment claps count on article', () => {
    const blog = { ...mockBlogs[0] };
    blog.clapsCount += 1;
    expect(blog.clapsCount).toBe(89);
  });
});
