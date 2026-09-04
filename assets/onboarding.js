/* =============================================================================
 * 出口易 · 新人培训平台 —— 身份录入 & 学习进度（纯前端 / localStorage）
 * 统一存储键：training_progress（数据结构见下方 defaultData）
 * 命名空间：onb-*（DOM 类） / ONB、TrainingProgress（全局调试与业务入口）
 * ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------ 存储键 ------------------------------ */
  var STORAGE_KEY = 'training_progress';
  var LEGACY_PROFILE = 'onb.v1.profile';   // 旧版身份（迁移用）
  var LEGACY_PROGRESS = 'onb.v1.progress'; // 旧版进度（迁移用）
  var ETH_KEY = 'ethics-training-state';   // 职业道德模块自有存档

  var DEPTS = ['战略委员办', '总裁办', '财务部', '技术部', '业务发展部', '产品及运营', '其他'];

  /* --------------------- 模块 / 子页面映射（view 号即页面标识） --------------------- */
  var MODULES = [
    { id: '40', name: '公司简介', desc: '了解公司发展历程、业务范围与全球布局', target: '40', tint: 4, views: ['40', '41', '42', '43'] },
    { id: '31', name: '企业文化与组织架构', desc: '理解核心价值观、使命愿景与组织体系', target: '31', tint: 1, views: ['31', '33'] },
    { id: '15', name: '十二条令', desc: '通过情景判断游戏掌握公司十二条令', target: '15', tint: 3, views: ['game'] },
    { id: '1', name: '财务报销与合同审批', desc: '熟悉报销流程、审批规范与常见问题', target: '1', tint: 2, views: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'] },
    { id: '19', name: '职场沟通', desc: '学习邮件、即时通讯与跨部门协作技巧', target: '19', tint: 5, views: ['16', '17', '18', '19', '20', '21'] },
    { id: '22', name: '职业道德', desc: '识别信息保密、职业边界与利益冲突红线', target: '22', tint: 6, views: ['eth:1', 'eth:2', 'eth:3', 'eth:4'] }
  ];
  /* 职场沟通内部三类：知识页 / 互动游戏 / 预热测验（下标对应 views 数组） */
  var COMM = { knowledge: [0, 1, 4, 5], interactive: 2, quiz: 3 };

  var PAGE_INDEX = {};  // 页面标识 -> { mod: 模块名, idx: 下标 }
  MODULES.forEach(function (m) {
    m.views.forEach(function (p, i) {
      if (p === 'game') return;
      PAGE_INDEX[p] = { mod: m.name, idx: i };
    });
  });

  /* ------------------------------ 工具 ------------------------------ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function readJSON(key, def) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function falses(n) { var a = []; for (var i = 0; i < n; i++) a.push(false); return a; }

  /* ========================= 数据层（training_progress） ========================= */
  function defaultData() {
    return {
      userInfo: null, // { name, id, department, hireDate }
      modules: {
        '公司简介': { totalPages: 4, viewedPages: falses(4), completed: false, lastUpdate: null },
        '企业文化与组织架构': { totalPages: 2, viewedPages: falses(2), completed: false, lastUpdate: null },
        '十二条令': { game1Time: null, game1Accuracy: null, game2Score: null, game2Stars: null, stages: 0, completed: false, lastUpdate: null },
        '财务报销与合同审批': { totalPages: 14, viewedPages: falses(14), completed: false, lastUpdate: null },
        '职场沟通': { totalPages: 6, viewedPages: falses(6), quizCorrect: null, quizTotal: null, knowledgeViewed: false, interactiveEnded: false, completed: false, lastUpdate: null },
        '职业道德': { totalPages: 4, viewedPages: falses(4), completed: false, lastUpdate: null }
      }
    };
  }

  var data = null;

  /** 从 localStorage 加载数据；无数据或结构缺失时按默认结构补齐 */
  function loadData() {
    var d = readJSON(STORAGE_KEY, null);
    var def = defaultData();
    if (!d || typeof d !== 'object') d = def;
    if (!d.modules || typeof d.modules !== 'object') d.modules = {};
    // 逐模块规范化：补齐缺失字段、对齐 viewedPages 长度
    Object.keys(def.modules).forEach(function (name) {
      var src = d.modules[name] || {};
      var tpl = def.modules[name];
      var m = {};
      Object.keys(tpl).forEach(function (k) { m[k] = (typeof tpl[k] === 'object' && tpl[k] !== null) ? tpl[k].slice() : tpl[k]; });
      Object.keys(src).forEach(function (k) {
        if (src[k] === undefined || src[k] === null) return;
        if (k === 'viewedPages' && Array.isArray(src[k])) {
          m.viewedPages = falses(tpl.totalPages);
          for (var i = 0; i < Math.min(src[k].length, tpl.totalPages); i++) m.viewedPages[i] = !!src[k][i];
        } else if (k === 'totalPages') {
          m.totalPages = Number(src[k]) || tpl.totalPages;
        } else {
          m[k] = src[k];
        }
      });
      m.totalPages = tpl.totalPages; // 以当前页面实际数量为准，避免历史数据错位
      if (tpl.totalPages) {
        m.viewedPages = (m.viewedPages && m.viewedPages.length === tpl.totalPages) ? m.viewedPages : falses(tpl.totalPages);
      }
      d.modules[name] = m;
    });
    // 清理已废弃的模块（如早期的第 5 个职业道德模块）
    Object.keys(d.modules).forEach(function (name) { if (!def.modules[name]) delete d.modules[name]; });
    if (!d.userInfo) d.userInfo = null;
    return d;
  }

  /** 持久化到 localStorage（同步写入） */
  function saveData(d) {
    d = d || data;
    if (!d) return;
    writeJSON(STORAGE_KEY, d);
  }

  /** 首次访问：把旧版 onb.v1.* 数据迁移到 training_progress */
  function migrateLegacy() {
    var legacyProfile = readJSON(LEGACY_PROFILE, null);
    var legacyProgress = readJSON(LEGACY_PROGRESS, null);
    if (legacyProfile && !data.userInfo) {
      data.userInfo = {
        name: legacyProfile.name || '',
        id: legacyProfile.empId || '',
        department: legacyProfile.dept || '',
        hireDate: legacyProfile.hireDate || ''
      };
    }
    if (legacyProgress && legacyProgress.pages) {
      Object.keys(legacyProgress.pages).forEach(function (page) {
        var pi = PAGE_INDEX[page];
        if (pi) {
          data.modules[pi.mod].viewedPages[pi.idx] = true;
          data.modules[pi.mod].lastUpdate = new Date().toISOString();
        } else if (page === 'game') {
          data.modules['十二条令'].completed = true;
        }
      });
      syncDerivedFlags();
      Object.keys(data.modules).forEach(function (n) { recomputeCompleted(n); });
    }
    if (legacyProfile || legacyProgress) saveData(data);
  }

  function getUserInfo() { return data.userInfo; }

  function setUserInfo(name, id, department, hireDate) {
    data.userInfo = { name: name, id: id, department: department, hireDate: hireDate, updatedAt: new Date().toISOString() };
    saveData(data);
    // 同步写一份旧版键，保证任何旧逻辑读到的数据一致
    writeJSON(LEGACY_PROFILE, { name: name, empId: id, dept: department, hireDate: hireDate });
    return data.userInfo;
  }

  /** 更新指定模块进度，自动刷新 lastUpdate */
  function updateModuleProgress(moduleName, updates) {
    var m = data.modules[moduleName];
    if (!m) return null;
    Object.keys(updates || {}).forEach(function (k) { m[k] = updates[k]; });
    m.lastUpdate = new Date().toISOString();
    if (moduleName === '职场沟通') syncDerivedFlags();
    if (m.totalPages) recomputeCompleted(moduleName);
    saveData(data);
    updateUI();
    maybeCelebrate(moduleName);
    return m;
  }

  /** 标记某个子页面已浏览（pageIndex 从 0 开始） */
  function markPageViewed(moduleName, pageIndex) {
    var m = data.modules[moduleName];
    if (!m || !m.totalPages || pageIndex < 0 || pageIndex >= m.totalPages) return false;
    if (m.viewedPages[pageIndex]) return false;
    m.viewedPages[pageIndex] = true;
    m.lastUpdate = new Date().toISOString();
    if (moduleName === '职场沟通') syncDerivedFlags();
    recomputeCompleted(moduleName);
    saveData(data);   // 展示「页面已学完」提示的同时写入
    updateUI();
    return true;
  }

  function isModuleCompleted(moduleName) {
    var m = data.modules[moduleName];
    return !!(m && m.completed);
  }

  /** 整体进度：已浏览子页面 + 已完成的特殊模块（十二条令） */
  function getOverallProgress() {
    var viewed = 0, total = 0, completedModules = 0, totalModules = 0;
    Object.keys(data.modules).forEach(function (name) {
      var m = data.modules[name];
      totalModules++;
      if (m.completed) completedModules++;
      if (m.totalPages) {
        total += m.totalPages;
        for (var i = 0; i < m.viewedPages.length; i++) if (m.viewedPages[i]) viewed++;
      } else {
        total += 1;
        if (m.completed) viewed += 1;
      }
    });
    return {
      viewed: viewed,
      total: total,
      percent: total ? Math.round(viewed / total * 100) : 0,
      completedModules: completedModules,
      totalModules: totalModules
    };
  }

  /* 职场沟通：由 viewedPages 推导 knowledgeViewed / interactiveEnded */
  function syncDerivedFlags() {
    var m = data.modules['职场沟通'];
    if (!m) return;
    m.knowledgeViewed = COMM.knowledge.every(function (i) { return m.viewedPages[i]; });
    m.interactiveEnded = !!m.viewedPages[COMM.interactive];
  }

  /* 有 totalPages 的模块：全部浏览完即视为完成 */
  function recomputeCompleted(name) {
    var m = data.modules[name];
    if (!m || !m.totalPages) return;
    var all = m.viewedPages.every(Boolean);
    if (all && !m.completed) m.completed = true;
  }

  /* --------------------- 页面标识 -> 模块 / 下标（供 UI 与游戏回调） --------------------- */
  function isDone(page) {
    if (page === 'game') return isModuleCompleted('十二条令');
    var pi = PAGE_INDEX[page];
    if (!pi) return false;
    var m = data.modules[pi.mod];
    return !!(m && m.viewedPages[pi.idx]);
  }
  function moduleStat(meta) {
    var m = data.modules[meta.name];
    if (!m) return { done: 0, total: 0, completed: false };
    if (!m.totalPages) return { done: m.completed ? 1 : 0, total: 1, completed: !!m.completed };
    var done = 0;
    for (var i = 0; i < m.viewedPages.length; i++) if (m.viewedPages[i]) done++;
    return { done: done, total: m.totalPages, completed: !!m.completed };
  }

  /* --------------------------- 当前页面 / 模块 --------------------------- */
  function currentPage() {
    var v = $('.view.active');
    if (!v) return null;
    var id = v.getAttribute('data-view');
    if (id === '22') {
      var panel = $('.view-ethics .module-panel.active');
      var m = panel && /^mod-(\d+)$/.exec(panel.id);
      var n = m ? m[1] : '1';
      return 'eth:' + (n === '5' ? '4' : n);
    }
    if (id === '15') return 'game';
    return id;
  }
  function currentModule() {
    var p = currentPage();
    if (!p) return null;
    var pi = PAGE_INDEX[p];
    var name = pi ? pi.mod : (p === 'game' ? '十二条令' : null);
    if (!name) return null;
    for (var i = 0; i < MODULES.length; i++) if (MODULES[i].name === name) return MODULES[i];
    return null;
  }

  /* ------------------------------ 标记（对外） ------------------------------ */
  function markPage(page) {
    if (!page) return false;
    if (page === 'game') {
      if (isModuleCompleted('十二条令')) return false;
      updateModuleProgress('十二条令', { completed: true });
      showToast('页面已学完 ✅');
      return true;
    }
    var pi = PAGE_INDEX[page];
    if (!pi) return false;
    var changed = markPageViewed(pi.mod, pi.idx);
    if (changed) {
      showToast('页面已学完 ✅');
      maybeCelebrate(pi.mod);
    }
    return changed;
  }

  /* ---------------------------- 完成庆祝（仅本次会话） ---------------------------- */
  var celebratedInSession = {};
  function maybeCelebrate(moduleName) {
    if (!isModuleCompleted(moduleName)) return;
    if (celebratedInSession[moduleName]) return;
    celebratedInSession[moduleName] = true;
    setTimeout(function () { celebrate(moduleName); }, 320);
  }

  /* ------------------------------ Toast ------------------------------ */
  var toastHost = null;
  function getToastHost() {
    if (toastHost && document.body.contains(toastHost)) return toastHost;
    toastHost = document.createElement('div');
    toastHost.className = 'onb-toast-host';
    document.body.appendChild(toastHost);
    return toastHost;
  }
  function showToast(text) {
    var host = getToastHost();
    var t = document.createElement('div');
    t.className = 'onb-toast';
    t.innerHTML = '<span class="onb-toast-ico">✅</span><span>' + esc(text) + '</span>';
    host.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 340);
    }, 2200);
  }

  /* --------------------------- 模块完成庆祝动效 --------------------------- */
  function celebrate(name) {
    var host = document.createElement('div');
    host.className = 'onb-party';
    var conf = '';
    var colors = ['#A8D934', '#5F7F1D', '#2E4FC0', '#2FA5BC', '#F2A33C', '#E8657F', '#17A34A'];
    for (var i = 0; i < 18; i++) {
      conf += '<i class="onb-conf" style="left:' + (5 + Math.random() * 90) + '%;' +
        'animation-delay:' + (Math.random() * 0.7).toFixed(2) + 's;' +
        'background:' + colors[i % colors.length] + ';"></i>';
    }
    host.innerHTML =
      '<div class="onb-party-card">' +
      '<div class="onb-party-emoji">🎉</div>' +
      '<div class="onb-party-title">恭喜完成 ' + esc(name) + ' 模块！</div>' +
      '<div class="onb-party-sub">继续保持，下个模块等你 👏</div>' +
      '</div>' + conf;
    document.body.appendChild(host);
    requestAnimationFrame(function () { host.classList.add('show'); });
    setTimeout(function () {
      host.classList.remove('show');
      setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); }, 460);
    }, 3000);
  }

  /* ---------------------------- 身份录入弹窗 ---------------------------- */
  function buildModal() {
    if ($('#onbMask')) return;
    var mask = document.createElement('div');
    mask.className = 'onb-mask';
    mask.id = 'onbMask';
    var opts = DEPTS.map(function (d) { return '<option value="' + esc(d) + '">' + esc(d) + '</option>'; }).join('');
    mask.innerHTML =
      '<div class="onb-modal" role="dialog" aria-modal="true" aria-labelledby="onbTitle">' +
      '<div class="onb-modal-head">' +
      '<div class="onb-modal-emoji">🎓</div>' +
      '<h2 id="onbTitle">欢迎参加新员工入职培训</h2>' +
      '<p>先留下你的信息，我们会为你记录学习进度</p>' +
      '</div>' +
      '<form class="onb-form" id="onbForm" novalidate>' +
      '<label class="onb-field"><span>姓名</span><input type="text" name="name" placeholder="请输入真实姓名" autocomplete="name"></label>' +
      '<label class="onb-field"><span>工号</span><input type="text" name="empId" placeholder="如 BFE2026001"></label>' +
      '<label class="onb-field"><span>部门</span><select name="dept"><option value="">请选择部门</option>' + opts + '</select></label>' +
      '<label class="onb-field"><span>入职日期</span><input type="date" name="hireDate"></label>' +
      '<p class="onb-err" id="onbErr" hidden></p>' +
      '<button class="onb-submit" type="submit">开始学习</button>' +
      '<p class="onb-tip">信息仅保存在本机浏览器，不会上传</p>' +
      '</form>' +
      '</div>';
    document.body.appendChild(mask);

    var form = $('#onbForm', mask);
    var err = $('#onbErr', mask);
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var empId = form.empId.value.trim();
      var dept = form.dept.value;
      var hireDate = form.hireDate.value;
      if (!name) { showErr('请填写姓名'); form.name.focus(); return; }
      if (!empId) { showErr('请填写工号'); form.empId.focus(); return; }
      if (!dept) { showErr('请选择部门'); form.dept.focus(); return; }
      if (!hireDate) { showErr('请选择入职日期'); form.hireDate.focus(); return; }
      setUserInfo(name, empId, dept, hireDate);
      closeModal();
      refreshUser();
      updateUI();
      showToast('欢迎你，' + name + '！开始学习吧 🎈');
    });
    function showErr(msg) { err.textContent = msg; err.hidden = false; }

    mask.addEventListener('click', function (e) { if (e.target === mask) e.stopPropagation(); });
  }
  function openModal() {
    var mask = $('#onbMask');
    if (!mask) return;
    document.body.classList.add('onb-lock');
    requestAnimationFrame(function () { mask.classList.add('show'); });
    setTimeout(function () { var i = mask.querySelector('input[name="name"]'); if (i) i.focus(); }, 260);
  }
  function closeModal() {
    var mask = $('#onbMask');
    if (!mask) return;
    mask.classList.remove('show');
    document.body.classList.remove('onb-lock');
    setTimeout(function () { if (mask.parentNode) mask.parentNode.removeChild(mask); }, 380);
  }
  /* 把已保存的身份信息回填到表单（必须在 buildModal 之后调用） */
  function fillForm(user) {
    var form = $('#onbForm');
    if (!form || !user) return;
    form.name.value = user.name || '';
    form.empId.value = user.id || user.empId || '';
    form.dept.value = user.department || user.dept || '';
    form.hireDate.value = user.hireDate || '';
  }

  /* -------------------------- 顶栏：状态圆点 -------------------------- */
  function buildTopBadges() {
    $$('.menu-item[data-topnav]').forEach(function (btn) {
      if (btn.dataset.topnav === 'home') return;
      if (btn.querySelector('.mod-dot')) return;
      var dot = document.createElement('span');
      dot.className = 'mod-dot';
      dot.setAttribute('aria-hidden', 'true');
      var label = document.createElement('span');
      label.className = 'mi-label';
      label.textContent = btn.textContent.trim();
      btn.textContent = '';
      btn.appendChild(dot);
      btn.appendChild(label);
    });
  }
  function updateTopBadges() {
    var curMod = currentModule();
    MODULES.forEach(function (m) {
      var btn = $('.menu-item[data-topnav="' + m.id + '"]');
      if (!btn) return;
      var dot = btn.querySelector('.mod-dot');
      if (!dot) return;
      var st = moduleStat(m);
      var isCurrent = curMod && curMod.name === m.name;
      var cls, tip;
      if (st.completed || (st.total && st.done >= st.total)) { cls = 'done'; tip = '已完成'; }
      else if (isCurrent || st.done > 0) {
        cls = 'doing';
        tip = (isCurrent ? '进行中' : '学习中') + (st.total ? ' · 进度 ' + st.done + '/' + st.total : '');
      }
      else { cls = 'todo'; tip = '未开始'; }
      dot.className = 'mod-dot ' + cls;
      dot.setAttribute('data-tip', tip);
    });
  }

  /* -------------------------- 顶栏：学员与重置 -------------------------- */
  var userResetArmed = false;
  function buildUserMenu() {
    var inner = $('.topbar-inner');
    if (!inner || $('#onbUser')) return;
    var wrap = document.createElement('div');
    wrap.className = 'onb-user';
    wrap.id = 'onbUser';
    wrap.innerHTML =
      '<button class="onb-user-btn" type="button" id="onbUserBtn" aria-haspopup="true" aria-expanded="false">' +
      '<span class="onb-avatar" id="onbAvatar">新</span>' +
      '<span class="onb-user-name" id="onbUserName">新同学</span>' +
      '<span class="onb-caret">▾</span>' +
      '</button>' +
      '<div class="onb-menu" id="onbMenu" hidden>' +
      '<div class="onb-menu-info" id="onbMenuInfo"></div>' +
      '<button class="onb-menu-item" type="button" id="onbHome">← 返回首页</button>' +
      '<button class="onb-menu-item" type="button" id="onbEdit">修改个人信息</button>' +
      '<button class="onb-menu-item danger" type="button" id="onbReset">重置学习进度</button>' +
      '</div>';
    inner.appendChild(wrap);

    var btn = $('#onbUserBtn'), menu = $('#onbMenu');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open) { userResetArmed = false; $('#onbReset').textContent = '重置学习进度'; }
    });
    document.addEventListener('click', function () {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    });
    menu.addEventListener('click', function (e) { e.stopPropagation(); });

    $('#onbReset').addEventListener('click', function () {
      if (!userResetArmed) {
        userResetArmed = true;
        this.textContent = '再点一次确认重置';
        this.classList.add('armed');
        setTimeout(function () {
          if (!userResetArmed) return;
          userResetArmed = false;
          var r = $('#onbReset');
          if (r) { r.textContent = '重置学习进度'; r.classList.remove('armed'); }
        }, 3000);
        return;
      }
      resetAll();
    });

    $('#onbEdit').addEventListener('click', function () {
      menu.hidden = true;
      buildModal();          // 先创建表单
      fillForm(getUserInfo()); // 再把已保存信息回填
      openModal();
    });

    $('#onbHome').addEventListener('click', function () {
      menu.hidden = true;
      if (typeof window.gotoView === 'function') window.gotoView('home');
    });
    // 左上角 Logo：任何模块页面点击都可回到首页
    var brand = $('.brand');
    if (brand) brand.addEventListener('click', function () {
      if (typeof window.gotoView === 'function') window.gotoView('home');
    });
  }
  function refreshUser() {
    var nameEl = $('#onbUserName'), av = $('#onbAvatar'), info = $('#onbMenuInfo');
    if (!nameEl) return;
    var u = getUserInfo();
    var name = u && u.name ? u.name : '新同学';
    nameEl.textContent = name;
    av.textContent = name.charAt(0);
    if (info) {
      info.innerHTML = u
        ? '<b>' + esc(u.name) + '</b><span>' + esc(u.department || '') + ' · ' + esc(u.id || '') + '</span><span class="dim">入职 ' + esc(u.hireDate || '') + '</span>'
        : '<span class="dim">尚未填写个人信息</span>';
    }
  }

  /* -------------------------- 侧栏：指示器与进度 -------------------------- */
  function makeDot() {
    var d = document.createElement('span');
    d.className = 'pg-dot';
    return d;
  }
  function buildSidebar() {
    $$('.nav-leaf[data-nav]').forEach(function (leaf) {
      if (leaf.querySelector('.pg-dot')) return;
      leaf.insertBefore(makeDot(), leaf.firstChild);
    });
    $$('.sidebar-ethics .nav-group').forEach(function (g) {
      var leaf = g.querySelector('[data-eth-module]');
      if (!leaf) return;
      var m = leaf.getAttribute('data-eth-module');
      if (m === 'exam' || !/^\d+$/.test(String(m))) return;
      var head = g.querySelector('.nav-group-head');
      if (!head || head.querySelector('.pg-dot')) return;
      var num = head.querySelector('.nav-num');
      var dot = makeDot();
      dot.setAttribute('data-eth-dot', m);
      if (num && num.nextSibling) head.insertBefore(dot, num.nextSibling);
      else head.insertBefore(dot, head.firstChild);
    });
    $$('.sidebar').forEach(function (sb) {
      if (sb.querySelector('.sidebar-progress')) return;
      var box = document.createElement('div');
      box.className = 'sidebar-progress';
      box.innerHTML = '<div class="sp-text"></div><div class="sp-bar"><i></i></div>';
      var title = sb.querySelector('.sidebar-title');
      if (title && title.nextSibling) sb.insertBefore(box, title.nextSibling);
      else sb.insertBefore(box, sb.firstChild);
    });
  }
  function updateSidebar() {
    var cur = currentPage();
    $$('.nav-leaf[data-nav]').forEach(function (leaf) {
      var dot = leaf.querySelector('.pg-dot');
      if (!dot) return;
      var p = leaf.getAttribute('data-nav');
      dot.className = 'pg-dot ' + (isDone(p) ? 'is-done' : (p === cur ? 'is-current' : ''));
    });
    $$('[data-eth-dot]').forEach(function (dot) {
      var p = 'eth:' + dot.getAttribute('data-eth-dot');
      dot.className = 'pg-dot ' + (isDone(p) ? 'is-done' : (p === cur ? 'is-current' : ''));
    });
    var meta = currentModule();
    $$('.sidebar').forEach(function (sb) {
      var box = sb.querySelector('.sidebar-progress');
      if (!box || !meta) return;
      var st = moduleStat(meta);
      var pct = st.total ? Math.round(st.done / st.total * 100) : 0;
      box.querySelector('.sp-text').innerHTML = '本模块进度：<b>' + st.done + '/' + st.total + '</b> 已完成';
      var bar = box.querySelector('.sp-bar i');
      if (bar) bar.style.width = pct + '%';
    });
  }

  /* ------------------------------ 首页 ------------------------------ */
  /* Lucide 风格线性图标（严禁 emoji 图标） */
  var ICONS = {
    '40': '<svg viewBox="0 0 24 24" stroke="currentColor"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>',
    '31': '<svg viewBox="0 0 24 24" stroke="currentColor"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>',
    '15': '<svg viewBox="0 0 24 24" stroke="currentColor"><path d="M11 3h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1"/><path d="M11 3a1 1 0 0 1-1 1H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h1"/><path d="M8 10h3"/><path d="M8 14h3"/></svg>',
    '1': '<svg viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><path d="M21 7H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z"/><path d="M16 12h.01"/></svg>',
    '19': '<svg viewBox="0 0 24 24" stroke="currentColor"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
    '22': '<svg viewBox="0 0 24 24" stroke="currentColor"><path d="M12 3v18"/><path d="M3 21h18"/><path d="M3 7h18"/><path d="M6 7l-3 6a3 3 0 0 0 6 0z"/><path d="M18 7l-3 6a3 3 0 0 0 6 0z"/></svg>'
  };
  function sortHomeModules() {
    var rank = function (st) {
      if (st.completed || (st.total && st.done >= st.total)) return 1; // 已完成
      if (st.done > 0) return 0;                                       // 进行中
      return 2;                                                        // 未开始
    };
    return MODULES.slice().sort(function (a, b) {
      var ra = rank(moduleStat(a)), rb = rank(moduleStat(b));
      if (ra !== rb) return ra - rb;
      return MODULES.indexOf(a) - MODULES.indexOf(b); // 同状态保持原顺序
    });
  }
  function homeCardHtml(meta, idx) {
    var st = moduleStat(meta);
    var m = data.modules[meta.name] || {};
    var cls, status;
    if (st.completed || (st.total && st.done >= st.total)) { cls = 'is-done'; status = '已完成'; }
    else if (st.done > 0) { cls = 'is-doing'; status = '进行中'; }
    else { cls = 'is-todo'; status = '未开始'; }
    var pct = st.total ? Math.round(st.done / st.total * 100) : (st.completed ? 100 : 0);
    var extra = '';
    if (meta.name === '十二条令') {
      extra = '游戏总分 ' + (m.game2Score == null ? '—' : esc(m.game2Score)) +
        ' · ' + (m.game2Stars == null ? '—' : esc(m.game2Stars)) + '★';
    } else if (meta.name === '职场沟通') {
      extra = '答对 ' + (m.quizCorrect == null ? '—' : esc(m.quizCorrect)) +
        (m.quizTotal ? ' / ' + esc(m.quizTotal) : '') + ' 题';
    }
    var icon = ICONS[meta.id] || '';
    return '<button class="home-card t' + (meta.tint || 1) + ' ' + cls + '" type="button" data-home-target="' + esc(meta.target) +
      '" style="animation-delay:' + (idx * 80) + 'ms">' +
      '<div class="home-card-head">' +
        '<h3 class="home-card-name">' + esc(meta.name) + '</h3>' +
        '<span class="home-card-ico" aria-hidden="true">' + icon + '</span>' +
      '</div>' +
      '<p class="home-card-desc">' + esc(meta.desc || '') + '</p>' +
      '<div class="home-card-progress">' +
        '<div class="home-card-bar"><i data-w="' + pct + '"></i></div>' +
        '<span class="home-card-pct">' + pct + '%</span>' +
      '</div>' +
      '<div class="home-card-foot">' +
        '<span class="home-card-status">' + status + '</span>' +
        (extra ? '<span class="home-card-extra">' + extra + '</span>' : '') +
      '</div>' +
      '<div class="home-card-art" aria-hidden="true"></div>' +
      '</button>';
  }
  function continueTarget() {
    for (var i = 0; i < MODULES.length; i++) {
      var st = moduleStat(MODULES[i]);
      if (!st.completed && st.done > 0) return { meta: MODULES[i], n: st.done + 1 };
    }
    for (var j = 0; j < MODULES.length; j++) {
      var s2 = moduleStat(MODULES[j]);
      if (s2.done === 0) return { meta: MODULES[j], n: 1 };
    }
    return { meta: MODULES[0], n: 1 };
  }
  function updateHome() {
    var grid = $('#homeGrid');
    if (!grid) return;
    var u = getUserInfo();
    var displayName = u && u.name ? u.name : '新同学';
    var el;
    if ((el = $('#homeGreeting'))) el.textContent = '👋 欢迎回来，' + displayName + '！';
    if ((el = $('#homeUserName'))) el.textContent = displayName;
    if ((el = $('#homeUserId'))) el.textContent = '工号 ' + (u && u.id ? u.id : '—');
    if ((el = $('#homeAvatar'))) el.textContent = displayName.charAt(0);
    var ov = getOverallProgress();
    if ((el = $('#homeProgressText'))) el.innerHTML = '学习进度：已完成 <b>' + ov.viewed + '</b> / ' + ov.total + ' 个子页面';
    if ((el = $('#homeProgressBar'))) { el.style.width = '0'; requestAnimationFrame(function () { el.style.width = ov.percent + '%'; }); }
    // 卡片：按状态排序（进行中 → 已完成 → 未开始）+ 错峰淡入 + 进度条动画
    grid.innerHTML = sortHomeModules().map(homeCardHtml).join('');
    var bars = grid.querySelectorAll('.home-card-bar i');
    requestAnimationFrame(function () {
      bars.forEach(function (b) { b.style.width = (b.getAttribute('data-w') || 0) + '%'; });
    });
    // 继续学习按钮
    var c = continueTarget();
    var btn = $('#homeContinue');
    if (btn) {
      btn.textContent = '▶ 继续学习：' + c.meta.name + '（第 ' + c.n + ' 节）';
      btn.setAttribute('data-target', c.meta.target);
    }
  }
  function bindHome() {
    var grid = $('#homeGrid');
    if (grid && !grid.getAttribute('data-bound')) {
      grid.setAttribute('data-bound', '1');
      grid.addEventListener('click', function (e) {
        var card = e.target && e.target.closest ? e.target.closest('.home-card') : null;
        if (!card) return;
        var t = card.getAttribute('data-home-target');
        if (t && typeof window.gotoView === 'function') window.gotoView(t);
      });
    }
    var cbtn = $('#homeContinue');
    if (cbtn && !cbtn.getAttribute('data-bound')) {
      cbtn.setAttribute('data-bound', '1');
      cbtn.addEventListener('click', function () {
        var t = cbtn.getAttribute('data-target');
        if (t && typeof window.gotoView === 'function') window.gotoView(t);
      });
    }
    // 头像下拉菜单
    var user = $('#homeUser');
    var menu = $('#homeUserMenu');
    if (user && menu && !user.getAttribute('data-bound')) {
      user.setAttribute('data-bound', '1');
      user.addEventListener('click', function (e) {
        if (e.target.closest('#homeLogout')) return; // 退出按钮单独处理
        menu.classList.toggle('on');
      });
      document.addEventListener('click', function (e) {
        if (menu.classList.contains('on') && !user.contains(e.target)) menu.classList.remove('on');
      });
    }
    var lo = $('#homeLogout');
    if (lo) lo.addEventListener('click', confirmLogout);
  }
  /** 退出登录二次确认：明确提醒学习进度不会被保存 */
  function confirmLogout() {
    if ($('.onb-cmask')) return;
    var mask = document.createElement('div');
    mask.className = 'onb-cmask';
    mask.innerHTML =
      '<div class="onb-cdialog" role="dialog" aria-modal="true" aria-label="确认退出登录">' +
        '<div class="onb-cico">⚠️</div>' +
        '<h3 class="onb-ctitle">确认退出登录？</h3>' +
        '<p class="onb-ctext">退出后，本机的<b>学习进度与个人信息将被清除，且不会被保存</b>，<br>下次登录需重新开始学习。确定要退出吗？</p>' +
        '<div class="onb-cbtns">' +
          '<button class="onb-cbtn onb-ccancel" type="button" id="onbCancelLogout">继续学习</button>' +
          '<button class="onb-cbtn onb-cok" type="button" id="onbConfirmLogout">确认退出</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(mask);
    requestAnimationFrame(function () { mask.classList.add('onb-show'); });
    function close() {
      mask.classList.remove('onb-show');
      setTimeout(function () { if (mask.parentNode) mask.parentNode.removeChild(mask); }, 250);
    }
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    $('#onbCancelLogout', mask).addEventListener('click', close);
    $('#onbConfirmLogout', mask).addEventListener('click', function () { close(); setTimeout(logout, 120); });
  }
  /** 退出登录：清除本机全部学习数据并刷新（回到未登录态） */
  function logout() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_PROFILE);
      localStorage.removeItem(LEGACY_PROGRESS);
      localStorage.removeItem(ETH_KEY);
    } catch (e) {}
    if (window.location && window.location.reload) window.location.reload();
  }

  /* ------------------------------ updateUI ------------------------------ */
  function updateUI() {
    updateTopBadges();
    updateSidebar();
    updateHome();
  }

  /* --------------------------- 滚动到底标记 --------------------------- */
  function atBottom() {
    var doc = document.documentElement;
    var gap = doc.scrollHeight - (window.pageYOffset + window.innerHeight);
    return gap <= 64;
  }
  /* 不可滚动标记的页面：十二条令游戏 / 模拟回复游戏(18) / 沟通预热选择题(19) / 职业道德全部 */
  function scrollExcluded(p) {
    return !p || p === 'game' || p === '18' || p === '19' || /^eth:/.test(p);
  }
  function checkBottom() {
    var p = currentPage();
    if (scrollExcluded(p)) return;
    if (atBottom()) markPage(p);
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; checkBottom(); });
  }, { passive: true });
  window.addEventListener('resize', function () { checkBottom(); }, { passive: true });

  /* 内容不足一屏时，停留片刻即视为学完 */
  function maybeAutoMark() {
    var p = currentPage();
    if (scrollExcluded(p)) return;
    setTimeout(function () {
      if (currentPage() !== p) return;
      var doc = document.documentElement;
      if (doc.scrollHeight <= window.innerHeight + 96) markPage(p);
      else checkBottom();
    }, 1600);
  }

  /* --------------------------- 十二条令：完成检测 --------------------------- */
  var gameTimer = null;
  function watchGame() {
    if (gameTimer) return;
    var t0 = Date.now();
    gameTimer = setInterval(function () {
      if (currentPage() !== 'game') { clearInterval(gameTimer); gameTimer = null; return; }
      try {
        var f = $('iframe.game-full');
        var d = f && f.contentDocument;
        if (d && d.body && /挑战完成|成绩单|通关/.test(d.body.innerText || '')) {
          clearInterval(gameTimer); gameTimer = null; markPage('game'); return;
        }
      } catch (e) { /* 跨域时退化为时长兜底 */ }
      if (Date.now() - t0 > 90000) { clearInterval(gameTimer); gameTimer = null; markPage('game'); }
    }, 1500);
  }

  /* ------------------------------ 路由 ------------------------------ */
  var lastPage = null;
  function onRouteChange() {
    var p = currentPage();
    if (p !== lastPage) {
      lastPage = p;
      updateUI();
      maybeAutoMark();
    }
    if (p === 'game') watchGame();
  }
  function hookRoute() {
    if (typeof window.gotoView === 'function') {
      var orig = window.gotoView;
      window.gotoView = function (n) {
        orig(n);
        setTimeout(onRouteChange, 0);
      };
    }
    if (window.MutationObserver) {
      var pending = false;
      new MutationObserver(function () {
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () { pending = false; onRouteChange(); });
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
  }

  /* --------------------- iframe 游戏完成通知（跨域 postMessage） --------------------- */
  function listenGameComplete() {
    window.addEventListener('message', function (e) {
      var d = e && e.data;
      if (!d) return;
      // 十二条令：两关全部通关弹出成绩单
      if (d.source === 'onb-twelve-rules' && d.event === 'complete') {
        if (!isModuleCompleted('十二条令')) {
          updateModuleProgress('十二条令', { completed: true, stages: d.stageCount || 2 });
          showToast('页面已学完 ✅');
        }
        return;
      }
      // 职场沟通 · 模拟回复游戏：出现结局才算完成
      if (d.source === 'onb-reply-game' && d.event === 'complete') {
        if (d.type === 'success' || d.type === 'partial' || d.type === 'fail') markPage('18');
        return;
      }
      // 职场沟通 · 沟通预热选择题：出现结算弹窗（成功/失败均算）才算完成
      if (d.type === 'commWarmupEnd') {
        var updates = {};
        if (typeof d.score === 'number') updates.quizCorrect = d.score;
        if (typeof d.total === 'number') updates.quizTotal = d.total;
        var pi = PAGE_INDEX['19'];
        if (pi && !data.modules['职场沟通'].viewedPages[pi.idx]) {
          data.modules['职场沟通'].viewedPages[pi.idx] = true;
          data.modules['职场沟通'].lastUpdate = new Date().toISOString();
          syncDerivedFlags();
          recomputeCompleted('职场沟通');
          Object.keys(updates).forEach(function (k) { data.modules['职场沟通'][k] = updates[k]; });
          saveData(data);
          updateUI();
          showToast('页面已学完 ✅');
          maybeCelebrate('职场沟通');
        }
      }
    });
  }

  /* --------------- 职业道德：绿色「模块 XX 已完成」卡片出现即视为完成 --------------- */
  function syncEthicsDone(silent) {
    $$('.view-ethics .module-panel').forEach(function (panel) {
      var m = /^mod-(\d+)$/.exec(panel.id);
      if (!m) return;
      var n = m[1] === '5' ? '4' : m[1];
      if (!panel.querySelector('.module-done')) return;
      var idx = Number(n) - 1;
      if (data.modules['职业道德'].viewedPages[idx]) return;
      markPageViewed('职业道德', idx);
      if (!silent) { showToast('页面已学完 ✅'); maybeCelebrate('职业道德'); }
    });
  }
  function watchEthicsDone() {
    var root = $('.view-ethics');
    if (!root || !window.MutationObserver) return;
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; syncEthicsDone(false); });
    }).observe(root, { subtree: true, childList: true });
  }

  /* ------------------------------ 重置 ------------------------------ */
  function resetAll() {
    var u = getUserInfo();
    data = defaultData();
    data.userInfo = u;               // 保留身份信息，只清学习进度
    saveData(data);
    // 清理旧版键与职业道德模块自有存档（否则答题状态不会清空）
    try {
      localStorage.removeItem(LEGACY_PROGRESS);
      localStorage.removeItem(ETH_KEY);
    } catch (e) {}
    celebratedInSession = {};
    showToast('学习进度已重置，可重新体验');
    // 重新加载页面，确保各模块（职业道德选择题等）内部状态一并归零
    setTimeout(function () { location.reload(); }, 620);
  }

  /* ------------------------------ 初始化 ------------------------------ */
  function init() {
    data = loadData();
    migrateLegacy();
    saveData(data);

    buildSidebar();
    buildTopBadges();
    buildUserMenu();
    bindHome();
    refreshUser();
    updateUI();
    hookRoute();
    listenGameComplete();
    syncEthicsDone(true);   // 恢复历史完成状态（静默，不弹 Toast）
    watchEthicsDone();      // 实时监听绿色「已完成」卡片出现
    onRouteChange();
    if (!getUserInfo()) { buildModal(); openModal(); }
  }

  /* ------------------------------ 对外接口 ------------------------------ */
  window.TrainingProgress = {
    STORAGE_KEY: STORAGE_KEY,
    loadData: loadData,
    saveData: saveData,
    getUserInfo: getUserInfo,
    setUserInfo: setUserInfo,
    updateModuleProgress: updateModuleProgress,
    markPageViewed: markPageViewed,
    isModuleCompleted: isModuleCompleted,
    getOverallProgress: getOverallProgress,
    updateUI: updateUI,
    updateHome: updateHome,
    logout: logout,
    goHome: function () { if (typeof window.gotoView === 'function') window.gotoView('home'); },
    get data() { return data; }
  };

  // 兼容旧调用：index.html 的职业道德脚本通过 window.ONB.mark('eth:N') 同步进度
  window.ONB = {
    get profile() { return getUserInfo(); },
    get progress() { return data; },
    mark: markPage,
    toast: showToast,
    celebrate: celebrate,
    reset: resetAll,
    stat: moduleStat,
    page: currentPage
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
