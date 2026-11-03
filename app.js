// ربط الصفحة ببيانات الأوامر ودوالها في prompts.js
// القيم اللي تكتبها تبقى في الصفحة بس (ما تنحفظ ولا تطلع من جهازك)، وتنتقل بين الأوامر عشان ما تعيد كتابة المادة والصف
import { PROMPTS, CATEGORIES, HINTS, CHOICES, isLong, placeholders, fill, segments, search } from './prompts.js';

const $ = (id) => document.getElementById(id);
const state = { category: 'all', query: '', current: null };
const values = {};
const catLabel = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const order = Object.fromEntries(PROMPTS.map((p, i) => [p.id, i + 1]));

// أعداد بصيغة عربية سليمة وأرقام لاتينية
function nAwamer(n) {
  if (n === 1) return 'أمر واحد';
  if (n === 2) return 'أمران';
  if (n >= 3 && n <= 10) return `${n} أوامر`;
  return `${n} أمراً`;
}
function nKhanat(n) {
  if (n === 1) return 'خانة واحدة';
  if (n === 2) return 'خانتان';
  if (n >= 3 && n <= 10) return `${n} خانات`;
  return `${n} خانة`;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ───────── القائمة ─────────
function renderChips() {
  const box = $('chips');
  const items = [{ id: 'all', label: 'الكل', n: PROMPTS.length }]
    .concat(CATEGORIES.map((c) => ({ ...c, n: PROMPTS.filter((p) => p.category === c.id).length })));
  for (const c of items) {
    const b = el('button', 'chip');
    b.type = 'button';
    b.dataset.cat = c.id;
    b.setAttribute('aria-pressed', String(c.id === state.category));
    b.append(c.label, ' ', el('span', 'n', String(c.n)));
    b.addEventListener('click', () => setCategory(c.id));
    box.append(b);
  }
}

function setCategory(id) {
  state.category = id;
  for (const b of $('chips').children) b.setAttribute('aria-pressed', String(b.dataset.cat === id));
  renderList();
}

function card(p) {
  const li = el('li');
  const a = el('article', 'pcard');
  const top = el('div', 'ptop');
  top.append(el('span', 'tag', catLabel[p.category]), el('span', 'num', String(order[p.id]).padStart(2, '0')));
  const h = el('h3');
  const btn = el('button', 'open', p.title);
  btn.type = 'button';
  btn.dataset.id = p.id;
  btn.addEventListener('click', () => openPrompt(p.id));
  h.append(btn);
  const when = el('p', 'pw');
  when.append(el('b', '', 'متى تستخدمه: '), p.when);
  const meta = el('p', 'meta');
  meta.append(el('span', '', nKhanat(placeholders(p.template).length) + ' للتعبئة'), el('span', 'go', 'افتح الأمر ←'));
  meta.lastChild.setAttribute('aria-hidden', 'true');
  a.append(top, h, when, meta);
  li.append(a);
  return li;
}

function renderList() {
  const found = search(PROMPTS, state.query, state.category);
  const list = $('list');
  list.textContent = '';
  for (const p of found) list.append(card(p));
  $('empty').hidden = found.length > 0;
  const filtered = state.query.trim() || state.category !== 'all';
  $('count').textContent = found.length === 0 ? 'ما فيه نتائج'
    : filtered ? `النتائج: ${nAwamer(found.length)}` : `كل الأوامر: ${nAwamer(found.length)}`;
}

// ───────── لوحة الأمر ─────────
function field(name, i) {
  const wrap = el('div', 'field');
  const id = 'f' + i;
  const label = el('label', '', name);
  label.htmlFor = id;
  const long = isLong(name);
  const input = document.createElement(long ? 'textarea' : 'input');
  input.id = id;
  input.dataset.name = name;
  input.autocomplete = 'off';
  if (long) input.rows = 3;
  else input.type = 'text';
  if (/^(عدد|مدة|الدرجة)/.test(name)) input.inputMode = 'numeric';
  const hint = HINTS[name];
  if (hint) input.placeholder = /^الصق/.test(hint) ? hint : 'مثلاً: ' + hint;
  wrap.append(label, input);
  if (CHOICES[name]) {
    const dl = el('datalist');
    dl.id = 'dl' + i;
    for (const c of CHOICES[name]) { const o = el('option'); o.value = c; dl.append(o); }
    input.setAttribute('list', dl.id);
    wrap.append(dl);
  }
  input.value = values[name] || '';
  input.addEventListener('input', () => { values[name] = input.value; renderPreview(); });
  return wrap;
}

function renderPreview() {
  const p = state.current;
  if (!p) return;
  const box = $('preview');
  box.textContent = '';
  const names = new Set();
  for (const s of segments(p.template, values)) {
    if (s.type === 'text') box.append(s.text);
    else if (s.type === 'filled') box.append(el('mark', '', s.text));
    else {
      names.add(s.name);
      const ph = el('span', 'ph', s.text);
      ph.dataset.name = s.name;
      ph.title = 'اضغط عشان تعبّيها';
      box.append(ph);
    }
  }
  const l = $('pLeft');
  l.classList.toggle('done', names.size === 0);
  l.textContent = names.size === 0 ? 'كل الخانات معبّاة' : `باقي ${nKhanat(names.size)}`;
}

function openPrompt(id) {
  const p = PROMPTS.find((x) => x.id === id);
  if (!p) return;
  state.current = p;
  $('pCat').textContent = catLabel[p.category];
  $('pTitle').textContent = p.title;
  $('pWhen').textContent = 'متى تستخدمه: ' + p.when;
  const box = $('fields');
  box.textContent = '';
  placeholders(p.template).forEach((name, i) => box.append(field(name, i)));
  renderPreview();
  document.querySelector('.pbody').scrollTop = 0;
  if (!$('panel').open) $('panel').showModal();
  history.replaceState(null, '', '#' + p.id);
}

function closePanel() {
  if ($('panel').open) $('panel').close();
}

$('panel').addEventListener('close', () => {
  state.current = null;
  history.replaceState(null, '', location.pathname + location.search);
});
// الضغط على الخلفية المعتمة يقفل اللوحة
$('panel').addEventListener('click', (e) => { if (e.target === $('panel')) closePanel(); });
$('pClose').addEventListener('click', closePanel);

// الضغط على فراغ في المعاينة يوديك لخانته
$('preview').addEventListener('click', (e) => {
  const ph = e.target.closest('.ph');
  if (!ph) return;
  const input = [...$('fields').querySelectorAll('[data-name]')].find((x) => x.dataset.name === ph.dataset.name);
  if (input) { input.focus(); input.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
});

$('clear').addEventListener('click', () => {
  for (const input of $('fields').querySelectorAll('[data-name]')) { input.value = ''; delete values[input.dataset.name]; }
  renderPreview();
  $('fields').querySelector('[data-name]')?.focus();
});

// ───────── النسخ ─────────
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* نجرب الطريقة القديمة */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;inset-inline-start:0;opacity:0';
  ($('panel').open ? $('panel') : document.body).append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

function toast(msg) {
  const t = $('panel').open ? $('ptoast') : $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.classList.remove('show'); }, 2600);
}

