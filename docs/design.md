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
- **Typeset math everywhere.** KaTeX for symbols, vectors bold (`\mathbf{x}`).
- **Decimal point, not comma: `0.5`, never `0,5`** – in formulas, readouts, axis ticks,
  quizzes, course text and scenario labels alike, although the text is German. Whole numbers
  from five digits are grouped with a thin space (`100\,000`). Students may still *type*
  `3,2`; it is read as 3.2. A comma separates only items: `(0.6, 0.4)`. No "·" as a separator in running text.
- **Readouts are mathematics too.** Vectors appear as column vectors, several values as
  aligned equations (`λ₁ = …`), not as rows of chips.
- **Feedback without text.** The toolbar never shows words: a copied link turns its cell
  green with a check.
- **Axes tell the truth.** Axes computed from the data are held while parameters change: kept
  while the curve fits, moved at the same scale when it has left, never shrunk on their own. A
  larger start value shows as a shifted line, a larger rate as a steeper one – never as a
  rescaled picture (`packages/applet-plot/src/hold.ts`).
  - With "Achsen automatisch anpassen" off (the default) they do not grow: a button at the top
    of the y axis appears, pulsing, when the curve leaves the window, and also when the window
    is much too large; a click fits the axes.
  - With it on, they grow in steps of two by themselves; "Ganzes Bild" appears when the window
    is much too large.
  - Double click, reset and the scenario chips always fit the axes afresh.
  - A change of window glides in two steps – first the scale (about 0, or the edge nearest to
    it), then the position – about 0.85 s in all, so the change is seen.
  - A handle dragged past the edge stays at the edge until it is let go.
- **Views you can retrace.** Every settled zoom or pan is remembered; "zurück zur vorigen
  Ansicht" (next to "ganzes Bild") steps back, also from the whole picture to the last zoom.
  Plots side by side over the same time axis share their x window: zoom one, the other follows.
- **Phase planes:** small arrows along a trajectory show the direction of time; "frei | 1:1" in
  the title row gives both axes the same unit length (circles stay circles), kept while zooming;
  switching back fits the plot freely.
- **Values where they belong.** A dragged value is shown in the picture, not in a tooltip: in
  the handle's label ("x₀ = 23") or at the guide that shows the parameter ("b = 1.5" at the
  slope triangle). Tooltips remain only for handles that change several parameters at once.
- **No jumps on loading.** The server draws a plot at a guessed size and the default state; the
  browser shows it only once it has its real size and the state from the address, fading in.
- **Ticks as dense as they read.** x numbers stand at least 36 px apart and as close as their
  width allows (n = 0 … 20: every n); between them short ticks mark every n, or a fifth or half
  of the step, while they are at least 6 px apart.
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
| Punkte von Folgen verbinden | an | off: sequences as points only (the cobweb keeps its lines) |
| Achsen automatisch anpassen | aus | off: axes keep their scale (and still move into the data); a button at the top of the y axis, pulsing when the curve leaves the window, fits them with the same glide. On: they grow by themselves |

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
