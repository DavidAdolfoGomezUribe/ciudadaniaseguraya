# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001

WORKDIR /app

RUN corepack enable \
  && corepack prepare pnpm@11.1.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_APP_URL=http://localhost:3001
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3010
ARG NEXT_PUBLIC_SSE_URL=http://localhost:3010/api/v1/events/stream
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_SSE_URL=$NEXT_PUBLIC_SSE_URL

RUN pnpm build

EXPOSE 3001

CMD ["pnpm", "start", "--hostname", "0.0.0.0", "--port", "3001"]
