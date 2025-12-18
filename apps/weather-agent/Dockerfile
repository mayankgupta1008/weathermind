FROM node:22-alpine

WORKDIR /app

COPY package.json  pnpm-lock.yaml pnpm-workspace.yaml ./

COPY apps/weather-agent/package.json ./apps/weather-agent/

COPY packages/*/package.json ./packages/

RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY apps/weather-agent ./apps/weather-agent

COPY packages ./packages

EXPOSE 3001

CMD ["pnpm", "--filter", "weather-agent", "run", "dev"]
