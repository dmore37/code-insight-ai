# ============================================================
# Cognito: autenticación de usuarios finales de la aplicación
# ============================================================
# User Pool: almacena los usuarios de CodeInsightAI (no confundir con
# usuarios/roles IAM, que son para administrar AWS; estos son usuarios
# finales de la app, ej. quien la usa desde el navegador).
resource "aws_cognito_user_pool" "users" {
  name = "${var.project_name}-users"

  # Permite iniciar sesión con el email como "username".
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

# App Client: representa la SPA de Angular. Sin secret (no aplica para
# apps públicas de navegador, donde no se puede guardar un secreto).
resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project_name}-web-client"
  user_pool_id = aws_cognito_user_pool.users.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
  ]

  access_token_validity  = 60 # minutos
  id_token_validity      = 60 # minutos
  refresh_token_validity = 30 # días

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  # Al importar este recurso desde un cliente ya existente, el provider a
  # veces no captura correctamente el atributo `generate_secret` (queda
  # como null en el state), lo que dispararía un reemplazo destructivo
  # innecesario (generate_secret es ForceNew). Lo ignoramos explícitamente
  # para evitar recrear el client y así invalidar el Client ID en uso por
  # el frontend ya desplegado.
  lifecycle {
    ignore_changes = [generate_secret]
  }
}
