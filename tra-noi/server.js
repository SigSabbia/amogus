const cr=require('crypto'),express=require('express'),http=require('http'),{WebSocketServer}=require('ws'),push=require('web-push');
const ADMIN=process.env.ADMIN_PASSWORD||'admin';
const vk=process.env.VAPID_PUBLIC?{publicKey:process.env.VAPID_PUBLIC,privateKey:process.env.VAPID_PRIVATE}:push.generateVAPIDKeys();
push.setVapidDetails('mailto:'+(process.env.VAPID_EMAIL||'gioco@example.com'),vk.publicKey,vk.privateKey);
const app=express();app.use(express.static(__dirname+'/public'));app.get('/vapid',(q,r)=>r.json(vk.publicKey));
const srv=http.createServer(app),wss=new WebSocketServer({server:srv}),admins=new Set();
const DEF='Svuota il cestino\nRiordina i fogli sul tavolo\n*Scansiona il badge alla postazione\nCompleta il puzzle del cartellone';
const G={ph:'lobby',cfg:{imp:2,per:4,hold:3,need:2,cool:60,mcool:30,nv:2,kcool:30,mtime:90,ar:true,tw:true,tasks:DEF},pl:{},alarm:false,holds:new Set(),meet:null,msg:'',win:null,last:0,lastM:0,t0:0,t1:0,timer:null,mEnd:0,mtm:null,shown:0,pt:null};
const P=()=>Object.values(G.pl),sh=a=>{for(let i=a.length-1;i>0;i--){const j=cr.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const ok=(w,o)=>w&&w.readyState===1&&w.send(JSON.stringify(o));
function notify(title,body,tag,only){(only?[only]:P()).forEach(p=>p.sub&&push.sendNotification(p.sub,JSON.stringify({title,body,tag}),{TTL:120,urgency:'high'}).catch(e=>{if(e.statusCode>=400&&e.statusCode<500)p.sub=null}))}
const prog=()=>{const c=P().filter(x=>x.role==='c').flatMap(x=>x.tasks);return c.length?Math.round(100*c.filter(t=>t.done).length/c.length):0};
function tickProg(first){clearTimeout(G.pt);if(G.ph!=='playing'&&G.ph!=='meeting')return;
 if(!first){const d=prog()-G.shown;G.shown+=Math.sign(d)*Math.ceil(Math.abs(d)*(.5+Math.random()*.5));bc()}
 G.pt=setTimeout(tickProg,15000+Math.random()*45000)}
function pub(){const ps=P(),ct=ps.filter(x=>x.role==='c').flatMap(x=>x.tasks);
 return{ph:G.ph,msg:G.msg,win:G.win,el:G.t0?(G.t1||Date.now())-G.t0:null,hold:G.cfg.hold,need:G.cfg.need,al:G.alarm?G.holds.size:null,
 prog:G.shown,mr:G.mEnd?Math.max(0,G.mEnd-Date.now()):null,
 pl:ps.map(x=>({k:x.k,n:x.n,a:x.alive,on:!!x.ws,v:!!(G.meet&&x.k in G.meet)})),
 roles:G.ph==='ended'?Object.fromEntries(ps.map(x=>[x.k,x.role])):null}}
function bc(){const b=pub();
 P().forEach(p=>ok(p.ws,{...b,me:{k:p.k,n:p.n,role:p.role,a:p.alive,tasks:p.tasks,cd:Math.max(0,G.last+G.cfg.cool*1000-Date.now()),mcd:Math.max(0,G.lastM+G.cfg.mcool*1000-Date.now()),kcd:Math.max(0,(p.lk||0)+G.cfg.kcool*1000-Date.now()),mates:p.role==='i'?P().filter(x=>x.role==='i'&&x!==p).map(x=>x.k):[],vote:G.meet&&G.meet[p.k]||null}}));
 const adm=P().map(x=>({k:x.k,n:x.n,role:x.role,a:x.alive,d:x.tasks.filter(t=>t.done).length,t:x.tasks.length,v:x.tasks.some(t=>t.v)}));
 admins.forEach(w=>ok(w,{...b,adm,cfg:G.cfg}))}
function clr(){G.alarm=false;G.holds.clear();clearTimeout(G.timer);G.timer=null}
function check(){if(G.ph!=='playing'&&G.ph!=='meeting')return;
 const a=P().filter(p=>p.alive),i=a.filter(p=>p.role==='i').length,c=a.length-i;let w=null;
 if(!i)w='c';else if(i>=c)w='i';
 else if(G.cfg.tw){const t=P().filter(p=>p.role==='c').flatMap(p=>p.tasks);if(t.length&&t.every(x=>x.done))w='c'}
 if(w){G.ph='ended';G.win=w;G.t1=Date.now();clearTimeout(G.mtm);G.mEnd=0;clearTimeout(G.pt);G.shown=prog();clr();G.meet=null;notify('Partita finita','Hanno vinto '+(w==='c'?'i civili':'gli impostori'),'end')}}
function hold(){const v=[...G.holds].filter(k=>{const p=G.pl[k];return p&&p.alive&&p.role==='c'}).length;
 if(G.alarm&&v>=G.cfg.need){if(!G.timer)G.timer=setTimeout(()=>{G.timer=null;if(G.alarm){clr();G.last=Date.now();bc()}},G.cfg.hold*1000)}
 else{clearTimeout(G.timer);G.timer=null}}
function endMeet(to){clearTimeout(G.mtm);G.mEnd=0;const t={};
 Object.entries(G.meet).forEach(([k,v])=>{const a=G.pl[k],b=G.pl[v];if(a&&a.alive&&(v==='skip'||(b&&b.alive)))t[v]=(t[v]||0)+1});
 const e=Object.entries(t).sort((a,b)=>b[1]-a[1]);let m='Nessuno è stato eliminato.';
 if(e.length&&e[0][0]!=='skip'&&(!e[1]||e[1][1]<e[0][1])){const p=G.pl[e[0][0]];p.alive=false;m=p.n+' è stato eliminato.'}
 G.msg=m+(to?' Tempo scaduto.':'');G.meet=null;G.ph='playing';G.last=G.lastM=Date.now();P().forEach(p=>p.lk=Date.now());check()}
function start(){const ps=P();if(ps.length<3)return'Servono almeno 3 giocatori';
 const pool=G.cfg.tasks.split('\n').map(s=>s.trim()).filter(Boolean).map(s=>s[0]==='*'?{t:s.slice(1).trim(),v:true}:{t:s,v:false});
 if(!pool.length)return'Aggiungi almeno una task';
 const ni=Math.max(1,Math.min(G.cfg.imp,Math.floor((ps.length-1)/2))),np=pool.filter(t=>!t.v),vp=pool.filter(t=>t.v);
 if(!np.length)return'Serve almeno una task non visibile';
 if(G.cfg.nv&&!vp.length)return'Hai chiesto dei giocatori con task visibile ma non ce ne sono: metti un * davanti ad almeno una task oppure imposta 0';
 ps.forEach(p=>{if(p.role)p.pi=p.role==='i'});const ar=G.cfg.ar,ord=[...sh(ps.filter(p=>!(ar&&p.pi))),...sh(ps.filter(p=>ar&&p.pi))];ord.forEach((p,i)=>p.role=i<ni?'i':'c');
 const VS=new Set(sh(ps.filter(p=>p.role==='c')).slice(0,G.cfg.nv)),D={c:[],i:[],v:[]};
 const draw=(k,src,have)=>{if(!D[k].length)D[k]=sh(src.slice());let i=D[k].findIndex(t=>!have.has(t));if(i<0){D[k]=sh(src.slice());i=D[k].findIndex(t=>!have.has(t))}const t=D[k].splice(i,1)[0];have.add(t);return{...t,done:false}};
 ps.forEach(p=>{const have=new Set(),k=VS.has(p)?1:0,per=Math.min(G.cfg.per-k,np.length);p.alive=true;p.tasks=[];
  if(k)p.tasks.push(draw('v',vp,have));
  for(let x=0;x<per;x++)p.tasks.push(draw(p.role,np,have));
  sh(p.tasks)});
 clr();G.meet=null;G.msg='';G.win=null;G.ph='playing';G.last=G.lastM=G.t0=Date.now();G.t1=0;G.shown=0;ps.forEach(p=>p.lk=Date.now());tickProg(1);
 notify('La partita è iniziata','Apri il gioco per vedere ruolo e task','start')}
function adminCmd(d,err){const n=(v,a,b,f)=>{v=parseInt(v);return isNaN(v)?f:Math.min(b,Math.max(a,v))};
 if(d.t==='cfg'||d.t==='start'){
  if(d.cfg){const c=d.cfg;G.cfg={imp:n(c.imp,1,10,2),per:n(c.per,1,15,4),hold:n(c.hold,1,30,3),need:n(c.need,2,10,2),cool:n(c.cool,0,600,60),mcool:n(c.mcool,0,600,30),nv:n(c.nv,0,20,2),kcool:n(c.kcool,0,600,30),mtime:n(c.mtime,0,900,90),ar:!!c.ar,tw:!!c.tw,tasks:String(c.tasks||'').slice(0,5000)}}
  if(d.t==='start'){if(G.ph==='playing'||G.ph==='meeting')return err('Partita già in corso');const e=start();if(e)return err(e)}}
 else if(d.t==='reset'){G.t0=G.t1=0;P().forEach(p=>{if(p.role)p.pi=p.role==='i'});clearTimeout(G.mtm);clearTimeout(G.pt);G.mEnd=0;G.shown=0;clr();G.ph='lobby';G.meet=null;G.msg='';G.win=null;P().forEach(p=>{p.role=null;p.alive=true;p.tasks=[]})}
 else if(d.t==='endmeet'&&G.ph==='meeting')endMeet();
 else if(d.t==='kick'){const p=G.pl[d.k];if(p){ok(p.ws,{e:'Sei stato espulso dalla partita',lo:1});p.ws&&p.ws.close();delete G.pl[d.k];G.holds.delete(d.k);if(G.meet)delete G.meet[d.k];hold();check()}}
 else if(d.t==='toggle'){const p=G.pl[d.k];if(p){p.alive=!p.alive;check()}}
 bc()}
wss.on('connection',ws=>{
 ws.on('message',raw=>{let d;try{d=JSON.parse(raw)}catch{return}
  const err=e=>ok(ws,{e,lo:d.t==='join'||d.t==='admin'?1:0});
  if(d.t==='ping')return;
  if(d.t==='admin'){if(d.pw!==ADMIN)return err('Password errata');ws.adm=true;admins.add(ws);return bc()}
  if(ws.adm)return adminCmd(d,err);
  if(d.t==='join'){const n=String(d.name||'').trim().slice(0,20),k=n.toLowerCase();if(!n)return err('Scrivi un nickname');
   let p=G.pl[k];if(!p){if(G.ph!=='lobby')return err('La partita è già iniziata');p=G.pl[k]={k,n,alive:true,tasks:[],role:null,ws:null,sub:null}}
   if(p.ws&&p.ws!==ws)p.ws.close();p.ws=ws;ws.k=k;return bc()}
  const p=G.pl[ws.k];if(!p)return;const pl=G.ph==='playing';
  switch(d.t){
  case'sub':p.sub=d.sub;break;
  case'tk':{const i=d.i,t=p.tasks[i];if(pl&&t&&(t.done?!p.tasks.slice(i+1).some(u=>u.done):p.tasks.slice(0,i).every(u=>u.done))){t.done=!t.done;check()}break}
  case'die':if((pl||G.ph==='meeting')&&p.alive){p.alive=false;G.holds.delete(p.k);hold();check();if(G.ph==='meeting'&&G.meet&&P().filter(x=>x.alive).every(x=>x.k in G.meet))endMeet()}break;
  case'alarm':if(pl&&p.alive&&p.role==='i'&&!G.alarm&&Date.now()>=G.last+G.cfg.cool*1000){G.alarm=true;notify('🚨 ALLARME','Corri! Servono '+G.cfg.need+' civili che premono insieme per fermarlo','alarm')}break;
  case'kill':{const v=G.pl[d.to];if(pl&&p.alive&&p.role==='i'&&v&&v.alive&&v.role==='c'&&Date.now()>=(p.lk||0)+G.cfg.kcool*1000){v.alive=false;p.lk=Date.now();G.holds.delete(v.k);hold();ok(v.ws,{e:'Sei stato ucciso! Resta fermo e attendi che trovino il corpo.'});notify('Sei stato ucciso','Resta dove sei e attendi la riunione','kill',v);check()}break}
  case'hold':if(G.alarm){d.on?G.holds.add(p.k):G.holds.delete(p.k);hold()}break;
  case'meet':if(pl&&p.alive&&Date.now()>=G.lastM+G.cfg.mcool*1000){clr();G.ph='meeting';G.meet={};G.msg='';if(G.cfg.mtime){G.mEnd=Date.now()+G.cfg.mtime*1000;G.mtm=setTimeout(()=>{if(G.ph==='meeting'){endMeet(1);bc()}},G.cfg.mtime*1000)}notify('Riunione!','Apri il gioco e vota','meet')}break;
  case'vote':if(G.ph==='meeting'&&p.alive&&(d.to==='skip'||(G.pl[d.to]&&G.pl[d.to].alive&&d.to!==p.k))){G.meet[p.k]=d.to;if(P().filter(x=>x.alive).every(x=>x.k in G.meet))endMeet()}break}
  bc()});
 ws.on('close',()=>{admins.delete(ws);const p=G.pl[ws.k];if(p&&p.ws===ws){p.ws=null;G.holds.delete(p.k);hold();bc()}})});
srv.listen(process.env.PORT||3000,()=>console.log('Gioco attivo. Password organizzatore:',ADMIN==='admin'?'admin (cambiala con ADMIN_PASSWORD!)':'impostata'));
