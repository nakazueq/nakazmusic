using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Threading;
using System.Windows.Forms;

// Заставка Sonara на время запуска: окно WebView2 создаётся долго (иногда десятки секунд), и всё это время программа
// занята и не может показать ничего своего. Заставка это отдельный крошечный процесс без WebView2 и без сети.
// Аргументы: <текст> <dark|light>. Закрывается по строке «close» в stdin, при закрытии stdin (родитель умер) или через 2 минуты.
public class Splash : Form {
  readonly string text;
  readonly bool dark;
  float angle;
  public Splash(string text, bool dark) {
    this.text = text; this.dark = dark;
    FormBorderStyle = FormBorderStyle.None;
    StartPosition = FormStartPosition.CenterScreen;
    ClientSize = new Size(380, 230);
    ShowInTaskbar = false;
    TopMost = true;
    DoubleBuffered = true;
    BackColor = dark ? Color.FromArgb(28, 28, 30) : Color.FromArgb(244, 244, 247);
    System.Windows.Forms.Timer t = new System.Windows.Forms.Timer { Interval = 30 };
    t.Tick += delegate { angle = (angle + 9) % 360; Invalidate(new Rectangle(ClientSize.Width / 2 - 14, 168, 28, 28)); };
    t.Start();
  }
  protected override void OnPaint(PaintEventArgs e) {
    Graphics g = e.Graphics;
    g.SmoothingMode = SmoothingMode.AntiAlias;
    Color fg = dark ? Color.FromArgb(245, 245, 247) : Color.FromArgb(28, 28, 30);
    Color dim = dark ? Color.FromArgb(142, 142, 147) : Color.FromArgb(99, 99, 102);
    // логотип: нота из icon.svg (сетка 24x24, масштаб 3)
    float s = 3f, ox = ClientSize.Width / 2f - 12f * s, oy = 34f;
    using (Pen p = new Pen(fg, 2f * s) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round })
    using (Brush b = new SolidBrush(fg)) {
      g.DrawLines(p, new PointF[] { new PointF(ox + 9 * s, oy + 17.5f * s), new PointF(ox + 9 * s, oy + 6.6f * s), new PointF(ox + 19 * s, oy + 4.2f * s), new PointF(ox + 19 * s, oy + 15.1f * s) });
      g.FillEllipse(b, ox + (6.6f - 2.6f) * s, oy + (17.6f - 2.6f) * s, 5.2f * s, 5.2f * s);
      g.FillEllipse(b, ox + (16.6f - 2.6f) * s, oy + (15.1f - 2.6f) * s, 5.2f * s, 5.2f * s);
    }
    using (Font f = new Font("Segoe UI Semibold", 11f))
    using (Brush b = new SolidBrush(dim)) {
      SizeF sz = g.MeasureString(text, f);
      g.DrawString(text, f, b, (ClientSize.Width - sz.Width) / 2f, 132f);
    }
    // маленький индикатор
    using (Pen p = new Pen(fg, 2.4f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
      g.DrawArc(p, ClientSize.Width / 2f - 9f, 173f, 18f, 18f, angle, 100f);
  }
  [STAThread]
  public static void Main(string[] args) {
    string text = args.Length > 0 ? args[0] : "Starting...";
    bool dark = args.Length < 2 || args[1] != "light";
    Application.EnableVisualStyles();
    Splash f = new Splash(text, dark);
    Thread reader = new Thread(delegate () {
      try {
        System.IO.StreamReader r = new System.IO.StreamReader(Console.OpenStandardInput());
        string l;
        while ((l = r.ReadLine()) != null) { if (l.Trim().Trim((char)0xFEFF).StartsWith("close")) break; }
      } catch { return; }   // stdin нет (запуск вручную): закроемся по таймеру
      for (int i = 0; i < 100 && !f.IsHandleCreated; i++) Thread.Sleep(50);
      try { f.BeginInvoke(new MethodInvoker(delegate { Application.Exit(); })); } catch { }
    });
    reader.IsBackground = true; reader.Start();
    System.Windows.Forms.Timer limit = new System.Windows.Forms.Timer { Interval = 120000 };
    limit.Tick += delegate { Application.Exit(); };
    limit.Start();
    Application.Run(f);
  }
}
