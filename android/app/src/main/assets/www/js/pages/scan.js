// ========== 局域网扫描器 ==========
router.register('scan', (container) => {
  let state = {
    ipPrefix: '192.168.1',
    startIp: 1,
    endIp: 254,
    ports: '',
    scanning: false,
    results: [],      // {ip: 1, hostname: '', ports: '80,443', info: 'MAC (Vendor)', alive: true}
    progress: 0,
    startTime: null
  };

  function render() {
    const aliveCount = state.results.filter(r => r.alive).length;
    const elapsed = state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0;

    container.innerHTML = `
      <div class="card" style="margin:12px;">
        <div class="card-title">🌐 局域网扫描器</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">扫描网段内的活跃设备，留空端口可快速发现 IP</div>

        <!-- IP 段输入 -->
        <div class="input-row" style="gap:6px;margin-bottom:8px;">
          <div style="flex:2;">
            <label class="input-label">IP 段</label>
            <input class="input-field" id="scanIpPrefix" value="${state.ipPrefix}" style="font-family:monospace;">
          </div>
          <div style="flex:0 0 50px;">
            <label class="input-label">起始</label>
            <input class="input-field" id="scanStartIp" value="${state.startIp}" type="number" min="1" max="254" style="text-align:center;">
          </div>
          <div style="flex:0 0 50px;">
            <label class="input-label">结束</label>
            <input class="input-field" id="scanEndIp" value="${state.endIp}" type="number" min="1" max="254" style="text-align:center;">
          </div>
        </div>

        <div class="input-group" style="margin-bottom:10px;">
          <label class="input-label">端口（留空不扫端口，快速发现）</label>
          <input class="input-field" id="scanPorts" value="${state.ports}" style="font-family:monospace;font-size:12px;" placeholder="留空=仅发现IP 或 80,443,3000-4000,8080">
        </div>

        <!-- 控制按钮 -->
        <div class="btn-row" style="margin-bottom:10px;">
          <button class="btn btn-primary" id="btnScanStart" style="flex:1;${state.scanning?'display:none':''}">🔍 ${state.ports.trim() ? '扫描端口' : '快速发现'}</button>
          <button class="btn btn-danger" id="btnScanStop" style="flex:1;${state.scanning?'':'display:none'}">⏹ 停止</button>
        </div>

        <!-- 进度条 -->
        ${state.scanning ? `
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#666;margin-bottom:4px;">
            <span>⏳ 正在扫描中，请稍等...</span>
            <span>${state.progress}%</span>
          </div>
          <div style="width:100%;height:8px;background:#e8e8e8;border-radius:4px;overflow:hidden;">
            <div style="width:${state.progress}%;height:100%;background:线性-gradient(90deg,#667eea,#764ba2);border-radius:4px;transition:width 0.3s;"></div>
          </div>
          <div style="font-size:11px;color:#999;margin-top:4px;">
            已发现 ${aliveCount} 个活跃设备 · 已用 ${elapsed} 秒
          </div>
        </div>` : ''}

        ${!state.scanning && aliveCount > 0 ? `
        <div style="font-size:12px;color:#666;margin-bottom:6px;">共扫描 ${state.results.length} 个 IP，发现 ${aliveCount} 个活跃设备</div>` : ''}

        <!-- 扫描结果 -->
        ${state.results.length > 0 ? `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f0f2f5;">
                <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #ddd;">IP</th>
                <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #ddd;">状态</th>
                <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #ddd;">开放端口</th>
              </tr>
            </thead>
            <tbody>
              ${state.results.filter(r => r.alive).map(r => `
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:5px 10px;font-family:monospace;font-weight:600;color:#333;">${state.ipPrefix}.${r.ip}</td>
                <td style="padding:5px 10px;"><span style="color:var(--primary);font-size:16px;">●</span></td>
                <td style="padding:5px 10px;font-family:monospace;font-size:12px;color:#e74c3c;">
                  ${r.ports ? r.ports.split(',').map(p => `<span class="tag tag-red" style="font-size:11px;margin:1px 2px;">${p}</span>`).join('') : '-'}
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : state.scanning ? '' : `
        <div style="text-align:center;padding:30px;color:#bbb;font-size:14px;">
          <div style="font-size:40px;margin-bottom:8px;">🌐</div>
          输入网段，点击开始扫描或快速发现
        </div>`}
      </div>
    `;

    // 事件绑定
    const ipInput = util.$('scanIpPrefix');
    if (ipInput) ipInput.oninput = () => { state.ipPrefix = ipInput.value; };

    const startInput = util.$('scanStartIp');
    if (startInput) startInput.oninput = () => { state.startIp = parseInt(startInput.value) || 1; };

    const endInput = util.$('scanEndIp');
    if (endInput) endInput.oninput = () => { state.endIp = parseInt(endInput.value) || 254; };

    const portsInput = util.$('scanPorts');
    if (portsInput) portsInput.oninput = () => { state.ports = portsInput.value; };

    const btnStart = util.$('btnScanStart');
    if (btnStart) btnStart.onclick = startScan;

    const btnStop = util.$('btnScanStop');
    if (btnStop) btnStop.onclick = stopScan;
  }

  function startScan() {
    state.results = [];
    state.progress = 0;
    state.scanning = true;
    state.startTime = Date.now();
    render();
    try {
      NativeScanner.startScan(state.ipPrefix, state.startIp, state.endIp, state.ports);
    } catch(e) {
      showToast('扫描模块不可用');
      state.scanning = false;
      render();
    }
  }

  function stopScan() {
    try { NativeScanner.stopScan(); } catch(e) {}
    state.scanning = false;
    render();
  }

  // 回调：单个 IP 扫描结果（ports = '' 表示在线但无端口数据）
  window._scanResult = (ip, ports) => {
    const idx = state.results.findIndex(r => r.ip === ip);
    const entry = { ip, ports, alive: true };
    if (idx >= 0) {
      state.results[idx] = entry;
    } else {
      let inserted = false;
      for (let i = 0; i < state.results.length; i++) {
        if (state.results[i].ip > ip) {
          state.results.splice(i, 0, entry);
          inserted = true;
          break;
        }
      }
      if (!inserted) state.results.push(entry);
    }
  };

  // 回调：扫描开始
  window._scanStart = () => {
    state.scanning = true;
    state.results = [];
    state.progress = 0;
    state.startTime = Date.now();
    render();
  };

  // 回调：调试日志
  window._scanDebug = (msg) => {
    console.log('[Scanner]', msg);
  };

  // 回调：进度更新
  window._scanProgress = (progress) => {
    state.progress = progress;
    render();
  };

  // 回调：扫描完成
  window._scanComplete = () => {
    state.scanning = false;
    state.progress = 100;
    render();
    showToast('扫描完成');
  };

  render();
});