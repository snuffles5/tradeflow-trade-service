# TradeFlow Production Deployment Guide

## Infrastructure Overview

- **VPS**: Hetzner Cloud - https://console.hetzner.com/projects/12221613/servers
- **Database**: Azure MySQL - `trade-flow.mysql.database.azure.com`
- **CI/CD**: GitHub Actions (builds and pushes to GHCR)
- **Container Registry**: GitHub Container Registry (ghcr.io)

## Production Server Setup

### Initial Server Setup (One-time)

1. **Install Docker on Hetzner VPS:**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   ```

2. **Login to GitHub Container Registry:**
   ```bash
   echo YOUR_GITHUB_PAT | docker login ghcr.io -u snuffles5 --password-stdin
   ```
   *Create a PAT with `read:packages` scope at https://github.com/settings/tokens*

3. **Create deployment directory:**
   ```bash
   sudo mkdir -p /opt/tradeflow
   cd /opt/tradeflow
   ```

4. **Create prod.env file:**
   ```bash
   sudo nano /opt/tradeflow/prod.env
   ```
   
   Paste the production environment variables:
   ```env
   # MySQL Azure Database
   DB_NAME=tradeflow
   DB_USER=snuffles
   DB_PASS=AdminP@ssw0rd1
   DB_PORT=3306
   DB_HOST=trade-flow.mysql.database.azure.com
   
   # Yahoo Finance API
   YAHOO_APP_ID=0To8H7cY
   YAHOO_CLIENT_ID=dj0yJmk9aWpyNFViUkRucXJuJmQ9WVdrOU1GUnZPRWczWTFrbWNHbzlNQT09JnM9Y29uc3VtZXJzZWNyZXQmc3Y9MCZ4PTg2
   YAHOO_CLIENT_SECRET=54cb24aee40d3550fa7eda8ea4d36ab85d42fc6a
   YAHOO_REDIRECT_URI=http://127.0.0.1:5000/callback
   ```

5. **Download docker-compose.prod.yml:**
   ```bash
   sudo curl -o /opt/tradeflow/docker-compose.yml \
     https://raw.githubusercontent.com/snuffles5/tradeflow-trade-service/main/docker-compose.prod.yml
   ```

### Azure MySQL Configuration

1. **Ensure VPS IP is whitelisted in Azure:**
   - Go to Azure Portal → MySQL Server → Connection security
   - Add your Hetzner VPS public IP (157.180.112.35) to firewall rules

2. **Verify database user has proper permissions:**
   ```sql
   GRANT ALL PRIVILEGES ON *.* TO 'snuffles'@'%';
   FLUSH PRIVILEGES;
   ```

## Deployment Process

### Standard Deployment (After GitHub Actions Build)

1. **Pull latest images:**
   ```bash
   cd /opt/tradeflow
   docker compose pull
   ```

2. **Restart services:**
   ```bash
   docker compose up -d
   ```

3. **Verify deployment:**
   ```bash
   docker compose ps
   docker compose logs -f api
   ```

4. **Health check:**
   ```bash
   curl http://localhost:9090/actuator/health
   ```

### Manual Deployment (Force rebuild)

```bash
cd /opt/tradeflow
docker compose down
docker compose pull
docker compose up -d
docker compose logs -f
```

### Troubleshooting

**View logs:**
```bash
docker compose logs -f api        # Follow API logs
docker compose logs --tail=100 api  # Last 100 lines
```

**Check container status:**
```bash
docker compose ps
docker compose top
```

**Restart specific service:**
```bash
docker compose restart api
```

**Full cleanup and restart:**
```bash
docker compose down
docker system prune -f
docker compose pull
docker compose up -d
```

## CI/CD Pipeline

1. Push to `main` branch triggers GitHub Actions
2. Workflow builds Docker image and pushes to `ghcr.io/snuffles5/tradeflow-trade-service:main`
3. SSH into VPS and run deployment commands above

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | Azure MySQL hostname | `trade-flow.mysql.database.azure.com` |
| `DB_NAME` | Database name | `tradeflow` |
| `DB_USER` | Database username | `snuffles` |
| `DB_PASS` | Database password | `AdminP@ssw0rd1` |
| `DB_PORT` | Database port | `3306` |

## URLs

- **API**: http://<VPS_IP>:9090
- **Web**: http://<VPS_IP>:80
- **API Docs**: http://<VPS_IP>:9090/swagger-ui.html
- **Health**: http://<VPS_IP>:9090/actuator/health

## Security Notes

- ⚠️ **Production credentials are in this file** - ensure proper access control
- Change default passwords before production use
- Use Azure Private Link for database connection in production
- Configure HTTPS with Let's Encrypt (recommended)
- Review and update firewall rules regularly
