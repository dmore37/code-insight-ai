# ============================================================
# SQS: cola para procesamiento asíncrono de análisis
# ============================================================
# Cola de mensajes muertos (DLQ): si un mensaje falla más de
# `max_receive_count` veces, se mueve aquí en lugar de reintentarse para
# siempre. Útil para diagnosticar fallos recurrentes sin bloquear la cola.
resource "aws_sqs_queue" "analysis_jobs_dlq" {
  name                      = "${var.project_name}-analysis-jobs-dlq"
  message_retention_seconds = 1209600 # 14 días
}

resource "aws_sqs_queue" "analysis_jobs" {
  name = "${var.project_name}-analysis-jobs"

  # Debe ser >= al timeout de la Lambda consumidora, para evitar que el
  # mensaje vuelva a estar visible (y se reprocese) mientras aún se está
  # procesando.
  visibility_timeout_seconds = var.sqs_visibility_timeout_seconds

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.analysis_jobs_dlq.arn
    maxReceiveCount     = 3
  })
}

# Conecta la cola SQS como trigger de una Lambda dedicada al worker
# asíncrono. Usa la MISMA imagen Docker que la Lambda de la API
# (aws_lambda_function.api), pero como función separada para poder
# aislar timeout, memoria y concurrencia entre el flujo síncrono (HTTP)
# y el asíncrono (jobs de análisis). El handler.ts sigue detectando el
# tipo de evento igual, por compatibilidad.
resource "aws_lambda_event_source_mapping" "analysis_jobs" {
  event_source_arn = aws_sqs_queue.analysis_jobs.arn
  function_name    = aws_lambda_function.worker.arn
  batch_size       = 1
}
