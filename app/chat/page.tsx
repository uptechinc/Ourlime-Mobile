import React, { useState } from "react";
import { View, TextInput, Text, Pressable } from "react-native";
import { Users, Globe, Briefcase } from 'lucide-react-native';
import FriendChats from "@/components/chat/FriendChat";
import BusinessChats from "@/components/chat/businessChat";

export default function Chat() {
    const [activeTab, setActiveTab] = useState<'friends' | 'businesses' | 'discover'>('friends');

    return (
        <View>
            <View style={{ padding: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: '500', }}>Messages</Text>
            </View>
            <TextInput
                style={{
                    borderWidth: 1, borderRadius: 15, borderColor: '#6b7280', fontSize: 16, backgroundColor: '#e2e1e1ff',
                    paddingHorizontal: 12, paddingVertical: 8
                }}
                placeholder={`Search ${activeTab === 'friends' ? 'friends' : 'rooms'}...`} />
            <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-around', padding: 5 }}>
                <Pressable style={{
                    display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
                    borderWidth: 1, borderRadius: 10, borderColor: activeTab === 'friends' ? '#01eb53' : '#374151',
                    padding: 3, backgroundColor: activeTab === 'friends' ? '#01eb53' : 'default'
                }} onPress={() => setActiveTab('friends')}>
                    <Users size={16} color={activeTab === 'friends' ? '#fff' : '#374151'} />
                    <Text style={{
                        fontSize: 16, fontWeight: '500',
                        color: activeTab === 'friends' ? '#fff' : '#374151'
                    }}> Friends</Text>
                </Pressable>
                <Pressable style={{
                    display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
                    borderWidth: 1, borderRadius: 10, borderColor: activeTab === 'businesses' ? '#01eb53' : '#374151',
                    padding: 3, backgroundColor: activeTab === 'businesses' ? '#01eb53' : 'default'
                }} onPress={() => setActiveTab('businesses')}>
                    <Briefcase size={16} color={activeTab === 'businesses' ? '#fff' : '#374151'} />
                    <Text style={{
                        fontSize: 16, fontWeight: '500',
                        color: activeTab === 'businesses' ? '#fff' : '#374151'
                    }}> Businesses</Text>
                </Pressable>
                <Pressable style={{
                    display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
                    borderWidth: 1, borderRadius: 10, borderColor: activeTab === 'discover' ? '#01eb53' : '#374151',
                    padding: 3, backgroundColor: activeTab === 'discover' ? '#01eb53' : 'default',
                }} onPress={() => setActiveTab('discover')}>
                    <Globe size={16} color={activeTab === 'discover' ? '#fff' : '#374151'} />
                    <Text style={{
                        fontSize: 16, fontWeight: '500',
                        color: activeTab === 'discover' ? '#fff' : '#374151'
                    }}> Discover</Text>
                </Pressable>
            </View>

            {activeTab === 'friends' ? (
                <FriendChats />
            ) : activeTab === 'businesses' ? (
                <BusinessChats />
            ) : (
                <Text style={{ textAlign: "center" }}>We're working on something exciting!</Text>
            )}


        </View>
    );
}