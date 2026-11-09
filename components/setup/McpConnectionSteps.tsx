export default function McpConnectionSteps() {
  return <div>
    <ol className="list-decimal pl-5 space-y-3">
      <li>Open your existing <a className="font-semibold underline" href="https://chatgpt.com/plugins" target="_blank" rel="noreferrer">autops plugin in ChatGPT</a>. Refresh its tools and reconnect the same account when permissions change. Keep using that plugin.</li>
      <li>Use <strong>autops</strong> as the name and enter the server URL above. Select <strong>OAuth</strong>. Leave the client ID and secret empty to use automatic registration.</li>
      <li>Complete GitHub authorization using the same account and repository selected on <a className="underline" href="/onboarding">autops</a>. Approve account and repository reads, cloud reads for connected providers, and repository writes when you want code changes.</li>
      <li>Select <strong>@autops</strong> in your conversation and send the message below.</li>
    </ol>
    <p className="mt-4 rounded-lg border border-[#e0e6d8] bg-[#f8faf5] p-4">Use autops get_connected_accounts to show my connected GitHub account and allowed repositories. Distinguish them from the fixed demo information in get_project_context.</p>
    <p className="mt-4">Your actual GitHub account and repository list confirm the connection. If no repositories appear, check GitHub App access on the <a href="/onboarding" className="underline">account connection page</a>.</p>
    <p className="mt-3">Approve cloud.read to check Vercel and Supabase connections saved to the same GitHub account. Repository writes also require GitHub App Contents: Read and write for your selected repository. A saved commit and a verified deployment are reported separately.</p>
    <details className="mt-4"><summary className="cursor-pointer font-semibold">Connection troubleshooting</summary><p className="mt-2">If the add option is missing, check workspace permissions for custom MCP servers. If tools are missing, refresh the plugin tools and select autops in your conversation. Restart authorization if authentication fails.</p></details>
    <a className="mt-4 inline-block underline" href="https://developers.openai.com/api/docs/guides/custom-mcp-server" target="_blank" rel="noreferrer">Official OpenAI connection guide</a>
  </div>;
}
