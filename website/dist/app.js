'use strict';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let motionPaused = reducedMotion.matches;
let toastTimer;
let activeScenario = 'resume';
let memoryAnimation;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

const scenarios = {
  resume: {
    file: 'reset.ts', projectLabel: 'Pick up the thread.', description: 'The context you need. Already here.',
    inlineTitle: 'You don’t have to explain this again.', inlineText: 'The decision, the check, and what comes next.',
    code: [
      ['// A fresh session. A familiar project.', 'comment'],
      ['import { sendEmail } from "../email/send";'],
      ['import { createToken } from "./tokens";'],
      [''],
      ['export async function resetPassword(user) {'],
      ['  const token = await createToken(user.id);'],
      [''],
      ['  await sendEmail({'],
      ['    to: user.email,'],
      ['    template: "password-reset",'],
      ['    token,'],
      ['  });'],
      ['}'],
      [''],
      ['// Next: verify live email delivery.', 'comment'],
    ],
    memory: { kind: 'WORK CHECKPOINT', summary: 'Password reset is in place.', reason: 'Reused the existing email service to keep delivery consistent.', verification: 'Reset tests passed', evidence: 'Files unchanged', next: 'Verify email delivery before enabling the feature.', file: 'src/auth/reset.ts' },
  },
  decide: {
    file: 'tokens.ts', projectLabel: 'There was a reason.', description: 'Keep the decision close to the code.',
    inlineTitle: 'A decision is more than a line of code.', inlineText: 'Keep the constraint and its explanation together.',
    code: [
      ['// Context follows the decision.', 'comment'],
      ['import { randomBytes } from "node:crypto";'],
      [''],
      ['const TOKEN_LIFETIME_MINUTES = 10;'],
      [''],
      ['export async function createToken(userId) {'],
      ['  const token = randomBytes(32);'],
      [''],
      ['  return storeToken({'],
      ['    userId,'],
      ['    expiresIn: TOKEN_LIFETIME_MINUTES,'],
      ['    singleUse: true,'],
      ['  });'],
      ['}'],
      ['// Rationale saved in project memory.', 'comment'],
    ],
    memory: { kind: 'SAVED DECISION', summary: 'Reset links expire after ten minutes.', reason: 'A short lifetime limits exposure if a reset email is forwarded or leaked.', verification: 'Expiry tests passed', evidence: 'Files unchanged', next: 'Keep the expiry and single-use checks when refactoring.', file: 'src/auth/tokens.ts' },
  },
  clone: {
    file: 'context.ts', projectLabel: 'A head start, included.', description: 'New checkout. The important context travels.',
    inlineTitle: 'Clone the project. Keep the thread.', inlineText: 'Project-visible memories travel in an exported pack.',
    code: [
      ['// Start with the map, then inspect the task.', 'comment'],
      ['const brief = await get_project_brief({'],
      ['  tokenBudget: 1200,'],
      ['});'],
      [''],
      ['const context = await get_task_context({'],
      ['  query: "authentication next steps",'],
      ['  tokenBudget: 800,'],
      ['});'],
      [''],
      ['// Exported project memories loaded.', 'comment'],
      ['// Private records stay on their machine.', 'comment'],
      [''],
      ['// Read the relevant code. Keep building.', 'comment'],
    ],
    memory: { kind: 'PROJECT HANDOFF', summary: 'Start with the authentication module.', reason: 'The exported checkpoint preserves the entry point and remaining work.', verification: 'Previous checks recorded', evidence: 'Check current revision', next: 'Inspect auth/reset.ts, then verify email delivery.', file: 'vestigo.context.json' },
  },
};

