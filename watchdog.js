'use strict';
// Сторож окна: отдельный маленький процесс (тот же exe с SONARA_WATCH_PID). Иногда при старте окно WebView2 зависает так,
// что не работает и сам сервер плеера, поэтому проверять изнутри нельзя. Сторож ждёт, пока страница хоть раз обратится к серверу;
// если за 25 секунд этого не случилось, закрывает зависший плеер (его окна WebView2 закрываются сами, без /T: иначе taskkill убил бы и сторожа) и запускает новый (до двух раз).
const http = require('http');
const { spawn, execFile } = require('child_process');

const pid = Number(process.env.SONARA_WATCH_PID);
const port = Number(process.env.PLAYER_PORT) || 3000;
const restarts = Number(process.env.SONARA_RESTARTS) || 0;
const LIMIT = Number(process.env.SONARA_WATCH_MS) || 25000;
const started = Date.now();

function ping(cb) {
  const req = http.get({ host: '127.0.0.1', port, path: '/api/ping?probe=1', timeout: 2000 }, (res) => {
    let body = '';
    res.on('data', (c) => (body += c));
    res.on('end', () => { try { cb(JSON.parse(body)); } catch { cb(null); } });
  });
  req.on('error', () => cb(null));
  req.on('timeout', () => { req.destroy(); cb(null); });
}
const alive = () => { try { process.kill(pid, 0); return true; } catch { return false; } };

function restart() {
  if (restarts >= 2) process.exit(0);   // два перезапуска не помогли: оставляем как есть, дальше решает человек
  execFile('taskkill', ['/F', '/PID', String(pid)], { windowsHide: true }, () => {
    setTimeout(() => {
      const env = { ...process.env, SONARA_RESTARTS: String(restarts + 1) };
      delete env.SONARA_WATCH_PID;
      try { spawn(process.execPath, process.pkg ? process.argv.slice(2) : process.argv.slice(1), { detached: true, stdio: 'ignore', env }).unref(); } catch {}
      process.exit(0);
    }, 1500);
  });
}

const timer = setInterval(() => {
  if (!alive()) process.exit(0);
  ping((r) => {
    if (r && r.seen) process.exit(0);   // окно открылось и страница работает
    if (Date.now() - started > LIMIT) { clearInterval(timer); restart(); }
  });
}, 2000);
