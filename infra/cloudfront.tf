# ============================================================
# CloudFront: CDN con HTTPS delante del bucket S3 (opcional).
# Usa el endpoint de "S3 website" como origen personalizado (Custom Origin),
# no como origen S3 nativo, para mantener el enfoque simple de bucket
# público que ya usamos en el despliegue manual.
# ============================================================
resource "aws_cloudfront_distribution" "web" {
  count = var.enable_cloudfront ? 1 : 0

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "CDN para frontend Angular - ${var.project_name}"

  origin {
    origin_id   = "s3-website-origin"
    domain_name = aws_s3_bucket_website_configuration.web.website_endpoint

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "s3-website-origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # Cache policy administrada por AWS: "CachingOptimized"
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
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
