# Spbook

Accounting without a database.

Spbook is a lightweight accounting tool that stores your data as JSON files in your Google Drive.

## Development

Requirements:

- Node.js 22
- pnpm 10

Copy local environment defaults:

```sh
cp .env.example .env.local
```

Install dependencies:

```sh
pnpm install
```

Run the development server:

```sh
pnpm run dev
```

This generates `src/generated/build-info.ts` with the package version, current
git commit, and build timestamp before starting Vite.

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

Do not deploy the repository root directly. The source `index.html` references
`/src/main.tsx` for Vite development only. Cloudflare Pages must publish the
generated `dist` directory, where Vite rewrites module scripts to built
`/assets/*.js` files.

Do not add a Pages `wrangler.toml` unless the Cloudflare project configuration
has been downloaded with Wrangler and reviewed. A hand-written Pages
`wrangler.toml` can override dashboard settings and cause Cloudflare to skip
the build command.

Environment variables:

- `VITE_APP_ENV=development` for `dev.spbook.app`
- `VITE_APP_ENV=production` for `spbook.app`

Non-production environments show a small environment badge in the app shell.
The badge includes generated build metadata in the form `version · commit`.
