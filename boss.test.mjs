import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = (file) => readFileSync(new URL('./public/calculadora/' + file, import.meta.url), 'utf8');
const c = runInNewContext(
  read('data.js') + read('calc-core.js') + read('boss.js') +
  ';({ S, BOSSES, FOODS, bossHitAfterDefense, bossFoodNeeded });'
);

test('dados: 5 bosses e 12 comidas conferem com o config/game.php', () => {
  assert.equal(Object.keys(c.BOSSES).length, 5);
  assert.equal(c.BOSSES.azrakar_the_abyssal.basic.dmg, 392);
  assert.equal(c.BOSSES.varkhan_blackblade.area.ms, 8000);
  assert.equal(Object.keys(c.FOODS).length, 12);
  assert.equal(c.FOODS.cooked_perch.heal, 70);
});

test('defesa: sem defesa leva o golpe cheio; defesa >= 2x ataque quase zera', () => {
  assert.equal(c.bossHitAfterDefense(100, 0), 100);
  assert.equal(c.bossHitAfterDefense(100, 200), 0.5);
  assert.ok(c.bossHitAfterDefense(100, 50) < 100);
});

test('comida: cura maior pede menos comida; alvo único divide por participantes', () => {
  const a = c.bossFoodNeeded('varkhan_blackblade', 'A', 1, 'cooked_minnow');
  const b = c.bossFoodNeeded('varkhan_blackblade', 'A', 1, 'cooked_perch');
  assert.ok(a.qty > b.qty);
  const many = c.bossFoodNeeded('varkhan_blackblade', 'A', 10, 'cooked_perch');
  assert.ok(many.total < b.total);
  assert.equal(b.qty, Math.ceil(b.total / 70));
});

test('Morvanna tem veneno; Darius não', () => {
  assert.ok(c.bossFoodNeeded('morvanna_swamp_witch', 'A', 5, 'cooked_perch').effDmg > 0);
  assert.equal(c.bossFoodNeeded('darius_blackmane', 'A', 5, 'cooked_perch').effDmg, 0);
});
