import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { existsSync, openSync, closeSync } from 'node:fs';
import { readFile, mkdir, cp, writeFile, copyFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const task = process.argv[2];
if (process.platform !== 'darwin') throw new Error('iOS builds require macOS with Xcode.');
if (!['simulator', 'test', 'archive', 'archive-unsigned'].includes(task))
  throw new Error('Choose simulator, test, archive or archive-unsigned.');
const app = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
let local = {};
try {
  local = parseEnv(await readFile(resolve(root, '.secrets/ios-release.env'), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const env = { ...local, ...process.env };
const signed = task === 'archive';
const simulator = task === 'simulator' || task === 'test';
const team = env.DACIANA_IOS_TEAM_ID || 'VJ6CZ336M8';
const number = env.DACIANA_IOS_BUILD_NUMBER || '1';
if (!/^[A-Z0-9]{10}$/.test(team)) throw new Error('Set a valid DACIANA_IOS_TEAM_ID.');
if (!/^[1-9]\d*$/.test(number)) throw new Error('Use a positive DACIANA_IOS_BUILD_NUMBER.');
const sdk = spawnSync(
  'xcrun',
  ['--sdk', simulator ? 'iphonesimulator' : 'iphoneos', '--show-sdk-version'],
  { encoding: 'utf8' },
);
if (sdk.status !== 0) throw new Error('Select the full Xcode installation with xcode-select.');
const out = resolve(root, 'artifacts/ios');
await mkdir(out, { recursive: true });
const archive = resolve(
  out,
  `Daciana-${app.version}-${number}${task === 'archive-unsigned' ? '-unsigned' : ''}.xcarchive`,
);
if (!simulator && existsSync(archive))
  throw new Error(
    'This archive already exists. Increase DACIANA_IOS_BUILD_NUMBER for a new archive.',
  );
const args = [
  '-project',
  'ios/App/App.xcodeproj',
  '-scheme',
  'App',
  '-configuration',
  simulator ? 'Debug' : 'Release',
  '-derivedDataPath',
  'ios/build/DerivedData',
  '-clonedSourcePackagesDirPath',
  'ios/SourcePackages',
  '-destination',
  task === 'test'
    ? `platform=iOS Simulator,${env.DACIANA_IOS_SIMULATOR_ID ? `id=${env.DACIANA_IOS_SIMULATOR_ID}` : 'name=iPhone 17 Pro'}`
    : simulator
      ? 'generic/platform=iOS Simulator'
      : 'generic/platform=iOS',
  '-jobs',
  '2',
  `MARKETING_VERSION=${app.version}`,
  `CURRENT_PROJECT_VERSION=${number}`,
];
const resultBundle = resolve(out, `NativeSmoke-${Date.now()}.xcresult`);
if (simulator) {
  args.push('-sdk', 'iphonesimulator', 'CODE_SIGNING_ALLOWED=NO');
  if (task === 'test')
    args.push('-parallel-testing-enabled', 'NO', '-resultBundlePath', resultBundle, 'test');
  else args.push('build');
} else {
  if (signed) {
    const profile =
      env.DACIANA_IOS_PROFILE_PATH || resolve(root, '.secrets/ios/AppStore.mobileprovision');
    if (!existsSync(profile))
      throw new Error(
        'Save an App Store Connect provisioning profile at .secrets/ios/AppStore.mobileprovision. Simulator and unsigned archive builds do not require a profile.',
      );
    const decoded = execFileSync('security', ['cms', '-D', '-i', profile]);
    const field = (key) => {
      const result = spawnSync('plutil', ['-extract', key, 'raw', '-o', '-', '-'], {
        input: decoded,
        encoding: 'utf8',
      });
      return result.status === 0 ? result.stdout.trim() : null;
    };
    const uuid = field('UUID');
    const hasField = (key) =>
      spawnSync('plutil', ['-extract', key, 'xml1', '-o', '-', '-'], {
        input: decoded,
        stdio: ['pipe', 'ignore', 'ignore'],
      }).status === 0;
    if (
      !uuid ||
      !/^[A-Fa-f0-9-]{36}$/.test(uuid) ||
      field('TeamIdentifier.0') !== team ||
      field('Entitlements.application-identifier') !== `${team}.com.luwangtech.daciana` ||
      field('Entitlements.get-task-allow') !== 'false' ||
      hasField('ProvisionedDevices') ||
      field('ProvisionsAllDevices') === 'true'
    )
      throw new Error(
        'Use an App Store distribution profile for the Daciana bundle ID and selected team.',
      );
    const expires = field('ExpirationDate');
    if (!expires || !Number.isFinite(Date.parse(expires)) || Date.parse(expires) <= Date.now())
      throw new Error('The provisioning profile is expired or its expiration cannot be verified.');
    const directory = resolve(homedir(), 'Library/Developer/Xcode/UserData/Provisioning Profiles');
    await mkdir(directory, { recursive: true });
    await copyFile(profile, resolve(directory, `${uuid}.mobileprovision`));
    args.push(
      `DEVELOPMENT_TEAM=${team}`,
      'CODE_SIGN_STYLE=Manual',
      'CODE_SIGN_IDENTITY=Apple Distribution',
      `PROVISIONING_PROFILE_SPECIFIER=${uuid}`,
    );
  } else args.push('CODE_SIGNING_ALLOWED=NO');
  args.push('-archivePath', archive, 'archive');
}
const log = resolve(out, `build-${task}.log`);
const fd = openSync(log, 'w');
console.log(`Building Daciana ${app.version} (${number}) for iOS ${task}. Log: ${log}`);
let code;
try {
  const child = spawn('xcodebuild', args, { cwd: root, env, stdio: ['ignore', fd, fd] });
  code = await new Promise((resolveCode, reject) => {
    child.once('error', reject);
    child.once('exit', (value) => resolveCode(value ?? 1));
  });
} finally {
  closeSync(fd);
}
if (code !== 0) {
  console.error((await readFile(log, 'utf8')).split('\n').slice(-35).join('\n'));
  process.exit(code);
}
let artifact = task === 'test' ? resultBundle : archive;
if (task === 'simulator') {
  artifact = resolve(out, 'Daciana-simulator.app');
  await cp(
    resolve(root, 'ios/build/DerivedData/Build/Products/Debug-iphonesimulator/App.app'),
    artifact,
    { recursive: true, force: true },
  );
}
await writeFile(
  resolve(out, `build-${task}.json`),
  JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      app: 'Daciana',
      bundleId: 'com.luwangtech.daciana',
      version: app.version,
      buildNumber: Number(number),
      target: task,
      signed,
      artifact,
      log,
      distributionStatus:
        task === 'test'
          ? 'Simulator UI test results'
          : task === 'simulator'
            ? 'Simulator only; not installable on an iPhone'
            : signed
              ? 'Signed archive only; validate App Store readiness before uploading'
              : 'Unsigned archive; not installable or uploadable',
    },
    null,
    2,
  ) + '\n',
);
console.log(`Built ${artifact}`);
