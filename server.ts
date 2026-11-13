import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import {
  createIncidentRecord,
  deleteIncidentRecord,
  listActiveIncidents,
  updateIncidentStatus,
} from './src/db/incidents.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getMapsApiKey(): string {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    ''
  );
}

const VALID_CATEGORIES = new Set([
  'infrastructure',
  'hazard',
  'utility',
  'traffic',
  'environmental',
]);
const VALID_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const VALID_STATUSES = new Set(['open', 'investigating', 'resolved']);

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/maps-config', (_req, res) => {
    const apiKey = getMapsApiKey();
    res.json({ apiKey });
  });

  // Server-side Reverse Geocoding proxy (/maps/api/geocode/json)
  app.get('/api/geocode', async (req, res) => {
    const latRaw = req.query.lat;
    const lngRaw = req.query.lng;
    const lat = Number(latRaw);
    const lng = Number(lngRaw);

    if (
      typeof latRaw !== 'string' ||
      typeof lngRaw !== 'string' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res
        .status(400)
        .json({ error: 'Valid lat and lng query parameters are required.' });
    }

    const apiKey = getMapsApiKey();
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: 'Google Maps API key is not configured on the server.' });
    }

    try {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('latlng', `${lat},${lng}`);
      url.searchParams.set('language', 'en');
      url.searchParams.set('key', apiKey);

      const response = await fetch(url.toString(), {
        headers: {
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
        },
      });

      if (response.status === 429) {
        return res.status(429).json({
          error: 'Google Maps Geocoding quota exceeded.',
          status: 'RESOURCE_EXHAUSTED',
        });
      }

      const data = (await response.json()) as {
        status?: string;
        error_message?: string;
        results?: Array<{
          formatted_address?: string;
          place_id?: string;
          types?: string[];
          geometry?: { location?: { lat: number; lng: number } };
        }>;
      };

      if (data.status === 'OVER_QUERY_LIMIT') {
        return res.status(429).json({
          error: data.error_message || 'Geocoding query limit exceeded.',
          status: 'RESOURCE_EXHAUSTED',
        });
      }

      if (data.status === 'ZERO_RESULTS' || !data.results?.length) {
        return res.json({
          formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          placeId: null,
          types: [],
        });
      }

      if (data.status !== 'OK') {
        return res.status(502).json({
          error: data.error_message || `Geocoding failed: ${data.status}`,
        });
      }

      const top = data.results[0];
      return res.json({
        formattedAddress:
          top.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        placeId: top.place_id || null,
        types: top.types || [],
      });
    } catch (error) {
      console.error('Reverse geocoding proxy error:', error);
      return res
        .status(500)
        .json({ error: 'Failed to reverse geocode coordinates.' });
    }
  });

  // Server-side Forward Geocoding proxy for location jump search
  app.get('/api/geocode/search', async (req, res) => {
    const address = req.query.address;
    if (typeof address !== 'string' || !address.trim()) {
      return res
        .status(400)
        .json({ error: 'An address search query is required.' });
    }

    const apiKey = getMapsApiKey();
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: 'Google Maps API key is not configured on the server.' });
    }

    try {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('address', address.trim());
      url.searchParams.set('language', 'en');
      url.searchParams.set('key', apiKey);

      const response = await fetch(url.toString(), {
        headers: {
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
        },
      });

      if (response.status === 429) {
        return res.status(429).json({
          error: 'Google Maps Geocoding quota exceeded.',
          status: 'RESOURCE_EXHAUSTED',
        });
      }

      const data = (await response.json()) as {
        status?: string;
        error_message?: string;
        results?: Array<{
          formatted_address?: string;
          place_id?: string;
          geometry?: { location?: { lat: number; lng: number } };
        }>;
      };

      if (data.status === 'OVER_QUERY_LIMIT') {
        return res.status(429).json({
          error: data.error_message || 'Geocoding query limit exceeded.',
          status: 'RESOURCE_EXHAUSTED',
        });
      }

      if (data.status === 'ZERO_RESULTS' || !data.results?.length) {
        return res.json({ results: [] });
      }

      if (data.status !== 'OK') {
        return res.status(502).json({
          error: data.error_message || `Address lookup failed: ${data.status}`,
        });
      }

      const results = data.results.slice(0, 5).map((r) => ({
        formattedAddress: r.formatted_address || '',
        placeId: r.place_id || null,
        lat: r.geometry?.location?.lat ?? 0,
        lng: r.geometry?.location?.lng ?? 0,
      }));

      return res.json({ results });
    } catch (error) {
      console.error('Forward geocoding proxy error:', error);
      return res.status(500).json({ error: 'Failed to search location.' });
    }
  });

  // Protected Incident CRUD routes (Cloud SQL PostgreSQL with 30-day TTL)
  app.get('/api/incidents', requireAuth, async (req: AuthRequest, res) => {
    try {
      await getOrCreateUser(
        req.user!.uid,
        req.user!.email || 'operator@terrainpulse.local',
        req.user!.name
      );
      const rows = await listActiveIncidents();
      return res.json({ incidents: rows });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load incidents.';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/incidents', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getOrCreateUser(
        req.user!.uid,
        req.user!.email || 'operator@terrainpulse.local',
        req.user!.name
      );

      const {
        title,
        description,
        category,
        severity,
        latitude,
        longitude,
        altitude,
        formattedAddress,
        placeId,
      } = req.body as Record<string, unknown>;

      if (
        typeof title !== 'string' ||
        !title.trim() ||
        typeof description !== 'string' ||
        !description.trim() ||
        typeof category !== 'string' ||
        !VALID_CATEGORIES.has(category) ||
        typeof severity !== 'string' ||
        !VALID_SEVERITIES.has(severity) ||
        typeof latitude !== 'number' ||
        !Number.isFinite(latitude) ||
        typeof longitude !== 'number' ||
        !Number.isFinite(longitude) ||
        typeof formattedAddress !== 'string' ||
        !formattedAddress.trim()
      ) {
        return res
          .status(400)
          .json({ error: 'Invalid incident submission payload.' });
      }

      const safeAlt =
        typeof altitude === 'number' && Number.isFinite(altitude)
          ? altitude
          : 0;

      const created = await createIncidentRecord({
        userId: dbUser.id,
        title: title.trim().slice(0, 140),
        description: description.trim().slice(0, 1000),
        category,
        severity,
        latitude,
        longitude,
        altitude: safeAlt,
        formattedAddress: formattedAddress.trim().slice(0, 300),
        placeId: typeof placeId === 'string' ? placeId : null,
      });

      return res.status(201).json({
        incident: {
          ...created,
          reporterEmail: dbUser.email,
          reporterName: dbUser.displayName,
          reporterUid: dbUser.uid,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to submit incident.';
      return res.status(500).json({ error: message });
    }
  });

  app.patch('/api/incidents/:id', requireAuth, async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const { status } = req.body as { status?: string };

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid incident ID.' });
    }
    if (!status || !VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Invalid incident status.' });
    }

    try {
      await getOrCreateUser(
        req.user!.uid,
        req.user!.email || 'operator@terrainpulse.local',
        req.user!.name
      );
      const updated = await updateIncidentStatus(id, status);
      if (!updated) {
        return res
          .status(404)
          .json({ error: 'Incident not found or expired.' });
      }
      return res.json({ incident: updated });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update incident.';
      return res.status(500).json({ error: message });
    }
  });

  app.delete(
    '/api/incidents/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid incident ID.' });
      }

      try {
        const dbUser = await getOrCreateUser(
          req.user!.uid,
          req.user!.email || 'operator@terrainpulse.local',
          req.user!.name
        );
        const deleted = await deleteIncidentRecord(id, dbUser.id);
        if (!deleted) {
          return res.status(404).json({
            error: 'Incident not found or you do not have permission to delete it.',
          });
        }
        return res.json({ deleted: true, id });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to delete incident.';
        return res.status(500).json({ error: message });
      }
    }
  );

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TerrainPulse 3D server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
