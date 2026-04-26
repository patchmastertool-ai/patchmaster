FROM node:18-alpine

WORKDIR /app

# Install dependencies first for caching
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

# Expose Vite port
EXPOSE 3000

# Start Vite dev server with host access
CMD ["npm", "run", "dev", "--", "--host"]
