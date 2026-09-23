#!/usr/bin/env bash
set -euo pipefail

HUGO_VERSION="0.166.0"
DART_SASS_VERSION="1.105.0"
BIN_DIR="/tmp/hugo-bin"

mkdir -p "$BIN_DIR"
export PATH="$BIN_DIR:$PATH"

# Install Hugo Extended if not executable on current system
if ! hugo version >/dev/null 2>&1; then
  echo "Hugo not found or not executable. Installing Hugo Extended v${HUGO_VERSION}..."
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  ARCH="$(uname -m)"

  if [ "$OS" = "linux" ]; then
    if [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "amd64" ]; then
      HUGO_ARCH="linux-amd64"
    elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
      HUGO_ARCH="linux-arm64"
    else
      HUGO_ARCH="linux-amd64"
    fi
  elif [ "$OS" = "darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
      HUGO_ARCH="darwin-arm64"
    else
      HUGO_ARCH="darwin-universal"
    fi
  else
    HUGO_ARCH="linux-amd64"
  fi

  echo "Downloading Hugo (${HUGO_ARCH})..."
  curl -fsSL "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_${HUGO_ARCH}.tar.gz" -o /tmp/hugo.tar.gz
  tar -xzf /tmp/hugo.tar.gz -C "$BIN_DIR"
  rm -f /tmp/hugo.tar.gz
  chmod +x "$BIN_DIR/hugo"
fi

# Install Dart Sass if not executable on current system
if ! sass --version >/dev/null 2>&1; then
  echo "Dart Sass not found or not executable. Installing Dart Sass v${DART_SASS_VERSION}..."
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  ARCH="$(uname -m)"

  if [ "$OS" = "linux" ]; then
    if [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "amd64" ]; then
      SASS_ARCH="linux-x64"
    elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
      SASS_ARCH="linux-arm64"
    else
      SASS_ARCH="linux-x64"
    fi
  elif [ "$OS" = "darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
      SASS_ARCH="macos-arm64"
    else
      SASS_ARCH="macos-x64"
    fi
  else
    SASS_ARCH="linux-x64"
  fi

  echo "Downloading Dart Sass (${SASS_ARCH})..."
  curl -fsSL "https://github.com/sass/dart-sass/releases/download/${DART_SASS_VERSION}/dart-sass-${DART_SASS_VERSION}-${SASS_ARCH}.tar.gz" -o /tmp/dart-sass.tar.gz
  tar -xzf /tmp/dart-sass.tar.gz -C "$BIN_DIR"
  rm -f /tmp/dart-sass.tar.gz
  ln -sf "$BIN_DIR/dart-sass/sass" "$BIN_DIR/sass"
  chmod +x "$BIN_DIR/sass" "$BIN_DIR/dart-sass/sass"
fi

echo "Hugo version:"
hugo version

echo "Dart Sass version:"
sass --version

BASE_URL="https://adriteyo-das.vercel.app/"
if [ "${VERCEL_ENV:-}" = "preview" ] && [ -n "${VERCEL_URL:-}" ]; then
  BASE_URL="https://${VERCEL_URL}/"
fi

echo "Building site with baseURL: $BASE_URL"
hugo --gc --minify --baseURL "$BASE_URL"
