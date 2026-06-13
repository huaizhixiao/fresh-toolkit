// ========== MQTT 客户端 ==========
router.register('mqtt', (container) => {
  let state = {
    clients: store.get('mqtt_clients', []),
    currentIdx: 0,
    connected: false,
    subscriptions: (store.get('mqtt_clients', [])[0]?.subscriptions) || [],
    receivedMsgs: [],
    savedMessages: store.get('mqtt_saved_msgs', []),
    client: null,     // mqtt.js WebSocket client
    nativeOk: false,   // 原生桥接是否可用
    periodicTimers: {}
  };

  const PROTOCOLS = [
    { value: 'mqtt://', label: 'mqtt://', desc: 'TCP直连（原生）', needPath: false },
    { value: 'mqtts://', label: 'mqtts://', desc: 'TLS加密（原生）', needPath: false },
    { value: 'ws://', label: 'ws://', desc: 'WebSocket', needPath: true },
    { value: 'wss://', label: 'wss://', desc: '安全WebSocket', needPath: true }
  ];

  try { state.nativeOk = typeof NativeMQTT !== 'undefined'; } catch(e) {}

  function render() {
    const c = state.clients[state.currentIdx] || null;
    container.innerHTML = `
      <div class="card">
        <div class="card-title">📨 MQTT 客户端</div>
        <div class="client-selector">
          <select id="clientSelect">
            ${state.clients.map((c,i) => `<option value="${i}" ${i==state.currentIdx?'selected':''}>${c.name}</option>`).join('')}
            <option value="-1">${state.clients.length===0?'暂无客户端':'+ 新建'}</option>
          </select>
          <button class="btn btn-small btn-primary" onclick="window._showAddClient()">+ 新建</button>
        </div>
        ${c ? `
        <div style="background:#f7f8fc;border-radius:10px;padding:12px;margin:8px 0;">
          <div class="detail-row"><span class="detail-label">协议</span><span class="detail-value tag tag-blue">${c.protocol}</span></div>
          <div class="detail-row"><span class="detail-label">地址</span><span class="detail-value">${c.host}:${c.port}</span></div>
          ${c.username ? `<div class="detail-row"><span class="detail-label">用户</span><span class="detail-value">${c.username}</span></div>` : ''}
          <div class="detail-row"><span class="detail-label">状态</span><span class="detail-value" style="color:${state.connected?'var(--primary)':'#ff4d4f'}">${state.connected?'已连接':'未连接'}</span></div>
        </div>
        <div class="btn-row">
          <button class="btn ${state.connected?'btn-danger':'btn-primary'}" id="btnConnect">${state.connected?'断开':'连接'}</button>
          <button class="btn btn-small btn-outline" onclick="window._editClient()">编辑</button>
          <button class="btn btn-small btn-outline" onclick="window._deleteClient()">删除</button>
        </div>`
        : '<div class="empty-state">点击"新建"添加MQTT服务器</div>'}
      </div>
      ${state.connected ? `
      <div class="card">
        <div class="card-title" style="display:flex;align-items:center;gap:8px;">
          📥 订阅 <button class="btn btn-small btn-success" onclick="window._showAddSub()" style="margin-left:auto;">+ 添加</button>
        </div>
        ${state.subscriptions.length === 0 ? '<div class="empty-state" style="padding:16px;">暂无订阅</div>' : ''}
        ${state.subscriptions.map((s, i) => `<div class="mqtt-item" style="${s.enabled?'':'opacity:0.5;'}">
          <div class="mqtt-item-top"><div class="mqtt-item-label">${s.alias || s.topic}</div>${s.alias ? `<div class="mqtt-item-sub">${s.topic}</div>` : ''}</div>
          <div class="mqtt-item-actions">
            <span class="tag tag-blue">QoS ${s.qos}</span>
            <label class="switch"><input type="checkbox" ${s.enabled?'checked':''} onchange="window._toggleSub(${i},this.checked)"><span class="switch-slider"></span></label>
            <span class="unsub-btn" onclick="window._removeSub(${i})">✕</span>
          </div>
        </div>`).join('')}
      </div>
      <div class="card">
        <div class="card-title">📬 消息 ${state.receivedMsgs.length > 0 ? `<span class="tag tag-red" style="margin-left:8px;">${state.receivedMsgs.length}</span>` : ''}</div>
        <div style="max-height:320px;overflow-y:auto;">
          ${state.receivedMsgs.slice(-30).reverse().map(m => `
            <div class="msg-item" onclick="this.classList.toggle('expanded')">
              <div class="msg-header"><span class="msg-topic tag tag-blue">${m.topicAlias || m.topic}</span><span class="msg-time">${m.time}</span></div>
              <pre class="msg-content" style="white-space:pre-wrap;font-size:12px;font-family:monospace;margin-top:4px;line-height:1.4;">${m.displayContent}</pre>
            </div>`).join('')}
          ${state.receivedMsgs.length===0 ? '<div class="empty-state" style="padding:20px;">等待接收消息...</div>' : ''}
        </div>
        <button class="btn btn-small btn-outline" onclick="window._clearMsgs()" style="margin-top:8px;">清空消息</button>
      </div>
      <div class="card">
        <div class="card-title" style="display:flex;align-items:center;gap:8px;">
          📤 发布 <button class="btn btn-small btn-success" onclick="window._showAddPublish()" style="margin-left:auto;">+ 添加</button>
        </div>
        ${state.savedMessages.length === 0 ? '<div class="empty-state" style="padding:16px;">暂无发布消息</div>' : ''}
        ${state.savedMessages.map((m, i) => {
          const isPeriodic = state.periodicTimers[m.id];
          return `<div class="mqtt-item">
            <div class="mqtt-item-top">
              <div class="mqtt-item-label" style="color:var(--primary);">${m.alias || m.topic}</div>
              ${m.alias ? `<div class="mqtt-item-sub">${m.topic}</div>` : ''}
              <div class="mqtt-item-sub">${m.content.length > 60 ? m.content.slice(0,60)+'...' : m.content}</div>
            </div>
            <div class="mqtt-item-actions">
              <span style="font-size:11px;color:#bbb;">QoS ${m.qos}${isPeriodic?' · 每'+m.interval+'s':''}</span>
              <button class="btn btn-small btn-primary" style="font-size:12px;padding:4px 12px;" onclick="window._sendSaved(${i})">📤 发送</button>
              <button class="btn btn-small ${isPeriodic?'btn-danger':'btn-outline'}" style="font-size:12px;padding:4px 12px;" onclick="window._togglePeriodic(${i})">${isPeriodic?'⏹ 停止':'🔄 周期'}</button>
              <button class="btn btn-small btn-outline" style="font-size:12px;padding:4px 8px;" onclick="window._editSavedMsg(${i})">✏️</button>
              <span class="unsub-btn" onclick="window._deleteSavedMsg(${i})">✕</span>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}
      <style>
        .switch { position:relative; display:inline-block; width:40px; height:24px; flex-shrink:0; }
        .switch input { opacity:0; width:0; height:0; }
        .switch-slider { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background:#ccc; border-radius:24px; transition:0.3s; }
        .switch-slider:before { content:""; position:absolute; height:18px; width:18px; left:3px; bottom:3px; background:#fff; border-radius:50%; transition:0.3s; }
        .switch input:checked+.switch-slider { background:var(--primary); }
        .switch input:checked+.switch-slider:before { transform:translateX(16px); }
        .msg-item { padding:8px 12px; margin:4px 0; background:#fafafa; border-radius:8px; cursor:pointer; }
        .msg-item:hover { background:#f0f0f0; }
        .msg-item pre { max-height:60px; overflow:hidden; }
        .msg-item.expanded pre { max-height:none !important; }
        .mqtt-item { padding:12px; margin:6px 0; background:#fafafa; border-radius:10px; }
        .mqtt-item-top { margin-bottom:8px; }
        .mqtt-item-label { font-size:14px; font-weight:600; word-break:break-all; line-height:1.3; }
        .mqtt-item-sub { font-size:11px; color:var(--text-muted); margin-top:2px; word-break:break-all; }
        .mqtt-item-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
      </style>
    `;

    const sel = util.$('clientSelect');
    if (sel) sel.onchange = function() {
      if (this.value === '-1') { window._showAddClient(); return; }
      doDisconnect();
      state.currentIdx = parseInt(this.value);
      const cl = state.clients[state.currentIdx];
      state.subscriptions = cl?.subscriptions || [];
      state.receivedMsgs = [];
      render();
    };
    if (state.connected || c) {
      const btn = util.$('btnConnect');
      if (btn) btn.onclick = toggleConnect;
    }
  }

  // ===== 连接管理 =====
  function doConnect() {
    const c = state.clients[state.currentIdx];
    if (!c) return;

    // 先完整断开旧连接，确保干净状态
    doDisconnect();

    const isNative = c.protocol === 'mqtt://' || c.protocol === 'mqtts://';

    if (isNative) {
      if (!state.nativeOk) { showToast('原生MQTT不可用'); return; }
      try {
        const result = NativeMQTT.connect(
          c.host, c.port, c.clientId || 'toolkit_' + Date.now().toString(36),
          c.username || '', c.password || '',
          c.protocol === 'mqtts://'
        );
        if (!result.startsWith('OK')) showToast('连接失败: ' + result);
      } catch(e) { showToast('连接异常: ' + e.message); }
    } else {
      // WebSocket mqtt.js
      if (typeof mqtt === 'undefined') { showToast('mqtt.js 未加载'); return; }
      const wsProto = c.protocol === 'wss://' ? 'wss' : 'ws';
      const finalUrl = `${wsProto}://${c.host}:${c.port}${c.path || '/mqtt'}`;
      try {
        state.client = mqtt.connect(finalUrl, {
          clientId: c.clientId || 'toolkit_' + Date.now().toString(36),
          clean: true, connectTimeout: 10000, keepalive: 60,
          reconnectPeriod: 0, resubscribe: false
        });
        state.client.on('connect', () => {
          state.connected = true; state.receivedMsgs = []; render();
          state.subscriptions.filter(s => s.enabled).forEach(s => state.client.subscribe(s.topic, { qos: s.qos||0 }));
        });
        state.client.on('message', (topic, payload) => onMessage(topic, payload.toString()));
        state.client.on('close', () => { state.connected = false; render(); });
        state.client.on('error', () => {});
        state.client.on('offline', () => { state.connected = false; render(); });
      } catch(err) { showToast('连接失败: ' + err.message); }
    }
  }

  function doDisconnect() {
    stopAllPeriodic();
    if (state.client) { try { state.client.end(true); } catch(e) {} state.client = null; }
    if (state.nativeOk) { try { NativeMQTT.disconnect(); } catch(e) {} }
    state.connected = false;
  }

  function toggleConnect() {
    if (state.connected) { doDisconnect(); render(); }
    else { doConnect(); }
  }

  // ===== 订阅管理 =====
  window._showAddSub = () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-title">添加订阅</div>
        <div class="input-group"><label class="input-label">主题</label><input class="input-field" id="subTopicNew" placeholder="如 test/topic"></div>
        <div class="input-group"><label class="input-label">别名（可选）</label><input class="input-field" id="subAlias" placeholder="对外显示的名称"></div>
        <div class="input-group"><label class="input-label">QoS</label><select id="subQosNew" style="width:100%;height:44px;border:1px solid #ddd;border-radius:10px;padding:0 12px;">
          <option value="0">QoS 0</option><option value="1">QoS 1</option><option value="2">QoS 2</option>
        </select></div>
        <div class="modal-buttons">
          <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">取消</button>
          <button class="btn btn-primary" onclick="window._saveSub()">订阅</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  };

  window._saveSub = () => {
    const topic = util.$('subTopicNew')?.value?.trim();
    if (!topic) { showToast('请输入主题'); return; }
    const alias = util.$('subAlias')?.value?.trim() || '';
    const qos = parseInt(util.$('subQosNew')?.value || 0);
    if (!state.subscriptions.find(s => s.topic === topic)) state.subscriptions.push({ topic, qos, alias, enabled: true });
    if (state.connected) {
      if (state.client) state.client.subscribe(topic, { qos });
      if (state.nativeOk) { try { NativeMQTT.subscribe(topic, qos); } catch(e) {} }
    }
    saveSubs();
    document.querySelector('.modal-overlay')?.remove();
    render();
  };

  window._toggleSub = (idx, enabled) => {
    const s = state.subscriptions[idx]; if (!s) return;
    s.enabled = enabled;
    if (state.connected) {
      if (state.client) { if (enabled) state.client.subscribe(s.topic, { qos: s.qos||0 }); else state.client.unsubscribe(s.topic); }
      if (state.nativeOk) { try { if (enabled) NativeMQTT.subscribe(s.topic, s.qos||0); else NativeMQTT.unsubscribe(s.topic); } catch(e) {} }
    }
    saveSubs(); render();
  };

  window._removeSub = (idx) => {
    const s = state.subscriptions[idx]; if (!s) return;
    if (state.connected) {
      if (state.client) state.client.unsubscribe(s.topic);
      if (state.nativeOk) { try { NativeMQTT.unsubscribe(s.topic); } catch(e) {} }
    }
    state.subscriptions.splice(idx, 1); saveSubs(); render();
  };

  function saveSubs() {
    if (state.clients[state.currentIdx]) {
      state.clients[state.currentIdx].subscriptions = state.subscriptions;
      store.set('mqtt_clients', state.clients);
    }
  }

  // ===== 发布管理 =====
  window._showAddPublish = (editIdx) => {
    const m = editIdx !== undefined ? state.savedMessages[editIdx] : null;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-title">${m ? '编辑' : '添加'}发布</div>
        <div class="input-group"><label class="input-label">主题</label><input class="input-field" id="pubTopicNew" value="${m?.topic||''}" placeholder="如 test/topic"></div>
        <div class="input-group"><label class="input-label">别名</label><input class="input-field" id="pubAliasNew" value="${m?.alias||''}" placeholder="对外显示的名称"></div>
        <div class="input-group"><label class="input-label">内容</label><textarea class="input-field textarea" id="pubContentNew" rows="3">${m?.content||''}</textarea></div>
        <div class="input-group"><label class="input-label">QoS</label><select id="pubQosNew" style="width:100%;height:44px;border:1px solid #ddd;border-radius:10px;padding:0 12px;">
          <option value="0" ${m?.qos===0?'selected':''}>QoS 0</option><option value="1" ${m?.qos===1?'selected':''}>QoS 1</option>
        </select></div>
        <div class="input-group"><label class="input-label">周期间隔</label><select id="pubPeriodicInterval" style="width:100%;height:44px;border:1px solid #ddd;border-radius:10px;padding:0 12px;">
          ${[1,2,3,5,10,30,60,300,600].map(n => `<option value="${n}" ${n===5?'selected':''}>${n}秒</option>`).join('')}
        </select></div>
        <div class="modal-buttons">
          <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">取消</button>
          <button class="btn btn-primary" onclick="window._savePublish(${editIdx !== undefined ? editIdx : -1})">${m ? '保存修改' : '添加'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  };

  window._editSavedMsg = (idx) => window._showAddPublish(idx);
  window._savePublish = (editIdx) => {
    const topic = util.$('pubTopicNew')?.value?.trim();
    const content = util.$('pubContentNew')?.value?.trim();
    if (!topic || !content) { showToast('请填写主题和内容'); return; }
    const alias = util.$('pubAliasNew')?.value?.trim() || '';
    const qos = parseInt(util.$('pubQosNew')?.value || 0);
    const interval = parseInt(util.$('pubPeriodicInterval')?.value || 5);
    const data = { id: Date.now(), topic, alias, content, qos, interval, time: util.formatTime() };
    if (editIdx >= 0) { stopPeriodic(state.savedMessages[editIdx].id); state.savedMessages[editIdx] = { ...state.savedMessages[editIdx], ...data }; }
    else { state.savedMessages.unshift(data); }
    if (state.savedMessages.length > 100) state.savedMessages.length = 100;
    store.set('mqtt_saved_msgs', state.savedMessages);
    document.querySelector('.modal-overlay')?.remove(); render();
  };

  window._deleteSavedMsg = async (idx) => {
    const m = state.savedMessages[idx];
    if (!m) return;
    if (await showConfirm('删除', '确定删除？')) { stopPeriodic(m.id); state.savedMessages.splice(idx, 1); store.set('mqtt_saved_msgs', state.savedMessages); render(); }
  };

  window._sendSaved = (idx) => {
    const m = state.savedMessages[idx];
    if (!m || !state.connected) { showToast('未连接'); return; }
    if (state.client) state.client.publish(m.topic, m.content, { qos: m.qos||0 });
    if (state.nativeOk) { try { NativeMQTT.publish(m.topic, m.content, m.qos||0); } catch(e) {} }
    moveToTop(idx);
  };

  window._togglePeriodic = (idx) => {
    const m = state.savedMessages[idx]; if (!m) return;
    if (state.periodicTimers[m.id]) { stopPeriodic(m.id); render(); return; }
    if (!state.connected) { showToast('未连接'); return; }
    if (state.client) state.client.publish(m.topic, m.content, { qos: m.qos||0 });
    if (state.nativeOk) { try { NativeMQTT.publish(m.topic, m.content, m.qos||0); } catch(e) {} }
    state.periodicTimers[m.id] = setInterval(() => {
      if (!state.connected) { stopPeriodic(m.id); render(); return; }
      if (state.client) state.client.publish(m.topic, m.content, { qos: m.qos||0 });
      if (state.nativeOk) { try { NativeMQTT.publish(m.topic, m.content, m.qos||0); } catch(e) {} }
    }, (m.interval || 5) * 1000);
    render();
  };

  function stopPeriodic(id) { if (state.periodicTimers[id]) { clearInterval(state.periodicTimers[id]); delete state.periodicTimers[id]; } }
  function stopAllPeriodic() { Object.keys(state.periodicTimers).forEach(k => stopPeriodic(k)); }
  function moveToTop(idx) {
    const m = state.savedMessages.splice(idx, 1)[0];
    if (m) { state.savedMessages.unshift(m); store.set('mqtt_saved_msgs', state.savedMessages); render(); }
  }
  function formatMsg(text) { try { return JSON.stringify(JSON.parse(text), null, 2); } catch(e) { return text; } }

  // ===== 消息处理 =====
  function onMessage(topic, content) {
    const sub = state.subscriptions.find(s => s.topic === topic);
    if (sub && !sub.enabled) return;
    state.receivedMsgs.push({ id: Date.now(), topic, topicAlias: sub?.alias||'', content, displayContent: formatMsg(content), time: util.formatTime() });
    render();
  }

  // ===== 客户端管理 =====
  window._showAddClient = (editIdx) => {
    const editC = editIdx !== undefined ? state.clients[editIdx] : null;
    const p = editC ? (PROTOCOLS.find(x => x.value === editC.protocol) || PROTOCOLS[3]) : PROTOCOLS[3];
    const isNative = p.value === 'mqtt://' || p.value === 'mqtts://';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML = `
      <div class="modal-content" style="max-height:90vh;overflow-y:auto;">
        <div class="modal-title">${editIdx !== undefined ? '编辑' : '新建'}客户端</div>
        <div class="input-group"><label class="input-label">名称</label><input class="input-field" id="newName" value="${editC?.name||''}"></div>
        <div class="input-group"><label class="input-label">协议</label><select id="newProtocol" style="width:100%;height:44px;border:1px solid #ddd;border-radius:10px;padding:0 12px;font-size:14px;" onchange="var pg=document.getElementById('pathGroup');pg&&(pg.style.display=(this.value==='ws://'||this.value==='wss://')?'':'none')">
          ${PROTOCOLS.map(x => `<option value="${x.value}" ${x.value===p.value?'selected':''}>${x.label} - ${x.desc}</option>`).join('')}
        </select></div>
        <div class="input-row" style="gap:8px;"><div style="flex:3;"><label class="input-label">主机</label><input class="input-field" id="newHost" value="${editC?.host||'broker.emqx.io'}"></div><div style="flex:1;"><label class="input-label">端口</label><input class="input-field" id="newPort" value="${editC?.port||'1883'}" type="number"></div></div>
        <div class="input-group" id="pathGroup" style="display:${isNative?'none':''}"><label class="input-label">WebSocket路径</label><input class="input-field" id="newPath" value="${editC?.path||'/mqtt'}"></div>
        <div class="input-group"><label class="input-label">客户端ID</label><input class="input-field" id="newCid" value="${editC?.clientId||''}" placeholder="留空自动生成"></div>
        <div class="input-group"><label class="input-label">用户名</label><input class="input-field" id="newUser" value="${editC?.username||''}"></div>
        <div class="input-group"><label class="input-label">密码</label><input class="input-field" id="newPass" type="password" value="${editC?.password||''}"></div>
        <div class="modal-buttons">
          <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">取消</button>
          <button class="btn btn-primary" onclick="window._saveClient(${editIdx !== undefined ? editIdx : -1})">${editIdx !== undefined ? '保存修改' : '添加'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  };

  window._editClient = () => { if (state.clients[state.currentIdx]) window._showAddClient(state.currentIdx); };

  window._saveClient = (editIdx) => {
    const name = util.$('newName')?.value?.trim();
    const protocol = util.$('newProtocol')?.value;
    const host = util.$('newHost')?.value?.trim();
    const port = util.$('newPort')?.value?.trim();
    if (!name || !host || !port) { showToast('请填写名称、地址和端口'); return; }
    const isNative = protocol === 'mqtt://' || protocol === 'mqtts://';
    const data = {
      id: Date.now(), name, protocol, host, port: parseInt(port),
      path: isNative ? '' : (util.$('newPath')?.value?.trim() || '/mqtt'),
      clientId: util.$('newCid')?.value?.trim() || 'toolkit_' + Date.now().toString(36),
      username: util.$('newUser')?.value?.trim() || '',
      password: util.$('newPass')?.value || '',
      subscriptions: editIdx >= 0 ? (state.clients[editIdx]?.subscriptions || []) : []
    };
    if (editIdx >= 0) { state.clients[editIdx] = { ...state.clients[editIdx], ...data }; }
    else { state.clients.push(data); state.currentIdx = state.clients.length - 1; }
    store.set('mqtt_clients', state.clients);
    document.querySelector('.modal-overlay')?.remove(); render();
  };

  window._deleteClient = async () => {
    if (!state.clients[state.currentIdx]) return;
    if (await showConfirm('删除', `确定删除"${state.clients[state.currentIdx].name}"吗？`)) {
      doDisconnect();
      state.clients.splice(state.currentIdx, 1);
      store.set('mqtt_clients', state.clients);
      state.currentIdx = Math.min(state.currentIdx, state.clients.length - 1);
      render();
    }
  };

  window._clearMsgs = () => { state.receivedMsgs = []; render(); };

  // ===== 原生 MQTT 回调 =====
  window._mqttOnStatus = (status) => {
    if (status === 'connected') {
      state.connected = true; state.receivedMsgs = []; render();
      state.subscriptions.filter(s => s.enabled).forEach(s => { try { NativeMQTT.subscribe(s.topic, s.qos||0); } catch(e) {} });
    } else {
      state.connected = false; render();
    }
  };
  window._mqttOnMessage = (topic, content) => { onMessage(topic, content); };

  render();
});
