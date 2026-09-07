/**
 * dataCollector.js —— 企业微信智能表格数据收集
 *
 * 职责：
 *   - 把 localStorage('training_progress') 转换为企业微信智能表格所需的字段格式
 *   - 在「有进度增量」时自动/手动提交（仅追加一行）
 *   - 防重复提交：30 秒节流 + 数据签名去重
 *
 * 接入（见 index.html）：config.js → dataCollector.js → onboarding.js
 * 自动触发点（在 onboarding.js 的写入函数末尾调用 checkAndAutoSubmit(moduleName)）：
 *   - 任意模块 completed 由 false 变 true（含「十二条令」两关通关、「职场沟通」全部子任务完成）
 *   - 触发庆祝动效后
 *   - 游戏成绩 game1Time / game2Score 落库后
 * 手动触发：首页「同步所有数据到企业微信」按钮（#wecomSyncBtn）
 *
 * 注意：本文件不持有 Webhook 地址，地址来自 window.WECOM_CONFIG（assets/config.js，已 gitignore）。
 */
(function () {
  'use strict';

  var META_KEY = 'wecom_sync_meta';          // 存放 lastSubmitTime / lastSig，独立于 training_progress
  var THROTTLE_MS = 30000;                   // 30 秒节流

  /* ========================= 数据读取 ========================= */
  function readData() {
    if (window.TrainingProgress && window.TrainingProgress.data) return window.TrainingProgress.data;
    try { return JSON.parse(localStorage.getItem('training_progress') || 'null'); }
    catch (e) { return null; }
  }

  /* ========================= 同步元信息（节流/去重） ========================= */
  function readMeta() {
    try {
      var v = JSON.parse(localStorage.getItem(META_KEY) || 'null');
      return v && typeof v === 'object' ? v : { lastSubmitTime: 0, lastSig: '' };
    } catch (e) { return { lastSubmitTime: 0, lastSig: '' }; }
  }
  function saveMeta(meta) {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {}
  }

  /* ========================= 字段映射工具 ========================= */
  function countViewed(arr) {
    if (!arr || !arr.length) return 0;
    var n = 0;
    for (var i = 0; i < arr.length; i++) if (arr[i]) n++;
    return n;
  }
  function toStatus(m) {
    // 企业微信智能表格「单选(single_select)」值类型为 Option 数组（长度≤1），
    // 每个 Option 用 {text:选项名}；裸串 "完成" 会被 2022013 拒绝。详见官方文档 FIELD_TYPE_SINGLE_SELECT。
    return (m && m.completed) ? [{ text: '完成' }] : [{ text: '未完成' }];
  }
  // 数值字段：未产生（null/undefined）时不写入该列，避免智能表格对空值报错
  function setNum(obj, key, v) { if (typeof v === 'number') obj[key] = v; }

  /**
   * 组装表格「字段ID -> 值」映射（不含时间字段 fzrq8R，用于去重签名）。
   * 字段ID 含义见任务文档；"完成"类字段为 single_select（完成/未完成），数值字段非数字时剔除。
   */
  function buildValues(data) {
    var u = data.userInfo || {};
    var mod = data.modules || {};

    function cv(name) { var m = mod[name]; return m && m.viewedPages ? countViewed(m.viewedPages) : 0; }
    function st(name) { return toStatus(mod[name]); }
    function tw(name, k) { var m = mod[name]; return m ? m[k] : null; }

    var v = {
      // 3.1 员工信息
      'f04Gwj': u.id != null ? u.id : '',
      'ftQMc5': u.name != null ? u.name : '',
      'ftk5Tx': u.department != null ? u.department : '',
      // 入职日期 date_time 类型：值必须是「毫秒时间戳的字符串」（官方文档 FIELD_TYPE_DATE_TIME）
      'fn8TJd': (function () {
        if (!u.hireDate) return null;
        var ms = new Date(u.hireDate).getTime();
        return isNaN(ms) ? null : String(ms);
      })(),

      // 公司简介
      'f7ZLNA': cv('公司简介'),
      'fMz7ph': st('公司简介'),

      // 企业文化与组织架构
      'fllhZZ': cv('企业文化与组织架构'),
      'ftwgpt': st('企业文化与组织架构'),

      // 十二条令
      'fWTCea': tw('十二条令', 'game1Time'),     // number（秒）
      'fRXN4T': tw('十二条令', 'game1Accuracy'),  // number（百分比）
      'fBh0rO': tw('十二条令', 'game2Score'),     // number
      'fiyFC8': tw('十二条令', 'game2Stars'),     // number
      'fID1d8': st('十二条令'),

      // 财务报销与合同审批
      'f0c7Kb': cv('财务报销与合同审批'),
      'fu9UY7': st('财务报销与合同审批'),

      // 职场沟通
      'fRYLGY': cv('职场沟通'),
      'fDaeCJ': st('职场沟通'),

      // 职业道德
      'fMUOxi': cv('职业道德'),   // 职业道德-页数（number）
      'fnsPog': st('职业道德'),    // 职业道德-完成（single_select：完成/未完成）

      // 最后更新时间（text）—— 仅参与实际提交，不参与去重签名
      'fzrq8R': new Date().toISOString()
    };

    // 数值字段：非数字则剔除该键（留空列）；fn8TJd 为 date_time 字符串，不在此列
    setNum(v, 'fWTCea', v['fWTCea']);
    setNum(v, 'fRXN4T', v['fRXN4T']);
    setNum(v, 'fBh0rO', v['fBh0rO']);
    setNum(v, 'fiyFC8', v['fiyFC8']);

    return v;
  }

  // 去重签名：排除时间字段 fzrq8R（每次都变，会让签名永远不同）
  function signature(data) {
    var v = buildValues(data);
    delete v['fzrq8R'];
    return JSON.stringify(v);
  }

  function buildPayload(data) {
    return { add_records: [{ values: buildValues(data) }] };
  }

  /* ========================= 错误码 -> 文案 ========================= */
  // 企业微信接口错误：detail 为数字 errcode（如 2022013 字段类型错误）
  // 代理不可达：detail 为 'HTTP_405' 等字符串，说明当前本地服务没有同步代理路由
  function webhookErrMessage(detail) {
    if (detail === 'HTTP_405') {
      return '同步服务不可用：当前本地服务没有同步代理，请改用项目自带的 server.js / start.bat 启动页面（不要用 Vite、Live Server、python -m http.server 等普通静态服务器）';
    }
    if (typeof detail === 'string' && detail.indexOf('HTTP_') === 0) {
      return '同步服务异常（' + detail + '）：请确认通过项目自带的 server.js / start.bat 启动页面';
    }
    return '同步失败，错误码：' + (detail != null ? detail : '?');
  }

  function messageFor(err) {
    switch (err && err.code) {
      case 'NO_IDENTITY': return '请先完成身份录入';
      case 'NO_CONFIG':   return '未配置企业微信同步地址';
      case 'NEED_SERVER': return '请通过本地服务(http)打开后使用同步（双击 index.html 无法同步）';
      case 'TOO_FREQUENT':return '提交过于频繁，请稍后再试';
      case 'NO_CHANGE':   return '没有新进度需要同步';
      case 'NETWORK':     return '网络异常，请检查网络连接后重试';
      case 'WEBHOOK_ERR': return webhookErrMessage(err.detail);
      default:            return '同步失败，请重试';
    }
  }

  /* ========================= 核心提交 ========================= */
  /**
   * @param {Object} [opts] { force: true 时跳过节流与去重（手动按钮一般不强跳） }
   * @returns {Promise} resolve(响应JSON) / reject({code, detail})
   */
  function submitToWecom(opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      // file:// 下没有同源服务可代理，直接给出明确引导，避免无意义的网络报错
      if (location.protocol === 'file:') { reject({ code: 'NEED_SERVER' }); return; }

      var cfg = window.WECOM_CONFIG;
      // 优先走同源代理 endpoint（server.js 转发，规避 CORS）；旧配置仅含 webhook 时退回直连
      var target = (cfg && cfg.endpoint) || (cfg && cfg.webhook);
      if (!target) { reject({ code: 'NO_CONFIG' }); return; }

      var data = readData();
      if (!data || !data.userInfo) { reject({ code: 'NO_IDENTITY' }); return; }

      var meta = readMeta();
      var now = Date.now();
      if (!opts.force && now - (meta.lastSubmitTime || 0) < THROTTLE_MS) {
        reject({ code: 'TOO_FREQUENT' }); return;
      }
      var sig = signature(data);
      if (!opts.force && sig === (meta.lastSig || '')) {
        reject({ code: 'NO_CHANGE' }); return;
      }

      var body = JSON.stringify(buildPayload(data));

      fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body
      }).then(function (res) {
        return res.text().then(function (txt) {
          var json = null;
          try { json = txt ? JSON.parse(txt) : null; } catch (e) { json = null; }
          return { ok: res.ok, status: res.status, json: json };
        });
      }).then(function (res) {
        var errcode = res.json && typeof res.json.errcode !== 'undefined' ? res.json.errcode : (res.ok ? 0 : ('HTTP_' + res.status));
        if (errcode !== 0) {
          reject({ code: 'WEBHOOK_ERR', detail: errcode });
          return;
        }
        // 成功：记录节流时间与签名
        meta.lastSubmitTime = now;
        meta.lastSig = sig;
        saveMeta(meta);
        resolve(res.json || { errcode: 0 });
      }).catch(function (err) {
        // file:// 下跨域会被浏览器拦截，进入此分支
        reject({ code: 'NETWORK', detail: String(err) });
      });
    });
  }

  /* ========================= 自动提交判定 ========================= */
  function shouldAutoSubmit(moduleName, data) {
    if (!data || !data.userInfo) return false;          // 未录入身份不自动上报
    var meta = readMeta();
    if (Date.now() - (meta.lastSubmitTime || 0) < THROTTLE_MS) return false;
    if (signature(data) === (meta.lastSig || '')) return false;  // 无新进度不重复上报
    return true;
  }

  /** 数据变化后调用：满足「有身份 + 未节流 + 有新进度」才真正提交（自动模式静默处理失败） */
  function checkAndAutoSubmit(moduleName) {
    try {
      var data = readData();
      if (!data || !data.userInfo) return;
      if (!window.WECOM_CONFIG || (!window.WECOM_CONFIG.endpoint && !window.WECOM_CONFIG.webhook)) return;
      if (!shouldAutoSubmit(moduleName, data)) return;
      submitToWecom().catch(function () { /* 自动模式静默：失败留待下次有增量或手动同步 */ });
    } catch (e) { /* 忽略自动提交异常，绝不阻塞主流程 */ }
  }

  /* ========================= 首页同步按钮 ========================= */
  function bindSyncButton() {
    var btn = document.getElementById('wecomSyncBtn');
    var status = document.getElementById('wecomSyncStatus');
    if (!btn) return;

    function setStatus(text, kind) {
      if (!status) return;
      status.textContent = text || '';
      status.className = 'home-sync-status' + (kind ? ' ' + kind : '');
    }
    function hhmmss() {
      var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
      return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }

    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      var data = readData();
      if (!data || !data.userInfo) {
        setStatus('请先完成身份录入', 'err');
        return;
      }
      btn.disabled = true;
      var prev = btn.textContent;
      btn.textContent = '同步中…';
      setStatus('', '');

      submitToWecom().then(function () {
        setStatus('已于 ' + hhmmss() + ' 同步', 'ok');
      }).catch(function (err) {
        setStatus(messageFor(err), 'err');
      }).then(function () {
        btn.disabled = false;
        btn.textContent = prev;
      });
    });
  }

  /* ========================= 导出 ========================= */
  window.DataCollector = {
    submitToWecom: submitToWecom,
    shouldAutoSubmit: shouldAutoSubmit,
    checkAndAutoSubmit: checkAndAutoSubmit,
    buildValues: buildValues,
    buildPayload: buildPayload,
    bindSyncButton: bindSyncButton
  };

  // 按钮为静态 DOM，文档就绪后绑定；若已就绪则立即绑定
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSyncButton);
  } else {
    bindSyncButton();
  }
})();
