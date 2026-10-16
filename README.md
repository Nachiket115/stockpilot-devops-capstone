# StockPilot

StockPilot is a warehouse inventory management application built as a DevOps capstone project. It consists of a FastAPI backend (Python 3.12), a React 18 frontend served by Nginx, and a PostgreSQL 16 database. The full stack is containerised, tested in CI, scanned for vulnerabilities, provisioned on AWS EKS with Terraform, deployed with Helm, and monitored with Prometheus and Grafana.

## Table of contents

1. [Architecture](#architecture)
2. [Repository layout](#repository-layout)
3. [Quick start (local)](#quick-start-local)
4. [API reference](#api-reference)
5. [Rubric walkthrough (M1--M10)](#rubric-walkthrough)
6. [Known limitations and honest notes](#known-limitations-and-honest-notes)
7. [Teardown and cost notes](#teardown-and-cost-notes)

---

## Architecture

### System architecture

```mermaid
graph LR
    Browser -->|HTTP| IngressNginx["ingress-nginx controller"]
    IngressNginx -->|"/ (Prefix)"| Frontend["frontend (nginx)"]
    IngressNginx -->|"/api (Prefix)"| Backend["backend (FastAPI)"]
    Backend --> Postgres["PostgreSQL 16"]
    Prometheus -->|"scrape /metrics"| Backend
    Grafana -->|"query"| Prometheus
```

### CI/CD pipeline

```mermaid
graph LR
    Push["push to main"] --> Test["test job (pytest + npm build)"]
    Test --> Build["build-scan-push job"]
    Build --> TrivyBE["Trivy scan backend"]
    Build --> TrivyFE["Trivy scan frontend"]
    TrivyBE --> PushGHCR["push to GHCR (SHA tag)"]
    TrivyFE --> PushGHCR
    PushGHCR -.->|"manual"| HelmUpgrade["helm upgrade"]
```

---

## Repository layout

```
.
├── .github/workflows/ci-cd.yml   # GitHub Actions CI/CD pipeline
├── backend/
│   ├── Dockerfile                 # python:3.12-slim-bookworm, non-root UID 10001
│   ├── alembic.ini                # Alembic config
│   ├── alembic/                   # Migration scripts
│   ├── app/
│   │   ├── main.py                # FastAPI app, /health, /ready, /metrics
│   │   ├── models.py              # Item model with hybrid status property
│   │   ├── schemas.py             # Pydantic request/response schemas
│   │   ├── routers/items.py       # Items CRUD + /issue + /stats
│   │   ├── config.py              # pydantic-settings config
│   │   └── db.py                  # SQLAlchemy engine and session
│   ├── tests/
│   │   ├── conftest.py            # SQLite in-memory test fixtures
│   │   └── test_api.py            # 22 pytest tests
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── Dockerfile                 # Multi-stage: node:22-alpine -> nginxinc/nginx-unprivileged:1.27-alpine
│   ├── nginx.conf                 # Reverse-proxy to stockpilot-backend:8000
│   ├── src/                       # React 18 + Vite
│   └── package.json
├── docker-compose.yml             # Three-service local stack
├── docs/
│   ├── known_issues.md            # Dev-only npm audit finding
│  
│   └── screenshots/               # 37 evidence screenshots (M1--M9)
├── helm/stockpilot/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/                 # 9 templates (deployments, services, ingress, servicemonitor, etc.)
├── k8s/
│   ├── namespace.yaml             # stockpilot namespace
│   └── ingress-nginx-values.yaml  # ingress-nginx chart 4.15.1 overrides
├── monitoring/
│   ├── kube-prometheus-stack-values.yaml  # Chart 92.9.0 overrides
│   └── grafana-dashboard.yaml     # ConfigMap with 4-panel dashboard
├── scripts/
│   └── load-test.sh               # 150s load generator (no external deps)
├── terraform/
│   ├── versions.tf                # required_version >= 1.5, aws ~> 5.0
│   ├── variables.tf               # region, cluster_name, azs
│   ├── main.tf                    # VPC module 5.13.0 + EKS module ~> 20.0
│   ├── outputs.tf                 # cluster_name, endpoint, vpc_id, kubeconfig
│   ├── terraform.tfvars.example
│   └── .terraform.lock.hcl        # Committed lock file
└── .gitignore
```

---

## Quick start (local)

### Prerequisites

- Docker and Docker Compose

### Run

```bash
docker compose up --build
```

| Service  | URL                       |
|----------|---------------------------|
| UI       | http://localhost:3000      |
| API      | http://localhost:8000      |
| API docs | http://localhost:8000/docs |

### Run tests

```bash
cd backend
pip install -r requirements.txt
pytest -v
```

Tests use an in-memory SQLite database and never touch PostgreSQL.

### Migrations

Alembic migrations run automatically when the backend container starts (`alembic upgrade head` in the Dockerfile CMD).

### Environment variables

Copy `backend/.env.example` and edit if needed:

```
DATABASE_URL=postgresql+psycopg://stockpilot:stockpilot@localhost:5432/stockpilot
```

In Compose the `DATABASE_URL` is set directly in `docker-compose.yml` and points at the `postgres` service.

---

## API reference

| Method | Path                       | Purpose                        | Success | Error codes         |
|--------|----------------------------|--------------------------------|---------|---------------------|
| GET    | `/health`                  | Liveness probe                 | 200     |                     |
| GET    | `/ready`                   | Readiness probe (DB check)     | 200     | 503                 |
| GET    | `/metrics`                 | Prometheus metrics (OpenMetrics) | 200   |                     |
| GET    | `/api/items`               | List all items (optional `?status=` filter) | 200 |             |
| POST   | `/api/items`               | Create an item                 | 201     | 409 (duplicate SKU), 422 |
| GET    | `/api/items/stats`         | Aggregate counts by status     | 200     |                     |
| GET    | `/api/items/{id}`          | Get one item by ID             | 200     | 404                 |
| PUT    | `/api/items/{id}`          | Update an item                 | 200     | 404, 409, 422       |
| DELETE | `/api/items/{id}`          | Delete an item                 | 204     | 404                 |
| POST   | `/api/items/{id}/issue`    | Issue stock (atomic decrement) | 200     | 404, 409, 422       |

---

## Rubric walkthrough

### M1 -- Application

**What was built.** A warehouse inventory tracker. The backend is FastAPI 0.143.1 with PostgreSQL 16. The `Item` model has fields: `id`, `name`, `sku` (unique), `category`, `quantity`, `reorder_level`, `location`, `created_at`. The `status` field is a hybrid property derived at query time:

- `quantity == 0` -> `OUT_OF_STOCK`
- `quantity <= reorder_level` -> `LOW`
- otherwise -> `IN_STOCK`

**Business rule: stock never goes below zero.** The `/api/items/{id}/issue` endpoint uses a single atomic SQL statement:

```sql
UPDATE items SET quantity = quantity - :q WHERE id = :id AND quantity >= :q
```

If the WHERE clause matches zero rows, the API returns 409 Conflict with a message like `"Insufficient stock for SKU WIDGET-01: 3 on hand, cannot issue 5"`. A database-level `CHECK (quantity >= 0)` constraint acts as a safety net. Duplicate SKU creation also returns 409.

The frontend is React 18 built with Vite 5.4.21. It shows an item table, status badges, a create/edit modal, an issue-stock modal, and a live stats strip from `/api/items/stats`. The database is managed by Alembic.

**Verify:**

```bash
docker compose up --build
# Open http://localhost:3000
# Create an item, try to issue more than available -> 409
curl -s http://localhost:8000/health
curl -s http://localhost:8000/api/items/stats
```

**Evidence:**

![modal-screenshot](docs/screenshots/modal-screenshot.png)
![409-error-screenshot](docs/screenshots/409-error-screenshot.png)
![insufficient-stock-screenshot](docs/screenshots/insufficient-stock-screenshot.png)

---

### M2 -- Testing

**What was built.** 22 pytest tests in `backend/tests/test_api.py`. The test database is an in-memory SQLite instance configured in `conftest.py` with a `get_db` dependency override. Tests never connect to PostgreSQL.

Tests cover: `/health`, `/ready`, `/metrics` counter presence, item creation with status derivation, status boundary conditions (OUT_OF_STOCK at 0, LOW at reorder_level, IN_STOCK above), get by ID, 404 on unknown ID, list with status filter, `/stats` aggregate counts, validation rejections (negative quantity, empty name, empty SKU), duplicate SKU on create (409), duplicate SKU on update (409), update recalculates status, delete then 404, issue success, issue insufficient stock (409), issue unknown ID (404), issue zero/negative quantity (422).

**Verify:**

```bash
cd backend
pytest -v
```

**Evidence:**

![M2-pytest](docs/screenshots/M2-pytest.png)

---

### M3 -- Git

**What was built.** The repository uses conventional commits (e.g. `ci:`, `build(docker):`, `fix(deps):`, `infra(terraform):`, `deploy(helm):`, `observability:`, `docs:`). The `.gitignore` excludes `.env` files, `__pycache__`, `node_modules`, `dist`, `.terraform/`, `*.tfstate`, `*.tfstate.*`, `*.tfvars` (but not `*.tfvars.example`), and `.DS_Store`. No secrets, credentials, or access keys are committed.

**Verify:**

```bash
git log --oneline
cat .gitignore
```

Commits: [https://github.com/Nachiket115/stockpilot-devops-capstone/commits/main](https://github.com/Nachiket115/stockpilot-devops-capstone/commits/main)

---

### M4 -- Docker

**What was built.**

- **Backend image:** `python:3.12-slim-bookworm`. Runs `apt-get upgrade`, installs pip dependencies, copies application code, creates a non-root user (UID 10001), runs as `USER 10001`. CMD runs `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- **Frontend image:** Two-stage build. Stage 1 (`node:22-alpine`) runs `npm ci` and `npm run build`. Stage 2 (`nginxinc/nginx-unprivileged:1.27-alpine`) runs `apk upgrade --no-cache`, copies only the compiled `dist/` and `nginx.conf`. Runs as the default `nginx` user (UID 101) on port 8080.
- **Compose:** Three services (`postgres`, `stockpilot-backend`, `stockpilot-frontend`). Postgres has a `pg_isready` healthcheck with `service_healthy` dependency. A named volume `postgres_data` persists data. The single backend hostname `stockpilot-backend` is shared by the nginx reverse proxy config, the Compose service name, and the Helm chart service name.

**Verify:**

```bash
docker compose up --build
docker compose ps
# UI at localhost:3000, API at localhost:8000
```

**Evidence:**

![M4-compose-screenshot](docs/screenshots/M4-compose-screenshot.png)
![M4-compose-screenshot-2](docs/screenshots/M4-compose-screenshot-2.png)
![M4-browser-screenshot](docs/screenshots/M4-browser-screenshot.png)

---

### M5 -- CI/CD

**What was built.** `.github/workflows/ci-cd.yml` with two jobs:

1. **`test`** (runs on `ubuntu-24.04`): checks out code, sets up Python 3.12 and Node.js 22, installs dependencies, runs `pytest -v`, runs `npm ci` and `npm run build`.
2. **`build-scan-push`** (needs `test`, runs on `ubuntu-24.04`): computes lowercase GHCR owner, builds both images tagged with the commit SHA (never `latest`), scans both with Trivy (`aquasecurity/trivy-action@v0.36.0`, `exit-code: 1`, `severity: HIGH,CRITICAL`, `ignore-unfixed: true`), then pushes to GHCR only on `push` events (not PRs).

The pipeline stops at the GHCR push. There is no automated deploy job. Helm deploys were run manually from a local machine.

Packages are public. Images can be pulled without authentication:

```bash
docker pull ghcr.io/nachiket115/stockpilot-backend:<sha>
docker pull ghcr.io/nachiket115/stockpilot-frontend:<sha>
```

**Verify:**

```bash
cat .github/workflows/ci-cd.yml
# Check Actions tab: https://github.com/Nachiket115/stockpilot-devops-capstone/actions
# Check packages: https://github.com/Nachiket115?tab=packages
```

**Evidence:**

![M5-actions-runs](docs/screenshots/M5-actions-runs.png)
![M5-ghcr-backend](docs/screenshots/M5-ghcr-backend.png)
![M5-ghcr-frontend](docs/screenshots/M5-ghcr-frontend.png)

---

### M6 -- Trivy

**What was built.** Both images are scanned in CI with Trivy (`HIGH,CRITICAL`, `ignore-unfixed`, `exit-code 1`). No `.trivyignore` file is used.

**Story of the fix.** The first scan found 3 HIGH findings in Starlette 0.41.3. The cause: `fastapi==0.115.6` and `prometheus-fastapi-instrumentator==7.0.2` both capped Starlette at an old version. The fix was to upgrade all three together: `fastapi==0.143.1`, `prometheus-fastapi-instrumentator==8.1.0`, and `starlette==1.8.0`, using the test suite as a safety net. Result: 0 vulnerabilities in both images.

The frontend scan output shows `"Number of language-specific files num=0"` because the runtime image contains only compiled static files from the multi-stage build -- no `node_modules` ship in the production image. The dev-only npm audit finding (esbuild via Vite 5.4.21) is documented in `docs/known_issues.md` and does not affect the deployed image.

**Verify:**

```bash
# Trivy scans run automatically in CI. Check the Actions log for the scan steps.
# Or scan locally:
docker build -t stockpilot-backend:test ./backend
trivy image --severity HIGH,CRITICAL --ignore-unfixed stockpilot-backend:test
```

**Evidence:**

![M6-trivy-backend-1](docs/screenshots/M6-trivy-backend-1.png)
![M6-trivy-backend-2](docs/screenshots/M6-trivy-backend-2.png)
![M6-trivy-backend-3](docs/screenshots/M6-trivy-backend-3.png)
![M6-trivy-frontend](docs/screenshots/M6-trivy-frontend.png)

---

### M7 -- Terraform

**What was built.** Infrastructure-as-code in `terraform/`:

- **Provider:** `hashicorp/aws ~> 5.0` (resolved to `5.100.0` in the lock file). Region `ap-south-1`.
- **VPC:** `terraform-aws-modules/vpc/aws` version `5.13.0`. CIDR `10.0.0.0/16`, 2 public + 2 private subnets across `ap-south-1a` and `ap-south-1b`, single NAT gateway, DNS hostnames and support enabled. Public subnets tagged `kubernetes.io/role/elb = 1`, private subnets tagged `kubernetes.io/role/internal-elb = 1`.
- **EKS:** `terraform-aws-modules/eks/aws ~> 20.0` (resolved to `20.37.2`). Cluster name `stockpilot-eks`, Kubernetes version `1.35`. Public endpoint. One managed node group `default`: `t3.medium`, `AL2023_x86_64_STANDARD`, min 1, max 3, desired 2.
- **Why version 1.35:** EKS 1.31 is in extended support, which costs roughly $0.60/hr instead of $0.10/hr under standard support. Version 1.35 is under standard support.
- **Resources:** 56 total (plan and apply).
- **Files:** `versions.tf`, `variables.tf`, `main.tf`, `outputs.tf`, `terraform.tfvars.example`, `.terraform.lock.hcl` (committed). State and plan files are gitignored.

**Verify:**

```bash
cd terraform
terraform init
terraform fmt -check
terraform validate
terraform plan
# terraform apply    (creates real AWS resources and costs money)
# terraform destroy  (tear down)
```

**Evidence:**

![M7-plan-top](docs/screenshots/M7-plan-top.png)
![M7-plan-bottom](docs/screenshots/M7-plan-bottom.png)
![M7-apply-complete](docs/screenshots/M7-apply-complete.png)
![M7-console-vpc](docs/screenshots/M7-console-vpc.png)
![M7-console-subnets](docs/screenshots/M7-console-subnets.png)
![M7-console-eks](docs/screenshots/M7-console-eks.png)
![M7-console-eks-detail](docs/screenshots/M7-console-eks-detail.png)
![M7-console-nodegroup](docs/screenshots/M7-console-nodegroup.png)
![M7-kubectl-nodes](docs/screenshots/M7-kubectl-nodes.png)
![M7-kubectl-system-pods](docs/screenshots/M7-kubectl-system-pods.png)
![M7-destroy-pass1](docs/screenshots/M7-destroy-pass1.png)
![M7-destroy-pass2](docs/screenshots/M7-destroy-pass2.png)
![M7-no-leftovers](docs/screenshots/M7-no-leftovers.png)

---

### M8 -- Kubernetes and Helm

**What was built.**

- **Namespace:** `stockpilot` (defined in `k8s/namespace.yaml`).
- **Helm chart:** `helm/stockpilot/` (apiVersion v2, version 1.0.0). Templates: `backend-deployment.yaml`, `backend-service.yaml`, `frontend-deployment.yaml`, `frontend-service.yaml`, `postgres-deployment.yaml`, `postgres-service.yaml`, `postgres-secret.yaml`, `ingress.yaml`, `servicemonitor.yaml`.
- **Replicas:** 2 for backend, 2 for frontend, 1 for Postgres.
- **Probes:** Backend has a `startupProbe` on `/health` (failureThreshold 30, periodSeconds 2), readiness on `/ready`, liveness on `/health`. Frontend has readiness and liveness on `/`.
- **Security:** Backend runs as UID 10001 (`runAsNonRoot: true`). Frontend runs as UID 101. Postgres runs as UID/GID 70.
- **initContainer:** Backend deployment has an init container that waits for Postgres to be ready before starting.
- **Services:** Fixed names `stockpilot-backend` (port 8000), `stockpilot-frontend` (port 80), `stockpilot-postgres` (port 5432).
- **Ingress:** `ingressClassName: nginx`, no host rule. Paths: `/api` (Prefix) -> `stockpilot-backend:8000`, `/` (Prefix) -> `stockpilot-frontend:80`.
- **ingress-nginx:** Chart version 4.15.1, values in `k8s/ingress-nginx-values.yaml` (NLB type LoadBalancer).
- **Default image tag:** The SHA of the latest CI build (`740ffabc79f5617c7e3d21cd642c6551a621af9b` in `values.yaml`).

**Verify:**

```bash
helm lint helm/stockpilot/
helm template stockpilot helm/stockpilot/
# On a live cluster:
kubectl get pods,svc,ingress -n stockpilot
helm list -n stockpilot
```

**Evidence:**

![M8-helm-list](docs/screenshots/M8-helm-list.png)
![M8-kubectl-pods-svc-ingress](docs/screenshots/M8-kubectl-pods-svc-ingress.png)
![M8-browser-via-ingress](docs/screenshots/M8-browser-via-ingress.png)
![M8-curl-via-ingress](docs/screenshots/M8-curl-via-ingress.png)
![M8-elb-denied-events](docs/screenshots/M8-elb-denied-events.png)

---

### M9 -- Observability

**What was built.**

- **Application metrics:** `prometheus-fastapi-instrumentator` (version 8.1.0) auto-instruments all HTTP endpoints and exposes them on `/metrics`. A custom Prometheus counter `units_issued_total` is incremented each time stock is issued via the `/issue` endpoint.
- **Prometheus and Grafana:** `kube-prometheus-stack` chart version `92.9.0`, installed as release `monitoring` in namespace `monitoring`. Configuration in `monitoring/kube-prometheus-stack-values.yaml`: Alertmanager disabled, control-plane scrapers disabled (kubeEtcd, kubeScheduler, kubeControllerManager, kubeProxy), no PVCs (emptyDir), retention 6h, `serviceMonitorSelectorNilUsesHelmValues: false` so it picks up ServiceMonitors from all namespaces.
- **ServiceMonitor:** `helm/stockpilot/templates/servicemonitor.yaml`, gated by `{{- if .Values.monitoring.enabled }}`. Enabled at install time with `--set monitoring.enabled=true`. Scrapes `/metrics` on the `http` port every 15s from the `stockpilot` namespace.
- **Grafana dashboard:** `monitoring/grafana-dashboard.yaml` is a ConfigMap with label `grafana_dashboard: "1"` containing `stockpilot.json`. Four panels: Request Rate by Handler, P95 Latency, 5xx Rate, Units Issued (stat panel using `sum(units_issued_total)`).
- **Load test:** `scripts/load-test.sh`. Creates a test item, issues stock 5 times, then loops for 150 seconds (configurable via `DURATION`) sending 100 requests per round across `/api/items`, `/api/items/stats`, and `/health` with 4 concurrent workers. No external dependencies (uses only curl and xargs).

**Verify:**

```bash
# On the cluster:
kubectl get pods -n monitoring
kubectl port-forward svc/monitoring-kube-prometheus-prometheus 9090:9090 -n monitoring
# Open http://localhost:9090/targets -> stockpilot-backend target should be UP

kubectl port-forward svc/monitoring-grafana 3001:80 -n monitoring
# Open http://localhost:3001, default credentials admin/prom-operator
# Navigate to the "StockPilot" dashboard

# Run load test (pointed at backend via port-forward):
kubectl port-forward svc/stockpilot-backend 8080:8000 -n stockpilot
BASE_URL=http://localhost:8080 DURATION=60 bash scripts/load-test.sh
```

**Evidence:**

![M9-prometheus-pods](docs/screenshots/M9-prometheus-pods.png)
![M9-prometheus-targets](docs/screenshots/M9-prometheus-targets.png)
![M9-metrics-curl](docs/screenshots/M9-metrics-curl.png)
![M9-load-test](docs/screenshots/M9-load-test.png)
![M9-grafana-dashboard-before-load](docs/screenshots/M9-grafana-dashboard-before-load.png)
![M9-grafana-dashboard](docs/screenshots/M9-grafana-dashboard.png)

---

### M10 -- README and demo

This README. The EKS cluster was destroyed immediately after evidence capture to stop cost.

---

## Known limitations and honest notes

**a. Ingress and load balancer.** AWS refused to create the load balancer for the ingress-nginx Service ("This AWS account currently does not support creating load balancers"; see the M8-elb-denied-events screenshot above). The Ingress therefore has no external ADDRESS. Ingress routing was verified through `kubectl port-forward` to the ingress-nginx controller Service on localhost:8080, not through a public load balancer.

**b. Postgres on EKS uses emptyDir.** The cluster has no EBS CSI driver, so the Postgres pod uses `emptyDir` for storage. Data is lost if the pod restarts. The credentials in the Helm chart (`values.yaml`) are dev-only placeholders, not suitable for production.

**c. Alembic migration race.** Alembic migrations run at backend container start. With 2 replicas, the first boot can race and one pod may restart once. This is visible in the M8 evidence. It self-heals on the next attempt.

**d. units_issued_total is per replica.** The `units_issued_total` counter is an in-process Prometheus counter, so each backend pod tracks its own count. A `curl` through a port-forward reached one pod (showing 14.0), while the Grafana dashboard query `sum(units_issued_total)` aggregated both pods (showing 16).

**e. localhost:3000/metrics returns the web page.** In Compose, the frontend nginx only proxies `/api/` and `/health` to the backend. Accessing `/metrics` on port 3000 serves the React app's `index.html`. Prometheus on the cluster scrapes the backend Service directly through the ServiceMonitor, not through the frontend.

**f. Terraform destroy took three attempts.** The laptop lost DNS connectivity during the process. Attempt 1 failed while refreshing state and destroyed nothing. Attempt 2 destroyed 54 resources (node group, cluster, NAT gateway, VPC, etc.) then failed scheduling KMS key deletion. Attempt 3 destroyed the last 2 resources (KMS key alias and cluster IAM role). Total: 56 resources. A reviewer who sees "2 destroyed" in one screenshot should read this note. The leftovers check (M7-no-leftovers screenshot) shows no cluster, NAT gateway, Elastic IP, load balancer, or non-default VPC remaining. The KMS key stays in pending deletion for its standard waiting period.

**g. Real AWS account.** All Terraform and cluster evidence comes from a real AWS account in `ap-south-1`. No LocalStack or mocked credentials were used. The Node.js 20 deprecation annotations visible in GitHub Actions are runner-level warnings only and do not affect the pipeline.

**h. No HPA and no automated deploy job.** Neither horizontal pod autoscaling nor an automated deployment job was required by the rubric, so neither was built.

---

## Teardown and cost notes

The EKS cluster was destroyed immediately after evidence capture.

To tear down cleanly, always uninstall Helm releases before running `terraform destroy`. This ensures that AWS load balancers and ENIs created by ingress-nginx or Kubernetes Services are deleted first. If they are not, the VPC deletion will hang or fail because those resources hold references to the VPC subnets and security groups.

```bash
# 1. Uninstall Helm releases
helm uninstall monitoring -n monitoring
helm uninstall stockpilot -n stockpilot
helm uninstall ingress-nginx -n ingress-nginx

# 2. Wait for load balancers to be deleted (check the EC2 console)

# 3. Destroy Terraform resources
cd terraform
terraform destroy
```

The main cost drivers are:
- EKS control plane (~$0.10/hr on standard support, ~$0.60/hr on extended support)
- NAT gateway (~$0.045/hr + data charges)
- 2 x t3.medium EC2 instances (~$0.052/hr each in ap-south-1)

Estimated cost for a short-lived cluster (a few hours): under $5.
