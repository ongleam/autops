import { authorizationMetadata } from "@/lib/mcp/oauth";
export function GET() { return Response.json(authorizationMetadata()); }
