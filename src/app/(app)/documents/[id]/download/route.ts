import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import { getDocumentForDownload } from "@/lib/documents";

// The ONLY way a document's bytes leave the server. It is a plain GET, so
// unlike a Server Action it has no built-in guard of its own: everything
// depends on the checks below and inside getDocumentForDownload.
//
//   - not signed in            -> 401
//   - missing permission       -> 403 (and a permission_denied audit entry)
//   - missing, off-limits or
//     restricted document      -> 404, with the SAME words in every case,
//                                 so nobody can tell "not there" from
//                                 "not yours"
//
// The file is always sent as a download (never displayed inside the
// site), typed by what its bytes really are, with sniffing switched off
// and caching forbidden, so a copy of someone's paperwork never sits in
// a shared cache.

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/documents/[id]/download">,
) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Sign in required.", { status: 401, headers: NO_STORE });
  }

  const { id } = await ctx.params;

  try {
    const result = await getDocumentForDownload(user.id, id);
    if (!result.ok) {
      return new Response(result.error, { status: 404, headers: NO_STORE });
    }

    const { fileName, contentType, bytes } = result.value;
    // Old clients only understand a plain ASCII name; modern ones read
    // the filename* form. Both are built from the already-cleaned name.
    const asciiName = fileName.replace(/[^A-Za-z0-9._ -]/g, "_");

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": contentType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return new Response("You do not have permission to do that.", {
        status: 403,
        headers: NO_STORE,
      });
    }
    throw err;
  }
}
