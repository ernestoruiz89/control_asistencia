import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
    ScrollView,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator,
    Modal,
    Pressable,
    Dimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "../../../lib/i18n";
import { getCustomerDetail } from "../../../lib/api";
import { useAuth } from "../../../lib/AuthContext";
import { formatDate } from "../../../lib/utils";

export default function CustomerDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { t } = useTranslation();
    const { session, dateFormat, setDateFormat } = useAuth();
    const loanOfficerId = session?.loan_officer_id;

    const [customer, setCustomer] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [menuVisible, setMenuVisible] = useState(false);
    const [loanMenuVisible, setLoanMenuVisible] = useState(false);
    const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
    const [customerMenuPosition, setCustomerMenuPosition] = useState({ top: 92, left: 18 });
    const [loanMenuPosition, setLoanMenuPosition] = useState({ top: 150, left: 18 });

    const loadData = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const data = await getCustomerDetail(id);
            if (data.date_format && data.date_format !== dateFormat) {
                setDateFormat(data.date_format);
            }
            setCustomer(data);
        } catch (error) {
            console.error("Failed to load customer details:", error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    function formatCurrency(amount: number, symbol?: string) {
        return `${symbol || "$"}${amount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`
    }

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "overdue": return { bg: "bg-[#FFEBE6]", text: "text-[#DE350B]", label: t.status?.overdue || "OVERDUE", border: "border-[#FFBDAD]" };
            case "due_today": return { bg: "bg-[#FFF0B3]", text: "text-[#BF2600]", label: t.status?.due_today || "DUE TODAY", border: "border-[#FFE380]" };
            case "paid": return { bg: "bg-[#E3FCEF]", text: "text-[#006644]", label: t.status?.paid || "PAID", border: "border-[#ABF5D1]" };
            default: return { bg: "bg-[#E3FCEF]", text: "text-[#006644]", label: t.status?.upcoming || "UPCOMING", border: "border-[#ABF5D1]" };
        }
    };

    // Safety check for rendering before data lands
    const totalArrears = customer?.loans?.reduce((sum: number, l: any) => sum + l.unpaid_balance, 0) || 0;
    // Use first loan's currency for the aggregate arrears display
    const mainCurrency = customer?.loans?.[0]?.currency_symbol || "$";
    const customerId = Array.isArray(id) ? id[0] : id;
    const customerLat = Number(customer?.latitude);
    const customerLng = Number(customer?.longitude);
    const hasCustomerCoords = Number.isFinite(customerLat) && Number.isFinite(customerLng);

    return (
        <SafeAreaView className="flex-1 bg-[#F4F5F7]">
            {/* Header */}
            <View className="bg-white pt-4 pb-6 px-6 border-b border-[#DFE1E6] flex-row items-center justify-between shadow-sm">
                <View className="flex-row items-center">
                    <TouchableOpacity
                        onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/(drawer)")}
                        className="w-10 h-10 items-center justify-center bg-[#F4F5F7] rounded border border-[#DFE1E6] mr-4 active:bg-[#DFE1E6]"
                    >
                        <MaterialIcons name="arrow-back" size={24} color="#091E42" />
                    </TouchableOpacity>
                    <Text className="text-[#091E42] font-bold text-lg uppercase tracking-wide">
                        {t.customer.loan_info}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={(event) => {
                        const menuWidth = 190;
                        const screenWidth = Dimensions.get("window").width;
                        const pageX = event.nativeEvent.pageX;
                        const pageY = event.nativeEvent.pageY;
                        const candidateLeft = pageX - menuWidth + 32;
                        const clampedLeft = Math.max(12, Math.min(candidateLeft, screenWidth - menuWidth - 12));
                        setCustomerMenuPosition({
                            top: pageY + 12,
                            left: clampedLeft,
                        });
                        setMenuVisible(true);
                    }}
                    className="p-2"
                >
                    <MaterialIcons name="more-vert" size={24} color="#091E42" />
                </TouchableOpacity>
            </View>

            <Modal
                transparent
                visible={menuVisible}
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
            >
                <View style={{ flex: 1 }}>
                    <Pressable style={{ flex: 1 }} onPress={() => setMenuVisible(false)} />
                    <View
                        style={{
                            position: "absolute",
                            top: customerMenuPosition.top,
                            left: customerMenuPosition.left,
                            backgroundColor: "#FFFFFF",
                            borderColor: "#DFE1E6",
                            borderWidth: 1,
                            borderRadius: 10,
                            minWidth: 190,
                            shadowColor: "#091E42",
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.12,
                            shadowRadius: 16,
                            elevation: 8,
                        }}
                    >
                        <TouchableOpacity
                            onPress={() => {
                                setMenuVisible(false);
                                if (customerId) {
                                    const basePath = `/(app)/(drawer)/map?focusCustomerId=${encodeURIComponent(customerId)}`;
                                    const focusPath = hasCustomerCoords
                                        ? `${basePath}&focusLat=${customerLat}&focusLng=${customerLng}`
                                        : basePath;
                                    router.push(focusPath as any);
                                }
                            }}
                            className="px-4 py-3 flex-row items-center border-b border-[#DFE1E6]"
                        >
                            <MaterialIcons name="map" size={20} color="#091E42" />
                            <Text className="text-[#091E42] font-semibold ml-3">
                                {t.customer.view_on_map || "Ver en Mapa"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => {
                                setMenuVisible(false);
                                if (customerId) {
                                    router.push(`/(app)/customer-info/${customerId}` as any);
                                }
                            }}
                            className="px-4 py-3 flex-row items-center"
                        >
                            <MaterialIcons name="info-outline" size={20} color="#091E42" />
                            <Text className="text-[#091E42] font-semibold ml-3">
                                {t.customer.more_info_menu || "Mas informacion"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                transparent
                visible={loanMenuVisible}
                animationType="fade"
                onRequestClose={() => setLoanMenuVisible(false)}
            >
                <View style={{ flex: 1 }}>
                    <Pressable style={{ flex: 1 }} onPress={() => setLoanMenuVisible(false)} />
                    <View
                        style={{
                            position: "absolute",
                            top: loanMenuPosition.top,
                            left: loanMenuPosition.left,
                            backgroundColor: "#FFFFFF",
                            borderColor: "#DFE1E6",
                            borderWidth: 1,
                            borderRadius: 10,
                            minWidth: 190,
                            shadowColor: "#091E42",
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.12,
                            shadowRadius: 16,
                            elevation: 8,
                        }}
                    >
                        <TouchableOpacity
                            onPress={() => {
                                const loanId = selectedLoanId;
                                setLoanMenuVisible(false);
                                if (loanId) {
                                    router.push(`/(app)/loan-info/${loanId}` as any);
                                }
                            }}
                            className="px-4 py-3 flex-row items-center"
                        >
                            <MaterialIcons name="info-outline" size={20} color="#091E42" />
                            <Text className="text-[#091E42] font-semibold ml-3">
                                {t.customer.more_info_menu || "Mas informacion"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#5305c7" />
                </View>
            ) : !customer ? (
                <View className="flex-1 justify-center items-center">
                    <Text className="text-[#5E6C84]">Customer data not found.</Text>
                </View>
            ) : (
                <>
                    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                        {/* Identity Block */}
                        <View className="bg-white px-6 py-6 border-b border-[#DFE1E6] flex-row justify-between items-start">
                            <View className="flex-row items-center gap-4 flex-1 mr-4">
                                <View className="flex-1">
                                    <Text className="text-[#091E42] text-2xl font-bold leading-tight">{customer.name}</Text>
                                    <Text className="font-mono text-sm text-[#5E6C84] mt-1">{customer.loans.length} {t.customer?.active_loans || "Active Loan(s)"}</Text>
                                    <View className="flex-row items-center gap-2 mt-2">
                                        <View className="bg-[#EBECF0] px-2.5 py-1 rounded border border-[#DFE1E6]">
                                            <Text className="text-xs font-bold uppercase text-[#091E42]">{t.customer?.total_arrears_label || "Total Arrears:"} {formatCurrency(totalArrears, mainCurrency)}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                            <View className="items-center">
                                <View className="w-12 h-12 bg-[#FF8B00] items-center justify-center rounded">
                                    <Text className="text-white text-lg font-mono font-bold">{customer.risk}</Text>
                                </View>
                                <Text className="text-[10px] font-bold uppercase text-[#5E6C84] mt-2 tracking-wider">{t.customer?.class || "Class"}</Text>
                            </View>
                        </View>

                        {/* Loan Cards List */}
                        <View className="px-6 py-4">
                            <Text className="text-[#5E6C84] text-[10px] font-bold tracking-[0.2em] uppercase mb-4">
                                {t.customer?.active_facilities || "Active Credits"}
                            </Text>

                            {customer.loans?.map((loan: any) => {
                                const style = getStatusStyle(loan.status);
                                return (
                                    <View key={loan.loan_id} className="bg-white rounded-lg border border-[#DFE1E6] mb-6 shadow-sm overflow-hidden">
                                        {/* Card Header */}
                                        <View className="flex-row justify-between items-center p-4 border-b border-[#F4F5F7]">
                                            <View className="flex-1 pr-2">
                                                <Text className="text-sm font-mono font-bold uppercase text-[#5E6C84] tracking-wide mb-1">{t.customer?.loan_id || "Loan ID:"} {loan.loan_id}</Text>
                                                <Text className="text-sm font-bold text-[#091E42]">
                                                    {t.customer?.term || "Term:"} {loan.term?.replace(/Every Two Weeks/i, t.customer?.term_biweekly || "Every Two Weeks")
                                                        .replace(/15 Days/i, t.customer?.term_15_days || "15 Days")
                                                        .replace(/Months|Month/i, t.customer?.term_months || "Months")
                                                        .replace(/Weeks|Week/i, t.customer?.term_weeks || "Weeks")
                                                        .replace(/Days|Day/i, t.customer?.term_days || "Days")
                                                        .replace(/Years|Year/i, t.customer?.term_years || "Years")}
                                                </Text>
                                                <View className="flex-row items-center mt-2 flex-wrap">
                                                    <View className="flex-row items-center">
                                                        <Text className="text-[10px] font-bold uppercase text-[#5E6C84] mr-1">{t.customer?.disbursement_date || "Disb. Date"}</Text>
                                                        <Text className="text-[11px] font-bold text-[#091E42]">{formatDate(loan.disbursement_date, "mmm dd, yyyy")}</Text>
                                                    </View>
                                                    <MaterialIcons name="arrow-forward" size={14} color="#8993A4" style={{ marginHorizontal: 8 }} />
                                                    <View className="flex-row items-center">
                                                        <Text className="text-[10px] font-bold uppercase text-[#5E6C84] mr-1">{t.customer?.maturity_date || "Matr. Date"}</Text>
                                                        <Text className="text-[11px] font-bold text-[#091E42]">{formatDate(loan.maturity_date, "mmm dd, yyyy")}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                            <View className="flex-row items-center shrink-0">
                                                <View className={`${style.bg} px-2 py-1 rounded border ${style.border}`}>
                                                    <Text className={`${style.text} text-[10px] font-bold uppercase`}>{style.label}</Text>
                                                </View>
                                                <TouchableOpacity
                                                    onPress={(event) => {
                                                        const menuWidth = 190;
                                                        const screenWidth = Dimensions.get("window").width;
                                                        const pageX = event.nativeEvent.pageX;
                                                        const pageY = event.nativeEvent.pageY;
                                                        const candidateLeft = pageX - menuWidth + 32;
                                                        const clampedLeft = Math.max(12, Math.min(candidateLeft, screenWidth - menuWidth - 12));
                                                        setLoanMenuPosition({
                                                            top: pageY + 12,
                                                            left: clampedLeft,
                                                        });
                                                        setSelectedLoanId(loan.loan_id);
                                                        setLoanMenuVisible(true);
                                                    }}
                                                    className="ml-1.5 px-1 py-1 items-center justify-center"
                                                >
                                                    <MaterialIcons name="more-vert" size={18} color="#091E42" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* Numbers Grid */}
                                        <View className="flex-row border-b border-[#F4F5F7]">
                                            <View className="flex-1 p-4 border-r border-[#F4F5F7] bg-[#E3FCEF]/20">
                                                <Text className="text-sm font-bold uppercase text-[#5305c7] mb-1">{t.customer?.next_due || "Next Due"}</Text>
                                                <Text className="text-sm font-bold font-mono text-[#091E42]">{formatDate(loan.due_date, "mmm dd, yyyy")}</Text>
                                                {loan.next_due_amount > 0 && (
                                                    <Text className="text-sm font-bold font-mono text-[#006644] mt-0.5">
                                                        {formatCurrency(loan.next_due_amount, loan.currency_symbol)}
                                                    </Text>
                                                )}
                                            </View>
                                            <View className={`flex-1 p-4 ${loan.overdue_installments > 0 ? 'bg-[#FFEBE6]/20' : 'bg-[#F4F5F7]/20'}`}>
                                                <Text className={`text-sm font-bold uppercase ${loan.overdue_installments > 0 ? 'text-[#DE350B]' : 'text-[#5E6C84]'} mb-1`}>{t.customer?.arrears || "Arrears"}</Text>
                                                <Text className={`text-sm font-bold font-mono ${loan.overdue_installments > 0 ? 'text-[#DE350B]' : 'text-[#091E42]'}`}>
                                                    {loan.overdue_installments || 0} {t.customer?.arrears_count_label || "Cuotas"}
                                                    {loan.days_due > 0 ? ` (${loan.days_due} ${t.customer?.days_overdue?.split(' ')[0][0].toLowerCase() === 'd' ? 'd' : 'd'})` : ""}
                                                </Text>
                                                {loan.unpaid_balance > 0 && (
                                                    <Text className={`text-sm font-bold font-mono ${loan.unpaid_balance > 0 ? 'text-[#DE350B]' : 'text-[#091E42]'} mt-0.5`}>
                                                        {formatCurrency(loan.unpaid_balance, loan.currency_symbol)}
                                                    </Text>
                                                )}
                                            </View>
                                        </View>

                                        {/* Balance Breakdown Table */}
                                        <View className="p-4 bg-white border-b border-[#F4F5F7]">
                                            <View className="flex-row items-center border-b border-[#DFE1E6] pb-1.5 mb-0.5">
                                                <Text className="flex-[1.5] text-sm font-bold uppercase text-[#5E6C84]">{t.customer?.summary || "Summary"}</Text>
                                                <Text className="flex-1 text-sm font-bold uppercase text-[#5E6C84] text-right">{t.customer?.outstanding || "Outstanding"}</Text>
                                                <Text className="flex-1 text-sm font-bold uppercase text-[#5E6C84] text-right">{t.customer?.arrears || "Arrears"}</Text>
                                            </View>
                                            {[
                                                { label: t.customer?.principal || "Principal", data: loan.breakdown?.principal },
                                                { label: t.customer?.interest || "Interest", data: loan.breakdown?.interest },
                                                { label: t.customer?.penalty || "Penalty", data: loan.breakdown?.penalty },
                                                { label: t.customer?.fees || "Fees", data: loan.breakdown?.fees },
                                            ].map((row, i) => (
                                                <View key={row.label} className={`flex-row items-center py-0.5 ${i % 2 !== 0 ? 'bg-[#F4F5F7]/30' : ''}`}>
                                                    <Text className="flex-[1.5] text-sm font-medium text-[#091E42]">{row.label}</Text>
                                                    <Text className="flex-1 text-sm font-mono text-[#091E42] text-right">{(row.data?.outstanding || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                                    <Text className={`flex-1 text-sm font-mono ${(loan.unpaid_balance || 0) > 0 ? 'text-[#DE350B]' : 'text-[#091E42]'} text-right`}>{(row.data?.arrears || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                                </View>
                                            ))}
                                            <View className="flex-row items-center py-1 border-t border-[#DFE1E6] mt-0.5">
                                                <Text className="flex-[1.5] text-sm font-bold text-[#091E42]">{t.customer?.total || "Total"}</Text>
                                                <Text className="flex-1 text-sm font-bold font-mono text-[#091E42] text-right">{(loan.total_outstanding || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                                <Text className={`flex-1 text-sm font-bold font-mono ${(loan.unpaid_balance || 0) > 0 ? 'text-[#DE350B]' : 'text-[#091E42]'} text-right`}>{(loan.unpaid_balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                            </View>
                                        </View>

                                        {/* Per-Loan actions if there are multiple loans */}
                                        {customer.loans.length > 1 && loan.loan_officer_id === loanOfficerId && (
                                            <View className="p-3 bg-white border-t border-[#DFE1E6]">
                                                <TouchableOpacity
                                                    onPress={() => router.push(`/(app)/payment/${loan.loan_id}`)}
                                                    className="bg-[#5305c7] h-10 rounded-lg flex-row items-center justify-center shadow-sm active:opacity-80"
                                                >
                                                    <MaterialIcons name="payments" size={18} color="white" />
                                                    <Text className="text-white font-bold uppercase text-sm tracking-widest ml-2">
                                                        {t.customer?.record_payment || "Record Payment"}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                        {loan.loan_officer_id !== loanOfficerId && (
                                            <View className="p-3 bg-[#F4F5F7] border-t border-[#DFE1E6]">
                                                <Text className="text-center text-sm font-semibold text-[#5E6C84]">
                                                    {t.customer?.assigned_to || "Assigned to:"} {loan.loan_officer_name}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>

                        {/* Contact Info */}
                        <View className="px-6 pb-12">
                            <Text className="text-[#5E6C84] text-[10px] font-bold tracking-[0.2em] uppercase mb-4">
                                {t.customer?.contact_dossier || "Contact Info"}
                            </Text>
                            <View className="bg-white rounded-lg border border-[#DFE1E6] overflow-hidden shadow-sm">
                                <View className="p-5 flex-row items-center gap-4 border-b border-[#F4F5F7]">
                                    <View className="w-10 h-10 bg-[#DEEBFF] items-center justify-center rounded">
                                        <MaterialIcons name="call" size={20} color="#0052CC" />
                                    </View>
                                    <View>
                                        <Text className="text-[10px] font-mono uppercase text-[#5E6C84]">{t.customer?.mobile_label || "Mobile"}</Text>
                                        <Text className="text-base font-semibold text-[#091E42]">{customer.phone}</Text>
                                    </View>
                                </View>
                                <View className="p-5 flex-row items-center gap-4">
                                    <View className="w-10 h-10 bg-[#F4F5F7] items-center justify-center rounded border border-[#DFE1E6]">
                                        <MaterialIcons name="map" size={20} color="#091E42" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[10px] font-mono uppercase text-[#5E6C84]">{t.customer?.address_label || "Address"}</Text>
                                        <Text className="text-sm font-semibold text-[#091E42]" numberOfLines={2}>{customer.address}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </ScrollView>

                    {/* Bottom Action */}
                    <View className="p-6 bg-white/95 border-t border-[#DFE1E6] shadow-lg gap-3">
                        <TouchableOpacity
                            onPress={() => router.push(`/(app)/visit/new/${id}`)}
                            className="bg-white h-14 rounded-lg flex-row items-center justify-center border border-[#DFE1E6] active:bg-[#F4F5F7]"
                        >
                            <MaterialIcons name="edit-calendar" size={24} color="#091E42" />
                            <Text className="text-[#091E42] font-bold uppercase text-sm tracking-widest ml-3">
                                {t.visit?.title || "Register Visit"}
                            </Text>
                        </TouchableOpacity>

                        {customer.loans?.length === 1 && customer.loans[0].loan_officer_id === loanOfficerId && (
                            <TouchableOpacity
                                onPress={() => router.push(`/(app)/payment/${customer.loans[0].loan_id}`)}
                                className="bg-[#5305c7] h-14 rounded-lg flex-row items-center justify-center shadow-md active:translate-y-px"
                            >
                                <MaterialIcons name="payments" size={24} color="white" />
                                <Text className="text-white font-bold uppercase text-sm tracking-widest ml-3">
                                    {t.customer?.record_payment || "Record Payment"}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </>
            )}
        </SafeAreaView>
    );
}
