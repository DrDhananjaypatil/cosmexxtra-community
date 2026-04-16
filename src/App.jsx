import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {apiKey:"AIzaSyBFaxZyhRvucfaZACl68SdNFb_CKPlkZBU",authDomain:"cosmexxtra-1b08e.firebaseapp.com",projectId:"cosmexxtra-1b08e",storageBucket:"cosmexxtra-1b08e.firebasestorage.app",messagingSenderId:"419443766419",appId:"1:419443766419:web:5ca9336401284094060966"};
const app=initializeApp(firebaseConfig);const auth=getAuth(app);const db=getFirestore(app);const gProv=new GoogleAuthProvider();
const ADMINS=["drjpatil@gmail.com","absoluteinstituteedu@gmail.com"];
const TOPICS=["Skin Disorders","Chemical Peels","Botox & Fillers","Laser Treatments","Hair Restoration","Body Contouring","Ethics","Patient Safety"];
const getIST=()=>new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
const ds=d=>d.toISOString().split("T")[0];
const fD=s=>new Date(s+"T12:00:00").toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
const dN=s=>new Date(s+"T12:00:00").toLocaleDateString("en-IN",{weekday:"short"});

const T={bg:"#f8f7f4",white:"#fff",teal:"#0d6b6e",tealL:"#1ab5a5",tealBg:"#e1f5ee",gold:"#c8a84e",goldBg:"#fdf6e3",goldD:"#a08030",txt:"#1a1a1a",txt2:"#555",mute:"#999",light:"#bbb",border:"#e8e6e0",ok:"#1a7d42",okBg:"#e1f9ec",err:"#c0392b",errBg:"#fde8e8",warn:"#854f0b",warnBg:"#fef3e2",
  card:{background:"#fff",border:"1px solid #e8e6e0",borderRadius:14,padding:20,marginBottom:14},
  btn:{padding:"10px 22px",background:"#0d6b6e",color:"#fff",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:".88rem",fontFamily:"inherit"},
  btnO:{padding:"10px 22px",background:"#fff",color:"#0d6b6e",border:"1px solid #0d6b6e",borderRadius:10,fontWeight:500,cursor:"pointer",fontSize:".88rem",fontFamily:"inherit"},
  btnSm:{padding:"6px 14px",fontSize:".78rem",borderRadius:8},
  btnGold:{padding:"10px 22px",background:"linear-gradient(135deg,#c8a84e,#a08030)",color:"#fff",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:".88rem",fontFamily:"inherit"},
  inp:{width:"100%",padding:"11px 14px",background:"#fff",border:"1px solid #e8e6e0",borderRadius:10,color:"#1a1a1a",fontSize:".9rem",fontFamily:"inherit",boxSizing:"border-box"},
  tag:(bg,cl)=>({fontSize:".7rem",padding:"3px 10px",borderRadius:16,fontWeight:500,background:bg,color:cl,display:"inline-block"}),
  av:(sz,bg,cl)=>({width:sz,height:sz,minWidth:sz,borderRadius:"50%",background:bg||"#e1f5ee",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:cl||"#0d6b6e",fontSize:sz*.3})};

const arts=[
  {id:"a1",title:"Understanding Melasma: A Comprehensive Guide for Practitioners",cat:"Skin Disorders",author:"Dr. J Patil",date:"2026-04-10",body:"Melasma is a chronic pigmentary disorder characterized by symmetrical brown patches. This guide covers evidence-based approaches including topical therapy with hydroquinone, tranexamic acid, chemical peels, and laser treatments. Special considerations for Fitzpatrick IV-VI skin types are discussed with protocols for combination therapy that minimize rebound hyperpigmentation.",feat:true},
  {id:"a2",title:"Chemical Peels: Selecting the Right Peel for Indian Skin Types",cat:"Chemical Peels",author:"Dr. J Patil",date:"2026-04-08",body:"Fitzpatrick types IV-VI require careful peel selection. This article covers glycolic acid (20-70%), salicylic acid, TCA (15-35%), and combination protocols. Pre-peel preparation, application technique, and post-peel care to minimize PIH risk are detailed."},
  {id:"a3",title:"PRP Therapy in Hair Restoration: Evidence Review 2026",cat:"Hair Restoration",author:"Dr. J Patil",date:"2026-04-05",body:"PRP has shown promising results in androgenetic alopecia. This review covers preparation methods (single vs double spin), injection protocols, outcomes at 3-6-12 months, and combination approaches with minoxidil and finasteride."},
  {id:"a4",title:"Laser Hair Removal: Managing Expectations",cat:"Laser Treatments",author:"Dr. J Patil",date:"2026-04-02",body:"Setting realistic expectations is crucial. Covers diode, Nd:YAG, and alexandrite lasers for different skin types. Common complications including paradoxical hypertrichosis and PIH with management protocols."},
];
const res=[
  {id:"r1",t:"Complete Guide to Laser Safety Protocols",pg:42,sz:"3.2 MB",free:true,ic:"📄"},{id:"r2",t:"Fitzpatrick Skin Type Classification Chart",pg:8,sz:"1.1 MB",free:true,ic:"📊"},
  {id:"r3",t:"Botulinum Toxin Injection Points Atlas",pg:64,sz:"8.5 MB",free:false,ic:"📕"},{id:"r4",t:"Chemical Peel Concentration & pH Guide",pg:24,sz:"2.0 MB",free:true,ic:"📋"},
  {id:"r5",t:"Advanced Dermatoscopy Manual (2026)",pg:156,sz:"22 MB",free:false,ic:"📚"},{id:"r6",t:"Patient Consent Form Templates",pg:12,sz:"0.8 MB",free:true,ic:"📝"}];
const vids=[
  {id:"v1",t:"Live Demo: Q-Switched Nd:YAG for Melasma",dur:"45 min",cat:"Laser",ic:"🎥",free:true,desc:"Live demo of laser toning on type IV skin with post-care."},
  {id:"v2",t:"Thread Lift Masterclass",dur:"1h 20m",cat:"Threads",ic:"🎓",free:false,desc:"PDO, PCL, PLLA thread types with live procedure."},
  {id:"v3",t:"PRP Preparation & Injection for Hair Loss",dur:"35 min",cat:"Hair",ic:"💉",free:true,desc:"Step-by-step PRP preparation and injection technique."},
  {id:"v4",t:"Advanced Chemical Peel Combinations",dur:"55 min",cat:"Peels",ic:"🧪",free:false,desc:"Combination peel protocols for resistant pigmentation."},
  {id:"v5",t:"Ethics in Aesthetic Practice",dur:"40 min",cat:"Ethics",ic:"⚖️",free:false,desc:"Real-world ethical dilemmas and case studies."}];
