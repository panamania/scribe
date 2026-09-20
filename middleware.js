import { NextResponse } from "next/server";

// Single-password gate for the whole app. Set SITE_PASSWORD (and optionally
// SITE_USER, default "scribe") in the environment. If SITE_PASSWORD is unset,
// the gate is disabled — convenient for local dev, but ALWAYS set it in the
// cloud so the app on your domain is private.
//
// Uses HTTP Basic Auth: the browser shows a native login prompt and remembers
// the credentials for the session. Runs on the edge runtime, so it uses atob
// (not Buffer) to decode.

export const config = {
  // Protect everything except Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};

function unauthorized() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Cinderwake Scribe", charset="UTF-8"' },
  });
}

export function middleware(req) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next(); // gate disabled when no password set

  const expectedUser = process.env.SITE_USER || "scribe";
  const header = req.headers.get("authorization") || "";

  if (header.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(header.slice(6));
    } catch {
      return unauthorized();
    }
    const sep = decoded.indexOf(":");
    const user = sep === -1 ? decoded : decoded.slice(0, sep);
    const pass = sep === -1 ? "" : decoded.slice(sep + 1);
    if (user === expectedUser && pass === password) {
      return NextResponse.next();
    }
  }
  return unauthorized();
}
