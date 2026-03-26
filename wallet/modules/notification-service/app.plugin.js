// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

// Expo config plugin — adds a Notification Service Extension target for
// decrypting E2E encrypted push notification payloads from enclaves.
//
// Written in plain JS because config plugins are evaluated by Node.js at
// prebuild time, before metro / TypeScript compilation.

const {
    withPlugins,
    withXcodeProject,
    withDangerousMod,
    IOSConfig,
} = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

const EXTENSION_NAME = 'NotificationServiceExtension';

// ── Step 1: Copy extension source files into ios/ ────────────────────

function withCopyExtensionFiles(config) {
    return withDangerousMod(config, [
        'ios',
        (mod) => {
            const iosRoot = path.join(mod.modRequest.projectRoot, 'ios');
            const extDir = path.join(iosRoot, EXTENSION_NAME);
            const src = path.join(
                mod.modRequest.projectRoot,
                'modules',
                'notification-service',
                'ios'
            );

            fs.mkdirSync(extDir, { recursive: true });

            for (const file of [
                'NotificationService.swift',
                'Info.plist',
                'NotificationServiceExtension.entitlements',
            ]) {
                fs.copyFileSync(
                    path.join(src, file),
                    path.join(extDir, file)
                );
            }

            return mod;
        },
    ]);
}

// ── Step 2: Add the extension target to the Xcode project ───────────

