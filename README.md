# Student Emotion Coach

Cloudflare Worker + Workers AI app for student emotion check-ins.

The app serves a static browser UI and exposes:

- `GET /api/health`
- `POST /api/chat`

Each chat request scores the current student message against 28 GoEmotions-style labels, then asks Workers AI for a supportive, non-clinical response and practical next steps. Conversation history stays in the browser.

## Setup

```bash
npm install
npm run check
```

## Local Development

Workers AI uses a remote binding, so Wrangler needs Cloudflare credentials:

```bash
wrangler login
npm run dev
```

In non-interactive environments, set `CLOUDFLARE_API_TOKEN` instead of using browser login.

If Wrangler logs `.env file not found`, that is only a debug message. This app does not require `.env` or `.dev.vars` to run after `wrangler login`. If you prefer token auth, copy `.env.example` to `.env` and add `CLOUDFLARE_API_TOKEN`.

## Deploy

```bash
npm run deploy
```

Use a dry run before deploying:

```bash
npm run deploy -- --dry-run
```
