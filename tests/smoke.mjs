import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync, existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {extname, join, normalize, resolve, dirname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = resolve(repo, process.argv[2] || 'public-site');
const secret = (process.env.CV_ACCESS_SECRET || (existsSync(resolve(repo, '.access-secret')) ? readFileSync(resolve(repo, '.access-secret'), 'utf8') : '')).trim();

function start(root) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webp': 'image/webp'
  };
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    if (rel.split('/').includes('..')) {
      res.writeHead(403);
      res.end();
      return;
    }
    const path = normalize(join(root, rel));
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    readFile(path).then((body) => {
      res.writeHead(200, {'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store'});
      res.end(body);
    }).catch(() => {
      res.writeHead(404);
      res.end();
    });
  });
  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => {
      const {port} = server.address();
      resolvePromise({server, origin: `http://127.0.0.1:${port}/`});
    });
  });
}

const {server, origin} = await start(site);
const browser = await chromium.launch({headless: true});
try {
  const indexSource = await fetch(origin).then((response) => response.text());
  const vaultSource = await fetch(origin + 'private/registers.enc.json').then((response) => response.text());
  if (!indexSource.includes('id="gateway"') || !indexSource.includes('id="registerMount"')) throw new Error('public shell missing');
  if (indexSource.includes('id="view-private"') || indexSource.includes('const PASSWORD')) throw new Error('register markup is in the public html');
  if (vaultSource.includes('id="view-private"') || vaultSource.includes('<h2')) throw new Error('vault file is not ciphertext');
  if (secret && (indexSource.includes(secret) || vaultSource.includes(secret))) throw new Error('access code is in the built site');

  for (const [label, width, height] of [['small-phone', 320, 720], ['phone', 390, 844], ['tablet', 768, 1024], ['desktop', 1440, 900]]) {
    const page = await browser.newPage({viewport: {width, height}});
    const errors = [];
    const requests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => requests.push(request.url()));
    await page.goto(origin);
    if (!await page.locator('#protectedArea').isHidden()) throw new Error(label + ': protected area initially visible');
    if (await page.locator('#view-private, #view-cv, #view-projects').count()) throw new Error(label + ': register DOM exists before unlock');
    const cover = await page.locator('.cover-private').boundingBox();
    if (!cover || cover.width < 40 || cover.height < 40) throw new Error(label + ': private card cover collapsed');
    for (const code of ['de', 'zh', 'en']) {
      await page.locator('[data-lang="' + code + '"]').click();
      if ((await page.locator('html').getAttribute('lang')) !== (code === 'zh' ? 'zh-CN' : code)) throw new Error(label + ': language error');
    }
    const fontSize = await page.locator('#pwdInput').evaluate((el) => getComputedStyle(el).fontSize);
    if (parseFloat(fontSize) < 16) throw new Error(label + ': access input is below 16px');

    for (const path of ['cv', 'projects', 'private']) {
      await page.locator('[data-route="' + path + '"]').click();
      await page.locator('#dialog.show').waitFor({state: 'visible'});
      const card = await page.locator('.dialog-card').boundingBox();
      if (!card || card.x < -1 || card.y < -1 || card.x + card.width > width + 2 || card.y + card.height > height + 2) throw new Error(label + ': dialog does not fit');
      await page.locator('#pwdInput').fill('not-the-access-code');
      await page.locator('#openBtn').click();
      await page.locator('#pwdError').filter({hasText: /.+/}).waitFor({timeout: 20000});
      if (!await page.locator('#protectedArea').isHidden()) throw new Error(label + ': invalid code revealed a register');
      if (await page.locator('#view-' + path).count()) throw new Error(label + ': invalid code injected a register');
      if (!secret) {
        await page.locator('#cancelBtn').click();
        continue;
      }
      await page.locator('#pwdInput').fill(secret);
      await page.locator('#openBtn').click();
      await page.locator('#view-' + path + '.active').waitFor({state: 'visible', timeout: 20000});
      const marker = (await page.locator('#view-' + path + ' p').first().innerText()).trim();
      if (marker.length < 24) throw new Error(label + ': register marker too short');
      if (indexSource.includes(marker) || vaultSource.includes(marker)) throw new Error(label + ': register plaintext is in the built files');
      const dom = await page.content();
      if (dom.includes(secret)) throw new Error(label + ': access code remained in the DOM');
      if (path === 'private') {
        const srcs = await page.locator('#view-private img').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src') || ''));
        for (const src of srcs) {
          if (src.length > 80 && indexSource.includes(src.slice(0, 96))) throw new Error(label + ': private image is in the public html');
        }
      }
      if (path === 'cv') {
        const english = marker;
        await page.locator('[data-lang="de"]').click();
        const german = (await page.locator('#view-cv p').first().innerText()).trim();
        if (german === english) throw new Error(label + ': language switch did not reach the unlocked register');
        await page.locator('[data-lang="en"]').click();
      }
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) throw new Error(label + ': overflow while register is open');
      await page.locator('#backHome').click();
      await page.locator('#protectedArea').waitFor({state: 'hidden'});
      if (await page.locator('#view-' + path).count()) throw new Error(label + ': register stayed in the DOM after locking');
      if ((await page.content()).includes(marker)) throw new Error(label + ': plaintext stayed in the DOM after locking');
    }
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) throw new Error(label + ': overflow');
    if (requests.some((url) => url.includes('.webp'))) throw new Error(label + ': private image was fetched');
    if (secret && !requests.some((url) => url.includes('registers.enc.json'))) throw new Error(label + ': vault was not requested');
    if (errors.length) throw new Error(label + ': ' + errors.join(' ; '));
    await page.close();
    console.log(label + ' PASS' + (secret ? ' (unlock)' : ' (locked only)'));
  }
} finally {
  await browser.close();
  await new Promise((resolvePromise) => server.close(resolvePromise));
}
console.log(secret ? 'smoke ok with unlock' : 'smoke ok without access code');
