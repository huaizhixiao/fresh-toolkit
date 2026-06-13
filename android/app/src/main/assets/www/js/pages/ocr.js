// ========== 图片转文字 OCR ==========
router.register('ocr', (container) => {
  let state = { imageDataUrl: '', result: '', recognizing: false, history: store.get('ocr_history', []) };

  function render() {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">📷 图片文字识别 (OCR)</div>
        <div class="image-preview" id="imagePreview" style="cursor:pointer;">
          ${state.imageDataUrl ? `<img src="${state.imageDataUrl}">` :
            `<div class="image-placeholder"><span class="icon">📷</span><span>点击选择图片</span></div>`}
        </div>
        <div class="btn-row" style="margin-top:12px;">
          <button class="btn btn-small btn-outline" id="btnPickImage">选择图片</button>
          <button class="btn btn-primary ${state.recognizing?'':'btn-block'}" id="btnOCR" ${!state.imageDataUrl?'disabled':''}>
            ${state.recognizing ? '⏳ 识别中...' : '🔍 开始识别'}
          </button>
        </div>
        ${state.result ? `
        <div style="margin-top:16px;">
          <div class="card-title" style="font-size:15px;">📝 识别结果</div>
          <div style="background:#f7f8fc;border-radius:10px;padding:14px;font-size:14px;color:var(--text);line-height:1.6;word-break:break-all;white-space:pre-wrap;">${state.result}</div>
          <div class="btn-row" style="margin-top:8px;">
            <button class="btn btn-small" id="btnCopyResult">复制结果</button>
            <button class="btn btn-small btn-outline" id="btnClearResult">清空</button>
          </div>
        </div>` : ''}
        <div class="tips" style="margin-top:12px;">💡 使用 Tesseract.js 进行本地OCR识别，首次使用需下载语言包。识别速度和准确度取决于图片质量。</div>
      </div>
      ${state.history.length > 0 ? `
      <div class="card">
        <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;">
          <span>识别历史</span>
          <button class="btn btn-small btn-outline" id="btnClearOcrHistory" style="font-size:12px;padding:4px 10px;">全部清除</button>
        </div>
        <div class="history-list" id="ocrHistory">
          ${state.history.map((h,i) => `
            <div class="history-item" style="cursor:pointer;display:flex;align-items:center;padding:10px 12px;">
              <span data-ocridx="${i}" style="flex:1;overflow:hidden;">
                <span style="font-size:13px;color:var(--text);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${h.text}</span>
                <span style="font-size:11px;color:#bbb;">${h.time}</span>
              </span>
              <button class="btn-del-ocr" data-ocridx="${i}" style="flex-shrink:0;width:28px;height:28px;border:none;background:transparent;font-size:16px;color:#ccc;cursor:pointer;border-radius:50%;display:flex;align-items:center;justify-content:center;" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='transparent'">✕</button>
            </div>`).join('')}
        </div></div>` : ''}
    `;

    // 事件绑定
    util.$('btnPickImage').onclick = pickImage;
    util.$('imagePreview').onclick = pickImage;
    if (state.imageDataUrl) {
      util.$('btnOCR').onclick = startOCR;
    }

    const copyBtn = util.$('btnCopyResult');
    if (copyBtn) copyBtn.onclick = () => { copyText(state.result); };

    const clearBtn = util.$('btnClearResult');
    if (clearBtn) clearBtn.onclick = () => { state.result = ''; render(); };

    // 历史项 - 点击查看
    container.querySelectorAll('#ocrHistory [data-ocridx]').forEach(el => {
      el.onclick = () => {
        const idx = parseInt(el.dataset.ocridx);
        state.result = state.history[idx]?.text || '';
        render();
      };
    });

    // 历史项 - 单独删除
    container.querySelectorAll('.btn-del-ocr').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const idx = parseInt(el.dataset.ocridx);
        state.history.splice(idx, 1);
        store.set('ocr_history', state.history);
        render();
      };
    });

    // 全部清除
    const clearAllBtn = util.$('btnClearOcrHistory');
    if (clearAllBtn) clearAllBtn.onclick = async () => {
      if (await showConfirm('确认清除', '确定清除所有识别历史吗？')) {
        state.history = [];
        store.set('ocr_history', []);
        render();
      }
    };
  }

  async function pickImage() {
    try {
      const images = await chooseImage();
      if (images && images[0]) {
        state.imageDataUrl = images[0];
        state.result = '';
        render();
      }
    } catch(e) { showToast('选择失败'); }
  }

  async function startOCR() {
    if (!state.imageDataUrl || state.recognizing) return;
    state.recognizing = true;
    render();

    try {
      if (typeof Tesseract === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js');
      }

      showToast('识别中，请稍候...');
      const result = await Tesseract.recognize(state.imageDataUrl, 'chi_sim+eng', {
        logger: (m) => { if (m.status === 'recognizing text') {
          const btn = util.$('btnOCR');
          if (btn) btn.textContent = `⏳ ${Math.round(m.progress*100)}%`;
        }}
      });

      state.result = result.data.text || '未能识别出文字';

      // 保存历史
      state.history.unshift({ id: util.genId(), text: state.result.substring(0,80)+(state.result.length>80?'...':''), time: util.formatTime() });
      if (state.history.length > 20) state.history.length = 20;
      store.set('ocr_history', state.history);

    } catch(e) {
      state.result = `识别失败: ${e.message}\n\n建议：\n1. 检查网络连接\n2. 使用清晰的文字图片\n3. 注意图片不能太大`;
    }
    state.recognizing = false;
    render();
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  render();
});
