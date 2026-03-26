// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Notification key management.
 *
 * Generates, stores, and retrieves the AES-256 symmetric key used for
 * end-to-end encrypted push notifications between cloud enclaves and
 * the Notification Service Extension.
 *
 * The key is stored in the **shared App Group keychain**
 * (`group.org.privasys.wallet`) so that both the main app and the
 * Notification Service Extension can access it.
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEYCHAIN_SERVICE = 'org.privasys.wallet.notification-key';
const KEYCHAIN_ACCOUNT = 'enclave-notification-key';

/**
 * Options for the shared-group keychain entry (iOS only).
 *
 * We pass the bare group name `org.privasys.shared` — iOS prepends the
 * Team ID (`$(AppIdentifierPrefix)`) automatically at the OS level, matching
 * the entitlements declaration in both the main app and the extension.
 */
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = Platform.select({
    ios: {
        keychainService: KEYCHAIN_SERVICE,
        keychainAccessGroup: 'org.privasys.shared',
    },
    default: {},
});

/**
 * Generate a fresh AES-256 key, persist it in the shared keychain, and
 * return the standard-base64 representation.
 *
 * If a key already exists it is **overwritten** (key rotation).
 */
export async function generateNotificationKey(): Promise<string> {
    const raw = await Crypto.getRandomBytesAsync(32);
    const b64 = uint8ToBase64(raw);
    await SecureStore.setItemAsync(KEYCHAIN_ACCOUNT, b64, SECURE_STORE_OPTIONS);
    return b64;
}

/**
 * Read the current notification key from the shared keychain.
 *
 * @returns Standard-base64-encoded 32-byte key, or `null` if none is stored.
 */
export async function getNotificationKey(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYCHAIN_ACCOUNT, SECURE_STORE_OPTIONS);
}

/**
 * Return `true` if a notification encryption key has been provisioned.
 */
export async function hasNotificationKey(): Promise<boolean> {
    const key = await getNotificationKey();
    return key !== null;
}

/**
 * Delete the notification key from the shared keychain.
 */
export async function deleteNotificationKey(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYCHAIN_ACCOUNT, SECURE_STORE_OPTIONS);
}

/**
 * Ensure a notification key exists — generate one if it doesn't.
 *
 * @returns Standard-base64-encoded 32-byte key.
 */
export async function ensureNotificationKey(): Promise<string> {
    const existing = await getNotificationKey();
    if (existing) return existing;
    return generateNotificationKey();
}

// ── helpers ──────────────────────────────────────────────────────────

function uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
}
