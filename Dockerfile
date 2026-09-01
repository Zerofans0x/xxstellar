# Use a lightweight Node image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json first (for caching)
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy the rest of your code
COPY . .

# Expose the port your app runs on (usually 5000 or 8080)
EXPOSE 5001

# Start command
CMD ["npm", "start"]