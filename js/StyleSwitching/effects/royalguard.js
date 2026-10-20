/* ==============================================================
   STYLE: ROYAL GUARD — заглушка (этап 4)
   ============================================================== */
const StyleRoyalguard = {
  id: 'royalguard',
  meta: {
    name: 'Royal Guard',
    key: 'V',
    color: '#4aa3ff',
    description: 'Блок · энергия · контратака',
    implemented: false
  },
  onActivate() {}, onDeactivate() {}, onTick(dt) {},
  onShoot() { return true; }, onSwordSwing() {}, onDash() { return false; }
};