let candidates=[];
let providerConfig=[];
let rubricConfig={};
let expectedConfig={};
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
function candidateState(id){if(!hydratedRun)return "";const vals=Object.values(hydratedRun.results?.[id]||{});if(vals.some(v=>v?.error))return "error";if(vals.length>=hydratedRun.providers.length)return "done";if(running)return "queued";return ""}
function renderCandidates(){list.innerHTML="";for(const c of candidates){const state=candidateState(c[0]),b=document.createElement("button");b.className="candidate "+(active===c[0]?"active ":"")+state;b.innerHTML=`<span>${c[0].slice(1)}</span><div><strong>${c[1]}</strong><small>${c[2]}</small></div>${state?`<i class="candidateState">${state==="done"?"✓":state==="error"?"!":"·"}</i>`:""}`;b.onclick=()=>{active=c[0];renderCandidates();renderCandidate()};list.append(b)}}

const pct=n=>Number.isFinite(Number(n))?`${Math.round(Number(n)*100)}%`:"—";
const titleize=s=>String(s??"—").replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
function resultValue(key,d){
 if(!d)return "—";
 if(key==="technical_depth")return `${Number(d.score).toFixed(Number.isInteger(d.score)?0:2)} / 5`;
 if(key==="primary_profile")return titleize(d.choice);
 if(typeof d.value==="boolean")return d.value?"Yes":"No";
 const p=d.noul??d.probability;return p==null?"—":p>=.5?"Yes":"No";
}
function distribution(key,d,rubric){
 if(!d)return '<div class="detailEmpty">No result</div>';
 if(d.scores){
   const rows=Object.entries(d.scores).sort((x,y)=>Number(y[1])-Number(x[1]));
   return `<div class="distribution">${rows.map(([k,v])=>{const label=key==="technical_depth"?(rubric?.criteria?.[Number(k)]||`Level ${k}`):key==="primary_profile"?(rubric?.criteria?.[k]||titleize(k)):titleize(k);return `<div class="distRow"><span>${escapeHtml(label)}</span><b>${key==="technical_depth"?escapeHtml(k):""}</b><i><em style="width:${Math.max(0,Math.min(100,Number(v)*100))}%"></em></i><strong>${Number(v).toFixed(3)}</strong></div>`}).join("")}</div><div class="confidence">Reranker relevance scores · not probabilities</div>`;
 }
 if(key==="technical_depth"&&d.probabilities){
   const probs=Array.isArray(d.probabilities)?d.probabilities:Object.values(d.probabilities);
   return `<div class="distribution">${probs.map((v,i)=>`<div class="distRow"><span>${escapeHtml(rubric?.criteria?.[i]||`Level ${i}`)}</span><b>${i}</b><i><em style="width:${Math.max(0,Math.min(100,Number(v)*100))}%"></em></i><strong>${pct(v)}</strong></div>`).join("")}</div>${d.confidence!=null?`<div class="confidence">Confidence: ${pct(d.confidence)}</div>`:""}`;
 }
 if(key==="primary_profile"&&d.probabilities){
   const rows=Object.entries(d.probabilities).sort((x,y)=>y[1]-x[1]);
   return `<div class="distribution">${rows.map(([k,v])=>`<div class="distRow"><span>${escapeHtml(rubric?.criteria?.[k]||titleize(k))}</span><b></b><i><em style="width:${Math.max(0,Math.min(100,Number(v)*100))}%"></em></i><strong>${pct(v)}</strong></div>`).join("")}</div>${d.confidence!=null?`<div class="confidence">Confidence: ${pct(d.confidence)}</div>`:""}`;
 }
 const p=d.noul??d.probability;
 if((key==="production_ai_ownership"||key==="recent_hands_on_engineering")&&p!=null)return `<div class="distribution"><div class="distRow"><span>True</span><b></b><i><em style="width:${p*100}%"></em></i><strong>${pct(p)}</strong></div><div class="distRow"><span>False</span><b></b><i><em style="width:${(1-p)*100}%"></em></i><strong>${pct(1-p)}</strong></div></div>`;
 return '<div class="detailEmpty">This model returns only the normalized decision for this primitive.</div>';
}
function expectedValue(key){
 const x=expectedConfig?.[active]?.[key]?.expected;
 if(key==="technical_depth"&&Array.isArray(x))return `${x[0]}–${x[1]}`;
 if(typeof x==="boolean")return x?"Yes":"No";
 return titleize(x);
}
function expectedReason(key){return expectedConfig?.[active]?.[key]?.reason||""}
function matchesExpected(key,d){
 const x=expectedConfig?.[active]?.[key]?.expected;if(x==null||!d)return null;
 if(key==="technical_depth"){const n=Number(d.score);return Array.isArray(x)&&n>=x[0]&&n<=x[1]}
 if(key==="primary_profile")return d.choice===x;
 return d.value===x;
}
function renderComparison(){
 const providers=selectedProviders(),rubric=hydratedRun?.rubric||rubricConfig||{},byProvider=hydratedRun?.results?.[active]||{};
 const modelHeads=`<div class="expectedHead"><span>HUMAN</span><strong>Expected</strong></div>`+providers.map(p=>`<div class="compareModel"><span>${escapeHtml(providerConfig.find(x=>x.id===p)?.provider||p)}</span><strong>${escapeHtml(byProvider[p]?.model||hydratedRun?.models?.[p]||labels[p]||p)}</strong></div>`).join("");
 const keys=["technical_depth","primary_profile","production_ai_ownership","recent_hands_on_engineering"];
 const rows=keys.map((key,idx)=>{
   const q=rubric[key]||{},type=(q.type||["score","choice","noul","noul"][idx]).toUpperCase();
   const expectedCell=`<div class="compareValue expectedValue">${escapeHtml(expectedValue(key))}</div>`;const cells=providers.map(p=>{const saved=byProvider[p];if(saved?.error)return `<div class="compareValue errorValue">Error</div>`;if(running&&!saved)return `<div class="compareValue muted">Running…</div>`;const d=saved?.decisions?.[key],match=matchesExpected(key,d),mark=match==null?"":`<span class="validationMark ${match?"match":"miss"}">${match?"✓":"·"}</span>`;return `<div class="compareValue"><span>${escapeHtml(resultValue(key,d))}</span>${mark}</div>`}).join("");
   const details=providers.map(p=>{const saved=byProvider[p];return `<div class="modelDetail"><strong>${escapeHtml(byProvider[p]?.model||hydratedRun?.models?.[p]||labels[p]||p)}</strong>${saved?.error?`<p class="providerError">${escapeHtml(saved.error)}</p>`:distribution(key,saved?.decisions?.[key],q)}</div>`}).join("");
   return `<details class="compareDecision" ${idx===0?"open":""}><summary><div class="decisionLabel"><span class="caret">›</span><div><span class="type">${type}</span><h5>${key}</h5><p>${escapeHtml(q.question||"")}</p></div></div>${expectedCell}${cells}</summary><div class="decisionDetails"><div class="rubricDetail"><span class="eyebrow">INSTRUCTIONS</span><p>${escapeHtml(q.instructions||"")}</p></div><div class="expectedDetail"><p>${escapeHtml(expectedReason(key))}</p></div>${details}</div></details>`;
 }).join("");
 const metrics=providers.map(p=>{const x=byProvider[p],extra=x?.calls?` · ${x.calls} calls`:"";return `<div class="metricCell"><b>${x?.latencyMs!=null?`${x.latencyMs} ms`:"—"}</b><span>${x?.inputTokens??"—"} in · ${x?.outputTokens??"—"} out${extra}</span></div>`}).join("");
 comparison.innerHTML=`<div class="compareTable" style="--models:${Math.max(1,providers.length)}"><div class="compareHeader"><div><span class="eyebrow">DECISION</span></div>${modelHeads}</div>${rows}<div class="compareMetrics"><div><span class="eyebrow">PERFORMANCE</span></div><div class="expectedMetric">—</div>${metrics}</div></div>`;
}
function renderCandidate(){const c=candidates.find(x=>x[0]===active);if(!c)return;name.textContent=c[1];desc.textContent=c[2];preview.innerHTML=markdownToHtml(hydratedRun?.inputs?.[active]||sampleResume(c));renderComparison()}
function renderConfig(){const ps=selectedProviders();document.querySelector("#modelSummary").textContent=`${ps.length} selected`;renderCandidate()}
function runLabel(r){return `${new Date(r.createdAt).toLocaleString()} · ${r.providers.map(p=>labels[p]||p).join(" + ")}`}
function renderHistory(){const runs=loadHistory(),el=document.querySelector("#historyList");document.querySelector("#historyCount").textContent=runs.length;el.innerHTML=runs.length?runs.map(r=>`<button class="historyRow ${hydratedRun?.id===r.id?"active":""}" data-run="${r.id}"><div><strong>${new Date(r.createdAt).toLocaleString()}</strong><span>${r.candidates} candidates · ${r.providers.map(p=>labels[p]||p).join(" + ")} · ${r.status}</span></div><code>${r.id.slice(0,8)}</code></button>`).join(""):`<div class="placeholder">No saved runs yet. Runs are stored in this browser.</div>`;el.querySelectorAll("[data-run]").forEach(b=>b.onclick=()=>hydrate(b.dataset.run))}
function hydrate(id){const r=loadHistory().find(x=>x.id===id);if(!r)return;closeHistory();hydratedRun=r;setProviderChecks(r.providers);document.querySelector("#hydratedBanner").classList.remove("hidden");document.querySelector("#hydratedLabel").textContent=runLabel(r);document.querySelector("#resultStatus").textContent=r.status==="complete"?"Complete":r.status==="running"?"Running…":"Saved run";runButton.classList.add("hidden");renderConfig();renderHistory()}
function newRun(){if(running)return;hydratedRun=null;document.querySelector("#hydratedBanner").classList.add("hidden");runButton.classList.remove("hidden");document.querySelector("#resultStatus").textContent="Not run";notice.classList.add("hidden");renderConfig();renderHistory()}
function createRun(providers){const runs=loadHistory(),inputs=Object.fromEntries(candidates.map(c=>[c[0],sampleResume(c)]));const run={id:crypto.randomUUID(),createdAt:new Date().toISOString(),providers,candidates:candidates.length,status:"running",inputs,results:{}};runs.unshift(run);writeHistory(runs);return run}
function updateRun(id,patch){const runs=loadHistory(),i=runs.findIndex(r=>r.id===id);if(i<0)return null;runs[i]={...runs[i],...patch};writeHistory(runs);if(hydratedRun?.id===id)hydratedRun=runs[i];return runs[i]}
function saveEvaluation(runId,candidateId,provider,result,extra={}){const run=loadHistory().find(r=>r.id===runId);if(!run)return;const results={...(run.results||{})};results[candidateId]={...(results[candidateId]||{}),[provider]:result};updateRun(runId,{results,...extra});}
async function runPool(jobs,limit,fn){let next=0;async function worker(){while(true){const i=next++;if(i>=jobs.length)return;await fn(jobs[i],i)}}await Promise.all(Array.from({length:Math.min(limit,jobs.length)},worker))}

