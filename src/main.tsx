import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Fixture = { id:string; name:string; note:string };
const fixtures: Fixture[] = [
  { id:"baseline", name:"Baseline", note:"Reference candidate" },
  { id:"no-payments", name:"No payments", note:"Payments evidence removed" },
  { id:"no-ai", name:"No AI", note:"AI evidence removed" },
  { id:"no-hands-on", name:"No hands-on", note:"Implementation evidence softened" },
  { id:"pm-titles", name:"PM titles", note:"Titles changed; bullets preserved" }
];

function App(){
 const [selected,setSelected]=useState(fixtures.map(f=>f.id));
 const [runs,setRuns]=useState(10);
 const [provider,setProvider]=useState("jev");
 const [status,setStatus]=useState<"idle"|"ready">("idle");
 const total=useMemo(()=>selected.length*runs,[selected,runs]);
 const toggle=(id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
 return <main>
   <header><div><span className="eyebrow">STRUCTURED DECISION LAB</span><h1>Jev experiment runner</h1><p>Run controlled resume mutations against one frozen rubric. Compare sensitivity, invariance, stability and runtime.</p></div><div className="badge">Experiment 01</div></header>
   <section className="grid">
    <div className="panel">
      <div className="panelHead"><div><span className="step">01</span><h2>Cases</h2></div><button className="link" onClick={()=>setSelected(selected.length===fixtures.length?[]:fixtures.map(f=>f.id))}>{selected.length===fixtures.length?"Clear":"Select all"}</button></div>
      <div className="cases">{fixtures.map(f=><label className={"case "+(selected.includes(f.id)?"active":"")} key={f.id}><input type="checkbox" checked={selected.includes(f.id)} onChange={()=>toggle(f.id)}/><span><strong>{f.name}</strong><small>{f.note}</small></span></label>)}</div>
    </div>
    <div className="panel">
      <div className="panelHead"><div><span className="step">02</span><h2>Run configuration</h2></div></div>
      <label className="field">Provider<select value={provider} onChange={e=>setProvider(e.target.value)}><option value="jev">TypeSafe · Jev 1.13</option><option disabled>OpenAI · coming next</option><option disabled>Anthropic · coming next</option></select></label>
      <label className="field">Runs per case<div className="runrow"><input type="range" min="1" max="30" value={runs} onChange={e=>setRuns(+e.target.value)}/><output>{runs}</output></div></label>
      <div className="summary"><span>Cases <b>{selected.length}</b></span><span>Total evaluations <b>{total}</b></span><span>Rubric <b>6 decisions</b></span></div>
      <button className="run" disabled={!selected.length} onClick={()=>setStatus("ready")}>Run experiment <span>→</span></button>
      {status==="ready"&&<p className="notice">UI is ready. The next commit connects this action to the TypeSafe API; your key stays in the local <code>.env</code>.</p>}
    </div>
   </section>
   <section className="panel results">
    <div className="panelHead"><div><span className="step">03</span><h2>Results</h2></div><span className="muted">Waiting for provider run</span></div>
    <div className="empty"><div className="pulse"/><strong>No runs yet</strong><span>Results will compare score deltas, variance and latency by fixture.</span></div>
   </section>
 </main>
}
createRoot(document.getElementById("root")!).render(<App/>);