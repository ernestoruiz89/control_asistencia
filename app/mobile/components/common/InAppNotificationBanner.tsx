import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type InAppNotificationBannerProps = {
    visible: boolean;
    title: string;
    message?: string;
    type?: string;
    autoHideMs?: number;
    onPress: () => void;
    onDismiss: () => void;
};

function getVisualStyle(type?: string) {
    switch ((type || "").toLowerCase()) {
        case "mention":
            return {
                icon: "alternate-email" as const,
                iconColor: "#0052CC",
                iconBg: "#DEEBFF",
                border: "#B3D4FF",
            };
        case "assignment":
            return {
                icon: "assignment" as const,
                iconColor: "#5305C7",
                iconBg: "#EAE6FF",
                border: "#D2C7FF",
            };
        case "alert":
            return {
                icon: "warning" as const,
                iconColor: "#FF8B00",
                iconBg: "#FFFAE6",
                border: "#FFE2B8",
            };
        default:
            return {
                icon: "notifications" as const,
                iconColor: "#42526E",
                iconBg: "#F4F5F7",
                border: "#DFE1E6",
            };
    }
}

export default function InAppNotificationBanner({
    visible,
    title,
    message,
    type,
    autoHideMs = 4500,
    onPress,
    onDismiss,
}: InAppNotificationBannerProps) {
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(-120)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const style = useMemo(() => getVisualStyle(type), [type]);

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout> | undefined;

        if (visible) {
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    speed: 22,
                    bounciness: 4,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 180,
                    useNativeDriver: true,
                }),
            ]).start();

            timeout = setTimeout(() => {
                onDismiss();
            }, autoHideMs);
        } else {
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: -120,
                    duration: 140,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 120,
                    useNativeDriver: true,
                }),
            ]).start();
        }

        return () => {
            if (timeout) {
                clearTimeout(timeout);
            }
        };
    }, [autoHideMs, onDismiss, opacity, translateY, visible]);

    if (!visible) {
        return null;
    }

    return (
        <View
            pointerEvents="box-none"
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
            }}
        >
            <Animated.View
                style={{
                    paddingTop: insets.top + 8,
                    paddingHorizontal: 12,
                    transform: [{ translateY }],
                    opacity,
                }}
            >
                <Pressable
                    onPress={onPress}
                    className="rounded-2xl border bg-white px-4 py-3"
                    style={{
                        borderColor: style.border,
                        shadowColor: "#091E42",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                        elevation: 5,
                    }}
                >
                    <View className="flex-row items-start">
                        <View
                            className="mr-3 mt-0.5 h-9 w-9 items-center justify-center rounded-lg"
                            style={{ backgroundColor: style.iconBg }}
                        >
                            <MaterialIcons name={style.icon} size={18} color={style.iconColor} />
                        </View>
                        <View className="flex-1">
                            <Text className="text-sm font-bold text-[#091E42]" numberOfLines={1}>
                                {title}
                            </Text>
                            {!!message && (
                                <Text className="mt-0.5 text-sm text-[#42526E]" numberOfLines={2}>
                                    {message}
                                </Text>
                            )}
                        </View>
                        <Pressable onPress={onDismiss} className="ml-2 h-8 w-8 items-center justify-center rounded-full">
                            <MaterialIcons name="close" size={18} color="#6B778C" />
                        </Pressable>
                    </View>
                </Pressable>
            </Animated.View>
        </View>
    );
}
