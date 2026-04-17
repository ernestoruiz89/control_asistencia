import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import * as Location from "expo-location";
import {
    ActivityIndicator,
    Platform,
    Text,
    TouchableOpacity,
    View,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { getPaymentInitData, recordPayment, getActiveShift, openShift } from "../../../lib/api";
import { useTranslation } from "../../../lib/i18n";
import { fmtAmount } from "../../../lib/utils";
import dayjs from "dayjs";

export default function PaymentRecording() {
    const { loanId } = useLocalSearchParams();
    const router = useRouter();
    const { t } = useTranslation();
    const [amount, setAmount] = useState("0");
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [hasActiveShift, setHasActiveShift] = useState(false);
    const [isOpeningShift, setIsOpeningShift] = useState(false);

    const [customer, setCustomer] = useState<any>(null);

    const [systemDate, setSystemDate] = useState<string>("");
    const [currencies, setCurrencies] = useState<string[]>([]);
    const [selectedCurrency, setSelectedCurrency] = useState<string>("");
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

    const loadData = useCallback(async () => {
        if (!loanId) return;
        try {
            setPageLoading(true);
            const shiftRes = await getActiveShift();
            const hasShift = shiftRes.status === "success" && shiftRes.data !== null;
            setHasActiveShift(hasShift);

            if (hasShift) {
                const data = await getPaymentInitData(String(loanId));
                setCustomer(data.customer);
                setSystemDate(data.system_date);

                // Setup currencies
                const fetchedCurrencies = data.currencies || ["NIO", "USD"];
                setCurrencies(fetchedCurrencies);
                setExchangeRates(data.exchange_rates || {});

                if (!fetchedCurrencies.includes(data.customer.currency)) {
                    setSelectedCurrency(fetchedCurrencies[0]);
                } else {
                    setSelectedCurrency(data.customer.currency);
                }
            }
        } catch (error) {
            console.error("Failed to load payment init data:", error);
        } finally {
            setPageLoading(false);
            setIsOpeningShift(false);
        }
    }, [loanId]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    // Conversion calculation based on system date exchange rates
    const numAmount = parseFloat(amount) || 0;
    let convertedAmount = 0;
    if (customer && selectedCurrency !== customer.currency && numAmount > 0) {
        // Exchange rates mapped locally by loan vs payment currency
        const rateToApply = exchangeRates[selectedCurrency] || 1;
        convertedAmount = numAmount * rateToApply;
    }

    const handleKeyPress = (val: string) => {
        setAmount(prev => {
            // Initial state handling
            if (prev === "0" || prev === "0.00") {
                if (val === ".") return "0.";
                if (val === "0") return "0";
                return val;
            }

            // Decimal logic
            if (val === ".") {
                if (prev.includes(".")) return prev;
                return prev + ".";
            }

            // Limit decimals
            const parts = prev.split(".");
            if (parts.length === 2 && parts[1].length >= 2) return prev;

            // Character limit for safety/UI
            if (prev.replace(".", "").length >= 9) return prev;

            return prev + val;
        });
    };

    const handleBackspace = () => {
        setAmount(prev => {
            if (prev.length <= 1 || prev === "0.00") return "0";
            return prev.slice(0, -1);
        });
    };


    const getStatusStyles = (customer: any) => {
        if (!customer) return { bg: 'bg-[#EBECF0]', border: 'border-[#DFE1E6]', text: 'text-[#42526E]' };

        // 1. Red (Arrears)
        if (customer.arrears_amount > 0) {
            return { bg: 'bg-[#FFEBE6]', border: 'border-[#FFBDAD]', text: 'text-[#DE350B]' };
        }

        // 2. Orange (Due Today)
        if (customer.due_today_amount > 0) {
            return { bg: 'bg-[#FFF4E5]', border: 'border-[#FFE2BD]', text: 'text-[#B76E00]' };
        }

        // 3. Green (Future/Good Standing)
        const s = customer.status?.toUpperCase();
        if (['ACTIVE', 'ACTIVO', 'CURRENT'].includes(s)) {
            return { bg: 'bg-[#E3FCEF]', border: 'border-[#ABF5D1]', text: 'text-[#006644]' };
        }
        return { bg: 'bg-[#EBECF0]', border: 'border-[#DFE1E6]', text: 'text-[#42526E]' };
    };

    const handleOpenShift = async () => {
        try {
            setIsOpeningShift(true);
            const res = await openShift();
            if (res.status === "success") {
                loadData();
            } else {
                console.error("Open shift failed", res.message);
                setIsOpeningShift(false);
            }
        } catch (e) {
            console.error("Open shift error", e);
            setIsOpeningShift(false);
        }
    };

    const handleProcess = () => {
        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount <= 0) return;
        if (!customer) return;

        const message = `${t.payment.confirm_message.replace("{amount}", `${selectedCurrency} ${numAmount.toFixed(2)}`).replace("{customer}", `loan ${loanId}`)}`;

        if (Platform.OS === 'web') {
            if (window.confirm(message)) {
                submitPayment(numAmount);
            }
        } else {
            Alert.alert(
                t.payment.confirm_payment,
                message,
                [
                    { text: t.common.cancel, style: "cancel" },
                    { text: t.common.confirm, style: "default", onPress: () => submitPayment(numAmount) }
                ]
            );
        }
    };

    const submitPayment = async (numAmount: number) => {
        setLoading(true);
        try {
            // Get location
            let { status } = await Location.requestForegroundPermissionsAsync();
            let coords = null;
            if (status === 'granted') {
                try {
                    const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                    });
                    coords = location.coords;
                } catch (locErr) {
                    console.error("Error getting location:", locErr);
                }
            }

            const result = await recordPayment({
                loan_id: String(loanId),
                payment_amount: numAmount,
                payment_currency: selectedCurrency,
                exchange_rate: exchangeRates[selectedCurrency] || 1.0,
                latitude: coords?.latitude,
                longitude: coords?.longitude,
            });

            // Navigate to receipt with the payment name
            router.replace(`/(app)/receipt/${result.payment_name}`);
        } catch (error: any) {
            const errMsg = error?.message || t.payment.error_processing;
            if (Platform.OS === 'web') {
                window.alert(errMsg);
            } else {
                Alert.alert(t.payment.error_title, errMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    if (pageLoading) {
        return (
            <SafeAreaView className="flex-1 bg-[#F4F5F7] items-center justify-center">
                <ActivityIndicator size="large" color="#0052CC" />
                <Text className="mt-4 text-[#5E6C84] font-mono text-xs uppercase tracking-widest">
                    {t.payment.loading_settings}
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-[#F4F5F7]">
            <View className="flex-1 flex-col bg-[#F4F5F7]" style={Platform.OS === 'web' ? { maxWidth: 448, width: '100%', alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, elevation: 20 } : {}}>

                {/* Clean App Header */}
                <View className="bg-white pt-4 pb-6 px-6 border-b border-[#DFE1E6] flex-row items-center justify-between shadow-sm">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="w-10 h-10 items-center justify-center bg-[#F4F5F7] rounded border border-[#DFE1E6] mr-4 active:bg-[#DFE1E6]"
                        >
                            <MaterialIcons name="arrow-back" size={24} color="#091E42" />
                        </TouchableOpacity>
                        <View>
                            <Text className="text-[#091E42] font-bold text-lg uppercase tracking-wide">
                                {t.customer.record_payment || "Record Payment"}
                            </Text>
                            {systemDate ? (
                                <Text className="text-[#5E6C84] font-mono text-sm mt-1">
                                    {t.payment.system_date}: {dayjs(systemDate).format("MMM DD, YYYY")}
                                </Text>
                            ) : null}
                        </View>
                    </View>
                </View>

                {/* Main Content Area */}
                <View className="flex-1 justify-between">
                    {!hasActiveShift ? (
                        <View className="flex-1 items-center justify-center p-6">
                            <View className="bg-[#FFFAE6] max-w-[400px] w-full rounded-xl p-6 shadow-sm border border-[#FFE380]">
                                <View className="flex-row items-center mb-4">
                                    <MaterialIcons name="warning-amber" size={24} color="#FF8B00" />
                                    <Text className="text-[#FF8B00] font-bold text-base ml-2 uppercase">
                                        {t.ledger.no_active_shift}
                                    </Text>
                                </View>
                                <Text className="text-[#5E6C84] text-xs font-bold leading-5 mb-5">
                                    {t.ledger.open_shift_needed}
                                </Text>
                                <TouchableOpacity
                                    onPress={handleOpenShift}
                                    disabled={isOpeningShift}
                                    className="bg-[#0052CC] h-12 rounded-lg items-center justify-center flex-row shadow-sm active:bg-[#0747A6]"
                                >
                                    {isOpeningShift ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <MaterialIcons name="play-arrow" size={20} color="white" />
                                            <Text className="text-white font-bold uppercase tracking-widest text-xs ml-2">
                                                {t.ledger.open_shift}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <>
                            {/* Top Display */}
                            <View className="px-6 pt-6 pb-2">
                                <View
                                    className="bg-white rounded-lg border border-[#DFE1E6] p-5 shadow-sm"
                                    style={{ height: 195 }}
                                >
                                    <View className="flex-row justify-between items-start mb-4 border-b border-[#F4F5F7] pb-3">
                                        <View className="flex-col flex-1">
                                            <Text className="font-mono text-sm text-[#5E6C84] uppercase tracking-widest leading-none mb-1">
                                                {t.payment.loan_details}
                                            </Text>
                                            <Text className="font-bold text-sm text-[#091E42]" numberOfLines={1}>
                                                {customer.name}
                                            </Text>
                                        </View>
                                        <View className={`${getStatusStyles(customer).bg} px-3 py-1.5 rounded-lg border ${getStatusStyles(customer).border} ml-2 shrink-0`}>
                                            <Text className={`${getStatusStyles(customer).text} text-[13px] font-mono font-bold uppercase`}>
                                                #{customer.loan_id}
                                            </Text>
                                        </View>
                                    </View>

                                    <View className="flex-row justify-end items-baseline mb-2">
                                        <Text className="font-mono text-2xl font-bold text-[#5E6C84] mr-2">{selectedCurrency}</Text>
                                        <Text className="font-mono text-5xl font-bold text-[#091E42] tracking-tighter">
                                            {fmtAmount(parseFloat(amount) || 0)}
                                        </Text>
                                    </View>

                                    {/* Fixed footer area to prevent jump */}
                                    <View className="h-8 justify-center">
                                        {selectedCurrency !== customer.currency && convertedAmount > 0 ? (
                                            <View className="flex-row justify-between items-center border-t border-[#F4F5F7] pt-1">
                                                <View>
                                                    <Text className="font-mono text-sm text-[#5E6C84] uppercase">
                                                        {t.payment.rate}
                                                    </Text>
                                                    <Text className="font-mono text-sm font-bold text-[#091E42]">
                                                        {exchangeRates[selectedCurrency] || 1}
                                                    </Text>
                                                </View>
                                                <Text className="font-mono text-sm text-[#0052CC] font-bold uppercase tracking-wider">
                                                    ≈ {fmtAmount(convertedAmount)} {customer.currency}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                </View>

                                {/* Currency Selector */}
                                <View className="mt-2">
                                    <View className="flex-row items-center justify-between mb-2 px-1">
                                        <Text className="font-mono text-sm font-bold text-[#5E6C84] uppercase tracking-wider">
                                            {t.closure.currency}
                                        </Text>
                                    </View>
                                    <View className="flex-row p-1 bg-[#EBECF0] border border-[#DFE1E6] rounded-lg">
                                        {currencies.map(curr => {
                                            const isActive = selectedCurrency === curr;
                                            return (
                                                <TouchableOpacity
                                                    key={curr}
                                                    onPress={() => setSelectedCurrency(curr)}
                                                    className={`flex-1 py-2.5 items-center justify-center rounded-md ${isActive ? 'bg-white shadow-sm' : ''}`}
                                                >
                                                    <Text className={`font-mono text-sm font-bold uppercase tracking-wider ${isActive ? 'text-[#0052CC]' : 'text-[#5E6C84]'}`}>
                                                        {curr}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            </View>

                            {/* Keypad */}
                            <View className="px-6 py-2 pb-8 bg-[#F4F5F7] justify-between flex-1">
                                {[
                                    ['1', '2', '3'],
                                    ['4', '5', '6'],
                                    ['7', '8', '9'],
                                    ['.', '0', 'backspace']
                                ].map((row, i) => (
                                    <View key={i} className="flex-row justify-between mb-1.5 flex-1 min-h-[44px]">
                                        {row.map(btn => {
                                            if (btn === 'backspace') {
                                                return (
                                                    <TouchableOpacity
                                                        key={btn}
                                                        onPress={handleBackspace}
                                                        className="w-[31%] h-full bg-[#FFEBE6] border border-[#FFBDAD] rounded-xl items-center justify-center active:bg-[#FFD2CC]"
                                                    >
                                                        <MaterialIcons name="backspace" size={24} color="#DE350B" />
                                                    </TouchableOpacity>
                                                )
                                            }
                                            return (
                                                <TouchableOpacity
                                                    key={btn}
                                                    onPress={() => handleKeyPress(btn)}
                                                    className="w-[31%] h-full bg-white rounded-xl items-center justify-center border border-[#DFE1E6] active:bg-[#F4F5F7] shadow-sm"
                                                >
                                                    <Text className="font-mono text-2xl font-bold text-[#091E42]">{btn}</Text>
                                                </TouchableOpacity>
                                            )
                                        })}
                                    </View>
                                ))}
                            </View>

                            {/* Clean Footer Actions (Matching CustomerDetails) */}
                            <View className="p-6 bg-white/95 border-t border-[#DFE1E6] shadow-lg flex-row gap-3">
                                <TouchableOpacity
                                    onPress={() => router.back()}
                                    className="w-14 items-center justify-center bg-[#F4F5F7] rounded border border-[#DFE1E6] active:bg-[#E1E4E8]"
                                >
                                    <MaterialIcons name="close" size={24} color="#5E6C84" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleProcess}
                                    disabled={loading || amount === "0.00"}
                                    className={`flex-1 h-14 rounded-lg flex-row items-center justify-center shadow-md ${loading || amount === "0.00" ? 'bg-[#DFE1E6]' : 'bg-[#5305c7] active:translate-y-px'}`}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <MaterialIcons name="payments" size={24} color={loading || amount === "0.00" ? "#A5ADBA" : "white"} />
                                            <Text className={`${loading || amount === "0.00" ? 'text-[#A5ADBA]' : 'text-white'} font-bold uppercase text-sm tracking-widest ml-3`}>
                                                {t.common.confirm}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </>
                    )}

                </View>
            </View>
        </SafeAreaView >
    );
}
