// Релизный архив: Sonara.exe (должен быть уже собран build.bat) + README, плюс контрольная сумма SHA-256.
// Результат кладём в ../release, этой папки в репозитории нет.
import { execFileSync } from 'node:child_process';
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const exe = resolve(root, '..', 'Sonara.exe');
if (!existsSync(exe)) { console.error('Нет Sonara.exe: сначала запустите build.bat'); process.exit(1); }

const outDir = resolve(root, '..', 'release');
const stage = join(outDir, 'stage');
const zipName = `Sonara-${pkg.version}-win-x64.zip`;
const zip = join(outDir, zipName);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
copyFileSync(exe, join(stage, 'Sonara.exe'));
copyFileSync(join(root, 'README.md'), join(stage, 'README.md'));
rmSync(zip, { force: true });

// tar.exe есть во всех современных Windows и умеет делать zip
execFileSync(process.env.SystemRoot ? join(process.env.SystemRoot, 'System32', 'tar.exe') : 'tar', ['-a', '-c', '-f', zip, '-C', stage, 'Sonara.exe', 'README.md'], { stdio: 'inherit' });
rmSync(stage, { recursive: true, force: true });

const hash = createHash('sha256');
await new Promise((ok, fail) => createReadStream(zip).on('data', (d) => hash.update(d)).on('end', ok).on('error', fail));
const sum = hash.digest('hex');
writeFileSync(join(outDir, zipName + '.sha256'), `${sum}  ${zipName}\n`);
console.log('Готово: %s\nSHA-256: %s', zip, sum);
