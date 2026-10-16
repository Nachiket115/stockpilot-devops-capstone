# Known limitations and honest notes

## Limitations

### 1. Ingress and load balancer
AWS refused to create the load balancer for the ingress-nginx Service ("This AWS account currently does not support creating load balancers"; see `screenshots/M8-elb-denied-events.png`). The Ingress therefore has no external ADDRESS. Ingress routing was verified through `kubectl port-forward` to the ingress-nginx controller Service on localhost:8080, not through a public load balancer.

### 2. Postgres on EKS uses emptyDir
The cluster has no EBS CSI driver, so the Postgres pod uses `emptyDir` for storage. Data is lost if the pod restarts. The credentials in the Helm chart (`values.yaml`) are dev-only placeholders, not suitable for production.

### 3. Alembic migration race
Alembic migrations run at backend container start. With 2 replicas, the first boot can race and one pod may restart once. This is visible in the M8 evidence. It self-heals on the next attempt.

### 4. units_issued_total is per replica
The `units_issued_total` counter is an in-process Prometheus counter, so each backend pod tracks its own count. A `curl` through a port-forward reached one pod (showing 14.0), while the Grafana dashboard query `sum(units_issued_total)` aggregated both pods (showing 16).

### 5. localhost:3000/metrics returns the web page
In Compose, the frontend nginx only proxies `/api/` and `/health` to the backend. Accessing `/metrics` on port 3000 serves the React app's `index.html`. Prometheus on the cluster scrapes the backend Service directly through the ServiceMonitor, not through the frontend.

### 6. Terraform destroy took three attempts
The laptop lost DNS connectivity during the process.

- Attempt 1 failed while refreshing state and destroyed nothing.
- Attempt 2 destroyed 54 resources (node group, cluster, NAT gateway, VPC, etc.), then failed scheduling KMS key deletion.
- Attempt 3 destroyed the last 2 resources (KMS key alias and cluster IAM role).

Total: 56 resources. A reviewer who sees "2 destroyed" in one screenshot should read this note. The leftovers check (`screenshots/M7-no-leftovers.png`) shows no cluster, NAT gateway, Elastic IP, load balancer, or non-default VPC remaining. The KMS key stays in pending deletion for its standard waiting period.

### 7. Real AWS account
All Terraform and cluster evidence comes from a real AWS account in `ap-south-1`. No LocalStack or mocked credentials were used for this capstone.

### 8. Node.js 20 deprecation warnings
The Node.js 20 deprecation annotations visible in GitHub Actions are runner-level warnings only and do not affect the pipeline.

### 9. No HPA and no automated deploy job
Neither horizontal pod autoscaling nor an automated deployment job is part of the graded rubric (GRADING.md), so neither was built. Helm deploys were run manually.

# Known issues

## npm audit: esbuild <=0.24.2 via vite 5.4.21 (GHSA-67mh-4wv8-2f99, moderate)

- Affects the Vite dev server only: a malicious website could send requests to a running `npm run dev` server and read responses.
- Not present in the production image. The frontend Dockerfile is multi-stage, and only the compiled `dist/` static files are copied into the nginx image.
- The only fix npm offers is a major upgrade (Vite 8), which is a breaking change. Vite is pinned at 5.4.21, the latest 5.x release.
- Planned: upgrade to a current major version after the capstone is complete.
