FROM node:22-alpine AS installer
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
WORKDIR /usr/src/app
COPY --from=installer /usr/src/app ./
RUN pnpm build

FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app ./
CMD ["node", "dist/index.js"]
