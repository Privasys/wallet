// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Auth broker WebSocket client.
 *
 * Connects to the auth broker relay to exchange session tokens with
 * the browser. The broker is a stateless relay — messages are forwarded
 * verbatim between paired WebSocket connections sharing a session ID.
 */

export interface BrokerMessage {
    type: string;
    payload?: Record<string, unknown>;
}

export interface BrokerConnection {
    send: (msg: BrokerMessage) => void;
    close: () => void;
}

/**
 * Connect to the auth broker and relay a session token to the browser.
 *
 * @param brokerUrl  WebSocket URL for the relay (e.g. wss://auth.privasys.org/relay).
 * @param sessionId  Session ID shared with the browser (from QR or push).
 * @param sessionToken  The opaque session token from the enclave's FIDO2 endpoint.
 * @param pushToken  Expo push token for future auth requests.
 */
export function relaySessionToken(
    brokerUrl: string,
    sessionId: string,
    sessionToken: string,
    pushToken: string | null
): Promise<void> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Broker relay timed out'));
        }, 15_000);

        const wsUrl = `${brokerUrl}?session=${encodeURIComponent(sessionId)}&role=wallet`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            // Announce wallet presence
            ws.send(
                JSON.stringify({
                    type: 'wallet-hello',
                    payload: { version: '0.2.0' }
                })
            );
        };

        ws.onmessage = (event) => {
            try {
                const data: BrokerMessage =
                    typeof event.data === 'string' ? JSON.parse(event.data) : {};

                if (data.type === 'broker-hello' || data.type === 'browser-waiting') {
                    // Browser is waiting — send the session token.
                    // Fields must be top-level to match the SDK's auth-result handler.
                    ws.send(
                        JSON.stringify({
                            type: 'auth-result',
                            sessionToken,
                            pushToken
                        })
                    );
                    // Browser will close its side after receiving; onclose resolves.
                    clearTimeout(timeout);
                    ws.close();
                    resolve();
                }
            } catch {
                // Ignore non-JSON messages
            }
        };

        ws.onerror = (event) => {
            clearTimeout(timeout);
            reject(new Error('Broker WebSocket error'));
        };

        ws.onclose = () => {
            clearTimeout(timeout);
            // Resolve even on clean close (broker may close after relay)
            resolve();
        };
    });
}

/**
 * Connect to broker and listen for auth requests (push-initiated flow).
 *
 * @param brokerUrl  WebSocket URL for the relay.
 * @param sessionId  Session ID from the push notification.
 * @param onRequest  Callback when the browser sends an auth request.
 * @returns A connection handle to send responses and close.
 */
export function listenForAuthRequest(
    brokerUrl: string,
    sessionId: string,
    onRequest: (msg: BrokerMessage) => void
): BrokerConnection {
    const wsUrl = `${brokerUrl}?session=${encodeURIComponent(sessionId)}&role=wallet`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        ws.send(
            JSON.stringify({
                type: 'wallet-hello',
                payload: { version: '0.2.0' }
            })
        );
    };

    ws.onmessage = (event) => {
        try {
            const data: BrokerMessage =
                typeof event.data === 'string' ? JSON.parse(event.data) : {};
            onRequest(data);
        } catch {
            // Ignore
        }
    };

    return {
        send: (msg) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(msg));
            }
        },
        close: () => ws.close()
    };
}
