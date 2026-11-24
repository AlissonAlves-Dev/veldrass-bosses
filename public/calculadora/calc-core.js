// Regras fixas, classes e simulação da calculadora. Sem acesso ao DOM: é coberto por calc.test.mjs.
const nm = k => NAMES[k] || (DATA.monsters[k]&&DATA.monsters[k].name) || k;
const inm = k => ITEMNAMES[k] || k;
const MARK = {dmg:[0,2,5,7], xp:[0,2,3,5], cc:[0,1,3,5], cd:[0,2,5,7], ds:[0,2,5,7], sp:[0,0.5,1,1.5]};
const MARK_TYPES = ['dmg','xp','cc','cd','ds','sp'];
const COST = [0,50,150,300];
const STAGEXP = [0,0,2,3,4,5];
const fmt = (n,d=0)=> isFinite(n)? n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}) : '—';

// ---------- regras e classes FIXAS (config/game.php) — congeladas, sem campo de edição ----------
const RULES = {hit:0.95, skillPerLevel:0.015, actionBaseMs:1500, actionMinMs:1000, searchBaseSec:30, maxEfficiency:90, hpPerPoint:10, passivePerPoint:0.1,
  levelsPerStep:5, pointsPerStep:2, maxHuntHours:8, cycleOverheadSec:1.6, // espera extra por ciclo (latência e preparo): medida num painel real de Mago nível 111 com 191 abates/h
   encounterMin:1, encounterMax:3, maxMarksPerMonster:2, removeEliteGold:30000};
