# ============================================================
# CloudFront: CDN con HTTPS delante del bucket S3 (opcional).
# Usa Origin Access Control (OAC) hacia el bucket S3 privado (NO el
# website endpoint público): el bucket queda completamente bloqueado a
# acceso directo, y solo esta distribución de CloudFront puede leerlo
# (ver bucket policy en s3_frontend.tf, aws_s3_bucket_policy.web_cloudfront_oac).
# ============================================================
resource "aws_cloudfront_origin_access_control" "web" {
  count = var.enable_cloudfront ? 1 : 0

  name                              = "${var.project_name}-web-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "web" {
  count = var.enable_cloudfront ? 1 : 0

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "CDN para frontend Angular - ${var.project_name}"

  origin {
    origin_id                = "s3-oac-origin"
    domain_name               = aws_s3_bucket.web.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.web[0].id
  }

  default_cache_behavior {
    target_origin_id       = "s3-oac-origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # Cache policy administrada por AWS: "CachingOptimized"
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  # Angular usa routing del lado del cliente (client-side routing): rutas
  # como "/resultado" no existen como objeto real en S3. Un bucket privado
  # vía OAC responde 403 (no 404) a esas rutas, así que ambos códigos se
  # mapean a index.html con 200, dejando que Angular Router resuelva la
  # ruta en el navegador.
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Esta distribución fue creada manualmente en la consola de AWS y luego
  # importada a Terraform (ver `terraform import`). AWS le asocia
  # automáticamente un WAF Web ACL gratuito ("CreatedByCloudFront-...") y
  # un tag "Name" al crearla desde la consola; ambos se ignoran aquí para
  # que Terraform no intente eliminarlos en cada apply.
  lifecycle {
    ignore_changes = [web_acl_id, tags["Name"], tags_all["Name"]]
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
