# Ventro

Commercial app for construction services: prospects, clients, opportunities, quotes with versions
and PDF, follow-up and metrics. Built with React, TypeScript and Vite, with Supabase as the
backend.

## Run locally

```bash
npm ci
npm run dev
```

Without `VITE_SUPABASE_URL` and the anon key (see `.env.example`) the app runs in local-only mode,
storing data in the browser.

## Checks

```bash
npm run format:check && npm run lint && npm test && npm run build
```

## Contributing

Read `AGENTS.md`: it holds the product scope, code rules and workflow for people and AI agents.
