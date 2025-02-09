FROM node:22-alpine AS installer
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
WORKDIR /app
COPY --from=installer /app ./
RUN pnpm build

FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
WORKDIR /app
COPY --from=builder /app ./
ENTRYPOINT [ "node", "/app/dist/index.js"]
