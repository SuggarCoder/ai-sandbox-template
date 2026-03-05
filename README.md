# ai-sandbox-template

Slack thread-driven UI template built with Next.js App Router, React, shadcn/ui, Framer Motion, and Supabase.

## Quick start

```bash
npm install
npm run dev
```

Copy environment variables:

```bash
cp .env.example .env.local
```

## Thread routing contract

- Public route: `/thread/{threadId}`
- `threadId` format: normalized Slack `thread_ts` (example: `1719999999-123456`)
- Generated files live under `generated/threads/{threadId}`
- Runtime registry: `generated/thread-registry.ts`

## Bot integration workflow

1. Bot receives a Slack thread request.
2. Normalize `thread_ts` to `threadId`.
3. Generate or update page:

```bash
npm run create:thread -- --threadId 1719999999-123456 --title "Ops Control Panel"
```

4. Patch `generated/threads/{threadId}/page.tsx` with final UI implementation.
5. Rebuild registry after direct edits:

```bash
npm run rebuild:threads
```

## Security boundary

- Bot should only write:
  - `generated/threads/**`
  - `generated/thread-registry.ts`
- Keep infra files (`app`, `lib`, `package.json`) immutable during thread generation.

## Supabase

- Browser client: `lib/supabase/browser.ts`
- Server client: `lib/supabase/server.ts`
- Required env:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
