FROM node:22-slim AS builder
WORKDIR /app

COPY backend/package.json ./backend/package.json
COPY app-ui/package.json ./app-ui/package.json

RUN cd backend && npm install --no-audit --no-fund
RUN cd app-ui && npm install --no-audit --no-fund

COPY backend ./backend
COPY app-ui ./app-ui

RUN rm -f ./backend/.env
RUN cd app-ui && npm run build
RUN cd backend && npm run build

FROM node:22-slim
WORKDIR /app/backend
ENV NODE_ENV=production
ENV PORT=4500

COPY --from=builder /app/backend/package.json ./package.json
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/src/db ./src/db
COPY --from=builder /app/backend/uploads ./uploads
COPY --from=builder /app/app-ui/dist ../app-ui/dist

EXPOSE 4500
CMD ["node", "dist/index.js"]
