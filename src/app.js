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
function candidateState(id){if(!hydratedRun)return "";const vals=Object.values(hydratedRun.results?.[id]||{});if(vals.some(v=>v?.error))return "error";if(vals.length>=hydratedRun.providers.length)return "done";if(running)return "queued";return ""}
function renderCandidates(){list.innerHTML="";for(const c of candidates){const state=candidateState(c[0]),b=document.createElement("button");b.className="candidate "+(active===c[0]?"active ":"")+state;b.innerHTML=`<span>${c[0].slice(1)}</span><div><strong>${c[1]}</strong><small>${c[2]}</small></div>${state?`<i class="candidateState">${state==="done"?"✓":state==="error"?"!":"·"}</i>`:""}`;b.onclick=()=>{active=c[0];renderCandidates();renderCandidate()};list.append(b)}}

const pct=n=>Number.isFinite(Number(n))?`${Math.round(Number(n)*100)}%`:"—";
function bars(entries){return `<div class="probabilities">${entries.map(([label,value])=>`<div class="probRow"><span>${escapeHtml(label)}</span><div><i style="width:${Math.max(0,Math.min(100,Number(value)*100))}%"></i></div><b>${pct(value)}</b></div>`).join("")}</div>`}
function decisionHtml(key,d,uncertainty){
 if(!d)return `<div class="placeholder">No result</div>`;
 const note=uncertainty==="native"?"Native model uncertainty":"";
 if(key==="technical_depth"){
   const probs=Array.isArray(d.probabilities)?d.probabilities.map((v,i)=>[String(i),v]):Object.entries(d.probabilities||{});
   return `<div class="decisionValue"><strong>${Number(d.score).toFixed(Number.isInteger(d.score)?0:2)} <small>/ 5</small></strong>${d.confidence!=null?`<span>Confidence ${pct(d.confidence)}</span>`:""}</div>${probs.length?bars(probs):""}${note?`<small class="uncertainty">${note}</small>`:""}`;
 }
 if(key==="primary_profile"){
   const probs=Object.entries(d.probabilities||{}).sort((a,b)=>b[1]-a[1]);
   return `<div class="decisionValue"><strong class="choiceValue">${escapeHtml(d.choice||"—").replaceAll("_"," ")}</strong>${d.confidence!=null?`<span>Confidence ${pct(d.confidence)}</span>`:""}</div>${probs.length?bars(probs):""}${note?`<small class="uncertainty">${note}</small>`:""}`;
 }
 if(typeof d.value==="boolean")return `<div class="decisionValue"><strong>${d.value?"Yes":"No"}</strong></div>`;
 const p=d.noul??d.probability??null;
 return `<div class="decisionValue"><strong>${p==null?"—":p>=.5?"Yes":"No"}</strong><span>P(true) ${pct(p)}</span></div>${p==null?"":bars([["true",p],["false",1-p]])}${note?`<small class="uncertainty">${note}</small>`:""}`;
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
function updateRun(id,patch){const runs=loadHistory(),i=runs.findIndex(r=>r.id===id);if(i<0)return null;runs[i]={...runs[i],...patch};writeHistory(runs);if(hydratedRun?.id===id)hydratedRun=runs[i];return runs[i]}
function saveEvaluation(runId,candidateId,provider,result,extra={}){const run=loadHistory().find(r=>r.id===runId);if(!run)return;const results={...(run.results||{})};results[candidateId]={...(results[candidateId]||{}),[provider]:result};updateRun(runId,{results,...extra});}
async function runPool(jobs,limit,fn){let next=0;async function worker(){while(true){const i=next++;if(i>=jobs.length)return;await fn(jobs[i],i)}}await Promise.all(Array.from({length:Math.min(limit,jobs.length)},worker))}

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
