// ========== 二维码生成 ==========
router.register('qrcode', (container) => {
  let state = { content: '', contentType: 'text', size: 256, history: store.get('qr_history', []), qrDataUrl: '' };

  function render() {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">📱 二维码生成</div>
        <div class="input-group">
          <label class="input-label">内容</label>
          <textarea class="input-field textarea" id="qrInput" placeholder="输入文本、网址等" rows="3">${state.content}</textarea>
        </div>
        <div class="preset-list" id="qrTypeList">
          <button class="preset-item ${state.contentType==='text'?'active':''}" data-type="text">文本</button>
          <button class="preset-item ${state.contentType==='url'?'active':''}" data-type="url">网址</button>
          <button class="preset-item ${state.contentType==='wifi'?'active':''}" data-type="wifi">WiFi</button>
          <button class="preset-item ${state.contentType==='vcard'?'active':''}" data-type="vcard">名片</button>
          <button class="preset-item ${state.contentType==='tel'?'active':''}" data-type="tel">电话</button>
        </div>
        <div class="input-group"><label class="input-label">尺寸</label>
          <select class="input-field" id="qrSize">
            <option value="128" ${state.size===128?'selected':''}>小 (128px)</option>
            <option value="256" ${state.size===256?'selected':''}>中 (256px)</option>
            <option value="512" ${state.size===512?'selected':''}>大 (512px)</option>
          </select>
        </div>
        <button class="btn btn-block btn-primary" id="btnGenerate">生成二维码</button>
        ${state.qrDataUrl ? `
        <div class="qr-display" style="margin-top:16px;">
          <img src="${state.qrDataUrl}" style="width:${state.size}px;height:${state.size}px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
          <div style="text-align:center;margin-top:8px;font-size:12px;color:var(--text-muted);word-break:break-all;">${state.content.length > 50 ? state.content.substring(0,50)+'...' : state.content}</div>
          <button class="btn btn-block btn-primary" id="btnSave" style="margin-top:12px;">💾 保存到相册</button>
          <div style="text-align:center;margin-top:4px;font-size:11px;color:#999;">也可长按二维码图片保存</div>
        </div>` : ''}
      </div>
      ${state.history.length > 0 ? `
      <div class="card">
        <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;">
          <span>生成历史</span>
          <button class="btn btn-small btn-outline" id="btnClearHistory" style="font-size:12px;padding:4px 10px;">全部清除</button>
        </div>
        <div class="history-list" id="qrHistory">
          ${state.history.map((h,i) => `
            <div class="history-item" style="cursor:pointer;display:flex;align-items:center;padding:10px 12px;">
              <span data-hidx="${i}" style="flex:1;overflow:hidden;">
                <span style="font-size:13px;color:var(--text);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${h.content}</span>
                <span style="font-size:11px;color:#bbb;">${h.time}</span>
              </span>
              <button class="btn-del-history" data-hidx="${i}" style="flex-shrink:0;width:28px;height:28px;border:none;background:transparent;font-size:16px;color:#ccc;cursor:pointer;border-radius:50%;display:flex;align-items:center;justify-content:center;" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='transparent'">✕</button>
            </div>`).join('')}
        </div></div>` : ''}
    `;

    // 事件绑定
    util.$('btnGenerate').onclick = generate;

    const inputEl = util.$('qrInput');
    if (inputEl) inputEl.oninput = () => { state.content = inputEl.value; };

    const sizeEl = util.$('qrSize');
    if (sizeEl) sizeEl.onchange = () => { state.size = parseInt(sizeEl.value); };

    // 类型按钮
    container.querySelectorAll('#qrTypeList .preset-item').forEach(el => {
      el.onclick = () => setType(el.dataset.type);
    });

    // 保存按钮
    const saveEl = util.$('btnSave');
    if (saveEl) saveEl.onclick = saveToGallery;

    // 历史项 - 点击加载
    container.querySelectorAll('#qrHistory [data-hidx]').forEach(el => {
      el.onclick = () => {
        const idx = parseInt(el.dataset.hidx);
        state.content = state.history[idx]?.content || '';
        generate();
      };
    });

    // 历史项 - 单独删除
    container.querySelectorAll('.btn-del-history').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const idx = parseInt(el.dataset.hidx);
        state.history.splice(idx, 1);
        store.set('qr_history', state.history);
        render();
      };
    });

    // 全部清除
    const clearBtn = util.$('btnClearHistory');
    if (clearBtn) clearBtn.onclick = () => {
      state.history = [];
      store.set('qr_history', []);
      render();
    };
  }

  // 监听原生保存回调
  window._galleryCallback = (success) => {
    if (success) {
      showToast('✅ 已保存到相册「小宝工具箱」文件夹');
    } else {
      showToast('❌ 保存失败，请尝试长按图片保存');
    }
  };

  function setType(t) {
    state.contentType = t;
    if (t === 'url') state.content = 'https://';
    else if (t === 'tel') state.content = 'tel:';
    else state.content = '';
    render();
  }

  function getContent() {
    const input = util.$('qrInput');
    if (input) state.content = input.value;
    return state.content.trim();
  }

  function generate() {
    const text = getContent();
    if (!text) { showToast('请输入内容'); return; }

    try {
      // 格式化内容
      let finalText = text;
      if (state.contentType === 'url' && !text.startsWith('http://') && !text.startsWith('https://')) {
        finalText = 'https://' + text;
      } else if (state.contentType === 'tel' && !text.startsWith('tel:')) {
        finalText = 'tel:' + text.replace(/[^0-9+\- ]/g, '');
      } else if (state.contentType === 'wifi') {
        const parts = text.split(',');
        const ssid = parts[0] || '';
        const pwd = parts[1] || '';
        const enc = (parts[2] || 'WPA').toUpperCase();
        finalText = `WIFI:T:${enc};S:${ssid};P:${pwd};;`;
      } else if (state.contentType === 'vcard') {
        const parts = text.split('\n');
        const name = parts[0] || '';
        const tel = parts[1] || '';
        const email = parts[2] || '';
        finalText = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL:${tel}\nEMAIL:${email}\nEND:VCARD`;
      }

      // 使用 qrcode-generator 库生成 QR 码矩阵
      qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
      const qr = qrcode(0, 'M');
      qr.addData(finalText);
      qr.make();

      // 用 Canvas 渲染为 PNG（比库自带的 GIF 格式更清晰）
      const modules = qr.getModuleCount();
      const margin = Math.round(state.size * 0.08); // 8% 白边
      const innerSize = state.size - margin * 2;
      const cellSize = innerSize / modules;

      const canvas = document.createElement('canvas');
      canvas.width = state.size;
      canvas.height = state.size;
      const ctx = canvas.getContext('2d');

      // 白色背景 + 圆角（可选）
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, state.size, state.size);

      // 绘制黑色模块
      ctx.fillStyle = '#000000';
      for (let r = 0; r < modules; r++) {
        for (let c = 0; c < modules; c++) {
          if (qr.isDark(r, c)) {
            const x = margin + c * cellSize;
            const y = margin + r * cellSize;
            ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(cellSize), Math.ceil(cellSize));
          }
        }
      }

      state.qrDataUrl = canvas.toDataURL('image/png');

      // 记录历史
      state.history.unshift({ id: util.genId(), content: text.length > 50 ? text.substring(0, 50) + '...' : text, time: util.formatTime() });
      if (state.history.length > 20) state.history.length = 20;
      store.set('qr_history', state.history);

      render();
    } catch (e) {
      showToast('生成失败: ' + e.message);
    }
  }

  function saveToGallery() {
    if (!state.qrDataUrl) return;
    // 调用原生接口保存到相册
    if (window.NativeGallery) {
      showToast('正在保存到相册...');
      NativeGallery.saveImage(state.qrDataUrl);
    } else {
      // 无原生接口时走下载
      const a = document.createElement('a');
      a.href = state.qrDataUrl;
      a.download = `qrcode_${Date.now()}.png`;
      a.click();
      showToast('请到下载目录查找保存的图片');
    }
  }

  render();
});
