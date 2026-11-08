'use strict';

{
  const stage = document.querySelector('.memory-space');
  const camera = stage.querySelector('.space-camera');
  const zoomLayer = stage.querySelector('.space-zoom');
  const world = stage.querySelector('.space-world');
  const cards = [...world.querySelectorAll('.space-photo')];
  const toolbar = document.querySelector('.space-toolbar');
  const modeButtons = [...toolbar.querySelectorAll('[data-space-mode]')];
  const playButton = toolbar.querySelector('.space-play');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const viewerDialog = document.querySelector('.viewer');
  const totalDepth = cards.length * 37;
  let mode = 'tunnel';
  let playing = !reducedMotion.matches;
  let inView = true;
  let frame = 0;
  let lastTime = 0;
  let travel = 0;
  let pendingTravel = 0;
  let yaw = 0;
  let pitch = 0;
  let aimX = 0;
  let aimY = 0;
  let targetX = 0;
  let targetY = 0;
  let zoom = 0;
  let targetZoom = 0;
  let cloudScale = 1;
  let panX = 0;
  let panY = 0;
  let targetPanX = 0;
  let targetPanY = 0;
  let cloudFocusUntil = 0;
  let scale = 1;
  let stackPosition = 0;
  let stackTime = 0;
  let cloudDirection = 1;
  let pointer = null;
  let suppressClickUntil = 0;
  let nextImageUpgrade = 0;
  let dirty = true;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const wrap = (value, length) => ((value % length) + length) % length;
  const noise = value => {
    const result = Math.sin(value * 127.1 + 43.7) * 43758.5453;
    return result - Math.floor(result);
  };

  function wake() {
    if (!frame && inView && !document.hidden && !viewerDialog.open) {
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function updatePlayback() {
    playButton.setAttribute('aria-pressed', String(playing));
    playButton.textContent = playing ? '暂停漫游' : '开始漫游';
    wake();
  }

  function placeCards() {
    const columns = 13;
    cards.forEach((card, index) => {
      let x = 0;
      let y = 0;
      let z = 0;
      let rotateY = 0;
      let rotateZ = 0;
      let opacity = 1;
      let width = 170 * scale;
      if (mode === 'tunnel') {
        const depth = wrap(index * 37 + travel, totalDepth);
        const angle = index * 2.39996323;
        const radius = (340 + noise(index + 1) * 190) * scale;
        x = Math.cos(angle) * radius;
        y = Math.sin(angle) * radius * .73;
        z = 620 - depth;
        opacity = Math.min(1, depth / 100, (totalDepth - depth) / 180) * (.48 + .52 * (1 - depth / totalDepth));
        rotateZ = (noise(index + 2) - .5) * 7;
      } else if (mode === 'cloud') {
        x = ((index % columns) - 6) * 185 * scale + (noise(index) - .5) * 55 * scale;
        y = (Math.floor(index / columns) - 4) * 150 * scale + (noise(index + 5) - .5) * 65 * scale;
        z = (noise(index + 3) * 1000 - 740) * scale;
        rotateZ = (noise(index + 6) - .5) * 9;
      } else if (mode === 'ring') {
        const angle = (index % 39) / 39 * Math.PI * 2 + Math.floor(index / 39) * .08;
        const radius = 730 * scale;
        x = Math.sin(angle) * radius;
        y = (Math.floor(index / 39) - 1) * 185 * scale;
        z = Math.cos(angle) * radius;
        rotateY = angle * 180 / Math.PI;
        width = 115 * scale;
      } else {
        const offset = wrap(index - stackPosition + cards.length / 2, cards.length) - cards.length / 2;
        x = offset * 88 * scale;
        y = Math.sin(offset * .22) * 15 * scale;
        z = -Math.abs(offset) * 42 * scale;
        rotateY = clamp(offset * -8, -53, 53);
        opacity = clamp(14 - Math.abs(offset), 0, 1);
        width = 190 * scale;
      }
      const height = clamp(width / Number(card.dataset.ratio), width * .67, width * 1.36);
      card.style.width = width + 'px';
      card.style.height = height + 'px';
      card.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateY(${rotateY.toFixed(2)}deg) rotateZ(${rotateZ.toFixed(2)}deg)`;
      card.style.opacity = opacity.toFixed(3);
      card.classList.toggle('is-distant', opacity < .08);
    });
    dirty = false;
  }

  function tick(time) {
    frame = 0;
    if (!inView || document.hidden || viewerDialog.open) return;
    const elapsed = Math.min(50, time - lastTime);
    lastTime = time;
    const ease = reducedMotion.matches ? 1 : 1 - Math.exp(-elapsed / 130);
    aimX += (targetX - aimX) * ease;
    aimY += (targetY - aimY) * ease;
    zoom += (targetZoom - zoom) * ease;
    const targetScale = mode === 'cloud' ? Math.pow(8, targetZoom / 900) : 1;
    cloudScale += (targetScale - cloudScale) * ease;
    panX += (targetPanX - panX) * ease;
    panY += (targetPanY - panY) * ease;
    if (mode === 'tunnel' && pendingTravel !== 0) {
      const step = Math.abs(pendingTravel) < .01 ? pendingTravel : pendingTravel * ease;
      travel = wrap(travel - step, totalDepth);
      pendingTravel -= step;
      dirty = true;
    }
    if (playing && !pointer?.dragged) {
      if (mode === 'tunnel') {
        travel = wrap(travel + elapsed * .023, totalDepth);
        dirty = true;
      } else if (mode === 'ring') {
        yaw += elapsed * .0035;
      } else if (mode === 'cloud' && time > cloudFocusUntil && Math.abs(cloudScale - targetScale) < .001) {
        yaw += elapsed * .0017 * cloudDirection;
        if (Math.abs(yaw) > 22) cloudDirection = yaw > 0 ? -1 : 1;
      } else if (mode === 'stack') {
        stackTime += elapsed;
        if (stackTime > 2800) {
          stackPosition = Math.round(stackPosition) + 1;
          stackTime = 0;
          dirty = true;
        }
      }
    }
    if (dirty) placeCards();
    const depth = mode === 'ring' ? -930 * scale : mode === 'cloud' ? -140 : mode === 'stack' ? -40 : -120;
    // Scale after projection so the pointer stays anchored at every photo depth.
    const magnification = mode === 'cloud' ? cloudScale : 1;
    const cameraZoom = mode === 'cloud' ? 0 : zoom;
    camera.style.transform = `translate3d(${(aimX * 13).toFixed(2)}px,${(aimY * 9).toFixed(2)}px,${(depth + cameraZoom).toFixed(2)}px)`;
    zoomLayer.style.transform = `translate(${panX.toFixed(3)}px,${panY.toFixed(3)}px) scale(${magnification.toFixed(6)})`;
    const sensitivity = mode === 'tunnel' ? 2.5 : 5;
    world.style.transform = `rotateX(${(pitch - aimY * sensitivity).toFixed(2)}deg) rotateY(${(yaw + aimX * sensitivity).toFixed(2)}deg)`;
    if (mode === 'cloud' && magnification > 1.8 && time >= nextImageUpgrade) {
      nextImageUpgrade = time + 200;
      const viewport = stage.getBoundingClientRect();
      for (const card of cards) {
        const image = card.querySelector('img');
        const source = card.getAttribute('href');
        if (image.getAttribute('src') === source) continue;
        const bounds = card.getBoundingClientRect();
        if (bounds.right > viewport.left && bounds.left < viewport.right &&
            bounds.bottom > viewport.top && bounds.top < viewport.bottom) {
          image.src = source;
        }
      }
    }
    if (playing || pointer?.dragged || pendingTravel !== 0 || Math.abs(aimX - targetX) + Math.abs(aimY - targetY) + Math.abs(zoom - targetZoom) + Math.abs(panX - targetPanX) + Math.abs(panY - targetPanY) + Math.abs(cloudScale - targetScale) > .001) {
      frame = requestAnimationFrame(tick);
    }
  }

  function setMode(nextMode) {
    mode = nextMode;
    stage.dataset.spaceMode = mode;
    yaw = 0;
    pitch = 0;
    targetX = 0;
    targetY = 0;
    zoom = 0;
    targetZoom = 0;
    cloudScale = 1;
    panX = 0;
    panY = 0;
    targetPanX = 0;
    targetPanY = 0;
    pendingTravel = 0;
    stackTime = 0;
    dirty = true;
    modeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.spaceMode === mode)));
    document.querySelector('#space-help').textContent = matchMedia('(pointer: coarse)').matches
      ? '左右拖动转动 · 点按看大图 · 上滑继续翻阅'
      : mode === 'tunnel'
        ? '拖动转动 · 滚轮无限穿行 · 点击看大图'
        : '拖动转动 · 滚轮拉近拉远 · 点击看大图';
    placeCards();
    wake();
  }

  function move(direction) {
    if (mode === 'tunnel') travel = wrap(travel + direction * 340, totalDepth);
    if (mode === 'ring') yaw += direction * 18;
    if (mode === 'cloud') yaw = clamp(yaw + direction * 10, -35, 35);
    if (mode === 'stack') stackPosition = Math.round(stackPosition) + direction;
    stackTime = 0;
    dirty = true;
    wake();
  }

  function setZoom(nextZoom, clientX, clientY) {
    if (mode === 'cloud') {
      const bounds = stage.getBoundingClientRect();
      const x = clientX === undefined ? 0 : clientX - bounds.left - bounds.width / 2;
      const y = clientY === undefined ? 0 : clientY - bounds.top - bounds.height / 2;
      const ratio = Math.pow(8, nextZoom / 900) / cloudScale;
      targetPanX = x - (x - panX) * ratio;
      targetPanY = y - (y - panY) * ratio;
      targetX = aimX;
      targetY = aimY;
      cloudFocusUntil = performance.now() + 350;
    }
    targetZoom = nextZoom;
  }

  toolbar.hidden = false;
  modeButtons.forEach(button => button.addEventListener('click', () => setMode(button.dataset.spaceMode)));
  toolbar.querySelector('.space-prev').addEventListener('click', () => move(-1));
  toolbar.querySelector('.space-next').addEventListener('click', () => move(1));
  playButton.addEventListener('click', () => {
    playing = !playing;
    updatePlayback();
  });

  stage.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, dragged: false };
  });
  stage.addEventListener('pointermove', event => {
    const bounds = stage.getBoundingClientRect();
    if (event.pointerType === 'mouse' && !reducedMotion.matches) {
      targetX = clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1);
      targetY = clamp((event.clientY - bounds.top) / bounds.height * 2 - 1, -1, 1);
    }
    if (pointer && pointer.id === event.pointerId) {
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      const totalX = event.clientX - pointer.startX;
      const totalY = event.clientY - pointer.startY;
      if (!pointer.dragged && event.pointerType !== 'mouse' && Math.abs(totalY) > Math.abs(totalX) * 1.2) return;
      if (!pointer.dragged && Math.hypot(totalX, totalY) > 7) {
        pointer.dragged = true;
        stage.setPointerCapture(event.pointerId);
        stage.classList.add('is-dragging');
      }
      if (pointer.dragged) {
        if (mode === 'stack') stackPosition -= dx / (80 * scale);
        else {
          yaw += dx * .13;
          pitch = clamp(pitch - dy * .09, -23, 23);
          if (mode !== 'ring') yaw = clamp(yaw, mode === 'tunnel' ? -8 : -35, mode === 'tunnel' ? 8 : 35);
        }
        dirty = true;
      }
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }
    wake();
  });

  function release(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (pointer.dragged) {
      suppressClickUntil = performance.now() + 400;
      stackPosition = Math.round(stackPosition);
      dirty = true;
    }
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    pointer = null;
    stage.classList.remove('is-dragging');
    wake();
  }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('lostpointercapture', release);
  stage.addEventListener('pointerleave', () => {
    targetX = 0;
    targetY = 0;
    wake();
  });
  stage.addEventListener('dragstart', event => event.preventDefault());
  stage.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  stage.addEventListener('wheel', event => {
    if (event.ctrlKey) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? stage.clientHeight : 1);
    if (mode === 'tunnel') {
      pendingTravel += delta * 1.6;
      event.preventDefault();
      wake();
      return;
    }
    const nextZoom = clamp(targetZoom - delta * .8, -700, mode === 'cloud' ? 900 : 350);
    if (nextZoom === targetZoom) return;
    setZoom(nextZoom, event.clientX, event.clientY);
    event.preventDefault();
    wake();
  }, { passive: false });
  stage.addEventListener('keydown', event => {
    if (event.target !== stage) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') move(event.key === 'ArrowRight' ? 1 : -1);
    else if (event.key === '+' || event.key === '=') setZoom(clamp(targetZoom + 90, -700, mode === 'cloud' ? 900 : 350));
    else if (event.key === '-') setZoom(clamp(targetZoom - 90, -700, mode === 'cloud' ? 900 : 350));
    else if (event.key === ' ') {
      playing = !playing;
      updatePlayback();
    } else return;
    event.preventDefault();
    wake();
  });

  new ResizeObserver(() => {
    scale = clamp(Math.min(stage.clientWidth / 1250, stage.clientHeight / 550), .42, 1.35);
    dirty = true;
    wake();
  }).observe(stage);
  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    wake();
  }).observe(stage);
  new MutationObserver(wake).observe(viewerDialog, { attributes: true, attributeFilter: ['open'] });
  document.addEventListener('visibilitychange', wake);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) playing = false;
    targetX = 0;
    targetY = 0;
    updatePlayback();
  });
  setMode('tunnel');
  updatePlayback();
}
