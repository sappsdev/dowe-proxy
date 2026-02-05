#!/bin/bash
set -e

REPO_URL="${1:-https://sappsdev.github.io/dowe-proxy}"

echo "Adding Dowe Proxy repository..."

curl -fsSL "${REPO_URL}/KEY.gpg" | sudo gpg --dearmor -o /usr/share/keyrings/dowe-proxy.gpg

echo "deb [signed-by=/usr/share/keyrings/dowe-proxy.gpg] ${REPO_URL}/apt stable main" | sudo tee /etc/apt/sources.list.d/dowe-proxy.list

sudo apt update
sudo apt install -y dowe-proxy

echo ""
echo "Dowe Proxy installed!"
echo "Configure: sudo nano /etc/dowe-proxy/config.env"
echo "Start: sudo systemctl start dowe-proxy"
