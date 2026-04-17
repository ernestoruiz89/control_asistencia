import React, { Suspense, lazy } from "react";
import LazyScreenFallback from "../../../components/common/LazyScreenFallback";

const NotificationDetailScreen = lazy(() => import("../../../screens/heavy/NotificationDetailScreen"));

export default function NotificationDetailRoute() {
    return (
        <Suspense fallback={<LazyScreenFallback />}>
            <NotificationDetailScreen />
        </Suspense>
    );
}
