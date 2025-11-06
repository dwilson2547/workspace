# Kubernetes CronJob Manager

A comprehensive web application for managing Kubernetes CronJobs with a React frontend, Python FastAPI backend, and a Kubernetes Operator built with Kubebuilder.

## Features

- 📋 **View all CronJobs** - List all managed CronJobs with their status
- ➕ **Create CronJobs** - Easy-to-use form for creating new CronJobs
- ✏️ **Edit CronJobs** - Modify schedules, images, and configurations
- 📊 **Execution History** - View past job executions with status
- 📝 **Job Logs** - View logs from job executions
- ⏸️ **Suspend/Resume** - Easily pause and resume CronJobs
- 🤖 **Kubernetes Operator** - Watches and manages CronJob resources

## Architecture

```
┌─────────────────┐
│  React Frontend │
│   (Port 3000)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  FastAPI Backend│──────────┐
│   (Port 8000)   │          │
└────────┬────────┘          │
         │                   │
         ▼                   ▼
┌─────────────────┐   ┌──────────────┐
│  Kubernetes API │   │   Operator   │
│                 │◄──┤ (Kubebuilder)│
└─────────────────┘   └──────────────┘
```

## Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- Docker
- Go 1.21+ (for operator development)
- Python 3.11+ (for backend development)
- Node.js 18+ (for frontend development)

## Quick Start

### 1. Build Docker Images

```bash
# Build backend
cd backend
docker build -t cronjob-manager-backend:latest .

# Build frontend
cd ../frontend
docker build -t cronjob-manager-frontend:latest .

# Build operator
cd ../operator
docker build -t cronjob-manager-operator:latest .
```

### 2. Deploy to Kubernetes

```bash
# Apply all manifests
kubectl apply -f k8s/deployment.yaml

# Check deployment status
kubectl get pods -n cronjob-manager

# Get frontend service URL
kubectl get svc -n cronjob-manager cronjob-manager-frontend
```

### 3. Access the Application

If using LoadBalancer:
```bash
kubectl get svc -n cronjob-manager cronjob-manager-frontend
# Access the EXTERNAL-IP in your browser
```

If using port-forward for local development:
```bash
# Forward frontend
kubectl port-forward -n cronjob-manager svc/cronjob-manager-frontend 3000:80

# Forward backend (if needed)
kubectl port-forward -n cronjob-manager svc/cronjob-manager-backend 8000:8000

# Open browser to http://localhost:3000
```

## Development Setup

### Backend Development

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run locally (requires kubeconfig)
python main.py
```

The backend will be available at http://localhost:8000

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server
REACT_APP_API_URL=http://localhost:8000 npm start
```

The frontend will be available at http://localhost:3000

### Operator Development

```bash
cd operator

# Download dependencies
go mod download

# Run locally (requires kubeconfig)
go run main.go
```

## API Documentation

Once the backend is running, visit:
- Interactive API docs: http://localhost:8000/docs
- Alternative API docs: http://localhost:8000/redoc

### Key Endpoints

- `GET /api/cronjobs?namespace={namespace}` - List CronJobs
- `POST /api/cronjobs` - Create a new CronJob
- `GET /api/cronjobs/{namespace}/{name}` - Get CronJob details
- `PUT /api/cronjobs/{namespace}/{name}` - Update a CronJob
- `DELETE /api/cronjobs/{namespace}/{name}` - Delete a CronJob
- `GET /api/cronjobs/{namespace}/{name}/history` - Get execution history
- `GET /api/cronjobs/{namespace}/{name}/logs` - Get job logs

## How It Works

### Backend (FastAPI)

The Python backend uses the Kubernetes client library to interact with the cluster:
- CRUD operations on CronJob resources
- Queries Job history
- Retrieves Pod logs
- Adds a label `app.kubernetes.io/managed-by=cronjob-manager` to managed CronJobs

### Frontend (React)

The React application provides a user-friendly interface:
- Dashboard view with all CronJobs
- Form-based CronJob creation and editing
- Detailed view with execution history and logs
- Real-time status updates

### Operator (Kubebuilder)

The Go-based operator:
- Watches CronJob resources with the `app.kubernetes.io/managed-by=cronjob-manager` label
- Validates CronJob specifications
- Adds finalizers for cleanup
- Logs statistics about job executions
- Can be extended for custom business logic

## Configuration

### Backend Configuration

Environment variables:
- `KUBECONFIG` - Path to kubeconfig file (default: uses in-cluster config in production)

### Frontend Configuration

Environment variables:
- `REACT_APP_API_URL` - Backend API URL (default: http://localhost:8000)

### Operator Configuration

Command-line flags:
- `--metrics-bind-address` - Metrics endpoint address (default: :8080)
- `--health-probe-bind-address` - Health probe address (default: :8081)
- `--leader-elect` - Enable leader election

## RBAC Permissions

The application requires the following Kubernetes permissions:

**Backend**:
- `batch/cronjobs`: get, list, create, update, patch, delete
- `batch/jobs`: get, list
- `core/pods`: get, list
- `core/pods/log`: get

**Operator**:
- `batch/cronjobs`: get, list, watch, update, patch
- `batch/cronjobs/status`: get, update, patch
- `batch/jobs`: get, list, watch
- `core/pods`: get, list, watch
- `core/pods/log`: get

## Example: Creating a CronJob

Using the UI:
1. Click "Create CronJob"
2. Fill in the form:
   - Name: `hello-world`
   - Schedule: `*/5 * * * *` (every 5 minutes)
   - Image: `busybox:latest`
   - Args: `echo "Hello, World!"`
3. Click "Create CronJob"

Using the API:
```bash
curl -X POST http://localhost:8000/api/cronjobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hello-world",
    "namespace": "default",
    "schedule": "*/5 * * * *",
    "image": "busybox:latest",
    "args": ["echo", "Hello, World!"]
  }'
```

## Troubleshooting

### Backend can't connect to Kubernetes

Make sure you have a valid kubeconfig or are running in a cluster with proper ServiceAccount permissions.

```bash
# Test kubectl access
kubectl get cronjobs --all-namespaces

# Check backend logs
kubectl logs -n cronjob-manager deployment/cronjob-manager-backend
```

### Frontend can't reach backend

Check that the API URL is configured correctly:
```bash
# In development
REACT_APP_API_URL=http://localhost:8000 npm start

# In production, check nginx proxy configuration
kubectl logs -n cronjob-manager deployment/cronjob-manager-frontend
```

### Operator not reconciling CronJobs

Ensure CronJobs have the required label:
```bash
kubectl get cronjobs -A -l app.kubernetes.io/managed-by=cronjob-manager
```

Check operator logs:
```bash
kubectl logs -n cronjob-manager deployment/cronjob-manager-operator
```

## Extending the Operator

The operator can be extended to add custom business logic:

1. **Add status conditions** - Track custom status for CronJobs
2. **Send notifications** - Alert when jobs fail
3. **Automatic scaling** - Adjust resources based on execution patterns
4. **Policy enforcement** - Enforce organizational policies on CronJobs
5. **Audit logging** - Track all changes to CronJobs

Edit `operator/controllers/cronjob_controller.go` to add custom logic in the `Reconcile` function.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for any purpose.

## Credits

Built with:
- [FastAPI](https://fastapi.tiangolo.com/) - Backend framework
- [React](https://reactjs.org/) - Frontend framework
- [Kubebuilder](https://book.kubebuilder.io/) - Operator framework
- [Kubernetes Python Client](https://github.com/kubernetes-client/python) - K8s API access