function withExtensionTarget(config) {
    return withXcodeProject(config, (mod) => {
        const proj = mod.modResults;

        // Idempotency: skip if the extension target already exists
        const nativeTargets = proj.pbxNativeTargetSection();
        for (const k in nativeTargets) {
            const nt = nativeTargets[k];
            if (typeof nt === 'string') continue;
            if ((nt.name || '').replace(/"/g, '') === EXTENSION_NAME) {
                return mod;
            }
        }

        const bundleId =
            IOSConfig.BundleIdentifier.getBundleIdentifier(mod) ||
            'org.privasys.wallet';
        const extBundleId = `${bundleId}.NotificationService`;

        // ─ 2a. Create the app-extension target ──────────────────────
        const target = proj.addTarget(
            EXTENSION_NAME,
            'app_extension',
            EXTENSION_NAME,
            extBundleId
        );

        // ─ 2b. Add an empty PBXGroup (display only) ────────────────
        // Do NOT pass files here — addPbxGroup creates PBXFileReference
        // entries, and addBuildPhase below creates its own. Passing
        // files to both causes duplicate PBXFileReference entries which
        // Xcode surfaces as "Unexpected duplicate tasks".
        const group = proj.addPbxGroup(
            [],
            EXTENSION_NAME,
            EXTENSION_NAME
        );

        // Attach the group to the project's root group
        const mainGroup =
            proj.getFirstProject().firstProject.mainGroup;
        proj.addToPbxGroup(group.uuid, mainGroup);

        // ─ 2c. Build phases ─────────────────────────────────────────
        // Use the full path (including folder) so the PBXFileReference
        // resolves relative to the project root.
        proj.addBuildPhase(
            [`${EXTENSION_NAME}/NotificationService.swift`],
            'PBXSourcesBuildPhase',
            'Sources',
            target.uuid
        );
        proj.addBuildPhase(
            [],
            'PBXFrameworksBuildPhase',
            'Frameworks',
            target.uuid
        );
        proj.addBuildPhase(
            [],
            'PBXResourcesBuildPhase',
            'Resources',
            target.uuid
        );

        // ─ 2d. Configure build settings for Debug + Release ────────
        const configs = proj.pbxXCBuildConfigurationSection();
        for (const key in configs) {
            const entry = configs[key];
            if (typeof entry === 'string' || !entry.buildSettings) continue;

            // Match configurations belonging to the extension target
            const pn = entry.buildSettings.PRODUCT_NAME;
            if (
                pn !== `"${EXTENSION_NAME}"` &&
                pn !== EXTENSION_NAME
            )
                continue;

            Object.assign(entry.buildSettings, {
                IPHONEOS_DEPLOYMENT_TARGET: '16.0',
                SWIFT_VERSION: '5.0',
                CODE_SIGN_STYLE: 'Automatic',
                CODE_SIGN_ENTITLEMENTS: `${EXTENSION_NAME}/${EXTENSION_NAME}.entitlements`,
                INFOPLIST_FILE: `${EXTENSION_NAME}/Info.plist`,
                PRODUCT_BUNDLE_IDENTIFIER: `"${extBundleId}"`,
                TARGETED_DEVICE_FAMILY: '"1,2"',
                GENERATE_INFOPLIST_FILE: 'NO',
                CURRENT_PROJECT_VERSION: '1',
                MARKETING_VERSION: '1.0',
                SWIFT_EMIT_LOC_STRINGS: 'YES',
                CLANG_ENABLE_MODULES: 'YES',
                SKIP_INSTALL: 'YES',
            });

            // Per-configuration overrides
            if (entry.name === 'Debug') {
                entry.buildSettings.SWIFT_OPTIMIZATION_LEVEL = '"-Onone"';
                entry.buildSettings.DEBUG_INFORMATION_FORMAT = '"dwarf"';
            } else {
                entry.buildSettings.SWIFT_OPTIMIZATION_LEVEL = '"-O"';
                entry.buildSettings.DEBUG_INFORMATION_FORMAT =
                    '"dwarf-with-dsym"';
                entry.buildSettings.COPY_PHASE_STRIP = 'YES';
            }
        }

        // ─ 2e. Configure the embed phase created by addTarget ────────
        // addTarget('app_extension') already creates a PBXCopyFilesBuildPhase
        // (named "Copy Files") on the main target and adds a target dependency.
        // We just need to configure the phase's dstSubfolderSpec to 13
        // (PlugIns/) so the .appex lands in the correct location.
        configureCopyFilesPhase(proj);

        return mod;
    });
}

/**
 * Fix the "Copy Files" phase created by addTarget so that the .appex
 * is placed in PlugIns/ (dstSubfolderSpec 13) with the correct
 * "RemoveHeadersOnCopy" attribute.
 */
function configureCopyFilesPhase(proj) {
    const copyPhases = proj.hash.project.objects['PBXCopyFilesBuildPhase'];
    if (!copyPhases) return;

    const appexName = `${EXTENSION_NAME}.appex`;
    for (const uuid in copyPhases) {
        const phase = copyPhases[uuid];
        if (typeof phase === 'string' || !phase.files) continue;

        // Match the phase created by addTarget (named "Copy Files")
        const hasAppex = phase.files.some((f) => {
            const comment = f.comment || '';
            return comment.includes(appexName);
        });
        if (!hasAppex) continue;

        // Set destination to PlugIns (13) and rename to the standard name
        phase.dstSubfolderSpec = 13;
        phase.name = '"Embed Foundation Extensions"';

        // Set RemoveHeadersOnCopy on the .appex build file
        for (const f of phase.files) {
            const bfUuid = f.value;
            const buildFiles = proj.hash.project.objects['PBXBuildFile'];
            if (buildFiles[bfUuid]) {
                buildFiles[bfUuid].settings = {
                    ATTRIBUTES: ['RemoveHeadersOnCopy'],
                };
            }
        }
        break;
    }
}

// ── Combined plugin ──────────────────────────────────────────────────
// The shared keychain access group `$(AppIdentifierPrefix)org.privasys.shared`
// is already configured by the passkey-provider plugin on the main app.
// The extension's entitlements file declares the same group. iOS prepends
// the Team ID automatically at the OS level.

function withNotificationServiceExtension(config) {
    return withPlugins(config, [
        withCopyExtensionFiles,
        withExtensionTarget,
    ]);
}

module.exports = withNotificationServiceExtension;
