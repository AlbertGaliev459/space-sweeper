/* ==============================================================
   ГЛАВНЫЙ МОДУЛЬ — клавиатура, action-кнопки, fullscreen, init
   ============================================================== */

/* --- Глобальный объект клавиш (используется Game и ui) --- */
const keys = {};

/* --- Навешиваем обработчики на [data-action] --- */
function bindActions() {
  document.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', () => {
      const action = el.dataset.action;
      switch (action) {
        case 'play':                UI.goto('game'); break;
        case 'menu':                UI.goto('menu'); break;
        case 'scores':              UI.goto('scores'); break;
        case 'pause':               UI.openOverlay('pause'); break;
        case 'resume':              UI.closeOverlay('pause'); break;
        case 'settings-from-menu':  UI.openOverlay('settings', { returnTo: 'menu' }); break;
        case 'settings-from-pause': UI.openOverlay('settings', { returnTo: 'pause' }); break;
        case 'close-settings':      UI.closeOverlay('settings'); break;
        case 'reset-settings':      UI.resetSettings(); break;
        case 'pause-to-menu':       UI.pauseToMenu(); break;
        case 'clear-scores':        clearScores(); break;
        case 'about':               UI.showAbout(); break;
        case 'quit':                UI.quitGame(); break;
      }
    });
  });
}

/* --- Клавиатура --- */
function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Лор — пропустить
    if (UI.getCurrentScreen() === 'lore') {
      if (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter') {
        e.preventDefault();
        Lore.skip();
        return;
      }
    }

    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
      e.preventDefault();
    }
    keys[e.code] = true;

// === Рывок по Shift (одноразово, не автоповтор) ===
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
      if (UI.getCurrentScreen() === 'game' && !document.querySelector('.overlay.active')) {
        if (typeof Game.tryDash === 'function') Game.tryDash();
      }
    }
    if (e.code === 'Escape' && UI.getCurrentScreen() === 'game') {
      const pause    = document.getElementById('overlay-pause');
      const settings = document.getElementById('overlay-settings');

      if (settings.classList.contains('active'))      UI.closeOverlay('settings');
      else if (pause.classList.contains('active'))    UI.closeOverlay('pause');
      else                                            UI.openOverlay('pause');
    }
  });

  document.addEventListener('keyup', (e) => { keys[e.code] = false; });

  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    keys['MouseLeft'] = false;
  });

  // === ЛКМ — стрельба / парирование ===
  const canvasEl = document.getElementById('gameCanvas');

  let mouseHolding = false;

  function isGameActive() {
    return UI.getCurrentScreen() === 'game'
        && !document.querySelector('.overlay.active');
  }

  // Вызывается каждый кадр из RAF, пока ЛКМ зажата.
  // Внутри Game.shoot() и Game.swingSword() свои кулдауны —
  // значит, темп идентичен пробелу.
  function tryShoot() {
    if (!isGameActive()) return;
    Game.shoot();
    Game.swingSword();
  }

  canvasEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;   // только ЛКМ
    e.preventDefault();
    mouseHolding = true;
    keys['MouseLeft'] = true;
    tryShoot();                    // мгновенный первый выстрел
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    mouseHolding = false;
    keys['MouseLeft'] = false;
  });

  // Если окно потеряло фокус — перестаём стрелять
  window.addEventListener('blur', () => {
    mouseHolding = false;
  });

  // Контекстное меню по правой кнопке — глушим в игре
  canvasEl.addEventListener('contextmenu', (e) => {
    if (UI.getCurrentScreen() === 'game') e.preventDefault();
  });

  // === Тик ЛКМ: вызывается из общей RAF-петли ===
  // Это даёт ту же частоту, что и пробел (60 вызовов в секунду на 60 FPS),
  // а реальный темп стрельбы ограничивает bulletCooldown внутри Game.shoot()
  function tickMouse() {
    if (mouseHolding) tryShoot();
    requestAnimationFrame(tickMouse);
  }
  requestAnimationFrame(tickMouse);
}

