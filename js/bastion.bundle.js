"use strict";

const CONFIG = {
  tickMs: 100,
  seasonSeconds: 40,
  researchThreshold: 30,
  researchChoiceSeconds: 5,
  armySpeedCells: 2.15,
  aiIntervalSeconds: 2.8,
  upgradeCost: 15,
  baseSupply: 50,
  farmSupply: 35,
  soldierFoodCost: 0.45,
  soldierUpkeepPerSecond: 0.012,
  gridCols: 15,
  gridRows: 9
};

const BUILDINGS = {
  castle: { name: "Burg", icon: "🏰", capacity: 50, rate: 1.15, resource: "Soldaten" },
  farm: { name: "Farm", icon: "🌾", capacity: 40, rate: 2.5, resource: "Nahrung" },
  mine: { name: "Mine", icon: "⛏️", capacity: 20, rate: 1.05, resource: "Gold" },
  academy: { name: "Akademie", icon: "🎓", capacity: 30, rate: 1.0, resource: "Wissen" }
};

const SEASONS = [
  { name: "Frühling", icon: "🌱", className: "spring", effects: { farm: 1.30, castle: 1.00, mine: 1.00, academy: 1.10 }, summary: "Farmen +30 %, Akademien +10 %" },
  { name: "Sommer", icon: "☀️", className: "summer", effects: { farm: 1.05, castle: 1.25, mine: 1.00, academy: 1.00 }, summary: "Burgen +25 %, Farmen +5 %" },
  { name: "Herbst", icon: "🍂", className: "autumn", effects: { farm: 1.00, castle: 1.00, mine: 1.35, academy: 1.00 }, summary: "Minen +35 %" },
  { name: "Winter", icon: "❄️", className: "winter", effects: { farm: 0.65, castle: 0.80, mine: 0.85, academy: 0.90 }, summary: "Farmen −35 %, Burgen −20 %, Minen −15 %, Akademien −10 %" }
];

const RESEARCH = [
  { id: "granary", name: "Größere Speicher", desc: "Nahrungskapazität je Farm +15", applies: "Farmkapazität", value: "+15", apply: s => s.mods.farmCapacity += 15 },
  { id: "fertile", name: "Fruchtbare Felder", desc: "Farmproduktion +25 %", applies: "Farmproduktion", value: "+25 %", apply: s => s.mods.farmRate *= 1.25 },
  { id: "mint", name: "Effiziente Prägung", desc: "Minenproduktion +25 %", applies: "Minenproduktion", value: "+25 %", apply: s => s.mods.mineRate *= 1.25 },
  { id: "vault", name: "Tiefe Lager", desc: "Goldkapazität je Mine +10", applies: "Goldkapazität", value: "+10", apply: s => s.mods.mineCapacity += 10 },
  { id: "drill", name: "Drill", desc: "Burgen produzieren +20 %", applies: "Burgproduktion", value: "+20 %", apply: s => s.mods.castleRate *= 1.20 },
  { id: "walls", name: "Steinmauern", desc: "Verteidigungsstärke +20 %", applies: "Verteidigung", value: "+20 %", apply: s => s.mods.defense *= 1.20 },
  { id: "logistics", name: "Logistik", desc: "Armeen bewegen sich 20 % schneller", applies: "Marschtempo", value: "+20 %", apply: s => s.mods.travel *= 1.20 },
  { id: "scholars", name: "Gelehrte", desc: "Akademien produzieren +30 %", applies: "Wissensproduktion", value: "+30 %", apply: s => s.mods.academyRate *= 1.30 },
  { id: "rations", name: "Feldrationen", desc: "Nahrungsunterhalt −25 %", applies: "Unterhalt", value: "−25 %", apply: s => s.mods.foodUse *= 0.75 }
];

const MAP_NODES = [
  { id: "p1", gx: 1, gy: 4, type: "castle", owner: "player", value: 24, level: 1 },
  { id: "p2", gx: 4, gy: 2, type: "farm", owner: "neutral", value: 8, level: 1 },
  { id: "p3", gx: 4, gy: 6, type: "mine", owner: "neutral", value: 8, level: 1 },
  { id: "p4", gx: 7, gy: 4, type: "academy", owner: "neutral", value: 12, level: 1 },
  { id: "p5", gx: 10, gy: 2, type: "farm", owner: "neutral", value: 10, level: 1 },
  { id: "p6", gx: 10, gy: 6, type: "mine", owner: "neutral", value: 10, level: 1 },
  { id: "p7", gx: 13, gy: 4, type: "castle", owner: "enemy", value: 24, level: 1 }
];

// Kartenabhängige Hindernisse. Diese Standardkarte besitzt bewusst keine Felsen.
// Spätere Maps dürfen hier einzelne blockierte Rasterfelder definieren.
const TERRAIN_BLOCKS = [];

