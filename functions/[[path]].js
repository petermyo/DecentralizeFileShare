/**
 * =================================================================================
 * Cloudflare Pages Function: Unified Top-Level Middleware
 * CORRECT FILE PATH: /functions/_middleware.js
 * =================================================================================
 *
 * This single, unified file handles all backend routing for the entire application,
 * including the main API, admin API, and public link redirects. This simplifies
 * the project structure and resolves routing issues.
 *
 */

// --- Import JWT Library ---
import * as jose from 'jose';

// --- Constants ---
const FOLDER_NAME = "Decentralized File Share";
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const ADMIN_USER_IDS = ['118136495390756743317', '108180268584101876155'];


/**
 * Main request handler. This function is the entry point for all requests.
 */
export const onRequest = async (context) => {
    const { request, env, next } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    // --- Main Router ---
    if (path.startsWith('/api/admin/')) {
        return handleAdminApiRequest(request, env);
    }
    if (path.startsWith('/api/')) {
        return handleApiRequest(request, env);
    }
    if (path.startsWith('/s/')) {
        if (request.method === 'GET') return handleShortUrlGet(request, env);
        if (request.method === 'POST') return handleShortUrlPost(request, env);
    }
    if (path.startsWith('/l/')) {
        if (request.method === 'GET') return handlePublicListGet(request, env);
        if (request.method === 'POST') return handlePublicListPost(request, env);
    }
    
    // For all other requests (e.g., /, /admin), let Pages serve the static HTML file.
    return next();
}

/**
 * Handles all non-admin requests prefixed with /api/
 */
async function handleApiRequest(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API router logic
    switch (path) {
        case '/api/auth/google/login':
            return handleLogin(request, env);
        case '/api/auth/google/callback':
            return handleCallback(request, env);
        case '/api/upload/initiate':
            return handleUploadInitiate(request, env);
        case '/api/upload/finalize':
            return handleUploadFinalize(request, env);
        case '/api/me':
            return handleMe(request, env);
        case '/api/logout':
            return handleLogout(request);
        case '/api/files':
             return getFileHistory(request, env);
        case '/api/delete':
            return handleDelete(request, env);
        case '/api/file/update':
            return handleFileUpdate(request, env);
        case '/api/lists/create':
            return handleListCreate(request, env);
        case '/api/lists':
            return getLists(request, env);
        case '/api/lists/update':
            return handleListUpdate(request, env);
        case '/api/lists/delete':
            return handleListDelete(request, env);
    }

    return new Response('API route not found or method not allowed', { status: 404 });
}

/**
 * Handles all requests prefixed with /api/admin/
 */
async function handleAdminApiRequest(request, env) {
    // First, run the authorization middleware
    const authResponse = await isAdmin(request, env);
    if (authResponse.status !== 200) {
        return authResponse;
    }

    const url = new URL(request.url);
    const path = url.pathname;
    
    // Admin API router logic
    switch (path) {
        case '/api/admin/stats':
            return getStats(env);
        case '/api/admin/users':
            return getUsers(env);
        case '/api/admin/revoke':
            return revokeUserAccess(request, env);
        case '/api/admin/files':
            return getAllFiles(env);
        case '/api/admin/lists':
            return getAllLists(env);
        case '/api/admin/delete-file':
            return deleteFileAsAdmin(request, env);
        case '/api/admin/delete-list':
            return deleteListAsAdmin(request, env);
        case '/api/admin/user-files':
            return getUserFiles(request, env);
        case '/api/admin/user-lists':
            return getUserLists(request, env);
    }
    
    return new Response('Admin API route not found', { status: 404 });
}


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
        if (tokens.error) throw new Error(`Google token error: ${tokens.error_description || 'Bad Request'}`);

        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        const profile = await profileResponse.json();
        const userId = profile.id;
        const userName = profile.name || profile.email;
        const picture = profile.picture;

        await env.APP_KV.put(`user:${userId}`, JSON.stringify({
            name: userName,
            email: profile.email,
            picture: picture,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in,
            iat: Math.floor(Date.now() / 1000)
        }));

        const loginHistoryKey = `history:login:${userId}`;
        const existingHistory = await env.APP_KV.get(loginHistoryKey, { type: 'json' }) || [];
        existingHistory.push({ timestamp: new Date().toISOString(), ip: request.headers.get('CF-Connecting-IP') });
        await env.APP_KV.put(loginHistoryKey, JSON.stringify(existingHistory));

        if (!env.JWT_SECRET) {
             console.error('FATAL: JWT_SECRET environment variable is not set.');
             throw new Error('Server configuration error: JWT secret is missing.');
        }

        const token = await new jose.SignJWT({ userId, userName, picture })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('24h')
            .sign(await getJwtSecret(env));

        const headers = new Headers();
        headers.set('Location', '/dashboard');
        headers.set('Set-Cookie', createCookieHeader('auth_token', token));
        return new Response(null, { status: 302, headers });

    } catch (err) {
        console.error('Callback error:', err.message);
        return new Response('An error occurred during authentication.', { status: 500 });
    }
}

