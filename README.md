# NetPulse Core | Modern Network Monitoring & SLA Dashboard

NetPulse Core is an ultra-premium, high-fidelity **Network Monitoring Web Application** designed specifically for complex multi-floor infrastructures. Out of the box, it models your 8 ISP connections, 3 Firewalls, and multi-floor wireless distributions with pixel-perfect visual design, dark-mode glassmorphism, responsive elements, and real-time SVG network flow pathing.

NetPulse Core features a **Dual-Mode Architecture** allowing it to run either as a high-fidelity browser-side simulator or query **actual live network devices** via an integrated local Express server.

---

## 🏢 Network Architecture Covered

This dashboard represents and polls the following active hardware assets:

### 1. Second & Third Floor (Zone A)
* **Firewall Gateway**: FortiGate 80F (`192.168.10.1`)
  * Pulls **4 ISP Connections**:
    * **ISP 1**: Primary GPON Fiber (1 Gbps - Tata Communications)
    * **ISP 2**: Dedicated Backup Fiber Leased Line (200 Mbps - Airtel Enterprise)
    * **ISP 3**: Broadband Coaxial (100 Mbps - ACT Fibernet)
    * **ISP 4**: 5G Standby Failover (50 Mbps - Jio Business 5G)
* **Core Switch**: Aruba Instant On Switch (`192.168.10.2` - JL681A 1930 24G PoE)
* **Wireless endpoints**: 4x Grandstream Access Points (GWN7660 / GWN7630)

### 2. First Floor (Old Wing - Zone B)
* **Firewall Gateway**: FortiGate 30G (`192.168.20.1`)
  * Pulls **2 ISP Connections**:
    * **ISP 5**: Old Office Primary Fiber (300 Mbps - Spectra Net)
    * **ISP 6**: Backup DSL Copper (80 Mbps - BSNL Broadband)
* **Access Switch**: TP-Link JetStream Switch (`192.168.20.2` - TL-SG3428X PoE)
* **Wireless endpoints**: 2x TP-Link Access Points (EAP245 AC1750)

### 3. First Floor (New Wing - Zone C)
* **Firewall Gateway**: FortiGate 30G (`192.168.30.1`)
  * Pulls **2 ISP Connections**:
    * **ISP 7**: New Office Primary Fiber (500 Mbps - Airtel Broadband)
    * **ISP 8**: 5G Cellular Gateway Backup (100 Mbps - Jio Business 5G)
* **Access Switch**: TP-Link JetStream Switch (`192.168.30.2` - TL-SG2428P PoE v5)
* **Wireless endpoints**: 1x Grandstream Access Point (GWN7660 Wi-Fi 6)

---

## ⚡ Dual-Mode System

NetPulse Core supports two operational modes:

### Mode A: Browser Standalone (Simulation)
* **How it works**: Open `index.html` directly. It runs completely client-side in the browser.
* **Telemetry**: High-fidelity mock simulator generated inside the browser.
* **Incidents**: Triggered locally inside the browser.

### Mode B: Actual Live Data Mode (SNMP & Zabbix Integration)
* **How it works**: A local Node.js server (`server.js`) runs in the background. The browser frontend auto-detects it!
* **Telemetry**: Node.js polls actual hardware IPs via UDP **SNMP v2c/v3** and queries your **Zabbix JSON-RPC API** endpoint in real-time.
* **Diagnostics**: Clicking "Query SNMP agent" or "Test Connection" triggers real walks and HTTP handshakes via Node.js, displaying the raw response dumps in the Diagnostics Terminal window.

---

## 🚀 How to Run the App with Actual Data

Unlock real network monitoring by executing these simple setup steps:

### Step 1: Install Node.js Dependencies
Open your command terminal (Command Prompt, PowerShell, or Bash), navigate to the project directory, and install the required networking libraries:
```bash
cd C:\Users\salih\.gemini\antigravity\scratch\network-monitoring-app
npm install
```

### Step 2: Start the Backend Server Gateway
Start the local server gateway:
```bash
npm start
```
You will see the console confirmation:
```text
🚀 NetPulse Core Gateway active on http://localhost:3000
🖥️  Open your browser and navigate to the address above
```

### Step 3: Run the Dashboard
Open your web browser (Chrome, Edge, Firefox) and navigate to:
**`http://localhost:3000`**

The sidebar badge will display `[ACTUAL SNMP LIVE]` indicating the frontend is successfully retrieving and visualizing actual data streamed from the backend!

---

## ⚙️ Connecting Your Real Devices & Zabbix

1. Click on **Integrations** tab in the sidebar menu.
2. In the **Connection Profiles** panel:
   * Define your target **SNMP Community String** and **Target UDP Port**.
   * Enter your actual **Zabbix API End-point URL** (e.g. `http://<your-zabbix-ip>/zabbix/api_jsonrpc.php`) and **Zabbix API security token**.
3. Click **Save Configuration** (stores configuration inside `config.json` on the server).
4. Click **Test Connection**: The diagnostics terminal will display step-by-step connection checks for your Zabbix RPC handshakes and SNMP walks.
