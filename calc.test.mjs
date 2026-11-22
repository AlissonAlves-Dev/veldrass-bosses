import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Carrega só os dados e o núcleo da calculadora (sem DOM), no mesmo escopo, como no navegador.
const read = (file) => readFileSync(new URL('./public/calculadora/' + file, import.meta.url), 'utf8');
const c = runInNewContext(
  read('data.js') + read('calc-core.js') +
  ';({ S, CLASSES, RULES, DATA, MARK, derive, simulate, metrics, earned, marksCost, marksWarnings, dmgAfterDef, countFoods, petFoodsOver, PETS });'
);

// Mesma calibração da interface: ajusta a espera extra para o cenário A bater com os abates/h do painel.
function overheadFor() {
  const dv = c.derive(c.S.A);
  const r = c.simulate(c.S.A);
  const killsPerEnc = Object.values(r.killsPerEnc).reduce((a, b) => a + b, 0);
  return 3600 / (c.S.observedKills / killsPerEnc) - dv.wait - r.actSecPerEnc;
}

test('dados: 8 caçadas e monstros conferem com o config/game.php', () => {
  assert.equal(Object.keys(c.DATA.hunts).length, 8);
  assert.equal(c.DATA.monsters.stone_golem.hp, 2550);
  assert.equal(c.DATA.monsters.death_mage.hp, 2940);
  const key = c.DATA.monsters.death_mage.drops.find((d) => d.key === 'throne_key');
  assert.equal(key.chance, 0.002);
});

test('regras e classes são fixas (congeladas)', () => {
  assert.ok(Object.isFrozen(c.CLASSES) && Object.isFrozen(c.CLASSES.wizard) && Object.isFrozen(c.RULES) && Object.isFrozen(c.DATA));
  const before = c.CLASSES.wizard.eff;
  try { c.CLASSES.wizard.eff = 9; } catch { /* modo estrito lança; modo normal ignora */ }
  assert.equal(c.CLASSES.wizard.eff, before);
  assert.equal(c.CLASSES.wizard.eff, 1.15);
  assert.equal(c.CLASSES.warrior.taken, 1.0);
  assert.equal(c.RULES.hit, 0.95);
});

test('Mago nível 111: dano, HP e defesa batem com o painel do jogo', () => {
  assert.equal(c.earned(), 44);
  const a = c.derive(c.S.A);
  assert.equal(a.D, 718);          // "Ataque" do painel
  assert.equal(a.maxHp, 1180);     // Vida do painel
  assert.equal(a.effDef, 500);     // Defesa do painel
  assert.equal(a.actionMs, 1395);
  assert.equal(a.wait, 25);
  const b = c.derive(c.S.B);
  assert.equal(b.D, 840);
  assert.equal(b.maxHp, 940);
});

test('calibração: reproduz o painel real (XP/h e ouro/h) com folga de 2%', () => {
  const overhead = overheadFor();
  const a = c.metrics(c.S.A, overhead);
  assert.ok(Math.abs(a.killsH - 191) < 2, 'abates/h ' + a.killsH);
  assert.ok(Math.abs(a.xpH / 70958 - 1) < 0.02, 'XP/h ' + a.xpH);
  assert.ok(Math.abs((a.goldH + a.lootH) / 4526 - 1) < 0.05, 'ouro/h ' + (a.goldH + a.lootH));
});

// As marcas são compartilhadas por A e B: aqui usamos dano nv1 + XP nv2 no golem (o preset que o B tinha antes).
const withGolemMarks = (fn) => { const g = c.S.A.marks.stone_golem; g.dmg = 1; g.xp = 2; try { fn(); } finally { g.dmg = 0; g.xp = 0; } };

test('cenário B: golem cai em 3 golpes e o Mago da Morte em 4', () => withGolemMarks(() => {
  const hits = (monster, scenario) => {
    const dv = c.derive(scenario);
    const dm = c.MARK.dmg[scenario.marks[monster].dmg];
    return Math.ceil(c.DATA.monsters[monster].hp / Math.round(dv.D * (1 + dm / 100)));
  };
  assert.equal(hits('stone_golem', c.S.A), 4);
  assert.equal(hits('death_mage', c.S.A), 5);
  assert.equal(hits('stone_golem', c.S.B), 3);
  assert.equal(hits('death_mage', c.S.B), 4);
  const overhead = overheadFor();
  const a = c.metrics(c.S.A, overhead);
  const b = c.metrics(c.S.B, overhead);
  assert.ok(b.xpH > a.xpH, 'ganho de XP/h ' + (b.xpH / a.xpH));
}));

test('classes: passiva e mitigação seguem o config do jogo', () => {
  const original = c.S.cls;
  c.S.cls = 'warrior';
  assert.equal(c.derive(c.S.A).p, 0);
  assert.ok(Math.abs(c.derive(c.S.A).mitig - 0.04) < 1e-9);       // 8% de chance × 50% do dano
  assert.equal(c.derive(c.S.A).hpBase, 90 + 12 * 110);
  c.S.cls = 'archer';
  assert.equal(c.derive(c.S.A).p, 0);
  assert.ok(Math.abs(c.derive(c.S.A).mitig - 0.10) < 1e-9);       // esquiva total
  c.S.cls = 'wizard';
  assert.equal(c.derive(c.S.A).p, 0.10);
  assert.equal(c.derive(c.S.A).mitig, 0);
  c.S.cls = original;
});

