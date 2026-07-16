import { NextRequest, NextResponse } from "next/server";

function unauthorized(message = "Authentication required") {
  return new NextResponse(message, {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Simply Apply", charset="UTF-8"' },
  });
}

export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    return process.env.NODE_ENV === "development"
      ? NextResponse.next()
      : new NextResponse("APP_PASSWORD is not configured.", { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return unauthorized();

  try {
    const credentials = atob(authorization.slice(6));
    const separator = credentials.indexOf(":");
    const username = credentials.slice(0, separator);
    const suppliedPassword = credentials.slice(separator + 1);
    const expectedUsername = process.env.APP_USERNAME || "shortlist";

    if (separator < 0 || username !== expectedUsername || suppliedPassword !== password) {
      return unauthorized("Invalid username or password");
    }
  } catch {
    return unauthorized("Invalid authorization header");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
