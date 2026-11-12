// Hand-drawn pixel anatomy. Each entry owns its silhouette and moving appendages;
// colours are accents, never the mechanism used to distinguish two species.
const TAU = Math.PI * 2;
const INK = '#102b3c';
const WHITE = '#e7fff1';
const box = (c,x,y,w,h,color) => {c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));};
const shape = (c,points,color) => {c.fillStyle=color;c.beginPath();for(let i=0;i<points.length;i++){const [x,y]=points[i];i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y));}c.closePath();c.fill();};
const stroke = (c,points,color,width=1) => {c.strokeStyle=color;c.lineWidth=width;c.beginPath();for(let i=0;i<points.length;i++){const [x,y]=points[i];i?c.lineTo(Math.round(x)+.5,Math.round(y)+.5):c.moveTo(Math.round(x)+.5,Math.round(y)+.5);}c.stroke();};
const dot = (c,x,y,r,color) => shape(c,[[x-r,y-r/2],[x-r/2,y-r],[x+r/2,y-r],[x+r,y-r/2],[x+r,y+r/2],[x+r/2,y+r],[x-r/2,y+r],[x-r,y+r/2]],color);
const eye = (c,x,y,size=3) => {box(c,x,y,size,size,WHITE);box(c,x+size-2,y+1,2,Math.max(1,size-2),INK);};
const palette = s => ({body:s.color||'#84cfc9',accent:s.accent||'#e8edbf'});

