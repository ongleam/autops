import type { NextRequest } from "next/server";
import { handleGitHubRequest } from "@/lib/github/handlers";

type Context = { params: Promise<{ action: string }> };

async function handle(request: NextRequest, context: Context) {
  const { action } = await context.params;
  return handleGitHubRequest(request, action);
}

export { handle as GET, handle as POST, handle as DELETE };
