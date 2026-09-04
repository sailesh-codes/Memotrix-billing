# Ubuntu 22.04 LTS + Nginx Reverse Proxy Deployment Guide

## 1. System Requirements & Prerequisites
- Ubuntu 22.04 LTS Server
- Domain name pointed to server public IP (e.g. `pos.memotrix.com`)
- Docker & Docker Compose installed

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx certbot python3-certbot-nginx docker.io docker-compose-v2
sudo systemctl enable docker nginx
```

## 2. Deploy Application via Docker Compose
Clone repository to `/var/www/memotrix`:

```bash
cd /var/www/memotrix
docker compose up -d --build
```

Verify backend health check:
```bash
curl http://localhost:5000/api/health
```

## 3. Configure Nginx Reverse Proxy
Create `/etc/nginx/sites-available/memotrix`:

```nginx
server {
    listen 80;
    server_name pos.memotrix.com;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/memotrix /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 4. SSL Encryption with Let's Encrypt
```bash
sudo certbot --nginx -d pos.memotrix.com
```
Certbot will configure SSL certificates and auto-renewals.
