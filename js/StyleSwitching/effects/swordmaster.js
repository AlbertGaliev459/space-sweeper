/* ==============================================================
   STYLE: SWORDMASTER — заглушка (этап 5)
   ============================================================== */
const StyleSwordmaster = {
  id: 'swordmaster',
  meta: {
    name: 'Swordmaster',
    key: 'X',
    color: '#ff3344',
    description: 'Меч · Stinger',
    implemented: false
  },
  onActivate() {}, onDeactivate() {}, onTick(dt) {},
  onShoot() { return true; }, onSwordSwing() {}, onDash() { return false; }
};