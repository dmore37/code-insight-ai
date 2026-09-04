terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend local por defecto (el archivo terraform.tfstate se guarda en esta
  # misma carpeta). Para un entorno real/compartido se recomendaría un backend
  # remoto en S3 + DynamoDB para locking, pero para este proyecto de prueba
  # (cuenta sandbox efímera) el backend local es suficiente y más simple.
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}
