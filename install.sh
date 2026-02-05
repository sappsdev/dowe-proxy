#!/bin/bash
set -e

REPO_URL="${1:-https://sappsdev.github.io/dowe-proxy}"

echo "Installing dependencies..."
sudo apt-get update
sudo apt-get install -y gnupg curl ca-certificates

echo "Adding Dowe Proxy repository..."

curl -fsSL "${REPO_URL}/KEY.gpg" | sudo gpg --dearmor -o /usr/share/keyrings/dowe-proxy.gpg

echo "deb [signed-by=/usr/share/keyrings/dowe-proxy.gpg] ${REPO_URL} stable main" | sudo tee /etc/apt/sources.list.d/dowe-proxy.list

sudo apt-get update
sudo apt-get install -y dowe-proxy

echo ""
echo "Dowe Proxy installed!"
echo "Configure: sudo nano /etc/dowe-proxy/config.env"
echo "Start: sudo systemctl start dowe-proxy"
