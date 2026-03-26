// Works around expo-modules-core ≤55.0.17 not compiling in Swift 6 mode.
//
// Problem:
//   Swift 6 mode  → strict concurrency errors (~20 failures)
//   Swift 5 mode  → `@MainActor` on conformances is invalid syntax
//   Fix: force Swift 5 + patch @MainActor conformance lines
//
// NOTE: iOS 26 API patches (expo-router, expo-image, expo-notifications)
// were removed after switching CI to macos-26 (Xcode 26 / iOS 26 SDK).
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PODFILE_SNIPPET = `
  # [swift-concurrency-fix] force Swift 5 + patch @MainActor conformances
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |bc|
      bc.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
      bc.build_settings['SWIFT_VERSION'] = '5'
    end
  end
`;

// ── expo-modules-core: @MainActor in conformance position (Swift 6 syntax) ──
const PATCHES = [
    {
        file: 'node_modules/expo-modules-core/ios/Core/Views/SwiftUI/SwiftUIHostingView.swift',
        from: ': ExpoView, @MainActor AnyExpoSwiftUIHostingView',
        to: ': ExpoView, AnyExpoSwiftUIHostingView'
    },
    {
        file: 'node_modules/expo-modules-core/ios/Core/Views/SwiftUI/SwiftUIVirtualView.swift',
        from: ': @MainActor ExpoSwiftUI.ViewWrapper',
        to: ': ExpoSwiftUI.ViewWrapper'
    },
    {
        file: 'node_modules/expo-modules-core/ios/Core/Views/ViewDefinition.swift',
        from: 'extension UIView: @MainActor AnyArgument',
        to: 'extension UIView: AnyArgument'
    }
];

module.exports = function withSwiftConcurrencyFix(config) {
    return withDangerousMod(config, [
        'ios',
        async (config) => {
            const projectRoot = config.modRequest.projectRoot;
            const podfile = path.join(config.modRequest.platformProjectRoot, 'Podfile');
            let contents = fs.readFileSync(podfile, 'utf-8');

            if (!contents.includes('swift-concurrency-fix')) {
                const marker = 'post_install do |installer|';
                if (contents.includes(marker)) {
                    contents = contents.replace(marker, `${marker}${PODFILE_SNIPPET}`);
                } else {
                    contents += `\npost_install do |installer|${PODFILE_SNIPPET}\nend\n`;
                }
                fs.writeFileSync(podfile, contents, 'utf-8');
                console.log('[swift-concurrency-fix] Patched Podfile');
            }

            // Patch source files to remove @MainActor from conformances
            for (const patch of PATCHES) {
                const filePath = path.join(projectRoot, patch.file);
                if (fs.existsSync(filePath)) {
                    let src = fs.readFileSync(filePath, 'utf-8');
                    if (src.includes(patch.from)) {
                        src = src.replace(patch.from, patch.to);
                        fs.writeFileSync(filePath, src, 'utf-8');
                        console.log(`[swift-concurrency-fix] Patched ${patch.file}`);
                    }
                }
            }

            return config;
        }
    ]);
};
