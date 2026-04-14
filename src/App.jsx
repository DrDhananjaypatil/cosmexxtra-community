import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";

// ═══ FIREBASE ═══
const firebaseConfig = {
  apiKey: "AIzaSyBFaxZyhRvucfaZACl68SdNFb_CKPlkZBU",
  authDomain: "cosmexxtra-1b08e.firebaseapp.com",
  projectId: "cosmexxtra-1b08e",
  storageBucket: "cosmexxtra-1b08e.firebasestorage.app",
  messagingSenderId: "419443766419",
  appId: "1:419443766419:web:5ca9336401284094060966",
  measurementId: "G-VFV64K558B"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const gProv = new GoogleAuthProvider();

const ADMINS = ["drjpatil@gmail.com", "absoluteinstituteedu@gmail.com"];
const TOPICS = ["Skin Disorders","Chemical Peels","Botox & Fillers","Laser Treatments","Hair Restoration","Body Contouring","Ethics","Patient Safety"];

// ═══ HELPERS ═══
const getIST=()=>new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
const ds=d=>d.toISOString().split("T")[0];
const fD=s=>new Date(s+"T12:00:00").toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
const dN=s=>new Date(s+"T12:00:00").toLocaleDateString("en-IN",{weekday:"short"});

// ═══ SAMPLE DATA ═══
const arts=[
  {id:"a1",title:"Understanding Melasma: A Comprehensive Guide for Practitioners",cat:"Skin Disorders",author:"Dr. J Patil",date:"2026-04-10",body:"Melasma is a chronic pigmentary disorder characterized by symmetrical brown patches. This guide covers evidence-based approaches including topical therapy with hydroquinone, tranexamic acid, chemical peels, and laser treatments. Special considerations for Fitzpatrick IV-VI skin types are discussed with protocols for combination therapy.",feat:true},
  {id:"a2",title:"Chemical Peels: Selecting the Right Peel for Indian Skin Types",cat:"Chemical Peels",author:"Dr. J Patil",date:"2026-04-08",body:"Fitzpatrick types IV-VI require careful peel selection. This article covers glycolic acid (20-70%), salicylic acid, TCA (15-35%), and combination protocols. Pre-peel preparation, application technique, and post-peel care to minimize PIH risk."},
  {id:"a3",title:"PRP Therapy in Hair Restoration: What the Evidence Says in 2026",cat:"Hair Restoration",author:"Dr. J Patil",date:"2026-04-05",body:"Platelet-Rich Plasma therapy has shown promising results in androgenetic alopecia. Reviews PRP preparation (single vs double spin), injection protocols, expected outcomes at 3-6-12 months, and combination approaches with minoxidil and finasteride."},
  {id:"a4",title:"Laser Hair Removal: Managing Expectations and Complications",cat:"Laser Treatments",author:"Dr. J Patil",date:"2026-04-02",body:"Setting realistic expectations is crucial for patient satisfaction. Covers diode, Nd:YAG, and alexandrite lasers for different skin types. Common complications including paradoxical hypertrichosis, burns, and PIH with management protocols."},
];
const res=[
  {id:"r1",t:"Complete Guide to Laser Safety Protocols",pg:42,sz:"3.2 MB",free:true,ic:"📄"},
  {id:"r2",t:"Fitzpatrick Skin Type Classification Chart",pg:8,sz:"1.1 MB",free:true,ic:"📊"},
  {id:"r3",t:"Botulinum Toxin Injection Points Atlas",pg:64,sz:"8.5 MB",free:false,ic:"📕"},
  {id:"r4",t:"Chemical Peel Concentration & pH Guide",pg:24,sz:"2.0 MB",free:true,ic:"📋"},
  {id:"r5",t:"Advanced Dermatoscopy Manual (2026 Edition)",pg:156,sz:"22 MB",free:false,ic:"📚"},
  {id:"r6",t:"Patient Consent Form Templates (Editable)",pg:12,sz:"0.8 MB",free:true,ic:"📝"},
];
const vids=[
  {id:"v1",t:"Live Demo: Q-Switched Nd:YAG for Melasma",dur:"45 min",cat:"Laser",ic:"🎥",free:true,desc:"Watch a live demonstration of laser toning technique on Fitzpatrick type IV skin with post-procedure care."},
  {id:"v2",t:"Thread Lift Masterclass: Technique & Complications",dur:"1h 20m",cat:"Threads",ic:"🎓",free:false,desc:"Comprehensive masterclass covering PDO, PCL, and PLLA thread types with live procedure."},
  {id:"v3",t:"PRP Preparation & Injection for Hair Loss",dur:"35 min",cat:"Hair",ic:"💉",free:true,desc:"Step-by-step PRP preparation (double-spin method) and mesotherapy injection technique."},
  {id:"v4",t:"Advanced Chemical Peel Combinations",dur:"55 min",cat:"Peels",ic:"🧪",free:false,desc:"Learn combination peel protocols (Jessner + TCA) for resistant pigmentation in Indian skin."},
  {id:"v5",t:"Ethics in Aesthetic Practice: Case Studies",dur:"40 min",cat:"Ethics",ic:"⚖️",free:false,desc:"Real-world ethical dilemmas including BDD screening, informed consent, and managing unrealistic expectations."},
];
const initForum=[
  {id:"f1",author:"Dr. Priya Sharma",ini:"PS",title:"Best protocol for post-inflammatory hyperpigmentation in type V skin?",cat:"Skin Disorders",rep:8,lik:12,time:"2 hours ago",body:"I have a 28-year-old female with severe PIH after acne. Fitzpatrick V. Currently on adapalene. What combination protocol would you recommend?"},
  {id:"f2",author:"Dr. Rahul Menon",ini:"RM",title:"Has anyone tried the new generation PCL threads for mid-face?",cat:"Thread Lifts",rep:5,lik:7,time:"5 hours ago",body:"Looking for real-world experiences with newer PCL thread variants. How do results compare to PDO at 6 months?"},
  {id:"f3",author:"Dr. Ananya Das",ini:"AD",title:"Managing patient expectations for laser hair removal — what works?",cat:"Laser Treatments",rep:14,lik:23,time:"1 day ago",body:"How do you handle patients who expect permanent results after just 2-3 sessions? Any good educational materials you share?"},
];
const initQuiz=[]; date:ds(getIST()),cat:"Laser Treatments",diff:"Advanced",eth:false,scen:"A 32-year-old female patient with Fitzpatrick skin type IV presents with bilateral symmetrical hyperpigmentation on the malar region, forehead, and upper lip. She has been using oral contraceptives for 3 years. She requests laser treatment for her condition.",q:"What is the most appropriate laser/light-based treatment approach for this patient?",opts:["Aggressive ablative CO₂ laser resurfacing in a single session","Low-fluence Q-switched Nd:YAG laser (laser toning) with strict sun protection and topical depigmenting agents","High-intensity IPL (Intense Pulsed Light) therapy at maximum settings"],ci:1,expl:"<p><strong>Correct Answer: B — Low-fluence Q-switched Nd:YAG laser toning</strong></p><p>This patient presents with <strong>melasma</strong>. Low-fluence Q-switched Nd:YAG (1064nm) uses sub-threshold fluences to gradually break down melanin without causing inflammation. Combined with topical agents (hydroquinone, kojic acid, vitamin C) and strict photoprotection, this offers the safest approach for Fitzpatrick type IV skin.</p><p><strong>Why A is wrong:</strong> Ablative CO₂ laser causes significant thermal damage and inflammation, triggering post-inflammatory hyperpigmentation (PIH) in darker skin types.</p><p><strong>Why C is wrong:</strong> High-intensity IPL at maximum settings poses high risk of burns and PIH in type IV skin. Conservative settings with proper filters would be needed.</p><p><strong>Key Learning:</strong> In melasma management, less is more. Aggressive treatments often lead to rebound hyperpigmentation in higher Fitzpatrick skin types.</p>",cmts:[{id:1,n:"Dr. Priya Sharma",ini:"PS",txt:"Great question! I would also add oral tranexamic acid 250mg BD as an adjunct.",tm:"11:30 AM"},{id:2,n:"Dr. Rahul Menon",ini:"RM",txt:"We've seen excellent results combining laser toning with PRP microneedling for melasma.",tm:"12:45 PM"}]}];

