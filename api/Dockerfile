FROM node:18-alpine

WORKDIR /app

# Copy package descriptors and install dependencies
COPY package.json ./
RUN npm install --production

# Copy API server files and static public dashboard
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
