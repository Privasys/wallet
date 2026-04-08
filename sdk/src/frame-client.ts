// Copyright (c) Privasys. All rights reserved.
// Licensed under the GNU Affero General Public License v3.0.

/**
 * Frame client — lightweight script loaded by adopter sites.
 *
 * Creates an invisible full-viewport iframe pointing to privasys.id/auth/
 * and communicates via postMessage. The authentication UI runs entirely
 * inside the iframe (on privasys.id's origin), which means:
 *
 *  - Sessions persist in privasys.id's localStorage across all adopter sites
 *  - Auth UI updates deploy once to privasys.id and apply everywhere
 *  - Session tokens are never stored in the adopter's origin
 *
 * Usage:
 * ```html
 * <script src="https://privasys.id/auth/privasys-auth-client.js"></script>
 * <script>
 *   const auth = new Privasys.AuthFrame({
 *     apiBase: 'https://api.developer.privasys.org',
 *     appName: 'my-app',
 *   });
 *   const result = await auth.signIn();
 *   console.log(result.sessionToken);
 * </script>
 * ```
 */

// ---------------------------------------------------------------------------
// Types (subset — avoids importing the full SDK)
// ---------------------------------------------------------------------------

export interface AuthFrameConfig {
    /** Management service API base URL. */
    apiBase: string;
    /** App name or UUID as registered on the platform. */
    appName: string;
    /** Relying party ID. Defaults to appName. */
    rpId?: string;
    /** WebSocket URL for the auth broker relay. */
    brokerUrl?: string;
    /** Timeout in ms (default: 120 000). */
    timeout?: number;
    /** Origin of the auth iframe (default: "https://privasys.id"). */
    authOrigin?: string;
}

export interface SignInResult {
    sessionToken: string;
    method: 'wallet' | 'passkey';
    attestation?: Record<string, unknown>;
    sessionId: string;
    pushToken?: string;
}

// ---------------------------------------------------------------------------
// AuthFrame
// ---------------------------------------------------------------------------

export class AuthFrame {
    private readonly authOrigin: string;
    private readonly config: Omit<AuthFrameConfig, 'authOrigin'>;

    constructor(config: AuthFrameConfig) {
        const { authOrigin, ...rest } = config;
        this.authOrigin = authOrigin ?? 'https://privasys.id';
        this.config = rest;
    }

    /** The RP ID used for authentication. */
    get rpId(): string {
        return this.config.rpId ?? this.config.appName;
    }

    /**
     * Open the authentication modal (inside a privasys.id iframe) and
     * wait for the user to complete the ceremony.
     */
    signIn(): Promise<SignInResult> {
        return new Promise<SignInResult>((resolve, reject) => {
            const iframe = document.createElement('iframe');
            iframe.src = this.authOrigin + '/auth/';
            iframe.style.cssText =
                'position:fixed;inset:0;width:100%;height:100%;' +
                'z-index:999999;border:none;background:transparent;';
            iframe.allow =
                'publickey-credentials-get *; publickey-credentials-create *';
            iframe.setAttribute('allowtransparency', 'true');

            const cleanup = () => {
                window.removeEventListener('message', handler);
                iframe.remove();
            };

            const handler = (e: MessageEvent) => {
                if (e.origin !== this.authOrigin) return;
                const data = e.data;
                if (!data || typeof data.type !== 'string') return;

                switch (data.type) {
                    case 'privasys:ready':
                        iframe.contentWindow!.postMessage(
                            { type: 'privasys:init', config: this.config },
                            this.authOrigin,
                        );
                        break;

                    case 'privasys:result':
                        cleanup();
                        resolve(data.result as SignInResult);
                        break;

                    case 'privasys:cancel':
                        cleanup();
                        reject(new Error('Authentication cancelled'));
                        break;

                    case 'privasys:error':
                        cleanup();
                        reject(new Error(data.error || 'Authentication failed'));
                        break;
                }
            };

            window.addEventListener('message', handler);
            document.body.appendChild(iframe);
        });
    }

    /**
     * Check whether privasys.id already has a session for this RP.
     * Uses a hidden iframe to query localStorage on the auth origin.
     */
    getSession(): Promise<{ token: string; rpId: string; authenticatedAt: number } | null> {
        return new Promise((resolve) => {
            const iframe = document.createElement('iframe');
            iframe.src = this.authOrigin + '/auth/';
            iframe.style.cssText = 'position:fixed;width:0;height:0;border:none;opacity:0;pointer-events:none;';

            const timeout = setTimeout(() => {
                cleanup();
                resolve(null);
            }, 5000);

            const cleanup = () => {
                clearTimeout(timeout);
                window.removeEventListener('message', handler);
                iframe.remove();
            };

            const handler = (e: MessageEvent) => {
                if (e.origin !== this.authOrigin) return;
                const data = e.data;
                if (!data || typeof data.type !== 'string') return;

                if (data.type === 'privasys:ready') {
                    iframe.contentWindow!.postMessage(
                        { type: 'privasys:check-session', rpId: this.rpId },
                        this.authOrigin,
                    );
                } else if (data.type === 'privasys:session') {
                    cleanup();
                    resolve(data.session || null);
                }
            };

            window.addEventListener('message', handler);
            document.body.appendChild(iframe);
        });
    }

    /**
     * Clear the session for this RP from privasys.id localStorage.
     */
    clearSession(): Promise<void> {
        return new Promise((resolve) => {
            const iframe = document.createElement('iframe');
            iframe.src = this.authOrigin + '/auth/';
            iframe.style.cssText = 'position:fixed;width:0;height:0;border:none;opacity:0;pointer-events:none;';

            const timeout = setTimeout(() => {
                cleanup();
                resolve();
            }, 3000);

            const cleanup = () => {
                clearTimeout(timeout);
                window.removeEventListener('message', handler);
                iframe.remove();
            };

            const handler = (e: MessageEvent) => {
                if (e.origin !== this.authOrigin) return;
                const data = e.data;
                if (!data || typeof data.type !== 'string') return;

                if (data.type === 'privasys:ready') {
                    iframe.contentWindow!.postMessage(
                        { type: 'privasys:clear-session', rpId: this.rpId },
                        this.authOrigin,
                    );
                } else if (data.type === 'privasys:session-cleared') {
                    cleanup();
                    resolve();
                }
            };

            window.addEventListener('message', handler);
            document.body.appendChild(iframe);
        });
    }

    /** Tear down any active iframe. */
    destroy(): void {
        const existing = document.querySelector(
            `iframe[src^="${this.authOrigin}/auth/"]`,
        );
        if (existing) existing.remove();
    }
}
