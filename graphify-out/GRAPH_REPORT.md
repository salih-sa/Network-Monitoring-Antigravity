# Graph Report - Network-Monitoring-Antigravity  (2026-06-01)

## Corpus Check
- 6 files · ~28,111 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 146 nodes · 190 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `97ad4dbb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]

## God Nodes (most connected - your core abstractions)
1. `NetworkSimulator` - 15 edges
2. `init()` - 12 edges
3. `fetchBackendData()` - 8 edges
4. `updateDashboardUI()` - 8 edges
5. `appendConsoleLog()` - 5 edges
6. `NetPulse Core | Modern Network Monitoring & SLA Dashboard` - 5 edges
7. `initCharts()` - 4 edges
8. `updateGraphifyPanel()` - 4 edges
9. `updateTopologyDynamicStates()` - 4 edges
10. `updateInspectorUI()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `init()` --calls--> `checkBackendAvailability()`  [EXTRACTED]
  app.js → app.js  _Bridges community 5 → community 7_
- `init()` --calls--> `initCharts()`  [EXTRACTED]
  app.js → app.js  _Bridges community 5 → community 10_
- `init()` --calls--> `renderTopologySVG()`  [EXTRACTED]
  app.js → app.js  _Bridges community 5 → community 9_
- `init()` --calls--> `updateDashboardUI()`  [EXTRACTED]
  app.js → app.js  _Bridges community 5 → community 8_
- `fetchBackendData()` --calls--> `updateDashboardUI()`  [EXTRACTED]
  app.js → app.js  _Bridges community 9 → community 8_

## Communities (11 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (20): clearSimLogsBtn, clockElement, closeSimBtn, navItems, notifBadge, notifBell, notifContainer, notificationStack (+12 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (18): app, axios, config, CONFIG_FILE, cors, devices, DEVICES_OVERRIDE_FILE, express (+10 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (16): author, dependencies, axios, cors, dotenv, express, net-snmp, description (+8 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (16): 1. Second & Third Floor (Zone A), 2. First Floor (Old Wing - Zone B), 3. First Floor (New Wing - Zone C), code:bash (cd C:\Users\salih\.gemini\antigravity\scratch\network-monito), code:bash (npm start), code:text (🚀 NetPulse Core Gateway active on http://localhost:3000), ⚙️ Connecting Your Real Devices & Zabbix, ⚡ Dual-Mode System (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.20
Nodes (10): init(), populateDevicesConfigDropdown(), setupClock(), setupDrawers(), setupMultiBranchAndInventory(), setupNotifications(), setupSettingsPersistence(), setupSimulatorPanel() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.20
Nodes (9): snmpCommunity, snmppollInt, snmpPollInterval, snmpPort, snmpVersion, zabbixsync, zabbixSyncMode, zabbixToken (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.29
Nodes (8): appendConsoleLog(), checkBackendAvailability(), formatUptime(), printFallbackOIDs(), runIntegrationDiagnostics(), selectTopologyDevice(), triggerManualSNMPQuery(), updateInspectorUI()

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (7): getActiveBranchGraph(), renderISPDetailList(), renderISPQuickList(), renderSLAIncidentsHistory(), renderZabbixAlarms(), updateDashboardUI(), updateGraphifyPanel()

### Community 9 - "Community 9"
Cohesion: 0.29
Nodes (7): fetchBackendData(), mergeLiveCollection(), mergeLiveDeviceMap(), renderTopologySVG(), updateCoreTrunk(), updateLiveChart(), updateTopologyDynamicStates()

### Community 10 - "Community 10"
Cohesion: 0.67
Nodes (3): initCharts(), initLiveChart(), initSlaChart()

## Knowledge Gaps
- **71 isolated node(s):** `navItems`, `tabPanes`, `searchBar`, `clockElement`, `notifBell` (+66 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `navItems`, `tabPanes`, `searchBar` to the rest of the system?**
  _71 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._