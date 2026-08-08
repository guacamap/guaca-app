---
name: GUACA
description: A map of places a named local physically stood in — witnessed, not inferred.
colors:
  bone: "#f7f6f2"
  ink: "#0b0b0b"
  ink-soft: "#4a4742"
  stone: "#d8d6d0"
  merlot: "#6b1f2b"
typography:
  display:
    fontFamily: "Bodoni Moda, Didot, serif"
    fontSize: "clamp(2rem, 14cqw, 9rem)"
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Bodoni Moda, Didot, serif"
    fontSize: "clamp(2rem, 5.2vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.035em"
  plate:
    fontFamily: "Bodoni Moda, Didot, serif"
    fontSize: "clamp(2.5rem, 7vw, 5.5rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Bodoni Moda, Didot, serif"
    fontSize: "clamp(1.75rem, 3.4vw, 3rem)"
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  name:
    fontFamily: "Bodoni Moda, Didot, serif"
    fontSize: "clamp(1.5rem, 3.2vw, 2.5rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  panel-title:
    fontFamily: "Bodoni Moda, Didot, serif"
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  wordmark:
    fontFamily: "Bodoni Moda, Didot, serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0.04em"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  compact:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  lead:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 1.35vw, 1.3125rem)"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.55
    letterSpacing: "0.16em"
  micro:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0.2em"
rounded:
  none: "0"
spacing:
  s1: "0.25rem"
  s2: "0.5rem"
  s3: "0.75rem"
  s4: "1rem"
  s6: "1.5rem"
  s8: "2rem"
  s12: "3rem"
  s16: "4rem"
  s24: "6rem"
  s32: "8rem"
  s40: "10rem"
  gutter: "clamp(1.25rem, 4.5vw, 4.5rem)"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bone}"
    rounded: "{rounded.none}"
    typography: "{typography.label}"
    padding: "0.75rem 2rem"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    typography: "{typography.label}"
    padding: "1rem 3rem"
  button-secondary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bone}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "currentColor"
    rounded: "{rounded.none}"
    typography: "{typography.label}"
    padding: "0"
  input-underline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    typography: "{typography.lead}"
    padding: "0.75rem 0"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    padding: "0"
  plate-absence:
    backgroundColor: "{colors.merlot}"
    textColor: "{colors.bone}"
    rounded: "{rounded.none}"
    padding: "8rem clamp(1.25rem, 4.5vw, 4.5rem)"
---

# Design System: GUACA

## Overview

**Creative North Star: "The House of Record"**

GUACA borrows the grammar of a fashion house's digital flagship — monumental
display type, vast quiet ground, full-bleed photography as the only texture,
hairlines instead of boxes — and points it at something a fashion house never
photographs: an ordinary Caribbean shoreline with driftwood and litter on it.
That collision is the system. Couture framing says *this was considered*;
documentary photography says *this is real*. The product's claim is that every
place on its map was physically stood in by a named local, so the imagery may
never be idealised and the layout may never be casual.

The system is deliberately near-monochrome. Bone ground, ink type, one wine-red
accent — and that accent has exactly one job: it marks what the map does **not**
know. Nothing else on any surface is allowed to be coloured. A visitor who
learns the colour once can read coverage at a glance from then on, and the
moment the product admits ignorance becomes the most visually arresting thing
in the whole experience rather than something to hide.

Density is low and space is the expensive material. Sections are plates, not
cards; nothing is enclosed in a rounded container; every corner is square and
every divider is a single hairline.

**Key Characteristics:**
- Bone ground, ink type, one reserved accent
- Monumental Didone display against a workhorse grotesk
- Full-bleed documentary photography as the only texture
- Square corners, hairline rules, no shadows on flat surfaces
- One solid ink button per surface; everything else outlined
- Space used as luxury; plates rather than cards

## Colors

A near-monochrome warm-neutral system with a single saturated voice.

### Primary
- **Merlot** (`#6b1f2b`): the only chromatic colour in the system, and it is
  reserved. It appears on the not-documented answer plate (as a full field), on
  the "Nobody has been." line, on every *Not documented* status in the register,
  and on the count of zones still awaiting a visit. It never decorates.

### Neutral
- **Bone** (`#f7f6f2`): the page ground everywhere, and the type colour on
  merlot fields.
- **Ink** (`#0b0b0b`): body and display type on bone, and the fill of primary
  buttons. Near-black rather than pure black.
- **Soft Ink** (`#4a4742`): secondary and supporting text — leads, notes, hints,
  captions. Tinted warm out of the ground rather than desaturated to grey, and
  measured at 7.8:1 on bone.
- **Stone** (`#d8d6d0`): every rule and divider in the system, always at 1px.

### Named Rules
**The Reserved Accent Rule.** Merlot means "not known". If a surface uses it for
anything else — a hover, a highlight, a decorative flourish, a second brand
colour — the system is broken, because the colour's meaning is the only thing
carrying coverage state.

**The No Grey Rule.** Secondary text is tinted from the ground's own warmth
(`#4a4742`), never a neutral grey. Grey on bone reads as a rendering accident.

## Typography

