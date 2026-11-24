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
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { usePendingApprovalsCount } from '@/lib/hooks/usePendingApprovalsCount';
import { formatPendingBadge } from '@/lib/services/PendingApprovalsRules';

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
    profilePictureUrl?: string | null;
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
    logoType = 'both',
    profilePictureUrl,
}: AppHeaderProps) {
    const { unreadCount } = useNotifications();
    const { isDark } = useAppTheme();
    // Administrators see how many items wait for approval on the menu button (0 and non-admins: no badge).
    const { total: pendingApprovals } = usePendingApprovalsCount();
    const pendingApprovalsBadge = formatPendingBadge(pendingApprovals);
    const surfaceColor = isDark ? '#0f172a' : '#ffffff';
    const controlColor = isDark ? '#1e293b' : '#f8f9fa';
    const contentColor = isDark ? '#f8fafc' : '#333333';
    const borderColor = isDark ? '#334155' : '#e5e5e5';
    const renderLogo = () => {
        if (logoType === 'both') {
            return (
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                }}>
                    <Image
                        source={require('@/assets/transparentLogo.png')}
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
                    source={require('@/assets/transparentLogo.png')}
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
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={surfaceColor} />
            <SafeAreaView style={{ backgroundColor: surfaceColor }} edges={['top', 'left', 'right']}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: surfaceColor,
                    borderBottomWidth: 1,
                    borderBottomColor: borderColor,
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
                                accessibilityRole="button"
                                accessibilityLabel="Go back"
                                onPress={onBackPress} 
                                style={{
                                    padding: 8,
                                    borderRadius: 8,
                                    marginRight: 16,
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="arrow-back" size={24} color={contentColor} />
                            </TouchableOpacity>
                        ) : null}
                        
                        {showLogo ? (
                            renderLogo()
                        ) : (
                            <Text style={{
                                fontSize: 18,
                                fontWeight: '600',
                                color: contentColor,
                            }}>
                                {title}
                            </Text>
                        )}
                    </View>

                    {/* Right side - Profile avatar, Notifications & Menu */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                    }}>
                        {/* Profile avatar */}
                        {profilePictureUrl ? (
                            <Image
                                source={{ uri: profilePictureUrl }}
                                accessibilityLabel="Your profile"
                                style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 17,
                                    borderWidth: 2,
                                    borderColor: '#10b981',
                                }}
                            />
                        ) : (
                            <View 
                                accessibilityLabel="Your profile"
                                style={{
                                width: 34,
                                height: 34,
                                borderRadius: 17,
                                backgroundColor: '#d1fae5',
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderWidth: 2,
                                borderColor: '#10b981',
                            }}>
                                <Ionicons name="person" size={18} color="#10b981" />
                            </View>
                        )}
                        {onNotificationPress && (
                            <TouchableOpacity 
                                accessibilityRole="button"
                                accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                                onPress={onNotificationPress} 
                                style={{
                                    padding: 8,
                                    borderRadius: 8,
                                    backgroundColor: controlColor,
                                    position: 'relative',
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="notifications-outline" size={22} color={contentColor} />
                                {unreadCount > 0 && (
                                    <View style={{
                                        position: 'absolute',
                                        top: -4,
                                        right: unreadCount > 99 ? -8 : unreadCount > 9 ? -6 : -3,
                                        backgroundColor: '#10b981',
                                        borderRadius: 10,
                                        minWidth: unreadCount > 99 ? 34 : unreadCount > 9 ? 28 : 20,
                                        height: 20,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        paddingHorizontal: unreadCount > 99 ? 4 : unreadCount > 9 ? 4 : 2,
                                        borderWidth: 2,
                                        borderColor: '#ffffff',
                                        elevation: 3,
                                        flexDirection: 'row',
                                    }}>
                                        <Text
                                            numberOfLines={1}
                                            ellipsizeMode="clip"
                                            style={{
                                                color: '#ffffff',
                                                fontSize: unreadCount > 99 ? 9 : 10.5,
                                                fontWeight: '800',
                                                textAlign: 'center',
                                                includeFontPadding: false,
                                            }}
                                        >
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity 
                            accessibilityRole="button"
                            accessibilityLabel={pendingApprovalsBadge ? `Open navigation menu, ${pendingApprovalsBadge} pending approvals` : 'Open navigation menu'}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            onPress={onMenuPress}
                            style={{
                                padding: 8,
                                borderRadius: 8,
                                backgroundColor: controlColor,
                                position: 'relative',
                            }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="menu" size={24} color={contentColor} />
                            {pendingApprovalsBadge ? (
                                <View
                                    pointerEvents="none"
                                    style={{
                                        position: 'absolute',
                                        top: -4,
                                        right: pendingApprovalsBadge.length > 2 ? -8 : pendingApprovalsBadge.length > 1 ? -6 : -3,
                                        backgroundColor: '#c64d53',
                                        borderRadius: 10,
                                        minWidth: pendingApprovalsBadge.length > 2 ? 30 : pendingApprovalsBadge.length > 1 ? 26 : 20,
                                        height: 20,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        paddingHorizontal: 4,
                                        borderWidth: 2,
                                        borderColor: surfaceColor,
                                        elevation: 3,
                                        flexDirection: 'row',
                                    }}
                                >
                                    <Text
                                        numberOfLines={1}
                                        ellipsizeMode="clip"
                                        style={{
                                            color: '#ffffff',
                                            fontSize: pendingApprovalsBadge.length > 2 ? 9 : 10.5,
                                            fontWeight: '800',
                                            textAlign: 'center',
                                            includeFontPadding: false,
                                        }}
                                    >
                                        {pendingApprovalsBadge}
                                    </Text>
                                </View>
                            ) : null}
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </>
    );
}
