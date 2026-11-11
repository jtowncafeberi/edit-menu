import './style.css';
import * as pdfjs from 'pdfjs-dist';
import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {createEngine, SOURCE_ID} from './engine.js';
import {sharePDF} from './share-pdf.js';
import {MenuSync} from './menu-sync.js';

pdfjs.GlobalWorkerOptions.workerSrc = workerURL;
const renderingWorker = new pdfjs.PDFWorker();
const $ = id => document.getElementById(id);
const titles = ['Cover','Burgers & Lemonade','Shakes & Sandwiches','Momos & Starters','Fries, Wraps & Subs','Maggie & Poha','Noodles','Pasta','Beverages','Pizza','Special Loaded Pizza','Combos'];
const KEY = 'jtown-menu-edits-v1';
let data, engine, original, supplement, pdf, preparedPDFFile, edits = {}, history = [], selected;
let zoom = 1, mode = 'edit', generation = 0, ready = false, busy = false, recovery, storageAvailable = true, cloud;
const wrappers = [], visible = new Set(), renderTasks = new Map(), renderTokens = new Map();

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $('toast').classList.remove('visible'), 5000);
}
function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], {type}));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function status() {
  if (recovery) return 'Saved edits need review. Export the recovery backup before making changes.';
  return mode === 'edit' ? 'Click a highlighted price or text region to edit.' : 'Preview mode · Editing marks are hidden.';
}
function syncUI() {
  const count = Object.keys(edits).length;
  $('count').textContent = count ? `${count} change${count === 1 ? '' : 's'}` : 'No changes';
  $('undo').disabled = !ready || busy || !history.length;
  $('resetAll').disabled = !ready || busy || (!count && !recovery);
  $('backup').disabled = !ready || busy;
  $('backup').textContent = recovery ? 'Export recovery backup' : 'Export backup';
  const savedTime = cloud?.updatedAt ? new Date(cloud.updatedAt).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : '';
  const cloudText = !cloud ? (storageAvailable ? (count ? 'Saved on this device' : 'Original menu · No changes') : 'Export a backup to keep your edits') : cloud.status === 'conflict' ? 'Newer menu online · Review before saving' : cloud.status === 'offline' ? (storageAvailable ? 'Offline · Changes kept on this device' : 'Offline · Export a backup before leaving') : cloud.status === 'connecting' ? 'Connecting to shared storage…' : cloud.status === 'saving' || cloud.pending ? 'Saving changes online…' : savedTime ? `Saved online · ${savedTime}` : 'Original menu · Ready to save online';
  $('saveState').textContent = !ready ? 'Loading original menu…' : recovery ? 'Saved edits need review' : cloudText;
  $('saveState').title = cloud?.updatedAt ? `Last saved: ${new Date(cloud.updatedAt).toLocaleString()}` : '';
  $('syncActions').hidden = !ready || recovery || !['offline', 'conflict'].includes(cloud?.status);
  $('retrySync').hidden = cloud?.status === 'conflict';
  $('retrySync').disabled = busy;
  $('loadSaved').disabled = busy;
  $('import').disabled = !ready || busy;
  $('importButton').disabled = !ready || busy;
  $('download').disabled = !ready || busy;
  $('share').disabled = !ready || busy || !preparedPDFFile;
  $('apply').disabled = busy;
  $('apply').textContent = busy ? 'Saving…' : 'Save change';
  $('resetOne').disabled = busy || !selected || !engine.changed(selected, edits);
  $('menu').setAttribute('aria-busy', String(busy || !ready));
  document.querySelectorAll('.target').forEach(button => {
    const field = engine.fields.get(button.dataset.id);
    const value = engine.valueFor(field, edits);
    const box = engine.bounds(field, value), page = data.pages[field.page - 1];
    button.style.cssText = `left:${box[0] / page.width * 100}%;top:${box[1] / page.height * 100}%;width:${(box[2] - box[0]) / page.width * 100}%;height:${(box[3] - box[1]) / page.height * 100}%`;
    button.disabled = !ready || busy;
    button.classList.toggle('changed', engine.changed(field, edits));
    button.title = `${field.kind === 'price' ? 'Price' : 'Text'}: ${value}`;
    button.setAttribute('aria-label', `Edit ${field.kind}: ${value}`);
  });
}
function persistLocal() {
  try { localStorage.setItem(KEY, JSON.stringify({source: SOURCE_ID, edits: cloud?.edits ?? edits, cloud: cloud?.metadata()})); }
  catch { storageAvailable = false; toast('Browser storage unavailable. Export a backup to keep your edits.'); }
}
function save() {
  if (cloud) cloud.change(edits);
  else persistLocal();
  syncUI();
}
async function reconnect(useSaved = false) {
  if (!ready || busy || recovery || !cloud) return;
  busy = true; syncUI();
  try {
    if (useSaved && cloud.pending) download(JSON.stringify({version: 1, source: SOURCE_ID, edits}, null, 2), 'jtown-unsaved-edits.json', 'application/json');
    if (await cloud.connect({useSaved})) {
      if (JSON.stringify(edits) !== JSON.stringify(cloud.edits)) {
        const next = await loadPDF(cloud.edits);
        edits = {...cloud.edits}; history = [];
        await displayPDF(next);
      }
      persistLocal(); cloud.flush();
    }
  } catch (error) { toast(`Unable to load saved menu: ${error.message}`); }
  finally { busy = false; syncUI(); }
}
$('retrySync').onclick = () => reconnect();
$('loadSaved').onclick = () => reconnect(true);
window.addEventListener('online', () => reconnect());
window.addEventListener('beforeunload', event => {
  if (cloud?.pending) { event.preventDefault(); event.returnValue = ''; }
});
async function renderPage(index, version = generation) {
  if (!pdf || version !== generation) return;
  const token = (renderTokens.get(index) ?? 0) + 1;
  renderTokens.set(index, token);
  renderTasks.get(index)?.cancel();
  const current = () => version === generation && renderTokens.get(index) === token;
  const wrap = wrappers[index], canvas = wrap.querySelector('canvas');
  try {
    const page = await pdf.getPage(index + 1);
    if (!current()) return;
    const width = wrap.querySelector('.page').getBoundingClientRect().width;
    const scale = Math.min(5, Math.max(1, width / data.pages[index].width * (devicePixelRatio || 1)));
    const viewport = page.getViewport({scale});
    const buffer = document.createElement('canvas');
    buffer.width = Math.ceil(viewport.width); buffer.height = Math.ceil(viewport.height);
    const task = page.render({canvasContext: buffer.getContext('2d'), viewport});
    renderTasks.set(index, task);
    await task.promise;
    if (!current()) return;
    canvas.width = buffer.width; canvas.height = buffer.height;
    canvas.getContext('2d').drawImage(buffer, 0, 0);
    canvas.dataset.generation = String(version);
    wrap.querySelector('img').style.visibility = 'hidden';
  } catch (error) {
    if (current() && error.name !== 'RenderingCancelledException') {
      console.error(error);
      toast('Page rendering failed. Your edits are retained; try reloading.');
    }
  }
}
async function loadPDF(next) {
  const bytes = await engine.exportPDF(next);
  const document = await pdfjs.getDocument({data: bytes.slice(), worker: renderingWorker}).promise;
  preparedPDFFile = new File([bytes], 'J-Town-Cafe-Menu.pdf', {type: 'application/pdf'});
  return document;
}
async function displayPDF(nextPDF) {
  const prior = pdf;
  generation++;
  for (const task of renderTasks.values()) task.cancel();
  pdf = nextPDF;
  await Promise.all([...visible].map(index => renderPage(index)));
  if (prior) await prior.destroy();
}
async function commitEdits(next, message, {undo = false, reset = false} = {}) {
  if (!ready || busy) return false;
  if (recovery && !reset) throw Error('Export the recovery backup first, or reset saved edits.');
  engine.validate(next);
  busy = true; syncUI(); $('notice').textContent = 'Applying original PDF text…';
  try {
    // Prepare the export before replacing saved state, so failures cannot lose edits or undo history.
    const nextPDF = await loadPDF(next);
    if (undo) history.pop();
    else { history.push({...edits}); if (history.length > 100) history.shift(); }
    edits = {...next}; recovery = undefined;
    save();
    await displayPDF(nextPDF);
    toast(message);
    return true;
  } finally {
    busy = false; syncUI(); $('notice').textContent = status();
  }
}
function chromeBottom() {
  const header = document.querySelector('header').getBoundingClientRect();
  const sidebar = document.querySelector('aside').getBoundingClientRect();
  const toolbar = $('viewbar').getBoundingClientRect();
  return Math.max(header.bottom, innerWidth <= 800 ? sidebar.bottom : 0, toolbar.bottom > 0 && toolbar.top < innerHeight ? toolbar.bottom : 0);
}
function captureAnchor() {
  if (!wrappers.length) return;
  const top = chromeBottom() + 1;
  let index = 0, visibleHeight = -1;
  wrappers.forEach((wrap, i) => { const r = wrap.querySelector('.page').getBoundingClientRect(); const overlap = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, top)); if (overlap > visibleHeight) { visibleHeight = overlap; index = i; } });
  const rect = wrappers[index].querySelector('.page').getBoundingClientRect();
  const preferred = Math.min(innerHeight - 25, Math.max(top + 20, innerHeight * .4));
  const y = Math.max(Math.max(rect.top, top), Math.min(preferred, rect.bottom - 1));
  return {index, fraction: Math.max(0, Math.min(1, (y - rect.top) / rect.height)), y};
}
function restoreAnchor(anchor) {
  if (!anchor) return;
  const rect = wrappers[anchor.index].querySelector('.page').getBoundingClientRect();
  const y = Math.min(innerHeight - 25, Math.max(chromeBottom() + 15, anchor.y));
  const delta = rect.top + anchor.fraction * rect.height - y;
  window.scrollBy({top: delta, behavior: 'auto'});
}
function updateChrome() {
  const headerHeight = document.querySelector('header').getBoundingClientRect().height;
  document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
  const top = headerHeight + (innerWidth <= 800 ? document.querySelector('aside').getBoundingClientRect().height : 0);
  document.documentElement.style.setProperty('--chrome-height', `${top}px`);
}
function updateActivePage() {
  if (!wrappers.length) return;
  const top = chromeBottom() + 1;
  let best = 0, area = -1;
  wrappers.forEach((w, index) => { const r = w.getBoundingClientRect(); const overlap = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, top)); if (overlap > area) { area = overlap; best = index; } });
  [...$('pages').children].forEach((button, index) => { button.classList.toggle('active', index === best); if (index === best) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  $('viewStatus').textContent = `Page ${best + 1} of 12`;
  $('pageSelect').value = String(best + 1);
}
let scrollFrame;
window.addEventListener('scroll', () => {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(() => { scrollFrame = undefined; updateActivePage(); });
}, {passive: true});
function layoutPages(anchor) {
  updateChrome();
  const fit = Math.min(750, Math.max(1, $('menu').clientWidth - 4));
  wrappers.forEach(w => { w.style.width = `${fit * zoom}px`; });
  restoreAnchor(anchor);
  updateActivePage();
}
function setZoom(value) {
  const anchor = captureAnchor();
  zoom = Math.max(.5, Math.min(2.5, value));
  layoutPages(anchor);
  $('zoomValue').textContent = `${Math.round(zoom * 100)}%`;
  $('zoomOut').disabled = zoom <= .5; $('zoomIn').disabled = zoom >= 2.5;
  visible.forEach(index => renderPage(index));
}
function setMode(value) {
  const anchor = captureAnchor();
  mode = value;
  document.body.classList.toggle('preview', mode === 'preview');
  $('editMode').setAttribute('aria-pressed', String(mode === 'edit'));
  $('previewMode').setAttribute('aria-pressed', String(mode === 'preview'));
  layoutPages(anchor);
  $('notice').textContent = status();
}
function openEditor(field) {
  if (!ready || busy) return;
  selected = field;
  $('fieldType').textContent = `PAGE ${field.page} · EDIT ${field.kind.toUpperCase()}`;
  $('valueLabel').textContent = field.kind === 'price' ? 'Price as printed' : field.kind === 'quantity' ? 'Quantity / size' : field.kind === 'description' ? 'Description' : 'Dish name / text';
  $('value').value = engine.valueFor(field, edits);
  $('value').rows = field.lines ? Math.max(3, field.lines.length + 1) : 1;
  $('value').maxLength = field.lines ? 600 : 150;
  $('editHint').textContent = field.lines ? 'Edit the whole text here. Line breaks keep the printed line positions; long lines wrap within this region.' : 'A small change. The original design stays in place.';
  $('editFooter').textContent = field.lines ? 'Original typeface and size · Text must fit the original region' : 'Original typeface and size · No automatic reflow';
  $('value').inputMode = (field.kind === 'price' || field.kind === 'quantity') && field.text !== 'MRP' ? 'numeric' : 'text';
  $('originalValue').textContent = `Original: ${field.text}`;
  $('fieldError').textContent = '';
  const chars = new Set(Object.values(data.fonts).filter(font => font.name === field.font).flatMap(font => Object.values(font.map)));
  const missing = [...'0123456789'].filter(c => !chars.has(c));
  $('fontLimit').textContent = (field.kind === 'price' || field.kind === 'quantity') && missing.length ? `Exact appearance: this font cannot display these new digits: ${missing.join(', ')}.` : '';
  syncUI();
  $('editor').showModal(); $('value').focus(); $('value').select();
}
function construct() {
  data.pages.forEach((page, index) => {
    const wrap = document.createElement('section');
    wrap.className = 'page-wrap'; wrap.id = `page-${index + 1}`;
    wrap.innerHTML = `<div class="page-caption"><span>${String(index + 1).padStart(2, '0')} / 12 · ${titles[index]}</span><span>ORIGINAL DESIGN</span></div><div class="page" style="aspect-ratio:${page.width}/${page.height}"><img alt="Original menu page ${index + 1}: ${titles[index]}" src="/page-${index + 1}.png" ${index > 1 ? 'loading="lazy"' : ''}><canvas aria-label="Menu page ${index + 1}"></canvas><div class="targets"></div></div>`;
    $('menu').append(wrap); wrappers.push(wrap);
    const nav = document.createElement('button');
    nav.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span>${titles[index]}`;
    nav.onclick = () => navigatePage(index);
    $('pages').append(nav);
    const option = document.createElement('option'); option.value = String(index + 1); option.textContent = `${String(index + 1).padStart(2, '0')} · ${titles[index]}`; $('pageSelect').append(option);
  });
  for (const field of engine.editableFields) {
    const button = document.createElement('button');
    button.className = 'target'; button.dataset.id = field.id; button.dataset.kind = field.kind;
    button.onclick = () => openEditor(field);
    wrappers[field.page - 1].querySelector('.targets').append(button);
  }
  layoutPages();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) { const index = wrappers.indexOf(entry.target); if (entry.isIntersecting) { visible.add(index); renderPage(index); } else visible.delete(index); }
    updateActivePage();
  }, {rootMargin: '200px 0px'});
  wrappers.forEach(w => observer.observe(w));
  const chromeObserver = new ResizeObserver(updateChrome);
  chromeObserver.observe(document.querySelector('aside'));
  chromeObserver.observe(document.querySelector('header'));
}
function navigatePage(index) { wrappers[index].scrollIntoView({behavior: 'auto', block: 'start'}); updateActivePage(); }
$('togglePages').onclick = () => {
  const anchor = captureAnchor();
  const hidden = document.body.classList.toggle('sidebar-collapsed');
  $('togglePages').setAttribute('aria-expanded', String(!hidden));
  $('togglePages').setAttribute('aria-label', hidden ? 'Show menu panel' : 'Hide menu panel');
  layoutPages(anchor);
  visible.forEach(index => renderPage(index));
};
$('pageSelect').onchange = event => navigatePage(Number(event.target.value) - 1);
$('editMode').onclick = () => setMode('edit');
$('previewMode').onclick = () => setMode('preview');
$('zoomIn').onclick = () => setZoom(zoom + .25);
$('zoomOut').onclick = () => setZoom(zoom - .25);
$('fit').onclick = () => setZoom(1);
$('close').onclick = () => $('editor').close();
$('value').onkeydown = event => { if (event.key === 'Enter' && (!selected?.lines || event.metaKey || event.ctrlKey)) { event.preventDefault(); $('editForm').requestSubmit(); } };
$('editForm').onsubmit = async event => {
  event.preventDefault();
  if (!selected || busy) return;
  const field = selected, value = $('value').value;
  try {
    if (value === engine.valueFor(field, edits)) { $('editor').close(); return; }
    const next = engine.setValue(field, value, edits);
    if (await commitEdits(next, 'Change applied and saved in this browser.')) $('editor').close();
  } catch (error) { $('fieldError').textContent = error.message; }
};
$('resetOne').onclick = async () => {
  if (!selected || busy || !engine.changed(selected, edits)) return;
  const next = engine.setValue(selected, selected.text, edits);
  try { if (await commitEdits(next, 'Original text restored.')) $('editor').close(); }
  catch (error) { $('fieldError').textContent = error.message; }
};
$('undo').onclick = async () => {
  if (!history.length) return;
  try { await commitEdits(history.at(-1), 'Last change undone.', {undo: true}); } catch (error) { toast(error.message); }
};
$('resetAll').onclick = async () => {
  try { await commitEdits({}, 'Original menu restored.', {reset: true}); } catch (error) { toast(error.message); }
};
$('backup').onclick = () => {
  const backup = recovery ?? {version: 1, source: SOURCE_ID, exportedAt: new Date().toISOString(), edits};
  download(JSON.stringify(backup, null, 2), 'jtown-menu-edits.json', 'application/json');
  if (recovery) { recovery = undefined; $('notice').textContent = status(); syncUI(); }
  toast('Edits backup downloaded.');
};
$('importButton').onclick = () => $('import').click();
$('import').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw Error('Backup is too large.');
    const backup = JSON.parse(await file.text());
    if (backup.source !== SOURCE_ID || backup.version !== 1) throw Error('This backup is not for the 8 November 2026 J-Town menu.');
    engine.validate(backup.edits);
    const next = Object.fromEntries(Object.entries(backup.edits).filter(([id, value]) => value !== engine.fields.get(id).text));
    await commitEdits(next, 'Backup imported. Undo is available.');
  } catch (error) { toast(`Import failed: ${error.message}`); }
  event.target.value = '';
};
$('download').onclick = async () => {
  if (!ready || busy) return;
  busy = true; syncUI(); $('download').textContent = 'Preparing PDF…';
  try { download(preparedPDFFile, preparedPDFFile.name, preparedPDFFile.type); toast(Object.keys(edits).length ? 'Print-quality PDF downloaded.' : 'Original PDF downloaded unchanged.'); }
  catch (error) { toast(error.message); }
  finally { busy = false; $('download').innerHTML = 'Download PDF <span>↓</span>'; syncUI(); }
};
$('share').onclick = async () => {
  if (!ready || busy || !preparedPDFFile) return;
  busy = true; syncUI();
  try {
    const result = await sharePDF(preparedPDFFile, navigator, file => download(file, file.name, file.type));
    if (result === 'downloaded') toast('File sharing is unavailable here. PDF downloaded — attach it in your preferred app.');
  } catch (error) { toast(`Unable to share PDF: ${error.message}`); }
  finally { busy = false; syncUI(); }
};
let resizeTimer;
window.addEventListener('resize', () => {
  const anchor = captureAnchor();
  layoutPages(anchor);
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => visible.forEach(index => renderPage(index)), 120);
});
async function fetchOK(path) {
  const response = await fetch(path, {cache: 'no-cache'});
  if (!response.ok) throw Error(`Menu asset unavailable: ${path}`);
  return response;
}
async function loadOriginal() {
  const manifest = await (await fetchOK('/source.json')).json();
  const chunks = await Promise.all(manifest.parts.map(name => fetchOK('/' + name).then(response => response.arrayBuffer())));
  const bytes = new Uint8Array(manifest.length); let offset = 0;
  for (const chunk of chunks) { bytes.set(new Uint8Array(chunk), offset); offset += chunk.byteLength; }
  if (offset !== manifest.length) throw Error('Original PDF download incomplete.');
  return bytes;
}
async function init() {
  try {
    [data, original, supplement] = await Promise.all([fetchOK('/data.json').then(response => response.json()), loadOriginal(), fetchOK('/fonts.pdf').then(response => response.arrayBuffer()).then(bytes => new Uint8Array(bytes))]);
    engine = createEngine(data, original, supplement);
    let stored;
    try {
      stored = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (stored) { if (stored.source !== SOURCE_ID) throw Error('Saved edits belong to another menu.'); engine.validate(stored.edits); edits = stored.edits; }
    } catch (error) {
      if (stored) recovery = {version: 1, ...stored};
      toast(`Saved edits could not be restored: ${error.message}`);
    }
    if (import.meta.env.VITE_MENU_STORAGE !== 'local') {
      cloud = new MenuSync({source: SOURCE_ID, edits, stored: stored?.cloud, validate: next => engine.validate(next), onState: () => { if (!recovery) persistLocal(); if (ready) syncUI(); }});
      if (!recovery) { await cloud.connect(); edits = {...cloud.edits}; }
    }
    construct(); syncUI();
    await displayPDF(await loadPDF(edits));
    ready = true; syncUI(); $('notice').textContent = status(); updateActivePage(); if (!recovery) cloud?.flush();
  } catch (error) { $('notice').textContent = `Unable to load menu: ${error.message}`; console.error(error); }
}
init();
