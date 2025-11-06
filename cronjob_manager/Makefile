.PHONY: help build deploy clean dev test

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build all Docker images
	@echo "Building backend..."
	docker build -t cronjob-manager-backend:latest ./backend
	@echo "Building frontend..."
	docker build -t cronjob-manager-frontend:latest ./frontend
	@echo "Building operator..."
	docker build -t cronjob-manager-operator:latest ./operator
	@echo "All images built successfully!"

build-backend: ## Build backend Docker image
	docker build -t cronjob-manager-backend:latest ./backend

build-frontend: ## Build frontend Docker image
	docker build -t cronjob-manager-frontend:latest ./frontend

build-operator: ## Build operator Docker image
	docker build -t cronjob-manager-operator:latest ./operator

deploy: ## Deploy to Kubernetes
	@echo "Deploying to Kubernetes..."
	kubectl apply -f k8s/deployment.yaml
	@echo "Waiting for deployments to be ready..."
	kubectl wait --for=condition=available --timeout=300s \
		deployment/cronjob-manager-backend \
		deployment/cronjob-manager-frontend \
		deployment/cronjob-manager-operator \
		-n cronjob-manager
	@echo "Deployment complete!"
	@echo ""
	@echo "Access the application:"
	@echo "  kubectl port-forward -n cronjob-manager svc/cronjob-manager-frontend 3000:80"
	@echo "  Then open http://localhost:3000"

undeploy: ## Remove from Kubernetes
	kubectl delete -f k8s/deployment.yaml

logs-backend: ## Show backend logs
	kubectl logs -n cronjob-manager deployment/cronjob-manager-backend -f

logs-frontend: ## Show frontend logs
	kubectl logs -n cronjob-manager deployment/cronjob-manager-frontend -f

logs-operator: ## Show operator logs
	kubectl logs -n cronjob-manager deployment/cronjob-manager-operator -f

port-forward: ## Port forward frontend to localhost:3000
	kubectl port-forward -n cronjob-manager svc/cronjob-manager-frontend 3000:80

dev: ## Start development environment with docker-compose
	docker-compose up --build

dev-backend: ## Run backend in development mode
	cd backend && python -m venv venv && \
		. venv/bin/activate && \
		pip install -r requirements.txt && \
		python main.py

dev-frontend: ## Run frontend in development mode
	cd frontend && npm install && REACT_APP_API_URL=http://localhost:8000 npm start

dev-operator: ## Run operator in development mode
	cd operator && go run main.go

clean: ## Clean up all resources
	docker-compose down -v
	kubectl delete -f k8s/deployment.yaml --ignore-not-found=true
	rm -rf backend/venv backend/__pycache__
	rm -rf frontend/node_modules frontend/build
	rm -rf operator/bin

status: ## Check deployment status
	@echo "=== Pods ==="
	kubectl get pods -n cronjob-manager
	@echo ""
	@echo "=== Services ==="
	kubectl get svc -n cronjob-manager
	@echo ""
	@echo "=== Deployments ==="
	kubectl get deployments -n cronjob-manager

test-backend: ## Run backend tests
	cd backend && pytest

install-backend-deps: ## Install backend dependencies
	cd backend && pip install -r requirements.txt

install-frontend-deps: ## Install frontend dependencies
	cd frontend && npm install

install-operator-deps: ## Install operator dependencies
	cd operator && go mod download
