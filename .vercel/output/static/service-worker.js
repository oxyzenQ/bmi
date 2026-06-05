var a=location.pathname.split("/").slice(0,-1).join("/"),d=[a+"/_app/immutable/entry/app.ClnJSJ1A.js",a+"/_app/immutable/nodes/0.BC_N7mMt.js",a+"/_app/immutable/assets/0.DJXm6Y7A.css",a+"/_app/immutable/assets/inter-latin-wght-normal.Dx4kXJAl.woff2",a+"/_app/immutable/assets/jetbrains-mono-latin-wght-normal.B9CIFXIH.woff2",a+"/_app/immutable/nodes/1.CbIr2bs8.js",a+"/_app/immutable/assets/1.DGMUeIsd.css",a+"/_app/immutable/nodes/2.DtoosRXq.js",a+"/_app/immutable/assets/2.BYHkj3in.css",a+"/_app/immutable/chunks/5I_SyRrg.js",a+"/_app/immutable/chunks/BDThaRL7.js",a+"/_app/immutable/chunks/BI3fgSoE.js",a+"/_app/immutable/chunks/BYy2THUq.js",a+"/_app/immutable/chunks/BgCyFJkK.js",a+"/_app/immutable/chunks/C52nFF3f.js",a+"/_app/immutable/chunks/Cm7Cnlvc.js",a+"/_app/immutable/assets/pwa-update.Bly4MVjp.css",a+"/_app/immutable/chunks/CxQaZJN2.js",a+"/_app/immutable/chunks/CzxRFZK_.js",a+"/_app/immutable/chunks/D85NYZYA.js",a+"/_app/immutable/chunks/D9mmG_hV.js",a+"/_app/immutable/chunks/DIhbsDPo.js",a+"/_app/immutable/chunks/DoYaIEta.js",a+"/_app/immutable/chunks/Dvu6JzpV.js",a+"/_app/immutable/chunks/L18xy8aX.js",a+"/_app/immutable/chunks/O_VtikJP.js",a+"/_app/immutable/chunks/REPLK96L.js",a+"/_app/immutable/chunks/WlBWrCBG.js",a+"/_app/immutable/chunks/aCo5H3ZF.js",a+"/_app/immutable/chunks/eMvBwatC.js",a+"/_app/immutable/chunks/qT6khdmO.js",a+"/_app/immutable/chunks/BQTj8bSb.js",a+"/_app/immutable/entry/start.kpMPDtFi.js",a+"/_app/immutable/chunks/E-uorGz5.js",a+"/_app/immutable/chunks/BUpB6kqW.js",a+"/_app/immutable/chunks/zRFFlPL-.js",a+"/_app/immutable/assets/BmiForm.D10sGtOe.css",a+"/_app/immutable/chunks/Bryh_Fw0.js",a+"/_app/immutable/assets/BmiGoalTracker.BNY9zqdu.css",a+"/_app/immutable/chunks/NjHJ--gO.js",a+"/_app/immutable/assets/BmiHealthRisk.GzaVjzFw.css",a+"/_app/immutable/chunks/DlvNJ1Tf.js",a+"/_app/immutable/chunks/BjnC-Uw6.js",a+"/_app/immutable/chunks/CBdB6Y-S.js",a+"/_app/immutable/assets/BmiSnapshot.DqGqkf7c.css",a+"/_app/immutable/chunks/RVptzCxg.js",a+"/_app/immutable/assets/BodyFatEstimate.DojkhDJt.css",a+"/_app/immutable/chunks/a5av3UAV2.js",a+"/_app/immutable/chunks/DVn5Ed902.js",a+"/_app/immutable/chunks/DGWMxI6M2.js",a+"/_app/immutable/chunks/Dv2XF0E62.js",a+"/_app/immutable/chunks/CQhi8Qjb2.js"],f=[a+"/assets/new_bmi_logo_128.webp",a+"/assets/new_bmi_logo_180.webp",a+"/assets/new_bmi_logo_192.webp",a+"/assets/new_bmi_logo_2026.webp",a+"/assets/new_bmi_logo_216.webp",a+"/assets/new_bmi_logo_256.webp",a+"/assets/screenshot-narrow.webp",a+"/assets/screenshot-wide.webp",a+"/images/blackhole.webp",a+"/images/oxyzen-zenlysium.webp",a+"/images/spaceshipx.webp",a+"/manifest.json",a+"/robots.txt"],o="1780482214659",c=self,l=`cache-${o}`,h=`runtime-${o}`,p=`${a}/`,w=Array.from(new Set([...d,...f])),k=60,u=!1;function m(e){return!e||!e.ok?!1:(e.headers.get("content-type")??"").includes("text/html")}async function g(e){const t=await fetch(new Request(p,{cache:"reload"}));if(!m(t))throw new Error(`Unable to cache app shell: ${t.status} ${t.statusText}`);await e.put(p,t.clone())}async function b(){const e=await caches.match(p);if(m(e))return e;const t=p==="/"?void 0:await caches.match("/");if(m(t))return t;const n=await caches.keys();for(const s of n){const i=await(await caches.open(s)).match(p);if(m(i))return i}}async function j(e,t){if(!m(t))return;const n=await caches.open(l);await Promise.all([n.put(e,t.clone()),n.put(p,t.clone())])}function y(){return new Response(`<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>BMI Stellar Offline</title>
		<style>
			html, body { margin: 0; min-height: 100%; background: #000; color: #fff; font-family: system-ui, sans-serif; }
			body {
				display: grid;
				place-items: center;
				padding: 24px;
				text-align: center;
				background:
					radial-gradient(circle at 50% 20%, rgba(71, 209, 255, 0.16), transparent 32rem),
					linear-gradient(180deg, #070914 0%, #000 100%);
			}
			main {
				max-width: 430px;
				padding: 28px;
				border: 1px solid rgba(255, 255, 255, 0.12);
				border-radius: 18px;
				background: rgba(4, 8, 18, 0.72);
				box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
			}
			h1 { font-size: 1.28rem; margin: 0 0 0.75rem; letter-spacing: 0; }
			p { color: rgba(255, 255, 255, 0.78); line-height: 1.55; margin: 0; }
		</style>
	</head>
	<body>
		<main>
			<h1>BMI Stellar is offline</h1>
			<p>Reconnect and refresh to load the latest app shell.</p>
		</main>
	</body>
</html>`,{status:503,statusText:"Offline",headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}})}c.addEventListener("message",e=>{const t=c.location.origin;e.origin&&e.origin!==t||e.data?.type==="SKIP_WAITING"&&e.waitUntil(c.skipWaiting())});async function C(e,t){const n=await caches.open(e),s=await n.keys();if(s.length<=t)return;const i=s.length-t;await Promise.all(s.slice(0,i).map(r=>n.delete(r)))}async function B(){if(!u){u=!0;try{await C(h,k)}finally{u=!1}}}c.addEventListener("install",e=>{e.waitUntil(caches.open(l).then(async t=>{await t.addAll(w),await g(t)}).then(()=>c.skipWaiting()))});c.addEventListener("activate",e=>{e.waitUntil((async()=>{const t=await caches.open(l);let n=await t.match(p);if(!m(n)){const s=await b();s&&(await t.put(p,s.clone()),n=s)}if(m(n)){const s=await caches.keys();await Promise.all(s.filter(i=>i!==l&&i!==h).map(i=>caches.delete(i)))}await c.clients.claim()})())});c.addEventListener("fetch",e=>{const{request:t}=e,n=new URL(t.url);if(t.method==="GET"&&n.origin===c.location.origin&&!t.headers.has("range")){if(t.mode==="navigate"){e.respondWith(fetch(t).then(s=>(j(t,s.clone()),s)).catch(()=>(async()=>{const s=await caches.match(t);if(m(s))return s;const i=await b();return i||y()})()));return}e.respondWith(caches.match(t).then(s=>s||fetch(t.clone()).then(i=>{if(!i||i.status!==200||i.type==="error")return i;if(n.pathname.startsWith("/_app/")||n.pathname.startsWith("/assets/")||n.pathname.endsWith(".woff2")||n.pathname.endsWith(".webp")){const r=i.clone();caches.open(h).then(_=>{_.put(t,r).then(()=>B())})}return i}).catch(()=>new Response(null,{status:504,statusText:"Gateway Timeout"}))))}});
