// ========== 路由追踪（原生 ICMP TTL 方案） ==========
router.register('traceroute', (container) => {
  let state = { target: '8.8.8.8', tracing: false, hops: [] };

  function render() {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">🗺️ 路由追踪</div>
        <div class="input-group">
          <label class="input-label">目标地址</label>
          <div class="input-row">
            <input class="input-field" id="trTarget" value="${state.target}" placeholder="IP或域名">
            <button class="btn ${state.tracing?'btn-danger':'btn-primary'}" id="btnTrace">${state.tracing?'停止':'追踪'}</button>
          </div>
        </div>
        <div class="preset-list">
          ${['8.8.8.8','114.114.114.114','223.5.5.5','baidu.com','github.com'].map(t =>
            `<button class="preset-item ${state.target===t?'active':''}" onclick="window._trPick('${t}')">${t}</button>`
          ).join('')}
        </div>
        ${state.hops.length > 0 ? `<div style="padding:8px 12px;background:#f7f8fc;border-radius:8px;margin:8px 0;font-size:13px;color:var(--text-secondary);">总跳数: ${state.hops.length}</div>` : ''}
        <div style="max-height:500px;overflow-y:auto;margin-top:8px;">
          ${state.hops.map(h => `
            <div style="display:flex;align-items:center;padding:10px;margin:3px 0;background:${h.target?'#f6ffed':'#fafafa'};border-radius:8px;gap:10px;">
              <span style="width:32px;height:32px;border-radius:50%;background:${h.target?'var(--primary)':h.timeout?'#ff4d4f':'#1890ff'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;">${h.hop}</span>
              <div style="flex:1;min-width:0;">
                <span style="display:block;font-size:14px;color:var(--text);font-family:monospace;">${h.ip}</span>
                ${h.address ? `<span style="display:block;font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${h.address}</span>` : ''}
              </div>
              <span style="font-size:13px;font-weight:600;color:${h.target?'var(--primary)':h.timeout?'#ff4d4f':'#1890ff'};flex-shrink:0;">${h.timeout?'*':h.delay+'ms'}</span>
              ${h.target ? '<span style="font-size:11px;color:var(--primary);">🎯 目标</span>' : ''}
            </div>
          `).join('')}
          ${state.tracing ? '<div class="empty-state" style="color:#faad14;">⏳ 探测中...</div>' : ''}
          ${!state.tracing && state.hops.length===0 ? '<div class="empty-state">输入地址，点击追踪</div>' : ''}
        </div>
        <div class="tips" style="margin-top:12px;">通过逐跳 ICMP TTL 探测真实路由路径，每跳发送一个 ping 包</div>
      </div>`;
    util.$('btnTrace').onclick = toggleTrace;
    util.$('trTarget').oninput = (e) => { state.target = e.target.value; };
    window._trPick = (t) => { state.target = t; render(); };
  }

  async function toggleTrace() {
    if (state.tracing) {
      state.tracing = false;
      try { NativeTraceroute.stopTrace(); } catch(e) {}
      render();
      return;
    }
    state.hops = [];
    state.tracing = true;
    render();

    try {
      NativeTraceroute.startTrace(state.target.trim(), 30, 2);
    } catch(e) {
      showToast('原生追踪不可用: ' + e.message);
      state.tracing = false;
      render();
    }
  }

  // ===== 原生回调 =====
  window._trCallback = (hop, ip, address, delay, isError, isTarget) => {
    if (!state.tracing) return;
    if (isError) {
      state.hops.push({ hop, ip: '*', address: '', delay: 0, timeout: true, target: false });
    } else {
      state.hops.push({ hop, ip, address, delay, timeout: false, target: isTarget });
    }
    render();
  };

  window._trDone = (error) => {
    state.tracing = false;
    render();
    if (error) showToast('追踪出错: ' + error);
    else if (state.hops.length > 0) showToast('追踪完成，共 ' + state.hops.length + ' 跳');
  };

  render();
});
