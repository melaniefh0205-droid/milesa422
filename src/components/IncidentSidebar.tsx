import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Crosshair,
  Loader2,
  LogOut,
  MapPin,
  Navigation,
  Orbit,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import {
  CATEGORY_LABELS,
  SEVERITY_META,
  STATUS_LABELS,
  formatRemainingTtl,
  type Incident,
  type IncidentCategory,
  type IncidentSeverity,
  type IncidentStatus,
  type PendingPin,
} from '../types/incident.ts';

export type SidebarTab = 'incidents' | 'alerts' | 'report';

interface IncidentSidebarProps {
  isOpen: boolean;
  activeTab: SidebarTab;
  incidents: Incident[];
  loadingIncidents: boolean;
  incidentsError: string | null;
  pendingPin: PendingPin | null;
  selectedIncident: Incident | null;
  onClose: () => void;
  onChangeTab: (tab: SidebarTab) => void;
  onClearPendingPin: () => void;
  onEnablePinMode: () => void;
  onSubmitIncident: (payload: {
    title: string;
    description: string;
    category: IncidentCategory;
    severity: IncidentSeverity;
  }) => Promise<boolean>;
  onUpdateStatus: (id: number, status: IncidentStatus) => Promise<void>;
  onDeleteIncident: (id: number) => Promise<void>;
  onFlyToIncident: (incident: Incident, orbit?: boolean) => void;
  onRetryLoad: () => void;
}

