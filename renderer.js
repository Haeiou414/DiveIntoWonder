import { SPECIES, PAINTS } from './data.js';
import { drawSpecies, getSpeciesArt } from './species-art.js';
import { CANYON, CAVES, getCaveAt, hasLineOfSight } from './world.js';

// The entire ocean is drawn at a deliberately low resolution. Its scenery is
// seeded by world position, so a return journey passes the same reef and rocks.
const TAU = Math.PI * 2;
const speciesById = new Map(SPECIES.map(s => [s.id, s]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const rnd = n => {
  let v = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  v ^= v >>> 13; v = Math.imul(v, 0xc2b2ae35); v ^= v >>> 16;
  return (v >>> 0) / 4294967295;
};
const hash = s => [...String(s)].reduce((n, c) => Math.imul(n, 31) + c.charCodeAt(0) | 0, 7);
const rect = (c, x, y, w, h, color) => {
  if (color) c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
};
function poly(c, points, color) {
  c.fillStyle = color; c.beginPath();
  points.forEach(([x,y], i) => i ? c.lineTo(Math.round(x), Math.round(y)) : c.moveTo(Math.round(x), Math.round(y)));
  c.closePath(); c.fill();
}
function line(c, points, color, width=1) {
  c.strokeStyle=color; c.lineWidth=width; c.beginPath();
  points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x)+.5,Math.round(y)+.5):c.moveTo(Math.round(x)+.5,Math.round(y)+.5));c.stroke();
}
function colorMix(a,b,t) {
  const read = n => [parseInt(n.slice(1,3),16),parseInt(n.slice(3,5),16),parseInt(n.slice(5,7),16)];
  return '#'+read(a).map((v,i)=>Math.round(mix(v,read(b)[i],t)).toString(16).padStart(2,'0')).join('');
}
const PALETTES = [
  { at:0, top:'#12677c', mid:'#075368', bottom:'#073249', rock:'#163b4d', rim:'#39868a', shadow:'#102b3b', glow:'#72e9cf' },
  { at:650, top:'#084453', mid:'#083342', bottom:'#072537', rock:'#17374a', rim:'#327779', shadow:'#0b2636', glow:'#61e4db' },
  { at:2000, top:'#0b2942', mid:'#0b2339', bottom:'#111d35', rock:'#202e47', rim:'#3b5872', shadow:'#111d31', glow:'#9d9cff' },
  { at:5000, top:'#111e34', mid:'#112332', bottom:'#092b32', rock:'#213c45', rim:'#45666b', shadow:'#0d232e', glow:'#6be3c6' },
  { at:8000, top:'#171c36', mid:'#1c203c', bottom:'#17273d', rock:'#342d4c', rim:'#665073', shadow:'#201f37', glow:'#ce9bff' }
];
function palette(depth) {
  let a=PALETTES[0],b=a;
  for(let i=0;i<PALETTES.length-1;i++) { if(depth>=PALETTES[i].at) { a=PALETTES[i]; b=PALETTES[i+1]; } }
  const t=clamp((depth-a.at)/(b.at-a.at||1),0,1), result={};
  for(const k of ['top','mid','bottom','rock','rim','shadow','glow']) result[k]=colorMix(a[k],b[k],t);
  return result;
}
function specimen(c, s, t=0, factor=1, facing=1) {
  return drawSpecies(c,s||{},t,factor,facing);
}
function submarine(c, id, t=0, facing=1, moving=false, paintId='classic') {
  c.save();c.scale(facing,1);
  const paint=PAINTS.find(p=>p.id===paintId)||PAINTS[0];
  const whale=id==='whale', ray=id==='ray', body=paintId==='classic'?(whale?'#c2c9c3':ray?'#b6d9cc':'#e4d6a0'):(paint?.body||'#e4d6a0'),trim=paint?.accent||'#f0e4b2';
  if(moving) {
    for(let i=0;i<7;i++) { const p=((t*2+i*.147)%1),xx=-27-p*31,yy=Math.sin(i*2+t*5)*4;c.globalAlpha=(1-p)*.7;rect(c,xx,yy,2+i%2,2,'#a0f5ec'); }c.globalAlpha=1;
  }
  if(whale) {
    poly(c,[[-34,-10],[-26,-17],[24,-17],[37,-7],[40,8],[28,17],[-26,17],[-35,10]],'#344b58');
    rect(c,-27,-15,50,28,body);rect(c,-22,-15,39,4,'#e6dfb7');rect(c,-22,9,43,5,'#7d8b88');
    rect(c,-13,-22,24,7,'#a4b8ac');rect(c,-8,-24,14,3,'#d9e2c3');
    rect(c,-22,14,19,4,'#5d7f81');rect(c,-36,-6,9,16,'#748b8e');
    for(let x=-16;x<=12;x+=14){rect(c,x,-7,11,13,'#294c5a');rect(c,x+2,-5,7,9,'#6ce0d5');rect(c,x+3,-4,3,3,'#dcffff');}
    poly(c,[[24,-10],[35,-4],[35,8],[25,12]],trim);rect(c,34,-3,5,7,'#ecf8bc');
    rect(c,-25,19,33,4,'#344a59');rect(c,-22,19,26,1,trim);rect(c,-17,16,3,6,'#819a9a');
    rect(c,-17,23,18,6,'#a0b8b5');rect(c,-12,23,5,4,'#6fdacb');rect(c,-20,-12,42,2,trim);
    rect(c,24,-19,7,4,trim);line(c,[[27,-18],[27,-26],[33,-28]],'#9bb5b6',2);
    line(c,[[24,12],[35,20],[44,20]],'#66848d',4);poly(c,[[43,14],[58,20],[43,26]],'#a8c3c2');
    line(c,[[45,16],[48,22],[49,17],[52,22]],'#4d727e',1);rect(c,35,17,8,6,trim);
  } else if(ray) {
    poly(c,[[-20,-9],[-9,-12],[12,-9],[26,-2],[20,8],[-12,11],[-24,5]],'#385663');
    poly(c,[[-19,-7],[-7,-10],[13,-7],[24,-1],[18,7],[-12,8],[-21,3]],body);
    poly(c,[[-9,-9],[-18,-20],[4,-13],[10,-8]],trim);poly(c,[[-10,8],[-19,18],[6,12],[13,6]],trim);
    rect(c,4,-7,12,12,'#234b60');rect(c,6,-5,8,8,'#7ff3e2');rect(c,7,-5,5,2,'#e4fff8');
    rect(c,-25,-5,7,11,'#436a78');rect(c,-25,-3,2,7,'#80e2d9');rect(c,22,-1,4,4,'#e9fac8');
    rect(c,-11,-5,8,2,'#e8f2d0');rect(c,-10,3,6,2,'#5b8f93');
    line(c,[[-1,-9],[-1,-16]],'#afcfc4',2);poly(c,[[-10,-20],[-7,-15],[5,-15],[8,-20],[4,-18],[-5,-18]],'#c5e9d8');
    rect(c,-3,-23,2,4,trim);rect(c,-7,1,3,2,Math.sin(t*4)>.4?'#c2ffda':'#5a9e98');
  } else {
    rect(c,-19,-11,26,3,'#f0e4b2');rect(c,-22,-8,35,17,body);
    poly(c,[[10,-9],[20,-5],[24,1],[21,7],[12,10]],body);
    rect(c,-18,8,30,4,'#aca178');rect(c,-18,11,28,2,'#456271');
    rect(c,-17,-16,10,5,'#9cae9e');rect(c,-14,-20,3,5,'#d4cfab');rect(c,-14,-21,8,2,'#e4d8ac');
    rect(c,-25,-5,7,12,'#516d72');rect(c,-27,-3,3,8,'#759d96');rect(c,-26,-2,2,6,'#b1eee1');
    rect(c,3,-8,14,15,'#466775');rect(c,5,-6,10,11,'#64d8d2');rect(c,6,-5,7,3,'#cefff1');rect(c,12,1,2,3,'#359bae');
    rect(c,-14,-6,9,2,'#faf0c5');rect(c,-14,-1,5,3,'#8d9782');rect(c,-14,4,10,2,'#aaa57c');
    rect(c,21,-2,4,5,'#edffd3');rect(c,-7,-11,5,2,'#b98f52');rect(c,-5,-12,2,1,'#edb674');
    line(c,[[-7,13],[-7,17],[8,17],[12,13]],'#758c88',2);
    rect(c,-18,-9,19,2,trim);line(c,[[14,8],[20,13],[26,13]],'#748f96',2);
    line(c,[[26,10],[30,10],[31,12]],'#b8d7d2',2);line(c,[[26,16],[30,16],[31,14]],'#b8d7d2',2);
  }
  c.restore();
}
export function drawSpecimen(canvas, speciesId, scale=1) {
  if(!canvas)return;
  const c=canvas.getContext('2d'),w=canvas.width||100,h=canvas.height||80;
  c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;c.save();c.translate(Math.round(w/2),Math.round(h/2));
  const s=speciesById.get(speciesId)||{},art=getSpeciesArt(s);
  specimen(c,s,0,Math.min(w/art.width,h/art.height)*scale,1);c.restore();
}
export function drawVehicle(canvas, vehicleId, paintId='classic') {
  if(!canvas)return;
  const c=canvas.getContext('2d'),w=canvas.width||120,h=canvas.height||80;
  c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;c.save();c.translate(Math.round(w/2),Math.round(h/2));
  const zoom=Math.min(w/(vehicleId==='whale'?100:85),h/70);c.scale(zoom,zoom);submarine(c,vehicleId,0,1,false,paintId);c.restore();
}

