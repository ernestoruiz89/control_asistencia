import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../lib/AuthContext";

export default function AppLayout() {
    const { isLoggedIn, isLoading } = useAuth();

    if (isLoading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F5F7' }}>
                <ActivityIndicator size="large" color="#0052CC" />
            </View>
        );
    }

    if (!isLoggedIn) {
        return <Redirect href="/login" />;
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(drawer)" />
                <Stack.Screen name="customer/[id]" />
                <Stack.Screen name="customer-info/[id]" />
                <Stack.Screen name="loan-info/[id]" />
                <Stack.Screen name="payment/[loanId]" />
                <Stack.Screen name="receipt/[id]" />
                <Stack.Screen name="shift/[id]" />
                <Stack.Screen name="close-shift" />
                <Stack.Screen name="visit/[id]" />
                <Stack.Screen name="visit/new/[customerId]" />
                <Stack.Screen name="notification/[id]" />
            </Stack>
        </View>
    );
}
