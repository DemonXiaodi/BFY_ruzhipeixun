/*! 贝法易组织架构 · 赤道视角星际图（移植自 org-equator 参考实现）
 * 纯 Canvas2D，无第三方依赖，数据硬编码。
 * 用法：window.initGalaxyOrgChart()  —— 进入 view 33 时调用一次。
 */
(function () {
  'use strict';

  var ASSET_DIR = 'assets/galaxy/';

  /* =========================================================================
   * 一、组织架构数据（硬编码，方便修改）
   * ========================================================================= */
  var DATA_LOG = {
    id: 'log',
    name: '物流业务',
    color: '#3b82f6',
    emoji: '📦',
    cx: 260, cy: 310, r: 104,
    orbitRX: 190, orbitRY: 86,
    angularSpeed: 0.22,
    img: '物流业务部门.png',
    children: [
      { name: '客户发展部',     leader: '张宇',               desc: '负责客户拓展与销售支持', img: '客户发展部.png' },
      { name: '仓储运营优化',   leader: '丁恺',               desc: '国内及海外仓储运营管理', img: '仓储运营优化.png' },
      { name: '海外仓产品运营', leader: '刘雪茹',             desc: '海外仓产品开发与运营', img: '海外仓产品运营.png' },
      { name: '直发产品运营',   leader: '廖景平',             desc: '直发产品开发与运营', img: '直发产品运营.png' },
      { name: '运力中心',       leader: '张泽标',             desc: '全球运力调度与渠道开发', img: '运力中心.png' },
      { name: '国际运输FBA',    leader: '刘雪茹（兼）',       desc: 'FBA专线产品与调度', img: '国际运输FBA.png' },
      { name: '技术部',         leader: '张帅 / 洪穗熙 / 谭欢', desc: '系统研发与技术运维', img: '技术部.png' },
      { name: '业务财务部',     leader: '张凯洁',             desc: '物流业务财务应收与结算', img: '财务部.png' }
    ]
  };

  var DATA_SUP = {
    id: 'sup',
    name: '集团支持',
    color: '#f97316',
    emoji: '🏢',
    cx: 660, cy: 310, r: 52,
    orbitRX: 130, orbitRY: 30,
    angularSpeed: 0.16,
    img: '集团支持部门.png',
    children: [
      { name: '总裁办',     leader: '杨品娥', desc: '市场公关与法务支持', img: '总裁办.png' },
      { name: '集团财务部', leader: '邓文静', desc: '集团资金与财务分析', img: '财务部-邓文静.png' },
      { name: '人事行政部', leader: '余灿',   desc: 'HR与行政综合管理', img: '人事行政部.png' }
    ]
  };

  var CEO = {
    id: 'ceo',
    name: '肖友泉',
    title: '集团 CEO',
    color: '#f59e0b',
    emoji: '👑',
    cx: 488, cy: 108, r: 42,
    img: 'CEO-肖友泉.png',
    desc: '集团创始人暨首席执行官，统辖物流业务与集团支持两大分支'
  };

  var BRANCHES = [DATA_LOG, DATA_SUP];
  DATA_LOG.rotation = 0;
  DATA_SUP.rotation = 0;

  /* =========================================================================
   * 二、常量与工具
   * ========================================================================= */
  var LOGICAL_W = 920, LOGICAL_H = 560;
  var SMALL_R = 32;
  var BACK_SCALE = 0.85, BACK_ALPHA = 0.5;
  var DRAG_MIN = 40, DRAG_MAX = 205;
  var DRAG_SENS = 0.009;
  var TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function seedOf(str) {
    var h = 2166136261;
    for (var i = 0; i < String(str).length; i++) { h ^= String(str).charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* =========================================================================
   * 三、状态
   * ========================================================================= */
  var state = {
    inited: false,
    canvas: null,
    ctx: null,
    stage: null,
    root: null,
    panel: null,
    dpr: 1,
    IMG: {},
    hits: [],
    dragBranch: null,
    dragStartX: 0,
    dragStartRot: 0,
    down: { x: 0, y: 0 },
    dragging: false,
    rafId: 0,
    lastT: 0,
    visible: false,
    autoRotate: true
  };

  /* =========================================================================
   * 四、图片加载 + 不透明包围盒计算
   * ========================================================================= */
  function computeBox(img) {
    try {
      var c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      var g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      var d = g.getImageData(0, 0, c.width, c.height).data;
      var minX = c.width, minY = c.height, maxX = 0, maxY = 0;
      var w = c.width, h = c.height, found = false;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          if (d[(y * w + x) * 4 + 3] > 16) {
            found = true;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      return found ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null;
    } catch (_) { return null; }
  }

  function loadImages(cb) {
    var seen = {};
    var all = [CEO, DATA_LOG].concat(DATA_LOG.children, [DATA_SUP], DATA_SUP.children);
    var pending = 0;
    all.forEach(function (ent) {
      var f = ent.img;
      if (!f || seen[f]) return;
      seen[f] = true;
      pending++;
      var img = new Image();
      img.onload = function () {
        var b = computeBox(img);
        if (b) img._box = b;
        state.IMG[f] = img;
        if (--pending === 0 && cb) cb();
      };
      img.onerror = function () { if (--pending === 0 && cb) cb(); };
      img.src = ASSET_DIR + f;
    });
    if (pending === 0 && cb) cb();
  }

  /* =========================================================================
   * 五、程序化星球绘制（图片缺失时回退）
   * ========================================================================= */
  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return { r: 59, g: 130, b: 246 };
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }
  function shade(hex, k) {
    var c = hexToRgb(hex);
    function f(v) { return clamp(Math.round(v * 255), 0, 255); }
    var target = k > 0 ? 255 : 0;
    var m = Math.abs(k);
    return 'rgb(' + f(c.r + (target - c.r) * m) + ',' + f(c.g + (target - c.g) * m) + ',' + f(c.b + (target - c.b) * m) + ')';
  }

  function drawBody(x, y, r, file, baseColor, style, seed) {
    var ctx = state.ctx;
    var img = state.IMG[file];
    if (img && img.complete && img.naturalWidth > 0) {
      var box = img._box;
      if (box) {
        var sc = (r * 2 * 1.02) / box.h;
        var w = box.w * sc, h = box.h * sc;
        ctx.drawImage(img, box.x, box.y, box.w, box.h, x - w / 2, y - h / 2, w, h);
      } else {
        var S = (r * 2) / 0.9;
        ctx.drawImage(img, x - S / 2, y - S / 2, S, S);
      }
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.clip();

    var rnd = mulberry32(seed);
    var grad = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r);
    grad.addColorStop(0, shade(baseColor, 0.42));
    grad.addColorStop(0.5, baseColor);
    grad.addColorStop(1, shade(baseColor, -0.5));
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    if (style === 'bands') {
      var bandCol = ['rgba(255,255,255,0.20)', 'rgba(0,0,0,0.10)'];
      var nBands = Math.max(3, Math.round(r / 9));
      for (var i = 0; i < nBands; i++) {
        var by = y - r + (i + 0.5) * (2 * r / nBands);
        var amp = r * (0.05 + rnd() * 0.05);
        var wavy = rnd() * 2 - 1;
        ctx.fillStyle = bandCol[i % 2];
        ctx.beginPath();
        ctx.moveTo(x - r, by);
        for (var px = -r; px <= r; px += 5) {
          ctx.lineTo(x + px, by + Math.sin((px + r) / (2 * r) * Math.PI * 2 + wavy) * amp);
        }
        for (var px2 = r; px2 >= -r; px2 -= 5) {
          ctx.lineTo(x + px2, by + (2 * r / nBands) * 0.5 + Math.sin((px2 + r) / (2 * r) * Math.PI * 2 + wavy) * amp);
        }
        ctx.closePath();
        ctx.fill();
      }
    } else if (style === 'craters') {
      var nCr = Math.max(3, Math.round(r / 14));
      for (var c = 0; c < nCr; c++) {
        var ang = rnd() * TAU;
        var dis = rnd() * r * 0.62;
        var cx2 = x + Math.cos(ang) * dis;
        var cy2 = y + Math.sin(ang) * dis;
        var cr = r * (0.12 + rnd() * 0.18);
        ctx.beginPath();
        ctx.arc(cx2, cy2, cr, 0, TAU);
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx2, cy2, cr, Math.PI * 0.9, Math.PI * 1.9);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = Math.max(1, cr * 0.25);
        ctx.stroke();
      }
    }

    var gloss = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    gloss.addColorStop(0, 'rgba(255,255,255,0)');
    gloss.addColorStop(0.30, 'rgba(255,255,255,0.30)');
    gloss.addColorStop(0.55, 'rgba(255,255,255,0.06)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    ctx.restore();

    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawPlanet(x, y, r, file, baseColor, style, seed, alpha, label, isMain, emoji) {
    var ctx = state.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    var hasImg = !!(state.IMG[file] && state.IMG[file].complete && state.IMG[file].naturalWidth > 0);
    if (hasImg) {
      drawBody(x, y, r, file, baseColor, style, seed);
    } else {
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = isMain ? r * 1.4 : r * 0.9;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = baseColor;
      ctx.fill();
      ctx.shadowBlur = 0;
      drawBody(x, y, r, file, baseColor, style, seed);
    }

    if (isMain && emoji && !hasImg) {
      ctx.font = Math.round(r * 0.9) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, x, y + r * 0.04);
    }

    if (label) {
      var ly = isMain ? (y - r - 6) : (y + r + 14);
      ctx.font = (isMain ? '700 15px' : '600 11px') + ' "Microsoft YaHei","PingFang SC",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = isMain ? 'bottom' : 'top';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(3,6,18,0.9)';
      ctx.strokeText(label, x, ly);
      ctx.fillStyle = isMain ? 'rgba(255,255,255,0.96)' : 'rgba(214,224,248,0.92)';
      ctx.fillText(label, x, ly);
    }
    ctx.restore();
  }

  /* =========================================================================
   * 六、轨道 / 星空
   * ========================================================================= */
  function drawOrbit(b) {
    var ctx = state.ctx;
    ctx.save();
    ctx.setLineDash([7, 6]);
    ctx.strokeStyle = 'rgba(190,205,250,0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(b.cx, b.cy, b.orbitRX, b.orbitRY, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  var stars = [];
  (function initStars() {
    var s = mulberry32(987654321);
    for (var i = 0; i < 170; i++) {
      stars.push({
        x: s() * LOGICAL_W,
        y: s() * LOGICAL_H,
        r: s() * 1.4 + 0.3,
        a: s() * 0.7 + 0.3,
        tw: s() * TAU,
        sp: s() * 2 + 0.5
      });
    }
  })();

  function drawStars() {
    var ctx = state.ctx;
    var t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      var tw = 0.55 + 0.45 * Math.sin(t * st.sp + st.tw);
      ctx.globalAlpha = st.a * tw;
      ctx.fillStyle = '#cdd8ff';
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* =========================================================================
   * 七、主渲染
   * ========================================================================= */
  function childState(b, i) {
    var ang = b.rotation + i * (TAU / b.children.length);
    var px = b.cx + Math.cos(ang) * b.orbitRX;
    var py = b.cy + Math.sin(ang) * b.orbitRY;
    var front = Math.sin(ang) > 0;
    return { index: i, ang: ang, x: px, y: py, front: front, scale: front ? 1 : BACK_SCALE, alpha: front ? 1 : BACK_ALPHA };
  }

  function drawMain(b) {
    state.hits.push({ type: 'main', branch: b, index: -1, x: b.cx, y: b.cy, r: b.r });
    drawPlanet(b.cx, b.cy, b.r, b.img, b.color, b.id === 'log' ? 'bands' : 'craters',
      seedOf('main-' + b.id), 1, b.name, true, b.emoji);
  }

  function drawSmall(b, ch) {
    var child = b.children[ch.index];
    var style = b.id === 'log' ? 'bands' : 'smooth';
    state.hits.push({ type: 'child', branch: b, index: ch.index, x: ch.x, y: ch.y, r: SMALL_R * ch.scale });
    drawPlanet(ch.x, ch.y, SMALL_R * ch.scale, child.img || b.img, b.color, style,
      seedOf(child.name), ch.alpha, child.name, false, null);
  }

  function drawCEO() {
    state.hits.push({ type: 'ceo', branch: null, index: -1, x: CEO.cx, y: CEO.cy, r: CEO.r });
    drawPlanet(CEO.cx, CEO.cy, CEO.r, CEO.img, CEO.color, 'smooth',
      seedOf('ceo'), 1, '集团 CEO · ' + CEO.name, true, CEO.emoji);
  }

  function render() {
    var ctx = state.ctx;
    state.hits = [];
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

    var bg = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    bg.addColorStop(0, '#04060f');
    bg.addColorStop(0.5, '#070b1a');
    bg.addColorStop(1, '#0a1026');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    drawStars();

    [DATA_SUP, DATA_LOG].forEach(function (b) {
      drawOrbit(b);
      var kids = b.children.map(function (_, i) { return childState(b, i); });
      var back = kids.filter(function (k) { return !k.front; });
      var front = kids.filter(function (k) { return k.front; });
      back.forEach(function (k) { drawSmall(b, k); });
      drawMain(b);
      front.forEach(function (k) { drawSmall(b, k); });
    });

    drawCEO();
  }

  /* =========================================================================
   * 八、交互
   * ========================================================================= */
  function toLogical(clientX, clientY) {
    var rect = state.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width * LOGICAL_W,
      y: (clientY - rect.top) / rect.height * LOGICAL_H
    };
  }

  function branchInDragRange(b, x, y) {
    var d = Math.hypot(x - b.cx, y - b.cy);
    return d >= DRAG_MIN && d <= DRAG_MAX;
  }

  function onPointerDown(e) {
    var p = toLogical(e.clientX, e.clientY);
    state.down.x = p.x; state.down.y = p.y;
    state.dragging = false;
    state.dragBranch = null;
    for (var i = 0; i < BRANCHES.length; i++) {
      if (branchInDragRange(BRANCHES[i], p.x, p.y)) { state.dragBranch = BRANCHES[i]; break; }
    }
    if (state.dragBranch) {
      state.dragStartX = p.x;
      state.dragStartRot = state.dragBranch.rotation;
      state.dragging = true;
    }
    try { state.canvas.setPointerCapture(e.pointerId); } catch (_) {}
    if (state.dragging) state.canvas.style.cursor = 'grabbing';
  }

  function onPointerMove(e) {
    var p = toLogical(e.clientX, e.clientY);
    if (state.dragging && state.dragBranch) {
      var dx = p.x - state.dragStartX;
      state.dragBranch.rotation = state.dragStartRot + dx * DRAG_SENS;
      updateAngleUI();
    } else if (!state.dragging) {
      if (cursorOverPlanet(p.x, p.y)) state.canvas.style.cursor = 'pointer';
      else {
        var inRange = BRANCHES.some(function (b) { return branchInDragRange(b, p.x, p.y); });
        state.canvas.style.cursor = inRange ? 'grab' : 'default';
      }
    }
  }

  function onPointerUp(e) {
    var p = toLogical(e.clientX, e.clientY);
    var dist = Math.hypot(p.x - state.down.x, p.y - state.down.y);
    var wasDrag = state.dragging && dist > 6;
    if (!wasDrag) onClick(p.x, p.y);
    state.dragging = false;
    state.dragBranch = null;
    state.canvas.style.cursor = 'grab';
  }

  function cursorOverPlanet(x, y) {
    for (var i = state.hits.length - 1; i >= 0; i--) {
      var h = state.hits[i];
      if (Math.hypot(x - h.x, y - h.y) <= h.r + 2) return true;
    }
    return false;
  }

  function onClick(x, y) {
    var hit = null;
    for (var i = state.hits.length - 1; i >= 0; i--) {
      var h = state.hits[i];
      if (Math.hypot(x - h.x, y - h.y) <= h.r + 3) { hit = h; break; }
    }
    if (hit) openPanel(hit); else closePanel();
  }

  /* =========================================================================
   * 九、信息浮窗
   * ========================================================================= */
  function openPanel(hit) {
    var html = '';
    if (hit.type === 'ceo') {
      html =
        '<button class="close" id="galaxyPanelClose" aria-label="关闭">×</button>' +
        '<div class="head">' +
          '<span class="dot" style="background:' + esc(CEO.color) + ';color:' + esc(CEO.color) + '">' + esc(CEO.emoji) + '</span>' +
          '<div><div class="t">' + esc(CEO.name) + '</div>' +
          '<div class="st">' + esc(CEO.title) + '</div></div>' +
        '</div>' +
        '<div class="rows">' +
          '<div class="row"><span>描述</span><b style="max-width:160px">' + esc(CEO.desc) + '</b></div>' +
        '</div>';
    } else if (hit.type === 'main') {
      var b = hit.branch;
      var kids = b.children.map(function (c) { return '<span class="chip">' + esc(c.name) + '</span>'; }).join('');
      html =
        '<button class="close" id="galaxyPanelClose" aria-label="关闭">×</button>' +
        '<div class="head">' +
          '<span class="dot" style="background:' + esc(b.color) + ';color:' + esc(b.color) + '">' + esc(b.emoji) + '</span>' +
          '<div><div class="t">' + esc(b.name) + ' 分支</div>' +
          '<div class="st">主星球 · 环绕 ' + b.children.length + ' 个部门</div></div>' +
        '</div>' +
        '<div class="kidsTitle">下属部门（' + b.children.length + '）</div>' +
        '<div class="chips">' + kids + '</div>';
    } else {
      var child = hit.branch.children[hit.index];
      html =
        '<button class="close" id="galaxyPanelClose" aria-label="关闭">×</button>' +
        '<div class="head">' +
          '<span class="dot" style="background:' + esc(hit.branch.color) + ';color:' + esc(hit.branch.color) + '">' + (hit.branch.id === 'log' ? '📦' : '🏢') + '</span>' +
          '<div><div class="t">' + esc(child.name) + '</div>' +
          '<div class="st">' + esc(hit.branch.name) + ' · 下属部门</div></div>' +
        '</div>' +
        '<div class="rows">' +
          '<div class="row"><span>负责人</span><b>' + esc(child.leader) + '</b></div>' +
          '<div class="row"><span>描述</span><b style="max-width:160px">' + esc(child.desc) + '</b></div>' +
        '</div>';
    }
    state.panel.innerHTML = html;
    var closeBtn = state.panel.querySelector('#galaxyPanelClose');
    if (closeBtn) closeBtn.addEventListener('click', function (e) { e.stopPropagation(); closePanel(); });
    state.panel.style.display = 'block';

    var rect = state.canvas.getBoundingClientRect();
    var sx = rect.left + hit.x / LOGICAL_W * rect.width;
    var sy = rect.top + hit.y / LOGICAL_H * rect.height;
    var pref = state.panel.getBoundingClientRect();
    var px = sx + hit.r * (rect.width / LOGICAL_W) + 16;
    var py = sy - pref.height / 2;
    px = clamp(px, 8, window.innerWidth - pref.width - 8);
    py = clamp(py, 8, window.innerHeight - pref.height - 8);
    state.panel.style.left = px + 'px';
    state.panel.style.top = py + 'px';
  }

  function closePanel() {
    if (state.panel) state.panel.style.display = 'none';
  }

  /* =========================================================================
   * 十、主循环 + 角度 UI
   * ========================================================================= */
  function updateAngleUI() {
    if (!state.root) return;
    BRANCHES.forEach(function (b) {
      var el = state.root.querySelector('[data-angle][data-branch="' + b.id + '"]');
      if (el) {
        var deg = ((b.rotation * 180 / Math.PI) % 360 + 360) % 360;
        el.textContent = deg.toFixed(0) + '°';
      }
    });
  }

  function frame(ms) {
    var dt = state.lastT ? (ms - state.lastT) : 0;
    state.lastT = ms;
    if (dt > 0 && dt < 100 && state.autoRotate) {
      BRANCHES.forEach(function (b) {
        if (b !== state.dragBranch) b.rotation += b.angularSpeed * (dt / 1000);
      });
      updateAngleUI();
    }
    render();
    state.rafId = requestAnimationFrame(frame);
  }

  function startLoop() {
    if (state.rafId) return;
    state.lastT = 0;
    state.rafId = requestAnimationFrame(frame);
  }
  function stopLoop() {
    if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = 0; }
  }

  /* =========================================================================
   * 十一、初始化
   * ========================================================================= */
  function init() {
    if (state.inited) { startLoop(); return; }
    var root = document.getElementById('galaxy-orgchart');
    if (!root) return;
    var canvas = document.getElementById('galaxy-canvas');
    if (!canvas) return;

    state.root = root;
    state.canvas = canvas;
    state.ctx = canvas.getContext('2d');
    state.stage = canvas.parentElement;
    state.panel = document.getElementById('galaxy-panel');
    state.dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(LOGICAL_W * state.dpr);
    canvas.height = Math.round(LOGICAL_H * state.dpr);
    state.ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in state.ctx) state.ctx.imageSmoothingQuality = 'high';

    // 指针事件
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', function () { state.dragging = false; state.dragBranch = null; });

    // 点击浮窗以外关闭
    document.addEventListener('pointerdown', function (e) {
      if (state.panel && state.panel.style.display === 'block' && !state.panel.contains(e.target) && e.target !== canvas) {
        closePanel();
      }
    });
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });
    window.addEventListener('scroll', closePanel, true);

    // 箭头按钮（手动步进旋转）
    root.querySelectorAll('.galaxy-ctrl').forEach(function (ctrl) {
      var bid = ctrl.getAttribute('data-branch');
      var branch = BRANCHES.filter(function (b) { return b.id === bid; })[0];
      if (!branch) return;
      ctrl.querySelectorAll('.galaxy-arrow').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var step = parseFloat(btn.getAttribute('data-step')) || 0;
          branch.rotation += step * (Math.PI / 9); // 20°
          updateAngleUI();
        });
      });
    });

    // 自动公转开关
    var toggle = root.querySelector('[data-autorotate]');
    if (toggle) {
      toggle.addEventListener('change', function () { state.autoRotate = toggle.checked; });
    }

    // DPR 变化
    window.addEventListener('resize', function () {
      var nd = window.devicePixelRatio || 1;
      if (nd !== state.dpr) {
        state.dpr = nd;
        canvas.width = Math.round(LOGICAL_W * nd);
        canvas.height = Math.round(LOGICAL_H * nd);
        state.ctx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in state.ctx) state.ctx.imageSmoothingQuality = 'high';
      }
    });

    state.inited = true;

    loadImages(function () {
      updateAngleUI();
      startLoop();
    });
  }

  window.initGalaxyOrgChart = init;
  window.stopGalaxyOrgChart = stopLoop;
  document.addEventListener('galaxy:enter', init);
})();
