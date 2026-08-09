import { defineConfig } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';

// 開発用：ページから POST /__shot で canvas の絵を screenshots/ に保存する
// （ブラウザのスクショが撮れない環境でも見た目を確認するため）
const shotPlugin = {
  name: 'shot',
  configureServer(server) {
    server.middlewares.use('/__shot', (req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const { name, dataUrl } = JSON.parse(body);
          mkdirSync('screenshots', { recursive: true });
          const b64 = dataUrl.split(',')[1];
          writeFileSync(`screenshots/${name}.png`, Buffer.from(b64, 'base64'));
          res.end('ok');
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e));
        }
      });
    });
  },
};

export default defineConfig({
  // 相対パスで吐くので GitHub Pages のサブパスでも Vercel のルートでもそのまま動く
  base: './',
  plugins: [shotPlugin],
});
