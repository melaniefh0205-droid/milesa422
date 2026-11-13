import { relations } from 'drizzle-orm';
import {
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const incidents = pgTable('incidents', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(), // infrastructure | hazard | utility | traffic | environmental
  severity: text('severity').notNull(), // low | medium | high | critical
  status: text('status').notNull().default('open'), // open | investigating | resolved
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  altitude: doublePrecision('altitude').notNull().default(0),
  formattedAddress: text('formatted_address').notNull(),
  placeId: text('place_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(), // Strict 30-day coordinate TTL
});

export const usersRelations = relations(users, ({ many }) => ({
  incidents: many(incidents),
}));

export const incidentsRelations = relations(incidents, ({ one }) => ({
  reporter: one(users, {
    fields: [incidents.userId],
    references: [users.id],
  }),
}));

export type UserRow = typeof users.$inferSelect;
export type IncidentRow = typeof incidents.$inferSelect;
