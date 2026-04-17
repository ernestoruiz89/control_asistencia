import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SITE_URL_KEY = "frappe-site-url";
const SESSION_KEY = "frappe-session";
const USER_KEY = "frappe-user";
const FULL_NAME_KEY = "frappe-full-name";
const API_KEY_KEY = "frappe-api-key";
const API_SECRET_KEY = "frappe-api-secret";
const ACCESS_TOKEN_KEY = "frappe-access-token";
const ACCESS_TOKEN_EXPIRES_AT_KEY = "frappe-access-token-expires-at";
const LANGUAGE_KEY = "frappe-language";
const LOAN_OFFICER_ID_KEY = "frappe-loan-officer-id";
const OFFICE_ID_KEY = "frappe-office-id";
const DATE_FORMAT_KEY = "frappe-date-format";
const WEB_SENSITIVE_KEYS = new Set([
    SESSION_KEY,
    API_KEY_KEY,
    API_SECRET_KEY,
    ACCESS_TOKEN_KEY,
    ACCESS_TOKEN_EXPIRES_AT_KEY,
]);
const webSensitiveCache = new Map<string, string>();
type WebStorageLike = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
};

function isSensitiveWebKey(key: string): boolean {
    return WEB_SENSITIVE_KEYS.has(key);
}

function getWebLocalStorage(): WebStorageLike | null {
    try {
        return typeof localStorage !== "undefined" ? localStorage : null;
    } catch {
        return null;
    }
}

function getWebSessionStorage(): WebStorageLike | null {
    try {
        return typeof sessionStorage !== "undefined" ? sessionStorage : null;
    } catch {
        return null;
    }
}

/**
 * Storage helper:
 * - native: SecureStore
 * - web non-sensitive keys: localStorage
 * - web sensitive keys (sid/api_key/api_secret/access_token): memory + sessionStorage
 */
const storage = {
    async setItem(key: string, value: string) {
        if (Platform.OS === "web") {
            try {
                const localStore = getWebLocalStorage();
                const sessionStore = getWebSessionStorage();

                if (isSensitiveWebKey(key)) {
                    webSensitiveCache.set(key, value);
                    sessionStore?.setItem(key, value);
                    // Remove legacy persisted copies if present.
                    localStore?.removeItem(key);
                    return;
                }

                localStore?.setItem(key, value);
            } catch (e) {
                console.error("Storage setItem error", e);
            }
        } else {
            await SecureStore.setItemAsync(key, value);
        }
    },
    async getItem(key: string): Promise<string | null> {
        if (Platform.OS === "web") {
            try {
                const localStore = getWebLocalStorage();
                const sessionStore = getWebSessionStorage();

                if (isSensitiveWebKey(key)) {
                    if (webSensitiveCache.has(key)) {
                        return webSensitiveCache.get(key) ?? null;
                    }

                    let value = sessionStore?.getItem(key) ?? null;
                    if (!value) {
                        // Migrate legacy values from localStorage to session storage.
                        value = localStore?.getItem(key) ?? null;
                        if (value) {
                            sessionStore?.setItem(key, value);
                            localStore?.removeItem(key);
                        }
                    }

                    if (value) {
                        webSensitiveCache.set(key, value);
                    }
                    return value;
                }

                return localStore?.getItem(key) ?? null;
            } catch (e) {
                console.error("Storage getItem error", e);
                return webSensitiveCache.get(key) ?? null;
            }
        } else {
            return await SecureStore.getItemAsync(key);
        }
    },
    async deleteItem(key: string) {
        if (Platform.OS === "web") {
            try {
                const localStore = getWebLocalStorage();
                const sessionStore = getWebSessionStorage();

                if (isSensitiveWebKey(key)) {
                    webSensitiveCache.delete(key);
                    sessionStore?.removeItem(key);
                    localStore?.removeItem(key);
                    return;
                }

                localStore?.removeItem(key);
            } catch (e) {
                console.error("Storage deleteItem error", e);
            }
        } else {
            await SecureStore.deleteItemAsync(key);
        }
    },
};

function resolveAccessTokenExpiresAt(accessTokenExpiresAt?: string, accessTokenExpiresIn?: number): string | undefined {
    if (accessTokenExpiresAt && !Number.isNaN(Date.parse(accessTokenExpiresAt))) {
        return accessTokenExpiresAt;
    }

    if (typeof accessTokenExpiresIn === "number" && accessTokenExpiresIn > 0) {
        return new Date(Date.now() + accessTokenExpiresIn * 1000).toISOString();
    }

    return undefined;
}

