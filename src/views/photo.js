// src/views/photo.js
const state = {
  root: null,
  img: null,
  timer: null,
  idx: 0,
  intervalMs: ((parseInt(window.PHOTO_INTERVAL_SEC, 10) || 30) * 1000),
};

function stop() {
  if (state.timer) { clearInterval(state.timer); state.timer = null; }
}

async function start() {
  if (!state.img) return;

  let imgs = [];
  try {
    const images = Object.values(
        import.meta.glob('../images/*.{jpg,jpeg,png,webp,avif,gif}', { eager: true, query: '?url' })
    );
    imgs = images;
    console.log('Photos fetched:', imgs.length, 'images');
  } catch (e) {
    console.warn('Photos fetch failed:', e);
  }
  if (!Array.isArray(imgs) || imgs.length === 0) return;

  const show = (i) => {
    state.idx = i % imgs.length;
    state.img.src = imgs[state.idx];
  };

  show(0);
  stop();
  state.timer = setInterval(() => show(state.idx + 1), state.intervalMs);
}

export function mount(el) {
  // build once
  state.root = document.createElement('div');
  state.root.className = 'w-full h-full';

  state.img = document.createElement('img');
  state.img.className = 'w-full h-full object-contain';
  state.root.appendChild(state.img);

  el.appendChild(state.root);
  start();
}

export function show() {
  if (state.root) state.root.style.display = '';
  if (!state.timer) start();
}

export function hide() {
  if (state.root) state.root.style.display = 'none';
  stop();
}
