import webpush from 'web-push';
const {GH_TOKEN,DATA_REPO,APP_REPO,VAPID_PUBLIC,VAPID_PRIVATE}=process.env;
const H={Authorization:'Bearer '+GH_TOKEN,Accept:'application/vnd.github+json','User-Agent':'hananel-reminders'};
async function get(repo,path){const r=await fetch(`https://api.github.com/repos/${repo}/contents/${path}`,{headers:H});if(r.status===404)return null;if(!r.ok)throw new Error('get '+path+' '+r.status);const j=await r.json();
  let txt=j.content?Buffer.from(j.content,'base64').toString('utf8'):await (await fetch(j.download_url,{headers:H})).text();return{sha:j.sha,data:JSON.parse(txt)}}
async function put(repo,path,data,sha,msg){const body={message:msg,content:Buffer.from(JSON.stringify(data)).toString('base64')};if(sha)body.sha=sha;
  const r=await fetch(`https://api.github.com/repos/${repo}/contents/${path}`,{method:'PUT',headers:H,body:JSON.stringify(body)});if(!r.ok){console.log('put failed',path,r.status);return null}return (await r.json()).content.sha}
let ST=null;
async function tick(){
const P=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,weekday:'short'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const today=`${P.year}-${P.month}-${P.day}`,nowMin=(+P.hour%24)*60+(+P.minute);
const toMin=t=>{const m=/^(\d{1,2}):(\d{2})/.exec(t||'');return m?+m[1]*60+ +m[2]:null};
const file=await get(DATA_REPO,'data.json');if(!file){console.log('no data');return}
const d=file.data,subs=(d.settings&&d.settings.pushSubs)||[];
if(!ST){ST=(await get(DATA_REPO,'notified.json'))||{data:{keys:{}},sha:null};ST.data.keys=ST.data.keys||{}}const keys=ST.data.keys;let changed=false;
const cname=id=>((d.clients||[]).find(c=>c.id===id)||{}).name||'';
const out=[];
for(const t of d.tasks||[]){if(t.done||t.due!==today)continue;const m=toMin(t.time);if(m===null)continue;const diff=m-nowMin;const k='t:'+t.id+':'+t.due+t.time;
  if(diff<=15&&diff>=-25&&!keys[k]){out.push({title:'⏰ '+t.time+' · תזכורת',body:t.title+(t.clientId&&cname(t.clientId)?' · '+cname(t.clientId):''),tag:k});keys[k]=today;changed=true}}
for(const e of d.events||[]){if(e.date!==today)continue;const m=toMin(e.time);if(m===null)continue;const diff=m-nowMin;const k='e:'+e.id+':'+e.date+e.time;
  if(diff<=30&&diff>=-15&&!keys[k]){out.push({title:'📅 '+e.time+' · '+e.title,body:[e.clientId&&cname(e.clientId),e.location&&'📍 '+e.location].filter(Boolean).join(' · ')||'פגישה בקרוב',tag:k});keys[k]=today;changed=true}}
const bk='brief:'+today;
if(P.weekday!=='Sat'&&nowMin>=7*60+30&&nowMin<11*60&&!keys[bk]){
  const open=(d.tasks||[]).filter(t=>!t.done);const tdy=open.filter(t=>t.due===today||(!t.due&&t.priority==='today'));const late=open.filter(t=>t.due&&t.due<today);
  const evs=(d.events||[]).filter(e=>e.date===today).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  const leads=(d.clients||[]).filter(c=>['lead','talking','quote'].includes(c.status)&&(Date.now()-(c.updatedAt||0))>3*864e5);
  const parts=[];if(evs.length)parts.push(`${evs.length} פגישות (ראשונה ${evs[0].time||''} ${evs[0].title})`);if(tdy.length)parts.push(`${tdy.length} משימות להיום`);if(late.length)parts.push(`${late.length} באיחור`);if(leads.length)parts.push(`${leads.length} לידים מחכים`);
  out.push({title:'☀️ בוקר טוב '+((d.settings&&d.settings.ownerName)||'חננאל'),body:parts.length?parts.join(' · '):'היום פנוי — אין פגישות ומשימות פתוחות',tag:bk});keys[bk]=today;changed=true}
if(out.length&&subs.length){webpush.setVapidDetails('https://github.com/'+APP_REPO,VAPID_PUBLIC,VAPID_PRIVATE);
  for(const n of out)for(const s of subs){try{await webpush.sendNotification(s,JSON.stringify(n));console.log('sent',n.tag)}catch(e){console.log('push failed',e.statusCode)}}}
for(const k of Object.keys(keys)){if(k!=='keepalive'&&keys[k]<new Date(Date.now()-4*864e5).toISOString().slice(0,10)){delete keys[k];changed=true}}
if(!keys.keepalive||keys.keepalive<new Date(Date.now()-20*864e5).toISOString().slice(0,10)){keys.keepalive=today;changed=true;const ka=await get(APP_REPO,'keepalive.json').catch(()=>null);await put(APP_REPO,'keepalive.json',{at:today},ka&&ka.sha,'keepalive')}
if(changed){const ns=await put(DATA_REPO,'notified.json',{keys},ST.sha,'notified');if(ns)ST.sha=ns;else ST=null}
console.log('done',today,P.hour+':'+P.minute,'notifs',out.length,'subs',subs.length);
}
if(process.env.TEST_PUSH==='1'){const f=await get(DATA_REPO,'data.json');const subs=(f&&f.data.settings&&f.data.settings.pushSubs)||[];webpush.setVapidDetails('https://github.com/'+APP_REPO,VAPID_PUBLIC,VAPID_PRIVATE);
  for(const s of subs){try{await webpush.sendNotification(s,JSON.stringify({title:'⏰ בדיקת תזכורות',body:'אם אתה רואה את זה — התזכורות מהיומן עובדות ✓',tag:'test'}));console.log('test sent')}catch(e){console.log('test failed',e.statusCode,e.body)}}}
const LOOP=+(process.env.LOOP_MIN||50)*60000,T0=Date.now();
while(true){try{await tick()}catch(e){console.log('tick error',e.message)}if(Date.now()-T0>LOOP)break;await new Promise(r=>setTimeout(r,60000))}
