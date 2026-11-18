# DevOps basics

## nginx

nginx is a web server. In myResume it runs inside the **frontend container** and receives every request that reaches the app. Config: [nginx.conf.template](../apps/frontend/nginx.conf.template).

```
Browser ──► nginx ──┬── /                 → Angular files (/usr/share/nginx/html)
                    └── /api/... + socket → BACKEND_URL (NestJS)
```

### 1. Sends the Angular files

The built Angular app is just static files (`index.html`, `.js`, `.css`). Something has to answer HTTP requests with them in production: that's nginx.

```nginx
location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
}
```

`/main-abc123.js` returns that file. `/dashboards/quality` has no matching file (the page only exists in Angular's router), so `try_files` falls back to `index.html` and Angular shows the right page. Without it, refreshing any page other than `/` would give a 404.

### 2. Forwards `/api` to the backend (reverse proxy)

```nginx
location /api/ {
    set $backend ${BACKEND_URL};
    proxy_pass $backend;
}
```

The browser only talks to one address. nginx passes `/api/...` calls and Socket.IO connections to NestJS and returns the answer. Because of this:

- Frontend and backend look like one site, so there's no CORS, and the security policy can allow only `'self'`.
- The backend can stay off the internet (`http://backend:3000` only exists on the internal Docker network).
- WebSockets work, thanks to the `Upgrade` / `Connection` headers and the 1-hour read timeout.

### 3. Smaller jobs

- **Visitor IP:** behind proxies (Cloudflare and Render), nginx reads `X-Forwarded-For` from the right, skipping the trusted proxies (`REAL_IP_PROXIES`). It sends the result to the backend as `X-Client-IP`, which the backend uses for rate limiting.
- **Proxy secret:** on Render the backend is public, so nginx adds `X-Proxy-Secret`. The backend refuses requests without it.
- **Security headers:** Content-Security-Policy (no inline scripts), HSTS (HTTPS only), `X-Frame-Options` (no embedding).
- **Link previews:** replaces `__SITE_ORIGIN__` in `index.html` with `https://<domain>` for the Open Graph tags.

### Configuration

The file is a **template**. When the container starts, the nginx image fills in `${BACKEND_URL}`, `${PROXY_SECRET}`, … from the environment. The same image runs in Docker Compose, on Render or on AWS; only the environment variables change.

### What nginx doesn't do: HTTPS

nginx only listens on HTTP (port 80). Something in front of it handles HTTPS:

| Where           | HTTPS handled by          |
| --------------- | ------------------------- |
| Render          | Render / Cloudflare edge  |
| Your own server | Caddy                     |
| AWS             | Load balancer (ALB) + ACM |

**In short:** nginx serves the Angular files and forwards `/api` and WebSockets to the backend, so everything looks like one site. On the way, it adds the security headers and the visitor's IP.
