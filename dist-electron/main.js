"use strict";const i=require("electron"),f=require("path"),d=require("fs"),Y=require("crypto"),m=require("child_process"),Z=require("http"),k=require("https"),tt=require("os");function W(t){const e=Object.create(null,{[Symbol.toStringTag]:{value:"Module"}});if(t){for(const n in t)if(n!=="default"){const r=Object.getOwnPropertyDescriptor(t,n);Object.defineProperty(e,n,r.get?r:{enumerable:!0,get:()=>t[n]})}}return e.default=t,Object.freeze(e)}const et=W(Z),nt=W(k),S=new Map;function _(t){return t.replace(/^(['"])(.*)\1$/,"$2").trim()}function rt(t){const e=t.match(/^(--(?:include|exclude))=(.+)$/);return e?`${e[1]}="${e[2]}"`:t.startsWith("-")?t:`"${t}"`}function ot(t,e,n,r,o){var j,C;if(q(t))return;const s=_(e.source),a=_(e.destination),u=(e.filters??[]).filter(c=>c.value.trim()!=="").map(c=>`--${c.type}=${c.value.trim()}`),l=[e.type,s,a,...u,"--stats=1s","--use-json-log","--verbose"],p=m.spawn("rclone",l,{stdio:["ignore","pipe","pipe"]});S.set(t,p);const x=`rclone ${l.map(rt).join(" ")}`;n.webContents.send("sync:started",{taskId:t,command:x});let g=null;if(o){const c=f.dirname(o);d.existsSync(c)||d.mkdirSync(c,{recursive:!0}),g=d.createWriteStream(o,{flags:"w"}),g.write(JSON.stringify({level:"info",msg:x,time:new Date().toISOString()})+`
`)}let G="",X="";function R(c,$){c.value+=$.toString();const w=c.value.split(`
`);c.value=w.pop()??"";for(const K of w){const E=K.trim();if(E){g==null||g.write(E+`
`);try{const I=JSON.parse(E);n.webContents.send("sync:progress",{taskId:t,stats:I.stats??null,log:I})}catch{n.webContents.send("sync:progress",{taskId:t,stats:null,log:{level:"warning",msg:E,time:new Date().toISOString()}})}}}}const Q={value:G},z={value:X};(j=p.stdout)==null||j.on("data",c=>R(Q,c)),(C=p.stderr)==null||C.on("data",c=>R(z,c)),p.on("close",c=>{var $,w;g==null||g.end(),S.delete(t),c===0?(n.webContents.send("sync:complete",{taskId:t}),($=r==null?void 0:r.onComplete)==null||$.call(r)):(n.webContents.send("sync:error",{taskId:t,message:`rclone exited with code ${c}`}),(w=r==null?void 0:r.onError)==null||w.call(r))}),p.on("error",c=>{var $;g==null||g.end(),S.delete(t),n.webContents.send("sync:error",{taskId:t,message:c.message}),($=r==null?void 0:r.onError)==null||$.call(r)})}function st(t){const e=S.get(t);e&&(e.kill("SIGTERM"),S.delete(t))}function it(){for(const[,t]of S)t.kill("SIGTERM");S.clear()}function q(t){return S.has(t)}function L(t){const e=r=>r.replace(/^(['"])(.*)\1$/,"$2").trim(),n=(t.filters??[]).filter(r=>r.value.trim()).map(r=>`--${r.type}=${r.value.trim()}`);return[t.type,e(t.source),e(t.destination),...n]}function F(){const t=process.platform==="win32"?"where":"which",e=m.spawnSync(t,["rclone"],{encoding:"utf-8"});return e.status===0&&e.stdout.trim()?e.stdout.trim().split(`
`)[0].trim():"rclone"}const O="# opensync:";function B(){const t=m.spawnSync("crontab",["-l"],{encoding:"utf-8"});return t.status===0?t.stdout:""}function N(t){m.spawnSync("crontab",["-"],{input:t,encoding:"utf-8"})}function H(t){const n=B().split(`
`).filter(r=>!r.includes(`${O}${t}`)).join(`
`).trimEnd();N(n?n+`
`:"")}function at(t,e){H(t.id);const n=F(),o=[...L(t),"--use-json-log","--verbose"].map(l=>{const p=l.match(/^(--(?:include|exclude))=(.+)$/);return p?`${p[1]}="${p[2]}"`:l.startsWith("--")?l:`"${l.replace(/"/g,'\\"')}"`}).join(" "),s=e.substring(0,e.lastIndexOf("/")),a=`${t.schedule} mkdir -p "${s}" && "${n}" ${o} > "${e}" 2>&1 ${O}${t.id}`,u=B().trimEnd();N((u?u+`
`:"")+a+`
`)}function ct(){return B().split(`
`).flatMap(t=>{const e=t.match(new RegExp(`${O}([\\w-]+)`));return e?[e[1]]:[]})}function U(t){return`OpenSync_${t}`}function A(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}const P=["","January","February","March","April","May","June","July","August","September","October","November","December"],ut={0:"Sunday",1:"Monday",2:"Tuesday",3:"Wednesday",4:"Thursday",5:"Friday",6:"Saturday"};function T(t,e){const n=new Date;return n.setHours(parseInt(t),parseInt(e),0,0),n<=new Date&&n.setDate(n.getDate()+1),n.toISOString().slice(0,16)}function lt(t){const[e,n,r,o,s]=t.trim().split(/\s+/);if(/^\*\/(\d+)$/.test(e)&&n==="*"&&r==="*"&&o==="*"&&s==="*"){const u=e.slice(2),l=new Date;return l.setSeconds(0,0),`<TimeTrigger>
      <StartBoundary>${l.toISOString().slice(0,16)}</StartBoundary>
      <Enabled>true</Enabled>
      <Repetition>
        <Interval>PT${u}M</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
    </TimeTrigger>`}if(/^\d+$/.test(e)&&n==="*"&&r==="*"&&o==="*"&&s==="*"){const u=new Date;return u.setSeconds(0,0),`<TimeTrigger>
      <StartBoundary>${u.toISOString().slice(0,16)}</StartBoundary>
      <Enabled>true</Enabled>
      <Repetition>
        <Interval>PT1H</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
    </TimeTrigger>`}if(/^\d+$/.test(e)&&/^\d+$/.test(n)&&r==="*"&&o==="*"&&s==="*")return`<CalendarTrigger>
      <StartBoundary>${T(n,e)}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
    </CalendarTrigger>`;if(/^\d+$/.test(e)&&/^\d+$/.test(n)&&r==="*"&&o==="*"&&/^[\d,]+$/.test(s)){const u=s.split(",").map(l=>`<${ut[+l]} />`).join("");return`<CalendarTrigger>
      <StartBoundary>${T(n,e)}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByWeek>
        <WeeksInterval>1</WeeksInterval>
        <DaysOfWeek>${u}</DaysOfWeek>
      </ScheduleByWeek>
    </CalendarTrigger>`}if(/^\d+$/.test(e)&&/^\d+$/.test(n)&&/^\d+$/.test(r)&&o==="*"&&s==="*"){const u=P.slice(1).map(l=>`<${l} />`).join("");return`<CalendarTrigger>
      <StartBoundary>${T(n,e)}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByMonth>
        <DaysOfMonth><Day>${r}</Day></DaysOfMonth>
        <Months>${u}</Months>
      </ScheduleByMonth>
    </CalendarTrigger>`}if(/^\d+$/.test(e)&&/^\d+$/.test(n)&&/^\d+$/.test(r)&&/^\d+$/.test(o)&&s==="*")return`<CalendarTrigger>
      <StartBoundary>${T(n,e)}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByMonth>
        <DaysOfMonth><Day>${r}</Day></DaysOfMonth>
        <Months><${P[+o]} /></Months>
      </ScheduleByMonth>
    </CalendarTrigger>`;const a=new Date;return a.setDate(a.getDate()+1),a.setHours(0,0,0,0),`<CalendarTrigger>
    <StartBoundary>${a.toISOString().slice(0,16)}</StartBoundary>
    <Enabled>true</Enabled>
    <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
  </CalendarTrigger>`}function dt(t,e){const n=F(),o=[...L(t),"--use-json-log","--verbose"].map(a=>a.startsWith("--")?a:a.includes(" ")?`"${a.replace(/"/g,'\\"')}"`:a).join(" "),s=`/c "${n}" ${o} > "${e}" 2>&1`;return`<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>OpenSync: ${A(t.name)}</Description>
  </RegistrationInfo>
  <Triggers>
    ${lt(t.schedule)}
  </Triggers>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT4H</ExecutionTimeLimit>
    <Enabled>true</Enabled>
    <Hidden>true</Hidden>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>cmd.exe</Command>
      <Arguments>${A(s)}</Arguments>
    </Exec>
  </Actions>
