import type { SocialPosts } from '@/types/global';
import AllPosts from './filteredPosts/AllPost';
import PhotosPosts from './filteredPosts/PhotosPosts';
import VideosPosts from './filteredPosts/VideosPosts';
import { View, Text } from 'react-native';

export default function Posts({
  selectedPost,
  socialPosts,
}: {
  selectedPost: string;
  socialPosts: SocialPosts[];
}) {
  return (
    <View style={{ flex: 1, width: '100%' }}>
      {selectedPost === 'all' && <AllPosts allPosts={socialPosts} />}
      {/* This has been removed because it doesn't make sense having filtering by text since text is mandatory
        {selectedPost === 'text' && <TextPosts socialPosts={socialPosts} />} 
      */}
      {selectedPost === 'photos' && <PhotosPosts socialPosts={socialPosts} />}
      {selectedPost === 'videos' && <VideosPosts socialPosts={socialPosts} />}
      {selectedPost === 'sounds' && (
        <Text style={{ textAlign: 'center', marginVertical: 16 }}>
          There are no {selectedPost} available
        </Text>
      )}
      {selectedPost === 'files' && (
        <Text style={{ textAlign: 'center', marginVertical: 16 }}>
          There are no {selectedPost} available
        </Text>
      )}
      {selectedPost === 'locations' && (
        <Text style={{ textAlign: 'center', marginVertical: 16 }}>
          There are no {selectedPost} available
        </Text>
      )}
    </View>
  );
}
