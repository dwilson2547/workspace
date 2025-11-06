from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from kubernetes import client, config
from kubernetes.client.rest import ApiException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import os

app = FastAPI(title="CronJob Manager API")

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Kubernetes client
try:
    # Try to load in-cluster config first
    config.load_incluster_config()
except:
    # Fall back to kubeconfig for local development
    config.load_kube_config()

batch_v1 = client.BatchV1Api()
core_v1 = client.CoreV1Api()

# Pydantic models
class CronJobCreate(BaseModel):
    name: str
    namespace: str = "default"
    schedule: str
    image: str
    command: Optional[List[str]] = None
    args: Optional[List[str]] = None
    suspend: bool = False
    concurrency_policy: str = "Allow"
    successful_jobs_history_limit: int = 3
    failed_jobs_history_limit: int = 1

class CronJobUpdate(BaseModel):
    schedule: Optional[str] = None
    image: Optional[str] = None
    command: Optional[List[str]] = None
    args: Optional[List[str]] = None
    suspend: Optional[bool] = None
    concurrency_policy: Optional[str] = None

class CronJobResponse(BaseModel):
    name: str
    namespace: str
    schedule: str
    suspend: bool
    last_schedule_time: Optional[str] = None
    active: int
    image: str
    concurrency_policy: str
    created: str

@app.get("/")
def read_root():
    return {"message": "CronJob Manager API", "status": "running"}

@app.get("/api/cronjobs", response_model=List[CronJobResponse])
def list_cronjobs(namespace: str = "default"):
    """List all CronJobs in a namespace"""
    try:
        # Get CronJobs with our managed label
        cronjobs = batch_v1.list_namespaced_cron_job(
            namespace=namespace,
            label_selector="app.kubernetes.io/managed-by=cronjob-manager"
        )
        
        result = []
        for cj in cronjobs.items:
            result.append(CronJobResponse(
                name=cj.metadata.name,
                namespace=cj.metadata.namespace,
                schedule=cj.spec.schedule,
                suspend=cj.spec.suspend or False,
                last_schedule_time=cj.status.last_schedule_time.isoformat() if cj.status.last_schedule_time else None,
                active=len(cj.status.active) if cj.status.active else 0,
                image=cj.spec.job_template.spec.template.spec.containers[0].image,
                concurrency_policy=cj.spec.concurrency_policy or "Allow",
                created=cj.metadata.creation_timestamp.isoformat()
            ))
        return result
    except ApiException as e:
        raise HTTPException(status_code=e.status, detail=str(e))

@app.get("/api/cronjobs/{namespace}/{name}")
def get_cronjob(namespace: str, name: str):
    """Get a specific CronJob"""
    try:
        cj = batch_v1.read_namespaced_cron_job(name=name, namespace=namespace)
        return {
            "name": cj.metadata.name,
            "namespace": cj.metadata.namespace,
            "schedule": cj.spec.schedule,
            "suspend": cj.spec.suspend or False,
            "last_schedule_time": cj.status.last_schedule_time.isoformat() if cj.status.last_schedule_time else None,
            "active": len(cj.status.active) if cj.status.active else 0,
            "image": cj.spec.job_template.spec.template.spec.containers[0].image,
            "command": cj.spec.job_template.spec.template.spec.containers[0].command,
            "args": cj.spec.job_template.spec.template.spec.containers[0].args,
            "concurrency_policy": cj.spec.concurrency_policy or "Allow",
            "successful_jobs_history_limit": cj.spec.successful_jobs_history_limit or 3,
            "failed_jobs_history_limit": cj.spec.failed_jobs_history_limit or 1,
            "created": cj.metadata.creation_timestamp.isoformat()
        }
    except ApiException as e:
        raise HTTPException(status_code=e.status, detail=str(e))

@app.post("/api/cronjobs", status_code=201)
def create_cronjob(cronjob: CronJobCreate):
    """Create a new CronJob"""
    try:
        # Create CronJob manifest
        container = client.V1Container(
            name=cronjob.name,
            image=cronjob.image,
            command=cronjob.command,
            args=cronjob.args
        )
        
        template = client.V1PodTemplateSpec(
            metadata=client.V1ObjectMeta(
                labels={"app": cronjob.name}
            ),
            spec=client.V1PodSpec(
                containers=[container],
                restart_policy="OnFailure"
            )
        )
        
        job_template = client.V1JobTemplateSpec(
            spec=client.V1JobSpec(
                template=template
            )
        )
        
        spec = client.V1CronJobSpec(
            schedule=cronjob.schedule,
            job_template=job_template,
            suspend=cronjob.suspend,
            concurrency_policy=cronjob.concurrency_policy,
            successful_jobs_history_limit=cronjob.successful_jobs_history_limit,
            failed_jobs_history_limit=cronjob.failed_jobs_history_limit
        )
        
        cronjob_obj = client.V1CronJob(
            api_version="batch/v1",
            kind="CronJob",
            metadata=client.V1ObjectMeta(
                name=cronjob.name,
                labels={
                    "app.kubernetes.io/managed-by": "cronjob-manager",
                    "app.kubernetes.io/name": cronjob.name
                }
            ),
            spec=spec
        )
        
        result = batch_v1.create_namespaced_cron_job(
            namespace=cronjob.namespace,
            body=cronjob_obj
        )
        
        return {"message": "CronJob created successfully", "name": result.metadata.name}
    except ApiException as e:
        raise HTTPException(status_code=e.status, detail=str(e))

