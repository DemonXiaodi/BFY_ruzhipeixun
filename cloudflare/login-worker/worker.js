// 出口易入职培训 · 企业微信扫码登录 Worker
// 部署：  wrangler deploy
// 本地：  wrangler dev
// 凭证（切勿写进代码，用 secret 注入）：
//   wrangler secret put CORPID
//   wrangler secret put AGENTID
//   wrangler secret put CORPSECRET
//   wrangler secret put VERIFY_TXT        // 企业微信可信域名校验文件内容
//   wrangler secret put SHEET_DOCID       // 智能表格 docid（仅 /seed 与回读基线用，REAL 模式）
//   wrangler secret put SHEET_SHEETID     // 智能表格子表 sheet_id（同上）
// 阶段切换： wrangler.toml 里 [vars] MOCK = "1" 走 mock；拿到凭证改 "0"
// D1 记录用户名：取消 wrangler.toml 里 [[d1_databases]] 注释，并建表（见文件底部注释）

async function getAccessToken(env) {
  const r = await fetch('https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=' + env.CORPID + '&corpsecret=' + env.CORPSECRET);
  const j = await r.json();
  if (j.errcode) throw new Error('gettoken ' + j.errcode + ' ' + j.errmsg);
  return j.access_token;
}
async function getUserId(code, token) {
  const r = await fetch('https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo?access_token=' + token + '&code=' + code);
  const j = await r.json();
  if (j.errcode) throw new Error('getuserinfo ' + j.errcode + ' ' + j.errmsg);
  return j.UserId || j.userid;
}
async function getUserName(userid, token) {
  const r = await fetch('https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=' + token + '&userid=' + userid);
  const j = await r.json();
  if (j.errcode) throw new Error('user/get ' + j.errcode + ' ' + j.errmsg);
  return j.name || userid;
}

function loginHtml(name, userid) {
  return '<!doctype html><html><head><meta charset="utf-8"></head><body>'
    + '<script>window.parent.postMessage({type:"nw_login",name:' + JSON.stringify(name)
    + ',userid:' + JSON.stringify(userid) + '},"*");document.cookie="nw_user="'
    + '+encodeURIComponent(' + JSON.stringify(name) + ')+";path=/;max-age=86400;SameSite=Lax";<\/script>'
    + '<p style="font-family:sans-serif;padding:24px">登录成功，正在返回…</p>'
    + '</body></html>';
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS'
};
// 企业微信智能表格 webhook（接收外部数据地址；key 已含在 URL，可直接使用；如需更稳妥可改为 wrangler secret put SHEET_WEBHOOK）
const SHEET_WEBHOOK = 'https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/webhook?key=7PYedHsWs8VXRTrPYP9vo5pVUfLAxkKnh3nVV8w5x8TdK1HVrx2n5R24E48DyT7aKWMxwjnPADl3347f0jWNRLYJvg8wpzbVHnsGeZS4OjwV';

// ---- 上报时按用户取历史最大值：进度列取 max，测验文本列非空才覆盖 ----
// 智能表格 webhook 是写入型、无法直接读取已有行，故用 D1 记住每用户"历史最大快照"，
// 即使浏览器本地记录全清，表格里该用户的进度也绝不回退（见下方 /report）。
// field id 与前端 SHEET_FIELDS 对齐：进度列 -> prog，测验结果列 -> quiz。
const PROG_FIELDS = ['f9VJqf', 'ftk5Tx', 'ffFwIh', 'fn8TJd', 'fl3KKQ', 'fAqjoj'];
const QUIZ_FIELDS = ['fMwkQa', 'fMcOyv', 'fbMLvo', 'fHxIM6'];
const USER_FIELD = 'f04Gwj';

