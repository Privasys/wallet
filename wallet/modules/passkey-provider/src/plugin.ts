// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Expo config plugin for Passkey Provider.
 *
 * Modifies the native projects at prebuild time to add:
 * - iOS: ASCredentialProviderExtension target + entitlements
 * - Android: CredentialProviderService manifest entry
 */

import { ConfigPlugin, withPlugins } from 'expo/config-plugins';

import { withIosPasskeyExtension } from './ios/withIosPasskeyExtension';
import { withAndroidCredentialProvider } from './android/withAndroidCredentialProvider';

const withPasskeyProvider: ConfigPlugin = (config) => {
    return withPlugins(config, [
        withIosPasskeyExtension,
        withAndroidCredentialProvider,
    ]);
};

export default withPasskeyProvider;
