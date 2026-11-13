import React, { useState } from 'react';
import {
  Compass,
  Crosshair,
  Layers,
  MapPin,
  Orbit,
  Search,
} from 'lucide-react';
import type { CameraViewState } from '../types/incident.ts';

interface GeocodeSearchResult {
  formattedAddress: string;
  placeId: string | null;
  lat: number;
  lng: number;
}

interface CameraHudOverlayProps {
  viewDimension: '3d' | '2d';
  webglSupported: boolean;
  mapMode: 'SATELLITE' | 'HYBRID';
  camera: CameraViewState;
  isPinningMode: boolean;
  onToggleMapMode: () => void;
  onTogglePinningMode: () => void;
  onFlyToPreset: (
    preset: 'aerial' | 'oblique' | 'nadir' | 'orbit'
  ) => void;
  onAdjustCamera: (patch: Partial<Pick<CameraViewState, 'tilt' | 'heading' | 'range'>>) => void;
  onFlyToCoordinates: (lat: number, lng: number, label?: string) => void;
}

const QUICK_SECTORS = [
  { label: 'San Francisco', lat: 37.7897, lng: -122.3942 },
  { label: 'Manhattan', lat: 40.7484, lng: -73.9857 },
  { label: 'Seattle', lat: 47.6062, lng: -122.3321 },
];

