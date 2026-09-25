# CropASAP's voice

The design direction behind UX-32 and UX-33. It replaces the "blue, light and
spacious" system, which had drifted into a generic SaaS look: white on white,
one blue on everything, and controls sized for a kiosk.

It borrows its *thinking* from the sibling apps — Ishoo's discipline (one
accent, one alarm, ink for "current", mono for machine facts, nothing floats
that doesn't have to) and NoCeremony's tactility (things spring, respond and
feel satisfying under the hand) — but it speaks with its own voice, because
it is a different kind of tool.

## The idea: a knife and a light box

CropASAP is a cutting tool. The two objects that best describe the job are the
**light box** a photograph is judged on and the **utility knife** that trims it.

- **The light box.** The picture sits on a dark graphite stage. Every serious
  image tool does this for a reason: a photo read against white looks flat and
  its highlights vanish into the page; against neutral dark its colours are
  judged honestly. The part you cut away falls into the dark as a ghost. The
  stage is the only dark thing in the app, so the eye goes straight to it.
- **The knife.** Utility-knife yellow on ink black is the colour of tools that
  cut: tape measures, blades, safety markings. **Saffron** is the one accent.
  It draws the crop frame, fills the one button that finishes the job, and
  nothing else.
- **The spec sheet.** Around the light box the chrome is warm stone paper with
  ink type, and every machine fact — pixels, ratios, sizes, formats — is set in
  Geist Mono, often as small uppercase tracked labels. It reads like a print
  spec: exact, compact, calm.

## Why saffron, and not the old blue

Functional first: the crop frame has to be visible over whatever is in the
photograph, and the commonest content in photographs is sky, water and foliage
— blue and green. A blue frame disappears into a sky. A saffron frame with a
thin dark halo reads over sky, sea, grass, snow and skin.

Then voice: a blue accent on white is the default of a thousand dashboards.
Yellow and ink is a decision.

## Colour roles

| Role | Token | Use |
|---|---|---|
| Ink | `--ink` | The current thing: selected tab, pressed segment, checked box, focus ring on paper. |
| Saffron | `--saffron` | The frame on the stage and the primary action (ink text on it). Never text on paper. |
| Saffron ink | `--saffron-ink` | The rare accent *text* on paper (a pinned size, an override). |
| Vermilion | `--alarm` | The one alarm: a file that got bigger, a size you can't make, a failure. |
| Green | `--good` | A saving in Convert and "sharp" on the stage. Text only, never a fill. |
| Stone | `--page`, `--raise`, `--sunk` | The paper the chrome is made of. No pure white anywhere in the chrome. |
| Graphite | `--stage*` | The light box, and only the light box. |

Every text token clears WCAG AA 4.5:1 on the surfaces it is used on, and every
control edge clears 3:1 — `node tools/contrast.mjs` proves it rather than
asserts it.

## Type

- **Geist** for words. **Geist Mono** for anything a machine would say:
  pixels, ratios, file sizes, format names, filenames, keyboard hints.
- Section labels are Geist Mono, 10.5px, uppercase, tracked 0.12em, in
  `--ink-3`. They label; they don't shout.
- The pixel size of the output is the hero figure of the whole interface and
  gets the largest mono setting in the panel.
- Nothing below 10.5px. Body 13px. The largest thing in the chrome is the
  output size; the largest thing on screen is the picture.

## Shape and density

- Radii 3px (chips, keys), 5px (controls), 8px (overlays). No pills, no bubbles.
- Controls 30px tall on a desktop, 40–44px on touch. Inputs are sunk, buttons
  sit flat; neither has a shadow. Shadows exist only on things that float over
  the app: the palette, the account card, the notice.
- Structure comes from 1px rules and the change of surface between stone and
  graphite, not from cards inside cards.

## Layout

```
┌ CropASAP  CROP  ADJUST  CONVERT  BATCH │ photo.jpg 2500×1660 │ pins … │ account ┐
├───────────────────────────────────────────────────────┬──────────────────────┤
│ ↶ ↷                      Freeform  Small │ 1:1 │ Fit    │ OUTPUT SIZE          │
│                                                       │ [ name / W × H ]     │
│               graphite light box                      │ W × H  lock   scale  │
│                  (the picture)                        │ FORMAT               │
│                                                       │ FILE                 │
│ readout                        sharp  − ─────── +  %  │ [■ Export          ] │
└───────────────────────────────────────────────────────┴──────────────────────┘
```

- **Rooms are tabs in the top bar,** not a 244px rail of four words. They are
  the app's navigation and they read like Ishoo's: mono, uppercase, the current
  one filled with ink. That hands ~250px back to the picture.
- **The left rail exists only as the Adjust drawer.** It opens when Adjust is
  the room, and the stage gives it the room rather than being covered by it.
- **The panel is a spec sheet** — output size, format, file, then the one
  action pinned to its foot.
- **On a phone** the tabs become the bottom bar beside the Export button, the
  panel becomes a full-screen sheet, and the stage stays graphite.

## The empty stage

The first screen is the product's handshake, so it says what the app is in one
look: four big saffron crop marks on the light box, "Drop an image." in large
type, the one button, and one mono line of promises. No card, no icon tile, no
illustration — the crop marks *are* the illustration.

## Motion

Kept from before, and kept honest: springs on the frame, the ghost of the
discarded picture, a frame gliding home after a drag. New motion is short
(120–180ms), uses one ease, and is removed under `prefers-reduced-motion`.

## The size question (UX-33)

The output size is the one question the app exists to answer, and the old card
answered it in pixels only — the preset's own name was hidden from sight.

- **The card says the answer out loud:** the name ("Instagram · Portrait post"),
  the pixels as the hero figure, the ratio, and a live swatch of the shape.
- **The picker is a palette, not a form.** The search box is the head of it.
  Before anything is typed, the home is a strip of shapes drawn to proportion —
  this image, custom, 1:1, 4:5, 16:9, 9:16 — then a mono filter bar for the
  catalogue (no rainbow icons), then your pinned, saved and recent sizes as
  rows. Choosing is one click; Cancel and Apply only appear when a form needs
  submitting. Ctrl+K opens it from anywhere.
