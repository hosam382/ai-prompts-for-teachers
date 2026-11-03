// شغّلها بـ: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROMPTS, CATEGORIES, placeholders, fill, segments, normalize, search } from './prompts.js';

test('استخراج الفراغات: بدون تكرار وبترتيب أول ظهور', () => {
  const t = 'اكتب [عدد الأسئلة] سؤالاً في [المادة] لطلاب [الصف]، ثم راجع [المادة] مرة ثانية و[ الصف ].';
  assert.deepEqual(placeholders(t), ['عدد الأسئلة', 'المادة', 'الصف']);
});

test('استخراج الفراغات: يتجاهل الأقواس الفاضية والمكسورة عبر الأسطر', () => {
  assert.deepEqual(placeholders('بدون فراغات'), []);
  assert.deepEqual(placeholders('[] و[  ] و[مكسور\nعلى سطرين]'), []);
  assert.deepEqual(placeholders(''), []);
  assert.deepEqual(placeholders(undefined), []);
});

test('التعبئة: تعوّض المعروف وتترك المجهول زي ما هو', () => {
  const t = 'درس [المادة] لطلاب [الصف] عن [الموضوع].';
  assert.equal(fill(t, { 'المادة': 'العلوم' }), 'درس العلوم لطلاب [الصف] عن [الموضوع].');
  assert.equal(fill(t, {}), t);
  assert.equal(fill(t), t);
});

test('التعبئة: القيمة الفاضية أو المسافات تخلي الفراغ زي ما هو', () => {
  assert.equal(fill('[المادة] و[الصف]', { 'المادة': '   ', 'الصف': '' }), '[المادة] و[الصف]');
});

test('التعبئة: تعوّض كل تكرار، وتقص المسافات من القيمة والاسم', () => {
  assert.equal(fill('[المادة] ثم [ المادة ]', { 'المادة': '  الرياضيات ' }), 'الرياضيات ثم الرياضيات');
});

test('التعبئة: القيمة تنحط حرفياً حتى لو فيها $ أو أقواس', () => {
  assert.equal(fill('السعر [السعر]', { 'السعر': '$& 10' }), 'السعر $& 10');
  // القيمة اللي شكلها فراغ ما تنعاد معالجتها
  assert.equal(fill('[أ] و[ب]', { 'أ': '[ب]', 'ب': 'قيمة' }), '[ب] وقيمة');
});

test('القطع للمعاينة: نص ومعبّى وفاضي بالترتيب', () => {
  const segs = segments('مادة [المادة] للصف [الصف].', { 'المادة': 'العلوم' });
  assert.deepEqual(segs, [
    { type: 'text', text: 'مادة ' },
    { type: 'filled', name: 'المادة', text: 'العلوم' },
    { type: 'text', text: ' للصف ' },
    { type: 'empty', name: 'الصف', text: '[الصف]' },
    { type: 'text', text: '.' },
  ]);
  // جمع القطع يساوي ناتج fill دائماً
  for (const p of PROMPTS) {
    const values = { 'المادة': 'العلوم', 'الصف': 'الثاني المتوسط' };
    assert.equal(segments(p.template, values).map((s) => s.text).join(''), fill(p.template, values));
  }
});

test('التطبيع: التشكيل والتطويل والهمزات والتاء المربوطة والألف المقصورة', () => {
  assert.equal(normalize('الْعُلُومُ'), 'العلوم');
  assert.equal(normalize('اخـــتبار'), 'اختبار');
  assert.equal(normalize('أإآٱ'), 'اااا');
  assert.equal(normalize('مدرسة'), 'مدرسه');
  assert.equal(normalize('مستوى'), 'مستوي');
  assert.equal(normalize('  ١٠   أسئلة  '), '10 اسئله');
  assert.equal(normalize('ChatGPT'), 'chatgpt');
});

test('البحث: نفس النتيجة مع الهمزة أو بدونها، ومع التشكيل', () => {
  const a = search(PROMPTS, 'اختبار');
  assert.ok(a.length > 0);
  assert.deepEqual(search(PROMPTS, 'إختبار'), a);
  assert.deepEqual(search(PROMPTS, 'اِخْتِبَار'), a);
  assert.deepEqual(search(PROMPTS, 'اخـتبار'), a);
});