test('marcas: custo e avisos de limite', () => withGolemMarks(() => {
  assert.equal(c.S.A.marks, c.S.B.marks);                           // um só conjunto de marcas
  assert.equal(c.marksCost(c.S.B), 200);                            // dano nv1 (50) + XP nv2 (150)
  assert.equal(c.marksWarnings(c.S.B).length, 0);
}));

test('marcas de defesa e velocidade de ataque: valores do jogo, custo e efeito', () => {
  assert.deepEqual([...c.MARK.ds], [0, 2, 5, 7]);
  assert.deepEqual([...c.MARK.sp], [0, 0.5, 1, 1.5]);
  const dv = c.derive(c.S.A);
  assert.ok(dv.effDefFor(7) > dv.effDefFor(0));
  assert.equal(dv.effDefFor(0), dv.effDef);
  assert.ok(dv.actionMsFor(1.5) < dv.actionMsFor(0));
  const monster = Object.keys(c.S.A.marks)[0];
  const marks = c.S.A.marks[monster];
  const before = c.simulate(c.S.A).actSecPerEnc;
  Object.keys(c.S.A.marks).forEach((m) => { c.S.A.marks[m].sp = 3; });
  const after = c.simulate(c.S.A).actSecPerEnc;
  assert.equal(c.marksCost(c.S.A), 300 * Object.keys(c.S.A.marks).length);
  Object.keys(c.S.A.marks).forEach((m) => { c.S.A.marks[m].sp = 0; });
  assert.ok(after < before, 'vel. de ataque reduz o tempo de ação por encontro');
  assert.equal(marks.sp, 0);
});

test('dano depois da defesa segue a regra do jogo (damageAfterDefense)', () => {
  // defesa >= 2x o ataque: 0 ou 1 conforme o sorteio
  assert.equal(c.dmgAfterDef(100, 200, 0.2), 0);
  assert.equal(c.dmgAfterDef(100, 200, 0.8), 1);
  // defesa menor que o ataque: ceil(ataque - defesa * (0,95 + 0,05 * sorteio))
  assert.equal(c.dmgAfterDef(100, 50, 0), Math.ceil(100 - 50 * 0.95));
  assert.equal(c.dmgAfterDef(100, 50, 1), Math.ceil(100 - 50));
  // entre as duas faixas: vazamento de no máximo 5% do ataque, nunca menos de 1
  assert.equal(c.dmgAfterDef(1000, 1000, 1), 50);
  assert.equal(c.dmgAfterDef(1000, 1999, 0.0001), 1);
  assert.equal(c.dmgAfterDef(0, 10, 0.5), 0);
});

test('comida: come 1 por ação e só quando falta HP igual à cura', () => {
  const r = { N: 1, petMaxHp: 0, ev: { p: [30, 30, 30, 30], q: [null, null, null, null] } };
  // vida 100, cura 70: 100 -> 70 -> 40 (falta 60, não come) -> 10 (falta 90, come +70 = 80) -> 50 (falta 50)
  const cf = c.countFoods(r, 70, 100);
  assert.equal(cf.player, 1);
  assert.equal(cf.playerDeaths, 0);
  // comida mais fraca gasta mais
  assert.ok(c.countFoods(r, 10, 100).player > cf.player);
  // dano maior que a vida conta como morte
  const dead = c.countFoods({ N: 1, petMaxHp: 0, ev: { p: [150], q: [null] } }, 70, 100);
  assert.equal(dead.playerDeaths, 1);
});

test('comida do pet: morre e não volta na mesma caçada', () => {
  const r = { N: 1, petMaxHp: 100, ev: { p: [0, 0, 0], q: [[30], [30], [200]] } };
  const cf = c.countFoods(r, 20, 1000);
  assert.equal(cf.petLives, 1);
  assert.ok(cf.petLifeEats >= 1);
  const over = c.petFoodsOver(cf, 10, 8); // 10 ações por hora: a vida dura menos de 8 h
  assert.equal(over.foods, cf.petLifeEats);
  assert.ok(over.lifeHours < 8);
  // pet que nunca morre gasta em proporção ao tempo
  const sem = c.countFoods({ N: 1, petMaxHp: 1000, ev: { p: [0, 0], q: [[100], [100]] } }, 50, 1000);
  assert.equal(sem.petLives, 0);
  assert.ok(c.petFoodsOver(sem, 10, 8).foods > 0);
});

test('simulação: dano recebido e eventos para a comida', () => {
  const r = c.simulate(c.S.A, 2000);
  assert.equal(r.ev.p.length, r.ev.q.length);
  assert.ok(r.dmgPerEnc > 0);
  assert.ok(r.petMaxHp === c.PETS[c.S.petRarity].baseHp + c.S.petLevel * c.PETS[c.S.petRarity].hpPerLevel);
  // melhor defesa, menos dano
  const antes = r.dmgPerEnc; const def = c.S.itemsDef; c.S.itemsDef = 0;
  const pior = c.simulate(c.S.A, 2000).dmgPerEnc; c.S.itemsDef = def;
  assert.ok(pior > antes);
});