async function requestMobileAccessToken(
    cleanUrl: string,
    apiKey: string,
    apiSecret: string
): Promise<{ accessToken?: string; accessTokenExpiresAt?: string }> {
    try {
        const response = await fetch(
            `${cleanUrl}/api/method/loan_manager.loan_manager.api.mobile.refresh_mobile_access_token`,
            {
                method: "POST",
                headers: {
                    Authorization: `token ${apiKey}:${apiSecret}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            }
        );

        if (!response.ok) {
            return {};
        }

        const payload = await response.json().catch(() => null);
        const message = payload?.message || {};
        const accessToken = message.access_token as string | undefined;
        const accessTokenExpiresAt = resolveAccessTokenExpiresAt(
            message.access_token_expires_at as string | undefined,
            message.access_token_expires_in as number | undefined
        );

        if (!accessToken) {
            return {};
        }

        return { accessToken, accessTokenExpiresAt };
    } catch {
        return {};
    }
}

/**
 * Store the Frappe site URL
 */
export async function saveSiteUrl(url: string) {
    const cleanUrl = url.replace(/\/+$/, ""); // Remove trailing slashes
    await storage.setItem(SITE_URL_KEY, cleanUrl);
}

/**
 * Get the stored Frappe site URL
 */
export async function getSiteUrl(): Promise<string | null> {
    return storage.getItem(SITE_URL_KEY);
}

/**
 * Store session info after login
 */
export async function saveSession(
    user: string,
    fullName: string,
    sid: string,
    apiKey?: string,
    apiSecret?: string,
    language?: string,
    loanOfficerId?: string,
    officeId?: string,
    dateFormat?: string,
    accessToken?: string,
    accessTokenExpiresAt?: string
) {
    const promises = [
        storage.setItem(USER_KEY, user),
        storage.setItem(FULL_NAME_KEY, fullName),
        storage.setItem(SESSION_KEY, sid),
    ];

    if (apiKey && apiSecret) {
        promises.push(storage.setItem(API_KEY_KEY, apiKey));
        promises.push(storage.setItem(API_SECRET_KEY, apiSecret));
    }

    if (language) {
        promises.push(storage.setItem(LANGUAGE_KEY, language));
    }

    if (loanOfficerId) {
        promises.push(storage.setItem(LOAN_OFFICER_ID_KEY, loanOfficerId));
    }

    if (officeId) {
        promises.push(storage.setItem(OFFICE_ID_KEY, officeId));
    }

    if (dateFormat) {
        promises.push(storage.setItem(DATE_FORMAT_KEY, dateFormat));
    }

    if (accessToken) {
        promises.push(storage.setItem(ACCESS_TOKEN_KEY, accessToken));
        if (accessTokenExpiresAt) {
            promises.push(storage.setItem(ACCESS_TOKEN_EXPIRES_AT_KEY, accessTokenExpiresAt));
        } else {
            promises.push(storage.deleteItem(ACCESS_TOKEN_EXPIRES_AT_KEY));
        }
    } else {
        promises.push(storage.deleteItem(ACCESS_TOKEN_KEY));
        promises.push(storage.deleteItem(ACCESS_TOKEN_EXPIRES_AT_KEY));
    }

    await Promise.all(promises);
}

export async function saveAccessToken(accessToken: string, accessTokenExpiresAt?: string) {
    const promises = [storage.setItem(ACCESS_TOKEN_KEY, accessToken)];
    if (accessTokenExpiresAt) {
        promises.push(storage.setItem(ACCESS_TOKEN_EXPIRES_AT_KEY, accessTokenExpiresAt));
    } else {
        promises.push(storage.deleteItem(ACCESS_TOKEN_EXPIRES_AT_KEY));
    }
    await Promise.all(promises);
}

export function isAccessTokenExpired(accessTokenExpiresAt?: string | null): boolean {
    if (!accessTokenExpiresAt) {
        return true;
    }

    const expiresAtMs = Date.parse(accessTokenExpiresAt);
    if (!Number.isFinite(expiresAtMs)) {
        return true;
    }

    const skewMs = 30 * 1000;
    return Date.now() >= expiresAtMs - skewMs;
}

/**
 * Update only the date format in storage
 */
export async function saveDateFormat(dateFormat: string) {
    await storage.setItem(DATE_FORMAT_KEY, dateFormat);
}

/**
 * Get the stored session info
 */
export async function getSession() {
    const [user, fullName, sid, apiKey, apiSecret, accessToken, accessTokenExpiresAt, language, loanOfficerId, officeId, dateFormat] = await Promise.all([
        storage.getItem(USER_KEY),
        storage.getItem(FULL_NAME_KEY),
        storage.getItem(SESSION_KEY),
        storage.getItem(API_KEY_KEY),
        storage.getItem(API_SECRET_KEY),
        storage.getItem(ACCESS_TOKEN_KEY),
        storage.getItem(ACCESS_TOKEN_EXPIRES_AT_KEY),
        storage.getItem(LANGUAGE_KEY),
        storage.getItem(LOAN_OFFICER_ID_KEY),
        storage.getItem(OFFICE_ID_KEY),
        storage.getItem(DATE_FORMAT_KEY),
    ]);
    if (!user) return null;
    return {
        user,
        fullName: fullName ?? user,
        sid,
        apiKey,
        apiSecret,
        accessToken,
        accessTokenExpiresAt,
        language: language || "en",
        loanOfficerId,
        officeId,
        dateFormat: dateFormat || "yyyy-mm-dd"
    };
}

/**
 * Get the stored language preference
 */
export async function getStoredLanguage(): Promise<string | null> {
    return storage.getItem(LANGUAGE_KEY);
}

/**
 * Clear all stored session data
 */
export async function clearSession() {
    await Promise.all([
        storage.deleteItem(USER_KEY),
        storage.deleteItem(FULL_NAME_KEY),
        storage.deleteItem(SESSION_KEY),
        storage.deleteItem(API_KEY_KEY),
        storage.deleteItem(API_SECRET_KEY),
        storage.deleteItem(ACCESS_TOKEN_KEY),
        storage.deleteItem(ACCESS_TOKEN_EXPIRES_AT_KEY),
        storage.deleteItem(LOAN_OFFICER_ID_KEY),
        storage.deleteItem(OFFICE_ID_KEY),
        storage.deleteItem(DATE_FORMAT_KEY),
        // storage.deleteItem(LANGUAGE_KEY), // Keep language preference across sessions
    ]);
}

/**
 * Login using API Key and Secret directly
 */
export async function loginWithToken(
    siteUrl: string,
    apiKey: string,
    apiSecret: string
): Promise<{ success: boolean; fullName?: string; error?: string }> {
    try {
        const cleanUrl = siteUrl.replace(/\/+$/, "");
        const response = await fetch(`${cleanUrl}/api/method/frappe.auth.get_logged_user`, {
            headers: {
                Authorization: `token ${apiKey}:${apiSecret}`,
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            return { success: false, error: "Invalid API Key or Secret" };
        }

        const data = await response.json();
        const userName = data.message || "User";

        // Fetch user language with token
        let userLanguage = "en";
        try {
            const userRes = await fetch(`${cleanUrl}/api/resource/User/${userName}`, {
                headers: {
                    Authorization: `token ${apiKey}:${apiSecret}`,
                    Accept: "application/json",
                },
            });
            if (userRes.ok) {
                const userData = await userRes.json();
                userLanguage = userData.data?.language || "en";
            }
        } catch (e) {
            console.error("Failed to fetch user language", e);
        }

        // VALIDATE ACTIVE LOAN OFFICER
        let loanOfficerId = "";
        let officeId = "";
        try {
            const encodedUser = encodeURIComponent(userName);
            const loRes = await fetch(`${cleanUrl}/api/method/loan_manager.loan_manager.api.mobile.get_loan_officer_for_user?user=${encodedUser}`, {
                method: "GET",
                headers: {
                    Authorization: `token ${apiKey}:${apiSecret}`,
                    Accept: "application/json",
                },
            });

            if (loRes.ok) {
                const loData = await loRes.json();
                if (loData.message && loData.message.loan_officer_id) {
                    loanOfficerId = loData.message.loan_officer_id;
                    officeId = loData.message.office_id;
                } else {
                    return { success: false, error: "Access Denied: Your user is not assigned as an active Loan Officer." };
                }
            } else {
                const text = await loRes.text();
                return { success: false, error: `Could not verify Loan Officer permissions. Status: ${loRes.status} Error: ${text}` };
            }
        } catch (e) {
            console.error("Failed to fetch Loan Officer mapping", e);
            return { success: false, error: "System error verifying permissions." };
        }

        await saveSiteUrl(cleanUrl);
        const { accessToken, accessTokenExpiresAt } = await requestMobileAccessToken(cleanUrl, apiKey, apiSecret);
        await saveSession(
            userName,
            userName,
            "token-auth",
            apiKey,
            apiSecret,
            userLanguage,
            loanOfficerId,
            officeId,
            undefined,
            accessToken,
            accessTokenExpiresAt
        );

        return { success: true, fullName: userName };
    } catch (err: any) {
        return { success: false, error: err.message || "Network error" };
    }
}

/**
 * Login to Frappe via Token generator
 */
export async function login(
    siteUrl: string,
    username: string,
    password: string
): Promise<{ success: boolean; fullName?: string; error?: string }> {
    try {
        const cleanUrl = siteUrl.replace(/\/+$/, "");
        const url = `${cleanUrl}/api/method/loan_manager.loan_manager.api.mobile.login_via_token`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({ usr: username, pwd: password })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            return {
                success: false,
                error: errorData?.message || `Login failed (${response.status})`,
            };
        }

        const data = await response.json();
        const { api_key, api_secret, user, full_name } = data.message;
        let accessToken = data.message?.access_token as string | undefined;
        let accessTokenExpiresAt = resolveAccessTokenExpiresAt(
            data.message?.access_token_expires_at as string | undefined,
            data.message?.access_token_expires_in as number | undefined
        );

        if (!api_key || !api_secret) {
            return { success: false, error: "Authentication failed. No API Keys generated." };
        }

        // Fetch user language with the new tokens
        let userLanguage = "en";
        try {
            const userRes = await fetch(`${cleanUrl}/api/resource/User/${user}`, {
                headers: {
                    Authorization: `token ${api_key}:${api_secret}`,
                    Accept: "application/json",
                },
            });
            if (userRes.ok) {
                const userData = await userRes.json();
                userLanguage = userData.data?.language || "en";
            }
        } catch (e) {
            console.error("Failed to fetch user language", e);
        }

        // VALIDATE ACTIVE LOAN OFFICER
        let loanOfficerId = "";
        let officeId = "";
        try {
            const encodedUser = encodeURIComponent(user);
            const loRes = await fetch(`${cleanUrl}/api/method/loan_manager.loan_manager.api.mobile.get_loan_officer_for_user?user=${encodedUser}`, {
                method: "GET",
                headers: {
                    Authorization: `token ${api_key}:${api_secret}`,
                    Accept: "application/json",
                }
            });

            if (loRes.ok) {
                const loData = await loRes.json();
                if (loData.message && loData.message.loan_officer_id) {
                    loanOfficerId = loData.message.loan_officer_id;
                    officeId = loData.message.office_id;
                } else {
                    return { success: false, error: "Access Denied: Your user is not assigned as an active Loan Officer." };
                }
            } else {
                const text = await loRes.text();
                return { success: false, error: `Could not verify Loan Officer permissions. Status: ${loRes.status} Error: ${text}` };
            }
        } catch (e) {
            console.error("Failed to fetch Loan Officer mapping", e);
            return { success: false, error: "System error verifying permissions." };
        }

        // Save session locally using Token Auth payload (bypassing cookies entirely)
        await saveSiteUrl(cleanUrl);
        if (!accessToken) {
            const refreshed = await requestMobileAccessToken(cleanUrl, api_key, api_secret);
            accessToken = refreshed.accessToken;
            accessTokenExpiresAt = accessTokenExpiresAt || refreshed.accessTokenExpiresAt;
        }

        await saveSession(
            user,
            full_name,
            "token-auth",
            api_key,
            api_secret,
            userLanguage,
            loanOfficerId,
            officeId,
            undefined,
            accessToken,
            accessTokenExpiresAt
        );

        return { success: true, fullName: full_name };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || "Network error. Check the site URL.",
        };
    }
}

/**
 * Logout from Frappe
 */
export async function logout(): Promise<void> {
    const siteUrl = await getSiteUrl();
    if (siteUrl) {
        try {
            await fetch(`${siteUrl}/api/method/logout`, {
                method: "POST",
                credentials: "include",
            });
        } catch {
            // Ignore logout failures
        }
    }
    await clearSession();
}

/**
 * Check if we have a valid session
 */
export async function isAuthenticated(): Promise<boolean> {
    const session = await getSession();
    if (!session) return false;

    const siteUrl = await getSiteUrl();
    if (!siteUrl) return false;

    try {
        const headers: Record<string, string> = {
            Accept: "application/json",
        };

        if (Platform.OS !== "web") {
            headers["Cookie"] = `sid=${session.sid}`;
        }

        const res = await fetch(
            `${siteUrl}/api/method/frappe.auth.get_logged_user`,
            {
                headers,
                credentials: "include",
            }
        );
        if (!res.ok) return false;
        const data = await res.json();
        return !!data.message;
    } catch {
        return false;
    }
}