function downloadJson(filename,data){const blob=new Blob([JSON.stringify(data,null,2)+"\n"],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0)}
function exportName(prefix,run){const stamp=new Date(run?.createdAt||Date.now()).toISOString().replace(/[:.]/g,"-");return `${prefix}-${stamp}.json`}
document.querySelector("#exportRun").onclick=()=>{if(!hydratedRun){notice.classList.remove("hidden");notice.textContent="Select a saved run from History first.";return}downloadJson(exportName("jev-run",hydratedRun),hydratedRun)};
document.querySelector("#exportAll").onclick=()=>{const runs=loadHistory();if(!runs.length){notice.classList.remove("hidden");notice.textContent="No saved runs to export.";return}downloadJson(exportName("jev-runs",runs[0]),{exportedAt:new Date().toISOString(),runs})};
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
  const run=createRun(ps),jobs=candidates.flatMap(c=>ps.map(provider=>({candidate:c,provider}))),total=jobs.length;
  let completed=0,failed=0;running=true;hydrate(run.id);notice.classList.remove("hidden");
  const progress=()=>{notice.textContent=`Running ${completed} / ${total} evaluations${failed?` · ${failed} failed`:""}…`;document.querySelector("#resultStatus").textContent=`${completed} / ${total}`;renderCandidates();renderCandidate()};
  progress();
  await runPool(jobs,3,async job=>{
    const [id,,,markdown]=job.candidate;
    let result;
    try{
      const response=await fetch("/api/evaluate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({provider:job.provider,candidate:{id,markdown}})});
      const text=await response.text();let data;try{data=JSON.parse(text)}catch{throw new Error(`Server returned ${response.status}: ${text.slice(0,180)}`)}
      if(!response.ok)throw new Error(data.error||`Evaluation failed (${response.status})`);
      result=data.result;saveEvaluation(run.id,id,job.provider,result,{rubric:data.rubric,models:{...(hydratedRun?.models||{}),[job.provider]:data.model}});
    }catch(error){result={error:error.message,decisions:{},latencyMs:null,inputTokens:null,outputTokens:null};failed++;saveEvaluation(run.id,id,job.provider,result)}
    completed++;progress();
  });
  running=false;const finalStatus=failed?"complete_with_errors":"complete";updateRun(run.id,{status:finalStatus,completedAt:new Date().toISOString()});hydrate(run.id);
  document.querySelector("#resultStatus").textContent=failed?"Complete with errors":"Complete";
  notice.textContent=failed?`Run complete: ${completed-failed} succeeded, ${failed} failed.`:`Run complete: ${completed} evaluations.`;
 }catch(error){
  if(hydratedRun?.id)updateRun(hydratedRun.id,{status:"failed",error:error.message});
  running=false;notice.textContent=error.message;document.querySelector("#resultStatus").textContent="Failed";renderHistory();renderCandidates();renderCandidate();
 }
};