function drawGlassfish(c,s,t){
  const {body,accent}=palette(s),tail=Math.sin(t*8)*3;
  shape(c,[[-11,0],[-20,-6+tail],[-21,5+tail],[-12,3]],body);
  shape(c,[[-13,0],[-6,-5],[4,-8],[13,-7],[17,-1],[15,7],[3,8],[-8,4]],body);
  shape(c,[[-9,0],[-3,-3],[7,-4],[13,0],[6,5],[-4,3]],'#b4e7dd');
  stroke(c,[[-12,0],[10,0]],accent);for(let i=-7;i<7;i+=4)stroke(c,[[i-2,-3],[i,0],[i-2,3]],'#69aeb8');
  shape(c,[[-8,-4],[-7,-10],[-2,-7]],'#a4d3c9');shape(c,[[-1,-6],[2,-13],[7,-7]],accent);shape(c,[[4,5],[1,11+Math.sin(t*7)],[11,8]],accent);eye(c,11,-5,4);
}
function drawEmberfin(c,s,t){
  const {body,accent}=palette(s),fin=Math.sin(t*5)*3;
  shape(c,[[-13,-2],[-28,-16+fin],[-23,-1],[-28,17-fin],[-13,4]],body);
  shape(c,[[-15,0],[-6,-8],[7,-9],[17,-3],[19,2],[9,9],[-5,7]],body);
  shape(c,[[-8,-7],[-4,-12],[0,-29+fin],[4,-12],[10,-8]],accent);
  shape(c,[[-5,6],[-9,20],[3,12],[12,7]],accent);
  stroke(c,[[-10,-1],[4,-4],[13,-2]],'#ffd2a4',2);
  shape(c,[[1,0],[1,8+fin],[7,5],[8,1]],accent);eye(c,10,-4,4);box(c,15,3,3,1,accent);
}
function drawMoonjelly(c,s,t){
  const {body,accent}=palette(s),pulse=Math.sin(t*2.3),rim=3+pulse*2;
  for(let i=-5;i<=5;i++)stroke(c,[[i*2.7,rim],[i*2.7+Math.sin(t*2+i)*2,11+Math.abs(i%3)]],body);
  for(let i=-2;i<2;i++)stroke(c,[[i*4+2,3],[i*4+Math.sin(t+i)*3,12],[i*3+Math.sin(t*1.4+i)*4,22]],accent,2);
  shape(c,[[-17,rim],[-16,-4],[-10,-10],[0,-13+pulse],[10,-10],[16,-4],[17,rim]],body);
  shape(c,[[-13,0],[-11,-5],[-5,-9],[5,-9],[11,-5],[13,0]],'#b1c3e2');
  for(const [x,y] of [[-4,-5],[3,-5],[-4,0],[3,0]]){dot(c,x,y,2,accent);box(c,x,y,1,1,body);}
  stroke(c,[[-16,rim],[-7,rim+1],[7,rim+1],[16,rim]],accent);
}
function drawRibbonEel(c,s,t){
  const {body,accent}=palette(s),back=[];
  for(let i=0;i<15;i++)back.push([-37+i*5,Math.sin(i*.55+t*3)*(6-i*.25)]);
  stroke(c,back.map(([x,y])=>[x,y-3]),accent,2);stroke(c,back,body,4);
  shape(c,[[27,-3],[31,-6],[36,-4],[49,-5],[50,-3],[35,0],[29,2]],body);eye(c,32,-5,2);
  stroke(c,[[35,-2],[49,-2],[52,0]],accent);stroke(c,[[31,1],[41,3],[49,1]],body);
}
function drawLanternfish(c,s,t){
  const {body,accent}=palette(s),tail=Math.sin(t*7)*3;
  shape(c,[[-15,0],[-25,-7+tail],[-22,0],[-25,8+tail]],body);
  shape(c,[[-17,0],[-6,-10],[7,-10],[15,-5],[19,4],[10,10],[-5,8]],body);
  shape(c,[[-6,-9],[-4,-17],[4,-14],[8,-9]],'#a59667');
  shape(c,[[3,7],[-3,15+Math.sin(t*5)*2],[11,11]],accent);
  dot(c,11,-3,5,accent);dot(c,12,-3,3,INK);box(c,12,-5,1,1,WHITE);
  for(let i=0;i<6;i++)box(c,-10+i*4,5+Math.sin(i*.6)*2,2,2,Math.sin(t*4+i)>.2?WHITE:accent);
  stroke(c,[[13,6],[18,4],[18,7]],accent);
}
function drawUmbrellaOctopus(c,s,t){
  const {body,accent}=palette(s),spread=18+Math.sin(t*2.6)*4;
  shape(c,[[-7,0],[-11,-6],[-7,-12],[3,-14],[10,-10],[11,-4],[6,2]],body);
  shape(c,[[-7,-2],[-spread,16],[-10,12],[-4,17],[2,13],[9,18],[spread,14],[7,-1]],body);
  for(let i=-2;i<=2;i++){stroke(c,[[i*3,0],[i*spread/3,12+Math.cos(i)*3]],accent);dot(c,i*spread/3,13+Math.cos(i)*3,1,accent);}
  shape(c,[[-8,-8],[-15,-6],[-11,-2],[-8,-3]],accent);eye(c,3,-7,4);box(c,-3,-10,4,2,accent);
}
function drawGhostShrimp(c,s,t){
  const {body,accent}=palette(s);
  shape(c,[[-19,8],[-15,-4],[-6,-9],[6,-7],[14,0],[7,7],[-5,8]],body);
  for(let i=0;i<6;i++)stroke(c,[[-14+i*4,-4-Math.sin(i*.6)*3],[-16+i*4,5]],accent);
  shape(c,[[-17,5],[-27,1],[-26,10],[-21,14],[-15,9]],accent);
  for(let i=0;i<5;i++){const x=-7+i*4;stroke(c,[[x,5],[x+Math.sin(t*7+i)*3,12],[x+4,14]],body);}
  stroke(c,[[10,-3],[22,-15],[30,-17+Math.sin(t)*2]],accent);stroke(c,[[12,-1],[27,-7],[34,-5+Math.sin(t+1)*2]],body);
  shape(c,[[8,-7],[21,-8],[15,-3]],accent);eye(c,12,-6,3);
}
function drawCrystalJelly(c,s,t){
  const {body,accent}=palette(s),pulse=Math.sin(t*2)*2;
  for(let i=0;i<20;i++){const a=Math.PI*(.1+i*.8/19),x=Math.cos(a)*12,y=Math.sin(a)*5;stroke(c,[[x,y],[Math.cos(a)*(24+pulse),Math.sin(a)*20],[Math.cos(a)*34+Math.sin(t*1.2+i)*4,Math.sin(a)*32]],i%3?body:accent);}
  shape(c,[[-13,4],[-12,-6],[-7,-14],[0,-17+pulse],[7,-14],[12,-6],[13,4]],body);
  for(let i=-2;i<=2;i++)stroke(c,[[0,-14+pulse],[i*4,-6],[i*5,3]],accent);
  stroke(c,[[-13,4],[-7,6],[0,5],[7,6],[13,4]],accent,2);
  dot(c,0,-2,4,'#a47999');
}
function drawVampireSquid(c,s,t){
  const {body,accent}=palette(s),flare=19+Math.sin(t*1.9)*3;
  stroke(c,[[-7,7],[-24,23],[-31+Math.sin(t)*4,32]],accent);stroke(c,[[7,7],[24,23],[31+Math.sin(t+2)*4,32]],accent);
  shape(c,[[-8,-4],[-9,-14],[-4,-21],[5,-21],[10,-13],[8,-3],[flare,18],[9,14],[6,22],[0,16],[-7,22],[-11,14],[-flare,18]],body);
  shape(c,[[-8,1],[-13,15],[0,9],[13,15],[7,0]],'#84475f');
  for(let i=-2;i<=2;i++)stroke(c,[[i*2,0],[i*6,16]],accent);
  shape(c,[[-9,-11],[-17,-14],[-18,-6],[-10,-3]],body);shape(c,[[9,-11],[17,-14],[18,-6],[10,-3]],body);
  dot(c,-6,-6,4,'#b2e7f2');dot(c,6,-6,4,'#b2e7f2');dot(c,-6,-6,2,INK);dot(c,6,-6,2,INK);
}
function drawGulperEel(c,s,t){
  const {body,accent}=palette(s),tail=[];
  for(let i=0;i<12;i++)tail.push([-50+i*4,Math.sin(t*2.4+i*.5)*(6-i*.2)+7]);
  stroke(c,tail,body,3);dot(c,-50,tail[0][1],2,Math.sin(t*3)>0?accent:'#7087aa');
  shape(c,[[-10,6],[-6,-7],[4,-13],[23,-10],[29,0],[16,17],[0,19]],body);
  shape(c,[[0,-7],[23,-8],[23,1],[10,12],[-2,11]],INK);
  stroke(c,[[0,-7],[23,-8],[23,1],[10,12],[-2,11]],accent,2);
  shape(c,[[-8,7],[-2,15],[12,19],[-2,20],[-12,13]],accent);eye(c,1,-11,3);
}
function drawAbyssRay(c,s,t){
  const {body,accent}=palette(s),flap=Math.sin(t*2)*6;
  stroke(c,[[0,10],[1,24],[Math.sin(t)*4,40]],body,2);
  shape(c,[[-31,-1+flap],[-18,-9],[-7,-10],[0,-18],[7,-10],[18,-9],[31,-1+flap],[15,11],[0,15],[-15,11]],body);
  shape(c,[[-25,flap],[-11,-5],[-4,10],[-15,7]],accent);shape(c,[[25,flap],[11,-5],[4,10],[15,7]],accent);
  stroke(c,[[0,-15],[0,10]],'#c0dae0');for(const side of [-1,1]){eye(c,side*5-1,-8,2);for(let i=0;i<3;i++)stroke(c,[[side*6,i*3],[side*11,i*3+1]],'#4a658e');}
}
function drawSiphonophore(c,s,t){
  const {body,accent}=palette(s);
  const nodes=[];for(let i=0;i<13;i++)nodes.push([-43+i*7,Math.sin(t*1.3+i*.4)*4]);
  stroke(c,nodes,body,2);
  for(let i=0;i<nodes.length;i++){const [x,y]=nodes[i];if(i<4){shape(c,[[x-3,y-2],[x-4,y-8],[x,y-12],[x+4,y-8],[x+3,y-2]],body);stroke(c,[[x-2,y-9],[x+2,y-9]],accent);}else{dot(c,x,y,2,accent);stroke(c,[[x,y],[x+Math.sin(t+i)*4,y+13],[x+Math.sin(t*1.5+i)*5,y+23+(i%3)*3]],i%2?body:accent);}}
  dot(c,-47,nodes[0][1]-3,4,'#d4e7d2');
}
function drawYetiCrab(c,s,t){
  const {body,accent}=palette(s);
  for(let side of [-1,1])for(let i=0;i<4;i++){const yy=-1+i*5,step=Math.sin(t*4+i+side)*2;stroke(c,[[side*8,yy],[side*(19+i),yy+step],[side*(24+i*2),yy+7]],body,2);}
  shape(c,[[-11,-5],[-7,-12],[6,-12],[12,-5],[10,11],[-8,11]],body);
  for(const side of [-1,1]){stroke(c,[[side*8,-4],[side*16,-15],[side*25,-20+Math.sin(t*1.5)*2]],body,4);shape(c,[[side*18,-21],[side*29,-27],[side*27,-17],[side*22,-12]],accent);for(let i=0;i<7;i++)stroke(c,[[side*(13+i*2),-11-i],[side*(12+i*2),-17-i]],accent);eye(c,side*5-1,-10,2);}
  for(let i=-6;i<=6;i+=4)stroke(c,[[i,-5],[i+2,7]],accent);
}
function drawDumbo(c,s,t){
  const {body,accent}=palette(s),ear=Math.sin(t*3)*5;
  shape(c,[[-7,-11],[-18,-18+ear],[-23,-10+ear],[-20,-3],[-10,-2]],accent);
  shape(c,[[7,-11],[18,-18+ear],[23,-10+ear],[20,-3],[10,-2]],accent);
  shape(c,[[-10,-6],[-8,-17],[-2,-22],[6,-19],[11,-10],[9,6],[4,13],[-4,12],[-10,5]],body);
  for(let i=-3;i<=3;i++)stroke(c,[[i*2,6],[i*4,15+Math.sin(t*2+i)*2],[i*4+2,17]],body,3);
  eye(c,-7,-5,3);eye(c,4,-5,3);box(c,-4,-16,7,2,accent);
}
function drawGhostWhale(c,s,t){
  const {body,accent}=palette(s),tail=Math.sin(t*1.2)*5;
  shape(c,[[-39,0],[-51,-15+tail],[-57,-10+tail],[-47,1],[-55,14+tail],[-45,13+tail]],body);
  shape(c,[[-42,0],[-26,-14],[-3,-18],[23,-14],[39,-6],[45,2],[37,12],[10,16],[-19,10]],body);
  shape(c,[[-30,4],[-9,10],[16,10],[39,5],[35,11],[10,14],[-19,8]],accent);
  shape(c,[[-2,9],[10,28+Math.sin(t)*2],[18,25],[15,9]],body);
  shape(c,[[-20,-12],[-10,-25],[-6,-16]],accent);
  for(let i=0;i<9;i++)box(c,-24+i*7,-5+Math.sin(i)*4,2,2,Math.sin(t+i)>.2?WHITE:accent);
  stroke(c,[[-6,-11],[-10,-3],[-6,5]],'#90b3d1',2);eye(c,31,-2,4);stroke(c,[[30,9],[40,6]],INK);
}
function drawHadalSnailfish(c,s,t){
  const {body,accent}=palette(s),tail=Math.sin(t*3)*4;
  shape(c,[[-13,0],[-36,-2+tail],[-39,5+tail],[-19,10],[-5,15],[9,13],[18,5],[16,-7],[8,-13],[-2,-13],[-12,-8]],body);
  shape(c,[[-34,4+tail],[-20,7],[-6,11],[10,9],[16,5],[8,12],[-8,15],[-26,10]],accent);
  shape(c,[[0,3],[-8,15+Math.sin(t*3)*2],[2,18],[9,8]],'#d6b2bc');eye(c,10,-6,4);
  stroke(c,[[1,-9],[6,-10]],accent);box(c,17,1,2,2,accent);
}
function drawCrownJelly(c,s,t){
  const {body,accent}=palette(s),pulse=Math.sin(t*2.2)*2;
  for(let i=0;i<12;i++){const a=i*TAU/12,x=Math.cos(a)*(15+pulse),y=Math.sin(a)*(15+pulse);stroke(c,[[x,y],[Math.cos(a)*23+Math.sin(t+i)*2,Math.sin(a)*24],[Math.cos(a)*28+Math.sin(t+i)*3,Math.sin(a)*29]],body);dot(c,x,y,2,accent);}
  dot(c,0,0,14+pulse,body);dot(c,0,0,11,'#8b506e');dot(c,0,0,8,body);dot(c,-2,-3,4,accent);
  stroke(c,[[0,15],[6+Math.sin(t)*3,25],[-3,37],[3+Math.sin(t*1.3)*4,48]],accent);
}
function drawLeviathan(c,s,t){
  const {body,accent}=palette(s);
  for(let i=0;i<8;i++)stroke(c,[[8,i-3],[22+i*2,Math.sin(t*1.8+i)*6+(i-4)*3],[34+i*2,Math.sin(t*2+i)*7+(i-4)*5]],i%2?body:accent,2);
  for(const side of [-1,1])stroke(c,[[9,side*5],[28,side*18],[49,side*15+Math.sin(t*2+side)*4],[57,side*8]],body,3);
  shape(c,[[-39,0],[-21,-14],[1,-12],[14,-5],[15,6],[0,13],[-22,12]],body);
  shape(c,[[-29,-9],[-27,-24],[-9,-17],[-2,-10]],accent);shape(c,[[-29,8],[-28,24],[-9,17],[-2,10]],accent);
  stroke(c,[[-33,0],[-11,-3],[5,0]],'#d0bdd6',2);dot(c,9,0,6,accent);dot(c,10,0,3,INK);box(c,10,-2,2,2,WHITE);
  for(let i=0;i<6;i++)box(c,23+i*5,Math.sin(t*2+i)*3+13,1,1,accent);
}

