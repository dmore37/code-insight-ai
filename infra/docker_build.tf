# ============================================================
# Automatiza el build + push de la imagen Docker desde Terraform,
# usando un provisioner local-exec. Se re-ejecuta cada vez que cambia
# algún archivo fuente relevante del backend (trigger por hash).
#
# Esto es opcional: si prefieres controlar el build/push manualmente
# (o desde un pipeline de CI/CD separado), puedes eliminar este archivo
# y simplemente asegurarte de subir la imagen antes de `terraform apply`.
# ============================================================

locals {
  api_source_dir = "${path.module}/../code-insight-ai-api"
  ecr_image_uri  = "${aws_ecr_repository.api.repository_url}:${var.docker_image_tag}"
}

resource "null_resource" "docker_build_push" {
  # Se vuelve a ejecutar si cambia el Dockerfile o el código fuente
  triggers = {
    dockerfile_hash = filemd5("${local.api_source_dir}/Dockerfile")
    src_dir_hash    = sha1(join("", [for f in fileset(local.api_source_dir, "src/**") : filemd5("${local.api_source_dir}/${f}")]))
  }

  provisioner "local-exec" {
    working_dir = local.api_source_dir
    command     = <<-EOT
      set -e
      docker build --platform linux/amd64 -t ${var.project_name}-api:local .
      aws ecr get-login-password --region ${var.aws_region} | \
        docker login --username AWS --password-stdin ${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com
      docker tag ${var.project_name}-api:local ${local.ecr_image_uri}
      docker push ${local.ecr_image_uri}
    EOT
  }

  depends_on = [aws_ecr_repository.api]
}

# El tag de la imagen (por defecto "latest") es mutable: aunque docker push
# suba una imagen nueva, Terraform no detecta cambios en `image_uri` (el
# string no cambia) y por lo tanto NO actualiza el código de la Lambda por
# sí solo. Este recurso fuerza esa actualización explícitamente después de
# cada push, apuntando AMBAS Lambdas (api y worker, que comparten la misma
# imagen) al digest recién publicado.
resource "null_resource" "lambda_update_code" {
  triggers = {
    docker_build_push_id = null_resource.docker_build_push.id
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      aws lambda update-function-code \
        --function-name ${aws_lambda_function.api.function_name} \
        --image-uri ${local.ecr_image_uri} \
        --region ${var.aws_region} \
        --no-cli-pager
      aws lambda wait function-updated \
        --function-name ${aws_lambda_function.api.function_name} \
        --region ${var.aws_region}
      aws lambda update-function-code \
        --function-name ${aws_lambda_function.worker.function_name} \
        --image-uri ${local.ecr_image_uri} \
        --region ${var.aws_region} \
        --no-cli-pager
      aws lambda wait function-updated \
        --function-name ${aws_lambda_function.worker.function_name} \
        --region ${var.aws_region}
    EOT
  }

  depends_on = [null_resource.docker_build_push, aws_lambda_function.api, aws_lambda_function.worker]
}
