// Interface da calculadora (depende de data.js e calc-core.js).
// ---------- UI ----------
function numRow(parent,label,key,step=1,min=0,suffix=''){
  const row=document.createElement('div'); row.className='row';
  row.innerHTML=`<label>${label}</label>`;
  const i=document.createElement('input'); i.type='number'; i.step=step; i.min=min; i.value=S[key];
  i.oninput=()=>{ S[key]=parseFloat(i.value)||0; schedule(); };
  row.appendChild(i); parent.appendChild(row);
}
function buildChar(){
  const el=document.getElementById('char'); el.innerHTML='<h2>Personagem</h2>';
  const r=document.createElement('div'); r.className='row'; r.style.gridTemplateColumns='1fr 1fr'; r.innerHTML='<label>Classe</label>';
  const sel=document.createElement('select');
  sel.innerHTML=Object.entries(CLASSES).map(([k,v])=>'<option value="'+k+'">'+v.nome+'</option>').join(''); sel.value=S.cls;
  sel.onchange=()=>{ S.cls=sel.value; buildChar(); buildScenarios(); render(); };
  r.appendChild(sel); el.appendChild(r);
  const card=document.createElement('div'); card.id='classcard'; el.appendChild(card);
  const c=CLS();
  [['Nível do personagem','level',1,1],['Ataque da arma (já com aprimoramento)','weapon'],['Ataque do pet','petAtk'],['Nível de '+c.skill,'magic'],['Bônus de skill de '+c.skill+' (itens)','magicBonus'],
   ['Dano % extra (encantos)','dmgPct'],['Chance de crítico %','critChance',0.1],['Dano crítico % (como no painel)','critMult'],
   ['Velocidade de ataque %','atkSpeed',0.5],['Defesa dos itens (sem pontos/pet)','itemsDef'],['Defesa do pet','petDef'],['Nível de Escudo','shield']
  ].forEach(a=>numRow(el,a[0],a[1],a[2]||1,a[3]!==undefined?a[3]:0));
  const h=document.createElement('p'); h.className='hint'; h.textContent='Campos abaixo do card são do seu personagem (editáveis). Os modificadores da classe, marcados com cadeado, são fixos do jogo. Ao trocar de classe, ajuste arma, skills e defesa.'; el.appendChild(h);
}
function renderClassCard(a,b){
  const el=document.getElementById('classcard'); if(!el) return; const c=CLS();
  const pct=x=>fmt(x,1)+'%', L='<span class="lock" title="Valor fixo do jogo (não editável)">🔒</span>';
  const mit=x=>c.passiva.tipo==='splash'?'—':pct(x*100);
  const extra = c.passiva.tipo==='splash' ? 'splash em todos os alvos' : (c.passiva.tipo==='block'?'dano reduzido pela metade':'golpe evitado');
  el.innerHTML='<div class="ccard"><div class="chead"><b>'+c.nome+'</b><span class="tag">'+L+'elite: '+c.elite+'</span><span class="tag">'+L+'arma: '+c.arma+'</span></div>'
   +'<table class="fixed"><tr><th>Modificador</th><th>Valor</th></tr>'
   +'<tr><td>'+L+'Eficiência de ataque</td><td>× '+fmt(c.eff,2)+'</td></tr>'
   +'<tr><td>'+L+'Dano recebido</td><td>× '+fmt(c.taken,2)+'</td></tr>'
   +'<tr><td>'+L+'HP base</td><td>'+c.hpBase+' + '+c.hpLvl+' por nível → '+fmt(a.hpBase)+' no nível '+S.level+'</td></tr>'
   +'<tr><td>'+L+'Skill de arma</td><td>'+c.skill+' (XP de skill × '+fmt(c.skillMod,2)+')</td></tr>'
   +'<tr><td>'+L+'Pontos de atributo</td><td>'+earned()+' ('+RULES.pointsPerStep+' a cada '+RULES.levelsPerStep+' níveis)</td></tr>'
   +'<tr><td>'+L+'Passiva: '+c.passiva.nome+' (base)</td><td>'+pct(c.passiva.chance)+'</td></tr>'
   +'<tr><th colspan="2">Resultado com seus pontos (calculado)</th></tr>'
   +'<tr><td>Passiva efetiva</td><td>A '+pct(a.passivePct)+' · B '+pct(b.passivePct)+'</td></tr>'
   +'<tr><td>Mitigação de dano ('+extra+')</td><td>A '+mit(a.mitig)+' · B '+mit(b.mitig)+'</td></tr>'
   +'<tr><td>Dano por golpe</td><td>A '+fmt(a.D)+' · B '+fmt(b.D)+'</td></tr>'
   +'<tr><td>HP máximo</td><td>A '+fmt(a.maxHp)+' · B '+fmt(b.maxHp)+'</td></tr>'
   +'<tr><td>Defesa efetiva</td><td>A '+fmt(a.effDef)+' · B '+fmt(b.effDef)+'</td></tr></table>'
   +'<div class="sub">'+c.passiva.desc+'</div></div>';
}
function buildHunt(){
  const el=document.getElementById('huntbox'); el.innerHTML='<h2>Caçada e bônus</h2>';
  const r=document.createElement('div'); r.className='row'; r.innerHTML='<label>Caçada</label>';
  const sel=document.createElement('select'); sel.style.width='100%';
  Object.keys(DATA.hunts).forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=HUNTNAMES[k]||DATA.hunts[k].name;sel.appendChild(o)});
  sel.value=S.hunt; sel.onchange=()=>{S.hunt=sel.value; resetMarks(); S.boostMon=''; fixTarget(); buildHunt(); buildScenarios(); schedule();};
  r.style.gridTemplateColumns='1fr 1fr'; r.appendChild(sel); el.appendChild(r);
  [['Eficiência de Caça % (skill)','huntEff',0.1],['+ poção de batalha %','potionEff'],['+ amuleto/outros %','amuletEff'],['Abates/h observados (calibra o ciclo)','observedKills'],
   ['Bônus global de XP % (poção etc.)','xpGlobal'],['Taxa de loot (1 = normal)','lootRate',0.1]].forEach(a=>numRow(el,a[0],a[1],a[2]||1));
  // monstro do dia
  const b=document.createElement('div'); b.className='row'; b.style.gridTemplateColumns='1fr 1fr'; b.innerHTML='<label>Monstro do dia (boost)</label>';
  const bs=document.createElement('select'); bs.innerHTML='<option value="">— nenhum —</option>'+monsKeys().map(k=>`<option value="${k}">${nm(k)}</option>`).join('');
  bs.value=S.boostMon; bs.onchange=()=>{S.boostMon=bs.value;schedule()}; b.appendChild(bs); el.appendChild(b);
  numRow(el,'Boost: XP % (5–10)','boostXp'); numRow(el,'Boost: loot % (10–20)','boostLoot');
  // item alvo
  const drops=new Set(); monsKeys().forEach(m=>DATA.monsters[m].drops.forEach(d=>drops.add(d.key)));
  const t=document.createElement('div'); t.className='row'; t.style.gridTemplateColumns='1fr 1fr'; t.innerHTML='<label>Item alvo (ex.: chave)</label>';
  const ts=document.createElement('select'); ts.innerHTML=[...drops].map(k=>`<option value="${k}">${inm(k)}</option>`).join(''); ts.value=S.target; ts.onchange=()=>{S.target=ts.value;schedule()}; t.appendChild(ts); el.appendChild(t);
  numRow(el,'Horizonte do item alvo (h)','horizon');
  const f=document.createElement('div'); f.className='row'; f.style.gridTemplateColumns='1fr auto';
  f.innerHTML='<label>Contar fragmentos de fusão no ouro/h (loteria)</label>'; const c=document.createElement('input'); c.type='checkbox'; c.checked=S.fragments; c.style.width='auto'; c.onchange=()=>{S.fragments=c.checked;schedule()}; f.appendChild(c); el.appendChild(f);
  [['Cura da comida (perca = 70)','heal'],['Estoque de comida','stock'],['Comidas/h observadas hoje (cenário A)','obsFoods']].forEach(a=>numRow(el,a[0],a[1]));
  const h=document.createElement('p'); h.className='hint'; h.textContent='Espera entre encontros = 30 s × (1 − eficiência), arredondada para cima. Caçada máxima: 8 h.'; el.appendChild(h);
}
function fixTarget(){ const drops=new Set(); monsKeys().forEach(m=>DATA.monsters[m].drops.forEach(d=>drops.add(d.key))); if(!drops.has(S.target)) S.target=[...drops].find(k=>/key/.test(k))||[...drops][0]; }
function buildScenario(id,title){
  const sc=S[id], el=document.getElementById('sc'+id); el.innerHTML=`<h2>Cenário ${id} — ${title}</h2>`;
  const grid=document.createElement('div'); grid.id='pts'+id;
  [['Ataque','atk'],['Defesa','def'],['Vida','hp'],['Passiva ('+CLS().passiva.nome+')','pas']].forEach(([l,k])=>{
    const r=document.createElement('div'); r.className='row'; r.innerHTML=`<label>${l}</label>`;
    const i=document.createElement('input'); i.type='number'; i.min=0; i.value=sc[k]; i.oninput=()=>{sc[k]=Math.max(0,parseInt(i.value)||0); updatePts(id); schedule()}; r.appendChild(i); grid.appendChild(r);
  });
  el.appendChild(grid);
  const pts=document.createElement('div'); pts.className='pts'; pts.id='ptsinfo'+id; el.appendChild(pts);
  const mh=document.createElement('h3'); mh.textContent='Marcas do Bestiário (nível 0–3) e etapa'; el.appendChild(mh);
  const t=document.createElement('table'); t.className='mark';
  t.innerHTML='<tr><th>Monstro</th><th>Dano</th><th>XP</th><th>Crít.</th><th>D.crít.</th><th>Etapa</th></tr>';
  monsKeys().forEach(m=>{
    const tr=document.createElement('tr'); tr.innerHTML=`<td>${nm(m)}</td>`;
    ['dmg','xp','cc','cd'].forEach(ty=>{
      const td=document.createElement('td'); const s=document.createElement('select');
      s.innerHTML=MARK[ty].map((v,i)=>`<option value="${i}">${i===0?'—':'nv'+i+' (+'+v+'%)'}</option>`).join(''); s.value=sc.marks[m][ty];
      s.onchange=()=>{sc.marks[m][ty]=+s.value; updatePts(id); schedule()}; td.appendChild(s); tr.appendChild(td);
    });
    const td=document.createElement('td'); const s=document.createElement('select');
    s.innerHTML=STAGEXP.map((v,i)=>`<option value="${i}">${i}${v?` (+${v}% XP)`:''}</option>`).join(''); s.value=sc.marks[m].stage; s.onchange=()=>{sc.marks[m].stage=+s.value;schedule()}; td.appendChild(s); tr.appendChild(td);
    t.appendChild(tr);
  });
  el.appendChild(t);
  const w=document.createElement('div'); w.id='warn'+id; el.appendChild(w);
  const hh=document.createElement('p'); hh.className='hint'; hh.textContent='Etapa do Bestiário: bônus de XP por espécie (2/3/4/5%) conforme os abates. Máx. 2 marcas por monstro; cada marca (tipo+nível) fica em um monstro só; tirar marca de Elite custa 30 mil de ouro.'; el.appendChild(hh);
  updatePts(id);
}
function updatePts(id){
  const sc=S[id], used=sc.atk+sc.def+sc.hp+sc.pas, left=earned()-used, cost=marksCost(sc);
  document.getElementById('ptsinfo'+id).innerHTML=`<span>Pontos de atributo: <b class="${left<0?'warn':''}">${used}/${earned()}</b> (${left>=0?left+' livres':'excede '+(-left)})</span><span>Marcas: <b>${cost}</b> pts</span>`;
  const w=marksWarnings(sc); if(left<0) w.unshift('Você distribuiu mais pontos de atributo do que tem.');
  document.getElementById('warn'+id).innerHTML=w.map(x=>`<div class="warn">${x}</div>`).join('');
}
function buildScenarios(){ buildScenario('A','hoje'); buildScenario('B','proposto'); }

