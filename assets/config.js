/**
 * 企业微信智能表格 —— 前端同步配置（不含任何密钥，可安全提交到公开仓库）
 *
 * 同步原理：
 *   浏览器不能直接调用企业微信 Webhook（对方不返回 CORS 头，会被同源策略拦截），
 *   必须经过一个「同源或带 CORS 头的代理」转发。密钥只留在代理服务端，绝不下发浏览器。
 *
 * 本文件按运行环境自动选择代理地址：
 *   - 本地（127.0.0.1 / localhost）：走同源代理 server.js 的 /api/wecom-sync
 *   - 部署到 GitHub Pages / Vercel 等静态托管：没有同源代理，必须指向你单独部署的代理服务
 *     （见 cloudflare-worker.js，或把 server.js 部署到 Render / Railway / Fly 等并开启 CORS）
 */
(function () {
  'use strict';

  // ↓↓↓ 部署到 GitHub Pages 等静态托管时，指向你部署好的代理地址 ↓↓↓
  // 例：Cloudflare Worker 部署后得到 https://xxx.workers.dev/api/wecom-sync
  // 仅本地运行时这一行不会被用到，可留作占位。
  var PROXY_URL = 'https://bef.anna1755670972.workers.dev/api/wecom-sync';

  var isLocal =
    location.hostname === '127.0.0.1' || location.hostname === 'localhost';

  window.WECOM_CONFIG = {
    // 本地：同源路径，由 server.js 转发；部署：指向独立的公网代理（带 CORS 头）
    endpoint: isLocal ? '/api/wecom-sync' : PROXY_URL
  };
})();
