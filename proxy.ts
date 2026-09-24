import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { formHostSlug } from "@/app/lib/form-host";

export function proxy(request: NextRequest) {
  const slug = formHostSlug(request.headers.get("host") ?? "", process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost");
  if (!slug) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname !== "/") {
    return new NextResponse(null, { status: 404 });
  }

  const url = request.nextUrl.clone();
  url.pathname = `/f/${slug}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
