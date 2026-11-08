# Deploying on a VPS

Any Linux VPS works (Ubuntu 22.04/24.04 shown here). 1 vCPU / 1 GB RAM is plenty for hundreds of players.
All games live in the server's memory, so run **one** server process (no clustering).

## 1. Point your domain at the VPS
Create an `A` record for your domain (e.g. `hezz2.ma`) with the VPS IP address.

## 2. Install Node.js, nginx and certbot
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx git
```

## 3. Get the code and install
```bash
sudo git clone https://github.com/josephherramone-dev/cartamghribia.git /opt/cartamghribia
sudo useradd --system --home /opt/cartamghribia --shell /usr/sbin/nologin cartamghribia
cd /opt/cartamghribia && sudo npm ci --omit=dev
sudo chown -R cartamghribia:cartamghribia /opt/cartamghribia
```

## 4. Run it as a service (auto-restarts, starts on boot)
```bash
sudo cp deploy/cartamghribia.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cartamghribia
curl http://127.0.0.1:3000/health   # → {"ok":true}
```

## 5. nginx in front, with HTTPS
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/cartamghribia
sudo sed -i 's/example.com/YOUR-DOMAIN/g' /etc/nginx/sites-available/cartamghribia
sudo ln -s /etc/nginx/sites-available/cartamghribia /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d YOUR-DOMAIN
```
Open the firewall if it is enabled: `sudo ufw allow 'Nginx Full'`.

The nginx config passes the WebSocket `Upgrade` headers. Without them, multiplayer falls back to slow polling.

## Updating
```bash
cd /opt/cartamghribia && sudo -u cartamghribia git pull && sudo -u cartamghribia npm ci --omit=dev
sudo systemctl restart cartamghribia
```
A restart ends games in progress, so update when few people are playing.

## Alternative: Docker
```bash
docker build -t cartamghribia .
docker run -d --restart unless-stopped -p 127.0.0.1:3000:3000 --name cartamghribia cartamghribia
```
Then use the same nginx + certbot steps.

## Logs
```bash
sudo journalctl -u cartamghribia -f
```
