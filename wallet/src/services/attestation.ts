// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * RA-TLS attestation verification service.
 *
 * Wraps the native RA-TLS module to provide a high-level API for
 * verifying enclave attestation during the connect flow.
 */

import * as NativeRaTls from '../../modules/native-ratls/src/index';
import type { AttestationResult, VerificationPolicy } from '../../modules/native-ratls/src/NativeRaTls.types';

export type { AttestationResult, VerificationPolicy };

/**
 * Verify an enclave's RA-TLS attestation.
 *
 * @param origin The app origin (hostname:port).
 * @param expectedMeasurements Optional expected values for quick trust check.
 */
export async function verifyAttestation(
    origin: string,
    policy: VerificationPolicy
): Promise<AttestationResult> {
    const url = new URL(`https://${origin}`);
    const host = url.hostname;
    const port = parseInt(url.port || '443', 10);

    return NativeRaTls.verify(host, port, policy);
}

/**
 * Inspect an enclave's certificate without policy verification.
 * Used for displaying attestation details before the user decides to trust.
 */
export async function inspectAttestation(origin: string): Promise<AttestationResult> {
    const url = new URL(`https://${origin}`);
    const host = url.hostname;
    const port = parseInt(url.port || '443', 10);

    return NativeRaTls.inspect(host, port);
}
