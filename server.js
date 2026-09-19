import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root=fileURLToPath(new URL(".",import.meta.url));
const defaults={TYPESAFE_MODEL:"jev-1.13",OPENAI_MODEL:"gpt-5.6-luna",OPENROUTER_MODEL:"openrouter/free"};
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
const server=http.createServer(async(req,res)=>{
 if(req.url==="/api/dataset"){try{const base=join(root,"experiments","resume","fixtures");const manifest=JSON.parse(await readFile(join(base,"manifest.json"),"utf8"));const candidates=await Promise.all(manifest.candidates.map(async c=>({...c,markdown:await readFile(join(base,c.file),"utf8")})));res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({candidates}))}catch{res.writeHead(500,{"content-type":"application/json"});return res.end(JSON.stringify({error:"Could not load dataset"}))}}
 if(req.url==="/api/config"){res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify(config))}
 if(req.url==="/api/status"){res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({ok:true,providers:Object.fromEntries(config.providers.map(p=>[p.id,p.configured]))}))}
 const pathname=req.url==="/"?"index.html":decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
 const safe=normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");const file=join(root,safe);
 if(!file.startsWith(root)){res.writeHead(403);return res.end("Forbidden")}
 try{const body=await readFile(file);res.writeHead(200,{"content-type":types[extname(file)]||"application/octet-stream"});res.end(body)}catch{res.writeHead(404);res.end("Not found")}
});
const preferredPort=Number(process.env.PORT||3000),maxAttempts=20;
function listen(port,attempt=0){const onError=error=>{server.off("listening",onListening);if(error.code==="EADDRINUSE"&&attempt<maxAttempts){const next=port+1;console.log(`Port ${port} is in use; trying ${next}…`);setTimeout(()=>listen(next,attempt+1),25);return}throw error};const onListening=()=>{server.off("error",onError);console.log(`Jev Lab → http://localhost:${port}`)};server.once("error",onError);server.once("listening",onListening);server.listen(port)}
listen(preferredPort);
