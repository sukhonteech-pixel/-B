using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Interop.UIAutomationClient;

namespace PEAKAutomationAgent.UIAutomation
{
    /// <summary>
    /// Production Windows UI Automation Service.
    /// Interacts directly with the Windows Accessibility / UI Automation tree of Prime Global Asset.
    /// No mock data, no fake returns.
    /// </summary>
    public class WindowsUIAutomationService
    {
        #region Win32 P/Invoke Definitions

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr FindWindow(string? lpClassName, string lpWindowName);

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [DllImport("user32.dll")]
        private static extern bool SetCursorPos(int X, int Y);

        [DllImport("user32.dll")]
        private static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);

        [DllImport("user32.dll")]
        private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        private const int SW_RESTORE = 9;
        private const int SW_SHOWNORMAL = 1;
        private const uint WM_CLOSE = 0x0010;
        private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const uint MOUSEEVENTF_LEFTUP = 0x0004;
        private const byte VK_RETURN = 0x0D;

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        #endregion

        private readonly IUIAutomation? _automation;
        private const int DefaultTimeoutMs = 5000;

        public WindowsUIAutomationService()
        {
            try
            {
                _automation = new CUIAutomationClass();
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine($"[UIAutomation] Notice: COM CUIAutomationClass initialization: {ex.Message}");
                Console.ResetColor();
                _automation = null;
            }
        }

        /// <summary>
        /// Finds the native window handle and restores/activates it.
        /// </summary>
        public bool BringWindowToFront(string windowTitle)
        {
            IntPtr hWnd = FindWindowHandle(windowTitle);
            if (hWnd == IntPtr.Zero)
            {
                Console.WriteLine($"[UIAutomation] Window '{windowTitle}' handle not found via Win32 FindWindow.");
                return false;
            }

            ShowWindow(hWnd, SW_RESTORE);
            bool success = SetForegroundWindow(hWnd);
            Thread.Sleep(300);
            return success;
        }

        public IntPtr FindWindowHandle(string windowTitle, string? processName = "PrimeGlobalAsset")
        {
            IntPtr hWnd = FindWindow(null, windowTitle);
            if (hWnd != IntPtr.Zero) return hWnd;

            if (!string.IsNullOrEmpty(processName))
            {
                var processes = Process.GetProcessesByName(processName);
                foreach (var p in processes)
                {
                    if (p.MainWindowHandle != IntPtr.Zero)
                    {
                        return p.MainWindowHandle;
                    }
                }
            }

            return IntPtr.Zero;
        }

