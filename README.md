# abacus – interactive applets for Mathematik für Biowissenschaften

Applets, quizzes and guided course pages for a first-year mathematics course in the life
sciences. Static site (Astro + React islands); everything runs in the browser.

**Live:** https://jonas-jansen.github.io/abacus/

```sh
pnpm install
pnpm dev                                  # http://localhost:4321
pnpm new-applet <id> --kind ode           # or iteration | closedForm; --page adds a course page
pnpm check                                # dependency rules, types, tests
pnpm build                                # static site in site/dist
```

## Pages

abacus is a platform for several courses (`site/src/courses.ts`); everything of a course lives
under its id, e.g. `mathe-bio`:

- `/` – the landing page: the courses (who sees which: `site/src/access.ts`)
- `/<course>/` – the course's start: its four areas
- `/<course>/applets` – all applets by chapter; `/<course>/applet/<id>` – one applet, full width
- `/<course>/kurs` – the guided pages; `/<course>/kurs/<page>` – text and exercises beside the applet
- `/<course>/quiz` – weekly quizzes; `/<course>/quiz/<id>` – one quiz with its attempts
- `/<course>/notizbuch` – the course's answers and attempts, with export and import

## Documentation

Start at **[docs/README.md](docs/README.md)**:
[architecture](docs/architecture.md) ·
[writing applets](docs/applets.md) ·
[extending the library](docs/extending.md) ·
[course pages](docs/course.md) ·
[quizzes](docs/quizzes.md) ·
[design and themes](docs/design.md) ·
[teaching](docs/teaching.md) ·
[operations](docs/operations.md) ·
[deployment](docs/deployment.md) ·
[modularity audit](docs/audit.md)

The original specification is [applet-library-spec.md](applet-library-spec.md).
