import { useEffect } from 'react';
import type { ComponentProps } from 'react';
import {
    View,
    Text,
    Image,
    ScrollView,
    Modal,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { SlideOutMenuProps } from '../../lib/types/componentProps';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';
import AnimatedActionButton from '@/components/ui/AnimatedActionButton';

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

function getBadgeLabel(badge: SectionItem['badge']): string | null {
    if (typeof badge === 'number') return String(badge);
    const label = badge?.trim();
    return label || null;
}

export default function SlideOutMenu({
    state,
    onClose,
    onOpened,
    onClosed,
    menuItems,
    userProfile,
}: SlideOutMenuProps) {
    const { colors } = useAppTheme();
    const interactionEnabled = state === 'open' || state === 'opening';
    const swipeDismiss = useSwipeDismiss({ visible: interactionEnabled, onDismiss: onClose, disabled: !interactionEnabled });

    useEffect(() => {
        if (state === 'closing') onClosed();
    }, [onClosed, state]);

    const logoutId = 'logout';

    const accountItems = menuItems.filter((menuItem) => menuItem.section === 'account');
    const featureItems = menuItems.filter((menuItem) => menuItem.section === 'explore');
    const adsItems = menuItems.filter((menuItem) => menuItem.section === 'advertising');
    const supportItems = menuItems.filter((menuItem) => menuItem.section === 'support');
    const administrationItems = menuItems.filter((menuItem) => menuItem.section === 'administration');
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

    const accountListSection: SectionItem[] = accountItems
        .filter((menuItem) => !['profile', 'settings', 'chat'].includes(menuItem.id))
        .map((menuItem) => ({
            id: menuItem.id,
            title: menuItem.title,
            icon: menuItem.id === 'saved' ? 'bookmark-outline' : menuItem.id === 'wallet' ? 'wallet-outline' : 'person-outline',
            iconColor: '#0f766e',
            iconBgColor: '#ccfbf1',
            onPress: menuItem.onPress,
            badge: menuItem.badge,
        }));

    // Feature section
    const featureIconMap = new Map<string, Pick<SectionItem, 'icon' | 'iconColor' | 'iconBgColor'>>([
        ['communities', { icon: 'people-outline', iconColor: '#3b82f6', iconBgColor: '#dbeafe' }],
        ['events', { icon: 'calendar-outline', iconColor: '#8b5cf6', iconBgColor: '#ede9fe' }],
        ['jobs', { icon: 'briefcase-outline', iconColor: '#0ea5e9', iconBgColor: '#e0f2fe' }],
        ['market', { icon: 'storefront-outline', iconColor: '#f97316', iconBgColor: '#ffedd5' }],
        ['blogs', { icon: 'book-outline', iconColor: '#ec4899', iconBgColor: '#fce7f3' }],
        ['elearning', { icon: 'school-outline', iconColor: '#14b8a6', iconBgColor: '#ccfbf1' }],
        ['projects', { icon: 'folder-open-outline', iconColor: '#0f766e', iconBgColor: '#ccfbf1' }],
        ['ehub', { icon: 'grid-outline', iconColor: '#7c3aed', iconBgColor: '#ede9fe' }],
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
        ['ads', { icon: 'megaphone-outline', iconColor: '#f97316', iconBgColor: '#ffedd5' }],
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
        icon: menuItem.id === 'policies' ? 'document-text-outline' : menuItem.id === 'child-safety' ? 'shield-checkmark-outline' : 'help-circle-outline',
        iconColor: '#64748b',
        iconBgColor: '#f1f5f9',
        onPress: menuItem.onPress,
    }));

    const administrationSection: SectionItem[] = administrationItems.map((menuItem) => ({
        id: menuItem.id,
        title: menuItem.title,
        icon: 'shield-checkmark-outline',
        iconColor: '#dc2626',
        iconBgColor: '#fee2e2',
        onPress: menuItem.onPress,
        badge: menuItem.badge,
    }));

    const displayName = userProfile
        ? `${userProfile.firstName ?? ''} ${userProfile.lastName ?? ''}`.trim() || userProfile.name || 'Ourlime User'
        : 'Ourlime User';
    const displayHandle = userProfile?.userName
        ? `@${userProfile.userName}`
        : userProfile?.email ?? '';
    const avatarUrl = userProfile?.profilePicture ?? userProfile?.avatar ?? null;

    const renderAccountShortcut = (item: SectionItem, index: number) => {
        const badgeLabel = getBadgeLabel(item.badge);
        return (
            <Animated.View key={item.id} entering={FadeInDown.springify().damping(18).stiffness(230).delay(index * 45)} style={{ flex: 1 }}>
                <AnimatedActionButton
                    onPress={item.onPress ?? (() => undefined)}
                    disabled={!interactionEnabled}
                    accessibilityLabel={item.title}
                    pressScale={0.95}
                    playful={false}
                    style={{
                        minHeight: 96,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                        paddingHorizontal: 8,
                        paddingVertical: 12,
                    }}
                >
                    <View style={{
                        width: 42,
                        height: 42,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 14,
                        backgroundColor: item.iconBgColor,
                    }}>
                        <Ionicons name={item.icon} size={21} color={item.iconColor} />
                    </View>
                    <Text numberOfLines={1} style={{ marginTop: 8, color: colors.text, fontSize: 12, fontWeight: '800' }}>
                        {item.title}
                    </Text>
                    {badgeLabel ? (
                        <View style={{ position: 'absolute', right: 8, top: 8, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#ef4444', paddingHorizontal: 4 }}>
                            <Text style={{ color: '#ffffff', fontSize: 9, fontWeight: '800' }}>{badgeLabel}</Text>
                        </View>
                    ) : null}
                </AnimatedActionButton>
            </Animated.View>
        );
    };

    const renderSectionItem = (item: SectionItem, index: number) => {
        const badgeLabel = getBadgeLabel(item.badge);
        return (
        <Animated.View key={item.id} entering={FadeInDown.springify().damping(18).stiffness(230).delay(90 + index * 35)}>
            <AnimatedActionButton
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
                onPress={item.onPress ?? (() => undefined)}
                disabled={!interactionEnabled}
                accessibilityLabel={item.title}
                pressScale={0.97}
                playful={false}
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
                    {badgeLabel ? (
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
                                {badgeLabel}
                            </Text>
                        </View>
                    ) : null}
                    <Ionicons name="chevron-forward" size={14} color={colors.icon} />
                </View>
            </AnimatedActionButton>
        </Animated.View>
        );
    };

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
            visible={state === 'opening' || state === 'open'}
            transparent
            statusBarTranslucent
            navigationBarTranslucent
            animationType="none"
            presentationStyle="overFullScreen"
            onShow={onOpened}
            onRequestClose={swipeDismiss.dismissWithAnimation}
        >
            <Animated.View style={[{ flex: 1 }, swipeDismiss.animatedStyle]}>
            <SafeAreaView edges={['top', 'bottom', 'left', 'right']} accessibilityViewIsModal style={{ flex: 1, backgroundColor: colors.canvas }}>

                        {/* ─── Profile Header ─── */}
                        <LinearGradient
                            colors={['#059669', '#10b981', '#34d399']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{
                                paddingHorizontal: 20,
                                paddingTop: 10,
                                paddingBottom: 18,
                            }}
                        >
                            <SwipeDismissHandle gesture={swipeDismiss.gesture} color="rgba(255,255,255,0.58)" animatedStyle={swipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close navigation" />

                            {/* Avatar + Name */}
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {avatarUrl ? (
                                    <Image
                                        source={{ uri: avatarUrl }}
                                        style={{
                                            width: 54,
                                            height: 54,
                                            borderRadius: 27,
                                            borderWidth: 2.5,
                                            borderColor: 'rgba(255,255,255,0.8)',
                                        }}
                                    />
                                ) : (
                                    <View style={{
                                        width: 54,
                                        height: 54,
                                        borderRadius: 27,
                                        backgroundColor: 'rgba(255,255,255,0.25)',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        borderWidth: 2.5,
                                        borderColor: 'rgba(255,255,255,0.6)',
                                    }}>
                                        <Ionicons name="person" size={27} color="#fff" />
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
                                <AnimatedActionButton
                                    onPress={swipeDismiss.dismissWithAnimation}
                                    disabled={!interactionEnabled}
                                    accessibilityLabel="Close menu"
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 20,
                                        backgroundColor: 'rgba(255,255,255,0.22)',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}
                                >
                                    <Ionicons name="close" size={21} color="#fff" />
                                </AnimatedActionButton>
                            </View>
                        </LinearGradient>

                        {/* ─── Scrollable Menu Body ─── */}
                        <ScrollView
                            style={{ flex: 1 }}
                            showsVerticalScrollIndicator={false}
                            nestedScrollEnabled
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingTop: 4, paddingBottom: 16 }}
                        >
                            {/* Account section */}
                            {renderSectionLabel('My Account')}
                             <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12 }}>
                                 {accountSection.map((item, index) => renderAccountShortcut(item, index))}
                             </View>
                            {accountListSection.map((item, index) => renderSectionItem(item, index))}

                            {/* Explore section */}
                            {renderSectionLabel('Explore')}
                            {featureSection.map((item, index) => renderSectionItem(item, index))}

                            {/* Advertising section */}
                            {adsSection.length > 0 && (
                                <>
                                    {renderSectionLabel('Advertising')}
                                    {adsSection.map((item, index) => renderSectionItem(item, index))}
                                </>
                            )}

                            {/* Support section */}
                            {supportSection.length > 0 && (
                                <>
                                    {renderSectionLabel('Support')}
                                    {supportSection.map((item, index) => renderSectionItem(item, index))}
                                </>
                            )}

                            {administrationSection.length > 0 && (
                                <>
                                    {renderSectionLabel('Administration')}
                                    {administrationSection.map((item, index) => renderSectionItem(item, index))}
                                </>
                            )}
                        </ScrollView>

                        {/* ─── Logout Footer ─── */}
                        <View
                            style={{
                                paddingHorizontal: 16,
                                paddingVertical: 16,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                                backgroundColor: colors.canvas,
                            }}
                        >
                            <AnimatedActionButton
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingVertical: 14,
                                    borderRadius: 14,
                                    backgroundColor: colors.destructiveSurface,
                                    borderWidth: 1,
                                    borderColor: colors.destructive,
                                }}
                                onPress={() => {
                                    logoutItem?.onPress?.();
                                }}
                                disabled={!interactionEnabled}
                                feedback="warning"
                                accessibilityLabel="Log out"
                                pressScale={0.97}
                            >
                                <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
                                <Text style={{
                                    marginLeft: 8,
                                    fontSize: 15,
                                    color: colors.destructiveText,
                                    fontWeight: '700',
                                }}>
                                    Log Out
                                </Text>
                            </AnimatedActionButton>
                        </View>
            </SafeAreaView>
            </Animated.View>
        </Modal>
    );
}
