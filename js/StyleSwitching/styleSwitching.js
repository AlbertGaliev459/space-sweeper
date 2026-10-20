/* ==============================================================
   STYLE SWITCHING — модуль смены стилей DE-1 (Dante)
   Этап 1: каркас без эффектов.
   Подключение: в index.html после styleRank.js, перед main.js
   ============================================================== */
const StyleSwitching = (() => {
  const STYLE_IDS = ['trickster', 'swordmaster', 'gunslinger', 'royalguard'];
  const KEY_MAP = {
    KeyZ: 'trickster',
    KeyX: 'swordmaster',
    KeyC: 'gunslinger',
    KeyV: 'royalguard'
  };
  const GUN_KEY_MAP = {
    Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4
  };
  // По умолчанию — Gunslinger
  let currentStyle = 'gunslinger';

  // Ссылки на DOM
  let indicatorEl = null;
  let touchButtonsEl = null;

  // Пульс при переключении
  let pulseTimer = 0;

  /* ------------------------------------------------------------
     Инициализация
     ------------------------------------------------------------ */
  function init() {
    // Создаём DOM-элементы внутри canvas-wrap
    const canvasWrap = document.querySelector('.canvas-wrap');
    if (!canvasWrap) {
      console.warn('[StyleSwitching] .canvas-wrap не найден');
      return;
    }

    createIndicator(canvasWrap);
    createTouchButtons(canvasWrap);

    // Клавиатурные обработчики — в фазе захвата, до основных
    document.addEventListener('keydown', onKeyDown, true);

    // Проверяем тач-устройство
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouch && touchButtonsEl) {
      touchButtonsEl.classList.add('visible');
    }

    // Стартовый стиль
    applyStyle(currentStyle, { silent: true });

    // Тик для эффектов
    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------
     DOM: индикатор активного стиля
     ------------------------------------------------------------ */
  function createIndicator(parent) {
    indicatorEl = document.createElement('div');
    indicatorEl.className = 'style-indicator';
    indicatorEl.dataset.style = currentStyle;
    indicatorEl.innerHTML = `
      <div class="style-name" id="styleNameLabel">Gunslinger</div>
      <div class="style-key" id="styleKeyLabel">клавиша C</div>
    `;
    parent.appendChild(indicatorEl);
  }

  /* ------------------------------------------------------------
     DOM: тач-кнопки стилей
     ------------------------------------------------------------ */
  function createTouchButtons(parent) {
    touchButtonsEl = document.createElement('div');
    touchButtonsEl.className = 'style-touch-buttons';

    STYLE_IDS.forEach(styleId => {
      const meta = StyleEffects.metadata[styleId];
      const btn = document.createElement('button');
      btn.className = 'style-touch-btn';
      btn.dataset.style = styleId;
      btn.title = meta.name;
      btn.textContent = meta.key;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        switchTo(styleId);
      });
      // На тач — touchstart для мгновенной реакции
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        switchTo(styleId);
      }, { passive: false });
      touchButtonsEl.appendChild(btn);
    });

    parent.appendChild(touchButtonsEl);
    refreshTouchButtons();
  }

  function refreshTouchButtons() {
    if (!touchButtonsEl) return;
    touchButtonsEl.querySelectorAll('.style-touch-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.style === currentStyle);
    });
  }

  /* ------------------------------------------------------------
     Клавиатура
     ------------------------------------------------------------ */
    function onKeyDown(e) {
    // 1. Смена стиля
    const styleId = KEY_MAP[e.code];
    if (styleId) {
      if (UI.getCurrentScreen() !== 'game') return;
      if (document.querySelector('.overlay.active')) return;
      e.preventDefault();
      e.stopPropagation();
      switchTo(styleId);
      return;
    }

    // 2. Смена пушки (только в Gunslinger)
    const gunId = GUN_KEY_MAP[e.code];
    if (gunId) {
      if (UI.getCurrentScreen() !== 'game') return;
      if (document.querySelector('.overlay.active')) return;
      if (currentStyle !== 'gunslinger') return;
      
      e.preventDefault();
      e.stopPropagation();
      
      if (typeof StyleEffects !== 'undefined') {
        StyleEffects.switchGun(gunId);
        if (typeof Sound !== 'undefined' && Sound.click) Sound.click();
      }
    }
  }

  /* ------------------------------------------------------------
     Переключение стиля
     ------------------------------------------------------------ */
  function switchTo(styleId) {
    if (!STYLE_IDS.includes(styleId)) return;
    if (styleId === currentStyle) return;

        // Деактивируем старый
    StyleEffects.onDeactivate(currentStyle);

    // Меняем
    currentStyle = styleId;
    StyleEffects.setCurrentStyle(styleId);
    applyStyle(currentStyle);

    // Активируем новый
    StyleEffects.onActivate(currentStyle);

    // Пульс на индикаторе
    pulseTimer = 0.25;
    if (indicatorEl) {
      indicatorEl.classList.add('switch-pulse');
      setTimeout(() => {
        if (indicatorEl) indicatorEl.classList.remove('switch-pulse');
      }, 200);
    }

    // Звук — переключение стиля
    if (typeof Sound !== 'undefined' && Sound.click) {
      Sound.click();
    }

    refreshTouchButtons();
  }

  function applyStyle(styleId, opts = {}) {
    if (!indicatorEl) return;
    const meta = StyleEffects.metadata[styleId];
    if (!meta) return;

    indicatorEl.dataset.style = styleId;
    const nameEl = indicatorEl.querySelector('.style-name');
    const keyEl  = indicatorEl.querySelector('.style-key');
    if (nameEl) nameEl.textContent = meta.name;
    if (keyEl)  keyEl.textContent  = 'клавиша ' + meta.key;

    if (!opts.silent) {
      // Пока — только визуал. В следующих этапах — реальные эффекты.
    }
  }

  /* ------------------------------------------------------------
     Публикация событий из ядра игры
     Вызывать из game.js в соответствующих местах.
     ------------------------------------------------------------ */
  function onGameTick(dt) {
    StyleEffects.onTick(dt, getGameState());
    if (pulseTimer > 0) pulseTimer -= dt;
  }

  function onGameShoot() {
    StyleEffects.onShoot();
  }

  function onGameSwordSwing() {
    StyleEffects.onSwordSwing();
  }

  function onGameDash() {
    StyleEffects.onDash();
  }

  /* ------------------------------------------------------------
     Хелпер: получить состояние игры (только для чтения)
     ------------------------------------------------------------ */
  function getGameState() {
    if (typeof Game === 'undefined' || !Game.publicState) return {};
    const st = Game.publicState;
    return {
      running:       st.running,
      gameOver:      st.gameOver,
      swordActive:   st.swordActive,
      swordCooldown: st.swordCooldown,
      shieldTime:    st.shieldTime,
      magnetTime:    st.magnetTime,
      x2Time:        st.x2Time
    };
  }

  /* ------------------------------------------------------------
     Тик — вызывается из RAF, но пока ничего тяжёлого
     ------------------------------------------------------------ */
  let lastTick = 0;
  function tick(ts) {
    if (!lastTick) lastTick = ts;
    const dt = Math.min((ts - lastTick) / 1000, 0.05);
    lastTick = ts;

    if (getGameState().running) {
      onGameTick(dt);
    }
    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------
     Публичный API
     ------------------------------------------------------------ */
  return {
    init,
    switchTo,
    getCurrentStyle: () => currentStyle,
    // Вызывать из game.js:
    onGameTick,
    onGameShoot,
    onGameSwordSwing,
    onGameDash
  };
})();