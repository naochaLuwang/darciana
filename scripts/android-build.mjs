import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const task = process.argv[2];
if (!['assembleDebug', 'assembleRelease', 'bundleRelease'].includes(task))
  throw new Error('Choose an Android build task.');
let localSigning = {};
if (task !== 'assembleDebug') {
  try {
    localSigning = parseEnv(await readFile(resolve(root, '.secrets/android-release.env'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const buildEnv = { ...localSigning, ...process.env };
const signed = Boolean(
  buildEnv.DACIANA_ANDROID_KEYSTORE &&
  buildEnv.DACIANA_ANDROID_KEY_ALIAS &&
  buildEnv.DACIANA_ANDROID_STORE_PASSWORD &&
  buildEnv.DACIANA_ANDROID_KEY_PASSWORD,
);
if (task !== 'assembleDebug' && (!signed || !existsSync(buildEnv.DACIANA_ANDROID_KEYSTORE)))
  throw new Error(
    'A release upload keystore and all signing credentials are required. No unsigned Play bundle will be produced.',
  );
const sdk =
  process.env.DACIANA_ANDROID_SDK ||
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  join(homedir(), 'Library/Android/sdk');
if (!existsSync(sdk)) throw new Error('Set ANDROID_HOME to an installed Android SDK.');
const javaCandidates = [
  process.env.DACIANA_JAVA_HOME,
  '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
  process.env.JAVA_HOME,
  '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
  '/usr/lib/jvm/java-21-openjdk-amd64',
].filter(Boolean);
const javaHome = javaCandidates.find((home) => {
  if (!existsSync(join(home, 'bin/java'))) return false;
  const result = spawnSync(join(home, 'bin/java'), ['-version'], { encoding: 'utf8' });
  return /version "21[.\"]/.test(result.stderr + result.stdout);
});
if (!javaHome) throw new Error('Install JDK 21 or set DACIANA_JAVA_HOME to its directory.');
await writeFile(
  resolve(root, 'android/local.properties'),
  `sdk.dir=${sdk.replaceAll('\\', '\\\\')}\n`,
);
console.log(`Building Daciana Android (${task}) with JDK 21.`);
const child = spawn(
  process.platform === 'win32' ? 'gradlew.bat' : './gradlew',
  [task, '--console=plain', '--no-daemon', '--max-workers=2'],
  {
    cwd: resolve(root, 'android'),
    stdio: 'inherit',
    env: { ...buildEnv, JAVA_HOME: javaHome, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk },
  },
);
const exitCode = await new Promise((resolveCode, reject) => {
  child.once('error', reject);
  child.once('exit', (code) => resolveCode(code ?? 1));
});
if (exitCode !== 0) process.exit(exitCode);
const output =
  task === 'assembleDebug'
    ? ['apk/debug/app-debug.apk', 'daciana-debug.apk']
    : task === 'bundleRelease'
      ? ['bundle/release/app-release.aab', `daciana-release${signed ? '' : '-unsigned'}.aab`]
      : [
          `apk/release/app-release${signed ? '' : '-unsigned'}.apk`,
          `daciana-release${signed ? '' : '-unsigned'}.apk`,
        ];
await mkdir(resolve(root, 'artifacts'), { recursive: true });
await copyFile(
  resolve(root, 'android/app/build/outputs', output[0]),
  resolve(root, 'artifacts', output[1]),
);
console.log(`Built artifacts/${output[1]}`);
