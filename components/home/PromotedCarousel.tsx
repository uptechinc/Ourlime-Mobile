import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

type PromotedItem = {
  id: string;
  category: string;
  title: string;
  description: string;
  metric: string;
  imageUrl: string;
  ctaText: string;
};

const PROMOTED_ITEMS: PromotedItem[] = [
  {
    id: '1',
    category: 'Featured Community',
    title: 'Trini Tech Enthusiasts',
    description: 'Connect with software engineers, designers, and tech innovators across Trinidad & Tobago.',
    metric: '1.2k Members',
    imageUrl: 'https://picsum.photos/400/200?random=10',
    ctaText: 'Join Community',
  },
  {
    id: '2',
    category: 'Sponsored Job',
    title: 'Senior Mobile Developer',
    description: 'Build cutting-edge mobile applications using React Native & Expo in a fast-growing team.',
    metric: 'Full-time · Remote',
    imageUrl: 'https://picsum.photos/400/200?random=11',
    ctaText: 'Apply Now',
  },
];

export default function PromotedCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <View style={{ marginBottom: 16, backgroundColor: '#ffffff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="award" size={16} color="#10b981" />
          <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: '700', color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Promoted
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {PROMOTED_ITEMS.map((_, i) => (
            <View key={i} style={{ width: i === activeIndex ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === activeIndex ? '#10b981' : '#cbd5e1' }} />
          ))}
        </View>
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          const x = e.nativeEvent.contentOffset.x;
          const width = e.nativeEvent.layoutMeasurement.width;
          if (width > 0) {
            setActiveIndex(Math.round(x / width));
          }
        }}
        scrollEventThrottle={16}
      >
        {PROMOTED_ITEMS.map((item) => (
          <View key={item.id} style={{ width: Dimensions.get('window').width - 64 }}>
            <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: 120, borderRadius: 12, marginBottom: 10 }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>{item.category}</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#1e293b', marginTop: 2 }}>{item.title}</Text>
            <Text style={{ fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 18 }}>{item.description}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b' }}>{item.metric}</Text>
              <TouchableOpacity style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: '#10b981' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#ffffff' }}>{item.ctaText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
