/* ==============================================================
   STYLE EFFECTS — ДИСПЕТЧЕР
   Просто передаёт вызовы нужному стилю (Trickster/Gunslinger/...).
   Сами эффекты — в папке styles/.
   ============================================================== */
const StyleEffects = (() => {
  // Все доступные стили
  const STYLES = {
    trickster:   () => StyleTrickster,
    swordmaster: () => StyleSwordmaster,
    gunslinger:  () => StyleGunslinger,
    royalguard:  () => StyleRoyalguard
  };

  let currentStyleId = 'gunslinger';

  function current() {
    const getter = STYLES[currentStyleId];
    return getter ? getter() : null;
  }

  function setCurrentStyle(id) {
    currentStyleId = id;
  }

  function getCurrentStyle() { return currentStyleId; }

  /* --- Метаданные для HUD --- */
  function getMetadata() {
    const meta = {};
    for (const id in STYLES) {
      const style = STYLES[id]();
      if (style && style.meta) meta[id] = style.meta;
    }
    return meta;
  }

  /* --- Хуки --- */
  function onActivate(styleId) {
    const style = STYLES[styleId] ? STYLES[styleId]() : null;
    if (style && style.onActivate) style.onActivate();
  }

  function onDeactivate(styleId) {
    const style = STYLES[styleId] ? STYLES[styleId]() : null;
    if (style && style.onDeactivate) style.onDeactivate();
  }

  function onTick(dt, gameState) {
    const style = current();
    if (style && style.onTick) style.onTick(dt, gameState);
  }

  function onShoot() {
    const style = current();
    if (style && style.onShoot) return style.onShoot();
    return true;
  }

  function onSwordSwing() {
    const style = current();
    if (style && style.onSwordSwing) style.onSwordSwing();
  }

  function onDash() {
    const style = current();
    if (style && style.onDash) return style.onDash();
    return false;
  }

  /* --- Делегируем вызовы текущему стилю --- */
  // (Стиль сам решит, отвечать или нет — через проверку id или внутреннее состояние)
  function getDashCooldown()      { const s = STYLES.trickster(); return s ? s.getDashCooldown() : 0; }
  function getDashCooldownMax()   { const s = STYLES.trickster(); return s ? s.getDashCooldownMax() : 0; }
  function getDashDistance()      { const s = STYLES.trickster(); return s ? s.getDashDistance() : 0; }
  function getDashInvulnTime()    { const s = STYLES.trickster(); return s ? s.getDashInvulnTime() : 0; }

  function switchGun(gunId)       { const s = STYLES.gunslinger(); if (s) s.switchGun(gunId); }
  function getActiveGun()         { const s = STYLES.gunslinger(); return s ? s.getActiveGun() : 1; }
  function getGunConfig()         { const s = STYLES.gunslinger(); return s ? s.getGunConfig() : null; }
  function setLaserTimer(t)       { const s = STYLES.gunslinger(); if (s) s.setLaserTimer(t); }
  function getLaserTimer()        { const s = STYLES.gunslinger(); return s ? s.getLaserTimer() : 0; }

  return {
    get metadata() { return getMetadata(); },
    setCurrentStyle,
    getCurrentStyle,
    onActivate, onDeactivate, onTick, onShoot, onSwordSwing, onDash,
    // Trickster
    getDashCooldown, getDashCooldownMax, getDashDistance, getDashInvulnTime,
    // Gunslinger
    switchGun, getActiveGun, getGunConfig, setLaserTimer, getLaserTimer
  };
})();