import { db } from "./db";
import { auditLogs } from "@shared/schema";

export async function createAuditLog(
  action: string,
  performedBy: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  await db.insert(auditLogs).values({
    action,
    performedBy,
    entityType: entityType || null,
    entityId: entityId || null,
    details: details || null,
  });
}
