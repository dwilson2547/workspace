# Quick Start Guide - Kubernetes CronJob Manager

## 🚀 Getting Started in 5 Minutes

This guide will help you get the CronJob Manager up and running quickly.

## Prerequisites Check

```bash
# Check you have these installed:
docker --version        # Docker 20.10+
kubectl version        # Kubernetes client
go version            # Go 1.21+ (optional, for operator development)
python --version      # Python 3.11+ (optional, for backend development)
node --version        # Node.js 18+ (optional, for frontend development)
```

## Option 1: Deploy to Kubernetes (Recommended)

### Step 1: Build Images

```bash
cd cronjob-manager
make build
```

This builds all three Docker images:
- `cronjob-manager-backend:latest`
- `cronjob-manager-frontend:latest`
- `cronjob-manager-operator:latest`

### Step 2: Deploy

```bash
make deploy
```

This will:
- Create the `cronjob-manager` namespace
- Deploy the backend, frontend, and operator
- Set up RBAC permissions

### Step 3: Access the UI

```bash
# Option A: Port forward (for local clusters)
make port-forward
# Then open http://localhost:3000

# Option B: Get LoadBalancer IP (for cloud clusters)
kubectl get svc -n cronjob-manager cronjob-manager-frontend
# Access the EXTERNAL-IP in your browser
```

## Option 2: Local Development

### Run Everything Locally

```bash
# Terminal 1 - Backend
make dev-backend
# Runs on http://localhost:8000

# Terminal 2 - Frontend
make dev-frontend
# Runs on http://localhost:3000

# Terminal 3 - Operator (optional)
make dev-operator
```

### Or Use Docker Compose

```bash
make dev
# Backend on http://localhost:8000
# Frontend on http://localhost:3000
```

## First Steps After Installation

### 1. Create Your First CronJob

1. Open the web UI at http://localhost:3000
2. Click **"Create CronJob"**
3. Fill in the form:
   - **Name**: `hello-world`
   - **Namespace**: `default`
   - **Schedule**: `*/5 * * * *` (every 5 minutes)
   - **Image**: `busybox:latest`
   - **Args**: `echo Hello, World!`
4. Click **"Create CronJob"**

### 2. View Execution History

1. Click on the CronJob name in the dashboard
2. Switch to the **"Execution History"** tab
3. Wait 5 minutes for the first execution

### 3. View Logs

1. In the CronJob detail view, click **"Logs"** tab
2. Click **"Load Latest Logs"**
3. See the output from your job

## Common Commands

```bash
# View all resources
make status

# View logs
make logs-backend    # Backend logs
make logs-frontend   # Frontend logs
make logs-operator   # Operator logs

# Rebuild and redeploy
make build deploy

# Clean up everything
make clean
```

## Troubleshooting

### Backend Can't Connect to Kubernetes

```bash
# Check your kubeconfig
kubectl get nodes

# Check backend logs
make logs-backend
```

### Frontend Shows Connection Error

```bash
# Port forward backend
kubectl port-forward -n cronjob-manager svc/cronjob-manager-backend 8000:8000

# Update frontend to use localhost:8000
# (In development, set REACT_APP_API_URL=http://localhost:8000)
```

### Operator Not Working

```bash
# Check if operator is running
kubectl get pods -n cronjob-manager -l app=cronjob-manager-operator

# Check operator logs
make logs-operator

# Verify RBAC permissions
kubectl get clusterrole cronjob-manager-operator
```

## Next Steps

- Read the full [README.md](README.md) for detailed information
- Explore the API documentation at http://localhost:8000/docs
- Check out the example CronJob configurations
- Extend the operator with custom logic

## Example CronJob Schedules

```
*/5 * * * *      Every 5 minutes
0 * * * *        Every hour
0 0 * * *        Daily at midnight
0 0 * * 0        Weekly on Sunday
0 0 1 * *        Monthly on the 1st
0 9-17 * * 1-5   Every hour from 9 AM to 5 PM, Monday to Friday
```

## Environment Variables

### Backend
- `KUBECONFIG` - Path to kubeconfig (default: in-cluster config)

### Frontend
- `REACT_APP_API_URL` - Backend API URL (default: http://localhost:8000)

### Operator
- Configured via command-line flags (see README.md)

## Support

For issues or questions:
1. Check the logs with `make logs-*`
2. Verify the deployment with `make status`
3. Review the troubleshooting section in README.md

Happy CronJob managing! 🎉
