# autops

**Connect your service. Check it with AI.**

autops helps solo builders understand their code and service status with AI. Connect your GitHub repository, optionally connect Vercel and Supabase, and use autops in ChatGPT to inspect your project and decide what to improve next.

**[Get started on autops](https://autops-app.vercel.app/)** · [Connect your accounts](https://autops-app.vercel.app/onboarding) · [Open autops in ChatGPT](https://chatgpt.com/plugins/plugin_asdk_app_6af15485bd508191a2b71b9912640184)

## Why we built it

Building alone is possible. Running alone is hard.

AI makes it easier for non-developers and vibe coders to launch a service. But after launch, someone still has to understand failures, check whether a change works, verify deployments, and keep the service running. That work takes time and operational experience a solo builder may not have.

We built autops to bring project context into the same conversation where you ask for help. Instead of gathering code, deployment information, and logs by hand, you can connect the services you use and ask AI to inspect the evidence with you.

Our goal is an AI operations assistant that supports a solo builder from launch to 100,000 monthly active users. Today, autops provides the connections and inspection tools described below. The longer-term goal includes more of the verification and deployment work.

The guiding idea is a repeatable loop: **inspect the current state, understand the evidence, make one small improvement, and check again.**

## What you can do today

| Task | What autops provides |
| --- | --- |
| Connect your project | Sign in with GitHub and select a repository you have allowed the autops GitHub App to access. |
| Understand your code | Ask ChatGPT to read supported source files from the selected repository and explain them. |
| Check connected services | Connect Vercel and Supabase separately, choose a project for each, and inspect project status. |
| Investigate problems | Ask for recent Vercel runtime or Supabase service logs, subject to provider permissions and availability. |
| Make a requested code change | With write access approved, update an existing source file as a commit on the selected repository's default branch. |
| Try API diagnostics | Compare two existing product-query approaches in the supported public demo project. |

## Start on the website

You do not need to clone this repository, run a local server, or paste an access token into autops to use the hosted service.

### 1. Sign in and choose a repository

1. Visit [autops](https://autops-app.vercel.app/) and select **Get started with GitHub**.
2. Select **Continue with GitHub** and complete GitHub authorization.
3. Install or configure the autops GitHub App. Allow access only to the repositories you want to use.
4. On the [account connection page](https://autops-app.vercel.app/onboarding), select your repository and save the selection.
5. Confirm that the page shows the expected GitHub account, repository, and default branch.

Connecting a repository does not start diagnostics, change code, or deploy your service. You request those actions separately.

### 2. Connect Vercel or Supabase if you use them

On the same account connection page:

1. Select **Vercel Connect** or **Supabase Connect** and approve the requested access.
2. Choose the project you want to inspect and select **Select this project**.
3. Use **Refresh project status** to check the selected project.

You can use either provider or both. Each project is selected independently; autops does not assume they belong to the same service. Cloud connections are saved to your GitHub account so the ChatGPT connection can use them with your permission.

These connections provide read-only inspection. They do not grant deployment, database editing, or service configuration changes.

### 3. Connect autops in ChatGPT

Open **ChatGPT connection guide** on the [homepage](https://autops-app.vercel.app/) for the connection instructions and server address.

1. Open the existing [autops plugin in ChatGPT](https://chatgpt.com/plugins/plugin_asdk_app_6af15485bd508191a2b71b9912640184). Keep using this connection rather than creating duplicates.
2. If asked for connection details, use the name **autops**, select **OAuth**, and enter:

   ```text
   https://autops-app.vercel.app/api/mcp
   ```

   Leave the client ID and client secret empty for automatic registration.
3. Authorize the same GitHub account and repository you selected on the website. Approve account and repository reads, plus cloud reads if you want to inspect connected providers. Approve repository writes only when you want code changes.
4. Select **@autops** in your conversation and check the connection:

   > Show my connected GitHub account and allowed repositories using autops. Confirm the selected repository and branch before inspecting anything.

Check that the response identifies your actual account and repository. Public demo information alone does not confirm that your account is connected.

### 4. Ask about your project

Start with a specific question and ask for the evidence behind the answer. For example:

> Read the relevant source files in my selected repository and explain how requests are handled. Include file paths and flag anything you cannot verify.

> Check my connected Vercel project's latest deployment status and recent runtime logs. Summarize any errors and explain what still needs investigation.

> Check my connected Supabase project's status and recent service logs. Explain any failures without changing the database.

When you want a code change:

> Read the affected file first, explain the problem, and make the smallest change needed to fix it. Report the saved commit and identify any tests or deployment checks you could not perform.

Code changes require both GitHub App write permission and ChatGPT repository-write consent. An update changes one existing supported source file on the default branch. That commit may trigger your repository's existing CI or deployment pipeline. **A saved commit is not proof of a successful deployment.**

## Try the public demo

If you want to explore before connecting your own project, ask autops in ChatGPT:

> Inspect the public demo project and run its supported API diagnostics. Compare response times, failed requests, database request counts, and whether both approaches return the same products. Explain the measurement limits.

The supported diagnostic target is [ongleam/compiled-ex-project](https://github.com/ongleam/compiled-ex-project). It compares two query approaches already running in the same demo service, with three requests per approach. It does not measure an improvement caused by a new code change.

If you have connected a different repository, autops reports that these diagnostics are unsupported for that repository rather than showing demo results as your project's results.

## Optional homepage settings

**Project settings** lets you set a project name, service URL, and requested scope for the homepage's generated prompt. These settings stay in your browser. They do not select your authenticated GitHub repository or grant permissions; the form's repository is the fixed public demo.

Under **ChatGPT connection guide**, **Copy prompt** copies a suggested inspection workflow to paste into ChatGPT. Review it before sending: the workflow describes steps that may require capabilities beyond those currently available. Copying a prompt or selecting a requested scope does not execute it, authorize changes, deploy a service, or create a schedule.

## Current limits

- Live API diagnostics support the public demo project only. General source inspection and connected cloud status or log reads are separate capabilities.
- CPU, memory, and page time-to-first-byte measurements are not available through the demo diagnostics. The small sample is not a production performance benchmark.
- Source updates support one existing UTF-8 source file at a time, up to 100 KB. File creation, deletion, secret files, and workflow files are not supported.
- autops does not run tests or verify a deployment as part of saving a source change. Automatic deployment, persistent diagnostic history, and built-in scheduling are not available.
- Cloud logs cover a bounded recent window, up to 60 minutes and 100 entries. Results depend on your provider permissions, log retention, and available data.
- The homepage's **Free** and **Pro** pricing cards describe a proposed model. Billing and time-based access limits are not active.

## If something does not connect

| What you see | What to check |
| --- | --- |
| Your repository is missing | Check that you signed in with the right GitHub account and allowed that repository in the GitHub App installation. Refresh the repository list. Organization access may require administrator approval. |
| A cloud project is missing | Check the provider account, team or organization, and the projects allowed during authorization. Refresh the project list. |
| Project status works but logs are unavailable | Use **Review service permissions** on the account connection page to review the provider's log access, then try again. |
| ChatGPT tools or permissions are outdated | Refresh the existing autops plugin's tools and reconnect the same account. Newly added permissions require fresh consent. |
| Code changes are denied | Check both the GitHub App's **Contents: Read and write** permission and ChatGPT repository-write consent. |
| Authentication has expired | Sign in again on autops and reconnect the existing ChatGPT connection as needed. |
| ChatGPT does not offer a custom connection | Check your workspace's permissions for custom MCP connections. |

## Your access and data

You choose the repositories and cloud projects autops can access. Do not put passwords, tokens, or other secrets in the service URL or conversation.

Disconnecting GitHub on autops signs out the current browser; it does not uninstall the GitHub App. Disconnecting a cloud provider removes that provider's saved connection for your GitHub account. To revoke the provider's app permissions as well, remove access in GitHub, Vercel, or Supabase settings.

Read the [Privacy Policy](https://autops-app.vercel.app/privacy) and [Terms](https://autops-app.vercel.app/terms). For problems or suggestions, [open a GitHub issue](https://github.com/ongleam/autops/issues).
