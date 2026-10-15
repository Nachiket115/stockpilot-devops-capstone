# Terraform Infrastructure for StockPilot EKS

This directory contains the Terraform configuration to provision a production-ready AWS Virtual Private Cloud (VPC) and an Amazon Elastic Kubernetes Service (EKS) cluster for StockPilot.

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) (>= 1.5)
- [AWS CLI](https://aws.amazon.com/cli/) configured with valid AWS credentials and default region (`ap-south-1`)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Helm](https://helm.sh/docs/intro/install/)

---

## Commands Workflow

### 1. Format
Ensure all configuration files adhere to standard canonical formatting:
```bash
terraform fmt -recursive
```

### 2. Initialize
Initialize the working directory, download required providers (`hashicorp/aws ~> 5.0`) and modules (`terraform-aws-modules/vpc/aws` and `terraform-aws-modules/eks/aws`):
```bash
terraform init
```

### 3. Validate
Validate that configuration files are syntactically valid and internally consistent:
```bash
terraform validate
```

### 4. Plan
Generate and inspect an execution plan to see what infrastructure will be created:
```bash
terraform plan -out=tfplan
```

### 5. Apply
Apply the changes to provision infrastructure on AWS:
```bash
terraform apply tfplan
```

After provisioning completes, configure your local `kubectl` context:
```bash
aws eks update-kubeconfig --region ap-south-1 --name stockpilot-eks
```

### 6. Destroy
Tear down all AWS resources managed by Terraform:
```bash
terraform destroy
```

---

## Estimated Hourly Resource Costs (Broad Estimates in `ap-south-1`)

| Resource | Quantity / Details | Approximate Hourly Cost | Notes |
| :--- | :--- | :--- | :--- |
| **EKS Control Plane** | 1 cluster | **~$0.10 / hr** | Standard support (Kubernetes 1.35, control plane ~$0.10/hr; avoids extended support cost of ~$0.60/hr) |
| **EC2 Managed Nodes** | 2 × `t3.medium` instances | **~$0.0832 / hr** (~$0.0416/hr each) | General purpose computing (2 vCPU, 4GB RAM) with AL2023 |
| **EBS Storage Volumes** | 2 × 20GB gp3 volumes | **~$0.0044 / hr** (~$0.08/GB-month) | Root volumes for worker nodes |
| **NAT Gateway** | 1 single NAT gateway | **~$0.045 / hr** (+ data transfer) | ~$32.40/month baseline |
| **Total Baseline** | | **~$0.23 / hr** (~$5.60 / day) | Excluding external data transfer / load balancers |

---

## IMPORTANT Teardown Warning

> [!WARNING]
> **Always clean up in-cluster Kubernetes resources before destroying infrastructure!**
>
> If you deploy Helm charts or Kubernetes manifests that provision cloud resources—specifically **LoadBalancer Services** (which provision AWS Network Load Balancers or Classic Load Balancers) or Persistent Volume Claims backed by AWS EBS:
>
> 1. Uninstall Helm releases first:
>    ```bash
>    helm uninstall stockpilot -n stockpilot
>    ```
> 2. Ensure all LoadBalancer Services are deleted and their AWS Load Balancers are fully deprovisioned:
>    ```bash
>    kubectl get svc --all-namespaces
>    ```
> 3. Verify in the AWS Console that no orphan Elastic Load Balancers or Security Groups remain attached to the VPC subnets.
>
> **Failure to do this will cause `terraform destroy` to hang or fail** because AWS will block the deletion of subnets, route tables, and the VPC while in-use elastic network interfaces (ENIs) or security group dependencies still exist.
