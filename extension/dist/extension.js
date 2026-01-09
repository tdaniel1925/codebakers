"use strict";var Sc=Object.create;var rs=Object.defineProperty;var _c=Object.getOwnPropertyDescriptor;var Cc=Object.getOwnPropertyNames;var Pc=Object.getPrototypeOf,Tc=Object.prototype.hasOwnProperty;var f=(n,e)=>()=>(n&&(e=n(n=0)),e);var de=(n,e)=>()=>(e||n((e={exports:{}}).exports,e),e.exports),At=(n,e)=>{for(var t in e)rs(n,t,{get:e[t],enumerable:!0})},td=(n,e,t,a)=>{if(e&&typeof e=="object"||typeof e=="function")for(let s of Cc(e))!Tc.call(n,s)&&s!==t&&rs(n,s,{get:()=>e[s],enumerable:!(a=_c(e,s))||a.enumerable});return n};var L=(n,e,t)=>(t=n!=null?Sc(Pc(n)):{},td(e||!n||!n.__esModule?rs(t,"default",{value:n,enumerable:!0}):t,n)),Ec=n=>td(rs({},"__esModule",{value:!0}),n);var ad={};At(ad,{DiffContentProvider:()=>Vo,FileOperations:()=>Qa});var E,dt,ds,Qa,Vo,Uo=f(()=>{"use strict";E=L(require("vscode")),dt=L(require("path")),ds=L(require("fs")),Qa=class{constructor(){this._backups=new Map;this._operationLock=new Set;this.workspaceRoot=E.workspace.workspaceFolders?.[0]?.uri.fsPath}async fileExists(e){if(!this.workspaceRoot)return!1;try{let t=dt.join(this.workspaceRoot,e);return await E.workspace.fs.stat(E.Uri.file(t)),!0}catch{return!1}}async acquireLock(e,t=5e3){let a=Date.now();for(;this._operationLock.has(e);){if(Date.now()-a>t)return console.error(`FileOperations: Timeout waiting for lock on ${e}`),!1;await new Promise(s=>setTimeout(s,50))}return this._operationLock.add(e),!0}releaseLock(e){this._operationLock.delete(e)}async createBackup(e){let t=await this.readFile(e),a={path:e,originalContent:t,timestamp:Date.now()};return this._backups.set(e,a),a}async restoreFromBackup(e){let t=this._backups.get(e);if(!t)return E.window.showWarningMessage(`No backup found for ${e}`),!1;try{return t.originalContent===null?await this.deleteFile(e):await this.writeFile(e,t.originalContent),this._backups.delete(e),E.window.showInformationMessage(`\u2705 Restored ${e}`),!0}catch(a){return E.window.showErrorMessage(`Failed to restore ${e}: ${a}`),!1}}getBackups(){return Array.from(this._backups.values())}cleanupOldBackups(){let e=Date.now()-36e5;for(let[t,a]of this._backups)a.timestamp<e&&this._backups.delete(t)}async readFile(e){if(!this.workspaceRoot)return null;try{let t=dt.join(this.workspaceRoot,e),a=E.Uri.file(t),s=await E.workspace.fs.readFile(a);return Buffer.from(s).toString("utf-8")}catch(t){return console.error(`Failed to read file ${e}:`,t),null}}async writeFile(e,t){if(!this.workspaceRoot)return E.window.showErrorMessage("No workspace folder open"),!1;try{let a=dt.join(this.workspaceRoot,e),s=E.Uri.file(a),o=dt.dirname(a);return ds.existsSync(o)||ds.mkdirSync(o,{recursive:!0}),await E.workspace.fs.writeFile(s,Buffer.from(t,"utf-8")),!0}catch(a){return console.error(`Failed to write file ${e}:`,a),E.window.showErrorMessage(`Failed to write ${e}: ${a}`),!1}}async deleteFile(e){if(!this.workspaceRoot)return console.error("FileOperations: No workspace root"),!1;try{let t=dt.join(this.workspaceRoot,e),a=E.Uri.file(t);return await this.fileExists(e)?(await E.workspace.fs.delete(a),console.log(`FileOperations: Deleted ${e}`),!0):(console.log(`FileOperations: File ${e} doesn't exist, treating as success`),!0)}catch(t){return t?.code==="FileNotFound"||t?.code==="ENOENT"?(console.log(`FileOperations: File ${e} already deleted`),!0):(console.error(`FileOperations: Failed to delete ${e}:`,t),E.window.showErrorMessage(`Failed to delete ${e}: ${t.message||t}`),!1)}}async showDiff(e,t,a){if(!this.workspaceRoot)return;let s=dt.join(this.workspaceRoot,e),o=E.Uri.file(s),i=E.Uri.parse(`codebakers-diff:${e}?content=${encodeURIComponent(t)}`),r=a||`CodeBakers: ${e}`;await E.commands.executeCommand("vscode.diff",o,i,r)}async applyChange(e){if(!await this.acquireLock(e.path))return E.window.showErrorMessage(`Cannot modify ${e.path} - another operation is in progress`),!1;try{switch((e.action==="edit"||e.action==="delete")&&await this.createBackup(e.path),e.action){case"create":return e.content?(await this.fileExists(e.path)&&await this.createBackup(e.path),this.writeFile(e.path,e.content)):(E.window.showErrorMessage(`Cannot create ${e.path} - no content provided`),!1);case"edit":return e.content?(await this.fileExists(e.path)||console.log(`FileOperations: File ${e.path} doesn't exist, creating instead of editing`),this.writeFile(e.path,e.content)):(E.window.showErrorMessage(`Cannot edit ${e.path} - no content provided`),!1);case"delete":return this.deleteFile(e.path);default:return E.window.showErrorMessage(`Unknown action: ${e.action}`),!1}}finally{this.releaseLock(e.path)}}async applyChanges(e){let t=0,a=0;for(let s of e)await this.applyChange(s)?t++:a++;return{success:t,failed:a}}async runCommand(e,t){let a=E.window.createTerminal({name:t||"CodeBakers",cwd:this.workspaceRoot});a.show(),a.sendText(e)}async runCommandWithOutput(e){return new Promise((t,a)=>{let{exec:s}=require("child_process");s(e,{cwd:this.workspaceRoot,timeout:3e4},(o,i,r)=>{o?a(new Error(r||o.message)):t(i)})})}async findFiles(e,t){return(await E.workspace.findFiles(e,t||"**/node_modules/**")).map(s=>E.workspace.asRelativePath(s))}async openFile(e,t){if(!this.workspaceRoot)return;let a=dt.join(this.workspaceRoot,e),s=E.Uri.file(a),o=await E.workspace.openTextDocument(s),i=await E.window.showTextDocument(o);if(t){let r=new E.Position(t.line-1,(t.column||1)-1);i.selection=new E.Selection(r,r),i.revealRange(new E.Range(r,r),E.TextEditorRevealType.InCenter)}}getCurrentFile(){let e=E.window.activeTextEditor;if(!e)return null;let t=E.workspace.asRelativePath(e.document.uri),a=e.document.getText(),s=e.selection.isEmpty?void 0:e.document.getText(e.selection);return{path:t,content:a,selection:s}}async getFileTree(e=2){let t=[],a=async(s,o)=>{if(o>e)return;let i=new E.RelativePattern(s,"*"),r=await E.workspace.findFiles(i,"**/node_modules/**",100);for(let d of r){let p=E.workspace.asRelativePath(d);t.push(p)}};return this.workspaceRoot&&await a(this.workspaceRoot,0),t.sort()}},Vo=class{provideTextDocumentContent(e){let a=new URLSearchParams(e.query).get("content");return a?decodeURIComponent(a):""}}});var ps,Jt,wa,sd,od,nd,xa,qo=f(()=>{"use strict";ps=L(require("vscode")),Jt=L(require("fs")),wa=L(require("path")),sd=require("child_process"),od=require("util"),nd=(0,od.promisify)(sd.exec),xa=class{constructor(){this.typeInventory=null;this.installedPackages=new Set;this.workspaceRoot=ps.workspace.workspaceFolders?.[0]?.uri.fsPath}async initialize(){this.workspaceRoot&&await Promise.all([this.scanInstalledPackages(),this.scanTypeInventory()])}async scanInstalledPackages(){if(!this.workspaceRoot)return;let e=wa.join(this.workspaceRoot,"package.json");if(Jt.existsSync(e))try{let t=Jt.readFileSync(e,"utf-8"),a=JSON.parse(t);this.installedPackages.clear();for(let s of Object.keys(a.dependencies||{}))this.installedPackages.add(s);for(let s of Object.keys(a.devDependencies||{}))this.installedPackages.add(s);console.log(`CodeValidator: Found ${this.installedPackages.size} installed packages`)}catch(t){console.error("CodeValidator: Failed to scan packages:",t)}}async scanTypeInventory(){if(!this.workspaceRoot)return;this.typeInventory={types:new Map,exports:new Map};let e=await ps.workspace.findFiles("**/*.{ts,tsx}","**/node_modules/**",200);for(let t of e)try{let a=Jt.readFileSync(t.fsPath,"utf-8"),s=ps.workspace.asRelativePath(t);this.extractTypes(a,s),this.extractExports(a,s)}catch{}console.log(`CodeValidator: Found ${this.typeInventory.types.size} types, ${this.typeInventory.exports.size} files with exports`)}extractTypes(e,t){if(!this.typeInventory)return;let a=/export\s+interface\s+(\w+)/g,s;for(;(s=a.exec(e))!==null;)this.typeInventory.types.set(s[1],{name:s[1],file:t,kind:"interface",exported:!0});let o=/export\s+type\s+(\w+)/g;for(;(s=o.exec(e))!==null;)this.typeInventory.types.set(s[1],{name:s[1],file:t,kind:"type",exported:!0});let i=/export\s+enum\s+(\w+)/g;for(;(s=i.exec(e))!==null;)this.typeInventory.types.set(s[1],{name:s[1],file:t,kind:"enum",exported:!0})}extractExports(e,t){if(!this.typeInventory)return;let a=[],s=/export\s+(?:async\s+)?function\s+(\w+)/g,o;for(;(o=s.exec(e))!==null;)a.push({name:o[1],file:t,kind:"function"});let i=/export\s+const\s+(\w+)/g;for(;(o=i.exec(e))!==null;)a.push({name:o[1],file:t,kind:"const"});let r=/export\s+class\s+(\w+)/g;for(;(o=r.exec(e))!==null;)a.push({name:o[1],file:t,kind:"class"});/export\s+default/.test(e)&&a.push({name:"default",file:t,kind:"default"}),a.length>0&&this.typeInventory.exports.set(t,a)}checkDependencies(e){let t={missing:[],available:[],suggestions:[]},a=new Set;for(let s of e){if(!s.content)continue;let o=/import\s+.*?\s+from\s+['"]([^'"./][^'"]*)['"]/g,i;for(;(i=o.exec(s.content))!==null;){let r=i[1].split("/")[0];if(r.startsWith("@")){let d=i[1].split("/").slice(0,2).join("/");a.add(d)}else a.add(r)}}for(let s of a)this.installedPackages.has(s)?t.available.push(s):["fs","path","http","https","crypto","util","stream","events","url","querystring","os","child_process"].includes(s)||(t.missing.push(s),t.suggestions.push({package:s,command:`npm install ${s}`}));return t}async validateFileOperations(e){let t={passed:!0,errors:[],warnings:[],suggestions:[]};for(let o of e){if(!o.content||o.action==="delete")continue;let i=this.validateImports(o);t.errors.push(...i);let r=this.checkTypeUsage(o);t.warnings.push(...r);let d=this.checkSecurity(o);t.errors.push(...d);let p=this.checkBestPractices(o);t.warnings.push(...p)}!e.some(o=>o.path.includes(".test.")||o.path.includes(".spec.")||o.path.includes("__tests__"))&&e.length>0&&t.warnings.push({file:"project",message:"No test file included with this feature",type:"no-test"});let s=this.suggestExistingTypes(e);return t.suggestions.push(...s),t.passed=t.errors.length===0,t}validateImports(e){let t=[];if(!e.content||!this.workspaceRoot)return t;let a=/import\s+.*?\s+from\s+['"](\.[^'"]+)['"]/g,s;for(;(s=a.exec(e.content))!==null;){let o=s[1],i=wa.dirname(e.path),r=wa.join(this.workspaceRoot,i,o),p=["",".ts",".tsx",".js",".jsx","/index.ts","/index.tsx"].some(c=>{let m=r+c;return Jt.existsSync(m)}),l=o.replace(/^\.\//,"").replace(/^\.\.\//,"")}return t}checkTypeUsage(e){let t=[];if(!e.content)return t;let a=e.content.match(/:\s*any\b/g)||[];return a.length>2&&t.push({file:e.path,message:`Found ${a.length} uses of 'any' type - consider proper typing`,type:"any-type"}),t}checkSecurity(e){let t=[];if(!e.content)return t;let a=[{pattern:/['"]sk-[a-zA-Z0-9]{20,}['"]/,name:"OpenAI API key"},{pattern:/['"]sk_live_[a-zA-Z0-9]+['"]/,name:"Stripe live key"},{pattern:/['"]ghp_[a-zA-Z0-9]+['"]/,name:"GitHub token"},{pattern:/password\s*[:=]\s*['"][^'"]+['"]/,name:"Hardcoded password"}];for(let{pattern:s,name:o}of a)s.test(e.content)&&t.push({file:e.path,message:`Potential ${o} found in code - use environment variables`,type:"security"});return(e.path.includes("/components/")||e.path.includes("/app/")&&!e.path.includes("/api/"))&&/process\.env\.((?!NEXT_PUBLIC_)[A-Z_]+)/.test(e.content)&&t.push({file:e.path,message:"Server-side env var accessed in client component - use NEXT_PUBLIC_ prefix or move to API route",type:"security"}),t}checkBestPractices(e){let t=[];if(!e.content)return t;if(!/\.test\.|\.spec\./.test(e.path)){let a=(e.content.match(/console\.(log|debug|info)\(/g)||[]).length;a>0&&t.push({file:e.path,message:`Found ${a} console.log statement(s) - remove before production`,type:"console-log"})}return e.content.includes("async ")&&e.content.includes("await ")&&!e.content.includes("try")&&!e.content.includes("catch")&&t.push({file:e.path,message:"Async function without try/catch error handling",type:"missing-error-handling"}),e.path.includes("/api/")&&!e.content.includes("catch")&&!e.content.includes("error")&&t.push({file:e.path,message:"API route may lack error handling",type:"missing-error-handling"}),t}suggestExistingTypes(e){let t=[];if(!this.typeInventory)return t;for(let a of e){if(!a.content)continue;let s=/(?:interface|type)\s+(\w+)/g,o;for(;(o=s.exec(a.content))!==null;){let i=o[1];if(this.typeInventory.types.has(i)){let r=this.typeInventory.types.get(i);t.push(`Type '${i}' already exists in ${r.file} - consider importing instead of redefining`)}}}return t}getTypeInventoryForContext(){if(!this.typeInventory||this.typeInventory.types.size===0)return"No existing types found";let e=["Existing types in project:"],t=new Map;for(let[,a]of this.typeInventory.types){let s=t.get(a.file)||[];s.push(a),t.set(a.file,s)}for(let[a,s]of t)if(s.length>0){e.push(`  ${a}:`);for(let o of s.slice(0,10))e.push(`    - ${o.kind} ${o.name}`);s.length>10&&e.push(`    ... and ${s.length-10} more`)}return e.slice(0,50).join(`
`)}getInstalledPackagesForContext(){return Array.from(this.installedPackages).slice(0,50)}async runTypeScriptCheck(){if(!this.workspaceRoot)return{passed:!0,errors:[],errorCount:0};let e=wa.join(this.workspaceRoot,"tsconfig.json");if(!Jt.existsSync(e))return console.log("CodeValidator: No tsconfig.json found, skipping TypeScript check"),{passed:!0,errors:[],errorCount:0};try{return await nd("npx tsc --noEmit",{cwd:this.workspaceRoot,timeout:6e4}),{passed:!0,errors:[],errorCount:0}}catch(t){let a=t.stdout||t.stderr||"",s=this.parseTypeScriptErrors(a);return{passed:!1,errors:s,errorCount:s.length}}}parseTypeScriptErrors(e){let t=[],a=e.split(`
`),s=/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/;for(let o of a){let i=o.match(s);i&&t.push({file:i[1],line:parseInt(i[2],10),column:parseInt(i[3],10),code:i[4],message:i[5]})}return t.slice(0,20)}async checkSpecificFiles(e){if(!this.workspaceRoot||e.length===0)return{passed:!0,errors:[],errorCount:0};let t=e.filter(a=>a.endsWith(".ts")||a.endsWith(".tsx"));if(t.length===0)return{passed:!0,errors:[],errorCount:0};try{let a=t.map(s=>`"${s}"`).join(" ");return await nd(`npx tsc --noEmit ${a}`,{cwd:this.workspaceRoot,timeout:3e4}),{passed:!0,errors:[],errorCount:0}}catch(a){let s=a.stdout||a.stderr||"",o=this.parseTypeScriptErrors(s);return{passed:!1,errors:o,errorCount:o.length}}}}});var Q,Ke,ls,id=f(()=>{"use strict";Q=L(require("fs")),Ke=L(require("path")),ls=class{constructor(e){this.workspaceRoot=e,this.codebakersDir=Ke.join(e,".codebakers"),this.configPath=Ke.join(e,".codebakers.json"),this.devlogPath=Ke.join(this.codebakersDir,"DEVLOG.md"),this.statePath=Ke.join(this.codebakersDir,"PROJECT-STATE.md"),this.contextPath=Ke.join(this.codebakersDir,"CONTEXT.md")}async initialize(){if(Q.existsSync(this.codebakersDir)||Q.mkdirSync(this.codebakersDir,{recursive:!0}),Q.existsSync(this.configPath)){let a=this.loadConfig();return{isNew:!1,needsOnboarding:!a?.onboardingCompleted,config:a}}return{isNew:!Q.existsSync(Ke.join(this.workspaceRoot,"package.json")),needsOnboarding:!0,config:null}}detectStack(){let e=Ke.join(this.workspaceRoot,"package.json");if(!Q.existsSync(e))return{detected:!1};try{let t=JSON.parse(Q.readFileSync(e,"utf-8")),a={...t.dependencies,...t.devDependencies},s={detected:!0};a.next?s.framework="Next.js":a.react?s.framework="React":a.vue?s.framework="Vue":a["@angular/core"]?s.framework="Angular":a.express&&(s.framework="Express"),a["drizzle-orm"]?s.database="Drizzle":a.prisma||a["@prisma/client"]?s.database="Prisma":a.typeorm?s.database="TypeORM":a.mongoose?s.database="MongoDB/Mongoose":a.pg&&(s.database="PostgreSQL"),a["@supabase/supabase-js"]?s.auth="Supabase":a["next-auth"]||a["@auth/core"]?s.auth="NextAuth":a["@clerk/nextjs"]?s.auth="Clerk":a.firebase&&(s.auth="Firebase"),a.tailwindcss&&(s.ui="Tailwind"),a["@radix-ui/react-slot"]||a["class-variance-authority"]?s.ui=(s.ui?s.ui+" + ":"")+"shadcn/ui":a["@chakra-ui/react"]?s.ui="Chakra UI":a["@mui/material"]&&(s.ui="Material UI");let o=[];return(a.stripe||a["@stripe/stripe-js"])&&o.push("Stripe"),a["@paypal/react-paypal-js"]&&o.push("PayPal"),a.square&&o.push("Square"),o.length>0&&(s.payments=o),s}catch{return{detected:!1}}}createConfig(e,t,a,s){let o=new Date().toISOString(),i=this.detectStack(),r={version:"1.0",projectType:t,projectName:e,createdAt:o,lastUpdated:o,userPreferences:a,stack:i,onboardingCompleted:!0,discovery:s};return this.saveConfig(r),r}loadConfig(){try{if(Q.existsSync(this.configPath))return JSON.parse(Q.readFileSync(this.configPath,"utf-8"))}catch(e){console.error("Failed to load config:",e)}return null}saveConfig(e){e.lastUpdated=new Date().toISOString(),Q.writeFileSync(this.configPath,JSON.stringify(e,null,2))}updateCurrentWork(e){let t=this.loadConfig();t&&(t.currentWork={...t.currentWork,...e,lastUpdated:new Date().toISOString()},this.saveConfig(t),this.updateProjectState(),this.updateContextFile())}addDevlogEntry(e){let t=new Date,a={...e,date:t.toISOString().split("T")[0],sessionId:`session_${t.getTime()}`},s="";Q.existsSync(this.devlogPath)?s=Q.readFileSync(this.devlogPath,"utf-8"):s=`# Development Log

`;let o=this.formatDevlogEntry(a),i=s.indexOf(`

`)+2;s=s.slice(0,i)+o+`
---

`+s.slice(i),Q.writeFileSync(this.devlogPath,s)}formatDevlogEntry(e){let t=`## ${e.date} - ${e.title}
`;return t+=`**Session:** ${e.sessionId}
`,t+=`**Task Size:** ${e.taskSize.toUpperCase()}
`,t+=`**Status:** ${e.status}

`,t+=`### What was done:
`,e.whatWasDone.forEach(a=>{t+=`- ${a}
`}),e.filesChanged.length>0&&(t+=`
### Files changed:
`,e.filesChanged.forEach(a=>{t+=`- \`${a.path}\` - ${a.change}
`})),e.nextSteps&&e.nextSteps.length>0&&(t+=`
### Next steps:
`,e.nextSteps.forEach(a=>{t+=`- ${a}
`})),e.blockers&&e.blockers.length>0&&(t+=`
### Blockers:
`,e.blockers.forEach(a=>{t+=`- ${a}
`})),t}updateProjectState(){let e=this.loadConfig();if(!e)return;let t=`# Project State
`;t+=`> Last updated: ${new Date().toISOString()}

`,t+=`## Project: ${e.projectName}

`,e.stack.detected&&(t+=`## Stack
`,e.stack.framework&&(t+=`- **Framework:** ${e.stack.framework}
`),e.stack.database&&(t+=`- **Database:** ${e.stack.database}
`),e.stack.auth&&(t+=`- **Auth:** ${e.stack.auth}
`),e.stack.ui&&(t+=`- **UI:** ${e.stack.ui}
`),e.stack.payments&&(t+=`- **Payments:** ${e.stack.payments.join(", ")}
`),t+=`
`),e.currentWork&&(t+=`## In Progress
`,t+=`**${e.currentWork.activeFeature}** (${e.currentWork.status})

`,t+=`${e.currentWork.summary}

`,e.currentWork.pendingTasks.length>0&&(t+=`### Pending Tasks:
`,e.currentWork.pendingTasks.forEach(a=>{t+=`- [ ] ${a}
`}),t+=`
`),e.currentWork.filesModified.length>0&&(t+=`### Recently Modified:
`,e.currentWork.filesModified.slice(0,10).forEach(a=>{t+=`- ${a}
`}),t+=`
`)),e.build&&(t+=`## Build Progress
`,t+=`Phase ${e.build.currentPhase}/${e.build.totalPhases}: ${e.build.status}

`,e.build.phases.forEach((a,s)=>{let o=a.status==="completed"?"\u2705":a.status==="in_progress"?"\u{1F504}":"\u23F3";t+=`${o} **Phase ${s+1}: ${a.name}**
`}),t+=`
`),e.discovery&&(t+=`## Project Overview
`,t+=`${e.discovery.projectDescription}

`,t+=`**Target Users:** ${e.discovery.targetUsers}

`,t+=`**Key Features:**
`,e.discovery.keyFeatures.forEach(a=>{t+=`- ${a}
`}),t+=`
`),Q.writeFileSync(this.statePath,t)}updateContextFile(){let e=this.loadConfig();if(!e)return;let t=`# CodeBakers Context (Auto-Generated)
`;t+=`> This file is automatically maintained. Do not edit manually.
`,t+=`> Last updated: ${new Date().toISOString()}

`,t+=`## CRITICAL: Read This First
`,t+=`If this conversation was just compacted/resumed, READ THIS FILE to restore context.

`,t+=`## Project: ${e.projectName}
`,t+=`- Type: ${e.projectType}
`,t+=`- User Skill: ${e.userPreferences.skillLevel}

`,e.stack.detected&&(t+=`## Established Stack (DO NOT CHANGE)
`,e.stack.framework&&(t+=`- Framework: ${e.stack.framework}
`),e.stack.database&&(t+=`- Database/ORM: ${e.stack.database}
`),e.stack.auth&&(t+=`- Auth: ${e.stack.auth}
`),e.stack.ui&&(t+=`- UI: ${e.stack.ui}
`),t+=`
`),e.currentWork&&(t+=`## Current Work
`,t+=`- **Active:** ${e.currentWork.activeFeature}
`,t+=`- **Status:** ${e.currentWork.status}
`,t+=`- **Summary:** ${e.currentWork.summary}
`,e.currentWork.pendingTasks.length>0&&(t+=`- **Next:** ${e.currentWork.pendingTasks[0]}
`),t+=`
`),e.discovery&&(t+=`## Project Requirements
`,t+=e.discovery.projectDescription+`
`,t+=`- Users: ${e.discovery.targetUsers}
`,t+=`- Auth Required: ${e.discovery.needsAuth?"Yes":"No"}
`,t+=`- Payments Required: ${e.discovery.needsPayments?"Yes":"No"}
`,t+=`
`),t+=`## User Preferences (Adjust Behavior)
`,t+=`- Skill Level: ${e.userPreferences.skillLevel}
`,t+=`- Explanations: ${e.userPreferences.verboseExplanations?"Detailed":"Minimal"}
`,t+=`- Auto Apply: ${e.userPreferences.autoApply?"Yes":"Ask first"}
`,t+=`
`,t+=`## Instructions for AI
`,t+=`1. Follow the established stack above - do not suggest alternatives
`,t+=`2. Continue from "Current Work" if resuming
`,t+=`3. Adjust verbosity based on skill level
`,t+=`4. Use patterns from .claude/ folder
`,t+=`5. Update progress via the CodeBakers extension
`,Q.writeFileSync(this.contextPath,t)}getContextForAI(){return Q.existsSync(this.contextPath)?Q.readFileSync(this.contextPath,"utf-8"):""}getLatestDevlogEntry(){if(!Q.existsSync(this.devlogPath))return null;let t=Q.readFileSync(this.devlogPath,"utf-8").split(`
---
`);return t.length>0?t[0]:null}needsSessionRecovery(){let e=this.loadConfig();if(!e?.currentWork)return!1;let t=new Date(e.currentWork.lastUpdated);return(Date.now()-t.getTime())/(1e3*60*60)>1}getSessionRecoveryMessage(){let e=this.loadConfig();if(!e)return"";let t=`\u{1F4CB} **Session Resumed**
`;return t+=`- **Project:** ${e.projectName}
`,e.currentWork&&(t+=`- **Active Task:** ${e.currentWork.activeFeature}
`,t+=`- **Status:** ${e.currentWork.status}
`,t+=`- **Last Work:** ${e.currentWork.summary}
`),e.build&&(t+=`- **Build:** Phase ${e.build.currentPhase}/${e.build.totalPhases}
`),t}startWorkSession(e,t){this.updateCurrentWork({activeFeature:e,status:"in_progress",summary:t,pendingTasks:[],filesModified:[]})}recordFileModification(e){let t=this.loadConfig();if(!t?.currentWork)return;let a=Ke.relative(this.workspaceRoot,e);t.currentWork.filesModified.includes(a)||(t.currentWork.filesModified.push(a),this.saveConfig(t))}completeWorkSession(e,t){let a=this.loadConfig();a?.currentWork&&(this.addDevlogEntry({title:a.currentWork.activeFeature,taskSize:"medium",status:"completed",whatWasDone:e,filesChanged:a.currentWork.filesModified.map(s=>({path:s,change:"modified"})),nextSteps:t}),a.currentWork=void 0,this.saveConfig(a),this.updateProjectState(),this.updateContextFile())}}});var en,tn,rd=f(()=>{"use strict";en=L(require("vscode")),tn=class{constructor(e,t){this.stateManager=e,this.postMessage=t,this.state=this.getInitialState()}getInitialState(){return{currentStep:"welcome",skillLevel:null,projectType:null,inputMethod:null,discoveryData:{},stackConfirmed:!1}}async initialize(){let{isNew:e,needsOnboarding:t,config:a}=await this.stateManager.initialize();if(!t&&a){this.state.currentStep="complete",this.state.skillLevel=a.userPreferences.skillLevel,this.state.projectType=a.projectType,this.state.inputMethod=a.userPreferences.preferredInputMethod,this.state.stackConfirmed=!0;return}e?this.state.currentStep="welcome":this.state.currentStep="project-type",this.renderCurrentStep()}handleInput(e,t){switch(this.state.currentStep){case"welcome":this.handleWelcomeInput(e);break;case"skill-assessment":this.handleSkillInput(e,t);break;case"project-type":this.handleProjectTypeInput(e);break;case"input-method":this.handleInputMethodInput(e);break;case"new-project-discovery":this.handleDiscoveryInput(e,t);break;case"existing-project-audit":this.handleAuditInput(e,t);break;case"stack-confirmation":this.handleStackInput(e,t);break}}handleWelcomeInput(e){e==="start"&&(this.state.currentStep="skill-assessment",this.renderCurrentStep())}handleSkillInput(e,t){e==="select-skill"&&(this.state.skillLevel=t.level,this.state.currentStep="project-type",this.renderCurrentStep())}handleProjectTypeInput(e){e==="new-project"?(this.state.projectType="new",this.state.currentStep="input-method",this.renderCurrentStep()):e==="existing-project"&&(this.state.projectType="existing",this.state.currentStep="existing-project-audit",this.startExistingProjectAudit())}handleInputMethodInput(e){let t={chat:"chat",form:"form",mockups:"mockups",example:"example"};t[e]&&(this.state.inputMethod=t[e],this.state.currentStep="new-project-discovery",this.renderCurrentStep())}handleDiscoveryInput(e,t){e==="submit-discovery"&&(this.state.discoveryData=t,this.state.currentStep="stack-confirmation",this.renderCurrentStep())}handleAuditInput(e,t){e==="audit-complete"?(this.state.auditResults=t,this.state.currentStep="stack-confirmation",this.renderCurrentStep()):e==="skip-audit"&&(this.state.currentStep="stack-confirmation",this.renderCurrentStep())}handleStackInput(e,t){e==="confirm-stack"?(this.state.stackConfirmed=!0,this.completeOnboarding(t?.stackOverrides)):e==="modify-stack"&&this.renderCurrentStep(!0)}async startExistingProjectAudit(){this.postMessage({type:"onboarding-update",step:"existing-project-audit",loading:!0,message:"Analyzing your project..."});let e=await this.performProjectAudit();this.state.auditResults=e,this.renderCurrentStep()}async performProjectAudit(){let e=en.workspace.workspaceFolders?.[0]?.uri.fsPath;if(!e)return{hasTests:!1,hasAuth:!1,hasPayments:!1,hasDatabase:!1,fileCount:0,issues:["No workspace folder found"]};let t=require("fs"),a=require("path"),s=[],o=0,i=!1,r=!1,d=!1,p=!1,l=["**/*.test.ts","**/*.spec.ts","**/test/**","**/__tests__/**"];for(let m of l)try{if((await en.workspace.findFiles(m,"**/node_modules/**",10)).length>0){i=!0;break}}catch{}let c=a.join(e,"package.json");if(t.existsSync(c))try{let m=JSON.parse(t.readFileSync(c,"utf-8")),u={...m.dependencies,...m.devDependencies};r=["@supabase/supabase-js","next-auth","@clerk/nextjs","firebase","@auth0/nextjs-auth0"].some(h=>u[h]),d=["stripe","@stripe/stripe-js","paypal-rest-sdk","@paypal/checkout-server-sdk"].some(h=>u[h]),p=["drizzle-orm","prisma","@prisma/client","typeorm","mongoose","pg","mysql2"].some(h=>u[h])}catch{}try{o=(await en.workspace.findFiles("**/*.{ts,tsx,js,jsx}","**/node_modules/**",500)).length}catch{}i||s.push("No test files detected - tests are required for production code"),!r&&o>20&&s.push("No authentication system detected - consider adding user auth"),t.existsSync(a.join(e,".env.example"))||s.push("No .env.example file - document environment variables");try{let m=await en.workspace.findFiles("**/*.{ts,tsx}","**/node_modules/**",100);for(let u of m.slice(0,20)){let g=t.readFileSync(u.fsPath,"utf-8");if(!u.fsPath.includes(".test.")&&g.includes("console.log")){s.push(`Console.log found in ${a.basename(u.fsPath)}`);break}if(g.includes("TODO")||g.includes("FIXME")){s.push("TODO/FIXME comments found - review before production");break}if((g.match(/:\s*any\b/g)||[]).length>3){s.push("Multiple 'any' types found - improve type safety");break}}}catch{}return{hasTests:i,hasAuth:r,hasPayments:d,hasDatabase:p,fileCount:o,issues:s.slice(0,5)}}async completeOnboarding(e){let t=this.stateManager.createConfig("CodeBakers Project",this.state.projectType,{skillLevel:this.state.skillLevel,preferredInputMethod:this.state.inputMethod||"chat",autoApply:!0,verboseExplanations:this.state.skillLevel==="beginner"});e&&(t.stack={...t.stack,...e}),this.state.projectType==="new"&&this.state.discoveryData&&(t.discovery={projectDescription:this.state.discoveryData.projectDescription||"",targetUsers:this.state.discoveryData.targetUsers||"",keyFeatures:this.state.discoveryData.keyFeatures||[],needsAuth:this.state.discoveryData.needsAuth||!1,needsPayments:this.state.discoveryData.needsPayments||!1}),this.stateManager.saveConfig(t),this.stateManager.addDevlogEntry({title:"Project Onboarding Complete",taskSize:"small",status:"completed",whatWasDone:[`Skill level: ${this.state.skillLevel}`,`Project type: ${this.state.projectType}`,`Input method: ${this.state.inputMethod}`,`Stack detected: ${t.stack.framework||"generic"}`],filesChanged:[{path:".codebakers.json",change:"created"}],nextSteps:this.state.projectType==="new"?["Begin project build with discovered requirements"]:["Continue development with CodeBakers patterns"]}),this.state.currentStep="complete",this.postMessage({type:"onboarding-complete",config:t,skillLevel:this.state.skillLevel,projectType:this.state.projectType})}renderCurrentStep(e=!1){switch(this.state.currentStep){case"welcome":this.renderWelcome();break;case"skill-assessment":this.renderSkillAssessment();break;case"project-type":this.renderProjectType();break;case"input-method":this.renderInputMethod();break;case"new-project-discovery":this.renderNewProjectDiscovery();break;case"existing-project-audit":this.renderExistingProjectAudit();break;case"stack-confirmation":this.renderStackConfirmation(e);break;case"complete":this.renderComplete();break}}renderWelcome(){this.postMessage({type:"onboarding-update",step:"welcome",html:this.getWelcomeHTML()})}renderSkillAssessment(){this.postMessage({type:"onboarding-update",step:"skill-assessment",html:this.getSkillAssessmentHTML()})}renderProjectType(){this.postMessage({type:"onboarding-update",step:"project-type",html:this.getProjectTypeHTML()})}renderInputMethod(){this.postMessage({type:"onboarding-update",step:"input-method",html:this.getInputMethodHTML()})}renderNewProjectDiscovery(){this.postMessage({type:"onboarding-update",step:"new-project-discovery",inputMethod:this.state.inputMethod,html:this.getDiscoveryHTML()})}renderExistingProjectAudit(){this.postMessage({type:"onboarding-update",step:"existing-project-audit",auditResults:this.state.auditResults,html:this.getAuditHTML()})}renderStackConfirmation(e){let t=this.stateManager.detectStack();this.postMessage({type:"onboarding-update",step:"stack-confirmation",stack:t,modifyMode:e,html:this.getStackConfirmationHTML(t,e)})}renderComplete(){this.postMessage({type:"onboarding-update",step:"complete",html:this.getCompleteHTML()})}getWelcomeHTML(){return`
      <div class="onboarding-step welcome">
        <div class="onboarding-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <h2>Welcome to CodeBakers</h2>
        <p>Production-ready code, first time. Every time.</p>
        <p class="subtitle">Let's set up your project for success. This takes about 2 minutes.</p>
        <button class="primary-btn" onclick="handleOnboarding('start')">
          Get Started
        </button>
      </div>
    `}getSkillAssessmentHTML(){return`
      <div class="onboarding-step skill-assessment">
        <div class="step-indicator">Step 1 of 4</div>
        <h2>What's your experience level?</h2>
        <p>This helps me tailor explanations to your needs.</p>

        <div class="skill-options">
          <button class="skill-btn" onclick="handleOnboarding('select-skill', { level: 'beginner' })">
            <span class="skill-icon">\u{1F331}</span>
            <span class="skill-title">Beginner</span>
            <span class="skill-desc">New to coding? I'll explain concepts in detail as we build.</span>
          </button>

          <button class="skill-btn" onclick="handleOnboarding('select-skill', { level: 'intermediate' })">
            <span class="skill-icon">\u{1F33F}</span>
            <span class="skill-title">Intermediate</span>
            <span class="skill-desc">Know the basics. I'll balance explanation with efficiency.</span>
          </button>

          <button class="skill-btn recommended" onclick="handleOnboarding('select-skill', { level: 'advanced' })">
            <span class="skill-icon">\u{1F333}</span>
            <span class="skill-title">Advanced</span>
            <span class="skill-desc">Experienced dev. I'll be concise and get things done fast.</span>
            <span class="recommended-badge">Most Popular</span>
          </button>
        </div>

        <p style="margin-top: 20px; font-size: 0.8rem; opacity: 0.7;">
          \u2728 Changes auto-apply by default. You can always undo!
        </p>
      </div>
    `}getProjectTypeHTML(){return`
      <div class="onboarding-step project-type">
        <div class="step-indicator">Step 2 of 4</div>
        <h2>What are we working on?</h2>

        <div class="project-options">
          <button class="project-btn" onclick="handleOnboarding('new-project')">
            <span class="project-icon">\u2728</span>
            <span class="project-title">New Project</span>
            <span class="project-desc">Start from scratch. I'll help you plan and build with best practices.</span>
          </button>

          <button class="project-btn" onclick="handleOnboarding('existing-project')">
            <span class="project-icon">\u{1F527}</span>
            <span class="project-title">Existing Project</span>
            <span class="project-desc">Add features or improve code. I'll analyze your project first.</span>
          </button>
        </div>
      </div>
    `}getInputMethodHTML(){return`
      <div class="onboarding-step input-method">
        <div class="step-indicator">Step 3 of 4</div>
        <h2>How would you like to describe your project?</h2>
        <p>Choose the method that works best for you.</p>

        <div class="method-options">
          <button class="method-btn" onclick="handleOnboarding('chat')">
            <span class="method-icon">\u{1F4AC}</span>
            <span class="method-title">Chat</span>
            <span class="method-desc">Describe it conversationally. I'll ask follow-up questions.</span>
          </button>

          <button class="method-btn recommended" onclick="handleOnboarding('form')">
            <span class="method-icon">\u{1F4DD}</span>
            <span class="method-title">Form</span>
            <span class="method-desc">Fill out a structured form with guided questions.</span>
            <span class="recommended-badge">Recommended</span>
          </button>

          <button class="method-btn" onclick="handleOnboarding('mockups')">
            <span class="method-icon">\u{1F3A8}</span>
            <span class="method-title">Mockups</span>
            <span class="method-desc">Upload designs or screenshots. I'll analyze and implement.</span>
          </button>

          <button class="method-btn" onclick="handleOnboarding('example')">
            <span class="method-icon">\u{1F517}</span>
            <span class="method-title">"Like X"</span>
            <span class="method-desc">Reference an existing app. "Build me something like Linear."</span>
          </button>
        </div>
      </div>
    `}getDiscoveryHTML(){let e=this.state.inputMethod;return e==="form"?this.getFormDiscoveryHTML():e==="mockups"?this.getMockupsDiscoveryHTML():e==="example"?this.getExampleDiscoveryHTML():this.getChatDiscoveryHTML()}getFormDiscoveryHTML(){return`
      <div class="onboarding-step discovery-form">
        <div class="step-indicator">Step 3 of 4</div>
        <h2>Tell me about your project</h2>

        <form id="discovery-form" class="discovery-form-fields">
          <div class="form-group">
            <label for="description">What does this app do?</label>
            <textarea id="description" placeholder="A project management tool that helps teams track tasks..." rows="3"></textarea>
          </div>

          <div class="form-group">
            <label for="users">Who will use it?</label>
            <input type="text" id="users" placeholder="Small business teams, freelancers, agencies...">
          </div>

          <div class="form-group">
            <label>Key Features (select all that apply)</label>
            <div class="checkbox-group">
              <label class="checkbox"><input type="checkbox" name="features" value="user-accounts"> User accounts & profiles</label>
              <label class="checkbox"><input type="checkbox" name="features" value="dashboard"> Dashboard / Analytics</label>
              <label class="checkbox"><input type="checkbox" name="features" value="crud"> Create, edit, delete items</label>
              <label class="checkbox"><input type="checkbox" name="features" value="search"> Search & filtering</label>
              <label class="checkbox"><input type="checkbox" name="features" value="notifications"> Notifications</label>
              <label class="checkbox"><input type="checkbox" name="features" value="file-uploads"> File uploads</label>
            </div>
          </div>

          <div class="form-group">
            <label>Additional Requirements</label>
            <div class="checkbox-group">
              <label class="checkbox"><input type="checkbox" name="needs" value="auth"> User authentication required</label>
              <label class="checkbox"><input type="checkbox" name="needs" value="payments"> Payment processing needed</label>
              <label class="checkbox"><input type="checkbox" name="needs" value="realtime"> Real-time updates needed</label>
            </div>
          </div>

          <button type="button" class="primary-btn" onclick="submitDiscoveryForm()">
            Continue
          </button>
        </form>
      </div>
    `}getMockupsDiscoveryHTML(){return`
      <div class="onboarding-step discovery-mockups">
        <div class="step-indicator">Step 3 of 4</div>
        <h2>Upload your designs</h2>
        <p>Drop mockups, screenshots, or design files. I'll analyze them and create matching code.</p>

        <div class="upload-area" id="upload-dropzone">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p>Drag and drop files here</p>
          <p class="upload-hint">PNG, JPG, PDF, or Figma exports</p>
          <input type="file" id="mockup-upload" multiple accept="image/*,.pdf" style="display:none">
          <button class="secondary-btn" onclick="document.getElementById('mockup-upload').click()">
            Browse Files
          </button>
        </div>

        <div id="uploaded-files" class="uploaded-files"></div>

        <div class="form-group">
          <label for="mockup-notes">Additional notes (optional)</label>
          <textarea id="mockup-notes" placeholder="Any context about the designs..." rows="2"></textarea>
        </div>

        <button class="primary-btn" onclick="submitMockups()" disabled id="mockup-submit">
          Analyze Designs
        </button>
      </div>
    `}getExampleDiscoveryHTML(){return`
      <div class="onboarding-step discovery-example">
        <div class="step-indicator">Step 3 of 4</div>
        <h2>What app inspires you?</h2>
        <p>Reference an existing product and I'll help you build something similar.</p>

        <div class="popular-examples">
          <h4>Popular references:</h4>
          <div class="example-chips">
            <button class="chip" onclick="selectExample('Linear')">Linear</button>
            <button class="chip" onclick="selectExample('Notion')">Notion</button>
            <button class="chip" onclick="selectExample('Stripe Dashboard')">Stripe</button>
            <button class="chip" onclick="selectExample('Vercel')">Vercel</button>
            <button class="chip" onclick="selectExample('Slack')">Slack</button>
            <button class="chip" onclick="selectExample('Figma')">Figma</button>
          </div>
        </div>

        <div class="form-group">
          <label for="example-app">Or enter a specific app:</label>
          <input type="text" id="example-app" placeholder="Like Asana but for...">
        </div>

        <div class="form-group">
          <label for="example-diff">What would you change or add?</label>
          <textarea id="example-diff" placeholder="I want it to be simpler, focused on..." rows="3"></textarea>
        </div>

        <button class="primary-btn" onclick="submitExample()">
          Continue
        </button>
      </div>
    `}getChatDiscoveryHTML(){return`
      <div class="onboarding-step discovery-chat">
        <div class="step-indicator">Step 3 of 4</div>
        <h2>Tell me about your idea</h2>
        <p>Describe what you want to build in your own words. I'll ask follow-up questions.</p>

        <div class="chat-prompt-area">
          <textarea id="chat-description" placeholder="I want to build a..." rows="5"></textarea>
          <div class="chat-hints">
            <span>Hint: Include who will use it, what problem it solves, and key features.</span>
          </div>
        </div>

        <button class="primary-btn" onclick="submitChatDescription()">
          Continue
        </button>
      </div>
    `}getAuditHTML(){let e=this.state.auditResults;if(!e)return`
        <div class="onboarding-step audit-loading">
          <div class="loading-spinner"></div>
          <h2>Analyzing your project...</h2>
          <p>Checking tests, dependencies, patterns, and more.</p>
        </div>
      `;let t=s=>s?"\u2705":"\u274C",a=e.issues.map(s=>`<li>${s}</li>`).join("");return`
      <div class="onboarding-step audit-results">
        <div class="step-indicator">Step 3 of 4</div>
        <h2>Project Analysis</h2>

        <div class="audit-summary">
          <div class="audit-stat">
            <span class="stat-value">${e.fileCount}</span>
            <span class="stat-label">Source files</span>
          </div>
        </div>

        <div class="audit-checks">
          <div class="check-item">${t(e.hasTests)} Test files</div>
          <div class="check-item">${t(e.hasAuth)} Authentication</div>
          <div class="check-item">${t(e.hasPayments)} Payments</div>
          <div class="check-item">${t(e.hasDatabase)} Database</div>
        </div>

        ${e.issues.length>0?`
          <div class="audit-issues">
            <h4>Issues Found:</h4>
            <ul>${a}</ul>
          </div>
        `:'<p class="audit-clean">No critical issues found!</p>'}

        <div class="audit-actions">
          <button class="primary-btn" onclick="handleOnboarding('audit-complete', ${JSON.stringify(e).replace(/"/g,"&quot;")})">
            Continue
          </button>
          <button class="secondary-btn" onclick="handleOnboarding('skip-audit')">
            Skip Audit
          </button>
        </div>
      </div>
    `}getStackConfirmationHTML(e,t){return t?this.getStackModifyHTML(e):`
      <div class="onboarding-step stack-confirmation">
        <div class="step-indicator">Step 4 of 4</div>
        <h2>Confirm Your Stack</h2>
        <p>I detected the following technologies. I'll use matching CodeBakers patterns.</p>

        <div class="stack-grid">
          <div class="stack-item">
            <span class="stack-label">Framework</span>
            <span class="stack-value">${e.framework||"Next.js (default)"}</span>
          </div>
          <div class="stack-item">
            <span class="stack-label">Database</span>
            <span class="stack-value">${e.database||"Drizzle + PostgreSQL (default)"}</span>
          </div>
          <div class="stack-item">
            <span class="stack-label">Auth</span>
            <span class="stack-value">${e.auth||"Supabase Auth (default)"}</span>
          </div>
          <div class="stack-item">
            <span class="stack-label">UI</span>
            <span class="stack-value">${e.ui||"shadcn/ui (default)"}</span>
          </div>
          ${e.payments?.length?`
            <div class="stack-item">
              <span class="stack-label">Payments</span>
              <span class="stack-value">${e.payments.join(", ")}</span>
            </div>
          `:""}
        </div>

        <div class="stack-actions">
          <button class="primary-btn" onclick="handleOnboarding('confirm-stack')">
            Looks Good!
          </button>
          <button class="secondary-btn" onclick="handleOnboarding('modify-stack')">
            Modify Stack
          </button>
        </div>
      </div>
    `}getStackModifyHTML(e){return`
      <div class="onboarding-step stack-modify">
        <div class="step-indicator">Step 4 of 4</div>
        <h2>Customize Your Stack</h2>

        <form id="stack-form" class="stack-form">
          <div class="form-group">
            <label for="framework">Framework</label>
            <select id="framework">
              <option value="nextjs" ${e.framework==="nextjs"?"selected":""}>Next.js</option>
              <option value="remix" ${e.framework==="remix"?"selected":""}>Remix</option>
              <option value="vite" ${e.framework==="vite"?"selected":""}>Vite + React</option>
            </select>
          </div>

          <div class="form-group">
            <label for="database">Database</label>
            <select id="database">
              <option value="drizzle" ${e.database==="drizzle"?"selected":""}>Drizzle (Recommended)</option>
              <option value="prisma" ${e.database==="prisma"?"selected":""}>Prisma</option>
              <option value="supabase" ${e.database==="supabase"?"selected":""}>Supabase</option>
              <option value="mongoose" ${e.database==="mongoose"?"selected":""}>Mongoose</option>
            </select>
          </div>

          <div class="form-group">
            <label for="auth">Authentication</label>
            <select id="auth">
              <option value="supabase" ${e.auth==="supabase"?"selected":""}>Supabase Auth (Recommended)</option>
              <option value="next-auth" ${e.auth==="next-auth"?"selected":""}>NextAuth</option>
              <option value="clerk" ${e.auth==="clerk"?"selected":""}>Clerk</option>
              <option value="auth0" ${e.auth==="auth0"?"selected":""}>Auth0</option>
            </select>
          </div>

          <div class="form-group">
            <label for="ui">UI Library</label>
            <select id="ui">
              <option value="shadcn" ${e.ui==="shadcn"?"selected":""}>shadcn/ui (Recommended)</option>
              <option value="chakra" ${e.ui==="chakra"?"selected":""}>Chakra UI</option>
              <option value="mui" ${e.ui==="mui"?"selected":""}>Material UI</option>
              <option value="tailwind" ${e.ui==="tailwind"?"selected":""}>Tailwind Only</option>
            </select>
          </div>

          <button type="button" class="primary-btn" onclick="submitStackModification()">
            Confirm Stack
          </button>
        </form>
      </div>
    `}getCompleteHTML(){return`
      <div class="onboarding-step complete">
        <div class="success-icon">\u{1F389}</div>
        <h2>You're All Set!</h2>
        <p>CodeBakers is ready to build with you.</p>

        <div class="setup-summary">
          <div class="summary-item">
            <span class="summary-icon">${{beginner:"\u{1F331}",intermediate:"\u{1F33F}",advanced:"\u{1F333}"}[this.state.skillLevel]||"\u{1F33F}"}</span>
            <span>${this.state.skillLevel} mode</span>
          </div>
          <div class="summary-item">
            <span class="summary-icon">${this.state.projectType==="new"?"\u2728":"\u{1F527}"}</span>
            <span>${this.state.projectType==="new"?"New project":"Existing project"}</span>
          </div>
        </div>

        <div style="margin: 20px 0; padding: 12px 16px; background: rgba(220, 38, 38, 0.1); border-radius: 8px; text-align: left;">
          <p style="margin: 0 0 8px; font-weight: 600; color: #dc2626;">Quick tips:</p>
          <p style="margin: 0 0 4px; font-size: 0.875rem;">\u2728 Changes apply automatically - no approve buttons!</p>
          <p style="margin: 0 0 4px; font-size: 0.875rem;">\u21A9\uFE0F Made a mistake? Just say "undo that"</p>
          <p style="margin: 0; font-size: 0.875rem;">\u{1F4C1} Pin files to always include them in context</p>
        </div>

        <p class="next-step">Just tell me what you want to build!</p>
      </div>
    `}static getStyles(){return`
      .onboarding-step {
        padding: 24px;
        text-align: center;
      }

      .onboarding-step h2 {
        margin: 16px 0 8px;
        font-size: 1.5rem;
        color: var(--vscode-foreground);
      }

      .onboarding-step p {
        color: var(--vscode-descriptionForeground);
        margin-bottom: 16px;
      }

      .onboarding-step .subtitle {
        font-size: 0.875rem;
        margin-bottom: 24px;
      }

      .step-indicator {
        font-size: 0.75rem;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 8px;
      }

      .onboarding-icon {
        color: var(--brand-primary, #dc2626);
        margin-bottom: 8px;
      }

      /* Buttons */
      .primary-btn {
        background: var(--brand-primary, #dc2626);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 1rem;
        cursor: pointer;
        transition: background 0.2s;
      }

      .primary-btn:hover {
        background: var(--brand-primary-dark, #b91c1c);
      }

      .primary-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .secondary-btn {
        background: transparent;
        color: var(--vscode-foreground);
        border: 1px solid var(--vscode-input-border);
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        margin-left: 8px;
      }

      /* Skill options */
      .skill-options, .project-options, .method-options {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 20px;
      }

      .skill-btn, .project-btn, .method-btn {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 16px;
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        border-radius: 8px;
        cursor: pointer;
        text-align: left;
        transition: border-color 0.2s;
        position: relative;
      }

      .skill-btn:hover, .project-btn:hover, .method-btn:hover {
        border-color: var(--brand-primary, #dc2626);
      }

      .skill-btn.recommended, .method-btn.recommended {
        border-color: var(--brand-primary, #dc2626);
      }

      .skill-icon, .project-icon, .method-icon {
        font-size: 1.5rem;
        margin-bottom: 8px;
      }

      .skill-title, .project-title, .method-title {
        font-weight: 600;
        color: var(--vscode-foreground);
        margin-bottom: 4px;
      }

      .skill-desc, .project-desc, .method-desc {
        font-size: 0.875rem;
        color: var(--vscode-descriptionForeground);
      }

      .recommended-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        font-size: 0.75rem;
        background: var(--brand-primary, #dc2626);
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
      }

      /* Form styles */
      .form-group {
        margin-bottom: 16px;
        text-align: left;
      }

      .form-group label {
        display: block;
        margin-bottom: 6px;
        font-weight: 500;
        color: var(--vscode-foreground);
      }

      .form-group input,
      .form-group textarea,
      .form-group select {
        width: 100%;
        padding: 10px;
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        border-radius: 6px;
        color: var(--vscode-foreground);
        font-size: 0.875rem;
      }

      .form-group textarea {
        resize: vertical;
        min-height: 80px;
      }

      .checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .checkbox {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: normal;
        cursor: pointer;
      }

      .checkbox input {
        width: auto;
      }

      /* Upload area */
      .upload-area {
        border: 2px dashed var(--vscode-input-border);
        border-radius: 12px;
        padding: 40px;
        margin: 20px 0;
        transition: border-color 0.2s;
      }

      .upload-area:hover {
        border-color: var(--brand-primary, #dc2626);
      }

      .upload-hint {
        font-size: 0.75rem;
        color: var(--vscode-descriptionForeground);
      }

      /* Example chips */
      .example-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 12px 0;
      }

      .chip {
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        border-radius: 16px;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 0.875rem;
      }

      .chip:hover, .chip.selected {
        background: var(--brand-primary, #dc2626);
        color: white;
        border-color: var(--brand-primary, #dc2626);
      }

      /* Audit results */
      .audit-summary {
        display: flex;
        justify-content: center;
        gap: 24px;
        margin: 20px 0;
      }

      .audit-stat {
        text-align: center;
      }

      .stat-value {
        display: block;
        font-size: 2rem;
        font-weight: bold;
        color: var(--brand-primary, #dc2626);
      }

      .stat-label {
        font-size: 0.75rem;
        color: var(--vscode-descriptionForeground);
      }

      .audit-checks {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin: 20px 0;
        text-align: left;
      }

      .check-item {
        padding: 8px 12px;
        background: var(--vscode-input-background);
        border-radius: 6px;
      }

      .audit-issues {
        text-align: left;
        background: var(--vscode-inputValidation-warningBackground);
        border: 1px solid var(--vscode-inputValidation-warningBorder);
        border-radius: 8px;
        padding: 12px;
        margin: 16px 0;
      }

      .audit-issues h4 {
        margin: 0 0 8px;
        color: var(--vscode-inputValidation-warningForeground);
      }

      .audit-issues ul {
        margin: 0;
        padding-left: 20px;
      }

      .audit-clean {
        color: var(--vscode-testing-iconPassed);
      }

      .audit-actions {
        display: flex;
        justify-content: center;
        gap: 12px;
        margin-top: 20px;
      }

      /* Stack confirmation */
      .stack-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin: 20px 0;
        text-align: left;
      }

      .stack-item {
        padding: 12px;
        background: var(--vscode-input-background);
        border-radius: 8px;
      }

      .stack-label {
        display: block;
        font-size: 0.75rem;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 4px;
      }

      .stack-value {
        font-weight: 500;
        color: var(--vscode-foreground);
      }

      .stack-actions {
        display: flex;
        justify-content: center;
        gap: 12px;
        margin-top: 24px;
      }

      /* Complete */
      .success-icon {
        font-size: 3rem;
        margin-bottom: 16px;
      }

      .setup-summary {
        display: flex;
        justify-content: center;
        gap: 24px;
        margin: 24px 0;
      }

      .summary-item {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .summary-icon {
        font-size: 1.25rem;
      }

      .next-step {
        font-weight: 500;
        color: var(--vscode-foreground);
      }

      /* Loading */
      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--vscode-input-border);
        border-top-color: var(--brand-primary, #dc2626);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}static getScript(){return`
      function handleOnboarding(action, data) {
        vscode.postMessage({
          type: 'onboarding-action',
          action: action,
          data: data || {}
        });
      }

      function submitDiscoveryForm() {
        const form = document.getElementById('discovery-form');
        const features = Array.from(form.querySelectorAll('input[name="features"]:checked'))
          .map(cb => cb.value);
        const needs = Array.from(form.querySelectorAll('input[name="needs"]:checked'))
          .map(cb => cb.value);

        handleOnboarding('submit-discovery', {
          projectDescription: document.getElementById('description').value,
          targetUsers: document.getElementById('users').value,
          keyFeatures: features,
          needsAuth: needs.includes('auth'),
          needsPayments: needs.includes('payments'),
          needsRealtime: needs.includes('realtime')
        });
      }

      function submitChatDescription() {
        const description = document.getElementById('chat-description').value;
        if (description.trim()) {
          handleOnboarding('submit-discovery', {
            projectDescription: description,
            inputMethod: 'chat'
          });
        }
      }

      function selectExample(name) {
        document.getElementById('example-app').value = name;
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
        event.target.classList.add('selected');
      }

      function submitExample() {
        const app = document.getElementById('example-app').value;
        const diff = document.getElementById('example-diff').value;
        if (app.trim()) {
          handleOnboarding('submit-discovery', {
            exampleApp: app,
            projectDescription: diff || 'Similar to ' + app
          });
        }
      }

      function submitMockups() {
        const notes = document.getElementById('mockup-notes').value;
        handleOnboarding('submit-discovery', {
          designReference: 'uploaded-mockups',
          projectDescription: notes
        });
      }

      function submitStackModification() {
        handleOnboarding('confirm-stack', {
          stackOverrides: {
            framework: document.getElementById('framework').value,
            database: document.getElementById('database').value,
            auth: document.getElementById('auth').value,
            ui: document.getElementById('ui').value
          }
        });
      }

      // File upload handling
      const dropzone = document.getElementById('upload-dropzone');
      const uploadInput = document.getElementById('mockup-upload');
      const uploadedFilesDiv = document.getElementById('uploaded-files');
      const uploadedFiles = [];

      if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropzone.style.borderColor = 'var(--brand-primary)';
        });

        dropzone.addEventListener('dragleave', () => {
          dropzone.style.borderColor = 'var(--vscode-input-border)';
        });

        dropzone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropzone.style.borderColor = 'var(--vscode-input-border)';
          handleFiles(e.dataTransfer.files);
        });
      }

      if (uploadInput) {
        uploadInput.addEventListener('change', (e) => {
          handleFiles(e.target.files);
        });
      }

      function handleFiles(files) {
        for (const file of files) {
          uploadedFiles.push(file.name);
        }
        updateUploadedList();
      }

      function updateUploadedList() {
        if (uploadedFilesDiv && uploadedFiles.length > 0) {
          uploadedFilesDiv.innerHTML = uploadedFiles.map(f =>
            '<div class="uploaded-file">' + f + '</div>'
          ).join('');
          document.getElementById('mockup-submit').disabled = false;
        }
      }
    `}isOnboardingRequired(){return this.state.currentStep!=="complete"}getState(){return{...this.state}}reset(){this.state=this.getInitialState()}}});var dd,pt,Wo,cs,pd=f(()=>{"use strict";dd=L(require("vscode")),pt=L(require("fs")),Wo=L(require("path")),cs=class{constructor(e){this.messageCount=0;this.lastSnapshot=null;this.recentActions=[];this.COMPACTION_MESSAGE_THRESHOLD=50;this.ACTION_HISTORY_SIZE=20;this.CONTEXT_UPDATE_INTERVAL=5;this.stateManager=e,this.workspaceRoot=dd.workspace.workspaceFolders?.[0]?.uri.fsPath||"",this.codebakersDir=Wo.join(this.workspaceRoot,".codebakers"),this.contextFile=Wo.join(this.codebakersDir,"CONTEXT.md")}async initialize(){pt.existsSync(this.codebakersDir)||pt.mkdirSync(this.codebakersDir,{recursive:!0}),this.loadSnapshot()}recordMessage(e,t){this.messageCount++,this.messageCount%this.CONTEXT_UPDATE_INTERVAL===0&&this.updateContextFile(),this.messageCount>this.COMPACTION_MESSAGE_THRESHOLD&&this.prepareForCompaction()}recordAction(e){this.recentActions.unshift(e),this.recentActions.length>this.ACTION_HISTORY_SIZE&&(this.recentActions=this.recentActions.slice(0,this.ACTION_HISTORY_SIZE)),this.updateContextFile()}recordActiveTask(e){this.lastSnapshot&&(this.lastSnapshot.activeTask=e),this.updateContextFile()}recordUserRequest(e){this.lastSnapshot&&(this.lastSnapshot.lastUserRequest=e)}addImportantContext(e){this.lastSnapshot||this.createSnapshot(),this.lastSnapshot&&!this.lastSnapshot.importantContext.includes(e)&&(this.lastSnapshot.importantContext.push(e),this.lastSnapshot.importantContext.length>10&&(this.lastSnapshot.importantContext=this.lastSnapshot.importantContext.slice(-10))),this.updateContextFile()}checkRecovery(e){let t=["context was compacted","conversation summary","previous conversation","continuing from","session was summarized"],a=e.toLowerCase(),s=t.some(d=>a.includes(d)),o=this.loadSnapshot(),i=o!==null,r=this.messageCount<3;return(s||i&&r)&&o?{needsRecovery:!0,reason:s?"Context compaction detected":"New session with existing project state",snapshot:o,recoveryMessage:this.generateRecoveryMessage(o)}:{needsRecovery:!1,reason:null,snapshot:null,recoveryMessage:null}}getContextForInjection(){let e=this.stateManager.loadConfig();if(!e)return"";let t=this.lastSnapshot||this.createSnapshot(),a=`
## Current Project Context

**Project:** ${e.projectName}
**Type:** ${e.projectType}
**Skill Level:** ${e.userPreferences.skillLevel}
**Stack:** ${e.stack.framework||"Next.js"} + ${e.stack.database||"Drizzle"} + ${e.stack.auth||"Supabase"}

`;return e.currentWork?.activeFeature&&(a+=`
### Active Work
**Feature:** ${e.currentWork.activeFeature}
**Status:** ${e.currentWork.status}
**Summary:** ${e.currentWork.summary}

`),t.recentActions.length>0&&(a+=`
### Recent Actions
${t.recentActions.slice(0,5).map(s=>`- ${s}`).join(`
`)}

`),t.pendingTasks.length>0&&(a+=`
### Pending Tasks
${t.pendingTasks.map(s=>`- ${s}`).join(`
`)}

`),t.importantContext.length>0&&(a+=`
### Important Context
${t.importantContext.map(s=>`- ${s}`).join(`
`)}

`),a}prepareForCompaction(){console.log("ContextPreserver: Preparing for potential compaction"),this.createSnapshot(),this.updateContextFile(),this.stateManager.updateProjectState()}createSnapshot(){let e=this.stateManager.loadConfig();return this.lastSnapshot={timestamp:new Date().toISOString(),messageCount:this.messageCount,activeTask:e?.currentWork?.activeFeature||null,recentActions:[...this.recentActions],pendingTasks:e?.currentWork?.pendingTasks||[],importantContext:this.lastSnapshot?.importantContext||[],lastUserRequest:this.lastSnapshot?.lastUserRequest||null},this.lastSnapshot}loadSnapshot(){try{if(!pt.existsSync(this.contextFile))return null;let e=pt.readFileSync(this.contextFile,"utf-8"),t={timestamp:"",messageCount:0,activeTask:null,recentActions:[],pendingTasks:[],importantContext:[],lastUserRequest:null},a=e.match(/Last Updated:\s*(.+)/);a&&(t.timestamp=a[1]);let s=e.match(/Active Task:\s*(.+)/);s&&s[1]!=="None"&&(t.activeTask=s[1]);let o=e.match(/## Recent Actions\n([\s\S]*?)(?=\n## |$)/);o&&(t.recentActions=o[1].split(`
`).filter(p=>p.startsWith("- ")).map(p=>p.replace(/^- /,"")));let i=e.match(/## Pending Tasks\n([\s\S]*?)(?=\n## |$)/);i&&(t.pendingTasks=i[1].split(`
`).filter(p=>p.startsWith("- ")).map(p=>p.replace(/^- /,"")));let r=e.match(/## Important Context\n([\s\S]*?)(?=\n## |$)/);r&&(t.importantContext=r[1].split(`
`).filter(p=>p.startsWith("- ")).map(p=>p.replace(/^- /,"")));let d=e.match(/Last User Request:\s*"(.+)"/);return d&&(t.lastUserRequest=d[1]),this.lastSnapshot=t,t}catch(e){return console.error("Failed to load context snapshot:",e),null}}updateContextFile(){let e=this.lastSnapshot||this.createSnapshot(),t=this.stateManager.loadConfig(),a=`# CodeBakers Context File

**DO NOT DELETE** - This file helps the AI recover context after long sessions.

---

## Session Info

**Last Updated:** ${e.timestamp}
**Message Count:** ${e.messageCount}
**Active Task:** ${e.activeTask||"None"}
${e.lastUserRequest?`**Last User Request:** "${e.lastUserRequest}"`:""}

## Project Info

**Name:** ${t?.projectName||"Unknown"}
**Type:** ${t?.projectType||"unknown"}
**Skill Level:** ${t?.userPreferences?.skillLevel||"intermediate"}

## Stack

- Framework: ${t?.stack?.framework||"Not detected"}
- Database: ${t?.stack?.database||"Not detected"}
- Auth: ${t?.stack?.auth||"Not detected"}
- UI: ${t?.stack?.ui||"Not detected"}

## Recent Actions

${e.recentActions.length>0?e.recentActions.map(s=>`- ${s}`).join(`
`):"- No recent actions"}

## Pending Tasks

${e.pendingTasks.length>0?e.pendingTasks.map(s=>`- ${s}`).join(`
`):"- No pending tasks"}

## Important Context

${e.importantContext.length>0?e.importantContext.map(s=>`- ${s}`).join(`
`):"- No special context"}

## Current Work

${t?.currentWork?`
**Feature:** ${t.currentWork.activeFeature}
**Status:** ${t.currentWork.status}
**Summary:** ${t.currentWork.summary}

### Files Modified:
${t.currentWork.filesModified?.map(s=>`- ${s}`).join(`
`)||"- None"}

### Pending Sub-tasks:
${t.currentWork.pendingTasks?.map(s=>`- ${s}`).join(`
`)||"- None"}
`:"No active work session"}

---

## Recovery Instructions

If starting a new session, read:
1. This file (CONTEXT.md) - Current state
2. PROJECT-STATE.md - Work in progress
3. DEVLOG.md - Recent history
4. .codebakers.json - Project config

Then continue where you left off.
`;try{pt.writeFileSync(this.contextFile,a)}catch(s){console.error("Failed to update context file:",s)}}generateRecoveryMessage(e){let t=`
## Session Recovery

Your context was compacted. Here's what you need to know:

`;return e.activeTask&&(t+=`**You were working on:** ${e.activeTask}

`),e.lastUserRequest&&(t+=`**Last user request:** "${e.lastUserRequest}"

`),e.recentActions.length>0&&(t+=`**Recent actions:**
`,e.recentActions.slice(0,5).forEach(a=>{t+=`- ${a}
`}),t+=`
`),e.pendingTasks.length>0&&(t+=`**Pending tasks:**
`,e.pendingTasks.forEach(a=>{t+=`- ${a}
`}),t+=`
`),e.importantContext.length>0&&(t+=`**Important context:**
`,e.importantContext.forEach(a=>{t+=`- ${a}
`}),t+=`
`),t+=`
Read the full context from:
- .codebakers/CONTEXT.md
- .codebakers/PROJECT-STATE.md
- .codebakers/DEVLOG.md

Continue with the user's current request while maintaining context.
`,t}forceSave(){this.createSnapshot(),this.updateContextFile(),this.stateManager.updateProjectState()}resetMessageCount(){this.messageCount=0}getMessageCount(){return this.messageCount}isContextLong(){return this.messageCount>this.COMPACTION_MESSAGE_THRESHOLD*.8}getLongContextWarning(){return this.isContextLong()?`Note: This conversation is getting long (${this.messageCount} messages). Context is being saved to .codebakers/ files to preserve state if the session is compacted.`:null}}});var ld={};At(ld,{ChatPanelProvider:()=>Ho});var b,Ho,cd=f(()=>{"use strict";b=L(require("vscode"));Uo();qo();id();rd();pd();Ho=class n{constructor(e,t,a){this.context=e;this.client=t;this.projectContext=a;this._messages=[];this._conversationSummary="";this._abortController=null;this._stateManager=null;this._onboardingWizard=null;this._contextPreserver=null;this._onboardingCompleted=!1;this._pendingChanges=[];this._pendingCommands=[];this._pinnedFiles=[];this._streamBuffer="";this._thinkingBuffer="";this._streamThrottleTimer=null;this._lastStreamUpdate=0;this.STREAM_THROTTLE_MS=50;this.fileOps=new Qa,this._initializeOnboardingSystem()}async _initializeOnboardingSystem(){let e=b.workspace.workspaceFolders?.[0]?.uri.fsPath;if(!e){console.log("No workspace folder found - skipping onboarding system");return}this._stateManager=new ls(e),this._contextPreserver=new cs(this._stateManager),await this._contextPreserver.initialize();let{needsOnboarding:t,config:a}=await this._stateManager.initialize();this._onboardingCompleted=!t,a&&this._contextPreserver.checkRecovery("").needsRecovery&&console.log("Session recovery needed - context was compacted")}static getInstance(e,t,a){return n._instance||(n._instance=new n(e,t,a)),n._instance}show(){if(this._panel){this._panel.reveal(b.ViewColumn.Beside);return}this._panel=b.window.createWebviewPanel("codebakers.chat","CodeBakers",{viewColumn:b.ViewColumn.Beside,preserveFocus:!0},{enableScripts:!0,retainContextWhenHidden:!0,localResourceRoots:[this.context.extensionUri]}),this._panel.iconPath=b.Uri.joinPath(this.context.extensionUri,"media","icon.svg"),this._panel.webview.html=this._getHtmlForWebview(this._panel.webview),this._panel.webview.onDidReceiveMessage(async e=>{switch(e.type){case"sendMessage":await this.sendMessage(e.message);break;case"clearChat":this._messages=[],this._conversationSummary="",this._pendingChanges=[],this._pendingCommands=[],this._updateWebview();break;case"runTool":await this._executeTool(e.tool);break;case"login":await this.client.login();break;case"applyFile":await this._applyFileOperation(e.id);break;case"applyAllFiles":await this._applyAllPendingChanges();break;case"rejectFile":this._rejectFileOperation(e.id);break;case"rejectAllFiles":this._rejectAllPendingChanges();break;case"runCommand":await this._runCommand(e.id);break;case"showDiff":await this._showDiff(e.id);break;case"undoFile":await this._undoFileOperation(e.id);break;case"undoAppliedFiles":await this._undoAppliedFiles(e.files);break;case"cancelRequest":this._cancelCurrentRequest();break;case"addPinnedFile":await this._addPinnedFile();break;case"removePinnedFile":this._removePinnedFile(e.path);break;case"clearPinnedFiles":this._pinnedFiles=[],this._updatePinnedFiles();break;case"resetSessionStats":this.client.resetSessionStats();break;case"logProjectTime":this._logProjectTime(e);break;case"deploy":this._deployToVercel();break;case"gitPush":this._pushToGitHub();break;case"openMindMap":b.commands.executeCommand("codebakers.openMindMap");break;case"openPreview":this._openPreviewInBrowser(e.port||3e3);break;case"loadTeamNotes":this._loadTeamNotes();break;case"saveTeamNotes":this._saveTeamNotes(e.notes);break;case"analyzeImpact":this._analyzeImpact(e.message);break;case"installPackages":this._installPackages(e.packages);break;case"onboarding-action":this._handleOnboardingAction(e.action,e.data);break;case"checkOnboarding":this._checkAndShowOnboarding();break}}),this._panel.onDidDispose(()=>{this._panel=void 0}),this._initializeStatus()}refresh(){this._panel&&(this._initializeStatus(),this._updateWebview())}setInputWithContext(e){this._panel||this.show(),setTimeout(()=>{this._panel?.webview.postMessage({type:"setInputValue",value:e})},100)}async _initializeStatus(){if(this._panel)try{let e=this.client.getPlanInfo();if(this._panel.webview.postMessage({type:"updatePlan",plan:e.plan}),!this.client.hasSessionToken()){this._panel.webview.postMessage({type:"updateHealth",health:0,score:0}),this._panel.webview.postMessage({type:"showLogin"});return}try{let t=await this.client.guardianStatus();this._panel.webview.postMessage({type:"updateHealth",health:t.data?.health||85,score:t.data?.health||85})}catch(t){console.warn("Health check failed:",t),this._panel.webview.postMessage({type:"updateHealth",health:85,score:85})}await this._checkAndShowOnboarding()}catch(e){console.error("Failed to initialize status:",e)}}async _executeTool(e){if(this._panel)try{this._panel.webview.postMessage({type:"typing",isTyping:!0});let t=await this.client.executeTool(e,{});this._messages.push({role:"assistant",content:`**Tool: ${e}**
\`\`\`json
${JSON.stringify(t.data||t,null,2)}
\`\`\``,timestamp:new Date}),e==="guardian_status"&&t.data?.health&&this._panel.webview.postMessage({type:"updateHealth",health:t.data.health,score:t.data.health})}catch(t){this._messages.push({role:"assistant",content:`**Tool Error: ${e}**
${t instanceof Error?t.message:"Tool execution failed"}`,timestamp:new Date})}finally{this._panel?.webview.postMessage({type:"typing",isTyping:!1}),this._updateWebview()}}async _applyFileOperation(e){if(!this._panel)return;let t=this._pendingChanges.find(a=>a.id===e);if(!(!t||t.status!=="pending"))try{if(await this.fileOps.applyChange({path:t.operation.path,action:t.operation.action,content:t.operation.content,description:t.operation.description}))t.status="applied",b.window.showInformationMessage(`\u2705 ${t.operation.action}: ${t.operation.path}`),this._updatePendingChanges(),t.operation.action!=="delete"&&await this.fileOps.openFile(t.operation.path),setTimeout(()=>{this._pendingChanges=this._pendingChanges.filter(s=>s.id!==e),this._updatePendingChanges()},1500);else throw new Error("Operation failed")}catch(a){b.window.showErrorMessage(`\u274C Failed: ${t.operation.path} - ${a}`),this._updatePendingChanges()}}async _applyAllPendingChanges(){if(!this._panel)return;let e=this._pendingChanges.filter(i=>i.status==="pending");if(e.length===0){b.window.showInformationMessage("No pending changes to apply");return}let t=e.length;this._panel?.webview.postMessage({type:"showProgress",text:`Applying 0/${t} files...`,current:0,total:t,show:!0});let a=5,s=0,o=0;for(let i=0;i<e.length;i+=a){let r=e.slice(i,i+a);(await Promise.allSettled(r.map(async l=>{try{return await this.fileOps.applyChange({path:l.operation.path,action:l.operation.action,content:l.operation.content,description:l.operation.description})?(l.status="applied",!0):!1}catch(c){return console.error(`Failed to apply ${l.operation.path}:`,c),!1}}))).forEach(l=>{l.status==="fulfilled"&&l.value?s++:o++});let p=s+o;this._panel?.webview.postMessage({type:"showProgress",text:`Applying ${p}/${t} files...`,current:p,total:t,show:!0}),this._updatePendingChanges()}this._panel?.webview.postMessage({type:"showProgress",show:!1}),b.window.showInformationMessage(`\u2705 Applied ${s} file(s)${o>0?`, ${o} failed`:""}`),this._pendingChanges=this._pendingChanges.filter(i=>i.status==="rejected"),this._updatePendingChanges(),s>0&&await this._runTscCheck()}async _runTscCheck(e=!0){if(await this.fileOps.fileExists("tsconfig.json")){this._panel?.webview.postMessage({type:"showStatus",text:"Checking TypeScript...",show:!0});try{let s=await new xa().runTypeScriptCheck();if(this._panel?.webview.postMessage({type:"showStatus",show:!1}),!s.passed&&s.errors.length>0){this._panel?.webview.postMessage({type:"rippleCheck",errors:s.errorCount,warnings:0,details:s.errors.slice(0,4).map(i=>({type:"error",message:`${i.file}:${i.line} - ${i.message.substring(0,60)}${i.message.length>60?"...":""}`}))});let o=await b.window.showWarningMessage(`\u26A0\uFE0F TypeScript errors found (${s.errorCount})`,"Auto-Fix with AI","Show Errors","Ignore");if(o==="Auto-Fix with AI"&&e){let i=`Please fix these TypeScript errors:

${s.errors.map(r=>`${r.file}:${r.line}: ${r.message}`).join(`
`)}`;this._panel?.webview.postMessage({type:"showStatus",text:"AI fixing TypeScript errors...",show:!0}),await this.sendMessage(i)}else if(o==="Show Errors"){let i=b.window.createOutputChannel("CodeBakers TSC");i.clear(),i.appendLine("TypeScript Errors:"),i.appendLine(`=================
`),s.errors.forEach(r=>{i.appendLine(`${r.file}:${r.line}:${r.column}`),i.appendLine(`  ${r.message}
`)}),i.show()}}else this._panel?.webview.postMessage({type:"rippleCheck",errors:0,warnings:0,details:[{type:"pass",message:"TypeScript compilation successful"}]}),b.window.showInformationMessage("\u2705 TypeScript check passed!")}catch(a){this._panel?.webview.postMessage({type:"showStatus",show:!1}),console.error("TSC check failed:",a)}}}_rejectFileOperation(e){let t=this._pendingChanges.find(a=>a.id===e);t&&t.status==="pending"&&(t.status="rejected",this._updatePendingChanges())}_rejectAllPendingChanges(){for(let e of this._pendingChanges)e.status==="pending"&&(e.status="rejected");this._updatePendingChanges()}async _runCommand(e){if(!this._panel)return;let t=this._pendingCommands.find(a=>a.id===e);if(!(!t||t.status!=="pending")){try{t.status="running",this._updatePendingChanges(),await this.fileOps.runCommand(t.command.command,t.command.description||"CodeBakers"),t.status="done",b.window.showInformationMessage(`\u{1F680} Running: ${t.command.command}`)}catch(a){t.status="pending",b.window.showErrorMessage(`\u274C Failed to run command: ${a}`)}this._updatePendingChanges()}}async _showDiff(e){let t=this._pendingChanges.find(a=>a.id===e);if(!(!t||!t.operation.content))try{await this.fileOps.showDiff(t.operation.path,t.operation.content,`CodeBakers: ${t.operation.path}`)}catch(a){b.window.showErrorMessage(`\u274C Failed to show diff: ${a}`)}}async _undoFileOperation(e){let t=this._pendingChanges.find(a=>a.id===e);if(!t||t.status!=="applied"){b.window.showWarningMessage("Cannot undo - change was not applied");return}try{await this.fileOps.restoreFromBackup(t.operation.path)&&(t.status="pending",this._updatePendingChanges())}catch(a){b.window.showErrorMessage(`\u274C Failed to undo: ${a}`)}}async _undoAppliedFiles(e){if(!e||e.length===0)return;let t=0;for(let a of e)try{await this.fileOps.restoreFromBackup(a)&&(t++,this._pendingChanges=this._pendingChanges.filter(o=>o.operation.path!==a))}catch(s){console.error(`Failed to undo ${a}:`,s)}t>0&&(b.window.showInformationMessage(`\u21A9\uFE0F Undone ${t} file${t>1?"s":""}`),this._updatePendingChanges())}_cancelCurrentRequest(){this._abortController&&(this._abortController.abort(),this._abortController=null,this._panel?.webview.postMessage({type:"requestCancelled"}),b.window.showInformationMessage("Request cancelled"))}_logProjectTime(e){let t=b.workspace.workspaceFolders?.[0];if(!t)return;let a=require("fs"),s=require("path"),o=t.uri.fsPath,i=s.join(o,".codebakers"),r=s.join(i,"timelog.json");a.existsSync(i)||a.mkdirSync(i,{recursive:!0});let d={sessions:[],totals:{totalMinutes:0,totalCost:0,totalRequests:0,totalTokens:0}};if(a.existsSync(r))try{d=JSON.parse(a.readFileSync(r,"utf-8"))}catch{}let p=new Date().toISOString().split("T")[0],l=Math.round(e.activeTime/6e4),c=d.sessions.find(u=>u.date===p);c||(c={date:p,activeMinutes:0,cost:0,requests:0,tokens:0},d.sessions.push(c)),c.activeMinutes=Math.max(c.activeMinutes,l),c.cost=Math.max(c.cost,e.totalCost),c.requests=Math.max(c.requests,e.requests),c.tokens=Math.max(c.tokens,e.tokens),d.totals={totalMinutes:d.sessions.reduce((u,g)=>u+g.activeMinutes,0),totalCost:d.sessions.reduce((u,g)=>u+g.cost,0),totalRequests:d.sessions.reduce((u,g)=>u+g.requests,0),totalTokens:d.sessions.reduce((u,g)=>u+g.tokens,0)};let m=new Date;m.setDate(m.getDate()-90),d.sessions=d.sessions.filter(u=>new Date(u.date)>=m),a.writeFileSync(r,JSON.stringify(d,null,2))}async _deployToVercel(){let e=b.workspace.workspaceFolders?.[0];if(!e){b.window.showErrorMessage("No workspace folder open");return}this._panel?.webview.postMessage({type:"showStatus",show:!0,text:"\u{1F680} Deploying to Vercel..."}),this._messages.push({role:"assistant",content:"\u{1F680} **Starting Vercel deployment...**\n\nRunning `vercel --prod`...",timestamp:new Date}),this._updateWebview();try{let t=require("child_process"),a=e.uri.fsPath,s=await new Promise((d,p)=>{t.exec("npx vercel --prod --yes",{cwd:a,timeout:3e5},(l,c,m)=>{l&&!c?p(l):d({stdout:c,stderr:m})})}),o=s.stdout.match(/https:\/\/[^\s]+\.vercel\.app/),i=o?o[0]:null,r=`\u2705 **Deployment successful!**

`;i&&(r+=`\u{1F517} **Live URL:** [${i}](${i})

`),r+="```\n"+s.stdout.slice(-500)+"\n```",this._messages.push({role:"assistant",content:r,timestamp:new Date}),b.window.showInformationMessage(`\u2705 Deployed successfully!${i?` URL: ${i}`:""}`,"Open URL").then(d=>{d==="Open URL"&&i&&b.env.openExternal(b.Uri.parse(i))})}catch(t){let a=t.message||"Unknown error";a.includes("vercel")&&a.includes("not found")?this._messages.push({role:"assistant",content:"\u274C **Vercel CLI not found**\n\nPlease install it first:\n```bash\nnpm install -g vercel\n```\n\nThen run `vercel login` to authenticate.",timestamp:new Date}):this._messages.push({role:"assistant",content:`\u274C **Deployment failed**

\`\`\`
${a}
\`\`\`

Make sure you have:
1. Vercel CLI installed (\`npm i -g vercel\`)
2. Logged in (\`vercel login\`)
3. Project linked (\`vercel link\`)`,timestamp:new Date}),b.window.showErrorMessage(`Deployment failed: ${a}`)}finally{this._panel?.webview.postMessage({type:"showStatus",show:!1}),this._updateWebview()}}async _pushToGitHub(){let e=b.workspace.workspaceFolders?.[0];if(!e){b.window.showErrorMessage("No workspace folder open");return}let t=e.uri.fsPath,a=require("child_process");try{await new Promise((i,r)=>{a.exec("git rev-parse --git-dir",{cwd:t},d=>{d?r(d):i()})})}catch{b.window.showErrorMessage("Not a git repository. Run `git init` first.");return}let s=!1;try{s=(await new Promise((r,d)=>{a.exec("git status --porcelain",{cwd:t},(p,l)=>{p?d(p):r(l)})})).trim().length>0}catch(i){b.window.showErrorMessage(`Git error: ${i.message}`);return}let o="";if(s){let i=await b.window.showInputBox({prompt:"Enter commit message (or leave empty to skip commit)",placeHolder:"feat: add new feature",value:"chore: update from CodeBakers"});if(i===void 0)return;o=i}this._panel?.webview.postMessage({type:"showStatus",show:!0,text:"\u{1F4E4} Pushing to GitHub..."}),this._messages.push({role:"assistant",content:s&&o?`\u{1F4E4} **Pushing to GitHub...**

Committing changes and pushing to remote...`:`\u{1F4E4} **Pushing to GitHub...**

Pushing to remote...`,timestamp:new Date}),this._updateWebview();try{let i="";if(s&&o){await new Promise((c,m)=>{a.exec("git add -A",{cwd:t},u=>{u?m(u):c()})});let l=await new Promise((c,m)=>{a.exec(`git commit -m "${o.replace(/"/g,'\\"')}"`,{cwd:t},(u,g)=>{u&&!g?m(u):c(g)})});i+=l+`
`}let r=await new Promise((l,c)=>{a.exec("git push",{cwd:t,timeout:6e4},(m,u,g)=>{m&&!u&&!g?c(m):l(u+g)})});i+=r;let d="";try{d=await new Promise(l=>{a.exec("git remote get-url origin",{cwd:t},(c,m)=>{l(m.trim())})}),d.startsWith("git@github.com:")&&(d=d.replace("git@github.com:","https://github.com/").replace(/\.git$/,""))}catch{}let p=`\u2705 **Pushed to GitHub successfully!**

`;d&&d.includes("github.com")&&(p+=`\u{1F517} **Repository:** [${d}](${d})

`),s&&o&&(p+=`\u{1F4DD} **Commit:** ${o}

`),p+="```\n"+i.slice(-300)+"\n```",this._messages.push({role:"assistant",content:p,timestamp:new Date}),b.window.showInformationMessage("\u2705 Pushed to GitHub!",d.includes("github.com")?"Open Repository":void 0).then(l=>{l==="Open Repository"&&d&&b.env.openExternal(b.Uri.parse(d))})}catch(i){let r=i.message||"Unknown error";r.includes("no upstream")||r.includes("no tracking")?this._messages.push({role:"assistant",content:"\u274C **No upstream branch set**\n\nRun this to set up tracking:\n```bash\ngit push -u origin main\n```",timestamp:new Date}):r.includes("Permission denied")||r.includes("authentication")?this._messages.push({role:"assistant",content:`\u274C **Authentication failed**

Make sure you have:
1. GitHub CLI installed (\`gh auth login\`)
2. Or SSH keys configured
3. Or Git credentials stored`,timestamp:new Date}):this._messages.push({role:"assistant",content:`\u274C **Push failed**

\`\`\`
${r}
\`\`\``,timestamp:new Date}),b.window.showErrorMessage(`Push failed: ${r}`)}finally{this._panel?.webview.postMessage({type:"showStatus",show:!1}),this._updateWebview()}}_openPreviewInBrowser(e=3e3){let t=`http://localhost:${e}`;b.env.openExternal(b.Uri.parse(t)),b.window.showInformationMessage(`Opening ${t} in browser...`)}async _installPackages(e){if(!e||e.length===0)return;let t=b.workspace.workspaceFolders?.[0];if(!t){b.window.showErrorMessage("No workspace folder open");return}let a=t.uri.fsPath,s=require("child_process"),o=e.join(" ");this._panel?.webview.postMessage({type:"toast",message:`\u{1F4E6} Installing: ${o}...`});try{await new Promise((i,r)=>{s.exec(`npm install ${o}`,{cwd:a,timeout:12e4},(d,p,l)=>{d?r(d):i()})}),this._panel?.webview.postMessage({type:"toast",message:`\u2705 Installed: ${o}`}),b.window.showInformationMessage(`\u2705 Installed: ${o}`)}catch(i){let r=i.message||"Unknown error";this._panel?.webview.postMessage({type:"toast",message:`\u274C Install failed: ${r}`}),b.window.showErrorMessage(`Package install failed: ${r}`)}}_loadTeamNotes(){let e=b.workspace.workspaceFolders?.[0];if(!e)return;let t=require("fs"),s=require("path").join(e.uri.fsPath,".codebakers","team-notes.md"),o="";if(t.existsSync(s))try{o=t.readFileSync(s,"utf-8")}catch{}this._panel?.webview.postMessage({type:"updateTeamNotes",notes:o})}_saveTeamNotes(e){let t=b.workspace.workspaceFolders?.[0];if(!t)return;let a=require("fs"),s=require("path"),o=s.join(t.uri.fsPath,".codebakers"),i=s.join(o,"team-notes.md");a.existsSync(o)||a.mkdirSync(o,{recursive:!0}),a.writeFileSync(i,e)}async _analyzeImpact(e){if(!this._panel)return;let t=b.workspace.workspaceFolders?.[0];if(!t){this._panel.webview.postMessage({type:"impactAnalysis",files:[{name:"No workspace open",impact:"medium"}],warning:"Open a workspace folder to enable impact analysis"});return}let a=require("fs"),s=require("path"),o=e.toLowerCase(),i=[],r="";try{let d=s.join(t.uri.fsPath,"src");if(a.existsSync(d)){if(o.includes("api")||o.includes("endpoint")||o.includes("route")){let p=s.join(d,"app","api");a.existsSync(p)&&i.push({name:"src/app/api/",impact:"high"})}if(o.includes("component")||o.includes("button")||o.includes("form")||o.includes("modal")){let p=s.join(d,"components");a.existsSync(p)&&i.push({name:"src/components/",impact:"medium"})}if(o.includes("page")||o.includes("layout")){let p=s.join(d,"app");a.existsSync(p)&&i.push({name:"src/app/",impact:"high"})}if(o.includes("database")||o.includes("schema")||o.includes("table")||o.includes("model")){let p=s.join(d,"lib","db","schema.ts");a.existsSync(p)&&(i.push({name:"src/lib/db/schema.ts",impact:"high"}),r="Database schema changes may require migrations")}if(o.includes("auth")||o.includes("login")||o.includes("session")){let p=s.join(d,"lib","auth.ts");a.existsSync(p)&&(i.push({name:"src/lib/auth.ts",impact:"high"}),r="Authentication changes require careful security review")}(o.includes("style")||o.includes("css")||o.includes("theme"))&&i.push({name:"*.css / globals.css",impact:"medium"})}i.length===0&&i.push({name:"src/",impact:"medium"})}catch(d){console.error("Impact analysis error:",d),i.push({name:"Analysis unavailable"})}this._panel.webview.postMessage({type:"impactAnalysis",files:i,warning:r})}_showAppliedToast(e){let t=e.length,a=e.map(s=>s.split("/").pop()).join(", ");this._panel?.webview.postMessage({type:"toast",message:`Applied ${t} file${t>1?"s":""}: ${a}`,action:"undo",files:e}),this._runTscCheck()}async _addPinnedFile(){let e=await b.window.showOpenDialog({canSelectMany:!0,canSelectFolders:!1,openLabel:"Add to Context",filters:{"Code Files":["ts","tsx","js","jsx","json","md","css","html","py","go","rs","java","c","cpp","h"],"All Files":["*"]}});if(!(!e||e.length===0)){for(let t of e){let a=b.workspace.asRelativePath(t);if(!this._pinnedFiles.some(s=>s.path===a))try{let s=await this.fileOps.readFile(a),o=await b.workspace.fs.stat(t);this._pinnedFiles.push({path:a,name:a.split("/").pop()||a,content:s||"",size:o.size})}catch(s){console.error(`Failed to read file ${a}:`,s),b.window.showWarningMessage(`Could not read: ${a}`)}}this._updatePinnedFiles(),b.window.showInformationMessage(`\u{1F4CE} Added ${e.length} file(s) to context`)}}_removePinnedFile(e){this._pinnedFiles=this._pinnedFiles.filter(t=>t.path!==e),this._updatePinnedFiles()}_updatePinnedFiles(){this._panel&&this._panel.webview.postMessage({type:"updatePinnedFiles",files:this._pinnedFiles.map(e=>({path:e.path,name:e.name,size:e.size}))})}_getPinnedFilesContext(){if(this._pinnedFiles.length===0)return"";let e=`

---
## Pinned Context Files

`;for(let t of this._pinnedFiles)e+=`### ${t.path}
\`\`\`
${t.content||"(empty)"}
\`\`\`

`;return e}_filterStreamContent(e){if(!e)return"";let t=e;for(;t.includes("<file_operation>");){let s=t.indexOf("<file_operation>"),o=t.indexOf("</file_operation>",s);if(o===-1)break;t=t.substring(0,s)+t.substring(o+17)}for(;t.includes("```");){let s=t.indexOf("```"),o=t.indexOf("```",s+3);if(o===-1)break;t=t.substring(0,s)+t.substring(o+3)}let a=["content","action","path","thinking","result"];for(let s of a)t=t.split(`<${s}>`).join("").split(`</${s}>`).join("");return t=t.replace(/\n{3,}/g,`

`).trim(),t.length<20?"\u2728 Generating code...":t}_throttledStreamUpdate(){if(Date.now()-this._lastStreamUpdate<this.STREAM_THROTTLE_MS){this._streamThrottleTimer||(this._streamThrottleTimer=setTimeout(()=>{this._streamThrottleTimer=null,this._sendStreamUpdate()},this.STREAM_THROTTLE_MS));return}this._sendStreamUpdate()}_sendStreamUpdate(){this._lastStreamUpdate=Date.now(),this._thinkingBuffer&&this._panel?.webview.postMessage({type:"streamThinking",thinking:this._thinkingBuffer}),this._streamBuffer&&this._panel?.webview.postMessage({type:"streamContent",content:this._streamBuffer})}async sendMessage(e){if(this._panel){if(!this.client.hasSessionToken()){this._panel.webview.postMessage({type:"showLogin"}),b.window.showWarningMessage("Please sign in to CodeBakers first","Sign In with GitHub").then(t=>{t==="Sign In with GitHub"&&this.client.login()});return}this._messages.push({role:"user",content:e,timestamp:new Date}),this._updateWebview(),this._streamBuffer="",this._thinkingBuffer="";try{this._abortController=new AbortController,this._panel.webview.postMessage({type:"typing",isTyping:!0});let t=await this.projectContext.getProjectState(),a=await this._buildContextualizedMessages(e,t),s=await this.client.chat(a,t,{onThinking:o=>{this._thinkingBuffer=o,this._throttledStreamUpdate()},onContent:o=>{this._streamBuffer=this._filterStreamContent(o),this._throttledStreamUpdate()},onDone:()=>{this._panel?.webview.postMessage({type:"validating"})},onError:o=>{this._panel?.webview.postMessage({type:"streamError",error:o.message})},abortSignal:this._abortController.signal});if(this._messages.push({role:"assistant",content:s.content,thinking:s.thinking,timestamp:new Date}),s.usage&&this._panel?.webview.postMessage({type:"updateSessionStats",usage:s.usage}),s.fileOperations&&s.fileOperations.length>0){let o=s.gate2?.passed??!0,i=s.gate2?.compliance?.score??100;if(o&&i>=60){let d=[];for(let p of s.fileOperations)try{await this.fileOps.applyChange({path:p.path,action:p.action,content:p.content,description:p.description})&&(d.push(p.path),this._pendingChanges.push({id:`file-${Date.now()}-${Math.random().toString(36).substring(2,11)}`,operation:p,status:"applied"}))}catch(l){console.error(`Failed to apply ${p.path}:`,l)}d.length>0&&this._showAppliedToast(d)}else{let d=s.gate2?.issues||["Compliance validation failed"];b.window.showWarningMessage(`\u26D4 CodeBakers Enforcement: Files blocked (Score: ${i}/100). Issues: ${d.join(", ")}`,"Apply Anyway","View Issues").then(async p=>{if(p==="Apply Anyway"){for(let l of this._pendingChanges.filter(c=>c.status==="pending"))try{await this.fileOps.applyChange({path:l.operation.path,action:l.operation.action,content:l.operation.content,description:l.operation.description}),l.status="applied"}catch(c){console.error(`Failed to apply ${l.operation.path}:`,c)}this._updatePendingChanges(),b.window.showInformationMessage("\u2705 Files applied (enforcement overridden)")}else if(p==="View Issues"){let l=[`**Compliance Score:** ${i}/100`,"**Issues:**",...d.map(c=>`- ${c}`),"","**Deductions:**",...(s.gate2?.compliance?.deductions||[]).map(c=>`- ${c.issue} (-${c.points} points)`)].join(`
`);b.window.showInformationMessage(l,{modal:!0})}});for(let p of s.fileOperations)this._pendingChanges.push({id:`file-${Date.now()}-${Math.random().toString(36).substring(2,11)}`,operation:p,status:"pending"});this._updatePendingChanges(),console.warn("CodeBakers: Files BLOCKED by enforcement. Score:",i,"Issues:",d)}}if(s.commands&&s.commands.length>0){let o=b.workspace.getConfiguration("codebakers").get("requireApproval",!1),i=s.gate2?.passed??!0,r=s.gate2?.compliance?.score??100,p=i&&r>=60;for(let l of s.commands){let c=`cmd-${Date.now()}-${Math.random().toString(36).substring(2,11)}`;if(o||!p)this._pendingCommands.push({id:c,command:l,status:"pending"});else try{this._pendingCommands.push({id:c,command:l,status:"running"}),await this.fileOps.runCommand(l.command,l.description||"CodeBakers");let m=this._pendingCommands.find(u=>u.id===c);m&&(m.status="done"),b.window.showInformationMessage(`\u2705 Ran: ${l.command}`)}catch(m){let u=this._pendingCommands.find(g=>g.id===c);u&&(u.status="error"),console.error(`Failed to run command ${l.command}:`,m),b.window.showErrorMessage(`\u274C Failed: ${l.command}`)}}p||this._updatePendingChanges()}s.projectUpdates&&await this.projectContext.applyUpdates(s.projectUpdates),await this.projectContext.learnFromResponse(s.content,e),this._messages.length>20&&await this._summarizeConversation()}catch(t){t.message!=="Request was cancelled"&&this._messages.push({role:"assistant",content:`**Error:** ${t instanceof Error?t.message:"Unknown error"}`,timestamp:new Date})}finally{this._streamThrottleTimer&&(clearTimeout(this._streamThrottleTimer),this._streamThrottleTimer=null),this._abortController=null,this._panel?.webview.postMessage({type:"typing",isTyping:!1}),this._updateWebview()}}}async _buildContextualizedMessages(e,t){let a=[];this._isCodeRequest(e)&&a.push({role:"system",content:`CODEBAKERS PATTERN ENFORCEMENT:

Before writing ANY code, you MUST:
1. Check for pattern files in .claude/ directory
2. Read and follow the patterns exactly
3. Use existing code patterns from the codebase
4. Write tests for any new functionality

After writing code, you MUST:
1. Run TypeScript check (tsc --noEmit)
2. Run tests (npm test)
3. Show the CodeBakers footer: "CodeBakers | Snippets: X | TSC: \u2705 | Tests: \u2705"

This is STRUCTURAL enforcement - do not skip these steps.`}),this._conversationSummary&&a.push({role:"system",content:`Previous conversation summary:
${this._conversationSummary}`}),t&&a.push({role:"system",content:`Current project state:
${JSON.stringify(t,null,2)}`});let s=this._getPinnedFilesContext();if(s&&a.push({role:"system",content:`The user has pinned the following files for context. These files should be referenced when relevant:${s}`}),t?.aiMemory){let i=this.projectContext.formatMemoryForPrompt(t.aiMemory);i&&a.push({role:"system",content:i})}let o=this._messages.slice(-10);for(let i of o)a.push({role:i.role,content:i.content});return a}_isCodeRequest(e){if(!e)return!1;let t=["add","create","build","implement","fix","update","change","modify","write","edit","refactor","delete","remove","feature","component","page","api","route","function","button","form","modal","table","chart","endpoint"],a=e.toLowerCase();return t.some(s=>a.includes(s))}async _summarizeConversation(){let e=this._messages.slice(0,-10);if(e.length===0)return;let t=`Summarize these conversation messages, keeping key decisions and context:
${e.map(a=>`${a.role}: ${a.content}`).join(`
`)}`;try{let a=await this.client.summarize(t);this._conversationSummary=a,this._messages=this._messages.slice(-10)}catch(a){console.error("Failed to summarize conversation:",a)}}_updateWebview(){this._panel&&(this._panel.webview.postMessage({type:"updateMessages",messages:this._messages.map(e=>({role:e.role,content:e.content,thinking:e.thinking,timestamp:e.timestamp.toISOString()}))}),this._updatePendingChanges())}_updatePendingChanges(){if(!this._panel)return;let e=this._pendingChanges.filter(a=>a.status==="pending"),t=this._pendingCommands.filter(a=>a.status==="pending");this._panel.webview.postMessage({type:"updatePendingChanges",changes:this._pendingChanges.map(a=>({id:a.id,path:a.operation.path,action:a.operation.action,description:a.operation.description,status:a.status,hasContent:!!a.operation.content})),commands:this._pendingCommands.map(a=>({id:a.id,command:a.command.command,description:a.command.description,status:a.status})),pendingCount:e.length+t.length})}async _checkAndShowOnboarding(){if(!this._panel||!this._stateManager)return;let{needsOnboarding:e}=await this._stateManager.initialize();e?(this._onboardingWizard=new tn(this._stateManager,t=>this._panel?.webview.postMessage(t)),await this._onboardingWizard.initialize(),this._panel.webview.postMessage({type:"showOnboarding",show:!0})):(this._onboardingCompleted=!0,this._panel.webview.postMessage({type:"showOnboarding",show:!1}))}_handleOnboardingAction(e,t){if(this._onboardingWizard||this._stateManager&&(this._onboardingWizard=new tn(this._stateManager,a=>this._panel?.webview.postMessage(a))),this._onboardingWizard&&(this._onboardingWizard.handleInput(e,t),!this._onboardingWizard.isOnboardingRequired()&&(this._onboardingCompleted=!0,this._panel?.webview.postMessage({type:"showOnboarding",show:!1}),this._stateManager))){let a=this._stateManager.loadConfig();a?.discovery?.projectDescription&&this._stateManager.startWorkSession("Project Setup",`Onboarding completed for ${a.projectType} project`)}}_getContextForMessage(){return this._contextPreserver?this._contextPreserver.getContextForInjection():""}_recordAction(e){this._contextPreserver?.recordAction(e)}_shouldBlockChat(){return!1}_getHtmlForWebview(e){return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeBakers</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .header-icon {
      width: 20px;
      height: 20px;
    }

    .header-title {
      font-weight: 600;
      font-size: 13px;
      flex: 1;
    }

    .header-btn {
      background: transparent;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      opacity: 0.7;
    }

    .header-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
      opacity: 1;
    }

    .plan-badge {
      font-size: 10px;
      padding: 2px 8px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-radius: 10px;
    }

    .plan-badge.trial {
      background: #f0a030;
    }

    /* View Mode Toggle Buttons */
    .view-mode-toggle {
      display: flex;
      gap: 2px;
      background: var(--vscode-input-background, #3c3c3c);
      border-radius: 6px;
      padding: 2px;
      margin-left: auto;
    }

    /* View mode buttons - HIDDEN (Canvas Mode removed) */
    .view-mode-btn {
      display: none !important;
    }

    .view-mode-toggle {
      display: none !important;
    }

    /* Preview panel - HIDDEN (Canvas Mode removed) */
    .preview-panel {
      display: none !important;
    }

    /* Team Notes - HIDDEN (UI cleanup) */
    .team-notes {
      display: none !important;
    }

    /* Action Bar - HIDDEN (UI cleanup - actions in welcome screen) */
    .action-bar {
      display: none !important;
    }

    /* Add Files Hint - HIDDEN (context files in pinned section) */
    .add-files-hint {
      display: none !important;
    }

    /* Session Stats - HIDDEN (cleaner UI like Cursor) */
    .session-stats {
      display: none !important;
    }

    /* Pending Badge */
    .pending-badge {
      display: none;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: var(--vscode-badge-background, #4d4d4d);
      color: var(--vscode-badge-foreground, #fff);
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      animation: pendingPulse 2s ease-in-out infinite;
    }

    .pending-badge.visible {
      display: flex;
    }

    .pending-badge:hover {
      background: var(--vscode-button-background, #0e639c);
    }

    .pending-badge .badge-icon {
      font-size: 12px;
    }

    .pending-badge .badge-count {
      min-width: 16px;
      text-align: center;
    }

    @keyframes pendingPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    /* Slide-out Pending Panel */
    .pending-slideout {
      position: fixed;
      top: 0;
      right: -320px;
      width: 300px;
      height: 100%;
      background: var(--vscode-sideBar-background, #252526);
      border-left: 1px solid var(--vscode-panel-border, #3c3c3c);
      z-index: 1000;
      transition: right 0.3s ease;
      display: flex;
      flex-direction: column;
    }

    .pending-slideout.open {
      right: 0;
    }

    .pending-slideout-header {
      padding: 16px;
      border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .pending-slideout-title {
      font-weight: 600;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pending-slideout-close {
      background: transparent;
      border: none;
      color: var(--vscode-foreground);
      font-size: 18px;
      cursor: pointer;
      padding: 4px 8px;
      opacity: 0.7;
    }

    .pending-slideout-close:hover {
      opacity: 1;
    }

    .pending-slideout-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    .pending-slideout-actions {
      padding: 12px 16px;
      border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
      display: flex;
      gap: 8px;
    }

    .pending-slideout-btn {
      flex: 1;
      padding: 8px 12px;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .pending-slideout-btn.accept {
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
    }

    .pending-slideout-btn.accept:hover {
      background: var(--vscode-button-hoverBackground, #1177bb);
    }

    .pending-slideout-btn.reject {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #fff);
    }

    .pending-slideout-btn.reject:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }

    .pending-file-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--vscode-list-hoverBackground, #2a2d2e);
      border-radius: 6px;
      margin-bottom: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .pending-file-item:hover {
      background: var(--vscode-list-activeSelectionBackground, #094771);
    }

    .pending-file-item .file-icon {
      opacity: 0.7;
    }

    .pending-file-item .file-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pending-file-item .file-action {
      font-size: 10px;
      padding: 2px 6px;
      background: var(--vscode-badge-background, #4d4d4d);
      border-radius: 4px;
      text-transform: uppercase;
    }

    .pending-history {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
    }

    .pending-history-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground, #888);
      margin-bottom: 8px;
    }

    .pending-history-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #888);
    }

    .pending-history-item .check {
      color: #4ec9b0;
    }

    /* Slideout overlay */
    .slideout-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.3);
      z-index: 999;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }

    .slideout-overlay.visible {
      opacity: 1;
      pointer-events: auto;
    }

    /* ============================================
       Canvas Mode - Pure Visualization Only
       30% Chat / 70% Canvas Split Layout
       ============================================ */

    .canvas-mode .split-container {
      flex-direction: row;
    }

    /* 30% Chat panel in Canvas Mode */
    .canvas-mode .main-content {
      display: flex !important;
      flex: 0 0 30% !important;
      max-width: 30% !important;
      border-right: 1px solid var(--vscode-panel-border, #2d2d2d);
    }

    /* 70% Canvas panel */
    .canvas-mode .preview-panel {
      display: flex !important;
      flex: 0 0 70% !important;
      max-width: 70% !important;
      width: 70% !important;
      border-left: none !important;
    }

    .canvas-mode .preview-header {
      display: none;
    }

    .canvas-mode .preview-canvas {
      border-radius: 0;
    }

    /* Hide clutter in Canvas Mode - keep it minimal */
    .canvas-mode .suggestions-panel,
    .canvas-mode .templates-gallery,
    .canvas-mode .canvas-chat-input,
    .canvas-mode .ai-response-bar,
    .canvas-mode .pinned-files,
    .canvas-mode .team-notes,
    .canvas-mode .add-files-hint,
    .canvas-mode .action-bar,
    .canvas-mode .building-overlay,
    .canvas-mode .canvas-stats {
      display: none !important;
    }

    /* AI Response Bar - only used in Classic Mode now */
    .ai-response-bar {
      display: none;
    }

    .ai-response-bar.collapsed {
      max-height: 44px;
    }

    .ai-response-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      cursor: pointer;
      min-height: 44px;
      transition: background 0.2s ease;
    }

    .ai-response-header:hover {
      background: rgba(255, 255, 255, 0.04);
    }

    .ai-response-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ai-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4ade80;
      box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
      animation: pulse-dot 2s infinite;
    }

    @keyframes pulse-dot {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .ai-response-status {
      font-size: 13px;
      font-weight: 600;
      color: #4ade80;
      letter-spacing: 0.3px;
    }

    .ai-response-summary {
      flex: 1;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ai-response-toggle {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.4);
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px 8px;
      transition: transform 0.2s ease, color 0.2s ease;
    }

    .ai-response-toggle:hover {
      color: rgba(255, 255, 255, 0.7);
    }

    .ai-response-bar.collapsed .ai-response-toggle {
      transform: rotate(180deg);
    }

    .ai-response-content {
      padding: 0 20px 16px;
      overflow-y: auto;
      flex: 1;
      font-size: 13px;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.8);
    }

    .ai-response-bar.collapsed .ai-response-content {
      display: none;
    }

    /* Canvas Mode Chat Input - Modern Design */
    .canvas-chat-input {
      display: none;
      padding: 16px 20px 20px;
      background: linear-gradient(180deg, rgba(28, 28, 30, 0.98) 0%, rgba(22, 22, 24, 1) 100%);
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .canvas-mode .canvas-chat-input {
      display: none; /* Hide duplicate input - use main chat input */
    }

    .canvas-input-context {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      min-height: 24px;
    }

    .canvas-input-context.has-context {
      margin-bottom: 12px;
    }

    .context-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px 4px 8px;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 20px;
      font-size: 12px;
      color: #60a5fa;
    }

    .context-icon {
      font-size: 12px;
    }

    .context-name {
      font-weight: 500;
    }

    .context-clear {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.4);
      font-size: 14px;
      cursor: pointer;
      padding: 0 2px;
      margin-left: 2px;
      line-height: 1;
      transition: color 0.2s ease;
    }

    .context-clear:hover {
      color: #f87171;
    }

    .canvas-input-row {
      display: flex;
      align-items: flex-end;
      gap: 10px;
      margin-bottom: 14px;
    }

    .canvas-input-field,
    #canvasInput {
      flex: 1;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: #e5e5e5;
      font-size: 14px;
      resize: none;
      font-family: inherit;
      line-height: 1.5;
      min-height: 44px;
      max-height: 120px;
      transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
    }

    .canvas-input-field::placeholder,
    #canvasInput::placeholder {
      color: rgba(255, 255, 255, 0.35);
    }

    .canvas-input-field:focus,
    #canvasInput:focus {
      outline: none;
      border-color: rgba(59, 130, 246, 0.5);
      background: rgba(255, 255, 255, 0.07);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .canvas-voice-btn {
      width: 44px;
      height: 44px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: rgba(255, 255, 255, 0.6);
      font-size: 18px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .canvas-voice-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.15);
      color: rgba(255, 255, 255, 0.9);
    }

    .canvas-send-btn {
      padding: 12px 24px;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
      min-width: 80px;
    }

    .canvas-send-btn:hover {
      background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
      transform: translateY(-1px);
    }

    .canvas-send-btn:active {
      transform: translateY(0);
      box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
    }

    .canvas-send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    /* Canvas Quick Actions - Modern Pill Buttons */
    .canvas-quick-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .canvas-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .canvas-action:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.15);
      color: #fff;
      transform: translateY(-1px);
    }

    .canvas-action:active {
      transform: translateY(0);
    }

    .canvas-action[data-action="explain"] {
      background: rgba(250, 204, 21, 0.08);
      border-color: rgba(250, 204, 21, 0.2);
      color: #fcd34d;
    }

    .canvas-action[data-action="explain"]:hover {
      background: rgba(250, 204, 21, 0.15);
      border-color: rgba(250, 204, 21, 0.3);
    }

    .canvas-action[data-action="add-feature"] {
      background: rgba(34, 197, 94, 0.08);
      border-color: rgba(34, 197, 94, 0.2);
      color: #4ade80;
    }

    .canvas-action[data-action="add-feature"]:hover {
      background: rgba(34, 197, 94, 0.15);
      border-color: rgba(34, 197, 94, 0.3);
    }

    .canvas-action[data-action="connect"] {
      background: rgba(168, 85, 247, 0.08);
      border-color: rgba(168, 85, 247, 0.2);
      color: #c084fc;
    }

    .canvas-action[data-action="connect"]:hover {
      background: rgba(168, 85, 247, 0.15);
      border-color: rgba(168, 85, 247, 0.3);
    }

    .canvas-action[data-action="generate"] {
      background: rgba(59, 130, 246, 0.08);
      border-color: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
    }

    .canvas-action[data-action="generate"]:hover {
      background: rgba(59, 130, 246, 0.15);
      border-color: rgba(59, 130, 246, 0.3);
    }

    /* Node Selection State */
    .preview-node.selected {
      box-shadow: 0 0 0 3px var(--vscode-focusBorder, #007acc), 0 4px 12px rgba(0, 0, 0, 0.4);
      transform: translateY(-2px) scale(1.02);
    }

    .preview-node .node-actions {
      display: none;
      position: absolute;
      bottom: -30px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-editorWidget-border, #454545);
      border-radius: 4px;
      padding: 4px;
      gap: 2px;
      z-index: 10;
    }

    .preview-node.selected .node-actions,
    .preview-node:hover .node-actions {
      display: flex;
    }

    .node-action-btn {
      padding: 4px 8px;
      background: transparent;
      border: none;
      border-radius: 3px;
      font-size: 12px;
      cursor: pointer;
      opacity: 0.8;
    }

    .node-action-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, #5a5d5e);
      opacity: 1;
    }

    /* Session stats bar */
    .session-stats {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 4px 12px;
      background: var(--vscode-editor-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .session-stats .stat {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .session-stats .stat-label {
      opacity: 0.7;
    }

    .session-stats .stat-value {
      font-weight: 500;
      color: var(--vscode-foreground);
    }

    .session-stats .stat-value.cost {
      color: #4ec9b0;
    }

    .session-stats .reset-btn {
      margin-left: auto;
      background: transparent;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
    }

    .session-stats .reset-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
      color: var(--vscode-foreground);
    }

    /* ============================================
       Pre-Flight Impact Check UI
       ============================================ */
    .impact-check {
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 8px;
      padding: 12px;
      margin: 8px 0;
      font-size: 12px;
    }

    .impact-check-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #60a5fa;
      margin-bottom: 10px;
    }

    .impact-check-section {
      margin-bottom: 10px;
    }

    .impact-check-section-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .impact-check-files {
      padding-left: 12px;
      border-left: 2px solid rgba(59, 130, 246, 0.3);
    }

    .impact-file {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 0;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
    }

    .impact-file.new { color: #22c55e; }
    .impact-file.modify { color: #f59e0b; }
    .impact-file.depends { color: #a78bfa; }

    .impact-warning {
      background: rgba(245, 158, 11, 0.1);
      border-left: 3px solid #f59e0b;
      padding: 8px;
      margin-top: 8px;
      border-radius: 0 4px 4px 0;
      color: #fbbf24;
      font-size: 11px;
    }

    /* ============================================
       Ripple Check / Coherence Check UI
       ============================================ */
    .ripple-check {
      background: rgba(34, 197, 94, 0.08);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 8px;
      padding: 12px;
      margin: 8px 0;
      font-size: 12px;
    }

    .ripple-check.error {
      background: rgba(239, 68, 68, 0.08);
      border-color: rgba(239, 68, 68, 0.3);
    }

    .ripple-check-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #4ade80;
      margin-bottom: 8px;
    }

    .ripple-check.error .ripple-check-header {
      color: #f87171;
    }

    .ripple-check-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 11px;
    }

    .ripple-check-item .status {
      width: 16px;
      text-align: center;
    }

    .ripple-check-item.pass { color: #4ade80; }
    .ripple-check-item.fail { color: #f87171; }
    .ripple-check-item.warn { color: #fbbf24; }

    /* ============================================
       Collapsible Code Blocks
       ============================================ */
    .code-block-wrapper {
      margin: 8px 0;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
    }

    .code-block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--vscode-editor-background, #1e1e1e);
      cursor: pointer;
      user-select: none;
      border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
    }

    .code-block-header:hover {
      background: var(--vscode-list-hoverBackground, #2a2d2e);
    }

    .code-block-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
    }

    .code-block-filename {
      font-family: var(--vscode-editor-font-family, monospace);
      color: #60a5fa;
    }

    .code-block-lines {
      color: var(--vscode-descriptionForeground);
    }

    .code-chevron {
      transition: transform 0.2s ease;
      color: var(--vscode-descriptionForeground);
    }

    .code-block-wrapper:not(.collapsed) .code-chevron {
      transform: rotate(90deg);
    }

    .code-block-content {
      max-height: 400px;
      overflow: auto;
      transition: max-height 0.2s ease;
    }

    .code-block-wrapper.collapsed .code-block-content {
      display: none;
    }

    .code-block-content pre {
      margin: 0;
      padding: 12px;
      background: var(--vscode-editor-background, #1e1e1e);
      font-size: 12px;
      line-height: 1.5;
      overflow-x: auto;
    }

    .code-block-content code {
      font-family: var(--vscode-editor-font-family, monospace);
    }

    /* Pre-Flight Impact Check Panel */
    .preflight-panel {
      display: none;
      margin: 12px 0;
      padding: 16px;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 8px;
      animation: slideIn 0.3s ease;
    }

    .preflight-panel.show {
      display: block;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .preflight-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    .preflight-header svg {
      color: #3b82f6;
    }

    .preflight-section {
      margin-bottom: 12px;
    }

    .preflight-section-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px;
    }

    .preflight-files {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .preflight-file {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 4px;
      font-size: 11px;
      font-family: var(--vscode-editor-font-family, monospace);
    }

    .preflight-file.high-impact {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #ef4444;
    }

    .preflight-file.medium-impact {
      background: rgba(245, 158, 11, 0.2);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #f59e0b;
    }

    .preflight-warning {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 6px;
      font-size: 12px;
      color: #f59e0b;
    }

    .preflight-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .preflight-btn {
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .preflight-btn.primary {
      background: #3b82f6;
      color: white;
      border: none;
    }

    .preflight-btn.primary:hover {
      background: #2563eb;
    }

    .preflight-btn.secondary {
      background: transparent;
      color: var(--vscode-descriptionForeground);
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
    }

    .preflight-btn.secondary:hover {
      background: var(--vscode-list-hoverBackground);
    }

    /* Ripple Check Panel */
    .ripple-panel {
      margin: 12px 0;
      padding: 12px 16px;
      border-radius: 8px;
      animation: slideIn 0.3s ease;
    }

    .ripple-panel.success {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .ripple-panel.warning {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .ripple-panel.error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .ripple-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 13px;
    }

    .ripple-panel.success .ripple-header {
      color: #22c55e;
    }

    .ripple-panel.warning .ripple-header {
      color: #f59e0b;
    }

    .ripple-panel.error .ripple-header {
      color: #ef4444;
    }

    .ripple-details {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .ripple-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 0;
    }

    .ripple-item.pass {
      color: #22c55e;
    }

    .ripple-item.fail {
      color: #ef4444;
    }

    /* Toast Notification */
    .toast-container {
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #1e1e1e;
      border: 1px solid rgba(34, 197, 94, 0.4);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: toastSlideIn 0.3s ease;
      pointer-events: auto;
    }

    @keyframes toastSlideIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .toast.hiding {
      animation: toastSlideOut 0.3s ease forwards;
    }

    @keyframes toastSlideOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(20px); }
    }

    .toast-icon {
      color: #22c55e;
    }

    .toast-message {
      flex: 1;
      font-size: 13px;
      color: var(--vscode-foreground);
    }

    .toast-undo {
      padding: 4px 10px;
      background: transparent;
      border: 1px solid var(--vscode-button-border, #3c3c3c);
      border-radius: 4px;
      color: var(--vscode-foreground);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .toast-undo:hover {
      background: var(--vscode-button-hoverBackground);
    }

    /* Main content area */
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    /* Messages area */
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      max-width: 90%;
      padding: 12px 16px;
      border-radius: 10px;
      line-height: 1.6;
      font-size: 13px;
    }

    .message p {
      margin: 0 0 10px 0;
    }

    .message p:last-child {
      margin-bottom: 0;
    }

    .message.user {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }

    .message.assistant {
      background: var(--vscode-editor-inactiveSelectionBackground);
      align-self: flex-start;
      border-bottom-left-radius: 4px;
    }

    .message pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 8px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 8px 0;
      font-size: 12px;
    }

    .message code {
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
    }

    .message h1, .message h2, .message h3, .message h4 {
      margin: 10px 0 6px 0;
      font-weight: 600;
    }

    .message h1 { font-size: 1.3em; }
    .message h2 { font-size: 1.2em; }
    .message h3 { font-size: 1.1em; }

    .message .chat-header-large {
      font-size: 1.2em;
      font-weight: 600;
      color: var(--vscode-foreground);
      margin: 12px 0 8px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .message .chat-header-medium {
      font-size: 1.1em;
      font-weight: 600;
      color: var(--vscode-foreground);
      margin: 10px 0 6px 0;
    }

    .message strong {
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    .message .chat-hr {
      border: none;
      border-top: 1px solid var(--vscode-panel-border);
      margin: 12px 0;
    }

    .message ul, .message ol {
      margin: 6px 0;
      padding-left: 18px;
    }

    .message li { margin: 3px 0; }

    .message hr {
      border: none;
      border-top: 1px solid var(--vscode-panel-border);
      margin: 10px 0;
    }

    .message p { margin: 6px 0; }
    .message p:first-child { margin-top: 0; }
    .message p:last-child { margin-bottom: 0; }

    .thinking-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      margin-bottom: 8px;
      padding: 4px 0;
    }

    .thinking-content {
      background: var(--vscode-textBlockQuote-background);
      border-left: 2px solid var(--vscode-textLink-foreground);
      padding: 8px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      display: none;
      max-height: 200px;
      overflow-y: auto;
    }

    .thinking-content.show { display: block; }

    .streaming-indicator {
      align-self: flex-start;
      display: none;
      padding: 10px 14px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 10px;
      border-bottom-left-radius: 4px;
      max-width: 90%;
    }

    .streaming-indicator.show { display: block; }

    .thinking-label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px 4px;
      color: var(--vscode-foreground);
      font-size: 13px;
    }

    .thinking-icon {
      font-size: 16px;
    }

    .thinking-title {
      font-weight: 600;
      color: #dc2626;
    }

    .thinking-tip {
      padding: 0 16px 12px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
      animation: tipFade 0.3s ease-in-out;
    }

    @keyframes tipFade {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .typing-dots {
      display: flex;
      gap: 4px;
    }

    .typing-dot {
      width: 6px;
      height: 6px;
      background: var(--vscode-foreground);
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out;
    }

    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes bounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-6px); }
    }

    /* Pending Changes Panel - Claude Code Style */
    .pending-panel {
      border-top: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
      max-height: 40vh;
      overflow-y: auto;
      display: none;
      flex-shrink: 0;
    }

    /* Show pending panel when there are changes */
    .pending-panel.show { display: block; }

    .pending-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .pending-title {
      font-weight: 600;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pending-count {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;
    }

    .pending-actions {
      display: flex;
      gap: 8px;
    }

    .accept-all-btn {
      background: #28a745;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
    }

    .accept-all-btn:hover { background: #218838; }

    .reject-all-btn {
      background: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 5px 12px;
      font-size: 11px;
      cursor: pointer;
    }

    .reject-all-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .pending-close-btn {
      background: transparent;
      color: var(--vscode-foreground);
      border: none;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      padding: 2px 6px;
      margin-left: 4px;
      opacity: 0.6;
      border-radius: 4px;
    }

    .pending-close-btn:hover {
      opacity: 1;
      background: var(--vscode-toolbar-hoverBackground);
    }

    .pending-list {
      padding: 0;
    }

    .pending-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .pending-item:last-child { border-bottom: none; }

    .pending-item.applied {
      opacity: 0.5;
      background: rgba(40, 167, 69, 0.1);
    }

    .pending-item.rejected {
      opacity: 0.5;
      text-decoration: line-through;
    }

    .pending-icon {
      width: 18px;
      text-align: center;
      font-size: 12px;
    }

    .pending-info {
      flex: 1;
      min-width: 0;
    }

    .pending-path {
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      color: var(--vscode-textLink-foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .pending-desc {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
    }

    .pending-item-actions {
      display: flex;
      gap: 4px;
    }

    .item-btn {
      background: transparent;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      padding: 3px 8px;
      font-size: 10px;
      cursor: pointer;
      color: var(--vscode-foreground);
    }

    .item-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .item-btn.accept {
      background: #28a745;
      border-color: #28a745;
      color: white;
    }

    .item-btn.accept:hover { background: #218838; }

    .item-btn.preview {
      background: #0d6efd;
      border-color: #0d6efd;
      color: white;
    }

    .item-btn.preview:hover { background: #0b5ed7; }

    .item-btn.reject {
      color: #dc3545;
      border-color: #dc3545;
    }

    .item-btn.reject:hover {
      background: rgba(220, 53, 69, 0.1);
    }

    .command-item {
      background: var(--vscode-textCodeBlock-background);
    }

    .command-text {
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
    }

    /* Pinned Files Section (Cursor-style context) */
    .pinned-files {
      padding: 8px 16px;
      border-top: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
      display: none;
      flex-shrink: 0;
    }

    .pinned-files.show {
      display: block;
    }

    .pinned-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .pinned-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .pinned-count {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 1px 5px;
      border-radius: 8px;
      font-size: 9px;
    }

    .pinned-actions {
      display: flex;
      gap: 6px;
    }

    .pinned-btn {
      background: transparent;
      border: 1px solid var(--vscode-panel-border);
      color: var(--vscode-foreground);
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 10px;
      cursor: pointer;
    }

    .pinned-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .pinned-btn.add {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
    }

    .pinned-btn.add:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .pinned-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .pinned-file {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      padding: 3px 6px 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      max-width: 200px;
    }

    .pinned-file-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--vscode-textLink-foreground);
    }

    .pinned-file-remove {
      background: transparent;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      padding: 0;
      font-size: 12px;
      line-height: 1;
      opacity: 0.7;
    }

    .pinned-file-remove:hover {
      opacity: 1;
      color: var(--vscode-errorForeground);
    }

    /* Team Notes - HIDDEN (removed from UI) */
    .team-notes {
      display: none !important;
    }

    .team-notes-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .team-notes-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 500;
    }

    .team-notes-hint {
      font-size: 10px;
      opacity: 0.6;
      font-weight: normal;
    }

    .team-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 4px;
      padding: 3px 10px;
      cursor: pointer;
      font-size: 10px;
    }

    .team-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .team-notes-input {
      width: 100%;
      min-height: 50px;
      max-height: 100px;
      resize: vertical;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 8px;
      font-size: 11px;
      font-family: var(--vscode-font-family);
      line-height: 1.4;
    }

    .team-notes-input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .add-files-hint {
      padding: 8px 16px;
      border-top: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
      flex-shrink: 0;
    }

    .add-files-btn {
      width: 100%;
      background: transparent;
      border: 1px dashed var(--vscode-panel-border);
      color: var(--vscode-descriptionForeground);
      padding: 6px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .add-files-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
      border-color: var(--vscode-focusBorder);
      color: var(--vscode-foreground);
    }

    /* Input area */
    .input-area {
      padding: 12px 16px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .input-area textarea {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      padding: 10px 12px;
      font-family: inherit;
      font-size: 13px;
      resize: none;
      min-height: 40px;
      max-height: 120px;
    }

    .input-area textarea:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .input-area textarea:disabled {
      opacity: 0.6;
    }

    .send-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 6px;
      padding: 0 16px;
      cursor: pointer;
      font-weight: 500;
      font-size: 12px;
    }

    .send-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .cancel-btn {
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 0 16px;
      cursor: pointer;
      font-weight: 500;
      font-size: 12px;
      display: none;
    }

    .cancel-btn.show { display: block; }
    .cancel-btn:hover { background: #c82333; }

    /* Voice button */
    .voice-btn {
      background: transparent;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 0 12px;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 40px;
      transition: all 0.2s;
    }

    .voice-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
      border-color: var(--vscode-focusBorder);
    }

    .voice-btn.listening {
      background: #dc3545;
      border-color: #dc3545;
      animation: pulse 1.5s infinite;
    }

    .voice-btn.listening::after {
      content: '';
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 6px;
      border: 2px solid #dc3545;
      animation: ripple 1.5s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    @keyframes ripple {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(1.3); opacity: 0; }
    }

    .voice-status {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
      margin-top: 4px;
      display: none;
    }

    .voice-status.show { display: block; }

    /* Welcome screen */
    .welcome {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 30px;
      text-align: center;
    }

    .welcome-icon { font-size: 48px; margin-bottom: 16px; }
    .welcome-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .welcome-text { color: var(--vscode-descriptionForeground); margin-bottom: 20px; max-width: 350px; font-size: 13px; }

    .quick-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }

    .quick-action {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 16px;
      padding: 6px 14px;
      cursor: pointer;
      font-size: 12px;
    }

    .quick-action:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .quick-action.deploy {
      background: linear-gradient(135deg, #000 0%, #333 100%);
      color: white;
      border-color: #444;
    }

    .quick-action.deploy:hover {
      background: linear-gradient(135deg, #111 0%, #444 100%);
    }

    .quick-action.github {
      background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
      color: white;
      border-color: #238636;
    }

    .quick-action.github:hover {
      background: linear-gradient(135deg, #2ea043 0%, #3fb950 100%);
    }

    /* Getting Started Section */
    .getting-started {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 12px;
      padding: 20px;
      margin-top: 16px;
      max-width: 400px;
      text-align: left;
    }

    .getting-started-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--vscode-foreground);
    }

    .getting-started-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .getting-started-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .item-icon {
      font-size: 16px;
      flex-shrink: 0;
    }

    .item-text {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }

    .getting-started-examples {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--vscode-widget-border);
    }

    .examples-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 10px;
    }

    .example-chip {
      display: inline-block;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border-radius: 16px;
      padding: 6px 12px;
      font-size: 12px;
      margin: 4px 4px 4px 0;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .example-chip:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    /* File Upload Zone */
    .file-upload-zone {
      border: 2px dashed var(--vscode-input-border);
      border-radius: 12px;
      padding: 24px 16px;
      margin: 16px 0;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background: var(--vscode-input-background);
      max-width: 400px;
    }

    .file-upload-zone:hover {
      border-color: #dc2626;
      background: rgba(220, 38, 38, 0.05);
    }

    .file-upload-zone.drag-over {
      border-color: #dc2626;
      background: rgba(220, 38, 38, 0.1);
      transform: scale(1.02);
    }

    .file-upload-icon {
      font-size: 32px;
      margin-bottom: 8px;
    }

    .file-upload-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .file-upload-main {
      font-size: 14px;
      font-weight: 500;
      color: var(--vscode-foreground);
    }

    .file-upload-sub {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .file-browse-btn {
      background: none;
      border: none;
      color: #dc2626;
      cursor: pointer;
      text-decoration: underline;
      font-size: 12px;
      padding: 0;
    }

    .file-browse-btn:hover {
      color: #b91c1c;
    }

    .file-upload-formats {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 8px;
      opacity: 0.7;
    }

    /* Uploaded Files List */
    .uploaded-files {
      max-width: 400px;
      margin: 12px 0;
      background: var(--vscode-input-background);
      border-radius: 8px;
      padding: 12px;
    }

    .uploaded-files-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      font-size: 12px;
      font-weight: 500;
    }

    .clear-uploads-btn {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      font-size: 11px;
      padding: 2px 6px;
    }

    .clear-uploads-btn:hover {
      color: #dc2626;
    }

    .uploaded-files-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .uploaded-file-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: var(--vscode-editor-background);
      border-radius: 6px;
      font-size: 12px;
    }

    .uploaded-file-icon {
      font-size: 14px;
    }

    .uploaded-file-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .uploaded-file-size {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }

    .remove-file-btn {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      font-size: 14px;
      padding: 0 4px;
      opacity: 0.6;
    }

    .remove-file-btn:hover {
      color: #dc2626;
      opacity: 1;
    }

    /* Persistent Action Bar (always visible) */
    .action-bar {
      display: flex;
      gap: 6px;
      padding: 8px 12px;
      background: var(--vscode-editor-background);
      border-top: 1px solid var(--vscode-panel-border);
      flex-wrap: wrap;
      justify-content: center;
    }

    .action-bar .action-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 12px;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .action-bar .action-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .action-bar .action-btn.github {
      background: #238636;
      color: white;
      border-color: #238636;
    }

    .action-bar .action-btn.github:hover {
      background: #2ea043;
    }

    .action-bar .action-btn.deploy {
      background: #333;
      color: white;
      border-color: #444;
    }

    .action-bar .action-btn.deploy:hover {
      background: #444;
    }

    .action-bar .action-btn.mindmap {
      background: #1e3a5f;
      color: #60a5fa;
      border-color: #3b82f6;
    }

    .action-bar .action-btn.mindmap:hover {
      background: #2563eb;
      color: white;
    }

    .action-bar .action-btn.preview {
      background: #0d9488;
      color: white;
      border-color: #14b8a6;
    }

    .action-bar .action-btn.preview:hover {
      background: #14b8a6;
    }

    /* Login prompt */
    .login-prompt {
      flex: 1;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 30px;
      text-align: center;
    }

    .login-prompt.show { display: flex; }

    .login-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 6px;
      padding: 10px 20px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      margin-top: 16px;
    }

    .login-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    /* Onboarding Container - HIDDEN (Option D: Welcome screen only) */
    .onboarding-container {
      display: none !important;
    }

    .onboarding-container.show {
      display: none !important;
    }

    .onboarding-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      max-width: 500px;
      margin: 0 auto;
      width: 100%;
    }

    .onboarding-step {
      padding: 24px;
      text-align: center;
    }

    .onboarding-step h2 {
      margin: 16px 0 8px;
      font-size: 1.5rem;
      color: var(--vscode-foreground);
    }

    .onboarding-step p {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 16px;
    }

    .onboarding-step .subtitle {
      font-size: 0.875rem;
      margin-bottom: 24px;
    }

    .step-indicator {
      font-size: 0.75rem;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }

    .onboarding-icon {
      color: #dc2626;
      margin-bottom: 8px;
    }

    .onboarding-primary-btn {
      background: #dc2626;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }

    .onboarding-primary-btn:hover {
      background: #b91c1c;
    }

    .onboarding-primary-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .onboarding-secondary-btn {
      background: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      margin-left: 8px;
    }

    .skill-options, .project-options, .method-options {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 20px;
    }

    .skill-btn, .project-btn, .method-btn {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 16px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 8px;
      cursor: pointer;
      text-align: left;
      transition: border-color 0.2s;
      position: relative;
      color: var(--vscode-foreground);
    }

    .skill-btn:hover, .project-btn:hover, .method-btn:hover {
      border-color: #dc2626;
    }

    .skill-btn.recommended, .method-btn.recommended {
      border-color: #dc2626;
    }

    .skill-icon, .project-icon, .method-icon {
      font-size: 1.5rem;
      margin-bottom: 8px;
    }

    .skill-title, .project-title, .method-title {
      font-weight: 600;
      color: var(--vscode-foreground);
      margin-bottom: 4px;
    }

    .skill-desc, .project-desc, .method-desc {
      font-size: 0.875rem;
      color: var(--vscode-descriptionForeground);
    }

    .recommended-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      font-size: 0.75rem;
      background: #dc2626;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .onboarding-form-group {
      margin-bottom: 16px;
      text-align: left;
    }

    .onboarding-form-group label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: var(--vscode-foreground);
    }

    .onboarding-form-group input,
    .onboarding-form-group textarea,
    .onboarding-form-group select {
      width: 100%;
      padding: 10px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      color: var(--vscode-foreground);
      font-size: 0.875rem;
    }

    .onboarding-form-group textarea {
      resize: vertical;
      min-height: 80px;
    }

    .stack-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 20px 0;
      text-align: left;
    }

    .stack-item {
      padding: 12px;
      background: var(--vscode-input-background);
      border-radius: 8px;
    }

    .stack-label {
      display: block;
      font-size: 0.75rem;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }

    .stack-value {
      font-weight: 500;
      color: var(--vscode-foreground);
    }

    .success-icon {
      font-size: 3rem;
      margin-bottom: 16px;
    }

    /* Status indicator */
    .status-indicator {
      display: none;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      font-size: 12px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .status-indicator.show { display: flex; }

    .status-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid var(--vscode-foreground);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Progress bar */
    .progress-bar {
      width: 100%;
      height: 4px;
      background: var(--vscode-progressBar-background, #333);
      border-radius: 2px;
      margin-top: 6px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--vscode-progressBar-foreground, #0e7ad3);
      border-radius: 2px;
      transition: width 0.2s ease;
    }

    /* ========================================
       LIVE PREVIEW - Split Screen Layout
       ======================================== */

    .preview-toggle {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: transparent;
      border: 1px solid var(--vscode-button-secondaryBackground, #3c3c3c);
      border-radius: 4px;
      color: var(--vscode-foreground);
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-right: auto;
    }

    .preview-toggle:hover {
      background: var(--vscode-button-secondaryHoverBackground, #454545);
    }

    .preview-toggle.active {
      background: var(--vscode-button-background, #0e639c);
      border-color: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
    }

    .preview-toggle .toggle-icon {
      font-size: 12px;
    }

    .split-container {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .split-container .main-content {
      flex: 1 !important;
      min-width: 0;
      max-width: 100% !important;
    }

    /* Preview panel removed - main content always 100% */
    .split-container.preview-active .main-content {
      flex: 1 !important;
    }

    /* Preview styles kept for compatibility but panel is hidden */
    .preview-header {
      display: none;
      flex-direction: column;
      padding: 12px;
      border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
      background: var(--vscode-titleBar-activeBackground, #1e1e1e);
    }

    .preview-title {
      font-weight: 600;
      font-size: 13px;
      color: var(--vscode-foreground);
    }

    .preview-hint {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #888);
      margin-top: 2px;
    }

    .preview-canvas {
      flex: 1;
      position: relative;
      overflow: auto;
      /* Figma/Linear style - dark with subtle dot grid */
      background: #0d0d0d;
      background-image:
        radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.03) 1px, transparent 0);
      background-size: 24px 24px;
      padding: 32px;
    }

    /* Building Animation Overlay */
    .building-overlay {
      position: absolute;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.7);
      z-index: 10;
    }

    .building-overlay.active {
      display: flex;
    }

    .building-animation {
      text-align: center;
      color: var(--vscode-foreground);
    }

    .blueprint-grid {
      width: 120px;
      height: 80px;
      margin: 0 auto 16px;
      border: 2px solid var(--vscode-button-background, #0e639c);
      border-radius: 8px;
      position: relative;
      overflow: hidden;
      animation: blueprintPulse 2s ease-in-out infinite;
    }

    .blueprint-grid::before,
    .blueprint-grid::after {
      content: '';
      position: absolute;
      background: var(--vscode-button-background, #0e639c);
      opacity: 0.3;
    }

    .blueprint-grid::before {
      width: 100%;
      height: 1px;
      top: 50%;
      animation: scanLine 1.5s ease-in-out infinite;
    }

    .blueprint-grid::after {
      width: 1px;
      height: 100%;
      left: 50%;
      animation: scanLine 1.5s ease-in-out infinite 0.75s;
    }

    @keyframes blueprintPulse {
      0%, 100% { transform: scale(1); opacity: 0.8; }
      50% { transform: scale(1.02); opacity: 1; }
    }

    @keyframes scanLine {
      0% { opacity: 0.1; }
      50% { opacity: 0.5; }
      100% { opacity: 0.1; }
    }

    .building-text {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .building-dots {
      display: flex;
      gap: 4px;
      justify-content: center;
    }

    .building-dots span {
      width: 6px;
      height: 6px;
      background: var(--vscode-button-background, #0e639c);
      border-radius: 50%;
      animation: buildingDot 1.4s ease-in-out infinite;
    }

    .building-dots span:nth-child(2) { animation-delay: 0.2s; }
    .building-dots span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes buildingDot {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* Preview Nodes - Vertical Cascade Mind Map */
    .preview-nodes {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 24px;
      min-height: 100%;
      padding-bottom: 40px;
    }

    .preview-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .preview-section-title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground, #888);
      padding: 0 4px;
      margin-bottom: 4px;
    }

    .preview-section-nodes {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    /* Figma/Linear Style Nodes */
    .preview-node {
      position: relative;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
      background: rgba(30, 30, 30, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow:
        0 4px 24px rgba(0, 0, 0, 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.03);
      cursor: pointer;
      opacity: 0;
      transform: translateY(10px) scale(0.95);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      user-select: none;
      backdrop-filter: blur(8px);
      color: rgba(255, 255, 255, 0.9);
    }

    .preview-node.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    .preview-node:hover {
      background: rgba(40, 40, 40, 0.95);
      border-color: rgba(255, 255, 255, 0.15);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.08);
      transform: translateY(-2px) scale(1.02);
    }

    .preview-node.selected {
      border-color: #6366f1;
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.5),
        0 0 0 2px rgba(99, 102, 241, 0.4),
        0 0 24px rgba(99, 102, 241, 0.15);
    }

    .preview-node .node-icon {
      margin-right: 8px;
      font-size: 14px;
    }

    .preview-node .node-label {
      font-weight: 600;
      display: block;
      letter-spacing: 0.2px;
    }

    .preview-node .node-name {
      font-size: 11px;
      opacity: 0.5;
      display: block;
      margin-top: 3px;
      font-weight: 400;
    }

    /* Node Action Buttons */
    .node-actions {
      position: absolute;
      top: -8px;
      right: -8px;
      display: none;
      gap: 4px;
      z-index: 10;
    }

    .preview-node:hover .node-actions,
    .preview-node.selected .node-actions {
      display: flex;
    }

    .node-action-btn {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    .node-action-btn.generate {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
    }

    .node-action-btn.generate:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5);
    }

    .node-action-btn.edit {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #fff);
    }

    .node-action-btn.edit:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }

    /* Health Indicators */
    .node-health {
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 3px;
    }

    .health-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.3);
      cursor: help;
    }

    .health-indicator.warning {
      background: #f59e0b;
      animation: healthPulse 2s infinite;
    }

    .health-indicator.error {
      background: #ef4444;
      animation: healthPulse 1.5s infinite;
    }

    .health-indicator.success {
      background: #22c55e;
    }

    @keyframes healthPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.9); }
    }

    /* Selected node state */
    .preview-node.selected {
      box-shadow: 0 0 0 3px var(--vscode-focusBorder, #007fd4), 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    /* Tooltip Popup - Modern dark style */
    .preview-tooltip {
      position: fixed;
      max-width: 280px;
      padding: 14px 18px;
      background: rgba(20, 20, 20, 0.98);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.9);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.6),
        0 0 0 1px rgba(255, 255, 255, 0.05);
      z-index: 1000;
      pointer-events: none;
      opacity: 0;
      transform: translateY(4px);
      transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(16px);
    }

    .preview-tooltip.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .preview-tooltip-title {
      font-weight: 600;
      margin-bottom: 8px;
      color: #fff;
      font-size: 14px;
    }

    .preview-tooltip-desc {
      color: rgba(255, 255, 255, 0.6);
      font-size: 12px;
      line-height: 1.6;
    }

    /* Node type colors - Dark theme with colored accents */
    .preview-node[data-type="page"] {
      border-left: 3px solid #3b82f6;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(59, 130, 246, 0.05);
    }
    .preview-node[data-type="page"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(59, 130, 246, 0.15); }

    .preview-node[data-type="component"] {
      border-left: 3px solid #22c55e;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(34, 197, 94, 0.05);
    }
    .preview-node[data-type="component"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(34, 197, 94, 0.15); }

    .preview-node[data-type="api"] {
      border-left: 3px solid #f59e0b;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(245, 158, 11, 0.05);
    }
    .preview-node[data-type="api"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(245, 158, 11, 0.15); }

    .preview-node[data-type="database"] {
      border-left: 3px solid #ec4899;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(236, 72, 153, 0.05);
    }
    .preview-node[data-type="database"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(236, 72, 153, 0.15); }

    .preview-node[data-type="type"] {
      border-left: 3px solid #6366f1;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(99, 102, 241, 0.05);
    }
    .preview-node[data-type="type"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.15); }

    .preview-node[data-type="service"] {
      border-left: 3px solid #14b8a6;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(20, 184, 166, 0.05);
    }
    .preview-node[data-type="service"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(20, 184, 166, 0.15); }

    .preview-node[data-type="middleware"] {
      border-left: 3px solid #f97316;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(249, 115, 22, 0.05);
    }
    .preview-node[data-type="middleware"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(249, 115, 22, 0.15); }

    .preview-node[data-type="hook"] {
      border-left: 3px solid #a855f7;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(168, 85, 247, 0.05);
    }
    .preview-node[data-type="hook"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(168, 85, 247, 0.15); }

    .preview-node[data-type="context"] {
      border-left: 3px solid #06b6d4;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(6, 182, 212, 0.05);
    }
    .preview-node[data-type="context"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(6, 182, 212, 0.15); }

    .preview-node[data-type="action"] {
      border-left: 3px solid #ef4444;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(239, 68, 68, 0.05);
    }
    .preview-node[data-type="action"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.15); }

    .preview-node[data-type="job"] {
      border-left: 3px solid #6b7280;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(107, 114, 128, 0.05);
    }
    .preview-node[data-type="job"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(107, 114, 128, 0.15); }

    /* Preview Edges (SVG) - Modern glowing connection lines */
    .preview-edges {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 1;
      overflow: visible;
    }

    .preview-edge {
      fill: none;
      stroke-width: 1.5;
      opacity: 0;
      stroke-linecap: round;
      stroke-linejoin: round;
      transition: opacity 0.4s ease, stroke-width 0.2s ease, filter 0.2s ease;
    }

    .preview-edge.visible {
      opacity: 0.6;
      animation: fadeInEdge 0.6s ease forwards;
    }

    .preview-edge.renders { stroke: #3b82f6; filter: drop-shadow(0 0 3px rgba(59, 130, 246, 0.4)); }
    .preview-edge.calls { stroke: #f59e0b; filter: drop-shadow(0 0 3px rgba(245, 158, 11, 0.4)); }
    .preview-edge.uses { stroke: #a855f7; filter: drop-shadow(0 0 3px rgba(168, 85, 247, 0.4)); }
    .preview-edge.queries { stroke: #ec4899; filter: drop-shadow(0 0 3px rgba(236, 72, 153, 0.4)); }
    .preview-edge.default { stroke: rgba(255, 255, 255, 0.2); }

    .preview-edge:hover {
      stroke-width: 3;
      opacity: 1;
      filter: drop-shadow(0 0 8px currentColor);
    }

    /* Edge Explanation Tooltip */
    .edge-explanation-tooltip {
      animation: tooltipFadeIn 0.2s ease;
    }

    .edge-explanation-title {
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--vscode-foreground);
    }

    .edge-explanation-desc {
      color: var(--vscode-descriptionForeground, #999);
      line-height: 1.5;
    }

    @keyframes tooltipFadeIn {
      from { opacity: 0; transform: translate(-50%, -100%) translateY(10px); }
      to { opacity: 1; transform: translate(-50%, -100%); }
    }

    /* Connection dots at endpoints */
    .edge-dot {
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .edge-dot.visible {
      opacity: 0.8;
    }

    .edge-dot.renders { fill: #3b82f6; }
    .edge-dot.calls { fill: #f59e0b; }
    .edge-dot.uses { fill: #a855f7; }
    .edge-dot.queries { fill: #ec4899; }
    .edge-dot.default { fill: #6b7280; }

    @keyframes fadeInEdge {
      from { opacity: 0; }
      to { opacity: 0.5; }
    }

    /* Connection Legend - minimal dark style */
    .connection-legend {
      position: absolute;
      bottom: 16px;
      right: 16px;
      display: none;
      gap: 16px;
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.4);
      z-index: 10;
      backdrop-filter: blur(8px);
    }

    .connection-legend.visible {
      display: flex;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .legend-line {
      width: 20px;
      height: 2px;
      border-radius: 1px;
      box-shadow: 0 0 6px currentColor;
    }

    .legend-line.renders { background: #3b82f6; color: #3b82f6; }
    .legend-line.calls { background: #f59e0b; color: #f59e0b; }
    .legend-line.uses { background: #a855f7; color: #a855f7; }

    /* AI Suggestions Panel */
    .suggestions-panel {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 240px;
      max-height: 300px;
      background: var(--vscode-editor-background, #1e1e1e);
      border: 1px solid var(--vscode-panel-border, #333);
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      z-index: 20;
      overflow: hidden;
      display: none;
    }

    .suggestions-panel.visible {
      display: block;
      animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .suggestions-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid var(--vscode-panel-border, #333);
      background: var(--vscode-titleBar-activeBackground, #252526);
    }

    .suggestions-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-foreground);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .suggestions-close {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      font-size: 14px;
      padding: 2px;
    }

    .suggestions-close:hover {
      color: var(--vscode-foreground);
    }

    .suggestions-list {
      padding: 8px;
      max-height: 220px;
      overflow-y: auto;
    }

    .suggestion-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s ease;
      margin-bottom: 6px;
    }

    .suggestion-item:last-child {
      margin-bottom: 0;
    }

    .suggestion-item:hover {
      background: var(--vscode-list-hoverBackground, #2a2d2e);
    }

    .suggestion-icon {
      font-size: 18px;
      flex-shrink: 0;
    }

    .suggestion-content {
      flex: 1;
      min-width: 0;
    }

    .suggestion-name {
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-foreground);
      margin-bottom: 2px;
    }

    .suggestion-reason {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #888);
      line-height: 1.4;
    }

    .suggestion-add {
      font-size: 16px;
      color: var(--vscode-button-background, #0e639c);
      flex-shrink: 0;
    }

    /* Templates Gallery */
    .templates-gallery {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      max-height: 500px;
      background: var(--vscode-editor-background, #1e1e1e);
      border: 1px solid var(--vscode-panel-border, #333);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      z-index: 100;
      display: none;
      overflow: hidden;
    }

    .templates-gallery.visible {
      display: block;
      animation: scaleIn 0.2s ease;
    }

    @keyframes scaleIn {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    .templates-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-bottom: 1px solid var(--vscode-panel-border, #333);
    }

    .templates-title {
      font-size: 14px;
      font-weight: 600;
    }

    .templates-close {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      font-size: 18px;
    }

    .templates-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      padding: 16px;
      max-height: 400px;
      overflow-y: auto;
    }

    .template-card {
      background: var(--vscode-input-background, #3c3c3c);
      border: 1px solid var(--vscode-panel-border, #555);
      border-radius: 8px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .template-card:hover {
      border-color: var(--vscode-button-background, #0e639c);
      transform: translateY(-2px);
    }

    .template-icon {
      font-size: 24px;
      margin-bottom: 8px;
    }

    .template-name {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .template-desc {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }

    /* Progress Stats (bottom of canvas) */
    .canvas-stats {
      position: absolute;
      bottom: 12px;
      left: 12px;
      display: flex;
      gap: 16px;
      background: var(--vscode-editor-background, #1e1e1e);
      border: 1px solid var(--vscode-panel-border, #333);
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      z-index: 10;
    }

    .canvas-stat {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .canvas-stat-value {
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    /* Keyboard hints - minimal dark style */
    .keyboard-hints {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 16px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.35);
      background: rgba(0, 0, 0, 0.4);
      padding: 8px 16px;
      border-radius: 8px;
      backdrop-filter: blur(8px);
    }

    .kbd {
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', Monaco, monospace;
      margin-right: 6px;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* Empty State - elegant dark */
    .preview-empty {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.4);
    }

    .preview-empty.hidden {
      display: none;
    }

    .empty-icon {
      font-size: 56px;
      margin-bottom: 16px;
      opacity: 0.3;
    }

    .empty-text {
      font-size: 14px;
      text-align: center;
      max-width: 240px;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.4);
    }
  </style>
</head>
<body>
  <!-- Toast Container for auto-applied files -->
  <div class="toast-container" id="toastContainer"></div>

  <div class="header">
    <svg class="header-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4 L10 12 L4 20 L8 20 L12 14 L16 20 L20 20 L14 12 L20 4 L16 4 L12 10 L8 4 Z"/>
    </svg>
    <span class="header-title">CodeBakers</span>
    <span class="plan-badge" id="planBadge">Pro</span>
    <button class="header-btn" id="clearBtn">Clear</button>
  </div>

  <div class="session-stats" id="sessionStats">
    <div class="stat">
      <span class="stat-label">Requests:</span>
      <span class="stat-value" id="statRequests">0</span>
    </div>
    <div class="stat">
      <span class="stat-label">Tokens:</span>
      <span class="stat-value" id="statTokens">0</span>
    </div>
    <div class="stat">
      <span class="stat-label">Session Cost:</span>
      <span class="stat-value cost" id="statCost">$0.0000</span>
    </div>
    <div class="stat">
      <span class="stat-label">Time:</span>
      <span class="stat-value" id="statTime">0m</span>
    </div>
    <button class="reset-btn" id="resetStatsBtn" title="Reset session stats">\u21BA Reset</button>
  </div>

  <div class="login-prompt" id="loginPrompt">
    <div class="welcome-icon">\u{1F510}</div>
    <div class="welcome-title">Sign in to CodeBakers</div>
    <div class="welcome-text">Connect with GitHub to start your free trial.</div>
    <button class="login-btn" id="loginBtn">Sign in with GitHub</button>
  </div>

  <div class="split-container" id="splitContainer">
    <div class="main-content" id="mainContent">
      <div class="messages" id="messages">
      <div class="welcome" id="welcome">
        <div class="welcome-icon">\u{1F36A}</div>
        <div class="welcome-title">What would you like to build?</div>
        <div class="welcome-text">Describe your idea in plain English, or drop files below to get started.</div>

        <!-- File Upload Zone -->
        <div class="file-upload-zone" id="fileUploadZone">
          <div class="file-upload-icon">\u{1F4C4}</div>
          <div class="file-upload-text">
            <span class="file-upload-main">Drop PRD, specs, or mockups here</span>
            <span class="file-upload-sub">or <button class="file-browse-btn" id="fileBrowseBtn">browse files</button></span>
          </div>
          <div class="file-upload-formats">PDF, TXT, MD, PNG, JPG supported</div>
          <input type="file" id="fileInput" multiple accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.doc,.docx" style="display: none;" />
        </div>

        <!-- Uploaded Files List -->
        <div class="uploaded-files" id="uploadedFiles" style="display: none;">
          <div class="uploaded-files-header">
            <span>\u{1F4CE} Attached files</span>
            <button class="clear-uploads-btn" id="clearUploadsBtn">Clear all</button>
          </div>
          <div class="uploaded-files-list" id="uploadedFilesList"></div>
        </div>

        <div class="getting-started">
          <div class="getting-started-title">How it works</div>
          <div class="getting-started-items">
            <div class="getting-started-item">
              <span class="item-icon">\u{1F4AC}</span>
              <span class="item-text">Tell me what you need - I'll write the code</span>
            </div>
            <div class="getting-started-item">
              <span class="item-icon">\u2728</span>
              <span class="item-text">Changes apply automatically - undo anytime!</span>
            </div>
            <div class="getting-started-item">
              <span class="item-icon">\u{1F4C4}</span>
              <span class="item-text">Upload PRD or specs for better context</span>
            </div>
            <div class="getting-started-item">
              <span class="item-icon">\u{1F9EA}</span>
              <span class="item-text">Tests and type-checking run automatically</span>
            </div>
          </div>
          <div class="getting-started-examples">
            <div class="examples-label">Try saying:</div>
            <div class="example-chip">"Build me a SaaS dashboard"</div>
            <div class="example-chip">"Add user authentication"</div>
            <div class="example-chip">"Create an API for invoices"</div>
          </div>
        </div>
      </div>

      <div class="streaming-indicator" id="streaming">
        <div class="thinking-label">
          <span class="thinking-icon">\u{1F36A}</span>
          <span class="thinking-title">CodeBakers Tip:</span>
          <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
        <div class="thinking-tip" id="thinkingTip">Just describe what you want in plain English!</div>
        <div id="streamingContent" style="display: none;"></div>
      </div>

    </div>
    </div>
  </div>

  <!-- Pinned Files Section (Cursor-style context) -->
  <div class="pinned-files" id="pinnedFiles">
    <div class="pinned-header">
      <div class="pinned-title">
        <span>\u{1F4CE} Context Files</span>
        <span class="pinned-count" id="pinnedCount">0</span>
      </div>
      <div class="pinned-actions">
        <button class="pinned-btn" id="clearPinnedBtn">Clear</button>
        <button class="pinned-btn add" id="addPinnedBtn">+ Add</button>
      </div>
    </div>
    <div class="pinned-list" id="pinnedList"></div>
  </div>

  <!-- Team Notes Section (shared project context for team) -->
  <div class="team-notes" id="teamNotes">
    <div class="team-notes-header">
      <div class="team-notes-title">
        <span>\u{1F465} Team Notes</span>
        <span class="team-notes-hint">(shared with team)</span>
      </div>
      <div class="team-notes-actions">
        <button class="team-btn" id="saveTeamNotesBtn">Save</button>
      </div>
    </div>
    <textarea class="team-notes-input" id="teamNotesInput" placeholder="Add shared notes, decisions, or context for your team..."></textarea>
  </div>

  <!-- Add Files Button (shown when no files pinned) -->
  <div class="add-files-hint" id="addFilesHint">
    <button class="add-files-btn" id="addFilesBtn">
      <span>\u{1F4CE}</span>
      <span>Add files to context (always included in chat)</span>
    </button>
  </div>

  <!-- Persistent Action Bar -->
  <div class="action-bar">
    <button class="action-btn" data-action="/audit">\u{1F50D} Audit</button>
    <button class="action-btn" data-action="/test">\u{1F9EA} Test</button>
    <button class="action-btn" data-action="/fix">\u{1F527} Fix</button>
    <button class="action-btn mindmap" data-action="/mindmap">\u{1F5FA}\uFE0F Map</button>
    <button class="action-btn github" data-action="/git-push">\u{1F4E4} Push</button>
    <button class="action-btn deploy" data-action="/deploy">\u{1F680} Deploy</button>
    <button class="action-btn preview" data-action="/preview" title="Open app in browser">\u{1F441}\uFE0F Preview</button>
  </div>

  <div class="input-area">
    <textarea
      id="input"
      placeholder="Ask CodeBakers anything..."
      rows="1"
    ></textarea>
    <button class="voice-btn" id="voiceBtn" title="Voice input (click to speak)">\u{1F3A4}</button>
    <button class="send-btn" id="sendBtn">Send</button>
    <button class="cancel-btn" id="cancelBtn">Cancel</button>
  </div>
  <div class="voice-status" id="voiceStatus">Listening...</div>

  <script>
    console.log('CodeBakers: Script starting...');
    try {
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const welcomeEl = document.getElementById('welcome');
    const loginPromptEl = document.getElementById('loginPrompt');
    const mainContentEl = document.getElementById('mainContent');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const streamingEl = document.getElementById('streaming');
    const streamingContentEl = document.getElementById('streamingContent');
    const pendingPanel = document.getElementById('pendingPanel');
    const pendingList = document.getElementById('pendingList');
    const pendingCount = document.getElementById('pendingCount');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const pinnedFilesEl = document.getElementById('pinnedFiles');
    const pinnedListEl = document.getElementById('pinnedList');
    const pinnedCountEl = document.getElementById('pinnedCount');
    const addFilesHint = document.getElementById('addFilesHint');

    // Live Preview elements
    const previewToggleBtn = document.getElementById('previewToggle');
    const splitContainer = document.getElementById('splitContainer');
    const previewPanel = document.getElementById('previewPanel');
    const buildingOverlay = document.getElementById('buildingOverlay');
    const previewNodes = document.getElementById('previewNodes');
    const previewEdges = document.getElementById('previewEdges');
    const previewEmpty = document.getElementById('previewEmpty');
    const previewCanvas = document.getElementById('previewCanvas');

    // Canvas Mode elements
    const canvasModeBtn = document.getElementById('canvasModeBtn');
    const classicModeBtn = document.getElementById('classicModeBtn');
    const pendingBadge = document.getElementById('pendingBadge');
    const pendingBadgeCount = document.getElementById('pendingBadgeCount');
    const pendingOverlay = document.getElementById('pendingOverlay');
    const pendingSlideout = document.getElementById('pendingSlideout');
    const pendingSlideoutCount = document.getElementById('pendingSlideoutCount');
    const pendingSlideoutContent = document.getElementById('pendingSlideoutContent');
    const pendingSlideoutClose = document.getElementById('pendingSlideoutClose');
    const slideoutAcceptAll = document.getElementById('slideoutAcceptAll');
    const slideoutRejectAll = document.getElementById('slideoutRejectAll');
    const aiResponseBar = document.getElementById('aiResponseBar');
    const aiResponseHeader = document.getElementById('aiResponseHeader');
    const aiResponseStatus = document.getElementById('aiResponseStatus');
    const aiResponseSummary = document.getElementById('aiResponseSummary');
    const aiResponseToggle = document.getElementById('aiResponseToggle');
    const aiResponseContent = document.getElementById('aiResponseContent');
    const aiResponseText = document.getElementById('aiResponseText');
    const canvasChatInput = document.getElementById('canvasChatInput');
    const canvasInput = document.getElementById('canvasInput');
    const canvasInputContext = document.getElementById('canvasInputContext');
    const canvasSendBtn = document.getElementById('canvasSendBtn');
    const canvasVoiceBtn = document.getElementById('canvasVoiceBtn');

    // Onboarding elements
    const onboardingContainer = document.getElementById('onboardingContainer');
    const onboardingContent = document.getElementById('onboardingContent');
    let onboardingActive = false;

    // Onboarding action handler (global function for onclick)
    window.handleOnboarding = function(action, data) {
      vscode.postMessage({
        type: 'onboarding-action',
        action: action,
        data: data || {}
      });
    };

    // Pre-Flight Impact Check elements
    const preflightPanel = document.getElementById('preflightPanel');
    const preflightFiles = document.getElementById('preflightFiles');
    const preflightWarnings = document.getElementById('preflightWarnings');
    const preflightWarningText = document.getElementById('preflightWarningText');
    const preflightProceed = document.getElementById('preflightProceed');
    const preflightCancel = document.getElementById('preflightCancel');

    let currentMessages = [];
    let currentChanges = [];
    let currentCommands = [];
    let currentPinnedFiles = [];
    let isStreaming = false;

    // CodeBakers Tips - shown during thinking
    const codeBakersTips = [
      "Just describe what you want in plain English!",
      "Say 'add a login page' - I'll handle the rest.",
      "Changes auto-apply by default. You can undo anytime!",
      "I write tests for everything automatically.",
      "All code follows production-ready patterns.",
      "Try: 'Fix the TypeScript errors' - I'll find and fix them.",
      "Pin files for context - they're included in every message.",
      "Say 'review my code' for a quality audit.",
      "I can clone designs from screenshots or URLs!",
      "Every feature gets proper error handling.",
      "Say 'deploy' when you're ready to ship!",
      "I run TypeScript checks after every change.",
      "Try: 'Add dark mode' - I'll wire it all up.",
      "All database queries use safe, typed patterns.",
      "Say 'add tests' and I'll create comprehensive tests.",
      "I preserve your existing code style.",
      "Authentication? Payments? Just ask!",
      "Your project state is saved - I remember context.",
      "Try: 'Optimize this' for performance improvements.",
      "I follow your stack - no random rewrites!"
    ];
    let tipIndex = 0;
    let tipInterval = null;
    const thinkingTipEl = document.getElementById('thinkingTip');

    function startTipCycling() {
      tipIndex = Math.floor(Math.random() * codeBakersTips.length);
      if (thinkingTipEl) thinkingTipEl.textContent = codeBakersTips[tipIndex];
      tipInterval = setInterval(() => {
        tipIndex = (tipIndex + 1) % codeBakersTips.length;
        if (thinkingTipEl) {
          thinkingTipEl.style.animation = 'none';
          thinkingTipEl.offsetHeight; // Force reflow
          thinkingTipEl.style.animation = 'tipFade 0.3s ease-in-out';
          thinkingTipEl.textContent = codeBakersTips[tipIndex];
        }
      }, 4000); // Change tip every 4 seconds
    }

    function stopTipCycling() {
      if (tipInterval) {
        clearInterval(tipInterval);
        tipInterval = null;
      }
    }

    // =========================================
    // File Upload Handlers (PRD, specs, mockups)
    // =========================================
    const fileUploadZone = document.getElementById('fileUploadZone');
    const fileInput = document.getElementById('fileInput');
    const fileBrowseBtn = document.getElementById('fileBrowseBtn');
    const uploadedFilesEl = document.getElementById('uploadedFiles');
    const uploadedFilesList = document.getElementById('uploadedFilesList');
    const clearUploadsBtn = document.getElementById('clearUploadsBtn');

    let uploadedContextFiles = []; // Store uploaded file data

    // File type icons
    function getFileIcon(filename) {
      const ext = filename.split('.').pop().toLowerCase();
      const icons = {
        'pdf': '\u{1F4D5}',
        'doc': '\u{1F4D8}',
        'docx': '\u{1F4D8}',
        'txt': '\u{1F4C4}',
        'md': '\u{1F4DD}',
        'png': '\u{1F5BC}\uFE0F',
        'jpg': '\u{1F5BC}\uFE0F',
        'jpeg': '\u{1F5BC}\uFE0F'
      };
      return icons[ext] || '\u{1F4C4}';
    }

    // Format file size
    function formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // Handle file selection
    async function handleFiles(files) {
      for (const file of files) {
        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          console.warn('File too large:', file.name);
          continue;
        }

        // Check if file already uploaded
        if (uploadedContextFiles.find(f => f.name === file.name)) {
          continue;
        }

        try {
          const content = await readFileContent(file);
          uploadedContextFiles.push({
            name: file.name,
            size: file.size,
            type: file.type,
            content: content
          });
        } catch (err) {
          console.error('Failed to read file:', file.name, err);
        }
      }
      renderUploadedFiles();
    }

    // Read file content
    function readFileContent(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (file.type.startsWith('image/')) {
            // For images, store base64
            resolve(reader.result);
          } else {
            // For text files, store text
            resolve(reader.result);
          }
        };
        reader.onerror = reject;

        if (file.type.startsWith('image/')) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });
    }

    // Render uploaded files list
    function renderUploadedFiles() {
      if (!uploadedFilesList || !uploadedFilesEl) return;

      if (uploadedContextFiles.length === 0) {
        uploadedFilesEl.style.display = 'none';
        return;
      }

      uploadedFilesEl.style.display = 'block';
      uploadedFilesList.innerHTML = uploadedContextFiles.map((file, index) => \`
        <div class="uploaded-file-item" data-index="\${index}">
          <span class="uploaded-file-icon">\${getFileIcon(file.name)}</span>
          <span class="uploaded-file-name">\${file.name}</span>
          <span class="uploaded-file-size">\${formatFileSize(file.size)}</span>
          <button class="remove-file-btn" onclick="removeUploadedFile(\${index})">\xD7</button>
        </div>
      \`).join('');
    }

    // Remove uploaded file
    window.removeUploadedFile = function(index) {
      uploadedContextFiles.splice(index, 1);
      renderUploadedFiles();
    };

    // Get uploaded files context for message
    function getUploadedFilesContext() {
      if (uploadedContextFiles.length === 0) return '';

      let context = '\\n\\n--- ATTACHED FILES ---\\n';
      for (const file of uploadedContextFiles) {
        if (file.type.startsWith('image/')) {
          context += \`\\n[Image: \${file.name}]\\n\`;
          // Image will be sent separately
        } else {
          context += \`\\n### \${file.name}\\n\${file.content}\\n\`;
        }
      }
      return context;
    }

    // Drag and drop handlers
    if (fileUploadZone) {
      fileUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadZone.classList.add('drag-over');
      });

      fileUploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        fileUploadZone.classList.remove('drag-over');
      });

      fileUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
          handleFiles(e.dataTransfer.files);
        }
      });

      fileUploadZone.addEventListener('click', () => {
        if (fileInput) fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          handleFiles(e.target.files);
        }
      });
    }

    if (fileBrowseBtn) {
      fileBrowseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (fileInput) fileInput.click();
      });
    }

    if (clearUploadsBtn) {
      clearUploadsBtn.addEventListener('click', () => {
        uploadedContextFiles = [];
        renderUploadedFiles();
      });
    }

    // Live Preview state
    let previewEnabled = true;
    let previewNodesData = [];
    let previewEdgesData = [];

    // Canvas Mode state
    let isCanvasMode = true; // Default to canvas mode
    let selectedNodeId = null;
    let aiResponseExpanded = false;

    // Session stats elements
    const statRequestsEl = document.getElementById('statRequests');
    const statTokensEl = document.getElementById('statTokens');
    const statCostEl = document.getElementById('statCost');
    const statTimeEl = document.getElementById('statTime');
    const resetStatsBtn = document.getElementById('resetStatsBtn');

    // Session stats tracking
    let sessionStats = {
      requests: 0,
      tokens: 0,
      cost: 0,
      startTime: Date.now(),
      activeTime: 0, // in milliseconds
      lastActivity: Date.now(),
      isActive: true
    };

    // Activity detection constants
    const IDLE_THRESHOLD = 5 * 60 * 1000; // 5 minutes of no activity = idle
    const ACTIVITY_CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds

    // Update session time every minute
    setInterval(() => {
      updateSessionTime();
    }, 60000);

    // Activity detection - pause timer when user is idle
    setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - sessionStats.lastActivity;

      if (timeSinceActivity > IDLE_THRESHOLD && sessionStats.isActive) {
        // User went idle
        sessionStats.isActive = false;
        if (statTimeEl) {
          statTimeEl.style.opacity = '0.5'; // Dim to show idle
          statTimeEl.title = 'Timer paused (idle)';
        }
      }
    }, ACTIVITY_CHECK_INTERVAL);

    // Track user activity
    function recordActivity() {
      const now = Date.now();
      if (!sessionStats.isActive) {
        // User came back from idle
        sessionStats.isActive = true;
        if (statTimeEl) {
          statTimeEl.style.opacity = '1';
          statTimeEl.title = '';
        }
      } else {
        // Add active time since last activity (capped at reasonable amount)
        const timeDiff = Math.min(now - sessionStats.lastActivity, IDLE_THRESHOLD);
        sessionStats.activeTime += timeDiff;
      }
      sessionStats.lastActivity = now;
    }

    // Register activity on user interactions
    if (inputEl) {
      inputEl.addEventListener('input', recordActivity);
      inputEl.addEventListener('focus', recordActivity);
    }
    document.addEventListener('click', recordActivity);
    document.addEventListener('keydown', recordActivity);

    // Toggle collapsible code blocks
    function toggleCodeBlock(blockId) {
      const block = document.getElementById(blockId);
      if (block) {
        block.classList.toggle('collapsed');
      }
    }
    // Make toggleCodeBlock globally accessible for onclick handlers
    window.toggleCodeBlock = toggleCodeBlock;

    // Pre-Flight Impact Check logic
    let pendingPreflightMessage = null;

    function isCodeRelatedRequest(message) {
      const codeKeywords = [
        'add', 'create', 'build', 'implement', 'fix', 'update', 'change',
        'modify', 'write', 'edit', 'refactor', 'delete', 'remove',
        'feature', 'component', 'page', 'api', 'route', 'function',
        'button', 'form', 'modal', 'table', 'chart', 'endpoint',
        'style', 'css', 'layout', 'design'
      ];
      const messageLower = message.toLowerCase();
      return codeKeywords.some(keyword => messageLower.includes(keyword));
    }

    function showPreflightPanel(message, impactData) {
      if (!preflightPanel || !preflightFiles) return;

      // Clear previous content
      preflightFiles.innerHTML = '';

      // Show affected files
      if (impactData && impactData.files && impactData.files.length > 0) {
        impactData.files.forEach(file => {
          const fileEl = document.createElement('span');
          fileEl.className = 'preflight-file' + (file.impact ? ' ' + file.impact + '-impact' : '');
          fileEl.textContent = file.name || file;
          preflightFiles.appendChild(fileEl);
        });
      } else {
        // Show placeholder based on message analysis
        const placeholderFiles = analyzeMessageForFiles(message);
        placeholderFiles.forEach(file => {
          const fileEl = document.createElement('span');
          fileEl.className = 'preflight-file';
          fileEl.textContent = file;
          preflightFiles.appendChild(fileEl);
        });
      }

      // Show warnings if any
      if (impactData && impactData.warning) {
        preflightWarnings.style.display = 'block';
        preflightWarningText.textContent = impactData.warning;
      } else {
        preflightWarnings.style.display = 'none';
      }

      preflightPanel.classList.add('show');
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function analyzeMessageForFiles(message) {
      const files = [];
      const msgLower = message.toLowerCase();

      // Detect common patterns and suggest likely files
      if (msgLower.includes('api') || msgLower.includes('endpoint') || msgLower.includes('route')) {
        files.push('src/app/api/...');
      }
      if (msgLower.includes('page') || msgLower.includes('component')) {
        files.push('src/app/...');
        files.push('src/components/...');
      }
      if (msgLower.includes('database') || msgLower.includes('schema') || msgLower.includes('table')) {
        files.push('src/lib/db/schema.ts');
      }
      if (msgLower.includes('auth') || msgLower.includes('login')) {
        files.push('src/lib/auth.ts');
      }
      if (msgLower.includes('style') || msgLower.includes('css')) {
        files.push('*.css / *.module.css');
      }

      // Default if nothing detected
      if (files.length === 0) {
        files.push('Files will be analyzed...');
      }

      return files;
    }

    function hidePreflightPanel() {
      if (preflightPanel) {
        preflightPanel.classList.remove('show');
      }
      pendingPreflightMessage = null;
    }

    function proceedWithMessage() {
      if (pendingPreflightMessage) {
        const message = pendingPreflightMessage;
        hidePreflightPanel();
        actualSendMessage(message);
      }
    }

    // Pre-flight button handlers
    if (preflightProceed) {
      preflightProceed.addEventListener('click', proceedWithMessage);
    }
    if (preflightCancel) {
      preflightCancel.addEventListener('click', hidePreflightPanel);
    }

    // Ripple Check - show coherence results after code changes
    function showRippleCheck(data) {
      if (!messagesEl) return;

      // Determine status
      const status = data.errors > 0 ? 'error' : (data.warnings > 0 ? 'warning' : 'success');
      const statusIcons = {
        success: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.78 5.28l-4.5 6a.75.75 0 0 1-1.06.06l-2.5-2.25a.75.75 0 1 1 1.01-1.11l1.94 1.74 4-5.33a.75.75 0 0 1 1.17.94z"/></svg>',
        warning: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 14h14L8 1zm0 4v4h.01V5H8zm0 6v1h.01v-1H8z"/></svg>',
        error: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.5 10.44L10.44 11.5 8 9.06 5.56 11.5 4.5 10.44 6.94 8 4.5 5.56 5.56 4.5 8 6.94l2.44-2.44 1.06 1.06L9.06 8l2.44 2.44z"/></svg>'
      };
      const statusText = {
        success: 'Coherence Check Passed',
        warning: 'Coherence Check: ' + data.warnings + ' warning(s)',
        error: 'Coherence Check Failed: ' + data.errors + ' error(s)'
      };

      // Create ripple panel element
      const rippleEl = document.createElement('div');
      rippleEl.className = 'ripple-panel ' + status;
      rippleEl.innerHTML = '<div class="ripple-header">' +
        statusIcons[status] +
        '<span>' + statusText[status] + '</span>' +
      '</div>' +
      (data.details && data.details.length > 0 ?
        '<div class="ripple-details">' +
          data.details.map(d =>
            '<div class="ripple-item ' + (d.type === 'error' ? 'fail' : 'pass') + '">' +
              (d.type === 'error' ? '\u2717' : '\u2713') + ' ' + d.message +
            '</div>'
          ).join('') +
        '</div>' : '');

      // Add to messages
      messagesEl.appendChild(rippleEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      // Auto-remove success messages after 5 seconds
      if (status === 'success') {
        setTimeout(() => {
          rippleEl.style.opacity = '0';
          rippleEl.style.transition = 'opacity 0.3s ease';
          setTimeout(() => rippleEl.remove(), 300);
        }, 5000);
      }
    }

    function updateSessionTime() {
      // Calculate total elapsed and active time
      const totalElapsed = Date.now() - sessionStats.startTime;

      // If user is currently active, add time since last activity to active time
      let displayActiveTime = sessionStats.activeTime;
      if (sessionStats.isActive) {
        displayActiveTime += Math.min(Date.now() - sessionStats.lastActivity, IDLE_THRESHOLD);
      }

      const activeMinutes = Math.floor(displayActiveTime / 60000);
      const activeHours = Math.floor(activeMinutes / 60);

      // Show active time (billable) vs total elapsed
      const activeDisplay = activeHours > 0
        ? activeHours + 'h ' + (activeMinutes % 60) + 'm'
        : activeMinutes + 'm';

      if (statTimeEl) {
        statTimeEl.textContent = activeDisplay;
        statTimeEl.title = sessionStats.isActive ? 'Active time (billable)' : 'Timer paused (idle)';
      }
    }

    function updateSessionStats(usage) {
      recordActivity(); // Mark activity when we get a response

      if (usage) {
        sessionStats.requests += 1;
        sessionStats.tokens += usage.totalTokens || 0;
        sessionStats.cost += usage.estimatedCost || 0;
      }
      if (statRequestsEl) statRequestsEl.textContent = sessionStats.requests;
      if (statTokensEl) statTokensEl.textContent = sessionStats.tokens.toLocaleString();
      if (statCostEl) statCostEl.textContent = '$' + sessionStats.cost.toFixed(4);
      updateSessionTime();

      // Log time to project (async, non-blocking)
      vscode.postMessage({
        type: 'logProjectTime',
        activeTime: sessionStats.activeTime,
        totalCost: sessionStats.cost,
        requests: sessionStats.requests,
        tokens: sessionStats.tokens
      });
    }

    function resetSessionStats() {
      // Save final time before reset
      vscode.postMessage({
        type: 'logProjectTime',
        activeTime: sessionStats.activeTime,
        totalCost: sessionStats.cost,
        requests: sessionStats.requests,
        tokens: sessionStats.tokens,
        isSessionEnd: true
      });

      sessionStats = {
        requests: 0,
        tokens: 0,
        cost: 0,
        startTime: Date.now(),
        activeTime: 0,
        lastActivity: Date.now(),
        isActive: true
      };
      updateSessionStats(null);
      vscode.postMessage({ type: 'resetSessionStats' });
    }

    if (resetStatsBtn) {
      resetStatsBtn.addEventListener('click', resetSessionStats);
    }

    // Voice input using Web Speech API
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceStatus = document.getElementById('voiceStatus');
    let recognition = null;
    let isListening = false;

    // Initialize speech recognition if available
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isListening = true;
        if (voiceBtn) {
          voiceBtn.classList.add('listening');
          voiceBtn.textContent = '\u{1F534}';
        }
        if (voiceStatus) {
          voiceStatus.textContent = 'Listening...';
          voiceStatus.classList.add('show');
        }
      };

      recognition.onend = () => {
        isListening = false;
        if (voiceBtn) {
          voiceBtn.classList.remove('listening');
          voiceBtn.textContent = '\u{1F3A4}';
        }
        if (voiceStatus) {
          voiceStatus.classList.remove('show');
        }
      };

      recognition.onresult = (event) => {
        let transcript = '';
        let isFinal = false;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            isFinal = true;
          }
        }

        // Show interim results in input
        if (!isFinal) {
          if (inputEl) inputEl.value = transcript;
          if (voiceStatus) voiceStatus.textContent = 'Listening: ' + transcript.substring(0, 30) + '...';
        } else {
          // Final result - put in input and optionally send
          if (inputEl) {
            inputEl.value = transcript;
            // Auto-resize textarea
            inputEl.style.height = 'auto';
            inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
          }
          if (voiceStatus) voiceStatus.textContent = 'Got: ' + transcript.substring(0, 30) + (transcript.length > 30 ? '...' : '');

          // Auto-send after brief delay (user can cancel by clicking elsewhere)
          setTimeout(() => {
            if (inputEl && inputEl.value === transcript && transcript.trim()) {
              sendMessage();
            }
          }, 500);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isListening = false;
        if (voiceBtn) {
          voiceBtn.classList.remove('listening');
          voiceBtn.textContent = '\u{1F3A4}';
        }

        if (voiceStatus) {
          if (event.error === 'not-allowed') {
            voiceStatus.textContent = 'Microphone access denied';
          } else if (event.error === 'no-speech') {
            voiceStatus.textContent = 'No speech detected';
          } else {
            voiceStatus.textContent = 'Error: ' + event.error;
          }
          setTimeout(() => voiceStatus.classList.remove('show'), 2000);
        }
      };
    } else {
      // Speech recognition not supported
      if (voiceBtn) voiceBtn.style.display = 'none';
    }

    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        if (!recognition) {
          if (voiceStatus) {
            voiceStatus.textContent = 'Voice not supported in this environment';
            voiceStatus.classList.add('show');
            setTimeout(() => voiceStatus.classList.remove('show'), 2000);
          }
          return;
        }

        if (isListening) {
          recognition.stop();
        } else {
          try {
            recognition.start();
          } catch (e) {
            // Already started
            recognition.stop();
          }
        }
      });
    }

    // Shared voice input function for canvas mode
    function startVoiceInput() {
      if (!recognition) {
        showNotification('Voice input not supported in this browser');
        return;
      }

      if (isListening) {
        recognition.stop();
      } else {
        try {
          recognition.start();
        } catch (e) {
          recognition.stop();
        }
      }
    }

    // Team Notes functionality
    const teamNotesInput = document.getElementById('teamNotesInput');
    const saveTeamNotesBtn = document.getElementById('saveTeamNotesBtn');

    // Load team notes on startup
    vscode.postMessage({ type: 'loadTeamNotes' });

    if (saveTeamNotesBtn && teamNotesInput) {
      saveTeamNotesBtn.addEventListener('click', () => {
        const notes = teamNotesInput.value;
        vscode.postMessage({ type: 'saveTeamNotes', notes });
        saveTeamNotesBtn.textContent = 'Saved \u2713';
        setTimeout(() => {
          saveTeamNotesBtn.textContent = 'Save';
        }, 1500);
      });
    }

    // Auto-save on blur
    if (teamNotesInput) {
      teamNotesInput.addEventListener('blur', () => {
        const notes = teamNotesInput.value;
        if (notes.trim()) {
          vscode.postMessage({ type: 'saveTeamNotes', notes });
        }
      });
    }

    // Command history for up/down navigation
    let commandHistory = JSON.parse(localStorage.getItem('codebakers-history') || '[]');
    let historyIndex = -1;
    let tempInput = ''; // Store current input when navigating

    function sendMessage() {
      console.log('CodeBakers: sendMessage() called');
      const message = inputEl.value.trim();
      console.log('CodeBakers: message =', message, 'isStreaming =', isStreaming);
      if (message) {
        // Add to history (avoid duplicates of last command)
        if (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== message) {
          commandHistory.push(message);
          // Keep only last 50 commands
          if (commandHistory.length > 50) {
            commandHistory = commandHistory.slice(-50);
          }
          localStorage.setItem('codebakers-history', JSON.stringify(commandHistory));
        }
        historyIndex = -1;
        tempInput = '';
      }
      if (!message || isStreaming) {
        console.log('CodeBakers: sendMessage() blocked - message empty or isStreaming');
        return;
      }

      // Send all messages directly (pre-flight check removed)
      console.log('CodeBakers: sendMessage() proceeding with message');
      actualSendMessage(message);
    }

    function actualSendMessage(message) {
      console.log('CodeBakers: actualSendMessage() posting to extension');

      // Include uploaded files context in the message
      const filesContext = getUploadedFilesContext();
      const fullMessage = filesContext ? message + filesContext : message;

      vscode.postMessage({ type: 'sendMessage', message: fullMessage });
      inputEl.value = '';
      inputEl.style.height = 'auto';
      setStreamingState(true);
      startBuildingAnimation();

      // Clear uploaded files after sending (they're now part of the message)
      if (uploadedContextFiles.length > 0) {
        uploadedContextFiles = [];
        renderUploadedFiles();
      }
    }

    function cancelRequest() {
      vscode.postMessage({ type: 'cancelRequest' });
    }

    let buildingAnimationActive = false;

    function setStreamingState(streaming) {
      // CRITICAL: Set the state variable FIRST before any UI code that might throw
      isStreaming = streaming;
      console.log('CodeBakers: setStreamingState called with', streaming, '- isStreaming now:', isStreaming);

      // UI updates with null checks - these must not block state change
      try {
        if (sendBtn) sendBtn.style.display = streaming ? 'none' : 'block';
        if (cancelBtn) cancelBtn.classList.toggle('show', streaming);
        if (inputEl) inputEl.disabled = streaming;
        if (streamingEl) streamingEl.classList.toggle('show', streaming);

        // Start/stop tip cycling
        if (streaming) {
          startTipCycling();
        } else {
          stopTipCycling();
        }

        if (streaming && streamingContentEl) {
          streamingContentEl.style.display = 'none';
          streamingContentEl.innerHTML = '';
        }
      } catch (e) {
        console.error('CodeBakers: Error in setStreamingState UI update:', e);
      }
      // Note: Building animation is now controlled separately, not by streaming state
    }

    function startBuildingAnimation() {
      console.log('CodeBakers: startBuildingAnimation called');
      buildingAnimationActive = true;
      showBuildingAnimation();
    }

    function stopBuildingAnimation() {
      console.log('CodeBakers: stopBuildingAnimation called');
      buildingAnimationActive = false;
      hideBuildingAnimation();
    }

    function quickAction(command) {
      // Handle deploy directly without going through chat
      if (command === '/deploy') {
        vscode.postMessage({ type: 'deploy' });
        return;
      }
      // Handle git push directly
      if (command === '/git-push') {
        vscode.postMessage({ type: 'gitPush' });
        return;
      }
      // Handle mind map directly
      if (command === '/mindmap') {
        vscode.postMessage({ type: 'openMindMap' });
        return;
      }
      // Handle preview in browser
      if (command === '/preview') {
        vscode.postMessage({ type: 'openPreview', port: 3000 });
        return;
      }
      inputEl.value = command + ' ';
      inputEl.focus();
    }

    function clearChat() {
      vscode.postMessage({ type: 'clearChat' });
    }

    function login() {
      vscode.postMessage({ type: 'login' });
    }

    function closePendingPanel() {
      const pendingPanel = document.getElementById('pendingPanel');
      if (pendingPanel) {
        pendingPanel.classList.remove('show');
      }
    }

    function acceptAll() {
      vscode.postMessage({ type: 'applyAllFiles' });
      closePendingPanel();
    }

    function rejectAll() {
      vscode.postMessage({ type: 'rejectAllFiles' });
      closePendingPanel();
    }

    function acceptFile(id) {
      vscode.postMessage({ type: 'applyFile', id });
    }

    function rejectFile(id) {
      vscode.postMessage({ type: 'rejectFile', id });
    }

    function showDiff(id) {
      vscode.postMessage({ type: 'showDiff', id });
    }

    function undoFile(id) {
      vscode.postMessage({ type: 'undoFile', id });
    }

    function runCommand(id) {
      vscode.postMessage({ type: 'runCommand', id });
    }

    // =====================================
    // Canvas Mode Functions
    // =====================================

    function setViewMode(mode) {
      isCanvasMode = (mode === 'canvas');

      // Update body class
      document.body.classList.toggle('canvas-mode', isCanvasMode);

      // Update toggle button states
      if (canvasModeBtn && classicModeBtn) {
        canvasModeBtn.classList.toggle('active', isCanvasMode);
        classicModeBtn.classList.toggle('active', !isCanvasMode);
      }

      // In canvas mode, always show preview and hide classic chat elements
      if (splitContainer) {
        splitContainer.classList.toggle('preview-active', true); // Always show preview in canvas mode
      }

      console.log('CodeBakers: View mode set to', mode);
    }

    function openPendingSlideout() {
      if (pendingSlideout && pendingOverlay) {
        pendingOverlay.classList.add('show');
        pendingSlideout.classList.add('open');
        renderPendingSlideoutContent();
      }
    }

    function closePendingSlideout() {
      if (pendingSlideout && pendingOverlay) {
        pendingOverlay.classList.remove('show');
        pendingSlideout.classList.remove('open');
      }
    }

    function renderPendingSlideoutContent() {
      if (!pendingSlideoutContent) return;

      const pendingFiles = currentChanges.filter(c => c.status === 'pending');

      if (pendingFiles.length === 0) {
        pendingSlideoutContent.innerHTML = '<div class="pending-empty">No pending changes</div>';
        return;
      }

      pendingSlideoutContent.innerHTML = pendingFiles.map(change => {
        const fileName = change.operation.filePath.split('/').pop() || change.operation.filePath.split('\\\\').pop();
        const opIcon = change.operation.operation === 'create' ? '\u2728' :
                       change.operation.operation === 'delete' ? '\u{1F5D1}\uFE0F' : '\u{1F4DD}';

        return '<div class="pending-file-item">' +
          '<div class="pending-file-info">' +
            '<span class="pending-file-icon">' + opIcon + '</span>' +
            '<span class="pending-file-name">' + fileName + '</span>' +
          '</div>' +
          '<div class="pending-file-actions">' +
            '<button class="pending-item-btn diff" data-action="diff" data-id="' + change.id + '">Diff</button>' +
            '<button class="pending-item-btn accept" data-action="accept" data-id="' + change.id + '">\u2713</button>' +
            '<button class="pending-item-btn reject" data-action="reject" data-id="' + change.id + '">\u2715</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function updatePendingBadge() {
      const pendingCount = currentChanges.filter(c => c.status === 'pending').length;

      if (pendingBadge && pendingBadgeCount) {
        pendingBadgeCount.textContent = pendingCount;
        pendingBadge.classList.toggle('has-pending', pendingCount > 0);
      }

      if (pendingSlideoutCount) {
        pendingSlideoutCount.textContent = pendingCount;
      }
    }

    function toggleAIResponseBar() {
      aiResponseExpanded = !aiResponseExpanded;

      if (aiResponseBar) {
        aiResponseBar.classList.toggle('expanded', aiResponseExpanded);
      }

      if (aiResponseToggle) {
        aiResponseToggle.textContent = aiResponseExpanded ? '\u25BC' : '\u25B2';
      }
    }

    function updateAIResponseBar(status, summary, fullText) {
      if (aiResponseStatus) {
        aiResponseStatus.textContent = status || 'Ready';
      }

      if (aiResponseSummary) {
        aiResponseSummary.textContent = summary || 'Click to expand details';
      }

      if (aiResponseText) {
        aiResponseText.innerHTML = fullText || '';
      }

      // Manage visibility classes
      if (aiResponseBar) {
        const isReady = status === 'Ready' || !status;
        const isProcessing = status === 'Processing...' || status === 'Generating...';
        const hasContent = fullText && fullText.length > 0;

        // Hide when just showing "Ready" with no content
        aiResponseBar.classList.toggle('ready', isReady && !hasContent);
        // Show when actively processing or has content to display
        aiResponseBar.classList.toggle('active', isProcessing || hasContent);
        // Show pulsing dot when processing
        aiResponseBar.classList.toggle('processing', isProcessing);
      }
    }

    function sendCanvasMessage() {
      if (!canvasInput) return;

      const message = canvasInput.value.trim();
      if (!message || isStreaming) return;

      // Add selected node context if any
      let fullMessage = message;
      if (selectedNodeId) {
        const selectedNode = previewNodesData.find(n => n.id === selectedNodeId);
        if (selectedNode) {
          fullMessage = '[Context: ' + selectedNode.type + ' - ' + selectedNode.name + '] ' + message;
        }
      }

      // Clear input and send
      canvasInput.value = '';
      autoResize(canvasInput);

      // Use the same message sending logic as classic mode
      setStreamingState(true);
      updateAIResponseBar('Processing...', 'Working on your request...', '');
      vscode.postMessage({ type: 'sendMessage', message: fullMessage });
    }

    function handleCanvasAction(action) {
      if (!selectedNodeId && action !== 'add-feature') {
        // No node selected, prompt user
        if (canvasInput) {
          canvasInput.focus();
          canvasInput.placeholder = 'Select a node first, or describe what you want to add...';
        }
        return;
      }

      const selectedNode = previewNodesData.find(n => n.id === selectedNodeId);
      let prompt = '';

      switch (action) {
        case 'explain':
          prompt = selectedNode ?
            'Explain the ' + selectedNode.type + ' "' + selectedNode.name + '" - what does it do and how does it work?' : '';
          break;
        case 'add-feature':
          prompt = 'Add a new feature: ';
          if (canvasInput) {
            canvasInput.value = prompt;
            canvasInput.focus();
            canvasInput.setSelectionRange(prompt.length, prompt.length);
          }
          return;
        case 'connect':
          prompt = selectedNode ?
            'What should ' + selectedNode.name + ' connect to? Suggest connections and relationships.' : '';
          break;
        case 'generate':
          prompt = selectedNode ?
            'Generate the code for ' + selectedNode.type + ' "' + selectedNode.name + '"' : '';
          break;
      }

      if (prompt && canvasInput) {
        canvasInput.value = prompt;
        sendCanvasMessage();
      }
    }

    function selectNode(nodeId) {
      // Deselect previous
      if (selectedNodeId) {
        const prevNode = document.querySelector('.preview-node[data-node-id="' + selectedNodeId + '"]');
        if (prevNode) prevNode.classList.remove('selected');
      }

      // Select new
      selectedNodeId = nodeId;

      if (nodeId) {
        const newNode = document.querySelector('.preview-node[data-node-id="' + nodeId + '"]');
        if (newNode) newNode.classList.add('selected');

        // Update canvas input context
        const nodeData = previewNodesData.find(n => n.id === nodeId);
        if (nodeData && canvasInputContext) {
          canvasInputContext.innerHTML =
            '<div class="context-chip">' +
              '<span class="context-icon">' + (NODE_INFO[nodeData.type]?.icon || '\u{1F4E6}') + '</span>' +
              '<span class="context-name">' + nodeData.name + '</span>' +
              '<button class="context-clear" onclick="selectNode(null)">\xD7</button>' +
            '</div>';
          canvasInputContext.classList.add('has-context');
        }
      } else {
        if (canvasInputContext) {
          canvasInputContext.innerHTML = '';
          canvasInputContext.classList.remove('has-context');
        }
      }
    }

    // Make selectNode available globally for onclick handlers
    window.selectNode = selectNode;

    // =====================================
    // Live Preview Functions
    // =====================================

    function togglePreview() {
      previewEnabled = !previewEnabled;
      previewToggleBtn.classList.toggle('active', previewEnabled);
      splitContainer.classList.toggle('preview-active', previewEnabled);
    }

    function showBuildingAnimation() {
      console.log('CodeBakers: showBuildingAnimation called, previewEnabled:', previewEnabled);
      if (!previewEnabled) return;
      if (!buildingOverlay) {
        console.error('CodeBakers: buildingOverlay element not found!');
        return;
      }
      buildingOverlay.classList.add('active');
      previewEmpty.style.display = 'none';
      console.log('CodeBakers: Building animation shown');
    }

    function hideBuildingAnimation() {
      console.log('CodeBakers: hideBuildingAnimation called');
      if (!previewEnabled) return;
      if (buildingOverlay) {
        buildingOverlay.classList.remove('active');
      }
    }

    // Node type colors and descriptions (plain English for beginners)
    const NODE_INFO = {
      page: {
        icon: '\u{1F4C4}',
        label: 'Page',
        description: 'A screen users can visit. Like the homepage, login page, or dashboard. Each page has its own URL.'
      },
      component: {
        icon: '\u{1F9E9}',
        label: 'Component',
        description: 'A reusable building block for your pages. Like a button, card, or navigation bar. Build once, use anywhere.'
      },
      api: {
        icon: '\u{1F50C}',
        label: 'API Endpoint',
        description: 'A backend endpoint that handles data. When users submit a form, log in, or load data, an API handles it.'
      },
      database: {
        icon: '\u{1F5C4}\uFE0F',
        label: 'Database Table',
        description: 'A table to store your data permanently. Like a spreadsheet that saves users, orders, or posts.'
      },
      type: {
        icon: '\u{1F4DD}',
        label: 'Type Definition',
        description: 'A blueprint that defines the shape of your data. Like saying "a User has a name, email, and age".'
      },
      hook: {
        icon: '\u{1FA9D}',
        label: 'React Hook',
        description: 'Reusable logic for your components. Like "fetch user data" or "track form input". Write once, use anywhere.'
      },
      service: {
        icon: '\u2699\uFE0F',
        label: 'Service',
        description: 'A helper module that does a specific job. Like sending emails, processing payments, or talking to external services.'
      },
      middleware: {
        icon: '\u{1F500}',
        label: 'Middleware',
        description: 'A security checkpoint that runs before pages load. Checks if users are logged in or have permission.'
      },
      context: {
        icon: '\u{1F310}',
        label: 'Context Provider',
        description: 'Shared data that many components can access. Like the current user or theme. No need to pass it manually.'
      },
      action: {
        icon: '\u26A1',
        label: 'Server Action',
        description: 'A function that runs on the server when users submit forms. Handles creating, updating, or deleting data securely.'
      },
      job: {
        icon: '\u23F0',
        label: 'Background Job',
        description: 'A task that runs automatically in the background. Like sending weekly emails or cleaning up old data.'
      }
    };

    // Section order for vertical cascade (top to bottom)
    const SECTION_ORDER = [
      { type: 'page', title: 'Pages' },
      { type: 'component', title: 'Components' },
      { type: 'api', title: 'API Endpoints' },
      { type: 'service', title: 'Services' },
      { type: 'hook', title: 'Hooks' },
      { type: 'context', title: 'Context' },
      { type: 'middleware', title: 'Middleware' },
      { type: 'action', title: 'Actions' },
      { type: 'type', title: 'Types' },
      { type: 'database', title: 'Database' },
      { type: 'job', title: 'Background Jobs' }
    ];

    // Convert camelCase/PascalCase to readable text
    function humanize(name) {
      if (!name) return '';
      // Handle special cases
      if (name === 'api' || name === 'API') return 'API';
      if (name === 'cta' || name === 'CTA') return 'Call to Action';
      // Insert space before capitals, then clean up
      return name
        .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')  // HTTPServer -> HTTP Server
        .replace(/[-_]/g, ' ')  // snake_case and kebab-case
        .replace(/\\s+/g, ' ')  // multiple spaces
        .trim();
    }

    // Tooltip element (with null checks)
    const previewTooltip = document.getElementById('previewTooltip');
    const tooltipTitle = previewTooltip ? previewTooltip.querySelector('.preview-tooltip-title') : null;
    const tooltipDesc = previewTooltip ? previewTooltip.querySelector('.preview-tooltip-desc') : null;

    function showTooltip(nodeEl, nodeType, nodeName) {
      if (!previewTooltip || !tooltipTitle || !tooltipDesc) return;
      const info = NODE_INFO[nodeType] || NODE_INFO.component;
      tooltipTitle.textContent = info.label + ': ' + humanize(nodeName);
      tooltipDesc.textContent = info.description;

      const rect = nodeEl.getBoundingClientRect();

      // Position tooltip above the node, or below if not enough space
      let top = rect.top - 10;
      let left = rect.left + (rect.width / 2);

      previewTooltip.style.left = left + 'px';
      previewTooltip.style.top = top + 'px';
      previewTooltip.style.transform = 'translate(-50%, -100%)';

      // If tooltip would go off top of screen, show below instead
      if (top - 80 < 0) {
        previewTooltip.style.top = (rect.bottom + 10) + 'px';
        previewTooltip.style.transform = 'translate(-50%, 0)';
      }

      previewTooltip.classList.add('visible');
    }

    function hideTooltip() {
      if (previewTooltip) previewTooltip.classList.remove('visible');
    }

    // Health status analyzer for nodes
    function getNodeHealthStatus(node) {
      const indicators = [];

      // Check for common architectural issues based on node type
      if (node.type === 'api') {
        // APIs should have auth considerations
        indicators.push({
          level: 'warning',
          message: 'Consider adding authentication'
        });
      }

      if (node.type === 'page' && !node.name.toLowerCase().includes('error')) {
        // Pages should have error handling
        indicators.push({
          level: 'warning',
          message: 'Add error boundary'
        });
      }

      if (node.type === 'database') {
        // Databases need validation
        indicators.push({
          level: 'success',
          message: 'Schema defined'
        });
      }

      return { indicators };
    }

    // Generate code for a specific node
    function generateCodeForNode(node) {
      const nodeType = node.type;
      const nodeName = node.name;

      // Construct a generation prompt
      let prompt = '';
      switch (nodeType) {
        case 'page':
          prompt = 'Generate the code for the ' + nodeName + ' page with proper layout, loading states, and error handling.';
          break;
        case 'component':
          prompt = 'Generate the ' + nodeName + ' React component with TypeScript, proper props interface, and accessibility attributes.';
          break;
        case 'api':
          prompt = 'Generate the ' + nodeName + ' API route with input validation, error handling, and proper HTTP responses.';
          break;
        case 'database':
          prompt = 'Generate the Drizzle schema for the ' + nodeName + ' table with proper types and relations.';
          break;
        case 'hook':
          prompt = 'Generate the ' + nodeName + ' custom React hook with proper TypeScript types and error handling.';
          break;
        case 'service':
          prompt = 'Generate the ' + nodeName + ' service module with proper error handling and type safety.';
          break;
        default:
          prompt = 'Generate the code for ' + nodeName + ' (' + nodeType + ') following best practices.';
      }

      // Fill the input and trigger send
      if (inputEl) {
        inputEl.value = prompt;
        autoResize(inputEl);
        inputEl.focus();

        // Optionally auto-send
        // sendMessage();
      }

      // Show feedback
      showNotification('Ready to generate ' + nodeName + ' - press Enter to send');
    }

    // Simple notification helper
    function showNotification(message) {
      const existing = document.querySelector('.canvas-notification');
      if (existing) existing.remove();

      const notif = document.createElement('div');
      notif.className = 'canvas-notification';
      notif.textContent = message;
      notif.style.cssText = 'position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); background: var(--vscode-button-background); color: var(--vscode-button-foreground); padding: 8px 16px; border-radius: 6px; font-size: 12px; z-index: 1000; animation: fadeInUp 0.3s ease;';

      document.body.appendChild(notif);
      setTimeout(() => notif.remove(), 3000);
    }

    // Analyze architecture and suggest missing pieces
    function analyzeMissingPieces(nodes) {
      const suggestions = [];
      const nodeTypes = nodes.map(n => n.type);
      const nodeNames = nodes.map(n => n.name.toLowerCase());

      // Common patterns to suggest
      const patterns = [
        {
          condition: () => nodeTypes.includes('page') && !nodeTypes.includes('component'),
          suggestion: { type: 'component', name: 'Navigation', icon: '\u{1F9E9}', reason: 'Pages typically need a navigation component' }
        },
        {
          condition: () => nodeTypes.includes('page') && !nodeNames.some(n => n.includes('error') || n.includes('404')),
          suggestion: { type: 'page', name: 'ErrorPage', icon: '\u{1F4C4}', reason: 'Add error handling for better UX' }
        },
        {
          condition: () => nodeTypes.includes('api') && !nodeTypes.includes('type'),
          suggestion: { type: 'type', name: 'ApiTypes', icon: '\u{1F4DD}', reason: 'Define types for API request/response' }
        },
        {
          condition: () => nodeTypes.includes('component') && !nodeTypes.includes('hook') && nodes.length > 3,
          suggestion: { type: 'hook', name: 'useData', icon: '\u{1FA9D}', reason: 'Extract shared logic into a custom hook' }
        },
        {
          condition: () => nodeTypes.includes('database') && !nodeTypes.includes('api'),
          suggestion: { type: 'api', name: 'DataApi', icon: '\u{1F50C}', reason: 'Add API routes to access your database' }
        },
        {
          condition: () => nodeTypes.includes('page') && !nodeNames.some(n => n.includes('loading')),
          suggestion: { type: 'component', name: 'LoadingSpinner', icon: '\u{1F9E9}', reason: 'Add loading states for better UX' }
        },
        {
          condition: () => nodes.length > 0 && !nodeTypes.includes('service') && nodeTypes.includes('api'),
          suggestion: { type: 'service', name: 'ApiClient', icon: '\u2699\uFE0F', reason: 'Centralize API calls in a service' }
        }
      ];

      patterns.forEach(p => {
        if (p.condition()) {
          suggestions.push(p.suggestion);
        }
      });

      return suggestions.slice(0, 4); // Max 4 suggestions
    }

    // Update suggestions panel
    function updateSuggestions() {
      const suggestionsPanel = document.getElementById('suggestionsPanel');
      const suggestionsList = document.getElementById('suggestionsList');

      if (!suggestionsPanel || !suggestionsList) return;

      const suggestions = analyzeMissingPieces(previewNodesData);

      if (suggestions.length === 0) {
        suggestionsPanel.classList.remove('visible');
        return;
      }

      suggestionsList.innerHTML = suggestions.map(s =>
        '<div class="suggestion-item" data-type="' + s.type + '" data-name="' + s.name + '">' +
          '<span class="suggestion-icon">' + s.icon + '</span>' +
          '<div class="suggestion-content">' +
            '<div class="suggestion-name">' + s.name + '</div>' +
            '<div class="suggestion-reason">' + s.reason + '</div>' +
          '</div>' +
          '<span class="suggestion-add">+</span>' +
        '</div>'
      ).join('');

      // Add click handlers
      suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', function() {
          const type = this.dataset.type;
          const name = this.dataset.name;
          addSuggestedNode(type, name);
        });
      });

      suggestionsPanel.classList.add('visible');
    }

    // Add a suggested node
    function addSuggestedNode(type, name) {
      const prompt = 'Add a ' + type + ' called ' + name + ' to the architecture';

      if (inputEl) {
        inputEl.value = prompt;
        autoResize(inputEl);
        inputEl.focus();
      }

      showNotification('Adding ' + name + ' - press Enter to confirm');
    }

    // Edge click handler for "Why This?" explanations
    function getEdgeExplanation(edgeType, sourceName, targetName) {
      const explanations = {
        'renders': {
          title: 'Component Composition',
          desc: sourceName + ' renders ' + targetName + ' as part of its UI. This is React\\'s core pattern - building UIs from smaller, reusable pieces. The parent controls when and how the child appears.'
        },
        'calls': {
          title: 'API Communication',
          desc: sourceName + ' calls ' + targetName + ' to fetch or send data. This keeps your UI (frontend) separate from your data logic (backend) - a key principle for maintainable apps.'
        },
        'uses': {
          title: 'Hook Dependency',
          desc: sourceName + ' uses ' + targetName + ' to share logic. Hooks let you reuse stateful behavior without changing your component hierarchy.'
        },
        'queries': {
          title: 'Database Query',
          desc: sourceName + ' queries ' + targetName + ' to read data. This is how your app retrieves stored information.'
        },
        'default': {
          title: 'Connection',
          desc: sourceName + ' is connected to ' + targetName + '. This relationship helps organize your codebase.'
        }
      };

      return explanations[edgeType] || explanations['default'];
    }

    // Show edge explanation tooltip
    function showEdgeExplanation(edge, event) {
      const sourceNode = previewNodesData.find(n => n.id === edge.source);
      const targetNode = previewNodesData.find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) return;

      const explanation = getEdgeExplanation(edge.type, sourceNode.name, targetNode.name);

      // Create tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'edge-explanation-tooltip';
      tooltip.innerHTML =
        '<div class="edge-explanation-title">\u{1F4A1} ' + explanation.title + '</div>' +
        '<div class="edge-explanation-desc">' + explanation.desc + '</div>';
      tooltip.style.cssText = 'position: fixed; left: ' + event.clientX + 'px; top: ' + (event.clientY - 10) + 'px; transform: translate(-50%, -100%); background: var(--vscode-editorHoverWidget-background, #252526); border: 1px solid var(--vscode-editorHoverWidget-border, #454545); border-radius: 8px; padding: 12px; max-width: 280px; font-size: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.4); z-index: 1000;';

      document.body.appendChild(tooltip);

      // Remove on click outside
      const removeTooltip = () => {
        tooltip.remove();
        document.removeEventListener('click', removeTooltip);
      };
      setTimeout(() => document.addEventListener('click', removeTooltip), 100);
    }

    // Initialize suggestions panel close button
    const suggestionsClose = document.getElementById('suggestionsClose');
    if (suggestionsClose) {
      suggestionsClose.addEventListener('click', function() {
        document.getElementById('suggestionsPanel').classList.remove('visible');
      });
    }

    // Initialize templates gallery
    const TEMPLATES = [
      {
        id: 'saas',
        icon: '\u{1F680}',
        name: 'SaaS Starter',
        desc: 'Auth, dashboard, settings, billing',
        nodes: [
          { type: 'page', name: 'HomePage' },
          { type: 'page', name: 'Dashboard' },
          { type: 'page', name: 'Settings' },
          { type: 'page', name: 'Login' },
          { type: 'component', name: 'Navigation' },
          { type: 'component', name: 'Sidebar' },
          { type: 'api', name: 'AuthApi' },
          { type: 'api', name: 'UserApi' },
          { type: 'database', name: 'Users' }
        ]
      },
      {
        id: 'landing',
        icon: '\u{1F3AF}',
        name: 'Landing Page',
        desc: 'Hero, features, pricing, CTA',
        nodes: [
          { type: 'page', name: 'LandingPage' },
          { type: 'component', name: 'Hero' },
          { type: 'component', name: 'Features' },
          { type: 'component', name: 'Pricing' },
          { type: 'component', name: 'Testimonials' },
          { type: 'component', name: 'CTA' },
          { type: 'component', name: 'Footer' }
        ]
      },
      {
        id: 'blog',
        icon: '\u{1F4DD}',
        name: 'Blog',
        desc: 'Posts, categories, comments',
        nodes: [
          { type: 'page', name: 'BlogHome' },
          { type: 'page', name: 'PostPage' },
          { type: 'component', name: 'PostCard' },
          { type: 'component', name: 'CommentSection' },
          { type: 'api', name: 'PostsApi' },
          { type: 'database', name: 'Posts' },
          { type: 'database', name: 'Comments' }
        ]
      },
      {
        id: 'ecommerce',
        icon: '\u{1F6D2}',
        name: 'E-commerce',
        desc: 'Products, cart, checkout',
        nodes: [
          { type: 'page', name: 'ProductsPage' },
          { type: 'page', name: 'ProductDetail' },
          { type: 'page', name: 'CartPage' },
          { type: 'page', name: 'Checkout' },
          { type: 'component', name: 'ProductCard' },
          { type: 'component', name: 'CartItem' },
          { type: 'api', name: 'ProductsApi' },
          { type: 'api', name: 'OrdersApi' },
          { type: 'database', name: 'Products' },
          { type: 'database', name: 'Orders' }
        ]
      }
    ];

    // Render templates grid
    function renderTemplatesGallery() {
      const grid = document.getElementById('templatesGrid');
      if (!grid) return;

      grid.innerHTML = TEMPLATES.map(t =>
        '<div class="template-card" data-template-id="' + t.id + '">' +
          '<div class="template-icon">' + t.icon + '</div>' +
          '<div class="template-name">' + t.name + '</div>' +
          '<div class="template-desc">' + t.desc + '</div>' +
        '</div>'
      ).join('');

      // Add click handlers
      grid.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', function() {
          const templateId = this.dataset.templateId;
          applyTemplate(templateId);
        });
      });
    }

    // Apply a template
    function applyTemplate(templateId) {
      const template = TEMPLATES.find(t => t.id === templateId);
      if (!template) return;

      // Create nodes from template
      const nodes = template.nodes.map((n, i) => ({
        id: 'node_' + Date.now() + '_' + i,
        type: n.type,
        name: n.name,
        description: ''
      }));

      // Create edges (pages render components)
      const edges = [];
      const pages = nodes.filter(n => n.type === 'page');
      const components = nodes.filter(n => n.type === 'component');
      pages.forEach(page => {
        components.slice(0, 3).forEach(comp => {
          edges.push({
            id: 'edge_' + Date.now() + '_' + edges.length,
            source: page.id,
            target: comp.id,
            type: 'renders'
          });
        });
      });

      // Render
      renderPreviewNodes(nodes, edges);
      toggleTemplatesGallery();
      showNotification('Applied ' + template.name + ' template');
    }

    // Initialize templates close button
    const templatesClose = document.getElementById('templatesClose');
    if (templatesClose) {
      templatesClose.addEventListener('click', toggleTemplatesGallery);
    }

    // Render templates on load
    renderTemplatesGallery();

    // Update canvas stats
    function updateCanvasStats() {
      const pages = previewNodesData.filter(n => n.type === 'page').length;
      const components = previewNodesData.filter(n => n.type === 'component').length;
      const apis = previewNodesData.filter(n => n.type === 'api').length;

      const statPages = document.getElementById('statPages');
      const statComponents = document.getElementById('statComponents');
      const statApis = document.getElementById('statApis');

      if (statPages) statPages.textContent = pages;
      if (statComponents) statComponents.textContent = components;
      if (statApis) statApis.textContent = apis;
    }

    // Drag state
    let draggedNode = null;
    let dragOffset = { x: 0, y: 0 };

    function renderPreviewNodes(nodes, edges) {
      console.log('CodeBakers: renderPreviewNodes called with', nodes.length, 'nodes and', edges.length, 'edges');
      if (!previewEnabled) return;

      previewNodesData = nodes || [];
      previewEdgesData = edges || [];

      // Clear existing
      previewNodes.innerHTML = '';
      previewEdges.innerHTML = ''; // Clear SVG edges

      if (previewNodesData.length === 0) {
        previewEmpty.style.display = 'flex';
        return;
      }

      previewEmpty.style.display = 'none';

      // Group nodes by type for vertical cascade
      const nodesByType = {};
      previewNodesData.forEach(node => {
        if (!nodesByType[node.type]) {
          nodesByType[node.type] = [];
        }
        nodesByType[node.type].push(node);
      });

      // Render sections in order (vertical cascade)
      let animationIndex = 0;
      SECTION_ORDER.forEach(section => {
        const sectionNodes = nodesByType[section.type];
        if (!sectionNodes || sectionNodes.length === 0) return;

        // Create section container
        const sectionEl = document.createElement('div');
        sectionEl.className = 'preview-section';

        // Section title
        const titleEl = document.createElement('div');
        titleEl.className = 'preview-section-title';
        titleEl.textContent = section.title;
        sectionEl.appendChild(titleEl);

        // Nodes container
        const nodesContainer = document.createElement('div');
        nodesContainer.className = 'preview-section-nodes';

        // Render each node
        sectionNodes.forEach(node => {
          const info = NODE_INFO[node.type] || NODE_INFO.component;
          const nodeEl = document.createElement('div');
          nodeEl.className = 'preview-node';
          nodeEl.dataset.type = node.type;
          nodeEl.dataset.nodeId = node.id;
          nodeEl.dataset.nodeName = node.name;
          nodeEl.style.animationDelay = (animationIndex * 80) + 'ms';

          // Plain English label with original name below
          const displayLabel = humanize(node.name);

          // Get health status for this node type
          const healthStatus = getNodeHealthStatus(node);
          const healthHtml = healthStatus.indicators.length > 0
            ? '<div class="node-health">' + healthStatus.indicators.map(h =>
                '<span class="health-indicator ' + h.level + '" title="' + escapeHtml(h.message) + '"></span>'
              ).join('') + '</div>'
            : '';

          nodeEl.innerHTML =
            '<div class="node-actions">' +
              '<button class="node-action-btn generate" title="Generate code for ' + escapeHtml(node.name) + '" data-action="generate">\u26A1</button>' +
            '</div>' +
            '<span class="node-icon">' + info.icon + '</span>' +
            '<span class="node-label">' + escapeHtml(displayLabel) + '</span>' +
            '<span class="node-name">' + escapeHtml(node.name) + '</span>' +
            healthHtml;

          // Handle action button clicks
          const generateBtn = nodeEl.querySelector('.node-action-btn.generate');
          if (generateBtn) {
            generateBtn.addEventListener('click', function(e) {
              e.stopPropagation();
              generateCodeForNode(node);
            });
          }

          // Show as visible with stagger
          setTimeout(() => {
            nodeEl.classList.add('visible');
          }, animationIndex * 80);

          // Tooltip on hover
          nodeEl.addEventListener('mouseenter', function(e) {
            showTooltip(this, node.type, node.name);
          });
          nodeEl.addEventListener('mouseleave', hideTooltip);

          // Click to select (for canvas mode)
          nodeEl.addEventListener('click', function(e) {
            if (!draggedNode) { // Only select if not dragging
              selectNode(node.id);
            }
          });

          // Drag functionality
          nodeEl.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return; // Left click only
            draggedNode = this;
            const rect = this.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            this.classList.add('dragging');
            hideTooltip();
          });

          nodesContainer.appendChild(nodeEl);
          animationIndex++;
        });

        sectionEl.appendChild(nodesContainer);
        previewNodes.appendChild(sectionEl);
      });

      // Render connection lines after nodes are positioned
      renderPreviewEdges();

      // Update AI suggestions based on current architecture
      updateSuggestions();

      // Update stats display
      updateCanvasStats();
    }

    // Global drag handlers
    document.addEventListener('mousemove', function(e) {
      if (!draggedNode) return;
      // For now, just show visual feedback during drag
      // Full repositioning would require absolute positioning
    });

    document.addEventListener('mouseup', function(e) {
      if (draggedNode) {
        draggedNode.classList.remove('dragging');
        draggedNode = null;
      }
    });

    // Recalculate edges on resize
    let resizeTimeout;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function() {
        if (previewEdgesData.length > 0) {
          renderPreviewEdges();
        }
      }, 150);
    });

    function renderPreviewEdges() {
      const legend = document.getElementById('connectionLegend');

      if (!previewEdges || previewEdgesData.length === 0) {
        if (legend) legend.classList.remove('visible');
        return;
      }

      const canvasRect = previewCanvas.getBoundingClientRect();
      previewEdges.innerHTML = '';

      // Show legend when edges exist
      if (legend) legend.classList.add('visible');

      // Wait a bit for nodes to be rendered and positioned
      setTimeout(() => {
        previewEdgesData.forEach((edge, index) => {
          const sourceEl = document.querySelector('[data-node-id="' + edge.source + '"]');
          const targetEl = document.querySelector('[data-node-id="' + edge.target + '"]');

          if (!sourceEl || !targetEl) return;

          const sourceRect = sourceEl.getBoundingClientRect();
          const targetRect = targetEl.getBoundingClientRect();

          // Calculate positions relative to canvas
          const x1 = sourceRect.left + sourceRect.width / 2 - canvasRect.left;
          const y1 = sourceRect.bottom - canvasRect.top;
          const x2 = targetRect.left + targetRect.width / 2 - canvasRect.left;
          const y2 = targetRect.top - canvasRect.top;

          // Skip if source is below target (invalid connection direction)
          if (y1 > y2 + 20) return;

          // Create curved path (vertical bezier)
          const midY = (y1 + y2) / 2;
          const controlOffset = Math.min(Math.abs(y2 - y1) * 0.4, 50);

          const pathD = 'M ' + x1 + ' ' + y1 +
                       ' C ' + x1 + ' ' + (y1 + controlOffset) +
                       ', ' + x2 + ' ' + (y2 - controlOffset) +
                       ', ' + x2 + ' ' + y2;

          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', pathD);
          path.setAttribute('class', 'preview-edge ' + (edge.type || 'default'));
          path.setAttribute('data-edge-id', edge.id);
          path.style.cursor = 'pointer';
          path.style.pointerEvents = 'stroke';

          // Click handler for "Why This?" explanation
          path.addEventListener('click', function(e) {
            e.stopPropagation();
            showEdgeExplanation(edge, e);
          });

          // Staggered animation
          setTimeout(() => {
            path.classList.add('visible');
          }, index * 100 + 300);

          previewEdges.appendChild(path);

          // Add small dots at connection points
          const dotStart = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dotStart.setAttribute('cx', x1);
          dotStart.setAttribute('cy', y1);
          dotStart.setAttribute('r', '3');
          dotStart.setAttribute('class', 'edge-dot ' + (edge.type || 'default'));
          setTimeout(() => dotStart.classList.add('visible'), index * 100 + 400);
          previewEdges.appendChild(dotStart);

          const dotEnd = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dotEnd.setAttribute('cx', x2);
          dotEnd.setAttribute('cy', y2);
          dotEnd.setAttribute('r', '3');
          dotEnd.setAttribute('class', 'edge-dot ' + (edge.type || 'default'));
          setTimeout(() => dotEnd.classList.add('visible'), index * 100 + 400);
          previewEdges.appendChild(dotEnd);
        });
      }, 100);
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Show toast notification for auto-applied files
    function showToast(message, action, files) {
      const container = document.getElementById('toastContainer');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = \`
        <span class="toast-icon">\u2705</span>
        <span class="toast-message">\${escapeHtml(message)}</span>
        \${action === 'undo' ? '<button class="toast-undo-btn">Undo</button>' : ''}
      \`;

      // Handle undo click
      const undoBtn = toast.querySelector('.toast-undo-btn');
      if (undoBtn && files) {
        undoBtn.addEventListener('click', () => {
          vscode.postMessage({ type: 'undoAppliedFiles', files: files });
          toast.remove();
        });
      }

      container.appendChild(toast);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
      }, 5000);
    }

    // Parse AI response for architecture suggestions
    function parseArchitectureFromResponse(content) {
      console.log('CodeBakers: parseArchitectureFromResponse called, content length:', content?.length);
      const nodes = [];
      const edges = [];
      const addedNames = new Set();

      function addNode(type, name, description = '') {
        const normalizedName = name.toLowerCase();
        if (!addedNames.has(normalizedName) && name.length > 1) {
          addedNames.add(normalizedName);
          nodes.push({
            id: 'node_' + Date.now() + '_' + nodes.length,
            type: type,
            name: name,
            description: description
          });
        }
      }

      // 1. Extract from file paths (most reliable)
      // Matches: src/app/page.tsx, src/components/Hero.tsx, app/api/auth/route.ts, etc.
      const filePathPattern = /(?:src\\/|app\\/|pages\\/|components\\/|lib\\/|hooks\\/|services\\/|types\\/|api\\/)([^/\\s]+(?:\\/[^/\\s]+)*)\\.(tsx?|jsx?)/gi;
      let match;
      while ((match = filePathPattern.exec(content)) !== null) {
        const filePath = match[1];
        const parts = filePath.split('/');
        const fileName = parts[parts.length - 1];

        // Determine type from path
        let type = 'component';
        const fullPath = match[0].toLowerCase();

        if (fullPath.includes('/api/') || fullPath.includes('route.ts')) {
          type = 'api';
        } else if (fullPath.includes('/app/') && (fileName === 'page' || fileName === 'layout')) {
          type = 'page';
        } else if (fullPath.includes('pages/') && !fullPath.includes('api')) {
          type = 'page';
        } else if (fullPath.includes('/hooks/') || fileName.startsWith('use')) {
          type = 'hook';
        } else if (fullPath.includes('/services/') || fullPath.includes('/lib/')) {
          type = 'service';
        } else if (fullPath.includes('/types/') || fileName.includes('type') || fileName.includes('interface')) {
          type = 'type';
        } else if (fullPath.includes('middleware')) {
          type = 'middleware';
        } else if (fullPath.includes('context') || fileName.includes('Context') || fileName.includes('Provider')) {
          type = 'context';
        }

        // Clean up the name
        let name = fileName.replace(/\\.(tsx?|jsx?)$/i, '');
        if (name === 'page' || name === 'layout' || name === 'route') {
          // Use the folder name instead
          name = parts.length > 1 ? parts[parts.length - 2] : name;
        }
        // Convert to PascalCase for display
        name = name.charAt(0).toUpperCase() + name.slice(1);

        addNode(type, name);
      }

      // 2. Look for component/page mentions in prose
      const prosePatterns = [
        /(?:creat|add|build|implement)(?:e|ing|ed|s)?\\s+(?:a|an|the)?\\s*([A-Z][a-zA-Z0-9]*(?:Page|Component|Form|Modal|Card|Button|Header|Footer|Nav|Sidebar|Section|Hero|List|Table|Grid|Layout|View|Screen|Panel|Widget|Bar|Menu|Dropdown|Input|Dialog))/g,
        /([A-Z][a-zA-Z0-9]*(?:Page|Component|Form|Modal|Card|Header|Footer|Nav|Sidebar|Section|Hero|Layout))\\s+(?:component|page)?/g
      ];

      prosePatterns.forEach(pattern => {
        let m;
        while ((m = pattern.exec(content)) !== null) {
          const name = m[1];
          let type = 'component';
          const lowerName = name.toLowerCase();
          if (lowerName.includes('page') || lowerName.includes('screen') || lowerName.includes('view')) {
            type = 'page';
          }
          addNode(type, name);
        }
      });

      // 3. Extract from code blocks - look for function/const exports
      const exportPattern = /export\\s+(?:default\\s+)?(?:function|const|class)\\s+([A-Z][a-zA-Z0-9]*)/g;
      while ((match = exportPattern.exec(content)) !== null) {
        const name = match[1];
        let type = 'component';
        const lowerName = name.toLowerCase();
        if (lowerName.includes('hook') || name.startsWith('use')) {
          type = 'hook';
        } else if (lowerName.includes('service') || lowerName.includes('client') || lowerName.includes('api')) {
          type = 'service';
        } else if (lowerName.includes('context') || lowerName.includes('provider')) {
          type = 'context';
        }
        addNode(type, name);
      }

      // 4. Look for database/schema mentions
      const dbPatterns = [
        /(?:table|schema|model|entity)(?:\\s+(?:for|called|named))?\\s+['"]?([a-zA-Z_][a-zA-Z0-9_]*)['"]?/gi,
        /createTable\\s*\\(\\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]?/g
      ];
      dbPatterns.forEach(pattern => {
        let m;
        while ((m = pattern.exec(content)) !== null) {
          addNode('database', m[1].charAt(0).toUpperCase() + m[1].slice(1));
        }
      });

      // 5. If we still have no nodes, try to detect from common landing page elements
      if (nodes.length === 0) {
        const landingPageKeywords = [
          { pattern: /hero\\s*(?:section|component|area)?/gi, name: 'Hero', type: 'component' },
          { pattern: /navigation|navbar|nav\\s*bar/gi, name: 'Navigation', type: 'component' },
          { pattern: /header/gi, name: 'Header', type: 'component' },
          { pattern: /footer/gi, name: 'Footer', type: 'component' },
          { pattern: /(?:feature|features)\\s*(?:section|list|grid)?/gi, name: 'Features', type: 'component' },
          { pattern: /(?:testimonial|testimonials)/gi, name: 'Testimonials', type: 'component' },
          { pattern: /(?:pricing|plans)/gi, name: 'Pricing', type: 'component' },
          { pattern: /(?:cta|call[\\s-]to[\\s-]action)/gi, name: 'CTA', type: 'component' },
          { pattern: /contact\\s*(?:form|section)?/gi, name: 'Contact', type: 'component' },
          { pattern: /landing\\s*page/gi, name: 'LandingPage', type: 'page' },
          { pattern: /home\\s*page/gi, name: 'HomePage', type: 'page' }
        ];

        landingPageKeywords.forEach(({ pattern, name, type }) => {
          if (pattern.test(content)) {
            addNode(type, name);
          }
        });
      }

      // Generate edges based on common patterns (pages render components)
      const pageNodes = nodes.filter(n => n.type === 'page');
      const componentNodes = nodes.filter(n => n.type === 'component');

      pageNodes.forEach(page => {
        componentNodes.forEach(comp => {
          edges.push({
            id: 'edge_' + Date.now() + '_' + edges.length,
            source: page.id,
            target: comp.id,
            type: 'renders'
          });
        });
      });

      console.log('CodeBakers: parseArchitectureFromResponse found', nodes.length, 'nodes,', edges.length, 'edges');
      if (nodes.length > 0) {
        console.log('CodeBakers: Nodes found:', nodes.map(n => n.type + ':' + n.name).join(', '));
      }
      return { nodes, edges };
    }

    // Preview toggle click handler
    if (previewToggleBtn) {
      previewToggleBtn.addEventListener('click', togglePreview);
    }

    // Initialize preview panel state (default: enabled)
    if (previewEnabled && splitContainer) {
      splitContainer.classList.add('preview-active');
    }

    function handleKeydown(e) {
      // Enter (without Shift) or Ctrl+Enter to send
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
        return;
      }

      // Up arrow: Previous command in history
      if (e.key === 'ArrowUp' && commandHistory.length > 0) {
        e.preventDefault();
        if (historyIndex === -1) {
          tempInput = inputEl.value; // Save current input
          historyIndex = commandHistory.length - 1;
        } else if (historyIndex > 0) {
          historyIndex--;
        }
        inputEl.value = commandHistory[historyIndex];
        autoResize(inputEl);
        return;
      }

      // Down arrow: Next command in history
      if (e.key === 'ArrowDown' && historyIndex !== -1) {
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
          historyIndex++;
          inputEl.value = commandHistory[historyIndex];
        } else {
          historyIndex = -1;
          inputEl.value = tempInput; // Restore saved input
        }
        autoResize(inputEl);
        return;
      }
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      // Skip if typing in any input or textarea
      const activeTag = document.activeElement?.tagName;
      const isTyping = document.activeElement === inputEl ||
                       document.activeElement === canvasInput ||
                       activeTag === 'INPUT' ||
                       activeTag === 'TEXTAREA';

      // Ctrl+Shift+A: Accept all pending changes
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        acceptAll();
        return;
      }

      // Escape: Close panels, deselect node, or cancel request (in priority order)
      if (e.key === 'Escape') {
        e.preventDefault();
        // First: Close templates gallery if open
        const templatesGallery = document.getElementById('templatesGallery');
        if (templatesGallery && templatesGallery.classList.contains('visible')) {
          templatesGallery.classList.remove('visible');
          return;
        }
        // Second: Close suggestions panel if open
        const suggestionsPanel = document.getElementById('suggestionsPanel');
        if (suggestionsPanel && suggestionsPanel.classList.contains('visible')) {
          suggestionsPanel.classList.remove('visible');
          return;
        }
        // Third: Deselect node if selected
        if (selectedNodeId) {
          selectNode(null);
          return;
        }
        // Fourth: Cancel any active request
        cancelRequest();
        return;
      }

      // Map Mode: Press C to switch to Chat mode
      if (!isTyping && document.body.classList.contains('canvas-mode')) {
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          setCanvasMode(false);
          return;
        }
      }

      // Ctrl+Enter anywhere: Focus input and send if has content
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        inputEl.focus();
        if (inputEl.value.trim()) {
          sendMessage();
        }
        return;
      }

      // / : Focus input (when not typing)
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        inputEl.focus();
        return;
      }
    });

    // Show add node palette
    function showAddNodePalette() {
      const nodeTypes = [
        { type: 'page', icon: '\u{1F4C4}', name: 'Page' },
        { type: 'component', icon: '\u{1F9E9}', name: 'Component' },
        { type: 'api', icon: '\u{1F50C}', name: 'API Route' },
        { type: 'database', icon: '\u{1F5C4}\uFE0F', name: 'Database' },
        { type: 'hook', icon: '\u{1FA9D}', name: 'Hook' },
        { type: 'service', icon: '\u2699\uFE0F', name: 'Service' }
      ];

      const prompt = 'What would you like to add?\\n\\n' +
        nodeTypes.map((t, i) => (i + 1) + '. ' + t.icon + ' ' + t.name).join('\\n');

      if (inputEl) {
        inputEl.value = 'Add a ';
        inputEl.focus();
        autoResize(inputEl);
      }
      showNotification('Type: "Add a [page/component/api]..."');
    }

    // Delete selected node
    function deleteSelectedNode() {
      if (!selectedNodeId) return;

      const node = previewNodesData.find(n => n.id === selectedNodeId);
      if (!node) return;

      // Remove from data
      previewNodesData = previewNodesData.filter(n => n.id !== selectedNodeId);
      previewEdgesData = previewEdgesData.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId);

      // Re-render
      renderPreviewNodes(previewNodesData, previewEdgesData);
      selectNode(null);
      showNotification('Removed ' + node.name);
    }

    // Toggle templates gallery
    function toggleTemplatesGallery() {
      const gallery = document.getElementById('templatesGallery');
      if (gallery) {
        gallery.classList.toggle('visible');
      }
    }

    function autoResize(el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Clean up raw AI output - hide code generation, show summaries
    function cleanStreamContent(content) {
      if (!content) return '';
      let text = content;
      const nl = String.fromCharCode(10);

      // Detect if content is mostly code/JSX (should be hidden)
      function isMostlyCode(str) {
        // Count JSX-like tags (capitalized component names)
        const jsxTags = ['<Card', '<Button', '<Input', '<Form', '<Modal', '<Table', '<div', '<span', '<p>', '<h1', '<h2', '<h3', 'className=', 'onClick=', 'onChange=', 'import ', 'export ', 'function ', 'const ', 'return ('];
        let codeIndicators = 0;
        for (let i = 0; i < jsxTags.length; i++) {
          if (str.indexOf(jsxTags[i]) !== -1) codeIndicators++;
        }
        // If 3+ code indicators, it's mostly code
        return codeIndicators >= 3;
      }

      // Simple tag removal using indexOf/substring
      function removeTagBlock(str, openTag, closeTag) {
        let result = str;
        let safety = 0;
        while (result.indexOf(openTag) !== -1 && safety < 100) {
          const start = result.indexOf(openTag);
          const end = result.indexOf(closeTag, start);
          if (end === -1) break;
          result = result.substring(0, start) + result.substring(end + closeTag.length);
          safety++;
        }
        return result;
      }

      function removeTag(str, tag) {
        return str.split('<' + tag + '>').join('').split('</' + tag + '>').join('');
      }

      // Extract file operations for summary before removing
      const fileOps = [];
      let searchStart = 0;
      while (text.indexOf('<file_operation>', searchStart) !== -1) {
        const opStart = text.indexOf('<file_operation>', searchStart);
        const opEnd = text.indexOf('</file_operation>', opStart);
        if (opEnd === -1) break;
        const block = text.substring(opStart, opEnd);
        const actionStart = block.indexOf('<action>');
        const actionEnd = block.indexOf('</action>');
        const pathStart = block.indexOf('<path>');
        const pathEnd = block.indexOf('</path>');
        if (actionStart !== -1 && actionEnd !== -1 && pathStart !== -1 && pathEnd !== -1) {
          fileOps.push({
            action: block.substring(actionStart + 8, actionEnd),
            path: block.substring(pathStart + 6, pathEnd)
          });
        }
        searchStart = opEnd + 1;
      }

      // Remove file_operation blocks
      text = removeTagBlock(text, '<file_operation>', '</file_operation>');

      // Remove other internal tags
      text = removeTag(text, 'content');
      text = removeTag(text, 'action');
      text = removeTag(text, 'path');
      text = removeTag(text, 'thinking');
      text = removeTag(text, 'result');

      // If content is mostly code, replace with simple message
      if (isMostlyCode(text)) {
        let summary = '\u2728 Generating code...';
        if (fileOps.length > 0) {
          summary = fileOps.map(function(op) {
            return '\u{1F4C4} ' + op.action + ': ' + op.path;
          }).join(nl);
        }
        return summary;
      }

      // Add file operation summary at top if any were found
      if (fileOps.length > 0) {
        const summary = fileOps.map(function(op) {
          return '\u{1F4C4} ' + op.action + ': ' + op.path;
        }).join(nl);
        text = summary + nl + nl + text;
      }

      return text.trim();
    }

    function formatContent(content) {
      if (!content) return '';

      let text = content;
      const newline = String.fromCharCode(10);
      const backtick = String.fromCharCode(96);
      const asterisk = String.fromCharCode(42);
      const underscore = String.fromCharCode(95);
      const hash = String.fromCharCode(35);

      // Extract and protect code blocks first (triple backtick blocks)
      const codeBlocks = [];
      const bt3 = backtick + backtick + backtick;
      let idx = 0;
      while (text.indexOf(bt3) !== -1) {
        const start = text.indexOf(bt3);
        const afterStart = start + 3;
        let langEnd = afterStart;
        while (langEnd < text.length && text.charAt(langEnd) !== newline) langEnd++;
        const lang = text.substring(afterStart, langEnd).trim() || 'code';
        const end = text.indexOf(bt3, langEnd);
        if (end === -1) break;
        const code = text.substring(langEnd + 1, end);
        const codeLines = code.trim().split(newline).length;
        const blockId = 'code-block-' + Date.now() + '-' + idx;
        // Create collapsible code block - ALWAYS collapsed by default
        codeBlocks.push(
          '<div class="code-block-wrapper collapsed" id="' + blockId + '">' +
            '<div class="code-block-header" onclick="window.toggleCodeBlock(&quot;' + blockId + '&quot;)">' +
              '<div class="code-block-lang">' +
                '<svg class="code-chevron" width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>' +
                '<span>Thinking</span>' +
              '</div>' +
              '<span class="code-block-lines">' + lang + ' \u2022 ' + codeLines + ' lines</span>' +
            '</div>' +
            '<div class="code-block-content">' +
              '<pre class="code-block"><code>' + escapeHtml(code.trim()) + '</code></pre>' +
            '</div>' +
          '</div>'
        );
        text = text.substring(0, start) + '%%CODEBLOCK' + idx + '%%' + text.substring(end + 3);
        idx++;
      }

      // Extract and protect inline code (single backtick spans)
      const inlineCodes = [];
      idx = 0;
      while (text.indexOf(backtick) !== -1) {
        const start = text.indexOf(backtick);
        const end = text.indexOf(backtick, start + 1);
        if (end === -1) break;
        const code = text.substring(start + 1, end);
        if (code.indexOf(newline) === -1) {
          inlineCodes.push('<code class="inline-code">' + escapeHtml(code) + '</code>');
          text = text.substring(0, start) + '%%INLINE' + idx + '%%' + text.substring(end + 1);
          idx++;
        } else {
          break;
        }
      }

      // Convert headers BEFORE escaping (# ## ### at start of line -> styled headers)
      const headerLines = text.split(newline);
      for (let i = 0; i < headerLines.length; i++) {
        let line = headerLines[i];
        let level = 0;
        while (line.length > 0 && line.charAt(0) === hash) {
          level++;
          line = line.substring(1);
        }
        if (level > 0 && line.charAt(0) === ' ') {
          line = line.substring(1);
          // Convert to styled header (h1-h3 styles)
          const headerClass = level <= 2 ? 'header-large' : 'header-medium';
          headerLines[i] = '%%HEADER_START_' + headerClass + '%%' + line + '%%HEADER_END%%';
        }
      }
      text = headerLines.join(newline);

      // Convert bold **text** or __text__ BEFORE escaping
      const doubleAst = asterisk + asterisk;
      const doubleUnd = underscore + underscore;

      // Find and replace **bold** patterns
      let searchPos = 0;
      while (true) {
        const start = text.indexOf(doubleAst, searchPos);
        if (start === -1) break;
        const end = text.indexOf(doubleAst, start + 2);
        if (end === -1) break;
        const boldText = text.substring(start + 2, end);
        if (boldText.indexOf(newline) === -1 && boldText.length > 0) {
          text = text.substring(0, start) + '%%BOLD_START%%' + boldText + '%%BOLD_END%%' + text.substring(end + 2);
          searchPos = start + boldText.length + 20;
        } else {
          searchPos = start + 2;
        }
      }

      // Same for __bold__
      searchPos = 0;
      while (true) {
        const start = text.indexOf(doubleUnd, searchPos);
        if (start === -1) break;
        const end = text.indexOf(doubleUnd, start + 2);
        if (end === -1) break;
        const boldText = text.substring(start + 2, end);
        if (boldText.indexOf(newline) === -1 && boldText.length > 0) {
          text = text.substring(0, start) + '%%BOLD_START%%' + boldText + '%%BOLD_END%%' + text.substring(end + 2);
          searchPos = start + boldText.length + 20;
        } else {
          searchPos = start + 2;
        }
      }

      // Now escape HTML
      text = escapeHtml(text);

      // Convert horizontal rules
      const hrLines = text.split(newline);
      for (let i = 0; i < hrLines.length; i++) {
        const trimmed = hrLines[i].trim();
        if (trimmed === '---' || trimmed === '___') {
          hrLines[i] = '<hr class="chat-hr">';
        }
      }
      text = hrLines.join(newline);

      // Restore formatting placeholders to HTML
      text = text.split('%%BOLD_START%%').join('<strong>');
      text = text.split('%%BOLD_END%%').join('</strong>');
      text = text.split('%%HEADER_START_header-large%%').join('<div class="chat-header-large">');
      text = text.split('%%HEADER_START_header-medium%%').join('<div class="chat-header-medium">');
      text = text.split('%%HEADER_END%%').join('</div>');

      // Restore code blocks and inline code
      for (let i = 0; i < codeBlocks.length; i++) {
        text = text.split('%%CODEBLOCK' + i + '%%').join(codeBlocks[i]);
      }
      for (let i = 0; i < inlineCodes.length; i++) {
        text = text.split('%%INLINE' + i + '%%').join(inlineCodes[i]);
      }

      // Convert to paragraphs with line breaks
      const paragraphs = [];
      const chunks = text.split(newline + newline);
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i].trim();
        if (chunk) {
          const chunkLines = chunk.split(newline);
          paragraphs.push('<p>' + chunkLines.join('<br>') + '</p>');
        }
      }

      return paragraphs.join('') || '<p></p>';
    }

    // Filter thinking content to remove code/XML, keeping only explanations
    function filterThinkingContent(text) {
      if (!text) return '';
      let result = text;

      // Remove file_operation blocks entirely
      while (result.includes('<file_operation>')) {
        const start = result.indexOf('<file_operation>');
        const end = result.indexOf('</file_operation>', start);
        if (end === -1) {
          result = result.substring(0, start);
          break;
        }
        result = result.substring(0, start) + result.substring(end + 17);
      }

      // Remove content blocks (contain code)
      while (result.includes('<content>')) {
        const start = result.indexOf('<content>');
        const end = result.indexOf('</content>', start);
        if (end === -1) {
          result = result.substring(0, start);
          break;
        }
        result = result.substring(0, start) + result.substring(end + 10);
      }

      // Remove markdown code blocks
      while (result.includes('\`\`\`')) {
        const start = result.indexOf('\`\`\`');
        const end = result.indexOf('\`\`\`', start + 3);
        if (end === -1) {
          result = result.substring(0, start);
          break;
        }
        result = result.substring(0, start) + result.substring(end + 3);
      }

      // Remove other XML tags but keep their text content for simple tags
      const tagsToStrip = ['action', 'path', 'description', 'thinking', 'result'];
      for (const tag of tagsToStrip) {
        result = result.split('<' + tag + '>').join('');
        result = result.split('</' + tag + '>').join('');
      }

      // Remove import statements and code-like lines
      const lines = result.split('\\n');
      const cleanLines = [];
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip code-like lines
        if (trimmed.startsWith('import ') ||
            trimmed.startsWith('const ') ||
            trimmed.startsWith('export ') ||
            trimmed.startsWith('function ') ||
            trimmed.startsWith('class ') ||
            trimmed.startsWith('<') ||
            trimmed.includes('className=') ||
            trimmed.includes('=>') ||
            trimmed.match(/^[{}();]$/)) {
          continue;
        }
        if (trimmed) cleanLines.push(trimmed);
      }

      result = cleanLines.join(' ').replace(/\\s+/g, ' ').trim();

      // If nothing left after filtering, return a generic message
      if (result.length < 20) {
        return 'Processing your request...';
      }

      // Truncate if too long
      if (result.length > 500) {
        result = result.substring(0, 500) + '...';
      }

      return result;
    }

    // Detect missing packages from AI response content
    function detectMissingPackages(content) {
      if (!content) return [];
      const packages = [];

      // Pattern 1: "Missing Packages:" followed by package names
      const missingMatch = content.match(/Missing Packages?:?\\s*([\\s\\S]*?)(?:\\n\\n|$)/i);
      if (missingMatch) {
        // Extract package names - look for npm package patterns
        const section = missingMatch[1];
        const pkgMatches = section.match(/@?[a-z0-9][-a-z0-9._]*(?:\\/@?[a-z0-9][-a-z0-9._]*)?/gi);
        if (pkgMatches) {
          pkgMatches.forEach(pkg => {
            // Filter out common false positives
            if (pkg && !pkg.match(/^(the|a|an|to|for|and|or|with|from|npm|install|run|bash)$/i)) {
              packages.push(pkg);
            }
          });
        }
      }

      // Pattern 2: "npm install <packages>" in code blocks
      const npmInstallMatches = content.matchAll(/npm install\\s+([^\\n\`]+)/gi);
      for (const match of npmInstallMatches) {
        const pkgs = match[1].trim().split(/\\s+/);
        pkgs.forEach(pkg => {
          // Filter flags and invalid names
          if (pkg && !pkg.startsWith('-') && pkg.match(/^@?[a-z0-9]/i)) {
            packages.push(pkg);
          }
        });
      }

      // Deduplicate
      return [...new Set(packages)];
    }

    function renderMessage(msg, index) {
      const div = document.createElement('div');
      div.className = 'message ' + msg.role;

      let html = '';

      // Thinking toggle - filter out code from thinking content
      if (msg.role === 'assistant' && msg.thinking) {
        const filteredThinking = filterThinkingContent(msg.thinking);
        if (filteredThinking && filteredThinking !== 'Processing your request...') {
          html += '<div class="thinking-toggle" data-action="toggle-thinking">\u25B6 Show reasoning</div>';
          html += '<div class="thinking-content">' + escapeHtml(filteredThinking) + '</div>';
        }
      }

      html += formatContent(msg.content);

      div.innerHTML = html;
      return div;
    }

    function toggleThinking(el) {
      const content = el.nextElementSibling;
      const isShown = content.classList.toggle('show');
      el.textContent = isShown ? '\u25BC Hide reasoning' : '\u25B6 Show reasoning';
    }

    function renderPendingChanges() {
      const pending = currentChanges.filter(c => c.status === 'pending');
      const pendingCmds = currentCommands.filter(c => c.status === 'pending');
      const applied = currentChanges.filter(c => c.status === 'applied');
      const total = pending.length + pendingCmds.length;

      // Null checks for removed elements
      if (pendingCount) {
        pendingCount.textContent = total;
      }
      // Show panel when there are pending OR recently applied items (auto-apply mode - panel removed)
      if (pendingPanel) {
        pendingPanel.classList.toggle('show', currentChanges.length > 0 || currentCommands.length > 0);
      }

      let html = '';

      // File changes
      for (const change of currentChanges) {
        const icon = change.action === 'create' ? '\u2795' : change.action === 'edit' ? '\u270F\uFE0F' : '\u{1F5D1}\uFE0F';
        const statusClass = change.status !== 'pending' ? change.status : '';

        html += '<div class="pending-item ' + statusClass + '">';
        html += '<span class="pending-icon">' + icon + '</span>';
        html += '<div class="pending-info">';
        html += '<div class="pending-path">' + escapeHtml(change.path) + '</div>';
        if (change.description) {
          html += '<div class="pending-desc">' + escapeHtml(change.description) + '</div>';
        }
        html += '</div>';

        if (change.status === 'pending') {
          html += '<div class="pending-item-actions">';
          if (change.hasContent && change.action !== 'delete') {
            html += '<button class="item-btn preview" data-action="diff" data-id="' + change.id + '" title="Preview changes before applying">\u{1F441} Preview</button>';
          }
          html += '<button class="item-btn reject" data-action="reject" data-id="' + change.id + '" title="Reject this change">\u2715</button>';
          html += '<button class="item-btn accept" data-action="accept" data-id="' + change.id + '" title="Apply this change">\u2713 Apply</button>';
          html += '</div>';
        } else if (change.status === 'applied') {
          html += '<div class="pending-item-actions">';
          html += '<span style="font-size: 10px; color: #28a745; margin-right: 6px;">\u2713 applied</span>';
          html += '<button class="item-btn" data-action="undo" data-id="' + change.id + '" title="Undo this change">\u21A9</button>';
          html += '</div>';
        } else {
          html += '<span style="font-size: 10px; opacity: 0.7;">' + change.status + '</span>';
        }

        html += '</div>';
      }

      // Commands
      for (const cmd of currentCommands) {
        const statusClass = cmd.status !== 'pending' ? cmd.status : '';

        html += '<div class="pending-item command-item ' + statusClass + '">';
        html += '<span class="pending-icon">\u25B6</span>';
        html += '<div class="pending-info">';
        html += '<div class="command-text">' + escapeHtml(cmd.command) + '</div>';
        if (cmd.description) {
          html += '<div class="pending-desc">' + escapeHtml(cmd.description) + '</div>';
        }
        html += '</div>';

        if (cmd.status === 'pending') {
          html += '<div class="pending-item-actions">';
          html += '<button class="item-btn accept" data-action="run" data-id="' + cmd.id + '">Run</button>';
          html += '</div>';
        } else {
          html += '<span style="font-size: 10px; opacity: 0.7;">' + cmd.status + '</span>';
        }

        html += '</div>';
      }

      if (pendingList) {
        pendingList.innerHTML = html;
      }
    }

    function renderPinnedFiles() {
      if (pinnedCountEl) {
        pinnedCountEl.textContent = currentPinnedFiles.length;
      }

      // Show/hide sections based on whether files are pinned
      const hasFiles = currentPinnedFiles.length > 0;
      if (pinnedFilesEl) {
        if (hasFiles) {
          pinnedFilesEl.classList.add('show');
          pinnedFilesEl.classList.add('has-files');
        } else {
          pinnedFilesEl.classList.remove('show');
          pinnedFilesEl.classList.remove('has-files');
        }
      }
      if (addFilesHint) {
        addFilesHint.style.display = hasFiles ? 'none' : 'block';
      }

      let html = '';
      for (const file of currentPinnedFiles) {
        html += '<div class="pinned-file">';
        html += '<span class="pinned-file-name" title="' + escapeHtml(file.path) + '">' + escapeHtml(file.name) + '</span>';
        html += '<button class="pinned-file-remove" data-action="remove-pinned" data-path="' + escapeHtml(file.path) + '" title="Remove from context">\xD7</button>';
        html += '</div>';
      }
      if (pinnedListEl) {
        pinnedListEl.innerHTML = html;
      }
    }

    function addPinnedFile() {
      vscode.postMessage({ type: 'addPinnedFile' });
    }

    function removePinnedFile(path) {
      vscode.postMessage({ type: 'removePinnedFile', path: path });
    }

    function clearPinnedFiles() {
      vscode.postMessage({ type: 'clearPinnedFiles' });
    }

    window.addEventListener('message', event => {
      const data = event.data;

      switch (data.type) {
        case 'updateMessages':
          currentMessages = data.messages;
          welcomeEl.style.display = data.messages.length > 0 ? 'none' : 'flex';

          // Clear and re-render messages
          const existing = messagesEl.querySelectorAll('.message');
          existing.forEach(el => el.remove());

          data.messages.forEach((msg, i) => {
            messagesEl.insertBefore(renderMessage(msg, i), streamingEl);
          });

          messagesEl.scrollTop = messagesEl.scrollHeight;
          setStreamingState(false);

          // Parse the last AI response for architecture nodes
          // Only stop animation when we actually receive an assistant response
          if (previewEnabled && data.messages.length > 0) {
            const lastMsg = data.messages[data.messages.length - 1];
            // Only process when the last message is from AI (not user's message)
            if (lastMsg.role === 'assistant' && lastMsg.content) {
              console.log('CodeBakers: Got assistant response, parsing for architecture');
              const { nodes, edges } = parseArchitectureFromResponse(lastMsg.content);
              console.log('CodeBakers: updateMessages - parsed nodes:', nodes.length, 'edges:', edges.length);
              if (nodes.length > 0) {
                // Stop building animation and show nodes with slight delay for visual transition
                setTimeout(() => {
                  stopBuildingAnimation();
                  renderPreviewNodes(nodes, edges);
                }, 300);
              } else {
                // No nodes found, just stop the animation
                stopBuildingAnimation();
              }

              // Auto-detect and install missing packages
              const missingPackages = detectMissingPackages(lastMsg.content);
              if (missingPackages.length > 0) {
                console.log('CodeBakers: Auto-installing missing packages:', missingPackages);
                vscode.postMessage({ type: 'installPackages', packages: missingPackages });
              }
            }
            // If last message is from user, keep animation running - AI is still processing
            console.log('CodeBakers: updateMessages - lastMsg.role:', lastMsg.role);
          }
          break;

        case 'updatePendingChanges':
          currentChanges = data.changes || [];
          currentCommands = data.commands || [];
          renderPendingChanges();
          updatePendingBadge();
          break;

        case 'updatePinnedFiles':
          currentPinnedFiles = data.files || [];
          renderPinnedFiles();
          break;

        case 'toast':
          showToast(data.message, data.action, data.files);
          break;

        case 'typing':
          // CRITICAL: Reset streaming state FIRST when typing stops
          // This must happen before any other code that could throw
          if (!data.isTyping) {
            setStreamingState(false);
          }
          // Now do the rest with null checks
          if (data.isTyping) {
            if (welcomeEl) welcomeEl.style.display = 'none';
            updateAIResponseBar('Processing...', 'Working on your request...', '');
          } else {
            updateAIResponseBar('Ready', 'Click to see last response', '');
          }
          if (streamingEl) streamingEl.classList.toggle('show', data.isTyping);
          if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
          break;

        case 'setInputValue':
          // Set input field value (e.g., from editor selection context)
          inputEl.value = data.value || '';
          inputEl.focus();
          // Scroll to bottom and trigger resize
          inputEl.style.height = 'auto';
          inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
          break;

        case 'streamThinking':
          // Just keep "Thinking..." showing - no content display needed
          break;

        case 'streamContent':
          // Don't show streaming content - code goes to files, not chat
          // Just keep the "Thinking..." animation running
          // The final response will be shown when done
          break;

        case 'validating':
          // Removed - was confusing "pre-flight check" message
          break;

        case 'streamError':
          if (statusIndicator) statusIndicator.classList.remove('show');
          setStreamingState(false);
          stopBuildingAnimation();
          alert('Error: ' + (data.error || 'Unknown error'));
          break;

        case 'requestCancelled':
          if (statusIndicator) statusIndicator.classList.remove('show');
          setStreamingState(false);
          stopBuildingAnimation();
          break;

        case 'impactAnalysis':
          // Removed - pre-flight panel no longer exists
          break;

        case 'rippleCheck':
          // Show ripple check results after code changes
          showRippleCheck(data);
          break;

        case 'updatePlan':
          const badge = document.getElementById('planBadge');
          if (badge) {
            badge.textContent = data.plan.charAt(0).toUpperCase() + data.plan.slice(1);
            badge.className = 'plan-badge' + (data.plan === 'trial' ? ' trial' : '');
          }
          break;

        case 'updateSessionStats':
          updateSessionStats(data.usage);
          break;

        case 'updateTeamNotes':
          if (teamNotesInput) teamNotesInput.value = data.notes || '';
          break;

        case 'showStatus':
          // Removed - status indicator no longer exists
          break;

        case 'showProgress':
          // Removed - status indicator no longer exists
          break;

        case 'showLogin':
          loginPromptEl.classList.add('show');
          mainContentEl.style.display = 'none';
          break;

        case 'hideLogin':
          loginPromptEl.classList.remove('show');
          mainContentEl.style.display = 'flex';
          break;

        case 'updateHealth':
          // Could show health indicator
          break;

        case 'showOnboarding':
          onboardingActive = data.show;
          if (onboardingContainer) {
            if (data.show) {
              onboardingContainer.classList.add('show');
              mainContentEl.style.display = 'none';
              if (loginPromptEl) loginPromptEl.classList.remove('show');
            } else {
              onboardingContainer.classList.remove('show');
              mainContentEl.style.display = 'flex';
            }
          }
          break;

        case 'onboarding-update':
          if (onboardingContent && data.html) {
            onboardingContent.innerHTML = data.html;
          }
          break;

        case 'onboarding-complete':
          onboardingActive = false;
          if (onboardingContainer) {
            onboardingContainer.classList.remove('show');
          }
          mainContentEl.style.display = 'flex';
          // Show welcome with completed message
          if (welcomeEl) {
            welcomeEl.style.display = 'flex';
          }
          break;
      }
    });

    // Status indicator removed - this interval is no longer needed

    // ============================================
    // Event Listeners (CSP-compliant, no inline handlers)
    // ============================================

    // Helper function to safely add event listener
    function safeAddListener(id, event, handler) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener(event, handler);
      } else {
        console.warn('CodeBakers: Element not found:', id);
      }
    }

    // Send button
    safeAddListener('sendBtn', 'click', function() {
      console.log('CodeBakers: Send button clicked');
      sendMessage();
    });

    // Cancel button
    safeAddListener('cancelBtn', 'click', function() {
      console.log('CodeBakers: Cancel button clicked');
      cancelRequest();
    });

    // Clear button
    safeAddListener('clearBtn', 'click', function() {
      console.log('CodeBakers: Clear button clicked');
      clearChat();
    });

    // Login button
    safeAddListener('loginBtn', 'click', function() {
      console.log('CodeBakers: Login button clicked');
      login();
    });

    // Accept All button
    safeAddListener('acceptAllBtn', 'click', function() {
      console.log('CodeBakers: Accept All clicked');
      acceptAll();
    });

    // Reject All button
    safeAddListener('rejectAllBtn', 'click', function() {
      console.log('CodeBakers: Reject All clicked');
      rejectAll();
    });

    // Close Pending Panel button
    safeAddListener('pendingCloseBtn', 'click', function() {
      console.log('CodeBakers: Close Pending Panel clicked');
      closePendingPanel();
    });

    // Pinned files buttons
    safeAddListener('addPinnedBtn', 'click', function() {
      console.log('CodeBakers: Add Pinned File clicked');
      addPinnedFile();
    });

    safeAddListener('clearPinnedBtn', 'click', function() {
      console.log('CodeBakers: Clear Pinned Files clicked');
      clearPinnedFiles();
    });

    safeAddListener('addFilesBtn', 'click', function() {
      console.log('CodeBakers: Add Files Hint clicked');
      addPinnedFile();
    });

    // Quick action buttons (welcome screen)
    document.querySelectorAll('.quick-action').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const action = this.getAttribute('data-action');
        console.log('CodeBakers: Quick action clicked:', action);
        quickAction(action);
      });
    });

    // Example chips in getting started section
    document.querySelectorAll('.example-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        const exampleText = this.textContent.replace(/^"|"$/g, '').trim();
        console.log('CodeBakers: Example chip clicked:', exampleText);
        if (inputEl) {
          inputEl.value = exampleText;
          inputEl.focus();
          autoResize(inputEl);
        }
      });
    });

    // Action bar buttons (persistent)
    document.querySelectorAll('.action-bar .action-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const action = this.getAttribute('data-action');
        console.log('CodeBakers: Action bar clicked:', action);
        quickAction(action);
      });
    });

    // Input textarea events
    if (inputEl) {
      inputEl.addEventListener('keydown', function(e) {
        handleKeydown(e);
      });

      inputEl.addEventListener('input', function() {
        autoResize(this);
      });
    }

    // ============================================
    // Canvas Mode Event Handlers
    // ============================================

    // View Mode Toggle - Canvas Mode
    if (canvasModeBtn) {
      canvasModeBtn.addEventListener('click', function() {
        console.log('CodeBakers: Canvas Mode clicked');
        setViewMode('canvas');
      });
    }

    // View Mode Toggle - Classic Mode
    if (classicModeBtn) {
      classicModeBtn.addEventListener('click', function() {
        console.log('CodeBakers: Classic Mode clicked');
        setViewMode('classic');
      });
    }

    // Pending Badge - Open Slideout
    if (pendingBadge) {
      pendingBadge.addEventListener('click', function() {
        console.log('CodeBakers: Pending Badge clicked');
        openPendingSlideout();
      });
    }

    // Pending Slideout - Close Button
    if (pendingSlideoutClose) {
      pendingSlideoutClose.addEventListener('click', function() {
        console.log('CodeBakers: Pending Slideout Close clicked');
        closePendingSlideout();
      });
    }

    // Pending Slideout - Overlay Click to Close
    if (pendingOverlay) {
      pendingOverlay.addEventListener('click', function() {
        console.log('CodeBakers: Pending Overlay clicked');
        closePendingSlideout();
      });
    }

    // Pending Slideout - Accept All
    if (slideoutAcceptAll) {
      slideoutAcceptAll.addEventListener('click', function() {
        console.log('CodeBakers: Slideout Accept All clicked');
        acceptAll();
        closePendingSlideout();
      });
    }

    // Pending Slideout - Reject All
    if (slideoutRejectAll) {
      slideoutRejectAll.addEventListener('click', function() {
        console.log('CodeBakers: Slideout Reject All clicked');
        rejectAll();
        closePendingSlideout();
      });
    }

    // AI Response Bar - Toggle Expand/Collapse
    if (aiResponseHeader) {
      aiResponseHeader.addEventListener('click', function() {
        console.log('CodeBakers: AI Response Header clicked');
        toggleAIResponseBar();
      });
    }

    // Canvas Chat Input - Send Button
    if (canvasSendBtn) {
      canvasSendBtn.addEventListener('click', function() {
        console.log('CodeBakers: Canvas Send clicked');
        sendCanvasMessage();
      });
    }

    // Canvas Chat Input - Voice Button
    if (canvasVoiceBtn) {
      canvasVoiceBtn.addEventListener('click', function() {
        console.log('CodeBakers: Canvas Voice clicked');
        startVoiceInput();
      });
    }

    // Canvas Chat Input - Keyboard
    if (canvasInput) {
      canvasInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendCanvasMessage();
        }
      });

      canvasInput.addEventListener('input', function() {
        autoResize(this);
      });
    }

    // Canvas Quick Actions
    document.querySelectorAll('.canvas-action').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const action = this.getAttribute('data-action');
        console.log('CodeBakers: Canvas action clicked:', action);
        handleCanvasAction(action);
      });
    });

    // Initialize Canvas Mode on load
    setViewMode(isCanvasMode ? 'canvas' : 'classic');

    // Event delegation for dynamically created buttons (pending changes, commands, thinking)
    document.addEventListener('click', function(e) {
      const target = e.target;
      if (!target || !target.getAttribute) return;

      const action = target.getAttribute('data-action');
      const id = target.getAttribute('data-id');

      if (action === 'diff' && id) {
        console.log('CodeBakers: Diff clicked for', id);
        showDiff(id);
      } else if (action === 'accept' && id) {
        console.log('CodeBakers: Accept clicked for', id);
        acceptFile(id);
      } else if (action === 'reject' && id) {
        console.log('CodeBakers: Reject clicked for', id);
        rejectFile(id);
      } else if (action === 'undo' && id) {
        console.log('CodeBakers: Undo clicked for', id);
        undoFile(id);
      } else if (action === 'run' && id) {
        console.log('CodeBakers: Run command clicked for', id);
        runCommand(id);
      } else if (action === 'toggle-thinking') {
        console.log('CodeBakers: Toggle thinking clicked');
        const content = target.nextElementSibling;
        if (content) {
          const isShown = content.classList.toggle('show');
          target.textContent = isShown ? '\u25BC Hide reasoning' : '\u25B6 Show reasoning';
        }
      } else if (action === 'remove-pinned') {
        const path = target.getAttribute('data-path');
        if (path) {
          console.log('CodeBakers: Remove pinned file clicked:', path);
          removePinnedFile(path);
        }
      }
    });

    console.log('CodeBakers: All event listeners registered');
    } catch (error) {
      console.error('CodeBakers: CRITICAL SCRIPT ERROR:', error);
      console.error('CodeBakers: Stack trace:', error.stack);
    }
  </script>
</body>
</html>`}}});var Zt,md=f(()=>{Zt="0.32.1"});function vd(n,e={auto:!1}){if(ud)throw new Error(`you must \`import '@anthropic-ai/sdk/shims/${n.kind}'\` before importing anything else from @anthropic-ai/sdk`);if(Qt)throw new Error(`can't \`import '@anthropic-ai/sdk/shims/${n.kind}'\` after \`import '@anthropic-ai/sdk/shims/${Qt}'\``);ud=e.auto,Qt=n.kind,Go=n.fetch,Nc=n.Request,Ac=n.Response,Ic=n.Headers,gd=n.FormData,Mc=n.Blob,ms=n.File,Yo=n.ReadableStream,hd=n.getMultipartRequestOptions,Xo=n.getDefaultAgent,us=n.fileFromPath,fd=n.isFsReadStream}var ud,Qt,Go,Nc,Ac,Ic,gd,Mc,ms,Yo,hd,Xo,us,fd,Ko=f(()=>{ud=!1});var wd=de((A0,yd)=>{"use strict";var ee={};yd.exports=ee;function bd(n){return n<0?-1:1}function Dc(n){return n%1===.5&&(n&1)===0?Math.floor(n):Math.round(n)}function It(n,e){e.unsigned||--n;let t=e.unsigned?0:-Math.pow(2,n),a=Math.pow(2,n)-1,s=e.moduloBitLength?Math.pow(2,e.moduloBitLength):Math.pow(2,n),o=e.moduloBitLength?Math.pow(2,e.moduloBitLength-1):Math.pow(2,n-1);return function(i,r){r||(r={});let d=+i;if(r.enforceRange){if(!Number.isFinite(d))throw new TypeError("Argument is not a finite number");if(d=bd(d)*Math.floor(Math.abs(d)),d<t||d>a)throw new TypeError("Argument is not in byte range");return d}if(!isNaN(d)&&r.clamp)return d=Dc(d),d<t&&(d=t),d>a&&(d=a),d;if(!Number.isFinite(d)||d===0)return 0;if(d=bd(d)*Math.floor(Math.abs(d)),d=d%s,!e.unsigned&&d>=o)return d-s;if(e.unsigned){if(d<0)d+=s;else if(d===-0)return 0}return d}}ee.void=function(){};ee.boolean=function(n){return!!n};ee.byte=It(8,{unsigned:!1});ee.octet=It(8,{unsigned:!0});ee.short=It(16,{unsigned:!1});ee["unsigned short"]=It(16,{unsigned:!0});ee.long=It(32,{unsigned:!1});ee["unsigned long"]=It(32,{unsigned:!0});ee["long long"]=It(32,{unsigned:!1,moduloBitLength:64});ee["unsigned long long"]=It(32,{unsigned:!0,moduloBitLength:64});ee.double=function(n){let e=+n;if(!Number.isFinite(e))throw new TypeError("Argument is not a finite floating-point value");return e};ee["unrestricted double"]=function(n){let e=+n;if(isNaN(e))throw new TypeError("Argument is NaN");return e};ee.float=ee.double;ee["unrestricted float"]=ee["unrestricted double"];ee.DOMString=function(n,e){return e||(e={}),e.treatNullAsEmptyString&&n===null?"":String(n)};ee.ByteString=function(n,e){let t=String(n),a;for(let s=0;(a=t.codePointAt(s))!==void 0;++s)if(a>255)throw new TypeError("Argument is not a valid bytestring");return t};ee.USVString=function(n){let e=String(n),t=e.length,a=[];for(let s=0;s<t;++s){let o=e.charCodeAt(s);if(o<55296||o>57343)a.push(String.fromCodePoint(o));else if(56320<=o&&o<=57343)a.push(String.fromCodePoint(65533));else if(s===t-1)a.push(String.fromCodePoint(65533));else{let i=e.charCodeAt(s+1);if(56320<=i&&i<=57343){let r=o&1023,d=i&1023;a.push(String.fromCodePoint(65536+1024*r+d)),++s}else a.push(String.fromCodePoint(65533))}}return a.join("")};ee.Date=function(n,e){if(!(n instanceof Date))throw new TypeError("Argument is not a Date object");if(!isNaN(n))return n};ee.RegExp=function(n,e){return n instanceof RegExp||(n=new RegExp(n)),n}});var xd=de((I0,Mt)=>{"use strict";Mt.exports.mixin=function(e,t){let a=Object.getOwnPropertyNames(t);for(let s=0;s<a.length;++s)Object.defineProperty(e,a[s],Object.getOwnPropertyDescriptor(t,a[s]))};Mt.exports.wrapperSymbol=Symbol("wrapper");Mt.exports.implSymbol=Symbol("impl");Mt.exports.wrapperForImpl=function(n){return n[Mt.exports.wrapperSymbol]};Mt.exports.implForWrapper=function(n){return n[Mt.exports.implSymbol]}});var kd=de((M0,Rc)=>{Rc.exports=[[[0,44],"disallowed_STD3_valid"],[[45,46],"valid"],[[47,47],"disallowed_STD3_valid"],[[48,57],"valid"],[[58,64],"disallowed_STD3_valid"],[[65,65],"mapped",[97]],[[66,66],"mapped",[98]],[[67,67],"mapped",[99]],[[68,68],"mapped",[100]],[[69,69],"mapped",[101]],[[70,70],"mapped",[102]],[[71,71],"mapped",[103]],[[72,72],"mapped",[104]],[[73,73],"mapped",[105]],[[74,74],"mapped",[106]],[[75,75],"mapped",[107]],[[76,76],"mapped",[108]],[[77,77],"mapped",[109]],[[78,78],"mapped",[110]],[[79,79],"mapped",[111]],[[80,80],"mapped",[112]],[[81,81],"mapped",[113]],[[82,82],"mapped",[114]],[[83,83],"mapped",[115]],[[84,84],"mapped",[116]],[[85,85],"mapped",[117]],[[86,86],"mapped",[118]],[[87,87],"mapped",[119]],[[88,88],"mapped",[120]],[[89,89],"mapped",[121]],[[90,90],"mapped",[122]],[[91,96],"disallowed_STD3_valid"],[[97,122],"valid"],[[123,127],"disallowed_STD3_valid"],[[128,159],"disallowed"],[[160,160],"disallowed_STD3_mapped",[32]],[[161,167],"valid",[],"NV8"],[[168,168],"disallowed_STD3_mapped",[32,776]],[[169,169],"valid",[],"NV8"],[[170,170],"mapped",[97]],[[171,172],"valid",[],"NV8"],[[173,173],"ignored"],[[174,174],"valid",[],"NV8"],[[175,175],"disallowed_STD3_mapped",[32,772]],[[176,177],"valid",[],"NV8"],[[178,178],"mapped",[50]],[[179,179],"mapped",[51]],[[180,180],"disallowed_STD3_mapped",[32,769]],[[181,181],"mapped",[956]],[[182,182],"valid",[],"NV8"],[[183,183],"valid"],[[184,184],"disallowed_STD3_mapped",[32,807]],[[185,185],"mapped",[49]],[[186,186],"mapped",[111]],[[187,187],"valid",[],"NV8"],[[188,188],"mapped",[49,8260,52]],[[189,189],"mapped",[49,8260,50]],[[190,190],"mapped",[51,8260,52]],[[191,191],"valid",[],"NV8"],[[192,192],"mapped",[224]],[[193,193],"mapped",[225]],[[194,194],"mapped",[226]],[[195,195],"mapped",[227]],[[196,196],"mapped",[228]],[[197,197],"mapped",[229]],[[198,198],"mapped",[230]],[[199,199],"mapped",[231]],[[200,200],"mapped",[232]],[[201,201],"mapped",[233]],[[202,202],"mapped",[234]],[[203,203],"mapped",[235]],[[204,204],"mapped",[236]],[[205,205],"mapped",[237]],[[206,206],"mapped",[238]],[[207,207],"mapped",[239]],[[208,208],"mapped",[240]],[[209,209],"mapped",[241]],[[210,210],"mapped",[242]],[[211,211],"mapped",[243]],[[212,212],"mapped",[244]],[[213,213],"mapped",[245]],[[214,214],"mapped",[246]],[[215,215],"valid",[],"NV8"],[[216,216],"mapped",[248]],[[217,217],"mapped",[249]],[[218,218],"mapped",[250]],[[219,219],"mapped",[251]],[[220,220],"mapped",[252]],[[221,221],"mapped",[253]],[[222,222],"mapped",[254]],[[223,223],"deviation",[115,115]],[[224,246],"valid"],[[247,247],"valid",[],"NV8"],[[248,255],"valid"],[[256,256],"mapped",[257]],[[257,257],"valid"],[[258,258],"mapped",[259]],[[259,259],"valid"],[[260,260],"mapped",[261]],[[261,261],"valid"],[[262,262],"mapped",[263]],[[263,263],"valid"],[[264,264],"mapped",[265]],[[265,265],"valid"],[[266,266],"mapped",[267]],[[267,267],"valid"],[[268,268],"mapped",[269]],[[269,269],"valid"],[[270,270],"mapped",[271]],[[271,271],"valid"],[[272,272],"mapped",[273]],[[273,273],"valid"],[[274,274],"mapped",[275]],[[275,275],"valid"],[[276,276],"mapped",[277]],[[277,277],"valid"],[[278,278],"mapped",[279]],[[279,279],"valid"],[[280,280],"mapped",[281]],[[281,281],"valid"],[[282,282],"mapped",[283]],[[283,283],"valid"],[[284,284],"mapped",[285]],[[285,285],"valid"],[[286,286],"mapped",[287]],[[287,287],"valid"],[[288,288],"mapped",[289]],[[289,289],"valid"],[[290,290],"mapped",[291]],[[291,291],"valid"],[[292,292],"mapped",[293]],[[293,293],"valid"],[[294,294],"mapped",[295]],[[295,295],"valid"],[[296,296],"mapped",[297]],[[297,297],"valid"],[[298,298],"mapped",[299]],[[299,299],"valid"],[[300,300],"mapped",[301]],[[301,301],"valid"],[[302,302],"mapped",[303]],[[303,303],"valid"],[[304,304],"mapped",[105,775]],[[305,305],"valid"],[[306,307],"mapped",[105,106]],[[308,308],"mapped",[309]],[[309,309],"valid"],[[310,310],"mapped",[311]],[[311,312],"valid"],[[313,313],"mapped",[314]],[[314,314],"valid"],[[315,315],"mapped",[316]],[[316,316],"valid"],[[317,317],"mapped",[318]],[[318,318],"valid"],[[319,320],"mapped",[108,183]],[[321,321],"mapped",[322]],[[322,322],"valid"],[[323,323],"mapped",[324]],[[324,324],"valid"],[[325,325],"mapped",[326]],[[326,326],"valid"],[[327,327],"mapped",[328]],[[328,328],"valid"],[[329,329],"mapped",[700,110]],[[330,330],"mapped",[331]],[[331,331],"valid"],[[332,332],"mapped",[333]],[[333,333],"valid"],[[334,334],"mapped",[335]],[[335,335],"valid"],[[336,336],"mapped",[337]],[[337,337],"valid"],[[338,338],"mapped",[339]],[[339,339],"valid"],[[340,340],"mapped",[341]],[[341,341],"valid"],[[342,342],"mapped",[343]],[[343,343],"valid"],[[344,344],"mapped",[345]],[[345,345],"valid"],[[346,346],"mapped",[347]],[[347,347],"valid"],[[348,348],"mapped",[349]],[[349,349],"valid"],[[350,350],"mapped",[351]],[[351,351],"valid"],[[352,352],"mapped",[353]],[[353,353],"valid"],[[354,354],"mapped",[355]],[[355,355],"valid"],[[356,356],"mapped",[357]],[[357,357],"valid"],[[358,358],"mapped",[359]],[[359,359],"valid"],[[360,360],"mapped",[361]],[[361,361],"valid"],[[362,362],"mapped",[363]],[[363,363],"valid"],[[364,364],"mapped",[365]],[[365,365],"valid"],[[366,366],"mapped",[367]],[[367,367],"valid"],[[368,368],"mapped",[369]],[[369,369],"valid"],[[370,370],"mapped",[371]],[[371,371],"valid"],[[372,372],"mapped",[373]],[[373,373],"valid"],[[374,374],"mapped",[375]],[[375,375],"valid"],[[376,376],"mapped",[255]],[[377,377],"mapped",[378]],[[378,378],"valid"],[[379,379],"mapped",[380]],[[380,380],"valid"],[[381,381],"mapped",[382]],[[382,382],"valid"],[[383,383],"mapped",[115]],[[384,384],"valid"],[[385,385],"mapped",[595]],[[386,386],"mapped",[387]],[[387,387],"valid"],[[388,388],"mapped",[389]],[[389,389],"valid"],[[390,390],"mapped",[596]],[[391,391],"mapped",[392]],[[392,392],"valid"],[[393,393],"mapped",[598]],[[394,394],"mapped",[599]],[[395,395],"mapped",[396]],[[396,397],"valid"],[[398,398],"mapped",[477]],[[399,399],"mapped",[601]],[[400,400],"mapped",[603]],[[401,401],"mapped",[402]],[[402,402],"valid"],[[403,403],"mapped",[608]],[[404,404],"mapped",[611]],[[405,405],"valid"],[[406,406],"mapped",[617]],[[407,407],"mapped",[616]],[[408,408],"mapped",[409]],[[409,411],"valid"],[[412,412],"mapped",[623]],[[413,413],"mapped",[626]],[[414,414],"valid"],[[415,415],"mapped",[629]],[[416,416],"mapped",[417]],[[417,417],"valid"],[[418,418],"mapped",[419]],[[419,419],"valid"],[[420,420],"mapped",[421]],[[421,421],"valid"],[[422,422],"mapped",[640]],[[423,423],"mapped",[424]],[[424,424],"valid"],[[425,425],"mapped",[643]],[[426,427],"valid"],[[428,428],"mapped",[429]],[[429,429],"valid"],[[430,430],"mapped",[648]],[[431,431],"mapped",[432]],[[432,432],"valid"],[[433,433],"mapped",[650]],[[434,434],"mapped",[651]],[[435,435],"mapped",[436]],[[436,436],"valid"],[[437,437],"mapped",[438]],[[438,438],"valid"],[[439,439],"mapped",[658]],[[440,440],"mapped",[441]],[[441,443],"valid"],[[444,444],"mapped",[445]],[[445,451],"valid"],[[452,454],"mapped",[100,382]],[[455,457],"mapped",[108,106]],[[458,460],"mapped",[110,106]],[[461,461],"mapped",[462]],[[462,462],"valid"],[[463,463],"mapped",[464]],[[464,464],"valid"],[[465,465],"mapped",[466]],[[466,466],"valid"],[[467,467],"mapped",[468]],[[468,468],"valid"],[[469,469],"mapped",[470]],[[470,470],"valid"],[[471,471],"mapped",[472]],[[472,472],"valid"],[[473,473],"mapped",[474]],[[474,474],"valid"],[[475,475],"mapped",[476]],[[476,477],"valid"],[[478,478],"mapped",[479]],[[479,479],"valid"],[[480,480],"mapped",[481]],[[481,481],"valid"],[[482,482],"mapped",[483]],[[483,483],"valid"],[[484,484],"mapped",[485]],[[485,485],"valid"],[[486,486],"mapped",[487]],[[487,487],"valid"],[[488,488],"mapped",[489]],[[489,489],"valid"],[[490,490],"mapped",[491]],[[491,491],"valid"],[[492,492],"mapped",[493]],[[493,493],"valid"],[[494,494],"mapped",[495]],[[495,496],"valid"],[[497,499],"mapped",[100,122]],[[500,500],"mapped",[501]],[[501,501],"valid"],[[502,502],"mapped",[405]],[[503,503],"mapped",[447]],[[504,504],"mapped",[505]],[[505,505],"valid"],[[506,506],"mapped",[507]],[[507,507],"valid"],[[508,508],"mapped",[509]],[[509,509],"valid"],[[510,510],"mapped",[511]],[[511,511],"valid"],[[512,512],"mapped",[513]],[[513,513],"valid"],[[514,514],"mapped",[515]],[[515,515],"valid"],[[516,516],"mapped",[517]],[[517,517],"valid"],[[518,518],"mapped",[519]],[[519,519],"valid"],[[520,520],"mapped",[521]],[[521,521],"valid"],[[522,522],"mapped",[523]],[[523,523],"valid"],[[524,524],"mapped",[525]],[[525,525],"valid"],[[526,526],"mapped",[527]],[[527,527],"valid"],[[528,528],"mapped",[529]],[[529,529],"valid"],[[530,530],"mapped",[531]],[[531,531],"valid"],[[532,532],"mapped",[533]],[[533,533],"valid"],[[534,534],"mapped",[535]],[[535,535],"valid"],[[536,536],"mapped",[537]],[[537,537],"valid"],[[538,538],"mapped",[539]],[[539,539],"valid"],[[540,540],"mapped",[541]],[[541,541],"valid"],[[542,542],"mapped",[543]],[[543,543],"valid"],[[544,544],"mapped",[414]],[[545,545],"valid"],[[546,546],"mapped",[547]],[[547,547],"valid"],[[548,548],"mapped",[549]],[[549,549],"valid"],[[550,550],"mapped",[551]],[[551,551],"valid"],[[552,552],"mapped",[553]],[[553,553],"valid"],[[554,554],"mapped",[555]],[[555,555],"valid"],[[556,556],"mapped",[557]],[[557,557],"valid"],[[558,558],"mapped",[559]],[[559,559],"valid"],[[560,560],"mapped",[561]],[[561,561],"valid"],[[562,562],"mapped",[563]],[[563,563],"valid"],[[564,566],"valid"],[[567,569],"valid"],[[570,570],"mapped",[11365]],[[571,571],"mapped",[572]],[[572,572],"valid"],[[573,573],"mapped",[410]],[[574,574],"mapped",[11366]],[[575,576],"valid"],[[577,577],"mapped",[578]],[[578,578],"valid"],[[579,579],"mapped",[384]],[[580,580],"mapped",[649]],[[581,581],"mapped",[652]],[[582,582],"mapped",[583]],[[583,583],"valid"],[[584,584],"mapped",[585]],[[585,585],"valid"],[[586,586],"mapped",[587]],[[587,587],"valid"],[[588,588],"mapped",[589]],[[589,589],"valid"],[[590,590],"mapped",[591]],[[591,591],"valid"],[[592,680],"valid"],[[681,685],"valid"],[[686,687],"valid"],[[688,688],"mapped",[104]],[[689,689],"mapped",[614]],[[690,690],"mapped",[106]],[[691,691],"mapped",[114]],[[692,692],"mapped",[633]],[[693,693],"mapped",[635]],[[694,694],"mapped",[641]],[[695,695],"mapped",[119]],[[696,696],"mapped",[121]],[[697,705],"valid"],[[706,709],"valid",[],"NV8"],[[710,721],"valid"],[[722,727],"valid",[],"NV8"],[[728,728],"disallowed_STD3_mapped",[32,774]],[[729,729],"disallowed_STD3_mapped",[32,775]],[[730,730],"disallowed_STD3_mapped",[32,778]],[[731,731],"disallowed_STD3_mapped",[32,808]],[[732,732],"disallowed_STD3_mapped",[32,771]],[[733,733],"disallowed_STD3_mapped",[32,779]],[[734,734],"valid",[],"NV8"],[[735,735],"valid",[],"NV8"],[[736,736],"mapped",[611]],[[737,737],"mapped",[108]],[[738,738],"mapped",[115]],[[739,739],"mapped",[120]],[[740,740],"mapped",[661]],[[741,745],"valid",[],"NV8"],[[746,747],"valid",[],"NV8"],[[748,748],"valid"],[[749,749],"valid",[],"NV8"],[[750,750],"valid"],[[751,767],"valid",[],"NV8"],[[768,831],"valid"],[[832,832],"mapped",[768]],[[833,833],"mapped",[769]],[[834,834],"valid"],[[835,835],"mapped",[787]],[[836,836],"mapped",[776,769]],[[837,837],"mapped",[953]],[[838,846],"valid"],[[847,847],"ignored"],[[848,855],"valid"],[[856,860],"valid"],[[861,863],"valid"],[[864,865],"valid"],[[866,866],"valid"],[[867,879],"valid"],[[880,880],"mapped",[881]],[[881,881],"valid"],[[882,882],"mapped",[883]],[[883,883],"valid"],[[884,884],"mapped",[697]],[[885,885],"valid"],[[886,886],"mapped",[887]],[[887,887],"valid"],[[888,889],"disallowed"],[[890,890],"disallowed_STD3_mapped",[32,953]],[[891,893],"valid"],[[894,894],"disallowed_STD3_mapped",[59]],[[895,895],"mapped",[1011]],[[896,899],"disallowed"],[[900,900],"disallowed_STD3_mapped",[32,769]],[[901,901],"disallowed_STD3_mapped",[32,776,769]],[[902,902],"mapped",[940]],[[903,903],"mapped",[183]],[[904,904],"mapped",[941]],[[905,905],"mapped",[942]],[[906,906],"mapped",[943]],[[907,907],"disallowed"],[[908,908],"mapped",[972]],[[909,909],"disallowed"],[[910,910],"mapped",[973]],[[911,911],"mapped",[974]],[[912,912],"valid"],[[913,913],"mapped",[945]],[[914,914],"mapped",[946]],[[915,915],"mapped",[947]],[[916,916],"mapped",[948]],[[917,917],"mapped",[949]],[[918,918],"mapped",[950]],[[919,919],"mapped",[951]],[[920,920],"mapped",[952]],[[921,921],"mapped",[953]],[[922,922],"mapped",[954]],[[923,923],"mapped",[955]],[[924,924],"mapped",[956]],[[925,925],"mapped",[957]],[[926,926],"mapped",[958]],[[927,927],"mapped",[959]],[[928,928],"mapped",[960]],[[929,929],"mapped",[961]],[[930,930],"disallowed"],[[931,931],"mapped",[963]],[[932,932],"mapped",[964]],[[933,933],"mapped",[965]],[[934,934],"mapped",[966]],[[935,935],"mapped",[967]],[[936,936],"mapped",[968]],[[937,937],"mapped",[969]],[[938,938],"mapped",[970]],[[939,939],"mapped",[971]],[[940,961],"valid"],[[962,962],"deviation",[963]],[[963,974],"valid"],[[975,975],"mapped",[983]],[[976,976],"mapped",[946]],[[977,977],"mapped",[952]],[[978,978],"mapped",[965]],[[979,979],"mapped",[973]],[[980,980],"mapped",[971]],[[981,981],"mapped",[966]],[[982,982],"mapped",[960]],[[983,983],"valid"],[[984,984],"mapped",[985]],[[985,985],"valid"],[[986,986],"mapped",[987]],[[987,987],"valid"],[[988,988],"mapped",[989]],[[989,989],"valid"],[[990,990],"mapped",[991]],[[991,991],"valid"],[[992,992],"mapped",[993]],[[993,993],"valid"],[[994,994],"mapped",[995]],[[995,995],"valid"],[[996,996],"mapped",[997]],[[997,997],"valid"],[[998,998],"mapped",[999]],[[999,999],"valid"],[[1e3,1e3],"mapped",[1001]],[[1001,1001],"valid"],[[1002,1002],"mapped",[1003]],[[1003,1003],"valid"],[[1004,1004],"mapped",[1005]],[[1005,1005],"valid"],[[1006,1006],"mapped",[1007]],[[1007,1007],"valid"],[[1008,1008],"mapped",[954]],[[1009,1009],"mapped",[961]],[[1010,1010],"mapped",[963]],[[1011,1011],"valid"],[[1012,1012],"mapped",[952]],[[1013,1013],"mapped",[949]],[[1014,1014],"valid",[],"NV8"],[[1015,1015],"mapped",[1016]],[[1016,1016],"valid"],[[1017,1017],"mapped",[963]],[[1018,1018],"mapped",[1019]],[[1019,1019],"valid"],[[1020,1020],"valid"],[[1021,1021],"mapped",[891]],[[1022,1022],"mapped",[892]],[[1023,1023],"mapped",[893]],[[1024,1024],"mapped",[1104]],[[1025,1025],"mapped",[1105]],[[1026,1026],"mapped",[1106]],[[1027,1027],"mapped",[1107]],[[1028,1028],"mapped",[1108]],[[1029,1029],"mapped",[1109]],[[1030,1030],"mapped",[1110]],[[1031,1031],"mapped",[1111]],[[1032,1032],"mapped",[1112]],[[1033,1033],"mapped",[1113]],[[1034,1034],"mapped",[1114]],[[1035,1035],"mapped",[1115]],[[1036,1036],"mapped",[1116]],[[1037,1037],"mapped",[1117]],[[1038,1038],"mapped",[1118]],[[1039,1039],"mapped",[1119]],[[1040,1040],"mapped",[1072]],[[1041,1041],"mapped",[1073]],[[1042,1042],"mapped",[1074]],[[1043,1043],"mapped",[1075]],[[1044,1044],"mapped",[1076]],[[1045,1045],"mapped",[1077]],[[1046,1046],"mapped",[1078]],[[1047,1047],"mapped",[1079]],[[1048,1048],"mapped",[1080]],[[1049,1049],"mapped",[1081]],[[1050,1050],"mapped",[1082]],[[1051,1051],"mapped",[1083]],[[1052,1052],"mapped",[1084]],[[1053,1053],"mapped",[1085]],[[1054,1054],"mapped",[1086]],[[1055,1055],"mapped",[1087]],[[1056,1056],"mapped",[1088]],[[1057,1057],"mapped",[1089]],[[1058,1058],"mapped",[1090]],[[1059,1059],"mapped",[1091]],[[1060,1060],"mapped",[1092]],[[1061,1061],"mapped",[1093]],[[1062,1062],"mapped",[1094]],[[1063,1063],"mapped",[1095]],[[1064,1064],"mapped",[1096]],[[1065,1065],"mapped",[1097]],[[1066,1066],"mapped",[1098]],[[1067,1067],"mapped",[1099]],[[1068,1068],"mapped",[1100]],[[1069,1069],"mapped",[1101]],[[1070,1070],"mapped",[1102]],[[1071,1071],"mapped",[1103]],[[1072,1103],"valid"],[[1104,1104],"valid"],[[1105,1116],"valid"],[[1117,1117],"valid"],[[1118,1119],"valid"],[[1120,1120],"mapped",[1121]],[[1121,1121],"valid"],[[1122,1122],"mapped",[1123]],[[1123,1123],"valid"],[[1124,1124],"mapped",[1125]],[[1125,1125],"valid"],[[1126,1126],"mapped",[1127]],[[1127,1127],"valid"],[[1128,1128],"mapped",[1129]],[[1129,1129],"valid"],[[1130,1130],"mapped",[1131]],[[1131,1131],"valid"],[[1132,1132],"mapped",[1133]],[[1133,1133],"valid"],[[1134,1134],"mapped",[1135]],[[1135,1135],"valid"],[[1136,1136],"mapped",[1137]],[[1137,1137],"valid"],[[1138,1138],"mapped",[1139]],[[1139,1139],"valid"],[[1140,1140],"mapped",[1141]],[[1141,1141],"valid"],[[1142,1142],"mapped",[1143]],[[1143,1143],"valid"],[[1144,1144],"mapped",[1145]],[[1145,1145],"valid"],[[1146,1146],"mapped",[1147]],[[1147,1147],"valid"],[[1148,1148],"mapped",[1149]],[[1149,1149],"valid"],[[1150,1150],"mapped",[1151]],[[1151,1151],"valid"],[[1152,1152],"mapped",[1153]],[[1153,1153],"valid"],[[1154,1154],"valid",[],"NV8"],[[1155,1158],"valid"],[[1159,1159],"valid"],[[1160,1161],"valid",[],"NV8"],[[1162,1162],"mapped",[1163]],[[1163,1163],"valid"],[[1164,1164],"mapped",[1165]],[[1165,1165],"valid"],[[1166,1166],"mapped",[1167]],[[1167,1167],"valid"],[[1168,1168],"mapped",[1169]],[[1169,1169],"valid"],[[1170,1170],"mapped",[1171]],[[1171,1171],"valid"],[[1172,1172],"mapped",[1173]],[[1173,1173],"valid"],[[1174,1174],"mapped",[1175]],[[1175,1175],"valid"],[[1176,1176],"mapped",[1177]],[[1177,1177],"valid"],[[1178,1178],"mapped",[1179]],[[1179,1179],"valid"],[[1180,1180],"mapped",[1181]],[[1181,1181],"valid"],[[1182,1182],"mapped",[1183]],[[1183,1183],"valid"],[[1184,1184],"mapped",[1185]],[[1185,1185],"valid"],[[1186,1186],"mapped",[1187]],[[1187,1187],"valid"],[[1188,1188],"mapped",[1189]],[[1189,1189],"valid"],[[1190,1190],"mapped",[1191]],[[1191,1191],"valid"],[[1192,1192],"mapped",[1193]],[[1193,1193],"valid"],[[1194,1194],"mapped",[1195]],[[1195,1195],"valid"],[[1196,1196],"mapped",[1197]],[[1197,1197],"valid"],[[1198,1198],"mapped",[1199]],[[1199,1199],"valid"],[[1200,1200],"mapped",[1201]],[[1201,1201],"valid"],[[1202,1202],"mapped",[1203]],[[1203,1203],"valid"],[[1204,1204],"mapped",[1205]],[[1205,1205],"valid"],[[1206,1206],"mapped",[1207]],[[1207,1207],"valid"],[[1208,1208],"mapped",[1209]],[[1209,1209],"valid"],[[1210,1210],"mapped",[1211]],[[1211,1211],"valid"],[[1212,1212],"mapped",[1213]],[[1213,1213],"valid"],[[1214,1214],"mapped",[1215]],[[1215,1215],"valid"],[[1216,1216],"disallowed"],[[1217,1217],"mapped",[1218]],[[1218,1218],"valid"],[[1219,1219],"mapped",[1220]],[[1220,1220],"valid"],[[1221,1221],"mapped",[1222]],[[1222,1222],"valid"],[[1223,1223],"mapped",[1224]],[[1224,1224],"valid"],[[1225,1225],"mapped",[1226]],[[1226,1226],"valid"],[[1227,1227],"mapped",[1228]],[[1228,1228],"valid"],[[1229,1229],"mapped",[1230]],[[1230,1230],"valid"],[[1231,1231],"valid"],[[1232,1232],"mapped",[1233]],[[1233,1233],"valid"],[[1234,1234],"mapped",[1235]],[[1235,1235],"valid"],[[1236,1236],"mapped",[1237]],[[1237,1237],"valid"],[[1238,1238],"mapped",[1239]],[[1239,1239],"valid"],[[1240,1240],"mapped",[1241]],[[1241,1241],"valid"],[[1242,1242],"mapped",[1243]],[[1243,1243],"valid"],[[1244,1244],"mapped",[1245]],[[1245,1245],"valid"],[[1246,1246],"mapped",[1247]],[[1247,1247],"valid"],[[1248,1248],"mapped",[1249]],[[1249,1249],"valid"],[[1250,1250],"mapped",[1251]],[[1251,1251],"valid"],[[1252,1252],"mapped",[1253]],[[1253,1253],"valid"],[[1254,1254],"mapped",[1255]],[[1255,1255],"valid"],[[1256,1256],"mapped",[1257]],[[1257,1257],"valid"],[[1258,1258],"mapped",[1259]],[[1259,1259],"valid"],[[1260,1260],"mapped",[1261]],[[1261,1261],"valid"],[[1262,1262],"mapped",[1263]],[[1263,1263],"valid"],[[1264,1264],"mapped",[1265]],[[1265,1265],"valid"],[[1266,1266],"mapped",[1267]],[[1267,1267],"valid"],[[1268,1268],"mapped",[1269]],[[1269,1269],"valid"],[[1270,1270],"mapped",[1271]],[[1271,1271],"valid"],[[1272,1272],"mapped",[1273]],[[1273,1273],"valid"],[[1274,1274],"mapped",[1275]],[[1275,1275],"valid"],[[1276,1276],"mapped",[1277]],[[1277,1277],"valid"],[[1278,1278],"mapped",[1279]],[[1279,1279],"valid"],[[1280,1280],"mapped",[1281]],[[1281,1281],"valid"],[[1282,1282],"mapped",[1283]],[[1283,1283],"valid"],[[1284,1284],"mapped",[1285]],[[1285,1285],"valid"],[[1286,1286],"mapped",[1287]],[[1287,1287],"valid"],[[1288,1288],"mapped",[1289]],[[1289,1289],"valid"],[[1290,1290],"mapped",[1291]],[[1291,1291],"valid"],[[1292,1292],"mapped",[1293]],[[1293,1293],"valid"],[[1294,1294],"mapped",[1295]],[[1295,1295],"valid"],[[1296,1296],"mapped",[1297]],[[1297,1297],"valid"],[[1298,1298],"mapped",[1299]],[[1299,1299],"valid"],[[1300,1300],"mapped",[1301]],[[1301,1301],"valid"],[[1302,1302],"mapped",[1303]],[[1303,1303],"valid"],[[1304,1304],"mapped",[1305]],[[1305,1305],"valid"],[[1306,1306],"mapped",[1307]],[[1307,1307],"valid"],[[1308,1308],"mapped",[1309]],[[1309,1309],"valid"],[[1310,1310],"mapped",[1311]],[[1311,1311],"valid"],[[1312,1312],"mapped",[1313]],[[1313,1313],"valid"],[[1314,1314],"mapped",[1315]],[[1315,1315],"valid"],[[1316,1316],"mapped",[1317]],[[1317,1317],"valid"],[[1318,1318],"mapped",[1319]],[[1319,1319],"valid"],[[1320,1320],"mapped",[1321]],[[1321,1321],"valid"],[[1322,1322],"mapped",[1323]],[[1323,1323],"valid"],[[1324,1324],"mapped",[1325]],[[1325,1325],"valid"],[[1326,1326],"mapped",[1327]],[[1327,1327],"valid"],[[1328,1328],"disallowed"],[[1329,1329],"mapped",[1377]],[[1330,1330],"mapped",[1378]],[[1331,1331],"mapped",[1379]],[[1332,1332],"mapped",[1380]],[[1333,1333],"mapped",[1381]],[[1334,1334],"mapped",[1382]],[[1335,1335],"mapped",[1383]],[[1336,1336],"mapped",[1384]],[[1337,1337],"mapped",[1385]],[[1338,1338],"mapped",[1386]],[[1339,1339],"mapped",[1387]],[[1340,1340],"mapped",[1388]],[[1341,1341],"mapped",[1389]],[[1342,1342],"mapped",[1390]],[[1343,1343],"mapped",[1391]],[[1344,1344],"mapped",[1392]],[[1345,1345],"mapped",[1393]],[[1346,1346],"mapped",[1394]],[[1347,1347],"mapped",[1395]],[[1348,1348],"mapped",[1396]],[[1349,1349],"mapped",[1397]],[[1350,1350],"mapped",[1398]],[[1351,1351],"mapped",[1399]],[[1352,1352],"mapped",[1400]],[[1353,1353],"mapped",[1401]],[[1354,1354],"mapped",[1402]],[[1355,1355],"mapped",[1403]],[[1356,1356],"mapped",[1404]],[[1357,1357],"mapped",[1405]],[[1358,1358],"mapped",[1406]],[[1359,1359],"mapped",[1407]],[[1360,1360],"mapped",[1408]],[[1361,1361],"mapped",[1409]],[[1362,1362],"mapped",[1410]],[[1363,1363],"mapped",[1411]],[[1364,1364],"mapped",[1412]],[[1365,1365],"mapped",[1413]],[[1366,1366],"mapped",[1414]],[[1367,1368],"disallowed"],[[1369,1369],"valid"],[[1370,1375],"valid",[],"NV8"],[[1376,1376],"disallowed"],[[1377,1414],"valid"],[[1415,1415],"mapped",[1381,1410]],[[1416,1416],"disallowed"],[[1417,1417],"valid",[],"NV8"],[[1418,1418],"valid",[],"NV8"],[[1419,1420],"disallowed"],[[1421,1422],"valid",[],"NV8"],[[1423,1423],"valid",[],"NV8"],[[1424,1424],"disallowed"],[[1425,1441],"valid"],[[1442,1442],"valid"],[[1443,1455],"valid"],[[1456,1465],"valid"],[[1466,1466],"valid"],[[1467,1469],"valid"],[[1470,1470],"valid",[],"NV8"],[[1471,1471],"valid"],[[1472,1472],"valid",[],"NV8"],[[1473,1474],"valid"],[[1475,1475],"valid",[],"NV8"],[[1476,1476],"valid"],[[1477,1477],"valid"],[[1478,1478],"valid",[],"NV8"],[[1479,1479],"valid"],[[1480,1487],"disallowed"],[[1488,1514],"valid"],[[1515,1519],"disallowed"],[[1520,1524],"valid"],[[1525,1535],"disallowed"],[[1536,1539],"disallowed"],[[1540,1540],"disallowed"],[[1541,1541],"disallowed"],[[1542,1546],"valid",[],"NV8"],[[1547,1547],"valid",[],"NV8"],[[1548,1548],"valid",[],"NV8"],[[1549,1551],"valid",[],"NV8"],[[1552,1557],"valid"],[[1558,1562],"valid"],[[1563,1563],"valid",[],"NV8"],[[1564,1564],"disallowed"],[[1565,1565],"disallowed"],[[1566,1566],"valid",[],"NV8"],[[1567,1567],"valid",[],"NV8"],[[1568,1568],"valid"],[[1569,1594],"valid"],[[1595,1599],"valid"],[[1600,1600],"valid",[],"NV8"],[[1601,1618],"valid"],[[1619,1621],"valid"],[[1622,1624],"valid"],[[1625,1630],"valid"],[[1631,1631],"valid"],[[1632,1641],"valid"],[[1642,1645],"valid",[],"NV8"],[[1646,1647],"valid"],[[1648,1652],"valid"],[[1653,1653],"mapped",[1575,1652]],[[1654,1654],"mapped",[1608,1652]],[[1655,1655],"mapped",[1735,1652]],[[1656,1656],"mapped",[1610,1652]],[[1657,1719],"valid"],[[1720,1721],"valid"],[[1722,1726],"valid"],[[1727,1727],"valid"],[[1728,1742],"valid"],[[1743,1743],"valid"],[[1744,1747],"valid"],[[1748,1748],"valid",[],"NV8"],[[1749,1756],"valid"],[[1757,1757],"disallowed"],[[1758,1758],"valid",[],"NV8"],[[1759,1768],"valid"],[[1769,1769],"valid",[],"NV8"],[[1770,1773],"valid"],[[1774,1775],"valid"],[[1776,1785],"valid"],[[1786,1790],"valid"],[[1791,1791],"valid"],[[1792,1805],"valid",[],"NV8"],[[1806,1806],"disallowed"],[[1807,1807],"disallowed"],[[1808,1836],"valid"],[[1837,1839],"valid"],[[1840,1866],"valid"],[[1867,1868],"disallowed"],[[1869,1871],"valid"],[[1872,1901],"valid"],[[1902,1919],"valid"],[[1920,1968],"valid"],[[1969,1969],"valid"],[[1970,1983],"disallowed"],[[1984,2037],"valid"],[[2038,2042],"valid",[],"NV8"],[[2043,2047],"disallowed"],[[2048,2093],"valid"],[[2094,2095],"disallowed"],[[2096,2110],"valid",[],"NV8"],[[2111,2111],"disallowed"],[[2112,2139],"valid"],[[2140,2141],"disallowed"],[[2142,2142],"valid",[],"NV8"],[[2143,2207],"disallowed"],[[2208,2208],"valid"],[[2209,2209],"valid"],[[2210,2220],"valid"],[[2221,2226],"valid"],[[2227,2228],"valid"],[[2229,2274],"disallowed"],[[2275,2275],"valid"],[[2276,2302],"valid"],[[2303,2303],"valid"],[[2304,2304],"valid"],[[2305,2307],"valid"],[[2308,2308],"valid"],[[2309,2361],"valid"],[[2362,2363],"valid"],[[2364,2381],"valid"],[[2382,2382],"valid"],[[2383,2383],"valid"],[[2384,2388],"valid"],[[2389,2389],"valid"],[[2390,2391],"valid"],[[2392,2392],"mapped",[2325,2364]],[[2393,2393],"mapped",[2326,2364]],[[2394,2394],"mapped",[2327,2364]],[[2395,2395],"mapped",[2332,2364]],[[2396,2396],"mapped",[2337,2364]],[[2397,2397],"mapped",[2338,2364]],[[2398,2398],"mapped",[2347,2364]],[[2399,2399],"mapped",[2351,2364]],[[2400,2403],"valid"],[[2404,2405],"valid",[],"NV8"],[[2406,2415],"valid"],[[2416,2416],"valid",[],"NV8"],[[2417,2418],"valid"],[[2419,2423],"valid"],[[2424,2424],"valid"],[[2425,2426],"valid"],[[2427,2428],"valid"],[[2429,2429],"valid"],[[2430,2431],"valid"],[[2432,2432],"valid"],[[2433,2435],"valid"],[[2436,2436],"disallowed"],[[2437,2444],"valid"],[[2445,2446],"disallowed"],[[2447,2448],"valid"],[[2449,2450],"disallowed"],[[2451,2472],"valid"],[[2473,2473],"disallowed"],[[2474,2480],"valid"],[[2481,2481],"disallowed"],[[2482,2482],"valid"],[[2483,2485],"disallowed"],[[2486,2489],"valid"],[[2490,2491],"disallowed"],[[2492,2492],"valid"],[[2493,2493],"valid"],[[2494,2500],"valid"],[[2501,2502],"disallowed"],[[2503,2504],"valid"],[[2505,2506],"disallowed"],[[2507,2509],"valid"],[[2510,2510],"valid"],[[2511,2518],"disallowed"],[[2519,2519],"valid"],[[2520,2523],"disallowed"],[[2524,2524],"mapped",[2465,2492]],[[2525,2525],"mapped",[2466,2492]],[[2526,2526],"disallowed"],[[2527,2527],"mapped",[2479,2492]],[[2528,2531],"valid"],[[2532,2533],"disallowed"],[[2534,2545],"valid"],[[2546,2554],"valid",[],"NV8"],[[2555,2555],"valid",[],"NV8"],[[2556,2560],"disallowed"],[[2561,2561],"valid"],[[2562,2562],"valid"],[[2563,2563],"valid"],[[2564,2564],"disallowed"],[[2565,2570],"valid"],[[2571,2574],"disallowed"],[[2575,2576],"valid"],[[2577,2578],"disallowed"],[[2579,2600],"valid"],[[2601,2601],"disallowed"],[[2602,2608],"valid"],[[2609,2609],"disallowed"],[[2610,2610],"valid"],[[2611,2611],"mapped",[2610,2620]],[[2612,2612],"disallowed"],[[2613,2613],"valid"],[[2614,2614],"mapped",[2616,2620]],[[2615,2615],"disallowed"],[[2616,2617],"valid"],[[2618,2619],"disallowed"],[[2620,2620],"valid"],[[2621,2621],"disallowed"],[[2622,2626],"valid"],[[2627,2630],"disallowed"],[[2631,2632],"valid"],[[2633,2634],"disallowed"],[[2635,2637],"valid"],[[2638,2640],"disallowed"],[[2641,2641],"valid"],[[2642,2648],"disallowed"],[[2649,2649],"mapped",[2582,2620]],[[2650,2650],"mapped",[2583,2620]],[[2651,2651],"mapped",[2588,2620]],[[2652,2652],"valid"],[[2653,2653],"disallowed"],[[2654,2654],"mapped",[2603,2620]],[[2655,2661],"disallowed"],[[2662,2676],"valid"],[[2677,2677],"valid"],[[2678,2688],"disallowed"],[[2689,2691],"valid"],[[2692,2692],"disallowed"],[[2693,2699],"valid"],[[2700,2700],"valid"],[[2701,2701],"valid"],[[2702,2702],"disallowed"],[[2703,2705],"valid"],[[2706,2706],"disallowed"],[[2707,2728],"valid"],[[2729,2729],"disallowed"],[[2730,2736],"valid"],[[2737,2737],"disallowed"],[[2738,2739],"valid"],[[2740,2740],"disallowed"],[[2741,2745],"valid"],[[2746,2747],"disallowed"],[[2748,2757],"valid"],[[2758,2758],"disallowed"],[[2759,2761],"valid"],[[2762,2762],"disallowed"],[[2763,2765],"valid"],[[2766,2767],"disallowed"],[[2768,2768],"valid"],[[2769,2783],"disallowed"],[[2784,2784],"valid"],[[2785,2787],"valid"],[[2788,2789],"disallowed"],[[2790,2799],"valid"],[[2800,2800],"valid",[],"NV8"],[[2801,2801],"valid",[],"NV8"],[[2802,2808],"disallowed"],[[2809,2809],"valid"],[[2810,2816],"disallowed"],[[2817,2819],"valid"],[[2820,2820],"disallowed"],[[2821,2828],"valid"],[[2829,2830],"disallowed"],[[2831,2832],"valid"],[[2833,2834],"disallowed"],[[2835,2856],"valid"],[[2857,2857],"disallowed"],[[2858,2864],"valid"],[[2865,2865],"disallowed"],[[2866,2867],"valid"],[[2868,2868],"disallowed"],[[2869,2869],"valid"],[[2870,2873],"valid"],[[2874,2875],"disallowed"],[[2876,2883],"valid"],[[2884,2884],"valid"],[[2885,2886],"disallowed"],[[2887,2888],"valid"],[[2889,2890],"disallowed"],[[2891,2893],"valid"],[[2894,2901],"disallowed"],[[2902,2903],"valid"],[[2904,2907],"disallowed"],[[2908,2908],"mapped",[2849,2876]],[[2909,2909],"mapped",[2850,2876]],[[2910,2910],"disallowed"],[[2911,2913],"valid"],[[2914,2915],"valid"],[[2916,2917],"disallowed"],[[2918,2927],"valid"],[[2928,2928],"valid",[],"NV8"],[[2929,2929],"valid"],[[2930,2935],"valid",[],"NV8"],[[2936,2945],"disallowed"],[[2946,2947],"valid"],[[2948,2948],"disallowed"],[[2949,2954],"valid"],[[2955,2957],"disallowed"],[[2958,2960],"valid"],[[2961,2961],"disallowed"],[[2962,2965],"valid"],[[2966,2968],"disallowed"],[[2969,2970],"valid"],[[2971,2971],"disallowed"],[[2972,2972],"valid"],[[2973,2973],"disallowed"],[[2974,2975],"valid"],[[2976,2978],"disallowed"],[[2979,2980],"valid"],[[2981,2983],"disallowed"],[[2984,2986],"valid"],[[2987,2989],"disallowed"],[[2990,2997],"valid"],[[2998,2998],"valid"],[[2999,3001],"valid"],[[3002,3005],"disallowed"],[[3006,3010],"valid"],[[3011,3013],"disallowed"],[[3014,3016],"valid"],[[3017,3017],"disallowed"],[[3018,3021],"valid"],[[3022,3023],"disallowed"],[[3024,3024],"valid"],[[3025,3030],"disallowed"],[[3031,3031],"valid"],[[3032,3045],"disallowed"],[[3046,3046],"valid"],[[3047,3055],"valid"],[[3056,3058],"valid",[],"NV8"],[[3059,3066],"valid",[],"NV8"],[[3067,3071],"disallowed"],[[3072,3072],"valid"],[[3073,3075],"valid"],[[3076,3076],"disallowed"],[[3077,3084],"valid"],[[3085,3085],"disallowed"],[[3086,3088],"valid"],[[3089,3089],"disallowed"],[[3090,3112],"valid"],[[3113,3113],"disallowed"],[[3114,3123],"valid"],[[3124,3124],"valid"],[[3125,3129],"valid"],[[3130,3132],"disallowed"],[[3133,3133],"valid"],[[3134,3140],"valid"],[[3141,3141],"disallowed"],[[3142,3144],"valid"],[[3145,3145],"disallowed"],[[3146,3149],"valid"],[[3150,3156],"disallowed"],[[3157,3158],"valid"],[[3159,3159],"disallowed"],[[3160,3161],"valid"],[[3162,3162],"valid"],[[3163,3167],"disallowed"],[[3168,3169],"valid"],[[3170,3171],"valid"],[[3172,3173],"disallowed"],[[3174,3183],"valid"],[[3184,3191],"disallowed"],[[3192,3199],"valid",[],"NV8"],[[3200,3200],"disallowed"],[[3201,3201],"valid"],[[3202,3203],"valid"],[[3204,3204],"disallowed"],[[3205,3212],"valid"],[[3213,3213],"disallowed"],[[3214,3216],"valid"],[[3217,3217],"disallowed"],[[3218,3240],"valid"],[[3241,3241],"disallowed"],[[3242,3251],"valid"],[[3252,3252],"disallowed"],[[3253,3257],"valid"],[[3258,3259],"disallowed"],[[3260,3261],"valid"],[[3262,3268],"valid"],[[3269,3269],"disallowed"],[[3270,3272],"valid"],[[3273,3273],"disallowed"],[[3274,3277],"valid"],[[3278,3284],"disallowed"],[[3285,3286],"valid"],[[3287,3293],"disallowed"],[[3294,3294],"valid"],[[3295,3295],"disallowed"],[[3296,3297],"valid"],[[3298,3299],"valid"],[[3300,3301],"disallowed"],[[3302,3311],"valid"],[[3312,3312],"disallowed"],[[3313,3314],"valid"],[[3315,3328],"disallowed"],[[3329,3329],"valid"],[[3330,3331],"valid"],[[3332,3332],"disallowed"],[[3333,3340],"valid"],[[3341,3341],"disallowed"],[[3342,3344],"valid"],[[3345,3345],"disallowed"],[[3346,3368],"valid"],[[3369,3369],"valid"],[[3370,3385],"valid"],[[3386,3386],"valid"],[[3387,3388],"disallowed"],[[3389,3389],"valid"],[[3390,3395],"valid"],[[3396,3396],"valid"],[[3397,3397],"disallowed"],[[3398,3400],"valid"],[[3401,3401],"disallowed"],[[3402,3405],"valid"],[[3406,3406],"valid"],[[3407,3414],"disallowed"],[[3415,3415],"valid"],[[3416,3422],"disallowed"],[[3423,3423],"valid"],[[3424,3425],"valid"],[[3426,3427],"valid"],[[3428,3429],"disallowed"],[[3430,3439],"valid"],[[3440,3445],"valid",[],"NV8"],[[3446,3448],"disallowed"],[[3449,3449],"valid",[],"NV8"],[[3450,3455],"valid"],[[3456,3457],"disallowed"],[[3458,3459],"valid"],[[3460,3460],"disallowed"],[[3461,3478],"valid"],[[3479,3481],"disallowed"],[[3482,3505],"valid"],[[3506,3506],"disallowed"],[[3507,3515],"valid"],[[3516,3516],"disallowed"],[[3517,3517],"valid"],[[3518,3519],"disallowed"],[[3520,3526],"valid"],[[3527,3529],"disallowed"],[[3530,3530],"valid"],[[3531,3534],"disallowed"],[[3535,3540],"valid"],[[3541,3541],"disallowed"],[[3542,3542],"valid"],[[3543,3543],"disallowed"],[[3544,3551],"valid"],[[3552,3557],"disallowed"],[[3558,3567],"valid"],[[3568,3569],"disallowed"],[[3570,3571],"valid"],[[3572,3572],"valid",[],"NV8"],[[3573,3584],"disallowed"],[[3585,3634],"valid"],[[3635,3635],"mapped",[3661,3634]],[[3636,3642],"valid"],[[3643,3646],"disallowed"],[[3647,3647],"valid",[],"NV8"],[[3648,3662],"valid"],[[3663,3663],"valid",[],"NV8"],[[3664,3673],"valid"],[[3674,3675],"valid",[],"NV8"],[[3676,3712],"disallowed"],[[3713,3714],"valid"],[[3715,3715],"disallowed"],[[3716,3716],"valid"],[[3717,3718],"disallowed"],[[3719,3720],"valid"],[[3721,3721],"disallowed"],[[3722,3722],"valid"],[[3723,3724],"disallowed"],[[3725,3725],"valid"],[[3726,3731],"disallowed"],[[3732,3735],"valid"],[[3736,3736],"disallowed"],[[3737,3743],"valid"],[[3744,3744],"disallowed"],[[3745,3747],"valid"],[[3748,3748],"disallowed"],[[3749,3749],"valid"],[[3750,3750],"disallowed"],[[3751,3751],"valid"],[[3752,3753],"disallowed"],[[3754,3755],"valid"],[[3756,3756],"disallowed"],[[3757,3762],"valid"],[[3763,3763],"mapped",[3789,3762]],[[3764,3769],"valid"],[[3770,3770],"disallowed"],[[3771,3773],"valid"],[[3774,3775],"disallowed"],[[3776,3780],"valid"],[[3781,3781],"disallowed"],[[3782,3782],"valid"],[[3783,3783],"disallowed"],[[3784,3789],"valid"],[[3790,3791],"disallowed"],[[3792,3801],"valid"],[[3802,3803],"disallowed"],[[3804,3804],"mapped",[3755,3737]],[[3805,3805],"mapped",[3755,3745]],[[3806,3807],"valid"],[[3808,3839],"disallowed"],[[3840,3840],"valid"],[[3841,3850],"valid",[],"NV8"],[[3851,3851],"valid"],[[3852,3852],"mapped",[3851]],[[3853,3863],"valid",[],"NV8"],[[3864,3865],"valid"],[[3866,3871],"valid",[],"NV8"],[[3872,3881],"valid"],[[3882,3892],"valid",[],"NV8"],[[3893,3893],"valid"],[[3894,3894],"valid",[],"NV8"],[[3895,3895],"valid"],[[3896,3896],"valid",[],"NV8"],[[3897,3897],"valid"],[[3898,3901],"valid",[],"NV8"],[[3902,3906],"valid"],[[3907,3907],"mapped",[3906,4023]],[[3908,3911],"valid"],[[3912,3912],"disallowed"],[[3913,3916],"valid"],[[3917,3917],"mapped",[3916,4023]],[[3918,3921],"valid"],[[3922,3922],"mapped",[3921,4023]],[[3923,3926],"valid"],[[3927,3927],"mapped",[3926,4023]],[[3928,3931],"valid"],[[3932,3932],"mapped",[3931,4023]],[[3933,3944],"valid"],[[3945,3945],"mapped",[3904,4021]],[[3946,3946],"valid"],[[3947,3948],"valid"],[[3949,3952],"disallowed"],[[3953,3954],"valid"],[[3955,3955],"mapped",[3953,3954]],[[3956,3956],"valid"],[[3957,3957],"mapped",[3953,3956]],[[3958,3958],"mapped",[4018,3968]],[[3959,3959],"mapped",[4018,3953,3968]],[[3960,3960],"mapped",[4019,3968]],[[3961,3961],"mapped",[4019,3953,3968]],[[3962,3968],"valid"],[[3969,3969],"mapped",[3953,3968]],[[3970,3972],"valid"],[[3973,3973],"valid",[],"NV8"],[[3974,3979],"valid"],[[3980,3983],"valid"],[[3984,3986],"valid"],[[3987,3987],"mapped",[3986,4023]],[[3988,3989],"valid"],[[3990,3990],"valid"],[[3991,3991],"valid"],[[3992,3992],"disallowed"],[[3993,3996],"valid"],[[3997,3997],"mapped",[3996,4023]],[[3998,4001],"valid"],[[4002,4002],"mapped",[4001,4023]],[[4003,4006],"valid"],[[4007,4007],"mapped",[4006,4023]],[[4008,4011],"valid"],[[4012,4012],"mapped",[4011,4023]],[[4013,4013],"valid"],[[4014,4016],"valid"],[[4017,4023],"valid"],[[4024,4024],"valid"],[[4025,4025],"mapped",[3984,4021]],[[4026,4028],"valid"],[[4029,4029],"disallowed"],[[4030,4037],"valid",[],"NV8"],[[4038,4038],"valid"],[[4039,4044],"valid",[],"NV8"],[[4045,4045],"disallowed"],[[4046,4046],"valid",[],"NV8"],[[4047,4047],"valid",[],"NV8"],[[4048,4049],"valid",[],"NV8"],[[4050,4052],"valid",[],"NV8"],[[4053,4056],"valid",[],"NV8"],[[4057,4058],"valid",[],"NV8"],[[4059,4095],"disallowed"],[[4096,4129],"valid"],[[4130,4130],"valid"],[[4131,4135],"valid"],[[4136,4136],"valid"],[[4137,4138],"valid"],[[4139,4139],"valid"],[[4140,4146],"valid"],[[4147,4149],"valid"],[[4150,4153],"valid"],[[4154,4159],"valid"],[[4160,4169],"valid"],[[4170,4175],"valid",[],"NV8"],[[4176,4185],"valid"],[[4186,4249],"valid"],[[4250,4253],"valid"],[[4254,4255],"valid",[],"NV8"],[[4256,4293],"disallowed"],[[4294,4294],"disallowed"],[[4295,4295],"mapped",[11559]],[[4296,4300],"disallowed"],[[4301,4301],"mapped",[11565]],[[4302,4303],"disallowed"],[[4304,4342],"valid"],[[4343,4344],"valid"],[[4345,4346],"valid"],[[4347,4347],"valid",[],"NV8"],[[4348,4348],"mapped",[4316]],[[4349,4351],"valid"],[[4352,4441],"valid",[],"NV8"],[[4442,4446],"valid",[],"NV8"],[[4447,4448],"disallowed"],[[4449,4514],"valid",[],"NV8"],[[4515,4519],"valid",[],"NV8"],[[4520,4601],"valid",[],"NV8"],[[4602,4607],"valid",[],"NV8"],[[4608,4614],"valid"],[[4615,4615],"valid"],[[4616,4678],"valid"],[[4679,4679],"valid"],[[4680,4680],"valid"],[[4681,4681],"disallowed"],[[4682,4685],"valid"],[[4686,4687],"disallowed"],[[4688,4694],"valid"],[[4695,4695],"disallowed"],[[4696,4696],"valid"],[[4697,4697],"disallowed"],[[4698,4701],"valid"],[[4702,4703],"disallowed"],[[4704,4742],"valid"],[[4743,4743],"valid"],[[4744,4744],"valid"],[[4745,4745],"disallowed"],[[4746,4749],"valid"],[[4750,4751],"disallowed"],[[4752,4782],"valid"],[[4783,4783],"valid"],[[4784,4784],"valid"],[[4785,4785],"disallowed"],[[4786,4789],"valid"],[[4790,4791],"disallowed"],[[4792,4798],"valid"],[[4799,4799],"disallowed"],[[4800,4800],"valid"],[[4801,4801],"disallowed"],[[4802,4805],"valid"],[[4806,4807],"disallowed"],[[4808,4814],"valid"],[[4815,4815],"valid"],[[4816,4822],"valid"],[[4823,4823],"disallowed"],[[4824,4846],"valid"],[[4847,4847],"valid"],[[4848,4878],"valid"],[[4879,4879],"valid"],[[4880,4880],"valid"],[[4881,4881],"disallowed"],[[4882,4885],"valid"],[[4886,4887],"disallowed"],[[4888,4894],"valid"],[[4895,4895],"valid"],[[4896,4934],"valid"],[[4935,4935],"valid"],[[4936,4954],"valid"],[[4955,4956],"disallowed"],[[4957,4958],"valid"],[[4959,4959],"valid"],[[4960,4960],"valid",[],"NV8"],[[4961,4988],"valid",[],"NV8"],[[4989,4991],"disallowed"],[[4992,5007],"valid"],[[5008,5017],"valid",[],"NV8"],[[5018,5023],"disallowed"],[[5024,5108],"valid"],[[5109,5109],"valid"],[[5110,5111],"disallowed"],[[5112,5112],"mapped",[5104]],[[5113,5113],"mapped",[5105]],[[5114,5114],"mapped",[5106]],[[5115,5115],"mapped",[5107]],[[5116,5116],"mapped",[5108]],[[5117,5117],"mapped",[5109]],[[5118,5119],"disallowed"],[[5120,5120],"valid",[],"NV8"],[[5121,5740],"valid"],[[5741,5742],"valid",[],"NV8"],[[5743,5750],"valid"],[[5751,5759],"valid"],[[5760,5760],"disallowed"],[[5761,5786],"valid"],[[5787,5788],"valid",[],"NV8"],[[5789,5791],"disallowed"],[[5792,5866],"valid"],[[5867,5872],"valid",[],"NV8"],[[5873,5880],"valid"],[[5881,5887],"disallowed"],[[5888,5900],"valid"],[[5901,5901],"disallowed"],[[5902,5908],"valid"],[[5909,5919],"disallowed"],[[5920,5940],"valid"],[[5941,5942],"valid",[],"NV8"],[[5943,5951],"disallowed"],[[5952,5971],"valid"],[[5972,5983],"disallowed"],[[5984,5996],"valid"],[[5997,5997],"disallowed"],[[5998,6e3],"valid"],[[6001,6001],"disallowed"],[[6002,6003],"valid"],[[6004,6015],"disallowed"],[[6016,6067],"valid"],[[6068,6069],"disallowed"],[[6070,6099],"valid"],[[6100,6102],"valid",[],"NV8"],[[6103,6103],"valid"],[[6104,6107],"valid",[],"NV8"],[[6108,6108],"valid"],[[6109,6109],"valid"],[[6110,6111],"disallowed"],[[6112,6121],"valid"],[[6122,6127],"disallowed"],[[6128,6137],"valid",[],"NV8"],[[6138,6143],"disallowed"],[[6144,6149],"valid",[],"NV8"],[[6150,6150],"disallowed"],[[6151,6154],"valid",[],"NV8"],[[6155,6157],"ignored"],[[6158,6158],"disallowed"],[[6159,6159],"disallowed"],[[6160,6169],"valid"],[[6170,6175],"disallowed"],[[6176,6263],"valid"],[[6264,6271],"disallowed"],[[6272,6313],"valid"],[[6314,6314],"valid"],[[6315,6319],"disallowed"],[[6320,6389],"valid"],[[6390,6399],"disallowed"],[[6400,6428],"valid"],[[6429,6430],"valid"],[[6431,6431],"disallowed"],[[6432,6443],"valid"],[[6444,6447],"disallowed"],[[6448,6459],"valid"],[[6460,6463],"disallowed"],[[6464,6464],"valid",[],"NV8"],[[6465,6467],"disallowed"],[[6468,6469],"valid",[],"NV8"],[[6470,6509],"valid"],[[6510,6511],"disallowed"],[[6512,6516],"valid"],[[6517,6527],"disallowed"],[[6528,6569],"valid"],[[6570,6571],"valid"],[[6572,6575],"disallowed"],[[6576,6601],"valid"],[[6602,6607],"disallowed"],[[6608,6617],"valid"],[[6618,6618],"valid",[],"XV8"],[[6619,6621],"disallowed"],[[6622,6623],"valid",[],"NV8"],[[6624,6655],"valid",[],"NV8"],[[6656,6683],"valid"],[[6684,6685],"disallowed"],[[6686,6687],"valid",[],"NV8"],[[6688,6750],"valid"],[[6751,6751],"disallowed"],[[6752,6780],"valid"],[[6781,6782],"disallowed"],[[6783,6793],"valid"],[[6794,6799],"disallowed"],[[6800,6809],"valid"],[[6810,6815],"disallowed"],[[6816,6822],"valid",[],"NV8"],[[6823,6823],"valid"],[[6824,6829],"valid",[],"NV8"],[[6830,6831],"disallowed"],[[6832,6845],"valid"],[[6846,6846],"valid",[],"NV8"],[[6847,6911],"disallowed"],[[6912,6987],"valid"],[[6988,6991],"disallowed"],[[6992,7001],"valid"],[[7002,7018],"valid",[],"NV8"],[[7019,7027],"valid"],[[7028,7036],"valid",[],"NV8"],[[7037,7039],"disallowed"],[[7040,7082],"valid"],[[7083,7085],"valid"],[[7086,7097],"valid"],[[7098,7103],"valid"],[[7104,7155],"valid"],[[7156,7163],"disallowed"],[[7164,7167],"valid",[],"NV8"],[[7168,7223],"valid"],[[7224,7226],"disallowed"],[[7227,7231],"valid",[],"NV8"],[[7232,7241],"valid"],[[7242,7244],"disallowed"],[[7245,7293],"valid"],[[7294,7295],"valid",[],"NV8"],[[7296,7359],"disallowed"],[[7360,7367],"valid",[],"NV8"],[[7368,7375],"disallowed"],[[7376,7378],"valid"],[[7379,7379],"valid",[],"NV8"],[[7380,7410],"valid"],[[7411,7414],"valid"],[[7415,7415],"disallowed"],[[7416,7417],"valid"],[[7418,7423],"disallowed"],[[7424,7467],"valid"],[[7468,7468],"mapped",[97]],[[7469,7469],"mapped",[230]],[[7470,7470],"mapped",[98]],[[7471,7471],"valid"],[[7472,7472],"mapped",[100]],[[7473,7473],"mapped",[101]],[[7474,7474],"mapped",[477]],[[7475,7475],"mapped",[103]],[[7476,7476],"mapped",[104]],[[7477,7477],"mapped",[105]],[[7478,7478],"mapped",[106]],[[7479,7479],"mapped",[107]],[[7480,7480],"mapped",[108]],[[7481,7481],"mapped",[109]],[[7482,7482],"mapped",[110]],[[7483,7483],"valid"],[[7484,7484],"mapped",[111]],[[7485,7485],"mapped",[547]],[[7486,7486],"mapped",[112]],[[7487,7487],"mapped",[114]],[[7488,7488],"mapped",[116]],[[7489,7489],"mapped",[117]],[[7490,7490],"mapped",[119]],[[7491,7491],"mapped",[97]],[[7492,7492],"mapped",[592]],[[7493,7493],"mapped",[593]],[[7494,7494],"mapped",[7426]],[[7495,7495],"mapped",[98]],[[7496,7496],"mapped",[100]],[[7497,7497],"mapped",[101]],[[7498,7498],"mapped",[601]],[[7499,7499],"mapped",[603]],[[7500,7500],"mapped",[604]],[[7501,7501],"mapped",[103]],[[7502,7502],"valid"],[[7503,7503],"mapped",[107]],[[7504,7504],"mapped",[109]],[[7505,7505],"mapped",[331]],[[7506,7506],"mapped",[111]],[[7507,7507],"mapped",[596]],[[7508,7508],"mapped",[7446]],[[7509,7509],"mapped",[7447]],[[7510,7510],"mapped",[112]],[[7511,7511],"mapped",[116]],[[7512,7512],"mapped",[117]],[[7513,7513],"mapped",[7453]],[[7514,7514],"mapped",[623]],[[7515,7515],"mapped",[118]],[[7516,7516],"mapped",[7461]],[[7517,7517],"mapped",[946]],[[7518,7518],"mapped",[947]],[[7519,7519],"mapped",[948]],[[7520,7520],"mapped",[966]],[[7521,7521],"mapped",[967]],[[7522,7522],"mapped",[105]],[[7523,7523],"mapped",[114]],[[7524,7524],"mapped",[117]],[[7525,7525],"mapped",[118]],[[7526,7526],"mapped",[946]],[[7527,7527],"mapped",[947]],[[7528,7528],"mapped",[961]],[[7529,7529],"mapped",[966]],[[7530,7530],"mapped",[967]],[[7531,7531],"valid"],[[7532,7543],"valid"],[[7544,7544],"mapped",[1085]],[[7545,7578],"valid"],[[7579,7579],"mapped",[594]],[[7580,7580],"mapped",[99]],[[7581,7581],"mapped",[597]],[[7582,7582],"mapped",[240]],[[7583,7583],"mapped",[604]],[[7584,7584],"mapped",[102]],[[7585,7585],"mapped",[607]],[[7586,7586],"mapped",[609]],[[7587,7587],"mapped",[613]],[[7588,7588],"mapped",[616]],[[7589,7589],"mapped",[617]],[[7590,7590],"mapped",[618]],[[7591,7591],"mapped",[7547]],[[7592,7592],"mapped",[669]],[[7593,7593],"mapped",[621]],[[7594,7594],"mapped",[7557]],[[7595,7595],"mapped",[671]],[[7596,7596],"mapped",[625]],[[7597,7597],"mapped",[624]],[[7598,7598],"mapped",[626]],[[7599,7599],"mapped",[627]],[[7600,7600],"mapped",[628]],[[7601,7601],"mapped",[629]],[[7602,7602],"mapped",[632]],[[7603,7603],"mapped",[642]],[[7604,7604],"mapped",[643]],[[7605,7605],"mapped",[427]],[[7606,7606],"mapped",[649]],[[7607,7607],"mapped",[650]],[[7608,7608],"mapped",[7452]],[[7609,7609],"mapped",[651]],[[7610,7610],"mapped",[652]],[[7611,7611],"mapped",[122]],[[7612,7612],"mapped",[656]],[[7613,7613],"mapped",[657]],[[7614,7614],"mapped",[658]],[[7615,7615],"mapped",[952]],[[7616,7619],"valid"],[[7620,7626],"valid"],[[7627,7654],"valid"],[[7655,7669],"valid"],[[7670,7675],"disallowed"],[[7676,7676],"valid"],[[7677,7677],"valid"],[[7678,7679],"valid"],[[7680,7680],"mapped",[7681]],[[7681,7681],"valid"],[[7682,7682],"mapped",[7683]],[[7683,7683],"valid"],[[7684,7684],"mapped",[7685]],[[7685,7685],"valid"],[[7686,7686],"mapped",[7687]],[[7687,7687],"valid"],[[7688,7688],"mapped",[7689]],[[7689,7689],"valid"],[[7690,7690],"mapped",[7691]],[[7691,7691],"valid"],[[7692,7692],"mapped",[7693]],[[7693,7693],"valid"],[[7694,7694],"mapped",[7695]],[[7695,7695],"valid"],[[7696,7696],"mapped",[7697]],[[7697,7697],"valid"],[[7698,7698],"mapped",[7699]],[[7699,7699],"valid"],[[7700,7700],"mapped",[7701]],[[7701,7701],"valid"],[[7702,7702],"mapped",[7703]],[[7703,7703],"valid"],[[7704,7704],"mapped",[7705]],[[7705,7705],"valid"],[[7706,7706],"mapped",[7707]],[[7707,7707],"valid"],[[7708,7708],"mapped",[7709]],[[7709,7709],"valid"],[[7710,7710],"mapped",[7711]],[[7711,7711],"valid"],[[7712,7712],"mapped",[7713]],[[7713,7713],"valid"],[[7714,7714],"mapped",[7715]],[[7715,7715],"valid"],[[7716,7716],"mapped",[7717]],[[7717,7717],"valid"],[[7718,7718],"mapped",[7719]],[[7719,7719],"valid"],[[7720,7720],"mapped",[7721]],[[7721,7721],"valid"],[[7722,7722],"mapped",[7723]],[[7723,7723],"valid"],[[7724,7724],"mapped",[7725]],[[7725,7725],"valid"],[[7726,7726],"mapped",[7727]],[[7727,7727],"valid"],[[7728,7728],"mapped",[7729]],[[7729,7729],"valid"],[[7730,7730],"mapped",[7731]],[[7731,7731],"valid"],[[7732,7732],"mapped",[7733]],[[7733,7733],"valid"],[[7734,7734],"mapped",[7735]],[[7735,7735],"valid"],[[7736,7736],"mapped",[7737]],[[7737,7737],"valid"],[[7738,7738],"mapped",[7739]],[[7739,7739],"valid"],[[7740,7740],"mapped",[7741]],[[7741,7741],"valid"],[[7742,7742],"mapped",[7743]],[[7743,7743],"valid"],[[7744,7744],"mapped",[7745]],[[7745,7745],"valid"],[[7746,7746],"mapped",[7747]],[[7747,7747],"valid"],[[7748,7748],"mapped",[7749]],[[7749,7749],"valid"],[[7750,7750],"mapped",[7751]],[[7751,7751],"valid"],[[7752,7752],"mapped",[7753]],[[7753,7753],"valid"],[[7754,7754],"mapped",[7755]],[[7755,7755],"valid"],[[7756,7756],"mapped",[7757]],[[7757,7757],"valid"],[[7758,7758],"mapped",[7759]],[[7759,7759],"valid"],[[7760,7760],"mapped",[7761]],[[7761,7761],"valid"],[[7762,7762],"mapped",[7763]],[[7763,7763],"valid"],[[7764,7764],"mapped",[7765]],[[7765,7765],"valid"],[[7766,7766],"mapped",[7767]],[[7767,7767],"valid"],[[7768,7768],"mapped",[7769]],[[7769,7769],"valid"],[[7770,7770],"mapped",[7771]],[[7771,7771],"valid"],[[7772,7772],"mapped",[7773]],[[7773,7773],"valid"],[[7774,7774],"mapped",[7775]],[[7775,7775],"valid"],[[7776,7776],"mapped",[7777]],[[7777,7777],"valid"],[[7778,7778],"mapped",[7779]],[[7779,7779],"valid"],[[7780,7780],"mapped",[7781]],[[7781,7781],"valid"],[[7782,7782],"mapped",[7783]],[[7783,7783],"valid"],[[7784,7784],"mapped",[7785]],[[7785,7785],"valid"],[[7786,7786],"mapped",[7787]],[[7787,7787],"valid"],[[7788,7788],"mapped",[7789]],[[7789,7789],"valid"],[[7790,7790],"mapped",[7791]],[[7791,7791],"valid"],[[7792,7792],"mapped",[7793]],[[7793,7793],"valid"],[[7794,7794],"mapped",[7795]],[[7795,7795],"valid"],[[7796,7796],"mapped",[7797]],[[7797,7797],"valid"],[[7798,7798],"mapped",[7799]],[[7799,7799],"valid"],[[7800,7800],"mapped",[7801]],[[7801,7801],"valid"],[[7802,7802],"mapped",[7803]],[[7803,7803],"valid"],[[7804,7804],"mapped",[7805]],[[7805,7805],"valid"],[[7806,7806],"mapped",[7807]],[[7807,7807],"valid"],[[7808,7808],"mapped",[7809]],[[7809,7809],"valid"],[[7810,7810],"mapped",[7811]],[[7811,7811],"valid"],[[7812,7812],"mapped",[7813]],[[7813,7813],"valid"],[[7814,7814],"mapped",[7815]],[[7815,7815],"valid"],[[7816,7816],"mapped",[7817]],[[7817,7817],"valid"],[[7818,7818],"mapped",[7819]],[[7819,7819],"valid"],[[7820,7820],"mapped",[7821]],[[7821,7821],"valid"],[[7822,7822],"mapped",[7823]],[[7823,7823],"valid"],[[7824,7824],"mapped",[7825]],[[7825,7825],"valid"],[[7826,7826],"mapped",[7827]],[[7827,7827],"valid"],[[7828,7828],"mapped",[7829]],[[7829,7833],"valid"],[[7834,7834],"mapped",[97,702]],[[7835,7835],"mapped",[7777]],[[7836,7837],"valid"],[[7838,7838],"mapped",[115,115]],[[7839,7839],"valid"],[[7840,7840],"mapped",[7841]],[[7841,7841],"valid"],[[7842,7842],"mapped",[7843]],[[7843,7843],"valid"],[[7844,7844],"mapped",[7845]],[[7845,7845],"valid"],[[7846,7846],"mapped",[7847]],[[7847,7847],"valid"],[[7848,7848],"mapped",[7849]],[[7849,7849],"valid"],[[7850,7850],"mapped",[7851]],[[7851,7851],"valid"],[[7852,7852],"mapped",[7853]],[[7853,7853],"valid"],[[7854,7854],"mapped",[7855]],[[7855,7855],"valid"],[[7856,7856],"mapped",[7857]],[[7857,7857],"valid"],[[7858,7858],"mapped",[7859]],[[7859,7859],"valid"],[[7860,7860],"mapped",[7861]],[[7861,7861],"valid"],[[7862,7862],"mapped",[7863]],[[7863,7863],"valid"],[[7864,7864],"mapped",[7865]],[[7865,7865],"valid"],[[7866,7866],"mapped",[7867]],[[7867,7867],"valid"],[[7868,7868],"mapped",[7869]],[[7869,7869],"valid"],[[7870,7870],"mapped",[7871]],[[7871,7871],"valid"],[[7872,7872],"mapped",[7873]],[[7873,7873],"valid"],[[7874,7874],"mapped",[7875]],[[7875,7875],"valid"],[[7876,7876],"mapped",[7877]],[[7877,7877],"valid"],[[7878,7878],"mapped",[7879]],[[7879,7879],"valid"],[[7880,7880],"mapped",[7881]],[[7881,7881],"valid"],[[7882,7882],"mapped",[7883]],[[7883,7883],"valid"],[[7884,7884],"mapped",[7885]],[[7885,7885],"valid"],[[7886,7886],"mapped",[7887]],[[7887,7887],"valid"],[[7888,7888],"mapped",[7889]],[[7889,7889],"valid"],[[7890,7890],"mapped",[7891]],[[7891,7891],"valid"],[[7892,7892],"mapped",[7893]],[[7893,7893],"valid"],[[7894,7894],"mapped",[7895]],[[7895,7895],"valid"],[[7896,7896],"mapped",[7897]],[[7897,7897],"valid"],[[7898,7898],"mapped",[7899]],[[7899,7899],"valid"],[[7900,7900],"mapped",[7901]],[[7901,7901],"valid"],[[7902,7902],"mapped",[7903]],[[7903,7903],"valid"],[[7904,7904],"mapped",[7905]],[[7905,7905],"valid"],[[7906,7906],"mapped",[7907]],[[7907,7907],"valid"],[[7908,7908],"mapped",[7909]],[[7909,7909],"valid"],[[7910,7910],"mapped",[7911]],[[7911,7911],"valid"],[[7912,7912],"mapped",[7913]],[[7913,7913],"valid"],[[7914,7914],"mapped",[7915]],[[7915,7915],"valid"],[[7916,7916],"mapped",[7917]],[[7917,7917],"valid"],[[7918,7918],"mapped",[7919]],[[7919,7919],"valid"],[[7920,7920],"mapped",[7921]],[[7921,7921],"valid"],[[7922,7922],"mapped",[7923]],[[7923,7923],"valid"],[[7924,7924],"mapped",[7925]],[[7925,7925],"valid"],[[7926,7926],"mapped",[7927]],[[7927,7927],"valid"],[[7928,7928],"mapped",[7929]],[[7929,7929],"valid"],[[7930,7930],"mapped",[7931]],[[7931,7931],"valid"],[[7932,7932],"mapped",[7933]],[[7933,7933],"valid"],[[7934,7934],"mapped",[7935]],[[7935,7935],"valid"],[[7936,7943],"valid"],[[7944,7944],"mapped",[7936]],[[7945,7945],"mapped",[7937]],[[7946,7946],"mapped",[7938]],[[7947,7947],"mapped",[7939]],[[7948,7948],"mapped",[7940]],[[7949,7949],"mapped",[7941]],[[7950,7950],"mapped",[7942]],[[7951,7951],"mapped",[7943]],[[7952,7957],"valid"],[[7958,7959],"disallowed"],[[7960,7960],"mapped",[7952]],[[7961,7961],"mapped",[7953]],[[7962,7962],"mapped",[7954]],[[7963,7963],"mapped",[7955]],[[7964,7964],"mapped",[7956]],[[7965,7965],"mapped",[7957]],[[7966,7967],"disallowed"],[[7968,7975],"valid"],[[7976,7976],"mapped",[7968]],[[7977,7977],"mapped",[7969]],[[7978,7978],"mapped",[7970]],[[7979,7979],"mapped",[7971]],[[7980,7980],"mapped",[7972]],[[7981,7981],"mapped",[7973]],[[7982,7982],"mapped",[7974]],[[7983,7983],"mapped",[7975]],[[7984,7991],"valid"],[[7992,7992],"mapped",[7984]],[[7993,7993],"mapped",[7985]],[[7994,7994],"mapped",[7986]],[[7995,7995],"mapped",[7987]],[[7996,7996],"mapped",[7988]],[[7997,7997],"mapped",[7989]],[[7998,7998],"mapped",[7990]],[[7999,7999],"mapped",[7991]],[[8e3,8005],"valid"],[[8006,8007],"disallowed"],[[8008,8008],"mapped",[8e3]],[[8009,8009],"mapped",[8001]],[[8010,8010],"mapped",[8002]],[[8011,8011],"mapped",[8003]],[[8012,8012],"mapped",[8004]],[[8013,8013],"mapped",[8005]],[[8014,8015],"disallowed"],[[8016,8023],"valid"],[[8024,8024],"disallowed"],[[8025,8025],"mapped",[8017]],[[8026,8026],"disallowed"],[[8027,8027],"mapped",[8019]],[[8028,8028],"disallowed"],[[8029,8029],"mapped",[8021]],[[8030,8030],"disallowed"],[[8031,8031],"mapped",[8023]],[[8032,8039],"valid"],[[8040,8040],"mapped",[8032]],[[8041,8041],"mapped",[8033]],[[8042,8042],"mapped",[8034]],[[8043,8043],"mapped",[8035]],[[8044,8044],"mapped",[8036]],[[8045,8045],"mapped",[8037]],[[8046,8046],"mapped",[8038]],[[8047,8047],"mapped",[8039]],[[8048,8048],"valid"],[[8049,8049],"mapped",[940]],[[8050,8050],"valid"],[[8051,8051],"mapped",[941]],[[8052,8052],"valid"],[[8053,8053],"mapped",[942]],[[8054,8054],"valid"],[[8055,8055],"mapped",[943]],[[8056,8056],"valid"],[[8057,8057],"mapped",[972]],[[8058,8058],"valid"],[[8059,8059],"mapped",[973]],[[8060,8060],"valid"],[[8061,8061],"mapped",[974]],[[8062,8063],"disallowed"],[[8064,8064],"mapped",[7936,953]],[[8065,8065],"mapped",[7937,953]],[[8066,8066],"mapped",[7938,953]],[[8067,8067],"mapped",[7939,953]],[[8068,8068],"mapped",[7940,953]],[[8069,8069],"mapped",[7941,953]],[[8070,8070],"mapped",[7942,953]],[[8071,8071],"mapped",[7943,953]],[[8072,8072],"mapped",[7936,953]],[[8073,8073],"mapped",[7937,953]],[[8074,8074],"mapped",[7938,953]],[[8075,8075],"mapped",[7939,953]],[[8076,8076],"mapped",[7940,953]],[[8077,8077],"mapped",[7941,953]],[[8078,8078],"mapped",[7942,953]],[[8079,8079],"mapped",[7943,953]],[[8080,8080],"mapped",[7968,953]],[[8081,8081],"mapped",[7969,953]],[[8082,8082],"mapped",[7970,953]],[[8083,8083],"mapped",[7971,953]],[[8084,8084],"mapped",[7972,953]],[[8085,8085],"mapped",[7973,953]],[[8086,8086],"mapped",[7974,953]],[[8087,8087],"mapped",[7975,953]],[[8088,8088],"mapped",[7968,953]],[[8089,8089],"mapped",[7969,953]],[[8090,8090],"mapped",[7970,953]],[[8091,8091],"mapped",[7971,953]],[[8092,8092],"mapped",[7972,953]],[[8093,8093],"mapped",[7973,953]],[[8094,8094],"mapped",[7974,953]],[[8095,8095],"mapped",[7975,953]],[[8096,8096],"mapped",[8032,953]],[[8097,8097],"mapped",[8033,953]],[[8098,8098],"mapped",[8034,953]],[[8099,8099],"mapped",[8035,953]],[[8100,8100],"mapped",[8036,953]],[[8101,8101],"mapped",[8037,953]],[[8102,8102],"mapped",[8038,953]],[[8103,8103],"mapped",[8039,953]],[[8104,8104],"mapped",[8032,953]],[[8105,8105],"mapped",[8033,953]],[[8106,8106],"mapped",[8034,953]],[[8107,8107],"mapped",[8035,953]],[[8108,8108],"mapped",[8036,953]],[[8109,8109],"mapped",[8037,953]],[[8110,8110],"mapped",[8038,953]],[[8111,8111],"mapped",[8039,953]],[[8112,8113],"valid"],[[8114,8114],"mapped",[8048,953]],[[8115,8115],"mapped",[945,953]],[[8116,8116],"mapped",[940,953]],[[8117,8117],"disallowed"],[[8118,8118],"valid"],[[8119,8119],"mapped",[8118,953]],[[8120,8120],"mapped",[8112]],[[8121,8121],"mapped",[8113]],[[8122,8122],"mapped",[8048]],[[8123,8123],"mapped",[940]],[[8124,8124],"mapped",[945,953]],[[8125,8125],"disallowed_STD3_mapped",[32,787]],[[8126,8126],"mapped",[953]],[[8127,8127],"disallowed_STD3_mapped",[32,787]],[[8128,8128],"disallowed_STD3_mapped",[32,834]],[[8129,8129],"disallowed_STD3_mapped",[32,776,834]],[[8130,8130],"mapped",[8052,953]],[[8131,8131],"mapped",[951,953]],[[8132,8132],"mapped",[942,953]],[[8133,8133],"disallowed"],[[8134,8134],"valid"],[[8135,8135],"mapped",[8134,953]],[[8136,8136],"mapped",[8050]],[[8137,8137],"mapped",[941]],[[8138,8138],"mapped",[8052]],[[8139,8139],"mapped",[942]],[[8140,8140],"mapped",[951,953]],[[8141,8141],"disallowed_STD3_mapped",[32,787,768]],[[8142,8142],"disallowed_STD3_mapped",[32,787,769]],[[8143,8143],"disallowed_STD3_mapped",[32,787,834]],[[8144,8146],"valid"],[[8147,8147],"mapped",[912]],[[8148,8149],"disallowed"],[[8150,8151],"valid"],[[8152,8152],"mapped",[8144]],[[8153,8153],"mapped",[8145]],[[8154,8154],"mapped",[8054]],[[8155,8155],"mapped",[943]],[[8156,8156],"disallowed"],[[8157,8157],"disallowed_STD3_mapped",[32,788,768]],[[8158,8158],"disallowed_STD3_mapped",[32,788,769]],[[8159,8159],"disallowed_STD3_mapped",[32,788,834]],[[8160,8162],"valid"],[[8163,8163],"mapped",[944]],[[8164,8167],"valid"],[[8168,8168],"mapped",[8160]],[[8169,8169],"mapped",[8161]],[[8170,8170],"mapped",[8058]],[[8171,8171],"mapped",[973]],[[8172,8172],"mapped",[8165]],[[8173,8173],"disallowed_STD3_mapped",[32,776,768]],[[8174,8174],"disallowed_STD3_mapped",[32,776,769]],[[8175,8175],"disallowed_STD3_mapped",[96]],[[8176,8177],"disallowed"],[[8178,8178],"mapped",[8060,953]],[[8179,8179],"mapped",[969,953]],[[8180,8180],"mapped",[974,953]],[[8181,8181],"disallowed"],[[8182,8182],"valid"],[[8183,8183],"mapped",[8182,953]],[[8184,8184],"mapped",[8056]],[[8185,8185],"mapped",[972]],[[8186,8186],"mapped",[8060]],[[8187,8187],"mapped",[974]],[[8188,8188],"mapped",[969,953]],[[8189,8189],"disallowed_STD3_mapped",[32,769]],[[8190,8190],"disallowed_STD3_mapped",[32,788]],[[8191,8191],"disallowed"],[[8192,8202],"disallowed_STD3_mapped",[32]],[[8203,8203],"ignored"],[[8204,8205],"deviation",[]],[[8206,8207],"disallowed"],[[8208,8208],"valid",[],"NV8"],[[8209,8209],"mapped",[8208]],[[8210,8214],"valid",[],"NV8"],[[8215,8215],"disallowed_STD3_mapped",[32,819]],[[8216,8227],"valid",[],"NV8"],[[8228,8230],"disallowed"],[[8231,8231],"valid",[],"NV8"],[[8232,8238],"disallowed"],[[8239,8239],"disallowed_STD3_mapped",[32]],[[8240,8242],"valid",[],"NV8"],[[8243,8243],"mapped",[8242,8242]],[[8244,8244],"mapped",[8242,8242,8242]],[[8245,8245],"valid",[],"NV8"],[[8246,8246],"mapped",[8245,8245]],[[8247,8247],"mapped",[8245,8245,8245]],[[8248,8251],"valid",[],"NV8"],[[8252,8252],"disallowed_STD3_mapped",[33,33]],[[8253,8253],"valid",[],"NV8"],[[8254,8254],"disallowed_STD3_mapped",[32,773]],[[8255,8262],"valid",[],"NV8"],[[8263,8263],"disallowed_STD3_mapped",[63,63]],[[8264,8264],"disallowed_STD3_mapped",[63,33]],[[8265,8265],"disallowed_STD3_mapped",[33,63]],[[8266,8269],"valid",[],"NV8"],[[8270,8274],"valid",[],"NV8"],[[8275,8276],"valid",[],"NV8"],[[8277,8278],"valid",[],"NV8"],[[8279,8279],"mapped",[8242,8242,8242,8242]],[[8280,8286],"valid",[],"NV8"],[[8287,8287],"disallowed_STD3_mapped",[32]],[[8288,8288],"ignored"],[[8289,8291],"disallowed"],[[8292,8292],"ignored"],[[8293,8293],"disallowed"],[[8294,8297],"disallowed"],[[8298,8303],"disallowed"],[[8304,8304],"mapped",[48]],[[8305,8305],"mapped",[105]],[[8306,8307],"disallowed"],[[8308,8308],"mapped",[52]],[[8309,8309],"mapped",[53]],[[8310,8310],"mapped",[54]],[[8311,8311],"mapped",[55]],[[8312,8312],"mapped",[56]],[[8313,8313],"mapped",[57]],[[8314,8314],"disallowed_STD3_mapped",[43]],[[8315,8315],"mapped",[8722]],[[8316,8316],"disallowed_STD3_mapped",[61]],[[8317,8317],"disallowed_STD3_mapped",[40]],[[8318,8318],"disallowed_STD3_mapped",[41]],[[8319,8319],"mapped",[110]],[[8320,8320],"mapped",[48]],[[8321,8321],"mapped",[49]],[[8322,8322],"mapped",[50]],[[8323,8323],"mapped",[51]],[[8324,8324],"mapped",[52]],[[8325,8325],"mapped",[53]],[[8326,8326],"mapped",[54]],[[8327,8327],"mapped",[55]],[[8328,8328],"mapped",[56]],[[8329,8329],"mapped",[57]],[[8330,8330],"disallowed_STD3_mapped",[43]],[[8331,8331],"mapped",[8722]],[[8332,8332],"disallowed_STD3_mapped",[61]],[[8333,8333],"disallowed_STD3_mapped",[40]],[[8334,8334],"disallowed_STD3_mapped",[41]],[[8335,8335],"disallowed"],[[8336,8336],"mapped",[97]],[[8337,8337],"mapped",[101]],[[8338,8338],"mapped",[111]],[[8339,8339],"mapped",[120]],[[8340,8340],"mapped",[601]],[[8341,8341],"mapped",[104]],[[8342,8342],"mapped",[107]],[[8343,8343],"mapped",[108]],[[8344,8344],"mapped",[109]],[[8345,8345],"mapped",[110]],[[8346,8346],"mapped",[112]],[[8347,8347],"mapped",[115]],[[8348,8348],"mapped",[116]],[[8349,8351],"disallowed"],[[8352,8359],"valid",[],"NV8"],[[8360,8360],"mapped",[114,115]],[[8361,8362],"valid",[],"NV8"],[[8363,8363],"valid",[],"NV8"],[[8364,8364],"valid",[],"NV8"],[[8365,8367],"valid",[],"NV8"],[[8368,8369],"valid",[],"NV8"],[[8370,8373],"valid",[],"NV8"],[[8374,8376],"valid",[],"NV8"],[[8377,8377],"valid",[],"NV8"],[[8378,8378],"valid",[],"NV8"],[[8379,8381],"valid",[],"NV8"],[[8382,8382],"valid",[],"NV8"],[[8383,8399],"disallowed"],[[8400,8417],"valid",[],"NV8"],[[8418,8419],"valid",[],"NV8"],[[8420,8426],"valid",[],"NV8"],[[8427,8427],"valid",[],"NV8"],[[8428,8431],"valid",[],"NV8"],[[8432,8432],"valid",[],"NV8"],[[8433,8447],"disallowed"],[[8448,8448],"disallowed_STD3_mapped",[97,47,99]],[[8449,8449],"disallowed_STD3_mapped",[97,47,115]],[[8450,8450],"mapped",[99]],[[8451,8451],"mapped",[176,99]],[[8452,8452],"valid",[],"NV8"],[[8453,8453],"disallowed_STD3_mapped",[99,47,111]],[[8454,8454],"disallowed_STD3_mapped",[99,47,117]],[[8455,8455],"mapped",[603]],[[8456,8456],"valid",[],"NV8"],[[8457,8457],"mapped",[176,102]],[[8458,8458],"mapped",[103]],[[8459,8462],"mapped",[104]],[[8463,8463],"mapped",[295]],[[8464,8465],"mapped",[105]],[[8466,8467],"mapped",[108]],[[8468,8468],"valid",[],"NV8"],[[8469,8469],"mapped",[110]],[[8470,8470],"mapped",[110,111]],[[8471,8472],"valid",[],"NV8"],[[8473,8473],"mapped",[112]],[[8474,8474],"mapped",[113]],[[8475,8477],"mapped",[114]],[[8478,8479],"valid",[],"NV8"],[[8480,8480],"mapped",[115,109]],[[8481,8481],"mapped",[116,101,108]],[[8482,8482],"mapped",[116,109]],[[8483,8483],"valid",[],"NV8"],[[8484,8484],"mapped",[122]],[[8485,8485],"valid",[],"NV8"],[[8486,8486],"mapped",[969]],[[8487,8487],"valid",[],"NV8"],[[8488,8488],"mapped",[122]],[[8489,8489],"valid",[],"NV8"],[[8490,8490],"mapped",[107]],[[8491,8491],"mapped",[229]],[[8492,8492],"mapped",[98]],[[8493,8493],"mapped",[99]],[[8494,8494],"valid",[],"NV8"],[[8495,8496],"mapped",[101]],[[8497,8497],"mapped",[102]],[[8498,8498],"disallowed"],[[8499,8499],"mapped",[109]],[[8500,8500],"mapped",[111]],[[8501,8501],"mapped",[1488]],[[8502,8502],"mapped",[1489]],[[8503,8503],"mapped",[1490]],[[8504,8504],"mapped",[1491]],[[8505,8505],"mapped",[105]],[[8506,8506],"valid",[],"NV8"],[[8507,8507],"mapped",[102,97,120]],[[8508,8508],"mapped",[960]],[[8509,8510],"mapped",[947]],[[8511,8511],"mapped",[960]],[[8512,8512],"mapped",[8721]],[[8513,8516],"valid",[],"NV8"],[[8517,8518],"mapped",[100]],[[8519,8519],"mapped",[101]],[[8520,8520],"mapped",[105]],[[8521,8521],"mapped",[106]],[[8522,8523],"valid",[],"NV8"],[[8524,8524],"valid",[],"NV8"],[[8525,8525],"valid",[],"NV8"],[[8526,8526],"valid"],[[8527,8527],"valid",[],"NV8"],[[8528,8528],"mapped",[49,8260,55]],[[8529,8529],"mapped",[49,8260,57]],[[8530,8530],"mapped",[49,8260,49,48]],[[8531,8531],"mapped",[49,8260,51]],[[8532,8532],"mapped",[50,8260,51]],[[8533,8533],"mapped",[49,8260,53]],[[8534,8534],"mapped",[50,8260,53]],[[8535,8535],"mapped",[51,8260,53]],[[8536,8536],"mapped",[52,8260,53]],[[8537,8537],"mapped",[49,8260,54]],[[8538,8538],"mapped",[53,8260,54]],[[8539,8539],"mapped",[49,8260,56]],[[8540,8540],"mapped",[51,8260,56]],[[8541,8541],"mapped",[53,8260,56]],[[8542,8542],"mapped",[55,8260,56]],[[8543,8543],"mapped",[49,8260]],[[8544,8544],"mapped",[105]],[[8545,8545],"mapped",[105,105]],[[8546,8546],"mapped",[105,105,105]],[[8547,8547],"mapped",[105,118]],[[8548,8548],"mapped",[118]],[[8549,8549],"mapped",[118,105]],[[8550,8550],"mapped",[118,105,105]],[[8551,8551],"mapped",[118,105,105,105]],[[8552,8552],"mapped",[105,120]],[[8553,8553],"mapped",[120]],[[8554,8554],"mapped",[120,105]],[[8555,8555],"mapped",[120,105,105]],[[8556,8556],"mapped",[108]],[[8557,8557],"mapped",[99]],[[8558,8558],"mapped",[100]],[[8559,8559],"mapped",[109]],[[8560,8560],"mapped",[105]],[[8561,8561],"mapped",[105,105]],[[8562,8562],"mapped",[105,105,105]],[[8563,8563],"mapped",[105,118]],[[8564,8564],"mapped",[118]],[[8565,8565],"mapped",[118,105]],[[8566,8566],"mapped",[118,105,105]],[[8567,8567],"mapped",[118,105,105,105]],[[8568,8568],"mapped",[105,120]],[[8569,8569],"mapped",[120]],[[8570,8570],"mapped",[120,105]],[[8571,8571],"mapped",[120,105,105]],[[8572,8572],"mapped",[108]],[[8573,8573],"mapped",[99]],[[8574,8574],"mapped",[100]],[[8575,8575],"mapped",[109]],[[8576,8578],"valid",[],"NV8"],[[8579,8579],"disallowed"],[[8580,8580],"valid"],[[8581,8584],"valid",[],"NV8"],[[8585,8585],"mapped",[48,8260,51]],[[8586,8587],"valid",[],"NV8"],[[8588,8591],"disallowed"],[[8592,8682],"valid",[],"NV8"],[[8683,8691],"valid",[],"NV8"],[[8692,8703],"valid",[],"NV8"],[[8704,8747],"valid",[],"NV8"],[[8748,8748],"mapped",[8747,8747]],[[8749,8749],"mapped",[8747,8747,8747]],[[8750,8750],"valid",[],"NV8"],[[8751,8751],"mapped",[8750,8750]],[[8752,8752],"mapped",[8750,8750,8750]],[[8753,8799],"valid",[],"NV8"],[[8800,8800],"disallowed_STD3_valid"],[[8801,8813],"valid",[],"NV8"],[[8814,8815],"disallowed_STD3_valid"],[[8816,8945],"valid",[],"NV8"],[[8946,8959],"valid",[],"NV8"],[[8960,8960],"valid",[],"NV8"],[[8961,8961],"valid",[],"NV8"],[[8962,9e3],"valid",[],"NV8"],[[9001,9001],"mapped",[12296]],[[9002,9002],"mapped",[12297]],[[9003,9082],"valid",[],"NV8"],[[9083,9083],"valid",[],"NV8"],[[9084,9084],"valid",[],"NV8"],[[9085,9114],"valid",[],"NV8"],[[9115,9166],"valid",[],"NV8"],[[9167,9168],"valid",[],"NV8"],[[9169,9179],"valid",[],"NV8"],[[9180,9191],"valid",[],"NV8"],[[9192,9192],"valid",[],"NV8"],[[9193,9203],"valid",[],"NV8"],[[9204,9210],"valid",[],"NV8"],[[9211,9215],"disallowed"],[[9216,9252],"valid",[],"NV8"],[[9253,9254],"valid",[],"NV8"],[[9255,9279],"disallowed"],[[9280,9290],"valid",[],"NV8"],[[9291,9311],"disallowed"],[[9312,9312],"mapped",[49]],[[9313,9313],"mapped",[50]],[[9314,9314],"mapped",[51]],[[9315,9315],"mapped",[52]],[[9316,9316],"mapped",[53]],[[9317,9317],"mapped",[54]],[[9318,9318],"mapped",[55]],[[9319,9319],"mapped",[56]],[[9320,9320],"mapped",[57]],[[9321,9321],"mapped",[49,48]],[[9322,9322],"mapped",[49,49]],[[9323,9323],"mapped",[49,50]],[[9324,9324],"mapped",[49,51]],[[9325,9325],"mapped",[49,52]],[[9326,9326],"mapped",[49,53]],[[9327,9327],"mapped",[49,54]],[[9328,9328],"mapped",[49,55]],[[9329,9329],"mapped",[49,56]],[[9330,9330],"mapped",[49,57]],[[9331,9331],"mapped",[50,48]],[[9332,9332],"disallowed_STD3_mapped",[40,49,41]],[[9333,9333],"disallowed_STD3_mapped",[40,50,41]],[[9334,9334],"disallowed_STD3_mapped",[40,51,41]],[[9335,9335],"disallowed_STD3_mapped",[40,52,41]],[[9336,9336],"disallowed_STD3_mapped",[40,53,41]],[[9337,9337],"disallowed_STD3_mapped",[40,54,41]],[[9338,9338],"disallowed_STD3_mapped",[40,55,41]],[[9339,9339],"disallowed_STD3_mapped",[40,56,41]],[[9340,9340],"disallowed_STD3_mapped",[40,57,41]],[[9341,9341],"disallowed_STD3_mapped",[40,49,48,41]],[[9342,9342],"disallowed_STD3_mapped",[40,49,49,41]],[[9343,9343],"disallowed_STD3_mapped",[40,49,50,41]],[[9344,9344],"disallowed_STD3_mapped",[40,49,51,41]],[[9345,9345],"disallowed_STD3_mapped",[40,49,52,41]],[[9346,9346],"disallowed_STD3_mapped",[40,49,53,41]],[[9347,9347],"disallowed_STD3_mapped",[40,49,54,41]],[[9348,9348],"disallowed_STD3_mapped",[40,49,55,41]],[[9349,9349],"disallowed_STD3_mapped",[40,49,56,41]],[[9350,9350],"disallowed_STD3_mapped",[40,49,57,41]],[[9351,9351],"disallowed_STD3_mapped",[40,50,48,41]],[[9352,9371],"disallowed"],[[9372,9372],"disallowed_STD3_mapped",[40,97,41]],[[9373,9373],"disallowed_STD3_mapped",[40,98,41]],[[9374,9374],"disallowed_STD3_mapped",[40,99,41]],[[9375,9375],"disallowed_STD3_mapped",[40,100,41]],[[9376,9376],"disallowed_STD3_mapped",[40,101,41]],[[9377,9377],"disallowed_STD3_mapped",[40,102,41]],[[9378,9378],"disallowed_STD3_mapped",[40,103,41]],[[9379,9379],"disallowed_STD3_mapped",[40,104,41]],[[9380,9380],"disallowed_STD3_mapped",[40,105,41]],[[9381,9381],"disallowed_STD3_mapped",[40,106,41]],[[9382,9382],"disallowed_STD3_mapped",[40,107,41]],[[9383,9383],"disallowed_STD3_mapped",[40,108,41]],[[9384,9384],"disallowed_STD3_mapped",[40,109,41]],[[9385,9385],"disallowed_STD3_mapped",[40,110,41]],[[9386,9386],"disallowed_STD3_mapped",[40,111,41]],[[9387,9387],"disallowed_STD3_mapped",[40,112,41]],[[9388,9388],"disallowed_STD3_mapped",[40,113,41]],[[9389,9389],"disallowed_STD3_mapped",[40,114,41]],[[9390,9390],"disallowed_STD3_mapped",[40,115,41]],[[9391,9391],"disallowed_STD3_mapped",[40,116,41]],[[9392,9392],"disallowed_STD3_mapped",[40,117,41]],[[9393,9393],"disallowed_STD3_mapped",[40,118,41]],[[9394,9394],"disallowed_STD3_mapped",[40,119,41]],[[9395,9395],"disallowed_STD3_mapped",[40,120,41]],[[9396,9396],"disallowed_STD3_mapped",[40,121,41]],[[9397,9397],"disallowed_STD3_mapped",[40,122,41]],[[9398,9398],"mapped",[97]],[[9399,9399],"mapped",[98]],[[9400,9400],"mapped",[99]],[[9401,9401],"mapped",[100]],[[9402,9402],"mapped",[101]],[[9403,9403],"mapped",[102]],[[9404,9404],"mapped",[103]],[[9405,9405],"mapped",[104]],[[9406,9406],"mapped",[105]],[[9407,9407],"mapped",[106]],[[9408,9408],"mapped",[107]],[[9409,9409],"mapped",[108]],[[9410,9410],"mapped",[109]],[[9411,9411],"mapped",[110]],[[9412,9412],"mapped",[111]],[[9413,9413],"mapped",[112]],[[9414,9414],"mapped",[113]],[[9415,9415],"mapped",[114]],[[9416,9416],"mapped",[115]],[[9417,9417],"mapped",[116]],[[9418,9418],"mapped",[117]],[[9419,9419],"mapped",[118]],[[9420,9420],"mapped",[119]],[[9421,9421],"mapped",[120]],[[9422,9422],"mapped",[121]],[[9423,9423],"mapped",[122]],[[9424,9424],"mapped",[97]],[[9425,9425],"mapped",[98]],[[9426,9426],"mapped",[99]],[[9427,9427],"mapped",[100]],[[9428,9428],"mapped",[101]],[[9429,9429],"mapped",[102]],[[9430,9430],"mapped",[103]],[[9431,9431],"mapped",[104]],[[9432,9432],"mapped",[105]],[[9433,9433],"mapped",[106]],[[9434,9434],"mapped",[107]],[[9435,9435],"mapped",[108]],[[9436,9436],"mapped",[109]],[[9437,9437],"mapped",[110]],[[9438,9438],"mapped",[111]],[[9439,9439],"mapped",[112]],[[9440,9440],"mapped",[113]],[[9441,9441],"mapped",[114]],[[9442,9442],"mapped",[115]],[[9443,9443],"mapped",[116]],[[9444,9444],"mapped",[117]],[[9445,9445],"mapped",[118]],[[9446,9446],"mapped",[119]],[[9447,9447],"mapped",[120]],[[9448,9448],"mapped",[121]],[[9449,9449],"mapped",[122]],[[9450,9450],"mapped",[48]],[[9451,9470],"valid",[],"NV8"],[[9471,9471],"valid",[],"NV8"],[[9472,9621],"valid",[],"NV8"],[[9622,9631],"valid",[],"NV8"],[[9632,9711],"valid",[],"NV8"],[[9712,9719],"valid",[],"NV8"],[[9720,9727],"valid",[],"NV8"],[[9728,9747],"valid",[],"NV8"],[[9748,9749],"valid",[],"NV8"],[[9750,9751],"valid",[],"NV8"],[[9752,9752],"valid",[],"NV8"],[[9753,9753],"valid",[],"NV8"],[[9754,9839],"valid",[],"NV8"],[[9840,9841],"valid",[],"NV8"],[[9842,9853],"valid",[],"NV8"],[[9854,9855],"valid",[],"NV8"],[[9856,9865],"valid",[],"NV8"],[[9866,9873],"valid",[],"NV8"],[[9874,9884],"valid",[],"NV8"],[[9885,9885],"valid",[],"NV8"],[[9886,9887],"valid",[],"NV8"],[[9888,9889],"valid",[],"NV8"],[[9890,9905],"valid",[],"NV8"],[[9906,9906],"valid",[],"NV8"],[[9907,9916],"valid",[],"NV8"],[[9917,9919],"valid",[],"NV8"],[[9920,9923],"valid",[],"NV8"],[[9924,9933],"valid",[],"NV8"],[[9934,9934],"valid",[],"NV8"],[[9935,9953],"valid",[],"NV8"],[[9954,9954],"valid",[],"NV8"],[[9955,9955],"valid",[],"NV8"],[[9956,9959],"valid",[],"NV8"],[[9960,9983],"valid",[],"NV8"],[[9984,9984],"valid",[],"NV8"],[[9985,9988],"valid",[],"NV8"],[[9989,9989],"valid",[],"NV8"],[[9990,9993],"valid",[],"NV8"],[[9994,9995],"valid",[],"NV8"],[[9996,10023],"valid",[],"NV8"],[[10024,10024],"valid",[],"NV8"],[[10025,10059],"valid",[],"NV8"],[[10060,10060],"valid",[],"NV8"],[[10061,10061],"valid",[],"NV8"],[[10062,10062],"valid",[],"NV8"],[[10063,10066],"valid",[],"NV8"],[[10067,10069],"valid",[],"NV8"],[[10070,10070],"valid",[],"NV8"],[[10071,10071],"valid",[],"NV8"],[[10072,10078],"valid",[],"NV8"],[[10079,10080],"valid",[],"NV8"],[[10081,10087],"valid",[],"NV8"],[[10088,10101],"valid",[],"NV8"],[[10102,10132],"valid",[],"NV8"],[[10133,10135],"valid",[],"NV8"],[[10136,10159],"valid",[],"NV8"],[[10160,10160],"valid",[],"NV8"],[[10161,10174],"valid",[],"NV8"],[[10175,10175],"valid",[],"NV8"],[[10176,10182],"valid",[],"NV8"],[[10183,10186],"valid",[],"NV8"],[[10187,10187],"valid",[],"NV8"],[[10188,10188],"valid",[],"NV8"],[[10189,10189],"valid",[],"NV8"],[[10190,10191],"valid",[],"NV8"],[[10192,10219],"valid",[],"NV8"],[[10220,10223],"valid",[],"NV8"],[[10224,10239],"valid",[],"NV8"],[[10240,10495],"valid",[],"NV8"],[[10496,10763],"valid",[],"NV8"],[[10764,10764],"mapped",[8747,8747,8747,8747]],[[10765,10867],"valid",[],"NV8"],[[10868,10868],"disallowed_STD3_mapped",[58,58,61]],[[10869,10869],"disallowed_STD3_mapped",[61,61]],[[10870,10870],"disallowed_STD3_mapped",[61,61,61]],[[10871,10971],"valid",[],"NV8"],[[10972,10972],"mapped",[10973,824]],[[10973,11007],"valid",[],"NV8"],[[11008,11021],"valid",[],"NV8"],[[11022,11027],"valid",[],"NV8"],[[11028,11034],"valid",[],"NV8"],[[11035,11039],"valid",[],"NV8"],[[11040,11043],"valid",[],"NV8"],[[11044,11084],"valid",[],"NV8"],[[11085,11087],"valid",[],"NV8"],[[11088,11092],"valid",[],"NV8"],[[11093,11097],"valid",[],"NV8"],[[11098,11123],"valid",[],"NV8"],[[11124,11125],"disallowed"],[[11126,11157],"valid",[],"NV8"],[[11158,11159],"disallowed"],[[11160,11193],"valid",[],"NV8"],[[11194,11196],"disallowed"],[[11197,11208],"valid",[],"NV8"],[[11209,11209],"disallowed"],[[11210,11217],"valid",[],"NV8"],[[11218,11243],"disallowed"],[[11244,11247],"valid",[],"NV8"],[[11248,11263],"disallowed"],[[11264,11264],"mapped",[11312]],[[11265,11265],"mapped",[11313]],[[11266,11266],"mapped",[11314]],[[11267,11267],"mapped",[11315]],[[11268,11268],"mapped",[11316]],[[11269,11269],"mapped",[11317]],[[11270,11270],"mapped",[11318]],[[11271,11271],"mapped",[11319]],[[11272,11272],"mapped",[11320]],[[11273,11273],"mapped",[11321]],[[11274,11274],"mapped",[11322]],[[11275,11275],"mapped",[11323]],[[11276,11276],"mapped",[11324]],[[11277,11277],"mapped",[11325]],[[11278,11278],"mapped",[11326]],[[11279,11279],"mapped",[11327]],[[11280,11280],"mapped",[11328]],[[11281,11281],"mapped",[11329]],[[11282,11282],"mapped",[11330]],[[11283,11283],"mapped",[11331]],[[11284,11284],"mapped",[11332]],[[11285,11285],"mapped",[11333]],[[11286,11286],"mapped",[11334]],[[11287,11287],"mapped",[11335]],[[11288,11288],"mapped",[11336]],[[11289,11289],"mapped",[11337]],[[11290,11290],"mapped",[11338]],[[11291,11291],"mapped",[11339]],[[11292,11292],"mapped",[11340]],[[11293,11293],"mapped",[11341]],[[11294,11294],"mapped",[11342]],[[11295,11295],"mapped",[11343]],[[11296,11296],"mapped",[11344]],[[11297,11297],"mapped",[11345]],[[11298,11298],"mapped",[11346]],[[11299,11299],"mapped",[11347]],[[11300,11300],"mapped",[11348]],[[11301,11301],"mapped",[11349]],[[11302,11302],"mapped",[11350]],[[11303,11303],"mapped",[11351]],[[11304,11304],"mapped",[11352]],[[11305,11305],"mapped",[11353]],[[11306,11306],"mapped",[11354]],[[11307,11307],"mapped",[11355]],[[11308,11308],"mapped",[11356]],[[11309,11309],"mapped",[11357]],[[11310,11310],"mapped",[11358]],[[11311,11311],"disallowed"],[[11312,11358],"valid"],[[11359,11359],"disallowed"],[[11360,11360],"mapped",[11361]],[[11361,11361],"valid"],[[11362,11362],"mapped",[619]],[[11363,11363],"mapped",[7549]],[[11364,11364],"mapped",[637]],[[11365,11366],"valid"],[[11367,11367],"mapped",[11368]],[[11368,11368],"valid"],[[11369,11369],"mapped",[11370]],[[11370,11370],"valid"],[[11371,11371],"mapped",[11372]],[[11372,11372],"valid"],[[11373,11373],"mapped",[593]],[[11374,11374],"mapped",[625]],[[11375,11375],"mapped",[592]],[[11376,11376],"mapped",[594]],[[11377,11377],"valid"],[[11378,11378],"mapped",[11379]],[[11379,11379],"valid"],[[11380,11380],"valid"],[[11381,11381],"mapped",[11382]],[[11382,11383],"valid"],[[11384,11387],"valid"],[[11388,11388],"mapped",[106]],[[11389,11389],"mapped",[118]],[[11390,11390],"mapped",[575]],[[11391,11391],"mapped",[576]],[[11392,11392],"mapped",[11393]],[[11393,11393],"valid"],[[11394,11394],"mapped",[11395]],[[11395,11395],"valid"],[[11396,11396],"mapped",[11397]],[[11397,11397],"valid"],[[11398,11398],"mapped",[11399]],[[11399,11399],"valid"],[[11400,11400],"mapped",[11401]],[[11401,11401],"valid"],[[11402,11402],"mapped",[11403]],[[11403,11403],"valid"],[[11404,11404],"mapped",[11405]],[[11405,11405],"valid"],[[11406,11406],"mapped",[11407]],[[11407,11407],"valid"],[[11408,11408],"mapped",[11409]],[[11409,11409],"valid"],[[11410,11410],"mapped",[11411]],[[11411,11411],"valid"],[[11412,11412],"mapped",[11413]],[[11413,11413],"valid"],[[11414,11414],"mapped",[11415]],[[11415,11415],"valid"],[[11416,11416],"mapped",[11417]],[[11417,11417],"valid"],[[11418,11418],"mapped",[11419]],[[11419,11419],"valid"],[[11420,11420],"mapped",[11421]],[[11421,11421],"valid"],[[11422,11422],"mapped",[11423]],[[11423,11423],"valid"],[[11424,11424],"mapped",[11425]],[[11425,11425],"valid"],[[11426,11426],"mapped",[11427]],[[11427,11427],"valid"],[[11428,11428],"mapped",[11429]],[[11429,11429],"valid"],[[11430,11430],"mapped",[11431]],[[11431,11431],"valid"],[[11432,11432],"mapped",[11433]],[[11433,11433],"valid"],[[11434,11434],"mapped",[11435]],[[11435,11435],"valid"],[[11436,11436],"mapped",[11437]],[[11437,11437],"valid"],[[11438,11438],"mapped",[11439]],[[11439,11439],"valid"],[[11440,11440],"mapped",[11441]],[[11441,11441],"valid"],[[11442,11442],"mapped",[11443]],[[11443,11443],"valid"],[[11444,11444],"mapped",[11445]],[[11445,11445],"valid"],[[11446,11446],"mapped",[11447]],[[11447,11447],"valid"],[[11448,11448],"mapped",[11449]],[[11449,11449],"valid"],[[11450,11450],"mapped",[11451]],[[11451,11451],"valid"],[[11452,11452],"mapped",[11453]],[[11453,11453],"valid"],[[11454,11454],"mapped",[11455]],[[11455,11455],"valid"],[[11456,11456],"mapped",[11457]],[[11457,11457],"valid"],[[11458,11458],"mapped",[11459]],[[11459,11459],"valid"],[[11460,11460],"mapped",[11461]],[[11461,11461],"valid"],[[11462,11462],"mapped",[11463]],[[11463,11463],"valid"],[[11464,11464],"mapped",[11465]],[[11465,11465],"valid"],[[11466,11466],"mapped",[11467]],[[11467,11467],"valid"],[[11468,11468],"mapped",[11469]],[[11469,11469],"valid"],[[11470,11470],"mapped",[11471]],[[11471,11471],"valid"],[[11472,11472],"mapped",[11473]],[[11473,11473],"valid"],[[11474,11474],"mapped",[11475]],[[11475,11475],"valid"],[[11476,11476],"mapped",[11477]],[[11477,11477],"valid"],[[11478,11478],"mapped",[11479]],[[11479,11479],"valid"],[[11480,11480],"mapped",[11481]],[[11481,11481],"valid"],[[11482,11482],"mapped",[11483]],[[11483,11483],"valid"],[[11484,11484],"mapped",[11485]],[[11485,11485],"valid"],[[11486,11486],"mapped",[11487]],[[11487,11487],"valid"],[[11488,11488],"mapped",[11489]],[[11489,11489],"valid"],[[11490,11490],"mapped",[11491]],[[11491,11492],"valid"],[[11493,11498],"valid",[],"NV8"],[[11499,11499],"mapped",[11500]],[[11500,11500],"valid"],[[11501,11501],"mapped",[11502]],[[11502,11505],"valid"],[[11506,11506],"mapped",[11507]],[[11507,11507],"valid"],[[11508,11512],"disallowed"],[[11513,11519],"valid",[],"NV8"],[[11520,11557],"valid"],[[11558,11558],"disallowed"],[[11559,11559],"valid"],[[11560,11564],"disallowed"],[[11565,11565],"valid"],[[11566,11567],"disallowed"],[[11568,11621],"valid"],[[11622,11623],"valid"],[[11624,11630],"disallowed"],[[11631,11631],"mapped",[11617]],[[11632,11632],"valid",[],"NV8"],[[11633,11646],"disallowed"],[[11647,11647],"valid"],[[11648,11670],"valid"],[[11671,11679],"disallowed"],[[11680,11686],"valid"],[[11687,11687],"disallowed"],[[11688,11694],"valid"],[[11695,11695],"disallowed"],[[11696,11702],"valid"],[[11703,11703],"disallowed"],[[11704,11710],"valid"],[[11711,11711],"disallowed"],[[11712,11718],"valid"],[[11719,11719],"disallowed"],[[11720,11726],"valid"],[[11727,11727],"disallowed"],[[11728,11734],"valid"],[[11735,11735],"disallowed"],[[11736,11742],"valid"],[[11743,11743],"disallowed"],[[11744,11775],"valid"],[[11776,11799],"valid",[],"NV8"],[[11800,11803],"valid",[],"NV8"],[[11804,11805],"valid",[],"NV8"],[[11806,11822],"valid",[],"NV8"],[[11823,11823],"valid"],[[11824,11824],"valid",[],"NV8"],[[11825,11825],"valid",[],"NV8"],[[11826,11835],"valid",[],"NV8"],[[11836,11842],"valid",[],"NV8"],[[11843,11903],"disallowed"],[[11904,11929],"valid",[],"NV8"],[[11930,11930],"disallowed"],[[11931,11934],"valid",[],"NV8"],[[11935,11935],"mapped",[27597]],[[11936,12018],"valid",[],"NV8"],[[12019,12019],"mapped",[40863]],[[12020,12031],"disallowed"],[[12032,12032],"mapped",[19968]],[[12033,12033],"mapped",[20008]],[[12034,12034],"mapped",[20022]],[[12035,12035],"mapped",[20031]],[[12036,12036],"mapped",[20057]],[[12037,12037],"mapped",[20101]],[[12038,12038],"mapped",[20108]],[[12039,12039],"mapped",[20128]],[[12040,12040],"mapped",[20154]],[[12041,12041],"mapped",[20799]],[[12042,12042],"mapped",[20837]],[[12043,12043],"mapped",[20843]],[[12044,12044],"mapped",[20866]],[[12045,12045],"mapped",[20886]],[[12046,12046],"mapped",[20907]],[[12047,12047],"mapped",[20960]],[[12048,12048],"mapped",[20981]],[[12049,12049],"mapped",[20992]],[[12050,12050],"mapped",[21147]],[[12051,12051],"mapped",[21241]],[[12052,12052],"mapped",[21269]],[[12053,12053],"mapped",[21274]],[[12054,12054],"mapped",[21304]],[[12055,12055],"mapped",[21313]],[[12056,12056],"mapped",[21340]],[[12057,12057],"mapped",[21353]],[[12058,12058],"mapped",[21378]],[[12059,12059],"mapped",[21430]],[[12060,12060],"mapped",[21448]],[[12061,12061],"mapped",[21475]],[[12062,12062],"mapped",[22231]],[[12063,12063],"mapped",[22303]],[[12064,12064],"mapped",[22763]],[[12065,12065],"mapped",[22786]],[[12066,12066],"mapped",[22794]],[[12067,12067],"mapped",[22805]],[[12068,12068],"mapped",[22823]],[[12069,12069],"mapped",[22899]],[[12070,12070],"mapped",[23376]],[[12071,12071],"mapped",[23424]],[[12072,12072],"mapped",[23544]],[[12073,12073],"mapped",[23567]],[[12074,12074],"mapped",[23586]],[[12075,12075],"mapped",[23608]],[[12076,12076],"mapped",[23662]],[[12077,12077],"mapped",[23665]],[[12078,12078],"mapped",[24027]],[[12079,12079],"mapped",[24037]],[[12080,12080],"mapped",[24049]],[[12081,12081],"mapped",[24062]],[[12082,12082],"mapped",[24178]],[[12083,12083],"mapped",[24186]],[[12084,12084],"mapped",[24191]],[[12085,12085],"mapped",[24308]],[[12086,12086],"mapped",[24318]],[[12087,12087],"mapped",[24331]],[[12088,12088],"mapped",[24339]],[[12089,12089],"mapped",[24400]],[[12090,12090],"mapped",[24417]],[[12091,12091],"mapped",[24435]],[[12092,12092],"mapped",[24515]],[[12093,12093],"mapped",[25096]],[[12094,12094],"mapped",[25142]],[[12095,12095],"mapped",[25163]],[[12096,12096],"mapped",[25903]],[[12097,12097],"mapped",[25908]],[[12098,12098],"mapped",[25991]],[[12099,12099],"mapped",[26007]],[[12100,12100],"mapped",[26020]],[[12101,12101],"mapped",[26041]],[[12102,12102],"mapped",[26080]],[[12103,12103],"mapped",[26085]],[[12104,12104],"mapped",[26352]],[[12105,12105],"mapped",[26376]],[[12106,12106],"mapped",[26408]],[[12107,12107],"mapped",[27424]],[[12108,12108],"mapped",[27490]],[[12109,12109],"mapped",[27513]],[[12110,12110],"mapped",[27571]],[[12111,12111],"mapped",[27595]],[[12112,12112],"mapped",[27604]],[[12113,12113],"mapped",[27611]],[[12114,12114],"mapped",[27663]],[[12115,12115],"mapped",[27668]],[[12116,12116],"mapped",[27700]],[[12117,12117],"mapped",[28779]],[[12118,12118],"mapped",[29226]],[[12119,12119],"mapped",[29238]],[[12120,12120],"mapped",[29243]],[[12121,12121],"mapped",[29247]],[[12122,12122],"mapped",[29255]],[[12123,12123],"mapped",[29273]],[[12124,12124],"mapped",[29275]],[[12125,12125],"mapped",[29356]],[[12126,12126],"mapped",[29572]],[[12127,12127],"mapped",[29577]],[[12128,12128],"mapped",[29916]],[[12129,12129],"mapped",[29926]],[[12130,12130],"mapped",[29976]],[[12131,12131],"mapped",[29983]],[[12132,12132],"mapped",[29992]],[[12133,12133],"mapped",[3e4]],[[12134,12134],"mapped",[30091]],[[12135,12135],"mapped",[30098]],[[12136,12136],"mapped",[30326]],[[12137,12137],"mapped",[30333]],[[12138,12138],"mapped",[30382]],[[12139,12139],"mapped",[30399]],[[12140,12140],"mapped",[30446]],[[12141,12141],"mapped",[30683]],[[12142,12142],"mapped",[30690]],[[12143,12143],"mapped",[30707]],[[12144,12144],"mapped",[31034]],[[12145,12145],"mapped",[31160]],[[12146,12146],"mapped",[31166]],[[12147,12147],"mapped",[31348]],[[12148,12148],"mapped",[31435]],[[12149,12149],"mapped",[31481]],[[12150,12150],"mapped",[31859]],[[12151,12151],"mapped",[31992]],[[12152,12152],"mapped",[32566]],[[12153,12153],"mapped",[32593]],[[12154,12154],"mapped",[32650]],[[12155,12155],"mapped",[32701]],[[12156,12156],"mapped",[32769]],[[12157,12157],"mapped",[32780]],[[12158,12158],"mapped",[32786]],[[12159,12159],"mapped",[32819]],[[12160,12160],"mapped",[32895]],[[12161,12161],"mapped",[32905]],[[12162,12162],"mapped",[33251]],[[12163,12163],"mapped",[33258]],[[12164,12164],"mapped",[33267]],[[12165,12165],"mapped",[33276]],[[12166,12166],"mapped",[33292]],[[12167,12167],"mapped",[33307]],[[12168,12168],"mapped",[33311]],[[12169,12169],"mapped",[33390]],[[12170,12170],"mapped",[33394]],[[12171,12171],"mapped",[33400]],[[12172,12172],"mapped",[34381]],[[12173,12173],"mapped",[34411]],[[12174,12174],"mapped",[34880]],[[12175,12175],"mapped",[34892]],[[12176,12176],"mapped",[34915]],[[12177,12177],"mapped",[35198]],[[12178,12178],"mapped",[35211]],[[12179,12179],"mapped",[35282]],[[12180,12180],"mapped",[35328]],[[12181,12181],"mapped",[35895]],[[12182,12182],"mapped",[35910]],[[12183,12183],"mapped",[35925]],[[12184,12184],"mapped",[35960]],[[12185,12185],"mapped",[35997]],[[12186,12186],"mapped",[36196]],[[12187,12187],"mapped",[36208]],[[12188,12188],"mapped",[36275]],[[12189,12189],"mapped",[36523]],[[12190,12190],"mapped",[36554]],[[12191,12191],"mapped",[36763]],[[12192,12192],"mapped",[36784]],[[12193,12193],"mapped",[36789]],[[12194,12194],"mapped",[37009]],[[12195,12195],"mapped",[37193]],[[12196,12196],"mapped",[37318]],[[12197,12197],"mapped",[37324]],[[12198,12198],"mapped",[37329]],[[12199,12199],"mapped",[38263]],[[12200,12200],"mapped",[38272]],[[12201,12201],"mapped",[38428]],[[12202,12202],"mapped",[38582]],[[12203,12203],"mapped",[38585]],[[12204,12204],"mapped",[38632]],[[12205,12205],"mapped",[38737]],[[12206,12206],"mapped",[38750]],[[12207,12207],"mapped",[38754]],[[12208,12208],"mapped",[38761]],[[12209,12209],"mapped",[38859]],[[12210,12210],"mapped",[38893]],[[12211,12211],"mapped",[38899]],[[12212,12212],"mapped",[38913]],[[12213,12213],"mapped",[39080]],[[12214,12214],"mapped",[39131]],[[12215,12215],"mapped",[39135]],[[12216,12216],"mapped",[39318]],[[12217,12217],"mapped",[39321]],[[12218,12218],"mapped",[39340]],[[12219,12219],"mapped",[39592]],[[12220,12220],"mapped",[39640]],[[12221,12221],"mapped",[39647]],[[12222,12222],"mapped",[39717]],[[12223,12223],"mapped",[39727]],[[12224,12224],"mapped",[39730]],[[12225,12225],"mapped",[39740]],[[12226,12226],"mapped",[39770]],[[12227,12227],"mapped",[40165]],[[12228,12228],"mapped",[40565]],[[12229,12229],"mapped",[40575]],[[12230,12230],"mapped",[40613]],[[12231,12231],"mapped",[40635]],[[12232,12232],"mapped",[40643]],[[12233,12233],"mapped",[40653]],[[12234,12234],"mapped",[40657]],[[12235,12235],"mapped",[40697]],[[12236,12236],"mapped",[40701]],[[12237,12237],"mapped",[40718]],[[12238,12238],"mapped",[40723]],[[12239,12239],"mapped",[40736]],[[12240,12240],"mapped",[40763]],[[12241,12241],"mapped",[40778]],[[12242,12242],"mapped",[40786]],[[12243,12243],"mapped",[40845]],[[12244,12244],"mapped",[40860]],[[12245,12245],"mapped",[40864]],[[12246,12271],"disallowed"],[[12272,12283],"disallowed"],[[12284,12287],"disallowed"],[[12288,12288],"disallowed_STD3_mapped",[32]],[[12289,12289],"valid",[],"NV8"],[[12290,12290],"mapped",[46]],[[12291,12292],"valid",[],"NV8"],[[12293,12295],"valid"],[[12296,12329],"valid",[],"NV8"],[[12330,12333],"valid"],[[12334,12341],"valid",[],"NV8"],[[12342,12342],"mapped",[12306]],[[12343,12343],"valid",[],"NV8"],[[12344,12344],"mapped",[21313]],[[12345,12345],"mapped",[21316]],[[12346,12346],"mapped",[21317]],[[12347,12347],"valid",[],"NV8"],[[12348,12348],"valid"],[[12349,12349],"valid",[],"NV8"],[[12350,12350],"valid",[],"NV8"],[[12351,12351],"valid",[],"NV8"],[[12352,12352],"disallowed"],[[12353,12436],"valid"],[[12437,12438],"valid"],[[12439,12440],"disallowed"],[[12441,12442],"valid"],[[12443,12443],"disallowed_STD3_mapped",[32,12441]],[[12444,12444],"disallowed_STD3_mapped",[32,12442]],[[12445,12446],"valid"],[[12447,12447],"mapped",[12424,12426]],[[12448,12448],"valid",[],"NV8"],[[12449,12542],"valid"],[[12543,12543],"mapped",[12467,12488]],[[12544,12548],"disallowed"],[[12549,12588],"valid"],[[12589,12589],"valid"],[[12590,12592],"disallowed"],[[12593,12593],"mapped",[4352]],[[12594,12594],"mapped",[4353]],[[12595,12595],"mapped",[4522]],[[12596,12596],"mapped",[4354]],[[12597,12597],"mapped",[4524]],[[12598,12598],"mapped",[4525]],[[12599,12599],"mapped",[4355]],[[12600,12600],"mapped",[4356]],[[12601,12601],"mapped",[4357]],[[12602,12602],"mapped",[4528]],[[12603,12603],"mapped",[4529]],[[12604,12604],"mapped",[4530]],[[12605,12605],"mapped",[4531]],[[12606,12606],"mapped",[4532]],[[12607,12607],"mapped",[4533]],[[12608,12608],"mapped",[4378]],[[12609,12609],"mapped",[4358]],[[12610,12610],"mapped",[4359]],[[12611,12611],"mapped",[4360]],[[12612,12612],"mapped",[4385]],[[12613,12613],"mapped",[4361]],[[12614,12614],"mapped",[4362]],[[12615,12615],"mapped",[4363]],[[12616,12616],"mapped",[4364]],[[12617,12617],"mapped",[4365]],[[12618,12618],"mapped",[4366]],[[12619,12619],"mapped",[4367]],[[12620,12620],"mapped",[4368]],[[12621,12621],"mapped",[4369]],[[12622,12622],"mapped",[4370]],[[12623,12623],"mapped",[4449]],[[12624,12624],"mapped",[4450]],[[12625,12625],"mapped",[4451]],[[12626,12626],"mapped",[4452]],[[12627,12627],"mapped",[4453]],[[12628,12628],"mapped",[4454]],[[12629,12629],"mapped",[4455]],[[12630,12630],"mapped",[4456]],[[12631,12631],"mapped",[4457]],[[12632,12632],"mapped",[4458]],[[12633,12633],"mapped",[4459]],[[12634,12634],"mapped",[4460]],[[12635,12635],"mapped",[4461]],[[12636,12636],"mapped",[4462]],[[12637,12637],"mapped",[4463]],[[12638,12638],"mapped",[4464]],[[12639,12639],"mapped",[4465]],[[12640,12640],"mapped",[4466]],[[12641,12641],"mapped",[4467]],[[12642,12642],"mapped",[4468]],[[12643,12643],"mapped",[4469]],[[12644,12644],"disallowed"],[[12645,12645],"mapped",[4372]],[[12646,12646],"mapped",[4373]],[[12647,12647],"mapped",[4551]],[[12648,12648],"mapped",[4552]],[[12649,12649],"mapped",[4556]],[[12650,12650],"mapped",[4558]],[[12651,12651],"mapped",[4563]],[[12652,12652],"mapped",[4567]],[[12653,12653],"mapped",[4569]],[[12654,12654],"mapped",[4380]],[[12655,12655],"mapped",[4573]],[[12656,12656],"mapped",[4575]],[[12657,12657],"mapped",[4381]],[[12658,12658],"mapped",[4382]],[[12659,12659],"mapped",[4384]],[[12660,12660],"mapped",[4386]],[[12661,12661],"mapped",[4387]],[[12662,12662],"mapped",[4391]],[[12663,12663],"mapped",[4393]],[[12664,12664],"mapped",[4395]],[[12665,12665],"mapped",[4396]],[[12666,12666],"mapped",[4397]],[[12667,12667],"mapped",[4398]],[[12668,12668],"mapped",[4399]],[[12669,12669],"mapped",[4402]],[[12670,12670],"mapped",[4406]],[[12671,12671],"mapped",[4416]],[[12672,12672],"mapped",[4423]],[[12673,12673],"mapped",[4428]],[[12674,12674],"mapped",[4593]],[[12675,12675],"mapped",[4594]],[[12676,12676],"mapped",[4439]],[[12677,12677],"mapped",[4440]],[[12678,12678],"mapped",[4441]],[[12679,12679],"mapped",[4484]],[[12680,12680],"mapped",[4485]],[[12681,12681],"mapped",[4488]],[[12682,12682],"mapped",[4497]],[[12683,12683],"mapped",[4498]],[[12684,12684],"mapped",[4500]],[[12685,12685],"mapped",[4510]],[[12686,12686],"mapped",[4513]],[[12687,12687],"disallowed"],[[12688,12689],"valid",[],"NV8"],[[12690,12690],"mapped",[19968]],[[12691,12691],"mapped",[20108]],[[12692,12692],"mapped",[19977]],[[12693,12693],"mapped",[22235]],[[12694,12694],"mapped",[19978]],[[12695,12695],"mapped",[20013]],[[12696,12696],"mapped",[19979]],[[12697,12697],"mapped",[30002]],[[12698,12698],"mapped",[20057]],[[12699,12699],"mapped",[19993]],[[12700,12700],"mapped",[19969]],[[12701,12701],"mapped",[22825]],[[12702,12702],"mapped",[22320]],[[12703,12703],"mapped",[20154]],[[12704,12727],"valid"],[[12728,12730],"valid"],[[12731,12735],"disallowed"],[[12736,12751],"valid",[],"NV8"],[[12752,12771],"valid",[],"NV8"],[[12772,12783],"disallowed"],[[12784,12799],"valid"],[[12800,12800],"disallowed_STD3_mapped",[40,4352,41]],[[12801,12801],"disallowed_STD3_mapped",[40,4354,41]],[[12802,12802],"disallowed_STD3_mapped",[40,4355,41]],[[12803,12803],"disallowed_STD3_mapped",[40,4357,41]],[[12804,12804],"disallowed_STD3_mapped",[40,4358,41]],[[12805,12805],"disallowed_STD3_mapped",[40,4359,41]],[[12806,12806],"disallowed_STD3_mapped",[40,4361,41]],[[12807,12807],"disallowed_STD3_mapped",[40,4363,41]],[[12808,12808],"disallowed_STD3_mapped",[40,4364,41]],[[12809,12809],"disallowed_STD3_mapped",[40,4366,41]],[[12810,12810],"disallowed_STD3_mapped",[40,4367,41]],[[12811,12811],"disallowed_STD3_mapped",[40,4368,41]],[[12812,12812],"disallowed_STD3_mapped",[40,4369,41]],[[12813,12813],"disallowed_STD3_mapped",[40,4370,41]],[[12814,12814],"disallowed_STD3_mapped",[40,44032,41]],[[12815,12815],"disallowed_STD3_mapped",[40,45208,41]],[[12816,12816],"disallowed_STD3_mapped",[40,45796,41]],[[12817,12817],"disallowed_STD3_mapped",[40,46972,41]],[[12818,12818],"disallowed_STD3_mapped",[40,47560,41]],[[12819,12819],"disallowed_STD3_mapped",[40,48148,41]],[[12820,12820],"disallowed_STD3_mapped",[40,49324,41]],[[12821,12821],"disallowed_STD3_mapped",[40,50500,41]],[[12822,12822],"disallowed_STD3_mapped",[40,51088,41]],[[12823,12823],"disallowed_STD3_mapped",[40,52264,41]],[[12824,12824],"disallowed_STD3_mapped",[40,52852,41]],[[12825,12825],"disallowed_STD3_mapped",[40,53440,41]],[[12826,12826],"disallowed_STD3_mapped",[40,54028,41]],[[12827,12827],"disallowed_STD3_mapped",[40,54616,41]],[[12828,12828],"disallowed_STD3_mapped",[40,51452,41]],[[12829,12829],"disallowed_STD3_mapped",[40,50724,51204,41]],[[12830,12830],"disallowed_STD3_mapped",[40,50724,54980,41]],[[12831,12831],"disallowed"],[[12832,12832],"disallowed_STD3_mapped",[40,19968,41]],[[12833,12833],"disallowed_STD3_mapped",[40,20108,41]],[[12834,12834],"disallowed_STD3_mapped",[40,19977,41]],[[12835,12835],"disallowed_STD3_mapped",[40,22235,41]],[[12836,12836],"disallowed_STD3_mapped",[40,20116,41]],[[12837,12837],"disallowed_STD3_mapped",[40,20845,41]],[[12838,12838],"disallowed_STD3_mapped",[40,19971,41]],[[12839,12839],"disallowed_STD3_mapped",[40,20843,41]],[[12840,12840],"disallowed_STD3_mapped",[40,20061,41]],[[12841,12841],"disallowed_STD3_mapped",[40,21313,41]],[[12842,12842],"disallowed_STD3_mapped",[40,26376,41]],[[12843,12843],"disallowed_STD3_mapped",[40,28779,41]],[[12844,12844],"disallowed_STD3_mapped",[40,27700,41]],[[12845,12845],"disallowed_STD3_mapped",[40,26408,41]],[[12846,12846],"disallowed_STD3_mapped",[40,37329,41]],[[12847,12847],"disallowed_STD3_mapped",[40,22303,41]],[[12848,12848],"disallowed_STD3_mapped",[40,26085,41]],[[12849,12849],"disallowed_STD3_mapped",[40,26666,41]],[[12850,12850],"disallowed_STD3_mapped",[40,26377,41]],[[12851,12851],"disallowed_STD3_mapped",[40,31038,41]],[[12852,12852],"disallowed_STD3_mapped",[40,21517,41]],[[12853,12853],"disallowed_STD3_mapped",[40,29305,41]],[[12854,12854],"disallowed_STD3_mapped",[40,36001,41]],[[12855,12855],"disallowed_STD3_mapped",[40,31069,41]],[[12856,12856],"disallowed_STD3_mapped",[40,21172,41]],[[12857,12857],"disallowed_STD3_mapped",[40,20195,41]],[[12858,12858],"disallowed_STD3_mapped",[40,21628,41]],[[12859,12859],"disallowed_STD3_mapped",[40,23398,41]],[[12860,12860],"disallowed_STD3_mapped",[40,30435,41]],[[12861,12861],"disallowed_STD3_mapped",[40,20225,41]],[[12862,12862],"disallowed_STD3_mapped",[40,36039,41]],[[12863,12863],"disallowed_STD3_mapped",[40,21332,41]],[[12864,12864],"disallowed_STD3_mapped",[40,31085,41]],[[12865,12865],"disallowed_STD3_mapped",[40,20241,41]],[[12866,12866],"disallowed_STD3_mapped",[40,33258,41]],[[12867,12867],"disallowed_STD3_mapped",[40,33267,41]],[[12868,12868],"mapped",[21839]],[[12869,12869],"mapped",[24188]],[[12870,12870],"mapped",[25991]],[[12871,12871],"mapped",[31631]],[[12872,12879],"valid",[],"NV8"],[[12880,12880],"mapped",[112,116,101]],[[12881,12881],"mapped",[50,49]],[[12882,12882],"mapped",[50,50]],[[12883,12883],"mapped",[50,51]],[[12884,12884],"mapped",[50,52]],[[12885,12885],"mapped",[50,53]],[[12886,12886],"mapped",[50,54]],[[12887,12887],"mapped",[50,55]],[[12888,12888],"mapped",[50,56]],[[12889,12889],"mapped",[50,57]],[[12890,12890],"mapped",[51,48]],[[12891,12891],"mapped",[51,49]],[[12892,12892],"mapped",[51,50]],[[12893,12893],"mapped",[51,51]],[[12894,12894],"mapped",[51,52]],[[12895,12895],"mapped",[51,53]],[[12896,12896],"mapped",[4352]],[[12897,12897],"mapped",[4354]],[[12898,12898],"mapped",[4355]],[[12899,12899],"mapped",[4357]],[[12900,12900],"mapped",[4358]],[[12901,12901],"mapped",[4359]],[[12902,12902],"mapped",[4361]],[[12903,12903],"mapped",[4363]],[[12904,12904],"mapped",[4364]],[[12905,12905],"mapped",[4366]],[[12906,12906],"mapped",[4367]],[[12907,12907],"mapped",[4368]],[[12908,12908],"mapped",[4369]],[[12909,12909],"mapped",[4370]],[[12910,12910],"mapped",[44032]],[[12911,12911],"mapped",[45208]],[[12912,12912],"mapped",[45796]],[[12913,12913],"mapped",[46972]],[[12914,12914],"mapped",[47560]],[[12915,12915],"mapped",[48148]],[[12916,12916],"mapped",[49324]],[[12917,12917],"mapped",[50500]],[[12918,12918],"mapped",[51088]],[[12919,12919],"mapped",[52264]],[[12920,12920],"mapped",[52852]],[[12921,12921],"mapped",[53440]],[[12922,12922],"mapped",[54028]],[[12923,12923],"mapped",[54616]],[[12924,12924],"mapped",[52280,44256]],[[12925,12925],"mapped",[51452,51032]],[[12926,12926],"mapped",[50864]],[[12927,12927],"valid",[],"NV8"],[[12928,12928],"mapped",[19968]],[[12929,12929],"mapped",[20108]],[[12930,12930],"mapped",[19977]],[[12931,12931],"mapped",[22235]],[[12932,12932],"mapped",[20116]],[[12933,12933],"mapped",[20845]],[[12934,12934],"mapped",[19971]],[[12935,12935],"mapped",[20843]],[[12936,12936],"mapped",[20061]],[[12937,12937],"mapped",[21313]],[[12938,12938],"mapped",[26376]],[[12939,12939],"mapped",[28779]],[[12940,12940],"mapped",[27700]],[[12941,12941],"mapped",[26408]],[[12942,12942],"mapped",[37329]],[[12943,12943],"mapped",[22303]],[[12944,12944],"mapped",[26085]],[[12945,12945],"mapped",[26666]],[[12946,12946],"mapped",[26377]],[[12947,12947],"mapped",[31038]],[[12948,12948],"mapped",[21517]],[[12949,12949],"mapped",[29305]],[[12950,12950],"mapped",[36001]],[[12951,12951],"mapped",[31069]],[[12952,12952],"mapped",[21172]],[[12953,12953],"mapped",[31192]],[[12954,12954],"mapped",[30007]],[[12955,12955],"mapped",[22899]],[[12956,12956],"mapped",[36969]],[[12957,12957],"mapped",[20778]],[[12958,12958],"mapped",[21360]],[[12959,12959],"mapped",[27880]],[[12960,12960],"mapped",[38917]],[[12961,12961],"mapped",[20241]],[[12962,12962],"mapped",[20889]],[[12963,12963],"mapped",[27491]],[[12964,12964],"mapped",[19978]],[[12965,12965],"mapped",[20013]],[[12966,12966],"mapped",[19979]],[[12967,12967],"mapped",[24038]],[[12968,12968],"mapped",[21491]],[[12969,12969],"mapped",[21307]],[[12970,12970],"mapped",[23447]],[[12971,12971],"mapped",[23398]],[[12972,12972],"mapped",[30435]],[[12973,12973],"mapped",[20225]],[[12974,12974],"mapped",[36039]],[[12975,12975],"mapped",[21332]],[[12976,12976],"mapped",[22812]],[[12977,12977],"mapped",[51,54]],[[12978,12978],"mapped",[51,55]],[[12979,12979],"mapped",[51,56]],[[12980,12980],"mapped",[51,57]],[[12981,12981],"mapped",[52,48]],[[12982,12982],"mapped",[52,49]],[[12983,12983],"mapped",[52,50]],[[12984,12984],"mapped",[52,51]],[[12985,12985],"mapped",[52,52]],[[12986,12986],"mapped",[52,53]],[[12987,12987],"mapped",[52,54]],[[12988,12988],"mapped",[52,55]],[[12989,12989],"mapped",[52,56]],[[12990,12990],"mapped",[52,57]],[[12991,12991],"mapped",[53,48]],[[12992,12992],"mapped",[49,26376]],[[12993,12993],"mapped",[50,26376]],[[12994,12994],"mapped",[51,26376]],[[12995,12995],"mapped",[52,26376]],[[12996,12996],"mapped",[53,26376]],[[12997,12997],"mapped",[54,26376]],[[12998,12998],"mapped",[55,26376]],[[12999,12999],"mapped",[56,26376]],[[13e3,13e3],"mapped",[57,26376]],[[13001,13001],"mapped",[49,48,26376]],[[13002,13002],"mapped",[49,49,26376]],[[13003,13003],"mapped",[49,50,26376]],[[13004,13004],"mapped",[104,103]],[[13005,13005],"mapped",[101,114,103]],[[13006,13006],"mapped",[101,118]],[[13007,13007],"mapped",[108,116,100]],[[13008,13008],"mapped",[12450]],[[13009,13009],"mapped",[12452]],[[13010,13010],"mapped",[12454]],[[13011,13011],"mapped",[12456]],[[13012,13012],"mapped",[12458]],[[13013,13013],"mapped",[12459]],[[13014,13014],"mapped",[12461]],[[13015,13015],"mapped",[12463]],[[13016,13016],"mapped",[12465]],[[13017,13017],"mapped",[12467]],[[13018,13018],"mapped",[12469]],[[13019,13019],"mapped",[12471]],[[13020,13020],"mapped",[12473]],[[13021,13021],"mapped",[12475]],[[13022,13022],"mapped",[12477]],[[13023,13023],"mapped",[12479]],[[13024,13024],"mapped",[12481]],[[13025,13025],"mapped",[12484]],[[13026,13026],"mapped",[12486]],[[13027,13027],"mapped",[12488]],[[13028,13028],"mapped",[12490]],[[13029,13029],"mapped",[12491]],[[13030,13030],"mapped",[12492]],[[13031,13031],"mapped",[12493]],[[13032,13032],"mapped",[12494]],[[13033,13033],"mapped",[12495]],[[13034,13034],"mapped",[12498]],[[13035,13035],"mapped",[12501]],[[13036,13036],"mapped",[12504]],[[13037,13037],"mapped",[12507]],[[13038,13038],"mapped",[12510]],[[13039,13039],"mapped",[12511]],[[13040,13040],"mapped",[12512]],[[13041,13041],"mapped",[12513]],[[13042,13042],"mapped",[12514]],[[13043,13043],"mapped",[12516]],[[13044,13044],"mapped",[12518]],[[13045,13045],"mapped",[12520]],[[13046,13046],"mapped",[12521]],[[13047,13047],"mapped",[12522]],[[13048,13048],"mapped",[12523]],[[13049,13049],"mapped",[12524]],[[13050,13050],"mapped",[12525]],[[13051,13051],"mapped",[12527]],[[13052,13052],"mapped",[12528]],[[13053,13053],"mapped",[12529]],[[13054,13054],"mapped",[12530]],[[13055,13055],"disallowed"],[[13056,13056],"mapped",[12450,12497,12540,12488]],[[13057,13057],"mapped",[12450,12523,12501,12449]],[[13058,13058],"mapped",[12450,12531,12506,12450]],[[13059,13059],"mapped",[12450,12540,12523]],[[13060,13060],"mapped",[12452,12491,12531,12464]],[[13061,13061],"mapped",[12452,12531,12481]],[[13062,13062],"mapped",[12454,12457,12531]],[[13063,13063],"mapped",[12456,12473,12463,12540,12489]],[[13064,13064],"mapped",[12456,12540,12459,12540]],[[13065,13065],"mapped",[12458,12531,12473]],[[13066,13066],"mapped",[12458,12540,12512]],[[13067,13067],"mapped",[12459,12452,12522]],[[13068,13068],"mapped",[12459,12521,12483,12488]],[[13069,13069],"mapped",[12459,12525,12522,12540]],[[13070,13070],"mapped",[12460,12525,12531]],[[13071,13071],"mapped",[12460,12531,12510]],[[13072,13072],"mapped",[12462,12460]],[[13073,13073],"mapped",[12462,12491,12540]],[[13074,13074],"mapped",[12461,12517,12522,12540]],[[13075,13075],"mapped",[12462,12523,12480,12540]],[[13076,13076],"mapped",[12461,12525]],[[13077,13077],"mapped",[12461,12525,12464,12521,12512]],[[13078,13078],"mapped",[12461,12525,12513,12540,12488,12523]],[[13079,13079],"mapped",[12461,12525,12527,12483,12488]],[[13080,13080],"mapped",[12464,12521,12512]],[[13081,13081],"mapped",[12464,12521,12512,12488,12531]],[[13082,13082],"mapped",[12463,12523,12476,12452,12525]],[[13083,13083],"mapped",[12463,12525,12540,12493]],[[13084,13084],"mapped",[12465,12540,12473]],[[13085,13085],"mapped",[12467,12523,12490]],[[13086,13086],"mapped",[12467,12540,12509]],[[13087,13087],"mapped",[12469,12452,12463,12523]],[[13088,13088],"mapped",[12469,12531,12481,12540,12512]],[[13089,13089],"mapped",[12471,12522,12531,12464]],[[13090,13090],"mapped",[12475,12531,12481]],[[13091,13091],"mapped",[12475,12531,12488]],[[13092,13092],"mapped",[12480,12540,12473]],[[13093,13093],"mapped",[12487,12471]],[[13094,13094],"mapped",[12489,12523]],[[13095,13095],"mapped",[12488,12531]],[[13096,13096],"mapped",[12490,12494]],[[13097,13097],"mapped",[12494,12483,12488]],[[13098,13098],"mapped",[12495,12452,12484]],[[13099,13099],"mapped",[12497,12540,12475,12531,12488]],[[13100,13100],"mapped",[12497,12540,12484]],[[13101,13101],"mapped",[12496,12540,12524,12523]],[[13102,13102],"mapped",[12500,12450,12473,12488,12523]],[[13103,13103],"mapped",[12500,12463,12523]],[[13104,13104],"mapped",[12500,12467]],[[13105,13105],"mapped",[12499,12523]],[[13106,13106],"mapped",[12501,12449,12521,12483,12489]],[[13107,13107],"mapped",[12501,12451,12540,12488]],[[13108,13108],"mapped",[12502,12483,12471,12455,12523]],[[13109,13109],"mapped",[12501,12521,12531]],[[13110,13110],"mapped",[12504,12463,12479,12540,12523]],[[13111,13111],"mapped",[12506,12477]],[[13112,13112],"mapped",[12506,12491,12498]],[[13113,13113],"mapped",[12504,12523,12484]],[[13114,13114],"mapped",[12506,12531,12473]],[[13115,13115],"mapped",[12506,12540,12472]],[[13116,13116],"mapped",[12505,12540,12479]],[[13117,13117],"mapped",[12509,12452,12531,12488]],[[13118,13118],"mapped",[12508,12523,12488]],[[13119,13119],"mapped",[12507,12531]],[[13120,13120],"mapped",[12509,12531,12489]],[[13121,13121],"mapped",[12507,12540,12523]],[[13122,13122],"mapped",[12507,12540,12531]],[[13123,13123],"mapped",[12510,12452,12463,12525]],[[13124,13124],"mapped",[12510,12452,12523]],[[13125,13125],"mapped",[12510,12483,12495]],[[13126,13126],"mapped",[12510,12523,12463]],[[13127,13127],"mapped",[12510,12531,12471,12519,12531]],[[13128,13128],"mapped",[12511,12463,12525,12531]],[[13129,13129],"mapped",[12511,12522]],[[13130,13130],"mapped",[12511,12522,12496,12540,12523]],[[13131,13131],"mapped",[12513,12460]],[[13132,13132],"mapped",[12513,12460,12488,12531]],[[13133,13133],"mapped",[12513,12540,12488,12523]],[[13134,13134],"mapped",[12516,12540,12489]],[[13135,13135],"mapped",[12516,12540,12523]],[[13136,13136],"mapped",[12518,12450,12531]],[[13137,13137],"mapped",[12522,12483,12488,12523]],[[13138,13138],"mapped",[12522,12521]],[[13139,13139],"mapped",[12523,12500,12540]],[[13140,13140],"mapped",[12523,12540,12502,12523]],[[13141,13141],"mapped",[12524,12512]],[[13142,13142],"mapped",[12524,12531,12488,12466,12531]],[[13143,13143],"mapped",[12527,12483,12488]],[[13144,13144],"mapped",[48,28857]],[[13145,13145],"mapped",[49,28857]],[[13146,13146],"mapped",[50,28857]],[[13147,13147],"mapped",[51,28857]],[[13148,13148],"mapped",[52,28857]],[[13149,13149],"mapped",[53,28857]],[[13150,13150],"mapped",[54,28857]],[[13151,13151],"mapped",[55,28857]],[[13152,13152],"mapped",[56,28857]],[[13153,13153],"mapped",[57,28857]],[[13154,13154],"mapped",[49,48,28857]],[[13155,13155],"mapped",[49,49,28857]],[[13156,13156],"mapped",[49,50,28857]],[[13157,13157],"mapped",[49,51,28857]],[[13158,13158],"mapped",[49,52,28857]],[[13159,13159],"mapped",[49,53,28857]],[[13160,13160],"mapped",[49,54,28857]],[[13161,13161],"mapped",[49,55,28857]],[[13162,13162],"mapped",[49,56,28857]],[[13163,13163],"mapped",[49,57,28857]],[[13164,13164],"mapped",[50,48,28857]],[[13165,13165],"mapped",[50,49,28857]],[[13166,13166],"mapped",[50,50,28857]],[[13167,13167],"mapped",[50,51,28857]],[[13168,13168],"mapped",[50,52,28857]],[[13169,13169],"mapped",[104,112,97]],[[13170,13170],"mapped",[100,97]],[[13171,13171],"mapped",[97,117]],[[13172,13172],"mapped",[98,97,114]],[[13173,13173],"mapped",[111,118]],[[13174,13174],"mapped",[112,99]],[[13175,13175],"mapped",[100,109]],[[13176,13176],"mapped",[100,109,50]],[[13177,13177],"mapped",[100,109,51]],[[13178,13178],"mapped",[105,117]],[[13179,13179],"mapped",[24179,25104]],[[13180,13180],"mapped",[26157,21644]],[[13181,13181],"mapped",[22823,27491]],[[13182,13182],"mapped",[26126,27835]],[[13183,13183],"mapped",[26666,24335,20250,31038]],[[13184,13184],"mapped",[112,97]],[[13185,13185],"mapped",[110,97]],[[13186,13186],"mapped",[956,97]],[[13187,13187],"mapped",[109,97]],[[13188,13188],"mapped",[107,97]],[[13189,13189],"mapped",[107,98]],[[13190,13190],"mapped",[109,98]],[[13191,13191],"mapped",[103,98]],[[13192,13192],"mapped",[99,97,108]],[[13193,13193],"mapped",[107,99,97,108]],[[13194,13194],"mapped",[112,102]],[[13195,13195],"mapped",[110,102]],[[13196,13196],"mapped",[956,102]],[[13197,13197],"mapped",[956,103]],[[13198,13198],"mapped",[109,103]],[[13199,13199],"mapped",[107,103]],[[13200,13200],"mapped",[104,122]],[[13201,13201],"mapped",[107,104,122]],[[13202,13202],"mapped",[109,104,122]],[[13203,13203],"mapped",[103,104,122]],[[13204,13204],"mapped",[116,104,122]],[[13205,13205],"mapped",[956,108]],[[13206,13206],"mapped",[109,108]],[[13207,13207],"mapped",[100,108]],[[13208,13208],"mapped",[107,108]],[[13209,13209],"mapped",[102,109]],[[13210,13210],"mapped",[110,109]],[[13211,13211],"mapped",[956,109]],[[13212,13212],"mapped",[109,109]],[[13213,13213],"mapped",[99,109]],[[13214,13214],"mapped",[107,109]],[[13215,13215],"mapped",[109,109,50]],[[13216,13216],"mapped",[99,109,50]],[[13217,13217],"mapped",[109,50]],[[13218,13218],"mapped",[107,109,50]],[[13219,13219],"mapped",[109,109,51]],[[13220,13220],"mapped",[99,109,51]],[[13221,13221],"mapped",[109,51]],[[13222,13222],"mapped",[107,109,51]],[[13223,13223],"mapped",[109,8725,115]],[[13224,13224],"mapped",[109,8725,115,50]],[[13225,13225],"mapped",[112,97]],[[13226,13226],"mapped",[107,112,97]],[[13227,13227],"mapped",[109,112,97]],[[13228,13228],"mapped",[103,112,97]],[[13229,13229],"mapped",[114,97,100]],[[13230,13230],"mapped",[114,97,100,8725,115]],[[13231,13231],"mapped",[114,97,100,8725,115,50]],[[13232,13232],"mapped",[112,115]],[[13233,13233],"mapped",[110,115]],[[13234,13234],"mapped",[956,115]],[[13235,13235],"mapped",[109,115]],[[13236,13236],"mapped",[112,118]],[[13237,13237],"mapped",[110,118]],[[13238,13238],"mapped",[956,118]],[[13239,13239],"mapped",[109,118]],[[13240,13240],"mapped",[107,118]],[[13241,13241],"mapped",[109,118]],[[13242,13242],"mapped",[112,119]],[[13243,13243],"mapped",[110,119]],[[13244,13244],"mapped",[956,119]],[[13245,13245],"mapped",[109,119]],[[13246,13246],"mapped",[107,119]],[[13247,13247],"mapped",[109,119]],[[13248,13248],"mapped",[107,969]],[[13249,13249],"mapped",[109,969]],[[13250,13250],"disallowed"],[[13251,13251],"mapped",[98,113]],[[13252,13252],"mapped",[99,99]],[[13253,13253],"mapped",[99,100]],[[13254,13254],"mapped",[99,8725,107,103]],[[13255,13255],"disallowed"],[[13256,13256],"mapped",[100,98]],[[13257,13257],"mapped",[103,121]],[[13258,13258],"mapped",[104,97]],[[13259,13259],"mapped",[104,112]],[[13260,13260],"mapped",[105,110]],[[13261,13261],"mapped",[107,107]],[[13262,13262],"mapped",[107,109]],[[13263,13263],"mapped",[107,116]],[[13264,13264],"mapped",[108,109]],[[13265,13265],"mapped",[108,110]],[[13266,13266],"mapped",[108,111,103]],[[13267,13267],"mapped",[108,120]],[[13268,13268],"mapped",[109,98]],[[13269,13269],"mapped",[109,105,108]],[[13270,13270],"mapped",[109,111,108]],[[13271,13271],"mapped",[112,104]],[[13272,13272],"disallowed"],[[13273,13273],"mapped",[112,112,109]],[[13274,13274],"mapped",[112,114]],[[13275,13275],"mapped",[115,114]],[[13276,13276],"mapped",[115,118]],[[13277,13277],"mapped",[119,98]],[[13278,13278],"mapped",[118,8725,109]],[[13279,13279],"mapped",[97,8725,109]],[[13280,13280],"mapped",[49,26085]],[[13281,13281],"mapped",[50,26085]],[[13282,13282],"mapped",[51,26085]],[[13283,13283],"mapped",[52,26085]],[[13284,13284],"mapped",[53,26085]],[[13285,13285],"mapped",[54,26085]],[[13286,13286],"mapped",[55,26085]],[[13287,13287],"mapped",[56,26085]],[[13288,13288],"mapped",[57,26085]],[[13289,13289],"mapped",[49,48,26085]],[[13290,13290],"mapped",[49,49,26085]],[[13291,13291],"mapped",[49,50,26085]],[[13292,13292],"mapped",[49,51,26085]],[[13293,13293],"mapped",[49,52,26085]],[[13294,13294],"mapped",[49,53,26085]],[[13295,13295],"mapped",[49,54,26085]],[[13296,13296],"mapped",[49,55,26085]],[[13297,13297],"mapped",[49,56,26085]],[[13298,13298],"mapped",[49,57,26085]],[[13299,13299],"mapped",[50,48,26085]],[[13300,13300],"mapped",[50,49,26085]],[[13301,13301],"mapped",[50,50,26085]],[[13302,13302],"mapped",[50,51,26085]],[[13303,13303],"mapped",[50,52,26085]],[[13304,13304],"mapped",[50,53,26085]],[[13305,13305],"mapped",[50,54,26085]],[[13306,13306],"mapped",[50,55,26085]],[[13307,13307],"mapped",[50,56,26085]],[[13308,13308],"mapped",[50,57,26085]],[[13309,13309],"mapped",[51,48,26085]],[[13310,13310],"mapped",[51,49,26085]],[[13311,13311],"mapped",[103,97,108]],[[13312,19893],"valid"],[[19894,19903],"disallowed"],[[19904,19967],"valid",[],"NV8"],[[19968,40869],"valid"],[[40870,40891],"valid"],[[40892,40899],"valid"],[[40900,40907],"valid"],[[40908,40908],"valid"],[[40909,40917],"valid"],[[40918,40959],"disallowed"],[[40960,42124],"valid"],[[42125,42127],"disallowed"],[[42128,42145],"valid",[],"NV8"],[[42146,42147],"valid",[],"NV8"],[[42148,42163],"valid",[],"NV8"],[[42164,42164],"valid",[],"NV8"],[[42165,42176],"valid",[],"NV8"],[[42177,42177],"valid",[],"NV8"],[[42178,42180],"valid",[],"NV8"],[[42181,42181],"valid",[],"NV8"],[[42182,42182],"valid",[],"NV8"],[[42183,42191],"disallowed"],[[42192,42237],"valid"],[[42238,42239],"valid",[],"NV8"],[[42240,42508],"valid"],[[42509,42511],"valid",[],"NV8"],[[42512,42539],"valid"],[[42540,42559],"disallowed"],[[42560,42560],"mapped",[42561]],[[42561,42561],"valid"],[[42562,42562],"mapped",[42563]],[[42563,42563],"valid"],[[42564,42564],"mapped",[42565]],[[42565,42565],"valid"],[[42566,42566],"mapped",[42567]],[[42567,42567],"valid"],[[42568,42568],"mapped",[42569]],[[42569,42569],"valid"],[[42570,42570],"mapped",[42571]],[[42571,42571],"valid"],[[42572,42572],"mapped",[42573]],[[42573,42573],"valid"],[[42574,42574],"mapped",[42575]],[[42575,42575],"valid"],[[42576,42576],"mapped",[42577]],[[42577,42577],"valid"],[[42578,42578],"mapped",[42579]],[[42579,42579],"valid"],[[42580,42580],"mapped",[42581]],[[42581,42581],"valid"],[[42582,42582],"mapped",[42583]],[[42583,42583],"valid"],[[42584,42584],"mapped",[42585]],[[42585,42585],"valid"],[[42586,42586],"mapped",[42587]],[[42587,42587],"valid"],[[42588,42588],"mapped",[42589]],[[42589,42589],"valid"],[[42590,42590],"mapped",[42591]],[[42591,42591],"valid"],[[42592,42592],"mapped",[42593]],[[42593,42593],"valid"],[[42594,42594],"mapped",[42595]],[[42595,42595],"valid"],[[42596,42596],"mapped",[42597]],[[42597,42597],"valid"],[[42598,42598],"mapped",[42599]],[[42599,42599],"valid"],[[42600,42600],"mapped",[42601]],[[42601,42601],"valid"],[[42602,42602],"mapped",[42603]],[[42603,42603],"valid"],[[42604,42604],"mapped",[42605]],[[42605,42607],"valid"],[[42608,42611],"valid",[],"NV8"],[[42612,42619],"valid"],[[42620,42621],"valid"],[[42622,42622],"valid",[],"NV8"],[[42623,42623],"valid"],[[42624,42624],"mapped",[42625]],[[42625,42625],"valid"],[[42626,42626],"mapped",[42627]],[[42627,42627],"valid"],[[42628,42628],"mapped",[42629]],[[42629,42629],"valid"],[[42630,42630],"mapped",[42631]],[[42631,42631],"valid"],[[42632,42632],"mapped",[42633]],[[42633,42633],"valid"],[[42634,42634],"mapped",[42635]],[[42635,42635],"valid"],[[42636,42636],"mapped",[42637]],[[42637,42637],"valid"],[[42638,42638],"mapped",[42639]],[[42639,42639],"valid"],[[42640,42640],"mapped",[42641]],[[42641,42641],"valid"],[[42642,42642],"mapped",[42643]],[[42643,42643],"valid"],[[42644,42644],"mapped",[42645]],[[42645,42645],"valid"],[[42646,42646],"mapped",[42647]],[[42647,42647],"valid"],[[42648,42648],"mapped",[42649]],[[42649,42649],"valid"],[[42650,42650],"mapped",[42651]],[[42651,42651],"valid"],[[42652,42652],"mapped",[1098]],[[42653,42653],"mapped",[1100]],[[42654,42654],"valid"],[[42655,42655],"valid"],[[42656,42725],"valid"],[[42726,42735],"valid",[],"NV8"],[[42736,42737],"valid"],[[42738,42743],"valid",[],"NV8"],[[42744,42751],"disallowed"],[[42752,42774],"valid",[],"NV8"],[[42775,42778],"valid"],[[42779,42783],"valid"],[[42784,42785],"valid",[],"NV8"],[[42786,42786],"mapped",[42787]],[[42787,42787],"valid"],[[42788,42788],"mapped",[42789]],[[42789,42789],"valid"],[[42790,42790],"mapped",[42791]],[[42791,42791],"valid"],[[42792,42792],"mapped",[42793]],[[42793,42793],"valid"],[[42794,42794],"mapped",[42795]],[[42795,42795],"valid"],[[42796,42796],"mapped",[42797]],[[42797,42797],"valid"],[[42798,42798],"mapped",[42799]],[[42799,42801],"valid"],[[42802,42802],"mapped",[42803]],[[42803,42803],"valid"],[[42804,42804],"mapped",[42805]],[[42805,42805],"valid"],[[42806,42806],"mapped",[42807]],[[42807,42807],"valid"],[[42808,42808],"mapped",[42809]],[[42809,42809],"valid"],[[42810,42810],"mapped",[42811]],[[42811,42811],"valid"],[[42812,42812],"mapped",[42813]],[[42813,42813],"valid"],[[42814,42814],"mapped",[42815]],[[42815,42815],"valid"],[[42816,42816],"mapped",[42817]],[[42817,42817],"valid"],[[42818,42818],"mapped",[42819]],[[42819,42819],"valid"],[[42820,42820],"mapped",[42821]],[[42821,42821],"valid"],[[42822,42822],"mapped",[42823]],[[42823,42823],"valid"],[[42824,42824],"mapped",[42825]],[[42825,42825],"valid"],[[42826,42826],"mapped",[42827]],[[42827,42827],"valid"],[[42828,42828],"mapped",[42829]],[[42829,42829],"valid"],[[42830,42830],"mapped",[42831]],[[42831,42831],"valid"],[[42832,42832],"mapped",[42833]],[[42833,42833],"valid"],[[42834,42834],"mapped",[42835]],[[42835,42835],"valid"],[[42836,42836],"mapped",[42837]],[[42837,42837],"valid"],[[42838,42838],"mapped",[42839]],[[42839,42839],"valid"],[[42840,42840],"mapped",[42841]],[[42841,42841],"valid"],[[42842,42842],"mapped",[42843]],[[42843,42843],"valid"],[[42844,42844],"mapped",[42845]],[[42845,42845],"valid"],[[42846,42846],"mapped",[42847]],[[42847,42847],"valid"],[[42848,42848],"mapped",[42849]],[[42849,42849],"valid"],[[42850,42850],"mapped",[42851]],[[42851,42851],"valid"],[[42852,42852],"mapped",[42853]],[[42853,42853],"valid"],[[42854,42854],"mapped",[42855]],[[42855,42855],"valid"],[[42856,42856],"mapped",[42857]],[[42857,42857],"valid"],[[42858,42858],"mapped",[42859]],[[42859,42859],"valid"],[[42860,42860],"mapped",[42861]],[[42861,42861],"valid"],[[42862,42862],"mapped",[42863]],[[42863,42863],"valid"],[[42864,42864],"mapped",[42863]],[[42865,42872],"valid"],[[42873,42873],"mapped",[42874]],[[42874,42874],"valid"],[[42875,42875],"mapped",[42876]],[[42876,42876],"valid"],[[42877,42877],"mapped",[7545]],[[42878,42878],"mapped",[42879]],[[42879,42879],"valid"],[[42880,42880],"mapped",[42881]],[[42881,42881],"valid"],[[42882,42882],"mapped",[42883]],[[42883,42883],"valid"],[[42884,42884],"mapped",[42885]],[[42885,42885],"valid"],[[42886,42886],"mapped",[42887]],[[42887,42888],"valid"],[[42889,42890],"valid",[],"NV8"],[[42891,42891],"mapped",[42892]],[[42892,42892],"valid"],[[42893,42893],"mapped",[613]],[[42894,42894],"valid"],[[42895,42895],"valid"],[[42896,42896],"mapped",[42897]],[[42897,42897],"valid"],[[42898,42898],"mapped",[42899]],[[42899,42899],"valid"],[[42900,42901],"valid"],[[42902,42902],"mapped",[42903]],[[42903,42903],"valid"],[[42904,42904],"mapped",[42905]],[[42905,42905],"valid"],[[42906,42906],"mapped",[42907]],[[42907,42907],"valid"],[[42908,42908],"mapped",[42909]],[[42909,42909],"valid"],[[42910,42910],"mapped",[42911]],[[42911,42911],"valid"],[[42912,42912],"mapped",[42913]],[[42913,42913],"valid"],[[42914,42914],"mapped",[42915]],[[42915,42915],"valid"],[[42916,42916],"mapped",[42917]],[[42917,42917],"valid"],[[42918,42918],"mapped",[42919]],[[42919,42919],"valid"],[[42920,42920],"mapped",[42921]],[[42921,42921],"valid"],[[42922,42922],"mapped",[614]],[[42923,42923],"mapped",[604]],[[42924,42924],"mapped",[609]],[[42925,42925],"mapped",[620]],[[42926,42927],"disallowed"],[[42928,42928],"mapped",[670]],[[42929,42929],"mapped",[647]],[[42930,42930],"mapped",[669]],[[42931,42931],"mapped",[43859]],[[42932,42932],"mapped",[42933]],[[42933,42933],"valid"],[[42934,42934],"mapped",[42935]],[[42935,42935],"valid"],[[42936,42998],"disallowed"],[[42999,42999],"valid"],[[43e3,43e3],"mapped",[295]],[[43001,43001],"mapped",[339]],[[43002,43002],"valid"],[[43003,43007],"valid"],[[43008,43047],"valid"],[[43048,43051],"valid",[],"NV8"],[[43052,43055],"disallowed"],[[43056,43065],"valid",[],"NV8"],[[43066,43071],"disallowed"],[[43072,43123],"valid"],[[43124,43127],"valid",[],"NV8"],[[43128,43135],"disallowed"],[[43136,43204],"valid"],[[43205,43213],"disallowed"],[[43214,43215],"valid",[],"NV8"],[[43216,43225],"valid"],[[43226,43231],"disallowed"],[[43232,43255],"valid"],[[43256,43258],"valid",[],"NV8"],[[43259,43259],"valid"],[[43260,43260],"valid",[],"NV8"],[[43261,43261],"valid"],[[43262,43263],"disallowed"],[[43264,43309],"valid"],[[43310,43311],"valid",[],"NV8"],[[43312,43347],"valid"],[[43348,43358],"disallowed"],[[43359,43359],"valid",[],"NV8"],[[43360,43388],"valid",[],"NV8"],[[43389,43391],"disallowed"],[[43392,43456],"valid"],[[43457,43469],"valid",[],"NV8"],[[43470,43470],"disallowed"],[[43471,43481],"valid"],[[43482,43485],"disallowed"],[[43486,43487],"valid",[],"NV8"],[[43488,43518],"valid"],[[43519,43519],"disallowed"],[[43520,43574],"valid"],[[43575,43583],"disallowed"],[[43584,43597],"valid"],[[43598,43599],"disallowed"],[[43600,43609],"valid"],[[43610,43611],"disallowed"],[[43612,43615],"valid",[],"NV8"],[[43616,43638],"valid"],[[43639,43641],"valid",[],"NV8"],[[43642,43643],"valid"],[[43644,43647],"valid"],[[43648,43714],"valid"],[[43715,43738],"disallowed"],[[43739,43741],"valid"],[[43742,43743],"valid",[],"NV8"],[[43744,43759],"valid"],[[43760,43761],"valid",[],"NV8"],[[43762,43766],"valid"],[[43767,43776],"disallowed"],[[43777,43782],"valid"],[[43783,43784],"disallowed"],[[43785,43790],"valid"],[[43791,43792],"disallowed"],[[43793,43798],"valid"],[[43799,43807],"disallowed"],[[43808,43814],"valid"],[[43815,43815],"disallowed"],[[43816,43822],"valid"],[[43823,43823],"disallowed"],[[43824,43866],"valid"],[[43867,43867],"valid",[],"NV8"],[[43868,43868],"mapped",[42791]],[[43869,43869],"mapped",[43831]],[[43870,43870],"mapped",[619]],[[43871,43871],"mapped",[43858]],[[43872,43875],"valid"],[[43876,43877],"valid"],[[43878,43887],"disallowed"],[[43888,43888],"mapped",[5024]],[[43889,43889],"mapped",[5025]],[[43890,43890],"mapped",[5026]],[[43891,43891],"mapped",[5027]],[[43892,43892],"mapped",[5028]],[[43893,43893],"mapped",[5029]],[[43894,43894],"mapped",[5030]],[[43895,43895],"mapped",[5031]],[[43896,43896],"mapped",[5032]],[[43897,43897],"mapped",[5033]],[[43898,43898],"mapped",[5034]],[[43899,43899],"mapped",[5035]],[[43900,43900],"mapped",[5036]],[[43901,43901],"mapped",[5037]],[[43902,43902],"mapped",[5038]],[[43903,43903],"mapped",[5039]],[[43904,43904],"mapped",[5040]],[[43905,43905],"mapped",[5041]],[[43906,43906],"mapped",[5042]],[[43907,43907],"mapped",[5043]],[[43908,43908],"mapped",[5044]],[[43909,43909],"mapped",[5045]],[[43910,43910],"mapped",[5046]],[[43911,43911],"mapped",[5047]],[[43912,43912],"mapped",[5048]],[[43913,43913],"mapped",[5049]],[[43914,43914],"mapped",[5050]],[[43915,43915],"mapped",[5051]],[[43916,43916],"mapped",[5052]],[[43917,43917],"mapped",[5053]],[[43918,43918],"mapped",[5054]],[[43919,43919],"mapped",[5055]],[[43920,43920],"mapped",[5056]],[[43921,43921],"mapped",[5057]],[[43922,43922],"mapped",[5058]],[[43923,43923],"mapped",[5059]],[[43924,43924],"mapped",[5060]],[[43925,43925],"mapped",[5061]],[[43926,43926],"mapped",[5062]],[[43927,43927],"mapped",[5063]],[[43928,43928],"mapped",[5064]],[[43929,43929],"mapped",[5065]],[[43930,43930],"mapped",[5066]],[[43931,43931],"mapped",[5067]],[[43932,43932],"mapped",[5068]],[[43933,43933],"mapped",[5069]],[[43934,43934],"mapped",[5070]],[[43935,43935],"mapped",[5071]],[[43936,43936],"mapped",[5072]],[[43937,43937],"mapped",[5073]],[[43938,43938],"mapped",[5074]],[[43939,43939],"mapped",[5075]],[[43940,43940],"mapped",[5076]],[[43941,43941],"mapped",[5077]],[[43942,43942],"mapped",[5078]],[[43943,43943],"mapped",[5079]],[[43944,43944],"mapped",[5080]],[[43945,43945],"mapped",[5081]],[[43946,43946],"mapped",[5082]],[[43947,43947],"mapped",[5083]],[[43948,43948],"mapped",[5084]],[[43949,43949],"mapped",[5085]],[[43950,43950],"mapped",[5086]],[[43951,43951],"mapped",[5087]],[[43952,43952],"mapped",[5088]],[[43953,43953],"mapped",[5089]],[[43954,43954],"mapped",[5090]],[[43955,43955],"mapped",[5091]],[[43956,43956],"mapped",[5092]],[[43957,43957],"mapped",[5093]],[[43958,43958],"mapped",[5094]],[[43959,43959],"mapped",[5095]],[[43960,43960],"mapped",[5096]],[[43961,43961],"mapped",[5097]],[[43962,43962],"mapped",[5098]],[[43963,43963],"mapped",[5099]],[[43964,43964],"mapped",[5100]],[[43965,43965],"mapped",[5101]],[[43966,43966],"mapped",[5102]],[[43967,43967],"mapped",[5103]],[[43968,44010],"valid"],[[44011,44011],"valid",[],"NV8"],[[44012,44013],"valid"],[[44014,44015],"disallowed"],[[44016,44025],"valid"],[[44026,44031],"disallowed"],[[44032,55203],"valid"],[[55204,55215],"disallowed"],[[55216,55238],"valid",[],"NV8"],[[55239,55242],"disallowed"],[[55243,55291],"valid",[],"NV8"],[[55292,55295],"disallowed"],[[55296,57343],"disallowed"],[[57344,63743],"disallowed"],[[63744,63744],"mapped",[35912]],[[63745,63745],"mapped",[26356]],[[63746,63746],"mapped",[36554]],[[63747,63747],"mapped",[36040]],[[63748,63748],"mapped",[28369]],[[63749,63749],"mapped",[20018]],[[63750,63750],"mapped",[21477]],[[63751,63752],"mapped",[40860]],[[63753,63753],"mapped",[22865]],[[63754,63754],"mapped",[37329]],[[63755,63755],"mapped",[21895]],[[63756,63756],"mapped",[22856]],[[63757,63757],"mapped",[25078]],[[63758,63758],"mapped",[30313]],[[63759,63759],"mapped",[32645]],[[63760,63760],"mapped",[34367]],[[63761,63761],"mapped",[34746]],[[63762,63762],"mapped",[35064]],[[63763,63763],"mapped",[37007]],[[63764,63764],"mapped",[27138]],[[63765,63765],"mapped",[27931]],[[63766,63766],"mapped",[28889]],[[63767,63767],"mapped",[29662]],[[63768,63768],"mapped",[33853]],[[63769,63769],"mapped",[37226]],[[63770,63770],"mapped",[39409]],[[63771,63771],"mapped",[20098]],[[63772,63772],"mapped",[21365]],[[63773,63773],"mapped",[27396]],[[63774,63774],"mapped",[29211]],[[63775,63775],"mapped",[34349]],[[63776,63776],"mapped",[40478]],[[63777,63777],"mapped",[23888]],[[63778,63778],"mapped",[28651]],[[63779,63779],"mapped",[34253]],[[63780,63780],"mapped",[35172]],[[63781,63781],"mapped",[25289]],[[63782,63782],"mapped",[33240]],[[63783,63783],"mapped",[34847]],[[63784,63784],"mapped",[24266]],[[63785,63785],"mapped",[26391]],[[63786,63786],"mapped",[28010]],[[63787,63787],"mapped",[29436]],[[63788,63788],"mapped",[37070]],[[63789,63789],"mapped",[20358]],[[63790,63790],"mapped",[20919]],[[63791,63791],"mapped",[21214]],[[63792,63792],"mapped",[25796]],[[63793,63793],"mapped",[27347]],[[63794,63794],"mapped",[29200]],[[63795,63795],"mapped",[30439]],[[63796,63796],"mapped",[32769]],[[63797,63797],"mapped",[34310]],[[63798,63798],"mapped",[34396]],[[63799,63799],"mapped",[36335]],[[63800,63800],"mapped",[38706]],[[63801,63801],"mapped",[39791]],[[63802,63802],"mapped",[40442]],[[63803,63803],"mapped",[30860]],[[63804,63804],"mapped",[31103]],[[63805,63805],"mapped",[32160]],[[63806,63806],"mapped",[33737]],[[63807,63807],"mapped",[37636]],[[63808,63808],"mapped",[40575]],[[63809,63809],"mapped",[35542]],[[63810,63810],"mapped",[22751]],[[63811,63811],"mapped",[24324]],[[63812,63812],"mapped",[31840]],[[63813,63813],"mapped",[32894]],[[63814,63814],"mapped",[29282]],[[63815,63815],"mapped",[30922]],[[63816,63816],"mapped",[36034]],[[63817,63817],"mapped",[38647]],[[63818,63818],"mapped",[22744]],[[63819,63819],"mapped",[23650]],[[63820,63820],"mapped",[27155]],[[63821,63821],"mapped",[28122]],[[63822,63822],"mapped",[28431]],[[63823,63823],"mapped",[32047]],[[63824,63824],"mapped",[32311]],[[63825,63825],"mapped",[38475]],[[63826,63826],"mapped",[21202]],[[63827,63827],"mapped",[32907]],[[63828,63828],"mapped",[20956]],[[63829,63829],"mapped",[20940]],[[63830,63830],"mapped",[31260]],[[63831,63831],"mapped",[32190]],[[63832,63832],"mapped",[33777]],[[63833,63833],"mapped",[38517]],[[63834,63834],"mapped",[35712]],[[63835,63835],"mapped",[25295]],[[63836,63836],"mapped",[27138]],[[63837,63837],"mapped",[35582]],[[63838,63838],"mapped",[20025]],[[63839,63839],"mapped",[23527]],[[63840,63840],"mapped",[24594]],[[63841,63841],"mapped",[29575]],[[63842,63842],"mapped",[30064]],[[63843,63843],"mapped",[21271]],[[63844,63844],"mapped",[30971]],[[63845,63845],"mapped",[20415]],[[63846,63846],"mapped",[24489]],[[63847,63847],"mapped",[19981]],[[63848,63848],"mapped",[27852]],[[63849,63849],"mapped",[25976]],[[63850,63850],"mapped",[32034]],[[63851,63851],"mapped",[21443]],[[63852,63852],"mapped",[22622]],[[63853,63853],"mapped",[30465]],[[63854,63854],"mapped",[33865]],[[63855,63855],"mapped",[35498]],[[63856,63856],"mapped",[27578]],[[63857,63857],"mapped",[36784]],[[63858,63858],"mapped",[27784]],[[63859,63859],"mapped",[25342]],[[63860,63860],"mapped",[33509]],[[63861,63861],"mapped",[25504]],[[63862,63862],"mapped",[30053]],[[63863,63863],"mapped",[20142]],[[63864,63864],"mapped",[20841]],[[63865,63865],"mapped",[20937]],[[63866,63866],"mapped",[26753]],[[63867,63867],"mapped",[31975]],[[63868,63868],"mapped",[33391]],[[63869,63869],"mapped",[35538]],[[63870,63870],"mapped",[37327]],[[63871,63871],"mapped",[21237]],[[63872,63872],"mapped",[21570]],[[63873,63873],"mapped",[22899]],[[63874,63874],"mapped",[24300]],[[63875,63875],"mapped",[26053]],[[63876,63876],"mapped",[28670]],[[63877,63877],"mapped",[31018]],[[63878,63878],"mapped",[38317]],[[63879,63879],"mapped",[39530]],[[63880,63880],"mapped",[40599]],[[63881,63881],"mapped",[40654]],[[63882,63882],"mapped",[21147]],[[63883,63883],"mapped",[26310]],[[63884,63884],"mapped",[27511]],[[63885,63885],"mapped",[36706]],[[63886,63886],"mapped",[24180]],[[63887,63887],"mapped",[24976]],[[63888,63888],"mapped",[25088]],[[63889,63889],"mapped",[25754]],[[63890,63890],"mapped",[28451]],[[63891,63891],"mapped",[29001]],[[63892,63892],"mapped",[29833]],[[63893,63893],"mapped",[31178]],[[63894,63894],"mapped",[32244]],[[63895,63895],"mapped",[32879]],[[63896,63896],"mapped",[36646]],[[63897,63897],"mapped",[34030]],[[63898,63898],"mapped",[36899]],[[63899,63899],"mapped",[37706]],[[63900,63900],"mapped",[21015]],[[63901,63901],"mapped",[21155]],[[63902,63902],"mapped",[21693]],[[63903,63903],"mapped",[28872]],[[63904,63904],"mapped",[35010]],[[63905,63905],"mapped",[35498]],[[63906,63906],"mapped",[24265]],[[63907,63907],"mapped",[24565]],[[63908,63908],"mapped",[25467]],[[63909,63909],"mapped",[27566]],[[63910,63910],"mapped",[31806]],[[63911,63911],"mapped",[29557]],[[63912,63912],"mapped",[20196]],[[63913,63913],"mapped",[22265]],[[63914,63914],"mapped",[23527]],[[63915,63915],"mapped",[23994]],[[63916,63916],"mapped",[24604]],[[63917,63917],"mapped",[29618]],[[63918,63918],"mapped",[29801]],[[63919,63919],"mapped",[32666]],[[63920,63920],"mapped",[32838]],[[63921,63921],"mapped",[37428]],[[63922,63922],"mapped",[38646]],[[63923,63923],"mapped",[38728]],[[63924,63924],"mapped",[38936]],[[63925,63925],"mapped",[20363]],[[63926,63926],"mapped",[31150]],[[63927,63927],"mapped",[37300]],[[63928,63928],"mapped",[38584]],[[63929,63929],"mapped",[24801]],[[63930,63930],"mapped",[20102]],[[63931,63931],"mapped",[20698]],[[63932,63932],"mapped",[23534]],[[63933,63933],"mapped",[23615]],[[63934,63934],"mapped",[26009]],[[63935,63935],"mapped",[27138]],[[63936,63936],"mapped",[29134]],[[63937,63937],"mapped",[30274]],[[63938,63938],"mapped",[34044]],[[63939,63939],"mapped",[36988]],[[63940,63940],"mapped",[40845]],[[63941,63941],"mapped",[26248]],[[63942,63942],"mapped",[38446]],[[63943,63943],"mapped",[21129]],[[63944,63944],"mapped",[26491]],[[63945,63945],"mapped",[26611]],[[63946,63946],"mapped",[27969]],[[63947,63947],"mapped",[28316]],[[63948,63948],"mapped",[29705]],[[63949,63949],"mapped",[30041]],[[63950,63950],"mapped",[30827]],[[63951,63951],"mapped",[32016]],[[63952,63952],"mapped",[39006]],[[63953,63953],"mapped",[20845]],[[63954,63954],"mapped",[25134]],[[63955,63955],"mapped",[38520]],[[63956,63956],"mapped",[20523]],[[63957,63957],"mapped",[23833]],[[63958,63958],"mapped",[28138]],[[63959,63959],"mapped",[36650]],[[63960,63960],"mapped",[24459]],[[63961,63961],"mapped",[24900]],[[63962,63962],"mapped",[26647]],[[63963,63963],"mapped",[29575]],[[63964,63964],"mapped",[38534]],[[63965,63965],"mapped",[21033]],[[63966,63966],"mapped",[21519]],[[63967,63967],"mapped",[23653]],[[63968,63968],"mapped",[26131]],[[63969,63969],"mapped",[26446]],[[63970,63970],"mapped",[26792]],[[63971,63971],"mapped",[27877]],[[63972,63972],"mapped",[29702]],[[63973,63973],"mapped",[30178]],[[63974,63974],"mapped",[32633]],[[63975,63975],"mapped",[35023]],[[63976,63976],"mapped",[35041]],[[63977,63977],"mapped",[37324]],[[63978,63978],"mapped",[38626]],[[63979,63979],"mapped",[21311]],[[63980,63980],"mapped",[28346]],[[63981,63981],"mapped",[21533]],[[63982,63982],"mapped",[29136]],[[63983,63983],"mapped",[29848]],[[63984,63984],"mapped",[34298]],[[63985,63985],"mapped",[38563]],[[63986,63986],"mapped",[40023]],[[63987,63987],"mapped",[40607]],[[63988,63988],"mapped",[26519]],[[63989,63989],"mapped",[28107]],[[63990,63990],"mapped",[33256]],[[63991,63991],"mapped",[31435]],[[63992,63992],"mapped",[31520]],[[63993,63993],"mapped",[31890]],[[63994,63994],"mapped",[29376]],[[63995,63995],"mapped",[28825]],[[63996,63996],"mapped",[35672]],[[63997,63997],"mapped",[20160]],[[63998,63998],"mapped",[33590]],[[63999,63999],"mapped",[21050]],[[64e3,64e3],"mapped",[20999]],[[64001,64001],"mapped",[24230]],[[64002,64002],"mapped",[25299]],[[64003,64003],"mapped",[31958]],[[64004,64004],"mapped",[23429]],[[64005,64005],"mapped",[27934]],[[64006,64006],"mapped",[26292]],[[64007,64007],"mapped",[36667]],[[64008,64008],"mapped",[34892]],[[64009,64009],"mapped",[38477]],[[64010,64010],"mapped",[35211]],[[64011,64011],"mapped",[24275]],[[64012,64012],"mapped",[20800]],[[64013,64013],"mapped",[21952]],[[64014,64015],"valid"],[[64016,64016],"mapped",[22618]],[[64017,64017],"valid"],[[64018,64018],"mapped",[26228]],[[64019,64020],"valid"],[[64021,64021],"mapped",[20958]],[[64022,64022],"mapped",[29482]],[[64023,64023],"mapped",[30410]],[[64024,64024],"mapped",[31036]],[[64025,64025],"mapped",[31070]],[[64026,64026],"mapped",[31077]],[[64027,64027],"mapped",[31119]],[[64028,64028],"mapped",[38742]],[[64029,64029],"mapped",[31934]],[[64030,64030],"mapped",[32701]],[[64031,64031],"valid"],[[64032,64032],"mapped",[34322]],[[64033,64033],"valid"],[[64034,64034],"mapped",[35576]],[[64035,64036],"valid"],[[64037,64037],"mapped",[36920]],[[64038,64038],"mapped",[37117]],[[64039,64041],"valid"],[[64042,64042],"mapped",[39151]],[[64043,64043],"mapped",[39164]],[[64044,64044],"mapped",[39208]],[[64045,64045],"mapped",[40372]],[[64046,64046],"mapped",[37086]],[[64047,64047],"mapped",[38583]],[[64048,64048],"mapped",[20398]],[[64049,64049],"mapped",[20711]],[[64050,64050],"mapped",[20813]],[[64051,64051],"mapped",[21193]],[[64052,64052],"mapped",[21220]],[[64053,64053],"mapped",[21329]],[[64054,64054],"mapped",[21917]],[[64055,64055],"mapped",[22022]],[[64056,64056],"mapped",[22120]],[[64057,64057],"mapped",[22592]],[[64058,64058],"mapped",[22696]],[[64059,64059],"mapped",[23652]],[[64060,64060],"mapped",[23662]],[[64061,64061],"mapped",[24724]],[[64062,64062],"mapped",[24936]],[[64063,64063],"mapped",[24974]],[[64064,64064],"mapped",[25074]],[[64065,64065],"mapped",[25935]],[[64066,64066],"mapped",[26082]],[[64067,64067],"mapped",[26257]],[[64068,64068],"mapped",[26757]],[[64069,64069],"mapped",[28023]],[[64070,64070],"mapped",[28186]],[[64071,64071],"mapped",[28450]],[[64072,64072],"mapped",[29038]],[[64073,64073],"mapped",[29227]],[[64074,64074],"mapped",[29730]],[[64075,64075],"mapped",[30865]],[[64076,64076],"mapped",[31038]],[[64077,64077],"mapped",[31049]],[[64078,64078],"mapped",[31048]],[[64079,64079],"mapped",[31056]],[[64080,64080],"mapped",[31062]],[[64081,64081],"mapped",[31069]],[[64082,64082],"mapped",[31117]],[[64083,64083],"mapped",[31118]],[[64084,64084],"mapped",[31296]],[[64085,64085],"mapped",[31361]],[[64086,64086],"mapped",[31680]],[[64087,64087],"mapped",[32244]],[[64088,64088],"mapped",[32265]],[[64089,64089],"mapped",[32321]],[[64090,64090],"mapped",[32626]],[[64091,64091],"mapped",[32773]],[[64092,64092],"mapped",[33261]],[[64093,64094],"mapped",[33401]],[[64095,64095],"mapped",[33879]],[[64096,64096],"mapped",[35088]],[[64097,64097],"mapped",[35222]],[[64098,64098],"mapped",[35585]],[[64099,64099],"mapped",[35641]],[[64100,64100],"mapped",[36051]],[[64101,64101],"mapped",[36104]],[[64102,64102],"mapped",[36790]],[[64103,64103],"mapped",[36920]],[[64104,64104],"mapped",[38627]],[[64105,64105],"mapped",[38911]],[[64106,64106],"mapped",[38971]],[[64107,64107],"mapped",[24693]],[[64108,64108],"mapped",[148206]],[[64109,64109],"mapped",[33304]],[[64110,64111],"disallowed"],[[64112,64112],"mapped",[20006]],[[64113,64113],"mapped",[20917]],[[64114,64114],"mapped",[20840]],[[64115,64115],"mapped",[20352]],[[64116,64116],"mapped",[20805]],[[64117,64117],"mapped",[20864]],[[64118,64118],"mapped",[21191]],[[64119,64119],"mapped",[21242]],[[64120,64120],"mapped",[21917]],[[64121,64121],"mapped",[21845]],[[64122,64122],"mapped",[21913]],[[64123,64123],"mapped",[21986]],[[64124,64124],"mapped",[22618]],[[64125,64125],"mapped",[22707]],[[64126,64126],"mapped",[22852]],[[64127,64127],"mapped",[22868]],[[64128,64128],"mapped",[23138]],[[64129,64129],"mapped",[23336]],[[64130,64130],"mapped",[24274]],[[64131,64131],"mapped",[24281]],[[64132,64132],"mapped",[24425]],[[64133,64133],"mapped",[24493]],[[64134,64134],"mapped",[24792]],[[64135,64135],"mapped",[24910]],[[64136,64136],"mapped",[24840]],[[64137,64137],"mapped",[24974]],[[64138,64138],"mapped",[24928]],[[64139,64139],"mapped",[25074]],[[64140,64140],"mapped",[25140]],[[64141,64141],"mapped",[25540]],[[64142,64142],"mapped",[25628]],[[64143,64143],"mapped",[25682]],[[64144,64144],"mapped",[25942]],[[64145,64145],"mapped",[26228]],[[64146,64146],"mapped",[26391]],[[64147,64147],"mapped",[26395]],[[64148,64148],"mapped",[26454]],[[64149,64149],"mapped",[27513]],[[64150,64150],"mapped",[27578]],[[64151,64151],"mapped",[27969]],[[64152,64152],"mapped",[28379]],[[64153,64153],"mapped",[28363]],[[64154,64154],"mapped",[28450]],[[64155,64155],"mapped",[28702]],[[64156,64156],"mapped",[29038]],[[64157,64157],"mapped",[30631]],[[64158,64158],"mapped",[29237]],[[64159,64159],"mapped",[29359]],[[64160,64160],"mapped",[29482]],[[64161,64161],"mapped",[29809]],[[64162,64162],"mapped",[29958]],[[64163,64163],"mapped",[30011]],[[64164,64164],"mapped",[30237]],[[64165,64165],"mapped",[30239]],[[64166,64166],"mapped",[30410]],[[64167,64167],"mapped",[30427]],[[64168,64168],"mapped",[30452]],[[64169,64169],"mapped",[30538]],[[64170,64170],"mapped",[30528]],[[64171,64171],"mapped",[30924]],[[64172,64172],"mapped",[31409]],[[64173,64173],"mapped",[31680]],[[64174,64174],"mapped",[31867]],[[64175,64175],"mapped",[32091]],[[64176,64176],"mapped",[32244]],[[64177,64177],"mapped",[32574]],[[64178,64178],"mapped",[32773]],[[64179,64179],"mapped",[33618]],[[64180,64180],"mapped",[33775]],[[64181,64181],"mapped",[34681]],[[64182,64182],"mapped",[35137]],[[64183,64183],"mapped",[35206]],[[64184,64184],"mapped",[35222]],[[64185,64185],"mapped",[35519]],[[64186,64186],"mapped",[35576]],[[64187,64187],"mapped",[35531]],[[64188,64188],"mapped",[35585]],[[64189,64189],"mapped",[35582]],[[64190,64190],"mapped",[35565]],[[64191,64191],"mapped",[35641]],[[64192,64192],"mapped",[35722]],[[64193,64193],"mapped",[36104]],[[64194,64194],"mapped",[36664]],[[64195,64195],"mapped",[36978]],[[64196,64196],"mapped",[37273]],[[64197,64197],"mapped",[37494]],[[64198,64198],"mapped",[38524]],[[64199,64199],"mapped",[38627]],[[64200,64200],"mapped",[38742]],[[64201,64201],"mapped",[38875]],[[64202,64202],"mapped",[38911]],[[64203,64203],"mapped",[38923]],[[64204,64204],"mapped",[38971]],[[64205,64205],"mapped",[39698]],[[64206,64206],"mapped",[40860]],[[64207,64207],"mapped",[141386]],[[64208,64208],"mapped",[141380]],[[64209,64209],"mapped",[144341]],[[64210,64210],"mapped",[15261]],[[64211,64211],"mapped",[16408]],[[64212,64212],"mapped",[16441]],[[64213,64213],"mapped",[152137]],[[64214,64214],"mapped",[154832]],[[64215,64215],"mapped",[163539]],[[64216,64216],"mapped",[40771]],[[64217,64217],"mapped",[40846]],[[64218,64255],"disallowed"],[[64256,64256],"mapped",[102,102]],[[64257,64257],"mapped",[102,105]],[[64258,64258],"mapped",[102,108]],[[64259,64259],"mapped",[102,102,105]],[[64260,64260],"mapped",[102,102,108]],[[64261,64262],"mapped",[115,116]],[[64263,64274],"disallowed"],[[64275,64275],"mapped",[1396,1398]],[[64276,64276],"mapped",[1396,1381]],[[64277,64277],"mapped",[1396,1387]],[[64278,64278],"mapped",[1406,1398]],[[64279,64279],"mapped",[1396,1389]],[[64280,64284],"disallowed"],[[64285,64285],"mapped",[1497,1460]],[[64286,64286],"valid"],[[64287,64287],"mapped",[1522,1463]],[[64288,64288],"mapped",[1506]],[[64289,64289],"mapped",[1488]],[[64290,64290],"mapped",[1491]],[[64291,64291],"mapped",[1492]],[[64292,64292],"mapped",[1499]],[[64293,64293],"mapped",[1500]],[[64294,64294],"mapped",[1501]],[[64295,64295],"mapped",[1512]],[[64296,64296],"mapped",[1514]],[[64297,64297],"disallowed_STD3_mapped",[43]],[[64298,64298],"mapped",[1513,1473]],[[64299,64299],"mapped",[1513,1474]],[[64300,64300],"mapped",[1513,1468,1473]],[[64301,64301],"mapped",[1513,1468,1474]],[[64302,64302],"mapped",[1488,1463]],[[64303,64303],"mapped",[1488,1464]],[[64304,64304],"mapped",[1488,1468]],[[64305,64305],"mapped",[1489,1468]],[[64306,64306],"mapped",[1490,1468]],[[64307,64307],"mapped",[1491,1468]],[[64308,64308],"mapped",[1492,1468]],[[64309,64309],"mapped",[1493,1468]],[[64310,64310],"mapped",[1494,1468]],[[64311,64311],"disallowed"],[[64312,64312],"mapped",[1496,1468]],[[64313,64313],"mapped",[1497,1468]],[[64314,64314],"mapped",[1498,1468]],[[64315,64315],"mapped",[1499,1468]],[[64316,64316],"mapped",[1500,1468]],[[64317,64317],"disallowed"],[[64318,64318],"mapped",[1502,1468]],[[64319,64319],"disallowed"],[[64320,64320],"mapped",[1504,1468]],[[64321,64321],"mapped",[1505,1468]],[[64322,64322],"disallowed"],[[64323,64323],"mapped",[1507,1468]],[[64324,64324],"mapped",[1508,1468]],[[64325,64325],"disallowed"],[[64326,64326],"mapped",[1510,1468]],[[64327,64327],"mapped",[1511,1468]],[[64328,64328],"mapped",[1512,1468]],[[64329,64329],"mapped",[1513,1468]],[[64330,64330],"mapped",[1514,1468]],[[64331,64331],"mapped",[1493,1465]],[[64332,64332],"mapped",[1489,1471]],[[64333,64333],"mapped",[1499,1471]],[[64334,64334],"mapped",[1508,1471]],[[64335,64335],"mapped",[1488,1500]],[[64336,64337],"mapped",[1649]],[[64338,64341],"mapped",[1659]],[[64342,64345],"mapped",[1662]],[[64346,64349],"mapped",[1664]],[[64350,64353],"mapped",[1658]],[[64354,64357],"mapped",[1663]],[[64358,64361],"mapped",[1657]],[[64362,64365],"mapped",[1700]],[[64366,64369],"mapped",[1702]],[[64370,64373],"mapped",[1668]],[[64374,64377],"mapped",[1667]],[[64378,64381],"mapped",[1670]],[[64382,64385],"mapped",[1671]],[[64386,64387],"mapped",[1677]],[[64388,64389],"mapped",[1676]],[[64390,64391],"mapped",[1678]],[[64392,64393],"mapped",[1672]],[[64394,64395],"mapped",[1688]],[[64396,64397],"mapped",[1681]],[[64398,64401],"mapped",[1705]],[[64402,64405],"mapped",[1711]],[[64406,64409],"mapped",[1715]],[[64410,64413],"mapped",[1713]],[[64414,64415],"mapped",[1722]],[[64416,64419],"mapped",[1723]],[[64420,64421],"mapped",[1728]],[[64422,64425],"mapped",[1729]],[[64426,64429],"mapped",[1726]],[[64430,64431],"mapped",[1746]],[[64432,64433],"mapped",[1747]],[[64434,64449],"valid",[],"NV8"],[[64450,64466],"disallowed"],[[64467,64470],"mapped",[1709]],[[64471,64472],"mapped",[1735]],[[64473,64474],"mapped",[1734]],[[64475,64476],"mapped",[1736]],[[64477,64477],"mapped",[1735,1652]],[[64478,64479],"mapped",[1739]],[[64480,64481],"mapped",[1733]],[[64482,64483],"mapped",[1737]],[[64484,64487],"mapped",[1744]],[[64488,64489],"mapped",[1609]],[[64490,64491],"mapped",[1574,1575]],[[64492,64493],"mapped",[1574,1749]],[[64494,64495],"mapped",[1574,1608]],[[64496,64497],"mapped",[1574,1735]],[[64498,64499],"mapped",[1574,1734]],[[64500,64501],"mapped",[1574,1736]],[[64502,64504],"mapped",[1574,1744]],[[64505,64507],"mapped",[1574,1609]],[[64508,64511],"mapped",[1740]],[[64512,64512],"mapped",[1574,1580]],[[64513,64513],"mapped",[1574,1581]],[[64514,64514],"mapped",[1574,1605]],[[64515,64515],"mapped",[1574,1609]],[[64516,64516],"mapped",[1574,1610]],[[64517,64517],"mapped",[1576,1580]],[[64518,64518],"mapped",[1576,1581]],[[64519,64519],"mapped",[1576,1582]],[[64520,64520],"mapped",[1576,1605]],[[64521,64521],"mapped",[1576,1609]],[[64522,64522],"mapped",[1576,1610]],[[64523,64523],"mapped",[1578,1580]],[[64524,64524],"mapped",[1578,1581]],[[64525,64525],"mapped",[1578,1582]],[[64526,64526],"mapped",[1578,1605]],[[64527,64527],"mapped",[1578,1609]],[[64528,64528],"mapped",[1578,1610]],[[64529,64529],"mapped",[1579,1580]],[[64530,64530],"mapped",[1579,1605]],[[64531,64531],"mapped",[1579,1609]],[[64532,64532],"mapped",[1579,1610]],[[64533,64533],"mapped",[1580,1581]],[[64534,64534],"mapped",[1580,1605]],[[64535,64535],"mapped",[1581,1580]],[[64536,64536],"mapped",[1581,1605]],[[64537,64537],"mapped",[1582,1580]],[[64538,64538],"mapped",[1582,1581]],[[64539,64539],"mapped",[1582,1605]],[[64540,64540],"mapped",[1587,1580]],[[64541,64541],"mapped",[1587,1581]],[[64542,64542],"mapped",[1587,1582]],[[64543,64543],"mapped",[1587,1605]],[[64544,64544],"mapped",[1589,1581]],[[64545,64545],"mapped",[1589,1605]],[[64546,64546],"mapped",[1590,1580]],[[64547,64547],"mapped",[1590,1581]],[[64548,64548],"mapped",[1590,1582]],[[64549,64549],"mapped",[1590,1605]],[[64550,64550],"mapped",[1591,1581]],[[64551,64551],"mapped",[1591,1605]],[[64552,64552],"mapped",[1592,1605]],[[64553,64553],"mapped",[1593,1580]],[[64554,64554],"mapped",[1593,1605]],[[64555,64555],"mapped",[1594,1580]],[[64556,64556],"mapped",[1594,1605]],[[64557,64557],"mapped",[1601,1580]],[[64558,64558],"mapped",[1601,1581]],[[64559,64559],"mapped",[1601,1582]],[[64560,64560],"mapped",[1601,1605]],[[64561,64561],"mapped",[1601,1609]],[[64562,64562],"mapped",[1601,1610]],[[64563,64563],"mapped",[1602,1581]],[[64564,64564],"mapped",[1602,1605]],[[64565,64565],"mapped",[1602,1609]],[[64566,64566],"mapped",[1602,1610]],[[64567,64567],"mapped",[1603,1575]],[[64568,64568],"mapped",[1603,1580]],[[64569,64569],"mapped",[1603,1581]],[[64570,64570],"mapped",[1603,1582]],[[64571,64571],"mapped",[1603,1604]],[[64572,64572],"mapped",[1603,1605]],[[64573,64573],"mapped",[1603,1609]],[[64574,64574],"mapped",[1603,1610]],[[64575,64575],"mapped",[1604,1580]],[[64576,64576],"mapped",[1604,1581]],[[64577,64577],"mapped",[1604,1582]],[[64578,64578],"mapped",[1604,1605]],[[64579,64579],"mapped",[1604,1609]],[[64580,64580],"mapped",[1604,1610]],[[64581,64581],"mapped",[1605,1580]],[[64582,64582],"mapped",[1605,1581]],[[64583,64583],"mapped",[1605,1582]],[[64584,64584],"mapped",[1605,1605]],[[64585,64585],"mapped",[1605,1609]],[[64586,64586],"mapped",[1605,1610]],[[64587,64587],"mapped",[1606,1580]],[[64588,64588],"mapped",[1606,1581]],[[64589,64589],"mapped",[1606,1582]],[[64590,64590],"mapped",[1606,1605]],[[64591,64591],"mapped",[1606,1609]],[[64592,64592],"mapped",[1606,1610]],[[64593,64593],"mapped",[1607,1580]],[[64594,64594],"mapped",[1607,1605]],[[64595,64595],"mapped",[1607,1609]],[[64596,64596],"mapped",[1607,1610]],[[64597,64597],"mapped",[1610,1580]],[[64598,64598],"mapped",[1610,1581]],[[64599,64599],"mapped",[1610,1582]],[[64600,64600],"mapped",[1610,1605]],[[64601,64601],"mapped",[1610,1609]],[[64602,64602],"mapped",[1610,1610]],[[64603,64603],"mapped",[1584,1648]],[[64604,64604],"mapped",[1585,1648]],[[64605,64605],"mapped",[1609,1648]],[[64606,64606],"disallowed_STD3_mapped",[32,1612,1617]],[[64607,64607],"disallowed_STD3_mapped",[32,1613,1617]],[[64608,64608],"disallowed_STD3_mapped",[32,1614,1617]],[[64609,64609],"disallowed_STD3_mapped",[32,1615,1617]],[[64610,64610],"disallowed_STD3_mapped",[32,1616,1617]],[[64611,64611],"disallowed_STD3_mapped",[32,1617,1648]],[[64612,64612],"mapped",[1574,1585]],[[64613,64613],"mapped",[1574,1586]],[[64614,64614],"mapped",[1574,1605]],[[64615,64615],"mapped",[1574,1606]],[[64616,64616],"mapped",[1574,1609]],[[64617,64617],"mapped",[1574,1610]],[[64618,64618],"mapped",[1576,1585]],[[64619,64619],"mapped",[1576,1586]],[[64620,64620],"mapped",[1576,1605]],[[64621,64621],"mapped",[1576,1606]],[[64622,64622],"mapped",[1576,1609]],[[64623,64623],"mapped",[1576,1610]],[[64624,64624],"mapped",[1578,1585]],[[64625,64625],"mapped",[1578,1586]],[[64626,64626],"mapped",[1578,1605]],[[64627,64627],"mapped",[1578,1606]],[[64628,64628],"mapped",[1578,1609]],[[64629,64629],"mapped",[1578,1610]],[[64630,64630],"mapped",[1579,1585]],[[64631,64631],"mapped",[1579,1586]],[[64632,64632],"mapped",[1579,1605]],[[64633,64633],"mapped",[1579,1606]],[[64634,64634],"mapped",[1579,1609]],[[64635,64635],"mapped",[1579,1610]],[[64636,64636],"mapped",[1601,1609]],[[64637,64637],"mapped",[1601,1610]],[[64638,64638],"mapped",[1602,1609]],[[64639,64639],"mapped",[1602,1610]],[[64640,64640],"mapped",[1603,1575]],[[64641,64641],"mapped",[1603,1604]],[[64642,64642],"mapped",[1603,1605]],[[64643,64643],"mapped",[1603,1609]],[[64644,64644],"mapped",[1603,1610]],[[64645,64645],"mapped",[1604,1605]],[[64646,64646],"mapped",[1604,1609]],[[64647,64647],"mapped",[1604,1610]],[[64648,64648],"mapped",[1605,1575]],[[64649,64649],"mapped",[1605,1605]],[[64650,64650],"mapped",[1606,1585]],[[64651,64651],"mapped",[1606,1586]],[[64652,64652],"mapped",[1606,1605]],[[64653,64653],"mapped",[1606,1606]],[[64654,64654],"mapped",[1606,1609]],[[64655,64655],"mapped",[1606,1610]],[[64656,64656],"mapped",[1609,1648]],[[64657,64657],"mapped",[1610,1585]],[[64658,64658],"mapped",[1610,1586]],[[64659,64659],"mapped",[1610,1605]],[[64660,64660],"mapped",[1610,1606]],[[64661,64661],"mapped",[1610,1609]],[[64662,64662],"mapped",[1610,1610]],[[64663,64663],"mapped",[1574,1580]],[[64664,64664],"mapped",[1574,1581]],[[64665,64665],"mapped",[1574,1582]],[[64666,64666],"mapped",[1574,1605]],[[64667,64667],"mapped",[1574,1607]],[[64668,64668],"mapped",[1576,1580]],[[64669,64669],"mapped",[1576,1581]],[[64670,64670],"mapped",[1576,1582]],[[64671,64671],"mapped",[1576,1605]],[[64672,64672],"mapped",[1576,1607]],[[64673,64673],"mapped",[1578,1580]],[[64674,64674],"mapped",[1578,1581]],[[64675,64675],"mapped",[1578,1582]],[[64676,64676],"mapped",[1578,1605]],[[64677,64677],"mapped",[1578,1607]],[[64678,64678],"mapped",[1579,1605]],[[64679,64679],"mapped",[1580,1581]],[[64680,64680],"mapped",[1580,1605]],[[64681,64681],"mapped",[1581,1580]],[[64682,64682],"mapped",[1581,1605]],[[64683,64683],"mapped",[1582,1580]],[[64684,64684],"mapped",[1582,1605]],[[64685,64685],"mapped",[1587,1580]],[[64686,64686],"mapped",[1587,1581]],[[64687,64687],"mapped",[1587,1582]],[[64688,64688],"mapped",[1587,1605]],[[64689,64689],"mapped",[1589,1581]],[[64690,64690],"mapped",[1589,1582]],[[64691,64691],"mapped",[1589,1605]],[[64692,64692],"mapped",[1590,1580]],[[64693,64693],"mapped",[1590,1581]],[[64694,64694],"mapped",[1590,1582]],[[64695,64695],"mapped",[1590,1605]],[[64696,64696],"mapped",[1591,1581]],[[64697,64697],"mapped",[1592,1605]],[[64698,64698],"mapped",[1593,1580]],[[64699,64699],"mapped",[1593,1605]],[[64700,64700],"mapped",[1594,1580]],[[64701,64701],"mapped",[1594,1605]],[[64702,64702],"mapped",[1601,1580]],[[64703,64703],"mapped",[1601,1581]],[[64704,64704],"mapped",[1601,1582]],[[64705,64705],"mapped",[1601,1605]],[[64706,64706],"mapped",[1602,1581]],[[64707,64707],"mapped",[1602,1605]],[[64708,64708],"mapped",[1603,1580]],[[64709,64709],"mapped",[1603,1581]],[[64710,64710],"mapped",[1603,1582]],[[64711,64711],"mapped",[1603,1604]],[[64712,64712],"mapped",[1603,1605]],[[64713,64713],"mapped",[1604,1580]],[[64714,64714],"mapped",[1604,1581]],[[64715,64715],"mapped",[1604,1582]],[[64716,64716],"mapped",[1604,1605]],[[64717,64717],"mapped",[1604,1607]],[[64718,64718],"mapped",[1605,1580]],[[64719,64719],"mapped",[1605,1581]],[[64720,64720],"mapped",[1605,1582]],[[64721,64721],"mapped",[1605,1605]],[[64722,64722],"mapped",[1606,1580]],[[64723,64723],"mapped",[1606,1581]],[[64724,64724],"mapped",[1606,1582]],[[64725,64725],"mapped",[1606,1605]],[[64726,64726],"mapped",[1606,1607]],[[64727,64727],"mapped",[1607,1580]],[[64728,64728],"mapped",[1607,1605]],[[64729,64729],"mapped",[1607,1648]],[[64730,64730],"mapped",[1610,1580]],[[64731,64731],"mapped",[1610,1581]],[[64732,64732],"mapped",[1610,1582]],[[64733,64733],"mapped",[1610,1605]],[[64734,64734],"mapped",[1610,1607]],[[64735,64735],"mapped",[1574,1605]],[[64736,64736],"mapped",[1574,1607]],[[64737,64737],"mapped",[1576,1605]],[[64738,64738],"mapped",[1576,1607]],[[64739,64739],"mapped",[1578,1605]],[[64740,64740],"mapped",[1578,1607]],[[64741,64741],"mapped",[1579,1605]],[[64742,64742],"mapped",[1579,1607]],[[64743,64743],"mapped",[1587,1605]],[[64744,64744],"mapped",[1587,1607]],[[64745,64745],"mapped",[1588,1605]],[[64746,64746],"mapped",[1588,1607]],[[64747,64747],"mapped",[1603,1604]],[[64748,64748],"mapped",[1603,1605]],[[64749,64749],"mapped",[1604,1605]],[[64750,64750],"mapped",[1606,1605]],[[64751,64751],"mapped",[1606,1607]],[[64752,64752],"mapped",[1610,1605]],[[64753,64753],"mapped",[1610,1607]],[[64754,64754],"mapped",[1600,1614,1617]],[[64755,64755],"mapped",[1600,1615,1617]],[[64756,64756],"mapped",[1600,1616,1617]],[[64757,64757],"mapped",[1591,1609]],[[64758,64758],"mapped",[1591,1610]],[[64759,64759],"mapped",[1593,1609]],[[64760,64760],"mapped",[1593,1610]],[[64761,64761],"mapped",[1594,1609]],[[64762,64762],"mapped",[1594,1610]],[[64763,64763],"mapped",[1587,1609]],[[64764,64764],"mapped",[1587,1610]],[[64765,64765],"mapped",[1588,1609]],[[64766,64766],"mapped",[1588,1610]],[[64767,64767],"mapped",[1581,1609]],[[64768,64768],"mapped",[1581,1610]],[[64769,64769],"mapped",[1580,1609]],[[64770,64770],"mapped",[1580,1610]],[[64771,64771],"mapped",[1582,1609]],[[64772,64772],"mapped",[1582,1610]],[[64773,64773],"mapped",[1589,1609]],[[64774,64774],"mapped",[1589,1610]],[[64775,64775],"mapped",[1590,1609]],[[64776,64776],"mapped",[1590,1610]],[[64777,64777],"mapped",[1588,1580]],[[64778,64778],"mapped",[1588,1581]],[[64779,64779],"mapped",[1588,1582]],[[64780,64780],"mapped",[1588,1605]],[[64781,64781],"mapped",[1588,1585]],[[64782,64782],"mapped",[1587,1585]],[[64783,64783],"mapped",[1589,1585]],[[64784,64784],"mapped",[1590,1585]],[[64785,64785],"mapped",[1591,1609]],[[64786,64786],"mapped",[1591,1610]],[[64787,64787],"mapped",[1593,1609]],[[64788,64788],"mapped",[1593,1610]],[[64789,64789],"mapped",[1594,1609]],[[64790,64790],"mapped",[1594,1610]],[[64791,64791],"mapped",[1587,1609]],[[64792,64792],"mapped",[1587,1610]],[[64793,64793],"mapped",[1588,1609]],[[64794,64794],"mapped",[1588,1610]],[[64795,64795],"mapped",[1581,1609]],[[64796,64796],"mapped",[1581,1610]],[[64797,64797],"mapped",[1580,1609]],[[64798,64798],"mapped",[1580,1610]],[[64799,64799],"mapped",[1582,1609]],[[64800,64800],"mapped",[1582,1610]],[[64801,64801],"mapped",[1589,1609]],[[64802,64802],"mapped",[1589,1610]],[[64803,64803],"mapped",[1590,1609]],[[64804,64804],"mapped",[1590,1610]],[[64805,64805],"mapped",[1588,1580]],[[64806,64806],"mapped",[1588,1581]],[[64807,64807],"mapped",[1588,1582]],[[64808,64808],"mapped",[1588,1605]],[[64809,64809],"mapped",[1588,1585]],[[64810,64810],"mapped",[1587,1585]],[[64811,64811],"mapped",[1589,1585]],[[64812,64812],"mapped",[1590,1585]],[[64813,64813],"mapped",[1588,1580]],[[64814,64814],"mapped",[1588,1581]],[[64815,64815],"mapped",[1588,1582]],[[64816,64816],"mapped",[1588,1605]],[[64817,64817],"mapped",[1587,1607]],[[64818,64818],"mapped",[1588,1607]],[[64819,64819],"mapped",[1591,1605]],[[64820,64820],"mapped",[1587,1580]],[[64821,64821],"mapped",[1587,1581]],[[64822,64822],"mapped",[1587,1582]],[[64823,64823],"mapped",[1588,1580]],[[64824,64824],"mapped",[1588,1581]],[[64825,64825],"mapped",[1588,1582]],[[64826,64826],"mapped",[1591,1605]],[[64827,64827],"mapped",[1592,1605]],[[64828,64829],"mapped",[1575,1611]],[[64830,64831],"valid",[],"NV8"],[[64832,64847],"disallowed"],[[64848,64848],"mapped",[1578,1580,1605]],[[64849,64850],"mapped",[1578,1581,1580]],[[64851,64851],"mapped",[1578,1581,1605]],[[64852,64852],"mapped",[1578,1582,1605]],[[64853,64853],"mapped",[1578,1605,1580]],[[64854,64854],"mapped",[1578,1605,1581]],[[64855,64855],"mapped",[1578,1605,1582]],[[64856,64857],"mapped",[1580,1605,1581]],[[64858,64858],"mapped",[1581,1605,1610]],[[64859,64859],"mapped",[1581,1605,1609]],[[64860,64860],"mapped",[1587,1581,1580]],[[64861,64861],"mapped",[1587,1580,1581]],[[64862,64862],"mapped",[1587,1580,1609]],[[64863,64864],"mapped",[1587,1605,1581]],[[64865,64865],"mapped",[1587,1605,1580]],[[64866,64867],"mapped",[1587,1605,1605]],[[64868,64869],"mapped",[1589,1581,1581]],[[64870,64870],"mapped",[1589,1605,1605]],[[64871,64872],"mapped",[1588,1581,1605]],[[64873,64873],"mapped",[1588,1580,1610]],[[64874,64875],"mapped",[1588,1605,1582]],[[64876,64877],"mapped",[1588,1605,1605]],[[64878,64878],"mapped",[1590,1581,1609]],[[64879,64880],"mapped",[1590,1582,1605]],[[64881,64882],"mapped",[1591,1605,1581]],[[64883,64883],"mapped",[1591,1605,1605]],[[64884,64884],"mapped",[1591,1605,1610]],[[64885,64885],"mapped",[1593,1580,1605]],[[64886,64887],"mapped",[1593,1605,1605]],[[64888,64888],"mapped",[1593,1605,1609]],[[64889,64889],"mapped",[1594,1605,1605]],[[64890,64890],"mapped",[1594,1605,1610]],[[64891,64891],"mapped",[1594,1605,1609]],[[64892,64893],"mapped",[1601,1582,1605]],[[64894,64894],"mapped",[1602,1605,1581]],[[64895,64895],"mapped",[1602,1605,1605]],[[64896,64896],"mapped",[1604,1581,1605]],[[64897,64897],"mapped",[1604,1581,1610]],[[64898,64898],"mapped",[1604,1581,1609]],[[64899,64900],"mapped",[1604,1580,1580]],[[64901,64902],"mapped",[1604,1582,1605]],[[64903,64904],"mapped",[1604,1605,1581]],[[64905,64905],"mapped",[1605,1581,1580]],[[64906,64906],"mapped",[1605,1581,1605]],[[64907,64907],"mapped",[1605,1581,1610]],[[64908,64908],"mapped",[1605,1580,1581]],[[64909,64909],"mapped",[1605,1580,1605]],[[64910,64910],"mapped",[1605,1582,1580]],[[64911,64911],"mapped",[1605,1582,1605]],[[64912,64913],"disallowed"],[[64914,64914],"mapped",[1605,1580,1582]],[[64915,64915],"mapped",[1607,1605,1580]],[[64916,64916],"mapped",[1607,1605,1605]],[[64917,64917],"mapped",[1606,1581,1605]],[[64918,64918],"mapped",[1606,1581,1609]],[[64919,64920],"mapped",[1606,1580,1605]],[[64921,64921],"mapped",[1606,1580,1609]],[[64922,64922],"mapped",[1606,1605,1610]],[[64923,64923],"mapped",[1606,1605,1609]],[[64924,64925],"mapped",[1610,1605,1605]],[[64926,64926],"mapped",[1576,1582,1610]],[[64927,64927],"mapped",[1578,1580,1610]],[[64928,64928],"mapped",[1578,1580,1609]],[[64929,64929],"mapped",[1578,1582,1610]],[[64930,64930],"mapped",[1578,1582,1609]],[[64931,64931],"mapped",[1578,1605,1610]],[[64932,64932],"mapped",[1578,1605,1609]],[[64933,64933],"mapped",[1580,1605,1610]],[[64934,64934],"mapped",[1580,1581,1609]],[[64935,64935],"mapped",[1580,1605,1609]],[[64936,64936],"mapped",[1587,1582,1609]],[[64937,64937],"mapped",[1589,1581,1610]],[[64938,64938],"mapped",[1588,1581,1610]],[[64939,64939],"mapped",[1590,1581,1610]],[[64940,64940],"mapped",[1604,1580,1610]],[[64941,64941],"mapped",[1604,1605,1610]],[[64942,64942],"mapped",[1610,1581,1610]],[[64943,64943],"mapped",[1610,1580,1610]],[[64944,64944],"mapped",[1610,1605,1610]],[[64945,64945],"mapped",[1605,1605,1610]],[[64946,64946],"mapped",[1602,1605,1610]],[[64947,64947],"mapped",[1606,1581,1610]],[[64948,64948],"mapped",[1602,1605,1581]],[[64949,64949],"mapped",[1604,1581,1605]],[[64950,64950],"mapped",[1593,1605,1610]],[[64951,64951],"mapped",[1603,1605,1610]],[[64952,64952],"mapped",[1606,1580,1581]],[[64953,64953],"mapped",[1605,1582,1610]],[[64954,64954],"mapped",[1604,1580,1605]],[[64955,64955],"mapped",[1603,1605,1605]],[[64956,64956],"mapped",[1604,1580,1605]],[[64957,64957],"mapped",[1606,1580,1581]],[[64958,64958],"mapped",[1580,1581,1610]],[[64959,64959],"mapped",[1581,1580,1610]],[[64960,64960],"mapped",[1605,1580,1610]],[[64961,64961],"mapped",[1601,1605,1610]],[[64962,64962],"mapped",[1576,1581,1610]],[[64963,64963],"mapped",[1603,1605,1605]],[[64964,64964],"mapped",[1593,1580,1605]],[[64965,64965],"mapped",[1589,1605,1605]],[[64966,64966],"mapped",[1587,1582,1610]],[[64967,64967],"mapped",[1606,1580,1610]],[[64968,64975],"disallowed"],[[64976,65007],"disallowed"],[[65008,65008],"mapped",[1589,1604,1746]],[[65009,65009],"mapped",[1602,1604,1746]],[[65010,65010],"mapped",[1575,1604,1604,1607]],[[65011,65011],"mapped",[1575,1603,1576,1585]],[[65012,65012],"mapped",[1605,1581,1605,1583]],[[65013,65013],"mapped",[1589,1604,1593,1605]],[[65014,65014],"mapped",[1585,1587,1608,1604]],[[65015,65015],"mapped",[1593,1604,1610,1607]],[[65016,65016],"mapped",[1608,1587,1604,1605]],[[65017,65017],"mapped",[1589,1604,1609]],[[65018,65018],"disallowed_STD3_mapped",[1589,1604,1609,32,1575,1604,1604,1607,32,1593,1604,1610,1607,32,1608,1587,1604,1605]],[[65019,65019],"disallowed_STD3_mapped",[1580,1604,32,1580,1604,1575,1604,1607]],[[65020,65020],"mapped",[1585,1740,1575,1604]],[[65021,65021],"valid",[],"NV8"],[[65022,65023],"disallowed"],[[65024,65039],"ignored"],[[65040,65040],"disallowed_STD3_mapped",[44]],[[65041,65041],"mapped",[12289]],[[65042,65042],"disallowed"],[[65043,65043],"disallowed_STD3_mapped",[58]],[[65044,65044],"disallowed_STD3_mapped",[59]],[[65045,65045],"disallowed_STD3_mapped",[33]],[[65046,65046],"disallowed_STD3_mapped",[63]],[[65047,65047],"mapped",[12310]],[[65048,65048],"mapped",[12311]],[[65049,65049],"disallowed"],[[65050,65055],"disallowed"],[[65056,65059],"valid"],[[65060,65062],"valid"],[[65063,65069],"valid"],[[65070,65071],"valid"],[[65072,65072],"disallowed"],[[65073,65073],"mapped",[8212]],[[65074,65074],"mapped",[8211]],[[65075,65076],"disallowed_STD3_mapped",[95]],[[65077,65077],"disallowed_STD3_mapped",[40]],[[65078,65078],"disallowed_STD3_mapped",[41]],[[65079,65079],"disallowed_STD3_mapped",[123]],[[65080,65080],"disallowed_STD3_mapped",[125]],[[65081,65081],"mapped",[12308]],[[65082,65082],"mapped",[12309]],[[65083,65083],"mapped",[12304]],[[65084,65084],"mapped",[12305]],[[65085,65085],"mapped",[12298]],[[65086,65086],"mapped",[12299]],[[65087,65087],"mapped",[12296]],[[65088,65088],"mapped",[12297]],[[65089,65089],"mapped",[12300]],[[65090,65090],"mapped",[12301]],[[65091,65091],"mapped",[12302]],[[65092,65092],"mapped",[12303]],[[65093,65094],"valid",[],"NV8"],[[65095,65095],"disallowed_STD3_mapped",[91]],[[65096,65096],"disallowed_STD3_mapped",[93]],[[65097,65100],"disallowed_STD3_mapped",[32,773]],[[65101,65103],"disallowed_STD3_mapped",[95]],[[65104,65104],"disallowed_STD3_mapped",[44]],[[65105,65105],"mapped",[12289]],[[65106,65106],"disallowed"],[[65107,65107],"disallowed"],[[65108,65108],"disallowed_STD3_mapped",[59]],[[65109,65109],"disallowed_STD3_mapped",[58]],[[65110,65110],"disallowed_STD3_mapped",[63]],[[65111,65111],"disallowed_STD3_mapped",[33]],[[65112,65112],"mapped",[8212]],[[65113,65113],"disallowed_STD3_mapped",[40]],[[65114,65114],"disallowed_STD3_mapped",[41]],[[65115,65115],"disallowed_STD3_mapped",[123]],[[65116,65116],"disallowed_STD3_mapped",[125]],[[65117,65117],"mapped",[12308]],[[65118,65118],"mapped",[12309]],[[65119,65119],"disallowed_STD3_mapped",[35]],[[65120,65120],"disallowed_STD3_mapped",[38]],[[65121,65121],"disallowed_STD3_mapped",[42]],[[65122,65122],"disallowed_STD3_mapped",[43]],[[65123,65123],"mapped",[45]],[[65124,65124],"disallowed_STD3_mapped",[60]],[[65125,65125],"disallowed_STD3_mapped",[62]],[[65126,65126],"disallowed_STD3_mapped",[61]],[[65127,65127],"disallowed"],[[65128,65128],"disallowed_STD3_mapped",[92]],[[65129,65129],"disallowed_STD3_mapped",[36]],[[65130,65130],"disallowed_STD3_mapped",[37]],[[65131,65131],"disallowed_STD3_mapped",[64]],[[65132,65135],"disallowed"],[[65136,65136],"disallowed_STD3_mapped",[32,1611]],[[65137,65137],"mapped",[1600,1611]],[[65138,65138],"disallowed_STD3_mapped",[32,1612]],[[65139,65139],"valid"],[[65140,65140],"disallowed_STD3_mapped",[32,1613]],[[65141,65141],"disallowed"],[[65142,65142],"disallowed_STD3_mapped",[32,1614]],[[65143,65143],"mapped",[1600,1614]],[[65144,65144],"disallowed_STD3_mapped",[32,1615]],[[65145,65145],"mapped",[1600,1615]],[[65146,65146],"disallowed_STD3_mapped",[32,1616]],[[65147,65147],"mapped",[1600,1616]],[[65148,65148],"disallowed_STD3_mapped",[32,1617]],[[65149,65149],"mapped",[1600,1617]],[[65150,65150],"disallowed_STD3_mapped",[32,1618]],[[65151,65151],"mapped",[1600,1618]],[[65152,65152],"mapped",[1569]],[[65153,65154],"mapped",[1570]],[[65155,65156],"mapped",[1571]],[[65157,65158],"mapped",[1572]],[[65159,65160],"mapped",[1573]],[[65161,65164],"mapped",[1574]],[[65165,65166],"mapped",[1575]],[[65167,65170],"mapped",[1576]],[[65171,65172],"mapped",[1577]],[[65173,65176],"mapped",[1578]],[[65177,65180],"mapped",[1579]],[[65181,65184],"mapped",[1580]],[[65185,65188],"mapped",[1581]],[[65189,65192],"mapped",[1582]],[[65193,65194],"mapped",[1583]],[[65195,65196],"mapped",[1584]],[[65197,65198],"mapped",[1585]],[[65199,65200],"mapped",[1586]],[[65201,65204],"mapped",[1587]],[[65205,65208],"mapped",[1588]],[[65209,65212],"mapped",[1589]],[[65213,65216],"mapped",[1590]],[[65217,65220],"mapped",[1591]],[[65221,65224],"mapped",[1592]],[[65225,65228],"mapped",[1593]],[[65229,65232],"mapped",[1594]],[[65233,65236],"mapped",[1601]],[[65237,65240],"mapped",[1602]],[[65241,65244],"mapped",[1603]],[[65245,65248],"mapped",[1604]],[[65249,65252],"mapped",[1605]],[[65253,65256],"mapped",[1606]],[[65257,65260],"mapped",[1607]],[[65261,65262],"mapped",[1608]],[[65263,65264],"mapped",[1609]],[[65265,65268],"mapped",[1610]],[[65269,65270],"mapped",[1604,1570]],[[65271,65272],"mapped",[1604,1571]],[[65273,65274],"mapped",[1604,1573]],[[65275,65276],"mapped",[1604,1575]],[[65277,65278],"disallowed"],[[65279,65279],"ignored"],[[65280,65280],"disallowed"],[[65281,65281],"disallowed_STD3_mapped",[33]],[[65282,65282],"disallowed_STD3_mapped",[34]],[[65283,65283],"disallowed_STD3_mapped",[35]],[[65284,65284],"disallowed_STD3_mapped",[36]],[[65285,65285],"disallowed_STD3_mapped",[37]],[[65286,65286],"disallowed_STD3_mapped",[38]],[[65287,65287],"disallowed_STD3_mapped",[39]],[[65288,65288],"disallowed_STD3_mapped",[40]],[[65289,65289],"disallowed_STD3_mapped",[41]],[[65290,65290],"disallowed_STD3_mapped",[42]],[[65291,65291],"disallowed_STD3_mapped",[43]],[[65292,65292],"disallowed_STD3_mapped",[44]],[[65293,65293],"mapped",[45]],[[65294,65294],"mapped",[46]],[[65295,65295],"disallowed_STD3_mapped",[47]],[[65296,65296],"mapped",[48]],[[65297,65297],"mapped",[49]],[[65298,65298],"mapped",[50]],[[65299,65299],"mapped",[51]],[[65300,65300],"mapped",[52]],[[65301,65301],"mapped",[53]],[[65302,65302],"mapped",[54]],[[65303,65303],"mapped",[55]],[[65304,65304],"mapped",[56]],[[65305,65305],"mapped",[57]],[[65306,65306],"disallowed_STD3_mapped",[58]],[[65307,65307],"disallowed_STD3_mapped",[59]],[[65308,65308],"disallowed_STD3_mapped",[60]],[[65309,65309],"disallowed_STD3_mapped",[61]],[[65310,65310],"disallowed_STD3_mapped",[62]],[[65311,65311],"disallowed_STD3_mapped",[63]],[[65312,65312],"disallowed_STD3_mapped",[64]],[[65313,65313],"mapped",[97]],[[65314,65314],"mapped",[98]],[[65315,65315],"mapped",[99]],[[65316,65316],"mapped",[100]],[[65317,65317],"mapped",[101]],[[65318,65318],"mapped",[102]],[[65319,65319],"mapped",[103]],[[65320,65320],"mapped",[104]],[[65321,65321],"mapped",[105]],[[65322,65322],"mapped",[106]],[[65323,65323],"mapped",[107]],[[65324,65324],"mapped",[108]],[[65325,65325],"mapped",[109]],[[65326,65326],"mapped",[110]],[[65327,65327],"mapped",[111]],[[65328,65328],"mapped",[112]],[[65329,65329],"mapped",[113]],[[65330,65330],"mapped",[114]],[[65331,65331],"mapped",[115]],[[65332,65332],"mapped",[116]],[[65333,65333],"mapped",[117]],[[65334,65334],"mapped",[118]],[[65335,65335],"mapped",[119]],[[65336,65336],"mapped",[120]],[[65337,65337],"mapped",[121]],[[65338,65338],"mapped",[122]],[[65339,65339],"disallowed_STD3_mapped",[91]],[[65340,65340],"disallowed_STD3_mapped",[92]],[[65341,65341],"disallowed_STD3_mapped",[93]],[[65342,65342],"disallowed_STD3_mapped",[94]],[[65343,65343],"disallowed_STD3_mapped",[95]],[[65344,65344],"disallowed_STD3_mapped",[96]],[[65345,65345],"mapped",[97]],[[65346,65346],"mapped",[98]],[[65347,65347],"mapped",[99]],[[65348,65348],"mapped",[100]],[[65349,65349],"mapped",[101]],[[65350,65350],"mapped",[102]],[[65351,65351],"mapped",[103]],[[65352,65352],"mapped",[104]],[[65353,65353],"mapped",[105]],[[65354,65354],"mapped",[106]],[[65355,65355],"mapped",[107]],[[65356,65356],"mapped",[108]],[[65357,65357],"mapped",[109]],[[65358,65358],"mapped",[110]],[[65359,65359],"mapped",[111]],[[65360,65360],"mapped",[112]],[[65361,65361],"mapped",[113]],[[65362,65362],"mapped",[114]],[[65363,65363],"mapped",[115]],[[65364,65364],"mapped",[116]],[[65365,65365],"mapped",[117]],[[65366,65366],"mapped",[118]],[[65367,65367],"mapped",[119]],[[65368,65368],"mapped",[120]],[[65369,65369],"mapped",[121]],[[65370,65370],"mapped",[122]],[[65371,65371],"disallowed_STD3_mapped",[123]],[[65372,65372],"disallowed_STD3_mapped",[124]],[[65373,65373],"disallowed_STD3_mapped",[125]],[[65374,65374],"disallowed_STD3_mapped",[126]],[[65375,65375],"mapped",[10629]],[[65376,65376],"mapped",[10630]],[[65377,65377],"mapped",[46]],[[65378,65378],"mapped",[12300]],[[65379,65379],"mapped",[12301]],[[65380,65380],"mapped",[12289]],[[65381,65381],"mapped",[12539]],[[65382,65382],"mapped",[12530]],[[65383,65383],"mapped",[12449]],[[65384,65384],"mapped",[12451]],[[65385,65385],"mapped",[12453]],[[65386,65386],"mapped",[12455]],[[65387,65387],"mapped",[12457]],[[65388,65388],"mapped",[12515]],[[65389,65389],"mapped",[12517]],[[65390,65390],"mapped",[12519]],[[65391,65391],"mapped",[12483]],[[65392,65392],"mapped",[12540]],[[65393,65393],"mapped",[12450]],[[65394,65394],"mapped",[12452]],[[65395,65395],"mapped",[12454]],[[65396,65396],"mapped",[12456]],[[65397,65397],"mapped",[12458]],[[65398,65398],"mapped",[12459]],[[65399,65399],"mapped",[12461]],[[65400,65400],"mapped",[12463]],[[65401,65401],"mapped",[12465]],[[65402,65402],"mapped",[12467]],[[65403,65403],"mapped",[12469]],[[65404,65404],"mapped",[12471]],[[65405,65405],"mapped",[12473]],[[65406,65406],"mapped",[12475]],[[65407,65407],"mapped",[12477]],[[65408,65408],"mapped",[12479]],[[65409,65409],"mapped",[12481]],[[65410,65410],"mapped",[12484]],[[65411,65411],"mapped",[12486]],[[65412,65412],"mapped",[12488]],[[65413,65413],"mapped",[12490]],[[65414,65414],"mapped",[12491]],[[65415,65415],"mapped",[12492]],[[65416,65416],"mapped",[12493]],[[65417,65417],"mapped",[12494]],[[65418,65418],"mapped",[12495]],[[65419,65419],"mapped",[12498]],[[65420,65420],"mapped",[12501]],[[65421,65421],"mapped",[12504]],[[65422,65422],"mapped",[12507]],[[65423,65423],"mapped",[12510]],[[65424,65424],"mapped",[12511]],[[65425,65425],"mapped",[12512]],[[65426,65426],"mapped",[12513]],[[65427,65427],"mapped",[12514]],[[65428,65428],"mapped",[12516]],[[65429,65429],"mapped",[12518]],[[65430,65430],"mapped",[12520]],[[65431,65431],"mapped",[12521]],[[65432,65432],"mapped",[12522]],[[65433,65433],"mapped",[12523]],[[65434,65434],"mapped",[12524]],[[65435,65435],"mapped",[12525]],[[65436,65436],"mapped",[12527]],[[65437,65437],"mapped",[12531]],[[65438,65438],"mapped",[12441]],[[65439,65439],"mapped",[12442]],[[65440,65440],"disallowed"],[[65441,65441],"mapped",[4352]],[[65442,65442],"mapped",[4353]],[[65443,65443],"mapped",[4522]],[[65444,65444],"mapped",[4354]],[[65445,65445],"mapped",[4524]],[[65446,65446],"mapped",[4525]],[[65447,65447],"mapped",[4355]],[[65448,65448],"mapped",[4356]],[[65449,65449],"mapped",[4357]],[[65450,65450],"mapped",[4528]],[[65451,65451],"mapped",[4529]],[[65452,65452],"mapped",[4530]],[[65453,65453],"mapped",[4531]],[[65454,65454],"mapped",[4532]],[[65455,65455],"mapped",[4533]],[[65456,65456],"mapped",[4378]],[[65457,65457],"mapped",[4358]],[[65458,65458],"mapped",[4359]],[[65459,65459],"mapped",[4360]],[[65460,65460],"mapped",[4385]],[[65461,65461],"mapped",[4361]],[[65462,65462],"mapped",[4362]],[[65463,65463],"mapped",[4363]],[[65464,65464],"mapped",[4364]],[[65465,65465],"mapped",[4365]],[[65466,65466],"mapped",[4366]],[[65467,65467],"mapped",[4367]],[[65468,65468],"mapped",[4368]],[[65469,65469],"mapped",[4369]],[[65470,65470],"mapped",[4370]],[[65471,65473],"disallowed"],[[65474,65474],"mapped",[4449]],[[65475,65475],"mapped",[4450]],[[65476,65476],"mapped",[4451]],[[65477,65477],"mapped",[4452]],[[65478,65478],"mapped",[4453]],[[65479,65479],"mapped",[4454]],[[65480,65481],"disallowed"],[[65482,65482],"mapped",[4455]],[[65483,65483],"mapped",[4456]],[[65484,65484],"mapped",[4457]],[[65485,65485],"mapped",[4458]],[[65486,65486],"mapped",[4459]],[[65487,65487],"mapped",[4460]],[[65488,65489],"disallowed"],[[65490,65490],"mapped",[4461]],[[65491,65491],"mapped",[4462]],[[65492,65492],"mapped",[4463]],[[65493,65493],"mapped",[4464]],[[65494,65494],"mapped",[4465]],[[65495,65495],"mapped",[4466]],[[65496,65497],"disallowed"],[[65498,65498],"mapped",[4467]],[[65499,65499],"mapped",[4468]],[[65500,65500],"mapped",[4469]],[[65501,65503],"disallowed"],[[65504,65504],"mapped",[162]],[[65505,65505],"mapped",[163]],[[65506,65506],"mapped",[172]],[[65507,65507],"disallowed_STD3_mapped",[32,772]],[[65508,65508],"mapped",[166]],[[65509,65509],"mapped",[165]],[[65510,65510],"mapped",[8361]],[[65511,65511],"disallowed"],[[65512,65512],"mapped",[9474]],[[65513,65513],"mapped",[8592]],[[65514,65514],"mapped",[8593]],[[65515,65515],"mapped",[8594]],[[65516,65516],"mapped",[8595]],[[65517,65517],"mapped",[9632]],[[65518,65518],"mapped",[9675]],[[65519,65528],"disallowed"],[[65529,65531],"disallowed"],[[65532,65532],"disallowed"],[[65533,65533],"disallowed"],[[65534,65535],"disallowed"],[[65536,65547],"valid"],[[65548,65548],"disallowed"],[[65549,65574],"valid"],[[65575,65575],"disallowed"],[[65576,65594],"valid"],[[65595,65595],"disallowed"],[[65596,65597],"valid"],[[65598,65598],"disallowed"],[[65599,65613],"valid"],[[65614,65615],"disallowed"],[[65616,65629],"valid"],[[65630,65663],"disallowed"],[[65664,65786],"valid"],[[65787,65791],"disallowed"],[[65792,65794],"valid",[],"NV8"],[[65795,65798],"disallowed"],[[65799,65843],"valid",[],"NV8"],[[65844,65846],"disallowed"],[[65847,65855],"valid",[],"NV8"],[[65856,65930],"valid",[],"NV8"],[[65931,65932],"valid",[],"NV8"],[[65933,65935],"disallowed"],[[65936,65947],"valid",[],"NV8"],[[65948,65951],"disallowed"],[[65952,65952],"valid",[],"NV8"],[[65953,65999],"disallowed"],[[66e3,66044],"valid",[],"NV8"],[[66045,66045],"valid"],[[66046,66175],"disallowed"],[[66176,66204],"valid"],[[66205,66207],"disallowed"],[[66208,66256],"valid"],[[66257,66271],"disallowed"],[[66272,66272],"valid"],[[66273,66299],"valid",[],"NV8"],[[66300,66303],"disallowed"],[[66304,66334],"valid"],[[66335,66335],"valid"],[[66336,66339],"valid",[],"NV8"],[[66340,66351],"disallowed"],[[66352,66368],"valid"],[[66369,66369],"valid",[],"NV8"],[[66370,66377],"valid"],[[66378,66378],"valid",[],"NV8"],[[66379,66383],"disallowed"],[[66384,66426],"valid"],[[66427,66431],"disallowed"],[[66432,66461],"valid"],[[66462,66462],"disallowed"],[[66463,66463],"valid",[],"NV8"],[[66464,66499],"valid"],[[66500,66503],"disallowed"],[[66504,66511],"valid"],[[66512,66517],"valid",[],"NV8"],[[66518,66559],"disallowed"],[[66560,66560],"mapped",[66600]],[[66561,66561],"mapped",[66601]],[[66562,66562],"mapped",[66602]],[[66563,66563],"mapped",[66603]],[[66564,66564],"mapped",[66604]],[[66565,66565],"mapped",[66605]],[[66566,66566],"mapped",[66606]],[[66567,66567],"mapped",[66607]],[[66568,66568],"mapped",[66608]],[[66569,66569],"mapped",[66609]],[[66570,66570],"mapped",[66610]],[[66571,66571],"mapped",[66611]],[[66572,66572],"mapped",[66612]],[[66573,66573],"mapped",[66613]],[[66574,66574],"mapped",[66614]],[[66575,66575],"mapped",[66615]],[[66576,66576],"mapped",[66616]],[[66577,66577],"mapped",[66617]],[[66578,66578],"mapped",[66618]],[[66579,66579],"mapped",[66619]],[[66580,66580],"mapped",[66620]],[[66581,66581],"mapped",[66621]],[[66582,66582],"mapped",[66622]],[[66583,66583],"mapped",[66623]],[[66584,66584],"mapped",[66624]],[[66585,66585],"mapped",[66625]],[[66586,66586],"mapped",[66626]],[[66587,66587],"mapped",[66627]],[[66588,66588],"mapped",[66628]],[[66589,66589],"mapped",[66629]],[[66590,66590],"mapped",[66630]],[[66591,66591],"mapped",[66631]],[[66592,66592],"mapped",[66632]],[[66593,66593],"mapped",[66633]],[[66594,66594],"mapped",[66634]],[[66595,66595],"mapped",[66635]],[[66596,66596],"mapped",[66636]],[[66597,66597],"mapped",[66637]],[[66598,66598],"mapped",[66638]],[[66599,66599],"mapped",[66639]],[[66600,66637],"valid"],[[66638,66717],"valid"],[[66718,66719],"disallowed"],[[66720,66729],"valid"],[[66730,66815],"disallowed"],[[66816,66855],"valid"],[[66856,66863],"disallowed"],[[66864,66915],"valid"],[[66916,66926],"disallowed"],[[66927,66927],"valid",[],"NV8"],[[66928,67071],"disallowed"],[[67072,67382],"valid"],[[67383,67391],"disallowed"],[[67392,67413],"valid"],[[67414,67423],"disallowed"],[[67424,67431],"valid"],[[67432,67583],"disallowed"],[[67584,67589],"valid"],[[67590,67591],"disallowed"],[[67592,67592],"valid"],[[67593,67593],"disallowed"],[[67594,67637],"valid"],[[67638,67638],"disallowed"],[[67639,67640],"valid"],[[67641,67643],"disallowed"],[[67644,67644],"valid"],[[67645,67646],"disallowed"],[[67647,67647],"valid"],[[67648,67669],"valid"],[[67670,67670],"disallowed"],[[67671,67679],"valid",[],"NV8"],[[67680,67702],"valid"],[[67703,67711],"valid",[],"NV8"],[[67712,67742],"valid"],[[67743,67750],"disallowed"],[[67751,67759],"valid",[],"NV8"],[[67760,67807],"disallowed"],[[67808,67826],"valid"],[[67827,67827],"disallowed"],[[67828,67829],"valid"],[[67830,67834],"disallowed"],[[67835,67839],"valid",[],"NV8"],[[67840,67861],"valid"],[[67862,67865],"valid",[],"NV8"],[[67866,67867],"valid",[],"NV8"],[[67868,67870],"disallowed"],[[67871,67871],"valid",[],"NV8"],[[67872,67897],"valid"],[[67898,67902],"disallowed"],[[67903,67903],"valid",[],"NV8"],[[67904,67967],"disallowed"],[[67968,68023],"valid"],[[68024,68027],"disallowed"],[[68028,68029],"valid",[],"NV8"],[[68030,68031],"valid"],[[68032,68047],"valid",[],"NV8"],[[68048,68049],"disallowed"],[[68050,68095],"valid",[],"NV8"],[[68096,68099],"valid"],[[68100,68100],"disallowed"],[[68101,68102],"valid"],[[68103,68107],"disallowed"],[[68108,68115],"valid"],[[68116,68116],"disallowed"],[[68117,68119],"valid"],[[68120,68120],"disallowed"],[[68121,68147],"valid"],[[68148,68151],"disallowed"],[[68152,68154],"valid"],[[68155,68158],"disallowed"],[[68159,68159],"valid"],[[68160,68167],"valid",[],"NV8"],[[68168,68175],"disallowed"],[[68176,68184],"valid",[],"NV8"],[[68185,68191],"disallowed"],[[68192,68220],"valid"],[[68221,68223],"valid",[],"NV8"],[[68224,68252],"valid"],[[68253,68255],"valid",[],"NV8"],[[68256,68287],"disallowed"],[[68288,68295],"valid"],[[68296,68296],"valid",[],"NV8"],[[68297,68326],"valid"],[[68327,68330],"disallowed"],[[68331,68342],"valid",[],"NV8"],[[68343,68351],"disallowed"],[[68352,68405],"valid"],[[68406,68408],"disallowed"],[[68409,68415],"valid",[],"NV8"],[[68416,68437],"valid"],[[68438,68439],"disallowed"],[[68440,68447],"valid",[],"NV8"],[[68448,68466],"valid"],[[68467,68471],"disallowed"],[[68472,68479],"valid",[],"NV8"],[[68480,68497],"valid"],[[68498,68504],"disallowed"],[[68505,68508],"valid",[],"NV8"],[[68509,68520],"disallowed"],[[68521,68527],"valid",[],"NV8"],[[68528,68607],"disallowed"],[[68608,68680],"valid"],[[68681,68735],"disallowed"],[[68736,68736],"mapped",[68800]],[[68737,68737],"mapped",[68801]],[[68738,68738],"mapped",[68802]],[[68739,68739],"mapped",[68803]],[[68740,68740],"mapped",[68804]],[[68741,68741],"mapped",[68805]],[[68742,68742],"mapped",[68806]],[[68743,68743],"mapped",[68807]],[[68744,68744],"mapped",[68808]],[[68745,68745],"mapped",[68809]],[[68746,68746],"mapped",[68810]],[[68747,68747],"mapped",[68811]],[[68748,68748],"mapped",[68812]],[[68749,68749],"mapped",[68813]],[[68750,68750],"mapped",[68814]],[[68751,68751],"mapped",[68815]],[[68752,68752],"mapped",[68816]],[[68753,68753],"mapped",[68817]],[[68754,68754],"mapped",[68818]],[[68755,68755],"mapped",[68819]],[[68756,68756],"mapped",[68820]],[[68757,68757],"mapped",[68821]],[[68758,68758],"mapped",[68822]],[[68759,68759],"mapped",[68823]],[[68760,68760],"mapped",[68824]],[[68761,68761],"mapped",[68825]],[[68762,68762],"mapped",[68826]],[[68763,68763],"mapped",[68827]],[[68764,68764],"mapped",[68828]],[[68765,68765],"mapped",[68829]],[[68766,68766],"mapped",[68830]],[[68767,68767],"mapped",[68831]],[[68768,68768],"mapped",[68832]],[[68769,68769],"mapped",[68833]],[[68770,68770],"mapped",[68834]],[[68771,68771],"mapped",[68835]],[[68772,68772],"mapped",[68836]],[[68773,68773],"mapped",[68837]],[[68774,68774],"mapped",[68838]],[[68775,68775],"mapped",[68839]],[[68776,68776],"mapped",[68840]],[[68777,68777],"mapped",[68841]],[[68778,68778],"mapped",[68842]],[[68779,68779],"mapped",[68843]],[[68780,68780],"mapped",[68844]],[[68781,68781],"mapped",[68845]],[[68782,68782],"mapped",[68846]],[[68783,68783],"mapped",[68847]],[[68784,68784],"mapped",[68848]],[[68785,68785],"mapped",[68849]],[[68786,68786],"mapped",[68850]],[[68787,68799],"disallowed"],[[68800,68850],"valid"],[[68851,68857],"disallowed"],[[68858,68863],"valid",[],"NV8"],[[68864,69215],"disallowed"],[[69216,69246],"valid",[],"NV8"],[[69247,69631],"disallowed"],[[69632,69702],"valid"],[[69703,69709],"valid",[],"NV8"],[[69710,69713],"disallowed"],[[69714,69733],"valid",[],"NV8"],[[69734,69743],"valid"],[[69744,69758],"disallowed"],[[69759,69759],"valid"],[[69760,69818],"valid"],[[69819,69820],"valid",[],"NV8"],[[69821,69821],"disallowed"],[[69822,69825],"valid",[],"NV8"],[[69826,69839],"disallowed"],[[69840,69864],"valid"],[[69865,69871],"disallowed"],[[69872,69881],"valid"],[[69882,69887],"disallowed"],[[69888,69940],"valid"],[[69941,69941],"disallowed"],[[69942,69951],"valid"],[[69952,69955],"valid",[],"NV8"],[[69956,69967],"disallowed"],[[69968,70003],"valid"],[[70004,70005],"valid",[],"NV8"],[[70006,70006],"valid"],[[70007,70015],"disallowed"],[[70016,70084],"valid"],[[70085,70088],"valid",[],"NV8"],[[70089,70089],"valid",[],"NV8"],[[70090,70092],"valid"],[[70093,70093],"valid",[],"NV8"],[[70094,70095],"disallowed"],[[70096,70105],"valid"],[[70106,70106],"valid"],[[70107,70107],"valid",[],"NV8"],[[70108,70108],"valid"],[[70109,70111],"valid",[],"NV8"],[[70112,70112],"disallowed"],[[70113,70132],"valid",[],"NV8"],[[70133,70143],"disallowed"],[[70144,70161],"valid"],[[70162,70162],"disallowed"],[[70163,70199],"valid"],[[70200,70205],"valid",[],"NV8"],[[70206,70271],"disallowed"],[[70272,70278],"valid"],[[70279,70279],"disallowed"],[[70280,70280],"valid"],[[70281,70281],"disallowed"],[[70282,70285],"valid"],[[70286,70286],"disallowed"],[[70287,70301],"valid"],[[70302,70302],"disallowed"],[[70303,70312],"valid"],[[70313,70313],"valid",[],"NV8"],[[70314,70319],"disallowed"],[[70320,70378],"valid"],[[70379,70383],"disallowed"],[[70384,70393],"valid"],[[70394,70399],"disallowed"],[[70400,70400],"valid"],[[70401,70403],"valid"],[[70404,70404],"disallowed"],[[70405,70412],"valid"],[[70413,70414],"disallowed"],[[70415,70416],"valid"],[[70417,70418],"disallowed"],[[70419,70440],"valid"],[[70441,70441],"disallowed"],[[70442,70448],"valid"],[[70449,70449],"disallowed"],[[70450,70451],"valid"],[[70452,70452],"disallowed"],[[70453,70457],"valid"],[[70458,70459],"disallowed"],[[70460,70468],"valid"],[[70469,70470],"disallowed"],[[70471,70472],"valid"],[[70473,70474],"disallowed"],[[70475,70477],"valid"],[[70478,70479],"disallowed"],[[70480,70480],"valid"],[[70481,70486],"disallowed"],[[70487,70487],"valid"],[[70488,70492],"disallowed"],[[70493,70499],"valid"],[[70500,70501],"disallowed"],[[70502,70508],"valid"],[[70509,70511],"disallowed"],[[70512,70516],"valid"],[[70517,70783],"disallowed"],[[70784,70853],"valid"],[[70854,70854],"valid",[],"NV8"],[[70855,70855],"valid"],[[70856,70863],"disallowed"],[[70864,70873],"valid"],[[70874,71039],"disallowed"],[[71040,71093],"valid"],[[71094,71095],"disallowed"],[[71096,71104],"valid"],[[71105,71113],"valid",[],"NV8"],[[71114,71127],"valid",[],"NV8"],[[71128,71133],"valid"],[[71134,71167],"disallowed"],[[71168,71232],"valid"],[[71233,71235],"valid",[],"NV8"],[[71236,71236],"valid"],[[71237,71247],"disallowed"],[[71248,71257],"valid"],[[71258,71295],"disallowed"],[[71296,71351],"valid"],[[71352,71359],"disallowed"],[[71360,71369],"valid"],[[71370,71423],"disallowed"],[[71424,71449],"valid"],[[71450,71452],"disallowed"],[[71453,71467],"valid"],[[71468,71471],"disallowed"],[[71472,71481],"valid"],[[71482,71487],"valid",[],"NV8"],[[71488,71839],"disallowed"],[[71840,71840],"mapped",[71872]],[[71841,71841],"mapped",[71873]],[[71842,71842],"mapped",[71874]],[[71843,71843],"mapped",[71875]],[[71844,71844],"mapped",[71876]],[[71845,71845],"mapped",[71877]],[[71846,71846],"mapped",[71878]],[[71847,71847],"mapped",[71879]],[[71848,71848],"mapped",[71880]],[[71849,71849],"mapped",[71881]],[[71850,71850],"mapped",[71882]],[[71851,71851],"mapped",[71883]],[[71852,71852],"mapped",[71884]],[[71853,71853],"mapped",[71885]],[[71854,71854],"mapped",[71886]],[[71855,71855],"mapped",[71887]],[[71856,71856],"mapped",[71888]],[[71857,71857],"mapped",[71889]],[[71858,71858],"mapped",[71890]],[[71859,71859],"mapped",[71891]],[[71860,71860],"mapped",[71892]],[[71861,71861],"mapped",[71893]],[[71862,71862],"mapped",[71894]],[[71863,71863],"mapped",[71895]],[[71864,71864],"mapped",[71896]],[[71865,71865],"mapped",[71897]],[[71866,71866],"mapped",[71898]],[[71867,71867],"mapped",[71899]],[[71868,71868],"mapped",[71900]],[[71869,71869],"mapped",[71901]],[[71870,71870],"mapped",[71902]],[[71871,71871],"mapped",[71903]],[[71872,71913],"valid"],[[71914,71922],"valid",[],"NV8"],[[71923,71934],"disallowed"],[[71935,71935],"valid"],[[71936,72383],"disallowed"],[[72384,72440],"valid"],[[72441,73727],"disallowed"],[[73728,74606],"valid"],[[74607,74648],"valid"],[[74649,74649],"valid"],[[74650,74751],"disallowed"],[[74752,74850],"valid",[],"NV8"],[[74851,74862],"valid",[],"NV8"],[[74863,74863],"disallowed"],[[74864,74867],"valid",[],"NV8"],[[74868,74868],"valid",[],"NV8"],[[74869,74879],"disallowed"],[[74880,75075],"valid"],[[75076,77823],"disallowed"],[[77824,78894],"valid"],[[78895,82943],"disallowed"],[[82944,83526],"valid"],[[83527,92159],"disallowed"],[[92160,92728],"valid"],[[92729,92735],"disallowed"],[[92736,92766],"valid"],[[92767,92767],"disallowed"],[[92768,92777],"valid"],[[92778,92781],"disallowed"],[[92782,92783],"valid",[],"NV8"],[[92784,92879],"disallowed"],[[92880,92909],"valid"],[[92910,92911],"disallowed"],[[92912,92916],"valid"],[[92917,92917],"valid",[],"NV8"],[[92918,92927],"disallowed"],[[92928,92982],"valid"],[[92983,92991],"valid",[],"NV8"],[[92992,92995],"valid"],[[92996,92997],"valid",[],"NV8"],[[92998,93007],"disallowed"],[[93008,93017],"valid"],[[93018,93018],"disallowed"],[[93019,93025],"valid",[],"NV8"],[[93026,93026],"disallowed"],[[93027,93047],"valid"],[[93048,93052],"disallowed"],[[93053,93071],"valid"],[[93072,93951],"disallowed"],[[93952,94020],"valid"],[[94021,94031],"disallowed"],[[94032,94078],"valid"],[[94079,94094],"disallowed"],[[94095,94111],"valid"],[[94112,110591],"disallowed"],[[110592,110593],"valid"],[[110594,113663],"disallowed"],[[113664,113770],"valid"],[[113771,113775],"disallowed"],[[113776,113788],"valid"],[[113789,113791],"disallowed"],[[113792,113800],"valid"],[[113801,113807],"disallowed"],[[113808,113817],"valid"],[[113818,113819],"disallowed"],[[113820,113820],"valid",[],"NV8"],[[113821,113822],"valid"],[[113823,113823],"valid",[],"NV8"],[[113824,113827],"ignored"],[[113828,118783],"disallowed"],[[118784,119029],"valid",[],"NV8"],[[119030,119039],"disallowed"],[[119040,119078],"valid",[],"NV8"],[[119079,119080],"disallowed"],[[119081,119081],"valid",[],"NV8"],[[119082,119133],"valid",[],"NV8"],[[119134,119134],"mapped",[119127,119141]],[[119135,119135],"mapped",[119128,119141]],[[119136,119136],"mapped",[119128,119141,119150]],[[119137,119137],"mapped",[119128,119141,119151]],[[119138,119138],"mapped",[119128,119141,119152]],[[119139,119139],"mapped",[119128,119141,119153]],[[119140,119140],"mapped",[119128,119141,119154]],[[119141,119154],"valid",[],"NV8"],[[119155,119162],"disallowed"],[[119163,119226],"valid",[],"NV8"],[[119227,119227],"mapped",[119225,119141]],[[119228,119228],"mapped",[119226,119141]],[[119229,119229],"mapped",[119225,119141,119150]],[[119230,119230],"mapped",[119226,119141,119150]],[[119231,119231],"mapped",[119225,119141,119151]],[[119232,119232],"mapped",[119226,119141,119151]],[[119233,119261],"valid",[],"NV8"],[[119262,119272],"valid",[],"NV8"],[[119273,119295],"disallowed"],[[119296,119365],"valid",[],"NV8"],[[119366,119551],"disallowed"],[[119552,119638],"valid",[],"NV8"],[[119639,119647],"disallowed"],[[119648,119665],"valid",[],"NV8"],[[119666,119807],"disallowed"],[[119808,119808],"mapped",[97]],[[119809,119809],"mapped",[98]],[[119810,119810],"mapped",[99]],[[119811,119811],"mapped",[100]],[[119812,119812],"mapped",[101]],[[119813,119813],"mapped",[102]],[[119814,119814],"mapped",[103]],[[119815,119815],"mapped",[104]],[[119816,119816],"mapped",[105]],[[119817,119817],"mapped",[106]],[[119818,119818],"mapped",[107]],[[119819,119819],"mapped",[108]],[[119820,119820],"mapped",[109]],[[119821,119821],"mapped",[110]],[[119822,119822],"mapped",[111]],[[119823,119823],"mapped",[112]],[[119824,119824],"mapped",[113]],[[119825,119825],"mapped",[114]],[[119826,119826],"mapped",[115]],[[119827,119827],"mapped",[116]],[[119828,119828],"mapped",[117]],[[119829,119829],"mapped",[118]],[[119830,119830],"mapped",[119]],[[119831,119831],"mapped",[120]],[[119832,119832],"mapped",[121]],[[119833,119833],"mapped",[122]],[[119834,119834],"mapped",[97]],[[119835,119835],"mapped",[98]],[[119836,119836],"mapped",[99]],[[119837,119837],"mapped",[100]],[[119838,119838],"mapped",[101]],[[119839,119839],"mapped",[102]],[[119840,119840],"mapped",[103]],[[119841,119841],"mapped",[104]],[[119842,119842],"mapped",[105]],[[119843,119843],"mapped",[106]],[[119844,119844],"mapped",[107]],[[119845,119845],"mapped",[108]],[[119846,119846],"mapped",[109]],[[119847,119847],"mapped",[110]],[[119848,119848],"mapped",[111]],[[119849,119849],"mapped",[112]],[[119850,119850],"mapped",[113]],[[119851,119851],"mapped",[114]],[[119852,119852],"mapped",[115]],[[119853,119853],"mapped",[116]],[[119854,119854],"mapped",[117]],[[119855,119855],"mapped",[118]],[[119856,119856],"mapped",[119]],[[119857,119857],"mapped",[120]],[[119858,119858],"mapped",[121]],[[119859,119859],"mapped",[122]],[[119860,119860],"mapped",[97]],[[119861,119861],"mapped",[98]],[[119862,119862],"mapped",[99]],[[119863,119863],"mapped",[100]],[[119864,119864],"mapped",[101]],[[119865,119865],"mapped",[102]],[[119866,119866],"mapped",[103]],[[119867,119867],"mapped",[104]],[[119868,119868],"mapped",[105]],[[119869,119869],"mapped",[106]],[[119870,119870],"mapped",[107]],[[119871,119871],"mapped",[108]],[[119872,119872],"mapped",[109]],[[119873,119873],"mapped",[110]],[[119874,119874],"mapped",[111]],[[119875,119875],"mapped",[112]],[[119876,119876],"mapped",[113]],[[119877,119877],"mapped",[114]],[[119878,119878],"mapped",[115]],[[119879,119879],"mapped",[116]],[[119880,119880],"mapped",[117]],[[119881,119881],"mapped",[118]],[[119882,119882],"mapped",[119]],[[119883,119883],"mapped",[120]],[[119884,119884],"mapped",[121]],[[119885,119885],"mapped",[122]],[[119886,119886],"mapped",[97]],[[119887,119887],"mapped",[98]],[[119888,119888],"mapped",[99]],[[119889,119889],"mapped",[100]],[[119890,119890],"mapped",[101]],[[119891,119891],"mapped",[102]],[[119892,119892],"mapped",[103]],[[119893,119893],"disallowed"],[[119894,119894],"mapped",[105]],[[119895,119895],"mapped",[106]],[[119896,119896],"mapped",[107]],[[119897,119897],"mapped",[108]],[[119898,119898],"mapped",[109]],[[119899,119899],"mapped",[110]],[[119900,119900],"mapped",[111]],[[119901,119901],"mapped",[112]],[[119902,119902],"mapped",[113]],[[119903,119903],"mapped",[114]],[[119904,119904],"mapped",[115]],[[119905,119905],"mapped",[116]],[[119906,119906],"mapped",[117]],[[119907,119907],"mapped",[118]],[[119908,119908],"mapped",[119]],[[119909,119909],"mapped",[120]],[[119910,119910],"mapped",[121]],[[119911,119911],"mapped",[122]],[[119912,119912],"mapped",[97]],[[119913,119913],"mapped",[98]],[[119914,119914],"mapped",[99]],[[119915,119915],"mapped",[100]],[[119916,119916],"mapped",[101]],[[119917,119917],"mapped",[102]],[[119918,119918],"mapped",[103]],[[119919,119919],"mapped",[104]],[[119920,119920],"mapped",[105]],[[119921,119921],"mapped",[106]],[[119922,119922],"mapped",[107]],[[119923,119923],"mapped",[108]],[[119924,119924],"mapped",[109]],[[119925,119925],"mapped",[110]],[[119926,119926],"mapped",[111]],[[119927,119927],"mapped",[112]],[[119928,119928],"mapped",[113]],[[119929,119929],"mapped",[114]],[[119930,119930],"mapped",[115]],[[119931,119931],"mapped",[116]],[[119932,119932],"mapped",[117]],[[119933,119933],"mapped",[118]],[[119934,119934],"mapped",[119]],[[119935,119935],"mapped",[120]],[[119936,119936],"mapped",[121]],[[119937,119937],"mapped",[122]],[[119938,119938],"mapped",[97]],[[119939,119939],"mapped",[98]],[[119940,119940],"mapped",[99]],[[119941,119941],"mapped",[100]],[[119942,119942],"mapped",[101]],[[119943,119943],"mapped",[102]],[[119944,119944],"mapped",[103]],[[119945,119945],"mapped",[104]],[[119946,119946],"mapped",[105]],[[119947,119947],"mapped",[106]],[[119948,119948],"mapped",[107]],[[119949,119949],"mapped",[108]],[[119950,119950],"mapped",[109]],[[119951,119951],"mapped",[110]],[[119952,119952],"mapped",[111]],[[119953,119953],"mapped",[112]],[[119954,119954],"mapped",[113]],[[119955,119955],"mapped",[114]],[[119956,119956],"mapped",[115]],[[119957,119957],"mapped",[116]],[[119958,119958],"mapped",[117]],[[119959,119959],"mapped",[118]],[[119960,119960],"mapped",[119]],[[119961,119961],"mapped",[120]],[[119962,119962],"mapped",[121]],[[119963,119963],"mapped",[122]],[[119964,119964],"mapped",[97]],[[119965,119965],"disallowed"],[[119966,119966],"mapped",[99]],[[119967,119967],"mapped",[100]],[[119968,119969],"disallowed"],[[119970,119970],"mapped",[103]],[[119971,119972],"disallowed"],[[119973,119973],"mapped",[106]],[[119974,119974],"mapped",[107]],[[119975,119976],"disallowed"],[[119977,119977],"mapped",[110]],[[119978,119978],"mapped",[111]],[[119979,119979],"mapped",[112]],[[119980,119980],"mapped",[113]],[[119981,119981],"disallowed"],[[119982,119982],"mapped",[115]],[[119983,119983],"mapped",[116]],[[119984,119984],"mapped",[117]],[[119985,119985],"mapped",[118]],[[119986,119986],"mapped",[119]],[[119987,119987],"mapped",[120]],[[119988,119988],"mapped",[121]],[[119989,119989],"mapped",[122]],[[119990,119990],"mapped",[97]],[[119991,119991],"mapped",[98]],[[119992,119992],"mapped",[99]],[[119993,119993],"mapped",[100]],[[119994,119994],"disallowed"],[[119995,119995],"mapped",[102]],[[119996,119996],"disallowed"],[[119997,119997],"mapped",[104]],[[119998,119998],"mapped",[105]],[[119999,119999],"mapped",[106]],[[12e4,12e4],"mapped",[107]],[[120001,120001],"mapped",[108]],[[120002,120002],"mapped",[109]],[[120003,120003],"mapped",[110]],[[120004,120004],"disallowed"],[[120005,120005],"mapped",[112]],[[120006,120006],"mapped",[113]],[[120007,120007],"mapped",[114]],[[120008,120008],"mapped",[115]],[[120009,120009],"mapped",[116]],[[120010,120010],"mapped",[117]],[[120011,120011],"mapped",[118]],[[120012,120012],"mapped",[119]],[[120013,120013],"mapped",[120]],[[120014,120014],"mapped",[121]],[[120015,120015],"mapped",[122]],[[120016,120016],"mapped",[97]],[[120017,120017],"mapped",[98]],[[120018,120018],"mapped",[99]],[[120019,120019],"mapped",[100]],[[120020,120020],"mapped",[101]],[[120021,120021],"mapped",[102]],[[120022,120022],"mapped",[103]],[[120023,120023],"mapped",[104]],[[120024,120024],"mapped",[105]],[[120025,120025],"mapped",[106]],[[120026,120026],"mapped",[107]],[[120027,120027],"mapped",[108]],[[120028,120028],"mapped",[109]],[[120029,120029],"mapped",[110]],[[120030,120030],"mapped",[111]],[[120031,120031],"mapped",[112]],[[120032,120032],"mapped",[113]],[[120033,120033],"mapped",[114]],[[120034,120034],"mapped",[115]],[[120035,120035],"mapped",[116]],[[120036,120036],"mapped",[117]],[[120037,120037],"mapped",[118]],[[120038,120038],"mapped",[119]],[[120039,120039],"mapped",[120]],[[120040,120040],"mapped",[121]],[[120041,120041],"mapped",[122]],[[120042,120042],"mapped",[97]],[[120043,120043],"mapped",[98]],[[120044,120044],"mapped",[99]],[[120045,120045],"mapped",[100]],[[120046,120046],"mapped",[101]],[[120047,120047],"mapped",[102]],[[120048,120048],"mapped",[103]],[[120049,120049],"mapped",[104]],[[120050,120050],"mapped",[105]],[[120051,120051],"mapped",[106]],[[120052,120052],"mapped",[107]],[[120053,120053],"mapped",[108]],[[120054,120054],"mapped",[109]],[[120055,120055],"mapped",[110]],[[120056,120056],"mapped",[111]],[[120057,120057],"mapped",[112]],[[120058,120058],"mapped",[113]],[[120059,120059],"mapped",[114]],[[120060,120060],"mapped",[115]],[[120061,120061],"mapped",[116]],[[120062,120062],"mapped",[117]],[[120063,120063],"mapped",[118]],[[120064,120064],"mapped",[119]],[[120065,120065],"mapped",[120]],[[120066,120066],"mapped",[121]],[[120067,120067],"mapped",[122]],[[120068,120068],"mapped",[97]],[[120069,120069],"mapped",[98]],[[120070,120070],"disallowed"],[[120071,120071],"mapped",[100]],[[120072,120072],"mapped",[101]],[[120073,120073],"mapped",[102]],[[120074,120074],"mapped",[103]],[[120075,120076],"disallowed"],[[120077,120077],"mapped",[106]],[[120078,120078],"mapped",[107]],[[120079,120079],"mapped",[108]],[[120080,120080],"mapped",[109]],[[120081,120081],"mapped",[110]],[[120082,120082],"mapped",[111]],[[120083,120083],"mapped",[112]],[[120084,120084],"mapped",[113]],[[120085,120085],"disallowed"],[[120086,120086],"mapped",[115]],[[120087,120087],"mapped",[116]],[[120088,120088],"mapped",[117]],[[120089,120089],"mapped",[118]],[[120090,120090],"mapped",[119]],[[120091,120091],"mapped",[120]],[[120092,120092],"mapped",[121]],[[120093,120093],"disallowed"],[[120094,120094],"mapped",[97]],[[120095,120095],"mapped",[98]],[[120096,120096],"mapped",[99]],[[120097,120097],"mapped",[100]],[[120098,120098],"mapped",[101]],[[120099,120099],"mapped",[102]],[[120100,120100],"mapped",[103]],[[120101,120101],"mapped",[104]],[[120102,120102],"mapped",[105]],[[120103,120103],"mapped",[106]],[[120104,120104],"mapped",[107]],[[120105,120105],"mapped",[108]],[[120106,120106],"mapped",[109]],[[120107,120107],"mapped",[110]],[[120108,120108],"mapped",[111]],[[120109,120109],"mapped",[112]],[[120110,120110],"mapped",[113]],[[120111,120111],"mapped",[114]],[[120112,120112],"mapped",[115]],[[120113,120113],"mapped",[116]],[[120114,120114],"mapped",[117]],[[120115,120115],"mapped",[118]],[[120116,120116],"mapped",[119]],[[120117,120117],"mapped",[120]],[[120118,120118],"mapped",[121]],[[120119,120119],"mapped",[122]],[[120120,120120],"mapped",[97]],[[120121,120121],"mapped",[98]],[[120122,120122],"disallowed"],[[120123,120123],"mapped",[100]],[[120124,120124],"mapped",[101]],[[120125,120125],"mapped",[102]],[[120126,120126],"mapped",[103]],[[120127,120127],"disallowed"],[[120128,120128],"mapped",[105]],[[120129,120129],"mapped",[106]],[[120130,120130],"mapped",[107]],[[120131,120131],"mapped",[108]],[[120132,120132],"mapped",[109]],[[120133,120133],"disallowed"],[[120134,120134],"mapped",[111]],[[120135,120137],"disallowed"],[[120138,120138],"mapped",[115]],[[120139,120139],"mapped",[116]],[[120140,120140],"mapped",[117]],[[120141,120141],"mapped",[118]],[[120142,120142],"mapped",[119]],[[120143,120143],"mapped",[120]],[[120144,120144],"mapped",[121]],[[120145,120145],"disallowed"],[[120146,120146],"mapped",[97]],[[120147,120147],"mapped",[98]],[[120148,120148],"mapped",[99]],[[120149,120149],"mapped",[100]],[[120150,120150],"mapped",[101]],[[120151,120151],"mapped",[102]],[[120152,120152],"mapped",[103]],[[120153,120153],"mapped",[104]],[[120154,120154],"mapped",[105]],[[120155,120155],"mapped",[106]],[[120156,120156],"mapped",[107]],[[120157,120157],"mapped",[108]],[[120158,120158],"mapped",[109]],[[120159,120159],"mapped",[110]],[[120160,120160],"mapped",[111]],[[120161,120161],"mapped",[112]],[[120162,120162],"mapped",[113]],[[120163,120163],"mapped",[114]],[[120164,120164],"mapped",[115]],[[120165,120165],"mapped",[116]],[[120166,120166],"mapped",[117]],[[120167,120167],"mapped",[118]],[[120168,120168],"mapped",[119]],[[120169,120169],"mapped",[120]],[[120170,120170],"mapped",[121]],[[120171,120171],"mapped",[122]],[[120172,120172],"mapped",[97]],[[120173,120173],"mapped",[98]],[[120174,120174],"mapped",[99]],[[120175,120175],"mapped",[100]],[[120176,120176],"mapped",[101]],[[120177,120177],"mapped",[102]],[[120178,120178],"mapped",[103]],[[120179,120179],"mapped",[104]],[[120180,120180],"mapped",[105]],[[120181,120181],"mapped",[106]],[[120182,120182],"mapped",[107]],[[120183,120183],"mapped",[108]],[[120184,120184],"mapped",[109]],[[120185,120185],"mapped",[110]],[[120186,120186],"mapped",[111]],[[120187,120187],"mapped",[112]],[[120188,120188],"mapped",[113]],[[120189,120189],"mapped",[114]],[[120190,120190],"mapped",[115]],[[120191,120191],"mapped",[116]],[[120192,120192],"mapped",[117]],[[120193,120193],"mapped",[118]],[[120194,120194],"mapped",[119]],[[120195,120195],"mapped",[120]],[[120196,120196],"mapped",[121]],[[120197,120197],"mapped",[122]],[[120198,120198],"mapped",[97]],[[120199,120199],"mapped",[98]],[[120200,120200],"mapped",[99]],[[120201,120201],"mapped",[100]],[[120202,120202],"mapped",[101]],[[120203,120203],"mapped",[102]],[[120204,120204],"mapped",[103]],[[120205,120205],"mapped",[104]],[[120206,120206],"mapped",[105]],[[120207,120207],"mapped",[106]],[[120208,120208],"mapped",[107]],[[120209,120209],"mapped",[108]],[[120210,120210],"mapped",[109]],[[120211,120211],"mapped",[110]],[[120212,120212],"mapped",[111]],[[120213,120213],"mapped",[112]],[[120214,120214],"mapped",[113]],[[120215,120215],"mapped",[114]],[[120216,120216],"mapped",[115]],[[120217,120217],"mapped",[116]],[[120218,120218],"mapped",[117]],[[120219,120219],"mapped",[118]],[[120220,120220],"mapped",[119]],[[120221,120221],"mapped",[120]],[[120222,120222],"mapped",[121]],[[120223,120223],"mapped",[122]],[[120224,120224],"mapped",[97]],[[120225,120225],"mapped",[98]],[[120226,120226],"mapped",[99]],[[120227,120227],"mapped",[100]],[[120228,120228],"mapped",[101]],[[120229,120229],"mapped",[102]],[[120230,120230],"mapped",[103]],[[120231,120231],"mapped",[104]],[[120232,120232],"mapped",[105]],[[120233,120233],"mapped",[106]],[[120234,120234],"mapped",[107]],[[120235,120235],"mapped",[108]],[[120236,120236],"mapped",[109]],[[120237,120237],"mapped",[110]],[[120238,120238],"mapped",[111]],[[120239,120239],"mapped",[112]],[[120240,120240],"mapped",[113]],[[120241,120241],"mapped",[114]],[[120242,120242],"mapped",[115]],[[120243,120243],"mapped",[116]],[[120244,120244],"mapped",[117]],[[120245,120245],"mapped",[118]],[[120246,120246],"mapped",[119]],[[120247,120247],"mapped",[120]],[[120248,120248],"mapped",[121]],[[120249,120249],"mapped",[122]],[[120250,120250],"mapped",[97]],[[120251,120251],"mapped",[98]],[[120252,120252],"mapped",[99]],[[120253,120253],"mapped",[100]],[[120254,120254],"mapped",[101]],[[120255,120255],"mapped",[102]],[[120256,120256],"mapped",[103]],[[120257,120257],"mapped",[104]],[[120258,120258],"mapped",[105]],[[120259,120259],"mapped",[106]],[[120260,120260],"mapped",[107]],[[120261,120261],"mapped",[108]],[[120262,120262],"mapped",[109]],[[120263,120263],"mapped",[110]],[[120264,120264],"mapped",[111]],[[120265,120265],"mapped",[112]],[[120266,120266],"mapped",[113]],[[120267,120267],"mapped",[114]],[[120268,120268],"mapped",[115]],[[120269,120269],"mapped",[116]],[[120270,120270],"mapped",[117]],[[120271,120271],"mapped",[118]],[[120272,120272],"mapped",[119]],[[120273,120273],"mapped",[120]],[[120274,120274],"mapped",[121]],[[120275,120275],"mapped",[122]],[[120276,120276],"mapped",[97]],[[120277,120277],"mapped",[98]],[[120278,120278],"mapped",[99]],[[120279,120279],"mapped",[100]],[[120280,120280],"mapped",[101]],[[120281,120281],"mapped",[102]],[[120282,120282],"mapped",[103]],[[120283,120283],"mapped",[104]],[[120284,120284],"mapped",[105]],[[120285,120285],"mapped",[106]],[[120286,120286],"mapped",[107]],[[120287,120287],"mapped",[108]],[[120288,120288],"mapped",[109]],[[120289,120289],"mapped",[110]],[[120290,120290],"mapped",[111]],[[120291,120291],"mapped",[112]],[[120292,120292],"mapped",[113]],[[120293,120293],"mapped",[114]],[[120294,120294],"mapped",[115]],[[120295,120295],"mapped",[116]],[[120296,120296],"mapped",[117]],[[120297,120297],"mapped",[118]],[[120298,120298],"mapped",[119]],[[120299,120299],"mapped",[120]],[[120300,120300],"mapped",[121]],[[120301,120301],"mapped",[122]],[[120302,120302],"mapped",[97]],[[120303,120303],"mapped",[98]],[[120304,120304],"mapped",[99]],[[120305,120305],"mapped",[100]],[[120306,120306],"mapped",[101]],[[120307,120307],"mapped",[102]],[[120308,120308],"mapped",[103]],[[120309,120309],"mapped",[104]],[[120310,120310],"mapped",[105]],[[120311,120311],"mapped",[106]],[[120312,120312],"mapped",[107]],[[120313,120313],"mapped",[108]],[[120314,120314],"mapped",[109]],[[120315,120315],"mapped",[110]],[[120316,120316],"mapped",[111]],[[120317,120317],"mapped",[112]],[[120318,120318],"mapped",[113]],[[120319,120319],"mapped",[114]],[[120320,120320],"mapped",[115]],[[120321,120321],"mapped",[116]],[[120322,120322],"mapped",[117]],[[120323,120323],"mapped",[118]],[[120324,120324],"mapped",[119]],[[120325,120325],"mapped",[120]],[[120326,120326],"mapped",[121]],[[120327,120327],"mapped",[122]],[[120328,120328],"mapped",[97]],[[120329,120329],"mapped",[98]],[[120330,120330],"mapped",[99]],[[120331,120331],"mapped",[100]],[[120332,120332],"mapped",[101]],[[120333,120333],"mapped",[102]],[[120334,120334],"mapped",[103]],[[120335,120335],"mapped",[104]],[[120336,120336],"mapped",[105]],[[120337,120337],"mapped",[106]],[[120338,120338],"mapped",[107]],[[120339,120339],"mapped",[108]],[[120340,120340],"mapped",[109]],[[120341,120341],"mapped",[110]],[[120342,120342],"mapped",[111]],[[120343,120343],"mapped",[112]],[[120344,120344],"mapped",[113]],[[120345,120345],"mapped",[114]],[[120346,120346],"mapped",[115]],[[120347,120347],"mapped",[116]],[[120348,120348],"mapped",[117]],[[120349,120349],"mapped",[118]],[[120350,120350],"mapped",[119]],[[120351,120351],"mapped",[120]],[[120352,120352],"mapped",[121]],[[120353,120353],"mapped",[122]],[[120354,120354],"mapped",[97]],[[120355,120355],"mapped",[98]],[[120356,120356],"mapped",[99]],[[120357,120357],"mapped",[100]],[[120358,120358],"mapped",[101]],[[120359,120359],"mapped",[102]],[[120360,120360],"mapped",[103]],[[120361,120361],"mapped",[104]],[[120362,120362],"mapped",[105]],[[120363,120363],"mapped",[106]],[[120364,120364],"mapped",[107]],[[120365,120365],"mapped",[108]],[[120366,120366],"mapped",[109]],[[120367,120367],"mapped",[110]],[[120368,120368],"mapped",[111]],[[120369,120369],"mapped",[112]],[[120370,120370],"mapped",[113]],[[120371,120371],"mapped",[114]],[[120372,120372],"mapped",[115]],[[120373,120373],"mapped",[116]],[[120374,120374],"mapped",[117]],[[120375,120375],"mapped",[118]],[[120376,120376],"mapped",[119]],[[120377,120377],"mapped",[120]],[[120378,120378],"mapped",[121]],[[120379,120379],"mapped",[122]],[[120380,120380],"mapped",[97]],[[120381,120381],"mapped",[98]],[[120382,120382],"mapped",[99]],[[120383,120383],"mapped",[100]],[[120384,120384],"mapped",[101]],[[120385,120385],"mapped",[102]],[[120386,120386],"mapped",[103]],[[120387,120387],"mapped",[104]],[[120388,120388],"mapped",[105]],[[120389,120389],"mapped",[106]],[[120390,120390],"mapped",[107]],[[120391,120391],"mapped",[108]],[[120392,120392],"mapped",[109]],[[120393,120393],"mapped",[110]],[[120394,120394],"mapped",[111]],[[120395,120395],"mapped",[112]],[[120396,120396],"mapped",[113]],[[120397,120397],"mapped",[114]],[[120398,120398],"mapped",[115]],[[120399,120399],"mapped",[116]],[[120400,120400],"mapped",[117]],[[120401,120401],"mapped",[118]],[[120402,120402],"mapped",[119]],[[120403,120403],"mapped",[120]],[[120404,120404],"mapped",[121]],[[120405,120405],"mapped",[122]],[[120406,120406],"mapped",[97]],[[120407,120407],"mapped",[98]],[[120408,120408],"mapped",[99]],[[120409,120409],"mapped",[100]],[[120410,120410],"mapped",[101]],[[120411,120411],"mapped",[102]],[[120412,120412],"mapped",[103]],[[120413,120413],"mapped",[104]],[[120414,120414],"mapped",[105]],[[120415,120415],"mapped",[106]],[[120416,120416],"mapped",[107]],[[120417,120417],"mapped",[108]],[[120418,120418],"mapped",[109]],[[120419,120419],"mapped",[110]],[[120420,120420],"mapped",[111]],[[120421,120421],"mapped",[112]],[[120422,120422],"mapped",[113]],[[120423,120423],"mapped",[114]],[[120424,120424],"mapped",[115]],[[120425,120425],"mapped",[116]],[[120426,120426],"mapped",[117]],[[120427,120427],"mapped",[118]],[[120428,120428],"mapped",[119]],[[120429,120429],"mapped",[120]],[[120430,120430],"mapped",[121]],[[120431,120431],"mapped",[122]],[[120432,120432],"mapped",[97]],[[120433,120433],"mapped",[98]],[[120434,120434],"mapped",[99]],[[120435,120435],"mapped",[100]],[[120436,120436],"mapped",[101]],[[120437,120437],"mapped",[102]],[[120438,120438],"mapped",[103]],[[120439,120439],"mapped",[104]],[[120440,120440],"mapped",[105]],[[120441,120441],"mapped",[106]],[[120442,120442],"mapped",[107]],[[120443,120443],"mapped",[108]],[[120444,120444],"mapped",[109]],[[120445,120445],"mapped",[110]],[[120446,120446],"mapped",[111]],[[120447,120447],"mapped",[112]],[[120448,120448],"mapped",[113]],[[120449,120449],"mapped",[114]],[[120450,120450],"mapped",[115]],[[120451,120451],"mapped",[116]],[[120452,120452],"mapped",[117]],[[120453,120453],"mapped",[118]],[[120454,120454],"mapped",[119]],[[120455,120455],"mapped",[120]],[[120456,120456],"mapped",[121]],[[120457,120457],"mapped",[122]],[[120458,120458],"mapped",[97]],[[120459,120459],"mapped",[98]],[[120460,120460],"mapped",[99]],[[120461,120461],"mapped",[100]],[[120462,120462],"mapped",[101]],[[120463,120463],"mapped",[102]],[[120464,120464],"mapped",[103]],[[120465,120465],"mapped",[104]],[[120466,120466],"mapped",[105]],[[120467,120467],"mapped",[106]],[[120468,120468],"mapped",[107]],[[120469,120469],"mapped",[108]],[[120470,120470],"mapped",[109]],[[120471,120471],"mapped",[110]],[[120472,120472],"mapped",[111]],[[120473,120473],"mapped",[112]],[[120474,120474],"mapped",[113]],[[120475,120475],"mapped",[114]],[[120476,120476],"mapped",[115]],[[120477,120477],"mapped",[116]],[[120478,120478],"mapped",[117]],[[120479,120479],"mapped",[118]],[[120480,120480],"mapped",[119]],[[120481,120481],"mapped",[120]],[[120482,120482],"mapped",[121]],[[120483,120483],"mapped",[122]],[[120484,120484],"mapped",[305]],[[120485,120485],"mapped",[567]],[[120486,120487],"disallowed"],[[120488,120488],"mapped",[945]],[[120489,120489],"mapped",[946]],[[120490,120490],"mapped",[947]],[[120491,120491],"mapped",[948]],[[120492,120492],"mapped",[949]],[[120493,120493],"mapped",[950]],[[120494,120494],"mapped",[951]],[[120495,120495],"mapped",[952]],[[120496,120496],"mapped",[953]],[[120497,120497],"mapped",[954]],[[120498,120498],"mapped",[955]],[[120499,120499],"mapped",[956]],[[120500,120500],"mapped",[957]],[[120501,120501],"mapped",[958]],[[120502,120502],"mapped",[959]],[[120503,120503],"mapped",[960]],[[120504,120504],"mapped",[961]],[[120505,120505],"mapped",[952]],[[120506,120506],"mapped",[963]],[[120507,120507],"mapped",[964]],[[120508,120508],"mapped",[965]],[[120509,120509],"mapped",[966]],[[120510,120510],"mapped",[967]],[[120511,120511],"mapped",[968]],[[120512,120512],"mapped",[969]],[[120513,120513],"mapped",[8711]],[[120514,120514],"mapped",[945]],[[120515,120515],"mapped",[946]],[[120516,120516],"mapped",[947]],[[120517,120517],"mapped",[948]],[[120518,120518],"mapped",[949]],[[120519,120519],"mapped",[950]],[[120520,120520],"mapped",[951]],[[120521,120521],"mapped",[952]],[[120522,120522],"mapped",[953]],[[120523,120523],"mapped",[954]],[[120524,120524],"mapped",[955]],[[120525,120525],"mapped",[956]],[[120526,120526],"mapped",[957]],[[120527,120527],"mapped",[958]],[[120528,120528],"mapped",[959]],[[120529,120529],"mapped",[960]],[[120530,120530],"mapped",[961]],[[120531,120532],"mapped",[963]],[[120533,120533],"mapped",[964]],[[120534,120534],"mapped",[965]],[[120535,120535],"mapped",[966]],[[120536,120536],"mapped",[967]],[[120537,120537],"mapped",[968]],[[120538,120538],"mapped",[969]],[[120539,120539],"mapped",[8706]],[[120540,120540],"mapped",[949]],[[120541,120541],"mapped",[952]],[[120542,120542],"mapped",[954]],[[120543,120543],"mapped",[966]],[[120544,120544],"mapped",[961]],[[120545,120545],"mapped",[960]],[[120546,120546],"mapped",[945]],[[120547,120547],"mapped",[946]],[[120548,120548],"mapped",[947]],[[120549,120549],"mapped",[948]],[[120550,120550],"mapped",[949]],[[120551,120551],"mapped",[950]],[[120552,120552],"mapped",[951]],[[120553,120553],"mapped",[952]],[[120554,120554],"mapped",[953]],[[120555,120555],"mapped",[954]],[[120556,120556],"mapped",[955]],[[120557,120557],"mapped",[956]],[[120558,120558],"mapped",[957]],[[120559,120559],"mapped",[958]],[[120560,120560],"mapped",[959]],[[120561,120561],"mapped",[960]],[[120562,120562],"mapped",[961]],[[120563,120563],"mapped",[952]],[[120564,120564],"mapped",[963]],[[120565,120565],"mapped",[964]],[[120566,120566],"mapped",[965]],[[120567,120567],"mapped",[966]],[[120568,120568],"mapped",[967]],[[120569,120569],"mapped",[968]],[[120570,120570],"mapped",[969]],[[120571,120571],"mapped",[8711]],[[120572,120572],"mapped",[945]],[[120573,120573],"mapped",[946]],[[120574,120574],"mapped",[947]],[[120575,120575],"mapped",[948]],[[120576,120576],"mapped",[949]],[[120577,120577],"mapped",[950]],[[120578,120578],"mapped",[951]],[[120579,120579],"mapped",[952]],[[120580,120580],"mapped",[953]],[[120581,120581],"mapped",[954]],[[120582,120582],"mapped",[955]],[[120583,120583],"mapped",[956]],[[120584,120584],"mapped",[957]],[[120585,120585],"mapped",[958]],[[120586,120586],"mapped",[959]],[[120587,120587],"mapped",[960]],[[120588,120588],"mapped",[961]],[[120589,120590],"mapped",[963]],[[120591,120591],"mapped",[964]],[[120592,120592],"mapped",[965]],[[120593,120593],"mapped",[966]],[[120594,120594],"mapped",[967]],[[120595,120595],"mapped",[968]],[[120596,120596],"mapped",[969]],[[120597,120597],"mapped",[8706]],[[120598,120598],"mapped",[949]],[[120599,120599],"mapped",[952]],[[120600,120600],"mapped",[954]],[[120601,120601],"mapped",[966]],[[120602,120602],"mapped",[961]],[[120603,120603],"mapped",[960]],[[120604,120604],"mapped",[945]],[[120605,120605],"mapped",[946]],[[120606,120606],"mapped",[947]],[[120607,120607],"mapped",[948]],[[120608,120608],"mapped",[949]],[[120609,120609],"mapped",[950]],[[120610,120610],"mapped",[951]],[[120611,120611],"mapped",[952]],[[120612,120612],"mapped",[953]],[[120613,120613],"mapped",[954]],[[120614,120614],"mapped",[955]],[[120615,120615],"mapped",[956]],[[120616,120616],"mapped",[957]],[[120617,120617],"mapped",[958]],[[120618,120618],"mapped",[959]],[[120619,120619],"mapped",[960]],[[120620,120620],"mapped",[961]],[[120621,120621],"mapped",[952]],[[120622,120622],"mapped",[963]],[[120623,120623],"mapped",[964]],[[120624,120624],"mapped",[965]],[[120625,120625],"mapped",[966]],[[120626,120626],"mapped",[967]],[[120627,120627],"mapped",[968]],[[120628,120628],"mapped",[969]],[[120629,120629],"mapped",[8711]],[[120630,120630],"mapped",[945]],[[120631,120631],"mapped",[946]],[[120632,120632],"mapped",[947]],[[120633,120633],"mapped",[948]],[[120634,120634],"mapped",[949]],[[120635,120635],"mapped",[950]],[[120636,120636],"mapped",[951]],[[120637,120637],"mapped",[952]],[[120638,120638],"mapped",[953]],[[120639,120639],"mapped",[954]],[[120640,120640],"mapped",[955]],[[120641,120641],"mapped",[956]],[[120642,120642],"mapped",[957]],[[120643,120643],"mapped",[958]],[[120644,120644],"mapped",[959]],[[120645,120645],"mapped",[960]],[[120646,120646],"mapped",[961]],[[120647,120648],"mapped",[963]],[[120649,120649],"mapped",[964]],[[120650,120650],"mapped",[965]],[[120651,120651],"mapped",[966]],[[120652,120652],"mapped",[967]],[[120653,120653],"mapped",[968]],[[120654,120654],"mapped",[969]],[[120655,120655],"mapped",[8706]],[[120656,120656],"mapped",[949]],[[120657,120657],"mapped",[952]],[[120658,120658],"mapped",[954]],[[120659,120659],"mapped",[966]],[[120660,120660],"mapped",[961]],[[120661,120661],"mapped",[960]],[[120662,120662],"mapped",[945]],[[120663,120663],"mapped",[946]],[[120664,120664],"mapped",[947]],[[120665,120665],"mapped",[948]],[[120666,120666],"mapped",[949]],[[120667,120667],"mapped",[950]],[[120668,120668],"mapped",[951]],[[120669,120669],"mapped",[952]],[[120670,120670],"mapped",[953]],[[120671,120671],"mapped",[954]],[[120672,120672],"mapped",[955]],[[120673,120673],"mapped",[956]],[[120674,120674],"mapped",[957]],[[120675,120675],"mapped",[958]],[[120676,120676],"mapped",[959]],[[120677,120677],"mapped",[960]],[[120678,120678],"mapped",[961]],[[120679,120679],"mapped",[952]],[[120680,120680],"mapped",[963]],[[120681,120681],"mapped",[964]],[[120682,120682],"mapped",[965]],[[120683,120683],"mapped",[966]],[[120684,120684],"mapped",[967]],[[120685,120685],"mapped",[968]],[[120686,120686],"mapped",[969]],[[120687,120687],"mapped",[8711]],[[120688,120688],"mapped",[945]],[[120689,120689],"mapped",[946]],[[120690,120690],"mapped",[947]],[[120691,120691],"mapped",[948]],[[120692,120692],"mapped",[949]],[[120693,120693],"mapped",[950]],[[120694,120694],"mapped",[951]],[[120695,120695],"mapped",[952]],[[120696,120696],"mapped",[953]],[[120697,120697],"mapped",[954]],[[120698,120698],"mapped",[955]],[[120699,120699],"mapped",[956]],[[120700,120700],"mapped",[957]],[[120701,120701],"mapped",[958]],[[120702,120702],"mapped",[959]],[[120703,120703],"mapped",[960]],[[120704,120704],"mapped",[961]],[[120705,120706],"mapped",[963]],[[120707,120707],"mapped",[964]],[[120708,120708],"mapped",[965]],[[120709,120709],"mapped",[966]],[[120710,120710],"mapped",[967]],[[120711,120711],"mapped",[968]],[[120712,120712],"mapped",[969]],[[120713,120713],"mapped",[8706]],[[120714,120714],"mapped",[949]],[[120715,120715],"mapped",[952]],[[120716,120716],"mapped",[954]],[[120717,120717],"mapped",[966]],[[120718,120718],"mapped",[961]],[[120719,120719],"mapped",[960]],[[120720,120720],"mapped",[945]],[[120721,120721],"mapped",[946]],[[120722,120722],"mapped",[947]],[[120723,120723],"mapped",[948]],[[120724,120724],"mapped",[949]],[[120725,120725],"mapped",[950]],[[120726,120726],"mapped",[951]],[[120727,120727],"mapped",[952]],[[120728,120728],"mapped",[953]],[[120729,120729],"mapped",[954]],[[120730,120730],"mapped",[955]],[[120731,120731],"mapped",[956]],[[120732,120732],"mapped",[957]],[[120733,120733],"mapped",[958]],[[120734,120734],"mapped",[959]],[[120735,120735],"mapped",[960]],[[120736,120736],"mapped",[961]],[[120737,120737],"mapped",[952]],[[120738,120738],"mapped",[963]],[[120739,120739],"mapped",[964]],[[120740,120740],"mapped",[965]],[[120741,120741],"mapped",[966]],[[120742,120742],"mapped",[967]],[[120743,120743],"mapped",[968]],[[120744,120744],"mapped",[969]],[[120745,120745],"mapped",[8711]],[[120746,120746],"mapped",[945]],[[120747,120747],"mapped",[946]],[[120748,120748],"mapped",[947]],[[120749,120749],"mapped",[948]],[[120750,120750],"mapped",[949]],[[120751,120751],"mapped",[950]],[[120752,120752],"mapped",[951]],[[120753,120753],"mapped",[952]],[[120754,120754],"mapped",[953]],[[120755,120755],"mapped",[954]],[[120756,120756],"mapped",[955]],[[120757,120757],"mapped",[956]],[[120758,120758],"mapped",[957]],[[120759,120759],"mapped",[958]],[[120760,120760],"mapped",[959]],[[120761,120761],"mapped",[960]],[[120762,120762],"mapped",[961]],[[120763,120764],"mapped",[963]],[[120765,120765],"mapped",[964]],[[120766,120766],"mapped",[965]],[[120767,120767],"mapped",[966]],[[120768,120768],"mapped",[967]],[[120769,120769],"mapped",[968]],[[120770,120770],"mapped",[969]],[[120771,120771],"mapped",[8706]],[[120772,120772],"mapped",[949]],[[120773,120773],"mapped",[952]],[[120774,120774],"mapped",[954]],[[120775,120775],"mapped",[966]],[[120776,120776],"mapped",[961]],[[120777,120777],"mapped",[960]],[[120778,120779],"mapped",[989]],[[120780,120781],"disallowed"],[[120782,120782],"mapped",[48]],[[120783,120783],"mapped",[49]],[[120784,120784],"mapped",[50]],[[120785,120785],"mapped",[51]],[[120786,120786],"mapped",[52]],[[120787,120787],"mapped",[53]],[[120788,120788],"mapped",[54]],[[120789,120789],"mapped",[55]],[[120790,120790],"mapped",[56]],[[120791,120791],"mapped",[57]],[[120792,120792],"mapped",[48]],[[120793,120793],"mapped",[49]],[[120794,120794],"mapped",[50]],[[120795,120795],"mapped",[51]],[[120796,120796],"mapped",[52]],[[120797,120797],"mapped",[53]],[[120798,120798],"mapped",[54]],[[120799,120799],"mapped",[55]],[[120800,120800],"mapped",[56]],[[120801,120801],"mapped",[57]],[[120802,120802],"mapped",[48]],[[120803,120803],"mapped",[49]],[[120804,120804],"mapped",[50]],[[120805,120805],"mapped",[51]],[[120806,120806],"mapped",[52]],[[120807,120807],"mapped",[53]],[[120808,120808],"mapped",[54]],[[120809,120809],"mapped",[55]],[[120810,120810],"mapped",[56]],[[120811,120811],"mapped",[57]],[[120812,120812],"mapped",[48]],[[120813,120813],"mapped",[49]],[[120814,120814],"mapped",[50]],[[120815,120815],"mapped",[51]],[[120816,120816],"mapped",[52]],[[120817,120817],"mapped",[53]],[[120818,120818],"mapped",[54]],[[120819,120819],"mapped",[55]],[[120820,120820],"mapped",[56]],[[120821,120821],"mapped",[57]],[[120822,120822],"mapped",[48]],[[120823,120823],"mapped",[49]],[[120824,120824],"mapped",[50]],[[120825,120825],"mapped",[51]],[[120826,120826],"mapped",[52]],[[120827,120827],"mapped",[53]],[[120828,120828],"mapped",[54]],[[120829,120829],"mapped",[55]],[[120830,120830],"mapped",[56]],[[120831,120831],"mapped",[57]],[[120832,121343],"valid",[],"NV8"],[[121344,121398],"valid"],[[121399,121402],"valid",[],"NV8"],[[121403,121452],"valid"],[[121453,121460],"valid",[],"NV8"],[[121461,121461],"valid"],[[121462,121475],"valid",[],"NV8"],[[121476,121476],"valid"],[[121477,121483],"valid",[],"NV8"],[[121484,121498],"disallowed"],[[121499,121503],"valid"],[[121504,121504],"disallowed"],[[121505,121519],"valid"],[[121520,124927],"disallowed"],[[124928,125124],"valid"],[[125125,125126],"disallowed"],[[125127,125135],"valid",[],"NV8"],[[125136,125142],"valid"],[[125143,126463],"disallowed"],[[126464,126464],"mapped",[1575]],[[126465,126465],"mapped",[1576]],[[126466,126466],"mapped",[1580]],[[126467,126467],"mapped",[1583]],[[126468,126468],"disallowed"],[[126469,126469],"mapped",[1608]],[[126470,126470],"mapped",[1586]],[[126471,126471],"mapped",[1581]],[[126472,126472],"mapped",[1591]],[[126473,126473],"mapped",[1610]],[[126474,126474],"mapped",[1603]],[[126475,126475],"mapped",[1604]],[[126476,126476],"mapped",[1605]],[[126477,126477],"mapped",[1606]],[[126478,126478],"mapped",[1587]],[[126479,126479],"mapped",[1593]],[[126480,126480],"mapped",[1601]],[[126481,126481],"mapped",[1589]],[[126482,126482],"mapped",[1602]],[[126483,126483],"mapped",[1585]],[[126484,126484],"mapped",[1588]],[[126485,126485],"mapped",[1578]],[[126486,126486],"mapped",[1579]],[[126487,126487],"mapped",[1582]],[[126488,126488],"mapped",[1584]],[[126489,126489],"mapped",[1590]],[[126490,126490],"mapped",[1592]],[[126491,126491],"mapped",[1594]],[[126492,126492],"mapped",[1646]],[[126493,126493],"mapped",[1722]],[[126494,126494],"mapped",[1697]],[[126495,126495],"mapped",[1647]],[[126496,126496],"disallowed"],[[126497,126497],"mapped",[1576]],[[126498,126498],"mapped",[1580]],[[126499,126499],"disallowed"],[[126500,126500],"mapped",[1607]],[[126501,126502],"disallowed"],[[126503,126503],"mapped",[1581]],[[126504,126504],"disallowed"],[[126505,126505],"mapped",[1610]],[[126506,126506],"mapped",[1603]],[[126507,126507],"mapped",[1604]],[[126508,126508],"mapped",[1605]],[[126509,126509],"mapped",[1606]],[[126510,126510],"mapped",[1587]],[[126511,126511],"mapped",[1593]],[[126512,126512],"mapped",[1601]],[[126513,126513],"mapped",[1589]],[[126514,126514],"mapped",[1602]],[[126515,126515],"disallowed"],[[126516,126516],"mapped",[1588]],[[126517,126517],"mapped",[1578]],[[126518,126518],"mapped",[1579]],[[126519,126519],"mapped",[1582]],[[126520,126520],"disallowed"],[[126521,126521],"mapped",[1590]],[[126522,126522],"disallowed"],[[126523,126523],"mapped",[1594]],[[126524,126529],"disallowed"],[[126530,126530],"mapped",[1580]],[[126531,126534],"disallowed"],[[126535,126535],"mapped",[1581]],[[126536,126536],"disallowed"],[[126537,126537],"mapped",[1610]],[[126538,126538],"disallowed"],[[126539,126539],"mapped",[1604]],[[126540,126540],"disallowed"],[[126541,126541],"mapped",[1606]],[[126542,126542],"mapped",[1587]],[[126543,126543],"mapped",[1593]],[[126544,126544],"disallowed"],[[126545,126545],"mapped",[1589]],[[126546,126546],"mapped",[1602]],[[126547,126547],"disallowed"],[[126548,126548],"mapped",[1588]],[[126549,126550],"disallowed"],[[126551,126551],"mapped",[1582]],[[126552,126552],"disallowed"],[[126553,126553],"mapped",[1590]],[[126554,126554],"disallowed"],[[126555,126555],"mapped",[1594]],[[126556,126556],"disallowed"],[[126557,126557],"mapped",[1722]],[[126558,126558],"disallowed"],[[126559,126559],"mapped",[1647]],[[126560,126560],"disallowed"],[[126561,126561],"mapped",[1576]],[[126562,126562],"mapped",[1580]],[[126563,126563],"disallowed"],[[126564,126564],"mapped",[1607]],[[126565,126566],"disallowed"],[[126567,126567],"mapped",[1581]],[[126568,126568],"mapped",[1591]],[[126569,126569],"mapped",[1610]],[[126570,126570],"mapped",[1603]],[[126571,126571],"disallowed"],[[126572,126572],"mapped",[1605]],[[126573,126573],"mapped",[1606]],[[126574,126574],"mapped",[1587]],[[126575,126575],"mapped",[1593]],[[126576,126576],"mapped",[1601]],[[126577,126577],"mapped",[1589]],[[126578,126578],"mapped",[1602]],[[126579,126579],"disallowed"],[[126580,126580],"mapped",[1588]],[[126581,126581],"mapped",[1578]],[[126582,126582],"mapped",[1579]],[[126583,126583],"mapped",[1582]],[[126584,126584],"disallowed"],[[126585,126585],"mapped",[1590]],[[126586,126586],"mapped",[1592]],[[126587,126587],"mapped",[1594]],[[126588,126588],"mapped",[1646]],[[126589,126589],"disallowed"],[[126590,126590],"mapped",[1697]],[[126591,126591],"disallowed"],[[126592,126592],"mapped",[1575]],[[126593,126593],"mapped",[1576]],[[126594,126594],"mapped",[1580]],[[126595,126595],"mapped",[1583]],[[126596,126596],"mapped",[1607]],[[126597,126597],"mapped",[1608]],[[126598,126598],"mapped",[1586]],[[126599,126599],"mapped",[1581]],[[126600,126600],"mapped",[1591]],[[126601,126601],"mapped",[1610]],[[126602,126602],"disallowed"],[[126603,126603],"mapped",[1604]],[[126604,126604],"mapped",[1605]],[[126605,126605],"mapped",[1606]],[[126606,126606],"mapped",[1587]],[[126607,126607],"mapped",[1593]],[[126608,126608],"mapped",[1601]],[[126609,126609],"mapped",[1589]],[[126610,126610],"mapped",[1602]],[[126611,126611],"mapped",[1585]],[[126612,126612],"mapped",[1588]],[[126613,126613],"mapped",[1578]],[[126614,126614],"mapped",[1579]],[[126615,126615],"mapped",[1582]],[[126616,126616],"mapped",[1584]],[[126617,126617],"mapped",[1590]],[[126618,126618],"mapped",[1592]],[[126619,126619],"mapped",[1594]],[[126620,126624],"disallowed"],[[126625,126625],"mapped",[1576]],[[126626,126626],"mapped",[1580]],[[126627,126627],"mapped",[1583]],[[126628,126628],"disallowed"],[[126629,126629],"mapped",[1608]],[[126630,126630],"mapped",[1586]],[[126631,126631],"mapped",[1581]],[[126632,126632],"mapped",[1591]],[[126633,126633],"mapped",[1610]],[[126634,126634],"disallowed"],[[126635,126635],"mapped",[1604]],[[126636,126636],"mapped",[1605]],[[126637,126637],"mapped",[1606]],[[126638,126638],"mapped",[1587]],[[126639,126639],"mapped",[1593]],[[126640,126640],"mapped",[1601]],[[126641,126641],"mapped",[1589]],[[126642,126642],"mapped",[1602]],[[126643,126643],"mapped",[1585]],[[126644,126644],"mapped",[1588]],[[126645,126645],"mapped",[1578]],[[126646,126646],"mapped",[1579]],[[126647,126647],"mapped",[1582]],[[126648,126648],"mapped",[1584]],[[126649,126649],"mapped",[1590]],[[126650,126650],"mapped",[1592]],[[126651,126651],"mapped",[1594]],[[126652,126703],"disallowed"],[[126704,126705],"valid",[],"NV8"],[[126706,126975],"disallowed"],[[126976,127019],"valid",[],"NV8"],[[127020,127023],"disallowed"],[[127024,127123],"valid",[],"NV8"],[[127124,127135],"disallowed"],[[127136,127150],"valid",[],"NV8"],[[127151,127152],"disallowed"],[[127153,127166],"valid",[],"NV8"],[[127167,127167],"valid",[],"NV8"],[[127168,127168],"disallowed"],[[127169,127183],"valid",[],"NV8"],[[127184,127184],"disallowed"],[[127185,127199],"valid",[],"NV8"],[[127200,127221],"valid",[],"NV8"],[[127222,127231],"disallowed"],[[127232,127232],"disallowed"],[[127233,127233],"disallowed_STD3_mapped",[48,44]],[[127234,127234],"disallowed_STD3_mapped",[49,44]],[[127235,127235],"disallowed_STD3_mapped",[50,44]],[[127236,127236],"disallowed_STD3_mapped",[51,44]],[[127237,127237],"disallowed_STD3_mapped",[52,44]],[[127238,127238],"disallowed_STD3_mapped",[53,44]],[[127239,127239],"disallowed_STD3_mapped",[54,44]],[[127240,127240],"disallowed_STD3_mapped",[55,44]],[[127241,127241],"disallowed_STD3_mapped",[56,44]],[[127242,127242],"disallowed_STD3_mapped",[57,44]],[[127243,127244],"valid",[],"NV8"],[[127245,127247],"disallowed"],[[127248,127248],"disallowed_STD3_mapped",[40,97,41]],[[127249,127249],"disallowed_STD3_mapped",[40,98,41]],[[127250,127250],"disallowed_STD3_mapped",[40,99,41]],[[127251,127251],"disallowed_STD3_mapped",[40,100,41]],[[127252,127252],"disallowed_STD3_mapped",[40,101,41]],[[127253,127253],"disallowed_STD3_mapped",[40,102,41]],[[127254,127254],"disallowed_STD3_mapped",[40,103,41]],[[127255,127255],"disallowed_STD3_mapped",[40,104,41]],[[127256,127256],"disallowed_STD3_mapped",[40,105,41]],[[127257,127257],"disallowed_STD3_mapped",[40,106,41]],[[127258,127258],"disallowed_STD3_mapped",[40,107,41]],[[127259,127259],"disallowed_STD3_mapped",[40,108,41]],[[127260,127260],"disallowed_STD3_mapped",[40,109,41]],[[127261,127261],"disallowed_STD3_mapped",[40,110,41]],[[127262,127262],"disallowed_STD3_mapped",[40,111,41]],[[127263,127263],"disallowed_STD3_mapped",[40,112,41]],[[127264,127264],"disallowed_STD3_mapped",[40,113,41]],[[127265,127265],"disallowed_STD3_mapped",[40,114,41]],[[127266,127266],"disallowed_STD3_mapped",[40,115,41]],[[127267,127267],"disallowed_STD3_mapped",[40,116,41]],[[127268,127268],"disallowed_STD3_mapped",[40,117,41]],[[127269,127269],"disallowed_STD3_mapped",[40,118,41]],[[127270,127270],"disallowed_STD3_mapped",[40,119,41]],[[127271,127271],"disallowed_STD3_mapped",[40,120,41]],[[127272,127272],"disallowed_STD3_mapped",[40,121,41]],[[127273,127273],"disallowed_STD3_mapped",[40,122,41]],[[127274,127274],"mapped",[12308,115,12309]],[[127275,127275],"mapped",[99]],[[127276,127276],"mapped",[114]],[[127277,127277],"mapped",[99,100]],[[127278,127278],"mapped",[119,122]],[[127279,127279],"disallowed"],[[127280,127280],"mapped",[97]],[[127281,127281],"mapped",[98]],[[127282,127282],"mapped",[99]],[[127283,127283],"mapped",[100]],[[127284,127284],"mapped",[101]],[[127285,127285],"mapped",[102]],[[127286,127286],"mapped",[103]],[[127287,127287],"mapped",[104]],[[127288,127288],"mapped",[105]],[[127289,127289],"mapped",[106]],[[127290,127290],"mapped",[107]],[[127291,127291],"mapped",[108]],[[127292,127292],"mapped",[109]],[[127293,127293],"mapped",[110]],[[127294,127294],"mapped",[111]],[[127295,127295],"mapped",[112]],[[127296,127296],"mapped",[113]],[[127297,127297],"mapped",[114]],[[127298,127298],"mapped",[115]],[[127299,127299],"mapped",[116]],[[127300,127300],"mapped",[117]],[[127301,127301],"mapped",[118]],[[127302,127302],"mapped",[119]],[[127303,127303],"mapped",[120]],[[127304,127304],"mapped",[121]],[[127305,127305],"mapped",[122]],[[127306,127306],"mapped",[104,118]],[[127307,127307],"mapped",[109,118]],[[127308,127308],"mapped",[115,100]],[[127309,127309],"mapped",[115,115]],[[127310,127310],"mapped",[112,112,118]],[[127311,127311],"mapped",[119,99]],[[127312,127318],"valid",[],"NV8"],[[127319,127319],"valid",[],"NV8"],[[127320,127326],"valid",[],"NV8"],[[127327,127327],"valid",[],"NV8"],[[127328,127337],"valid",[],"NV8"],[[127338,127338],"mapped",[109,99]],[[127339,127339],"mapped",[109,100]],[[127340,127343],"disallowed"],[[127344,127352],"valid",[],"NV8"],[[127353,127353],"valid",[],"NV8"],[[127354,127354],"valid",[],"NV8"],[[127355,127356],"valid",[],"NV8"],[[127357,127358],"valid",[],"NV8"],[[127359,127359],"valid",[],"NV8"],[[127360,127369],"valid",[],"NV8"],[[127370,127373],"valid",[],"NV8"],[[127374,127375],"valid",[],"NV8"],[[127376,127376],"mapped",[100,106]],[[127377,127386],"valid",[],"NV8"],[[127387,127461],"disallowed"],[[127462,127487],"valid",[],"NV8"],[[127488,127488],"mapped",[12411,12363]],[[127489,127489],"mapped",[12467,12467]],[[127490,127490],"mapped",[12469]],[[127491,127503],"disallowed"],[[127504,127504],"mapped",[25163]],[[127505,127505],"mapped",[23383]],[[127506,127506],"mapped",[21452]],[[127507,127507],"mapped",[12487]],[[127508,127508],"mapped",[20108]],[[127509,127509],"mapped",[22810]],[[127510,127510],"mapped",[35299]],[[127511,127511],"mapped",[22825]],[[127512,127512],"mapped",[20132]],[[127513,127513],"mapped",[26144]],[[127514,127514],"mapped",[28961]],[[127515,127515],"mapped",[26009]],[[127516,127516],"mapped",[21069]],[[127517,127517],"mapped",[24460]],[[127518,127518],"mapped",[20877]],[[127519,127519],"mapped",[26032]],[[127520,127520],"mapped",[21021]],[[127521,127521],"mapped",[32066]],[[127522,127522],"mapped",[29983]],[[127523,127523],"mapped",[36009]],[[127524,127524],"mapped",[22768]],[[127525,127525],"mapped",[21561]],[[127526,127526],"mapped",[28436]],[[127527,127527],"mapped",[25237]],[[127528,127528],"mapped",[25429]],[[127529,127529],"mapped",[19968]],[[127530,127530],"mapped",[19977]],[[127531,127531],"mapped",[36938]],[[127532,127532],"mapped",[24038]],[[127533,127533],"mapped",[20013]],[[127534,127534],"mapped",[21491]],[[127535,127535],"mapped",[25351]],[[127536,127536],"mapped",[36208]],[[127537,127537],"mapped",[25171]],[[127538,127538],"mapped",[31105]],[[127539,127539],"mapped",[31354]],[[127540,127540],"mapped",[21512]],[[127541,127541],"mapped",[28288]],[[127542,127542],"mapped",[26377]],[[127543,127543],"mapped",[26376]],[[127544,127544],"mapped",[30003]],[[127545,127545],"mapped",[21106]],[[127546,127546],"mapped",[21942]],[[127547,127551],"disallowed"],[[127552,127552],"mapped",[12308,26412,12309]],[[127553,127553],"mapped",[12308,19977,12309]],[[127554,127554],"mapped",[12308,20108,12309]],[[127555,127555],"mapped",[12308,23433,12309]],[[127556,127556],"mapped",[12308,28857,12309]],[[127557,127557],"mapped",[12308,25171,12309]],[[127558,127558],"mapped",[12308,30423,12309]],[[127559,127559],"mapped",[12308,21213,12309]],[[127560,127560],"mapped",[12308,25943,12309]],[[127561,127567],"disallowed"],[[127568,127568],"mapped",[24471]],[[127569,127569],"mapped",[21487]],[[127570,127743],"disallowed"],[[127744,127776],"valid",[],"NV8"],[[127777,127788],"valid",[],"NV8"],[[127789,127791],"valid",[],"NV8"],[[127792,127797],"valid",[],"NV8"],[[127798,127798],"valid",[],"NV8"],[[127799,127868],"valid",[],"NV8"],[[127869,127869],"valid",[],"NV8"],[[127870,127871],"valid",[],"NV8"],[[127872,127891],"valid",[],"NV8"],[[127892,127903],"valid",[],"NV8"],[[127904,127940],"valid",[],"NV8"],[[127941,127941],"valid",[],"NV8"],[[127942,127946],"valid",[],"NV8"],[[127947,127950],"valid",[],"NV8"],[[127951,127955],"valid",[],"NV8"],[[127956,127967],"valid",[],"NV8"],[[127968,127984],"valid",[],"NV8"],[[127985,127991],"valid",[],"NV8"],[[127992,127999],"valid",[],"NV8"],[[128e3,128062],"valid",[],"NV8"],[[128063,128063],"valid",[],"NV8"],[[128064,128064],"valid",[],"NV8"],[[128065,128065],"valid",[],"NV8"],[[128066,128247],"valid",[],"NV8"],[[128248,128248],"valid",[],"NV8"],[[128249,128252],"valid",[],"NV8"],[[128253,128254],"valid",[],"NV8"],[[128255,128255],"valid",[],"NV8"],[[128256,128317],"valid",[],"NV8"],[[128318,128319],"valid",[],"NV8"],[[128320,128323],"valid",[],"NV8"],[[128324,128330],"valid",[],"NV8"],[[128331,128335],"valid",[],"NV8"],[[128336,128359],"valid",[],"NV8"],[[128360,128377],"valid",[],"NV8"],[[128378,128378],"disallowed"],[[128379,128419],"valid",[],"NV8"],[[128420,128420],"disallowed"],[[128421,128506],"valid",[],"NV8"],[[128507,128511],"valid",[],"NV8"],[[128512,128512],"valid",[],"NV8"],[[128513,128528],"valid",[],"NV8"],[[128529,128529],"valid",[],"NV8"],[[128530,128532],"valid",[],"NV8"],[[128533,128533],"valid",[],"NV8"],[[128534,128534],"valid",[],"NV8"],[[128535,128535],"valid",[],"NV8"],[[128536,128536],"valid",[],"NV8"],[[128537,128537],"valid",[],"NV8"],[[128538,128538],"valid",[],"NV8"],[[128539,128539],"valid",[],"NV8"],[[128540,128542],"valid",[],"NV8"],[[128543,128543],"valid",[],"NV8"],[[128544,128549],"valid",[],"NV8"],[[128550,128551],"valid",[],"NV8"],[[128552,128555],"valid",[],"NV8"],[[128556,128556],"valid",[],"NV8"],[[128557,128557],"valid",[],"NV8"],[[128558,128559],"valid",[],"NV8"],[[128560,128563],"valid",[],"NV8"],[[128564,128564],"valid",[],"NV8"],[[128565,128576],"valid",[],"NV8"],[[128577,128578],"valid",[],"NV8"],[[128579,128580],"valid",[],"NV8"],[[128581,128591],"valid",[],"NV8"],[[128592,128639],"valid",[],"NV8"],[[128640,128709],"valid",[],"NV8"],[[128710,128719],"valid",[],"NV8"],[[128720,128720],"valid",[],"NV8"],[[128721,128735],"disallowed"],[[128736,128748],"valid",[],"NV8"],[[128749,128751],"disallowed"],[[128752,128755],"valid",[],"NV8"],[[128756,128767],"disallowed"],[[128768,128883],"valid",[],"NV8"],[[128884,128895],"disallowed"],[[128896,128980],"valid",[],"NV8"],[[128981,129023],"disallowed"],[[129024,129035],"valid",[],"NV8"],[[129036,129039],"disallowed"],[[129040,129095],"valid",[],"NV8"],[[129096,129103],"disallowed"],[[129104,129113],"valid",[],"NV8"],[[129114,129119],"disallowed"],[[129120,129159],"valid",[],"NV8"],[[129160,129167],"disallowed"],[[129168,129197],"valid",[],"NV8"],[[129198,129295],"disallowed"],[[129296,129304],"valid",[],"NV8"],[[129305,129407],"disallowed"],[[129408,129412],"valid",[],"NV8"],[[129413,129471],"disallowed"],[[129472,129472],"valid",[],"NV8"],[[129473,131069],"disallowed"],[[131070,131071],"disallowed"],[[131072,173782],"valid"],[[173783,173823],"disallowed"],[[173824,177972],"valid"],[[177973,177983],"disallowed"],[[177984,178205],"valid"],[[178206,178207],"disallowed"],[[178208,183969],"valid"],[[183970,194559],"disallowed"],[[194560,194560],"mapped",[20029]],[[194561,194561],"mapped",[20024]],[[194562,194562],"mapped",[20033]],[[194563,194563],"mapped",[131362]],[[194564,194564],"mapped",[20320]],[[194565,194565],"mapped",[20398]],[[194566,194566],"mapped",[20411]],[[194567,194567],"mapped",[20482]],[[194568,194568],"mapped",[20602]],[[194569,194569],"mapped",[20633]],[[194570,194570],"mapped",[20711]],[[194571,194571],"mapped",[20687]],[[194572,194572],"mapped",[13470]],[[194573,194573],"mapped",[132666]],[[194574,194574],"mapped",[20813]],[[194575,194575],"mapped",[20820]],[[194576,194576],"mapped",[20836]],[[194577,194577],"mapped",[20855]],[[194578,194578],"mapped",[132380]],[[194579,194579],"mapped",[13497]],[[194580,194580],"mapped",[20839]],[[194581,194581],"mapped",[20877]],[[194582,194582],"mapped",[132427]],[[194583,194583],"mapped",[20887]],[[194584,194584],"mapped",[20900]],[[194585,194585],"mapped",[20172]],[[194586,194586],"mapped",[20908]],[[194587,194587],"mapped",[20917]],[[194588,194588],"mapped",[168415]],[[194589,194589],"mapped",[20981]],[[194590,194590],"mapped",[20995]],[[194591,194591],"mapped",[13535]],[[194592,194592],"mapped",[21051]],[[194593,194593],"mapped",[21062]],[[194594,194594],"mapped",[21106]],[[194595,194595],"mapped",[21111]],[[194596,194596],"mapped",[13589]],[[194597,194597],"mapped",[21191]],[[194598,194598],"mapped",[21193]],[[194599,194599],"mapped",[21220]],[[194600,194600],"mapped",[21242]],[[194601,194601],"mapped",[21253]],[[194602,194602],"mapped",[21254]],[[194603,194603],"mapped",[21271]],[[194604,194604],"mapped",[21321]],[[194605,194605],"mapped",[21329]],[[194606,194606],"mapped",[21338]],[[194607,194607],"mapped",[21363]],[[194608,194608],"mapped",[21373]],[[194609,194611],"mapped",[21375]],[[194612,194612],"mapped",[133676]],[[194613,194613],"mapped",[28784]],[[194614,194614],"mapped",[21450]],[[194615,194615],"mapped",[21471]],[[194616,194616],"mapped",[133987]],[[194617,194617],"mapped",[21483]],[[194618,194618],"mapped",[21489]],[[194619,194619],"mapped",[21510]],[[194620,194620],"mapped",[21662]],[[194621,194621],"mapped",[21560]],[[194622,194622],"mapped",[21576]],[[194623,194623],"mapped",[21608]],[[194624,194624],"mapped",[21666]],[[194625,194625],"mapped",[21750]],[[194626,194626],"mapped",[21776]],[[194627,194627],"mapped",[21843]],[[194628,194628],"mapped",[21859]],[[194629,194630],"mapped",[21892]],[[194631,194631],"mapped",[21913]],[[194632,194632],"mapped",[21931]],[[194633,194633],"mapped",[21939]],[[194634,194634],"mapped",[21954]],[[194635,194635],"mapped",[22294]],[[194636,194636],"mapped",[22022]],[[194637,194637],"mapped",[22295]],[[194638,194638],"mapped",[22097]],[[194639,194639],"mapped",[22132]],[[194640,194640],"mapped",[20999]],[[194641,194641],"mapped",[22766]],[[194642,194642],"mapped",[22478]],[[194643,194643],"mapped",[22516]],[[194644,194644],"mapped",[22541]],[[194645,194645],"mapped",[22411]],[[194646,194646],"mapped",[22578]],[[194647,194647],"mapped",[22577]],[[194648,194648],"mapped",[22700]],[[194649,194649],"mapped",[136420]],[[194650,194650],"mapped",[22770]],[[194651,194651],"mapped",[22775]],[[194652,194652],"mapped",[22790]],[[194653,194653],"mapped",[22810]],[[194654,194654],"mapped",[22818]],[[194655,194655],"mapped",[22882]],[[194656,194656],"mapped",[136872]],[[194657,194657],"mapped",[136938]],[[194658,194658],"mapped",[23020]],[[194659,194659],"mapped",[23067]],[[194660,194660],"mapped",[23079]],[[194661,194661],"mapped",[23e3]],[[194662,194662],"mapped",[23142]],[[194663,194663],"mapped",[14062]],[[194664,194664],"disallowed"],[[194665,194665],"mapped",[23304]],[[194666,194667],"mapped",[23358]],[[194668,194668],"mapped",[137672]],[[194669,194669],"mapped",[23491]],[[194670,194670],"mapped",[23512]],[[194671,194671],"mapped",[23527]],[[194672,194672],"mapped",[23539]],[[194673,194673],"mapped",[138008]],[[194674,194674],"mapped",[23551]],[[194675,194675],"mapped",[23558]],[[194676,194676],"disallowed"],[[194677,194677],"mapped",[23586]],[[194678,194678],"mapped",[14209]],[[194679,194679],"mapped",[23648]],[[194680,194680],"mapped",[23662]],[[194681,194681],"mapped",[23744]],[[194682,194682],"mapped",[23693]],[[194683,194683],"mapped",[138724]],[[194684,194684],"mapped",[23875]],[[194685,194685],"mapped",[138726]],[[194686,194686],"mapped",[23918]],[[194687,194687],"mapped",[23915]],[[194688,194688],"mapped",[23932]],[[194689,194689],"mapped",[24033]],[[194690,194690],"mapped",[24034]],[[194691,194691],"mapped",[14383]],[[194692,194692],"mapped",[24061]],[[194693,194693],"mapped",[24104]],[[194694,194694],"mapped",[24125]],[[194695,194695],"mapped",[24169]],[[194696,194696],"mapped",[14434]],[[194697,194697],"mapped",[139651]],[[194698,194698],"mapped",[14460]],[[194699,194699],"mapped",[24240]],[[194700,194700],"mapped",[24243]],[[194701,194701],"mapped",[24246]],[[194702,194702],"mapped",[24266]],[[194703,194703],"mapped",[172946]],[[194704,194704],"mapped",[24318]],[[194705,194706],"mapped",[140081]],[[194707,194707],"mapped",[33281]],[[194708,194709],"mapped",[24354]],[[194710,194710],"mapped",[14535]],[[194711,194711],"mapped",[144056]],[[194712,194712],"mapped",[156122]],[[194713,194713],"mapped",[24418]],[[194714,194714],"mapped",[24427]],[[194715,194715],"mapped",[14563]],[[194716,194716],"mapped",[24474]],[[194717,194717],"mapped",[24525]],[[194718,194718],"mapped",[24535]],[[194719,194719],"mapped",[24569]],[[194720,194720],"mapped",[24705]],[[194721,194721],"mapped",[14650]],[[194722,194722],"mapped",[14620]],[[194723,194723],"mapped",[24724]],[[194724,194724],"mapped",[141012]],[[194725,194725],"mapped",[24775]],[[194726,194726],"mapped",[24904]],[[194727,194727],"mapped",[24908]],[[194728,194728],"mapped",[24910]],[[194729,194729],"mapped",[24908]],[[194730,194730],"mapped",[24954]],[[194731,194731],"mapped",[24974]],[[194732,194732],"mapped",[25010]],[[194733,194733],"mapped",[24996]],[[194734,194734],"mapped",[25007]],[[194735,194735],"mapped",[25054]],[[194736,194736],"mapped",[25074]],[[194737,194737],"mapped",[25078]],[[194738,194738],"mapped",[25104]],[[194739,194739],"mapped",[25115]],[[194740,194740],"mapped",[25181]],[[194741,194741],"mapped",[25265]],[[194742,194742],"mapped",[25300]],[[194743,194743],"mapped",[25424]],[[194744,194744],"mapped",[142092]],[[194745,194745],"mapped",[25405]],[[194746,194746],"mapped",[25340]],[[194747,194747],"mapped",[25448]],[[194748,194748],"mapped",[25475]],[[194749,194749],"mapped",[25572]],[[194750,194750],"mapped",[142321]],[[194751,194751],"mapped",[25634]],[[194752,194752],"mapped",[25541]],[[194753,194753],"mapped",[25513]],[[194754,194754],"mapped",[14894]],[[194755,194755],"mapped",[25705]],[[194756,194756],"mapped",[25726]],[[194757,194757],"mapped",[25757]],[[194758,194758],"mapped",[25719]],[[194759,194759],"mapped",[14956]],[[194760,194760],"mapped",[25935]],[[194761,194761],"mapped",[25964]],[[194762,194762],"mapped",[143370]],[[194763,194763],"mapped",[26083]],[[194764,194764],"mapped",[26360]],[[194765,194765],"mapped",[26185]],[[194766,194766],"mapped",[15129]],[[194767,194767],"mapped",[26257]],[[194768,194768],"mapped",[15112]],[[194769,194769],"mapped",[15076]],[[194770,194770],"mapped",[20882]],[[194771,194771],"mapped",[20885]],[[194772,194772],"mapped",[26368]],[[194773,194773],"mapped",[26268]],[[194774,194774],"mapped",[32941]],[[194775,194775],"mapped",[17369]],[[194776,194776],"mapped",[26391]],[[194777,194777],"mapped",[26395]],[[194778,194778],"mapped",[26401]],[[194779,194779],"mapped",[26462]],[[194780,194780],"mapped",[26451]],[[194781,194781],"mapped",[144323]],[[194782,194782],"mapped",[15177]],[[194783,194783],"mapped",[26618]],[[194784,194784],"mapped",[26501]],[[194785,194785],"mapped",[26706]],[[194786,194786],"mapped",[26757]],[[194787,194787],"mapped",[144493]],[[194788,194788],"mapped",[26766]],[[194789,194789],"mapped",[26655]],[[194790,194790],"mapped",[26900]],[[194791,194791],"mapped",[15261]],[[194792,194792],"mapped",[26946]],[[194793,194793],"mapped",[27043]],[[194794,194794],"mapped",[27114]],[[194795,194795],"mapped",[27304]],[[194796,194796],"mapped",[145059]],[[194797,194797],"mapped",[27355]],[[194798,194798],"mapped",[15384]],[[194799,194799],"mapped",[27425]],[[194800,194800],"mapped",[145575]],[[194801,194801],"mapped",[27476]],[[194802,194802],"mapped",[15438]],[[194803,194803],"mapped",[27506]],[[194804,194804],"mapped",[27551]],[[194805,194805],"mapped",[27578]],[[194806,194806],"mapped",[27579]],[[194807,194807],"mapped",[146061]],[[194808,194808],"mapped",[138507]],[[194809,194809],"mapped",[146170]],[[194810,194810],"mapped",[27726]],[[194811,194811],"mapped",[146620]],[[194812,194812],"mapped",[27839]],[[194813,194813],"mapped",[27853]],[[194814,194814],"mapped",[27751]],[[194815,194815],"mapped",[27926]],[[194816,194816],"mapped",[27966]],[[194817,194817],"mapped",[28023]],[[194818,194818],"mapped",[27969]],[[194819,194819],"mapped",[28009]],[[194820,194820],"mapped",[28024]],[[194821,194821],"mapped",[28037]],[[194822,194822],"mapped",[146718]],[[194823,194823],"mapped",[27956]],[[194824,194824],"mapped",[28207]],[[194825,194825],"mapped",[28270]],[[194826,194826],"mapped",[15667]],[[194827,194827],"mapped",[28363]],[[194828,194828],"mapped",[28359]],[[194829,194829],"mapped",[147153]],[[194830,194830],"mapped",[28153]],[[194831,194831],"mapped",[28526]],[[194832,194832],"mapped",[147294]],[[194833,194833],"mapped",[147342]],[[194834,194834],"mapped",[28614]],[[194835,194835],"mapped",[28729]],[[194836,194836],"mapped",[28702]],[[194837,194837],"mapped",[28699]],[[194838,194838],"mapped",[15766]],[[194839,194839],"mapped",[28746]],[[194840,194840],"mapped",[28797]],[[194841,194841],"mapped",[28791]],[[194842,194842],"mapped",[28845]],[[194843,194843],"mapped",[132389]],[[194844,194844],"mapped",[28997]],[[194845,194845],"mapped",[148067]],[[194846,194846],"mapped",[29084]],[[194847,194847],"disallowed"],[[194848,194848],"mapped",[29224]],[[194849,194849],"mapped",[29237]],[[194850,194850],"mapped",[29264]],[[194851,194851],"mapped",[149e3]],[[194852,194852],"mapped",[29312]],[[194853,194853],"mapped",[29333]],[[194854,194854],"mapped",[149301]],[[194855,194855],"mapped",[149524]],[[194856,194856],"mapped",[29562]],[[194857,194857],"mapped",[29579]],[[194858,194858],"mapped",[16044]],[[194859,194859],"mapped",[29605]],[[194860,194861],"mapped",[16056]],[[194862,194862],"mapped",[29767]],[[194863,194863],"mapped",[29788]],[[194864,194864],"mapped",[29809]],[[194865,194865],"mapped",[29829]],[[194866,194866],"mapped",[29898]],[[194867,194867],"mapped",[16155]],[[194868,194868],"mapped",[29988]],[[194869,194869],"mapped",[150582]],[[194870,194870],"mapped",[30014]],[[194871,194871],"mapped",[150674]],[[194872,194872],"mapped",[30064]],[[194873,194873],"mapped",[139679]],[[194874,194874],"mapped",[30224]],[[194875,194875],"mapped",[151457]],[[194876,194876],"mapped",[151480]],[[194877,194877],"mapped",[151620]],[[194878,194878],"mapped",[16380]],[[194879,194879],"mapped",[16392]],[[194880,194880],"mapped",[30452]],[[194881,194881],"mapped",[151795]],[[194882,194882],"mapped",[151794]],[[194883,194883],"mapped",[151833]],[[194884,194884],"mapped",[151859]],[[194885,194885],"mapped",[30494]],[[194886,194887],"mapped",[30495]],[[194888,194888],"mapped",[30538]],[[194889,194889],"mapped",[16441]],[[194890,194890],"mapped",[30603]],[[194891,194891],"mapped",[16454]],[[194892,194892],"mapped",[16534]],[[194893,194893],"mapped",[152605]],[[194894,194894],"mapped",[30798]],[[194895,194895],"mapped",[30860]],[[194896,194896],"mapped",[30924]],[[194897,194897],"mapped",[16611]],[[194898,194898],"mapped",[153126]],[[194899,194899],"mapped",[31062]],[[194900,194900],"mapped",[153242]],[[194901,194901],"mapped",[153285]],[[194902,194902],"mapped",[31119]],[[194903,194903],"mapped",[31211]],[[194904,194904],"mapped",[16687]],[[194905,194905],"mapped",[31296]],[[194906,194906],"mapped",[31306]],[[194907,194907],"mapped",[31311]],[[194908,194908],"mapped",[153980]],[[194909,194910],"mapped",[154279]],[[194911,194911],"disallowed"],[[194912,194912],"mapped",[16898]],[[194913,194913],"mapped",[154539]],[[194914,194914],"mapped",[31686]],[[194915,194915],"mapped",[31689]],[[194916,194916],"mapped",[16935]],[[194917,194917],"mapped",[154752]],[[194918,194918],"mapped",[31954]],[[194919,194919],"mapped",[17056]],[[194920,194920],"mapped",[31976]],[[194921,194921],"mapped",[31971]],[[194922,194922],"mapped",[32e3]],[[194923,194923],"mapped",[155526]],[[194924,194924],"mapped",[32099]],[[194925,194925],"mapped",[17153]],[[194926,194926],"mapped",[32199]],[[194927,194927],"mapped",[32258]],[[194928,194928],"mapped",[32325]],[[194929,194929],"mapped",[17204]],[[194930,194930],"mapped",[156200]],[[194931,194931],"mapped",[156231]],[[194932,194932],"mapped",[17241]],[[194933,194933],"mapped",[156377]],[[194934,194934],"mapped",[32634]],[[194935,194935],"mapped",[156478]],[[194936,194936],"mapped",[32661]],[[194937,194937],"mapped",[32762]],[[194938,194938],"mapped",[32773]],[[194939,194939],"mapped",[156890]],[[194940,194940],"mapped",[156963]],[[194941,194941],"mapped",[32864]],[[194942,194942],"mapped",[157096]],[[194943,194943],"mapped",[32880]],[[194944,194944],"mapped",[144223]],[[194945,194945],"mapped",[17365]],[[194946,194946],"mapped",[32946]],[[194947,194947],"mapped",[33027]],[[194948,194948],"mapped",[17419]],[[194949,194949],"mapped",[33086]],[[194950,194950],"mapped",[23221]],[[194951,194951],"mapped",[157607]],[[194952,194952],"mapped",[157621]],[[194953,194953],"mapped",[144275]],[[194954,194954],"mapped",[144284]],[[194955,194955],"mapped",[33281]],[[194956,194956],"mapped",[33284]],[[194957,194957],"mapped",[36766]],[[194958,194958],"mapped",[17515]],[[194959,194959],"mapped",[33425]],[[194960,194960],"mapped",[33419]],[[194961,194961],"mapped",[33437]],[[194962,194962],"mapped",[21171]],[[194963,194963],"mapped",[33457]],[[194964,194964],"mapped",[33459]],[[194965,194965],"mapped",[33469]],[[194966,194966],"mapped",[33510]],[[194967,194967],"mapped",[158524]],[[194968,194968],"mapped",[33509]],[[194969,194969],"mapped",[33565]],[[194970,194970],"mapped",[33635]],[[194971,194971],"mapped",[33709]],[[194972,194972],"mapped",[33571]],[[194973,194973],"mapped",[33725]],[[194974,194974],"mapped",[33767]],[[194975,194975],"mapped",[33879]],[[194976,194976],"mapped",[33619]],[[194977,194977],"mapped",[33738]],[[194978,194978],"mapped",[33740]],[[194979,194979],"mapped",[33756]],[[194980,194980],"mapped",[158774]],[[194981,194981],"mapped",[159083]],[[194982,194982],"mapped",[158933]],[[194983,194983],"mapped",[17707]],[[194984,194984],"mapped",[34033]],[[194985,194985],"mapped",[34035]],[[194986,194986],"mapped",[34070]],[[194987,194987],"mapped",[160714]],[[194988,194988],"mapped",[34148]],[[194989,194989],"mapped",[159532]],[[194990,194990],"mapped",[17757]],[[194991,194991],"mapped",[17761]],[[194992,194992],"mapped",[159665]],[[194993,194993],"mapped",[159954]],[[194994,194994],"mapped",[17771]],[[194995,194995],"mapped",[34384]],[[194996,194996],"mapped",[34396]],[[194997,194997],"mapped",[34407]],[[194998,194998],"mapped",[34409]],[[194999,194999],"mapped",[34473]],[[195e3,195e3],"mapped",[34440]],[[195001,195001],"mapped",[34574]],[[195002,195002],"mapped",[34530]],[[195003,195003],"mapped",[34681]],[[195004,195004],"mapped",[34600]],[[195005,195005],"mapped",[34667]],[[195006,195006],"mapped",[34694]],[[195007,195007],"disallowed"],[[195008,195008],"mapped",[34785]],[[195009,195009],"mapped",[34817]],[[195010,195010],"mapped",[17913]],[[195011,195011],"mapped",[34912]],[[195012,195012],"mapped",[34915]],[[195013,195013],"mapped",[161383]],[[195014,195014],"mapped",[35031]],[[195015,195015],"mapped",[35038]],[[195016,195016],"mapped",[17973]],[[195017,195017],"mapped",[35066]],[[195018,195018],"mapped",[13499]],[[195019,195019],"mapped",[161966]],[[195020,195020],"mapped",[162150]],[[195021,195021],"mapped",[18110]],[[195022,195022],"mapped",[18119]],[[195023,195023],"mapped",[35488]],[[195024,195024],"mapped",[35565]],[[195025,195025],"mapped",[35722]],[[195026,195026],"mapped",[35925]],[[195027,195027],"mapped",[162984]],[[195028,195028],"mapped",[36011]],[[195029,195029],"mapped",[36033]],[[195030,195030],"mapped",[36123]],[[195031,195031],"mapped",[36215]],[[195032,195032],"mapped",[163631]],[[195033,195033],"mapped",[133124]],[[195034,195034],"mapped",[36299]],[[195035,195035],"mapped",[36284]],[[195036,195036],"mapped",[36336]],[[195037,195037],"mapped",[133342]],[[195038,195038],"mapped",[36564]],[[195039,195039],"mapped",[36664]],[[195040,195040],"mapped",[165330]],[[195041,195041],"mapped",[165357]],[[195042,195042],"mapped",[37012]],[[195043,195043],"mapped",[37105]],[[195044,195044],"mapped",[37137]],[[195045,195045],"mapped",[165678]],[[195046,195046],"mapped",[37147]],[[195047,195047],"mapped",[37432]],[[195048,195048],"mapped",[37591]],[[195049,195049],"mapped",[37592]],[[195050,195050],"mapped",[37500]],[[195051,195051],"mapped",[37881]],[[195052,195052],"mapped",[37909]],[[195053,195053],"mapped",[166906]],[[195054,195054],"mapped",[38283]],[[195055,195055],"mapped",[18837]],[[195056,195056],"mapped",[38327]],[[195057,195057],"mapped",[167287]],[[195058,195058],"mapped",[18918]],[[195059,195059],"mapped",[38595]],[[195060,195060],"mapped",[23986]],[[195061,195061],"mapped",[38691]],[[195062,195062],"mapped",[168261]],[[195063,195063],"mapped",[168474]],[[195064,195064],"mapped",[19054]],[[195065,195065],"mapped",[19062]],[[195066,195066],"mapped",[38880]],[[195067,195067],"mapped",[168970]],[[195068,195068],"mapped",[19122]],[[195069,195069],"mapped",[169110]],[[195070,195071],"mapped",[38923]],[[195072,195072],"mapped",[38953]],[[195073,195073],"mapped",[169398]],[[195074,195074],"mapped",[39138]],[[195075,195075],"mapped",[19251]],[[195076,195076],"mapped",[39209]],[[195077,195077],"mapped",[39335]],[[195078,195078],"mapped",[39362]],[[195079,195079],"mapped",[39422]],[[195080,195080],"mapped",[19406]],[[195081,195081],"mapped",[170800]],[[195082,195082],"mapped",[39698]],[[195083,195083],"mapped",[4e4]],[[195084,195084],"mapped",[40189]],[[195085,195085],"mapped",[19662]],[[195086,195086],"mapped",[19693]],[[195087,195087],"mapped",[40295]],[[195088,195088],"mapped",[172238]],[[195089,195089],"mapped",[19704]],[[195090,195090],"mapped",[172293]],[[195091,195091],"mapped",[172558]],[[195092,195092],"mapped",[172689]],[[195093,195093],"mapped",[40635]],[[195094,195094],"mapped",[19798]],[[195095,195095],"mapped",[40697]],[[195096,195096],"mapped",[40702]],[[195097,195097],"mapped",[40709]],[[195098,195098],"mapped",[40719]],[[195099,195099],"mapped",[40726]],[[195100,195100],"mapped",[40763]],[[195101,195101],"mapped",[173568]],[[195102,196605],"disallowed"],[[196606,196607],"disallowed"],[[196608,262141],"disallowed"],[[262142,262143],"disallowed"],[[262144,327677],"disallowed"],[[327678,327679],"disallowed"],[[327680,393213],"disallowed"],[[393214,393215],"disallowed"],[[393216,458749],"disallowed"],[[458750,458751],"disallowed"],[[458752,524285],"disallowed"],[[524286,524287],"disallowed"],[[524288,589821],"disallowed"],[[589822,589823],"disallowed"],[[589824,655357],"disallowed"],[[655358,655359],"disallowed"],[[655360,720893],"disallowed"],[[720894,720895],"disallowed"],[[720896,786429],"disallowed"],[[786430,786431],"disallowed"],[[786432,851965],"disallowed"],[[851966,851967],"disallowed"],[[851968,917501],"disallowed"],[[917502,917503],"disallowed"],[[917504,917504],"disallowed"],[[917505,917505],"disallowed"],[[917506,917535],"disallowed"],[[917536,917631],"disallowed"],[[917632,917759],"disallowed"],[[917760,917999],"ignored"],[[918e3,983037],"disallowed"],[[983038,983039],"disallowed"],[[983040,1048573],"disallowed"],[[1048574,1048575],"disallowed"],[[1048576,1114109],"disallowed"],[[1114110,1114111],"disallowed"]]});var Ed=de((B0,hs)=>{"use strict";var _d=require("punycode"),Sd=kd(),ka={TRANSITIONAL:0,NONTRANSITIONAL:1};function Cd(n){return n.split("\0").map(function(e){return e.normalize("NFC")}).join("\0")}function Pd(n){for(var e=0,t=Sd.length-1;e<=t;){var a=Math.floor((e+t)/2),s=Sd[a];if(s[0][0]<=n&&s[0][1]>=n)return s;s[0][0]>n?t=a-1:e=a+1}return null}var Fc=/[\uD800-\uDBFF][\uDC00-\uDFFF]/g;function Td(n){return n.replace(Fc,"_").length}function Lc(n,e,t){for(var a=!1,s="",o=Td(n),i=0;i<o;++i){var r=n.codePointAt(i),d=Pd(r);switch(d[1]){case"disallowed":a=!0,s+=String.fromCodePoint(r);break;case"ignored":break;case"mapped":s+=String.fromCodePoint.apply(String,d[2]);break;case"deviation":t===ka.TRANSITIONAL?s+=String.fromCodePoint.apply(String,d[2]):s+=String.fromCodePoint(r);break;case"valid":s+=String.fromCodePoint(r);break;case"disallowed_STD3_mapped":e?(a=!0,s+=String.fromCodePoint(r)):s+=String.fromCodePoint.apply(String,d[2]);break;case"disallowed_STD3_valid":e&&(a=!0),s+=String.fromCodePoint(r);break}}return{string:s,error:a}}var $c=/[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08E4-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B62\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C00-\u0C03\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0D01-\u0D03\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D82\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0F18\u0F19\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u18A9\u1920-\u192B\u1930-\u193B\u19B0-\u19C0\u19C8\u19C9\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1AB0-\u1ABE\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF2-\u1CF4\u1CF8\u1CF9\u1DC0-\u1DF5\u1DFC-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA880\uA881\uA8B4-\uA8C4\uA8E0-\uA8F1\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9E5\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2D]|\uD800[\uDDFD\uDEE0\uDF76-\uDF7A]|\uD802[\uDE01-\uDE03\uDE05\uDE06\uDE0C-\uDE0F\uDE38-\uDE3A\uDE3F\uDEE5\uDEE6]|\uD804[\uDC00-\uDC02\uDC38-\uDC46\uDC7F-\uDC82\uDCB0-\uDCBA\uDD00-\uDD02\uDD27-\uDD34\uDD73\uDD80-\uDD82\uDDB3-\uDDC0\uDE2C-\uDE37\uDEDF-\uDEEA\uDF01-\uDF03\uDF3C\uDF3E-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF57\uDF62\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDCB0-\uDCC3\uDDAF-\uDDB5\uDDB8-\uDDC0\uDE30-\uDE40\uDEAB-\uDEB7]|\uD81A[\uDEF0-\uDEF4\uDF30-\uDF36]|\uD81B[\uDF51-\uDF7E\uDF8F-\uDF92]|\uD82F[\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD83A[\uDCD0-\uDCD6]|\uDB40[\uDD00-\uDDEF]/;function Oc(n,e){n.substr(0,4)==="xn--"&&(n=_d.toUnicode(n),e=ka.NONTRANSITIONAL);var t=!1;(Cd(n)!==n||n[3]==="-"&&n[4]==="-"||n[0]==="-"||n[n.length-1]==="-"||n.indexOf(".")!==-1||n.search($c)===0)&&(t=!0);for(var a=Td(n),s=0;s<a;++s){var o=Pd(n.codePointAt(s));if(gs===ka.TRANSITIONAL&&o[1]!=="valid"||gs===ka.NONTRANSITIONAL&&o[1]!=="valid"&&o[1]!=="deviation"){t=!0;break}}return{label:n,error:t}}function gs(n,e,t){var a=Lc(n,e,t);a.string=Cd(a.string);for(var s=a.string.split("."),o=0;o<s.length;++o)try{var i=Oc(s[o]);s[o]=i.label,a.error=a.error||i.error}catch{a.error=!0}return{string:s.join("."),error:a.error}}hs.exports.toASCII=function(n,e,t,a){var s=gs(n,e,t),o=s.string.split(".");if(o=o.map(function(d){try{return _d.toASCII(d)}catch{return s.error=!0,d}}),a){var i=o.slice(0,o.length-1).join(".").length;(i.length>253||i.length===0)&&(s.error=!0);for(var r=0;r<o.length;++r)if(o.length>63||o.length===0){s.error=!0;break}}return s.error?null:o.join(".")};hs.exports.toUnicode=function(n,e){var t=gs(n,e,ka.NONTRANSITIONAL);return{domain:t.string,error:t.error}};hs.exports.PROCESSING_OPTIONS=ka});var Je=de((D0,Ae)=>{"use strict";var Sa=require("punycode"),Nd=Ed(),Bd={ftp:21,file:null,gopher:70,http:80,https:443,ws:80,wss:443},M=Symbol("failure");function Ad(n){return Sa.ucs2.decode(n).length}function Id(n,e){let t=n[e];return isNaN(t)?void 0:String.fromCodePoint(t)}function an(n){return n>=48&&n<=57}function nn(n){return n>=65&&n<=90||n>=97&&n<=122}function jc(n){return nn(n)||an(n)}function Ve(n){return an(n)||n>=65&&n<=70||n>=97&&n<=102}function Md(n){return n==="."||n.toLowerCase()==="%2e"}function zc(n){return n=n.toLowerCase(),n===".."||n==="%2e."||n===".%2e"||n==="%2e%2e"}function Vc(n,e){return nn(n)&&(e===58||e===124)}function Dd(n){return n.length===2&&nn(n.codePointAt(0))&&(n[1]===":"||n[1]==="|")}function Uc(n){return n.length===2&&nn(n.codePointAt(0))&&n[1]===":"}function qc(n){return n.search(/\u0000|\u0009|\u000A|\u000D|\u0020|#|%|\/|:|\?|@|\[|\\|\]/)!==-1}function Wc(n){return n.search(/\u0000|\u0009|\u000A|\u000D|\u0020|#|\/|:|\?|@|\[|\\|\]/)!==-1}function Jo(n){return Bd[n]!==void 0}function re(n){return Jo(n.scheme)}function Hc(n){return Bd[n]}function Rd(n){let e=n.toString(16).toUpperCase();return e.length===1&&(e="0"+e),"%"+e}function Gc(n){let e=new Buffer(n),t="";for(let a=0;a<e.length;++a)t+=Rd(e[a]);return t}function Yc(n){let e=new Buffer(n),t=[];for(let a=0;a<e.length;++a)e[a]!==37?t.push(e[a]):e[a]===37&&Ve(e[a+1])&&Ve(e[a+2])?(t.push(parseInt(e.slice(a+1,a+3).toString(),16)),a+=2):t.push(e[a]);return new Buffer(t).toString()}function fs(n){return n<=31||n>126}var Xc=new Set([32,34,35,60,62,63,96,123,125]);function Fd(n){return fs(n)||Xc.has(n)}var Kc=new Set([47,58,59,61,64,91,92,93,94,124]);function Qo(n){return Fd(n)||Kc.has(n)}function ea(n,e){let t=String.fromCodePoint(n);return e(n)?Gc(t):t}function Jc(n){let e=10;return n.length>=2&&n.charAt(0)==="0"&&n.charAt(1).toLowerCase()==="x"?(n=n.substring(2),e=16):n.length>=2&&n.charAt(0)==="0"&&(n=n.substring(1),e=8),n===""?0:(e===10?/[^0-9]/:e===16?/[^0-9A-Fa-f]/:/[^0-7]/).test(n)?M:parseInt(n,e)}function Zc(n){let e=n.split(".");if(e[e.length-1]===""&&e.length>1&&e.pop(),e.length>4)return n;let t=[];for(let o of e){if(o==="")return n;let i=Jc(o);if(i===M)return n;t.push(i)}for(let o=0;o<t.length-1;++o)if(t[o]>255)return M;if(t[t.length-1]>=Math.pow(256,5-t.length))return M;let a=t.pop(),s=0;for(let o of t)a+=o*Math.pow(256,3-s),++s;return a}function Qc(n){let e="",t=n;for(let a=1;a<=4;++a)e=String(t%256)+e,a!==4&&(e="."+e),t=Math.floor(t/256);return e}function em(n){let e=[0,0,0,0,0,0,0,0],t=0,a=null,s=0;if(n=Sa.ucs2.decode(n),n[s]===58){if(n[s+1]!==58)return M;s+=2,++t,a=t}for(;s<n.length;){if(t===8)return M;if(n[s]===58){if(a!==null)return M;++s,++t,a=t;continue}let o=0,i=0;for(;i<4&&Ve(n[s]);)o=o*16+parseInt(Id(n,s),16),++s,++i;if(n[s]===46){if(i===0||(s-=i,t>6))return M;let r=0;for(;n[s]!==void 0;){let d=null;if(r>0)if(n[s]===46&&r<4)++s;else return M;if(!an(n[s]))return M;for(;an(n[s]);){let p=parseInt(Id(n,s));if(d===null)d=p;else{if(d===0)return M;d=d*10+p}if(d>255)return M;++s}e[t]=e[t]*256+d,++r,(r===2||r===4)&&++t}if(r!==4)return M;break}else if(n[s]===58){if(++s,n[s]===void 0)return M}else if(n[s]!==void 0)return M;e[t]=o,++t}if(a!==null){let o=t-a;for(t=7;t!==0&&o>0;){let i=e[a+o-1];e[a+o-1]=e[t],e[t]=i,--t,--o}}else if(a===null&&t!==8)return M;return e}function tm(n){let e="",a=nm(n).idx,s=!1;for(let o=0;o<=7;++o)if(!(s&&n[o]===0)){if(s&&(s=!1),a===o){e+=o===0?"::":":",s=!0;continue}e+=n[o].toString(16),o!==7&&(e+=":")}return e}function Zo(n,e){if(n[0]==="[")return n[n.length-1]!=="]"?M:em(n.substring(1,n.length-1));if(!e)return am(n);let t=Yc(n),a=Nd.toASCII(t,!1,Nd.PROCESSING_OPTIONS.NONTRANSITIONAL,!1);if(a===null||qc(a))return M;let s=Zc(a);return typeof s=="number"||s===M?s:a}function am(n){if(Wc(n))return M;let e="",t=Sa.ucs2.decode(n);for(let a=0;a<t.length;++a)e+=ea(t[a],fs);return e}function nm(n){let e=null,t=1,a=null,s=0;for(let o=0;o<n.length;++o)n[o]!==0?(s>t&&(e=a,t=s),a=null,s=0):(a===null&&(a=o),++s);return s>t&&(e=a,t=s),{idx:e,len:t}}function ei(n){return typeof n=="number"?Qc(n):n instanceof Array?"["+tm(n)+"]":n}function sm(n){return n.replace(/^[\u0000-\u001F\u0020]+|[\u0000-\u001F\u0020]+$/g,"")}function om(n){return n.replace(/\u0009|\u000A|\u000D/g,"")}function Ld(n){let e=n.path;e.length!==0&&(n.scheme==="file"&&e.length===1&&rm(e[0])||e.pop())}function $d(n){return n.username!==""||n.password!==""}function im(n){return n.host===null||n.host===""||n.cannotBeABaseURL||n.scheme==="file"}function rm(n){return/^[A-Za-z]:$/.test(n)}function te(n,e,t,a,s){if(this.pointer=0,this.input=n,this.base=e||null,this.encodingOverride=t||"utf-8",this.stateOverride=s,this.url=a,this.failure=!1,this.parseError=!1,!this.url){this.url={scheme:"",username:"",password:"",host:null,port:null,path:[],query:null,fragment:null,cannotBeABaseURL:!1};let i=sm(this.input);i!==this.input&&(this.parseError=!0),this.input=i}let o=om(this.input);for(o!==this.input&&(this.parseError=!0),this.input=o,this.state=s||"scheme start",this.buffer="",this.atFlag=!1,this.arrFlag=!1,this.passwordTokenSeenFlag=!1,this.input=Sa.ucs2.decode(this.input);this.pointer<=this.input.length;++this.pointer){let i=this.input[this.pointer],r=isNaN(i)?void 0:String.fromCodePoint(i),d=this["parse "+this.state](i,r);if(d){if(d===M){this.failure=!0;break}}else break}}te.prototype["parse scheme start"]=function(e,t){if(nn(e))this.buffer+=t.toLowerCase(),this.state="scheme";else if(!this.stateOverride)this.state="no scheme",--this.pointer;else return this.parseError=!0,M;return!0};te.prototype["parse scheme"]=function(e,t){if(jc(e)||e===43||e===45||e===46)this.buffer+=t.toLowerCase();else if(e===58){if(this.stateOverride&&(re(this.url)&&!Jo(this.buffer)||!re(this.url)&&Jo(this.buffer)||($d(this.url)||this.url.port!==null)&&this.buffer==="file"||this.url.scheme==="file"&&(this.url.host===""||this.url.host===null))||(this.url.scheme=this.buffer,this.buffer="",this.stateOverride))return!1;this.url.scheme==="file"?((this.input[this.pointer+1]!==47||this.input[this.pointer+2]!==47)&&(this.parseError=!0),this.state="file"):re(this.url)&&this.base!==null&&this.base.scheme===this.url.scheme?this.state="special relative or authority":re(this.url)?this.state="special authority slashes":this.input[this.pointer+1]===47?(this.state="path or authority",++this.pointer):(this.url.cannotBeABaseURL=!0,this.url.path.push(""),this.state="cannot-be-a-base-URL path")}else if(!this.stateOverride)this.buffer="",this.state="no scheme",this.pointer=-1;else return this.parseError=!0,M;return!0};te.prototype["parse no scheme"]=function(e){return this.base===null||this.base.cannotBeABaseURL&&e!==35?M:(this.base.cannotBeABaseURL&&e===35?(this.url.scheme=this.base.scheme,this.url.path=this.base.path.slice(),this.url.query=this.base.query,this.url.fragment="",this.url.cannotBeABaseURL=!0,this.state="fragment"):this.base.scheme==="file"?(this.state="file",--this.pointer):(this.state="relative",--this.pointer),!0)};te.prototype["parse special relative or authority"]=function(e){return e===47&&this.input[this.pointer+1]===47?(this.state="special authority ignore slashes",++this.pointer):(this.parseError=!0,this.state="relative",--this.pointer),!0};te.prototype["parse path or authority"]=function(e){return e===47?this.state="authority":(this.state="path",--this.pointer),!0};te.prototype["parse relative"]=function(e){return this.url.scheme=this.base.scheme,isNaN(e)?(this.url.username=this.base.username,this.url.password=this.base.password,this.url.host=this.base.host,this.url.port=this.base.port,this.url.path=this.base.path.slice(),this.url.query=this.base.query):e===47?this.state="relative slash":e===63?(this.url.username=this.base.username,this.url.password=this.base.password,this.url.host=this.base.host,this.url.port=this.base.port,this.url.path=this.base.path.slice(),this.url.query="",this.state="query"):e===35?(this.url.username=this.base.username,this.url.password=this.base.password,this.url.host=this.base.host,this.url.port=this.base.port,this.url.path=this.base.path.slice(),this.url.query=this.base.query,this.url.fragment="",this.state="fragment"):re(this.url)&&e===92?(this.parseError=!0,this.state="relative slash"):(this.url.username=this.base.username,this.url.password=this.base.password,this.url.host=this.base.host,this.url.port=this.base.port,this.url.path=this.base.path.slice(0,this.base.path.length-1),this.state="path",--this.pointer),!0};te.prototype["parse relative slash"]=function(e){return re(this.url)&&(e===47||e===92)?(e===92&&(this.parseError=!0),this.state="special authority ignore slashes"):e===47?this.state="authority":(this.url.username=this.base.username,this.url.password=this.base.password,this.url.host=this.base.host,this.url.port=this.base.port,this.state="path",--this.pointer),!0};te.prototype["parse special authority slashes"]=function(e){return e===47&&this.input[this.pointer+1]===47?(this.state="special authority ignore slashes",++this.pointer):(this.parseError=!0,this.state="special authority ignore slashes",--this.pointer),!0};te.prototype["parse special authority ignore slashes"]=function(e){return e!==47&&e!==92?(this.state="authority",--this.pointer):this.parseError=!0,!0};te.prototype["parse authority"]=function(e,t){if(e===64){this.parseError=!0,this.atFlag&&(this.buffer="%40"+this.buffer),this.atFlag=!0;let a=Ad(this.buffer);for(let s=0;s<a;++s){let o=this.buffer.codePointAt(s);if(o===58&&!this.passwordTokenSeenFlag){this.passwordTokenSeenFlag=!0;continue}let i=ea(o,Qo);this.passwordTokenSeenFlag?this.url.password+=i:this.url.username+=i}this.buffer=""}else if(isNaN(e)||e===47||e===63||e===35||re(this.url)&&e===92){if(this.atFlag&&this.buffer==="")return this.parseError=!0,M;this.pointer-=Ad(this.buffer)+1,this.buffer="",this.state="host"}else this.buffer+=t;return!0};te.prototype["parse hostname"]=te.prototype["parse host"]=function(e,t){if(this.stateOverride&&this.url.scheme==="file")--this.pointer,this.state="file host";else if(e===58&&!this.arrFlag){if(this.buffer==="")return this.parseError=!0,M;let a=Zo(this.buffer,re(this.url));if(a===M)return M;if(this.url.host=a,this.buffer="",this.state="port",this.stateOverride==="hostname")return!1}else if(isNaN(e)||e===47||e===63||e===35||re(this.url)&&e===92){if(--this.pointer,re(this.url)&&this.buffer==="")return this.parseError=!0,M;if(this.stateOverride&&this.buffer===""&&($d(this.url)||this.url.port!==null))return this.parseError=!0,!1;let a=Zo(this.buffer,re(this.url));if(a===M)return M;if(this.url.host=a,this.buffer="",this.state="path start",this.stateOverride)return!1}else e===91?this.arrFlag=!0:e===93&&(this.arrFlag=!1),this.buffer+=t;return!0};te.prototype["parse port"]=function(e,t){if(an(e))this.buffer+=t;else if(isNaN(e)||e===47||e===63||e===35||re(this.url)&&e===92||this.stateOverride){if(this.buffer!==""){let a=parseInt(this.buffer);if(a>Math.pow(2,16)-1)return this.parseError=!0,M;this.url.port=a===Hc(this.url.scheme)?null:a,this.buffer=""}if(this.stateOverride)return!1;this.state="path start",--this.pointer}else return this.parseError=!0,M;return!0};var dm=new Set([47,92,63,35]);te.prototype["parse file"]=function(e){return this.url.scheme="file",e===47||e===92?(e===92&&(this.parseError=!0),this.state="file slash"):this.base!==null&&this.base.scheme==="file"?isNaN(e)?(this.url.host=this.base.host,this.url.path=this.base.path.slice(),this.url.query=this.base.query):e===63?(this.url.host=this.base.host,this.url.path=this.base.path.slice(),this.url.query="",this.state="query"):e===35?(this.url.host=this.base.host,this.url.path=this.base.path.slice(),this.url.query=this.base.query,this.url.fragment="",this.state="fragment"):(this.input.length-this.pointer-1===0||!Vc(e,this.input[this.pointer+1])||this.input.length-this.pointer-1>=2&&!dm.has(this.input[this.pointer+2])?(this.url.host=this.base.host,this.url.path=this.base.path.slice(),Ld(this.url)):this.parseError=!0,this.state="path",--this.pointer):(this.state="path",--this.pointer),!0};te.prototype["parse file slash"]=function(e){return e===47||e===92?(e===92&&(this.parseError=!0),this.state="file host"):(this.base!==null&&this.base.scheme==="file"&&(Uc(this.base.path[0])?this.url.path.push(this.base.path[0]):this.url.host=this.base.host),this.state="path",--this.pointer),!0};te.prototype["parse file host"]=function(e,t){if(isNaN(e)||e===47||e===92||e===63||e===35)if(--this.pointer,!this.stateOverride&&Dd(this.buffer))this.parseError=!0,this.state="path";else if(this.buffer===""){if(this.url.host="",this.stateOverride)return!1;this.state="path start"}else{let a=Zo(this.buffer,re(this.url));if(a===M)return M;if(a==="localhost"&&(a=""),this.url.host=a,this.stateOverride)return!1;this.buffer="",this.state="path start"}else this.buffer+=t;return!0};te.prototype["parse path start"]=function(e){return re(this.url)?(e===92&&(this.parseError=!0),this.state="path",e!==47&&e!==92&&--this.pointer):!this.stateOverride&&e===63?(this.url.query="",this.state="query"):!this.stateOverride&&e===35?(this.url.fragment="",this.state="fragment"):e!==void 0&&(this.state="path",e!==47&&--this.pointer),!0};te.prototype["parse path"]=function(e){if(isNaN(e)||e===47||re(this.url)&&e===92||!this.stateOverride&&(e===63||e===35)){if(re(this.url)&&e===92&&(this.parseError=!0),zc(this.buffer)?(Ld(this.url),e!==47&&!(re(this.url)&&e===92)&&this.url.path.push("")):Md(this.buffer)&&e!==47&&!(re(this.url)&&e===92)?this.url.path.push(""):Md(this.buffer)||(this.url.scheme==="file"&&this.url.path.length===0&&Dd(this.buffer)&&(this.url.host!==""&&this.url.host!==null&&(this.parseError=!0,this.url.host=""),this.buffer=this.buffer[0]+":"),this.url.path.push(this.buffer)),this.buffer="",this.url.scheme==="file"&&(e===void 0||e===63||e===35))for(;this.url.path.length>1&&this.url.path[0]==="";)this.parseError=!0,this.url.path.shift();e===63&&(this.url.query="",this.state="query"),e===35&&(this.url.fragment="",this.state="fragment")}else e===37&&(!Ve(this.input[this.pointer+1])||!Ve(this.input[this.pointer+2]))&&(this.parseError=!0),this.buffer+=ea(e,Fd);return!0};te.prototype["parse cannot-be-a-base-URL path"]=function(e){return e===63?(this.url.query="",this.state="query"):e===35?(this.url.fragment="",this.state="fragment"):(!isNaN(e)&&e!==37&&(this.parseError=!0),e===37&&(!Ve(this.input[this.pointer+1])||!Ve(this.input[this.pointer+2]))&&(this.parseError=!0),isNaN(e)||(this.url.path[0]=this.url.path[0]+ea(e,fs))),!0};te.prototype["parse query"]=function(e,t){if(isNaN(e)||!this.stateOverride&&e===35){(!re(this.url)||this.url.scheme==="ws"||this.url.scheme==="wss")&&(this.encodingOverride="utf-8");let a=new Buffer(this.buffer);for(let s=0;s<a.length;++s)a[s]<33||a[s]>126||a[s]===34||a[s]===35||a[s]===60||a[s]===62?this.url.query+=Rd(a[s]):this.url.query+=String.fromCodePoint(a[s]);this.buffer="",e===35&&(this.url.fragment="",this.state="fragment")}else e===37&&(!Ve(this.input[this.pointer+1])||!Ve(this.input[this.pointer+2]))&&(this.parseError=!0),this.buffer+=t;return!0};te.prototype["parse fragment"]=function(e){return isNaN(e)||(e===0?this.parseError=!0:(e===37&&(!Ve(this.input[this.pointer+1])||!Ve(this.input[this.pointer+2]))&&(this.parseError=!0),this.url.fragment+=ea(e,fs))),!0};function pm(n,e){let t=n.scheme+":";if(n.host!==null?(t+="//",(n.username!==""||n.password!=="")&&(t+=n.username,n.password!==""&&(t+=":"+n.password),t+="@"),t+=ei(n.host),n.port!==null&&(t+=":"+n.port)):n.host===null&&n.scheme==="file"&&(t+="//"),n.cannotBeABaseURL)t+=n.path[0];else for(let a of n.path)t+="/"+a;return n.query!==null&&(t+="?"+n.query),!e&&n.fragment!==null&&(t+="#"+n.fragment),t}function lm(n){let e=n.scheme+"://";return e+=ei(n.host),n.port!==null&&(e+=":"+n.port),e}Ae.exports.serializeURL=pm;Ae.exports.serializeURLOrigin=function(n){switch(n.scheme){case"blob":try{return Ae.exports.serializeURLOrigin(Ae.exports.parseURL(n.path[0]))}catch{return"null"}case"ftp":case"gopher":case"http":case"https":case"ws":case"wss":return lm({scheme:n.scheme,host:n.host,port:n.port});case"file":return"file://";default:return"null"}};Ae.exports.basicURLParse=function(n,e){e===void 0&&(e={});let t=new te(n,e.baseURL,e.encodingOverride,e.url,e.stateOverride);return t.failure?"failure":t.url};Ae.exports.setTheUsername=function(n,e){n.username="";let t=Sa.ucs2.decode(e);for(let a=0;a<t.length;++a)n.username+=ea(t[a],Qo)};Ae.exports.setThePassword=function(n,e){n.password="";let t=Sa.ucs2.decode(e);for(let a=0;a<t.length;++a)n.password+=ea(t[a],Qo)};Ae.exports.serializeHost=ei;Ae.exports.cannotHaveAUsernamePasswordPort=im;Ae.exports.serializeInteger=function(n){return String(n)};Ae.exports.parseURL=function(n,e){return e===void 0&&(e={}),Ae.exports.basicURLParse(n,{baseURL:e.baseURL,encodingOverride:e.encodingOverride})}});var jd=de(Od=>{"use strict";var ae=Je();Od.implementation=class{constructor(e){let t=e[0],a=e[1],s=null;if(a!==void 0&&(s=ae.basicURLParse(a),s==="failure"))throw new TypeError("Invalid base URL");let o=ae.basicURLParse(t,{baseURL:s});if(o==="failure")throw new TypeError("Invalid URL");this._url=o}get href(){return ae.serializeURL(this._url)}set href(e){let t=ae.basicURLParse(e);if(t==="failure")throw new TypeError("Invalid URL");this._url=t}get origin(){return ae.serializeURLOrigin(this._url)}get protocol(){return this._url.scheme+":"}set protocol(e){ae.basicURLParse(e+":",{url:this._url,stateOverride:"scheme start"})}get username(){return this._url.username}set username(e){ae.cannotHaveAUsernamePasswordPort(this._url)||ae.setTheUsername(this._url,e)}get password(){return this._url.password}set password(e){ae.cannotHaveAUsernamePasswordPort(this._url)||ae.setThePassword(this._url,e)}get host(){let e=this._url;return e.host===null?"":e.port===null?ae.serializeHost(e.host):ae.serializeHost(e.host)+":"+ae.serializeInteger(e.port)}set host(e){this._url.cannotBeABaseURL||ae.basicURLParse(e,{url:this._url,stateOverride:"host"})}get hostname(){return this._url.host===null?"":ae.serializeHost(this._url.host)}set hostname(e){this._url.cannotBeABaseURL||ae.basicURLParse(e,{url:this._url,stateOverride:"hostname"})}get port(){return this._url.port===null?"":ae.serializeInteger(this._url.port)}set port(e){ae.cannotHaveAUsernamePasswordPort(this._url)||(e===""?this._url.port=null:ae.basicURLParse(e,{url:this._url,stateOverride:"port"}))}get pathname(){return this._url.cannotBeABaseURL?this._url.path[0]:this._url.path.length===0?"":"/"+this._url.path.join("/")}set pathname(e){this._url.cannotBeABaseURL||(this._url.path=[],ae.basicURLParse(e,{url:this._url,stateOverride:"path start"}))}get search(){return this._url.query===null||this._url.query===""?"":"?"+this._url.query}set search(e){let t=this._url;if(e===""){t.query=null;return}let a=e[0]==="?"?e.substring(1):e;t.query="",ae.basicURLParse(a,{url:t,stateOverride:"query"})}get hash(){return this._url.fragment===null||this._url.fragment===""?"":"#"+this._url.fragment}set hash(e){if(e===""){this._url.fragment=null;return}let t=e[0]==="#"?e.substring(1):e;this._url.fragment="",ae.basicURLParse(t,{url:this._url,stateOverride:"fragment"})}toJSON(){return this.href}}});var Ud=de((L0,sn)=>{"use strict";var Be=wd(),Vd=xd(),zd=jd(),G=Vd.implSymbol;function pe(n){if(!this||this[G]||!(this instanceof pe))throw new TypeError("Failed to construct 'URL': Please use the 'new' operator, this DOM object constructor cannot be called as a function.");if(arguments.length<1)throw new TypeError("Failed to construct 'URL': 1 argument required, but only "+arguments.length+" present.");let e=[];for(let t=0;t<arguments.length&&t<2;++t)e[t]=arguments[t];e[0]=Be.USVString(e[0]),e[1]!==void 0&&(e[1]=Be.USVString(e[1])),sn.exports.setup(this,e)}pe.prototype.toJSON=function(){if(!this||!sn.exports.is(this))throw new TypeError("Illegal invocation");let e=[];for(let t=0;t<arguments.length&&t<0;++t)e[t]=arguments[t];return this[G].toJSON.apply(this[G],e)};Object.defineProperty(pe.prototype,"href",{get(){return this[G].href},set(n){n=Be.USVString(n),this[G].href=n},enumerable:!0,configurable:!0});pe.prototype.toString=function(){if(!this||!sn.exports.is(this))throw new TypeError("Illegal invocation");return this.href};Object.defineProperty(pe.prototype,"origin",{get(){return this[G].origin},enumerable:!0,configurable:!0});Object.defineProperty(pe.prototype,"protocol",{get(){return this[G].protocol},set(n){n=Be.USVString(n),this[G].protocol=n},enumerable:!0,configurable:!0});Object.defineProperty(pe.prototype,"username",{get(){return this[G].username},set(n){n=Be.USVString(n),this[G].username=n},enumerable:!0,configurable:!0});Object.defineProperty(pe.prototype,"password",{get(){return this[G].password},set(n){n=Be.USVString(n),this[G].password=n},enumerable:!0,configurable:!0});Object.defineProperty(pe.prototype,"host",{get(){return this[G].host},set(n){n=Be.USVString(n),this[G].host=n},enumerable:!0,configurable:!0});Object.defineProperty(pe.prototype,"hostname",{get(){return this[G].hostname},set(n){n=Be.USVString(n),this[G].hostname=n},enumerable:!0,configurable:!0});Object.defineProperty(pe.prototype,"port",{get(){return this[G].port},set(n){n=Be.USVString(n),this[G].port=n},enumerable:!0,configurable:!0});Object.defineProperty(pe.prototype,"pathname",{get(){return this[G].pathname},set(n){n=Be.USVString(n),this[G].pathname=n},enumerable:!0,configurable:!0});Object.defineProperty(pe.prototype,"search",{get(){return this[G].search},set(n){n=Be.USVString(n),this[G].search=n},enumerable:!0,configurable:!0});Object.defineProperty(pe.prototype,"hash",{get(){return this[G].hash},set(n){n=Be.USVString(n),this[G].hash=n},enumerable:!0,configurable:!0});sn.exports={is(n){return!!n&&n[G]instanceof zd.implementation},create(n,e){let t=Object.create(pe.prototype);return this.setup(t,n,e),t},setup(n,e,t){t||(t={}),t.wrapper=n,n[G]=new zd.implementation(e,t),n[G][Vd.wrapperSymbol]=n},interface:pe,expose:{Window:{URL:pe},Worker:{URL:pe}}}});var qd=de(Ze=>{"use strict";Ze.URL=Ud().interface;Ze.serializeURL=Je().serializeURL;Ze.serializeURLOrigin=Je().serializeURLOrigin;Ze.basicURLParse=Je().basicURLParse;Ze.setTheUsername=Je().setTheUsername;Ze.setThePassword=Je().setThePassword;Ze.serializeHost=Je().serializeHost;Ze.serializeInteger=Je().serializeInteger;Ze.parseURL=Je().parseURL});var ap=de((qe,tp)=>{"use strict";Object.defineProperty(qe,"__esModule",{value:!0});function Ta(n){return n&&typeof n=="object"&&"default"in n?n.default:n}var Ue=Ta(require("stream")),Yd=Ta(require("http")),bs=Ta(require("url")),Xd=Ta(qd()),cm=Ta(require("https")),ta=Ta(require("zlib")),mm=Ue.Readable,lt=Symbol("buffer"),ti=Symbol("type"),rn=class n{constructor(){this[ti]="";let e=arguments[0],t=arguments[1],a=[],s=0;if(e){let i=e,r=Number(i.length);for(let d=0;d<r;d++){let p=i[d],l;p instanceof Buffer?l=p:ArrayBuffer.isView(p)?l=Buffer.from(p.buffer,p.byteOffset,p.byteLength):p instanceof ArrayBuffer?l=Buffer.from(p):p instanceof n?l=p[lt]:l=Buffer.from(typeof p=="string"?p:String(p)),s+=l.length,a.push(l)}}this[lt]=Buffer.concat(a);let o=t&&t.type!==void 0&&String(t.type).toLowerCase();o&&!/[^\u0020-\u007E]/.test(o)&&(this[ti]=o)}get size(){return this[lt].length}get type(){return this[ti]}text(){return Promise.resolve(this[lt].toString())}arrayBuffer(){let e=this[lt],t=e.buffer.slice(e.byteOffset,e.byteOffset+e.byteLength);return Promise.resolve(t)}stream(){let e=new mm;return e._read=function(){},e.push(this[lt]),e.push(null),e}toString(){return"[object Blob]"}slice(){let e=this.size,t=arguments[0],a=arguments[1],s,o;t===void 0?s=0:t<0?s=Math.max(e+t,0):s=Math.min(t,e),a===void 0?o=e:a<0?o=Math.max(e+a,0):o=Math.min(a,e);let i=Math.max(o-s,0),d=this[lt].slice(s,s+i),p=new n([],{type:arguments[2]});return p[lt]=d,p}};Object.defineProperties(rn.prototype,{size:{enumerable:!0},type:{enumerable:!0},slice:{enumerable:!0}});Object.defineProperty(rn.prototype,Symbol.toStringTag,{value:"Blob",writable:!1,enumerable:!1,configurable:!0});function he(n,e,t){Error.call(this,n),this.message=n,this.type=e,t&&(this.code=this.errno=t.code),Error.captureStackTrace(this,this.constructor)}he.prototype=Object.create(Error.prototype);he.prototype.constructor=he;he.prototype.name="FetchError";var oi;try{oi=require("encoding").convert}catch{}var mt=Symbol("Body internals"),Wd=Ue.PassThrough;function le(n){var e=this,t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},a=t.size;let s=a===void 0?0:a;var o=t.timeout;let i=o===void 0?0:o;n==null?n=null:Kd(n)?n=Buffer.from(n.toString()):pn(n)||Buffer.isBuffer(n)||(Object.prototype.toString.call(n)==="[object ArrayBuffer]"?n=Buffer.from(n):ArrayBuffer.isView(n)?n=Buffer.from(n.buffer,n.byteOffset,n.byteLength):n instanceof Ue||(n=Buffer.from(String(n)))),this[mt]={body:n,disturbed:!1,error:null},this.size=s,this.timeout=i,n instanceof Ue&&n.on("error",function(r){let d=r.name==="AbortError"?r:new he(`Invalid response body while trying to fetch ${e.url}: ${r.message}`,"system",r);e[mt].error=d})}le.prototype={get body(){return this[mt].body},get bodyUsed(){return this[mt].disturbed},arrayBuffer(){return _a.call(this).then(function(n){return n.buffer.slice(n.byteOffset,n.byteOffset+n.byteLength)})},blob(){let n=this.headers&&this.headers.get("content-type")||"";return _a.call(this).then(function(e){return Object.assign(new rn([],{type:n.toLowerCase()}),{[lt]:e})})},json(){var n=this;return _a.call(this).then(function(e){try{return JSON.parse(e.toString())}catch(t){return le.Promise.reject(new he(`invalid json response body at ${n.url} reason: ${t.message}`,"invalid-json"))}})},text(){return _a.call(this).then(function(n){return n.toString()})},buffer(){return _a.call(this)},textConverted(){var n=this;return _a.call(this).then(function(e){return um(e,n.headers)})}};Object.defineProperties(le.prototype,{body:{enumerable:!0},bodyUsed:{enumerable:!0},arrayBuffer:{enumerable:!0},blob:{enumerable:!0},json:{enumerable:!0},text:{enumerable:!0}});le.mixIn=function(n){for(let e of Object.getOwnPropertyNames(le.prototype))if(!(e in n)){let t=Object.getOwnPropertyDescriptor(le.prototype,e);Object.defineProperty(n,e,t)}};function _a(){var n=this;if(this[mt].disturbed)return le.Promise.reject(new TypeError(`body used already for: ${this.url}`));if(this[mt].disturbed=!0,this[mt].error)return le.Promise.reject(this[mt].error);let e=this.body;if(e===null)return le.Promise.resolve(Buffer.alloc(0));if(pn(e)&&(e=e.stream()),Buffer.isBuffer(e))return le.Promise.resolve(e);if(!(e instanceof Ue))return le.Promise.resolve(Buffer.alloc(0));let t=[],a=0,s=!1;return new le.Promise(function(o,i){let r;n.timeout&&(r=setTimeout(function(){s=!0,i(new he(`Response timeout while trying to fetch ${n.url} (over ${n.timeout}ms)`,"body-timeout"))},n.timeout)),e.on("error",function(d){d.name==="AbortError"?(s=!0,i(d)):i(new he(`Invalid response body while trying to fetch ${n.url}: ${d.message}`,"system",d))}),e.on("data",function(d){if(!(s||d===null)){if(n.size&&a+d.length>n.size){s=!0,i(new he(`content size at ${n.url} over limit: ${n.size}`,"max-size"));return}a+=d.length,t.push(d)}}),e.on("end",function(){if(!s){clearTimeout(r);try{o(Buffer.concat(t,a))}catch(d){i(new he(`Could not create Buffer from response body for ${n.url}: ${d.message}`,"system",d))}}})})}function um(n,e){if(typeof oi!="function")throw new Error("The package `encoding` must be installed to use the textConverted() function");let t=e.get("content-type"),a="utf-8",s,o;return t&&(s=/charset=([^;]*)/i.exec(t)),o=n.slice(0,1024).toString(),!s&&o&&(s=/<meta.+?charset=(['"])(.+?)\1/i.exec(o)),!s&&o&&(s=/<meta[\s]+?http-equiv=(['"])content-type\1[\s]+?content=(['"])(.+?)\2/i.exec(o),s||(s=/<meta[\s]+?content=(['"])(.+?)\1[\s]+?http-equiv=(['"])content-type\3/i.exec(o),s&&s.pop()),s&&(s=/charset=(.*)/i.exec(s.pop()))),!s&&o&&(s=/<\?xml.+?encoding=(['"])(.+?)\1/i.exec(o)),s&&(a=s.pop(),(a==="gb2312"||a==="gbk")&&(a="gb18030")),oi(n,"UTF-8",a).toString()}function Kd(n){return typeof n!="object"||typeof n.append!="function"||typeof n.delete!="function"||typeof n.get!="function"||typeof n.getAll!="function"||typeof n.has!="function"||typeof n.set!="function"?!1:n.constructor.name==="URLSearchParams"||Object.prototype.toString.call(n)==="[object URLSearchParams]"||typeof n.sort=="function"}function pn(n){return typeof n=="object"&&typeof n.arrayBuffer=="function"&&typeof n.type=="string"&&typeof n.stream=="function"&&typeof n.constructor=="function"&&typeof n.constructor.name=="string"&&/^(Blob|File)$/.test(n.constructor.name)&&/^(Blob|File)$/.test(n[Symbol.toStringTag])}function Jd(n){let e,t,a=n.body;if(n.bodyUsed)throw new Error("cannot clone body after it is used");return a instanceof Ue&&typeof a.getBoundary!="function"&&(e=new Wd,t=new Wd,a.pipe(e),a.pipe(t),n[mt].body=e,a=t),a}function Zd(n){return n===null?null:typeof n=="string"?"text/plain;charset=UTF-8":Kd(n)?"application/x-www-form-urlencoded;charset=UTF-8":pn(n)?n.type||null:Buffer.isBuffer(n)||Object.prototype.toString.call(n)==="[object ArrayBuffer]"||ArrayBuffer.isView(n)?null:typeof n.getBoundary=="function"?`multipart/form-data;boundary=${n.getBoundary()}`:n instanceof Ue?null:"text/plain;charset=UTF-8"}function Qd(n){let e=n.body;return e===null?0:pn(e)?e.size:Buffer.isBuffer(e)?e.length:e&&typeof e.getLengthSync=="function"&&(e._lengthRetrievers&&e._lengthRetrievers.length==0||e.hasKnownLength&&e.hasKnownLength())?e.getLengthSync():null}function gm(n,e){let t=e.body;t===null?n.end():pn(t)?t.stream().pipe(n):Buffer.isBuffer(t)?(n.write(t),n.end()):t.pipe(n)}le.Promise=global.Promise;var ep=/[^\^_`a-zA-Z\-0-9!#$%&'*+.|~]/,ii=/[^\t\x20-\x7e\x80-\xff]/;function on(n){if(n=`${n}`,ep.test(n)||n==="")throw new TypeError(`${n} is not a legal HTTP header name`)}function Hd(n){if(n=`${n}`,ii.test(n))throw new TypeError(`${n} is not a legal HTTP header value`)}function Ca(n,e){e=e.toLowerCase();for(let t in n)if(t.toLowerCase()===e)return t}var ne=Symbol("map"),Re=class n{constructor(){let e=arguments.length>0&&arguments[0]!==void 0?arguments[0]:void 0;if(this[ne]=Object.create(null),e instanceof n){let t=e.raw(),a=Object.keys(t);for(let s of a)for(let o of t[s])this.append(s,o);return}if(e!=null)if(typeof e=="object"){let t=e[Symbol.iterator];if(t!=null){if(typeof t!="function")throw new TypeError("Header pairs must be iterable");let a=[];for(let s of e){if(typeof s!="object"||typeof s[Symbol.iterator]!="function")throw new TypeError("Each header pair must be iterable");a.push(Array.from(s))}for(let s of a){if(s.length!==2)throw new TypeError("Each header pair must be a name/value tuple");this.append(s[0],s[1])}}else for(let a of Object.keys(e)){let s=e[a];this.append(a,s)}}else throw new TypeError("Provided initializer must be an object")}get(e){e=`${e}`,on(e);let t=Ca(this[ne],e);return t===void 0?null:this[ne][t].join(", ")}forEach(e){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:void 0,a=ri(this),s=0;for(;s<a.length;){var o=a[s];let i=o[0],r=o[1];e.call(t,r,i,this),a=ri(this),s++}}set(e,t){e=`${e}`,t=`${t}`,on(e),Hd(t);let a=Ca(this[ne],e);this[ne][a!==void 0?a:e]=[t]}append(e,t){e=`${e}`,t=`${t}`,on(e),Hd(t);let a=Ca(this[ne],e);a!==void 0?this[ne][a].push(t):this[ne][e]=[t]}has(e){return e=`${e}`,on(e),Ca(this[ne],e)!==void 0}delete(e){e=`${e}`,on(e);let t=Ca(this[ne],e);t!==void 0&&delete this[ne][t]}raw(){return this[ne]}keys(){return ai(this,"key")}values(){return ai(this,"value")}[Symbol.iterator](){return ai(this,"key+value")}};Re.prototype.entries=Re.prototype[Symbol.iterator];Object.defineProperty(Re.prototype,Symbol.toStringTag,{value:"Headers",writable:!1,enumerable:!1,configurable:!0});Object.defineProperties(Re.prototype,{get:{enumerable:!0},forEach:{enumerable:!0},set:{enumerable:!0},append:{enumerable:!0},has:{enumerable:!0},delete:{enumerable:!0},keys:{enumerable:!0},values:{enumerable:!0},entries:{enumerable:!0}});function ri(n){let e=arguments.length>1&&arguments[1]!==void 0?arguments[1]:"key+value";return Object.keys(n[ne]).sort().map(e==="key"?function(a){return a.toLowerCase()}:e==="value"?function(a){return n[ne][a].join(", ")}:function(a){return[a.toLowerCase(),n[ne][a].join(", ")]})}var di=Symbol("internal");function ai(n,e){let t=Object.create(pi);return t[di]={target:n,kind:e,index:0},t}var pi=Object.setPrototypeOf({next(){if(!this||Object.getPrototypeOf(this)!==pi)throw new TypeError("Value of `this` is not a HeadersIterator");var n=this[di];let e=n.target,t=n.kind,a=n.index,s=ri(e,t),o=s.length;return a>=o?{value:void 0,done:!0}:(this[di].index=a+1,{value:s[a],done:!1})}},Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]())));Object.defineProperty(pi,Symbol.toStringTag,{value:"HeadersIterator",writable:!1,enumerable:!1,configurable:!0});function hm(n){let e=Object.assign({__proto__:null},n[ne]),t=Ca(n[ne],"Host");return t!==void 0&&(e[t]=e[t][0]),e}function fm(n){let e=new Re;for(let t of Object.keys(n))if(!ep.test(t))if(Array.isArray(n[t]))for(let a of n[t])ii.test(a)||(e[ne][t]===void 0?e[ne][t]=[a]:e[ne][t].push(a));else ii.test(n[t])||(e[ne][t]=[n[t]]);return e}var Bt=Symbol("Response internals"),vm=Yd.STATUS_CODES,De=class n{constructor(){let e=arguments.length>0&&arguments[0]!==void 0?arguments[0]:null,t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{};le.call(this,e,t);let a=t.status||200,s=new Re(t.headers);if(e!=null&&!s.has("Content-Type")){let o=Zd(e);o&&s.append("Content-Type",o)}this[Bt]={url:t.url,status:a,statusText:t.statusText||vm[a],headers:s,counter:t.counter}}get url(){return this[Bt].url||""}get status(){return this[Bt].status}get ok(){return this[Bt].status>=200&&this[Bt].status<300}get redirected(){return this[Bt].counter>0}get statusText(){return this[Bt].statusText}get headers(){return this[Bt].headers}clone(){return new n(Jd(this),{url:this.url,status:this.status,statusText:this.statusText,headers:this.headers,ok:this.ok,redirected:this.redirected})}};le.mixIn(De.prototype);Object.defineProperties(De.prototype,{url:{enumerable:!0},status:{enumerable:!0},ok:{enumerable:!0},redirected:{enumerable:!0},statusText:{enumerable:!0},headers:{enumerable:!0},clone:{enumerable:!0}});Object.defineProperty(De.prototype,Symbol.toStringTag,{value:"Response",writable:!1,enumerable:!1,configurable:!0});var ct=Symbol("Request internals"),bm=bs.URL||Xd.URL,ym=bs.parse,wm=bs.format;function ni(n){return/^[a-zA-Z][a-zA-Z\d+\-.]*:/.exec(n)&&(n=new bm(n).toString()),ym(n)}var xm="destroy"in Ue.Readable.prototype;function vs(n){return typeof n=="object"&&typeof n[ct]=="object"}function km(n){let e=n&&typeof n=="object"&&Object.getPrototypeOf(n);return!!(e&&e.constructor.name==="AbortSignal")}var Rt=class n{constructor(e){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},a;vs(e)?a=ni(e.url):(e&&e.href?a=ni(e.href):a=ni(`${e}`),e={});let s=t.method||e.method||"GET";if(s=s.toUpperCase(),(t.body!=null||vs(e)&&e.body!==null)&&(s==="GET"||s==="HEAD"))throw new TypeError("Request with GET/HEAD method cannot have body");let o=t.body!=null?t.body:vs(e)&&e.body!==null?Jd(e):null;le.call(this,o,{timeout:t.timeout||e.timeout||0,size:t.size||e.size||0});let i=new Re(t.headers||e.headers||{});if(o!=null&&!i.has("Content-Type")){let d=Zd(o);d&&i.append("Content-Type",d)}let r=vs(e)?e.signal:null;if("signal"in t&&(r=t.signal),r!=null&&!km(r))throw new TypeError("Expected signal to be an instanceof AbortSignal");this[ct]={method:s,redirect:t.redirect||e.redirect||"follow",headers:i,parsedURL:a,signal:r},this.follow=t.follow!==void 0?t.follow:e.follow!==void 0?e.follow:20,this.compress=t.compress!==void 0?t.compress:e.compress!==void 0?e.compress:!0,this.counter=t.counter||e.counter||0,this.agent=t.agent||e.agent}get method(){return this[ct].method}get url(){return wm(this[ct].parsedURL)}get headers(){return this[ct].headers}get redirect(){return this[ct].redirect}get signal(){return this[ct].signal}clone(){return new n(this)}};le.mixIn(Rt.prototype);Object.defineProperty(Rt.prototype,Symbol.toStringTag,{value:"Request",writable:!1,enumerable:!1,configurable:!0});Object.defineProperties(Rt.prototype,{method:{enumerable:!0},url:{enumerable:!0},headers:{enumerable:!0},redirect:{enumerable:!0},clone:{enumerable:!0},signal:{enumerable:!0}});function Sm(n){let e=n[ct].parsedURL,t=new Re(n[ct].headers);if(t.has("Accept")||t.set("Accept","*/*"),!e.protocol||!e.hostname)throw new TypeError("Only absolute URLs are supported");if(!/^https?:$/.test(e.protocol))throw new TypeError("Only HTTP(S) protocols are supported");if(n.signal&&n.body instanceof Ue.Readable&&!xm)throw new Error("Cancellation of streamed requests with AbortSignal is not supported in node < 8");let a=null;if(n.body==null&&/^(POST|PUT)$/i.test(n.method)&&(a="0"),n.body!=null){let o=Qd(n);typeof o=="number"&&(a=String(o))}a&&t.set("Content-Length",a),t.has("User-Agent")||t.set("User-Agent","node-fetch/1.0 (+https://github.com/bitinn/node-fetch)"),n.compress&&!t.has("Accept-Encoding")&&t.set("Accept-Encoding","gzip,deflate");let s=n.agent;return typeof s=="function"&&(s=s(e)),Object.assign({},e,{method:n.method,headers:hm(t),agent:s})}function Pa(n){Error.call(this,n),this.type="aborted",this.message=n,Error.captureStackTrace(this,this.constructor)}Pa.prototype=Object.create(Error.prototype);Pa.prototype.constructor=Pa;Pa.prototype.name="AbortError";var dn=bs.URL||Xd.URL,Gd=Ue.PassThrough,_m=function(e,t){let a=new dn(t).hostname,s=new dn(e).hostname;return a===s||a[a.length-s.length-1]==="."&&a.endsWith(s)},Cm=function(e,t){let a=new dn(t).protocol,s=new dn(e).protocol;return a===s};function Dt(n,e){if(!Dt.Promise)throw new Error("native promise missing, set fetch.Promise to your favorite alternative");return le.Promise=Dt.Promise,new Dt.Promise(function(t,a){let s=new Rt(n,e),o=Sm(s),i=(o.protocol==="https:"?cm:Yd).request,r=s.signal,d=null,p=function(){let x=new Pa("The user aborted a request.");a(x),s.body&&s.body instanceof Ue.Readable&&si(s.body,x),!(!d||!d.body)&&d.body.emit("error",x)};if(r&&r.aborted){p();return}let l=function(){p(),u()},c=i(o),m;r&&r.addEventListener("abort",l);function u(){c.abort(),r&&r.removeEventListener("abort",l),clearTimeout(m)}s.timeout&&c.once("socket",function(g){m=setTimeout(function(){a(new he(`network timeout at: ${s.url}`,"request-timeout")),u()},s.timeout)}),c.on("error",function(g){a(new he(`request to ${s.url} failed, reason: ${g.message}`,"system",g)),d&&d.body&&si(d.body,g),u()}),Pm(c,function(g){r&&r.aborted||d&&d.body&&si(d.body,g)}),parseInt(process.version.substring(1))<14&&c.on("socket",function(g){g.addListener("close",function(x){let v=g.listenerCount("data")>0;if(d&&v&&!x&&!(r&&r.aborted)){let h=new Error("Premature close");h.code="ERR_STREAM_PREMATURE_CLOSE",d.body.emit("error",h)}})}),c.on("response",function(g){clearTimeout(m);let x=fm(g.headers);if(Dt.isRedirect(g.statusCode)){let k=x.get("Location"),F=null;try{F=k===null?null:new dn(k,s.url).toString()}catch{if(s.redirect!=="manual"){a(new he(`uri requested responds with an invalid redirect URL: ${k}`,"invalid-redirect")),u();return}}switch(s.redirect){case"error":a(new he(`uri requested responds with a redirect, redirect mode is set to error: ${s.url}`,"no-redirect")),u();return;case"manual":if(F!==null)try{x.set("Location",F)}catch(ue){a(ue)}break;case"follow":if(F===null)break;if(s.counter>=s.follow){a(new he(`maximum redirect reached at: ${s.url}`,"max-redirect")),u();return}let q={headers:new Re(s.headers),follow:s.follow,counter:s.counter+1,agent:s.agent,compress:s.compress,method:s.method,body:s.body,signal:s.signal,timeout:s.timeout,size:s.size};if(!_m(s.url,F)||!Cm(s.url,F))for(let ue of["authorization","www-authenticate","cookie","cookie2"])q.headers.delete(ue);if(g.statusCode!==303&&s.body&&Qd(s)===null){a(new he("Cannot follow redirect with body being a readable stream","unsupported-redirect")),u();return}(g.statusCode===303||(g.statusCode===301||g.statusCode===302)&&s.method==="POST")&&(q.method="GET",q.body=void 0,q.headers.delete("content-length")),t(Dt(new Rt(F,q))),u();return}}g.once("end",function(){r&&r.removeEventListener("abort",l)});let v=g.pipe(new Gd),h={url:s.url,status:g.statusCode,statusText:g.statusMessage,headers:x,size:s.size,timeout:s.timeout,counter:s.counter},y=x.get("Content-Encoding");if(!s.compress||s.method==="HEAD"||y===null||g.statusCode===204||g.statusCode===304){d=new De(v,h),t(d);return}let T={flush:ta.Z_SYNC_FLUSH,finishFlush:ta.Z_SYNC_FLUSH};if(y=="gzip"||y=="x-gzip"){v=v.pipe(ta.createGunzip(T)),d=new De(v,h),t(d);return}if(y=="deflate"||y=="x-deflate"){let k=g.pipe(new Gd);k.once("data",function(F){(F[0]&15)===8?v=v.pipe(ta.createInflate()):v=v.pipe(ta.createInflateRaw()),d=new De(v,h),t(d)}),k.on("end",function(){d||(d=new De(v,h),t(d))});return}if(y=="br"&&typeof ta.createBrotliDecompress=="function"){v=v.pipe(ta.createBrotliDecompress()),d=new De(v,h),t(d);return}d=new De(v,h),t(d)}),gm(c,s)})}function Pm(n,e){let t;n.on("socket",function(a){t=a}),n.on("response",function(a){let s=a.headers;s["transfer-encoding"]==="chunked"&&!s["content-length"]&&a.once("close",function(o){if(t&&t.listenerCount("data")>0&&!o){let r=new Error("Premature close");r.code="ERR_STREAM_PREMATURE_CLOSE",e(r)}})})}function si(n,e){n.destroy?n.destroy(e):(n.emit("error",e),n.end())}Dt.isRedirect=function(n){return n===301||n===302||n===303||n===307||n===308};Dt.Promise=global.Promise;tp.exports=qe=Dt;Object.defineProperty(qe,"__esModule",{value:!0});qe.default=qe;qe.Headers=Re;qe.Request=Rt;qe.Response=De;qe.FetchError=he;qe.AbortError=Pa});function Tp(){}function be(n){return typeof n=="object"&&n!==null||typeof n=="function"}function j(n,e){try{Object.defineProperty(n,"name",{value:e,configurable:!0})}catch{}}function ke(n){return new ki(n)}function U(n){return Em(n)}function P(n){return Nm(n)}function yt(n,e,t){return Tm.call(n,e,t)}function ve(n,e,t){yt(yt(n,e,t),void 0,Ep)}function np(n,e){ve(n,e)}function sp(n,e){ve(n,void 0,e)}function We(n,e,t){return yt(n,e,t)}function Ia(n){yt(n,void 0,Ep)}function zs(n,e,t){if(typeof n!="function")throw new TypeError("Argument is not a function");return Function.prototype.apply.call(n,e,t)}function da(n,e,t){try{return U(zs(n,e,t))}catch(a){return P(a)}}function Ip(n,e){n._ownerReadableStream=e,e._reader=n,e._state==="readable"?hi(n):e._state==="closed"?(function(t){hi(t),Rp(t)})(n):Dp(n,e._storedError)}function Mp(n,e){return cl(n._ownerReadableStream,e)}function Bp(n){let e=n._ownerReadableStream;e._state==="readable"?Pi(n,new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")):(function(t,a){Dp(t,a)})(n,new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")),e._readableStreamController[Ci](),e._reader=void 0,n._ownerReadableStream=void 0}function Ma(n){return new TypeError("Cannot "+n+" a stream using a released reader")}function hi(n){n._closedPromise=ke(((e,t)=>{n._closedPromise_resolve=e,n._closedPromise_reject=t}))}function Dp(n,e){hi(n),Pi(n,e)}function Pi(n,e){n._closedPromise_reject!==void 0&&(Ia(n._closedPromise),n._closedPromise_reject(e),n._closedPromise_resolve=void 0,n._closedPromise_reject=void 0)}function Rp(n){n._closedPromise_resolve!==void 0&&(n._closedPromise_resolve(void 0),n._closedPromise_resolve=void 0,n._closedPromise_reject=void 0)}function wt(n,e){if(n!==void 0&&typeof(t=n)!="object"&&typeof t!="function")throw new TypeError(`${e} is not an object.`);var t}function He(n,e){if(typeof n!="function")throw new TypeError(`${e} is not a function.`)}function Fp(n,e){if(!(function(t){return typeof t=="object"&&t!==null||typeof t=="function"})(n))throw new TypeError(`${e} is not an object.`)}function xt(n,e,t){if(n===void 0)throw new TypeError(`Parameter ${e} is required in '${t}'.`)}function fi(n,e,t){if(n===void 0)throw new TypeError(`${e} is required in '${t}'.`)}function Ti(n){return Number(n)}function ip(n){return n===0?0:n}function Lp(n,e){let t=Number.MAX_SAFE_INTEGER,a=Number(n);if(a=ip(a),!op(a))throw new TypeError(`${e} is not a finite number`);if(a=(function(s){return ip(Am(s))})(a),a<0||a>t)throw new TypeError(`${e} is outside the accepted range of 0 to ${t}, inclusive`);return op(a)&&a!==0?a:0}function mn(n){if(!be(n)||typeof n.getReader!="function")return!1;try{return typeof n.locked=="boolean"}catch{return!1}}function $p(n){if(!be(n)||typeof n.getWriter!="function")return!1;try{return typeof n.locked=="boolean"}catch{return!1}}function Op(n,e){if(!ia(n))throw new TypeError(`${e} is not a ReadableStream.`)}function jp(n,e){n._reader._readRequests.push(e)}function Ei(n,e,t){let a=n._reader._readRequests.shift();t?a._closeSteps():a._chunkSteps(e)}function Vs(n){return n._reader._readRequests.length}function zp(n){let e=n._reader;return e!==void 0&&!!oa(e)}function oa(n){return!!be(n)&&!!Object.prototype.hasOwnProperty.call(n,"_readRequests")&&n instanceof ut}function Vp(n,e){let t=n._readRequests;n._readRequests=new Ce,t.forEach((a=>{a._errorSteps(e)}))}function ys(n){return new TypeError(`ReadableStreamDefaultReader.prototype.${n} can only be used on a ReadableStreamDefaultReader`)}function rp(n){if(!be(n)||!Object.prototype.hasOwnProperty.call(n,"_asyncIteratorImpl"))return!1;try{return n._asyncIteratorImpl instanceof Ms}catch{return!1}}function dp(n){return new TypeError(`ReadableStreamAsyncIterator.${n} can only be used on a ReadableSteamAsyncIterator`)}function Wp(n,e,t,a,s){new Uint8Array(n).set(new Uint8Array(t,a,s),e)}function pp(n){let e=(function(t,a,s){if(t.slice)return t.slice(a,s);let o=s-a,i=new ArrayBuffer(o);return Wp(i,0,t,a,o),i})(n.buffer,n.byteOffset,n.byteOffset+n.byteLength);return new Uint8Array(e)}function vi(n){let e=n._queue.shift();return n._queueTotalSize-=e.size,n._queueTotalSize<0&&(n._queueTotalSize=0),e.value}function Ni(n,e,t){if(typeof(a=t)!="number"||qp(a)||a<0||t===1/0)throw new RangeError("Size must be a finite, non-NaN, non-negative number.");var a;n._queue.push({value:e,size:t}),n._queueTotalSize+=t}function $t(n){n._queue=new Ce,n._queueTotalSize=0}function Ea(n){return!!be(n)&&!!Object.prototype.hasOwnProperty.call(n,"_controlledReadableByteStream")&&n instanceof gt}function li(n){return!!be(n)&&!!Object.prototype.hasOwnProperty.call(n,"_associatedReadableByteStreamController")&&n instanceof Ft}function ra(n){if((function(t){let a=t._controlledReadableByteStream;return a._state!=="readable"||t._closeRequested||!t._started?!1:!!(zp(a)&&Vs(a)>0||Ii(a)&&el(a)>0||Qp(t)>0)})(n)){if(n._pulling)return void(n._pullAgain=!0);n._pulling=!0,ve(n._pullAlgorithm(),(()=>(n._pulling=!1,n._pullAgain&&(n._pullAgain=!1,ra(n)),null)),(t=>(Ba(n,t),null)))}}function Hp(n){Ai(n),n._pendingPullIntos=new Ce}function bi(n,e){let t=!1;n._state==="closed"&&(t=!0);let a=Gp(e);e.readerType==="default"?Ei(n,a,t):(function(s,o,i){let r=s._reader._readIntoRequests.shift();i?r._closeSteps(o):r._chunkSteps(o)})(n,a,t)}function Gp(n){let e=n.bytesFilled,t=n.elementSize;return new n.viewConstructor(n.buffer,n.byteOffset,e/t)}function Es(n,e,t,a){n._queue.push({buffer:e,byteOffset:t,byteLength:a}),n._queueTotalSize+=a}function Yp(n,e,t,a){let s;try{s=e.slice(t,t+a)}catch(o){throw Ba(n,o),o}Es(n,s,0,a)}function Xp(n,e){e.bytesFilled>0&&Yp(n,e.buffer,e.byteOffset,e.bytesFilled),Aa(n)}function Kp(n,e){let t=e.elementSize,a=e.bytesFilled-e.bytesFilled%t,s=Math.min(n._queueTotalSize,e.byteLength-e.bytesFilled),o=e.bytesFilled+s,i=o-o%t,r=s,d=!1;i>a&&(r=i-e.bytesFilled,d=!0);let p=n._queue;for(;r>0;){let l=p.peek(),c=Math.min(r,l.byteLength),m=e.byteOffset+e.bytesFilled;Wp(e.buffer,m,l.buffer,l.byteOffset,c),l.byteLength===c?p.shift():(l.byteOffset+=c,l.byteLength-=c),n._queueTotalSize-=c,Jp(n,c,e),r-=c}return d}function Jp(n,e,t){t.bytesFilled+=e}function Zp(n){n._queueTotalSize===0&&n._closeRequested?(Bs(n),vn(n._controlledReadableByteStream)):ra(n)}function Ai(n){n._byobRequest!==null&&(n._byobRequest._associatedReadableByteStreamController=void 0,n._byobRequest._view=null,n._byobRequest=null)}function yi(n){for(;n._pendingPullIntos.length>0;){if(n._queueTotalSize===0)return;let e=n._pendingPullIntos.peek();Kp(n,e)&&(Aa(n),bi(n._controlledReadableByteStream,e))}}function lp(n,e){let t=n._pendingPullIntos.peek();Ai(n),n._controlledReadableByteStream._state==="closed"?(function(a,s){s.readerType==="none"&&Aa(a);let o=a._controlledReadableByteStream;if(Ii(o))for(;el(o)>0;)bi(o,Aa(a))})(n,t):(function(a,s,o){if(Jp(0,s,o),o.readerType==="none")return Xp(a,o),void yi(a);if(o.bytesFilled<o.elementSize)return;Aa(a);let i=o.bytesFilled%o.elementSize;if(i>0){let r=o.byteOffset+o.bytesFilled;Yp(a,o.buffer,r-i,i)}o.bytesFilled-=i,bi(a._controlledReadableByteStream,o),yi(a)})(n,e,t),ra(n)}function Aa(n){return n._pendingPullIntos.shift()}function Bs(n){n._pullAlgorithm=void 0,n._cancelAlgorithm=void 0}function Ba(n,e){let t=n._controlledReadableByteStream;t._state==="readable"&&(Hp(n),$t(n),Bs(n),ml(t,e))}function cp(n,e){let t=n._queue.shift();n._queueTotalSize-=t.byteLength,Zp(n);let a=new Uint8Array(t.buffer,t.byteOffset,t.byteLength);e._chunkSteps(a)}function Qp(n){let e=n._controlledReadableByteStream._state;return e==="errored"?null:e==="closed"?0:n._strategyHWM-n._queueTotalSize}function Im(n,e,t){let a=Object.create(gt.prototype),s,o,i;s=e.start!==void 0?()=>e.start(a):()=>{},o=e.pull!==void 0?()=>e.pull(a):()=>U(void 0),i=e.cancel!==void 0?d=>e.cancel(d):()=>U(void 0);let r=e.autoAllocateChunkSize;if(r===0)throw new TypeError("autoAllocateChunkSize must be greater than 0");(function(d,p,l,c,m,u,g){p._controlledReadableByteStream=d,p._pullAgain=!1,p._pulling=!1,p._byobRequest=null,p._queue=p._queueTotalSize=void 0,$t(p),p._closeRequested=!1,p._started=!1,p._strategyHWM=u,p._pullAlgorithm=c,p._cancelAlgorithm=m,p._autoAllocateChunkSize=g,p._pendingPullIntos=new Ce,d._readableStreamController=p,ve(U(l()),(()=>(p._started=!0,ra(p),null)),(x=>(Ba(p,x),null)))})(n,a,s,o,i,t,r)}function ci(n){return new TypeError(`ReadableStreamBYOBRequest.prototype.${n} can only be used on a ReadableStreamBYOBRequest`)}function ln(n){return new TypeError(`ReadableByteStreamController.prototype.${n} can only be used on a ReadableByteStreamController`)}function mp(n,e){n._reader._readIntoRequests.push(e)}function el(n){return n._reader._readIntoRequests.length}function Ii(n){let e=n._reader;return e!==void 0&&!!Na(e)}function Na(n){return!!be(n)&&!!Object.prototype.hasOwnProperty.call(n,"_readIntoRequests")&&n instanceof ht}function tl(n,e){let t=n._readIntoRequests;n._readIntoRequests=new Ce,t.forEach((a=>{a._errorSteps(e)}))}function ws(n){return new TypeError(`ReadableStreamBYOBReader.prototype.${n} can only be used on a ReadableStreamBYOBReader`)}function fn(n,e){let{highWaterMark:t}=n;if(t===void 0)return e;if(qp(t)||t<0)throw new RangeError("Invalid highWaterMark");return t}function Ds(n){let{size:e}=n;return e||(()=>1)}function Rs(n,e){wt(n,e);let t=n?.highWaterMark,a=n?.size;return{highWaterMark:t===void 0?void 0:Ti(t),size:a===void 0?void 0:Mm(a,`${e} has member 'size' that`)}}function Mm(n,e){return He(n,e),t=>Ti(n(t))}function Bm(n,e,t){return He(n,t),a=>da(n,e,[a])}function Dm(n,e,t){return He(n,t),()=>da(n,e,[])}function Rm(n,e,t){return He(n,t),a=>zs(n,e,[a])}function Fm(n,e,t){return He(n,t),(a,s)=>da(n,e,[a,s])}function et(n){return!!be(n)&&!!Object.prototype.hasOwnProperty.call(n,"_writableStreamController")&&n instanceof ft}function Ns(n){return n._writer!==void 0}function al(n,e){var t;if(n._state==="closed"||n._state==="errored")return U(void 0);n._writableStreamController._abortReason=e,(t=n._writableStreamController._abortController)===null||t===void 0||t.abort(e);let a=n._state;if(a==="closed"||a==="errored")return U(void 0);if(n._pendingAbortRequest!==void 0)return n._pendingAbortRequest._promise;let s=!1;a==="erroring"&&(s=!0,e=void 0);let o=ke(((i,r)=>{n._pendingAbortRequest={_promise:void 0,_resolve:i,_reject:r,_reason:e,_wasAlreadyErroring:s}}));return n._pendingAbortRequest._promise=o,s||Mi(n,e),o}function nl(n){let e=n._state;if(e==="closed"||e==="errored")return P(new TypeError(`The stream (in ${e} state) is not in the writable state and cannot be closed`));let t=ke(((o,i)=>{let r={_resolve:o,_reject:i};n._closeRequest=r})),a=n._writer;var s;return a!==void 0&&n._backpressure&&e==="writable"&&Li(a),Ni(s=n._writableStreamController,ol,0),Us(s),t}function wi(n,e){n._state!=="writable"?Bi(n):Mi(n,e)}function Mi(n,e){let t=n._writableStreamController;n._state="erroring",n._storedError=e;let a=n._writer;a!==void 0&&sl(a,e),!(function(s){return!(s._inFlightWriteRequest===void 0&&s._inFlightCloseRequest===void 0)})(n)&&t._started&&Bi(n)}function Bi(n){n._state="errored",n._writableStreamController[Ap]();let e=n._storedError;if(n._writeRequests.forEach((a=>{a._reject(e)})),n._writeRequests=new Ce,n._pendingAbortRequest===void 0)return void xs(n);let t=n._pendingAbortRequest;if(n._pendingAbortRequest=void 0,t._wasAlreadyErroring)return t._reject(e),void xs(n);ve(n._writableStreamController[Np](t._reason),(()=>(t._resolve(),xs(n),null)),(a=>(t._reject(a),xs(n),null)))}function Lt(n){return n._closeRequest!==void 0||n._inFlightCloseRequest!==void 0}function xs(n){n._closeRequest!==void 0&&(n._closeRequest._reject(n._storedError),n._closeRequest=void 0);let e=n._writer;e!==void 0&&Fi(e,n._storedError)}function Di(n,e){let t=n._writer;t!==void 0&&e!==n._backpressure&&(e?(function(a){qs(a)})(t):Li(t)),n._backpressure=e}function aa(n){return!!be(n)&&!!Object.prototype.hasOwnProperty.call(n,"_ownerWritableStream")&&n instanceof Qe}function sl(n,e){n._readyPromiseState==="pending"?pl(n,e):(function(t,a){xi(t,a)})(n,e)}function mi(n){return!!be(n)&&!!Object.prototype.hasOwnProperty.call(n,"_controlledWritableStream")&&n instanceof Da}function Fs(n){n._writeAlgorithm=void 0,n._closeAlgorithm=void 0,n._abortAlgorithm=void 0,n._strategySizeAlgorithm=void 0}function il(n){return n._strategyHWM-n._queueTotalSize}function Us(n){let e=n._controlledWritableStream;if(!n._started||e._inFlightWriteRequest!==void 0)return;if(e._state==="erroring")return void Bi(e);if(n._queue.length===0)return;let t=n._queue.peek().value;t===ol?(function(a){let s=a._controlledWritableStream;(function(i){i._inFlightCloseRequest=i._closeRequest,i._closeRequest=void 0})(s),vi(a);let o=a._closeAlgorithm();Fs(a),ve(o,(()=>((function(i){i._inFlightCloseRequest._resolve(void 0),i._inFlightCloseRequest=void 0,i._state==="erroring"&&(i._storedError=void 0,i._pendingAbortRequest!==void 0&&(i._pendingAbortRequest._resolve(),i._pendingAbortRequest=void 0)),i._state="closed";let r=i._writer;r!==void 0&&dl(r)})(s),null)),(i=>((function(r,d){r._inFlightCloseRequest._reject(d),r._inFlightCloseRequest=void 0,r._pendingAbortRequest!==void 0&&(r._pendingAbortRequest._reject(d),r._pendingAbortRequest=void 0),wi(r,d)})(s,i),null)))})(n):(function(a,s){let o=a._controlledWritableStream;(function(i){i._inFlightWriteRequest=i._writeRequests.shift()})(o),ve(a._writeAlgorithm(s),(()=>{(function(r){r._inFlightWriteRequest._resolve(void 0),r._inFlightWriteRequest=void 0})(o);let i=o._state;if(vi(a),!Lt(o)&&i==="writable"){let r=Ri(a);Di(o,r)}return Us(a),null}),(i=>(o._state==="writable"&&Fs(a),(function(r,d){r._inFlightWriteRequest._reject(d),r._inFlightWriteRequest=void 0,wi(r,d)})(o,i),null)))})(n,t)}function up(n,e){n._controlledWritableStream._state==="writable"&&rl(n,e)}function Ri(n){return il(n)<=0}function rl(n,e){let t=n._controlledWritableStream;Fs(n),Mi(t,e)}function ks(n){return new TypeError(`WritableStream.prototype.${n} can only be used on a WritableStream`)}function ui(n){return new TypeError(`WritableStreamDefaultController.prototype.${n} can only be used on a WritableStreamDefaultController`)}function na(n){return new TypeError(`WritableStreamDefaultWriter.prototype.${n} can only be used on a WritableStreamDefaultWriter`)}function cn(n){return new TypeError("Cannot "+n+" a stream using a released writer")}function As(n){n._closedPromise=ke(((e,t)=>{n._closedPromise_resolve=e,n._closedPromise_reject=t,n._closedPromiseState="pending"}))}function gp(n,e){As(n),Fi(n,e)}function Fi(n,e){n._closedPromise_reject!==void 0&&(Ia(n._closedPromise),n._closedPromise_reject(e),n._closedPromise_resolve=void 0,n._closedPromise_reject=void 0,n._closedPromiseState="rejected")}function dl(n){n._closedPromise_resolve!==void 0&&(n._closedPromise_resolve(void 0),n._closedPromise_resolve=void 0,n._closedPromise_reject=void 0,n._closedPromiseState="resolved")}function qs(n){n._readyPromise=ke(((e,t)=>{n._readyPromise_resolve=e,n._readyPromise_reject=t})),n._readyPromiseState="pending"}function xi(n,e){qs(n),pl(n,e)}function hp(n){qs(n),Li(n)}function pl(n,e){n._readyPromise_reject!==void 0&&(Ia(n._readyPromise),n._readyPromise_reject(e),n._readyPromise_resolve=void 0,n._readyPromise_reject=void 0,n._readyPromiseState="rejected")}function Li(n){n._readyPromise_resolve!==void 0&&(n._readyPromise_resolve(void 0),n._readyPromise_resolve=void 0,n._readyPromise_reject=void 0,n._readyPromiseState="fulfilled")}function vp(n,e,t,a,s,o){let i=n.getReader(),r=e.getWriter();ia(n)&&(n._disturbed=!0);let d,p,l,c=!1,m=!1,u="readable",g="writable",x=!1,v=!1,h=ke((T=>{l=T})),y=Promise.resolve(void 0);return ke(((T,k)=>{let F;function q(){if(c)return;let _=ke(((O,C)=>{(function V(xe){xe?O():yt((function(){return c?U(!0):yt(r.ready,(()=>yt(i.read(),(ge=>!!ge.done||(y=r.write(ge.value),Ia(y),!1)))))})(),V,C)})(!1)}));Ia(_)}function ue(){return u="closed",t?z():I((()=>(et(e)&&(x=Lt(e),g=e._state),x||g==="closed"?U(void 0):g==="erroring"||g==="errored"?P(p):(x=!0,r.close()))),!1,void 0),null}function S(_){return c||(u="errored",d=_,a?z(!0,_):I((()=>r.abort(_)),!0,_)),null}function w(_){return m||(g="errored",p=_,s?z(!0,_):I((()=>i.cancel(_)),!0,_)),null}if(o!==void 0&&(F=()=>{let _=o.reason!==void 0?o.reason:new $m("Aborted","AbortError"),O=[];a||O.push((()=>g==="writable"?r.abort(_):U(void 0))),s||O.push((()=>u==="readable"?i.cancel(_):U(void 0))),I((()=>Promise.all(O.map((C=>C())))),!0,_)},o.aborted?F():o.addEventListener("abort",F)),ia(n)&&(u=n._state,d=n._storedError),et(e)&&(g=e._state,p=e._storedError,x=Lt(e)),ia(n)&&et(e)&&(v=!0,l()),u==="errored")S(d);else if(g==="erroring"||g==="errored")w(p);else if(u==="closed")ue();else if(x||g==="closed"){let _=new TypeError("the destination writable stream closed before all data could be piped to it");s?z(!0,_):I((()=>i.cancel(_)),!0,_)}function I(_,O,C){function V(){return g!=="writable"||x?xe():np((function(){let ge;return U((function Et(){if(ge!==y)return ge=y,We(y,Et,Et)})())})(),xe),null}function xe(){return _?ve(_(),(()=>ie(O,C)),(ge=>ie(!0,ge))):ie(O,C),null}c||(c=!0,v?V():np(h,V))}function z(_,O){I(void 0,_,O)}function ie(_,O){return m=!0,r.releaseLock(),i.releaseLock(),o!==void 0&&o.removeEventListener("abort",F),_?k(O):T(void 0),null}c||(ve(i.closed,ue,S),ve(r.closed,(function(){return m||(g="closed"),null}),w)),v?q():Ts((()=>{v=!0,l(),q()}))}))}function Om(n,e){return(function(t){try{return t.getReader({mode:"byob"}).releaseLock(),!0}catch{return!1}})(n)?(function(t){let a,s,o,i,r,d=t.getReader(),p=!1,l=!1,c=!1,m=!1,u=!1,g=!1,x=ke((w=>{r=w}));function v(w){sp(w.closed,(I=>(w!==d||(o.error(I),i.error(I),u&&g||r(void 0)),null)))}function h(){p&&(d.releaseLock(),d=t.getReader(),v(d),p=!1),ve(d.read(),(w=>{var I,z;if(c=!1,m=!1,w.done)return u||o.close(),g||i.close(),(I=o.byobRequest)===null||I===void 0||I.respond(0),(z=i.byobRequest)===null||z===void 0||z.respond(0),u&&g||r(void 0),null;let ie=w.value,_=ie,O=ie;if(!u&&!g)try{O=pp(ie)}catch(C){return o.error(C),i.error(C),r(d.cancel(C)),null}return u||o.enqueue(_),g||i.enqueue(O),l=!1,c?T():m&&k(),null}),(()=>(l=!1,null)))}function y(w,I){p||(d.releaseLock(),d=t.getReader({mode:"byob"}),v(d),p=!0);let z=I?i:o,ie=I?o:i;ve(d.read(w),(_=>{var O;c=!1,m=!1;let C=I?g:u,V=I?u:g;if(_.done){C||z.close(),V||ie.close();let ge=_.value;return ge!==void 0&&(C||z.byobRequest.respondWithNewView(ge),V||(O=ie.byobRequest)===null||O===void 0||O.respond(0)),C&&V||r(void 0),null}let xe=_.value;if(V)C||z.byobRequest.respondWithNewView(xe);else{let ge;try{ge=pp(xe)}catch(Et){return z.error(Et),ie.error(Et),r(d.cancel(Et)),null}C||z.byobRequest.respondWithNewView(xe),ie.enqueue(ge)}return l=!1,c?T():m&&k(),null}),(()=>(l=!1,null)))}function T(){if(l)return c=!0,U(void 0);l=!0;let w=o.byobRequest;return w===null?h():y(w.view,!1),U(void 0)}function k(){if(l)return m=!0,U(void 0);l=!0;let w=i.byobRequest;return w===null?h():y(w.view,!0),U(void 0)}function F(w){if(u=!0,a=w,g){let I=[a,s],z=d.cancel(I);r(z)}return x}function q(w){if(g=!0,s=w,u){let I=[a,s],z=d.cancel(I);r(z)}return x}let ue=new oe({type:"bytes",start(w){o=w},pull:T,cancel:F}),S=new oe({type:"bytes",start(w){i=w},pull:k,cancel:q});return v(d),[ue,S]})(n):(function(t,a){let s=t.getReader(),o,i,r,d,p,l=!1,c=!1,m=!1,u=!1,g=ke((k=>{p=k}));function x(){return l?(c=!0,U(void 0)):(l=!0,ve(s.read(),(k=>{if(c=!1,k.done)return m||r.close(),u||d.close(),m&&u||p(void 0),null;let F=k.value,q=F,ue=F;return m||r.enqueue(q),u||d.enqueue(ue),l=!1,c&&x(),null}),(()=>(l=!1,null))),U(void 0))}function v(k){if(m=!0,o=k,u){let F=[o,i],q=s.cancel(F);p(q)}return g}function h(k){if(u=!0,i=k,m){let F=[o,i],q=s.cancel(F);p(q)}return g}let y=new oe({start(k){r=k},pull:x,cancel:v}),T=new oe({start(k){d=k},pull:x,cancel:h});return sp(s.closed,(k=>(r.error(k),d.error(k),m&&u||p(void 0),null))),[y,T]})(n)}function Ss(n){return!!be(n)&&!!Object.prototype.hasOwnProperty.call(n,"_controlledReadableStream")&&n instanceof vt}function gn(n){if((function(t){let a=t._controlledReadableStream;return!un(t)||!t._started?!1:!!(Ra(a)&&Vs(a)>0||ll(t)>0)})(n)){if(n._pulling)return void(n._pullAgain=!0);n._pulling=!0,ve(n._pullAlgorithm(),(()=>(n._pulling=!1,n._pullAgain&&(n._pullAgain=!1,gn(n)),null)),(t=>(hn(n,t),null)))}}function Is(n){n._pullAlgorithm=void 0,n._cancelAlgorithm=void 0,n._strategySizeAlgorithm=void 0}function hn(n,e){let t=n._controlledReadableStream;t._state==="readable"&&($t(n),Is(n),ml(t,e))}function ll(n){let e=n._controlledReadableStream._state;return e==="errored"?null:e==="closed"?0:n._strategyHWM-n._queueTotalSize}function un(n){return!n._closeRequested&&n._controlledReadableStream._state==="readable"}function jm(n,e,t,a){let s=Object.create(vt.prototype),o,i,r;o=e.start!==void 0?()=>e.start(s):()=>{},i=e.pull!==void 0?()=>e.pull(s):()=>U(void 0),r=e.cancel!==void 0?d=>e.cancel(d):()=>U(void 0),(function(d,p,l,c,m,u,g){p._controlledReadableStream=d,p._queue=void 0,p._queueTotalSize=void 0,$t(p),p._started=!1,p._closeRequested=!1,p._pullAgain=!1,p._pulling=!1,p._strategySizeAlgorithm=g,p._strategyHWM=u,p._pullAlgorithm=c,p._cancelAlgorithm=m,d._readableStreamController=p,ve(U(l()),(()=>(p._started=!0,gn(p),null)),(x=>(hn(p,x),null)))})(n,s,o,i,r,t,a)}function _s(n){return new TypeError(`ReadableStreamDefaultController.prototype.${n} can only be used on a ReadableStreamDefaultController`)}function zm(n,e,t){return He(n,t),a=>da(n,e,[a])}function Vm(n,e,t){return He(n,t),a=>da(n,e,[a])}function Um(n,e,t){return He(n,t),a=>zs(n,e,[a])}function qm(n,e){if((n=`${n}`)!="bytes")throw new TypeError(`${e} '${n}' is not a valid enumeration value for ReadableStreamType`);return n}function Wm(n,e){if((n=`${n}`)!="byob")throw new TypeError(`${e} '${n}' is not a valid enumeration value for ReadableStreamReaderMode`);return n}function bp(n,e){wt(n,e);let t=n?.preventAbort,a=n?.preventCancel,s=n?.preventClose,o=n?.signal;return o!==void 0&&(function(i,r){if(!(function(d){if(typeof d!="object"||d===null)return!1;try{return typeof d.aborted=="boolean"}catch{return!1}})(i))throw new TypeError(`${r} is not an AbortSignal.`)})(o,`${e} has member 'signal' that`),{preventAbort:!!t,preventCancel:!!a,preventClose:!!s,signal:o}}function Hm(n,e){wt(n,e);let t=n?.readable;fi(t,"readable","ReadableWritablePair"),(function(s,o){if(!mn(s))throw new TypeError(`${o} is not a ReadableStream.`)})(t,`${e} has member 'readable' that`);let a=n?.writable;return fi(a,"writable","ReadableWritablePair"),(function(s,o){if(!$p(s))throw new TypeError(`${o} is not a WritableStream.`)})(a,`${e} has member 'writable' that`),{readable:t,writable:a}}function ia(n){return!!be(n)&&!!Object.prototype.hasOwnProperty.call(n,"_readableStreamController")&&n instanceof oe}function Ra(n){return n._reader!==void 0}function cl(n,e){if(n._disturbed=!0,n._state==="closed")return U(void 0);if(n._state==="errored")return P(n._storedError);vn(n);let t=n._reader;if(t!==void 0&&Na(t)){let a=t._readIntoRequests;t._readIntoRequests=new Ce,a.forEach((s=>{s._closeSteps(void 0)}))}return We(n._readableStreamController[Si](e),Tp)}function vn(n){n._state="closed";let e=n._reader;if(e!==void 0&&(Rp(e),oa(e))){let t=e._readRequests;e._readRequests=new Ce,t.forEach((a=>{a._closeSteps()}))}}function ml(n,e){n._state="errored",n._storedError=e;let t=n._reader;t!==void 0&&(Pi(t,e),oa(t)?Vp(t,e):tl(t,e))}function sa(n){return new TypeError(`ReadableStream.prototype.${n} can only be used on a ReadableStream`)}function ul(n,e){wt(n,e);let t=n?.highWaterMark;return fi(t,"highWaterMark","QueuingStrategyInit"),{highWaterMark:Ti(t)}}function yp(n){return new TypeError(`ByteLengthQueuingStrategy.prototype.${n} can only be used on a ByteLengthQueuingStrategy`)}function wp(n){return!!be(n)&&!!Object.prototype.hasOwnProperty.call(n,"_byteLengthQueuingStrategyHighWaterMark")&&n instanceof bn}function xp(n){return new TypeError(`CountQueuingStrategy.prototype.${n} can only be used on a CountQueuingStrategy`)}function kp(n){return!!be(n)&&!!Object.prototype.hasOwnProperty.call(n,"_countQueuingStrategyHighWaterMark")&&n instanceof yn}function Gm(n,e,t){return He(n,t),a=>da(n,e,[a])}function Ym(n,e,t){return He(n,t),a=>zs(n,e,[a])}function Xm(n,e,t){return He(n,t),(a,s)=>da(n,e,[a,s])}function Sp(n){return!!be(n)&&!!Object.prototype.hasOwnProperty.call(n,"_transformStreamController")&&n instanceof wn}function Ls(n,e){js(n,e),Ws(n,e)}function Ws(n,e){fl(n._transformStreamController),(function(t,a){t._writableController.error(a),t._writableState==="writable"&&wl(t,a)})(n,e),n._backpressure&&$s(n,!1)}function $s(n,e){n._backpressureChangePromise!==void 0&&n._backpressureChangePromise_resolve(),n._backpressureChangePromise=ke((t=>{n._backpressureChangePromise_resolve=t})),n._backpressure=e}function Cs(n){return!!be(n)&&!!Object.prototype.hasOwnProperty.call(n,"_controlledTransformStream")&&n instanceof bt}function fl(n){n._transformAlgorithm=void 0,n._flushAlgorithm=void 0}function vl(n,e){let t=n._controlledTransformStream;if(!Os(t))throw new TypeError("Readable side is not in a state that permits enqueue");try{(function(s,o){s._readablePulling=!1;try{s._readableController.enqueue(o)}catch(i){throw js(s,i),i}})(t,e)}catch(s){throw Ws(t,s),t._readableStoredError}(function(s){return!(function(o){return Os(o)?!!(o._readablePulling||yl(o)>0):!1})(s)})(t)!==t._backpressure&&$s(t,!0)}function _p(n,e){return We(n._transformAlgorithm(e),void 0,(t=>{throw Ls(n._controlledTransformStream,t),t}))}function Ps(n){return new TypeError(`TransformStreamDefaultController.prototype.${n} can only be used on a TransformStreamDefaultController`)}function Cp(n){return new TypeError(`TransformStream.prototype.${n} can only be used on a TransformStream`)}function Os(n){return!n._readableCloseRequested&&n._readableState==="readable"}function bl(n){n._readableState="closed",n._readableCloseRequested=!0,n._readableController.close()}function js(n,e){n._readableState==="readable"&&(n._readableState="errored",n._readableStoredError=e),n._readableController.error(e)}function yl(n){return n._readableController.desiredSize}function gi(n,e){n._writableState!=="writable"?$i(n):wl(n,e)}function wl(n,e){n._writableState="erroring",n._writableStoredError=e,!(function(t){return t._writableHasInFlightOperation})(n)&&n._writableStarted&&$i(n)}function $i(n){n._writableState="errored"}function Pp(n){n._writableState==="erroring"&&$i(n)}var $,Ep,ki,Tm,Em,Nm,Ts,Ce,Np,Ap,Si,_i,Ci,op,Am,ut,Ms,Up,qp,Ft,gt,ht,Lm,ft,Qe,ol,Da,fp,$m,vt,oe,gl,bn,hl,yn,wn,bt,xl=f(()=>{$=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?Symbol:n=>`Symbol(${n})`;Ep=Tp;ki=Promise,Tm=Promise.prototype.then,Em=Promise.resolve.bind(ki),Nm=Promise.reject.bind(ki);Ts=n=>{if(typeof queueMicrotask=="function")Ts=queueMicrotask;else{let e=U(void 0);Ts=t=>yt(e,t)}return Ts(n)};Ce=class{constructor(){this._cursor=0,this._size=0,this._front={_elements:[],_next:void 0},this._back=this._front,this._cursor=0,this._size=0}get length(){return this._size}push(e){let t=this._back,a=t;t._elements.length===16383&&(a={_elements:[],_next:void 0}),t._elements.push(e),a!==t&&(this._back=a,t._next=a),++this._size}shift(){let e=this._front,t=e,a=this._cursor,s=a+1,o=e._elements,i=o[a];return s===16384&&(t=e._next,s=0),--this._size,this._cursor=s,e!==t&&(this._front=t),o[a]=void 0,i}forEach(e){let t=this._cursor,a=this._front,s=a._elements;for(;!(t===s.length&&a._next===void 0||t===s.length&&(a=a._next,s=a._elements,t=0,s.length===0));)e(s[t]),++t}peek(){let e=this._front,t=this._cursor;return e._elements[t]}},Np=$("[[AbortSteps]]"),Ap=$("[[ErrorSteps]]"),Si=$("[[CancelSteps]]"),_i=$("[[PullSteps]]"),Ci=$("[[ReleaseSteps]]");op=Number.isFinite||function(n){return typeof n=="number"&&isFinite(n)},Am=Math.trunc||function(n){return n<0?Math.ceil(n):Math.floor(n)};ut=class{constructor(e){if(xt(e,1,"ReadableStreamDefaultReader"),Op(e,"First parameter"),Ra(e))throw new TypeError("This stream has already been locked for exclusive reading by another reader");Ip(this,e),this._readRequests=new Ce}get closed(){return oa(this)?this._closedPromise:P(ys("closed"))}cancel(e){return oa(this)?this._ownerReadableStream===void 0?P(Ma("cancel")):Mp(this,e):P(ys("cancel"))}read(){if(!oa(this))return P(ys("read"));if(this._ownerReadableStream===void 0)return P(Ma("read from"));let e,t,a=ke(((s,o)=>{e=s,t=o}));return(function(s,o){let i=s._ownerReadableStream;i._disturbed=!0,i._state==="closed"?o._closeSteps():i._state==="errored"?o._errorSteps(i._storedError):i._readableStreamController[_i](o)})(this,{_chunkSteps:s=>e({value:s,done:!1}),_closeSteps:()=>e({value:void 0,done:!0}),_errorSteps:s=>t(s)}),a}releaseLock(){if(!oa(this))throw ys("releaseLock");this._ownerReadableStream!==void 0&&(function(e){Bp(e);let t=new TypeError("Reader was released");Vp(e,t)})(this)}};Object.defineProperties(ut.prototype,{cancel:{enumerable:!0},read:{enumerable:!0},releaseLock:{enumerable:!0},closed:{enumerable:!0}}),j(ut.prototype.cancel,"cancel"),j(ut.prototype.read,"read"),j(ut.prototype.releaseLock,"releaseLock"),typeof $.toStringTag=="symbol"&&Object.defineProperty(ut.prototype,$.toStringTag,{value:"ReadableStreamDefaultReader",configurable:!0});Ms=class{constructor(e,t){this._ongoingPromise=void 0,this._isFinished=!1,this._reader=e,this._preventCancel=t}next(){let e=()=>this._nextSteps();return this._ongoingPromise=this._ongoingPromise?We(this._ongoingPromise,e,e):e(),this._ongoingPromise}return(e){let t=()=>this._returnSteps(e);return this._ongoingPromise?We(this._ongoingPromise,t,t):t()}_nextSteps(){if(this._isFinished)return Promise.resolve({value:void 0,done:!0});let e=this._reader;return e===void 0?P(Ma("iterate")):yt(e.read(),(t=>{var a;return this._ongoingPromise=void 0,t.done&&(this._isFinished=!0,(a=this._reader)===null||a===void 0||a.releaseLock(),this._reader=void 0),t}),(t=>{var a;throw this._ongoingPromise=void 0,this._isFinished=!0,(a=this._reader)===null||a===void 0||a.releaseLock(),this._reader=void 0,t}))}_returnSteps(e){if(this._isFinished)return Promise.resolve({value:e,done:!0});this._isFinished=!0;let t=this._reader;if(t===void 0)return P(Ma("finish iterating"));if(this._reader=void 0,!this._preventCancel){let a=t.cancel(e);return t.releaseLock(),We(a,(()=>({value:e,done:!0})))}return t.releaseLock(),U({value:e,done:!0})}},Up={next(){return rp(this)?this._asyncIteratorImpl.next():P(dp("next"))},return(n){return rp(this)?this._asyncIteratorImpl.return(n):P(dp("return"))}};typeof $.asyncIterator=="symbol"&&Object.defineProperty(Up,$.asyncIterator,{value(){return this},writable:!0,configurable:!0});qp=Number.isNaN||function(n){return n!=n};Ft=class{constructor(){throw new TypeError("Illegal constructor")}get view(){if(!li(this))throw ci("view");return this._view}respond(e){if(!li(this))throw ci("respond");if(xt(e,1,"respond"),e=Lp(e,"First parameter"),this._associatedReadableByteStreamController===void 0)throw new TypeError("This BYOB request has been invalidated");this._view.buffer,(function(t,a){let s=t._pendingPullIntos.peek();if(t._controlledReadableByteStream._state==="closed"){if(a!==0)throw new TypeError("bytesWritten must be 0 when calling respond() on a closed stream")}else{if(a===0)throw new TypeError("bytesWritten must be greater than 0 when calling respond() on a readable stream");if(s.bytesFilled+a>s.byteLength)throw new RangeError("bytesWritten out of range")}s.buffer=s.buffer,lp(t,a)})(this._associatedReadableByteStreamController,e)}respondWithNewView(e){if(!li(this))throw ci("respondWithNewView");if(xt(e,1,"respondWithNewView"),!ArrayBuffer.isView(e))throw new TypeError("You can only respond with array buffer views");if(this._associatedReadableByteStreamController===void 0)throw new TypeError("This BYOB request has been invalidated");e.buffer,(function(t,a){let s=t._pendingPullIntos.peek();if(t._controlledReadableByteStream._state==="closed"){if(a.byteLength!==0)throw new TypeError("The view's length must be 0 when calling respondWithNewView() on a closed stream")}else if(a.byteLength===0)throw new TypeError("The view's length must be greater than 0 when calling respondWithNewView() on a readable stream");if(s.byteOffset+s.bytesFilled!==a.byteOffset)throw new RangeError("The region specified by view does not match byobRequest");if(s.bufferByteLength!==a.buffer.byteLength)throw new RangeError("The buffer of view has different capacity than byobRequest");if(s.bytesFilled+a.byteLength>s.byteLength)throw new RangeError("The region specified by view is larger than byobRequest");let o=a.byteLength;s.buffer=a.buffer,lp(t,o)})(this._associatedReadableByteStreamController,e)}};Object.defineProperties(Ft.prototype,{respond:{enumerable:!0},respondWithNewView:{enumerable:!0},view:{enumerable:!0}}),j(Ft.prototype.respond,"respond"),j(Ft.prototype.respondWithNewView,"respondWithNewView"),typeof $.toStringTag=="symbol"&&Object.defineProperty(Ft.prototype,$.toStringTag,{value:"ReadableStreamBYOBRequest",configurable:!0});gt=class{constructor(){throw new TypeError("Illegal constructor")}get byobRequest(){if(!Ea(this))throw ln("byobRequest");return(function(e){if(e._byobRequest===null&&e._pendingPullIntos.length>0){let t=e._pendingPullIntos.peek(),a=new Uint8Array(t.buffer,t.byteOffset+t.bytesFilled,t.byteLength-t.bytesFilled),s=Object.create(Ft.prototype);(function(o,i,r){o._associatedReadableByteStreamController=i,o._view=r})(s,e,a),e._byobRequest=s}return e._byobRequest})(this)}get desiredSize(){if(!Ea(this))throw ln("desiredSize");return Qp(this)}close(){if(!Ea(this))throw ln("close");if(this._closeRequested)throw new TypeError("The stream has already been closed; do not close it again!");let e=this._controlledReadableByteStream._state;if(e!=="readable")throw new TypeError(`The stream (in ${e} state) is not in the readable state and cannot be closed`);(function(t){let a=t._controlledReadableByteStream;if(!(t._closeRequested||a._state!=="readable")){if(t._queueTotalSize>0)return void(t._closeRequested=!0);if(t._pendingPullIntos.length>0&&t._pendingPullIntos.peek().bytesFilled>0){let s=new TypeError("Insufficient bytes to fill elements in the given buffer");throw Ba(t,s),s}Bs(t),vn(a)}})(this)}enqueue(e){if(!Ea(this))throw ln("enqueue");if(xt(e,1,"enqueue"),!ArrayBuffer.isView(e))throw new TypeError("chunk must be an array buffer view");if(e.byteLength===0)throw new TypeError("chunk must have non-zero byteLength");if(e.buffer.byteLength===0)throw new TypeError("chunk's buffer must have non-zero byteLength");if(this._closeRequested)throw new TypeError("stream is closed or draining");let t=this._controlledReadableByteStream._state;if(t!=="readable")throw new TypeError(`The stream (in ${t} state) is not in the readable state and cannot be enqueued to`);(function(a,s){let o=a._controlledReadableByteStream;if(a._closeRequested||o._state!=="readable")return;let i=s.buffer,r=s.byteOffset,d=s.byteLength,p=i;if(a._pendingPullIntos.length>0){let l=a._pendingPullIntos.peek();l.buffer,Ai(a),l.buffer=l.buffer,l.readerType==="none"&&Xp(a,l)}zp(o)?((function(l){let c=l._controlledReadableByteStream._reader;for(;c._readRequests.length>0;){if(l._queueTotalSize===0)return;cp(l,c._readRequests.shift())}})(a),Vs(o)===0?Es(a,p,r,d):(a._pendingPullIntos.length>0&&Aa(a),Ei(o,new Uint8Array(p,r,d),!1))):Ii(o)?(Es(a,p,r,d),yi(a)):Es(a,p,r,d),ra(a)})(this,e)}error(e){if(!Ea(this))throw ln("error");Ba(this,e)}[Si](e){Hp(this),$t(this);let t=this._cancelAlgorithm(e);return Bs(this),t}[_i](e){let t=this._controlledReadableByteStream;if(this._queueTotalSize>0)return void cp(this,e);let a=this._autoAllocateChunkSize;if(a!==void 0){let s;try{s=new ArrayBuffer(a)}catch(i){return void e._errorSteps(i)}let o={buffer:s,bufferByteLength:a,byteOffset:0,byteLength:a,bytesFilled:0,elementSize:1,viewConstructor:Uint8Array,readerType:"default"};this._pendingPullIntos.push(o)}jp(t,e),ra(this)}[Ci](){if(this._pendingPullIntos.length>0){let e=this._pendingPullIntos.peek();e.readerType="none",this._pendingPullIntos=new Ce,this._pendingPullIntos.push(e)}}};Object.defineProperties(gt.prototype,{close:{enumerable:!0},enqueue:{enumerable:!0},error:{enumerable:!0},byobRequest:{enumerable:!0},desiredSize:{enumerable:!0}}),j(gt.prototype.close,"close"),j(gt.prototype.enqueue,"enqueue"),j(gt.prototype.error,"error"),typeof $.toStringTag=="symbol"&&Object.defineProperty(gt.prototype,$.toStringTag,{value:"ReadableByteStreamController",configurable:!0});ht=class{constructor(e){if(xt(e,1,"ReadableStreamBYOBReader"),Op(e,"First parameter"),Ra(e))throw new TypeError("This stream has already been locked for exclusive reading by another reader");if(!Ea(e._readableStreamController))throw new TypeError("Cannot construct a ReadableStreamBYOBReader for a stream not constructed with a byte source");Ip(this,e),this._readIntoRequests=new Ce}get closed(){return Na(this)?this._closedPromise:P(ws("closed"))}cancel(e){return Na(this)?this._ownerReadableStream===void 0?P(Ma("cancel")):Mp(this,e):P(ws("cancel"))}read(e){if(!Na(this))return P(ws("read"));if(!ArrayBuffer.isView(e))return P(new TypeError("view must be an array buffer view"));if(e.byteLength===0)return P(new TypeError("view must have non-zero byteLength"));if(e.buffer.byteLength===0)return P(new TypeError("view's buffer must have non-zero byteLength"));if(e.buffer,this._ownerReadableStream===void 0)return P(Ma("read from"));let t,a,s=ke(((o,i)=>{t=o,a=i}));return(function(o,i,r){let d=o._ownerReadableStream;d._disturbed=!0,d._state==="errored"?r._errorSteps(d._storedError):(function(p,l,c){let m=p._controlledReadableByteStream,u=1;l.constructor!==DataView&&(u=l.constructor.BYTES_PER_ELEMENT);let g=l.constructor,x=l.buffer,v={buffer:x,bufferByteLength:x.byteLength,byteOffset:l.byteOffset,byteLength:l.byteLength,bytesFilled:0,elementSize:u,viewConstructor:g,readerType:"byob"};if(p._pendingPullIntos.length>0)return p._pendingPullIntos.push(v),void mp(m,c);if(m._state!=="closed"){if(p._queueTotalSize>0){if(Kp(p,v)){let h=Gp(v);return Zp(p),void c._chunkSteps(h)}if(p._closeRequested){let h=new TypeError("Insufficient bytes to fill elements in the given buffer");return Ba(p,h),void c._errorSteps(h)}}p._pendingPullIntos.push(v),mp(m,c),ra(p)}else{let h=new g(v.buffer,v.byteOffset,0);c._closeSteps(h)}})(d._readableStreamController,i,r)})(this,e,{_chunkSteps:o=>t({value:o,done:!1}),_closeSteps:o=>t({value:o,done:!0}),_errorSteps:o=>a(o)}),s}releaseLock(){if(!Na(this))throw ws("releaseLock");this._ownerReadableStream!==void 0&&(function(e){Bp(e);let t=new TypeError("Reader was released");tl(e,t)})(this)}};Object.defineProperties(ht.prototype,{cancel:{enumerable:!0},read:{enumerable:!0},releaseLock:{enumerable:!0},closed:{enumerable:!0}}),j(ht.prototype.cancel,"cancel"),j(ht.prototype.read,"read"),j(ht.prototype.releaseLock,"releaseLock"),typeof $.toStringTag=="symbol"&&Object.defineProperty(ht.prototype,$.toStringTag,{value:"ReadableStreamBYOBReader",configurable:!0});Lm=typeof AbortController=="function",ft=class{constructor(e={},t={}){e===void 0?e=null:Fp(e,"First parameter");let a=Rs(t,"Second parameter"),s=(function(r,d){wt(r,d);let p=r?.abort,l=r?.close,c=r?.start,m=r?.type,u=r?.write;return{abort:p===void 0?void 0:Bm(p,r,`${d} has member 'abort' that`),close:l===void 0?void 0:Dm(l,r,`${d} has member 'close' that`),start:c===void 0?void 0:Rm(c,r,`${d} has member 'start' that`),write:u===void 0?void 0:Fm(u,r,`${d} has member 'write' that`),type:m}})(e,"First parameter");var o;if((o=this)._state="writable",o._storedError=void 0,o._writer=void 0,o._writableStreamController=void 0,o._writeRequests=new Ce,o._inFlightWriteRequest=void 0,o._closeRequest=void 0,o._inFlightCloseRequest=void 0,o._pendingAbortRequest=void 0,o._backpressure=!1,s.type!==void 0)throw new RangeError("Invalid type is specified");let i=Ds(a);(function(r,d,p,l){let c=Object.create(Da.prototype),m,u,g,x;m=d.start!==void 0?()=>d.start(c):()=>{},u=d.write!==void 0?v=>d.write(v,c):()=>U(void 0),g=d.close!==void 0?()=>d.close():()=>U(void 0),x=d.abort!==void 0?v=>d.abort(v):()=>U(void 0),(function(v,h,y,T,k,F,q,ue){h._controlledWritableStream=v,v._writableStreamController=h,h._queue=void 0,h._queueTotalSize=void 0,$t(h),h._abortReason=void 0,h._abortController=(function(){if(Lm)return new AbortController})(),h._started=!1,h._strategySizeAlgorithm=ue,h._strategyHWM=q,h._writeAlgorithm=T,h._closeAlgorithm=k,h._abortAlgorithm=F;let S=Ri(h);Di(v,S);let w=y();ve(U(w),(()=>(h._started=!0,Us(h),null)),(I=>(h._started=!0,wi(v,I),null)))})(r,c,m,u,g,x,p,l)})(this,s,fn(a,1),i)}get locked(){if(!et(this))throw ks("locked");return Ns(this)}abort(e){return et(this)?Ns(this)?P(new TypeError("Cannot abort a stream that already has a writer")):al(this,e):P(ks("abort"))}close(){return et(this)?Ns(this)?P(new TypeError("Cannot close a stream that already has a writer")):Lt(this)?P(new TypeError("Cannot close an already-closing stream")):nl(this):P(ks("close"))}getWriter(){if(!et(this))throw ks("getWriter");return new Qe(this)}};Object.defineProperties(ft.prototype,{abort:{enumerable:!0},close:{enumerable:!0},getWriter:{enumerable:!0},locked:{enumerable:!0}}),j(ft.prototype.abort,"abort"),j(ft.prototype.close,"close"),j(ft.prototype.getWriter,"getWriter"),typeof $.toStringTag=="symbol"&&Object.defineProperty(ft.prototype,$.toStringTag,{value:"WritableStream",configurable:!0});Qe=class{constructor(e){if(xt(e,1,"WritableStreamDefaultWriter"),(function(s,o){if(!et(s))throw new TypeError(`${o} is not a WritableStream.`)})(e,"First parameter"),Ns(e))throw new TypeError("This stream has already been locked for exclusive writing by another writer");this._ownerWritableStream=e,e._writer=this;let t=e._state;if(t==="writable")!Lt(e)&&e._backpressure?qs(this):hp(this),As(this);else if(t==="erroring")xi(this,e._storedError),As(this);else if(t==="closed")hp(this),As(a=this),dl(a);else{let s=e._storedError;xi(this,s),gp(this,s)}var a}get closed(){return aa(this)?this._closedPromise:P(na("closed"))}get desiredSize(){if(!aa(this))throw na("desiredSize");if(this._ownerWritableStream===void 0)throw cn("desiredSize");return(function(e){let t=e._ownerWritableStream,a=t._state;return a==="errored"||a==="erroring"?null:a==="closed"?0:il(t._writableStreamController)})(this)}get ready(){return aa(this)?this._readyPromise:P(na("ready"))}abort(e){return aa(this)?this._ownerWritableStream===void 0?P(cn("abort")):(function(t,a){return al(t._ownerWritableStream,a)})(this,e):P(na("abort"))}close(){if(!aa(this))return P(na("close"));let e=this._ownerWritableStream;return e===void 0?P(cn("close")):Lt(e)?P(new TypeError("Cannot close an already-closing stream")):nl(this._ownerWritableStream)}releaseLock(){if(!aa(this))throw na("releaseLock");this._ownerWritableStream!==void 0&&(function(e){let t=e._ownerWritableStream,a=new TypeError("Writer was released and can no longer be used to monitor the stream's closedness");sl(e,a),(function(s,o){s._closedPromiseState==="pending"?Fi(s,o):(function(i,r){gp(i,r)})(s,o)})(e,a),t._writer=void 0,e._ownerWritableStream=void 0})(this)}write(e){return aa(this)?this._ownerWritableStream===void 0?P(cn("write to")):(function(t,a){let s=t._ownerWritableStream,o=s._writableStreamController,i=(function(p,l){try{return p._strategySizeAlgorithm(l)}catch(c){return up(p,c),1}})(o,a);if(s!==t._ownerWritableStream)return P(cn("write to"));let r=s._state;if(r==="errored")return P(s._storedError);if(Lt(s)||r==="closed")return P(new TypeError("The stream is closing or closed and cannot be written to"));if(r==="erroring")return P(s._storedError);let d=(function(p){return ke(((l,c)=>{let m={_resolve:l,_reject:c};p._writeRequests.push(m)}))})(s);return(function(p,l,c){try{Ni(p,l,c)}catch(u){return void up(p,u)}let m=p._controlledWritableStream;!Lt(m)&&m._state==="writable"&&Di(m,Ri(p)),Us(p)})(o,a,i),d})(this,e):P(na("write"))}};Object.defineProperties(Qe.prototype,{abort:{enumerable:!0},close:{enumerable:!0},releaseLock:{enumerable:!0},write:{enumerable:!0},closed:{enumerable:!0},desiredSize:{enumerable:!0},ready:{enumerable:!0}}),j(Qe.prototype.abort,"abort"),j(Qe.prototype.close,"close"),j(Qe.prototype.releaseLock,"releaseLock"),j(Qe.prototype.write,"write"),typeof $.toStringTag=="symbol"&&Object.defineProperty(Qe.prototype,$.toStringTag,{value:"WritableStreamDefaultWriter",configurable:!0});ol={},Da=class{constructor(){throw new TypeError("Illegal constructor")}get abortReason(){if(!mi(this))throw ui("abortReason");return this._abortReason}get signal(){if(!mi(this))throw ui("signal");if(this._abortController===void 0)throw new TypeError("WritableStreamDefaultController.prototype.signal is not supported");return this._abortController.signal}error(e){if(!mi(this))throw ui("error");this._controlledWritableStream._state==="writable"&&rl(this,e)}[Np](e){let t=this._abortAlgorithm(e);return Fs(this),t}[Ap](){$t(this)}};Object.defineProperties(Da.prototype,{abortReason:{enumerable:!0},signal:{enumerable:!0},error:{enumerable:!0}}),typeof $.toStringTag=="symbol"&&Object.defineProperty(Da.prototype,$.toStringTag,{value:"WritableStreamDefaultController",configurable:!0});fp=typeof DOMException<"u"?DOMException:void 0,$m=(function(n){if(typeof n!="function"&&typeof n!="object")return!1;try{return new n,!0}catch{return!1}})(fp)?fp:(function(){let n=function(e,t){this.message=e||"",this.name=t||"Error",Error.captureStackTrace&&Error.captureStackTrace(this,this.constructor)};return n.prototype=Object.create(Error.prototype),Object.defineProperty(n.prototype,"constructor",{value:n,writable:!0,configurable:!0}),n})();vt=class{constructor(){throw new TypeError("Illegal constructor")}get desiredSize(){if(!Ss(this))throw _s("desiredSize");return ll(this)}close(){if(!Ss(this))throw _s("close");if(!un(this))throw new TypeError("The stream is not in a state that permits close");(function(e){if(!un(e))return;let t=e._controlledReadableStream;e._closeRequested=!0,e._queue.length===0&&(Is(e),vn(t))})(this)}enqueue(e){if(!Ss(this))throw _s("enqueue");if(!un(this))throw new TypeError("The stream is not in a state that permits enqueue");return(function(t,a){if(!un(t))return;let s=t._controlledReadableStream;if(Ra(s)&&Vs(s)>0)Ei(s,a,!1);else{let o;try{o=t._strategySizeAlgorithm(a)}catch(i){throw hn(t,i),i}try{Ni(t,a,o)}catch(i){throw hn(t,i),i}}gn(t)})(this,e)}error(e){if(!Ss(this))throw _s("error");hn(this,e)}[Si](e){$t(this);let t=this._cancelAlgorithm(e);return Is(this),t}[_i](e){let t=this._controlledReadableStream;if(this._queue.length>0){let a=vi(this);this._closeRequested&&this._queue.length===0?(Is(this),vn(t)):gn(this),e._chunkSteps(a)}else jp(t,e),gn(this)}[Ci](){}};Object.defineProperties(vt.prototype,{close:{enumerable:!0},enqueue:{enumerable:!0},error:{enumerable:!0},desiredSize:{enumerable:!0}}),j(vt.prototype.close,"close"),j(vt.prototype.enqueue,"enqueue"),j(vt.prototype.error,"error"),typeof $.toStringTag=="symbol"&&Object.defineProperty(vt.prototype,$.toStringTag,{value:"ReadableStreamDefaultController",configurable:!0});oe=class{constructor(e={},t={}){e===void 0?e=null:Fp(e,"First parameter");let a=Rs(t,"Second parameter"),s=(function(i,r){wt(i,r);let d=i,p=d?.autoAllocateChunkSize,l=d?.cancel,c=d?.pull,m=d?.start,u=d?.type;return{autoAllocateChunkSize:p===void 0?void 0:Lp(p,`${r} has member 'autoAllocateChunkSize' that`),cancel:l===void 0?void 0:zm(l,d,`${r} has member 'cancel' that`),pull:c===void 0?void 0:Vm(c,d,`${r} has member 'pull' that`),start:m===void 0?void 0:Um(m,d,`${r} has member 'start' that`),type:u===void 0?void 0:qm(u,`${r} has member 'type' that`)}})(e,"First parameter");var o;if((o=this)._state="readable",o._reader=void 0,o._storedError=void 0,o._disturbed=!1,s.type==="bytes"){if(a.size!==void 0)throw new RangeError("The strategy for a byte stream cannot have a size function");Im(this,s,fn(a,0))}else{let i=Ds(a);jm(this,s,fn(a,1),i)}}get locked(){if(!ia(this))throw sa("locked");return Ra(this)}cancel(e){return ia(this)?Ra(this)?P(new TypeError("Cannot cancel a stream that already has a reader")):cl(this,e):P(sa("cancel"))}getReader(e){if(!ia(this))throw sa("getReader");return(function(t,a){wt(t,a);let s=t?.mode;return{mode:s===void 0?void 0:Wm(s,`${a} has member 'mode' that`)}})(e,"First parameter").mode===void 0?new ut(this):(function(t){return new ht(t)})(this)}pipeThrough(e,t={}){if(!mn(this))throw sa("pipeThrough");xt(e,1,"pipeThrough");let a=Hm(e,"First parameter"),s=bp(t,"Second parameter");if(this.locked)throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked ReadableStream");if(a.writable.locked)throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked WritableStream");return Ia(vp(this,a.writable,s.preventClose,s.preventAbort,s.preventCancel,s.signal)),a.readable}pipeTo(e,t={}){if(!mn(this))return P(sa("pipeTo"));if(e===void 0)return P("Parameter 1 is required in 'pipeTo'.");if(!$p(e))return P(new TypeError("ReadableStream.prototype.pipeTo's first argument must be a WritableStream"));let a;try{a=bp(t,"Second parameter")}catch(s){return P(s)}return this.locked?P(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked ReadableStream")):e.locked?P(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked WritableStream")):vp(this,e,a.preventClose,a.preventAbort,a.preventCancel,a.signal)}tee(){if(!mn(this))throw sa("tee");if(this.locked)throw new TypeError("Cannot tee a stream that already has a reader");return Om(this)}values(e){if(!mn(this))throw sa("values");return(function(t,a){let s=t.getReader(),o=new Ms(s,a),i=Object.create(Up);return i._asyncIteratorImpl=o,i})(this,(function(t,a){return wt(t,a),{preventCancel:!!t?.preventCancel}})(e,"First parameter").preventCancel)}};Object.defineProperties(oe.prototype,{cancel:{enumerable:!0},getReader:{enumerable:!0},pipeThrough:{enumerable:!0},pipeTo:{enumerable:!0},tee:{enumerable:!0},values:{enumerable:!0},locked:{enumerable:!0}}),j(oe.prototype.cancel,"cancel"),j(oe.prototype.getReader,"getReader"),j(oe.prototype.pipeThrough,"pipeThrough"),j(oe.prototype.pipeTo,"pipeTo"),j(oe.prototype.tee,"tee"),j(oe.prototype.values,"values"),typeof $.toStringTag=="symbol"&&Object.defineProperty(oe.prototype,$.toStringTag,{value:"ReadableStream",configurable:!0}),typeof $.asyncIterator=="symbol"&&Object.defineProperty(oe.prototype,$.asyncIterator,{value:oe.prototype.values,writable:!0,configurable:!0});gl=n=>n.byteLength;j(gl,"size");bn=class{constructor(e){xt(e,1,"ByteLengthQueuingStrategy"),e=ul(e,"First parameter"),this._byteLengthQueuingStrategyHighWaterMark=e.highWaterMark}get highWaterMark(){if(!wp(this))throw yp("highWaterMark");return this._byteLengthQueuingStrategyHighWaterMark}get size(){if(!wp(this))throw yp("size");return gl}};Object.defineProperties(bn.prototype,{highWaterMark:{enumerable:!0},size:{enumerable:!0}}),typeof $.toStringTag=="symbol"&&Object.defineProperty(bn.prototype,$.toStringTag,{value:"ByteLengthQueuingStrategy",configurable:!0});hl=()=>1;j(hl,"size");yn=class{constructor(e){xt(e,1,"CountQueuingStrategy"),e=ul(e,"First parameter"),this._countQueuingStrategyHighWaterMark=e.highWaterMark}get highWaterMark(){if(!kp(this))throw xp("highWaterMark");return this._countQueuingStrategyHighWaterMark}get size(){if(!kp(this))throw xp("size");return hl}};Object.defineProperties(yn.prototype,{highWaterMark:{enumerable:!0},size:{enumerable:!0}}),typeof $.toStringTag=="symbol"&&Object.defineProperty(yn.prototype,$.toStringTag,{value:"CountQueuingStrategy",configurable:!0});wn=class{constructor(e={},t={},a={}){e===void 0&&(e=null);let s=Rs(t,"Second parameter"),o=Rs(a,"Third parameter"),i=(function(m,u){wt(m,u);let g=m?.flush,x=m?.readableType,v=m?.start,h=m?.transform,y=m?.writableType;return{flush:g===void 0?void 0:Gm(g,m,`${u} has member 'flush' that`),readableType:x,start:v===void 0?void 0:Ym(v,m,`${u} has member 'start' that`),transform:h===void 0?void 0:Xm(h,m,`${u} has member 'transform' that`),writableType:y}})(e,"First parameter");if(i.readableType!==void 0)throw new RangeError("Invalid readableType specified");if(i.writableType!==void 0)throw new RangeError("Invalid writableType specified");let r=fn(o,0),d=Ds(o),p=fn(s,1),l=Ds(s),c;(function(m,u,g,x,v,h){function y(){return u}function T(S){return(function(w,I){let z=w._transformStreamController;return w._backpressure?We(w._backpressureChangePromise,(()=>{if((et(w._writable)?w._writable._state:w._writableState)==="erroring")throw et(w._writable)?w._writable._storedError:w._writableStoredError;return _p(z,I)})):_p(z,I)})(m,S)}function k(S){return(function(w,I){return Ls(w,I),U(void 0)})(m,S)}function F(){return(function(S){let w=S._transformStreamController,I=w._flushAlgorithm();return fl(w),We(I,(()=>{if(S._readableState==="errored")throw S._readableStoredError;Os(S)&&bl(S)}),(z=>{throw Ls(S,z),S._readableStoredError}))})(m)}function q(){return(function(S){return $s(S,!1),S._backpressureChangePromise})(m)}function ue(S){return Ws(m,S),U(void 0)}m._writableState="writable",m._writableStoredError=void 0,m._writableHasInFlightOperation=!1,m._writableStarted=!1,m._writable=(function(S,w,I,z,ie,_,O){return new ft({start(C){S._writableController=C;try{let V=C.signal;V!==void 0&&V.addEventListener("abort",(()=>{S._writableState==="writable"&&(S._writableState="erroring",V.reason&&(S._writableStoredError=V.reason))}))}catch{}return We(w(),(()=>(S._writableStarted=!0,Pp(S),null)),(V=>{throw S._writableStarted=!0,gi(S,V),V}))},write:C=>((function(V){V._writableHasInFlightOperation=!0})(S),We(I(C),(()=>((function(V){V._writableHasInFlightOperation=!1})(S),Pp(S),null)),(V=>{throw(function(xe,ge){xe._writableHasInFlightOperation=!1,gi(xe,ge)})(S,V),V}))),close:()=>((function(C){C._writableHasInFlightOperation=!0})(S),We(z(),(()=>((function(C){C._writableHasInFlightOperation=!1,C._writableState==="erroring"&&(C._writableStoredError=void 0),C._writableState="closed"})(S),null)),(C=>{throw(function(V,xe){V._writableHasInFlightOperation=!1,V._writableState,gi(V,xe)})(S,C),C}))),abort:C=>(S._writableState="errored",S._writableStoredError=C,ie(C))},{highWaterMark:_,size:O})})(m,y,T,F,k,g,x),m._readableState="readable",m._readableStoredError=void 0,m._readableCloseRequested=!1,m._readablePulling=!1,m._readable=(function(S,w,I,z,ie,_){return new oe({start:O=>(S._readableController=O,w().catch((C=>{js(S,C)}))),pull:()=>(S._readablePulling=!0,I().catch((O=>{js(S,O)}))),cancel:O=>(S._readableState="closed",z(O))},{highWaterMark:ie,size:_})})(m,y,q,ue,v,h),m._backpressure=void 0,m._backpressureChangePromise=void 0,m._backpressureChangePromise_resolve=void 0,$s(m,!0),m._transformStreamController=void 0})(this,ke((m=>{c=m})),p,l,r,d),(function(m,u){let g=Object.create(bt.prototype),x,v;x=u.transform!==void 0?h=>u.transform(h,g):h=>{try{return vl(g,h),U(void 0)}catch(y){return P(y)}},v=u.flush!==void 0?()=>u.flush(g):()=>U(void 0),(function(h,y,T,k){y._controlledTransformStream=h,h._transformStreamController=y,y._transformAlgorithm=T,y._flushAlgorithm=k})(m,g,x,v)})(this,i),i.start!==void 0?c(i.start(this._transformStreamController)):c(void 0)}get readable(){if(!Sp(this))throw Cp("readable");return this._readable}get writable(){if(!Sp(this))throw Cp("writable");return this._writable}};Object.defineProperties(wn.prototype,{readable:{enumerable:!0},writable:{enumerable:!0}}),typeof $.toStringTag=="symbol"&&Object.defineProperty(wn.prototype,$.toStringTag,{value:"TransformStream",configurable:!0});bt=class{constructor(){throw new TypeError("Illegal constructor")}get desiredSize(){if(!Cs(this))throw Ps("desiredSize");return yl(this._controlledTransformStream)}enqueue(e){if(!Cs(this))throw Ps("enqueue");vl(this,e)}error(e){if(!Cs(this))throw Ps("error");var t;t=e,Ls(this._controlledTransformStream,t)}terminate(){if(!Cs(this))throw Ps("terminate");(function(e){let t=e._controlledTransformStream;Os(t)&&bl(t);let a=new TypeError("TransformStream terminated");Ws(t,a)})(this)}};Object.defineProperties(bt.prototype,{enqueue:{enumerable:!0},error:{enumerable:!0},terminate:{enumerable:!0},desiredSize:{enumerable:!0}}),j(bt.prototype.enqueue,"enqueue"),j(bt.prototype.error,"error"),j(bt.prototype.terminate,"terminate"),typeof $.toStringTag=="symbol"&&Object.defineProperty(bt.prototype,$.toStringTag,{value:"TransformStreamDefaultController",configurable:!0})});var se,Hs=f(()=>{se=n=>typeof n=="function"});async function*Km(n){let e=n.byteOffset+n.byteLength,t=n.byteOffset;for(;t!==e;){let a=Math.min(e-t,kl),s=n.buffer.slice(t,t+a);t+=s.byteLength,yield new Uint8Array(s)}}async function*Jm(n){let e=0;for(;e!==n.size;){let a=await n.slice(e,Math.min(n.size,e+kl)).arrayBuffer();e+=a.byteLength,yield new Uint8Array(a)}}async function*Gs(n,e=!1){for(let t of n)ArrayBuffer.isView(t)?e?yield*Km(t):yield t:se(t.stream)?yield*t.stream():yield*Jm(t)}function*Sl(n,e,t=0,a){a??(a=e);let s=t<0?Math.max(e+t,0):Math.min(t,e),o=a<0?Math.max(e+a,0):Math.min(a,e),i=Math.max(o-s,0),r=0;for(let d of n){if(r>=i)break;let p=ArrayBuffer.isView(d)?d.byteLength:d.size;if(s&&p<=s)s-=p,o-=p;else{let l;ArrayBuffer.isView(d)?(l=d.subarray(s,Math.min(p,o)),r+=l.byteLength):(l=d.slice(s,Math.min(p,o)),r+=l.size),o-=p,s=0,yield l}}}var kl,_l=f(()=>{Hs();kl=65536});var Ot,Cl,pa,Ys,xn,tt,Xs=f(()=>{xl();Hs();_l();Ot=function(n,e,t,a){if(t==="a"&&!a)throw new TypeError("Private accessor was defined without a getter");if(typeof e=="function"?n!==e||!a:!e.has(n))throw new TypeError("Cannot read private member from an object whose class did not declare it");return t==="m"?a:t==="a"?a.call(n):a?a.value:e.get(n)},Cl=function(n,e,t,a,s){if(a==="m")throw new TypeError("Private method is not writable");if(a==="a"&&!s)throw new TypeError("Private accessor was defined without a setter");if(typeof e=="function"?n!==e||!s:!e.has(n))throw new TypeError("Cannot write private member to an object whose class did not declare it");return a==="a"?s.call(n,t):s?s.value=t:e.set(n,t),t},tt=class n{constructor(e=[],t={}){if(pa.set(this,[]),Ys.set(this,""),xn.set(this,0),t??(t={}),typeof e!="object"||e===null)throw new TypeError("Failed to construct 'Blob': The provided value cannot be converted to a sequence.");if(!se(e[Symbol.iterator]))throw new TypeError("Failed to construct 'Blob': The object must have a callable @@iterator property.");if(typeof t!="object"&&!se(t))throw new TypeError("Failed to construct 'Blob': parameter 2 cannot convert to dictionary.");let a=new TextEncoder;for(let o of e){let i;ArrayBuffer.isView(o)?i=new Uint8Array(o.buffer.slice(o.byteOffset,o.byteOffset+o.byteLength)):o instanceof ArrayBuffer?i=new Uint8Array(o.slice(0)):o instanceof n?i=o:i=a.encode(String(o)),Cl(this,xn,Ot(this,xn,"f")+(ArrayBuffer.isView(i)?i.byteLength:i.size),"f"),Ot(this,pa,"f").push(i)}let s=t.type===void 0?"":String(t.type);Cl(this,Ys,/^[\x20-\x7E]*$/.test(s)?s:"","f")}static[(pa=new WeakMap,Ys=new WeakMap,xn=new WeakMap,Symbol.hasInstance)](e){return!!(e&&typeof e=="object"&&se(e.constructor)&&(se(e.stream)||se(e.arrayBuffer))&&/^(Blob|File)$/.test(e[Symbol.toStringTag]))}get type(){return Ot(this,Ys,"f")}get size(){return Ot(this,xn,"f")}slice(e,t,a){return new n(Sl(Ot(this,pa,"f"),this.size,e,t),{type:a})}async text(){let e=new TextDecoder,t="";for await(let a of Gs(Ot(this,pa,"f")))t+=e.decode(a,{stream:!0});return t+=e.decode(),t}async arrayBuffer(){let e=new Uint8Array(this.size),t=0;for await(let a of Gs(Ot(this,pa,"f")))e.set(a,t),t+=a.length;return e.buffer}stream(){let e=Gs(Ot(this,pa,"f"),!0);return new oe({async pull(t){let{value:a,done:s}=await e.next();if(s)return queueMicrotask(()=>t.close());t.enqueue(a)},async cancel(){await e.return()}})}get[Symbol.toStringTag](){return"Blob"}};Object.defineProperties(tt.prototype,{type:{enumerable:!0},size:{enumerable:!0},slice:{enumerable:!0},stream:{enumerable:!0},text:{enumerable:!0},arrayBuffer:{enumerable:!0}})});var Pl,Tl,Ks,Js,Ge,kn=f(()=>{Xs();Pl=function(n,e,t,a,s){if(a==="m")throw new TypeError("Private method is not writable");if(a==="a"&&!s)throw new TypeError("Private accessor was defined without a setter");if(typeof e=="function"?n!==e||!s:!e.has(n))throw new TypeError("Cannot write private member to an object whose class did not declare it");return a==="a"?s.call(n,t):s?s.value=t:e.set(n,t),t},Tl=function(n,e,t,a){if(t==="a"&&!a)throw new TypeError("Private accessor was defined without a getter");if(typeof e=="function"?n!==e||!a:!e.has(n))throw new TypeError("Cannot read private member from an object whose class did not declare it");return t==="m"?a:t==="a"?a.call(n):a?a.value:e.get(n)},Ge=class extends tt{constructor(e,t,a={}){if(super(e,a),Ks.set(this,void 0),Js.set(this,0),arguments.length<2)throw new TypeError(`Failed to construct 'File': 2 arguments required, but only ${arguments.length} present.`);Pl(this,Ks,String(t),"f");let s=a.lastModified===void 0?Date.now():Number(a.lastModified);Number.isNaN(s)||Pl(this,Js,s,"f")}static[(Ks=new WeakMap,Js=new WeakMap,Symbol.hasInstance)](e){return e instanceof tt&&e[Symbol.toStringTag]==="File"&&typeof e.name=="string"}get name(){return Tl(this,Ks,"f")}get lastModified(){return Tl(this,Js,"f")}get webkitRelativePath(){return""}get[Symbol.toStringTag](){return"File"}}});var Oi,ji=f(()=>{kn();Oi=n=>n instanceof Ge});var El,Nl=f(()=>{Xs();El=n=>n instanceof tt});var Al,Il,Ml=f(()=>{Al=require("util"),Il=(0,Al.deprecate)(()=>{},'Constructor "entries" argument is not spec-compliant and will be removed in next major release.')});var Bl,at,Zs,nt,zi,Qs,Dl=f(()=>{Bl=require("util");kn();ji();Nl();Hs();Ml();at=function(n,e,t,a){if(t==="a"&&!a)throw new TypeError("Private accessor was defined without a getter");if(typeof e=="function"?n!==e||!a:!e.has(n))throw new TypeError("Cannot read private member from an object whose class did not declare it");return t==="m"?a:t==="a"?a.call(n):a?a.value:e.get(n)},Qs=class{constructor(e){Zs.add(this),nt.set(this,new Map),e&&(Il(),e.forEach(({name:t,value:a,fileName:s})=>this.append(t,a,s)))}static[(nt=new WeakMap,Zs=new WeakSet,Symbol.hasInstance)](e){return!!(e&&se(e.constructor)&&e[Symbol.toStringTag]==="FormData"&&se(e.append)&&se(e.set)&&se(e.get)&&se(e.getAll)&&se(e.has)&&se(e.delete)&&se(e.entries)&&se(e.values)&&se(e.keys)&&se(e[Symbol.iterator])&&se(e.forEach))}append(e,t,a){at(this,Zs,"m",zi).call(this,{name:e,fileName:a,append:!0,rawValue:t,argsLength:arguments.length})}set(e,t,a){at(this,Zs,"m",zi).call(this,{name:e,fileName:a,append:!1,rawValue:t,argsLength:arguments.length})}get(e){let t=at(this,nt,"f").get(String(e));return t?t[0]:null}getAll(e){let t=at(this,nt,"f").get(String(e));return t?t.slice():[]}has(e){return at(this,nt,"f").has(String(e))}delete(e){at(this,nt,"f").delete(String(e))}*keys(){for(let e of at(this,nt,"f").keys())yield e}*entries(){for(let e of this.keys()){let t=this.getAll(e);for(let a of t)yield[e,a]}}*values(){for(let[,e]of this)yield e}[(zi=function({name:t,rawValue:a,append:s,fileName:o,argsLength:i}){let r=s?"append":"set";if(i<2)throw new TypeError(`Failed to execute '${r}' on 'FormData': 2 arguments required, but only ${i} present.`);t=String(t);let d;if(Oi(a))d=o===void 0?a:new Ge([a],o,{type:a.type,lastModified:a.lastModified});else if(El(a))d=new Ge([a],o===void 0?"blob":o,{type:a.type});else{if(o)throw new TypeError(`Failed to execute '${r}' on 'FormData': parameter 2 is not of type 'Blob'.`);d=String(a)}let p=at(this,nt,"f").get(t);if(!p)return void at(this,nt,"f").set(t,[d]);if(!s)return void at(this,nt,"f").set(t,[d]);p.push(d)},Symbol.iterator)](){return this.entries()}forEach(e,t){for(let[a,s]of this)e.call(t,s,a,this)}get[Symbol.toStringTag](){return"FormData"}[Bl.inspect.custom](){return this[Symbol.toStringTag]}}});var Rl=f(()=>{Dl();Xs();kn()});var Ll=de((pu,Fl)=>{var Fa=1e3,La=Fa*60,$a=La*60,la=$a*24,Qm=la*7,e2=la*365.25;Fl.exports=function(n,e){e=e||{};var t=typeof n;if(t==="string"&&n.length>0)return t2(n);if(t==="number"&&isFinite(n))return e.long?n2(n):a2(n);throw new Error("val is not a non-empty string or a valid number. val="+JSON.stringify(n))};function t2(n){if(n=String(n),!(n.length>100)){var e=/^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(n);if(e){var t=parseFloat(e[1]),a=(e[2]||"ms").toLowerCase();switch(a){case"years":case"year":case"yrs":case"yr":case"y":return t*e2;case"weeks":case"week":case"w":return t*Qm;case"days":case"day":case"d":return t*la;case"hours":case"hour":case"hrs":case"hr":case"h":return t*$a;case"minutes":case"minute":case"mins":case"min":case"m":return t*La;case"seconds":case"second":case"secs":case"sec":case"s":return t*Fa;case"milliseconds":case"millisecond":case"msecs":case"msec":case"ms":return t;default:return}}}}function a2(n){var e=Math.abs(n);return e>=la?Math.round(n/la)+"d":e>=$a?Math.round(n/$a)+"h":e>=La?Math.round(n/La)+"m":e>=Fa?Math.round(n/Fa)+"s":n+"ms"}function n2(n){var e=Math.abs(n);return e>=la?eo(n,e,la,"day"):e>=$a?eo(n,e,$a,"hour"):e>=La?eo(n,e,La,"minute"):e>=Fa?eo(n,e,Fa,"second"):n+" ms"}function eo(n,e,t,a){var s=e>=t*1.5;return Math.round(n/t)+" "+a+(s?"s":"")}});var Ol=de((lu,$l)=>{"use strict";var s2=require("util"),o2=Ll();$l.exports=function(n){if(typeof n=="number")return n;var e=o2(n);if(e===void 0){var t=new Error(s2.format("humanize-ms(%j) result undefined",n));console.warn(t.stack)}return e}});var to=de((cu,jl)=>{"use strict";jl.exports={CURRENT_ID:Symbol("agentkeepalive#currentId"),CREATE_ID:Symbol("agentkeepalive#createId"),INIT_SOCKET:Symbol("agentkeepalive#initSocket"),CREATE_HTTPS_CONNECTION:Symbol("agentkeepalive#createHttpsConnection"),SOCKET_CREATED_TIME:Symbol("agentkeepalive#socketCreatedTime"),SOCKET_NAME:Symbol("agentkeepalive#socketName"),SOCKET_REQUEST_COUNT:Symbol("agentkeepalive#socketRequestCount"),SOCKET_REQUEST_FINISHED_COUNT:Symbol("agentkeepalive#socketRequestFinishedCount")}});var Gi=de((mu,ql)=>{"use strict";var i2=require("http").Agent,Vi=Ol(),Se=require("util").debuglog("agentkeepalive"),{INIT_SOCKET:zl,CURRENT_ID:ao,CREATE_ID:Vl,SOCKET_CREATED_TIME:Ul,SOCKET_NAME:Pe,SOCKET_REQUEST_COUNT:Fe,SOCKET_REQUEST_FINISHED_COUNT:st}=to(),Wi=1,Ui=parseInt(process.version.split(".",1)[0].substring(1));Ui>=11&&Ui<=12?Wi=2:Ui>=13&&(Wi=3);function Sn(n){console.log("[agentkeepalive:deprecated] %s",n)}var Hi=class extends i2{constructor(e){e=e||{},e.keepAlive=e.keepAlive!==!1,e.freeSocketTimeout===void 0&&(e.freeSocketTimeout=4e3),e.keepAliveTimeout&&(Sn("options.keepAliveTimeout is deprecated, please use options.freeSocketTimeout instead"),e.freeSocketTimeout=e.keepAliveTimeout,delete e.keepAliveTimeout),e.freeSocketKeepAliveTimeout&&(Sn("options.freeSocketKeepAliveTimeout is deprecated, please use options.freeSocketTimeout instead"),e.freeSocketTimeout=e.freeSocketKeepAliveTimeout,delete e.freeSocketKeepAliveTimeout),e.timeout===void 0&&(e.timeout=Math.max(e.freeSocketTimeout*2,8e3)),e.timeout=Vi(e.timeout),e.freeSocketTimeout=Vi(e.freeSocketTimeout),e.socketActiveTTL=e.socketActiveTTL?Vi(e.socketActiveTTL):0,super(e),this[ao]=0,this.createSocketCount=0,this.createSocketCountLastCheck=0,this.createSocketErrorCount=0,this.createSocketErrorCountLastCheck=0,this.closeSocketCount=0,this.closeSocketCountLastCheck=0,this.errorSocketCount=0,this.errorSocketCountLastCheck=0,this.requestCount=0,this.requestCountLastCheck=0,this.timeoutSocketCount=0,this.timeoutSocketCountLastCheck=0,this.on("free",t=>{let a=this.calcSocketTimeout(t);a>0&&t.timeout!==a&&t.setTimeout(a)})}get freeSocketKeepAliveTimeout(){return Sn("agent.freeSocketKeepAliveTimeout is deprecated, please use agent.options.freeSocketTimeout instead"),this.options.freeSocketTimeout}get timeout(){return Sn("agent.timeout is deprecated, please use agent.options.timeout instead"),this.options.timeout}get socketActiveTTL(){return Sn("agent.socketActiveTTL is deprecated, please use agent.options.socketActiveTTL instead"),this.options.socketActiveTTL}calcSocketTimeout(e){let t=this.options.freeSocketTimeout,a=this.options.socketActiveTTL;if(a){let s=Date.now()-e[Ul],o=a-s;if(o<=0)return o;t&&o<t&&(t=o)}if(t)return e.freeSocketTimeout||e.freeSocketKeepAliveTimeout||t}keepSocketAlive(e){let t=super.keepSocketAlive(e);if(!t)return t;let a=this.calcSocketTimeout(e);return typeof a>"u"?!0:a<=0?(Se("%s(requests: %s, finished: %s) free but need to destroy by TTL, request count %s, diff is %s",e[Pe],e[Fe],e[st],a),!1):(e.timeout!==a&&e.setTimeout(a),!0)}reuseSocket(...e){super.reuseSocket(...e);let t=e[0],a=e[1];a.reusedSocket=!0;let s=this.options.timeout;_n(t)!==s&&(t.setTimeout(s),Se("%s reset timeout to %sms",t[Pe],s)),t[Fe]++,Se("%s(requests: %s, finished: %s) reuse on addRequest, timeout %sms",t[Pe],t[Fe],t[st],_n(t))}[Vl](){let e=this[ao]++;return this[ao]===Number.MAX_SAFE_INTEGER&&(this[ao]=0),e}[zl](e,t){t.timeout&&(_n(e)||e.setTimeout(t.timeout)),this.options.keepAlive&&e.setNoDelay(!0),this.createSocketCount++,this.options.socketActiveTTL&&(e[Ul]=Date.now()),e[Pe]=`sock[${this[Vl]()}#${t._agentKey}]`.split("-----BEGIN",1)[0],e[Fe]=1,e[st]=0,r2(this,e,t)}createConnection(e,t){let a=!1,s=(i,r)=>{if(!a){if(a=!0,i)return this.createSocketErrorCount++,t(i);this[zl](r,e),t(i,r)}},o=super.createConnection(e,s);return o&&s(null,o),o}get statusChanged(){let e=this.createSocketCount!==this.createSocketCountLastCheck||this.createSocketErrorCount!==this.createSocketErrorCountLastCheck||this.closeSocketCount!==this.closeSocketCountLastCheck||this.errorSocketCount!==this.errorSocketCountLastCheck||this.timeoutSocketCount!==this.timeoutSocketCountLastCheck||this.requestCount!==this.requestCountLastCheck;return e&&(this.createSocketCountLastCheck=this.createSocketCount,this.createSocketErrorCountLastCheck=this.createSocketErrorCount,this.closeSocketCountLastCheck=this.closeSocketCount,this.errorSocketCountLastCheck=this.errorSocketCount,this.timeoutSocketCountLastCheck=this.timeoutSocketCount,this.requestCountLastCheck=this.requestCount),e}getCurrentStatus(){return{createSocketCount:this.createSocketCount,createSocketErrorCount:this.createSocketErrorCount,closeSocketCount:this.closeSocketCount,errorSocketCount:this.errorSocketCount,timeoutSocketCount:this.timeoutSocketCount,requestCount:this.requestCount,freeSockets:qi(this.freeSockets),sockets:qi(this.sockets),requests:qi(this.requests)}}};function _n(n){return n.timeout||n._idleTimeout}function r2(n,e,t){Se("%s create, timeout %sms",e[Pe],_n(e));function a(){if(!e._httpMessage&&e[Fe]===1)return;e[st]++,n.requestCount++,Se("%s(requests: %s, finished: %s) free",e[Pe],e[Fe],e[st]);let d=n.getName(t);e.writable&&n.requests[d]&&n.requests[d].length&&(e[Fe]++,Se("%s(requests: %s, finished: %s) will be reuse on agent free event",e[Pe],e[Fe],e[st]))}e.on("free",a);function s(d){Se("%s(requests: %s, finished: %s) close, isError: %s",e[Pe],e[Fe],e[st],d),n.closeSocketCount++}e.on("close",s);function o(){let d=e.listeners("timeout").length,p=_n(e),l=e._httpMessage,c=l&&l.listeners("timeout").length||0;Se("%s(requests: %s, finished: %s) timeout after %sms, listeners %s, defaultTimeoutListenerCount %s, hasHttpRequest %s, HttpRequest timeoutListenerCount %s",e[Pe],e[Fe],e[st],p,d,Wi,!!l,c),Se.enabled&&Se("timeout listeners: %s",e.listeners("timeout").map(u=>u.name).join(", ")),n.timeoutSocketCount++;let m=n.getName(t);if(n.freeSockets[m]&&n.freeSockets[m].indexOf(e)!==-1)e.destroy(),n.removeSocket(e,t),Se("%s is free, destroy quietly",e[Pe]);else if(c===0){let u=new Error("Socket timeout");u.code="ERR_SOCKET_TIMEOUT",u.timeout=p,e.destroy(u),n.removeSocket(e,t),Se("%s destroy with timeout error",e[Pe])}}e.on("timeout",o);function i(d){let p=e.listeners("error").length;Se("%s(requests: %s, finished: %s) error: %s, listenerCount: %s",e[Pe],e[Fe],e[st],d,p),n.errorSocketCount++,p===1&&(Se("%s emit uncaught error event",e[Pe]),e.removeListener("error",i),e.emit("error",d))}e.on("error",i);function r(){Se("%s(requests: %s, finished: %s) agentRemove",e[Pe],e[Fe],e[st]),e.removeListener("close",s),e.removeListener("error",i),e.removeListener("free",a),e.removeListener("timeout",o),e.removeListener("agentRemove",r)}e.on("agentRemove",r)}ql.exports=Hi;function qi(n){let e={};for(let t in n)e[t]=n[t].length;return e}});var Gl=de((uu,Hl)=>{"use strict";var Yi=require("https").Agent,d2=Gi(),{INIT_SOCKET:p2,CREATE_HTTPS_CONNECTION:Wl}=to(),Cn=class extends d2{constructor(e){super(e),this.defaultPort=443,this.protocol="https:",this.maxCachedSessions=this.options.maxCachedSessions,this.maxCachedSessions===void 0&&(this.maxCachedSessions=100),this._sessionCache={map:{},list:[]}}createConnection(e,t){let a=this[Wl](e,t);return this[p2](a,e),a}};Cn.prototype[Wl]=Yi.prototype.createConnection;["getName","_getSession","_cacheSession","_evictSession"].forEach(function(n){typeof Yi.prototype[n]=="function"&&(Cn.prototype[n]=Yi.prototype[n])});Hl.exports=Cn});var Xl=de((gu,Pn)=>{"use strict";var Yl=Gi();Pn.exports=Yl;Pn.exports.HttpAgent=Yl;Pn.exports.HttpsAgent=Gl();Pn.exports.constants=to()});var o1=de((Nn,En)=>{"use strict";Object.defineProperty(Nn,"__esModule",{value:!0});var t1=new WeakMap,Xi=new WeakMap;function X(n){let e=t1.get(n);return console.assert(e!=null,"'this' is expected an Event object, but got",n),e}function Kl(n){if(n.passiveListener!=null){typeof console<"u"&&typeof console.error=="function"&&console.error("Unable to preventDefault inside passive event listener invocation.",n.passiveListener);return}n.event.cancelable&&(n.canceled=!0,typeof n.event.preventDefault=="function"&&n.event.preventDefault())}function Oa(n,e){t1.set(this,{eventTarget:n,event:e,eventPhase:2,currentTarget:n,canceled:!1,stopped:!1,immediateStopped:!1,passiveListener:null,timeStamp:e.timeStamp||Date.now()}),Object.defineProperty(this,"isTrusted",{value:!1,enumerable:!0});let t=Object.keys(e);for(let a=0;a<t.length;++a){let s=t[a];s in this||Object.defineProperty(this,s,a1(s))}}Oa.prototype={get type(){return X(this).event.type},get target(){return X(this).eventTarget},get currentTarget(){return X(this).currentTarget},composedPath(){let n=X(this).currentTarget;return n==null?[]:[n]},get NONE(){return 0},get CAPTURING_PHASE(){return 1},get AT_TARGET(){return 2},get BUBBLING_PHASE(){return 3},get eventPhase(){return X(this).eventPhase},stopPropagation(){let n=X(this);n.stopped=!0,typeof n.event.stopPropagation=="function"&&n.event.stopPropagation()},stopImmediatePropagation(){let n=X(this);n.stopped=!0,n.immediateStopped=!0,typeof n.event.stopImmediatePropagation=="function"&&n.event.stopImmediatePropagation()},get bubbles(){return!!X(this).event.bubbles},get cancelable(){return!!X(this).event.cancelable},preventDefault(){Kl(X(this))},get defaultPrevented(){return X(this).canceled},get composed(){return!!X(this).event.composed},get timeStamp(){return X(this).timeStamp},get srcElement(){return X(this).eventTarget},get cancelBubble(){return X(this).stopped},set cancelBubble(n){if(!n)return;let e=X(this);e.stopped=!0,typeof e.event.cancelBubble=="boolean"&&(e.event.cancelBubble=!0)},get returnValue(){return!X(this).canceled},set returnValue(n){n||Kl(X(this))},initEvent(){}};Object.defineProperty(Oa.prototype,"constructor",{value:Oa,configurable:!0,writable:!0});typeof window<"u"&&typeof window.Event<"u"&&(Object.setPrototypeOf(Oa.prototype,window.Event.prototype),Xi.set(window.Event.prototype,Oa));function a1(n){return{get(){return X(this).event[n]},set(e){X(this).event[n]=e},configurable:!0,enumerable:!0}}function l2(n){return{value(){let e=X(this).event;return e[n].apply(e,arguments)},configurable:!0,enumerable:!0}}function c2(n,e){let t=Object.keys(e);if(t.length===0)return n;function a(s,o){n.call(this,s,o)}a.prototype=Object.create(n.prototype,{constructor:{value:a,configurable:!0,writable:!0}});for(let s=0;s<t.length;++s){let o=t[s];if(!(o in n.prototype)){let r=typeof Object.getOwnPropertyDescriptor(e,o).value=="function";Object.defineProperty(a.prototype,o,r?l2(o):a1(o))}}return a}function n1(n){if(n==null||n===Object.prototype)return Oa;let e=Xi.get(n);return e==null&&(e=c2(n1(Object.getPrototypeOf(n)),n),Xi.set(n,e)),e}function m2(n,e){let t=n1(Object.getPrototypeOf(e));return new t(n,e)}function u2(n){return X(n).immediateStopped}function g2(n,e){X(n).eventPhase=e}function h2(n,e){X(n).currentTarget=e}function Jl(n,e){X(n).passiveListener=e}var s1=new WeakMap,Zl=1,Ql=2,no=3;function so(n){return n!==null&&typeof n=="object"}function Tn(n){let e=s1.get(n);if(e==null)throw new TypeError("'this' is expected an EventTarget object, but got another value.");return e}function f2(n){return{get(){let t=Tn(this).get(n);for(;t!=null;){if(t.listenerType===no)return t.listener;t=t.next}return null},set(e){typeof e!="function"&&!so(e)&&(e=null);let t=Tn(this),a=null,s=t.get(n);for(;s!=null;)s.listenerType===no?a!==null?a.next=s.next:s.next!==null?t.set(n,s.next):t.delete(n):a=s,s=s.next;if(e!==null){let o={listener:e,listenerType:no,passive:!1,once:!1,next:null};a===null?t.set(n,o):a.next=o}},configurable:!0,enumerable:!0}}function Ki(n,e){Object.defineProperty(n,`on${e}`,f2(e))}function e1(n){function e(){Ye.call(this)}e.prototype=Object.create(Ye.prototype,{constructor:{value:e,configurable:!0,writable:!0}});for(let t=0;t<n.length;++t)Ki(e.prototype,n[t]);return e}function Ye(){if(this instanceof Ye){s1.set(this,new Map);return}if(arguments.length===1&&Array.isArray(arguments[0]))return e1(arguments[0]);if(arguments.length>0){let n=new Array(arguments.length);for(let e=0;e<arguments.length;++e)n[e]=arguments[e];return e1(n)}throw new TypeError("Cannot call a class as a function")}Ye.prototype={addEventListener(n,e,t){if(e==null)return;if(typeof e!="function"&&!so(e))throw new TypeError("'listener' should be a function or an object.");let a=Tn(this),s=so(t),i=(s?!!t.capture:!!t)?Zl:Ql,r={listener:e,listenerType:i,passive:s&&!!t.passive,once:s&&!!t.once,next:null},d=a.get(n);if(d===void 0){a.set(n,r);return}let p=null;for(;d!=null;){if(d.listener===e&&d.listenerType===i)return;p=d,d=d.next}p.next=r},removeEventListener(n,e,t){if(e==null)return;let a=Tn(this),o=(so(t)?!!t.capture:!!t)?Zl:Ql,i=null,r=a.get(n);for(;r!=null;){if(r.listener===e&&r.listenerType===o){i!==null?i.next=r.next:r.next!==null?a.set(n,r.next):a.delete(n);return}i=r,r=r.next}},dispatchEvent(n){if(n==null||typeof n.type!="string")throw new TypeError('"event.type" should be a string.');let e=Tn(this),t=n.type,a=e.get(t);if(a==null)return!0;let s=m2(this,n),o=null;for(;a!=null;){if(a.once?o!==null?o.next=a.next:a.next!==null?e.set(t,a.next):e.delete(t):o=a,Jl(s,a.passive?a.listener:null),typeof a.listener=="function")try{a.listener.call(this,s)}catch(i){typeof console<"u"&&typeof console.error=="function"&&console.error(i)}else a.listenerType!==no&&typeof a.listener.handleEvent=="function"&&a.listener.handleEvent(s);if(u2(s))break;a=a.next}return Jl(s,null),g2(s,0),h2(s,null),!s.defaultPrevented}};Object.defineProperty(Ye.prototype,"constructor",{value:Ye,configurable:!0,writable:!0});typeof window<"u"&&typeof window.EventTarget<"u"&&Object.setPrototypeOf(Ye.prototype,window.EventTarget.prototype);Nn.defineEventAttribute=Ki;Nn.EventTarget=Ye;Nn.default=Ye;En.exports=Ye;En.exports.EventTarget=En.exports.default=Ye;En.exports.defineEventAttribute=Ki});var d1=de((In,An)=>{"use strict";Object.defineProperty(In,"__esModule",{value:!0});var Ji=o1(),jt=class extends Ji.EventTarget{constructor(){throw super(),new TypeError("AbortSignal cannot be constructed directly")}get aborted(){let e=oo.get(this);if(typeof e!="boolean")throw new TypeError(`Expected 'this' to be an 'AbortSignal' object, but got ${this===null?"null":typeof this}`);return e}};Ji.defineEventAttribute(jt.prototype,"abort");function v2(){let n=Object.create(jt.prototype);return Ji.EventTarget.call(n),oo.set(n,!1),n}function b2(n){oo.get(n)===!1&&(oo.set(n,!0),n.dispatchEvent({type:"abort"}))}var oo=new WeakMap;Object.defineProperties(jt.prototype,{aborted:{enumerable:!0}});typeof Symbol=="function"&&typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(jt.prototype,Symbol.toStringTag,{configurable:!0,value:"AbortSignal"});var zt=class{constructor(){r1.set(this,v2())}get signal(){return i1(this)}abort(){b2(i1(this))}},r1=new WeakMap;function i1(n){let e=r1.get(n);if(e==null)throw new TypeError(`Expected 'this' to be an 'AbortController' object, but got ${n===null?"null":typeof n}`);return e}Object.defineProperties(zt.prototype,{signal:{enumerable:!0},abort:{enumerable:!0}});typeof Symbol=="function"&&typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(zt.prototype,Symbol.toStringTag,{configurable:!0,value:"AbortController"});In.AbortController=zt;In.AbortSignal=jt;In.default=zt;An.exports=zt;An.exports.AbortController=An.exports.default=zt;An.exports.AbortSignal=jt});function y2(){let n=16,e="";for(;n--;)e+=p1[Math.random()*p1.length<<0];return e}var p1,l1,c1=f(()=>{p1="abcdefghijklmnopqrstuvwxyz0123456789";l1=y2});function x2(n){if(w2(n)!=="object")return!1;let e=Object.getPrototypeOf(n);return e==null?!0:(e.constructor&&e.constructor.toString())===Object.toString()}var w2,Zi,m1=f(()=>{w2=n=>Object.prototype.toString.call(n).slice(8,-1).toLowerCase();Zi=x2});var k2,Qi,u1=f(()=>{k2=n=>String(n).replace(/\r|\n/g,(e,t,a)=>e==="\r"&&a[t+1]!==`
`||e===`
`&&a[t-1]!=="\r"?`\r
`:e),Qi=k2});var S2,er,g1=f(()=>{S2=n=>String(n).replace(/\r/g,"%0D").replace(/\n/g,"%0A").replace(/"/g,"%22"),er=S2});var _2,kt,tr=f(()=>{_2=n=>typeof n=="function",kt=_2});var ca,ar=f(()=>{tr();ca=n=>!!(n&&typeof n=="object"&&kt(n.constructor)&&n[Symbol.toStringTag]==="File"&&kt(n.stream)&&n.name!=null&&n.size!=null&&n.lastModified!=null)});var h1,nr=f(()=>{tr();h1=n=>!!(n&&kt(n.constructor)&&n[Symbol.toStringTag]==="FormData"&&kt(n.append)&&kt(n.getAll)&&kt(n.entries)&&kt(n[Symbol.iterator]))});var Mn,K,io,Vt,Bn,ro,Dn,ma,Rn,Fn,po,sr,C2,lo,f1=f(()=>{c1();m1();u1();g1();ar();nr();Mn=function(n,e,t,a,s){if(a==="m")throw new TypeError("Private method is not writable");if(a==="a"&&!s)throw new TypeError("Private accessor was defined without a setter");if(typeof e=="function"?n!==e||!s:!e.has(n))throw new TypeError("Cannot write private member to an object whose class did not declare it");return a==="a"?s.call(n,t):s?s.value=t:e.set(n,t),t},K=function(n,e,t,a){if(t==="a"&&!a)throw new TypeError("Private accessor was defined without a getter");if(typeof e=="function"?n!==e||!a:!e.has(n))throw new TypeError("Cannot read private member from an object whose class did not declare it");return t==="m"?a:t==="a"?a.call(n):a?a.value:e.get(n)},C2={enableAdditionalHeaders:!1},lo=class{constructor(e,t,a){if(io.add(this),Vt.set(this,`\r
`),Bn.set(this,void 0),ro.set(this,void 0),Dn.set(this,"-".repeat(2)),ma.set(this,new TextEncoder),Rn.set(this,void 0),Fn.set(this,void 0),po.set(this,void 0),!h1(e))throw new TypeError("Expected first argument to be a FormData instance.");let s;if(Zi(t)?a=t:s=t,s||(s=l1()),typeof s!="string")throw new TypeError("Expected boundary argument to be a string.");if(a&&!Zi(a))throw new TypeError("Expected options argument to be an object.");Mn(this,Fn,e,"f"),Mn(this,po,{...C2,...a},"f"),Mn(this,Bn,K(this,ma,"f").encode(K(this,Vt,"f")),"f"),Mn(this,ro,K(this,Bn,"f").byteLength,"f"),this.boundary=`form-data-boundary-${s}`,this.contentType=`multipart/form-data; boundary=${this.boundary}`,Mn(this,Rn,K(this,ma,"f").encode(`${K(this,Dn,"f")}${this.boundary}${K(this,Dn,"f")}${K(this,Vt,"f").repeat(2)}`),"f"),this.contentLength=String(this.getContentLength()),this.headers=Object.freeze({"Content-Type":this.contentType,"Content-Length":this.contentLength}),Object.defineProperties(this,{boundary:{writable:!1,configurable:!1},contentType:{writable:!1,configurable:!1},contentLength:{writable:!1,configurable:!1},headers:{writable:!1,configurable:!1}})}getContentLength(){let e=0;for(let[t,a]of K(this,Fn,"f")){let s=ca(a)?a:K(this,ma,"f").encode(Qi(a));e+=K(this,io,"m",sr).call(this,t,s).byteLength,e+=ca(s)?s.size:s.byteLength,e+=K(this,ro,"f")}return e+K(this,Rn,"f").byteLength}*values(){for(let[e,t]of K(this,Fn,"f").entries()){let a=ca(t)?t:K(this,ma,"f").encode(Qi(t));yield K(this,io,"m",sr).call(this,e,a),yield a,yield K(this,Bn,"f")}yield K(this,Rn,"f")}async*encode(){for(let e of this.values())ca(e)?yield*e.stream():yield e}[(Vt=new WeakMap,Bn=new WeakMap,ro=new WeakMap,Dn=new WeakMap,ma=new WeakMap,Rn=new WeakMap,Fn=new WeakMap,po=new WeakMap,io=new WeakSet,sr=function(t,a){let s="";return s+=`${K(this,Dn,"f")}${this.boundary}${K(this,Vt,"f")}`,s+=`Content-Disposition: form-data; name="${er(t)}"`,ca(a)&&(s+=`; filename="${er(a.name)}"${K(this,Vt,"f")}`,s+=`Content-Type: ${a.type||"application/octet-stream"}`),K(this,po,"f").enableAdditionalHeaders===!0&&(s+=`${K(this,Vt,"f")}Content-Length: ${ca(a)?a.size:a.byteLength}`),K(this,ma,"f").encode(`${s}${K(this,Vt,"f").repeat(2)}`)},Symbol.iterator)](){return this.values()}[Symbol.asyncIterator](){return this.encode()}}});var v1=f(()=>{});var b1=f(()=>{});var y1=f(()=>{f1();v1();b1();ar();nr()});var co,w1=f(()=>{co=class{constructor(e){this.body=e}get[Symbol.toStringTag](){return"MultipartBody"}}});var k1=de(($u,x1)=>{if(!globalThis.DOMException)try{let{MessageChannel:n}=require("worker_threads"),e=new n().port1,t=new ArrayBuffer;e.postMessage(t,[t,t])}catch(n){n.constructor.name==="DOMException"&&(globalThis.DOMException=n.constructor)}x1.exports=globalThis.DOMException});function T2(n){if(P2(n)!=="object")return!1;let e=Object.getPrototypeOf(n);return e==null?!0:(e.constructor&&e.constructor.toString())===Object.toString()}var P2,S1,_1=f(()=>{P2=n=>Object.prototype.toString.call(n).slice(8,-1).toLowerCase();S1=T2});var N1={};At(N1,{fileFromPath:()=>A2,fileFromPathSync:()=>N2,isFile:()=>Oi});function E1(n,{mtimeMs:e,size:t},a,s={}){let o;S1(a)?[s,o]=[a,void 0]:o=a;let i=new or({path:n,size:t,lastModified:e});return o||(o=i.name),new Ge([i],o,{...s,lastModified:i.lastModified})}function N2(n,e,t={}){let a=(0,ga.statSync)(n);return E1(n,a,e,t)}async function A2(n,e,t){let a=await ga.promises.stat(n);return E1(n,a,e,t)}var ga,P1,T1,C1,ja,ua,Ln,E2,or,A1=f(()=>{ga=require("fs"),P1=require("path"),T1=L(k1(),1);kn();_1();ji();C1=function(n,e,t,a,s){if(a==="m")throw new TypeError("Private method is not writable");if(a==="a"&&!s)throw new TypeError("Private accessor was defined without a setter");if(typeof e=="function"?n!==e||!s:!e.has(n))throw new TypeError("Cannot write private member to an object whose class did not declare it");return a==="a"?s.call(n,t):s?s.value=t:e.set(n,t),t},ja=function(n,e,t,a){if(t==="a"&&!a)throw new TypeError("Private accessor was defined without a getter");if(typeof e=="function"?n!==e||!a:!e.has(n))throw new TypeError("Cannot read private member from an object whose class did not declare it");return t==="m"?a:t==="a"?a.call(n):a?a.value:e.get(n)},E2="The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.",or=class n{constructor(e){ua.set(this,void 0),Ln.set(this,void 0),C1(this,ua,e.path,"f"),C1(this,Ln,e.start||0,"f"),this.name=(0,P1.basename)(ja(this,ua,"f")),this.size=e.size,this.lastModified=e.lastModified}slice(e,t){return new n({path:ja(this,ua,"f"),lastModified:this.lastModified,size:t-e,start:e})}async*stream(){let{mtimeMs:e}=await ga.promises.stat(ja(this,ua,"f"));if(e>this.lastModified)throw new T1.default(E2,"NotReadableError");this.size&&(yield*(0,ga.createReadStream)(ja(this,ua,"f"),{start:ja(this,Ln,"f"),end:ja(this,Ln,"f")+this.size-1}))}get[(ua=new WeakMap,Ln=new WeakMap,Symbol.toStringTag)](){return"File"}}});async function I2(n,...e){let{fileFromPath:t}=await Promise.resolve().then(()=>(A1(),N1));return I1||(console.warn(`fileFromPath is deprecated; use fs.createReadStream(${JSON.stringify(n)}) instead`),I1=!0),await t(n,...e)}async function D2(n,e){let t=new lo(n),a=D1.Readable.from(t),s=new co(a),o={...e.headers,...t.headers,"Content-Length":t.contentLength};return{...e,body:s,headers:o}}function F1(){return typeof AbortController>"u"&&(globalThis.AbortController=M1.AbortController),{kind:"node",fetch:Ut.default,Request:Ut.Request,Response:Ut.Response,Headers:Ut.Headers,FormData:Qs,Blob:tt,File:Ge,ReadableStream:R1.ReadableStream,getMultipartRequestOptions:D2,getDefaultAgent:n=>n.startsWith("https")?B2:M2,fileFromPath:I2,isFsReadStream:n=>n instanceof B1.ReadStream}}var Ut,ir,M1,B1,D1,R1,I1,M2,B2,L1=f(()=>{Ut=L(ap(),1);Rl();ir=L(Xl(),1),M1=L(d1(),1),B1=require("node:fs");y1();D1=require("node:stream");w1();R1=require("node:stream/web"),I1=!1;M2=new ir.default({keepAlive:!0,timeout:300*1e3}),B2=new ir.default.HttpsAgent({keepAlive:!0,timeout:300*1e3})});var $1=f(()=>{L1()});var $n=f(()=>{Ko();$1();Ko();Qt||vd(F1(),{auto:!0})});var N,ce,fe,qt,za,On,jn,zn,Vn,Un,qn,Wn,Hn,ot=f(()=>{Va();N=class extends Error{},ce=class n extends N{constructor(e,t,a,s){super(`${n.makeMessage(e,t,a)}`),this.status=e,this.headers=s,this.request_id=s?.["request-id"],this.error=t}static makeMessage(e,t,a){let s=t?.message?typeof t.message=="string"?t.message:JSON.stringify(t.message):t?JSON.stringify(t):a;return e&&s?`${e} ${s}`:e?`${e} status code (no body)`:s||"(no status code or body)"}static generate(e,t,a,s){if(!e)return new qt({message:a,cause:mo(t)});let o=t;return e===400?new On(e,o,a,s):e===401?new jn(e,o,a,s):e===403?new zn(e,o,a,s):e===404?new Vn(e,o,a,s):e===409?new Un(e,o,a,s):e===422?new qn(e,o,a,s):e===429?new Wn(e,o,a,s):e>=500?new Hn(e,o,a,s):new n(e,o,a,s)}},fe=class extends ce{constructor({message:e}={}){super(void 0,void 0,e||"Request was aborted.",void 0),this.status=void 0}},qt=class extends ce{constructor({message:e,cause:t}){super(void 0,void 0,e||"Connection error.",void 0),this.status=void 0,t&&(this.cause=t)}},za=class extends qt{constructor({message:e}={}){super({message:e??"Request timed out."})}},On=class extends ce{constructor(){super(...arguments),this.status=400}},jn=class extends ce{constructor(){super(...arguments),this.status=401}},zn=class extends ce{constructor(){super(...arguments),this.status=403}},Vn=class extends ce{constructor(){super(...arguments),this.status=404}},Un=class extends ce{constructor(){super(...arguments),this.status=409}},qn=class extends ce{constructor(){super(...arguments),this.status=422}},Wn=class extends ce{constructor(){super(...arguments),this.status=429}},Hn=class extends ce{}});var St,rr=f(()=>{ot();St=class n{constructor(){this.buffer=[],this.trailingCR=!1}decode(e){let t=this.decodeText(e);if(this.trailingCR&&(t="\r"+t,this.trailingCR=!1),t.endsWith("\r")&&(this.trailingCR=!0,t=t.slice(0,-1)),!t)return[];let a=n.NEWLINE_CHARS.has(t[t.length-1]||""),s=t.split(n.NEWLINE_REGEXP);return a&&s.pop(),s.length===1&&!a?(this.buffer.push(s[0]),[]):(this.buffer.length>0&&(s=[this.buffer.join("")+s[0],...s.slice(1)],this.buffer=[]),a||(this.buffer=[s.pop()||""]),s)}decodeText(e){if(e==null)return"";if(typeof e=="string")return e;if(typeof Buffer<"u"){if(e instanceof Buffer)return e.toString();if(e instanceof Uint8Array)return Buffer.from(e).toString();throw new N(`Unexpected: received non-Uint8Array (${e.constructor.name}) stream chunk in an environment with a global "Buffer" defined, which this library assumes to be Node. Please report this error.`)}if(typeof TextDecoder<"u"){if(e instanceof Uint8Array||e instanceof ArrayBuffer)return this.textDecoder??(this.textDecoder=new TextDecoder("utf8")),this.textDecoder.decode(e);throw new N(`Unexpected: received non-Uint8Array/ArrayBuffer (${e.constructor.name}) in a web platform. Please report this error.`)}throw new N("Unexpected: neither Buffer nor TextDecoder are available as globals. Please report this error.")}flush(){if(!this.buffer.length&&!this.trailingCR)return[];let e=[this.buffer.join("")];return this.buffer=[],this.trailingCR=!1,e}};St.NEWLINE_CHARS=new Set([`
`,"\r"]);St.NEWLINE_REGEXP=/\r\n|[\n\r]/g});async function*L2(n,e){if(!n.body)throw e.abort(),new N("Attempted to iterate over a response with no body");let t=new dr,a=new St,s=uo(n.body);for await(let o of $2(s))for(let i of a.decode(o)){let r=t.decode(i);r&&(yield r)}for(let o of a.flush()){let i=t.decode(o);i&&(yield i)}}async function*$2(n){let e=new Uint8Array;for await(let t of n){if(t==null)continue;let a=t instanceof ArrayBuffer?new Uint8Array(t):typeof t=="string"?new TextEncoder().encode(t):t,s=new Uint8Array(e.length+a.length);s.set(e),s.set(a,e.length),e=s;let o;for(;(o=O2(e))!==-1;)yield e.slice(0,o),e=e.slice(o)}e.length>0&&(yield e)}function O2(n){for(let a=0;a<n.length-2;a++){if(n[a]===10&&n[a+1]===10||n[a]===13&&n[a+1]===13)return a+2;if(n[a]===13&&n[a+1]===10&&a+3<n.length&&n[a+2]===13&&n[a+3]===10)return a+4}return-1}function j2(n,e){let t=n.indexOf(e);return t!==-1?[n.substring(0,t),e,n.substring(t+e.length)]:[n,"",""]}function uo(n){if(n[Symbol.asyncIterator])return n;let e=n.getReader();return{async next(){try{let t=await e.read();return t?.done&&e.releaseLock(),t}catch(t){throw e.releaseLock(),t}},async return(){let t=e.cancel();return e.releaseLock(),await t,{done:!0,value:void 0}},[Symbol.asyncIterator](){return this}}}var it,dr,Gn=f(()=>{$n();ot();rr();Va();ot();it=class n{constructor(e,t){this.iterator=e,this.controller=t}static fromSSEResponse(e,t){let a=!1;async function*s(){if(a)throw new Error("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");a=!0;let o=!1;try{for await(let i of L2(e,t)){if(i.event==="completion")try{yield JSON.parse(i.data)}catch(r){throw console.error("Could not parse message into JSON:",i.data),console.error("From chunk:",i.raw),r}if(i.event==="message_start"||i.event==="message_delta"||i.event==="message_stop"||i.event==="content_block_start"||i.event==="content_block_delta"||i.event==="content_block_stop")try{yield JSON.parse(i.data)}catch(r){throw console.error("Could not parse message into JSON:",i.data),console.error("From chunk:",i.raw),r}if(i.event!=="ping"&&i.event==="error")throw ce.generate(void 0,`SSE Error: ${i.data}`,i.data,pr(e.headers))}o=!0}catch(i){if(i instanceof Error&&i.name==="AbortError")return;throw i}finally{o||t.abort()}}return new n(s,t)}static fromReadableStream(e,t){let a=!1;async function*s(){let i=new St,r=uo(e);for await(let d of r)for(let p of i.decode(d))yield p;for(let d of i.flush())yield d}async function*o(){if(a)throw new Error("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");a=!0;let i=!1;try{for await(let r of s())i||r&&(yield JSON.parse(r));i=!0}catch(r){if(r instanceof Error&&r.name==="AbortError")return;throw r}finally{i||t.abort()}}return new n(o,t)}[Symbol.asyncIterator](){return this.iterator()}tee(){let e=[],t=[],a=this.iterator(),s=o=>({next:()=>{if(o.length===0){let i=a.next();e.push(i),t.push(i)}return o.shift()}});return[new n(()=>s(e),this.controller),new n(()=>s(t),this.controller)]}toReadableStream(){let e=this,t,a=new TextEncoder;return new Yo({async start(){t=e[Symbol.asyncIterator]()},async pull(s){try{let{value:o,done:i}=await t.next();if(i)return s.close();let r=a.encode(JSON.stringify(o)+`
`);s.enqueue(r)}catch(o){s.error(o)}},async cancel(){await t.return?.()}})}};dr=class{constructor(){this.event=null,this.data=[],this.chunks=[]}decode(e){if(e.endsWith("\r")&&(e=e.substring(0,e.length-1)),!e){if(!this.event&&!this.data.length)return null;let o={event:this.event,data:this.data.join(`
`),raw:this.chunks};return this.event=null,this.data=[],this.chunks=[],o}if(this.chunks.push(e),e.startsWith(":"))return null;let[t,a,s]=j2(e,":");return s.startsWith(" ")&&(s=s.substring(1)),t==="event"?this.event=s:t==="data"&&this.data.push(s),null}}});async function O1(n,e,t){if(n=await n,V2(n))return n;if(z2(n)){let s=await n.blob();e||(e=new URL(n.url).pathname.split(/[\\/]/).pop()??"unknown_file");let o=Yn(s)?[await s.arrayBuffer()]:[s];return new ms(o,e,t)}let a=await U2(n);if(e||(e=W2(n)??"unknown_file"),!t?.type){let s=a[0]?.type;typeof s=="string"&&(t={...t,type:s})}return new ms(a,e,t)}async function U2(n){let e=[];if(typeof n=="string"||ArrayBuffer.isView(n)||n instanceof ArrayBuffer)e.push(n);else if(Yn(n))e.push(await n.arrayBuffer());else if(H2(n))for await(let t of n)e.push(t);else throw new Error(`Unexpected data type: ${typeof n}; constructor: ${n?.constructor?.name}; props: ${q2(n)}`);return e}function q2(n){return`[${Object.getOwnPropertyNames(n).map(t=>`"${t}"`).join(", ")}]`}function W2(n){return lr(n.name)||lr(n.filename)||lr(n.path)?.split(/[\\/]/).pop()}var z2,V2,Yn,lr,H2,cr,mr=f(()=>{$n();$n();z2=n=>n!=null&&typeof n=="object"&&typeof n.url=="string"&&typeof n.blob=="function",V2=n=>n!=null&&typeof n=="object"&&typeof n.name=="string"&&typeof n.lastModified=="number"&&Yn(n),Yn=n=>n!=null&&typeof n=="object"&&typeof n.size=="number"&&typeof n.type=="string"&&typeof n.text=="function"&&typeof n.slice=="function"&&typeof n.arrayBuffer=="function";lr=n=>{if(typeof n=="string")return n;if(typeof Buffer<"u"&&n instanceof Buffer)return String(n)},H2=n=>n!=null&&typeof n=="object"&&typeof n[Symbol.asyncIterator]=="function",cr=n=>n&&typeof n=="object"&&n.body&&n[Symbol.toStringTag]==="MultipartBody"});async function W1(n){let{response:e}=n;if(n.options.stream)return Ua("response",e.status,e.url,e.headers,e.body),n.options.__streamClass?n.options.__streamClass.fromSSEResponse(e,n.controller):it.fromSSEResponse(e,n.controller);if(e.status===204)return null;if(n.options.__binaryResponse)return e;let t=e.headers.get("content-type");if(t?.includes("application/json")||t?.includes("application/vnd.api+json")){let o=await e.json();return Ua("response",e.status,e.url,e.headers,o),o}let s=await e.text();return Ua("response",e.status,e.url,e.headers,s),s}function Z2(){if(typeof navigator>"u"||!navigator)return null;let n=[{key:"edge",pattern:/Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/},{key:"ie",pattern:/MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/},{key:"ie",pattern:/Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/},{key:"chrome",pattern:/Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/},{key:"firefox",pattern:/Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/},{key:"safari",pattern:/(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/}];for(let{key:e,pattern:t}of n){let a=t.exec(navigator.userAgent);if(a){let s=a[1]||0,o=a[2]||0,i=a[3]||0;return{browser:e,version:`${s}.${o}.${i}`}}}return null}function Kn(n){if(!n)return!0;for(let e in n)return!1;return!0}function H1(n,e){return Object.prototype.hasOwnProperty.call(n,e)}function U1(n,e){for(let t in e){if(!H1(e,t))continue;let a=t.toLowerCase();if(!a)continue;let s=e[t];s===null?delete n[a]:s!==void 0&&(n[a]=s)}}function Ua(n,...e){typeof process<"u"&&process?.env?.DEBUG==="true"&&console.log(`Anthropic:DEBUG:${n}`,...e)}var Y2,X2,go,ho,fo,vo,gr,pr,K2,Xn,J2,j1,z1,V1,Q2,e0,t0,a0,n0,ur,mo,bo,s0,G1,o0,q1,Va=f(()=>{md();Gn();ot();$n();mr();Y2=function(n,e,t,a,s){if(a==="m")throw new TypeError("Private method is not writable");if(a==="a"&&!s)throw new TypeError("Private accessor was defined without a setter");if(typeof e=="function"?n!==e||!s:!e.has(n))throw new TypeError("Cannot write private member to an object whose class did not declare it");return a==="a"?s.call(n,t):s?s.value=t:e.set(n,t),t},X2=function(n,e,t,a){if(t==="a"&&!a)throw new TypeError("Private accessor was defined without a getter");if(typeof e=="function"?n!==e||!a:!e.has(n))throw new TypeError("Cannot read private member from an object whose class did not declare it");return t==="m"?a:t==="a"?a.call(n):a?a.value:e.get(n)};ho=class n extends Promise{constructor(e,t=W1){super(a=>{a(null)}),this.responsePromise=e,this.parseResponse=t}_thenUnwrap(e){return new n(this.responsePromise,async t=>e(await this.parseResponse(t),t))}asResponse(){return this.responsePromise.then(e=>e.response)}async withResponse(){let[e,t]=await Promise.all([this.parse(),this.asResponse()]);return{data:e,response:t}}parse(){return this.parsedPromise||(this.parsedPromise=this.responsePromise.then(this.parseResponse)),this.parsedPromise}then(e,t){return this.parse().then(e,t)}catch(e){return this.parse().catch(e)}finally(e){return this.parse().finally(e)}},fo=class{constructor({baseURL:e,maxRetries:t=2,timeout:a=6e5,httpAgent:s,fetch:o}){this.baseURL=e,this.maxRetries=ur("maxRetries",t),this.timeout=ur("timeout",a),this.httpAgent=s,this.fetch=o??Go}authHeaders(e){return{}}defaultHeaders(e){return{Accept:"application/json","Content-Type":"application/json","User-Agent":this.getUserAgent(),...Q2(),...this.authHeaders(e)}}validateHeaders(e,t){}defaultIdempotencyKey(){return`stainless-node-retry-${s0()}`}get(e,t){return this.methodRequest("get",e,t)}post(e,t){return this.methodRequest("post",e,t)}patch(e,t){return this.methodRequest("patch",e,t)}put(e,t){return this.methodRequest("put",e,t)}delete(e,t){return this.methodRequest("delete",e,t)}methodRequest(e,t,a){return this.request(Promise.resolve(a).then(async s=>{let o=s&&Yn(s?.body)?new DataView(await s.body.arrayBuffer()):s?.body instanceof DataView?s.body:s?.body instanceof ArrayBuffer?new DataView(s.body):s&&ArrayBuffer.isView(s?.body)?new DataView(s.body.buffer):s?.body;return{method:e,path:t,...s,body:o}}))}getAPIList(e,t,a){return this.requestAPIList(t,{method:"get",path:e,...a})}calculateContentLength(e){if(typeof e=="string"){if(typeof Buffer<"u")return Buffer.byteLength(e,"utf8").toString();if(typeof TextEncoder<"u")return new TextEncoder().encode(e).length.toString()}else if(ArrayBuffer.isView(e))return e.byteLength.toString();return null}buildRequest(e,{retryCount:t=0}={}){let{method:a,path:s,query:o,headers:i={}}=e,r=ArrayBuffer.isView(e.body)||e.__binaryRequest&&typeof e.body=="string"?e.body:cr(e.body)?e.body.body:e.body?JSON.stringify(e.body,null,2):null,d=this.calculateContentLength(r),p=this.buildURL(s,o);"timeout"in e&&ur("timeout",e.timeout);let l=e.timeout??this.timeout,c=e.httpAgent??this.httpAgent??Xo(p),m=l+1e3;typeof c?.options?.timeout=="number"&&m>(c.options.timeout??0)&&(c.options.timeout=m),this.idempotencyHeader&&a!=="get"&&(e.idempotencyKey||(e.idempotencyKey=this.defaultIdempotencyKey()),i[this.idempotencyHeader]=e.idempotencyKey);let u=this.buildHeaders({options:e,headers:i,contentLength:d,retryCount:t});return{req:{method:a,...r&&{body:r},headers:u,...c&&{agent:c},signal:e.signal??null},url:p,timeout:l}}buildHeaders({options:e,headers:t,contentLength:a,retryCount:s}){let o={};a&&(o["content-length"]=a);let i=this.defaultHeaders(e);return U1(o,i),U1(o,t),cr(e.body)&&Qt!=="node"&&delete o["content-type"],q1(i,"x-stainless-retry-count")===void 0&&q1(t,"x-stainless-retry-count")===void 0&&(o["x-stainless-retry-count"]=String(s)),this.validateHeaders(o,t),o}async prepareOptions(e){}async prepareRequest(e,{url:t,options:a}){}parseHeaders(e){return e?Symbol.iterator in e?Object.fromEntries(Array.from(e).map(t=>[...t])):{...e}:{}}makeStatusError(e,t,a,s){return ce.generate(e,t,a,s)}request(e,t=null){return new ho(this.makeRequest(e,t))}async makeRequest(e,t){let a=await e,s=a.maxRetries??this.maxRetries;t==null&&(t=s),await this.prepareOptions(a);let{req:o,url:i,timeout:r}=this.buildRequest(a,{retryCount:s-t});if(await this.prepareRequest(o,{url:i,options:a}),Ua("request",i,a,o.headers),a.signal?.aborted)throw new fe;let d=new AbortController,p=await this.fetchWithTimeout(i,o,r,d).catch(mo);if(p instanceof Error){if(a.signal?.aborted)throw new fe;if(t)return this.retryRequest(a,t);throw p.name==="AbortError"?new za:new qt({cause:p})}let l=pr(p.headers);if(!p.ok){if(t&&this.shouldRetry(p)){let v=`retrying, ${t} attempts remaining`;return Ua(`response (error; ${v})`,p.status,i,l),this.retryRequest(a,t,l)}let c=await p.text().catch(v=>mo(v).message),m=e0(c),u=m?void 0:c;throw Ua(`response (error; ${t?"(error; no more retries left)":"(error; not retryable)"})`,p.status,i,l,u),this.makeStatusError(p.status,m,u,l)}return{response:p,options:a,controller:d}}requestAPIList(e,t){let a=this.makeRequest(t,null);return new gr(this,a,e)}buildURL(e,t){let a=a0(e)?new URL(e):new URL(this.baseURL+(this.baseURL.endsWith("/")&&e.startsWith("/")?e.slice(1):e)),s=this.defaultQuery();return Kn(s)||(t={...s,...t}),typeof t=="object"&&t&&!Array.isArray(t)&&(a.search=this.stringifyQuery(t)),a.toString()}stringifyQuery(e){return Object.entries(e).filter(([t,a])=>typeof a<"u").map(([t,a])=>{if(typeof a=="string"||typeof a=="number"||typeof a=="boolean")return`${encodeURIComponent(t)}=${encodeURIComponent(a)}`;if(a===null)return`${encodeURIComponent(t)}=`;throw new N(`Cannot stringify type ${typeof a}; Expected string, number, boolean, or null. If you need to pass nested query parameters, you can manually encode them, e.g. { query: { 'foo[key1]': value1, 'foo[key2]': value2 } }, and please open a GitHub issue requesting better support for your use case.`)}).join("&")}async fetchWithTimeout(e,t,a,s){let{signal:o,...i}=t||{};o&&o.addEventListener("abort",()=>s.abort());let r=setTimeout(()=>s.abort(),a);return this.getRequestClient().fetch.call(void 0,e,{signal:s.signal,...i}).finally(()=>{clearTimeout(r)})}getRequestClient(){return{fetch:this.fetch}}shouldRetry(e){let t=e.headers.get("x-should-retry");return t==="true"?!0:t==="false"?!1:e.status===408||e.status===409||e.status===429||e.status>=500}async retryRequest(e,t,a){let s,o=a?.["retry-after-ms"];if(o){let r=parseFloat(o);Number.isNaN(r)||(s=r)}let i=a?.["retry-after"];if(i&&!s){let r=parseFloat(i);Number.isNaN(r)?s=Date.parse(i)-Date.now():s=r*1e3}if(!(s&&0<=s&&s<60*1e3)){let r=e.maxRetries??this.maxRetries;s=this.calculateDefaultRetryTimeoutMillis(t,r)}return await n0(s),this.makeRequest(e,t-1)}calculateDefaultRetryTimeoutMillis(e,t){let o=t-e,i=Math.min(.5*Math.pow(2,o),8),r=1-Math.random()*.25;return i*r*1e3}getUserAgent(){return`${this.constructor.name}/JS ${Zt}`}},vo=class{constructor(e,t,a,s){go.set(this,void 0),Y2(this,go,e,"f"),this.options=s,this.response=t,this.body=a}hasNextPage(){return this.getPaginatedItems().length?this.nextPageInfo()!=null:!1}async getNextPage(){let e=this.nextPageInfo();if(!e)throw new N("No next page expected; please check `.hasNextPage()` before calling `.getNextPage()`.");let t={...this.options};if("params"in e&&typeof t.query=="object")t.query={...t.query,...e.params};else if("url"in e){let a=[...Object.entries(t.query||{}),...e.url.searchParams.entries()];for(let[s,o]of a)e.url.searchParams.set(s,o);t.query=void 0,t.path=e.url.toString()}return await X2(this,go,"f").requestAPIList(this.constructor,t)}async*iterPages(){let e=this;for(yield e;e.hasNextPage();)e=await e.getNextPage(),yield e}async*[(go=new WeakMap,Symbol.asyncIterator)](){for await(let e of this.iterPages())for(let t of e.getPaginatedItems())yield t}},gr=class extends ho{constructor(e,t,a){super(t,async s=>new a(e,s.response,await W1(s),s.options))}async*[Symbol.asyncIterator](){let e=await this;for await(let t of e)yield t}},pr=n=>new Proxy(Object.fromEntries(n.entries()),{get(e,t){let a=t.toString();return e[a.toLowerCase()]||e[a]}}),K2={method:!0,path:!0,query:!0,body:!0,headers:!0,maxRetries:!0,stream:!0,timeout:!0,httpAgent:!0,signal:!0,idempotencyKey:!0,__binaryRequest:!0,__binaryResponse:!0,__streamClass:!0},Xn=n=>typeof n=="object"&&n!==null&&!Kn(n)&&Object.keys(n).every(e=>H1(K2,e)),J2=()=>{if(typeof Deno<"u"&&Deno.build!=null)return{"X-Stainless-Lang":"js","X-Stainless-Package-Version":Zt,"X-Stainless-OS":z1(Deno.build.os),"X-Stainless-Arch":j1(Deno.build.arch),"X-Stainless-Runtime":"deno","X-Stainless-Runtime-Version":typeof Deno.version=="string"?Deno.version:Deno.version?.deno??"unknown"};if(typeof EdgeRuntime<"u")return{"X-Stainless-Lang":"js","X-Stainless-Package-Version":Zt,"X-Stainless-OS":"Unknown","X-Stainless-Arch":`other:${EdgeRuntime}`,"X-Stainless-Runtime":"edge","X-Stainless-Runtime-Version":process.version};if(Object.prototype.toString.call(typeof process<"u"?process:0)==="[object process]")return{"X-Stainless-Lang":"js","X-Stainless-Package-Version":Zt,"X-Stainless-OS":z1(process.platform),"X-Stainless-Arch":j1(process.arch),"X-Stainless-Runtime":"node","X-Stainless-Runtime-Version":process.version};let n=Z2();return n?{"X-Stainless-Lang":"js","X-Stainless-Package-Version":Zt,"X-Stainless-OS":"Unknown","X-Stainless-Arch":"unknown","X-Stainless-Runtime":`browser:${n.browser}`,"X-Stainless-Runtime-Version":n.version}:{"X-Stainless-Lang":"js","X-Stainless-Package-Version":Zt,"X-Stainless-OS":"Unknown","X-Stainless-Arch":"unknown","X-Stainless-Runtime":"unknown","X-Stainless-Runtime-Version":"unknown"}};j1=n=>n==="x32"?"x32":n==="x86_64"||n==="x64"?"x64":n==="arm"?"arm":n==="aarch64"||n==="arm64"?"arm64":n?`other:${n}`:"unknown",z1=n=>(n=n.toLowerCase(),n.includes("ios")?"iOS":n==="android"?"Android":n==="darwin"?"MacOS":n==="win32"?"Windows":n==="freebsd"?"FreeBSD":n==="openbsd"?"OpenBSD":n==="linux"?"Linux":n?`Other:${n}`:"Unknown"),Q2=()=>V1??(V1=J2()),e0=n=>{try{return JSON.parse(n)}catch{return}},t0=new RegExp("^(?:[a-z]+:)?//","i"),a0=n=>t0.test(n),n0=n=>new Promise(e=>setTimeout(e,n)),ur=(n,e)=>{if(typeof e!="number"||!Number.isInteger(e))throw new N(`${n} must be an integer`);if(e<0)throw new N(`${n} must be a positive integer`);return e},mo=n=>{if(n instanceof Error)return n;if(typeof n=="object"&&n!==null)try{return new Error(JSON.stringify(n))}catch{}return new Error(String(n))},bo=n=>{if(typeof process<"u")return process.env?.[n]?.trim()??void 0;if(typeof Deno<"u")return Deno.env?.get?.(n)?.trim()};s0=()=>"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,n=>{let e=Math.random()*16|0;return(n==="x"?e:e&3|8).toString(16)}),G1=()=>typeof window<"u"&&typeof window.document<"u"&&typeof navigator<"u",o0=n=>typeof n?.get=="function",q1=(n,e)=>{let t=e.toLowerCase();if(o0(n)){let a=e[0]?.toUpperCase()+e.substring(1).replace(/([^\w])(\w)/g,(s,o,i)=>o+i.toUpperCase());for(let s of[e,t,e.toUpperCase(),a]){let o=n.get(s);if(o)return o}}for(let[a,s]of Object.entries(n))if(a.toLowerCase()===t)return Array.isArray(s)?(s.length<=1||console.warn(`Received ${s.length} entries for the ${e} header, using the first entry.`),s[0]):s}});var yo,Y1=f(()=>{Va();yo=class extends vo{constructor(e,t,a,s){super(e,t,a,s),this.data=a.data||[],this.has_more=a.has_more||!1,this.first_id=a.first_id||null,this.last_id=a.last_id||null}getPaginatedItems(){return this.data??[]}nextPageParams(){let e=this.nextPageInfo();if(!e)return null;if("params"in e)return e.params;let t=Object.fromEntries(e.url.searchParams);return Object.keys(t).length?t:null}nextPageInfo(){if(this.options.query?.before_id){let t=this.first_id;return t?{params:{before_id:t}}:null}let e=this.last_id;return e?{params:{after_id:e}}:null}}});var ye,Wt=f(()=>{ye=class{constructor(e){this._client=e}}});var wo,X1=f(()=>{ot();Gn();rr();wo=class n{constructor(e,t){this.iterator=e,this.controller=t}async*decoder(){let e=new St;for await(let t of this.iterator)for(let a of e.decode(t))yield JSON.parse(a);for(let t of e.flush())yield JSON.parse(t)}[Symbol.asyncIterator](){return this.decoder()}static fromResponse(e,t){if(!e.body)throw t.abort(),new N("Attempted to iterate over a response with no body");return new n(uo(e.body),t)}}});var ha,qa,hr=f(()=>{Wt();Va();Y1();X1();ot();ha=class extends ye{create(e,t){let{betas:a,...s}=e;return this._client.post("/v1/messages/batches?beta=true",{body:s,...t,headers:{"anthropic-beta":[...a??[],"message-batches-2024-09-24"].toString(),...t?.headers}})}retrieve(e,t={},a){if(Xn(t))return this.retrieve(e,{},t);let{betas:s}=t;return this._client.get(`/v1/messages/batches/${e}?beta=true`,{...a,headers:{"anthropic-beta":[...s??[],"message-batches-2024-09-24"].toString(),...a?.headers}})}list(e={},t){if(Xn(e))return this.list({},e);let{betas:a,...s}=e;return this._client.getAPIList("/v1/messages/batches?beta=true",qa,{query:s,...t,headers:{"anthropic-beta":[...a??[],"message-batches-2024-09-24"].toString(),...t?.headers}})}cancel(e,t={},a){if(Xn(t))return this.cancel(e,{},t);let{betas:s}=t;return this._client.post(`/v1/messages/batches/${e}/cancel?beta=true`,{...a,headers:{"anthropic-beta":[...s??[],"message-batches-2024-09-24"].toString(),...a?.headers}})}async results(e,t={},a){if(Xn(t))return this.results(e,{},t);let s=await this.retrieve(e);if(!s.results_url)throw new N(`No batch \`results_url\`; Has it finished processing? ${s.processing_status} - ${s.id}`);let{betas:o}=t;return this._client.get(s.results_url,{...a,headers:{"anthropic-beta":[...o??[],"message-batches-2024-09-24"].toString(),...a?.headers},__binaryResponse:!0})._thenUnwrap((i,r)=>wo.fromResponse(r.response,r.controller))}},qa=class extends yo{};ha.BetaMessageBatchesPage=qa});var Ht,fr=f(()=>{Wt();hr();hr();Ht=class extends ye{constructor(){super(...arguments),this.batches=new ha(this._client)}create(e,t){let{betas:a,...s}=e;return this._client.post("/v1/messages?beta=true",{body:s,timeout:this._client._options.timeout??6e5,...t,headers:{...a?.toString()!=null?{"anthropic-beta":a?.toString()}:void 0,...t?.headers},stream:e.stream??!1})}countTokens(e,t){let{betas:a,...s}=e;return this._client.post("/v1/messages/count_tokens?beta=true",{body:s,...t,headers:{"anthropic-beta":[...a??[],"token-counting-2024-11-01"].toString(),...t?.headers}})}};Ht.Batches=ha;Ht.BetaMessageBatchesPage=qa});var p0,Wa,l0,c0,xo,vr=f(()=>{p0=n=>{let e=0,t=[];for(;e<n.length;){let a=n[e];if(a==="\\"){e++;continue}if(a==="{"){t.push({type:"brace",value:"{"}),e++;continue}if(a==="}"){t.push({type:"brace",value:"}"}),e++;continue}if(a==="["){t.push({type:"paren",value:"["}),e++;continue}if(a==="]"){t.push({type:"paren",value:"]"}),e++;continue}if(a===":"){t.push({type:"separator",value:":"}),e++;continue}if(a===","){t.push({type:"delimiter",value:","}),e++;continue}if(a==='"'){let r="",d=!1;for(a=n[++e];a!=='"';){if(e===n.length){d=!0;break}if(a==="\\"){if(e++,e===n.length){d=!0;break}r+=a+n[e],a=n[++e]}else r+=a,a=n[++e]}a=n[++e],d||t.push({type:"string",value:r});continue}if(a&&/\s/.test(a)){e++;continue}let o=/[0-9]/;if(a&&o.test(a)||a==="-"||a==="."){let r="";for(a==="-"&&(r+=a,a=n[++e]);a&&o.test(a)||a===".";)r+=a,a=n[++e];t.push({type:"number",value:r});continue}let i=/[a-z]/i;if(a&&i.test(a)){let r="";for(;a&&i.test(a)&&e!==n.length;)r+=a,a=n[++e];if(r=="true"||r=="false"||r==="null")t.push({type:"name",value:r});else{e++;continue}continue}e++}return t},Wa=n=>{if(n.length===0)return n;let e=n[n.length-1];switch(e.type){case"separator":return n=n.slice(0,n.length-1),Wa(n);break;case"number":let t=e.value[e.value.length-1];if(t==="."||t==="-")return n=n.slice(0,n.length-1),Wa(n);case"string":let a=n[n.length-2];if(a?.type==="delimiter")return n=n.slice(0,n.length-1),Wa(n);if(a?.type==="brace"&&a.value==="{")return n=n.slice(0,n.length-1),Wa(n);break;case"delimiter":return n=n.slice(0,n.length-1),Wa(n);break}return n},l0=n=>{let e=[];return n.map(t=>{t.type==="brace"&&(t.value==="{"?e.push("}"):e.splice(e.lastIndexOf("}"),1)),t.type==="paren"&&(t.value==="["?e.push("]"):e.splice(e.lastIndexOf("]"),1))}),e.length>0&&e.reverse().map(t=>{t==="}"?n.push({type:"brace",value:"}"}):t==="]"&&n.push({type:"paren",value:"]"})}),n},c0=n=>{let e="";return n.map(t=>{t.type==="string"?e+='"'+t.value+'"':e+=t.value}),e},xo=n=>JSON.parse(c0(l0(Wa(p0(n)))))});var Te,B,Le,Gt,ko,So,Jn,Zn,_o,Qn,_t,es,Co,Po,Ha,br,K1,yr,wr,xr,kr,J1,Z1,To,Q1=f(()=>{ot();Gn();vr();Te=function(n,e,t,a,s){if(a==="m")throw new TypeError("Private method is not writable");if(a==="a"&&!s)throw new TypeError("Private accessor was defined without a setter");if(typeof e=="function"?n!==e||!s:!e.has(n))throw new TypeError("Cannot write private member to an object whose class did not declare it");return a==="a"?s.call(n,t):s?s.value=t:e.set(n,t),t},B=function(n,e,t,a){if(t==="a"&&!a)throw new TypeError("Private accessor was defined without a getter");if(typeof e=="function"?n!==e||!a:!e.has(n))throw new TypeError("Cannot read private member from an object whose class did not declare it");return t==="m"?a:t==="a"?a.call(n):a?a.value:e.get(n)},Z1="__json_buf",To=class n{constructor(){Le.add(this),this.messages=[],this.receivedMessages=[],Gt.set(this,void 0),this.controller=new AbortController,ko.set(this,void 0),So.set(this,()=>{}),Jn.set(this,()=>{}),Zn.set(this,void 0),_o.set(this,()=>{}),Qn.set(this,()=>{}),_t.set(this,{}),es.set(this,!1),Co.set(this,!1),Po.set(this,!1),Ha.set(this,!1),yr.set(this,e=>{if(Te(this,Co,!0,"f"),e instanceof Error&&e.name==="AbortError"&&(e=new fe),e instanceof fe)return Te(this,Po,!0,"f"),this._emit("abort",e);if(e instanceof N)return this._emit("error",e);if(e instanceof Error){let t=new N(e.message);return t.cause=e,this._emit("error",t)}return this._emit("error",new N(String(e)))}),Te(this,ko,new Promise((e,t)=>{Te(this,So,e,"f"),Te(this,Jn,t,"f")}),"f"),Te(this,Zn,new Promise((e,t)=>{Te(this,_o,e,"f"),Te(this,Qn,t,"f")}),"f"),B(this,ko,"f").catch(()=>{}),B(this,Zn,"f").catch(()=>{})}static fromReadableStream(e){let t=new n;return t._run(()=>t._fromReadableStream(e)),t}static createMessage(e,t,a){let s=new n;for(let o of t.messages)s._addPromptCachingBetaMessageParam(o);return s._run(()=>s._createPromptCachingBetaMessage(e,{...t,stream:!0},{...a,headers:{...a?.headers,"X-Stainless-Helper-Method":"stream"}})),s}_run(e){e().then(()=>{this._emitFinal(),this._emit("end")},B(this,yr,"f"))}_addPromptCachingBetaMessageParam(e){this.messages.push(e)}_addPromptCachingBetaMessage(e,t=!0){this.receivedMessages.push(e),t&&this._emit("message",e)}async _createPromptCachingBetaMessage(e,t,a){let s=a?.signal;s&&(s.aborted&&this.controller.abort(),s.addEventListener("abort",()=>this.controller.abort())),B(this,Le,"m",wr).call(this);let o=await e.create({...t,stream:!0},{...a,signal:this.controller.signal});this._connected();for await(let i of o)B(this,Le,"m",xr).call(this,i);if(o.controller.signal?.aborted)throw new fe;B(this,Le,"m",kr).call(this)}_connected(){this.ended||(B(this,So,"f").call(this),this._emit("connect"))}get ended(){return B(this,es,"f")}get errored(){return B(this,Co,"f")}get aborted(){return B(this,Po,"f")}abort(){this.controller.abort()}on(e,t){return(B(this,_t,"f")[e]||(B(this,_t,"f")[e]=[])).push({listener:t}),this}off(e,t){let a=B(this,_t,"f")[e];if(!a)return this;let s=a.findIndex(o=>o.listener===t);return s>=0&&a.splice(s,1),this}once(e,t){return(B(this,_t,"f")[e]||(B(this,_t,"f")[e]=[])).push({listener:t,once:!0}),this}emitted(e){return new Promise((t,a)=>{Te(this,Ha,!0,"f"),e!=="error"&&this.once("error",a),this.once(e,t)})}async done(){Te(this,Ha,!0,"f"),await B(this,Zn,"f")}get currentMessage(){return B(this,Gt,"f")}async finalMessage(){return await this.done(),B(this,Le,"m",br).call(this)}async finalText(){return await this.done(),B(this,Le,"m",K1).call(this)}_emit(e,...t){if(B(this,es,"f"))return;e==="end"&&(Te(this,es,!0,"f"),B(this,_o,"f").call(this));let a=B(this,_t,"f")[e];if(a&&(B(this,_t,"f")[e]=a.filter(s=>!s.once),a.forEach(({listener:s})=>s(...t))),e==="abort"){let s=t[0];!B(this,Ha,"f")&&!a?.length&&Promise.reject(s),B(this,Jn,"f").call(this,s),B(this,Qn,"f").call(this,s),this._emit("end");return}if(e==="error"){let s=t[0];!B(this,Ha,"f")&&!a?.length&&Promise.reject(s),B(this,Jn,"f").call(this,s),B(this,Qn,"f").call(this,s),this._emit("end")}}_emitFinal(){this.receivedMessages.at(-1)&&this._emit("finalPromptCachingBetaMessage",B(this,Le,"m",br).call(this))}async _fromReadableStream(e,t){let a=t?.signal;a&&(a.aborted&&this.controller.abort(),a.addEventListener("abort",()=>this.controller.abort())),B(this,Le,"m",wr).call(this),this._connected();let s=it.fromReadableStream(e,this.controller);for await(let o of s)B(this,Le,"m",xr).call(this,o);if(s.controller.signal?.aborted)throw new fe;B(this,Le,"m",kr).call(this)}[(Gt=new WeakMap,ko=new WeakMap,So=new WeakMap,Jn=new WeakMap,Zn=new WeakMap,_o=new WeakMap,Qn=new WeakMap,_t=new WeakMap,es=new WeakMap,Co=new WeakMap,Po=new WeakMap,Ha=new WeakMap,yr=new WeakMap,Le=new WeakSet,br=function(){if(this.receivedMessages.length===0)throw new N("stream ended without producing a PromptCachingBetaMessage with role=assistant");return this.receivedMessages.at(-1)},K1=function(){if(this.receivedMessages.length===0)throw new N("stream ended without producing a PromptCachingBetaMessage with role=assistant");let t=this.receivedMessages.at(-1).content.filter(a=>a.type==="text").map(a=>a.text);if(t.length===0)throw new N("stream ended without producing a content block with type=text");return t.join(" ")},wr=function(){this.ended||Te(this,Gt,void 0,"f")},xr=function(t){if(this.ended)return;let a=B(this,Le,"m",J1).call(this,t);switch(this._emit("streamEvent",t,a),t.type){case"content_block_delta":{let s=a.content.at(-1);t.delta.type==="text_delta"&&s.type==="text"?this._emit("text",t.delta.text,s.text||""):t.delta.type==="input_json_delta"&&s.type==="tool_use"&&s.input&&this._emit("inputJson",t.delta.partial_json,s.input);break}case"message_stop":{this._addPromptCachingBetaMessageParam(a),this._addPromptCachingBetaMessage(a,!0);break}case"content_block_stop":{this._emit("contentBlock",a.content.at(-1));break}case"message_start":{Te(this,Gt,a,"f");break}case"content_block_start":case"message_delta":break}},kr=function(){if(this.ended)throw new N("stream has ended, this shouldn't happen");let t=B(this,Gt,"f");if(!t)throw new N("request ended without sending any chunks");return Te(this,Gt,void 0,"f"),t},J1=function(t){let a=B(this,Gt,"f");if(t.type==="message_start"){if(a)throw new N(`Unexpected event order, got ${t.type} before receiving "message_stop"`);return t.message}if(!a)throw new N(`Unexpected event order, got ${t.type} before "message_start"`);switch(t.type){case"message_stop":return a;case"message_delta":return a.stop_reason=t.delta.stop_reason,a.stop_sequence=t.delta.stop_sequence,a.usage.output_tokens=t.usage.output_tokens,a;case"content_block_start":return a.content.push(t.content_block),a;case"content_block_delta":{let s=a.content.at(t.index);if(s?.type==="text"&&t.delta.type==="text_delta")s.text+=t.delta.text;else if(s?.type==="tool_use"&&t.delta.type==="input_json_delta"){let o=s[Z1]||"";o+=t.delta.partial_json,Object.defineProperty(s,Z1,{value:o,enumerable:!1,writable:!0}),o&&(s.input=xo(o))}return a}case"content_block_stop":return a}},Symbol.asyncIterator)](){let e=[],t=[],a=!1;return this.on("streamEvent",s=>{let o=t.shift();o?o.resolve(s):e.push(s)}),this.on("end",()=>{a=!0;for(let s of t)s.resolve(void 0);t.length=0}),this.on("abort",s=>{a=!0;for(let o of t)o.reject(s);t.length=0}),this.on("error",s=>{a=!0;for(let o of t)o.reject(s);t.length=0}),{next:async()=>e.length?{value:e.shift(),done:!1}:a?{value:void 0,done:!0}:new Promise((o,i)=>t.push({resolve:o,reject:i})).then(o=>o?{value:o,done:!1}:{value:void 0,done:!0}),return:async()=>(this.abort(),{value:void 0,done:!0})}}toReadableStream(){return new it(this[Symbol.asyncIterator].bind(this),this.controller).toReadableStream()}}});var Ga,Sr=f(()=>{Wt();Q1();Ga=class extends ye{create(e,t){let{betas:a,...s}=e;return this._client.post("/v1/messages?beta=prompt_caching",{body:s,timeout:this._client._options.timeout??6e5,...t,headers:{"anthropic-beta":[...a??[],"prompt-caching-2024-07-31"].toString(),...t?.headers},stream:e.stream??!1})}stream(e,t){return To.createMessage(this,e,t)}}});var fa,_r=f(()=>{Wt();Sr();Sr();fa=class extends ye{constructor(){super(...arguments),this.messages=new Ga(this._client)}};fa.Messages=Ga});var Ct,Cr=f(()=>{Wt();fr();fr();_r();_r();Ct=class extends ye{constructor(){super(...arguments),this.messages=new Ht(this._client),this.promptCaching=new fa(this._client)}};Ct.Messages=Ht;Ct.PromptCaching=fa});var va,Pr=f(()=>{Wt();va=class extends ye{create(e,t){return this._client.post("/v1/complete",{body:e,timeout:this._client._options.timeout??6e5,...t,stream:e.stream??!1})}}});var Ee,D,$e,Yt,Eo,No,ts,as,Ao,ns,Pt,ss,Io,Mo,Ya,Tr,ec,Er,Nr,Ar,Ir,tc,ac,Bo,nc=f(()=>{ot();Gn();vr();Ee=function(n,e,t,a,s){if(a==="m")throw new TypeError("Private method is not writable");if(a==="a"&&!s)throw new TypeError("Private accessor was defined without a setter");if(typeof e=="function"?n!==e||!s:!e.has(n))throw new TypeError("Cannot write private member to an object whose class did not declare it");return a==="a"?s.call(n,t):s?s.value=t:e.set(n,t),t},D=function(n,e,t,a){if(t==="a"&&!a)throw new TypeError("Private accessor was defined without a getter");if(typeof e=="function"?n!==e||!a:!e.has(n))throw new TypeError("Cannot read private member from an object whose class did not declare it");return t==="m"?a:t==="a"?a.call(n):a?a.value:e.get(n)},ac="__json_buf",Bo=class n{constructor(){$e.add(this),this.messages=[],this.receivedMessages=[],Yt.set(this,void 0),this.controller=new AbortController,Eo.set(this,void 0),No.set(this,()=>{}),ts.set(this,()=>{}),as.set(this,void 0),Ao.set(this,()=>{}),ns.set(this,()=>{}),Pt.set(this,{}),ss.set(this,!1),Io.set(this,!1),Mo.set(this,!1),Ya.set(this,!1),Er.set(this,e=>{if(Ee(this,Io,!0,"f"),e instanceof Error&&e.name==="AbortError"&&(e=new fe),e instanceof fe)return Ee(this,Mo,!0,"f"),this._emit("abort",e);if(e instanceof N)return this._emit("error",e);if(e instanceof Error){let t=new N(e.message);return t.cause=e,this._emit("error",t)}return this._emit("error",new N(String(e)))}),Ee(this,Eo,new Promise((e,t)=>{Ee(this,No,e,"f"),Ee(this,ts,t,"f")}),"f"),Ee(this,as,new Promise((e,t)=>{Ee(this,Ao,e,"f"),Ee(this,ns,t,"f")}),"f"),D(this,Eo,"f").catch(()=>{}),D(this,as,"f").catch(()=>{})}static fromReadableStream(e){let t=new n;return t._run(()=>t._fromReadableStream(e)),t}static createMessage(e,t,a){let s=new n;for(let o of t.messages)s._addMessageParam(o);return s._run(()=>s._createMessage(e,{...t,stream:!0},{...a,headers:{...a?.headers,"X-Stainless-Helper-Method":"stream"}})),s}_run(e){e().then(()=>{this._emitFinal(),this._emit("end")},D(this,Er,"f"))}_addMessageParam(e){this.messages.push(e)}_addMessage(e,t=!0){this.receivedMessages.push(e),t&&this._emit("message",e)}async _createMessage(e,t,a){let s=a?.signal;s&&(s.aborted&&this.controller.abort(),s.addEventListener("abort",()=>this.controller.abort())),D(this,$e,"m",Nr).call(this);let o=await e.create({...t,stream:!0},{...a,signal:this.controller.signal});this._connected();for await(let i of o)D(this,$e,"m",Ar).call(this,i);if(o.controller.signal?.aborted)throw new fe;D(this,$e,"m",Ir).call(this)}_connected(){this.ended||(D(this,No,"f").call(this),this._emit("connect"))}get ended(){return D(this,ss,"f")}get errored(){return D(this,Io,"f")}get aborted(){return D(this,Mo,"f")}abort(){this.controller.abort()}on(e,t){return(D(this,Pt,"f")[e]||(D(this,Pt,"f")[e]=[])).push({listener:t}),this}off(e,t){let a=D(this,Pt,"f")[e];if(!a)return this;let s=a.findIndex(o=>o.listener===t);return s>=0&&a.splice(s,1),this}once(e,t){return(D(this,Pt,"f")[e]||(D(this,Pt,"f")[e]=[])).push({listener:t,once:!0}),this}emitted(e){return new Promise((t,a)=>{Ee(this,Ya,!0,"f"),e!=="error"&&this.once("error",a),this.once(e,t)})}async done(){Ee(this,Ya,!0,"f"),await D(this,as,"f")}get currentMessage(){return D(this,Yt,"f")}async finalMessage(){return await this.done(),D(this,$e,"m",Tr).call(this)}async finalText(){return await this.done(),D(this,$e,"m",ec).call(this)}_emit(e,...t){if(D(this,ss,"f"))return;e==="end"&&(Ee(this,ss,!0,"f"),D(this,Ao,"f").call(this));let a=D(this,Pt,"f")[e];if(a&&(D(this,Pt,"f")[e]=a.filter(s=>!s.once),a.forEach(({listener:s})=>s(...t))),e==="abort"){let s=t[0];!D(this,Ya,"f")&&!a?.length&&Promise.reject(s),D(this,ts,"f").call(this,s),D(this,ns,"f").call(this,s),this._emit("end");return}if(e==="error"){let s=t[0];!D(this,Ya,"f")&&!a?.length&&Promise.reject(s),D(this,ts,"f").call(this,s),D(this,ns,"f").call(this,s),this._emit("end")}}_emitFinal(){this.receivedMessages.at(-1)&&this._emit("finalMessage",D(this,$e,"m",Tr).call(this))}async _fromReadableStream(e,t){let a=t?.signal;a&&(a.aborted&&this.controller.abort(),a.addEventListener("abort",()=>this.controller.abort())),D(this,$e,"m",Nr).call(this),this._connected();let s=it.fromReadableStream(e,this.controller);for await(let o of s)D(this,$e,"m",Ar).call(this,o);if(s.controller.signal?.aborted)throw new fe;D(this,$e,"m",Ir).call(this)}[(Yt=new WeakMap,Eo=new WeakMap,No=new WeakMap,ts=new WeakMap,as=new WeakMap,Ao=new WeakMap,ns=new WeakMap,Pt=new WeakMap,ss=new WeakMap,Io=new WeakMap,Mo=new WeakMap,Ya=new WeakMap,Er=new WeakMap,$e=new WeakSet,Tr=function(){if(this.receivedMessages.length===0)throw new N("stream ended without producing a Message with role=assistant");return this.receivedMessages.at(-1)},ec=function(){if(this.receivedMessages.length===0)throw new N("stream ended without producing a Message with role=assistant");let t=this.receivedMessages.at(-1).content.filter(a=>a.type==="text").map(a=>a.text);if(t.length===0)throw new N("stream ended without producing a content block with type=text");return t.join(" ")},Nr=function(){this.ended||Ee(this,Yt,void 0,"f")},Ar=function(t){if(this.ended)return;let a=D(this,$e,"m",tc).call(this,t);switch(this._emit("streamEvent",t,a),t.type){case"content_block_delta":{let s=a.content.at(-1);t.delta.type==="text_delta"&&s.type==="text"?this._emit("text",t.delta.text,s.text||""):t.delta.type==="input_json_delta"&&s.type==="tool_use"&&s.input&&this._emit("inputJson",t.delta.partial_json,s.input);break}case"message_stop":{this._addMessageParam(a),this._addMessage(a,!0);break}case"content_block_stop":{this._emit("contentBlock",a.content.at(-1));break}case"message_start":{Ee(this,Yt,a,"f");break}case"content_block_start":case"message_delta":break}},Ir=function(){if(this.ended)throw new N("stream has ended, this shouldn't happen");let t=D(this,Yt,"f");if(!t)throw new N("request ended without sending any chunks");return Ee(this,Yt,void 0,"f"),t},tc=function(t){let a=D(this,Yt,"f");if(t.type==="message_start"){if(a)throw new N(`Unexpected event order, got ${t.type} before receiving "message_stop"`);return t.message}if(!a)throw new N(`Unexpected event order, got ${t.type} before "message_start"`);switch(t.type){case"message_stop":return a;case"message_delta":return a.stop_reason=t.delta.stop_reason,a.stop_sequence=t.delta.stop_sequence,a.usage.output_tokens=t.usage.output_tokens,a;case"content_block_start":return a.content.push(t.content_block),a;case"content_block_delta":{let s=a.content.at(t.index);if(s?.type==="text"&&t.delta.type==="text_delta")s.text+=t.delta.text;else if(s?.type==="tool_use"&&t.delta.type==="input_json_delta"){let o=s[ac]||"";o+=t.delta.partial_json,Object.defineProperty(s,ac,{value:o,enumerable:!1,writable:!0}),o&&(s.input=xo(o))}return a}case"content_block_stop":return a}},Symbol.asyncIterator)](){let e=[],t=[],a=!1;return this.on("streamEvent",s=>{let o=t.shift();o?o.resolve(s):e.push(s)}),this.on("end",()=>{a=!0;for(let s of t)s.resolve(void 0);t.length=0}),this.on("abort",s=>{a=!0;for(let o of t)o.reject(s);t.length=0}),this.on("error",s=>{a=!0;for(let o of t)o.reject(s);t.length=0}),{next:async()=>e.length?{value:e.shift(),done:!1}:a?{value:void 0,done:!0}:new Promise((o,i)=>t.push({resolve:o,reject:i})).then(o=>o?{value:o,done:!1}:{value:void 0,done:!0}),return:async()=>(this.abort(),{value:void 0,done:!0})}}toReadableStream(){return new it(this[Symbol.asyncIterator].bind(this),this.controller).toReadableStream()}}});var ba,sc,Mr=f(()=>{Wt();nc();ba=class extends ye{create(e,t){return e.model in sc&&console.warn(`The model '${e.model}' is deprecated and will reach end-of-life on ${sc[e.model]}
Please migrate to a newer model. Visit https://docs.anthropic.com/en/docs/resources/model-deprecations for more information.`),this._client.post("/v1/messages",{body:e,timeout:this._client._options.timeout??6e5,...t,stream:e.stream??!1})}stream(e,t){return Bo.createMessage(this,e,t)}},sc={"claude-1.3":"November 6th, 2024","claude-1.3-100k":"November 6th, 2024","claude-instant-1.1":"November 6th, 2024","claude-instant-1.1-100k":"November 6th, 2024","claude-instant-1.2":"November 6th, 2024"}});var oc=f(()=>{Cr();Pr();Mr()});var ic,Y,Q6,e4,rc,dc=f(()=>{Va();ot();mr();oc();Pr();Mr();Cr();Y=class extends fo{constructor({baseURL:e=bo("ANTHROPIC_BASE_URL"),apiKey:t=bo("ANTHROPIC_API_KEY")??null,authToken:a=bo("ANTHROPIC_AUTH_TOKEN")??null,...s}={}){let o={apiKey:t,authToken:a,...s,baseURL:e||"https://api.anthropic.com"};if(!o.dangerouslyAllowBrowser&&G1())throw new N(`It looks like you're running in a browser-like environment.

This is disabled by default, as it risks exposing your secret API credentials to attackers.
If you understand the risks and have appropriate mitigations in place,
you can set the \`dangerouslyAllowBrowser\` option to \`true\`, e.g.,

new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

TODO: link!
`);super({baseURL:o.baseURL,timeout:o.timeout??6e5,httpAgent:o.httpAgent,maxRetries:o.maxRetries,fetch:o.fetch}),this.completions=new va(this),this.messages=new ba(this),this.beta=new Ct(this),this._options=o,this.apiKey=t,this.authToken=a}defaultQuery(){return this._options.defaultQuery}defaultHeaders(e){return{...super.defaultHeaders(e),...this._options.dangerouslyAllowBrowser?{"anthropic-dangerous-direct-browser-access":"true"}:void 0,"anthropic-version":"2023-06-01",...this._options.defaultHeaders}}validateHeaders(e,t){if(!(this.apiKey&&e["x-api-key"])&&t["x-api-key"]!==null&&!(this.authToken&&e.authorization)&&t.authorization!==null)throw new Error('Could not resolve authentication method. Expected either apiKey or authToken to be set. Or for one of the "X-Api-Key" or "Authorization" headers to be explicitly omitted')}authHeaders(e){let t=this.apiKeyAuth(e),a=this.bearerAuth(e);return t!=null&&!Kn(t)?t:a!=null&&!Kn(a)?a:{}}apiKeyAuth(e){return this.apiKey==null?{}:{"X-Api-Key":this.apiKey}}bearerAuth(e){return this.authToken==null?{}:{Authorization:`Bearer ${this.authToken}`}}};ic=Y;Y.Anthropic=ic;Y.HUMAN_PROMPT=`

Human:`;Y.AI_PROMPT=`

Assistant:`;Y.DEFAULT_TIMEOUT=6e5;Y.AnthropicError=N;Y.APIError=ce;Y.APIConnectionError=qt;Y.APIConnectionTimeoutError=za;Y.APIUserAbortError=fe;Y.NotFoundError=Vn;Y.ConflictError=Un;Y.RateLimitError=Wn;Y.BadRequestError=On;Y.AuthenticationError=jn;Y.InternalServerError=Hn;Y.PermissionDeniedError=zn;Y.UnprocessableEntityError=qn;Y.toFile=O1;Y.fileFromPath=us;({HUMAN_PROMPT:Q6,AI_PROMPT:e4}=Y);Y.Completions=va;Y.Messages=ba;Y.Beta=Ct;rc=Y});var pc={};At(pc,{CodeBakersClient:()=>Br});var J,Br,lc=f(()=>{"use strict";J=L(require("vscode"));dc();qo();Br=class{constructor(e){this.context=e;this.anthropic=null;this.sessionToken=null;this.patterns=new Map;this.DEFAULT_TIMEOUT=1e4;this.validatorInitialized=!1;this.sessionStats={totalInputTokens:0,totalOutputTokens:0,totalCost:0,requestCount:0,startTime:new Date};this.currentEnforcementSession=null;this.PRICE_PER_1K_INPUT=.003;this.PRICE_PER_1K_OUTPUT=.015;this.currentPlan="trial";this.isUnlimited=!1;this.trialInfo=null;this.validator=new xa,this.sessionToken=e.globalState.get("codebakers.sessionToken")||null,this.sessionToken&&this.sessionToken.includes("%")&&(console.log("CodeBakers: Clearing corrupted URL-encoded token"),this.sessionToken=null,e.globalState.update("codebakers.sessionToken",void 0))}async logout(){this.sessionToken=null,this.anthropic=null,await this.context.globalState.update("codebakers.sessionToken",void 0),await this.context.globalState.update("codebakers.user",void 0),J.window.showInformationMessage("Logged out of CodeBakers")}getSessionStats(){let t=new Date().getTime()-this.sessionStats.startTime.getTime(),a=Math.floor(t/6e4),s=Math.floor(a/60);return{...this.sessionStats,formattedCost:`$${this.sessionStats.totalCost.toFixed(4)}`,formattedDuration:s>0?`${s}h ${a%60}m`:`${a}m`}}resetSessionStats(){this.sessionStats={totalInputTokens:0,totalOutputTokens:0,totalCost:0,requestCount:0,startTime:new Date}}_calculateCost(e,t){let a=e/1e3*this.PRICE_PER_1K_INPUT,s=t/1e3*this.PRICE_PER_1K_OUTPUT;return a+s}async _fetchWithTimeout(e,t={},a=this.DEFAULT_TIMEOUT){let s=new AbortController,o=setTimeout(()=>s.abort(),a);try{return await fetch(e,{...t,signal:s.signal})}finally{clearTimeout(o)}}hasSessionToken(){return!!this.sessionToken}async handleOAuthCallback(e){try{if(console.log("handleOAuthCallback: token length:",e?.length),console.log("handleOAuthCallback: token preview:",e?.substring(0,50)),!e)return J.window.showErrorMessage("Login failed: No token received"),!1;let t=e;e.includes("%")&&(t=decodeURIComponent(e),console.log("handleOAuthCallback: URL-decoded token"));let a;try{a=Buffer.from(t,"base64url").toString("utf-8")}catch{let i=t.replace(/-/g,"+").replace(/_/g,"/");a=Buffer.from(i,"base64").toString("utf-8")}console.log("handleOAuthCallback: decoded preview:",a?.substring(0,100));let s=JSON.parse(a),o=e.includes("%")?decodeURIComponent(e):e;return this.sessionToken=o,await this.context.globalState.update("codebakers.sessionToken",o),this.currentPlan=s.plan,this.trialInfo=s.trial,this.isUnlimited=s.plan==="pro",await this.context.globalState.update("codebakers.user",{teamId:s.teamId,profileId:s.profileId,githubUsername:s.githubUsername,email:s.email}),await this._initializeAnthropic(),J.window.showInformationMessage(`Welcome to CodeBakers, @${s.githubUsername}! ${s.trial?`Trial: ${s.trial.daysRemaining} days remaining`:""}`),!0}catch(t){return console.error("Failed to handle OAuth callback:",t),console.error("Token was:",e?.substring(0,100)),J.window.showErrorMessage(`Login failed: ${t instanceof Error?t.message:"Invalid token"}`),!1}}async checkAuth(){if(!this.sessionToken)return!1;try{let e=`${this._getApiEndpoint()}/api/auth/check?token=${encodeURIComponent(this.sessionToken)}`;return(await this._fetchWithTimeout(e,{headers:{Authorization:`Bearer ${this.sessionToken}`}},5e3)).ok}catch{return!1}}async login(){try{console.log("CodeBakers: login() called");let e=J.env.uriScheme;console.log("CodeBakers: uriScheme =",e);let t=J.Uri.parse(`${e}://codebakers.codebakers/callback`);console.log("CodeBakers: rawCallbackUri =",t.toString());let a=await J.env.asExternalUri(t);console.log("CodeBakers: callbackUri =",a.toString());let s=this._getApiEndpoint();console.log("CodeBakers: apiEndpoint =",s);let o=`${s}/vscode-login?callback=${encodeURIComponent(a.toString())}`;return console.log("CodeBakers: loginUrl =",o),await J.env.openExternal(J.Uri.parse(o)),console.log("CodeBakers: openExternal called successfully"),!0}catch(e){throw console.error("CodeBakers: login() error:",e),e}}async _initializeAnthropic(){try{if(console.log("_initializeAnthropic: sessionToken exists:",!!this.sessionToken),console.log("_initializeAnthropic: sessionToken length:",this.sessionToken?.length),console.log("_initializeAnthropic: sessionToken preview:",this.sessionToken?.substring(0,50)),console.log("_initializeAnthropic: contains %:",this.sessionToken?.includes("%")),this.sessionToken)try{let c=Buffer.from(this.sessionToken,"base64url").toString("utf-8"),m=JSON.parse(c);console.log("_initializeAnthropic: token decoded successfully, teamId:",m.teamId)}catch(c){console.error("_initializeAnthropic: FAILED to decode token locally:",c)}let e=`Bearer ${this.sessionToken}`;console.log("_initializeAnthropic: authHeader length:",e.length),console.log("_initializeAnthropic: authHeader preview:",e.substring(0,60));let t={method:"GET",headers:{Authorization:e,"Content-Type":"application/json"}};console.log("_initializeAnthropic: fetchOptions.headers:",JSON.stringify(t.headers));let a=`${this._getApiEndpoint()}/api/claude/key?token=${encodeURIComponent(this.sessionToken||"")}`;console.log("_initializeAnthropic: fetching:",a.substring(0,80)+"...");let s=await this._fetchWithTimeout(a,t),o=await s.json(),i=o.data||o;if(console.log("Claude key response:",s.status,JSON.stringify(i)),s.status===402){let c=await J.window.showWarningMessage(o.message||"Subscribe to CodeBakers Pro ($99/month) for unlimited access","Subscribe Now","Start Free Trial");throw c==="Subscribe Now"?J.env.openExternal(J.Uri.parse(o.upgradeUrl||"https://www.codebakers.ai/dashboard/billing")):c==="Start Free Trial"&&J.env.openExternal(J.Uri.parse(o.trialUrl||"https://www.codebakers.ai/dashboard/billing")),new Error("SUBSCRIPTION_REQUIRED")}if(!s.ok){console.error("API error response:",JSON.stringify(o));let c=this.sessionToken?`token len=${this.sessionToken.length}, starts=${this.sessionToken.substring(0,10)}`:"NO TOKEN";throw new Error(`API ${s.status}: ${o.error||o.message||"Unknown"} [${c}]`)}if(!i.apiKey)throw new Error(`No API key in response: ${JSON.stringify(i)}`);let{apiKey:r,plan:d,unlimited:p,trial:l}=i;this.currentPlan=d||"trial",this.isUnlimited=p||!1,this.trialInfo=l||null,l&&l.daysRemaining<=3&&J.window.showWarningMessage(`Your CodeBakers trial expires in ${l.daysRemaining} day${l.daysRemaining===1?"":"s"}. Subscribe to keep using the extension.`,"Subscribe Now").then(c=>{c==="Subscribe Now"&&J.env.openExternal(J.Uri.parse("https://www.codebakers.ai/dashboard/billing"))}),this.anthropic=new rc({apiKey:r}),await this._loadPatterns()}catch(e){throw console.error("Failed to initialize Anthropic client:",e),e}}getPlanInfo(){return{plan:this.currentPlan,unlimited:this.isUnlimited,trial:this.trialInfo}}async _loadPatterns(){try{let e=`${this._getApiEndpoint()}/api/patterns/list?token=${encodeURIComponent(this.sessionToken||"")}`,t=await this._fetchWithTimeout(e,{headers:{Authorization:`Bearer ${this.sessionToken}`}},15e3);if(t.ok){let a=await t.json();a.patterns&&a.patterns.forEach(s=>this.patterns.set(s.name,s))}}catch(e){console.error("Failed to load patterns:",e)}}async chat(e,t,a,s){let o=s?.maxRetries??3,i=s?.runTypeScriptCheck??!0;if(this.anthropic||await this._initializeAnthropic(),!this.anthropic)throw new Error("Not authenticated. Please login first.");let r=this._buildSystemPrompt(t),d=e[e.length-1]?.content||"",p=[];try{let y=this._extractKeywords(d),T=await this._callDiscoverPatterns(d,y);T&&T.sessionToken&&(this.currentEnforcementSession={token:T.sessionToken,patterns:T.patterns||[],expiresAt:T.expiresAt||new Date(Date.now()+36e5).toISOString()},p=T.patterns||[],console.log("CodeBakers: GATE 1 passed - enforcement session created:",T.sessionToken.substring(0,20)+"..."))}catch(y){console.warn("CodeBakers: Server pattern discovery failed, falling back to local patterns:",y),p=(await this._detectRelevantPatterns(e)).map(k=>({name:k.name,content:k.content,relevance:1}))}let l=p.length>0?p.map(y=>`## Pattern: ${y.name}
${y.content}`).join(`

`):(await this._detectRelevantPatterns(e)).map(y=>`## Pattern: ${y.name}
${y.content}`).join(`

`),c=e.filter(y=>y.role==="system"),m=e.filter(y=>y.role!=="system"),u=c.length>0?`

# CONTEXT
`+c.map(y=>y.content).join(`

`):"",g=this.currentEnforcementSession?`

# ENFORCEMENT
You are in an enforced session. Follow the loaded patterns exactly. Your code will be validated against these patterns before being applied.`:"",x=`${r}

# LOADED PATTERNS
${l}${u}${g}`,v=null;for(let y=1;y<=o;y++)try{if(a?.abortSignal?.aborted)throw new Error("Request was cancelled");let T="",k=this.anthropic.messages.stream({model:"claude-sonnet-4-20250514",max_tokens:16e3,system:x,messages:m.map(H=>({role:H.role,content:H.content}))});a?.abortSignal&&a.abortSignal.addEventListener("abort",()=>{k.abort()}),k.on("text",H=>{if(a?.abortSignal?.aborted){k.abort();return}T+=H;let{thinking:Xe,content:Me}=this._parseThinkingAndContent(T);Xe&&a?.onThinking?.(Xe),a?.onContent?.(Me)});let F=await k.finalMessage(),q;if(F.usage){let H=F.usage.input_tokens,Xe=F.usage.output_tokens,Me=this._calculateCost(H,Xe);q={inputTokens:H,outputTokens:Xe,totalTokens:H+Xe,estimatedCost:Me},this.sessionStats.totalInputTokens+=H,this.sessionStats.totalOutputTokens+=Xe,this.sessionStats.totalCost+=Me,this.sessionStats.requestCount+=1}if(a?.abortSignal?.aborted)throw new Error("Request was cancelled");a?.onDone?.();let{thinking:ue,content:S}=this._parseThinkingAndContent(T),w=this.parseFileOperations(S),I=this.parseCommands(S),z=this.cleanContentForDisplay(S),ie=this._checkCompliance(T,ue,w,z),_,O,C;w.length>0&&(this.validatorInitialized||(await this.validator.initialize(),this.validatorInitialized=!0),O=this.validator.checkDependencies(w),_=await this.validator.validateFileOperations(w),i&&(C=await this.validator.runTypeScriptCheck(),_&&(_.tscResult=C)));let V=this._extractProjectUpdates(z),xe=w.length,ge=I.length,Et=p.map(H=>H.name).join(", ")||"core",Zr=!ie.passed,yc=_&&!_.passed,Qr=O&&O.missing.length>0,ed=C&&!C.passed,zo="\u2705";yc||ed?zo="\u274C":(Zr||Qr)&&(zo="\u26A0\uFE0F");let Ie=z;Qr&&O&&(Ie+=`

---
\u{1F4E6} **Missing Packages:**
\`\`\`bash
npm install `+O.missing.join(" ")+"\n```"),ed&&C&&(Ie+=`

---
\u{1F534} **TypeScript Errors (`+C.errorCount+`):**
`+C.errors.slice(0,5).map(H=>`- ${H.file}:${H.line} - ${H.message}`).join(`
`),C.errorCount>5&&(Ie+=`
  ...and ${C.errorCount-5} more`)),_&&(_.errors.length>0&&(Ie+=`

---
\u274C **Validation Errors:**
`+_.errors.map(H=>`- ${H.file}: ${H.message}`).join(`
`)),_.warnings.length>0&&(Ie+=`

---
\u26A0\uFE0F **Warnings:**
`+_.warnings.map(H=>`- ${H.file}: ${H.message}`).join(`
`)),_.suggestions.length>0&&(Ie+=`

---
\u{1F4A1} **Suggestions:**
`+_.suggestions.map(H=>`- ${H}`).join(`
`))),Zr&&(Ie+=`

---
\u26A0\uFE0F **Quality Warning:** `+ie.issues.join(", "));let wc=C?C.passed?"\u2705":"\u274C":"\u23ED\uFE0F",xc=q?` | Cost: $${q.estimatedCost.toFixed(4)}`:"",kc=q?` | Tokens: ${q.totalTokens.toLocaleString()}`:"";Ie+=`

---
\u{1F36A} **CodeBakers** `+zo+" | Files: "+xe+" | Commands: "+ge+" | TSC: "+wc+kc+xc+" | "+Et;let Nt=null;if(this.currentEnforcementSession&&w.length>0)try{let H=w.map(Me=>Me.path),Xe=w.filter(Me=>Me.path.includes(".test.")||Me.path.includes(".spec.")||Me.path.includes("/__tests__/")).map(Me=>Me.path);Nt=await this._callValidateComplete(this.currentEnforcementSession.token,d.substring(0,100),H,Xe,Xe.length>0,C?.passed??!0,C?.passed??!0),Nt&&(Nt.passed?(console.log("CodeBakers: GATE 2 passed - compliance score:",Nt.compliance.score),Ie+=` | Gate 2: \u2705 (${Nt.compliance.score}/100)`):(console.warn("CodeBakers: GATE 2 failed:",Nt.issues),Ie+=`

\u26A0\uFE0F **Gate 2 Issues:** ${Nt.issues.join(", ")}`,Ie+=" | Gate 2: \u274C")),this.currentEnforcementSession=null}catch(H){console.warn("CodeBakers: Gate 2 validation error:",H)}return{content:Ie,thinking:ue||void 0,fileOperations:w.length>0?w:void 0,commands:I.length>0?I:void 0,projectUpdates:V,validation:_,dependencyCheck:O,usage:q,gate2:Nt||void 0}}catch(T){if(v=T,console.error(`Claude API error (attempt ${y}/${o}):`,T),T.message==="Request was cancelled"||T.message?.includes("authenticated")||T.message?.includes("SUBSCRIPTION"))throw T;if(y<o){let k=Math.min(1e3*Math.pow(2,y-1),1e4);a?.onError?.(new Error(`Request failed, retrying in ${k/1e3}s...`)),await new Promise(F=>setTimeout(F,k))}}let h=v||new Error("Request failed after multiple retries");throw a?.onError?.(h),h}_parseThinkingAndContent(e){let t=e.match(/<thinking>([\s\S]*?)<\/thinking>/);if(t){let a=t[1].trim(),s=e.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g,"").trim();return{thinking:a,content:s}}return{thinking:null,content:e}}parseFileOperations(e){let t=[],a=/<file_operation>([\s\S]*?)<\/file_operation>/g,s;for(;(s=a.exec(e))!==null;){let o=s[1],i=o.match(/<action>(create|edit|delete)<\/action>/);if(!i)continue;let r=o.match(/<path>([^<]+)<\/path>/);if(!r)continue;let d=o.match(/<description>([^<]+)<\/description>/),p=o.match(/<content>([\s\S]*?)<\/content>/);t.push({action:i[1],path:r[1].trim(),description:d?d[1].trim():void 0,content:p?p[1].trim():void 0})}return t}parseCommands(e){let t=[],a=/<run_command>([\s\S]*?)<\/run_command>/g,s;for(;(s=a.exec(e))!==null;){let o=s[1],i=o.match(/<command>([^<]+)<\/command>/);if(!i)continue;let r=o.match(/<description>([^<]+)<\/description>/);t.push({command:i[1].trim(),description:r?r[1].trim():void 0})}return t}cleanContentForDisplay(e){return e.replace(/<file_operation>[\s\S]*?<\/file_operation>/g,"").replace(/<run_command>[\s\S]*?<\/run_command>/g,"").trim()}_checkCompliance(e,t,a,s){let o=[];!t&&s.length>200&&o.push("Missing reasoning (thinking block)");let i=/```[\s\S]*?```/.test(e),r=/\.(tsx?|jsx?|css|json|md)\b/.test(s);i&&r&&a.length===0&&o.push("Code in markdown instead of file_operation tags");for(let d of a)if(d.content){let p=(d.content.match(/:\s*any\b/g)||[]).length;p>2&&o.push(`Excessive 'any' types in ${d.path} (${p} found)`),d.content.includes("async ")&&!d.content.includes("try")&&!d.content.includes("catch")&&d.content.includes("await ")&&o.push(`Missing try/catch in ${d.path}`)}for(let d of a)d.path.includes("/api/")&&d.content&&!d.content.includes("catch")&&!d.content.includes("NextResponse.json")&&o.push(`API route ${d.path} may lack error handling`);return{passed:o.length===0,issues:o}}async summarize(e){if(!this.anthropic)throw new Error("Not authenticated");let t=await this.anthropic.messages.create({model:"claude-sonnet-4-20250514",max_tokens:1024,system:"You are a conversation summarizer. Create concise summaries that preserve key decisions, code changes, and context. Be specific about file names and technical decisions.",messages:[{role:"user",content:e}]});return t.content[0].type==="text"?t.content[0].text:""}async getAvailablePatterns(){return Array.from(this.patterns.values())}async executeTool(e,t={}){if(!this.sessionToken)throw new Error("Not authenticated. Please login first.");let a=J.workspace.workspaceFolders?.[0]?.uri.fsPath,s=`${this._getApiEndpoint()}/api/tools?token=${encodeURIComponent(this.sessionToken)}`,o=await this._fetchWithTimeout(s,{method:"POST",headers:{Authorization:`Bearer ${this.sessionToken}`,"Content-Type":"application/json"},body:JSON.stringify({tool:e,args:t,projectPath:a})},3e4);if(!o.ok){let i=await o.json();throw new Error(i.message||`Tool execution failed: ${e}`)}return o.json()}async listTools(){if(!this.sessionToken)return[];let e=`${this._getApiEndpoint()}/api/tools?token=${encodeURIComponent(this.sessionToken)}`,t=await this._fetchWithTimeout(e,{headers:{Authorization:`Bearer ${this.sessionToken}`}});if(!t.ok)throw new Error("Failed to fetch tools");return(await t.json()).data?.tools||[]}async discoverPatterns(e,t=[]){return this.executeTool("discover_patterns",{task:e,keywords:t})}async validateComplete(e,t){return this.executeTool("validate_complete",{feature:e,files:t})}async guardianAnalyze(e){return this.executeTool("guardian_analyze",{files:e})}async guardianHeal(e){return this.executeTool("guardian_heal",{issues:e})}async guardianVerify(){return this.executeTool("guardian_verify",{})}async guardianStatus(){return this.executeTool("guardian_status",{})}async rippleCheck(e,t){return this.executeTool("ripple_check",{entityName:e,changeType:t})}async runAudit(){return this.executeTool("run_audit",{})}async runTests(){return this.executeTool("run_tests",{})}async detectIntent(e){return this.executeTool("detect_intent",{message:e})}_buildSystemPrompt(e){return`# CodeBakers AI Assistant
Version: 1.0.37

You are CodeBakers, an advanced AI coding assistant that can READ files, WRITE files, and RUN commands - just like Claude Code or Cursor.

## YOUR CAPABILITIES

You can:
1. **Read files** - Access any file in the workspace
2. **Write files** - Create new files or edit existing ones
3. **Run commands** - Execute terminal commands (npm, git, etc.)
4. **Apply patterns** - Use production-ready code patterns

## THINKING PROCESS (REQUIRED)

Before EVERY response, show your reasoning in <thinking> tags:

<thinking>
- Understanding: What is the user asking for?
- Analysis: What files exist? What needs to change?
- Plan: Step-by-step implementation approach
- Patterns: Which CodeBakers patterns apply?
- Risks: What could go wrong? Edge cases?
</thinking>

## FILE OPERATIONS FORMAT

When you need to create or edit files, use this EXACT format:

<file_operation>
<action>create</action>
<path>src/components/LoginForm.tsx</path>
<description>Create login form component with validation</description>
<content>
// File content here
import React from 'react';
// ... rest of code
</content>
</file_operation>

For editing existing files:
<file_operation>
<action>edit</action>
<path>src/app/page.tsx</path>
<description>Add login button to homepage</description>
<content>
// FULL new file content (not a diff)
</content>
</file_operation>

For deleting files:
<file_operation>
<action>delete</action>
<path>src/old-file.ts</path>
<description>Remove deprecated file</description>
</file_operation>

## COMMAND EXECUTION FORMAT

When you need to run terminal commands:

<run_command>
<command>npm install zod react-hook-form</command>
<description>Install form validation dependencies</description>
</run_command>

<run_command>
<command>npx prisma db push</command>
<description>Push schema changes to database</description>
</run_command>

## CODING STANDARDS

1. **TypeScript** - Always use TypeScript with proper types
2. **Error Handling** - Always wrap async operations in try/catch
3. **Validation** - Use Zod for input validation
4. **Loading States** - Always handle loading and error states
5. **Accessibility** - Include ARIA labels, keyboard navigation
6. **Security** - Never expose secrets, validate all inputs

## CODE QUALITY REQUIREMENTS

Every file you create/edit MUST have:
- Proper imports (no unused imports)
- Type annotations (no 'any' unless absolutely necessary)
- Error boundaries for React components
- Loading and error states for async operations
- Comments for complex logic only

## RESPONSE STRUCTURE

1. <thinking>...</thinking> - Your reasoning (REQUIRED)
2. Brief explanation of what you'll do
3. <file_operation>...</file_operation> blocks for each file
4. <run_command>...</run_command> blocks for commands
5. Summary of changes made
6. Footer with patterns used

## CURRENT PROJECT STATE
${e?JSON.stringify(e,null,2):"No workspace open - ask user to open a project folder"}

## PROJECT FILE STRUCTURE
${e?.fileTree?`
IMPORTANT: Use this structure to know WHERE to create files:
\`\`\`
${e.fileTree}
\`\`\`
- Create API routes in the existing api/ folder
- Create components in the existing components/ folder
- Follow the existing project structure - DO NOT create new top-level folders unless necessary
`:"No file tree available - ask user to open a project folder"}

## EXISTING TYPES (Reuse these - do NOT recreate)
${e?.existingTypes||"No existing types found - you may create new types as needed"}

## INSTALLED PACKAGES
${e?.installedPackages?.length>0?`
Available packages (already installed):
${e.installedPackages.slice(0,30).join(", ")}

IMPORTANT: Only import from packages listed above or Node.js built-ins.
If you need a package not listed, include a <run_command> to install it.
`:"No package.json found"}

## FOOTER (Required on every response with code)

---
\u{1F36A} **CodeBakers** | Files: [count] | Commands: [count] | Patterns: [list] | v1.0.40

## CRITICAL RULES (ENFORCED - NOT OPTIONAL)

These rules are STRUCTURALLY ENFORCED. The user PAID for this quality guarantee.

### MANDATORY THINKING BLOCK
You MUST start every response with <thinking>...</thinking> containing:
1. What patterns from LOADED PATTERNS section apply?
2. What existing code patterns should I match?
3. What could go wrong? (error cases, edge cases)

If your response lacks <thinking> tags, it is INVALID and will be rejected.

### MANDATORY PATTERN USAGE
Look at the "# LOADED PATTERNS" section below. You MUST:
1. Use code structures shown in the patterns
2. Use the same libraries (Zod, React Hook Form, etc.)
3. Match the error handling style
4. Include all required elements (loading states, validation, etc.)

If you write code that ignores the loaded patterns, you are FAILING your job.

### MANDATORY FILE OPERATION FORMAT
For ANY file change, you MUST use:
<file_operation>
<action>create|edit|delete</action>
<path>relative/path/to/file.ts</path>
<description>What this change does</description>
<content>COMPLETE file content - never partial</content>
</file_operation>

Code in regular markdown blocks will NOT be applied. Only <file_operation> blocks work.

### MANDATORY TEST REQUIREMENT
Every feature MUST include at least one test file. Do not ask "want me to add tests?" - just add them.

### MANDATORY FOOTER
End every code response with:
---
\u{1F36A} **CodeBakers** | Files: [count] | Commands: [count] | Patterns: [list] | v1.0.40

### NEVER DO THESE (Pattern Violations)
- \u274C Skip error handling (wrap async in try/catch)
- \u274C Use 'any' type (use proper types from patterns)
- \u274C Ignore loaded patterns (they exist for a reason)
- \u274C Create files without validation (use Zod)
- \u274C Skip loading states (always handle pending/error/success)
- \u274C Write code from memory when patterns exist

### SELF-CHECK BEFORE RESPONDING
Before sending, verify:
[ ] <thinking> block present?
[ ] Patterns from LOADED PATTERNS section used?
[ ] <file_operation> tags for all file changes?
[ ] Error handling included?
[ ] Loading states handled?
[ ] Footer included?

If any checkbox is NO, fix it before responding.
`}async _detectRelevantPatterns(e){let t=e[e.length-1]?.content?.toLowerCase()||"",a=[],s={"00-core":["any","code","build","create"],"01-database":["database","db","schema","table","query","drizzle","postgres"],"02-auth":["auth","login","signup","session","password","oauth"],"03-api":["api","route","endpoint","rest","fetch"],"04-frontend":["component","react","form","ui","page"],"05-payments":["payment","stripe","billing","subscription","checkout"],"08-testing":["test","testing","playwright","vitest"]};this.patterns.has("00-core")&&a.push(this.patterns.get("00-core"));for(let[o,i]of Object.entries(s))if(o!=="00-core"&&i.some(r=>t.includes(r))){let r=this.patterns.get(o);r&&a.push(r)}return a}_extractProjectUpdates(e){let t={},a=e.match(/(?:using|loaded|applied) pattern[s]?: ([^\n]+)/gi);return a&&(t.patterns=a.flatMap(s=>s.split(":")[1]?.split(",").map(o=>o.trim())||[])),Object.keys(t).length>0?t:void 0}_extractKeywords(e){let t={database:["database","db","schema","table","query","drizzle","postgres","sql"],auth:["auth","login","signup","session","password","oauth","jwt","token"],api:["api","route","endpoint","rest","fetch","request","response"],frontend:["component","react","form","ui","page","button","modal"],payments:["payment","stripe","billing","subscription","checkout","price"],testing:["test","testing","playwright","vitest","jest","spec"]},a=e.toLowerCase(),s=[];for(let[o,i]of Object.entries(t))i.some(r=>a.includes(r))&&s.push(o);return s.length>0?s:["general"]}async _callDiscoverPatterns(e,t){if(!this.sessionToken)return console.log("CodeBakers: No session token, skipping server pattern discovery"),null;try{let a=`${this._getApiEndpoint()}/api/patterns/discover`,s=J.workspace.workspaceFolders?.[0]?.uri.fsPath,o=await this._fetchWithTimeout(a,{method:"POST",headers:{Authorization:`Bearer ${this.sessionToken}`,"Content-Type":"application/json"},body:JSON.stringify({task:e,keywords:t,projectPath:s})},15e3);if(!o.ok){let r=await o.json().catch(()=>({}));return console.warn("CodeBakers: Pattern discovery failed:",r),null}let i=await o.json();return{sessionToken:i.sessionToken||"",patterns:i.patterns||[],expiresAt:i.expiresAt||"",message:i.message}}catch(a){return console.warn("CodeBakers: Pattern discovery error:",a),null}}async _callValidateComplete(e,t,a,s=[],o=!1,i=!1,r=!0){if(!this.sessionToken)return null;try{let d=`${this._getApiEndpoint()}/api/patterns/validate`,p=await this._fetchWithTimeout(d,{method:"POST",headers:{Authorization:`Bearer ${this.sessionToken}`,"Content-Type":"application/json"},body:JSON.stringify({sessionToken:e,featureName:t,filesModified:a,testsWritten:s,testsRun:o,testsPassed:i,typescriptPassed:r})},15e3);if(!p.ok){let c=await p.json().catch(()=>({}));return console.warn("CodeBakers: Validation failed:",c),{passed:!1,issues:[c.error||"Validation failed"],compliance:{score:0,deductions:[]}}}let l=await p.json();return{passed:l.passed??!1,issues:l.issues||[],compliance:l.compliance||{score:100,deductions:[]},message:l.message}}catch(d){return console.warn("CodeBakers: Validation error:",d),null}}_getApiEndpoint(){return J.workspace.getConfiguration("codebakers").get("apiEndpoint","https://www.codebakers.ai")}}});var cc={};At(cc,{ProjectContext:()=>Dr});var Oe,W,we,Dr,mc=f(()=>{"use strict";Oe=L(require("vscode")),W=L(require("fs")),we=L(require("path")),Dr=class{constructor(){this._cache=null;this._cacheTime=0;this.CACHE_TTL=3e4}async getProjectState(){if(this._cache&&Date.now()-this._cacheTime<this.CACHE_TTL)return{...this._cache,...this._getDynamicContext()};let e=Oe.workspace.workspaceFolders?.[0];if(!e)return null;let t=e.uri.fsPath,a={},s=we.join(t,".codebakers.json");if(W.existsSync(s))try{let d=W.readFileSync(s,"utf-8"),p=JSON.parse(d);Object.assign(a,p)}catch(d){console.error("Failed to read .codebakers.json:",d)}let o=we.join(t,"package.json");if(W.existsSync(o))try{let d=W.readFileSync(o,"utf-8"),p=JSON.parse(d);a.packageDeps=[...Object.keys(p.dependencies||{}),...Object.keys(p.devDependencies||{})],a.stack||(a.stack=this._detectStack(a.packageDeps))}catch(d){console.error("Failed to read package.json:",d)}a.hasTests=await this._hasTestFiles(t),a.recentFiles=await this._getRecentFiles(t),a.fileTree=await this._getFileTree(t),a.existingTypes=await this._scanExistingTypes(t),a.installedPackages=a.packageDeps?.slice(0,50);let i=we.join(t,".codebakers","DEVLOG.md");if(W.existsSync(i))try{let d=W.readFileSync(i,"utf-8");a.keyDecisions=this._extractFromDevlog(d,"decisions"),a.completedTasks=this._extractFromDevlog(d,"tasks")}catch(d){console.error("Failed to read devlog:",d)}let r=we.join(t,".codebakers","BLOCKED.md");if(W.existsSync(r))try{let d=W.readFileSync(r,"utf-8");a.blockers=this._extractBlockers(d)}catch(d){console.error("Failed to read blockers:",d)}return a.aiMemory=await this._loadAIMemory(t),this._cache=a,this._cacheTime=Date.now(),{...a,...this._getDynamicContext()}}async applyUpdates(e){let t=Oe.workspace.workspaceFolders?.[0];if(!t)return;let a=t.uri.fsPath,s=we.join(a,".codebakers.json"),o={};if(W.existsSync(s))try{o=JSON.parse(W.readFileSync(s,"utf-8"))}catch{o={}}e.decisions&&(o.decisions={...o.decisions,...e.decisions}),e.tasks&&(o.currentWork=o.currentWork||{},o.currentWork.pendingTasks=e.tasks,o.currentWork.lastUpdated=new Date().toISOString()),e.patterns&&(o.analytics=o.analytics||{},o.analytics.modulesUsed=o.analytics.modulesUsed||{},e.patterns.forEach(i=>{o.analytics.modulesUsed[i]=(o.analytics.modulesUsed[i]||0)+1})),W.writeFileSync(s,JSON.stringify(o,null,2)),this._cache=null}invalidateCache(){this._cache=null}_getDynamicContext(){let e=Oe.window.activeTextEditor;if(!e)return{};let t={openFile:Oe.workspace.asRelativePath(e.document.uri)},a=e.selection;return a.isEmpty||(t.selectedText=e.document.getText(a)),t}_detectStack(e){let t={};e.includes("next")?t.framework="nextjs":e.includes("react")?t.framework="react":e.includes("vue")?t.framework="vue":e.includes("svelte")&&(t.framework="svelte"),e.includes("drizzle-orm")?t.database="drizzle":e.includes("prisma")?t.database="prisma":e.includes("mongoose")&&(t.database="mongodb"),e.includes("@supabase/supabase-js")?t.auth="supabase":e.includes("next-auth")?t.auth="next-auth":e.includes("@clerk/nextjs")&&(t.auth="clerk"),e.some(s=>s.includes("@radix-ui"))?t.ui="shadcn":e.includes("@chakra-ui/react")?t.ui="chakra":e.includes("@mui/material")&&(t.ui="mui");let a=[];return e.includes("stripe")&&a.push("stripe"),e.includes("@paypal/react-paypal-js")&&a.push("paypal"),a.length>0&&(t.payments=a),t}async _hasTestFiles(e){let t=["**/*.test.ts","**/*.test.tsx","**/*.spec.ts","**/tests/**"];for(let a of t)if((await Oe.workspace.findFiles(a,"**/node_modules/**",1)).length>0)return!0;return!1}async _getRecentFiles(e){let t=await Oe.workspace.findFiles("**/*.{ts,tsx,js,jsx}","**/node_modules/**",50);return(await Promise.all(t.map(async s=>{try{let o=await Oe.workspace.fs.stat(s);return{path:Oe.workspace.asRelativePath(s),mtime:o.mtime}}catch{return null}}))).filter(s=>s!==null).sort((s,o)=>o.mtime-s.mtime).slice(0,10).map(s=>s.path)}async _getFileTree(e,t=4){let a=new Set(["node_modules",".git",".next","dist","build",".vercel",".turbo","coverage",".cache",".nuxt",".output","__pycache__"]),s=new Set(["src","app","pages","components","lib","utils","hooks","api","services","types","styles","public","tests","__tests__"]),o=[],i=(r,d,p)=>{if(!(p>t))try{let l=W.readdirSync(r,{withFileTypes:!0}),c=l.filter(h=>h.isDirectory()&&!a.has(h.name)&&!h.name.startsWith(".")),m=l.filter(h=>h.isFile());c.sort((h,y)=>{let T=s.has(h.name),k=s.has(y.name);return T&&!k?-1:!T&&k?1:h.name.localeCompare(y.name)});for(let h=0;h<c.length;h++){let y=c[h],T=h===c.length-1&&m.length===0,k=T?"\u2514\u2500\u2500 ":"\u251C\u2500\u2500 ",F=T?"    ":"\u2502   ";o.push(`${d}${k}${y.name}/`),i(we.join(r,y.name),d+F,p+1)}let u=m.filter(h=>p<=1?["package.json","tsconfig.json",".env.example","next.config.js","next.config.mjs","drizzle.config.ts"].includes(h.name)||h.name.endsWith(".ts")||h.name.endsWith(".tsx"):!0),g=p===0?5:p===1?10:15,x=u.slice(0,g),v=u.length-x.length;for(let h=0;h<x.length;h++){let y=x[h],k=h===x.length-1&&v===0?"\u2514\u2500\u2500 ":"\u251C\u2500\u2500 ";o.push(`${d}${k}${y.name}`)}v>0&&o.push(`${d}\u2514\u2500\u2500 ... (${v} more files)`)}catch{}};return o.push(we.basename(e)+"/"),i(e,"",0),o.join(`
`)}async _scanExistingTypes(e){let t=[],a=["src/types","src/lib","types","lib"];for(let i of a){let r=we.join(e,i);if(W.existsSync(r))try{let d=W.readdirSync(r).filter(p=>p.endsWith(".ts")||p.endsWith(".tsx"));for(let p of d.slice(0,10)){let l=we.join(r,p);try{let c=W.readFileSync(l,"utf-8"),m=we.join(i,p),u=/export\s+interface\s+(\w+)/g,g;for(;(g=u.exec(c))!==null;)t.push({name:g[1],file:m,kind:"interface"});let x=/export\s+type\s+(\w+)/g;for(;(g=x.exec(c))!==null;)t.push({name:g[1],file:m,kind:"type"});let v=/export\s+enum\s+(\w+)/g;for(;(g=v.exec(c))!==null;)t.push({name:g[1],file:m,kind:"enum"})}catch{}}}catch{}}if(t.length===0)return"";let s=["EXISTING TYPES (import these instead of creating new):"],o=new Map;for(let i of t){let r=o.get(i.file)||[];r.push(i),o.set(i.file,r)}for(let[i,r]of o){s.push(`  ${i}:`);for(let d of r.slice(0,5))s.push(`    - ${d.kind} ${d.name}`);r.length>5&&s.push(`    ... and ${r.length-5} more`)}return s.slice(0,30).join(`
`)}_extractFromDevlog(e,t){let a=[],s=e.split(`
`),o=!1,i=!1;for(let r of s){if(r.startsWith("## "))o=!0;else if(r.startsWith("---"))break;if(o){if(t==="decisions"&&r.toLowerCase().includes("decision")){i=!0;continue}if(t==="tasks"&&r.toLowerCase().includes("what was done")){i=!0;continue}i&&(r.startsWith("###")||r.startsWith("## ")?i=!1:r.startsWith("- ")&&a.push(r.substring(2).trim()))}}return a.slice(0,5)}_extractBlockers(e){let t=[],a=e.split(`
`);for(let s=0;s<a.length;s++){let o=a[s];o.startsWith("**Blocking Issue:**")&&t.push(o.replace("**Blocking Issue:**","").trim())}return t}async _loadAIMemory(e){let t=we.join(e,".codebakers","memory.json");if(W.existsSync(t))try{let a=W.readFileSync(t,"utf-8");return JSON.parse(a)}catch(a){console.error("Failed to load AI memory:",a);return}}async _saveAIMemory(e,t){let a=we.join(e,".codebakers"),s=we.join(a,"memory.json");W.existsSync(a)||W.mkdirSync(a,{recursive:!0}),t.lastUpdated=new Date().toISOString(),W.writeFileSync(s,JSON.stringify(t,null,2))}async addMemory(e,t,a="inferred",s=.7){let o=Oe.workspace.workspaceFolders?.[0];if(!o)return;let i=o.uri.fsPath,r=await this._loadAIMemory(i);r||(r={architecture:[],preferences:[],keyFiles:[],patterns:[],avoid:[],lastUpdated:new Date().toISOString()});let d=r[e].find(l=>this._similarContent(l.content,t));if(d){s>d.confidence&&(d.confidence=s,d.timestamp=new Date().toISOString());return}let p={content:t,confidence:s,source:a,timestamp:new Date().toISOString()};r[e].push(p),r[e]=r[e].sort((l,c)=>c.confidence-l.confidence).slice(0,20),await this._saveAIMemory(i,r),this._cache=null}_similarContent(e,t){let a=l=>l.toLowerCase().replace(/[^a-z0-9]/g,""),s=a(e),o=a(t);if(s.includes(o)||o.includes(s))return!0;let i=new Set(e.toLowerCase().split(/\s+/)),r=new Set(t.toLowerCase().split(/\s+/)),d=[...i].filter(l=>r.has(l)),p=new Set([...i,...r]);return d.length/p.size>.7}formatMemoryForPrompt(e){let t=["## \u{1F9E0} AI Project Memory (learned from previous sessions)"],a=(s,o,i)=>{let r=s.filter(d=>d.confidence>=.5);if(r.length!==0){t.push(`
### ${i} ${o}`);for(let d of r.slice(0,10)){let p=d.confidence>=.9?"\u2713":d.confidence>=.7?"~":"?";t.push(`- [${p}] ${d.content}`)}}};return a(e.architecture,"Architecture Decisions","\u{1F3D7}\uFE0F"),a(e.preferences,"User Preferences","\u2699\uFE0F"),a(e.keyFiles,"Key Files","\u{1F4C1}"),a(e.patterns,"Common Patterns","\u{1F504}"),a(e.avoid,"Things to Avoid","\u26D4"),t.length===1?"":t.join(`
`)}async learnFromResponse(e,t){let a=[{pattern:/REMEMBER:\s*(.+?)(?:\n|$)/gi,category:"architecture"},{pattern:/USER PREFERS:\s*(.+?)(?:\n|$)/gi,category:"preferences"},{pattern:/KEY FILE:\s*(.+?)(?:\n|$)/gi,category:"keyFiles"},{pattern:/PATTERN:\s*(.+?)(?:\n|$)/gi,category:"patterns"},{pattern:/AVOID:\s*(.+?)(?:\n|$)/gi,category:"avoid"}];for(let{pattern:s,category:o}of a){let i;for(;(i=s.exec(e))!==null;)await this.addMemory(o,i[1].trim(),"explicit",.95)}if(t.toLowerCase().includes("don't")||t.toLowerCase().includes("never")||t.toLowerCase().includes("stop")){let s=t.match(/(?:don't|never|stop)\s+(.+?)(?:\.|$)/i);s&&await this.addMemory("avoid",s[1].trim(),"user",.9)}if(t.toLowerCase().includes("always")||t.toLowerCase().includes("prefer")){let s=t.match(/(?:always|prefer)\s+(.+?)(?:\.|$)/i);s&&await this.addMemory("preferences",s[1].trim(),"user",.9)}}async clearMemory(){let e=Oe.workspace.workspaceFolders?.[0];if(!e)return;let t=we.join(e.uri.fsPath,".codebakers","memory.json");W.existsSync(t)&&W.unlinkSync(t),this._cache=null}}});var uc=f(()=>{"use strict"});var Rr,gc,me,Xa,Fr=f(()=>{"use strict";Rr=L(require("vscode")),gc=L(require("fs")),me=L(require("path")),Xa=class{constructor(){this.nodes=new Map;this.edges=new Map;this.groups=[];this.FILE_PATTERNS=["**/*.ts","**/*.tsx","**/*.js","**/*.jsx"];this.IGNORE_DIRS=["node_modules",".next","dist","build",".git","coverage","__tests__","__mocks__"];this.projectPath="",this.projectName=""}async analyzeProject(){let e=Rr.workspace.workspaceFolders?.[0];if(!e)throw new Error("No workspace folder open");this.projectPath=e.uri.fsPath,this.projectName=me.basename(this.projectPath),this.nodes.clear(),this.edges.clear(),this.groups=[],console.log(`MindMap: Analyzing project at ${this.projectPath}`);let t=await this.findFiles();console.log(`MindMap: Found ${t.length} files to analyze`);for(let i of t)try{await this.analyzeFile(i)}catch(r){console.error(`MindMap: Error analyzing ${i}:`,r)}this.buildEdges(),this.autoGroupByDirectory();let a=this.findCoherenceIssues(),s=this.calculateCoherenceScore(a);this.calculateLayout();let o={projectName:this.projectName,projectPath:this.projectPath,analyzedAt:new Date().toISOString(),totalFiles:t.length,totalNodes:this.nodes.size,totalEdges:this.countEdges(),coherenceScore:s,issues:a};return{nodes:Array.from(this.nodes.values()),edges:this.getAllEdges(),groups:this.groups,metadata:o}}async findFiles(){let e=[],t=`{${this.IGNORE_DIRS.join(",")}}`;for(let a of this.FILE_PATTERNS){let s=await Rr.workspace.findFiles(a,`**/${t}/**`);for(let o of s)e.push(o.fsPath)}return e}async analyzeFile(e){let t=gc.readFileSync(e,"utf-8"),a=me.relative(this.projectPath,e),s=me.basename(e),o=me.extname(e),i=this.pathToId(a),r=this.createFileNode(i,a,t);this.nodes.set(i,r),r.imports=this.extractImports(t),r.exports=this.extractExports(t);let d=this.detectNodeType(e,t);switch(r.type=d,d){case"component":r.props=this.extractProps(t),r.hooks=this.extractHooks(t);break;case"type":case"interface":r.fields=this.extractFields(t);break;case"api":r.methods=this.extractApiMethods(t);break;case"hook":r.methods=this.extractHookMethods(t);break;case"class":r.methods=this.extractClassMethods(t),r.fields=this.extractClassFields(t);break}r.style=this.getStyleForType(d)}createFileNode(e,t,a){let s=a.split(`
`);return{id:e,type:"file",name:me.basename(t,me.extname(t)),path:t,position:{x:0,y:0},linesOfCode:s.length,complexity:this.calculateComplexity(a),imports:[],exports:[]}}detectNodeType(e,t){let a=me.basename(e).toLowerCase(),s=me.dirname(e).toLowerCase();return e.includes("/api/")&&a==="route.ts"||e.includes("/pages/api/")?"api":a.startsWith("use")&&a.endsWith(".ts")||s.includes("hooks")?"hook":a.includes("context")||a.includes("provider")?"context":s.includes("types")||a.includes(".types.")?"type":(t.includes("export default function")||t.includes("export function")||t.includes("React.FC")||t.includes(": FC<")||t.includes("return (")||t.includes("return <"))&&t.includes("<")&&(t.includes("/>")||t.includes("</"))?"component":/class\s+\w+/.test(t)?"class":/export\s+(interface|type)\s+\w+/.test(t)?"interface":/export\s+enum\s+\w+/.test(t)?"enum":/export\s+const\s+[A-Z_]+\s*=/.test(t)?"constant":/export\s+(async\s+)?function/.test(t)?"function":"file"}extractImports(e){let t=[],a=e.split(`
`),s=[/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g,/import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g,/import\s+\*\s+as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g,/import\s+type\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g];for(let o=0;o<a.length;o++){let i=a[o],r=i.match(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/);if(r){let l=r[1].split(",").map(m=>m.trim().split(" as ")[0].trim()),c=r[2];for(let m of l)m&&t.push({name:m,from:c,type:i.includes("import type")?"type":"named",line:o+1});continue}let d=i.match(/import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/);if(d&&!i.includes("{")){t.push({name:d[1],from:d[2],type:"default",line:o+1});continue}let p=i.match(/import\s+\*\s+as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/);p&&t.push({name:p[1],from:p[2],type:"namespace",line:o+1})}return t}extractExports(e){let t=[],a=e.split(`
`);for(let s=0;s<a.length;s++){let o=a[s];if(/export\s+default/.test(o)){let p=o.match(/export\s+default\s+(?:function\s+|class\s+)?(\w+)/);t.push({name:p?p[1]:"default",type:"default",line:s+1});continue}let i=o.match(/export\s+interface\s+(\w+)/);if(i){t.push({name:i[1],type:"interface",line:s+1});continue}let r=o.match(/export\s+type\s+(\w+)/);if(r){t.push({name:r[1],type:"type",line:s+1});continue}let d=o.match(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+(\w+)/);d&&t.push({name:d[1],type:"named",line:s+1})}return t}extractProps(e){let t=[],a=e.match(/(?:interface|type)\s+\w*Props\w*\s*(?:=\s*)?\{([^}]+)\}/);if(a){let o=a[1].split(`
`);for(let i of o){let r=i.match(/(\w+)(\?)?:\s*([^;,]+)/);r&&t.push({name:r[1],type:r[3].trim(),required:!r[2]})}}return t}extractHooks(e){let t=[],a=e.matchAll(/\b(use\w+)\s*\(/g);for(let s of a)t.includes(s[1])||t.push(s[1]);return t}extractFields(e){let t=[],a=e.match(/(?:interface|type)\s+\w+\s*(?:=\s*)?\{([^}]+)\}/);if(a){let o=a[1].split(`
`);for(let i=0;i<o.length;i++){let d=o[i].trim().match(/(\w+)(\?)?:\s*([^;,]+)/);d&&t.push({name:d[1],type:d[3].trim(),optional:!!d[2],line:i+1})}}return t}extractApiMethods(e){let t=[],a=["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"];for(let s of a){let o=new RegExp(`export\\s+(?:async\\s+)?function\\s+${s}`,"g"),i=e.match(o);if(i){let r=e.indexOf(i[0]),d=e.substring(0,r).split(`
`).length;t.push({name:s,params:["request: Request"],returnType:"Response",async:e.includes(`async function ${s}`),line:d})}}return t}extractHookMethods(e){let t=[],a=e.match(/export\s+(?:default\s+)?function\s+(use\w+)/);return a&&t.push({name:a[1],params:[],returnType:"unknown",async:e.includes(`async function ${a[1]}`),line:1}),t}extractClassMethods(e){let t=[],a=/(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/g,s=e.split(`
`),o;for(;(o=a.exec(e))!==null;){let i=e.substring(0,o.index).split(`
`).length;o[1]!=="function"&&o[1]!=="if"&&o[1]!=="for"&&o[1]!=="while"&&t.push({name:o[1],params:[],returnType:"unknown",async:o[0].includes("async"),line:i})}return t}extractClassFields(e){let t=[],a=/(?:private|public|protected)?\s*(\w+)\s*(?:\?)?:\s*([^;=]+)/g,s;for(;(s=a.exec(e))!==null;)t.push({name:s[1],type:s[2].trim(),optional:e.charAt(s.index+s[1].length)==="?"});return t}calculateComplexity(e){let t=1,a=[/\bif\s*\(/g,/\belse\s+if\s*\(/g,/\bfor\s*\(/g,/\bwhile\s*\(/g,/\bcase\s+/g,/\bcatch\s*\(/g,/\?\?/g,/\?[^:]/g,/&&/g,/\|\|/g];for(let s of a){let o=e.match(s);o&&(t+=o.length)}return t}getStyleForType(e){let t={file:{color:"#6b7280",icon:"\u{1F4C4}"},component:{color:"#3b82f6",icon:"\u269B\uFE0F"},function:{color:"#10b981",icon:"\u0192"},type:{color:"#8b5cf6",icon:"T"},interface:{color:"#8b5cf6",icon:"I"},api:{color:"#f59e0b",icon:"\u{1F50C}"},hook:{color:"#ec4899",icon:"\u{1FA9D}"},context:{color:"#06b6d4",icon:"\u{1F310}"},class:{color:"#ef4444",icon:"\u{1F4E6}"},enum:{color:"#84cc16",icon:"E"},constant:{color:"#f97316",icon:"C"},database:{color:"#14b8a6",icon:"\u{1F5C3}\uFE0F"},external:{color:"#9ca3af",icon:"\u{1F4E1}"}};return t[e]||t.file}buildEdges(){for(let[e,t]of this.nodes)if(t.imports)for(let a of t.imports){let s=this.resolveImport(a.from,t.path);if(s&&this.nodes.has(s)){let o=a.type==="type"?"uses_type":"imports";this.addEdge(e,s,o,a.name)}}}resolveImport(e,t){if(!e.startsWith(".")&&!e.startsWith("@/"))return null;let a;if(e.startsWith("@/"))a=e.replace("@/","src/");else{let o=me.dirname(t);a=me.join(o,e)}let s=["",".ts",".tsx",".js",".jsx","/index.ts","/index.tsx"];for(let o of s){let i=a+o,r=this.pathToId(i);if(this.nodes.has(r))return r}return null}addEdge(e,t,a,s){let i={id:`${e}->${t}:${a}`,source:e,target:t,type:a,label:s,weight:this.getEdgeWeight(a)};this.edges.has(e)||this.edges.set(e,[]),this.edges.get(e).push(i)}getEdgeWeight(e){return{imports:5,exports:3,calls:7,extends:9,implements:8,uses_type:4,renders:6,provides_context:7,consumes_context:6,has_field:3,references:2}[e]||5}autoGroupByDirectory(){let e=new Map;for(let[s,o]of this.nodes){let i=me.dirname(o.path),r=i.split(me.sep)[0]||i;e.has(r)||e.set(r,[]),e.get(r).push(s)}let t=["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4"],a=0;for(let[s,o]of e)o.length>=2&&(this.groups.push({id:`group-${s}`,name:s,nodeIds:o,color:t[a%t.length]}),a++)}findCoherenceIssues(){let e=[],t=this.findCircularDependencies();for(let s of t)e.push({id:`circular-${s.join("-")}`,type:"circular_dependency",severity:"high",nodeIds:s,message:`Circular dependency: ${s.map(o=>this.nodes.get(o)?.name).join(" \u2192 ")}`,suggestion:"Extract shared logic to a separate module"});let a=this.findUnusedExports();for(let{nodeId:s,exportName:o}of a)e.push({id:`unused-export-${s}-${o}`,type:"unused_export",severity:"low",nodeIds:[s],message:`Unused export: ${o} in ${this.nodes.get(s)?.name}`,suggestion:"Consider removing if not needed"});for(let[s,o]of this.nodes){let i=this.hasIncomingEdges(s),r=this.edges.has(s);!i&&!r&&o.type!=="api"&&e.push({id:`orphan-${s}`,type:"orphaned_file",severity:"medium",nodeIds:[s],message:`Orphaned file: ${o.name} has no connections`,suggestion:"This file might be unused or missing imports"})}for(let[s,o]of this.nodes){let i=this.edges.get(s)?.length||0,r=this.countIncomingEdges(s);i+r>15&&e.push({id:`god-object-${s}`,type:"god_object",severity:"medium",nodeIds:[s],message:`High coupling: ${o.name} has ${i+r} connections`,suggestion:"Consider splitting into smaller modules"})}return e}findCircularDependencies(){let e=[],t=new Set,a=new Set,s=(o,i)=>{t.add(o),a.add(o),i.push(o);let r=this.edges.get(o)||[];for(let d of r)if(!t.has(d.target))s(d.target,[...i]);else if(a.has(d.target)){let p=i.indexOf(d.target),l=i.slice(p);l.push(d.target),e.push(l)}a.delete(o)};for(let o of this.nodes.keys())t.has(o)||s(o,[]);return e}findUnusedExports(){let e=[],t=new Set;for(let a of this.nodes.values())for(let s of a.imports||[])t.add(s.name);for(let[a,s]of this.nodes)for(let o of s.exports||[])o.type!=="default"&&!t.has(o.name)&&e.push({nodeId:a,exportName:o.name});return e}hasIncomingEdges(e){for(let t of this.edges.values())if(t.some(a=>a.target===e))return!0;return!1}countIncomingEdges(e){let t=0;for(let a of this.edges.values())t+=a.filter(s=>s.target===e).length;return t}calculateCoherenceScore(e){let t=100;for(let a of e)switch(a.severity){case"critical":t-=15;break;case"high":t-=10;break;case"medium":t-=5;break;case"low":t-=2;break;case"info":t-=1;break}return Math.max(0,Math.min(100,t))}calculateLayout(){let s=new Map;for(let r of this.nodes.values())s.has(r.type)||s.set(r.type,[]),s.get(r.type).push(r);let o=0,i=["type","interface","context","hook","component","api","function","class","file"];for(let r of i){let d=s.get(r)||[];if(d.length!==0){for(let p=0;p<d.length;p++){let l=p%5*300,c=o+Math.floor(p/5)*150;d[p].position={x:l,y:c}}o+=Math.ceil(d.length/5)*150+100}}}pathToId(e){return e.replace(/[\\\/]/g,"-").replace(/\./g,"_")}countEdges(){let e=0;for(let t of this.edges.values())e+=t.length;return e}getAllEdges(){let e=[];for(let t of this.edges.values())e.push(...t);return e}getNode(e){return this.nodes.get(e)}getDependents(e){let t=[];for(let a of this.edges.values())for(let s of a)if(s.target===e){let o=this.nodes.get(s.source);o&&t.push(o)}return t}getDependencies(e){return(this.edges.get(e)||[]).map(a=>this.nodes.get(a.target)).filter(a=>a!==void 0)}getEdges(e){return this.edges.get(e)||[]}}});var hc,rt,Do,Ka,Lr=f(()=>{"use strict";hc=L(require("vscode")),rt=L(require("fs")),Do=L(require("path")),Ka=class{constructor(e){this.appliedPatches=[];this.graph=e;let t=hc.workspace.workspaceFolders?.[0];this.projectPath=t?.uri.fsPath||""}async analyzeImpact(e){let t=this.graph.getNode(e.nodeId);if(!t)throw new Error(`Node not found: ${e.nodeId}`);let a=[],s=[],o=[],i=[],r=this.graph.getDependents(e.nodeId);for(let l of r){let c=await this.analyzeNodeImpact(l,t,e);c.breaking&&o.push(...c.breaking),c.affected&&a.push(c.affected),c.fixes&&i.push(...c.fixes)}let d=new Set([e.nodeId,...r.map(l=>l.id)]);for(let l of r){let c=this.graph.getDependents(l.id);for(let m of c)d.has(m.id)||(d.add(m.id),s.push({nodeId:m.id,nodeName:m.name,path:m.path,impactType:"update_usage",description:`Transitively affected through ${l.name}`}))}let p=this.calculateRiskLevel(a.length,o.length,e.changeType);return{targetNode:e.nodeId,change:e,directImpact:a,transitiveImpact:s,breakingChanges:o,suggestedFixes:i,riskLevel:p}}async analyzeNodeImpact(e,t,a){let s=[],o=[],i=Do.join(this.projectPath,e.path);if(!rt.existsSync(i))return{};let r=rt.readFileSync(i,"utf-8"),d=r.split(`
`);switch(a.changeType){case"rename":return this.analyzeRenameImpact(e,t,a,r,d);case"add_field":return this.analyzeAddFieldImpact(e,t,a,r,d);case"remove_field":return this.analyzeRemoveFieldImpact(e,t,a,r,d);case"change_type":return this.analyzeTypeChangeImpact(e,t,a,r,d);case"delete":return this.analyzeDeleteImpact(e,t,a,r,d);default:return{affected:{nodeId:e.id,nodeName:e.name,path:e.path,impactType:"update_usage",description:`May be affected by ${a.changeType} on ${t.name}`}}}}analyzeRenameImpact(e,t,a,s,o){let i=a.before,r=a.after,d=[],p=new RegExp(`\\b${this.escapeRegex(i)}\\b`,"g");for(let l=0;l<o.length;l++){let c=o[l];if(p.test(c)){let m=c.replace(p,r);d.push({nodeId:e.id,path:e.path,line:l+1,description:`Rename ${i} to ${r}`,oldCode:c,newCode:m,autoFixable:!0})}}return d.length===0?{}:{affected:{nodeId:e.id,nodeName:e.name,path:e.path,impactType:"update_import",description:`${d.length} reference(s) to ${i} need updating`},fixes:d}}analyzeAddFieldImpact(e,t,a,s,o){let i=a.after?.name,r=a.after?.type,d=[],p=t.name,l=new RegExp(`:\\s*${p}\\s*=\\s*\\{`,"g");for(let c=0;c<o.length;c++)l.test(o[c])&&d.push({nodeId:e.id,path:e.path,line:c+1,description:`Consider adding ${i}: ${r} to ${p} object`,oldCode:o[c],newCode:o[c],autoFixable:!1});return d.length===0?{}:{affected:{nodeId:e.id,nodeName:e.name,path:e.path,impactType:"missing_field",description:`May need to add ${i} to ${p} usages`},fixes:d}}analyzeRemoveFieldImpact(e,t,a,s,o){let i=a.before?.name,r=[],d=[],p=new RegExp(`\\.${i}\\b`,"g"),l=new RegExp(`\\{[^}]*\\b${i}\\b[^}]*\\}`,"g");for(let c=0;c<o.length;c++){let m=o[c];p.test(m)&&(r.push({nodeId:e.id,path:e.path,line:c+1,currentCode:m,reason:`Uses removed field .${i}`}),d.push({nodeId:e.id,path:e.path,line:c+1,description:`Remove usage of .${i}`,oldCode:m,newCode:m.replace(p,""),autoFixable:!1})),l.test(m)&&r.push({nodeId:e.id,path:e.path,line:c+1,currentCode:m,reason:`Destructures removed field ${i}`})}return r.length===0?{}:{affected:{nodeId:e.id,nodeName:e.name,path:e.path,impactType:"breaking",description:`${r.length} usage(s) of removed field ${i}`},breaking:r,fixes:d}}analyzeTypeChangeImpact(e,t,a,s,o){let i=a.before?.name,r=a.before?.type,d=a.after?.type,p=[],l=[],c=new RegExp(`\\.${i}\\b`,"g");for(let m=0;m<o.length;m++){let u=o[m];c.test(u)&&this.mightHaveTypeConflict(u,i,r,d)&&(p.push({nodeId:e.id,path:e.path,line:m+1,currentCode:u,reason:`Type change: ${i} changed from ${r} to ${d}`}),l.push({nodeId:e.id,path:e.path,line:m+1,description:`Update usage for new type ${d}`,oldCode:u,newCode:u,autoFixable:!1}))}return p.length===0?{affected:{nodeId:e.id,nodeName:e.name,path:e.path,impactType:"type_mismatch",description:`Uses ${i} which changed from ${r} to ${d}`}}:{affected:{nodeId:e.id,nodeName:e.name,path:e.path,impactType:"type_mismatch",description:`${p.length} potential type conflict(s)`},breaking:p,fixes:l}}analyzeDeleteImpact(e,t,a,s,o){let i=[],r=[],d=new RegExp(`import\\s+(?:.*\\{[^}]*\\b${t.name}\\b[^}]*\\}|${t.name})\\s+from`,"g");for(let p=0;p<o.length;p++){let l=o[p];d.test(l)&&(i.push({nodeId:e.id,path:e.path,line:p+1,currentCode:l,reason:`Imports deleted module ${t.name}`}),r.push({nodeId:e.id,path:e.path,line:p+1,description:`Remove import of deleted ${t.name}`,oldCode:l,newCode:"",autoFixable:!0}))}return i.length===0?{}:{affected:{nodeId:e.id,nodeName:e.name,path:e.path,impactType:"breaking",description:`Imports deleted ${t.name}`},breaking:i,fixes:r}}mightHaveTypeConflict(e,t,a,s){return!!((a.includes("string")&&s.includes("number")||a.includes("number")&&s.includes("string"))&&(e.includes(".length")||e.includes(".charAt")||e.includes(".split")||/[+\-*/]/.test(e))||s.includes("|")||a.includes("|"))}calculateRiskLevel(e,t,a){return t>5||a==="delete"&&e>3?"critical":t>0||e>10?"high":e>5?"medium":"low"}async applyPatches(e){let t=[],a=[],s=[],o=new Set,i=new Map;for(let r of e)i.has(r.path)||i.set(r.path,[]),i.get(r.path).push(r);for(let[r,d]of i)try{let p=Do.join(this.projectPath,r);if(!rt.existsSync(p)){s.push(`File not found: ${r}`);for(let m of d)m.error="File not found",a.push(m);continue}let l=rt.readFileSync(p,"utf-8"),c=l.split(`
`);d.sort((m,u)=>u.line-m.line);for(let m of d)try{let u=m.line-1;if(u<0||u>=c.length){m.error=`Line ${m.line} out of range`,a.push(m);continue}if(c[u].trim()!==m.oldCode.trim()){let g=this.findMatchingLine(c,m.oldCode,m.line);if(g===-1){m.error="Code has changed, cannot apply patch",a.push(m);continue}m.line=g+1}m.newCode===""?c.splice(m.line-1,1):c[m.line-1]=m.newCode,m.applied=!0,t.push(m)}catch(u){m.error=u.message,a.push(m)}l=c.join(`
`),rt.writeFileSync(p,l,"utf-8"),o.add(r)}catch(p){s.push(`Error processing ${r}: ${p.message}`);for(let l of d)l.applied||(l.error=p.message,a.push(l))}return this.appliedPatches.push(...t),{success:a.length===0,patchesApplied:t,patchesFailed:a,errors:s,filesModified:Array.from(o)}}findMatchingLine(e,t,a){let s=t.trim(),o=5;for(let i=0;i<=o;i++){if(a-1-i>=0&&e[a-1-i].trim()===s)return a-1-i;if(a-1+i<e.length&&e[a-1+i].trim()===s)return a-1+i}return-1}async rollback(e){let t=e.length>0?this.appliedPatches.filter(o=>e.includes(o.id)):[...this.appliedPatches],a=t.map(o=>({...o,id:`rollback-${o.id}`,oldCode:o.newCode,newCode:o.oldCode,description:`Rollback: ${o.description}`,applied:!1})),s=await this.applyPatches(a);if(s.success){let o=new Set(t.map(i=>i.id));this.appliedPatches=this.appliedPatches.filter(i=>!o.has(i.id))}return s}async generateRenamePatches(e,t,a){let s=[],o=this.graph.getDependents(e);for(let i of o){let r=Do.join(this.projectPath,i.path);if(!rt.existsSync(r))continue;let p=rt.readFileSync(r,"utf-8").split(`
`),l=new RegExp(`\\b${this.escapeRegex(t)}\\b`,"g");for(let c=0;c<p.length;c++){let m=p[c];l.test(m)&&s.push({id:`rename-${i.id}-${c}`,path:i.path,line:c+1,oldCode:m,newCode:m.replace(l,a),description:`Rename ${t} to ${a}`,autoFixable:!0})}}return s}escapeRegex(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}getAppliedPatches(){return[...this.appliedPatches]}clearHistory(){this.appliedPatches=[]}}});var Z,os,Tt,Ro,fc=f(()=>{"use strict";Z=L(require("vscode")),os=L(require("path")),Tt=L(require("fs"));Fr();Lr();Ro=class n{constructor(e,t){this._disposables=[];this.graphData=null;this._panel=e,this._extensionUri=t,this.graph=new Xa,this.propagation=new Ka(this.graph),this._update(),this._panel.onDidDispose(()=>this.dispose(),null,this._disposables),this._panel.webview.onDidReceiveMessage(async a=>{await this._handleMessage(a)},null,this._disposables)}static createOrShow(e){let t=Z.window.activeTextEditor?Z.window.activeTextEditor.viewColumn:void 0;if(n.currentPanel)return n.currentPanel._panel.reveal(t),n.currentPanel;let a=Z.window.createWebviewPanel("codebakers.mindmap","CodeBakers Mind Map",t||Z.ViewColumn.One,{enableScripts:!0,retainContextWhenHidden:!0,localResourceRoots:[e]});return n.currentPanel=new n(a,e),n.currentPanel}async analyze(){this._postMessage({type:"loading",isLoading:!0});try{let e=await this._loadSavedData();if(this.graphData=await this.graph.analyzeProject(),e?.userPositions)for(let t of this.graphData.nodes)e.userPositions[t.id]&&(t.position=e.userPositions[t.id]);this._postMessage({type:"init",data:this.graphData})}catch(e){console.error("MindMap: Analysis failed:",e),this._postMessage({type:"error",message:e.message})}finally{this._postMessage({type:"loading",isLoading:!1})}}async _handleMessage(e){switch(e.type){case"ready":await this.analyze();break;case"refresh":await this.analyze();break;case"selectNode":let t=this.graph.getNode(e.nodeId);if(t){let o=this.graph.getDependents(e.nodeId),i=this.graph.getDependencies(e.nodeId);this._postMessage({type:"nodeDetails",node:t,dependents:o,dependencies:i})}break;case"analyzeImpact":try{let o=await this.propagation.analyzeImpact(e.change);this._postMessage({type:"impactResult",data:o})}catch(o){this._postMessage({type:"error",message:o.message})}break;case"applyChanges":try{let o=await this.propagation.applyPatches(e.patches);this._postMessage({type:"propagationResult",data:o}),await this.analyze()}catch(o){this._postMessage({type:"error",message:o.message})}break;case"openFile":let a=Z.workspace.workspaceFolders?.[0];if(!a){Z.window.showErrorMessage("No workspace folder open");break}let s=Z.Uri.file(os.join(a.uri.fsPath,e.path));try{let o=await Z.workspace.openTextDocument(s),i=await Z.window.showTextDocument(o);if(e.line){let r=new Z.Position(e.line-1,0);i.selection=new Z.Selection(r,r),i.revealRange(new Z.Range(r,r))}}catch(o){Z.window.showErrorMessage(`Could not open file: ${o.message}`)}break;case"savePositions":await this._savePositions(e.positions);break;case"exportImage":Z.window.showInformationMessage("Export feature coming soon!");break}}async _loadSavedData(){let e=Z.workspace.workspaceFolders?.[0];if(!e)return null;let t=os.join(e.uri.fsPath,".codebakers","mindmap.json");if(!Tt.existsSync(t))return null;try{let a=Tt.readFileSync(t,"utf-8");return JSON.parse(a)}catch{return null}}async _savePositions(e){let t=Z.workspace.workspaceFolders?.[0];if(!t)return;let a=os.join(t.uri.fsPath,".codebakers"),s=os.join(a,"mindmap.json");Tt.existsSync(a)||Tt.mkdirSync(a,{recursive:!0});let o={version:"1.0",lastSync:new Date().toISOString(),userPositions:e},i=await this._loadSavedData();i&&(o.userPositions={...i.userPositions,...e}),Tt.writeFileSync(s,JSON.stringify(o,null,2))}_postMessage(e){this._panel.webview.postMessage(e)}_update(){this._panel.webview.html=this._getHtmlForWebview()}_getHtmlForWebview(){return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeBakers Mind Map</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; overflow: hidden; height: 100vh; }

    /* Header */
    .header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #1e293b; border-bottom: 1px solid #334155; }
    .header h1 { font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .header-actions { display: flex; gap: 8px; }
    .btn { padding: 6px 12px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }
    .btn-secondary { background: #334155; color: #e2e8f0; }
    .btn-secondary:hover { background: #475569; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-danger:hover { background: #dc2626; }
    .btn-success { background: #22c55e; color: white; }
    .btn-success:hover { background: #16a34a; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Stats Bar */
    .stats-bar { display: flex; gap: 24px; padding: 8px 16px; background: #1e293b; border-bottom: 1px solid #334155; font-size: 13px; }
    .stat { display: flex; align-items: center; gap: 6px; }
    .stat-value { font-weight: 600; color: #3b82f6; }
    .stat-label { color: #94a3b8; }
    .coherence-score { display: flex; align-items: center; gap: 8px; }
    .coherence-bar { width: 100px; height: 6px; background: #334155; border-radius: 3px; overflow: hidden; }
    .coherence-fill { height: 100%; transition: width 0.3s; }

    /* Canvas Container */
    .canvas-container { position: relative; height: calc(100vh - 100px); overflow: hidden; }
    #mindmap-canvas { position: absolute; top: 0; left: 0; cursor: grab; }
    #mindmap-canvas.dragging { cursor: grabbing; }

    /* Context Menu */
    .context-menu { position: fixed; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 4px 0; min-width: 180px; z-index: 1000; display: none; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
    .context-menu.show { display: block; }
    .context-menu-item { padding: 10px 16px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 13px; }
    .context-menu-item:hover { background: #334155; }
    .context-menu-item.danger { color: #ef4444; }
    .context-menu-divider { height: 1px; background: #334155; margin: 4px 0; }

    /* Modal */
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: none; align-items: center; justify-content: center; z-index: 2000; }
    .modal-overlay.show { display: flex; }
    .modal { background: #1e293b; border: 1px solid #334155; border-radius: 12px; width: 480px; max-height: 80vh; overflow: hidden; }
    .modal-header { padding: 16px 20px; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; }
    .modal-header h2 { font-size: 16px; font-weight: 600; }
    .modal-body { padding: 20px; max-height: 60vh; overflow-y: auto; }
    .modal-footer { padding: 16px 20px; border-top: 1px solid #334155; display: flex; justify-content: flex-end; gap: 12px; }

    /* Form Elements */
    .form-group { margin-bottom: 16px; }
    .form-label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: #94a3b8; }
    .form-input { width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #e2e8f0; font-size: 14px; }
    .form-input:focus { outline: none; border-color: #3b82f6; }

    /* Impact Panel */
    .impact-panel { position: absolute; top: 0; right: 0; width: 400px; height: 100%; background: #1e293b; border-left: 1px solid #334155; transform: translateX(100%); transition: transform 0.3s; z-index: 500; display: flex; flex-direction: column; }
    .impact-panel.open { transform: translateX(0); }
    .impact-header { padding: 16px; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; }
    .impact-header h3 { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .impact-content { flex: 1; overflow-y: auto; padding: 16px; }
    .impact-footer { padding: 16px; border-top: 1px solid #334155; display: flex; gap: 12px; }
    .impact-section { margin-bottom: 20px; }
    .impact-section h4 { font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
    .impact-item { padding: 10px 12px; background: #0f172a; border-radius: 6px; margin-bottom: 8px; font-size: 13px; border-left: 3px solid #3b82f6; cursor: pointer; }
    .impact-item:hover { background: #1e293b; }
    .impact-item.breaking { border-left-color: #ef4444; background: rgba(239,68,68,0.1); }
    .impact-item.warning { border-left-color: #f59e0b; }
    .impact-item .path { color: #94a3b8; font-size: 11px; margin-top: 4px; }
    .risk-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .risk-badge.low { background: #22c55e33; color: #22c55e; }
    .risk-badge.medium { background: #f59e0b33; color: #f59e0b; }
    .risk-badge.high { background: #f9731633; color: #f97316; }
    .risk-badge.critical { background: #ef444433; color: #ef4444; }

    /* Patch Preview */
    .patch-preview { background: #0f172a; border-radius: 6px; padding: 12px; margin-top: 8px; font-family: 'Fira Code', monospace; font-size: 12px; }
    .patch-line { padding: 2px 0; }
    .patch-line.remove { color: #ef4444; background: rgba(239,68,68,0.1); }
    .patch-line.add { color: #22c55e; background: rgba(34,197,94,0.1); }

    /* Details Panel */
    .details-panel { position: absolute; top: 0; right: 0; width: 320px; height: 100%; background: #1e293b; border-left: 1px solid #334155; transform: translateX(100%); transition: transform 0.3s; overflow-y: auto; z-index: 400; }
    .details-panel.open { transform: translateX(0); }
    .details-header { padding: 16px; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; }
    .details-title { font-size: 14px; font-weight: 600; }
    .close-btn { width: 28px; height: 28px; border: none; background: transparent; color: #94a3b8; font-size: 18px; cursor: pointer; border-radius: 4px; }
    .close-btn:hover { background: #334155; }
    .details-content { padding: 16px; }
    .details-actions { padding: 12px 16px; border-bottom: 1px solid #334155; display: flex; gap: 8px; }
    .detail-section { margin-bottom: 16px; }
    .detail-section h4 { font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; }
    .detail-item { padding: 8px; background: #0f172a; border-radius: 6px; margin-bottom: 6px; font-size: 13px; cursor: pointer; }
    .detail-item:hover { background: #1e293b; }
    .node-type-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }

    /* Issues Panel */
    .issues-panel { position: absolute; bottom: 0; left: 0; right: 400px; max-height: 200px; background: #1e293b; border-top: 1px solid #334155; transform: translateY(100%); transition: transform 0.3s; overflow-y: auto; }
    .issues-panel.open { transform: translateY(0); }
    .issue-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #334155; cursor: pointer; }
    .issue-item:hover { background: #334155; }
    .issue-severity { width: 8px; height: 8px; border-radius: 50%; }
    .issue-severity.critical { background: #ef4444; }
    .issue-severity.high { background: #f97316; }
    .issue-severity.medium { background: #eab308; }
    .issue-severity.low { background: #22c55e; }

    /* Minimap & Controls */
    .minimap { position: absolute; bottom: 16px; right: 16px; width: 200px; height: 150px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; overflow: hidden; }
    .minimap-canvas { width: 100%; height: 100%; }
    .controls { position: absolute; bottom: 16px; left: 16px; display: flex; flex-direction: column; gap: 8px; }
    .zoom-controls { display: flex; flex-direction: column; background: #1e293b; border: 1px solid #334155; border-radius: 8px; overflow: hidden; }
    .zoom-btn { width: 36px; height: 36px; border: none; background: transparent; color: #e2e8f0; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .zoom-btn:hover { background: #334155; }
    .zoom-btn:first-child { border-bottom: 1px solid #334155; }

    /* Legend */
    .legend { position: absolute; top: 16px; left: 16px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px; font-size: 12px; }
    .legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .legend-item:last-child { margin-bottom: 0; }
    .legend-color { width: 12px; height: 12px; border-radius: 3px; }

    /* Loading & Tooltips */
    .loading-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,23,42,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 3000; }
    .loading-overlay.hidden { display: none; }
    .spinner { width: 48px; height: 48px; border: 4px solid #334155; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-text { margin-top: 16px; color: #94a3b8; }
    .tooltip { position: absolute; padding: 8px 12px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; font-size: 12px; pointer-events: none; z-index: 100; max-width: 250px; }
    .tooltip-title { font-weight: 600; margin-bottom: 4px; }
    .tooltip-type { color: #94a3b8; font-size: 11px; }

    /* Mode Indicator */
    .mode-indicator { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); padding: 8px 16px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; font-size: 13px; display: none; }
    .mode-indicator.active { display: block; }

    /* Search */
    .search-container { position: relative; }
    .search-input { padding: 6px 12px 6px 32px; border: 1px solid #334155; border-radius: 6px; background: #0f172a; color: #e2e8f0; font-size: 13px; width: 200px; }
    .search-input:focus { outline: none; border-color: #3b82f6; }
    .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #64748b; }

    /* Affected nodes highlighting */
    .affected-overlay { position: absolute; pointer-events: none; }
  </style>
</head>
<body>
  <header class="header">
    <h1>\u{1F5FA}\uFE0F CodeBakers Mind Map</h1>
    <div class="header-actions">
      <div class="search-container">
        <span class="search-icon">\u{1F50D}</span>
        <input type="text" class="search-input" placeholder="Search nodes..." id="search-input">
      </div>
      <button class="btn btn-secondary" id="btn-issues">\u26A0\uFE0F Issues</button>
      <button class="btn btn-secondary" id="btn-refresh">\u{1F504} Refresh</button>
    </div>
  </header>

  <div class="stats-bar" id="stats-bar">
    <div class="stat"><span class="stat-value" id="stat-files">-</span><span class="stat-label">Files</span></div>
    <div class="stat"><span class="stat-value" id="stat-nodes">-</span><span class="stat-label">Nodes</span></div>
    <div class="stat"><span class="stat-value" id="stat-edges">-</span><span class="stat-label">Connections</span></div>
    <div class="coherence-score">
      <span class="stat-label">Coherence:</span>
      <div class="coherence-bar"><div class="coherence-fill" id="coherence-fill" style="width: 0%; background: #22c55e;"></div></div>
      <span class="stat-value" id="stat-coherence">-</span>
    </div>
  </div>

  <div class="canvas-container" id="canvas-container">
    <canvas id="mindmap-canvas"></canvas>
    <div class="legend" id="legend">
      <div class="legend-item"><div class="legend-color" style="background: #3b82f6;"></div><span>Component</span></div>
      <div class="legend-item"><div class="legend-color" style="background: #8b5cf6;"></div><span>Type/Interface</span></div>
      <div class="legend-item"><div class="legend-color" style="background: #f59e0b;"></div><span>API Route</span></div>
      <div class="legend-item"><div class="legend-color" style="background: #ec4899;"></div><span>Hook</span></div>
      <div class="legend-item"><div class="legend-color" style="background: #10b981;"></div><span>Function</span></div>
    </div>
    <div class="controls">
      <div class="zoom-controls">
        <button class="zoom-btn" id="zoom-in">+</button>
        <button class="zoom-btn" id="zoom-out">\u2212</button>
      </div>
    </div>
    <div class="minimap"><canvas class="minimap-canvas" id="minimap-canvas"></canvas></div>
    <div class="mode-indicator" id="mode-indicator">\u26A1 Impact Analysis Mode</div>
  </div>

  <!-- Context Menu -->
  <div class="context-menu" id="context-menu">
    <div class="context-menu-item" data-action="open">\u{1F4C4} Open File</div>
    <div class="context-menu-item" data-action="rename">\u270F\uFE0F Rename...</div>
    <div class="context-menu-item" data-action="impact">\u26A1 Analyze Impact</div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" data-action="dependents">\u{1F446} Find Dependents</div>
    <div class="context-menu-item" data-action="dependencies">\u{1F447} Find Dependencies</div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item danger" data-action="delete">\u{1F5D1}\uFE0F Delete (Preview Impact)</div>
  </div>

  <!-- Rename Modal -->
  <div class="modal-overlay" id="rename-modal">
    <div class="modal">
      <div class="modal-header">
        <h2>\u270F\uFE0F Rename</h2>
        <button class="close-btn" id="close-rename">\xD7</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Current Name</label>
          <input type="text" class="form-input" id="rename-old" readonly>
        </div>
        <div class="form-group">
          <label class="form-label">New Name</label>
          <input type="text" class="form-input" id="rename-new" placeholder="Enter new name...">
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 8px;">
          This will analyze the impact before making any changes.
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancel-rename">Cancel</button>
        <button class="btn btn-primary" id="confirm-rename">\u26A1 Analyze Impact</button>
      </div>
    </div>
  </div>

  <!-- Details Panel -->
  <div class="details-panel" id="details-panel">
    <div class="details-header">
      <span class="details-title" id="details-title">Node Details</span>
      <button class="close-btn" id="close-details">\xD7</button>
    </div>
    <div class="details-actions" id="details-actions">
      <button class="btn btn-secondary" id="btn-rename-node">\u270F\uFE0F Rename</button>
      <button class="btn btn-secondary" id="btn-impact-node">\u26A1 Impact</button>
      <button class="btn btn-secondary" id="btn-open-node">\u{1F4C4} Open</button>
    </div>
    <div class="details-content" id="details-content"></div>
  </div>

  <!-- Impact Panel -->
  <div class="impact-panel" id="impact-panel">
    <div class="impact-header">
      <h3>\u26A1 Impact Analysis</h3>
      <button class="close-btn" id="close-impact">\xD7</button>
    </div>
    <div class="impact-content" id="impact-content"></div>
    <div class="impact-footer">
      <button class="btn btn-secondary" id="cancel-impact">Cancel</button>
      <button class="btn btn-success" id="apply-changes" disabled>\u2713 Apply All Changes</button>
    </div>
  </div>

  <!-- Issues Panel -->
  <div class="issues-panel" id="issues-panel">
    <div style="padding: 12px 16px; border-bottom: 1px solid #334155; font-weight: 600;">\u26A0\uFE0F Coherence Issues</div>
    <div id="issues-list"></div>
  </div>

  <!-- Loading Overlay -->
  <div class="loading-overlay" id="loading-overlay">
    <div class="spinner"></div>
    <div class="loading-text" id="loading-text">Analyzing codebase...</div>
  </div>

  <!-- Tooltip -->
  <div class="tooltip" id="tooltip" style="display: none;"></div>

  <script>
    const vscode = acquireVsCodeApi();

    // State
    let graphData = null;
    let selectedNode = null;
    let hoveredNode = null;
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let isPanning = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let draggedNode = null;
    let contextMenuNode = null;
    let currentImpact = null;
    let pendingPatches = [];
    let affectedNodeIds = new Set();

    // Canvas setup
    const container = document.getElementById('canvas-container');
    const canvas = document.getElementById('mindmap-canvas');
    const ctx = canvas.getContext('2d');
    const minimapCanvas = document.getElementById('minimap-canvas');
    const minimapCtx = minimapCanvas.getContext('2d');

    // Node type colors
    const typeColors = {
      file: '#6b7280', component: '#3b82f6', function: '#10b981', type: '#8b5cf6',
      interface: '#8b5cf6', api: '#f59e0b', hook: '#ec4899', context: '#06b6d4',
      class: '#ef4444', enum: '#84cc16', constant: '#f97316', database: '#14b8a6', external: '#9ca3af',
    };

    function resizeCanvas() {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      minimapCanvas.width = 200;
      minimapCanvas.height = 150;
      render();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Main render
    function render() {
      if (!graphData) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);
      for (const edge of graphData.edges) drawEdge(edge);
      for (const node of graphData.nodes) drawNode(node);
      ctx.restore();
      renderMinimap();
    }

    function drawNode(node) {
      const x = node.position.x, y = node.position.y;
      const width = 160, height = 60, radius = 8;
      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNode?.id === node.id;
      const isAffected = affectedNodeIds.has(node.id);

      if (isSelected || isHovered || isAffected) {
        ctx.shadowColor = isAffected ? '#f97316' : (typeColors[node.type] || '#3b82f6');
        ctx.shadowBlur = isAffected ? 20 : 15;
      }

      ctx.fillStyle = isAffected ? '#1e293b' : (isSelected ? '#1e293b' : '#0f172a');
      ctx.strokeStyle = isAffected ? '#f97316' : (typeColors[node.type] || '#3b82f6');
      ctx.lineWidth = isAffected ? 3 : (isSelected ? 3 : (isHovered ? 2 : 1));

      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = isAffected ? '#f97316' : (typeColors[node.type] || '#3b82f6');
      ctx.fillRect(x, y, 4, height);

      const icons = { component: '\u269B\uFE0F', type: 'T', interface: 'I', api: '\u{1F50C}', hook: '\u{1FA9D}', context: '\u{1F310}', function: '\u0192', class: '\u{1F4E6}', file: '\u{1F4C4}' };
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '14px sans-serif';
      ctx.fillText(icons[node.type] || '\u{1F4C4}', x + 12, y + 25);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(node.name.length > 15 ? node.name.slice(0, 15) + '...' : node.name, x + 32, y + 25);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.fillText(node.type.toUpperCase(), x + 32, y + 42);

      if (node.linesOfCode) {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.fillText(node.linesOfCode + ' lines', x + width - 50, y + 42);
      }
    }

    function drawEdge(edge) {
      const sourceNode = graphData.nodes.find(n => n.id === edge.source);
      const targetNode = graphData.nodes.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) return;

      const startX = sourceNode.position.x + 160, startY = sourceNode.position.y + 30;
      const endX = targetNode.position.x, endY = targetNode.position.y + 30;
      const midX = (startX + endX) / 2;

      const isAffectedEdge = affectedNodeIds.has(edge.source) || affectedNodeIds.has(edge.target);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(midX, startY, midX, endY, endX, endY);
      ctx.strokeStyle = isAffectedEdge ? '#f97316' : '#475569';
      ctx.lineWidth = isAffectedEdge ? 2 : 1;
      ctx.stroke();

      const angle = Math.atan2(endY - startY, endX - midX);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - 8 * Math.cos(angle - Math.PI / 6), endY - 8 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(endX - 8 * Math.cos(angle + Math.PI / 6), endY - 8 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = isAffectedEdge ? '#f97316' : '#475569';
      ctx.fill();
    }

    function renderMinimap() {
      if (!graphData || graphData.nodes.length === 0) return;
      minimapCtx.clearRect(0, 0, 200, 150);
      minimapCtx.fillStyle = '#0f172a';
      minimapCtx.fillRect(0, 0, 200, 150);

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of graphData.nodes) {
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + 160);
        maxY = Math.max(maxY, node.position.y + 60);
      }
      const graphWidth = maxX - minX + 100, graphHeight = maxY - minY + 100;
      const scale = Math.min(200 / graphWidth, 150 / graphHeight) * 0.9;

      for (const node of graphData.nodes) {
        minimapCtx.beginPath();
        minimapCtx.arc((node.position.x - minX + 50) * scale, (node.position.y - minY + 50) * scale, 3, 0, Math.PI * 2);
        minimapCtx.fillStyle = affectedNodeIds.has(node.id) ? '#f97316' : (typeColors[node.type] || '#3b82f6');
        minimapCtx.fill();
      }

      minimapCtx.strokeStyle = '#3b82f6';
      minimapCtx.lineWidth = 1;
      minimapCtx.strokeRect((-panX / zoom - minX + 50) * scale, (-panY / zoom - minY + 50) * scale, (canvas.width / zoom) * scale, (canvas.height / zoom) * scale);
    }

    function getNodeAtPosition(x, y) {
      if (!graphData) return null;
      const canvasX = (x - panX) / zoom, canvasY = (y - panY) / zoom;
      for (const node of graphData.nodes) {
        if (canvasX >= node.position.x && canvasX <= node.position.x + 160 && canvasY >= node.position.y && canvasY <= node.position.y + 60) return node;
      }
      return null;
    }

    // Mouse events
    canvas.addEventListener('mousedown', (e) => {
      hideContextMenu();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const node = getNodeAtPosition(x, y);
      if (node) {
        draggedNode = node;
        dragStartX = x - node.position.x * zoom - panX;
        dragStartY = y - node.position.y * zoom - panY;
        isDragging = true;
      } else {
        isPanning = true;
        dragStartX = x - panX;
        dragStartY = y - panY;
      }
      canvas.classList.add('dragging');
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (isDragging && draggedNode) {
        draggedNode.position.x = (x - dragStartX - panX) / zoom;
        draggedNode.position.y = (y - dragStartY - panY) / zoom;
        render();
      } else if (isPanning) {
        panX = x - dragStartX;
        panY = y - dragStartY;
        render();
      } else {
        const node = getNodeAtPosition(x, y);
        if (node !== hoveredNode) {
          hoveredNode = node;
          render();
          const tooltip = document.getElementById('tooltip');
          if (node) {
            tooltip.innerHTML = '<div class="tooltip-title">' + node.name + '</div><div class="tooltip-type">' + node.type.toUpperCase() + ' \u2022 ' + node.path + '</div>';
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
          } else {
            tooltip.style.display = 'none';
          }
        }
      }
    });

    canvas.addEventListener('mouseup', (e) => {
      if (isDragging && draggedNode) {
        vscode.postMessage({ type: 'savePositions', positions: { [draggedNode.id]: draggedNode.position } });
      }
      isDragging = false;
      isPanning = false;
      draggedNode = null;
      canvas.classList.remove('dragging');
    });

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAtPosition(e.clientX - rect.left, e.clientY - rect.top);
      if (node) {
        selectedNode = node;
        showNodeDetails(node);
        render();
      }
    });

    canvas.addEventListener('dblclick', (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAtPosition(e.clientX - rect.left, e.clientY - rect.top);
      if (node) vscode.postMessage({ type: 'openFile', path: node.path });
    });

    // Context menu
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAtPosition(e.clientX - rect.left, e.clientY - rect.top);
      if (node) {
        contextMenuNode = node;
        selectedNode = node;
        showContextMenu(e.clientX, e.clientY);
        render();
      }
    });

    function showContextMenu(x, y) {
      const menu = document.getElementById('context-menu');
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';
      menu.classList.add('show');
    }

    function hideContextMenu() {
      document.getElementById('context-menu').classList.remove('show');
    }

    document.getElementById('context-menu').addEventListener('click', (e) => {
      const item = e.target.closest('.context-menu-item');
      if (!item || !contextMenuNode) return;
      const action = item.dataset.action;

      switch (action) {
        case 'open':
          vscode.postMessage({ type: 'openFile', path: contextMenuNode.path });
          break;
        case 'rename':
          showRenameModal(contextMenuNode);
          break;
        case 'impact':
          analyzeImpact(contextMenuNode, 'rename', contextMenuNode.name, contextMenuNode.name);
          break;
        case 'delete':
          analyzeImpact(contextMenuNode, 'delete');
          break;
        case 'dependents':
          highlightDependents(contextMenuNode);
          break;
        case 'dependencies':
          highlightDependencies(contextMenuNode);
          break;
      }
      hideContextMenu();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.context-menu')) hideContextMenu();
    });

    // Rename modal
    function showRenameModal(node) {
      document.getElementById('rename-old').value = node.name;
      document.getElementById('rename-new').value = '';
      document.getElementById('rename-modal').classList.add('show');
      document.getElementById('rename-new').focus();
    }

    document.getElementById('close-rename').addEventListener('click', () => document.getElementById('rename-modal').classList.remove('show'));
    document.getElementById('cancel-rename').addEventListener('click', () => document.getElementById('rename-modal').classList.remove('show'));

    document.getElementById('confirm-rename').addEventListener('click', () => {
      const newName = document.getElementById('rename-new').value.trim();
      if (!newName || !selectedNode) return;
      document.getElementById('rename-modal').classList.remove('show');
      analyzeImpact(selectedNode, 'rename', selectedNode.name, newName);
    });

    document.getElementById('rename-new').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('confirm-rename').click();
    });

    // Impact analysis
    function analyzeImpact(node, changeType, before, after) {
      setLoading(true, 'Analyzing impact...');
      document.getElementById('mode-indicator').classList.add('active');

      const change = { nodeId: node.id, changeType, before, after };
      vscode.postMessage({ type: 'analyzeImpact', change });
    }

    function showImpactPanel(impact) {
      currentImpact = impact;
      const panel = document.getElementById('impact-panel');
      const content = document.getElementById('impact-content');
      const targetNode = graphData.nodes.find(n => n.id === impact.targetNode);

      // Highlight affected nodes
      affectedNodeIds.clear();
      affectedNodeIds.add(impact.targetNode);
      impact.directImpact.forEach(n => affectedNodeIds.add(n.nodeId));
      impact.transitiveImpact.forEach(n => affectedNodeIds.add(n.nodeId));
      render();

      let html = '<div class="impact-section"><h4>\u{1F4CD} Target</h4>';
      html += '<div class="impact-item"><strong>' + (targetNode?.name || impact.targetNode) + '</strong>';
      html += '<div class="path">' + impact.change.changeType + ': ' + (impact.change.before || '') + ' \u2192 ' + (impact.change.after || 'deleted') + '</div></div></div>';

      html += '<div class="impact-section"><h4>\u26A0\uFE0F Risk Level</h4>';
      html += '<span class="risk-badge ' + impact.riskLevel + '">' + impact.riskLevel + '</span></div>';

      if (impact.breakingChanges.length > 0) {
        html += '<div class="impact-section"><h4>\u{1F534} Breaking Changes (' + impact.breakingChanges.length + ')</h4>';
        impact.breakingChanges.forEach(bc => {
          html += '<div class="impact-item breaking" onclick="focusNode(\\''+bc.nodeId+'\\')">';
          html += '<strong>' + bc.reason + '</strong>';
          html += '<div class="path">' + bc.path + ':' + bc.line + '</div>';
          html += '<div class="patch-preview"><div class="patch-line remove">- ' + escapeHtml(bc.currentCode.trim()) + '</div></div>';
          html += '</div>';
        });
        html += '</div>';
      }

      if (impact.directImpact.length > 0) {
        html += '<div class="impact-section"><h4>\u{1F7E1} Direct Impact (' + impact.directImpact.length + ')</h4>';
        impact.directImpact.forEach(di => {
          html += '<div class="impact-item warning" onclick="focusNode(\\''+di.nodeId+'\\')">';
          html += '<strong>' + di.nodeName + '</strong>';
          html += '<div class="path">' + di.path + '</div>';
          html += '<div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">' + di.description + '</div>';
          html += '</div>';
        });
        html += '</div>';
      }

      if (impact.suggestedFixes.length > 0) {
        html += '<div class="impact-section"><h4>\u{1F527} Suggested Fixes (' + impact.suggestedFixes.length + ')</h4>';
        pendingPatches = impact.suggestedFixes.filter(f => f.autoFixable);
        impact.suggestedFixes.forEach(fix => {
          html += '<div class="impact-item" onclick="focusNode(\\''+fix.nodeId+'\\')">';
          html += '<strong>' + fix.description + '</strong>';
          html += '<div class="path">' + fix.path + ':' + fix.line + '</div>';
          if (fix.autoFixable) {
            html += '<div class="patch-preview">';
            html += '<div class="patch-line remove">- ' + escapeHtml(fix.oldCode.trim()) + '</div>';
            html += '<div class="patch-line add">+ ' + escapeHtml(fix.newCode.trim()) + '</div>';
            html += '</div>';
            html += '<div style="color: #22c55e; font-size: 11px; margin-top: 4px;">\u2713 Auto-fixable</div>';
          } else {
            html += '<div style="color: #f59e0b; font-size: 11px; margin-top: 4px;">\u26A0 Manual fix required</div>';
          }
          html += '</div>';
        });
        html += '</div>';
      }

      if (impact.transitiveImpact.length > 0) {
        html += '<div class="impact-section"><h4>\u{1F535} Transitive Impact (' + impact.transitiveImpact.length + ')</h4>';
        impact.transitiveImpact.slice(0, 10).forEach(ti => {
          html += '<div class="impact-item" onclick="focusNode(\\''+ti.nodeId+'\\')">' + ti.nodeName + '<div class="path">' + ti.description + '</div></div>';
        });
        if (impact.transitiveImpact.length > 10) html += '<div style="color: #94a3b8; padding: 8px;">...and ' + (impact.transitiveImpact.length - 10) + ' more</div>';
        html += '</div>';
      }

      content.innerHTML = html;
      document.getElementById('apply-changes').disabled = pendingPatches.length === 0;
      document.getElementById('apply-changes').textContent = pendingPatches.length > 0 ? '\u2713 Apply ' + pendingPatches.length + ' Changes' : 'No Auto-fixes';
      panel.classList.add('open');
      document.getElementById('details-panel').classList.remove('open');
    }

    function escapeHtml(text) {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    window.focusNode = function(nodeId) {
      const node = graphData.nodes.find(n => n.id === nodeId);
      if (node) {
        panX = canvas.width / 2 - node.position.x * zoom - 80;
        panY = canvas.height / 2 - node.position.y * zoom - 30;
        selectedNode = node;
        render();
      }
    };

    document.getElementById('close-impact').addEventListener('click', closeImpactPanel);
    document.getElementById('cancel-impact').addEventListener('click', closeImpactPanel);

    function closeImpactPanel() {
      document.getElementById('impact-panel').classList.remove('open');
      document.getElementById('mode-indicator').classList.remove('active');
      affectedNodeIds.clear();
      currentImpact = null;
      pendingPatches = [];
      render();
    }

    document.getElementById('apply-changes').addEventListener('click', () => {
      if (pendingPatches.length === 0) return;
      setLoading(true, 'Applying changes...');
      vscode.postMessage({ type: 'applyChanges', patches: pendingPatches });
    });

    // Highlight dependents/dependencies
    function highlightDependents(node) {
      affectedNodeIds.clear();
      affectedNodeIds.add(node.id);
      graphData.edges.filter(e => e.target === node.id).forEach(e => affectedNodeIds.add(e.source));
      document.getElementById('mode-indicator').textContent = '\u{1F446} ' + (affectedNodeIds.size - 1) + ' nodes depend on ' + node.name;
      document.getElementById('mode-indicator').classList.add('active');
      render();
    }

    function highlightDependencies(node) {
      affectedNodeIds.clear();
      affectedNodeIds.add(node.id);
      graphData.edges.filter(e => e.source === node.id).forEach(e => affectedNodeIds.add(e.target));
      document.getElementById('mode-indicator').textContent = '\u{1F447} ' + node.name + ' depends on ' + (affectedNodeIds.size - 1) + ' nodes';
      document.getElementById('mode-indicator').classList.add('active');
      render();
    }

    // Node details panel
    function showNodeDetails(node) {
      const panel = document.getElementById('details-panel');
      const title = document.getElementById('details-title');
      const content = document.getElementById('details-content');
      title.textContent = node.name;

      let html = '<div class="detail-section"><span class="node-type-badge" style="background: ' + typeColors[node.type] + '33; color: ' + typeColors[node.type] + ';">' + node.type + '</span></div>';
      html += '<div class="detail-section"><h4>File</h4><div class="detail-item" onclick="openFile(\\'' + node.path + '\\')">' + node.path + '</div></div>';
      if (node.linesOfCode) html += '<div class="detail-section"><h4>Size</h4><div>' + node.linesOfCode + ' lines</div></div>';
      if (node.exports?.length) {
        html += '<div class="detail-section"><h4>Exports (' + node.exports.length + ')</h4>';
        node.exports.forEach(e => html += '<div class="detail-item">' + e.name + ' (' + e.type + ')</div>');
        html += '</div>';
      }
      if (node.imports?.length) {
        html += '<div class="detail-section"><h4>Imports (' + node.imports.length + ')</h4>';
        node.imports.forEach(i => html += '<div class="detail-item">' + i.name + ' from ' + i.from + '</div>');
        html += '</div>';
      }
      if (node.props?.length) {
        html += '<div class="detail-section"><h4>Props (' + node.props.length + ')</h4>';
        node.props.forEach(p => html += '<div class="detail-item">' + p.name + (p.required ? '' : '?') + ': ' + p.type + '</div>');
        html += '</div>';
      }
      if (node.hooks?.length) {
        html += '<div class="detail-section"><h4>Hooks (' + node.hooks.length + ')</h4>';
        node.hooks.forEach(h => html += '<div class="detail-item">' + h + '</div>');
        html += '</div>';
      }
      content.innerHTML = html;
      panel.classList.add('open');
    }

    window.openFile = function(path) { vscode.postMessage({ type: 'openFile', path }); };

    document.getElementById('close-details').addEventListener('click', () => {
      document.getElementById('details-panel').classList.remove('open');
      selectedNode = null;
      render();
    });

    document.getElementById('btn-rename-node').addEventListener('click', () => { if (selectedNode) showRenameModal(selectedNode); });
    document.getElementById('btn-impact-node').addEventListener('click', () => { if (selectedNode) analyzeImpact(selectedNode, 'rename', selectedNode.name, selectedNode.name); });
    document.getElementById('btn-open-node').addEventListener('click', () => { if (selectedNode) vscode.postMessage({ type: 'openFile', path: selectedNode.path }); });

    // Zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(3, zoom * delta));
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
      panX = mouseX - (mouseX - panX) * (newZoom / zoom);
      panY = mouseY - (mouseY - panY) * (newZoom / zoom);
      zoom = newZoom;
      render();
    });

    document.getElementById('zoom-in').addEventListener('click', () => { zoom = Math.min(3, zoom * 1.2); render(); });
    document.getElementById('zoom-out').addEventListener('click', () => { zoom = Math.max(0.1, zoom * 0.8); render(); });

    // Issues
    document.getElementById('btn-issues').addEventListener('click', () => document.getElementById('issues-panel').classList.toggle('open'));

    function showIssues(issues) {
      const list = document.getElementById('issues-list');
      if (!issues?.length) { list.innerHTML = '<div style="padding: 16px; color: #94a3b8;">No issues found! \u{1F389}</div>'; return; }
      list.innerHTML = issues.map(issue => '<div class="issue-item" data-nodes="' + issue.nodeIds.join(',') + '"><div class="issue-severity ' + issue.severity + '"></div><div><div style="font-weight: 500;">' + issue.message + '</div>' + (issue.suggestion ? '<div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">\u{1F4A1} ' + issue.suggestion + '</div>' : '') + '</div></div>').join('');
      list.querySelectorAll('.issue-item').forEach(item => {
        item.addEventListener('click', () => {
          const nodeIds = item.dataset.nodes.split(',');
          if (nodeIds[0]) focusNode(nodeIds[0]);
        });
      });
    }

    // Search
    document.getElementById('search-input').addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      if (!query || !graphData) { affectedNodeIds.clear(); render(); return; }
      const matches = graphData.nodes.filter(n => n.name.toLowerCase().includes(query) || n.path.toLowerCase().includes(query));
      affectedNodeIds.clear();
      matches.forEach(m => affectedNodeIds.add(m.id));
      if (matches.length > 0) focusNode(matches[0].id);
      render();
    });

    // Refresh
    document.getElementById('btn-refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));

    // Loading
    function setLoading(show, text) {
      const overlay = document.getElementById('loading-overlay');
      document.getElementById('loading-text').textContent = text || 'Loading...';
      if (show) overlay.classList.remove('hidden');
      else overlay.classList.add('hidden');
    }

    function updateStats(metadata) {
      document.getElementById('stat-files').textContent = metadata.totalFiles;
      document.getElementById('stat-nodes').textContent = metadata.totalNodes;
      document.getElementById('stat-edges').textContent = metadata.totalEdges;
      document.getElementById('stat-coherence').textContent = metadata.coherenceScore + '%';
      const fill = document.getElementById('coherence-fill');
      fill.style.width = metadata.coherenceScore + '%';
      fill.style.background = metadata.coherenceScore >= 80 ? '#22c55e' : (metadata.coherenceScore >= 60 ? '#eab308' : '#ef4444');
    }

    // Messages from extension
    window.addEventListener('message', (event) => {
      const message = event.data;
      switch (message.type) {
        case 'init':
          graphData = message.data;
          updateStats(message.data.metadata);
          showIssues(message.data.metadata.issues);
          setLoading(false);
          render();
          break;
        case 'loading':
          setLoading(message.isLoading, message.text);
          break;
        case 'error':
          setLoading(false);
          alert('Error: ' + message.message);
          break;
        case 'impactResult':
          setLoading(false);
          showImpactPanel(message.data);
          break;
        case 'propagationResult':
          setLoading(false);
          if (message.data.success) {
            alert('\u2713 Applied ' + message.data.patchesApplied.length + ' changes successfully!\\n\\nModified files:\\n' + message.data.filesModified.join('\\n'));
            closeImpactPanel();
          } else {
            alert('\u26A0 Some changes failed:\\n' + message.data.errors.join('\\n'));
          }
          break;
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`}dispose(){for(n.currentPanel=void 0,this._panel.dispose();this._disposables.length;){let e=this._disposables.pop();e&&e.dispose()}}}});var $r={};At($r,{DependencyGraph:()=>Xa,MindMapPanelProvider:()=>Ro,PropagationEngine:()=>Ka});var Or=f(()=>{"use strict";uc();Fr();Lr();fc()});var jr,zr,Vr=f(()=>{"use strict";jr={page:{type:"page",description:"A screen users can visit. Like the homepage, login page, or dashboard. Each page has its own URL (e.g., /about, /settings).",details:{route:"/",isProtected:!1}},component:{type:"component",description:"A reusable building block for your pages. Like a button, card, or navigation bar. Build once, use anywhere.",details:{props:[],hasState:!1}},api:{type:"api",description:"A backend endpoint that handles data. When users submit a form, log in, or load their profile, an API handles it behind the scenes.",details:{httpMethod:"GET",requestBody:[],requiresAuth:!0}},database:{type:"database",description:"A table to store your data permanently. Like a spreadsheet that saves users, orders, or posts. Your app reads from and writes to this.",details:{columns:[],relations:[]}},type:{type:"type",description:'A blueprint that defines the shape of your data. Like saying "a User has a name, email, and age". Helps prevent bugs.',details:{fields:[]}},hook:{type:"hook",description:'Reusable logic for your components. Like "fetch user data" or "track form input". Write the logic once, use it in any component.',details:{dependencies:[]}},service:{type:"service",description:"A helper module that does a specific job. Like sending emails, processing payments, or talking to external services. Keeps your code organized.",details:{methods:[]}},middleware:{type:"middleware",description:"A security checkpoint that runs before pages load. Checks if users are logged in, have permission, or blocks bad requests.",details:{}},context:{type:"context",description:"Shared data that many components can access. Like the current user, theme (dark/light), or language. No need to pass it manually everywhere.",details:{}},action:{type:"action",description:"A function that runs on the server when users submit forms. Handles things like creating posts, updating profiles, or processing orders securely.",details:{formFields:[]}},job:{type:"job",description:"A task that runs automatically in the background. Like sending weekly emails, cleaning up old data, or syncing with other services.",details:{}}},zr={page:{bg:"#dbeafe",border:"#3b82f6",icon:"\u{1F4C4}"},component:{bg:"#dcfce7",border:"#22c55e",icon:"\u{1F9E9}"},api:{bg:"#fef3c7",border:"#f59e0b",icon:"\u{1F50C}"},database:{bg:"#fce7f3",border:"#ec4899",icon:"\u{1F5C4}\uFE0F"},type:{bg:"#e0e7ff",border:"#6366f1",icon:"\u{1F4DD}"},hook:{bg:"#f3e8ff",border:"#a855f7",icon:"\u{1FA9D}"},service:{bg:"#ccfbf1",border:"#14b8a6",icon:"\u2699\uFE0F"},middleware:{bg:"#fed7aa",border:"#f97316",icon:"\u{1F500}"},context:{bg:"#cffafe",border:"#06b6d4",icon:"\u{1F310}"},action:{bg:"#fecaca",border:"#ef4444",icon:"\u26A1"},job:{bg:"#e5e7eb",border:"#6b7280",icon:"\u23F0"}}});var vc,Ja,Ur=f(()=>{"use strict";vc=L(require("vscode")),Ja=class{constructor(e={}){this.conversationContext=[];console.log("AIPlanner: Initializing...");try{this.config={proactivityLevel:"balanced",autoSuggestConnections:!0,warnMissingPatterns:!0,projectType:"nextjs",patterns:[],...e};let t=vc.workspace.getConfiguration("codebakers");this.apiEndpoint=t.get("apiEndpoint")||"https://www.codebakers.ai",console.log("AIPlanner: Initialized with endpoint:",this.apiEndpoint)}catch(t){let a=t instanceof Error?t.message:String(t);console.error("AIPlanner: Initialization failed:",a),this.config={proactivityLevel:"balanced",autoSuggestConnections:!0,warnMissingPatterns:!0,projectType:"nextjs",patterns:[]},this.apiEndpoint="https://www.codebakers.ai"}}async chat(e,t){console.log("AIPlanner: Processing chat message, length:",e.length);let a=`msg_${Date.now()}`;try{console.log("AIPlanner: Building plan context...");let s=this.buildPlanContext(t),o=this.detectIntent(e,t);console.log("AIPlanner: Detected intent:",o);let i,r=[];try{console.log("AIPlanner: Calling AI API...");let p=await this.callAI(e,s,o,t);i=p.message,r=p.actions,console.log("AIPlanner: AI response received, actions:",r.length)}catch(p){let l=p instanceof Error?p.message:String(p);console.error("AIPlanner: Error calling AI:",l),console.log("AIPlanner: Using fallback response"),i=this.generateFallbackResponse(e,t,o),r=this.generateFallbackActions(o,t)}let d={id:a,role:"assistant",content:i,timestamp:Date.now(),suggestedActions:r};return this.conversationContext.push(`User: ${e}`),this.conversationContext.push(`Assistant: ${i}`),this.conversationContext.length>20&&(console.log("AIPlanner: Trimming conversation context"),this.conversationContext=this.conversationContext.slice(-20)),console.log("AIPlanner: Chat completed successfully"),d}catch(s){let o=s instanceof Error?s.message:String(s);return console.error("AIPlanner: Chat processing failed:",o),console.error("AIPlanner: Stack:",s instanceof Error?s.stack:"No stack"),{id:a,role:"assistant",content:"I'm having trouble processing that right now. Could you try rephrasing your request?",timestamp:Date.now(),suggestedActions:[]}}}async getInitialGreeting(e){console.log("AIPlanner: Generating initial greeting, plan nodes:",e.nodes.length);let t=`msg_${Date.now()}`;try{let a,s=[];if(e.nodes.length===0)console.log("AIPlanner: Empty plan, showing welcome message"),a=`Hey! I'm here to help you plan your build. Let's figure out what you're making together.

**What are you building?** Give me the quick pitch - what's this app supposed to do?

Or if you want to get started faster, pick a template:`,s=[{id:"tpl_saas",type:"use-template",label:"SaaS Starter",description:"Auth, billing, dashboard, settings",payload:{templateId:"saas-starter"},status:"pending"},{id:"tpl_ecom",type:"use-template",label:"E-commerce",description:"Products, cart, checkout, orders",payload:{templateId:"ecommerce"},status:"pending"},{id:"tpl_dash",type:"use-template",label:"Admin Dashboard",description:"Data tables, charts, CRUD",payload:{templateId:"dashboard"},status:"pending"}];else{console.log("AIPlanner: Resuming existing plan");let o=[...new Set(e.nodes.map(r=>r.type))];a=`Welcome back! You've got ${e.nodes.length} pieces planned: ${o.join(", ")}.

What do you want to work on next?`;let i=this.analyzePlanCompleteness(e);console.log("AIPlanner: Found",i.length,"improvement suggestions"),i.length>0&&(a+=`

**I noticed some things you might want to add:**`,i.slice(0,3).forEach(r=>{a+=`
- ${r.title}`}))}return console.log("AIPlanner: Initial greeting generated"),{id:t,role:"assistant",content:a,timestamp:Date.now(),suggestedActions:s}}catch(a){let s=a instanceof Error?a.message:String(a);return console.error("AIPlanner: Failed to generate greeting:",s),{id:t,role:"assistant",content:"Hey! I'm here to help you plan your build. What are you building?",timestamp:Date.now(),suggestedActions:[]}}}analyzeAndSuggest(e){console.log("AIPlanner: Analyzing plan for suggestions...");let t=[];try{let a=e.nodes.some(p=>p.name.toLowerCase().includes("auth")||p.name.toLowerCase().includes("login")),s=e.nodes.some(p=>p.type==="api"),o=e.nodes.some(p=>p.type==="database"),i=e.nodes.some(p=>p.type==="page"),r=e.nodes.some(p=>p.name.toLowerCase().includes("error")||p.type==="middleware");if(console.log("AIPlanner: Plan analysis - hasAuth:",a,"hasApi:",s,"hasDatabase:",o),s&&!a&&t.push({id:`sug_${Date.now()}_auth`,type:"missing-piece",severity:"warning",title:"No authentication detected",description:"You have API routes but no auth. Should I add login/signup pages and auth middleware?",suggestedNodes:[{type:"page",name:"LoginPage",description:"User login page",details:{route:"/login",isProtected:!1}},{type:"page",name:"SignupPage",description:"User registration page",details:{route:"/signup",isProtected:!1}},{type:"middleware",name:"authMiddleware",description:"Protects routes requiring authentication"}],dismissed:!1,createdAt:Date.now()}),o){let p=e.nodes.filter(m=>m.type==="database"),l=e.nodes.filter(m=>m.type==="type"),c=p.filter(m=>!l.some(u=>u.name.toLowerCase().includes(m.name.toLowerCase())));c.length>0&&t.push({id:`sug_${Date.now()}_types`,type:"improvement",severity:"info",title:"Missing TypeScript types for database models",description:`You have ${c.length} database table(s) without matching types. Want me to create types for ${c.map(m=>m.name).join(", ")}?`,suggestedNodes:c.map(m=>({type:"type",name:`${m.name}Type`,description:`Type for ${m.name} table`,details:{fields:m.details.columns?.map(u=>({name:u.name,type:this.sqlToTsType(u.type),required:u.required}))}})),dismissed:!1,createdAt:Date.now()})}if(i&&e.nodes.length>=3){let p=e.nodes.filter(c=>c.type==="page");!e.nodes.some(c=>c.name.toLowerCase().includes("layout")||c.name.toLowerCase().includes("shell"))&&p.length>=2&&t.push({id:`sug_${Date.now()}_layout`,type:"improvement",severity:"info",title:"Consider adding a shared layout",description:"You have multiple pages but no shared layout. Want me to add a layout component with navigation?",suggestedNodes:[{type:"component",name:"AppLayout",description:"Shared layout with navigation and footer",details:{props:[{name:"children",type:"React.ReactNode",required:!0}]}}],dismissed:!1,createdAt:Date.now()})}s&&!r&&t.push({id:`sug_${Date.now()}_errors`,type:"warning",severity:"warning",title:"No error handling detected",description:"Your API routes need error handling. Should I add an error boundary and API error middleware?",suggestedNodes:[{type:"middleware",name:"errorHandler",description:"Catches and formats API errors"},{type:"component",name:"ErrorBoundary",description:"Catches React rendering errors"}],dismissed:!1,createdAt:Date.now()});let d=e.nodes.filter(p=>p.type==="api"&&p.details.httpMethod&&["POST","PUT","PATCH","DELETE"].includes(p.details.httpMethod));return d.length>0&&(e.nodes.some(l=>l.type==="service"&&(l.name.toLowerCase().includes("valid")||l.name.toLowerCase().includes("schema")))||t.push({id:`sug_${Date.now()}_validation`,type:"improvement",severity:"info",title:"Add input validation",description:"You have APIs that accept data. Consider adding Zod schemas for validation.",suggestedNodes:[{type:"service",name:"validationSchemas",description:"Zod schemas for API input validation",details:{methods:d.map(l=>({name:`${l.name}Schema`,params:"",returnType:"z.ZodSchema",isAsync:!1}))}}],dismissed:!1,createdAt:Date.now()})),console.log("AIPlanner: Generated",t.length,"suggestions"),t}catch(a){let s=a instanceof Error?a.message:String(a);return console.error("AIPlanner: Failed to analyze plan:",s),[]}}suggestConnectionsForNode(e,t){console.log("AIPlanner: Suggesting connections for node:",e.name,"type:",e.type);try{if(!this.config.autoSuggestConnections)return console.log("AIPlanner: Auto-suggest connections disabled"),[];let a=[];switch(e.type){case"page":t.filter(s=>s.type==="component").forEach(s=>{this.areRelated(e.name,s.name)&&a.push({id:`edge_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,source:e.id,target:s.id,type:"renders",aiGenerated:!0,aiNotes:`${e.name} likely renders ${s.name}`})}),t.filter(s=>s.type==="api").forEach(s=>{this.areRelated(e.name,s.name)&&a.push({id:`edge_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,source:e.id,target:s.id,type:"calls",aiGenerated:!0,aiNotes:`${e.name} likely calls ${s.name}`})});break;case"api":t.filter(s=>s.type==="database").forEach(s=>{if(this.areRelated(e.name,s.name)){let o=e.details.httpMethod==="GET"?"queries":"mutates";a.push({id:`edge_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,source:e.id,target:s.id,type:o,aiGenerated:!0,aiNotes:`${e.name} ${o} ${s.name}`})}});break;case"component":t.filter(s=>s.type==="hook").forEach(s=>{this.areRelated(e.name,s.name)&&a.push({id:`edge_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,source:e.id,target:s.id,type:"uses",aiGenerated:!0,aiNotes:`${e.name} might use ${s.name}`})});break;case"hook":t.filter(s=>s.type==="api"||s.type==="service").forEach(s=>{this.areRelated(e.name,s.name)&&a.push({id:`edge_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,source:e.id,target:s.id,type:"calls",aiGenerated:!0,aiNotes:`${e.name} might call ${s.name}`})});break}return console.log("AIPlanner: Suggested",a.length,"connections"),a}catch(a){let s=a instanceof Error?a.message:String(a);return console.error("AIPlanner: Failed to suggest connections:",s),[]}}autoFillNodeDetails(e,t){console.log("AIPlanner: Auto-filling details for node:",e.name,"type:",e.type);try{let a={};switch(e.type){case"page":if(!e.details.route){let i=this.nameToRoute(e.name);a.route=i}t.nodes.some(i=>i.name.toLowerCase().includes("auth")||i.name.toLowerCase().includes("login"))&&!e.name.toLowerCase().includes("login")&&(a.isProtected=!0);break;case"api":if(!e.details.httpMethod){let i=e.name.toLowerCase();i.includes("create")||i.includes("add")||i.includes("post")?a.httpMethod="POST":i.includes("update")||i.includes("edit")?a.httpMethod="PUT":i.includes("delete")||i.includes("remove")?a.httpMethod="DELETE":a.httpMethod="GET"}break;case"database":e.details.tableName||(a.tableName=this.nameToTableName(e.name)),(!e.details.columns||e.details.columns.length===0)&&(a.columns=[{name:"id",type:"serial",required:!0,description:"Primary key"},{name:"created_at",type:"timestamp",required:!0},{name:"updated_at",type:"timestamp",required:!0}]);break;case"component":let o=t.nodes.find(i=>i.type==="database"&&this.areRelated(e.name,i.name));o&&(!e.details.props||e.details.props.length===0)&&(a.props=[{name:o.name.toLowerCase(),type:`${o.name}Type`,required:!0}]);break}return console.log("AIPlanner: Auto-filled details:",Object.keys(a)),a}catch(a){let s=a instanceof Error?a.message:String(a);return console.error("AIPlanner: Failed to auto-fill details:",s),{}}}buildPlanContext(e){let t=[`Project Type: ${this.config.projectType||"nextjs"}`,`Total Nodes: ${e.nodes.length}`,`Total Connections: ${e.edges.length}`,"","Current Architecture:"],a=new Map;return e.nodes.forEach(s=>{let o=a.get(s.type)||[];o.push(s),a.set(s.type,o)}),a.forEach((s,o)=>{t.push(`
${o.toUpperCase()}S:`),s.forEach(i=>{t.push(`  - ${i.name}: ${i.description}`),i.type==="api"&&i.details.httpMethod&&t.push(`    Method: ${i.details.httpMethod}`),i.type==="database"&&i.details.columns&&t.push(`    Columns: ${i.details.columns.map(r=>r.name).join(", ")}`)})}),e.edges.length>0&&(t.push(`
Connections:`),e.edges.forEach(s=>{let o=e.nodes.find(r=>r.id===s.source),i=e.nodes.find(r=>r.id===s.target);o&&i&&t.push(`  - ${o.name} --[${s.type}]--> ${i.name}`)})),t.join(`
`)}detectIntent(e,t){let a=e.toLowerCase();return a.includes("generate")||a.includes("build")||a.includes("let's go")?"generate":a.includes("review")||a.includes("check")||a.includes("ready")?"review":a.includes("add")||a.includes("create")||a.includes("need")||a.includes("want")?"add":a.includes("change")||a.includes("update")||a.includes("modify")?"modify":a.includes("?")||a.includes("what")||a.includes("how")?"question":"describe"}async callAI(e,t,a,s){let o=`You are an AI architect helping users design their application architecture. You're collaborative and proactive.

Your personality:
- You ASK questions to understand their goals
- You SUGGEST missing pieces they might need
- You WARN about potential issues
- You're friendly but efficient

Current plan context:
${t}

Recent conversation:
${this.conversationContext.slice(-6).join(`
`)}

User's intent appears to be: ${a}

Response format:
- Be concise (2-3 paragraphs max)
- If suggesting additions, describe them clearly
- Ask follow-up questions when needed
- Use markdown for formatting`;try{let i=await fetch(`${this.apiEndpoint}/api/ai/planner`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemPrompt:o,userMessage:e,plan:{nodes:s.nodes.map(r=>({type:r.type,name:r.name})),edges:s.edges.length}})});if(i.ok){let r=await i.json();return{message:r.message,actions:r.suggestedActions||[]}}}catch(i){console.error("AIPlanner: API call failed:",i)}return{message:this.generateFallbackResponse(e,s,a),actions:this.generateFallbackActions(a,s)}}generateFallbackResponse(e,t,a){switch(a){case"describe":return`Got it! Let me help you map that out.

Based on what you described, we might need:
- **Pages** for the main user flows
- **API routes** to handle data
- **Database tables** to store information

What's the most important feature to start with?`;case"add":return`Sure, I can help add that!

Click anywhere on the canvas to add a node, or tell me more about what you need and I'll suggest the right components.

What type of piece is this - a page users see, an API endpoint, or something else?`;case"generate":if(t.nodes.length===0)return"Let's add some architecture first before generating code. What are you building?";let s=this.analyzePlanCompleteness(t);return s.length>0?`Before we generate, I noticed a few things:

${s.map(o=>`- ${o.title}`).join(`
`)}

Want me to add these, or should we proceed anyway?`:`Your plan looks good! Ready to generate ${t.nodes.length} files. Click the Generate button to start.`;case"review":return this.generateReviewResponse(t);default:return`I'm here to help you plan! You can:
- Describe what you're building
- Add nodes to the canvas
- Ask me to suggest architecture

What would you like to do?`}}generateReviewResponse(e){let t=this.analyzePlanCompleteness(e),a=e.nodes.length,s=e.edges.length;if(a===0)return"There's nothing to review yet. Start by telling me what you're building!";let o=`**Plan Review**

`;return o+=`\u{1F4E6} ${a} components planned
`,o+=`\u{1F517} ${s} connections

`,t.length===0?(o+=`\u2705 Looking good! No obvious issues detected.

`,o+="Ready to generate code?"):(o+=`\u26A0\uFE0F Found ${t.length} suggestion(s):

`,t.forEach((i,r)=>{o+=`${r+1}. **${i.title}**
   ${i.description}

`}),o+="Want me to add these, or proceed as-is?"),o}generateFallbackActions(e,t){let a=[];return(e==="add"||t.nodes.length===0&&e==="describe")&&a.push({id:`act_page_${Date.now()}`,type:"add-node",label:"Add a Page",description:"Add a new page to your app",payload:{nodeType:"page"},status:"pending"},{id:`act_api_${Date.now()}`,type:"add-node",label:"Add an API",description:"Add an API endpoint",payload:{nodeType:"api"},status:"pending"},{id:`act_db_${Date.now()}`,type:"add-node",label:"Add a Table",description:"Add a database table",payload:{nodeType:"database"},status:"pending"}),e==="generate"&&t.nodes.length>0&&a.push({id:`act_gen_${Date.now()}`,type:"generate",label:"Generate All",description:`Generate ${t.nodes.length} files`,payload:{dryRun:!1},status:"pending"}),a}analyzePlanCompleteness(e){return this.analyzeAndSuggest(e).filter(t=>t.severity!=="info")}areRelated(e,t){let a=i=>i.toLowerCase().replace(/page|component|api|table|type|hook|service/gi,"").replace(/[^a-z]/g,""),s=a(e),o=a(t);return s.includes(o)||o.includes(s)||s===o}nameToRoute(e){return"/"+e.replace(/Page$/,"").replace(/([a-z])([A-Z])/g,"$1-$2").toLowerCase()}nameToTableName(e){return e.replace(/Table$/,"").replace(/([a-z])([A-Z])/g,"$1_$2").toLowerCase()+"s"}sqlToTsType(e){return{serial:"number",integer:"number",int:"number",bigint:"number",text:"string",varchar:"string",boolean:"boolean",timestamp:"Date",date:"Date",json:"Record<string, unknown>",jsonb:"Record<string, unknown>"}[e.toLowerCase()]||"unknown"}}});var Xt,_e,Za,qr=f(()=>{"use strict";Xt=L(require("vscode")),_e=L(require("path")),Za=class{constructor(){console.log("CodeGenerator: Initializing...");try{let e=Xt.workspace.workspaceFolders;this.workspaceRoot=e?.[0]?.uri.fsPath||"";let t=Xt.workspace.getConfiguration("codebakers");this.apiEndpoint=t.get("apiEndpoint")||"https://www.codebakers.ai",console.log("CodeGenerator: Initialized with workspace:",this.workspaceRoot||"(no workspace)")}catch(e){let t=e instanceof Error?e.message:String(e);console.error("CodeGenerator: Initialization failed:",t),this.workspaceRoot="",this.apiEndpoint="https://www.codebakers.ai"}}async generate(e,t,a){console.log("CodeGenerator: Starting generation, dryRun:",t.dryRun,"usePatterns:",t.usePatterns);let s=Date.now(),o=[],i=[];try{let r=t.nodes.length>0?e.nodes.filter(l=>t.nodes.includes(l.id)):e.nodes;console.log("CodeGenerator: Generating",r.length,"nodes");let d=this.sortByDependency(r,e);console.log("CodeGenerator: Sorted nodes by dependency order");for(let l of d)try{console.log("CodeGenerator: Generating node:",l.name,"type:",l.type),a?.(l.id,"generating");let c=await this.generateNode(l,e,t.usePatterns);console.log("CodeGenerator: Generated file:",c.path),t.dryRun?c.status="pending":(console.log("CodeGenerator: Writing file to disk..."),await this.writeFile(c),c.status="written",console.log("CodeGenerator: File written successfully")),o.push(c),a?.(l.id,"done",c)}catch(c){let m=c instanceof Error?c.message:String(c);console.error("CodeGenerator: Failed to generate node:",l.name,"error:",m),i.push({nodeId:l.id,error:m}),a?.(l.id,"error",{path:"",content:"",nodeId:l.id,status:"error",error:m})}let p=Date.now()-s;return console.log("CodeGenerator: Generation completed in",p,"ms,",o.length,"files,",i.length,"errors"),{success:i.length===0,files:o,errors:i,duration:p}}catch(r){let d=r instanceof Error?r.message:String(r);return console.error("CodeGenerator: Generation failed:",d),console.error("CodeGenerator: Stack:",r instanceof Error?r.stack:"No stack"),{success:!1,files:o,errors:[...i,{nodeId:"unknown",error:d}],duration:Date.now()-s}}}async generateNode(e,t,a){console.log("CodeGenerator: generateNode called for:",e.name,"type:",e.type);let s,o;try{switch(e.type){case"page":s=this.getPagePath(e),o=this.generatePageCode(e,t);break;case"component":s=this.getComponentPath(e),o=this.generateComponentCode(e,t);break;case"api":s=this.getApiPath(e),o=this.generateApiCode(e,t);break;case"database":s=this.getDatabasePath(e),o=this.generateDatabaseCode(e,t);break;case"type":s=this.getTypePath(e),o=this.generateTypeCode(e,t);break;case"hook":s=this.getHookPath(e),o=this.generateHookCode(e,t);break;case"service":s=this.getServicePath(e),o=this.generateServiceCode(e,t);break;case"middleware":s=this.getMiddlewarePath(e),o=this.generateMiddlewareCode(e,t);break;case"context":s=this.getContextPath(e),o=this.generateContextCode(e,t);break;case"action":s=this.getActionPath(e),o=this.generateActionCode(e,t);break;case"job":s=this.getJobPath(e),o=this.generateJobCode(e,t);break;default:throw new Error(`Unknown node type: ${e.type}`)}return console.log("CodeGenerator: Generated file path:",s),{path:s,content:o,nodeId:e.id,status:"pending"}}catch(i){let r=i instanceof Error?i.message:String(i);throw console.error("CodeGenerator: generateNode failed for:",e.name,"error:",r),i}}getPagePath(e){let t=e.details.route||this.nameToRoute(e.name),a=t==="/"?"":t.replace(/^\//,"");return _e.join("src","app",a,"page.tsx")}getComponentPath(e){let t=this.toPascalCase(e.name);return _e.join("src","components",`${t}.tsx`)}getApiPath(e){let t=this.toKebabCase(e.name.replace(/Api$|Route$/i,""));return _e.join("src","app","api",t,"route.ts")}getDatabasePath(e){let t=this.toKebabCase(e.name.replace(/Table$/i,""));return _e.join("src","db","schema",`${t}.ts`)}getTypePath(e){let t=this.toKebabCase(e.name.replace(/Type$/i,""));return _e.join("src","types",`${t}.ts`)}getHookPath(e){let t=e.name.startsWith("use")?e.name:`use${this.toPascalCase(e.name)}`;return _e.join("src","hooks",`${t}.ts`)}getServicePath(e){let t=this.toKebabCase(e.name.replace(/Service$/i,""));return _e.join("src","services",`${t}.ts`)}getMiddlewarePath(e){return _e.join("src","middleware",`${this.toKebabCase(e.name)}.ts`)}getContextPath(e){let t=this.toPascalCase(e.name.replace(/Context$|Provider$/i,""));return _e.join("src","contexts",`${t}Context.tsx`)}getActionPath(e){let t=this.toKebabCase(e.name.replace(/Action$/i,""));return _e.join("src","actions",`${t}.ts`)}getJobPath(e){let t=this.toKebabCase(e.name.replace(/Job$/i,""));return _e.join("src","jobs",`${t}.ts`)}generatePageCode(e,t){let a=this.toPascalCase(e.name.replace(/Page$/i,""))+"Page",s=e.details.isProtected??!1,o=t.edges.filter(d=>d.source===e.id&&d.type==="renders").map(d=>t.nodes.find(p=>p.id===d.target)).filter(Boolean),i=[];s&&(i.push("import { auth } from '@/lib/auth';"),i.push("import { redirect } from 'next/navigation';")),o.forEach(d=>{let p=this.toPascalCase(d.name);i.push(`import { ${p} } from '@/components/${p}';`)});let r=`/**
 * ${e.description||a}
 * Route: ${e.details.route||"/"}
 * Generated by CodeBakers Build Planner
 */

${i.join(`
`)}

export default async function ${a}() {
`;return s&&(r+=`  const session = await auth();

  if (!session) {
    redirect('/login');
  }

`),r+=`  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">${e.name.replace(/Page$/i,"")}</h1>
`,o.length>0?o.forEach(d=>{let p=this.toPascalCase(d.name);r+=`      <${p} />
`}):r+=`      {/* Add your page content here */}
`,r+=`    </div>
  );
}
`,r}generateComponentCode(e,t){let a=this.toPascalCase(e.name),s=e.details.props||[],o="",i="";return s.length>0&&(o=`interface ${a}Props {
`,s.forEach(d=>{let p=d.required?"":"?";o+=`  ${d.name}${p}: ${d.type};
`}),o+=`}

`,i=`{ ${s.map(d=>d.name).join(", ")} }: ${a}Props`),`/**
 * ${e.description||a}
 * Generated by CodeBakers Build Planner
 */

'use client';

import { useState } from 'react';

${o}export function ${a}(${i}) {
  ${e.details.hasState?`const [state, setState] = useState();
`:""}
  return (
    <div className="rounded-lg border p-4">
      <h2 className="text-xl font-semibold">${a}</h2>
      {/* Add component content here */}
    </div>
  );
}
`}generateApiCode(e,t){let a=e.details.httpMethod||"GET",s=e.details.requiresAuth??!0,o=t.edges.filter(d=>d.source===e.id&&(d.type==="queries"||d.type==="mutates")).map(d=>({table:t.nodes.find(p=>p.id===d.target),type:d.type})).filter(d=>d.table),i=["import { NextRequest, NextResponse } from 'next/server';"];s&&i.push("import { auth } from '@/lib/auth';"),o.length>0&&(i.push("import { db } from '@/db';"),o.forEach(({table:d})=>{let p=this.toCamelCase(d.name.replace(/Table$/i,""));i.push(`import { ${p} } from '@/db/schema/${this.toKebabCase(d.name.replace(/Table$/i,""))}';`)}));let r=`/**
 * ${e.description||e.name}
 * ${a} /api/${this.toKebabCase(e.name.replace(/Api$|Route$/i,""))}
 * Generated by CodeBakers Build Planner
 */

${i.join(`
`)}

export async function ${a}(request: NextRequest) {
  try {
`;if(s&&(r+=`    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

`),(a==="POST"||a==="PUT"||a==="PATCH")&&(r+=`    const body = await request.json();

    // TODO: Validate input with Zod
    // const validated = schema.parse(body);

`),o.length>0&&o[0].type==="queries"){let d=this.toCamelCase(o[0].table.name.replace(/Table$/i,""));r+=`    const result = await db.select().from(${d});

    return NextResponse.json(result);
`}else if(o.length>0&&o[0].type==="mutates"){let d=this.toCamelCase(o[0].table.name.replace(/Table$/i,""));r+=`    const result = await db.insert(${d}).values(body).returning();

    return NextResponse.json(result[0], { status: 201 });
`}else r+=`    // TODO: Implement ${a} logic

    return NextResponse.json({ message: 'Success' });
`;return r+=`  } catch (error) {
    console.error('${e.name} error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
`,r}generateDatabaseCode(e,t){let a=e.details.tableName||this.toSnakeCase(e.name.replace(/Table$/i,""))+"s",s=e.details.columns||[],o=e.details.relations||[],i=`/**
 * ${e.description||e.name}
 * Table: ${a}
 * Generated by CodeBakers Build Planner
 */

import { pgTable, serial, text, timestamp, integer, boolean, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const ${this.toCamelCase(a)} = pgTable('${a}', {
`;if(s.length===0?(i+=`  id: serial('id').primaryKey(),
`,i+=`  createdAt: timestamp('created_at').defaultNow().notNull(),
`,i+=`  updatedAt: timestamp('updated_at').defaultNow().notNull(),
`):s.forEach(r=>{let d=this.sqlToDrizzleType(r.type),p=`  ${this.toCamelCase(r.name)}: ${d}('${r.name}')`;r.name==="id"&&r.type==="serial"&&(p+=".primaryKey()"),r.required&&(p+=".notNull()"),r.defaultValue&&(p+=`.default(${r.defaultValue})`),(r.name.includes("created")||r.name.includes("updated"))&&(p+=".defaultNow()"),i+=p+`,
`}),i+=`});
`,o.length>0){let r=this.toCamelCase(a);i+=`
export const ${r}Relations = relations(${r}, ({ one, many }) => ({
`,o.forEach(d=>{let p=this.toCamelCase(d.target),l=d.type==="one-to-one"||d.type==="many-to-many"?"one":"many";i+=`  ${p}: ${l}(${p}),
`}),i+=`}));
`}return i+=`
export type ${this.toPascalCase(e.name.replace(/Table$/i,""))} = typeof ${this.toCamelCase(a)}.$inferSelect;
`,i+=`export type New${this.toPascalCase(e.name.replace(/Table$/i,""))} = typeof ${this.toCamelCase(a)}.$inferInsert;
`,i}generateTypeCode(e,t){let a=this.toPascalCase(e.name.replace(/Type$/i,"")),s=e.details.fields||[],o=e.details.extends,i=`/**
 * ${e.description||a}
 * Generated by CodeBakers Build Planner
 */

`,r=o?` extends ${o}`:"";return i+=`export interface ${a}${r} {
`,s.length===0?(i+=`  id: string;
`,i+=`  createdAt: Date;
`,i+=`  updatedAt: Date;
`):s.forEach(d=>{let p=d.required?"":"?";d.description&&(i+=`  /** ${d.description} */
`),i+=`  ${d.name}${p}: ${d.type};
`}),i+=`}
`,i}generateHookCode(e,t){let a=e.name.startsWith("use")?e.name:`use${this.toPascalCase(e.name)}`,s=e.details.dependencies||[],o=e.details.returnValue||"void",i=t.edges.filter(p=>p.source===e.id&&p.type==="calls").map(p=>t.nodes.find(l=>l.id===p.target&&l.type==="api")).filter(Boolean),r=["import { useState, useEffect } from 'react';"],d=`/**
 * ${e.description||a}
 * Generated by CodeBakers Build Planner
 */

${r.join(`
`)}

export function ${a}(${s.map(p=>`${p}: any`).join(", ")}) {
  const [data, setData] = useState<${o} | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

`;if(i.length>0){let p=i[0],l=`/api/${this.toKebabCase(p.name.replace(/Api$|Route$/i,""))}`;d+=`  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('${l}');

        if (!response.ok) {
          throw new Error('Failed to fetch');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [${s.join(", ")}]);

`}return d+=`  return { data, loading, error };
}
`,d}generateServiceCode(e,t){let a=this.toPascalCase(e.name.replace(/Service$/i,""))+"Service",s=e.details.methods||[],o=`/**
 * ${e.description||a}
 * Generated by CodeBakers Build Planner
 */

export const ${this.toCamelCase(a)} = {
`;return s.length===0?o+=`  // TODO: Add service methods
`:s.forEach((i,r)=>{let d=i.isAsync?"async ":"";o+=`  ${d}${i.name}(${i.params}): ${i.returnType} {
`,o+=`    // TODO: Implement ${i.name}
`,o+=`    throw new Error('Not implemented');
`,o+=`  }${r<s.length-1?",":""}
`}),o+=`};
`,o}generateMiddlewareCode(e,t){let a=this.toCamelCase(e.name);return`/**
 * ${e.description||a}
 * Generated by CodeBakers Build Planner
 */

import { NextRequest, NextResponse } from 'next/server';

export function ${a}(request: NextRequest) {
  // TODO: Implement middleware logic

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Add route matchers here
    '/api/:path*',
  ],
};
`}generateContextCode(e,t){let a=this.toPascalCase(e.name.replace(/Context$|Provider$/i,""));return`/**
 * ${e.description||a+"Context"}
 * Generated by CodeBakers Build Planner
 */

'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface ${a}ContextType {
  // TODO: Define context type
  value: unknown;
  setValue: (value: unknown) => void;
}

const ${a}Context = createContext<${a}ContextType | undefined>(undefined);

export function ${a}Provider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<unknown>(null);

  return (
    <${a}Context.Provider value={{ value, setValue }}>
      {children}
    </${a}Context.Provider>
  );
}

export function use${a}() {
  const context = useContext(${a}Context);

  if (context === undefined) {
    throw new Error('use${a} must be used within a ${a}Provider');
  }

  return context;
}
`}generateActionCode(e,t){let a=this.toCamelCase(e.name.replace(/Action$/i,"")),s=e.details.formFields||[],o=`/**
 * ${e.description||a}
 * Server Action
 * Generated by CodeBakers Build Planner
 */

'use server';

import { revalidatePath } from 'next/cache';

`;return s.length>0&&(o+=`import { z } from 'zod';

`,o+=`const ${a}Schema = z.object({
`,s.forEach(i=>{let r="z.string()";i.type==="number"&&(r="z.number()"),i.type==="boolean"&&(r="z.boolean()"),i.required||(r+=".optional()"),o+=`  ${i.name}: ${r},
`}),o+=`});

`),o+=`export async function ${a}(formData: FormData) {
  try {
`,s.length>0?(o+=`    const rawData = Object.fromEntries(formData);
`,o+=`    const validated = ${a}Schema.parse(rawData);

`,o+=`    // TODO: Implement action logic with validated data
`):o+=`    // TODO: Implement action logic
`,o+=`
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.error('${a} error:', error);
    return { success: false, error: 'Action failed' };
  }
}
`,o}generateJobCode(e,t){let a=this.toCamelCase(e.name.replace(/Job$/i,"")),s=e.details.schedule||"0 0 * * *";return`/**
 * ${e.description||a}
 * Schedule: ${s}
 * Generated by CodeBakers Build Planner
 */

import { inngest } from '@/lib/inngest';

export const ${a} = inngest.createFunction(
  { id: '${this.toKebabCase(a)}' },
  { cron: '${s}' },
  async ({ event, step }) => {
    // TODO: Implement job logic

    await step.run('process', async () => {
      console.log('Running ${a}...');
    });

    return { success: true };
  }
);
`}sortByDependency(e,t){let a={type:1,database:2,service:3,middleware:4,context:5,hook:6,action:7,api:8,component:9,page:10,job:11};return[...e].sort((s,o)=>a[s.type]-a[o.type])}async writeFile(e){console.log("CodeGenerator: Writing file:",e.path);try{let t=_e.join(this.workspaceRoot,e.path),a=Xt.Uri.file(t),s=_e.dirname(t);console.log("CodeGenerator: Creating directory:",s),await Xt.workspace.fs.createDirectory(Xt.Uri.file(s)),console.log("CodeGenerator: Writing",e.content.length,"bytes to:",t),await Xt.workspace.fs.writeFile(a,Buffer.from(e.content,"utf8")),console.log("CodeGenerator: File written successfully")}catch(t){let a=t instanceof Error?t.message:String(t);throw console.error("CodeGenerator: writeFile failed:",e.path,"error:",a),t}}toPascalCase(e){return e.replace(/[-_](.)/g,(t,a)=>a.toUpperCase()).replace(/^(.)/,(t,a)=>a.toUpperCase())}toCamelCase(e){let t=this.toPascalCase(e);return t.charAt(0).toLowerCase()+t.slice(1)}toKebabCase(e){return e.replace(/([a-z])([A-Z])/g,"$1-$2").replace(/[_\s]+/g,"-").toLowerCase()}toSnakeCase(e){return e.replace(/([a-z])([A-Z])/g,"$1_$2").replace(/[-\s]+/g,"_").toLowerCase()}nameToRoute(e){return"/"+this.toKebabCase(e.replace(/Page$/i,""))}sqlToDrizzleType(e){return{serial:"serial",integer:"integer",int:"integer",bigint:"integer",text:"text",varchar:"varchar",boolean:"boolean",timestamp:"timestamp",date:"timestamp"}[e.toLowerCase()]||"text"}}});var R,Fo,bc=f(()=>{"use strict";R=L(require("vscode"));Vr();Ur();qr();Fo=class n{constructor(e,t){this._disposables=[];this._panel=e,this._extensionUri=t,console.log("BuildPlanner: Initializing..."),this.aiPlanner=new Ja,console.log("BuildPlanner: AIPlanner initialized"),this.codeGenerator=new Za,console.log("BuildPlanner: CodeGenerator initialized"),this.templates=this.getBuiltInTemplates(),console.log("BuildPlanner: Templates loaded:",this.templates.length),this.plan=this.createEmptyPlan(),console.log("BuildPlanner: Empty plan created:",this.plan.id);try{this._panel.webview.html=this._getHtmlForWebview(),console.log("BuildPlanner: Webview HTML set"),this._panel.webview.onDidReceiveMessage(a=>this.handleWebviewMessage(a),null,this._disposables),this._panel.onDidDispose(()=>this.dispose(),null,this._disposables),console.log("BuildPlanner: Initialization complete")}catch(a){console.error("BuildPlanner: Initialization failed:",a),R.window.showErrorMessage(`Build Planner initialization failed: ${a}`)}}static createOrShow(e){let t=R.window.activeTextEditor?R.window.activeTextEditor.viewColumn:void 0;if(n.currentPanel)return n.currentPanel._panel.reveal(t),n.currentPanel;let a=R.window.createWebviewPanel("codebakers.buildPlanner","CodeBakers Build Planner",t||R.ViewColumn.One,{enableScripts:!0,retainContextWhenHidden:!0,localResourceRoots:[R.Uri.joinPath(e,"media")]});return n.currentPanel=new n(a,e),n.currentPanel}async handleWebviewMessage(e){console.log("BuildPlanner: Received message:",e.type);try{switch(e.type){case"ready":await this.initializeWebview();break;case"chat":await this.handleChat(e.content);break;case"add-node":this.addNode(e.nodeType,e.position);break;case"update-node":this.updateNode(e.nodeId,e.updates);break;case"delete-node":this.deleteNode(e.nodeId);break;case"add-edge":this.addEdge(e.source,e.target,e.edgeType);break;case"delete-edge":this.deleteEdge(e.edgeId);break;case"accept-suggestion":await this.acceptSuggestion(e.suggestionId);break;case"dismiss-suggestion":this.dismissSuggestion(e.suggestionId);break;case"accept-action":await this.acceptAction(e.actionId);break;case"reject-action":this.rejectAction(e.actionId);break;case"use-template":this.useTemplate(e.templateId);break;case"generate":await this.generateCode(e.request);break;case"save-plan":await this.savePlan();break;case"load-plan":await this.loadPlan(e.planId);break;case"new-plan":this.newPlan();break;case"update-viewport":this.plan.viewport=e.viewport;break;case"request-ai-review":await this.requestAIReview();break;case"run-tests":await this.runProjectTests();break;default:console.warn("BuildPlanner: Unknown message type:",e.type)}}catch(t){let a=t instanceof Error?t.message:String(t);console.error(`BuildPlanner: Error handling message '${e.type}':`,a),console.error("BuildPlanner: Stack:",t instanceof Error?t.stack:"No stack trace"),this.postMessage({type:"error",message:`Error: ${a}`})}}async initializeWebview(){console.log("BuildPlanner: Initializing webview...");try{console.log("BuildPlanner: Sending initial plan with",this.plan.nodes.length,"nodes"),this.postMessage({type:"init",plan:this.plan,templates:this.templates}),console.log("BuildPlanner: Getting AI greeting...");let e=await this.aiPlanner.getInitialGreeting(this.plan);this.plan.messages.push(e),this.postMessage({type:"ai-message",message:e}),console.log("BuildPlanner: Webview initialized successfully")}catch(e){let t=e instanceof Error?e.message:String(e);console.error("BuildPlanner: Failed to initialize webview:",t),this.postMessage({type:"error",message:"Failed to initialize. Please try refreshing."})}}async handleChat(e){console.log("BuildPlanner: Processing chat message, length:",e.length);let t={id:`msg_${Date.now()}`,role:"user",content:e,timestamp:Date.now()};this.plan.messages.push(t),this.postMessage({type:"ai-typing",isTyping:!0});try{console.log("BuildPlanner: Calling AI planner...");let a=await this.aiPlanner.chat(e,this.plan);console.log("BuildPlanner: AI response received, length:",a.content.length),this.plan.messages.push(a),this.postMessage({type:"ai-typing",isTyping:!1}),this.postMessage({type:"ai-message",message:a}),this.checkForSuggestions(),console.log("BuildPlanner: Chat handled successfully")}catch(a){let s=a instanceof Error?a.message:String(a);console.error("BuildPlanner: Chat error:",s),console.error("BuildPlanner: Chat error stack:",a instanceof Error?a.stack:"No stack"),this.postMessage({type:"ai-typing",isTyping:!1}),this.postMessage({type:"error",message:"Failed to get AI response. Please try again."})}}addNode(e,t){console.log("BuildPlanner: Adding node of type:",e,"at position:",t);try{let a=jr[e],s=this.plan.nodes.filter(d=>d.type===e).length+1,o={id:`node_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,type:e,name:`New${this.capitalize(e)}${s}`,description:a.description||"",position:t,details:a.details?{...a.details}:{},status:"draft",aiGenerated:!1,createdAt:Date.now(),updatedAt:Date.now()};console.log("BuildPlanner: Auto-filling node details...");let i=this.aiPlanner.autoFillNodeDetails(o,this.plan);o.details={...o.details,...i},this.plan.nodes.push(o),this.plan.updatedAt=Date.now(),console.log("BuildPlanner: Checking for suggested connections...");let r=this.aiPlanner.suggestConnectionsForNode(o,this.plan.nodes.filter(d=>d.id!==o.id));r.forEach(d=>{this.plan.edges.push(d)}),console.log("BuildPlanner: Node added successfully:",o.id,"with",r.length,"suggested edges"),this.sendPlanUpdate(),this.checkForSuggestions()}catch(a){let s=a instanceof Error?a.message:String(a);console.error("BuildPlanner: Failed to add node:",s),this.postMessage({type:"error",message:`Failed to add node: ${s}`})}}updateNode(e,t){console.log("BuildPlanner: Updating node:",e);try{let a=this.plan.nodes.findIndex(s=>s.id===e);if(a===-1){console.warn("BuildPlanner: Node not found for update:",e);return}this.plan.nodes[a]={...this.plan.nodes[a],...t,updatedAt:Date.now()},this.plan.updatedAt=Date.now(),console.log("BuildPlanner: Node updated successfully:",e),this.sendPlanUpdate()}catch(a){let s=a instanceof Error?a.message:String(a);console.error("BuildPlanner: Failed to update node:",s),this.postMessage({type:"error",message:`Failed to update node: ${s}`})}}deleteNode(e){console.log("BuildPlanner: Deleting node:",e);try{if(!this.plan.nodes.some(s=>s.id===e)){console.warn("BuildPlanner: Node not found for deletion:",e);return}this.plan.nodes=this.plan.nodes.filter(s=>s.id!==e);let a=this.plan.edges.filter(s=>s.source===e||s.target===e);this.plan.edges=this.plan.edges.filter(s=>s.source!==e&&s.target!==e),this.plan.updatedAt=Date.now(),console.log("BuildPlanner: Node deleted successfully:",e,"removed",a.length,"edges"),this.sendPlanUpdate()}catch(t){let a=t instanceof Error?t.message:String(t);console.error("BuildPlanner: Failed to delete node:",a),this.postMessage({type:"error",message:`Failed to delete node: ${a}`})}}addEdge(e,t,a){console.log("BuildPlanner: Adding edge:",e,"->",t,"type:",a);try{if(this.plan.edges.some(i=>i.source===e&&i.target===t)){console.warn("BuildPlanner: Edge already exists, skipping");return}let o={id:`edge_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,source:e,target:t,type:a,aiGenerated:!1};this.plan.edges.push(o),this.plan.updatedAt=Date.now(),console.log("BuildPlanner: Edge added successfully:",o.id),this.sendPlanUpdate()}catch(s){let o=s instanceof Error?s.message:String(s);console.error("BuildPlanner: Failed to add edge:",o),this.postMessage({type:"error",message:`Failed to add connection: ${o}`})}}deleteEdge(e){console.log("BuildPlanner: Deleting edge:",e);try{if(!this.plan.edges.some(a=>a.id===e)){console.warn("BuildPlanner: Edge not found for deletion:",e);return}this.plan.edges=this.plan.edges.filter(a=>a.id!==e),this.plan.updatedAt=Date.now(),console.log("BuildPlanner: Edge deleted successfully:",e),this.sendPlanUpdate()}catch(t){let a=t instanceof Error?t.message:String(t);console.error("BuildPlanner: Failed to delete edge:",a),this.postMessage({type:"error",message:`Failed to delete connection: ${a}`})}}checkForSuggestions(){console.log("BuildPlanner: Checking for suggestions...");try{let e=this.aiPlanner.analyzeAndSuggest(this.plan),t=0;e.forEach(a=>{this.plan.suggestions.some(o=>o.title===a.title&&!o.dismissed)||(this.plan.suggestions.push(a),this.postMessage({type:"suggestion-added",suggestion:a}),t++)}),console.log("BuildPlanner: Found",e.length,"suggestions,",t,"new")}catch(e){let t=e instanceof Error?e.message:String(e);console.error("BuildPlanner: Failed to check suggestions:",t)}}async acceptSuggestion(e){console.log("BuildPlanner: Accepting suggestion:",e);try{let t=this.plan.suggestions.find(a=>a.id===e);if(!t){console.warn("BuildPlanner: Suggestion not found:",e);return}t.suggestedNodes&&(console.log("BuildPlanner: Adding",t.suggestedNodes.length,"suggested nodes"),t.suggestedNodes.forEach((a,s)=>{let o={x:100+s*200,y:400+Math.random()*100},i={id:`node_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,type:a.type,name:a.name||`New${this.capitalize(a.type)}`,description:a.description||"",position:o,details:a.details||{},status:"ai-suggested",aiGenerated:!0,aiNotes:t.description,createdAt:Date.now(),updatedAt:Date.now()};this.plan.nodes.push(i)})),t.suggestedEdges&&(console.log("BuildPlanner: Adding",t.suggestedEdges.length,"suggested edges"),t.suggestedEdges.forEach(a=>{let s={id:`edge_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,source:a.source||"",target:a.target||"",type:a.type,aiGenerated:!0};this.plan.edges.push(s)})),t.dismissed=!0,this.postMessage({type:"suggestion-removed",suggestionId:e}),this.plan.updatedAt=Date.now(),console.log("BuildPlanner: Suggestion accepted successfully"),this.sendPlanUpdate()}catch(t){let a=t instanceof Error?t.message:String(t);console.error("BuildPlanner: Failed to accept suggestion:",a),this.postMessage({type:"error",message:`Failed to apply suggestion: ${a}`})}}dismissSuggestion(e){console.log("BuildPlanner: Dismissing suggestion:",e);try{let t=this.plan.suggestions.find(a=>a.id===e);t?(t.dismissed=!0,this.postMessage({type:"suggestion-removed",suggestionId:e}),console.log("BuildPlanner: Suggestion dismissed")):console.warn("BuildPlanner: Suggestion not found for dismissal:",e)}catch(t){let a=t instanceof Error?t.message:String(t);console.error("BuildPlanner: Failed to dismiss suggestion:",a)}}async acceptAction(e){console.log("BuildPlanner: Accepting action:",e);try{for(let t of this.plan.messages.slice().reverse()){let a=t.suggestedActions?.find(s=>s.id===e);if(a){switch(console.log("BuildPlanner: Found action type:",a.type),a.status="accepted",a.type){case"add-node":this.addNode(a.payload.nodeType,{x:300,y:200});break;case"use-template":this.useTemplate(a.payload.templateId);break;case"generate":await this.generateCode({planId:this.plan.id,nodes:[],dryRun:a.payload.dryRun??!1,usePatterns:!0});break;default:console.warn("BuildPlanner: Unknown action type:",a.type)}console.log("BuildPlanner: Action accepted successfully");break}}}catch(t){let a=t instanceof Error?t.message:String(t);console.error("BuildPlanner: Failed to accept action:",a),this.postMessage({type:"error",message:`Failed to perform action: ${a}`})}}rejectAction(e){console.log("BuildPlanner: Rejecting action:",e);try{for(let t of this.plan.messages){let a=t.suggestedActions?.find(s=>s.id===e);if(a){a.status="rejected",console.log("BuildPlanner: Action rejected");break}}}catch(t){let a=t instanceof Error?t.message:String(t);console.error("BuildPlanner: Failed to reject action:",a)}}useTemplate(e){console.log("BuildPlanner: Loading template:",e);try{let t=this.templates.find(o=>o.id===e);if(!t){console.warn("BuildPlanner: Template not found:",e),this.postMessage({type:"error",message:"Template not found"});return}console.log("BuildPlanner: Clearing existing plan, had",this.plan.nodes.length,"nodes"),this.plan.nodes=[],this.plan.edges=[];let a=new Map;t.nodes.forEach((o,i)=>{let r=`node_${Date.now()}_${i}`;a.set(o.name,r);let d={id:r,type:o.type,name:o.name,description:o.description,position:o.position,details:{...o.details},status:"draft",aiGenerated:!1,createdAt:Date.now(),updatedAt:Date.now()};this.plan.nodes.push(d)}),console.log("BuildPlanner: Added",this.plan.nodes.length,"template nodes"),t.edges.forEach((o,i)=>{let r=this.plan.nodes.find(p=>p.name===o.source),d=this.plan.nodes.find(p=>p.name===o.target);if(r&&d){let p={id:`edge_${Date.now()}_${i}`,source:r.id,target:d.id,type:o.type,aiGenerated:!1};this.plan.edges.push(p)}else console.warn("BuildPlanner: Could not find nodes for edge:",o.source,"->",o.target)}),console.log("BuildPlanner: Added",this.plan.edges.length,"template edges"),this.plan.templateId=e,this.plan.updatedAt=Date.now(),this.sendPlanUpdate();let s={id:`msg_${Date.now()}`,role:"assistant",content:`Great choice! I've loaded the **${t.name}** template with ${this.plan.nodes.length} components.

Take a look at the canvas - you can:
- Click on any node to edit it
- Drag nodes to rearrange
- Add more nodes with the toolbar

What would you like to customize first?`,timestamp:Date.now()};this.plan.messages.push(s),this.postMessage({type:"ai-message",message:s}),console.log("BuildPlanner: Template loaded successfully:",t.name)}catch(t){let a=t instanceof Error?t.message:String(t);console.error("BuildPlanner: Failed to load template:",a),this.postMessage({type:"error",message:`Failed to load template: ${a}`})}}async generateCode(e){if(console.log("BuildPlanner: Starting code generation, dryRun:",e.dryRun),this.plan.nodes.length===0){console.warn("BuildPlanner: Cannot generate code - no nodes in plan"),this.postMessage({type:"error",message:"Add some nodes to your plan before generating code."});return}let t=e.nodes.length>0?e.nodes:this.plan.nodes.map(a=>a.id);console.log("BuildPlanner: Generating code for",t.length,"nodes"),this.postMessage({type:"generation-started",nodeIds:t});try{let a=await this.codeGenerator.generate(this.plan,{...e,planId:this.plan.id},(s,o,i)=>{console.log("BuildPlanner: Generation progress:",s,o,i?.path||""),this.postMessage({type:"generation-progress",nodeId:s,status:o,file:i})});console.log("BuildPlanner: Generation completed:",a.files.length,"files,",a.errors.length,"errors"),this.plan.generatedFiles=a.files,this.plan.status=a.success?"completed":"approved",this.postMessage({type:"generation-completed",result:a}),a.files.forEach(s=>{let o=this.plan.nodes.find(i=>i.id===s.nodeId);o&&s.status==="written"&&(o.status="generated")}),this.sendPlanUpdate(),a.success?(console.log("BuildPlanner: Generation successful"),R.window.showInformationMessage(`Generated ${a.files.length} files successfully!`)):(console.warn("BuildPlanner: Generation completed with errors:",a.errors),R.window.showWarningMessage(`Generated ${a.files.length} files with ${a.errors.length} errors.`))}catch(a){let s=a instanceof Error?a.message:String(a);console.error("BuildPlanner: Generation error:",s),console.error("BuildPlanner: Generation error stack:",a instanceof Error?a.stack:"No stack"),this.postMessage({type:"error",message:`Generation failed: ${s}`})}}async requestAIReview(){console.log("BuildPlanner: Requesting AI review of plan"),this.postMessage({type:"ai-typing",isTyping:!0});try{let e=await this.aiPlanner.chat("Please review my plan and tell me if anything is missing or could be improved.",this.plan);this.plan.messages.push(e),this.postMessage({type:"ai-typing",isTyping:!1}),this.postMessage({type:"ai-message",message:e}),console.log("BuildPlanner: AI review completed")}catch(e){let t=e instanceof Error?e.message:String(e);console.error("BuildPlanner: AI review failed:",t),this.postMessage({type:"ai-typing",isTyping:!1}),this.postMessage({type:"error",message:"Failed to get AI review. Please try again."})}}async runProjectTests(){console.log("BuildPlanner: Running project tests");let e=R.workspace.workspaceFolders;if(!e){this.postMessage({type:"error",message:"No workspace folder open. Please open a project first."});return}let t=e[0].uri;try{let a=await this.detectTestFramework(t);if(!a){this.postMessage({type:"error",message:"No test framework detected. Please ensure Playwright or Vitest is installed."});return}console.log("BuildPlanner: Detected test framework:",a);let s={id:`msg_${Date.now()}`,role:"assistant",content:`\u{1F9EA} Running **${a}** tests...

I'll show you the results when they're done.`,timestamp:Date.now()};this.plan.messages.push(s),this.postMessage({type:"ai-message",message:s});let o=R.window.createTerminal({name:`CodeBakers Tests (${a})`,cwd:t.fsPath}),i;switch(a){case"playwright":i="npx playwright test";break;case"vitest":i="npx vitest run";break;case"jest":i="npx jest";break;case"mocha":i="npx mocha";break;default:i="npm test"}o.show(),o.sendText(i);let r={id:`msg_${Date.now()+1}`,role:"assistant",content:`Tests are running in the terminal. Check the **${a.charAt(0).toUpperCase()+a.slice(1)}** output for results.

**Tip:** After tests complete, you can ask me about any failures and I'll help debug them.`,timestamp:Date.now()};this.plan.messages.push(r),this.postMessage({type:"ai-message",message:r}),console.log("BuildPlanner: Tests started in terminal")}catch(a){let s=a instanceof Error?a.message:String(a);console.error("BuildPlanner: Failed to run tests:",s),this.postMessage({type:"error",message:`Failed to run tests: ${s}`})}}async detectTestFramework(e){let t=R.workspace.fs;try{return await t.stat(R.Uri.joinPath(e,"playwright.config.ts")),"playwright"}catch{try{return await t.stat(R.Uri.joinPath(e,"playwright.config.js")),"playwright"}catch{}}try{return await t.stat(R.Uri.joinPath(e,"vitest.config.ts")),"vitest"}catch{try{return await t.stat(R.Uri.joinPath(e,"vitest.config.js")),"vitest"}catch{try{await t.stat(R.Uri.joinPath(e,"vite.config.ts"));let a=R.Uri.joinPath(e,"package.json"),s=await t.readFile(a),o=JSON.parse(s.toString());if(o.devDependencies?.vitest||o.dependencies?.vitest)return"vitest"}catch{}}}try{return await t.stat(R.Uri.joinPath(e,"jest.config.ts")),"jest"}catch{try{return await t.stat(R.Uri.joinPath(e,"jest.config.js")),"jest"}catch{}}try{let a=R.Uri.joinPath(e,"package.json"),s=await t.readFile(a),o=JSON.parse(s.toString());if(o.scripts?.test){let r=o.scripts.test;return r.includes("playwright")?"playwright":r.includes("vitest")?"vitest":r.includes("jest")?"jest":r.includes("mocha")?"mocha":"npm"}let i={...o.dependencies,...o.devDependencies};if(i["@playwright/test"])return"playwright";if(i.vitest)return"vitest";if(i.jest)return"jest";if(i.mocha)return"mocha"}catch{}return null}async savePlan(){console.log("BuildPlanner: Saving plan:",this.plan.id);let e=R.workspace.workspaceFolders;if(!e){console.error("BuildPlanner: No workspace folder open for saving"),R.window.showErrorMessage("No workspace folder open");return}let t=R.Uri.joinPath(e[0].uri,".codebakers","plans",`${this.plan.id}.json`);try{console.log("BuildPlanner: Creating plans directory..."),await R.workspace.fs.createDirectory(R.Uri.joinPath(e[0].uri,".codebakers","plans")),console.log("BuildPlanner: Writing plan file to:",t.fsPath),await R.workspace.fs.writeFile(t,Buffer.from(JSON.stringify(this.plan,null,2),"utf8")),console.log("BuildPlanner: Plan saved successfully"),R.window.showInformationMessage("Plan saved successfully!")}catch(a){let s=a instanceof Error?a.message:String(a);console.error("BuildPlanner: Save error:",s),R.window.showErrorMessage(`Failed to save plan: ${s}`)}}async loadPlan(e){console.log("BuildPlanner: Loading plan:",e);let t=R.workspace.workspaceFolders;if(!t){console.error("BuildPlanner: No workspace folder open for loading");return}let a=R.Uri.joinPath(t[0].uri,".codebakers","plans",`${e}.json`);try{console.log("BuildPlanner: Reading plan file from:",a.fsPath);let s=await R.workspace.fs.readFile(a);this.plan=JSON.parse(s.toString()),console.log("BuildPlanner: Plan loaded successfully, nodes:",this.plan.nodes.length),this.sendPlanUpdate()}catch(s){let o=s instanceof Error?s.message:String(s);console.error("BuildPlanner: Load error:",o),R.window.showErrorMessage(`Failed to load plan: ${o}`)}}newPlan(){console.log("BuildPlanner: Creating new plan");try{this.plan=this.createEmptyPlan(),console.log("BuildPlanner: New plan created:",this.plan.id),this.sendPlanUpdate(),this.aiPlanner.getInitialGreeting(this.plan).then(e=>{this.plan.messages.push(e),this.postMessage({type:"ai-message",message:e}),console.log("BuildPlanner: New plan greeting sent")}).catch(e=>{let t=e instanceof Error?e.message:String(e);console.error("BuildPlanner: Failed to get greeting for new plan:",t)})}catch(e){let t=e instanceof Error?e.message:String(e);console.error("BuildPlanner: Failed to create new plan:",t)}}createEmptyPlan(){return{id:`plan_${Date.now()}`,name:"Untitled Plan",description:"",status:"planning",nodes:[],edges:[],messages:[],suggestions:[],createdAt:Date.now(),updatedAt:Date.now(),viewport:{x:0,y:0,zoom:1}}}sendPlanUpdate(){this.postMessage({type:"plan-updated",plan:this.plan})}postMessage(e){this._panel.webview.postMessage(e)}capitalize(e){return e.charAt(0).toUpperCase()+e.slice(1)}getBuiltInTemplates(){return[{id:"saas-starter",name:"SaaS Starter",description:"Authentication, billing, dashboard, and settings",category:"saas",tags:["auth","stripe","dashboard"],nodes:[{type:"page",name:"HomePage",description:"Landing page",position:{x:50,y:50},details:{route:"/",isProtected:!1},status:"draft",aiGenerated:!1},{type:"page",name:"LoginPage",description:"User login",position:{x:250,y:50},details:{route:"/login",isProtected:!1},status:"draft",aiGenerated:!1},{type:"page",name:"SignupPage",description:"User registration",position:{x:450,y:50},details:{route:"/signup",isProtected:!1},status:"draft",aiGenerated:!1},{type:"page",name:"DashboardPage",description:"Main dashboard",position:{x:250,y:200},details:{route:"/dashboard",isProtected:!0},status:"draft",aiGenerated:!1},{type:"page",name:"SettingsPage",description:"User settings",position:{x:450,y:200},details:{route:"/settings",isProtected:!0},status:"draft",aiGenerated:!1},{type:"api",name:"AuthApi",description:"Authentication endpoints",position:{x:50,y:350},details:{httpMethod:"POST",requiresAuth:!1},status:"draft",aiGenerated:!1},{type:"api",name:"UsersApi",description:"User management",position:{x:250,y:350},details:{httpMethod:"GET",requiresAuth:!0},status:"draft",aiGenerated:!1},{type:"api",name:"BillingApi",description:"Stripe billing",position:{x:450,y:350},details:{httpMethod:"POST",requiresAuth:!0},status:"draft",aiGenerated:!1},{type:"database",name:"UsersTable",description:"User accounts",position:{x:150,y:500},details:{tableName:"users",columns:[{name:"id",type:"serial",required:!0},{name:"email",type:"text",required:!0},{name:"name",type:"text",required:!1}]},status:"draft",aiGenerated:!1},{type:"database",name:"SubscriptionsTable",description:"Billing subscriptions",position:{x:350,y:500},details:{tableName:"subscriptions",columns:[{name:"id",type:"serial",required:!0},{name:"user_id",type:"integer",required:!0},{name:"status",type:"text",required:!0}]},status:"draft",aiGenerated:!1}],edges:[{source:"LoginPage",target:"AuthApi",type:"calls",aiGenerated:!1},{source:"SignupPage",target:"AuthApi",type:"calls",aiGenerated:!1},{source:"DashboardPage",target:"UsersApi",type:"calls",aiGenerated:!1},{source:"SettingsPage",target:"UsersApi",type:"calls",aiGenerated:!1},{source:"SettingsPage",target:"BillingApi",type:"calls",aiGenerated:!1},{source:"AuthApi",target:"UsersTable",type:"mutates",aiGenerated:!1},{source:"UsersApi",target:"UsersTable",type:"queries",aiGenerated:!1},{source:"BillingApi",target:"SubscriptionsTable",type:"mutates",aiGenerated:!1}]},{id:"ecommerce",name:"E-commerce",description:"Products, cart, checkout, and orders",category:"ecommerce",tags:["products","cart","stripe"],nodes:[{type:"page",name:"ProductsPage",description:"Product catalog",position:{x:50,y:50},details:{route:"/products",isProtected:!1},status:"draft",aiGenerated:!1},{type:"page",name:"ProductDetailPage",description:"Single product view",position:{x:250,y:50},details:{route:"/products/[id]",isProtected:!1},status:"draft",aiGenerated:!1},{type:"page",name:"CartPage",description:"Shopping cart",position:{x:450,y:50},details:{route:"/cart",isProtected:!1},status:"draft",aiGenerated:!1},{type:"page",name:"CheckoutPage",description:"Checkout flow",position:{x:650,y:50},details:{route:"/checkout",isProtected:!0},status:"draft",aiGenerated:!1},{type:"page",name:"OrdersPage",description:"Order history",position:{x:450,y:200},details:{route:"/orders",isProtected:!0},status:"draft",aiGenerated:!1},{type:"api",name:"ProductsApi",description:"Product CRUD",position:{x:150,y:350},details:{httpMethod:"GET",requiresAuth:!1},status:"draft",aiGenerated:!1},{type:"api",name:"CartApi",description:"Cart management",position:{x:350,y:350},details:{httpMethod:"POST",requiresAuth:!1},status:"draft",aiGenerated:!1},{type:"api",name:"OrdersApi",description:"Order processing",position:{x:550,y:350},details:{httpMethod:"POST",requiresAuth:!0},status:"draft",aiGenerated:!1},{type:"database",name:"ProductsTable",description:"Product catalog",position:{x:150,y:500},details:{tableName:"products"},status:"draft",aiGenerated:!1},{type:"database",name:"OrdersTable",description:"Customer orders",position:{x:350,y:500},details:{tableName:"orders"},status:"draft",aiGenerated:!1},{type:"database",name:"OrderItemsTable",description:"Order line items",position:{x:550,y:500},details:{tableName:"order_items"},status:"draft",aiGenerated:!1}],edges:[{source:"ProductsPage",target:"ProductsApi",type:"calls",aiGenerated:!1},{source:"ProductDetailPage",target:"ProductsApi",type:"calls",aiGenerated:!1},{source:"CartPage",target:"CartApi",type:"calls",aiGenerated:!1},{source:"CheckoutPage",target:"OrdersApi",type:"calls",aiGenerated:!1},{source:"OrdersPage",target:"OrdersApi",type:"calls",aiGenerated:!1},{source:"ProductsApi",target:"ProductsTable",type:"queries",aiGenerated:!1},{source:"OrdersApi",target:"OrdersTable",type:"mutates",aiGenerated:!1},{source:"OrdersApi",target:"OrderItemsTable",type:"mutates",aiGenerated:!1}]},{id:"dashboard",name:"Admin Dashboard",description:"Data tables, charts, and CRUD operations",category:"dashboard",tags:["admin","analytics","crud"],nodes:[{type:"page",name:"OverviewPage",description:"Dashboard overview",position:{x:250,y:50},details:{route:"/admin",isProtected:!0},status:"draft",aiGenerated:!1},{type:"page",name:"UsersAdminPage",description:"User management",position:{x:50,y:200},details:{route:"/admin/users",isProtected:!0},status:"draft",aiGenerated:!1},{type:"page",name:"AnalyticsPage",description:"Analytics dashboard",position:{x:250,y:200},details:{route:"/admin/analytics",isProtected:!0},status:"draft",aiGenerated:!1},{type:"page",name:"SettingsAdminPage",description:"System settings",position:{x:450,y:200},details:{route:"/admin/settings",isProtected:!0},status:"draft",aiGenerated:!1},{type:"component",name:"DataTable",description:"Reusable data table",position:{x:50,y:350},details:{props:[{name:"data",type:"any[]",required:!0},{name:"columns",type:"Column[]",required:!0}]},status:"draft",aiGenerated:!1},{type:"component",name:"StatsCard",description:"Statistics card",position:{x:250,y:350},details:{props:[{name:"title",type:"string",required:!0},{name:"value",type:"number",required:!0}]},status:"draft",aiGenerated:!1},{type:"component",name:"Chart",description:"Chart component",position:{x:450,y:350},details:{props:[{name:"type",type:"string",required:!0},{name:"data",type:"ChartData",required:!0}]},status:"draft",aiGenerated:!1},{type:"api",name:"StatsApi",description:"Dashboard statistics",position:{x:150,y:500},details:{httpMethod:"GET",requiresAuth:!0},status:"draft",aiGenerated:!1},{type:"api",name:"AdminUsersApi",description:"Admin user management",position:{x:350,y:500},details:{httpMethod:"GET",requiresAuth:!0},status:"draft",aiGenerated:!1}],edges:[{source:"OverviewPage",target:"StatsCard",type:"renders",aiGenerated:!1},{source:"OverviewPage",target:"Chart",type:"renders",aiGenerated:!1},{source:"UsersAdminPage",target:"DataTable",type:"renders",aiGenerated:!1},{source:"AnalyticsPage",target:"Chart",type:"renders",aiGenerated:!1},{source:"OverviewPage",target:"StatsApi",type:"calls",aiGenerated:!1},{source:"UsersAdminPage",target:"AdminUsersApi",type:"calls",aiGenerated:!1}]}]}dispose(){console.log("BuildPlanner: Disposing...");try{for(n.currentPanel=void 0,this._panel.dispose();this._disposables.length;){let e=this._disposables.pop();e&&e.dispose()}console.log("BuildPlanner: Disposed successfully")}catch(e){let t=e instanceof Error?e.message:String(e);console.error("BuildPlanner: Error during disposal:",t)}}_getHtmlForWebview(){return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeBakers Build Planner</title>
  <style>
    :root {
      --bg: #1e1e1e;
      --surface: #252526;
      --surface-hover: #2d2d2d;
      --border: #3e3e42;
      --text: #cccccc;
      --text-muted: #858585;
      --primary: #0e7490;
      --primary-light: #22d3ee;
      --success: #22c55e;
      --warning: #f59e0b;
      --error: #ef4444;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      height: 100vh;
      overflow: hidden;
    }

    .container {
      display: flex;
      height: 100vh;
    }

    /* Canvas Area */
    .canvas-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }

    .toolbar-group {
      display: flex;
      gap: 4px;
      padding-right: 12px;
      border-right: 1px solid var(--border);
    }

    .toolbar-group:last-child {
      border-right: none;
    }

    .toolbar-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: var(--surface-hover);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .toolbar-btn:hover {
      background: var(--border);
    }

    .toolbar-btn.active {
      background: var(--primary);
      border-color: var(--primary);
    }

    .toolbar-btn.primary {
      background: var(--primary);
      border-color: var(--primary);
    }

    .toolbar-btn.primary:hover {
      background: var(--primary-light);
    }

    .canvas-container {
      flex: 1;
      position: relative;
      overflow: hidden;
      background:
        linear-gradient(90deg, var(--border) 1px, transparent 1px),
        linear-gradient(var(--border) 1px, transparent 1px);
      background-size: 20px 20px;
    }

    .canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    /* Nodes */
    .node {
      position: absolute;
      min-width: 180px;
      background: var(--surface);
      border: 2px solid var(--border);
      border-radius: 8px;
      cursor: move;
      transition: box-shadow 0.15s;
      user-select: none;
    }

    .node:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .node.selected {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(14, 116, 144, 0.3);
    }

    .node.ai-suggested {
      border-style: dashed;
      opacity: 0.85;
    }

    .node-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 6px 6px 0 0;
      font-weight: 500;
      font-size: 13px;
    }

    .node-icon {
      font-size: 16px;
    }

    .node-type {
      font-size: 10px;
      text-transform: uppercase;
      opacity: 0.7;
      margin-left: auto;
    }

    .node-body {
      padding: 8px 12px;
      font-size: 12px;
      color: var(--text-muted);
      border-top: 1px solid var(--border);
    }

    .node-status {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      font-size: 10px;
      border-top: 1px solid var(--border);
    }

    .node-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .node-status-dot.draft { background: var(--text-muted); }
    .node-status-dot.ai-suggested { background: var(--warning); }
    .node-status-dot.approved { background: var(--primary); }
    .node-status-dot.generated { background: var(--success); }

    /* Connection Points */
    .connection-point {
      position: absolute;
      width: 12px;
      height: 12px;
      background: var(--primary);
      border: 2px solid var(--bg);
      border-radius: 50%;
      cursor: crosshair;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .node:hover .connection-point {
      opacity: 1;
    }

    .connection-point.top { top: -6px; left: 50%; transform: translateX(-50%); }
    .connection-point.right { right: -6px; top: 50%; transform: translateY(-50%); }
    .connection-point.bottom { bottom: -6px; left: 50%; transform: translateX(-50%); }
    .connection-point.left { left: -6px; top: 50%; transform: translateY(-50%); }

    /* Edges (SVG) */
    .edges-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .edge {
      fill: none;
      stroke: var(--border);
      stroke-width: 2;
      pointer-events: stroke;
      cursor: pointer;
    }

    .edge:hover {
      stroke: var(--primary);
    }

    .edge.ai-generated {
      stroke-dasharray: 5 5;
    }

    /* Chat Panel */
    .chat-panel {
      width: 380px;
      display: flex;
      flex-direction: column;
      background: var(--surface);
      border-left: 1px solid var(--border);
    }

    .chat-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      font-weight: 500;
    }

    .chat-header-icon {
      font-size: 18px;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      max-width: 90%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.5;
    }

    .message.user {
      align-self: flex-end;
      background: var(--primary);
      color: white;
      border-bottom-right-radius: 4px;
    }

    .message.assistant {
      align-self: flex-start;
      background: var(--surface-hover);
      border: 1px solid var(--border);
      border-bottom-left-radius: 4px;
    }

    .message-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .message-action {
      padding: 6px 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .message-action:hover {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
    }

    .typing-indicator {
      display: none;
      align-items: center;
      gap: 4px;
      padding: 10px 14px;
      background: var(--surface-hover);
      border: 1px solid var(--border);
      border-radius: 12px;
      border-bottom-left-radius: 4px;
      align-self: flex-start;
    }

    .typing-indicator.show {
      display: flex;
    }

    .typing-dot {
      width: 6px;
      height: 6px;
      background: var(--text-muted);
      border-radius: 50%;
      animation: typing 1.4s infinite;
    }

    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-4px); }
    }

    .chat-input-area {
      padding: 12px;
      border-top: 1px solid var(--border);
    }

    .chat-input-wrapper {
      display: flex;
      gap: 8px;
    }

    .chat-input {
      flex: 1;
      padding: 10px 14px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 13px;
      outline: none;
    }

    .chat-input:focus {
      border-color: var(--primary);
    }

    .chat-send {
      padding: 10px 16px;
      background: var(--primary);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .chat-send:hover {
      background: var(--primary-light);
    }

    /* Suggestions Panel */
    .suggestions {
      padding: 0 16px 16px;
    }

    .suggestion {
      padding: 10px 12px;
      background: var(--surface-hover);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 8px;
    }

    .suggestion-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .suggestion-severity {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      text-transform: uppercase;
    }

    .suggestion-severity.warning { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
    .suggestion-severity.info { background: rgba(14, 116, 144, 0.2); color: var(--primary-light); }
    .suggestion-severity.critical { background: rgba(239, 68, 68, 0.2); color: var(--error); }

    .suggestion-title {
      font-weight: 500;
      font-size: 13px;
    }

    .suggestion-desc {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .suggestion-actions {
      display: flex;
      gap: 8px;
    }

    .suggestion-btn {
      padding: 4px 10px;
      font-size: 11px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .suggestion-btn.accept {
      background: var(--primary);
      border: none;
      color: white;
    }

    .suggestion-btn.dismiss {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
    }

    /* Node Edit Modal */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }

    .modal-overlay.show {
      display: flex;
    }

    .modal {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      width: 400px;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-bottom: 1px solid var(--border);
    }

    .modal-title {
      font-weight: 600;
      font-size: 16px;
    }

    .modal-close {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 20px;
      cursor: pointer;
    }

    .modal-body {
      padding: 16px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-label {
      display: block;
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .form-input {
      width: 100%;
      padding: 8px 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 13px;
      outline: none;
    }

    .form-input:focus {
      border-color: var(--primary);
    }

    .form-select {
      width: 100%;
      padding: 8px 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 13px;
      outline: none;
    }

    .node-type-hint {
      margin-top: 8px;
      padding: 10px 12px;
      background: var(--bg);
      border-radius: 6px;
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.5;
      border-left: 3px solid var(--accent);
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px;
      border-top: 1px solid var(--border);
    }

    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-secondary {
      background: var(--surface-hover);
      border: 1px solid var(--border);
      color: var(--text);
    }

    .btn-primary {
      background: var(--primary);
      border: none;
      color: white;
    }

    .btn-danger {
      background: var(--error);
      border: none;
      color: white;
    }

    /* Templates Panel */
    .templates-panel {
      display: none;
      position: absolute;
      top: 60px;
      left: 20px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      width: 300px;
      z-index: 100;
    }

    .templates-panel.show {
      display: block;
    }

    .template-card {
      padding: 12px;
      background: var(--surface-hover);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .template-card:hover {
      border-color: var(--primary);
    }

    .template-name {
      font-weight: 500;
      margin-bottom: 4px;
    }

    .template-desc {
      font-size: 12px;
      color: var(--text-muted);
    }

    /* Generation Progress */
    .generation-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 2000;
      align-items: center;
      justify-content: center;
    }

    .generation-overlay.show {
      display: flex;
    }

    .generation-modal {
      background: var(--surface);
      border-radius: 12px;
      padding: 24px;
      width: 400px;
      text-align: center;
    }

    .generation-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
    }

    .generation-progress {
      margin-bottom: 16px;
    }

    .progress-bar {
      height: 8px;
      background: var(--border);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .progress-fill {
      height: 100%;
      background: var(--primary);
      transition: width 0.3s;
    }

    .progress-text {
      font-size: 12px;
      color: var(--text-muted);
    }

    .generation-files {
      text-align: left;
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: 16px;
    }

    .generation-file {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      font-size: 12px;
    }

    .file-status {
      width: 16px;
      height: 16px;
    }

    .file-status.pending { color: var(--text-muted); }
    .file-status.generating { color: var(--warning); animation: spin 1s linear infinite; }
    .file-status.done { color: var(--success); }
    .file-status.error { color: var(--error); }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Canvas Area -->
    <div class="canvas-area">
      <div class="toolbar">
        <div class="toolbar-group">
          <button class="toolbar-btn" onclick="setMode('select')" id="mode-select">
            <span>\u2196\uFE0F</span> Select
          </button>
          <button class="toolbar-btn" onclick="setMode('pan')" id="mode-pan">
            <span>\u270B</span> Pan
          </button>
        </div>
        <div class="toolbar-group">
          <button class="toolbar-btn" onclick="showAddNodeMenu()">
            <span>\u2795</span> Add Node
          </button>
          <button class="toolbar-btn" onclick="toggleTemplates()">
            <span>\u{1F4CB}</span> Templates
          </button>
        </div>
        <div class="toolbar-group">
          <button class="toolbar-btn" onclick="requestReview()">
            <span>\u{1F50D}</span> AI Review
          </button>
          <button class="toolbar-btn" onclick="runTests()">
            <span>\u{1F9EA}</span> Run Tests
          </button>
          <button class="toolbar-btn primary" onclick="generateCode()">
            <span>\u26A1</span> Generate
          </button>
        </div>
      </div>

      <div class="canvas-container" id="canvas-container">
        <svg class="edges-layer" id="edges-layer"></svg>
        <div class="canvas" id="canvas"></div>
      </div>

      <!-- Templates Panel -->
      <div class="templates-panel" id="templates-panel">
        <h3 style="margin-bottom: 12px;">Templates</h3>
        <div id="templates-list"></div>
      </div>
    </div>

    <!-- Chat Panel -->
    <div class="chat-panel">
      <div class="chat-header">
        <span class="chat-header-icon">\u{1F916}</span>
        <span>AI Architect</span>
      </div>

      <div class="chat-messages" id="chat-messages">
        <div class="typing-indicator" id="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>

      <div class="suggestions" id="suggestions"></div>

      <div class="chat-input-area">
        <div class="chat-input-wrapper">
          <input
            type="text"
            class="chat-input"
            id="chat-input"
            placeholder="Describe what you're building..."
            onkeypress="handleChatKeypress(event)"
          />
          <button class="chat-send" onclick="sendChat()">Send</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Node Edit Modal -->
  <div class="modal-overlay" id="node-modal">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Edit Node</span>
        <button class="modal-close" onclick="closeNodeModal()">&times;</button>
      </div>
      <div class="modal-body" id="node-modal-body">
        <!-- Dynamic content -->
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" onclick="deleteSelectedNode()">Delete</button>
        <button class="btn btn-secondary" onclick="closeNodeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveNodeChanges()">Save</button>
      </div>
    </div>
  </div>

  <!-- Add Node Menu -->
  <div class="modal-overlay" id="add-node-modal">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Add Node</span>
        <button class="modal-close" onclick="closeAddNodeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">What do you want to add?</label>
          <select class="form-select" id="new-node-type" onchange="updateNodeTypeDescription()">
            <option value="page">\u{1F4C4} Page - A screen users visit</option>
            <option value="component">\u{1F9E9} Component - Reusable UI block</option>
            <option value="api">\u{1F50C} API - Backend data handler</option>
            <option value="database">\u{1F5C4}\uFE0F Database - Store data permanently</option>
            <option value="type">\u{1F4DD} Type - Data blueprint</option>
            <option value="hook">\u{1FA9D} Hook - Reusable logic</option>
            <option value="service">\u2699\uFE0F Service - Helper module</option>
            <option value="context">\u{1F310} Context - Shared app data</option>
            <option value="action">\u26A1 Action - Form handler</option>
            <option value="middleware">\u{1F500} Middleware - Security check</option>
            <option value="job">\u23F0 Job - Background task</option>
          </select>
          <div id="node-type-hint" class="node-type-hint">
            A screen users can visit. Like the homepage, login page, or dashboard. Each page has its own URL.
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Name</label>
          <input type="text" class="form-input" id="new-node-name" placeholder="e.g., UserProfile" />
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" class="form-input" id="new-node-desc" placeholder="Brief description..." />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeAddNodeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="addNodeFromModal()">Add Node</button>
      </div>
    </div>
  </div>

  <!-- Generation Progress -->
  <div class="generation-overlay" id="generation-overlay">
    <div class="generation-modal">
      <div class="generation-title">Generating Code...</div>
      <div class="generation-progress">
        <div class="progress-bar">
          <div class="progress-fill" id="generation-progress-fill" style="width: 0%"></div>
        </div>
        <div class="progress-text" id="generation-progress-text">Preparing...</div>
      </div>
      <div class="generation-files" id="generation-files"></div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const NODE_COLORS = ${JSON.stringify(zr)};

    let plan = null;
    let templates = [];
    let selectedNodeId = null;
    let mode = 'select';
    let isDragging = false;
    let dragNode = null;
    let dragOffset = { x: 0, y: 0 };
    let generatingNodes = new Set();

    // Initialize
    window.addEventListener('message', event => {
      const message = event.data;
      handleExtensionMessage(message);
    });

    // Tell extension we're ready
    vscode.postMessage({ type: 'ready' });

    function handleExtensionMessage(message) {
      switch (message.type) {
        case 'init':
          plan = message.plan;
          templates = message.templates;
          renderPlan();
          renderTemplates();
          break;

        case 'plan-updated':
          plan = message.plan;
          renderPlan();
          break;

        case 'ai-message':
          addChatMessage(message.message);
          break;

        case 'ai-typing':
          document.getElementById('typing-indicator').classList.toggle('show', message.isTyping);
          scrollChat();
          break;

        case 'suggestion-added':
          renderSuggestions();
          break;

        case 'suggestion-removed':
          renderSuggestions();
          break;

        case 'generation-started':
          showGenerationOverlay(message.nodeIds);
          break;

        case 'generation-progress':
          updateGenerationProgress(message.nodeId, message.status, message.file);
          break;

        case 'generation-completed':
          hideGenerationOverlay(message.result);
          break;

        case 'error':
          alert(message.message);
          break;
      }
    }

    // Rendering
    function renderPlan() {
      if (!plan) return;

      const canvas = document.getElementById('canvas');
      canvas.innerHTML = '';

      // Render nodes
      plan.nodes.forEach(node => {
        const nodeEl = createNodeElement(node);
        canvas.appendChild(nodeEl);
      });

      // Render edges
      renderEdges();
    }

    function createNodeElement(node) {
      const colors = NODE_COLORS[node.type];
      const el = document.createElement('div');
      el.className = 'node' + (node.aiGenerated ? ' ai-suggested' : '') + (node.id === selectedNodeId ? ' selected' : '');
      el.id = 'node-' + node.id;
      el.style.left = node.position.x + 'px';
      el.style.top = node.position.y + 'px';

      el.innerHTML = \`
        <div class="node-header" style="background: \${colors.bg}; border-color: \${colors.border};">
          <span class="node-icon">\${colors.icon}</span>
          <span class="node-name">\${node.name}</span>
          <span class="node-type">\${node.type}</span>
        </div>
        <div class="node-body">\${node.description || 'No description'}</div>
        <div class="node-status">
          <span class="node-status-dot \${node.status}"></span>
          <span>\${node.status}</span>
        </div>
        <div class="connection-point top" data-pos="top"></div>
        <div class="connection-point right" data-pos="right"></div>
        <div class="connection-point bottom" data-pos="bottom"></div>
        <div class="connection-point left" data-pos="left"></div>
      \`;

      // Event listeners
      el.addEventListener('mousedown', e => handleNodeMouseDown(e, node));
      el.addEventListener('dblclick', () => openNodeModal(node));

      return el;
    }

    function renderEdges() {
      const svg = document.getElementById('edges-layer');
      svg.innerHTML = '';

      plan.edges.forEach(edge => {
        const sourceNode = plan.nodes.find(n => n.id === edge.source);
        const targetNode = plan.nodes.find(n => n.id === edge.target);

        if (!sourceNode || !targetNode) return;

        const sourceEl = document.getElementById('node-' + edge.source);
        const targetEl = document.getElementById('node-' + edge.target);

        if (!sourceEl || !targetEl) return;

        const sourceRect = {
          x: sourceNode.position.x + sourceEl.offsetWidth / 2,
          y: sourceNode.position.y + sourceEl.offsetHeight
        };

        const targetRect = {
          x: targetNode.position.x + targetEl.offsetWidth / 2,
          y: targetNode.position.y
        };

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midY = (sourceRect.y + targetRect.y) / 2;
        path.setAttribute('d', \`M \${sourceRect.x} \${sourceRect.y} C \${sourceRect.x} \${midY}, \${targetRect.x} \${midY}, \${targetRect.x} \${targetRect.y}\`);
        path.setAttribute('class', 'edge' + (edge.aiGenerated ? ' ai-generated' : ''));
        path.setAttribute('data-edge-id', edge.id);

        svg.appendChild(path);
      });
    }

    function renderTemplates() {
      const list = document.getElementById('templates-list');
      list.innerHTML = '';

      templates.forEach(template => {
        const card = document.createElement('div');
        card.className = 'template-card';
        card.innerHTML = \`
          <div class="template-name">\${template.name}</div>
          <div class="template-desc">\${template.description}</div>
        \`;
        card.onclick = () => useTemplate(template.id);
        list.appendChild(card);
      });
    }

    function renderSuggestions() {
      const container = document.getElementById('suggestions');
      container.innerHTML = '';

      if (!plan) return;

      const activeSuggestions = plan.suggestions.filter(s => !s.dismissed);

      activeSuggestions.forEach(suggestion => {
        const el = document.createElement('div');
        el.className = 'suggestion';
        el.innerHTML = \`
          <div class="suggestion-header">
            <span class="suggestion-severity \${suggestion.severity}">\${suggestion.severity}</span>
            <span class="suggestion-title">\${suggestion.title}</span>
          </div>
          <div class="suggestion-desc">\${suggestion.description}</div>
          <div class="suggestion-actions">
            <button class="suggestion-btn accept" onclick="acceptSuggestion('\${suggestion.id}')">Add</button>
            <button class="suggestion-btn dismiss" onclick="dismissSuggestion('\${suggestion.id}')">Dismiss</button>
          </div>
        \`;
        container.appendChild(el);
      });
    }

    // Chat
    function addChatMessage(message) {
      const container = document.getElementById('chat-messages');
      const typing = document.getElementById('typing-indicator');

      const el = document.createElement('div');
      el.className = 'message ' + message.role;
      el.innerHTML = formatMessage(message.content);

      if (message.suggestedActions && message.suggestedActions.length > 0) {
        const actionsEl = document.createElement('div');
        actionsEl.className = 'message-actions';

        message.suggestedActions.forEach(action => {
          if (action.status === 'pending') {
            const btn = document.createElement('button');
            btn.className = 'message-action';
            btn.textContent = action.label;
            btn.onclick = () => acceptAction(action.id);
            actionsEl.appendChild(btn);
          }
        });

        el.appendChild(actionsEl);
      }

      container.insertBefore(el, typing);
      scrollChat();
    }

    function formatMessage(content) {
      // Simple markdown formatting
      return content
        .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
        .replace(/\\n/g, '<br>');
    }

    function sendChat() {
      const input = document.getElementById('chat-input');
      const content = input.value.trim();

      if (!content) return;

      // Add user message locally
      addChatMessage({ role: 'user', content, timestamp: Date.now() });

      // Send to extension
      vscode.postMessage({ type: 'chat', content });

      input.value = '';
    }

    function handleChatKeypress(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    }

    function scrollChat() {
      const container = document.getElementById('chat-messages');
      container.scrollTop = container.scrollHeight;
    }

    // Node interactions
    function handleNodeMouseDown(e, node) {
      if (e.target.classList.contains('connection-point')) {
        // Start connection
        return;
      }

      if (mode === 'select') {
        selectedNodeId = node.id;
        renderPlan();

        // Start drag
        isDragging = true;
        dragNode = node;
        dragOffset = {
          x: e.clientX - node.position.x,
          y: e.clientY - node.position.y
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }
    }

    function handleMouseMove(e) {
      if (!isDragging || !dragNode) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Update node position
      dragNode.position.x = Math.max(0, newX);
      dragNode.position.y = Math.max(0, newY);

      // Update DOM
      const el = document.getElementById('node-' + dragNode.id);
      if (el) {
        el.style.left = dragNode.position.x + 'px';
        el.style.top = dragNode.position.y + 'px';
      }

      // Update edges
      renderEdges();
    }

    function handleMouseUp() {
      if (isDragging && dragNode) {
        // Send position update to extension
        vscode.postMessage({
          type: 'update-node',
          nodeId: dragNode.id,
          updates: { position: dragNode.position }
        });
      }

      isDragging = false;
      dragNode = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    function openNodeModal(node) {
      selectedNodeId = node.id;

      const body = document.getElementById('node-modal-body');
      body.innerHTML = \`
        <div class="form-group">
          <label class="form-label">Name</label>
          <input type="text" class="form-input" id="edit-node-name" value="\${node.name}" />
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" class="form-input" id="edit-node-desc" value="\${node.description || ''}" />
        </div>
        \${getTypeSpecificFields(node)}
      \`;

      document.getElementById('node-modal').classList.add('show');
    }

    function getTypeSpecificFields(node) {
      let html = '';

      switch (node.type) {
        case 'page':
          html = \`
            <div class="form-group">
              <label class="form-label">Route</label>
              <input type="text" class="form-input" id="edit-route" value="\${node.details.route || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">
                <input type="checkbox" id="edit-protected" \${node.details.isProtected ? 'checked' : ''} />
                Protected (requires auth)
              </label>
            </div>
          \`;
          break;

        case 'api':
          html = \`
            <div class="form-group">
              <label class="form-label">HTTP Method</label>
              <select class="form-select" id="edit-method">
                <option value="GET" \${node.details.httpMethod === 'GET' ? 'selected' : ''}>GET</option>
                <option value="POST" \${node.details.httpMethod === 'POST' ? 'selected' : ''}>POST</option>
                <option value="PUT" \${node.details.httpMethod === 'PUT' ? 'selected' : ''}>PUT</option>
                <option value="PATCH" \${node.details.httpMethod === 'PATCH' ? 'selected' : ''}>PATCH</option>
                <option value="DELETE" \${node.details.httpMethod === 'DELETE' ? 'selected' : ''}>DELETE</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">
                <input type="checkbox" id="edit-requires-auth" \${node.details.requiresAuth ? 'checked' : ''} />
                Requires Authentication
              </label>
            </div>
          \`;
          break;

        case 'database':
          html = \`
            <div class="form-group">
              <label class="form-label">Table Name</label>
              <input type="text" class="form-input" id="edit-table-name" value="\${node.details.tableName || ''}" />
            </div>
          \`;
          break;
      }

      return html;
    }

    function closeNodeModal() {
      document.getElementById('node-modal').classList.remove('show');
    }

    function saveNodeChanges() {
      if (!selectedNodeId) return;

      const updates = {
        name: document.getElementById('edit-node-name').value,
        description: document.getElementById('edit-node-desc').value,
        details: {}
      };

      const node = plan.nodes.find(n => n.id === selectedNodeId);

      // Get type-specific fields
      if (node.type === 'page') {
        updates.details.route = document.getElementById('edit-route')?.value;
        updates.details.isProtected = document.getElementById('edit-protected')?.checked;
      } else if (node.type === 'api') {
        updates.details.httpMethod = document.getElementById('edit-method')?.value;
        updates.details.requiresAuth = document.getElementById('edit-requires-auth')?.checked;
      } else if (node.type === 'database') {
        updates.details.tableName = document.getElementById('edit-table-name')?.value;
      }

      vscode.postMessage({ type: 'update-node', nodeId: selectedNodeId, updates });
      closeNodeModal();
    }

    function deleteSelectedNode() {
      if (!selectedNodeId) return;

      vscode.postMessage({ type: 'delete-node', nodeId: selectedNodeId });
      closeNodeModal();
      selectedNodeId = null;
    }

    // Add Node
    function showAddNodeMenu() {
      document.getElementById('add-node-modal').classList.add('show');
    }

    function closeAddNodeModal() {
      document.getElementById('add-node-modal').classList.remove('show');
    }

    // Beginner-friendly descriptions for each node type
    const nodeTypeDescriptions = {
      page: 'A screen users can visit. Like the homepage, login page, or dashboard. Each page has its own URL.',
      component: 'A reusable building block for your pages. Like a button, card, or navigation bar. Build once, use anywhere.',
      api: 'A backend endpoint that handles data. When users submit a form, log in, or load their profile, an API handles it.',
      database: 'A table to store your data permanently. Like a spreadsheet that saves users, orders, or posts.',
      type: 'A blueprint that defines the shape of your data. Like saying "a User has a name, email, and age". Helps prevent bugs.',
      hook: 'Reusable logic for your components. Like "fetch user data" or "track form input". Write once, use anywhere.',
      service: 'A helper module that does a specific job. Like sending emails, processing payments, or talking to external services.',
      context: 'Shared data that many components can access. Like the current user, theme (dark/light), or language.',
      action: 'A function that runs on the server when users submit forms. Handles creating posts, updating profiles, etc.',
      middleware: 'A security checkpoint that runs before pages load. Checks if users are logged in or have permission.',
      job: 'A task that runs automatically in the background. Like sending weekly emails or cleaning up old data.',
    };

    function updateNodeTypeDescription() {
      const select = document.getElementById('new-node-type');
      const hint = document.getElementById('node-type-hint');
      const description = nodeTypeDescriptions[select.value] || '';
      hint.textContent = description;
    }

    function addNodeFromModal() {
      const nodeType = document.getElementById('new-node-type').value;
      const name = document.getElementById('new-node-name').value || ('New' + nodeType.charAt(0).toUpperCase() + nodeType.slice(1));
      const description = document.getElementById('new-node-desc').value;

      // Calculate position (center of visible canvas)
      const canvas = document.getElementById('canvas-container');
      const position = {
        x: canvas.scrollLeft + canvas.offsetWidth / 2 - 90,
        y: canvas.scrollTop + canvas.offsetHeight / 2 - 50
      };

      vscode.postMessage({ type: 'add-node', nodeType, position });
      closeAddNodeModal();

      // Clear form
      document.getElementById('new-node-name').value = '';
      document.getElementById('new-node-desc').value = '';
    }

    // Templates
    function toggleTemplates() {
      document.getElementById('templates-panel').classList.toggle('show');
    }

    function useTemplate(templateId) {
      vscode.postMessage({ type: 'use-template', templateId });
      document.getElementById('templates-panel').classList.remove('show');
    }

    // Suggestions
    function acceptSuggestion(suggestionId) {
      vscode.postMessage({ type: 'accept-suggestion', suggestionId });
    }

    function dismissSuggestion(suggestionId) {
      vscode.postMessage({ type: 'dismiss-suggestion', suggestionId });
    }

    // Actions
    function acceptAction(actionId) {
      vscode.postMessage({ type: 'accept-action', actionId });
    }

    // AI Review
    function requestReview() {
      vscode.postMessage({ type: 'request-ai-review' });
    }

    // Run Tests
    function runTests() {
      vscode.postMessage({ type: 'run-tests' });
    }

    // Generation
    function generateCode() {
      if (!plan || plan.nodes.length === 0) {
        alert('Add some nodes to your plan first!');
        return;
      }

      vscode.postMessage({
        type: 'generate',
        request: {
          planId: plan.id,
          nodes: [],
          dryRun: false,
          usePatterns: true
        }
      });
    }

    function showGenerationOverlay(nodeIds) {
      generatingNodes = new Set(nodeIds);

      const filesContainer = document.getElementById('generation-files');
      filesContainer.innerHTML = '';

      nodeIds.forEach(nodeId => {
        const node = plan.nodes.find(n => n.id === nodeId);
        if (node) {
          const el = document.createElement('div');
          el.className = 'generation-file';
          el.id = 'gen-file-' + nodeId;
          el.innerHTML = \`
            <span class="file-status pending">\u23F3</span>
            <span>\${node.name}</span>
          \`;
          filesContainer.appendChild(el);
        }
      });

      document.getElementById('generation-overlay').classList.add('show');
      updateProgressBar();
    }

    function updateGenerationProgress(nodeId, status, file) {
      const el = document.getElementById('gen-file-' + nodeId);
      if (el) {
        const statusIcon = el.querySelector('.file-status');

        switch (status) {
          case 'generating':
            statusIcon.textContent = '\u23F3';
            statusIcon.className = 'file-status generating';
            break;
          case 'done':
            statusIcon.textContent = '\u2705';
            statusIcon.className = 'file-status done';
            generatingNodes.delete(nodeId);
            break;
          case 'error':
            statusIcon.textContent = '\u274C';
            statusIcon.className = 'file-status error';
            generatingNodes.delete(nodeId);
            break;
        }

        if (file && file.path) {
          el.querySelector('span:last-child').textContent = file.path;
        }
      }

      updateProgressBar();
    }

    function updateProgressBar() {
      const total = plan.nodes.length;
      const done = total - generatingNodes.size;
      const percent = (done / total) * 100;

      document.getElementById('generation-progress-fill').style.width = percent + '%';
      document.getElementById('generation-progress-text').textContent = \`\${done} / \${total} files\`;
    }

    function hideGenerationOverlay(result) {
      setTimeout(() => {
        document.getElementById('generation-overlay').classList.remove('show');

        if (result.success) {
          addChatMessage({
            role: 'assistant',
            content: \`Generated \${result.files.length} files successfully! Check your project folder.\`,
            timestamp: Date.now()
          });
        } else {
          addChatMessage({
            role: 'assistant',
            content: \`Generated \${result.files.length} files with \${result.errors.length} errors. Check the output for details.\`,
            timestamp: Date.now()
          });
        }
      }, 1000);
    }

    // Mode
    function setMode(newMode) {
      mode = newMode;
      document.querySelectorAll('.toolbar-btn').forEach(btn => btn.classList.remove('active'));
      document.getElementById('mode-' + newMode)?.classList.add('active');
    }

    // Canvas click to add node
    document.getElementById('canvas-container').addEventListener('dblclick', e => {
      if (e.target.id === 'canvas' || e.target.id === 'canvas-container') {
        showAddNodeMenu();
      }
    });
  </script>
</body>
</html>`}}});var Wr={};At(Wr,{AIPlanner:()=>Ja,BuildPlannerProvider:()=>Fo,CodeGenerator:()=>Za,NODE_COLORS:()=>zr,NODE_DEFAULTS:()=>jr});var Hr=f(()=>{"use strict";bc();Ur();qr();Vr()});var b0={};At(b0,{activate:()=>f0,deactivate:()=>v0});module.exports=Ec(b0);var A=L(require("vscode")),Yr,Xr,Kr,Jr,$o,Oo,je,Ne,ya,ze,is,jo=null;async function h0(){try{return console.log("CodeBakers: Loading ChatPanelProvider..."),Yr=(await Promise.resolve().then(()=>(cd(),ld))).ChatPanelProvider,console.log("CodeBakers: ChatPanelProvider loaded"),console.log("CodeBakers: Loading CodeBakersClient..."),Xr=(await Promise.resolve().then(()=>(lc(),pc))).CodeBakersClient,console.log("CodeBakers: CodeBakersClient loaded"),console.log("CodeBakers: Loading ProjectContext..."),Kr=(await Promise.resolve().then(()=>(mc(),cc))).ProjectContext,console.log("CodeBakers: ProjectContext loaded"),console.log("CodeBakers: Loading FileOperations..."),Jr=(await Promise.resolve().then(()=>(Uo(),ad))).DiffContentProvider,console.log("CodeBakers: FileOperations loaded"),console.log("CodeBakers: Loading MindMapPanelProvider..."),$o=(await Promise.resolve().then(()=>(Or(),$r))).MindMapPanelProvider,console.log("CodeBakers: MindMapPanelProvider loaded"),console.log("CodeBakers: Loading BuildPlannerProvider..."),Oo=(await Promise.resolve().then(()=>(Hr(),Wr))).BuildPlannerProvider,console.log("CodeBakers: BuildPlannerProvider loaded"),console.log("CodeBakers: All modules loaded successfully"),!0}catch(n){let e=n?.message||n?.toString()||"Unknown error",t=n?.stack||"";return console.error("CodeBakers: Failed to load modules:",e),console.error("CodeBakers: Stack:",t),jo=`Module load failed: ${e}`,!1}}async function Lo(n){if(!await Kt())return;let t=A.window.activeTextEditor;if(!t){A.window.showWarningMessage("No active editor");return}let a=t.selection;if(a.isEmpty){A.window.showWarningMessage("No text selected");return}let s=t.document.getText(a),o=t.document.fileName,i=A.workspace.asRelativePath(o),r=t.document.languageId,d=a.start.line+1,p=a.end.line+1,l="";switch(n){case"ask":l=`I have a question about this code from ${i} (lines ${d}-${p}):

\`\`\`${r}
${s}
\`\`\`

`;break;case"explain":l=`Please explain this code from ${i} (lines ${d}-${p}):

\`\`\`${r}
${s}
\`\`\``;break;case"refactor":l=`Please refactor this code from ${i} (lines ${d}-${p}) to improve readability, performance, or follow best practices:

\`\`\`${r}
${s}
\`\`\``;break;case"tests":l=`Please write tests for this code from ${i} (lines ${d}-${p}):

\`\`\`${r}
${s}
\`\`\``;break}try{je.show(),n==="ask"?je.setInputWithContext(l):await je.sendMessage(l)}catch(c){console.error("CodeBakers: Error handling selection command:",c),A.window.showErrorMessage(`CodeBakers error: ${c}`)}}async function Kt(){if(Ne&&ya&&je)return console.log("CodeBakers: Already initialized"),!0;if((!Yr||!Xr||!Kr)&&(console.log("CodeBakers: Modules not loaded, loading now..."),!await h0()))return A.window.showErrorMessage(`CodeBakers: ${jo}`),!1;try{return console.log("CodeBakers: Initializing components..."),Ne||(console.log("CodeBakers: Creating CodeBakersClient..."),Ne=new Xr(is),console.log("CodeBakers: CodeBakersClient created successfully")),ya||(console.log("CodeBakers: Creating ProjectContext..."),ya=new Kr,console.log("CodeBakers: ProjectContext created successfully")),je||(console.log("CodeBakers: Creating ChatPanelProvider..."),je=Yr.getInstance(is,Ne,ya),console.log("CodeBakers: ChatPanelProvider created successfully")),console.log("CodeBakers: All components initialized successfully"),!0}catch(n){let e=n?.message||n?.toString()||"Unknown error";return console.error("CodeBakers: Component initialization failed:",e),console.error("CodeBakers: Stack:",n?.stack||"no stack"),jo=`Init failed: ${e}`,A.window.showErrorMessage(`CodeBakers: ${jo}`),!1}}function f0(n){console.log("CodeBakers: activate() called - v1.0.106"),is=n;try{console.log("CodeBakers: Registering commands..."),n.subscriptions.push(A.commands.registerCommand("codebakers.openChat",async()=>{if(console.log("CodeBakers: openChat command executed"),!await Kt()){A.window.showErrorMessage("CodeBakers failed to initialize. Please try reloading VS Code.");return}try{Ne.hasSessionToken()||A.window.showWarningMessage("\u{1F36A} Sign in to CodeBakers to start your free trial","Sign In with GitHub").then(t=>{t==="Sign In with GitHub"&&Ne.login()}),je.show()}catch(t){console.error("CodeBakers: Error in openChat:",t),A.window.showErrorMessage(`CodeBakers error: ${t}`)}})),n.subscriptions.push(A.commands.registerCommand("codebakers.login",async()=>{if(console.log("CodeBakers: login command executed"),!!await Kt())try{await Ne.login()}catch(t){console.error("CodeBakers: Login error:",t),A.window.showErrorMessage(`Login failed: ${t}`)}})),n.subscriptions.push(A.commands.registerCommand("codebakers.logout",async()=>{if(console.log("CodeBakers: logout command executed"),!!await Kt())try{await Ne.logout(),je.refresh(),Gr()}catch(t){console.error("CodeBakers: Logout error:",t)}})),n.subscriptions.push(A.commands.registerCommand("codebakers.showPatterns",async()=>{if(await Kt())try{let t=await Ne.getAvailablePatterns(),a=A.window.createQuickPick();a.items=t.map(s=>({label:s.name,description:s.description})),a.title="Available CodeBakers Patterns",a.show()}catch(t){console.error("CodeBakers: Error showing patterns:",t)}})),n.subscriptions.push(A.commands.registerCommand("codebakers.runAudit",async()=>{if(await Kt())try{je.show(),await je.sendMessage("/audit")}catch(t){console.error("CodeBakers: Error running audit:",t)}})),n.subscriptions.push(A.commands.registerCommand("codebakers.askAboutSelection",async()=>{console.log("CodeBakers: askAboutSelection command executed"),await Lo("ask")})),n.subscriptions.push(A.commands.registerCommand("codebakers.explainSelection",async()=>{console.log("CodeBakers: explainSelection command executed"),await Lo("explain")})),n.subscriptions.push(A.commands.registerCommand("codebakers.refactorSelection",async()=>{console.log("CodeBakers: refactorSelection command executed"),await Lo("refactor")})),n.subscriptions.push(A.commands.registerCommand("codebakers.addTestsForSelection",async()=>{console.log("CodeBakers: addTestsForSelection command executed"),await Lo("tests")})),n.subscriptions.push(A.commands.registerCommand("codebakers.openMindMap",async()=>{if(console.log("CodeBakers: openMindMap command executed"),!$o)try{$o=(await Promise.resolve().then(()=>(Or(),$r))).MindMapPanelProvider}catch(e){console.error("CodeBakers: Failed to load MindMap module:",e),A.window.showErrorMessage("Failed to load Mind Map module");return}try{$o.createOrShow(is.extensionUri).analyze()}catch(e){console.error("CodeBakers: Error opening mind map:",e),A.window.showErrorMessage(`Mind Map error: ${e}`)}})),n.subscriptions.push(A.commands.registerCommand("codebakers.openBuildPlanner",async()=>{if(console.log("CodeBakers: openBuildPlanner command executed"),!Oo)try{Oo=(await Promise.resolve().then(()=>(Hr(),Wr))).BuildPlannerProvider}catch(e){console.error("CodeBakers: Failed to load Build Planner module:",e),A.window.showErrorMessage("Failed to load Build Planner module");return}try{Oo.createOrShow(is.extensionUri)}catch(e){console.error("CodeBakers: Error opening build planner:",e),A.window.showErrorMessage(`Build Planner error: ${e}`)}})),console.log("CodeBakers: All 11 commands registered successfully")}catch(e){console.error("CodeBakers: FATAL - Command registration failed:",e),A.window.showErrorMessage(`CodeBakers FATAL: Failed to register commands - ${e}`);return}try{ze=A.window.createStatusBarItem(A.StatusBarAlignment.Right,100),ze.text="$(code) CodeBakers",ze.tooltip="Open CodeBakers Chat (Ctrl+Alt+C)",ze.command="codebakers.openChat",ze.show(),n.subscriptions.push(ze),console.log("CodeBakers: Status bar created")}catch(e){console.error("CodeBakers: Status bar failed:",e)}try{if(Jr){let e=new Jr;n.subscriptions.push(A.workspace.registerTextDocumentContentProvider("codebakers-diff",e)),console.log("CodeBakers: Diff content provider registered")}}catch(e){console.error("CodeBakers: Diff provider registration failed:",e)}try{n.subscriptions.push(A.window.registerUriHandler({handleUri:async e=>{if(console.log("CodeBakers: URI callback received:",e.toString()),!(!e.path.includes("callback")||!await Kt()))try{let a=new URLSearchParams(e.query),s=a.get("token"),o=a.get("error");if(o){A.window.showErrorMessage(`Login failed: ${a.get("message")||o}`);return}s?await Ne.handleOAuthCallback(s)&&(je.refresh(),Gr(),je.show()):A.window.showErrorMessage("Login failed: No token received")}catch(a){console.error("CodeBakers: URI handler error:",a),A.window.showErrorMessage(`OAuth error: ${a}`)}}})),console.log("CodeBakers: URI handler registered")}catch(e){console.error("CodeBakers: URI handler registration failed:",e)}setTimeout(async()=>{try{if(await Kt()){Gr(),Ne.hasSessionToken()||A.window.showInformationMessage("\u{1F36A} CodeBakers installed! Click the CodeBakers button in the status bar to get started.","Sign In Now").then(t=>{t==="Sign In Now"&&Ne.login()});try{let t=A.workspace.createFileSystemWatcher("**/*.{ts,tsx,js,jsx}");t.onDidChange(()=>ya?.invalidateCache()),t.onDidCreate(()=>ya?.invalidateCache()),t.onDidDelete(()=>ya?.invalidateCache()),n.subscriptions.push(t)}catch(t){console.warn("CodeBakers: File watcher failed:",t)}}}catch(e){console.error("CodeBakers: Background init failed:",e)}},500),console.log("CodeBakers: activate() completed - v1.0.106")}function Gr(){if(ze)try{if(Ne?.hasSessionToken()){let n=Ne.getPlanInfo();ze.text=`$(code) CodeBakers [${n.plan}]`,ze.backgroundColor=void 0}else ze.text="$(code) CodeBakers (Sign In)",ze.backgroundColor=new A.ThemeColor("statusBarItem.warningBackground")}catch{ze.text="$(code) CodeBakers"}}function v0(){console.log("CodeBakers: deactivate() called")}0&&(module.exports={activate,deactivate});
/*! Bundled license information:

web-streams-polyfill/dist/ponyfill.mjs:
  (**
   * @license
   * web-streams-polyfill v4.0.0-beta.3
   * Copyright 2021 Mattias Buelens, Diwank Singh Tomer and other contributors.
   * This code is released under the MIT license.
   * SPDX-License-Identifier: MIT
   *)

formdata-node/lib/esm/blobHelpers.js:
formdata-node/lib/esm/Blob.js:
  (*! Based on fetch-blob. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> & David Frank *)

humanize-ms/index.js:
  (*!
   * humanize-ms - index.js
   * Copyright(c) 2014 dead_horse <dead_horse@qq.com>
   * MIT Licensed
   *)

node-domexception/index.js:
  (*! node-domexception. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> *)
*/
