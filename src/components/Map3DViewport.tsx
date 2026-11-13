import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AltitudeMode, Pin } from '@vis.gl/react-google-maps';
import {
  GestureHandling,
  Map3D,
  MapMode,
  Marker3D,
  Popover,
  type Map3DCameraChangedEvent,
  type Map3DClickEvent,
  type Map3DRef,
} from '@vis.gl/react-google-maps/3d';
import {
  CATEGORY_LABELS,
  SEVERITY_META,
  STATUS_LABELS,
  formatRemainingTtl,
  type CameraViewState,
  type Incident,
  type PendingPin,
} from '../types/incident.ts';

interface Map3DViewportProps {
  camera: CameraViewState;
  flyToRequest: {
    id: number;
    camera: CameraViewState;
    orbit?: boolean;
  } | null;
  mapMode: 'SATELLITE' | 'HYBRID';
  incidents: Incident[];
  pendingPin: PendingPin | null;
  selectedIncident: Incident | null;
  onCameraChange: (next: CameraViewState) => void;
  onMapClick: (lat: number, lng: number, altitude: number) => void;
  onSelectIncident: (incident: Incident | null) => void;
}

export function Map3DViewport({
  camera,
  flyToRequest,
  mapMode,
  incidents,
  pendingPin,
  selectedIncident,
  onCameraChange,
  onMapClick,
  onSelectIncident,
}: Map3DViewportProps) {
  const map3dRef = useRef<Map3DRef | null>(null);
  const [markerElements, setMarkerElements] = useState<
    Record<number, google.maps.maps3d.Marker3DInteractiveElement | null>
  >({});

  // Apply mandatory internal usage attribution ID on underlying Map3DElement
  useEffect(() => {
    const el = map3dRef.current?.map3d as
      | (google.maps.maps3d.Map3DElement & {
          internalUsageAttributionIds?: string[];
        })
      | null
      | undefined;
    if (el) {
      el.internalUsageAttributionIds = ['gmp_mcp_codeassist_v1_aistudio'];
    }
  }, []);

  // Execute smooth camera transitions on preset, search, or incident selection
  useEffect(() => {
    if (!flyToRequest || !map3dRef.current) return;
    const { camera: target, orbit } = flyToRequest;

    if (orbit) {
      map3dRef.current.flyCameraAround({
        camera: {
          center: target.center,
          range: target.range,
          tilt: target.tilt,
          heading: target.heading,
          roll: target.roll,
        },
        durationMillis: 9000,
        rounds: 1,
      });
    } else {
      map3dRef.current.flyCameraTo({
        endCamera: {
          center: target.center,
          range: target.range,
          tilt: target.tilt,
          heading: target.heading,
          roll: target.roll,
        },
        durationMillis: 1100,
      });
    }
  }, [flyToRequest]);

  const handleCameraChanged = useCallback(
    (ev: Map3DCameraChangedEvent) => {
      onCameraChange({
        center: {
          lat: ev.detail.center.lat,
          lng: ev.detail.center.lng,
          altitude: ev.detail.center.altitude ?? 0,
        },
        range: ev.detail.range,
        heading: ev.detail.heading,
        tilt: ev.detail.tilt,
        roll: ev.detail.roll,
      });
    },
    [onCameraChange]
  );

  const handleMapClick = useCallback(
    (ev: Map3DClickEvent) => {
      const pos = ev.detail.position;
      if (!pos) return;
      onMapClick(pos.lat, pos.lng, pos.altitude ?? 0);
    },
    [onMapClick]
  );

  const setMarkerRef = useCallback(
    (id: number) =>
      (
        marker:
          | google.maps.maps3d.Marker3DElement
          | google.maps.maps3d.Marker3DInteractiveElement
          | null
      ) => {
        setMarkerElements((prev) => {
          const interactive =
            marker && 'addEventListener' in marker
              ? (marker as google.maps.maps3d.Marker3DInteractiveElement)
              : null;
          if (prev[id] === interactive) return prev;
          return { ...prev, [id]: interactive };
        });
      },
    []
  );

  const selectedAnchor =
    selectedIncident && markerElements[selectedIncident.id]
      ? markerElements[selectedIncident.id]
      : null;

  return (
    <div className="relative w-full h-full" style={{ height: '100%' }}>
      <Map3D
        ref={map3dRef}
        mode={mapMode === 'HYBRID' ? MapMode.HYBRID : MapMode.SATELLITE}
        gestureHandling={GestureHandling.GREEDY}
        defaultCenter={camera.center}
        defaultRange={camera.range}
        defaultHeading={camera.heading}
        defaultTilt={camera.tilt}
        defaultRoll={camera.roll}
        onCameraChanged={handleCameraChanged}
        onClick={handleMapClick}
        style={{ width: '100%', height: '100%' }}
      >
        {incidents.map((incident) => {
          const sev = SEVERITY_META[incident.severity];
          return (
            <Marker3D
              key={incident.id}
              ref={setMarkerRef(incident.id)}
              position={{
                lat: incident.latitude,
                lng: incident.longitude,
                altitude: Math.max(18, incident.altitude + 18),
              }}
              altitudeMode={AltitudeMode.RELATIVE_TO_MESH}
              extruded
              title={`${sev.label}: ${incident.title}`}
              onClick={() => onSelectIncident(incident)}
            >
              <Pin
                background={sev.pinBg}
                borderColor={sev.pinBorder}
                glyphColor="#FFFFFF"
                scale={selectedIncident?.id === incident.id ? 1.25 : 1.0}
              />
            </Marker3D>
          );
        })}

        {pendingPin && (
          <Marker3D
            position={{
              lat: pendingPin.lat,
              lng: pendingPin.lng,
              altitude: Math.max(25, pendingPin.altitude + 25),
            }}
            altitudeMode={AltitudeMode.RELATIVE_TO_MESH}
            extruded
            label="New Report Pin"
          >
            <Pin
              background="#2563EB"
              borderColor="#1E3A8A"
              glyphColor="#FFFFFF"
              scale={1.25}
              glyphText="+"
            />
          </Marker3D>
        )}

        {selectedIncident && (
          <Popover
            open
            anchor={selectedAnchor}
            position={
              selectedAnchor
                ? undefined
                : {
                    lat: selectedIncident.latitude,
                    lng: selectedIncident.longitude,
                    altitude: Math.max(30, selectedIncident.altitude + 30),
                  }
            }
            altitudeMode={AltitudeMode.RELATIVE_TO_MESH}
            onClose={() => onSelectIncident(null)}
          >
            <div className="min-w-[240px] max-w-[300px] bg-slate-950 text-slate-100 p-3.5 rounded-lg border border-white/15 shadow-xl">
              <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
                <span
                  className={SEVERITY_META[selectedIncident.severity].textClass}
                >
                  {SEVERITY_META[selectedIncident.severity].label}
                </span>
                <span aria-hidden="true">·</span>
                <span>{CATEGORY_LABELS[selectedIncident.category]}</span>
                <span aria-hidden="true">·</span>
                <span>{STATUS_LABELS[selectedIncident.status]}</span>
              </div>
              <h4 className="font-semibold text-sm text-white leading-snug mb-1.5">
                {selectedIncident.title}
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mb-2">
                {selectedIncident.formattedAddress}
              </p>
              <div className="text-[11px] font-mono tabular-nums text-slate-400 border-t border-white/10 pt-2 flex items-center justify-between">
                <span>
                  {selectedIncident.latitude.toFixed(5)},{' '}
                  {selectedIncident.longitude.toFixed(5)}
                </span>
                <span>{formatRemainingTtl(selectedIncident.expiresAt)}</span>
              </div>
            </div>
          </Popover>
        )}
      </Map3D>
    </div>
  );
}
