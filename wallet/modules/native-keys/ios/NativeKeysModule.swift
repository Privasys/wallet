// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

import ExpoModulesCore
import Security
import LocalAuthentication

public class NativeKeysModule: Module {
    private static let keyTagPrefix = "org.privasys.wallet.key."

    public func definition() -> ModuleDefinition {
        Name("NativeKeys")

        AsyncFunction("generateKey") { (keyId: String, requireBiometric: Bool) -> String in
            let tag = Self.tag(for: keyId)

            // Return existing key if present
            if let existingPub = Self.loadPublicKey(tag: tag) {
                let info = Self.keyInfoJson(keyId: keyId, publicKey: existingPub, hardwareBacked: true)
                return info
            }

            var accessFlags: SecAccessControlCreateFlags = [.privateKeyUsage]
            if requireBiometric {
                accessFlags.insert(.biometryCurrentSet)
            }

            guard let access = SecAccessControlCreateWithFlags(
                kCFAllocatorDefault,
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                accessFlags,
                nil
            ) else {
                return "{\"error\":\"failed to create access control\"}"
            }

            let attributes: [String: Any] = [
                kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
                kSecAttrKeySizeInBits as String: 256,
                kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
                kSecPrivateKeyAttrs as String: [
                    kSecAttrIsPermanent as String: true,
                    kSecAttrApplicationTag as String: tag,
                    kSecAttrAccessControl as String: access
                ] as [String: Any]
            ]

            var error: Unmanaged<CFError>?
            guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
                let msg = error?.takeRetainedValue().localizedDescription ?? "unknown"
                return "{\"error\":\"\(msg)\"}"
            }

            guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
                return "{\"error\":\"failed to get public key\"}"
            }

            guard let pubData = SecKeyCopyExternalRepresentation(publicKey, nil) as Data? else {
                return "{\"error\":\"failed to export public key\"}"
            }

            return Self.keyInfoJson(keyId: keyId, publicKey: pubData, hardwareBacked: true)
        }

        AsyncFunction("sign") { (keyId: String, dataBase64url: String) -> String in
            let tag = Self.tag(for: keyId)

            guard let privateKey = Self.loadPrivateKey(tag: tag) else {
                return "{\"error\":\"key not found\"}"
            }

            guard let data = Self.base64urlDecode(dataBase64url) else {
                return "{\"error\":\"invalid base64url data\"}"
            }

            var error: Unmanaged<CFError>?
            guard let signature = SecKeyCreateSignature(
                privateKey,
                .ecdsaSignatureMessageX962SHA256,
                data as CFData,
                &error
            ) as Data? else {
                let msg = error?.takeRetainedValue().localizedDescription ?? "unknown"
                return "{\"error\":\"\(msg)\"}"
            }

            let sigB64 = Self.base64urlEncode(signature)
            return "{\"signature\":\"\(sigB64)\"}"
        }

        AsyncFunction("keyExists") { (keyId: String) -> Bool in
            let tag = Self.tag(for: keyId)
            return Self.loadPublicKey(tag: tag) != nil
        }

        AsyncFunction("deleteKey") { (keyId: String) in
            let tag = Self.tag(for: keyId)
            let query: [String: Any] = [
                kSecClass as String: kSecClassKey,
                kSecAttrApplicationTag as String: tag,
                kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            ]
            SecItemDelete(query as CFDictionary)
        }

        AsyncFunction("getPublicKey") { (keyId: String) -> String in
            let tag = Self.tag(for: keyId)
            guard let pubData = Self.loadPublicKey(tag: tag) else {
                return "{\"error\":\"key not found\"}"
            }
            return Self.keyInfoJson(keyId: keyId, publicKey: pubData, hardwareBacked: true)
        }
    }

    // MARK: - Helpers

    private static func tag(for keyId: String) -> Data {
        (keyTagPrefix + keyId).data(using: .utf8)!
    }

    private static func loadPrivateKey(tag: Data) -> SecKey? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: tag,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecReturnRef as String: true,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess else { return nil }
        return (item as! SecKey)
    }

    private static func loadPublicKey(tag: Data) -> Data? {
        guard let privateKey = loadPrivateKey(tag: tag),
              let publicKey = SecKeyCopyPublicKey(privateKey),
              let pubData = SecKeyCopyExternalRepresentation(publicKey, nil) as Data?
        else { return nil }
        return pubData
    }

    private static func keyInfoJson(keyId: String, publicKey: Data, hardwareBacked: Bool) -> String {
        let b64 = base64urlEncode(publicKey)
        return """
        {"keyId":"\(keyId)","publicKey":"\(b64)","hardwareBacked":\(hardwareBacked)}
        """
    }

    private static func base64urlEncode(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func base64urlDecode(_ string: String) -> Data? {
        var b64 = string
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let pad = (4 - b64.count % 4) % 4
        b64 += String(repeating: "=", count: pad)
        return Data(base64Encoded: b64)
    }
}
