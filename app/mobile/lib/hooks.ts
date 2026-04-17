import { useCallback, useEffect, useState } from "react";
import type { DashboardSummary, Loan, Payment, QueueItem } from "../types";
import { createDoc, getDoc, listDocs } from "./api";

/**
 * Hook to fetch active loans for the dashboard queue
 */
export function useLoans() {
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLoans = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await listDocs<Loan>("Loan", {
                fields: [
                    "name",
                    "customer",
                    "status",
                    "loan_amount",
                    "currency",
                    "outstanding",
                    "days_due",
                    "principal",
                    "interest",
                    "penalty",
                    "fee",
                    "total_installments",
                    "paid_installments",
                    "pending_installments",
                    "overdue_installments",
                    "is_active",
                    "is_credit_line",
                    "credit_classification",
                    "interest_rate_annual",
                    "loan_term",
                    "loan_term_frecuency",
                    "loan_product",
                    "date",
                ],
                filters: [
                    ["Loan", "is_active", "=", 1],
                    ["Loan", "is_credit_line", "=", 0],
                ],
                orderBy: "days_due desc",
                limit: 100,
            });
            setLoans(data);
        } catch (err: any) {
            setError(err.message || "Failed to fetch loans");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLoans();
    }, [fetchLoans]);

    return { loans, loading, error, refetch: fetchLoans };
}

/**
 * Hook to fetch a single loan detail
 */
export function useLoanDetail(loanName: string) {
    const [loan, setLoan] = useState<Loan | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!loanName) return;

        (async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await getDoc<Loan>("Loan", loanName);
                setLoan(data);
            } catch (err: any) {
                setError(err.message || "Failed to fetch loan");
            } finally {
                setLoading(false);
            }
        })();
    }, [loanName]);

    return { loan, loading, error };
}

/**
 * Hook to fetch today's payments
 */
export function useTodayPayments() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const today = new Date().toISOString().split("T")[0];

    const fetchPayments = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await listDocs<Payment>("Payment", {
                fields: [
                    "name",
                    "loan",
                    "posting_date",
                    "payment_amount",
                    "payment_currency",
                    "total_amount_paid",
                    "status",
                    "remarks",
                ],
                filters: [
                    ["Payment", "posting_date", "=", today],
                    ["Payment", "docstatus", "=", 1],
                ],
                orderBy: "creation desc",
                limit: 100,
            });
            setPayments(data);
        } catch (err: any) {
            setError(err.message || "Failed to fetch payments");
        } finally {
            setLoading(false);
        }
    }, [today]);

    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

    return { payments, loading, error, refetch: fetchPayments };
}

/**
 * Build queue items from loans for the dashboard
 */
export function buildQueueItems(
    loans: Loan[],
    todayPayments: Payment[]
): QueueItem[] {
    const paidLoanIds = new Set(todayPayments.map((p) => p.loan));

    return loans.map((loan) => {
        let status: QueueItem["status"] = "upcoming";

        if (paidLoanIds.has(loan.name)) {
            status = "paid";
        } else if (loan.days_due > 0) {
            status = "overdue";
        } else if (loan.outstanding > 0) {
            status = "due_today";
        }

        return {
            loan,
            customerName: loan.customer_name || loan.customer,
            customerAddress: undefined, // Would need to fetch from customer
            amountDue: loan.outstanding,
            status,
        };
    });
}

/**
 * Build dashboard summary from queue items
 */
export function buildDashboardSummary(
    queueItems: QueueItem[],
    todayPayments: Payment[]
): DashboardSummary {
    const targetCollection = queueItems.reduce(
        (sum, item) => sum + item.amountDue,
        0
    );
    const actualCollection = todayPayments.reduce(
        (sum, p) => sum + (p.total_amount_paid || p.payment_amount || 0),
        0
    );
    const completedCount = queueItems.filter((i) => i.status === "paid").length;

    return {
        targetCollection,
        actualCollection,
        totalQueue: queueItems.length,
        completedCount,
    };
}

/**
 * Submit a payment
 */
export async function submitPayment(paymentData: {
    loan: string;
    posting_date: string;
    payment_amount: number;
    payment_currency: string;
    remarks?: string;
}): Promise<Payment> {
    return createDoc<Payment>("Payment", paymentData);
}
