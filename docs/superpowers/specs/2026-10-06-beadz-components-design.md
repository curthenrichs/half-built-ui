# StatLedger, Meter, Subscribe messages (0.12.0): design

Date: 2026-10-06. Consumer driving it: the BEADZ site facelift (full spec in
the private BEADZ monorepo, `docs/superpowers/specs/2026-10-06-beadz-site-facelift-design.md`).
The components are generic and belong to the package.

## StatLedger.astro

A boxed grid of figures.

- Props: `items: { label: string; value: string; accent?: boolean }[]`,
  optional `label` for the section's accessible name.
- Markup is a `<dl>`. Each cell is a `.micro-label` over a large value.
  `accent` sets the value in `--accent-1-ink`. Cell borders use the rule
  tokens.
- One row of equal cells; stacks at the phone breakpoint.

## Meter.astro

A segmented progress bar.

- Props: `value`, `max`, `segments` (default 10), `label`, optional
  `valueText`.
- `role="meter"` with `aria-valuenow`, `aria-valuemax`, `aria-valuetext`.
- Fill is the accent ink, track a surface token, segment ticks a CSS gradient
  over the track. No JS.

## Subscribe: `messages` prop

Optional `{ invalid?, pending?, sent?, failed? }` strings. The component
serializes it onto the form as `data-messages`; `mountSubscribe` merges, per
form, defaults < mount option `messages` < the form's own `data-messages`.
Malformed JSON, unknown keys, and non-string or empty values are ignored.
`failedAt` stays the package's. Today a consumer cannot change the status lines
at all, because the component mounts itself with the defaults.

## Tooling: html-validate allowlist

`Meter` sets `--meter-fill` and `--meter-segments` inline. The preset's
`no-inline-style` allowlist gains both, as `--gallery-cols` did.

## Rules

- Demo sections for both components on the ui site.
- Package tests and a11y coverage in both themes.
- No new theming tokens.
- Minor bump to 0.12.0 for all three packages per the bump guard. Release: PR
  to main (Curt), tag `v0.12.0` (Claude), watch release.yml and npm.
