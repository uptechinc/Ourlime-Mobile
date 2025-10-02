import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { X, Search, Plus } from 'lucide-react-native';
import type { Dispatch, SetStateAction } from 'react';

const { width, height } = Dimensions.get('window');
const PANEL_WIDTH = width * 0.8;

const categories = [
  { id: 'tech', name: 'Tech', count: 12 },
  { id: 'business', name: 'Business', count: 8 },
  { id: 'music', name: 'Music', count: 5 },
];

const tags = [
  { id: 'conference', name: 'Conference', count: 4 },
  { id: 'webinar', name: 'Webinar', count: 3 },
  { id: 'festival', name: 'Festival', count: 2 },
];

export default function EventsFilterSection({
  isOpen,
  setIsOpen,
  //onCreateEvent,
}: {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  //onCreateEvent: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const translateX = useRef(new Animated.Value(-PANEL_WIDTH)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: isOpen ? 0 : -PANEL_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOpen]);

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };
  const toggleTag = (id: string) => {
    setSelectedTags(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', width, height, top: 0, left: 0 }}>      
      {/* Backdrop */}
      {isOpen && (
        <TouchableOpacity
          onPress={() => setIsOpen(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width,
            height,
            backgroundColor: 'rgba(0,0,0,0.3)',
          }}
        />
      )}

      {/* Drawer */}
      <Animated.View
        style={{
          transform: [{ translateX }],
          position: 'absolute',
          top: 0,
          left: 0,
          width: PANEL_WIDTH,
          height,
          backgroundColor: '#fff',
          paddingTop: 40,
          paddingHorizontal: 16,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Filters</Text>
          <TouchableOpacity onPress={() => setIsOpen(false)}>
            <X size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView>
          {/* Create */}
          {/* <TouchableOpacity
            onPress={onCreateEvent}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#10B981',
              padding: 12,
              borderRadius: 8,
              marginBottom: 24,
            }}
          >
            <Plus size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, marginLeft: 8 }}>
              Create Event
            </Text>
          </TouchableOpacity> 

          {/* Search */}
          <View style={{ flexDirection: 'row', marginBottom: 24, alignItems: 'center' }}>
            <Search size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search filters..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#D1D5DB',
                borderRadius: 8,
                padding: 10,
                fontSize: 14,
              }}
            />
          </View>

          {/* Categories as horizontal chips */}
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
            Categories
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => toggleCategory(cat.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginRight: 12,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 20,
                  backgroundColor: selectedCategories.includes(cat.id)
                    ? '#01eb53'
                    : '#E5E7EB',
                }}
              >
                <Text
                  style={{
                    color: selectedCategories.includes(cat.id)
                      ? '#fff'
                      : '#374151',
                    marginRight: 6,
                  }}
                >
                  {cat.name}
                </Text>
                <Text
                  style={{
                    color: selectedCategories.includes(cat.id)
                      ? '#fff'
                      : '#6B7280',
                    fontSize: 12,
                  }}
                >
                  {cat.count}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Tags as badge grid */}
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
            Popular Tags
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {tags.map(tag => (
              <TouchableOpacity
                key={tag.id}
                onPress={() => toggleTag(tag.id)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 16,
                  backgroundColor: selectedTags.includes(tag.id)
                    ? '#01eb53'
                    : '#E5E7EB',
                  marginRight: 8,
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    color: selectedTags.includes(tag.id)
                      ? '#fff'
                      : '#374151',
                    fontSize: 12,
                  }}
                >
                  {tag.name} ({tag.count})
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Newsletter */}
          <View style={{ borderTopWidth: 1, borderColor: '#E5E7EB', marginTop: 24, paddingTop: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
              Newsletter
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 12 }}>
              Subscribe for updates
            </Text>
            <TextInput
              placeholder="you@example.com"
              keyboardType="email-address"
              style={{
                borderWidth: 1,
                borderColor: '#D1D5DB',
                borderRadius: 8,
                padding: 10,
                fontSize: 14,
                marginBottom: 12,
              }}
            />
            <TouchableOpacity
              style={{
                alignItems: 'center',
                backgroundColor: '#01eb53',
                padding: 12,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16 }}>Subscribe</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}