# Troubleshooting Guide

This guide helps you diagnose and fix common issues with the Kubernetes CronJob Manager.

## Quick Diagnostic Commands

```bash
# Check all components status
make status

# View logs
make logs-backend
make logs-frontend
make logs-operator

# Verify RBAC permissions
kubectl auth can-i get cronjobs --as=system:serviceaccount:cronjob-manager:cronjob-manager-backend
kubectl auth can-i get cronjobs --as=system:serviceaccount:cronjob-manager:cronjob-manager-operator

# Check pod health
kubectl get pods -n cronjob-manager
kubectl describe pod -n cronjob-manager <pod-name>
```

## Common Issues

### 1. Backend Can't Connect to Kubernetes API

**Symptoms:**
- Backend logs show connection errors
- API returns 500 errors
- Frontend shows "Failed to fetch CronJobs"

**Diagnosis:**
```bash
# Check if backend pod is running
kubectl get pods -n cronjob-manager -l app=cronjob-manager-backend

# Check backend logs
kubectl logs -n cronjob-manager deployment/cronjob-manager-backend

# Verify ServiceAccount exists
kubectl get serviceaccount -n cronjob-manager cronjob-manager-backend

# Check RBAC permissions
kubectl auth can-i get cronjobs --as=system:serviceaccount:cronjob-manager:cronjob-manager-backend
```

**Solutions:**

**A. Missing ServiceAccount or RBAC:**
```bash
# Reapply the deployment manifest
kubectl apply -f k8s/deployment.yaml
```

**B. In-cluster config not working:**
```bash
# Check if ServiceAccount token is mounted
kubectl describe pod -n cronjob-manager <backend-pod-name> | grep -A 5 "Mounts:"

# Verify the token exists
kubectl exec -n cronjob-manager <backend-pod-name> -- ls -la /var/run/secrets/kubernetes.io/serviceaccount/
```

**C. For local development:**
```bash
# Ensure kubeconfig is accessible
export KUBECONFIG=~/.kube/config
python backend/main.py
```

### 2. Frontend Can't Reach Backend

**Symptoms:**
- Frontend shows connection errors
- Network tab shows failed requests
- CORS errors in browser console

**Diagnosis:**
```bash
# Check if backend service exists
kubectl get svc -n cronjob-manager cronjob-manager-backend

# Test backend from within cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://cronjob-manager-backend.cronjob-manager.svc.cluster.local:8000/

# Check frontend environment variable
kubectl get deployment -n cronjob-manager cronjob-manager-frontend -o jsonpath='{.spec.template.spec.containers[0].env}'
```

**Solutions:**

**A. Port forwarding issue:**
```bash
# Stop any existing port forwards
pkill -f "port-forward"

# Create fresh port forward
kubectl port-forward -n cronjob-manager svc/cronjob-manager-backend 8000:8000
```

**B. Wrong API URL in frontend:**
```bash
# For local development
export REACT_APP_API_URL=http://localhost:8000
npm start

# For Kubernetes deployment, check nginx proxy config
kubectl exec -n cronjob-manager <frontend-pod> -- cat /etc/nginx/conf.d/default.conf
```

**C. CORS issue:**
```bash
# Check backend CORS settings in main.py
# Ensure allow_origins includes your frontend URL

# For development, you may need to add your local frontend URL
# Update backend/main.py:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://your-frontend-url"],
    ...
)
```

### 3. Operator Not Reconciling CronJobs

**Symptoms:**
- CronJobs created but operator doesn't process them
- No logs from operator
- Operator pod crashlooping

**Diagnosis:**
```bash
# Check operator status
kubectl get pods -n cronjob-manager -l app=cronjob-manager-operator

# Check operator logs
kubectl logs -n cronjob-manager deployment/cronjob-manager-operator

# Verify CronJob has correct label
kubectl get cronjobs --all-namespaces -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.metadata.labels.app\.kubernetes\.io/managed-by}{"\n"}{end}'
```

**Solutions:**

**A. Missing label on CronJob:**
```bash
# Add label to existing CronJob
kubectl label cronjob <cronjob-name> app.kubernetes.io/managed-by=cronjob-manager

# Or recreate through the UI/API which automatically adds the label
```

