/* ==============================================================
   ХРАНИЛИЩЕ — localStorage
   ============================================================== */
const Storage = {
  KEY_SCORES: 'spaceSweeper.scores',
  KEY_SETTINGS: 'spaceSweeper.settings',

  getScores() {
    try { return JSON.parse(localStorage.getItem(this.KEY_SCORES)) || []; }
    catch (e) { return []; }
  },
  addScore(score) {
    const list = this.getScores();
    list.push({ score, date: new Date().toLocaleDateString('ru-RU') });
    list.sort((a, b) => b.score - a.score);
    localStorage.setItem(this.KEY_SCORES, JSON.stringify(list.slice(0, 10)));
  },
  clearScores() { localStorage.removeItem(this.KEY_SCORES); },
  getHighScore() {
    const list = this.getScores();
    return list.length ? list[0].score : 0;
  },
  getSettings() {
    try { return JSON.parse(localStorage.getItem(this.KEY_SETTINGS)) || { music: 0.6, sfx: 0.8 }; }
    catch (e) { return { music: 0.6, sfx: 0.8 }; }
  },
  saveSettings(s) {
    localStorage.setItem(this.KEY_SETTINGS, JSON.stringify(s));
  }
};