import { View, Text, TouchableOpacity, Image, Dimensions } from 'react-native';
import { MessageSquare, Plus, Bell, Share2, ExternalLink } from 'lucide-react-native';
import { useState } from 'react';
import { FlashList } from '@shopify/flash-list';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const horizontalSpacing = 32;
const cardWidth = screenWidth - horizontalSpacing * 2;
const cardHeight = screenHeight * 0.45;

const messages = [
  {
    id: 1,
    author: "Dr. Sarah Johnson",
    authorImage: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
    time: "2 hours ago",
    content: [
      "New financial literacy course materials have been uploaded.",
      "Check out the updated content on budgeting and investment basics.",
      "Join our live Q&A session tomorrow!"
    ],
    tags: ["Finance", "New Content", "Live Session"],
    isImportant: true,
    engagement: "324 students enrolled"
  },
  {
    id: 2,
    author: "Prof. David Chen",
    authorImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e",
    time: "5 hours ago",
    content: [
      "Join our live session on stress management techniques tomorrow at 2 PM EST.",
      "Don't forget to prepare your questions!",
      "Resources available in the course portal."
    ],
    tags: ["Wellness", "Live Session", "Mental Health"],
    isImportant: false,
    engagement: "156 attending"
  },
  {
    id: 3,
    author: "Emma Wilson",
    authorImage: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80",
    time: "1 day ago",
    content: [
      "Updated communication skills workshop materials are now available.",
      "New role-play scenarios have been added.",
      "Check out the interactive exercises!"
    ],
    tags: ["Communication", "Updates", "Interactive"],
    isImportant: false,
    engagement: "89 responses"
  }
];

export const CourseMessages = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const cardMargin = 16;
  const cardWidth = screenWidth - cardMargin * 4;
  const cardHeight = screenHeight * 0.45;

  const renderCard = ({ item }: { item: typeof messages[0] }) => (
    <View
    style={{
      width: cardWidth,
      minHeight: screenHeight * 0.35,
      padding: 20,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      backgroundColor: 'white',
      borderRadius: 24,
      justifyContent: 'flex-start',
    }}
    >
      {/* Top Row: Avatar + Author + Icons */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
        gap: 8,
      }}>
        <Image
          source={{ uri: item.authorImage }}
          resizeMode="cover"
          style={{ width: 50, height: 50, borderRadius: 9999, backgroundColor: '#ccc' }}
        />
        <View style={{ flex: 1 }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
          }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#000' }}>{item.author}</Text>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>{item.time}</Text>
            </View>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              alignItems: 'flex-end',
              gap: 8,
            }}>
              <TouchableOpacity>
                <Share2 size={18} color="#9CA3AF" />
              </TouchableOpacity>
              <TouchableOpacity>
                <ExternalLink size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

  
      {/* Message Content */}
      <View style={{ marginBottom: 16 }}>
        {item.content.map((line, index) => (
          <Text
            key={index}
            style={{
              color: '#1f2937',
              fontSize: 14,
              lineHeight: 20,
              textAlign: 'left',
              fontWeight: index === 0 ? '400' : 'normal',
              marginBottom: 4,
            }}
          >
            {line}
          </Text>
        ))}
      </View>
  
      {/* Tags */}
      <View style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
      }}>
        {item.tags.map((tags, index) => (
          <View
            key={index}
            style={{
              backgroundColor: '#ecfdf5',
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 999,
            }}
          >
            <Text style={{
              color: '#059669',
              fontSize: 12,
              fontWeight: '500',
            }}>{tags}</Text>
          </View>
        ))}
      </View>
  
      {/* Engagement */}
      <Text style={{ fontSize: 12, color: '#6b7280' }}>{item.engagement}</Text>
    </View>
  );
  

  return (
    <View style={{ width: '100%', paddingHorizontal: 16, marginTop: 16 }}>
      {/* Header */}
      <View style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16
      }}>
        <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 8
        }}>
          <MessageSquare size={20} color="#16a34a" />
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#000' }}>Course Messages</Text>
          <View style={{
            backgroundColor: '#E0F7EC',
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 999,
            marginLeft: 8,
            alignSelf: 'center',
            justifyContent: 'center',
          }}>
            <Text 
              style={{
                color: '#00C853',
                fontSize: 12,
                fontWeight: '600',
              }}>
              {messages.length} Updates
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16
    }}>
        <TouchableOpacity style={{ marginRight: 12 }}>
          <Bell size={16} color="#6b7280" />
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: '#00C853',
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: 10
          }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>+ New Message</Text>
        </TouchableOpacity>
      </View>

      {/* FlashList Carousel */}
      <FlashList
        data={messages}
        horizontal
        pagingEnabled
        snapToInterval={screenWidth}
        snapToAlignment="center"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        estimatedItemSize={screenWidth}
        keyExtractor={(item) => item.id.toString()}
        onMomentumScrollEnd={(e) => {
          const offsetX = e.nativeEvent.contentOffset.x;
          const index = Math.round(offsetX / screenWidth);
          setActiveIndex(index);
        }}
        renderItem={({ item }) => (
          <View style={{ width: screenWidth, alignItems: 'center' }}>
            {renderCard({ item })}
          </View>
        )}
      />

      {/* Dot Indicator */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 }}>
        {messages.map((_, index) => (
          <View
            key={index}
            style={{
              height: 8,
              width: 8,
              borderRadius: 4,
              marginHorizontal: 4,
              backgroundColor: index === activeIndex ? '#00C853' : '#BDBDBD',
            }}
          />
        ))}
      </View>
    </View>
  );
};
