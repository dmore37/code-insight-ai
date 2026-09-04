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

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
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

data "aws_iam_policy_document" "web_public_read" {
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
  bucket = aws_s3_bucket.web.id
  policy = data.aws_iam_policy_document.web_public_read.json

  depends_on = [aws_s3_bucket_public_access_block.web]
}

# ============================================================
# Build del frontend Angular con la URL real de la API ya conocida,
# y sync automático hacia el bucket S3.
# ============================================================
locals {
  web_source_dir = "${path.module}/../code-insight-ai-web"
  api_invoke_url = aws_apigatewayv2_stage.default.invoke_url
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
};
EOF
      npm run build -- --configuration production
      aws s3 sync dist/code-insight-ai-web/browser s3://${aws_s3_bucket.web.id}/ --delete --region ${var.aws_region}
    EOT
  }

  depends_on = [
    aws_s3_bucket_policy.web_public_read,
    aws_s3_bucket_website_configuration.web,
    aws_apigatewayv2_stage.default,
  ]
}