// ---------- resultado ----------
let timer=null; function schedule(){ clearTimeout(timer); timer=setTimeout(render,60); }
function delta(a,b,inv=false){ if(!isFinite(a)||a===0) return '<td class="d">—</td>'; const d=(b-a)/a*100; const good=inv?d<0:d>0; const cls=Math.abs(d)<0.05?'':(good?'pos':'neg'); return `<td class="d ${cls}">${d>0?'+':''}${fmt(d,1)}%</td>`; }
function render(){
  // calibração: overhead pelo cenário A
  updatePts('A'); updatePts('B');
  const dvA=derive(S.A), rA=simulate(S.A); renderClassCard(dvA, derive(S.B));
  let overhead=0;
  if(S.observedKills>0){ const kpe=Object.values(rA.killsPerEnc).reduce((a,b)=>a+b,0); overhead=3600/(S.observedKills/kpe)-dvA.wait-rA.actsPerEnc*dvA.actionMs/1000; }
  const A=metrics(S.A,overhead), B=metrics(S.B,overhead);
  const foodA=S.obsFoods, foodB=S.obsFoods*(B.attacksH/A.attacksH);
  const rows=[
   ['Dano por golpe (sem crítico)',A.dv.D,B.dv.D,0,false],
   ['Chance de splash % (só Mago)',A.dv.p*100,B.dv.p*100,1,false],
   ['Ações por encontro',A.r.actsPerEnc,B.r.actsPerEnc,2,true],
   ['Ciclo por encontro (s)',A.cycle,B.cycle,1,true],
   ['Abates/h',A.killsH,B.killsH,0,false],
   ['XP/h',A.xpH,B.xpH,0,false],
   ['Ouro solto/h',A.goldH,B.goldH,0,false],
   ['Loot vendido ao NPC/h'+(S.fragments?' (com fragmentos)':''),A.lootH+(S.fragments?A.fragH:0),B.lootH+(S.fragments?B.fragH:0),0,false],
   ['Ouro total/h',A.totalGoldH,B.totalGoldH,0,false],
   [`${inm(S.target)} por hora`,A.tgtH,B.tgtH,4,false],
   [`Horas esperadas por ${inm(S.target)}`,1/A.tgtH,1/B.tgtH,1,true],
   [`Chance de ≥1 ${inm(S.target)} em ${S.horizon} h`,(1-Math.exp(-A.tgtH*S.horizon))*100,(1-Math.exp(-B.tgtH*S.horizon))*100,0,false,'%'],
   ['HP máximo',A.dv.maxHp,B.dv.maxHp,0,false],
   ['Comidas/h (estimativa)',foodA,foodB,1,true],
  ];
  let h='<table><tr><th></th><th>A (hoje)</th><th>B (proposto)</th><th>Δ</th></tr>';
  rows.forEach(r=>{ h+=`<tr><td>${r[0]}</td><td>${fmt(r[1],r[3])}${r[5]||''}</td><td>${fmt(r[2],r[3])}${r[5]||''}</td>${delta(r[1],r[2],r[4])}</tr>`; });
  h+='</table>';
  // offline
  const off=(m,food)=>({xp:m.xpH*RULES.maxHuntHours,gold:m.totalGoldH*RULES.maxHuntHours,kills:m.killsH*RULES.maxHuntHours,food:food*RULES.maxHuntHours});
  const oA=off(A,foodA), oB=off(B,foodB);
  h+=`<h3>Caçada offline de 8 h (máximo do jogo)</h3><table><tr><th></th><th>A</th><th>B</th></tr>
   <tr><td>XP</td><td>${fmt(oA.xp)}</td><td>${fmt(oB.xp)}</td></tr>
   <tr><td>Ouro (solto + loot NPC)</td><td>${fmt(oA.gold)}</td><td>${fmt(oB.gold)}</td></tr>
   <tr><td>Abates</td><td>${fmt(oA.kills)}</td><td>${fmt(oB.kills)}</td></tr>
   <tr><td>Comidas necessárias (estoque: ${fmt(S.stock)})</td><td class="${oA.food>S.stock?'neg':''}">${fmt(oA.food)}</td><td class="${oB.food>S.stock?'neg':''}">${fmt(oB.food)}</td></tr>
   <tr><td>Horas de comida no estoque</td><td>${fmt(S.stock/foodA,1)}</td><td>${fmt(S.stock/foodB,1)}</td></tr></table>`;
  // defesa
  h+='<h3>Defesa efetiva vs. ataque dos monstros</h3><table><tr><th>Monstro</th><th>Ataque</th><th>A: def '+fmt(A.dv.effDef)+'</th><th>B: def '+fmt(B.dv.effDef)+'</th></tr>';
  const reg=(def,atk)=>{ if(def>=2*atk) return `<span class="good">0–1 por golpe</span>`; if(def<atk) return `<span class="warn">pesado (~${fmt(Math.ceil((atk-def*0.975)*CLS().taken))}/golpe)</span>`; const leak=Math.ceil(0.05*atk)*(2*atk-def)/atk; return `vazamento ~${fmt(Math.ceil(leak*CLS().taken))}/golpe`; };
  monsKeys().forEach(m=>{ const a=DATA.monsters[m].attack; h+=`<tr><td>${nm(m)}</td><td>${a}</td><td>${reg(A.dv.effDef,a)}</td><td>${reg(B.dv.effDef,a)}</td></tr>`; });
  h+='</table><p class="hint">Calibração: espera extra por ciclo (latência, preparo) = '+fmt(overhead,1)+' s, ajustada para o cenário A bater com os seus '+fmt(S.observedKills)+' abates/h. Comidas/h do cenário B = comidas/h de A × (ataques sofridos B ÷ A).</p>';
  document.querySelector('#results').innerHTML='<h2>Resultado</h2>'+h;
  // golpes para matar
  let g='<table><tr><th>Monstro</th><th>HP</th><th>Peso</th><th>A: golpes</th><th>A: falta p/ −1 golpe</th><th>B: golpes</th><th>B: falta p/ −1 golpe</th></tr>';
  const tw=Object.values(DATA.hunts[S.hunt].weights).reduce((a,b)=>a+b,0);
  monsKeys().forEach(m=>{
    const hp=DATA.monsters[m].hp, w=DATA.hunts[S.hunt].weights[m]/tw*100;
    const cell=(sc,dv)=>{ const dm=MARK.dmg[sc.marks[m].dmg]; const d=Math.round(dv.D*(1+dm/100)); const n=Math.ceil(hp/d);
      let gap='—'; if(n>1){ const need=hp/(n-1); const base=(need/(1+dm/100))/(dv.skillMult*CLS().eff*(1+S.dmgPct/100))-(S.weapon+S.petAtk+sc.atk); gap=base<=0?'0':'+'+Math.ceil(base)+' pts de ataque'; if(n-1<1) gap='—'; }
      return [`<td>${n} <span class="tag">${fmt(d)}/golpe</span></td>`,`<td>${gap}</td>`]; };
    const a=cell(S.A,A.dv), b=cell(S.B,B.dv);
    g+=`<tr><td>${nm(m)}</td><td>${fmt(hp)}</td><td>${fmt(w,0)}%</td>${a[0]}${a[1]}${b[0]}${b[1]}</tr>`;
  });
  g+='</table><p class="hint">Golpes sem crítico. "Falta" = pontos de ataque a mais (com a marca de dano atual) para o monstro cair em um golpe a menos; as marcas de dano contam por espécie.</p>';
  document.querySelector('#hits').innerHTML='<h2>Golpes para matar cada monstro</h2>'+g; saveState();
}
const STORE='veldrass-calc-v1';
const EDITABLE=['cls','level','weapon','petAtk','magic','magicBonus','dmgPct','critChance','critMult','atkSpeed','itemsDef','petDef','shield','shieldBonus','defPct','hunt','huntEff','potionEff','amuletEff','observedKills','xpGlobal','lootRate','fragments','boostMon','boostXp','boostLoot','target','horizon','heal','stock','obsFoods'];
function snapshot(){ const o={}; EDITABLE.forEach(k=>o[k]=S[k]); ['A','B'].forEach(id=>{const s=S[id]; o[id]={atk:s.atk,def:s.def,hp:s.hp,pas:s.pas,marks:s.marks};}); return o; }
function applyState(o){
  if(!o||typeof o!=='object') return;
  if(typeof o.cls==='string'&&CLASSES[o.cls]) S.cls=o.cls;
  if(typeof o.hunt==='string'&&DATA.hunts[o.hunt]) S.hunt=o.hunt;
  EDITABLE.forEach(k=>{ if(k==='cls'||k==='hunt'||!(k in o)) return;
    if(k==='boostMon'){ S[k]=(o[k]===''||(typeof o[k]==='string'&&monsKeys().includes(o[k])))?o[k]:''; }
    else if(k==='target'){ S[k]=String(o[k]); }
    else if(k==='fragments'){ S[k]=!!o[k]; }
    else { const n=Number(o[k]); if(isFinite(n)&&n>=0&&n<=10000000) S[k]=n; } });
  S.A.marks=emptyMarks(); S.B.marks=emptyMarks();
  ['A','B'].forEach(id=>{ const s=o[id]; if(!s||typeof s!=='object') return;
    ['atk','def','hp','pas'].forEach(k=>{ const n=parseInt(s[k]); if(isFinite(n)&&n>=0&&n<=10000) S[id][k]=n; });
    if(s.marks&&typeof s.marks==='object') monsKeys().forEach(m=>{ const mk=s.marks[m]; if(!mk||typeof mk!=='object') return;
      ['dmg','xp','cc','cd'].forEach(t=>{ const n=parseInt(mk[t]); if(n>=0&&n<=3) S[id].marks[m][t]=n; });
      const st=parseInt(mk.stage); if(st>=0&&st<=5) S[id].marks[m].stage=st; }); });
  fixTarget();
}
const encodeState=()=>btoa(unescape(encodeURIComponent(JSON.stringify(snapshot()))));
const decodeState=x=>JSON.parse(decodeURIComponent(escape(atob(x))));
function saveState(){ try{ if(typeof localStorage!=='undefined') localStorage.setItem(STORE,JSON.stringify(snapshot())); }catch(e){} }
function initState(){
  try{ let raw=null;
    if(typeof location!=='undefined'&&/^#s=/.test(location.hash)) raw=decodeState(location.hash.slice(3));
    else if(typeof localStorage!=='undefined'){ const t=localStorage.getItem(STORE); if(t) raw=JSON.parse(t); }
    if(raw) applyState(raw);
  }catch(e){}
}
function wireButtons(){
  const b1=document.getElementById('btnShare'), b2=document.getElementById('btnReset'); if(!b1||!b2||typeof location==='undefined') return;
  b1.onclick=()=>{ const url=location.href.split('#')[0]+'#s='+encodeState();
    const done=()=>{ b1.textContent='Link copiado!'; setTimeout(()=>b1.textContent='Copiar link com meus valores',2000); };
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done).catch(()=>prompt('Copie o link:',url)); else prompt('Copie o link:',url); };
  b2.onclick=()=>{ try{ localStorage.removeItem(STORE); }catch(e){} location.hash=''; location.reload(); };
}
function renderRules(){
  const el=document.getElementById('rulesbox'); if(!el) return;
  const mk=(t,v)=>'<tr><td>'+t+'</td><td>'+v+'</td></tr>';
  const cls=Object.values(CLASSES).map(c=>mk(c.nome+' — eficiência / dano recebido / HP / passiva','× '+fmt(c.eff,2)+' / × '+fmt(c.taken,2)+' / '+c.hpBase+' + '+c.hpLvl+' por nível / '+c.passiva.nome+' '+c.passiva.chance+'%')).join('');
  el.innerHTML='<details><summary>🔒 Regras fixas do jogo usadas nos cálculos (somente leitura)</summary><table class="rules">'
   +mk('Chance de acerto',fmt(RULES.hit*100)+'%')+mk('Duração base da ação',fmt(RULES.actionBaseMs/1000,1)+' s (mínimo '+fmt(RULES.actionMinMs/1000,1)+' s)')
   +mk('Espera base entre encontros',RULES.searchBaseSec+' s (redução máxima '+RULES.maxEfficiency+'%)')+mk('Monstros por encontro',RULES.encounterMin+' a '+RULES.encounterMax)
   +mk('Caçada máxima',RULES.maxHuntHours+' h')+mk('Bônus de dano por nível de skill de combate','+'+fmt(RULES.skillPerLevel*100,1)+'%')
   +mk('Ponto de atributo','ataque +1 · defesa +1 · vida +'+RULES.hpPerPoint+' HP · passiva +'+RULES.passivePerPoint+'%')+mk('Pontos de atributo ganhos',RULES.pointsPerStep+' a cada '+RULES.levelsPerStep+' níveis')
   +mk('Marcas do Bestiário — dano / XP / crítico / dano crítico','dano '+MARK.dmg.slice(1).join('/')+'% · XP '+MARK.xp.slice(1).join('/')+'% · crítico '+MARK.cc.slice(1).join('/')+'% · dano crít. '+MARK.cd.slice(1).join('/')+'%')
   +mk('Custo das marcas (nível 1/2/3)',COST.slice(1).join(' / ')+' pontos')+mk('Máximo de marcas por monstro',RULES.maxMarksPerMonster+' (remover de monstro Elite custa '+fmt(RULES.removeEliteGold)+' de ouro)')
   +mk('Bônus de XP por etapa do Bestiário (1 a 5)',STAGEXP.slice(1).join('% / ')+'%')+cls
   +'</table><p class="hint">Monstros e caçadas: lidos do config/game.php do repositório (valores de 2026-11-20). Se o jogo for rebalanceado, estes dados ficam desatualizados.</p></details>';
}
initState(); buildChar(); buildHunt(); buildScenarios(); renderRules(); wireButtons(); render();

// Cache offline compartilhado com o Boss Watch.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
