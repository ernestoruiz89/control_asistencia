import React from "react";
import { Text, View } from "react-native";
import { useTranslation } from "../../lib/i18n";

interface CollectionProgressProps {
    target: number;
    actual: number;
    symbol?: string;
}

export default function CollectionProgress({ target, actual, symbol }: CollectionProgressProps) {
    const { t } = useTranslation();

    const percentage =
        target > 0
            ? Math.min(100, Math.round((actual / target) * 100))
            : 0;

    function formatCurrency(amount: number) {
        return `${symbol || "$"}${amount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }

    return (
        <View className="bg-white p-6 rounded-lg border border-[#DFE1E6] shadow-sm">
            {/* Top row: Target vs Actual */}
            <View className="flex-row justify-between items-end border-b border-[#F4F5F7] pb-4 mb-5">
                <View>
                    <Text className="text-[#5E6C84] text-xs font-bold tracking-[0.2em] uppercase mb-1">
                        {t.dashboard.target}
                    </Text>
                    <Text className="text-[#091E42] text-xl font-bold tracking-tight">
                        {formatCurrency(target)}
                    </Text>
                </View>
                <View className="items-end">
                    <Text className="text-[#006644] text-xs font-bold tracking-[0.2em] uppercase mb-1">
                        {t.dashboard.actual}
                    </Text>
                    <Text className="text-[#006644] text-lg font-bold">
                        {formatCurrency(actual)}
                    </Text>
                </View>
            </View>

            {/* Progress Bar */}
            <View>
                <View className="flex-row justify-between mb-3">
                    <Text className="text-[#5E6C84] text-xs font-bold uppercase tracking-[0.1em]">
                        {t.dashboard.collection_progress}
                    </Text>
                    <Text className="text-[#091E42] text-xs font-bold">
                        {percentage}%
                    </Text>
                </View>
                <View className="w-full h-3 bg-[#F4F5F7] rounded-full overflow-hidden border border-[#DFE1E6]">
                    <View
                        className="h-full bg-[#5305c7]"
                        style={{ width: `${percentage}%` }}
                    />
                </View>
            </View>
        </View>
    );
}
