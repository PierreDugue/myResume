#!/usr/bin/env bash
# Tests how nginx.conf.template finds the visitor's IP (set_real_ip_from, REAL_IP_PROXIES).
#
# Runs the real nginx image with the template, plus a stand-in backend on port 8081 that answers
# with the X-Client-IP header nginx forwarded. Requests come from the Docker host, so they reach
# nginx from a private address, like Render's internal proxy (10.x) does.
#
# Usage, from the repo root: apps/frontend/nginx/test-real-ip.sh (needs Docker)
set -euo pipefail

cd "$(dirname "$0")/.."
IMAGE=nginx:alpine
PORT=18080
WORK=$(mktemp -d)
CONTAINER=""
FAILED=0
IMAGE_DEFAULT=$(sed -n 's/^ENV REAL_IP_PROXIES=//p' Dockerfile)
if [[ -z "$IMAGE_DEFAULT" ]]; then
  echo "✗ the Dockerfile sets no default REAL_IP_PROXIES"
  FAILED=1
fi

cleanup() {
  [[ -n "$CONTAINER" ]] && docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

# Stand-in backend: echoes the visitor IP that nginx sends in X-Client-IP.
cat >"$WORK/echo.conf" <<'EOF'
server {
    listen 8081;
    location / { return 200 "$http_x_client_ip"; }
}
EOF

start() {
  [[ -n "$CONTAINER" ]] && docker rm -f "$CONTAINER" >/dev/null
  local env=(-e BACKEND_URL=http://127.0.0.1:8081 -e PROXY_SECRET=test -e NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1)
  # No argument: the image's default, from the Dockerfile's ENV line.
  env+=(-e "REAL_IP_PROXIES=${1:-$IMAGE_DEFAULT}")
  CONTAINER=$(docker run -d -p "127.0.0.1:$PORT:80" "${env[@]}" \
    -v "$PWD/nginx.conf.template:/etc/nginx/templates/default.conf.template:ro" \
    -v "$PWD/nginx/real-ip:/etc/nginx/real-ip:ro" \
    -v "$WORK/echo.conf:/etc/nginx/conf.d/echo.conf:ro" \
    "$IMAGE")
  for _ in $(seq 50); do
    curl -s -o /dev/null "http://127.0.0.1:$PORT/api/" && return 0
    [[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" == "true" ]] || return 1
    sleep 0.1
  done
  return 1
}

# expect <description> <X-Forwarded-For sent by the platform> <IP the backend should get>
expect() {
  local got
  got=$(curl -s -H "X-Forwarded-For: $2" "http://127.0.0.1:$PORT/api/")
  if [[ "$got" == "$3" ]]; then
    echo "  ✓ $1"
  else
    echo "  ✗ $1: expected $3, got '${got}'"
    FAILED=1
  fi
}

echo "REAL_IP_PROXIES unset (the image default, for Docker Compose and Caddy)"
start
expect "skips private proxies to find the visitor" "63.245.222.35, 10.30.15.54" "63.245.222.35"
expect "ignores addresses a visitor adds on the left" "1.2.3.4, 63.245.222.35, 10.30.15.54" "63.245.222.35"
expect "does not trust Cloudflare: a request through it could fake its IP" \
  "1.2.3.4, 162.158.111.171" "162.158.111.171"

echo "REAL_IP_PROXIES=cloudflare (Render, which sits behind Cloudflare)"
start cloudflare
expect "skips Cloudflare and Render's proxy to find the visitor" \
  "63.245.222.35, 162.158.111.171, 10.30.15.54" "63.245.222.35"
expect "skips every Cloudflare IPv4 range (e.g. 104.23.x, 172.69.x)" \
  "63.245.222.35, 104.23.187.124, 172.69.151.111" "63.245.222.35"
expect "skips Cloudflare's IPv6 ranges" "63.245.222.35, 2606:4700::6810:1" "63.245.222.35"
expect "keeps an IPv6 visitor" "2001:db8::1, 162.158.111.171" "2001:db8::1"
expect "still ignores addresses a visitor adds on the left" \
  "1.2.3.4, 63.245.222.35, 162.158.111.171, 10.30.15.54" "63.245.222.35"

echo "REAL_IP_PROXIES=private"
start private
expect "behaves like the default" "63.245.222.35, 162.158.111.171" "162.158.111.171"

echo "REAL_IP_PROXIES with an unknown value"
if start typo 2>/dev/null; then
  echo "  ✗ nginx should refuse to start"
  FAILED=1
else
  echo "  ✓ nginx refuses to start instead of trusting the wrong proxies"
fi

exit "$FAILED"
