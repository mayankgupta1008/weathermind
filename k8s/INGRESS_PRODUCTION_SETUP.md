# Production Ingress Setup Guide

## 🎯 Overview

This guide shows you how to set up a **production-grade Ingress** for your weather-agent application with:

- ✅ NGINX Ingress Controller
- ✅ Automatic SSL/TLS certificates (Let's Encrypt)
- ✅ DNS configuration
- ✅ Security best practices
- ✅ Monitoring and logging

---

## 📋 Prerequisites

Before starting, ensure you have:

- ✅ A Kubernetes cluster running (AWS EKS, GKE, AKS, or self-hosted)
- ✅ `kubectl` installed and configured
- ✅ A domain name (e.g., `weather-agent.com`)
- ✅ Access to your domain's DNS settings

---

## Step 1: Install NGINX Ingress Controller

### For Cloud Providers (AWS, GCP, Azure)

```bash
# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

# This creates:
# - namespace: ingress-nginx
# - deployment: ingress-nginx-controller
# - service: ingress-nginx-controller (type: LoadBalancer)
```

### Verify Installation

```bash
# Check if the controller is running
kubectl get pods -n ingress-nginx

# Expected output:
# NAME                                        READY   STATUS
# ingress-nginx-controller-xxxx               1/1     Running

# Get the LoadBalancer external IP (IMPORTANT - you'll need this for DNS)
kubectl get svc -n ingress-nginx

# Expected output:
# NAME                                 TYPE           EXTERNAL-IP
# ingress-nginx-controller             LoadBalancer   34.123.45.67  <-- Copy this IP!
```

**⏱️ Wait time**: 2-5 minutes for the LoadBalancer to get an external IP.

---

## Step 2: Configure DNS

Point your domain to the Ingress Controller's external IP.

### In your DNS provider (Cloudflare, Route53, GoDaddy, etc.)

```
# Add an A record
Type: A
Name: @                    (for weather-agent.com)
Value: 34.123.45.67       (your LoadBalancer IP from Step 1)
TTL: 300

# Add a CNAME record for www
Type: CNAME
Name: www
Value: weather-agent.com
TTL: 300

# Optional: Add subdomain A records
Type: A
Name: api
Value: 34.123.45.67
TTL: 300
```

### Verify DNS Propagation

```bash
# Check if DNS is resolving (may take 5-30 minutes)
nslookup weather-agent.com

# Or use dig
dig weather-agent.com

# Should return your LoadBalancer IP
```

---

## Step 3: Install cert-manager (for automatic SSL)

cert-manager automates SSL certificate creation and renewal using Let's Encrypt.

### Install cert-manager

```bash
# Install cert-manager CRDs and components
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Verify installation
kubectl get pods -n cert-manager

# Expected output:
# NAME                                       READY   STATUS
# cert-manager-7d...                        1/1     Running
# cert-manager-cainjector-5d...             1/1     Running
# cert-manager-webhook-5f...                1/1     Running
```

### Create ClusterIssuer for Let's Encrypt

Create a file: `k8s/cert-manager-issuer.yaml`

```yaml
# Let's Encrypt Staging (for testing)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    # Staging server (for testing, high rate limits)
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    # Your email for certificate expiration notifications
    email: your-email@example.com # CHANGE THIS!
    privateKeySecretRef:
      name: letsencrypt-staging-key
    solvers:
      - http01:
          ingress:
            class: nginx

---
# Let's Encrypt Production (for real certificates)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    # Production server (use after testing with staging)
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com # CHANGE THIS!
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
      - http01:
          ingress:
            class: nginx
```

```bash
# Apply the ClusterIssuers
kubectl apply -f k8s/cert-manager-issuer.yaml

# Verify
kubectl get clusterissuer

# Expected output:
# NAME                  READY   AGE
# letsencrypt-staging   True    10s
# letsencrypt-prod      True    10s
```

---

## Step 4: Create Production Ingress with SSL

Create/update: `k8s/ingress-production.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: weather-agent-ingress
  namespace: default
  annotations:
    # Ingress class
    kubernetes.io/ingress.class: nginx

    # cert-manager will auto-create SSL certificates
    cert-manager.io/cluster-issuer: "letsencrypt-prod" # Use "letsencrypt-staging" for testing first!

    # Security headers
    nginx.ingress.kubernetes.io/ssl-redirect: "true" # Force HTTPS
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"

    # CORS (adjust as needed)
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-origin: "https://weather-agent.com"
    nginx.ingress.kubernetes.io/cors-allow-credentials: "true"

    # Rate limiting (prevent DDoS)
    nginx.ingress.kubernetes.io/limit-rps: "100"

    # Body size limit
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"

    # Timeouts
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"

spec:
  # TLS configuration
  tls:
    - hosts:
        - weather-agent.com
        - www.weather-agent.com
      secretName: weather-agent-tls # cert-manager will create this secret

  # Routing rules
  rules:
    # Main domain
    - host: weather-agent.com
      http:
        paths:
          # Backend API
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 5001

          # Frontend
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80

    # www subdomain
    - host: www.weather-agent.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
```

---

## Step 5: Deploy Everything

### Deploy Services First

```bash
# MongoDB
kubectl apply -f k8s/mongodb/configmap.yaml
kubectl apply -f k8s/mongodb/secret.yaml
kubectl apply -f k8s/mongodb/pvc.yaml
kubectl apply -f k8s/mongodb/deployment.yaml
kubectl apply -f k8s/mongodb/service.yaml

# Backend
kubectl apply -f k8s/backend/configmap.yaml
kubectl apply -f k8s/backend/secret.yaml
kubectl apply -f k8s/backend/deployment.yaml
kubectl apply -f k8s/backend/service.yaml

# Agent Service (if exposing externally)
kubectl apply -f k8s/agent-service/configmap.yaml
kubectl apply -f k8s/agent-service/secret.yaml
kubectl apply -f k8s/agent-service/deployment.yaml
kubectl apply -f k8s/agent-service/service.yaml

# Web (frontend)
# kubectl apply -f k8s/web/... (if you have it)
```

### Deploy Ingress

```bash
# Apply the production Ingress
kubectl apply -f k8s/ingress-production.yaml

# Watch certificate creation (may take 2-5 minutes)
kubectl get certificate --watch

# Expected output:
# NAME                 READY   SECRET               AGE
# weather-agent-tls    True    weather-agent-tls    2m

# Check Ingress status
kubectl describe ingress weather-agent-ingress
```

---

## Step 6: Verify & Test

### Check Certificate

```bash
# Verify SSL certificate was created
kubectl get secret weather-agent-tls

# Describe the certificate
kubectl describe certificate weather-agent-tls
```

### Test HTTP → HTTPS Redirect

```bash
# Should redirect to HTTPS
curl -I http://weather-agent.com

# Expected:
# HTTP/1.1 308 Permanent Redirect
# Location: https://weather-agent.com/
```

### Test HTTPS

```bash
# Should return 200 OK with valid SSL
curl -I https://weather-agent.com

# Test API endpoint
curl https://weather-agent.com/api/health
```

### Test in Browser

1. Open `https://weather-agent.com`
2. Check for 🔒 padlock icon (valid SSL)
3. Click padlock → Certificate should show "Let's Encrypt Authority X3"
4. Test API: `https://weather-agent.com/api/health`

---

## 🔒 Security Best Practices

### 1. Enable HSTS (HTTP Strict Transport Security)

Add to Ingress annotations:

```yaml
nginx.ingress.kubernetes.io/configuration-snippet: |
  more_set_headers "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload";
  more_set_headers "X-Frame-Options: DENY";
  more_set_headers "X-Content-Type-Options: nosniff";
  more_set_headers "X-XSS-Protection: 1; mode=block";
```

### 2. Implement Rate Limiting

```yaml
# Per IP rate limiting
nginx.ingress.kubernetes.io/limit-rps: "10"
nginx.ingress.kubernetes.io/limit-connections: "5"
```

### 3. IP Whitelisting (if needed)

```yaml
# Only allow specific IPs (e.g., for admin panel)
nginx.ingress.kubernetes.io/whitelist-source-range: "203.0.113.0/24,198.51.100.0/24"
```

### 4. Basic Auth for Sensitive Endpoints

```bash
# Create basic auth secret
htpasswd -c auth admin
kubectl create secret generic basic-auth --from-file=auth

# Add annotation
nginx.ingress.kubernetes.io/auth-type: basic
nginx.ingress.kubernetes.io/auth-secret: basic-auth
nginx.ingress.kubernetes.io/auth-realm: 'Authentication Required'
```

---

## 📊 Monitoring & Logging

### View Ingress Controller Logs

```bash
# Real-time logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --follow

# Check for errors
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx | grep ERROR
```

### Monitor Certificate Status

```bash
# List all certificates
kubectl get certificate -A

# Check certificate details
kubectl describe certificate weather-agent-tls

# View cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager
```

### Enable Prometheus Metrics (Optional)

```bash
# Ingress controller exposes metrics at :10254/metrics
kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 10254:10254

# Access metrics
curl http://localhost:10254/metrics
```

---

## 🔧 Troubleshooting

### Certificate Not Ready

```bash
# Check certificate status
kubectl describe certificate weather-agent-tls

# Common issues:
# 1. DNS not pointing to LoadBalancer IP
# 2. Port 80 blocked (cert-manager needs HTTP for validation)
# 3. Rate limit hit (use staging first!)

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager
```

### 502 Bad Gateway

```bash
# Check if backend pods are running
kubectl get pods

# Check service endpoints
kubectl get endpoints backend

# Check Ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
```

### SSL Certificate Expired/Invalid

```bash
# Delete and recreate certificate
kubectl delete certificate weather-agent-tls
kubectl delete secret weather-agent-tls
kubectl apply -f k8s/ingress-production.yaml
```

---

## 🚀 Advanced: Custom Domain per Service

For `api.weather-agent.com`, `app.weather-agent.com`:

```yaml
spec:
  tls:
    - hosts:
        - api.weather-agent.com
        - app.weather-agent.com
      secretName: weather-agent-tls

  rules:
    - host: api.weather-agent.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 5001

    - host: app.weather-agent.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
```

Don't forget to add DNS A records for subdomains!

---

## 📝 Summary Checklist

- [ ] Install NGINX Ingress Controller
- [ ] Get LoadBalancer external IP
- [ ] Configure DNS A records
- [ ] Wait for DNS propagation (5-30 mins)
- [ ] Install cert-manager
- [ ] Create ClusterIssuer for Let's Encrypt
- [ ] **Test with staging first!** (use `letsencrypt-staging`)
- [ ] Deploy services (ConfigMaps, Secrets, Deployments)
- [ ] Deploy Ingress with `letsencrypt-staging`
- [ ] Verify certificate created successfully
- [ ] Switch to `letsencrypt-prod`
- [ ] Test HTTPS in browser
- [ ] Enable security headers
- [ ] Set up monitoring

---

## 🔗 Useful Commands

```bash
# Quick health check
kubectl get ingress,svc,pods,certificate

# Watch certificate creation
kubectl get certificate --watch

# Describe Ingress
kubectl describe ingress weather-agent-ingress

# Test from inside cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- curl http://backend:5001/api/health

# Force certificate renewal
kubectl delete secret weather-agent-tls
kubectl delete certificate weather-agent-tls
```

---

## 🎓 Next Steps

1. **Set up monitoring**: Prometheus + Grafana for Ingress metrics
2. **Configure backups**: Backup certificates and configs
3. **Implement CI/CD**: Automate deployments with GitHub Actions/GitLab CI
4. **Add WAF**: Consider Cloudflare or AWS WAF for DDoS protection
5. **Load testing**: Use tools like k6 or Apache Bench to test under load

**You're production-ready! 🎉**
