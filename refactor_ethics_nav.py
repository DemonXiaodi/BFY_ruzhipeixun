import io, re

SRC = r"C:\Users\BFE\WorkBuddy\2026-09-02-10-34-35\project\入职培训平台-完整项目\assets\ethics.html"

with io.open(SRC, "r", encoding="utf-8") as f:
    html = f.read()

# ========== 1. 替换左侧边栏 HTML ==========
OLD_SIDEBAR = '''<div class="eth-layout">
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

NEW_SIDEBAR = '''<div class="eth-layout">
  <!-- ===== 左侧竖导航（财务报销风格） ===== -->
  <aside class="sidebar" data-component="ethics-side-nav">
    <div class="sidebar-title">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2.5 4.5H13.5M2.5 8H13.5M2.5 11.5H9.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      </svg>
      职业道德培训
    </div>

    <div class="side-progress">
      <div class="side-progress-label">学习进度 <b id="progressNum">0</b> / 5</div>
      <div class="progressbar"><div class="progressbar-fill" id="progressFill"></div></div>
    </div>

    <nav class="modnav" id="modnav"><!-- JS 渲染 --></nav>

    <button class="reset-btn side-reset" id="resetBtn" title="重置所有学习进度">重置进度</button>
  </aside>

<!-- 主内容 -->'''

assert OLD_SIDEBAR in html, "OLD_SIDEBAR not found"
html = html.replace(OLD_SIDEBAR, NEW_SIDEBAR, 1)

# ========== 2. 删除旧的左侧导航样式，添加财务报销风格样式 ==========
OLD_CSS = '''  /* ============ 职业道德：左侧导航布局 ============ */
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
  }'''

NEW_CSS = '''  /* ============ 职业道德：左侧导航布局（财务报销风格） ============ */
  body{min-height:100vh;}
  .eth-layout{display:flex;align-items:stretch;min-height:100vh;}
  .sidebar{
    position:sticky;top:0;align-self:flex-start;
    width:288px;flex:none;height:100vh;overflow-y:auto;
    background:var(--surface);
    border-right:1px solid var(--line);
    padding:22px 16px 22px 18px;
    display:flex;flex-direction:column;gap:14px;
    scrollbar-width:thin;
  }
  .sidebar::-webkit-scrollbar{width:6px}
  .sidebar::-webkit-scrollbar-thumb{background:var(--line);border-radius:99px}
  .sidebar-title{
    display:flex;align-items:center;gap:8px;
    font-size:13px;font-weight:700;color:var(--muted);letter-spacing:.08em;
    padding:4px 8px 12px;border-bottom:1px solid var(--line);margin-bottom:2px;
  }
  .sidebar-title svg{color:var(--primary);flex-shrink:0}
  .side-progress{padding:0 8px}
  .side-progress-label{font-size:12.5px;color:var(--ink-2);white-space:nowrap;margin-bottom:6px}
  .side-progress-label b{color:var(--primary);font-size:15px}
  .sidebar .progressbar{width:100%;height:8px;border-radius:99px;background:#e6ebf3;overflow:hidden}
  .sidebar .progressbar-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--teal),#3ec9b0);transition:width .6s cubic-bezier(.22,1,.36,1)}

  .modnav{display:flex;flex-direction:column;gap:3px;flex-wrap:nowrap;padding:0 2px}
  .nav-group{margin-bottom:2px}
  .nav-group-head{
    width:100%;display:flex;align-items:center;gap:10px;
    padding:10px 10px 10px 12px;border:none;border-radius:10px;
    background:transparent;font-family:inherit;color:var(--fg);font-size:14px;font-weight:700;
    letter-spacing:.01em;cursor:pointer;text-align:left;transition:background .15s ease, color .15s ease;
  }
  .nav-group-head:hover{background:var(--surface-2);color:var(--ink)}
  .nav-group-head .nav-num{
    flex-shrink:0;font-size:11px;font-weight:700;letter-spacing:.04em;
    font-family:"SF Mono",Consolas,"Courier New",monospace;
    color:var(--primary);background:color-mix(in srgb, var(--primary) 10%, transparent);
    border-radius:6px;padding:2px 6px;
  }
  .nav-group-head .glabel{flex:1}
  .nav-group-head .chevron{color:var(--faint);transition:transform .2s ease;flex-shrink:0}
  .nav-group.open > .nav-group-head .chevron{transform:rotate(180deg)}
  .nav-group-head .nav-check{
    font-size:10.5px;font-weight:700;color:var(--teal);background:var(--teal-soft);
    border-radius:6px;padding:1px 6px;white-space:nowrap;flex-shrink:0;
  }
  .nav-group-head .lock-tip{
    font-size:10.5px;letter-spacing:.06em;color:var(--faint);border:1px solid var(--line);
    border-radius:5px;padding:1px 6px;flex-shrink:0;
  }

  .nav-children{display:none;padding:2px 0 6px 0}
  .nav-group.open > .nav-children{display:block}
  .nav-leaf{
    display:flex;align-items:center;gap:8px;width:100%;
    padding:7px 10px 7px 42px;border:none;border-radius:9px;
    background:transparent;font-family:inherit;color:var(--muted);font-size:13px;
    letter-spacing:.01em;cursor:pointer;text-align:left;position:relative;
    transition:background .15s ease, color .15s ease;
  }
  .nav-leaf::before{
    content:"";position:absolute;left:26px;top:50%;transform:translateY(-50%);
    width:5px;height:5px;border-radius:50%;background:color-mix(in srgb, var(--fg) 22%, transparent);
  }
  .nav-leaf:hover{background:var(--surface-2);color:var(--ink)}
  .nav-leaf.is-active{
    background:color-mix(in srgb, var(--primary) 9%, transparent);color:var(--primary);font-weight:700;
  }
  .nav-leaf.is-active::before{background:var(--primary)}

  .side-reset{
    margin-top:auto;border:1px solid var(--line);background:#fff;color:var(--muted);
    font-size:12px;padding:8px 12px;border-radius:9px;cursor:pointer;transition:.18s;font-family:var(--font);
  }
  .side-reset:hover{color:var(--red);border-color:#f3c6c3;background:var(--red-soft)}
  .eth-layout > main{max-width:none;margin:0;flex:1;width:auto;padding:30px 38px 80px;background:var(--bg)}

  @media(max-width:860px){
    .eth-layout{flex-direction:column}
    .sidebar{position:static;width:100%;height:auto;border-right:none;border-bottom:1px solid var(--line)}
    .side-reset{margin-top:10px}
    .eth-layout > main{padding:22px 18px 60px}
  }'''

assert OLD_CSS in html, "OLD_CSS not found"
html = html.replace(OLD_CSS, NEW_CSS, 1)

# ========== 3. 给主内容小节加 id，方便导航定位 ==========
# 模块01
html = html.replace('<h3 class="section-title mt24">为什么需要保密？</h3>', '<h3 class="section-title mt24" id="m1-why">为什么需要保密？</h3>', 1)
html = html.replace('<div class="challenge" id="m1Challenge">', '<div class="challenge" id="m1-challenge">', 1)
# 模块02
html = html.replace('<h3 class="section-title mt32">📖 情景案例 · 小王跳槽</h3>', '<h3 class="section-title mt32" id="m2-story">📖 情景案例 · 小王跳槽</h3>', 1)
# 模块03
html = html.replace('<h3 class="section-title">📇 五项职业道德准则</h3>', '<h3 class="section-title" id="m3-principles">📇 五项职业道德准则</h3>', 1)
html = html.replace('<div class="redzone">', '<div class="redzone" id="m3-redlines">', 1)
# 模块04
html = html.replace('<div id="scenarioList"></div>', '<div id="scenarioList"></div>\n    <div id="m4-scenarios" style="position:absolute;margin-top:-20px"></div>', 1)
html = html.replace('<div class="panel-head" style="margin-top:8px">\n      <span class="tag">🕳️ 识别利益诱惑</span>', '<div class="panel-head" style="margin-top:8px" id="m4-temptations">\n      <span class="tag">🕳️ 识别利益诱惑</span>', 1)
html = html.replace('<div class="panel-head" style="margin-top:8px">\n      <span class="tag">🎁 你会怎么判断？</span>', '<div class="panel-head" style="margin-top:8px" id="m4-gifts">\n      <span class="tag">🎁 你会怎么判断？</span>', 1)
# 模块05
html = html.replace('<div class="grid g3" id="valueGrid"></div>', '<div class="grid g3" id="valueGrid"></div>\n    <div id="m5-values" style="position:absolute;margin-top:-20px"></div>', 1)

# ========== 4. 修改 JS：renderNav / showModule / navTargetBtn ==========
OLD_RENDER_NAV = '''function renderNav(){
  const nav = $("#modnav");
  nav.innerHTML = "";
  MODULES.forEach(m=>{
    const b = document.createElement("button");
    b.className = "nav-pill" + (state.modules[m.id-1] ? " done" : "");
    b.dataset.target = m.id;
    b.innerHTML = `<span class="nav-num">${m.num}</span><span>${m.icon}</span><span>${m.name}</span>` +
      (state.modules[m.id-1] ? `<span class="nav-check">✓ 已完成</span>` : "");
    b.addEventListener("click", ()=>showModule(m.id));
    nav.appendChild(b);
  });
  // 终极挑战
  const exam = document.createElement("button");
  exam.className = "nav-pill" + (state.examDone ? " done" : "") + (completedCount()<5 ? " locked" : "");
  exam.dataset.target = "exam";
  exam.innerHTML = `<span class="nav-num">🏆</span><span>终极挑战</span>` +
    (completedCount()<5 ? `<span class="nav-check" style="opacity:.7">🔒 完成5模块解锁</span>` :
      (state.examDone ? `<span class="nav-check">✓ 已通过</span>` : `<span class="nav-next-badge">GO</span>`));
  exam.addEventListener("click", ()=>{
    if(completedCount()<5){ toast("先完成 5 个学习模块，才能进入终极挑战哦"); return; }
    showModule("exam");
  });
  nav.appendChild(exam);
}'''

NEW_RENDER_NAV = '''const NAV_LEAVES = {
  1:[{id:"m1-know",label:"什么是保密信息"},{id:"m1-why",label:"为什么需要保密"},{id:"m1-challenge",label:"保密信息判断挑战"}],
  2:[{id:"m2-track",label:"职业赛道与护栏"},{id:"m2-story",label:"情景案例 · 小王跳槽"}],
  3:[{id:"m3-principles",label:"五项职业道德准则"},{id:"m3-redlines",label:"四条职业红线"}],
  4:[{id:"m4-scenarios",label:"情景判断"},{id:"m4-temptations",label:"识别利益诱惑"},{id:"m4-gifts",label:"礼品与利益判断"}],
  5:[{id:"m5-values",label:"我们守护的价值"},{id:"m5-finish",label:"完成本模块"}],
};

function renderNav(){
  const nav = $("#modnav");
  nav.innerHTML = "";
  MODULES.forEach(m=>{
    const done = state.modules[m.id-1];
    const isActive = state.currentModule === m.id;
    const group = document.createElement("div");
    group.className = "nav-group" + ((isActive || done) ? " open" : "");
    group.dataset.module = m.id;
    group.innerHTML = `
      <button class="nav-group-head" type="button" aria-expanded="${isActive || done}">
        <span class="nav-num">${m.num}</span>
        <span class="glabel">${m.name}</span>
        ${done ? `<span class="nav-check">✓ 已完成</span>` : ""}
        <svg class="chevron" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.5 6L8 10.5L12.5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="nav-children">
        ${(NAV_LEAVES[m.id] || []).map(leaf=>`<button class="nav-leaf${isActive && state.currentLeaf===leaf.id ? ' is-active':''}" type="button" data-module="${m.id}" data-leaf="${leaf.id}">${leaf.label}</button>`).join("")}
      </div>`;
    const head = group.querySelector(".nav-group-head");
    head.addEventListener("click", ()=>{
      group.classList.toggle("open");
      showModule(m.id);
    });
    group.querySelectorAll(".nav-leaf").forEach(leaf=>{
      leaf.addEventListener("click", ()=>{
        state.currentLeaf = leaf.dataset.leaf;
        showModule(Number(leaf.dataset.module));
        const el = document.getElementById(leaf.dataset.leaf);
        if(el) setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}), 80);
      });
    });
    nav.appendChild(group);
  });

  // 终极挑战
  const examLocked = completedCount() < 5;
  const examDone = state.examDone;
  const examActive = state.currentModule === "exam";
  const examGroup = document.createElement("div");
  examGroup.className = "nav-group" + (examActive ? " open" : "");
  examGroup.innerHTML = `
    <button class="nav-group-head" type="button" aria-expanded="${examActive}">
      <span class="nav-num">🏆</span>
      <span class="glabel">终极挑战</span>
      ${examLocked ? `<span class="lock-tip">完成5模块解锁</span>` : (examDone ? `<span class="nav-check">✓ 已通过</span>` : "")}
      <svg class="chevron" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3.5 6L8 10.5L12.5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <div class="nav-children">
      <button class="nav-leaf${examActive ? ' is-active':''}" type="button" data-module="exam" data-leaf="exam-main">综合能力测试</button>
    </div>`;
  examGroup.querySelector(".nav-group-head").addEventListener("click", ()=>{
    if(examLocked){ toast("先完成 5 个学习模块，才能进入终极挑战哦"); return; }
    examGroup.classList.toggle("open");
    showModule("exam");
  });
  examGroup.querySelector(".nav-leaf").addEventListener("click", ()=>{
    if(examLocked){ toast("先完成 5 个学习模块，才能进入终极挑战哦"); return; }
    state.currentLeaf = "exam-main";
    showModule("exam");
  });
  nav.appendChild(examGroup);
}'''

assert OLD_RENDER_NAV in html, "OLD_RENDER_NAV not found"
html = html.replace(OLD_RENDER_NAV, NEW_RENDER_NAV, 1)

# 修改 showModule：记录当前模块/叶子、更新 panel active、重新渲染 nav
OLD_SHOW_MODULE = '''function showModule(id){
  $$(".module-panel").forEach(p=>p.classList.remove("active"));
  $$(".nav-pill").forEach(p=>p.classList.remove("active"));
  const panel = $("#mod-"+id);
  if(panel) panel.classList.add("active");
  const btn = navTargetBtn(id);
  if(btn) btn.classList.add("active");
  window.scrollTo({ top:0, behavior:"smooth" });
}'''

NEW_SHOW_MODULE = '''function showModule(id){
  state.currentModule = id;
  if(id !== "exam") state.currentLeaf = state.currentLeaf || (NAV_LEAVES[id] && NAV_LEAVES[id][0] ? NAV_LEAVES[id][0].id : null);
  $$(".module-panel").forEach(p=>p.classList.remove("active"));
  const panel = $("#mod-"+id);
  if(panel) panel.classList.add("active");
  renderNav();
  window.scrollTo({ top:0, behavior:"smooth" });
}'''

assert OLD_SHOW_MODULE in html, "OLD_SHOW_MODULE not found"
html = html.replace(OLD_SHOW_MODULE, NEW_SHOW_MODULE, 1)

# 删除旧的 navTargetBtn（不再需要）
OLD_NAV_TARGET_BTN = '''function navTargetBtn(id){
  const pills = $$(".nav-pill");
  if(id==="exam") return pills[pills.length-1];
  const m = MODULES.find(x=>x.id===Number(id));
  if(!m) return null;
  return pills[MODULES.indexOf(m)];
}