@app.put("/api/cronjobs/{namespace}/{name}")
def update_cronjob(namespace: str, name: str, update: CronJobUpdate):
    """Update an existing CronJob"""
    try:
        # Get current CronJob
        cj = batch_v1.read_namespaced_cron_job(name=name, namespace=namespace)
        
        # Update fields if provided
        if update.schedule is not None:
            cj.spec.schedule = update.schedule
        if update.image is not None:
            cj.spec.job_template.spec.template.spec.containers[0].image = update.image
        if update.command is not None:
            cj.spec.job_template.spec.template.spec.containers[0].command = update.command
        if update.args is not None:
            cj.spec.job_template.spec.template.spec.containers[0].args = update.args
        if update.suspend is not None:
            cj.spec.suspend = update.suspend
        if update.concurrency_policy is not None:
            cj.spec.concurrency_policy = update.concurrency_policy
        
        # Update the CronJob
        result = batch_v1.replace_namespaced_cron_job(
            name=name,
            namespace=namespace,
            body=cj
        )
        
        return {"message": "CronJob updated successfully", "name": result.metadata.name}
    except ApiException as e:
        raise HTTPException(status_code=e.status, detail=str(e))

@app.delete("/api/cronjobs/{namespace}/{name}")
def delete_cronjob(namespace: str, name: str):
    """Delete a CronJob"""
    try:
        batch_v1.delete_namespaced_cron_job(
            name=name,
            namespace=namespace,
            propagation_policy='Foreground'
        )
        return {"message": "CronJob deleted successfully"}
    except ApiException as e:
        raise HTTPException(status_code=e.status, detail=str(e))

@app.get("/api/cronjobs/{namespace}/{name}/history")
def get_cronjob_history(namespace: str, name: str):
    """Get execution history for a CronJob"""
    try:
        # Get all jobs owned by this CronJob
        jobs = batch_v1.list_namespaced_job(
            namespace=namespace,
            label_selector=f"batch.kubernetes.io/cronjob={name}"
        )
        
        history = []
        for job in jobs.items:
            history.append({
                "name": job.metadata.name,
                "start_time": job.status.start_time.isoformat() if job.status.start_time else None,
                "completion_time": job.status.completion_time.isoformat() if job.status.completion_time else None,
                "succeeded": job.status.succeeded or 0,
                "failed": job.status.failed or 0,
                "active": job.status.active or 0,
                "status": "Succeeded" if job.status.succeeded else ("Failed" if job.status.failed else "Running")
            })
        
        # Sort by start time, newest first
        history.sort(key=lambda x: x["start_time"] or "", reverse=True)
        return history
    except ApiException as e:
        raise HTTPException(status_code=e.status, detail=str(e))

@app.get("/api/cronjobs/{namespace}/{name}/logs")
def get_cronjob_logs(namespace: str, name: str, job_name: Optional[str] = None):
    """Get logs from the most recent job execution"""
    try:
        # If no specific job provided, get the most recent one
        if not job_name:
            jobs = batch_v1.list_namespaced_job(
                namespace=namespace,
                label_selector=f"batch.kubernetes.io/cronjob={name}"
            )
            if not jobs.items:
                return {"logs": "No job executions found"}
            
            # Sort by start time and get the most recent
            jobs.items.sort(key=lambda x: x.status.start_time or datetime.min, reverse=True)
            job_name = jobs.items[0].metadata.name
        
        # Get pods for this job
        pods = core_v1.list_namespaced_pod(
            namespace=namespace,
            label_selector=f"job-name={job_name}"
        )
        
        if not pods.items:
            return {"logs": "No pods found for this job"}
        
        # Get logs from the first pod
        pod_name = pods.items[0].metadata.name
        logs = core_v1.read_namespaced_pod_log(
            name=pod_name,
            namespace=namespace,
            tail_lines=100
        )
        
        return {
            "job_name": job_name,
            "pod_name": pod_name,
            "logs": logs
        }
    except ApiException as e:
        raise HTTPException(status_code=e.status, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
