import assert from "node:assert/strict";
import { test } from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { handleMcpRequest } from "./server";

const endpoint = new URL("http://localhost:3000/api/mcp");

for (const protocolVersion of [undefined, "2025-11-25"]) {
  test(`SDK client lists and calls real tools (${protocolVersion ?? "current"})`, async () => {
    const client = new Client({ name: "compiled-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(endpoint, {
      protocolVersion,
      fetch: async (url, init) => {
        const request = new Request(url, init);
        request.headers.set("host", endpoint.host);
        return handleMcpRequest(request);
      },
    });
    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      assert.deepEqual(tools.map((tool) => tool.name).sort(), [
        "get_connection_instructions",
        "get_maintenance_prompt",
        "get_project_context",
      ]);
      assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint));
      const result = await client.callTool({ name: "get_project_context", arguments: {} });
      assert.equal(result.isError, undefined);
      const context = result.structuredContent as Record<string, unknown>;
      assert.equal(context.repository, "https://github.com/ongleam/compiled-ex-project");
      assert.equal(context.mcpUrl, "https://autops-app.vercel.app/api/mcp");
      assert.deepEqual(context.capabilities, {
        context: true,
        diagnostics: false,
        comparison: false,
        changes: false,
        scheduling: false,
      });
      const instructions = await client.callTool({ name: "get_connection_instructions", arguments: {} });
      assert.equal((instructions.structuredContent as Record<string, unknown>).authentication, "No authentication");
      const prompt = await client.callTool({ name: "get_maintenance_prompt", arguments: {} });
      assert.ok(prompt.content.some((item) => item.type === "text" && item.text.includes("진단·비교·변경·예약 도구와 권한이 없다면")));
      const invalid = await client.callTool({ name: "get_project_context", arguments: { repository: "https://example.com" } });
      assert.equal(invalid.isError, true);
    } finally {
      await client.close();
    }
  });
}

test("rejects untrusted host and origin before reaching MCP", async () => {
  const host = await handleMcpRequest(new Request("http://attacker.example/api/mcp", {
    method: "POST",
    headers: { host: "attacker.example" },
  }));
  assert.equal(host.status, 403);
  const origin = await handleMcpRequest(new Request(endpoint, {
    method: "POST",
    headers: { host: endpoint.host, origin: "https://attacker.example" },
  }));
  assert.equal(origin.status, 403);
});
