# CommunityDetail (React Native static port)

## What this is

This is a static-only React Native port of the community detail page from `app/communities/[id]/page.tsx`. The component renders a complete community interface with posts, members, events, and admin controls using mock data instead of live API calls.

## Differences from web

- **Layout**: Converted from 3-column grid to single-column mobile-first layout with vertical stacking
- **Navigation**: Replaced Next.js routing with Pressable components and navigation callbacks
- **Components**: 
  - `<div>` → `<View>`, `<span>/<p>` → `<Text>`, `<img>` → `<Image>`
  - HTML lists → `FlatList` components for posts and members
  - CSS classes → `StyleSheet.create()` objects
- **Interactions**: All buttons and forms are present but use mock data and console.log TODOs
- **Modals**: Converted to React Native `Modal` components with basic styling
- **Touch targets**: All interactive elements meet 44×44 minimum touch target requirements
- **Typography**: Adjusted font sizes for mobile readability (16-18pt body text, larger headings)
- **Spacing**: Increased padding and margins for better mobile touch experience

## How to wire real data later

### Replace mock data
1. **Community data**: Replace `mockCommunityData` in `data.mock.ts` with API calls in `useEffect`
2. **Posts**: Replace `mockPosts` with real posts from your API endpoint
3. **Members**: Replace `mockMembers` with actual community membership data
4. **Events/Polls**: Add real event and poll data fetching

### Add real handlers
1. **Navigation**: Implement `onNavigateToProfile` and `onNavigateToCommunities` props
2. **API calls**: Replace all `console.log('TODO: ...')` with actual API calls:
   - `handleLike()` - Like/unlike posts
   - `handleCommunityLike()` - Like/unlike community
   - `handleEditSubmit()` - Update community details
   - `handleCreatePost/Event/Poll()` - Navigate to creation flows
   - `handleRemoveUser/BanUser()` - Admin actions
   - `handleDeletePost()` - Delete posts

### State management
- Add loading states for API calls
- Implement error handling for failed requests
- Add optimistic updates for better UX

## Assets to provide

- **Profile images**: Currently using Unsplash placeholder URLs - replace with actual user avatars
- **Community banner**: Replace placeholder with real community images
- **Post media**: Replace placeholder images with actual post content
- **Icons**: Currently using emoji - consider adding `react-native-vector-icons` for better iconography

## Props & data contract

```typescript
interface CommunityDetailProps {
  communityId: string;                    // Required: ID of community to display
  onNavigateToProfile?: (userId: string) => void;  // Optional: Navigate to user profile
  onNavigateToCommunities?: () => void;  // Optional: Navigate back to communities list
}
```

### Mock data structure
- `mockCommunityData`: Community details, settings, metadata
- `mockPosts`: Array of community posts with author info and media
- `mockMembers`: Array of community members with profile data
- `mockCategories`: Available community categories
- `mockEvents`: Community events (currently placeholder)
- `mockPolls`: Community polls (currently placeholder)

## Known gaps / TODOs

- **Real-time updates**: No live data synchronization (posts, likes, comments)
- **Image handling**: No image upload/selection for community banner
- **Form validation**: Edit form lacks client-side validation
- **Error states**: No error handling for failed API calls
- **Loading states**: No loading indicators for async operations
- **Offline support**: No offline data persistence
- **Push notifications**: No notification handling for community updates
- **Search/filtering**: No search functionality for posts or members
- **Infinite scroll**: Posts list doesn't support pagination
- **Accessibility**: Limited accessibility features (screen reader support, etc.)

## Integration

### Route Configuration
- **Route name**: `community-detail`
- **File location**: `app/community-detail.tsx`
- **Access path**: `/community-detail`

### Navigation Setup
The component is integrated into the existing Expo Router navigation system:
- Added to slide-out menu in home screen (`app/(tabs)/index.tsx`)
- Menu item: "Community Detail Demo" with people-circle icon
- Uses `router.push("/community-detail")` for navigation

### Mock Data Location
- **File**: `mobile/CommunityDetail/data.mock.ts`
- **Replace with**: Real API calls in `useEffect` hooks
- **Key data**: `mockCommunityData`, `mockPosts`, `mockMembers`, `mockCategories`

### Stub Handlers in index.tsx
All handlers currently log to console and need real implementation:
- `handleLike()` - Like/unlike posts
- `handleCommunityLike()` - Like/unlike community
- `handleEditSubmit()` - Update community details
- `handleCreatePost/Event/Poll()` - Navigate to creation flows
- `handleRemoveUser/BanUser()` - Admin actions
- `handleDeletePost()` - Delete posts
- `handleJoinCommunity()` - Join/leave community
- `handleShare()` - Share community
- `handleRefresh()` - Refresh data

## Usage example

```tsx
import CommunityDetail from '../mobile/CommunityDetail';

// In your navigation stack
<CommunityDetail 
  communityId="community-123"
  onNavigateToProfile={(userId) => navigation.navigate('Profile', { userId })}
  onNavigateToCommunities={() => navigation.goBack()}
/>
```
