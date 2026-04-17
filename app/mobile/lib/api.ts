import { Platform } from "react-native";
import { getSession, getSiteUrl, isAccessTokenExpired, saveAccessToken } from "./auth";

const API_TIMEOUT_MS = 12000;
const API_MAX_RETRIES = 2;
const API_RETRY_BASE_DELAY_MS = 300;
const ACCESS_TOKEN_REFRESH_PATH = "/api/method/loan_manager.loan_manager.api.mobile.refresh_mobile_access_token";
let accessTokenRefreshInFlight: Promise<void> | null = null;

type FrappeRequestOptions = RequestInit & {
    timeoutMs?: number;
    maxRetries?: number;
    idempotent?: boolean;
};

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffDelayMs(attempt: number): number {
    const jitter = Math.floor(Math.random() * 120);
    return API_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + jitter;
}

function isRetryableHttpStatus(status: number): boolean {
    return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isAbortError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
        return false;
    }
    return (error as { name?: string }).name === "AbortError";
}

function isLikelyNetworkError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
        return false;
    }
    const message = ((error as { message?: string }).message || "").toLowerCase();
    return (
        message.includes("network request failed") ||
        message.includes("failed to fetch") ||
        message.includes("networkerror")
    );
}

async function refreshAccessTokenFromLegacyAuth(
    siteUrl: string,
    apiKey: string,
    apiSecret: string
): Promise<void> {
    const response = await fetch(`${siteUrl}${ACCESS_TOKEN_REFRESH_PATH}`, {
        method: "POST",
        headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        credentials: "include",
    });

    if (!response.ok) {
        return;
    }

    const payload = await response.json().catch(() => null);
    const message = payload?.message || {};
    const accessToken = message.access_token as string | undefined;
    const accessTokenExpiresAt = message.access_token_expires_at as string | undefined;
    if (!accessToken) {
        return;
    }

    await saveAccessToken(accessToken, accessTokenExpiresAt);
}

function queueAccessTokenRefresh(
    siteUrl: string,
    apiKey: string,
    apiSecret: string
) {
    if (accessTokenRefreshInFlight) {
        return;
    }

    accessTokenRefreshInFlight = refreshAccessTokenFromLegacyAuth(siteUrl, apiKey, apiSecret)
        .catch(() => {
            // Silent best-effort refresh.
        })
        .finally(() => {
            accessTokenRefreshInFlight = null;
        });
}

/**
 * Base API client for Frappe
 * Handles auth headers and JSON parsing
 */
async function performFetchWithRetry(
    url: string,
    requestInit: RequestInit,
    timeoutMs: number,
    maxRetries: number
): Promise<Response> {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const shouldRetry = attempt < maxRetries;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...requestInit,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (shouldRetry && isRetryableHttpStatus(response.status)) {
                await sleep(getBackoffDelayMs(attempt + 1));
                continue;
            }

            return response;
        } catch (error: unknown) {
            clearTimeout(timeoutId);
            const timeoutError = isAbortError(error);
            const networkError = isLikelyNetworkError(error);
            if (shouldRetry && (timeoutError || networkError)) {
                await sleep(getBackoffDelayMs(attempt + 1));
                continue;
            }

            if (timeoutError) {
                throw new Error(`API Timeout after ${timeoutMs}ms`);
            }

            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`API request failed: ${String(error)}`);
        }
    }

    throw new Error(`API request failed after ${maxRetries + 1} attempts`);
}

