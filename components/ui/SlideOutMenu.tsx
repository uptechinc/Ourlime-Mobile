import React from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    Animated,
    Dimensions,
    SafeAreaView,
    StatusBar,
    Image,
    ScrollView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import type { SlideOutMenuProps } from '../../lib/types/componentProps';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const MENU_WIDTH = screenWidth * 0.88;
const HEADER_HEIGHT = 120;

export default function SlideOutMenu({ 
    isVisible, 
    onClose, 
    menuItems, 
    userProfile 
}: SlideOutMenuProps) {
    const slideAnim = React.useRef(new Animated.Value(MENU_WIDTH)).current;
    const overlayOpacity = React.useRef(new Animated.Value(0)).current;
    const scaleAnim = React.useRef(new Animated.Value(0.95)).current;
    const headerOpacity = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (isVisible) {
            Animated.parallel([
                //Spring animation for the slide animation
                Animated.spring(slideAnim, {
                    toValue: 0, //Slide from right edge to final position 
                    tension: 85, //How "bouncy" the spring is
                    friction: 15, //How quickly it settles
                    useNativeDriver: true, //Use native thread for better performance
                }),
                //Fade in the dark overlay
                Animated.timing(overlayOpacity, {
                    toValue: 1, //Fade from transparent to opaque
                    duration: 300, 
                    useNativeDriver: true, 
                }),
                //Scale effect for the menu container
                Animated.spring(scaleAnim, {
                    toValue: 1, //Scale from 95% to 100%
                    tension: 85,
                    friction: 15,
                    useNativeDriver: true,
                }),
                //Delayed header content fade-in
                Animated.timing(headerOpacity, {
                    toValue: 1, //Fade in header content
                    duration: 300,
                    delay: 50,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                //Slide menu back off-screen 
                Animated.timing(slideAnim, {
                    toValue: MENU_WIDTH, //Slide back to right edge
                    duration: 250,
                    useNativeDriver: true,
                }),
                //Fade out overlay
                Animated.timing(overlayOpacity, {
                    toValue: 0, //Fade to transparent
                    duration: 250,
                    useNativeDriver: true,
                }),
                //Scale down menu container
                Animated.timing(scaleAnim, {
                    toValue: 0.95, //Scale down to 95%
                    duration: 250,
                    useNativeDriver: true,
                }),
                //Fade out header content
                Animated.timing(headerOpacity, {
                    toValue: 0, //Fade out header
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isVisible, slideAnim, overlayOpacity, scaleAnim, headerOpacity]);

    const renderMenuItem = (item: any, index: number) => {
        if (item.isDivider) {
            return (
                <View 
                    key={item.id} 
                    style={{
                        height: 1,
                        backgroundColor: 'rgba(0,0,0,0.08)',
                        marginVertical: 12,
                        marginHorizontal: 24,
                    }} 
                />
            );
        }

        return (
            <Animated.View
                key={item.id}
                style={{
                    opacity: headerOpacity,
                    transform: [{
                        translateY: headerOpacity.interpolate({
                            inputRange: [0, 1],
                            outputRange: [20, 0],
                        })
                    }]
                }}
            >
                <TouchableOpacity
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 24,
                        paddingVertical: 16,
                        marginHorizontal: 16,
                        marginVertical: 2,
                        borderRadius: 16,
                        backgroundColor: '#fff',
                        shadowColor: '#000',
                        shadowOffset: {
                            width: 0,
                            height: 1,
                        },
                        shadowOpacity: 0.05,
                        shadowRadius: 3,
                        elevation: 2,
                    }}
                    onPress={() => {
                        item.onPress?.();
                        onClose();
                    }}
                    activeOpacity={0.7}
                >
                    <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: item.iconBgColor || '#f8f9ff',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 16,
                        shadowColor: item.iconColor || '#667eea',
                        shadowOffset: {
                            width: 0,
                            height: 2,
                        },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 3,
                    }}>
                        <Ionicons 
                            name={item.icon as any} 
                            size={22} 
                            color={item.iconColor || '#667eea'} 
                        />
                    </View>
                    <View style={{
                        flex: 1,
                    }}>
                        <Text style={{
                            fontSize: 16,
                            color: '#1a1a1a',
                            fontWeight: '600',
                            marginBottom: 2,
                        }}>
                            {item.title}
                        </Text>
                        {item.subtitle && (
                            <Text style={{
                                fontSize: 13,
                                color: '#6b7280',
                                fontWeight: '400',
                            }}>
                                {item.subtitle}
                            </Text>
                        )}
                    </View>
                    
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                    }}>
                        {item.badge && (
                            <View style={{
                                backgroundColor: '#ef4444',
                                borderRadius: 10,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                marginRight: 12,
                                minWidth: 20,
                                alignItems: 'center',
                            }}>
                                <Text style={{
                                    color: '#fff',
                                    fontSize: 11,
                                    fontWeight: '700',
                                }}>
                                    {item.badge}
                                </Text>
                            </View>
                        )}
                        <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                    </View>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="none"
            statusBarTranslucent
        >
            <StatusBar backgroundColor="rgba(0,0,0,0.6)" barStyle="light-content" />
            <View style={{
                flex: 1,
                flexDirection: 'row',
                justifyContent: 'flex-end',
            }}>
                {/* Enhanced Overlay with Blur */}
                <Animated.View
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        opacity: overlayOpacity,
                    }}
                >
                    {Platform.OS === 'ios' ? (
                        <BlurView
                            intensity={20}
                            tint="dark"
                            style={{
                                flex: 1,
                            }}
                        >
                            <TouchableOpacity
                                style={{
                                    flex: 1,
                                }}
                                onPress={onClose}
                                activeOpacity={1}
                            />
                        </BlurView>
                    ) : (
                        <TouchableOpacity
                            style={{
                                flex: 1,
                                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                            }}
                            onPress={onClose}
                            activeOpacity={1}
                        />
                    )}
                </Animated.View>

                {/* Modern Menu Container */}
                <Animated.View
                    style={{
                        width: MENU_WIDTH,
                        height: '100%',
                        backgroundColor: '#fafafa',
                        shadowColor: '#000',
                        shadowOffset: {
                            width: -4,
                            height: 0,
                        },
                        shadowOpacity: 0.15,
                        shadowRadius: 20,
                        elevation: 20,
                        transform: [
                            { translateX: slideAnim },
                            { scale: scaleAnim }
                        ],
                    }}
                >
                    <SafeAreaView style={{
                        flex: 1,
                    }}>
                        {/* Modern Header with Gradient */}
                        <Animated.View
                            style={{
                                opacity: headerOpacity,
                                transform: [{
                                    translateY: headerOpacity.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [-20, 0],
                                    })
                                }]
                            }}
                        >
                            <LinearGradient
                                colors={['#10b981', '#059669', '#047857']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{
                                    paddingHorizontal: 24,
                                    paddingVertical: 32,
                                    borderBottomLeftRadius: 24,
                                    borderBottomRightRadius: 24,
                                }}
                            >
                                <View style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 20,
                                }}>
                                    <TouchableOpacity 
                                        onPress={onClose} 
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 20,
                                            backgroundColor: 'rgba(255,255,255,0.2)',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            backdropFilter: 'blur(10px)',
                                        }}
                                    >
                                        <Ionicons name="close" size={20} color="#fff" />
                                    </TouchableOpacity>
                                    
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                    }}>
                                        <View style={{
                                            marginRight: 12,
                                        }}>
                                            {userProfile?.avatar ? (
                                                <Image 
                                                    source={{ uri: userProfile.avatar }} 
                                                    style={{
                                                        width: 60,
                                                        height: 60,
                                                        borderRadius: 30,
                                                        borderWidth: 3,
                                                        borderColor: 'rgba(255,255,255,0.3)',
                                                    }}
                                                />
                                            ) : (
                                                <View style={{
                                                    width: 60,
                                                    height: 60,
                                                    borderRadius: 30,
                                                    backgroundColor: 'rgba(255,255,255,0.2)',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    borderWidth: 3,
                                                    borderColor: 'rgba(255,255,255,0.3)',
                                                }}>
                                                    <Ionicons name="person" size={28} color="#fff" />
                                                </View>
                                            )}
                                        </View>
                                        <View style={{
                                            alignItems: 'flex-start',
                                        }}>
                                            <Text style={{
                                                fontSize: 20,
                                                fontWeight: '700',
                                                color: '#fff',
                                                marginBottom: 4,
                                                textShadowColor: 'rgba(0,0,0,0.1)',
                                                textShadowOffset: { width: 0, height: 1 },
                                                textShadowRadius: 2,
                                            }}>
                                                {userProfile?.name || 'Welcome'}
                                            </Text>
                                            <Text style={{
                                                fontSize: 14,
                                                color: 'rgba(255,255,255,0.9)',
                                                fontWeight: '400',
                                            }}>
                                                {userProfile?.email || 'Tap to sign in'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </LinearGradient>
                        </Animated.View>

                        {/* Enhanced Menu Items */}
                        <ScrollView 
                            style={{
                                flex: 1,
                                paddingTop: 16,
                            }} 
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{
                                paddingBottom: 20,
                            }}
                        >
                            {menuItems.map((item, index) => renderMenuItem(item, index))}
                        </ScrollView>

                        {/* Modern Footer */}
                        <Animated.View
                            style={{
                                opacity: headerOpacity,
                                transform: [{
                                    translateY: headerOpacity.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [20, 0],
                                    })
                                }]
                            }}
                        >
                            <View style={{
                                flexDirection: 'row',
                                justifyContent: 'space-around',
                                paddingVertical: 20,
                                paddingHorizontal: 24,
                                backgroundColor: '#fff',
                                borderTopLeftRadius: 24,
                                borderTopRightRadius: 24,
                                shadowColor: '#000',
                                shadowOffset: {
                                    width: 0,
                                    height: -2,
                                },
                                shadowOpacity: 0.05,
                                shadowRadius: 10,
                                elevation: 5,
                            }}>
                                <TouchableOpacity style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 12,
                                    paddingHorizontal: 20,
                                    borderRadius: 16,
                                    backgroundColor: '#f8f9ff',
                                    borderWidth: 1,
                                    borderColor: '#e5e7eb',
                                }}>
                                    <Ionicons name="help-circle-outline" size={18} color="#6b7280" />
                                    <Text style={{
                                        marginLeft: 8,
                                        fontSize: 14,
                                        color: '#6b7280',
                                        fontWeight: '600',
                                    }}>
                                        Help
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 12,
                                    paddingHorizontal: 20,
                                    borderRadius: 16,
                                    backgroundColor: '#f8f9ff',
                                    borderWidth: 1,
                                    borderColor: '#e5e7eb',
                                }}>
                                    <Ionicons name="settings-outline" size={18} color="#6b7280" />
                                    <Text style={{
                                        marginLeft: 8,
                                        fontSize: 14,
                                        color: '#6b7280',
                                        fontWeight: '600',
                                    }}>
                                        Settings
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </SafeAreaView>
                </Animated.View>
            </View>
        </Modal>
    );
}