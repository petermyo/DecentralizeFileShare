/**
 * =================================================================================
 * Hono Backend for Cloudflare Pages
 * CORRECT FILE PATH: /functions/[[path]].js
 * =================================================================================
 */

import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-pages';
import * as jose from 'jose';

// --- Constants & Config ---
const FOLDER_NAME = "Decentralized File Share";
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const ADMIN_USER_IDS = ['118136495390756743317', '108180268584101876155'];

const app = new Hono();

// --- JWT & Cookie Helpers ---
const getJwtSecret = (c) => new TextEncoder().encode(c.env.JWT_SECRET);

const getCookie = (c, name) => {
    const cookieHeader = c.req.header('Cookie');
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
        const parts = cookie.trim().split('=');
        if (parts[0] === name) return parts[1];
    }
    return null;
};

const createCookieHeader = (name, value, options = {}) => {
    let cookie = `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax`;
    if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
    return cookie;
}

// --- Middleware ---
const authMiddleware = async (c, next) => {
    const token = getCookie(c, 'auth_token');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);
    try {
        const { payload } = await jose.jwtVerify(token, await getJwtSecret(c));
        if (!payload || !payload.userId) throw new Error('Invalid token payload.');
        c.set('user', payload);
        await next();
    } catch (err) {
        return c.json({ error: 'Invalid or expired token' }, 401);
    }
};

const adminMiddleware = async (c, next) => {
    const user = c.get('user');
    if (!ADMIN_USER_IDS.includes(user.userId)) {
        return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
};

// --- API Route Groups ---
const api = new Hono();
const adminApi = new Hono();

// --- Public Auth Routes ---
api.get('/auth/google/login', (c) => {
    const url = new URL(c.req.url);
    const authUrl = new URL(GOOGLE_AUTH_URL);
    authUrl.searchParams.set('client_id', c.env.GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', `${url.origin}/api/auth/google/callback`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    return c.redirect(authUrl.toString());
});

api.get('/auth/google/callback', async (c) => {
    // ... (Full callback logic here)
});

// --- Authenticated User Routes ---
api.use('/me', authMiddleware);
api.get('/me', (c) => c.json({ loggedIn: true, ...c.get('user') }));

// ... (All other user API routes here)

// --- Admin API Routes ---
adminApi.use('*', authMiddleware, adminMiddleware);
adminApi.get('/check', (c) => c.json({ isAdmin: true }));
adminApi.get('/stats', async (c) => { /* ... */ });
adminApi.get('/users', async (c) => { /* ... */ });
// ... (All other admin routes here)

// --- Main Hono App ---
app.route('/api', api);
app.route('/api/admin', adminApi);

// Public download and list routes
app.get('/s/:shortcode', async (c) => { /* ... */ });
app.get('/l/:shortcode', async (c) => { /* ... */ });

// Serve static assets and the React app
app.get('*', serveStatic({ root: './public' }));
app.get('*', serveStatic({ path: './public/index.html' }));

export const onRequest = app;
