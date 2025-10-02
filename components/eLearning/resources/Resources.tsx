import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { BookOpen, ChevronRight } from 'lucide-react-native';

export const Resources = () => {
  const [activeCategory, setActiveCategory] = useState('All');

  const subjects = [
    'Mathematics',
    'Science',
    'Language Arts',
    'Social Studies',
    'Computer Science',
    'Art & Design',
    'Music Theory',
    'Physical Education',
    'Economics',
    'Psychology'
  ];

  const categories = [
    'All',
    'Personal Development',
    'Business',
    'Finance',
    'IT & Software',
    'Office Productivity',
    'Design',
    'Marketing',
    'Health & Fitness',
    'Music',
    'Teaching & Academics'
  ];

  return (
    <View style={{ width: '100%', marginTop: 16 }}>
      <View style={{ width:'100%', backgroundColor: 'white', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BookOpen size={20} color="#16a34a" />
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#000' }}>Resources</Text>
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity>
            <Text style={{ fontSize: 12, color: '#00C853', fontWeight: 'bold' }}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* Categories */}
        <ScrollView style={{ height: 350 }} showsVerticalScrollIndicator={false}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              onPress={() => setActiveCategory(category)}
              style={{
                width: '100%',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 12,
                marginBottom: 8,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: activeCategory === category ? '#ECFDF5' : '#FFFFFF',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  color: activeCategory === category ? '#16a34a' : '#374151',
                  fontWeight: activeCategory === category ? '500' : '400',
                }}
              >
                {category}
              </Text>
              <ChevronRight
                size={16}
                color={activeCategory === category ? '#16a34a' : '#9ca3af'}
                style={{
                  transform: [{ rotate: activeCategory === category ? '90deg' : '0deg' }],
                }}
              />
            </TouchableOpacity>
          ))}

          {/* Popular Subjects */}
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Popular Subjects</Text>

            {/* Two-column subject rows */}
            <View style={{ rowGap: 8 }}>
              {Array.from({ length: Math.ceil(subjects.length / 2) }).map((_, rowIndex) => {
                const first = subjects[rowIndex * 2];
                const second = subjects[rowIndex * 2 + 1];

                return (
                  <View key={rowIndex} style={{ flexDirection: 'row', columnGap: 12 }}>
                    {/* First Tag */}
                    <View style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      backgroundColor: '#D3D3D3',
                      borderRadius: 999,
                      marginRight: 4,
                      marginBottom: 2,
                    }}>
                      <Text style={{
                        color: '#000000',
                        fontSize: 12,
                        fontWeight: '600',
                      }}>{first}</Text>
                    </View>

                    {/* Second Tag */}
                    {second && (
                      <View style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        backgroundColor: '#D3D3D3',
                        borderRadius: 999,
                        marginRight: 4,
                        marginBottom: 2,
                      }}>
                        <Text style={{
                          color: '#000000',
                          fontSize: 12,
                          fontWeight: '600',
                        }}>{second}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};
