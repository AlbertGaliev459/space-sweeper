/* ==============================================================
   РАНГ СТИЛЯ — D → C → B → A → S → SS → SSS
   ============================================================== */
const StyleRank = (() => {
  const RANKS = [
    { name: 'D',   threshold: 0    },
    { name: 'C',   threshold: 30   },
    { name: 'B',   threshold: 80   },
    { name: 'A',   threshold: 150  },
    { name: 'S',   threshold: 240  },
    { name: 'SS',  threshold: 350  },
    { name: 'SSS', threshold: 480  }
  ];
  const DECAY_RATE = 12;
  const MAX_STYLE  = 600;
  const SCORE_MULTIPLIERS = [1, 1, 1.2, 1.5, 2, 2.5, 3];

  const state = {
    style: 0,
    rankIndex: 0,
    maxRankIndex: 0,
    decayTimer: 0,
    pulseTimer: 0
  };

  function getRankName()   { return RANKS[state.rankIndex].name; }
  function getMultiplier() { return SCORE_MULTIPLIERS[state.rankIndex]; }
  function getMaxRankName(){ return RANKS[state.maxRankIndex].name; }

  function addStyle(amount) {
    state.style = Math.min(MAX_STYLE, state.style + amount);
    state.decayTimer = 0;
    recalcRank();
    updateUI();
  }

  function loseStyle(amount) {
    state.style = Math.max(0, state.style - amount);
    recalcRank();
    updateUI();
  }

  function reset() {
    state.style = 0;
    state.rankIndex = 0;
    state.maxRankIndex = 0;
    state.decayTimer = 0;
    state.pulseTimer = 0;
    updateUI();
  }

  function recalcRank() {
    let newIndex = 0;
    for (let i = 0; i < RANKS.length; i++) {
      if (state.style >= RANKS[i].threshold) newIndex = i;
    }
    if (newIndex !== state.rankIndex) {
      const goingUp = newIndex > state.rankIndex;
      state.rankIndex = newIndex;
      if (goingUp) {
        Sound.rankUp(newIndex);
        state.pulseTimer = 0.3;
      }
      if (newIndex > state.maxRankIndex) state.maxRankIndex = newIndex;
    }
  }

  function breakCombo() {
    state.style = 0;
    state.rankIndex = 0;
    state.pulseTimer = 0;
    updateUI();
  }

  function update(dt) {
    state.decayTimer += dt;
    if (state.decayTimer > 0.6 && state.style > 0) {
      state.style = Math.max(0, state.style - DECAY_RATE * dt);
      recalcRank();
      updateUI();
    }
    if (state.pulseTimer > 0) {
      state.pulseTimer -= dt;
      if (state.pulseTimer <= 0) {
        const el = document.getElementById('styleRankLetter');
        if (el) el.classList.remove('pulse');
      }
    }
  }

  function updateUI() {
    const hud    = document.getElementById('styleRankHud');
    const letter = document.getElementById('styleRankLetter');
    const bar    = document.getElementById('styleRankBar');
    const combo  = document.getElementById('styleCombo');
    if (!hud || !letter || !bar || !combo) return;

    hud.className = 'style-rank-hud rank-' + getRankName();
    letter.textContent = getRankName();
    if (state.pulseTimer > 0) letter.classList.add('pulse');

    const cur = RANKS[state.rankIndex].threshold;
    const next = state.rankIndex < RANKS.length - 1
      ? RANKS[state.rankIndex + 1].threshold
      : MAX_STYLE;
    const span = next - cur;
    const pct = span > 0 ? Math.min(1, (state.style - cur) / span) : 1;
    bar.style.width = (pct * 100) + '%';
    combo.textContent = '×' + Math.round(state.style);
  }

  return {
    addStyle, loseStyle, reset, breakCombo, update,
    getMultiplier, getRankName, getMaxRankName
  };
})();