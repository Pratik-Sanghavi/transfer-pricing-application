# Build from the REPO ROOT:  docker build -f apps/web/Dockerfile -t tp-web .
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/web
COPY apps/web apps/web
RUN npm run build -w apps/web

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node", "server.js"]
