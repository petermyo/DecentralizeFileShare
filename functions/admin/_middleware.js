/**
 * =================================================================================
 * Cloudflare Pages Function: Admin Backend
 * FILE PATH: /functions/admin/_middleware.js
 * =================================================================================
 *
 * This file handles all API requests prefixed with /api/admin/*.
 * It includes middleware to ensure only authorized admins can access these routes.
 *
 */

import * as jose from 'jose';

// --- Admin Configuration ---
const ADMIN_EMAILS = ['myozarniaung@gmail.com'];

// --- Main Handler for all /api/admin/* requests ---
export const onRequest = async (context) => {
    const { request, env } = context;
    
    // First, run the authentication and authorization middleware
    const authResponse = await isAdmin(request, env);
    if (authResponse.status !== 200) {
        return authResponse;
    }
    
    // If authorization is successful, proceed to the admin API router
    return handleAdminApiRequest(request, env);
}

/**
 * Handles all requests for the admin API after auth has been checked.
 */
async function handleAdminApiRequest(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API router logic
    switch (path) {
        case '/api/admin/stats':
            return getStats(env);
        case '/api/admin/users':
            return getUsers(env);
        case '/api/admin/revoke': // Deletes a user and their data
            return revokeUserAccess(request, env);
        // UPDATE: New endpoints for full CRUD
        case '/api/admin/files':
            return getAllFiles(env);
        case '/api/admin/lists':
            return getAllLists(env);
        case '/api/admin/delete-file':
            return deleteFileAsAdmin(request, env);
        case '/api/admin/delete-list':
            return deleteListAsAdmin(request, env);
    }

    return new Response('Admin API route not found', { status: 404 });
}


// --- Admin Auth Middleware ---
async function isAdmin(request, env) {
    const token = getCookie(request, 'auth_token');
    if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const { payload } = await jose.jwtVerify(token, await getJwtSecret(env));
        if (!payload || !payload.userId || !payload.email) {
            throw new Error('Invalid token payload.');
        }

        if (!ADMIN_EMAILS.includes(payload.email)) {
            return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (err) {
        return new Response(JSON.stringify({ error: 'Invalid or expired token.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
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
    const { keys } = await env.APP_KV.list({ prefix: "history:login:" });
    const userHistoryData = await Promise.all(
        keys.map(async (key) => {
            const userId = key.name.split(':')[2];
            const history = await env.APP_KV.get(key.name, { type: 'json' });
            const lastLogin = history[history.length - 1];
            
            const fileHistoryKey = `history:upload:${userId}`;
            const fileHistory = await env.APP_KV.get(fileHistoryKey, { type: 'json' }) || [];
            
            return {
                userId,
                lastLogin: lastLogin.timestamp,
                lastLoginIp: lastLogin.ip,
                fileCount: fileHistory.length
            };
        })
    );
    return new Response(JSON.stringify(userHistoryData), { headers: { 'Content-Type': 'application/json' } });
}

async function revokeUserAccess(request, env) {
    try {
        const { userId } = await request.json();
        if (!userId) {
            return new Response(JSON.stringify({ error: 'User ID is required.' }), { status: 400 });
        }

        // Delete all data associated with the user
        await env.APP_KV.delete(`user:${userId}`);
        await env.APP_KV.delete(`history:login:${userId}`);
        await env.APP_KV.delete(`history:upload:${userId}`);
        await env.APP_KV.delete(`history:list:${userId}`);
        
        // Note: This does not delete files from their Google Drive, only app access and records.

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


// --- JWT & Cookie Helpers (copied from main _middleware) ---
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
