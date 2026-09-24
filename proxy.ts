import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const hostname = (request.headers.get("host") ?? "").split(":")[0] ?? "";
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
  let slug = "";

  if (hostname.endsWith(".localhost")) {
    slug = hostname.slice(0, -".localhost".length);
  } else if (hostname.endsWith(`.${root}`) && hostname !== root && hostname !== `www.${root}`) {
    slug = hostname.slice(0, -(root.length + 1));
  }

  if (!slug || slug.includes(".") || slug === "www" || request.nextUrl.pathname !== "/") {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/f/${slug}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
