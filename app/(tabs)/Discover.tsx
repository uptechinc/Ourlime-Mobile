import { View, ScrollView, Text } from "react-native";
import { CommunitiesSection } from "@/components/home/RightSection/RightSectionComponent/CommunitySection/CommunitySection";
import { EventsSection } from "@/components/home/RightSection/RightSectionComponent/EventSection/EventSection";
import { JobsSection } from "@/components/home/RightSection/RightSectionComponent/JobsSection/JobSection";
import PageHeader from "@/components/ui/PageHeader";
import { useRouter } from "expo-router";
import { Users, Calendar, Briefcase } from "lucide-react-native";

export const Discover = () => {
  const router = useRouter();
  return (
    <View
      style={{
        // width: '100%',
        // backgroundColor: '#ffffff',
        // borderRadius: 8,
        // shadowColor: '#000',
        // shadowOffset: {
        //     width: 0,
        //     height: 2,
        // },
        // shadowOpacity: 0.1,
        // shadowRadius: 3.84,
        // elevation: 5,
        // height: '100%',
        // zIndex: 10,
        flex: 1,
        backgroundColor: "#f9fafb",
      }}
    >
      {/* <PageHeader 
            title="Discover"
            onBackPress={() => router.back()}
            /> */}

      <ScrollView
        style={{
          flex: 1,
          //paddingTop: 16,
          //paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          //paddingTop: 8,
          paddingBottom: 100,
        }}
      >
        {/* Hero Section */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 32,
            backgroundColor: "#f9fafb",
            borderBottomWidth: 1,
            borderBottomColor: "#e5e7eb",
          }}
        >
          <Text
            style={{
              fontSize: 24,
              fontWeight: "800",
              color: "#111827",
              marginBottom: 8,
              letterSpacing: -1,
            }}
          >
            Explor Everything
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: "#6b7280",
              lineHeight: 24,
            }}
          >
            Discover communities, events, and opportunities
          </Text>
        </View>

        {/* Communities Section */}
        <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "#dbeafe",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={20} color="#3b82fb" />
            </View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: "#111827",
                letterSpacing: -0.3,
              }}
            >
              Communities
            </Text>
          </View>
          <View style={{ marginTop: 4 }}>
            <CommunitiesSection />
          </View>
        </View>

        {/* Events Section */}
        <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "#dbeafe",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Calendar size={20} color="#f59e0b" />
            </View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: "#111827",
                letterSpacing: -0.3,
              }}
            >
              Events
            </Text>
          </View>
          <View style={{ marginTop: 4 }}>
            <EventsSection />
          </View>
        </View>

        {/* Jobs Section */}
        <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "#dbeafe",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Briefcase size={20} color="#8b5cf6" />
            </View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: "#111827",
                letterSpacing: -0.3,
              }}
            >
              Jobs
            </Text>
          </View>
          <View style={{ marginTop: 4 }}>
            <JobsSection />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default Discover;
