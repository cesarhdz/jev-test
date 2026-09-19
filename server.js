import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root=fileURLToPath(new URL(".",import.meta.url));
const defaults={TYPESAFE_MODEL:"jev-latest",OPENAI_MODEL:"gpt-5.6-luna",OPENROUTER_MODEL:"qwen/qwen3.8-27b:free"};
try{
 const raw=await readFile(join(root,".env"),"utf8");
 for(const line of raw.split(/\r?\n/)){
   const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
   if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,"");
 }
}catch{}

const config={providers:[
 {id:"jev",provider:"TypeSafe",model:process.env.TYPESAFE_MODEL||defaults.TYPESAFE_MODEL,configured:Boolean(process.env.TYPESAFE_API_KEY)},
 {id:"openai",provider:"OpenAI",model:process.env.OPENAI_MODEL||defaults.OPENAI_MODEL,configured:Boolean(process.env.OPENAI_API_KEY)},
 {id:"openrouter",provider:"OpenRouter",model:process.env.OPENROUTER_MODEL||defaults.OPENROUTER_MODEL,configured:Boolean(process.env.OPENROUTER_API_KEY)}
]};
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"};
const json=(res,status,data)=>{res.writeHead(status,{"content-type":"application/json"});res.end(JSON.stringify(data))};
async function body(req){let raw="";for await(const chunk of req){raw+=chunk;if(raw.length>2_000_000)throw new Error("Request too large")}return JSON.parse(raw||"{}")}
async function rubric(){return JSON.parse(await readFile(join(root,"experiments","resume","rubric.json"),"utf8"))}

function jevQuestions(r){
 return Object.fromEntries(Object.entries(r).map(([key,q])=>[key,{
   type:q.type,
   instructions:[q.question,q.instructions].filter(Boolean).join("\n"),
   ...(q.criteria?{criteria:q.criteria}: {})
 }]));
}
const profileKeys=["product_manager","technical_product_manager","product_engineer","software_engineer","forward_deployed_engineer","other"];
const llmSchema={type:"object",additionalProperties:false,required:["technical_depth","primary_profile","llm_experience"],properties:{
 technical_depth:{type:"number",minimum:0,maximum:5},
 primary_profile:{type:"string",enum:profileKeys},
 llm_experience:{type:"boolean"}
}};
function sharedQuestions(r){
 return Object.fromEntries(Object.entries(r).map(([key,q])=>[key,{question:q.question,instructions:q.instructions,criteria:q.criteria}]));
}
function promptFor(resume,r){
 return `Use the resume as evidence and answer the evaluation contract exactly as written. Do not add explanation.\n\nEVALUATION CONTRACT:\n${JSON.stringify(sharedQuestions(r),null,2)}\n\nRESUME:\n${resume}`;
}
function normalizeLlm(parsed){
 return {technical_depth:{score:parsed.technical_depth},primary_profile:{choice:parsed.primary_profile},llm_experience:{value:parsed.llm_experience}};
}
function normalizeJev(data){
 const a=data.answers||{};
 return {model:data.model,decisions:{
  technical_depth:a.technical_depth,
  primary_profile:a.primary_profile,
  llm_experience:a.llm_experience
 },inputTokens:data.usage?.input_tokens??null,outputTokens:data.usage?.output_tokens??0,uncertainty:"native"};
}
function extractResponseText(data){
 if(data.output_text)return data.output_text;
 for(const item of data.output||[])for(const part of item.content||[])if(part.type==="output_text"&&part.text)return part.text;
 return "";
}
async function callJev(resume,r){
 const started=performance.now();
 const response=await fetch("https://api.typesafe.ai/v1/systemone",{method:"POST",signal:AbortSignal.timeout(30000),headers:{"authorization":`Bearer ${process.env.TYPESAFE_API_KEY}`,"content-type":"application/json"},body:JSON.stringify({model:config.providers.find(p=>p.id==="jev").model,state:resume,questions:jevQuestions(r)})});
 const text=await response.text();if(!response.ok)throw new Error(`TypeSafe ${response.status}: ${text.slice(0,400)}`);
 const data=JSON.parse(text);return {...normalizeJev(data),latencyMs:Math.round(performance.now()-started)};
}
async function callOpenAI(resume,r){
 const started=performance.now(),model=config.providers.find(p=>p.id==="openai").model;
 const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",signal:AbortSignal.timeout(30000),headers:{"authorization":`Bearer ${process.env.OPENAI_API_KEY}`,"content-type":"application/json"},body:JSON.stringify({model,store:false,input:promptFor(resume,r),text:{format:{type:"json_schema",name:"resume_decisions",strict:true,schema:llmSchema}}})});
 const text=await response.text();if(!response.ok)throw new Error(`OpenAI ${response.status}: ${text.slice(0,400)}`);
 const data=JSON.parse(text),parsed=JSON.parse(extractResponseText(data));
 return {model:data.model||model,decisions:normalizeLlm(parsed),inputTokens:data.usage?.input_tokens??null,outputTokens:data.usage?.output_tokens??null,latencyMs:Math.round(performance.now()-started),uncertainty:null};
}
async function callOpenRouter(resume,r){
 const started=performance.now(),model=config.providers.find(p=>p.id==="openrouter").model;
 const response=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",signal:AbortSignal.timeout(30000),headers:{"authorization":`Bearer ${process.env.OPENROUTER_API_KEY}`,"content-type":"application/json","x-title":"Jev Lab"},body:JSON.stringify({model,messages:[{role:"user",content:promptFor(resume,r)}],response_format:{type:"json_schema",json_schema:{name:"resume_decisions",strict:true,schema:llmSchema}},provider:{require_parameters:true}})});
 const text=await response.text();if(!response.ok)throw new Error(`OpenRouter ${response.status}: ${text.slice(0,400)}`);
 const data=JSON.parse(text),parsed=JSON.parse(data.choices?.[0]?.message?.content||"{}");
 return {model:data.model||model,decisions:normalizeLlm(parsed),inputTokens:data.usage?.prompt_tokens??null,outputTokens:data.usage?.completion_tokens??null,latencyMs:Math.round(performance.now()-started),uncertainty:null};
}
async function evaluate(provider,resume,r){
 try{
   if(provider==="jev")return await callJev(resume,r);
   if(provider==="openai")return await callOpenAI(resume,r);
   if(provider==="openrouter")return await callOpenRouter(resume,r);
   throw new Error("Unknown provider");
 }catch(error){return {error:error.message,decisions:{},latencyMs:null,inputTokens:null,outputTokens:null}}
}
async function mapLimit(items,limit,fn){
 const out=new Array(items.length);let next=0;
 async function worker(){while(true){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i],i)}}
 await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out;
}

