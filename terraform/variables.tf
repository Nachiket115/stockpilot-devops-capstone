variable "aws_region" {
  description = "AWS region for infrastructure provisioning"
  type        = string
  default     = "ap-south-1"
}

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "stockpilot-eks"
}

variable "azs" {
  description = "Availability zones in the chosen AWS region"
  type        = list(string)
  default = [
    "ap-south-1a",
    "ap-south-1b",
  ]
}
