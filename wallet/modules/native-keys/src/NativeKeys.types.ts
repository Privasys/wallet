// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

export interface KeyInfo {
    /** Opaque key identifier (tag on iOS, alias on Android). */
    keyId: string;
    /** Base64url-encoded uncompressed P-256 public key (65 bytes: 0x04 || x || y). */
    publicKey: string;
    /** Whether the key is backed by secure hardware (SE/StrongBox/TEE). */
    hardwareBacked: boolean;
}

export interface SignatureResult {
    /** Base64url-encoded DER ECDSA signature. */
    signature: string;
}