const server=http.createServer(async(req,res)=>{
 const path=req.url?.split("?")[0];
 if(path==="/api/dataset"){try{const base=join(root,"experiments","resume","fixtures");const manifest=JSON.parse(await readFile(join(base,"manifest.json"),"utf8"));const candidates=await Promise.all(manifest.candidates.map(async c=>({...c,markdown:await readFile(join(base,c.file),"utf8")})));return json(res,200,{candidates})}catch(error){return json(res,500,{error:error.message})}}
 if(path==="/api/config")return json(res,200,config);
 if(path==="/api/status")return json(res,200,{ok:true,providers:Object.fromEntries(config.providers.map(p=>[p.id,p.configured]))});
 if(path==="/api/evaluate"&&req.method==="POST"){
   try{
    const payload=await body(req),provider=payload.provider,candidate=payload.candidate;
    const p=config.providers.find(x=>x.id===provider);
    if(!p)return json(res,400,{error:"Unknown provider."});
    if(!p.configured)return json(res,400,{error:`Missing credentials for: ${provider}`});
    if(!candidate?.id||typeof candidate.markdown!=="string")return json(res,400,{error:"Candidate id and markdown are required."});
    const r=await rubric();
    console.log(`[eval:start] ${candidate.id} · ${provider} · ${p.model}`);
    const result=await evaluate(provider,candidate.markdown,r);
    console.log(`[eval:${result.error?"error":"done"}] ${candidate.id} · ${provider}${result.latencyMs!=null?` · ${result.latencyMs}ms`:""}${result.error?` · ${result.error}`:""}`);
    return json(res,200,{candidateId:candidate.id,provider,result,rubric:r,model:p.model});
   }catch(error){console.error("[eval:fatal]",error);return json(res,500,{error:error.message})}
 }
 if(path==="/api/run"&&req.method==="POST"){
   try{
    const payload=await body(req),providers=Array.isArray(payload.providers)?payload.providers:[],candidates=Array.isArray(payload.candidates)?payload.candidates:[];
    const known=new Set(config.providers.map(p=>p.id));if(!providers.length||providers.some(p=>!known.has(p)))return json(res,400,{error:"Select at least one valid provider."});
    const missing=providers.filter(id=>!config.providers.find(p=>p.id===id)?.configured);if(missing.length)return json(res,400,{error:`Missing credentials for: ${missing.join(", ")}`});
    const r=await rubric(),jobs=candidates.flatMap(c=>providers.map(provider=>({candidateId:c.id,resume:c.markdown,provider})));
    const evaluated=await mapLimit(jobs,3,async job=>({...job,result:await evaluate(job.provider,job.resume,r)}));
    const results={};for(const e of evaluated){results[e.candidateId]??={};results[e.candidateId][e.provider]=e.result}
    return json(res,200,{results,completedAt:new Date().toISOString(),rubric:r,models:Object.fromEntries(providers.map(id=>{const p=config.providers.find(x=>x.id===id);return [id,p?.model]}))});
   }catch(error){return json(res,500,{error:error.message})}
 }
 const pathname=path==="/"?"index.html":decodeURIComponent(path||"").replace(/^\/+/, "");
 const safe=normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");const file=join(root,safe);
 if(!file.startsWith(root)){res.writeHead(403);return res.end("Forbidden")}
 try{const data=await readFile(file);res.writeHead(200,{"content-type":types[extname(file)]||"application/octet-stream"});res.end(data)}catch{res.writeHead(404);res.end("Not found")}
});
const preferredPort=Number(process.env.PORT||3000),maxAttempts=20;
function listen(port,attempt=0){const onError=error=>{server.off("listening",onListening);if(error.code==="EADDRINUSE"&&attempt<maxAttempts){const next=port+1;console.log(`Port ${port} is in use; trying ${next}…`);setTimeout(()=>listen(next,attempt+1),25);return}throw error};const onListening=()=>{server.off("error",onError);console.log(`Jev Lab → http://localhost:${port}`)};server.once("error",onError);server.once("listening",onListening);server.listen(port)}
listen(preferredPort);
