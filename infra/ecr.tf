# ============================================================
# ECR: repositorio para la imagen Docker del backend (NestJS + Lambda)
# ============================================================
resource "aws_ecr_repository" "api" {
  name                 = "${var.project_name}-api"
  image_tag_mutability = "MUTABLE"

  # Permite que `terraform destroy` borre el repositorio aunque contenga
  # imágenes (útil para ambientes de prueba/desarrollo).
  force_delete = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

# NOTA IMPORTANTE:
# Terraform NO construye ni sube la imagen Docker por sí mismo (eso requiere
# `docker build` + `docker push`, pasos que siguen siendo manuales o se
# automatizan aparte, por ejemplo en un pipeline de CI/CD).
#
# Este repositorio debe tener ya una imagen con el tag `var.docker_image_tag`
# ANTES de aplicar `lambda.tf`, porque la Lambda referencia esa imagen al
# crearse. Ver docs/deploy-manual-cli.sh (sección 1) para el build/push manual,
# o usa el recurso null_resource opcional en docker_build.tf.