**Display Font:** Bodoni Moda (with Didot, serif)
**Body Font:** Archivo (with system-ui, sans-serif)

**Character:** A high-contrast Didone against a newspaper grotesk. Bodoni brings
hairline serifs, ball terminals and extreme thick-thin contrast that read as
considered at large sizes; Archivo is a workhorse built for forms and news, with
tabular figures the register depends on. The pairing is authority plus record-
keeping, which is exactly what the product claims to be.

### Hierarchy
- **Display** (400, `clamp(2rem, 14cqw, 9rem)`, 0.9): the single word that opens
  a surface. Sized against its own container rather than the viewport.
- **Headline** (400, `clamp(2rem, 5.2vw, 4.5rem)`, 1): a whole sentence at scale
  — the answer or refusal. Leading opens to 1 because descenders collide with
  the next line's caps at 0.9.
- **Plate** (400, `clamp(2.5rem, 7vw, 5.5rem)`, 1): a short declarative line
  owning a whole plate — the loop's three statements and the closing line.
- **Title** (400, `clamp(1.75rem, 3.4vw, 3rem)`, 1.04): section statements.
- **Name** (400, `clamp(1.5rem, 3.2vw, 2.5rem)`, 1.05): a proper name in a
  full-width row — the register's zones — and the register's tally figures.
- **Panel Title** (400, 1.75rem, 1.05): a heading inside a narrow panel — the
  map's place sheet and the villa's property name. Fixed rather than
  viewport-scaled, because the panel does not grow with the viewport.
- **Wordmark** (400, 1.25rem, `0.04em`): GUACA in the bar, on every surface.
- **Lead** (400, `clamp(1.0625rem, 1.35vw, 1.3125rem)`, 1.5): the paragraph under
  a display word. Held to ~46ch.
- **Body** (400, 1rem, 1.55): running text, held to a 68ch measure.
- **Compact** (400, 0.9375rem, 1.5): dense tool text — the map and villa panels,
  and subordinate helper lines. Subordination is carried by soft ink, not by
  shrinking further.
- **Label** (500, 0.75rem, `0.16em`, uppercase): buttons, nav, state labels.
- **Micro** (400, 0.6875rem, `0.2em`, uppercase, soft ink): captions, credits,
  statuses, counts.

### Named Rules
**The Container-Sized Monument Rule.** The opening word is sized in `cqw`
against its own column, never in `vw`. The system is bilingual and the Spanish
word is two characters longer than the English; a viewport-sized monument
either breaks mid-word or crowds the photograph. Measure the longest word in
every supported language before changing the ceiling.

