// ========== 首页 ==========
router.register('home', (container) => {
  container.innerHTML = `
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:24px 20px 16px;text-align:center;color:#fff;">
      <div style="font-size:40px;margin-bottom:4px;">🔧</div>
      <p style="font-size:14px;opacity:0.7;margin:0;">一站式实用工具集合</p>
      <div style="margin-top:8px;">
        <span style="font-size:12px;opacity:0.4;cursor:pointer;" onclick="router.push('about')">📋 关于 · 打赏 · 检查更新</span>
      </div>
    </div>
    <div style="margin:16px;">
      <h3 style="font-size:16px;font-weight:600;margin-bottom:10px;padding-left:4px;">🛠 全部工具</h3>
      <div class="tool-grid">
        ${[
          ['bit', '🔬', '线性-gradient(135deg,#a8e063,#56ab2f)', 'Bit位分析'],
          ['ping', '📡', '线性-gradient(135deg,#4facfe,#00f2fe)', 'Ping'],
          ['mqtt', '📨', '线性-gradient(135deg,#43e97b,#38f9d7)', 'MQTT'],
          ['scan', '🌐', '线性-gradient(135deg,#1a1a2e,#16213e)', '局域网扫描'],
          ['timestamp', '⏰', '线性-gradient(135deg,#a18cd1,#fbc2eb)', '时间戳'],
          ['video', '🎬', '线性-gradient(135deg,#fccb90,#d57eeb)', '录像计算'],
          ['speedtest', '🚀', '线性-gradient(135deg,#667eea,#764ba2)', '测速'],
          ['traceroute', '🗺️', '线性-gradient(135deg,#fa709a,#fee140)', '路由追踪'],
          ['qrcode', '📱', '线性-gradient(135deg,#5ee7df,#b490ca)', '二维码'],
          ['ocr', '📷', '线性-gradient(135deg,#c471f5,#fa71cd)', '图片转文字'],
          ['compass', '🧭', '线性-gradient(135deg,#ffecd2,#fcb69f)', '指南针']
        ].map(([page, icon, grad, name]) =>
          `<div class="tool-item" onclick="router.push('${page}')">
            <div class="tool-icon" style="background:${grad}">${icon}</div>
            <span class="tool-name">${name}</span>
          </div>`
        ).join('')}
      </div>
    </div>
    <div style="text-align:center;padding:20px;color:#ccc;font-size:12px;">
      小宝工具箱 v1.0.4 · Android版<br>
      <span style="cursor:pointer;color:#07c160;font-size:12px;" onclick="router.push('about')">📋 关于 & 打赏</span>
    </div>
  `;
});

// ========== 更多工具 & 关于 ==========
router.register('more', (container) => {
  container.innerHTML = `
    <div style="padding:16px;">
      <h3 style="font-size:16px;font-weight:600;margin-bottom:10px;">📦 更多工具</h3>
      <div class="tool-grid">
        ${[
          ['bit', '🔬', '线性-gradient(135deg,#a8e063,#56ab2f)', 'Bit位分析'],
          ['ping', '📡', '线性-gradient(135deg,#4facfe,#00f2fe)', 'Ping'],
          ['mqtt', '📨', '线性-gradient(135deg,#43e97b,#38f9d7)', 'MQTT'],
          ['scan', '🌐', '线性-gradient(135deg,#1a1a2e,#16213e)', '局域网扫描'],
          ['timestamp', '⏰', '线性-gradient(135deg,#a18cd1,#fbc2eb)', '时间戳'],
          ['video', '🎬', '线性-gradient(135deg,#fccb90,#d57eeb)', '录像计算'],
          ['speedtest', '🚀', '线性-gradient(135deg,#667eea,#764ba2)', '测速'],
          ['traceroute', '🗺️', '线性-gradient(135deg,#fa709a,#fee140)', '路由追踪'],
          ['qrcode', '📱', '线性-gradient(135deg,#5ee7df,#b490ca)', '二维码'],
          ['ocr', '📷', '线性-gradient(135deg,#c471f5,#fa71cd)', '图片转文字'],
          ['compass', '🧭', '线性-gradient(135deg,#ffecd2,#fcb69f)', '指南针']
        ].map(([page, icon, grad, name]) =>
          `<div class="tool-item" onclick="router.push('${page}')">
            <div class="tool-icon" style="background:${grad}">${icon}</div>
            <span class="tool-name">${name}</span>
          </div>`
        ).join('')}
      </div>

      <!-- 关于 & 打赏（醒目大按钮） -->
      <div style="margin-top:20px;margin-bottom:12px;">
        <div class="card" style="padding:16px;cursor:pointer;" onclick="router.push('about')">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:44px;height:44px;border-radius:12px;background:线性-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">📋</div>
            <div style="flex:1;">
              <div style="font-size:15px;font-weight:600;color:var(--text);">关于 & 打赏</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">版本信息 · 检查更新 · 支持作者</div>
            </div>
            <div style="font-size:20px;color:#ccc;">›</div>
          </div>
        </div>
      </div>

      <div style="text-align:center;padding:16px;color:#ccc;font-size:12px;">
        小宝工具箱 v1.0.4 · Android版
      </div>
    </div>
  `;
});