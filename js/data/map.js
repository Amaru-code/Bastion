export const MAP={nodes:[
{id:'p1',x:12,y:48,type:'castle',owner:'player',value:22,level:1},
{id:'p2',x:28,y:22,type:'farm',owner:'neutral',value:8,level:1},
{id:'p3',x:32,y:72,type:'mine',owner:'neutral',value:8,level:1},
{id:'p4',x:50,y:45,type:'academy',owner:'neutral',value:12,level:1},
{id:'p5',x:68,y:20,type:'farm',owner:'neutral',value:10,level:1},
{id:'p6',x:69,y:70,type:'mine',owner:'neutral',value:10,level:1},
{id:'p7',x:87,y:47,type:'castle',owner:'enemy',value:22,level:1}],
routes:[['p1','p2'],['p1','p3'],['p2','p4'],['p3','p4'],['p4','p5'],['p4','p6'],['p5','p7'],['p6','p7'],['p2','p3'],['p5','p6']]};