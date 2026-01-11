# Kubernetes Ingress - Complete Beginner's Guide

## 🎯 What is Ingress?

**Ingress** = Smart traffic router for your Kubernetes cluster

Think of your cluster like an apartment building:

- **Services (ClusterIP)** = Apartments (internal only)
- **Services (NodePort)** = Fire escapes (awkward external access on weird ports)
- **Services (LoadBalancer)** = Separate elevator for each apartment (expensive!)
- **Ingress** = Main lobby with a receptionist who directs guests to the right apartment (smart & cost-effective!)

---

## 📚 Official Definition

> "An Ingress is a collection of rules that allow inbound connections to reach the cluster Services."
>
> — [Kubernetes Official Documentation](https://kubernetes.io/docs/concepts/services-networking/ingress/)

---

## 🔍 When to Use Ingress

### ✅ **Perfect for:**

1. **Multiple web services** that need external access
2. **Path-based routing**: `/api` → backend, `/admin` → admin-panel
3. **Host-based routing**: `api.example.com` → backend, `www.example.com` → frontend
4. **SSL/TLS termination**: Handle HTTPS in one place
5. **Production web applications**

### ❌ **Not for:**

1. **Internal services** (use ClusterIP)
2. **Non-HTTP protocols** like databases (use LoadBalancer/NodePort)
3. **Single service** in a small cluster (overkill, use LoadBalancer)

---

## 🏗️ How Ingress Works

### Architecture:

```
                    INTERNET
                       ↓
            [Ingress Controller]  ← Must be installed first!
              (nginx/traefik)
                       ↓
                  [Ingress Rules]  ← You create this
                       ↓
         ┌──────────┬──────────┬──────────┐
         ↓          ↓          ↓          ↓
    [Service A] [Service B] [Service C] [Service D]
         ↓          ↓          ↓          ↓
    [Pods]     [Pods]     [Pods]     [Pods]
```

### Two Components:

1. **Ingress Controller** (Must install separately)

   - Not included in Kubernetes by default
   - Popular options: NGINX, Traefik, HAProxy, AWS ALB, GCP GLB
   - Does the actual work of routing traffic

2. **Ingress Resource** (What you create - the YAML file)
   - Just rules/configuration
   - Tells the controller how to route traffic

---

## 🚀 Real-World Example: Your Weather-Agent App

### Without Ingress (Messy):

```yaml
# Need 3 separate LoadBalancers (expensive!)
backend service: LoadBalancer on IP 1.2.3.4:5001  💰
agent-service: LoadBalancer on IP 5.6.7.8:5002    💰
web service: LoadBalancer on IP 9.10.11.12:80     💰

# Users access:
http://1.2.3.4:5001/api/weather  ← Ugly!
http://9.10.11.12/                ← Confusing!
```

### With Ingress (Clean):

```yaml
# One LoadBalancer for Ingress Controller
Ingress: LoadBalancer on weather-agent.com  ✅

# Users access:
https://weather-agent.com/api/weather  ← Clean!
https://weather-agent.com/             ← Professional!

# Ingress routes internally:
/api/*    → backend:5001
/agent/*  → agent-service:5002
/*        → web:80
```

---

## 📝 Step-by-Step Setup

### Step 1: Install Ingress Controller

```bash
# For NGINX Ingress Controller (most popular)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

# Verify installation
kubectl get pods -n ingress-nginx

# Wait for external IP
kubectl get svc -n ingress-nginx
```

### Step 2: Create Your Services

First, ensure your services are using `ClusterIP` (not LoadBalancer):

```yaml
# backend/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
spec:
  type: ClusterIP # ← Important!
  selector:
    app: backend
  ports:
    - port: 5001
      targetPort: 5001
```

### Step 3: Create Ingress Resource

```bash
# Apply the ingress.yaml I created for you
kubectl apply -f k8s/ingress.yaml

# Check ingress status
kubectl get ingress

# Should show:
# NAME                   HOSTS               ADDRESS         PORTS
# weather-agent-ingress  weather-agent.com   34.123.45.67    80, 443
```

### Step 4: Update DNS

Point your domain to the Ingress Controller's external IP:

```
A Record: weather-agent.com → 34.123.45.67
```

---

## 🔐 SSL/TLS with Ingress (HTTPS)

### Option 1: Manual Certificate

```yaml
# Create secret with your SSL cert
kubectl create secret tls weather-agent-tls \
  --cert=path/to/cert.pem \
  --key=path/to/key.pem

# Reference in ingress.yaml
spec:
  tls:
    - hosts:
        - weather-agent.com
      secretName: weather-agent-tls
```

### Option 2: Automatic with Let's Encrypt (cert-manager)

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml

# Add annotation to your ingress
annotations:
  cert-manager.io/cluster-issuer: "letsencrypt-prod"

# cert-manager auto-creates and renews certificates!
```

---

## 🎨 Common Routing Patterns

### Pattern 1: Path-Based (Single Domain)

```yaml
# weather-agent.com/api → backend
# weather-agent.com/ → web
paths:
  - path: /api
    backend:
      service:
        name: backend
  - path: /
    backend:
      service:
        name: web
```

### Pattern 2: Host-Based (Subdomains)

```yaml
# api.weather-agent.com → backend
# www.weather-agent.com → web
rules:
  - host: api.weather-agent.com
    paths:
      - path: /
        backend:
          service:
            name: backend
  - host: www.weather-agent.com
    paths:
      - path: /
        backend:
          service:
            name: web
```

### Pattern 3: Mixed

```yaml
# api.weather-agent.com/v1 → backend-v1
# api.weather-agent.com/v2 → backend-v2
# www.weather-agent.com → web
```

---

## 🧪 Testing Locally (without domain)

### Using Minikube:

```bash
minikube addons enable ingress
kubectl apply -f k8s/ingress.yaml
minikube ip  # Get the IP, e.g., 192.168.49.2

# Access via IP
curl http://192.168.49.2/api/health

# Or add to /etc/hosts
echo "192.168.49.2 weather-agent.com" | sudo tee -a /etc/hosts
curl http://weather-agent.com/api/health
```

### Using Kind/Docker Desktop:

```bash
# Port forward the ingress controller
kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 8080:80

# Access via localhost
curl http://localhost:8080/api/health
```

---

## 🆚 Ingress vs Service Types

| Feature         | ClusterIP | NodePort    | LoadBalancer   | **Ingress**  |
| --------------- | --------- | ----------- | -------------- | ------------ |
| External access | ❌ No     | ⚠️ Awkward  | ✅ Yes         | ✅ Yes       |
| Cost (cloud)    | Free      | Free        | 💰 Per service | 💰 One only  |
| Path routing    | ❌        | ❌          | ❌             | ✅           |
| SSL termination | ❌        | ❌          | ❌             | ✅           |
| Domain names    | ❌        | ❌          | ❌             | ✅           |
| Best for        | Internal  | Dev/testing | Single service | **Web apps** |

---

## 📖 Official Resources (Proof!)

1. **Kubernetes Docs**: https://kubernetes.io/docs/concepts/services-networking/ingress/
2. **NGINX Ingress Guide**: https://kubernetes.github.io/ingress-nginx/
3. **When to use Ingress**: https://kubernetes.io/docs/concepts/services-networking/ingress/#when-do-you-use-ingress

---

## ✨ Summary

**What**: Smart HTTP/HTTPS router for your cluster  
**When**: Multiple web services need external access  
**Why**: Cost-effective, SSL support, clean URLs, path/host routing  
**How**: Install controller → Create Ingress resource → Configure DNS

For your weather-agent app, Ingress lets you have:

- ✅ Single domain: `weather-agent.com`
- ✅ Clean paths: `/api`, `/`, `/admin`
- ✅ HTTPS with auto-renewal (cert-manager)
- ✅ One load balancer instead of 3 💰

**I've created [`k8s/ingress.yaml`](file:///Users/mayankgupta/Desktop/weather-agent/k8s/ingress.yaml) for your project - check it out!**
