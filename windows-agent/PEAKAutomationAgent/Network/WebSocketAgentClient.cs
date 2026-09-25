using System;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace PEAKAutomationAgent.Network
{
    public class WebSocketAgentClient
    {
        private readonly string _serverUrl;
        private readonly string _deviceToken;
        private readonly string _deviceName;
        private ClientWebSocket? _ws;

        public event EventHandler<JsonElement>? OnJobReceived;

        public WebSocketAgentClient(string serverUrl, string deviceToken, string deviceName)
        {
            _serverUrl = serverUrl;
            _deviceToken = deviceToken;
            _deviceName = deviceName;
        }

        public async Task ConnectAndListenAsync(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    _ws = new ClientWebSocket();
                    _ws.Options.SetRequestHeader("x-device-token", _deviceToken);
                    _ws.Options.SetRequestHeader("x-device-name", _deviceName);

                    Console.WriteLine($"[Network] Connecting to PEAK Server: {_serverUrl}...");
                    await _ws.ConnectAsync(new Uri(_serverUrl), cancellationToken);
                    Console.WriteLine("[Network] Connected successfully to PEAK Automation Server!");

                    bool isPrimeRunning = System.Diagnostics.Process.GetProcessesByName("PrimeGlobalAsset").Length > 0;

                    // Send initial handshake
                    await SendEventAsync("agent.handshake", new
                    {
                        deviceName = _deviceName,
                        token = _deviceToken,
                        os = Environment.OSVersion.ToString(),
                        primeDetected = isPrimeRunning
                    });

                    // Start Heartbeat loop in background
                    _ = StartHeartbeatLoopAsync(cancellationToken);

                    // Receive loop
                    var buffer = new byte[65536];
                    while (_ws.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
                    {
                        var result = await _ws.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);
                        if (result.MessageType == WebSocketMessageType.Close)
                        {
                            await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", cancellationToken);
                            break;
                        }

                        string messageJson = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        using var doc = JsonDocument.Parse(messageJson);
                        var root = doc.RootElement;

                        if (root.TryGetProperty("event", out var eventProp))
                        {
                            string eventName = eventProp.GetString() ?? "";
                            if (eventName == "job.start" && root.TryGetProperty("payload", out var payload))
                            {
                                OnJobReceived?.Invoke(this, payload.Clone());
                            }
                        }
                    }
                }
                catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
                {
                    Console.WriteLine($"[Network] Connection lost: {ex.Message}. Reconnecting in 5 seconds...");
                    await Task.Delay(5000, cancellationToken);
                }
            }
        }

        private async Task StartHeartbeatLoopAsync(CancellationToken cancellationToken)
        {
            while (_ws != null && _ws.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
            {
                await Task.Delay(10000, cancellationToken);
                try
                {
                    bool isPrimeRunning = System.Diagnostics.Process.GetProcessesByName("PrimeGlobalAsset").Length > 0;
                    await SendEventAsync("device.heartbeat", new
                    {
                        deviceName = _deviceName,
                        status = "ONLINE",
                        primeDetected = isPrimeRunning,
                        timestamp = DateTime.UtcNow
                    });
                }
                catch
                {
                    break;
                }
            }
        }

        public async Task SendProgressAsync(string jobId, string status, string currentStep, int progress)
        {
            await SendEventAsync("job.progress", new
            {
                jobId,
                status,
                currentStep,
                progress
            });
        }

        public async Task SendLogAsync(string jobId, string level, string action, string message)
        {
            await SendEventAsync("job.log", new
            {
                jobId,
                level,
                action,
                message,
                timestamp = DateTime.UtcNow
            });
        }

        public async Task SendScreenshotAsync(string jobId, string screenshotBase64)
        {
            await SendEventAsync("job.screenshot", new
            {
                jobId,
                screenshot = screenshotBase64
            });
        }

        public async Task SendJobCompletedAsync(string jobId, string propertyNo, object property, object landlord, int photosCount)
        {
            await SendEventAsync("job.completed", new
            {
                jobId,
                propertyNo,
                property,
                landlord,
                photosCount
            });
        }

        public async Task SendJobFailedAsync(string jobId, string error, string? errorCode = null)
        {
            await SendEventAsync("job.failed", new
            {
                jobId,
                error,
                errorCode = errorCode ?? "AGENT_ERROR",
                errorMessage = error
            });
        }

        private async Task SendEventAsync(string eventName, object payload)
        {
            if (_ws == null || _ws.State != WebSocketState.Open) return;

            string json = JsonSerializer.Serialize(new
            {
                @event = eventName,
                payload
            });
            byte[] bytes = Encoding.UTF8.GetBytes(json);
            await _ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
        }
    }
}
