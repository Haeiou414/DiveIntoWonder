import { SPECIES } from './data.js';

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
  const color=s?.color||'#90e5d7', accent=s?.accent||'#f2e9b2', kind=s?.kind||'fish';
  c.save();c.scale(factor*facing,factor);
  if(kind==='jelly') {
    const sway=Math.sin(t*2)*2;
    for(let i=-3;i<=3;i++) {
      line(c,[[i*3,3],[i*3+sway,10],[i*3-sway*.6,16+(i%2)*3],[i*3+sway,22]],i%2?color:accent,1);
    }
    poly(c,[[-13,0],[-11,-6],[-6,-11],[5,-11],[11,-6],[13,1],[9,4],[-9,4]],color);
    rect(c,-9,-6,17,6,accent);rect(c,-6,-9,11,3,color);
    rect(c,-8,1,3,3,accent);rect(c,0,2,3,3,accent);rect(c,7,1,3,3,accent);
    rect(c,-5,-7,3,2,'#ffffff');
  } else if(kind==='eel') {
    const points=[];
    for(let i=0;i<11;i++) points.push([-27+i*5,Math.sin(i*.65+t*3)*(5-i*.2)]);
    line(c,points,color,5);line(c,points.map(([x,y])=>[x,y-2]),accent,1);
    rect(c,19,-5,10,8,color);rect(c,25,-4,2,2,'#eaffef');rect(c,26,-4,1,1,'#112d40');
  } else if(kind==='octopus'||kind==='squid') {
    for(let i=-3;i<=3;i++) line(c,[[i*2,3],[i*3,10],[i*5+Math.sin(t*3+i)*3,13+Math.cos(i)*4],[i*5+Math.sin(t*3+i)*4,17]],i%2?accent:color,2);
    poly(c,[[-9,3],[-10,-7],[-5,-15],[4,-15],[10,-8],[9,4],[5,8],[-5,8]],color);
    if(kind==='squid') { poly(c,[[-8,-6],[-18,0],[-7,3]],accent);poly(c,[[8,-6],[17,0],[7,3]],accent); }
    rect(c,-6,-9,8,3,accent);rect(c,-7,0,4,4,'#e8f4ef');rect(c,3,0,4,4,'#e8f4ef');rect(c,-5,1,2,2,'#193046');rect(c,4,1,2,2,'#193046');
  } else if(kind==='ray') {
    const flap=Math.sin(t*2)*4;
    poly(c,[[-24,-3+flap],[-9,-7],[-2,-11],[7,-6],[25,-3+flap],[12,5],[3,8],[-9,6]],color);
    poly(c,[[-18,-1+flap],[-5,-5],[-2,6]],accent);poly(c,[[18,-1+flap],[5,-5],[2,6]],accent);
    line(c,[[0,7],[1,17],[Math.sin(t)*3,25]],color,2);rect(c,-4,-5,2,2,'#d9ffff');rect(c,3,-5,2,2,'#d9ffff');
  } else if(kind==='whale') {
    poly(c,[[-39,-3],[-30,-12],[-9,-17],[20,-12],[35,-4],[39,6],[25,12],[2,14],[-28,8],[-40,2],[-48,-8],[-50,9]],color);
    poly(c,[[-28,5],[1,9],[33,4],[27,10],[0,12]],accent);poly(c,[[-5,7],[10,23],[16,18],[11,8]],color);
    rect(c,26,-2,3,3,'#e8ffff');rect(c,28,-2,1,2,'#123343');line(c,[[19,7],[29,6],[35,3]],accent);
  } else if(kind==='crab') {
    for(let i=0;i<3;i++) { line(c,[[-7,i*3-1],[-15,i*5-3],[-18,i*5]],accent,2);line(c,[[7,i*3-1],[15,i*5-3],[18,i*5]],accent,2); }
    rect(c,-8,-5,17,12,color);rect(c,-5,-8,11,4,accent);
    line(c,[[-7,-3],[-14,-10],[-17,-13]],color,3);line(c,[[7,-3],[14,-10],[17,-13]],color,3);
    rect(c,-20,-15,7,6,accent);rect(c,14,-15,7,6,accent);rect(c,-6,-7,3,3,'#ffffff');rect(c,4,-7,3,3,'#ffffff');
  } else if(kind==='shrimp') {
    poly(c,[[-14,3],[-8,-6],[3,-7],[11,-1],[13,5],[3,7],[-7,7]],color);
    for(let i=-2;i<4;i++)line(c,[[i*3,5],[i*3+2,11]],accent);
    line(c,[[10,-2],[19,-8],[24,-9]],accent);line(c,[[9,-3],[15,-12],[20,-14]],accent);
    rect(c,8,-4,3,3,'#ffffff');poly(c,[[-12,2],[-20,-3],[-20,8]],accent);
  } else {
    poly(c,[[-14,0],[-22,-7],[-22,7]],color);
    poly(c,[[-14,-4],[-6,-8],[7,-8],[15,-3],[18,1],[12,6],[-6,7],[-14,3]],color);
    poly(c,[[-6,-7],[0,-13],[5,-8]],accent);poly(c,[[-4,6],[3,12],[7,6]],accent);
    rect(c,-9,-3,18,2,accent);rect(c,9,-4,4,4,'#edfff5');rect(c,11,-3,2,2,'#163344');
    rect(c,-17,-2,3,4,accent);
  }
  c.restore();
}
function submarine(c, id, t=0, facing=1, moving=false) {
  c.save();c.scale(facing,1);
  const whale=id==='whale', ray=id==='ray', body=whale?'#c2c9c3':ray?'#b6d9cc':'#e4d6a0';
  if(moving) {
    for(let i=0;i<7;i++) { const p=((t*2+i*.147)%1),xx=-27-p*31,yy=Math.sin(i*2+t*5)*4;c.globalAlpha=(1-p)*.7;rect(c,xx,yy,2+i%2,2,'#a0f5ec'); }c.globalAlpha=1;
  }
  if(whale) {
    poly(c,[[-34,-10],[-26,-17],[24,-17],[37,-7],[40,8],[28,17],[-26,17],[-35,10]],'#344b58');
    rect(c,-27,-15,50,28,body);rect(c,-22,-15,39,4,'#e6dfb7');rect(c,-22,9,43,5,'#7d8b88');
    rect(c,-13,-22,24,7,'#a4b8ac');rect(c,-8,-24,14,3,'#d9e2c3');
    rect(c,-22,14,19,4,'#5d7f81');rect(c,-36,-6,9,16,'#748b8e');
    for(let x=-16;x<=12;x+=14){rect(c,x,-7,11,13,'#294c5a');rect(c,x+2,-5,7,9,'#6ce0d5');rect(c,x+3,-4,3,3,'#dcffff');}
    poly(c,[[24,-10],[35,-4],[35,8],[25,12]],'#e3d8a7');rect(c,34,-3,5,7,'#ecf8bc');
    rect(c,-25,19,24,3,'#d9c792');rect(c,-17,16,3,6,'#819a9a');
  } else if(ray) {
    poly(c,[[-20,-9],[-9,-12],[12,-9],[26,-2],[20,8],[-12,11],[-24,5]],'#385663');
    poly(c,[[-19,-7],[-7,-10],[13,-7],[24,-1],[18,7],[-12,8],[-21,3]],body);
    poly(c,[[-9,-9],[-18,-20],[4,-13],[10,-8]],'#77b8b5');poly(c,[[-10,8],[-19,18],[6,12],[13,6]],'#77b8b5');
    rect(c,4,-7,12,12,'#234b60');rect(c,6,-5,8,8,'#7ff3e2');rect(c,7,-5,5,2,'#e4fff8');
    rect(c,-25,-5,7,11,'#436a78');rect(c,-25,-3,2,7,'#80e2d9');rect(c,22,-1,4,4,'#e9fac8');
    rect(c,-11,-5,8,2,'#e8f2d0');rect(c,-10,3,6,2,'#5b8f93');
  } else {
    rect(c,-19,-11,26,3,'#f0e4b2');rect(c,-22,-8,35,17,body);
    poly(c,[[10,-9],[20,-5],[24,1],[21,7],[12,10]],'#e8dbad');
    rect(c,-18,8,30,4,'#aca178');rect(c,-18,11,28,2,'#456271');
    rect(c,-17,-16,10,5,'#9cae9e');rect(c,-14,-20,3,5,'#d4cfab');rect(c,-14,-21,8,2,'#e4d8ac');
    rect(c,-25,-5,7,12,'#516d72');rect(c,-27,-3,3,8,'#759d96');rect(c,-26,-2,2,6,'#b1eee1');
    rect(c,3,-8,14,15,'#466775');rect(c,5,-6,10,11,'#64d8d2');rect(c,6,-5,7,3,'#cefff1');rect(c,12,1,2,3,'#359bae');
    rect(c,-14,-6,9,2,'#faf0c5');rect(c,-14,-1,5,3,'#8d9782');rect(c,-14,4,10,2,'#aaa57c');
    rect(c,21,-2,4,5,'#edffd3');rect(c,-7,-11,5,2,'#b98f52');rect(c,-5,-12,2,1,'#edb674');
    line(c,[[-7,13],[-7,17],[8,17],[12,13]],'#758c88',2);
  }
  c.restore();
}
export function drawSpecimen(canvas, speciesId, scale=1) {
  if(!canvas)return;
  const c=canvas.getContext('2d'),w=canvas.width||100,h=canvas.height||80;
  c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;c.save();c.translate(Math.round(w/2),Math.round(h/2));
  const s=speciesById.get(speciesId);specimen(c,s,0,Math.min(w/64,h/56)*scale,1);c.restore();
}
export function drawVehicle(canvas, vehicleId) {
  if(!canvas)return;
  const c=canvas.getContext('2d'),w=canvas.width||120,h=canvas.height||80;
  c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;c.save();c.translate(Math.round(w/2),Math.round(h/2));
  const zoom=Math.min(w/(vehicleId==='whale'?100:75),h/65);c.scale(zoom,zoom);submarine(c,vehicleId,0,1,false);c.restore();
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
    this.time=timeSeconds??performance.now()/1000;
    const {player}=game,c=this.c,w=this.width,h=this.height,t=this.time;
    this.cameraY=player.y-h*.46/this.scale;
    const p=palette(player.y),[px,py]=this.world(player.x,player.y);
    const facing=player.facing===-1||player.facing==='left'?-1:1;
    this.background(p,t,player.y);
    this.distantLife(p,t);
    this.terrain(p,t,true);
    this.wonders(game,p,t);
    this.terrain(p,t,false);
    this.smallLife(p,t);
    if(game.carrier) {
      const [cx,cy]=this.world(game.carrier.x,game.carrier.y);
      c.save();c.translate(cx,cy);submarine(c,'whale',t,1,false);c.restore();
      c.font='8px monospace';c.textAlign='center';c.fillStyle='#a9e5d8';c.fillText('鲸落号 · F 接驳',cx,cy+33);
      c.strokeStyle='#7bd7c355';c.setLineDash([3,5]);c.beginPath();c.arc(cx,cy,55,0,TAU);c.stroke();c.setLineDash([]);
    }
    // Soft searchlight: its wider end disappears into suspended particles.
    const beam=c.createLinearGradient(px,py,px+facing*190,py);beam.addColorStop(0,'#d5ffe42b');beam.addColorStop(1,'#a3ebed00');
    poly(c,[[px+facing*18,py-3],[px+facing*200,py-69],[px+facing*200,py+69],[px+facing*18,py+4]],beam);
    const nearby=[];
    for(const e of game.entities||[]) {
      if(e.alive===false)continue;
      const [x,y]=this.world(e.x,e.y);if(y<-65||y>h+65)continue;
      const dist=Math.hypot(e.x-player.x,e.y-player.y),range=game.stats?.captureRange||100;
      if(dist<=range)nearby.push({e,x,y,dist});
      this.entity(e,x,y,t,p);
    }
    this.particles(p,t,player.y);
    this.vision(game,px,py,facing);
    if(game.sonar?.remaining>0) {
      const elapsed=Math.max(0,4-game.sonar.remaining);
      for(let i=0;i<3;i++) { const r=((elapsed*.5+i*.32)%1)*Math.max(w,h)*.7;c.strokeStyle=`rgba(111,243,221,${Math.max(0,.33-r/950)})`;c.lineWidth=1;c.beginPath();c.arc(px,py,r,0,TAU);c.stroke(); }
      this.sonarHighlights(game,t);
    }
    // The vehicle is always legible, even at the limits of the lamp.
    c.save();c.translate(px,py+Math.sin(t*2.1)*1.2);
    const aura=c.createRadialGradient(0,0,4,0,0,53);aura.addColorStop(0,'#9cffe622');aura.addColorStop(1,'#7af8e500');c.fillStyle=aura;c.fillRect(-54,-54,108,108);
    const vehicle=typeof game.vehicle==='string'?game.vehicle:game.vehicle?.id||'moth';
    const moving=game.moving||game.boost||(this.previousPosition&&Math.hypot(player.x-this.previousPosition.x,player.y-this.previousPosition.y)>.01);
    submarine(c,vehicle,t,facing,moving);
    this.previousPosition={x:player.x,y:player.y};
    c.restore();
    if(nearby.length) { nearby.sort((a,b)=>a.dist-b.dist);this.target(nearby[0],t); }
    this.renderEffects(t);
    const vignette=c.createRadialGradient(w*.5,h*.43,h*.22,w*.5,h*.5,w*.62);vignette.addColorStop(0,'#00101d00');vignette.addColorStop(1,'#00101d60');c.fillStyle=vignette;c.fillRect(0,0,w,h);
    this.ctx.imageSmoothingEnabled=false;this.ctx.drawImage(this.buffer,0,0,this.canvas.width,this.canvas.height);
  }
  background(p,t,depth) {
    const c=this.c,w=this.width,h=this.height;
    const gradient=c.createLinearGradient(0,0,w*.3,h);gradient.addColorStop(0,p.top);gradient.addColorStop(.53,p.mid);gradient.addColorStop(1,p.bottom);c.fillStyle=gradient;c.fillRect(0,0,w,h);
    if(depth<1300) {
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
    const width=55+Math.sin(y*.012+side*2.2)*22+Math.sin(y*.032+side*7)*12+Math.sin(y*.004+side)*21+(far?35:0);
    return (side?1000-width:width)*this.scale;
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
        if(rnd(seed+5)>.57) {
          const cy=yy+7,cx=x-dir*3;
          this.coral(cx,cy,dir,seed,wy,p,t);
        }
        if(rnd(seed+7)>.78) this.weed(x-dir*8,yy,dir,seed,t,p);
      }
    }
    // Reef shelves occur at fixed depths, never jumping when the camera moves.
    for(let n=Math.floor(this.cameraY/450)-1;n<(this.cameraY+h/s)/450+1;n++) {
      if(n<0)continue;
      const wy=n*450+335,side=n%2,seed=n*71+399;
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
  distantLife(p,t) {
    const c=this.c,w=this.width,h=this.height,s=this.scale;
    for(let layer=0;layer<2;layer++) {
      const span=730,top=Math.floor(this.cameraY/span)-1,bottom=(this.cameraY+h/s)/span+1;
      for(let n=top;n<bottom;n++) {
        const seed=n*101+layer*301,wy=n*span+195+layer*350;
        const xx=460+Math.sin(t*.055+seed)*220,[x,y]=this.world(xx,wy);
        if(y<-50||y>h+70)continue;
        c.save();c.translate(x,y);c.globalAlpha=layer?.18:.22;
        specimen(c,{kind:n%3===0?'ray':'whale',color:'#6dc4c1',accent:'#5ba3b2'},t*.4,layer?1.3:2.1,rnd(seed)>.5?1:-1);c.restore();
      }
    }
    for(let i=0;i<13;i++) {
      const wy=Math.floor(this.cameraY/520)*520+i*47;
      const [x,y]=this.world(140+rnd(i+27)*720+Math.sin(t*.12+i)*35,wy);
      c.globalAlpha=.17;
      for(let j=0;j<7;j++) { const xx=x+(j%4)*9,yy=y+Math.floor(j/4)*9+Math.sin(j)*5;rect(c,xx,yy,5,2,'#a1dad2');rect(c,xx+5,yy-1,2,4,'#a1dad2'); }
    }c.globalAlpha=1;
  }
  smallLife(p,t) {
    const c=this.c,s=this.scale,h=this.height;
    for(let n=Math.floor(this.cameraY/90)-1;n<(this.cameraY+h/s)/90+1;n++) {
      const seed=n*113+49,wy=n*90+30,xx=150+rnd(seed)*700+Math.sin(t*.3+seed)*30,[x,y]=this.world(xx,wy);
      c.globalAlpha=.45;
      const facing=rnd(seed+4)>.5?1:-1;
      for(let j=0;j<3+Math.floor(rnd(seed+1)*5);j++) {
        const bx=x+j*9*facing,by=y+Math.sin(j*2+seed)*9+Math.sin(t+j)*2;
        poly(c,[[bx,by],[bx+5*facing,by-2],[bx+9*facing,by],[bx+5*facing,by+2]],n%3===0?'#80d5c8':'#6da9bb');
        poly(c,[[bx,by],[bx-3*facing,by-2],[bx-3*facing,by+2]],'#78b7ba');
      }
    }c.globalAlpha=1;
  }
  entity(e,x,y,t,p) {
    const c=this.c,seed=hash(e.id),phase=t+seed;
    if(e.type==='mineral') {
      c.save();c.translate(x,y);
      const aura=c.createRadialGradient(0,0,0,0,0,24);aura.addColorStop(0,'#94e9df20');aura.addColorStop(1,'#80f6df00');c.fillStyle=aura;c.fillRect(-24,-24,48,48);
      poly(c,[[-12,8],[-10,1],[-6,-3],[5,-2],[11,4],[12,10]],'#345966');
      poly(c,[[-7,4],[-5,-9],[0,-13],[3,-5],[1,6]],'#92d8cf');
      poly(c,[[-5,-9],[0,-13],[-1,4],[-7,4]],'#c5e9cb');
      poly(c,[[3,6],[4,-5],[9,-8],[12,-1],[9,7]],'#5eafaf');
      rect(c,5,-5,2,5,'#a2e1d1');if(Math.sin(t*2+seed)>.8){rect(c,-3,-16,1,5,'#edffe7');rect(c,-5,-14,5,1,'#edffe7');}
      c.restore();return;
    }
    const s=speciesById.get(e.speciesId)||{},size=s.kind==='whale'?.8:s.kind==='squid'&&e.speciesId==='leviathan'?1.5:.65+((s.size||1)>8?.15:0);
    const bob=Math.sin(phase*1.5)*3;
    if(['jelly','squid','octopus'].includes(s.kind)) {
      const a=c.createRadialGradient(x,y,0,x,y,26);a.addColorStop(0,`${s.color||'#75c9d1'}22`);a.addColorStop(1,`${s.color||'#75c9d1'}00`);c.fillStyle=a;c.fillRect(x-27,y-27,54,54);
    }
    c.save();c.translate(x,y+bob);specimen(c,s,phase,size,rnd(seed)>.5?1:-1);c.restore();
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
  vision(game,x,y,facing) {
    const depth=game.player.y;
    if(depth<200)return;
    const m=this.m,w=this.width,h=this.height;
    // The scan holds its expanded view, then gently returns to the searchlight.
    const scan=clamp((game.sonar?.remaining||0)/.9,0,1);
    m.clearRect(0,0,w,h);m.globalCompositeOperation='source-over';m.fillStyle=`rgba(1,8,20,${clamp((depth-200)/1700,.02,.74)*(1-scan*.3)})`;m.fillRect(0,0,w,h);
    m.globalCompositeOperation='destination-out';
    const lampRadius=Math.max(100,Math.min(260,(game.stats?.vision||230)*this.scale));
    const radius=mix(lampRadius,Math.max(lampRadius*2,650*this.scale),scan);
    const radial=m.createRadialGradient(x,y,radius*.15,x,y,radius);radial.addColorStop(0,'#000000');radial.addColorStop(.45,'#000000ee');radial.addColorStop(1,'#00000000');m.fillStyle=radial;m.fillRect(0,0,w,h);
    const beam=m.createLinearGradient(x,y,x+facing*radius*1.7,y);beam.addColorStop(0,'#000000cc');beam.addColorStop(1,'#00000000');
    poly(m,[[x,y-2],[x+facing*radius*1.7,y-radius*.6],[x+facing*radius*1.7,y+radius*.6],[x,y+2]],beam);
    m.globalCompositeOperation='source-over';this.c.drawImage(this.mask,0,0);
  }
  sonarHighlights(game,t) {
    const c=this.c,strength=clamp((game.sonar?.remaining||0)/.9,0,1);
    c.save();
    for(const e of game.entities||[]) {
      if(e.alive===false)continue;
      const distance=Math.hypot(e.x-game.player.x,e.y-game.player.y);
      if(distance>650||distance<(game.stats?.captureRange||100))continue;
      const [x,y]=this.world(e.x,e.y);if(y<-30||y>this.height+30)continue;
      const pulse=.5+.5*Math.sin(t*5-distance*.012),r=15+pulse*3;
      c.globalAlpha=strength*(.22+pulse*.2);
      const glow=c.createRadialGradient(x,y,2,x,y,25);glow.addColorStop(0,'#9affdf50');glow.addColorStop(1,'#9affdf00');c.fillStyle=glow;c.fillRect(x-25,y-25,50,50);
      for(const [dx,dy] of [[-r,0],[r,0],[0,-r],[0,r]])rect(c,x+dx,y+dy,2,2,'#baffec');
    }
    c.restore();
  }
  target({e,x,y},t) {
    const c=this.c,r=19+Math.sin(t*3)*1.5,color='#c9f6d8';
    c.globalAlpha=.75;
    for(const sx of [-1,1])for(const sy of [-1,1])line(c,[[x+sx*r,y+sy*(r-5)],[x+sx*r,y+sy*r],[x+sx*(r-5),y+sy*r]],color);
    c.globalAlpha=1;
    const label=e.type==='mineral'?'E  采集':'E  捕获';
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
