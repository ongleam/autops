import { resourceMetadata } from "@/lib/mcp/oauth";
export function GET() { return Response.json(resourceMetadata()); }
