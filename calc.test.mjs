import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Carrega só os dados e o núcleo da calculadora (sem DOM), no mesmo escopo, como no navegador.
const read = (file) => readFileSync(new URL('./public/calculadora/' + file, import.meta.url), 'utf8');
const c = runInNewContext(
  read('data.js') + read('calc-core.js') +
  ';({ S, CLASSES, RULES, DATA, MARK, derive, simulate, metrics, earned, marksCost, marksWarnings });'
);

// Mesma calibração da interface: ajusta a espera extra para o cenário A bater com os abates/h do painel.
function overheadFor() {
  const dv = c.derive(c.S.A);
  const r = c.simulate(c.S.A);
  const killsPerEnc = Object.values(r.killsPerEnc).reduce((a, b) => a + b, 0);
  return 3600 / (c.S.observedKills / killsPerEnc) - dv.wait - r.actsPerEnc * dv.actionMs / 1000;
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

test('cenário B: golem cai em 3 golpes e o Mago da Morte em 4', () => {
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
  assert.ok(b.xpH > a.xpH * 1.04 && b.xpH < a.xpH * 1.09, 'ganho de XP/h ' + (b.xpH / a.xpH));
});

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

test('marcas: custo e avisos de limite', () => {
  assert.equal(c.marksCost(c.S.B), 200);                            // dano nv1 (50) + XP nv2 (150)
  assert.equal(c.marksWarnings(c.S.B).length, 0);
});
