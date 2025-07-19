/**
 * =================================================================================
 * Hono Backend for Cloudflare Pages
 * CORRECT FILE PATH: /functions/[[path]].js
 * =================================================================================
 *
 * This single, unified file handles all backend routing for the entire application,
 * including the main API, admin API, and public link redirects.
 *
 */

import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-pages';
import * as jose from 'jose';

// --- Constants ---
const FOLDER_NAME = "Decentralized File Share";
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const ADMIN_USER_IDS = ['118136495390756743317', '108180268584101876155'];

// --- JWT & Cookie Helpers ---
const getJwtSecret = (env) => new TextEncoder().encode(env.JWT_SECRET);

function getCookie(request, name) {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
        const parts = cookie.trim().split('=');
        if (parts[0] === name) return parts[1];
    }
    return null;
}

function createCookieHeader(name, value, options = {}) {
    let cookie = `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax`;
    if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
    return cookie;
}

// --- Auth Helpers ---
async function getAuthenticatedUserId(request, env) {
    const token = getCookie(request, 'auth_token');
    if (!token) {
        throw new Response(JSON.stringify({ error: 'Unauthorized. Please log in.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    try {
        const { payload } = await jose.jwtVerify(token, await getJwtSecret(env));
        if (!payload || !payload.userId) {
            throw new Error('Invalid token payload.');
        }
        return payload.userId;
    } catch (err) {
        const headers = new Headers({ 'Content-Type': 'application/json' });
        headers.set('Set-Cookie', createCookieHeader('auth_token', '', { maxAge: -1 }));
        const responseBody = JSON.stringify({ error: 'Invalid or expired token. Please log in again.' });
        throw new Response(responseBody, { status: 401, headers });
    }
}

async function isAdmin(request, env) {
    const token = getCookie(request, 'auth_token');
    if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    try {
        const { payload } = await jose.jwtVerify(token, await getJwtSecret(env));
        if (!payload || !payload.userId) {
            throw new Error('Invalid token payload.');
        }
        if (!ADMIN_USER_IDS.includes(payload.userId)) {
            return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Invalid or expired token.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
}

// --- Handler Functions (all your existing handler functions go here, unchanged) ---
// ... (Paste all your handler functions from your middleware here) ...
// For brevity, not repeating them in this snippet, but you should paste them all in this section.

// --- Hono App Setup ---
const app = new Hono();

// --- Admin API Router ---
const adminApi = new Hono();
adminApi.use('*', async (c, next) => {
    const authResponse = await isAdmin(c.req.raw, c.env);
    if (authResponse.status !== 200) {
        return authResponse;
    }
    await next();
});
adminApi.get('/stats', c => getStats(c.env));
adminApi.get('/users', c => getUsers(c.env));
adminApi.post('/revoke', c => revokeUserAccess(c.req.raw, c.env));
adminApi.get('/files', c => getAllFiles(c.env));
adminApi.get('/lists', c => getAllLists(c.env));
adminApi.post('/delete-file', c => deleteFileAsAdmin(c.req.raw, c.env));
adminApi.post('/delete-list', c => deleteListAsAdmin(c.req.raw, c.env));
// Add more admin routes as needed

// --- User API Router ---
const api = new Hono();
api.get('/auth/google/login', c => handleLogin(c.req.raw, c.env));
api.get('/auth/google/callback', c => handleCallback(c.req.raw, c.env));
api.post('/upload/initiate', c => handleUploadInitiate(c.req.raw, c.env));
api.post('/upload/finalize', c => handleUploadFinalize(c.req.raw, c.env));
api.get('/me', c => handleMe(c.req.raw, c.env));
api.post('/logout', c => handleLogout(c.req.raw));
api.get('/files', c => getFileHistory(c.req.raw, c.env));
api.post('/delete', c => handleDelete(c.req.raw, c.env));
api.post('/file/update', c => handleFileUpdate(c.req.raw, c.env));
api.post('/lists/create', c => handleListCreate(c.req.raw, c.env));
api.get('/lists', c => getLists(c.req.raw, c.env));
api.post('/lists/update', c => handleListUpdate(c.req.raw, c.env));
api.post('/lists/delete', c => handleListDelete(c.req.raw, c.env));
// Add more user routes as needed

// --- Public Short/Link Routes ---
app.get('/s/:shortcode', async c => {
    if (c.req.method === 'GET') return handleShortUrlGet(c.req.raw, c.env);
    if (c.req.method === 'POST') return handleShortUrlPost(c.req.raw, c.env);
});
app.get('/l/:shortcode', async c => {
    if (c.req.method === 'GET') return handlePublicListGet(c.req.raw, c.env);
    if (c.req.method === 'POST') return handlePublicListPost(c.req.raw, c.env);
});

// --- Mount API Routers ---
app.route('/api/admin', adminApi);
app.route('/api', api);

// --- Static Asset Serving and SPA Fallback ---
app.get('/assets/*', serveStatic({ root: './public' }));
app.get('/manifest.json', serveStatic({ root: './public' }));
app.get('/sw.js', serveStatic({ root: './public' }));
app.get('/favicon.ico', serveStatic({ root: './public' }));
app.get('/robots.txt', serveStatic({ root: './public' }));
app.get('*', serveStatic({ path: './public/index.html' }));

export const onRequest = app.fetch;
