import React, { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { getLocales } from "expo-localization";
import { login as authLogin, loginWithToken as authLoginWithToken, logout as authLogout, getSession, getStoredLanguage, saveDateFormat } from "./auth";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { registerPushToken, verifyToken } from "./api";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        // Foreground notifications are rendered with a custom in-app banner.
        shouldShowAlert: false,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: false,
        shouldShowList: true,
    }),
});

interface AuthState {
    isLoggedIn: boolean;
    isLoading: boolean;
    user: string | null;
    fullName: string | null;
    language: string;
    dateFormat: string;
    session: {
        loan_officer_id: string | null;
        office_id: string | null;
    } | null;
}

interface AuthContextType extends AuthState {
    login: (siteUrl: string, username: string, password: string) => Promise<{ success: boolean; error?: string }>;
    loginWithToken: (siteUrl: string, apiKey: string, apiSecret: string) => Promise<{ success: boolean; error?: string }>;
    setLanguage: (lang: string) => void;
    setDateFormat: (format: string) => void;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    isLoggedIn: false,
    isLoading: true,
    user: null,
    fullName: null,
    language: "en",
    dateFormat: "yyyy-mm-dd",
    session: null,
    login: async () => ({ success: false }),
    loginWithToken: async () => ({ success: false }),
    setLanguage: () => { },
    setDateFormat: () => { },
    logout: async () => { },
});

