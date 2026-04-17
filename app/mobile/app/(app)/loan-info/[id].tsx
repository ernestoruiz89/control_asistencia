import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getLoanDetail } from "../../../lib/api";
import { useAuth } from "../../../lib/AuthContext";
import { useTranslation } from "../../../lib/i18n";
import { formatDate } from "../../../lib/utils";

type RowItem = {
    label: string;
    value: string | number;
};

function normalizeTranslationKey(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function renderValue(value: unknown) {
    if (value === null || value === undefined || value === "") return "";
    return String(value);
}

function translateCatalogValue(value: unknown, labels?: Record<string, string>) {
    if (value === null || value === undefined || value === "") return "";
    const rawValue = String(value).trim();
    if (!labels) return rawValue;

    const normalizedKey = normalizeTranslationKey(rawValue);
    return labels[normalizedKey] || rawValue;
}

function formatAmount(amount: number, symbol: string) {
    return `${symbol}${(amount || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatOptionalPercent(value: unknown) {
    if (value === null || value === undefined || value === "") return "";
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return "";
    return `${numericValue.toFixed(2)}%`;
}

function formatOptionalAmount(value: unknown, symbol: string) {
    if (value === null || value === undefined || value === "") return "";
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return "";
    return formatAmount(numericValue, symbol);
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

function PaymentPlanTable({
    rows,
    symbol,
    dateFormat,
    labels,
    overdueBalance,
    catchUpBalance,
    payoffBalance,
}: {
    rows: any[];
    symbol: string;
    dateFormat: string;
    labels: any;
    overdueBalance: number;
    catchUpBalance: number;
    payoffBalance: number;
}) {
    const totals = rows.reduce(
        (acc, row) => {
            acc.repayment_amount += Number(row?.repayment_amount || 0);
            acc.principal_amount += Number(row?.principal_amount || 0);
            acc.interest_amount += Number(row?.interest_amount || 0);
            acc.fee_amount += Number(row?.fee_amount || 0);
            return acc;
        },
        {
            repayment_amount: 0,
            principal_amount: 0,
            interest_amount: 0,
            fee_amount: 0,
        }
    );

    const getRowStatus = (status: string) => {
        if (status === "paid") return { label: labels.status_paid || "Paid", color: "text-[#006644]" };
        if (status === "overdue") return { label: labels.status_overdue || "Overdue", color: "text-[#DE350B]" };
        return { label: labels.status_pending || "Pending", color: "text-[#5E6C84]" };
    };

    return (
        <View className="bg-white border border-[#DFE1E6] rounded-lg mb-4 overflow-hidden">
            <View className="px-4 py-3 border-b border-[#DFE1E6] bg-[#F4F5F7]">
                <Text className="text-[#5E6C84] text-sm font-bold uppercase tracking-[0.12em]">
                    {labels.payment_plan || "Payment Plan"}
                </Text>
            </View>
            <View className="flex-row">
                <View className="w-12 border-r border-[#DFE1E6] bg-[#FAFBFC]">
                    <View className="border-b border-[#DFE1E6]">
                        <Text className="px-2 py-2 text-[10px] font-bold uppercase text-[#5E6C84]" numberOfLines={1}>
                            {labels.col_number || "#"}
                        </Text>
                    </View>
                    {rows.map((row: any) => (
                        <View key={`fixed-${row.repayment_number}-${row.date}`} className="border-b border-[#F4F5F7]">
                            <Text className="px-2 py-2 text-sm text-[#091E42]">{row.repayment_number}</Text>
                        </View>
                    ))}
                    <View className="border-t border-[#DFE1E6]">
                        <Text className="px-2 py-2.5 text-sm font-bold text-[#091E42]"></Text>
                    </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator>
                    <View style={{ minWidth: 1072 }}>
                        <View className="flex-row border-b border-[#DFE1E6] bg-[#FAFBFC]">
                            <Text className="w-28 px-3 py-2 text-[10px] font-bold uppercase text-[#5E6C84]" numberOfLines={1}>{labels.col_date || "Date"}</Text>
                            <Text className="w-24 px-3 py-2 text-[10px] font-bold uppercase text-[#5E6C84]" numberOfLines={1}>{labels.col_status || "Status"}</Text>
                            <Text className="w-28 px-3 py-2 text-[10px] font-bold uppercase text-[#5E6C84] text-right" numberOfLines={1}>{labels.col_installment || "Installment"}</Text>
                            <Text className="w-28 px-3 py-2 text-[10px] font-bold uppercase text-[#5E6C84] text-right" numberOfLines={1}>{labels.col_principal || "Principal"}</Text>
                            <Text className="w-28 px-3 py-2 text-[10px] font-bold uppercase text-[#5E6C84] text-right" numberOfLines={1}>{labels.col_interest || "Interest"}</Text>
                            <Text className="w-28 px-3 py-2 text-[10px] font-bold uppercase text-[#5E6C84] text-right" numberOfLines={1}>{labels.col_fees || "Fees"}</Text>
                            <Text className="w-36 px-3 py-2 text-[10px] font-bold uppercase text-[#5E6C84] text-right" numberOfLines={1}>{labels.col_overdue_balance || "Overdue Balance"}</Text>
                            <Text className="w-36 px-3 py-2 text-[10px] font-bold uppercase text-[#5E6C84] text-right" numberOfLines={1}>{labels.col_catch_up_balance || "Catch-up Balance"}</Text>
                            <Text className="w-36 px-3 py-2 text-[10px] font-bold uppercase text-[#5E6C84] text-right" numberOfLines={1}>{labels.col_payoff_balance || "Payoff Balance"}</Text>
                        </View>
                        {rows.map((row: any) => {
                            const status = getRowStatus(row.status);
                            return (
                                <View key={`${row.repayment_number}-${row.date}`} className="flex-row border-b border-[#F4F5F7]">
                                    <Text className="w-28 px-3 py-2 text-sm text-[#091E42]">{formatDate(row.date, dateFormat)}</Text>
                                    <Text className={`w-24 px-3 py-2 text-sm font-bold ${status.color}`}>{status.label}</Text>
                                    <Text className="w-28 px-3 py-2 text-sm text-[#091E42] text-right">{formatAmount(row.repayment_amount || 0, symbol)}</Text>
                                    <Text className="w-28 px-3 py-2 text-sm text-[#091E42] text-right">{formatAmount(row.principal_amount || 0, symbol)}</Text>
                                    <Text className="w-28 px-3 py-2 text-sm text-[#091E42] text-right">{formatAmount(row.interest_amount || 0, symbol)}</Text>
                                    <Text className="w-28 px-3 py-2 text-sm text-[#091E42] text-right">{formatAmount(row.fee_amount || 0, symbol)}</Text>
                                    <Text className="w-36 px-3 py-2 text-sm text-[#091E42] text-right">
                                        {Number(row?.overdue_component || 0) > 0
                                            ? formatAmount(Number(row?.overdue_component || 0), symbol)
                                            : ""}
                                    </Text>
                                    <Text className="w-36 px-3 py-2 text-sm text-[#091E42] text-right">
                                        {Number(row?.catch_up_component || 0) > 0
                                            ? formatAmount(Number(row?.catch_up_component || 0), symbol)
                                            : ""}
                                    </Text>
                                    <Text className="w-36 px-3 py-2 text-sm text-[#091E42] text-right">
                                        {Number(row?.payoff_component || 0) > 0
                                            ? formatAmount(Number(row?.payoff_component || 0), symbol)
                                            : ""}
                                    </Text>
                                </View>
                            );
                        })}
                        <View className="flex-row border-t border-[#DFE1E6] bg-[#FAFBFC]">
                            <Text className="w-28 px-3 py-2.5 text-sm font-bold text-[#091E42]">{labels.total_label || "Total"}</Text>
                            <Text className="w-24 px-3 py-2.5 text-sm font-bold text-[#091E42] text-right"></Text>
                            <Text className="w-28 px-3 py-2.5 text-sm font-bold text-[#091E42] text-right">{formatAmount(totals.repayment_amount, symbol)}</Text>
                            <Text className="w-28 px-3 py-2.5 text-sm font-bold text-[#091E42] text-right">{formatAmount(totals.principal_amount, symbol)}</Text>
                            <Text className="w-28 px-3 py-2.5 text-sm font-bold text-[#091E42] text-right">{formatAmount(totals.interest_amount, symbol)}</Text>
                            <Text className="w-28 px-3 py-2.5 text-sm font-bold text-[#091E42] text-right">{formatAmount(totals.fee_amount, symbol)}</Text>
                            <Text className="w-36 px-3 py-2.5 text-sm font-bold text-[#091E42] text-right">{formatAmount(overdueBalance || 0, symbol)}</Text>
                            <Text className="w-36 px-3 py-2.5 text-sm font-bold text-[#091E42] text-right">{formatAmount(catchUpBalance || 0, symbol)}</Text>
                            <Text className="w-36 px-3 py-2.5 text-sm font-bold text-[#091E42] text-right">{formatAmount(payoffBalance || 0, symbol)}</Text>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </View>
    );
}

export default function LoanMoreInfoScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { t } = useTranslation();
    const { dateFormat, setDateFormat } = useAuth();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loan, setLoan] = useState<any>(null);
    const [errorMessage, setErrorMessage] = useState("");

    const loanId = Array.isArray(id) ? id[0] : id;

    const loadData = useCallback(async (showLoader: boolean = true) => {
        if (!loanId) {
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
            const data = await getLoanDetail(loanId);
            if (data.date_format && data.date_format !== dateFormat) {
                setDateFormat(data.date_format);
            }
            setLoan(data);
        } catch (error) {
            console.error("Failed to load loan additional details:", error);
            setLoan(null);
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
    }, [dateFormat, loanId, setDateFormat, t.common.no_data, t.common.no_permission]);

    const onRefresh = useCallback(() => {
        loadData(false);
    }, [loadData]);

    useFocusEffect(
        useCallback(() => {
            loadData(true);
        }, [loadData])
    );

    const symbol = loan?.currency_symbol || "";
    const loanInfoT = t.loan_info || {};
    const termFrequencyLabels = (loanInfoT.term_frequency_values as Record<string, string> | undefined) || {};
    const periodicityLabels = (loanInfoT.periodicity_values as Record<string, string> | undefined) || {};
    const creditStatusLabels = (loanInfoT.credit_status_values as Record<string, string> | undefined) || {};

    const translatedLoanTermFrequency = translateCatalogValue(loan?.loan_term_frequency, termFrequencyLabels);
    const translatedPeriodicity = translateCatalogValue(loan?.periodicity, periodicityLabels);
    const translatedLoanStatus = translateCatalogValue(loan?.loan_status, creditStatusLabels);
    const loanTerm = loan?.loan_term ? `${loan.loan_term} ${translatedLoanTermFrequency}`.trim() : "";

    const generalRows = useMemo(
        () =>
            [
                { label: loanInfoT.credit_product || "Credit Product", value: renderValue(loan?.loan_product) },
                { label: loanInfoT.disbursed_amount || "Disbursed Amount", value: formatAmount(loan?.disbursement_amount || 0, symbol) },
                { label: loanInfoT.currency || "Currency", value: renderValue(loan?.currency) },
                { label: loanInfoT.disbursement_date || "Disbursement Date", value: renderValue(loan?.disbursement_date ? formatDate(loan.disbursement_date, dateFormat) : "") },
                { label: loanInfoT.maturity_date || "Maturity Date", value: renderValue(loan?.maturity_date ? formatDate(loan.maturity_date, dateFormat) : "") },
                { label: loanInfoT.term || "Term", value: renderValue(loanTerm) },
                { label: loanInfoT.periodicity || "Periodicity", value: renderValue(translatedPeriodicity) },
            ],
        [dateFormat, loan?.currency, loan?.disbursement_amount, loan?.disbursement_date, loan?.loan_product, loan?.maturity_date, loanInfoT.credit_product, loanInfoT.currency, loanInfoT.disbursed_amount, loanInfoT.disbursement_date, loanInfoT.maturity_date, loanInfoT.periodicity, loanInfoT.term, loanTerm, symbol, translatedPeriodicity]
    );

    const pricingRows = useMemo(
        () =>
            [
                { label: loanInfoT.interest_rate || "Interest Rate", value: `${(loan?.interest_rate || 0).toFixed(2)}%` },
                { label: loanInfoT.penalty_rate || "Penalty Rate", value: `${(loan?.penalty_rate || 0).toFixed(2)}%` },
                {
                    label: loanInfoT.commissions || "Fees",
                    value: `${Number(loan?.commissions_percentage ?? loan?.commissions ?? 0).toFixed(2)}%`,
                },
            ],
        [loan?.commissions, loan?.commissions_percentage, loan?.interest_rate, loan?.penalty_rate, loanInfoT.commissions, loanInfoT.interest_rate, loanInfoT.penalty_rate]
    );

    const managementRows = useMemo(
        () =>
            [
                { label: loanInfoT.assigned_officer || "Assigned Officer", value: renderValue(loan?.loan_officer_name) },
                { label: loanInfoT.branch || "Branch", value: renderValue(loan?.branch) },
                { label: loanInfoT.credit_status || "Credit Status", value: renderValue(translatedLoanStatus) },
            ],
        [loan?.branch, loan?.loan_officer_name, loanInfoT.assigned_officer, loanInfoT.branch, loanInfoT.credit_status, translatedLoanStatus]
    );

    const riskRows = useMemo(
        () =>
            [
                { label: loanInfoT.days_overdue || "Days Overdue", value: renderValue(loan?.days_due || 0) },
                {
                    label: loanInfoT.oldest_overdue_due_date || "Oldest Overdue Installment Date",
                    value: renderValue(
                        loan?.oldest_overdue_due_date
                            ? formatDate(loan.oldest_overdue_due_date, dateFormat)
                            : ""
                    ),
                },
                { label: loanInfoT.credit_classification || "Credit Classification", value: renderValue(loan?.credit_classification) },
                { label: loanInfoT.provision || "Provision", value: `${(loan?.provision_percentage || 0).toFixed(2)}%` },
                { label: loanInfoT.provision_amount || "Provision Amount", value: formatAmount(loan?.provision_amount || 0, symbol) },
            ],
        [
            loan?.credit_classification,
            loan?.days_due,
            loan?.oldest_overdue_due_date,
            loan?.provision_amount,
            loan?.provision_percentage,
            loanInfoT.credit_classification,
            loanInfoT.days_overdue,
            loanInfoT.oldest_overdue_due_date,
            loanInfoT.provision_amount,
            loanInfoT.provision,
            symbol,
            dateFormat,
        ]
    );

    const riskMitigationRows = useMemo(
        () =>
            [
                {
                    label: loanInfoT.next_classification_change_date || "Next Classification Change Date",
                    value: renderValue(
                        loan?.next_classification_change_date
                            ? formatDate(loan.next_classification_change_date, dateFormat)
                            : ""
                    ),
                },
                {
                    label: loanInfoT.next_credit_classification || "Next Classification",
                    value: renderValue(loan?.next_credit_classification),
                },
                {
                    label: loanInfoT.next_provision || "Next Provision %",
                    value: renderValue(formatOptionalPercent(loan?.next_provision_percentage)),
                },
                {
                    label: loanInfoT.next_provision_amount_estimate || "Estimated Provision Amount",
                    value: renderValue(formatOptionalAmount(loan?.estimated_next_provision_amount, symbol)),
                },
                {
                    label: loanInfoT.provision_variation || "Provision Variation",
                    value: renderValue(
                        loan?.estimated_next_provision_amount === null ||
                            loan?.estimated_next_provision_amount === undefined ||
                            loan?.estimated_next_provision_amount === ""
                            ? ""
                            : formatOptionalAmount(
                                  Number(loan?.estimated_next_provision_amount || 0) - Number(loan?.provision_amount || 0),
                                  symbol
                              )
                    ),
                },
                {
                    label:
                        loanInfoT.neutralize_next_classification_amount ||
                        "Amount to Neutralize Next Classification Change",
                    value: renderValue(formatOptionalAmount(loan?.neutralize_next_classification_amount, symbol)),
                },
            ],
        [
            dateFormat,
            loan?.estimated_next_provision_amount,
            loan?.next_classification_change_date,
            loan?.next_credit_classification,
            loan?.next_provision_percentage,
            loan?.provision_amount,
            loan?.neutralize_next_classification_amount,
            loanInfoT.neutralize_next_classification_amount,
            loanInfoT.next_classification_change_date,
            loanInfoT.next_credit_classification,
            loanInfoT.next_provision,
            loanInfoT.next_provision_amount_estimate,
            loanInfoT.provision_variation,
            symbol,
        ]
    );

    const installmentsDetailRows = useMemo(
        () =>
            [
                { label: loanInfoT.scheduled_installments || "Scheduled Installments", value: renderValue(loan?.scheduled_installments || 0) },
                { label: loanInfoT.paid_installments || "Paid Installments", value: renderValue(loan?.paid_installments || 0) },
                { label: loanInfoT.pending_installments || "Pending Installments", value: renderValue(loan?.pending_installments || 0) },
                { label: loanInfoT.overdue_installments || "Overdue Installments", value: renderValue(loan?.overdue_installments || 0) },
            ],
        [
            loan?.overdue_installments,
            loan?.paid_installments,
            loan?.pending_installments,
            loan?.scheduled_installments,
            loanInfoT.overdue_installments,
            loanInfoT.paid_installments,
            loanInfoT.pending_installments,
            loanInfoT.scheduled_installments,
        ]
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
                    {loanInfoT.title || "Credit Information"}
                </Text>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#5305c7" />
                </View>
            ) : !loan ? (
                <View className="flex-1 justify-center items-center px-6">
                    <Text className="text-[#5E6C84] text-center">{errorMessage || t.common.no_data}</Text>
                </View>
            ) : (
                <View className="flex-1">
                    <View className="bg-white border border-[#DFE1E6] rounded-none p-4 mb-4">
                        <Text className="text-[#091E42] text-xl font-bold">{loan.loan_id}</Text>
                        <Text className="text-[#5E6C84] text-lg font-semibold mt-1">{loan.customer_name || ""}</Text>
                    </View>

                    <ScrollView
                        className="flex-1 px-6"
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5305c7" />
                        }
                    >
                        <InfoSection title={loanInfoT.general_section || "General Information"} rows={generalRows} />
                        <InfoSection title={loanInfoT.pricing_section || "Financial Terms"} rows={pricingRows} />
                        <InfoSection title={loanInfoT.management_section || "Credit Management"} rows={managementRows} />
                        <InfoSection title={loanInfoT.risk_section || "Risk"} rows={riskRows} />
                        <InfoSection title={loanInfoT.risk_mitigation_section || "Risk Mitigation"} rows={riskMitigationRows} />
                        <InfoSection title={loanInfoT.installments_detail_section || "Installment Details"} rows={installmentsDetailRows} />

                        <PaymentPlanTable
                            rows={loan.payment_plan || []}
                            symbol={symbol}
                            dateFormat={dateFormat}
                            labels={loanInfoT}
                            overdueBalance={Number(loan?.overdue_balance || 0)}
                            catchUpBalance={Number(loan?.catch_up_balance || 0)}
                            payoffBalance={Number(loan?.payoff_balance || 0)}
                        />
                        <View className="h-6" />
                    </ScrollView>
                </View>
            )}
        </SafeAreaView>
    );
}
