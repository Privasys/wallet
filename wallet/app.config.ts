import { ExpoConfig, ConfigContext } from '@expo/config';
import 'dotenv/config';

import pkg from './package.json';

const { version } = pkg;
const STAGE = process.env.STAGE || 'development';
const EXPO_PROJECT_ID =
    process.env.NX_EXPO_PROJECT_ID ??
    process.env.EXPO_PUBLIC_PROJECT_ID ??
    process.env.EAS_BUILD_PROJECT_ID;
// const SENTRY_DSN_URL =
//     process.env.NX_SENTRY_DSN ??
//     process.env.NX_SENTRY_URL ??
//     process.env.EXPO_PUBLIC_SENTRY_DSN ??
//     process.env.EXPO_PUBLIC_SENTRY_URL ??
//     process.env.SENTRY_DSN ??
//     process.env.SENTRY_URL;

console.log(
    `Building Privasys Wallet version ${version}. Running app.config.ts for stage: ${STAGE}...`
);

// let sentryUrl = undefined;
// try {
//     sentryUrl = SENTRY_DSN_URL ? new URL(SENTRY_DSN_URL) : undefined;
// } catch (error) {
//     console.error('Invalid Sentry DSN URL:', error);
// }

// process.env.EXPO_PUBLIC_SENTRY_AUTH_TOKEN ??= process.env.SENTRY_AUTH_TOKEN;
process.env.EXPO_PUBLIC_SENTRY_DSN ??= process.env.SENTRY_DSN;
process.env.EXPO_PUBLIC_GOOGLE_PROJECT_ID ??= process.env.GOOGLE_PROJECT_ID;
process.env.EXPO_PUBLIC_CHALLENGE_SECRET_KEY ??= process.env.CHALLENGE_SECRET_KEY;

const envConfig = {
    development: {
        name: 'Privasys Wallet Dev',
        scheme: 'privasys-wallet-dev',
        bundle: 'org.privasys.wallet',
        adaptiveIconBackgroundColor: '#F0F9FF'
    },
    preview: {
        name: 'Privasys Wallet Preview',
        scheme: 'privasys-wallet-preview',
        bundle: 'org.privasys.wallet',
        adaptiveIconBackgroundColor: '#F0FFF4'
    },
    production: {
        name: 'Privasys Wallet',
        scheme: 'privasys-wallet',
        bundle: 'org.privasys.wallet',
        adaptiveIconBackgroundColor: '#FFFFFF'
    }
};

const config = envConfig[STAGE as keyof typeof envConfig];

export default (context: ConfigContext): ExpoConfig => {
    const { config: defaultConfig } = context;
    const finalConfig: ExpoConfig = {
        ...defaultConfig,
        name: config.name,
        description:
            'Privasys Wallet is a digital wallet for managing your connection keys to Privasys services.',
        slug: 'privasys-wallet',
        owner: 'privasys',
        icon: './assets/icon.svg',
        version: version,
        splash: {
            image: './assets/icon.svg',
            resizeMode: 'contain',
            backgroundColor: config.adaptiveIconBackgroundColor
        },
        assetBundlePatterns: ['**/*'],
        userInterfaceStyle: 'light',
        orientation: 'portrait',
        updates: {
            fallbackToCacheTimeout: 0,
            checkAutomatically: 'WIFI_ONLY',
            url: `https://privasys.id/updates/${EXPO_PROJECT_ID}`
        },
        newArchEnabled: true,
        jsEngine: 'hermes',
        runtimeVersion: { policy: 'appVersion' },
        scheme: config.scheme,
        ios: {
            supportsTablet: true,
            bundleIdentifier: config.bundle,
            infoPlist: {
                ITSAppUsesNonExemptEncryption: false,
                CFBundleAllowMixedLocalizations: true
            },
            config: { usesNonExemptEncryption: false },
            associatedDomains: ['applinks:privasys.id', 'webcredentials:privasys.id']
        },
        android: {
            // Submission to Google Play requires a unique package name.
            package: config.bundle,
            adaptiveIcon: {
                foregroundImage: './assets/icon.svg',
                backgroundColor: config.adaptiveIconBackgroundColor
            },
            // predictiveBackGestureEnabled: true
            googleServicesFile: './fixtures/org.privasys.wallet.google-services.json',
            intentFilters: [
                {
                    action: 'VIEW',
                    autoVerify: true,
                    data: [{ scheme: 'https', host: '*.privasys.id', pathPrefix: '/scp' }],
                    category: ['BROWSABLE', 'DEFAULT']
                }
            ]
        },
        web: { favicon: './assets/icon.svg', output: 'static', bundler: 'metro' },
        extra: {
            STAGE,
            CODE_VERSION: version,
            BUILD_ID: process.env.EAS_BUILD_ID ?? '-',
            BUILD_NUMBER:
                process.env.EAS_BUILD_IOS_BUILD_NUMBER ??
                process.env.EAS_BUILD_ANDROID_VERSION_CODE ??
                '0',
            COMMIT_HASH: process.env.EAS_BUILD_GIT_COMMIT_HASH,
            eas: { projectId: EXPO_PROJECT_ID }
        },
        plugins: [
            [
                'expo-secure-store',
                {
                    configureAndroidBackup: true,
                    faceIDPermission:
                        '$(PRODUCT_NAME) uses your biometrics to validate your connection requests.'
                }
            ],
            [
                'expo-build-properties',
                {
                    android: {
                        compileSdkVersion: 36,
                        targetSdkVersion: 36,
                        buildToolsVersion: '36.1.0',
                        kotlinVersion: '2.1.20'
                    },
                    ios: { deploymentTarget: '26.0' }
                }
            ],
            [
                'expo-camera',
                {
                    cameraPermission: '$(PRODUCT_NAME) needs your camera to scan login QR codes.',
                    recordAudioAndroid: false
                }
            ],
            ['expo-router', { root: './src/routes' }],
            ['expo-navigation-bar', { barStyle: 'dark-content', visibility: 'visible' }],
            'expo-localization',
            // sentryUrl
            //     ? [
            //         '@sentry/react-native/expo',
            //         {
            //             url: sentryUrl.origin,
            //             project: 'privasys-wallet',
            //             organization: 'privasys'
            //         }
            //     ]
            //     : 'noop',
            'expo-asset',
            'expo-font',
            'expo-web-browser',
            ['expo-notifications', { icon: './assets/notification-icon.svg', color: '#B21D36' }],
            './modules/passkey-provider/app.plugin'
        ].filter((p) => p !== 'noop') as ExpoConfig['plugins'],
        experiments: { typedRoutes: true, reactCompiler: true, buildCacheProvider: 'eas' }
    };

    return finalConfig;
};
