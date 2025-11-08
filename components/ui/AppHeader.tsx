import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type AppHeaderProps = {
    title?: string;
    onMenuPress: () => void;
    showBackButton?: boolean;
    onBackPress?: () => void;
    rightIcon?: string;
    onRightIconPress?: () => void;
    showLogo?: boolean;
    logoType?: 'logo' | 'logo-long' | 'both';
};

export default function AppHeader({ 
    title = 'OurLime', 
    onMenuPress, 
    showBackButton = false, 
    onBackPress,
    rightIcon,
    onRightIconPress,
    showLogo = true,
    logoType = 'both'
}: AppHeaderProps) {
    const renderLogo = () => {
        if (logoType === 'both') {
            return (
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    
                }}>
                    <Image
                        source={require('@/assets/images/logo.png')}
                        style={{
                            height: 32,
                            width: 32,
                            resizeMode: 'contain',
                        }}
                    />
                    <Image
                        source={require('@/assets/images/logo-long.png')}
                        style={{
                            height: 32,
                            width: 120,
                            resizeMode: 'contain',
                        }}
                    />
                </View>
            );
        } else if (logoType === 'logo-long') {
            return (
                <Image
                    source={require('@/assets/images/logo-long.png')}
                    style={{
                        height: 32,
                        width: 120,
                        resizeMode: 'contain',
                    }}
                />
            );
        } else {
            return (
                <Image
                    source={require('@/assets/images/logo.png')}
                    style={{
                        height: 28,
                        width: 28,
                        resizeMode: 'contain',
                    }}
                />
            );
        }
    };

    return (
        <>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <SafeAreaView style={{ backgroundColor: '#fff' }}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    //justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: '#fff',
                    borderBottomWidth: 1,
                    borderBottomColor: '#e5e5e5',
                    shadowColor: '#000',
                    shadowOffset: {
                        width: 0,
                        height: 1,
                    },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 3,
                }}>
                    {/* Left side - Logo or Back Button */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        flex: 1,
                    }}>
                        {showBackButton ? (
                            <TouchableOpacity 
                                onPress={onBackPress} 
                                style={{
                                    padding: 8,
                                    borderRadius: 8,
                                    marginRight: 16,
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="arrow-back" size={24} color="#333" />
                            </TouchableOpacity>
                        ) : null}
                        
                        {showLogo ? (
                            renderLogo()
                        ) : (
                            <Text style={{
                                fontSize: 18,
                                fontWeight: '600',
                                color: '#333',
                            }}>
                                {title}
                            </Text>
                        )}
                    </View>

                    {/* Right side - Menu */}
                    <View style={{
                        width: 40,
                        alignItems: 'flex-end',
                    }}>
                        <TouchableOpacity 
                            onPress={onMenuPress} 
                            style={{
                                padding: 8,
                                borderRadius: 8,
                                backgroundColor: '#f8f9fa',
                            }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="menu" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </>
    );
}