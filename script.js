const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;
const groundY = 395;

const ui = {
  level: document.getElementById("level"),
  hp: document.getElementById("hp"),
  coins: document.getElementById("coins"),
  potions: document.getElementById("potions"),
  armor: document.getElementById("armor"),
  weapon: document.getElementById("weapon"),
  message: document.getElementById("message"),
  weaponMenu: document.getElementById("weaponMenu"),
  shopMenu: document.getElementById("shopMenu"),
  endMenu: document.getElementById("endMenu"),
  weaponInfo: document.getElementById("weaponInfo"),
  shopMessage: document.getElementById("shopMessage")
};

const weapons = {
  sword: { name: "Sword", damage: 25, price: 40, range: 72, color: "#e8eefc" },
  bow:   { name: "Bow",   damage: 18, price: 55, range: 300, color: "#8be9fd" },
  magic: { name: "Magic", damage: 40, price: 90, range: 260, color: "#d9a5ff" }
};
let ownedWeapons = ["sword"];
let weapon = "sword";
let level = 1, coins = 50, potions = 2, armor = 0;
let hp = 100, maxHp = 100;
let player, enemies, projectiles, keys;
let cameraX = 0, worldWidth = 1800, secretFound = false;
let levelComplete = false, gameOver = false, lastAttack = 0;
let messageTimer = 0;
let audioCtx = null;
let bossMusic = false;

