/**
 * =================================================================================
 * Cloudflare Pages Function: Top-Level Middleware
 * File Path: /functions/_middleware.js
 * =================================================================================
 *
 * This single file acts as the main router for the entire application.
 * It handles API requests, short URL redirects, and serves the frontend.
 *
 */

// --- Import JWT Library ---
import jwt from '@tsndr/cloudflare-worker-jwt';


// --- Constants ---
const FOLDER_NAME = "Decentralized File Share";
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

/**
 * Main request handler. This function is the entry point for all requests.
 */
export const onRequest = async (context) => {
    const { request, env, next } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    // Route API requests
    if (path.startsWith('/api/')) {
        return handleApiRequest(request, env);
    }

    // Route short URL redirects
    if (path.startsWith('/s/')) {
        return handleShortUrl(request, env);
    }

    // For all other requests, pass through to the static asset handler (serves the frontend)
    return next();
}

/**
 * Handles all requests prefixed with /api/
 */
async function handleApiRequest(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API router logic
    switch (path) {
        case '/api/auth/google/login':
            if (request.method === 'GET') return handleLogin(request, env);
            break;
        case '/api/auth/google/callback':
            if (request.method === 'GET') return handleCallback(request, env);
            break;
        case '/api/upload':
            if (request.method === 'POST') return handleUpload(request, env);
            break;
        case '/api/me':
            if (request.method === 'GET') return handleMe(request, env);
            break;
        case '/api/logout':
            if (request.method === 'POST') return handleLogout(request);
            break;
    }

    return new Response('API route not found or method not allowed', { status: 404 });
}

// --- JWT & Cookie Helpers ---
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

// --- Auth Helper ---
async function getAuthenticatedUserId(request, env) {
    const token = getCookie(request, 'auth_token');
    if (!token) {
        throw new Response(JSON.stringify({ error: 'Unauthorized. Please log in.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    try {
        const isValid = await jwt.verify(token, env.JWT_SECRET);
        if (!isValid) throw new Error('Invalid token signature.');
        const { payload } = jwt.decode(token);
        if (!payload || !payload.userId) throw new Error('Invalid token payload.');
        if (payload.exp && Date.now() / 1000 > payload.exp) throw new Error('Token expired.');
        return payload.userId;
    } catch (err) {
        const response = new Response(JSON.stringify({ error: 'Invalid or expired token. Please log in again.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        response.headers.set('Set-Cookie', createCookieHeader('auth_token', '', { maxAge: -1 }));
        throw response;
    }
}

// --- Route Handlers ---
function handleLogin(request, env) {
    const url = new URL(request.url);
    const authUrl = new URL(GOOGLE_AUTH_URL);
    authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', `${url.origin}/api/auth/google/callback`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    return Response.redirect(authUrl.toString(), 302);
}

async function handleCallback(request, env) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    if (!code) return new Response('Authorization code not found.', { status: 400 });

    try {
        const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                client_id: env.GOOGLE_CLIENT_ID,
                client_secret: env.GOOGLE_CLIENT_SECRET,
                redirect_uri: `${url.origin}/api/auth/google/callback`,
                grant_type: 'authorization_code',
            }),
        });
        const tokens = await tokenResponse.json();
        if (tokens.error) throw new Error(`Google token error: ${tokens.error_description}`);

        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        const profile = await profileResponse.json();
        const userId = profile.id;
        const userName = profile.name;

        await env.TOKEN_STORE.put(`user:${userId}`, JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in,
            iat: Math.floor(Date.now() / 1000)
        }));

        const loginHistoryKey = `history:login:${userId}`;
        const existingHistory = await env.FILE_METADATA.get(loginHistoryKey, { type: 'json' }) || [];
        existingHistory.push({ timestamp: new Date().toISOString(), ip: request.headers.get('CF-Connecting-IP') });
        await env.FILE_METADATA.put(loginHistoryKey, JSON.stringify(existingHistory));

        const token = await jwt.sign({
            userId,
            userName,
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24),
        }, env.JWT_SECRET);

        const response = Response.redirect(url.origin, 302);
        response.headers.set('Set-Cookie', createCookieHeader('auth_token', token));
        return response;
    } catch (err) {
        console.error('Callback error:', err);
        return new Response('An error occurred during authentication.', { status: 500 });
    }
}

