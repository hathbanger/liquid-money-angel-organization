FROM node:22-slim AS base

FROM base AS deps
WORKDIR /app
# Repo switched from npm to yarn; package-lock.json is no longer committed.
# Enable Corepack so the bundled yarn binary is available without an
# explicit `npm i -g yarn`.
RUN corepack enable
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM base AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 8080
ENV PORT=8080
CMD ["node", "server.js"]
