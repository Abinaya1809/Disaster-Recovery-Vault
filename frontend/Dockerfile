FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY postcss.config.js ./
COPY tailwind.config.js ./

RUN npm install

COPY index.html ./
COPY src ./src

EXPOSE 3000

CMD ["npm", "run", "dev"]
