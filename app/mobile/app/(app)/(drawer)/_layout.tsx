import { Drawer } from "expo-router/drawer";
import Sidebar from "../../../components/navigation/Sidebar";
import { COLORS } from "../../../constants/theme";

function DrawerContent(props: any) {
    const isOpen = !!props.state?.history?.some(
        (entry: any) => entry?.type === "drawer" && entry?.status === "open"
    );
    return (
        <Sidebar
            navigation={props.navigation}
            onClose={() => props.navigation.closeDrawer()}
            isOpen={isOpen}
        />
    );
}

export default function DrawerLayout() {
    return (
        <Drawer
            drawerContent={(props) => <DrawerContent {...props} />}
            screenOptions={{
                headerShown: false,
                drawerType: "front",
                drawerStyle: {
                    width: 300,
                    backgroundColor: COLORS.bgLight,
                },
                overlayColor: "rgba(9, 30, 66, 0.4)",
            }}
        >
            <Drawer.Screen name="dashboard" />
            <Drawer.Screen name="index" />
            <Drawer.Screen name="ledger" />
            <Drawer.Screen name="map" />
            <Drawer.Screen name="logs" />
        </Drawer>
    );
}
