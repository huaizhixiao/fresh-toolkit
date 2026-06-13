// ========== 时间戳转换 ==========
router.register('timestamp', (container) => {
  let state = { mode: 'ts2date', ts: '', tsUnit: 0, result: null, dateStr: '', timeStr: '', msStr: '' };
  let timer = null;

  function render() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    container.innerHTML = `
      <div class="card">
        <div class="card-title">⏰ 时间戳转换</div>
        <div class="mode-tabs">
          <div class="mode-tab ${state.mode==='ts2date'?'active':''}" id="tabTs2Date">时间戳 → 日期</div>
          <div class="mode-tab ${state.mode==='date2ts'?'active':''}" id="tabDate2Ts">日期 → 时间戳</div>
        </div>
        ${state.mode === 'ts2date' ? `
        <div class="input-group">
          <label class="input-label">时间戳</label>
          <div class="input-row">
            <input class="input-field" id="tsInput" value="${state.ts}" type="number" placeholder="输入时间戳">
            <select id="tsUnit" style="width:80px;height:44px;border:1px solid #ddd;border-radius:10px;padding:0 8px;font-size:13px;">
              <option value="0" ${state.tsUnit===0?'selected':''}>秒</option>
              <option value="1" ${state.tsUnit===1?'selected':''}>毫秒</option>
            </select>
          </div>
        </div>
        <div class="quick-row">
          <div class="quick-item" id="quickNow"><span class="quick-label">当前时间</span><span class="quick-value">${Math.floor(now.getTime()/1000)}</span></div>
          <div class="quick-item" id="quickToday"><span class="quick-label">今日零点</span><span class="quick-value">${Math.floor(today.getTime()/1000)}</span></div>
        </div>` : `
        <div class="input-group"><label class="input-label">日期</label><input class="input-field" id="dateInput" type="date" value="${state.dateStr||now.toISOString().split('T')[0]}"></div>
        <div class="input-group"><label class="input-label">时间（时:分:秒）</label><input class="input-field" id="timeInput" type="time" step="1" value="${state.timeStr||now.toTimeString().split(' ')[0]}"></div>
        <div class="input-group"><label class="input-label">毫秒（可选）</label><input class="input-field" id="msInput" type="number" min="0" max="999" value="${state.msStr||'0'}" placeholder="0-999"></div>`}
        <button class="btn btn-block btn-primary" id="btnConvert">转换</button>
        ${state.result ? `
        <div style="margin-top:16px;padding:16px;background:#f7f8fc;border-radius:10px;">
          <div class="result-row"><span class="detail-label">${state.result.label1}</span><span style="flex:1;font-size:14px;font-weight:600;color:var(--text);word-break:break-all;">${state.result.value1}</span><button class="copy-btn" onclick="copyText('${state.result.value1}')">复制</button></div>
          <div class="result-divider"></div>
          <div class="result-row"><span class="detail-label">${state.result.label2}</span><span style="flex:1;font-size:14px;font-weight:600;color:var(--text);word-break:break-all;">${state.result.value2}</span><button class="copy-btn" onclick="copyText('${state.result.value2}')">复制</button></div>
        </div>` : ''}
      </div>
      <div class="card">
        <div class="card-title">🌍 当前时间信息</div>
        <div class="time-info-grid">
          <div class="time-info-item"><span class="time-info-label">当前时间</span><span class="time-info-value" id="curTime">${util.formatTime(now)}</span></div>
          <div class="time-info-item"><span class="time-info-label">Unix(秒)</span><span class="time-info-value" id="curTs">${Math.floor(now.getTime()/1000)}</span></div>
          <div class="time-info-item"><span class="time-info-label">Unix(毫秒)</span><span class="time-info-value" id="curMs">${now.getTime()}</span></div>
          <div class="time-info-item"><span class="time-info-label">时区</span><span class="time-info-value">UTC+${-now.getTimezoneOffset()/60}</span></div>
          <div class="time-info-item"><span class="time-info-label">ISO 8601</span><span class="time-info-value" style="font-size:12px;" id="curIso">${now.toISOString()}</span></div>
        </div>
      </div>`;

    // === 事件绑定 ===
    util.$('btnConvert').onclick = doConvert;
    util.$('tabTs2Date').onclick = () => { state.mode = 'ts2date'; render(); };
    util.$('tabDate2Ts').onclick = () => { state.mode = 'date2ts'; render(); };

    const tsInput = util.$('tsInput');
    if (tsInput) tsInput.oninput = (e) => { state.ts = e.target.value; };
    // 保存 date2ts 模式的输入状态
    const dateInput = util.$('dateInput');
    if (dateInput) dateInput.onchange = (e) => { state.dateStr = e.target.value; };
    const timeInput = util.$('timeInput');
    if (timeInput) timeInput.onchange = (e) => { state.timeStr = e.target.value; };
    const msInput = util.$('msInput');
    if (msInput) msInput.oninput = (e) => { state.msStr = e.target.value; };

    const quickNow = util.$('quickNow');
    if (quickNow) quickNow.onclick = () => {
      const s = Math.floor(Date.now() / 1000);
      state.ts = String(s);
      // 同步输入框
      const inp = util.$('tsInput');
      if (inp) inp.value = String(s);
      render();
    };
    const quickToday = util.$('quickToday');
    if (quickToday) quickToday.onclick = () => {
      const d = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
      const s = Math.floor(d.getTime() / 1000);
      state.ts = String(s);
      const inp = util.$('tsInput');
      if (inp) inp.value = String(s);
      render();
    };

    // === 每分钟更新时间信息 ===
    startTimer();
  }

  function doConvert() {
    if (state.mode === 'ts2date') {
      let ts = parseInt(state.ts || util.$('tsInput')?.value);
      if (isNaN(ts)) { showToast('请输入有效时间戳'); return; }
      state.tsUnit = parseInt(util.$('tsUnit')?.value || 0);
      if (state.tsUnit === 0 && ts < 1e12) ts *= 1000;
      const d = new Date(ts);
      if (isNaN(d.getTime())) { showToast('无效时间戳'); return; }
      state.result = {
        label1: 'GMT+8 日期时间',
        value1: util.formatTime(d),
        label2: 'UTC 日期时间',
        value2: d.toUTCString()
      };
    } else {
      const dateStr = util.$('dateInput')?.value;
      const timeStr = util.$('timeInput')?.value || '00:00:00';
      const msStr = util.$('msInput')?.value || '0';
      if (!dateStr) { showToast('请选择日期'); return; }
      const ms = parseInt(msStr) || 0;
      const d = new Date(`${dateStr} ${timeStr}`);
      if (isNaN(d.getTime())) { showToast('无效日期时间'); return; }
      d.setMilliseconds(Math.max(0, Math.min(999, ms)));
      state.dateStr = dateStr;
      state.timeStr = timeStr;
      state.msStr = msStr;
      state.result = {
        label1: 'Unix (秒)',
        value1: String(Math.floor(d.getTime() / 1000)),
        label2: 'Unix (毫秒)',
        value2: String(d.getTime())
      };
    }
    render();
  }

  function startTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      // 只更新时间信息区块，不重新渲染整个页面
      const now = new Date();
      const el = util.$('curTime');
      if (el) el.textContent = util.formatTime(now);
      const el2 = util.$('curTs');
      if (el2) el2.textContent = Math.floor(now.getTime() / 1000);
      const el3 = util.$('curMs');
      if (el3) el3.textContent = now.getTime();
      const el4 = util.$('curIso');
      if (el4) el4.textContent = now.toISOString();
    }, 60000); // 每分钟更新
  }

  render();
});
