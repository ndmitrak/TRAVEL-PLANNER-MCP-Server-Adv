# Этап сборки
FROM node:22.12-alpine AS builder

WORKDIR /app

# Копируем весь проект
COPY . .

# Устанавливаем зависимости и собираем TypeScript
RUN npm install
RUN npm run build

# Этап запуска
FROM node:22-alpine AS release

WORKDIR /app

# Копируем только нужные для запуска файлы
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json

ENV NODE_ENV=production

# Устанавливаем только runtime-зависимости
RUN npm ci --ignore-scripts --omit=dev

# Запуск
ENTRYPOINT ["node", "dist/index.js"]