const initForum=[
  {id:"f1",author:"Dr. Priya Sharma",ini:"PS",title:"Best protocol for PIH in type V skin?",cat:"Skin Disorders",rep:8,lik:12,time:"2 hours ago",body:"Patient with severe PIH after acne. Fitzpatrick V. What combination protocol?"},
  {id:"f2",author:"Dr. Rahul Menon",ini:"RM",title:"New generation PCL threads experiences?",cat:"Thread Lifts",rep:5,lik:7,time:"5 hours ago",body:"Looking for real-world results of PCL threads for mid-face lifting."},
  {id:"f3",author:"Dr. Ananya Das",ini:"AD",title:"Managing laser hair removal expectations",cat:"Laser Treatments",rep:14,lik:23,time:"1 day ago",body:"How do you handle patients expecting permanent results after 2-3 sessions?"}];

async function genQuizAI(date){
  const tp=TOPICS[Math.floor(Math.random()*TOPICS.length)];const df=Math.random()>.5?"Advanced":"Moderate";
  try{const r=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,messages:[{role:"user",content:`Master cosmetologist 20+ yrs experience. Generate clinical quiz.\nTopic: ${tp} | Difficulty: ${df}\nCase scenario, 3 options, 1 correct.\nJSON ONLY:\n{"category":"${tp}","difficulty":"${df}","scenario":"...","question":"...","options":["A","B","C"],"correctIndex":0,"explanation":"<p>...</p>"}`}]})});
    const data=await r.json();const q=JSON.parse(data.content[0].text.replace(/```json\s*/g,"").replace(/```/g,"").trim());
    return{id:"ai_"+date,date,cat:q.category,diff:q.difficulty,scen:q.scenario,q:q.question,opts:q.options,ci:q.correctIndex,expl:q.explanation,cmts:[]};
  }catch(e){return null;}}

