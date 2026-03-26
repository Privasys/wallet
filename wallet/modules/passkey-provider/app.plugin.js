// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

// Expo config plugin — registers the wallet as a system passkey provider.
// Written in plain JS because config plugins are evaluated by Node.js at
// prebuild time, before metro/TypeScript compilation.

const {
    withPlugins,
    withEntitlementsPlist,
    withInfoPlist,
    withAndroidManifest,
    AndroidConfig,
    IOSConfig,
} = require('expo/config-plugins');

const SERVICE_CLASS =
    'org.privasys.wallet.passkey.PrivasysCredentialProviderService';

// ── iOS: entitlements + Info.plist for ASCredentialProviderExtension ───

function withIosPasskeyExtension(config) {
    // Shared keychain group
    config = withEntitlementsPlist(config, (mod) => {
        const bundleId =
            mod.modResults['com.apple.application-identifier'] ||
            IOSConfig.BundleIdentifier.getBundleIdentifier(mod) ||
            'org.privasys.wallet';

        mod.modResults['keychain-access-groups'] = [
            `$(AppIdentifierPrefix)${bundleId}`,
            '$(AppIdentifierPrefix)org.privasys.shared',
        ];
        return mod;
    });

    // Associated domains (webcredentials for passkey matching)
    config = withEntitlementsPlist(config, (mod) => {
        const domains =
            mod.modResults['com.apple.developer.associated-domains'] || [];
        if (!domains.includes('webcredentials:privasys.id')) {
            mod.modResults['com.apple.developer.associated-domains'] = [
                ...domains,
                'webcredentials:privasys.id',
            ];
        }
        return mod;
    });

    // NOTE: NSExtension for credential provider UI requires a separate
    // Xcode extension target. Adding it to the main app Info.plist causes
    // Apple validation to reject the IPA. The extension target will be
    // added in a future update.

    return config;
}

// ── Android: register CredentialProviderService in manifest ───────────

function withAndroidCredentialProvider(config) {
    config = withAndroidManifest(config, (mod) => {
        const mainApp =
            AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);

        const services = mainApp.service || [];
        const exists = services.some(
            (s) => s.$?.['android:name'] === SERVICE_CLASS,
        );

        if (!exists) {
            services.push({
                $: {
                    'android:name': SERVICE_CLASS,
                    'android:exported': 'true',
                    'android:permission':
                        'android.permission.BIND_CREDENTIAL_PROVIDER_SERVICE',
                },
                'intent-filter': [
                    {
                        action: [
                            {
                                $: {
                                    'android:name':
                                        'android.service.credentials.CredentialProviderService',
                                },
                            },
                        ],
                    },
                ],
                'meta-data': [
                    {
                        $: {
                            'android:name': 'android.credentials.provider',
                            'android:resource':
                                '@xml/credential_provider_config',
                        },
                    },
                ],
            });
            mainApp.service = services;
        }

        return mod;
    });

    return config;
}

// ── Combined plugin ──────────────────────────────────────────────────

function withPasskeyProvider(config) {
    return withPlugins(config, [
        withIosPasskeyExtension,
        withAndroidCredentialProvider,
    ]);
}

module.exports = withPasskeyProvider;
