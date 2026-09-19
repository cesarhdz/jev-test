import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root=fileURLToPath(new URL(".",import.meta.url));
const envPath=join(root,".env");
try{
 const raw=await readFile(envPath,"utf8");
 for(const line of raw.split(/\r?\n/)){
   const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
   if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,"");
 }
}catch{}

const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"};
const server=http.createServer(async(req,res)=>{
 if(req.url==="/api/status"){
   res.writeHead(200,{"content-type":"application/json"});
   return res.end(JSON.stringify({ok:true,typesafeKeyConfigured:Boolean(process.env.TYPESAFE_API_KEY)}));
 }
 const pathname=req.url==="/"?"index.html":decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
 const safe=normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
 const file=join(root,safe);
 if(!file.startsWith(root)){res.writeHead(403);return res.end("Forbidden")}
 try{
   const body=await readFile(file);
   res.writeHead(200,{"content-type":types[extname(file)]||"application/octet-stream"});
   res.end(body);
 }catch{res.writeHead(404);res.end("Not found")}
});
const port=Number(process.env.PORT||3000);
server.listen(port,()=>console.log(`Jev Lab → http://localhost:${port}`));
