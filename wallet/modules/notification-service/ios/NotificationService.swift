// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

import UserNotifications
import CryptoKit

/// Notification Service Extension that decrypts encrypted push payloads
/// from Privasys enclaves before displaying them to the user.
///
/// Expected payload format:
/// ```json
/// {
///   "aps": { "mutable-content": 1, "alert": { "title": "Encrypted", "body": "..." } },
///   "encrypted": true,
///   "ciphertext": "<base64 AES-GCM ciphertext>",
///   "nonce": "<base64 12-byte nonce>",
///   "tag": "<base64 16-byte auth tag>"
/// }
/// ```
///
/// The AES-256 symmetric key is shared between the main app and this
/// extension via the shared keychain access group `org.privasys.shared`.
/// Both targets declare `$(AppIdentifierPrefix)org.privasys.shared` in
/// their entitlements; iOS prepends the Team ID automatically at the
/// OS level.
class NotificationService: UNNotificationServiceExtension {

    private static let keychainService = "org.privasys.wallet.notification-key"
    private static let keychainAccount = "enclave-notification-key"
    private static let keychainGroup = "org.privasys.shared"

    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        bestAttemptContent = request.content.mutableCopy() as? UNMutableNotificationContent

        guard let content = bestAttemptContent else {
            contentHandler(request.content)
            return
        }

        let userInfo = content.userInfo

        // Only process encrypted payloads
        guard let encrypted = userInfo["encrypted"] as? Bool, encrypted else {
            contentHandler(content)
            return
        }

        guard let ciphertextB64 = userInfo["ciphertext"] as? String,
              let nonceB64 = userInfo["nonce"] as? String,
              let tagB64 = userInfo["tag"] as? String,
              let ciphertext = Data(base64Encoded: ciphertextB64),
              let nonceData = Data(base64Encoded: nonceB64),
              let tagData = Data(base64Encoded: tagB64)
        else {
            content.title = "Privasys"
            content.body = "You have a new notification."
            contentHandler(content)
            return
        }

        // Decrypt the payload
        do {
            let key = try Self.loadKey()
            let nonce = try AES.GCM.Nonce(data: nonceData)
            let sealedBox = try AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertext, tag: tagData)
            let plaintext = try AES.GCM.open(sealedBox, using: key)

            guard let json = try JSONSerialization.jsonObject(with: plaintext) as? [String: Any] else {
                throw DecryptionError.invalidPayload
            }

            // Apply decrypted fields to notification
            if let title = json["title"] as? String {
                content.title = title
            }
            if let body = json["body"] as? String {
                content.body = body
            }
            if let subtitle = json["subtitle"] as? String {
                content.subtitle = subtitle
            }
            if let data = json["data"] as? [String: Any] {
                var updatedUserInfo = content.userInfo
                for (k, v) in data {
                    updatedUserInfo[k] = v
                }
                content.userInfo = updatedUserInfo
            }

            contentHandler(content)
        } catch {
            // Decryption failed — show a generic notification
            content.title = "Privasys"
            content.body = "You have a new notification."
            contentHandler(content)
        }
    }

    override func serviceExtensionTimeWillExpire() {
        // Deliver whatever we have before the system kills us
        if let handler = contentHandler, let content = bestAttemptContent {
            content.title = "Privasys"
            content.body = "You have a new notification."
            handler(content)
        }
    }

    // MARK: - Keychain

    /// Load the AES-256-GCM symmetric key from the shared keychain.
    ///
    /// expo-secure-store writes keys as UTF-8 encoded strings.  The value
    /// stored is a standard base64 representation of the raw 32-byte key
    /// so we must decode two layers: Data → String → Data(base64).
    private static func loadKey() throws -> SymmetricKey {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
            kSecAttrAccessGroup as String: keychainGroup,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let storedData = result as? Data else {
            throw DecryptionError.keyNotFound
        }

        // expo-secure-store stores values as UTF-8 strings.
        // The value is a standard-base64-encoded 32-byte key.
        guard let base64String = String(data: storedData, encoding: .utf8),
              let keyData = Data(base64Encoded: base64String),
              keyData.count == 32 else {
            throw DecryptionError.invalidPayload
        }

        return SymmetricKey(data: keyData)
    }

    enum DecryptionError: Error {
        case keyNotFound
        case invalidPayload
    }
}
