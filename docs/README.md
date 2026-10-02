# Documentation

Interactive applets, quizzes and course pages for *Mathematik für Biowissenschaften*: a pnpm
monorepo whose Astro site builds to static files.

| Document | For | What |
|---|---|---|
| [architecture.md](architecture.md) | developers | packages, dependency rules, how a parameter change becomes a picture |
| [applets.md](applets.md) | applet authors | writing an applet: models, parameters, formulas, plots, readouts, checks |
| [extending.md](extending.md) | developers | adding a plot type, model builder, readout helper, parameter kind, tool |
| [course.md](course.md) | page authors | course pages in MDX, quizzes and checkers, the notebook, the catalog |
| [design.md](design.md) | everyone touching the look | colours and themes, the interface rules, hints, settings, keyboard |
| [teaching.md](teaching.md) | lecturers | using the applets in a lecture: links, lecture mode, QR, comparison |
| [operations.md](operations.md) | maintainers | commands, tests, screenshots, releasing, visibility of applets |
| [deployment.md](deployment.md) | maintainers | static hosting, Apache, Shibboleth later |
| [audit.md](audit.md) | developers | how modular the library is, and what to improve next |

## In one minute

```sh
pnpm install
pnpm dev                                  # http://localhost:4321
pnpm new-applet konkurrenz --kind ode     # a complete, working applet to change
pnpm check                                # dependency rules, types, tests
pnpm build                                # static site in site/dist
```

- One applet is one file in `packages/applets/src/`, plus one line in
  `packages/applets/applets.json` (title, chapter, slides, `sichtbar`).
- One course page is one MDX file in `site/src/content/seiten/`.
- One colour scheme is one CSS file in `site/src/themes/`, chosen in `site/src/styles/thema.css`.
- Every push to `main` is checked and published to GitHub Pages.
