# The student version of abacus as a small web server: the site built from a release profile
# (site/releases.json), served by nginx. Built and published by .github/workflows/docker.yml;
# on the server: deploy/compose.yaml.
#
#   docker build --build-arg ABACUS_BASE=/abacus/ -t abacus .

FROM node:24-alpine AS build
WORKDIR /app
ENV ASTRO_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@11.21.0
# dependencies first, so they are cached while only the content changes
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/applet-core/package.json packages/applet-core/
COPY packages/applet-plot/package.json packages/applet-plot/
COPY packages/applet-ui/package.json packages/applet-ui/
COPY packages/applets/package.json packages/applets/
COPY packages/channel/package.json packages/channel/
COPY packages/quiz/package.json packages/quiz/
COPY packages/quizzes/package.json packages/quizzes/
COPY site/package.json site/
RUN pnpm install --frozen-lockfile
COPY . .
# which profile, and where the site lives on the server (a sub-path ends in '/')
ARG ABACUS_RELEASE=students
ARG ABACUS_BASE=/
ARG ABACUS_SITE=
RUN ABACUS_RELEASE=$ABACUS_RELEASE ABACUS_BASE=$ABACUS_BASE ABACUS_SITE=$ABACUS_SITE pnpm build

FROM nginx:1.27-alpine
ARG ABACUS_BASE=/
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
# the files sit under the base path, so the links the build wrote match without rewriting
COPY --from=build /app/site/dist /usr/share/nginx/html${ABACUS_BASE}
EXPOSE 80
