// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Silent session renewal.
 *
 * When the wallet receives an "auth-renew" push notification, this module
 * checks whether the rpId is still trusted and the credential is present.
 * If so, it connects to the broker WebSocket and sends a simple
 * confirmation back — no FIDO2 ceremony required (keys in the Secure
 * Enclave need biometric per-use). The browser frame-host keeps the
 * existing enclave session token and refreshes its client-side TTL.
 */

import { getAmbientPushToken } from '@/hooks/useExpoPushToken';
import { useAuthStore } from '@/stores/auth';
import { useTrustedAppsStore } from '@/stores/trusted-apps';

interface RenewalData {
    origin: string;
    sessionId: string;
    rpId: string;
    brokerUrl: string;
}

export async function handleSilentRenewal(data: RenewalData): Promise<void> {
    const { credentials } = useAuthStore.getState();
    const { apps } = useTrustedAppsStore.getState();

    const trustedApp = apps.find((a) => a.rpId === data.rpId);
    const credential = credentials.find((c) => c.rpId === data.rpId);

    if (!trustedApp || !credential) {
        console.log(`[RENEW] Ignoring renewal for ${data.rpId} — not trusted or no credential`);
        return;
    }

    const pushToken = getAmbientPushToken();

    console.log(`[RENEW] Confirming session renewal for ${data.rpId}`);

    return new Promise<void>((resolve, reject) => {
        let settled = false;

        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                reject(new Error('Renewal relay timed out'));
            }
            ws.close();
        }, 15_000);

        const wsUrl = `${data.brokerUrl}?session=${encodeURIComponent(data.sessionId)}&role=wallet`;
        const ws = new WebSocket(wsUrl);

        const sendConfirmation = () => {
            if (settled) return;
            ws.send(
                JSON.stringify({
                    type: 'auth-result',
                    sessionToken: 'renewed',
                    pushToken,
                }),
            );
            settled = true;
            clearTimeout(timeout);
            ws.close();
            console.log(`[RENEW] Session renewed for ${data.rpId}`);
            resolve();
        };

        ws.onopen = () => {
            sendConfirmation();
        };

        ws.onmessage = (event) => {
            try {
                const msg = typeof event.data === 'string' ? JSON.parse(event.data) : {};
                if (msg.type === 'browser-waiting') {
                    sendConfirmation();
                }
            } catch {
                // Ignore non-JSON
            }
        };

        ws.onerror = () => {
            clearTimeout(timeout);
            if (!settled) {
                settled = true;
                reject(new Error('Renewal WebSocket error'));
            }
        };

        ws.onclose = () => {
            clearTimeout(timeout);
            if (!settled) {
                settled = true;
                resolve();
            }
        };
    });
}
