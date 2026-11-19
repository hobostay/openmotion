// Run after build:studio with node --experimental-strip-types --test tests/studio-responsive-browser.ts.
import assert from 'node:assert/strict';
import test from 'node:test';
import puppeteer, { type Page } from 'puppeteer-core';
import { browserExecutable } from '../browser.ts';
import { gatewayFor } from '../gateway/service.ts';
import { startServer } from '../server.ts';
import { fixture } from './fixtures.ts';

async function checkCreator(page: Page, stacked: boolean) {
  const geometry = await page.$eval('.om-creator-pane', pane => {
    const button = pane.querySelector<HTMLButtonElement>('.om-asset-direct > button.om-button')!;
    const range = document.createRange();
    range.selectNodeContents(button);
    const bounds = button.getBoundingClientRect();
    const padding = parseFloat(getComputedStyle(button).paddingInline);
    const lines = Array.from(range.getClientRects());
    const [provider, model] = Array.from(pane.querySelectorAll('.om-generation-picker [role="combobox"]'), el => el.getBoundingClientRect());
    return {
      textFits: lines.length > 0 && lines.every(line => line.left >= bounds.left + padding - 1 && line.right <= bounds.right - padding + 1 && line.top >= bounds.top && line.bottom <= bounds.bottom),
      stacked: model.top >= provider.bottom && Math.abs(model.left - provider.left) < 1,
      aligned: model.left >= provider.right && Math.abs(model.bottom - provider.bottom) < 1,
    };
  });
  assert.ok(geometry.textFits, 'Every line of the provider setup action fits inside the button');
  assert.ok(stacked ? geometry.stacked : geometry.aligned, 'The model controls respond to the width of the creator pane');
}

