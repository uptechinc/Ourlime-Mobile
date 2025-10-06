import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

const mockBusinesses = [
    {
        name: 'Ali`s Doubles',
        photo: 'https://bloximages.newyork1.vip.townnews.com/trinidadexpress.com/content/tncms/assets/v3/editorial/d/37/d37af6c2-aaf4-11e8-97db-23bc6f3c4d47/5b859c21282af.image.jpg'
    },
    {
        name: 'Uptech',
        photo: 'https://uptechincorp.com/favicon.ico'
    }
];

export default function BusinessChats() {
    return (
        mockBusinesses.map((business) => (
            <View>
                <TouchableOpacity style={{
                    display: 'flex', flexDirection: 'row', justifyContent: "flex-start", alignItems: 'center',
                    marginTop: 3, marginBottom: 3
                }}>
                    <Image
                        source={{ uri: business.photo }}
                        style={{ width: 42, height: 42, borderRadius: 24, marginRight: 20, alignSelf: 'flex-start' }}
                    />
                    <Text style={{ fontSize: 24, fontWeight: "bold" }}>{business.name}</Text>
                </TouchableOpacity>
            </View>
        ))
    );
}