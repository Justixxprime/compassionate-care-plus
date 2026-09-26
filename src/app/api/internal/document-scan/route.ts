import { timingSafeEqual } from "node:crypto";
import { isScanResult, recordDocumentScanResult } from "@/lib/document-scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasScannerToken(request: Request): boolean {
  const expected = process.env.DOCUMENT_SCANNER_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;

  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export async function POST(request: Request) {
  // A missing or invalid token looks exactly like a route that does not exist.
  // This avoids advertising a privileged scanner endpoint to the public.
  if (!hasScannerToken(request)) return new Response(null, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid scan result." }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { documentId?: unknown }).documentId !== "string" ||
    !(body as { documentId: string }).documentId.trim() ||
    !isScanResult((body as { result?: unknown }).result)
  ) {
    return Response.json({ error: "Invalid scan result." }, { status: 400 });
  }

  await recordDocumentScanResult(
    (body as { documentId: string }).documentId,
    (body as { result: "clean" | "rejected" | "quarantined" }).result,
  );
  return Response.json({ ok: true });
}
