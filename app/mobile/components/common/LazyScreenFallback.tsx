import React from "react";
import { ActivityIndicator, View } from "react-native";

type LazyScreenFallbackProps = {
    color?: string;
};

export default function LazyScreenFallback({ color = "#5305c7" }: LazyScreenFallbackProps) {
    return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F5F7" }}>
            <ActivityIndicator size="large" color={color} />
        </View>
    );
}
