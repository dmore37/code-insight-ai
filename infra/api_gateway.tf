# ============================================================
# API Gateway: HTTP API con integración proxy hacia la Lambda
# ============================================================
locals {
  # Origen real del frontend, para restringir CORS en vez de usar "*":
  # si CloudFront está habilitado, es su dominio HTTPS; si no, es el
  # website endpoint HTTP directo de S3 (fallback sin CDN).
  frontend_origin = var.enable_cloudfront ? "https://${aws_cloudfront_distribution.web[0].domain_name}" : "http://${aws_s3_bucket_website_configuration.web.website_endpoint}"
}

resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project_name}-api-gateway"
  protocol_type = "HTTP"

  # CORS gestionado por API Gateway (no por Nest/Express): así el
  # preflight OPTIONS se resuelve aquí mismo, sin invocar la Lambda y sin
  # depender de ningún authorizer. Importante: si más adelante se agrega
  # un JWT Authorizer a alguna ruta, el preflight OPTIONS de esa ruta NO
  # debe exigir el token (los navegadores nunca lo envían en el
  # preflight), por eso la autenticación de ZIP se valida dentro del
  # propio backend (ver `getOwnerId`) y no a nivel de ruta de API Gateway.
  #
  # allow_origins restringido al dominio real del frontend (CloudFront o
  # S3 website), en vez de "*": evita que scripts de otros sitios web
  # puedan invocar esta API usando la sesión del navegador de un usuario.
  # Nota: esto NO protege contra clientes que no son navegadores (curl,
  # Postman, scripts server-side), CORS es una política exclusiva del
  # navegador.
  cors_configuration {
    allow_origins = [local.frontend_origin]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "x-user-id"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

# JWT Authorizer nativo: valida el token de Cognito directamente en API
# Gateway (firma + expiración), sin invocar la Lambda si el token no es
# válido. El backend confía en que si la request llegó, ya está
# autenticada, y solo necesita leer el `sub` (id de usuario) del evento.
resource "aws_apigatewayv2_authorizer" "cognito_jwt" {
  api_id           = aws_apigatewayv2_api.api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.project_name}-cognito-jwt-authorizer"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.users.id}"
  }
}

resource "aws_apigatewayv2_route" "proxy" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"

  # Sin autenticación a nivel de ruta: la decisión de exigir sesión
  # (solo para ZIP, no para URL git pública) se resuelve dentro del
  # propio backend (ver AnalysisController + getOwnerId), verificando el
  # JWT de Cognito manualmente con `aws-jwt-verify`. Un JWT Authorizer de
  # API Gateway no permite esta distinción por endpoint/contenido.
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

# Permite que API Gateway invoque la Lambda
resource "aws_lambda_permission" "apigateway_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
