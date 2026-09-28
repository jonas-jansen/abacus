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

- **Public and protected at once?** Put the applets on one path and anything restricted on
  another, e.g. `/applets/` public and `/applets/kurs/` behind `Require shib-session`.
  Astro routes map one-to-one to directories, so this is a matter of where pages live.
- **Server-side notebook.** Only needed if students should see their notebook on several
  devices. The UI talks to the `NotebookStore` interface (`packages/applet-ui/src/notebook.ts`),
  so a store that syncs to a small endpoint reading `REMOTE_USER` / `eppn` can be added without
  touching any page. This is the point where personal data leaves the device – it reverses
  the privacy decision in spec §2 and brings DSGVO obligations with it. Export/import already
  covers the device-switch case without a server.
