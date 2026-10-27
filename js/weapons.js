/* ==============================================================
   WEAPONS — Пули, Лазер, Ракеты
   ============================================================== */
const Weapons = (() => {
  let bullets = [];
  let enemyBullets = [];
  let reflectedSwords = [];
  let laserBeam = null;

  const ROCKET_BLAST_RADIUS = 50;
  const ROCKET_BLAST_DAMAGE = 6;

  function reset() {
    bullets = [];
    enemyBullets = [];
    reflectedSwords = [];
    laserBeam = null;
  }

  // Геттеры для доступа из Game
  return {
    get bullets() { return bullets; },
    get enemyBullets() { return enemyBullets; },
    get reflectedSwords() { return reflectedSwords; },
    get laserBeam() { return laserBeam; },
    set laserBeam(val) { laserBeam = val; },
    reset,
    ROCKET_BLAST_RADIUS,
    ROCKET_BLAST_DAMAGE
    // Сюда мы потом перенесем updateBullets и drawBullets
  };
})();