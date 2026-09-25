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
- Submissions inbox, CSV export, and optional Resend email notifications
- One signed webhook per form (`submission.created`) with HMAC verification
- AI-assisted editing in the form editor

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
- `NEXT_PUBLIC_APP_ORIGIN`
- `NEXT_PUBLIC_ROOT_DOMAIN`
- `FORM_API_ORIGIN`
- `RATE_LIMIT_IP_SALT`

Optional:

- `OPENROUTER_API_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `RESEND_AUTH_FROM`

### Checks

```bash
pnpm check
pnpm test:acceptance:function
```

`pnpm check` runs lint, typecheck, unit tests, and production build.
`pnpm test:acceptance:function` publishes a form, installs registry output into a separate Next app, submits cross-origin, and asserts a Neon row.