export function IncidentSidebar({
  isOpen,
  activeTab,
  incidents,
  loadingIncidents,
  incidentsError,
  pendingPin,
  selectedIncident,
  onClose,
  onChangeTab,
  onClearPendingPin,
  onEnablePinMode,
  onSubmitIncident,
  onUpdateStatus,
  onDeleteIncident,
  onFlyToIncident,
  onRetryLoad,
}: IncidentSidebarProps) {
  const { user, signInWithGoogle, logout } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('infrastructure');
  const [severity, setSeverity] = useState<IncidentSeverity>('high');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [filterSeverity, setFilterSeverity] = useState<
    IncidentSeverity | 'all'
  >('all');
  const [searchText, setSearchText] = useState('');

  const filteredIncidents = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return incidents.filter((inc) => {
      if (filterSeverity !== 'all' && inc.severity !== filterSeverity) {
        return false;
      }
      if (!q) return true;
      return (
        inc.title.toLowerCase().includes(q) ||
        inc.formattedAddress.toLowerCase().includes(q) ||
        inc.description.toLowerCase().includes(q)
      );
    });
  }, [incidents, filterSeverity, searchText]);

  const activeAlerts = useMemo(() => {
    return incidents.filter(
      (inc) =>
        (inc.severity === 'critical' || inc.severity === 'high') &&
        inc.status !== 'resolved'
    );
  }, [incidents]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!pendingPin) {
      setFormError('Click anywhere on the map to set incident coordinates.');
      return;
    }
    if (!title.trim() || !description.trim()) {
      setFormError('Title and description are required.');
      return;
    }

    if (!user) {
      const signedIn = await signInWithGoogle();
      if (!signedIn) {
        setFormError('Google sign-in is required to persist incident reports.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const ok = await onSubmitIncident({
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
      });
      if (ok) {
        setTitle('');
        setDescription('');
        setCategory('infrastructure');
        setSeverity('high');
      } else {
        setFormError('Failed to save incident. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <aside
      aria-label="Incident and Alert Workspace"
      className="absolute top-14 right-0 bottom-0 z-20 w-full sm:w-[400px] bg-slate-950/92 backdrop-blur-md border-l border-white/10 flex flex-col shadow-2xl pointer-events-auto"
    >
      {/* Drawer Tab Strip + Close */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 gap-2">
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-white/5">
          <button
            type="button"
            onClick={() => onChangeTab('incidents')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'incidents'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Incidents ({incidents.length})
          </button>
          <button
            type="button"
            onClick={() => onChangeTab('alerts')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'alerts'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Alerts ({activeAlerts.length})
          </button>
          <button
            type="button"
            onClick={() => onChangeTab('report')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'report'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Report
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Operator Session Bar */}
      <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between text-xs bg-slate-900/50">
        {user ? (
          <>
            <div className="truncate text-slate-300">
              <span className="text-slate-400">Operator: </span>
              <span className="font-medium text-white">
                {user.displayName || user.email}
              </span>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="text-slate-400 hover:text-white flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </>
        ) : (
          <>
            <span className="text-slate-400">
              Sign in to sync and persist incidents
            </span>
            <button
              type="button"
              onClick={() => signInWithGoogle()}
              className="text-blue-400 hover:text-blue-300 font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign In with Google
            </button>
          </>
        )}
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'report' && (
          <div className="p-4 flex flex-col gap-4">
            {!pendingPin ? (
              <div className="border border-white/10 rounded-lg p-5 bg-slate-900/40 text-center flex flex-col items-center gap-3">
                <Crosshair className="w-6 h-6 text-blue-400" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-white">
                    Select Target Coordinates
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Click anywhere on the 3D photorealistic terrain or 2D map to
                    reverse-geocode an address and drop a report pin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onEnablePinMode}
                  className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors cursor-pointer"
                >
                  Enable Pin Mode
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                <div className="border border-white/10 rounded-lg p-3 bg-slate-900/60 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 font-medium text-slate-200">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      Target Location
                    </span>
                    <button
                      type="button"
                      onClick={onClearPendingPin}
                      className="text-slate-400 hover:text-white text-xs cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  {pendingPin.isGeocoding ? (
                    <div className="flex items-center gap-2 text-xs text-slate-300 py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      <span>Reverse geocoding coordinates...</span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {pendingPin.formattedAddress}
                    </p>
                  )}

                  {pendingPin.geocodeError && (
                    <p className="text-xs text-amber-400">
                      {pendingPin.geocodeError}
                    </p>
                  )}

                  <div className="text-[11px] font-mono tabular-nums text-slate-400 pt-1 border-t border-white/10 flex items-center justify-between">
                    <span>
                      {pendingPin.lat.toFixed(6)}, {pendingPin.lng.toFixed(6)}
                    </span>
                    <span>ALT {Math.round(pendingPin.altitude)}m</span>
                  </div>
                </div>

                <label className="flex flex-col gap-1.5 text-xs">
                  <span className="text-slate-300 font-medium">
                    Incident Title
                  </span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Overhead transmission line damage"
                    required
                    maxLength={140}
                    className="w-full bg-slate-900 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5 text-xs">
                    <span className="text-slate-300 font-medium">Category</span>
                    <select
                      value={category}
                      onChange={(e) =>
                        setCategory(e.target.value as IncidentCategory)
                      }
                      className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5 text-xs">
                    <span className="text-slate-300 font-medium">Severity</span>
                    <select
                      value={severity}
                      onChange={(e) =>
                        setSeverity(e.target.value as IncidentSeverity)
                      }
                      className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                </div>

                <label className="flex flex-col gap-1.5 text-xs">
                  <span className="text-slate-300 font-medium">
                    Field Observations
                  </span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    required
                    maxLength={1000}
                    placeholder="Describe terrain access, hazard perimeter, or affected infrastructure..."
                    className="w-full bg-slate-900 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </label>

                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    Coordinates expire automatically after 30 days in PostgreSQL.
                  </span>
                </div>

                {formError && (
                  <p className="text-xs text-red-400 border border-red-500/30 bg-red-950/40 rounded-md px-3 py-2">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting || pendingPin.isGeocoding}
                  className="w-full py-2.5 px-4 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {user ? 'Submit Incident Report' : 'Sign In & Submit Report'}
                  </span>
                </button>
              </form>
            )}
          </div>
        )}

        {activeTab === 'incidents' && (
          <div className="flex flex-col">
            {/* Search & Severity Filter */}
            <div className="p-3 border-b border-white/10 space-y-2.5">
              <div className="flex items-center bg-slate-900 border border-white/10 rounded-md px-2.5">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Filter by title or street address..."
                  className="w-full bg-transparent px-2 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-md">
                {(['all', 'critical', 'high', 'medium', 'low'] as const).map(
                  (lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setFilterSeverity(lvl)}
                      className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors capitalize cursor-pointer ${
                        filterSeverity === lvl
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {lvl}
                    </button>
                  )
                )}
              </div>
            </div>

            {!user ? (
              <div className="p-6 text-center space-y-3">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Sign in with Google to access persisted incident records and
                  30-day spatial tracking in Cloud SQL.
                </p>
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors cursor-pointer"
                >
                  Sign In with Google
                </button>
              </div>
            ) : loadingIncidents ? (
              <div className="p-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading active incidents...</span>
              </div>
            ) : incidentsError ? (
              <div className="p-5 text-center space-y-2">
                <p className="text-xs text-red-400">{incidentsError}</p>
                <button
                  type="button"
                  onClick={onRetryLoad}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-md cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="p-6 text-center space-y-3">
                <p className="text-xs text-slate-400">
                  No active incidents match your current filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onChangeTab('report');
                    onEnablePinMode();
                  }}
                  className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors cursor-pointer"
                >
                  Log First Incident
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {filteredIncidents.map((inc) => {
                  const sev = SEVERITY_META[inc.severity];
                  const isSelected = selectedIncident?.id === inc.id;
                  const isOwner = user?.uid === inc.reporterUid;

                  return (
                    <div
                      key={inc.id}
                      className={`p-4 transition-colors ${
                        isSelected ? 'bg-blue-950/30' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs mb-1">
                        <div className="flex items-center gap-1.5 text-slate-400 truncate">
                          <span className={`font-medium ${sev.textClass}`}>
                            {sev.label}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{CATEGORY_LABELS[inc.category]}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatRemainingTtl(inc.expiresAt)}
                          </span>
                        </div>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => onDeleteIncident(inc.id)}
                            aria-label="Delete incident"
                            className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold text-white mb-1 leading-snug">
                        {inc.title}
                      </h4>
                      <p className="text-xs text-slate-400 mb-2 line-clamp-2">
                        {inc.description}
                      </p>
                      <p className="text-xs text-slate-300 mb-2.5 truncate">
                        {inc.formattedAddress}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                        <select
                          aria-label={`Status for ${inc.title}`}
                          value={inc.status}
                          onChange={(e) =>
                            onUpdateStatus(
                              inc.id,
                              e.target.value as IncidentStatus
                            )
                          }
                          className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                        >
                          {Object.entries(STATUS_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onFlyToIncident(inc, false)}
                            className="px-2.5 py-1 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 rounded flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>Fly To</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onFlyToIncident(inc, true)}
                            className="px-2.5 py-1 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-blue-300 border border-white/10 rounded flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Orbit className="w-3 h-3" />
                            <span>Orbit</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="flex flex-col">
            <div className="p-4 border-b border-white/10 bg-slate-900/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-white mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Priority Escalation Feed</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Unresolved High and Critical incidents within their 30-day
                spatial retention window.
              </p>
            </div>

            {!user ? (
              <div className="p-6 text-center space-y-3">
                <p className="text-xs text-slate-400">
                  Sign in with Google to monitor live high-severity alerts.
                </p>
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors cursor-pointer"
                >
                  Sign In with Google
                </button>
              </div>
            ) : activeAlerts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No unresolved High or Critical incidents right now.
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {activeAlerts.map((alert) => {
                  const sev = SEVERITY_META[alert.severity];
                  return (
                    <div key={alert.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-semibold ${sev.textClass}`}>
                          {sev.label} Alert · {STATUS_LABELS[alert.status]}
                        </span>
                        <span className="font-mono tabular-nums text-slate-400">
                          {formatRemainingTtl(alert.expiresAt)}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white">
                        {alert.title}
                      </h4>
                      <p className="text-xs text-slate-300 truncate">
                        {alert.formattedAddress}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => onFlyToIncident(alert, false)}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors cursor-pointer"
                        >
                          Inspect in 3D
                        </button>
                        {alert.status === 'open' && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateStatus(alert.id, 'investigating')
                            }
                            className="px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 rounded transition-colors cursor-pointer"
                          >
                            Acknowledge
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
