# ============================================================
# DynamoDB: historial de análisis
# ============================================================
# Esquema:
# - PK: id (string) — identificador único del análisis.
# - GSI "byCreatedAt": PK=gsiPk (constante "ALL"), SK=createdAt, permite
#   listar los análisis más recientes con una sola Query ordenada, sin
#   necesidad de un Scan sobre toda la tabla.
# - GSI "byGitUrl": PK=gitUrl, SK=createdAt, permite buscar el análisis
#   completado más reciente de una URL específica (caché de resultados),
#   también sin Scan.
# - TTL (expiresAt): borrado automático de registros con más de 90 días,
#   para no acumular historial indefinidamente. Es una característica
#   nativa de DynamoDB, gratuita, y no afecta el "caché por gitUrl"
#   (que es una decisión de la app basada en `createdAt`, no en el TTL).
resource "aws_dynamodb_table" "analysis_history" {
  name         = "${var.project_name}-analysis-history"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "gsiPk"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  attribute {
    name = "gitUrl"
    type = "S"
  }

  global_secondary_index {
    name            = "byCreatedAt"
    hash_key        = "gsiPk"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "byGitUrl"
    hash_key        = "gitUrl"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}
