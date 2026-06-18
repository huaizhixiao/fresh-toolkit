// ========== Bit 位分析器 ==========
router.register('bit', (container) => {
  let state = {
    hexInput: 'A1B2C3D4',
    dataType: 'stream',   // stream / can
    endian: 'big',        // stream: big / little | can: intel / motorola_f / motorola_r
    bytes: [],
    error: '',
    analyzing: false,
    signed: false        // false=无符号, true=有符号
  };

  // 8 个 bit 位的颜色（bit7 → bit0）
  const BIT_COLORS = [
    '#e74c3c', // bit 7
    '#e67e22', // bit 6
    '#f1c40f', // bit 5
    '#2ecc71', // bit 4
    '#1abc9c', // bit 3
    '#3498db', // bit 2
    '#9b59b6', // bit 1
    '#e91e63'  // bit 0
  ];

  function getEndianOptions() {
    if (state.dataType === 'can') {
      return [
        { value: 'intel', label: 'Intel' },
        { value: 'motorola_f', label: 'Motorola(正向)' },
        { value: 'motorola_r', label: 'Motorola(反向)' }
      ];
    }
    return [
      { value: 'big', label: '大端' },
      { value: 'little', label: '小端' }
    ];
  }

  function parseHex(input) {
    const clean = input.replace(/[^0-9a-fA-F]/g, '');
    if (clean.length === 0) return [];
    if (clean.length % 2 !== 0) return null;
    const bytes = [];
    for (let i = 0; i < clean.length; i += 2) {
      bytes.push(parseInt(clean.substr(i, 2), 16));
    }
    return bytes;
  }

  function analyze() {
    // 按钮反馈
    state.analyzing = true;
    render();

    // 用 setTimeout 让按钮文字先变，再执行分析
    setTimeout(() => {
      const raw = parseHex(state.hexInput);
      if (raw === null) {
        state.error = '❌ 十六进制字符数为奇数，请补全';
        state.bytes = [];
      } else if (raw.length === 0) {
        state.error = '';
        state.bytes = [];
      } else {
        state.error = '';
        state.bytes = raw;
      }
      state.analyzing = false;
      render();
    }, 80);
  }

  // 翻转某个 bit
  function toggleBit(origIdx, bit) {
    if (origIdx < 0 || origIdx >= state.bytes.length) return;
    state.bytes[origIdx] ^= (1 << bit); // XOR 翻转指定位
    render();
  }

  // 获取显示顺序的字节数组
  function getOrderedBytes() {
    const b = [...state.bytes];
    if (state.dataType === 'stream') {
      if (state.endian === 'little') return b.reverse();
      return b;
    }
    if (state.endian === 'intel') return b.reverse();
    return b;
  }

  // 显示索引 → 原始索引 映射
  function getOrigIndex(displayIdx) {
    const total = state.bytes.length;
    if (state.dataType === 'stream' && state.endian === 'little') return total - 1 - displayIdx;
    if (state.dataType === 'can' && state.endian === 'intel') return total - 1 - displayIdx;
    return displayIdx;
  }

  function getBitOrder() {
    if (state.dataType === 'can' && state.endian === 'motorola_r') {
      return [0, 1, 2, 3, 4, 5, 6, 7];
    }
    return [7, 6, 5, 4, 3, 2, 1, 0];
  }

  function getModeLabel() {
    if (state.dataType === 'can') {
      const map = { intel: 'Intel (小端)', motorola_f: 'Motorola 正向 (大端)', motorola_r: 'Motorola 反向 (大端+位反转)' };
      return map[state.endian] || state.endian;
    }
    const map = { big: '大端 (MSB)', little: '小端 (LSB)' };
    return map[state.endian] || state.endian;
  }

  function toWord(bytes, start, len, endian, signed) {
    const isBig = !(endian === 'little' || endian === 'intel');
    let val = 0;
    if (isBig) {
      for (let i = 0; i < len; i++) {
        val = val * 256 + (bytes[start + i] || 0);
      }
    } else {
      for (let i = len - 1; i >= 0; i--) {
        val = val * 256 + (bytes[start + i] || 0);
      }
    }
    if (signed) {
      const maxVal = Math.pow(2, len * 8);
      if (val >= maxVal / 2) val -= maxVal;
    }
    return val;
  }

  function formatWordStr(bytes, start, len, endian, signed) {
    const isBig = !(endian === 'little' || endian === 'intel');
    let hexParts;
    if (isBig) {
      hexParts = Array.from({length: len}, (_, i) =>
        bytes[start + i]?.toString(16).toUpperCase().padStart(2,'0') || '00'
      );
    } else {
      hexParts = Array.from({length: len}, (_, i) =>
        bytes[start + len - 1 - i]?.toString(16).toUpperCase().padStart(2,'0') || '00'
      );
    }
    return { hex: '0x' + hexParts.join(''), dec: toWord(bytes, start, len, endian, signed) };
  }

  function render() {
    const ordered = getOrderedBytes();
    const hasData = ordered.length > 0;
    const bitOrder = getBitOrder();
    const endianOpts = getEndianOptions();

    container.innerHTML = `
      <div class="card" style="margin:12px;">
        <div class="card-title">🔬 Bit 位分析器</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">输入十六进制数据，点击 bit 可翻转 0/1 ⬅</div>

        <!-- 输入区 -->
        <div class="input-group">
          <label class="input-label">十六进制数据</label>
          <input class="input-field" id="hexInput" type="text"
            placeholder="例如: A1B2C3D4"
            value="${state.hexInput}"
            style="font-family:monospace;font-size:14px;letter-spacing:1px;">
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <div style="flex:1;">
            <label class="input-label">数据类型</label>
            <select class="input-field" id="dataTypeSelect">
              <option value="stream" ${state.dataType==='stream'?'selected':''}>标准字节流</option>
              <option value="can" ${state.dataType==='can'?'selected':''}>CAN 位流</option>
            </select>
          </div>
          <div style="flex:1;">
            <label class="input-label">字节序</label>
            <select class="input-field" id="endianSelect">
              ${endianOpts.map(o =>
                `<option value="${o.value}" ${state.endian===o.value?'selected':''}>${o.label}</option>`
              ).join('')}
            </select>
          </div>
          <div style="flex:0 0 auto;display:flex;align-items:flex-end;">
            <button class="btn btn-primary" id="btnAnalyze" style="height:42px;padding:0 20px;">
              ${state.analyzing ? '⏳ 分析中...' : '🔍 分析'}
            </button>
          </div>
        </div>

        ${state.error ? `
        <div style="background:#fff0f0;color:#e53935;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:12px;">
          ${state.error}
        </div>` : ''}

        ${hasData ? `
        <div style="margin-top:4px;">

          <!-- 概要 -->
          <div style="background:#f7f8fc;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;line-height:1.6;">
            <div style="display:flex;flex-wrap:wrap;gap:8px 16px;">
              <span><b>字节数：</b>${state.bytes.length}</span>
              <span><b>位数：</b>${state.bytes.length * 8}</span>
              <span><b>模式：</b>${getModeLabel()}</span>
              <span style="color:#999;font-size:11px;">⬅ 点击 bit 翻转</span>
            </div>
            <div style="margin-top:2px;word-break:break-all;font-family:monospace;color:#888;">
              ${state.bytes.map(b => b.toString(16).toUpperCase().padStart(2,'0')).join(' ')}
            </div>
          </div>

          <!-- 位视图 -->
          <div style="font-size:13px;font-weight:600;margin-bottom:6px;">📋 位视图</div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="background:#f0f2f5;">
                  <th style="padding:4px 6px;text-align:left;border-bottom:1px solid #ddd;width:38px;white-space:nowrap;">#</th>
                  <th style="padding:4px 6px;text-align:center;border-bottom:1px solid #ddd;width:30px;">Hex</th>
                  <th style="padding:4px 6px;text-align:center;border-bottom:1px solid #ddd;" colspan="8">
                    <span style="font-size:11px;color:#888;">
                      ${state.dataType === 'can' && state.endian === 'motorola_r'
                        ? 'bit 0 ← bit 7'
                        : 'bit 7 ← bit 0'}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                ${ordered.map((byte, dispIdx) => {
                  const origIdx = getOrigIndex(dispIdx);
                  return `
                <tr style="border-bottom:1px solid #f0f0f0;">
                  <td style="padding:3px 6px;font-size:11px;color:#999;white-space:nowrap;">B${origIdx}</td>
                  <td style="padding:3px 4px;text-align:center;font-family:monospace;font-weight:600;color:#e74c3c;font-size:11px;cursor:pointer;"
                      onclick="(function(){window._toggleByte(${origIdx})})()"
                      title="点击编辑 B${origIdx}">${byte.toString(16).toUpperCase().padStart(2,'0')}</td>
                  ${bitOrder.map(bit => {
                    const isSet = (byte >> bit) & 1;
                    const colorIdx = state.dataType === 'can' && state.endian === 'motorola_r'
                      ? 7 - bit : bit;
                    const color = BIT_COLORS[colorIdx];
                    return `
                    <td style="padding:2px 1px;text-align:center;width:12.5%;">
                      <div style="
                        width:100%;aspect-ratio:1;max-width:22px;margin:0 auto;
                        border-radius:3px;
                        background:${isSet ? color : '#eee'};
                        color:${isSet ? '#fff' : '#ccc'};
                        display:flex;align-items:center;justify-content:center;
                        font-size:10px;font-weight:700;line-height:1;
                        cursor:pointer;transition:all 0.1s;
                        box-shadow:${isSet ? '0 1px 3px rgba(0,0,0,0.15)' : 'none'};
                      "
                      onclick="window._toggleBit(${origIdx},${bit})"
                      onmouseover="this.style.opacity='0.8';this.style.transform='scale(1.1)'"
                      onmouseout="this.style.opacity='1';this.style.transform='scale(1)'"
                      title="B${origIdx} bit${bit}=${isSet} 点击翻转">${isSet?'1':'0'}</div>
                    </td>`;
                  }).join('')}
                </tr>`;}).join('')}
              </tbody>
            </table>
          </div>

          <!-- 图例 -->
          <div style="display:flex;flex-wrap:wrap;gap:3px;margin:8px 0 12px;padding:6px 10px;background:#fafbfc;border-radius:6px;">
            ${(state.dataType === 'can' && state.endian === 'motorola_r'
              ? [0,1,2,3,4,5,6,7]
              : [7,6,5,4,3,2,1,0]
            ).map(bit => {
              const colorIdx = state.dataType === 'can' && state.endian === 'motorola_r' ? 7 - bit : bit;
              return `
              <span style="display:inline-flex;align-items:center;gap:2px;font-size:10px;color:#999;margin-right:2px;">
                <span style="width:10px;height:10px;border-radius:2px;background:${BIT_COLORS[colorIdx]};display:inline-block;"></span>
                bit ${bit}
              </span>`;
            }).join('')}
          </div>

          <!-- 组合值 -->
          ${state.bytes.length >= 2 ? `
          <div style="font-size:13px;font-weight:600;margin:10px 0 6px;">
            📊 组合值
            <span style="font-size:11px;font-weight:400;color:var(--text-muted);float:right;">
              <label style="cursor:pointer;user-select:none;">
                <input type="checkbox" id="signedToggle" ${state.signed?'checked':''} style="vertical-align:middle;">
                <span style="vertical-align:middle;">有符号</span>
              </label>
            </span>
          </div>
          <div style="background:#f7f8fc;border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.8;">
            ${state.bytes.length >= 2 ? `
            <div style="display:flex;flex-wrap:wrap;gap:4px 16px;">
              <span><b>16位：</b>
                <span style="font-family:monospace;color:#e74c3c;">${formatWordStr(state.bytes,0,2,state.endian,state.signed).hex}</span>
                = ${formatWordStr(state.bytes,0,2,state.endian,state.signed).dec}
              </span>
            </div>` : ''}
            ${state.bytes.length >= 4 ? `
            <div><b>32位：</b>
              <span style="font-family:monospace;color:#e74c3c;">${formatWordStr(state.bytes,0,4,state.endian,state.signed).hex}</span>
              = ${formatWordStr(state.bytes,0,4,state.endian,state.signed).dec}
            </div>` : ''}
            ${state.bytes.length >= 8 ? `
            <div><b>64位：</b>
              <span style="font-family:monospace;color:#e74c3c;">${formatWordStr(state.bytes,0,8,state.endian,state.signed).hex}</span>
              = ${formatWordStr(state.bytes,0,8,state.endian,state.signed).dec}
            </div>` : ''}
          </div>` : ''}

          <!-- 端序对比 -->
          ${state.bytes.length >= 2 ? `
          <div style="font-size:13px;font-weight:600;margin:10px 0 6px;">🔄 端序对比</div>
          <div style="background:#f7f8fc;border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.8;">
            <div><b>大端：</b>
              <span style="font-family:monospace;color:#e74c3c;">${state.bytes.map(b=>b.toString(16).toUpperCase().padStart(2,'0')).join(' ')}</span>
            </div>
            <div><b>小端：</b>
              <span style="font-family:monospace;color:#3498db;">${[...state.bytes].reverse().map(b=>b.toString(16).toUpperCase().padStart(2,'0')).join(' ')}</span>
            </div>
            <div style="margin-top:2px;font-size:11px;color:#999;">
              16位: 大端 ${formatWordStr(state.bytes,0,2,'big',state.signed).hex} = ${formatWordStr(state.bytes,0,2,'big',state.signed).dec} |
              小端 ${formatWordStr(state.bytes,0,2,'little',state.signed).hex} = ${formatWordStr(state.bytes,0,2,'little',state.signed).dec}
            </div>
          </div>` : ''}

        </div>` : `
        <div style="text-align:center;padding:40px 20px;color:#ccc;font-size:14px;">
          <div style="font-size:40px;margin-bottom:10px;">🔬</div>
          输入十六进制数据，点击分析
        </div>`}
      </div>
    `;

    // 挂载全局翻转函数
    window._toggleBit = (origIdx, bit) => {
      if (origIdx < 0 || origIdx >= state.bytes.length) return;
      state.bytes[origIdx] ^= (1 << bit);
      render();
    };
    window._toggleByte = (origIdx) => {
      if (origIdx < 0 || origIdx >= state.bytes.length) return;
      // 弹出输入框让用户输入新值
      const curHex = state.bytes[origIdx].toString(16).toUpperCase().padStart(2,'0');
      const newHex = prompt(`编辑 Byte ${origIdx}（十六进制，两位）`, curHex);
      if (newHex !== null) {
        const val = parseInt(newHex, 16);
        if (!isNaN(val) && val >= 0 && val <= 255) {
          state.bytes[origIdx] = val;
          render();
        }
      }
    };

    // 事件绑定
    const hexInput = util.$('hexInput');
    if (hexInput) {
      hexInput.oninput = () => { state.hexInput = hexInput.value; };
      hexInput.onkeydown = (e) => { if (e.key === 'Enter') analyze(); };
    }

    const dataTypeSelect = util.$('dataTypeSelect');
    if (dataTypeSelect) {
      dataTypeSelect.onchange = () => {
        const prev = state.dataType;
        state.dataType = dataTypeSelect.value;
        if (prev !== state.dataType) {
          const opts = getEndianOptions();
          state.endian = opts[0].value;
        }
        render();
      };
    }

    const endianSelect = util.$('endianSelect');
    if (endianSelect) {
      endianSelect.onchange = () => {
        state.endian = endianSelect.value;
        if (state.bytes.length > 0) render();
      };
    }

    const btnAnalyze = util.$('btnAnalyze');
    if (btnAnalyze) btnAnalyze.onclick = analyze;

    const signedToggle = util.$('signedToggle');
    if (signedToggle) {
      signedToggle.onchange = () => {
        state.signed = signedToggle.checked;
        if (state.bytes.length > 0) render();
      };
    }
  }

  render();
});
