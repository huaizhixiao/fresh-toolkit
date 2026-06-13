// ========== 应用主入口 ==========
(function initApp() {
  // 注册主页面
  router.go('home');
  console.log('小宝工具箱 v2.0 Android 版已启动');

  // 设置状态栏颜色
  const metaTheme = document.createElement('meta');
  metaTheme.name = 'theme-color';
  metaTheme.content = '#1a1a2e';
  document.head.appendChild(metaTheme);

  // 检测屏幕方向锁定
  if (screen.orientation && screen.orientation.lock) {
    // 指南针页需要竖屏，其他横竖都可以
  }
})();