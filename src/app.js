const fixtures = [
  ["baseline","Baseline","Reference candidate"],
  ["no-payments","No payments","Payments evidence removed"],
  ["no-ai","No AI","AI evidence removed"],
  ["no-hands-on","No hands-on","Implementation evidence softened"],
  ["pm-titles","PM titles","Titles changed; bullets preserved"]
];
const selected = new Set(fixtures.map(([id])=>id));
const cases = document.querySelector("#cases");
const runs = document.querySelector("#runs");
const runCount = document.querySelector("#runCount");
const caseCount = document.querySelector("#caseCount");
const total = document.querySelector("#total");
const toggleAll = document.querySelector("#toggleAll");
const run = document.querySelector("#run");
const notice = document.querySelector("#notice");

function render(){
 cases.innerHTML="";
 for(const [id,name,note] of fixtures){
   const label=document.createElement("label");
   label.className="case"+(selected.has(id)?" active":"");
   label.innerHTML=`<input type="checkbox" ${selected.has(id)?"checked":""}><span><strong>${name}</strong><small>${note}</small></span>`;
   label.querySelector("input").addEventListener("change",()=>{selected.has(id)?selected.delete(id):selected.add(id);render()});
   cases.append(label);
 }
 const n=Number(runs.value);
 runCount.value=n; caseCount.textContent=selected.size; total.textContent=selected.size*n;
 toggleAll.textContent=selected.size===fixtures.length?"Clear":"Select all";
 run.disabled=!selected.size;
}
runs.addEventListener("input",render);
toggleAll.addEventListener("click",()=>{selected.size===fixtures.length?selected.clear():fixtures.forEach(([id])=>selected.add(id));render()});
run.addEventListener("click",async()=>{
 run.disabled=true; run.firstChild.textContent="Preparing… ";
 notice.classList.remove("hidden"); notice.textContent="Checking local experiment server…";
 try{
   const r=await fetch("/api/status"); const data=await r.json();
   notice.textContent=data.typesafeKeyConfigured
     ? "TypeSafe key detected locally. API execution is the next integration step."
     : "Add TYPESAFE_API_KEY to .env before connecting live runs.";
 }catch{notice.textContent="Could not reach the local experiment server."}
 finally{run.firstChild.textContent="Run experiment ";run.disabled=false}
});
render();
