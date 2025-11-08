import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  FlatList
} from 'react-native';

import { 
  ChevronDown, 
  ChevronUpSquare,
  MessageSquare,
  Bell,
  Settings,
  Compass,
  Plus,
  Users,
  Calendar,
  X,
  LogOut,
  HelpCircle,
  Bookmark,
  Wallet,
  User,
  Heart,
  LayoutGrid,
  List,
  Flag,
  ChevronUp,
  Search, } from 'lucide-react-native';

import PageHeader from '@/components/ui/PageHeader';

//import {Community} from '@/app/types/communityTypes';

import { useRouter } from 'expo-router';
import Layout from '../_layout';

// ---------------------------------------------------------------------------
// NOTE: The following Firebase imports are commented out ("hashed out")
// to avoid errors in a pure React Native environment. Uncomment and
// configure them in your project when ready.
//
// import {
//   getDocs,
//   collection,
//   addDoc,
//   setDoc,
//   getDoc,
//   doc,
//   serverTimestamp,
//   query,
//   where,
//   updateDoc,
//   increment
// } from 'firebase/firestore';
// import { db, auth } from '@/lib/firebaseConfig';
// import { signOut } from 'firebase/auth';
// import { doc as firestoreDoc } from 'firebase/firestore';
// ---------------------------------------------------------------------------

// These types are placeholders to mirror your original code
type Community = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  creatorProfileImage?: string | null;
  creatorName?: string;
  isMember?: boolean;
  requestStatus?: 'pending' | 'declined' | null;
  membershipCount?: number;
  membershipLikes?: number;
  isPrivate?: boolean;
  topMembers?: string[]; // array of image URLs
};

type CategoryType = {
  id: string;
  type: string;
  bannerImageUrl: string;
};