async function handleUploadInitiate(request, env) {
    try {
        const userId = await getAuthenticatedUserId(request, env);
        const { files } = await request.json();

        if (!files || !Array.isArray(files) || files.length === 0) {
            return new Response(JSON.stringify({ error: 'Missing files array.' }), { status: 400 });
        }

        const tokenData = await env.APP_KV.get(`user:${userId}`, { type: 'json' });
        if (!tokenData) return new Response(JSON.stringify({ error: 'User token not found.' }), { status: 401 });

        const accessToken = await getValidAccessToken(tokenData, userId, env);
        const folderId = await findOrCreateFolder(accessToken, env);
        
        const requestOrigin = new URL(request.url).origin;

        const uploadSessions = await Promise.all(files.map(async (file) => {
            const now = new Date();
            const date = now.toLocaleDateString('en-GB').replace(/\//g, '-');
            const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
            const newFileName = `${time}_${date}_${file.fileName}`;

            const metadata = { name: newFileName, parents: [folderId], mimeType: file.fileType };

            const metadataRes = await fetch(`${GOOGLE_UPLOAD_API}/files?uploadType=resumable`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json; charset=UTF-8',
                    'Origin': requestOrigin
                },
                body: JSON.stringify(metadata)
            });

            if (!metadataRes.ok) {
                console.error(`Failed to initiate for ${file.fileName}`);
                return null;
            }
            
            return {
                originalName: file.fileName,
                newFileName: newFileName,
                uploadUrl: metadataRes.headers.get('Location')
            };
        }));

        const validSessions = uploadSessions.filter(Boolean);
        return new Response(JSON.stringify({ sessions: validSessions }), { status: 200 });

    } catch (err) {
        if (err instanceof Response) return err;
        console.error('Upload initiate error:', err.message);
        return new Response(JSON.stringify({ error: 'Failed to initiate upload.' }), { status: 500 });
    }
}

