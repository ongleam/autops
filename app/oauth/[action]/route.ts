import type { NextRequest } from "next/server";
import { handleOAuth } from "@/lib/mcp/oauth";

type Context = { params: Promise<{ action: string }> };
async function handle(request: NextRequest, context: Context) {
  const { action } = await context.params;
  return handleOAuth(request, action);
}
export { handle as GET, handle as POST };