async function frappeRequest<T>(
    path: string,
    options: FrappeRequestOptions = {}
): Promise<T> {
    const siteUrl = await getSiteUrl();
    const session = await getSession();

    if (!siteUrl) throw new Error("No site URL configured");

    const {
        timeoutMs: timeoutOverride,
        maxRetries: maxRetriesOverride,
        idempotent: idempotentOverride,
        ...fetchOptions
    } = options;

    const url = `${siteUrl}${path}`;
    const baseHeaders: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(fetchOptions.headers as Record<string, string>),
    };

    const method = (fetchOptions.method || "GET").toUpperCase();
    const idempotent = idempotentOverride ?? method === "GET";
    const maxRetries = idempotent ? (maxRetriesOverride ?? API_MAX_RETRIES) : 0;
    const timeoutMs = timeoutOverride ?? API_TIMEOUT_MS;

    const hasValidBearerToken = !!(session?.accessToken && !isAccessTokenExpired(session.accessTokenExpiresAt));
    const hasLegacyToken = !!(session?.apiKey && session?.apiSecret);
    const authModes: Array<"bearer" | "legacy" | "cookie" | "none"> = [];
    if (hasValidBearerToken) {
        authModes.push("bearer");
    }
    if (hasLegacyToken) {
        authModes.push("legacy");
    }
    if (!hasValidBearerToken && !hasLegacyToken && session?.sid && Platform.OS !== "web") {
        authModes.push("cookie");
    }
    if (authModes.length === 0) {
        authModes.push("none");
    }

    let lastError: Error | null = null;
    for (const authMode of authModes) {
        const headers: Record<string, string> = { ...baseHeaders };
        if (authMode === "bearer" && session?.accessToken) {
            headers["Authorization"] = `Bearer ${session.accessToken}`;
        } else if (authMode === "legacy" && session?.apiKey && session?.apiSecret) {
            headers["Authorization"] = `token ${session.apiKey}:${session.apiSecret}`;
        } else if (authMode === "cookie" && session?.sid && Platform.OS !== "web") {
            headers["Cookie"] = `sid=${session.sid}`;
        }

        try {
            const response = await performFetchWithRetry(
                url,
                {
                    ...fetchOptions,
                    headers,
                    credentials: "include",
                },
                timeoutMs,
                maxRetries
            );

            if (!response.ok) {
                const errorBody = await response.text().catch(() => "Unknown error");
                const isBearer401Fallback = response.status === 401 && authMode === "bearer" && hasLegacyToken;
                if (isBearer401Fallback) {
                    continue;
                }

                lastError = new Error(`API Error ${response.status}: ${errorBody}`);
                break;
            }

            if (
                authMode === "legacy" &&
                hasLegacyToken &&
                path !== ACCESS_TOKEN_REFRESH_PATH &&
                session?.apiKey &&
                session?.apiSecret
            ) {
                queueAccessTokenRefresh(siteUrl, session.apiKey, session.apiSecret);
            }

            return response.json();
        } catch (error: unknown) {
            if (error instanceof Error) {
                lastError = error;
                break;
            }
            lastError = new Error(`API request failed: ${String(error)}`);
            break;
        }
    }

    if (lastError) {
        throw lastError;
    }
    throw new Error("API request failed");
}

/**
 * List documents (GET /api/resource/{doctype})
 */
export async function listDocs<T>(
    doctype: string,
    options: {
        fields?: string[];
        filters?: [string, string, string, any][];
        orderBy?: string;
        limit?: number;
        offset?: number;
    } = {}
): Promise<T[]> {
    const params = new URLSearchParams();

    if (options.fields) {
        params.set("fields", JSON.stringify(options.fields));
    }
    if (options.filters) {
        params.set("filters", JSON.stringify(options.filters));
    }
    if (options.orderBy) {
        params.set("order_by", options.orderBy);
    }
    if (options.limit) {
        params.set("limit_page_length", String(options.limit));
    }
    if (options.offset) {
        params.set("limit_start", String(options.offset));
    }

    const queryString = params.toString();
    const path = `/api/resource/${encodeURIComponent(doctype)}${queryString ? `?${queryString}` : ""}`;

    const res = await frappeRequest<{ data: T[] }>(path);
    return res.data;
}

/**
 * Get a single document (GET /api/resource/{doctype}/{name})
 */
export async function getDoc<T>(doctype: string, name: string): Promise<T> {
    const path = `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`;
    const res = await frappeRequest<{ data: T }>(path);
    return res.data;
}

/**
 * Create a new document (POST /api/resource/{doctype})
 */
export async function createDoc<T>(
    doctype: string,
    data: Partial<T>
): Promise<T> {
    const path = `/api/resource/${encodeURIComponent(doctype)}`;
    const res = await frappeRequest<{ data: T }>(path, {
        method: "POST",
        body: JSON.stringify(data),
    });
    return res.data;
}

/**
 * Update a document (PUT /api/resource/{doctype}/{name})
 */
export async function updateDoc<T>(
    doctype: string,
    name: string,
    data: Partial<T>
): Promise<T> {
    const path = `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`;
    const res = await frappeRequest<{ data: T }>(path, {
        method: "PUT",
        body: JSON.stringify(data),
    });
    return res.data;
}

/**
 * Call a whitelisted Frappe method
 */
export async function callMethod<T>(
    method: string,
    args: Record<string, any> = {},
    options: { idempotent?: boolean; timeoutMs?: number; maxRetries?: number } = {}
): Promise<T> {
    const path = `/api/method/${method}`;
    const res = await frappeRequest<{ message: T }>(path, {
        method: "POST",
        body: JSON.stringify(args),
        idempotent: options.idempotent ?? true,
        timeoutMs: options.timeoutMs,
        maxRetries: options.maxRetries,
    });
    return res.message;
}

/**
 * Get count of documents
 */