</Task>`}function pt(t,e){const n=U(t.id),r=dt(t,e),o=f.join(tt.tmpdir(),`opensync_${t.id}.xml`);try{d.writeFileSync(o,r,{encoding:"utf16le"}),m.spawnSync("schtasks",["/delete","/tn",n,"/f"],{encoding:"utf-8"}),m.spawnSync("schtasks",["/create","/tn",n,"/xml",o,"/f"],{encoding:"utf-8"})}finally{try{d.unlinkSync(o)}catch{}}}function ft(t){m.spawnSync("schtasks",["/delete","/tn",U(t),"/f"],{encoding:"utf-8"})}function gt(){const t=m.spawnSync("schtasks",["/query","/fo","CSV","/nh"],{encoding:"utf-8"});return t.status!==0?[]:t.stdout.split(`
`).flatMap(e=>{const n=e.match(/"OpenSync_([a-f0-9-]+)"/);return n?[n[1]]:[]})}function v(t,e){if(!t.schedule)return;const n=f.join(e,"logs");d.existsSync(n)||d.mkdirSync(n,{recursive:!0});const r=f.join(n,`${t.id}.log`);process.platform==="win32"?pt(t,r):at(t,r)}function M(t){process.platform==="win32"?ft(t):H(t)}function mt(t,e){const n=new Set(t.map(o=>o.id)),r=process.platform==="win32"?gt():ct();for(const o of r)n.has(o)||M(o);for(const o of t)o.schedule?v(o,e):M(o.id)}function J(){return f.join(i.app.getPath("userData"),"tasks.json")}function y(){const t=J();if(!d.existsSync(t))return[];try{return JSON.parse(d.readFileSync(t,"utf-8")).map(n=>({...n,status:"idle"}))}catch{return[]}}function D(t){d.writeFileSync(J(),JSON.stringify(t,null,2),"utf-8")}function yt(t){const e=t.method==="POST"?t.payload.trim()||"{}":void 0;let n;try{n=new URL(t.url)}catch{return}const r=n.protocol==="https:"?nt:et,o={method:t.method,hostname:n.hostname,port:n.port||void 0,path:n.pathname+n.search,headers:e?{"Content-Type":"application/json","Content-Length":Buffer.byteLength(e)}:{}},s=r.request(o,a=>{a.resume()});s.on("error",a=>console.error(`[webhook] ${t.method} ${t.url} failed:`,a)),e&&s.write(e),s.end()}function ht(t,e){for(const n of t.webhooks??[])n.trigger===e&&yt(n)}function V(){const t=y(),e=f.join(i.app.getPath("userData"),"logs");let n=!1;for(const r of t){const o=f.join(e,`${r.id}.log`);if(d.existsSync(o))try{const s=d.statSync(o).mtime.toISOString();(!r.lastRunAt||s>r.lastRunAt)&&(r.lastRunAt=s,n=!0)}catch{}}n&&D(t)}let h=null;function b(){h=new i.BrowserWindow({width:1245,height:800,minWidth:720,minHeight:500,title:"OpenSync",webPreferences:{preload:f.join(__dirname,"preload.js"),contextIsolation:!0,nodeIntegration:!1}}),process.env.VITE_DEV_SERVER_URL?(h.loadURL(process.env.VITE_DEV_SERVER_URL),h.webContents.openDevTools()):h.loadFile(f.join(__dirname,"../dist/index.html"))}function St(){i.ipcMain.handle("tasks:getAll",()=>(V(),y())),i.ipcMain.handle("tasks:add",(t,e)=>{const n=y(),r={...e,id:Y.randomUUID(),status:"idle"};return n.push(r),D(n),v(r,i.app.getPath("userData")),r}),i.ipcMain.handle("tasks:update",(t,e,n)=>{const r=y(),o=r.findIndex(s=>s.id===e);if(o!==-1){r[o]={...r[o],...n},D(r);const s=r[o];s.schedule?v(s,i.app.getPath("userData")):M(e)}}),i.ipcMain.handle("tasks:delete",(t,e)=>{const n=y().filter(r=>r.id!==e);D(n),M(e)}),i.ipcMain.handle("sync:start",(t,e)=>{if(!h||q(e))return;const n=y().find(a=>a.id===e);if(!n)return;const r=f.join(i.app.getPath("userData"),"logs");d.existsSync(r)||d.mkdirSync(r,{recursive:!0});const o=f.join(r,`${e}.log`);function s(a){const u=y(),l=u.findIndex(p=>p.id===e);if(l!==-1){const p=u[l];u[l].lastRunAt=new Date().toISOString(),D(u),ht(p,a)}}ot(e,n,h,{onComplete:()=>s("success"),onError:()=>s("error")},o)}),i.ipcMain.handle("logs:read",(t,e)=>{const n=f.join(i.app.getPath("userData"),"logs",`${e}.log`);if(!d.existsSync(n))return null;try{return d.readFileSync(n,"utf-8")}catch{return null}}),i.ipcMain.handle("sync:stop",(t,e)=>{st(e)}),i.ipcMain.handle("remotes:list",()=>new Promise(t=>{m.execFile("rclone",["listremotes"],(e,n)=>{if(e){t([]);return}const r=n.split(`
`).map(o=>o.trim()).filter(o=>o.length>0);t(r)})})),i.ipcMain.handle("dialog:openFolder",async()=>h?(await i.dialog.showOpenDialog(h,{properties:["openDirectory"]})).filePaths[0]??null:null)}i.app.whenReady().then(()=>{i.Menu.setApplicationMenu(null),St(),b(),V(),mt(y(),i.app.getPath("userData")),i.app.on("activate",()=>{i.BrowserWindow.getAllWindows().length===0&&b()})});i.app.on("window-all-closed",()=>{process.platform!=="darwin"&&i.app.quit()});i.app.on("before-quit",()=>{it()});
