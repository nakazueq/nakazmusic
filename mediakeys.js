'use strict';
// Глобальные медиаклавиши Windows (play/pause, следующий, предыдущий, стоп), которые работают при свёрнутом окне и в трее.
// У Node нет доступа к RegisterHotKey, поэтому запускаем крошечного помощника: скрытый PowerShell с маленьким C#-классом.
// Помощник сообщает о нажатиях строками «KEY play|next|prev|stop», а мы пишем ему «on» и «off»:
// клавиши занимаем только пока у плеера есть трек, иначе их забрали бы у других программ (Spotify, браузер).
const { spawn } = require('child_process');

const CS = [
  'using System;',
  'using System.Threading;',
  'using System.Windows.Forms;',
  'using System.Runtime.InteropServices;',
  'public class MKWin : NativeWindow {',
  '  [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr h, int id, uint mod, uint vk);',
  '  [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr h, int id);',
  '  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, int msg, IntPtr w, IntPtr l);',
  '  static readonly uint[] VK = { 0xB3, 0xB0, 0xB1, 0xB2 };',
  '  static readonly string[] NM = { "play", "next", "prev", "stop" };',
  '  bool[] reg = new bool[4];',
  '  public MKWin() { CreateParams cp = new CreateParams(); cp.Parent = (IntPtr)(-3); CreateHandle(cp); }',
  '  void Set(bool on) {',
  '    for (int i = 0; i < 4; i++) {',
  '      if (on && !reg[i]) { reg[i] = RegisterHotKey(Handle, i + 1, 0x4000, VK[i]); Console.WriteLine((reg[i] ? "OK " : "FAIL ") + NM[i]); }',
  '      else if (!on && reg[i]) { UnregisterHotKey(Handle, i + 1); reg[i] = false; Console.WriteLine("OFF " + NM[i]); }',
  '    }',
  '  }',
  '  protected override void WndProc(ref Message m) {',
  '    if (m.Msg == 0x312) { int id = m.WParam.ToInt32(); if (id >= 1 && id <= 4) Console.WriteLine("KEY " + NM[id - 1]); }',
  '    else if (m.Msg == 0x8001) Set(m.WParam.ToInt32() == 1);',
  '    else if (m.Msg == 0x8002) Application.ExitThread();',
  '    base.WndProc(ref m);',
  '  }',
  '  public static void Run() {',
  '    MKWin w = new MKWin();',
  '    Thread t = new Thread(() => {',
  '      string l;',
  '      while ((l = Console.ReadLine()) != null) { if (l == "on") PostMessage(w.Handle, 0x8001, (IntPtr)1, IntPtr.Zero); else if (l == "off") PostMessage(w.Handle, 0x8001, IntPtr.Zero, IntPtr.Zero); }',
  '      PostMessage(w.Handle, 0x8002, IntPtr.Zero, IntPtr.Zero);',
  '    });',
  '    t.IsBackground = true; t.Start();',
  '    Console.WriteLine("READY");',
  '    Application.Run();',
  '  }',
  '}',
].join('\n');

const PS = ["$ProgressPreference = 'SilentlyContinue'", 'Add-Type -AssemblyName System.Windows.Forms', "$cs = @'", CS, "'@", 'Add-Type -TypeDefinition $cs -ReferencedAssemblies System.Windows.Forms -Language CSharp', '[MKWin]::Run()'].join('\r\n');

class MediaKeys {
  constructor(onKey, log) {
    this.onKey = onKey;
    this.log = log || (() => {});
    this.child = null;
    this.ready = false;
    this.want = false;
    this.sent = null;
    this.reg = {};          // имя клавиши -> true (занята нами) или false (занята другой программой)
    this.starts = 0;
  }
  start() {
    if (this.child || process.platform !== 'win32' || this.starts >= 3) return;
    this.starts++;
    let c;
    try {
      c = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(PS, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) { this.log('медиаклавиши не запустились', e.message); return; }
    this.child = c;
    process.once('exit', () => { try { c.kill(); } catch {} });   // при выходе помощник не должен остаться висеть
    let buf = '';
    c.stdout.setEncoding('utf8');
    c.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) this._line(line); }
    });
    c.stderr.on('data', (d) => { const s = String(d).trim(); if (s && !/^#< CLIXML|^<Objs/.test(s)) this.log('медиаклавиши:', s.slice(0, 200)); });
    c.stdin.on('error', () => {});
    c.on('error', (e) => this.log('медиаклавиши', e.message));
    c.on('exit', () => { if (this.child === c) { this.child = null; this.ready = false; this.sent = null; this.reg = {}; } });
  }
  _line(line) {
    if (line === 'READY') { this.ready = true; this._push(); return; }
    const m = line.match(/^(OK|FAIL|OFF|KEY) (\w+)$/);
    if (!m) return;
    if (m[1] === 'KEY') { try { this.onKey(m[2]); } catch (e) { this.log('медиаклавиша', e.message); } return; }
    if (m[1] === 'OFF') { delete this.reg[m[2]]; return; }
    this.reg[m[2]] = m[1] === 'OK';
    if (m[1] === 'FAIL') this.log(`медиаклавиша ${m[2]} занята другой программой`);
  }
  _push() {
    if (!this.ready || !this.child || this.sent === this.want) return;
    this.sent = this.want;
    try { this.child.stdin.write(this.want ? 'on\n' : 'off\n'); } catch {}
  }
  // клавиши нужны, только пока у плеера есть трек
  setActive(on) { this.want = !!on; this._push(); }
  stop() {
    const c = this.child;
    this.child = null;
    this.ready = false;
    if (c) { try { c.stdin.end(); } catch {} setTimeout(() => { try { c.kill(); } catch {} }, 800).unref(); }
  }
  status() { return { running: !!this.child && this.ready, active: this.sent === true, keys: { ...this.reg } }; }
}

module.exports = { MediaKeys };
