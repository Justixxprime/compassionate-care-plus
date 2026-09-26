// Scanner-only document state transition. This is intentionally not a server
// action: a browser or staff member must never be able to mark an upload safe.

import "server-only";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";

export const SCAN_RESULTS = ["clean", "rejected", "quarantined"] as const;
export type ScanResult = (typeof SCAN_RESULTS)[number];

export function isScanResult(value: unknown): value is ScanResult {
  return typeof value === "string" && SCAN_RESULTS.includes(value as ScanResult);
}

// A conditional update makes delivery safe: scanner retries cannot overwrite a
// final result, and an unknown ID reveals nothing to the caller.
export async function recordDocumentScanResult(
  documentId: string,
  result: ScanResult,
): Promise<void> {
  const pending = await prisma.document.findFirst({
    where: { id: documentId, scanStatus: "pending_scan" },
    select: { id: true, organizationId: true },
  });
  if (!pending) return;

  const updated = await prisma.document.updateMany({
    where: { id: pending.id, scanStatus: "pending_scan" },
    data: { scanStatus: result },
  });
  if (updated.count !== 1) return;

  await writeAuditLog({
    organizationId: pending.organizationId,
    action: "document_scan_recorded",
    resourceType: "document",
    resourceId: pending.id,
    outcome: "allowed",
  });
}
