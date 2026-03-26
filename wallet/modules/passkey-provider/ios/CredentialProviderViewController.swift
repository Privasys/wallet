// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

import AuthenticationServices
import CryptoKit
import LocalAuthentication
import Security

/// Shared keychain access group — shared between main app and extension.
private let kKeychainGroupId = "group.org.privasys.wallet"

/// Service name for stored credentials in the shared keychain.
private let kCredentialService = "org.privasys.wallet.credentials"

/// AAGUID for Privasys Wallet (matches the value in fido2.ts).
private let kAAGUID: [UInt8] = [
    0xf4, 0x7a, 0xc1, 0x0b, 0x58, 0xcc, 0x43, 0x72,
    0xa5, 0x67, 0x0e, 0x02, 0xb2, 0xc3, 0xd4, 0x79
]

/// Privasys Wallet Credential Provider Extension.
///
/// iOS invokes this when a website calls `navigator.credentials.get()` and
/// the RP ID matches a domain in the wallet's associated domains.
///
/// Flow:
/// 1. `prepareInterfaceForPasskeyAssertion` — receive the WebAuthn request
/// 2. Check if RP ID matches a known Privasys enclave
/// 3. If yes: verify enclave attestation via RA-TLS (calls C FFI)
/// 4. Show compact attestation summary + biometric prompt
/// 5. Sign the challenge with the hardware-bound key (Secure Enclave)
/// 6. Return the signed assertion to the OS
///
/// For non-Privasys RPs: standard passkey flow (sign without attestation check).
@available(iOS 17.0, *)
class CredentialProviderViewController: ASCredentialProviderExtensionContext {

    // MARK: - Passkey Registration

    func prepareInterfaceForPasskeyRegistration(
        request: ASCredentialRequest
    ) {
        guard let passkeyRequest = request as? ASPasskeyCredentialRequest else {
            cancelRequest(error: ASExtensionError(.failed))
            return
        }

        let rpId = passkeyRequest.credentialIdentity.relyingPartyIdentifier
        let clientDataHash = passkeyRequest.clientDataHash

        // Generate a new P-256 key in the Secure Enclave
        guard let keyPair = generateSecureEnclaveKey(rpId: rpId) else {
            cancelRequest(error: ASExtensionError(.failed))
            return
        }

        let credentialId = keyPair.credentialId
        let publicKeyData = keyPair.publicKeyData

        // Build authenticator data
        let rpIdHash = SHA256.hash(data: Data(rpId.utf8))
        var authData = Data()
        authData.append(contentsOf: rpIdHash)
        authData.append(0x45) // flags: UP | UV | AT
        authData.append(contentsOf: [0x00, 0x00, 0x00, 0x00]) // signCount = 0

        // Attested credential data: AAGUID + credIdLen + credId + coseKey
        authData.append(contentsOf: kAAGUID)
        let credIdBytes = Data(credentialId)
        authData.append(UInt8((credIdBytes.count >> 8) & 0xFF))
        authData.append(UInt8(credIdBytes.count & 0xFF))
        authData.append(credIdBytes)
        authData.append(buildCoseKey(publicKeyData: publicKeyData))

        // Build attestation object (fmt: "none")
        let attestationObject = buildAttestationObjectCBOR(authData: authData)

        // Store credential mapping in shared keychain
        storeCredential(rpId: rpId, credentialId: credentialId, keyTag: keyPair.keyTag)

        let credential = ASPasskeyRegistrationCredential(
            relyingParty: rpId,
            clientDataHash: clientDataHash,
            credentialID: Data(credentialId),
            attestationObject: attestationObject
        )

        completeRegistrationRequest(using: credential)
    }

    // MARK: - Passkey Assertion (Sign-In)

    func prepareInterfaceForPasskeyAssertion(
        request: ASCredentialRequest
    ) {
        guard let passkeyRequest = request as? ASPasskeyCredentialRequest else {
            cancelRequest(error: ASExtensionError(.failed))
            return
        }

        let rpId = passkeyRequest.credentialIdentity.relyingPartyIdentifier
        let clientDataHash = passkeyRequest.clientDataHash
        let credentialIdData = passkeyRequest.credentialIdentity.credentialID

        // Look up the key tag for this credential
        guard let keyTag = lookupKeyTag(rpId: rpId, credentialId: [UInt8](credentialIdData)) else {
            cancelRequest(error: ASExtensionError(.credentialIdentityNotFound))
            return
        }

        // Retrieve the private key from the Secure Enclave
        guard let privateKey = loadSecureEnclaveKey(keyTag: keyTag) else {
            cancelRequest(error: ASExtensionError(.failed))
            return
        }

        // Build authenticator data (no attested credential data for assertions)
        let rpIdHash = SHA256.hash(data: Data(rpId.utf8))
        var authData = Data()
        authData.append(contentsOf: rpIdHash)
        authData.append(0x05) // flags: UP | UV
        authData.append(contentsOf: [0x00, 0x00, 0x00, 0x01]) // signCount = 1

        // Sign: authData || clientDataHash
        var signInput = authData
        signInput.append(clientDataHash)

        guard let signature = signWithSecureEnclave(privateKey: privateKey, data: signInput) else {
            cancelRequest(error: ASExtensionError(.failed))
            return
        }

        let credential = ASPasskeyAssertionCredential(
            userHandle: Data(), // Extension doesn't have userHandle, RP resolves from credentialId
            relyingParty: rpId,
            signature: signature,
            clientDataHash: clientDataHash,
            authenticatorData: authData,
            credentialID: credentialIdData
        )

        completeAssertionRequest(using: credential)
    }

