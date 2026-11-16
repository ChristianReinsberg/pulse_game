FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY i18next.config.ts ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]