const CLASSES = {
  warrior:{nome:'Guerreiro',elite:'Cavaleiro',eff:1.0,taken:1.0,hpBase:90,hpLvl:12,skill:'Espada',skillMod:1.10,arma:'Espada + escudo',
    passiva:{nome:'Bloqueio',chance:8,tipo:'block',desc:'Com escudo equipado, bloqueia 50% do dano de um golpe.'}},
  archer:{nome:'Arqueiro',elite:'Patrulheiro',eff:1.10,taken:1.0,hpBase:75,hpLvl:9,skill:'Arqueria',skillMod:1.10,arma:'Arco',
    passiva:{nome:'Vantagem à distância',chance:10,tipo:'dodge',desc:'Com arco, esquiva totalmente de alguns golpes.'}},
  wizard:{nome:'Mago',elite:'Bruxo',eff:1.15,taken:1.15,hpBase:60,hpLvl:8,skill:'Magia',skillMod:1.10,arma:'Cajado (magia)',
    passiva:{nome:'Splash mágico',chance:10,tipo:'splash',desc:'Chance de repetir o mesmo dano em todos os outros alvos vivos do encontro.'}}
};
function deepFreeze(o){ Object.values(o).forEach(v=>{ if(v&&typeof v==='object') deepFreeze(v); }); return Object.freeze(o); }
// Pets (config/pets.php). Nível efetivo = nível + 10 por estrela. Vida = base + nível efetivo × por nível; defesa do próprio pet = nível efetivo × defesa por nível.
// Cada bônus que o pet tem vale: nível efetivo × stat_per_level da raridade × multiplicador do bônus (PetService::baseBonuses). Quantos bônus: bonus_count da raridade.
const PETS = {
  none:{nome:'Sem pet',baseHp:0,hpPerLevel:0,defPerLevel:0,statPerLevel:0,bonusCount:0},
  Uncommon:{nome:'Incomum',baseHp:80,hpPerLevel:6,defPerLevel:1.4,statPerLevel:0.10,bonusCount:2},
  Rare:{nome:'Raro',baseHp:100,hpPerLevel:8,defPerLevel:1.6,statPerLevel:0.15,bonusCount:3},
  Epic:{nome:'Épico',baseHp:120,hpPerLevel:10,defPerLevel:1.8,statPerLevel:0.20,bonusCount:4},
  Legendary:{nome:'Lendário',baseHp:150,hpPerLevel:12,defPerLevel:2.0,statPerLevel:0.25,bonusCount:5}
};
const PET_BONUS = {
  attack:{nome:'Ataque',mult:1,field:'petAtk',unit:''},
  defense:{nome:'Defesa',mult:1,field:'petDef',unit:''},
  critical_chance_percent:{nome:'Chance de crítico',mult:0.25,field:'petCrit',unit:'%'},
  critical_damage_percent:{nome:'Dano crítico',mult:1,field:'petCritDmg',unit:'%'},
  attack_speed_percent:{nome:'Velocidade de ataque',mult:0.25,field:'petSpeed',unit:'%'},
  attack_skill:{nome:'Skill de ataque',mult:1,field:'petAtkSkill',unit:' níveis'},
  defense_skill:{nome:'Skill de defesa',mult:1,field:'petDefSkill',unit:' níveis'}
};
const petEffLevel = () => Math.max(0, Math.floor(S.petLevel||0)) + Math.max(0, Math.min(5, Math.floor(S.petStars||0))) * 10;
// Valor de cada bônus escolhido, como o jogo calcula (arredondado em 2 casas).
function petBonusValues(rarity, effLevel, keys){
  const p = PETS[rarity], out = {}; if(!p || p.statPerLevel<=0) return out;
  (keys||[]).forEach(k=>{ const b=PET_BONUS[k]; if(b) out[k]=Math.round(effLevel*p.statPerLevel*b.mult*100)/100; });
  return out;
}
// Guarda em S os bônus do pet que a calculadora usa (ataque, defesa, crítico, velocidade e skills).
function applyPet(){
  const p = PETS[S.petRarity]; const max = p ? p.bonusCount : 0;
  S.petKeys = (S.petKeys||[]).filter(k=>PET_BONUS[k]).slice(0,max);
  const v = petBonusValues(S.petRarity, petEffLevel(), S.petKeys);
  Object.entries(PET_BONUS).forEach(([k,b])=>{ S[b.field] = v[k] || 0; });
}
const PET_HIT_CHANCE = 0.30; // chance de o pet ser atacado a cada ataque de monstro (BattleSimulationService::applyPetBattleDamage)
// Na caçada o dano que o pet leva, depois da defesa dele, cai 70% (pets.damage_reduction_percent; PetService::reducedDamageTaken, arredonda para cima). Vale desde 2026-11-23.
const PET_DAMAGE_REDUCTION_PERCENT = 70;
const petReducedDamage = d => Math.max(0, Math.ceil(Math.max(0, d) * (100 - PET_DAMAGE_REDUCTION_PERCENT) / 100));
[RULES,CLASSES,DATA,MARK,COST,STAGEXP,PETS].forEach(deepFreeze);
const CLS = () => CLASSES[S.cls];
const earned = () => Math.floor(Math.max(1,S.level)/RULES.levelsPerStep)*RULES.pointsPerStep;
// ---------- estado ----------
const S = {
  cls:'wizard', level:111, weapon:231, petAtk:0, magic:83, magicBonus:11, dmgPct:0, critChance:7, critMult:181, atkSpeed:7,
  petCrit:0, petCritDmg:0, petSpeed:0, petAtkSkill:0, petDefSkill:0,
  petRarity:'Legendary', petLevel:62, petStars:5, petKeys:['attack','defense'], // padrão: efetivo 112 → ataque 28 e defesa 28
  itemsDef:175, petDef:0, shield:83, shieldBonus:0, defPct:0,
  hunt:'forgotten_keep', huntEff:17.2, potionEff:0, amuletEff:0, xpGlobal:0, lootRate:1, fragments:false,
  boostMon:'', boostXp:0, boostLoot:0, target:'throne_key', horizon:8,
  heal:70, stock:400,
  parts:{}, partsOn:{}, // detalhe por equipamento (campo → slot → valor) e quais campos estão abertos
  active:'A', // cenário ativo (o que o jogador usa hoje): base da calibração e das comparações
  A:{atk:0,def:20,hp:24,pas:0,marks:{}},
  B:{atk:44,def:0,hp:0,pas:0,marks:{}}
};
function monsKeys(){ return Object.keys(DATA.hunts[S.hunt].weights); }
function emptyMarks(){ const o={}; monsKeys().forEach(m=>o[m]={dmg:0,xp:0,cc:0,cd:0,ds:0,sp:0,stage:0}); return o; }
// Marcas do Bestiário: um só conjunto, compartilhado pelos cenários A e B (mesmo objeto).
function resetMarks(){ const m=emptyMarks(); S.A.marks=m; S.B.marks=m; }
resetMarks();
applyPet();

