# ============================================================
# IAM: rol de ejecución para la Lambda
# ============================================================

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_role" {
  name               = "${var.project_name}-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

# Permite escribir logs en CloudWatch (requisito mínimo para que la Lambda funcione)
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Permite invocar únicamente el modelo de Bedrock configurado (menor privilegio)
data "aws_iam_policy_document" "bedrock_invoke" {
  statement {
    effect    = "Allow"
    actions   = ["bedrock:InvokeModel"]
    resources = ["arn:aws:bedrock:${var.aws_region}::foundation-model/${var.bedrock_model_id}"]
  }
}

resource "aws_iam_role_policy" "bedrock_invoke" {
  name   = "BedrockInvokeModel"
  role   = aws_iam_role.lambda_role.id
  policy = data.aws_iam_policy_document.bedrock_invoke.json
}

# Permite leer/escribir el historial de análisis en DynamoDB (tabla + GSI)
data "aws_iam_policy_document" "dynamodb_analysis_history" {
  statement {
    effect  = "Allow"
    actions = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Query"]
    resources = [
      aws_dynamodb_table.analysis_history.arn,
      "${aws_dynamodb_table.analysis_history.arn}/index/*",
    ]
  }
}

resource "aws_iam_role_policy" "dynamodb_analysis_history" {
  name   = "DynamoDbAnalysisHistory"
  role   = aws_iam_role.lambda_role.id
  policy = data.aws_iam_policy_document.dynamodb_analysis_history.json
}

# Permite publicar en la cola de trabajos y consumirla (event source mapping)
data "aws_iam_policy_document" "sqs_analysis_jobs" {
  statement {
    effect = "Allow"
    actions = [
      "sqs:SendMessage",
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
    ]
    resources = [aws_sqs_queue.analysis_jobs.arn]
  }
}

resource "aws_iam_role_policy" "sqs_analysis_jobs" {
  name   = "SqsAnalysisJobs"
  role   = aws_iam_role.lambda_role.id
  policy = data.aws_iam_policy_document.sqs_analysis_jobs.json
}