const flowPrompts = [
  {
    title: '01 / The continuous thread', meta: 'HERO LOOP · 16:9 · 8 SECONDS',
    prompt: 'Use the supplied Vestigo sculpture image as the first-frame reference. Premium photorealistic studio film: one continuous translucent vermilion orange resin ribbon spirals through three matte graphite slabs, suspended over a warm ivory seamless floor. Very slow five-degree clockwise camera orbit with a tiny upward drift; the ribbon makes one subtle breathing movement while keeping its shape and uninterrupted path. Soft afternoon light from upper left, realistic contact shadows, tactile frosted acrylic and fine graphite grain, 70mm product lens. Preserve the reference silhouette, object count and palette. Start and finish with near-identical framing for a quiet seamless website loop. Keep the object inside the central 65 percent, with clean space around it. No text, logos, UI, people, cuts, fast motion or flashing. No dialogue or music; the website uses muted playback.',
  },
  {
    title: '02 / A decision finds its place', meta: 'CAPTURE SCENE · 16:9 · 8 SECONDS',
    prompt: 'In the same warm ivory studio and material language as the supplied Vestigo sculpture, show three small matte graphite slabs floating separately, neatly aligned with breathing room. A single vermilion orange translucent ribbon slowly threads through them from lower left to upper right, connecting each layer in one continuous, elegant gesture. Each layer settles gently as it connects. One slow, stable camera push-in, soft side lighting, delicate shadows, premium macro industrial design film. Begin spacious, end with one coherent sculpture. Preserve physical material consistency. No text, numbers, interfaces, hands, extra objects, neon lighting, abrupt cuts or energetic particle effects. No speech or music.',
  },
  {
    title: '03 / Pick up the thread', meta: 'CONTEXT RESTORATION · 16:9 · 8 SECONDS',
    prompt: 'Match the supplied Vestigo orange-ribbon and graphite-slab reference exactly in palette and materials. Begin close on the smooth open end of a translucent orange ribbon resting beside three orderly graphite layers. A subtle warm highlight travels along the ribbon, revealing its existing continuous connection through each layer; the camera gently pulls back to reveal the complete sculpture. The idea is rediscovering a connection that was already there, not creating information from nothing. Ivory seamless studio, restrained cinematic product photography, soft side light, realistic shadows, calm deliberate movement. Hold the complete object for the final two seconds. No text, UI, people, light flashes, hard cuts, logos or voiceover.',
  },
  {
    title: '04 / Small on purpose', meta: 'COMPACT MEMORY · 16:9 · 8 SECONDS',
    prompt: 'A minimal physical metaphor for concise project memory, in an ivory product studio. Seven thin dark graphite slips lie in a loose but orderly fan. A short frosted vermilion orange ribbon gently gathers them into a compact, beautifully aligned layered object. Nothing is shredded, erased or discarded; the layers remain visible at the edges. Fixed three-quarter camera with a very slow macro push-in. Tactile materials, exact geometric edges, soft warm daylight, realistic gravity and contact shadows. Composition remains spacious. End with a two-second still hold. Do not add percentages, efficiency numbers, letters, interfaces, logos, people or extra props. No music or speech.',
  },
  {
    title: '05 / Context travels with you', meta: 'PORTABLE MEMORY · 16:9 · 8 SECONDS',
    prompt: 'A quiet architectural product film in the Vestigo visual language. Two simple graphite rectangular frames stand on an ivory studio floor, left and right. A compact layered graphite object bound by one translucent orange ribbon glides gently from the first frame into the second, staying intact and unchanged. One continuous stable lateral camera tracking shot. It conveys carrying a project handoff into a new workspace. Realistic material surfaces, subtle shadows, premium industrial design, no magic particles, no abrupt acceleration. Keep a clean central composition and leave negative space for HTML captions added outside the video. No generated text, symbols, numbers, code, logos, people or narration.',
  },
  {
    title: '06 / Worth remembering', meta: 'PORTRAIT TEASER · 9:16 · 8 SECONDS',
    prompt: 'Vertical 9:16 cinematic product teaser. Use the supplied Vestigo sculpture as the material and object reference. One vivid vermilion orange translucent resin ribbon wraps elegantly through three matte graphite slabs on a warm ivory seamless floor. Start on a macro detail of the orange ribbon edge, move smoothly into a three-quarter view of the full sculpture, and hold the final composition for two seconds. The motion is slow, tactile and precise, like an independent design studio film. Soft afternoon side light and realistic shadows. Keep the object centered in the middle 60 percent of the portrait frame, with generous clean space above and below for titles added in editing. No baked-in text, fake UI, logos, people, cuts, strobing, speech or music.',
  },
];

function toast(message) {
  const node = $('.toast');
  const activeDialog = $$('dialog').find((dialog) => dialog.open);
  (activeDialog || document.body).append(node);
  node.textContent = message;
  node.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('is-visible'), 2400);
}

async function copyText(value) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(value); }
    else {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed'; textarea.style.opacity = '0';
      document.body.append(textarea); textarea.select();
      const copied = document.execCommand('copy'); textarea.remove();
      if (!copied) { throw new Error('Copy unavailable'); }
    }
    toast('Copied. Keep the thread going.');
  } catch { toast('Copy is unavailable in this browser. Select and copy the text.'); }
}

