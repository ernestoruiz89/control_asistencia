import * as Notifications from "expo-notifications";
import { Slot, useRootNavigationState, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import InAppNotificationBanner from "../components/common/InAppNotificationBanner";
import "../global.css";
import { markNotificationAsRead } from "../lib/api";
import { AuthProvider, useAuth } from "../lib/AuthContext";
import { useTranslation } from "../lib/i18n";

type PushBannerState = {
    identifier: string;
    title: string;
    message: string;
    type?: string;
    notificationName: string | null;
};

function toNonEmptyString(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed || null;
}

function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
}

function readDataString(data: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
        const normalized = toNonEmptyString(data[key]);
        if (normalized) {
            return normalized;
        }
    }
    return null;
}

function extractNotificationName(notification: Notifications.Notification | null): string | null {
    const data = toRecord(notification?.request.content.data);
    return readDataString(data, ["notification_name", "notificationName"]);
}

function extractNotificationType(notification: Notifications.Notification | null): string | undefined {
    const data = toRecord(notification?.request.content.data);
    const fromData = readDataString(data, ["notification_type", "notificationType", "type"]);
    if (fromData) {
        return fromData;
    }

    return toNonEmptyString(notification?.request.content.subtitle ?? null) ?? undefined;
}

function PushNotificationsBridge() {
    const router = useRouter();
    const rootNavigationState = useRootNavigationState();
    const { isLoggedIn } = useAuth();
    const { t } = useTranslation();

    const [banner, setBanner] = useState<PushBannerState | null>(null);
    const [pendingNotificationName, setPendingNotificationName] = useState<string | null>(null);
    const lastHandledResponseId = useRef<string | null>(null);

    const navigateToNotification = useCallback(
        async (notificationName: string) => {
            try {
                await markNotificationAsRead(notificationName);
            } catch (error) {
                console.error("Failed to mark push notification as read:", error);
            }

            router.push(`/(app)/notification/${encodeURIComponent(notificationName)}` as any);
        },
        [router]
    );

    const openFromNotification = useCallback(
        (notification: Notifications.Notification | null) => {
            const notificationName = extractNotificationName(notification);
            if (!notificationName) {
                return;
            }

            setBanner(null);

            if (!isLoggedIn) {
                setPendingNotificationName(notificationName);
                return;
            }

            void navigateToNotification(notificationName);
        },
        [isLoggedIn, navigateToNotification]
    );

    useEffect(() => {
        if (!isLoggedIn || !pendingNotificationName) {
            return;
        }

        void navigateToNotification(pendingNotificationName);
        setPendingNotificationName(null);
    }, [isLoggedIn, navigateToNotification, pendingNotificationName]);

    useEffect(() => {
        const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
            const identifier = notification.request.identifier || `${Date.now()}`;
            const title =
                toNonEmptyString(notification.request.content.title) ||
                t.notifications?.title ||
                "Notification";
            const message = toNonEmptyString(notification.request.content.body) || "";

            setBanner({
                identifier,
                title,
                message,
                type: extractNotificationType(notification),
                notificationName: extractNotificationName(notification),
            });
        });

        const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
            const responseId = `${response.actionIdentifier}:${response.notification.request.identifier}`;
            if (responseId === lastHandledResponseId.current) {
                return;
            }

            lastHandledResponseId.current = responseId;
            openFromNotification(response.notification);
        });

        return () => {
            receivedSubscription.remove();
            responseSubscription.remove();
        };
    }, [openFromNotification, t.notifications?.title]);

    useEffect(() => {
        if (!rootNavigationState?.key) {
            return;
        }

        let isMounted = true;

        Notifications.getLastNotificationResponseAsync()
            .then((response) => {
                if (!isMounted || !response) {
                    return;
                }

                const responseId = `${response.actionIdentifier}:${response.notification.request.identifier}`;
                if (responseId === lastHandledResponseId.current) {
                    return;
                }

                lastHandledResponseId.current = responseId;
                openFromNotification(response.notification);
            })
            .catch((error) => {
                console.error("Failed to read last notification response:", error);
            });

        return () => {
            isMounted = false;
        };
    }, [openFromNotification, rootNavigationState?.key]);

    const handleDismissBanner = useCallback(() => {
        setBanner(null);
    }, []);

    const handlePressBanner = useCallback(() => {
        if (!banner?.notificationName) {
            setBanner(null);
            return;
        }

        setBanner(null);

        if (!isLoggedIn) {
            setPendingNotificationName(banner.notificationName);
            return;
        }

        void navigateToNotification(banner.notificationName);
    }, [banner, isLoggedIn, navigateToNotification]);

    return (
        <InAppNotificationBanner
            visible={!!banner}
            title={banner?.title || t.notifications?.title || "Notification"}
            message={banner?.message}
            type={banner?.type}
            onDismiss={handleDismissBanner}
            onPress={handlePressBanner}
        />
    );
}

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <AuthProvider>
                    <StatusBar style="dark" />
                    <Slot />
                    <PushNotificationsBridge />
                </AuthProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
