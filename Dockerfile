FROM node:20.11-slim AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install

COPY . .

ENV NODE_ENV=production

RUN npx prisma generate
RUN yarn build

FROM node:20.11-slim

WORKDIR /app

# ❗ 不需要 Cairo / Pango / pixman / libjpeg 了
# Docker image 會小 300–400MB
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/config.js ./config.js
COPY package.json yarn.lock ./


CMD npx prisma migrate deploy && yarn start

EXPOSE 3002
