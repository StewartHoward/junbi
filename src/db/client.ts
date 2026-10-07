import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

declare global {
  // Reuse one pool across hot reloads in development.
  // eslint-disable-next-line no-var
  var __junbiSql: ReturnType<typeof postgres> | undefined;
}

function appUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  return url;
}

export function connect(url = appUrl()): Db {
  const client = globalThis.__junbiSql ?? postgres(url, { max: 10 });
  if (process.env.NODE_ENV !== "production") globalThis.__junbiSql = client;
  return drizzle(client, { schema });
}

let _db: Db | undefined;
export function db(): Db {
  _db ??= connect();
  return _db;
}

/**
 * Run work inside one transaction scoped to a single club.
 * Postgres row-level security reads app.club_id, so every query in `fn`
 * can only see and write that club's rows, even if a WHERE clause is forgotten.
 */
export async function withClub<T>(
  scope: { clubId: string; userId?: string },
  fn: (tx: Tx) => Promise<T>,
  database: Db = db(),
): Promise<T> {
  return database.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.club_id', ${scope.clubId}, true)`);
    if (scope.userId) {
      await tx.execute(sql`select set_config('app.user_id', ${scope.userId}, true)`);
    }
    return fn(tx);
  });
}
