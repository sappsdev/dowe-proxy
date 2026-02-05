#!/bin/bash
set -e

VERSION="1.0.0"
PACKAGE_NAME="dowe-proxy"

echo "Building ${PACKAGE_NAME} v${VERSION} for Linux..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${PROJECT_ROOT}/build"

rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

cd "${PROJECT_ROOT}"

echo "Compiling for linux-x64..."
bun build src/index.ts --compile --target=bun-linux-x64 --outfile "${BUILD_DIR}/${PACKAGE_NAME}-linux-x64"

echo "Compiling for linux-arm64..."
bun build src/index.ts --compile --target=bun-linux-arm64 --outfile "${BUILD_DIR}/${PACKAGE_NAME}-linux-arm64"

echo ""
echo "Binaries built successfully:"
ls -la "${BUILD_DIR}/"
echo ""
echo "To deploy:"
echo "  scp ${BUILD_DIR}/${PACKAGE_NAME}-linux-x64 user@server:/usr/local/bin/dowe-proxy"
