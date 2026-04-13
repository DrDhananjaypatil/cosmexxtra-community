import { useState, useEffect } from "react";

const ADMINS=["drjpatil@gmail.com","absoluteinstituteedu@gmail.com"];
const TOPICS=["Skin Disorders","Chemical Peels","Botox & Fillers","Laser Treatments","Hair Restoration","Body Contouring","Ethics","Patient Safety"];
const AK="REPLACE_WITH_ENV_KEY";
const getIST=()=>new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
const ds=d=>d.toISOString().split("T")[0];
const fD=s=>new Date(s+"T12:00:00").toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
const dN=s=>new Date(s+"T12:00:00").toLocaleDateString("en-IN",{weekday:"short"});

const c={card:{background:"linear-gradient(145deg,#0c3535,#104545)",border:"1px solid rgba(200,168,78,.15)",borderRadius:12,padding:16,boxShadow:"0 4px 20px rgba(0,0,0,.3)",marginBottom:12},btn:{padding:"8px 18px",background:"linear-gradient(135deg,#c8a84e,#a08030)",color:"#061e1e",border:"none",borderRadius:8,fontWeight:600,cursor:"pointer",fontSize:".83rem"},btnO:{padding:"8px 18px",background:"rgba(200,168,78,.12)",color:"#c8a84e",border:"1px solid rgba(200,168,78,.3)",borderRadius:8,cursor:"pointer",fontSize:".83rem"},inp:{width:"100%",padding:"8px 12px",background:"rgba(0,0,0,.3)",border:"1px solid rgba(200,168,78,.2)",borderRadius:8,color:"#f0ede4",fontSize:".85rem",boxSizing:"border-box"},tag:(bg,cl)=>({fontSize:".63rem",padding:"2px 7px",borderRadius:20,fontWeight:600,background:bg,color:cl,display:"inline-block"}),av:(sz,bg)=>({width:sz,height:sz,minWidth:sz,borderRadius:"50%",background:bg||"#148f8f",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#fff",fontSize:sz*.35})};

const arts=[{id:"a1",title:"Understanding Melasma: Comprehensive Guide",cat:"Skin",author:"Dr. J Patil",date:"2026-04-10",body:"Melasma is a chronic pigmentary disorder. Covers evidence-based approaches: topical therapy, chemical peels, lasers, and combination protocols for Indian skin types. Key considerations include Fitzpatrick typing, hormonal factors, and realistic expectation setting.",feat:true},{id:"a2",title:"Chemical Peels for Indian Skin Types",cat:"Peels",author:"Dr. J Patil",date:"2026-04-08",body:"Fitzpatrick types IV-VI require careful peel selection. Covers glycolic, salicylic, TCA, and combination protocols to avoid PIH."},{id:"a3",title:"PRP in Hair Restoration: Evidence Review",cat:"Hair",author:"Dr. J Patil",date:"2026-04-05",body:"PRP shows promise in androgenetic alopecia. Reviews preparation, injection protocols, and combination approaches with minoxidil."}];
const res=[{id:"r1",t:"Laser Safety Protocols",pg:42,sz:"3.2MB",free:true,ic:"📄"},{id:"r2",t:"Fitzpatrick Classification",pg:8,sz:"1.1MB",free:true,ic:"📊"},{id:"r3",t:"Botox Injection Atlas",pg:64,sz:"8.5MB",free:false,ic:"📕"},{id:"r4",t:"Chemical Peel Guide",pg:24,sz:"2MB",free:true,ic:"📋"},{id:"r5",t:"Dermatoscopy Manual",pg:156,sz:"22MB",free:false,ic:"📚"}];
const vids=[{id:"v1",t:"Nd:YAG Laser Toning Demo",dur:"45m",cat:"Laser",ic:"🎥",free:true,desc:"Live demo on Fitzpatrick IV skin."},{id:"v2",t:"Thread Lift Masterclass",dur:"1h20m",cat:"Threads",ic:"🎓",free:false,desc:"PDO, PCL, PLLA thread techniques."},{id:"v3",t:"PRP Hair Restoration",dur:"35m",cat:"Hair",ic:"💉",free:true,desc:"Step-by-step PRP preparation."},{id:"v4",t:"Advanced Chemical Peels",dur:"55m",cat:"Peels",ic:"🧪",free:false,desc:"Combination peel protocols."}];
const initForum=[{id:"f1",author:"Dr. Priya S",ini:"PS",title:"Best PIH protocol for type V?",cat:"Skin",rep:8,lik:12,time:"2h ago",body:"Severe PIH post-acne, Fitzpatrick V. Recommendations?"},{id:"f2",author:"Dr. Rahul M",ini:"RM",title:"PCL thread experiences?",cat:"Threads",rep:5,lik:7,time:"5h ago",body:"Real-world results for mid-face lifting?"}];
const initQuiz=[{id:"s1",date:ds(getIST()),cat:"Laser",diff:"Advanced",scen:"32F, Fitzpatrick IV, bilateral malar hyperpigmentation, on OCPs 3 years. Requests laser.",q:"Most appropriate laser approach?",opts:["Ablative CO₂ resurfacing","Low-fluence Q-switched Nd:YAG + sun protection + topicals","High-intensity IPL max settings"],ci:1,expl:"<p><b>B is correct</b> — Low-fluence 1064nm Nd:YAG safely breaks melanin in type IV. A causes PIH. C risks burns.</p>",cmts:[{id:1,n:"Dr. Priya S",ini:"PS",txt:"Add tranexamic acid too!",tm:"11:30 AM"}]}];

export default function App(){
  const[scr,setScr]=useState("login");
  const[pg,setPg]=useState("home");
  const[user,setUser]=useState(null);
  const[quiz,setQuiz]=useState(initQuiz);
  const[ans,setAns]=useState({});
  const[forum,setForum]=useState(initForum);
  const[selD,setSelD]=useState(ds(getIST()));
  const[selA,setSelA]=useState(null);
  const[selV,setSelV]=useState(null);
  const[toast,setToast]=useState(null);
  const[cmt,setCmt]=useState("");
  const[newP,setNewP]=useState(false);
  const[fpT,setFpT]=useState("");
  const[fpB,setFpB]=useState("");
  const[fpC,setFpC]=useState(TOPICS[0]);
  const[ld,setLd]=useState(false);
  const[aTab,setATab]=useState("stats");
  const[pf,setPf]=useState({name:"",degree:"",clinic:"",email:""});

  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(null),2500);return()=>clearTimeout(t)}},[toast]);

  const isAdm=user&&ADMINS.includes(user.email);
  const isPd=user?.paid;
  const today=ds(getIST());
  const hr=getIST().getHours();
  const totA=Object.keys(ans).length;
  const corr=Object.entries(ans).filter(([d,a])=>{const q=quiz.find(x=>x.date===d);return q&&a===q.ci}).length;
  const acc=totA?Math.round(corr/totA*100):0;
  const sh=m=>setToast(m);
  const go=p=>{setPg(p);setSelA(null);setSelV(null)};

  const genQ=async()=>{if(quiz.find(q=>q.date===today)){sh("Exists!");return}setLd(true);const tp=TOPICS[Math.floor(Math.random()*TOPICS.length)];try{const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":AK,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1500,messages:[{role:"user",content:`Master cosmetologist. Clinical quiz. Topic:${tp}. Case scenario, 3 opts, 1 correct. JSON ONLY: {"category":"...","difficulty":"...","scenario":"...","question":"...","options":["A","B","C"],"correctIndex":0,"explanation":"<p>...</p>"}`}]})});const data=await r.json();const q=JSON.parse(data.content[0].text.replace(/```json\s*/g,"").replace(/```/g,"").trim());setQuiz(p=>[{id:"ai_"+today,date:today,cat:q.category,diff:q.difficulty,scen:q.scenario,q:q.question,opts:q.options,ci:q.correctIndex,expl:q.explanation,cmts:[]},...p]);sh("Live!")}catch{sh("Failed")}setLd(false)};

  if(scr==="login")return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#061e1e,#0a3d3d 50%,#0d6b6e)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"system-ui"}}>
      <div style={{...c.av(80,"linear-gradient(135deg,#0d6b6e,#0a3d3d)"),border:"3px solid #c8a84e",boxShadow:"0 0 30px rgba(200,168,78,.3)",marginBottom:16,fontSize:"2rem"}}>🌿</div>
      <h1 style={{fontSize:"2rem",fontWeight:800,background:"linear-gradient(135deg,#e8d48b,#c8a84e)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CosMExxtra</h1>
      <p style={{fontSize:".65rem",color:"#6a8a8a",letterSpacing:3,textTransform:"uppercase",margin:"4px 0 8px"}}>Professional Aesthetic Community</p>
      <p style={{color:"#a0b8b8",fontSize:".82rem",textAlign:"center",maxWidth:350,lineHeight:1.6,marginBottom:24}}>Daily quizzes, articles, resources, video masterclasses & a vibrant practitioner community.</p>
      <button onClick={()=>{const n=prompt("Full name (Dr. ...):"); if(!n)return; const e=prompt("Email:"); if(!e)return; setPf({name:n,email:e,degree:"",clinic:""});setScr("setup")}} style={{display:"flex",alignItems:"center",gap:8,background:"#fff",color:"#333",border:"none",padding:"11px 24px",borderRadius:50,fontSize:".95rem",fontWeight:600,cursor:"pointer"}}>
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Sign in with Google
      </button>
      <div style={{marginTop:24,display:"flex",gap:14,fontSize:".65rem",color:"#6a8a8a"}}>{["🧠Quiz","📚Library","🎥Videos","💬Forum"].map(t=><span key={t}>{t}</span>)}</div>
      <p style={{marginTop:20,fontSize:".55rem",color:"#6a8a8a",letterSpacing:2,textTransform:"uppercase"}}>Powered by ABSOLUTE INSTITUTE</p>
    </div>
  );

  if(scr==="setup")return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#061e1e,#0a3d3d)",padding:16,fontFamily:"system-ui",color:"#f0ede4"}}>
      <div style={{maxWidth:460,margin:"0 auto"}}><div style={{...c.card,borderColor:"rgba(200,168,78,.3)"}}>
        <h2 style={{color:"#c8a84e",fontSize:"1.15rem",fontWeight:700,marginBottom:14}}>Complete Profile</h2>
        {[["name","Full Name"],["degree","Degree"],["clinic","Clinic"],["address","City"]].map(([k,l])=><div key={k} style={{marginBottom:10}}><label style={{display:"block",fontSize:".72rem",color:"#c8a84e",marginBottom:3}}>{l}</label><input value={pf[k]||""} onChange={e=>setPf(p=>({...p,[k]:e.target.value}))} placeholder={l} style={c.inp}/></div>)}
        <button onClick={()=>{if(!pf.name||!pf.degree){sh("Name & Degree required");return}const ini=pf.name.replace(/^Dr\.?\s*/i,"").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);setUser({...pf,initials:ini,paid:false,joined:ds(getIST())});setScr("main");sh("Welcome!")}} style={{...c.btn,width:"100%",marginTop:6}}>Save & Enter →</button>
      </div></div>
    </div>
  );

  const navs=[{id:"home",ic:"🏠",l:"Home"},{id:"quiz",ic:"🧠",l:"Quiz"},{id:"library",ic:"📚",l:"Library"},{id:"videos",ic:"🎥",l:"Videos"},{id:"forum",ic:"💬",l:"Forum"},{id:"rank",ic:"🏆",l:"Rank"},{id:"me",ic:"👤",l:"Me"},...(isAdm?[{id:"admin",ic:"⚙",l:"Admin"}]:[])];
  const qObj=quiz.find(q=>q.date===selD);const uA=ans[selD];const isT=selD===today;const rev=!isT||hr>=21;const dd=Math.floor((new Date(today)-new Date(selD))/864e5);const canA=uA===undefined&&(isT||(dd<=3&&dd>0));
  const dates=Array.from({length:14},(_,i)=>{let d=new Date(getIST());d.setDate(d.getDate()-(13-i));return ds(d)});

  return(
    <div style={{minHeight:"100vh",background:"#061e1e",fontFamily:"system-ui",color:"#f0ede4"}}>
      <div style={{position:"fixed",inset:0,background:"radial-gradient(ellipse at 20% 0%,rgba(13,107,110,.2),transparent 60%)",pointerEvents:"none",zIndex:0}}/>
      <div style={{position:"sticky",top:0,zIndex:100,background:"linear-gradient(135deg,#061e1eee,#0a3d3dee)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(200,168,78,.15)",padding:"6px 8px"}}>
        <div style={{maxWidth:840,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer"}} onClick={()=>go("home")}>
            <div style={{...c.av(28,"linear-gradient(135deg,#0d6b6e,#0a3d3d)"),border:"2px solid #c8a84e",fontSize:".75rem"}}>🌿</div>
            <div><div style={{fontSize:".9rem",fontWeight:700,background:"linear-gradient(135deg,#e8d48b,#c8a84e)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CosMExxtra</div></div>
          </div>
          <div style={{display:"flex",gap:1,overflowX:"auto"}}>{navs.map(n=><button key={n.id} onClick={()=>go(n.id)} style={{background:pg===n.id?"rgba(200,168,78,.1)":"none",border:`1px solid ${pg===n.id?"rgba(200,168,78,.3)":"transparent"}`,color:pg===n.id?"#c8a84e":"#a0b8b8",padding:"3px 5px",borderRadius:6,cursor:"pointer",fontSize:".5rem",display:"flex",flexDirection:"column",alignItems:"center",minWidth:32}}><span style={{fontSize:".7rem"}}>{n.ic}</span>{n.l}</button>)}</div>
        </div>
      </div>
      <div style={{position:"relative",zIndex:1,maxWidth:840,margin:"0 auto",padding:"10px 8px"}}>

      {pg==="home"&&!selA&&<div>
        <div style={{...c.card,borderColor:"rgba(200,168,78,.25)",textAlign:"center",padding:18,background:"linear-gradient(135deg,#0c3535,rgba(13,107,110,.1))"}}>
          <h2 style={{color:"#c8a84e",fontSize:"1.2rem",fontWeight:700,marginBottom:4}}>Welcome, {user.name.split(" ")[0]} 👋</h2>
          <p style={{color:"#a0b8b8",fontSize:".8rem",lineHeight:1.5}}>Daily quizzes, expert insights & community.</p>
          <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:10,flexWrap:"wrap"}}><button onClick={()=>go("quiz")} style={c.btn}>🧠 Today's Quiz</button><button onClick={()=>go("forum")} style={c.btnO}>💬 Forum</button></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginBottom:12}}>{[["🧠",totA,"Quizzes"],["✅",acc+"%","Accuracy"],["📚",res.length,"PDFs"],["🎥",vids.length,"Videos"]].map(([i,v,l])=><div key={l} style={{textAlign:"center",padding:"7px 2px",background:"rgba(0,0,0,.2)",borderRadius:8,border:"1px solid rgba(200,168,78,.06)"}}><div>{i}</div><div style={{fontWeight:700,color:"#c8a84e"}}>{v}</div><div style={{fontSize:".48rem",color:"#6a8a8a",textTransform:"uppercase"}}>{l}</div></div>)}</div>
        <h3 style={{color:"#c8a84e",fontSize:".88rem",fontWeight:700,marginBottom:8}}>📰 Articles</h3>
        {arts.map(a=><div key={a.id} onClick={()=>setSelA(a)} style={{...c.card,cursor:"pointer"}}><div style={{display:"flex",gap:4,marginBottom:4}}><span style={c.tag("rgba(20,143,143,.2)","#1ab5a5")}>{a.cat}</span>{a.feat&&<span style={c.tag("rgba(200,168,78,.2)","#c8a84e")}>Featured</span>}</div><h4 style={{fontSize:".85rem",fontWeight:600,lineHeight:1.3}}>{a.title}</h4><p style={{fontSize:".67rem",color:"#6a8a8a",marginTop:2}}>{a.author} • {fD(a.date)}</p></div>)}
      </div>}
      {pg==="home"&&selA&&<div><button onClick={()=>setSelA(null)} style={{...c.btnO,marginBottom:8,padding:"4px 10px",fontSize:".72rem"}}>← Back</button><div style={c.card}><span style={c.tag("rgba(200,168,78,.15)","#c8a84e")}>{selA.cat}</span><h2 style={{color:"#c8a84e",fontSize:"1.1rem",fontWeight:700,marginTop:6,lineHeight:1.3}}>{selA.title}</h2><p style={{fontSize:".72rem",color:"#6a8a8a",marginTop:4}}>By {selA.author} • {fD(selA.date)}</p><p style={{fontSize:".85rem",color:"#a0b8b8",marginTop:12,lineHeight:1.7}}>{selA.body}</p></div></div>}

      {pg==="quiz"&&<div>
        <div style={{display:"flex",gap:3,overflowX:"auto",padding:"2px 0 7px"}}>{dates.map(d=>{const dt=new Date(d+"T12:00:00");const sun=dt.getDay()===0;const on=d===selD;return<div key={d} onClick={()=>!sun&&setSelD(d)} style={{minWidth:40,padding:"4px 2px",textAlign:"center",borderRadius:7,border:`1px solid ${on?"#c8a84e":"rgba(200,168,78,.06)"}`,cursor:sun?"not-allowed":"pointer",background:on?"linear-gradient(135deg,#c8a84e,#a08030)":"rgba(0,0,0,.12)",opacity:sun?.3:1}}><div style={{fontSize:".48rem",color:on?"#061e1e":"#6a8a8a",textTransform:"uppercase"}}>{dN(d)}</div><div style={{fontSize:".82rem",fontWeight:700,color:on?"#061e1e":"#f0ede4"}}>{dt.getDate()}</div></div>})}</div>
        {ld&&<div style={{textAlign:"center",padding:30,color:"#6a8a8a"}}>⏳ Generating...</div>}
        {!ld&&!qObj&&<div style={{...c.card,textAlign:"center",padding:24}}>{selD===today?<><p style={{fontSize:"1.3rem"}}>🔬</p><p style={{color:"#6a8a8a",fontSize:".8rem",margin:"6px 0 8px"}}>10 AM IST</p>{isAdm&&<button onClick={genQ} style={c.btn}>🤖 Generate</button>}</>:<p style={{color:"#6a8a8a"}}>No question</p>}</div>}
        {!ld&&qObj&&<><div style={{...c.card,borderColor:"rgba(200,168,78,.2)"}}>
          <div style={{display:"flex",gap:3,marginBottom:6,flexWrap:"wrap",fontSize:".7rem",color:"#6a8a8a"}}>📅{fD(qObj.date)} {isT&&hr<21&&<span style={c.tag("#2ecc71","#fff")}>LIVE</span>}{rev&&!isT&&<span style={c.tag("#e74c3c","#fff")}>CLOSED</span>}</div>
          <div style={{display:"flex",gap:3,marginBottom:7}}><span style={c.tag("rgba(200,168,78,.15)","#c8a84e")}>{qObj.cat}</span><span style={c.tag("rgba(20,143,143,.2)","#1ab5a5")}>{qObj.diff}</span></div>
          {qObj.scen&&<div style={{background:"rgba(0,0,0,.18)",borderLeft:"3px solid #c8a84e",padding:"7px 10px",marginBottom:10,borderRadius:"0 7px 7px 0",fontSize:".8rem",color:"#a0b8b8",lineHeight:1.5}}>{qObj.scen}</div>}
          <div style={{fontSize:".95rem",fontWeight:600,lineHeight:1.5,marginBottom:10}}>{qObj.q}</div>
          {qObj.opts.map((o,i)=>{const l="ABC"[i];const sr=uA!==undefined||(rev&&!canA);const co=sr&&i===qObj.ci;const wr=sr&&i===uA&&uA!==qObj.ci;
            return<div key={i} onClick={()=>canA&&setAns(p=>{const n={...p,[selD]:i};const q=quiz.find(x=>x.date===selD);sh(q&&i===q.ci?"🎉 Correct!":"Recorded.");return n})} style={{display:"flex",alignItems:"flex-start",gap:7,padding:"8px 10px",background:co?"rgba(46,204,113,.1)":wr?"rgba(231,76,60,.1)":"rgba(0,0,0,.12)",border:`1px solid ${co?"#2ecc71":wr?"#e74c3c":"rgba(200,168,78,.06)"}`,borderRadius:8,marginBottom:5,cursor:canA?"pointer":"default",opacity:!canA&&!sr?.55:1}}>
              <div style={{...c.av(20,co?"#2ecc71":wr?"#e74c3c":"rgba(200,168,78,.2)"),color:co||wr?"#fff":"#c8a84e",fontSize:".65rem"}}>{l}</div>
              <div style={{fontSize:".8rem",lineHeight:1.4}}>{o}</div>
            </div>})}
          {uA!==undefined&&<p style={{color:uA===qObj.ci?"#2ecc71":"#e74c3c",fontWeight:600,fontSize:".8rem",marginTop:5}}>{uA===qObj.ci?"✓ Correct!":"✗ Wrong"}</p>}
          {((uA!==undefined&&rev)||(!canA&&rev&&dd>0))&&<div style={{background:"rgba(200,168,78,.05)",border:"1px solid rgba(200,168,78,.1)",borderRadius:9,padding:10,marginTop:7}}><b style={{color:"#c8a84e",fontSize:".82rem"}}>💡 Explanation</b><div style={{fontSize:".78rem",color:"#a0b8b8",lineHeight:1.6,marginTop:4}} dangerouslySetInnerHTML={{__html:qObj.expl}}/></div>}
        </div>
        <div style={c.card}><b style={{fontSize:".75rem",color:"#c8a84e"}}>💬 ({qObj.cmts?.length||0})</b>{(qObj.cmts||[]).map(x=><div key={x.id} style={{padding:"4px 0",fontSize:".75rem",borderBottom:"1px solid rgba(200,168,78,.04)"}}><b>{x.n}</b> <span style={{color:"#6a8a8a",fontSize:".58rem"}}>{x.tm}</span><div style={{color:"#a0b8b8"}}>{x.txt}</div></div>)}<div style={{display:"flex",gap:4,marginTop:6}}><input value={cmt} onChange={e=>setCmt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&cmt.trim()){setQuiz(p=>p.map(q=>q.date===selD?{...q,cmts:[...(q.cmts||[]),{id:Date.now(),n:user.name,ini:user.initials,txt:cmt,tm:"Now"}]}:q));setCmt("")}}} placeholder="Comment..." style={{...c.inp,borderRadius:18,fontSize:".75rem",flex:1}}/><button onClick={()=>{if(!cmt.trim())return;setQuiz(p=>p.map(q=>q.date===selD?{...q,cmts:[...(q.cmts||[]),{id:Date.now(),n:user.name,ini:user.initials,txt:cmt,tm:"Now"}]}:q));setCmt("")}} style={{...c.btn,padding:"4px 10px",fontSize:".7rem"}}>Post</button></div></div></>}
      </div>}

      {pg==="library"&&<div><h3 style={{color:"#c8a84e",fontSize:".9rem",fontWeight:700,marginBottom:8}}>📚 Library</h3>{res.map(r=><div key={r.id} style={{...c.card,display:"flex",gap:9,alignItems:"center"}}><div style={{fontSize:"1.6rem"}}>{r.ic}</div><div style={{flex:1}}><h4 style={{fontSize:".8rem",fontWeight:600}}>{r.t}</h4><div style={{fontSize:".63rem",color:"#6a8a8a"}}>{r.pg}p • {r.sz}</div><div style={{marginTop:4}}>{r.free||isPd?<button style={{...c.btn,padding:"3px 9px",fontSize:".68rem"}}>📥 Get</button>:<button style={{...c.btnO,padding:"3px 9px",fontSize:".68rem"}}>🔒 Premium</button>}</div></div></div>)}{!isPd&&<div style={{...c.card,textAlign:"center",borderColor:"rgba(200,168,78,.25)"}}><b style={{color:"#c8a84e"}}>🔓 Unlock All</b><br/><button style={{...c.btn,marginTop:8}}>₹999/month</button></div>}</div>}

      {pg==="videos"&&!selV&&<div><h3 style={{color:"#c8a84e",fontSize:".9rem",fontWeight:700,marginBottom:8}}>🎥 Videos</h3><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>{vids.map(v=><div key={v.id} onClick={()=>setSelV(v)} style={{...c.card,cursor:"pointer",marginBottom:0}}><div style={{height:70,borderRadius:7,background:"linear-gradient(135deg,#0a3d3d,#0d6b6e)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.8rem",marginBottom:6,position:"relative"}}>{v.ic}{!v.free&&!isPd&&<div style={{position:"absolute",top:3,right:3,...c.tag("rgba(200,168,78,.9)","#061e1e")}}>🔒</div>}<div style={{position:"absolute",bottom:3,right:3,fontSize:".55rem",background:"rgba(0,0,0,.7)",padding:"1px 4px",borderRadius:3,color:"#fff"}}>{v.dur}</div></div><span style={c.tag("rgba(20,143,143,.2)","#1ab5a5")}>{v.cat}</span><h4 style={{fontSize:".78rem",fontWeight:600,marginTop:3,lineHeight:1.25}}>{v.t}</h4></div>)}</div>{!isPd&&<div style={{...c.card,textAlign:"center",marginTop:10,borderColor:"rgba(200,168,78,.25)"}}><b style={{color:"#c8a84e"}}>🎓 All Masterclasses</b><br/><button style={{...c.btn,marginTop:8}}>₹999/month</button></div>}</div>}
      {pg==="videos"&&selV&&<div><button onClick={()=>setSelV(null)} style={{...c.btnO,marginBottom:8,padding:"4px 10px",fontSize:".72rem"}}>← Back</button><div style={c.card}><div style={{height:140,borderRadius:9,background:"linear-gradient(135deg,#0a3d3d,#0d6b6e)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:10}}>{selV.free||isPd?<span style={{fontSize:"2.5rem"}}>▶️</span>:<div style={{textAlign:"center"}}><span style={{fontSize:"1.5rem"}}>🔒</span><br/><button style={{...c.btn,marginTop:8}}>Unlock ₹999</button></div>}</div><h3 style={{color:"#c8a84e",fontWeight:700}}>{selV.t}</h3><p style={{fontSize:".72rem",color:"#6a8a8a",marginTop:2}}>{selV.dur}</p><p style={{fontSize:".82rem",color:"#a0b8b8",marginTop:8,lineHeight:1.6}}>{selV.desc}</p></div></div>}

      {pg==="forum"&&<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><h3 style={{color:"#c8a84e",fontSize:".9rem",fontWeight:700}}>💬 Forum</h3><button onClick={()=>setNewP(!newP)} style={{...c.btn,padding:"4px 10px",fontSize:".72rem"}}>{newP?"Cancel":"+ Post"}</button></div>
        {newP&&<div style={{...c.card,borderColor:"rgba(200,168,78,.25)"}}><input value={fpT} onChange={e=>setFpT(e.target.value)} placeholder="Title..." style={{...c.inp,marginBottom:6}}/><select value={fpC} onChange={e=>setFpC(e.target.value)} style={{...c.inp,marginBottom:6}}>{TOPICS.map(t=><option key={t} value={t}>{t}</option>)}</select><textarea value={fpB} onChange={e=>setFpB(e.target.value)} placeholder="Details..." rows={2} style={{...c.inp,marginBottom:6,resize:"vertical"}}/><button onClick={()=>{if(!fpT.trim())return;setForum(p=>[{id:"f"+Date.now(),author:user.name,ini:user.initials,title:fpT,cat:fpC,rep:0,lik:0,time:"Now",body:fpB},...p]);setFpT("");setFpB("");setNewP(false);sh("Posted!")}} style={c.btn}>Publish</button></div>}
        {forum.map(p=><div key={p.id} style={c.card}><div style={{display:"flex",gap:6}}><div style={c.av(26,"#148f8f")}>{p.ini}</div><div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between"}}><b style={{fontSize:".75rem"}}>{p.author}</b><span style={{fontSize:".55rem",color:"#6a8a8a"}}>{p.time}</span></div><span style={{...c.tag("rgba(200,168,78,.1)","#c8a84e"),marginTop:2}}>{p.cat}</span><h4 style={{fontSize:".85rem",fontWeight:600,marginTop:4,lineHeight:1.3}}>{p.title}</h4><p style={{fontSize:".78rem",color:"#a0b8b8",marginTop:2,lineHeight:1.45}}>{p.body}</p><div style={{fontSize:".65rem",color:"#6a8a8a",marginTop:5}}>❤️{p.lik} 💬{p.rep}</div></div></div></div>)}
      </div>}

      {pg==="rank"&&<div style={c.card}><h3 style={{color:"#c8a84e",fontSize:".9rem",fontWeight:700,marginBottom:8}}>🏆 Leaderboard</h3>{[{n:"Dr. Meera P",sc:92,i:"MP"},{n:"Dr. Arjun R",sc:88,i:"AR"},{n:user.name,sc:acc,i:user.initials,me:true},{n:"Dr. Sneha K",sc:78,i:"SK"},{n:"Dr. Vikram S",sc:72,i:"VS"}].sort((a,b)=>b.sc-a.sc).map((u,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:7,padding:"6px 5px",borderRadius:6,marginBottom:3,background:u.me?"rgba(200,168,78,.08)":"rgba(0,0,0,.08)",border:u.me?"1px solid rgba(200,168,78,.2)":"none"}}><div style={{width:20,textAlign:"center",fontWeight:700,fontSize:".78rem",color:i<3?["#FFD700","#C0C0C0","#CD7F32"][i]:"#f0ede4"}}>{i<3?["🥇","🥈","🥉"][i]:i+1}</div><div style={c.av(24,u.me?"#c8a84e":"#0d6b6e")}>{u.i}</div><div style={{flex:1,fontWeight:600,fontSize:".78rem"}}>{u.n}{u.me?" (You)":""}</div><div style={{fontWeight:700,color:"#c8a84e",fontSize:".82rem"}}>{u.sc}%</div></div>)}</div>}

      {pg==="me"&&<div>
        <div style={{...c.card,textAlign:"center",padding:16}}><div style={{...c.av(50,"#0d6b6e"),border:"3px solid #c8a84e",margin:"0 auto 6px",fontSize:"1.2rem"}}>{user.initials}</div><div style={{color:"#c8a84e",fontSize:"1.05rem",fontWeight:700}}>{user.name}</div><div style={{color:"#a0b8b8",fontSize:".75rem"}}>{user.degree}</div>{isPd&&<div style={{...c.tag("#c8a84e","#061e1e"),marginTop:4}}>⭐ Premium</div>}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5,margin:"8px 0"}}>{[["Quizzes",totA],["Accuracy",acc+"%"],["Rank","#3"]].map(([l,v])=><div key={l} style={{textAlign:"center",padding:"7px 2px",background:"rgba(0,0,0,.15)",borderRadius:8,border:"1px solid rgba(200,168,78,.06)"}}><div style={{fontWeight:700,color:"#c8a84e"}}>{v}</div><div style={{fontSize:".5rem",color:"#6a8a8a",textTransform:"uppercase"}}>{l}</div></div>)}</div>
        <div style={c.card}>{[["Email",user.email],["Clinic",user.clinic],["Since",user.joined?fD(user.joined):"—"]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid rgba(200,168,78,.04)",fontSize:".78rem"}}><span style={{color:"#6a8a8a"}}>{l}</span><span>{v||"—"}</span></div>)}<div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>{!isPd&&<button onClick={()=>{setUser(p=>({...p,paid:true}));sh("⭐ Premium!")}} style={c.btn}>⭐ Premium</button>}<button onClick={()=>{setUser(null);setScr("login")}} style={{...c.btnO,background:"rgba(231,76,60,.1)",color:"#e74c3c",borderColor:"rgba(231,76,60,.2)"}}>Sign Out</button></div></div>
      </div>}

      {pg==="admin"&&isAdm&&<div style={c.card}><h3 style={{color:"#c8a84e",fontSize:".9rem",fontWeight:700,marginBottom:7}}>⚙ Admin</h3><div style={{display:"flex",gap:2,marginBottom:8}}>{[["stats","📊"],["quiz","🧠"],["users","👥"]].map(([id,ic])=><button key={id} onClick={()=>setATab(id)} style={{padding:"4px 9px",borderRadius:5,border:`1px solid ${aTab===id?"#c8a84e":"rgba(200,168,78,.08)"}`,background:aTab===id?"rgba(200,168,78,.1)":"transparent",color:aTab===id?"#c8a84e":"#a0b8b8",cursor:"pointer",fontSize:".68rem"}}>{ic}</button>)}</div>
        {aTab==="stats"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>{[["Articles",arts.length],["PDFs",res.length],["Videos",vids.length],["Forum",forum.length],["Quizzes",quiz.length],["Users",1]].map(([l,v])=><div key={l} style={{textAlign:"center",padding:6,background:"rgba(0,0,0,.12)",borderRadius:7}}><div style={{fontWeight:700,color:"#c8a84e"}}>{v}</div><div style={{fontSize:".5rem",color:"#6a8a8a",textTransform:"uppercase"}}>{l}</div></div>)}</div>}
        {aTab==="quiz"&&<div><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{color:"#6a8a8a",fontSize:".75rem"}}>{quiz.length} Qs</span><button onClick={genQ} style={{...c.btn,padding:"3px 8px",fontSize:".68rem"}}>🤖 Generate</button></div>{quiz.map(q=><div key={q.id} style={{padding:"4px 0",borderBottom:"1px solid rgba(200,168,78,.04)",fontSize:".75rem"}}><b>{q.cat}</b> <span style={{color:"#6a8a8a",fontSize:".6rem"}}>{fD(q.date)}</span></div>)}</div>}
        {aTab==="users"&&<div><p style={{color:"#a0b8b8",fontSize:".78rem",marginBottom:4}}>Admins:</p>{ADMINS.map(e=><div key={e} style={{fontSize:".75rem",color:"#c8a84e",padding:"2px 0"}}>✓ {e}</div>)}</div>}
      </div>}

      <div style={{textAlign:"center",padding:"14px 0",borderTop:"1px solid rgba(200,168,78,.05)",marginTop:12}}>
        <div style={{fontSize:".52rem",color:"#6a8a8a",letterSpacing:1.5,textTransform:"uppercase"}}>Powered by <span style={{color:"#c8a84e",fontWeight:600}}>ABSOLUTE INSTITUTE</span></div>
      </div>
      </div>
      {toast&&<div style={{position:"fixed",bottom:14,left:"50%",transform:"translateX(-50%)",padding:"6px 16px",background:"#0d6b6e",color:"#fff",borderRadius:7,fontSize:".78rem",zIndex:1000,boxShadow:"0 4px 12px rgba(0,0,0,.4)"}}>{toast}</div>}
    </div>
  );
}
