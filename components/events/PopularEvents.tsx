import React from "react";
import { View, Text, Image as RNImage, Dimensions, TouchableOpacity } from "react-native";
import Carousel, { ICarouselInstance, Pagination } from "react-native-reanimated-carousel";
import { useSharedValue } from "react-native-reanimated";
import type { Event } from "@/types/eventTypes";

const { width } = Dimensions.get("window");
// Use 90% of screen width for cards
const CARD_WIDTH = width * 0.9;
const CARD_HEIGHT = CARD_WIDTH * 0.6;

type PopularEventsProps = { events: Event[] };

export default function PopularEvents({ events }: PopularEventsProps) {
  const data = events.slice(0, 4);
  const progress = useSharedValue(0);
  const carouselRef = React.useRef<ICarouselInstance>(null);

  const handleDotPress = (index: number) => {
    carouselRef.current?.scrollTo({ index, animated: true });
  };

  const next = () => {
    const nextIndex = Math.min(data.length - 1, Math.ceil(progress.value) + 1);
    carouselRef.current?.scrollTo({ index: nextIndex, animated: true });
  };

  const prev = () => {
    const prevIndex = Math.max(0, Math.floor(progress.value) - 1);
    carouselRef.current?.scrollTo({ index: prevIndex, animated: true });
  };

  return (
    <View style={{
      alignItems: "center",
      padding: 16,
      backgroundColor: "#fff",
      borderRadius: 12,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 6,
      marginVertical: 16,
    }}>
      <Text style={{
        fontSize: 20,
        fontWeight: "800",
        marginBottom: 12,
        alignSelf: "flex-start",
        color: "#222",
      }}>Popular Events</Text>

      <View style={{
        flexDirection: "row",
        alignItems: "center",
      }}>
        <Carousel
          ref={carouselRef}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          data={data}
          loop={true}
          autoPlay={true}
          autoPlayInterval={3000}
          onProgressChange={progress}
          style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
          renderItem={({ item }: { item: Event }) => (
            <View style={{
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              borderRadius: 12,
              overflow: "hidden",
              backgroundColor: "#f9f9f9",
            }}>
              <RNImage
                source={{ uri: item.media?.find(m => m.type === "image")?.url || "" }}
                style={{ width: "100%", height: CARD_HEIGHT * 0.6 }}
                resizeMode="cover"
              />
              <Text style={{
                fontSize: 18,
                fontWeight: "600",
                marginTop: 8,
                paddingHorizontal: 8,
              }} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={{
                fontSize: 16,
                color: "#555",
                marginTop: 4,
                paddingHorizontal: 8,
              }} numberOfLines={2}>
                {item.description}
              </Text>
            </View>
          )}
        />
      </View>

      <Pagination.Basic
        progress={progress}
        data={data}
        containerStyle={{
          flexDirection: "row",
          justifyContent: "center",
          marginTop: 12,
        }}
        dotStyle={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: "#ccc",
        }}
        activeDotStyle={{ backgroundColor: "#01eb53" }}
        onPress={handleDotPress}
      />
      <View style={{
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 12,
      }}>
        {/* <TouchableOpacity onPress={prev} style={{
          paddingVertical: 8,
          paddingHorizontal: 16,
          backgroundColor: "#01eb53",
          borderRadius: 6,
          marginHorizontal: 8,
        }}>
          <Text style={{ color: "#fff", fontWeight: "600" }}>Prev</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={next} style={{
          paddingVertical: 8,
          paddingHorizontal: 16,
          backgroundColor: "#01eb53",
          borderRadius: 6,
          marginHorizontal: 8,
        }}>
          <Text style={{ color: "#fff", fontWeight: "600" }}>Next</Text>
        </TouchableOpacity> */}
      </View>
    </View>
  );
}