// 把"本次上报 inc"与"历史 prev"合并：进度列取较大值；测验文本列仅当本次非空才覆盖（空不抹掉已有成绩）
function mergeMax(prev, inc) {
  const m = Object.assign({}, inc);
  PROG_FIELDS.forEach(function (f) {
    const p = prev[f], i = inc[f];
    if (typeof p === 'number' && typeof i === 'number') m[f] = Math.max(p, i);
    else if (typeof p === 'number') m[f] = p;            // 本次缺失但历史有 → 保留历史
  });
  QUIZ_FIELDS.forEach(function (f) {
    const p = prev[f], i = inc[f];
    if (!i && (p || p === 0)) m[f] = p;                  // 本次为空不抹掉历史成绩
  });
  return m;                                              // 用户名/更新时间始终取本次(inc)
}

async function loadMax(env, user) {
  if (!env.DB) return {};
  try {
    const r = await env.DB.prepare('SELECT values_json FROM sheet_max WHERE user = ?').bind(user).first();
    if (r && r.values_json) return JSON.parse(r.values_json);
  } catch (e) {}
  return {};
}
async function saveMax(env, user, values, rid) {
  if (!env.DB) return;
  const obj = Object.assign({}, values); obj._rid = rid || '';   // _rid 仅存 D1，不上报表格
  try {
    await env.DB.prepare(
      'INSERT INTO sheet_max(user, values_json, at) VALUES(?, ?, ?) ' +
      'ON CONFLICT(user) DO UPDATE SET values_json = excluded.values_json, at = excluded.at'
    ).bind(user, JSON.stringify(obj), Date.now()).run();
  } catch (e) {}
}
// 返回 env 里所有"像 D1 绑定"的变量名（有 .prepare 方法），用于诊断（不泄露 secret 内容）
function d1BindingNames(env) {
  return Object.keys(env || {}).filter(function (k) { return env[k] && typeof env[k].prepare === 'function'; });
}

// ---- 从智能表格回读某用户已有行，作为 D1 基线（解决"部署 D1 前已上报的高进度未被保护"的问题）----
// 仅当配置了 SHEET_DOCID + SHEET_SHEETID + CORPSECRET（REAL 模式）时生效；未配置 / MOCK 模式静默跳过。
function cellScalar(cell) {
  if (cell == null) return null;
  if (Array.isArray(cell)) { if (!cell.length) return null; cell = cell[0]; }
  if (cell && typeof cell === 'object') { if ('value' in cell) return cell.value; if ('text' in cell) return cell.text; }
  return cell;
}
function recordToPrev(rec) {
  const v = rec && rec.values; if (!v) return null;
  const p = {};
  p[USER_FIELD] = cellScalar(v[USER_FIELD]);
  PROG_FIELDS.forEach(function (f) { var s = cellScalar(v[f]); if (s != null && !isNaN(Number(s))) p[f] = Number(s); });
  QUIZ_FIELDS.forEach(function (f) { var s = cellScalar(v[f]); if (s != null) p[f] = String(s); });
  p._rid = rec.record_id || '';
  return p;
}
async function seedFromSheet(env, user) {
  if (!env.SHEET_DOCID || !env.SHEET_SHEETID || !env.CORPSECRET) return null;
  try {
    const token = await getAccessToken(env);
    const body = {
      docid: env.SHEET_DOCID, sheet_id: env.SHEET_SHEETID,
      key_type: 'CELL_VALUE_KEY_TYPE_FIELD_ID',
      field_ids: PROG_FIELDS.concat(QUIZ_FIELDS).concat([USER_FIELD]),
      filter_spec: { conjunction: 'CONJUNCTION_AND', conditions: [{ field_id: USER_FIELD, field_type: 'FIELD_TYPE_TEXT', operator: 'OPERATOR_IS', string_value: { value: [user] } }] }
    };
    const r = await fetch('https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/get_records?access_token=' + token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j.errcode) return null;
    if (j.records && j.records[0]) return recordToPrev(j.records[0]);
  } catch (e) {}
  return null;
}