export default function App(){
  const[authUser,setAuthUser]=useState(null);
  const[profile,setProfile]=useState(null);
  const[scr,setScr]=useState("loading");
  const[pg,setPg]=useState("home");
  const[quiz,setQuiz]=useState([]);
  const[ans,setAns]=useState({});
  const[forum,setForum]=useState(initForum);
  const[selD,setSelD]=useState(ds(getIST()));
  const[selA,setSelA]=useState(null);
  const[selV,setSelV]=useState(null);
  const[toast,setToast]=useState(null);
  const[cmt,setCmt]=useState("");
  const[newP,setNewP]=useState(false);
  const[fpT,setFpT]=useState("");const[fpB,setFpB]=useState("");const[fpC,setFpC]=useState(TOPICS[0]);
  const[ld,setLd]=useState(false);
  const[aTab,setATab]=useState("stats");
  const[pf,setPf]=useState({degree:"",clinic:"",address:""});

  // ═══ AUTH STATES ═══
  const[authMode,setAuthMode]=useState("signin"); // signin, signup, forgot
  const[authEmail,setAuthEmail]=useState("");
  const[authPass,setAuthPass]=useState("");
  const[authName,setAuthName]=useState("");
  const[authBusy,setAuthBusy]=useState(false);
  const[authErr,setAuthErr]=useState("");

  useEffect(()=>{const u=onAuthStateChanged(auth,async(u)=>{if(u){setAuthUser(u);try{const s=await getDoc(doc(db,"users",u.uid));if(s.exists()){setProfile(s.data());setScr("main")}else{setScr("setup")}}catch{const l=localStorage.getItem("cmx_p_"+u.uid);if(l){setProfile(JSON.parse(l));setScr("main")}else setScr("setup")}}else{setAuthUser(null);setProfile(null);setScr("login")}});return()=>u()},[]);
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(null),3000);return()=>clearTimeout(t)}},[toast]);

  const sh=m=>setToast(m);const go=p=>{setPg(p);setSelA(null);setSelV(null)};
  const isAdm=profile&&ADMINS.includes(authUser?.email);const isPd=profile?.paid;
  const today=ds(getIST());const hr=getIST().getHours();
  const totA=Object.keys(ans).length;const corr=Object.entries(ans).filter(([d,a])=>{const q=quiz.find(x=>x.date===d);return q&&a===q.ci}).length;const acc=totA?Math.round(corr/totA*100):0;
  const uName=profile?.name||authUser?.displayName||"Doctor";
  const uIni=(uName.replace(/^Dr\.?\s*/i,"").split(" ").map(w=>w[0]).join("").toUpperCase()||"D").slice(0,2);
  const uPhoto=authUser?.photoURL;

  // ═══ AUTH HANDLERS ═══
  const doGoogleLogin=async()=>{setAuthErr("");try{await signInWithPopup(auth,gProv)}catch(e){if(e.code!=="auth/popup-closed-by-user")setAuthErr("Google sign-in failed")}};

  const doEmailSignup=async()=>{
    setAuthErr("");
    if(!authName.trim())return setAuthErr("Enter your name");
    if(!authEmail.trim())return setAuthErr("Enter your email");
    if(authPass.length<6)return setAuthErr("Password must be at least 6 characters");
    setAuthBusy(true);
    try{
      const cred=await createUserWithEmailAndPassword(auth,authEmail,authPass);
      await updateProfile(cred.user,{displayName:authName});
    }catch(e){
      if(e.code==="auth/email-already-in-use")setAuthErr("Email already registered. Try signing in.");
      else if(e.code==="auth/invalid-email")setAuthErr("Invalid email address");
      else if(e.code==="auth/weak-password")setAuthErr("Password too weak");
      else setAuthErr("Sign up failed: "+e.message);
    }
    setAuthBusy(false);
  };

  const doEmailSignin=async()=>{
    setAuthErr("");
    if(!authEmail.trim())return setAuthErr("Enter your email");
    if(!authPass)return setAuthErr("Enter your password");
    setAuthBusy(true);
    try{
      await signInWithEmailAndPassword(auth,authEmail,authPass);
    }catch(e){
      if(e.code==="auth/user-not-found")setAuthErr("No account found. Sign up first.");
      else if(e.code==="auth/wrong-password"||e.code==="auth/invalid-credential")setAuthErr("Incorrect email or password");
      else if(e.code==="auth/invalid-email")setAuthErr("Invalid email");
      else if(e.code==="auth/too-many-requests")setAuthErr("Too many attempts. Try later or reset password.");
      else setAuthErr("Sign in failed");
    }
    setAuthBusy(false);
  };

  const doForgot=async()=>{
    setAuthErr("");
    if(!authEmail.trim())return setAuthErr("Enter your email first");
    setAuthBusy(true);
    try{
      await sendPasswordResetEmail(auth,authEmail);
      sh("📧 Password reset email sent! Check your inbox.");
      setAuthMode("signin");
    }catch(e){
      if(e.code==="auth/user-not-found")setAuthErr("No account with this email");
      else setAuthErr("Failed to send reset email");
    }
    setAuthBusy(false);
  };

  const doLogout=async()=>{if(confirm("Sign out?")){await signOut(auth)}};

  const savePf=async()=>{if(!pf.degree){sh("Degree required");return}const p={name:authUser.displayName||authName||"Doctor",email:authUser.email,photo:authUser.photoURL||"",degree:pf.degree,clinic:pf.clinic,address:pf.address,paid:false,joined:ds(getIST()),initials:uIni};try{await setDoc(doc(db,"users",authUser.uid),p)}catch{}localStorage.setItem("cmx_p_"+authUser.uid,JSON.stringify(p));setProfile(p);setScr("main");sh("Welcome to CosMExxtra!")};
  const submitA=(d,i)=>{setAns(p=>({...p,[d]:i}));const q=quiz.find(q=>q.date===d);sh(q&&i===q.ci?"🎉 Correct!":"Answer recorded.")};
  const addCmt=d=>{if(!cmt.trim())return;setQuiz(p=>p.map(q=>q.date===d?{...q,cmts:[...(q.cmts||[]),{id:Date.now(),n:uName,ini:uIni,txt:cmt,tm:getIST().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true})}]}:q));setCmt("")};
  const genQ=async()=>{if(quiz.find(q=>q.date===today)){sh("Already exists!");return}setLd(true);const q=await genQuizAI(today);if(q){setQuiz(p=>[q,...p]);sh("Question is live!")}else sh("Failed");setLd(false)};

  const W="1100px";
  const dates=Array.from({length:14},(_,i)=>{let d=new Date(getIST());d.setDate(d.getDate()-(13-i));return ds(d)});
  const qObj=quiz.find(q=>q.date===selD);const uA=ans[selD];const isT=selD===today;const rev=!isT||hr>=21;const dd=Math.floor((new Date(today)-new Date(selD))/864e5);const canA=uA===undefined&&(isT||(dd<=3&&dd>0));

  if(scr==="loading")return(<div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui"}}><div style={{textAlign:"center"}}><div style={{...T.av(56,T.tealBg,T.teal),border:"2px solid "+T.teal,margin:"0 auto 12px",fontSize:"1.2rem"}}>🌿</div><p style={{color:T.mute}}>Loading...</p></div></div>);

  // ═══════════ LOGIN SCREEN ═══════════
  if(scr==="login")return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#f8f7f4,#e1f5ee 50%,#f8f7f4)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"system-ui"}}>
      <div style={{...T.av(80,T.tealBg,T.teal),border:"3px solid "+T.gold,boxShadow:"0 8px 32px rgba(13,107,110,.15)",marginBottom:16,fontSize:"1.8rem"}}>🌿</div>
      <h1 style={{fontSize:"2.2rem",fontWeight:800,color:T.teal,marginBottom:2}}>CosMExxtra</h1>
      <p style={{fontSize:".7rem",color:T.gold,letterSpacing:3,textTransform:"uppercase",marginBottom:10,fontWeight:600}}>Professional Aesthetic Community</p>
      
      <div style={{...T.card,width:"100%",maxWidth:400,padding:24,marginTop:16}}>
        <h2 style={{color:T.txt,fontSize:"1.05rem",fontWeight:700,marginBottom:4,textAlign:"center"}}>
          {authMode==="signin"?"Welcome back":authMode==="signup"?"Create your account":"Reset password"}
        </h2>
        <p style={{color:T.mute,fontSize:".78rem",textAlign:"center",marginBottom:18}}>
          {authMode==="signin"?"Sign in to continue":authMode==="signup"?"Join the community":"We'll send you a reset link"}
        </p>

        {/* Google Button */}
        {authMode!=="forgot"&&<>
          <button onClick={doGoogleLogin} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,background:"#fff",color:"#333",border:"1px solid #ddd",padding:"11px",borderRadius:10,fontSize:".9rem",fontWeight:500,cursor:"pointer",width:"100%",fontFamily:"inherit"}}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>

          <div style={{display:"flex",alignItems:"center",gap:10,margin:"16px 0",color:T.mute,fontSize:".75rem"}}>
            <div style={{flex:1,height:1,background:T.border}}/>or<div style={{flex:1,height:1,background:T.border}}/>
          </div>
        </>}

        {/* Email/Password form */}
        {authMode==="signup"&&<input value={authName} onChange={e=>setAuthName(e.target.value)} placeholder="Full name (Dr. ...)" style={{...T.inp,marginBottom:10}}/>}
        <input value={authEmail} onChange={e=>setAuthEmail(e.target.value)} type="email" placeholder="Email address" style={{...T.inp,marginBottom:10}}/>
        {authMode!=="forgot"&&<input value={authPass} onChange={e=>setAuthPass(e.target.value)} type="password" placeholder="Password (6+ characters)" style={{...T.inp,marginBottom:10}} onKeyDown={e=>e.key==="Enter"&&(authMode==="signin"?doEmailSignin():doEmailSignup())}/>}

        {authErr&&<div style={{background:T.errBg,color:T.err,padding:"8px 12px",borderRadius:8,fontSize:".8rem",marginBottom:10}}>⚠ {authErr}</div>}

        <button onClick={authMode==="signin"?doEmailSignin:authMode==="signup"?doEmailSignup:doForgot} disabled={authBusy} style={{...T.btn,width:"100%",opacity:authBusy?.6:1}}>
          {authBusy?"Please wait...":authMode==="signin"?"Sign in":authMode==="signup"?"Create account":"Send reset email"}
        </button>

        <div style={{marginTop:14,textAlign:"center",fontSize:".8rem"}}>
          {authMode==="signin"&&<>
            <span style={{color:T.mute}}>New here? </span>
            <span onClick={()=>{setAuthMode("signup");setAuthErr("")}} style={{color:T.teal,cursor:"pointer",fontWeight:600}}>Create account</span>
            <div style={{marginTop:6}}><span onClick={()=>{setAuthMode("forgot");setAuthErr("")}} style={{color:T.mute,cursor:"pointer",fontSize:".75rem"}}>Forgot password?</span></div>
          </>}
          {authMode==="signup"&&<>
            <span style={{color:T.mute}}>Have an account? </span>
            <span onClick={()=>{setAuthMode("signin");setAuthErr("")}} style={{color:T.teal,cursor:"pointer",fontWeight:600}}>Sign in</span>
          </>}
          {authMode==="forgot"&&<span onClick={()=>{setAuthMode("signin");setAuthErr("")}} style={{color:T.teal,cursor:"pointer",fontWeight:600}}>← Back to sign in</span>}
        </div>
      </div>

      <p style={{marginTop:24,fontSize:".6rem",color:T.light,letterSpacing:2,textTransform:"uppercase"}}>Powered by <span style={{color:T.gold,fontWeight:600}}>ABSOLUTE INSTITUTE</span></p>
    </div>);

  // ═══ SETUP ═══
  if(scr==="setup")return(
    <div style={{minHeight:"100vh",background:T.bg,padding:24,fontFamily:"system-ui",color:T.txt}}>
      <div style={{maxWidth:520,margin:"0 auto"}}><div style={{...T.card,borderLeft:"3px solid "+T.gold}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
          {uPhoto?<img src={uPhoto} style={{width:50,height:50,borderRadius:"50%",border:"2px solid "+T.teal}}/>:<div style={T.av(50,T.tealBg,T.teal)}>{uIni}</div>}
          <div><div style={{fontWeight:700,fontSize:"1.1rem",color:T.txt}}>{authUser?.displayName||authName||"Doctor"}</div><div style={{fontSize:".8rem",color:T.mute}}>{authUser?.email}</div></div>
        </div>
        <h2 style={{color:T.teal,fontSize:"1.15rem",fontWeight:700,marginBottom:16}}>Complete your profile</h2>
        {[["degree","Degree / Qualification *"],["clinic","Clinic Name"],["address","City, State"]].map(([k,l])=>
          <div key={k} style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:".78rem",color:T.teal,marginBottom:5,fontWeight:500}}>{l}</label>
            <input value={pf[k]} onChange={e=>setPf(p=>({...p,[k]:e.target.value}))} placeholder={l.replace(" *","")} style={T.inp}/>
          </div>)}
        <button onClick={savePf} style={{...T.btn,width:"100%",marginTop:8}}>Save & enter community →</button>
      </div></div></div>);

  // ═══ MAIN ═══
  const navs=[{id:"home",ic:"🏠",l:"Home"},{id:"quiz",ic:"🧠",l:"Quiz"},{id:"library",ic:"📚",l:"Library"},{id:"videos",ic:"🎥",l:"Videos"},{id:"forum",ic:"💬",l:"Forum"},{id:"rank",ic:"🏆",l:"Rank"},{id:"me",ic:"👤",l:"Me"},...(isAdm?[{id:"admin",ic:"⚙️",l:"Admin"}]:[])];

  return(
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"system-ui",color:T.txt}}>
      <div style={{position:"sticky",top:0,zIndex:100,background:"#ffffffee",backdropFilter:"blur(16px)",borderBottom:"1px solid "+T.border,padding:"8px 24px"}}>
        <div style={{maxWidth:W,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer"}} onClick={()=>go("home")}>
            <div style={{...T.av(34,T.tealBg,T.teal),border:"2px solid "+T.gold,fontSize:".85rem"}}>🌿</div>
            <div><div style={{fontSize:"1.1rem",fontWeight:700,color:T.teal}}>CosMExxtra</div><div style={{fontSize:".48rem",color:T.mute,letterSpacing:2,textTransform:"uppercase"}}>Aesthetic Medicine Community</div></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:2}}>
            {navs.map(n=><button key={n.id} onClick={()=>go(n.id)} style={{background:pg===n.id?T.tealBg:"none",border:"none",color:pg===n.id?T.teal:T.mute,padding:"6px 11px",borderRadius:9,cursor:"pointer",fontSize:".65rem",fontFamily:"inherit",fontWeight:pg===n.id?600:400,display:"flex",flexDirection:"column",alignItems:"center",gap:1,minWidth:44}}><span style={{fontSize:".9rem"}}>{n.ic}</span>{n.l}</button>)}
            {uPhoto?<img src={uPhoto} onClick={()=>go("me")} style={{width:32,height:32,borderRadius:"50%",border:"2px solid "+T.tealBg,marginLeft:8,cursor:"pointer"}}/>:<div onClick={()=>go("me")} style={{...T.av(32,T.tealBg,T.teal),marginLeft:8,cursor:"pointer",border:"2px solid "+T.tealBg}}>{uIni}</div>}
          </div>
        </div>
      </div>

      <div style={{maxWidth:W,margin:"0 auto",padding:"18px 24px"}}>

      {pg==="home"&&!selA&&<div>
        <div style={{...T.card,borderLeft:"3px solid "+T.gold,background:"linear-gradient(135deg,#fff,#fdfcf8)",padding:24}}>
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:14}}>
            {uPhoto?<img src={uPhoto} style={{width:52,height:52,borderRadius:"50%",border:"2px solid "+T.teal}}/>:<div style={T.av(52,T.tealBg,T.teal)}>{uIni}</div>}
            <div><h2 style={{fontSize:"1.4rem",fontWeight:700,color:T.txt,margin:0}}>Welcome back, {uName.split(" ")[0]} 👋</h2><p style={{color:T.txt2,fontSize:".9rem",marginTop:3}}>Stay ahead with daily quizzes, expert insights & community connections.</p></div>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button onClick={()=>go("quiz")} style={T.btn}>🧠 Today's quiz</button><button onClick={()=>go("forum")} style={T.btnO}>💬 Join discussion</button><button onClick={()=>go("library")} style={T.btnO}>📚 Resources</button></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,margin:"16px 0"}}>
          {[["🧠",totA,"Quizzes done"],["✅",acc+"%","Accuracy"],["📚",res.length,"Resources"],["🎥",vids.length,"Videos"]].map(([i,v,l])=>
            <div key={l} style={{...T.card,textAlign:"center",padding:"16px 8px",marginBottom:0}}>
              <div style={{fontSize:"1.2rem",marginBottom:4}}>{i}</div>
              <div style={{fontSize:"1.4rem",fontWeight:700,color:T.teal}}>{v}</div>
              <div style={{fontSize:".6rem",color:T.mute,textTransform:"uppercase",letterSpacing:.5,marginTop:3}}>{l}</div>
            </div>)}
        </div>
        <h3 style={{fontSize:"1.05rem",fontWeight:700,color:T.txt,marginBottom:12}}>Latest articles</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {arts.map(a=><div key={a.id} onClick={()=>setSelA(a)} style={{...T.card,cursor:"pointer",marginBottom:0}}>
            <div style={{display:"flex",gap:5,marginBottom:8}}><span style={T.tag(T.tealBg,T.teal)}>{a.cat}</span>{a.feat&&<span style={T.tag(T.goldBg,T.goldD)}>Featured</span>}</div>
            <h4 style={{fontSize:".95rem",fontWeight:600,lineHeight:1.4,color:T.txt}}>{a.title}</h4>
            <p style={{fontSize:".8rem",color:T.txt2,marginTop:8,lineHeight:1.6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{a.body}</p>
            <p style={{fontSize:".72rem",color:T.mute,marginTop:8}}>{a.author} · {fD(a.date)}</p>
          </div>)}
        </div>
      </div>}

      {pg==="home"&&selA&&<div>
        <button onClick={()=>setSelA(null)} style={{...T.btnO,...T.btnSm,marginBottom:14}}>← Back</button>
        <div style={{...T.card,maxWidth:720}}><span style={T.tag(T.tealBg,T.teal)}>{selA.cat}</span><h2 style={{fontSize:"1.5rem",fontWeight:700,color:T.txt,marginTop:10,lineHeight:1.35}}>{selA.title}</h2><p style={{fontSize:".82rem",color:T.mute,marginTop:8}}>By {selA.author} · {fD(selA.date)}</p><div style={{marginTop:20,fontSize:"1rem",color:T.txt2,lineHeight:1.9}}>{selA.body}</div></div>
      </div>}

      {pg==="quiz"&&<div>
        <div style={{display:"flex",gap:6,overflowX:"auto",padding:"4px 0 14px"}}>
          {dates.map(d=>{const dt=new Date(d+"T12:00:00");const sun=dt.getDay()===0;const on=d===selD;
            return<div key={d} onClick={()=>!sun&&setSelD(d)} style={{minWidth:52,padding:"8px 4px",textAlign:"center",borderRadius:10,border:`1.5px solid ${on?T.teal:T.border}`,cursor:sun?"not-allowed":"pointer",background:on?T.tealBg:"#fff",opacity:sun?.3:1}}>
              <div style={{fontSize:".58rem",color:on?T.teal:T.mute,textTransform:"uppercase",fontWeight:on?600:400}}>{dN(d)}</div>
              <div style={{fontSize:"1rem",fontWeight:700,color:on?T.teal:T.txt}}>{dt.getDate()}</div>
            </div>})}
        </div>
        {qObj&&isT&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:10,background:hr<21?T.goldBg:T.okBg,borderRadius:10,marginBottom:12,fontSize:".82rem",color:hr<21?T.warn:T.ok}}>{hr<21?<>⏱ Answer reveals at <b style={{margin:"0 4px"}}>9:00 PM IST</b></>:"✓ Answer has been revealed"}</div>}
        {ld&&<div style={{...T.card,textAlign:"center",padding:50}}><p style={{color:T.mute}}>⏳ Generating today's clinical question...</p></div>}
        {!ld&&!qObj&&<div style={{...T.card,textAlign:"center",padding:40}}>
          {selD===today?<><div style={{fontSize:"2rem",marginBottom:10}}>🔬</div><p style={{color:T.teal,fontSize:"1.05rem",fontWeight:600}}>Today's question</p><p style={{color:T.mute,fontSize:".88rem",margin:"8px 0 16px"}}>Question will be posted at 10:00 AM IST</p>{isAdm&&<button onClick={genQ} style={T.btn}>🤖 Generate now (Admin)</button>}</>
          :<p style={{color:T.mute,fontSize:".92rem"}}>No question available for this date</p>}
        </div>}
        {!ld&&qObj&&<div style={{display:"grid",gridTemplateColumns:"1fr 350px",gap:16,alignItems:"start"}}>
          <div style={{...T.card,borderLeft:"3px solid "+T.teal}}>
            <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{fontSize:".8rem",color:T.mute}}>📅 {fD(qObj.date)}</span>
              {isT&&hr<21&&<span style={T.tag(T.okBg,T.ok)}>● LIVE</span>}
              {dd>0&&dd<=3&&canA&&<span style={T.tag(T.tealBg,T.teal)}>Late entry</span>}
              {rev&&!isT&&<span style={T.tag(T.errBg,T.err)}>Closed</span>}
            </div>
            <div style={{display:"flex",gap:6,marginBottom:12}}><span style={T.tag(T.tealBg,T.teal)}>{qObj.cat}</span><span style={T.tag(T.warnBg,T.warn)}>{qObj.diff}</span></div>
            {qObj.scen&&<div style={{background:T.bg,borderLeft:"3px solid "+T.gold,padding:"12px 16px",marginBottom:16,borderRadius:"0 10px 10px 0",fontSize:".9rem",color:T.txt2,lineHeight:1.65}}>{qObj.scen}</div>}
            <div style={{fontSize:"1.1rem",fontWeight:600,lineHeight:1.6,marginBottom:16,color:T.txt}}>{qObj.q}</div>
            {qObj.opts.map((o,i)=>{const l="ABC"[i];const sr=uA!==undefined||(rev&&!canA);const co=sr&&i===qObj.ci;const wr=sr&&i===uA&&uA!==qObj.ci;
              return<div key={i} onClick={()=>canA&&submitA(selD,i)} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px 16px",background:co?T.okBg:wr?T.errBg:"#fff",border:`1.5px solid ${co?"#1a7d42":wr?"#c0392b":T.border}`,borderRadius:12,marginBottom:10,cursor:canA?"pointer":"default",opacity:!canA&&!sr?.5:1}}>
                <div style={{...T.av(28,co?"#1a7d42":wr?"#c0392b":T.tealBg,co||wr?"#fff":T.teal),fontSize:".78rem",flexShrink:0}}>{l}</div>
                <div style={{fontSize:".92rem",lineHeight:1.55,color:T.txt}}>{o}</div>
              </div>})}
            {uA!==undefined&&<p style={{color:uA===qObj.ci?T.ok:T.err,fontWeight:600,fontSize:".9rem",marginTop:10}}>{uA===qObj.ci?"✓ Correct!":"✗ Incorrect."}</p>}
            {((uA!==undefined&&rev)||(!canA&&rev&&dd>0))&&<div style={{background:T.goldBg,border:"1px solid #f0e6c8",borderRadius:12,padding:16,marginTop:12}}><div style={{color:T.goldD,fontWeight:700,fontSize:".92rem",marginBottom:8}}>💡 Expert explanation</div><div style={{fontSize:".88rem",color:T.txt2,lineHeight:1.75}} dangerouslySetInnerHTML={{__html:qObj.expl}}/></div>}
          </div>
          <div style={T.card}>
            <div style={{fontSize:".88rem",color:T.teal,fontWeight:600,marginBottom:10}}>💬 Discussion ({qObj.cmts?.length||0})</div>
            <div style={{maxHeight:400,overflowY:"auto"}}>
              {(qObj.cmts||[]).map(x=><div key={x.id} style={{padding:"8px 0",borderBottom:"1px solid "+T.border}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><div style={T.av(22,T.tealBg,T.teal)}>{x.ini}</div><b style={{fontSize:".8rem",color:T.txt}}>{x.n}</b><span style={{fontSize:".65rem",color:T.mute}}>{x.tm}</span></div>
                <div style={{fontSize:".85rem",color:T.txt2,paddingLeft:28,lineHeight:1.55}}>{x.txt}</div>
              </div>)}
              {!qObj.cmts?.length&&<p style={{color:T.mute,fontSize:".82rem"}}>No comments yet. Be the first!</p>}
            </div>
            <div style={{display:"flex",gap:6,marginTop:12}}>
              <input value={cmt} onChange={e=>setCmt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCmt(selD)} placeholder="Your thoughts..." style={{...T.inp,borderRadius:20,padding:"9px 14px",fontSize:".82rem",flex:1}}/>
              <button onClick={()=>addCmt(selD)} style={{...T.btn,...T.btnSm}}>Post</button>
            </div>
          </div>
        </div>}
      </div>}

      {pg==="library"&&<div>
        <h3 style={{fontSize:"1.15rem",fontWeight:700,color:T.txt,marginBottom:4}}>📚 Resource library</h3>
        <p style={{color:T.txt2,fontSize:".88rem",marginBottom:16}}>Download clinical guides, atlases, templates & more</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:14}}>
          {res.map(r=><div key={r.id} style={{...T.card,display:"flex",gap:16,alignItems:"center",marginBottom:0}}>
            <div style={{fontSize:"2.2rem"}}>{r.ic}</div>
            <div style={{flex:1}}><h4 style={{fontSize:".92rem",fontWeight:600,color:T.txt,lineHeight:1.3}}>{r.t}</h4><div style={{fontSize:".75rem",color:T.mute,marginTop:4}}>PDF · {r.pg} pages · {r.sz}</div>
              <div style={{marginTop:8}}>{r.free||isPd?<button style={{...T.btn,...T.btnSm}}>📥 Download</button>:<button style={{...T.btnO,...T.btnSm,color:T.gold,borderColor:T.gold}}>🔒 Premium</button>}</div>
            </div>
          </div>)}
        </div>
        {!isPd&&<div style={{...T.card,textAlign:"center",marginTop:18,borderLeft:"3px solid "+T.gold,padding:28}}><h4 style={{color:T.teal,fontSize:"1.1rem",fontWeight:700}}>🔓 Unlock all premium resources</h4><p style={{color:T.txt2,fontSize:".9rem",margin:"8px 0 16px"}}>Get access to premium PDFs, atlases & clinical guides</p><button style={T.btnGold}>Upgrade to Premium — ₹999/month</button></div>}
      </div>}

      {pg==="videos"&&!selV&&<div>
        <h3 style={{fontSize:"1.15rem",fontWeight:700,color:T.txt,marginBottom:4}}>🎥 Video gallery & webinars</h3>
        <p style={{color:T.txt2,fontSize:".88rem",marginBottom:16}}>Expert-led masterclasses and live procedure demos</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
          {vids.map(v=><div key={v.id} onClick={()=>setSelV(v)} style={{...T.card,cursor:"pointer",marginBottom:0}}>
            <div style={{height:110,borderRadius:10,background:"linear-gradient(135deg,#e1f5ee,#d0ede5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2.5rem",marginBottom:12,position:"relative"}}>{v.ic}{!v.free&&!isPd&&<div style={{position:"absolute",top:8,right:8,...T.tag(T.goldBg,T.goldD)}}>🔒 Premium</div>}<div style={{position:"absolute",bottom:8,right:8,fontSize:".68rem",background:"rgba(0,0,0,.6)",padding:"3px 8px",borderRadius:6,color:"#fff"}}>{v.dur}</div></div>
            <span style={T.tag(T.tealBg,T.teal)}>{v.cat}</span>
            <h4 style={{fontSize:".92rem",fontWeight:600,marginTop:8,lineHeight:1.35,color:T.txt}}>{v.t}</h4>
          </div>)}
        </div>
        {!isPd&&<div style={{...T.card,textAlign:"center",marginTop:18,borderLeft:"3px solid "+T.gold,padding:28}}><h4 style={{color:T.teal,fontSize:"1.1rem",fontWeight:700}}>🎓 Access all masterclasses</h4><p style={{color:T.txt2,fontSize:".9rem",margin:"8px 0 16px"}}>Full video library + future webinar recordings</p><button style={T.btnGold}>Upgrade to Premium — ₹999/month</button></div>}
      </div>}
      {pg==="videos"&&selV&&<div>
        <button onClick={()=>setSelV(null)} style={{...T.btnO,...T.btnSm,marginBottom:14}}>← Back</button>
        <div style={{...T.card,maxWidth:720}}><div style={{height:240,borderRadius:12,background:"linear-gradient(135deg,#e1f5ee,#c8ebe0)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>{selV.free||isPd?<div style={{textAlign:"center"}}><div style={{fontSize:"3.5rem"}}>▶️</div><p style={{color:T.teal,fontSize:".9rem",marginTop:8}}>Video player — connect hosting</p></div>:<div style={{textAlign:"center"}}><div style={{fontSize:"2rem"}}>🔒</div><p style={{color:T.teal,fontSize:"1rem",fontWeight:600,marginTop:8}}>Premium content</p><button style={{...T.btnGold,marginTop:12}}>Unlock — ₹999/month</button></div>}</div>
          <span style={T.tag(T.tealBg,T.teal)}>{selV.cat}</span><h3 style={{color:T.txt,fontSize:"1.3rem",fontWeight:700,marginTop:10}}>{selV.t}</h3><p style={{fontSize:".82rem",color:T.mute,marginTop:5}}>Dr. J Patil · {selV.dur}</p><p style={{fontSize:".95rem",color:T.txt2,marginTop:16,lineHeight:1.8}}>{selV.desc}</p></div>
      </div>}

      {pg==="forum"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div><h3 style={{fontSize:"1.15rem",fontWeight:700,color:T.txt}}>💬 Discussion forum</h3><p style={{color:T.mute,fontSize:".82rem",marginTop:2}}>Ask questions, share cases, learn together</p></div>
          <button onClick={()=>setNewP(!newP)} style={T.btn}>{newP?"Cancel":"+ New post"}</button>
        </div>
        {newP&&<div style={{...T.card,borderLeft:"3px solid "+T.teal}}>
          <input value={fpT} onChange={e=>setFpT(e.target.value)} placeholder="Post title..." style={{...T.inp,marginBottom:10}}/>
          <select value={fpC} onChange={e=>setFpC(e.target.value)} style={{...T.inp,marginBottom:10}}>{TOPICS.map(t=><option key={t} value={t}>{t}</option>)}</select>
          <textarea value={fpB} onChange={e=>setFpB(e.target.value)} placeholder="Share your case, question, or insight..." rows={3} style={{...T.inp,marginBottom:10,resize:"vertical"}}/>
          <button onClick={()=>{if(!fpT.trim())return;setForum(p=>[{id:"f"+Date.now(),author:uName,ini:uIni,title:fpT,cat:fpC,rep:0,lik:0,time:"Just now",body:fpB},...p]);setFpT("");setFpB("");setNewP(false);sh("Posted!")}} style={T.btn}>Publish post</button>
        </div>}
        {forum.map(p=><div key={p.id} style={T.card}>
          <div style={{display:"flex",gap:12}}>
            <div style={T.av(36,T.tealBg,T.teal)}>{p.ini}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><b style={{fontSize:".88rem",color:T.txt}}>{p.author}</b><span style={{fontSize:".68rem",color:T.mute}}>{p.time}</span></div>
              <span style={{...T.tag(T.tealBg,T.teal),marginTop:5}}>{p.cat}</span>
              <h4 style={{fontSize:"1rem",fontWeight:600,marginTop:8,lineHeight:1.4,color:T.txt}}>{p.title}</h4>
              <p style={{fontSize:".9rem",color:T.txt2,marginTop:6,lineHeight:1.65}}>{p.body}</p>
              <div style={{display:"flex",gap:18,marginTop:10,fontSize:".78rem",color:T.mute}}>❤️ {p.lik} likes · 💬 {p.rep} replies</div>
            </div>
          </div>
        </div>)}
      </div>}

      {pg==="rank"&&<div style={{...T.card,maxWidth:640}}>
        <h3 style={{fontSize:"1.15rem",fontWeight:700,color:T.txt,marginBottom:14}}>🏆 Leaderboard</h3>
        {[{n:"Dr. Meera Patel",cl:"SkinGlow, Mumbai",sc:92,str:15,i:"MP"},{n:"Dr. Arjun Reddy",cl:"Radiance, Hyderabad",sc:88,str:12,i:"AR"},{n:uName,cl:profile?.clinic||"—",sc:acc,str:totA,i:uIni,me:true,ph:uPhoto},{n:"Dr. Sneha Kulkarni",cl:"Aura, Pune",sc:78,str:8,i:"SK"},{n:"Dr. Vikram Singh",cl:"DermaCare, Delhi",sc:72,str:6,i:"VS"}].sort((a,b)=>b.sc-a.sc).map((u,i)=>
          <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px",borderRadius:12,marginBottom:6,background:u.me?T.tealBg:"#fff",border:`1px solid ${u.me?T.teal:T.border}`}}>
            <div style={{width:28,textAlign:"center",fontWeight:700,fontSize:".95rem",color:i<3?["#FFD700","#888","#CD7F32"][i]:T.txt}}>{i<3?["🥇","🥈","🥉"][i]:i+1}</div>
            {u.ph?<img src={u.ph} style={{width:38,height:38,borderRadius:"50%",border:"2px solid "+(u.me?T.teal:T.border)}}/>:<div style={T.av(38,u.me?T.teal:T.tealBg,u.me?"#fff":T.teal)}>{u.i}</div>}
            <div style={{flex:1}}><div style={{fontWeight:600,fontSize:".9rem",color:T.txt}}>{u.n}{u.me?" (You)":""}</div><div style={{fontSize:".72rem",color:T.mute}}>{u.cl}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:700,color:T.teal,fontSize:"1rem"}}>{u.sc}%</div><div style={{fontSize:".68rem",color:T.mute}}>🔥 {u.str}d</div></div>
          </div>)}
      </div>}

      {pg==="me"&&<div style={{maxWidth:640}}>
        <div style={{...T.card,textAlign:"center",padding:28}}>
          {uPhoto?<img src={uPhoto} style={{width:76,height:76,borderRadius:"50%",border:"3px solid "+T.teal,display:"block",margin:"0 auto 12px"}}/>:<div style={{...T.av(76,T.tealBg,T.teal),border:"3px solid "+T.teal,margin:"0 auto 12px",fontSize:"1.6rem"}}>{uIni}</div>}
          <div style={{fontSize:"1.4rem",fontWeight:700,color:T.txt}}>{uName}</div>
          <div style={{color:T.txt2,fontSize:".88rem",marginTop:3}}>{profile?.degree}</div>
          <div style={{color:T.mute,fontSize:".8rem",marginTop:2}}>{authUser?.email}</div>
          {isPd&&<div style={{...T.tag(T.goldBg,T.goldD),marginTop:10}}>⭐ Premium Member</div>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,margin:"14px 0"}}>
          {[["Quizzes",totA],["Accuracy",acc+"%"],["Rank","#3"]].map(([l,v])=><div key={l} style={{...T.card,textAlign:"center",padding:"14px 8px",marginBottom:0}}><div style={{fontSize:"1.4rem",fontWeight:700,color:T.teal}}>{v}</div><div style={{fontSize:".62rem",color:T.mute,textTransform:"uppercase",letterSpacing:.5,marginTop:3}}>{l}</div></div>)}
        </div>
        <div style={T.card}>
          {[["Email",authUser?.email],["Clinic",profile?.clinic],["Address",profile?.address],["Member since",profile?.joined?fD(profile.joined):"—"]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid "+T.border,fontSize:".88rem"}}><span style={{color:T.mute}}>{l}</span><span style={{fontWeight:500,color:T.txt}}>{v||"—"}</span></div>)}
          <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}>
            {!isPd&&<button onClick={()=>{const p={...profile,paid:true};setProfile(p);localStorage.setItem("cmx_p_"+authUser.uid,JSON.stringify(p));sh("⭐ Premium!")}} style={T.btnGold}>⭐ Go Premium</button>}
            <button onClick={doLogout} style={{...T.btnO,color:T.err,borderColor:"#f0c0c0"}}>Sign out</button>
          </div>
        </div>
      </div>}

      {pg==="admin"&&isAdm&&<div style={T.card}>
        <h3 style={{fontSize:"1.15rem",fontWeight:700,color:T.txt,marginBottom:12}}>⚙️ Admin dashboard</h3>
        <div style={{display:"flex",gap:5,marginBottom:16}}>
          {[["stats","📊 Overview"],["quiz","🧠 Quiz"],["users","👥 Users"]].map(([id,l])=><button key={id} onClick={()=>setATab(id)} style={{padding:"8px 16px",borderRadius:10,border:`1.5px solid ${aTab===id?T.teal:T.border}`,background:aTab===id?T.tealBg:"#fff",color:aTab===id?T.teal:T.mute,cursor:"pointer",fontSize:".82rem",fontWeight:aTab===id?600:400,fontFamily:"inherit"}}>{l}</button>)}
        </div>
        {aTab==="stats"&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>{[["Articles",arts.length],["Resources",res.length],["Videos",vids.length],["Forum",forum.length],["Quizzes",quiz.length],["Users","1+"]].map(([l,v])=><div key={l} style={{textAlign:"center",padding:14,background:T.bg,borderRadius:10}}><div style={{fontSize:"1.4rem",fontWeight:700,color:T.teal}}>{v}</div><div style={{fontSize:".62rem",color:T.mute,textTransform:"uppercase"}}>{l}</div></div>)}</div>}
        {aTab==="quiz"&&<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{color:T.mute,fontSize:".85rem"}}>{quiz.length} questions</span>
            <button onClick={genQ} style={T.btn}>🤖 Generate today</button>
          </div>
          {quiz.length===0&&<p style={{color:T.mute,fontSize:".88rem",textAlign:"center",padding:20}}>No questions yet. Click Generate to create the first one!</p>}
          {quiz.map(q=><div key={q.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border}}>
            <div><div style={{fontWeight:500,fontSize:".9rem",color:T.txt}}>{q.cat}</div><div style={{fontSize:".72rem",color:T.mute}}>{fD(q.date)} · {q.diff}</div></div>
            <button onClick={()=>{setSelD(q.date);go("quiz")}} style={{...T.btnO,...T.btnSm}}>View</button>
          </div>)}
        </div>}
        {aTab==="users"&&<div>
          <p style={{color:T.txt2,fontSize:".9rem",marginBottom:10}}>Admin accounts:</p>
          {ADMINS.map(e=><div key={e} style={{fontSize:".88rem",color:T.teal,padding:"5px 0",fontWeight:500}}>✓ {e}</div>)}
        </div>}
      </div>}

      <div style={{textAlign:"center",padding:"22px 0",borderTop:"1px solid "+T.border,marginTop:20}}>
        <div style={{fontSize:".65rem",color:T.light,letterSpacing:1.5,textTransform:"uppercase"}}>Powered by <span style={{color:T.gold,fontWeight:600}}>ABSOLUTE INSTITUTE</span></div>
        <div style={{fontSize:".55rem",color:T.light,marginTop:4}}>Slimming · Skin · Hair · Laser Clinic</div>
      </div>

      </div>
      {toast&&<div style={{position:"fixed",bottom:22,left:"50%",transform:"translateX(-50%)",padding:"11px 28px",background:T.teal,color:"#fff",borderRadius:12,fontSize:".9rem",zIndex:1000,boxShadow:"0 4px 20px rgba(13,107,110,.25)"}}>{toast}</div>}
    </div>);
}
