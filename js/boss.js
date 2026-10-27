/* ==============================================================
   BOSS — Вергилий (VL)
   ============================================================== */
const Boss = (() => {
  let boss = null;
  let bossNextTrigger = 50; // BOSS_SCORE_TRIGGER
  let bossIntroTime = 0;
  let bossQuotes = [];

  const BOSS_SCORE_REPEAT = 100;
  const BOSS_BASE_HP = 30;
  const BOSS_HP_STEP = 15;

  function reset() {
    boss = null;
    bossNextTrigger = 50;
    bossIntroTime = 0;
    bossQuotes = [];
  }

  return {
    get data() { return boss; },
    get nextTrigger() { return bossNextTrigger; },
    get quotes() { return bossQuotes; },
    get introTime() { return bossIntroTime; },
    reset
    // Сюда переедет spawnBoss, updateBoss, drawVergil и т.д.
  };
})();