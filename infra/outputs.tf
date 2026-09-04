output "api_url" {
  description = "URL base de la API (API Gateway HTTP API)."
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "web_s3_website_url" {
  description = "URL del sitio estático servido directamente por S3 (HTTP)."
  value       = "http://${aws_s3_bucket_website_configuration.web.website_endpoint}"
}

output "web_cloudfront_url" {
  description = "URL del sitio servido vía CloudFront con HTTPS (solo si enable_cloudfront=true)."
  value       = var.enable_cloudfront ? "https://${aws_cloudfront_distribution.web[0].domain_name}" : "CloudFront deshabilitado (enable_cloudfront=false)"
}

output "ecr_repository_url" {
  description = "URI del repositorio ECR con la imagen del backend."
  value       = aws_ecr_repository.api.repository_url
}

output "lambda_function_name" {
  description = "Nombre de la función Lambda desplegada."
  value       = aws_lambda_function.api.function_name
}
