# PEAK Automation Desktop Agent (Windows)

The official Windows Desktop Automation Agent for **PEAK Real Estate**, specifically engineered to control and automate **Prime Global Asset** without reliance on static mouse coordinates.

---

## 🛠️ Architecture Overview

The Agent utilizes a **4-Priority Fallback Strategy**:
1. **Priority 1: Windows UI Automation (Accessibility Tree)**
   - Identifies UI elements via `AutomationId`, `Name`, `ClassName`, and Control Patterns (`ValuePattern`, `SelectionItemPattern`, `InvokePattern`).
   - Immune to window movement, resize, or Windows Display Scaling (100%, 125%, 150%).
2. **Priority 2: Windows.Media.OCR Engine**
   - If dynamic controls are rendered via custom canvases or DirectWrite, OCR parses the visual text bounding boxes.
3. **Priority 3: OpenCV Computer Vision / Template Matching**
   - Used for custom icons, photo thumbnails, and save indicators.
4. **Priority 4: Relative Mouse Simulation**
   - Used only as an absolute fallback, strictly relative to detected bounding box centers.

---

## 🚀 Installation & Setup on Windows

### Prerequisites
- Windows 10 (1903+) or Windows 11 (64-bit)
- .NET 8.0 Runtime or SDK ([Download .NET 8](https://dotnet.microsoft.com/download/dotnet/8.0))
- Prime Global Asset installed on the local PC

### Build & Run from Source

1. Clone or copy the `windows-agent/PEAKAutomationAgent` folder to your Windows PC.
2. Open PowerShell or Command Prompt:

```powershell
cd PEAKAutomationAgent
dotnet restore
dotnet build -c Release
```

3. Configure your Environment Variables or `appsettings.json`:

```powershell
$env:PEAK_SERVER_URL = "ws://YOUR_PEAK_SERVER_URL/ws"
$env:PEAK_DEVICE_TOKEN = "pk_dev_office_pc_2026_authorized"
$env:PEAK_DEVICE_NAME = "Office PC"
```

4. Run the Agent:

```powershell
dotnet run -c Release
```

### 🔍 Automation Inspector Mode (Live UI Element Tree)

To discover and inspect the exact UI Automation IDs, Control Types, and element names of Prime Global Asset:

```powershell
# Using dotnet CLI
dotnet run -c Release -- inspect

# Or using the compiled executable
.\PEAKAutomationAgent.exe inspect
```
This command outputs the live hierarchy tree:
```
├─ [Button] AutomationId="Nav_Properties", Name="Properties", Bounds=[10,50,120x40], Enabled=True
├─ [Edit] AutomationId="SearchBox_PropertyNo", Name="Property No", Bounds=[210,120,180x30], Enabled=True
├─ [Tab] AutomationId="DetailTabs", Name="Property Details", ...
```

### Publishing Standalone Windows Executable (.exe)

To generate a single-file executable that requires no pre-installed .NET runtime:

```powershell
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o ./dist
```

The compiled file `dist\PEAKAutomationAgent.exe` will be ready to distribute and configure on any Windows workstation.

---

## 🔒 Security Features
- Token-based Device Authorization (`x-device-token`)
- Heartbeat every 10 seconds to report live availability
- Zero password storage: Agent does not store or transmit Prime Global Asset credentials
- Emergency Stop signal handling for immediate execution cutoff with state preservation