function makeSide() {
  return {
    food: 20, gold: 8, knowledge: 0,
    mods: { farmCapacity: 0, mineCapacity: 0, farmRate: 1, mineRate: 1, castleRate: 1, academyRate: 1, defense: 1, travel: 1, foodUse: 1 },
    research: []
  };
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function key(gx, gy) { return `${gx},${gy}`; }

class Game {
  constructor(root) {
    this.root = root;
    this.timer = null;
    this.started = false;
    this.resetState();
  }

  resetState() {
    this.nodes = structuredClone(MAP_NODES);
    this.armies = [];
    this.player = makeSide();
    this.enemy = makeSide();
    this.selected = null;
    this.command = null;
    this.selectedFraction = 0.5;
    this.elapsed = 0;
    this.seasonIndex = 0;
    this.lastAI = 0;
    this.logs = [];
    this.paused = true;
    this.gameOver = false;
    this.nextArmyId = 1;
    this.effects = [];
    this.drag = null;
    this.researchDeadline = null;
    this.researchOptions = [];
  }

  start() {
    this.renderShell();
    this.bindGlobalInput();
    this.render();
    if (!this.timer) this.timer = setInterval(() => this.tick(CONFIG.tickMs / 1000), CONFIG.tickMs);
  }

  beginMatch() {
    this.started = true;
    this.paused = false;
    this.root.querySelector("#startOverlay").classList.add("hidden");
    this.log("Bastion gestartet. Erobere alle roten Gebäude.");
    this.log("Gebäude-zu-Gebäude-Bewegung aktiv: Fremde und neutrale Gebäude blockieren Wege.");
    this.render();
  }

  restart() {
    const wasStarted = this.started;
    this.resetState();
    this.started = wasStarted;
    this.paused = !wasStarted;
    this.root.querySelector("#modal").classList.add("hidden");
    this.root.querySelector("#startOverlay").classList.toggle("hidden", wasStarted);
    this.root.querySelector("#pause").textContent = "Pause";
    if (wasStarted) {
      this.log("Neue Partie gestartet.");
      this.log("Gebäude-zu-Gebäude-Bewegung aktiv: Fremde und neutrale Gebäude blockieren Wege.");
    }
    this.render();
  }

  renderShell() {
    this.root.innerHTML = `
      <div class="app">
        <header class="top">
          <span class="brand">BASTION · Stage 2.0</span>
          <span class="stat"><span>🌾 Nahrung</span><b id="food"></b><small id="foodRate"></small></span>
          <span class="stat gold-stat"><span>🪙 Gold</span><b id="gold"></b><small id="goldRate"></small></span>
          <span class="stat"><span>🎓 Wissen</span><b id="knowledge"></b><small id="knowledgeRate"></small></span>
          <span class="stat supply"><span>🛡️ Armee</span><b id="supply"></b><small>gesamt / Versorgung</small></span>
          <div class="season-card"><b id="season"></b><span id="seasonEffects"></span></div>
          <button id="pause">Pause</button><button id="restart">Neustart</button><button id="save">Speichern</button><button id="load">Laden</button>
        </header>
        <main class="main">
          <section class="map" id="map" aria-label="Spielkarte"></section>
          <aside class="panel">
            <h2>Auswahl</h2><div id="selectionInfo" class="selection-info">Kein Gebäude ausgewählt.</div>
            <h2>Truppenanteil</h2>
            <p class="hint">Eigenes Gebäude anklicken oder direkt zu einem anderen Gebäude ziehen. Truppen können ausschließlich Gebäude als Ziel erhalten.</p>
            <div class="fraction-actions">
              <button data-send=".25">25 %</button><button data-send=".5">50 %</button><button data-send=".75">75 %</button><button data-send="1">100 %</button>
            </div>
            <div class="actions"><button id="upgrade">Gebäude upgraden (${CONFIG.upgradeCost} Gold)</button><button id="cancel">Auswahl abbrechen</button></div>
            <h2>Aktive Boni</h2><div id="bonusDetail" class="bonus-detail"></div>
            <h2>Jahreszeit</h2><div id="seasonDetail" class="season-detail"></div>
            <h2>Logbuch</h2><div class="log" id="log"></div>
          </aside>
        </main>
        <footer class="footer">Tipp: Halte links auf einem eigenen Gebäude gedrückt, ziehe zu einem Zielgebäude und lasse dort los.</footer>
      </div>
      <div id="startOverlay" class="modal"><div class="modal-card start-card"><h1>BASTION</h1><p>Baue deine Wirtschaft aus, erforsche zufällige Vorteile und erobere die rote Burg.</p><button id="startGame" class="start-button">Spiel starten</button></div></div>
      <div id="seasonBanner" class="season-banner hidden"></div>
      <div id="toastLayer" class="toast-layer"></div>
      <div id="modal" class="modal hidden"><div class="modal-card"><div class="research-head"><div><h2>Forschung abgeschlossen</h2><p>Wähle eine Erweiterung. Danach läuft das Spiel weiter.</p></div><div id="researchTimer" class="research-timer">5</div></div><div class="research" id="research"></div></div></div>`;

    this.root.querySelector("#startGame").onclick = () => this.beginMatch();
    this.root.querySelectorAll("[data-send]").forEach(button => button.onclick = () => this.setFraction(Number(button.dataset.send)));
    this.root.querySelector("#cancel").onclick = () => this.clearSelection();
    this.root.querySelector("#pause").onclick = () => {
      if (!this.started) return;
      this.paused = !this.paused;
      this.root.querySelector("#pause").textContent = this.paused ? "Fortsetzen" : "Pause";
    };
    this.root.querySelector("#restart").onclick = () => this.restart();
    this.root.querySelector("#save").onclick = () => this.save();
    this.root.querySelector("#load").onclick = () => this.load();
    this.root.querySelector("#upgrade").onclick = () => this.upgrade();
  }

  bindGlobalInput() {
    window.addEventListener("keydown", event => { if (event.key === "Escape") this.clearSelection(); });
    window.addEventListener("pointermove", event => this.onGlobalPointerMove(event));
    window.addEventListener("pointerup", event => this.onGlobalPointerUp(event));
    this.root.querySelector("#map").addEventListener("contextmenu", event => { event.preventDefault(); this.clearSelection(); });
  }

  tick(dt) {
    if (!this.started || this.paused || this.gameOver) {
      this.updateResearchCountdown();
      return;
    }
    this.elapsed += dt;
    this.lastAI += dt;
    if (this.elapsed >= CONFIG.seasonSeconds) {
      this.elapsed = 0;
      this.seasonIndex = (this.seasonIndex + 1) % SEASONS.length;
      this.onSeasonChanged();
    }
    this.produceFor("player", dt);
    this.produceFor("enemy", dt);
    this.moveArmies(dt);
    if (this.lastAI >= CONFIG.aiIntervalSeconds) { this.lastAI = 0; this.aiMove(); }
    if (this.player.knowledge >= CONFIG.researchThreshold && !this.researchDeadline) this.offerResearch();
    if (this.enemy.knowledge >= CONFIG.researchThreshold) this.applyAIResearch();
    this.effects = this.effects.filter(effect => performance.now() - effect.at < 1500);
    this.checkWin();
    this.render();
  }

  side(owner) { return owner === "player" ? this.player : this.enemy; }
  ownedNodes(owner, type = null) { return this.nodes.filter(n => n.owner === owner && (!type || n.type === type)); }
  totalSoldiers(owner) { return this.ownedNodes(owner).reduce((s,n)=>s+n.value,0) + this.armies.filter(a=>a.owner===owner).reduce((s,a)=>s+a.count,0); }
  supplyCap(owner) { return CONFIG.baseSupply + this.ownedNodes(owner,"farm").reduce((s,n)=>s+n.level,0)*CONFIG.farmSupply; }
  localCastleCap(node) { return BUILDINGS.castle.capacity + (node.level - 1) * 15; }

  resourceCaps(owner) {
    const side = this.side(owner);
    return {
      food: Math.max(20, this.ownedNodes(owner,"farm").reduce((s,n)=>s+BUILDINGS.farm.capacity+side.mods.farmCapacity+(n.level-1)*10,0)),
      gold: Math.max(10, this.ownedNodes(owner,"mine").reduce((s,n)=>s+BUILDINGS.mine.capacity+side.mods.mineCapacity+(n.level-1)*5,0))
    };
  }

  rates(owner) {
    const side = this.side(owner), season = SEASONS[this.seasonIndex].effects;
    return {
      food: this.ownedNodes(owner,"farm").reduce((s,n)=>s+BUILDINGS.farm.rate*season.farm*side.mods.farmRate*n.level,0),
      gold: this.ownedNodes(owner,"mine").reduce((s,n)=>s+BUILDINGS.mine.rate*season.mine*side.mods.mineRate*n.level,0),
      knowledge: this.ownedNodes(owner,"academy").reduce((s,n)=>s+BUILDINGS.academy.rate*season.academy*side.mods.academyRate*n.level,0)
    };
  }

  produceFor(owner, dt) {
    const side=this.side(owner), caps=this.resourceCaps(owner), rates=this.rates(owner), soldiers=this.totalSoldiers(owner);
    const upkeep=soldiers*CONFIG.soldierUpkeepPerSecond*side.mods.foodUse;
    side.food=clamp(side.food+(rates.food-upkeep)*dt,0,caps.food);
    side.gold=clamp(side.gold+rates.gold*dt,0,caps.gold);
    side.knowledge+=rates.knowledge*dt;
    let free=Math.max(0,this.supplyCap(owner)-soldiers);
    if(free<=0||side.food<=0)return;
    const season=SEASONS[this.seasonIndex].effects;
    for(const castle of this.ownedNodes(owner,"castle")){
      if(free<=0||side.food<=0)break;
      const cap=this.localCastleCap(castle); if(castle.value>=cap)continue;
      const desired=BUILDINGS.castle.rate*season.castle*side.mods.castleRate*castle.level*dt;
      const gain=Math.min(desired,cap-castle.value,free,side.food/CONFIG.soldierFoodCost);
      if(gain>0){castle.value+=gain;side.food-=gain*CONFIG.soldierFoodCost;free-=gain;}
    }
  }

  setFraction(fraction) { this.selectedFraction=fraction; this.renderFractionButtons(); this.log(`${Math.round(fraction*100)} % als Truppenanteil gewählt.`); }
  renderFractionButtons() { this.root.querySelectorAll("[data-send]").forEach(b=>b.classList.toggle("active",Number(b.dataset.send)===this.selectedFraction)); }

  selectNode(id) {
    const node=this.nodes.find(n=>n.id===id); if(!node)return;
    if(this.selected?.kind==="node"&&this.selected.id===id){this.clearSelection();return;}
    // Ein normaler Klick dient ausschließlich der Auswahl/Inspektion.
    // Marschbefehle werden nur durch echtes Drag-and-drop ausgelöst.
    this.selected={kind:"node",id};
    this.command=null;
    this.render();
  }

  clearSelection(){this.selected=null;this.command=null;this.drag=null;this.render();}

  onNodePointerDown(event,id){
    event.stopPropagation();
    const node=this.nodes.find(n=>n.id===id);
    if(!node)return;
    if(node.owner==="player"&&node.value>=1){
      this.drag={sourceId:id,startX:event.clientX,startY:event.clientY,currentX:event.clientX,currentY:event.clientY,moved:false};
    }
  }

  onGlobalPointerMove(event){
    if(!this.drag)return;
    this.drag.currentX=event.clientX;this.drag.currentY=event.clientY;
    if(Math.hypot(event.clientX-this.drag.startX,event.clientY-this.drag.startY)>7)this.drag.moved=true;
    this.renderDragPreview();
  }

  onGlobalPointerUp(event){
    if(!this.drag)return;
    const drag=this.drag; this.drag=null;
    if(!drag.moved){this.selectNode(drag.sourceId);return;}
    const map=this.root.querySelector("#map"), rect=map.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom){this.render();return;}
    const targetEl=document.elementFromPoint(event.clientX,event.clientY)?.closest?.("[data-node-id]");
    const targetId=targetEl?.dataset.nodeId||null;
    if(targetId){
      const target=this.nodes.find(n=>n.id===targetId);
      if(target&&target.id!==drag.sourceId){
        this.deploy(this.nodes.find(n=>n.id===drag.sourceId),target.gx,target.gy,target.id);
        return;
      }
    }
    this.log("Truppen können nur zu einer Burg, Farm, Mine oder Akademie geschickt werden.");
    this.render();
  }

  pointToCell(clientX,clientY){
    const rect=this.root.querySelector("#map").getBoundingClientRect();
    return {gx:clamp(Math.floor((clientX-rect.left)/rect.width*CONFIG.gridCols),0,CONFIG.gridCols-1),gy:clamp(Math.floor((clientY-rect.top)/rect.height*CONFIG.gridRows),0,CONFIG.gridRows-1)};
  }

  mapPointerDown(event){
    if(event.target!==event.currentTarget)return;
    // Freie Rasterfelder sind keine Ziele. Ein Klick auf die Karte hebt nur die Auswahl auf.
    this.clearSelection();
  }

  deploy(source,targetGx,targetGy,targetNodeId){
    if(!source||source.owner!=="player")return;
    const target=this.nodes.find(n=>n.id===targetNodeId);
    if(!target||target.id===source.id){
      this.log("Wähle als Ziel eine andere Burg, Farm, Mine oder Akademie.");
      return;
    }
    const count=Math.floor(source.value*this.selectedFraction);
    if(count<1){this.log("Nicht genug Soldaten.");return;}
    const path=this.findPath(source.gx,source.gy,targetGx,targetGy,source.id,targetNodeId,"player");
    if(!path){this.log("Kein Weg zum Ziel. Ein blockierendes Gebäude muss zuerst erobert werden.");this.flashCell(targetGx,targetGy,"blocked");return;}
    source.value-=count;
    this.createArmy("player",source.gx,source.gy,count,path,targetNodeId,source.id);
    this.log(`${count} Soldaten verlassen ${BUILDINGS[source.type].name}.`);
    this.selected=null;this.render();
  }

  createArmy(owner,gx,gy,count,path,targetNodeId=null,sourceNodeId=null){
    const army={id:`a${this.nextArmyId++}`,owner,gx,gy,x:gx,y:gy,count,path:[...path],targetNodeId,sourceNodeId,moving:path.length>0};
    this.armies.push(army);return army;
  }

  isBlocked(gx,gy,sourceId,targetId,owner){
    if(gx<0||gy<0||gx>=CONFIG.gridCols||gy>=CONFIG.gridRows)return true;
    if(TERRAIN_BLOCKS.some(c=>c.gx===gx&&c.gy===gy))return true;
    const node=this.nodes.find(n=>n.gx===gx&&n.gy===gy);
    return !!node&&node.id!==sourceId&&node.id!==targetId&&node.owner!==owner;
  }

  findPath(sx,sy,tx,ty,sourceId,targetId,owner){
    if(this.isBlocked(tx,ty,sourceId,targetId,owner))return null;
    const open=[{gx:sx,gy:sy,g:0,f:0}], came=new Map(), cost=new Map([[key(sx,sy),0]]);
    const dirs=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
    while(open.length){
      open.sort((a,b)=>a.f-b.f);const cur=open.shift();
      if(cur.gx===tx&&cur.gy===ty){
        const path=[];let k=key(tx,ty);while(k!==key(sx,sy)){const [gx,gy]=k.split(",").map(Number);path.unshift({gx,gy});k=came.get(k);if(!k)return null;}return path;
      }
      for(const [dx,dy] of dirs){
        const nx=cur.gx+dx,ny=cur.gy+dy;if(this.isBlocked(nx,ny,sourceId,targetId,owner))continue;
        if(dx&&dy){if(this.isBlocked(cur.gx+dx,cur.gy,sourceId,targetId,owner)||this.isBlocked(cur.gx,cur.gy+dy,sourceId,targetId,owner))continue;}
        const ng=cur.g+(dx&&dy?1.414:1), nk=key(nx,ny);
        if(ng<(cost.get(nk)??Infinity)){cost.set(nk,ng);came.set(nk,key(cur.gx,cur.gy));const h=Math.max(Math.abs(tx-nx),Math.abs(ty-ny));open.push({gx:nx,gy:ny,g:ng,f:ng+h});}
      }
    }
    return null;
  }

  moveArmies(dt){
    for(const army of [...this.armies]){
      if(!army.moving||!army.path.length)continue;
      const target=army.path[0],dx=target.gx-army.x,dy=target.gy-army.y,d=Math.hypot(dx,dy),step=CONFIG.armySpeedCells*this.side(army.owner).mods.travel*dt;
      if(d<=step){army.x=target.gx;army.y=target.gy;army.gx=target.gx;army.gy=target.gy;army.path.shift();if(!army.path.length){army.moving=false;this.onArmyArrived(army);}}
      else{army.x+=dx/d*step;army.y+=dy/d*step;}
    }
  }

  onArmyArrived(army){
    if(!army.targetNodeId)return;
    const target=this.nodes.find(n=>n.id===army.targetNodeId);if(!target)return;
    if(target.owner===army.owner){target.value+=army.count;this.removeArmy(army.id);return;}
    const defense=target.owner==="neutral"?1:this.side(target.owner).mods.defense, defended=target.value*defense;
    if(army.count>defended){target.owner=army.owner;target.value=(army.count-defended)/Math.max(1,defense);this.log(`${BUILDINGS[target.type].name} wurde von ${army.owner==="player"?"dir":"der KI"} erobert.`);this.addEffect(target.id,"capture");}
    else{target.value=Math.max(0,(defended-army.count)/Math.max(1,defense));this.log(`Angriff auf ${BUILDINGS[target.type].name} abgewehrt.`);this.addEffect(target.id,"defend");}
    this.removeArmy(army.id);
  }

  removeArmy(id){this.armies=this.armies.filter(a=>a.id!==id);}

  aiMove(){
    if(this.gameOver)return;const side=this.enemy,own=this.ownedNodes("enemy");if(!own.length)return;
    if(side.gold>=CONFIG.upgradeCost){
      const target=[...own].sort((a,b)=>({castle:4,farm:3,mine:2,academy:1}[b.type]/b.level)-({castle:4,farm:3,mine:2,academy:1}[a.type]/a.level))[0];
      if(target&&(Math.random()<0.52||own.every(n=>n.value<8))){side.gold-=CONFIG.upgradeCost;target.level++;this.log(`Die KI verbessert ihre ${BUILDINGS[target.type].name} auf Stufe ${target.level}.`);this.addEffect(target.id,"upgrade");return;}
    }
    const available=own.filter(n=>n.value>=7).sort((a,b)=>b.value-a.value);if(!available.length)return;
    const targets=[...this.nodes.filter(n=>n.owner==="neutral"),...this.nodes.filter(n=>n.owner==="player")];
    let best=null;
    for(const from of available)for(const to of targets){
      const path=this.findPath(from.gx,from.gy,to.gx,to.gy,from.id,to.id,"enemy");if(!path)continue;
      const priority=to.owner==="player"?-8:to.type==="farm"?-5:0,score=path.length+to.value*1.25+priority;
      if(!best||score<best.score)best={from,to,path,score};
    }
    if(!best)return;
    const fraction=best.to.owner==="player"?0.68:0.58,count=Math.floor(best.from.value*fraction);if(count<3)return;
    best.from.value-=count;this.createArmy("enemy",best.from.gx,best.from.gy,count,best.path,best.to.id,best.from.id);this.log(`Feindliche Armee (${count}) marschiert auf ${BUILDINGS[best.to.type].name}.`);
  }

  applyAIResearch(){
    this.enemy.knowledge-=CONFIG.researchThreshold;const available=RESEARCH.filter(r=>!this.enemy.research.includes(r.id));const r=available[Math.floor(Math.random()*available.length)]||RESEARCH[Math.floor(Math.random()*RESEARCH.length)];r.apply(this.enemy);this.enemy.research.push(r.id);this.log(`Die KI erforscht „${r.name}“.`);
  }

  upgrade(){
    if(!this.selected||this.selected.kind!=="node")return this.log("Wähle ein eigenes Gebäude.");
    const node=this.nodes.find(n=>n.id===this.selected.id);if(!node||node.owner!=="player")return this.log("Nur eigene Gebäude können verbessert werden.");
    if(this.player.gold<CONFIG.upgradeCost)return this.log(`Nicht genug Gold: ${this.player.gold.toFixed(1)} / ${CONFIG.upgradeCost}.`);
    this.player.gold-=CONFIG.upgradeCost;node.level++;this.log(`${BUILDINGS[node.type].name} auf Stufe ${node.level} verbessert.`);this.addEffect(node.id,"upgrade");this.toast(`${BUILDINGS[node.type].icon} ${BUILDINGS[node.type].name} · Stufe ${node.level}`,"Upgrade abgeschlossen");this.render();
  }

  offerResearch(){
    this.paused=true;this.player.knowledge-=CONFIG.researchThreshold;
    const unused=RESEARCH.filter(r=>!this.player.research.includes(r.id)),pool=unused.length>=3?unused:RESEARCH;
    this.researchOptions=[...pool].sort(()=>Math.random()-.5).slice(0,3);
    this.researchDeadline=performance.now()+CONFIG.researchChoiceSeconds*1000;
    const modal=this.root.querySelector("#modal"),box=this.root.querySelector("#research");box.innerHTML="";
    this.researchOptions.forEach((r,index)=>{const b=document.createElement("button");b.innerHTML=`<span class="research-number">${index+1}</span><b>${r.name}</b><small>${r.desc}</small>`;b.onclick=()=>this.chooseResearch(r);box.appendChild(b);});modal.classList.remove("hidden");this.updateResearchCountdown();
  }

  updateResearchCountdown(){
    if(!this.researchDeadline)return;const left=Math.max(0,Math.ceil((this.researchDeadline-performance.now())/1000));const el=this.root.querySelector("#researchTimer");if(el)el.textContent=String(left);
    if(performance.now()>=this.researchDeadline){const auto=this.researchOptions[Math.floor(Math.random()*this.researchOptions.length)];this.chooseResearch(auto,true);}
  }

  chooseResearch(research,automatic=false){
    if(!this.researchDeadline)return;this.researchDeadline=null;research.apply(this.player);this.player.research.push(research.id);this.log(`Forschung: ${research.name}${automatic?" (automatisch gewählt)":""}.`);this.root.querySelector("#modal").classList.add("hidden");this.paused=false;this.toast(research.name,research.desc);for(const node of this.ownedNodes("player"))this.addEffect(node.id,"research");this.render();
  }

  onSeasonChanged(){
    const s=SEASONS[this.seasonIndex];this.log(`Jahreszeit: ${s.name} – ${s.summary}.`);const banner=this.root.querySelector("#seasonBanner");banner.textContent=`${s.icon} ${s.name}: ${s.summary}`;banner.classList.remove("hidden");clearTimeout(this.bannerTimer);this.bannerTimer=setTimeout(()=>banner.classList.add("hidden"),2600);
  }

  addEffect(nodeId,type){this.effects.push({nodeId,type,at:performance.now()});}
  flashCell(gx,gy,type){this.effects.push({gx,gy,type,at:performance.now()});this.render();}
  toast(title,text){const layer=this.root.querySelector("#toastLayer"),el=document.createElement("div");el.className="toast";el.innerHTML=`<b>${title}</b><span>${text}</span>`;layer.appendChild(el);setTimeout(()=>el.remove(),2800);}

  checkWin(){
    const enemy=this.nodes.some(n=>n.owner==="enemy")||this.armies.some(a=>a.owner==="enemy"),player=this.nodes.some(n=>n.owner==="player")||this.armies.some(a=>a.owner==="player");
    if(!enemy){this.gameOver=true;this.paused=true;this.log("SIEG – alle feindlichen Bastionen wurden erobert.");this.toast("SIEG","Alle feindlichen Bastionen wurden erobert.");}
    else if(!player){this.gameOver=true;this.paused=true;this.log("NIEDERLAGE – deine Bastionen wurden vernichtet.");this.toast("NIEDERLAGE","Deine Bastionen wurden vernichtet.");}
  }

  nodeCapacityText(node){return node.type==="castle"?`${Math.floor(node.value)} / ${this.localCastleCap(node)} Soldaten`:`${Math.floor(node.value)} Verteidiger`;}
  selectionText(){
    if(!this.selected)return "Kein Gebäude ausgewählt.";const node=this.nodes.find(n=>n.id===this.selected.id);if(!node)return "Keine Auswahl.";
    const owner=node.owner==="player"?"Dein Gebäude":node.owner==="enemy"?"Gegner":"Neutral";
    return `<b>${BUILDINGS[node.type].icon} ${BUILDINGS[node.type].name} · Stufe ${node.level}</b><br>${this.nodeCapacityText(node)}<br><span class="muted">${owner}</span>`;
  }

  effectiveBreakdown(type){
    const s=SEASONS[this.seasonIndex].effects[type],m=type==="castle"?this.player.mods.castleRate:type==="farm"?this.player.mods.farmRate:type==="mine"?this.player.mods.mineRate:this.player.mods.academyRate;
    return {season:s,research:m,effective:s*m};
  }

  bonusDetailHTML(){
    const rows=[["🏰 Burg","castle"],["🌾 Farm","farm"],["⛏️ Mine","mine"],["🎓 Akademie","academy"]];
    const production=rows.map(([label,type])=>{const b=this.effectiveBreakdown(type);return `<div class="bonus-row"><span>${label}</span><span>Jahreszeit ×${b.season.toFixed(2)}</span><span>Forschung ×${b.research.toFixed(2)}</span><b>Effektiv ×${b.effective.toFixed(2)}</b></div>`;}).join("");
    const research=this.player.research.length?this.player.research.map(id=>{const r=RESEARCH.find(x=>x.id===id);return `<li><b>${r.name}</b> – ${r.desc}</li>`;}).join(""):"<li>Noch keine Forschung.</li>";
    return `${production}<h3>Erforscht</h3><ul class="research-list">${research}</ul>`;
  }

  seasonDetailHTML(season){return [["🏰 Burgen",season.effects.castle],["🌾 Farmen",season.effects.farm],["⛏️ Minen",season.effects.mine],["🎓 Akademien",season.effects.academy]].map(([l,v])=>{const p=Math.round((v-1)*100),t=p===0?"±0 %":`${p>0?"+":""}${p} %`,c=p>0?"positive":p<0?"negative":"neutral-effect";return `<div><span>${l}</span><b class="${c}">${t}</b></div>`;}).join("");}

  cellStyle(gx,gy){return `left:${(gx+.5)/CONFIG.gridCols*100}%;top:${(gy+.5)/CONFIG.gridRows*100}%`;}

  renderDragPreview(){
    const preview=this.root.querySelector("#dragPreview");if(!preview||!this.drag)return;
    const map=this.root.querySelector("#map"),rect=map.getBoundingClientRect(),source=this.nodes.find(n=>n.id===this.drag.sourceId);if(!source)return;
    const sx=rect.left+(source.gx+.5)/CONFIG.gridCols*rect.width,sy=rect.top+(source.gy+.5)/CONFIG.gridRows*rect.height,dx=this.drag.currentX-sx,dy=this.drag.currentY-sy;
    preview.style.cssText=`display:block;left:${sx-rect.left}px;top:${sy-rect.top}px;width:${Math.hypot(dx,dy)}px;transform:rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)`;
  }

  render(){
    const season=SEASONS[this.seasonIndex],caps=this.resourceCaps("player"),rates=this.rates("player"),upkeep=this.totalSoldiers("player")*CONFIG.soldierUpkeepPerSecond*this.player.mods.foodUse,net=rates.food-upkeep;
    this.root.querySelector("#food").textContent=`${this.player.food.toFixed(1)} / ${caps.food}`;this.root.querySelector("#foodRate").textContent=`${net>=0?"+":""}${net.toFixed(2)}/s netto`;
    this.root.querySelector("#gold").textContent=`${this.player.gold.toFixed(1)} / ${caps.gold}`;this.root.querySelector("#goldRate").textContent=`+${rates.gold.toFixed(2)}/s · Upgrade ${CONFIG.upgradeCost}`;
    this.root.querySelector("#knowledge").textContent=`${this.player.knowledge.toFixed(1)} / ${CONFIG.researchThreshold}`;this.root.querySelector("#knowledgeRate").textContent=`+${rates.knowledge.toFixed(2)}/s`;
    this.root.querySelector("#supply").textContent=`${Math.floor(this.totalSoldiers("player"))} / ${this.supplyCap("player")}`;
    this.root.querySelector("#season").textContent=`${season.icon} ${season.name} · ${Math.ceil(CONFIG.seasonSeconds-this.elapsed)}s`;this.root.querySelector("#seasonEffects").textContent=season.summary;
    this.root.querySelector("#selectionInfo").innerHTML=this.selectionText();this.root.querySelector("#bonusDetail").innerHTML=this.bonusDetailHTML();this.root.querySelector("#seasonDetail").innerHTML=this.seasonDetailHTML(season);this.renderFractionButtons();

    const map=this.root.querySelector("#map");map.className=`map ${season.className}`;map.innerHTML="";map.onpointerdown=e=>this.mapPointerDown(e);
    const grid=document.createElement("div");grid.className="grid-layer";map.appendChild(grid);
    for(const block of TERRAIN_BLOCKS){const rock=document.createElement("div");rock.className="terrain-block";rock.style.cssText=this.cellStyle(block.gx,block.gy);rock.textContent="🪨";map.appendChild(rock);}
    const dragPreview=document.createElement("div");dragPreview.id="dragPreview";dragPreview.className="drag-preview";map.appendChild(dragPreview);

    for(const army of this.armies){
      if(army.moving&&army.path.length){let prev={gx:army.x,gy:army.y};for(const point of army.path){const line=document.createElement("div"),x1=(prev.gx+.5)/CONFIG.gridCols*100,y1=(prev.gy+.5)/CONFIG.gridRows*100,x2=(point.gx+.5)/CONFIG.gridCols*100,y2=(point.gy+.5)/CONFIG.gridRows*100,dx=x2-x1,dy=y2-y1;line.className=`marching-path ${army.owner}`;line.style.cssText=`left:${x1}%;top:${y1}%;width:${Math.hypot(dx,dy)}%;transform:rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)`;map.appendChild(line);prev=point;}}
    }

    for(const node of this.nodes){
      const el=document.createElement("div"),selected=this.selected?.kind==="node"&&this.selected.id===node.id,effect=this.effects.find(e=>e.nodeId===node.id),breakdown=this.effectiveBreakdown(node.type);
      el.dataset.nodeId=node.id;el.className=`node ${node.owner} ${selected?"selected":""} ${effect?`effect-${effect.type}`:""}`;el.style.cssText=this.cellStyle(node.gx,node.gy);
      const cap=node.type==="castle"?` / ${this.localCastleCap(node)}`:"";
      el.innerHTML=`<div class="node-icon">${BUILDINGS[node.type].icon}</div><div class="type">${BUILDINGS[node.type].name} · L${node.level}</div><div class="value">${Math.floor(node.value)}${cap}</div><div class="small">${node.owner==="player"?"Du":node.owner==="enemy"?"Gegner":"Neutral"}</div><div class="season-multiplier">S ×${breakdown.season.toFixed(2)} · F ×${breakdown.research.toFixed(2)}<br><b>= ×${breakdown.effective.toFixed(2)}</b></div>`;
      el.onpointerdown=e=>this.onNodePointerDown(e,node.id);map.appendChild(el);
    }

    for(const army of this.armies){const el=document.createElement("div");el.className=`army ${army.owner}`;el.textContent=Math.floor(army.count);el.style.cssText=`left:${(army.x+.5)/CONFIG.gridCols*100}%;top:${(army.y+.5)/CONFIG.gridRows*100}%`;map.appendChild(el);}
    for(const effect of this.effects.filter(e=>e.gx!==undefined)){const el=document.createElement("div");el.className=`cell-effect ${effect.type}`;el.style.cssText=this.cellStyle(effect.gx,effect.gy);map.appendChild(el);}
    if(this.drag)this.renderDragPreview();
    this.root.querySelector("#log").innerHTML=this.logs.slice(-80).reverse().map(l=>`<div>${l}</div>`).join("");
  }

  log(message){const time=new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit",second:"2-digit"});this.logs.push(`${time} · ${message}`);}

  save(){const state={nodes:this.nodes,armies:this.armies,player:this.player,enemy:this.enemy,seasonIndex:this.seasonIndex,elapsed:this.elapsed,nextArmyId:this.nextArmyId,logs:this.logs};localStorage.setItem("bastion-stage2",JSON.stringify(state));this.log("Spielstand gespeichert.");this.render();}
  load(){const raw=localStorage.getItem("bastion-stage2");if(!raw)return this.log("Kein Spielstand für Stage 2 vorhanden.");Object.assign(this,JSON.parse(raw));this.selected=null;this.drag=null;this.gameOver=false;this.started=true;this.paused=false;this.root.querySelector("#startOverlay").classList.add("hidden");this.log("Spielstand geladen.");this.render();}
}

window.addEventListener("DOMContentLoaded",()=>{try{new Game(document.getElementById("app")).start();}catch(error){console.error(error);document.getElementById("app").innerHTML=`<div style="padding:24px;color:#fff;font-family:Arial"><h1>Bastion konnte nicht gestartet werden</h1><pre style="white-space:pre-wrap">${String(error?.stack||error)}</pre></div>`;}});