test('Explore is home and only the editor shows the project navigation', { timeout: 60_000 }, async () => {
  await fixture(async store => {
    const running = await startServer(store, 0, { editor: true });
    const browser = await puppeteer.launch({ executablePath: await browserExecutable(), headless: true });
    try {
      const page = await browser.newPage();
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem('motion.studio.locale', 'en');
        localStorage.setItem('motion.workspace.navigation.v1', 'collapsed');
        localStorage.setItem('hf-studio-ui-preferences', JSON.stringify({ theme: 'system' }));
      });
      const origin = (await running.info()).previewUrl;
      await page.goto(new URL('/', origin).href, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.om-explore-host:not([hidden])');
      assert.equal(new URL(page.url()).searchParams.get('project'), null);
      for (const [width, theme] of [[1440, 'light'], [390, 'dark']] as const) {
        await page.setViewport({ width, height: 800 });
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
        await page.waitForFunction(theme => (document.documentElement.dataset.theme === 'paper') === (theme === 'light'), {}, theme);
        assert.equal(await page.$('.om-app-rail, .om-project-navigation'), null);
        const trigger = await page.waitForSelector('.om-app-header-actions .om-account-trigger', { visible: true });
        const anchor = (await trigger!.boundingBox())!;
        assert.ok(anchor.x + anchor.width <= width && anchor.x > width - 80);
        await trigger!.click();
        const popup = await page.waitForSelector('.om-account-menu', { visible: true });
        const bounds = (await popup!.boundingBox())!;
        assert.ok(bounds.y >= anchor.y + anchor.height - 1 && bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
        await page.keyboard.press('Escape');
        await page.waitForSelector('.om-account-menu', { hidden: true });
      }
      await page.setViewport({ width: 1440, height: 800 });
      await page.click('.om-app-header [aria-label="Motion Studio"]');
      await page.waitForSelector('main[aria-label="Motion Studio"] .om-discovery-hero button[data-primary]', { visible: true });
      assert.equal(await page.$('.om-app-rail'), null);
      await page.click('main[aria-label="Motion Studio"] .om-discovery-hero button[data-primary]');
      await page.waitForSelector('.motion-timeline-icon-controls', { visible: true });
      assert.ok(await page.waitForSelector('.om-app-rail:not([inert])', { visible: true }));
      const editorUrl = page.url();
      await page.click('.om-app-brand');
      await page.waitForSelector('.om-explore-host:not([hidden])');
      assert.equal(await page.$('.om-app-rail'), null);
      await page.goBack();
      await page.waitForSelector('.om-app-rail', { visible: true });
      assert.equal(new URL(page.url()).searchParams.get('project'), new URL(editorUrl).searchParams.get('project'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.motion-timeline-icon-controls', { visible: true });
      assert.ok(await page.waitForSelector('.om-project-navigation:not([inert])', { visible: true }));
    } finally { await browser.close(); await running.close(); }
  });
});

test('Studio controls fit their resizable generator and timeline panes', { timeout: 60_000 }, async () => {
  await fixture(async store => {
    const gateway = gatewayFor(store);
    gateway.options.detect = async () => [];
    const running = await startServer(store, 0, { editor: true });
    const browser = await puppeteer.launch({ executablePath: await browserExecutable(), headless: true });
    try {
      const page = await browser.newPage();
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem('motion.studio.locale', 'en');
        localStorage.setItem('hf-studio-ui-preferences', JSON.stringify({ theme: 'system' }));
      });
      await page.setViewport({ width: 1280, height: 800 });
      const url = new URL((await running.info()).previewUrl);
      url.searchParams.set('page', 'cinema');
      url.searchParams.set('scene', 'text-to-video');
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.om-creator-pane .om-asset-direct > button.om-button', { visible: true });
      await page.evaluate(() => document.fonts.ready);
      for (const menuLabel of ['Image scenes and models', 'Video scenes and models', 'Audio scenes and models', 'Agent client']) {
        const split = '.om-creative-split:has(> [aria-label="' + menuLabel + '"])';
        const popup = '[role="dialog"][aria-label="' + menuLabel + '"]';
        await page.hover(split + ' > .om-nav-row-link');
        await page.waitForSelector(popup, { visible: true });
        await page.hover(split + ' > .om-nav-row-action');
        await page.hover(split + ' > .om-nav-row-link');
        await page.hover(popup + ' button');
        assert.ok(await page.$eval(popup, el => el.matches(':hover')), 'The menu stays open when moving from the label into it');
      }
      await page.mouse.move(5, 750);
      await page.waitForSelector('.om-creative-client-menu', { hidden: true });
      assert.equal(new URL(page.url()).searchParams.get('page'), 'cinema', 'Hovering a destination preserves the current Studio');
      const divider = await page.waitForSelector('.om-creator-pane [role="separator"]');
      for (const [key, width] of [['Home', 310], ['End', 650]] as const) {
        await divider!.press(key);
        await page.waitForFunction(width => document.querySelector('.om-creator-pane [role="separator"]')?.getAttribute('aria-valuenow') === String(width), {}, width);
        await checkCreator(page, key === 'Home');
      }
      await page.setViewport({ width: 320, height: 690 });
      await page.waitForFunction(() => document.querySelector('.om-creator-pane')!.getBoundingClientRect().width <= innerWidth);
      await checkCreator(page, true);
      assert.ok(await page.$eval('.om-studio-bar', bar => {
        const back = bar.querySelector('.om-studio-back')!.getBoundingClientRect();
        const scenes = bar.querySelector('nav')!.getBoundingClientRect();
        return back.bottom <= scenes.top;
      }), 'The mobile Studio header keeps its return action above the scenes');
      const imageNav = '.om-creative-split:has(> [aria-label="Image scenes and models"])';
      for (const scheme of ['dark', 'light'] as const) {
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
        await page.click(imageNav + ' > .om-nav-row-link');
        await page.waitForFunction(() => new URL(location.href).searchParams.get('page') === 'design');
        await page.waitForSelector('.om-creative-menu', { hidden: true });
        await page.waitForSelector('.om-generation-pickers [aria-label="Generation model"]', { visible: true });
        await page.focus(imageNav + ' > .om-nav-row-link');
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Image scenes and models');
        await page.keyboard.press('Enter');
        const menu = await page.waitForSelector('.om-creative-menu', { visible: true });
        assert.ok(await menu!.evaluate(el => el.getBoundingClientRect().left >= 0 && el.getBoundingClientRect().right <= innerWidth));
        await page.keyboard.press('Escape');
        await page.waitForSelector('.om-creative-menu', { hidden: true });
        await page.goBack();
        await page.waitForFunction(() => new URL(location.href).searchParams.get('page') === 'cinema');
      }
      const folder = await page.waitForSelector('.om-app-header-actions [aria-label="Workspace assets"]', { visible: true });
      const before = await folder!.boundingBox();
      await page.$eval('.om-app-header .om-creative-navigation', nav => { nav.scrollLeft = nav.scrollWidth; });
      assert.ok(await page.$eval('.om-creative-navigation', nav => nav.scrollLeft > 0));
      assert.deepEqual(await folder!.boundingBox(), before, 'The assets shortcut stays fixed when navigation scrolls');
      await folder!.click();
      await page.waitForFunction(() => new URL(location.href).searchParams.get('page') === 'assets');
      await page.goBack();
      await page.waitForFunction(() => new URL(location.href).searchParams.get('page') === 'cinema');
      await page.setViewport({ width: 320, height: 690, hasTouch: true });
      await page.waitForSelector(imageNav);
      await page.tap(imageNav + ' > .om-nav-row-action');
      await page.waitForSelector('.om-creative-menu', { visible: true });
      await page.tap(imageNav + ' > .om-nav-row-link');
      await page.waitForFunction(() => new URL(location.href).searchParams.get('page') === 'design');
      await page.waitForSelector('.om-creative-menu', { hidden: true });
      await page.goto(new URL('/?page=editor', url).href, { waitUntil: 'domcontentloaded' });
      const toolbar = await page.waitForSelector('.motion-timeline-icon-controls', { visible: true });
      assert.ok(await toolbar!.evaluate(el => {
        const bounds = el.getBoundingClientRect();
        return Array.from(el.querySelectorAll('button, input')).filter(control => control.getClientRects().length).every(control => {
          const box = control.getBoundingClientRect();
          return box.left >= bounds.left - 1 && box.right <= bounds.right + 1;
        });
      }), 'All timeline controls fit at the narrowest viewport');
    } finally {
      await browser.close();
      await running.close();
      await gateway.close();
    }
  });
});

