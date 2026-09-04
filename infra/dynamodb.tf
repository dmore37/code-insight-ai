# ============================================================
# DynamoDB: historial de análisis
# ============================================================
# Esquema:
# - PK: id (string) — identificador único del análisis.
# - GSI "byCreatedAt": PK=gsiPk (solo presente en registros "public"),
#   SK=createdAt. Es un índice DISPERSO: los registros "private" no
#   tienen el atributo `gsiPk`, así que quedan automáticamente excluidos
#   del feed público, sin filtrar nada en código.
# - GSI "byGitUrl": PK=gitUrl, SK=createdAt, permite buscar el análisis
#   completado más reciente de una URL específica (caché de resultados),
#   también sin Scan.
# - GSI "byOwner": PK=ownerId, SK=createdAt, permite listar TODOS los
#   análisis (públicos y privados) de un usuario autenticado específico.
# - GSI "byZipHash": PK=zipHash, SK=createdAt, permite cachear resultados
#   de ZIPs subidos por su contenido (hash SHA-256 calculado en el
#   cliente), evitando reanalizar el mismo archivo subido más de una vez
#   aunque su key en S3 sea distinta cada vez (incluye un UUID).
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

  attribute {
    name = "ownerId"
    type = "S"
  }

  attribute {
    name = "zipHash"
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

  global_secondary_index {
    name            = "byOwner"
    hash_key        = "ownerId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "byZipHash"
    hash_key        = "zipHash"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}
