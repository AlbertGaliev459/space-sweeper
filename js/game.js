/* ==============================================================
   ИГРА — Canvas + requestAnimationFrame
   ============================================================== */
const Game = (() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const W = 800;
  const H = 450;

  const PLAYER_DEFAULTS = {
    x: W * 0.25, y: H / 2, r: 14,
    vx: 0, vy: 0,
    maxSpeed: 4.5, accel: 24, friction: 0.9, tilt: 0
  };

  const BULLET_SPEED = 9;
  const BULLET_COOLDOWN = 0.18;
  const BULLET_RADIUS = 3;

  const BOSS_SCORE_TRIGGER = 50;
  const BOSS_SCORE_REPEAT  = 100;
  const BOSS_BASE_HP       = 30;
  const BOSS_HP_STEP       = 15;

  const SWORD_RADIUS           = 55;
  const SWORD_DURATION         = 0.22;
  const SWORD_COOLDOWN         = 0.9;
  const SWORD_VULNERABLE       = 0.35;
  const REFLECT_DAMAGE         = 1;
  const REFLECT_DAMAGE_PERFECT = 2;

  const ROCKET_BLAST_RADIUS = 50;   // радиус AoE-взрыва
  const ROCKET_BLAST_DAMAGE = 6;    // урон всем в радиусе (включая цель)

  let player = { ...PLAYER_DEFAULTS };
  let objects = [];
  let particles = [];
  let engineParticles = [];
  let bullets = [];
  let enemyBullets = [];
  let reflectedSwords = [];
  let boss = null;
  let bossNextTrigger = BOSS_SCORE_TRIGGER;

  let swordActive = false;
  let swordSwingTimer = 0;
  let swordCooldown = 0;
  let swordVulnerable = 0;
  let swordSwingAngle = 0;
  let swordSwingStart = 0;
  let swordFlashAlpha = 0;
  let parryPulse = 0;
  let swordSwingStartTime = 0;

  let bossIntroTime = 0;
  let bossQuotes = [];

  let score = 0;
  let lives = 3;
  let spawnTimer = 0;
  let spawnInterval = 60;
  let bulletCooldown = 0;
  let lastTime = 0;
  let rafId = null;
  let shieldTime = 0, magnetTime = 0, x2Time = 0;

  let running = false;
  let gameOver = false;

  
  let dashInvulnerable = 0;     
  let dashTrail = [];          
  let dashVisualTimer = 0;      
  
  let laserBeam = null;

  // Публичные ссылки на состояние, которые использует UI
  const publicState = {
    get running()   { return running; },
    get gameOver()  { return gameOver; },
    get swordActive()   { return swordActive; },
    get swordSwingTimer(){ return swordSwingTimer; },
    get swordCooldown() { return swordCooldown; },
    get swordVulnerable(){ return swordVulnerable; },
    get shieldTime() { return shieldTime; },
    get magnetTime() { return magnetTime; },
    get x2Time()     { return x2Time; },
    SWORD_COOLDOWN,
    SWORD_VULNERABLE
  };

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(
      (dpr * rect.width)  / W, 0,
      0, (dpr * rect.height) / H,
      0, 0
    );
  }

  function getAsteroidMaxHp() {
  // HP зависит от сложности: чем дальше играешь — тем крепче
  // Базово 2 HP; каждые 100 очков +1; потолок 8
  return Math.min(8, 2 + Math.floor(score / 100));
}

