FROM node:22-alpine

WORKDIR /app

# The Reference Lab uses standard Node.js built-in HTTP modules (zero external dependencies)
COPY package.json ./
COPY src/ ./src/
COPY reference-lab-manifest.json ./

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=5s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["node", "src/server.js"]
