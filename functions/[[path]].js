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

// --- API Routes ---
const api = new Hono();

// Public Auth Routes
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
    const url = new URL(c.req.url);
    const code = url.searchParams.get('code');
    if (!code) return c.json({ error: 'Authorization code not found.' }, 400);

    try {
        const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                client_id: c.env.GOOGLE_CLIENT_ID,
                client_secret: c.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: `${url.origin}/api/auth/google/callback`,
                grant_type: 'authorization_code',
            }),
        });
        const tokens = await tokenResponse.json();
        if (tokens.error) throw new Error(`Google token error: ${tokens.error_description || 'Bad Request'}`);

        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        const profile = await profileResponse.json();
        const { id: userId, name, email, picture } = profile;

        await c.env.APP_KV.put(`user:${userId}`, JSON.stringify({
            name, email, picture,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in,
            iat: Math.floor(Date.now() / 1000)
        }));

        const token = await new jose.SignJWT({ userId, name, picture, email })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('24h')
            .sign(await getJwtSecret(c));

        const headers = new Headers();
        headers.set('Location', '/dashboard');
        headers.set('Set-Cookie', createCookieHeader('auth_token', token));
        return new Response(null, { status: 302, headers });

    } catch (err) {
        console.error('Callback error:', err.message);
        return c.json({ error: 'An error occurred during authentication.' }, 500);
    }
});

// Authenticated User Routes
api.use('/me', authMiddleware);
api.get('/me', (c) => c.json({ loggedIn: true, ...c.get('user') }));

api.use('/files', authMiddleware);
api.get('/files', async (c) => {
    const user = c.get('user');
    const history = await c.env.APP_KV.get(`history:upload:${user.userId}`, { type: 'json' }) || [];
    return c.json(history.reverse());
});

// ... (All other user-specific API routes like upload, delete, update, lists, etc. go here)


// --- Admin API Routes ---
const adminApi = new Hono();
adminApi.use('*', authMiddleware, adminMiddleware);

adminApi.get('/stats', async (c) => {
    const userKeys = await c.env.APP_KV.list({ prefix: "user:" });
    const fileKeys = await c.env.APP_KV.list({ prefix: "shorturl:" });
    const listKeys = await c.env.APP_KV.list({ prefix: "list:" });
    return c.json({
        totalUsers: userKeys.keys.length,
        totalFiles: fileKeys.keys.length,
        totalLists: listKeys.keys.length,
    });
});

adminApi.get('/users', async (c) => {
    const { keys } = await c.env.APP_KV.list({ prefix: "user:" });
    const users = await Promise.all(keys.map(async key => {
        const userData = await c.env.APP_KV.get(key.name, { type: 'json' });
        const fileHistory = await c.env.APP_KV.get(`history:upload:${key.name.split(':')[1]}`, { type: 'json' }) || [];
        return { userId: key.name.split(':')[1], ...userData, fileCount: fileHistory.length };
    }));
    return c.json(users);
});

// ... (All other admin routes like revoke, delete-file, etc. go here)


// --- Main Hono App ---
app.route('/api', api);
app.route('/api/admin', adminApi);

// Public download and list routes
app.get('/s/:shortcode', async (c) => {
    // ... (handleShortUrlGet logic)
    return c.text(`Serving file ${c.req.param('shortcode')}`);
});

app.get('/l/:shortcode', async (c) => {
    // ... (handlePublicListGet logic)
    return c.text(`Serving list ${c.req.param('shortcode')}`);
});

// Serve static assets from the root, letting the React app handle routing
app.get('*', serveStatic({ root: './' }));

export const onRequest = app;
