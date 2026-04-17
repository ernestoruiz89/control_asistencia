import React, { Suspense, lazy } from "react";
import LazyScreenFallback from "../../../components/common/LazyScreenFallback";

const DailyLedgerScreen = lazy(() => import("../../../screens/heavy/DailyLedgerScreen"));

export default function DailyLedgerRoute() {
    return (
        <Suspense fallback={<LazyScreenFallback />}>
            <DailyLedgerScreen />
        </Suspense>
    );
}