test('البحث: التاء المربوطة والألف المقصورة', () => {
  assert.deepEqual(search(PROMPTS, 'خطه علاجيه'), search(PROMPTS, 'خطة علاجية'));
  assert.ok(search(PROMPTS, 'خطه علاجيه').some((p) => p.id === 'remedial-plan'));
  assert.deepEqual(search(PROMPTS, 'مستوي'), search(PROMPTS, 'مستوى'));
});

test('البحث: العنوان المطابق يطلع أول، وكل الكلمات لازم توجد', () => {
  assert.equal(search(PROMPTS, 'بطاقة خروج')[0].id, 'exit-ticket');
  assert.deepEqual(search(PROMPTS, 'كلمة-ما-لها-وجود-أبداً'), []);
});

test('البحث: فلتر القسم، والبحث الفاضي يرجع كل القسم بنفس الترتيب', () => {
  const parents = search(PROMPTS, '', 'parents');
  assert.ok(parents.length >= 4);
  assert.ok(parents.every((p) => p.category === 'parents'));
  assert.deepEqual(search(PROMPTS, '', 'all'), PROMPTS);
  assert.deepEqual(search(PROMPTS, '   '), PROMPTS);
  assert.ok(search(PROMPTS, 'رسالة', 'activities').every((p) => p.category === 'activities'));
  assert.deepEqual(search(PROMPTS, '', 'قسم-غير-موجود'), []);
});

test('البحث: اسم القسم نفسه يلقى أوامره', () => {
  const r = search(PROMPTS, 'أولياء الأمور');
  for (const p of PROMPTS.filter((x) => x.category === 'parents')) assert.ok(r.includes(p));
});

test('كل أمر فيه عنوان وقسم صحيح ووصف ونص وفراغ واحد على الأقل', () => {
  const cats = new Set(CATEGORIES.map((c) => c.id));
  assert.ok(PROMPTS.length >= 25, 'تقريباً 30 أمراً');
  for (const p of PROMPTS) {
    assert.ok(typeof p.id === 'string' && /^[a-z0-9-]+$/.test(p.id), `معرّف غير صالح: ${p.id}`);
    assert.ok(p.title && p.title.trim(), `${p.id}: بدون عنوان`);
    assert.ok(cats.has(p.category), `${p.id}: قسم غير معروف ${p.category}`);
    assert.ok(p.when && p.when.trim(), `${p.id}: بدون «متى تستخدمه»`);
    assert.ok(p.template && p.template.trim(), `${p.id}: بدون نص`);
    assert.ok(placeholders(p.template).length >= 1, `${p.id}: ما فيه ولا فراغ`);
  }
});

test('المعرّفات ما تتكرر', () => {
  const ids = PROMPTS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('كل قسم فيه 4 أوامر على الأقل', () => {
  for (const c of CATEGORIES) {
    assert.ok(PROMPTS.filter((p) => p.category === c.id).length >= 4, c.label);
  }
});

test('جودة النص: قواعد الافتراضات والبيانات، وأقواس متوازنة، وأرقام لاتينية، وبلا إيموجي', () => {
  for (const p of PROMPTS) {
    const t = p.template;
    assert.match(t, /^أنت /, `${p.id}: يبدأ بتحديد الدور`);
    assert.match(t, /افتراضاتي/, `${p.id}: ينقصه طلب ذكر الافتراضات`);
    assert.match(t, /لا تخترع/, `${p.id}: ينقصه منع اختراع البيانات`);
    assert.equal((t.match(/\[/g) || []).length, (t.match(/\]/g) || []).length, `${p.id}: أقواس غير متوازنة`);
    for (const s of [p.title, p.when, t]) {
      assert.doesNotMatch(s, /[٠-٩]/, `${p.id}: فيه أرقام عربية-هندية`);
      assert.doesNotMatch(s, /\p{Extended_Pictographic}/u, `${p.id}: فيه إيموجي`);
    }
  }
});
