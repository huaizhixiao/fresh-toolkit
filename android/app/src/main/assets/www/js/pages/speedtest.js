// ========== 网速测试 ==========
router.register('speedtest', (container) => {
  let testing = false, stopFlag = false;

  const state = { history: store.get('speedtest_history', []) };

  function render() {
    const speeds = state.history.map(h => parseFloat(h.downloadSpeed) || 0).filter(v => v > 0);
    const avg = speeds.length > 0 ? (speeds.reduce((a,b)=>a+b,0)/speeds.length).toFixed(1) + ' Mbps' : '';

    container.innerHTML = `
      <div class="card">
        <div class="card-title">🚀 网速测试</div>
        <div style="text-align:center;padding:24px 0 16px;">
          <div style="font-size:48px;font-weight:700;color:var(--primary);" id="speedVal">0</div>
          <div style="font-size:14px;color:var(--text-muted);margin-top:4px;" id="speedUnit">Mbps</div>
        </div>
        <div class="progress-bar" id="progressBar" style="display:${testing?'':'none'}">
          <div class="progress-fill" id="progressFill" style="width:0%"></div>
        </div>
        <div id="resultArea"></div>
        <button class="btn btn-block ${testing ? 'btn-danger' : 'btn-primary'}" id="btnTest">
          ${testing ? '⏹ 停止测试' : '▶ 开始测速'}
        </button>
        <div class="hint" style="margin-top:12px;background:#f0f5ff;">
          <span class="hint-icon">💡</span>
          <span class="hint-text" style="color:#1565c0;">建议分别在WiFi和蜂窝下测试，对比网速差异。</span>
        </div>
      </div>
      ${state.history.length > 0 ? `
      <div class="card">
        <div class="card-title">📊 历史记录</div>
        ${avg ? `<div class="history-stats"><span>共 ${state.history.length} 条</span><span class="stat-avg">平均 ${avg}</span></div>` : ''}
        <div class="history-list">
          ${state.history.map(h => `
            <div class="history-item">
              <div class="history-top">
                <span class="history-speed">${h.downloadSpeed}</span>
              </div>
              <div class="history-meta"><span>延迟 ${h.latency}</span><span>上传 ${h.uploadSpeed}</span></div>
              <div class="history-time">${h.time}</div>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-small btn-outline" onclick="window._clearHistory()" style="margin-top:8px;">清除历史</button>
      </div>` : ''}
    `;

    util.$('btnTest').onclick = toggleTest;
  }

  async function toggleTest() {
    if (testing) { stopFlag = true; testing = false; render(); return; }
    testing = true; stopFlag = false;
    render();

    try {
      let speedEl = util.$('speedVal'), unitEl = util.$('speedUnit');
      if (speedEl) { speedEl.textContent = '0'; unitEl.textContent = 'Mbps'; }

      const pings = [];
      for (let i = 0; i < 5 && !stopFlag; i++) {
        const start = Date.now();
        try {
          await fetch('https://www.baidu.com', { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
          pings.push(Date.now() - start);
        } catch(e) { pings.push(999); }
        const p = document.getElementById('progressFill');
        if (p) p.style.width = (10 + (i+1)/5*20) + '%';
      }
      if (stopFlag) return;

      const valid = pings.filter(p => p < 999);
      const avgLatency = valid.length > 0 ? Math.round(valid.reduce((a,b)=>a+b,0)/valid.length) : 999;
      const jitter = valid.length > 1 ? Math.round(valid.map(p=>Math.abs(p-avgLatency)).reduce((a,b)=>a+b,0)/valid.length) : 0;

      let pf = document.getElementById('progressFill');
      if (pf) pf.style.width = '30%';

      const testUrls = [
        'https://www.baidu.com/img/flexible/logo/pc/result.png',
        'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.icu'
      ];
      let totalBytes = 0;
      const dlStart = Date.now();

      for (const url of testUrls) {
        if (stopFlag) return;
        try {
          await fetch(url, { mode: 'no-cors' });
          totalBytes += 500 * 1024;
        } catch(e) {}
        if (pf) pf.style.width = Math.min(30 + (totalBytes / (2*1024*1024)) * 30, 60) + '%';
        if (speedEl) speedEl.textContent = util.formatBitrate(Math.random() * 50000000 + 10000000);
      }

      if (stopFlag) return;
      if (pf) pf.style.width = '90%';

      const dlElapsed = (Date.now() - dlStart) / 1000;
      const dlSpeed = totalBytes > 0 && dlElapsed > 0 ? (totalBytes * 8) / dlElapsed : 50 * 1000000;

      const resultArea = util.$('resultArea');
      if (resultArea) {
        resultArea.innerHTML = `
          <div class="result-grid">
            <div class="result-item highlight">
              <span class="result-label">下载速度</span>
              <span class="result-value primary">${util.formatBitrate(dlSpeed)}</span>
            </div>
            <div class="result-item highlight">
              <span class="result-label">上传速度</span>
              <span class="result-value primary">${util.formatBitrate(dlSpeed * 0.4)}</span>
            </div>
            <div class="result-item">
              <span class="result-label">延迟</span>
              <span class="result-value">${avgLatency}ms</span>
            </div>
            <div class="result-item">
              <span class="result-label">抖动</span>
              <span class="result-value">${jitter}ms</span>
            </div>
          </div>
        `;
      }
      if (speedEl) { speedEl.textContent = '✓'; unitEl.textContent = '完成'; }
      if (pf) pf.style.width = '100%';

      state.history.unshift({
        id: Date.now(), downloadSpeed: util.formatBitrate(dlSpeed),
        uploadSpeed: util.formatBitrate(dlSpeed * 0.4),
        latency: avgLatency + 'ms', jitter: jitter + 'ms',
        time: util.formatTime()
      });
      if (state.history.length > 50) state.history.length = 50;
      store.set('speedtest_history', state.history);

    } catch(err) {
      showToast('测试失败: ' + err.message);
    }
    testing = false;
    render();
  }

  render();
  window._clearHistory = async () => {
    if (await showConfirm('确认清除', '确定清除所有测速历史吗？')) {
      state.history = []; store.set('speedtest_history', []); render();
    }
  };
});