**B. RBAC permissions issue:**
```bash
# Verify operator ServiceAccount has correct permissions
kubectl auth can-i watch cronjobs --as=system:serviceaccount:cronjob-manager:cronjob-manager-operator

# Reapply RBAC if needed
kubectl apply -f k8s/deployment.yaml
```

**C. Operator crashed:**
```bash
# Check for crash logs
kubectl logs -n cronjob-manager <operator-pod-name> --previous

# Restart operator
kubectl rollout restart deployment/cronjob-manager-operator -n cronjob-manager
```

### 4. CronJob Not Executing

**Symptoms:**
- CronJob created successfully
- No jobs are being created
- Schedule time passes but nothing happens

**Diagnosis:**
```bash
# Check if CronJob is suspended
kubectl get cronjob <cronjob-name> -o jsonpath='{.spec.suspend}'

# Check CronJob schedule
kubectl get cronjob <cronjob-name> -o jsonpath='{.spec.schedule}'

# Check CronJob status
kubectl describe cronjob <cronjob-name>

# List recent jobs
kubectl get jobs -l batch.kubernetes.io/cronjob=<cronjob-name>
```

**Solutions:**

**A. CronJob is suspended:**
```bash
# Resume via UI or API
curl -X PUT http://localhost:8000/api/cronjobs/default/<cronjob-name> \
  -H "Content-Type: application/json" \
  -d '{"suspend": false}'

# Or using kubectl
kubectl patch cronjob <cronjob-name> -p '{"spec":{"suspend":false}}'
```

**B. Invalid cron schedule:**
```bash
# Verify schedule syntax
# Format: * * * * * (minute hour day month weekday)

# Valid examples:
# */5 * * * *    - Every 5 minutes
# 0 * * * *      - Every hour
# 0 0 * * *      - Daily at midnight

# Fix in UI or update directly
kubectl edit cronjob <cronjob-name>
```

**C. Concurrency policy preventing execution:**
```bash
# Check if jobs are still running
kubectl get jobs -l batch.kubernetes.io/cronjob=<cronjob-name>

# Change concurrency policy to Allow
kubectl patch cronjob <cronjob-name> -p '{"spec":{"concurrencyPolicy":"Allow"}}'
```

### 5. Can't See Execution History

**Symptoms:**
- CronJob detail page shows "No job executions"
- Jobs exist but don't appear in history
- Empty execution history

**Diagnosis:**
```bash
# Check if jobs exist
kubectl get jobs -l batch.kubernetes.io/cronjob=<cronjob-name>

# Check job labels
kubectl get jobs -l batch.kubernetes.io/cronjob=<cronjob-name> --show-labels

# Test API endpoint directly
curl http://localhost:8000/api/cronjobs/default/<cronjob-name>/history
```

**Solutions:**

**A. Jobs don't have correct label:**
- This usually means jobs were created outside the CronJob
- Jobs created by CronJobs automatically get the label

**B. History limit too low:**
```bash
# Increase history limits
kubectl patch cronjob <cronjob-name> -p '{"spec":{"successfulJobsHistoryLimit":5,"failedJobsHistoryLimit":3}}'
```

**C. Jobs were cleaned up:**
- Kubernetes automatically removes old jobs based on history limits
- Increase limits if you need to see more history

### 6. Can't View Logs

**Symptoms:**
- "No logs available" message
- Logs endpoint returns error
- Empty log display

**Diagnosis:**
```bash
# Check if pods exist for the job
kubectl get pods -l job-name=<job-name>

# Check pod status
kubectl describe pod <pod-name>

# Try getting logs directly
kubectl logs <pod-name>
```

**Solutions:**

**A. Pod doesn't exist:**
- Job completed and pod was deleted
- Increase completionTTLSeconds to keep pods longer
```bash
kubectl patch cronjob <cronjob-name> -p '{"spec":{"jobTemplate":{"spec":{"ttlSecondsAfterFinished":86400}}}}'
```

**B. Pod is still pending:**
- Wait for pod to start
- Check pod events for issues:
```bash
kubectl describe pod <pod-name>
```

**C. Backend can't access pod logs:**
```bash
# Verify RBAC permissions
kubectl auth can-i get pods/log --as=system:serviceaccount:cronjob-manager:cronjob-manager-backend
```

### 7. Image Pull Errors

**Symptoms:**
- CronJob created but jobs fail immediately
- Pod shows ImagePullBackOff status
- Logs show image pull errors

