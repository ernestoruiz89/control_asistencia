import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "../../../lib/i18n";
import { getVisitDetails } from "../../../lib/api";
import { useAuth } from "../../../lib/AuthContext";
import { formatDate } from "../../../lib/utils";

type VisitData = {
    id: string;
    customer_name: string;
    customer_id: string;
    visit_type: string;
    visit_status: string;
    date: string;
    time: string;
    latitude?: number;
    longitude?: number;
    comments?: string;
    commitment_date?: string;
    amount_to_pay?: number;
};

export default function VisitDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { t } = useTranslation();
    const { dateFormat, setDateFormat } = useAuth();
    const [visit, setVisit] = useState<VisitData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const res = await getVisitDetails(id as string);
                if (res.status === "success" && res.data) {
                    if (res.data.date_format && res.data.date_format !== dateFormat) {
                        setDateFormat(res.data.date_format);
                    }
                    setVisit(res.data);
                }
            } catch (err) {
                console.error("Error loading visit", err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-[#F4F5F7]">
                <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-[#DFE1E6]">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center bg-[#F4F5F7] rounded border border-[#DFE1E6] active:bg-[#DFE1E6]"
                    >
                        <MaterialIcons name="arrow-back" size={24} color="#091E42" />
                    </TouchableOpacity>
                </View>
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#0052CC" />
                </View>
            </SafeAreaView>
        );
    }

    if (!visit) {
        return (
            <SafeAreaView className="flex-1 bg-[#F4F5F7]">
                <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-[#DFE1E6]">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center bg-[#F4F5F7] rounded border border-[#DFE1E6] active:bg-[#DFE1E6]"
                    >
                        <MaterialIcons name="arrow-back" size={24} color="#091E42" />
                    </TouchableOpacity>
                </View>
                <View className="flex-1 justify-center items-center">
                    <Text className="text-[#5E6C84]">{t.common.error}</Text>
                </View>
            </SafeAreaView>
        );
    }

    const TYPE_MAPPING: Record<string, string> = {
        "Payment Promise": t.visit.promise,
        "Not Found": t.visit.not_found,
        "Agreement": t.visit.agreement,
        "Notification": t.visit.notification,
    };

    return (
        <SafeAreaView className="flex-1 bg-[#F4F5F7]">
            {/* Header */}
            <View className="flex-row items-center px-6 py-4 bg-white border-b border-[#DFE1E6]">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center bg-[#F4F5F7] rounded border border-[#DFE1E6] active:bg-[#DFE1E6]"
                >
                    <MaterialIcons name="arrow-back" size={24} color="#091E42" />
                </TouchableOpacity>
                <View className="items-center flex-1 pr-10">
                    <Text className="text-[#091E42] font-bold text-lg tracking-widest uppercase">
                        {t.visit.visit_detail}
                    </Text>
                </View>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
                {/* Visit Card */}
                <View className="bg-white rounded-xl border border-[#DFE1E6] p-6 shadow-sm mb-6">
                    <View className="flex-row items-start justify-between mb-6">
                        <View className="flex-1">
                            <Text className="text-[#5E6C84] text-[10px] font-bold uppercase tracking-wider mb-1">
                                {t.customer.title}
                            </Text>
                            <Text className="text-[#091E42] font-bold text-xl mb-1">
                                {visit.customer_name}
                            </Text>
                            <Text className="text-[#5E6C84] text-xs font-mono">
                                {visit.customer_id}
                            </Text>
                        </View>
                        <View className="items-end">
                            <View className={`px-2 py-1 rounded border ${visit.visit_status === "Completed" ? "bg-[#E3FCEF] border-[#ABF5D1]" : "bg-[#FFF0B3] border-[#FFE380]"}`}>
                                <Text className={`text-[10px] font-bold uppercase ${visit.visit_status === "Completed" ? "text-[#006644]" : "text-[#827C00]"}`}>
                                    {visit.visit_status}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Divider */}
                    <View className="h-[1px] bg-[#DFE1E6] w-full mb-6" />

                    <View className="flex-row items-center mb-4">
                        <View className="w-10 h-10 rounded-full bg-[#EAE6FF] items-center justify-center mr-4">
                            <MaterialIcons name="class" size={20} color="#403294" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-[#5E6C84] text-xs mb-1 uppercase font-bold tracking-wider">
                                {t.visit.visit_type}
                            </Text>
                            <Text className="text-[#091E42] font-bold text-base">
                                {TYPE_MAPPING[visit.visit_type] || visit.visit_type || "None"}
                            </Text>
                        </View>
                    </View>

                    <View className="flex-row items-center mb-4">
                        <View className="w-10 h-10 rounded-full bg-[#EAE6FF] items-center justify-center mr-4">
                            <MaterialIcons name="event" size={20} color="#403294" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-[#5E6C84] text-xs mb-1 uppercase font-bold tracking-wider">
                                {t.common.date} & {t.common.time}
                            </Text>
                            <Text className="text-[#091E42] font-bold text-base">
                                {formatDate(visit.date, dateFormat)} {visit.time}
                            </Text>
                        </View>
                    </View>

                    {visit.commitment_date && (
                        <View className="flex-row items-center mb-4">
                            <View className="w-10 h-10 rounded-full bg-[#E3FCEF] items-center justify-center mr-4">
                                <MaterialIcons name="event-available" size={20} color="#006644" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-[#5E6C84] text-xs mb-1 uppercase font-bold tracking-wider">
                                    {t.visit.commitment_date}
                                </Text>
                                <Text className="text-[#006644] font-bold text-base">
                                    {formatDate(visit.commitment_date, dateFormat)}
                                </Text>
                            </View>
                        </View>
                    )}

                    {visit.amount_to_pay && visit.amount_to_pay > 0 ? (
                        <View className="flex-row items-center mb-4">
                            <View className="w-10 h-10 rounded-full bg-[#E3FCEF] items-center justify-center mr-4">
                                <MaterialIcons name="payments" size={20} color="#006644" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-[#5E6C84] text-xs mb-1 uppercase font-bold tracking-wider">
                                    {t.visit.amount_to_pay}
                                </Text>
                                <Text className="text-[#006644] font-bold text-base font-mono">
                                    {visit.amount_to_pay.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                </Text>
                            </View>
                        </View>
                    ) : null}



                    {visit.comments ? (
                        <View className="mt-4 bg-[#F4F5F7] p-4 rounded-lg border border-[#DFE1E6]">
                            <Text className="text-[#5E6C84] text-[10px] mb-2 uppercase font-bold tracking-wider">
                                {t.visit.comments}
                            </Text>
                            <Text className="text-[#091E42] text-sm leading-relaxed">
                                {visit.comments}
                            </Text>
                        </View>
                    ) : null}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
