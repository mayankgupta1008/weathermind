FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

COPY apps/web/package.json ./apps/web/

COPY packages/*/package.json ./packages/

RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY apps/web ./apps/web

COPY packages ./packages

EXPOSE 5173

CMD ["pnpm", "--filter", "web", "run", "dev"]
