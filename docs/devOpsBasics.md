# DevOps basics

## nginx

nginx is a web server. In myResume it runs inside the **frontend container** and is the front door for every request that reaches the app. It has two main jobs, plus a few smaller ones. Config: [nginx.conf.template](../apps/frontend/nginx.conf.template).

### Why you need it

Once built, the Angular app is just static files: `index.html`, some `.js` bundles, CSS and images in `dist/apps/frontend/browser`. Nothing in there can answer an HTTP request on its own. In development, `npm start` runs a dev server that does it for you. In production something has to listen on port 80 and send those files: that's nginx. The [frontend Dockerfile](../apps/frontend/Dockerfile) builds the app, then copies the files into an `nginx:alpine` image.

```
Browser ──► nginx ──┬── /                 → Angular files (/usr/share/nginx/html)
                    └── /api/... + socket → BACKEND_URL (NestJS)
```

### Job 1: send the Angular files

```nginx
location / {
    root /usr/share/nginx/html;
    index index.html index.htm;
    try_files $uri $uri/ /index.html;
}
```

- A request for `/main-abc123.js` gets that file from disk.
- A request for `/dashboards/quality` has no matching file, because that page only exists inside Angular's router. `try_files` tries the file, then a folder, and finally falls back to `index.html`. Angular then loads and shows the right page.
- Without the `try_files` line, refreshing any page other than `/`, or opening a shared link to one, would give a 404.

### Job 2: pass `/api` calls to the backend (reverse proxy)

```nginx
location /api/ {
    resolver ${NGINX_LOCAL_RESOLVERS} valid=30s ipv6=off;
    set $backend ${BACKEND_URL};
    proxy_pass $backend;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_read_timeout 1h;
    ...
}
```

The browser only knows one address: your site. When Angular calls `/api/resume`, nginx forwards the request to NestJS, waits for the answer and sends it back. The browser never talks to the backend directly. This is called a **reverse proxy**. Because of it:

- **Frontend and backend look like one site.** No CORS setup is needed, and the strict security policy (`connect-src 'self'`) works.
- **The backend can stay off the internet.** In Docker Compose, `BACKEND_URL=http://backend:3000` is an address that only exists on the internal Docker network.
- **WebSockets go through too.** The `Upgrade` and `Connection 'upgrade'` headers turn a normal HTTP request into a WebSocket, and `proxy_read_timeout 1h` stops nginx from closing quiet Socket.IO connections.
- **The path is passed unchanged.** `/api/resume` reaches the backend as `/api/resume`, since the backend uses `/api` as its global prefix.

Two details that matter on hosting platforms:

- **`resolver` + a variable in `proxy_pass`.** nginx normally looks up the backend's address only once, at startup. With a variable and a `resolver`, it looks it up again every 30 seconds. On Render the address behind a hostname can change, and nginx would otherwise keep calling an old one.
- **`Host $proxy_host`.** The request is sent with the backend's own hostname, not the visitor's domain. Render uses the hostname to decide which service gets the request. The visitor's domain is kept in `X-Forwarded-Host`.

### Smaller jobs

1. **Finds the visitor's real IP.** On Render, a request passes through Cloudflare and Render's own proxy before reaching nginx, so the connection comes from them, not from the visitor. Each proxy adds the address it received the request from to the `X-Forwarded-For` header. nginx reads that header from the right and skips the proxies it trusts. The list depends on `REAL_IP_PROXIES`: `private` (the default) or `cloudflare` on Render, from [nginx/real-ip/](../apps/frontend/nginx/real-ip/). Addresses a visitor adds themselves, on the left, are ignored. nginx then sends the visitor's IP to the backend as `X-Client-IP`, which the backend uses for rate limiting. [test-real-ip.sh](../apps/frontend/nginx/test-real-ip.sh) tests this against the real nginx image.
2. **Proves requests came through it.** On Render the backend has a public address, so anyone could call it directly and pretend to be any IP. nginx adds an `X-Proxy-Secret` header, and the backend refuses requests that don't carry it (except `/api/health`, for Render's health check). That's what `PROXY_SECRET` is for. Where the backend is private (Docker Compose, AWS), it isn't needed.
3. **Adds security headers** to every response, error pages included (`always`):
   - `Content-Security-Policy`: only scripts from your own site can run, and no inline scripts. That's why the theme bootstrap lives in `public/theme-init.js`.
   - `Strict-Transport-Security`: browsers use HTTPS only for this site, for a year.
   - `X-Frame-Options: DENY`: other sites can't embed yours in a frame.
   - `X-Content-Type-Options: nosniff` and `Referrer-Policy: same-origin`.
   - One nginx trap: a `location` that has its own `add_header` drops all the server-level ones. That's why the locations in the template must not use `add_header`.
4. **Rewrites `index.html`.** `sub_filter` replaces `__SITE_ORIGIN__` with `https://<the domain the request came in on>`. Crawlers need absolute URLs in the Open Graph tags, which LinkedIn and Slack use for link previews.

### How it's configured

`nginx.conf.template` is a **template**. When the container starts, the official nginx image fills in `${BACKEND_URL}`, `${PROXY_SECRET}`, `${REAL_IP_PROXIES}` and `${NGINX_LOCAL_RESOLVERS}` from the environment, then writes the result to `/etc/nginx/conf.d/default.conf`. Only variables that are set get replaced, so nginx's own variables like `$host` stay untouched.

That's how the same image works everywhere; only the environment variables change:

| Where          | `BACKEND_URL`                            | `REAL_IP_PROXIES` | `PROXY_SECRET` |
| -------------- | ---------------------------------------- | ----------------- | -------------- |
| Docker Compose | `http://backend:3000` (default)          | `private`         | not needed     |
| Render         | `https://my-resume-backend.onrender.com` | `cloudflare`      | required       |
| AWS (ECS)      | `http://backend:3000` (Service Connect)  | `private`         | not needed     |

### What nginx doesn't do: HTTPS

nginx only listens on plain HTTP (port 80). Something in front of it handles HTTPS and forwards to it:

| Where           | HTTPS handled by          | Then forwards to |
| --------------- | ------------------------- | ---------------- |
| Render          | Render / Cloudflare edge  | nginx            |
| Your own server | Caddy                     | nginx            |
| AWS             | Load balancer (ALB) + ACM | nginx            |

So the full path is: **HTTPS layer → nginx → files or backend**. nginx could handle HTTPS itself, but letting the platform or Caddy do it means you never manage certificates.

### In short

nginx serves the Angular files and forwards `/api` and WebSockets to the backend, so everything looks like one site. On the way, it adds the security headers, works out the visitor's real IP and vouches for the request with the proxy secret.
