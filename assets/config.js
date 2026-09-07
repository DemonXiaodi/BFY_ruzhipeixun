/**
 * 企业微信智能表格 —— 前端同步配置（不含任何密钥，可放心提交）
 *
 * 说明：
 * - 浏览器只调用同源代理路径 /api/wecom-sync，由项目自带的 server.js 代为转发到企业微信。
 * - 企业微信 Webhook 密钥已移至服务端：server-config.json（或环境变量 WECOM_WEBHOOK），
 *   密钥不再下发到浏览器，既规避 CORS，也避免泄露。
 * - 必须通过本地服务(http)打开才能同步：用 server.js / start.bat 启动后访问
 *   http://127.0.0.1:端口/index.html。直接 file:// 双击打开会因无同源服务而无法同步。
 */
window.WECOM_CONFIG = {
  // 同源代理路径（server.js 提供），dataCollector.js 会优先使用它转发
  endpoint: '/api/wecom-sync'
};
