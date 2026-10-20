/* ==============================================================
   STYLE: GUNSLINGER — арсенал из 4 пушек
   ============================================================== */
const StyleGunslinger = {
  id: 'gunslinger',
  meta: {
    name: 'Gunslinger',
    key: 'C',
    color: '#ffd600',
    description: 'Арсенал пушек (1-4)',
    implemented: true
  },

  state: {
    activeGun: 1,
    laserTimer: 0
  },

  GUNS: {
    1: { name: 'Пистолет', cooldown: 0.18, damage: 1, spread: 0.05, count: 1, speed: 9,  r: 3, color: '#ffeb3b', sound: 'shoot' },
    2: { name: 'Дробовик', cooldown: 0.65, damage: 1, spread: 0.45, count: 5, speed: 8,  r: 4, color: '#ff9800', sound: 'shoot' },
    3: { name: 'Ракетница',cooldown: 1.10, damage: 6, spread: 0.02, count: 1, speed: 7,  r: 7, color: '#ff3344', sound: 'bossHit' },
    4: { name: 'Лазер',    cooldown: 0.10, damage: 0.4,spread: 0,   count: 1, speed: 15, r: 2, color: '#7fdcff', sound: 'shoot' }
  },

  onActivate() {},
  onDeactivate() {
    this.state.activeGun = 1;   // сброс на пистолет при выходе
    this.state.laserTimer = 0;
  },
  onTick(dt) {
    if (this.state.laserTimer > 0) this.state.laserTimer -= dt;
  },

  // В Gunslinger мы перехватываем стрельбу — возвращаем false (Game не стреляет базово)
  onShoot() { return false; },

  onSwordSwing() {},
  onDash() { return false; },  // рывок не относится к Gunslinger

  /* --- Переключение оружия --- */
  switchGun(gunId) {
    if (!this.GUNS[gunId]) return;
    this.state.activeGun = gunId;
    this.state.laserTimer = 0;
    if (typeof StyleSwitching !== 'undefined' && StyleSwitching.refreshGunUI) {
      StyleSwitching.refreshGunUI();
    }
  },
  getActiveGun() { return this.state.activeGun; },
  getGunConfig() { return this.GUNS[this.state.activeGun]; },
  setLaserTimer(t) { this.state.laserTimer = t; },
  getLaserTimer() { return this.state.laserTimer; }
};