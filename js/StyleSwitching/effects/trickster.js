/* ==============================================================
   STYLE: TRICKSTER — рывок с неуязвимостью
   ============================================================== */
const StyleTrickster = {
  id: 'trickster',
  meta: {
    name: 'Trickster',
    key: 'Z',
    color: '#7fdcff',
    description: 'Двойной рывок · неуязвимость',
    implemented: true
  },

  state: {
    dashCooldown: 0,
    get distance()    { return (typeof Config !== 'undefined' && Config.dash) ? Config.dash.distance        : 150; },
    get cooldownMax() { return (typeof Config !== 'undefined' && Config.dash) ? Config.dash.cooldown        : 1.5; },
    get invulnTime()  { return (typeof Config !== 'undefined' && Config.dash) ? Config.dash.invulnerability : 0.4; }
  },

  onActivate() {},
  onDeactivate() {},
  onTick(dt) {
    if (this.state.dashCooldown > 0) this.state.dashCooldown -= dt;
  },
  onShoot()     { return true; },  // не блокирует стрельбу
  onSwordSwing() {},

  onDash() {
    if (this.state.dashCooldown > 0) return false;
    this.state.dashCooldown = this.state.cooldownMax;
    return true;
  },

  getDashCooldown() { return this.state.dashCooldown; },
  getDashCooldownMax() { return this.state.cooldownMax; },
  getDashDistance() { return this.state.distance; },
  getDashInvulnTime() { return this.state.invulnTime; }
};