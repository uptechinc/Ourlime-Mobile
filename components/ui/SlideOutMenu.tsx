import { useEffect, useRef } from 'react';
import type { ComponentProps } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    Animated,
    Dimensions,
    StatusBar,
    Image,
    ScrollView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import type { SlideOutMenuProps } from '../../lib/types/componentProps';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');
const MENU_WIDTH = screenWidth * 0.88;

type SectionItem = {
    id: string;
    title: string;
    subtitle?: string;
    icon: ComponentProps<typeof Ionicons>['name'];
    iconColor: string;
    iconBgColor: string;
    onPress?: () => void;
    badge?: string | number;
};

export default function SlideOutMenu({
    isVisible,
    onClose,
    menuItems,
    userProfile,
}: SlideOutMenuProps) {
    const { colors } = useAppTheme();
    const slideAnim = useRef(new Animated.Value(MENU_WIDTH)).current;
    const overlayOpacity = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;
    const contentOpacity = useRef(new Animated.Value(0)).current;

    const handleCloseAnimated = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: MENU_WIDTH,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.timing(overlayOpacity, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onClose();
        });
    };

    useEffect(() => {
        if (isVisible) {
            slideAnim.setValue(MENU_WIDTH);
            overlayOpacity.setValue(0);
            scaleAnim.setValue(0.95);
            contentOpacity.setValue(0);

            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 85,
                    friction: 15,
                    useNativeDriver: true,
                }),
                Animated.timing(overlayOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 85,
                    friction: 15,
                    useNativeDriver: true,
                }),
                Animated.timing(contentOpacity, {
                    toValue: 1,
                    duration: 300,
                    delay: 50,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isVisible, slideAnim, overlayOpacity, scaleAnim, contentOpacity]);

    // Separate account items from feature items from logout from the menuItems prop
    const accountIds = ['profile', 'settings', 'chat'];
    const logoutId = 'logout';
    const featureIds = ['communities', 'events', 'jobs', 'market', 'blogs', 'elearning'];
    const adsIds: string[] = [];
    const supportIds: string[] = [];

    const accountItems = menuItems.filter((menuItem) => accountIds.includes(menuItem.id));
    const featureItems = menuItems.filter((menuItem) => featureIds.includes(menuItem.id));
    const adsItems = menuItems.filter((menuItem) => adsIds.includes(menuItem.id));
    const supportItems = menuItems.filter((menuItem) => supportIds.includes(menuItem.id));
    const logoutItem = menuItems.find((menuItem) => menuItem.id === logoutId);

    const chatMenuItem = menuItems.find((menuItem) => menuItem.id === 'chat');

    // Build section config: Account section first
    const accountSection: SectionItem[] = [
        {
            id: 'profile',
            title: 'My Profile',
            subtitle: 'View and edit your profile',
            icon: 'person-circle-outline',
            iconColor: '#10b981',
            iconBgColor: '#d1fae5',
            onPress: accountItems.find((menuItem) => menuItem.id === 'profile')?.onPress,
        },
        {
            id: 'settings',
            title: 'Settings',
            subtitle: 'Preferences & privacy',
            icon: 'settings-outline',
            iconColor: '#6366f1',
            iconBgColor: '#ede9fe',
            onPress: accountItems.find((menuItem) => menuItem.id === 'settings')?.onPress,
        },
        {
            id: 'chat',
            title: 'Chat',
            subtitle: 'Direct messages & groups',
            icon: 'chatbubbles-outline',
            iconColor: '#10b981',
            iconBgColor: '#d1fae5',
            badge: chatMenuItem?.badge,
            onPress: chatMenuItem?.onPress,
        },
    ];

    // Feature section
    const featureIconMap = new Map<string, Pick<SectionItem, 'icon' | 'iconColor' | 'iconBgColor'>>([
        ['communities', { icon: 'people-outline', iconColor: '#3b82f6', iconBgColor: '#dbeafe' }],
        ['events', { icon: 'calendar-outline', iconColor: '#8b5cf6', iconBgColor: '#ede9fe' }],
        ['jobs', { icon: 'briefcase-outline', iconColor: '#0ea5e9', iconBgColor: '#e0f2fe' }],
        ['market', { icon: 'storefront-outline', iconColor: '#f97316', iconBgColor: '#ffedd5' }],
        ['blogs', { icon: 'book-outline', iconColor: '#ec4899', iconBgColor: '#fce7f3' }],
        ['elearning', { icon: 'school-outline', iconColor: '#14b8a6', iconBgColor: '#ccfbf1' }],
        ['chat', { icon: 'chatbubbles-outline', iconColor: '#10b981', iconBgColor: '#d1fae5' }],
    ]);

    const featureSection: SectionItem[] = featureItems.map((menuItem) => ({
        id: menuItem.id,
        title: menuItem.title,
        icon: featureIconMap.get(menuItem.id)?.icon ?? 'apps-outline',
        iconColor: featureIconMap.get(menuItem.id)?.iconColor ?? '#6b7280',
        iconBgColor: featureIconMap.get(menuItem.id)?.iconBgColor ?? '#f3f4f6',
        onPress: menuItem.onPress,
        badge: menuItem.badge,
    }));

    // Ads section
    const adsIconMap = new Map<string, Pick<SectionItem, 'icon' | 'iconColor' | 'iconBgColor'>>([
        ['14', { icon: 'megaphone-outline', iconColor: '#f97316', iconBgColor: '#ffedd5' }],
        ['15', { icon: 'bar-chart-outline', iconColor: '#6366f1', iconBgColor: '#ede9fe' }],
    ]);
    const adsSection: SectionItem[] = adsItems.map((menuItem) => ({
        id: menuItem.id,
        title: menuItem.title,
        icon: adsIconMap.get(menuItem.id)?.icon ?? 'megaphone-outline',
        iconColor: adsIconMap.get(menuItem.id)?.iconColor ?? '#6b7280',
        iconBgColor: adsIconMap.get(menuItem.id)?.iconBgColor ?? '#f3f4f6',
        onPress: menuItem.onPress,
    }));

    // Support section
    const supportSection: SectionItem[] = supportItems.map((menuItem) => ({
        id: menuItem.id,
        title: menuItem.title,
        icon: 'help-circle-outline',
        iconColor: '#64748b',
        iconBgColor: '#f1f5f9',
        onPress: menuItem.onPress,
    }));

    const displayName = userProfile
        ? `${userProfile.firstName ?? ''} ${userProfile.lastName ?? ''}`.trim() || userProfile.name || 'Ourlime User'
        : 'Ourlime User';
    const displayHandle = userProfile?.userName
        ? `@${userProfile.userName}`
        : userProfile?.email ?? '';
    const avatarUrl = userProfile?.profilePicture ?? userProfile?.avatar ?? null;

    const renderSectionItem = (item: SectionItem) => (
        <Animated.View
            key={item.id}
            style={{
                opacity: contentOpacity,
                transform: [{
                    translateX: contentOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [30, 0],
                    }),
                }],
            }}
        >
            <TouchableOpacity
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 13,
                    marginHorizontal: 12,
                    marginVertical: 2,
                    borderRadius: 14,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04,
                    shadowRadius: 4,
                    elevation: 1,
                }}
                onPress={() => {
                    item.onPress?.();
                    onClose();
                }}
                activeOpacity={0.7}
            >
                <View style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: item.iconBgColor,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 14,
                }}>
                    <Ionicons name={item.icon} size={20} color={item.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, color: colors.text, fontWeight: '600' }}>
                        {item.title}
                    </Text>
                    {item.subtitle ? (
                        <Text style={{ fontSize: 12, color: colors.mutedText, marginTop: 1 }}>
                            {item.subtitle}
                        </Text>
                    ) : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {item.badge != null ? (
                        <View style={{
                            backgroundColor: '#ef4444',
                            borderRadius: 10,
                            paddingHorizontal: 7,
                            paddingVertical: 3,
                            marginRight: 8,
                            minWidth: 20,
                            alignItems: 'center',
                        }}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                                {item.badge}
                            </Text>
                        </View>
                    ) : null}
                    <Ionicons name="chevron-forward" size={14} color={colors.icon} />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );

    const renderSectionLabel = (label: string) => (
        <Text style={{
            fontSize: 11,
            fontWeight: '700',
            color: colors.mutedText,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginHorizontal: 24,
            marginTop: 20,
            marginBottom: 6,
        }}>
            {label}
        </Text>
    );

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="none"
            statusBarTranslucent
        >
            <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>

                {/* Overlay */}
                <Animated.View
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        opacity: overlayOpacity,
                    }}
                >
                    {Platform.OS === 'ios' ? (
                        <BlurView intensity={20} tint="dark" style={{ flex: 1 }}>
                            <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
                        </BlurView>
                    ) : (
                        <TouchableOpacity
                            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
                            onPress={onClose}
                            activeOpacity={1}
                        />
                    )}
                </Animated.View>

                {/* Menu Panel */}
                <Animated.View
                    style={{
                        width: MENU_WIDTH,
                        height: '100%',
                        backgroundColor: colors.canvas,
                        shadowColor: '#000',
                        shadowOffset: { width: -4, height: 0 },
                        shadowOpacity: 0.18,
                        shadowRadius: 20,
                        elevation: 20,
                        transform: [
                            { translateX: slideAnim },
                            { scale: scaleAnim },
                        ],
                    }}
                >
                    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>

                        {/* ─── Profile Header ─── */}
                        <LinearGradient
                            colors={['#059669', '#10b981', '#34d399']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{
                                paddingHorizontal: 20,
                                paddingTop: 16,
                                paddingBottom: 24,
                            }}
                        >
                            {/* Close button row */}
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 16 }}>
                                <TouchableOpacity
                                    onPress={onClose}
                                    style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 17,
                                        backgroundColor: 'rgba(255,255,255,0.22)',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}
                                >
                                    <Ionicons name="close" size={18} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            {/* Avatar + Name */}
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {avatarUrl ? (
                                    <Image
                                        source={{ uri: avatarUrl }}
                                        style={{
                                            width: 62,
                                            height: 62,
                                            borderRadius: 31,
                                            borderWidth: 2.5,
                                            borderColor: 'rgba(255,255,255,0.8)',
                                        }}
                                    />
                                ) : (
                                    <View style={{
                                        width: 62,
                                        height: 62,
                                        borderRadius: 31,
                                        backgroundColor: 'rgba(255,255,255,0.25)',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        borderWidth: 2.5,
                                        borderColor: 'rgba(255,255,255,0.6)',
                                    }}>
                                        <Ionicons name="person" size={30} color="#fff" />
                                    </View>
                                )}

                                <View style={{ marginLeft: 14, flex: 1 }}>
                                    <Text style={{
                                        fontSize: 18,
                                        fontWeight: '800',
                                        color: '#ffffff',
                                        letterSpacing: -0.3,
                                    }} numberOfLines={1}>
                                        {displayName}
                                    </Text>
                                    {displayHandle ? (
                                        <Text style={{
                                            fontSize: 13,
                                            color: 'rgba(255,255,255,0.82)',
                                            marginTop: 2,
                                            fontWeight: '500',
                                        }} numberOfLines={1}>
                                            {displayHandle}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                        </LinearGradient>

                        {/* ─── Scrollable Menu Body ─── */}
                        <ScrollView
                            style={{ flex: 1 }}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
                        >
                            {/* Account section */}
                            {renderSectionLabel('My Account')}
                            {accountSection.map((item) => renderSectionItem(item))}

                            {/* Explore section */}
                            {renderSectionLabel('Explore')}
                            {featureSection.map((item) => renderSectionItem(item))}

                            {/* Advertising section */}
                            {adsSection.length > 0 && (
                                <>
                                    {renderSectionLabel('Advertising')}
                                    {adsSection.map((item) => renderSectionItem(item))}
                                </>
                            )}

                            {/* Support section */}
                            {supportSection.length > 0 && (
                                <>
                                    {renderSectionLabel('Support')}
                                    {supportSection.map((item) => renderSectionItem(item))}
                                </>
                            )}
                        </ScrollView>

                        {/* ─── Logout Footer ─── */}
                        <Animated.View
                            style={{
                                opacity: contentOpacity,
                                paddingHorizontal: 16,
                                paddingVertical: 16,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                                backgroundColor: colors.canvas,
                            }}
                        >
                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingVertical: 14,
                                    borderRadius: 14,
                                    backgroundColor: '#fef2f2',
                                    borderWidth: 1,
                                    borderColor: '#fecaca',
                                }}
                                onPress={() => {
                                    logoutItem?.onPress?.();
                                    onClose();
                                }}
                                activeOpacity={0.75}
                            >
                                <Ionicons name="log-out-outline" size={18} color="#dc2626" />
                                <Text style={{
                                    marginLeft: 8,
                                    fontSize: 15,
                                    color: '#dc2626',
                                    fontWeight: '700',
                                }}>
                                    Log Out
                                </Text>
                            </TouchableOpacity>
                        </Animated.View>

                    </SafeAreaView>
                </Animated.View>
            </View>
        </Modal>
    );
}