// ---------- simulação ----------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function derive(sc){
  const c=CLS();
  const skillMult = 1+RULES.skillPerLevel*(S.magic+S.magicBonus+Math.floor(S.petAtkSkill));
  const D = Math.round((S.weapon+S.petAtk+sc.atk)*skillMult*c.eff*(1+S.dmgPct/100));
  // sp = bônus de velocidade de ataque da marca do Bestiário (%), da espécie-alvo do encontro.
  const actionMsFor = sp => Math.max(RULES.actionMinMs, Math.round(RULES.actionBaseMs*(1-(S.atkSpeed+S.petSpeed+sp)/100)));
  const actionMs = actionMsFor(0);
  const eff = Math.min(RULES.maxEfficiency, S.huntEff+S.potionEff+S.amuletEff);
  const wait = Math.max(1, Math.ceil(RULES.searchBaseSec*(1-eff/100)));
  const passivePct = Math.min(100, c.passiva.chance+sc.pas*RULES.passivePerPoint);
  const p = c.passiva.tipo==='splash' ? passivePct/100 : 0;
  const mitig = c.passiva.tipo==='block' ? 0.5*passivePct/100 : (c.passiva.tipo==='dodge' ? passivePct/100 : 0);
  const hpBase = c.hpBase + c.hpLvl*(Math.max(1,S.level)-1);
  const maxHp = hpBase+sc.hp*RULES.hpPerPoint;
  const shieldMult = 1+RULES.skillPerLevel*(S.shield+S.shieldBonus+Math.floor(S.petDefSkill));
  // ds = bônus de defesa % da marca do Bestiário contra a espécie que ataca.
  const effDefFor = ds => Math.floor((S.itemsDef+sc.def+S.petDef)*(1+(S.defPct+ds)/100)*shieldMult);
  const effDef = effDefFor(0);
  return {D,skillMult,actionMs,actionMsFor,effDefFor,wait,p,passivePct,mitig,hpBase,maxHp,effDef,eff};
}
// Dano de um ataque depois da defesa, igual ao BattleSimulationService::damageAfterDefense (roll em [0,1)).
function dmgAfterDef(atk, def, roll){
  if(atk<=0) return 0;
  def=Math.max(0,def);
  if(def>=atk*2) return roll<0.5?0:1;
  if(def<atk) return Math.max(0,Math.ceil(atk-def*(0.95+roll*0.05)));
  const prog=Math.min(1,Math.max(0,(def-atk)/Math.max(1,atk)));
  const maxLeak=Math.max(1,Math.ceil(atk*0.05));
  return Math.max(1,Math.ceil(roll*Math.max(1,Math.ceil(maxLeak*(1-prog)))));
}
// Quantas comidas são gastas com uma comida de cura `heal`: come 1 por ação, só quando falta pelo menos `heal` de HP (consumeFoodIfNeeded).
// Usa os golpes sorteados em simulate(). Jogador: se o HP chega a 0, conta uma morte e volta ao máximo.
// Pet: morto, não volta na mesma caçada. Por isso medimos a "vida" do pet (comidas gastas e ações até morrer) e extrapolamos em petFoodsOver().
function countFoods(r, heal, maxHp){
  const ev=r.ev, petMax=r.petMaxHp, n=ev.p.length; let hp=maxHp, ph=petMax, eats=0, deaths=0, petEats=0, lifeEats=0, lifeStart=0, lives=0, sumLifeEats=0, sumLifeActs=0;
  for(let i=0;i<n;i++){
    const q=ev.q[i];
    if(q){ for(let j=0;j<q.length;j++){ ph-=q[j];
      if(ph<=0){ lives++; sumLifeEats+=lifeEats; sumLifeActs+=i-lifeStart+1; ph=petMax; lifeEats=0; lifeStart=i+1; }
      else if(heal>0&&petMax-ph>=heal){ ph=Math.min(petMax,ph+heal); petEats++; lifeEats++; } } }
    hp-=ev.p[i];
    if(hp<=0){ deaths++; hp=maxHp; } else if(heal>0&&maxHp-hp>=heal){ hp=Math.min(maxHp,hp+heal); eats++; }
  }
  return {player:eats/r.N, playerDeaths:deaths/r.N, petLives:lives, petLifeEats:lives?sumLifeEats/lives:0, petLifeActs:lives?sumLifeActs/lives:0, petEatsPerAct:n?petEats/n:0, actsPerEnc:n/r.N};
}
// Comidas do pet em `hours` horas de caçada, com `actsH` ações por hora. Pet morto não volta: gasta as comidas de uma vida e para.
function petFoodsOver(cf, actsH, hours){
  if(!cf.petLives) return {foods:cf.petEatsPerAct*actsH*hours, lifeHours:Infinity};
  const lifeHours=cf.petLifeActs/actsH;
  return {foods: lifeHours>=hours ? cf.petLifeEats*hours/lifeHours : cf.petLifeEats, lifeHours};
}
function simulate(sc, N=30000){
  const dv=derive(sc), H=DATA.hunts[S.hunt], keys=Object.keys(H.weights), tw=keys.reduce((a,k)=>a+H.weights[k],0);
  const rnd=mulberry32(20261120);
  // Sorteios de defesa e de ataque ao pet usam outra sequência, para não mexer nos resultados de ataque/abates.
  const rnd2=mulberry32(20261122), C=CLS(), pet=PETS[S.petRarity]||PETS.none, effLv=petEffLevel(), petOn=S.petRarity!=='none'&&effLv>0&&!!PETS[S.petRarity];
  const petMaxHp=petOn?pet.baseHp+effLv*pet.hpPerLevel:0, petOwnDef=petOn?Math.max(1,Math.round(effLv*pet.defPerLevel)):0;
  const defBy=Object.fromEntries(keys.map(k=>[k,dv.effDefFor(MARK.ds[(sc.marks[k]||{ds:0}).ds||0])]));
  const evP=[], evQ=[]; let dmgSum=0, petDmgSum=0;
  const pick=()=>{let r=rnd()*tw;for(const k of keys){r-=H.weights[k];if(r<0)return k}return keys[keys.length-1]};
  const mk=m=>sc.marks[m]||{dmg:0,xp:0,cc:0,cd:0,ds:0,sp:0,stage:0};
  let acts=0, actSec=0, attacks=0; const atkBy=Object.fromEntries(keys.map(k=>[k,0])); const kills=Object.fromEntries(keys.map(k=>[k,0]));
  for(let t=0;t<N;t++){
    const n=RULES.encounterMin+Math.floor(rnd()*(RULES.encounterMax-RULES.encounterMin+1)); const ms=Array.from({length:n},pick); const hp=ms.map(m=>DATA.monsters[m].hp);
    // A duração da ação é fixada pela espécie do primeiro monstro do encontro (BattleQueueService).
    const actMs=dv.actionMsFor(MARK.sp[mk(ms[0]).sp]);
    while(hp.some(h=>h>0)){
      acts++; actSec+=actMs/1000;
      const i=hp.findIndex(h=>h>0), pm=mk(ms[i]);
      const hit=rnd()<RULES.hit;
      const cc=(S.critChance+S.petCrit)/100+MARK.cc[pm.cc]/100;
      const isc=hit&&rnd()<cc;
      const dmg=isc?Math.round(dv.D*((S.critMult+S.petCritDmg)/100+MARK.cd[pm.cd]/100)):dv.D;
      if(hit) hp[i]=Math.max(0,hp[i]-Math.round(dmg*(1+MARK.dmg[pm.dmg]/100)));
      if(rnd()<dv.p){ for(let k=0;k<hp.length;k++) if(k!==i&&hp[k]>0) hp[k]=Math.max(0,hp[k]-Math.round(dmg*(1+MARK.dmg[mk(ms[k]).dmg]/100))); }
      let pdmg=0, hits=null;
      for(let k=0;k<hp.length;k++) if(hp[k]>0){
        attacks++; atkBy[ms[k]]++;
        const m=ms[k], atk=DATA.monsters[m].attack; let inc=atk, dodged=false;
        if(C.passiva.tipo==='block'&&rnd2()<dv.passivePct/100) inc=Math.floor(atk*0.5);
        else if(C.passiva.tipo==='dodge'&&rnd2()<dv.passivePct/100) dodged=true;
        if(!dodged){ const d=dmgAfterDef(inc,defBy[m],rnd2()); if(d>0) pdmg+=Math.max(1,Math.ceil(d*C.taken)); }
        if(petOn&&rnd2()<PET_HIT_CHANCE){ (hits||(hits=[])).push(petReducedDamage(dmgAfterDef(atk,petOwnDef,rnd2()))); }
      }
      evP.push(pdmg); evQ.push(hits); dmgSum+=pdmg; if(hits) petDmgSum+=hits.reduce((a,b)=>a+b,0);
    }
    ms.forEach(m=>kills[m]++);
  }
  const A=acts/N, killsPerEnc=Object.fromEntries(keys.map(k=>[k,kills[k]/N]));
  return {dv, actsPerEnc:A, actSecPerEnc:actSec/N, N, ev:{p:evP,q:evQ}, petMaxHp, petOwnDef, petEffLv:effLv, dmgPerEnc:dmgSum/N, petDmgPerEnc:petDmgSum/N, attacksPerEnc:attacks/N, attacksBy:Object.fromEntries(keys.map(k=>[k,atkBy[k]/N])), killsPerEnc};
}
function metrics(sc, overhead){
  const r=simulate(sc), dv=r.dv, keys=Object.keys(r.killsPerEnc);
  const cycle = dv.wait + overhead + r.actSecPerEnc;
  const encH=3600/cycle;
  let xp=0, gold=0, loot=0, lootFrag=0; const dropRate={};
  keys.forEach(m=>{
    const mon=DATA.monsters[m], mark=sc.marks[m]||{dmg:0,xp:0,cc:0,cd:0,ds:0,sp:0,stage:0}, kpe=r.killsPerEnc[m];
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
function marksCost(sc){ let c=0; Object.values(sc.marks).forEach(m=>MARK_TYPES.forEach(t=>c+=COST[m[t]])); return c; }
function marksWarnings(sc){
  const w=[], seen={};
  Object.entries(sc.marks).forEach(([m,v])=>{
    const n=MARK_TYPES.filter(t=>v[t]>0).length; if(n>2) w.push(`${nm(m)} tem ${n} marcas (máximo 2).`);
    MARK_TYPES.forEach(t=>{ if(v[t]>0){ const key=t+v[t]; if(seen[key]) w.push(`Marca ${labelOf(t)} nível ${v[t]} já está em ${nm(seen[key])} (cada marca é única).`); seen[key]=m; }});
  });
  return w;
}
const labelOf=t=>({dmg:'Dano',xp:'XP',cc:'Chance crít.',cd:'Dano crít.',ds:'Defesa',sp:'Vel. ataque'})[t];