function drawSeaPig(c,s,t){
  const {body,accent}=palette(s);
  for(let i=0;i<5;i++){const x=-16+i*8,step=Math.sin(t*2.3+i*1.4)*2;stroke(c,[[x,5],[x+step,14],[x+3+step,17]],accent,3);}
  shape(c,[[-23,1],[-19,-10],[-7,-15],[9,-14],[22,-7],[25,2],[18,10],[-9,12],[-20,8]],body);
  shape(c,[[-15,-5],[-5,-9],[8,-8],[16,-3],[11,4],[-5,5]],'#bc8c9e');
  for(let i=0;i<4;i++){const x=-15+i*10;stroke(c,[[x,-9],[x-2,-20+Math.sin(t+i)*2],[x+1,-23]],accent,2);}
  for(let i=0;i<4;i++)stroke(c,[[22,1],[28+Math.sin(t*2+i)*2,-3+i*3]],accent);
  box(c,-13,-8,6,2,'#f0d6d0');
}
function drawSupergiantAmphipod(c,s,t){
  const {body,accent}=palette(s);
  shape(c,[[-28,3],[-24,-13],[-10,-23],[7,-23],[20,-14],[24,-2],[16,4],[8,-6],[-2,-7],[-10,0],[-9,11],[1,17],[10,13],[9,23],[-5,25],[-21,17]],body);
  for(let i=0;i<8;i++){const a=-2.8+i*.37,x=-1+Math.cos(a)*22,y=1+Math.sin(a)*23;stroke(c,[[x-5,y+4],[x,y-4],[x+7,y-2]],accent,2);}
  for(let i=0;i<7;i++){const x=-16+i*5,yy=2+Math.sin(i*.45)*7,step=Math.sin(t*3+i)*3;stroke(c,[[x,yy],[x+9,yy+10+step],[x+19,yy+8+step]],body,2);}
  shape(c,[[-17,5],[-32,13],[-27,24],[-16,14]],accent);shape(c,[[-8,14],[-16,29],[-8,34],[0,21]],body);
  stroke(c,[[19,-13],[33,-24],[47,-25+Math.sin(t)*3]],accent);stroke(c,[[22,-9],[37,-15],[49,-9+Math.sin(t+1)*2]],body);
  dot(c,17,-12,4,INK);box(c,17,-13,1,1,accent);shape(c,[[9,20],[20,23],[24,16],[16,17]],accent);
}
function drawSeahorse(c,s,t){
  const {body,accent}=palette(s),wave=Math.sin(t*4)*3;
  stroke(c,[[-3,8],[-5,20],[0,29],[10,29],[14,23],[10,18],[6,20],[7,24]],body,4);
  shape(c,[[-8,6],[-11,-5],[-5,-16],[-5,-25],[3,-31],[11,-27],[12,-20],[7,-15],[5,-7],[8,4],[3,13],[-4,13]],body);
  shape(c,[[9,-25],[23,-21],[23,-16],[9,-18]],accent);box(c,22,-20,3,3,body);
  shape(c,[[-5,-26],[-9,-33],[-1,-30],[2,-36],[5,-29]],accent);
  shape(c,[[-9,-6],[-17-wave,-3],[-18-wave,5],[-9,7]],accent);
  for(let i=0;i<6;i++)stroke(c,[[-6,-11+i*4],[3,-10+i*4]],'#b99569');eye(c,5,-25,3);
}
function drawFeatherStar(c,s,t){
  const {body,accent}=palette(s);
  for(let i=0;i<10;i++){
    const a=Math.PI+.15+i*(Math.PI-.3)/9,curve=Math.sin(t*.9+i)*.14,points=[];
    for(let j=0;j<6;j++){const angle=a+j*curve*.15,r=4+j*6;points.push([Math.cos(angle)*r,Math.sin(angle)*r]);}
    stroke(c,points,body,2);
    for(let j=1;j<6;j++){const [x,y]=points[j],angle=a+j*curve*.15,len=5-j*.45;for(const side of [-1,1])stroke(c,[[x,y],[x+Math.cos(angle+side*1.1)*len,y+Math.sin(angle+side*1.1)*len]],j%2?body:accent);}
  }
  dot(c,0,0,5,body);dot(c,0,0,2,accent);
  for(let i=0;i<4;i++)stroke(c,[[i-2,4],[i*3-5,11],[i*3-3,12]],'#8d9270');
}
function drawNudibranch(c,s,t){
  const {body,accent}=palette(s),foot=[];
  for(let i=0;i<12;i++)foot.push([-25+i*4.5,8+Math.sin(t*2+i*.8)*2]);
  stroke(c,foot,accent,3);
  shape(c,[[-28,5],[-21,-3],[-13,-8],[9,-8],[22,-3],[26,5],[18,9],[-17,10]],body);
  stroke(c,[[-24,4],[-15,-4],[8,-4],[20,0],[23,5]],accent,2);
  for(const x of [15,21]){stroke(c,[[x,-3],[x-1,-14+Math.sin(t+x)*1.5]],body,3);box(c,x-2,-14+Math.sin(t+x)*1.5,4,2,accent);}
  for(let i=0;i<7;i++){const a=-Math.PI+.2+i*.4;stroke(c,[[-15,-4],[-15+Math.cos(a)*10,-4+Math.sin(a)*13]],accent,2);}
  for(let i=0;i<6;i++)dot(c,-9+i*5,1+(i%2)*3,1,accent);
}
function drawLionfish(c,s,t){
  const {body,accent}=palette(s),spread=Math.sin(t*2)*3;
  for(let i=0;i<9;i++){const x=-15+i*3.5;shape(c,[[x-2,-4],[x-7,-21-Math.sin(i*.3)*10],[x+2,-5]],i%2?body:accent);}
  for(let i=0;i<7;i++){const x=-6+i*3;stroke(c,[[4,0],[x-22-spread,16+i*2],[x-16-spread,24+i]],accent,2);}
  shape(c,[[-13,0],[-24,-7],[-28,7],[-14,8]],accent);
  shape(c,[[-16,2],[-9,-8],[8,-9],[18,-2],[20,6],[10,12],[-7,10]],body);
  for(let i=0;i<5;i++)stroke(c,[[-10+i*5,-6],[-13+i*5,8]],accent,2);
  for(let i=0;i<4;i++)stroke(c,[[4,4],[16+i*4,18+i*3+spread]],body,2);
  eye(c,12,-3,4);stroke(c,[[17,7],[24,8]],accent);stroke(c,[[11,-8],[13,-17]],body,2);
}
function drawBloodybellyComb(c,s,t){
  const {body,accent}=palette(s);
  shape(c,[[-16,-3],[-13,-16],[-5,-24],[5,-24],[13,-16],[16,-3],[13,13],[6,21],[1,17],[-4,22],[-12,15]],body);
  shape(c,[[-8,-10],[-4,-17],[4,-17],[10,-8],[8,8],[0,13],[-7,6]],'#934b6d');
  const rainbow=['#99e7c3','#91d4ed','#c2a2ef','#edb0d4','#efd39e'];
  for(let row=0;row<6;row++)for(let j=0;j<8;j++){const yy=-15+j*4+Math.sin(t*7+j+row)*.8,xx=(row-2.5)*4*(.7+Math.sin((j+1)/9*Math.PI)*.3),phase=((j+row+Math.floor(t*5))%rainbow.length+rainbow.length)%rainbow.length;box(c,xx,yy,2,Math.sin(t*8+j+row)>0?2:1,rainbow[phase]);}
  stroke(c,[[-11,-17],[-14,-3],[-11,12]],accent);stroke(c,[[11,-17],[14,-3],[11,12]],accent);
}
function drawBarreleye(c,s,t){
  const {body,accent}=palette(s),tail=Math.sin(t*5)*3;
  shape(c,[[-11,0],[-28,-6+tail],[-26,7+tail]],body);
  shape(c,[[-20,0],[-11,-8],[7,-8],[12,4],[4,11],[-12,9]],body);
  shape(c,[[-6,-7],[-6,-17],[3,-23],[15,-23],[23,-15],[24,-4],[17,5],[4,4]],'#7eaaad');
  shape(c,[[-3,-11],[-1,-17],[5,-20],[15,-20],[20,-14],[21,-7],[13,0],[3,0]],'#9ad1c2');
  for(const x of [5,14]){box(c,x,-14,4,11,'#537c60');dot(c,x+2,-15,4,'#b3df86');box(c,x+1,-18,2,2,WHITE);}
  shape(c,[[0,5],[-7,16+Math.sin(t*5)*2],[5,10]],accent);shape(c,[[-15,-4],[-16,-13],[-8,-8]],body);box(c,22,-1,3,2,accent);
}
function drawHatchetfish(c,s,t){
  const {body,accent}=palette(s),tail=Math.sin(t*7)*2;
  shape(c,[[-14,0],[-25,-8+tail],[-22,2],[-25,10+tail],[-13,5]],body);
  shape(c,[[-16,0],[-7,-10],[10,-11],[18,-4],[16,13],[4,23],[-9,14],[-11,5]],body);
  shape(c,[[-7,-5],[8,-7],[12,0],[9,16],[3,19],[-5,11]],'#a9b6bf');
  stroke(c,[[-8,2],[-4,13],[3,20],[12,13]],accent,2);
  dot(c,11,-7,5,accent);dot(c,12,-8,3,INK);box(c,11,-11,1,2,WHITE);
  shape(c,[[-6,-9],[-4,-19],[2,-12]],accent);shape(c,[[5,18],[14,25],[13,12]],body);
  for(let i=0;i<6;i++)box(c,-6+i*3,12+Math.sin(i*.6)*7,2,2,Math.sin(t*3+i)>.2?WHITE:accent);
}
function drawUmbellulaPen(c,s,t){
  const {body,accent}=palette(s),sway=Math.sin(t*.7)*3;
  stroke(c,[[0,34],[1,17],[sway,-3],[sway,-19]],body,3);
  shape(c,[[-5,36],[-4,31],[3,30],[6,36]],'#7a8c7a');
  for(let i=0;i<7;i++){
    const a=-Math.PI+.3+i*.42,x=sway+Math.cos(a)*20,y=-18+Math.sin(a)*17;
    stroke(c,[[sway,-16],[x,y+5],[x,y]],body,2);
    for(let j=0;j<8;j++){const angle=j*TAU/8+Math.sin(t+i)*.08;stroke(c,[[x,y],[x+Math.cos(angle)*6,y+Math.sin(angle)*6]],accent);}
    dot(c,x,y,2,body);
  }
}
function drawTripodFish(c,s,t){
  const {body,accent}=palette(s);
  stroke(c,[[-19,-3],[-33,32]],accent,2);stroke(c,[[2,2],[0,34]],body,2);stroke(c,[[9,2],[21,33]],accent,2);
  shape(c,[[-21,-6],[-7,-13],[12,-12],[22,-6],[12,2],[-9,0]],body);
  shape(c,[[-18,-7],[-30,-13],[-25,-4]],body);
  stroke(c,[[12,-7],[22,-19],[34,-25+Math.sin(t)*2]],accent);stroke(c,[[12,-3],[27,-11],[37,-10+Math.sin(t+1)*2]],accent);
  shape(c,[[-9,-12],[-5,-20],[2,-12]],body);eye(c,15,-9,2);
  for(const x of [-33,0,21])box(c,x-2,33,5,1,accent);
}
function drawFreyellaStar(c,s,t){
  const {body,accent}=palette(s);
  for(let i=0;i<6;i++){
    const a=i*TAU/6+.2,flex=Math.sin(t*.6+i)*.055,dx=Math.cos(a),dy=Math.sin(a),perp=[-dy,dx],tip=[Math.cos(a+flex)*37,Math.sin(a+flex)*37];
    shape(c,[[perp[0]*5,perp[1]*5],[dx*14+perp[0]*3,dy*14+perp[1]*3],tip,[dx*15-perp[0]*3,dy*15-perp[1]*3],[-perp[0]*5,-perp[1]*5]],body);
    stroke(c,[[dx*5,dy*5],[dx*17,dy*17],tip],accent);
    for(let j=1;j<5;j++)for(const side of [-1,1])box(c,dx*j*6+perp[0]*side*3,dy*j*6+perp[1]*side*3,1,1,accent);
  }
  dot(c,0,0,7,body);dot(c,-1,-1,3,accent);
}
function drawGiantIsopod(c,s,t){
  const {body,accent}=palette(s);
  for(const side of [-1,1])for(let i=0;i<7;i++){const y=-13+i*5,step=Math.sin(t*3+i*.8)*2;stroke(c,[[side*11,y],[side*19,y+step],[side*21,y+6]],body,2);}
  shape(c,[[-8,-27],[7,-27],[14,-20],[17,-6],[15,15],[8,25],[-7,25],[-15,15],[-17,-6],[-14,-20]],body);
  for(let i=0;i<7;i++){const y=-17+i*5,wide=13-Math.abs(i-3)*.6;stroke(c,[[-wide,y],[0,y+3],[wide,y]],accent,2);}
  shape(c,[[-10,-22],[-7,-29],[7,-29],[11,-22],[6,-17],[-6,-17]],accent);
  for(const side of [-1,1]){dot(c,side*7,-23,2,INK);stroke(c,[[side*5,-27],[side*12,-35+Math.sin(t+side)*2],[side*19,-37]],body);}
  shape(c,[[-8,20],[-17,29],[-8,28],[0,31],[8,28],[17,29],[8,20]],accent);
}
function drawHadalAmphipod(c,s,t){
  const {body,accent}=palette(s);
  shape(c,[[-18,7],[-20,-3],[-15,-14],[-5,-21],[8,-19],[17,-10],[16,-1],[8,1],[4,-6],[-4,-7],[-9,-1],[-8,7],[0,13],[7,11],[4,20],[-7,19]],body);
  for(let i=0;i<6;i++){const a=-2.8+i*.45;stroke(c,[[Math.cos(a)*16-1,Math.sin(a)*17],[Math.cos(a)*9+3,Math.sin(a)*10+3]],accent);}
  for(let i=0;i<7;i++){const x=-8+i*3,step=Math.sin(t*5+i)*3;stroke(c,[[x,3],[x+6,8+step],[x+13,7+step]],body);}
  stroke(c,[[13,-14],[22,-23],[28,-22+Math.sin(t)*2]],accent);stroke(c,[[16,-10],[28,-13],[32,-10]],body);
  dot(c,11,-12,3,INK);shape(c,[[4,17],[15,19],[17,13],[9,12]],accent);stroke(c,[[-14,9],[-21,20],[-15,25]],accent,2);
}

