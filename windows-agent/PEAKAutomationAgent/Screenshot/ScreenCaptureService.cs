using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace PEAKAutomationAgent.Screenshot
{
    /// <summary>
    /// Real Windows GDI Screen and Window Capture Service.
    /// Captures actual pixel buffers from the Windows desktop. No simulated bitmaps.
    /// </summary>
    public class ScreenCaptureService
    {
        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr FindWindow(string? lpClassName, string lpWindowName);

        [DllImport("user32.dll")]
        private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        /// <summary>
        /// Captures the pixel buffer of the specified window or foreground window.
        /// </summary>
        public string CaptureActiveWindowBase64(string windowTitle = "Prime Global Asset", string propertyNo = "", string step = "")
        {
            IntPtr hWnd = FindWindow(null, windowTitle);
            if (hWnd == IntPtr.Zero)
            {
                hWnd = GetForegroundWindow();
            }

            if (hWnd == IntPtr.Zero)
            {
                throw new InvalidOperationException($"Cannot capture window: Window '{windowTitle}' not found and no foreground window available.");
            }

            if (!GetWindowRect(hWnd, out RECT rect))
            {
                throw new InvalidOperationException($"GetWindowRect failed for window handle {hWnd}.");
            }

            int width = rect.Right - rect.Left;
            int height = rect.Bottom - rect.Top;

            if (width <= 0 || height <= 0)
            {
                throw new InvalidOperationException($"Invalid window dimensions for capture: {width}x{height}. Window may be minimized.");
            }

            try
            {
                using var bitmap = new Bitmap(width, height, PixelFormat.Format32bppArgb);
                using (var g = Graphics.FromImage(bitmap))
                {
                    g.CopyFromScreen(rect.Left, rect.Top, 0, 0, new Size(width, height), CopyPixelOperation.SourceCopy);
                }

                using var ms = new MemoryStream();
                bitmap.Save(ms, ImageFormat.Png);
                return Convert.ToBase64String(ms.ToArray());
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Real GDI screen capture failed on Windows host: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Captures the primary desktop screen.
        /// </summary>
        public string CapturePrimaryScreenBase64()
        {
            var bounds = Screen.PrimaryScreen?.Bounds ?? Rectangle.Empty;
            if (bounds.Width <= 0 || bounds.Height <= 0)
            {
                throw new InvalidOperationException("No active display screen detected on host system.");
            }

            try
            {
                using var bitmap = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format32bppArgb);
                using (var g = Graphics.FromImage(bitmap))
                {
                    g.CopyFromScreen(bounds.X, bounds.Y, 0, 0, bounds.Size, CopyPixelOperation.SourceCopy);
                }

                using var ms = new MemoryStream();
                bitmap.Save(ms, ImageFormat.Png);
                return Convert.ToBase64String(ms.ToArray());
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Failed to capture primary screen: {ex.Message}", ex);
            }
        }
    }
}
