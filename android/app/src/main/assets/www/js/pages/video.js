// ========== 录像大小计算 ==========
router.register('video', (container) => {
  let state = {
    mode: 'calcSize', width: '1920', height: '1080', fps: 30, codec: 'H.264',
    bitrate: '8', hours: '1', minutes: '0', seconds: '0',
    fileSize: '100', sizeUnit: 0, result: null
  };

  const presets = [
    { name: '240p', w:426, h:240 }, { name: '360p', w:640, h:360 }, { name: '480p', w:854, h:480 },
    { name: '720p', w:1280, h:720 }, { name: '1080p', w:1920, h:1080 },
    { name: '2K', w:2560, h:1440 }, { name: '4K', w:3840, h:2160 }, { name: '8K', w:7680, h:4320 }
  ];
  const scenarios = [
    { name:'手机录像', desc:'1080p 30fps H.264', r:'1080p', fps:30, codec:'H.264', br:8 },
    { name:'高清监控', desc:'720p 25fps H.265 24h', r:'720p', fps:25, codec:'H.265/HEVC', br:4 },
    { name:'4K影视', desc:'4K 60fps H.265', r:'4K', fps:60, codec:'H.265/HEVC', br:30 },
    { name:'视频会议', desc:'720p 30fps H.264', r:'720p', fps:30, codec:'H.264', br:2 }
  ];

  // ===== 根据分辨率自动估算推荐比特率 =====
  function estimateBitrate(w, h, fps, codec) {
    const pixels = w * h;
    // 基础码率因子（H.264 @ 30fps 为基准）
    const codecFactor = { 'H.264': 1.0, 'H.265/HEVC': 0.6, 'VP9': 0.7, 'AV1': 0.5 };
    // 每像素约 0.05~0.1 bppf，经验公式
    let br = pixels * 0.07 * (codecFactor[codec] || 1.0) * fps / 1000000;
    // 约束范围
    br = Math.max(0.5, Math.min(br, 200));
    // 取整到常用值
    if (br <= 1) return Math.round(br * 2) / 2;
    if (br <= 10) return Math.round(br);
    if (br <= 50) return Math.round(br / 5) * 5;
    return Math.round(br / 10) * 10;
  }

  function render() {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">🎬 录像大小和时间计算</div>
        <div class="mode-tabs">
          <div class="mode-tab ${state.mode==='calcSize'?'active':''}" id="tabCalcSize">计算大小</div>
          <div class="mode-tab ${state.mode==='calcTime'?'active':''}" id="tabCalcTime">计算时长</div>
        </div>
        <div class="input-group"><label class="input-label">分辨率</label>
          <div class="preset-list" id="presetList">
            ${presets.map((p,i) => `<button class="preset-item ${state.width==String(p.w)?'active':''}" data-preset="${i}">${p.name}</button>`).join('')}
          </div>
          <div class="resolution-row" style="margin-top:8px;">
            <input class="input-field" id="vidWidth" value="${state.width}" type="number" placeholder="宽">
            <span class="resolution-x">×</span>
            <input class="input-field" id="vidHeight" value="${state.height}" type="number" placeholder="高">
          </div>
        </div>
        <div class="input-group"><label class="input-label">帧率 (FPS)</label>
          <select class="input-field" id="vidFps">${[15,24,25,30,48,50,60,90,120].map(f => `<option value="${f}" ${f==state.fps?'selected':''}>${f} FPS</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">编码</label>
          <select class="input-field" id="vidCodec"><option ${state.codec==='H.264'?'selected':''}>H.264</option><option ${state.codec==='H.265/HEVC'?'selected':''}>H.265/HEVC</option><option ${state.codec==='VP9'?'selected':''}>VP9</option><option ${state.codec==='AV1'?'selected':''}>AV1</option></select>
        </div>
        <div class="input-group"><label class="input-label">比特率（可手动修改）</label>
          <div class="input-row">
            <input class="input-field" id="vidBitrate" value="${state.bitrate}" type="number" step="0.5" placeholder="Mbps">
            <span style="flex-shrink:0;font-size:13px;color:var(--text-muted);">Mbps</span>
          </div>
        </div>
        ${state.mode === 'calcSize' ? `
        <div class="input-group"><label class="input-label">录制时长</label>
          <div class="time-input-row">
            <input class="input-field" id="vidHours" value="${state.hours}" type="number" placeholder="0"><span class="time-label">时</span>
            <input class="input-field" id="vidMins" value="${state.minutes}" type="number" placeholder="0"><span class="time-label">分</span>
            <input class="input-field" id="vidSecs" value="${state.seconds}" type="number" placeholder="0"><span class="time-label">秒</span>
          </div>
        </div>` : `
        <div class="input-group"><label class="input-label">文件大小</label>
          <div class="input-row">
            <input class="input-field" id="vidFileSize" value="${state.fileSize}" type="number">
            <select id="vidSizeUnit" style="width:70px;height:44px;border:1px solid #ddd;border-radius:10px;padding:0 8px;font-size:13px;">
              <option value="0" ${state.sizeUnit===0?'selected':''}>MB</option><option value="1" ${state.sizeUnit===1?'selected':''}>GB</option><option value="2" ${state.sizeUnit===2?'selected':''}>TB</option>
            </select>
          </div>
        </div>`}
        <button class="btn btn-block btn-primary" id="btnCalc">计算</button>
        <div class="hint" style="margin-top:8px;background:#f0f5ff;">
          <span class="hint-icon">💡</span>
          <span class="hint-text" style="font-size:12px;">比特率根据分辨率自动估算，你可以根据实际情况手动调整。</span>
        </div>
        ${state.result ? `
        <div class="result-grid" style="margin-top:16px;">
          ${state.result.map(r => `<div class="result-item"><span class="result-label">${r.label}</span><span class="result-value" style="font-size:14px;">${r.value}</span></div>`).join('')}
        </div>` : ''}
      </div>
      <div class="card">
        <div class="card-title">📋 常见场景</div>
        ${scenarios.map((s, i) => `
          <div class="scene-item" data-scenario="${i}">
            <span class="scene-name">${s.name}</span><span class="scene-desc">${s.desc}</span>
          </div>`).join('')}
      </div>`;

    // 事件绑定
    util.$('tabCalcSize').onclick = () => { state.mode = 'calcSize'; state.result = null; render(); };
    util.$('tabCalcTime').onclick = () => { state.mode = 'calcTime'; state.result = null; render(); };
    util.$('btnCalc').onclick = calculate;

    // 分辨率预设 → 自动估算比特率
    container.querySelectorAll('[data-preset]').forEach(el => {
      el.onclick = () => {
        const p = presets[parseInt(el.dataset.preset)];
        if (!p) return;
        state.width = String(p.w);
        state.height = String(p.h);
        state.bitrate = String(estimateBitrate(p.w, p.h, state.fps, state.codec));
        state.result = null;
        render();
      };
    });

    // 分辨率输入 → 自动估算比特率
    const wEl = util.$('vidWidth');
    if (wEl) wEl.oninput = (e) => { state.width = e.target.value; updateBitrate(); };
    const hEl = util.$('vidHeight');
    if (hEl) hEl.oninput = (e) => { state.height = e.target.value; updateBitrate(); };

    const fpsEl = util.$('vidFps');
    if (fpsEl) fpsEl.onchange = (e) => { state.fps = parseInt(e.target.value); updateBitrate(); };
    const codecEl = util.$('vidCodec');
    if (codecEl) codecEl.onchange = (e) => { state.codec = e.target.value; updateBitrate(); };

    const brEl = util.$('vidBitrate');
    if (brEl) brEl.oninput = (e) => { state.bitrate = e.target.value; };

    const hrsEl = util.$('vidHours');
    if (hrsEl) hrsEl.oninput = (e) => { state.hours = e.target.value; };
    const minsEl = util.$('vidMins');
    if (minsEl) minsEl.oninput = (e) => { state.minutes = e.target.value; };
    const secsEl = util.$('vidSecs');
    if (secsEl) secsEl.oninput = (e) => { state.seconds = e.target.value; };

    const fsEl = util.$('vidFileSize');
    if (fsEl) fsEl.oninput = (e) => { state.fileSize = e.target.value; };
    const suEl = util.$('vidSizeUnit');
    if (suEl) suEl.onchange = (e) => { state.sizeUnit = parseInt(e.target.value); };

    container.querySelectorAll('[data-scenario]').forEach(el => {
      el.onclick = () => {
        const s = scenarios[parseInt(el.dataset.scenario)];
        if (!s) return;
        const p = presets.find(pr => pr.name === s.r);
        if (p) { state.width = String(p.w); state.height = String(p.h); }
        state.fps = s.fps; state.codec = s.codec;
        state.bitrate = String(s.br);
        state.result = null;
        render();
      };
    });
  }

  // 根据当前分辨率+编码+FPS重新估算比特率
  function updateBitrate() {
    const w = parseInt(state.width) || 0;
    const h = parseInt(state.height) || 0;
    if (w > 0 && h > 0) {
      state.bitrate = String(estimateBitrate(w, h, state.fps, state.codec));
      // 同步更新比特率输入框
      const brEl = util.$('vidBitrate');
      if (brEl) brEl.value = state.bitrate;
    }
  }

  function calculate() {
    const w = parseInt(state.width) || 1920, h = parseInt(state.height) || 1080;
    const br = parseFloat(state.bitrate) || 8;

    if (state.mode === 'calcSize') {
      const hrs = parseFloat(state.hours)||0, mins = parseFloat(state.minutes)||0, secs = parseFloat(state.seconds)||0;
      const totalSec = hrs*3600 + mins*60 + secs;
      if (totalSec <= 0) { showToast('请输入时长'); return; }
      const mb = (br * 1000000 * totalSec) / 8 / 1024 / 1024;
      state.result = [
        { label: '分辨率', value: `${w}×${h}` }, { label: '编码', value: state.codec },
        { label: '比特率', value: `${br} Mbps` }, { label: '时长', value: `${hrs}时${mins}分${secs}秒` },
        { label: '文件大小', value: mb >= 1024 ? (mb/1024).toFixed(2)+' GB' : mb.toFixed(2)+' MB' },
        { label: '大小(GB)', value: (mb/1024).toFixed(3)+' GB' }
      ];
      render();
    } else {
      const fs = parseFloat(state.fileSize) || 100;
      const unit = state.sizeUnit;
      let bytes = fs;
      if (unit === 0) bytes *= 1024*1024;
      else if (unit === 1) bytes *= 1024*1024*1024;
      else bytes *= 1024*1024*1024*1024;
      if (bytes <= 0) { showToast('请输入文件大小'); return; }
      const totalSec = (bytes * 8) / (br * 1000000);
      const h = Math.floor(totalSec/3600), m = Math.floor((totalSec%3600)/60), s = Math.floor(totalSec%60);
      state.result = [
        { label: '文件大小', value: `${fs} ${['MB','GB','TB'][unit]}` },
        { label: '比特率', value: `${br} Mbps` }, { label: '时长', value: `${h}时${m}分${s}秒` },
        { label: '总秒数', value: Math.floor(totalSec)+'s' }
      ];
      render();
    }
  }

  render();
});
