export const mockCommunityData = {
  id: 'community-123',
  title: 'React Native Developers',
  description: 'A community for React Native developers to share knowledge, ask questions, and collaborate on projects. Whether you\'re a beginner or an expert, everyone is welcome!',
  imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=200&fit=crop',
  isPrivate: false,
  userId: 'current-user-id', // Current user is admin
  categoryId: 'tech',
  createdAt: {
    seconds: 1700000000, // Mock timestamp
    nanoseconds: 0
  }
};

export const mockPosts = [
  {
    id: 'post-1',
    title: 'Best Practices for React Native Performance',
    content: 'I\'ve been working on optimizing my React Native app and wanted to share some tips that have really helped improve performance. Here are the key areas to focus on...',
    timestamp: '2024-01-15T10:30:00Z',
    author: {
      firstName: 'Sarah',
      lastName: 'Johnson',
      userName: 'sarahj',
      profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face',
      role: 'Senior Developer'
    },
    mediaDetails: {
      imageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cce?w=400&h=200&fit=crop',
      type: 'image'
    },
    commentCount: 12,
    likeCount: 24
  },
  {
    id: 'post-2',
    title: 'New React Native 0.72 Features',
    content: 'Just updated to the latest version and I\'m excited about the new features! The improved debugging tools and better TypeScript support are game changers.',
    timestamp: '2024-01-14T15:45:00Z',
    author: {
      firstName: 'Mike',
      lastName: 'Chen',
      userName: 'mikechen',
      profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
      role: 'Tech Lead'
    },
    mediaDetails: null,
    commentCount: 8,
    likeCount: 18
  },
  {
    id: 'post-3',
    title: 'Building Cross-Platform Apps with Expo',
    content: 'Sharing my experience building a cross-platform app using Expo. The development workflow is so smooth and the built-in tools make deployment a breeze.',
    timestamp: '2024-01-13T09:15:00Z',
    author: {
      firstName: 'Emily',
      lastName: 'Rodriguez',
      userName: 'emilyr',
      profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
      role: 'Mobile Developer'
    },
    mediaDetails: {
      imageUrl: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=400&h=200&fit=crop',
      type: 'image'
    },
    commentCount: 15,
    likeCount: 32
  }
];

export const mockMembers = [
  {
    userId: 'user-1',
    firstName: 'Sarah',
    lastName: 'Johnson',
    userName: 'sarahj',
    profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face',
    role: 'Senior Developer',
    joinedAt: '2024-01-01T00:00:00Z'
  },
  {
    userId: 'user-2',
    firstName: 'Mike',
    lastName: 'Chen',
    userName: 'mikechen',
    profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    role: 'Tech Lead',
    joinedAt: '2024-01-02T00:00:00Z'
  },
  {
    userId: 'user-3',
    firstName: 'Emily',
    lastName: 'Rodriguez',
    userName: 'emilyr',
    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
    role: 'Mobile Developer',
    joinedAt: '2024-01-03T00:00:00Z'
  },
  {
    userId: 'user-4',
    firstName: 'David',
    lastName: 'Kim',
    userName: 'davidk',
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    role: 'Full Stack Developer',
    joinedAt: '2024-01-04T00:00:00Z'
  },
  {
    userId: 'user-5',
    firstName: 'Lisa',
    lastName: 'Wang',
    userName: 'lisaw',
    profileImage: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face',
    role: 'UI/UX Designer',
    joinedAt: '2024-01-05T00:00:00Z'
  },
  {
    userId: 'current-user-id',
    firstName: 'You',
    lastName: 'Admin',
    userName: 'admin',
    profileImage: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face',
    role: 'Community Admin',
    joinedAt: '2024-01-01T00:00:00Z'
  }
];

export const mockCategories = [
  {
    id: 'tech',
    type: 'Technology',
    bannerImageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=200&fit=crop'
  },
  {
    id: 'design',
    type: 'Design',
    bannerImageUrl: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=400&h=200&fit=crop'
  },
  {
    id: 'business',
    type: 'Business',
    bannerImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=200&fit=crop'
  }
];

export const mockEvents = [
  {
    id: 'event-1',
    title: 'React Native Meetup',
    description: 'Monthly meetup for React Native developers to share knowledge and network',
    date: '2024-02-15T18:00:00Z',
    location: 'Tech Hub, San Francisco',
    attendees: 45,
    maxAttendees: 100
  },
  {
    id: 'event-2',
    title: 'Mobile App Workshop',
    description: 'Hands-on workshop for building mobile apps with React Native',
    date: '2024-02-20T10:00:00Z',
    location: 'Online',
    attendees: 23,
    maxAttendees: 50
  },
  {
    id: 'event-3',
    title: 'UI/UX Design Session',
    description: 'Learn the latest design trends and best practices for mobile apps',
    date: '2024-02-25T14:00:00Z',
    location: 'Design Studio, New York',
    attendees: 67,
    maxAttendees: 80
  },
  {
    id: 'event-4',
    title: 'Code Review Session',
    description: 'Community code review session - bring your projects!',
    date: '2024-03-01T19:00:00Z',
    location: 'Online',
    attendees: 12,
    maxAttendees: 25
  }
];

export const mockPolls = [
  {
    id: 'poll-1',
    question: 'What\'s your preferred state management solution?',
    options: [
      { id: '1', text: 'Redux', votes: 15 },
      { id: '2', text: 'Zustand', votes: 8 },
      { id: '3', text: 'Context API', votes: 12 },
      { id: '4', text: 'Other', votes: 5 }
    ],
    totalVotes: 40,
    endDate: '2024-02-01T23:59:59Z',
    author: {
      firstName: 'Alice',
      lastName: 'Smith',
      userName: 'alicesmith',
      profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face',
      role: 'Tech Lead'
    },
    timestamp: '2024-01-14T15:45:00Z'
  },
  {
    id: 'poll-2',
    question: 'Best way to stay productive?',
    options: [
      { id: '1', text: 'Early morning workout', votes: 25 },
      { id: '2', text: 'Pomodoro technique', votes: 18 },
      { id: '3', text: 'Meditation', votes: 12 },
      { id: '4', text: 'Music while working', votes: 8 }
    ],
    totalVotes: 63,
    endDate: '2024-02-15T23:59:59Z',
    author: {
      firstName: 'David',
      lastName: 'Brown',
      userName: 'davidb',
      profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
      role: 'Product Manager'
    },
    timestamp: '2024-01-13T09:15:00Z'
  }
];

export const mockFriendsInCommunities = [
  {
    firstName: 'Alex',
    lastName: 'Thompson',
    userName: 'alexthompson',
    communityIds: ['community-123', 'community-456']
  },
  {
    firstName: 'Jessica',
    lastName: 'Brown',
    userName: 'jessicabrown',
    communityIds: ['community-123']
  }
];


