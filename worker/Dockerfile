FROM node:20-alpine

# Install ffmpeg and yt-dlp (better YouTube bot detection handling)
RUN apk add --no-cache ffmpeg python3 py3-pip && \
    pip3 install --no-cache-dir yt-dlp

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --production

# Copy source files
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
