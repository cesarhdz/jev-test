let candidates=[];
let providerConfig=[];
const labels={},storageKey="jev-lab:runs";
const sampleResume=c=>c?.[3]||"";
const escapeHtml=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
function markdownToHtml(md){const lines=String(md||"").split(/\r?\n/);let out="",listOpen=false;const inline=s=>escapeHtml(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/\`(.+?)\`/g,"<code>$1</code>");const closeList=()=>{if(listOpen){out+="</ul>";listOpen=false}};for(const raw of lines){const line=raw.trim();if(!line){closeList();continue}const h=line.match(/^(#{1,4})\s+(.+)$/);if(h){closeList();const n=h[1].length;out+=`<h${n}>${inline(h[2])}</h${n}>`;continue}if(/^[-*]\s+/.test(line)){if(!listOpen){out+="<ul>";listOpen=true}out+=`<li>${inline(line.replace(/^[-*]\s+/,""))}</li>`;continue}closeList();out+=`<p>${inline(line)}</p>`}closeList();return out}

const list=document.querySelector("#candidateList"),name=document.querySelector("#candidateName"),desc=document.querySelector("#candidateDescription"),preview=document.querySelector("#inputPreview"),comparison=document.querySelector("#comparison"),runButton=document.querySelector("#run"),notice=document.querySelector("#notice");
let active=null,hydratedRun=null,running=false;
const loadHistory=()=>{try{return JSON.parse(localStorage.getItem(storageKey)||"[]")}catch{return[]}};
const writeHistory=runs=>localStorage.setItem(storageKey,JSON.stringify(runs.slice(0,100)));
const selectedProviders=()=>hydratedRun?hydratedRun.providers:[...document.querySelectorAll("[data-provider]:checked")].map(x=>x.dataset.provider);
function setProviderChecks(ps){document.querySelectorAll("[data-provider]").forEach(x=>x.checked=ps.includes(x.dataset.provider))}
function renderCandidates(){list.innerHTML="";for(const c of candidates){const b=document.createElement("button");b.className="candidate "+(active===c[0]?"active":"");b.innerHTML=`<span>${c[0].slice(1)}</span><div><strong>${c[1]}</strong><small>${c[2]}</small></div>`;b.onclick=()=>{active=c[0];renderCandidates();renderCandidate()};list.append(b)}}

const pct=n=>Number.isFinite(Number(n))?`${Math.round(Number(n)*100)}%`:"—";
function bars(entries){return `<div class="probabilities">${entries.map(([label,value])=>`<div class="probRow"><span>${escapeHtml(label)}</span><div><i style="width:${Math.max(0,Math.min(100,Number(value)*100))}%"></i></div><b>${pct(value)}</b></div>`).join("")}</div>`}
function decisionHtml(key,d,uncertainty){
 if(!d)return `<div class="placeholder">No result</div>`;
 const note=uncertainty==="native"?"Native model uncertainty":"Self-assessed by the LLM";
 if(key==="technical_depth"){
   const probs=Array.isArray(d.probabilities)?d.probabilities.map((v,i)=>[String(i),v]):Object.entries(d.probabilities||{});
   return `<div class="decisionValue"><strong>${Number(d.score).toFixed(Number.isInteger(d.score)?0:2)} <small>/ 5</small></strong>${d.confidence!=null?`<span>Confidence ${pct(d.confidence)}</span>`:""}</div>${bars(probs)}<small class="uncertainty">${note}</small>`;
 }
 if(key==="primary_profile"){
   const probs=Object.entries(d.probabilities||{}).sort((a,b)=>b[1]-a[1]);
   return `<div class="decisionValue"><strong class="choiceValue">${escapeHtml(d.choice||"—").replaceAll("_"," ")}</strong>${d.confidence!=null?`<span>Confidence ${pct(d.confidence)}</span>`:""}</div>${bars(probs)}<small class="uncertainty">${note}</small>`;
 }
 const p=d.noul??d.probability??null;
 return `<div class="decisionValue"><strong>${p==null?"—":p>=.5?"Yes":"No"}</strong><span>P(true) ${pct(p)}</span></div>${bars([["true",p],["false",p==null?0:1-p]])}<small class="uncertainty">${note}</small>`;
}
function providerColumn(p){
 const saved=hydratedRun?.results?.[active]?.[p],d=saved?.decisions||{},model=saved?.model||labels[p]||p;
 if(saved?.error)return `<section class="providerColumn errorColumn"><div class="providerHead"><span class="eyebrow">MODEL</span><h4>${escapeHtml(model)}</h4></div><div class="providerError"><strong>Evaluation failed</strong><p>${escapeHtml(saved.error)}</p></div></section>`;
 const waiting=running&&!saved;
 return `<section class="providerColumn"><div class="providerHead"><span class="eyebrow">MODEL</span><h4>${escapeHtml(model)}</h4></div>
 <article class="decision"><span class="type">SCORE</span><h5>technical_depth</h5>${waiting?'<div class="placeholder">Running…</div>':decisionHtml("technical_depth",d.technical_depth,saved?.uncertainty)}</article>
 <article class="decision"><span class="type">CHOICE</span><h5>primary_profile</h5>${waiting?'<div class="placeholder">Running…</div>':decisionHtml("primary_profile",d.primary_profile,saved?.uncertainty)}</article>
 <article class="decision"><span class="type">NOUL</span><h5>llm_experience</h5>${waiting?'<div class="placeholder">Running…</div>':decisionHtml("llm_experience",d.llm_experience,saved?.uncertainty)}</article>
 <div class="metrics"><span>Latency <b>${saved?.latencyMs??"—"}${saved?.latencyMs!=null?" ms":""}</b></span><span>Input <b>${saved?.inputTokens??"—"}</b></span><span>Output <b>${saved?.outputTokens??"—"}</b></span></div></section>`;
}
function renderCandidate(){const c=candidates.find(x=>x[0]===active);if(!c)return;name.textContent=c[1];desc.textContent=c[2];preview.innerHTML=markdownToHtml(hydratedRun?.inputs?.[active]||sampleResume(c));comparison.innerHTML=selectedProviders().map(providerColumn).join("")}
function renderConfig(){const ps=selectedProviders();document.querySelector("#modelSummary").textContent=`${ps.length} selected`;renderCandidate()}
function runLabel(r){return `${new Date(r.createdAt).toLocaleString()} · ${r.providers.map(p=>labels[p]||p).join(" + ")}`}
function renderHistory(){const runs=loadHistory(),el=document.querySelector("#historyList");document.querySelector("#historyCount").textContent=runs.length;el.innerHTML=runs.length?runs.map(r=>`<button class="historyRow ${hydratedRun?.id===r.id?"active":""}" data-run="${r.id}"><div><strong>${new Date(r.createdAt).toLocaleString()}</strong><span>${r.candidates} candidates · ${r.providers.map(p=>labels[p]||p).join(" + ")} · ${r.status}</span></div><code>${r.id.slice(0,8)}</code></button>`).join(""):`<div class="placeholder">No saved runs yet. Runs are stored in this browser.</div>`;el.querySelectorAll("[data-run]").forEach(b=>b.onclick=()=>hydrate(b.dataset.run))}
function hydrate(id){const r=loadHistory().find(x=>x.id===id);if(!r)return;closeHistory();hydratedRun=r;setProviderChecks(r.providers);document.querySelector("#hydratedBanner").classList.remove("hidden");document.querySelector("#hydratedLabel").textContent=runLabel(r);document.querySelector("#resultStatus").textContent=r.status==="complete"?"Complete":r.status==="running"?"Running…":"Saved run";runButton.classList.add("hidden");renderConfig();renderHistory()}
function newRun(){if(running)return;hydratedRun=null;document.querySelector("#hydratedBanner").classList.add("hidden");runButton.classList.remove("hidden");document.querySelector("#resultStatus").textContent="Not run";notice.classList.add("hidden");renderConfig();renderHistory()}
function createRun(providers){const runs=loadHistory(),inputs=Object.fromEntries(candidates.map(c=>[c[0],sampleResume(c)]));const run={id:crypto.randomUUID(),createdAt:new Date().toISOString(),providers,candidates:candidates.length,status:"running",inputs,results:{}};runs.unshift(run);writeHistory(runs);return run}
function updateRun(id,patch){const runs=loadHistory(),i=runs.findIndex(r=>r.id===id);if(i<0)return null;runs[i]={...runs[i],...patch};writeHistory(runs);return runs[i]}

document.querySelector("#clearHistory").onclick=()=>{if(running)return;localStorage.removeItem(storageKey);newRun()};
document.querySelector("#newRun").onclick=newRun;
const drawer=document.querySelector("#historyDrawer"),backdrop=document.querySelector("#historyBackdrop");
function closeHistory(){drawer.classList.remove("open");backdrop.classList.add("hidden")}
document.querySelector("#historyToggle").onclick=()=>{drawer.classList.add("open");backdrop.classList.remove("hidden")};
document.querySelector("#historyClose").onclick=closeHistory;backdrop.onclick=closeHistory;

runButton.onclick=async()=>{
 const ps=selectedProviders();if(!ps.length){notice.classList.remove("hidden");notice.textContent="Select at least one model.";return}
 notice.classList.remove("hidden");notice.textContent="Checking credentials…";
 try{
  const statusResponse=await fetch("/api/status"),status=await statusResponse.json(),missing=ps.filter(p=>!status.providers?.[p]);
  if(missing.length){notice.textContent=`Missing credentials for: ${missing.map(p=>labels[p]||p).join(", ")}`;return}
  const run=createRun(ps);running=true;hydrate(run.id);notice.classList.remove("hidden");notice.textContent=`Running ${candidates.length*ps.length} evaluations…`;document.querySelector("#resultStatus").textContent="Running…";renderCandidate();
  const response=await fetch("/api/run",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({providers:ps,candidates:candidates.map(c=>({id:c[0],markdown:sampleResume(c)}))})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||`Run failed (${response.status})`);
  const hasErrors=Object.values(data.results||{}).some(byProvider=>Object.values(byProvider).some(x=>x.error));
  updateRun(run.id,{status:hasErrors?"complete_with_errors":"complete",completedAt:data.completedAt,results:data.results});
  running=false;hydrate(run.id);document.querySelector("#resultStatus").textContent=hasErrors?"Complete with errors":"Complete";notice.textContent=hasErrors?"Run completed. Some evaluations failed; details are shown in their model columns.":"Run complete. Results saved locally.";
 }catch(error){
  if(hydratedRun?.id)updateRun(hydratedRun.id,{status:"failed",error:error.message});
  running=false;notice.textContent=error.message;document.querySelector("#resultStatus").textContent="Failed";renderHistory();renderCandidate();
 }
};

async function boot(){
 try{
  const [dr,cr]=await Promise.all([fetch("/api/dataset"),fetch("/api/config")]),d=await dr.json(),cfg=await cr.json();
  providerConfig=cfg.providers;for(const p of providerConfig)labels[p.id]=p.model;
  document.querySelector("#modelGrid").innerHTML=providerConfig.map(p=>`<label class="model"><input type="checkbox" data-provider="${p.id}" checked><span><b>${p.provider}</b><strong>${p.model}</strong><small>${p.configured?"Credential configured":"Credential missing"}</small></span></label>`).join("");
  document.querySelectorAll("[data-provider]").forEach(x=>x.addEventListener("change",renderConfig));
  candidates=d.candidates.map(c=>[c.id,c.title,c.description,c.markdown]);document.querySelector("#datasetCount").textContent=`${candidates.length} synthetic candidates`;active=candidates[0]?.[0];renderCandidates();renderConfig();renderHistory();
 }catch(error){notice.classList.remove("hidden");notice.textContent=`Could not initialize app: ${error.message}`}
}
boot();
