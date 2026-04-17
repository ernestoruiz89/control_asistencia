import { MaterialIcons } from "@expo/vector-icons";
import { NavigationContext } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
    RefreshControl
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CollectionProgress from "../../../components/dashboard/CollectionProgress";
import { useConfirmExitOnBack } from "../../../hooks/useConfirmExitOnBack";
import { getDashboardMeta } from "../../../lib/api";
import { useAuth } from "../../../lib/AuthContext";
import { useTranslation } from "../../../lib/i18n";
import { formatDate } from "../../../lib/utils";

type DashboardScreenProps = {
    navigation?: {
        openDrawer?: () => void;
    };
};

export default function DashboardScreen({ navigation }: DashboardScreenProps) {
    const { t } = useTranslation();
    const { session, isLoading: authLoading, dateFormat, setDateFormat } = useAuth();
    const contextNavigation = React.useContext(NavigationContext);
    useConfirmExitOnBack();

    const [meta, setMeta] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async (isRefresh = false) => {
        if (authLoading) return;

        if (!session?.loan_officer_id) {
            setLoading(false);
            // Removed aggressive logout() to avoid feedback loop or race condition
            // console.warn("Missing loan_officer_id, waiting for auth...");
            return;
        }

        try {
            if (!isRefresh) setLoading(true);
            const metaData = await getDashboardMeta(session.loan_officer_id);
            if (metaData?.date_format && metaData.date_format !== dateFormat) {
                setDateFormat(metaData.date_format);
            }
            setMeta(metaData || {});
        } catch (error) {
            console.error("Failed to load dashboard meta:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [session?.loan_officer_id, authLoading, dateFormat, setDateFormat]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData(true);
    };

    const handleOpenDrawer = () => {
        const drawerNavigation = navigation ?? (contextNavigation as DashboardScreenProps["navigation"]);
        drawerNavigation?.openDrawer?.();
    };

    const renderHeader = () => (
        <View className="bg-white pt-4 pb-6 px-6 border-b border-[#DFE1E6] shadow-sm">
            <View className="flex-row items-center justify-between">
                <TouchableOpacity
                    onPress={handleOpenDrawer}
                    className="w-10 h-10 items-center justify-center bg-[#F4F5F7] rounded border border-[#DFE1E6] active:bg-[#DFE1E6]"
                >
                    <MaterialIcons name="menu" size={24} color="#091E42" />
                </TouchableOpacity>

                <View className="items-center flex-1 mx-3">
                    <Text className="text-[#091E42] font-bold text-sm uppercase tracking-wide">
                        {t.dashboard.overview}
                    </Text>
                    <Text className="text-[#5E6C84] text-xs font-mono mt-0.5">
                        {formatDate(meta.system_date, dateFormat)}
                    </Text>
                </View>

                <View className="w-10" />
            </View>
        </View>
    );

    if (loading && !refreshing) {
        return (
            <SafeAreaView className="flex-1 bg-[#F4F5F7]">
                {renderHeader()}
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#5305c7" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-[#F4F5F7]">
            <View className="flex-1">
                {renderHeader()}

                <ScrollView
                    className="flex-1 px-6 pt-6"
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#5305c7"]} />
                    }
                >
                    <View className="mb-6">
                        <Text className="text-[#5E6C84] text-xs font-bold tracking-[0.2em] uppercase mb-4">
                            {t.dashboard.collection_progress}
                        </Text>

                        <CollectionProgress
                            target={meta.collection_target_base || 0}
                            actual={meta.collection_actual_base || 0}
                            symbol={meta.base_currency_symbol}
                        />
                    </View>

                    {/* Portfolio Summary Section */}
                    <View className="mb-6">
                        <Text className="text-[#5E6C84] text-xs font-bold tracking-[0.2em] uppercase mb-4">
                            {t.dashboard.portfolio_summary}
                        </Text>

                        {/* Row 1: Financial Performance */}
                        <View className="flex-row gap-3 mb-3">
                            {/* Total Balance Card */}
                            <View className="flex-1 bg-white p-4 rounded-lg border border-[#DFE1E6] shadow-sm">
                                <Text className="text-[#5E6C84] text-[10px] font-bold uppercase tracking-wider mb-1">
                                    {t.dashboard.total_balance}
                                </Text>
                                <Text className="text-[#091E42] font-bold text-base">
                                    {meta.base_currency_symbol} {(meta.portfolio_principal_base || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                            </View>

                            {/* Total Customers */}
                            <View className="flex-1 bg-white p-4 rounded-lg border border-[#DFE1E6] shadow-sm">
                                <Text className="text-[#5E6C84] text-[10px] font-bold uppercase tracking-wider mb-1">
                                    {t.dashboard.total_customers}
                                </Text>
                                <Text className="text-[#091E42] font-bold text-xl">
                                    {meta.customers_count || 0}
                                </Text>
                            </View>
                        </View>

                        {/* Row 2: Portfolio & Total Customers */}
                        <View className="flex-row gap-3 mb-3">
                            {/* Total Credits */}
                            <View className="flex-1 bg-white p-4 rounded-lg border border-[#DFE1E6] shadow-sm">
                                <Text className="text-[#5E6C84] text-[10px] font-bold uppercase tracking-wider mb-1" numberOfLines={1} adjustsFontSizeToFit>
                                    {t.dashboard.total_credits}
                                </Text>
                                <Text className="text-[#091E42] font-bold text-xl">
                                    {meta.total_credits_count || 0}
                                </Text>
                            </View>

                            {/* Delinquent Customers */}
                            <View className="flex-1 bg-white p-4 rounded-lg border border-[#DFE1E6] shadow-sm">
                                <Text className="text-[#5E6C84] text-[10px] font-bold uppercase tracking-wider mb-1">
                                    {t.dashboard.delinquent_customers}
                                </Text>
                                <Text className={`font-bold text-xl ${(meta.delinquent_customers_count || 0) > 0 ? 'text-[#DE350B]' : 'text-[#091E42]'}`}>
                                    {meta.delinquent_customers_count || 0}
                                </Text>
                            </View>
                        </View>

                        {/* Row 3: Delinquency Details */}
                        <View className="flex-row gap-3 mb-6">
                            {/* Delinquency Rate (Amount + %) */}
                            <View className="flex-1 bg-white p-4 rounded-lg border border-[#DFE1E6] shadow-sm">
                                <Text className="text-[#5E6C84] text-[10px] font-bold uppercase tracking-wider mb-1" numberOfLines={1} adjustsFontSizeToFit>
                                    {t.dashboard.delinquency_rate}
                                </Text>
                                <Text
                                    className={`font-bold text-base ${(meta.portfolio_arrears_base || 0) > 0 ? 'text-[#DE350B]' : 'text-[#091E42]'}`}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                >
                                    {meta.base_currency_symbol} {(meta.portfolio_arrears_base || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                                <Text className={`text-sm font-bold mt-1 ${(meta.portfolio_principal_base > 0 && ((meta.portfolio_arrears_base || 0) / meta.portfolio_principal_base) > 0) ? 'text-[#DE350B]' : 'text-[#5E6C84]'}`}>
                                    {meta.portfolio_principal_base > 0
                                        ? `${(((meta.portfolio_arrears_base || 0) / meta.portfolio_principal_base) * 100).toFixed(2)}%`
                                        : "0.00%"}
                                </Text>
                            </View>

                            {/* Morosity % (Overdue Principal + %) */}
                            <View className="flex-1 bg-white p-4 rounded-lg border border-[#DFE1E6] shadow-sm">
                                <Text className="text-[#5E6C84] text-[10px] font-bold uppercase tracking-wider mb-1" numberOfLines={1} adjustsFontSizeToFit>
                                    {t.dashboard.morosity_rate || "% Morosidad"}
                                </Text>
                                <Text
                                    className={`font-bold text-base ${(meta.portfolio_overdue_principal_base || 0) > 0 ? 'text-[#DE350B]' : 'text-[#091E42]'}`}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                >
                                    {meta.base_currency_symbol} {(meta.portfolio_overdue_principal_base || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                                <Text className={`text-sm font-bold mt-1 ${(meta.portfolio_principal_base > 0 && ((meta.portfolio_overdue_principal_base || 0) / meta.portfolio_principal_base) > 0) ? 'text-[#DE350B]' : 'text-[#5E6C84]'}`}>
                                    {meta.portfolio_principal_base > 0
                                        ? `${(((meta.portfolio_overdue_principal_base || 0) / meta.portfolio_principal_base) * 100).toFixed(2)}%`
                                        : "0.00%"}
                                </Text>
                            </View>
                        </View>

                        {/* Row 4: Arrears Aging Buckets */}
                        <View className="mb-6">
                            <Text className="text-[#5E6C84] text-[10px] font-bold tracking-[0.2em] uppercase mb-4">
                                {t.dashboard.arrears_aging}
                            </Text>

                            <View className="flex-row gap-3 mb-3">
                                {/* 1-7 Days */}
                                <View className="flex-1 bg-white p-4 rounded-lg border border-[#DFE1E6] shadow-sm">
                                    <Text className="text-[#5E6C84] text-[10px] font-bold uppercase tracking-wider mb-1" numberOfLines={1} adjustsFontSizeToFit>
                                        {t.dashboard.arrears_1_7}
                                    </Text>
                                    <Text
                                        className={`font-bold text-base ${(meta.arrears_1_7_base || 0) > 0 ? 'text-[#DE350B]' : 'text-[#091E42]'}`}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                    >
                                        {meta.base_currency_symbol} {(meta.arrears_1_7_base || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Text>
                                    <Text className={`text-sm font-bold mt-1 ${(meta.portfolio_principal_base > 0 && ((meta.arrears_1_7_base || 0) / meta.portfolio_principal_base) > 0) ? 'text-[#DE350B]' : 'text-[#5E6C84]'}`}>
                                        {meta.portfolio_principal_base > 0
                                            ? `${(((meta.arrears_1_7_base || 0) / meta.portfolio_principal_base) * 100).toFixed(2)}%`
                                            : "0.00%"}
                                    </Text>
                                </View>

                                {/* 8-30 Days */}
                                <View className="flex-1 bg-white p-4 rounded-lg border border-[#DFE1E6] shadow-sm">
                                    <Text className="text-[#5E6C84] text-[10px] font-bold uppercase tracking-wider mb-1" numberOfLines={1} adjustsFontSizeToFit>
                                        {t.dashboard.arrears_8_30}
                                    </Text>
                                    <Text
                                        className={`font-bold text-base ${(meta.arrears_8_30_base || 0) > 0 ? 'text-[#DE350B]' : 'text-[#091E42]'}`}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                    >
                                        {meta.base_currency_symbol} {(meta.arrears_8_30_base || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Text>
                                    <Text className={`text-sm font-bold mt-1 ${(meta.portfolio_principal_base > 0 && ((meta.arrears_8_30_base || 0) / meta.portfolio_principal_base) > 0) ? 'text-[#DE350B]' : 'text-[#5E6C84]'}`}>
                                        {meta.portfolio_principal_base > 0
                                            ? `${(((meta.arrears_8_30_base || 0) / meta.portfolio_principal_base) * 100).toFixed(2)}%`
                                            : "0.00%"}
                                    </Text>
                                </View>
                            </View>

                            <View className="flex-row gap-3">
                                {/* PAR > 30 (Cartera en Riesgo > 30) */}
                                <View className="flex-1 bg-white p-4 rounded-lg border border-[#DFE1E6] shadow-sm">
                                    <Text className="text-[#5E6C84] text-[10px] font-bold uppercase tracking-wider mb-1" numberOfLines={1} adjustsFontSizeToFit>
                                        {t.dashboard.par_30}
                                    </Text>
                                    <Text
                                        className={`font-bold text-base ${(meta.par_30_base || 0) > 0 ? 'text-[#DE350B]' : 'text-[#091E42]'}`}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                    >
                                        {meta.base_currency_symbol} {(meta.par_30_base || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Text>
                                    <Text className={`text-sm font-bold mt-1 ${(meta.portfolio_principal_base > 0 && ((meta.par_30_base || 0) / meta.portfolio_principal_base) > 0) ? 'text-[#DE350B]' : 'text-[#5E6C84]'}`}>
                                        {meta.portfolio_principal_base > 0
                                            ? `${(((meta.par_30_base || 0) / meta.portfolio_principal_base) * 100).toFixed(2)}%`
                                            : "0.00%"}
                                    </Text>
                                </View>

                                {/* >90 Days */}
                                <View className="flex-1 bg-white p-4 rounded-lg border border-[#DFE1E6] shadow-sm">
                                    <Text className="text-[#5E6C84] text-[10px] font-bold uppercase tracking-wider mb-1" numberOfLines={1} adjustsFontSizeToFit>
                                        {t.dashboard.arrears_over_90}
                                    </Text>
                                    <Text
                                        className={`font-bold text-base ${(meta.arrears_over_90_base || 0) > 0 ? 'text-[#DE350B]' : 'text-[#091E42]'}`}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                    >
                                        {meta.base_currency_symbol} {(meta.arrears_over_90_base || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Text>
                                    <Text className={`text-sm font-bold mt-1 ${(meta.portfolio_principal_base > 0 && ((meta.arrears_over_90_base || 0) / meta.portfolio_principal_base) > 0) ? 'text-[#DE350B]' : 'text-[#5E6C84]'}`}>
                                        {meta.portfolio_principal_base > 0
                                            ? `${(((meta.arrears_over_90_base || 0) / meta.portfolio_principal_base) * 100).toFixed(2)}%`
                                            : "0.00%"}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