export function AuthProvider({ children }: PropsWithChildren) {
    const [state, setState] = useState<AuthState>({
        isLoggedIn: false,
        isLoading: true,
        user: null,
        fullName: null,
        language: "en",
        dateFormat: "yyyy-mm-dd",
        session: null,
    });

    useEffect(() => {
        checkAuth();
    }, []);

    async function registerForPushNotificationsAsync() {
        if (!Device.isDevice && Platform.OS !== "web") {
            console.log("Must use physical device for Push Notifications");
            return;
        }

        try {
            const webVapidPublicKey =
                (Constants?.expoConfig as any)?.notification?.vapidPublicKey ||
                process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;

            if (Platform.OS === "web" && !webVapidPublicKey) {
                console.log("Push notifications disabled on web: missing notification.vapidPublicKey");
                return;
            }

            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== "granted") {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== "granted") {
                console.log("Failed to get push token for push notification!");
                return;
            }

            const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
            if (!projectId) {
                console.log("EAS Project ID not found");
            }

            const pushTokenOptions: { projectId?: string; vapidPublicKey?: string } = {};
            if (projectId) {
                pushTokenOptions.projectId = projectId;
            }
            if (Platform.OS === "web" && webVapidPublicKey) {
                pushTokenOptions.vapidPublicKey = webVapidPublicKey;
            }

            const token = (await Notifications.getExpoPushTokenAsync(pushTokenOptions)).data;
            console.log("Push token obtained");
            const res = await registerPushToken(token);
            console.log("Push Token registration result:", res);
        } catch (error) {
            if (Platform.OS === "web") {
                console.warn("Skipping web push notifications registration:", error);
                return;
            }
            console.error("Error registering for push notifications:", error);
        }

        if (Platform.OS !== "web") {
            try {
                await Notifications.setNotificationCategoryAsync("notification", [
                    { identifier: "open", buttonTitle: "Open" },
                ]);
            } catch (error) {
                console.warn("Failed to configure notification category:", error);
            }
        }

        if (Platform.OS === "android") {
            try {
                await Promise.all([
                    Notifications.setNotificationChannelAsync("default", {
                        name: "General",
                        importance: Notifications.AndroidImportance.DEFAULT,
                        vibrationPattern: [0, 180, 120, 180],
                        lightColor: "#5305C7",
                    }),
                    Notifications.setNotificationChannelAsync("mention", {
                        name: "Mentions",
                        importance: Notifications.AndroidImportance.DEFAULT,
                        vibrationPattern: [0, 120, 80, 120],
                        lightColor: "#0052CC",
                    }),
                    Notifications.setNotificationChannelAsync("assignment", {
                        name: "Assignments",
                        importance: Notifications.AndroidImportance.HIGH,
                        vibrationPattern: [0, 180, 120, 180, 120, 180],
                        lightColor: "#5305C7",
                    }),
                    Notifications.setNotificationChannelAsync("alert", {
                        name: "Alerts",
                        importance: Notifications.AndroidImportance.MAX,
                        vibrationPattern: [0, 250, 250, 250],
                        lightColor: "#FF8B00",
                        sound: "default",
                    }),
                ]);
            } catch (error) {
                console.warn("Failed to configure Android notification channels:", error);
            }
        }
    }

    async function checkAuth() {
        try {
            const session = await getSession();

            // Get device language, fallback to 'en'
            const locales = getLocales();
            const deviceLang = locales && locales.length > 0 ? locales[0].languageCode : "en";

            // Get stored language or fallback to device lang
            const storedLang = await getStoredLanguage();
            const defaultLang = storedLang || deviceLang || "en";

            if (session) {
                // Verify token with server
                try {
                    await verifyToken();
                } catch (error: any) {
                    console.error("Token verification failed:", error);
                    // If 401, the token is invalid (e.g. rotated on server)
                    if (error.message?.includes("401")) {
                        await logout();
                        return;
                    }
                }

                setState({
                    isLoggedIn: true,
                    isLoading: false,
                    user: session.user,
                    fullName: session.fullName,
                    language: session.language || defaultLang,
                    dateFormat: session.dateFormat || "yyyy-mm-dd",
                    session: {
                        loan_officer_id: session.loanOfficerId,
                        office_id: session.officeId,
                    }
                });
                registerForPushNotificationsAsync();
            } else {
                setState({ isLoggedIn: false, isLoading: false, user: null, fullName: null, language: defaultLang, dateFormat: "yyyy-mm-dd", session: null });
            }
        } catch (error) {
            console.error("checkAuth error:", error);
            setState({ isLoggedIn: false, isLoading: false, user: null, fullName: null, language: "en", dateFormat: "yyyy-mm-dd", session: null });
        }
    }

    async function login(siteUrl: string, username: string, password: string) {
        const result = await authLogin(siteUrl, username, password);
        if (result.success) {
            // Need to reload session to get language
            const session = await getSession();
            setState({
                isLoggedIn: true,
                isLoading: false,
                user: username,
                fullName: result.fullName || username,
                language: session?.language || "en",
                dateFormat: session?.dateFormat || "yyyy-mm-dd",
                session: session ? {
                    loan_officer_id: session.loanOfficerId,
                    office_id: session.officeId,
                } : null
            });
            registerForPushNotificationsAsync();
        }
        return result;
    }

    async function loginWithToken(siteUrl: string, apiKey: string, apiSecret: string) {
        const result = await authLoginWithToken(siteUrl, apiKey, apiSecret);
        if (result.success) {
            const session = await getSession();
            setState({
                isLoggedIn: true,
                isLoading: false,
                user: result.fullName || "Token User",
                fullName: result.fullName || "Token User",
                language: session?.language || "en",
                dateFormat: session?.dateFormat || "yyyy-mm-dd",
                session: session ? {
                    loan_officer_id: session.loanOfficerId,
                    office_id: session.officeId,
                } : null
            });
            registerForPushNotificationsAsync();
        }
        return result;
    }

    function setLanguage(lang: string) {
        setState(prev => ({ ...prev, language: lang }));
    }

    function setDateFormat(format: string) {
        setState(prev => ({ ...prev, dateFormat: format }));
        saveDateFormat(format);
    }

    async function logout() {
        const currentLang = state.language;
        const currentFormat = state.dateFormat;
        await authLogout();
        setState({ isLoggedIn: false, isLoading: false, user: null, fullName: null, language: currentLang, dateFormat: currentFormat, session: null });
    }

    return (
        <AuthContext.Provider value={{ ...state, login, loginWithToken, setLanguage, setDateFormat, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
