import { View, ScrollView } from 'react-native';
import { CommunitiesSection } from "@/components/home/RightSection/RightSectionComponent/CommunitySection/CommunitySection";
import { EventsSection } from "@/components/home/RightSection/RightSectionComponent/EventSection/EventSection";
import { JobsSection } from "@/components/home/RightSection/RightSectionComponent/JobsSection/JobSection";

export const Discover = () => {
    return (
        <View style={{
            width: '100%',
            backgroundColor: '#ffffff',
            borderRadius: 8,
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: 2,
            },
            shadowOpacity: 0.1,
            shadowRadius: 3.84,
            elevation: 5,
            padding: 16,
            height: '100%',
            zIndex: 10,
        }}>
            <ScrollView 
                style={{
                    flex: 1,
                }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingBottom: 50,
                }}
            >
                <CommunitiesSection />
                <EventsSection />
                <JobsSection />
            </ScrollView>
        </View>
    );
};

export default Discover;
