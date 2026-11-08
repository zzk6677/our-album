'use strict';

const gallery = document.querySelector('.gallery');
const groups = [...gallery.querySelectorAll('[data-group]')];
const filters = [...gallery.querySelectorAll('[data-filter]')];
const count = gallery.querySelector('.photo-count');
const shuffle = gallery.querySelector('.shuffle');
const viewer = document.querySelector('.viewer');
const largeImage = viewer.querySelector('.viewer-img');
const title = viewer.querySelector('#viewer-title');
const chapterLabel = viewer.querySelector('.viewer-chapter');
const dateLabel = viewer.querySelector('.viewer-date');
const position = viewer.querySelector('.viewer-count');
const close = viewer.querySelector('.viewer-close');
const previous = viewer.querySelector('.viewer-prev');
const next = viewer.querySelector('.viewer-next');
const prints = [...gallery.querySelectorAll('.print')].map(link => ({
  id: link.dataset.photo,
  group: link.closest('[data-group]').dataset.group,
  chapter: link.closest('[data-group]').querySelector('h3').textContent,
  src: link.getAttribute('href'),
  title: link.querySelector('img').alt,
  date: link.querySelector('.print-label span:last-child').textContent
}));

let visible = prints;
let reel = prints;
let index = 0;
let opener;
let touchStart;
let lastRandom;

function filter(value) {
  visible = value === 'all' ? prints : prints.filter(print => print.group === value);
  for (const group of groups) group.hidden = value !== 'all' && group.dataset.group !== value;
  for (const button of filters) button.setAttribute('aria-pressed', String(button.dataset.filter === value));
  count.textContent = `${visible.length} 张照片`;
}

function show(offset) {
  index = (index + offset + reel.length) % reel.length;
  const photo = reel[index];
  largeImage.src = photo.src;
  largeImage.alt = photo.title;
  title.textContent = photo.title;
  chapterLabel.textContent = photo.chapter;
  dateLabel.textContent = photo.date;
  position.textContent = `第 ${index + 1} 张 / 共 ${reel.length} 张`;
}

function openPhoto(photoId, collection, origin) {
  const start = collection.findIndex(photo => photo.id === photoId);
  if (start < 0) return;
  opener = origin;
  reel = collection;
  index = start;
  show(0);
  viewer.showModal();
  close.focus();
}

gallery.querySelector('.gallery-controls').hidden = false;
shuffle.hidden = false;
for (const button of filters) {
  button.addEventListener('click', () => filter(button.dataset.filter));
}

document.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link || event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (link.dataset.chapter) filter(link.dataset.chapter);
  if (link.getAttribute('href') === '#gallery') filter('all');
  if (!link.dataset.photo || typeof viewer.showModal !== 'function') return;
  event.preventDefault();
  openPhoto(link.dataset.photo, link.classList.contains('print') ? visible : prints, link);
});

function showHashChapter() {
  const chapter = groups.find(group => '#' + group.id === location.hash);
  if (!chapter) return;
  const wasHidden = chapter.hidden;
  filter(chapter.dataset.group);
  if (wasHidden) chapter.scrollIntoView();
}

showHashChapter();
window.addEventListener('hashchange', showHashChapter);
shuffle.addEventListener('click', () => {
  const candidates = visible.length > 1 ? visible.filter(photo => photo.id !== lastRandom) : visible;
  const photo = candidates[Math.floor(Math.random() * candidates.length)];
  if (!photo || typeof viewer.showModal !== 'function') return;
  lastRandom = photo.id;
  openPhoto(photo.id, visible, shuffle);
});

close.addEventListener('click', () => viewer.close());
previous.addEventListener('click', () => show(-1));
next.addEventListener('click', () => show(1));
viewer.addEventListener('close', () => opener?.focus({ preventScroll: true }));
viewer.addEventListener('click', event => {
  if (event.target === viewer) viewer.close();
});
viewer.addEventListener('keydown', event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  show(event.key === 'ArrowRight' ? 1 : -1);
});
largeImage.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch' && event.isPrimary) {
    touchStart = { x: event.clientX, y: event.clientY };
  }
});
largeImage.addEventListener('pointercancel', () => { touchStart = null; });
largeImage.addEventListener('pointerup', event => {
  if (!touchStart || !event.isPrimary) return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy)) show(dx < 0 ? 1 : -1);
});
