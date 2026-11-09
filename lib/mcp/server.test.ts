import assert from "node:assert/strict";
import { test } from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { handleMcpRequest } from "./server";

const endpoint = new URL("http://localhost:3000/api/mcp");

for (const protocolVersion of [undefined, "2025-11-25"]) {
  test(`SDK client lists and calls real tools (${protocolVersion ?? "current"})`, async () => {
    const client = new Client({ name: "autops-test", version: "1.0.0" });
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
        "comment_issue",
        "compare_diagnostics",
        "create_issue",
        "deploy_project",
        "diagnose_project",
        "get_cloud_projects",
        "get_connected_accounts",
        "get_connection_instructions",
        "get_deployment_status",
        "get_diagnostic",
        "get_issue",
        "get_maintenance_prompt",
        "get_project_context",
        "get_project_logs",
        "get_repository_file",
        "list_diagnostics",
        "update_issue",
        "update_repository_file",
      ]);
      assert.ok(tools.filter((tool) => !["create_issue", "comment_issue", "update_issue", "update_repository_file", "deploy_project", "diagnose_project"].includes(tool.name)).every((tool) => tool.annotations?.readOnlyHint));
      assert.equal(tools.find((tool) => tool.name === "update_repository_file")?.annotations?.readOnlyHint, false);
      assert.deepEqual(tools.find((tool) => tool.name === "get_connected_accounts")?._meta?.securitySchemes,
        [{ type: "oauth2", scopes: ["accounts.read"] }]);
      const result = await client.callTool({ name: "get_project_context", arguments: {} });
      assert.equal(result.isError, undefined);
      const context = result.structuredContent as Record<string, unknown>;
      assert.equal(context.repository, "https://github.com/ongleam/compiled-ex-project");
      assert.equal(context.mcpUrl, "https://autops-app.vercel.app/api/mcp");
      assert.deepEqual(context.capabilities, {
        context: true,
        diagnostics: true,
        repositoryRead: true,
        comparison: false,
        changes: false,
        issueTracking: false,
        diagnosticHistory: false,
        deploymentRequests: false,
      });
      const instructions = await client.callTool({ name: "get_connection_instructions", arguments: {} });
      assert.equal((instructions.structuredContent as Record<string, unknown>).authentication, "GitHub OAuth; selected repository reads and writes require explicit scopes");
      const accounts = await client.callTool({ name: "get_connected_accounts", arguments: {} });
      assert.equal(accounts.isError, true);
      assert.ok(accounts._meta?.["mcp/www_authenticate"]);
      const prompt = await client.callTool({ name: "get_maintenance_prompt", arguments: {} });
      assert.ok(prompt.content.some((item) => item.type === "text" && item.text.includes("diagnose_project")));
      const invalid = await client.callTool({ name: "get_project_context", arguments: { repository: "https://example.com" } });
      assert.equal(invalid.isError, true);
      const invalidFile = await client.callTool({ name: "get_repository_file", arguments: { path: ".env" } });
      assert.equal(invalidFile.isError, true);
      const invalidTarget = await client.callTool({ name: "diagnose_project", arguments: { url: "http://169.254.169.254" } });
      assert.equal(invalidTarget.isError, true);
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
