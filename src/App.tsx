import React, { useCallback, useEffect, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { Map3DViewport } from './components/Map3DViewport.tsx';
import { Map2DTacticalView } from './components/Map2DTacticalView.tsx';
import { CameraHudOverlay } from './components/CameraHudOverlay.tsx';
import {
  IncidentSidebar,
  type SidebarTab,
} from './components/IncidentSidebar.tsx';
import type {
  CameraViewState,
  Incident,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  PendingPin,
} from './types/incident.ts';

const INITIAL_CAMERA: CameraViewState = {
  center: { lat: 37.7897, lng: -122.3942, altitude: 60 },
  range: 1650,
  heading: 24,
  tilt: 64,
  roll: 0,
};

function detectWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGL2RenderingContext && canvas.getContext('webgl2')
    );
  } catch {
    return false;
  }
}

function IncidentWorkspace({ apiKey }: { apiKey: string }) {
  const { user, getToken, signInWithGoogle } = useAuth();
  const [viewDimension, setViewDimension] = useState<'3d' | '2d'>('3d');
  const [webglSupported] = useState<boolean>(() => detectWebGL2());
  const [mapMode, setMapMode] = useState<'SATELLITE' | 'HYBRID'>('HYBRID');

  const [camera, setCamera] = useState<CameraViewState>(INITIAL_CAMERA);
  const [flyToRequest, setFlyToRequest] = useState<{
    id: number;
    camera: CameraViewState;
    orbit?: boolean;
  } | null>(null);
  const flySeqRef = useRef(0);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<SidebarTab>('incidents');
  const [isPinningMode, setIsPinningMode] = useState(false);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [incidentsError, setIncidentsError] = useState<string | null>(null);

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(
    null
  );
  const [pendingPin, setPendingPin] = useState<PendingPin | null>(null);

  const triggerFlyTo = useCallback(
    (nextCamera: CameraViewState, orbit = false) => {
      flySeqRef.current += 1;
      setCamera(nextCamera);
      setFlyToRequest({
        id: flySeqRef.current,
        camera: nextCamera,
        orbit,
      });
    },
    []
  );

  const loadIncidents = useCallback(async () => {
    if (!user) {
      setIncidents([]);
      setIncidentsError(null);
      return;
    }

    setLoadingIncidents(true);
    setIncidentsError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch('/api/incidents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to load incidents.');
      }
      const data = (await res.json()) as { incidents: Incident[] };
      setIncidents(data.incidents || []);
    } catch (err) {
      setIncidentsError(
        err instanceof Error ? err.message : 'Unable to fetch incidents.'
      );
    } finally {
      setLoadingIncidents(false);
    }
  }, [user, getToken]);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  const handleMapClick = useCallback(
    async (lat: number, lng: number, altitude: number) => {
      setSelectedIncident(null);
      setIsPinningMode(false);
      setSidebarOpen(true);
      setActiveTab('report');

      setPendingPin({
        lat,
        lng,
        altitude,
        formattedAddress: 'Resolving street address...',
        placeId: null,
        isGeocoding: true,
        geocodeError: null,
      });

      try {
        const res = await fetch(
          `/api/geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
        );
        if (res.status === 429) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          setPendingPin((prev) =>
            prev
              ? {
                  ...prev,
                  formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                  isGeocoding: false,
                  geocodeError: 'Geocoding quota reached; using coordinates.',
                }
              : null
          );
          return;
        }
        const data = (await res.json()) as {
          formattedAddress?: string;
          placeId?: string | null;
          error?: string;
          status?: string;
        };
        if (data.status === 'RESOURCE_EXHAUSTED') {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          setPendingPin((prev) =>
            prev
              ? {
                  ...prev,
                  formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                  isGeocoding: false,
                  geocodeError: 'Geocoding quota reached; using coordinates.',
                }
              : null
          );
          return;
        }
        if (!res.ok) {
          throw new Error(data.error || 'Reverse geocoding failed.');
        }

        setPendingPin((prev) =>
          prev
            ? {
                ...prev,
                formattedAddress:
                  data.formattedAddress ||
                  `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                placeId: data.placeId ?? null,
                isGeocoding: false,
                geocodeError: null,
              }
            : null
        );
      } catch (err) {
        setPendingPin((prev) =>
          prev
            ? {
                ...prev,
                formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                isGeocoding: false,
                geocodeError:
                  err instanceof Error
                    ? err.message
                    : 'Reverse geocoding unavailable.',
              }
            : null
        );
      }
    },
    []
  );

  const handleSubmitIncident = useCallback(
    async (payload: {
      title: string;
      description: string;
      category: IncidentCategory;
      severity: IncidentSeverity;
    }): Promise<boolean> => {
      if (!pendingPin) return false;
      const token = await getToken();
      if (!token) return false;

      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...payload,
          latitude: pendingPin.lat,
          longitude: pendingPin.lng,
          altitude: pendingPin.altitude,
          formattedAddress: pendingPin.formattedAddress,
          placeId: pendingPin.placeId,
        }),
      });

      if (!res.ok) {
        return false;
      }

      const data = (await res.json()) as { incident: Incident };
      setIncidents((prev) => [data.incident, ...prev]);
      setPendingPin(null);
      setSelectedIncident(data.incident);
      setActiveTab('incidents');
      return true;
    },
    [pendingPin, getToken]
  );

  const handleUpdateStatus = useCallback(
    async (id: number, status: IncidentStatus) => {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/incidents/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return;
      setIncidents((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status } : item))
      );
      setSelectedIncident((prev) =>
        prev && prev.id === id ? { ...prev, status } : prev
      );
    },
    [getToken]
  );

  const handleDeleteIncident = useCallback(
    async (id: number) => {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/incidents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setIncidents((prev) => prev.filter((item) => item.id !== id));
      setSelectedIncident((prev) => (prev?.id === id ? null : prev));
    },
    [getToken]
  );

  const handleFlyToPreset = useCallback(
    (preset: 'aerial' | 'oblique' | 'nadir' | 'orbit') => {
      if (preset === 'aerial') {
        triggerFlyTo({
          ...camera,
          tilt: 45,
          range: 2200,
          roll: 0,
        });
      } else if (preset === 'oblique') {
        triggerFlyTo({
          ...camera,
          tilt: 68,
          range: 850,
          roll: 0,
        });
      } else if (preset === 'nadir') {
        triggerFlyTo({
          ...camera,
          tilt: 0,
          range: 1600,
          heading: 0,
          roll: 0,
        });
      } else {
        triggerFlyTo(
          {
            ...camera,
            tilt: Math.max(45, camera.tilt),
            range: Math.min(1200, camera.range),
          },
          true
        );
      }
    },
    [camera, triggerFlyTo]
  );

  const handleAdjustCamera = useCallback(
    (patch: Partial<Pick<CameraViewState, 'tilt' | 'heading' | 'range'>>) => {
      triggerFlyTo({
        ...camera,
        ...patch,
      });
    },
    [camera, triggerFlyTo]
  );

  const handleFlyToCoordinates = useCallback(
    (lat: number, lng: number) => {
      triggerFlyTo({
        center: { lat, lng, altitude: 50 },
        range: 1350,
        heading: camera.heading,
        tilt: 64,
        roll: 0,
      });
    },
    [camera.heading, triggerFlyTo]
  );

  const handleFlyToIncident = useCallback(
    (incident: Incident, orbit = false) => {
      setSelectedIncident(incident);
      if (viewDimension === '2d') {
        setCamera((prev) => ({
          ...prev,
          center: {
            lat: incident.latitude,
            lng: incident.longitude,
            altitude: incident.altitude,
          },
        }));
      } else {
        triggerFlyTo(
          {
            center: {
              lat: incident.latitude,
              lng: incident.longitude,
              altitude: Math.max(30, incident.altitude),
            },
            range: orbit ? 650 : 750,
            heading: camera.heading,
            tilt: 65,
            roll: 0,
          },
          orbit
        );
      }
    },
    [camera.heading, triggerFlyTo, viewDimension]
  );

  const handlePrimaryAction = () => {
    if (!user && !pendingPin) {
      void signInWithGoogle();
      return;
    }
    setSidebarOpen(true);
    setActiveTab('report');
    setIsPinningMode(true);
  };

  const render3D = viewDimension === '3d' && webglSupported;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Three-Zone Top Bar Contract */}
      <header className="absolute top-0 left-0 right-0 h-14 z-30 bg-slate-950/90 backdrop-blur-md border-b border-white/10 px-6 flex items-center justify-between gap-8">
        <span
          className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          TerrainPulse 3D
        </span>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => setViewDimension('3d')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              viewDimension === '3d'
                ? 'text-white underline underline-offset-8 decoration-blue-500 decoration-2'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            3D Terrain
          </button>
          <button
            type="button"
            onClick={() => setViewDimension('2d')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              viewDimension === '2d'
                ? 'text-white underline underline-offset-8 decoration-blue-500 decoration-2'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            2D Clusters
          </button>
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(true);
              setActiveTab('incidents');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              sidebarOpen && activeTab === 'incidents'
                ? 'text-white underline underline-offset-8 decoration-blue-500 decoration-2'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Incident Log
          </button>
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(true);
              setActiveTab('alerts');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              sidebarOpen && activeTab === 'alerts'
                ? 'text-white underline underline-offset-8 decoration-blue-500 decoration-2'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Alert Feed
          </button>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={handlePrimaryAction}
            className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {user ? 'Report Incident' : 'Sign In'}
          </button>
        </div>
      </header>

      {/* Main Full-Viewport 3D / 2D Spatial Canvas */}
      <main
        className={`w-full h-full pt-14 ${isPinningMode ? 'cursor-crosshair' : ''}`}
        style={{ height: '100vh' }}
      >
        {render3D ? (
          <Map3DViewport
            camera={camera}
            flyToRequest={flyToRequest}
            mapMode={mapMode}
            incidents={incidents}
            pendingPin={pendingPin}
            selectedIncident={selectedIncident}
            onCameraChange={setCamera}
            onMapClick={handleMapClick}
            onSelectIncident={setSelectedIncident}
          />
        ) : (
          <Map2DTacticalView
            camera={camera}
            incidents={incidents}
            pendingPin={pendingPin}
            selectedIncident={selectedIncident}
            onMapClick={handleMapClick}
            onSelectIncident={setSelectedIncident}
            onSyncCenter={(lat, lng) =>
              setCamera((prev) => ({
                ...prev,
                center: { ...prev.center, lat, lng },
              }))
            }
          />
        )}
      </main>

      <CameraHudOverlay
        viewDimension={viewDimension}
        webglSupported={webglSupported}
        mapMode={mapMode}
        camera={camera}
        isPinningMode={isPinningMode}
        onToggleMapMode={() =>
          setMapMode((m) => (m === 'HYBRID' ? 'SATELLITE' : 'HYBRID'))
        }
        onTogglePinningMode={() => setIsPinningMode((v) => !v)}
        onFlyToPreset={handleFlyToPreset}
        onAdjustCamera={handleAdjustCamera}
        onFlyToCoordinates={handleFlyToCoordinates}
      />

      <IncidentSidebar
        isOpen={sidebarOpen}
        activeTab={activeTab}
        incidents={incidents}
        loadingIncidents={loadingIncidents}
        incidentsError={incidentsError}
        pendingPin={pendingPin}
        selectedIncident={selectedIncident}
        onClose={() => setSidebarOpen(false)}
        onChangeTab={setActiveTab}
        onClearPendingPin={() => setPendingPin(null)}
        onEnablePinMode={() => setIsPinningMode(true)}
        onSubmitIncident={handleSubmitIncident}
        onUpdateStatus={handleUpdateStatus}
        onDeleteIncident={handleDeleteIncident}
        onFlyToIncident={handleFlyToIncident}
        onRetryLoad={() => void loadIncidents()}
      />
    </div>
  );
}

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [apiKey, setApiKey] = useState<string>(
    () => import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [loadingKey, setLoadingKey] = useState(!apiKey);

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  useEffect(() => {
    if (apiKey) {
      setLoadingKey(false);
      return;
    }
    let cancelled = false;
    fetch('/api/maps-config')
      .then((res) => res.json())
      .then((data: { apiKey?: string }) => {
        if (!cancelled && data.apiKey) {
          setApiKey(data.apiKey);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingKey(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  return (
    <AuthProvider>
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {loadingKey ? (
        <div className="w-screen h-screen bg-slate-950 text-slate-300 flex items-center justify-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span>Initializing 3D spatial workspace...</span>
        </div>
      ) : !apiKey ? (
        <div className="w-screen h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
          <div className="max-w-md border border-white/10 rounded-lg p-6 bg-slate-900/60 text-center space-y-2">
            <h1 className="text-base font-semibold text-white">
              Google Maps API Key Unavailable
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Configure a Google Maps Platform key in your environment to render
              Photorealistic 3D Tiles and Interactive Maps.
            </p>
          </div>
        </div>
      ) : (
        <APIProvider
          apiKey={apiKey}
          version="beta"
          libraries={['maps3d', 'marker']}
          language="en"
          region="US"
        >
          <IncidentWorkspace apiKey={apiKey} />
        </APIProvider>
      )}
    </AuthProvider>
  );
}