function highlightCode(line) {
  if (line.startsWith('//')) { return escapeHtml(line); }
  const tokens = /("[^"\n]*"|\b(?:import|from|export|async|await|const|return|function|true)\b|\b(?:sendEmail|createToken|resetPassword|storeToken|get_project_brief|get_task_context)\b)/g;
  let html = ''; let position = 0;
  for (const match of line.matchAll(tokens)) {
    html += escapeHtml(line.slice(position, match.index));
    const value = match[0];
    const type = value.startsWith('"') ? 'str' : /^(import|from|export|async|await|const|return|function|true)$/.test(value) ? 'kw' : 'fn';
    html += `<span class="${type}">${escapeHtml(value)}</span>`;
    position = match.index + value.length;
  }
  return html + escapeHtml(line.slice(position));
}

function memoryCard(memory) {
  return `<article class="example-card"><div class="example-card-top"><span>${escapeHtml(memory.kind)}</span><span class="card-check" aria-hidden="true">✓</span></div><h4>${escapeHtml(memory.summary)}</h4><span class="example-detail-label">WHY IT MATTERS</span><p class="example-detail-text">${escapeHtml(memory.reason)}</p><div class="example-check"><span>✓ ${escapeHtml(memory.verification)}</span><span>agent-reported</span></div><div class="example-next"><strong>NEXT STEP</strong>${escapeHtml(memory.next)}</div><div class="example-evidence"><i aria-hidden="true"></i>${escapeHtml(memory.evidence)} · ${escapeHtml(memory.file)}</div></article>`;
}

function renderMemories() {
  const query = $('#memory-search').value.trim().toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  const matches = terms.length ? Object.values(scenarios).map((scenario) => scenario.memory).filter((memory) =>
    terms.every((term) => Object.values(memory).join(' ').toLowerCase().includes(term))) : [scenarios[activeScenario].memory];
  $('#demo-count').textContent = String(matches.length).padStart(2, '0');
  $('#demo-memory').innerHTML = matches.length ? matches.map(memoryCard).join('<div style="height:10px"></div>')
    : '<p class="demo-empty">No matching example memory.<br>Try “reset”, “expiry”, or “handoff”.</p>';
}

function selectScenario(name, animate = true) {
  if (!Object.hasOwn(scenarios, name)) { return; }
  activeScenario = name;
  const scenario = scenarios[name];
  $$('.demo-tab').forEach((tab) => {
    const selected = tab.dataset.scenario === name;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  $('#editor-demo').setAttribute('aria-labelledby', `tab-${name}`);
  $('#demo-file').textContent = scenario.file;
  $('#breadcrumb-file').textContent = scenario.file;
  $('#demo-project-label').textContent = scenario.projectLabel;
  $('#demo-project-description').textContent = scenario.description;
  $('#inline-title').textContent = scenario.inlineTitle;
  $('#inline-text').textContent = scenario.inlineText;
  $('#memory-search').value = '';
  $('#code-lines').innerHTML = scenario.code.map(([line, type]) => `<div class="code-line ${type || ''}"><span>${highlightCode(line) || '&nbsp;'}</span></div>`).join('');
  renderMemories();
  if (animate && !motionPaused) {
    memoryAnimation?.cancel();
    memoryAnimation = $('#demo-memory').animate([{ opacity: 0, transform: 'translateY(9px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 430, easing: 'cubic-bezier(.22,1,.36,1)' });
    $$('.code-line').forEach((line, index) => line.animate([{ opacity: .1, transform: 'translateX(-4px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 350, delay: index * 18, fill: 'backwards' }));
  }
}

$$('.demo-tab').forEach((tab) => {
  tab.addEventListener('click', () => selectScenario(tab.dataset.scenario));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { return; }
    event.preventDefault();
    const tabs = $$('.demo-tab'); const current = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectScenario(tabs[next].dataset.scenario); tabs[next].focus();
  });
});
$('#memory-search').addEventListener('input', renderMemories);
$('#replay-demo').addEventListener('click', () => selectScenario(activeScenario));

function closeMenu() { $('#mobile-nav').hidden = true; $('.menu-toggle').setAttribute('aria-expanded', 'false'); }
$('.menu-toggle').addEventListener('click', () => {
  const open = $('.menu-toggle').getAttribute('aria-expanded') !== 'true';
  $('.menu-toggle').setAttribute('aria-expanded', String(open)); $('#mobile-nav').hidden = !open;
});
$$('#mobile-nav a').forEach((link) => link.addEventListener('click', closeMenu));
$$('[data-open]').forEach((button) => button.addEventListener('click', () => {
  closeMenu(); $(`#${button.dataset.open}-dialog`).showModal();
}));
$$('.site-dialog').forEach((dialog) => {
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) {
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) { dialog.close(); }
  } });
  dialog.addEventListener('close', () => { document.body.classList.remove('dialog-open'); document.body.append($('.toast')); });
  dialog.addEventListener('toggle', () => document.body.classList.toggle('dialog-open', $$('dialog').some((node) => node.open)));
});
$$('[data-copy]').forEach((button) => button.addEventListener('click', () => copyText(button.dataset.copy)));

$('#flow-prompts').innerHTML = flowPrompts.map((item, index) => `<article class="prompt-item"><div class="prompt-item-header"><h3>${escapeHtml(item.title)}</h3><button data-prompt-index="${index}" aria-label="Copy ${escapeHtml(item.title)} prompt">Copy prompt ↗</button></div><div class="prompt-meta">${escapeHtml(item.meta)}</div><p>${escapeHtml(item.prompt)}</p></article>`).join('');
$$('[data-prompt-index]').forEach((button) => button.addEventListener('click', () => copyText(flowPrompts[Number(button.dataset.promptIndex)].prompt)));

function updateMotion() {
  document.documentElement.classList.toggle('motion-paused', motionPaused);
  $('.motion-toggle').setAttribute('aria-pressed', String(motionPaused));
  $('.motion-toggle').setAttribute('aria-label', motionPaused ? 'Resume decorative motion' : 'Pause decorative motion');
  $('.motion-toggle-label').textContent = motionPaused ? 'Resume motion' : 'Pause motion';
  $('.motion-toggle>span:first-child').textContent = motionPaused ? '▷' : 'Ⅱ';
  $$('video').forEach((video) => { if (motionPaused) { video.pause(); } else if (video.dataset.loaded) { void video.play().catch(() => {}); } });
  try { localStorage.setItem('vestigo-motion-paused', String(motionPaused)); } catch { /* Storage may be disabled. */ }
}
try { motionPaused = reducedMotion.matches || localStorage.getItem('vestigo-motion-paused') === 'true'; } catch { /* Respect the system setting. */ }
$('.motion-toggle').addEventListener('click', () => { motionPaused = !motionPaused; updateMotion(); });
reducedMotion.addEventListener('change', () => { motionPaused = reducedMotion.matches; updateMotion(); });
updateMotion();

if ('IntersectionObserver' in window && !motionPaused) {
  document.documentElement.classList.add('can-animate');
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }), { threshold: .06 });
  $$('.reveal').forEach((element) => observer.observe(element));
}

