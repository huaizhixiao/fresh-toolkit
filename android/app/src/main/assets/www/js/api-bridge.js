// ========== Toast 系统 ==========
function showToast(msg, duration) {
  const el = util.$('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), duration || 2000);
}

// ========== Dialog ==========
function showConfirm(title, content) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-title">${title}</div>
        <p style="font-size:14px;color:#666;text-align:center;margin:12px 0;">${content}</p>
        <div class="modal-buttons">
          <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove(); resolve(false)">取消</button>
          <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove(); resolve(true)">确定</button>
        </div>
      </div>`;
    // 临时挂载 resolve
    overlay.querySelector('.btn-outline').onclick = () => { overlay.remove(); resolve(false); };
    overlay.querySelector('.btn-primary').onclick = () => { overlay.remove(); resolve(true); };
    document.body.appendChild(overlay);
  });
}

// ========== 选择图片 ==========
function chooseImage(count = 1) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = count > 1;
    input.onchange = () => {
      const files = Array.from(input.files);
      Promise.all(files.map(f => {
        return new Promise(r => {
          const reader = new FileReader();
          reader.onload = (e) => r(e.target.result);
          reader.readAsDataURL(f);
        });
      })).then(resolve);
    };
    input.click();
  });
}

// ========== 复制到剪贴板 ==========
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast('已复制'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showToast('已复制');
  }
}

// ========== 网络信息 ==========
function getNetworkInfo() {
  return new Promise((resolve) => {
    const info = { type: 'unknown', typeName: '未知', signalText: '-', rssi: 0 };
    if (navigator.connection) {
      const c = navigator.connection;
      const typeMap = { 'wifi': 'WiFi', 'cellular': '蜂窝网络', 'ethernet': '以太网', 'bluetooth': '蓝牙', 'other': '其他' };
      
      // type 可能返回 'unknown'，用 effectiveType 辅助判断
      let rawType = c.type;
      if (rawType === 'unknown' || !rawType) {
        // effectiveType 是 '4g'/'3g'/'2g'/'slow-2g' 时说明是蜂窝
        if (c.effectiveType && c.effectiveType !== '4g') {
          rawType = 'cellular';
        } else {
          rawType = 'wifi'; // 除低速蜂窝外，默认当 WiFi
        }
      }
      info.type = rawType;
      info.typeName = typeMap[rawType] || rawType || '未知';

      // 在 Android WebView 中监听连接变化
      if (c.addEventListener) {
        c.addEventListener('change', () => {
          // 连接变化时自动更新，下次调用 getNetworkInfo 会取新值
        });
      }
      
      // 信号强度：根据下行速率和RTT综合判断
      if (c.downlink !== undefined && c.downlink !== null) {
        info.rssi = c.downlink;
        if (c.downlink >= 50) info.signalText = '极强';
        else if (c.downlink >= 10) info.signalText = '强';
        else if (c.downlink >= 5) info.signalText = '中';
        else if (c.downlink >= 2) info.signalText = '弱';
        else if (c.downlink > 0) info.signalText = '极弱';
        else info.signalText = '-';
      }
    }
    resolve(info);
  });
}

// ========== 隐藏TabBar页面 ==========
function hideTabbar() { util.addClass(document.querySelector('.app-tabbar'), 'hidden'); }
function showTabbar() { util.removeClass(document.querySelector('.app-tabbar'), 'hidden'); }
// 添加隐藏样式
const _style = document.createElement('style');
_style.textContent = '.app-tabbar.hidden { display: none; } .app-content.with-tabbar { padding-bottom: 0; }';
document.head.appendChild(_style);