# ── build ────────────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN npm run build

# ── run: one bundled file + static assets, no node_modules ───────────────────────────────────
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/app.db
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY public ./public
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "--disable-warning=DEP0040", "dist/index.js"]
