import React, { Suspense, lazy } from "react";
import LazyScreenFallback from "../../../components/common/LazyScreenFallback";

const MapScreen = lazy(() => import("../../../screens/heavy/MapScreen"));

export default function MapRoute() {
    return (
        <Suspense fallback={<LazyScreenFallback />}>
            <MapScreen />
        </Suspense>
    );
}