// ═══ STYLES ═══
const W="1100px";
const c = {
  wrap:{minHeight:"100vh",background:"#061e1e",fontFamily:"'Outfit',system-ui,sans-serif",color:"#f0ede4"},
  main:{position:"relative",zIndex:1,maxWidth:W,margin:"0 auto",padding:"14px 20px"},
  card:{background:"linear-gradient(145deg,#0c3535,#104545)",border:"1px solid rgba(200,168,78,.15)",borderRadius:14,padding:20,boxShadow:"0 4px 24px rgba(0,0,0,.3)",marginBottom:14},
  btn:{padding:"10px 22px",background:"linear-gradient(135deg,#c8a84e,#a08030)",color:"#061e1e",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:".88rem",fontFamily:"inherit",transition:"all .2s"},
  btnO:{padding:"10px 22px",background:"rgba(200,168,78,.12)",color:"#c8a84e",border:"1px solid rgba(200,168,78,.3)",borderRadius:10,fontWeight:500,cursor:"pointer",fontSize:".88rem",fontFamily:"inherit"},
  btnSm:{padding:"6px 14px",fontSize:".78rem",borderRadius:8},
  inp:{width:"100%",padding:"10px 14px",background:"rgba(0,0,0,.3)",border:"1px solid rgba(200,168,78,.2)",borderRadius:10,color:"#f0ede4",fontSize:".9rem",fontFamily:"inherit",boxSizing:"border-box"},
  tag:(bg,cl)=>({fontSize:".68rem",padding:"3px 9px",borderRadius:20,fontWeight:600,background:bg,color:cl,display:"inline-block"}),
  av:(sz,bg)=>({width:sz,height:sz,minWidth:sz,borderRadius:"50%",background:bg||"#148f8f",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#fff",fontSize:sz*.32}),
  gold:"#c8a84e",teal:"#0d6b6e",tealL:"#1ab5a5",txt2:"#a0b8b8",mute:"#6a8a8a",ok:"#2ecc71",err:"#e74c3c",
};

// ═══ AI GENERATION ═══
async function genQuizAI(date){
  const tp=TOPICS[Math.floor(Math.random()*TOPICS.length)];
  const df=Math.random()>.5?"Advanced":"Moderate";
  try{
    const r=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,messages:[{role:"user",content:`You are a master cosmetologist with 20+ years clinical experience. Generate a clinical quiz question.\nTopic: ${tp} | Difficulty: ${df}\nCreate a realistic CASE SCENARIO with patient demographics, history, complaint. Provide exactly 3 options, only 1 correct.\nRESPOND IN JSON ONLY:\n{"category":"${tp}","difficulty":"${df}","scenario":"...","question":"...","options":["A","B","C"],"correctIndex":0,"explanation":"<p>...</p>"}`}]})});
    const data=await r.json();
    if(!data.content?.[0])throw new Error();
    const q=JSON.parse(data.content[0].text.replace(/```json\s*/g,"").replace(/```/g,"").trim());
    return{id:"ai_"+date,date,cat:q.category,diff:q.difficulty,eth:false,scen:q.scenario,q:q.question,opts:q.options,ci:q.correctIndex,expl:q.explanation,cmts:[]};
  }catch(e){console.error(e);return null;}
}

