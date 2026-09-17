/**
 * 企业微信智能表格同步代理 —— Cloudflare Worker 版
 * ------------------------------------------------------------------
 * 用途：把项目部署到 GitHub Pages / Vercel 等「纯静态托管」后，浏览器无法再走
 *       同源的 server.js 代理，需要一个公网可达、且返回 CORS 头的代理来转发到
 *       企业微信 Webhook。本 Worker 即承担这一角色，密钥留在 Worker Secrets，不下发浏览器。
 *
 * 部署步骤（无需信用卡，免费额度足够）：
 *   1. 打开 https://dash.cloudflare.com/ 注册/登录 → Workers & Pages → 创建 Worker。
 *   2. 把本文件内容粘贴进编辑器，保存并部署，得到形如
 *      https://bfy-sync.<你的子域>.workers.dev 的地址。
 *   3. 在 Worker 的 Settings → Variables → 添加一个 Secret（不是普通变量）：
 *      名称 WECOM_WEBHOOK，值填企业微信智能表格的 Webhook 完整地址。
 *      ⚠️ 粘贴密钥后不要带首尾空格 / 换行，否则 fetch 会因 URL 非法而失败（表现为 502）。
 *   4. 把得到的地址拼接 /api/wecom-sync，填入前端 assets/config.js 的 PROXY_URL，
 *      例如：https://bfy-sync.<你的子域>.workers.dev/api/wecom-sync
 *   5. 重新部署前端（git push 到 GitHub Pages），同步即可在公网使用。
 *
 * 健康检查（排错用）：浏览器打开 https://<你的子域>.workers.dev/health
 *   会返回 JSON，包含 alive / 密钥是否配置 / 是否存在首尾空格 / URL 是否合法 / host，
 *   可用于快速定位「502」是密钥格式问题还是网络问题。
 *
 * 安全说明：Worker 默认回显请求方 Origin（允许任意站点调用）。如需收紧，可把
 *   corsHeaders 里的 origin 改成固定值，如 'https://demonxiaodi.github.io'。
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 健康检查端点：确认脚本在线 + 诊断密钥配置（不泄露完整密钥）
    if (url.pathname === '/health' || url.pathname === '/') {
      const raw = env.WECOM_WEBHOOK || '';
      const trimmed = raw.trim();
      let host = 'INVALID_URL';
      try { host = new URL(trimmed).host; } catch (e) { /* ignore */ }
      return json({
        alive: true,
        hasSecret: raw.length > 0,
        secretLen: raw.length,
        secretTrimmedLen: trimmed.length,
        hasSurroundingWhitespace: raw.length !== trimmed.length,
        startsWithHttps: trimmed.startsWith('https://'),
        host
      }, 200, corsHeaders(request));
    }

    // 只处理同步代理路径
    if (url.pathname !== '/api/wecom-sync') {
      return new Response('Not Found', { status: 404 });
    }

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders(request) });
    }

    // 去除首尾空格 / 换行，避免 Secret 粘贴时带入不可见字符导致 fetch 报 Invalid URL
    const webhook = (env.WECOM_WEBHOOK || '').trim();
    if (!webhook) {
      return json({ errcode: -1, errmsg: 'Worker 未配置 WECOM_WEBHOOK 密钥' }, 500, corsHeaders(request));
    }

    // 转发到企业微信，密钥在服务端，浏览器看不到
    let upstream;
    try {
      const body = await request.text();
      upstream = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
    } catch (e) {
      // 出站请求失败（URL 非法 / Cloudflare 网络层连不上企业微信等），把真实错误返回，便于排错
      return json({
        errcode: -2,
        errmsg: '代理转发企业微信失败',
        detail: String(e && e.message ? e.message : e)
      }, 502, corsHeaders(request));
    }

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: Object.assign(
        { 'Content-Type': 'application/json; charset=utf-8' },
        corsHeaders(request)
      )
    });
  }
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function json(obj, status, extraHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, extraHeaders || {})
  });
}
