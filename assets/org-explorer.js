/* =========================================================================
 * 组织架构 · 星球浏览器（组织层级）
 * 来源：D:\dsh_work\打包星球\org-explorer.html
 * 平台集成改造：
 *   1. 全部 id / class 命名空间化（orgexp-*），避免与平台其它模块冲突
 *   2. 图片路径改为平台根相对路径（卫星图复用 assets/galaxy/，主星图 assets/galaxy/new/）
 *   3. 组织树导航从「悬浮遮罩」改为「舞台左侧分栏」，不再遮挡星球
 *   4. 新增路径面包屑 + 返回上级 + 自动公转开关
 *   5. 惰性初始化：模块未激活时不加载图片、不跑动画
 * ========================================================================= */
(function () {
  'use strict';

  var root = document.getElementById('orgexp');
  if (!root) return;

  var canvas = document.getElementById('orgexp-canvas');
  var pathEl = document.getElementById('orgexp-path');
  var backEl = document.getElementById('orgexp-back');
  var navEl = document.getElementById('orgexp-nav');
  var sideEl = document.getElementById('orgexp-side');
  var viewEl = document.getElementById('orgexp-view');
  var collapseBtn = document.getElementById('orgexp-collapse');
  var openBtn = document.getElementById('orgexp-open');
  var autoRotEl = document.getElementById('orgexp-autorot');
  var panel = document.getElementById('orgexp-panel');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  /* =========================================================================
   * 一、数据
   * ========================================================================= */
  var ASSET_DIR = 'assets/galaxy/';      // 小卫星图片池
  var NEW_DIR = 'assets/galaxy/new/';    // 大星球图片（按部门名命名）

  var SAT_POOL = [
    '人事行政部.png', '仓储运营优化.png', '国际运输FBA.png', '客户发展部.png', '总裁办.png',
    '技术部.png', '海外仓产品运营.png', '物流业务部门.png', '直发产品运营.png', '财务部-邓文静.png',
    '财务部.png', '运力中心.png', '集团支持部门.png'
  ];

  var CEO = {
    name: '集团创始人&CEO',
    title: '肖友泉',
    color: '#f59e0b',
    emoji: '👑',
    desc: '集团创始人暨首席执行官肖友泉，统领公司各一级部门'
  };

  var DEPARTMENTS = [
    { name: '战略委员办', children: [] },
    { name: '总裁办', children: [
      { name: 'HR' }, { name: '行政' }, { name: 'PR' }, { name: '法务' }, { name: '投资孵化' }
    ]},
    { name: '财务部', children: [
      { name: '资金' }, { name: '账务' }, { name: '应付结算' }, { name: 'BU' }, { name: '财务BP' }
    ]},
    { name: '技术部', children: [
      { name: '产品与BP' }, { name: '框架平台' }, { name: 'AI创新' }, { name: '业务交付' },
      { name: '运维保障' }, { name: '特别项目组' }
    ]},
    { name: '业务发展部', children: [
      { name: '支持管理' }, { name: '市场营销' }, { name: 'KA组' }, { name: 'CBD小组' },
      { name: '客户成功' }, { name: 'CS' }
    ]},
    { name: '产品及运营', children: [
      { name: '客户成功' }, { name: '设备及优化' }, { name: '中国直发' }, { name: '欧澳区' },
      { name: '北美区' }, { name: '南美区' }, { name: '其他地区' }, { name: '国际运输部' },
      { name: '运力追溯性' }, { name: '仓储操作中心' }
    ]},
    { name: '其他', children: [] }
  ];

  var PALETTE = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#06b6d4', '#ef4444', '#eab308'];
  CEO.img = NEW_DIR + 'CEO-肖友泉.png';
  var satIdx = 0;
  function nextSat() { var f = SAT_POOL[satIdx % SAT_POOL.length]; satIdx++; return f; }
  DEPARTMENTS.forEach(function (d, i) {
    d.color = PALETTE[i % PALETTE.length];
    d.img = NEW_DIR + d.name + '.png';
    d.children.forEach(function (c) { c.color = d.color; c.img = ASSET_DIR + nextSat(); });
  });

  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return { r: 59, g: 130, b: 246 };
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }
  function shade(hex, k) {
    var c = hexToRgb(hex);
    function f(v) { v = Math.round(v * 255); return clamp(v, 0, 255); }
    var target = k > 0 ? 255 : 0, m = Math.abs(k);
    return 'rgb(' + f(c.r + (target - c.r) * m) + ',' + f(c.g + (target - c.g) * m) + ',' + f(c.b + (target - c.b) * m) + ')';
  }

  /* =========================================================================
   * 二、画布
   * ========================================================================= */
  var LOGICAL_W = 920, LOGICAL_H = 560;
  var CX = LOGICAL_W / 2, CY = LOGICAL_H / 2;

  var dpr = window.devicePixelRatio || 1;
  var viewScale = 0;      // 画布实际像素 / 逻辑像素（严格等比，绝不拉伸）

  /**
   * 按 920:560 等比计算 canvas 显示尺寸：
   * 画布区变窄（抽屉展开）时整体等比缩小并垂直居中，星球永远居中且不变形。
   */
  function layout() {
    if (!viewEl) return;
    var box = viewEl.getBoundingClientRect();
    if (!box.width || !box.height) return;
    var s = Math.min(box.width / LOGICAL_W, box.height / LOGICAL_H);
    if (s <= 0) return;
    var w = Math.round(LOGICAL_W * s), h = Math.round(LOGICAL_H * s);
    if (Math.abs(s - viewScale) < 0.0005 && canvas.style.width === w + 'px') return;
    viewScale = s;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
  }

  var SAT_R = 24;
  var BACK_SCALE = 0.85, BACK_ALPHA = 0.5;
  var DRAG_MIN = 40;
  var DRAG_SENS = 0.009;

  /* =========================================================================
   * 三、图片加载（惰性：模块首次可见时才加载）
   * ========================================================================= */
  var IMG = {};
  var imagesLoaded = false;

  function computeBox(img) {
    try {
      var c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      var g = c.getContext('2d'); g.drawImage(img, 0, 0);
      var d = g.getImageData(0, 0, c.width, c.height).data;
      var minX = c.width, minY = c.height, maxX = 0, maxY = 0, w = c.width, h = c.height, found = false;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 16) {
          found = true;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
      return found ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null;
    } catch (_) { return null; }
  }

  function loadImages() {
    var seen = {};
    function load(node) {
      var f = node.img;
      if (!f || seen[f]) return;
      seen[f] = true;
      var img = new Image();
      img.onload = function () { var b = computeBox(img); if (b) img._box = b; IMG[f] = img; };
      img.onerror = function () {};
      img.src = f;
    }
    function walk(node) { load(node); (node.children || []).forEach(walk); }
    walk(CEO);
    DEPARTMENTS.forEach(walk);
  }

  /* =========================================================================
   * 四、视图状态
   * ========================================================================= */
  var view = { type: 'ceo' };
  var highlightSat = null;
  var rotation = 0;
  var angularSpeed = 0.16;
  var autoRotate = true;

  function body() { return view.type === 'ceo' ? CEO : view.dept; }
  function satellites() { return view.type === 'ceo' ? DEPARTMENTS : view.dept.children; }
  function bodyR() { return view.type === 'ceo' ? 156 : 138; }

  function rings() {
    var R = bodyR();
    var n = satellites().length;
    var mult = n >= 9 ? 2.3 : (n >= 8 ? 2.0 : (n >= 6 ? 1.7 : 1.6));
    var rx = R * mult;
    return [{ tilt: Math.PI / 4, rx: rx, ry: rx * 0.34 }];
  }
  function decorRing() {
    var n = satellites().length;
    if (n > 0 && n <= 5) {
      var rx = bodyR() * 1.6 * 1.15;
      return { tilt: Math.PI / 4, rx: rx, ry: rx * 0.34 };
    }
    return null;
  }
  function ringExtent() {
    var m = 0;
    rings().forEach(function (r) { m = Math.max(m, Math.hypot(r.rx, r.ry)); });
    return m;
  }

  /* =========================================================================
   * 五、绘制
   * ========================================================================= */
  var hits = [];

  var starSeed = (function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })(20240601);

  var stars = [];
  (function () {
    for (var i = 0; i < 180; i++) {
      stars.push({
        x: starSeed() * LOGICAL_W, y: starSeed() * LOGICAL_H,
        r: starSeed() * 1.4 + 0.3, a: starSeed() * 0.6 + 0.3,
        tw: starSeed() * TAU, sp: starSeed() * 2 + 0.5
      });
    }
  })();

  function drawStars() {
    var t = performance.now() / 1000;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = 0.5 + 0.5 * Math.sin(t * s.sp + s.tw);
      var bright = 0.3 + 0.7 * tw;
      ctx.globalAlpha = s.a * bright;
      ctx.fillStyle = '#eaf2ff';
      if (tw > 0.72) {
        ctx.save();
        ctx.shadowColor = 'rgba(180,210,255,0.9)'; ctx.shadowBlur = s.r * 6;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawBackground() {
    var g = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    g.addColorStop(0, '#04060f'); g.addColorStop(0.5, '#070b1a'); g.addColorStop(1, '#0a1026');
    ctx.fillStyle = g; ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    drawStars();
  }

  function drawRing(r, near, deco) {
    ctx.save();
    ctx.lineWidth = deco ? 0.8 : 1.8;
    ctx.strokeStyle = 'rgba(210,222,252,' + (deco ? 0.32 : (near ? 0.8 : 0.4)) + ')';
    ctx.beginPath();
    ctx.ellipse(CX, CY, r.rx, r.ry, r.tilt, near ? 0 : Math.PI, near ? Math.PI : TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlanet(x, y, r, node, alpha, isBody) {
    ctx.save();
    ctx.globalAlpha = alpha;
    var img = IMG[node.img];
    if (img) {
      var box = img._box;
      if (box) {
        var sc = (r * 2 * 1.02) / box.h;
        var w = box.w * sc, h = box.h * sc;
        ctx.drawImage(img, box.x, box.y, box.w, box.h, x - w / 2, y - h / 2, w, h);
      } else {
        var S = (r * 2) / 0.9;
        ctx.drawImage(img, x - S / 2, y - S / 2, S, S);
      }
    } else {
      var g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r);
      g.addColorStop(0, shade(node.color, 0.42));
      g.addColorStop(0.5, node.color);
      g.addColorStop(1, shade(node.color, -0.5));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }

    if (r >= 16) {
      var ly = isBody ? (y - r - 6) : (y + r + 12);
      ctx.font = (isBody ? '700 15px' : '600 10.5px') + ' "Microsoft YaHei","PingFang SC",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = isBody ? 'bottom' : 'top';
      ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(3,6,18,0.9)';
      ctx.strokeText(node.name, x, ly);
      ctx.fillStyle = isBody ? 'rgba(255,255,255,0.96)' : 'rgba(214,224,248,0.92)';
      ctx.fillText(node.name, x, ly);
    }
    ctx.restore();
  }

  function drawSat(it) {
    drawPlanet(it.x, it.y, SAT_R * it.scale, it.node, it.alpha, false);
    if (it.node === highlightSat) {
      var t = performance.now() / 1000;
      var pu = 1 + 0.12 * Math.sin(t * 4);
      ctx.save();
      ctx.beginPath(); ctx.arc(it.x, it.y, (it.r + 8) * pu, 0, TAU);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(it.x, it.y, it.r + 20, 0, TAU);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
  }

  function render() {
    hits = [];
    ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, 0, 0);
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

    drawBackground();

    var rl = rings();
    var b = body();
    var sats = satellites();
    var n = sats.length;
    var dl = decorRing();

    if (n > 0) {
      var items = sats.map(function (sat, i) {
        var r = rl[0];
        var phi = rotation + i * (TAU / n);
        var lx = Math.cos(phi) * r.rx;
        var ly = Math.sin(phi) * r.ry;
        var ct = Math.cos(r.tilt), st = Math.sin(r.tilt);
        var x = CX + lx * ct - ly * st;
        var y = CY + lx * st + ly * ct;
        var front = ly >= 0;
        return {
          node: sat, x: x, y: y, front: front,
          scale: front ? 1 : BACK_SCALE, alpha: front ? 1 : BACK_ALPHA,
          r: SAT_R * (front ? 1 : BACK_SCALE)
        };
      });
      var back = items.filter(function (it) { return !it.front; });
      var front = items.filter(function (it) { return it.front; });

      rl.forEach(function (r) { drawRing(r, false); });
      if (dl) drawRing(dl, false, true);
      back.forEach(function (it) {
        hits.push({ kind: 'sat', node: it.node, x: it.x, y: it.y, r: it.r });
        drawSat(it);
      });
    }

    hits.push({ kind: 'body', node: b, x: CX, y: CY, r: bodyR() });
    drawPlanet(CX, CY, bodyR(), b, 1, true);

    if (n > 0) {
      rl.forEach(function (r) { drawRing(r, true); });
      if (dl) drawRing(dl, true, true);
      front.forEach(function (it) {
        hits.push({ kind: 'sat', node: it.node, x: it.x, y: it.y, r: it.r });
        drawSat(it);
      });
    }

    if (view.type === 'dept' && n === 0) {
      ctx.font = '400 12px "Microsoft YaHei","PingFang SC",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.lineJoin = 'round'; ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(3,6,18,0.9)';
      var t = '（暂无下级）';
      ctx.strokeText(t, CX, CY + bodyR() + 26);
      ctx.fillStyle = 'rgba(170,185,215,0.85)';
      ctx.fillText(t, CX, CY + bodyR() + 26);
    }
  }

  /* =========================================================================
   * 六、组织树导航
   * ========================================================================= */
  var openState = { ceo: true };

  function findDept(name) {
    for (var i = 0; i < DEPARTMENTS.length; i++) if (DEPARTMENTS[i].name === name) return DEPARTMENTS[i];
    return null;
  }

  function navRow(key, label, color, depth, bullet, badge, open, hasKids) {
    var pad = 10 + depth * 16;
    var tw = hasKids
      ? '<span class="orgexp-tw" data-key="' + key + '">' + (open ? '▾' : '▸') + '</span>'
      : '<span class="orgexp-tw orgexp-tw-sp"></span>';
    var bd = badge !== '' ? '<span class="orgexp-cnt">' + badge + '</span>' : '';
    return '<div class="orgexp-nrow" style="padding-left:' + pad + 'px">' + tw +
      '<button class="orgexp-navitem" type="button" data-key="' + key + '">' +
      '<span class="orgexp-dot" style="background:' + color + ';color:' + color + '"></span>' +
      esc(label) + bd + '</button></div>';
  }

  function buildNav() {
    var h = navRow('ceo', CEO.name, CEO.color, 0, '👑', DEPARTMENTS.length, !!openState.ceo, DEPARTMENTS.length > 0);
    if (openState.ceo) {
      DEPARTMENTS.forEach(function (d) {
        var dKey = 'dept:' + d.name;
        var dOpen = !!openState[dKey];
        h += navRow(dKey, d.name, d.color, 1, '●', d.children.length, dOpen, d.children.length > 0);
        if (dOpen) {
          d.children.forEach(function (s) {
            h += navRow('sub:' + d.name + ':' + s.name, s.name, d.color, 2, '·', '', false, false);
          });
        }
      });
    }
    navEl.innerHTML = h;

    navEl.querySelectorAll('.orgexp-tw').forEach(function (tw) {
      tw.addEventListener('click', function (e) {
        e.stopPropagation();
        var k = tw.getAttribute('data-key');
        openState[k] = !openState[k];
        buildNav();
        updateNavActive();
      });
    });
    navEl.querySelectorAll('.orgexp-navitem').forEach(function (btn) {
      btn.addEventListener('click', function () {
        handleNavSelect(btn.getAttribute('data-key'));
      });
    });
  }

  function handleNavSelect(key) {
    if (key === 'ceo') { select({ type: 'ceo' }, null); return; }
    if (key.indexOf('dept:') === 0) {
      var d = findDept(key.slice(5));
      if (d) select({ type: 'dept', dept: d }, null);
      return;
    }
    if (key.indexOf('sub:') === 0) {
      var parts = key.slice(4).split(':');
      var d2 = findDept(parts[0]);
      var sub = d2 ? d2.children.filter(function (c) { return c.name === parts[1]; })[0] : null;
      if (d2 && sub) select({ type: 'dept', dept: d2 }, sub);
    }
  }

  function updateNavActive() {
    navEl.querySelectorAll('.orgexp-navitem').forEach(function (btn) {
      var k = btn.getAttribute('data-key');
      var active = false;
      if (view.type === 'ceo' && k === 'ceo') active = true;
      else if (view.type === 'dept') {
        if (k === 'dept:' + view.dept.name) active = true;
        if (highlightSat && k === 'sub:' + view.dept.name + ':' + highlightSat.name) active = true;
      }
      btn.classList.toggle('is-active', !!active);
    });
  }

  /* 面包屑路径 */
  function renderPath() {
    var h = '<button class="orgexp-crumb" type="button" data-crumb="ceo">集团</button>';
    if (view.type === 'dept') {
      h += '<span class="orgexp-sep">›</span>' +
        '<button class="orgexp-crumb is-current" type="button" data-crumb="dept">' + esc(view.dept.name) + '</button>';
      if (highlightSat) {
        h += '<span class="orgexp-sep">›</span>' +
          '<span class="orgexp-crumb is-leaf">' + esc(highlightSat.name) + '</span>';
      }
    }
    pathEl.innerHTML = h;
    pathEl.querySelectorAll('.orgexp-crumb[data-crumb]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var c = btn.getAttribute('data-crumb');
        if (c === 'ceo') select({ type: 'ceo' }, null);
        else if (view.type === 'dept') select({ type: 'dept', dept: view.dept }, null);
      });
    });
    backEl.classList.toggle('show', view.type === 'dept');
  }

  function select(v, sat) {
    view = v;
    highlightSat = sat || null;
    rotation = 0;
    if (v.type === 'dept') { openState.ceo = true; openState['dept:' + v.dept.name] = true; buildNav(); }
    updateNavActive();
    renderPath();
    closePanel();
  }

  /* =========================================================================
   * 七、指针交互
   * ========================================================================= */
  function toLogical(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width * LOGICAL_W,
      y: (clientY - rect.top) / rect.height * LOGICAL_H
    };
  }

  var dragActive = false, dragStartX = 0, dragStartRot = 0;
  var down = { x: 0, y: 0 };

  function inDragRange(x, y) {
    var d = Math.hypot(x - CX, y - CY);
    return d >= DRAG_MIN && d <= ringExtent() + 45;
  }
  function hitTest(x, y) {
    for (var i = hits.length - 1; i >= 0; i--) {
      var h = hits[i];
      if (Math.hypot(x - h.x, y - h.y) <= h.r + 3) return h;
    }
    return null;
  }

  canvas.addEventListener('pointerdown', function (e) {
    var p = toLogical(e.clientX, e.clientY);
    down.x = p.x; down.y = p.y;
    dragActive = inDragRange(p.x, p.y);
    if (dragActive) { dragStartX = p.x; dragStartRot = rotation; }
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    canvas.style.cursor = 'grabbing';
  });

  canvas.addEventListener('pointermove', function (e) {
    var p = toLogical(e.clientX, e.clientY);
    if (dragActive) {
      rotation = dragStartRot + (p.x - dragStartX) * DRAG_SENS;
    } else {
      var over = hitTest(p.x, p.y);
      canvas.style.cursor = over ? 'pointer' : (inDragRange(p.x, p.y) ? 'grab' : 'default');
    }
  });

  canvas.addEventListener('pointerup', function (e) {
    var p = toLogical(e.clientX, e.clientY);
    var d = Math.hypot(p.x - down.x, p.y - down.y);
    if (!(dragActive && d > 6)) onClick(p.x, p.y);
    dragActive = false;
    canvas.style.cursor = 'grab';
  });

  canvas.addEventListener('pointercancel', function () { dragActive = false; });

  function onClick(x, y) {
    var h = hitTest(x, y);
    if (!h) { closePanel(); return; }
    if (h.kind === 'body') openBodyPanel(h.node);
    else if (view.type === 'ceo') select({ type: 'dept', dept: h.node }, null);
    else openSatPanel(h.node, h.x, h.y);
  }

  /* =========================================================================
   * 八、信息浮窗
   * ========================================================================= */
  function show(html, lx, ly) {
    panel.innerHTML = html;
    var closeBtn = panel.querySelector('#orgexp-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', function (e) { e.stopPropagation(); closePanel(); });
    panel.style.display = 'block';
    var rect = canvas.getBoundingClientRect();
    var sx = rect.left + lx / LOGICAL_W * rect.width;
    var sy = rect.top + ly / LOGICAL_H * rect.height;
    var ph = panel.getBoundingClientRect().height;
    panel.style.left = clamp(sx + 20, 8, window.innerWidth - 288 - 8) + 'px';
    panel.style.top = clamp(sy - ph / 2, 8, window.innerHeight - ph - 8) + 'px';
  }

  function openBodyPanel(node) {
    var isC = node === CEO;
    var kids = isC ? DEPARTMENTS : node.children;
    var chips = kids.length
      ? kids.map(function (k) { return '<span class="orgexp-chip">' + esc(k.name) + '</span>'; }).join('')
      : '<span class="orgexp-chip orgexp-chip-empty">暂无下级</span>';
    var html =
      '<button class="orgexp-close" id="orgexp-panel-close" aria-label="关闭">×</button>' +
      '<div class="orgexp-phead">' +
      '<span class="orgexp-pdot" style="background:' + esc(node.color) + ';color:' + esc(node.color) + '">' +
      (isC ? esc(CEO.emoji) : '🪐') + '</span>' +
      '<div><div class="orgexp-pt">' + esc(node.name) + '</div>' +
      '<div class="orgexp-pst">' + (isC ? esc(CEO.title) : '一级部门') + '</div></div></div>' +
      (isC && CEO.desc ? '<p class="orgexp-pdesc">' + esc(CEO.desc) + '</p>' : '') +
      '<div class="orgexp-pkids">' + (isC ? '一级部门（' : '直属下级（') + kids.length + '）</div>' +
      '<div class="orgexp-chips">' + chips + '</div>';
    show(html, CX + bodyR(), CY);
  }

  function openSatPanel(node, sx, sy) {
    var html =
      '<button class="orgexp-close" id="orgexp-panel-close" aria-label="关闭">×</button>' +
      '<div class="orgexp-phead">' +
      '<span class="orgexp-pdot" style="background:' + esc(node.color) + ';color:' + esc(node.color) + '">🛰️</span>' +
      '<div><div class="orgexp-pt">' + esc(node.name) + '</div>' +
      '<div class="orgexp-pst">' + esc(view.dept.name) + ' · 下级部门</div></div></div>';
    show(html, sx, sy);
  }

  function closePanel() { panel.style.display = 'none'; }

  document.addEventListener('pointerdown', function (e) {
    if (panel.style.display === 'block' && !panel.contains(e.target) && e.target !== canvas) closePanel();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });

  /* =========================================================================
   * 九、导航分栏收/展 + 工具栏
   * ========================================================================= */
  function setNav(open) {
    sideEl.classList.toggle('collapsed', !open);
    openBtn.classList.toggle('show', !open);
  }
  collapseBtn.addEventListener('click', function () { setNav(false); });
  openBtn.addEventListener('click', function () { setNav(true); });

  backEl.addEventListener('click', function () {
    select(view.type === 'dept' ? { type: 'ceo' } : { type: 'ceo' }, null);
  });

  autoRotEl.addEventListener('change', function () { autoRotate = autoRotEl.checked; });

  /* =========================================================================
   * 十、主循环（未激活时暂停，首次可见时加载图片）
   * ========================================================================= */
  var lastT = 0;

  function frame(ms) {
    requestAnimationFrame(frame);
    if (root.offsetParent === null) return;          // 视图未显示：不渲染、不加载
    if (!imagesLoaded) { imagesLoaded = true; loadImages(); }
    layout();

    var dt = lastT ? (ms - lastT) : 0;
    lastT = ms;
    if (dt > 0 && dt < 100 && !dragActive && autoRotate) rotation += angularSpeed * (dt / 1000);
    render();
  }

  window.addEventListener('resize', function () {
    var nd = window.devicePixelRatio || 1;
    if (nd !== dpr) { dpr = nd; viewScale = 0; }
    layout();
    closePanel();
  });

  /* 抽屉展开/收起的过渡期间，画布区宽度持续变化，需要跟着重算尺寸 */
  if (window.ResizeObserver && viewEl) {
    new ResizeObserver(function () { layout(); }).observe(viewEl);
  } else {
    setInterval(layout, 200);
  }

  buildNav();
  updateNavActive();

  /* 深链：?view=33&org=技术部 直接进入某部门视图 */
  var orgMatch = /[?&]org=([^&]+)/.exec(window.location.search);
  var orgDept = orgMatch ? findDept(decodeURIComponent(orgMatch[1])) : null;
  if (orgDept) {
    select({ type: 'dept', dept: orgDept }, null);
  } else {
    renderPath();
  }

  requestAnimationFrame(frame);
})();
