# CodeInsightAI

Herramienta que analiza automáticamente un repositorio de código fuente (vía URL de Git público o subiendo un archivo ZIP) y genera un informe con: descripción funcional, tecnologías detectadas, patrón de arquitectura, componentes clave, recomendaciones y riesgos — combinando análisis estático heurístico con IA generativa (Amazon Bedrock).

## Índice

- [Arquitectura](#arquitectura)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Cómo ejecutar en local](#cómo-ejecutar-en-local)
- [Cómo desplegar en AWS](#cómo-desplegar-en-aws)
- [Documentación adicional](#documentación-adicional)

## Arquitectura

Arquitectura hexagonal (Ports & Adapters) tanto en backend como en frontend, desplegada 100% serverless en AWS.

- Diagrama de arquitectura: se encuentra en la raiz del proyecto [Diagrama arquitectura.png]

### Flujo general

```
Usuario (Angular, S3 + CloudFront)
  → API Gateway (HTTP API)
    → Lambda "api" (NestJS, síncrono: POST /analysis)
    → Lambda "api" (NestJS, asíncrono: POST /analysis/async → SQS)
        → SQS → Lambda "worker" (misma imagen Docker, procesa el job)
          → clona el repo (Git) o descarga el ZIP (S3)
          → análisis estático heurístico (estructura de carpetas, componentes, lenguaje)
          → análisis con IA (Amazon Bedrock, con fallback heurístico si falla)
          → guarda resultado en DynamoDB
  ← polling del frontend a GET /analysis/:id hasta que termine
```

Autenticación con Amazon Cognito; el JWT se valida manualmente dentro de la Lambda (sin Authorizer de API Gateway).

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | NestJS 11 (TypeScript), arquitectura hexagonal |
| Frontend | Angular (standalone components, Signals), arquitectura hexagonal |
| Cómputo | AWS Lambda (contenedores Docker, 2 funciones: `api` + `worker` compartiendo la misma imagen) |
| API | API Gateway (HTTP API) |
| Mensajería asíncrona | Amazon SQS + DLQ |
| Persistencia | Amazon DynamoDB (tabla única + 4 GSIs) |
| Almacenamiento de archivos | Amazon S3 (frontend estático + ZIPs subidos) |
| CDN | Amazon CloudFront |
| Autenticación | Amazon Cognito |
| IA generativa | Amazon Bedrock (Nova/Claude) |
| Infraestructura como código | Terraform |
| Testing | Jest |

## Estructura del repositorio

```
code-insight-ai/
├── code-insight-ai-api/    # Backend NestJS (hexagonal: domain / application / infrastructure)
├── code-insight-ai-web/    # Frontend Angular (hexagonal: core / features)
├── infra/                  # Terraform: toda la infraestructura AWS
├── docs/                   # Sustentación técnica y diagrama de arquitectura
└── scripts/                # Scripts auxiliares
```

## Cómo ejecutar en local

### Backend

```bash
cd code-insight-ai-api
npm install
npm run start:dev
```

Requiere variables de entorno (AWS Region, tabla DynamoDB, cola SQS, bucket S3, Cognito User Pool/Client, modelo de Bedrock) — ver `.env.example` si existe, o los valores por defecto en `infra/variables.tf`.

### Frontend

```bash
cd code-insight-ai-web
npm install
npm start
```

Configura `src/environments/environment.ts` con la URL de tu API local y tus credenciales de Cognito de desarrollo.

## Cómo desplegar en AWS

Todo el despliegue (infraestructura + build/push del backend + build/deploy del frontend) se hace con un solo comando de Terraform.

### Prerrequisitos

- Terraform >= 1.5.0
- AWS CLI configurado con credenciales válidas
- Docker (para construir la imagen del backend)
- Node.js/npm (para compilar el frontend)
- Acceso habilitado a Amazon Bedrock en la región elegida

### Pasos

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# Ajusta las variables si lo necesitas (region, nombre del proyecto, modelo de Bedrock, etc.)

terraform init
terraform plan -out=tfplan
terraform apply "tfplan"
```

Al finalizar, Terraform muestra las URLs y recursos creados (`api_url`, `web_cloudfront_url` o `web_s3_website_url`, `cognito_user_pool_id`, etc. — ver `infra/outputs.tf`).

> El `terraform apply` no solo crea infraestructura: también construye y sube la imagen Docker del backend a ECR, actualiza el código de ambas Lambdas (`api` y `worker`), y compila + sincroniza el frontend Angular hacia S3, inyectando automáticamente la URL real de la API y la configuración de Cognito ya creada.

### Variables principales (`infra/variables.tf`)

| Variable | Descripción | Default |
|---|---|---|
| `project_name` | Prefijo de nombres de recursos AWS | `codeai-tf` |
| `aws_region` | Región de despliegue | `us-east-1` |
| `bedrock_model_id` | Modelo de Bedrock usado para el análisis con IA | `amazon.nova-lite-v1:0` |
| `enable_cloudfront` | Si se crea CloudFront delante del bucket S3 | `false` |
| `lambda_timeout_seconds` | Timeout de las Lambdas (debe cubrir clonado + análisis) | `300` |
| `lambda_memory_mb` | Memoria asignada a las Lambdas | `1024` |

## Documentación adicional

- [`code-insight-ai-api/README.md`](code-insight-ai-api/README.md) — README específico del backend
- [`code-insight-ai-web/README.md`](code-insight-ai-web/README.md) — README específico del frontend
