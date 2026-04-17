import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { markNotificationAsRead, getNotifications } from "../../lib/api";
import { useTranslation } from "../../lib/i18n";
import { useAuth } from "../../lib/AuthContext";
import { formatDate, stripHtml } from "../../lib/utils";

interface Notification {
    name: string;
    subject: string;
    message: string;
    read: number;
    creation: string;
    type: string;
}

interface NotificationsModalProps {
    visible: boolean;
    onClose: () => void;
    onRefreshCount: () => void;
}

export default function NotificationsModal({ visible, onClose, onRefreshCount }: NotificationsModalProps) {
    const { t } = useTranslation();
    const router = useRouter();
    const { dateFormat } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [limitStart, setLimitStart] = useState(0);
    const PAGE_LENGTH = 10;

    useEffect(() => {
        if (visible) {
            setLimitStart(0);
            setNotifications([]);
            loadNotifications(0);
        }
    }, [visible]);


    async function loadNotifications(start: number) {
        try {
            if (start === 0) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }

            const res = await getNotifications(start, PAGE_LENGTH);
            if (res.status === "success") {
                if (start === 0) {
                    setNotifications(res.data);
                } else {
                    setNotifications(prev => [...prev, ...res.data]);
                }
                setHasMore(res.has_more);
                setLimitStart(start + PAGE_LENGTH);
            }
        } catch (error) {
            console.error("Failed to load notifications:", error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }

    const handleLoadMore = () => {
        if (!loadingMore && hasMore) {
            loadNotifications(limitStart);
        }
    };

    async function handlePress(notification: Notification) {
        // Navigate
        onClose();
        router.push(`/(app)/notification/${notification.name}`);

        // Mark as read if needed
        if (!notification.read) {
            try {
                await markNotificationAsRead(notification.name);
                onRefreshCount();
            } catch (error) {
                console.error("Failed to mark as read:", error);
            }
        }
    }

    const getNotificationStyle = (type: string) => {
        switch (type) {
            case "Mention":
                return { icon: "alternate-email", color: "#0052CC", bg: "#DEEBFF" };
            case "Assignment":
                return { icon: "assignment", color: "#5305c7", bg: "#EAE6FF" };
            case "Alert":
                return { icon: "warning", color: "#FF8B00", bg: "#FFFAE6" };
            default:
                return { icon: "notifications", color: "#42526E", bg: "#F4F5F7" };
        }
    }

    const getTranslatedType = (type: string) => {
        switch (type) {
            case "Mention": return t.notifications?.mention || "Mention";
            case "Assignment": return t.notifications?.assignment || "Assignment";
            case "Alert": return t.notifications?.alert || "Alert";
            default: return type || "Notificación";
        }
    };

    const renderItem = ({ item }: { item: Notification }) => {
        const style = getNotificationStyle(item.type);

        return (
            <TouchableOpacity
                onPress={() => handlePress(item)}
                className={`mx-4 my-2 p-4 rounded-xl border border-[#DFE1E6]/50 shadow-sm ${item.read ? "bg-white" : "bg-[#5305c7]/[0.03]"
                    }`}
                style={{
                    elevation: 1,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                }}
            >
                <View className="flex-row items-center mb-3">
                    <View
                        className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                        style={{ backgroundColor: style.bg }}
                    >
                        <MaterialIcons name={style.icon as any} size={16} color={style.color} />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row justify-between items-center">
                            <Text className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">
                                {getTranslatedType(item.type)}
                            </Text>
                            <Text className="text-[10px] text-[#8993A4]">
                                {formatDate(item.creation.split(" ")[0], dateFormat)}
                            </Text>
                        </View>
                    </View>
                    {!item.read && (
                        <View className="w-2 h-2 bg-[#5305c7] rounded-full ml-2 shadow-sm" />
                    )}
                </View>

                <Text className={`text-sm mb-1 ${item.read ? "text-[#42526E]" : "text-[#091E42] font-bold"}`}>
                    {stripHtml(item.subject)}
                </Text>

                <Text className="text-sm text-[#5E6C84] leading-5" numberOfLines={2}>
                    {stripHtml(item.message)}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <SafeAreaView className="flex-1 bg-white" edges={['top']}>
                {/* Header */}
                <View className="flex-row items-center justify-between px-6 py-5 bg-white border-b border-[#F4F5F7]">
                    <View>
                        <Text className="text-xl font-bold text-[#091E42]">
                            {t.notifications?.title || "Notificaciones"}
                        </Text>
                        <Text className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-[0.2em] mt-0.5">
                            {notifications.length} {t.common.total || "Total"}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={onClose}
                        className="w-10 h-10 items-center justify-center bg-[#F4F5F7] rounded-full active:bg-[#DFE1E6]"
                    >
                        <MaterialIcons name="close" size={20} color="#42526E" />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                {loading && notifications.length === 0 ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#5305c7" />
                    </View>
                ) : (
                    <FlatList
                        data={notifications}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.name}
                        contentContainerStyle={{ paddingVertical: 12 }}
                        ListEmptyComponent={
                            <View className="flex-1 items-center justify-center pt-32 px-10">
                                <View className="w-20 h-20 bg-[#F4F5F7] rounded-full items-center justify-center mb-6">
                                    <MaterialIcons name="notifications-off" size={40} color="#DFE1E6" />
                                </View>
                                <Text className="text-[#091E42] text-lg font-bold mb-2">
                                    {t.notifications?.empty_title || "Todo al día"}
                                </Text>
                                <Text className="text-[#5E6C84] text-center leading-5">
                                    {t.notifications?.empty || "No tienes notificaciones pendientes en este momento."}
                                </Text>
                            </View>
                        }
                        ListFooterComponent={
                            hasMore ? (
                                <TouchableOpacity
                                    onPress={handleLoadMore}
                                    disabled={loadingMore}
                                    className="mx-4 my-4 p-4 bg-[#F4F5F7] rounded-xl items-center border border-[#DFE1E6]/50"
                                >
                                    {loadingMore ? (
                                        <ActivityIndicator color="#5305c7" />
                                    ) : (
                                        <Text className="text-[#5305c7] font-bold">
                                            {t.common.load_more || "Cargar más"}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            ) : notifications.length > 0 ? (
                                <View className="py-8 items-center">
                                    <Text className="text-[#8993A4] text-sm font-medium">
                                        {t.notifications?.no_more_logs || "No hay más notificaciones"}
                                    </Text>
                                </View>
                            ) : null
                        }
                    />
                )}
            </SafeAreaView>
        </Modal>
    );
}
