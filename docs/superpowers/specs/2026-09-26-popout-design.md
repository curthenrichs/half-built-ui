# Popout: secondary context for tables and data viz

Date: 2026-09-26. Owner: Curt. Status: design approved in chat, awaiting
spec review.

## Problem

Data tables carry detail that is worth having but not worth a column:
a note on a filament, a caveat on a measurement. Prose has footnotes
and asides for this. Tables and charts have nothing.

The Bench Hardware materials table (blog, `PrintMaterials.astro`,
uncommitted on blog dev) routes its row notes through the link-tip
island: a `Note` button with `data-tooltip`, and `.pm-note[data-tooltip]`
added to the `mountLinkTips` selector in `Base.astro`. That is the wrong
tool. Link-tip is hover-only, `pointer-events: none`, plain text, and
mounts inert under `(hover: none)`, so phones get nothing. Plate-modal
is the other overlay family and is far too heavy for a two-line note.

The gap is the layer between them: opened deliberately, stays open
while read, tied to the thing that opened it, holding a short passage.

## Decisions

Settled with Curt on 2026-09-26 (mockups in the brainstorm companion).

1. Scope is secondary detail in data tables and data viz. Prose keeps
   footnotes and asides; this component is not for prose.
2. Content is inline rich text: a short passage that may hold links,
   `code`, and emphasis. No structured content (key-value lists,
   sub-tables, images) until a table needs it.
3. Desktop gets a popover anchored to its trigger. Click to open; it
   stays open until dismissed.
4. Phone gets a modal bottom sheet whose caption names the row, because
   on a phone the table scrolls sideways and the row's identifying
   column is usually out of view.
5. Chrome is the boxed grammar of the link tip and the search flyout,
   not the plate-modal grammar. The popout is the tip's sticky sibling.
6. Build is a new component plus a singleton island in the house island
   pattern. The native Popover API with CSS anchor positioning was
   rejected (anchor positioning is not in every supported browser, and
   the sheet needs modal behavior popover does not give). Teaching
   link-tip a click mode was rejected (it inverts every assumption that
   island is built on).
7. The desktop/phone switch is the system `--bp-phone` breakpoint, not
   touch detection. A wide touch tablet gets the popover, which works
   with a tap; a narrow desktop window gets the sheet.

## Package changes

### `@half-built/astro`: `components/Popout.astro`

```astro
<Popout label="Silk PLA · Geeetech Silk PLA, 3-pack">
  Got stringy, probably from taking on moisture from the air.
</Popout>
```

Props:

- `label: string`, required. The popout's caption and the source of the
  trigger's accessible name (`${trigger}: ${label}`, so "Note: Silk PLA
  · Geeetech Silk PLA, 3-pack"). Explicit rather than inferred from a
  row header so the component works where there is no `<th>` (a chart
  legend, a figure).
- `trigger?: string`, default `"Note"`. The button's visible text.
- `class?: string`, added to the trigger.

Output: a `<button type="button" class="popout-trigger">` carrying
`aria-haspopup="dialog"`, `aria-expanded="false"`, `aria-label`, and
`data-popout-label`, immediately followed by a
`<template class="popout-content">` holding the slot. The template keeps
the content inert and out of the accessibility tree until opened, and
keeps it in the page source for no-JS readers of the HTML. With JS off
the button does nothing; that is accepted (the content is secondary by
definition).

### `@half-built/astro`: `scripts/core/placement.ts`

`placeTip` and its types (`AnchorRect`, `TipSize`, `ViewportSize`,
`TipPosition`, `TipPlace`, `TipAlign`) move here from `link-tip.ts`
unchanged. `link-tip.ts` imports them from core. Its constants `GAP`,
`INSET`, and `EDGE` move with the function. `link-tip.ts` re-exports
nothing: callers and tests import from core (no shim; the existing
`link-tip.test.ts` placement cases move to a `placement.test.ts`).

### `@half-built/astro`: `scripts/popout.ts`

`mountPopouts: Island<PopoutOptions>` on the island contract: claims
`documentElement` as `"popout"`, a second mount is a no-op, `destroy()`
removes listeners and the surface and releases the claim.

