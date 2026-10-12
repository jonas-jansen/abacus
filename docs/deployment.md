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

## An upload with only some of it

`site/releases.json` names what an upload contains: courses, applets, weekly quizzes, guided pages.

```json
"einfuehrung": { "courses": ["mathe-bio"], "applets": ["alcohol", "luo-rudy"], "quizzes": ["vorkurs"], "pages": [] }
```

```sh
pnpm release einfuehrung                       # → release/einfuehrung/ and release/einfuehrung.zip
ABACUS_BASE=/applets/ pnpm release einfuehrung # for a sub-path
```

Only the named pages are built and listed, whether or not they are `visible` in the catalogs;
everything else has no page at all. Without course pages the "Kurs" area is left out of the
navigation and the start page. The notebook is always there. (The applets' code still ships in
the shared script bundle; only their pages are missing.) A plain `pnpm build` – as for GitHub
Pages – builds everything, as before.

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
