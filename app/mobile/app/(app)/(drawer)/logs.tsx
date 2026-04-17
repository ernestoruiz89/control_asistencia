import React, { Suspense, lazy } from "react";
import LazyScreenFallback from "../../../components/common/LazyScreenFallback";

const ShiftHistoryScreen = lazy(() => import("../../../screens/heavy/ShiftHistoryScreen"));

export default function ShiftHistoryRoute() {
    return (
        <Suspense fallback={<LazyScreenFallback />}>
            <ShiftHistoryScreen />
        </Suspense>
    );
}