let scheduled = false;
function updateScroll() {
  const distance = document.documentElement.scrollHeight - window.innerHeight;
  $('.scroll-progress').style.transform = `scaleX(${distance > 0 ? Math.min(1, window.scrollY / distance) : 0})`;
  if (!motionPaused && window.innerWidth > 680) { $('[data-parallax]').style.transform = `translateY(${Math.min(window.scrollY * .06, 30)}px)`; }
  scheduled = false;
}
window.addEventListener('scroll', () => { if (!scheduled) { scheduled = true; requestAnimationFrame(updateScroll); } }, { passive: true });
window.addEventListener('resize', updateScroll, { passive: true });
document.addEventListener('keydown', (event) => {
  const editing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
  if (event.key === '/' && !editing && !$$('dialog').some((dialog) => dialog.open)) {
    event.preventDefault(); $('#product').scrollIntoView({ behavior: motionPaused ? 'instant' : 'smooth' }); $('#memory-search').focus({ preventScroll: true });
  }
  if (event.key === 'Escape') { closeMenu(); }
});

$('.hero-sculpture').addEventListener('error', (event) => event.target.classList.add('asset-missing'));

async function loadFlowVideo() {
  if (reducedMotion.matches || navigator.connection?.saveData) { return; }
  try {
    const response = await fetch('media/manifest.json');
    if (!response.ok) { return; }
    const manifest = await response.json();
    if (typeof manifest.hero !== 'string' || !/^media\/[\w/-]+\.mp4$/.test(manifest.hero)) { return; }
    const video = $('[data-video="hero"]');
    video.src = manifest.hero; video.dataset.loaded = 'true';
    video.addEventListener('canplay', () => {
      video.classList.add('is-ready'); $('.hero-art').classList.add('has-video');
      if (!motionPaused) { void video.play().catch(() => { video.classList.remove('is-ready'); $('.hero-art').classList.remove('has-video'); }); }
    }, { once: true });
    video.addEventListener('error', () => { video.classList.remove('is-ready'); $('.hero-art').classList.remove('has-video'); });
  } catch { /* Poster and code-driven motion remain available. */ }
}

selectScenario('resume', false);
updateScroll();
void loadFlowVideo();
