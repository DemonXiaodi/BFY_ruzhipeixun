import io

SRC = r"D:/dsh_work/职业道德培训.html"
OUT = r"C:/Users/BFE/WorkBuddy/2026-09-02-10-34-35/project/入职培训平台-完整项目/assets/ethics.html"

with io.open(SRC, "r", encoding="utf-8") as f:
    html = f.read()

# 1) 移除顶栏 + Hero + 横向模块导航，替换为左侧导航布局
OLD_TOP = '''<!-- 顶栏 -->
<header class="topbar">
  <div class="topbar-inner">
    <div class="brand">
      <div class="brand-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
      </div>
      <div class="brand-txt">
        <div class="small">企业新人入职培训平台</div>
        <div class="big">职业道德培训</div>
      </div>
    </div>
    <div class="progress-wrap">
      <span class="progress-label">学习进度 <b id="progressNum">0</b> / 5</span>
      <div class="progressbar"><div class="progressbar-fill" id="progressFill"></div></div>
      <button class="reset-btn" id="resetBtn" title="重置所有学习进度">重置进度</button>
    </div>
  </div>
</header>

<!-- Hero -->
<section class="hero">
  <div class="hero-card">
    <div class="hero-kicker">🛡️ 新员工必修 · 职业道德</div>
    <h1>职业道德培训</h1>
    <p class="subtitle">守住职业底线，成为值得信赖的职场人</p>
    <div class="desc">工作能力决定你能走多快，职业操守决定你能走多远。</div>
  </div>
</section>

<!-- 模块导航 -->
<div class="modnav-wrap">
  <nav class="modnav" id="modnav">
    <!-- JS 渲染 -->
  </nav>
</div>

<!-- 主内容 -->'''

NEW_TOP = '''<div class="eth-layout">
  <aside class="eth-sidebar">
    <div class="side-brand">
      <div class="side-badge">🛡️</div>
      <div>
        <div class="side-title">职业道德</div>
        <div class="side-sub">企业新人入职培训</div>
      </div>
    </div>
    <div class="side-progress">
      <div class="side-progress-label">学习进度 <b id="progressNum">0</b> / 5</div>
      <div class="progressbar"><div class="progressbar-fill" id="progressFill"></div></div>
    </div>
    <div class="side-nav-label">学习模块</div>
    <nav class="modnav" id="modnav"><!-- JS 渲染 --></nav>
    <button class="reset-btn side-reset" id="resetBtn" title="重置所有学习进度">重置进度</button>
    <div class="side-foot">守住职业底线，<br>成为值得信赖的职场人</div>
  </aside>

<!-- 主内容 -->'''

assert OLD_TOP in html, "OLD_TOP not found"
html = html.replace(OLD_TOP, NEW_TOP, 1)

# 2) 关闭布局容器（在 </main> 后）
assert "</main>\n" in html, "main close not found"
html = html.replace("</main>\n", "</main>\n</div><!-- /eth-layout -->\n", 1)

# 3) 在 </style> 前注入：平台色覆盖 + 左侧导航布局样式
NEW_CSS = '''
  /* ============ 职业道德：平台色覆盖 ============ */
  :root{
    --primary:#2E6BE6;
    --primary-2:#1F4FBF;
    --primary-soft:#E8F0FF;
    --radius:14px;
    --radius-sm:12px;
  }

  /* ============ 职业道德：左侧导航布局 ============ */
  body{min-height:100vh;}
  .eth-layout{display:flex;align-items:stretch;min-height:100vh;}
  .eth-sidebar{
    position:sticky;top:0;align-self:flex-start;
    width:288px;flex:none;height:100vh;overflow-y:auto;
    background:linear-gradient(180deg,#1F4FBF 0%,#2E6BE6 55%,#4f7ef0 100%);
    color:#fff;padding:26px 20px;display:flex;flex-direction:column;gap:16px;
  }
  .side-brand{display:flex;align-items:center;gap:12px}
  .side-badge{width:46px;height:46px;border-radius:13px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:23px;flex:none;box-shadow:0 8px 20px rgba(0,0,0,.18)}
  .side-title{font-size:19px;font-weight:800;letter-spacing:.3px}
  .side-sub{font-size:12px;opacity:.82;letter-spacing:.5px;margin-top:2px}
  .side-progress-label{font-size:13px;opacity:.95}
  .side-progress-label b{font-size:17px;font-weight:800}
  .eth-sidebar .progressbar{width:100%;height:9px;background:rgba(255,255,255,.25)}
  .eth-sidebar .progressbar-fill{background:linear-gradient(90deg,#7fe0c8,#33c7a4);border-radius:99px;transition:width .6s cubic-bezier(.22,1,.36,1)}
  .side-nav-label{font-size:12px;font-weight:700;letter-spacing:1px;opacity:.8;margin-top:6px}
  .modnav{display:flex;flex-direction:column;gap:9px;flex-wrap:nowrap}
  .nav-pill{
    width:100%;justify-content:flex-start;gap:11px;
    background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);
    color:#fff;padding:12px 14px;border-radius:13px;cursor:pointer;font-size:14.5px;font-weight:600;
    transition:.18s;font-family:var(--font);position:relative;
  }
  .nav-pill:hover{border-color:rgba(255,255,255,.55);background:rgba(255,255,255,.2);transform:translateX(2px);box-shadow:none}
  .nav-pill .nav-num{font-size:11px;font-weight:800;color:#fff;background:rgba(255,255,255,.2);border-radius:7px;padding:3px 7px;flex:none}
  .nav-pill.active{background:#fff;color:var(--primary);border-color:#fff;box-shadow:0 12px 26px rgba(15,31,51,.22)}
  .nav-pill.active .nav-num{background:var(--primary-soft);color:var(--primary)}
  .nav-pill.done{background:rgba(255,255,255,.16)}
  .nav-pill.done.active{background:#fff}
  .nav-pill .nav-check{margin-left:auto}
  .nav-pill.done .nav-check{opacity:1;transform:scale(1);background:rgba(15,163,138,.16);color:#0c7a44;font-weight:700}
  .nav-pill.active .nav-check{background:#e6f7f3;color:#0c7a44}
  .nav-pill.locked{opacity:.6;cursor:not-allowed}
  .nav-pill.locked:hover{transform:none;box-shadow:none;border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.10)}
  .nav-next-badge{margin-left:auto;position:static}
  .side-reset{margin-top:auto;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.12);color:#fff;font-size:12.5px;padding:8px 12px;border-radius:9px;cursor:pointer;transition:.18s;font-family:var(--font)}
  .side-reset:hover{background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.5)}
  .side-foot{font-size:11.5px;opacity:.72;line-height:1.6;padding-top:6px;border-top:1px solid rgba(255,255,255,.18)}
  .eth-layout > main{max-width:none;margin:0;flex:1;width:auto;padding:30px 38px 80px}

  @media(max-width:860px){
    .eth-layout{flex-direction:column}
    .eth-sidebar{position:static;width:100%;height:auto;flex-direction:column}
    .side-reset{margin-top:14px}
    .eth-layout > main{padding:22px 18px 60px}
  }
'''

assert "</style>" in html, "style close not found"
html = html.replace("</style>", NEW_CSS + "\n</style>", 1)

with io.open(OUT, "w", encoding="utf-8") as f:
    f.write(html)
print("ethics.html written:", len(html), "chars")
