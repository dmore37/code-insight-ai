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

output "dynamodb_table_name" {
  description = "Nombre de la tabla DynamoDB con el historial de análisis."
  value       = aws_dynamodb_table.analysis_history.name
}

output "sqs_queue_url" {
  description = "URL de la cola SQS de trabajos de análisis asíncronos."
  value       = aws_sqs_queue.analysis_jobs.url
}

output "cognito_user_pool_id" {
  description = "ID del User Pool de Cognito (usuarios finales de la app)."
  value       = aws_cognito_user_pool.users.id
}

output "cognito_user_pool_client_id" {
  description = "ID del App Client de Cognito usado por el frontend Angular."
  value       = aws_cognito_user_pool_client.web.id
}