export async function getCount(
    doctype: string,
    filters?: [string, string, string, any][]
): Promise<number> {
    const params = new URLSearchParams();
    params.set("doctype", doctype);
    if (filters) {
        params.set("filters", JSON.stringify(filters));
    }

    const res = await frappeRequest<{ message: number }>(
        `/api/method/frappe.client.get_count?${params.toString()}`
    );
    return res.message;
}

/**
 * Fetch Mobile Dashboard Data from Custom Endpoint
 */
export async function getDashboardData(loanOfficerId: string): Promise<any[]> {
    return callMethod("loan_manager.loan_manager.api.mobile.get_mobile_dashboard_data", {
        loan_officer_id: loanOfficerId
    });
}

/**
 * Fetch Dashboard Header Meta (company, branch, system_date)
 */
export async function getDashboardMeta(loanOfficerId: string): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.get_mobile_dashboard_meta", {
        loan_officer_id: loanOfficerId
    });
}

/**
 * Fetch Detailed Customer and Loans Profile
 */
export async function getCustomerDetail(customerId: string): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.get_mobile_customer_detail", {
        customer_id: customerId
    });
}

/**
 * Fetch Detailed Loan Profile and Payment Plan
 */
export async function getLoanDetail(loanId: string): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.get_mobile_loan_detail", {
        loan_id: loanId
    });
}

/**
 * Fetch Init Data for Payment Screen
 */
export async function getPaymentInitData(loanId: string): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.get_mobile_payment_init_data", {
        loan_id: loanId
    });
}

/**
 * Record a Payment via the Mobile App
 */
export async function recordPayment(params: {
    loan_id: string;
    payment_amount: number;
    payment_currency: string;
    exchange_rate: number;
    latitude?: number;
    longitude?: number;
}): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.record_mobile_payment", params, {
        idempotent: false,
    });
}

/**
 * Fetch Receipt Data for a submitted Payment
 */
export async function getReceiptData(paymentName: string): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.get_mobile_receipt_data", {
        payment_name: paymentName
    });
}

/**
 * Fetch Daily Ledger Data (Today's payments and visits)
 */
export async function getDailyLedger(): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.get_daily_ledger");
}

/**
 * Fetch Visit Details
 */
export async function getVisitDetails(visitId: string): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.get_visit_details", {
        visit_id: visitId
    });
}
/**
 * Record a Customer Visit
 */
export async function recordCustomerVisit(params: {
    customer: string;
    visit_type: string;
    comments?: string;
    commitment_date?: string;
    amount_to_pay?: number;
    latitude?: number;
    longitude?: number;
}): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.record_customer_visit", {
        data: params
    }, {
        idempotent: false,
    });
}
/**
 * Fetch basic Customer Info
 */
export async function getCustomerInfo(customerId: string): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.get_customer_info", {
        customer_id: customerId
    });
}
/**
 * Fetch Notifications for the logged-in user with pagination
 */
export async function getNotifications(limitStart: number = 0, limitLength: number = 10): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.get_notifications", {
        limit_start: limitStart,
        limit_page_length: limitLength
    });
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(name: string): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.mark_notification_as_read", {
        notification_name: name
    }, {
        idempotent: false,
    });
}

/**
 * Register an Expo Push Token for the current user
 */
export async function registerPushToken(token: string): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.register_push_token", {
        token
    }, {
        idempotent: false,
    });
}

/**
 * Fetch Shift Settings (Denominations and Variance config)
 */
export async function getMobileSettings(): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.get_mobile_settings");
}

/**
 * Open a new shift for the Loan Officer
 */
export async function openShift(): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.open_shift", {}, {
        idempotent: false,
    });
}

/**
 * Get active shift details for the Loan Officer
 */
export async function getActiveShift(): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.get_active_shift");
}

/**
 * Close the active shift
 */
export async function closeShift(params: {
    shift_id: string;
    observation?: string;
    cash_count: { currency: string; denomination: number; count: number; type: string }[];
}): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.close_shift", {
        shift_id: params.shift_id,
        observation: params.observation,
        cash_count: JSON.stringify(params.cash_count)
    }, {
        idempotent: false,
    });
}

/**
 * Get shift history for the current officer
 */
export async function getShiftHistory(limitStart: number = 0, limitLength: number = 20): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.get_shift_history", {
        limit_start: limitStart,
        limit_page_length: limitLength
    });
}

/**
 * Get full details for a specific shift
 */
export async function getShiftDetails(shiftId: string): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.get_shift_details", {
        shift_id: shiftId
    });
}

/**
 * Verify if the current token is valid
 */
export async function verifyToken(): Promise<any> {
    return callMethod("loan_manager.loan_manager.api.mobile.verify_token");
}
