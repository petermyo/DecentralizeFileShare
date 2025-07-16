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
// Add the email addresses of authorized administrators here.
const ADMIN_EMAILS = ['myozarniaung@gmail.com'];

/**
 * Main request handler. This function is the entry point for all /admin/* requests.
 */
export const onRequest = async (context) => {
    const { request, env } = context;
    
    // First, run the authentication and authorization middleware
    const authResponse = await isAdmin(request, env);
    if (authResponse.status !== 200) {
        // If not an admin, return the error response from the middleware
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
        case '/api/admin/revoke':
            return revokeUserAccess(request, env);
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

        // Check if the user's email is in the admin list
        if (!ADMIN_EMAILS.includes(payload.email)) {
            return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }

        // Return a successful response. The main handler will not use the body.
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

        // Delete the user's token, effectively logging them out and revoking access
        await env.APP_KV.delete(`user:${userId}`);
        
        // Note: This does not revoke Google's grant. The user would need to do that
        // from their Google account settings. This action only revokes their access
        // to *your* application.

        return new Response(JSON.stringify({ success: true, message: `Access revoked for user ${userId}` }), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to revoke access.' }), { status: 500 });
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
