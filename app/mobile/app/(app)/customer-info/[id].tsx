import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCustomerDetail } from "../../../lib/api";
import { useAuth } from "../../../lib/AuthContext";
import { useTranslation } from "../../../lib/i18n";
import { formatDate } from "../../../lib/utils";

type RowItem = {
    label: string;
    value: string | number;
};

function renderValue(value: unknown) {
    if (value === null || value === undefined || value === "") return "";
    return String(value);
}

function InfoSection({ title, rows }: { title: string; rows: RowItem[] }) {
    if (!rows.length) return null;

    return (
        <View className="bg-white border border-[#DFE1E6] rounded-lg mb-4 overflow-hidden">
            <View className="px-4 py-3 border-b border-[#DFE1E6] bg-[#F4F5F7]">
                <Text className="text-[#5E6C84] text-sm font-bold uppercase tracking-[0.12em]">
                    {title}
                </Text>
            </View>
            <View className="px-4 py-2">
                {rows.map((row) => (
                    <View key={row.label} className="py-2 border-b border-[#F4F5F7] last:border-b-0">
                        <Text className="text-[#5E6C84] text-sm font-bold uppercase">{row.label}</Text>
                        <Text className="text-[#091E42] text-base mt-1">{row.value}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

export default function CustomerMoreInfoScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { t } = useTranslation();
    const { dateFormat, setDateFormat } = useAuth();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [customer, setCustomer] = useState<any>(null);
    const [errorMessage, setErrorMessage] = useState("");

    const customerId = Array.isArray(id) ? id[0] : id;

    const loadData = useCallback(async (showLoader: boolean = true) => {
        if (!customerId) {
            if (!showLoader) setRefreshing(false);
            return;
        }
        try {
            if (showLoader) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }
            setErrorMessage("");
            const data = await getCustomerDetail(customerId);
            if (data.date_format && data.date_format !== dateFormat) {
                setDateFormat(data.date_format);
            }
            setCustomer(data);
        } catch (error) {
            console.error("Failed to load customer additional details:", error);
            setCustomer(null);
            const rawError = String((error as { message?: string })?.message || "");
            const normalizedError = rawError.toLowerCase();
            if (
                normalizedError.includes("403") ||
                normalizedError.includes("not permitted") ||
                normalizedError.includes("permission") ||
                normalizedError.includes("permiso")
            ) {
                setErrorMessage(t.common.no_permission || "No tienes permisos para ver esta informacion.");
            } else {
                setErrorMessage(t.common.no_data);
            }
        } finally {
            if (showLoader) {
                setLoading(false);
            } else {
                setRefreshing(false);
            }
        }
    }, [customerId, dateFormat, setDateFormat, t.common.no_data, t.common.no_permission]);

    const onRefresh = useCallback(() => {
        loadData(false);
    }, [loadData]);

    useFocusEffect(
        useCallback(() => {
            loadData(true);
        }, [loadData])
    );

    const profile = customer?.profile || {};
    const birthDate = profile.date_of_birth ? formatDate(profile.date_of_birth, dateFormat) : "";

    const identificationRows = useMemo(
        () =>
            [
                { label: t.customer.office_id || "Office ID", value: renderValue(profile.office_id) },
                { label: t.customer.national_id_type || "ID Type", value: renderValue(profile.national_id_type) },
                { label: t.customer.national_id || "Identification", value: renderValue(profile.national_id) },
            ],
        [profile.office_id, profile.national_id_type, profile.national_id, t.customer.national_id, t.customer.national_id_type, t.customer.office_id]
    );

    const personalRows = useMemo(
        () =>
            [
                { label: t.customer.customer_type || "Customer Type", value: renderValue(profile.customer_type) },
                { label: t.customer.status_label || "Status", value: renderValue(profile.status) },
                { label: t.customer.date_of_birth || "Date of Birth", value: renderValue(birthDate) },
                { label: t.customer.gender || "Gender", value: renderValue(profile.gender) },
                { label: t.customer.civil_status || "Civil Status", value: renderValue(profile.civil_status) },
            ],
        [birthDate, profile.civil_status, profile.gender, t.customer.civil_status, t.customer.date_of_birth, t.customer.gender]
    );

    const contactRows = useMemo(
        () =>
            [
                { label: t.customer.email || "Email", value: renderValue(profile.email) },
            ],
        [profile.email, t.customer.email]
    );

    const economicRows = useMemo(
        () =>
            [
                { label: t.customer.occupation || "Occupation", value: renderValue(profile.occupation) },
                { label: t.customer.economic_activity || "Economic Activity", value: renderValue(profile.economic_activity) },
            ],
        [profile.economic_activity, profile.occupation, t.customer.economic_activity, t.customer.occupation]
    );

    const addressRows = useMemo(
        () =>
            [
                { label: t.customer.address_line1 || "Address Line 1", value: renderValue(profile.address_line1) },
                { label: t.customer.city || "City", value: renderValue(profile.city) },
                { label: t.customer.state || "State", value: renderValue(profile.state) },
            ],
        [profile.address_line1, profile.city, profile.state, t.customer.address_line1, t.customer.city, t.customer.state]
    );

    return (
        <SafeAreaView className="flex-1 bg-[#F4F5F7]">
            <View className="bg-white pt-4 pb-6 px-6 border-b border-[#DFE1E6] flex-row items-center shadow-sm">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center bg-[#F4F5F7] rounded border border-[#DFE1E6] mr-4 active:bg-[#DFE1E6]"
                >
                    <MaterialIcons name="arrow-back" size={24} color="#091E42" />
                </TouchableOpacity>
                <Text className="text-[#091E42] font-bold text-lg uppercase tracking-wide">
                    {t.customer.more_info_title || "Informacion adicional del cliente"}
                </Text>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#5305c7" />
                </View>
            ) : !customer ? (
                <View className="flex-1 justify-center items-center px-6">
                    <Text className="text-[#5E6C84] text-center">{errorMessage || t.common.no_data}</Text>
                </View>
            ) : (
                <View className="flex-1">
                    <View className="bg-white border border-[#DFE1E6] rounded-none p-4 mb-4">
                        <Text className="text-[#091E42] text-xl font-bold">{customer?.name || ""}</Text>
                        <Text className="text-[#5E6C84] text-lg font-semibold mt-1">{customer?.id || ""}</Text>
                    </View>

                    <ScrollView
                        className="flex-1 px-6"
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5305c7" />
                        }
                    >
                        <InfoSection
                            title={t.customer.identification_section || "Identification"}
                            rows={identificationRows}
                        />
                        <InfoSection
                            title={t.customer.personal_section || "Personal Information"}
                            rows={personalRows}
                        />
                        <InfoSection
                            title={t.customer.contact_section || "Contact Information"}
                            rows={contactRows}
                        />
                        <InfoSection
                            title={t.customer.economic_section || "Economic Activity"}
                            rows={economicRows}
                        />
                        <InfoSection
                            title={t.customer.address_section || "Address"}
                            rows={addressRows}
                        />
                        <View className="h-6" />
                    </ScrollView>
                </View>
            )}
        </SafeAreaView>
    );
}
