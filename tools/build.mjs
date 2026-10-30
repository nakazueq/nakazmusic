// Сборка Sonara.exe: иконка из SVG -> pkg с подменой иконки и версии в базовом бинарнике
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, writeFileSync, writeSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ResEdit from 'resedit';
import { makeIcons } from './make-icon.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const NAME = 'Sonara';
const TARGET = 'node22-win-x64';
const outExe = resolve(root, '..', NAME + '.exe');
const buildDir = join(root, 'build');
const pkgCli = join(root, 'node_modules', '@yao-pkg', 'pkg', 'lib-es5', 'bin.js');

const run = (args, env = {}) => execFileSync(process.execPath, [pkgCli, ...args], { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });

// базовый бинарник Node, который pkg кладёт в кэш; если его ещё нет, pkg скачает его обычной сборкой
function findBase() {
  const cache = process.env.PKG_CACHE_PATH || join(homedir(), '.pkg-cache');
  const find = () => {
    if (!existsSync(cache)) return null;
    const hits = [];
    for (const d of readdirSync(cache)) {
      const dir = join(cache, d);
      try { for (const f of readdirSync(dir)) if (/^fetched-v22.*-win-x64$/.test(f)) hits.push(join(dir, f)); } catch {}
    }
    return hits.sort().pop() || null;
  };
  return find() || (run(['.', '--targets', TARGET, '--output', join(buildDir, 'probe.exe')]), find());
}

function patch(basePath, icoPath, outPath) {
  const exe = ResEdit.NtExecutable.from(readFileSync(basePath), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);

  // иконка: заменяем группу, которая есть в Node, либо создаём новую
  const ico = ResEdit.Data.IconFile.from(readFileSync(icoPath));
  const icons = ico.icons.map((i) => i.data);
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const targets = groups.length ? groups.map((g) => [g.id, g.lang]) : [[1, 1033]];
  for (const [id, lang] of targets) ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, lang, icons);

  // информация о версии: имя Sonara, версия из package.json
  const [maj, min = 0, pat = 0] = String(pkgJson.version).split('.').map((n) => parseInt(n, 10) || 0);
  const ver = `${maj}.${min}.${pat}.0`;
  const lang = 1033, codepage = 1200;
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0] || ResEdit.Resource.VersionInfo.createEmpty();
  for (const l of vi.getAllLanguagesForStringValues()) vi.removeAllStringValues(l);
  vi.replaceAvailableLanguages([{ lang, codepage }]);
  vi.setFileVersion(maj, min, pat, 0, lang);
  vi.setProductVersion(maj, min, pat, 0, lang);
  vi.setStringValues({ lang, codepage }, {
    FileDescription: NAME,
    ProductName: NAME,
    InternalName: NAME,
    OriginalFilename: NAME + '.exe',
    CompanyName: NAME,
    LegalCopyright: pkgJson.license ? `${NAME}, ${pkgJson.license}` : NAME,
    FileVersion: ver,
    ProductVersion: ver,
  });
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  writeFileSync(outPath, Buffer.from(exe.generate()));
}

// помощник медиаклавиш: обычный маленький exe из native/MediaKeys.cs (компилятор csc входит в Windows). Без него плеер откатится на PowerShell.
function buildMediaHelper() {
  const csc = ['Framework64', 'Framework'].map((f) => join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', f, 'v4.0.30319', 'csc.exe')).find(existsSync);
  const out = join(root, 'assets', 'mkhelper.exe');
  if (!csc) { console.warn('csc.exe not found: media keys will work through PowerShell'); return; }
  execFileSync(csc, ['/nologo', '/target:exe', '/optimize+', '/debug-', '/reference:System.Windows.Forms.dll', '/out:' + out, join(root, 'native', 'MediaKeys.cs'), join(root, 'native', 'AssemblyInfo.cs')], { stdio: 'inherit' });
  console.log('media keys helper: %s', out);
}

mkdirSync(buildDir, { recursive: true });
buildMediaHelper();
console.log('1/3 icon from SVG');
const ico = await makeIcons();

console.log('2/3 icon and version %s into the base binary', pkgJson.version);
const patched = join(buildDir, 'node-base-win-x64.exe');
patch(findBase(), ico, patched);

// subsystem Windows GUI: у exe нет консоли, окно cmd не появляется (лог пишется в player.log)
function setGuiSubsystem(file) {
  const fd = openSync(file, 'r+');
  try {
    const head = Buffer.alloc(4);
    readSync(fd, head, 0, 4, 0x3c);
    const pe = head.readUInt32LE(0);
    const sig = Buffer.alloc(4);
    readSync(fd, sig, 0, 4, pe);
    if (sig.toString('latin1') !== 'PE\0\0') throw new Error('not a PE file: ' + file);
    const sub = Buffer.alloc(2);
    sub.writeUInt16LE(2);   // IMAGE_SUBSYSTEM_WINDOWS_GUI (было 3, консоль)
    writeSync(fd, sub, 0, 2, pe + 24 + 68);
  } finally { closeSync(fd); }
}

console.log('3/3 pkg -> %s', outExe);
run(['.', '--targets', TARGET, '--output', outExe], { PKG_NODE_PATH: patched });
setGuiSubsystem(outExe);
console.log('\nDone: %s v%s', outExe, pkgJson.version);
