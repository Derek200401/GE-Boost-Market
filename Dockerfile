FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV NPM_CONFIG_REGISTRY=https://registry.npmjs.org/

COPY package.json ./

ARG DEPS_CACHE_BUST=2026-08-22-02
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund --package-lock=false

COPY . .

EXPOSE 3000
CMD ["node", "start.js"]