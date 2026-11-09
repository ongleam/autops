import type { NextRequest } from "next/server";
import { handleCloudRequest } from "@/lib/cloud/handlers";
import { getCloudConfig } from "@/lib/cloud/config";

type Context = { params: Promise<{ provider: string; action: string }> };

async function handle(request: NextRequest, context: Context) {
  const { provider, action } = await context.params;
  const config = provider === "vercel" || provider === "supabase" ? getCloudConfig(provider) : null;
  return handleCloudRequest(request, provider, action, config);
}

export { handle as GET, handle as POST, handle as DELETE };
