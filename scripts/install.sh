#!/bin/bash
set -e

PACKAGE_NAME="dowe-proxy"
BINARY_URL="${1:-}"
BINARY_PATH="/usr/bin/dowe-proxy"
CONFIG_DIR="/etc/dowe-proxy"
DATA_DIR="/var/lib/dowe-proxy"
SOCKET_DIR="/tmp/dowe-proxy"

if [ "$(id -u)" != "0" ]; then
   echo "This script must be run as root" 
   exit 1
fi

echo "Installing ${PACKAGE_NAME}..."

apt-get update
apt-get install -y certbot

if [ -n "$BINARY_URL" ]; then
    echo "Downloading binary from ${BINARY_URL}..."
    curl -fsSL "$BINARY_URL" -o "$BINARY_PATH"
elif [ -f "./dowe-proxy-linux-x64" ]; then
    echo "Installing local x64 binary..."
    cp "./dowe-proxy-linux-x64" "$BINARY_PATH"
elif [ -f "./dowe-proxy-linux-arm64" ]; then
    echo "Installing local arm64 binary..."
    cp "./dowe-proxy-linux-arm64" "$BINARY_PATH"
elif [ -f "~/dowe-proxy-linux-x64" ]; then
    echo "Installing binary from home directory..."
    cp ~/dowe-proxy-linux-x64 "$BINARY_PATH"
elif [ -f "~/dowe-proxy-linux-arm64" ]; then
    echo "Installing binary from home directory..."
    cp ~/dowe-proxy-linux-arm64 "$BINARY_PATH"
else
    echo "Error: No binary found."
    echo "Place dowe-proxy-linux-x64 or dowe-proxy-linux-arm64 in current or home directory."
    exit 1
fi

chmod 755 "$BINARY_PATH"

mkdir -p "$CONFIG_DIR"
mkdir -p "$DATA_DIR/projects"
mkdir -p "$DATA_DIR/data"
mkdir -p "$SOCKET_DIR"

if [ ! -f "$CONFIG_DIR/config.env" ]; then
    cat > "$CONFIG_DIR/config.env" << 'EOF'
ADMIN_API_KEY=change-me-to-secure-key

HTTP_PORT=80
HTTPS_PORT=443
ADMIN_PORT=8080

DATA_DIR=/var/lib/dowe-proxy/data
SOCKETS_DIR=/tmp/dowe-proxy

CERTBOT_PATH=/usr/bin/certbot
LETSENCRYPT_DIR=/etc/letsencrypt/live

LOG_LEVEL=info
NODE_ENV=production
EOF
    echo "Created config at $CONFIG_DIR/config.env"
    echo "IMPORTANT: Change ADMIN_API_KEY before starting!"
fi

cat > /etc/systemd/system/dowe-proxy.service << 'EOF'
[Unit]
Description=Dowe Proxy - Bun Reverse Proxy with Auto SSL
After=network.target

[Service]
Type=simple
User=root
Group=root
ExecStart=/usr/bin/dowe-proxy
Restart=always
RestartSec=5
EnvironmentFile=/etc/dowe-proxy/config.env
WorkingDirectory=/var/lib/dowe-proxy
StandardOutput=journal
StandardError=journal
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable dowe-proxy.service

echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Edit /etc/dowe-proxy/config.env (change ADMIN_API_KEY!)"
echo "  2. systemctl start dowe-proxy"
echo "  3. systemctl status dowe-proxy"
echo ""
echo "Logs: journalctl -u dowe-proxy -f"
