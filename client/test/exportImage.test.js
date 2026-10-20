import test from 'node:test';
import assert from 'node:assert/strict';
import { exportCanvasAsPNG, generatePreviewDataUrl } from '../src/utils/exportImage.js';

test('preview export removes selection handles and restores the selected object', () => {
  const selected = {};
  const calls = [];
  const canvas = {
    getActiveObject: () => selected,
    discardActiveObject: () => calls.push('discard'),
    setActiveObject: (object) => calls.push(object === selected ? 'restore' : 'wrong-object'),
    requestRenderAll: () => calls.push('render'),
    toDataURL: (options) => { calls.push(options); return 'data:image/png;base64,preview'; },
  };
  assert.equal(generatePreviewDataUrl(canvas), 'data:image/png;base64,preview');
  assert.equal(calls.includes('restore'), true);
  assert.deepEqual(calls.find((call) => typeof call === 'object'), { format: 'png', quality: 1, multiplier: 1 });
});

test('PNG export keeps high-resolution scaling and triggers a download', () => {
  const originalDocument = globalThis.document;
  const calls = [];
  const link = { click: () => calls.push('click'), set download(value) { calls.push(['download', value]); }, set href(value) { calls.push(['href', value]); } };
  globalThis.document = {
    createElement: () => link,
    body: { appendChild: () => calls.push('append'), removeChild: () => calls.push('remove') },
  };
  const canvas = {
    width: 800,
    getActiveObject: () => null,
    requestRenderAll: () => {},
    toDataURL: (options) => { calls.push(['render', options]); return 'data:image/png;base64,final'; },
  };
  try {
    assert.equal(exportCanvasAsPNG(canvas, '2026-10-20', 1600), true);
    assert.deepEqual(calls.find((call) => Array.isArray(call) && call[0] === 'render')[1], { format: 'png', quality: 1, multiplier: 2 });
    assert.deepEqual(calls.find((call) => Array.isArray(call) && call[0] === 'download'), ['download', 'professional-presence-chalapathi-2026-10-20.png']);
    assert.equal(calls.includes('click'), true);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
