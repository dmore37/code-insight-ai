variable "project_name" {
  description = "Prefijo usado para nombrar todos los recursos AWS del proyecto."
  type        = string
  default     = "codeai-tf"
}

variable "aws_region" {
  description = "Región de AWS donde se despliegan todos los recursos."
  type        = string
  default     = "us-east-1"
}

variable "bedrock_model_id" {
  description = "ID del modelo de Bedrock usado por la Lambda para el análisis con IA."
  type        = string
  default     = "amazon.nova-lite-v1:0"
}

variable "lambda_timeout_seconds" {
  description = "Timeout de la función Lambda, en segundos. Debe ser suficiente para el worker asíncrono de SQS (clonado + análisis estático + IA), no solo para la API síncrona."
  type        = number
  default     = 300
}

variable "lambda_memory_mb" {
  description = "Memoria asignada a la función Lambda, en MB."
  type        = number
  default     = 1024
}

variable "frontend_token_encryption_key" {
  description = <<-EOT
    Clave usada por el frontend para ofuscar (AES-GCM) el JWT de Cognito
    antes de guardarlo en sessionStorage. NO es un secreto real: termina
    embebida en el bundle JS público del navegador. Solo protege contra
    lectura casual del token en DevTools, no contra un atacante que
    inspeccione el código fuente. [FUTURO] reemplazar por un esquema sin
    exposición del token al navegador (cookies HttpOnly).
  EOT
  type        = string
  default     = "prod-obfuscation-key-change-me-2026"
  sensitive   = true
}

variable "docker_image_tag" {
  description = "Tag de la imagen Docker en ECR que usará la Lambda (debe existir antes de aplicar)."
  type        = string
  default     = "latest"
}

variable "enable_cloudfront" {
  description = "Si es true, crea una distribución de CloudFront delante del bucket S3 del frontend."
  type        = bool
  default     = false
}

variable "sqs_visibility_timeout_seconds" {
  description = "Visibility timeout de la cola SQS de análisis; debe ser >= lambda_timeout_seconds."
  type        = number
  default     = 300
}
