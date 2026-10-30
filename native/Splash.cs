using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Threading;
using System.Windows.Forms;

// Заставка nakazmusic на время запуска: окно WebView2 создаётся долго (иногда десятки секунд), и всё это время программа
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
  static GraphicsPath RoundRect(float x, float y, float w, float h, float r) {
    GraphicsPath p = new GraphicsPath(); float d = r * 2;
    p.AddArc(x, y, d, d, 180, 90); p.AddArc(x + w - d, y, d, d, 270, 90); p.AddArc(x + w - d, y + h - d, d, d, 0, 90); p.AddArc(x, y + h - d, d, d, 90, 90); p.CloseFigure();
    return p;
  }
  protected override void OnPaint(PaintEventArgs e) {
    Graphics g = e.Graphics;
    g.SmoothingMode = SmoothingMode.AntiAlias;
    Color fg = dark ? Color.FromArgb(245, 245, 247) : Color.FromArgb(28, 28, 30);
    Color dim = dark ? Color.FromArgb(142, 142, 147) : Color.FromArgb(99, 99, 102);
    // логотип: иконка приложения (сетка 100x100, масштаб 0.76), светлая плитка с буквой N и розовой точкой
    float k = 0.76f, ox = ClientSize.Width / 2f - 50f * k, oy = 30f;
    using (GraphicsPath tile = RoundRect(ox, oy, 100f * k, 100f * k, 24f * k))
    using (Brush tb = new SolidBrush(Color.FromArgb(245, 240, 232))) g.FillPath(tb, tile);
    using (Pen p = new Pen(Color.FromArgb(23, 20, 31), 10f * k) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round })
      g.DrawLines(p, new PointF[] { new PointF(ox + 32 * k, oy + 72 * k), new PointF(ox + 32 * k, oy + 34 * k), new PointF(ox + 64 * k, oy + 72 * k), new PointF(ox + 64 * k, oy + 34 * k) });
    using (Brush pb = new SolidBrush(Color.FromArgb(236, 72, 153))) g.FillEllipse(pb, ox + 70 * k, oy + 18 * k, 14f * k, 14f * k);
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
