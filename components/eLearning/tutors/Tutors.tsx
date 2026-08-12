import { View, Text, Image, FlatList, Dimensions } from 'react-native';
import { Users, Star } from 'lucide-react-native';

const tutors = [
  {
    id: 1,
    name: 'Dr. Michael Foster',
    specialty: 'Business Strategy',
    rating: 4.9,
    students: 1500,
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
    badges: ['Top Rated', 'Expert'],
  },
  {
    id: 2,
    name: 'Prof. Lisa Zhang',
    specialty: 'Data Science',
    rating: 4.8,
    students: 1200,
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
    badges: ['Certified', 'Expert'],
  },
  {
    id: 3,
    name: 'James Anderson',
    specialty: 'Personal Finance',
    rating: 4.7,
    students: 980,
    image: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=400&q=80',
    badges: ['Rising Star'],
  },
];

const screenWidth = Dimensions.get('window').width;
const cardSpacing = 16;
const cardWidth = (screenWidth - 64 - cardSpacing * 2) / 2.3;

export const Tutors = () => {
  return (
    <View style={{ width: '100%', marginTop: 16, flex: 1 }}>
      <View style={{
        width: '100%',
        backgroundColor: 'white',
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 6
      }}>
        
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Users size={20} color="#16a34a" />
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#000' }}>Tutors</Text>
        </View>

        {/* Tutor Cards */}
        <FlatList
          data={tutors}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 12 }}
          renderItem={({ item }) => (
            <View
              style={{
                width: cardWidth,
                backgroundColor: '#ffffff',
                borderRadius: 12,
                paddingVertical: 16,
                paddingHorizontal: 10,
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 2,
                borderWidth: 1,
                borderColor: '#f3f4f6',
              }}
            >
              <View style={{ alignItems: 'center' }}>
                <Image
                  source={{ uri: item.image }}
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 999,
                    marginBottom: 6,
                    borderWidth: 2,
                    borderColor: '#16a34a',
                  }}
                  resizeMode="cover"
                />
                <Text style={{
                  fontWeight: '700',
                  fontSize: 13,
                  color: '#111827',
                  textAlign: 'center',
                }}>{item.name}</Text>
                <Text style={{
                  fontSize: 11,
                  color: '#6b7280',
                  textAlign: 'center',
                  marginBottom: 4,
                }}>{item.specialty}</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Star size={12} color="#facc15" />
                  <Text style={{ fontSize: 11, color: '#374151', marginLeft: 3 }}>{item.rating}</Text>
                  <Text style={{ fontSize: 11, color: '#9ca3af', marginLeft: 3 }}>({item.students})</Text>
                </View>

                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                }}>
                  {item.badges.map((badge, index) => (
                    <Text
                      key={index}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        backgroundColor: '#ecfdf5',
                        color: '#059669',
                        fontSize: 9,
                        fontWeight: '600',
                        borderRadius: 999,
                        marginHorizontal: 2,
                        marginBottom: 2,
                      }}
                    >
                      {badge}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          )}
        />
      </View>
    </View>
  );
};