const descriptor=(draw,width,height,options={})=>Object.freeze({draw,width,height,worldScale:.8,bob:2,...options});
export const SPECIES_ART = {
  glassfish:descriptor(drawGlassfish,54,32,{worldScale:.65,bob:1.2}),
  emberfin:descriptor(drawEmberfin,64,70,{worldScale:.65,bob:1}),
  moonjelly:descriptor(drawMoonjelly,42,50,{worldScale:.8,bob:2.5,emissive:true}),
  ribbon_eel:descriptor(drawRibbonEel,118,30,{worldScale:.7,bob:.7}),
  lanternfish:descriptor(drawLanternfish,58,42,{worldScale:.7,bob:1,emissive:true}),
  umbrella_octopus:descriptor(drawUmbrellaOctopus,55,50,{worldScale:.8,bob:2}),
  ghost_shrimp:descriptor(drawGhostShrimp,78,42,{worldScale:.65,bob:1.2}),
  crystal_jelly:descriptor(drawCrystalJelly,88,76,{worldScale:.85,bob:2.5,emissive:true}),
  vampire_squid:descriptor(drawVampireSquid,80,72,{worldScale:.85,bob:1.3}),
  gulper_eel:descriptor(drawGulperEel,118,48,{worldScale:.8,bob:.8,emissive:true}),
  abyss_ray:descriptor(drawAbyssRay,76,90,{worldScale:.9,bob:1.5,supportY:40}),
  siphonophore:descriptor(drawSiphonophore,108,76,{worldScale:.95,bob:1.5,emissive:true}),
  yeti_crab:descriptor(drawYetiCrab,78,68,{worldScale:.75,bob:0,anchored:true,supportY:24}),
  dumbo:descriptor(drawDumbo,58,50,{worldScale:.75,bob:2}),
  ghost_whale:descriptor(drawSeaPig,76,60,{worldScale:.85,bob:0,anchored:true,supportY:17}),
  hadal_snailfish:descriptor(drawHadalSnailfish,90,48,{worldScale:.75,bob:1}),
  crown_jelly:descriptor(drawCrownJelly,74,110,{worldScale:.85,bob:2,emissive:true}),
  leviathan:descriptor(drawSupergiantAmphipod,112,82,{worldScale:.95,bob:0,anchored:true,supportY:34}),
  seahorse:descriptor(drawSeahorse,66,86,{worldScale:.65,bob:.8}),
  feather_star:descriptor(drawFeatherStar,84,84,{worldScale:.75,bob:0,anchored:true,supportY:12}),
  sea_slug:descriptor(drawNudibranch,72,48,{worldScale:.7,bob:0,anchored:true,supportY:10}),
  lionfish:descriptor(drawLionfish,88,94,{worldScale:.8,bob:1}),
  comb_jelly:descriptor(drawBloodybellyComb,44,60,{worldScale:.8,bob:2.2,emissive:true}),
  barreleye:descriptor(drawBarreleye,74,62,{worldScale:.75,bob:.5}),
  hatchetfish:descriptor(drawHatchetfish,64,62,{worldScale:.65,bob:.8,emissive:true}),
  sea_pen:descriptor(drawUmbellulaPen,70,94,{worldScale:.8,bob:0,anchored:true,supportY:36}),
  tripod_fish:descriptor(drawTripodFish,94,86,{worldScale:.85,bob:0,anchored:true,supportY:34}),
  abyss_star:descriptor(drawFreyellaStar,90,90,{worldScale:.85,bob:0,anchored:true,supportY:36}),
  giant_isopod:descriptor(drawGiantIsopod,60,90,{worldScale:.8,bob:0,anchored:true,supportY:31}),
  hadal_amphipod:descriptor(drawHadalAmphipod,82,64,{worldScale:.7,bob:0,anchored:true,supportY:25}),
};

