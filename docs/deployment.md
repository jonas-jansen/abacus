# Deployment

The site is fully static (`site/dist/` after `pnpm build`). Any web server can serve it; no
Node process runs in production.

## Build

```sh
pnpm install
ABACUS_SITE=https://mathe.example.de ABACUS_BASE=/applets/ pnpm build
# → site/dist/
```

- `ABACUS_BASE` – the sub-path the site lives under (default `/`). All internal links go through
  `url()` in `site/src/config.ts`, so this is the only thing to change.
- `ABACUS_SITE` – the public origin; used for absolute URLs (sitemaps etc. later).

Copy `site/dist/` to the server, e.g. `rsync -a --delete site/dist/ user@server:/var/www/applets/`.

## Two versions from one commit

| | GitHub Pages: the beta | Uni server: the student version |
|---|---|---|
| for | colleagues trying things out | students |
| shows | everything; hidden applets and quizzes marked "nicht gelistet", draft course pages | only the profile `students` in `site/releases.json` |
| built by | `.github/workflows/pages.yml` (`ABACUS_ALL=1`) | `.github/workflows/docker.yml` → `ghcr.io/jonas-jansen/abacus` |
| updated | on every push to `main` | on every push to `main`; the server pulls |

Both are built from the same commit after the same checks, so the student version is always
the beta, filtered.

### What students see

`site/releases.json`, profile `students`, names the courses, applets, weekly quizzes and
guided pages of the student version. Add to it as the lecture goes on, push, and the next
image has it:

```json
"students": { "courses": ["mathe-bio"], "applets": ["alcohol", "luo-rudy"], "quizzes": ["vorkurs"], "pages": [] }
```

Without guided pages the "Kurs" area is left out of the navigation. The applets' code ships in
the shared script bundle; only the pages of the others are missing.

### The uni server

Once: copy `deploy/compose.yaml` to the server and start it.

```sh
docker compose up -d                     # serves on 127.0.0.1:8080 (port 8080 inside the container too)
```

To update to the newest version (after a push, once the "Docker" workflow is green):

```sh
docker compose pull && docker compose up -d
```

Every image is also tagged with its commit (`:sha-51da677`); put such a tag into
`compose.yaml` instead of `latest` to go back to an earlier version.

- **Path on the server.** Set the repository variable `UNI_BASE` (Settings → Secrets and
  variables → Actions → Variables) to the path the site lives under, e.g. `/abacus/`, and
  `UNI_SITE` to the origin. The image serves the site under that path, so the uni's web server
  forwards it unchanged: `ProxyPass /abacus/ http://127.0.0.1:8080/abacus/`.
- **Access to the image.** The first push creates the package `abacus` on GitHub as private.
  Either make it public (GitHub → Packages → abacus → Package settings → Change visibility),
  or log in on the server once with a token that may read packages:
  `docker login ghcr.io -u jonas-jansen`.
- **Automatic updates** are possible with a watcher such as Watchtower, but a deliberate
  `docker compose pull` keeps you in control of when students see changes.

### A zip instead of Docker

`pnpm release` builds the same student version into `release/students/` and
`release/students.zip`, e.g. to copy by hand (`ABACUS_BASE=/abacus/ pnpm release` for a
sub-path).

## Apache, public (current state)

```apache
Alias /applets /var/www/applets
<Directory /var/www/applets>
    Require all granted
    Options -Indexes
    # Hashed assets never change; HTML always revalidates.
    <FilesMatch "\.(js|css|woff2)$">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </FilesMatch>
    <FilesMatch "\.html$">
        Header set Cache-Control "no-cache"
    </FilesMatch>
</Directory>
```

## Later: behind Shibboleth

Because the site is static and the notebook lives in the browser, putting it behind Shibboleth
is a web-server change only – no code changes are needed:

```apache
<Location /applets>
    AuthType shibboleth
    ShibRequestSetting requireSession 1
    Require shib-session
    # or restrict further, e.g.:  Require shib-attr affiliation member@uni-example.de
</Location>
```

Things to decide at that point:

- **Who sees which course.** The landing page asks `courseAccess` (`site/src/access.ts`) for
  the visitor's courses; today it answers "all". With Shibboleth in place, a small endpoint
  can return them from ILIAS membership (or from courses joined on the platform), and
  `join` enables a "Kurs beitreten" button. Only `access.ts` changes; the course pages stay
  static, and access to them is a web-server rule per `/<course>/` path if ever needed.

- **Public and protected at once?** Put the applets on one path and anything restricted on
  another, e.g. the landing page public and `/<course>/` behind `Require shib-session`.
  Astro routes map one-to-one to directories, so this is a matter of where pages live.
- **Server-side notebook.** Only needed if students should see their notebook on several
  devices. The UI talks to the `NotebookStore` interface (`packages/quiz/src/notebook.ts`),
  so a store that syncs to a small endpoint reading `REMOTE_USER` / `eppn` can be added without
  touching any page. This is the point where personal data leaves the device – it reverses
  the privacy decision in spec §2 and brings DSGVO obligations with it. Export/import already
  covers the device-switch case without a server.
