// ========== 指南针 ==========
router.register('compass', (container) => {
  // 从 localStorage 读取校准设置
  const savedInverted = store.get('compass_inverted', false);

  let state = {
    heading: 0,
    displayAngle: 0,
    smoothedHeading: 0,
    support: true,
    errorMsg: '',
    listener: null,
    hasFirstReading: false,
    rafId: null,
    inverted: savedInverted,
    calibrating: true
  };

  function render() {
    let ticks = '';
    for (let i = 0; i < 360; i += 30) {
      const isMajor = i % 90 === 0;
      const isNorth = i === 0;
      let cls = 'compass-tick';
      if (isMajor) cls += ' major';
      if (isNorth) cls += ' major-n';
      ticks += `<div class="${cls}" style="transform:rotate(${i}deg)"></div>`;
    }

    const h = state.hasFirstReading ? state.heading : 0;

    container.innerHTML = `
      <div class="compass-page">
        ${!state.support ? `
        <div class="tips" style="max-width:300px;margin:40px auto;color:#fff;background:rgba(255,255,255,0.05);text-align:center;padding:24px;border-radius:12px;">
          <div style="font-size:40px;margin-bottom:12px;">🧭</div>
          <div style="font-weight:600;margin-bottom:8px;">指南针不可用</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;">
            ${state.errorMsg || '设备不支持方向传感器，或未授予传感器权限。'}<br><br>
            部分设备需手动校准（画8字运动）<br>
            或检查是否授予了「传感器」权限。
          </div>
        </div>` : `
        <!-- 外圈光晕 -->
        <div class="compass-glow" id="compassGlow"></div>

        <!-- 指南针主体 -->
        <div class="compass-frame">
          <div class="compass-outer-ring">
            <div class="compass-inner" id="compassInner" style="transform:rotate(${-state.displayAngle}deg)">
              <div class="compass-circle" id="compassCircle">
                ${ticks}
                <span class="dir-label dir-n">N</span>
                <span class="dir-label dir-s">S</span>
                <span class="dir-label dir-e">E</span>
                <span class="dir-label dir-w">W</span>
                <span class="dir-ne">NE</span>
                <span class="dir-se">SE</span>
                <span class="dir-sw">SW</span>
                <span class="dir-nw">NW</span>
                <div class="compass-needle">
                  <div class="needle-north"></div>
                  <div class="needle-south"></div>
                  <div class="needle-pin"></div>
                </div>
                <div class="compass-center" id="compassCenter">
                  <span class="compass-angle" id="compassAngle">${state.hasFirstReading ? Math.round(h) + '°' : ''}</span>
                </div>
                ${!state.hasFirstReading ? `
                <div class="compass-calibrating" id="compassCalibrating">
                  <div class="spinner"></div>
                  <div style="margin-top:12px;font-size:15px;font-weight:600;">校准中...</div>
                  <div style="font-size:11px;margin-top:6px;color:rgba(255,255,255,0.35);">请水平移动手机画8字</div>
                </div>` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- HUD 信息面板 -->
        <div class="compass-hud">
          <div class="hud-row">
            <div class="hud-item">
              <span class="hud-label">方向</span>
              <span class="hud-value" id="infoDirection">${state.hasFirstReading ? getDirection(h) : '--'}</span>
            </div>
            <div class="hud-item">
              <span class="hud-label">角度</span>
              <span class="hud-value" id="infoAngle">${state.hasFirstReading ? h.toFixed(1) + '°' : '--'}</span>
            </div>
          </div>
          <div class="hud-row">
            <div class="hud-item">
              <span class="hud-label">状态</span>
              <span class="hud-value" id="infoStatus" style="color:${state.hasFirstReading ? '#00e5ff' : '#ff9800'};">${state.hasFirstReading ? '● 在线' : '○ 校准中'}</span>
            </div>
            <div class="hud-item" style="cursor:pointer;" id="btnCalibrate">
              <span class="hud-label">校准</span>
              <span class="hud-value" style="color:#ffd740;font-size:13px;" id="infoCalibrate">${state.inverted ? '已反转 ↻' : '点击校准'}</span>
            </div>
          </div>
        </div>

        <!-- 底部刻度尺 -->
        <div class="compass-ruler" id="compassRuler">
          <div class="ruler-track" id="rulerTrack" style="transform:translateX(${(state.hasFirstReading ? -h/360*100 : 0)}%)"></div>
        </div>`}
      </div>
    `;

    if (state.support && !state.listener) {
      startCompass();
    }

    // 校准按钮
    const calBtn = util.$('btnCalibrate');
    if (calBtn) calBtn.onclick = toggleCalibration;
  }

  function getDirection(heading) {
    const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    const idx = Math.round(heading / 45) % 8;
    return dirs[idx];
  }

  function normalize(v) {
    v = v % 360;
    if (v < 0) v += 360;
    return v;
  }

  // 应用反转
  function applyCalibration(raw) {
    if (state.inverted) {
      return normalize(360 - raw);
    }
    return normalize(raw);
  }

  function toggleCalibration() {
    state.inverted = !state.inverted;
    store.set('compass_inverted', state.inverted);

    // 立即重新计算当前 heading
    if (state.hasFirstReading) {
      // 反转：新heading = normalize(360 - 当前heading)
      const newHeading = normalize(360 - state.heading);
      const oldDisplay = state.displayAngle;
      // displayAngle 也需要相应调整
      const diff = newHeading - state.heading;
      state.displayAngle += diff;
      state.smoothedHeading = newHeading;
      state.heading = newHeading;
      updateDisplay(state.heading);
    }

    // 更新校准按钮文字
    const infoEl = util.$('infoCalibrate');
    if (infoEl) infoEl.textContent = state.inverted ? '已反转 ↻' : '已校准 ✓';
    showToast(state.inverted ? '方向已反转' : '方向已恢复正常');
  }

  function updateDisplay(heading) {
    const inner = util.$('compassInner');
    if (inner) inner.style.transform = `rotate(${-state.displayAngle}deg)`;

    const angleEl = util.$('compassAngle');
    if (angleEl) angleEl.textContent = Math.round(heading) + '°';

    const dirEl = util.$('infoDirection');
    if (dirEl) dirEl.textContent = getDirection(heading);

    const angInfo = util.$('infoAngle');
    if (angInfo) angInfo.textContent = heading.toFixed(1) + '°';

    // 底部刻度尺
    const ruler = util.$('rulerTrack');
    if (ruler) ruler.style.transform = `translateX(${-heading/360*100}%)`;
  }

  function startCompass() {
    if (!window.DeviceOrientationEvent) {
      state.support = false;
      state.errorMsg = '浏览器不支持 DeviceOrientation API';
      render();
      return;
    }

    state.smoothedHeading = null;
    state.displayAngle = 0;

    state.listener = (e) => {
      let raw = null;

      if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
        raw = e.webkitCompassHeading;
      } else if (e.absolute === true && e.alpha !== null) {
        raw = e.alpha;
      } else if (e.alpha !== null) {
        raw = e.alpha;
      }

      if (raw === null) return;

      // 应用反转校准
      const calibrated = applyCalibration(raw);

      // 第一次读数
      if (!state.hasFirstReading) {
        state.hasFirstReading = true;
        state.smoothedHeading = calibrated;
        state.displayAngle = calibrated;
        state.heading = calibrated;

        const calEl = util.$('compassCalibrating');
        if (calEl) calEl.remove();

        const statusEl = util.$('infoStatus');
        if (statusEl) { statusEl.textContent = '● 在线'; statusEl.style.color = '#00e5ff'; }

        const angleEl = util.$('compassAngle');
        if (angleEl && !angleEl.textContent) angleEl.textContent = Math.round(calibrated) + '°';

        updateDisplay(calibrated);
        return;
      }

      // 平滑处理
      let diff = calibrated - state.smoothedHeading;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      state.smoothedHeading += diff * 0.2;
      state.smoothedHeading = normalize(state.smoothedHeading);

      // 累计角度不绕圈
      state.displayAngle += diff * 0.2;

      state.heading = state.smoothedHeading;

      if (!state.rafId) {
        state.rafId = requestAnimationFrame(() => {
          state.rafId = null;
          updateDisplay(state.heading);
        });
      }
    };

    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(perm => {
          if (perm === 'granted') {
            window.addEventListener('deviceorientation', state.listener);
          } else {
            state.support = false;
            state.errorMsg = '传感器权限被拒绝';
            render();
          }
        })
        .catch(() => {
          window.addEventListener('deviceorientationabsolute', state.listener);
          window.addEventListener('deviceorientation', state.listener);
        });
    } else {
      window.addEventListener('deviceorientationabsolute', state.listener);
      window.addEventListener('deviceorientation', state.listener);
    }
  }

  function stopCompass() {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    if (state.listener) {
      window.removeEventListener('deviceorientation', state.listener);
      window.removeEventListener('deviceorientationabsolute', state.listener);
      state.listener = null;
    }
  }

  const observer = new MutationObserver(() => {
    if (!document.getElementById('compassInner') && state.listener) {
      stopCompass();
    }
  });
  observer.observe(container, { childList: true, subtree: true });

  render();
});
