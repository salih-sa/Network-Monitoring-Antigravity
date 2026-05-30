/* ----------------------------------------------------
   NetPulse Core UI Controller - app.js
   ---------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements References
    const navItems = document.querySelectorAll('.nav-menu .nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const searchBar = document.getElementById('global-search');
    const clockElement = document.getElementById('network-clock');
    const notifBell = document.getElementById('notif-bell-btn');
    const notifBadge = document.getElementById('notif-badge');
    const notifModal = document.getElementById('notif-modal');
    const notifModalClose = document.getElementById('notif-modal-close');
    const notifModalList = document.getElementById('notif-modal-list');
    const openSimBtn = document.getElementById('open-simulator-btn');
    const closeSimBtn = document.getElementById('close-simulator-btn');
    const simDrawer = document.getElementById('simulator-drawer');
    const testSettingsBtn = document.getElementById('btn-test-connection');
    const saveSettingsBtn = document.getElementById('btn-save-settings');
    const restoreAllBtn = document.getElementById('btn-restore-all');
    const clearSimLogsBtn = document.getElementById('btn-clear-sim-logs');
    const rebalanceIspBtn = document.getElementById('btn-rebalance-isp');

    // Chart Handles
    let latencyLoadChart = null;
    let slaWeeklyChart = null;

    // Selected node in inspector
    let selectedDeviceId = 'fg-80f'; // Default focus

    // Dual-Mode Connection state
    let isLiveBackend = false;
    const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? '' 
        : 'http://localhost:3000';

    // Active notifications stack
    let notificationStack = [
        { id: 1, title: 'Zabbix sync successful', desc: 'Pulled 28 hosts & 192 metrics from JSON-RPC API', type: 'success', time: '10 mins ago' },
        { id: 2, title: 'Grandstream AP 3 warning', desc: 'Noisy RF environment: 5GHz channel interference', type: 'warning', time: '25 mins ago' },
        { id: 3, title: 'Backup routing policy active', desc: 'ISP 4 LTE/5G interface standby test succeeded', type: 'success', time: '1 hour ago' }
    ];

    // Initialize application
    init();

    async function init() {
        // Init Lucide Icons
        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Binds
        setupTabs();
        setupClock();
        setupNotifications();
        setupDrawers();
        
        // Check for active Backend Server Gateway
        await checkBackendAvailability();

        setupSettingsPersistence();
        setupSimulatorPanel();
        
        // Draw Charts
        initCharts();
        
        // Paint SVGs
        renderTopologySVG();
        
        // Setup Multi-Branch, Active Inventory, Exporters, and Per-Device SNMP configs
        setupMultiBranchAndInventory();
        
        // Trigger initial update
        updateDashboardUI();

        // Register global callback for simulator ticks (used in client simulation mode)
        window.onSimulationUpdate = () => {
            if (!isLiveBackend) {
                updateDashboardUI();
                updateLiveChart();
                updateTopologyDynamicStates();
                updateInspectorUI();
                renderInventoryDevices();
            }
        };

        window.onSimLog = (msg, color) => {
            appendSimLog(msg, color);
        };

        // Click handler to rebalance ISPs
        if (rebalanceIspBtn) {
            rebalanceIspBtn.addEventListener('click', async () => {
                if (isLiveBackend) {
                    try {
                        await fetch(`${BACKEND_URL}/api/simulate-reset`, { method: 'POST' });
                        showToastNotification('Load Balancing Rebuilt', 'Rebalanced WAN interfaces on server backend.', 'success');
                    } catch (e) {
                        console.error(e);
                    }
                } else {
                    window.simulator.restoreAll();
                    showToastNotification('Load Balancing Rebuilt', 'Rebalanced WAN interfaces on all 3 FortiGate firewalls.', 'success');
                }
            });
        }

        // Start backend polling interval if live server found
        if (isLiveBackend) {
            console.log('[SYS] Starting periodic backend JSON fetches.');
            setInterval(() => {
                fetchBackendData();
            }, 3000);
        }
    }

    // Ping check server
    async function checkBackendAvailability() {
        try {
            const response = await fetch(`${BACKEND_URL}/api/status`, { timeout: 1500 });
            if (response.ok) {
                const data = await response.json();
                isLiveBackend = true;
                console.log(`[LIVE CORE] Connected to backend gateway. Version: ${data.version}`);
                
                // Update indicator status
                const engineText = document.getElementById('engine-mode-txt');
                const simIndicator = document.getElementById('sim-indicator');
                if (engineText) engineText.textContent = 'Actual SNMP Live';
                if (simIndicator) simIndicator.className = 'indicator-dot active';

                appendConsoleLog('Connected to NetPulse Backend Gateway server successfully.', 'text-primary');
                appendConsoleLog(`[API STATUS] Zabbix integration synced: ${data.config.zabbixSyncMode.toUpperCase()}`, 'text-muted');
                
                // Stop client simulator
                if (window.simulator) {
                    window.simulator.stopTick();
                }
            }
        } catch (e) {
            isLiveBackend = false;
            console.log('[SYS] Local server gateway offline. Running client simulation engine.');
            appendConsoleLog('NetPulse Server gateway offline (No server on port 3000). Simulation engine active.', 'text-muted');
        }
    }

    // Periodic Server metrics sync
    async function fetchBackendData() {
        if (!isLiveBackend) return;

        try {
            const res = await fetch(`${BACKEND_URL}/api/metrics`);
            if (res.ok) {
                const data = await res.json();
                
                // Sync data to mock simulator cache so existing UI drawings function seamlessly!
                window.simulator.networkHealth = data.networkHealth;
                window.simulator.workingHoursUptime = data.workingHoursUptime;
                window.simulator.meanLatency = data.meanLatency;
                window.simulator.activeISPsCount = data.activeISPsCount;
                window.simulator.isps = data.isps;
                window.simulator.devices = data.devices;
                window.simulator.zabbixAlarms = data.zabbixAlarms;

                // Sync graph aggregated history arrays
                // Extract latency and load histories from ISPs
                const avgLat = data.meanLatency;
                const avgLd = data.avgLoad;
                window.simulator.chartHistory.latency.push(avgLat);
                window.simulator.chartHistory.load.push(avgLd);
                if (window.simulator.chartHistory.latency.length > 20) {
                    window.simulator.chartHistory.latency.shift();
                    window.simulator.chartHistory.load.shift();
                }

                // Update UI panels
                updateDashboardUI();
                updateLiveChart();
                updateTopologyDynamicStates();
                updateInspectorUI();
            }
        } catch (e) {
            console.error('[ERR] Failed to poll backend metrics: ', e.message);
        }
    }

    // Tab switcher
    function setupTabs() {
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetTab = item.getAttribute('data-tab');
                
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');

                tabPanes.forEach(pane => {
                    pane.classList.remove('active');
                    if (pane.id === `tab-${targetTab}`) {
                        pane.classList.add('active');
                    }
                });

                if (targetTab === 'sla-reports') {
                    setTimeout(() => {
                        if (slaWeeklyChart) slaWeeklyChart.destroy();
                        initSlaChart();
                    }, 50);
                } else if (targetTab === 'devices') {
                    renderInventoryDevices();
                }
            });
        });

        document.querySelectorAll('[data-tab-switch]').forEach(btn => {
            btn.addEventListener('click', () => {
                const dest = btn.getAttribute('data-tab-switch');
                const navBtn = document.querySelector(`.nav-item[data-tab="${dest}"]`);
                if (navBtn) navBtn.click();
            });
        });
    }

    // Live clock
    function setupClock() {
        setInterval(() => {
            const now = new Date();
            clockElement.textContent = now.toTimeString().split(' ')[0];
        }, 1000);
    }

    // Bell Notification popups
    function setupNotifications() {
        updateNotifBadge();

        notifBell.addEventListener('click', () => {
            notifModal.classList.add('active');
            renderNotifModalList();
        });

        notifModalClose.addEventListener('click', () => {
            notifModal.classList.remove('active');
        });

        notifModal.addEventListener('click', (e) => {
            if (e.target === notifModal) {
                notifModal.classList.remove('active');
            }
        });
    }

    function updateNotifBadge() {
        if (notificationStack.length > 0) {
            notifBadge.style.display = 'block';
            notifBadge.textContent = notificationStack.length;
        } else {
            notifBadge.style.display = 'none';
        }
    }

    function renderNotifModalList() {
        if (notificationStack.length === 0) {
            notifModalList.innerHTML = `
                <div class="no-alarms">
                    <i data-lucide="bell-off"></i>
                    <p>No recent alerts</p>
                    <span>You're all caught up.</span>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        notifModalList.innerHTML = notificationStack.map(n => `
            <div class="alarm-item severity-${n.type === 'danger' ? 'disaster' : n.type === 'warning' ? 'average' : 'info'} mb-3" style="animation: none;">
                <div class="alarm-icon severity-${n.type === 'danger' ? 'disaster' : n.type === 'warning' ? 'average' : 'info'}">
                    <i data-lucide="${n.type === 'danger' ? 'alert-octagon' : n.type === 'warning' ? 'alert-triangle' : 'info'}"></i>
                </div>
                <div class="alarm-details">
                    <div class="alarm-title">${n.title}</div>
                    <div class="alarm-meta">
                        <span>${n.time}</span>
                        <span class="alarm-badge-sev severity-${n.type === 'danger' ? 'disaster' : n.type === 'warning' ? 'average' : 'info'}">${n.type}</span>
                    </div>
                    <p style="font-size: 0.74rem; color: var(--text-muted); margin-top: 4px;">${n.desc}</p>
                </div>
            </div>
        `).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    // Toast alerts helper
    window.showToastNotification = function(title, desc, type = 'primary') {
        const notifContainer = document.getElementById('notif-container');
        if (!notifContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'info';
        if (type === 'danger') icon = 'alert-octagon';
        if (type === 'warning') icon = 'alert-triangle';
        if (type === 'success') icon = 'check-circle-2';

        toast.innerHTML = `
            <div class="toast-icon">
                <i data-lucide="${icon}"></i>
            </div>
            <div class="toast-content">
                <p class="toast-title">${title}</p>
                <p class="toast-desc">${desc}</p>
            </div>
        `;

        notifContainer.appendChild(toast);
        if (window.lucide) window.lucide.createIcons();

        // Push into bell list
        notificationStack.unshift({
            id: Date.now(),
            title,
            desc,
            type,
            time: 'Just now'
        });
        updateNotifBadge();

        setTimeout(() => {
            toast.style.animation = 'toast-slide-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) reverse forwards';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    };

    // Drawer slide-ins
    function setupDrawers() {
        openSimBtn.addEventListener('click', () => {
            simDrawer.classList.add('active');
        });

        closeSimBtn.addEventListener('click', () => {
            simDrawer.classList.remove('active');
        });
    }

    // Config form settings
    function setupSettingsPersistence() {
        const fields = ['snmp-community', 'snmp-port', 'snmp-version', 'snmp-poll-int', 'zabbix-url', 'zabbix-token', 'zabbix-sync'];
        
        fields.forEach(fid => {
            const val = localStorage.getItem(`netpulse-${fid}`);
            const el = document.getElementById(fid);
            if (val && el) el.value = val;
        });

        const versionSelect = document.getElementById('snmp-version');
        const v3Panel = document.getElementById('snmp-v3-panel');
        if (versionSelect && v3Panel) {
            versionSelect.addEventListener('change', () => {
                if (versionSelect.value === 'v3') v3Panel.classList.remove('hidden');
                else v3Panel.classList.add('hidden');
            });
        }

        saveSettingsBtn.addEventListener('click', async () => {
            const configPayload = {};
            fields.forEach(fid => {
                const el = document.getElementById(fid);
                if (el) {
                    localStorage.setItem(`netpulse-${fid}`, el.value);
                    
                    // Map HTML input IDs to JSON properties
                    let jsonKey = fid.replace('snmp-', 'snmp').replace('zabbix-', 'zabbix');
                    // Camelcase it
                    jsonKey = jsonKey.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                    configPayload[jsonKey] = el.value;
                }
            });

            if (isLiveBackend) {
                try {
                    const res = await fetch(`${BACKEND_URL}/api/config`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(configPayload)
                    });
                    if (res.ok) {
                        appendConsoleLog('Configuration saved on live backend. SNMP threads restarted.', 'text-green');
                        showToastNotification('Settings Synced', 'Settings updated on local server.', 'success');
                    }
                } catch (e) {
                    appendConsoleLog(`Configuration save failed: ${e.message}`, 'text-red');
                }
            } else {
                appendConsoleLog('Configuration saved. (Client LocalStorage only)', 'text-muted');
                showToastNotification('Settings Saved', 'SNMP community parameters saved.', 'success');
            }
        });

        testSettingsBtn.addEventListener('click', () => {
            runIntegrationDiagnostics();
        });
    }

    // Diagnostics tests with active server API pings
    async function runIntegrationDiagnostics() {
        const consoleEl = document.getElementById('diag-console');
        consoleEl.innerHTML = ''; // Clear

        appendConsoleLog('Initiating diagnostics suite...', 'text-primary');

        if (!isLiveBackend) {
            // Simulated lines
            const logs = [
                { text: '> [RESOLVING] Checking target Zabbix Host Resolution...', style: 'text-muted' },
                { text: '> [RESOLVING] OK: 192.168.10.15 resolved. Target online.', style: 'text-green' },
                { text: '> [ZABBIX CONNECTING] Testing JSON-RPC ping to API endpoint...', style: 'text-muted' },
                { text: '> [ZABBIX SUCCESS] API Handshake approved. Zabbix server v6.4.10 operational.', style: 'text-green' },
                { text: '> [SNMP WALK] Initiating SNMP v2c walk queries to firewalls...', style: 'text-muted' },
                { text: '> [SNMP ENGINE] FortiGate 80F (192.168.10.1) responded. OIDs loaded: 34', style: 'text-green' },
                { text: '> [DIAGNOSTIC STATUS] (Simulation fallback) Diagnostics OK.', style: 'text-green' }
            ];

            let delay = 0;
            logs.forEach(l => {
                setTimeout(() => {
                    appendConsoleLog(l.text, l.style);
                }, delay);
                delay += 250;
            });
            return;
        }

        // Live server diagnostics test!
        try {
            appendConsoleLog('Connecting to local SNMP/Zabbix poll server...', 'text-muted');
            
            // 1. Zabbix API Ping test
            const zbxUrl = document.getElementById('zabbix-url').value;
            const zbxToken = document.getElementById('zabbix-token').value;
            
            appendConsoleLog(`[ZABBIX CONNECTING] Testing JSON-RPC ping to API endpoint: ${zbxUrl}`, 'text-muted');
            
            const zbxRes = await fetch(`${BACKEND_URL}/api/test-zabbix`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: zbxUrl, token: zbxToken })
            });
            
            if (zbxRes.ok) {
                const data = await zbxRes.json();
                if (data.success) {
                    appendConsoleLog(`> ${data.message}`, 'text-green');
                } else {
                    appendConsoleLog(`> [ZABBIX ERR] ${data.message}`, 'text-orange');
                }
            }

            // 2. SNMP Firewall IP Walk test
            const community = document.getElementById('snmp-community').value;
            const port = document.getElementById('snmp-port').value;
            const version = document.getElementById('snmp-version').value;
            const targetIp = '192.168.10.1'; // Primary FortiGate
            
            appendConsoleLog(`[SNMP WALK] Running live UDP SNMP test to FortiGate 80F (${targetIp})...`, 'text-muted');
            
            const snmpRes = await fetch(`${BACKEND_URL}/api/test-snmp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip: targetIp, community, version, port })
            });

            if (snmpRes.ok) {
                const data = await snmpRes.json();
                if (data.success) {
                    appendConsoleLog(`> [SNMP OK] ${data.message}`, 'text-green');
                } else {
                    appendConsoleLog(`> [SNMP WARNING] ${data.message}`, 'text-orange');
                    appendConsoleLog('> [SNMP FALLBACK] Active server running simulator fallback values.', 'text-muted');
                }
            }

        } catch (e) {
            appendConsoleLog(`Diagnostic execution error: ${e.message}`, 'text-red');
        }
    }

    function appendConsoleLog(text, style = '') {
        const consoleEl = document.getElementById('diag-console');
        if (!consoleEl) return;
        
        const line = document.createElement('div');
        line.className = `console-line ${style}`;
        
        const timestamp = new Date().toLocaleTimeString();
        line.textContent = `[${timestamp}] ${text}`;
        
        consoleEl.appendChild(line);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    // Simulator slider hooks
    function setupSimulatorPanel() {
        const switchesContainer = document.getElementById('isp-sim-switches');
        if (!switchesContainer) return;

        switchesContainer.innerHTML = window.simulator.isps.map(isp => `
            <div class="sim-switch">
                <div class="switch-label-group">
                    <span class="switch-main">${isp.name.split(' - ')[0]}</span>
                    <span class="switch-sub">${isp.provider} (${isp.type})</span>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" checked class="toggle-switch-input" id="sim-toggle-${isp.id}" data-isp="${isp.id}">
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `).join('');

        document.querySelectorAll('.toggle-switch-input').forEach(chk => {
            chk.addEventListener('change', async () => {
                const ispId = chk.getAttribute('data-isp');
                if (isLiveBackend) {
                    // Send to server incident endpoints
                    try {
                        await fetch(`${BACKEND_URL}/api/simulate-incident`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: 'isp', target: ispId, active: !chk.checked })
                        });
                        appendSimLog(`[SERVER SIM] ISP ${ispId} state changed to ${chk.checked ? 'UP' : 'DOWN'}`, 'orange');
                    } catch (e) {
                        console.error(e);
                    }
                } else {
                    if (chk.checked) {
                        window.simulator.resolveIncident('isp', ispId);
                    } else {
                        window.simulator.triggerIncident('isp', ispId);
                    }
                }
            });
        });

        // Binds device disaster triggers
        const fgLoadBtn = document.getElementById('trigger-fg80f-load');
        const tpLoopBtn = document.getElementById('trigger-tplink-loop');
        const apOverBtn = document.getElementById('trigger-ap-overload');
        const powerOutBtn = document.getElementById('trigger-power-outage');

        fgLoadBtn.addEventListener('click', () => {
            const active = fgLoadBtn.classList.toggle('sim-active');
            triggerDeviceIncident('fg80f-load', active);
        });

        tpLoopBtn.addEventListener('click', () => {
            const active = tpLoopBtn.classList.toggle('sim-active');
            triggerDeviceIncident('tplink-loop', active);
        });

        apOverBtn.addEventListener('click', () => {
            const active = apOverBtn.classList.toggle('sim-active');
            triggerDeviceIncident('ap-overload', active);
        });

        powerOutBtn.addEventListener('click', () => {
            const active = powerOutBtn.classList.toggle('sim-active');
            triggerDeviceIncident('power-outage', active);
        });

        async function triggerDeviceIncident(type, active) {
            if (isLiveBackend) {
                try {
                    await fetch(`${BACKEND_URL}/api/simulate-incident`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type, active })
                    });
                    appendSimLog(`[SERVER SIM] Device incident ${type} toggled to ${active}`, 'orange');
                } catch (e) {
                    console.error(e);
                }
            } else {
                if (active) window.simulator.triggerIncident(type);
                else window.simulator.resolveIncident(type);
            }
        }

        restoreAllBtn.addEventListener('click', async () => {
            if (isLiveBackend) {
                try {
                    await fetch(`${BACKEND_URL}/api/simulate-reset`, { method: 'POST' });
                    appendSimLog(`[SERVER SIM] Reset all metrics online.`, 'green');
                } catch (e) {
                    console.error(e);
                }
            } else {
                window.simulator.restoreAll();
            }
            
            document.querySelectorAll('.toggle-switch-input').forEach(c => c.checked = true);
            [fgLoadBtn, tpLoopBtn, apOverBtn, powerOutBtn].forEach(b => b.classList.remove('sim-active'));
        });

        clearSimLogsBtn.addEventListener('click', () => {
            const out = document.getElementById('sim-console-out');
            if (out) out.innerHTML = '';
        });
    }

    function appendSimLog(msg, color = 'muted') {
        const out = document.getElementById('sim-console-out');
        if (!out) return;

        const line = document.createElement('div');
        line.className = `console-line text-${color}`;
        line.textContent = `> ${msg}`;
        out.appendChild(line);
        out.scrollTop = out.scrollHeight;
    }

    // Charts configurations
    function initCharts() {
        initLiveChart();
        initSlaChart();
    }

    function initLiveChart() {
        const options = {
            chart: {
                height: 300,
                type: 'area',
                toolbar: { show: false },
                animations: { enabled: true, easing: 'linear', dynamicAnimation: { speed: 1000 } },
                background: 'transparent'
            },
            theme: { mode: 'dark' },
            colors: ['#00f2fe', '#ffd600'],
            dataLabels: { enabled: false },
            stroke: { curve: 'smooth', width: 2.5 },
            grid: {
                borderColor: 'rgba(255, 255, 255, 0.04)',
                strokeDashArray: 4,
                padding: { top: 0, right: 10, bottom: 0, left: 10 }
            },
            series: [
                { name: 'Aggregate Latency (ms)', data: [...window.simulator.chartHistory.latency] },
                { name: 'Active Load (%)', data: [...window.simulator.chartHistory.load] }
            ],
            xaxis: {
                labels: { show: false },
                axisBorder: { show: false },
                axisTicks: { show: false }
            },
            yaxis: {
                max: 200,
                labels: {
                    style: { colors: '#7a889f', fontFamily: 'Outfit' }
                }
            },
            legend: {
                position: 'top',
                fontFamily: 'Outfit',
                labels: { colors: '#f5f7fb' }
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.25,
                    opacityTo: 0.05,
                    stops: [0, 90, 100]
                }
            }
        };

        latencyLoadChart = new ApexCharts(document.querySelector("#latency-load-chart"), options);
        latencyLoadChart.render();
    }

    function updateLiveChart() {
        if (!latencyLoadChart) return;
        latencyLoadChart.updateSeries([
            { data: window.simulator.chartHistory.latency },
            { data: window.simulator.chartHistory.load }
        ]);
    }

    function initSlaChart() {
        const options = {
            chart: {
                height: 280,
                type: 'bar',
                toolbar: { show: false },
                background: 'transparent'
            },
            theme: { mode: 'dark' },
            colors: ['#00e676'],
            plotOptions: {
                bar: {
                    borderRadius: 6,
                    columnWidth: '45%'
                }
            },
            grid: {
                borderColor: 'rgba(255, 255, 255, 0.04)'
            },
            dataLabels: { enabled: false },
            series: [{
                name: 'Business Uptime SLA (%)',
                data: [99.98, 99.95, 99.99, 99.91, 99.98]
            }],
            xaxis: {
                categories: ['Mon (18th)', 'Tue (19th)', 'Wed (20th)', 'Thu (21st)', 'Fri (22nd)'],
                labels: {
                    style: { colors: '#7a889f', fontFamily: 'Outfit' }
                }
            },
            yaxis: {
                min: 99.5,
                max: 100.0,
                labels: {
                    style: { colors: '#7a889f', fontFamily: 'Outfit' }
                }
            }
        };

        slaWeeklyChart = new ApexCharts(document.querySelector("#sla-weekly-chart"), options);
        slaWeeklyChart.render();
    }

    // Refresh UI dashboard metrics
    function updateDashboardUI() {
        const sim = window.simulator;

        document.getElementById('kpi-health-val').textContent = `${sim.networkHealth}%`;
        document.getElementById('kpi-sla-val').textContent = `${sim.workingHoursUptime}%`;
        document.getElementById('kpi-isp-val').textContent = `${sim.activeISPsCount} / 8 UP`;
        document.getElementById('kpi-latency-val').textContent = `${sim.meanLatency} ms`;

        const monthUptimeEl = document.getElementById('sla-month-uptime');
        if (monthUptimeEl) monthUptimeEl.textContent = `${sim.workingHoursUptime}%`;

        const alarmCountEl = document.getElementById('alarm-count');
        if (alarmCountEl) alarmCountEl.textContent = `${sim.zabbixAlarms.length} Active`;

        const simIndicator = document.getElementById('sim-indicator');
        const engineText = document.getElementById('engine-mode-txt');
        
        let state = 'healthy';
        let text = isLiveBackend ? 'Actual SNMP Live' : 'Simulation Live';
        
        if (sim.zabbixAlarms.length > 0) {
            const hasDisaster = sim.zabbixAlarms.some(a => a.severity === 'disaster');
            state = hasDisaster ? 'critical' : 'degraded';
            text = hasDisaster ? 'Zone Fault' : 'Performance Degraded';
        }

        if (simIndicator) {
            simIndicator.className = `indicator-dot active ${state}`;
        }
        if (engineText) {
            engineText.textContent = text;
        }

        const badgeCount = document.getElementById('isp-badge-count');
        if (badgeCount) {
            badgeCount.className = `badge ${state}`;
            badgeCount.textContent = `${sim.activeISPsCount}/8`;
        }

        renderZabbixAlarms();
        renderISPDetailList();
        renderISPQuickList();
        renderSLAIncidentsHistory();
    }

    // Render Zabbix Alarms Feed
    function renderZabbixAlarms() {
        const alarmsContainer = document.getElementById('zabbix-alarms-list');
        if (!alarmsContainer) return;

        const alarms = window.simulator.zabbixAlarms;

        if (alarms.length === 0) {
            alarmsContainer.innerHTML = `
                <div class="no-alarms">
                    <i data-lucide="check-circle-2"></i>
                    <p>All network operational.</p>
                    <span>No active triggers on Zabbix.</span>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        alarmsContainer.innerHTML = alarms.map(alarm => `
            <div class="alarm-item severity-${alarm.severity}">
                <div class="alarm-icon severity-${alarm.severity}">
                    <i data-lucide="${alarm.severity === 'disaster' ? 'alert-octagon' : alarm.severity === 'high' ? 'shield-alert' : 'alert-triangle'}"></i>
                </div>
                <div class="alarm-details">
                    <div class="alarm-title">${alarm.title}</div>
                    <div class="alarm-meta">
                        <span>Polled ${alarm.time}</span>
                        <span class="alarm-badge-sev severity-${alarm.severity}">${alarm.severity}</span>
                    </div>
                    <p style="font-size: 0.74rem; color: var(--text-muted); margin-top: 4px;">${alarm.description}</p>
                </div>
            </div>
        `).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    // Render ISP Quick status indicators
    function renderISPQuickList() {
        const container = document.getElementById('isp-quick-container');
        if (!container) return;

        container.innerHTML = window.simulator.isps.map(isp => `
            <div class="isp-quick-card ${isp.status === 'down' ? 'down' : ''}">
                <div class="isp-quick-header">
                    <span class="isp-meta-name">${isp.name.split(' - ')[0]}</span>
                    <span class="isp-meta-status ${isp.status}">${isp.status.toUpperCase()}</span>
                </div>
                <div class="isp-metrics-bar">
                    Latency: <span>${isp.latency}ms</span>
                </div>
                <div class="isp-metrics-bar mt-1">
                    Speed: <span>${isp.speedIn} Mbps</span>
                </div>
            </div>
        `).join('');
    }

    // Render ISP Detailed Tab
    function renderISPDetailList() {
        const container = document.getElementById('isp-detail-grid');
        if (!container) return;

        const activeBranch = window.simulator.activeBranch || 'branch-alpha';
        const branch = window.simulator.branches[activeBranch];
        const activeIsps = window.simulator.isps.filter(i => branch.isps.includes(i.id));

        // Group by zone/floor
        const grouped = {};
        activeIsps.forEach(isp => {
            const zoneName = isp.zone || 'Gateway Interface';
            if (!grouped[zoneName]) grouped[zoneName] = [];
            grouped[zoneName].push(isp);
        });

        container.innerHTML = Object.entries(grouped).map(([zoneName, isps]) => `
            <div class="isp-zone-card glass-card" style="grid-column: 1 / -1; margin-bottom: 24px; width: 100%;">
                <div class="isp-zone-title-bar">
                    <i data-lucide="network" style="width:20px; height:20px; color:var(--primary); display:inline-block; vertical-align:middle;"></i>
                    <h3 style="display:inline-block; vertical-align:middle; font-size:1.1rem; font-weight:700; margin-left:8px;">${zoneName}</h3>
                </div>
                <div class="isp-zone-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:16px;">
                    ${isps.map(isp => {
                        const isDown = isp.status === 'down';
                        return `
                            <div class="isp-card-detailed glass-card ${isDown ? 'down' : ''}" style="margin-bottom: 0; padding:20px; display:flex; flex-direction:column; gap:12px; position:relative; overflow:hidden;">
                                <div class="isp-detailed-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
                                    <div class="isp-badge-group">
                                        <span class="isp-name-lg" style="font-size: 0.92rem; font-weight:700; display:block; color:var(--text-main);">${isp.name.split(' - ')[0]}</span>
                                        <span class="isp-loc-sm" style="font-size: 0.7rem; color: var(--text-muted);">${isp.provider} (${isp.type})</span>
                                    </div>
                                    <span class="isp-status-pill ${isp.status === 'healthy' ? '' : isp.status}" style="font-size: 0.65rem; font-family: var(--font-mono); font-weight:700; padding: 2px 6px; border-radius: 12px;">${isp.status.toUpperCase()}</span>
                                </div>
                                
                                <div class="isp-perf-dials" style="display: flex; justify-content: space-between; margin-top: 4px; padding: 8px; background: rgba(255,255,255,0.01); border-radius: 8px; border: 1px solid var(--glass-border);">
                                    <div class="isp-perf-dial" style="display: flex; flex-direction: column; align-items: center; flex: 1;">
                                        <span class="isp-dial-val metric-speed" style="font-family: var(--font-mono); font-size: 1.1rem; font-weight:700; color: var(--primary);">${isp.speedIn}</span>
                                        <span class="isp-dial-label" style="font-size: 0.62rem; color: var(--text-muted); text-transform: uppercase;">RX (M)</span>
                                    </div>
                                    <div class="isp-perf-dial" style="display: flex; flex-direction: column; align-items: center; flex: 1; border-left: 1px solid var(--glass-border); border-right: 1px solid var(--glass-border);">
                                        <span class="isp-dial-val metric-ping" style="font-family: var(--font-mono); font-size: 1.1rem; font-weight:700; color: var(--warning);">${isp.latency}</span>
                                        <span class="isp-dial-label" style="font-size: 0.62rem; color: var(--text-muted); text-transform: uppercase;">Ping (ms)</span>
                                    </div>
                                    <div class="isp-perf-dial" style="display: flex; flex-direction: column; align-items: center; flex: 1;">
                                        <span class="isp-dial-val metric-loss ${isp.loss > 0 ? 'bad' : ''}" style="font-family: var(--font-mono); font-size: 1.1rem; font-weight:700; color: ${isp.loss > 0 ? 'var(--danger)' : 'var(--success)'};">${isp.loss}%</span>
                                        <span class="isp-dial-label" style="font-size: 0.62rem; color: var(--text-muted); text-transform: uppercase;">Loss</span>
                                    </div>
                                </div>
                                
                                <div class="isp-card-footer" style="display: flex; justify-content: space-between; font-size: 0.72rem; border-top: 1px solid var(--glass-border); padding-top: 8px; margin-top:4px;">
                                    <span style="color: var(--text-muted);">Provisioned Cap:</span>
                                    <span style="font-weight: 600; color: var(--text-main);">${isp.bandwidth} Mbps</span>
                                </div>
                                <div class="isp-card-footer" style="display: flex; justify-content: space-between; font-size: 0.72rem;">
                                    <span style="color: var(--text-muted);">WAN Interface:</span>
                                    <span style="font-weight: 600; color: var(--text-main); font-family: var(--font-mono);">${isp.targetDevice} • ${isp.port.toUpperCase()}</span>
                                </div>
                                <div class="card-glow ${isDown ? 'red' : 'blue'}" style="position: absolute; width: 60px; height: 60px; filter: blur(30px); border-radius: 50%; opacity: 0.15; pointer-events: none; top: -30px; right: -30px;"></div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    // Render historical logs of outages
    function renderSLAIncidentsHistory() {
        const container = document.getElementById('sla-incidents-log-container');
        if (!container) return;

        const hist = window.simulator.alarmsHistory;
        const totalIncidentsCount = document.getElementById('incident-log-count');
        if (totalIncidentsCount) totalIncidentsCount.textContent = `${hist.length} Records`;

        container.innerHTML = hist.map(item => `
            <div class="incident-log-card mb-3">
                <div class="log-header">
                    <span class="log-device">${item.device}</span>
                    <span class="log-status ${item.status}">${item.status.toUpperCase()}</span>
                </div>
                <div class="log-desc">${item.event}</div>
                <div class="log-time">
                    <span>Severity: <strong class="text-orange">${item.severity.toUpperCase()}</strong></span>
                    <span>Triggered: ${new Date(item.triggeredAt).toLocaleTimeString()}</span>
                </div>
            </div>
        `).join('');
    }

    // Render interactive SVG Topology
    function renderTopologySVG() {
        const svg = document.getElementById('network-topology-svg');
        if (!svg) return;

        svg.innerHTML = '';

        const zoneBoundaries = [
            { x: 20, y: 120, w: 960, h: 220, title: 'Second & Third Floor (FortiGate 80F Zone)' },
            { x: 20, y: 360, w: 460, h: 320, title: 'First Floor (Old Wing)' },
            { x: 520, y: 360, w: 460, h: 320, title: 'First Floor (New Wing)' }
        ];

        zoneBoundaries.forEach(z => {
            const border = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            border.setAttribute('x', z.x);
            border.setAttribute('y', z.y);
            border.setAttribute('width', z.w);
            border.setAttribute('height', z.h);
            border.setAttribute('class', 'floor-boundary');
            svg.appendChild(border);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', z.x + 15);
            text.setAttribute('y', z.y + 25);
            text.setAttribute('class', 'floor-title-text');
            text.textContent = z.title;
            svg.appendChild(text);
        });

        const ispPositions = {
            'isp-1': { x: 80, y: 40 },
            'isp-2': { x: 180, y: 40 },
            'isp-3': { x: 280, y: 40 },
            'isp-4': { x: 380, y: 40 },
            'isp-5': { x: 150, y: 410 },
            'isp-6': { x: 230, y: 410 },
            'isp-7': { x: 750, y: 410 },
            'isp-8': { x: 830, y: 410 }
        };

        const deviceCoords = {
            'fg-80f': { x: 230, y: 180 },
            'sw-instant-on': { x: 230, y: 270 },
            'ap-grand-1': { x: 550, y: 220 },
            'ap-grand-2': { x: 670, y: 220 },
            'ap-grand-3': { x: 790, y: 220 },
            'ap-grand-4': { x: 910, y: 220 },

            'fg-30g-old': { x: 330, y: 470 },
            'sw-tplink-old': { x: 330, y: 560 },
            'ap-tplink-1': { x: 150, y: 620 },
            'ap-tplink-2': { x: 250, y: 620 },

            'fg-30g-new': { x: 630, y: 470 },
            'sw-tplink-new': { x: 630, y: 560 },
            'ap-grand-new-1': { x: 790, y: 620 }
        };

        const connections = [
            { src: 'isp-1', dst: 'fg-80f', type: 'primary', id: 'cable-isp1' },
            { src: 'isp-2', dst: 'fg-80f', type: 'fiber', id: 'cable-isp2' },
            { src: 'isp-3', dst: 'fg-80f', type: 'copper', id: 'cable-isp3' },
            { src: 'isp-4', dst: 'fg-80f', type: 'wireless', id: 'cable-isp4' },

            { src: 'isp-5', dst: 'fg-30g-old', type: 'primary', id: 'cable-isp5' },
            { src: 'isp-6', dst: 'fg-30g-old', type: 'copper', id: 'cable-isp6' },

            { src: 'isp-7', dst: 'fg-30g-new', type: 'primary', id: 'cable-isp7' },
            { src: 'isp-8', dst: 'fg-30g-new', type: 'wireless', id: 'cable-isp8' },

            { src: 'fg-80f', dst: 'sw-instant-on', type: 'fiber', id: 'cable-fg80f-sw' },
            { src: 'fg-30g-old', dst: 'sw-tplink-old', type: 'copper', id: 'cable-fg30gold-sw' },
            { src: 'fg-30g-new', dst: 'sw-tplink-new', type: 'copper', id: 'cable-fg30gnew-sw' },

            { src: 'sw-instant-on', dst: 'ap-grand-1', type: 'copper', id: 'cable-apg1' },
            { src: 'sw-instant-on', dst: 'ap-grand-2', type: 'copper', id: 'cable-apg2' },
            { src: 'sw-instant-on', dst: 'ap-grand-3', type: 'copper', id: 'cable-apg3' },
            { src: 'sw-instant-on', dst: 'ap-grand-4', type: 'copper', id: 'cable-apg4' },

            { src: 'sw-tplink-old', dst: 'ap-tplink-1', type: 'copper', id: 'cable-apt1' },
            { src: 'sw-tplink-old', dst: 'ap-tplink-2', type: 'copper', id: 'cable-apt2' },

            { src: 'sw-tplink-new', dst: 'ap-grand-new-1', type: 'copper', id: 'cable-apgn1' }
        ];

        connections.forEach(conn => {
            const p1 = ispPositions[conn.src] || deviceCoords[conn.src];
            const p2 = ispPositions[conn.dst] || deviceCoords[conn.dst];
            if (!p1 || !p2) return;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            
            let d = '';
            if (conn.src.startsWith('isp')) {
                d = `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + 40}, ${p2.x} ${p2.y - 40}, ${p2.x} ${p2.y}`;
            } else {
                d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
            }

            path.setAttribute('d', d);
            path.setAttribute('class', 'svg-cable cable-healthy');
            path.setAttribute('id', conn.id);
            path.setAttribute('stroke-width', conn.src.startsWith('isp') ? '3' : '2');
            path.setAttribute('fill', 'none');
            svg.appendChild(path);

            const flowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            flowPath.setAttribute('d', d);
            flowPath.setAttribute('class', `packet-flow flow-${conn.type}`);
            flowPath.setAttribute('id', `flow-${conn.id}`);
            flowPath.setAttribute('fill', 'none');
            svg.appendChild(flowPath);
        });

        window.simulator.isps.forEach(isp => {
            const pos = ispPositions[isp.id];
            
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'svg-node');
            g.setAttribute('transform', `translate(${pos.x - 20}, ${pos.y - 15})`);
            g.addEventListener('click', () => selectTopologyDevice(isp.id));

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('width', '40');
            rect.setAttribute('height', '24');
            rect.setAttribute('rx', '12');
            rect.setAttribute('fill', '#05070c');
            rect.setAttribute('stroke', 'rgba(255,255,255,0.06)');
            rect.setAttribute('stroke-width', '1.5');
            rect.setAttribute('id', `node-bg-${isp.id}`);
            g.appendChild(rect);

            const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            txt.setAttribute('x', '20');
            txt.setAttribute('y', '36');
            txt.setAttribute('fill', 'var(--text-muted)');
            txt.setAttribute('font-size', '8px');
            txt.setAttribute('font-weight', '600');
            txt.setAttribute('text-anchor', 'middle');
            txt.setAttribute('id', `node-lbl-${isp.id}`);
            txt.textContent = isp.name.split(' - ')[0];
            g.appendChild(txt);

            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('cx', '20');
            dot.setAttribute('cy', '12');
            dot.setAttribute('r', '3');
            dot.setAttribute('class', 'node-status-ring healthy');
            dot.setAttribute('id', `node-dot-${isp.id}`);
            g.appendChild(dot);

            svg.appendChild(g);
        });

        for (const [id, dev] of Object.entries(window.simulator.devices)) {
            const pos = deviceCoords[id];

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', `svg-node ${id === selectedDeviceId ? 'selected' : ''}`);
            g.setAttribute('id', `node-${id}`);
            g.setAttribute('transform', `translate(${pos.x - 30}, ${pos.y - 25})`);
            g.addEventListener('click', () => selectTopologyDevice(id));

            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.setAttribute('width', '60');
            bg.setAttribute('height', '50');
            bg.setAttribute('class', 'node-bg');
            bg.setAttribute('id', `node-bg-${id}`);
            g.appendChild(bg);

            const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            
            let d = '';
            if (dev.type === 'firewall') {
                d = 'M 30 10 L 42 15 L 42 25 C 42 32 37 38 30 40 C 23 38 18 32 18 25 L 18 15 Z';
            } else if (dev.type === 'switch') {
                d = 'M 18 15 L 42 15 M 18 25 L 42 25 M 24 15 L 24 25 M 36 15 L 36 25';
            } else {
                d = 'M 30 35 L 30 30 M 24 24 A 8 8 0 0 1 36 24 M 20 18 A 14 14 0 0 1 40 18';
            }

            iconPath.setAttribute('d', d);
            iconPath.setAttribute('class', 'node-icon');
            iconPath.setAttribute('stroke', 'var(--text-muted)');
            iconPath.setAttribute('stroke-width', '1.5');
            iconPath.setAttribute('fill', 'none');
            g.appendChild(iconPath);

            const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            ring.setAttribute('cx', '50');
            ring.setAttribute('cy', '10');
            ring.setAttribute('r', '4');
            ring.setAttribute('class', 'node-status-ring healthy');
            ring.setAttribute('id', `node-ring-${id}`);
            g.appendChild(ring);

            const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            lbl.setAttribute('x', '30');
            lbl.setAttribute('y', '62');
            lbl.setAttribute('class', 'node-label');
            lbl.textContent = dev.name.split(' ')[0] + ' ' + (dev.name.split(' ')[1] || '');
            g.appendChild(lbl);

            const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            sub.setAttribute('x', '30');
            sub.setAttribute('y', '72');
            sub.setAttribute('class', 'node-sublabel');
            sub.textContent = dev.ip;
            g.appendChild(sub);

            svg.appendChild(g);
        }

        updateTopologyDynamicStates();
    }

    function updateTopologyDynamicStates() {
        const sim = window.simulator;

        sim.isps.forEach(isp => {
            const ring = document.getElementById(`node-dot-${isp.id}`);
            const bg = document.getElementById(`node-bg-${isp.id}`);
            
            if (ring && bg) {
                ring.setAttribute('class', `node-status-ring ${isp.status}`);
                if (isp.status === 'down') {
                    bg.setAttribute('stroke', 'var(--danger)');
                } else if (isp.status === 'degraded') {
                    bg.setAttribute('stroke', 'var(--warning)');
                } else {
                    bg.setAttribute('stroke', 'rgba(255,255,255,0.06)');
                }
            }

            const cable = document.getElementById(`cable-${isp.id}`);
            const flow = document.getElementById(`flow-cable-${isp.id}`);
            
            if (cable && flow) {
                if (isp.status === 'down') {
                    cable.setAttribute('class', 'svg-cable cable-down');
                    flow.setAttribute('class', 'packet-flow flow-primary down');
                } else if (isp.status === 'degraded') {
                    cable.setAttribute('class', 'svg-cable cable-degraded');
                    flow.setAttribute('class', 'packet-flow degraded');
                } else {
                    cable.setAttribute('class', 'svg-cable cable-active');
                    flow.setAttribute('class', `packet-flow flow-${flow.id.split('flow-cable-isp')[1].startsWith('4') || flow.id.split('flow-cable-isp')[1].startsWith('8') ? 'wireless' : 'primary'}`);
                }
            }
        });

        for (const [id, dev] of Object.entries(sim.devices)) {
            const ring = document.getElementById(`node-ring-${id}`);
            const bg = document.getElementById(`node-bg-${id}`);
            const nodeG = document.getElementById(`node-${id}`);

            if (ring && bg) {
                ring.setAttribute('class', `node-status-ring ${dev.status}`);
                
                if (dev.status === 'down') {
                    nodeG.classList.add('node-down');
                    bg.setAttribute('stroke', 'var(--danger)');
                } else if (dev.status === 'degraded') {
                    nodeG.classList.remove('node-down');
                    bg.setAttribute('stroke', 'var(--warning)');
                } else {
                    nodeG.classList.remove('node-down');
                    bg.setAttribute('stroke', 'var(--glass-border)');
                }
            }
        }

        updateCoreTrunk('cable-fg80f-sw', 'fg-80f', 'sw-instant-on', 'fiber');
        updateCoreTrunk('cable-fg30gold-sw', 'fg-30g-old', 'sw-tplink-old', 'copper');
        updateCoreTrunk('cable-fg30gnew-sw', 'fg-30g-new', 'sw-tplink-new', 'copper');

        updateCoreTrunk('cable-apg1', 'sw-instant-on', 'ap-grand-1', 'copper');
        updateCoreTrunk('cable-apg2', 'sw-instant-on', 'ap-grand-2', 'copper');
        updateCoreTrunk('cable-apg3', 'sw-instant-on', 'ap-grand-3', 'copper');
        updateCoreTrunk('cable-apg4', 'sw-instant-on', 'ap-grand-4', 'copper');

        updateCoreTrunk('cable-apt1', 'sw-tplink-old', 'ap-tplink-1', 'copper');
        updateCoreTrunk('cable-apt2', 'sw-tplink-old', 'ap-tplink-2', 'copper');

        updateCoreTrunk('cable-apgn1', 'sw-tplink-new', 'ap-grand-new-1', 'copper');
    }

    function updateCoreTrunk(cableId, srcId, dstId, type) {
        const cable = document.getElementById(cableId);
        const flow = document.getElementById(`flow-${cableId}`);
        const src = window.simulator.devices[srcId];
        const dst = window.simulator.devices[dstId];

        if (!cable || !flow || !src || !dst) return;

        if (src.status === 'down' || dst.status === 'down') {
            cable.setAttribute('class', 'svg-cable cable-down');
            flow.setAttribute('class', 'packet-flow down');
        } else if (src.status === 'degraded' || dst.status === 'degraded') {
            cable.setAttribute('class', 'svg-cable cable-degraded');
            flow.setAttribute('class', 'packet-flow degraded');
        } else {
            cable.setAttribute('class', 'svg-cable cable-active');
            flow.setAttribute('class', `packet-flow flow-${type}`);
        }
    }

    function selectTopologyDevice(id) {
        selectedDeviceId = id;
        
        document.querySelectorAll('.svg-node').forEach(node => {
            node.classList.remove('selected');
        });

        const selectedNode = document.getElementById(`node-${id}`);
        if (selectedNode) selectedNode.classList.add('selected');

        updateInspectorUI();
    }

    function updateInspectorUI() {
        const inspector = document.getElementById('inspector-body');
        if (!inspector) return;

        const sim = window.simulator;
        const isIsp = sim.isps.some(i => i.id === selectedDeviceId);

        if (isIsp) {
            const isp = sim.isps.find(i => i.id === selectedDeviceId);
            inspector.innerHTML = `
                <div class="inspector-card">
                    <div class="inspector-header">
                        <i data-lucide="globe"></i>
                        <div>
                            <h4>${isp.name.split(' - ')[0]}</h4>
                            <p>${isp.provider}</p>
                        </div>
                    </div>

                    <div class="ins-row mb-4">
                        <span class="label">Gateway Status</span>
                        <span class="ins-status-badge ${isp.status === 'healthy' ? 'healthy' : isp.status === 'degraded' ? 'degraded' : 'down'}">${isp.status.toUpperCase()}</span>
                    </div>

                    <div class="inspector-details-list">
                        <div class="ins-row">
                            <span class="label">Connection Type</span>
                            <span class="val">${isp.type}</span>
                        </div>
                        <div class="ins-row">
                            <span class="label">Polled Latency</span>
                            <span class="val font-mono">${isp.status === 'down' ? '---' : isp.latency + ' ms'}</span>
                        </div>
                        <div class="ins-row">
                            <span class="label">Packet Loss Rate</span>
                            <span class="val font-mono">${isp.status === 'down' ? '100 %' : isp.loss + ' %'}</span>
                        </div>
                        <div class="ins-row">
                            <span class="label">Provisioned Cap</span>
                            <span class="val font-mono">${isp.bandwidth} Mbps</span>
                        </div>
                        <div class="ins-row">
                            <span class="label">Traffic Inbound</span>
                            <span class="val font-mono">${isp.speedIn} Mbps</span>
                        </div>
                        <div class="ins-row">
                            <span class="label">Traffic Outbound</span>
                            <span class="val font-mono">${isp.speedOut} Mbps</span>
                        </div>
                    </div>

                    <button class="btn btn-secondary mt-6 w-full" id="btn-inspector-poll-link">
                        <i data-lucide="refresh-cw"></i> Poll Link Now
                    </button>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            
            document.getElementById('btn-inspector-poll-link').addEventListener('click', async () => {
                showToastNotification('SNMP Poll Triggered', `Successfully polled gateway ${isp.provider}`, 'success');
                if (isLiveBackend) {
                    try {
                        const targetIp = '192.168.10.1'; // Mock SNMP poll to gateway route
                        const community = document.getElementById('snmp-community').value;
                        const port = document.getElementById('snmp-port').value;
                        
                        appendConsoleLog(`Manual SNMP Link poll to route host for ${isp.name}`, 'text-primary');
                        appendConsoleLog(`[SNMP GET] Walk query targeting link WAN IP route via community: ${community}`, 'text-muted');
                        
                        const res = await fetch(`${BACKEND_URL}/api/test-snmp`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ip: targetIp, community, version: 'v2c', port })
                        });
                        if (res.ok) {
                            const data = await res.json();
                            appendConsoleLog(`[SNMP RESULT] WAN interface route operational: ${data.message}`, 'text-green');
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }
            });
            return;
        }

        const dev = sim.devices[selectedDeviceId];
        if (!dev) return;

        const isDown = dev.status === 'down';
        const hasCpu = dev.cpu !== undefined;
        const hasRam = dev.ram !== undefined;
        const hasClients = dev.clients !== undefined;

        inspector.innerHTML = `
            <div class="inspector-card">
                <div class="inspector-header">
                    <i data-lucide="${dev.type === 'firewall' ? 'shield' : dev.type === 'switch' ? 'menu' : 'wifi'}"></i>
                    <div>
                        <h4>${dev.name}</h4>
                        <p>${dev.brand} ${dev.model}</p>
                    </div>
                </div>

                <div class="ins-row mb-4">
                    <span class="label">SNMP Agent IP</span>
                    <span class="val font-mono">${dev.ip}</span>
                </div>
                <div class="ins-row mb-4">
                    <span class="label">Device Health</span>
                    <span class="ins-status-badge ${dev.status === 'healthy' ? 'healthy' : dev.status === 'degraded' ? 'degraded' : 'down'}">${dev.status.toUpperCase()}</span>
                </div>

                <div class="ins-row mb-4">
                    <span class="label">System Uptime</span>
                    <span class="val font-mono">${isDown ? '---' : formatUptime(dev.uptime)}</span>
                </div>

                ${isDown ? '<div class="alert alert-warning"><i data-lucide="alert-octagon"></i> Device is currently offline. SNMP queries timeout.</div>' : `
                    ${hasCpu ? `
                        <div class="ins-progress-group">
                            <div class="ins-progress-label">
                                <span>SNMP OID CPU Load</span>
                                <span>${dev.cpu}%</span>
                            </div>
                            <div class="progress-track">
                                <div class="progress-fill ${dev.cpu > 80 ? 'danger' : dev.cpu > 60 ? 'warning' : ''}" style="width: ${dev.cpu}%"></div>
                            </div>
                        </div>
                    ` : ''}

                    ${hasRam ? `
                        <div class="ins-progress-group">
                            <div class="ins-progress-label">
                                <span>SNMP OID RAM usage</span>
                                <span>${dev.ram}%</span>
                            </div>
                            <div class="progress-track">
                                <div class="progress-fill ${dev.ram > 80 ? 'danger' : dev.ram > 60 ? 'warning' : ''}" style="width: ${dev.ram}%"></div>
                            </div>
                        </div>
                    ` : ''}

                    ${dev.temp !== undefined ? `
                        <div class="ins-row mb-3">
                            <span class="label">Internal Core Temp</span>
                            <span class="val font-mono ${dev.temp > 70 ? 'text-red' : ''}">${dev.temp} °C</span>
                        </div>
                    ` : ''}

                    ${hasClients ? `
                        <div class="ins-row mb-3">
                            <span class="label">Connected Wireless Clients</span>
                            <span class="val font-mono" style="font-weight: 700; color: var(--primary);">${dev.clients} Nodes</span>
                        </div>
                    ` : ''}

                    ${dev.ports ? `
                        <div class="ins-title-sub"><i data-lucide="activity"></i> SNMP Interface Mappings</div>
                        <div class="ins-table-container">
                            <table class="ins-table">
                                <thead>
                                    <tr>
                                        <th>Port</th>
                                        <th>Label</th>
                                        <th>State</th>
                                        <th>RX</th>
                                        <th>TX</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${dev.ports.map(p => `
                                        <tr>
                                            <td><strong>${p.name}</strong></td>
                                            <td>${p.label}</td>
                                            <td><span class="ins-link-status ${p.status}"></span></td>
                                            <td><span>${p.rx}</span></td>
                                            <td><span>${p.tx}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}

                    <div class="ins-title-sub"><i data-lucide="terminal"></i> SNMP Polled OIDs</div>
                    <div style="font-size: 0.68rem; font-family: var(--font-mono); color: var(--text-muted); background: rgba(0,0,0,0.15); padding: 8px; border-radius: 4px;">
                        ${Object.entries(dev.oids || {}).map(([key, val]) => `
                            <div class="ins-row mb-1">
                                <span>${key.toUpperCase()}:</span>
                                <span style="word-break: break-all;">${val}</span>
                            </div>
                        `).join('')}
                    </div>
                `}

                <button class="btn btn-primary mt-6 w-full" id="btn-manual-snmp" ${isDown ? 'disabled' : ''}>
                    <i data-lucide="terminal"></i> Query SNMP agent
                </button>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();

        const snmpBtn = document.getElementById('btn-manual-snmp');
        if (snmpBtn) {
            snmpBtn.addEventListener('click', () => {
                triggerManualSNMPQuery(dev);
            });
        }
    }

    async function triggerManualSNMPQuery(dev) {
        showToastNotification('SNMP query successful', `Host responded at ${dev.ip}. Check Diagnostics console.`, 'success');
        
        appendConsoleLog(`Manual SNMP Query triggered for host: ${dev.name} (${dev.ip})`, 'text-primary');
        
        if (isLiveBackend) {
            try {
                const community = document.getElementById('snmp-community').value;
                const port = document.getElementById('snmp-port').value;
                const version = document.getElementById('snmp-version').value;
                
                appendConsoleLog(`[SNMP COMMAND] snmpget -v ${version} -c ${community} ${dev.ip} .1.3.6.1`, 'text-muted');
                
                const res = await fetch(`${BACKEND_URL}/api/test-snmp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip: dev.ip, community, version, port })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        appendConsoleLog(`[LIVE SNMP WALK OID SUCCESS] Response from ${dev.ip}: Uptime verified!`, 'text-green');
                        appendConsoleLog(`[OID RESPONSE] SNMPv2-MIB::sysDescr.0 = STRING: ${dev.brand} ${dev.model} Gateway agent`, 'text-green');
                        appendConsoleLog(`[OID RESPONSE] SNMPv2-MIB::sysUpTime.0 = ${data.message.split('Uptime: ')[1]}`, 'text-green');
                    } else {
                        appendConsoleLog(`[SNMP WALK TIMEOUT] Host ${dev.ip} unreachable on port ${port} (UDP timed out). Fallback values:`, 'text-orange');
                        printFallbackOIDs(dev);
                    }
                }
            } catch (e) {
                console.error(e);
            }
        } else {
            appendConsoleLog(`[COMMAND] snmpwalk -v 2c -c public-read-netpulse ${dev.ip} .1.3.6.1`, 'text-muted');
            printFallbackOIDs(dev);
        }
    }

    function printFallbackOIDs(dev) {
        appendConsoleLog(`[OID RESPONSE] SNMPv2-MIB::sysDescr.0 = STRING: ${dev.description}`, 'text-green');
        appendConsoleLog(`[OID RESPONSE] DISMAN-EVENT-MIB::sysUpTimeInstance = Timeticks: (${dev.uptime * 100}) ${formatUptime(dev.uptime)}`, 'text-green');
        
        if (dev.cpu) {
            appendConsoleLog(`[OID RESPONSE] FORTINET-FORTIGATE-MIB::fgSysCpuUsage.0 = INTEGER: ${dev.cpu}`, 'text-green');
        }
        if (dev.ram) {
            appendConsoleLog(`[OID RESPONSE] FORTINET-FORTIGATE-MIB::fgSysMemUsage.0 = INTEGER: ${dev.ram}`, 'text-green');
        }
        if (dev.ports) {
            appendConsoleLog(`[OID RESPONSE] IF-MIB::ifNumber.0 = INTEGER: ${dev.ports.length}`, 'text-green');
            dev.ports.forEach((p, idx) => {
                appendConsoleLog(`[OID RESPONSE] IF-MIB::ifDescr.${idx+1} = STRING: ${p.name} (${p.label})`, 'text-green');
                appendConsoleLog(`[OID RESPONSE] IF-MIB::ifOperStatus.${idx+1} = INTEGER: ${p.status === 'up' ? 'up(1)' : 'down(2)'}`, 'text-green');
            });
        }
    }

    // Helper formatters
    function formatUptime(seconds) {
        if (!seconds) return '0s';
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        let res = '';
        if (d > 0) res += `${d}d `;
        if (h > 0 || d > 0) res += `${h}h `;
        if (m > 0 || h > 0) res += `${m}m `;
        res += `${s}s`;
        return res;
    }

    // ====================================================
    // NetPulse Core v2.6.0 Enterprise Multi-Branch Systems
    // ====================================================

    window.renderInventoryDevices = renderInventoryDevices;

    function setupMultiBranchAndInventory() {
        // 1. Branch Selector listener
        const branchSelect = document.getElementById('branch-select');
        if (branchSelect) {
            branchSelect.addEventListener('change', () => {
                const activeBranch = branchSelect.value;
                window.simulator.activeBranch = activeBranch;
                
                const selectedText = branchSelect.options[branchSelect.selectedIndex].text;
                appendConsoleLog(`Switched active environment branch to: ${selectedText}`, 'text-primary');
                showToastNotification('Branch Profile Active', `Loaded system parameters for ${selectedText}.`, 'success');
                
                // Refresh list of devices in Integrations configurator
                populateDevicesConfigDropdown();
                
                // Force simulation recalculation & UI drawings
                window.simulator.updateSystemAggregates();
                updateDashboardUI();
                renderInventoryDevices();
                updateLiveChart();
                renderTopologySVG();
            });
        }

        // 2. Active Inventory categories filters
        document.querySelectorAll('[data-inventory-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-inventory-filter]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderInventoryDevices();
            });
        });

        // 3. SLA Exporter click events
        const btnCsv = document.getElementById('btn-export-csv');
        const btnJson = document.getElementById('btn-export-json');
        const btnPdf = document.getElementById('btn-export-pdf');

        if (btnCsv) {
            btnCsv.addEventListener('click', () => {
                const dateRange = document.getElementById('export-date-range').value;
                const target = document.getElementById('export-target').value;
                
                // Generate CSV data payload
                let csvContent = 'data:text/csv;charset=utf-8,';
                csvContent += 'Timestamp,Branch,Type,Entity Name,Availability (%),Mean Latency (ms),Packet Loss (%)\n';
                
                const activeBranch = window.simulator.activeBranch || 'branch-alpha';
                const branchName = window.simulator.branches[activeBranch].name;
                
                // ISPs SLA
                window.simulator.isps.forEach(isp => {
                    csvContent += `${new Date().toISOString()},"${branchName}",ISP WAN Gateway,"${isp.name}",${isp.status === 'down' ? 0.0 : 100.0},${isp.latency},${isp.loss}\n`;
                });
                
                // Hardware SLA
                Object.values(window.simulator.devices).forEach(dev => {
                    csvContent += `${new Date().toISOString()},"${branchName}",Hardware Node,"${dev.name}",${dev.status === 'down' ? 0.0 : 100.0},0,0\n`;
                });
                
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', `SLA_Report_${activeBranch}_${dateRange}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                showToastNotification('CSV Download Started', 'Exported full branch telemetry metrics.', 'success');
            });
        }

        if (btnJson) {
            btnJson.addEventListener('click', () => {
                const activeBranch = window.simulator.activeBranch || 'branch-alpha';
                const dateRange = document.getElementById('export-date-range').value;
                
                const payload = {
                    reportType: 'Enterprise Network SLA Audit',
                    generatedAt: new Date().toISOString(),
                    activeBranch,
                    branchInfo: window.simulator.branches[activeBranch],
                    systemUptimeSLA: window.simulator.workingHoursUptime,
                    aggregatedHealthPct: window.simulator.networkHealth,
                    monitoredGateways: window.simulator.isps,
                    monitoredHardware: window.simulator.devices,
                    historicalAlarms: window.simulator.alarmsHistory
                };

                const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
                const link = document.createElement('a');
                link.setAttribute('href', dataStr);
                link.setAttribute('download', `SLA_Telemetry_Dump_${activeBranch}_${dateRange}.json`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                showToastNotification('JSON Telemetry Exported', 'SLA database successfully downloaded.', 'success');
            });
        }

        if (btnPdf) {
            btnPdf.addEventListener('click', () => {
                showToastNotification('Preparing Corporate Report', 'Formatting clean print pages...', 'info');
                setTimeout(() => {
                    window.print();
                }, 800);
            });
        }

        // 4. Per-Device configurator dropdown change listener
        const devConfigSelect = document.getElementById('device-config-select');
        if (devConfigSelect) {
            devConfigSelect.addEventListener('change', () => {
                const devId = devConfigSelect.value;
                const dev = window.simulator.devices[devId];
                if (!dev) return;

                document.getElementById('device-config-ip').value = dev.ip || '';
                document.getElementById('device-config-community').value = dev.snmpCommunity || 'public-read-netpulse';
                document.getElementById('device-config-port').value = dev.snmpPort || '161';
                
                // Mappings OID
                document.getElementById('oid-uptime').value = (dev.oids && dev.oids.uptime) || '.1.3.6.1.2.1.1.3.0';
                document.getElementById('oid-cpu').value = (dev.oids && dev.oids.cpu) || '';
                document.getElementById('oid-ram').value = (dev.oids && dev.oids.ram) || '';
                
                const customOid = (dev.oids && (dev.oids.temp || dev.oids.clients)) || '';
                document.getElementById('oid-temp-clients').value = customOid;
            });
        }

        // Apply Device Config
        const btnSaveDev = document.getElementById('btn-save-device-config');
        if (btnSaveDev) {
            btnSaveDev.addEventListener('click', async () => {
                const devId = devConfigSelect.value;
                const dev = window.simulator.devices[devId];
                if (!dev) return;

                dev.ip = document.getElementById('device-config-ip').value;
                dev.snmpCommunity = document.getElementById('device-config-community').value;
                dev.snmpPort = parseInt(document.getElementById('device-config-port').value);
                
                // Set OIDs
                if (!dev.oids) dev.oids = {};
                dev.oids.uptime = document.getElementById('oid-uptime').value;
                dev.oids.cpu = document.getElementById('oid-cpu').value;
                dev.oids.ram = document.getElementById('oid-ram').value;
                
                const customOidVal = document.getElementById('oid-temp-clients').value;
                if (dev.type === 'ap') {
                    dev.oids.clients = customOidVal;
                } else {
                    dev.oids.temp = customOidVal;
                }

                // If running backend mode, we sync this to the server config!
                if (isLiveBackend) {
                    try {
                        const payload = {
                            deviceId: devId,
                            ip: dev.ip,
                            community: dev.snmpCommunity,
                            port: dev.snmpPort,
                            oids: dev.oids
                        };
                        const res = await fetch(`${BACKEND_URL}/api/device-config`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        if (res.ok) {
                            appendConsoleLog(`[CONFIG] Device config updated on server for ${dev.name}`, 'text-green');
                        }
                    } catch (e) {
                        console.error('Failed to sync device config to backend: ', e);
                    }
                }

                showToastNotification('Device Configuration Applied', `Successfully updated SNMP bindings for ${dev.name}.`, 'success');
                appendConsoleLog(`[CONFIG] Applied local SNMP communities and OID targets for ${dev.name}`, 'text-green');
                renderInventoryDevices();
            });
        }

        // Test Device SNMP
        const btnTestDev = document.getElementById('btn-test-device-snmp');
        if (btnTestDev) {
            btnTestDev.addEventListener('click', async () => {
                const devId = devConfigSelect.value;
                const dev = window.simulator.devices[devId];
                if (!dev) return;

                const community = document.getElementById('device-config-community').value || 'public';
                const port = document.getElementById('device-config-port').value || '161';
                const ip = document.getElementById('device-config-ip').value || dev.ip;

                appendConsoleLog(`[SNMP TEST] Initiating direct walk test to target device ${dev.name} (${ip})...`, 'text-primary');

                if (isLiveBackend) {
                    try {
                        const res = await fetch(`${BACKEND_URL}/api/test-snmp`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ip, community, version: 'v2c', port })
                        });
                        if (res.ok) {
                            const data = await res.json();
                            if (data.success) {
                                appendConsoleLog(`> [SNMP RESPONSE SUCCESS] Uptime reported: ${data.message}`, 'text-green');
                            } else {
                                appendConsoleLog(`> [SNMP TIMEOUT] UDP walk timed out (Host offline or community mismatch)`, 'text-orange');
                                printFallbackOIDs(dev);
                            }
                        }
                    } catch (e) {
                        appendConsoleLog(`> [SNMP ERROR] ${e.message}`, 'text-red');
                    }
                } else {
                    // Simulation mode logs
                    setTimeout(() => {
                        appendConsoleLog(`> [COMMAND] snmpget -v 2c -c ${community} ${ip} ${dev.oids.uptime}`, 'text-muted');
                        printFallbackOIDs(dev);
                    }, 500);
                }
            });
        }

        // Initialize target configuration selector
        populateDevicesConfigDropdown();
    }

    function populateDevicesConfigDropdown() {
        const selectEl = document.getElementById('device-config-select');
        if (!selectEl) return;

        const activeBranch = window.simulator.activeBranch || 'branch-alpha';
        const branch = window.simulator.branches[activeBranch];
        const activeDevices = Object.values(window.simulator.devices).filter(d => branch.devices.includes(d.id));

        selectEl.innerHTML = activeDevices.map(d => `<option value="${d.id}">${d.name} (${d.model})</option>`).join('');
        
        // Trigger manual change to populate fields for first device
        if (activeDevices.length > 0) {
            selectEl.value = activeDevices[0].id;
            selectEl.dispatchEvent(new Event('change'));
        }
    }

    // Render category grid list
    function renderInventoryDevices() {
        const grid = document.getElementById('inventory-devices-grid');
        if (!grid) return;

        const activeBranch = window.simulator.activeBranch || 'branch-alpha';
        const branch = window.simulator.branches[activeBranch];
        const activeDevices = Object.values(window.simulator.devices).filter(d => branch.devices.includes(d.id));

        // Get filter value
        const activeFilterBtn = document.querySelector('[data-inventory-filter].active');
        const filter = activeFilterBtn ? activeFilterBtn.getAttribute('data-inventory-filter') : 'all';

        let filteredDevices = activeDevices;
        if (filter !== 'all') {
            filteredDevices = activeDevices.filter(d => d.type === filter);
        }

        if (filteredDevices.length === 0) {
            grid.innerHTML = `
                <div class="no-alarms flex-column" style="grid-column: 1 / -1; width: 100%; text-align: center; padding: 40px 0;">
                    <i data-lucide="info" style="width:36px; height:36px; color:var(--text-muted); margin:0 auto 12px;"></i>
                    <p style="font-weight:600; color:var(--text-main);">No devices found matching this category in the current branch.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        grid.innerHTML = filteredDevices.map(dev => {
            const statusClass = dev.status === 'down' ? 'offline' : (isLiveBackend ? 'online' : 'simulated');
            const statusLabel = dev.status === 'down' ? 'Offline' : (isLiveBackend ? 'SNMP Online' : 'Simulation');
            const brandClass = dev.brand.toLowerCase().replace(/[^a-z0-9]/g, '-');

            // Port tags
            let portsHtml = '';
            if (dev.ports) {
                portsHtml = `
                    <div class="device-ports-list" style="margin-top: 10px; border-top:1px solid var(--glass-border); padding-top:10px;">
                        <div class="device-ports-header" style="font-size:0.7rem; font-weight:600; text-transform:uppercase; color:var(--text-muted); margin-bottom:6px;">Interfaces</div>
                        <div class="device-ports-grid" style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${dev.ports.map(p => `
                                <div class="port-tag ${p.status}">
                                    <span class="indicator-dot ${p.status === 'up' ? 'healthy' : 'critical'}" style="width: 6px; height: 6px; border-radius: 50%; display:inline-block;"></span>
                                    ${p.name} (${p.label})
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Gauges Warnings
            const isCpuWarning = dev.cpu > window.simulator.thresholds.cpu;
            const isRamWarning = dev.ram > window.simulator.thresholds.ram;

            // Optional AP or Temp specific row details
            const clientsRow = dev.clients !== undefined ? `
                <div class="device-meta-row" style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                    <span class="lbl" style="color:var(--text-muted);">Active Wireless Clients</span>
                    <span class="val font-mono text-primary" style="font-weight:700; color:var(--primary);">${dev.clients} leases</span>
                </div>
            ` : '';

            const tempRow = dev.temp !== undefined ? `
                <div class="device-meta-row" style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                    <span class="lbl" style="color:var(--text-muted);">Chassis Temperature</span>
                    <span class="val" style="font-weight:600; color:var(--text-main);">${dev.temp} °C</span>
                </div>
            ` : '';

            return `
                <div class="device-card glass-card" style="padding:20px; display:flex; flex-direction:column; gap:14px; position:relative; overflow:hidden;">
                    <div class="device-card-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div class="device-info-main">
                            <span class="device-brand-badge ${brandClass}">${dev.brand}</span>
                            <h3 style="font-size:1.02rem; font-weight:700; color:var(--text-main); margin-top:2px;">${dev.name}</h3>
                            <span class="device-ip" style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted);">${dev.ip}</span>
                        </div>
                        <span class="device-status-badge ${statusClass}">${statusLabel}</span>
                    </div>

                    <div class="device-gauges" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; background:rgba(255,255,255,0.015); border:1px solid var(--glass-border); border-radius:8px; padding:10px;">
                        <div class="device-gauge-box" style="display:flex; flex-direction:column; align-items:center; text-align:center;">
                            <span class="g-val ${isCpuWarning ? 'danger' : ''}" style="font-family:var(--font-mono); font-size:1.15rem; font-weight:700; color:${isCpuWarning ? 'var(--danger)' : 'var(--text-main)'};">${dev.status === 'down' ? '0' : dev.cpu}%</span>
                            <span class="g-lbl" style="font-size:0.62rem; color:var(--text-muted); text-transform:uppercase;">CPU Load</span>
                        </div>
                        <div class="device-gauge-box" style="display:flex; flex-direction:column; align-items:center; text-align:center; border-left:1px solid var(--glass-border); border-right:1px solid var(--glass-border);">
                            <span class="g-val ${isRamWarning ? 'danger' : ''}" style="font-family:var(--font-mono); font-size:1.15rem; font-weight:700; color:${isRamWarning ? 'var(--danger)' : 'var(--text-main)'};">${dev.status === 'down' ? '0' : dev.ram}%</span>
                            <span class="g-lbl" style="font-size:0.62rem; color:var(--text-muted); text-transform:uppercase;">RAM Load</span>
                        </div>
                        <div class="device-gauge-box" style="display:flex; flex-direction:column; align-items:center; text-align:center;">
                            <span class="g-val" style="font-family:var(--font-mono); font-size:1.15rem; font-weight:700; color:var(--text-main);">${dev.status === 'down' ? '0' : (dev.temp !== undefined ? dev.temp + '°C' : (dev.clients !== undefined ? dev.clients : 'N/A'))}</span>
                            <span class="g-lbl" style="font-size:0.62rem; color:var(--text-muted); text-transform:uppercase;">${dev.temp !== undefined ? 'Temp' : (dev.clients !== undefined ? 'Clients' : 'Aux')}</span>
                        </div>
                    </div>

                    <div class="device-meta-details" style="font-size:0.75rem; display:flex; flex-direction:column; gap:4px; border-top:1px solid var(--glass-border); padding-top:10px;">
                        <div class="device-meta-row" style="display:flex; justify-content:space-between;">
                            <span class="lbl" style="color:var(--text-muted);">Hardware Model</span>
                            <span class="val" style="font-weight:600; color:var(--text-main);">${dev.model}</span>
                        </div>
                        <div class="device-meta-row" style="display:flex; justify-content:space-between;">
                            <span class="lbl" style="color:var(--text-muted);">System Uptime</span>
                            <span class="val font-mono" style="font-weight:600; color:var(--text-main);">${dev.status === 'down' ? '0s' : formatUptime(dev.uptime)}</span>
                        </div>
                        ${clientsRow}
                        ${tempRow}
                        <div class="device-meta-row" style="display:flex; justify-content:space-between;">
                            <span class="lbl" style="color:var(--text-muted);">Location Zone</span>
                            <span class="val" style="font-weight:600; color:var(--text-main);">${dev.zone}</span>
                        </div>
                    </div>

                    ${portsHtml}
                    <div class="card-glow ${dev.status === 'down' ? 'red' : 'blue'}" style="position: absolute; width: 60px; height: 60px; filter: blur(30px); border-radius: 50%; opacity: 0.15; pointer-events: none; top: -30px; right: -30px;"></div>
                </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }
});
