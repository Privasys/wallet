// Copyright (c) Privasys. All rights reserved.
// Licensed under the GNU Affero General Public License v3.0.

/**
 * Generate a cryptographically random session ID (hex-encoded, 32 bytes).
 */
export function generateSessionId(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * QR payload that the wallet scans to begin authentication.
 */
export interface QRPayload {
    origin: string;
    sessionId: string;
    rpId: string;
    brokerUrl: string;
}

/**
 * Generate the JSON payload to encode in a QR code.
 * The wallet scans this and connects to the broker to pair with the browser.
 */
export function generateQRPayload(opts: {
    rpId: string;
    brokerUrl: string;
    sessionId?: string;
}): { sessionId: string; payload: string } {
    const sessionId = opts.sessionId ?? generateSessionId();
    const qr: QRPayload = {
        origin: globalThis.location?.origin ?? '',
        sessionId,
        rpId: opts.rpId,
        brokerUrl: opts.brokerUrl,
    };
    return { sessionId, payload: JSON.stringify(qr) };
}

/**
 * Batch QR payload for multi-app authentication.
 * Contains multiple apps — wallet authenticates all in a single flow.
 */
export interface BatchQRPayload {
    origin: string;
    sessionId: string;
    brokerUrl: string;
    apps: Array<{ rpId: string; sessionId: string }>;
}

/**
 * Generate a QR payload for batch (multi-app) authentication.
 * Each app gets its own session ID for its broker relay.
 */
export function generateBatchQRPayload(opts: {
    brokerUrl: string;
    apps: Array<{ rpId: string; sessionId?: string }>;
    sessionId?: string;
}): { sessionId: string; appSessions: Array<{ rpId: string; sessionId: string }>; payload: string } {
    const sessionId = opts.sessionId ?? generateSessionId();
    const appSessions = opts.apps.map((app) => ({
        rpId: app.rpId,
        sessionId: app.sessionId ?? generateSessionId(),
    }));
    const qr: BatchQRPayload = {
        origin: globalThis.location?.origin ?? '',
        sessionId,
        brokerUrl: opts.brokerUrl,
        apps: appSessions,
    };
    return { sessionId, appSessions, payload: JSON.stringify(qr) };
}