**The No Eyebrow Rule.** A heading never carries a small uppercase label above
it. Headings carry themselves — the answer plate opens directly on its
sentence, with no label of any kind above it, because the sentence and the
field colour already report the state. Uppercase labels are permitted only
when they report state inline (*Not documented*) or name a control (the ask
field's label, a button).

## Layout

A single-column stack of full-width plates, gutters at
`clamp(1.25rem, 4.5vw, 4.5rem)`. Spacing runs on a 4px base; the recurring
rhythm is `8rem` of padding above and below a plate, `4rem` between a section's
head and its body, `2rem` between grouped elements.

The opening plate is a two-column grid, `minmax(0, 58fr) minmax(0, 42fr)`, type
left and photograph right, at `100dvh` minus the bar. Both columns carry
`minmax(0, …)` so a long unbreakable word can never expand its track.

Below ~900px the grid collapses to one column with the photograph first at
`42dvh`, so the first thing a phone shows is still the coast. The photo credit
overlaid on the hero frame is removed entirely at that width rather than
shrunk — it would strand its hairlines over the busiest part of the crop, and
the same attribution already sits in the footer. Below ~640px the in-page
anchors leave the bar (the map and the language control stay) and the ask field
stacks above its button. Plate padding drops from `8rem` to `4rem`, and
register rows go from a baseline-aligned row to a stacked pair.

Photography is the only texture and it enters three times, always full-bleed
and never inside a frame: the hero column (open beach, sand and driftwood at
eye level), a quiet horizontal band between sections at
`clamp(180px, 40dvh, 420px)` (palm grove with informal structures), and the
closing panel behind ink type with no scrim (driftwood and surf). All three are
crops of a single source negative, so the page returns to the same shoreline it
opened on.

### Named Rules

**The One Negative Rule.** Every image on a surface is a crop of the same
source photograph. Different framing, different subject inside the frame, one
light and one place. Mixing stock sources — or any two negatives — breaks the
claim that someone stood there.

## Elevation & Depth

The system is flat. Surfaces sit directly on the ground and are separated by
1px stone hairlines, never by shadow, and no surface on the landing page casts
one. Depth comes from full-bleed photography behind type and from the merlot
field, which reads as a different plane purely through colour.

Two floating panels in the map tool are the only exception, because they overlay
a live map and need to detach from it.

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 12px 32px rgb(11 11 11 / 0.08)`): the map's ask
  panel and place sheet only. Offset and blurred, 8% opacity.

### Named Rules
**The Hairline-Not-Shadow Rule.** Separation is a 1px stone rule. A shadow on a
surface that isn't floating over a map is wrong.

## Shapes

Every corner is square. `border-radius` is `0` across the entire system —
buttons, inputs, panels, images, avatars. Borders are 1px and stone, or 1px and
ink where a field needs to read as active. Inputs are a bottom rule only, never
a box. The active state of a link or a ghost button is a 1px underline in the
current colour, which is the only decoration the system permits.

## Components

A two-tier system, and the tiers are counted rather than chosen by taste: the
solid ink fill is spent once per surface, on that surface's primary action.
Everything else that must look like a button is the outlined companion.

- **Shape:** square (0 radius) throughout.
- **Primary (solid):** ink fill, bone label, no border, `0.75rem 2rem`, label
  typography. The hero's ASK, and the send action in the map and villa panels.
- **Primary hover / focus:** opacity to 0.82 over 220ms; focus shows a 2px ink
  outline offset 3px.
- **Disabled:** opacity 0.35. Reserved for in-flight requests only — a primary
  action is never greyed out merely because a field is empty.
- **Secondary (outlined):** transparent ground, ink label, 1px ink border,
  `1rem 3rem`. On hover it inverts to the ink fill with a bone label over 220ms.
  This is the closing OPEN THE MAP — an exit, not the page's primary act, so
  the page does not end on the same block it opened with.
- **Ghost:** transparent, current colour, 1px underline in current colour, no
  padding. Used inside coloured fields where an ink fill would disappear.

### Named Rules
**The One Fill Rule.** A surface gets exactly one solid ink button, and it goes
on the action the surface exists for. A second solid fill means one of the two
is not actually primary; make it the outlined variant.

### Inputs / Fields
- **Style:** transparent, no border except a 1px ink bottom rule. Lead-sized
  type. Placeholder in soft ink.
- **Focus:** 2px ink outline offset 3px (the global focus ring).

### Navigation
- Sticky, bone, 1px stone bottom rule, baseline-aligned. Wordmark set in Bodoni;
  links in uppercase label type. Default has a transparent 1px bottom border
  that becomes ink on hover and focus, so nothing shifts.

### Absence Plate (signature)
The system's defining component. When the product cannot answer, the response
does not render as an error or a muted note — it takes a full-width merlot field
with bone type, the sentence set at headline scale, a 1px rule in the current
colour, and the explanation of what the refusal triggered beneath it. It carries
no label above its sentence in either state. It is the loudest thing on the page
by design.

It also carries the system's one authored motion moment, `plate-arrive`: the
whole field uncovers from its bottom edge — `clip-path` from
`inset(0 0 22% 0)` to `inset(0 0 0 0)`, with opacity rising alongside — over
`900ms` on the house easing (`cubic-bezier(0.16, 1, 0.3, 1)`), so the plate
reads as being laid down rather than swapped in. Measured in production, opacity
runs 0.113 → 0.998 while the clip decays 19.5% → 0.03% across roughly 700ms of
the curve. The animation lives inside
`@media (prefers-reduced-motion: no-preference)` and the resting state is fully
opaque and unclipped, so a dropped animation or a reduced-motion visitor gets
the finished plate.

### Register Row
A baseline-aligned pair: zone name in Bodoni at
`clamp(1.5rem, 3.2vw, 2.5rem)`, status in merlot micro type, separated by a 1px
stone rule. Rows reveal in sequence at 45ms intervals.

### Named Rules
**The Uncover Rule.** Things arrive by uncovering, never by sliding or by fade
alone. A `clip-path` inset on the house easing is the only entrance vocabulary
in the system — the section observer and the answer plate share it — and one
surface gets at most one authored moment. The rest state is always the visible
state; motion is layered onto a page that already reads without it.

## Do's and Don'ts

### Do:
- **Do** spend merlot (`#6b1f2b`) only on what the map does not know.
- **Do** size the opening word in `cqw` against its column, and re-measure the
  longest word in every language after changing it.
- **Do** keep every corner square and every divider a 1px stone hairline.
- **Do** tint secondary text from the ground (`#4a4742`) rather than greying it.
- **Do** let photography be documentary — real weather, real litter, eye level.
- **Do** crop every image on a surface from the same source negative.
- **Do** keep one authored motion moment per surface; content is visible by
  default and the observer only adds the animated class once JS is running.
- **Do** spend the solid ink fill once per surface and make every other button
  the outlined variant.

### Don't:
- **Don't** put a small uppercase label above a heading.
- **Don't** introduce a second accent colour, a gradient, or gradient text.
- **Don't** round a corner or add a shadow to a surface that isn't floating over
  the map.
- **Don't** use an emoji or a glyph as an icon; icons are authored SVG at a
  1.25px stroke.
- **Don't** idealise the photography, and never caption an image with a
  verification claim the product cannot back.
- **Don't** grey out a primary action because its field is empty.
- **Don't** put two solid ink buttons on the same surface.
- **Don't** name a person, a face, a partner property, a verification date, or
  a count of verified places on any surface. Every such record in the codebase
  today is seed fiction; until real ones exist, the visual system has no
  testimonial, no avatar row, no logo wall and no "N places mapped" statistic
  to design for.