function spawnObject() {
  const roll = Math.random();
  let type = 'trash';
  if (roll < 0.55)      type = 'trash';
  else if (roll < 0.85) type = 'asteroid';
  else                  type = 'bonus';

  const bonusKind = type === 'bonus'
    ? ['shield', 'magnet', 'x2'][Math.floor(Math.random() * 3)]
    : null;

  const obj = {
    x: W + 30,
    y: 40 + Math.random() * (H - 80),
    r: type === 'asteroid' ? 18 : 12,
    type, bonusKind,
    speed: 1.5 + Math.random() * 1.5 + score * 0.02,
    missed: false
  };

  // Астероиды получают HP
  if (type === 'asteroid') {
    obj.maxHp = getAsteroidMaxHp();
    obj.hp = obj.maxHp;
    obj.hitFlash = 0;   // вспышка при попадании
  }

  objects.push(obj);
}

  function spawnBoss() {
    const bossIndex = Math.floor((score - BOSS_SCORE_TRIGGER) / BOSS_SCORE_REPEAT);
    const hp = BOSS_BASE_HP + bossIndex * BOSS_HP_STEP;

    boss = {
      x: W + 80, y: H / 2, r: 45,
      hp, maxHp: hp, vx: -1.5, targetX: W - 130,
      entering: true, bobTime: 0, phase: 1,
      stateTimer: 0, state: 'idle', shootTimer: 1.0,
      teleportAlpha: 1, slashActive: false, slashDir: 0,
      flashAlpha: 0, dying: false, deathTimer: 1.5,
      punishTimer: 0, punishActive: false,
      phaseTransition: 0,          // таймер анимации (0 = нет перехода)
      phaseTransitionMax: 0.6,     // сколько длится неуязвимость и вспышка
      invulnerable: false,         // флаг неуязвимости
      transitionLabel: '',         // текст «PHASE II»
      transitionAlpha: 0           // прозрачность текста
    };
    bossNextTrigger = score + BOSS_SCORE_REPEAT;

    bossIntroTime = 2.0;
    bossQuotes.push({
      text: 'You are not worthy as my opponent',
      life: 2.2, color: '#7fdcff'
    });

    Sound.vergilAppear();

    swordActive = true;
    swordSwingTimer = 0; swordCooldown = 0; swordVulnerable = 0;
    swordFlashAlpha = 0.8;
    Sound.swordSummon();
    emitParticles(player.x, player.y, '#ff3344', 20, 1.5);
    emitParticles(player.x, player.y, '#ffffff', 12, 1.8);

    bossQuotes.push({ text: 'DE-1 · REBELLION', life: 1.5, color: '#ff3344' });

    document.getElementById('parryBtn').classList.add('visible');
  }

    /* --- Ракетница: взрыв + AoE-урон --- */
  function spawnExplosion(x, y) {
    emitParticles(x, y, '#ffaa00', 18, 2);
    emitParticles(x, y, '#ff3344', 12, 1.8);
    emitParticles(x, y, '#ffffff', 10, 2.2);
    emitParticles(x, y, '#7fdcff', 6, 1.5);
    Sound.bossHit();
  }

  function applyRocketBlast(x, y) {
    const radius = ROCKET_BLAST_RADIUS;
    const dmg = ROCKET_BLAST_DAMAGE;

    // Босс — если в радиусе
    if (boss && !boss.dying && !boss.entering && !boss.invulnerable) {
      const d = Math.hypot(boss.x - x, boss.y - y);
      if (d < radius + boss.r) {
        boss.hp -= dmg;
        boss.flashAlpha = 0.5;
        emitParticles(boss.x, boss.y, '#ffaa00', 10, 1.5);
        StyleRank.addStyle(10);
        if (boss.hp <= 0) triggerBossDeath();
      }
    }

    // Астероиды/мусор в радиусе
    for (let j = objects.length - 1; j >= 0; j--) {
      const o = objects[j];
      const d = Math.hypot(o.x - x, o.y - y);
      if (d > radius + o.r) continue;

      if (o.type === 'asteroid') {
        o.hp -= dmg;
        o.hitFlash = 0.15;
        emitParticles(o.x, o.y, '#e53935', 6, 1.2);
        if (o.hp <= 0) {
          emitParticles(o.x, o.y, '#ffaa00', 10, 1.5);
          objects.splice(j, 1);
          score += 1;
          document.getElementById('score').textContent = score;
          Sound.pickup();
          StyleRank.addStyle(10);
        }
      } else if (o.type === 'trash') {
        emitParticles(o.x, o.y, '#7df07d', 8);
        objects.splice(j, 1);
        score += 1;
        document.getElementById('score').textContent = score;
        StyleRank.addStyle(10);
      }
    }
  }

  function emitParticles(x, y, color, count = 8, speedMul = 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (1 + Math.random() * 3) * speedMul;
      particles.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 1, color
      });
    }
  }

  function emitEngineParticle() {
    const back = -player.r * 0.9;
    const cosT = Math.cos(player.tilt);
    const sinT = Math.sin(player.tilt);
    const px = player.x + back * cosT;
    const py = player.y + back * sinT;
    engineParticles.push({
      x: px, y: py,
      vx: -player.vx * 0.3 + (Math.random() - 0.5) * 0.8,
      vy: -player.vy * 0.3 + (Math.random() - 0.5) * 0.8,
      life: 1, size: 2 + Math.random() * 2
    });
  }

      function shoot() {
    if (bulletCooldown > 0) return;
    if (boss && boss.dying) return;
    if (boss && boss.entering) return;
    if (swordActive) return;

    // === ЛОГИКА GUNSLINGER ===
    const inGunslinger = typeof StyleSwitching !== 'undefined' && StyleSwitching.getCurrentStyle() === 'gunslinger';

    if (inGunslinger && typeof StyleEffects !== 'undefined') {
      const gunId = StyleEffects.getActiveGun();
      const gun = StyleEffects.getGunConfig();
      
      // --- ЛАЗЕР (Оружие 4) ---
      if (gunId === 4) {
        // Если кнопка не зажата — выключаем луч
        if (!keys['Space'] && !keys['MouseLeft']) {
          laserBeam = null;
          return;
        }

        // Создаем/обновляем луч (x1, y1 — прямо из носа корабля)
        laserBeam = {
          x1: player.x + player.r,
          y1: player.y
        };

        const y1 = laserBeam.y1;
        
        // Урон боссу
        if (boss && !boss.dying && !boss.entering && !boss.invulnerable) {
          if (boss.x > laserBeam.x1 && Math.abs(boss.y - y1) < boss.r + 10) {
             boss.hp -= 0.2; // Урон за кадр (лазер мощный)
             boss.flashAlpha = 0.3;
             if (Math.random() < 0.2) Sound.bossHit();
             if (boss.hp <= 0) triggerBossDeath();
          }
        }

        // Урон астероидам и мусору
        for (let j = objects.length - 1; j >= 0; j--) {
          const o = objects[j];
          if (o.x > laserBeam.x1 && Math.abs(o.y - y1) < o.r + 10) {
            if (o.type === 'asteroid') {
              o.hp -= 0.1; // Плавит
              o.hitFlash = 0.1;
              if (o.hp <= 0) {
                emitParticles(o.x, o.y, '#e53935', 14, 1.2);
                objects.splice(j, 1);
                score += 1;
                document.getElementById('score').textContent = score;
                Sound.pickup();
                StyleRank.addStyle(10);
              }
            } else if (o.type === 'trash') {
              score += 1;
              document.getElementById('score').textContent = score;
              emitParticles(o.x, o.y, '#7df07d', 10);
              objects.splice(j, 1);
              StyleRank.addStyle(15);
            }
          }
        }
        
        // Кулдаун для лазера, чтобы он не наносил урон 1000 раз в секунду (а раз в 0.1 сек)
        bulletCooldown = 0.1; 
        return;
      }

      // --- ОСТАЛЬНЫЕ ПУШКИ (1, 2, 3) ---
      bulletCooldown = gun.cooldown;

      const cosT = Math.cos(player.tilt);
      const sinT = Math.sin(player.tilt);
      const bx = player.x + player.r * cosT;
      const by = player.y + player.r * sinT;

      for (let i = 0; i < gun.count; i++) {
        const spread = (Math.random() - 0.5) * gun.spread;
        const angle = player.tilt + spread;
        
        bullets.push({
          x: bx, y: by,
          vx: Math.cos(angle) * gun.speed,
          vy: Math.sin(angle) * gun.speed,
          life: gunId === 3 ? 3 : 1.5,
          r: gun.r,
          damage: gun.damage,
          color: gun.color,
          isRocket: gunId === 3
        });
      }
      Sound.shoot();
      return; 
    }

    // === БАЗОВАЯ СТРЕЛЬБА (Если не Gunslinger) ===
    bulletCooldown = BULLET_COOLDOWN;
    const cosT = Math.cos(player.tilt);
    const sinT = Math.sin(player.tilt);
    const bx = player.x + player.r * cosT;
    const by = player.y + player.r * sinT;
    const spread = (Math.random() - 0.5) * 0.15;
    const angle = player.tilt + spread;

    bullets.push({
      x: bx, y: by,
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      life: 1.5, r: BULLET_RADIUS,
      damage: 1, color: '#ffeb3b'
    });
    Sound.shoot();
  }

  function swingSword() {
    if (!swordActive) return;
    if (swordCooldown > 0) return;
    if (swordVulnerable > 0) return;
    if (swordSwingTimer > 0) return;

    swordSwingTimer    = SWORD_DURATION;
    swordCooldown      = SWORD_COOLDOWN;
    swordSwingStart    = Math.random() * Math.PI * 2;
    swordSwingStartTime = performance.now();
    swordFlashAlpha    = 0.6;
  }
  /* ------------------------------------------------------------
     РЫВОК — Trickster
     Пытается сделать рывок. Работает только если активен стиль Trickster.
     Возвращает true, если рывок удался.
     ------------------------------------------------------------ */
  function tryDash() {
    // Проверяем через StyleEffects — он знает про активный стиль и кулдаун
    if (typeof StyleEffects === 'undefined') return false;
    if (typeof StyleSwitching === 'undefined') return false;

    const canDash = StyleEffects.onDash();
    if (!canDash) return false;

    // Направление — по текущему вводу
    let dx = 0, dy = 0;
    if (keys['ArrowLeft']  || keys['KeyA']) dx -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
    if (keys['ArrowUp']    || keys['KeyW']) dy -= 1;
    if (keys['ArrowDown']  || keys['KeyS']) dy += 1;

    if (Joystick.state.active) {
      dx = Joystick.state.dx;
      dy = Joystick.state.dy;
    }

    // Если ничего не зажато — рывок вправо (по направлению носа)
    if (!dx && !dy) { dx = 1; dy = 0; }

    // Нормализуем
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;

    const distance = StyleEffects.getDashDistance();
    const targetX = player.x + dx * distance;
    const targetY = player.y + dy * distance;

    // Не выходим за границы
    const nx = Math.max(player.r, Math.min(W - player.r, targetX));
    const ny = Math.max(player.r, Math.min(H - player.r, targetY));

    // Шлейф — от текущей позиции к новой
    const STEPS = 8;
    for (let i = 0; i < STEPS; i++) {
      const t = i / STEPS;
      dashTrail.push({
        x: player.x + (nx - player.x) * t,
        y: player.y + (ny - player.y) * t,
        life: 1
      });
    }

    // Мгновенно перемещаемся
    player.x = nx;
    player.y = ny;

    // Обнуляем скорость — чтобы не «вылететь» дальше
    player.vx *= 0.2;
    player.vy *= 0.2;

    // Неуязвимость
    dashInvulnerable = StyleEffects.getDashInvulnTime();
    dashVisualTimer = dashInvulnerable;

    // Визуал — искры
    emitParticles(player.x, player.y, '#7fdcff', 12, 1.5);
    emitParticles(player.x, player.y, '#ffffff', 6, 1.8);

    // Звук
    if (typeof Sound !== 'undefined' && Sound.click) {
      // В будущем — отдельный Sound.dash()
      Sound.click();
    }

    return true;
  }
  function updateSword(dt) {
    if (swordCooldown > 0) swordCooldown -= dt;
    if (swordFlashAlpha > 0) swordFlashAlpha -= dt * 3;
    if (parryPulse > 0) parryPulse -= dt * 2;
    if (swordVulnerable > 0) swordVulnerable -= dt;

    if (swordSwingTimer > 0) {
      swordSwingTimer -= dt;
      const progress = 1 - (swordSwingTimer / SWORD_DURATION);
      swordSwingAngle = swordSwingStart + progress * Math.PI * 2;

      if (!boss) { swordSwingTimer = 0; return; }

      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        const dist = Math.hypot(b.x - player.x, b.y - player.y);
        if (dist < SWORD_RADIUS + b.r) {
          const swingElapsed = (performance.now() - swordSwingStartTime) / 1000;
          const isPerfect = swingElapsed < 0.1;
          const angleToBoss = Math.atan2(boss.y - player.y, boss.x - player.x);
          const spread = (Math.random() - 0.5) * 0.2;

          reflectedSwords.push({
            x: b.x, y: b.y,
            vx: Math.cos(angleToBoss + spread) * 8.5,
            vy: Math.sin(angleToBoss + spread) * 8.5,
            life: 3, r: 6, angle: angleToBoss, spin: 0.4,
            damage: isPerfect ? REFLECT_DAMAGE_PERFECT : REFLECT_DAMAGE,
            perfect: isPerfect
          });

          emitParticles(b.x, b.y, isPerfect ? '#ffeb3b' : '#cceaff', 12, 1.5);
          emitParticles(b.x, b.y, '#ffffff', 8, 1.8);
          Sound.parry();
          Sound.parrySuccess();

          parryPulse = 1;
          swordFlashAlpha = 1;

          if (isPerfect) {
            StyleRank.addStyle(60);
            bossQuotes.push({ text: 'PERFECT PARRY!', life: 0.8, color: '#ffeb3b' });
          } else {
            StyleRank.addStyle(35);
          }
          enemyBullets.splice(i, 1);
        }
      }
      if (swordSwingTimer <= 0) swordVulnerable = SWORD_VULNERABLE;
    }
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx; b.y += b.vy; b.life -= dt;
      if (b.life <= 0 || b.x > W + 20 || b.x < -20 || b.y < -20 || b.y > H + 20) {
        bullets.splice(i, 1); continue;
      }
            if (boss && !boss.dying && !boss.entering) {
        const d = Math.hypot(boss.x - b.x, boss.y - b.y);
        if (d < boss.r + b.r) {
          if (boss.invulnerable) {
            // Пуля врезается, но не наносит урона — только искры
            emitParticles(b.x, b.y, '#ffffff', 6, 0.8);
            Sound.bossHit();
            bullets.splice(i, 1);
            continue;
          }
          boss.hp-= (b.damage||1); Sound.bossHit(); boss.flashAlpha = 0.3;
          emitParticles(b.x, b.y, '#7fdcff', 8, 0.7);
          bullets.splice(i, 1);
          StyleRank.addStyle(8);
          if (boss.hp <= 0) triggerBossDeath();
          if (b.isRocket) {
            spawnExplosion(b.x, b.y);
            applyRocketBlast(b.x, b.y, b);
          }
          continue;
        }
      }
            for (let j = objects.length - 1; j >= 0; j--) {
        const o = objects[j];
        const d = Math.hypot(o.x - b.x, o.y - b.y);
        if (d < o.r + b.r) {
          if (o.type === 'asteroid') {
            // Астероид получает урон (ракета бьёт сильно)
            o.hp -= (b.damage || 1);
            o.hitFlash = 0.15;
            emitParticles(b.x, b.y, o.hp > 0 ? '#e53935' : '#ff8a00', o.hp > 0 ? 6 : 14);
            bullets.splice(i, 1);

            if (o.hp <= 0) {
              emitParticles(o.x, o.y, '#e53935', 14, 1.2);
              emitParticles(o.x, o.y, '#ffaa00', 8, 1.5);
              objects.splice(j, 1);
              score += 1;
              document.getElementById('score').textContent = score;
              Sound.pickup();
              StyleRank.addStyle(10);
            } else {
              Sound.bossHit();
            }
          } else if (o.type === 'trash') {
            // Мусор — пуля/ракета уничтожает
            score += 1;
            document.getElementById('score').textContent = score;
            emitParticles(o.x, o.y, '#7df07d', 10);
            objects.splice(j, 1);
            StyleRank.addStyle(15);
            bullets.splice(i, 1);
          }

          // === AoE-взрыв ракеты ===
          if (b.isRocket) {
            spawnExplosion(b.x, b.y);
            applyRocketBlast(b.x, b.y, b);
          }
          break;
        }
      }
    }

    for (let i = reflectedSwords.length - 1; i >= 0; i--) {
      const r = reflectedSwords[i];
      r.x += r.vx; r.y += r.vy; r.life -= dt;
      if (r.spin) r.angle += r.spin;

      if (Math.random() < 0.5) {
        particles.push({
          x: r.x, y: r.y,
          vx: -r.vx * 0.05, vy: -r.vy * 0.05,
          life: 0.5, color: r.perfect ? '#ffeb3b' : '#ff3344'
        });
      }
      if (r.life <= 0 || r.x < -30 || r.x > W + 30 || r.y < -30 || r.y > H + 30) {
        reflectedSwords.splice(i, 1); continue;
      }
            if (boss && !boss.dying && !boss.entering) {
        const d = Math.hypot(boss.x - r.x, boss.y - r.y);
        if (d < boss.r + r.r) {
          if (boss.invulnerable) {
            // Отражённый меч врезается и гаснет
            emitParticles(r.x, r.y, '#ffffff', 10, 1);
            Sound.bossHit();
            reflectedSwords.splice(i, 1);
            continue;
          }
          boss.hp -= r.damage;
          Sound.bossHit(); boss.flashAlpha = 0.5;
          emitParticles(r.x, r.y, r.perfect ? '#ffeb3b' : '#ff3344', 14, 1.3);
          reflectedSwords.splice(i, 1);
          StyleRank.addStyle(r.perfect ? 20 : 12);
          if (boss.hp <= 0) triggerBossDeath();
          continue;
        }
      }
    }
  }

  function triggerBossDeath() {
    if (!boss) return;
    boss.dying = true; boss.deathTimer = 1.5;
    Sound.vergilDeath();
    emitParticles(boss.x, boss.y, '#7fdcff', 40, 2);
    emitParticles(boss.x, boss.y, '#ffffff', 30, 2.5);
    const bonus = Math.round(25 * StyleRank.getMultiplier());
    score += bonus;
    document.getElementById('score').textContent = score;
    StyleRank.addStyle(200);
  }

  function spawnBlueSword(x, y, angle, speed = 4.5) {
    enemyBullets.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 4, r: 6, type: 'vergilSword',
      angle, spin: 0.15
    });
  }

  function performSpiralSwords() {
    if (!boss) return;
    const angleToPlayer = Math.atan2(player.y - boss.y, player.x - boss.x);
    for (let k = -2; k <= 2; k++) {
      spawnBlueSword(boss.x - boss.r * 0.3, boss.y, angleToPlayer + k * 0.22, 4.5);
    }
    Sound.vergilSlash();
  }

  function performJudgementCut() {
    if (!boss) return;
    const nx = Math.max(80, Math.min(W - 80, player.x + (Math.random() > 0.5 ? 120 : -120)));
    const ny = Math.max(60, Math.min(H - 60, player.y + (Math.random() - 0.5) * 100));
    emitParticles(boss.x, boss.y, '#7fdcff', 20, 1.5);
    Sound.vergilTeleport();

    boss.x = nx; boss.y = ny; boss.teleportAlpha = 0;

    setTimeout(() => {
      if (!boss || boss.dying) return;
      for (let k = 0; k < 8; k++) {
        spawnBlueSword(boss.x, boss.y, (Math.PI * 2 / 8) * k, 3.5);
      }
      Sound.vergilJudgement();
      emitParticles(boss.x, boss.y, '#7fdcff', 15, 1.2);
    }, 120);
  }

  function performRapidSlash() {
    if (!boss) return;
    boss.slashActive = true;
    boss.slashDir = Math.random() > 0.5 ? 1 : -1;
    Sound.vergilSlash();
    emitParticles(boss.x, boss.y, '#7fdcff', 20, 1.5);
    for (let k = -1; k <= 1; k++) {
      spawnBlueSword(
        boss.x, boss.y,
        boss.slashDir > 0 ? k * 0.3 : Math.PI + k * 0.3,
        5.5
      );
    }
    setTimeout(() => { if (boss) boss.slashActive = false; }, 250);
  }

  function performPunish() {
    if (!boss) return;
    const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
    for (let k = -1; k <= 1; k++) {
      spawnBlueSword(boss.x, boss.y, angle + k * 0.12, 6.5);
    }
    Sound.vergilJudgement();
    bossQuotes.push({ text: 'Pathetic.', life: 1.2, color: '#7fdcff' });
  }

  function updateBoss(dt) {
    if (!boss) return;
    boss.bobTime += dt;

    if (boss.flashAlpha > 0) boss.flashAlpha -= dt * 2;
    if (boss.teleportAlpha < 1) {
      boss.teleportAlpha = Math.min(1, boss.teleportAlpha + dt * 6);
    }

    if (boss.entering) {
      boss.x += boss.vx;
      if (boss.x <= boss.targetX) {
        boss.x = boss.targetX;
        boss.entering = false;
        boss.state = 'idle';
        boss.stateTimer = 1.5;
      }
      return;
    }

    if (boss.dying) {
      boss.deathTimer -= dt;
      if (Math.random() < 0.6) {
        emitParticles(
          boss.x + (Math.random() - 0.5) * boss.r * 1.6,
          boss.y + (Math.random() - 0.5) * boss.r * 1.6,
          '#7fdcff', 3, 1.5
        );
      }
      if (boss.deathTimer <= 0) {
        emitParticles(boss.x, boss.y, '#ffffff', 25, 2);
        bossQuotes.push({
          text: "You can't handle this power",
          life: 2.5, color: '#7fdcff'
        });
        boss = null;
        swordActive = false;
        document.getElementById('parryBtn').classList.remove('visible');
      }
      return;
    }

        const hpPct = boss.hp / boss.maxHp;
    const newPhase = hpPct < 0.33 ? 3 : (hpPct < 0.66 ? 2 : 1);

    // === Обнаружение перехода фазы ===
    if (newPhase !== boss.phase && boss.phaseTransition <= 0) {
      boss.phase = newPhase;
      boss.phaseTransition = boss.phaseTransitionMax;
      boss.invulnerable = true;
      boss.transitionLabel =
        newPhase === 2 ? 'P H A S E   I I' :
        newPhase === 3 ? 'P H A S E   I I I' : '';
      boss.transitionAlpha = 1;

      // Рёв + визуал
      Sound.vergilPhaseRoar();
      emitParticles(boss.x, boss.y, '#7fdcff', 30, 2);
      emitParticles(boss.x, boss.y, '#ffffff', 20, 2.5);

      // Тряска: рисуем «вспышку» через quotes (переиспользуем систему реплик)
      bossQuotes.push({
        text: newPhase === 3 ? 'NOW YOU DIE' : 'NOT BAD',
        life: 1.0,
        color: '#ff3344'
      });
    }

    // === Обновление перехода ===
    if (boss.phaseTransition > 0) {
      boss.phaseTransition -= dt;
      boss.transitionAlpha = Math.max(0, boss.phaseTransition / boss.phaseTransitionMax);

      // Пульсирующая аура во время перехода
      if (Math.random() < 0.5) {
        emitParticles(
          boss.x + (Math.random() - 0.5) * boss.r * 1.5,
          boss.y + (Math.random() - 0.5) * boss.r * 1.5,
          Math.random() < 0.5 ? '#7fdcff' : '#ffffff',
          2, 1.5
        );
      }

      if (boss.phaseTransition <= 0) {
        boss.invulnerable = false;
        boss.transitionAlpha = 0;
        boss.transitionLabel = '';
      }
    }

    boss.y = H / 2 + Math.sin(boss.bobTime * 1.2) * 40;
    boss.stateTimer -= dt;

    if (swordCooldown > 0.2 && Math.random() < 0.02 && boss.state === 'idle') {
      performPunish();
      boss.shootTimer = 1.5;
    }

    boss.shootTimer -= dt;
    if (boss.state === 'idle' && boss.shootTimer <= 0 && boss.stateTimer > 0.4) {
      const angleToPlayer = Math.atan2(player.y - boss.y, player.x - boss.x);
      spawnBlueSword(boss.x - boss.r * 0.4, boss.y, angleToPlayer, 4);
      Sound.vergilSlash();
      boss.shootTimer = boss.phase === 3 ? 0.5 : boss.phase === 2 ? 0.7 : 1.0;
    }

    if (boss.stateTimer <= 0 && boss.state === 'idle') {
      const roll = Math.random();
      if (boss.phase === 1) {
        boss.state = roll < 0.6 ? 'spiral' : 'idle';
      } else if (boss.phase === 2) {
        boss.state = roll < 0.4 ? 'spiral' : roll < 0.75 ? 'slash' : 'idle';
      } else {
        boss.state = roll < 0.3 ? 'spiral'
                   : roll < 0.55 ? 'judgement'
                   : roll < 0.8  ? 'slash' : 'idle';
      }
      boss.stateTimer = boss.phase === 3 ? 1.2 : boss.phase === 2 ? 1.6 : 2.0;

      if (boss.state === 'spiral') {
        setTimeout(() => { if (boss && !boss.dying && boss.state === 'spiral') performSpiralSwords(); }, 200);
      } else if (boss.state === 'judgement') {
        setTimeout(() => { if (boss && !boss.dying && boss.state === 'judgement') performJudgementCut(); }, 200);
      } else if (boss.state === 'slash') {
        setTimeout(() => { if (!boss || boss.dying || boss.state !== 'slash') return; performRapidSlash(); }, 200);
      }
    }
    if (boss.stateTimer <= 0 && boss.state !== 'idle') {
      boss.state = 'idle';
      boss.stateTimer = boss.phase === 3 ? 0.8 : boss.phase === 2 ? 1.2 : 1.6;
    }
  }

  function updateEnemyBullets(dt) {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.x += b.vx; b.y += b.vy; b.life -= dt;
      if (b.spin) b.angle = (b.angle || 0) + b.spin;

      if (b.life <= 0 || b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) {
        enemyBullets.splice(i, 1); continue;
      }
            const d = Math.hypot(player.x - b.x, player.y - b.y);
      if (d < player.r + b.r) {
        if (dashInvulnerable > 0) {
          // Trickster-рывок: пуля пролетает сквозь, оставляя искры
          emitParticles(b.x, b.y, '#7fdcff', 8, 1.2);
        } else if (shieldTime > 0) {
          emitParticles(b.x, b.y, '#4aa3ff', 10);
        } else {
          lives--;
          Sound.hit();
          emitParticles(player.x, player.y, '#ff5555', 20);
          updateLivesUI();
          triggerDamageFlash();
          StyleRank.breakCombo();
          if (lives <= 0) { endGame(); return; }
        }
        enemyBullets.splice(i, 1);
      }
    }
  }

  function triggerDamageFlash() {
    const el = document.getElementById('damageFlash');
    if (!el) return;
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 120);
  }

  function updateBossQuotes(dt) {
    for (let i = bossQuotes.length - 1; i >= 0; i--) {
      bossQuotes[i].life -= dt;
      if (bossQuotes[i].life <= 0) bossQuotes.splice(i, 1);
    }
    if (bossIntroTime > 0) bossIntroTime -= dt;
  }

  function update(dt) {
    if (!running || gameOver) return;
    StyleRank.update(dt);

    let inputX = 0, inputY = 0;
    if (keys['ArrowLeft']  || keys['KeyA']) inputX -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) inputX += 1;
    if (keys['ArrowUp']    || keys['KeyW']) inputY -= 1;
    if (keys['ArrowDown']  || keys['KeyS']) inputY += 1;

    if (Joystick.state.active) {
      inputX = Joystick.state.dx;
      inputY = Joystick.state.dy;
    }
    const isDigital = Math.abs(inputX) === 1 && Math.abs(inputY) === 1;
    if (isDigital) { inputX *= 0.707; inputY *= 0.707; }

    if (inputX || inputY) {
      player.vx += inputX * player.accel * dt;
      player.vy += inputY * player.accel * dt;
    } else {
      player.vx *= player.friction;
      player.vy *= player.friction;
    }
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > player.maxSpeed) {
      const k = player.maxSpeed / speed;
      player.vx *= k; player.vy *= k;
    }
    if (Math.abs(player.vx) < 0.02) player.vx = 0;
    if (Math.abs(player.vy) < 0.02) player.vy = 0;

    player.x += player.vx; player.y += player.vy;
    player.x = Math.max(player.r, Math.min(W - player.r, player.x));
    player.y = Math.max(player.r, Math.min(H - player.r, player.y));
    if (player.x <= player.r || player.x >= W - player.r) player.vx = 0;
    if (player.y <= player.r || player.y >= H - player.r) player.vy = 0;

    const targetTilt = player.vy * 0.06;
    player.tilt += (targetTilt - player.tilt) * 0.15;

    const currentSpeed = Math.hypot(player.vx, player.vy);
    if (currentSpeed > 0.3) {
      const chance = Math.min(currentSpeed / player.maxSpeed, 1);
      if (Math.random() < chance * 0.7) {
        emitEngineParticle();
        if (Math.random() < 0.3) emitEngineParticle();
      }
    }

        if (bulletCooldown > 0) bulletCooldown -= dt;
            // Таймер лазера (если мы не стреляем — луч пропадает)
    if (laserBeam) {
      // Если мы больше не в Gunslinger или не жмем кнопку — убираем луч
      const inGunslinger = typeof StyleSwitching !== 'undefined' && StyleSwitching.getCurrentStyle() === 'gunslinger';
      const gunId = typeof StyleEffects !== 'undefined' ? StyleEffects.getActiveGun() : 0;
      if (!inGunslinger || gunId !== 4 || (!keys['Space'] && !keys['MouseLeft'])) {
        laserBeam = null;
      }
    }
    
    

    // === Рывок Trickster: ShiftLeft / ShiftRight ===
    if (keys['ShiftLeft'] || keys['ShiftRight']) {
      tryDash();
    }

    if (keys['Space']) {
      if (swordActive) swingSword();
      else shoot();
    }

    updateSword(dt);

    // === Таймеры Trickster ===
    if (dashInvulnerable > 0) dashInvulnerable -= dt;
    if (dashVisualTimer > 0)  dashVisualTimer  -= dt;

    // Шлейф затухает
    for (let i = dashTrail.length - 1; i >= 0; i--) {
      dashTrail[i].life -= dt * 3;
      if (dashTrail[i].life <= 0) dashTrail.splice(i, 1);
    }

    if (shieldTime > 0) shieldTime -= dt;
    if (magnetTime > 0) magnetTime -= dt;
    if (x2Time > 0)     x2Time -= dt;
    UI.updateBuffUI();

    if (!boss) {
      spawnTimer += dt * 60;
      if (spawnTimer >= spawnInterval) {
        spawnTimer = 0;
        spawnObject();
        spawnInterval = Math.max(20, 60 - score * 0.5);
      }
    }

    if (!boss && score >= bossNextTrigger) spawnBoss();

        for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      o.x -= o.speed;

      // Затухание вспышки от попадания
      if (o.hitFlash > 0) o.hitFlash -= dt * 4;

      if (magnetTime > 0 && o.type === 'trash') {
        const dxm = player.x - o.x;
        const dym = player.y - o.y;
        const dist = Math.hypot(dxm, dym) || 1;
        if (dist < 150) {
          o.x += (dxm / dist) * 2;
          o.y += (dym / dist) * 2;
        }
      }
      const d = Math.hypot(player.x - o.x, player.y - o.y);
      if (d < player.r + o.r) {
        if (o.type === 'trash') {
          const baseGain = x2Time > 0 ? 2 : 1;
          const gain = Math.round(baseGain * StyleRank.getMultiplier());
          score += gain;
          document.getElementById('score').textContent = score;
          Sound.pickup();
          emitParticles(o.x, o.y, '#7df07d', 10);
          StyleRank.addStyle(15);
        } else if (o.type === 'asteroid') {
          if (shieldTime > 0) {
            emitParticles(o.x, o.y, '#4aa3ff', 12);
            Sound.pickup();
            StyleRank.addStyle(5);
          } else {
            lives--;
            Sound.hit();
            emitParticles(player.x, player.y, '#ff5555', 20);
            updateLivesUI();
            triggerDamageFlash();
            StyleRank.breakCombo();
            if (lives <= 0) { endGame(); return; }
          }
        } else if (o.type === 'bonus') {
          if (o.bonusKind === 'shield') shieldTime = 5;
          if (o.bonusKind === 'magnet') magnetTime = 5;
          if (o.bonusKind === 'x2')     x2Time     = 5;
          Sound.pickup();
          emitParticles(o.x, o.y, '#ffe14a', 12);
          StyleRank.addStyle(20);
        }
        objects.splice(i, 1);
        continue;
      }
      if (o.x < -40) {
        if (o.type === 'trash' && !o.missed) {
          o.missed = true;
          StyleRank.loseStyle(5);
        }
        objects.splice(i, 1);
      }
    }

    updateBullets(dt);
    updateBoss(dt);
    updateEnemyBullets(dt);
    updateBossQuotes(dt);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.95; p.vy *= 0.95;
      p.life -= dt * 2;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = engineParticles.length - 1; i >= 0; i--) {
      const p = engineParticles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.94; p.vy *= 0.94;
      p.life -= dt * 1.8;
      if (p.life <= 0) engineParticles.splice(i, 1);
    }
  }

  /* ---------- РЕНДЕР ---------- */
    function drawVergil() {
    if (!boss) return;
    ctx.save();
    ctx.translate(boss.x, boss.y);

    const alpha = boss.teleportAlpha;
    ctx.globalAlpha = alpha;

    // Во время перехода — босс пульсирует
    let shadowColor = '#7fdcff';
    let shadowBlur  = 30;
    if (boss.invulnerable) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 60);
      shadowColor = pulse > 0.5 ? '#ffffff' : '#ff3344';
      shadowBlur  = 40 + pulse * 30;
    }
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur  = shadowBlur;

    ctx.fillStyle = boss.dying ? 'rgba(20,30,60,0.6)' : 'rgba(15,25,50,0.85)';
    ctx.beginPath();
    ctx.moveTo(-boss.r * 0.6, -boss.r * 0.4);
    ctx.lineTo(-boss.r * 1.4,  boss.r * 1.2);
    ctx.lineTo(-boss.r * 0.4,  boss.r * 0.7);
    ctx.lineTo( 0,             boss.r * 1.4);
    ctx.lineTo( boss.r * 0.4,  boss.r * 0.7);
    ctx.lineTo( boss.r * 1.4,  boss.r * 1.2);
    ctx.lineTo( boss.r * 0.6, -boss.r * 0.4);
    ctx.closePath();
    ctx.fill();

    const bodyGrad = ctx.createLinearGradient(0, -boss.r, 0, boss.r);
    bodyGrad.addColorStop(0, '#2a4a7a');
    bodyGrad.addColorStop(1, '#101828');
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = '#7fdcff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-boss.r * 0.7,  0);
    ctx.lineTo(-boss.r * 0.5, -boss.r * 0.85);
    ctx.lineTo( boss.r * 0.5, -boss.r * 0.95);
    ctx.lineTo( boss.r * 0.85, -boss.r * 0.3);
    ctx.lineTo( boss.r * 0.85,  boss.r * 0.35);
    ctx.lineTo( boss.r * 0.5,   boss.r * 0.95);
    ctx.lineTo(-boss.r * 0.5,   boss.r * 0.85);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#3a5a8a';
    ctx.beginPath();
    ctx.ellipse(-boss.r * 0.5, -boss.r * 0.4, boss.r * 0.25, boss.r * 0.15, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse( boss.r * 0.5, -boss.r * 0.4, boss.r * 0.25, boss.r * 0.15,  0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath();
    ctx.arc(0, -boss.r * 0.6, boss.r * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#7fdcff';
    ctx.shadowColor = '#7fdcff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(-boss.r * 0.08, -boss.r * 0.62, 2.5, 0, Math.PI * 2);
    ctx.arc( boss.r * 0.08, -boss.r * 0.62, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#7fdcff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-boss.r * 0.9, -boss.r * 0.3);
    ctx.lineTo(-boss.r * 1.5,  boss.r * 0.9);
    ctx.stroke();

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-boss.r * 0.9, -boss.r * 0.3);
    ctx.lineTo(-boss.r * 0.7, -boss.r * 0.5);
    ctx.stroke();

    if (boss.flashAlpha > 0) {
      ctx.globalAlpha = boss.flashAlpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, boss.r * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
    }
    ctx.restore();
  }

  function drawSwordDE1() {
    ctx.save();
    ctx.translate(player.x, player.y);

    const isSwinging = swordSwingTimer > 0;
    const isVulnerable = swordVulnerable > 0;
    const swingProgress = isSwinging
      ? 1 - (swordSwingTimer / SWORD_DURATION) : 0;

    let swordAngle;
    if (isSwinging) swordAngle = swordSwingStart + swingProgress * Math.PI * 2;
    else swordAngle = -Math.PI * 0.15;

    const holdRadius = isSwinging ? SWORD_RADIUS * 0.85 : player.r + 8;
    const handX = Math.cos(swordAngle) * holdRadius;
    const handY = Math.sin(swordAngle) * holdRadius;
    const bladeDir = swordAngle + Math.PI * 0.15;

    if (isSwinging) {
      const waveAlpha = Math.max(0, 1 - swingProgress * 1.2);
      ctx.globalAlpha = waveAlpha * 0.6;
      ctx.strokeStyle = '#ff3344';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff3344';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, SWORD_RADIUS * (0.8 + swingProgress * 0.4), 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = waveAlpha * 0.15;
      ctx.fillStyle = '#ff3344';
      ctx.beginPath();
      ctx.arc(0, 0, SWORD_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    } else if (isVulnerable) {
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, SWORD_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (parryPulse > 0) {
      ctx.globalAlpha = parryPulse * 0.7;
      ctx.strokeStyle = '#ffeb3b';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ffeb3b';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(0, 0, SWORD_RADIUS * (1 + (1 - parryPulse) * 0.5), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(bladeDir);

    const bladeColor = isSwinging ? '#ffffff' : (isVulnerable ? '#888' : '#e8e8e8');
    ctx.shadowColor = isSwinging ? '#ffeb3b' : (isVulnerable ? '#333' : '#ff3344');
    ctx.shadowBlur = isSwinging ? 25 : (isVulnerable ? 5 : 15);

    ctx.fillStyle = bladeColor;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo( 3.5, 0);
    ctx.lineTo(0, 6);
    ctx.lineTo(-3.5, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = isVulnerable ? '#666' : '#ff3344';
    ctx.fillRect(-0.8, -20, 1.6, 24);

    ctx.strokeStyle = isSwinging ? '#ffeb3b' : (isVulnerable ? '#555' : '#ff3344');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo( 3.5, 0);
    ctx.lineTo(-3.5, 0);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = '#222';
    ctx.fillRect(-6, 0, 12, 3);

    ctx.fillStyle = '#444';
    ctx.fillRect(-2, 3, 4, 8);

    ctx.fillStyle = isVulnerable ? '#666' : '#ff3344';
    ctx.beginPath();
    ctx.arc(0, 12, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();

    if (swordFlashAlpha > 0) {
      ctx.globalAlpha = swordFlashAlpha * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0a0e1a');
    grad.addColorStop(1, '#0e1a2a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let i = 0; i < 60; i++) {
      const sx = (i * 137.5) % W;
      const sy = (i * 71.3)  % H;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    // === ШЛЕЙФ РЫВКА (Trickster) ===
    for (const t of dashTrail) {
      ctx.save();
      ctx.globalAlpha = t.life * 0.7;
      ctx.fillStyle = '#7fdcff';
      ctx.shadowColor = '#7fdcff';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(t.x, t.y, player.r * 0.7 * t.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

        if (boss && !boss.dying) {
      const auraGrad = ctx.createRadialGradient(boss.x, boss.y, 0, boss.x, boss.y, 300);
      auraGrad.addColorStop(0, 'rgba(80, 140, 255, 0.08)');
      auraGrad.addColorStop(1, 'rgba(80, 140, 255, 0)');
      ctx.fillStyle = auraGrad;
      ctx.fillRect(0, 0, W, H);
    }

    // === ВСПЫШКА ЭКРАНА при переходе фаз ===
    if (boss && boss.invulnerable && boss.transitionAlpha > 0) {
      // Расширяющееся кольцо от босса
      const ringProgress = 1 - boss.transitionAlpha;
      const ringRadius = ringProgress * 400;
      ctx.save();
      ctx.globalAlpha = boss.transitionAlpha * 0.8;
      ctx.strokeStyle = '#7fdcff';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#7fdcff';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Второе кольцо — с задержкой
      if (ringProgress > 0.2) {
        ctx.globalAlpha = boss.transitionAlpha * 0.5;
        ctx.strokeStyle = '#ff3344';
        ctx.beginPath();
        ctx.arc(boss.x, boss.y, ringRadius * 0.7, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Синяя заливка экрана на пике
      if (ringProgress < 0.3) {
        ctx.globalAlpha = (0.3 - ringProgress) / 0.3 * 0.35;
        ctx.fillStyle = '#7fdcff';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    }

    for (const p of engineParticles) {
      ctx.globalAlpha = p.life * 0.7;
      const color = p.life > 0.6 ? '#fff' : (p.life > 0.3 ? '#88dfff' : '#3a7fc4');
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const o of objects) {
      ctx.save();
      ctx.translate(o.x, o.y);
      if (o.type === 'trash') {
        ctx.fillStyle = '#4caf50';
        ctx.shadowColor = '#4caf50';
        ctx.shadowBlur = 12;
        ctx.fillRect(-o.r, -o.r, o.r * 2, o.r * 2);
            } else if (o.type === 'asteroid') {
        // Цвет зависит от HP
        const hpRatio = o.hp / o.maxHp;
        let baseColor;
        if (hpRatio > 0.66)       baseColor = '#e53935';   // свежий
        else if (hpRatio > 0.33)  baseColor = '#b71c1c';   // потрёпанный
        else                      baseColor = '#7f0000';   // почти разрушен

        // Вспышка при попадании — белым
        if (o.hitFlash > 0) baseColor = '#ffffff';

        ctx.fillStyle = baseColor;
        ctx.shadowColor = '#e53935';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, o.r, 0, Math.PI * 2);
        ctx.fill();

        // Трещины по мере урона
        const damageLevel = 1 - hpRatio;
        if (damageLevel > 0.15) {
          ctx.save();
          ctx.strokeStyle = 'rgba(0,0,0,0.55)';
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 0;

          // Трещина 1 — левая
          if (damageLevel > 0.15) {
            ctx.beginPath();
            ctx.moveTo(-o.r * 0.6, -o.r * 0.2);
            ctx.lineTo(-o.r * 0.15, 0);
            ctx.lineTo(-o.r * 0.4, o.r * 0.5);
            ctx.stroke();
          }
          // Трещина 2 — правая
          if (damageLevel > 0.4) {
            ctx.beginPath();
            ctx.moveTo(o.r * 0.7, -o.r * 0.5);
            ctx.lineTo(o.r * 0.2, 0);
            ctx.lineTo(o.r * 0.5, o.r * 0.6);
            ctx.stroke();
          }
          // Трещина 3 — центральная
          if (damageLevel > 0.7) {
            ctx.beginPath();
            ctx.moveTo(0, -o.r * 0.7);
            ctx.lineTo(-o.r * 0.3, 0);
            ctx.lineTo(o.r * 0.2, o.r * 0.7);
            ctx.stroke();
          }
          ctx.restore();
        }

        // HP-бар — только если астероид уже повреждён
        if (o.hp < o.maxHp) {
          const barW = o.r * 2;
          const barH = 3;
          const barX = -o.r;
          const barY = -o.r - 8;

          // Фон
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

          // Заполнение
          const pct = Math.max(0, o.hp / o.maxHp);
          const col = pct > 0.66 ? '#4caf50' : pct > 0.33 ? '#ffd600' : '#e53935';
          ctx.fillStyle = col;
          ctx.fillRect(barX, barY, barW * pct, barH);
        }
      } else if (o.type === 'bonus') {
        const color = o.bonusKind === 'shield' ? '#4aa3ff'
                    : o.bonusKind === 'magnet' ? '#a05cff'
                    : '#ffd600';
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(0, -o.r);
        ctx.lineTo(o.r, 0);
        ctx.lineTo(0, o.r);
        ctx.lineTo(-o.r, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    
        // === Отрисовка лазерного луча ===
    if (laserBeam) {
      const x2 = W + 100; // До правого края
      const y2 = laserBeam.y1; // Строго по горизонтали
      
          // === Отрисовка лазерного луча ===
    if (laserBeam) {
      const x2 = W + 100;
      const y2 = laserBeam.y1;
      
      ctx.save();
      // Внешнее свечение
      ctx.strokeStyle = 'rgba(127, 220, 255, 0.3)';
      ctx.lineWidth = 15;
      ctx.shadowColor = '#7fdcff';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(laserBeam.x1, laserBeam.y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      
      // Средний слой
      ctx.strokeStyle = 'rgba(127, 220, 255, 0.8)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(laserBeam.x1, laserBeam.y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Ядро (белое)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(laserBeam.x1, laserBeam.y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      
      // Вспышка на конце
      ctx.fillStyle = '#7fdcff';
      ctx.beginPath();
      ctx.arc(laserBeam.x1, laserBeam.y1, 8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }
  }
    
        for (const b of bullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      const col = b.color || '#ffeb3b';
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      
      if (b.isLaser) {
        ctx.fillRect(-b.r * 0.5, -b.r * 2, b.r, b.r * 4);
      } else if (b.isRocket) {
        ctx.ellipse(0, 0, b.r * 1.5, b.r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-b.r, -b.r * 0.5);
        ctx.lineTo(-b.r * 2, 0);
        ctx.lineTo(-b.r, b.r * 0.5);
        ctx.fill();
      } else {
        ctx.arc(0, 0, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(-b.vx * 1.5, -b.vy * 1.5, b.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    for (const b of enemyBullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate((b.angle || 0) + Math.PI / 2);
      ctx.shadowColor = '#7fdcff';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#cceaff';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo( 3, 0);
      ctx.lineTo(0, 10);
      ctx.lineTo(-3, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#4aa3ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#333';
      ctx.fillRect(-1.5, 10, 3, 3);
      ctx.restore();
    }

    for (const r of reflectedSwords) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle + Math.PI / 2);
      const color = r.perfect ? '#ffeb3b' : '#ff3344';
      ctx.shadowColor = color;
      ctx.shadowBlur = 25;
      ctx.fillStyle = r.perfect ? '#fffbe0' : '#ffe0d0';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo( 4, 0);
      ctx.lineTo(0, 12);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#333';
      ctx.fillRect(-2, 12, 4, 4);
      ctx.restore();
    }

    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawVergil();

    if (boss && !boss.dying && !boss.entering) {
      const barW = 240, barH = 12;
      const barX = W / 2 - barW / 2, barY = 20;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(barX - 3, barY - 3, barW + 6, barH + 6);
      ctx.fillStyle = '#0a1a3a';
      ctx.fillRect(barX, barY, barW, barH);
      const pct = boss.hp / boss.maxHp;
      const grad2 = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      grad2.addColorStop(0, '#3a7fc4');
      grad2.addColorStop(0.5, '#7fdcff');
      grad2.addColorStop(1, '#4aa3ff');
      ctx.fillStyle = grad2;
      ctx.fillRect(barX, barY, barW * pct, barH);
      ctx.strokeStyle = '#7fdcff';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#7fdcff';
      ctx.shadowBlur = 8;
      ctx.strokeRect(barX, barY, barW, barH);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#7fdcff';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#7fdcff';
      ctx.shadowBlur = 10;
      ctx.fillText('V E R G I L', W / 2, barY - 8);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#cceaff';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.fillText(boss.hp + ' / ' + boss.maxHp, W / 2, barY + barH + 14);
      ctx.textAlign = 'left';
    }

        ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.tilt);

    // === Аура Trickster во время неуязвимости ===
    if (dashInvulnerable > 0) {
      const dashPulse = 0.5 + 0.5 * Math.sin(performance.now() / 50);
      ctx.strokeStyle = `rgba(127,220,255,${0.6 + dashPulse * 0.4})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#7fdcff';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(0, 0, player.r + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (shieldTime > 0) {
      ctx.strokeStyle = 'rgba(74,163,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, player.r + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    const vulnerable = swordVulnerable > 0;
    ctx.fillStyle = vulnerable ? '#f0f0f0' : '#f5f5f5';

    // Мерцание во время неуязвимости — синий/белый
    if (dashInvulnerable > 0 && Math.floor(performance.now() / 60) % 2 === 0) {
      ctx.fillStyle = '#a8e8ff';
    } else if (vulnerable && Math.floor(performance.now() / 100) % 2 === 0) {
      ctx.fillStyle = '#ffaaaa';
    }

    ctx.shadowColor = dashInvulnerable > 0
      ? '#7fdcff'
      : (swordActive ? '#ff3344' : '#7df07d');
    ctx.shadowBlur = dashInvulnerable > 0
      ? 30
      : (swordActive ? 22 : 15);
    ctx.beginPath();
    ctx.moveTo( player.r, 0);
    ctx.lineTo(-player.r * 0.7, -player.r * 0.8);
    ctx.lineTo(-player.r * 0.4,  0);
    ctx.lineTo(-player.r * 0.7,  player.r * 0.8);
    ctx.closePath();
    ctx.fill();

    if (!swordActive) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#888';
      ctx.fillRect(player.r * 0.3, -3, player.r * 0.8, 6);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(120, 200, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(player.r * 0.15, 0, player.r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (swordActive) drawSwordDE1();

    if (magnetTime > 0) {
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.strokeStyle = `rgba(160,92,255,${0.3 + 0.2 * Math.sin(Date.now() / 150)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 150, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const q of bossQuotes) {
      const alpha = Math.min(1, q.life);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillStyle = q.color;
      ctx.shadowColor = q.color;
      ctx.shadowBlur = 15;
      ctx.textAlign = 'center';
      ctx.fillText(q.text, W / 2, H / 2 - 40);
      ctx.restore();
    }
    // === ТЕКСТ «PHASE II / III» при переходе ===
    if (boss && boss.transitionLabel && boss.transitionAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = boss.transitionAlpha;

      // Пульсирующий размер
      const scale = 1 + (1 - boss.transitionAlpha) * 0.3;
      ctx.font = `bold ${28 * scale}px "Impact", "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Тень/свечение
      ctx.shadowColor = '#ff3344';
      ctx.shadowBlur = 25;
      ctx.fillStyle = '#ff3344';
      ctx.fillText(boss.transitionLabel, W / 2, H / 2);

      // Второй слой — белый обвод
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeText(boss.transitionLabel, W / 2, H / 2);

      ctx.restore();
    }
    if (Joystick.state.active) {
      const j = Joystick.state;
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(j.baseX, j.baseY, j.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#7df07d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(j.baseX, j.baseY, j.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#7df07d';
      ctx.beginPath();
      ctx.arc(j.knobX, j.knobY, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(j.knobX, j.knobY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function loop(ts) {
    if (!lastTime) lastTime = ts;
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    if (running && !gameOver) {
      update(dt);
      draw();
    }
    rafId = requestAnimationFrame(loop);
  }

  function updateLivesUI() {
    const el = document.getElementById('lives');
    if (el) el.textContent = '❤'.repeat(Math.max(0, lives));
  }

  function start() {
    resizeCanvas();
    player = { ...PLAYER_DEFAULTS };
    objects = []; particles = []; engineParticles = [];
    bullets = []; enemyBullets = []; reflectedSwords = [];
    bossQuotes = [];
    boss = null;
    bossNextTrigger = BOSS_SCORE_TRIGGER;
    bossIntroTime = 0;

        swordActive = false;
    swordSwingTimer = 0; swordCooldown = 0; swordVulnerable = 0;
    swordFlashAlpha = 0; parryPulse = 0;

    // Сброс Trickster
    dashInvulnerable = 0;
    dashVisualTimer = 0;
    dashTrail = [];

    document.getElementById('parryBtn').classList.remove('visible');
    document.getElementById('parryBtn').classList.remove('cooldown');

    score = 0; lives = 3;
    spawnTimer = 0; spawnInterval = 60;
    bulletCooldown = 0;
    shieldTime = magnetTime = x2Time = 0;
    running = true; gameOver = false;

    StyleRank.reset();

    document.getElementById('score').textContent = '0';
    updateLivesUI();
    UI.updateBuffUI();

    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  function pause()  { running = false; }
  function resume() { if (!gameOver) { running = true; lastTime = 0; } }

  function endGame() {
    running = false; gameOver = true;
    Sound.gameOver();

    document.getElementById('parryBtn').classList.remove('visible');

    const high = Storage.getHighScore();
    const isRecord = score > high;

    document.getElementById('finalScore').textContent = score;
    document.getElementById('highScore').textContent  = Math.max(score, high);
    document.getElementById('finalRank').textContent  = StyleRank.getMaxRankName();

    Storage.addScore(score);
    if (isRecord) setTimeout(() => Sound.record(), 500);

    setTimeout(() => UI.goto('gameover'), 600);
  }

  return {
    start, pause, resume, endGame, shoot, swingSword, tryDash,
    publicState
  };
})();