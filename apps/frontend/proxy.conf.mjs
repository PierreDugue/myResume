// Dev server proxy: /api (HTTP + WebSockets) -> NestJS, path unchanged (the backend uses the /api prefix).
// The backend port is BACKEND_PORT (shell or root .env), 3000 by default, as in the backend config.
try {
  process.loadEnvFile('.env');
} catch {
  // no .env: defaults apply
}

const port = process.env.BACKEND_PORT ?? '3000';

export default {
  '/api': {
    target: `http://localhost:${port}`,
    secure: false,
    ws: true,
  },
};