/* --- Тач-управление: джойстик + кнопки --- */
function bindTouch() {
  const canvasEl = document.getElementById('gameCanvas');
  const fireBtn  = document.getElementById('fireBtn');
  const parryBtn = document.getElementById('parryBtn');

  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (isTouchDevice) {
    fireBtn.classList.add('visible');
    document.getElementById('canvasHint').textContent =
      '← джойстик · ОГОНЬ / ПАРИР — справа →';
  }

  // Джойстик
  canvasEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (Joystick.state.active) return;
    const t = e.changedTouches[0];
    const rect = canvasEl.getBoundingClientRect();
    Joystick.start(
      (t.clientX - rect.left) * (800 / rect.width),
      (t.clientY - rect.top)  * (450 / rect.height),
      t.identifier
    );
  }, { passive: false });

  canvasEl.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!Joystick.state.active) return;
    for (const t of e.changedTouches) {
      if (t.identifier === Joystick.state.touchId) {
        const rect = canvasEl.getBoundingClientRect();
        Joystick.move(
          (t.clientX - rect.left) * (800 / rect.width),
          (t.clientY - rect.top)  * (450 / rect.height)
        );
      }
    }
  }, { passive: false });

  function endTouch(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === Joystick.state.touchId) Joystick.end();
    }
  }
  canvasEl.addEventListener('touchend',    endTouch, { passive: false });
  canvasEl.addEventListener('touchcancel', endTouch, { passive: false });

  // ОГОНЬ
  let fireInterval = null;
  function startFiring(e) {
    e.preventDefault();
    Game.shoot();
    fireInterval = setInterval(() => Game.shoot(), 150);
  }
  function stopFiring(e) {
    e.preventDefault();
    if (fireInterval) { clearInterval(fireInterval); fireInterval = null; }
  }
  fireBtn.addEventListener('touchstart',  startFiring, { passive: false });
  fireBtn.addEventListener('touchend',    stopFiring,  { passive: false });
  fireBtn.addEventListener('touchcancel', stopFiring,  { passive: false });
  fireBtn.addEventListener('mousedown',   startFiring);
  fireBtn.addEventListener('mouseup',     stopFiring);
  fireBtn.addEventListener('mouseleave',  stopFiring);

  // ПАРИР
  function doParry(e) { e.preventDefault(); Game.swingSword(); }
  parryBtn.addEventListener('touchstart', doParry, { passive: false });
  parryBtn.addEventListener('mousedown',  doParry);

  // РЫВОК
  const dashBtn = document.getElementById('dashBtn');
  if (dashBtn) {
    dashBtn.classList.add('visible');
    function doDash(e) {
      e.preventDefault();
      if (typeof Game.tryDash === 'function') Game.tryDash();
    }
    dashBtn.addEventListener('touchstart', doDash, { passive: false });
    dashBtn.addEventListener('mousedown',  doDash);
  }
}


/* --- Fullscreen --- */
function bindFullscreen() {
  const fsBtn = document.getElementById('fsBtn');
  fsBtn.addEventListener('click', () => {
    Sound.click();
    const el = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      req && req.call(el).catch(err => console.warn('Fullscreen error', err));
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      exit && exit.call(document);
    }
  });

  function refreshCanvasSize() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    const c = canvas.getContext('2d');
    c.setTransform((dpr * rect.width) / 800, 0, 0, (dpr * rect.height) / 450, 0, 0);
  }
  document.addEventListener('fullscreenchange', () => setTimeout(refreshCanvasSize, 150));
  window.addEventListener('resize', refreshCanvasSize);
}

/* --- Слайдеры настроек --- */
function bindSettings() {
  // Музыка: изменение применяется в реальном времени (когда музыка будет),
  // в localStorage пишется только на 'change'
  UI.bindSlider('sliderMusic', 'valMusic', 'iconMusic',
    (v) => { /* real-time music volume */ },
    (v) => {
      const s = Storage.getSettings();
      s.music = v;
      Storage.saveSettings(s);
    }
  );

  // Звуки: применяем сразу, сохраняем по отпускании
  UI.bindSlider('sliderSfx', 'valSfx', 'iconSfx',
    (v) => { Sound.setSfx(v); },
    (v) => {
      const s = Storage.getSettings();
      s.sfx = v;
      Storage.saveSettings(s);
    }
  );
}

/* --- Инициализация --- */
(function init() {
  // Звук — читаем сохранённые настройки
  const s = Storage.getSettings();
  Sound.setSfx(s.sfx);

  // Слайдеры: применяем значения
  const sliderMusic = document.getElementById('sliderMusic');
  const sliderSfx   = document.getElementById('sliderSfx');
  sliderSfx.value   = String(Math.round(s.sfx   * 100));
  sliderMusic.value = String(Math.round(s.music * 100));

  UI.updateSliderUI('sliderSfx',   'valSfx',   'iconSfx');
  UI.updateSliderUI('sliderMusic', 'valMusic', 'iconMusic');

  // Навешиваем всё
  bindActions();
  bindKeyboard();
  bindTouch();
  bindFullscreen();
  bindSettings();

  // Лор — если впервые за сессию
  if (Lore.alreadyShown()) {
    UI.goto('menu');
  } else {
    Lore.show();
  }

    if (typeof StyleSwitching !== 'undefined') {
    StyleSwitching.init();
    if (typeof StyleEffects !== 'undefined') {
      StyleEffects.setCurrentStyle(StyleSwitching.getCurrentStyle());
    }
  }

  // Клик по фрейму — фокус для клавиатуры
  window.focus();
  document.getElementById('gameFrame').addEventListener('click', () => window.focus());
})();