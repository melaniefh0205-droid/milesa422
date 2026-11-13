import { and, desc, eq, gt, lte } from 'drizzle-orm';
import { db } from './index.ts';
import { incidents, users } from './schema.ts';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface CreateIncidentInput {
  userId: number;
  title: string;
  description: string;
  category: string;
  severity: string;
  latitude: number;
  longitude: number;
  altitude: number;
  formattedAddress: string;
  placeId?: string | null;
}

export async function listActiveIncidents() {
  try {
    const now = new Date();
    // Prune any expired coordinate rows beyond the 30-day retention boundary
    await db.delete(incidents).where(lte(incidents.expiresAt, now));

    const rows = await db
      .select({
        id: incidents.id,
        userId: incidents.userId,
        title: incidents.title,
        description: incidents.description,
        category: incidents.category,
        severity: incidents.severity,
        status: incidents.status,
        latitude: incidents.latitude,
        longitude: incidents.longitude,
        altitude: incidents.altitude,
        formattedAddress: incidents.formattedAddress,
        placeId: incidents.placeId,
        createdAt: incidents.createdAt,
        expiresAt: incidents.expiresAt,
        reporterEmail: users.email,
        reporterName: users.displayName,
        reporterUid: users.uid,
      })
      .from(incidents)
      .innerJoin(users, eq(incidents.userId, users.id))
      .where(gt(incidents.expiresAt, now))
      .orderBy(desc(incidents.createdAt));

    return rows;
  } catch (error) {
    console.error('Database query failed (listActiveIncidents):', error);
    throw new Error('Unable to load active incident records.', { cause: error });
  }
}

export async function createIncidentRecord(input: CreateIncidentInput) {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + THIRTY_DAYS_MS);

    const [created] = await db
      .insert(incidents)
      .values({
        userId: input.userId,
        title: input.title,
        description: input.description,
        category: input.category,
        severity: input.severity,
        status: 'open',
        latitude: input.latitude,
        longitude: input.longitude,
        altitude: input.altitude,
        formattedAddress: input.formattedAddress,
        placeId: input.placeId ?? null,
        createdAt: now,
        expiresAt,
      })
      .returning();

    return created;
  } catch (error) {
    console.error('Database insert failed (createIncidentRecord):', error);
    throw new Error('Unable to save incident report.', { cause: error });
  }
}

export async function updateIncidentStatus(
  incidentId: number,
  status: string
) {
  try {
    const now = new Date();
    const [updated] = await db
      .update(incidents)
      .set({ status })
      .where(and(eq(incidents.id, incidentId), gt(incidents.expiresAt, now)))
      .returning();

    return updated ?? null;
  } catch (error) {
    console.error('Database update failed (updateIncidentStatus):', error);
    throw new Error('Unable to update incident status.', { cause: error });
  }
}

export async function deleteIncidentRecord(incidentId: number, userId: number) {
  try {
    const [deleted] = await db
      .delete(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.userId, userId)))
      .returning();

    return deleted ?? null;
  } catch (error) {
    console.error('Database delete failed (deleteIncidentRecord):', error);
    throw new Error('Unable to delete incident report.', { cause: error });
  }
}
