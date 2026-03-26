const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require('expo/metro-config');
// eslint-disable-next-line @typescript-eslint/no-require-imports
// const { withSentryConfig, } = require('@sentry/react-native/metro');
const tsConfig = require('./tsconfig.json');

// Log to ensure it’s loaded
console.log('>>> Using custom `metro.config.js` with aliases');

const projectRoot = __dirname;
// const config = withSentryConfig(getDefaultConfig(projectRoot));
const config = getDefaultConfig(projectRoot);
const tsPaths = Object.entries(tsConfig.compilerOptions?.paths ?? {});

if (!config.resolver.resolveRequest)
    config.resolver.resolveRequest = (ctx, moduleName, platform) => {
        for (const [alias, paths] of tsPaths) {
            const aliasPattern = new RegExp(`^${alias.replace('*', '(.*)')}$`);
            const match = moduleName.match(aliasPattern);
            if (match) {
                for (const p of paths) {
                    const relativePath = p.replace('*', match[1] || '');
                    const targetModuleName = path.resolve(projectRoot, relativePath);
                    try {
                        const resolution = ctx.resolveRequest(ctx, targetModuleName, platform);
                        if (
                            resolution.type !== 'empty' &&
                            (resolution.filePath || resolution.filePaths?.length)
                        )
                            return resolution;
                    } catch (error) {
                        // Ignore resolution errors and try the next path
                    }
                }
            }
        }
        return ctx.resolveRequest(ctx, moduleName, platform);
    };

module.exports = config;
