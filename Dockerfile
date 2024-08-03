# Stage 1: Build
FROM node:18-alpine3.18 AS build
WORKDIR /app2
# RUN apk add --update --no-cache gcompat #python3 make g++
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm i
COPY . .
RUN pnpm build
RUN pnpm prune --production

# Stage 2: Final Image
FROM node:18-alpine3.18
WORKDIR /app
COPY --from=build /app2/package.json .
COPY --from=build /app2/static ./static
COPY --from=build /app2/build ./build
COPY --from=build /app2/node_modules ./node_modules
LABEL Developers="John Wiseman <jjwiseman@gmail.com>"
EXPOSE 3000
ENV NODE_ENV=production
USER node:node
CMD [ "node", "build" ]
