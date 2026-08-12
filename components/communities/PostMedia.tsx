import { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import type { CommunityVariantDetailsSummary } from "@/types/communityTypes";

type PostMediaProps = {
  media: CommunityVariantDetailsSummary[];
};

const PostMedia = ({ media }: PostMediaProps) => {
  const [activeIndex, setActiveIndex] = useState(0);

  // Handle empty media array
  if (!media || media.length === 0) {
    return (
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          height: 200,
        }}
      >
        <Text>No media available</Text>
      </View>
    );
  }

  // Currently active item
  const currentItem = media[activeIndex];

  return (
    <View
      style={{
        marginBottom: 16,
        height: 400,
        width: "100%",
      }}
    >
      {/* Main Active Media */}
      <View
        style={{
          flex: 1,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {currentItem.type === "image" ? (
          <Image
            source={{ uri: currentItem.typeUrl }}
            style={{
              width: "100%",
              height: "100%",
            }}
            resizeMode="cover"
          />
        ) : (
          // Replace this with <Video> from 'react-native-video' if needed
          <View
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#00000033",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text>Video playback here</Text>
            {/* 
            <Video
              source={{ uri: currentItem.typeUrl }}
              style={styles.mainMedia}
              controls
              resizeMode="cover"
            />
            */}
          </View>
        )}
      </View>

      {/* Thumbnail Slider */}
      <ScrollView
        horizontal
        style={{
          position: "absolute",
          bottom: 16,
          left: 0,
          right: 0,
        }}
        contentContainerStyle={{
          paddingHorizontal: 16,
        }}
        showsHorizontalScrollIndicator={false}
      >
        {media.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <TouchableOpacity
              key={index}
              style={[
                {
                  width: 64,
                  height: 64,
                  borderRadius: 8,
                  marginRight: 8,
                  opacity: 0.5,
                  overflow: "hidden",
                },
                isActive && {
                  opacity: 1,
                  borderWidth: 2,
                  borderColor: "green",
                },
              ]}
              onPress={() => setActiveIndex(index)}
            >
              {item.type === "image" ? (
                <Image
                  source={{ uri: item.typeUrl }}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={{
                    backgroundColor: "#ccc",
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#333",
                    }}
                  >
                    Video
                  </Text>
                  {/* Or a small <Video> component if needed */}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default PostMedia;

// const styles = StyleSheet.create({
//   mainContainer: {
//     marginBottom: 16,
//     height: 400,
//     width: '100%'
//   },
//   mediaContainer: {
//     flex: 1,
//     borderRadius: 8,
//     overflow: 'hidden'
//   },
//   mainMedia: {
//     width: '100%',
//     height: '100%'
//   },
//   videoPlaceholder: {
//     width: '100%',
//     height: '100%',
//     backgroundColor: '#00000033',
//     justifyContent: 'center',
//     alignItems: 'center'
//   },
//   thumbnailScroll: {
//     position: 'absolute',
//     bottom: 16,
//     left: 0,
//     right: 0
//   },
//   thumbnailRow: {
//     paddingHorizontal: 16
//   },
//   thumbnailTouch: {
//     width: 64,
//     height: 64,
//     borderRadius: 8,
//     marginRight: 8,
//     opacity: 0.5,
//     overflow: 'hidden'
//   },
//   thumbnailActive: {
//     opacity: 1,
//     borderWidth: 2,
//     borderColor: 'green'
//   },
//   thumbnailImage: {
//     width: '100%',
//     height: '100%'
//   },
//   videoThumbnail: {
//     backgroundColor: '#ccc',
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center'
//   },
//   videoThumbText: {
//     fontSize: 12,
//     color: '#333'
//   },
//   emptyContainer: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     height: 200
//   }
// });