'''
assert OLD_NAV_TARGET_BTN in html, "OLD_NAV_TARGET_BTN not found"
html = html.replace(OLD_NAV_TARGET_BTN, "", 1)

# ========== 5. 给状态加 currentModule / currentLeaf 默认值，并在 init 时设置 ==========
OLD_STATE = '''const state = {
  modules: [false,false,false,false,false], // 5 个模块完成状态
  examDone: false,
  examScore: null,'''

NEW_STATE = '''const state = {
  modules: [false,false,false,false,false], // 5 个模块完成状态
  currentModule: 1,
  currentLeaf: "m1-know",
  examDone: false,
  examScore: null,'''

assert OLD_STATE in html, "OLD_STATE not found"
html = html.replace(OLD_STATE, NEW_STATE, 1)

# 修改 init 函数：先渲染内容，再 renderNav，最后 showModule(state.currentModule || 1)
OLD_INIT_BLOCK = '''function init(){
  load();
  renderNav();
  renderProgress();
  renderPrinciples();
  renderRedlines();
  renderScenarios();
  renderGifts();
  renderValues();
  startM1();
  bindStory();
  bindSupplier();
  bindM5();'''
NEW_INIT_BLOCK = '''function init(){
  load();
  renderProgress();
  renderPrinciples();
  renderRedlines();
  renderScenarios();
  renderGifts();
  renderValues();
  startM1();
  bindStory();
  bindSupplier();
  bindM5();
  renderNav();'''
assert OLD_INIT_BLOCK in html, "OLD_INIT_BLOCK not found"
html = html.replace(OLD_INIT_BLOCK, NEW_INIT_BLOCK, 1)

OLD_SHOWMODULE_1 = '''  // 首次进入：若全部完成，展示完成页入口
  showModule("1");'''
NEW_SHOWMODULE_1 = '''  // 首次进入：若全部完成，展示完成页入口
  showModule(state.currentModule || 1);'''
assert OLD_SHOWMODULE_1 in html, "OLD_SHOWMODULE_1 not found"
html = html.replace(OLD_SHOWMODULE_1, NEW_SHOWMODULE_1, 1)

# 持久化加入 currentModule / currentLeaf
OLD_SAVE = '''function save(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify({modules:state.modules, examDone:state.examDone, examScore:state.examScore})); }catch(e){}
}'''
NEW_SAVE = '''function save(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify({
    modules:state.modules, currentModule:state.currentModule, currentLeaf:state.currentLeaf,
    examDone:state.examDone, examScore:state.examScore
  })); }catch(e){}
}'''
assert OLD_SAVE in html, "OLD_SAVE not found"
html = html.replace(OLD_SAVE, NEW_SAVE, 1)

OLD_LOAD = '''function load(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return;
    const d = JSON.parse(raw);
    if(d.modules) state.modules = d.modules;
    if(d.examDone) state.examDone = d.examDone;
    if(d.examScore!=null) state.examScore = d.examScore;
  }catch(e){}
}'''
NEW_LOAD = '''function load(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return;
    const d = JSON.parse(raw);
    if(d.modules) state.modules = d.modules;
    if(d.currentModule!=null) state.currentModule = d.currentModule;
    if(d.currentLeaf!=null) state.currentLeaf = d.currentLeaf;
    if(d.examDone) state.examDone = d.examDone;
    if(d.examScore!=null) state.examScore = d.examScore;
  }catch(e){}
}'''
assert OLD_LOAD in html, "OLD_LOAD not found"
html = html.replace(OLD_LOAD, NEW_LOAD, 1)

# ========== 6. 给 m5 完成按钮加 id，方便导航定位 ==========
# 已经在 m5-finish 锚点通过 JS 处理：给完成按钮所在卡片加 id
html = html.replace(
    '<div class="card know-card mt24" style="text-align:center">\n      <div class="ico" style="margin:0 auto 10px">🛡️</div>',
    '<div class="card know-card mt24" style="text-align:center" id="m5-finish">\n      <div class="ico" style="margin:0 auto 10px">🛡️</div>',
    1
)

# ========== 7. 写入文件 ==========
with io.open(SRC, "w", encoding="utf-8") as f:
    f.write(html)

print("refactored:", len(html), "chars")
