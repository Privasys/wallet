// Disables Android lintVitalRelease / lintVitalAnalyzeRelease which hangs
// on transitive dependencies like react-native-worklets.
const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withDisableLintVital(config) {
    return withAppBuildGradle(config, (config) => {
        const contents = config.modResults.contents;
        if (!contents.includes('checkReleaseBuilds')) {
            config.modResults.contents = contents.replace(
                /android\s*\{/,
                `android {\n    lint {\n        checkReleaseBuilds false\n        abortOnError false\n    }`
            );
            console.log('[disable-lint-vital] Disabled lintVitalRelease in app/build.gradle');
        }
        return config;
    });
};