const MORPHOLOGY_IDS={glass_goby:'glassfish',lyretail_anthias:'emberfin',moon_disc:'moonjelly',snipe_eel:'ribbon_eel',lantern_fish:'lanternfish',flapjack:'umbrella_octopus',caridean_shrimp:'ghost_shrimp',crossota:'crystal_jelly',vampire_cape:'vampire_squid',gulper:'gulper_eel',abyss_skate:'abyss_ray',siphonophore_chain:'siphonophore',yeti_crab:'yeti_crab',dumbo_ears:'dumbo',sea_pig:'ghost_whale',snailfish:'hadal_snailfish',atolla_crown:'crown_jelly',supergiant_amphipod:'leviathan',seahorse:'seahorse',feather_star:'feather_star',nudibranch:'sea_slug',lionfish:'lionfish',bloodybelly_comb:'comb_jelly',barreleye:'barreleye',hatchetfish:'hatchetfish',umbellula_pen:'sea_pen',tripod_fish:'tripod_fish',freyella_star:'abyss_star',giant_isopod:'giant_isopod',hadal_amphipod:'hadal_amphipod'};
const AMBIENT_ART={ambient_whale:descriptor(drawGhostWhale,128,72),ambient_squid:descriptor(drawLeviathan,128,74)};
const KIND_FALLBACK = {fish:'glassfish',eel:'ribbon_eel',jelly:'moonjelly',octopus:'dumbo',squid:'ambient_squid',ray:'abyss_ray',whale:'ambient_whale',crab:'yeti_crab',shrimp:'ghost_shrimp'};
export function getSpeciesArtId(species={}) {
  if(SPECIES_ART[species.id])return species.id;
  if(MORPHOLOGY_IDS[species.morphology])return MORPHOLOGY_IDS[species.morphology];
  return KIND_FALLBACK[species.kind]||'glassfish';
}
export function getSpeciesArt(species={}) {const id=getSpeciesArtId(species);return SPECIES_ART[id]||AMBIENT_ART[id];}
export function drawSpecies(c,species={},time=0,factor=1,facing=1) {
  const art=getSpeciesArt(species),t=Number.isFinite(time)?time:0,scale=Number.isFinite(factor)?Math.max(.01,Math.min(12,factor)):1;
  c.save();c.scale(scale*(facing<0?-1:1),scale);art.draw(c,species,t);c.restore();
  return getSpeciesArtId(species);
}
