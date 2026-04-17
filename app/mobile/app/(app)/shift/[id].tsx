import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
    FlatList,
    Text,
    TouchableOpacity,
    TextInput,
    View,
    ActivityIndicator,
    RefreshControl
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "../../../lib/i18n";
import { getShiftDetails } from "../../../lib/api";
import { useAuth } from "../../../lib/AuthContext";
import { formatDate } from "../../../lib/utils";

type Activity = {
    id: string;
    type: "payment" | "agreement" | "notification" | "promise" | "not_found";
    customer: string;
    amount?: number;
    currency?: string;
    symbol?: string;
    date: string;
    time: string;
    method?: string;
    status: string;
};

type ShiftData = {
    id: string;
    status: string;
    start_time: string;
    end_time: string | null;
    total_visits: number;
    total_payments: number;
    activities: Activity[];
    totals: { currency: string; symbol: string; expected_amount: number; counted_amount: number; variance: number }[];
    date_format?: string;
};

export default function ShiftDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { t } = useTranslation();
    const { dateFormat, setDateFormat } = useAuth();

    const [shiftData, setShiftData] = useState<ShiftData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [customerFilter, setCustomerFilter] = useState("");

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getShiftDetails(id as string);
            if (res.status === "success" && res.data) {
                setShiftData(res.data);
                if (res.data.date_format && res.data.date_format !== dateFormat) {
                    setDateFormat(res.data.date_format);
                }
            }
        } catch (error) {
            console.error("Error fetching shift details:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id, dateFormat, setDateFormat]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    function fmtAmount(amount: number, symbol: string) {
        const symbolDisplay = symbol.length > 2 ? `${symbol} ` : symbol;
        return `${symbolDisplay}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    const renderItem = ({ item }: { item: Activity }) => {
        const isPayment = item.type === "payment";

        return (
            <TouchableOpacity
                onPress={() => {
                    if (isPayment) {
                        router.push(`/(app)/receipt/${item.id}`);
                    } else {
                        // For visits we can use a generic visit detail or the specific one if available
                        router.push(`/(app)/visit/${item.id}`);
                    }
                }}
                className="bg-white p-5 rounded-lg border border-[#DFE1E6] mb-3 mx-6 flex-row justify-between items-center shadow-sm active:bg-[#F4F5F7]"
            >
                <View className="flex-row items-center gap-4">
                    <View className={`w-10 h-10 rounded-full items-center justify-center border ${item.type === "payment" ? "bg-[#E3FCEF] border-[#ABF5D1]" :
                        item.type === "agreement" ? "bg-[#DEEBFF] border-[#B3D4FF]" :
                            item.type === "promise" ? "bg-[#E3FCEF] border-[#ABF5D1]" :
                                item.type === "not_found" ? "bg-[#FFEBE6] border-[#FFBDAD]" :
                                    "bg-[#FFF0B3] border-[#FFE380]"
                        }`}>
                        <MaterialIcons
                            name={
                                item.type === "payment" ? "check" :
                                    item.type === "agreement" ? "handshake" :
                                        item.type === "promise" ? "event-available" :
                                            item.type === "not_found" ? "person-off" :
                                                "assignment"
                            }
                            size={20}
                            color={
                                item.type === "payment" ? "#006644" :
                                    item.type === "agreement" ? "#0052CC" :
                                        item.type === "promise" ? "#006644" :
                                            item.type === "not_found" ? "#DE350B" :
                                                "#827C00"
                            }
                        />
                    </View>
                    <View>
                        <View className="flex-row items-center gap-2">
                            <Text className="text-[#091E42] font-bold text-sm">{item.customer}</Text>
                            {item.type !== "payment" && (
                                <View className={`px-1.5 py-0.5 rounded border ${item.type === "agreement" ? "bg-[#DEEBFF] border-[#B3D4FF]" :
                                    item.type === "promise" ? "bg-[#E3FCEF] border-[#ABF5D1]" :
                                        item.type === "not_found" ? "bg-[#FFEBE6] border-[#FFBDAD]" :
                                            "bg-[#FFF0B3] border-[#FFE380]"
                                    }`}>
                                    <Text className={`text-[8px] font-bold uppercase ${item.type === "agreement" ? "text-[#0052CC]" :
                                        item.type === "promise" ? "text-[#006644]" :
                                            item.type === "not_found" ? "text-[#DE350B]" :
                                                "text-[#827C00]"
                                        }`}>
                                        {item.type === "agreement" ? t.visit.agreement :
                                            item.type === "promise" ? t.visit.promise :
                                                item.type === "not_found" ? t.visit.not_found :
                                                    t.visit.notification}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text className="text-[#5E6C84] text-xs font-mono mt-0.5">
                            {formatDate(item.date, dateFormat)} {item.time}
                        </Text>
                    </View>
                </View>

                <View className="items-end">
                    {isPayment ? (
                        <View className="items-end">
                            <Text className="text-[#091E42] font-bold text-base font-mono">
                                {fmtAmount(item.amount || 0, item.symbol || "")}
                            </Text>
                            <Text className="text-[#5E6C84] text-xs font-bold uppercase mt-0.5">
                                {item.currency}
                            </Text>
                        </View>
                    ) : (
                        <MaterialIcons name="chevron-right" size={20} color="#DFE1E6" />
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    if (loading && !refreshing) {
        return (
            <SafeAreaView className="flex-1 bg-[#F4F5F7] justify-center items-center">
                <ActivityIndicator size="large" color="#0052CC" />
            </SafeAreaView>
        );
    }

    if (!shiftData) return null;

    const normalizedCustomerFilter = customerFilter.trim().toLowerCase();
    const filteredActivities = normalizedCustomerFilter.length > 0
        ? shiftData.activities.filter((activity) =>
            (activity.customer || "").toLowerCase().includes(normalizedCustomerFilter)
        )
        : shiftData.activities;

    return (
        <SafeAreaView className="flex-1 bg-[#F4F5F7]">
            {/* Header */}
            <View className="bg-white pt-4 pb-6 px-6 border-b border-[#DFE1E6] flex-row items-center shadow-sm">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center bg-[#F4F5F7] rounded border border-[#DFE1E6] mr-4 active:bg-[#DFE1E6]"
                >
                    <MaterialIcons name="arrow-back" size={24} color="#091E42" />
                </TouchableOpacity>
                <View>
                    <Text className="text-[#091E42] font-bold text-lg uppercase tracking-wide">
                        {t.history.shift_summary}
                    </Text>
                    <Text className="text-[#5E6C84] text-xs font-bold uppercase tracking-widest">
                        ID: {shiftData.id}
                    </Text>
                </View>
            </View>

            <View className="flex-1">
                <View className="mb-6">
                    {/* Performance Grid */}
                    <View className="bg-white border-b border-[#DFE1E6]">
                        <View className="flex-row">
                            <View className="flex-1 p-5 border-r border-[#DFE1E6] border-b border-[#DFE1E6]">
                                <Text className="text-sm font-bold uppercase text-[#5E6C84] tracking-wider mb-1">{t.history.start_time}</Text>
                                <Text className="text-sm font-bold text-[#091E42]">{shiftData.start_time}</Text>
                            </View>
                            <View className="flex-1 p-5 border-b border-[#DFE1E6]">
                                <Text className="text-sm font-bold uppercase text-[#5E6C84] tracking-wider mb-1">{t.history.end_time}</Text>
                                <Text className="text-sm font-bold text-[#091E42]">{shiftData.end_time || "--:--"}</Text>
                            </View>
                        </View>
                        <View className="flex-row">
                            <View className="flex-1 p-5 border-r border-[#DFE1E6] bg-[#E3FCEF]/20">
                                <Text className="text-sm font-bold uppercase text-[#006644] tracking-wider mb-1">{t.history.total_recovered}</Text>
                                {shiftData.totals.map((tot, idx) => (
                                    <Text key={tot.currency} className={`text-lg font-bold text-[#091E42] font-mono ${idx > 0 ? "mt-1" : ""}`}>
                                        {fmtAmount(tot.counted_amount, tot.symbol)}
                                    </Text>
                                ))}
                            </View>
                            <View className="flex-1 p-5 bg-[#DEEBFF]/20">
                                <Text className="text-sm font-bold uppercase text-[#0052CC] tracking-wider mb-2">{t.history.activities}</Text>
                                <View className="gap-2">
                                    <View className="flex-row items-center gap-2">
                                        <Text className="text-lg font-bold text-[#091E42]">{shiftData.total_payments}</Text>
                                        <Text className="text-xs text-[#5E6C84] font-bold uppercase">{t.ledger.payments_recorded}</Text>
                                    </View>
                                    <View className="flex-row items-center gap-2">
                                        <Text className="text-lg font-bold text-[#091E42]">{shiftData.total_visits}</Text>
                                        <Text className="text-xs text-[#5E6C84] font-bold uppercase">{t.visit.title}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View className="px-6 mt-6">
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-[#5E6C84] text-xs font-bold tracking-[0.2em] uppercase">
                                {t.history.transactions}
                            </Text>
                            <Text className="text-[#5E6C84] text-xs font-bold uppercase">
                                {filteredActivities.length}/{shiftData.activities.length} ITEMS
                            </Text>
                        </View>

                        <View className="bg-white border border-[#DFE1E6] rounded-lg px-3 h-12 flex-row items-center shadow-sm">
                            <MaterialIcons name="search" size={20} color="#5E6C84" />
                            <TextInput
                                className="flex-1 ml-2 text-[#091E42] text-sm"
                                placeholder={t.ledger.filter_customer_placeholder || "Filter by customer name..."}
                                value={customerFilter}
                                onChangeText={setCustomerFilter}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            {customerFilter.length > 0 && (
                                <TouchableOpacity onPress={() => setCustomerFilter("")}>
                                    <MaterialIcons name="close" size={20} color="#5E6C84" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>

                <FlatList
                    data={filteredActivities}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0052CC"]} />
                    }
                    ListEmptyComponent={
                        <View className="flex-1 items-center justify-center pt-10">
                            <MaterialIcons name="event-note" size={48} color="#DFE1E6" />
                            <Text className="text-[#5E6C84] mt-4 font-bold">
                                {normalizedCustomerFilter.length > 0
                                    ? (t.ledger.no_matches || "No activities match this customer.")
                                    : t.common.no_data}
                            </Text>
                        </View>
                    }
                />
            </View>
        </SafeAreaView>
    );
}