export class OceanRenderer {
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
    this.buffer=document.createElement('canvas');this.c=this.buffer.getContext('2d',{alpha:false});
    this.mask=document.createElement('canvas');this.m=this.mask.getContext('2d');
    this.width=640;this.height=340;this.scale=.64;this.cameraY=-130;this.time=0;this.effects=[];
    this.canvas.style.imageRendering='pixelated';
    this.resize=()=>{
      const b=canvas.getBoundingClientRect();
      if(!b.width||!b.height)return;
      this.width=Math.min(800,Math.max(460,Math.round(b.width/2)));
      this.height=Math.max(240,Math.round(this.width*b.height/b.width));
      this.scale=this.width/1000;
      this.buffer.width=this.mask.width=this.width;this.buffer.height=this.mask.height=this.height;
      const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(b.width*dpr);canvas.height=Math.round(b.height*dpr);
      this.ctx.imageSmoothingEnabled=false;this.c.imageSmoothingEnabled=false;
    };
    this.observer=new ResizeObserver(this.resize);this.observer.observe(canvas);this.resize();
  }
  destroy(){this.observer.disconnect();}
  screenToWorld(clientX,clientY) {
    const b=this.canvas.getBoundingClientRect();
    return {x:(clientX-b.left)/b.width*1000,y:(clientY-b.top)/b.height*this.height/this.scale+this.cameraY};
  }
  fx(type,x,y){this.effects.push({type,x,y,start:this.time});}
  world(x,y){return [Math.round(x*this.scale),Math.round((y-this.cameraY)*this.scale)];}
  render(game,timeSeconds) {
    if(!game?.player)return;
    this.game=game;
    this.time=timeSeconds??performance.now()/1000;
    const {player}=game,c=this.c,w=this.width,h=this.height,t=this.time;
    this.cameraY=player.y-h*.46/this.scale;
    const p=palette(player.y),[px,py]=this.world(player.x,player.y);
    const facing=player.facing===-1||player.facing==='left'?-1:1;
    this.background(p,t,player.y);
    this.distantLife(p,t,game);
    this.terrain(p,t,true);
    this.wonders(game,p,t);
    this.terrain(p,t,false);
    this.caverns(game,p,t);
    this.smallLife(p,t,game);
    if(game.carrier) {
      const [cx,cy]=this.world(game.carrier.x,game.carrier.y);
      c.save();c.translate(cx,cy);c.scale(this.scale/.6,this.scale/.6);submarine(c,'whale',t,1,false,game.paintByVehicle?.whale);c.restore();
      c.font='8px monospace';c.textAlign='center';c.fillStyle='#a9e5d8';c.fillText('鲸落号 · F 接驳',cx,cy+33);
    }
    const nearby=[];
    for(const e of game.entities||[]) {
      if(e.alive===false)continue;
      const [worldX,worldY]=this.world(e.x,e.y),pose=e.type==='creature'?this.creaturePose(e,worldX,worldY):{x:worldX,y:worldY};
      const {x,y}=pose;if(y<-90||y>h+90)continue;
      if(!this.entityVisible(game,e))continue;
      const dist=Math.hypot(e.x-player.x,e.y-player.y),range=typeof game.getTargetRange==='function'?game.getTargetRange(e):game.stats?.captureRange||100;
      const accessible=!e.caveId||(game.vehicle==='moth'&&game.currentCave?.id===e.caveId);
      if(!e.sampled&&accessible&&dist<=range)nearby.push({e,x,y,dist});
      // Sonar-only contacts are drawn as echoes after the darkness, not lit fish.
      if(this.illuminated(game,e.x,e.y))this.entity(e,worldX,worldY,t,p);
    }
    this.particles(p,t,player.y);
    this.renderEffects(t);
    this.vision(game,px,py,facing);
    this.sonarHighlights(game,t);
    this.caveLabels(game);
    this.tether(game,px,py);
    // The vehicle is always legible, even at the limits of the lamp.
    c.save();c.translate(px,py+Math.sin(t*2.1)*1.2);
    const vehicle=typeof game.vehicle==='string'?game.vehicle:game.vehicle?.id||'moth';
    const moving=game.moving||game.boost||(this.previousPosition&&Math.hypot(player.x-this.previousPosition.x,player.y-this.previousPosition.y)>.01);
    const hullScale=(vehicle==='moth'?.5:vehicle==='ray'?.78:1.04)*this.scale/.6;c.scale(hullScale,hullScale);
    submarine(c,vehicle,t,facing,moving,game.paintId||game.paintByVehicle?.[vehicle]||'classic');
    this.previousPosition={x:player.x,y:player.y};
    c.restore();
    if(nearby.length) { nearby.sort((a,b)=>a.dist-b.dist);this.target(nearby[0],t); }
    const vignette=c.createRadialGradient(w*.5,h*.43,h*.22,w*.5,h*.5,w*.62);vignette.addColorStop(0,'#00101d00');vignette.addColorStop(1,'#00101d60');c.fillStyle=vignette;c.fillRect(0,0,w,h);
    this.ctx.imageSmoothingEnabled=false;this.ctx.drawImage(this.buffer,0,0,this.canvas.width,this.canvas.height);
  }
  background(p,t,depth) {
    const c=this.c,w=this.width,h=this.height;
    const gradient=c.createLinearGradient(0,0,w*.3,h);gradient.addColorStop(0,p.top);gradient.addColorStop(.53,p.mid);gradient.addColorStop(1,p.bottom);c.fillStyle=gradient;c.fillRect(0,0,w,h);
    if(depth<850) {
      c.save();c.globalAlpha=clamp(1-depth/1500,.05,.7);
      for(let i=0;i<7;i++) {
        const x=w*(.08+i*.142)+Math.sin(t*.12+i)*9;
        const ray=c.createLinearGradient(x,0,x-100,h);ray.addColorStop(0,'#adf5dc1a');ray.addColorStop(.7,'#7fe4d008');ray.addColorStop(1,'#7fe4d000');
        poly(c,[[x-9,-10],[x+13,-10],[x-85,h],[x-170,h]],ray);
      }
      c.restore();
      // Distant surface caustics, made of small horizontal pixels.
      c.globalAlpha=.12*clamp(1-depth/800,0,1);
      for(let i=0;i<35;i++)rect(c,rnd(i+241)*w,12+rnd(i+81)*53+Math.sin(t+i)*2,4+rnd(i+781)*20,1,'#b0f2d4');c.globalAlpha=1;
    }
    // Mountains across the channel provide depth behind the sharp foreground.
    for(let layer=0;layer<3;layer++) {
      c.globalAlpha=.15+layer*.07;
      for(let side=0;side<2;side++) {
        const pts=[[side?w+40:-40,-30]];
        for(let yy=-30;yy<h+40;yy+=16) {
          const wy=this.cameraY+yy/this.scale;
          const edge=(125+Math.sin(wy*.006+layer*2)*50+Math.sin(wy*.017+side*4)*20+layer*23)*this.scale;
          pts.push([side?w-edge:edge,yy]);
        }
        pts.push([side?w+40:-40,h+40]);poly(c,pts,layer===2?'#102d43':'#153c51');
      }
    }c.globalAlpha=1;
  }
  boundary(y,side,far=false) {
    const edge=side?CANYON.right:CANYON.left;
    const distant=far?(35+Math.sin(y*.012+side*2.2)*15+Math.sin(y*.032+side*7)*8):0;
    return (edge+(side?-distant:distant))*this.scale;
  }
  terrain(p,t,far) {
    const c=this.c,w=this.width,h=this.height,s=this.scale;
    const start=Math.floor(this.cameraY/24)*24,end=this.cameraY+h/s+40;
    for(let side=0;side<2;side++) {
      const pts=[[side?w+5:-5,-30]];
      for(let y=start-40;y<=end;y+=24)pts.push([this.boundary(y,side,far),(y-this.cameraY)*s]);
      pts.push([side?w+5:-5,h+30]);poly(c,pts,far?colorMix(p.rock,p.mid,.5):p.shadow);
      const edge=[];for(let y=start-40;y<=end;y+=24)edge.push([this.boundary(y,side,far),(y-this.cameraY)*s]);
      line(c,edge,far?p.rock:p.rock,far?5:8);
      if(far)continue;
      for(let cell=Math.floor(this.cameraY/36)-1;cell<(end/36)+1;cell++) {
        const seed=cell*61+side*1087,wy=cell*36,yy=(wy-this.cameraY)*s,x=this.boundary(wy,side),dir=side?-1:1;
        // Lithographic strata and broken highlights, aligned to the canyon face.
        poly(c,[[x-dir*2,yy],[x-dir*(10+rnd(seed)*20),yy-5],[x-dir*(18+rnd(seed+1)*20),yy+6],[x-dir*4,yy+9]],p.rock);
        line(c,[[x-dir*(2+rnd(seed+2)*8),yy],[x-dir*17,yy-3],[x-dir*27,yy+2]],p.rim);
        rect(c,x-dir*(10+rnd(seed+9)*35),yy+11,2,2,p.rim);
        const life=this.ecologyAt(side?CANYON.right:CANYON.left,wy);
        if(rnd(seed+5)>1-life*.5) {
          const cy=yy+7,cx=x-dir*3;
          this.coral(cx,cy,dir,seed,wy,p,t);
        }
        if(wy<600&&rnd(seed+7)>1-life*.25) this.weed(x-dir*8,yy,dir,seed,t,p);
      }
    }
    // Reef shelves occur at fixed depths, never jumping when the camera moves.
    for(let n=Math.floor(this.cameraY/450)-1;n<(this.cameraY+h/s)/450+1;n++) {
      if(n<0)continue;
      const wy=n*450+335,side=n%2,seed=n*71+399;
      if(wy>1000)continue;
      const xx=side?835:165,[x,y]=this.world(xx,wy);
      if(y<-80||y>h+100)continue;
      const dir=side?-1:1;
      poly(c,[[x-dir*110,y+50],[x-dir*100,y+6],[x-dir*60,y-5],[x-dir*23,y-2],[x+dir*20,y+18],[x+dir*32,y+40],[x-dir*10,y+63]],p.shadow);
      poly(c,[[x-dir*100,y+6],[x-dir*60,y-5],[x-dir*23,y-2],[x+dir*20,y+18],[x-dir*20,y+15]],p.rock);
      line(c,[[x-dir*94,y+5],[x-dir*60,y-5],[x-dir*23,y-2],[x+dir*12,y+12]],p.rim,2);
      for(let j=0;j<8;j++)this.coral(x-dir*(j*11-8),y-2-rnd(seed+j)*4,dir,seed+j*9,wy,p,t);
      for(let j=0;j<4;j++)this.weed(x-dir*j*18,y-5,dir,seed+j,t,p);
    }
  }
  ecologyAt(x,y) {
    if(y<250)return 1;
    const close=(this.game?.wonders||[]).some(w=>Math.hypot(w.x-x,w.y-y)<190);
    return close?.75:y<1000?.2:.025;
  }
  caverns(game,p,t) {
    const c=this.c,s=this.scale;
    for(const cave of CAVES) {
      const b=cave.bounds,neck=cave.throat,[left,top]=this.world(b.left,b.top),[right,bottom]=this.world(b.right,b.bottom);
      if(bottom<-25||top>this.height+25)continue;
      const pool=c.createLinearGradient(left,top,right,bottom);pool.addColorStop(0,'#081824');pool.addColorStop(1,cave.id==='ember_cleft'?'#11232b':'#0d2734');
      rect(c,left,top,right-left,bottom-top,pool);
      const neckLeft=cave.side==='left'?b.right:CANYON.right,neckRight=cave.side==='left'?CANYON.left:b.left;
      const [nx,ny]=this.world(neckLeft,neck.top),[nr,nb]=this.world(neckRight,neck.bottom);
      rect(c,nx,ny,nr-nx,nb-ny,pool);
      // Straight collision limits remain legible under irregular rock texture.
      line(c,[[left,top],[right,top]],p.rim,2);line(c,[[left,bottom],[right,bottom]],p.rim,2);
      line(c,[[nx,ny],[nr,ny]],p.rim,2);line(c,[[nx,nb],[nr,nb]],p.rim,2);
      line(c,cave.side==='left'?[[right,top],[right,ny],[nr,ny]]:[[left,top],[left,ny],[nx,ny]],p.rock,2);
      line(c,cave.side==='left'?[[right,bottom],[right,nb],[nr,nb]]:[[left,bottom],[left,nb],[nx,nb]],p.rock,2);
      const back=cave.side==='left'?left:right,dir=cave.side==='left'?1:-1;
      line(c,[[back,top],[back,bottom]],p.rim,2);
      for(let i=0;i<9;i++) {
        const seed=hash(cave.id)+i*19,xx=left+4+rnd(seed)*(right-left-8),yy=top+9+i*(bottom-top-18)/9;
        line(c,[[back,yy],[back+dir*(4+rnd(seed+1)*11),yy+3],[back+dir*(7+rnd(seed+2)*13),yy+2]],'#24414b');
        poly(c,[[xx-3,top],[xx+3,top],[xx+1,top+2+rnd(seed+4)*3]],p.rock);
        poly(c,[[xx-4,bottom],[xx+4,bottom],[xx+1,bottom-2-rnd(seed+5)*3]],p.rock);
        if(i%3===0)rect(c,xx,bottom-3,2,2,cave.id==='ember_cleft'?'#b58b68':'#699da1');
      }
      // The last few metres of rock form a clear, narrow throat, not a painted door.
      for(const yy of [ny-3,nb+3])line(c,[[nx-3,yy],[nr+3,yy]],'#2f515d',1);
    }
  }
  caveLabels(game) {
    const c=this.c;
    for(const cave of CAVES) {
      const detected=(game.contacts||[]).some(contact=>contact.id===cave.id);
      const visible=this.illuminated(game,cave.entrance.x,cave.entrance.y);
      if(!visible&&!detected&&game.currentCave?.id!==cave.id)continue;
      const [x,y]=this.world(cave.entrance.x,cave.entrance.y);if(y<20||y>this.height-25)continue;
      const direction=cave.side==='left'?1:-1;c.save();c.font='7px monospace';c.textAlign=direction===1?'left':'right';
      c.fillStyle=visible?'#c3dcd4':'#719b98';c.fillText(`${cave.side==='left'?'‹ ':''}${cave.name}${cave.side==='right'?' ›':''}`,x+direction*10,y-20);
      c.fillStyle='#7eaaa6';c.fillText('44 m 洞口 · 萤蛾号通行',x+direction*10,y-9);c.restore();
    }
  }
  tether(game,x,y) {
    if(!game.carrier)return;
    const c=this.c,[cx,cy]=this.world(game.carrier.x,game.carrier.y),range=game.carrier.tetherRange||500;
    const distance=Number.isFinite(game.tetherDistance)?game.tetherDistance:Math.hypot(game.player.x-game.carrier.x,game.player.y-game.carrier.y);
    const connected=game.tetherConnected??distance<=range;
    c.save();c.globalAlpha=.34;c.setLineDash([2,4]);line(c,[[cx,cy+14],[(cx+x)/2,(cy+y)/2+12],[x,y+8]],connected?'#79c5b4':'#e3988b');c.setLineDash([]);c.globalAlpha=1;
    c.font='7px monospace';c.textAlign='center';c.fillStyle=connected?'#acdacf':'#efac9d';
    c.fillText(connected?`系留余量 ${Math.max(0,Math.floor(range-distance))} m`:'系留中断 · 无母舰耐压保护',clamp(x,75,this.width-75),y+30);c.restore();
  }
  coral(x,y,dir,seed,depth,p,t) {
    const c=this.c,r=rnd(seed+61),color=depth>4000?(r>.5?'#aa79bc':'#54a7a5'):r>.65?'#d98eb2':r>.32?'#7c97b9':'#65c2b5';
    const lit=depth>4000?'#deb1db':r>.65?'#f5b3cd':r>.32?'#aab6dc':'#9fe3cc';
    c.save();c.translate(Math.round(x),Math.round(y));c.scale(dir,1);
    if(r>.48) {
      const hh=12+rnd(seed+2)*17;
      line(c,[[0,4],[1,-hh*.4],[-2,-hh]],color,3);
      line(c,[[1,-hh*.35],[7,-hh*.6],[8,-hh*.9]],color,3);
      line(c,[[0,-hh*.45],[-8,-hh*.68],[-8,-hh*.93]],color,3);
      line(c,[[4,-hh*.55],[11,-hh*.66],[12,-hh*.8]],color,2);
      rect(c,-3,-hh,3,3,lit);rect(c,7,-hh*.9,3,3,lit);rect(c,-9,-hh*.93,3,3,lit);rect(c,11,-hh*.8,3,2,lit);
    } else if(r>.23) {
      for(let j=0;j<3;j++) { const hh=9+rnd(seed+j+7)*16;rect(c,j*5-5,-hh,4,hh,color);rect(c,j*5-5,-hh,4,2,lit);rect(c,j*5-4,-hh+2,2,3,p.shadow); }
    } else {
      for(let j=0;j<4;j++) { const yy=-j*4;rect(c,-j*2-3,yy,13+j*3,3,color);rect(c,-j*2-3,yy,13+j*3,1,lit); }
    }
    c.restore();
  }
  weed(x,y,dir,seed,t,p) {
    const c=this.c;
    for(let j=0;j<3;j++) {
      const points=[],height=20+rnd(seed+j)*27;
      for(let k=0;k<6;k++)points.push([x+j*3+Math.sin(t*.7+k*.8+seed)*k*.8,y-k*height/5]);
      line(c,points,j===1?'#529b90':'#377d7a',2);
      for(let k=1;k<5;k++) { const [xx,yy]=points[k];rect(c,xx-(k%2?4:0),yy,5,2,j===1?'#71afa0':'#448d80'); }
    }
  }
  distantLife(p,t,game) {
    // Pelagic darkness is deliberately empty; large animals are discoveries.
    if(game.player.y>=1000)return;
    const c=this.c,w=this.width,h=this.height,s=this.scale;
    for(let layer=0;layer<2;layer++) {
      const span=730,top=Math.floor(this.cameraY/span)-1,bottom=(this.cameraY+h/s)/span+1;
      for(let n=top;n<bottom;n++) {
        const seed=n*101+layer*301,wy=n*span+195+layer*350;
        const xx=460+Math.sin(t*.055+seed)*220,[x,y]=this.world(xx,wy);
        if(y<-50||y>h+70||wy>=1000||(wy>250&&(n+layer)%3!==0))continue;
        c.save();c.translate(x,y);c.globalAlpha=layer?.18:.22;
        specimen(c,{kind:n%3===0?'ray':'whale',color:'#6dc4c1',accent:'#5ba3b2'},t*.4,layer?1.3:2.1,rnd(seed)>.5?1:-1);c.restore();
      }
    }
    for(let i=0;i<13;i++) {
      const wy=Math.floor(this.cameraY/520)*520+i*47;
      if(wy>600&&i%5!==0)continue;
      const [x,y]=this.world(140+rnd(i+27)*720+Math.sin(t*.12+i)*35,wy);
      c.globalAlpha=.17;
      for(let j=0;j<7;j++) { const xx=x+(j%4)*9,yy=y+Math.floor(j/4)*9+Math.sin(j)*5;rect(c,xx,yy,5,2,'#a1dad2');rect(c,xx+5,yy-1,2,4,'#a1dad2'); }
    }c.globalAlpha=1;
  }
  smallLife(p,t,game) {
    const c=this.c,s=this.scale,h=this.height;
    for(let n=Math.floor(this.cameraY/90)-1;n<(this.cameraY+h/s)/90+1;n++) {
      const seed=n*113+49,wy=n*90+30,xx=150+rnd(seed)*700+Math.sin(t*.3+seed)*30,[x,y]=this.world(xx,wy);
      const ecology=this.ecologyAt(xx,wy);
      if(rnd(seed+11)>ecology||wy>=1000&&!this.illuminated(game,xx,wy))continue;
      c.globalAlpha=.45;
      const facing=rnd(seed+4)>.5?1:-1;
      for(let j=0;j<(wy>=1000?2:3+Math.floor(rnd(seed+1)*5));j++) {
        const bx=x+j*9*facing,by=y+Math.sin(j*2+seed)*9+Math.sin(t+j)*2;
        poly(c,[[bx,by],[bx+5*facing,by-2],[bx+9*facing,by],[bx+5*facing,by+2]],n%3===0?'#80d5c8':'#6da9bb');
        poly(c,[[bx,by],[bx-3*facing,by-2],[bx-3*facing,by+2]],'#78b7ba');
      }
    }c.globalAlpha=1;
  }
  creaturePose(e,x,y) {
    const s=speciesById.get(e.speciesId)||{},art=getSpeciesArt(s),size=art.worldScale;
    const grounded=art.anchored||['benthic','sessile'].includes(e.behavior||s.behavior),attachment=e.attachment;
    if(!grounded||!attachment)return {x,y,rotation:0};
    const feet=(art.supportY||art.height*.35)*size;
    if(attachment.side==='floor')return {x,y:this.world(e.x,attachment.anchorY)[1]-feet,rotation:0};
    const anchorX=this.world(attachment.anchorX,e.y)[0],direction=attachment.side==='left'?1:-1;
    return {x:anchorX+direction*feet,y,rotation:direction*Math.PI/2};
  }
  entity(e,x,y,t,p) {
    const c=this.c,seed=hash(e.id),phase=t+seed;
    if(e.type==='mineral') {
      const attachment=e.attachment||{side:'floor',anchorX:e.x,anchorY:e.y+12};
      const [ax,ay]=this.world(attachment.anchorX,attachment.anchorY);
      c.save();c.translate(ax,ay);c.rotate(attachment.side==='left'?Math.PI/2:attachment.side==='right'?-Math.PI/2:0);c.scale(this.scale/.6,this.scale/.6);
      // The dark foot is embedded in its parent rock, with veins growing outwards.
      poly(c,[[-15,5],[-14,-2],[-9,-8],[-4,-11],[3,-9],[8,-4],[14,-1],[16,5]],p.rock);
      poly(c,[[-11,2],[-8,-6],[-3,-9],[1,-6],[6,-5],[11,1]],'#3e747b');
      line(c,[[-12,2],[-5,-1],[-3,-7],[1,-4],[7,-5],[10,1]],'#98d3c5',2);
      line(c,[[-7,3],[-3,-1],[3,0],[7,3]],'#6caaa9',2);
      poly(c,[[-4,-4],[-3,-12],[1,-15],[4,-9],[1,-3]],'#b3dccd');
      poly(c,[[4,-1],[6,-8],[10,-10],[11,-5],[8,1]],'#74b3b5');
      rect(c,0,-12,1,5,'#e2efcd');if(Math.sin(t*2+seed)>.94)rect(c,-1,-16,2,2,'#e9ffe3');
      c.restore();return;
    }
    const s=speciesById.get(e.speciesId)||{},art=getSpeciesArt(s),size=art.worldScale;
    const grounded=art.anchored||['benthic','sessile'].includes(e.behavior||s.behavior),pose=this.creaturePose(e,x,y);
    if(grounded&&e.attachment?.wallSide){
      const a=e.attachment,[wx,wy]=this.world(a.wallAnchorX,a.anchorY),[ax]=this.world(a.anchorX,a.anchorY),dir=a.wallSide==='left'?1:-1;
      poly(c,[[wx,wy-2],[ax+dir*11,wy-2],[ax+dir*15,wy+4],[ax,wy+10],[wx,wy+13]],p.rock);
      line(c,[[wx,wy-2],[ax+dir*11,wy-2]],p.rim,2);
    }
    x=pose.x;y=pose.y;
    const bob=grounded?0:Math.sin(phase*(s.behavior==='pulse'?2.1:s.behavior==='jet'?2.8:1.1))*art.bob;
    if(art.emissive) {
      const a=c.createRadialGradient(x,y,0,x,y,26);a.addColorStop(0,`${s.color||'#75c9d1'}22`);a.addColorStop(1,`${s.color||'#75c9d1'}00`);c.fillStyle=a;c.fillRect(x-27,y-27,54,54);
    }
    c.save();c.translate(x,y+bob);c.rotate(pose.rotation);
    specimen(c,s,phase,size,Number.isFinite(e.facing)?e.facing:rnd(seed)>.5?1:-1);c.restore();
    if(e.sampled){line(c,[[x+12,y-15],[x+14,y-12],[x+19,y-18]],'#80b8a6');}
    else if(e.surveyUntil>(this.game?.elapsed||0)){c.globalAlpha=.7;for(const side of [-1,1])line(c,[[x+side*18,y-11],[x+side*18,y-15],[x+side*13,y-15]],'#c9b3e6');c.globalAlpha=1;}
  }
  particles(p,t,depth) {
    const c=this.c,w=this.width,h=this.height;
    for(let i=0;i<94;i++) {
      const x=(rnd(i*101+38)*w+Math.sin(t*.16+i)*5+w)%w;
      const y=((rnd(i*29+61)*h-t*(1+rnd(i)*3)-this.cameraY*this.scale*.18)%(h+20)+h+20)%(h+20)-10;
      c.globalAlpha=.15+rnd(i+82)*.4;rect(c,x,y,i%7===0?2:1,i%7===0?2:1,i%9===0?'#e5ddb4':'#a0d4cf');
      if(i%18===0){c.strokeStyle='#91d2ca';c.lineWidth=1;c.strokeRect(Math.round(x),Math.round(y),3,3);}
    }c.globalAlpha=1;
  }
  visibility(game) {
    return game.visibility||{ambientRadius:game.player.y<200?1000:game.player.y<1000?120:52,beamRange:190,beamCos:.84,sonarRadius:650};
  }
  heading(game) {
    const h=game.player.heading;
    if(h&&Math.hypot(h.x,h.y)>.01){const length=Math.hypot(h.x,h.y);return {x:h.x/length,y:h.y/length};}
    return {x:game.player.facing===-1||game.player.facing==='left'?-1:1,y:0};
  }
  illuminated(game,x,y) {
    const dx=x-game.player.x,dy=y-game.player.y,distance=Math.hypot(dx,dy),v=this.visibility(game),heading=this.heading(game);
    const targetAmbient=y<200?640:y<1000?105:y<4000?52:38;
    const inLight=distance<=Math.min(v.ambientRadius,targetAmbient)||(distance<=v.beamRange&&(distance<1||(dx*heading.x+dy*heading.y)/distance>=v.beamCos));
    return inLight&&hasLineOfSight(game.player.x,game.player.y,x,y);
  }
  entityVisible(game,entity) {
    return typeof game.isEntityVisible==='function'?game.isEntityVisible(entity):this.illuminated(game,entity.x,entity.y)||(entity.scannedUntil||0)>(game.elapsed||0);
  }
  lightPolygon(game,range,start,end,steps,cone=false) {
    const {x,y}=game.player,points=cone?[this.world(x,y)]:[];
    for(let i=0;i<=steps;i++) {
      const a=start+(end-start)*i/steps,dx=Math.cos(a),dy=Math.sin(a);
      let distance=range;
      if(!hasLineOfSight(x,y,x+dx*distance,y+dy*distance)) {
        let lo=0,hi=distance;
        for(let j=0;j<7;j++){const mid=(lo+hi)/2;if(hasLineOfSight(x,y,x+dx*mid,y+dy*mid))lo=mid;else hi=mid;}
        distance=lo;
      }
      points.push(this.world(x+dx*distance,y+dy*distance));
    }
    return points;
  }
  vision(game,x,y) {
    const depth=game.player.y,inCave=Boolean(game.currentCave||getCaveAt(game.player.x,game.player.y));
    if(depth<200&&!inCave)return;
    const m=this.m,w=this.width,h=this.height,v=this.visibility(game),heading=this.heading(game),angle=Math.atan2(heading.y,heading.x);
    const darkness=inCave?1:depth>=1000?1:.32+.68*clamp((depth-200)/800,0,1);
    m.clearRect(0,0,w,h);m.globalCompositeOperation='source-over';m.fillStyle=`rgba(1,5,10,${darkness})`;m.fillRect(0,0,w,h);
    m.globalCompositeOperation='destination-out';
    const radius=Math.max(1,v.ambientRadius*this.scale),range=Math.max(1,v.beamRange*this.scale),halfAngle=Math.acos(clamp(v.beamCos,-1,1));
    const ambient=this.lightPolygon(game,v.ambientRadius,0,TAU,56);
    m.save();m.beginPath();ambient.forEach(([xx,yy],i)=>i?m.lineTo(xx,yy):m.moveTo(xx,yy));m.closePath();m.clip();
    const radial=m.createRadialGradient(x,y,0,x,y,radius);radial.addColorStop(0,'#000000');radial.addColorStop(.65,'#000000f0');radial.addColorStop(1,'#00000000');m.fillStyle=radial;m.fillRect(x-radius,y-radius,radius*2,radius*2);m.restore();
    const cone=this.lightPolygon(game,v.beamRange,angle-halfAngle,angle+halfAngle,36,true);
    const beam=m.createRadialGradient(x,y,0,x,y,range);beam.addColorStop(0,'#000000');beam.addColorStop(.72,'#000000dd');beam.addColorStop(.94,'#00000070');beam.addColorStop(1,'#00000000');
    poly(m,cone,beam);
    m.globalCompositeOperation='source-over';this.c.drawImage(this.mask,0,0);
  }
  sonarHighlights(game,t) {
    const sonar=game.sonar||{},remaining=sonar.remaining||0;
    if(remaining<=0&&!(game.entities||[]).some(e=>e.alive!==false&&(e.scannedUntil||0)>(game.elapsed||0)))return;
    const c=this.c,origin=sonar.origin||game.player,v=this.visibility(game),strength=clamp(remaining/.8,0,1);
    const maxRadius=sonar.radius||v.sonarRadius||650;
    const waveRadius=remaining<=0?Infinity:Number.isFinite(sonar.waveRadius)?sonar.waveRadius:Math.min(maxRadius,Math.max(0,(sonar.duration||4)-remaining)*900);
    const [ox,oy]=this.world(origin.x,origin.y),r=waveRadius*this.scale;
    if(remaining>0) {
    c.save();
    // A pulse traces the boundary of solid rock; it never removes the fog mask.
    c.beginPath();c.arc(ox,oy,Math.max(.1,r),0,TAU);c.clip();c.globalAlpha=strength*.18;
    const worldTop=this.cameraY,worldBottom=this.cameraY+this.height/this.scale;
    for(const side of ['left','right']) {
      const wx=side==='left'?CANYON.left:CANYON.right;
      for(let yy=worldTop;yy<worldBottom;yy+=8) {
        const opening=CAVES.some(cave=>cave.side===side&&yy>=cave.throat.top&&yy<=cave.throat.bottom);
        if(!opening)line(c,[this.world(wx,yy),this.world(wx,Math.min(yy+8,worldBottom))],'#70c9bd');
      }
    }
    for(const cave of CAVES) {
      const b=cave.bounds,n=cave.throat,back=cave.side==='left'?b.left:b.right,front=cave.side==='left'?b.right:b.left,wall=cave.side==='left'?CANYON.left:CANYON.right;
      line(c,[[wall,n.top],[front,n.top],[front,b.top],[back,b.top],[back,b.bottom],[front,b.bottom],[front,n.bottom],[wall,n.bottom]].map(([xx,yy])=>this.world(xx,yy)),'#70c9bd');
    }
    c.restore();
    c.save();c.globalAlpha=strength*.28;c.strokeStyle='#8fe6ce';c.lineWidth=1;c.beginPath();c.arc(ox,oy,Math.max(.1,r),0,TAU);c.stroke();
    c.restore();
    }
    c.save();
    for(const e of game.entities||[]) {
      if(e.alive===false||(e.scannedUntil||0)<=(game.elapsed||0)||!this.entityVisible(game,e)||this.illuminated(game,e.x,e.y))continue;
      if(Math.hypot(e.x-origin.x,e.y-origin.y)>waveRadius)continue;
      const [wx,wy]=this.world(e.x,e.y),pose=e.type==='creature'?this.creaturePose(e,wx,wy):{x:wx,y:wy};
      const {x,y}=pose;if(y<-20||y>this.height+20)continue;
      const echoStrength=clamp(((e.scannedUntil||0)-(game.elapsed||0))/.8,0,1);
      c.globalAlpha=echoStrength*(.35+.12*Math.sin(t*4+hash(e.id)));c.strokeStyle=e.biologicalScan?'#c1a8dc':e.type==='mineral'?'#a6bd9b':'#81c6bc';
      const echo=e.type==='mineral'?[[x,y-4],[x+4,y],[x,y+4],[x-4,y],[x,y-4]]:[[x-6,y],[x-2,y-3],[x+5,y],[x-2,y+3],[x-6,y]];
      line(c,echo,c.strokeStyle);rect(c,x+9,y,1,1,c.strokeStyle);
    }
    c.restore();
  }
  target({e,x,y},t) {
    const c=this.c,r=19+Math.sin(t*3)*1.5,color='#c9f6d8';
    c.globalAlpha=.75;
    for(const sx of [-1,1])for(const sy of [-1,1])line(c,[[x+sx*r,y+sy*(r-5)],[x+sx*r,y+sy*r],[x+sx*(r-5),y+sy*r]],color);
    c.globalAlpha=1;
    const observation=this.game?.isObservationTarget?.(e);
    const label=e.type==='mineral'?'E  采集':observation?'E  无损观测':'E  捕获';
    c.font='8px monospace';c.textAlign='center';const ww=c.measureText(label).width+10;rect(c,x-ww/2,y+r+7,ww,14,'#062a35cc');c.fillStyle='#d4eee3';c.fillText(label,x,y+r+17);
  }
  wonders(game,p,t) {
    for(const wonder of game.wonders||[]) {
      const [x,y]=this.world(wonder.x,wonder.y);if(y<-200||y>this.height+200)continue;
      this.wonder(wonder.id,x,y,p,t,wonder.discovered);
    }
  }
  wonder(id,x,y,p,t,discovered) {
    const c=this.c;c.save();c.translate(x,y);
    if(id==='coral_gate') {
      // The first landmark: a reef grown over a vast broken stone arch.
      const outer=[[-75,65],[-72,13],[-59,-27],[-35,-53],[-4,-61],[27,-54],[52,-28],[62,6],[65,61],[42,61],[35,4],[22,-19],[0,-27],[-23,-18],[-40,7],[-45,65]];
      poly(c,outer,'#204b5b');
      line(c,[[-73,20],[-59,-26],[-35,-51],[-4,-59],[27,-52],[50,-27],[61,6]],'#427d83',3);
      line(c,[[-45,57],[-40,7],[-23,-18],[0,-27],[22,-19],[35,4],[42,56]],'#163949',4);
      for(let i=0;i<12;i++){const a=Math.PI+i*Math.PI/11,xx=Math.cos(a)*60,yy=10+Math.sin(a)*62;this.coral(xx,yy,i<6?1:-1,111+i*19,160,p,t);}
      for(let i=0;i<27;i++){const a=rnd(i+334)*Math.PI+Math.PI,rr=45+rnd(i+998)*15;rect(c,Math.cos(a)*rr,12+Math.sin(a)*rr,2,2,i%3?'#60b8b0':'#d59bb6');}
      for(let i=0;i<5;i++)this.weed(-67+i*4,58,1,95+i,t,p);
    } else if(id==='moon_garden') {
      poly(c,[[-100,53],[-65,31],[-36,38],[0,24],[31,38],[65,30],[100,55]],'#1d394a');
      for(let i=0;i<11;i++) {
        const xx=-75+i*15,yy=18+Math.sin(i*2)*14;
        line(c,[[xx,45],[xx+Math.sin(t+i)*3,yy]],'#507f87',2);
        c.save();c.translate(xx,yy-8);specimen(c,{kind:'jelly',color:i%2?'#99a5d4':'#68c8c1',accent:'#b2e5df'},t+i,.55,1);c.restore();
      }
    } else if(id==='lost_station') {
      poly(c,[[-47,72],[-44,-59],[34,-59],[44,68]],'#233947');rect(c,-36,-56,66,121,'#354d56');
      rect(c,-43,-63,79,7,'#54757a');rect(c,-26,-77,44,14,'#253c48');rect(c,-3,-110,3,34,'#527a7f');
      for(let row=0;row<5;row++)for(let col=0;col<3;col++){rect(c,-28+col*19,-45+row*21,11,10,'#112c3a');if((row+col)%3===0)rect(c,-26+col*19,-43+row*21,7,6,'#6dc0bd');}
      line(c,[[-10,-60],[-18,-29],[-2,-9],[-8,25],[5,65]],'#182a38',3);
      for(let i=0;i<6;i++)this.coral(-38+i*13,66,1,910+i*4,1900,p,t);
      rect(c,0,-111,2,2,Math.sin(t*2)>.3?'#efa7aa':'#725c6c');
    } else if(id==='whale_fall') {
      c.save();c.rotate(-.16);
      line(c,[[-125,3],[-80,-3],[-25,0],[25,4],[90,7]],'#8f9d98',5);
      for(let i=0;i<12;i++){const xx=-80+i*12,hh=19+Math.sin(i/12*Math.PI)*22;line(c,[[xx,0],[xx-7,-hh*.6],[xx-5,-hh],[xx+2,-hh-3],[xx+8,-hh*.6],[xx+7,1]],'#a5aaa0',3);line(c,[[xx,1],[xx-3,hh*.6],[xx+4,hh],[xx+8,hh*.5]],'#718b88',2);}
      poly(c,[[75,3],[93,-18],[122,-13],[139,2],[127,18],[95,20]],'#a7afa0');poly(c,[[111,-7],[123,-7],[128,2],[116,5]],'#334c52');line(c,[[96,14],[132,8]],'#3f5557',2);
      poly(c,[[-120,0],[-143,-18],[-146,-7],[-131,4],[-146,18],[-137,23]],'#8b9c97');c.restore();
      for(let i=0;i<7;i++)this.coral(-90+i*29,38,1,130+i*31,3600,p,t);
    } else if(id==='black_smoker') {
      for(let i=0;i<5;i++) {
        const xx=-60+i*27,hh=38+rnd(i+617)*60;
        poly(c,[[xx-12,60],[xx-9,-hh+40],[xx-4,-hh+30],[xx+6,-hh+32],[xx+10,60]],'#30434a');
        line(c,[[xx-7,53],[xx-5,-hh+38],[xx+2,-hh+35]],'#69776b',2);
        rect(c,xx-4,-hh+31,9,3,'#e3b279');
        for(let j=0;j<14;j++){const age=(t*.18+j/14)%1,yy=-hh+30-age*100,wid=3+age*14;c.globalAlpha=(1-age)*.24;rect(c,xx+Math.sin(age*9+i)*13-wid/2,yy,wid,6+age*12,'#75918a');}c.globalAlpha=1;
      }
      for(let i=0;i<22;i++)rect(c,-72+rnd(i+834)*145,54+rnd(i+21)*12,2,2,i%2?'#e6bf93':'#a4c6a7');
    } else if(id==='ancient_ring') {
      const r=65;
      c.lineWidth=14;c.strokeStyle='#424257';c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();
      c.lineWidth=2;c.strokeStyle='#69647b';c.beginPath();c.arc(0,0,r+6,0,TAU);c.stroke();
      const glow=c.createRadialGradient(0,0,0,0,0,r);glow.addColorStop(0,'#ba83e50a');glow.addColorStop(.7,'#9b8edd17');glow.addColorStop(1,'#a2d3e747');c.fillStyle=glow;c.beginPath();c.arc(0,0,r-8,0,TAU);c.fill();
      for(let i=0;i<16;i++){const a=i*TAU/16,xx=Math.cos(a)*r,yy=Math.sin(a)*r;c.save();c.translate(xx,yy);c.rotate(a);rect(c,-3,-4,4,9,i%3?'#9dc8d3':'#c2a8e7');rect(c,1,-3,2,2,'#e1ceeb');c.restore();}
      poly(c,[[-85,95],[-56,69],[-40,55],[-30,67],[34,65],[57,76],[82,96]],'#2d3247');
    } else if(id==='last_light') {
      // A mineral cathedral grows around the planet's luminous, fractured crust.
      const halo=c.createRadialGradient(0,28,4,0,8,150);halo.addColorStop(0,'#83f8f57a');halo.addColorStop(.35,'#5acfe438');halo.addColorStop(1,'#79d8ff00');c.fillStyle=halo;c.fillRect(-155,-145,310,310);
      for(let i=0;i<5;i++) {
        const xx=-48+i*24,top=-145+rnd(i+201)*40;
        const shaft=c.createLinearGradient(xx,38,xx,top);shaft.addColorStop(0,'#a0fff649');shaft.addColorStop(1,'#8edbff00');
        poly(c,[[xx-5,38],[xx+6,38],[xx+20,top],[xx-18,top]],shaft);
      }
      poly(c,[[-155,74],[-140,35],[-117,21],[-93,39],[-61,27],[-35,43],[0,36],[27,39],[52,25],[84,37],[119,23],[143,43],[155,77]],'#263747');
      for(let i=0;i<10;i++) {
        const side=i<5?-1:1,n=i%5,xx=side*(40+n*20),base=39+rnd(i+360)*13;
        const height=38+rnd(i+190)*58+(n===1?43:0),ww=8+rnd(i+113)*8;
        poly(c,[[xx-ww,base],[xx-ww*.8,base-height*.7],[xx,base-height],[xx+ww*.8,base-height*.73],[xx+ww,base]],i%2?'#376c83':'#437d99');
        poly(c,[[xx,base-height],[xx+ww*.8,base-height*.73],[xx+ww,base],[xx+1,base-5]],i%2?'#71b8c9':'#8acbdc');
        poly(c,[[xx,base-height],[xx-ww*.8,base-height*.7],[xx-ww,base],[xx-3,base-5]],'#498fa6');
        line(c,[[xx,base-height+2],[xx+2,base-10]],'#b9f1ed',1);
        rect(c,xx-1,base-height,2,3,'#ddfff6');
      }
      const crack=[[-117,53],[-86,45],[-60,53],[-31,43],[-11,49],[7,38],[28,47],[56,41],[79,49],[114,39]];
      line(c,crack,'#0a253b',13);line(c,crack,'#468ca6',8);line(c,crack,'#8cecf0',4);line(c,crack,'#e1fff1',1);
      line(c,[[-31,43],[-35,61],[-56,72]],'#8cecf0',2);line(c,[[28,47],[36,64],[30,75]],'#8cecf0',2);
      for(let i=0;i<28;i++) {
        const age=(t*.12+rnd(i+908))%1,xx=-110+rnd(i+400)*220+Math.sin(age*7+i)*5,yy=42-age*(65+rnd(i+280)*85);
        c.globalAlpha=(1-age)*(.45+rnd(i+70)*.55);rect(c,xx,yy,i%6===0?2:1,i%6===0?3:1,'#d1fff4');
      }
      c.globalAlpha=1;
    }
    c.restore();
  }
  renderEffects(t) {
    this.effects=this.effects.filter(f=>t-f.start<1.5);
    const c=this.c;
    for(const f of this.effects) {
      const [x,y]=this.world(f.x,f.y),age=t-f.start;
      c.globalAlpha=Math.max(0,1-age/1.5);
      for(let i=0;i<12;i++) { const a=i/12*TAU,r=age*32;rect(c,x+Math.cos(a)*r,y+Math.sin(a)*r-age*9,2,2,f.type==='level'?'#f4dc91':'#a1f3d9'); }
      c.globalAlpha=1;
    }
  }
}