export function CameraHudOverlay({
  viewDimension,
  webglSupported,
  mapMode,
  camera,
  isPinningMode,
  onToggleMapMode,
  onTogglePinningMode,
  onFlyToPreset,
  onAdjustCamera,
  onFlyToCoordinates,
}: CameraHudOverlayProps) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<GeocodeSearchResult[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `/api/geocode/search?address=${encodeURIComponent(trimmed)}`
      );
      if (res.status === 429) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        setSearchError('Geocoding quota reached.');
        return;
      }
      const data = (await res.json()) as {
        results?: GeocodeSearchResult[];
        error?: string;
        status?: string;
      };
      if (data.status === 'RESOURCE_EXHAUSTED') {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        setSearchError('Geocoding quota reached.');
        return;
      }
      if (!res.ok) {
        setSearchError(data.error || 'Address search failed.');
        return;
      }
      const found = data.results || [];
      setResults(found);
      if (found.length === 1) {
        onFlyToCoordinates(found[0].lat, found[0].lng, found[0].formattedAddress);
        setResults([]);
      } else if (found.length === 0) {
        setSearchError('No matching address found.');
      }
    } catch {
      setSearchError('Network error searching address.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <>
      {/* Top-Left Floating Location Jump & Pinning Control */}
      <div className="absolute top-16 left-4 z-10 w-[340px] max-w-[calc(100vw-2rem)] pointer-events-auto flex flex-col gap-2">
        <form
          onSubmit={handleSearch}
          className="flex items-center bg-slate-950/90 backdrop-blur-md border border-white/10 rounded-lg shadow-lg overflow-hidden"
        >
          <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (searchError) setSearchError(null);
            }}
            placeholder="Jump to address or landmark..."
            aria-label="Search location address"
            className="w-full bg-transparent px-2.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="px-3 py-2 text-xs font-medium text-blue-400 hover:text-blue-300 disabled:text-slate-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {searching ? 'Locating...' : 'Go'}
          </button>
        </form>

        {searchError && (
          <div className="bg-slate-950/95 border border-red-500/30 text-red-300 text-xs px-3 py-2 rounded-lg">
            {searchError}
          </div>
        )}

        {results.length > 1 && (
          <div className="bg-slate-950/95 backdrop-blur-md border border-white/10 rounded-lg divide-y divide-white/10 shadow-xl overflow-hidden">
            {results.map((r, idx) => (
              <button
                key={`${r.placeId || idx}`}
                type="button"
                onClick={() => {
                  onFlyToCoordinates(r.lat, r.lng, r.formattedAddress);
                  setResults([]);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/10 transition-colors flex items-start gap-2 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                <span className="truncate">{r.formattedAddress}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          {QUICK_SECTORS.map((sector) => (
            <button
              key={sector.label}
              type="button"
              onClick={() =>
                onFlyToCoordinates(sector.lat, sector.lng, sector.label)
              }
              className="px-2.5 py-1 text-xs font-medium bg-slate-950/85 hover:bg-slate-900 text-slate-200 border border-white/10 rounded-md backdrop-blur-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {sector.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onTogglePinningMode}
            className={`px-2.5 py-1 text-xs font-medium border rounded-md backdrop-blur-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              isPinningMode
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-950/85 border-white/10 text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{isPinningMode ? 'Click Map to Pin' : 'Pin Mode'}</span>
          </button>
        </div>

        {!webglSupported && viewDimension === '3d' && (
          <div className="bg-amber-950/90 border border-amber-500/30 text-amber-200 text-xs px-3 py-2 rounded-lg">
            WebGL2 is unavailable in this browser context; displaying 2D tactical map fallback.
          </div>
        )}
      </div>

      {/* Bottom-Left Camera Choreography & Telemetry Bar */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-auto max-w-[calc(100vw-2rem)] bg-slate-950/90 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-xl flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {viewDimension === '3d' && webglSupported && (
              <>
                <button
                  type="button"
                  onClick={() => onFlyToPreset('aerial')}
                  className="px-2.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Aerial Overview
                </button>
                <button
                  type="button"
                  onClick={() => onFlyToPreset('oblique')}
                  className="px-2.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Oblique Urban
                </button>
                <button
                  type="button"
                  onClick={() => onFlyToPreset('nadir')}
                  className="px-2.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Top-Down Nadir
                </button>
                <button
                  type="button"
                  onClick={() => onFlyToPreset('orbit')}
                  className="px-2.5 py-1.5 text-xs font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Orbit className="w-3.5 h-3.5" />
                  <span>Orbit 360°</span>
                </button>
              </>
            )}
          </div>

          {viewDimension === '3d' && webglSupported && (
            <button
              type="button"
              onClick={onToggleMapMode}
              className="px-2.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              title="Toggle 3D satellite labels"
            >
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>{mapMode === 'HYBRID' ? 'Hybrid Labels' : 'Satellite Mesh'}</span>
            </button>
          )}
        </div>

        {viewDimension === '3d' && webglSupported && (
          <div className="grid grid-cols-3 gap-3 pt-1 border-t border-white/10 text-xs">
            <label className="flex flex-col gap-1">
              <span className="text-slate-400 flex items-center justify-between font-mono tabular-nums">
                <span>Tilt</span>
                <span className="text-slate-200">{camera.tilt.toFixed(0)}°</span>
              </span>
              <input
                type="range"
                min={0}
                max={85}
                step={1}
                value={Math.round(camera.tilt)}
                onChange={(e) =>
                  onAdjustCamera({ tilt: Number(e.target.value) })
                }
                className="accent-blue-500 cursor-pointer"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-400 flex items-center justify-between font-mono tabular-nums">
                <span className="flex items-center gap-1">
                  <Compass className="w-3 h-3" />
                  Hdg
                </span>
                <span className="text-slate-200">
                  {((Math.round(camera.heading) % 360) + 360) % 360}°
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={359}
                step={1}
                value={((Math.round(camera.heading) % 360) + 360) % 360}
                onChange={(e) =>
                  onAdjustCamera({ heading: Number(e.target.value) })
                }
                className="accent-blue-500 cursor-pointer"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-400 flex items-center justify-between font-mono tabular-nums">
                <span>Range</span>
                <span className="text-slate-200">
                  {Math.round(camera.range)}m
                </span>
              </span>
              <input
                type="range"
                min={250}
                max={6000}
                step={50}
                value={Math.min(6000, Math.max(250, Math.round(camera.range)))}
                onChange={(e) =>
                  onAdjustCamera({ range: Number(e.target.value) })
                }
                className="accent-blue-500 cursor-pointer"
              />
            </label>
          </div>
        )}

        <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-slate-400 pt-1 border-t border-white/10">
          <span>LAT {camera.center.lat.toFixed(5)}</span>
          <span aria-hidden="true">·</span>
          <span>LNG {camera.center.lng.toFixed(5)}</span>
          <span aria-hidden="true">·</span>
          <span>ALT {Math.round(camera.center.altitude)}m</span>
        </div>
      </div>
    </>
  );
}
