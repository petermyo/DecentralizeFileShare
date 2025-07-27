/**
 * =================================================================================
 * Cloudflare Pages Function: Top-Level Middleware
 * CORRECT FILE PATH: /functions/_middleware.js
 * =================================================================================
 *
 * This version adds full CRUD functionality for file lists and fixes the
 * public list view rendering.
 *
 * Additionally, it introduces a file preview page with passcode handling and
 * inline display for supported media types (images, videos, PDFs).
 *
 * URL Prefix Changes:
 * - Preview: /p/
 * - Direct Download: /s/
 * - File List: /l/
 */

// --- Import JWT Library ---
import * as jose from 'jose';

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

    // Route short URL redirects for individual files (download)
    if (path.startsWith('/s/')) {
        if (request.method === 'GET') {
            return handleShortUrlGet(request, env);
        }
        if (request.method === 'POST') {
            return handleShortUrlPost(request, env);
        }
    }

    // Route public list views
    if (path.startsWith('/l/')) {
        if (request.method === 'GET') {
            return handlePublicListGet(request, env);
        }
        if (request.method === 'POST') {
            return handlePublicListPost(request, env);
        }
    }

    // Route file preview views (new prefix /p/)
    if (path.startsWith('/p/')) { // Changed from /a/ to /p/
        if (request.method === 'GET') {
            return handlePreviewGet(request, env);
        }
        if (request.method === 'POST') {
            return handlePreviewPost(request, env);
        }
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

// --- Auth Helper ---
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
        const userName = profile.name;
        const picture = profile.picture;

        await env.APP_KV.put(`user:${userId}`, JSON.stringify({
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
        headers.set('Location', url.origin);
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
            const newFileName = `${date}_${time}_${file.fileName}`;

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
        const shortUrl = `${new URL(request.url).origin}/s/${shortCode}`; // Still uses /s/ for direct download

        await env.APP_KV.put(`shorturl:${shortCode}`, JSON.stringify({
            id: fileId,
            name: originalName, // Use originalName for display on preview page
            fileName: fileName, // Keep the generated filename for internal use if needed
            fileSize: fileSize, // Store fileSize
            ownerId: userId,
            passcode: passcode || null,
            expireDate: expireDate || null,
            shortUrl: shortUrl // Store the short URL
        }), { expirationTtl: 60 * 60 * 24 * 30 }); // 30-day expiry

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
        // Direct download passcode page
        return new Response(getPasscodePage(shortCode, fileData.name, false, false, false), { headers: { 'Content-Type': 'text/html' } });
    }

    return streamFile(fileData, env, request); // Pass request to streamFile
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
        return streamFile(fileData, env, request); // Pass request to streamFile
    } else {
        return new Response(getPasscodePage(shortCode, fileData.name, true, false, false), { status: 401, headers: { 'Content-Type': 'text/html' } });
    }
}

async function handlePreviewGet(request, env) {
    const url = new URL(request.url);
    const shortCode = url.pathname.split('/p/')[1]; // Changed from /a/ to /p/
    if (!shortCode) return new Response('Invalid Preview URL', { status: 400 });

    const fileData = await env.APP_KV.get(`shorturl:${shortCode}`, { type: 'json' });
    if (!fileData) return new Response('File not found or expired', { status: 404 });

    if (fileData.expireDate && new Date(fileData.expireDate) < new Date()) {
        return new Response('This link has expired.', { status: 403 });
    }

    // Fetch Google Drive file metadata to get mimeType for proper preview rendering
    const ownerTokenData = await env.APP_KV.get(`user:${fileData.ownerId}`, { type: 'json' });
    if (!ownerTokenData) return new Response('File owner token not found.', { status: 500 });
    const accessToken = await getValidAccessToken(ownerTokenData, fileData.ownerId, env);

    const driveFileMetaRes = await fetch(`${GOOGLE_DRIVE_API}/files/${fileData.id}?fields=mimeType`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!driveFileMetaRes.ok) {
        console.error('Failed to fetch file mimeType from Google Drive:', await driveFileMetaRes.text());
        return new Response('Could not get file details for preview.', { status: 500 });
    }
    const driveFileMeta = await driveFileMetaRes.json();
    fileData.mimeType = driveFileMeta.mimeType; // Add mimeType to fileData object for preview rendering

    if (fileData.passcode) {
        // Use a specific passcode page tailored for preview context, action URL uses /p/
        return new Response(getPasscodePage(shortCode, fileData.name, false, false, true), { headers: { 'Content-Type': 'text/html' } });
    }

    return new Response(getPreviewPage(fileData, request.url), { headers: { 'Content-Type': 'text/html' } });
}

async function handlePreviewPost(request, env) {
    const url = new URL(request.url);
    const shortCode = url.pathname.split('/p/')[1]; // Changed from /a/ to /p/
    if (!shortCode) return new Response('Invalid Preview URL', { status: 400 });

    const fileData = await env.APP_KV.get(`shorturl:${shortCode}`, { type: 'json' });
    if (!fileData) return new Response('File not found or expired', { status: 404 });

    const formData = await request.formData();
    const submittedPasscode = formData.get('passcode');

    if (fileData.passcode && submittedPasscode === fileData.passcode) {
        // Fetch Google Drive file metadata to get mimeType for proper preview rendering
        const ownerTokenData = await env.APP_KV.get(`user:${fileData.ownerId}`, { type: 'json' });
        if (!ownerTokenData) return new Response('File owner token not found.', { status: 500 });
        const accessToken = await getValidAccessToken(ownerTokenData, fileData.ownerId, env);

        const driveFileMetaRes = await fetch(`${GOOGLE_DRIVE_API}/files/${fileData.id}?fields=mimeType`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!driveFileMetaRes.ok) {
            console.error('Failed to fetch file mimeType from Google Drive:', await driveFileMetaRes.text());
            return new Response('Could not get file details for preview.', { status: 500 });
        }
        const driveFileMeta = await driveFileMetaRes.json();
        fileData.mimeType = driveFileMeta.mimeType; // Add mimeType to fileData object for preview rendering

        return new Response(getPreviewPage(fileData, request.url), { headers: { 'Content-Type': 'text/html' } });
    } else {
        return new Response(getPasscodePage(shortCode, fileData.name, true, false, true), { status: 401, headers: { 'Content-Type': 'text/html' } });
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
    } catch (err) {
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
    } catch (err) {
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
        return new Response(getPasscodePage(listShortCode, `${listData.files.length} files`, false, true, false), { headers: { 'Content-Type': 'text/html' } });
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
        return new Response(getPasscodePage(listShortCode, `${listData.files.length} files`, true, true, false), { status: 401, headers: { 'Content-Type': 'text/html' } });
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

        const fileData = await env.APP_KV.get(`shorturl:${shortCode}`, { type: 'json' });
        if (!fileData || fileData.ownerId !== userId) {
            return new Response(JSON.stringify({ error: "List not found or permission denied." }), { status: 404 });
        }

        fileData.passcode = passcode || null;
        fileData.expireDate = expireDate || null;
        await env.APP_KV.put(`shorturl:${shortCode}`, JSON.stringify(fileData));

        const historyKey = `history:list:${userId}`;
        const listHistory = await env.APP_KV.get(historyKey, { type: 'json' }) || [];
        const updatedHistory = listHistory.map(list => {
            if (list.shortUrl === shortUrl) {
                // FIX: Store the actual passcode, not just a boolean
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

async function streamFile(fileData, env, request) {
    try {
        const ownerTokenData = await env.APP_KV.get(`user:${fileData.ownerId}`, { type: 'json' });
        if (!ownerTokenData) throw new Error("File owner's token not found.");

        const accessToken = await getValidAccessToken(ownerTokenData, fileData.ownerId, env);

        // Get actual MIME type from Google Drive for accurate Content-Type header
        const driveFileMetaRes = await fetch(`${GOOGLE_DRIVE_API}/files/${fileData.id}?fields=mimeType`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!driveFileMetaRes.ok) {
            console.error('Failed to fetch file mimeType from Google Drive:', await driveFileMetaRes.text());
            throw new Error('Could not get file details from Google Drive.');
        }
        const driveFileMeta = await driveFileMetaRes.json();
        const mimeType = driveFileMeta.mimeType || 'application/octet-stream';

        const driveResponse = await fetch(`${GOOGLE_DRIVE_API}/files/${fileData.id}?alt=media`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!driveResponse.ok) {
            return new Response('Could not fetch file from Google Drive. It may have been deleted or permissions changed.', { status: driveResponse.status });
        }

        const headers = new Headers();
        headers.set('Content-Type', mimeType);
        headers.set('Content-Length', driveResponse.headers.get('Content-Length'));

        const url = new URL(request.url);
        const isInlineRequest = url.searchParams.get('inline') === 'true';

        // Only add Content-Disposition: attachment if it's not an inline preview request
        if (!isInlineRequest) {
            headers.set('Content-Disposition', `attachment; filename="${fileData.name}"`);
        }

        return new Response(driveResponse.body, { headers });
    } catch (err) {
        console.error("Proxy download error:", err.message);
        return new Response('Error proxying the file.', { status: 500 });
    }
}

function getPasscodePage(shortCode, fileName, hasError = false, isList = false, isForPreview = false) {
    // Determine the action URL based on whether it's a list, a preview, or a direct download
    const actionUrl = isList ? `/l/${shortCode}` : (isForPreview ? `/p/${shortCode}` : `/s/${shortCode}`); // Changed /a/ to /p/
    const pageTitle = isForPreview ? "Preview Passcode Required" : "Passcode Required";
    const pageDescription = isForPreview ? `This preview is protected. Please enter the passcode for ${fileName}:` : `This content is protected. Please enter the passcode to continue:`;

    const errorMessage = hasError ? `<p class="text-red-500 text-sm mb-4">Incorrect passcode. Please try again.</p>` : '';
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${pageTitle}</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-100 flex items-center justify-center min-h-screen">
            <div class="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-center text-gray-800">Passcode Required</h2>
                <p class="text-center text-gray-600">${pageDescription}</p>
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

function getPreviewPage(fileData, currentUrl) {
    const formatBytes = (bytes, decimals = 2) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    const downloadLink = fileData.shortUrl; // Link to the existing /s/ route for actual download
    const inlineStreamLink = `${fileData.shortUrl}?inline=true`; // Link to /s/ route with inline flag for browser display

    let previewContent = '';
    const mimeType = fileData.mimeType || ''; // Ensure mimeType is available from fileData

    if (mimeType.startsWith('image/')) {
        previewContent = `<img src="${inlineStreamLink}" alt="File Preview" class="max-w-full h-auto mx-auto rounded-lg shadow-md max-h-[70vh] object-contain">`;
    } else if (mimeType.startsWith('video/')) {
        previewContent = `
            <video controls class="w-full h-auto rounded-lg shadow-md max-h-[70vh] object-contain">
                <source src="${inlineStreamLink}" type="${mimeType}">
                Your browser does not support the video tag.
            </video>
        `;
    } else if (mimeType === 'application/pdf') {
        previewContent = `
            <iframe src="${inlineStreamLink}" class="w-full min-h-[70vh] border-0 rounded-lg shadow-md"></iframe>
            <p class="text-center text-gray-600 mt-4">If the PDF does not display, you can download it directly.</p>
        `;
    } else {
        // For other file types, display a message
        previewContent = `
            <div class="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
                <p class="text-xl font-semibold text-gray-700 mb-4">No preview available for this file type.</p>
                <p class="text-gray-600">You can still download the file using the button below.</p>
            </div>
        `;
    }

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Preview: ${fileData.name}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                /* Ensure iframe/video/img fit within container */
                iframe, video, img {
                    display: block; /* Prevents extra space below elements */
                }
            </style>
        </head>
        <body class="bg-gray-100 min-h-screen flex flex-col items-center py-10">
            <div class="w-full max-w-4xl p-8 bg-white rounded-lg shadow-xl">
                <h1 class="text-3xl font-bold text-gray-800 mb-4 text-center">File Preview</h1>
                <div class="text-center mb-6">
                    <p class="text-xl font-semibold text-gray-700 break-words">${fileData.name}</p>
                    <p class="text-gray-600">Size: ${formatBytes(fileData.fileSize)}</p>
                    <p class="text-gray-600">Expires: ${fileData.expireDate || 'Never'}</p>
                    <p class="text-gray-600">Short URL: <a href="${fileData.shortUrl}" class="text-blue-500 hover:underline" target="_blank">${fileData.shortUrl}</a></p>
                </div>

                <div class="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    ${previewContent}
                </div>

                <div class="text-center">
                    <a href="${downloadLink}" class="inline-block px-6 py-3 font-bold text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500">
                        Download File
                    </a>
                </div>
            </div>
            <footer class="text-center p-6 text-gray-500 text-sm mt-8">
                 Powered by ဒီဖိုင်
             </footer>
        </body>
        </html>
    `;
}
