# ============================================================
# S3: hosting estático para el frontend Angular
# ============================================================
resource "aws_s3_bucket" "web" {
  bucket = "${var.project_name}-web"

  # Permite que `terraform destroy` borre el bucket aunque contenga objetos
  # (útil para ambientes de prueba/desarrollo; evalúalo con cuidado en prod).
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket = aws_s3_bucket.web.id

  # Cuando CloudFront está activo, el bucket queda 100% privado: el único
  # acceso permitido es el de la propia distribución de CloudFront, vía
  # Origin Access Control (OAC) + bucket policy (ver más abajo). Si
  # CloudFront está deshabilitado, se mantiene el acceso público directo
  # (fallback histórico, para poder probar sin CDN).
  block_public_acls       = var.enable_cloudfront
  block_public_policy     = var.enable_cloudfront
  ignore_public_acls      = var.enable_cloudfront
  restrict_public_buckets = var.enable_cloudfront
}

resource "aws_s3_bucket_website_configuration" "web" {
  bucket = aws_s3_bucket.web.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

# Política pública de solo lectura: SOLO se crea si CloudFront está
# deshabilitado (fallback de acceso directo a S3 sin CDN).
data "aws_iam_policy_document" "web_public_read" {
  count = var.enable_cloudfront ? 0 : 1

  statement {
    sid       = "PublicReadGetObject"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.web.arn}/*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }
  }
}

resource "aws_s3_bucket_policy" "web_public_read" {
  count  = var.enable_cloudfront ? 0 : 1
  bucket = aws_s3_bucket.web.id
  policy = data.aws_iam_policy_document.web_public_read[0].json

  depends_on = [aws_s3_bucket_public_access_block.web]
}

# Política privada: SOLO CloudFront (vía Origin Access Control) puede leer
# objetos del bucket. Cualquier acceso directo a S3 (website endpoint o
# API de S3) queda bloqueado por el public_access_block de arriba; esta
# policy además restringe a nivel de IAM que únicamente la distribución
# de CloudFront específica (por ARN) pueda hacer GetObject.
data "aws_iam_policy_document" "web_cloudfront_oac" {
  count = var.enable_cloudfront ? 1 : 0

  statement {
    sid       = "AllowCloudFrontServicePrincipalReadOnly"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.web.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.web[0].arn]
    }
  }
}

resource "aws_s3_bucket_policy" "web_cloudfront_oac" {
  count  = var.enable_cloudfront ? 1 : 0
  bucket = aws_s3_bucket.web.id
  policy = data.aws_iam_policy_document.web_cloudfront_oac[0].json

  depends_on = [aws_s3_bucket_public_access_block.web]
}

# ============================================================
# Build del frontend Angular con la URL real de la API ya conocida,
# y sync automático hacia el bucket S3.
# ============================================================
locals {
  web_source_dir = "${path.module}/../code-insight-ai-web"
  # invoke_url de API Gateway siempre termina en "/"; se recorta para
  # evitar dobles slashes al concatenar rutas en el frontend (ej.
  # "${apiBaseUrl}/analysis").
  api_invoke_url = trimsuffix(aws_apigatewayv2_stage.default.invoke_url, "/")
}

resource "null_resource" "frontend_build_deploy" {
  triggers = {
    api_url      = local.api_invoke_url
    src_dir_hash = sha1(join("", [for f in fileset(local.web_source_dir, "src/**") : filemd5("${local.web_source_dir}/${f}")]))
  }

  provisioner "local-exec" {
    working_dir = local.web_source_dir
    command     = <<-EOT
      set -e
      cat > src/environments/environment.prod.ts << EOF
export const environment = {
  production: true,
  apiBaseUrl: '${local.api_invoke_url}',
  cognito: {
    region: '${var.aws_region}',
    userPoolId: '${aws_cognito_user_pool.users.id}',
    clientId: '${aws_cognito_user_pool_client.web.id}',
  },
};
EOF
      npm run build -- --configuration production
      aws s3 sync dist/code-insight-ai-web/browser s3://${aws_s3_bucket.web.id}/ --delete --region ${var.aws_region}
    EOT
  }

  depends_on = [
    aws_s3_bucket_policy.web_public_read,
    aws_s3_bucket_policy.web_cloudfront_oac,
    aws_s3_bucket_website_configuration.web,
    aws_apigatewayv2_stage.default,
    aws_cognito_user_pool.users,
    aws_cognito_user_pool_client.web,
  ]
}
