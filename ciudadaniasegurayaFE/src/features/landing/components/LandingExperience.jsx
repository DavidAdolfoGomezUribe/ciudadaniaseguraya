"use client";

import { useCallback, useState } from "react";

import { AppBootLoader } from "@/components/feedback/AppBootLoader";
import { MapClientBoundary } from "@/features/map/components/MapClientBoundary";
import { StatisticsSection } from "@/features/statistics/components/StatisticsSection";

export function LandingExperience({ purpose }) {
  const [mapReady, setMapReady] = useState(false);
  const [statisticsReady, setStatisticsReady] = useState(false);
  const markMapReady = useCallback(() => setMapReady(true), []);
  const markStatisticsReady = useCallback(() => setStatisticsReady(true), []);

  return (
    <>
      <AppBootLoader mapReady={mapReady} statisticsReady={statisticsReady} />
      <section
        aria-labelledby="landing-title"
        className="page-grid grid min-h-[calc(100vh-var(--header-height))] gap-3 py-3 lg:[grid-template-columns:minmax(280px,1fr)_minmax(0,3fr)]"
      >
        <div>{purpose}</div>
        <div id="mapa-seguridad" className="landing-map min-w-0 lg:h-full">
          <MapClientBoundary onReady={markMapReady} />
        </div>
      </section>
      <StatisticsSection onReady={markStatisticsReady} />
    </>
  );
}