async function handleUpload(request, env) {
    try {
        const userId = await getAuthenticatedUserId(request, env);
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) return new Response(JSON.stringify({ error: 'No file uploaded' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

        const tokenData = await env.TOKEN_STORE.get(`user:${userId}`, { type: 'json' });
        if (!tokenData) return new Response(JSON.stringify({ error: 'User token not found.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

        const accessToken = await getValidAccessToken(tokenData, userId, env);
        const folderId = await findOrCreateFolder(accessToken, env);

        const date = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
        const newFileName = `${file.name}_${date}`;

        const metadataRes = await fetch(`${GOOGLE_UPLOAD_API}/files?uploadType=resumable`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newFileName, parents: [folderId] })
        });
        if (!metadataRes.ok) throw new Error('Failed to initiate Google Drive upload.');
        const locationUrl = metadataRes.headers.get('Location');

        const uploadRes = await fetch(locationUrl, {
            method: 'PUT',
            headers: { 'Content-Length': file.size, 'Content-Type': file.type },
            body: file.stream(),
        });
        const uploadedFile = await uploadRes.json();
        if (uploadedFile.error) throw new Error(`Google API Error: ${uploadedFile.error.message}`);

        await fetch(`${GOOGLE_DRIVE_API}/files/${uploadedFile.id}/permissions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'reader', type: 'anyone' }),
        });

        const shortCode = Math.random().toString(36).substring(2, 8);
        const shortUrl = `${new URL(request.url).origin}/s/${shortCode}`;

        await env.FILE_METADATA.put(`shorturl:${shortCode}`, uploadedFile.id, { expirationTtl: 60 * 60 * 24 * 30 });

        const fileMeta = {
            fileId: uploadedFile.id, fileName: newFileName, originalName: file.name,
            uploadTimestamp: new Date().toISOString(), shortUrl, owner: userId,
        };
        const historyKey = `history:upload:${userId}`;
        const existingHistory = await env.FILE_METADATA.get(historyKey, { type: 'json' }) || [];
        existingHistory.push(fileMeta);
        await env.FILE_METADATA.put(historyKey, JSON.stringify(existingHistory));

        return new Response(JSON.stringify({ shortUrl }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        if (err instanceof Response) return err;
        console.error('Upload error:', err.message);
        return new Response(JSON.stringify({ error: 'Failed to upload file.', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

async function handleShortUrl(request, env) {
    const url = new URL(request.url);
    const shortCode = url.pathname.split('/s/')[1];
    if (shortCode) {
        const fileId = await env.FILE_METADATA.get(`shorturl:${shortCode}`);
        if (fileId) {
            const googleDriveUrl = `https://drive.google.com/file/d/${fileId}/view`;
            return Response.redirect(googleDriveUrl, 302);
        }
    }
    return new Response('URL not found or expired', { status: 404 });
}

async function handleMe(request, env) {
    const token = getCookie(request, 'auth_token');
    if (!token) {
        return new Response(JSON.stringify({ loggedIn: false }), { headers: { 'Content-Type': 'application/json' } });
    }
    try {
        const isValid = await jwt.verify(token, env.JWT_SECRET);
        if (!isValid) throw new Error('Invalid signature');
        const { payload } = jwt.decode(token);
        if (payload.exp && Date.now() / 1000 > payload.exp) throw new Error('Token expired');

        return new Response(JSON.stringify({
            loggedIn: true,
            userId: payload.userId,
            userName: payload.userName,
        }), { headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
        const response = new Response(JSON.stringify({ loggedIn: false }), { headers: { 'Content-Type': 'application/json' } });
        response.headers.set('Set-Cookie', createCookieHeader('auth_token', '', { maxAge: -1 }));
        return response;
    }
}

function handleLogout(request) {
    const response = new Response(JSON.stringify({ success: true, message: 'Logged out successfully.' }), { headers: { 'Content-Type': 'application/json' } });
    response.headers.set('Set-Cookie', createCookieHeader('auth_token', '', { maxAge: -1 }));
    return response;
}


// --- Helper Functions ---
async function getValidAccessToken(tokenData, userId, env) {
    const { access_token, refresh_token, iat, expires_in } = tokenData;
    if (Date.now() / 1000 - iat < expires_in - 300) {
        return access_token;
    }
    const refreshResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            refresh_token,
            grant_type: 'refresh_token',
        }),
    });
    const newTokens = await refreshResponse.json();
    if (newTokens.error) throw new Error('Failed to refresh Google token.');
    await env.TOKEN_STORE.put(`user:${userId}`, JSON.stringify({
        ...tokenData,
        access_token: newTokens.access_token,
        expires_in: newTokens.expires_in,
        iat: Math.floor(Date.now() / 1000),
    }));
    return newTokens.access_token;
}

async function findOrCreateFolder(accessToken, env) {
    const query = `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`;
    const searchResponse = await fetch(`${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const searchResult = await searchResponse.json();
    if (searchResult.files && searchResult.files.length > 0) {
        return searchResult.files[0].id;
    }
    const createResponse = await fetch(`${GOOGLE_DRIVE_API}/files`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });
    const newFolder = await createResponse.json();
    return newFolder.id;
}
