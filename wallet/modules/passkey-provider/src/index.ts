// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Passkey Provider — Expo config plugin that registers the wallet as a
 * system-level passkey provider (FIDO2 credential provider).
 *
 * iOS: Adds an ASCredentialProviderExtension target to the Xcode project.
 * Android: Registers a CredentialProviderService in AndroidManifest.xml.
 *
 * The extension/service intercepts navigator.credentials.get() calls from
 * browsers when the RP ID matches a Privasys enclave the wallet knows about.
 * Before signing, it performs RA-TLS attestation verification.
 */

export { default as withPasskeyProvider } from './plugin';