// 写智能表格：有 record_id 走 update_records；若更新失败（如行被删除）回退为 add_records 并返回新 record_id
async function reportSheet(values, rid) {
  async function post(payload) {
    const r = await fetch(SHEET_WEBHOOK, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    let j = null; try { j = await r.json(); } catch (e) {}
    return { status: r.status, json: j };
  }
  if (rid) {
    const upd = await post({ update_records: [{ record_id: rid, values: values }] });
    if (!upd.json || upd.json.errcode) {
      const add = await post({ add_records: [{ values: values }] });
      const out = add.json || { errcode: add.status !== 200 ? -1 : 0, errmsg: 'add fallback' };
      if (add.json && add.json.add_records && add.json.add_records[0]) out._newRid = add.json.add_records[0].record_id;
      return out;
    }
    return upd.json || { errcode: 0 };
  }
  const add = await post({ add_records: [{ values: values }] });
  const out = add.json || { errcode: add.status !== 200 ? -1 : 0, errmsg: 'add' };
  if (add.json && add.json.add_records && add.json.add_records[0]) out._newRid = add.json.add_records[0].record_id;
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 企业微信「网页授权及 JS-SDK 可信域名」校验文件
    if (/^\/WW_verify_.*\.txt$/.test(url.pathname)) {
      return new Response(env.VERIFY_TXT || 'VERIFY_TXT_NOT_SET', { headers: { 'content-type': 'text/plain' } });
    }

    // 扫码确认后的回调：企微带着 ?code=xxx&state=yyy 跳到这里
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code') || 'mock';
      const name0 = '张三', userid0 = 'zhangsan';
      let name = name0, userid = userid0;

      if (env.MOCK === '1' || code === 'mock') {
        // mock 模式：不调用企微接口；名字可由回调 URL 的 ?name= / ?userid= 覆盖，
        // 便于换名验证，无需改代码或重新部署。真实模式（else 分支）绝不读取此参数，避免伪造。
        name = url.searchParams.get('name') || name0;
        userid = url.searchParams.get('userid') || userid0;
      } else {
        try {
          const token = await getAccessToken(env);
          userid = await getUserId(code, token);
          name = await getUserName(userid, token);
        } catch (e) {
          return new Response('企微接口调用失败：' + e.message, { status: 500 });
        }
      }

      // 记录用户名到 D1（若已在 wrangler.toml 绑定 DB）
      if (env.DB) {
        try {
          await env.DB.prepare('INSERT INTO logins(userid,name,login_at) VALUES(?,?,?)')
            .bind(userid, name, Date.now()).run();
        } catch (e) { /* 表未建时忽略；正式上线前先建表 */ }
      }

      return new Response(loginHtml(name, userid), {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'set-cookie': 'nw_user=' + encodeURIComponent(name) + '; Path=/; Max-Age=86400; SameSite=Lax'
        }
      });
    }

    // 浏览器跨域预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ---- 上报学习进度 / 测验结果到企业微信智能表格 webhook（前端经此后端中转，绕开浏览器 CORS） ----
    if (url.pathname === '/report') {
      if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
      let body;
      try { body = await request.json(); } catch (e) { return new Response('bad json', { status: 400 }); }
      const values = body && body.values;
      if (!values || typeof values !== 'object') return new Response('missing values', { status: 400 });
      const rawRid = (body.record_id && String(body.record_id)) || '';
      const user = (values && values[USER_FIELD]) || '用户';
      // 按用户取历史最大值：低进度不覆盖表格里的高进度（需绑定 D1 才生效；未绑定则直写本次）
      let merged = values;
      let effRid = rawRid;
      let maxApplied = false;
      if (env.DB) {
        let prev = await loadMax(env, user);              // D1 历史最大快照（可能含 _rid）
        if (!Object.keys(prev).length) {                  // D1 为空：尝试从智能表格回读该行作为基线（仅 REAL 模式且已配置 docid/sheetid/corpsecret 时生效）
          const seeded = await seedFromSheet(env, user);
          if (seeded && Object.keys(seeded).length) prev = seeded;
        }
        const prevVals = prev ? Object.assign({}, prev) : {};
        const prevRid = prevVals._rid || '';
        delete prevVals._rid;                             // _rid 非表格列，不参与 max
        effRid = rawRid || prevRid || '';                 // 浏览器清缓存也能找回行，避免新增重复行
        merged = mergeMax(prevVals, values);
        maxApplied = Object.keys(prevVals).length > 0;
        await saveMax(env, user, merged, effRid);         // 先存(此时 _rid 可能为空)
      }
      const out = await reportSheet(merged, effRid);
      if (env.DB && out._newRid) await saveMax(env, user, merged, out._newRid);   // add 后补回真实 rid
      out._diag = { dbBound: !!env.DB, user: user, effRid: !!effRid, maxApplied: maxApplied };
      return new Response(JSON.stringify(out), { headers: Object.assign({ 'content-type': 'application/json' }, CORS) });
    }

    // 诊断：只读检查 D1 绑定名 + sheet_max 表是否存在（不写数据）。浏览器直接访问 /diag 即可看结果
    if (url.pathname === '/diag') {
      const names = d1BindingNames(env);
      const db = env.DB || (names.length ? env[names[0]] : null);
      let tableOk = false, err = '', sample = null;
      if (db) {
        try {
          const r = await db.prepare('SELECT user FROM sheet_max LIMIT 1').all();
          tableOk = true;
          if (r && r.results && r.results[0]) sample = r.results[0].user;
        } catch (e) { err = e.message || String(e); }
      }
      return new Response(JSON.stringify({ d1Bindings: names, dbUsed: env.DB ? 'DB' : (names[0] || null), tableOk: tableOk, err: err, sampleUser: sample }), { headers: Object.assign({ 'content-type': 'application/json' }, CORS) });
    }

    // 一次性把智能表格现有数据回填进 D1（部署 D1 前已上报的数据需此步才受保护）。?user=xxx 只回填一人；?all=1 回填全部。需 REAL 模式 + docid/sheetid/corpsecret + 绑定 D1。
    if (url.pathname === '/seed') {
      if (!env.SHEET_DOCID || !env.SHEET_SHEETID || !env.CORPSECRET) return new Response('seed 未配置(需 SHEET_DOCID/SHEET_SHEETID/CORPSECRET)', { status: 400 });
      if (!env.DB) return new Response('seed 需要绑定 D1', { status: 400 });
      try {
        const token = await getAccessToken(env);
        const want = url.searchParams.get('user');
        const body = { docid: env.SHEET_DOCID, sheet_id: env.SHEET_SHEETID, key_type: 'CELL_VALUE_KEY_TYPE_FIELD_ID', field_ids: PROG_FIELDS.concat(QUIZ_FIELDS).concat([USER_FIELD]), limit: 1000 };
        if (want) body.filter_spec = { conjunction: 'CONJUNCTION_AND', conditions: [{ field_id: USER_FIELD, field_type: 'FIELD_TYPE_TEXT', operator: 'OPERATOR_IS', string_value: { value: [want] } }] };
        const r = await fetch('https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/get_records?access_token=' + token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const j = await r.json();
        let n = 0;
        if (j.records) {
          for (const rec of j.records) {
            const p = recordToPrev(rec);
            if (!p || !p[USER_FIELD]) continue;
            const u = String(p[USER_FIELD]);
            await saveMax(env, u, p, p._rid);
            n++;
          }
        }
        return new Response(JSON.stringify({ seeded: n }), { headers: Object.assign({ 'content-type': 'application/json' }, CORS) });
      } catch (e) { return new Response('seed error: ' + e.message, { status: 500 }); }
    }

    // 登录拉取：返回该用户在 D1 的最大进度快照（已上报过才有数据），前端据此回填本地。需绑定 D1。
    if (url.pathname === '/pull') {
      const user = url.searchParams.get('user') || '';
      let values = {};
      if (env.DB) { const p = await loadMax(env, user); if (p) { values = Object.assign({}, p); delete values._rid; } }
      return new Response(JSON.stringify({ user: user, values: values }), { headers: Object.assign({ 'content-type': 'application/json' }, CORS) });
    }

    return new Response('nw-login-worker ok', { headers: { 'content-type': 'text/plain' } });
  }
};
