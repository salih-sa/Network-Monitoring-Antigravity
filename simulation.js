/* ----------------------------------------------------
   NetPulse Core Network Simulator Engine - simulation.js
   ---------------------------------------------------- */

class NetworkSimulator {
    constructor() {
        this.initializeData();
        this.startTick();
    }

    initializeData() {
        // Time states
        this.startTime = Date.now();
        this.tickCount = 0;
        this.slaWindowStart = 8;  // 08:00
        this.slaWindowEnd = 18;  // 18:00
        
        // SLA calculations
        this.totalSlaSeconds = 0;
        this.downtimeSlaSeconds = 0;
        
        // System Config Thresholds
        this.thresholds = {
            latency: 80, // ms
            loss: 2, // %
            cpu: 85, // %
            temp: 75 // °C
        };

        // Active Simulator Incident Flags
        this.incidents = {
            ispOutages: {}, // e.g. { 'isp-1': true }
            fg80fOverloaded: false,
            tplinkLoop: false,
            apOverload: false,
            powerOutage: false
        };

        // Multi-Branch Setup Definitions
        this.branches = {
            'branch-alpha': {
                name: 'HQ - Corporate Offices',
                isps: ['isp-1', 'isp-2', 'isp-3', 'isp-4', 'isp-5', 'isp-6', 'isp-7', 'isp-8'],
                devices: ['fg-80f', 'sw-instant-on', 'ap-grand-1', 'ap-grand-2', 'ap-grand-3', 'ap-grand-4', 'fg-30g-old', 'sw-tplink-old', 'ap-tplink-1', 'ap-tplink-2', 'fg-30g-new', 'sw-tplink-new', 'ap-grand-new-1']
            },
            'branch-beta': {
                name: 'Branch Beta - Logistics Hub',
                isps: ['isp-beta-1', 'isp-beta-2'],
                devices: ['fg-beta-60f', 'sw-beta-jet', 'ap-beta-1', 'ap-beta-2', 'ap-beta-3']
            },
            'branch-gamma': {
                name: 'Branch Gamma - Retail Site',
                isps: ['isp-gamma-1'],
                devices: ['fg-gamma-40f', 'sw-gamma-tplink', 'ap-gamma-1', 'ap-gamma-2']
            }
        };
        this.activeBranch = 'branch-alpha';

        // Initialize Devices state (Enterprise Registry)
        this.devices = {
            // ================= BRANCH ALPHA (HQ) =================
            // Second & Third Floor (Zone A)
            'fg-80f': {
                id: 'fg-80f',
                name: 'FortiGate 80F Gateway',
                type: 'firewall',
                brand: 'Fortinet',
                model: 'FortiGate 80F',
                ip: '192.168.10.1',
                zone: 'Second & Third Floor',
                uptime: 3658200, // seconds
                cpu: 28,
                ram: 45,
                temp: 48,
                status: 'healthy',
                description: 'FortiOS v7.2.4 Build 1396 (GA)',
                ports: [
                    { name: 'wan1', label: 'ISP 1 (Fiber)', status: 'up', speed: '1000M', rx: 245.2, tx: 38.4 },
                    { name: 'wan2', label: 'ISP 2 (Fiber)', status: 'up', speed: '200M', rx: 12.8, tx: 2.1 },
                    { name: 'wan3', label: 'ISP 3 (Coax)', status: 'up', speed: '100M', rx: 0.5, tx: 0.1 },
                    { name: 'wan4', label: 'ISP 4 (5G)', status: 'up', speed: '50M', rx: 0.0, tx: 0.0 },
                    { name: 'internal1', label: 'Core Switch', status: 'up', speed: '1G', rx: 185.3, tx: 195.4 }
                ],
                oids: {
                    uptime: '.1.3.6.1.2.1.1.3.0',
                    cpu: '.1.3.6.1.4.1.12356.101.4.1.3.0',
                    ram: '.1.3.6.1.4.1.12356.101.4.1.4.0',
                    temp: '.1.3.6.1.4.1.12356.101.4.3.2.0'
                }
            },
            'sw-instant-on': {
                id: 'sw-instant-on',
                name: 'Aruba Instant On Switch',
                type: 'switch',
                brand: 'Aruba',
                model: 'JL681A 1930 24G PoE',
                ip: '192.168.10.2',
                zone: 'Second & Third Floor',
                uptime: 1485600,
                cpu: 15,
                ram: 32,
                temp: 39,
                status: 'healthy',
                description: 'ArubaOS-S Version 1.0.8',
                ports: [
                    { name: 'port1', label: 'Uplink FG-80F', status: 'up', speed: '1G', rx: 195.4, tx: 185.3 },
                    { name: 'port5', label: 'Grandstream AP 1', status: 'up', speed: '1G (PoE)', rx: 42.1, tx: 38.6 },
                    { name: 'port6', label: 'Grandstream AP 2', status: 'up', speed: '1G (PoE)', rx: 31.5, tx: 25.8 },
                    { name: 'port7', label: 'Grandstream AP 3', status: 'up', speed: '1G (PoE)', rx: 89.2, tx: 92.4 },
                    { name: 'port8', label: 'Grandstream AP 4', status: 'up', speed: '1G (PoE)', rx: 22.6, tx: 38.6 }
                ],
                oids: {
                    uptime: '.1.3.6.1.2.1.1.3.0',
                    cpu: '.1.3.6.1.2.1.25.3.3.1.2.1',
                    ram: '.1.3.6.1.2.1.25.2.3.1.6.1',
                    temp: '.1.3.6.1.4.1.14823.2.2.1.1.1.1.1.0'
                }
            },
            'ap-grand-1': { id: 'ap-grand-1', name: 'Grandstream AP 1', type: 'ap', brand: 'Grandstream', model: 'GWN7660 Wi-Fi 6', ip: '192.168.10.11', zone: 'Second & Third Floor', uptime: 1258600, cpu: 18, ram: 42, status: 'healthy', clients: 24, description: 'GWN Firmware 1.0.23', oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.20948.1.1.1.1.0', ram: '.1.3.6.1.4.1.20948.1.1.1.2.0', clients: '.1.3.6.1.4.1.20948.1.1.2.1.0' } },
            'ap-grand-2': { id: 'ap-grand-2', name: 'Grandstream AP 2', type: 'ap', brand: 'Grandstream', model: 'GWN7660 Wi-Fi 6', ip: '192.168.10.12', zone: 'Second & Third Floor', uptime: 1258500, cpu: 12, ram: 38, status: 'healthy', clients: 16, description: 'GWN Firmware 1.0.23', oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.20948.1.1.1.1.0', ram: '.1.3.6.1.4.1.20948.1.1.1.2.0', clients: '.1.3.6.1.4.1.20948.1.1.2.1.0' } },
            'ap-grand-3': { id: 'ap-grand-3', name: 'Grandstream AP 3', type: 'ap', brand: 'Grandstream', model: 'GWN7660 Wi-Fi 6', ip: '192.168.10.13', zone: 'Second & Third Floor', uptime: 1258700, cpu: 22, ram: 48, status: 'healthy', clients: 42, description: 'GWN Firmware 1.0.23', oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.20948.1.1.1.1.0', ram: '.1.3.6.1.4.1.20948.1.1.1.2.0', clients: '.1.3.6.1.4.1.20948.1.1.2.1.0' } },
            'ap-grand-4': { id: 'ap-grand-4', name: 'Grandstream AP 4', type: 'ap', brand: 'Grandstream', model: 'GWN7630 Wi-Fi 5', ip: '192.168.10.14', zone: 'Second & Third Floor', uptime: 958200, cpu: 25, ram: 51, status: 'healthy', clients: 11, description: 'GWN Firmware 1.0.21', oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.20948.1.1.1.1.0', ram: '.1.3.6.1.4.1.20948.1.1.1.2.0', clients: '.1.3.6.1.4.1.20948.1.1.2.1.0' } },

            // First Floor Old Wing (Zone B)
            'fg-30g-old': {
                id: 'fg-30g-old',
                name: 'FortiGate 30G Old Office',
                type: 'firewall',
                brand: 'Fortinet',
                model: 'FortiGate 30G',
                ip: '192.168.20.1',
                zone: 'First Floor (Old Wing)',
                uptime: 458600,
                cpu: 32,
                ram: 52,
                temp: 41,
                status: 'healthy',
                description: 'FortiOS v7.0.12 Build 0451 (GA)',
                ports: [
                    { name: 'wan1', label: 'ISP 5 (Fiber Old)', status: 'up', speed: '300M', rx: 45.8, tx: 12.4 },
                    { name: 'wan2', label: 'ISP 6 (DSL Old)', status: 'up', speed: '80M', rx: 0.4, tx: 0.1 },
                    { name: 'lan', label: 'TP-Link Sw Old', status: 'up', speed: '1G', rx: 46.2, tx: 12.5 }
                ],
                oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.12356.101.4.1.3.0', ram: '.1.3.6.1.4.1.12356.101.4.1.4.0' }
            },
            'sw-tplink-old': {
                id: 'sw-tplink-old',
                name: 'TP-Link Switch Old Office',
                type: 'switch',
                brand: 'TP-Link',
                model: 'TL-SG3428X PoE',
                ip: '192.168.20.2',
                zone: 'First Floor (Old Wing)',
                uptime: 846200,
                cpu: 8,
                ram: 22,
                temp: 34,
                status: 'healthy',
                description: 'JetStream OS Build 20230628',
                ports: [
                    { name: 'port1', label: 'Uplink FG-30G', status: 'up', speed: '1G', rx: 12.5, tx: 46.2 },
                    { name: 'port10', label: 'TP-Link AP 1', status: 'up', speed: '1G (PoE)', rx: 14.2, tx: 3.4 },
                    { name: 'port11', label: 'TP-Link AP 2', status: 'up', speed: '1G (PoE)', rx: 18.5, tx: 5.1 }
                ],
                oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.11863.6.1.1.1.0', ram: '.1.3.6.1.4.1.11863.6.1.1.2.0' }
            },
            'ap-tplink-1': { id: 'ap-tplink-1', name: 'TP-Link AP 1', type: 'ap', brand: 'TP-Link', model: 'EAP245 AC1750', ip: '192.168.20.11', zone: 'First Floor (Old Wing)', uptime: 846100, cpu: 14, ram: 28, status: 'healthy', clients: 12, description: 'Omada OS v5.0', oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.2.1.25.3.3.1.2.1', ram: '.1.3.6.1.2.1.25.2.3.1.6.1' } },
            'ap-tplink-2': { id: 'ap-tplink-2', name: 'TP-Link AP 2', type: 'ap', brand: 'TP-Link', model: 'EAP245 AC1750', ip: '192.168.20.12', zone: 'First Floor (Old Wing)', uptime: 846100, cpu: 19, ram: 31, status: 'healthy', clients: 7, description: 'Omada OS v5.0', oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.2.1.25.3.3.1.2.1', ram: '.1.3.6.1.2.1.25.2.3.1.6.1' } },

            // First Floor New Wing (Zone C)
            'fg-30g-new': {
                id: 'fg-30g-new',
                name: 'FortiGate 30G New Office',
                type: 'firewall',
                brand: 'Fortinet',
                model: 'FortiGate 30G',
                ip: '192.168.30.1',
                zone: 'First Floor (New Wing)',
                uptime: 684200,
                cpu: 20,
                ram: 45,
                temp: 38,
                status: 'healthy',
                description: 'FortiOS v7.2.2 Build 1285 (GA)',
                ports: [
                    { name: 'wan1', label: 'ISP 7 (Fiber New)', status: 'up', speed: '500M', rx: 112.5, tx: 18.4 },
                    { name: 'wan2', label: 'ISP 8 (5G Gateway)', status: 'up', speed: '100M', rx: 0.1, tx: 0.0 },
                    { name: 'lan', label: 'TP-Link Sw New', status: 'up', speed: '1G', rx: 112.6, tx: 18.4 }
                ],
                oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.12356.101.4.1.3.0', ram: '.1.3.6.1.4.1.12356.101.4.1.4.0' }
            },
            'sw-tplink-new': {
                id: 'sw-tplink-new',
                name: 'TP-Link Switch New Office',
                type: 'switch',
                brand: 'TP-Link',
                model: 'TL-SG2428P PoE v5',
                ip: '192.168.30.2',
                zone: 'First Floor (New Wing)',
                uptime: 684100,
                cpu: 5,
                ram: 16,
                temp: 30,
                status: 'healthy',
                description: 'JetStream OS Build 20240112',
                ports: [
                    { name: 'port1', label: 'Uplink FG-30G', status: 'up', speed: '1G', rx: 18.4, tx: 112.6 },
                    { name: 'port8', label: 'Grandstream AP New', status: 'up', speed: '1G (PoE)', rx: 84.1, tx: 12.8 }
                ],
                oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.11863.6.1.1.1.0', ram: '.1.3.6.1.4.1.11863.6.1.1.2.0' }
            },
            'ap-grand-new-1': { id: 'ap-grand-new-1', name: 'Grandstream AP New Wing', type: 'ap', brand: 'Grandstream', model: 'GWN7660 Wi-Fi 6', ip: '192.168.30.11', zone: 'First Floor (New Wing)', uptime: 684000, cpu: 14, ram: 39, status: 'healthy', clients: 28, description: 'GWN Firmware 1.0.23', oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.20948.1.1.1.1.0', ram: '.1.3.6.1.4.1.20948.1.1.1.2.0', clients: '.1.3.6.1.4.1.20948.1.1.2.1.0' } },

            // ================= BRANCH BETA (LOGISTICS) =================
            'fg-beta-60f': {
                id: 'fg-beta-60f',
                name: 'FortiGate 60F Logistics',
                type: 'firewall',
                brand: 'Fortinet',
                model: 'FortiGate 60F',
                ip: '192.168.40.1',
                zone: 'Logistics Center',
                uptime: 842000,
                cpu: 14,
                ram: 38,
                temp: 42,
                status: 'healthy',
                description: 'FortiOS v7.0.9 Build 0382 (GA)',
                ports: [
                    { name: 'wan1', label: 'ISP Beta 1 (Fiber)', status: 'up', speed: '500M', rx: 84.2, tx: 11.2 },
                    { name: 'wan2', label: 'ISP Beta 2 (4G)', status: 'up', speed: '30M', rx: 0.0, tx: 0.0 },
                    { name: 'lan', label: 'TP-Link Sw Beta', status: 'up', speed: '1G', rx: 84.2, tx: 11.2 }
                ],
                oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.12356.101.4.1.3.0', ram: '.1.3.6.1.4.1.12356.101.4.1.4.0' }
            },
            'sw-beta-jet': {
                id: 'sw-beta-jet',
                name: 'Logistics Core Switch',
                type: 'switch',
                brand: 'TP-Link',
                model: 'TL-SG3428X v2',
                ip: '192.168.40.2',
                zone: 'Logistics Center',
                uptime: 1258600,
                cpu: 5,
                ram: 18,
                temp: 30,
                status: 'healthy',
                description: 'JetStream OS Build 20240112',
                ports: [
                    { name: 'port1', label: 'Uplink FG-60F', status: 'up', speed: '1G', rx: 11.2, tx: 84.2 },
                    { name: 'port5', label: 'AP Beta 1', status: 'up', speed: '1G (PoE)', rx: 24.2, tx: 2.1 },
                    { name: 'port6', label: 'AP Beta 2', status: 'up', speed: '1G (PoE)', rx: 12.1, tx: 1.2 },
                    { name: 'port7', label: 'AP Beta 3', status: 'up', speed: '1G (PoE)', rx: 32.5, tx: 3.4 }
                ],
                oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.11863.6.1.1.1.0', ram: '.1.3.6.1.4.1.11863.6.1.1.2.0' }
            },
            'ap-beta-1': { id: 'ap-beta-1', name: 'AP Beta Office', type: 'ap', brand: 'Grandstream', model: 'GWN7660 Wi-Fi 6', ip: '192.168.40.11', zone: 'Logistics Center', uptime: 842000, cpu: 11, ram: 35, status: 'healthy', clients: 18, description: 'GWN Firmware 1.0.23', oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.20948.1.1.1.1.0', ram: '.1.3.6.1.4.1.20948.1.1.1.2.0', clients: '.1.3.6.1.4.1.20948.1.1.2.1.0' } },
            'ap-beta-2': { id: 'ap-beta-2', name: 'AP Beta Warehouse 1', type: 'ap', brand: 'Grandstream', model: 'GWN7660 Wi-Fi 6', ip: '192.168.40.12', zone: 'Logistics Center', uptime: 842000, cpu: 18, ram: 42, status: 'healthy', clients: 29, description: 'GWN Firmware 1.0.23', oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.20948.1.1.1.1.0', ram: '.1.3.6.1.4.1.20948.1.1.1.2.0', clients: '.1.3.6.1.4.1.20948.1.1.2.1.0' } },
            'ap-beta-3': { id: 'ap-beta-3', name: 'AP Beta Loading Dock', type: 'ap', brand: 'Grandstream', model: 'GWN7630 Wi-Fi 5', ip: '192.168.40.13', zone: 'Logistics Center', uptime: 842000, cpu: 22, ram: 45, status: 'healthy', clients: 14, description: 'GWN Firmware 1.0.21', oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.20948.1.1.1.1.0', ram: '.1.3.6.1.4.1.20948.1.1.1.2.0', clients: '.1.3.6.1.4.1.20948.1.1.2.1.0' } },

            // ================= BRANCH GAMMA (RETAIL) =================
            'fg-gamma-40f': {
                id: 'fg-gamma-40f',
                name: 'FortiGate 40F Retail Store',
                type: 'firewall',
                brand: 'Fortinet',
                model: 'FortiGate 40F',
                ip: '192.168.50.1',
                zone: 'Retail Outlet',
                uptime: 524000,
                cpu: 10,
                ram: 32,
                temp: 38,
                status: 'healthy',
                description: 'FortiOS v7.0.6 Build 0285 (GA)',
                ports: [
                    { name: 'wan1', label: 'ISP Gamma 1 (GPON)', status: 'up', speed: '100M', rx: 14.5, tx: 1.8 },
                    { name: 'lan', label: 'Switch Gamma', status: 'up', speed: '1G', rx: 14.5, tx: 1.8 }
                ],
                oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.12356.101.4.1.3.0', ram: '.1.3.6.1.4.1.12356.101.4.1.4.0' }
            },
            'sw-gamma-tplink': {
                id: 'sw-gamma-tplink',
                name: 'Retail Outlet Switch',
                type: 'switch',
                brand: 'TP-Link',
                model: 'TL-SG2428P PoE',
                ip: '192.168.50.2',
                zone: 'Retail Outlet',
                uptime: 824000,
                cpu: 4,
                ram: 16,
                temp: 29,
                status: 'healthy',
                description: 'JetStream OS Build 20240112',
                ports: [
                    { name: 'port1', label: 'Uplink FG-40F', status: 'up', speed: '1G', rx: 1.8, tx: 14.5 },
                    { name: 'port4', label: 'AP Gamma 1', status: 'up', speed: '1G (PoE)', rx: 6.2, tx: 0.8 },
                    { name: 'port5', label: 'AP Gamma 2', status: 'up', speed: '1G (PoE)', rx: 8.3, tx: 1.0 }
                ],
                oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.4.1.11863.6.1.1.1.0', ram: '.1.3.6.1.4.1.11863.6.1.1.2.0' }
            },
            'ap-gamma-1': { id: 'ap-gamma-1', name: 'AP Gamma Front Desk', type: 'ap', brand: 'TP-Link', model: 'EAP245 AC1750', ip: '192.168.50.11', zone: 'Retail Outlet', uptime: 824000, cpu: 12, ram: 25, status: 'healthy', clients: 22, description: 'Omada OS v5.0', oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.2.1.25.3.3.1.2.1', ram: '.1.3.6.1.2.1.25.2.3.1.6.1' } },
            'ap-gamma-2': { id: 'ap-gamma-2', name: 'AP Gamma Showroom', type: 'ap', brand: 'TP-Link', model: 'EAP245 AC1750', ip: '192.168.50.12', zone: 'Retail Outlet', uptime: 824000, cpu: 15, ram: 28, status: 'healthy', clients: 34, description: 'Omada OS v5.0', oids: { uptime: '.1.3.6.1.2.1.1.3.0', cpu: '.1.3.6.1.2.1.25.3.3.1.2.1', ram: '.1.3.6.1.2.1.25.2.3.1.6.1' } }
        };

        // Initialize All ISPs (Enterprise Core Trunks)
        this.isps = [
            // HQ ISPs
            { id: 'isp-1', name: 'ISP 1 - Primary Fiber (1G)', provider: 'Tata Communications', type: 'Fiber (GPON)', targetDevice: 'fg-80f', port: 'wan1', bandwidth: 1000, latency: 12, loss: 0, speedOut: 245.2, speedIn: 38.4, status: 'healthy', zone: 'Second & Third Floor', history: Array(20).fill(12) },
            { id: 'isp-2', name: 'ISP 2 - Backup Fiber (200M)', provider: 'Airtel Enterprise', type: 'Fiber (LL)', targetDevice: 'fg-80f', port: 'wan2', bandwidth: 200, latency: 15, loss: 0, speedOut: 12.8, speedIn: 2.1, status: 'healthy', zone: 'Second & Third Floor', history: Array(20).fill(15) },
            { id: 'isp-3', name: 'ISP 3 - Broadband Coax (100M)', provider: 'ACT Fibernet', type: 'Cable Coaxial', targetDevice: 'fg-80f', port: 'wan3', bandwidth: 100, latency: 22, loss: 0, speedOut: 0.5, speedIn: 0.1, status: 'healthy', zone: 'Second & Third Floor', history: Array(20).fill(22) },
            { id: 'isp-4', name: 'ISP 4 - 5G Failover (50M)', provider: 'Jio Business 5G', type: 'Cellular 5G', targetDevice: 'fg-80f', port: 'wan4', bandwidth: 50, latency: 42, loss: 0, speedOut: 0.0, speedIn: 0.0, status: 'healthy', zone: 'Second & Third Floor', history: Array(20).fill(42) },
            { id: 'isp-5', name: 'ISP 5 - Old Office Fiber (300M)', provider: 'Spectra Net', type: 'Fiber (GPON)', targetDevice: 'fg-30g-old', port: 'wan1', bandwidth: 300, latency: 14, loss: 0, speedOut: 45.8, speedIn: 12.4, status: 'healthy', zone: 'First Floor (Old Wing)', history: Array(20).fill(14) },
            { id: 'isp-6', name: 'ISP 6 - Old Office DSL (80M)', provider: 'BSNL Broadband', type: 'DSL Copper', targetDevice: 'fg-30g-old', port: 'wan2', bandwidth: 80, latency: 34, loss: 0, speedOut: 0.4, speedIn: 0.1, status: 'healthy', zone: 'First Floor (Old Wing)', history: Array(20).fill(34) },
            { id: 'isp-7', name: 'ISP 7 - New Office Fiber (500M)', provider: 'Airtel Broadband', type: 'Fiber (GPON)', targetDevice: 'fg-30g-new', port: 'wan1', bandwidth: 500, latency: 10, loss: 0, speedOut: 112.5, speedIn: 18.4, status: 'healthy', zone: 'First Floor (New Wing)', history: Array(20).fill(10) },
            { id: 'isp-8', name: 'ISP 8 - New Office 5G (100M)', provider: 'Jio Business 5G', type: 'Cellular 5G', targetDevice: 'fg-30g-new', port: 'wan2', bandwidth: 100, latency: 38, loss: 0, speedOut: 0.1, speedIn: 0.0, status: 'healthy', zone: 'First Floor (New Wing)', history: Array(20).fill(38) },

            // BETA ISPs
            { id: 'isp-beta-1', name: 'ISP Beta 1 - primary (500M)', provider: 'Bharti Airtel', type: 'Fiber (LL)', targetDevice: 'fg-beta-60f', port: 'wan1', bandwidth: 500, latency: 14, loss: 0, speedOut: 84.2, speedIn: 11.2, status: 'healthy', zone: 'Logistics Center', history: Array(20).fill(14) },
            { id: 'isp-beta-2', name: 'ISP Beta 2 - LTE backup (30M)', provider: 'Vodafone Idea', type: 'Cellular LTE', targetDevice: 'fg-beta-60f', port: 'wan2', bandwidth: 30, latency: 45, loss: 0, speedOut: 0.0, speedIn: 0.0, status: 'healthy', zone: 'Logistics Center', history: Array(20).fill(45) },

            // GAMMA ISPs
            { id: 'isp-gamma-1', name: 'ISP Gamma 1 - primary (100M)', provider: 'Excitel Broadband', type: 'Fiber (GPON)', targetDevice: 'fg-gamma-40f', port: 'wan1', bandwidth: 100, latency: 18, loss: 0, speedOut: 14.5, speedIn: 1.8, status: 'healthy', zone: 'Retail Outlet', history: Array(20).fill(18) }
        ];

        // Zabbix active alarms (starts empty)
        this.zabbixAlarms = [];
        this.alarmsHistory = [
            { id: 'hist-1', device: 'FortiGate 80F Gateway', event: 'WAN interface wan3 transition back UP', severity: 'info', status: 'resolved', triggeredAt: '2026-05-22T08:12:00Z', resolvedAt: '2026-05-22T08:12:30Z' },
            { id: 'hist-2', device: 'Grandstream AP 4', event: 'Device rebooted due to firmware upgrade', severity: 'average', status: 'resolved', triggeredAt: '2026-05-21T23:30:00Z', resolvedAt: '2026-05-21T23:45:00Z' },
            { id: 'hist-3', device: 'BSNL Broadband DSL', event: 'High packet loss on ISP 6 gateway link (>10%)', severity: 'high', status: 'resolved', triggeredAt: '2026-05-21T14:22:00Z', resolvedAt: '2026-05-21T15:10:00Z' }
        ];

        // Real-time graph aggregations
        this.chartHistory = {
            latency: Array(15).fill(14),
            load: Array(15).fill(45)
        };
    }}

    startTick() {
        this.timer = setInterval(() => this.tick(), 2000);
    }

    stopTick() {
        clearInterval(this.timer);
    }

    tick() {
        this.tickCount++;
        
        // SLA Timer
        const currentHour = new Date().getHours();
        const isSlaHours = currentHour >= this.slaWindowStart && currentHour < this.slaWindowEnd;
        const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
        
        if (isSlaHours && !isWeekend) {
            this.totalSlaSeconds += 2;
            // Check if any major node or primary ISP is down
            const isPrimaryDown = this.isps[0].status === 'down' || this.devices['fg-80f'].status === 'down';
            if (isPrimaryDown) {
                this.downtimeSlaSeconds += 2;
            }
        }

        // Apply real-time fluctuations to all components
        this.updateISPMetrics();
        this.updateDeviceMetrics();
        
        // Re-calculate aggregate indicators
        this.updateSystemAggregates();
        
        // Notify UI about state changes
        if (window.onSimulationUpdate) {
            window.onSimulationUpdate();
        }
    }

    // Incidents actions
    triggerIncident(type, target = null) {
        let title = '';
        let desc = '';
        let severity = 'average';

        if (type === 'isp') {
            const idx = this.isps.findIndex(i => i.id === target);
            if (idx !== -1) {
                this.incidents.ispOutages[target] = true;
                title = `WAN Port Outage detected`;
                desc = `Zabbix trigger alert: connection to ISP [${this.isps[idx].name}] gateway failed host pings.`;
                severity = 'disaster';
                this.logSimEvent(`[INCIDENT] ${this.isps[idx].name} gateway link severed. Ping timeouts.`, 'red');
            }
        } else if (type === 'fg80f-load') {
            this.incidents.fg80fOverloaded = true;
            title = `FortiGate 80F High Resource Utilisation`;
            desc = `SNMP Poll alert: CPU usage exceeds ${this.thresholds.cpu}% threshold (polled ${this.devices['fg-80f'].ip})`;
            severity = 'high';
            this.logSimEvent(`[INCIDENT] High memory loop and cryptoprocess spikes on FortiGate 80F CPU.`, 'orange');
        } else if (type === 'tplink-loop') {
            this.incidents.tplinkLoop = true;
            title = `Layer 2 Switching Loop Detected`;
            desc = `Omada storm control triggered: Spanning tree recalculation on switch TL-SG3428X. Broadcast storm.`;
            severity = 'high';
            this.logSimEvent(`[INCIDENT] Packet loop injected into First Floor Old switch. Port rates 100% capacity.`, 'orange');
        } else if (type === 'ap-overload') {
            this.incidents.apOverload = true;
            title = `High Client Association Limit Exceeded`;
            desc = `Grandstream AP 3 reported ${260} connected wireless leases. Radio noise floor highly degraded.`;
            severity = 'average';
            this.logSimEvent(`[INCIDENT] Wi-Fi overload event: AP 3 client count spikes. Latency degraded.`, 'orange');
        } else if (type === 'power-outage') {
            this.incidents.powerOutage = true;
            title = `Floor 1 Old Network Zone DOWN`;
            desc = `SNMP Engine lost communication to all nodes in 192.168.20.0/24. Host unreachable. Power failure suspected.`;
            severity = 'disaster';
            this.logSimEvent(`[INCIDENT] Power supply interrupted on First Floor Old Wing. Firewall and Switches offline.`, 'red');
        }

        // Add to active alarms
        if (title) {
            this.addActiveAlarm(type, target, title, desc, severity);
        }
    }

    resolveIncident(type, target = null) {
        if (type === 'isp') {
            delete this.incidents.ispOutages[target];
            const idx = this.isps.findIndex(i => i.id === target);
            if (idx !== -1) {
                this.resolveActiveAlarm(type, target, `[RESOLVED] ${this.isps[idx].name} link recovered. Gateway route verified.`);
            }
        } else if (type === 'fg80f-load') {
            this.incidents.fg80fOverloaded = false;
            this.resolveActiveAlarm(type, null, `[RESOLVED] CPU and Memory processes returned to baseline limits on FortiGate 80F.`);
        } else if (type === 'tplink-loop') {
            this.incidents.tplinkLoop = false;
            this.resolveActiveAlarm(type, null, `[RESOLVED] STP topology stabilized. Loop cleared on TL-SG3428X Switch.`);
        } else if (type === 'ap-overload') {
            this.incidents.apOverload = false;
            this.resolveActiveAlarm(type, null, `[RESOLVED] Client leases rebalanced. GWN7660 client count reduced to safe operational limits.`);
        } else if (type === 'power-outage') {
            this.incidents.powerOutage = false;
            this.resolveActiveAlarm(type, null, `[RESOLVED] Auxiliary power grid restored on First Floor Old Wing. SNMP agents online.`);
        }
    }

    restoreAll() {
        this.incidents.fg80fOverloaded = false;
        this.incidents.tplinkLoop = false;
        this.incidents.apOverload = false;
        this.incidents.powerOutage = false;
        this.incidents.ispOutages = {};

        // Resolve all active alarms
        while (this.zabbixAlarms.length > 0) {
            const alarm = this.zabbixAlarms[0];
            this.resolveActiveAlarm(alarm.simType, alarm.simTarget, `[RESOLVED] Global network reset triggered. Re-polled all nodes. Status HEALTHY.`);
        }

        this.logSimEvent(`[SYS] Global recovery: All components and WAN links verified online.`, 'green');
    }

    // Helper to log logs inside simulator output
    logSimEvent(message, color = 'muted') {
        if (window.onSimLog) {
            window.onSimLog(message, color);
        }
    }

    addActiveAlarm(simType, simTarget, title, description, severity) {
        // Prevent duplicate alarms
        const exists = this.zabbixAlarms.some(a => a.simType === simType && a.simTarget === simTarget);
        if (exists) return;

        const alarm = {
            id: `alarm-${Math.random().toString(36).substr(2, 9)}`,
            simType,
            simTarget,
            title,
            description,
            severity,
            time: new Date().toLocaleTimeString(),
            timestamp: new Date().toISOString()
        };

        this.zabbixAlarms.unshift(alarm);
        this.logSimEvent(`[ZABBIX ALERT] Trigger fired: ${title} (${severity.toUpperCase()})`, 'red');

        // Add to historical SLA logs
        this.alarmsHistory.unshift({
            id: `hist-${alarm.id}`,
            device: simTarget ? `WAN Link: ${simTarget}` : alarm.title.split(' ')[0],
            event: description,
            severity,
            status: 'triggered',
            triggeredAt: alarm.timestamp,
            resolvedAt: null
        });

        // Trigger user notification bell
        if (window.showToastNotification) {
            window.showToastNotification(title, description, severity === 'disaster' ? 'danger' : 'warning');
        }
    }

    resolveActiveAlarm(simType, simTarget, resolveMsg) {
        const idx = this.zabbixAlarms.findIndex(a => a.simType === simType && a.simTarget === simTarget);
        if (idx !== -1) {
            const alarm = this.zabbixAlarms[idx];
            this.zabbixAlarms.splice(idx, 1);
            
            this.logSimEvent(`[ZABBIX RESOLVE] Event cleared: ${alarm.title}`, 'green');

            // Update history record
            const histIdx = this.alarmsHistory.findIndex(h => h.id === `hist-${alarm.id}`);
            if (histIdx !== -1) {
                this.alarmsHistory[histIdx].status = 'resolved';
                this.alarmsHistory[histIdx].resolvedAt = new Date().toISOString();
                this.alarmsHistory[histIdx].event += ` (Resolved in ${Math.round((Date.now() - new Date(this.alarmsHistory[histIdx].triggeredAt).getTime())/1000)}s)`;
            }

            if (window.showToastNotification) {
                window.showToastNotification('Event Cleared', alarm.title + ' is now resolved.', 'success');
            }
        }
    }

    // Dynamic metrics calculators
    updateISPMetrics() {
        this.isps.forEach(isp => {
            const isDown = this.incidents.ispOutages[isp.id] === true || 
                           (this.incidents.powerOutage && isp.targetDevice === 'fg-30g-old');

            if (isDown) {
                isp.status = 'down';
                isp.latency = 0;
                isp.loss = 100;
                isp.speedIn = 0;
                isp.speedOut = 0;
            } else {
                // Baseline fluctuations
                isp.status = 'healthy';
                isp.loss = Math.random() > 0.99 ? 1 : 0; // occasional isolated loss
                
                // Set latency based on link type
                let baseLat = 12;
                if (isp.id === 'isp-3') baseLat = 22; // Coax
                if (isp.id === 'isp-4') baseLat = 45; // 5G
                if (isp.id === 'isp-6') baseLat = 35; // DSL
                if (isp.id === 'isp-8') baseLat = 40; // 5G

                // If FortiGate 80F loaded, latency jumps slightly
                if (this.incidents.fg80fOverloaded && isp.targetDevice === 'fg-80f') {
                    baseLat += 20 + Math.random() * 15;
                    isp.loss = Math.floor(Math.random() * 4); // 0-3% loss
                }

                // If Switch Loop, First Floor Old ISPs seem unreachable/degraded
                if (this.incidents.tplinkLoop && isp.targetDevice === 'fg-30g-old') {
                    baseLat += 150 + Math.random() * 200;
                    isp.loss = Math.floor(25 + Math.random() * 30); // 25-55% packet loss
                    isp.status = 'degraded';
                }

                isp.latency = Math.max(2, Math.round(baseLat + (Math.random() * 4 - 2)));
                
                // Speeds fluctuations (active traffic)
                const usePct = 0.15 + (Math.sin(this.tickCount / 10) * 0.1) + Math.random() * 0.05; // 10% - 30% load
                isp.speedIn = Math.round(isp.bandwidth * usePct * 10) / 10;
                isp.speedOut = Math.round(isp.speedIn * 0.12 * 10) / 10; // TX is usually less than RX
            }

            // Push history
            isp.history.push(isp.latency);
            if (isp.history.length > 20) {
                isp.history.shift();
            }
        });
    }

    updateDeviceMetrics() {
        // Iterate devices
        for (const [id, dev] of Object.entries(this.devices)) {
            // Check if First floor old is completely powered off
            if (this.incidents.powerOutage && dev.zone === 'First Floor (Old Wing)') {
                dev.status = 'down';
                dev.cpu = 0;
                dev.ram = 0;
                dev.temp = 0;
                dev.uptime = 0;
                if (dev.clients !== undefined) dev.clients = 0;
                
                // Set port statuses
                if (dev.ports) {
                    dev.ports.forEach(p => p.status = 'down');
                }
                continue;
            }

            // Default healthy baseline
            dev.status = 'healthy';
            dev.uptime += 2;
            
            // Random minor metrics
            let targetCpu = 10 + Math.floor(Math.random() * 15);
            let targetRam = 35 + Math.floor(Math.random() * 10);
            let targetTemp = 35 + Math.floor(Math.random() * 5);

            if (dev.id === 'fg-80f') {
                targetCpu = 25 + Math.floor(Math.sin(this.tickCount / 12) * 5);
                targetRam = 45;
                targetTemp = 48;

                // Handle Incident load
                if (this.incidents.fg80fOverloaded) {
                    targetCpu = 94 + Math.floor(Math.random() * 5);
                    targetRam = 88 + Math.floor(Math.random() * 3);
                    targetTemp = 82 + Math.floor(Math.random() * 4);
                    dev.status = 'degraded';
                }
            } else if (dev.id === 'sw-tplink-old') {
                // Switch loop incident
                if (this.incidents.tplinkLoop) {
                    targetCpu = 98 + Math.floor(Math.random() * 2);
                    targetRam = 72;
                    targetTemp = 65;
                    dev.status = 'degraded';
                }
            } else if (dev.id === 'ap-grand-3') {
                // AP Congestion incident
                dev.clients = this.incidents.apOverload ? 264 + Math.floor(Math.random() * 12) : 38 + Math.floor(Math.sin(this.tickCount/8) * 8);
                if (this.incidents.apOverload) {
                    targetCpu = 92 + Math.floor(Math.random() * 6);
                    targetRam = 85;
                    dev.status = 'degraded';
                }
            } else if (dev.id.startsWith('ap-')) {
                // Standard AP client oscillations
                if (dev.id === 'ap-grand-1') dev.clients = 20 + Math.floor(Math.sin(this.tickCount/6)*5);
                if (dev.id === 'ap-grand-2') dev.clients = 14 + Math.floor(Math.cos(this.tickCount/7)*3);
                if (dev.id === 'ap-grand-4') dev.clients = 8 + Math.floor(Math.sin(this.tickCount/9)*2);
                if (dev.id === 'ap-grand-new-1') dev.clients = 32 + Math.floor(Math.sin(this.tickCount/5)*7);
                if (dev.id === 'ap-tplink-1') dev.clients = 12 + Math.floor(Math.sin(this.tickCount/10)*4);
                if (dev.id === 'ap-tplink-2') dev.clients = 8 + Math.floor(Math.cos(this.tickCount/10)*2);
            }

            // Interpolate smooth transit
            dev.cpu = Math.round(dev.cpu + (targetCpu - dev.cpu) * 0.3);
            dev.ram = Math.round(dev.ram + (targetRam - dev.ram) * 0.3);
            if (dev.temp !== undefined) {
                dev.temp = Math.round(dev.temp + (targetTemp - dev.temp) * 0.2);
            }

            // Sync FortiGate interface speeds with ISP metrics
            if (dev.id === 'fg-80f') {
                dev.ports[0].rx = this.isps[0].speedOut; dev.ports[0].tx = this.isps[0].speedIn; dev.ports[0].status = this.isps[0].status === 'down' ? 'down' : 'up';
                dev.ports[1].rx = this.isps[1].speedOut; dev.ports[1].tx = this.isps[1].speedIn; dev.ports[1].status = this.isps[1].status === 'down' ? 'down' : 'up';
                dev.ports[2].rx = this.isps[2].speedOut; dev.ports[2].tx = this.isps[2].speedIn; dev.ports[2].status = this.isps[2].status === 'down' ? 'down' : 'up';
                dev.ports[3].rx = this.isps[3].speedOut; dev.ports[3].tx = this.isps[3].speedIn; dev.ports[3].status = this.isps[3].status === 'down' ? 'down' : 'up';
            } else if (dev.id === 'fg-30g-old') {
                dev.ports[0].rx = this.isps[4].speedOut; dev.ports[0].tx = this.isps[4].speedIn; dev.ports[0].status = this.isps[4].status === 'down' ? 'down' : 'up';
                dev.ports[1].rx = this.isps[5].speedOut; dev.ports[1].tx = this.isps[5].speedIn; dev.ports[1].status = this.isps[5].status === 'down' ? 'down' : 'up';
            } else if (dev.id === 'fg-30g-new') {
                dev.ports[0].rx = this.isps[6].speedOut; dev.ports[0].tx = this.isps[6].speedIn; dev.ports[0].status = this.isps[6].status === 'down' ? 'down' : 'up';
                dev.ports[1].rx = this.isps[7].speedOut; dev.ports[1].tx = this.isps[7].speedIn; dev.ports[1].status = this.isps[7].status === 'down' ? 'down' : 'up';
            }
        }
    }

    updateSystemAggregates() {
        const branch = this.branches[this.activeBranch] || this.branches['branch-alpha'];
        const activeDevices = Object.values(this.devices).filter(d => branch.devices.includes(d.id));
        const activeIsps = this.isps.filter(i => branch.isps.includes(i.id));

        let totalEntities = activeDevices.length + activeIsps.length;
        let onlineEntities = 0;
        let totalLat = 0;
        let activeLatCount = 0;
        let activeLoad = 0;

        for (const dev of activeDevices) {
            if (dev.status === 'healthy') onlineEntities += 1;
            else if (dev.status === 'degraded') onlineEntities += 0.5;
        }

        activeIsps.forEach(isp => {
            if (isp.status === 'healthy') {
                onlineEntities += 1;
                totalLat += isp.latency;
                activeLatCount++;
                activeLoad += (isp.speedIn / isp.bandwidth) * 100;
            } else if (isp.status === 'degraded') {
                onlineEntities += 0.5;
                totalLat += isp.latency;
                activeLatCount++;
                activeLoad += (isp.speedIn / isp.bandwidth) * 100;
            }
        });

        // Overall stats
        this.networkHealth = totalEntities > 0 ? Math.round((onlineEntities / totalEntities) * 1000) / 10 : 100;
        this.meanLatency = activeLatCount > 0 ? Math.round(totalLat / activeLatCount) : 0;
        this.avgLoad = activeLatCount > 0 ? Math.round(activeLoad / activeLatCount) : 0;

        // Push aggregation history
        this.chartHistory.latency.push(this.meanLatency);
        this.chartHistory.load.push(this.avgLoad);
        if (this.chartHistory.latency.length > 20) {
            this.chartHistory.latency.shift();
            this.chartHistory.load.shift();
        }

        // Active ISP count
        this.activeISPsCount = activeIsps.filter(i => i.status !== 'down').length;

        // Calculate custom Uptime percentage
        const baseUptimePct = 99.96;
        if (this.totalSlaSeconds > 0) {
            const currentSessionUptime = ((this.totalSlaSeconds - this.downtimeSlaSeconds) / this.totalSlaSeconds) * 100;
            this.workingHoursUptime = Math.round((baseUptimePct * 0.9 + currentSessionUptime * 0.1) * 100) / 100;
        } else {
            this.workingHoursUptime = baseUptimePct;
        }
    }
}

// Global reference
window.simulator = new NetworkSimulator();
console.log("NetPulse Simulation Engine initialized.");
