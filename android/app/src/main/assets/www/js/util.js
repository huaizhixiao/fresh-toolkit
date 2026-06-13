// ========== 通用工具函数 ==========
const util = {
  formatTime(d) {
    d = d || new Date();
    const pad = n => n < 10 ? '0' + n : '' + n;
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  },
  genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6); },
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  formatBitrate(bps) {
    if (bps === 0) return '0 bps';
    const k = 1000, sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
    const i = Math.floor(Math.log(bps) / Math.log(k));
    return parseFloat((bps / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  formatDuration(ms) {
    let s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    s = s % 60;
    return `${h ? pad(h)+':' : ''}${pad(m)}:${pad(s)}`;
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
  },
  $(id) { return document.getElementById(id); },
  qs(sel, ctx) { return (ctx || document).querySelector(sel); },
  qsa(sel, ctx) { return (ctx || document).querySelectorAll(sel); },
  html(el, str) { if (el) el.innerHTML = str; },
  show(el) { if (el) el.style.display = ''; },
  hide(el) { if (el) el.style.display = 'none'; },
  addClass(el, cls) { if (el) el.classList.add(cls); },
  removeClass(el, cls) { if (el) el.classList.remove(cls); },
  toggleClass(el, cls) { if (el) el.classList.toggle(cls); }
};

// localStorage 包装
const store = {
  get(key, def) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch(e) { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
  },
  remove(key) { localStorage.removeItem(key); }
};