        /// <summary>
        /// Retrieves the root UI Automation Element for the target window.
        /// </summary>
        public IUIAutomationElement? GetWindowElement(string windowTitle = "Prime Global Asset")
        {
            if (_automation == null) return null;

            IntPtr hWnd = FindWindowHandle(windowTitle);
            if (hWnd == IntPtr.Zero)
            {
                return null;
            }

            try
            {
                return _automation.ElementFromHandle(hWnd);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[UIAutomation] ElementFromHandle failed for {windowTitle}: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Finds an element matching either AutomationId or Name within the window.
        /// </summary>
        public IUIAutomationElement? FindElementByAutomationIdOrName(string automationId, string name, string windowTitle = "Prime Global Asset")
        {
            var windowElement = GetWindowElement(windowTitle);
            if (windowElement == null || _automation == null)
            {
                return null;
            }

            try
            {
                var idCondition = _automation.CreatePropertyCondition(UIA_PropertyIds.UIA_AutomationIdPropertyId, automationId);
                var nameCondition = _automation.CreatePropertyCondition(UIA_PropertyIds.UIA_NamePropertyId, name);
                var orCondition = _automation.CreateOrCondition(idCondition, nameCondition);

                return windowElement.FindFirst(TreeScope.TreeScope_Descendants, orCondition);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[UIAutomation] Search error for '{automationId}' / '{name}': {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Clicks an element by AutomationId or Name.
        /// First attempts UIAutomation InvokePattern. If not supported, calculates bounding box center and performs mouse click.
        /// Returns false if element is not found.
        /// </summary>
        public bool ClickElementByAutomationIdOrName(string automationId, string name, string windowTitle = "Prime Global Asset")
        {
            var element = FindElementByAutomationIdOrName(automationId, name, windowTitle);
            if (element == null)
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine($"[UIAutomation] Control '{automationId}' / '{name}' not found in '{windowTitle}'");
                Console.ResetColor();
                return false;
            }

            try
            {
                // Attempt 1: UI Automation InvokePattern
                var invokePattern = element.GetCurrentPattern(UIA_PatternIds.UIA_InvokePatternId) as IUIAutomationInvokePattern;
                if (invokePattern != null)
                {
                    invokePattern.Invoke();
                    Thread.Sleep(300);
                    return true;
                }
            }
            catch
            {
                // Fallback to bounding rect mouse click
            }

            try
            {
                // Attempt 2: Bounding Rectangle mouse click
                var rect = element.CurrentBoundingRectangle;
                int centerX = rect.left + ((rect.right - rect.left) / 2);
                int centerY = rect.top + ((rect.bottom - rect.top) / 2);

                if (centerX > 0 && centerY > 0)
                {
                    ClickRelative(centerX, centerY);
                    Thread.Sleep(300);
                    return true;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[UIAutomation] Mouse click on element failed: {ex.Message}");
            }

            return false;
        }

        /// <summary>
        /// Sets text on an edit control using ValuePattern or keyboard input.
        /// Throws exception if element cannot be found.
        /// </summary>
        public void SetTextBoxValue(string automationId, string text, string windowTitle = "Prime Global Asset")
        {
            var element = FindElementByAutomationIdOrName(automationId, automationId, windowTitle);
            if (element == null)
            {
                throw new InvalidOperationException($"Input element '{automationId}' was not found in '{windowTitle}'.");
            }

            try
            {
                var valuePattern = element.GetCurrentPattern(UIA_PatternIds.UIA_ValuePatternId) as IUIAutomationValuePattern;
                if (valuePattern != null)
                {
                    valuePattern.SetValue(text);
                    return;
                }
            }
            catch
            {
                // Fallback to focus and SendKeys
            }

            try
            {
                element.SetFocus();
                Thread.Sleep(100);
                SendKeys.SendWait("^a");
                Thread.Sleep(50);
                SendKeys.SendWait("{BACKSPACE}");
                Thread.Sleep(50);
                SendKeys.SendWait(text);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Failed to enter text into '{automationId}': {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Presses Enter on the currently focused control.
        /// </summary>
        public void PressEnter()
        {
            keybd_event(VK_RETURN, 0, 0, 0);
            Thread.Sleep(50);
            keybd_event(VK_RETURN, 0, 2, 0);
            Thread.Sleep(300);
        }

        /// <summary>
        /// Double clicks a DataGrid row matching the specified text.
        /// Throws KeyNotFoundException if row is not found.
        /// </summary>
        public void DoubleClickDataGridRow(string matchText, string windowTitle = "Prime Global Asset")
        {
            var windowElement = GetWindowElement(windowTitle);
            if (windowElement == null || _automation == null)
            {
                throw new InvalidOperationException($"Cannot find window '{windowTitle}' to locate DataGrid row '{matchText}'.");
            }

            var condition = _automation.CreatePropertyCondition(UIA_PropertyIds.UIA_NamePropertyId, matchText);
            var rowElement = windowElement.FindFirst(TreeScope.TreeScope_Descendants, condition);

            if (rowElement == null)
            {
                throw new KeyNotFoundException($"No DataGrid record found matching Property No: '{matchText}'.");
            }

            var rect = rowElement.CurrentBoundingRectangle;
            int centerX = rect.left + ((rect.right - rect.left) / 2);
            int centerY = rect.top + ((rect.bottom - rect.top) / 2);

            SetCursorPos(centerX, centerY);
            Thread.Sleep(100);

            // Double Click
            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
            Thread.Sleep(100);
            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
            Thread.Sleep(500);
        }

        /// <summary>
        /// Switches to a specific tab control tab by AutomationId or Name.
        /// </summary>
        public void ClickTab(string tabName, string windowTitle = "Prime Global Asset")
        {
            var element = FindElementByAutomationIdOrName(tabName, tabName, windowTitle);
            if (element == null)
            {
                throw new InvalidOperationException($"Tab '{tabName}' was not found in '{windowTitle}'.");
            }

            try
            {
                var selectPattern = element.GetCurrentPattern(UIA_PatternIds.UIA_SelectionItemPatternId) as IUIAutomationSelectionItemPattern;
                if (selectPattern != null)
                {
                    selectPattern.Select();
                    Thread.Sleep(300);
                    return;
                }
            }
            catch
            {
                // Fallback to center mouse click
            }

            var rect = element.CurrentBoundingRectangle;
            int centerX = rect.left + ((rect.right - rect.left) / 2);
            int centerY = rect.top + ((rect.bottom - rect.top) / 2);
            ClickRelative(centerX, centerY);
            Thread.Sleep(300);
        }

        /// <summary>
        /// Reads real text value from an element. Returns null if element is not present.
        /// </summary>
        public string? GetTextValue(string automationId, string windowTitle = "Prime Global Asset")
        {
            var element = FindElementByAutomationIdOrName(automationId, automationId, windowTitle);
            if (element == null)
            {
                return null;
            }

            try
            {
                var valuePattern = element.GetCurrentPattern(UIA_PatternIds.UIA_ValuePatternId) as IUIAutomationValuePattern;
                if (valuePattern != null && !string.IsNullOrWhiteSpace(valuePattern.CurrentValue))
                {
                    return valuePattern.CurrentValue.Trim();
                }
            }
            catch
            {
                // Fallback to Name
            }

            try
            {
                string name = element.CurrentName;
                if (!string.IsNullOrWhiteSpace(name))
                {
                    return name.Trim();
                }
            }
            catch
            {
                // Ignore
            }

            return null;
        }

        /// <summary>
        /// Counts real child elements under a container. Returns 0 if container not found.
        /// </summary>
        public int CountChildElements(string parentAutomationId, string windowTitle = "Prime Global Asset")
        {
            var element = FindElementByAutomationIdOrName(parentAutomationId, parentAutomationId, windowTitle);
            if (element == null || _automation == null)
            {
                return 0;
            }

            try
            {
                var trueCondition = _automation.CreateTrueCondition();
                var children = element.FindAll(TreeScope.TreeScope_Children, trueCondition);
                return children != null ? children.Length : 0;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[UIAutomation] CountChildElements error for '{parentAutomationId}': {ex.Message}");
                return 0;
            }
        }

        /// <summary>
        /// Sends a raw mouse click at the specified screen coordinates.
        /// </summary>
        public void ClickRelative(int x, int y)
        {
            SetCursorPos(x, y);
            Thread.Sleep(50);
            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
            Thread.Sleep(50);
            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
        }

        /// <summary>
        /// Closes the target window.
        /// </summary>
        public void CloseWindow(string windowTitle)
        {
            IntPtr hWnd = FindWindowHandle(windowTitle);
            if (hWnd != IntPtr.Zero)
            {
                SendMessage(hWnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
            }
        }

        /// <summary>
        /// Inspector: Dumps the live UI Automation element tree of the window for debugging and element ID mapping.
        /// </summary>
        public void DumpElementTree(string windowTitle, Action<string> log)
        {
            var root = GetWindowElement(windowTitle);
            if (root == null || _automation == null)
            {
                log($"[Inspector] Target window '{windowTitle}' is not active or accessible.");
                return;
            }

            log($"================================================================================");
            log($"[Inspector] Live UI Automation Tree for Window: '{root.CurrentName}'");
            log($"================================================================================");

            TraverseElement(root, 0, log);
        }

        private void TraverseElement(IUIAutomationElement element, int depth, Action<string> log)
        {
            if (element == null || depth > 8) return;

            string indent = new string(' ', depth * 2);
            string controlType = GetControlTypeName(element.CurrentControlType);
            string autoId = element.CurrentAutomationId;
            string name = element.CurrentName;
            string className = element.CurrentClassName;
            bool enabled = element.CurrentIsEnabled != 0;
            bool offscreen = element.CurrentIsOffscreen != 0;
            var rect = element.CurrentBoundingRectangle;

            log($"{indent}├─ [{controlType}] AutomationId=\"{autoId}\", Name=\"{name}\", Class=\"{className}\", Bounds=[{rect.left},{rect.top},{rect.right - rect.left}x{rect.bottom - rect.top}], Enabled={enabled}, Offscreen={offscreen}");

            if (_automation == null) return;

            try
            {
                var children = element.FindAll(TreeScope.TreeScope_Children, _automation.CreateTrueCondition());
                if (children != null)
                {
                    for (int i = 0; i < children.Length; i++)
                    {
                        var child = children.GetElement(i);
                        TraverseElement(child, depth + 1, log);
                    }
                }
            }
            catch
            {
                // Skip if access denied on subtree
            }
        }

        private static string GetControlTypeName(int controlTypeId)
        {
            return controlTypeId switch
            {
                50000 => "Button",
                50001 => "Calendar",
                50002 => "CheckBox",
                50003 => "ComboBox",
                50004 => "Edit",
                50005 => "Hyperlink",
                50006 => "Image",
                50007 => "ListItem",
                50008 => "List",
                50009 => "Menu",
                50010 => "MenuBar",
                50011 => "MenuItem",
                50012 => "ProgressBar",
                50013 => "RadioButton",
                50014 => "ScrollBar",
                50015 => "Slider",
                50016 => "Spinner",
                50017 => "StatusBar",
                50018 => "Tab",
                50019 => "TabItem",
                50020 => "Text",
                50021 => "ToolBar",
                50022 => "ToolTip",
                50023 => "Tree",
                50024 => "TreeItem",
                50025 => "Custom",
                50026 => "Group",
                50027 => "Thumb",
                50028 => "DataGrid",
                50029 => "DataItem",
                50030 => "Document",
                50031 => "SplitButton",
                50032 => "Window",
                50033 => "Pane",
                50034 => "Header",
                50035 => "HeaderItem",
                50036 => "Table",
                50037 => "TitleBar",
                50038 => "Separator",
                _ => $"Control_{controlTypeId}"
            };
        }
    }
}
