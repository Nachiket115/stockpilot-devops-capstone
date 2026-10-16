# Prometheus and Grafana Monitoring Setup

This guide details the deployment and operational verification of the Prometheus and Grafana monitoring stack (`kube-prometheus-stack`) on the EKS cluster, integrating custom metrics from StockPilot.

---

## 1. Repository Setup

Add and update the official Prometheus Community Helm chart repository:
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
```

---

## 2. Create Monitoring Namespace

Create the dedicated `monitoring` namespace:
```bash
kubectl create namespace monitoring
```

---

## 3. Install kube-prometheus-stack

Deploy the pinned chart version (`92.9.0`) using the resource-constrained, PVC-free values configuration:
```bash
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring \
  -f monitoring/kube-prometheus-stack-values.yaml \
  --version 92.9.0 \
  --wait \
  --timeout 10m
```

Verify that all monitoring components are running:
```bash
kubectl get pods -n monitoring
```

---

## 4. Install StockPilot Grafana Dashboard

Apply the StockPilot dashboard ConfigMap to the `monitoring` namespace (automatically picked up by the Grafana sidecar via label `grafana_dashboard: "1"`):
```bash
kubectl apply -f monitoring/grafana-dashboard.yaml
```

---

## 5. Enable StockPilot ServiceMonitor

Upgrade the StockPilot Helm release to enable the `ServiceMonitor` template (ensuring the image tags match your current deployment):
```bash
helm upgrade stockpilot ./helm/stockpilot \
  -n stockpilot \
  --set monitoring.enabled=true \
  --set backend.image.tag=740ffabc79f5617c7e3d21cd642c6551a621af9b \
  --set frontend.image.tag=740ffabc79f5617c7e3d21cd642c6551a621af9b
```

---

## 6. Accessing Dashboards & Prometheus

### A. Port-Forward Prometheus
Access Prometheus web UI at [http://localhost:9090](http://localhost:9090):
```bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
```
Navigate to **Status > Targets** and verify that `serviceMonitor/stockpilot/stockpilot-backend/0` is listed as **UP** (1/1 or 2/2 endpoints).

### B. Port-Forward Grafana
Access Grafana web UI at [http://localhost:3001](http://localhost:3001):
```bash
kubectl port-forward -n monitoring svc/monitoring-grafana 3001:80
```

### C. Retrieve Grafana Admin Credentials
- **Username**: `admin`
- **Password**: Retrieve the automatically generated password directly from the Kubernetes Secret (do not write credentials into static files):
  ```bash
  kubectl get secret monitoring-grafana -n monitoring -o jsonpath='{.data.admin-password}' | base64 -d
  echo ""
  ```

Once logged in, open the **StockPilot** dashboard to view the four live panels:
1. **Request Rate by Handler**
2. **P95 Latency**
3. **5xx Rate**
4. **Units Issued**

---

## 7. Run Load Test

Ensure an ingress or frontend port-forward is running on port 8080:
```bash
# In a separate terminal tab:
kubectl port-forward -n stockpilot svc/stockpilot-frontend 8080:80
```

Execute the load test script to generate synthetic traffic and increment metrics:
```bash
./scripts/load-test.sh
```

---

## 8. Teardown (CRITICAL BEFORE TERRAFORM DESTROY)

> [!WARNING]
> Always uninstall monitoring Helm releases before running `terraform destroy`.

```bash
helm uninstall monitoring -n monitoring
kubectl delete namespace monitoring
```
