export const RESEARCH=[
{id:'granary',name:'Größere Speicher',desc:'Farmkapazität +15',apply:g=>g.mods.farmCapacity+=15},
{id:'fertile',name:'Fruchtbare Felder',desc:'Farmproduktion +25 %',apply:g=>g.mods.farmRate*=1.25},
{id:'mint',name:'Effiziente Prägung',desc:'Minenproduktion +25 %',apply:g=>g.mods.mineRate*=1.25},
{id:'vault',name:'Tiefe Lager',desc:'Minenkapazität +10',apply:g=>g.mods.mineCapacity+=10},
{id:'drill',name:'Drill',desc:'Burgen produzieren +20 %',apply:g=>g.mods.castleRate*=1.2},
{id:'walls',name:'Steinmauern',desc:'Verteidigungsbonus +20 %',apply:g=>g.mods.defense*=1.2},
{id:'logistics',name:'Logistik',desc:'Armeen reisen 20 % schneller',apply:g=>g.mods.travel*=.8},
{id:'scholars',name:'Gelehrte',desc:'Akademien produzieren +30 %',apply:g=>g.mods.academyRate*=1.3},
{id:'rations',name:'Feldrationen',desc:'Nahrungsverbrauch −20 %',apply:g=>g.mods.foodUse*=.8}
];