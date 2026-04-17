import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../lib/AuthContext";
import { getSiteUrl } from "../lib/auth";
import { useTranslation } from "../lib/i18n";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { ALLOWED_INSECURE_HOSTS, DEFAULT_SITE_URL } from "../lib/config";


export default function LoginScreen() {
    const { login, isLoggedIn } = useAuth();
    const { t } = useTranslation();
    const router = useRouter();

    if (isLoggedIn) {
        return <Redirect href="/(app)/(drawer)" />;
    }

    const [siteUrl, setSiteUrl] = useState(DEFAULT_SITE_URL);

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadSiteUrl = async () => {
            const savedUrl = await getSiteUrl();
            if (savedUrl) {
                setSiteUrl(savedUrl);
            }
        };
        loadSiteUrl();
    }, []);

    async function handleLogin() {
        setError(null);

        if (!username.trim() || !password.trim()) {
            setError(t.login.username_password_required);
            return;
        }

        let url = siteUrl.trim() || DEFAULT_SITE_URL;

        // Ensure protocol
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = `https://${url}`;
        }

        // Security check: Force HTTPS unless it's a known local development host
        if (url.startsWith("http://")) {
            const host = url.replace("http://", "").split("/")[0].split(":")[0];
            if (!ALLOWED_INSECURE_HOSTS.includes(host)) {
                setError(t.login.https_required || "Se requiere una conexión segura (HTTPS)");
                return;
            }
        }


        setLoading(true);
        let result = await login(url, username.trim(), password);
        setLoading(false);

        if (!result.success) {
            setError(result.error || t.login.auth_failed);
        } else {
            router.replace("/(app)/(drawer)");
        }
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F4F5F7' }}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1 bg-[#F4F5F7]"
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View className="flex-1 px-6 pt-6 pb-12">
                        {/* Branding */}
                        <View className="items-center mb-4">
                            <View className="bg-[#5305c7] w-16 h-16 rounded-xl items-center justify-center mb-4 shadow-sm">
                                <MaterialIcons name="route" size={32} color="white" />
                            </View>
                            <Text className="text-[#5E6C84] text-xs font-bold tracking-[0.2em] uppercase mb-1">
                                Field Ops
                            </Text>
                            <Text className="text-[#091E42] text-2xl font-bold tracking-tight">
                                Terminal
                            </Text>
                        </View>

                        {/* Login Card */}
                        <View className="bg-white rounded-lg border border-[#DFE1E6] p-6 shadow-sm">
                            <View className="mb-6">
                                <Text className="text-[#091E42] text-sm font-bold uppercase tracking-wide">
                                    {t.login.standard_access}
                                </Text>
                            </View>

                            {error && (
                                <View className="bg-[#FFEBE6] border border-[#DE350B] p-4 rounded mb-6 flex-row items-center gap-3">
                                    <MaterialIcons name="error-outline" size={20} color="#DE350B" />
                                    <Text className="text-[#DE350B] text-xs font-bold flex-1">{error}</Text>
                                </View>
                            )}

                            {/* Site URL */}
                            <View className="mb-5">
                                <Text className="text-[#5E6C84] text-xs font-bold uppercase tracking-wider mb-2">
                                    {t.login.site_url}
                                </Text>
                                <View className="flex-row items-center bg-[#F4F5F7] border border-[#DFE1E6] rounded px-4 h-12">
                                    <MaterialIcons name="dns" size={18} color="#5E6C84" />
                                    <TextInput
                                        className="flex-1 text-[#091E42] ml-3 text-sm"
                                        placeholder={DEFAULT_SITE_URL}

                                        placeholderTextColor="#A5ADBA"
                                        value={siteUrl}
                                        onChangeText={setSiteUrl}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        keyboardType="url"
                                    />
                                </View>
                            </View>

                            {/* Username */}
                            <View className="mb-5">
                                <Text className="text-[#5E6C84] text-xs font-bold uppercase tracking-wider mb-2">
                                    {t.login.username}
                                </Text>
                                <View className="flex-row items-center bg-[#F4F5F7] border border-[#DFE1E6] rounded px-4 h-12">
                                    <MaterialIcons name="person" size={18} color="#5E6C84" />
                                    <TextInput
                                        className="flex-1 text-[#091E42] ml-3 text-sm"
                                        placeholder="email@example.com"
                                        placeholderTextColor="#A5ADBA"
                                        value={username}
                                        onChangeText={setUsername}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        keyboardType="email-address"
                                    />
                                </View>
                            </View>

                            {/* Password */}
                            <View className="mb-8">
                                <Text className="text-[#5E6C84] text-xs font-bold uppercase tracking-wider mb-2">
                                    {t.login.password}
                                </Text>
                                <View className="flex-row items-center bg-[#F4F5F7] border border-[#DFE1E6] rounded px-4 h-12">
                                    <MaterialIcons name="lock" size={18} color="#5E6C84" />
                                    <TextInput
                                        className="flex-1 text-[#091E42] ml-3 text-sm"
                                        placeholder="••••••••"
                                        placeholderTextColor="#A5ADBA"
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        <MaterialIcons
                                            name={showPassword ? "visibility" : "visibility-off"}
                                            size={18}
                                            color="#5E6C84"
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Login Button */}
                            <TouchableOpacity
                                className="bg-[#5305c7] h-14 rounded items-center justify-center flex-row shadow-sm active:translate-y-px"
                                onPress={handleLogin}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <MaterialIcons name="login" size={20} color="white" />
                                        <Text className="text-white font-bold text-base uppercase tracking-wider ml-2">
                                            {t.login.authenticate}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Footer */}
                        <View className="items-center mt-12">
                            <Text className="text-[#5E6C84] text-xs font-bold tracking-widest uppercase">
                                {t.login.branding_footer}
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView >
    );
}
