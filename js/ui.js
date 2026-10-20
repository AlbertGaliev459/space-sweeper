/* ==============================================================
   UI — экраны, оверлеи, слайдеры, джойстик, Лор
   ============================================================== */

/* --- Управление экранами --- */
const UI = (() => {
  const screensList = ['menu', 'game', 'gameover', 'scores', 'lore'];
  let currentScreen = 'lore';
  let settingsReturnTo = null;

  function goto(name) {
    Sound.click();
    screensList.forEach(s => {
      const el = document.getElementById('screen-' + s);
      if (el) el.classList.remove('active');
    });
    document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));

    const target = document.getElementById('screen-' + name);
    if (target) target.classList.add('active');
    currentScreen = name;

    if (name === 'game')   Game.start();
    if (name === 'scores') renderScores();
  }

  function openOverlay(name, opts = {}) {
    Sound.click();
    const el = document.getElementById('overlay-' + name);
    if (!el) return;

    if (name === 'settings' && opts.returnTo) settingsReturnTo = opts.returnTo;

    el.classList.add('active');
    if (name === 'pause') Game.pause();
  }

  function closeOverlay(name) {
    Sound.click();
    const el = document.getElementById('overlay-' + name);
    if (el) el.classList.remove('active');

    if (name === 'settings' && settingsReturnTo) {
      const back = settingsReturnTo;
      settingsReturnTo = null;
      if (back === 'pause') {
        document.getElementById('overlay-pause').classList.add('active');
      }
      return;
    }

    if (name === 'pause' && currentScreen === 'game') {
      const another = document.querySelector('.overlay.active');
      if (!another) Game.resume();
    }
  }

  function pauseToMenu() {
    Sound.click();
    document.getElementById('overlay-pause').classList.remove('active');
    Game.pause();
    goto('menu');
  }

  function getCurrentScreen() { return currentScreen; }

  return { goto, openOverlay, closeOverlay, pauseToMenu, getCurrentScreen };
})();

/* --- Рекорды --- */
function renderScores() {
  const list = Storage.getScores();
  const el = document.getElementById('scoresList');
  if (!list.length) {
    el.innerHTML = '<div class="empty">Рекордов пока нет</div>';
    return;
  }
  el.innerHTML = list.map((s, i) =>
    `<div><span class="rank">${i + 1}.</span> ${s.score} очков ` +
    `<span style="color:#888;font-size:0.8em">(${s.date})</span></div>`
  ).join('');
}

function clearScores() {
  if (confirm('Сбросить все рекорды?')) {
    Storage.clearScores();
    renderScores();
  }
}

/* --- Лор --- */
const Lore = (() => {
  const DURATION = 8;
  const SESSION_KEY = 'spaceSweeper.loreShown';
  let timerId = null;
  let countdownId = null;

  function show() {
    UI.goto('lore');
    let remaining = DURATION;
    const timerEl = document.getElementById('loreTimer');

    countdownId = setInterval(() => {
      remaining--;
      if (timerEl) {
        timerEl.textContent = 'АВТОЗАПУСК ЧЕРЕЗ ' + Math.max(0, remaining) + ' С';
      }
    }, 1000);

    timerId = setTimeout(finish, DURATION * 1000);
  }

  function finish() {
    if (timerId)      { clearTimeout(timerId);   timerId = null; }
    if (countdownId)  { clearInterval(countdownId); countdownId = null; }
    sessionStorage.setItem(SESSION_KEY, '1');
    UI.goto('game');
  }

  function skip() { Sound.click(); finish(); }
  function alreadyShown() { return sessionStorage.getItem(SESSION_KEY) === '1'; }

  return { show, skip, alreadyShown };
})();

/* --- Джойстик --- */
const Joystick = (() => {
  const state = {
    active: false,
    baseX: 0, baseY: 0,
    knobX: 0, knobY: 0,
    dx: 0, dy: 0,
    touchId: null,
    radius: 60,
    maxOffset: 45
  };

  function start(cx, cy, id) {
    state.active = true;
    state.baseX = cx; state.baseY = cy;
    state.knobX = cx; state.knobY = cy;
    state.dx = 0; state.dy = 0;
    state.touchId = id;
  }

  function move(cx, cy) {
    if (!state.active) return;
    let dx = cx - state.baseX;
    let dy = cy - state.baseY;
    const dist = Math.hypot(dx, dy);
    const max = state.maxOffset;
    if (dist > max) { dx = (dx / dist) * max; dy = (dy / dist) * max; }
    state.knobX = state.baseX + dx;
    state.knobY = state.baseY + dy;
    state.dx = dx / max;
    state.dy = dy / max;
  }

  function end() {
    state.active = false;
    state.dx = 0; state.dy = 0;
    state.touchId = null;
  }

  return { state, start, move, end };
})();

