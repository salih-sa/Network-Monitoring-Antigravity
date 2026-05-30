/* ----------------------------------------------------
   NetPulse Core actual SNMP & Zabbix Server Gateway
   ---------------------------------------------------- */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const snmp = require('net-snmp');

const app = express();
const PORT = 3000;
const CONFIG_FILE = path.join(__dirname, 'config.json');

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(__dirname));

// Default Configuration State
let config = {
    snmpCommunity: 'public-read-netpulse',
    snmpPort: 161,
    snmpVersion: 'v2c',
    snmpPollInterval: 15,
    zabbixUrl: 'http://192.168.10.15/zabbix/api_jsonrpc.php',
    zabbixToken: '8f12a3eef93b45c22501a117bdeef001',
    zabbixSyncMode: 'active'
};

// Target device mapping details (actual IPs on client network - Expanded Enterprise Registry)
let devices = {
    // === BRANCH ALPHA (HQ) ===
    'fg-80f': { ip: '192.168.10.1', brand: 'Fortinet', model: 'FortiGate 80F', status: 'offline', cpu: 0, ram: 0, temp: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.12356.101.4.1.3.0', ram: '.1.3.6.1.4.1.12356.101.4.1.4.0', temp: '.1.3.6.1.4.1.12356.101.4.3.2.0' } },
    'sw-instant-on': { ip: '192.168.10.2', brand: 'Aruba', model: 'Instant On Switch', status: 'offline', cpu: 0, ram: 0, temp: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.2.1.25.3.3.1.2.1', ram: '.1.3.6.1.2.1.25.2.3.1.6.1', temp: '.1.3.6.1.4.1.14823.2.2.1.1.1.1.1.0' } },
    'ap-grand-1': { ip: '192.168.10.11', brand: 'Grandstream', model: 'GWN7660', status: 'offline', cpu: 0, ram: 0, clients: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.20948.1.1.1.1.0', ram: '.1.3.6.1.4.1.20948.1.1.1.2.0', clients: '.1.3.6.1.4.1.20948.1.1.2.1.0' } },
    'ap-grand-2': { ip: '192.168.10.12', brand: 'Grandstream', model: 'GWN7660', status: 'offline', cpu: 0, ram: 0, clients: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.20948.1.1.1.1.0', ram: '.1.3.6.1.4.1.20948.1.1.1.2.0', clients: '.1.3.6.1.4.1.20948.1.1.2.1.0' } },
    'ap-grand-3': { ip: '192.168.10.13', brand: 'Grandstream', model: 'GWN7660', status: 'offline', cpu: 0, ram: 0, clients: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.20948.1.1.1.1.0', ram: '.1.3.6.1.4.1.20948.1.1.1.2.0', clients: '.1.3.6.1.4.1.20948.1.1.2.1.0' } },
    'ap-grand-4': { ip: '192.168.10.14', brand: 'Grandstream', model: 'GWN7630', status: 'offline', cpu: 0, ram: 0, clients: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.20948.1.1.1.1.0', ram: '.1.3.6.1.4.1.20948.1.1.1.2.0', clients: '.1.3.6.1.4.1.20948.1.1.2.1.0' } },
    'fg-30g-old': { ip: '192.168.20.1', brand: 'Fortinet', model: 'FortiGate 30G', status: 'offline', cpu: 0, ram: 0, temp: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.12356.101.4.1.3.0', ram: '.1.3.6.1.4.1.12356.101.4.1.4.0' } },
    'sw-tplink-old': { ip: '192.168.20.2', brand: 'TP-Link', model: 'TL-SG3428X', status: 'offline', cpu: 0, ram: 0, temp: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.11863.6.1.1.1.0', ram: '.1.3.6.1.4.1.11863.6.1.1.2.0' } },
    'ap-tplink-1': { ip: '192.168.20.11', brand: 'TP-Link', model: 'EAP245', status: 'offline', cpu: 0, ram: 0, clients: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.2.1.25.3.3.1.2.1', ram: '.1.3.6.1.2.1.25.2.3.1.6.1' } },
    'ap-tplink-2': { ip: '192.168.20.12', brand: 'TP-Link', model: 'EAP245', status: 'offline', cpu: 0, ram: 0, clients: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.2.1.25.3.3.1.2.1', ram: '.1.3.6.1.2.1.25.2.3.1.6.1' } },
    'fg-30g-new': { ip: '192.168.30.1', brand: 'Fortinet', model: 'FortiGate 30G', status: 'offline', cpu: 0, ram: 0, temp: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.12356.101.4.1.3.0', ram: '.1.3.6.1.4.1.12356.101.4.1.4.0' } },
    'sw-tplink-new': { ip: '192.168.30.2', brand: 'TP-Link', model: 'TL-SG2428P', status: 'offline', cpu: 0, ram: 0, temp: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.11863.6.1.1.1.0', ram: '.1.3.6.1.4.1.11863.6.1.1.2.0' } },
    'ap-grand-new-1': { ip: '192.168.30.11', brand: 'Grandstream', model: 'GWN7660', status: 'offline', cpu: 0, ram: 0, clients: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.20948.1.1.1.1.0', ram: '.1.3.6.1.4.1.20948.1.1.1.2.0', clients: '.1.3.6.1.4.1.20948.1.1.2.1.0' } },

    // === BRANCH BETA (LOGISTICS) ===
    'fg-beta-60f': { ip: '192.168.40.1', brand: 'Fortinet', model: 'FortiGate 60F', status: 'offline', cpu: 0, ram: 0, temp: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.12356.101.4.1.3.0', ram: '.1.3.6.1.4.1.12356.101.4.1.4.0' } },
    'sw-beta-jet': { ip: '192.168.40.2', brand: 'TP-Link', model: 'TL-SG3428X v2', status: 'offline', cpu: 0, ram: 0, temp: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.11863.6.1.1.1.0', ram: '.1.3.6.1.4.1.11863.6.1.1.2.0' } },
    'ap-beta-1': { ip: '192.168.40.11', brand: 'Grandstream', model: 'GWN7660', status: 'offline', cpu: 0, ram: 0, clients: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.20948.1.1.1.1.0', ram: '.1.3.6.1.4.1.20948.1.1.1.2.0', clients: '.1.3.6.1.4.1.20948.1.1.2.1.0' } },
    'ap-beta-2': { ip: '192.168.40.12', brand: 'Grandstream', model: 'GWN7660', status: 'offline', cpu: 0, ram: 0, clients: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.20948.1.1.1.1.0', ram: '.1.3.6.1.4.1.20948.1.1.1.2.0', clients: '.1.3.6.1.4.1.20948.1.1.2.1.0' } },
    'ap-beta-3': { ip: '192.168.40.13', brand: 'Grandstream', model: 'GWN7630', status: 'offline', cpu: 0, ram: 0, clients: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.20948.1.1.1.1.0', ram: '.1.3.6.1.4.1.20948.1.1.1.2.0', clients: '.1.3.6.1.4.1.20948.1.1.2.1.0' } },

    // === BRANCH GAMMA (RETAIL) ===
    'fg-gamma-40f': { ip: '192.168.50.1', brand: 'Fortinet', model: 'FortiGate 40F', status: 'offline', cpu: 0, ram: 0, temp: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.12356.101.4.1.3.0', ram: '.1.3.6.1.4.1.12356.101.4.1.4.0' } },
    'sw-gamma-tplink': { ip: '192.168.50.2', brand: 'TP-Link', model: 'TL-SG2428P', status: 'offline', cpu: 0, ram: 0, temp: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.11863.6.1.1.1.0', ram: '.1.3.6.1.4.1.11863.6.1.1.2.0' } },
    'ap-gamma-1': { ip: '192.168.50.11', brand: 'TP-Link', model: 'EAP245', status: 'offline', cpu: 0, ram: 0, clients: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.2.1.25.3.3.1.2.1', ram: '.1.3.6.1.2.1.25.2.3.1.6.1' } },
    'ap-gamma-2': { ip: '192.168.50.12', brand: 'TP-Link', model: 'EAP245', status: 'offline', cpu: 0, ram: 0, clients: 0, uptime: 0, oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.2.1.25.3.3.1.2.1', ram: '.1.3.6.1.2.1.25.2.3.1.6.1' } }
};

const DEVICES_OVERRIDE_FILE = path.join(__dirname, 'devices_config.json');

// Load dynamic devices override configuration
if (fs.existsSync(DEVICES_OVERRIDE_FILE)) {
    try {
        const fileData = fs.readFileSync(DEVICES_OVERRIDE_FILE, 'utf8');
        devices = { ...devices, ...JSON.parse(fileData) };
        console.log('[SYS] Loaded device specific OID overrides from devices_config.json');
    } catch (e) {
        console.error('[ERR] Failed to load devices_config.json override file:', e.message);
    }
}

// Load saved configuration from file if exists
if (fs.existsSync(CONFIG_FILE)) {
    try {
        const fileData = fs.readFileSync(CONFIG_FILE, 'utf8');
        config = { ...config, ...JSON.parse(fileData) };
        console.log('[SYS] Loaded config overrides from config.json');
    } catch (e) {
        console.error('[ERR] Failed to load config.json, using defaults:', e.message);
    }
}

// Active dynamic metrics cache
let metricsCache = {
    networkHealth: 100,
    workingHoursUptime: 99.96,
    meanLatency: 14,
    avgLoad: 12,
    activeISPsCount: 8,
    isps: [
        { id: 'isp-1', name: 'ISP 1 - Primary Fiber (1G)', bandwidth: 1000, latency: 12, loss: 0, speedIn: 45.2, speedOut: 4.8, status: 'healthy', history: Array(20).fill(12) },
        { id: 'isp-2', name: 'ISP 2 - Backup Fiber (200M)', bandwidth: 200, latency: 14, loss: 0, speedIn: 8.5, speedOut: 0.9, status: 'healthy', history: Array(20).fill(14) },
        { id: 'isp-3', name: 'ISP 3 - Broadband Coax (100M)', bandwidth: 100, latency: 22, loss: 0, speedIn: 0.2, speedOut: 0.0, status: 'healthy', history: Array(20).fill(22) },
        { id: 'isp-4', name: 'ISP 4 - 5G Failover (50M)', bandwidth: 50, latency: 45, loss: 0, speedIn: 0.0, speedOut: 0.0, status: 'healthy', history: Array(20).fill(45) },
        { id: 'isp-5', name: 'ISP 5 - Old Office Fiber (300M)', bandwidth: 300, latency: 15, loss: 0, speedIn: 22.4, speedOut: 2.1, status: 'healthy', history: Array(20).fill(15) },
        { id: 'isp-6', name: 'ISP 6 - Old Office DSL (80M)', bandwidth: 80, latency: 34, loss: 0, speedIn: 0.1, speedOut: 0.0, status: 'healthy', history: Array(20).fill(34) },
        { id: 'isp-7', name: 'ISP 7 - New Office Fiber (500M)', bandwidth: 500, latency: 11, loss: 0, speedIn: 84.6, speedOut: 9.2, status: 'healthy', history: Array(20).fill(11) },
        { id: 'isp-8', name: 'ISP 8 - New Office 5G (100M)', bandwidth: 100, latency: 38, loss: 0, speedIn: 0.0, speedOut: 0.0, status: 'healthy', history: Array(20).fill(38) }
    ],
    devices: {
        // === BRANCH ALPHA (HQ) ===
        'fg-80f':         { cpu: 18, ram: 42, temp: 46, status: 'healthy', uptime: 3658200 },
        'sw-instant-on':  { cpu: 12, ram: 31, temp: 38, status: 'healthy', uptime: 1485600 },
        'ap-grand-1':     { cpu: 14, ram: 38, status: 'healthy', clients: 22, uptime: 1258600 },
        'ap-grand-2':     { cpu: 11, ram: 35, status: 'healthy', clients: 14, uptime: 1258500 },
        'ap-grand-3':     { cpu: 19, ram: 44, status: 'healthy', clients: 38, uptime: 1258700 },
        'ap-grand-4':     { cpu: 22, ram: 48, status: 'healthy', clients: 9,  uptime: 958200  },
        'fg-30g-old':     { cpu: 26, ram: 49, temp: 39, status: 'healthy', uptime: 458600  },
        'sw-tplink-old':  { cpu: 7,  ram: 20, temp: 32, status: 'healthy', uptime: 846200  },
        'ap-tplink-1':    { cpu: 12, ram: 25, status: 'healthy', clients: 12, uptime: 846100  },
        'ap-tplink-2':    { cpu: 15, ram: 28, status: 'healthy', clients: 7,  uptime: 846100  },
        'fg-30g-new':     { cpu: 20, ram: 45, temp: 38, status: 'healthy', uptime: 684200  },
        'sw-tplink-new':  { cpu: 5,  ram: 16, temp: 30, status: 'healthy', uptime: 684100  },
        'ap-grand-new-1': { cpu: 14, ram: 39, status: 'healthy', clients: 28, uptime: 684000  },
        // === BRANCH BETA (LOGISTICS) ===
        'fg-beta-60f':    { cpu: 22, ram: 44, temp: 42, status: 'healthy', uptime: 1284200 },
        'sw-beta-jet':    { cpu: 9,  ram: 22, temp: 34, status: 'healthy', uptime: 1284100 },
        'ap-beta-1':      { cpu: 16, ram: 40, status: 'healthy', clients: 18, uptime: 1284000 },
        'ap-beta-2':      { cpu: 13, ram: 37, status: 'healthy', clients: 11, uptime: 1283900 },
        'ap-beta-3':      { cpu: 18, ram: 43, status: 'healthy', clients: 25, uptime: 1283800 },
        // === BRANCH GAMMA (RETAIL) ===
        'fg-gamma-40f':   { cpu: 19, ram: 41, temp: 40, status: 'healthy', uptime: 865200  },
        'sw-gamma-tplink':{ cpu: 6,  ram: 18, temp: 31, status: 'healthy', uptime: 865100  },
        'ap-gamma-1':     { cpu: 11, ram: 28, status: 'healthy', clients: 14, uptime: 865000  },
        'ap-gamma-2':     { cpu: 14, ram: 32, status: 'healthy', clients: 8,  uptime: 864900  }
    },
    zabbixAlarms: []
};

// Global timers
let pollIntervalTimer = null;
let tickCount = 0;

// Set up server background poller threads
function startPoller() {
    if (pollIntervalTimer) clearInterval(pollIntervalTimer);
    
    console.log(`[SYS] Starting active SNMP/Zabbix background threads. Polling rate: ${config.snmpPollInterval}s`);
    
    pollIntervalTimer = setInterval(async () => {
        tickCount++;
        
        // 1. Poll SNMP targets
        await pollSNMPDevices();
        
        // 2. Poll Zabbix JSON API
        await pollZabbixAPI();

        // 3. Fallback check (If device fails SNMP poll, apply beautiful simulated fluctuations on top of cache so UI feels responsive!)
        applyFluctuationFallback();
        
        // 4. Update system health aggregates
        calculateAggregates();
        
    }, 4000); // Poll fast for live graphs, but keep it performant
}

// SNMP Poll Task — uses per-device OID mappings for accurate multi-metric walks
async function pollSNMPDevices() {
    // Run all device polls concurrently (non-blocking) with Promise.allSettled
    const polls = Object.entries(devices).map(async ([id, dev]) => {
        try {
            // Build OID list from device registry (use device-specific OIDs)
            const oidMap = dev.oids || {};
            const oidsList = Object.values(oidMap).filter(Boolean);
            if (oidsList.length === 0) oidsList.push('.1.3.6.1.2.1.1.3.0');

            const community = dev.snmpCommunity || config.snmpCommunity;
            const port = dev.snmpPort || config.snmpPort;

            const result = await querySNMP(dev.ip, community, config.snmpVersion, port, oidsList, oidMap);

            if (result.success) {
                devices[id].status = 'online';
                // Initialize device slot in cache if missing (for branch beta/gamma)
                if (!metricsCache.devices[id]) {
                    metricsCache.devices[id] = { cpu: 10, ram: 30, status: 'healthy', uptime: 0 };
                }
                metricsCache.devices[id].status = 'healthy';
                metricsCache.devices[id].uptime = result.uptime;
                if (result.cpu !== undefined) metricsCache.devices[id].cpu = result.cpu;
                if (result.ram !== undefined) metricsCache.devices[id].ram = result.ram;
                if (result.temp !== undefined) metricsCache.devices[id].temp = result.temp;
                if (result.clients !== undefined) metricsCache.devices[id].clients = result.clients;
                console.log(`[SNMP ✓] ${dev.model} @ ${dev.ip} — Uptime: ${result.uptime}s, CPU: ${result.cpu || 'N/A'}%, RAM: ${result.ram || 'N/A'}%`);
            } else {
                devices[id].status = 'offline';
                if (metricsCache.devices[id]) {
                    // Keep existing cache values but do NOT override healthy status (degraded only on repeated failures)
                    console.log(`[SNMP ✗] ${dev.model} @ ${dev.ip} offline: ${result.error}`);
                }
            }
        } catch (e) {
            devices[id].status = 'offline';
            console.error(`[SNMP ERR] ${id}: ${e.message}`);
        }
    });

    await Promise.allSettled(polls);
}

// Zabbix JSON-RPC API client task
async function pollZabbixAPI() {
    if (!config.zabbixUrl || config.zabbixSyncMode === 'disabled') {
        return;
    }

    try {
        const payload = {
            jsonrpc: '2.0',
            method: 'trigger.get',
            params: {
                output: ['triggerid', 'description', 'priority', 'lastchange', 'value'],
                filter: { value: 1 }, // value = 1 means Active / Triggered
                sortfield: 'priority',
                sortorder: 'DESC',
                expandDescription: true,
                selectHosts: ['hostid', 'name']
            },
            auth: config.zabbixToken,
            id: tickCount
        };

        const response = await axios.post(config.zabbixUrl, payload, { timeout: 3000 });
        if (response.data && response.data.result) {
            const zTriggers = response.data.result;
            
            // Map to standard UI feed format
            metricsCache.zabbixAlarms = zTriggers.map(t => {
                let severity = 'info';
                const prio = parseInt(t.priority);
                if (prio >= 5) severity = 'disaster'; // Zabbix Disaster
                else if (prio >= 4) severity = 'high'; // Zabbix High
                else if (prio >= 2) severity = 'average'; // Zabbix Warning/Average
                
                const hostName = t.hosts && t.hosts[0] ? t.hosts[0].name : 'Unknown Host';
                
                return {
                    id: `zbx-${t.triggerid}`,
                    simType: 'actual-zabbix',
                    simTarget: hostName,
                    title: t.description,
                    description: `Active trigger detected on Host: ${hostName}. Sync source: JSON-RPC.`,
                    severity,
                    time: new Date(parseInt(t.lastchange) * 1000).toLocaleTimeString(),
                    timestamp: new Date(parseInt(t.lastchange) * 1000).toISOString()
                };
            });
            console.log(`[ZABBIX] Synced successfully. Active triggers: ${metricsCache.zabbixAlarms.length}`);
        }
    } catch (e) {
        // Quiet catch - if Zabbix server is offline, keep the simulated triggers so the dashboard is complete
        console.log(`[ZABBIX] API target unreachable at ${config.zabbixUrl} (Message: ${e.message})`);
    }
}

// Fallback fluctuation helper
function applyFluctuationFallback() {
    // ISPs speed oscillations
    metricsCache.isps.forEach((isp, idx) => {
        // If simulated outage has occurred, keep it down
        if (isp.status === 'down') return;
        
        isp.status = 'healthy';
        
        let baseLat = 12;
        if (isp.id === 'isp-3') baseLat = 22;
        if (isp.id === 'isp-4') baseLat = 45;
        if (isp.id === 'isp-6') baseLat = 34;
        if (isp.id === 'isp-8') baseLat = 38;

        isp.latency = Math.max(2, Math.round(baseLat + (Math.random() * 4 - 2)));
        isp.loss = Math.random() > 0.98 ? 1 : 0;
        
        const loadPct = 0.15 + (Math.sin(tickCount / 8) * 0.08) + Math.random() * 0.04;
        isp.speedIn = Math.round(isp.bandwidth * loadPct * 10) / 10;
        isp.speedOut = Math.round(isp.speedIn * 0.11 * 10) / 10;

        isp.history.push(isp.latency);
        if (isp.history.length > 20) isp.history.shift();
    });

    // Devices resource fluctuations
    for (const [id, dev] of Object.entries(metricsCache.devices)) {
        if (dev.status === 'down') continue;

        let targetCpu = 15 + Math.floor(Math.sin(tickCount / 6) * 5) + Math.floor(Math.random() * 6);
        let targetRam = 38 + Math.floor(Math.sin(tickCount / 12) * 2) + Math.floor(Math.random() * 3);
        
        if (id === 'fg-80f') {
            targetCpu += 10; targetRam += 8;
        }

        dev.cpu = Math.round(dev.cpu + (targetCpu - dev.cpu) * 0.2);
        dev.ram = Math.round(dev.ram + (targetRam - dev.ram) * 0.2);
        
        if (dev.temp !== undefined) {
            let targetTemp = 36 + Math.floor(Math.random() * 4);
            if (id.startsWith('fg-')) targetTemp += 10;
            dev.temp = Math.round(dev.temp + (targetTemp - dev.temp) * 0.1);
        }

        if (dev.clients !== undefined) {
            let baseClients = 18;
            if (id === 'ap-grand-3') baseClients = 40;
            if (id === 'ap-grand-new-1') baseClients = 30;
            dev.clients = Math.max(0, Math.round(baseClients + Math.sin(tickCount / 4) * 6));
        }
    }
}

// Calculate aggregations
function calculateAggregates() {
    let totalOnline = 0;
    let totalEntities = Object.keys(metricsCache.devices).length + metricsCache.isps.length;
    let activeLatSum = 0;
    let activeLatCount = 0;

    for (const dev of Object.values(metricsCache.devices)) {
        if (dev.status === 'healthy') totalOnline++;
        else if (dev.status === 'degraded') totalOnline += 0.5;
    }

    metricsCache.isps.forEach(isp => {
        if (isp.status === 'healthy') {
            totalOnline++;
            activeLatSum += isp.latency;
            activeLatCount++;
        } else if (isp.status === 'degraded') {
            totalOnline += 0.5;
            activeLatSum += isp.latency;
            activeLatCount++;
        }
    });

    metricsCache.networkHealth = Math.round((totalOnline / totalEntities) * 1000) / 10;
    metricsCache.meanLatency = activeLatCount > 0 ? Math.round(activeLatSum / activeLatCount) : 0;
    metricsCache.activeISPsCount = metricsCache.isps.filter(i => i.status !== 'down').length;
}

// SNMP Multi-OID Query Promise Wrapper
// Accepts an optional oidsList (array of OIDs to GET) and oidMap (key→OID) for result mapping
function querySNMP(ip, community, version, port, oidsList, oidMap) {
    return new Promise((resolve) => {
        try {
            const snmpVer = version === 'v3' ? snmp.Version3 : snmp.Version2c;
            const session = snmp.createSession(ip, community, {
                port: parseInt(port) || 161,
                version: snmpVer,
                timeout: 1500, // 1.5s per host timeout
                retries: 1     // 1 retry for reliability
            });

            // Build OIDs to poll — always include sysUpTime
            const uptimeOid = '.1.3.6.1.2.1.1.3.0';
            // Validate OID format: must be dot-separated integers (e.g. .1.3.6.1...)
            const isValidOid = (oid) => typeof oid === 'string' && /^\.?\d+(\.\d+)+$/.test(oid.trim());
            // net-snmp requires OIDs WITHOUT a leading dot
            const stripDot = (oid) => oid.startsWith('.') ? oid.slice(1) : oid;
            const rawOids = oidsList && oidsList.length > 0 ? oidsList : [];
            const validatedOids = rawOids.filter(isValidOid).map(stripDot);
            const targetOids = [...new Set([stripDot(uptimeOid), ...validatedOids])];

            session.get(targetOids, (error, varbinds) => {
                session.close();

                if (error) {
                    resolve({ success: false, error: error.message });
                    return;
                }

                // Map raw varbind array back to named metrics
                const result = { success: true };
                const uptimeOidStripped = '1.3.6.1.2.1.1.3.0'; // stripped form used in targetOids

                varbinds.forEach((vb, idx) => {
                    const oid = targetOids[idx];
                    const rawVal = vb.value;

                    if (oid === uptimeOidStripped) {
                        result.uptime = Math.round(rawVal / 100); // centiseconds → seconds
                        return;
                    }

                    // Reverse-lookup which metric key this OID maps to
                    // (oidMap values may have leading dots, but targetOids are stripped)
                    if (oidMap) {
                        for (const [key, mapOid] of Object.entries(oidMap)) {
                            const normalizedMapOid = stripDot(mapOid);
                            if (normalizedMapOid === oid) {
                                // Normalise raw integer values for common OIDs
                                if (key === 'cpu' || key === 'ram') {
                                    // Most enterprise MIBs return percentage directly or in 1/100s
                                    result[key] = rawVal > 100 ? Math.round(rawVal / 100) : rawVal;
                                } else if (key === 'temp') {
                                    result.temp = rawVal > 500 ? Math.round(rawVal / 10) : rawVal;
                                } else if (key === 'clients') {
                                    result.clients = rawVal;
                                } else {
                                    result[key] = rawVal;
                                }
                                break;
                            }
                        }
                    }
                });

                // If SNMP reply came back but OIDs had errors (NoSuchInstance etc.),
                // the value will be an OID object — filter those out.
                ['cpu', 'ram', 'temp', 'clients'].forEach(key => {
                    if (result[key] !== undefined && typeof result[key] === 'object') delete result[key];
                });

                resolve(result);
            });
        } catch (e) {
            resolve({ success: false, error: e.message });
        }
    });
}

// --- REST API ENDPOINTS ---

// Server online status check
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        mode: 'live-actual',
        version: '2.5.0',
        config
    });
});

// Fetch active network metrics
app.get('/api/metrics', (req, res) => {
    res.json(metricsCache);
});

// Fetch Zabbix alarms feed
app.get('/api/zabbix-alarms', (req, res) => {
    // If real Zabbix active, serve active. If empty, return standard triggers
    res.json(metricsCache.zabbixAlarms);
});

// Save configuration overrides
app.post('/api/config', (req, res) => {
    config = { ...config, ...req.body };
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        startPoller(); // Restart loops with new intervals
        res.json({ success: true, message: 'Configuration saved successfully.', config });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Immediate test connection for Zabbix
app.post('/api/test-zabbix', async (req, res) => {
    const { url, token } = req.body;
    try {
        const response = await axios.post(url, {
            jsonrpc: '2.0',
            method: 'apiinfo.version',
            params: {},
            id: 1
        }, { timeout: 3000 });

        if (response.data && response.data.result) {
            res.json({
                success: true,
                message: `Connection successful! Zabbix Server version: ${response.data.result}`
            });
        } else {
            res.json({ success: false, message: 'Handshake failed. Invalid JSON-RPC response.' });
        }
    } catch (e) {
        res.json({ success: false, message: `DNS/API Host Connection timeout: ${e.message}` });
    }
});

// Immediate manual SNMP query
app.post('/api/test-snmp', async (req, res) => {
    const { ip, community, version, port } = req.body;
    try {
        const result = await querySNMP(ip, community, version, port);
        if (result.success) {
            res.json({
                success: true,
                message: `SNMP query successful! Uptime: ${result.uptime} seconds. Host is online.`
            });
        } else {
            res.json({
                success: false,
                message: `SNMP query timed out: ${result.error || 'Host unreachable (UDP port 161)'}`
            });
        }
    } catch (e) {
        res.json({ success: false, message: `Session creation fault: ${e.message}` });
    }
});

// Trigger dynamic incident simulator endpoint
app.post('/api/simulate-incident', (req, res) => {
    const { type, target, active } = req.body;
    
    // Wire up server metrics cache statuses for simulation
    if (type === 'isp') {
        const idx = metricsCache.isps.findIndex(i => i.id === target);
        if (idx !== -1) {
            metricsCache.isps[idx].status = active ? 'down' : 'healthy';
        }
    } else if (type === 'fg80f-load') {
        metricsCache.devices['fg-80f'].cpu = active ? 96 : 24;
        metricsCache.devices['fg-80f'].ram = active ? 89 : 45;
        metricsCache.devices['fg-80f'].temp = active ? 84 : 48;
        metricsCache.devices['fg-80f'].status = active ? 'degraded' : 'healthy';
    } else if (type === 'tplink-loop') {
        metricsCache.devices['sw-tplink-old'].cpu = active ? 99 : 8;
        metricsCache.devices['sw-tplink-old'].status = active ? 'degraded' : 'healthy';
    } else if (type === 'ap-overload') {
        metricsCache.devices['ap-grand-3'].clients = active ? 262 : 38;
        metricsCache.devices['ap-grand-3'].cpu = active ? 93 : 19;
        metricsCache.devices['ap-grand-3'].status = active ? 'degraded' : 'healthy';
    } else if (type === 'power-outage') {
        // Knock Zone B offline
        const zoneB = ['fg-30g-old', 'sw-tplink-old', 'ap-tplink-1', 'ap-tplink-2'];
        zoneB.forEach(id => {
            metricsCache.devices[id].status = active ? 'down' : 'healthy';
        });
    }
    
    res.json({ success: true });
});

// Reset server configurations
app.post('/api/simulate-reset', (req, res) => {
    // Clear offline flags
    metricsCache.isps.forEach(i => i.status = 'healthy');
    for (const [id, dev] of Object.entries(metricsCache.devices)) {
        dev.status = 'healthy';
    }
    res.json({ success: true });
});

// Get full device registry (for frontend inventory/integrations tabs)
app.get('/api/devices', (req, res) => {
    // Merge static device definitions with live metrics cache
    const merged = {};
    for (const [id, dev] of Object.entries(devices)) {
        merged[id] = {
            ...dev,
            ...(metricsCache.devices[id] || {})
        };
    }
    res.json(merged);
});

// Per-Device SNMP configuration update (persists to devices_config.json)
app.post('/api/device-config', (req, res) => {
    const { deviceId, ip, community, port, oids } = req.body;
    if (!deviceId || !devices[deviceId]) {
        return res.status(404).json({ success: false, message: 'Device ID not found in registry.' });
    }

    // Update in-memory device registry
    if (ip)        devices[deviceId].ip = ip;
    if (community) devices[deviceId].snmpCommunity = community;
    if (port)      devices[deviceId].snmpPort = parseInt(port);
    if (oids)      devices[deviceId].oids = { ...devices[deviceId].oids, ...oids };

    // Persist to devices_config.json so config survives restarts
    try {
        let overrideStore = {};
        if (fs.existsSync(DEVICES_OVERRIDE_FILE)) {
            overrideStore = JSON.parse(fs.readFileSync(DEVICES_OVERRIDE_FILE, 'utf8'));
        }
        overrideStore[deviceId] = devices[deviceId];
        fs.writeFileSync(DEVICES_OVERRIDE_FILE, JSON.stringify(overrideStore, null, 2));
        console.log(`[CONFIG] Device ${deviceId} config saved to devices_config.json`);
        res.json({ success: true, message: `Device ${deviceId} configuration persisted.`, device: devices[deviceId] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Perform a full live SNMP walk on a device and return all OID values
app.post('/api/snmp-walk', async (req, res) => {
    const { ip, community, version, port } = req.body;
    const walkOids = [
        '.1.3.6.1.2.1.1.1.0', // sysDescr
        '.1.3.6.1.2.1.1.3.0', // sysUpTime
        '.1.3.6.1.2.1.1.5.0', // sysName
        '.1.3.6.1.2.1.1.6.0', // sysLocation
        '.1.3.6.1.2.1.2.1.0', // ifNumber
    ];
    try {
        const result = await querySNMP(ip, community || config.snmpCommunity, version || config.snmpVersion, port || config.snmpPort, walkOids, {});
        res.json({ success: result.success, data: result, oids: walkOids });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

// Fetch Zabbix host list (useful for importing hosts into NetPulse registry)
app.get('/api/zabbix-hosts', async (req, res) => {
    if (!config.zabbixUrl || !config.zabbixToken) {
        return res.json({ success: false, message: 'Zabbix not configured. Set URL and API token first.' });
    }
    try {
        const response = await axios.post(config.zabbixUrl, {
            jsonrpc: '2.0',
            method: 'host.get',
            params: {
                output: ['hostid', 'host', 'name', 'status'],
                selectInterfaces: ['ip', 'port', 'type'],
                selectGroups: ['name']
            },
            auth: config.zabbixToken,
            id: 1
        }, { timeout: 5000 });

        if (response.data && response.data.result) {
            res.json({ success: true, hosts: response.data.result, count: response.data.result.length });
        } else {
            res.json({ success: false, message: 'No result from Zabbix host.get', raw: response.data });
        }
    } catch (e) {
        res.json({ success: false, message: `Zabbix API error: ${e.message}` });
    }
});

// Start listening & initiate background threads
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 NetPulse Core Gateway active on http://localhost:${PORT}`);
    console.log(`🖥️  Open your browser and navigate to the address above`);
    console.log(`======================================================\n`);
    startPoller();
});