// ═══ MAIN APP ═══
export default function App(){
  const[authUser,setAuthUser]=useState(null);
  const[profile,setProfile]=useState(null);
  const[scr,setScr]=useState("loading");
  const[pg,setPg]=useState("home");
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
  const[pf,setPf]=useState({degree:"",clinic:"",address:""});

  // Auth listener
  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async(u)=>{
      if(u){
        setAuthUser(u);
        // Check if profile exists in Firestore
        try{
          const snap=await getDoc(doc(db,"users",u.uid));
          if(snap.exists()){setProfile(snap.data());setScr("main");}
          else{setPf({degree:"",clinic:"",address:""});setScr("setup");}
        }catch(e){
          // Firestore might not be set up yet, use local
          const local=localStorage.getItem("cmx_profile_"+u.uid);
          if(local){setProfile(JSON.parse(local));setScr("main");}
          else{setScr("setup");}
        }
      }else{setAuthUser(null);setProfile(null);setScr("login");}
    });
    return()=>unsub();
  },[]);

  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(null),3000);return()=>clearTimeout(t)}},[toast]);

  const sh=m=>setToast(m);
  const go=p=>{setPg(p);setSelA(null);setSelV(null)};
  const isAdm=profile&&ADMINS.includes(authUser?.email);
  const isPd=profile?.paid;
  const today=ds(getIST());
  const hr=getIST().getHours();
  const totA=Object.keys(ans).length;
  const corr=Object.entries(ans).filter(([d,a])=>{const q=quiz.find(x=>x.date===d);return q&&a===q.ci}).length;
  const acc=totA?Math.round(corr/totA*100):0;
  const uName=profile?.name||authUser?.displayName||"Doctor";
  const uIni=(uName.replace(/^Dr\.?\s*/i,"").split(" ").map(w=>w[0]).join("").toUpperCase()||"D").slice(0,2);
  const uPhoto=authUser?.photoURL;

  // Google Sign In
  const doLogin=async()=>{try{await signInWithPopup(auth,gProv);}catch(e){if(e.code!=="auth/popup-closed-by-user")sh("Login failed: "+e.message);}};
  const doLogout=async()=>{if(confirm("Sign out?")){await signOut(auth);}};

  // Save profile
  const savePf=async()=>{
    if(!pf.degree){sh("Degree is required");return;}
    const p={name:authUser.displayName||"Doctor",email:authUser.email,photo:authUser.photoURL||"",degree:pf.degree,clinic:pf.clinic,address:pf.address,paid:false,joined:ds(getIST()),initials:uIni};
    try{await setDoc(doc(db,"users",authUser.uid),p);}catch(e){console.log("Firestore not ready, saving locally");}
    localStorage.setItem("cmx_profile_"+authUser.uid,JSON.stringify(p));
    setProfile(p);setScr("main");sh("Welcome to CosMExxtra!");
  };

  // Quiz
  const submitA=(d,i)=>{setAns(p=>({...p,[d]:i}));const q=quiz.find(q=>q.date===d);sh(q&&i===q.ci?"🎉 Correct!":"Answer recorded.");};
  const addCmt=d=>{if(!cmt.trim())return;setQuiz(p=>p.map(q=>q.date===d?{...q,cmts:[...(q.cmts||[]),{id:Date.now(),n:uName,ini:uIni,txt:cmt,tm:getIST().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true})}]}:q));setCmt("");};
  const genQ=async()=>{if(quiz.find(q=>q.date===today)){sh("Already exists!");return;}setLd(true);const q=await genQuizAI(today);if(q){setQuiz(p=>[q,...p]);sh("Question is live!");}else sh("Failed — check API route");setLd(false);};
  const addFP=()=>{if(!fpT.trim())return;setForum(p=>[{id:"f"+Date.now(),author:uName,ini:uIni,title:fpT,cat:fpC,rep:0,lik:0,time:"Just now",body:fpB},...p]);setFpT("");setFpB("");setNewP(false);sh("Posted!");};

  // ═══ LOADING ═══
  if(scr==="loading")return(
    <div style={{...c.wrap,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}><div style={{...c.av(60,"linear-gradient(135deg,#0d6b6e,#0a3d3d)"),border:"3px solid #c8a84e",margin:"0 auto 12px",fontSize:"1.5rem"}}>🌿</div><p style={{color:c.mute,fontSize:".85rem"}}>Loading...</p></div>
    </div>);

  // ═══ LOGIN ═══
  if(scr==="login")return(
    <div style={{...c.wrap,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"linear-gradient(160deg,#061e1e,#0a3d3d 50%,#0d6b6e)",padding:24}}>
      <div style={{...c.av(90,"linear-gradient(135deg,#0d6b6e,#0a3d3d)"),border:"3px solid #c8a84e",boxShadow:"0 0 40px rgba(200,168,78,.3)",marginBottom:18,fontSize:"2.2rem"}}>🌿</div>
      <h1 style={{fontSize:"2.4rem",fontWeight:800,background:"linear-gradient(135deg,#e8d48b,#c8a84e)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:4}}>CosMExxtra</h1>
      <p style={{fontSize:".72rem",color:c.mute,letterSpacing:3,textTransform:"uppercase",marginBottom:10}}>Professional Aesthetic Community</p>
      <p style={{color:c.txt2,fontSize:".92rem",textAlign:"center",maxWidth:420,lineHeight:1.7,marginBottom:28}}>Daily quizzes, expert articles, learning resources, video masterclasses & a vibrant community of aesthetic medicine professionals.</p>
      <button onClick={doLogin} style={{display:"flex",alignItems:"center",gap:12,background:"#fff",color:"#333",border:"none",padding:"14px 32px",borderRadius:50,fontSize:"1.05rem",fontWeight:600,cursor:"pointer",boxShadow:"0 4px 20px rgba(0,0,0,.3)",fontFamily:"inherit",transition:"all .2s"}}>
        <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Sign in with Google
      </button>
      <div style={{marginTop:32,display:"flex",gap:20,fontSize:".72rem",color:c.mute}}>{["🧠 Daily Quiz","📚 Resources","🎥 Masterclasses","💬 Forum"].map(t=><span key={t}>{t}</span>)}</div>
      <p style={{marginTop:24,fontSize:".6rem",color:c.mute,letterSpacing:2,textTransform:"uppercase"}}>Powered by ABSOLUTE INSTITUTE</p>
    </div>);

  // ═══ PROFILE SETUP ═══
  if(scr==="setup")return(
    <div style={{...c.wrap,background:"linear-gradient(160deg,#061e1e,#0a3d3d)",padding:20}}>
      <div style={{maxWidth:520,margin:"0 auto"}}>
        <div style={{...c.card,borderColor:"rgba(200,168,78,.3)"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            {uPhoto?<img src={uPhoto} style={{width:48,height:48,borderRadius:"50%",border:"2px solid #c8a84e"}}/>:<div style={c.av(48,"#0d6b6e")}>{uIni}</div>}
            <div><div style={{fontWeight:700,fontSize:"1.05rem"}}>{authUser?.displayName}</div><div style={{fontSize:".78rem",color:c.mute}}>{authUser?.email}</div></div>
          </div>
          <h2 style={{color:c.gold,fontSize:"1.15rem",fontWeight:700,marginBottom:14}}>Complete Your Profile</h2>
          {[["degree","Degree / Qualification *"],["clinic","Clinic Name"],["address","City, State"]].map(([k,l])=>
            <div key={k} style={{marginBottom:12}}>
              <label style={{display:"block",fontSize:".75rem",color:c.gold,marginBottom:4,fontWeight:500}}>{l}</label>
              <input value={pf[k]} onChange={e=>setPf(p=>({...p,[k]:e.target.value}))} placeholder={l.replace(" *","")} style={c.inp}/>
            </div>
          )}
          <button onClick={savePf} style={{...c.btn,width:"100%",marginTop:8}}>Save & Enter Community →</button>
        </div>
      </div>
    </div>);

  // ═══ MAIN APP ═══
  const navs=[{id:"home",ic:"🏠",l:"Home"},{id:"quiz",ic:"🧠",l:"Quiz"},{id:"library",ic:"📚",l:"Library"},{id:"videos",ic:"🎥",l:"Videos"},{id:"forum",ic:"💬",l:"Forum"},{id:"rank",ic:"🏆",l:"Rank"},{id:"me",ic:"👤",l:"Me"},...(isAdm?[{id:"admin",ic:"⚙",l:"Admin"}]:[])];
  const qObj=quiz.find(q=>q.date===selD);const uA=ans[selD];const isT=selD===today;const rev=!isT||hr>=21;const dd=Math.floor((new Date(today)-new Date(selD))/864e5);const canA=uA===undefined&&(isT||(dd<=3&&dd>0));
  const dates=Array.from({length:14},(_,i)=>{let d=new Date(getIST());d.setDate(d.getDate()-(13-i));return ds(d)});

  return(
    <div style={c.wrap}>
      <div style={{position:"fixed",inset:0,background:"radial-gradient(ellipse at 20% 0%,rgba(13,107,110,.2),transparent 60%),radial-gradient(ellipse at 80% 100%,rgba(200,168,78,.06),transparent 50%)",pointerEvents:"none",zIndex:0}}/>

      {/* ═══ HEADER ═══ */}
      <div style={{position:"sticky",top:0,zIndex:100,background:"linear-gradient(135deg,#061e1eee,#0a3d3dee)",backdropFilter:"blur(14px)",borderBottom:"1px solid rgba(200,168,78,.15)",padding:"8px 20px"}}>
        <div style={{maxWidth:W,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>go("home")}>
            <div style={{...c.av(34,"linear-gradient(135deg,#0d6b6e,#0a3d3d)"),border:"2px solid #c8a84e",fontSize:".9rem"}}>🌿</div>
            <div><div style={{fontSize:"1.05rem",fontWeight:700,background:"linear-gradient(135deg,#e8d48b,#c8a84e)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CosMExxtra</div><div style={{fontSize:".5rem",color:c.mute,letterSpacing:2,textTransform:"uppercase"}}>Aesthetic Medicine Community</div></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:3}}>
            {navs.map(n=><button key={n.id} onClick={()=>go(n.id)} style={{background:pg===n.id?"rgba(200,168,78,.12)":"none",border:`1px solid ${pg===n.id?"rgba(200,168,78,.35)":"transparent"}`,color:pg===n.id?c.gold:c.txt2,padding:"5px 10px",borderRadius:8,cursor:"pointer",fontSize:".62rem",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:1,minWidth:42,transition:"all .15s"}}><span style={{fontSize:".85rem"}}>{n.ic}</span>{n.l}</button>)}
            {uPhoto&&<img src={uPhoto} onClick={()=>go("me")} style={{width:30,height:30,borderRadius:"50%",border:"2px solid rgba(200,168,78,.3)",marginLeft:6,cursor:"pointer"}}/>}
          </div>
        </div>
      </div>

      <div style={c.main}>

      {/* ═══ HOME ═══ */}
      {pg==="home"&&!selA&&<div>
        <div style={{...c.card,borderColor:"rgba(200,168,78,.25)",padding:28,background:"linear-gradient(135deg,#0c3535,rgba(13,107,110,.1))"}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
            {uPhoto?<img src={uPhoto} style={{width:50,height:50,borderRadius:"50%",border:"2px solid #c8a84e"}}/>:<div style={c.av(50,"#0d6b6e")}>{uIni}</div>}
            <div><h2 style={{color:c.gold,fontSize:"1.35rem",fontWeight:700}}>Welcome back, {uName.split(" ")[0]} 👋</h2><p style={{color:c.txt2,fontSize:".88rem",marginTop:2}}>Stay ahead with daily quizzes, expert insights & community connections.</p></div>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button onClick={()=>go("quiz")} style={c.btn}>🧠 Today's Quiz</button><button onClick={()=>go("forum")} style={c.btnO}>💬 Join Discussion</button><button onClick={()=>go("library")} style={c.btnO}>📚 Resources</button></div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
          {[["🧠",totA,"Quizzes Done"],["✅",acc+"%","Accuracy"],["📚",res.length,"Resources"],["🎥",vids.length,"Videos"]].map(([i,v,l])=>
            <div key={l} style={{textAlign:"center",padding:"12px 6px",background:"rgba(0,0,0,.2)",borderRadius:12,border:"1px solid rgba(200,168,78,.08)"}}>
              <div style={{fontSize:"1.2rem"}}>{i}</div>
              <div style={{fontSize:"1.3rem",fontWeight:700,color:c.gold}}>{v}</div>
              <div style={{fontSize:".58rem",color:c.mute,textTransform:"uppercase",letterSpacing:.5,marginTop:2}}>{l}</div>
            </div>)}
        </div>

        <h3 style={{color:c.gold,fontSize:"1rem",fontWeight:700,marginBottom:10}}>📰 Latest Articles</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
          {arts.map(a=><div key={a.id} onClick={()=>setSelA(a)} style={{...c.card,cursor:"pointer",marginBottom:0,transition:"all .2s"}}>
            <div style={{display:"flex",gap:5,marginBottom:6}}><span style={c.tag("rgba(20,143,143,.2)",c.tealL)}>{a.cat}</span>{a.feat&&<span style={c.tag("rgba(200,168,78,.2)",c.gold)}>Featured</span>}</div>
            <h4 style={{fontSize:".95rem",fontWeight:600,lineHeight:1.35}}>{a.title}</h4>
            <p style={{fontSize:".78rem",color:c.txt2,marginTop:6,lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{a.body}</p>
            <p style={{fontSize:".7rem",color:c.mute,marginTop:6}}>{a.author} • {fD(a.date)}</p>
          </div>)}
        </div>
      </div>}

      {pg==="home"&&selA&&<div>
        <button onClick={()=>setSelA(null)} style={{...c.btnO,...c.btnSm,marginBottom:12}}>← Back to Articles</button>
        <div style={c.card}><span style={c.tag("rgba(200,168,78,.15)",c.gold)}>{selA.cat}</span><h2 style={{color:c.gold,fontSize:"1.4rem",fontWeight:700,marginTop:8,lineHeight:1.35}}>{selA.title}</h2><p style={{fontSize:".8rem",color:c.mute,marginTop:6}}>By {selA.author} • {fD(selA.date)}</p><div style={{marginTop:18,fontSize:".95rem",color:c.txt2,lineHeight:1.85}}>{selA.body}</div></div>
      </div>}

      {/* ═══ QUIZ ═══ */}
      {pg==="quiz"&&<div>
        <div style={{display:"flex",gap:5,overflowX:"auto",padding:"4px 0 12px"}}>
          {dates.map(d=>{const dt=new Date(d+"T12:00:00");const sun=dt.getDay()===0;const on=d===selD;
            return<div key={d} onClick={()=>!sun&&setSelD(d)} style={{minWidth:50,padding:"6px 4px",textAlign:"center",borderRadius:10,border:`1px solid ${on?c.gold:"rgba(200,168,78,.08)"}`,cursor:sun?"not-allowed":"pointer",background:on?"linear-gradient(135deg,#c8a84e,#a08030)":"rgba(0,0,0,.15)",opacity:sun?.3:1,transition:"all .15s"}}>
              <div style={{fontSize:".55rem",color:on?"#061e1e":c.mute,textTransform:"uppercase"}}>{dN(d)}</div>
              <div style={{fontSize:".95rem",fontWeight:700,color:on?"#061e1e":"#f0ede4"}}>{dt.getDate()}</div>
            </div>})}
        </div>

        {qObj&&isT&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:8,background:hr<21?"rgba(200,168,78,.06)":"rgba(46,204,113,.08)",borderRadius:10,marginBottom:10,fontSize:".8rem",color:c.mute}}>{hr<21?<>⏱ Answer reveals at <b style={{color:c.gold,margin:"0 4px"}}>9:00 PM IST</b></>:"✓ Answer has been revealed"}</div>}

        {ld&&<div style={{textAlign:"center",padding:50}}><p style={{color:c.mute,fontSize:".9rem"}}>⏳ Generating today's question with AI...</p></div>}

        {!ld&&!qObj&&<div style={{...c.card,textAlign:"center",padding:36}}>
          {selD===today?<><div style={{fontSize:"2rem",marginBottom:8}}>🔬</div><p style={{color:c.gold,fontSize:"1.05rem",fontWeight:600}}>Today's Question</p><p style={{color:c.mute,fontSize:".85rem",margin:"6px 0 14px"}}>Question will be posted at 10:00 AM IST</p>{isAdm&&<button onClick={genQ} style={c.btn}>🤖 Generate Now (Admin)</button>}</>
          :<p style={{color:c.mute,fontSize:".9rem"}}>No question available for this date</p>}
        </div>}

        {!ld&&qObj&&<div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:14,alignItems:"start"}}>
          <div style={{...c.card,borderColor:"rgba(200,168,78,.25)"}}>
            <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap",alignItems:"center",fontSize:".78rem",color:c.mute}}>📅 {fD(qObj.date)} {isT&&hr<21&&<span style={c.tag(c.ok,"#fff")}>● LIVE</span>}{dd>0&&dd<=3&&canA&&<span style={c.tag(c.teal,"#fff")}>LATE ENTRY</span>}{rev&&!isT&&<span style={c.tag(c.err,"#fff")}>CLOSED</span>}</div>
            <div style={{display:"flex",gap:5,marginBottom:10}}><span style={c.tag("rgba(200,168,78,.15)",c.gold)}>{qObj.cat}</span>{qObj.eth&&<span style={c.tag("rgba(231,76,60,.15)",c.err)}>⚖ Ethical</span>}<span style={c.tag("rgba(20,143,143,.2)",c.tealL)}>{qObj.diff}</span></div>
            {qObj.scen&&<div style={{background:"rgba(0,0,0,.2)",borderLeft:`3px solid ${c.gold}`,padding:"10px 14px",marginBottom:14,borderRadius:"0 10px 10px 0",fontSize:".88rem",color:c.txt2,lineHeight:1.6}}>{qObj.scen}</div>}
            <div style={{fontSize:"1.05rem",fontWeight:600,lineHeight:1.6,marginBottom:14}}>{qObj.q}</div>

            {qObj.opts.map((o,i)=>{const l="ABC"[i];const sr=uA!==undefined||(rev&&!canA);const co=sr&&i===qObj.ci;const wr=sr&&i===uA&&uA!==qObj.ci;
              return<div key={i} onClick={()=>canA&&submitA(selD,i)} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"12px 14px",background:co?"rgba(46,204,113,.1)":wr?"rgba(231,76,60,.1)":"rgba(0,0,0,.15)",border:`1px solid ${co?c.ok:wr?c.err:"rgba(200,168,78,.08)"}`,borderRadius:10,marginBottom:8,cursor:canA?"pointer":"default",opacity:!canA&&!sr?.55:1,transition:"all .15s"}}>
                <div style={{...c.av(26,co?c.ok:wr?c.err:"rgba(200,168,78,.2)"),color:co||wr?"#fff":c.gold,fontSize:".75rem"}}>{l}</div>
                <div style={{fontSize:".9rem",lineHeight:1.5}}>{o}</div>
              </div>})}

            {uA!==undefined&&<p style={{color:uA===qObj.ci?c.ok:c.err,fontWeight:600,fontSize:".88rem",marginTop:8}}>{uA===qObj.ci?"✓ Correct! Well done.":"✗ Incorrect."}</p>}
            {((uA!==undefined&&rev)||(!canA&&rev&&dd>0))&&<div style={{background:"rgba(200,168,78,.06)",border:"1px solid rgba(200,168,78,.12)",borderRadius:12,padding:14,marginTop:10}}><div style={{color:c.gold,fontWeight:700,fontSize:".9rem",marginBottom:6}}>💡 Expert Explanation</div><div style={{fontSize:".85rem",color:c.txt2,lineHeight:1.7}} dangerouslySetInnerHTML={{__html:qObj.expl}}/></div>}
          </div>

          {/* Comments sidebar */}
          <div style={c.card}>
            <div style={{fontSize:".85rem",color:c.gold,fontWeight:600,marginBottom:8}}>💬 Discussion ({qObj.cmts?.length||0})</div>
            <div style={{maxHeight:400,overflowY:"auto"}}>
              {(qObj.cmts||[]).map(x=><div key={x.id} style={{padding:"7px 0",borderBottom:"1px solid rgba(200,168,78,.05)"}}><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}><div style={c.av(20,"#148f8f")}>{x.ini}</div><b style={{fontSize:".78rem"}}>{x.n}</b><span style={{fontSize:".6rem",color:c.mute}}>{x.tm}</span></div><div style={{fontSize:".82rem",color:c.txt2,paddingLeft:25,lineHeight:1.5}}>{x.txt}</div></div>)}
              {!qObj.cmts?.length&&<p style={{color:c.mute,fontSize:".8rem"}}>No comments yet. Be the first!</p>}
            </div>
            <div style={{display:"flex",gap:6,marginTop:10}}>
              <input value={cmt} onChange={e=>setCmt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCmt(selD)} placeholder="Share your thoughts..." style={{...c.inp,borderRadius:20,fontSize:".8rem",flex:1,padding:"8px 12px"}}/>
              <button onClick={()=>addCmt(selD)} style={{...c.btn,...c.btnSm}}>Post</button>
            </div>
          </div>
        </div>}
      </div>}

      {/* ═══ LIBRARY ═══ */}
      {pg==="library"&&<div>
        <h3 style={{color:c.gold,fontSize:"1.1rem",fontWeight:700,marginBottom:4}}>📚 Resource Library</h3>
        <p style={{color:c.txt2,fontSize:".85rem",marginBottom:14}}>Download clinical guides, atlases, templates & more</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:12}}>
          {res.map(r=><div key={r.id} style={{...c.card,display:"flex",gap:14,alignItems:"center",marginBottom:0}}>
            <div style={{fontSize:"2.2rem",minWidth:44,textAlign:"center"}}>{r.ic}</div>
            <div style={{flex:1}}><h4 style={{fontSize:".9rem",fontWeight:600,lineHeight:1.3}}>{r.t}</h4><div style={{fontSize:".72rem",color:c.mute,marginTop:3}}>PDF • {r.pg} pages • {r.sz}</div>
              <div style={{marginTop:7}}>{r.free||isPd?<button style={{...c.btn,...c.btnSm}}>📥 Download Free</button>:<button style={{...c.btnO,...c.btnSm}}>🔒 Premium Only</button>}</div>
            </div>
          </div>)}
        </div>
        {!isPd&&<div style={{...c.card,textAlign:"center",marginTop:16,borderColor:"rgba(200,168,78,.3)",padding:24}}><h4 style={{color:c.gold,fontSize:"1.1rem",fontWeight:700}}>🔓 Unlock All Premium Resources</h4><p style={{color:c.txt2,fontSize:".88rem",margin:"6px 0 14px"}}>Get access to premium PDFs, atlases & clinical guides</p><button style={c.btn}>Upgrade to Premium — ₹999/month</button></div>}
      </div>}

      {/* ═══ VIDEOS ═══ */}
      {pg==="videos"&&!selV&&<div>
        <h3 style={{color:c.gold,fontSize:"1.1rem",fontWeight:700,marginBottom:4}}>🎥 Video Gallery & Webinars</h3>
        <p style={{color:c.txt2,fontSize:".85rem",marginBottom:14}}>Expert-led masterclasses and live procedure demonstrations</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
          {vids.map(v=><div key={v.id} onClick={()=>setSelV(v)} style={{...c.card,cursor:"pointer",marginBottom:0,transition:"all .15s"}}>
            <div style={{height:100,borderRadius:10,background:"linear-gradient(135deg,#0a3d3d,#0d6b6e)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2.5rem",marginBottom:10,position:"relative"}}>{v.ic}{!v.free&&!isPd&&<div style={{position:"absolute",top:6,right:6,...c.tag("rgba(200,168,78,.9)","#061e1e")}}>🔒 Premium</div>}<div style={{position:"absolute",bottom:6,right:6,fontSize:".65rem",background:"rgba(0,0,0,.7)",padding:"2px 7px",borderRadius:5,color:"#fff"}}>{v.dur}</div></div>
            <span style={c.tag("rgba(20,143,143,.2)",c.tealL)}>{v.cat}</span>
            <h4 style={{fontSize:".9rem",fontWeight:600,marginTop:6,lineHeight:1.3}}>{v.t}</h4>
            <p style={{fontSize:".72rem",color:c.mute,marginTop:3}}>{v.instr||"Dr. J Patil"}</p>
          </div>)}
        </div>
        {!isPd&&<div style={{...c.card,textAlign:"center",marginTop:16,borderColor:"rgba(200,168,78,.3)",padding:24}}><h4 style={{color:c.gold,fontSize:"1.1rem",fontWeight:700}}>🎓 Access All Masterclasses</h4><p style={{color:c.txt2,fontSize:".88rem",margin:"6px 0 14px"}}>Full video library + all future webinar recordings</p><button style={c.btn}>Upgrade to Premium — ₹999/month</button></div>}
      </div>}
      {pg==="videos"&&selV&&<div>
        <button onClick={()=>setSelV(null)} style={{...c.btnO,...c.btnSm,marginBottom:12}}>← Back</button>
        <div style={c.card}><div style={{height:220,borderRadius:12,background:"linear-gradient(135deg,#0a3d3d,#0d6b6e)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14}}>{selV.free||isPd?<div style={{textAlign:"center"}}><div style={{fontSize:"3rem"}}>▶️</div><p style={{color:c.txt2,fontSize:".88rem",marginTop:6}}>Video player — connect your hosting (Vimeo/YouTube)</p></div>:<div style={{textAlign:"center"}}><div style={{fontSize:"2rem"}}>🔒</div><p style={{color:c.gold,fontSize:"1rem",marginTop:6}}>Premium Content</p><button style={{...c.btn,marginTop:12}}>Unlock — ₹999/month</button></div>}</div>
          <span style={c.tag("rgba(20,143,143,.2)",c.tealL)}>{selV.cat}</span><h3 style={{color:c.gold,fontSize:"1.2rem",fontWeight:700,marginTop:8}}>{selV.t}</h3><p style={{fontSize:".8rem",color:c.mute,marginTop:4}}>Dr. J Patil • {selV.dur}</p><p style={{fontSize:".92rem",color:c.txt2,marginTop:14,lineHeight:1.7}}>{selV.desc}</p></div>
      </div>}

      {/* ═══ FORUM ═══ */}
      {pg==="forum"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div><h3 style={{color:c.gold,fontSize:"1.1rem",fontWeight:700}}>💬 Discussion Forum</h3><p style={{color:c.mute,fontSize:".8rem",marginTop:2}}>Ask questions, share cases, learn together</p></div>
          <button onClick={()=>setNewP(!newP)} style={c.btn}>{newP?"Cancel":"+ New Post"}</button>
        </div>
        {newP&&<div style={{...c.card,borderColor:"rgba(200,168,78,.3)"}}>
          <input value={fpT} onChange={e=>setFpT(e.target.value)} placeholder="Post title..." style={{...c.inp,marginBottom:8}}/>
          <select value={fpC} onChange={e=>setFpC(e.target.value)} style={{...c.inp,marginBottom:8}}>{TOPICS.map(t=><option key={t} value={t}>{t}</option>)}</select>
          <textarea value={fpB} onChange={e=>setFpB(e.target.value)} placeholder="Share your case, question, or insight..." rows={3} style={{...c.inp,marginBottom:8,resize:"vertical"}}/>
          <button onClick={addFP} style={c.btn}>Publish Post</button>
        </div>}
        {forum.map(p=><div key={p.id} style={c.card}>
          <div style={{display:"flex",gap:10}}>
            <div style={c.av(34,"#148f8f")}>{p.ini}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><b style={{fontSize:".85rem"}}>{p.author}</b><span style={{fontSize:".65rem",color:c.mute}}>{p.time}</span></div>
              <span style={{...c.tag("rgba(200,168,78,.12)",c.gold),marginTop:4}}>{p.cat}</span>
              <h4 style={{fontSize:"1rem",fontWeight:600,marginTop:6,lineHeight:1.4}}>{p.title}</h4>
              <p style={{fontSize:".88rem",color:c.txt2,marginTop:4,lineHeight:1.6}}>{p.body}</p>
              <div style={{display:"flex",gap:16,marginTop:8,fontSize:".75rem",color:c.mute}}><span>❤️ {p.lik} likes</span><span>💬 {p.rep} replies</span></div>
            </div>
          </div>
        </div>)}
      </div>}

      {/* ═══ RANK ═══ */}
      {pg==="rank"&&<div style={{...c.card,maxWidth:600}}>
        <h3 style={{color:c.gold,fontSize:"1.1rem",fontWeight:700,marginBottom:12}}>🏆 Leaderboard — Top Performers</h3>
        {[{n:"Dr. Meera Patel",cl:"SkinGlow Clinic, Mumbai",sc:92,str:15,i:"MP"},{n:"Dr. Arjun Reddy",cl:"Radiance Derma, Hyderabad",sc:88,str:12,i:"AR"},{n:uName,cl:profile?.clinic||"—",sc:acc,str:totA,i:uIni,me:true,ph:uPhoto},{n:"Dr. Sneha Kulkarni",cl:"Aura Aesthetics, Pune",sc:78,str:8,i:"SK"},{n:"Dr. Vikram Singh",cl:"DermaCare, Delhi",sc:72,str:6,i:"VS"}].sort((a,b)=>b.sc-a.sc).map((u,i)=>
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 10px",borderRadius:10,marginBottom:5,background:u.me?"rgba(200,168,78,.08)":"rgba(0,0,0,.1)",border:u.me?"1px solid rgba(200,168,78,.25)":"none"}}>
            <div style={{width:26,textAlign:"center",fontWeight:700,fontSize:".9rem",color:i<3?["#FFD700","#C0C0C0","#CD7F32"][i]:"#f0ede4"}}>{i<3?["🥇","🥈","🥉"][i]:i+1}</div>
            {u.ph?<img src={u.ph} style={{width:34,height:34,borderRadius:"50%",border:"2px solid "+(u.me?c.gold:c.teal)}}/>:<div style={c.av(34,u.me?c.gold:c.teal)}>{u.i}</div>}
            <div style={{flex:1}}><div style={{fontWeight:600,fontSize:".88rem"}}>{u.n}{u.me?" (You)":""}</div><div style={{fontSize:".7rem",color:c.mute}}>{u.cl}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:700,color:c.gold,fontSize:".95rem"}}>{u.sc}%</div><div style={{fontSize:".65rem",color:c.mute}}>🔥 {u.str} days</div></div>
          </div>)}
      </div>}

      {/* ═══ PROFILE ═══ */}
      {pg==="me"&&<div style={{maxWidth:600}}>
        <div style={{...c.card,textAlign:"center",padding:24}}>
          {uPhoto?<img src={uPhoto} style={{width:72,height:72,borderRadius:"50%",border:"3px solid #c8a84e",display:"block",margin:"0 auto 10px"}}/>:<div style={{...c.av(72,"#0d6b6e"),border:"3px solid #c8a84e",margin:"0 auto 10px",fontSize:"1.6rem"}}>{uIni}</div>}
          <div style={{color:c.gold,fontSize:"1.3rem",fontWeight:700}}>{uName}</div>
          <div style={{color:c.txt2,fontSize:".85rem",marginTop:2}}>{profile?.degree}</div>
          <div style={{color:c.mute,fontSize:".78rem",marginTop:2}}>{authUser?.email}</div>
          {isPd&&<div style={{...c.tag(c.gold,"#061e1e"),marginTop:8}}>⭐ Premium Member</div>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,margin:"12px 0"}}>
          {[["Quizzes Done",totA],["Accuracy",acc+"%"],["Rank","#3"]].map(([l,v])=><div key={l} style={{textAlign:"center",padding:"12px 6px",background:"rgba(0,0,0,.2)",borderRadius:10,border:"1px solid rgba(200,168,78,.08)"}}><div style={{fontSize:"1.3rem",fontWeight:700,color:c.gold}}>{v}</div><div style={{fontSize:".58rem",color:c.mute,textTransform:"uppercase",letterSpacing:.5}}>{l}</div></div>)}
        </div>
        <div style={c.card}>
          {[["Email",authUser?.email],["Clinic",profile?.clinic],["Address",profile?.address],["Member Since",profile?.joined?fD(profile.joined):"—"]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(200,168,78,.06)",fontSize:".85rem"}}><span style={{color:c.mute}}>{l}</span><span style={{fontWeight:500}}>{v||"—"}</span></div>)}
          <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
            {!isPd&&<button onClick={()=>{const p={...profile,paid:true};setProfile(p);localStorage.setItem("cmx_profile_"+authUser.uid,JSON.stringify(p));sh("⭐ Premium activated!");}} style={c.btn}>⭐ Go Premium</button>}
            <button onClick={doLogout} style={{...c.btnO,background:"rgba(231,76,60,.12)",color:c.err,borderColor:"rgba(231,76,60,.2)"}}>Sign Out</button>
          </div>
        </div>
      </div>}

      {/* ═══ ADMIN ═══ */}
      {pg==="admin"&&isAdm&&<div style={c.card}>
        <h3 style={{color:c.gold,fontSize:"1.1rem",fontWeight:700,marginBottom:10}}>⚙ Admin Dashboard</h3>
        <div style={{display:"flex",gap:4,marginBottom:14}}>
          {[["stats","📊 Overview"],["quiz","🧠 Quiz"],["users","👥 Users"]].map(([id,l])=><button key={id} onClick={()=>setATab(id)} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${aTab===id?c.gold:"rgba(200,168,78,.1)"}`,background:aTab===id?"rgba(200,168,78,.12)":"transparent",color:aTab===id?c.gold:c.txt2,cursor:"pointer",fontSize:".78rem",fontFamily:"inherit"}}>{l}</button>)}
        </div>
        {aTab==="stats"&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>{[["Articles",arts.length],["Resources",res.length],["Videos",vids.length],["Forum Posts",forum.length],["Quiz Questions",quiz.length],["Users","1+"]].map(([l,v])=><div key={l} style={{textAlign:"center",padding:12,background:"rgba(0,0,0,.15)",borderRadius:10}}><div style={{fontSize:"1.3rem",fontWeight:700,color:c.gold}}>{v}</div><div style={{fontSize:".6rem",color:c.mute,textTransform:"uppercase"}}>{l}</div></div>)}</div>}
        {aTab==="quiz"&&<div><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{color:c.mute,fontSize:".82rem"}}>{quiz.length} questions</span><button onClick={genQ} style={c.btn}>🤖 Generate Today's Question</button></div>{quiz.map(q=><div key={q.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(200,168,78,.06)"}}><div><div style={{fontWeight:500,fontSize:".88rem"}}>{q.cat}</div><div style={{fontSize:".7rem",color:c.mute}}>{fD(q.date)} • {q.diff}</div></div><button onClick={()=>{setSelD(q.date);go("quiz")}} style={{...c.btnO,...c.btnSm}}>View</button></div>)}</div>}
        {aTab==="users"&&<div><p style={{color:c.txt2,fontSize:".88rem",marginBottom:8}}>Admin Accounts:</p>{ADMINS.map(e=><div key={e} style={{fontSize:".85rem",color:c.tealL,padding:"4px 0"}}>✓ {e}</div>)}<p style={{color:c.mute,fontSize:".78rem",marginTop:12}}>Full user management available after Firestore rules are configured.</p></div>}
      </div>}

      {/* ═══ FOOTER ═══ */}
      <div style={{textAlign:"center",padding:"20px 0",borderTop:"1px solid rgba(200,168,78,.06)",marginTop:16}}>
        <div style={{fontSize:".6rem",color:c.mute,letterSpacing:1.5,textTransform:"uppercase"}}>Powered by <span style={{color:c.gold,fontWeight:600}}>ABSOLUTE INSTITUTE</span></div>
        <div style={{fontSize:".5rem",color:c.mute,marginTop:3}}>Slimming • Skin • Hair • Laser Clinic</div>
      </div>

      </div>
      {toast&&<div style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",padding:"10px 24px",background:c.teal,color:"#fff",borderRadius:10,fontSize:".88rem",zIndex:1000,boxShadow:"0 4px 20px rgba(0,0,0,.4)"}}>{toast}</div>}
    </div>);
}
