// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

import { relaySessionToken } from '../services/broker';

/**
 * Minimal WebSocket stub for testing the relay handshake.
 */
class FakeWebSocket {
    static instances: FakeWebSocket[] = [];

    onopen: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    onclose: (() => void) | null = null;

    sent: string[] = [];
    closed = false;
    url: string;

    constructor(url: string) {
        this.url = url;
        FakeWebSocket.instances.push(this);
        // Simulate async open
        setTimeout(() => this.onopen?.(), 0);
    }

    send(data: string) {
        this.sent.push(data);
    }

    close() {
        this.closed = true;
        setTimeout(() => this.onclose?.(), 0);
    }
}

beforeEach(() => {
    FakeWebSocket.instances = [];
    (globalThis as any).WebSocket = FakeWebSocket;
});

afterEach(() => {
    delete (globalThis as any).WebSocket;
});

describe('relaySessionToken', () => {
    it('sends auth-result with top-level fields on browser-waiting', async () => {
        const promise = relaySessionToken(
            'wss://broker.example.com/relay',
            'sess-123',
            'tok-abc',
            'push-xyz'
        );

        // Wait for WebSocket to "open"
        await tick();
        const ws = FakeWebSocket.instances[0];
        expect(ws).toBeDefined();

        // Simulate hub notifying wallet that browser is waiting
        ws.onmessage?.({ data: JSON.stringify({ type: 'browser-waiting' }) });

        await tick();

        // Should have sent wallet-hello on open, then auth-result
        expect(ws.sent).toHaveLength(2);

        const authMsg = JSON.parse(ws.sent[1]);
        expect(authMsg).toEqual({
            type: 'auth-result',
            sessionToken: 'tok-abc',
            pushToken: 'push-xyz',
        });

        // Should close after sending
        expect(ws.closed).toBe(true);

        await promise;
    });

    it('does NOT wrap session token in a payload object', async () => {
        const promise = relaySessionToken(
            'wss://broker.example.com/relay',
            'sess-456',
            'tok-def',
            null
        );

        await tick();
        const ws = FakeWebSocket.instances[0];

        ws.onmessage?.({ data: JSON.stringify({ type: 'browser-waiting' }) });
        await tick();

        const authMsg = JSON.parse(ws.sent[1]);
        // Must NOT have a payload wrapper
        expect(authMsg.payload).toBeUndefined();
        expect(authMsg.sessionToken).toBe('tok-def');
        expect(authMsg.pushToken).toBeNull();

        await promise;
    });

    it('also triggers on broker-hello', async () => {
        const promise = relaySessionToken(
            'wss://broker.example.com/relay',
            'sess-789',
            'tok-ghi',
            'push-000'
        );

        await tick();
        const ws = FakeWebSocket.instances[0];

        ws.onmessage?.({ data: JSON.stringify({ type: 'broker-hello' }) });
        await tick();

        const authMsg = JSON.parse(ws.sent[1]);
        expect(authMsg.type).toBe('auth-result');
        expect(ws.closed).toBe(true);

        await promise;
    });

    it('sends wallet-hello on open', async () => {
        const promise = relaySessionToken(
            'wss://broker.example.com/relay',
            's1',
            't1',
            null
        );

        await tick();
        const ws = FakeWebSocket.instances[0];

        const hello = JSON.parse(ws.sent[0]);
        expect(hello.type).toBe('wallet-hello');

        // Clean up — trigger close
        ws.onmessage?.({ data: JSON.stringify({ type: 'browser-waiting' }) });
        await tick();
        await promise;
    });

    it('constructs WebSocket URL with session and role params', async () => {
        const promise = relaySessionToken(
            'wss://broker.example.com/relay',
            'my-session',
            't',
            null
        );

        await tick();
        const ws = FakeWebSocket.instances[0];

        expect(ws.url).toBe(
            'wss://broker.example.com/relay?session=my-session&role=wallet'
        );

        ws.onmessage?.({ data: JSON.stringify({ type: 'browser-waiting' }) });
        await tick();
        await promise;
    });

    it('rejects on WebSocket error', async () => {
        const promise = relaySessionToken(
            'wss://broker.example.com/relay',
            's',
            't',
            null
        );

        await tick();
        const ws = FakeWebSocket.instances[0];

        ws.onerror?.({});

        await expect(promise).rejects.toThrow('Broker WebSocket error');
    });

    it('rejects with timeout when no response arrives', async () => {
        jest.useFakeTimers();

        const promise = relaySessionToken(
            'wss://broker.example.com/relay',
            's',
            't',
            null
        );

        // Fast-forward past the 15s timeout
        jest.advanceTimersByTime(16_000);

        // The close callback fires synchronously in fake timers
        await expect(promise).rejects.toThrow('Broker relay timed out');

        jest.useRealTimers();
    });
});

/** Flush microtasks + one setTimeout round. */
function tick(): Promise<void> {
    return new Promise((r) => setTimeout(r, 0));
}
