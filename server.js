// 零依赖静态文件服务（Python 不可用时的兜底方案）
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || Number(process.argv[2]) || 5180;
const ROOT = __dirname;

// CORS：允许浏览器跨域调用本代理（静态托管场景）。
// 默认回显请求方 Origin（即允许任何带 Origin 的站点调用）；
// 若只想放开给固定站点，把下面 '*' 改成具体地址，如 'https://demonxiaodi.github.io'。
function corsHeaders(req) {
  const origin = (req && req.headers && req.headers.origin) || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

// 服务端持有的企业微信 Webhook（密钥不下发浏览器）：优先环境变量，其次 server-config.json
function loadWebhook() {
  if (process.env.WECOM_WEBHOOK) return process.env.WECOM_WEBHOOK;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'server-config.json'), 'utf8'));
    if (j && j.webhook) return j.webhook;
  } catch (e) {
    /* 无配置文件时回退到环境变量/为空 */
  }
  return '';
}


const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
};

http
  .createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end('Bad Request');
      return;
    }
    if (urlPath === '/') urlPath = '/index.html';

    // 代理的 CORS 预检：浏览器跨域 POST(带 JSON) 会先发 OPTIONS，必须回 204 + CORS 头
    if (req.method === 'OPTIONS' && urlPath === '/api/wecom-sync') {
      res.writeHead(204, corsHeaders(req));
      res.end();
      return;
    }

    // ---- 企业微信智能表格同步代理（同源，绕开浏览器 CORS）----
    // 浏览器只调同域 /api/wecom-sync；密钥仅在服务端（server-config.json / 环境变量），不下发浏览器。
    if (req.method === 'POST' && urlPath === '/api/wecom-sync') {
      const webhook = loadWebhook();
      if (!webhook) {
        res.writeHead(500, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, corsHeaders(req)));
        res.end(JSON.stringify({ errcode: -1, errmsg: '服务端未配置企业微信 Webhook（请设置 server-config.json 或环境变量 WECOM_WEBHOOK）' }));
        return;
      }
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const client = webhook.startsWith('https') ? https : http;
        const upstream = client.request(
          webhook,
          { method: 'POST', headers: { 'Content-Type': 'application/json' } },
          (up) => {
            let out = '';
            up.on('data', (d) => (out += d));
            up.on('end', () => {
              res.writeHead(up.statusCode, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, corsHeaders(req)));
              res.end(out);
            });
          }
        );
        upstream.on('error', (e) => {
          res.writeHead(502, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, corsHeaders(req)));
          res.end(JSON.stringify({ errcode: -2, errmsg: '上游企业微信服务异常：' + e.message }));
        });
        upstream.write(body);
        upstream.end();
      });
      return;
    }

    const filePath = path.join(ROOT, urlPath);
    // 防目录穿越
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found: ' + urlPath);
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log('');
    console.log('  出口易新人培训平台 已启动');
    console.log('  --------------------------------------');
    console.log('  本地地址: http://127.0.0.1:' + PORT + '/index.html');
    console.log('');
    console.log('  停止服务: 在此窗口按 Ctrl + C，或直接关闭窗口');
    console.log('');
  });