test('Explore fills every gallery row and plays the featured artwork in place', { timeout: 60_000 }, async () => {
  await fixture(async store => {
    const gateway = gatewayFor(store);
    gateway.options.detect = async () => [];
    const running = await startServer(store, 0, { editor: true });
    const browser = await puppeteer.launch({ executablePath: await browserExecutable(), headless: true });
    try {
      const page = await browser.newPage();
      const items = Array.from({ length: 8 }, (_, i) => ({ id: 'work-' + i, title: 'Work ' + i, description: 'A product reveal.', kind: 'builtin', tags: [] }));
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (new URL(request.url()).pathname.endsWith('/template-catalog')) {
          void request.respond({ contentType: 'application/json', body: JSON.stringify({ offset: 0, items, next: null }) });
        } else void request.continue();
      });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      const url = new URL((await running.info()).previewUrl);
      url.searchParams.set('page', 'explore');
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.om-feed-group [data-template-id]');
      await page.evaluate(() => document.fonts.ready);
      for (const width of [1512, 1060, 760, 320]) {
        await page.setViewport({ width, height: 850 });
        const rowsFill = await page.$eval('.om-feed-group', feed => {
          const bounds = feed.getBoundingClientRect();
          const cards = Array.from(feed.children, card => card.getBoundingClientRect());
          return cards.every((card, index) => {
            const previous = cards[index - 1], next = cards[index + 1];
            const startsRow = !previous || previous.top !== card.top;
            const endsRow = !next || next.top !== card.top;
            return (!startsRow || Math.abs(card.left - bounds.left) < 1) && (!endsRow || Math.abs(card.right - bounds.right) < 1);
          });
        });
        assert.ok(rowsFill, 'Gallery rows follow reading order and fill the available width at ' + width);
        const hero = (await page.$('.om-feature-carousel'))!;
        const initialHeight = await hero.evaluate(element => element.getBoundingClientRect().height);
        for (const indicator of await hero.$$('.om-media-segments button')) {
          await indicator.click();
          assert.equal(await hero.evaluate(element => element.getBoundingClientRect().height), initialHeight);
        }
      }
      const artwork = '.om-feature-slide[aria-hidden="false"] .om-feature-camera';
      const cameraState = () => page.$eval(artwork, camera => getComputedStyle(camera).animationPlayState);
      assert.equal(await cameraState(), 'paused', 'Reduced motion starts with a still frame');
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
      const segments = await page.$$('.om-media-segments button');
      for (const segment of segments) {
        await segment.click();
        const start = await page.$eval(artwork, camera => getComputedStyle(camera).transform);
        await page.waitForFunction((selector, start) => getComputedStyle(document.querySelector(selector)!).transform !== start, {}, artwork, start);
        const scene = await page.$eval('.om-feature-carousel', hero => hero.getAttribute('data-scene'));
        if (scene !== 'shot-image') {
          await page.waitForFunction(selector => (document.querySelector(selector)?.querySelector('video')?.currentTime ?? 0) > 0.1, {}, artwork);
        }
      }
      await page.click('.om-media-pagination > button:first-child');
      assert.equal(await cameraState(), 'paused');
      assert.ok(await page.$eval(artwork + ' video', video => (video as HTMLVideoElement).paused));
    } finally {
      await browser.close();
      await running.close();
      await gateway.close();
    }
  });
});

