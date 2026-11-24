import "server-only";
import { createHash } from "node:crypto";
import { type Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";

/**
 * Cache AI responses in Postgres to save free-tier quota.
 * Same input (e.g. the same demo audio clip or CBC photo) -> no new API call.
 */
export async function cached<T>(parts: unknown[], fn: () => Promise<T>): Promise<T> {
  const key = createHash("sha256").update(JSON.stringify(parts)).digest("hex");
  const hit = await db.aiCache.findUnique({ where: { key } }).catch(() => null);
  if (hit) return hit.response as T;
  const value = await fn();
  await db.aiCache
    .upsert({
      where: { key },
      create: { key, response: value as Prisma.InputJsonValue },
      update: { response: value as Prisma.InputJsonValue },
    })
    .catch(() => undefined);
  return value;
}
