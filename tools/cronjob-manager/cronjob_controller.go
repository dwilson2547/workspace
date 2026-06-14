package controllers

import (
	"context"
	"fmt"
	"time"

	"github.com/go-logr/logr"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
)

const (
	managedByLabel = "app.kubernetes.io/managed-by"
	managedByValue = "cronjob-manager"
)

// CronJobReconciler reconciles CronJob objects
type CronJobReconciler struct {
	client.Client
	Log    logr.Logger
	Scheme *runtime.Scheme
}

// +kubebuilder:rbac:groups=batch,resources=cronjobs,verbs=get;list;watch;update;patch
// +kubebuilder:rbac:groups=batch,resources=cronjobs/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=batch,resources=jobs,verbs=get;list;watch
// +kubebuilder:rbac:groups=core,resources=pods,verbs=get;list;watch
// +kubebuilder:rbac:groups=core,resources=pods/log,verbs=get

// Reconcile handles reconciliation for CronJob resources
func (r *CronJobReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := r.Log.WithValues("cronjob", req.NamespacedName)

	// Fetch the CronJob
	var cronJob batchv1.CronJob
	if err := r.Get(ctx, req.NamespacedName, &cronJob); err != nil {
		if errors.IsNotFound(err) {
			// CronJob was deleted
			log.Info("CronJob resource not found. Ignoring since object must be deleted")
			return ctrl.Result{}, nil
		}
		log.Error(err, "Failed to get CronJob")
		return ctrl.Result{}, err
	}

	// Check if this CronJob is managed by our application
	if !r.isManagedByUs(&cronJob) {
		// Skip CronJobs not managed by cronjob-manager
		return ctrl.Result{}, nil
	}

	log.Info("Reconciling CronJob", "schedule", cronJob.Spec.Schedule)

	// Validate the CronJob
	if err := r.validateCronJob(&cronJob); err != nil {
		log.Error(err, "CronJob validation failed")
		// Could add status condition here
		return ctrl.Result{}, err
	}

	// Add finalizer if needed
	if !r.hasFinalizer(&cronJob) {
		r.addFinalizer(&cronJob)
		if err := r.Update(ctx, &cronJob); err != nil {
			log.Error(err, "Failed to add finalizer")
			return ctrl.Result{}, err
		}
	}

	// List jobs associated with this CronJob
	var jobList batchv1.JobList
	if err := r.List(ctx, &jobList, client.InNamespace(req.Namespace), client.MatchingLabels{
		"batch.kubernetes.io/cronjob": cronJob.Name,
	}); err != nil {
		log.Error(err, "Failed to list Jobs")
		return ctrl.Result{}, err
	}

	// Log job statistics
	activeJobs := 0
	succeededJobs := 0
	failedJobs := 0
	for _, job := range jobList.Items {
		if job.Status.Active > 0 {
			activeJobs++
		}
		if job.Status.Succeeded > 0 {
			succeededJobs++
		}
		if job.Status.Failed > 0 {
			failedJobs++
		}
	}

	log.Info("Job statistics",
		"active", activeJobs,
		"succeeded", succeededJobs,
		"failed", failedJobs,
		"total", len(jobList.Items))

	// Check if CronJob is suspended
	if cronJob.Spec.Suspend != nil && *cronJob.Spec.Suspend {
		log.Info("CronJob is suspended")
	}

	// Requeue after a reasonable time to check status
	return ctrl.Result{RequeueAfter: 30 * time.Second}, nil
}

// isManagedByUs checks if the CronJob is managed by cronjob-manager
func (r *CronJobReconciler) isManagedByUs(cronJob *batchv1.CronJob) bool {
	if cronJob.Labels == nil {
		return false
	}
	value, exists := cronJob.Labels[managedByLabel]
	return exists && value == managedByValue
}

// validateCronJob performs validation on the CronJob
func (r *CronJobReconciler) validateCronJob(cronJob *batchv1.CronJob) error {
	// Validate schedule format
	if cronJob.Spec.Schedule == "" {
		return fmt.Errorf("schedule cannot be empty")
	}

	// Validate container spec
	if len(cronJob.Spec.JobTemplate.Spec.Template.Spec.Containers) == 0 {
		return fmt.Errorf("at least one container must be specified")
	}

	container := cronJob.Spec.JobTemplate.Spec.Template.Spec.Containers[0]
	if container.Image == "" {
		return fmt.Errorf("container image cannot be empty")
	}

	return nil
}

// hasFinalizer checks if the CronJob has our finalizer
func (r *CronJobReconciler) hasFinalizer(cronJob *batchv1.CronJob) bool {
	for _, finalizer := range cronJob.Finalizers {
		if finalizer == "cronjob-manager.finalizer" {
			return true
		}
	}
	return false
}

// addFinalizer adds our finalizer to the CronJob
func (r *CronJobReconciler) addFinalizer(cronJob *batchv1.CronJob) {
	cronJob.Finalizers = append(cronJob.Finalizers, "cronjob-manager.finalizer")
}

// SetupWithManager sets up the controller with the Manager
func (r *CronJobReconciler) SetupWithManager(mgr ctrl.Manager) error {
	// Only watch CronJobs managed by cronjob-manager
	pred := predicate.NewPredicateFuncs(func(obj client.Object) bool {
		cronJob, ok := obj.(*batchv1.CronJob)
		if !ok {
			return false
		}
		return r.isManagedByUs(cronJob)
	})

	return ctrl.NewControllerManagedBy(mgr).
		For(&batchv1.CronJob{}).
		WithEventFilter(pred).
		Complete(r)
}
