// Regras fixas, classes e simulação da calculadora. Sem acesso ao DOM: é coberto por calc.test.mjs.
const nm = k => NAMES[k] || (DATA.monsters[k]&&DATA.monsters[k].name) || k;
const inm = k => ITEMNAMES[k] || k;
const MARK = {dmg:[0,2,5,7], xp:[0,2,3,5], cc:[0,1,3,5], cd:[0,2,5,7]};
const COST = [0,50,150,300];
const STAGEXP = [0,0,2,3,4,5];
const fmt = (n,d=0)=> isFinite(n)? n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}) : '—';

// ---------- regras e classes FIXAS (config/game.php) — congeladas, sem campo de edição ----------
const RULES = {hit:0.95, skillPerLevel:0.015, actionBaseMs:1500, actionMinMs:1000, searchBaseSec:30, maxEfficiency:90, hpPerPoint:10, passivePerPoint:0.1,
  levelsPerStep:5, pointsPerStep:2, maxHuntHours:8, encounterMin:1, encounterMax:3, maxMarksPerMonster:2, removeEliteGold:30000};
const CLASSES = {
  warrior:{nome:'Guerreiro',elite:'Cavaleiro',eff:1.0,taken:1.0,hpBase:90,hpLvl:12,skill:'Espada',skillMod:1.10,arma:'Espada + escudo',
    passiva:{nome:'Bloqueio',chance:8,tipo:'block',desc:'Com escudo equipado, bloqueia 50% do dano de um golpe.'}},
  archer:{nome:'Arqueiro',elite:'Patrulheiro',eff:1.10,taken:1.0,hpBase:75,hpLvl:9,skill:'Arqueria',skillMod:1.10,arma:'Arco',
    passiva:{nome:'Vantagem à distância',chance:10,tipo:'dodge',desc:'Com arco, esquiva totalmente de alguns golpes.'}},
  wizard:{nome:'Mago',elite:'Bruxo',eff:1.15,taken:1.15,hpBase:60,hpLvl:8,skill:'Magia',skillMod:1.10,arma:'Cajado (magia)',
    passiva:{nome:'Splash mágico',chance:10,tipo:'splash',desc:'Chance de repetir o mesmo dano em todos os outros alvos vivos do encontro.'}}
};
function deepFreeze(o){ Object.values(o).forEach(v=>{ if(v&&typeof v==='object') deepFreeze(v); }); return Object.freeze(o); }
[RULES,CLASSES,DATA,MARK,COST,STAGEXP].forEach(deepFreeze);
const CLS = () => CLASSES[S.cls];
const earned = () => Math.floor(Math.max(1,S.level)/RULES.levelsPerStep)*RULES.pointsPerStep;
// ---------- estado ----------
const S = {
  cls:'wizard', level:111, weapon:231, petAtk:28, magic:83, magicBonus:11, dmgPct:0, critChance:7, critMult:181, atkSpeed:7,
  itemsDef:175, petDef:28, shield:83, shieldBonus:0, defPct:0,
  hunt:'forgotten_keep', huntEff:17.2, potionEff:0, amuletEff:0, observedKills:191, xpGlobal:0, lootRate:1, fragments:false,
  boostMon:'', boostXp:0, boostLoot:0, target:'throne_key', horizon:8,
  heal:70, stock:400, obsFoods:41,
  A:{atk:0,def:20,hp:24,pas:0,marks:{}},
  B:{atk:44,def:0,hp:0,pas:0,marks:{}}
};
function monsKeys(){ return Object.keys(DATA.hunts[S.hunt].weights); }
function emptyMarks(){ const o={}; monsKeys().forEach(m=>o[m]={dmg:0,xp:0,cc:0,cd:0,stage:0}); return o; }
function resetMarks(){ S.A.marks=emptyMarks(); S.B.marks=emptyMarks(); const g=monsKeys().find(k=>k==='stone_golem'); if(g){ S.B.marks[g].dmg=1; S.B.marks[g].xp=2; } }
resetMarks();

