/**
 * 企业微信智能表格 —— 同步配置（请勿提交到公开仓库）
 *
 * 说明：
 * - 本文件仅存放 Webhook 地址，属于敏感信息，已加入 .gitignore。
 * - 企业微信智能表格 Webhook 为「仅追加」模式：每次提交新增一行，
 *   表格侧通过「工号」筛选该用户全部历史记录，取最新一条作为当前进度。
 * - 若部署到 http(s) 环境（推荐用项目自带的 server.js / start.bat 起本地服务），
 *   浏览器 Origin 为真实域名/localhost，跨域成功率高于直接 file:// 打开（Origin 为 null）。
 */
window.WECOM_CONFIG = {
  // 企业微信智能表格数据收集 Webhook（追加模式）
  webhook: 'https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/webhook?key=6y2ghTaJE5YJAFVb5QnrCMT0fdh3fXP5F4tUvLkivBkXaweAY08cEXWxmPlvAtGsOS2n3XqNRwd2AolZtvFbPIF96GWUa7aFynL5eqhTavFL'
};
