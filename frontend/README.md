# Roda frontend

The `frontend/` package is the Next.js public landing page and product marketing site. It does not hold wallet secrets or execute Solana transactions; transaction flows live in the mobile client.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

```bash
cp .env.example .env.local
```

Only browser-safe public values belong in this file. Do not add private keys or server secrets to `NEXT_PUBLIC_*` variables.

## Structure

- `app/` — routes and page layouts
- `components/` — marketing sections and shared UI
- `public/` — static assets

## Related packages

- [Mobile client](../mobile/README.md)
- [Anchor program](../program/README.md)
- [Repository architecture](../README.md)
