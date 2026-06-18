// ========== 简易 SPA 路由 ==========
const router = {
  current: null,
  stack: ['home'],
  pages: {},

  register(name, renderFn) {
    this.pages[name] = renderFn;
  },

  // Tab 页列表（底部导航栏的页面）
  tabPages: ['home', 'bit', 'mqtt', 'more', 'about'],

  go(name) {
    if (name === this.current) return;
    this.current = name;
    this.stack = [name];

    // 高亮Tab
    document.querySelectorAll('.tab-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === name);
    });

    // 更新标题
    const titles = {
      home: '小宝工具箱', ping: 'Ping', mqtt: 'MQTT客户端',
      traceroute: '路由追踪', timestamp: '时间戳转换', video: '录像计算',
      qrcode: '二维码生成', ocr: '图片转文字', compass: '指南针', bit: 'Bit位分析',
      more: '更多工具', about: '关于'
    };
    util.$('pageTitle').textContent = titles[name] || '小宝工具箱';

    // Tab 页不显示返回按钮
    util.$('btnBack').classList.toggle('show', !this.tabPages.includes(name));

    this.render(name);
  },

  back() {
    if (this.stack.length > 1) {
      this.stack.pop();
      this.go(this.stack[this.stack.length - 1]);
    } else {
      this.go('home');
    }
  },

  render(name) {
    const container = util.$('appContent');
    if (this.pages[name]) {
      this.pages[name](container);
    }
  },

  // 内部跳转（非Tab页）
  push(name) {
    this.stack.push(name);
    this.current = name;
    const titles = {
      traceroute: '路由追踪', timestamp: '时间戳转换', video: '录像计算',
      qrcode: '二维码生成', ocr: '图片转文字', compass: '指南针', bit: 'Bit位分析'
    };
    util.$('pageTitle').textContent = titles[name] || name;
    util.$('btnBack').classList.add('show');
    this.render(name);
  }
};

// 点击Tabbar
document.querySelectorAll('.tab-item').forEach(el => {
  el.addEventListener('click', () => router.go(el.dataset.page));
});
