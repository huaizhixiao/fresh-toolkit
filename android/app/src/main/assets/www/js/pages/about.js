// ========== 关于 & 打赏 & 更新 ==========
// 当前版本号（每次更新时修改）
const APP_VERSION = '1.0.1';
const APP_VERSION_CODE = 2;

// === 🔧 配置更新源（二选一） ===

// 方式一：GitHub Releases（推荐，免费）
// 先确保仓库是公开的，私有仓库GitHub API会拒绝访问
// 格式：'用户名/仓库名'
const GITHUB_REPO = 'huaizhixiao/fresh-toolkit';

// 方式二：版本信息JSON（备用，适合私有仓库或网盘）
// 需要一个可公开访问的JSON文件，内容格式：
// {"version":"1.0.1","versionCode":2,"url":"https://...apk","changelog":"更新内容..."}
// 可以用 GitHub Gist（公开Gist）托管这个JSON
const VERSION_JSON_URL = '';
// ==========================

router.register('about', (container) => {
  let state = { checking: false, updateInfo: null, error: '', setupGuide: false };

  function render() {
    const hasGitHub = GITHUB_REPO && GITHUB_REPO !== '你的用户名/仓库名';
    const hasJson = VERSION_JSON_URL && VERSION_JSON_URL.startsWith('http');

    container.innerHTML = `
      <div style="padding:16px;">

        <!-- 应用信息 -->
        <div class="card" style="text-align:center;padding:20px;">
          <div style="font-size:44px;margin-bottom:6px;">🔧</div>
          <div style="font-size:18px;font-weight:700;color:var(--text);">小宝工具箱</div>
          <div style="font-size:13px;color:var(--text-muted);margin:4px 0;">v${APP_VERSION}</div>
          <div style="font-size:12px;color:var(--text-muted);">一站式实用工具集合</div>
          <div style="margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
            <button class="btn btn-small btn-primary" id="btnCheckUpdate">🔄 检查更新</button>
          </div>
        </div>

        <!-- 更新检查结果 -->
        ${state.checking ? `
        <div class="card" style="text-align:center;padding:16px;">
          <div style="display:inline-block;width:24px;height:24px;border:2px solid #e0e0e0;border-top-color:#07c160;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:8px;"></div>
          <div style="font-size:14px;color:var(--text-muted);">正在检查更新...</div>
        </div>` : ''}

        ${state.updateInfo ? `
        <div class="card" style="padding:16px;">
          <div style="font-size:15px;font-weight:600;margin-bottom:8px;">
            ${state.updateInfo.hasUpdate ? '📥 发现新版本' : '✅ 已是最新版本'}
          </div>
          ${state.updateInfo.hasUpdate ? `
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">
            最新版本：v${state.updateInfo.version}
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">
            当前版本：v${APP_VERSION}
          </div>
          <div style="background:#f0f5ff;border-radius:8px;padding:12px;font-size:13px;line-height:1.6;margin-bottom:12px;white-space:pre-wrap;">${state.updateInfo.changelog || '暂无更新说明'}</div>
          <button class="btn btn-block btn-primary" id="btnDownloadUpdate">⬇️ 下载新版本</button>
          ` : ''}
        </div>` : ''}

        ${state.error ? `
        <div class="card" style="padding:16px;">
          <div style="font-size:13px;color:#e53935;margin-bottom:8px;">❌ ${state.error}</div>
          <div style="font-size:12px;color:var(--text-muted);line-height:1.7;">
            <b>📌 可能的原因：</b><br>
            · 仓库是私有的 → GitHub API 无法访问<br>
            · 网络连接不稳定<br>
            · 仓库名配置错误<br><br>
            <b>✅ 推荐方案：用 GitHub Gist</b><br>
            ① 打开 <span style="color:#07c160;" onclick="window.open('https://gist.github.com','_blank')">gist.github.com</span>（免费）<br>
            ② 新建一个公开 Gist，文件名 version.json<br>
            ③ 粘贴以下内容并保存：<br>
          </div>
          <div style="background:#1a1a2e;color:#00e5ff;border-radius:8px;padding:12px;font-size:11px;font-family:monospace;margin:8px 0;line-height:1.5;word-break:break-all;">
{<br>
  "version": "1.0.1",<br>
  "versionCode": 2,<br>
  "url": "https://你的下载链接.apk",<br>
  "changelog": "更新内容..."<br>
}
          </div>
          <div style="font-size:12px;color:var(--text-muted);line-height:1.7;">
            ④ 点 Raw 按钮获取原始URL<br>
            ⑤ 把URL填到 about.js 的 VERSION_JSON_URL<br>
            ⑥ 重新Build APK即可<br><br>
            <b>或者：把仓库设为公开</b><br>
            GitHub 仓库 Settings → 拉到最下面 Change visibility → Make public
          </div>
        </div>` : ''}

        <!-- 打赏作者 -->
        <div class="card" style="padding:16px;">
          <div style="font-size:15px;font-weight:600;margin-bottom:12px;">☕ 打赏作者</div>
          <div style="text-align:center;">
            <img src="${DONATE_QR_B64}" id="donateQrImg" style="width:160px;height:160px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.1);margin-bottom:8px;cursor:pointer;" onerror="this.style.display='none';document.getElementById('donateFallback').style.display='block'">
            <div id="donateFallback" style="display:none;padding:20px;background:#f7f8fc;border-radius:12px;font-size:13px;color:var(--text-muted);">
              将你的收款码图片命名为 <b>donate_qr.jpg</b><br>
              放到 <b>assets/www/img/</b> 目录下
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;line-height:1.6;">
              打开微信扫一扫即可打赏 ☕<br>
              如果这个工具帮到了你，请我喝杯咖啡
            </div>
            <button class="btn btn-small btn-primary" id="btnSaveDonateQr">💾 保存收款码到相册</button>
          </div>
        </div>

        <!-- 版权信息 -->
        <div class="card" style="padding:16px;">
          <div style="font-size:13px;color:var(--text-muted);line-height:1.8;text-align:center;">
            <div>小宝工具箱 v${APP_VERSION}</div>
            <div>© 2026 小宝工具箱</div>
            <div style="margin-top:8px;font-size:11px;">
              本工具为免费软件 · 所有功能本地运行<br>
              不收集任何用户数据
            </div>
          </div>
        </div>
      </div>
    `;

    util.$('btnCheckUpdate').onclick = checkUpdate;
    const dlBtn = util.$('btnDownloadUpdate');
    if (dlBtn) dlBtn.onclick = () => {
      if (state.updateInfo && state.updateInfo.url) {
        window.open(state.updateInfo.url, '_blank');
      }
    };
    // 保存收款码到相册
    const saveDonateBtn = util.$('btnSaveDonateQr');
    if (saveDonateBtn) saveDonateBtn.onclick = saveDonateQr;
  }

  async function checkUpdate() {
    state.checking = true;
    state.updateInfo = null;
    state.error = '';
    render();

    try {
      let data;

      // 优先用 GitHub Releases
      if (GITHUB_REPO) {
        const resp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
          cache: 'no-cache'
        });
        if (!resp.ok) {
          if (resp.status === 403 || resp.status === 401) {
            throw new Error('GitHub API 拒绝了请求（仓库可能是私有的）\n请将仓库设为公开，或使用 GitHub Gist 方案');
          } else if (resp.status === 404) {
            throw new Error('没有找到任何 Release\n请先在 GitHub 上创建一个 Release');
          }
          throw new Error('请求失败 (' + resp.status + ')');
        }
        const release = await resp.json();
        data = {
          version: (release.tag_name || '').replace(/^[vV]/i, ''),
          url: release.assets && release.assets.length > 0 ? release.assets[0].browser_download_url : release.html_url,
          changelog: release.body || ''
        };
        const tagMatch = release.tag_name.match(/[\d.]+/);
        const tagVersion = tagMatch ? tagMatch[0] : '0.0.0';
        state.updateInfo = {
          hasUpdate: compareVersions(tagVersion, APP_VERSION) > 0,
          version: data.version,
          url: data.url,
          changelog: data.changelog
        };
      }
      // 备用：JSON URL 方式
      else if (VERSION_JSON_URL) {
        const resp = await fetch(VERSION_JSON_URL, { cache: 'no-cache' });
        if (!resp.ok) throw new Error('请求失败 (' + resp.status + ')');
        data = await resp.json();
        state.updateInfo = {
          hasUpdate: (data.versionCode || 0) > APP_VERSION_CODE,
          version: data.version || '未知',
          url: data.url || '',
          changelog: data.changelog || ''
        };
      }
      // 没有配置任何更新源
      else {
        throw new Error('未配置更新源\n请在 about.js 中配置 GITHUB_REPO 或 VERSION_JSON_URL');
      }
    } catch (e) {
      state.error = e.message;
    }

    state.checking = false;
    render();
  }

  function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const va = pa[i] || 0, vb = pb[i] || 0;
      if (va !== vb) return va - vb;
    }
    return 0;
  }

  function saveDonateQr() {
    if (window.NativeGallery) {
      showToast('正在保存到相册...');
      // 设置保存结果回调
      window._galleryCallback = function(success) {
        if (success) {
          showToast('✅ 已保存到相册「小宝工具箱」文件夹');
        } else {
          showToast('❌ 保存失败，请长按图片保存');
        }
      };
      // 直接传递 base64 数据给原生代码解码，100% 可靠
      NativeGallery.saveImage(DONATE_QR_B64);
    } else {
      showToast('保存功能不可用');
    }
  }

  render();
});
