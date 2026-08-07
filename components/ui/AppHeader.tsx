import {
    View,
    Text,
    TouchableOpacity,
    StatusBar,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '@/lib/contexts/NotificationContext';

type AppHeaderProps = {
    title?: string;
    onMenuPress: () => void;
    showBackButton?: boolean;
    onBackPress?: () => void;
    rightIcon?: string;
    onRightIconPress?: () => void;
    onNotificationPress?: () => void;
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
    onNotificationPress,
    showLogo = true,
    logoType = 'both'
}: AppHeaderProps) {
    const { unreadCount } = useNotifications();
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
            <SafeAreaView style={{ backgroundColor: '#fff' }} edges={['top', 'left', 'right']}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
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

                    {/* Right side - Notifications & Menu */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                    }}>
                        {onNotificationPress && (
                            <TouchableOpacity 
                                onPress={onNotificationPress} 
                                style={{
                                    padding: 8,
                                    borderRadius: 8,
                                    backgroundColor: '#f8f9fa',
                                    position: 'relative',
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="notifications-outline" size={22} color="#333" />
                                {unreadCount > 0 && (
                                    <View style={{
                                        position: 'absolute',
                                        top: -2,
                                        right: -2,
                                        backgroundColor: '#10b981',
                                        borderRadius: 10,
                                        minWidth: 20,
                                        height: 20,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        paddingHorizontal: 4,
                                        borderWidth: 2,
                                        borderColor: '#ffffff',
                                        elevation: 3,
                                    }}>
                                        <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '800' }}>
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        )}
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