function newPlayer() {
  return { x: 100, y: groundY - 54, w: 34, h: 54, vx: 0, vy: 0, speed: 4.1, jump: -12, onGround: true, facing: 1, invincible: 0 };
}
function initLevel() {
  worldWidth = 1800 + level * 120;
  player = newPlayer();
  enemies = [];
  projectiles = [];
  cameraX = 0;
  levelComplete = false;
  gameOver = false;
  secretFound = false;
  const count = level % 5 === 0 ? 1 : Math.min(3 + Math.floor(level / 2), 9);
  if (level % 5 === 0) {
    enemies.push(makeEnemy(worldWidth - 240, true));
    say("BOSS LEVEL! Kalahkan boss untuk lanjut!");
  } else {
    for (let i = 0; i < count; i++) {
      enemies.push(makeEnemy(380 + i * Math.max(125, (worldWidth - 650) / count), false));
    }
    say("Level " + level + ": kalahkan semua monster!");
  }
  if (level >= 3) secretFound = true;
  updateHud();
  setBossMusic(level % 5 === 0);
}
function makeEnemy(x, boss) {
  const scale = 1 + (level - 1) * 0.12;
  return {
    x, y: groundY - (boss ? 82 : 42), w: boss ? 62 : 34, h: boss ? 82 : 42,
    hp: Math.round((boss ? 180 : 45) * scale),
    maxHp: Math.round((boss ? 180 : 45) * scale),
    damage: boss ? 18 : 8 + Math.floor(level / 3),
    speed: boss ? 1.25 + level * 0.025 : 0.8 + level * 0.025,
    boss, alive: true, attackCooldown: 0, facing: -1
  };
}
function updateHud() {
  ui.level.textContent = level;
  ui.hp.textContent = Math.max(0, hp) + "/" + maxHp;
  ui.coins.textContent = coins;
  ui.potions.textContent = potions;
  ui.armor.textContent = armor;
  ui.weapon.textContent = weapons[weapon].name;
  document.getElementById("shopCoins").textContent = coins;
  for (const name of Object.keys(weapons)) {
    const state = document.getElementById(name + "State");
    if (state) state.textContent = ownedWeapons.includes(name) ? (weapon === name ? " (AKTIF)" : " (DIMILIKI)") : " (BELUM DIBELI)";
  }
}
function say(text, duration = 180) {
  ui.message.textContent = text;
  messageTimer = duration;
}
function openWeaponMenu() {
  if (gameOver || levelComplete || !ui.shopMenu.classList.contains("hidden")) return;
  ui.weaponMenu.classList.remove("hidden");
  updateHud();
}
function closeWeaponMenu() { ui.weaponMenu.classList.add("hidden"); }
function selectWeapon(name) {
  if (!weapons[name]) return;
  if (!ownedWeapons.includes(name)) {
    ui.weaponInfo.textContent = "Belum punya " + weapons[name].name + ". Beli dulu di Shop (K).";
    return;
  }
  weapon = name;
  ui.weaponInfo.textContent = "Senjata aktif: " + weapons[name].name;
  updateHud();
  say("Senjata diganti menjadi " + weapons[name].name + "!");
}
function openShop() {
  if (gameOver || levelComplete || !ui.weaponMenu.classList.contains("hidden")) return;
  ui.shopMenu.classList.remove("hidden");
  document.getElementById("shopCoins").textContent = coins;
  ui.shopMessage.textContent = "Pilih barang untuk dibeli.";
}
function closeShop() { ui.shopMenu.classList.add("hidden"); }
function buy(item) {
  if (!ui.shopMenu.classList.contains("hidden")) {
    const prices = { potion: 15, sword: 40, bow: 55, magic: 90, armor: 45 };
    const price = prices[item];
    if (price === undefined) return;
    if (coins < price) {
      ui.shopMessage.textContent = "Koin tidak cukup!";
      return;
    }
    if (item !== "potion" && item !== "armor" && ownedWeapons.includes(item)) {
      ui.shopMessage.textContent = "Senjata ini sudah kamu miliki.";
      return;
    }
    coins -= price;
    if (item === "potion") {
      potions++;
      ui.shopMessage.textContent = "Potion berhasil dibeli!";
    } else if (item === "armor") {
      armor++;
      ui.shopMessage.textContent = "Armor bertambah! Damage musuh berkurang.";
    } else {
      ownedWeapons.push(item);
      ui.shopMessage.textContent = weapons[item].name + " berhasil dibeli! Tekan J untuk memilihnya.";
    }
    updateHud();
  }
}
function usePotion() {
  if (potions <= 0) { say("Potion habis! Beli lagi di Shop (K)."); return; }
  if (hp >= maxHp) { say("HP kamu masih penuh."); return; }
  potions--;
  hp = Math.min(maxHp, hp + 45);
  updateHud();
  say("Potion digunakan. HP pulih!");
}
function attack() {
  const now = performance.now();
  if (now - lastAttack < 420 || gameOver || levelComplete || !ui.shopMenu.classList.contains("hidden") || !ui.weaponMenu.classList.contains("hidden")) return;
  lastAttack = now;
  const w = weapons[weapon];
  if (weapon === "sword") {
    let hit = false;
    for (const e of enemies) {
      if (!e.alive) continue;
      const distance = e.x - (player.x + player.w / 2);
      if (Math.abs(distance) <= w.range && (Math.sign(distance) === player.facing || Math.abs(distance) < 25)) {
        damageEnemy(e, w.damage); hit = true;
      }
    }
    say(hit ? "Sword mengenai musuh!" : "Sword menyerang!");
  } else {
    projectiles.push({
      x: player.x + player.w / 2, y: player.y + player.h * 0.45,
      vx: player.facing * (weapon === "bow" ? 8 : 6),
      damage: w.damage, range: w.range, traveled: 0, color: w.color,
      radius: weapon === "magic" ? 10 : 5
    });
    say(weapon === "bow" ? "Panah dilepaskan!" : "Bola sihir dilepaskan!");
  }
}
function damageEnemy(e, amount) {
  e.hp -= amount;
  if (e.hp <= 0 && e.alive) {
    e.alive = false;
    const reward = e.boss ? 100 : 10 + Math.floor(level / 2);
    coins += reward;
    say((e.boss ? "BOSS DIKALAHKAN!" : "Monster dikalahkan!") + " +" + reward + " koin");
    updateHud();
    if (enemies.every(enemy => !enemy.alive)) finishLevel();
  }
}
function finishLevel() {
  levelComplete = true;
  ui.endMenu.classList.remove("hidden");
  document.getElementById("endTitle").textContent = level % 5 === 0 ? "🏆 Boss dikalahkan!" : "⭐ Level selesai!";
  document.getElementById("endText").textContent = "Kamu menyelesaikan level " + level + ". Tekan Enter untuk lanjut.";
  say("Level selesai! Tekan Enter untuk lanjut.");
  setBossMusic(false);
}
function nextLevel() {
  if (!levelComplete) return;
  level++;
  ui.endMenu.classList.add("hidden");
  hp = Math.min(maxHp, hp + 15);
  initLevel();
}
function restartGame() {
  level = 1; coins = 50; potions = 2; armor = 0; hp = 100; maxHp = 100;
  weapon = "sword"; ownedWeapons = ["sword"];
  ui.endMenu.classList.add("hidden");
  closeShop(); closeWeaponMenu();
  initLevel();
  say("Game dimulai ulang!");
}
function enterSecret() {
  if (!secretFound) { say("Dungeon rahasia belum ditemukan. Coba jelajahi level 3+."); return; }
  if (levelComplete || gameOver) return;
  levelComplete = true;
  ui.endMenu.classList.remove("hidden");
  document.getElementById("endTitle").textContent = "🕳️ Dungeon Rahasia!";
  document.getElementById("endText").textContent = "Kamu menemukan dungeon rahasia! Tekan Enter untuk masuk ke level spesial.";
  const oldLevel = level;
  window.secretNext = () => {
    level = oldLevel + 1;
    ui.endMenu.classList.add("hidden");
    initLevel();
    enemies.push(makeEnemy(worldWidth - 400, true));
    say("Dungeon spesial: boss tambahan muncul!");
  };
}
function damagePlayer(amount) {
  if (player.invincible > 0 || gameOver) return;
  const reduced = Math.max(2, amount - armor * 2);
  hp -= reduced;
  player.invincible = 55;
  updateHud();
  if (hp <= 0) {
    hp = 0; gameOver = true;
    ui.endMenu.classList.remove("hidden");
    document.getElementById("endTitle").textContent = "💀 Game Over";
    document.getElementById("endText").textContent = "Koin dan perlengkapanmu bisa dicoba lagi. Tekan R untuk mulai ulang.";
    say("Game Over! Tekan R untuk mencoba lagi.");
  } else say("Kamu terkena serangan! -" + reduced + " HP");
}
function setBossMusic(on) {
  if (bossMusic === on) return;
  bossMusic = on;
  // Efek suara sederhana; tidak memerlukan file audio eksternal.
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = on ? "sawtooth" : "sine";
    osc.frequency.value = on ? 95 : 520;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, audioCtx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.28);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
  } catch (_) {}
}
function roundedRect(x, y, w, h, r, color) {
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.fill();
}
function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, level % 5 === 0 ? "#47305e" : "#7dd7ed");
  grad.addColorStop(1, level % 5 === 0 ? "#ed9a7a" : "#e4f6c4");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  // Awan dan bukit bergerak dengan kamera.
  for (let i = 0; i < 8; i++) {
    const x = ((i * 180 - cameraX * 0.25) % (W + 220) + W + 220) % (W + 220) - 100;
    ctx.fillStyle = "#ffffffaa";
    ctx.beginPath(); ctx.ellipse(x, 75 + (i % 3) * 25, 38, 14, 0, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 7; i++) {
    const x = i * 190 - (cameraX * 0.45 % 190);
    ctx.fillStyle = level % 5 === 0 ? "#654a78" : "#83bd8d";
    ctx.beginPath(); ctx.moveTo(x - 100, groundY); ctx.quadraticCurveTo(x + 10, 190, x + 120, groundY); ctx.fill();
  }
  ctx.fillStyle = "#4e9b5e"; ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = "#36764c"; ctx.fillRect(0, groundY + 12, W, H - groundY - 12);
  for (let x = -((cameraX * 1.2) % 40); x < W; x += 40) {
    ctx.fillStyle = "#8fd36e"; ctx.fillRect(x, groundY + 2, 22, 4);
  }
  // Lubang rahasia di level 3+.
  if (secretFound) {
    const holeWorldX = 650;
    const hx = holeWorldX - cameraX;
    if (hx > -70 && hx < W + 70) {
      ctx.fillStyle = "#101020"; ctx.beginPath();
      ctx.ellipse(hx, groundY + 3, 32, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff0a6"; ctx.font = "12px sans-serif";
      ctx.fillText("E: Dungeon", hx - 34, groundY - 20);
    }
  }
}
function drawPlayer() {
  const x = player.x - cameraX, y = player.y;
  if (player.invincible > 0 && Math.floor(player.invincible / 5) % 2 === 0) return;
  // Karakter kartun manusia.
  ctx.fillStyle = "#f1bd8d"; ctx.beginPath(); ctx.arc(x + 17, y + 10, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#4b2f26"; ctx.fillRect(x + 7, y + 1, 20, 6);
  ctx.fillStyle = "#2d67bc"; ctx.fillRect(x + 5, y + 20, 24, 22);
  ctx.fillStyle = "#f1bd8d"; ctx.fillRect(x + (player.facing > 0 ? 26 : 0), y + 23, 7, 16);
  ctx.fillStyle = "#293650"; ctx.fillRect(x + 7, y + 42, 8, 12); ctx.fillRect(x + 20, y + 42, 8, 12);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(x + (player.facing > 0 ? 21 : 9), y + 8, 3, 3);
  if (weapon === "sword") {
    ctx.strokeStyle = "#e9f2ff"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + 17, y + 29); ctx.lineTo(x + 17 + player.facing * 22, y + 19); ctx.stroke();
  } else if (weapon === "bow") {
    ctx.strokeStyle = "#9a5d2d"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x + 17 + player.facing * 10, y + 28, 12, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  } else {
    ctx.fillStyle = "#d8a3ff"; ctx.beginPath(); ctx.arc(x + 17 + player.facing * 15, y + 26, 6, 0, Math.PI * 2); ctx.fill();
  }
}
function drawEnemy(e) {
  if (!e.alive) return;
  const x = e.x - cameraX, y = e.y;
  ctx.fillStyle = e.boss ? "#622c82" : "#4e9d50";
  roundedRect(x, y, e.w, e.h, e.boss ? 12 : 8, ctx.fillStyle);
  ctx.fillStyle = "#f7f7ff";
  ctx.fillRect(x + e.w * 0.22, y + e.h * 0.22, 7, 8);
  ctx.fillRect(x + e.w * 0.62, y + e.h * 0.22, 7, 8);
  ctx.fillStyle = "#202030";
  ctx.fillRect(x + e.w * 0.25, y + e.h * 0.27, 4, 5);
  ctx.fillRect(x + e.w * 0.65, y + e.h * 0.27, 4, 5);
  ctx.fillStyle = "#39223f"; ctx.fillRect(x + e.w * 0.25, y + e.h * 0.63, e.w * 0.5, 4);
  ctx.fillStyle = "#5c1726"; ctx.fillRect(x, y - 12, e.w, 6);
  ctx.fillStyle = "#ff5368"; ctx.fillRect(x, y - 12, e.w * Math.max(0, e.hp / e.maxHp), 6);
  if (e.boss) {
    ctx.fillStyle = "#fff"; ctx.font = "bold 13px sans-serif"; ctx.fillText("BOSS", x + 6, y - 18);
  }
}
function drawProjectiles() {
  for (const p of projectiles) {
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x - cameraX, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
    if (weapon === "bow") {
      ctx.strokeStyle = "#71451e"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x - cameraX - 8, p.y); ctx.lineTo(p.x - cameraX + 8, p.y); ctx.stroke();
    }
  }
}
function update() {
  if (!player || gameOver || levelComplete) return;
  if (player.invincible > 0) player.invincible--;
  player.vx = 0;
  if (keys.a || keys.arrowleft) { player.vx = -player.speed; player.facing = -1; }
  if (keys.d || keys.arrowright) { player.vx = player.speed; player.facing = 1; }
  player.x = Math.max(0, Math.min(worldWidth - player.w, player.x + player.vx));
  if ((keys.space || keys.arrowup || keys.w) && player.onGround) {
    player.vy = player.jump; player.onGround = false;
  }
  player.vy += 0.55; player.y += player.vy;
  if (player.y + player.h >= groundY) { player.y = groundY - player.h; player.vy = 0; player.onGround = true; }
  cameraX = Math.max(0, Math.min(worldWidth - W, player.x - W * 0.35));

  for (const e of enemies) {
    if (!e.alive) continue;
    const distance = (player.x + player.w / 2) - (e.x + e.w / 2);
    if (Math.abs(distance) > 42) {
      e.x += Math.sign(distance) * e.speed;
      e.facing = Math.sign(distance);
    } else {
      e.attackCooldown--;
      if (e.attackCooldown <= 0) {
        damagePlayer(e.damage);
        e.attackCooldown = e.boss ? 65 : 90;
      }
    }
  }
  for (const p of projectiles) {
    p.x += p.vx; p.traveled += Math.abs(p.vx);
    for (const e of enemies) {
      if (!e.alive) continue;
      if (p.x >= e.x && p.x <= e.x + e.w && p.y >= e.y && p.y <= e.y + e.h) {
        damageEnemy(e, p.damage); p.traveled = p.range + 1; break;
      }
    }
  }
  projectiles = projectiles.filter(p => p.traveled <= p.range && p.x >= 0 && p.x <= worldWidth);
  // E hanya aktif dekat lubang rahasia.
  if (keys.e && secretFound && Math.abs(player.x - 650) < 70) {
    keys.e = false; enterSecret();
  }
}
function draw() {
  drawBackground();
  // Beberapa batu dekorasi.
  for (let i = 0; i < 14; i++) {
    const x = ((i * 145 - cameraX) % (W + 40) + W + 40) % (W + 40) - 20;
    ctx.fillStyle = "#7b8a75"; ctx.beginPath(); ctx.ellipse(x, groundY + 22, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
  }
  for (const e of enemies) drawEnemy(e);
  drawProjectiles();
  drawPlayer();
  // Indikator kemajuan.
  ctx.fillStyle = "#132039cc"; ctx.fillRect(15, H - 38, W - 30, 20);
  ctx.fillStyle = "#ffd166"; ctx.fillRect(15, H - 38, (W - 30) * Math.min(1, player.x / worldWidth), 20);
  ctx.strokeStyle = "#ffffff99"; ctx.strokeRect(15, H - 38, W - 30, 20);
}
function loop() {
  update();
  draw();
  if (messageTimer > 0) messageTimer--;
  requestAnimationFrame(loop);
}
function keyDown(event) {
  const k = event.key.toLowerCase();
  if ([" ", "arrowleft", "arrowright", "arrowup"].includes(k)) event.preventDefault();
  if (event.repeat) return;
  if (k === "escape") { closeShop(); closeWeaponMenu(); return; }
  if (k === "r") { restartGame(); return; }
  if (k === "k") {
    if (!ui.shopMenu.classList.contains("hidden")) closeShop();
    else { closeWeaponMenu(); openShop(); }
    return;
  }
  if (k === "j") {
    if (!ui.weaponMenu.classList.contains("hidden")) closeWeaponMenu();
    else { closeShop(); openWeaponMenu(); }
    return;
  }
  if (!ui.shopMenu.classList.contains("hidden")) {
    const items = { "1": "potion", "2": "sword", "3": "bow", "4": "magic", "5": "armor" };
    if (items[k]) buy(items[k]);
    return;
  }
  if (!ui.weaponMenu.classList.contains("hidden")) {
    if (k === "1") selectWeapon("sword");
    if (k === "2") selectWeapon("bow");
    if (k === "3") selectWeapon("magic");
    return;
  }
  if (k === "enter") {
    if (levelComplete) {
      if (typeof window.secretNext === "function") {
        const f = window.secretNext; window.secretNext = null; f();
      } else nextLevel();
    }
    return;
  }
  if (k === "p") { usePotion(); return; }
  if (k === "l") { attack(); return; }
  if (k === "e") { if (secretFound && Math.abs(player.x - 650) < 70) enterSecret(); return; }
  if (k === "a" || k === "d" || k === "w" || k === " " || k.startsWith("arrow")) keys[k] = true;
}
function keyUp(event) { keys[event.key.toLowerCase()] = false; }

keys = {};
window.addEventListener("keydown", keyDown);
window.addEventListener("keyup", keyUp);
initLevel();
loop();
