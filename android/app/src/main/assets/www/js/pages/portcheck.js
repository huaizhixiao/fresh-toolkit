// ========== 设备端口检测 ==========
router.register('portcheck', (container) => {
  // 常见端口与服务名（用于结果展示）
  const PORT_SERVICES = {
    21:'FTP', 22:'SSH', 23:'Telnet', 25:'SMTP', 53:'DNS', 69:'TFTP', 80:'HTTP',
    110:'POP3', 135:'MS-RPC', 139:'NetBIOS', 143:'IMAP', 389:'LDAP', 443:'HTTPS',
    445:'SMB', 465:'SMTPS', 587:'SMTP(提交)', 636:'LDAPS', 993:'IMAPS', 995:'POP3S',
    1433:'MSSQL', 1521:'Oracle', 2049:'NFS', 3306:'MySQL', 3389:'RDP', 5432:'PostgreSQL',
    5900:'VNC', 6379:'Redis', 7001:'WebLogic', 8000:'HTTP-Alt', 8080:'HTTP-Alt',
    8443:'HTTPS-Alt', 8888:'HTTP-Alt', 9000:'SonarQube/Alt', 9090:'Prometheus',
    9200:'Elasticsearch', 11211:'Memcached', 27017:'MongoDB', 5000:'Flask/UPnP', 3000:'Node/Dev'
  };

  const COMMON_PORTS = '21,22,23,25,53,80,110,135,139,143,389,443,445,465,587,993,995,1433,1521,3306,3389,5432,5900,6379,7001,8000,8080,8443,8888,9000,9090,9200,11211,27017';
  const WEB_PORTS    = '80,443,8000,8080,8443,8888,3000,5000,9000,9090';

  let state = {
    host: '192.168.1.1',
    ports: COMMON_PORTS,
    timeout: 1000,
    checking: false,
    results: [],        // { port, open, elapsed }
    progress: 0,
    total: 0,
    openCount: 0,
    elapsed: 0
  };

  function render() {
    const openCount = state.results.filter(r => r.open).length;

    container.innerHTML = `
      <div class="card" style="margin:12px;">
        <div class="card-title">🔌 设备端口检测</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">对指定设备（IP / 域名）探测 TCP 端口是否开放，支持单个、逗号分隔及范围（如 1-1024）</div>

        <div class="input-group">
          <label class="input-label">目标设备</label>
          <input class="input-field" id="pcHost" value="${state.host}" placeholder="IP 或域名，如 192.168.1.1" autocomplete="off" ${state.checking?'disabled':''}>
        </div>

        <div class="input-group" style="margin-top:8px;">
          <label class="input-label">端口（逗号分隔或范围，如 80,443,1-1024）</label>
          <textarea class="input-field" id="pcPorts" rows="2" style="font-family:monospace;font-size:13px;resize:vertical;" placeholder="80,443,8080 或 1-1000" ${state.checking?'disabled':''}>${state.ports}</textarea>
        </div>

        <div class="preset-list" style="margin-top:6px;">
          <button class="preset-item" data-preset="common" ${state.checking?'disabled':''}>📋 常见端口</button>
          <button class="preset-item" data-preset="web" ${state.checking?'disabled':''}>🌐 Web端口</button>
        </div>

        <div style="display:flex;gap:12px;margin:12px 0;align-items:center;">
          <span style="font-size:14px;color:var(--text-secondary);">超时:</span>
          <select id="pcTimeout" style="border:none;background:transparent;color:var(--primary);font-weight:600;font-size:14px;" ${state.checking?'disabled':''}>
            ${[300,500,1000,2000,3000].map(n => `<option value="${n}" ${n===state.timeout?'selected':''}>${n}ms</option>`).join('')}
          </select>
        </div>

        <div class="btn-row" style="margin-bottom:10px;">
          <button class="btn btn-primary" id="pcStart" style="flex:1;${state.checking?'display:none':''}">▶ 开始检测</button>
          <button class="btn btn-danger" id="pcStop" style="flex:1;${state.checking?'':'display:none'}">⏹ 停止</button>
        </div>

        ${state.checking ? `
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#666;margin-bottom:4px;">
            <span>⏳ 正在探测端口...</span>
            <span id="pcProgressText">${state.progress}%</span>
          </div>
          <div style="width:100%;height:8px;background:#e8e8e8;border-radius:4px;overflow:hidden;">
            <div id="pcProgressBar" style="width:${state.progress}%;height:100%;background:linear-gradient(90deg,#f093fb,#f5576c);border-radius:4px;transition:width 0.25s;"></div>
          </div>
        </div>` : ''}

        ${!state.checking && state.results.length > 0 ? `
        <div class="stats-grid" style="margin-bottom:10px;">
          <div class="stat-item"><span class="stat-label">总端口</span><span class="stat-value">${state.total}</span></div>
          <div class="stat-item"><span class="stat-label">开放</span><span class="stat-value success">${openCount}</span></div>
          <div class="stat-item"><span class="stat-label">关闭</span><span class="stat-value">${state.total - openCount}</span></div>
          <div class="stat-item"><span class="stat-label">耗时</span><span class="stat-value">${(state.elapsed/1000).toFixed(1)}s</span></div>
        </div>` : ''}

        <div class="result-list" id="pcResultList">
          ${state.results.length === 0 && !state.checking ? '<div class="empty-state">输入目标与端口，点击开始检测</div>' : ''}
        </div>

        ${state.results.length > 0 && !state.checking ? `
        <button class="btn btn-small btn-outline" id="pcCopyOpen" style="margin-top:8px;">复制开放端口</button>` : ''}
      </div>
    `;

    const hostInput = util.$('pcHost');
    if (hostInput) hostInput.oninput = () => { if(!state.checking) state.host = hostInput.value.trim(); };
    const portsInput = util.$('pcPorts');
    if (portsInput) portsInput.oninput = () => { if(!state.checking) state.ports = portsInput.value.trim(); };
    const timeoutSel = util.$('pcTimeout');
    if (timeoutSel) timeoutSel.onchange = () => { if(!state.checking) state.timeout = parseInt(timeoutSel.value) || 1000; };

    const startBtn = util.$('pcStart');
    if (startBtn) startBtn.onclick = startCheck;
    const stopBtn = util.$('pcStop');
    if (stopBtn) stopBtn.onclick = stopCheck;

    container.querySelectorAll('[data-preset]').forEach(el => {
      el.onclick = () => {
        if (state.checking) return;
        state.ports = el.dataset.preset === 'web' ? WEB_PORTS : COMMON_PORTS;
        render();
      };
    });

    const copyBtn = util.$('pcCopyOpen');
    if (copyBtn) copyBtn.onclick = () => {
      const open = state.results.filter(r => r.open).map(r => r.port).join(',');
      if (open) copyText(open);
      else showToast('没有开放的端口');
    };

    renderResults();
  }

  // 增量渲染结果列表
  function renderResults() {
    const list = util.$('pcResultList');
    if (!list) return;
    const sorted = state.results.slice().sort((a, b) => a.port - b.port);
    list.innerHTML = sorted.map(r => {
      const svc = PORT_SERVICES[r.port] || '';
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;margin-bottom:6px;background:${r.open?'#f6ffed':'#fafafa'};border:1px solid ${r.open?'#b7eb8f':'#f0f0f0'};">
          <span style="font-family:monospace;font-weight:600;min-width:56px;">${r.port}</span>
          <span style="flex:1;font-size:13px;color:var(--text-secondary);">${svc}</span>
          <span style="font-size:12px;color:#999;min-width:44px;text-align:right;">${r.elapsed}ms</span>
          <span style="font-size:13px;font-weight:600;color:${r.open?'#52c41a':'#bbb'};min-width:34px;text-align:right;">${r.open?'开放':'关闭'}</span>
        </div>`;
    }).join('');
    list.scrollTop = list.scrollHeight;
  }

  function updateProgress(pct) {
    state.progress = pct;
    const bar = util.$('pcProgressBar');
    if (bar) bar.style.width = pct + '%';
    const txt = util.$('pcProgressText');
    if (txt) txt.textContent = pct + '%';
  }

  function startCheck() {
    const host = state.host.trim();
    const ports = state.ports.trim();
    if (!host) { showToast('请填写目标设备'); return; }
    if (!ports) { showToast('请填写端口'); return; }
    state.results = [];
    state.progress = 0;
    state.total = 0;
    state.openCount = 0;
    state.elapsed = 0;
    state.checking = true;
    render();
    try {
      NativePortCheck.checkPorts(host, ports, state.timeout);
    } catch (e) {
      showToast('端口检测模块不可用');
      state.checking = false;
      render();
    }
  }

  function stopCheck() {
    try { NativePortCheck.stopCheck(); } catch (e) {}
    state.checking = false;
    render();
  }

  // ===== 原生回调 =====
  window._portStart = (total) => {
    state.total = total;
    state.progress = 0;
    state.checking = true;
    updateProgress(0);
  };

  window._portResult = (port, open, elapsed) => {
    state.results.push({ port, open: !!open, elapsed: elapsed || 0 });
    if (open) state.openCount++;
    renderResults();
  };

  window._portProgress = (pct) => {
    updateProgress(pct);
  };

  window._portDone = (open, total, elapsed) => {
    state.openCount = open;
    state.total = total;
    state.elapsed = elapsed || 0;
    state.progress = 100;
    state.checking = false;
    render();
    showToast('检测完成，开放 ' + open + ' / ' + total + ' 个端口');
  };

  window._portStopped = () => {
    state.checking = false;
    render();
    showToast('已停止检测');
  };

  window._portError = (msg) => {
    state.checking = false;
    render();
    showToast(msg || '检测出错');
  };

  render();
});