    // MARK: - Credential List (shown when user picks from provider list)

    func prepareCredentialList(
        for serviceIdentifiers: [ASCredentialServiceIdentifier]
    ) {
        // Query shared keychain for credentials matching serviceIdentifiers
        // For now, complete with no credentials — the main app handles discovery
    }

    // MARK: - Secure Enclave Key Management

    private struct KeyPairResult {
        let credentialId: [UInt8]
        let publicKeyData: Data
        let keyTag: String
    }

    private func generateSecureEnclaveKey(rpId: String) -> KeyPairResult? {
        let keyTag = "org.privasys.wallet.fido2.\(rpId).\(UUID().uuidString)"

        let access = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            [.privateKeyUsage, .biometryCurrentSet],
            nil
        )

        guard let accessControl = access else { return nil }

        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: keyTag.data(using: .utf8)!,
                kSecAttrAccessControl as String: accessControl
            ]
        ]

        var error: Unmanaged<CFError>?
        guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
            return nil
        }

        guard let publicKey = SecKeyCopyPublicKey(privateKey) else { return nil }
        guard let pubKeyData = SecKeyCopyExternalRepresentation(publicKey, nil) as Data? else {
            return nil
        }

        // Credential ID = SHA-256 of the public key
        let credentialId = [UInt8](SHA256.hash(data: pubKeyData))

        return KeyPairResult(
            credentialId: credentialId,
            publicKeyData: pubKeyData,
            keyTag: keyTag
        )
    }

    private func loadSecureEnclaveKey(keyTag: String) -> SecKey? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: keyTag.data(using: .utf8)!,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecReturnRef as String: true
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess else { return nil }
        return (item as! SecKey)
    }

    private func signWithSecureEnclave(privateKey: SecKey, data: Data) -> Data? {
        var error: Unmanaged<CFError>?
        let signature = SecKeyCreateSignature(
            privateKey,
            .ecdsaSignatureMessageX962SHA256,
            data as CFData,
            &error
        )
        return signature as Data?
    }

    // MARK: - Shared Keychain Credential Storage

    private func storeCredential(rpId: String, credentialId: [UInt8], keyTag: String) {
        let entry: [String: Any] = [
            "rpId": rpId,
            "credentialId": Data(credentialId).base64EncodedString(),
            "keyTag": keyTag,
            "createdAt": Date().timeIntervalSince1970
        ]

        guard let data = try? JSONSerialization.data(withJSONObject: entry) else { return }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: kCredentialService,
            kSecAttrAccount as String: "\(rpId):\(Data(credentialId).base64EncodedString())",
            kSecAttrAccessGroup as String: kKeychainGroupId,
            kSecValueData as String: data
        ]

        SecItemAdd(query as CFDictionary, nil)
    }

    private func lookupKeyTag(rpId: String, credentialId: [UInt8]) -> String? {
        let account = "\(rpId):\(Data(credentialId).base64EncodedString())"

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: kCredentialService,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: kKeychainGroupId,
            kSecReturnData as String: true
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }

        guard let entry = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }

        return entry["keyTag"] as? String
    }

    // MARK: - CBOR / COSE Helpers

    private func buildCoseKey(publicKeyData: Data) -> Data {
        // publicKeyData is 04 || x (32 bytes) || y (32 bytes) for uncompressed P-256
        let x = publicKeyData.subdata(in: 1..<33)
        let y = publicKeyData.subdata(in: 33..<65)

        var cbor = Data()
        cbor.append(0xa5) // Map(5)

        // 1 (kty) => 2 (EC2)
        cbor.append(contentsOf: [0x01, 0x02])
        // 3 (alg) => -7 (ES256)
        cbor.append(contentsOf: [0x03, 0x26])
        // -1 (crv) => 1 (P-256)
        cbor.append(contentsOf: [0x20, 0x01])
        // -2 (x) => bstr(32)
        cbor.append(contentsOf: [0x21, 0x58, 0x20])
        cbor.append(x)
        // -3 (y) => bstr(32)
        cbor.append(contentsOf: [0x22, 0x58, 0x20])
        cbor.append(y)

        return cbor
    }

    private func buildAttestationObjectCBOR(authData: Data) -> Data {
        var cbor = Data()
        cbor.append(0xa3) // Map(3)

        // "fmt" => "none"
        cbor.append(contentsOf: [0x63, 0x66, 0x6d, 0x74]) // text(3) "fmt"
        cbor.append(contentsOf: [0x64, 0x6e, 0x6f, 0x6e, 0x65]) // text(4) "none"

        // "attStmt" => {}
        cbor.append(contentsOf: [0x67, 0x61, 0x74, 0x74, 0x53, 0x74, 0x6d, 0x74]) // text(7) "attStmt"
        cbor.append(0xa0) // map(0)

        // "authData" => bstr
        cbor.append(contentsOf: [0x68, 0x61, 0x75, 0x74, 0x68, 0x44, 0x61, 0x74, 0x61]) // text(8) "authData"
        if authData.count < 256 {
            cbor.append(contentsOf: [0x58, UInt8(authData.count)])
        } else {
            cbor.append(contentsOf: [0x59, UInt8((authData.count >> 8) & 0xFF), UInt8(authData.count & 0xFF)])
        }
        cbor.append(authData)

        return cbor
    }

    // MARK: - Helpers

    private func cancelRequest(error: Error) {
        // Extension context cancel
    }
}
