import { NextResponse, type NextRequest } from "next/server";

// Chỉ để chuyển hướng sớm cho trải nghiệm tốt hơn; không phải lớp bảo mật.
export function middleware(req: NextRequest) {
  if (req.cookies.has("refresh_token")) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/practice/:path*", "/exams/:path*", "/classes/:path*", "/me/:path*", "/teacher/:path*", "/admin/:path*"],
};
