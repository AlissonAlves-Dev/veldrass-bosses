// Calculadora de comida para world boss. Depende de calc-core.js (S, CLASSES, derive, fmt). Sem DOM: coberto por calc.test.mjs.
// Dados lidos do config/game.php do Veldrass (2026-11-21): world_bosses.*.combat e itens do tipo food. Atualize se o jogo for rebalanceado.
const BOSS_BATTLE_SEC = 600; // battle_duration_minutes = 10 para todos os bosses
const BOSSES = {
  darius_blackmane: {name:'Darius Blackmane', level:10, maxHp:10000, basic:{target:'all', ms:3000, dmg:4}},
  gorak_the_hunter: {name:'Gorak the Hunter', level:20, maxHp:20000, basic:{target:'all', ms:3500, dmg:56}},
  varkhan_blackblade: {name:'Varkhan Blackblade', level:30, maxHp:30000, basic:{target:'single', ms:2000, dmg:119}, area:{ms:8000, dmg:119}},
  morvanna_swamp_witch: {name:'Morvanna, Lady of the Mire', level:45, maxHp:40000, basic:{target:'all', ms:4500, dmg:230},
    effect:{tipo:'Veneno', chance:0.18, dmg:1, ms:5000, sec:300}},
  azrakar_the_abyssal: {name:'Azrakar, the Abyssal One', level:70, maxHp:50000, basic:{target:'single', ms:2000, dmg:392}, area:{ms:5000, dmg:392},
    effect:{tipo:'Fogo', chance:0.12, dmg:2, ms:5000, sec:300}}
};
const FOODS = {
  apple:{name:'Apple', heal:5}, cheese:{name:'Cheese', heal:8},
  cooked_minnow:{name:'Cooked Minnow', heal:10}, cooked_trout:{name:'Cooked Trout', heal:15}, cooked_salmon:{name:'Cooked Salmon', heal:20},
  cooked_catfish:{name:'Cooked Catfish', heal:25}, cooked_sturgeon:{name:'Cooked Sturgeon', heal:30}, cooked_tuna:{name:'Cooked Tuna', heal:35},
  cooked_pike:{name:'Cooked Pike', heal:45}, cooked_barracuda:{name:'Cooked Barracuda', heal:50}, cooked_carp:{name:'Cooked Carp', heal:60},
  cooked_perch:{name:'Cooked Perch', heal:70}
};
[BOSSES, FOODS].forEach(deepFreeze);
Object.assign(S, {bossKey:'azrakar_the_abyssal', bossFood:'cooked_perch', bossN:10, bossSc:'A'});

// Dano depois da defesa (CombatDefenseService::damageAfterDefense), esperado sobre o sorteio uniforme.
function bossHitAfterDefense(atk, def){
  if(atk<=0) return 0;
  if(def>=2*atk) return 0.5;
  let sum=0, n=200;
  for(let i=0;i<n;i++){ const roll=(i+0.5)/n;
    if(def<atk) sum+=Math.max(0, Math.ceil(atk-def*(0.95+roll*0.05)));
    else { const prog=Math.min(1,Math.max(0,(def-atk)/Math.max(1,atk))); const maxLeak=Math.max(1,Math.ceil(Math.ceil(atk*0.05)*(1-prog))); sum+=Math.max(1,Math.ceil(roll*maxLeak)); } }
  return sum/n;
}
// Dano esperado de um golpe do boss no jogador: passiva (bloqueio/esquiva) antes da defesa, multiplicador da classe depois.
function bossHitDamage(atk, dv){
  const c=CLS(), q=dv.passivePct/100, taken=hit=>hit>0?Math.max(1, Math.ceil(hit*c.taken)):0;
  const f=a=>taken(bossHitAfterDefense(a, dv.effDef));
  if(c.passiva.tipo==='block') return (1-q)*f(atk)+q*f(Math.ceil(atk/2));
  if(c.passiva.tipo==='dodge') return (1-q)*f(atk);
  return f(atk);
}
// Quantas comidas gastar numa luta de 10 min. Cada comida só é usada quando falta HP >= cura, então a conta é dano total ÷ cura.
function bossFoodNeeded(bossKey, sc, n, foodKey){
  const b=BOSSES[bossKey], dv=derive(S[sc]), N=Math.max(1,Math.floor(n)||1), heal=FOODS[foodKey].heal;
  const share=b.basic.target==='single'?1/N:1;
  const kinds=[{atk:b.basic.dmg, hits:Math.floor(BOSS_BATTLE_SEC*1000/b.basic.ms)*share}];
  if(b.area) kinds.push({atk:b.area.dmg, hits:Math.floor(BOSS_BATTLE_SEC*1000/b.area.ms)});
  let hitDmg=0, hitsOnMe=0;
  kinds.forEach(k=>{ hitDmg+=k.hits*bossHitDamage(k.atk,dv); hitsOnMe+=k.hits; });
  // Veneno/fogo: começa com a chance por golpe e dura 300 s sem acumular; dano por tick de 5 s.
  let effDmg=0; const e=b.effect;
  if(e&&hitsOnMe>0){ const rate=hitsOnMe/BOSS_BATTLE_SEC, wait=1/(e.chance*rate), active=e.sec/(e.sec+wait);
    effDmg=active*BOSS_BATTLE_SEC/(e.ms/1000)*e.dmg; }
  const total=hitDmg+effDmg;
  const maxHit=Math.max(...kinds.map(k=>Math.ceil(Math.max(0,k.atk-dv.effDef*0.95)*CLS().taken)));
  return {total, hitDmg, effDmg, hitsOnMe, qty:Math.ceil(total/heal), heal, maxHp:dv.maxHp, maxHit, dv};
}