test('Sound Studio previews and seeks the welcome track in both wide and compact layouts', { timeout: 60_000 }, async () => {
  await fixture(async store => {
    const gateway = gatewayFor(store);
    gateway.options.detect = async () => [];
    const running = await startServer(store, 0, { editor: true });
    const browser = await puppeteer.launch({ executablePath: await browserExecutable(), headless: true });
    try {
      const page = await browser.newPage();
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem('motion.studio.locale', 'en');
        localStorage.setItem('hf-studio-ui-preferences', JSON.stringify({ theme: 'system' }));
      });
      const url = new URL((await running.info()).previewUrl);
      url.searchParams.set('page', 'sound');
      for (const [width, theme] of [[1280, 'dark'], [390, 'light']] as const) {
        await page.setViewport({ width, height: 800 });
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
        await page.goto(url.href, { waitUntil: 'domcontentloaded' });
        if (width < 800) {
          const guide = '.om-assets-view-switch button:first-child';
          await page.waitForSelector(guide, { visible: true });
          await page.click(guide);
        }
        const player = '.om-scene-audio';
        await page.waitForSelector(player + ' input[type="range"]:enabled', { visible: true });
        assert.ok(await page.$eval(player, panel => panel.scrollWidth <= panel.clientWidth && panel.querySelector('audio')!.paused));
        await page.click(player + ' [aria-label="Play"]');
        await page.waitForFunction(() => (document.querySelector<HTMLAudioElement>('.om-scene-audio audio')?.currentTime ?? 0) > 0);
        await page.click(player + ' [aria-label="Pause"]');
        await page.click('.motion-waveform-seek input');
        await page.waitForFunction(() => {
          const audio = document.querySelector<HTMLAudioElement>('.om-scene-audio audio');
          return audio && audio.paused && audio.currentTime > audio.duration * 0.4;
        });
      }
    } finally {
      await browser.close();
      await running.close();
      await gateway.close();
    }
  });
});
