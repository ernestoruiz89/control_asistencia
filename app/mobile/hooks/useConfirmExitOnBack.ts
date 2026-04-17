import { NavigationContext } from "@react-navigation/native";
import React from "react";
import { Alert, BackHandler, Platform } from "react-native";
import { useTranslation } from "../lib/i18n";

export function useConfirmExitOnBack() {
    useConfirmExitOnBackEnabled(true);
}

export function useConfirmExitOnBackEnabled(enabled: boolean = true) {
    const { t } = useTranslation();
    const navigation = React.useContext(NavigationContext);

    React.useEffect(() => {
        if (!enabled || Platform.OS !== "android") {
            return;
        }

        const registerBackHandler = () =>
            BackHandler.addEventListener("hardwareBackPress", () => {
                Alert.alert(
                    t.common.confirm || "Confirm",
                    t.common.exit_app_confirm || "Do you want to exit the app?",
                    [
                        { text: t.common.cancel || "Cancel", style: "cancel" },
                        {
                            text: t.common.yes || "Yes",
                            style: "destructive",
                            onPress: () => BackHandler.exitApp(),
                        },
                    ]
                );

                return true;
            });

        let backSubscription: { remove: () => void } | null = null;
        const attachIfFocused = () => {
            backSubscription?.remove();
            backSubscription = null;

            if (!navigation || navigation.isFocused?.()) {
                backSubscription = registerBackHandler();
            }
        };

        attachIfFocused();

        const unsubscribeFocus = navigation?.addListener?.("focus", attachIfFocused);
        const unsubscribeBlur = navigation?.addListener?.("blur", attachIfFocused);

        return () => {
            backSubscription?.remove();
            unsubscribeFocus?.();
            unsubscribeBlur?.();
        };
    }, [
        enabled,
        navigation,
        t.common.cancel,
        t.common.confirm,
        t.common.exit_app_confirm,
        t.common.yes,
    ]);
}
