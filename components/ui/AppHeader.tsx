import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type AppHeaderProps = {
    title?: string;
    onMenuPress: () => void;
    showBackButton?: boolean;
    onBackPress?: () => void;
    rightIcon?: string;
    onRightIconPress?: () => void;
};

export default function AppHeader({ 
    title = 'OurLime', 
    onMenuPress, 
    showBackButton = false, 
    onBackPress,
    rightIcon,
    onRightIconPress
}: AppHeaderProps) {
    return (
        <>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <SafeAreaView style={{ backgroundColor: '#fff' }}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
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
                    {/* Left side */}
                    <View style={{
                        width: 40,
                        alignItems: 'flex-start',
                    }}>
                        {showBackButton ? (
                            <TouchableOpacity 
                                onPress={onBackPress} 
                                style={{
                                    padding: 8,
                                    borderRadius: 8,
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="arrow-back" size={24} color="#333" />
                            </TouchableOpacity>
                        ) : (
                            <View
                                style={{
                                    padding: 8,
                                    borderRadius: 8,
                                }} />
                        )}
                    </View>

                    {/* Center - Title */}
                    <View style={{
                        flex: 1,
                        alignItems: 'flex-start',
                    }}>
                        <Text style={{
                            fontSize: 18,
                            fontWeight: '600',
                            color: '#333',
                        }}>
                            {title}
                        </Text>
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