# #!/bin/bash

# # ==============================================================================
# # Weather Agent - Local Kind Deployment Script
# # ==============================================================================
# # This script automates the build and deployment process for the Kind cluster.
# # Usage: ./scripts/deploy-local.sh
# # ==============================================================================

set -e # Exit on error

CLUSTER_NAME="weather-agent"

echo "🚀 Starting Local Deployment to Kind cluster: $CLUSTER_NAME"
if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
    echo "✓ Cluster '${CLUSTER_NAME}' already exists"
else
    echo "Creating cluster '${CLUSTER_NAME}'..."
    kind create cluster --name "${CLUSTER_NAME}"
    echo "✓ Cluster '${CLUSTER_NAME}' created successfully"
fi

echo "📦 Building Docker Images..."
docker build -t backend:local -f apps/backend/Dockerfile.prod .
docker build -t agent-service:local -f apps/agent-service/Dockerfile.prod .
docker build -t web:local -f apps/web/Dockerfile.prod .

echo "🚚 Loading images into Kind cluster..."
kind load docker-image backend:local --name $CLUSTER_NAME
kind load docker-image agent-service:local --name $CLUSTER_NAME
kind load docker-image web:local --name $CLUSTER_NAME

echo "Installing Ingress Controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

# Apply all k8s manifests EXCEPT cert-manager-issuer.yaml (not needed locally)
echo "☸️ Applying Kubernetes Manifests..."
find k8s -name '*.yaml' ! -name 'cert-manager-issuer.yaml' -exec kubectl apply -f {} \;

echo "Waiting for application pods to be ready..."
kubectl wait --for=condition=ready pod --all --timeout=300s

echo "🌐 Setting up Port Forwarding..."
EXISTING_PID=$(lsof -t -i :8080 || true)
if [ ! -z "$EXISTING_PID" ]; then
    echo "🔹 Cleaning up existing port-forward (PID: $EXISTING_PID)..."
    kill -9 $EXISTING_PID || true
fi

kubectl port-forward service/ingress-nginx-controller -n ingress-nginx 8080:80