// server.js
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const app = next({
  dev: false,
  dir: '.', // Path to your Next.js app
});
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(process.env.PORT || 3000, () => {
    console.log('> Ready on port', process.env.PORT || 3000);
  });
});
