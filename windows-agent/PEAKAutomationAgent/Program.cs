using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using PEAKAutomationAgent.Core;

namespace PEAKAutomationAgent
{
    public class AgentConfig
    {
        public string? ServerUrl { get; set; }
        public string? DeviceToken { get; set; }
        public string? DeviceName { get; set; }
    }

    internal class Program
    {
        private static async Task<int> Main(string[] args)
        {
            Console.OutputEncoding = System.Text.Encoding.UTF8;
            Console.WriteLine("================================================================================");
            Console.WriteLine("   PEAK AUTOMATION DESKTOP AGENT v1.0.0 (Windows Production Build)             ");
            Console.WriteLine("   Direct UI Automation Driver for 'Prime Global Asset'                        ");
            Console.WriteLine("================================================================================");

            // 1. Read from Environment Variables
            string? serverUrl = Environment.GetEnvironmentVariable("PEAK_SERVER_URL");
            string? deviceToken = Environment.GetEnvironmentVariable("PEAK_DEVICE_TOKEN");
            string? deviceName = Environment.GetEnvironmentVariable("PEAK_DEVICE_NAME");

            // 2. If any missing, read from config.json
            string configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
            if (!File.Exists(configPath))
            {
                configPath = Path.Combine(Directory.GetCurrentDirectory(), "config.json");
            }

            if (File.Exists(configPath))
            {
                try
                {
                    string jsonContent = File.ReadAllText(configPath);
                    var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                    var fileCfg = JsonSerializer.Deserialize<AgentConfig>(jsonContent, opts);

                    if (fileCfg != null)
                    {
                        serverUrl ??= fileCfg.ServerUrl;
                        deviceToken ??= fileCfg.DeviceToken;
                        deviceName ??= fileCfg.DeviceName;
                    }
                }
                catch (Exception ex)
                {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine($"[Config Warning] Could not parse config.json: {ex.Message}");
                    Console.ResetColor();
                }
            }

            // 3. Fallback defaults if still empty
            deviceName ??= Environment.MachineName;

            // 4. Validate Required Configuration
            bool hasError = false;
            if (string.IsNullOrWhiteSpace(serverUrl))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[CONFIG ERROR] PEAK_SERVER_URL is missing!");
                hasError = true;
            }

            if (string.IsNullOrWhiteSpace(deviceToken))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[CONFIG ERROR] PEAK_DEVICE_TOKEN is missing!");
                hasError = true;
            }

            if (hasError)
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("\nPlease configure via Environment Variables or config.json:");
                Console.WriteLine("--------------------------------------------------------------------------------");
                Console.WriteLine("Example config.json:");
                Console.WriteLine("{\n  \"serverUrl\": \"wss://YOUR_PEAK_SERVER_URL/ws\",\n  \"deviceToken\": \"pk_dev_office_pc_2026_authorized\",\n  \"deviceName\": \"Office PC\"\n}");
                Console.WriteLine("--------------------------------------------------------------------------------");
                Console.ResetColor();
                return 1;
            }

            // Ensure serverUrl has WebSocket protocol and clientType=agent
            if (serverUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
            {
                serverUrl = "ws://" + serverUrl.Substring(7);
            }
            else if (serverUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                serverUrl = "wss://" + serverUrl.Substring(8);
            }

            if (!serverUrl.Contains("clientType="))
            {
                serverUrl += serverUrl.Contains("?") ? "&clientType=agent" : "?clientType=agent";
            }

            var agent = new AgentEngine(serverUrl, deviceToken, deviceName);

            // Handle CLI Inspector mode
            if (args.Length > 0 && (args.Contains("inspect", StringComparer.OrdinalIgnoreCase) || 
                                   args.Contains("--inspect", StringComparer.OrdinalIgnoreCase)))
            {
                Console.WriteLine("\n[Command] Running 'Inspect Current Window' for Prime Global Asset...");
                try
                {
                    agent.InspectWindow();
                    Console.WriteLine("\n[Command] UI Element Tree Inspection completed.");
                }
                catch (Exception ex)
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine($"[Inspector Error] {ex.Message}");
                    Console.ResetColor();
                }
                return 0;
            }

            Console.WriteLine($"[Config] Server URL:    {serverUrl}");
            Console.WriteLine($"[Config] Device Name:   {deviceName}");
            Console.WriteLine($"[Config] Authorization: [Configured]");
            Console.WriteLine("[Instructions] Run with 'inspect' argument to dump the UI Automation Element Tree.");
            Console.WriteLine();

            var cts = new CancellationTokenSource();

            Console.CancelKeyPress += (s, e) =>
            {
                e.Cancel = true;
                Console.WriteLine("\n[Shutdown] Stopping Agent gracefully...");
                cts.Cancel();
            };

            try
            {
                await agent.StartAsync(cts.Token);
                return 0;
            }
            catch (OperationCanceledException)
            {
                Console.WriteLine("[Shutdown] Agent stopped.");
                return 0;
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"[Fatal Error] {ex.Message}");
                Console.ResetColor();
                return 1;
            }
        }
    }
}
