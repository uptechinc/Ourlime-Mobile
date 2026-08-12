import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Star, Clock, CheckCircle } from 'lucide-react-native';

const mainCategories = [
  'Information Technology', 'Science', 'Business', 'Language', 'Art', 'History',
  'Mathematics', 'Engineering', 'Health Sciences', 'Social Sciences'
];

const subCategories: { [key: string]: string[] } = {
  'Information Technology': [
    'Programming', 'Computer Science', 'Networking', 'UI/UX Design', 'Cybersecurity',
    'Database Management', 'Cloud Computing', 'DevOps', 'Mobile Development', 'Web Development'
  ],
  'Science': ['Physics', 'Chemistry', 'Biology', 'Astronomy', 'Environmental Science'],
  'Business': ['Marketing', 'Finance', 'Management', 'Entrepreneurship', 'Economics'],
  'Language': ['English', 'Spanish', 'French', 'German', 'Mandarin', 'Japanese', 'Arabic'],
  'Art': ['Digital Art', 'Painting', 'Photography', 'Graphic Design', 'Animation'],
  'History': ['World History', 'Ancient Civilizations', 'Modern History', 'Art History', 'Military History'],
  'Mathematics': ['Algebra', 'Calculus', 'Statistics', 'Geometry', 'Number Theory'],
  'Engineering': ['Mechanical', 'Electrical', 'Civil', 'Chemical', 'Software'],
  'Health Sciences': ['Anatomy', 'Physiology', 'Nutrition', 'Public Health', 'Mental Health'],
  'Social Sciences': ['Psychology', 'Sociology', 'Anthropology', 'Political Science', 'Economics'],
};

const courses = [
  {
    id: 1, title: "Financial Literacy Basics", instructor: "Sarah Johnson", rating: 4.8,
    students: 1234, duration: "6 hours", image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f",
    category: "Finance", level: "Beginner", type: "video", price: 49.99
  },
  {
    id: 2, title: "Digital Marketing Essentials", instructor: "David Chen", rating: 4.9,
    students: 2156, duration: "4 hours", image: "https://images.unsplash.com/photo-1591228127791-8e2eaef098d3",
    category: "Marketing", level: "Intermediate", type: "video", price: 0
  },
  {
    id: 3, title: "Python Programming Guide", instructor: "Emma Wilson", rating: 4.7,
    students: 1789, duration: "250 pages", image: "https://images.unsplash.com/photo-1557425955-df376b5903c8",
    category: "Programming", level: "Advanced", type: "ebook", price: 29.99
  }
];

export const LearningMaterials = () => {
  const [selectedMain, setSelectedMain] = useState<string>(mainCategories[0]);
  const [selectedSub, setSelectedSub] = useState<string>(subCategories[mainCategories[0]][0]);

  const filteredCourses = courses.filter(
    (c) => c.category === selectedSub || c.category === selectedMain
  );

  const renderCourseCard = ({ item }: { item: typeof courses[0] }) => (
    <View style={{ backgroundColor: 'white', borderRadius: 16, marginBottom: 24, padding: 16 }}>
      <Image
        source={{ uri: item.image }}
        resizeMode="cover"
        style={{
          width: '100%',
          height: 160,
          borderRadius: 12,
          marginBottom: 12,
          backgroundColor: '#f3f4f6',
        }}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#000', flex: 1 }}>{item.title}</Text>
        <Text style={{
          fontSize: 12,
          backgroundColor: '#f3f4f6',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 999,
          color: '#4B5563'
        }}>{item.level}</Text>
      </View>

      <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>by {item.instructor}</Text>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Star size={14} color="#facc15" />
          <Text style={{ fontSize: 12, color: '#374151' }}>{item.rating} ({item.students})</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Clock size={14} color="#6b7280" />
          <Text style={{ fontSize: 12, color: '#374151' }}>{item.duration}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: '#e5e7eb', paddingTop: 12 }}>
        {item.price === 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={16} color="#16a34a" />
            <Text style={{ color: '#16a34a', fontWeight: '500' }}>Free</Text>
          </View>
        ) : (
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>${item.price}</Text>
        )}
        <TouchableOpacity style={{ backgroundColor: '#16a34a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Enroll Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ width: '100%', marginTop: 16, flex: 1 }}>
      <View style={{ width:'100%', backgroundColor: 'white', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6 }}>
        
        {/* MAIN CATEGORIES */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {mainCategories.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => {
                setSelectedMain(cat);
                setSelectedSub(subCategories[cat][0]);
              }}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                marginRight: 12,
                borderRadius: 999,
                backgroundColor: selectedMain === cat ? '#ECFDF5' : '#F9FAFB',
              }}
            >
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: selectedMain === cat ? '#16a34a' : '#374151'
              }}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* SUBCATEGORIES */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', columnGap: 12 }}>
            {subCategories[selectedMain]?.map((sub) => (
              <TouchableOpacity
                key={sub}
                onPress={() => setSelectedSub(sub)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  backgroundColor: selectedSub === sub ? '#16a34a' : '#ffffff',
                  borderColor: selectedSub === sub ? '#16a34a' : '#D1D5DB',
                }}
              >
                <Text style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: selectedSub === sub ? '#ffffff' : '#374151'
                }}>
                  {sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* COURSES */}
        <FlashList
          data={filteredCourses}
          renderItem={renderCourseCard}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: '#9ca3af', marginTop: 40 }}>
              No courses found in this category.
            </Text>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      </View>
    </View>
  );
};
