import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "../../lib/i18n";

interface CustomerLoan {
    loan_id: string;
    amount_due: number;
    collection_target: number;
    days_due: number;
    status: "overdue" | "due_today" | "upcoming" | "paid";
    currency_symbol?: string;
}

interface CustomerCardProps {
    customer: {
        id: string;
        name: string;
        loans: CustomerLoan[];
        address: string;
    };
}

export default function CustomerCard({ customer }: CustomerCardProps) {
    const { t } = useTranslation();
    const router = useRouter();

    // Determine the worst status among all loans
    const getWorstStatus = () => {
        const statuses = customer.loans.map(l => l.status);
        if (statuses.includes("overdue")) return "overdue";
        if (statuses.includes("due_today")) return "due_today";
        if (statuses.includes("upcoming")) return "upcoming";
        if (statuses.includes("paid")) return "paid";
        return "upcoming"; // Default safe fallback
    };

    const primaryStatus = getWorstStatus();

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "overdue":
                return {
                    bg: "bg-[#FFEBE6]",
                    text: "text-[#DE350B]",
                    label: t.status.overdue,
                    border: "border-[#FFBDAD]"
                };
            case "due_today":
                return {
                    bg: "bg-[#FFF0B3]",
                    text: "text-[#BF2600]",
                    label: t.status.due_today,
                    border: "border-[#FFE380]"
                };
            case "upcoming":
                return {
                    bg: "bg-[#E3FCEF]",
                    text: "text-[#006644]",
                    label: t.status.upcoming,
                    border: "border-[#ABF5D1]"
                };
            case "paid":
                return {
                    bg: "bg-[#E3FCEF]",
                    text: "text-[#006644]",
                    label: t.status.paid,
                    border: "border-[#ABF5D1]"
                };
            default:
                return {
                    bg: "bg-[#F4F5F7]",
                    text: "text-[#5E6C84]",
                    label: status,
                    border: "border-[#DFE1E6]"
                };
        }
    };

    const overallStyle = getStatusStyle(primaryStatus);
    const totalAmountDue = customer.loans.reduce((sum, loan) => sum + loan.amount_due, 0);
    const totalArrears = customer.loans.reduce((sum, loan) => sum + (loan.collection_target || 0), 0);
    const maxDaysDue = Math.max(...customer.loans.map(loan => loan.days_due || 0));

    return (
        <TouchableOpacity
            onPress={() => router.push(`/(app)/customer/${customer.id}`)}
            className="bg-white border border-[#DFE1E6] rounded-lg p-5 mb-4 shadow-sm active:bg-[#F4F5F7]"
            activeOpacity={0.8}
        >
            <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1">
                    <Text className="text-[#091E42] font-bold text-lg">
                        {customer.name}
                    </Text>
                    <Text className="text-[#5E6C84] font-bold text-xs mb-1 uppercase tracking-wider">
                        {customer.id}
                    </Text>
                    {/* Active Loans Badges List */}
                    <View className="flex-row flex-wrap gap-1 mt-1">
                        {customer.loans.map((loan, idx) => {
                            const lStyle = getStatusStyle(loan.status);
                            return (
                                <View key={idx} className={`flex-row items-center border ${lStyle.border} rounded overflow-hidden`}>
                                    <View className={`${lStyle.bg} px-2 py-0.5`}>
                                        <Text className={`${lStyle.text} text-sm font-mono font-bold uppercase`}>{loan.loan_id}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>
                <View className={`${overallStyle.bg} px-3 py-1 rounded border ${overallStyle.border} flex-shrink-0`}>
                    <Text className={`${overallStyle.text} text-xs font-bold uppercase`}>
                        {overallStyle.label}
                    </Text>
                </View>
            </View>

            <View className="flex-row items-center mb-5">
                <MaterialIcons name="location-on" size={16} color="#5E6C84" />
                <Text className="text-[#5E6C84] text-sm ml-1.5 flex-1" numberOfLines={1}>
                    {customer.address}
                </Text>
            </View>

            <View className="flex-row items-center justify-between border-t border-[#F4F5F7] pt-4">
                <View className="flex-1 flex-row">
                    <View className="mr-8">
                        <Text className="text-[#5E6C84] text-xs font-bold uppercase tracking-wider mb-1">
                            {t.customer.arrears}
                        </Text>
                        <View className="flex-row items-baseline gap-2">
                            <Text className={`${totalArrears > 0 ? "text-[#DE350B]" : "text-[#091E42]"} font-bold text-lg`}>
                                {customer.loans[0]?.currency_symbol || "$"}{totalArrears.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                            {maxDaysDue > 0 && (
                                <Text className="text-[#DE350B] text-sm font-bold font-mono">
                                    ({maxDaysDue} {t.customer.days_overdue.split(' ')[0][0].toLowerCase() === 'd' ? 'd' : 'd'})
                                </Text>
                            )}
                        </View>
                    </View>
                    <View>
                        <Text className="text-[#5E6C84] text-xs font-bold uppercase tracking-wider mb-1">
                            {t.customer.unpaid_balance}
                        </Text>
                        <Text className="text-[#091E42] font-bold text-lg">
                            {customer.loans[0]?.currency_symbol || "$"}{totalAmountDue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}
