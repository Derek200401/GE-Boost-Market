FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

# Install runtime dependencies inside the image. This avoids Railway/Nixpacks
# skipping the install layer, which caused express and dotenv to be absent.
COPY package.json package-lock.json ./

# Cache-buster: a prior broken npm install got cached as a "successful" Docker
# layer, so later builds kept reusing it without ever actually reinstalling
# express. Changing this ARG's value invalidates that layer and forces a real
# npm install. Bump the date any time deploys crash with express missing
# right after a build that shows "RUN npm install ... cached".
ARG DEPS_CACHE_BUST=2026-08-22-01
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund

COPY . .

EXPOSE 3000
CMD ["node", "start.js"]