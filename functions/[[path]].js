// This is a placeholder for the full backend code.
// Due to the complexity, I will provide the complete, unified backend
// in a subsequent step after you confirm this new structure.
// For now, this ensures the project can be set up.

import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-pages';

const app = new Hono();

app.get('/api/hello', (c) => {
  return c.json({ message: 'Hello from Hono!' });
});

app.get('*', serveStatic({ root: './' }));

export const onRequest = app;
