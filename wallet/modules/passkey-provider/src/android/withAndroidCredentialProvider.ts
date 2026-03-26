// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Android config plugin: registers a CredentialProviderService.
 *
 * This makes the Privasys Wallet appear as a credential provider on
 * Android 14+ (API 34+). When a website calls navigator.credentials.get(),
 * Android routes matching requests to our service.
 */

import {
    ConfigPlugin,
    AndroidConfig,
    withAndroidManifest,
} from 'expo/config-plugins';

const SERVICE_CLASS = 'org.privasys.wallet.passkey.PrivasysCredentialProviderService';

export const withAndroidCredentialProvider: ConfigPlugin = (config) => {
    config = withAndroidManifest(config, (mod) => {
        const mainApp = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);

        // Check if service is already registered
        const services = mainApp['service'] ?? [];
        const exists = services.some(
            (s: any) => s.$?.['android:name'] === SERVICE_CLASS,
        );

        if (!exists) {
            services.push({
                $: {
                    'android:name': SERVICE_CLASS,
                    'android:exported': 'true' as any,
                    'android:permission': 'android.permission.BIND_CREDENTIAL_PROVIDER_SERVICE',
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
                            'android:name':
                                'android.credentials.provider',
                            'android:resource': '@xml/credential_provider_config',
                        },
                    },
                ],
            } as any);
            mainApp['service'] = services;
        }

        return mod;
    });

    return config;
};
