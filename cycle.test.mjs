import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Extrai apenas funções puras, sem depender do navegador nem instalar bibliotecas.
const source = readFileSync(new URL('./public/app.js', import.meta.url), 'utf8');
const data = readFileSync(new URL('./public/bosses.js', import.meta.url), 'utf8');
const constants = source.slice(0, source.indexOf('const dateFormatter'));
const logic = source.slice(source.indexOf('function positiveModulo'), source.indexOf('function locationIcon'));
const { bosses, getBossState, cycle } = runInNewContext(
  data + constants + logic + ';({ bosses, getBossState, cycle: CYCLE_DURATION });'
);

test('cinco referências em 2026 e ciclo de 490 minutos', () => {
  assert.equal(bosses.length, 5);
  assert.equal(cycle, 490 * 60000);
  for (const boss of bosses) assert.ok(boss.anchor.startsWith('2026-09-08T'));
});

for (const boss of bosses) {
  test(boss.name + ': fronteiras e repetição', () => {
    const expected = [[0,'entry'], [599999,'entry'], [600000,'battle'],
      [1199999,'battle'], [1200000,'wait'], [29399999,'wait'], [29400000,'entry']];
    for (const [offset, phase] of expected) {
      const state = getBossState(boss, boss.anchorMs + offset);
      assert.equal(state.phase, phase);
      assert.ok(state.remaining > 0);
      assert.ok(state.phaseElapsed >= 0 && state.phaseElapsed < state.phaseDuration);
    }
    assert.equal(getBossState(boss, boss.anchorMs - 1).phase, 'wait');
    assert.equal(getBossState(boss, boss.anchorMs + 10000 * cycle).phase, 'entry');
  });
}

test('Darius: próximo às 11:40 e quarto surgimento às 04:00 do dia seguinte', () => {
  const darius = bosses[0];
  assert.equal(getBossState(darius, darius.anchorMs).nextSpawn, Date.parse('2026-09-08T11:40:00-03:00'));
  assert.equal(darius.anchorMs + 3 * cycle, Date.parse('2026-09-09T04:00:00-03:00'));
});