export default function CommunitiesPage() {
  const router = useRouter();
  // Navigation / Routing in React Native can be handled by React Navigation or Expo Router, but
  // for now we'll just stub out the logic that used next/router:
  const routerPush = (path: string) => {
    Alert.alert('Navigate to:', path);
    // Implement your React Navigation or Expo Router here
  };

  // State variables
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCommunities, setFilteredCommunities] = useState<Community[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selCategory, setSelCategory] = useState('All Categories'); 
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [profileImage, setProfileImage] = useState<any>(null);

  // For UI references (not always used the same way in RN)
  const dropdownRef = useRef<any>(null);

  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const sortOptions = ['Popular', 'Newest', 'Active', 'Trending']
  const categoryOptions = ['All Categories', 'Entertainment', 'Technology', 'Art & Design', 'Health & Fitness', 'Education']

  const [sortOpen, setSortOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [cateOpen, setCateOpen] = useState(false)

  const [selectedSort, setSelectedSort] = useState('Popular')

  const [isGridView, setIsGridView] = useState(false);

  const handleSelect = (option: string) => {
    setSelectedSort(option)
    setSortOpen(false)
  }

  const handleSelectCategory = (option: string) => {
    setSelectedCategory(option)
    setCategoryOpen(false)
  }

  const handleSelectCate = (option: string) => {
    setSelCategory(option)
    setCateOpen(false)
  }
  

  // Stubbed nav links
  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Blogs', href: '/blogs' },
    { name: 'Events', href: '/events' },
    //{ name: 'Jobs', href: '/jobs' },
    { name: 'Communities', href: '/communities' },
    { name: 'Marketplace', href: '/marketplace' }
  ];

  // ---------------------------------------------------------------------------------------
  // Firebase-based methods are stubbed out below. Uncomment and adjust for your RN project.
  // ---------------------------------------------------------------------------------------

  const handleLogout = async () => {
    try {
      // await signOut(auth);
      routerPush('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Profile dropdown (in RN, we'll just mock a small popup or toggled view)
  const ProfileDropdown = () => (
    <View /* ref={dropdownRef} */ style={{ position: 'relative' }}>
      <TouchableOpacity
        onPress={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: '#17A45B', // "greenTheme"
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        {profileImage?.imageURL ? (
          <Image
            source={{ uri: profileImage.imageURL }}
            style={{ width: 40, height: 40 }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ width: 40, height: 40, backgroundColor: '#ccc' }} />
        )}
      </TouchableOpacity>

      {isProfileDropdownOpen && (
        <View
          style={{
            position: 'absolute',
            right: 0,
            marginTop: 10,
            width: 250,
            backgroundColor: '#fff',
            borderRadius: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            paddingVertical: 8,
            zIndex: 1000
          }}
        >
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#eee'
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#333' }}>
              {userData?.firstName} {userData?.lastName}
            </Text>
            <Text style={{ fontSize: 12, color: '#999' }}>@{userData?.userName}</Text>
            <View style={{ marginTop: 8, flexDirection: 'row', gap: 16 }}>
              <Text style={{ fontSize: 12 }}>
                <Text style={{ fontWeight: 'bold' }}>245</Text> Friends
              </Text>
              <Text style={{ fontSize: 12 }}>
                <Text style={{ fontWeight: 'bold' }}>128</Text> Posts
              </Text>
            </View>
          </View>

          <View style={{ paddingVertical: 8 }}>
            <TouchableOpacity
              onPress={() => routerPush('/profile')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 24,
                paddingVertical: 12
              }}
            >
              <Text>View Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => routerPush('/settings')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 24,
                paddingVertical: 12
              }}
            >
              <Text>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => routerPush('/wallet')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 24,
                paddingVertical: 12
              }}
            >
              <Text>Wallet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => routerPush('/saved')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 24,
                paddingVertical: 12
              }}
            >
              <Text>Saved Items</Text>
            </TouchableOpacity>
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: '#eee', paddingVertical: 8 }}>
            <TouchableOpacity
              onPress={() => routerPush('/help')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 24,
                paddingVertical: 12
              }}
            >
              <Text>Help & Support</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              style={[{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 24,
                paddingVertical: 12
              }, { backgroundColor: '#ffe6e6' }]}
            >
              <Text style={{ color: '#e33' }}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  // ---------------------------------------------------------------------
  // Equivalent to Next.js: useEffect => fetching communities from Firestore
  // Here, we simply stub it out:
  // ---------------------------------------------------------------------
  useEffect(() => {
    const fetchCommunities = async () => {
      try {
        // const communityRef = collection(db, 'communityVariant');
        // const querySnapshot = await getDocs(communityRef);
        // if (querySnapshot.empty) {
        //   setCommunities([]);
        // } else {
        //   const communityData = querySnapshot.docs.map(doc => ({
        //     id: doc.id,
        //     ...doc.data()
        //   })) as Community[];
        //   setCommunities(communityData);
        // }
        // Hardcoded for example:
        setCommunities([
          {
            id: '123',
            title: 'React Native Fans',
            description: 'All about React Native, Expo & Tailwind.',
            imageUrl:
              'https://picsum.photos/id/1025/300/100',
            categoryId: 'cat1',
            creatorName: 'John Doe',
            isPrivate: false,
            requestStatus: null,
            membershipCount: 777,
            membershipLikes: 99
          },
          {
            id: '456',
            title: 'Music Lovers',
            description: 'Join and jam together',
            imageUrl:
              'https://picsum.photos/id/100/300/100',
            categoryId: 'cat2',
            creatorName: 'Jane Smith',
            isPrivate: true,
            requestStatus: null,
            membershipCount: 225,
            membershipLikes: 24
          },
          {
            id: '789',
            title: 'Entertainment Central',
            description: 'Movies, TV shows, memes & celebrity drama!',
            imageUrl: 'https://picsum.photos/id/237/300/100',
            categoryId: 'cat3',
            creatorName: 'Ava Blaze',
            isPrivate: false,
            requestStatus: null,
            membershipCount: 512,
            membershipLikes: 64
          }          
        ]);
      } catch (error) {
        console.error('Error fetching communities:', error);
        setCommunities([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCommunities();
  }, []);

  // Filter logic
  useEffect(() => {
    if (!communities) return;

    let filtered = [...communities];

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(
        (community) =>
          community.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          community.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category
    if (selectedCategory !== 'All Categories') {
      filtered = filtered.filter((community) => {
        const categoryType = categories.find((cat) => cat.id === community.categoryId)?.type;
        return categoryType === selectedCategory;
      });
    }

    setFilteredCommunities(filtered);
  }, [searchQuery, selectedCategory, communities, categories]);

  // Handle search input
  const handleSearchChange = (text: string) => {
    setSearchTerm(text);
  };

  const handleSearchSubmit = () => {
    setSearchQuery(searchTerm);
  };

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
  };

  // ---------------------------------------------------------------------
  // handleCommunityAction => join or request membership
  // ---------------------------------------------------------------------
  const handleCommunityAction = async (communityId: string, isPrivate: boolean) => {
    // if (!auth.currentUser) return;
    try {
      if (isPrivate) {
        // Check if request already exists...
        // await addDoc(collection(db, 'communityRequests'), {...});
        Alert.alert('Membership', 'Requested membership to private community.');
      } else {
        // Join directly
        Alert.alert('Membership', 'You joined the public community.');
      }
    } catch (error) {
      console.error('Error updating membership:', error);
    }
  };

  // ---------------------------------------------------------------------
  // Another effect to fetch categories and more community data. Stubbed out.
  // ---------------------------------------------------------------------
  useEffect(() => {
    const fetchData = async () => {
      // const categoryRef = collection(db, 'communityCategory');
      // ...
      setCategories([
        {
          id: 'cat1',
          type: 'Technology',
          bannerImageUrl: 'https://picsum.photos/id/1/50/50'
        },
        {
          id: 'cat2',
          type: 'Music',
          bannerImageUrl: 'https://picsum.photos/id/2/50/50'
        },
        {
          id: 'cat3',
          type: 'Entertainment',
          bannerImageUrl: 'https://picsum.photos/id/3/50/50'
        }
      ]);
    };

    fetchData();
  }, []);

  // CreateCommunityModal as RN <Modal>
  const CreateCommunityModal = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    //const [selCategory, setSelCategory] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);

    const handleSubmit = async () => {
      // if (!auth.currentUser?.uid) { ... }
      // Create the community doc
      // setDoc(...);

      Alert.alert('Community Created', `Created: ${title}`);
      // Reset
      setTitle('');
      setDescription('');
      setImageUrl('');
      setSelCategory('');
      setIsPrivate(false);
      setIsModalOpen(false);
    };

    return (
      <Modal transparent visible={isModalOpen} animationType="fade">
        <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
          <View style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 16,
              width: '85%',
              maxHeight: '80%'
            }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Create Community</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginBottom: 16 }}>
              <Text style={{
                  fontSize: 14,
                  color: '#333',
                  marginBottom: 4
                }}>Community Name</Text>
              <TextInput
                style={{
                  backgroundColor: '#f1f1f1',
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 16
                }}
                value={title}
                onChangeText={(val) => setTitle(val)}
                placeholder="Enter community name"
              />

              <Text style={{
                fontSize: 14,
                color: '#333',
                marginBottom: 4
              }}>Description</Text>
              <TextInput
                style={[{
                  backgroundColor: '#f1f1f1',
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 16
                }, { height: 80 }]}
                multiline
                value={description}
                onChangeText={(val) => setDescription(val)}
                placeholder="Enter community description"
              />

              <Text style={{
                  fontSize: 14,
                  color: '#333',
                  marginBottom: 4
                }}>Image URL</Text>
              <TextInput
                style={{
                  backgroundColor: '#f1f1f1',
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 16
                }}
                value={imageUrl}
                onChangeText={(val) => setImageUrl(val)}
                placeholder="Enter image URL"
              />

              <Text style={{ fontSize: 14, color: '#333', marginBottom: 4 }}>Category</Text>

              <View style={{ marginBottom: 16 }}>
              {/* Dropdown Toggle */}
              <TouchableOpacity
                onPress={() => setCateOpen(!cateOpen)}
                style={{
                  backgroundColor: '#f1f1f1',
                  borderRadius: 8,
                  padding: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: selCategory ? '#000' : '#aaa' }}>
                  {selCategory || 'Select a category'}
                </Text>
                {cateOpen ? (
                  <ChevronUp size={18} color="#555" />
                ) : (
                  <ChevronDown size={18} color="#555" />
                )}
              </TouchableOpacity>

              {/* Dropdown Options */}
              {cateOpen && (
                <View
                  style={{
                    backgroundColor: '#fff',
                    marginTop: 8,
                    borderRadius: 8,
                    borderColor: '#ccc',
                    borderWidth: 1,
                    
                    overflow: 'hidden'
                  }}
                >
                  <ScrollView style={{ maxHeight: 200 }}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={false}>
                    {categoryOptions.map((option, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => {
                          handleSelectCate(option);
                          setCateOpen(false);
                        }}
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                          borderBottomWidth: 1,
                          borderBottomColor: '#eee',
                          flexDirection: 'row',
                          alignItems: 'center'
                        }}
                      >
                        <Text>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>


              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                <TouchableOpacity
                  onPress={() => setIsPrivate(!isPrivate)}
                  style={{
                    width: 20,
                    height: 20,
                    borderWidth: 1,
                    borderColor: '#17A45B',
                    backgroundColor: isPrivate ? '#17A45B' : '#fff',
                    marginRight: 8
                  }}
                />
                <Text>Make this community private</Text>
              </View>
            </ScrollView>

            <TouchableOpacity onPress={handleSubmit} style={{
                backgroundColor: '#01eb53',
                borderRadius: 8,
                paddingVertical: 12,
                alignItems: 'center'
              }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Create Community</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Render item for communities
  const renderCommunityItem = ({ item }: { item: Community }) => {
    return (
      <View style={{
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        margin: 8,
        overflow: 'hidden',
        elevation: 2
      }}>
        <View style={{ height: 100, width: '100%', position: 'relative' }}>
          {/* Banner image */}
          <Image
            source={{ uri: item.imageUrl }}
            style={{ height: 100, width: '100%' }}
            resizeMode="cover"
          />

          {/* Example category icon */}
          <View style={{
            position: 'absolute',
            top: 8,
            left: 8,
            backgroundColor: 'rgba(255,255,255,0.8)',
            borderRadius: 16,
            paddingHorizontal: 8,
            paddingVertical: 4,
            flexDirection: 'row',
            alignItems: 'center'
          }}>
            <Image
              source={{
                uri: categories.find((cat) => cat.id === item.categoryId)?.bannerImageUrl || ''
              }}
              style={{ width: 20, height: 20, borderRadius: 10 }}
            />
            <Text style={{ marginLeft: 5, fontSize: 10 }}>
              {categories.find((cat) => cat.id === item.categoryId)?.type}
            </Text>
          </View>

          {/* "Report" button stub */}
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(255,255,255,0.8)',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 16
            }}
            onPress={() => Alert.alert('Report', 'Community reported.')}
          >
            <Flag color="#666" size={16} />
          </TouchableOpacity>

          {/* Creator profile picture */}
          <View style={{
              position: 'absolute',
              bottom: -32,
              left: 16,
              width: 64,
              height: 64,
              borderRadius: 32,
              borderWidth: 4,
              borderColor: '#fff',
              overflow: 'hidden'
            }}>
            <Image
              source={{ uri: item.creatorProfileImage || 'https://picsum.photos/200' }}
              style={{ width: 64, height: 64 }}
              resizeMode="cover"
            />
          </View>
        </View>

        <View style={{ padding: 8, paddingTop: 32 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={{ fontSize: 14, color: '#666' }} numberOfLines={2}>
                {item.description}
              </Text>
              <View style={{ flexDirection: 'row', marginTop: 4 }}>
                <Text style={{ fontSize: 10, color: '#999', textTransform: 'uppercase' }}>
                  Created by
                </Text>
                <Text style={{ fontSize: 10, marginLeft: 4, color: '#17A45B' }}>
                  {item.creatorName}
                </Text>
              </View>
            </View>

            {/* Join / Request / View logic */}
            {!item.isMember ? (
              <TouchableOpacity
                disabled={item.requestStatus === 'pending' || item.requestStatus === 'declined'}
                onPress={() => {
                  if (item.id && typeof item.isPrivate === 'boolean') {
                    handleCommunityAction(item.id, item.isPrivate);
                  }
                }}
                style={[
                  {
                    backgroundColor: '#01eb53',
                    borderRadius: 16,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    alignSelf: 'flex-start'
                  },
                  (item.requestStatus === 'pending' || item.requestStatus === 'declined') && {
                    backgroundColor: '#999'
                  }
                ]}
              >
                <Text style={{ color: '#fff' }}>
                  {item.requestStatus === 'pending'
                    ? 'Pending'
                    : item.requestStatus === 'declined'
                    ? 'Declined'
                    : item.isPrivate
                    ? 'Request'
                    : 'Join'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={{
                  backgroundColor: '#17A45B',
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  alignSelf: 'flex-start'
                }}
                onPress={() => routerPush(`/communities/${item.id}`)}
              >
                <Text style={{ color: '#fff' }}>View</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Users size={16} color="#000000" />
                <Text>{item.membershipCount || 0}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Heart size={16} color="#000000" />
                <Text>{item.membershipLikes || 0}</Text>
              </View>
            </View>

            {/* topMembers images if any */}
            {item.topMembers && item.topMembers.length > 0 && (
              <View style={{ flexDirection: 'row' }}>
                {item.topMembers.slice(0, 3).map((memberUrl, idx) => (
                  <View key={idx} style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: '#fff',
                    overflow: 'hidden',
                    marginLeft: -8
                  }}>
                    <Image
                      source={{ uri: memberUrl }}
                      style={{ width: 24, height: 24 }}
                      resizeMode="cover"
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  // Our main return
  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Create community modal */}
      {isModalOpen && <CreateCommunityModal />}

      <PageHeader 
      title="Community"
      onBackPress={() => router.back()}
      />
      
      <FlatList
        data={filteredCommunities}
        keyExtractor={(item) => item.id}
        renderItem={renderCommunityItem}
        contentContainerStyle={{
          paddingBottom: 60,
          paddingHorizontal: 16,
          paddingTop: 64,
        }}
        numColumns={isGridView ? 2 : 1}
        key={isGridView ? 'grid' : 'list'} // force re-render on layout change

        ListHeaderComponent={
          <>
            {/* Header row */}
            <View style={{marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
              <View style={{ marginBottom:8 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>Featured</Text>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333'}}>Communities</Text>
              </View>
              
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <TouchableOpacity
                  onPress={() => setIsModalOpen(true)}
                  style={{
                    backgroundColor: '#01eb53',
                    borderRadius: 24,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: '#fff', marginRight: 8 }}>+</Text>
                  <Text style={{ color: '#fff' }}>Create Community</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Advanced Search UI */}
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'column', gap: 16 }}>
                {/* Search input */}
                <View style={{ position: 'relative', justifyContent: 'center' }}>
                  <TextInput
                    placeholder="Search communities..."
                    value={searchTerm}
                    onChangeText={handleSearchChange}
                    onSubmitEditing={handleSearchSubmit}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 40,
                      backgroundColor: '#f1f1f1',
                      borderRadius: 12
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: [{ translateY: -9 }],
                    }}
                  >
                    <Search size={18} color="#aaa"/>
                  </View>
                </View>

                {/* Sort & Category Select (stubbed) */}
                <View className="flex-row justify-between gap-3">
                  {/* SORT DROPDOWN */}
                  <View className="relative w-[48%]">
                    <TouchableOpacity
                      onPress={() => setSortOpen(!sortOpen)}
                      className="bg-white border border-gray-300 rounded-lg px-4 py-2 flex-row justify-between items-center"
                    >
                      <Text className="text-black">Sort by: {selectedSort}</Text>
                      {sortOpen ? (
                        <ChevronUp size={18} color="#333" />
                      ) : (
                        <ChevronDown size={18} color="#333" />
                      )}
                    </TouchableOpacity>

                    {sortOpen && (
                      <View className="absolute top-[110%] z-50 bg-white border border-gray-300 rounded-lg w-full shadow-lg">
                        {sortOptions.map((option) => (
                          <TouchableOpacity
                            key={option}
                            onPress={() => handleSelect(option)}
                            className="px-4 py-3 hover:bg-gray-100"
                          >
                            <Text className="text-black">{option}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* CATEGORY BOX */}
                  <View className="relative w-[48%]">
                    <TouchableOpacity
                      onPress={() => setCategoryOpen(!categoryOpen)}
                      className="bg-white border border-gray-300 rounded-lg px-4 py-2 flex-row justify-between items-center"
                    >
                      <Text className="text-black">{selectedCategory}</Text>
                      {categoryOpen ? (
                        <ChevronUp size={18} color="#333" />
                      ) : (
                        <ChevronDown size={18} color="#333" />
                      )}
                    </TouchableOpacity>

                    {categoryOpen && (
                      <View className="absolute top-[110%] z-50 bg-white border border-gray-300 rounded-lg w-full shadow-lg">
                        {categoryOptions.map((option) => (
                          <TouchableOpacity
                            key={option}
                            onPress={() => handleSelectCategory(option)}
                            className="px-4 py-3 hover:bg-gray-100"
                          >
                            <Text className="text-black">{option}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* Category Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => handleSelectCategory('All Categories')}
                  style={[
                    {
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      backgroundColor: '#fff',
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: '#ccc'
                    },
                    selectedCategory === 'All Categories' && { backgroundColor: '#01eb53' }
                  ]}
                >
                  <Text style={[{
                    fontSize: 14,
                    color: '#333'
                  }, selectedCategory === 'All Categories' && { color: '#fff' }]}>
                    All
                  </Text>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => handleSelectCategory(cat.type)}
                    style={[
                      {
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        backgroundColor: '#fff',
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: '#ccc'
                      },
                      selectedCategory === cat.type && { backgroundColor: '#17A45B' }
                    ]}
                  >
                    <Text
                      style={[
                        {
                          fontSize: 14,
                          color: '#333'
                        },
                        selectedCategory === cat.type && { color: '#fff' }
                      ]}
                    >
                      {cat.type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Results count */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <TouchableOpacity
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: isGridView ? '#01eb53' : '#eee',
                }}
                onPress={() => setIsGridView(true)}
              >
                <LayoutGrid size={18} color={isGridView ? '#fff' : '#333'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: !isGridView ? '#01eb53' : '#eee',
                }}
                onPress={() => setIsGridView(false)}
              >
                <List size={18} color={!isGridView ? '#fff' : '#333'} />
              </TouchableOpacity>
            </View>


            {/* Community grid/list
            {loading ? (
              <Text style={{ textAlign: 'center', marginVertical: 24 }}>Loading...</Text>
            ) : filteredCommunities.length > 0 ? (
              // <FlatList
              //   data={filteredCommunities}
              //   keyExtractor={(item) => item.id}
              //   renderItem={renderCommunityItem}
              //   contentContainerStyle={{
              //     paddingBottom: 60,
              //     gap: 8,
              //   }}
              //   numColumns={isGridView ? 2 : 1}
              //   key={isGridView ? 'grid' : 'list'} // force re-render on layout change
              />
            ) : (
              <View style={{ alignItems: 'center', marginVertical: 40 }}>
                <Text style={{ fontSize: 16, color: '#666' }}>No communities available</Text>
              </View>
            )} */}
          </>
        }
      />
    </View>
  );
}