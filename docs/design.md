# Design

The aim: the applet is the centre, things are manipulated directly, and the mathematics is
typeset properly. The interface stays quiet so the mathematics can speak.

## Rules

- **Direct manipulation first.** Everything with a place in the picture can be dragged there;
  formula parameters are chips you can drag or type into; slider, chip and handle are one
  value.
- **One card per thing.** The applet is a card; each plot is a card inside it; course
  sections are cards. Hairlines separate, backgrounds don't.
- **Corners: `--ab-radius` (2 px)** for every box. Round only what is meant to be round: the
  play button, icon buttons, switches.
- **Typeset math everywhere.** KaTeX for symbols, vectors bold (`\mathbf{x}`), German numbers
  (`0{,}5`, `100\,000`). No "·" as a separator in running text.
- **Readouts are mathematics too.** Vectors appear as column vectors, several values as
  aligned equations (`λ₁ = …`), not as rows of chips.
- **Feedback without text.** The toolbar never shows words: a copied link turns its cell
  green with a check.
- **Nothing jumps.** Controls that appear (zoom reset, delete trajectories) do not move
  others; the lin/log switch stays in the title row of every plot.

## Layout of an applet

```
┌ formulas (model | start | solution)                       Parameter/Werte ┐┌ toolbar ──────────────┐
│                                                                            ││ ↶ ↷ ⟲   📌 🔗 ▦   🖥 ?  │
├ plot card ───────────────────┐┌ plot card ─────────────────────────────────┤├ SZENARIEN ────────────┤
│ ● Title            lin|log ? ││ ● Title                                    ││ chips                 │
│   (plot fills the card)      ││                                            │├ PARAMETER ────────────┤
│   legend                     ││   legend                                   ││ sliders, fields       │
└──────────────────────────────┘└────────────────────────────────────────────┘├ MESSWERTE ────────────┤
              ▶  ‹ ─────────●──── ›  1×  n = 60 / 60                          │ readouts              │
```

- Every plot has a title row, with or without a title, so plots side by side stay level.
- Plots fill their card's width. Their height is at most about two thirds of the screen. A
  square plot (phase plane, complex plane, cobweb) in a wider card shows more of its x axis
  instead of stretching, so circles stay round.
- A power of ten that scales an axis appears as a small "×10ᵏ" badge: left of the y-axis
  tip, on the line of the y label; below the x axis, starting where the x label starts.

## Colours and themes

Two layers, at the top of `packages/applet-ui/src/styles.css`:

1. **Brand** `--ci-*`: the colours a corporate design fixes, each with a dark variant.
2. **Derived** `--ab-*` (interface) and `--abacus-*` (curves): mixed from the brand colours
   with `color-mix`. Lines, panels, muted text and tints all follow automatically, in light
   and dark mode alike.

| Brand variable | Used for |
|---|---|
| `--ci-accent` | buttons, links, active states, the play button |
| `--ci-series-1`, `-2`, `-3` | curves by role: primary, secondary, tertiary |
| `--ci-good` | marks in the plots, "copied" |
| `--ci-warning` | notes and warnings |
| `--ci-text` | text; neutrals are mixed from it |
| `--ci-surface` | the applet and cards |
| `--ci-page` | the page behind |
| `--ci-font` | the font |
| `…-dark` | the same in dark mode |

**A theme** is one file in `site/src/themes/` that sets these; `site/src/styles/thema.css`
picks it with one `@import`. `standard.css` is the library's own look; `uhoh.css` is the
Universität Hohenheim corporate design. For a new one:

- the three curve colours must differ clearly in hue, and be dark enough for thin lines on
  `--ci-surface`;
- in dark mode, keep each hue but raise lightness and saturation (OKLCH lightness ≈ 0.74–0.84);
  plain tints look washed out on a dark ground;
- check both modes; the canvas follows the theme, and redraws when the mode changes.

## Hints

Any element with `data-tip` gets a hint card after a short rest (`tip.ts`). The text is a
tiny markup:

```
data-tip="{Mod} + {Rad} | zoomen\n{Shift} + {Ziehen} | verschieben"
```

- lines are separated by `\n`; `keys | text` makes a row with keys on the left;
- `{Mod}` `{Shift}` `{Alt}` `{Leer}` `{Esc}` `{Redo}` `{Plus}` `{Minus}` become key caps that
  match the computer (⌘ on a Mac, Strg elsewhere); `{Rad}` `{Ziehen}` `{Doppelklick}`
  `{Finger}` become small icons;
- `data-tip-at="pointer"` puts the card under the pointer (used over plots).

Hints can be switched off in the settings (for the projector).

## Settings

The top bar's settings, kept per browser and applied before the first paint
(`packages/applet-ui/src/settings.ts`):

| Setting | Default | Effect |
|---|---|---|
| Farben | Automatisch | Hell / Dunkel override the system; sets `<html data-theme>` |
| Hinweise beim Zeigen | an | hint cards |
| Werte am Mauszeiger | aus | value box and crosshair over plots |

## Keyboard

| Key | Does |
|---|---|
| Space | play / pause, anywhere in the applet (not in text fields) |
| ⌘/Strg + Z, ⇧⌘Z / Strg + Y | undo, redo |
| Enter | presses the focused button, opens a chip for typing |
| arrows | slider and tempo fine steps |
| Esc | closes whatever is open; leaves lecture mode |
| + − 0 | in lecture mode: larger, smaller, fit to screen |

The "?" in the toolbar lists all gestures and keys.
