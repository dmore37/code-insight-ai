# ============================================================
# DynamoDB: historial de análisis
# ============================================================
# Esquema:
# - PK: id (string) — identificador único del análisis.
# - GSI "byCreatedAt": PK=gsiPk (constante "ALL"), SK=createdAt, permite
#   listar los análisis más recientes con una sola Query ordenada, sin
#   necesidad de un Scan sobre toda la tabla.
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

  global_secondary_index {
    name            = "byCreatedAt"
    hash_key        = "gsiPk"
    range_key       = "createdAt"
    projection_type = "ALL"
  }
}
