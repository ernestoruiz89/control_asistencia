import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "../../lib/i18n";
import { getMobileSettings, getActiveShift, closeShift } from "../../lib/api";

type Denomination = {
    label: string;
    value: number;
    type: "bill" | "coin";
};

type CurrencyConfig = {
    currency: string;
    symbol?: string;
    denominations: Denomination[];
    maxVariance: number;
};

export default function CloseShift() {
    const router = useRouter();
    const { t } = useTranslation();
    const [isClosing, setIsClosing] = useState(false);

    const [isLoading, setIsLoading] = useState(true);

    const [activeShift, setActiveShift] = useState<any>(null);
    const [currencies, setCurrencies] = useState<CurrencyConfig[]>([]);
    const [allowClosureWithVariance, setAllowClosureWithVariance] = useState(false);

    // State for denomination counts, mapped as currency -> { ["type_value"]: count }
    const [counts, setCounts] = useState<Record<string, Record<string, number>>>({});
    // State for misc coins inputs, mapped as currency -> string
    const [miscCoins, setMiscCoins] = useState<Record<string, string>>({});

    // Observation field
    const [observation, setObservation] = useState("");

    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);
            const [settingsRes, shiftRes] = await Promise.all([
                getMobileSettings(),
                getActiveShift()
            ]);

            if (shiftRes.status === "success" && shiftRes.data) {
                setActiveShift(shiftRes.data);
            } else {
                if (Platform.OS === 'web') {
                    window.alert(t.closure.error_no_active_shift);
                } else {
                    Alert.alert(t.common.error, t.closure.error_no_active_shift);
                }
                router.back();
                return;
            }

            if (settingsRes.status === "success" && settingsRes.data) {
                const config = settingsRes.data;
                setAllowClosureWithVariance(config.allow_closure_with_variance === 1);

                const curMap: Record<string, CurrencyConfig> = {};

                const currencySymbols: Record<string, string> = {};
                if (config.currencies) {
                    config.currencies.forEach((c: any) => {
                        currencySymbols[c.currency] = c.symbol;
                    });
                }

                if (config.variance_tolerances) {
                    config.variance_tolerances.forEach((tol: any) => {
                        curMap[tol.currency] = {
                            currency: tol.currency,
                            symbol: currencySymbols[tol.currency] || tol.currency,
                            maxVariance: tol.max_variance ?? Infinity,
                            denominations: []
                        };
                    });
                }

                if (config.denominations) {
                    config.denominations.forEach((den: any) => {
                        if (!curMap[den.currency]) {
                            curMap[den.currency] = {
                                currency: den.currency,
                                symbol: currencySymbols[den.currency] || den.currency,
                                maxVariance: Infinity,
                                denominations: []
                            };
                        }

                        const sym = curMap[den.currency].symbol;
                        const label = sym === den.currency ? `${sym} ${den.denomination}` : `${sym}${den.denomination}`;

                        curMap[den.currency].denominations.push({
                            label,
                            value: den.denomination,
                            type: den.type === "Bill" ? "bill" : "coin"
                        });
                    });
                }

                const currenciesList = Object.values(curMap);
                currenciesList.forEach(c => c.denominations.sort((a, b) => b.value - a.value));
                setCurrencies(currenciesList);

                const initialCounts: Record<string, Record<string, number>> = {};
                const initialMisc: Record<string, string> = {};
                currenciesList.forEach(c => {
                    initialCounts[c.currency] = {};
                    c.denominations.forEach(d => {
                        const key = `${d.type}_${d.value}`;
                        initialCounts[c.currency][key] = 0;
                    });
                    initialMisc[c.currency] = "0.00";
                });
                setCounts(initialCounts);
                setMiscCoins(initialMisc);

            }
        } catch (e) {
            console.error("Failed to load closing data", e);
            Alert.alert("Error", "Could not load shift settings.");
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    useEffect(() => {
        loadData();
    }, [loadData]);


    const updateCount = (currency: string, type: string, value: number, delta: number) => {
        const key = `${type}_${value}`;
        setCounts(prev => ({
            ...prev,
            [currency]: {
                ...prev[currency],
                [key]: Math.max(0, (prev[currency][key] || 0) + delta)
            }
        }));
    };

    const updateMiscCoins = (currency: string, val: string) => {
        setMiscCoins(prev => ({
            ...prev,
            [currency]: val
        }));
    };

    if (isLoading || !activeShift) {
        return (
            <SafeAreaView className="flex-1 bg-[#F4F5F7] items-center justify-center">
                <ActivityIndicator size="large" color="#5305c7" />
            </SafeAreaView>
        );
    }

    // Calculations
    let totalVariances: Record<string, number> = {};
    let totals: Record<string, number> = {};
    let isCompletelyBalanced = true;
    let hasAnyDiscrepancy = false;
    let blocksClosure = false;

    const expectations: Record<string, number> = {};
    if (activeShift.currency_totals) {
        activeShift.currency_totals.forEach((ct: any) => {
            expectations[ct.currency] = ct.expected_amount || 0;
        });
    }

    currencies.forEach(cur => {
        const curCount = counts[cur.currency] || {};
        let sum = 0;
        cur.denominations.forEach(d => {
            const key = `${d.type}_${d.value}`;
            sum += d.value * (curCount[key] || 0);
        });
        const coinsVal = parseFloat(miscCoins[cur.currency] || "0");
        sum += isNaN(coinsVal) ? 0 : coinsVal;
        totals[cur.currency] = sum;

        const expected = expectations[cur.currency] || 0;
        const variance = parseFloat((sum - expected).toFixed(2));
        totalVariances[cur.currency] = variance;

        if (variance !== 0) {
            hasAnyDiscrepancy = true;
            isCompletelyBalanced = false;

            const limit = cur.maxVariance;
            const isExceeded = limit !== undefined && limit !== null && Math.abs(variance) > limit;

            if (!allowClosureWithVariance || isExceeded) {
                blocksClosure = true;
            }
        }
    });

    const isMissingObservation = hasAnyDiscrepancy && allowClosureWithVariance && !blocksClosure && !observation.trim();
    const canSubmit = !isClosing && !blocksClosure && !isMissingObservation && !!activeShift;


    const handleConfirmClosure = () => {
        console.log("handleConfirmClosure clicked", { isClosing, blocksClosure, isMissingObservation, activeShift: !!activeShift });
        if (isClosing) return;

        let errorMsg = "";
        if (blocksClosure) errorMsg = t.closure.error_discrepancy_tolerance;
        else if (isMissingObservation) errorMsg = t.closure.error_observation_required;
        else if (!activeShift) errorMsg = "No active shift data.";

        if (errorMsg) {
            if (Platform.OS === 'web') {
                window.alert(`${t.closure.cannot_close}: ${errorMsg}`);
            } else {
                Alert.alert(t.closure.cannot_close, errorMsg);
            }
            return;
        }

        const runClosure = async () => {
            setIsClosing(true);
            try {
                const cash_count: any[] = [];
                currencies.forEach(cur => {
                    cur.denominations.forEach(d => {
                        const key = `${d.type}_${d.value}`;
                        const count = counts[cur.currency]?.[key] || 0;
                        if (count > 0) {
                            cash_count.push({
                                currency: cur.currency,
                                denomination: d.value,
                                type: d.type === "bill" ? "Bill" : "Coin",
                                count: count
                            });
                        }
                    });
                    const coinsVal = parseFloat(miscCoins[cur.currency] || "0");
                    const miscAmt = isNaN(coinsVal) ? 0 : coinsVal;

                    if (miscAmt > 0) {
                        cash_count.push({
                            currency: cur.currency,
                            denomination: miscAmt,
                            type: "Coin",
                            count: 1
                        });
                    }
                });

                console.log("Closing shift with data:", { shift_id: activeShift.id || activeShift.name, observation, cash_count });

                const res = await closeShift({
                    shift_id: activeShift.id || activeShift.name,
                    observation,
                    cash_count
                });

                if (res.status === "success") {
                    if (Platform.OS === 'web') {
                        window.alert(t.closure.success_msg);
                    } else {
                        Alert.alert(t.common.success, t.closure.success_msg);
                    }
                    router.replace("/(app)/(drawer)/ledger");
                } else {
                    if (Platform.OS === 'web') {
                        window.alert(`${t.closure.error_closing}: ${res.message || t.closure.unknown_error}`);
                    } else {
                        Alert.alert(t.closure.error_closing, res.message || t.closure.unknown_error);
                    }
                    setIsClosing(false);
                }
            } catch (err: any) {
                console.error("Shift closure error", err);
                if (Platform.OS === 'web') {
                    window.alert(`${t.closure.error_closing}: ${err.message || t.closure.network_error}`);
                } else {
                    Alert.alert(t.closure.error_closing, err.message || t.closure.network_error);
                }
                setIsClosing(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`${t.closure.confirm_title}\n\n${t.closure.confirm_desc}`)) {
                runClosure();
            }
        } else {
            Alert.alert(t.closure.confirm_title, t.closure.confirm_desc, [
                { text: t.common.cancel, style: "cancel" },
                {
                    text: t.closure.close_button,
                    style: "destructive",
                    onPress: runClosure
                }
            ]);
        }
    };

    function fmtAmt(amount: number, cur: string) {
        const symbol = currencies.find(c => c.currency === cur)?.symbol || cur;
        const pfix = symbol === cur ? `${cur} ` : symbol;
        return `${pfix}${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Reusable denomination row
    const DenomRow = ({
        denom,
        count,
        onDecrement,
        onIncrement,
    }: {
        denom: Denomination;
        count: number;
        onDecrement: () => void;
        onIncrement: () => void;
    }) => (
        <View className="bg-white p-4 rounded-lg border-2 border-[#DFE1E6] flex-row items-center justify-between mb-3">
            <View className="min-w-[80px]">
                <Text className="text-xl font-bold font-mono text-[#091E42]">{denom.label}</Text>
                <Text className="text-[10px] uppercase text-[#5E6C84] font-bold tracking-wider">
                    {denom.type === "bill" ? t.closure.bills : t.closure.coins}
                </Text>
            </View>
            <View className="flex-row items-center gap-3">
                <TouchableOpacity
                    onPress={onDecrement}
                    className="w-11 h-11 items-center justify-center rounded border-2 border-[#DFE1E6] bg-white active:bg-[#F4F5F7]"
                >
                    <MaterialIcons name="remove" size={22} color="#091E42" />
                </TouchableOpacity>
                <View className="w-16 items-center">
                    <Text className={`text-2xl font-mono font-bold ${count > 0 ? "text-[#5305c7]" : "text-[#5E6C84]"}`}>
                        {count}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={onIncrement}
                    className="w-11 h-11 items-center justify-center rounded border-2 border-[#5305c7]/30 bg-white active:bg-[#F4F5F7]"
                >
                    <MaterialIcons name="add" size={22} color="#5305c7" />
                </TouchableOpacity>
            </View>
        </View>
    );

    // Reusable coins input row
    const CoinsRow = ({
        label,
        value,
        onChangeText,
    }: {
        label: string;
        value: string;
        onChangeText: (v: string) => void;
    }) => (
        <View className="bg-white p-4 rounded-lg border-2 border-[#DFE1E6] flex-row items-center justify-between mb-3">
            <View className="min-w-[80px]">
                <Text className="text-lg font-bold font-mono text-[#091E42]">{label}</Text>
                <Text className="text-[10px] uppercase text-[#5E6C84] font-bold tracking-wider">{t.closure.misc}</Text>
            </View>
            <View className="w-24">
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    keyboardType="numeric"
                    className="text-center text-2xl font-mono font-bold text-[#5305c7] border-b-2 border-[#5305c7]/20 py-1"
                    selectTextOnFocus
                />
            </View>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-[#F4F5F7]">
            <View className="bg-white border-b-2 border-[#DFE1E6]">
                <View className="pt-4 pb-2 px-6 flex-row items-center">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center bg-[#F4F5F7] rounded border border-[#DFE1E6] mr-4 active:bg-[#DFE1E6]"
                    >
                        <MaterialIcons name="arrow-back" size={24} color="#091E42" />
                    </TouchableOpacity>
                    <Text className="text-[#091E42] font-bold text-lg uppercase tracking-wide flex-1">
                        {t.closure.title}
                    </Text>
                </View>

                <View className="px-6 pb-4">
                    <View className="bg-[#091E42] rounded-lg p-5 border-2 border-[#091E42]">
                        <View className="flex-row justify-between items-center mb-3 border-b border-white/10 pb-3">
                            <Text className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                                {t.closure.shift_overview}
                            </Text>
                            <Text className="text-white/40 text-[10px] uppercase font-bold tracking-widest">
                                {activeShift.id || activeShift.name}
                            </Text>
                        </View>

                        {currencies.map(cur => (
                            <View key={cur.currency} className="flex-row items-baseline justify-between mb-2">
                                <View className="flex-row items-baseline">
                                    <Text className="text-white/40 text-lg mr-1 font-mono">{cur.symbol || cur.currency}</Text>
                                    <Text className="text-white text-xl font-bold font-mono tracking-tight">
                                        {(expectations[cur.currency] || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                    </Text>
                                </View>
                                <Text className="text-white/30 text-[10px] font-bold uppercase">{t.closure.expected} {cur.currency}</Text>
                            </View>
                        ))}

                        <View className="flex-row items-center mt-2 gap-4 border-t border-white/10 pt-3">
                            <View className="flex-row items-center">
                                <MaterialIcons name="receipt-long" size={12} color="rgba(255,255,255,0.4)" />
                                <Text className="text-white/40 text-[10px] font-bold uppercase ml-1">
                                    {activeShift.total_payments} {t.closure.payments}
                                </Text>
                            </View>
                            <View className="flex-row items-center">
                                <MaterialIcons name="people" size={12} color="rgba(255,255,255,0.4)" />
                                <Text className="text-white/40 text-[10px] font-bold uppercase ml-1">
                                    {activeShift.total_visits} {t.closure.visits}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </View>

            <ScrollView
                className="flex-1 px-6 pt-6"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 320 }}
            >
                {currencies.map((cur, idx) => (
                    <View key={cur.currency}>
                        {idx > 0 && <View className="border-b-2 border-dashed border-[#DFE1E6] my-6" />}
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-row items-center gap-2">
                                <View className={`w-6 h-6 rounded bg-[#091E42]/10 items-center justify-center`}>
                                    <Text className={`text-[#091E42] text-[10px] font-bold`}>
                                        {cur.symbol || cur.currency}
                                    </Text>
                                </View>
                                <Text className="text-[#5E6C84] text-[10px] font-bold tracking-[0.2em] uppercase">
                                    {t.closure.currency} {cur.currency}
                                </Text>
                            </View>
                            <Text className={`text-[#091E42] text-sm font-mono font-bold`}>
                                {fmtAmt(totals[cur.currency], cur.currency)}
                            </Text>
                        </View>

                        {cur.denominations.map((denom) => (
                            <DenomRow
                                key={`${cur.currency}-${denom.type}-${denom.value}`}
                                denom={denom}
                                count={counts[cur.currency]?.[`${denom.type}_${denom.value}`] || 0}
                                onDecrement={() => updateCount(cur.currency, denom.type, denom.value, -1)}
                                onIncrement={() => updateCount(cur.currency, denom.type, denom.value, 1)}
                            />
                        ))}
                        <CoinsRow
                            label={t.closure.coins}
                            value={miscCoins[cur.currency] || ""}
                            onChangeText={(val) => updateMiscCoins(cur.currency, val)}
                        />
                    </View>
                ))}

                {/* Observation Box if there is discrepancy and allowed */}
                {hasAnyDiscrepancy && allowClosureWithVariance && !blocksClosure && (
                    <View className="mt-6 mb-4">
                        <Text className="text-[#DE350B] text-[10px] font-bold tracking-[0.2em] uppercase mb-2">
                            {t.closure.observation_required}
                        </Text>
                        <TextInput
                            value={observation}
                            onChangeText={setObservation}
                            placeholder={t.closure.observation_placeholder}
                            multiline
                            numberOfLines={4}
                            className={`bg-white p-4 rounded-lg border-2 ${!observation.trim() ? "border-[#FFBDAD]" : "border-[#DFE1E6]"} text-[#091E42] shadow-sm text-sm`}
                            textAlignVertical="top"
                        />
                    </View>
                )}
            </ScrollView>

            <View className="absolute bottom-0 left-0 right-0 bg-white border-t-2 border-[#DFE1E6] z-20">
                {hasAnyDiscrepancy && (
                    <View className="border-b-2 border-[#DFE1E6]">
                        {currencies.map(cur => {
                            const variance = totalVariances[cur.currency];
                            if (variance === 0) return null;
                            const limit = cur.maxVariance;
                            const isExc = !allowClosureWithVariance || (limit !== undefined && limit !== null && Math.abs(variance) > limit);
                            const isNeg = variance < 0;

                            return (
                                <View key={cur.currency} className={`p-3 px-6 flex-row justify-between items-center ${isExc ? "bg-[#FFEBE6]" : (isNeg ? "bg-[#FFEFEA]" : "bg-[#FFF0B3]")} border-b border-white/50`}>
                                    <View className="flex-row items-center gap-2">
                                        <MaterialIcons name={isExc ? "cancel" : "warning"} size={16} color={isExc ? "#BF2600" : (isNeg ? "#DE350B" : "#FF8B00")} />
                                        <Text className={`text-[11px] font-bold uppercase tracking-wider ${isExc ? "text-[#BF2600]" : (isNeg ? "text-[#DE350B]" : "text-[#FF8B00]")}`}>
                                            {cur.currency} {t.closure.variance} {isExc ? `(${t.closure.exceeded})` : ""}
                                        </Text>
                                    </View>
                                    <Text className={`font-mono font-bold text-sm ${isExc ? "text-[#BF2600]" : (isNeg ? "text-[#DE350B]" : "text-[#FF8B00]")}`}>
                                        {variance > 0 ? "+" : "-"}{fmtAmt(Math.abs(variance), cur.currency)}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {isCompletelyBalanced && (
                    <View className="bg-[#E3FCEF] border-b-2 border-[#ABF5D1] p-3 px-6 flex-row justify-between items-center">
                        <View className="flex-row items-center gap-2">
                            <MaterialIcons name="check-circle" size={18} color="#006644" />
                            <Text className="text-[#006644] text-xs font-bold uppercase tracking-wider">
                                {t.closure.balanced}
                            </Text>
                        </View>
                        <Text className="font-mono font-bold text-[#006644] text-sm">{t.closure.perfect}</Text>
                    </View>
                )}

                <View className="p-5 pt-3 gap-2">
                    <TouchableOpacity
                        onPress={handleConfirmClosure}
                        activeOpacity={0.7}
                        className={`h-14 mt-2 rounded-lg items-center justify-center ${!canSubmit ? "bg-[#DFE1E6]" : "bg-[#5305c7]"}`}
                        style={canSubmit ? { elevation: 4 } : {}}
                    >
                        {isClosing ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <View className="flex-row items-center gap-2">
                                <MaterialIcons name="lock" size={18} color={!canSubmit ? "#A5ADBA" : "white"} />
                                <Text className={`${!canSubmit ? "text-[#A5ADBA]" : "text-white"} font-bold uppercase text-sm tracking-widest`}>
                                    {blocksClosure ? t.closure.blocked_by_variance : (isMissingObservation ? t.closure.observation_req : t.closure.close_button)}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}