// ---------- simulação ----------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function derive(sc){
  const c=CLS();
  const skillMult = 1+RULES.skillPerLevel*(S.magic+S.magicBonus);
  const D = Math.round((S.weapon+S.petAtk+sc.atk)*skillMult*c.eff*(1+S.dmgPct/100));
  const actionMs = Math.max(RULES.actionMinMs, Math.round(RULES.actionBaseMs*(1-S.atkSpeed/100)));
  const eff = Math.min(RULES.maxEfficiency, S.huntEff+S.potionEff+S.amuletEff);
  const wait = Math.max(1, Math.ceil(RULES.searchBaseSec*(1-eff/100)));
  const passivePct = Math.min(100, c.passiva.chance+sc.pas*RULES.passivePerPoint);
  const p = c.passiva.tipo==='splash' ? passivePct/100 : 0;
  const mitig = c.passiva.tipo==='block' ? 0.5*passivePct/100 : (c.passiva.tipo==='dodge' ? passivePct/100 : 0);
  const hpBase = c.hpBase + c.hpLvl*(Math.max(1,S.level)-1);
  const maxHp = hpBase+sc.hp*RULES.hpPerPoint;
  const shieldMult = 1+RULES.skillPerLevel*(S.shield+S.shieldBonus);
  const effDef = Math.floor((S.itemsDef+sc.def+S.petDef)*(1+S.defPct/100)*shieldMult);
  return {D,skillMult,actionMs,wait,p,passivePct,mitig,hpBase,maxHp,effDef,eff};
}
function simulate(sc, N=30000){
  const dv=derive(sc), H=DATA.hunts[S.hunt], keys=Object.keys(H.weights), tw=keys.reduce((a,k)=>a+H.weights[k],0);
  const rnd=mulberry32(20261120);
  const pick=()=>{let r=rnd()*tw;for(const k of keys){r-=H.weights[k];if(r<0)return k}return keys[keys.length-1]};
  const mk=m=>sc.marks[m]||{dmg:0,xp:0,cc:0,cd:0,stage:0};
  let acts=0, attacks=0; const kills=Object.fromEntries(keys.map(k=>[k,0]));
  for(let t=0;t<N;t++){
    const n=RULES.encounterMin+Math.floor(rnd()*(RULES.encounterMax-RULES.encounterMin+1)); const ms=Array.from({length:n},pick); const hp=ms.map(m=>DATA.monsters[m].hp);
    while(hp.some(h=>h>0)){
      acts++;
      const i=hp.findIndex(h=>h>0), pm=mk(ms[i]);
      const hit=rnd()<RULES.hit;
      const cc=S.critChance/100+MARK.cc[pm.cc]/100;
      const isc=hit&&rnd()<cc;
      const dmg=isc?Math.round(dv.D*(S.critMult/100+MARK.cd[pm.cd]/100)):dv.D;
      if(hit) hp[i]=Math.max(0,hp[i]-Math.round(dmg*(1+MARK.dmg[pm.dmg]/100)));
      if(rnd()<dv.p){ for(let k=0;k<hp.length;k++) if(k!==i&&hp[k]>0) hp[k]=Math.max(0,hp[k]-Math.round(dmg*(1+MARK.dmg[mk(ms[k]).dmg]/100))); }
      attacks+=hp.filter(h=>h>0).length;
    }
    ms.forEach(m=>kills[m]++);
  }
  const A=acts/N, killsPerEnc=Object.fromEntries(keys.map(k=>[k,kills[k]/N]));
  return {dv, actsPerEnc:A, attacksPerEnc:attacks/N, killsPerEnc};
}
function metrics(sc, overhead){
  const r=simulate(sc), dv=r.dv, keys=Object.keys(r.killsPerEnc);
  const cycle = dv.wait + overhead + r.actsPerEnc*dv.actionMs/1000;
  const encH=3600/cycle;
  let xp=0, gold=0, loot=0, lootFrag=0; const dropRate={};
  keys.forEach(m=>{
    const mon=DATA.monsters[m], mark=sc.marks[m]||{dmg:0,xp:0,cc:0,cd:0,stage:0}, kpe=r.killsPerEnc[m];
    const boosted = S.boostMon===m;
    const xpMult = 1+(S.xpGlobal+STAGEXP[mark.stage]+MARK.xp[mark.xp]+(boosted?S.boostXp:0))/100;
    xp += kpe*mon.xp*xpMult;
    gold += kpe*mon.gold.chance*(mon.gold.min+mon.gold.max)/2;
    const lm = S.lootRate*(1+(boosted?S.boostLoot:0)/100);
    mon.drops.forEach(d=>{
      const perEnc=kpe*d.chance*lm;
      dropRate[d.key]=(dropRate[d.key]||0)+perEnc;
      if(d.value>=20000) lootFrag+=perEnc*d.value; else loot+=perEnc*d.value;
    });
  });
  const killsPerEnc=keys.reduce((a,k)=>a+r.killsPerEnc[k],0);
  const tgt=(dropRate[S.target]||0)*encH;
  return {dv, r, cycle, encH, killsH:encH*killsPerEnc, xpH:encH*xp, goldH:encH*gold, lootH:encH*loot, fragH:encH*lootFrag,
          totalGoldH:encH*(gold+loot+(S.fragments?lootFrag:0)), attacksH:encH*r.attacksPerEnc*(1-dv.mitig), tgtH:tgt};
}
function marksCost(sc){ let c=0; Object.values(sc.marks).forEach(m=>['dmg','xp','cc','cd'].forEach(t=>c+=COST[m[t]])); return c; }
function marksWarnings(sc){
  const w=[], seen={};
  Object.entries(sc.marks).forEach(([m,v])=>{
    const n=['dmg','xp','cc','cd'].filter(t=>v[t]>0).length; if(n>2) w.push(`${nm(m)} tem ${n} marcas (máximo 2).`);
    ['dmg','xp','cc','cd'].forEach(t=>{ if(v[t]>0){ const key=t+v[t]; if(seen[key]) w.push(`Marca ${labelOf(t)} nível ${v[t]} já está em ${nm(seen[key])} (cada marca é única).`); seen[key]=m; }});
  });
  return w;
}
const labelOf=t=>({dmg:'Dano',xp:'XP',cc:'Chance crít.',cd:'Dano crít.'})[t];
