import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import { getMyDocumentForDownload } from "@/lib/patient-documents";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, ctx: RouteContext<"/my-documents/[id]/download">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required.", { status: 401, headers: NO_STORE });
  const { id } = await ctx.params;
  try {
    const result = await getMyDocumentForDownload(user.id, id);
    if (!result.ok) return new Response(result.error, { status: 404, headers: NO_STORE });
    const { fileName, contentType, bytes } = result.value;
    const asciiName = fileName.replace(/[^A-Za-z0-9._ -]/g, "_");
    return new Response(new Uint8Array(bytes), { headers: { ...NO_STORE, "Content-Type": contentType, "Content-Length": String(bytes.length), "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`, "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof AuthorizationError) return new Response("You do not have permission to do that.", { status: 403, headers: NO_STORE });
    throw error;
  }
}
