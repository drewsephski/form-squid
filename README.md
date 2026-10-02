# FormSquid

Generate it. Host it. Own the code.

AI form builder for developers. Describe a form, publish a hosted endpoint, export shadcn/ui source with React Hook Form + Zod, review responses in an inbox, and deliver signed webhooks to your API.

Live site: [https://formsquid.com](https://formsquid.com)

## Workflow

1. Generate or start from a template
2. Edit fields, copy, and appearance
3. Publish a hosted form
4. Install the published form with shadcn, or keep using the hosted URL
5. Read submissions in the inbox and optionally forward them with a signed webhook

Browse the shadcn registry examples at `/shadcn/form-builder`.

## Features

- Hosted public forms with published versioning
- shadcn/ui registry export (`React Hook Form` + Zod)
- Official shadcn MCP integration for discovering and installing forms in Next.js
- Submissions inbox, CSV export, and optional Resend email notifications
- One signed webhook per form (`submission.created`) with HMAC verification
- AI-assisted editing in the form editor

## Connect through shadcn MCP

In a Next.js app, initialize shadcn if needed:

```bash
pnpm dlx shadcn@latest init
```

Merge this registry into that app's `components.json` (preserve its existing fields and registries):

```json
{
  "registries": {
    "@formsquid": "https://formsquid.com/r/{name}.json"
  }
}
```

Connect the [official shadcn MCP](https://ui.shadcn.com/docs/mcp). For Cursor, merge this server into `.cursor/mcp.json`; Claude Code uses `.mcp.json`. VS Code uses `.vscode/mcp.json` with `servers` instead of `mcpServers`.

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}
```

For Codex, add this server to `~/.codex/config.toml`:

```toml
[mcp_servers.shadcn]
command = "npx"
args = ["shadcn@latest", "mcp"]
```

Restart or enable the server and run your assistant from the receiving app's directory. Ask it to "Search @formsquid for a contact form, install @formsquid/contact-form, and wire its onSubmit callback to my API in a client component."

You can also install directly:

```bash
pnpm dlx shadcn@latest add @formsquid/contact-form
```

Source installs under your components alias at `formsquid/contact-form/formsquid-contact-form.tsx`, with its sibling Zod schema and required field components. The component is a client component; render callback-based examples from a client wrapper. Public examples call `onSubmit`; they do not collect responses through FormSquid.

For your own form, publish it and open **Code → Connect with MCP**. Copy the scoped `@formsquid-published` registry configuration shown there and ask the assistant to install its named item. Its unguessable registry key grants read access to that published form's source only; it does not expose other forms, drafts, submissions, notification settings, or account credentials. Keep key-bearing configuration out of public repositories. Changes become available after republishing; reinstall to update your local copy. Deleting the form removes its registry access.

The registry endpoints are `/r/registry.json` for curated examples and `/r/published/<registryKey>/registry.json` for one published form. This integration uses the official shadcn MCP process in the consumer project; there is no separate FormSquid MCP daemon to run.

## Stack

- Next.js App Router + React
- Better Auth
- Drizzle ORM + Neon Postgres
- Neon Functions public submission API
- Resend (optional notifications)
- Vercel Analytics funnel events

## Local development

```bash
pnpm install
cp .env.example .env.local
# fill in required values
pnpm db:migrate
pnpm dev
```

### Required environment variables

Names only — never commit real values:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_APP_ORIGIN`
- `NEXT_PUBLIC_ROOT_DOMAIN`
- `FORM_API_ORIGIN`
- `RATE_LIMIT_IP_SALT`

Optional:

- `OPENROUTER_API_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `RESEND_AUTH_FROM`

Google OAuth redirect URIs (Google Cloud Console → Credentials → OAuth client):

- Local: `{BETTER_AUTH_URL}/api/auth/callback/google` (e.g. `http://localhost:3000/api/auth/callback/google`)
- Production: `https://formsquid.com/api/auth/callback/google`

`BETTER_AUTH_URL` must match the origin Google redirects to, or you will get `redirect_uri_mismatch`.

### Checks

```bash
pnpm check
pnpm test:acceptance:function
pnpm test:acceptance:mcp
```

`pnpm check` runs lint, typecheck, unit tests, and production build.
`pnpm test:acceptance:function` publishes a form, installs registry output into a separate Next app, submits cross-origin, and asserts a Neon row.
`pnpm test:acceptance:mcp` validates every public registry item against shadcn's schema, connects to the real MCP over stdio, exercises discovery/search/inspection/install commands, installs forms using the real CLI into an isolated Next.js app with custom aliases, then typechecks and builds it. It keeps the temporary consumer directory for inspection and stops its registry server.
