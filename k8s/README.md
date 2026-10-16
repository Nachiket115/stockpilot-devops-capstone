# Kubernetes & Helm Deployment for StockPilot

This guide describes the exact steps to deploy ingress-nginx and StockPilot to the EKS cluster (`stockpilot-eks`).

---

## 1. Ingress Controller Setup

### A. Add and update the repository
```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
```

### B. Chart Version Selection
Check available chart versions:
```bash
helm search repo ingress-nginx/ingress-nginx --versions | head -n 10
```
- **Selected and Pinned Chart Version**: **`4.15.1`** (App Version `1.15.1`).
- **Maintenance Status**: Actively maintained under the official Kubernetes SIGs repository (`kubernetes.github.io/ingress-nginx`). It is the current official NGINX Ingress controller for Kubernetes and is **not deprecated**.

---

## 2. Install Ingress-NGINX Controller

Deploy ingress-nginx into the dedicated `ingress-nginx` namespace using the custom values file configuring an AWS Network Load Balancer (NLB):
```bash
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --version 4.15.1 \
  -n ingress-nginx \
  --create-namespace \
  -f k8s/ingress-nginx-values.yaml
```

---

## 3. Create the StockPilot Namespace

Apply the namespace manifest (note: do not use `--create-namespace` for the application release):
```bash
kubectl apply -f k8s/namespace.yaml
```

---

## 4. Install StockPilot Application via Helm

Deploy the StockPilot stack (PostgreSQL, Backend, Frontend, Services, and Ingress) into the `stockpilot` namespace. Substitute `<sha>` with the actual image commit SHA built in CI/CD (default tag `740ffabc79f5617c7e3d21cd642c6551a621af9b`):

```bash
helm upgrade --install stockpilot ./helm/stockpilot \
  -n stockpilot \
  --set backend.image.tag=740ffabc79f5617c7e3d21cd642c6551a621af9b \
  --set frontend.image.tag=740ffabc79f5617c7e3d21cd642c6551a621af9b
```

---

## 5. Verification Steps

### A. Monitor Rollout Status
```bash
kubectl rollout status deployment/stockpilot-postgres -n stockpilot
kubectl rollout status deployment/stockpilot-backend -n stockpilot
kubectl rollout status deployment/stockpilot-frontend -n stockpilot
```

### B. Inspect Pods, Services, and Ingress
```bash
kubectl get pods,svc,ingress -n stockpilot -o wide
```

### C. Retrieve Load Balancer Hostname
Find the external hostname allocated to the ingress-nginx controller:
```bash
kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

### D. Test Endpoints
*(Note: AWS NLB DNS propagation and target health checks typically take 2-4 minutes to resolve upon creation)*:
```bash
# Test Frontend (SPA root)
curl -i http://<NLB-HOSTNAME>/

# Test Backend API
curl -i http://<NLB-HOSTNAME>/api/items
```

---

## 6. Troubleshooting

1. **NLB Annotation / Provisioning Failure**:
   If the AWS NLB annotation (`service.beta.kubernetes.io/aws-load-balancer-type: nlb`) fails or is unsupported in your AWS account configuration, remove the annotation from `k8s/ingress-nginx-values.yaml` and redeploy `ingress-nginx` to use the standard AWS Classic Load Balancer.

2. **Backend Replica First-Boot Restart**:
   When scaling 2 backend replicas from scratch, both containers execute `alembic upgrade head` upon boot. One replica may encounter a brief database lock or race condition during table migration and restart once before reaching a healthy state. The `startupProbe` (`failureThreshold: 30`, `periodSeconds: 2`) allows sufficient time for migrations to complete.

---

## 7. Known limitations

- **Postgres Storage**: Postgres uses an `emptyDir` volume, so data is lost on pod restart (this EKS cluster has no EBS CSI driver installed).
- **Placeholder Secrets**: Secret values are DEV ONLY placeholders. Replace with a production secret manager (such as External Secrets Operator or Sealed Secrets) outside this capstone.
- **Concurrent Alembic Migrations**: On first deploy, both backend replicas run `alembic upgrade head` at the same time. One may crash once and restart; the second run is a no-op. If a pod keeps restarting, check `kubectl logs <pod> -n stockpilot`, then scale the backend to 1 (`kubectl scale deploy/stockpilot-backend --replicas=1 -n stockpilot`), wait for Ready, then scale back to 2.
- **CI/CD Deployment Gating**: GitHub Actions cannot reach this cluster with a plain kubeconfig (EKS needs AWS IAM credentials), so the CI deploy job stays gated off; the demo rollout is run locally with:
  ```bash
  helm upgrade stockpilot ./helm/stockpilot -n stockpilot --set backend.image.tag=<sha> --set frontend.image.tag=<sha>
  ```
- **Phase 8 Monitoring Note**: After `kube-prometheus-stack` is installed in Phase 8, enable the ServiceMonitor with `--set monitoring.enabled=true`.

---

## 8. Teardown (CRITICAL BEFORE TERRAFORM DESTROY)

> [!WARNING]
> Always uninstall Helm releases and verify that cloud LoadBalancers are deleted before running `terraform destroy`. Failure to do so leaves orphaned AWS Elastic Load Balancers and ENIs, which will block Terraform from deleting VPC subnets and the VPC.

Run teardown in the following order:

```bash
# 1. Uninstall the application release
helm uninstall stockpilot -n stockpilot

# 2. Uninstall the ingress controller release (triggers AWS NLB deprovisioning)
helm uninstall ingress-nginx -n ingress-nginx

# 3. Verify no LoadBalancer services remain in any namespace
kubectl get svc -A | grep -i LoadBalancer

# 4. Check the AWS EC2 Console under "Load Balancers" to confirm the NLB is fully deleted
# 5. Delete the application namespace
kubectl delete -f k8s/namespace.yaml
```
