# abacus – interactive applets for Mathematik für Biowissenschaften

Applets, quizzes and guided course pages for a first-year mathematics course in the life
sciences. Static site (Astro + React islands); everything runs in the browser.

**Live:** https://jonas-jansen.github.io/abacus/

```sh
pnpm install
pnpm dev                                  # http://localhost:4321
pnpm new-applet <id> --kind ode           # or iteration | closedForm; --seite adds a course page
pnpm check                                # dependency rules, types, tests
pnpm build                                # static site in site/dist
```

## Pages

- `/` – start: the four areas
- `/applets` – all applets by chapter; `/applet/<id>` – one applet, full width
- `/kurs` – the guided pages; `/kurs/<seite>` – text and exercises beside the applet
- `/quiz` – weekly quizzes; `/quiz/<id>` – one quiz with its attempts
- `/notizbuch` – all answers and attempts, with export and import

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
