import {
  createMcpHandler,
  hostHeaderValidationResponse,
  McpServer,
  originValidationResponse,
} from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import {
  getConnectionInstructions,
  getProjectContext,
  MAINTENANCE_PROMPT,
} from "../projects/context";

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

// Supabase MCP uses the same per-request factory; legacy support stays enabled here.
const handler = createMcpHandler(() => {
  const server = new McpServer(
    { name: "autops", version: "0.1.0" },
    {
      instructions:
        "Start with get_project_context to confirm the fixed public demo project and available capabilities. This MCP only supplies public project context and setup guidance. It does not diagnose, modify, deploy, or schedule work. Never claim those actions succeeded.",
    },
  );

  server.registerTool(
    "get_project_context",
    {
      title: "autops 프로젝트 확인",
      description:
        "Confirm the public compiled-ex-project repository, branch, MCP endpoint, and current capabilities. Does not read runtime metrics or grant GitHub access.",
      inputSchema: z.object({}).strict(),
      annotations: readOnlyAnnotations,
    },
    async () => {
      const context = getProjectContext();
      return {
        content: [{ type: "text", text: JSON.stringify(context, null, 2) }],
        structuredContent: context,
      };
    },
  );

  server.registerTool(
    "get_connection_instructions",
    {
      title: "MCP 연결 안내",
      description:
        "Get the public MCP URL, authentication mode, connection verification steps, and limitations. Does not create connections or scheduled tasks.",
      inputSchema: z.object({}).strict(),
      annotations: readOnlyAnnotations,
    },
    async () => {
      const instructions = getConnectionInstructions();
      return {
        content: [{ type: "text", text: JSON.stringify(instructions, null, 2) }],
        structuredContent: instructions,
      };
    },
  );

  server.registerTool(
    "get_maintenance_prompt",
    {
      title: "유지보수 프롬프트 가져오기",
      description:
        "Get a maintenance prompt for the fixed demo repository. The prompt requires unavailable diagnostic and change tools to be connected before making changes. Does not schedule or execute maintenance.",
      inputSchema: z.object({}).strict(),
      annotations: readOnlyAnnotations,
    },
    async () => ({ content: [{ type: "text", text: MAINTENANCE_PROMPT }] }),
  );

  return server;
});

export async function handleMcpRequest(request: Request): Promise<Response> {
  const allowedHosts = [
    "autops-app.vercel.app",
    "autops-ongleams-projects-449736e9.vercel.app",
    "autops-git-main-ongleams-projects-449736e9.vercel.app",
    "compiled-17.vercel.app",
    "compiled-17-ongleams-projects-449736e9.vercel.app",
  ];
  if (process.env.NODE_ENV !== "production") {
    allowedHosts.push("localhost", "127.0.0.1", "[::1]");
  }
  const rejected =
    hostHeaderValidationResponse(request, allowedHosts) ??
    originValidationResponse(request, [...allowedHosts, "chatgpt.com"]);
  return rejected ?? handler.fetch(request);
}
