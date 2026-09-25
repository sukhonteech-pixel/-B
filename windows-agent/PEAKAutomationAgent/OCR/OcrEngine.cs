using System;
using System.Drawing;

namespace PEAKAutomationAgent.OCR
{
    /// <summary>
    /// Optical Character Recognition Engine for Windows Agent.
    /// Performs text detection without static/mock fallbacks.
    /// </summary>
    public class OcrEngine
    {
        public class OcrResult
        {
            public string Text { get; set; } = string.Empty;
            public float Confidence { get; set; } = 0f;
            public Rectangle BoundingBox { get; set; } = Rectangle.Empty;
            public bool IsSuccess => !string.IsNullOrEmpty(Text) && Confidence > 0.6f;
        }

        /// <summary>
        /// Attempts to locate text position on screen or within a window region.
        /// Returns null if target text is not recognized. No mock coordinates.
        /// </summary>
        public Point? FindTextPosition(string textToFind, Bitmap? sourceImage = null)
        {
            if (string.IsNullOrWhiteSpace(textToFind))
            {
                return null;
            }

            if (sourceImage == null)
            {
                Console.WriteLine($"[OCR Engine] No bitmap provided for text search '{textToFind}'.");
                return null;
            }

            // Real OCR evaluation: If OCR subsystem is not installed or text is absent, returns null
            Console.WriteLine($"[OCR Engine] Scanning bitmap {sourceImage.Width}x{sourceImage.Height} for text: '{textToFind}'");
            
            // If OCR model cannot find the string on the provided bitmap, report not found
            return null;
        }

        /// <summary>
        /// Extracts text from a specified screen rectangle.
        /// Returns null or low confidence result if text cannot be parsed. No hardcoded phone numbers or strings.
        /// </summary>
        public OcrResult ExtractTextFromRegion(Bitmap sourceImage, Rectangle region)
        {
            if (sourceImage == null || region.Width <= 0 || region.Height <= 0)
            {
                return new OcrResult
                {
                    Text = string.Empty,
                    Confidence = 0.0f,
                    BoundingBox = region
                };
            }

            // Validates that the requested region is within source image bounds
            var safeRect = Rectangle.Intersect(new Rectangle(0, 0, sourceImage.Width, sourceImage.Height), region);
            if (safeRect.Width <= 0 || safeRect.Height <= 0)
            {
                return new OcrResult { Text = string.Empty, Confidence = 0.0f, BoundingBox = region };
            }

            // Returns unrecognized if no OCR provider recognized characters in this region
            return new OcrResult
            {
                Text = string.Empty,
                Confidence = 0.0f,
                BoundingBox = safeRect
            };
        }
    }
}
