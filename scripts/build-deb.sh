#!/bin/bash
set -e

VERSION="1.0.0"
PACKAGE_NAME="dowe-proxy"
ARCH="amd64"

echo "Building ${PACKAGE_NAME} v${VERSION} for Linux ${ARCH}..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${PROJECT_ROOT}/build"
DEB_ROOT="${BUILD_DIR}/deb-package"

rm -rf "${BUILD_DIR}"
mkdir -p "${DEB_ROOT}"

echo "Compiling binary for Linux..."
cd "${PROJECT_ROOT}"
bun build src/index.ts --compile --target=bun-linux-x64 --outfile "${BUILD_DIR}/${PACKAGE_NAME}"

echo "Creating package structure..."
mkdir -p "${DEB_ROOT}/DEBIAN"
mkdir -p "${DEB_ROOT}/usr/bin"
mkdir -p "${DEB_ROOT}/etc/systemd/system"
mkdir -p "${DEB_ROOT}/etc/dowe-proxy"
mkdir -p "${DEB_ROOT}/var/lib/dowe-proxy/projects"
mkdir -p "${DEB_ROOT}/var/lib/dowe-proxy/data"

cp "${BUILD_DIR}/${PACKAGE_NAME}" "${DEB_ROOT}/usr/bin/${PACKAGE_NAME}"
chmod 755 "${DEB_ROOT}/usr/bin/${PACKAGE_NAME}"

cp "${PROJECT_ROOT}/debian/DEBIAN/control" "${DEB_ROOT}/DEBIAN/"
cp "${PROJECT_ROOT}/debian/DEBIAN/postinst" "${DEB_ROOT}/DEBIAN/"
cp "${PROJECT_ROOT}/debian/DEBIAN/prerm" "${DEB_ROOT}/DEBIAN/"
chmod 755 "${DEB_ROOT}/DEBIAN/postinst"
chmod 755 "${DEB_ROOT}/DEBIAN/prerm"

sed -i.bak "s/Version:.*/Version: ${VERSION}/" "${DEB_ROOT}/DEBIAN/control"
rm -f "${DEB_ROOT}/DEBIAN/control.bak"

cp "${PROJECT_ROOT}/debian/etc/systemd/system/dowe-proxy.service" "${DEB_ROOT}/etc/systemd/system/"
cp "${PROJECT_ROOT}/debian/etc/dowe-proxy/config.env" "${DEB_ROOT}/etc/dowe-proxy/"

echo "Building .deb package..."
DEB_FILE="${BUILD_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"
dpkg-deb --build "${DEB_ROOT}" "${DEB_FILE}"

echo ""
echo "Package built successfully: ${DEB_FILE}"
echo ""
echo "To install:"
echo "  sudo dpkg -i ${DEB_FILE}"
echo "  sudo apt-get install -f  # Install dependencies"
echo ""
echo "Or copy to your Linux server and install there."
