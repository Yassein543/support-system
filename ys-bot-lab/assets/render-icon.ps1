$ErrorActionPreference = 'Stop'
$drawingAssembly = [System.Drawing.Bitmap].Assembly.Location
$assemblyDirectory = Split-Path $drawingAssembly
$assemblies = @($drawingAssembly, [System.Drawing.PointF].Assembly.Location, (Join-Path $assemblyDirectory 'System.Private.Windows.Core.dll'), (Join-Path $assemblyDirectory 'System.Private.Windows.GdiPlus.dll'))
Add-Type -ReferencedAssemblies $assemblies -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public static class YsLabIcon {
    static GraphicsPath Rounded(float x, float y, float w, float h, float r) {
        var p = new GraphicsPath();
        p.AddArc(x, y, 2*r, 2*r, 180, 90); p.AddArc(x+w-2*r, y, 2*r, 2*r, 270, 90);
        p.AddArc(x+w-2*r, y+h-2*r, 2*r, 2*r, 0, 90); p.AddArc(x, y+h-2*r, 2*r, 2*r, 90, 90);
        p.CloseFigure(); return p;
    }
    static GraphicsPath Shield() {
        var p = new GraphicsPath();
        p.AddPolygon(new PointF[] { new PointF(256,55), new PointF(419,119), new PointF(419,242), new PointF(405,307), new PointF(370,360), new PointF(320,404), new PointF(256,461), new PointF(192,404), new PointF(142,360), new PointF(107,307), new PointF(93,242), new PointF(93,119) });
        p.CloseFigure(); return p;
    }
    public static Bitmap Draw(int size) {
        var bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
        var g = Graphics.FromImage(bmp);
        g.SmoothingMode = SmoothingMode.AntiAlias; g.InterpolationMode = InterpolationMode.HighQualityBicubic; g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.ScaleTransform(size / 512f, size / 512f);
        using (var shape = Rounded(0,0,512,512,112)) using (var brush = new LinearGradientBrush(new Point(45,35),new Point(460,480),Color.FromArgb(255,16,44,42),Color.FromArgb(255,7,18,15))) g.FillPath(brush,shape);
        using (var brush = new SolidBrush(Color.FromArgb(24,39,210,168))) g.FillEllipse(brush,94,85,324,324);
        using (var shape=Shield()) using (var brush=new SolidBrush(Color.FromArgb(255,11,23,23))) using (var pen=new Pen(Color.FromArgb(255,43,199,160),12)) { g.FillPath(brush,shape); g.DrawPath(pen,shape); }
        using (var shape=Shield()) using (var brush=new SolidBrush(Color.FromArgb(255,16,35,38))) using (var pen=new Pen(Color.FromArgb(55,140,245,220),3)) { g.FillPath(brush,shape); g.DrawPath(pen,shape); }
        using (var shape=Rounded(133,144,246,190,28)) using (var brush=new LinearGradientBrush(new Point(145,142),new Point(365,330),Color.FromArgb(255,25,59,58),Color.FromArgb(255,16,30,41))) using (var pen=new Pen(Color.FromArgb(220,122,233,209),7)) { g.FillPath(brush,shape); g.DrawPath(pen,shape); }
        using (var pen=new Pen(Color.FromArgb(75,122,233,209),5)) g.DrawLine(pen,138,179,374,179);
        Color[] dots={Color.FromArgb(255,114,240,206),Color.FromArgb(255,130,185,255),Color.FromArgb(255,244,212,120)};
        for(int i=0;i<3;i++) using(var brush=new SolidBrush(dots[i])) g.FillEllipse(brush,157+i*21,157,12,12);
        using (var pen=new Pen(Color.FromArgb(255,126,242,215),18)) { pen.StartCap=LineCap.Round; pen.EndCap=LineCap.Round; pen.LineJoin=LineJoin.Round; g.DrawLines(pen,new PointF[]{new PointF(188,215),new PointF(230,253),new PointF(188,291)}); }
        using (var pen=new Pen(Color.FromArgb(255,112,183,255),18)) { pen.StartCap=LineCap.Round; pen.EndCap=LineCap.Round; g.DrawLine(pen,259,291,323,291); }
        using (var font=new Font("Segoe UI",49,FontStyle.Bold,GraphicsUnit.Pixel)) using (var brush=new SolidBrush(Color.FromArgb(255,221,255,247))) using (var format=new StringFormat()) { format.Alignment=StringAlignment.Center; format.LineAlignment=StringAlignment.Center; g.DrawString("YS",font,brush,new RectangleF(170,341,172,65),format); }
        using (var pen=new Pen(Color.FromArgb(255,50,205,169),6)) { pen.StartCap=LineCap.Round; pen.EndCap=LineCap.Round; g.DrawLine(pen,203,420,309,420); }
        g.Dispose(); return bmp;
    }
    public static void Save(string directory) {
        Directory.CreateDirectory(directory);
        using (var full=Draw(512)) full.Save(Path.Combine(directory,"ys-bot-lab.png"),ImageFormat.Png);
        int[] sizes={16,24,32,48,64,128,256}; byte[][] pngs=new byte[sizes.Length][];
        for(int i=0;i<sizes.Length;i++) using(var bmp=Draw(sizes[i])) using(var ms=new MemoryStream()){bmp.Save(ms,ImageFormat.Png);pngs[i]=ms.ToArray();}
        using(var file=File.Create(Path.Combine(directory,"ys-bot-lab.ico"))) using(var writer=new BinaryWriter(file)) {
            writer.Write((ushort)0); writer.Write((ushort)1); writer.Write((ushort)sizes.Length); int offset=6+16*sizes.Length;
            for(int i=0;i<sizes.Length;i++){int s=sizes[i];writer.Write((byte)(s==256?0:s));writer.Write((byte)(s==256?0:s));writer.Write((byte)0);writer.Write((byte)0);writer.Write((ushort)1);writer.Write((ushort)32);writer.Write(pngs[i].Length);writer.Write(offset);offset+=pngs[i].Length;}
            foreach(var png in pngs) writer.Write(png);
        }
    }
}
'@

[YsLabIcon]::Save((Join-Path $PSScriptRoot '.'))
