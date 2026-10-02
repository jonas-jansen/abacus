# Extending the library

Most new applets need nothing new: a model builder, the existing plot types and readout
helpers cover them ([applets.md](applets.md)). This page is for the cases where the library
itself grows. Each recipe lists every file to touch; the type checker finds the rest.

Rule of thumb: **pure logic goes into `applet-core`** (testable without a browser),
**drawing into `applet-plot`** (both backends at once), **interaction into `applet-ui`**.

## A plot type

1. **Spec** – add a variant to `PlotSpec` in `packages/applet-plot/src/plots.ts`, with its own
   options next to `PlotCommon` (title, labels, ranges, drag, log switch).
2. **Domains** – a `case` in `plotDomains`: which x and y ranges it shows by default.
3. **Drawing** – a `case` in `drawPlot`. Draw only through the `Surface` methods (lines,
   dots, fills, text), never with canvas or SVG calls, so the live canvas and the server
   SVG stay identical.
4. **Pointer** – a `case` in `packages/applet-plot/src/overlay.ts`: what the value probe and
   readout marks show over this plot.
5. **Shape** – square plots (equal units on both axes) are listed in `isSquare`. In a wider
   box they show more x axis rather than stretching.
6. **Legend** – `legendEntries` in `packages/applet-ui/src/FigureHead.tsx` if the default
   (one entry per series) is wrong.
7. **Zoom detail** – in `Figure.tsx`, `detailWanted` says whether the x axis is time (the
   model reruns past N or T) or a state (only the magnification counts).
8. **Docs and test** – a row in the plot table of [applets.md](applets.md); a test in
   `packages/applet-plot/src/plot.test.ts` that draws it on the SVG surface.

## A model builder

A builder turns a small configuration into a `Model` with `run(params, opts)`.

1. Write it in `packages/applet-core/src/builders.ts` next to `iteration`, `iterationN`,
   `closedForm` and `ode`. Return `{ series, observables, meta }`, and support
   `opts.detail` (a finer run of a zoomed window) and `opts.observables === false` (drawing
   runs skip the readouts).
2. Pass through `extraSeries`, `grids` and `observables(ctx)` like the others, so applets
   keep one way of adding curves and readouts.
3. Add a template to `scripts/new-applet.mjs` (`--kind`), and a row to the model table
   in [applets.md](applets.md).

Without a new builder, a model can be written by hand: `defineModel({ …, run(p, opts) })`
(see `predator-prey-map.ts`).

## A readout helper

Readouts are `Observable`s built by `zahl`, `index`, `klasse` and `liste`
(`packages/applet-core/src/observables.ts`). A helper computes a value and returns one of
these, e.g. `verhalten`, `periodOf`, `eigenReadout`. Keep the **value** a stable category or
number (quizzes compare it) and put wording into `format`, `note` or `namen`. Add a unit test
in `core.test.ts`.

## A parameter kind

1. Type, constructor, `checkValue` and `coerce` in `packages/applet-core/src/params.ts`.
2. URL format in `url.ts` (`formatValue` and its parser).
3. Its control in `packages/applet-ui/src/controls.tsx` (`ParamControl`), and in
   `formula.ts` how `{{id}}` shows it.
4. A row in the parameter table of [applets.md](applets.md).

## A toolbar tool

The toolbar of the panel has three groups: parameters (undo, redo, reset), sharing
(compare, link, QR), presentation (lecture mode, help). A new tool is a component in
`packages/applet-ui/src/Werkzeuge.tsx` placed in `AppletView.tsx`. Conventions:

- an `ab-tool` button with a 14 px stroke icon, `aria-label` and a short `data-tip`;
- anything that opens closes with Esc (use the `Dialog` in `Werkzeuge.tsx`);
- no text in the toolbar: feedback is a colour or an icon (as the green check after copying);
- add its gestures to the help list (`HilfeKnopf`).

## A message on the channel

Add the topic and its payload type to `Messages` in `packages/channel/src/index.ts`. Every
sender and listener is then type-checked. Retained messages (the last per topic and id) suit
states; for one-off events, send them and do not depend on retention.

## A theme

A copy of `site/src/themes/uhoh.css` with other values, chosen in
`site/src/styles/thema.css`; see [design.md](design.md#colours-and-themes).