$('copy').addEventListener('click', async () => {
  const p = state.current;
  if (!p) return;
  const text = fill(p.template, values);
  const left = placeholders(text).filter((n) => placeholders(p.template).includes(n)).length;
  if (!(await copyText(text))) { toast('ما قدرنا ننسخ تلقائياً، حدد النص من المعاينة وانسخه'); return; }
  toast(left === 0 ? 'تم نسخ الأمر، الصقه في المساعد اللي تستخدمه' : `تم النسخ، وباقي ${nKhanat(left)} بين قوسين تكملها هناك`);
});

$('copyRaw').addEventListener('click', async () => {
  const p = state.current;
  if (!p) return;
  if (!(await copyText(p.template))) { toast('ما قدرنا ننسخ تلقائياً، حدد النص من المعاينة وانسخه'); return; }
  toast('تم نسخ الأمر بدون تعبئة');
});

// ───────── البحث ─────────
$('q').addEventListener('input', () => { state.query = $('q').value; renderList(); });
$('reset').addEventListener('click', () => {
  $('q').value = '';
  state.query = '';
  setCategory('all');
  $('q').focus();
});

$('total').textContent = String(PROMPTS.length);
renderChips();
renderList();

// رابط مباشر لأمر معيّن: .../#lesson-plan
function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id && PROMPTS.some((p) => p.id === id)) openPrompt(id);
}
window.addEventListener('hashchange', openFromHash);
openFromHash();
