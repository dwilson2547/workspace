# Example CronJob Configurations

This file contains example CronJob configurations you can use to test the CronJob Manager.

## Example 1: Hello World (Simple)

A simple job that prints "Hello, World!" every 5 minutes.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: hello-world
  namespace: default
  labels:
    app.kubernetes.io/managed-by: cronjob-manager
    app.kubernetes.io/name: hello-world
spec:
  schedule: "*/5 * * * *"
  jobTemplate:
    spec:
      template:
        metadata:
          labels:
            app: hello-world
        spec:
          containers:
          - name: hello-world
            image: busybox:latest
            args:
            - /bin/sh
            - -c
            - echo "Hello, World! The time is $(date)"
          restartPolicy: OnFailure
```

## Example 2: Python Script Runner

Runs a Python script every hour.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: python-job
  namespace: default
  labels:
    app.kubernetes.io/managed-by: cronjob-manager
    app.kubernetes.io/name: python-job
spec:
  schedule: "0 * * * *"
  jobTemplate:
    spec:
      template:
        metadata:
          labels:
            app: python-job
        spec:
          containers:
          - name: python-job
            image: python:3.11-slim
            command:
            - python
            - -c
            args:
            - |
              import datetime
              print(f"Python job executed at {datetime.datetime.now()}")
              print("Performing calculations...")
              result = sum(range(1000000))
              print(f"Result: {result}")
          restartPolicy: OnFailure
```

## Example 3: Database Backup

Simulates a database backup job that runs daily at 2 AM.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: db-backup
  namespace: default
  labels:
    app.kubernetes.io/managed-by: cronjob-manager
    app.kubernetes.io/name: db-backup
spec:
  schedule: "0 2 * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 5
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        metadata:
          labels:
            app: db-backup
        spec:
          containers:
          - name: db-backup
            image: postgres:15-alpine
            command:
            - /bin/sh
            - -c
            args:
            - |
              echo "Starting database backup at $(date)"
              echo "Connecting to database..."
              sleep 5
              echo "Creating backup..."
              sleep 10
              echo "Backup completed successfully at $(date)"
          restartPolicy: OnFailure
```

## Example 4: Cleanup Job

Deletes old files/logs every day at midnight.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleanup-job
  namespace: default
  labels:
    app.kubernetes.io/managed-by: cronjob-manager
    app.kubernetes.io/name: cleanup-job
spec:
  schedule: "0 0 * * *"
  jobTemplate:
    spec:
      template:
        metadata:
          labels:
            app: cleanup-job
        spec:
          containers:
          - name: cleanup
            image: alpine:latest
            command:
            - /bin/sh
            - -c
            args:
            - |
              echo "Starting cleanup at $(date)"
              echo "Finding files older than 30 days..."
              echo "Cleanup completed at $(date)"
          restartPolicy: OnFailure
```

## Example 5: Health Check

Checks service health every 15 minutes.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: health-check
  namespace: default
  labels:
    app.kubernetes.io/managed-by: cronjob-manager
    app.kubernetes.io/name: health-check
spec:
  schedule: "*/15 * * * *"
  jobTemplate:
    spec:
      template:
        metadata:
          labels:
            app: health-check
        spec:
          containers:
          - name: health-check
            image: curlimages/curl:latest
            command:
            - /bin/sh
            - -c
            args:
            - |
              echo "Running health check at $(date)"
              curl -f http://example.com/health || exit 1
              echo "Health check passed"
          restartPolicy: OnFailure
```

## Example 6: Report Generator

Generates weekly reports every Monday at 9 AM.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: weekly-report
  namespace: default
  labels:
    app.kubernetes.io/managed-by: cronjob-manager
    app.kubernetes.io/name: weekly-report
spec:
  schedule: "0 9 * * 1"
  concurrencyPolicy: Replace
  jobTemplate:
    spec:
      template:
        metadata:
          labels:
            app: weekly-report
        spec:
          containers:
          - name: report
            image: busybox:latest
            command:
            - /bin/sh
            - -c
            args:
            - |
              echo "Generating weekly report for week of $(date)"
              echo "Collecting data..."
              sleep 5
              echo "Processing data..."
              sleep 5
              echo "Report generation completed"
          restartPolicy: OnFailure
```

## Testing with the UI

You can create these jobs through the web interface:

1. Click **"Create CronJob"**
2. Copy the values from the examples above
3. Fill in the form fields:
   - **Name**: From metadata.name
   - **Namespace**: From metadata.namespace
   - **Schedule**: From spec.schedule
   - **Image**: From spec.jobTemplate.spec.template.spec.containers[0].image
   - **Command**: From spec.jobTemplate.spec.template.spec.containers[0].command
   - **Args**: From spec.jobTemplate.spec.template.spec.containers[0].args
   - **Concurrency Policy**: From spec.concurrencyPolicy

## Testing with kubectl

You can also apply these directly:

```bash
# Apply an example
kubectl apply -f examples.yaml

# List managed CronJobs
kubectl get cronjobs -l app.kubernetes.io/managed-by=cronjob-manager

# Manually trigger a job
kubectl create job --from=cronjob/hello-world hello-world-manual-1

# Check job status
kubectl get jobs

# View job logs
kubectl logs job/hello-world-manual-1
```

## Cron Schedule Reference

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of the month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of the week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
* * * * *
```

Common schedules:
- `* * * * *` - Every minute
- `*/5 * * * *` - Every 5 minutes
- `0 * * * *` - Every hour
- `0 0 * * *` - Daily at midnight
- `0 0 * * 0` - Weekly on Sunday
- `0 0 1 * *` - Monthly on the 1st
- `0 9-17 * * 1-5` - Every hour from 9 AM to 5 PM, Monday to Friday
