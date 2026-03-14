FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG BACKEND_URL=http://127.0.0.1:8000
ENV BACKEND_URL=${BACKEND_URL}
ENV NODE_ENV=production

RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start", "-p", "3000", "-H", "0.0.0.0"]