async function boot(){
 try{
  const [dr,cr]=await Promise.all([fetch("/api/dataset"),fetch("/api/config")]);
  if(!dr.ok)throw new Error(`Dataset failed (${dr.status})`);
  if(!cr.ok)throw new Error(`Config failed (${cr.status})`);
  const d=await dr.json(),cfg=await cr.json();
  providerConfig=cfg.providers||[];rubricConfig=d.rubric||{};expectedConfig=d.expected||{};
  for(const p of providerConfig)labels[p.id]=p.model;
  document.querySelector("#modelGrid").innerHTML=providerConfig.map(p=>`<label class="model"><input type="checkbox" data-provider="${p.id}" checked><span><b>${p.provider}</b><strong>${p.model}</strong><small>${p.configured?"Credential configured":"Credential missing"}</small></span></label>`).join("");
  document.querySelectorAll("[data-provider]").forEach(x=>x.addEventListener("change",renderConfig));
  candidates=(d.candidates||[]).map(c=>[c.id,c.title,c.description,c.markdown]);
  document.querySelector("#datasetCount").textContent=`${candidates.length} synthetic candidates`;
  active=candidates[0]?.[0]||null;
  renderCandidates();renderConfig();renderHistory();
 }catch(error){
  console.error("Boot failed",error);
  notice.classList.remove("hidden");notice.textContent=`Could not initialize app: ${error.message}`;
 }
}
boot();
