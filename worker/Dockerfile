FROM node:20-alpine

# Install ffmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --production

# Copy source files
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
