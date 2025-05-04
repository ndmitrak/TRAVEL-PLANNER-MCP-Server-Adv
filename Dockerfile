FROM node:22.12-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и lock-файл отдельно, чтобы использовать кэш
COPY package*.json ./

# Устанавливаем зависимости (включая dev-зависимости для сборки)
RUN npm install

# Копируем всё остальное
COPY . .

# Собираем TypeScript
RUN npm run build

# Устанавливаем переменную окружения
ENV NODE_ENV=production

# Запускаем приложение
CMD ["node", "dist/index.js"]
