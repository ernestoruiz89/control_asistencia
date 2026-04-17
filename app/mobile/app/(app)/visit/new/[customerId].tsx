import { MaterialIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "../../../../lib/i18n";
import { recordCustomerVisit, getCustomerInfo, getActiveShift, openShift } from "../../../../lib/api";

type VisitReason = "promise" | "not_found" | "agreement" | "notification";

const TYPE_MAPPING: Record<VisitReason, string> = {
    promise: "Payment Promise",
    agreement: "Agreement",
    notification: "Notification",
    not_found: "Not Found",
};

export default function VisitRegistration() {
    const { customerId } = useLocalSearchParams();
    const router = useRouter();
    const { t } = useTranslation();

    const [customerName, setCustomerName] = useState("");
    const [reason, setReason] = useState<VisitReason>("promise");
    const [managementDate, setManagementDate] = useState(new Date().toISOString().split('T')[0]);
    const [commitmentDate, setCommitmentDate] = useState("");
    const [amount, setAmount] = useState("");
    const [comment, setComment] = useState("");
    const [attachment, setAttachment] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [hasActiveShift, setHasActiveShift] = useState(false);
    const [isOpeningShift, setIsOpeningShift] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const shiftRes = await getActiveShift();
            const hasShift = shiftRes.status === "success" && shiftRes.data !== null;
            setHasActiveShift(hasShift);

            if (hasShift && customerId) {
                const res = await getCustomerInfo(customerId as string);
                if (res.status === "success") {
                    setCustomerName(res.data.customer_name);
                }
            }
        } catch (err) {
            console.error("Error fetching customer", err);
        } finally {
            setLoading(false);
            setIsOpeningShift(false);
        }
    }, [customerId]);

    useEffect(() => {
        load();
    }, [load]);

    const handleOpenShift = async () => {
        try {
            setIsOpeningShift(true);
            const res = await openShift();
            if (res.status === "success") {
                load();
            } else {
                console.error("Open shift failed", res.message);
                setIsOpeningShift(false);
            }
        } catch (e) {
            console.error("Open shift error", e);
            setIsOpeningShift(false);
        }
    };

    const reasons: { key: VisitReason; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
        { key: "promise", label: t.visit.promise, icon: "event-repeat" },
        { key: "not_found", label: t.visit.not_found, icon: "person-off" },
        { key: "agreement", label: t.visit.agreement, icon: "handshake" },
        { key: "notification", label: t.visit.notification, icon: "assignment" },
    ];

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true,
            });

            if (!result.canceled) {
                setAttachment(result.assets[0]);
            }
        } catch (err) {
            console.error("Error picking document:", err);
        }
    };

    const handleSave = async () => {
        if (!customerId) return;

        setSaving(true);
        try {
            // Get location
            let { status } = await Location.requestForegroundPermissionsAsync();
            let coords = null;
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                coords = location.coords;
            }

            const payload = {
                customer: customerId as string,
                visit_type: TYPE_MAPPING[reason],
                comments: comment,
                commitment_date: reason === "promise" ? commitmentDate : undefined,
                amount_to_pay: reason === "promise" ? parseFloat(amount) || 0 : undefined,
                latitude: coords?.latitude,
                longitude: coords?.longitude,
            };

            const res = await recordCustomerVisit(payload);
            if (res.status === "success") {
                Alert.alert(t.common.success, t.visit.saved_successfully);
                router.dismissAll();
                router.push("/(app)/(drawer)/ledger");
            } else {
                Alert.alert(t.common.error, res.message || "Error saving visit");
            }
        } catch (err: any) {
            Alert.alert(t.common.error, err.message || "Error saving visit");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-[#F4F5F7] items-center justify-center">
                <ActivityIndicator size="large" color="#5305c7" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-[#F4F5F7]">
            {/* Header */}
            <View className="bg-white pt-4 pb-6 px-6 border-b border-[#DFE1E6] flex-row items-center shadow-sm">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center bg-[#F4F5F7] rounded border border-[#DFE1E6] mr-4 active:bg-[#DFE1E6]"
                >
                    <MaterialIcons name="arrow-back" size={24} color="#091E42" />
                </TouchableOpacity>
                <View>
                    <Text className="text-[#091E42] font-bold text-lg uppercase tracking-wide">
                        {t.visit.title}
                    </Text>
                    <Text className="text-[#5E6C84] text-[10px] font-bold uppercase tracking-widest">
                        {customerName} • ID: {customerId}
                    </Text>
                </View>
            </View>

            {!hasActiveShift ? (
                <View className="flex-1 px-6 pt-8 items-center justify-center">
                    <View className="bg-[#FFFAE6] max-w-[400px] w-full rounded-xl p-6 shadow-sm border border-[#FFE380]">
                        <View className="flex-row items-center mb-4">
                            <MaterialIcons name="warning-amber" size={24} color="#FF8B00" />
                            <Text className="text-[#FF8B00] font-bold text-base ml-2 uppercase">
                                No Active Shift
                            </Text>
                        </View>
                        <Text className="text-[#5E6C84] text-xs font-bold leading-5 mb-5">
                            You must open a shift to record field visits.
                        </Text>
                        <TouchableOpacity
                            onPress={handleOpenShift}
                            disabled={isOpeningShift}
                            className="bg-[#0052CC] h-12 rounded-lg items-center justify-center flex-row shadow-sm active:bg-[#0747A6]"
                        >
                            {isOpeningShift ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <MaterialIcons name="play-arrow" size={20} color="white" />
                                    <Text className="text-white font-bold uppercase tracking-widest text-xs ml-2">
                                        Open Shift
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <>
                    <ScrollView className="flex-1 px-6 pt-8" showsVerticalScrollIndicator={false}>
                        {/* Reason Selection */}
                        <Text className="text-[#5E6C84] text-[10px] font-bold tracking-[0.2em] uppercase mb-4">
                            {t.visit.reason}
                        </Text>
                        <View className="flex-row flex-wrap gap-3 mb-8">
                            {reasons.map((item) => (
                                <TouchableOpacity
                                    key={item.key}
                                    onPress={() => {
                                        setReason(item.key);
                                        // Clear attachment if switching to reasons that don't need it (optional)
                                        if (item.key === "not_found" || item.key === "promise") {
                                            setAttachment(null);
                                        }
                                    }}
                                    className={`flex-1 min-w-[45%] h-24 rounded-lg border-2 items-center justify-center p-2 ${reason === item.key
                                        ? "bg-white border-[#5305c7] shadow-md"
                                        : "bg-white border-[#DFE1E6]"
                                        }`}
                                >
                                    <MaterialIcons
                                        name={item.icon}
                                        size={28}
                                        color={reason === item.key ? "#5305c7" : "#42526E"}
                                    />
                                    <Text
                                        className={`text-[10px] font-bold uppercase mt-2 text-center ${reason === item.key ? "text-[#5305c7]" : "text-[#42526E]"
                                            }`}
                                    >
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Conditional Fields for Promise */}
                        {reason === "promise" && (
                            <View className="mb-8">
                                <Text className="text-[#5E6C84] text-[10px] font-bold tracking-[0.2em] uppercase mb-4">
                                    {t.visit.promise_details}
                                </Text>
                                <View className="bg-white rounded-lg border border-[#DFE1E6] p-5 shadow-sm space-y-4">
                                    <View>
                                        <Text className="text-[10px] font-bold text-[#5E6C84] uppercase mb-1">{t.visit.management_date}</Text>
                                        <TextInput
                                            value={managementDate}
                                            onChangeText={setManagementDate}
                                            placeholder="YYYY-MM-DD"
                                            className="bg-[#F4F5F7] h-12 px-4 rounded border border-[#DFE1E6] text-[#091E42] font-mono text-sm"
                                        />
                                    </View>
                                    <View>
                                        <Text className="text-[10px] font-bold text-[#5E6C84] uppercase mb-1">{t.visit.commitment_date}</Text>
                                        <TextInput
                                            value={commitmentDate}
                                            onChangeText={setCommitmentDate}
                                            placeholder="YYYY-MM-DD"
                                            className="bg-[#F4F5F7] h-12 px-4 rounded border border-[#DFE1E6] text-[#091E42] font-mono text-sm"
                                        />
                                    </View>
                                    <View>
                                        <Text className="text-[10px] font-bold text-[#5E6C84] uppercase mb-1">{t.visit.amount_to_pay}</Text>
                                        <TextInput
                                            value={amount}
                                            onChangeText={setAmount}
                                            keyboardType="numeric"
                                            placeholder="$ 0.00"
                                            className="bg-[#F4F5F7] h-12 px-4 rounded border border-[#DFE1E6] text-[#091E42] font-mono text-sm"
                                        />
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Comment Field (for all) */}
                        <View className="mb-8">
                            <Text className="text-[#5E6C84] text-[10px] font-bold tracking-[0.2em] uppercase mb-4">
                                {t.visit.comment}
                            </Text>
                            <TextInput
                                value={comment}
                                onChangeText={setComment}
                                placeholder="..."
                                multiline
                                numberOfLines={4}
                                className="bg-white p-4 rounded-lg border border-[#DFE1E6] text-[#091E42] shadow-sm text-sm"
                                textAlignVertical="top"
                            />
                        </View>

                        {/* Attachment Section for Agreement or Notification */}
                        {(reason === "agreement" || reason === "notification") && (
                            <View className="mb-12">
                                <View className="flex-row items-center justify-between mb-4">
                                    <Text className="text-[#5E6C84] text-[10px] font-bold tracking-[0.2em] uppercase">
                                        {t.visit.attachments}
                                    </Text>
                                </View>

                                {!attachment ? (
                                    <TouchableOpacity
                                        onPress={pickDocument}
                                        className="bg-white rounded-lg border-2 border-dashed border-[#DFE1E6] p-8 items-center justify-center active:bg-[#F4F5F7]"
                                    >
                                        <View className="w-12 h-12 rounded-full bg-[#F4F5F7] items-center justify-center mb-3">
                                            <MaterialIcons name="cloud-upload" size={24} color="#0052CC" />
                                        </View>
                                        <Text className="text-[#091E42] font-bold text-xs">
                                            {t.visit.attach_document}
                                        </Text>
                                        <Text className="text-[#5E6C84] text-[10px] mt-1 uppercase font-bold tracking-tighter">
                                            PDF, JPG, PNG (Max 10MB)
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <View className="bg-white rounded-lg border border-[#DFE1E6] p-4 flex-row items-center justify-between shadow-sm">
                                        <View className="flex-row items-center flex-1 mr-3">
                                            <View className="w-10 h-10 bg-[#DEEBFF] rounded items-center justify-center mr-3">
                                                <MaterialIcons name="description" size={20} color="#0052CC" />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-[#091E42] text-xs font-bold" numberOfLines={1}>
                                                    {attachment.name}
                                                </Text>
                                                <Text className="text-[#5E6C84] text-[10px] uppercase font-bold">
                                                    {(attachment.size! / 1024 / 1024).toFixed(2)} MB
                                                </Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => setAttachment(null)}
                                            className="p-2 bg-[#FFEBE6] rounded items-center justify-center"
                                        >
                                            <MaterialIcons name="close" size={16} color="#BF2600" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>

                    {/* Save Button */}
                    <View className="p-6 bg-white border-t border-[#DFE1E6]">
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={saving}
                            className={`h-16 rounded-lg items-center justify-center shadow-lg active:scale-[0.98] ${saving ? "bg-[#DFE1E6]" : "bg-[#5305c7]"}`}
                        >
                            {saving ? (
                                <ActivityIndicator color="#5E6C84" />
                            ) : (
                                <Text className="text-white font-bold uppercase text-sm tracking-widest">
                                    {t.visit.save_visit}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </SafeAreaView>
    );
}
