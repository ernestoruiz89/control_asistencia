import { MaterialIcons } from "@expo/vector-icons";
import { NavigationContext } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
    FlatList,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator,
    TextInput
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useState, useCallback, useContext, useEffect } from "react";

import CustomerCard from "../../../components/dashboard/CustomerCard";
import { useConfirmExitOnBack } from "../../../hooks/useConfirmExitOnBack";
import { useTranslation } from "../../../lib/i18n";
import { getDashboardData, getDashboardMeta } from "../../../lib/api";
import { useAuth } from "../../../lib/AuthContext";
import NotificationsModal from "../../../components/dashboard/NotificationsModal";

export default function RouteDashboard() {
    const { t } = useTranslation();
    const navigation = useContext(NavigationContext);
    const router = useRouter();
    const { session, isLoading: authLoading } = useAuth();
    useConfirmExitOnBack();

    const [customers, setCustomers] = useState<any[]>([]);
    const [meta, setMeta] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [notificationsVisible, setNotificationsVisible] = useState(false);

    const loadData = useCallback(async () => {
        if (authLoading) return; // Wait until AuthContext finishes checking the local storage session

        if (!session?.loan_officer_id) {
            setLoading(false);
            // Removed aggressive logout() to avoid feedback loop or race condition
            return;
        }

        try {
            setLoading(true);
            const [data, metaData] = await Promise.all([
                getDashboardData(session.loan_officer_id),
                getDashboardMeta(session.loan_officer_id)
            ]);
            setCustomers(data || []);
            setMeta(metaData || {});
        } catch (error) {
            console.error("Failed to load dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, [session?.loan_officer_id, authLoading]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSync = () => {
        loadData();
    };

    const handleOpenDrawer = () => {
        (navigation as any)?.openDrawer?.();
    };

    const renderHeader = () => (
        <View className="bg-white pt-4 pb-6 px-6 border-b border-[#DFE1E6] shadow-sm">
            <View className="flex-row items-center justify-between mb-4">
                <TouchableOpacity
                    onPress={handleOpenDrawer}
                    className="w-10 h-10 items-center justify-center bg-[#F4F5F7] rounded border border-[#DFE1E6] active:bg-[#DFE1E6]"
                >
                    <MaterialIcons name="menu" size={24} color="#091E42" />
                </TouchableOpacity>

                <View className="items-center flex-1 mx-3">
                    <Text className="text-[#091E42] font-bold text-sm uppercase tracking-wide">
                        {t.dashboard.title}
                    </Text>
                    <Text className="text-[#5E6C84] text-xs font-bold tracking-widest uppercase">
                        {meta.branch || ""}
                    </Text>
                    <Text className="text-[#5E6C84] text-xs font-mono mt-0.5">
                        {meta.system_date || ""}
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={() => setNotificationsVisible(true)}
                    className="w-10 h-10 items-center justify-center bg-[#F4F5F7] rounded border border-[#DFE1E6] active:bg-[#DFE1E6]"
                >
                    <MaterialIcons name="notifications-none" size={24} color="#091E42" />
                    {meta.unread_notifications_count > 0 && (
                        <View className="absolute -bottom-1 -left-1 w-5 h-5 bg-[#FF3B30] rounded-full border-2 border-white items-center justify-center">
                            <Text className="text-[10px] text-white font-bold leading-none" style={{ textAlign: 'center' }}>
                                {meta.unread_notifications_count > 9 ? "9+" : meta.unread_notifications_count}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Shift indicator */}
            <View className="flex-row items-center justify-center">
                <View className={`w-2 h-2 rounded-full mr-2 ${meta.active_shift ? 'bg-[#006644]' : 'bg-[#FF3B30]'}`} />
                <Text className={`font-bold text-xs ${meta.active_shift ? 'text-[#091E42]' : 'text-[#FF3B30]'}`}>
                    {meta.active_shift ? `${t.dashboard.shift_id}: ${meta.active_shift}` : t.dashboard.no_active_shift}
                </Text>
            </View>
        </View>
    );

    const renderFooter = () => (
        <View className="flex-row gap-3 p-6 bg-white border-t border-[#DFE1E6]">
            <TouchableOpacity
                onPress={() => router.push("/(app)/(drawer)/map")}
                className="flex-1 bg-[#F4F5F7] h-14 rounded flex-row items-center justify-center border border-[#DFE1E6] gap-2 active:bg-[#DFE1E6] shadow-sm"
            >
                <MaterialIcons name="map" size={20} color="#091E42" />
                <Text className="text-[#091E42] font-bold uppercase text-sm tracking-widest">
                    {t.dashboard.map_view}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={handleSync}
                disabled={loading}
                className="flex-1 bg-[#5305c7] h-14 rounded flex-row items-center justify-center shadow-md active:translate-y-px gap-2"
            >
                {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                    <>
                        <MaterialIcons name="sync" size={20} color="white" />
                        <Text className="text-white font-bold uppercase text-sm tracking-widest">
                            {t.dashboard.sync_data}
                        </Text>
                    </>
                )}
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-[#F4F5F7]">
            <View className="flex-1">
                {renderHeader()}

                <View className="px-6 pt-4">
                    <View className="flex-row items-center bg-white border border-[#DFE1E6] rounded-lg px-3 py-2 shadow-sm">
                        <MaterialIcons name="search" size={20} color="#5E6C84" />
                        <TextInput
                            className="flex-1 ml-2 text-[#091E42] text-sm"
                            placeholder={t.dashboard.search_placeholder}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery("")}>
                                <MaterialIcons name="close" size={20} color="#5E6C84" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View className="flex-1 px-6 pt-6">
                    <View className="flex-row items-center justify-between mb-5">
                        <Text className="text-[#5E6C84] text-xs font-bold tracking-[0.2em] uppercase">
                            {t.dashboard.customer_queue}
                        </Text>
                        <Text className="text-[#5E6C84] text-xs font-bold">
                            {customers.length} {t.dashboard.customer_queue.split(" ").pop()?.toUpperCase() || ""}
                        </Text>
                    </View>

                    {loading && customers.length === 0 ? (
                        <View className="flex-1 justify-center items-center">
                            <ActivityIndicator size="large" color="#5305c7" />
                        </View>
                    ) : (
                        (() => {
                            const filteredCustomers = customers.filter(c =>
                                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                c.id.toLowerCase().includes(searchQuery.toLowerCase())
                            );

                            if (filteredCustomers.length === 0) {
                                return (
                                    <View className="flex-1 justify-center items-center">
                                        <MaterialIcons name="search-off" size={48} color="#DFE1E6" />
                                        <Text className="text-[#5E6C84] mt-4 font-medium italic">{t.dashboard.no_customers_found}</Text>
                                    </View>
                                );
                            }

                            return (
                                <FlatList
                                    data={filteredCustomers}
                                    renderItem={({ item }) => <CustomerCard customer={item} />}
                                    keyExtractor={(item) => item.id}
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={{ paddingBottom: 20 }}
                                />
                            );
                        })()
                    )}
                </View>

                {renderFooter()}

                <NotificationsModal
                    visible={notificationsVisible}
                    onClose={() => setNotificationsVisible(false)}
                    onRefreshCount={loadData}
                />
            </View>
        </SafeAreaView>
    );
}
