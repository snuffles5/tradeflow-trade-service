# Production Environment Setup

## Quick Reference

### Infrastructure
- **VPS**: Hetzner Cloud
  - Console: https://console.hetzner.com/projects/12221613/servers
  - Current IP: 157.180.112.35
  - Deployment path: `/opt/tradeflow`

- **Database**: Azure MySQL
  - Host: `trade-flow.mysql.database.azure.com`
  - Database: `tradeflow`
  - User: `snuffles`
  - Port: 3306

- **CI/CD**: GitHub Actions
  - Builds on push to `main` branch
  - Pushes images to `ghcr.io/snuffles5/tradeflow-trade-service:main`
  - See: `.github/workflows/build-push.yml`

### Critical Configuration

**JDBC URL Must Include:**
- `createDatabaseIfNotExist=true` - Auto-creates database
- `sslMode=REQUIRED` - Azure MySQL requires SSL

**Example:**
```
jdbc:mysql://trade-flow.mysql.database.azure.com:3306/tradeflow?createDatabaseIfNotExist=true&sslMode=REQUIRED
```

### Deployment Files
- Local dev: `docker-compose.yml` (includes MySQL container)
- Production: `docker-compose.prod.yml` (uses Azure MySQL)
- Environment: `prod.env` (production variables)
- Guide: `DEPLOYMENT.md` (full deployment instructions)

### Common Issues
1. **Access denied**: Check Azure firewall rules include VPS IP
2. **Unknown database**: Ensure `createDatabaseIfNotExist=true` in JDBC URL
3. **SSL errors**: Ensure `sslMode=REQUIRED` in JDBC URL
4. **Version warning**: Remove `version:` from docker-compose.yml (obsolete)

### Quick Deploy
```bash
cd /opt/tradeflow
docker compose pull
docker compose up -d
docker compose logs -f api
```
