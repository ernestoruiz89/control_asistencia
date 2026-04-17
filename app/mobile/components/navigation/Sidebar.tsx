import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View, Alert, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/AuthContext";
import { useTranslation } from "../../lib/i18n";
import { getActiveShift, openShift } from "../../lib/api";

interface SidebarProps {
    onClose: () => void;
    isOpen?: boolean;
    navigation: any;
}

export default function Sidebar({ onClose, isOpen, navigation }: SidebarProps) {
    const { logout, fullName } = useAuth();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    const handleLogout = () => {
        const confirmMessage = t.sidebar.logout_confirm || "Are you sure you want to log out?";

        if (Platform.OS === "web") {
            const confirmed =
                typeof globalThis.confirm === "function"
                    ? globalThis.confirm(confirmMessage)
                    : true;

            if (!confirmed) {
                return;
            }

            void (async () => {
                await logout();
                onClose();
            })();
            return;
        }

        Alert.alert(
            t.common.confirm || "Confirm",
            confirmMessage,
            [
                { text: t.common.cancel || "Cancel", style: "cancel" },
                {
                    text: t.sidebar.logout || "Log Out",
                    style: "destructive",
                    onPress: async () => {
                        await logout();
                        onClose();
                    },
                },
            ]
        );
    };

    const [hasActiveShift, setHasActiveShift] = React.useState(false);
    const [isStartingShift, setIsStartingShift] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) {
            getActiveShift().then(res => {
                if (res.status === "success" && res.data) {
                    setHasActiveShift(true);
                } else {
                    setHasActiveShift(false);
                }
            }).catch(err => {
                console.error("Failed to check active shift in sidebar", err);
            });
        }
    }, [isOpen]);

    const handleToggleShift = async () => {
        if (hasActiveShift) {
            navigation.getParent()?.navigate("close-shift");
            onClose();
        } else {
            try {
                setIsStartingShift(true);
                const res = await openShift();
                if (res.status === "success") {
                    setHasActiveShift(true);
                } else {
                    Alert.alert("Error", res.message || "Failed to start shift");
                }
            } catch (err: any) {
                Alert.alert("Error", err.message || "Network error");
            } finally {
                setIsStartingShift(false);
            }
        }
    };

    const navItems = [
        {
            icon: "dashboard",
            label: t.sidebar.dashboard,
            screen: "dashboard",
        },
        {
            icon: "people",
            label: t.sidebar.customers,
            screen: "index",
        },
        {
            icon: "list-alt",
            label: t.sidebar.daily_ledger,
            screen: "ledger",
        },
        {
            icon: "map",
            label: t.sidebar.route_map,
            screen: "map",
        },
        {
            icon: "history",
            label: t.sidebar.audit_logs,
            screen: "logs",
        },
    ] as const;

    return (
        <View className="flex-1 bg-[#F4F5F7] border-r border-[#DFE1E6]">
            {/* User Profile Header */}
            <View
                className="pb-8 px-6 bg-white border-b border-[#DFE1E6]"
                style={{ paddingTop: Math.max(insets.top, 12) + 16 }}
            >
                <View className="flex-row items-center mb-6">
                    <View className="bg-[#5305c7] w-12 h-12 rounded items-center justify-center border border-white/20 shadow-sm">
                        <Text className="text-white font-bold text-xl uppercase">
                            {fullName?.charAt(0) || "U"}
                        </Text>
                    </View>
                    <View className="ml-4">
                        <Text className="text-[#091E42] font-bold text-lg">{fullName}</Text>
                        <Text className="text-[#5E6C84] text-[10px] font-bold tracking-widest uppercase">
                            {t.sidebar.field_ops_terminal}
                        </Text>
                    </View>
                </View>

                {/* Status Indicator */}
                <View className="flex-row items-center bg-[#E3FCEF] py-2 px-3 rounded border border-[#ABF5D1]">
                    <View className="w-2 h-2 rounded-full bg-[#006644] mr-3" />
                    <Text className="text-[#006644] text-[10px] font-bold uppercase tracking-wider">
                        {t.sidebar.sync_status}
                    </Text>
                </View>
            </View>

            {/* Navigation Links */}
            <View className="flex-1 py-6 px-4">
                {navItems.map((item) => (
                    <TouchableOpacity
                        key={item.screen}
                        className="flex-row items-center py-4 px-4 rounded mb-1 active:bg-[#DFE1E6]/30"
                        onPress={() => {
                            navigation.navigate(item.screen);
                            onClose();
                        }}
                    >
                        <MaterialIcons
                            name={item.icon as any}
                            size={22}
                            color="#42526E"
                        />
                        <Text className="text-[#091E42] ml-4 font-bold text-lg">{item.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Bottom Actions */}
            <View
                className="p-6 border-t border-[#DFE1E6] bg-white"
                style={{ paddingBottom: 24 + Math.max(insets.bottom, 12) }}
            >
                <TouchableOpacity
                    className="flex-row items-center mb-6 px-4 py-2"
                    onPress={handleLogout}
                >
                    <MaterialIcons name="logout" size={20} color="#DE350B" />
                    <Text className="text-[#DE350B] ml-4 font-bold uppercase text-base tracking-wide">
                        {t.sidebar.logout}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    className={`h-12 rounded flex-row items-center justify-center border shadow-sm active:translate-y-px ${hasActiveShift
                        ? "bg-[#F4F5F7] border-[#DFE1E6]"
                        : "bg-[#0052CC] border-[#0052CC]"
                        } ${isStartingShift ? "opacity-70" : ""}`}
                    disabled={isStartingShift}
                    onPress={handleToggleShift}
                >
                    {isStartingShift && <ActivityIndicator size="small" color="#FFF" className="mr-2" />}
                    <Text
                        className={`font-bold uppercase text-lg tracking-wide ${hasActiveShift ? "text-[#091E42]" : "text-white"
                            }`}
                    >
                        {hasActiveShift ? t.sidebar.end_shift : t.sidebar.start_shift}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
