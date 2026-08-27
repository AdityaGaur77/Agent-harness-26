FROM node:22.14-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY seed.mjs ./

CMD ["npm", "run", "seed"]
