import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Menu, Search } from 'lucide-react-native';
import { FlashList } from '@shopify/flash-list';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Polygon } from 'react-native-svg';

const { width } = Dimensions.get('window');
const sliderWidth = width - 100;

const slides = [
  {
    image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=80',
    title: 'Welcome to Limes Academy',
    subtitle: 'Start your learning journey today'
  },
  {
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80',
    title: 'Learn from the Best',
    subtitle: 'Expert instructors to guide your path'
  },
  {
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80',
    title: 'Grow Your Skills',
    subtitle: 'Discover new opportunities'
  }
];

export const HeroSection = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={{ backgroundColor: 'white', paddingBottom: 16 }}>
      
      {/* Row: Logo + Slanted Slider */}
      <View style={{ flexDirection: 'row', width: '100%', height: 200 }}>
        {/* Logo */}
        <View style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', paddingHorizontal: 12, width: 100 }}>
          <Image
            source={require('@/assets/transparentLogo.png')}
            style={{ width: 100, height: 100 }}
            resizeMode="contain"
          />
          <Text style={{ fontSize: 12, color: '#4B5563', fontStyle: 'italic', marginTop: 4 }}>e-Learning</Text>
        </View>

        {/* Slanted Slider */}
        <MaskedView
          style={{ height: 200, width: sliderWidth }}
          maskElement={
            <Svg height="100%" width="100%" viewBox={`0 0 ${sliderWidth} 200`}>
              <Polygon
                points={`30,0 ${sliderWidth},0 ${sliderWidth},200 0,200`}
                fill="black"
              />
            </Svg>
          }
        >
          <FlashList
            data={slides}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `${item.title}-${index}-${currentSlide}`}
            renderItem={({ item }) => (
              <View style={{ width: sliderWidth, height: 200, position: 'relative' }}>
                <Image
                  source={{ uri: item.image }}
                  style={{ width: '100%', height: '90%', position: 'absolute' }}
                  resizeMode="cover"
                />
                <View style={{
                  position: 'absolute',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  width: '100%',
                  height: '90%'
                }} />
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 20,
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>
                    {item.title}
                  </Text>
                  <Text style={{ color: 'white', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                    {item.subtitle}
                  </Text>
                </View>
              </View>
            )}
          />
        </MaskedView>
      </View>

      {/* Branding + Search */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12, marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View>
            <Text style={{fontSize: 16, color: '#00C853', fontWeight: '900'}}>Limes</Text>
            <Text style={{fontSize: 14, color: '#00000', fontWeight: 'normal'}}>Academy</Text>
          </View>
        </View>
        
        <View style={{ flex: 1, marginLeft: 8, position: 'relative' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: 999,
              borderWidth: 1,
              borderColor: isInputFocused ? '#00C853' : '#D1D5DB',
              paddingHorizontal: 12,
              paddingVertical: 4,
            }}
          >
            <TouchableOpacity onPress={() => setIsDropdownOpen(!isDropdownOpen)} >
              <Menu size={18} color="#6b7280" />
            </TouchableOpacity>
            <TextInput
              placeholder="Search courses..."
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              style={{
                flex: 1,
                marginLeft: 8,
                fontSize: 14,
                color: '#000000',
              }}
            />
            <TouchableOpacity>
              <Search size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>

            {isDropdownOpen && (
            <View
            style={{
              position: 'absolute',
              top: 45,
              left: 0,
              right: 0,
              backgroundColor: '#f9f9f9',
              borderRadius: 12,
              paddingVertical: 6,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.1,
              shadowRadius: 10,
              elevation: 6,
              zIndex: 1000,
            }}>
              {['Development', 'Business', 'Design', 'Marketing'].map((category, index) => (
              <TouchableOpacity key={category} style={{
                paddingHorizontal: 20,
                paddingVertical: 14,
                borderBottomWidth: index < 3 ? 1 : 0,
                borderBottomColor: '#E5E7EB',
              }}
              activeOpacity={0.7}
            >
                <Text style={{ fontSize: 15, color: '#1F2937', fontWeight: '500' }}>{category}</Text>
              </TouchableOpacity>
              ))}
            </View>
            )}
        </View>
      </View>
    </View>
  );
};
