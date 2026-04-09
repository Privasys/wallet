// Copyright (c) Privasys. All rights reserved.
// Licensed under the GNU Affero General Public License v3.0.

import type { AuthSession } from './types';

const STORAGE_KEY = 'privasys_sessions';

type SessionListener = (sessions: AuthSession[]) => void;

/**
 * Manages authenticated sessions in localStorage.
 * Tracks sessions per rpId so a returning user can skip QR scanning.
 */
export class SessionManager {
    private listeners = new Set<SessionListener>();

    /** Store a new session after successful authentication. */
    store(session: AuthSession): void {
        const sessions = this.getAll();
        // Replace existing session for the same rpId
        const idx = sessions.findIndex((s) => s.rpId === session.rpId);
        if (idx >= 0) sessions[idx] = session;
        else sessions.push(session);
        this.persist(sessions);
        this.notify(sessions);
    }

    /** Get the session for a specific RP, or undefined if none. */
    get(rpId: string): AuthSession | undefined {
        return this.getAll().find((s) => s.rpId === rpId);
    }

    /** Get all stored sessions. */
    getAll(): AuthSession[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            return JSON.parse(raw) as AuthSession[];
        } catch {
            return [];
        }
    }

    /** Check if a session exists for an RP. */
    has(rpId: string): boolean {
        return this.get(rpId) !== undefined;
    }

    /**
     * Find a push token from any stored session (most recent first).
     * The push token is device-global, so a token from any rpId can
     * be used to notify the wallet for a different rpId.
     */
    findPushToken(): string | undefined {
        const sessions = this.getAll()
            .filter((s) => !!s.pushToken)
            .sort((a, b) => b.authenticatedAt - a.authenticatedAt);
        return sessions[0]?.pushToken;
    }

    /** Remove a session by rpId. */
    remove(rpId: string): void {
        const sessions = this.getAll().filter((s) => s.rpId !== rpId);
        this.persist(sessions);
        this.notify(sessions);
    }

    /** Remove all sessions. */
    clear(): void {
        localStorage.removeItem(STORAGE_KEY);
        this.notify([]);
    }

    /** Subscribe to session changes. Returns an unsubscribe function. */
    subscribe(listener: SessionListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private persist(sessions: AuthSession[]): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }

    private notify(sessions: AuthSession[]): void {
        for (const listener of this.listeners) {
            listener(sessions);
        }
    }
}
