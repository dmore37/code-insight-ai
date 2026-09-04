# ============================================================
# S3: bucket privado para subida de repositorios comprimidos (ZIP)
# ============================================================
# Flujo: el frontend pide una URL prefirmada (presigned PUT) al backend,
# sube el ZIP directo a S3 (sin pasar por Lambda/API Gateway, evitando
# el límite de payload), y luego avisa al backend con la key del objeto
# para encolar el análisis. Los análisis por ZIP son siempre "private".
resource "aws_s3_bucket" "zip_uploads" {
  bucket        = "${var.project_name}-zip-uploads"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "zip_uploads" {
  bucket                  = aws_s3_bucket.zip_uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS: necesario para que el navegador pueda hacer PUT directo desde
# otro origen (el sitio S3 website) hacia este bucket.
resource "aws_s3_bucket_cors_configuration" "zip_uploads" {
  bucket = aws_s3_bucket.zip_uploads.id

  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = ["*"]
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

# Limpieza automática: los ZIP subidos se borran solos después de 1 día
# (ya se procesaron mucho antes; no hace falta conservarlos).
resource "aws_s3_bucket_lifecycle_configuration" "zip_uploads" {
  bucket = aws_s3_bucket.zip_uploads.id

  rule {
    id     = "expire-uploads"
    status = "Enabled"
    filter {}

    expiration {
      days = 1
    }
  }
}
