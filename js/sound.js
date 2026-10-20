/* ==============================================================
   ЗВУК — Web Audio API
   ============================================================== */
const Sound = (() => {
  let ctx = null;
  let sfxVolume = 0.8;

  function init() {
    if (ctx) return;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { console.warn('Web Audio не поддерживается', e); }
  }

  function beep(freq, duration, type = 'square', volume = 1, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = sfxVolume * volume * 0.15;
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration);
  }

  return {
    init,
    click()    { init(); beep(600, 0.06, 'square', 0.6); },
    pickup()   { init(); beep(880, 0.08, 'sine', 0.8); beep(1200, 0.06, 'sine', 0.6, 0.04); },
    hit()      { init(); beep(120, 0.25, 'sawtooth', 1); },
    shoot()    { init(); beep(1400, 0.04, 'square', 0.35); },
    bossHit()  { init(); beep(240, 0.06, 'sawtooth', 0.4); },
    parry() {
      init();
      beep(2400, 0.08, 'triangle', 0.7);
      beep(3200, 0.06, 'triangle', 0.5, 0.03);
      beep(1800, 0.1,  'square',   0.4, 0.06);
    },
    swordSummon() {
      init();
      beep(400,  0.4, 'sawtooth', 0.7);
      beep(600,  0.3, 'sawtooth', 0.6, 0.1);
      beep(1800, 0.15, 'square',  0.7, 0.35);
      beep(2200, 0.1,  'square',  0.6, 0.5);
    },
    parrySuccess() {
      init();
      beep(2000, 0.06, 'square', 0.5);
      beep(2600, 0.08, 'square', 0.5, 0.05);
      beep(1500, 0.12, 'sawtooth', 0.4, 0.12);
    },
    vergilAppear() {
      init();
      beep(80,  0.4, 'sawtooth', 0.8);
      beep(160, 0.3, 'sawtooth', 0.6, 0.1);
      beep(2000, 0.15, 'square', 0.5, 0.25);
      beep(1800, 0.1, 'square', 0.4, 0.4);
    },
    vergilTeleport() {
      init();
      beep(1800, 0.05, 'square', 0.5);
      beep(2200, 0.04, 'square', 0.4, 0.03);
    },
    vergilSlash() {
      init();
      beep(2400, 0.08, 'sawtooth', 0.6);
      beep(1800, 0.06, 'sawtooth', 0.4, 0.05);
    },
    vergilJudgement() {
      init();
      for (let i = 0; i < 6; i++) beep(2000 + i * 100, 0.05, 'sawtooth', 0.5, i * 0.06);
    },
    vergilDeath() {
      init();
      beep(120, 0.3, 'sawtooth', 1);
      beep(90,  0.5, 'sawtooth', 0.9, 0.2);
      beep(2000, 0.2, 'square',   0.7, 0.6);
      beep(1500, 0.3, 'square',   0.6, 0.85);
    },
    vergilPhaseRoar() {
      init();
      // Низкий рёв
      beep(70,  0.5, 'sawtooth', 1.0);
      beep(55,  0.6, 'sawtooth', 0.9, 0.1);
      // Металлический «лязг»
      beep(1800, 0.08, 'square', 0.7, 0.15);
      beep(2200, 0.06, 'square', 0.6, 0.22);
      // Финальный отголосок
      beep(300, 0.4, 'triangle', 0.5, 0.35);
      beep(150, 0.5, 'triangle', 0.4, 0.5);
    },
    rankUp(level) {
      init();
      const base = 400 + level * 120;
      beep(base,       0.08, 'square', 0.7);
      beep(base * 1.4, 0.08, 'square', 0.8, 0.06);
      beep(base * 1.8, 0.12, 'triangle', 0.9, 0.12);
      if (level >= 4) beep(base * 2.2, 0.15, 'triangle', 0.8, 0.2);
      if (level >= 6) beep(base * 2.6, 0.2, 'triangle', 1.0, 0.3);
    },
    gameOver() {
      init();
      beep(220, 0.15, 'square', 0.8);
      beep(160, 0.15, 'square', 0.8, 0.15);
      beep(110, 0.4, 'square', 0.9, 0.3);
    },
    record() {
      init();
      [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.12, 'triangle', 0.7, i * 0.1));
    },
    setSfx(v) { sfxVolume = v; },
    getSfx()  { return sfxVolume; }
  };
})();