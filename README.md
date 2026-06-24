# Student Emotion Coach

A simple Cloudflare Worker app that lets students type how they feel, scores the message for emotions, and returns a supportive AI response with next steps.

## Run Locally

```bash
npm install
wrangler login
npm run dev
```

Open the local URL Wrangler prints in your terminal.

## Test

```bash
npm run check
```

## Deploy

```bash
npm run deploy
```

Dry run first:

```bash
npm run deploy -- --dry-run
```

## Notes

- Uses Cloudflare Workers AI through the `AI` binding in `wrangler.jsonc`.
- Chat history is stored only in the browser.
- `.env` is optional. If Wrangler says `.env file not found`, it is just a debug message.
