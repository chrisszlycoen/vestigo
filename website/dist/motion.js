/* Original film playback and a coordinated, pauseable page motion system. */
(() => {
  const film = document.querySelector('#memory-film');
  const filmButton = document.querySelector('#film-play');
  const demo = document.querySelector('#editor-demo');
  const demoButton = document.querySelector('#demo-autoplay');
  const demoProgress = document.querySelector('.demo-timeline i');
  const media = [...document.querySelectorAll('video')];
  const saveData = Boolean(navigator.connection?.saveData);
  const scenes = ['resume', 'decide', 'clone'];
  const sceneLabels = ['01 / Pick up the thread', '02 / Remember the why', '03 / Context travels'];
  let demoVisible = false;
  let demoAutomatic = !motionPaused && !saveData;
  let demoHover = false;
  let demoFocus = false;
  let demoElapsed = 0;
  let previousFrame = 0;
  let frameId = 0;
  let filmExplicitlyPaused = false;

  const isDialogOpen = () => [...document.querySelectorAll('dialog')].some((dialog) => dialog.open);
  const mayMove = () => !motionPaused && !document.hidden && !isDialogOpen();

  function ensureVideo(video) {
    if (video.dataset.loaded || !video.dataset.src) { return; }
    video.src = video.dataset.src;
    video.dataset.loaded = 'true';
    video.load();
  }

  function updateFilmButton() {
    const playing = !film.paused;
    filmButton.setAttribute('aria-pressed', String(playing));
    filmButton.querySelector('.film-play-icon').textContent = playing ? 'Ⅱ' : '▶';
    filmButton.querySelector('span:last-child').textContent = playing ? 'Pause the film' : 'Play the memory film';
  }

  function synchronizeVideo() {
    media.forEach((video) => {
      const visible = video.dataset.inView === 'true';
      const autoAllowed = !saveData && !reducedMotion.matches;
      const allowed = mayMove() && visible && (autoAllowed || video.dataset.explicitPlay === 'true')
        && !(video === film && filmExplicitlyPaused);
      if (allowed) {
        ensureVideo(video);
        if (video.dataset.loaded) { void video.play().catch(() => { updateFilmButton(); }); }
      } else { video.pause(); }
    });
    updateFilmButton();
  }

  filmButton.addEventListener('click', () => {
    if (!film.paused) {
      filmExplicitlyPaused = true;
      film.pause();
    } else {
      filmExplicitlyPaused = false;
      film.dataset.explicitPlay = 'true';
      if (motionPaused) { motionPaused = false; updateMotion(); }
      ensureVideo(film);
      void film.play().catch(() => { filmButton.querySelector('span:last-child').textContent = 'Video unavailable — try again'; });
    }
    updateFilmButton();
  });
  film.addEventListener('play', updateFilmButton);
  film.addEventListener('pause', updateFilmButton);
  film.addEventListener('error', () => { filmButton.querySelector('span:last-child').textContent = 'Video unavailable — try again'; });
  film.addEventListener('timeupdate', () => {
    const duration = Number.isFinite(film.duration) ? film.duration : 8;
    const current = Math.min(film.currentTime, duration);
    const clock = (seconds) => `00:${String(Math.floor(seconds)).padStart(2, '0')}`;
    document.querySelector('#film-time').textContent = `${clock(current)} / ${clock(duration)}`;
    document.querySelector('.film-scrubber > span').style.transform = `scaleX(${current / duration})`;
    const chapter = Math.min(2, Math.floor(current / duration * 3));
    document.querySelectorAll('[data-film-chapter]').forEach((label, index) => label.classList.toggle('active', index === chapter));
  });

  function updateDemoButton() {
    demoButton.setAttribute('aria-pressed', String(demoAutomatic));
    demoButton.innerHTML = demoAutomatic ? 'Pause walkthrough <span aria-hidden="true">Ⅱ</span>' : 'Play walkthrough <span aria-hidden="true">▷</span>';
    document.querySelector('#demo-phase-label').textContent = sceneLabels[scenes.indexOf(activeScenario)];
  }

  function mayAdvanceDemo() {
    return demoVisible && demoAutomatic && !demoHover && !demoFocus && mayMove();
  }

  function tick(now) {
    frameId = 0;
    if (!mayAdvanceDemo()) { previousFrame = 0; return; }
    if (previousFrame) { demoElapsed += Math.min(now - previousFrame, 80); }
    previousFrame = now;
    if (demoElapsed >= 6500) {
      demoElapsed = 0;
      selectScenario(scenes[(scenes.indexOf(activeScenario) + 1) % scenes.length]);
      updateDemoButton();
    }
    demoProgress.style.transform = `scaleX(${demoElapsed / 6500})`;
    frameId = requestAnimationFrame(tick);
  }

  function synchronizeDemo() {
    updateDemoButton();
    if (mayAdvanceDemo() && !frameId) { previousFrame = 0; frameId = requestAnimationFrame(tick); }
    if (!mayAdvanceDemo() && frameId) { cancelAnimationFrame(frameId); frameId = 0; previousFrame = 0; }
  }

  function manualDemo() { demoAutomatic = false; demoElapsed = 0; synchronizeDemo(); }
  document.querySelectorAll('.demo-tab').forEach((button) => {
    button.addEventListener('click', manualDemo);
    button.addEventListener('keydown', (event) => { if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { manualDemo(); } });
  });
  document.querySelector('#memory-search').addEventListener('input', manualDemo);
  demo.addEventListener('mouseenter', () => { demoHover = true; synchronizeDemo(); });
  demo.addEventListener('mouseleave', () => { demoHover = false; synchronizeDemo(); });
  demo.addEventListener('focusin', () => { demoFocus = true; synchronizeDemo(); });
  demo.addEventListener('focusout', () => { requestAnimationFrame(() => { demoFocus = demo.contains(document.activeElement); synchronizeDemo(); }); });
  demoButton.addEventListener('click', () => {
    if (motionPaused) { motionPaused = false; updateMotion(); }
    demoAutomatic = !demoAutomatic;
    synchronizeDemo();
  });
  document.querySelector('#replay-demo').addEventListener('click', () => {
    if (motionPaused) { motionPaused = false; updateMotion(); }
    selectScenario('resume'); demoElapsed = 0; demoAutomatic = true; synchronizeDemo();
  });

  if ('IntersectionObserver' in window) {
    const visibility = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === demo) { demoVisible = entry.isIntersecting; }
        else { entry.target.dataset.inView = String(entry.isIntersecting); }
      }
      synchronizeVideo(); synchronizeDemo();
    }, { threshold: .2 });
    visibility.observe(demo);
    media.forEach((video) => visibility.observe(video));
  } else {
    demoVisible = true;
    media.forEach((video) => { video.dataset.inView = 'true'; });
  }

  // Reveal the editorial statement one line at a time as it enters the viewport.
  const statement = document.querySelector('.memory-manifesto > p');
  const originalLines = statement.innerHTML.split(/<br\s*\/?>/i);
  statement.innerHTML = originalLines.map((line) => `<span class="manifesto-line">${line}</span>`).join('');
  if ('IntersectionObserver' in window) {
    const reading = new IntersectionObserver((entries) => entries.forEach((entry) => {
      entry.target.classList.toggle('is-read', entry.isIntersecting);
    }), { rootMargin: '0px 0px -12% 0px', threshold: .5 });
    statement.querySelectorAll('.manifesto-line').forEach((line) => reading.observe(line));
    const steps = new IntersectionObserver((entries) => entries.forEach((entry) => entry.target.classList.toggle('is-current', entry.isIntersecting)), { rootMargin: '-25% 0px -30% 0px', threshold: .5 });
    document.querySelectorAll('.step').forEach((step) => steps.observe(step));
  } else { statement.querySelectorAll('.manifesto-line').forEach((line) => line.classList.add('is-read')); }

  const thread = document.querySelector('.thread-progress');
  const threadLength = thread.getTotalLength();
  thread.style.strokeDasharray = String(threadLength);
  let scrollScheduled = false;
  function scrollMotion() {
    scrollScheduled = false;
    const progress = Math.min(1,Math.max(0,scrollY / Math.max(1,document.documentElement.scrollHeight - innerHeight)));
    thread.style.strokeDashoffset = String(threadLength * (1 - progress));
    const point = thread.getPointAtLength(threadLength * progress);
    document.querySelector('.thread-runner').style.transform = `translate(${point.x / 60 * 46}px,${point.y / 1000 * document.querySelector('.page-thread').clientHeight}px)`;
    const rect = demo.getBoundingClientRect();
    const tilt = motionPaused || innerWidth < 900 ? 0 : Math.min(2.5, Math.max(0, rect.top / innerHeight * 3));
    demo.style.setProperty('--editor-tilt', `${tilt}deg`);
  }
  window.addEventListener('scroll', () => { if (!scrollScheduled) { scrollScheduled = true; requestAnimationFrame(scrollMotion); } }, { passive: true });
  window.addEventListener('resize', scrollMotion, { passive: true });
  document.addEventListener('visibilitychange', () => {
    document.documentElement.classList.toggle('tab-inactive', document.hidden);
    synchronizeVideo(); synchronizeDemo();
  });
  document.addEventListener('vestigo:motionchange', () => { synchronizeVideo(); synchronizeDemo(); scrollMotion(); });
  document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('toggle', () => { synchronizeVideo(); synchronizeDemo(); }));
  document.documentElement.classList.add('motion-ready');
  updateFilmButton(); synchronizeDemo(); scrollMotion();
})();