**Diagnosis:**
```bash
# Check pod events
kubectl describe pod <pod-name>

# Check image name
kubectl get cronjob <cronjob-name> -o jsonpath='{.spec.jobTemplate.spec.template.spec.containers[0].image}'
```

**Solutions:**

**A. Image doesn't exist:**
- Verify image name and tag
- Check Docker Hub or your registry

**B. Private registry without credentials:**
```bash
# Create image pull secret
kubectl create secret docker-registry regcred \
  --docker-server=<registry> \
  --docker-username=<username> \
  --docker-password=<password>

# Update CronJob to use secret (not yet supported in UI, use kubectl)
kubectl patch cronjob <cronjob-name> -p '{"spec":{"jobTemplate":{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"regcred"}]}}}}}}'
```

### 8. Permission Denied Errors

**Symptoms:**
- 403 Forbidden errors
- "User cannot get resource" messages
- RBAC errors in logs

**Diagnosis:**
```bash
# Check current permissions
kubectl auth can-i get cronjobs --as=system:serviceaccount:cronjob-manager:cronjob-manager-backend
kubectl auth can-i create cronjobs --as=system:serviceaccount:cronjob-manager:cronjob-manager-backend

# Review ClusterRoleBinding
kubectl get clusterrolebinding cronjob-manager-backend -o yaml
```

**Solutions:**

**A. Reapply RBAC:**
```bash
kubectl apply -f k8s/deployment.yaml
```

**B. ServiceAccount in wrong namespace:**
```bash
# Verify ServiceAccount namespace
kubectl get serviceaccount -n cronjob-manager cronjob-manager-backend

# Check that pod is using correct ServiceAccount
kubectl get pod <pod-name> -n cronjob-manager -o jsonpath='{.spec.serviceAccountName}'
```

## Performance Issues

### Backend Slow to Respond

**Diagnosis:**
```bash
# Check backend resource usage
kubectl top pod -n cronjob-manager -l app=cronjob-manager-backend

# Check if backend is throttled
kubectl describe pod -n cronjob-manager <backend-pod>
```

**Solutions:**
```bash
# Increase resource limits
kubectl patch deployment -n cronjob-manager cronjob-manager-backend -p '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "backend",
          "resources": {
            "limits": {"cpu": "1000m", "memory": "512Mi"},
            "requests": {"cpu": "200m", "memory": "256Mi"}
          }
        }]
      }
    }
  }
}'
```

### Frontend Not Loading

**Diagnosis:**
```bash
# Check frontend pod
kubectl get pod -n cronjob-manager -l app=cronjob-manager-frontend

# Check nginx logs
kubectl logs -n cronjob-manager <frontend-pod>

# Test from inside cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://cronjob-manager-frontend.cronjob-manager.svc.cluster.local/
```

**Solutions:**
- Clear browser cache
- Check browser console for errors
- Verify nginx configuration

## Getting Help

If you're still experiencing issues:

1. Collect diagnostic information:
```bash
# Save all logs
kubectl logs -n cronjob-manager deployment/cronjob-manager-backend > backend.log
kubectl logs -n cronjob-manager deployment/cronjob-manager-frontend > frontend.log
kubectl logs -n cronjob-manager deployment/cronjob-manager-operator > operator.log

# Save resource status
kubectl get all -n cronjob-manager -o yaml > resources.yaml
```

2. Check component versions:
```bash
kubectl get deployment -n cronjob-manager -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.template.spec.containers[0].image}{"\n"}{end}'
```

3. Review this troubleshooting guide again
4. Check the [README.md](README.md) for configuration details
5. Review [ARCHITECTURE.md](ARCHITECTURE.md) for system design details

## Prevention Best Practices

1. **Always use the UI or API to create CronJobs** - Ensures correct labels
2. **Monitor operator logs regularly** - Catch issues early
3. **Set appropriate resource limits** - Prevent resource exhaustion
4. **Use meaningful names** - Easier to debug
5. **Test schedules** - Use online cron calculators
6. **Keep history limits reasonable** - Balance between history and clutter
7. **Regular backups** - Export CronJob configurations periodically

```bash
# Export all managed CronJobs
kubectl get cronjobs -A -l app.kubernetes.io/managed-by=cronjob-manager -o yaml > cronjobs-backup.yaml
```
