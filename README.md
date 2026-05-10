# Spbook

Accounting without a database.

Spbook is a lightweight accounting tool that stores your data as JSON files in your Google Drive.

## Development

Requirements:

- Node.js 22
- pnpm 10

Install dependencies:

```sh
pnpm install
```

Run the development server:

```sh
pnpm run dev
```

Build for production:

```sh
pnpm run build
```

Run tests:

```sh
pnpm run test
```

## Cloudflare Pages

The app is designed to deploy as a static Vite build.

- Build command: `pnpm run build`
- Build output directory: `dist`
- Node version: `22`