async function handleUploadFinalize(request, env) {
    try {
        const userId = await getAuthenticatedUserId(request, env);
        const { fileId, fileName, originalName, passcode, expireDate, fileSize } = await request.json();

        if (!fileId || !fileName || !originalName) {
            return new Response(JSON.stringify({ error: 'Missing required file data for finalization.' }), { status: 400 });
        }
        
        const shortCode = Math.random().toString(36).substring(2, 8);
        const shortUrl = `${new URL(request.url).origin}/s/${shortCode}`;

        await env.APP_KV.put(`shorturl:${shortCode}`, JSON.stringify({
            id: fileId,
            name: fileName,
            ownerId: userId,
            passcode: passcode || null,
            expireDate: expireDate || null
        }), { expirationTtl: 60 * 60 * 24 * 30 });

        const fileMeta = {
            fileId, fileName, originalName, fileSize,
            uploadTimestamp: new Date().toISOString(), shortUrl, owner: userId,
            hasPasscode: !!passcode,
            passcode: passcode || null,
            expireDate: expireDate || null
        };
        const historyKey = `history:upload:${userId}`;
        const existingHistory = await env.APP_KV.get(historyKey, { type: 'json' }) || [];
        existingHistory.push(fileMeta);
        await env.APP_KV.put(historyKey, JSON.stringify(existingHistory));

        return new Response(JSON.stringify({ shortUrl, fileMeta }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        if (err instanceof Response) return err;
        console.error('Upload finalize error:', err.message);
        return new Response(JSON.stringify({ error: 'Failed to finalize upload.' }), { status: 500 });
    }
}


async function handleShortUrlGet(request, env) {
    const url = new URL(request.url);
    const shortCode = url.pathname.split('/s/')[1];
    if (!shortCode) return new Response('Invalid URL', { status: 400 });

    const fileData = await env.APP_KV.get(`shorturl:${shortCode}`, { type: 'json' });
    if (!fileData) return new Response('URL not found or expired', { status: 404 });

    if (fileData.expireDate && new Date(fileData.expireDate) < new Date()) {
        return new Response('This link has expired.', { status: 403 });
    }

    if (fileData.passcode) {
        return new Response(getPasscodePage(shortCode, fileData.name), { headers: { 'Content-Type': 'text/html' } });
    }

    return streamFile(fileData, env);
}

async function handleShortUrlPost(request, env) {
    const url = new URL(request.url);
    const shortCode = url.pathname.split('/s/')[1];
    if (!shortCode) return new Response('Invalid URL', { status: 400 });

    const fileData = await env.APP_KV.get(`shorturl:${shortCode}`, { type: 'json' });
    if (!fileData) return new Response('URL not found or expired', { status: 404 });

    const formData = await request.formData();
    const submittedPasscode = formData.get('passcode');

    if (fileData.passcode && submittedPasscode === fileData.passcode) {
        return streamFile(fileData, env);
    } else {
        return new Response(getPasscodePage(shortCode, fileData.name, true), { status: 401, headers: { 'Content-Type': 'text/html' } });
    }
}

async function handleMe(request, env) {
    const token = getCookie(request, 'auth_token');
    if (!token) {
        return new Response(JSON.stringify({ loggedIn: false }), { headers: { 'Content-Type': 'application/json' } });
    }
    try {
        const { payload } = await jose.jwtVerify(token, await getJwtSecret(env));
        return new Response(JSON.stringify({
            loggedIn: true,
            userId: payload.userId,
            userName: payload.userName,
            picture: payload.picture
        }), { headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
        const headers = new Headers({ 'Content-Type': 'application/json' });
        headers.set('Set-Cookie', createCookieHeader('auth_token', '', { maxAge: -1 }));
        const responseBody = JSON.stringify({ loggedIn: false });
        return new Response(responseBody, { headers });
    }
}

function handleLogout(request) {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.set('Set-Cookie', createCookieHeader('auth_token', '', { maxAge: -1 }));
    const responseBody = JSON.stringify({ success: true, message: 'Logged out successfully.' });
    return new Response(responseBody, { headers });
}

async function getFileHistory(request, env) {
    try {
        const userId = await getAuthenticatedUserId(request, env);
        const historyKey = `history:upload:${userId}`;
        const fileHistory = await env.APP_KV.get(historyKey, { type: 'json' }) || [];
        return new Response(JSON.stringify(fileHistory.reverse()), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        if (err instanceof Response) return err;
        return new Response(JSON.stringify({ error: "Could not fetch file history." }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

async function handleDelete(request, env) {
    try {
        const userId = await getAuthenticatedUserId(request, env);
        const { fileId, shortUrl } = await request.json();

        if (!fileId || !shortUrl) {
            return new Response(JSON.stringify({ error: "Missing fileId or shortUrl" }), { status: 400 });
        }

        const tokenData = await env.APP_KV.get(`user:${userId}`, { type: 'json' });
        if (!tokenData) return new Response(JSON.stringify({ error: 'User token not found.' }), { status: 401 });
        const accessToken = await getValidAccessToken(tokenData, userId, env);

        const deleteResponse = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!deleteResponse.ok && deleteResponse.status !== 404) {
            throw new Error('Failed to delete file from Google Drive.');
        }

        const shortCode = shortUrl.split('/s/')[1];
        await env.APP_KV.delete(`shorturl:${shortCode}`);

        const historyKey = `history:upload:${userId}`;
        const fileHistory = await env.APP_KV.get(historyKey, { type: 'json' }) || [];
        const updatedHistory = fileHistory.filter(file => file.fileId !== fileId);
        await env.APP_KV.put(historyKey, JSON.stringify(updatedHistory));

        return new Response(JSON.stringify({ success: true, message: 'File deleted successfully.' }), { status: 200 });

    } catch (err) {
        if (err instanceof Response) return err;
        console.error('Delete error:', err.message);
        return new Response(JSON.stringify({ error: 'Failed to delete file.', details: err.message }), { status: 500 });
    }
}

async function handleFileUpdate(request, env) {
     try {
        const userId = await getAuthenticatedUserId(request, env);
        const { shortUrl, passcode, expireDate } = await request.json();
        const shortCode = shortUrl.split('/s/')[1];

        const fileData = await env.APP_KV.get(`shorturl:${shortCode}`, { type: 'json' });
        if (!fileData || fileData.ownerId !== userId) {
            return new Response(JSON.stringify({ error: "File not found or permission denied." }), { status: 404 });
        }
        
        fileData.passcode = passcode || null;
        fileData.expireDate = expireDate || null;
        
        await env.APP_KV.put(`shorturl:${shortCode}`, JSON.stringify(fileData));
        
        const historyKey = `history:upload:${userId}`;
        const fileHistory = await env.APP_KV.get(historyKey, { type: 'json' }) || [];
        const updatedHistory = fileHistory.map(file => {
            if (file.shortUrl === shortUrl) {
                return { ...file, hasPasscode: !!passcode, passcode: passcode || null, expireDate: expireDate };
            }
            return file;
        });
        await env.APP_KV.put(historyKey, JSON.stringify(updatedHistory));

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch(err) {
        if (err instanceof Response) return err;
        return new Response(JSON.stringify({ error: 'Failed to update file.' }), { status: 500 });
    }
}

async function handleListCreate(request, env) {
    try {
        const userId = await getAuthenticatedUserId(request, env);
        const { fileIds, passcode, expireDate } = await request.json();

        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            return new Response(JSON.stringify({ error: "No files selected for the list." }), { status: 400 });
        }

        const historyKey = `history:upload:${userId}`;
        const fileHistory = await env.APP_KV.get(historyKey, { type: 'json' }) || [];
        
        const listFiles = fileHistory.filter(file => fileIds.includes(file.fileId));
        if (listFiles.length !== fileIds.length) {
            return new Response(JSON.stringify({ error: "Some selected files were not found or you do not have permission." }), { status: 403 });
        }

        const listShortCode = Math.random().toString(36).substring(2, 8);
        const listShortUrl = `${new URL(request.url).origin}/l/${listShortCode}`;

        const listData = {
            files: listFiles,
            ownerId: userId,
            passcode: passcode || null,
            expireDate: expireDate || null,
        };
        await env.APP_KV.put(`list:${listShortCode}`, JSON.stringify(listData), { expirationTtl: 60 * 60 * 24 * 90 }); // 90-day expiry

        const listHistoryKey = `history:list:${userId}`;
        const existingListHistory = await env.APP_KV.get(listHistoryKey, { type: 'json' }) || [];
        existingListHistory.push({
            shortUrl: listShortUrl,
            fileCount: listFiles.length,
            createdAt: new Date().toISOString(),
            passcode: passcode || null,
            expireDate: expireDate || null
        });
        await env.APP_KV.put(listHistoryKey, JSON.stringify(existingListHistory));
        
        return new Response(JSON.stringify({ success: true, shortUrl: listShortUrl }), { status: 200 });
    } catch(err) {
         if (err instanceof Response) return err;
        return new Response(JSON.stringify({ error: 'Failed to create list.' }), { status: 500 });
    }
}

async function getLists(request, env) {
     try {
        const userId = await getAuthenticatedUserId(request, env);
        const historyKey = `history:list:${userId}`;
        const listHistory = await env.APP_KV.get(historyKey, { type: 'json' }) || [];
        return new Response(JSON.stringify(listHistory.reverse()), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        if (err instanceof Response) return err;
        return new Response(JSON.stringify({ error: "Could not fetch list history." }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

async function handlePublicListGet(request, env) {
    const url = new URL(request.url);
    const listShortCode = url.pathname.split('/l/')[1];
    if (!listShortCode) return new Response('Invalid List URL', { status: 400 });

    const listData = await env.APP_KV.get(`list:${listShortCode}`, { type: 'json' });
    if (!listData) return new Response('List not found or expired', { status: 404 });

    if (listData.expireDate && new Date(listData.expireDate) < new Date()) {
        return new Response('This list has expired.', { status: 403 });
    }
    
    if (listData.passcode) {
        return new Response(getPasscodePage(listShortCode, `${listData.files.length} files`, false, true), { headers: { 'Content-Type': 'text/html' } });
    }

    const filesInList = listData.files || [];
    return new Response(getPublicListPage(filesInList), { headers: { 'Content-Type': 'text/html' } });
}

async function handlePublicListPost(request, env) {
    const url = new URL(request.url);
    const listShortCode = url.pathname.split('/l/')[1];
    if (!listShortCode) return new Response('Invalid URL', { status: 400 });

    const listData = await env.APP_KV.get(`list:${listShortCode}`, { type: 'json' });
    if (!listData) return new Response('List not found or expired', { status: 404 });

    const formData = await request.formData();
    const submittedPasscode = formData.get('passcode');

    if (listData.passcode && submittedPasscode === listData.passcode) {
        const filesInList = listData.files || [];
        return new Response(getPublicListPage(filesInList), { headers: { 'Content-Type': 'text/html' } });
    } else {
        return new Response(getPasscodePage(listShortCode, `${listData.files.length} files`, true, true), { status: 401, headers: { 'Content-Type': 'text/html' } });
    }
}


async function handleListDelete(request, env) {
    try {
        const userId = await getAuthenticatedUserId(request, env);
        const { shortUrl } = await request.json();
        if (!shortUrl) return new Response(JSON.stringify({ error: "Missing shortUrl" }), { status: 400 });

        const shortCode = shortUrl.split('/l/')[1];
        await env.APP_KV.delete(`list:${shortCode}`);

        const historyKey = `history:list:${userId}`;
        const listHistory = await env.APP_KV.get(historyKey, { type: 'json' }) || [];
        const updatedHistory = listHistory.filter(list => list.shortUrl !== shortUrl);
        await env.APP_KV.put(historyKey, JSON.stringify(updatedHistory));

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (err) {
        if (err instanceof Response) return err;
        return new Response(JSON.stringify({ error: 'Failed to delete list.' }), { status: 500 });
    }
}

async function handleListUpdate(request, env) {
    try {
        const userId = await getAuthenticatedUserId(request, env);
        const { shortUrl, passcode, expireDate } = await request.json();
        const shortCode = shortUrl.split('/l/')[1];

        const listData = await env.APP_KV.get(`list:${shortCode}`, { type: 'json' });
        if (!listData || listData.ownerId !== userId) {
            return new Response(JSON.stringify({ error: "List not found or permission denied." }), { status: 404 });
        }

        listData.passcode = passcode || null;
        listData.expireDate = expireDate || null;
        await env.APP_KV.put(`list:${shortCode}`, JSON.stringify(listData));

        const historyKey = `history:list:${userId}`;
        const listHistory = await env.APP_KV.get(historyKey, { type: 'json' }) || [];
        const updatedHistory = listHistory.map(list => {
            if (list.shortUrl === shortUrl) {
                return { ...list, passcode: passcode || null, expireDate: expireDate || null };
            }
            return list;
        });
        await env.APP_KV.put(historyKey, JSON.stringify(updatedHistory));
        
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (err) {
        if (err instanceof Response) return err;
        return new Response(JSON.stringify({ error: 'Failed to update list.' }), { status: 500 });
    }
}


// --- Admin API Handlers ---
async function getStats(env) {
    const userKeys = await env.APP_KV.list({ prefix: "user:" });
    const fileKeys = await env.APP_KV.list({ prefix: "shorturl:" });
    const listKeys = await env.APP_KV.list({ prefix: "list:" });

    return new Response(JSON.stringify({
        totalUsers: userKeys.keys.length,
        totalFiles: fileKeys.keys.length,
        totalLists: listKeys.keys.length,
    }), { headers: { 'Content-Type': 'application/json' } });
}

async function getUsers(env) {
    const { keys } = await env.APP_KV.list({ prefix: "user:" });
    const users = await Promise.all(keys.map(async key => {
        const userData = await env.APP_KV.get(key.name, { type: 'json' });
        const fileHistory = await env.APP_KV.get(`history:upload:${key.name.split(':')[1]}`, { type: 'json' }) || [];
        return { userId: key.name.split(':')[1], ...userData, fileCount: fileHistory.length };
    }));
    return new Response(JSON.stringify(users), { headers: { 'Content-Type': 'application/json' } });
}

async function revokeUserAccess(request, env) {
    try {
        const { userId } = await request.json();
        if (!userId) {
            return new Response(JSON.stringify({ error: 'User ID is required.' }), { status: 400 });
        }

        await env.APP_KV.delete(`user:${userId}`);
        await env.APP_KV.delete(`history:login:${userId}`);
        await env.APP_KV.delete(`history:upload:${userId}`);
        await env.APP_KV.delete(`history:list:${userId}`);
        
        return new Response(JSON.stringify({ success: true, message: `Access and all records revoked for user ${userId}` }), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to revoke access.' }), { status: 500 });
    }
}

async function getAllFiles(env) {
    const { keys } = await env.APP_KV.list({ prefix: "shorturl:" });
    const files = await Promise.all(keys.map(key => env.APP_KV.get(key.name, { type: 'json' })));
    return new Response(JSON.stringify(files), { headers: { 'Content-Type': 'application/json' } });
}

async function getAllLists(env) {
    const { keys } = await env.APP_KV.list({ prefix: "list:" });
    const lists = await Promise.all(keys.map(async (key) => {
        const listData = await env.APP_KV.get(key.name, { type: 'json' });
        return {
            shortCode: key.name.split(':')[1],
            ...listData
        };
    }));
    return new Response(JSON.stringify(lists), { headers: { 'Content-Type': 'application/json' } });
}

async function deleteFileAsAdmin(request, env) {
     try {
        const { fileId, shortCode, ownerId } = await request.json();
        if (!fileId || !shortCode || !ownerId) {
            return new Response(JSON.stringify({ error: "Missing required data" }), { status: 400 });
        }

        const tokenData = await env.APP_KV.get(`user:${ownerId}`, { type: 'json' });
        if (tokenData) {
            const accessToken = await getValidAccessToken(tokenData, ownerId, env);
            await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
        }

        await env.APP_KV.delete(`shorturl:${shortCode}`);
        
        const historyKey = `history:upload:${ownerId}`;
        const fileHistory = await env.APP_KV.get(historyKey, { type: 'json' }) || [];
        const updatedHistory = fileHistory.filter(file => file.fileId !== fileId);
        await env.APP_KV.put(historyKey, JSON.stringify(updatedHistory));

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to delete file.' }), { status: 500 });
    }
}

async function deleteListAsAdmin(request, env) {
    try {
        const { shortCode, ownerId } = await request.json();
        if (!shortCode || !ownerId) {
            return new Response(JSON.stringify({ error: "Missing required data" }), { status: 400 });
        }
        
        await env.APP_KV.delete(`list:${shortCode}`);

        const historyKey = `history:list:${ownerId}`;
        const listHistory = await env.APP_KV.get(historyKey, { type: 'json' }) || [];
        const shortUrl = `${new URL(request.url).origin}/l/${shortCode}`;
        const updatedHistory = listHistory.filter(list => list.shortUrl !== shortUrl);
        await env.APP_KV.put(historyKey, JSON.stringify(updatedHistory));

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to delete list.' }), { status: 500 });
    }
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
    await env.APP_KV.put(`user:${userId}`, JSON.stringify({
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

async function streamFile(fileData, env) {
    try {
        const ownerTokenData = await env.APP_KV.get(`user:${fileData.ownerId}`, { type: 'json' });
        if (!ownerTokenData) throw new Error("File owner's token not found.");

        const accessToken = await getValidAccessToken(ownerTokenData, fileData.ownerId, env);
        
        const driveResponse = await fetch(`${GOOGLE_DRIVE_API}/files/${fileData.id}?alt=media`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!driveResponse.ok) {
            return new Response('Could not fetch file from Google Drive. It may have been deleted or permissions changed.', { status: driveResponse.status });
        }

        const headers = new Headers();
        headers.set('Content-Type', 'application/octet-stream');
        headers.set('Content-Disposition', `attachment; filename="${fileData.name}"`);
        headers.set('Content-Length', driveResponse.headers.get('Content-Length'));

        return new Response(driveResponse.body, { headers });
    } catch (err) {
        console.error("Proxy download error:", err.message);
        return new Response('Error proxying the file.', { status: 500 });
    }
}

function getPasscodePage(shortCode, fileName, hasError = false, isList = false) {
    const actionUrl = isList ? `/l/${shortCode}` : `/s/${shortCode}`;
    const errorMessage = hasError ? `<p class="text-red-500 text-sm mb-4">Incorrect passcode. Please try again.</p>` : '';
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Enter Passcode</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-100 flex items-center justify-center min-h-screen">
            <div class="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-center text-gray-800">Passcode Required</h2>
                <p class="text-center text-gray-600">This content is protected. Please enter the passcode to continue:</p>
                <p class="text-center text-gray-800 font-semibold break-all">${fileName}</p>
                <form method="POST" action="${actionUrl}">
                    ${errorMessage}
                    <input type="password" name="passcode" placeholder="Enter passcode" required
                           class="w-full px-4 py-2 mb-4 text-gray-700 bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <button type="submit"
                            class="w-full px-4 py-2 font-bold text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        Access
                    </button>
                </form>
            </div>
        </body>
        </html>
    `;
}

function getPublicListPage(files) {
     const formatBytes = (bytes, decimals = 2) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
     
     const fileRows = files.map(file => `
        <tr class="border-b border-slate-200">
            <td class="p-4 text-slate-800">
                <div class="font-medium">${file.fileName}</div>
                <div class="text-sm text-slate-500">${formatBytes(file.fileSize)} | Expires: ${file.expireDate || 'Never'}</div>
            </td>
            <td class="p-4 text-center">
                <a href="${file.shortUrl}" target="_blank" class="text-sky-600 hover:underline font-semibold">Download</a>
            </td>
        </tr>
    `).join('');

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Shared File List</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-100">
            <div class="container mx-auto max-w-4xl mt-10 p-4">
                <div class="bg-white rounded-lg shadow-lg p-8">
                    <h1 class="text-3xl font-bold text-slate-800 mb-2">Download Links</h1>
                    <p class="text-slate-600 mb-6">Here is a list of shared files available for download.</p>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left">
                            <thead class="bg-slate-50">
                                <tr>
                                    <th class="p-4 font-semibold text-slate-600">File Details</th>
                                    <th class="p-4 font-semibold text-slate-600 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${fileRows}
                            </tbody>
                        </table>
                    </div>
                </div>
                 <footer class="text-center p-6 text-slate-500 text-sm">
                     Powered by ဒီဖိုင်
                 </footer>
            </div>
        </body>
        </html>
    `;
}
