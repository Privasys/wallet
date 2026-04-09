// Copyright (c) Privasys. All rights reserved.
// Licensed under the GNU Affero General Public License v3.0.

/**
 * Frame host — runs inside the privasys.id/auth/ iframe.
 *
 * Listens for postMessage from the parent page, instantiates the AuthUI
 * to run the authentication ceremony, and relays results back via
 * postMessage. Sessions are stored in privasys.id's localStorage so
 * they persist across adopter sites.
 */

import { AuthUI } from './ui';
import type { AuthUIConfig, SignInResult } from './ui';
import { SessionManager } from './session';

const sessions = new SessionManager();

let activeUI: AuthUI | null = null;

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

            // Persist session in privasys.id localStorage
            sessions.store({
                token: result.sessionToken,
                rpId: config.rpId || config.appName,
                origin: config.apiBase,
                authenticatedAt: Date.now(),
                pushToken: result.pushToken,
            });

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
        window.parent.postMessage(
            { type: 'privasys:session', session: session || null },
            e.origin,
        );
    }

    if (data.type === 'privasys:clear-session') {
        sessions.remove(data.rpId);
        window.parent.postMessage(
            { type: 'privasys:session-cleared' },
            e.origin,
        );
    }
});

// Signal to parent that the iframe is ready to receive messages
window.parent.postMessage({ type: 'privasys:ready' }, '*');
