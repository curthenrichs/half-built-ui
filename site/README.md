# site

The kitchen-sink demo for the half-built design system. It consumes
only the published `@half-built/css` and `@half-built/astro` package
specifiers, never a relative import into the sibling packages, so its
build is the workspace's build gate: if `site` builds, the packages
work the way an external consumer would use them.

It is also where a palette override block gets generated. The palette
editor takes two base colors, derives the other four stops, and prints
a ready-to-paste override (the shape is documented in
`packages/css/README.md`).

Once deployed, this becomes the reference site at
`ui.half-built-robots.com`. It is not live yet; no Cloudflare Pages
project exists for it.

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

- Root directory: `site`
- Install command: run at the repo root, not `site/`, so the npm
  workspace install resolves the sibling packages
- Build command: `npm run build --workspace site`
- Output directory: `site/dist`
- Production branch: `main` (auto-deploys once the Pages project
  exists)
- Preview branch: `dev`
