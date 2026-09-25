# คู่มือการติดตั้งและใช้งาน PEAK AUTOMATION AGENT บน Windows (REAL SETUP)

คู่มือนี้สำหรับเชื่อมต่อ **Windows PC ที่ติดตั้ง Prime Global Asset** เข้ากับระบบ **PEAK AUTOMATION** เพื่อดึงข้อมูลทรัพย์จาก Excel เข้าสู่ระบบจริงโดยอัตโนมัติ

---

## 📋 1. สิ่งที่ต้องเตรียมบนเครื่อง Windows

1. **ระบบปฏิบัติการ**: Windows 10 (1903+) หรือ Windows 11 (64-bit)
2. **โปรแกรม Prime Global Asset**: ติดตั้งและเข้าสู่ระบบ (Login) ไว้เรียบร้อยแล้วบนเครื่อง
3. **.NET 8.0 Desktop Runtime หรือ SDK**:
   - ตรวจสอบโดยเปิด PowerShell แล้วพิมพ์: `dotnet --version`
   - หากยังไม่มี ให้ดาวน์โหลดจาก: [Microsoft .NET 8.0](https://dotnet.microsoft.com/download/dotnet/8.0) (เลือก **.NET Desktop Runtime 8.0 x64**)

---

## 📥 2. ติดตั้งไฟล์ Windows Agent

คัดลอกโฟลเดอร์ `windows-agent/PEAKAutomationAgent` มาไว้บนเครื่อง Windows ของคุณ (เช่น `C:\PEAKAutomationAgent`)

---

## ⚙️ 3. การตั้งค่า (Configuration)

คุณสามารถตั้งค่าได้ **2 วิธี** (เลือกวิธีที่สะดวกที่สุด):

### วิธีที่ 1: ตั้งค่าผ่านไฟล์ `config.json` (แนะนำ ง่ายที่สุด)
เปิดไฟล์ `config.json` ที่อยู่ในโฟลเดอร์ Agent ด้วย Notepad แล้วระบุ:

```json
{
  "serverUrl": "wss://ais-dev-5ptqvzrfg3aew4ovwtquje-956073962055.asia-southeast1.run.app/ws",
  "deviceToken": "pk_dev_office_pc_2026_authorized",
  "deviceName": "Office PC"
}
```

### วิธีที่ 2: ตั้งค่าผ่าน Environment Variables ใน PowerShell
```powershell
$env:PEAK_SERVER_URL = "wss://ais-dev-5ptqvzrfg3aew4ovwtquje-956073962055.asia-southeast1.run.app/ws"
$env:PEAK_DEVICE_TOKEN = "pk_dev_office_pc_2026_authorized"
$env:PEAK_DEVICE_NAME = "Office PC"
```

---

## 🚀 4. วิธีการเปิดรัน Agent

### ตัวเลือก A: ดับเบิลคลิก `start-agent.bat` (One-Click Start)
เพียงดับเบิลคลิกไฟล์ **`start-agent.bat`** หน้าต่างคอนโซลจะเปิดขึ้นมาและเชื่อมต่อไปยัง Server อัตโนมัติ

### ตัวเลือก B: สั่งรันผ่าน PowerShell
```powershell
cd C:\PEAKAutomationAgent
dotnet run -c Release
```

### ตัวเลือก C: สั่งสแกนโครงสร้างหน้าต่าง (Automation Inspector Mode)
หากต้องการตรวจสอบ Element ID และชื่อคอนโทรลของ Prime Global Asset:
```powershell
dotnet run -c Release -- inspect
```

---

## 🖥️ 5. ขั้นตอนการใช้งาน Workflow จริง

1. **เปิดโปรแกรม Prime Global Asset** บน Windows และล็อกอินให้อยู่ที่หน้าหลัก
2. **รัน Windows Agent** (ดับเบิลคลิก `start-agent.bat`)
   - รอจนขึ้นข้อความ: `[Network] Connected successfully to PEAK Automation Server!`
3. **เปิดเว็บ PEAK AUTOMATION**:
   - ไปที่หน้า **Batch Automation** หรือ **Device Management**
   - จะเห็นสถานะ: **Windows Agent: ONLINE** และ **Prime Global Asset: DETECTED**
4. **อัปโหลดไฟล์ Excel (.xlsx, .xls, .csv)** ที่มีคอลัมน์ `Property No` (เช่น `VN568`, `KT324`)
5. ตรวจสอบตาราง Preview:
   - รายการที่ถูกต้องจะแสดงสถานะ **READY**
6. กดปุ่ม **START AUTOMATION**
7. **Agent จะทำงานจริง**:
   - โฟกัสหน้าต่าง Prime Global Asset
   - สลับไปโมดูล Property
   - ค้นหารหัสทรัพย์
   - ดับเบิลคลิกเปิดหน้ารายละเอียด
   - ดึงข้อมูลสเปก, ข้อมูลเจ้าของ (Landlord), ราคา และรูปภาพจริง
   - ถ่ายภาพหน้าจอส่งกลับ Server พร้อมบันทึกลง Database
   - ดำเนินการต่อในรายการถัดไปจนครบทุกรายการ