Options: `selector` (default `".popout-trigger"`), `edge` (default the
placement `EDGE` plus 18, the close box's straddle), `closeLabel`
(default `"Close"`).

The singleton surface, created once and appended to `<body>`:

```html
<dialog class="popout" aria-labelledby="popout-label">
  <span class="popout-label boxed-label micro-label" id="popout-label"></span>
  <button class="popout-close icon-box" aria-label="Close">×icon</button>
  <div class="popout-body"></div>
</dialog>
```

The close glyph is `ICON_X` from `core/icons`, as in plate-modal.

Open (click on a trigger):

1. If the surface is open for this trigger, close it (toggle). If open
   for another trigger, close that one first (one open at a time).
2. Fill: label text from `data-popout-label`, body from a clone of the
   trigger's next-sibling template's content.
3. Mode is read at open time from `matchMedia` with `BP_PHONE_MAX`
   (`core/breakpoints.ts`), not cached. jsdom has no `matchMedia`; the
   widened-type guard from link-tip applies and absence means desktop.
4. Desktop: add `is-anchored`, `dialog.show()` (non-modal), measure the
   surface, and position it `fixed` with `placeTip(anchor, box,
   viewport, "below", "start", edge)`. Focus moves to the surface
   (`tabindex="-1"`) so a keyboard user can Tab into its links.
5. Phone: add `is-sheet`, `dialog.showModal()`. The platform supplies the
   focus trap, Esc/Back, and `::backdrop`. Page scroll locks by the
   plate-modal method (a class on `<html>`, here `popout-open`).
6. Trigger gets `aria-expanded="true"` and `is-open`.

Close paths, both modes: the ✕, Esc (a document `keydown` listener,
since a non-modal `show()` dialog gets no cancel on Escape), and a
click on another trigger (reopens there). Desktop adds a pointerdown
outside the surface and its trigger. Phone adds a click on the backdrop
(a click whose target is the dialog itself, outside the sheet box) and a
downward swipe of at least 60px that starts on the sheet while its body
is scrolled to the top. Android Back on the sheet still arrives through
the dialog's native close.

On close: `dialog.close()`, clear modes and body, restore the trigger's
`aria-expanded="false"`, remove `popout-open`, and return focus to the
trigger.

Desktop while open:

- Scroll (captured, since table scrollers do not bubble) re-measures and
  re-places in the next animation frame. If the trigger's rect lies
  wholly outside the viewport, close.
- Resize re-places the box. A resize that crosses the phone breakpoint
  closes it instead, in either mode (reopening picks the right mode). A
  sheet stays open through resizes that do not cross, since phones
  resize on URL-bar collapse and keyboard open.

### `@half-built/css`: `popout.css`

A standalone import like `plate-modal.css`, in `@layer components`.
Only existing tokens and patterns; no new colors.

- `.popout-trigger`: the look the materials table already uses (no
  border or background, inherited color, `--font-size-xs`, dotted
  underline offset 3px), with `cursor: pointer` in place of `help`.
  `.is-open` makes the underline solid. The focus ring is the global
  one.
- `.popout`: `border: var(--stroke) solid var(--rule)` on
  `var(--surface)`, `color: var(--ink)`, `box-shadow: var(--shadow)`,
  body padding that clears the straddling label, overflow visible so the
  label and ✕ can straddle. `margin: 0; inset: auto` to cancel the UA
  dialog centering.
- `.popout.is-anchored`: `position: fixed`, `width: max-content`,
  `max-width: min(22rem, calc(100vw - 2 * edge))`. This caps a UI
  surface, not prose in the layout column, so the no-prose-cap rule
  does not apply. `z-index: var(--z-popout)`.
- `.popout.is-sheet`: pinned to the bottom, full width, top rule only
  (`border-width: var(--stroke) 0 0`), `max-height: 70%` with the body
  scrolling and `overscroll-behavior: contain`, a short slide-up
  transition that is removed under `prefers-reduced-motion`.
  `::backdrop` is `var(--veil)` with the plate-modal blur.
- `.popout-label`: straddles the top rule at the left, one line,
  ellipsis truncation clear of the ✕ (the plate-modal label rule).
- `.popout-close`: straddles the top right corner.
- `html.popout-open`: the plate-modal scroll lock and stable gutter.

New token in `tokens/primitives.css`: `--z-popout: 19`, under
`--z-tooltip: 20` so a link tip on a link inside an open popout still
draws above it, and above `--z-scroll-top: 17`. The sheet is top-layer
(`showModal`) and needs no z-index.

### Exports and docs

- `@half-built/astro` README: the component, the island, the two modes,
  the out-of-scope list below.
- `@half-built/css` README: the new import.
- `css-pins.test.ts` pins the z ladder order.
- Version: minor bump to 0.11.0, per the bump guard and the release
  rules in the README.

## Reference site

A demo section on ui.half-built-robots.com: a small table with three or
four rows and popouts, one containing a link and inline code. Section
copy follows the site's impersonal active voice. Add the page state to
the site's browser and a11y coverage.

## Blog adoption

After 0.11.0 is on npm:

1. Pin 0.11.0; restart the dev server after the bump.
2. `PrintMaterials.astro`: the Notes cell renders
   `<Popout label={`${r.material} · ${r.product.name}`}>{r.notes}</Popout>`.
3. Remove the tooltip route entirely: `.pm-note` leaves the
   `mountLinkTips` selector and its comment in `Base.astro`; the `.pm-note`
   rules and the header comment's tooltip sentence leave
   `print-materials.css`.
4. `Base.astro` imports `@half-built/css/popout.css` and calls
   `mountPopouts(document)`.
5. `npm test` in full.

Precondition: blog dev currently holds uncommitted Bench Hardware edits
(six posts, `tools.mdx`, `Base.astro`, three new photos) that include the
tooltip route this replaces. Establish whose work that is and get it
committed or cleared with Curt before touching those files.

## Testing

Package, jsdom (`test/popout-dom.test.ts`):

- mount claims, second mount no-op, destroy releases and removes the
  surface and listeners
- open fills label and body from the right trigger's template
- one open at a time; clicking the open trigger toggles closed
- each close path: ✕, Esc/cancel, outside pointerdown (desktop), other
  trigger
- focus moves in on open and returns to the trigger on close
- `aria-expanded` tracks state
- mode choice with a stubbed `matchMedia` at 768 and 769

Package, pure (`test/placement.test.ts`): the moved `placeTip` cases,
unchanged.

Reference site, browser:

- desktop: popout sits below the trigger, flips above near the bottom
  edge, clamps at the right edge, is not clipped by a horizontally
  scrolled table, follows the trigger on scroll
- phone width: opens as a sheet in the top layer, backdrop click closes,
  page scroll is locked and restored
- axe clean with a popout open in both themes

Blog: the full suite; a manual pass on a phone before calling it done.

## Out of scope

- Markdown in `print-materials.json` notes (a later blog-side choice)
- Structured content (option C in the brainstorm)
- Chart-mark triggers (the component allows any placement; nothing uses
  it yet)
- Hover-to-preview on desktop
