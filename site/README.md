# site

The kitchen-sink demo for the half-built design system. It consumes
only the published `@half-built/css` and `@half-built/astro` package
specifiers, never a relative import into the sibling packages, so its
build is the workspace's build gate: if `site` builds, the packages
work the way an external consumer would use them.

It is also where a palette override block gets generated. The palette
editor takes two base colors, derives the rest of the override (the
dependent ramp stops and the code island's chrome), and prints a
ready-to-paste override (the shape is documented in
`packages/css/README.md`).

It is the reference site at `ui.half-built-robots.com`, live on
Cloudflare Pages since 2026-09-07. `main` deploys to production and
`dev` builds the preview.

## Development

From the repo root:

```
npm install
npm run dev --workspace site
```

To build the way CI and Cloudflare Pages do:

```
npm run build:site
```

That root script is `npm run build --workspace site`.

## Cloudflare Pages build settings

- Root directory: the repo root (NOT `site/`; Pages runs install and
  build inside the root directory, and the workspace install that
  resolves the sibling packages only exists at the repo root)
- Build command: `npm run build --workspace site`
- Output directory: `site/dist`
- Production branch: `main` (auto-deploys)
- Preview branch: `dev`
- Ordering: the exact `@half-built/*` pins in `site/package.json`
  resolve on the registry only after the matching version tag
  publishes, so the release goes out before the first Pages build.
