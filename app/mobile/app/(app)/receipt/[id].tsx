import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "../../../lib/AuthContext";
import { useTranslation } from "../../../lib/i18n";
import { getReceiptData } from "../../../lib/api";
import { formatDate } from "../../../lib/utils";

export default function ReceiptPreview() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { t } = useTranslation();
    const { dateFormat, setDateFormat } = useAuth();
    const insets = useSafeAreaInsets();
    const [pulse, setPulse] = useState(true);
    const [loading, setLoading] = useState(true);
    const [receipt, setReceipt] = useState<any>(null);

    useEffect(() => {
        const interval = setInterval(() => setPulse(p => !p), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        (async () => {
            if (!id) return;
            try {
                setLoading(true);
                const data = await getReceiptData(String(id));
                if (data.date_format && data.date_format !== dateFormat) {
                    setDateFormat(data.date_format);
                }
                setReceipt(data);
            } catch (error) {
                console.error("Failed to load receipt:", error);
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    // Inject print-only CSS on web
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const style = document.createElement('style');
        style.id = 'receipt-print-css';
        style.textContent = `
            @media print {
                body * { visibility: hidden !important; }
                #receipt-paper, #receipt-paper * { visibility: visible !important; }
                #receipt-paper {
                    position: absolute !important;
                    left: 0; top: 0;
                    width: 100% !important;
                    padding: 20px !important;
                    box-shadow: none !important;
                }
            }
        `;
        document.head.appendChild(style);
        return () => { style.remove(); };
    }, []);

    function formatCurrency(amount: number, symbol?: string) {
        return `${symbol || "$"} ${amount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }

    const ZigZag = () => (
        <View className="absolute -bottom-[10px] left-0 right-0 h-[10px] overflow-hidden">
            <Svg height="10" width="100%" viewBox="0 0 100 10" preserveAspectRatio="none">
                <Path
                    d="M0 0 L5 10 L10 0 L15 10 L20 0 L25 10 L30 0 L35 10 L40 0 L45 10 L50 0 L55 10 L60 0 L65 10 L70 0 L75 10 L80 0 L85 10 L90 0 L95 10 L100 0 V10 H0 Z"
                    fill="white"
                />
            </Svg>
        </View>
    );

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace("/(app)/(drawer)");
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-[#F4F5F7] items-center justify-center">
                <ActivityIndicator size="large" color="#5305c7" />
                <Text className="mt-4 text-[#5E6C84] font-mono text-xs uppercase tracking-widest">
                    {t.receipt.loading}
                </Text>
            </SafeAreaView>
        );
    }

    if (!receipt) {
        return (
            <SafeAreaView className="flex-1 bg-[#F4F5F7] items-center justify-center">
                <Text className="text-[#5E6C84]">{t.receipt.not_found}</Text>
                <TouchableOpacity onPress={handleBack} className="mt-4 px-4 py-2 bg-[#5305c7] rounded">
                    <Text className="text-white font-bold">{t.receipt.go_back}</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const sym = receipt.currency_symbol || "$";

    return (
        <SafeAreaView className="flex-1 bg-[#F4F5F7]">
            {/* Header */}
            <View nativeID="receipt-header" className="bg-white pt-4 pb-4 px-6 border-b border-[#DFE1E6] flex-row items-center justify-between shadow-sm z-10">
                <TouchableOpacity
                    onPress={handleBack}
                    className="w-10 h-10 items-center justify-center bg-[#F4F5F7] rounded border border-[#DFE1E6] active:bg-[#DFE1E6]"
                >
                    <MaterialIcons name="arrow-back" size={24} color="#091E42" />
                </TouchableOpacity>
                <Text className="text-[#091E42] font-bold text-sm uppercase tracking-widest">
                    {t.receipt.title}
                </Text>
                <View className="w-10" />
            </View>



            <ScrollView
                className="flex-1 px-8"
                contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}
                showsVerticalScrollIndicator={false}
            >
                {/* Thermal Receipt Paper */}
                <View nativeID="receipt-paper" className="bg-white p-6 pb-12 mb-8 shadow-lg relative">
                    {/* Header */}
                    <View className="items-center">
                        <Text className="font-bold uppercase tracking-[0.1em] text-black text-base text-lg text-center mb-1">
                            {receipt.company || ""}
                        </Text>
                        <Text className="font-bold uppercase tracking-[0.1em] text-black text-sm text-center">
                            {receipt.office || "Loan Manager"}
                        </Text>
                        <Text className="text-sm font-mono text-black">
                            {t.receipt.date}: {formatDate(receipt.posting_date, dateFormat)}
                        </Text>
                    </View>

                    {/* Separator */}
                    <View className="border-b border-dashed border-black/30 my-4" />

                    {/* Customer Info */}
                    <View className="gap-1">
                        <View className="flex-row justify-between">
                            <Text className="text-sm font-mono text-black uppercase">{t.receipt.client}:</Text>
                            <Text className="text-sm font-mono text-black uppercase">{receipt.customer_name}</Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-sm font-mono text-black uppercase">{t.receipt.loan_id}:</Text>
                            <Text className="text-sm font-mono text-black">{receipt.loan_id}</Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-sm font-mono text-black ">{t.receipt.payment}:</Text>
                            <Text className="text-sm font-mono text-black">{receipt.payment_name}</Text>
                        </View>
                    </View>

                    {/* Separator */}
                    <View className="border-b border-dashed border-black/30 my-4" />

                    {/* Payment Details */}
                    <View className="gap-1">
                        <View className="flex-row justify-between">
                            <Text className="text-md font-mono text-black font-bold uppercase">{t.receipt.amount_received} ({receipt.payment_currency}):</Text>
                            <Text className="text-md font-mono font-bold text-black">
                                {formatCurrency(receipt.payment_amount || 0, receipt.payment_currency_symbol)}
                            </Text>
                        </View>
                        {receipt.payment_currency !== receipt.loan_currency && receipt.exchange_rate > 0 && (
                            <View className="flex-row justify-between">
                                <Text className="text-sm font-mono text-black italic">{t.receipt.exchange_rate}:</Text>
                                {receipt.exchange_rate >= 1 ? (
                                    <Text className="text-sm font-mono text-black italic">1 {receipt.payment_currency} = {receipt.exchange_rate} {receipt.loan_currency}</Text>
                                ) : (
                                    <Text className="text-sm font-mono text-black italic">1 {receipt.loan_currency} = {parseFloat((1 / receipt.exchange_rate).toFixed(4))} {receipt.payment_currency}</Text>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Separator */}
                    <View className="border-b border-dashed border-black/30 my-4" />

                    {/* Allocation Breakdown */}
                    <View className="gap-2">
                        <Text className="text-sm font-mono font-bold text-black uppercase mb-1">
                            {t.receipt.settlement_breakdown} ({receipt.loan_currency}):
                        </Text>
                        <View className="flex-row justify-between">
                            <Text className="text-sm font-mono text-black uppercase">{t.receipt.principal}</Text>
                            <Text className="text-sm font-mono text-black">{formatCurrency(receipt.total_principal_paid || 0, sym)}</Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-sm font-mono text-black uppercase">{t.receipt.interest}</Text>
                            <Text className="text-sm font-mono text-black">{formatCurrency(receipt.total_interest_paid || 0, sym)}</Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-sm font-mono text-black uppercase">{t.receipt.penalty}</Text>
                            <Text className="text-sm font-mono text-black">{formatCurrency(receipt.total_penalty_paid || 0, sym)}</Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-sm font-mono text-black uppercase">{t.receipt.fees}</Text>
                            <Text className="text-sm font-mono text-black">{formatCurrency(receipt.total_fee_paid || 0, sym)}</Text>
                        </View>
                    </View>

                    {/* Total Section */}
                    <View className="border-t-4 border-black mt-4 pt-2">
                        <View className="flex-row justify-between items-end">
                            <Text className="text-lg font-bold font-mono text-black uppercase">{t.receipt.total}</Text>
                            <Text className="text-lg font-bold font-mono text-black">{formatCurrency(receipt.total_amount_paid || 0, sym)}</Text>
                        </View>
                        <View className="border-t border-black mt-1" />
                        <View className="border-t-2 border-black mt-0.5" />
                    </View>

                    {/* Footer */}
                    <View className="mt-8 items-center text-center">
                        <Text className="text-xs font-mono text-black text-center">{t.receipt.footer_thx}</Text>
                        <Text className="text-xs font-mono text-black text-center mt-1">{t.receipt.footer_records}</Text>
                    </View>

                    <ZigZag />
                </View>
            </ScrollView>

            {/* Sticky Actions */}
            <View
                nativeID="receipt-actions"
                className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#DFE1E6] px-4 pt-4 flex-row gap-3 shadow-2xl"
                style={{ paddingBottom: Math.max(insets.bottom, 12) }}
            >
                <TouchableOpacity
                    onPress={handleBack}
                    className="flex-1 h-14 bg-white border border-[#DFE1E6] rounded items-center justify-center active:bg-[#F4F5F7]"
                >
                    <Text className="text-[#091E42] font-bold uppercase text-xs tracking-widest">{t.receipt.done}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => {
                        if (Platform.OS === 'web') {
                            window.print();
                        } else {
                            Alert.alert(t.receipt.print_error_title, t.receipt.print_error_msg);
                        }
                    }}
                    className="flex-[2] h-14 bg-[#5305c7] rounded items-center justify-center shadow-lg active:scale-95 transition-transform"
                    style={{ elevation: 5 }}
                >
                    <View className="flex-row items-center gap-2">
                        <MaterialIcons name="print" size={20} color="white" />
                        <Text className="text-white font-bold uppercase text-xs tracking-widest">{t.receipt.print}</Text>
                    </View>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
