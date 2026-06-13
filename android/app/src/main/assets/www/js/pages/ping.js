// ========== Ping 模块 ==========
router.register('ping', (container) => {
  const COMMON_TARGETS = ['8.8.8.8','114.114.114.114','223.5.5.5','192.168.1.1','baidu.com','qq.com'];

  let state = {
    target: '8.8.8.8', results: [], pinning: false,
    stats: { sent: 0, received: 0, lossRate: 0, avg: 0, total: 0 },
    history: store.get('ping_history', []),
    continuous: false
  };

  function render() {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">📡 Ping 网络延迟测试</div>
        <div class="input-group">
          <label class="input-label">目标地址</label>
          <div class="input-row">
            <input class="input-field" id="inputTarget" value="${state.target}" placeholder="IP或域名，如 8.8.8.8" autocomplete="off">
            <span class="status-dot" id="statusDot" style="width:12px;height:12px;border-radius:50%;background:${state.pinning?'#faad14':'#ccc'};flex-shrink:0;${state.pinning?'animation:ping-blink 1s infinite':''}"></span>
          </div>
        </div>
        <div class="preset-list">
          ${COMMON_TARGETS.map(t =>
            `<button class="preset-item ${state.target===t?'active':''}" data-target="${t}">${t}</button>`
          ).join('')}
        </div>
        <div class="preset-list" style="margin-top:4px;">
          <button class="preset-item batch" data-batch="dns">🌐 DNS对比</button>
          <button class="preset-item batch" data-batch="web">🌍 网站对比</button>
        </div>
        <div style="display:flex;gap:12px;margin:12px 0;">
          <div style="flex:1;display:flex;align-items:center;font-size:14px;color:var(--text-secondary);">
            <span>次数: </span>
            <select id="countSelect" style="border:none;background:transparent;color:var(--primary);font-weight:600;font-size:14px;" ${state.pinning?'disabled':''}>
              ${[4,8,16,32,64].map(n => `<option value="${n}" ${n===4?'selected':''}>${n}</option>`).join('')}
            </select>
          </div>
          <div style="flex:1;display:flex;align-items:center;font-size:14px;color:var(--text-secondary);">
            <span>超时: </span>
            <select id="timeoutSelect" style="border:none;background:transparent;color:var(--primary);font-weight:600;font-size:14px;" ${state.pinning?'disabled':''}>
              ${[1,2,3,5].map(n => `<option value="${n}" ${n===1?'selected':''}>${n}s</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <label style="display:flex;align-items:center;gap:4px;font-size:14px;color:var(--text-secondary);cursor:pointer;">
            <input type="checkbox" id="continuousToggle" ${state.continuous?'checked':''} style="accent-color:var(--primary);">
            连续Ping
          </label>
        </div>
        <div class="btn-row">
          <button class="btn btn-block ${state.pinning?'btn-danger':'btn-primary'}" id="btnPing">
            ${state.pinning ? '⏹ 暂停' : state.continuous ? '▶ 开始连续Ping' : '▶ 开始Ping'}
          </button>
          <button class="btn btn-small btn-outline" id="clearBtn">清空</button>
        </div>
        ${state.stats.total > 0 ? `
        <div class="stats-grid">
          <div class="stat-item"><span class="stat-label">已发送</span><span class="stat-value">${state.stats.sent}</span></div>
          <div class="stat-item"><span class="stat-label">已接收</span><span class="stat-value success">${state.stats.received}</span></div>
          <div class="stat-item"><span class="stat-label">丢失率</span><span class="stat-value ${state.stats.lossRate>20?'danger':'success'}">${state.stats.lossRate}%</span></div>
          <div class="stat-item"><span class="stat-label">平均延迟</span><span class="stat-value">${state.stats.avg}ms</span></div>
        </div>` : ''}
        <div class="result-list" id="resultList">
          ${state.results.map(r => `
            <div class="ping-item ${r.success?'success':'fail'}">
              <span class="ping-seq">#${r.seq}</span>
              <span class="ping-time">${r.time||''}</span>
              <div class="ping-addr">
                <span class="ping-target">${r.address}</span>
              </div>
              <span class="ping-delay ${r.success?'':'timeout'}">${r.success ? r.delay+'ms' : '✕'}</span>
            </div>
          `).join('')}
          ${state.results.length===0 && !state.pinning ? '<div class="empty-state">输入地址，点击开始Ping</div>' : ''}
          ${state.pinning ? '<div class="empty-state" style="color:#faad14;">⏳ 探测中...</div>' : ''}
          ${!state.pinning && state.results.length > 0 ? '<div class="empty-state" style="color:#52c41a;">✅ 已暂停</div>' : ''}
        </div>
      </div>
      ${state.history.length > 0 ? `
      <div class="card">
        <div class="card-title">📋 测试记录</div>
        <div class="history-list">
          ${state.history.map(h => `
            <div class="history-item">
              <div class="history-top">
                <span class="history-speed" style="min-width:80px;">${h.target}</span>
              </div>
              <div class="history-meta"><span>延迟 ${h.avg}ms</span><span>丢失 ${h.lossRate}%</span></div>
              <div class="history-time">${h.time}</div>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-small btn-outline" id="clearHistoryBtn">清除历史</button>
      </div>` : ''}
      <style>
        @keyframes ping-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
      </style>
    `;

    const inputTarget = util.$('inputTarget');
    if (inputTarget) {
      inputTarget.addEventListener('change', (e) => { if(!state.pinning) state.target = e.target.value.trim(); });
      inputTarget.addEventListener('input', (e) => { if(!state.pinning) state.target = e.target.value.trim(); });
    }

    util.$('btnPing').onclick = togglePing;
    util.$('clearBtn').onclick = () => { state.results = []; state.stats = {sent:0,received:0,lossRate:0,avg:0,total:0}; render(); };
    const ch = document.getElementById('clearHistoryBtn');
    if (ch) ch.onclick = clearHistory;
    const ct = document.getElementById('continuousToggle');
    if (ct) ct.onchange = (e) => {
      state.continuous = e.target.checked;
      // 如果在 Ping 中取消连续 → 立即暂停
      if (!state.continuous && state.pinning) {
        stopPing();
      }
      render();
    };

    container.querySelectorAll('[data-target]').forEach(el => {
      el.onclick = () => { if(!state.pinning) { state.target = el.dataset.target; render(); } };
    });
    container.querySelectorAll('[data-batch]').forEach(el => {
      el.onclick = () => {
        if (state.pinning) return;
        const targets = el.dataset.batch === 'dns'
          ? ['8.8.8.8','114.114.114.114','223.5.5.5','1.1.1.1','119.29.29.29']
          : ['baidu.com','qq.com','taobao.com','jd.com','bilibili.com'];
        state.results = []; state.stats = {sent:0,received:0,lossRate:0,avg:0,total:0};
        state.pinning = true; render();
        runBatchPing(targets);
      };
    });
  }

  // ===== 异步原生 ICMP Ping（不阻塞 UI） =====
  function nativePingAsync(host, timeoutSec) {
    return new Promise((resolve) => {
      // 注册一次性回调
      const id = Date.now() + Math.random();
      window._pingCallback = (delay) => {
        if (delay >= 0) {
          resolve({ success: true, delay: parseFloat(delay) || 0 });
        } else {
          resolve({ success: false, delay: timeoutSec * 1000 });
        }
      };
      try {
        NativePing.asyncPing(host, timeoutSec);
      } catch(e) {
        // 原生不可用 → HTTP 回退
        fallbackHttpPing(host, timeoutSec * 1000).then(resolve);
      }
    });
  }

  // ===== HTTP 回退 =====
  function fallbackHttpPing(host, timeoutMs) {
    return new Promise((resolve) => {
      const start = Date.now();
      const isDomain = /[a-zA-Z]/.test(host) && host.includes('.');
      const url = isDomain ? `https://${host}` : `http://${host}`;
      const controller = new AbortController();
      const timer = setTimeout(() => { controller.abort(); resolve({ success: false, delay: timeoutMs }); }, timeoutMs);
      fetch(url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal, cache: 'no-store' })
        .then(() => { clearTimeout(timer); resolve({ success: true, delay: Date.now() - start }); })
        .catch(() => { clearTimeout(timer); resolve({ success: false, delay: timeoutMs }); });
    });
  }

  function stopPing() {
    try { NativePing.cancelPing(); } catch(e) {}
    state.pinning = false;
    render();
  }

  async function startPing() {
    const maxCount = state.continuous ? 999999 : parseInt(util.$('countSelect')?.value || 4);
    const timeoutSec = parseInt(util.$('timeoutSelect')?.value || 1);
    const target = state.target.trim();
    if (!target) { state.pinning = false; render(); return; }

    // 让 UI 先渲染"⏳ 探测中..."，再开始循环
    await new Promise(r => setTimeout(r, 50));

    for (let i = 0; i < maxCount && state.pinning; i++) {
      const seq = state.results.length + 1;
      const result = await nativePingAsync(target, timeoutSec);
      if (!state.pinning) break;

      state.results.push({
        id: seq, seq, address: target,
        time: util.formatTime(),
        success: result.success, delay: result.delay
      });
      state.stats = calcStats(state.results);
      renderResults();
    }

    state.pinning = false;
    render();
    // 仅在非连续模式或已完成时保存
    if (!state.continuous && state.stats.total > 0) {
      saveHistory(target);
    }
  }

  function togglePing() {
    if (state.pinning) {
      stopPing();
    } else {
      state.results = [];
      state.stats = {sent:0,received:0,lossRate:0,avg:0,total:0};
      state.pinning = true;
      render();
      startPing();
    }
  }

  function saveHistory(target) {
    state.history.unshift({
      id: Date.now(), target,
      avg: state.stats.avg, lossRate: state.stats.lossRate,
      count: state.stats.total, time: util.formatTime()
    });
    if (state.history.length > 30) state.history.length = 30;
    store.set('ping_history', state.history);
  }

  function renderResults() {
    const list = util.$('resultList');
    if (!list) return;
    list.innerHTML = state.results.map(r => 
      `<div class="ping-item ${r.success?'success':'fail'}">
        <span class="ping-seq">#${r.seq}</span>
        <span class="ping-time">${r.time||''}</span>
        <div class="ping-addr"><span class="ping-target">${r.address}</span></div>
        <span class="ping-delay ${r.success?'':'timeout'}">${r.success ? r.delay+'ms' : '✕'}</span>
      </div>`
    ).join('');
    list.scrollTop = list.scrollHeight;

    const s = state.stats;
    const statsEl = container.querySelector('.stats-grid');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="stat-item"><span class="stat-label">已发送</span><span class="stat-value">${s.sent}</span></div>
        <div class="stat-item"><span class="stat-label">已接收</span><span class="stat-value success">${s.received}</span></div>
        <div class="stat-item"><span class="stat-label">丢失率</span><span class="stat-value ${s.lossRate>20?'danger':'success'}">${s.lossRate}%</span></div>
        <div class="stat-item"><span class="stat-label">平均延迟</span><span class="stat-value">${s.avg}ms</span></div>`;
    }
  }

  function calcStats(results) {
    const ok = results.filter(r => r.success);
    const sent = results.length;
    return {
      sent, received: ok.length,
      lossRate: sent > 0 ? Math.round((sent-ok.length)/sent*100) : 0,
      avg: ok.length > 0 ? Math.round(ok.reduce((a,b)=>a+b.delay,0)/ok.length) : 0,
      total: sent
    };
  }

  async function runBatchPing(targets) {
    state.pinning = true;
    for (const t of targets) {
      if (!state.pinning) break;
      const seq = state.results.length + 1;
      const result = await nativePingAsync(t, 3);
      if (!state.pinning) break;
      state.results.push({ id: seq, seq, address: t, time: util.formatTime(), success: result.success, delay: result.delay });
      state.stats = calcStats(state.results);
      renderResults();
    }
    state.pinning = false; render();
    showToast('批量对比完成');
  }

  async function clearHistory() {
    if (await showConfirm('确认清除','确定清除所有Ping记录吗？')) {
      state.history = []; store.set('ping_history', []); render();
    }
  }

  render();
});
