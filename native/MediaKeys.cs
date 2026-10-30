using System;
using System.Threading;
using System.Windows.Forms;
using System.Runtime.InteropServices;

// Помощник глобальных медиаклавиш Windows. Одни и те же исходники:
//  1) при сборке компилируются в assets\mkhelper.exe (без PowerShell, антивирусы такое не трогают);
//  2) если exe нет, mediakeys.js подкладывает этот текст в PowerShell (Add-Type) как запасной путь.
// Протокол: пишет в stdout «READY», «OK|FAIL|OFF имя» и «KEY имя»; читает из stdin «on» и «off».
public class MKWin : NativeWindow {
  [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr h, int id, uint mod, uint vk);
  [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr h, int id);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, int msg, IntPtr w, IntPtr l);
  static readonly uint[] VK = { 0xB3, 0xB0, 0xB1, 0xB2 };
  static readonly string[] NM = { "play", "next", "prev", "stop" };
  bool[] reg = new bool[4];
  public MKWin() { CreateParams cp = new CreateParams(); cp.Parent = (IntPtr)(-3); CreateHandle(cp); }
  void Set(bool on) {
    for (int i = 0; i < 4; i++) {
      if (on && !reg[i]) { reg[i] = RegisterHotKey(Handle, i + 1, 0x4000, VK[i]); Console.WriteLine((reg[i] ? "OK " : "FAIL ") + NM[i]); }
      else if (!on && reg[i]) { UnregisterHotKey(Handle, i + 1); reg[i] = false; Console.WriteLine("OFF " + NM[i]); }
    }
  }
  protected override void WndProc(ref Message m) {
    if (m.Msg == 0x312) { int id = m.WParam.ToInt32(); if (id >= 1 && id <= 4) Console.WriteLine("KEY " + NM[id - 1]); }
    else if (m.Msg == 0x8001) Set(m.WParam.ToInt32() == 1);
    else if (m.Msg == 0x8002) Application.ExitThread();
    base.WndProc(ref m);
  }
  public static void Run() {
    MKWin w = new MKWin();
    Thread t = new Thread(() => {
      string l;
      while ((l = Console.ReadLine()) != null) { if (l == "on") PostMessage(w.Handle, 0x8001, (IntPtr)1, IntPtr.Zero); else if (l == "off") PostMessage(w.Handle, 0x8001, IntPtr.Zero, IntPtr.Zero); }
      PostMessage(w.Handle, 0x8002, IntPtr.Zero, IntPtr.Zero);
    });
    t.IsBackground = true; t.Start();
    Console.WriteLine("READY");
    Application.Run();
  }
  [STAThread] public static void Main() { Run(); }
}
