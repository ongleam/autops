import { NextRequest } from "next/server";
import { handleEmailAuth } from "@/lib/auth/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
async function handle(request: NextRequest, context: Context) {
  return handleEmailAuth(request, (await context.params).action);
}
export { handle as GET, handle as POST };
