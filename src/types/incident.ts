export type IncidentCategory =
  | 'infrastructure'
  | 'hazard'
  | 'utility'
  | 'traffic'
  | 'environmental';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'investigating' | 'resolved';

export interface Incident {
  id: number;
  userId: number;
  title: string;
  description: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  latitude: number;
  longitude: number;
  altitude: number;
  formattedAddress: string;
  placeId: string | null;
  createdAt: string;
  expiresAt: string;
  reporterEmail?: string;
  reporterName?: string | null;
  reporterUid?: string;
}

export interface CameraViewState {
  center: {
    lat: number;
    lng: number;
    altitude: number;
  };
  range: number;
  heading: number;
  tilt: number;
  roll: number;
}

export interface PendingPin {
  lat: number;
  lng: number;
  altitude: number;
  formattedAddress: string;
  placeId: string | null;
  isGeocoding: boolean;
  geocodeError: string | null;
}

export const SEVERITY_META: Record<
  IncidentSeverity,
  {
    label: string;
    pinBg: string;
    pinBorder: string;
    textClass: string;
    dotColor: string;
    rank: number;
  }
> = {
  critical: {
    label: 'Critical',
    pinBg: '#DC2626',
    pinBorder: '#991B1B',
    textClass: 'text-red-400',
    dotColor: '#EF4444',
    rank: 4,
  },
  high: {
    label: 'High',
    pinBg: '#D97706',
    pinBorder: '#92400E',
    textClass: 'text-amber-400',
    dotColor: '#F59E0B',
    rank: 3,
  },
  medium: {
    label: 'Medium',
    pinBg: '#0284C7',
    pinBorder: '#075985',
    textClass: 'text-sky-400',
    dotColor: '#38BDF8',
    rank: 2,
  },
  low: {
    label: 'Low',
    pinBg: '#059669',
    pinBorder: '#065F46',
    textClass: 'text-emerald-400',
    dotColor: '#10B981',
    rank: 1,
  },
};

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  infrastructure: 'Infrastructure',
  hazard: 'Structural Hazard',
  utility: 'Utility Outage',
  traffic: 'Traffic Disruption',
  environmental: 'Environmental',
};

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  open: 'Open',
  investigating: 'Investigating',
  resolved: 'Resolved',
};

export function formatRemainingTtl(expiresAt: string): string {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return 'Expired';
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days}d ${hours}h TTL`;
  return `${Math.max(1, hours)}h TTL`;
}
