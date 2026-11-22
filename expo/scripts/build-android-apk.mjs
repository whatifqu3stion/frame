#!/usr/bin/env node
// Standalone release APK; credentials never enter app config or the JS bundle.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const privateDir = join(root, '.local', 'android-signing');
const credentialsPath = join(privateDir, 'credentials.json');
const keystorePath = join(privateDir, 'frame-release.keystore');
const init = process.argv.includes('--init-key');
// For retrying compilation after a successful prebuild, with unchanged app config.
const skipPrebuild = process.argv.includes('--skip-prebuild');
const args = process.argv.slice(2).filter(arg => !['--init-key', '--skip-prebuild'].includes(arg));
if (args.length) throw new Error(`Unknown options: ${args.join(', ')}`);
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk || !existsSync(sdk)) throw new Error('Set ANDROID_HOME to your installed Android SDK.');
// Ignore developer .env files and unrelated inherited public configuration.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('EXPO_PUBLIC_')));
Object.assign(env, { ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, EXPO_NO_DOTENV: '1',
  EXPO_PUBLIC_APP_ENV: 'production', CI: '1', GRADLE_USER_HOME: join(root, '.local', 'gradle') });
// OAuth IDs are public; provider API keys belong in native Settings only.
for (const key of ['EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID_PRODUCTION', 'EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB_PRODUCTION']) {
  if (process.env[key]) env[key] = process.env[key];
}
function run(command, arguments_, cwd = root) {
  const result = spawnSync(command, arguments_, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal}).`);
}
run('java', ['-version']);
if (!existsSync(credentialsPath)) {
  if (!init) throw new Error('No local signing identity. For a first install, run with --init-key. For an existing install, restore its signing identity; do not create a replacement.');
  if (existsSync(keystorePath)) throw new Error('A keystore exists without credentials. Restore its credentials before building.');
  mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  const password = randomBytes(32).toString('hex');
  const credentials = { alias: 'frame-personal', storePassword: password, keyPassword: password };
  // Preserve the password even if keytool or the build is interrupted.
  writeFileSync(credentialsPath, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  env.FRAME_ANDROID_STORE_PASSWORD = password;
  env.FRAME_ANDROID_KEY_PASSWORD = password;
  run('keytool', ['-genkeypair', '-keystore', keystorePath, '-storetype', 'PKCS12', '-alias', credentials.alias,
    '-storepass:env', 'FRAME_ANDROID_STORE_PASSWORD', '-keypass:env', 'FRAME_ANDROID_KEY_PASSWORD',
    '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=Frame Personal, O=Personal, C=US', '-noprompt']);
  chmodSync(keystorePath, 0o600);
  console.log('Created private signing identity in .local/android-signing. Back it up securely; updates must reuse it.');
}
const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));
if (!existsSync(keystorePath) || !credentials.alias || !credentials.storePassword || !credentials.keyPassword) throw new Error('Incomplete signing identity. Restore keystore and credentials together.');
Object.assign(env, { FRAME_ANDROID_KEYSTORE: keystorePath, FRAME_ANDROID_KEY_ALIAS: credentials.alias,
  FRAME_ANDROID_STORE_PASSWORD: credentials.storePassword, FRAME_ANDROID_KEY_PASSWORD: credentials.keyPassword });
if (!skipPrebuild) run(process.execPath, [join(root, 'node_modules/expo/bin/cli'), 'prebuild', '--platform', 'android', '--no-install']);
const gradlePath = join(root, 'android/app/build.gradle');
if (!existsSync(gradlePath)) throw new Error('Run without --skip-prebuild to generate the Android project first.');
let gradle = readFileSync(gradlePath, 'utf8');
const config = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
if (Number(gradle.match(/\bversionCode\s+(\d+)/)?.[1]) !== config.android.versionCode
  || gradle.match(/\bversionName\s+["']([^"']+)/)?.[1] !== config.version
  || gradle.match(/\bapplicationId\s+["']([^"']+)/)?.[1] !== config.android.package) {
  throw new Error('Generated Android identity/version does not match app.json. Run without --skip-prebuild.');
}
if (!gradle.includes('signingConfigs {')) throw new Error('Unrecognized Android template; signing was not applied.');
const signingBlock = `framePersonal {
            def keyPath = System.getenv("FRAME_ANDROID_KEYSTORE")
            if (keyPath) {
                storeFile file(keyPath)
                storePassword System.getenv("FRAME_ANDROID_STORE_PASSWORD")
                keyAlias System.getenv("FRAME_ANDROID_KEY_ALIAS")
                keyPassword System.getenv("FRAME_ANDROID_KEY_PASSWORD")
            }
        }`;
if (gradle.includes('framePersonal {')) {
  gradle = gradle.replace(/framePersonal \{[\s\S]*?\n {8}\}/, signingBlock);
} else {
  gradle = gradle.replace('signingConfigs {', `signingConfigs {\n        ${signingBlock}`);
}
const release = /release\s*\{([\s\S]*?)signingConfig signingConfigs\.(debug|framePersonal)/;
if (!release.test(gradle)) throw new Error('Unrecognized release signing; refusing a debug-signed APK.');
gradle = gradle.replace(release, 'release {$1signingConfig signingConfigs.framePersonal');
writeFileSync(gradlePath, gradle);
run(join(root, 'android/gradlew'), [':app:assembleRelease', '--no-daemon', '--console=plain', '--max-workers=4'], join(root, 'android'));
const artifacts = join(root, 'artifacts');
mkdirSync(artifacts, { recursive: true });
const apk = join(artifacts, `Frame-${config.version}-${config.android.versionCode}.apk`);
copyFileSync(join(root, 'android/app/build/outputs/apk/release/app-release.apk'), apk);
console.log(`Standalone APK: ${apk}`);
