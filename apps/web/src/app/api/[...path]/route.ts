// Mock API cho giai đoạn chưa có backend. Production: Caddy chuyển /api sang FastAPI
// nên route này không bao giờ được gọi; thêm vào đó nó trả 404 nếu MOCK_API khác "1".
import { handleMock } from "@/mocks/handlers";

export const dynamic = "force-dynamic";

async function handler(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (process.env.MOCK_API !== "1") return Response.json({ code: "not_found" }, { status: 404 });
  return handleMock(req, (await ctx.params).path);
}

export { handler as DELETE, handler as GET, handler as POST, handler as PUT };
