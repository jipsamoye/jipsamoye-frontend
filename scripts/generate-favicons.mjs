#!/usr/bin/env node
/**
 * public/favicon.svg 를 래스터로 구워 파비콘 자산을 생성한다.
 *
 *   npm run favicons
 *
 * 산출물:
 *   public/favicon.ico          16/32/48 멀티사이즈 (PNG-in-ICO)
 *   public/apple-touch-icon.png 180x180, 모서리 라운딩 없음
 *
 * ⚠️ 실행 환경 제약
 * 헤드리스 크롬의 "시스템에 설치된 한글 폰트"로 <text>를 렌더한다.
 * 한글 폰트가 없는 환경(대부분의 리눅스 CI 컨테이너)에서 실행하면
 * 글자가 두부(□□)로 깨진다. Windows(Malgun Gothic) 또는
 * macOS(Apple SD Gothic Neo)에서만 실행할 것.
 *
 * 산출물은 git에 커밋되므로 CI/Vercel은 이 스크립트를 실행하지 않는다.
 * favicon.svg 를 고쳤을 때만 로컬에서 다시 구우면 된다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { encodeIco } from './lib/ico.mjs';
import { toAppleTouchSvg } from './lib/svg-variants.mjs';
import { assertGlyphCoverage } from './lib/glyph-coverage.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ICO_SIZES = [16, 32, 48];
const APPLE_SIZE = 180;

/**
 * 브라우저 컨텍스트에서 실행된다 (puppeteer가 직렬화해서 주입).
 * 실제로 저장될 PNG 바이트를 다시 디코드해서 재므로, 측정 대상과
 * 산출물이 항상 일치한다.
 */
async function measurePixels(dataUrl, size) {
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('PNG 디코드 실패'));
    img.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, size, size);
  let opaque = 0;
  let white = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 32) continue;
    opaque += 1;
    if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) white += 1;
  }
  return { opaque, white };
}

async function renderPng(page, svg, size) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><meta charset="utf-8">` +
      `<style>html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden}` +
      `svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    { waitUntil: 'load' }
  );
  const png = await page.screenshot({ type: 'png', omitBackground: true });
  const stats = await page.evaluate(measurePixels, `data:image/png;base64,${png.toString('base64')}`, size);
  const ratio = assertGlyphCoverage({ size, ...stats });
  console.log(`  ${String(size).padStart(3)}px  ${String(png.length).padStart(5)}B  글자 ${(ratio * 100).toFixed(1)}%`);
  return png;
}

const svg = readFileSync(path.join(root, 'public/favicon.svg'), 'utf-8');
const browser = await puppeteer.launch();
try {
  const page = await browser.newPage();

  console.log('favicon.ico');
  const icoImages = [];
  for (const size of ICO_SIZES) {
    icoImages.push({ size, png: await renderPng(page, svg, size) });
  }
  writeFileSync(path.join(root, 'public/favicon.ico'), encodeIco(icoImages));

  console.log('apple-touch-icon.png');
  const applePng = await renderPng(page, toAppleTouchSvg(svg), APPLE_SIZE);
  writeFileSync(path.join(root, 'public/apple-touch-icon.png'), applePng);

  console.log(`\n✓ public/favicon.ico (${ICO_SIZES.join('/')}px)`);
  console.log(`✓ public/apple-touch-icon.png (${APPLE_SIZE}x${APPLE_SIZE})`);
} finally {
  await browser.close();
}