/* --- Слайдеры и HUD --- */
(function extendUI() {
  function updateBuffUI() {
    const x2El = document.getElementById('buff-x2');
    const mgEl = document.getElementById('buff-magnet');
    const shEl = document.getElementById('buff-shield');
    const swEl = document.getElementById('buff-sword');
    const parryBtn = document.getElementById('parryBtn');

    const st = Game.publicState;

    x2El.textContent = '⚡ x2: '     + (st.x2Time     > 0 ? Math.ceil(st.x2Time)     + 'с' : '—');
    mgEl.textContent = '🧲 Магнит: ' + (st.magnetTime > 0 ? Math.ceil(st.magnetTime) + 'с' : '—');
    shEl.textContent = '🛡 Щит: '    + (st.shieldTime > 0 ? Math.ceil(st.shieldTime) + 'с' : '—');

    if (st.swordActive) {
      if (st.swordSwingTimer > 0) {
        swEl.textContent = '⚔️ ПАРИРУЮ!';
        swEl.classList.add('sword-parry');
        swEl.classList.remove('sword-ready', 'sword-cooldown');
      } else if (st.swordCooldown > 0 || st.swordVulnerable > 0) {
        const left = Math.max(0, st.swordCooldown) + Math.max(0, st.swordVulnerable);
        swEl.textContent = '⚔️ Меч: ' + left.toFixed(1) + 'с';
        swEl.classList.add('sword-cooldown');
        swEl.classList.remove('sword-parry', 'sword-ready');
      } else {
        swEl.textContent = '⚔️ Меч: готов';
        swEl.classList.add('sword-ready');
        swEl.classList.remove('sword-parry', 'sword-cooldown');
      }

      if (st.swordCooldown > 0 || st.swordVulnerable > 0) {
        const total = st.SWORD_COOLDOWN + st.SWORD_VULNERABLE;
        const left = Math.max(0, st.swordCooldown) + Math.max(0, st.swordVulnerable);
        const readyRatio = 1 - left / total;
        parryBtn.style.setProperty('--cd', readyRatio.toFixed(2));
        parryBtn.classList.add('cooldown');
      } else {
        parryBtn.style.setProperty('--cd', '1');
        parryBtn.classList.remove('cooldown');
      }
    } else {
      swEl.textContent = '⚔️ Меч: —';
      swEl.classList.remove('sword-parry', 'sword-ready', 'sword-cooldown');
      if (parryBtn) parryBtn.classList.remove('cooldown');
    }

    x2El.classList.toggle('active', st.x2Time     > 0);
    mgEl.classList.toggle('active', st.magnetTime > 0);
    shEl.classList.toggle('active', st.shieldTime > 0);
  }

  function updateSliderUI(sliderId, valId, iconId) {
    const slider = document.getElementById(sliderId);
    const val    = document.getElementById(valId);
    const icon   = document.getElementById(iconId);
    if (!slider || !val || !icon) return;

    const pct = parseInt(slider.value, 10);
    val.textContent = pct + '%';
    slider.style.setProperty('--fill', pct + '%');

    if (pct === 0)      { icon.textContent = '🔇'; icon.classList.add('muted'); }
    else if (pct < 30)  { icon.textContent = '🔈'; icon.classList.remove('muted'); }
    else if (pct < 70)  { icon.textContent = '🔉'; icon.classList.remove('muted'); }
    else                { icon.textContent = '🔊'; icon.classList.remove('muted'); }
  }

  function bindSlider(sliderId, valId, iconId, onInput, onCommit) {
    const slider = document.getElementById(sliderId);
    if (!slider) return;

    slider.addEventListener('input', () => {
      updateSliderUI(sliderId, valId, iconId);
      if (onInput) onInput(parseInt(slider.value, 10) / 100);
    });

    slider.addEventListener('change', () => {
      if (onCommit) onCommit(parseInt(slider.value, 10) / 100);
    });

    updateSliderUI(sliderId, valId, iconId);
  }

  function resetSettings() {
    Sound.click();
    Sound.setSfx(0.8);

    const sliderMusic = document.getElementById('sliderMusic');
    const sliderSfx   = document.getElementById('sliderSfx');
    sliderSfx.value   = '80';
    sliderMusic.value = '60';

    updateSliderUI('sliderSfx',   'valSfx',   'iconSfx');
    updateSliderUI('sliderMusic', 'valMusic', 'iconMusic');

    Storage.saveSettings({ sfx: 0.8, music: 0.6 });
  }

  function showAbout() {
    Sound.click();
    alert('Космический уборщик — казуальная бесконечная аркада.\n\n' +
          'Корабль DE-1 (DantE). На 50 очках появляется босс — VL (VergiL).\n\n' +
          'Пока VL на арене — у DE-1 материализуется меч (Rebellion).\n' +
          'Пробел (или кнопка ПАРИР) — взмах мечом. У меча есть перезарядка!\n\n' +
          '=== PERFECT PARRY ===\n' +
          'Если парировать в первые 0.1 сек взмаха — урон ×2 и больше стиля!\n\n' +
          '=== РАНГ СТИЛЯ ===\n' +
          'D → C → B → A → S → SS → SSS\n' +
          'Растёт за цепочку действий без урона.\n' +
          'Угасает со временем. Обнуляется при получении урона.');
  }

  function quitGame() {
    Sound.click();
    if (confirm('Выйти из игры?')) {
      window.close();
      alert('Браузер не даёт закрыть вкладку программно — закройте вручную.');
    }
  }

  // Публикуем в UI
  UI.updateBuffUI       = updateBuffUI;
  UI.updateSliderUI     = updateSliderUI;
  UI.bindSlider         = bindSlider;
  UI.resetSettings      = resetSettings;
  UI.showAbout          = showAbout;
  UI.quitGame           = quitGame;
})();