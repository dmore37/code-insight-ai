docker tag davidsantiagomoreno-codeai-api:local 267693165925.dkr.ecr.us-east-1.amazonaws.com/davidsantiagomoreno-codeai-api:latest# syntax=docker/dockerfile:1

# ============================================================
# Stage 1: build (compila TypeScript -> JavaScript con nest build)
# ============================================================
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build

# ============================================================
# Stage 2: runtime (imagen oficial de AWS Lambda para Node.js)
# ============================================================
FROM public.ecr.aws/lambda/nodejs:20 AS runtime

# `simple-git` (usado por FilesystemRepoFetcherAdapter) invoca el binario
# `git` del sistema operativo para clonar repositorios públicos, así que
# debe estar instalado en la imagen (la base de Lambda no lo trae por defecto).
RUN dnf install -y git && dnf clean all

WORKDIR ${LAMBDA_TASK_ROOT}

# Solo dependencias de producción en la imagen final (imagen más liviana)
COPY package*.json ./
RUN npm ci --omit=dev

# Código ya compilado desde el stage de build
COPY --from=build /app/dist ./dist

# Entry point: src/handler.ts -> dist/handler.js, exporta `handler`
CMD ["dist/handler.handler"]
