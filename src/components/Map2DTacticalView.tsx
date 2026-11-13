import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMap,
  type MapCameraChangedEvent,
  type MapMouseEvent,
} from '@vis.gl/react-google-maps';
import Supercluster from 'supercluster';
import {
  CATEGORY_LABELS,
  SEVERITY_META,
  STATUS_LABELS,
  formatRemainingTtl,
  type CameraViewState,
  type Incident,
  type PendingPin,
} from '../types/incident.ts';

interface Map2DTacticalViewProps {
  camera: CameraViewState;
  incidents: Incident[];
  pendingPin: PendingPin | null;
  selectedIncident: Incident | null;
  onMapClick: (lat: number, lng: number, altitude: number) => void;
  onSelectIncident: (incident: Incident | null) => void;
  onSyncCenter: (lat: number, lng: number) => void;
}

interface IncidentFeatureProps {
  incidentId: number;
  severityRank: number;
}

interface IncidentPointFeature {
  type: 'Feature';
  properties: IncidentFeatureProps;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

interface ClusterFeatureProps {
  cluster: true;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated: string | number;
  maxSeverityRank?: number;
}

export function Map2DTacticalView({
  camera,
  incidents,
  pendingPin,
  selectedIncident,
  onMapClick,
  onSelectIncident,
  onSyncCenter,
}: Map2DTacticalViewProps) {
  const map = useMap('tactical-2d-map');
  const [zoom, setZoom] = useState<number>(15);
  const [bbox, setBbox] = useState<[number, number, number, number]>([
    -180, -85, 180, 85,
  ]);
  const [activeMarker, setActiveMarker] =
    useState<google.maps.marker.AdvancedMarkerElement | null>(null);

  const markerRefs = useMemo(
    () =>
      ({} as Record<
        number,
        google.maps.marker.AdvancedMarkerElement | null
      >),
    []
  );

  // Sync 2D center when user switches from 3D or jumps to a location
  useEffect(() => {
    if (!map) return;
    const current = map.getCenter();
    if (!current) return;
    const dLat = Math.abs(current.lat() - camera.center.lat);
    const dLng = Math.abs(current.lng() - camera.center.lng);
    if (dLat > 0.002 || dLng > 0.002) {
      map.panTo({ lat: camera.center.lat, lng: camera.center.lng });
    }
  }, [map, camera.center.lat, camera.center.lng]);

  // Build Supercluster spatial index for Phase 3 clustering
  const supercluster = useMemo(() => {
    const index = new Supercluster<
      IncidentFeatureProps,
      { maxSeverityRank: number }
    >({
      radius: 64,
      maxZoom: 18,
      map: (props) => ({ maxSeverityRank: props.severityRank }),
      reduce: (acc, props) => {
        if (props.maxSeverityRank > acc.maxSeverityRank) {
          acc.maxSeverityRank = props.maxSeverityRank;
        }
      },
    });

    const points: IncidentPointFeature[] = incidents.map((inc) => ({
      type: 'Feature',
      properties: {
        incidentId: inc.id,
        severityRank: SEVERITY_META[inc.severity].rank,
      },
      geometry: {
        type: 'Point',
        coordinates: [inc.longitude, inc.latitude],
      },
    }));

    index.load(points);
    return index;
  }, [incidents]);

  const incidentById = useMemo(() => {
    const lookup: Record<number, Incident> = {};
    for (const inc of incidents) {
      lookup[inc.id] = inc;
    }
    return lookup;
  }, [incidents]);

  const clusters = useMemo(() => {
    return supercluster.getClusters(bbox, Math.floor(zoom));
  }, [supercluster, bbox, zoom]);

  const handleCameraChanged = useCallback(
    (ev: MapCameraChangedEvent) => {
      setZoom(ev.detail.zoom);
      if (ev.detail.bounds) {
        setBbox([
          ev.detail.bounds.west,
          ev.detail.bounds.south,
          ev.detail.bounds.east,
          ev.detail.bounds.north,
        ]);
      }
      onSyncCenter(ev.detail.center.lat, ev.detail.center.lng);
    },
    [onSyncCenter]
  );

  const handleClick = useCallback(
    (ev: MapMouseEvent) => {
      const latLng = ev.detail.latLng;
      if (!latLng) return;
      onMapClick(latLng.lat, latLng.lng, 0);
    },
    [onMapClick]
  );

  useEffect(() => {
    if (!selectedIncident) {
      setActiveMarker(null);
      return;
    }
    setActiveMarker(markerRefs[selectedIncident.id] ?? null);
  }, [selectedIncident, markerRefs]);

  return (
    <div className="relative w-full h-full" style={{ height: '100%' }}>
      <GoogleMap
        id="tactical-2d-map"
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        defaultCenter={{ lat: camera.center.lat, lng: camera.center.lng }}
        defaultZoom={15}
        mapTypeId="hybrid"
        gestureHandling="greedy"
        disableDefaultUI={false}
        onCameraChanged={handleCameraChanged}
        onClick={handleClick}
        style={{ width: '100%', height: '100%' }}
      >
        {clusters.map((feature) => {
          const [lng, lat] = feature.geometry.coordinates;
          const props = feature.properties as
            | ClusterFeatureProps
            | IncidentFeatureProps;

          if ('cluster' in props && props.cluster) {
            const rank = props.maxSeverityRank ?? 1;
            const clusterColor =
              rank >= 4
                ? '#DC2626'
                : rank === 3
                  ? '#D97706'
                  : rank === 2
                    ? '#0284C7'
                    : '#059669';

            return (
              <AdvancedMarker
                key={`cluster-${props.cluster_id}`}
                position={{ lat, lng }}
                onClick={() => {
                  const expansionZoom = Math.min(
                    supercluster.getClusterExpansionZoom(props.cluster_id),
                    20
                  );
                  map?.setZoom(expansionZoom);
                  map?.panTo({ lat, lng });
                }}
              >
                <div
                  className="flex items-center justify-center rounded-full text-white font-mono text-xs font-semibold tabular-nums shadow-lg border-2 border-white/80 cursor-pointer transition-transform hover:scale-110"
                  style={{
                    width: `${Math.min(54, 34 + String(props.point_count).length * 6)}px`,
                    height: `${Math.min(54, 34 + String(props.point_count).length * 6)}px`,
                    backgroundColor: clusterColor,
                  }}
                  title={`${props.point_count} clustered incidents`}
                >
                  {props.point_count_abbreviated}
                </div>
              </AdvancedMarker>
            );
          }

          const incident = incidentById[(props as IncidentFeatureProps).incidentId];
          if (!incident) return null;
          const sev = SEVERITY_META[incident.severity];

          return (
            <AdvancedMarker
              key={`inc-${incident.id}`}
              ref={(el) => {
                markerRefs[incident.id] = el;
              }}
              position={{ lat: incident.latitude, lng: incident.longitude }}
              title={`${sev.label}: ${incident.title}`}
              onClick={() => {
                setActiveMarker(markerRefs[incident.id] ?? null);
                onSelectIncident(incident);
              }}
            >
              <Pin
                background={sev.pinBg}
                borderColor={sev.pinBorder}
                glyphColor="#FFFFFF"
                scale={selectedIncident?.id === incident.id ? 1.25 : 1.0}
              />
            </AdvancedMarker>
          );
        })}

        {pendingPin && (
          <AdvancedMarker
            position={{ lat: pendingPin.lat, lng: pendingPin.lng }}
            title="New Incident Location"
          >
            <Pin
              background="#2563EB"
              borderColor="#1E3A8A"
              glyphColor="#FFFFFF"
              scale={1.2}
              glyphText="+"
            />
          </AdvancedMarker>
        )}

        {selectedIncident && (
          <InfoWindow
            anchor={activeMarker}
            position={
              activeMarker
                ? undefined
                : {
                    lat: selectedIncident.latitude,
                    lng: selectedIncident.longitude,
                  }
            }
            onCloseClick={() => onSelectIncident(null)}
          >
            <div className="min-w-[220px] max-w-[280px] text-slate-900 p-1">
              <div className="text-xs font-medium text-slate-500 mb-1">
                {SEVERITY_META[selectedIncident.severity].label} ·{' '}
                {CATEGORY_LABELS[selectedIncident.category]} ·{' '}
                {STATUS_LABELS[selectedIncident.status]}
              </div>
              <h4 className="font-semibold text-sm text-slate-950 mb-1">
                {selectedIncident.title}
              </h4>
              <p className="text-xs text-slate-600 mb-1.5">
                {selectedIncident.formattedAddress}
              </p>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200">
                <span>
                  {selectedIncident.latitude.toFixed(5)},{' '}
                  {selectedIncident.longitude.toFixed(5)}
                </span>
                <span>{formatRemainingTtl(selectedIncident.expiresAt)}</span>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
