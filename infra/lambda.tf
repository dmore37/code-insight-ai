# ============================================================
# Lambda: función basada en imagen de contenedor (ECR)
# ============================================================
resource "aws_lambda_function" "api" {
  function_name = "${var.project_name}-api"
  role          = aws_iam_role.lambda_role.arn
  package_type  = "Image"
  image_uri     = local.ecr_image_uri

  timeout     = var.lambda_timeout_seconds
  memory_size = var.lambda_memory_mb

  environment {
    variables = {
      BEDROCK_MODEL_ID         = var.bedrock_model_id
      DYNAMODB_TABLE_NAME      = aws_dynamodb_table.analysis_history.name
      DYNAMODB_GSI_NAME        = "byCreatedAt"
      DYNAMODB_GITURL_GSI_NAME = "byGitUrl"
      DYNAMODB_OWNER_GSI_NAME  = "byOwner"
      DYNAMODB_ZIPHASH_GSI_NAME = "byZipHash"
      SQS_QUEUE_URL            = aws_sqs_queue.analysis_jobs.url
      ZIP_UPLOADS_BUCKET       = aws_s3_bucket.zip_uploads.bucket
      COGNITO_USER_POOL_ID     = aws_cognito_user_pool.users.id
      COGNITO_CLIENT_ID        = aws_cognito_user_pool_client.web.id
    }
  }

  # Espera a que la imagen exista en ECR antes de crear/actualizar la función
  depends_on = [
    null_resource.docker_build_push,
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy.bedrock_invoke,
    aws_iam_role_policy.dynamodb_analysis_history,
    aws_iam_role_policy.sqs_analysis_jobs,
  ]
}

# Log group explícito (opcional, Lambda lo crearía igual automáticamente,
# pero declararlo permite controlar la retención de logs)
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${aws_lambda_function.api.function_name}"
  retention_in_days = 7
}

# ============================================================
# Lambda: worker asíncrono (misma imagen que la API, función separada)
# ============================================================
# Se usa la MISMA imagen Docker (aws_lambda_function.api reusa el mismo
# handler.ts, que detecta el tipo de evento), pero como función Lambda
# independiente para poder aislar timeout/memoria/concurrencia del
# procesamiento asíncrono (clonado de repos + análisis + IA) respecto
# de los endpoints HTTP síncronos.
resource "aws_lambda_function" "worker" {
  function_name = "${var.project_name}-worker"
  role          = aws_iam_role.lambda_role.arn
  package_type  = "Image"
  image_uri     = local.ecr_image_uri

  # Timeout más largo: clonar repo + análisis estático + IA puede tardar.
  timeout     = var.lambda_timeout_seconds
  memory_size = var.lambda_memory_mb

  environment {
    variables = {
      BEDROCK_MODEL_ID          = var.bedrock_model_id
      DYNAMODB_TABLE_NAME       = aws_dynamodb_table.analysis_history.name
      DYNAMODB_GSI_NAME         = "byCreatedAt"
      DYNAMODB_GITURL_GSI_NAME  = "byGitUrl"
      DYNAMODB_OWNER_GSI_NAME   = "byOwner"
      DYNAMODB_ZIPHASH_GSI_NAME = "byZipHash"
      SQS_QUEUE_URL             = aws_sqs_queue.analysis_jobs.url
      ZIP_UPLOADS_BUCKET        = aws_s3_bucket.zip_uploads.bucket
      COGNITO_USER_POOL_ID      = aws_cognito_user_pool.users.id
      COGNITO_CLIENT_ID         = aws_cognito_user_pool_client.web.id
    }
  }

  depends_on = [
    null_resource.docker_build_push,
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy.bedrock_invoke,
    aws_iam_role_policy.dynamodb_analysis_history,
    aws_iam_role_policy.sqs_analysis_jobs,
  ]
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/aws/lambda/${aws_lambda_function.worker.function_name}"
  retention_in_days = 7
}

