// Copyright (c) Privasys. All rights reserved.
// Licensed under the GNU Affero General Public License v3.0.

/**
 * Frame host — runs inside the privasys.id/auth/ iframe.
 *
 * Listens for postMessage from the parent page, instantiates the AuthUI
 * to run the authentication ceremony, and relays results back via
 * postMessage. Sessions are stored in privasys.id's localStorage so
 * they persist across adopter sites.
 *
 * Sessions have a 5-minute client-side TTL. The frame host automatically
 * renews sessions via push notification → wallet confirmation → broker
 * relay before the TTL expires.
 */

import { AuthUI } from './ui';
import type { AuthUIConfig, SignInResult } from './ui';
import { SessionManager } from './session';
import type { AuthSession } from './types';

const sessions = new SessionManager();

let activeUI: AuthUI | null = null;

// ── Session renewal ─────────────────────────────────────────────────────

const RENEWAL_MS = 4 * 60 * 1000; // Renew at 4 min (before 5-min TTL)
const RENEWAL_TIMEOUT_MS = 30_000;

const renewalTimers = new Map<string, ReturnType<typeof setTimeout>>();

function cancelRenewal(rpId: string): void {
    const timer = renewalTimers.get(rpId);
    if (timer) {
        clearTimeout(timer);
        renewalTimers.delete(rpId);
    }
}

function scheduleRenewal(session: AuthSession, parentOrigin: string): void {
    cancelRenewal(session.rpId);

    if (!session.pushToken || !session.brokerUrl) return;

    const timer = setTimeout(async () => {
        renewalTimers.delete(session.rpId);

        const current = sessions.get(session.rpId);
        if (!current?.pushToken || !current?.brokerUrl) return;

        try {
            await renewSession(current, parentOrigin);
            const updated = sessions.get(session.rpId);
            if (updated) scheduleRenewal(updated, parentOrigin);
        } catch (err) {
            console.warn('[frame-host] renewal failed, expiring session:', err);
            sessions.remove(session.rpId);
            window.parent.postMessage(
                { type: 'privasys:session-expired', rpId: session.rpId },
                parentOrigin,
            );
        }
    }, RENEWAL_MS);

    renewalTimers.set(session.rpId, timer);
}

/**
 * Renew a session by sending a silent push to the wallet and waiting
 * for confirmation via the broker WebSocket relay.
 */
async function renewSession(session: AuthSession, parentOrigin: string): Promise<void> {
    const brokerUrl = session.brokerUrl!;
    const brokerBase = brokerUrl
        .replace('wss://', 'https://')
        .replace('ws://', 'http://')
        .replace(/\/relay\/?$/, '');

    const sessionId = crypto.randomUUID();

    // Send silent renewal push
    const resp = await fetch(`${brokerBase}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            pushToken: session.pushToken,
            sessionId,
            rpId: session.rpId,
            origin: session.origin,
            brokerUrl,
            type: 'auth-renew',
        }),
    });

    if (!resp.ok) throw new Error(`Push failed: ${resp.status}`);

    // Wait for wallet confirmation via WebSocket
    return new Promise<void>((resolve, reject) => {
        const wsUrl = `${brokerUrl}?session=${encodeURIComponent(sessionId)}&role=browser`;
        const ws = new WebSocket(wsUrl);

        const timer = setTimeout(() => {
            ws.close();
            reject(new Error('Renewal timed out'));
        }, RENEWAL_TIMEOUT_MS);

        ws.onmessage = (e: MessageEvent) => {
            try {
                const msg = JSON.parse(typeof e.data === 'string' ? e.data : '{}');
                if (msg.type === 'auth-result') {
                    clearTimeout(timer);
                    ws.close();

                    // Keep the original enclave token; refresh timestamp
                    sessions.store({
                        ...session,
                        authenticatedAt: Date.now(),
                        pushToken: (msg.pushToken as string) || session.pushToken,
                    });

                    window.parent.postMessage(
                        { type: 'privasys:session-renewed', rpId: session.rpId },
                        parentOrigin,
                    );

                    resolve();
                }
            } catch { /* ignore malformed */ }
        };

        ws.onerror = () => {
            clearTimeout(timer);
            reject(new Error('WebSocket error'));
        };

        ws.onclose = (e: CloseEvent) => {
            clearTimeout(timer);
            if (e.code !== 1000) reject(new Error(`WebSocket closed (${e.code})`));
        };
    });
}

// ── Message handler ─────────────────────────────────────────────────────

window.addEventListener('message', async (e: MessageEvent) => {
    const data = e.data;
    if (!data || typeof data.type !== 'string') return;

    if (data.type === 'privasys:init') {
        const config: AuthUIConfig = data.config;
        const parentOrigin = e.origin;

        // Tear down any previous UI
        if (activeUI) {
            activeUI.destroy();
            activeUI = null;
        }

        // Check for a push token from any previous session (returning user)
        const pushToken = sessions.findPushToken();
        activeUI = new AuthUI({ ...config, pushToken });

        try {
            const result: SignInResult = await activeUI.signIn();

            const brokerUrl = config.brokerUrl || '';

            // Persist session in privasys.id localStorage
            const session: AuthSession = {
                token: result.sessionToken,
                rpId: config.rpId || config.appName,
                origin: config.apiBase,
                authenticatedAt: Date.now(),
                pushToken: result.pushToken,
                brokerUrl,
            };
            sessions.store(session);

            // Schedule automatic renewal before TTL expires
            if (session.pushToken && session.brokerUrl) {
                scheduleRenewal(session, parentOrigin);
            }

            window.parent.postMessage(
                { type: 'privasys:result', result },
                parentOrigin,
            );
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Authentication failed';
            if (msg === 'Authentication cancelled' || msg === 'AuthUI destroyed') {
                window.parent.postMessage({ type: 'privasys:cancel' }, parentOrigin);
            } else {
                window.parent.postMessage({ type: 'privasys:error', error: msg }, parentOrigin);
            }
        } finally {
            activeUI = null;
        }
    }

    if (data.type === 'privasys:check-session') {
        const session = sessions.get(data.rpId);

        // Ensure renewal is running for active sessions
        if (session?.pushToken && session?.brokerUrl && !renewalTimers.has(session.rpId)) {
            scheduleRenewal(session, e.origin);
        }

        window.parent.postMessage(
            { type: 'privasys:session', session: session || null },
            e.origin,
        );
    }

    if (data.type === 'privasys:clear-session') {
        cancelRenewal(data.rpId);
        sessions.remove(data.rpId);
        window.parent.postMessage(
            { type: 'privasys:session-cleared' },
            e.origin,
        );
    }
});

// Signal to parent that the iframe is ready to receive messages
window.parent.postMessage({ type: 'privasys:ready' }, '*');
