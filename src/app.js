const candidates=[
["c01","Backend specialist","Senior backend engineer · deep systems · no AI"],
["c02","AI product engineer","Hands-on product + engineering · strong LLM evidence"],
["c03","Senior product manager","Strong product ownership · little coding"],
["c04","Technical PM","APIs, platforms and data · moderate hands-on depth"],
["c05","Junior full-stack","Early career · broad implementation evidence"],
["c06","Forward deployed engineer","Customer-facing engineering · deployments and integrations"],
["c07","Ambiguous hybrid","Product, engineering and customer work are evenly mixed"],
["c08","AI product manager","Strong AI product work · limited implementation"],
["c09","Staff engineer","Deep architecture and technical leadership · no product ownership"],
["c10","Founder-builder","0→1 product ownership · hands-on full-stack"],
["c11","Data / ML engineer","Production ML systems · limited product leadership"],
["c12","Operations PM","Workflow ownership · integrations · low engineering evidence"]
];
const sampleResume=(c)=>`${c[1].toUpperCase()} — SYNTHETIC RESUME

${c[2]}

This preview will be replaced by the complete fixture content used by the runner.
The exact same input is sent to every selected model.`;
const list=document.querySelector("#candidateList"), name=document.querySelector("#candidateName"),desc=document.querySelector("#candidateDescription"),preview=document.querySelector("#inputPreview"),tabs=document.querySelector("#providerTabs");
let active=candidates[0][0];
function renderCandidates(){list.innerHTML="";for(const c of candidates){const b=document.createElement("button");b.className="candidate "+(active===c[0]?"active":"");b.innerHTML=`<span>${c[0].slice(1)}</span><div><strong>${c[1]}</strong><small>${c[2]}</small></div>`;b.onclick=()=>{active=c[0];renderCandidates();renderCandidate()};list.append(b)}}
function renderCandidate(){const c=candidates.find(x=>x[0]===active);name.textContent=c[1];desc.textContent=c[2];preview.textContent=sampleResume(c)}
function selectedProviders(){return [...document.querySelectorAll("[data-provider]:checked")].map(x=>x.dataset.provider)}
function renderConfig(){const ps=selectedProviders();document.querySelector("#modelSummary").textContent=`${ps.length} model${ps.length===1?"":"s"}`;document.querySelector("#evalSummary").textContent=`${12*ps.length} evaluations`;tabs.innerHTML=ps.map((p,i)=>`<button class="${i===0?"active":""}">${p==="jev"?"Jev 1.13":p==="openai"?"GPT-5.6 Luna":"OpenRouter · free"}</button>`).join("")}
document.querySelectorAll("[data-provider]").forEach(x=>x.addEventListener("change",renderConfig));
document.querySelector("#advancedToggle").onclick=()=>document.querySelector("#advanced").classList.toggle("hidden");
document.querySelector("#viewInput").onclick=()=>preview.classList.toggle("hidden");
document.querySelector("#run").onclick=async()=>{const notice=document.querySelector("#notice");notice.classList.remove("hidden");notice.textContent="Checking configured API keys…";const r=await fetch("/api/status");const s=await r.json();const missing=[];for(const p of selectedProviders()){if(p==="jev"&&!s.typesafeKeyConfigured)missing.push("TYPESAFE_API_KEY");if(p==="openai"&&!s.openaiKeyConfigured)missing.push("OPENAI_API_KEY");if(p==="openrouter"&&!s.openrouterKeyConfigured)missing.push("OPENROUTER_API_KEY")}notice.textContent=missing.length?`Missing: ${missing.join(", ")}`:"Keys detected. Provider execution is the next integration step.";};
renderCandidates();renderCandidate();renderConfig();