export default function McpConnectionSteps() {
  return <div>
    <ol className="list-decimal pl-5 space-y-3">
      <li>Open <a className="font-semibold underline" href="https://chatgpt.com/plugins" target="_blank" rel="noreferrer">ChatGPT plugins</a> and choose <strong>Add (+) → Add custom MCP server</strong>.</li>
      <li>Use <strong>autops</strong> as the name and enter the server URL above. Select <strong>OAuth</strong>. Leave the client ID and secret empty to use automatic registration.</li>
      <li>Review the instructions, create the plugin, and install it. Complete GitHub authorization using the same account connected to autops on the web.</li>
      <li>Select <strong>@autops</strong> in your conversation and send the message below.</li>
    </ol>
    <p className="mt-4 rounded-lg border border-[#e0e6d8] bg-[#f8faf5] p-4">Use autops get_connected_accounts to show my connected GitHub account and allowed repositories. Distinguish them from the fixed demo information in get_project_context.</p>
    <p className="mt-4">Your actual GitHub account and repository list confirm the connection. If no repositories appear, check GitHub App access on the <a href="/onboarding" className="underline">account connection page</a>.</p>
    <p className="mt-3">The connection expires after one hour. Reauthorize in ChatGPT when it expires. Vercel and Supabase web connections are not included in this MCP connection.</p>
    <details className="mt-4"><summary className="cursor-pointer font-semibold">Connection troubleshooting</summary><p className="mt-2">If the add option is missing, check workspace permissions for custom MCP servers. If tools are missing, refresh the plugin tools and select autops in your conversation. Restart authorization if authentication fails.</p></details>
    <a className="mt-4 inline-block underline" href="https://developers.openai.com/api/docs/guides/custom-mcp-server" target="_blank" rel="noreferrer">Official OpenAI connection guide</a>
  </div>;
}
