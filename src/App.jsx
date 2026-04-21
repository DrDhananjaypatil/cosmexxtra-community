import { useState, useEffect, useCallback, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig={apiKey:"AIzaSyAzW8kouNGmK11tLIDftwlg5QEtffecYEM",authDomain:"skinario-369.firebaseapp.com",projectId:"skinario-369",storageBucket:"skinario-369.firebasestorage.app",messagingSenderId:"647411585151",appId:"1:647411585151:web:210827226e649d96b42f4a"};
const fbApp=initializeApp(firebaseConfig);const auth=getAuth(fbApp);const db=getFirestore(fbApp);const gProv=new GoogleAuthProvider();
const storage=getStorage(fbApp);
const ADMINS=["drjpatil@gmail.com","absoluteinstituteedu@gmail.com"];
const TOPICS=["Skin Disorders","Chemical Peels","Botox & Fillers","Laser Treatments","Hair Restoration","Body Contouring","Ethics","Patient Safety"];
const getIST=()=>new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
const ds=d=>d.toISOString().split("T")[0];
const fD=s=>{try{return new Date(s+"T12:00:00").toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}catch{return s}};
const dN=s=>{try{return new Date(s+"T12:00:00").toLocaleDateString("en-IN",{weekday:"short"})}catch{return""}};

const BRAND={name:"SKINARIO",tagline:"Professional Dermatology & Aesthetic Community",sub:"By Absolute Institute",logo:"/skinario-logo.jpg"};

const T={bg:"#f8f7f4",white:"#fff",teal:"#0d6b6e",tealL:"#1ab5a5",tealBg:"#e1f5ee",gold:"#c8a84e",goldBg:"#fdf6e3",goldD:"#a08030",txt:"#1a1a1a",txt2:"#555",mute:"#999",light:"#bbb",border:"#e8e6e0",ok:"#1a7d42",okBg:"#e1f9ec",err:"#c0392b",errBg:"#fde8e8",warn:"#854f0b",warnBg:"#fef3e2",
  card:{background:"#fff",border:"1px solid #e8e6e0",borderRadius:14,padding:20,marginBottom:14},
  btn:{padding:"10px 22px",background:"#0d6b6e",color:"#fff",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:".88rem",fontFamily:"inherit"},
  btnO:{padding:"10px 22px",background:"#fff",color:"#0d6b6e",border:"1px solid #0d6b6e",borderRadius:10,fontWeight:500,cursor:"pointer",fontSize:".88rem",fontFamily:"inherit"},
  btnSm:{padding:"6px 14px",fontSize:".78rem",borderRadius:8},
  btnGold:{padding:"10px 22px",background:"linear-gradient(135deg,#c8a84e,#a08030)",color:"#fff",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:".88rem",fontFamily:"inherit"},
  btnDanger:{padding:"6px 14px",background:"#fde8e8",color:"#c0392b",border:"1px solid #f0c0c0",borderRadius:8,cursor:"pointer",fontSize:".75rem",fontFamily:"inherit"},
  inp:{width:"100%",padding:"11px 14px",background:"#fff",border:"1px solid #e8e6e0",borderRadius:10,color:"#1a1a1a",fontSize:".9rem",fontFamily:"inherit",boxSizing:"border-box"},
  txa:{width:"100%",padding:"11px 14px",background:"#fff",border:"1px solid #e8e6e0",borderRadius:10,color:"#1a1a1a",fontSize:".9rem",fontFamily:"inherit",boxSizing:"border-box",resize:"vertical",minHeight:80},
  tag:(bg,cl)=>({fontSize:".7rem",padding:"3px 10px",borderRadius:16,fontWeight:500,background:bg,color:cl,display:"inline-block"}),
  av:(sz,bg,cl)=>({width:sz,height:sz,minWidth:sz,borderRadius:"50%",background:bg||"#e1f5ee",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:cl||"#0d6b6e",fontSize:sz*.3})};

const Logo=({size})=><img src={BRAND.logo} alt="SKINARIO" style={{height:size,width:"auto",objectFit:"contain"}}/>;

// ═══ LIKE BUTTON COMPONENT ═══
const LikeBtn=({liked,count,onToggle})=>(
  <button onClick={onToggle} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:16,border:`1px solid ${liked?T.teal:T.border}`,background:liked?T.tealBg:"#fff",color:liked?T.teal:T.mute,cursor:"pointer",fontSize:".75rem",fontFamily:"inherit",fontWeight:liked?600:400}}>
    {liked?"❤️":"🤍"} {count||0}
  </button>
);

// ═══ IMAGE UPLOAD COMPONENT ═══
const ImgUpload=({images,setImages,uploading,setUploading})=>{
  const fileRef=useRef();
  const handleFile=async(e)=>{
    const files=Array.from(e.target.files);if(!files.length)return;
    setUploading(true);
    const urls=[];
    for(const f of files.slice(0,4)){
      try{
        const path=`images/${Date.now()}_${f.name}`;
        const sRef=ref(storage,path);
        await uploadBytes(sRef,f);
        const url=await getDownloadURL(sRef);
        urls.push(url);
      }catch(err){console.error("Upload error:",err)}
    }
    setImages(p=>[...p,...urls]);setUploading(false);
    if(fileRef.current)fileRef.current.value="";
  };
  return(<div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:images.length?8:0}}>
      {images.map((url,i)=><div key={i} style={{position:"relative",width:80,height:80,borderRadius:8,overflow:"hidden",border:"1px solid "+T.border}}>
        <img src={url} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        <button onClick={()=>setImages(p=>p.filter((_,j)=>j!==i))} style={{position:"absolute",top:2,right:2,width:18,height:18,borderRadius:"50%",background:"rgba(0,0,0,.6)",color:"#fff",border:"none",fontSize:".6rem",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
      </div>)}
    </div>
    <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFile} style={{display:"none"}} id="img-up"/>
    <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{...T.btnO,...T.btnSm,opacity:uploading?.5:1}}>{uploading?"⏳ Uploading...":"📷 Add images (max 4)"}</button>
  </div>)
};

// ═══ IMAGE GALLERY ═══
const ImgGallery=({images})=>{
  const[big,setBig]=useState(null);
  if(!images?.length)return null;
  return(<>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
      {images.map((url,i)=><img key={i} src={url} onClick={()=>setBig(url)} style={{width:120,height:90,objectFit:"cover",borderRadius:8,cursor:"pointer",border:"1px solid "+T.border}}/>)}
    </div>
    {big&&<div onClick={()=>setBig(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out",padding:20}}>
      <img src={big} style={{maxWidth:"90%",maxHeight:"90%",borderRadius:12}}/>
    </div>}
  </>)
};

// ═══ FIRESTORE ═══
const fbCol=n=>collection(db,n);
async function fbGetAll(c,ord="date",dir="desc",lim=100){try{const q=query(fbCol(c),orderBy(ord,dir),limit(lim));const s=await getDocs(q);return s.docs.map(d=>({id:d.id,...d.data()}))}catch(e){console.log("fb",c,e);return[]}}
async function fbAdd(c,data){try{const r=await addDoc(fbCol(c),{...data,createdAt:serverTimestamp()});return r.id}catch{return null}}
async function fbSet(c,id,data){try{await setDoc(doc(db,c,id),{...data,updatedAt:serverTimestamp()},{merge:true});return true}catch{return false}}
async function fbDel(c,id){try{await deleteDoc(doc(db,c,id));return true}catch{return false}}
async function fbGet(c,id){try{const s=await getDoc(doc(db,c,id));return s.exists()?{id:s.id,...s.data()}:null}catch{return null}}

async function genQuizAI(date){
  const tp=TOPICS[Math.floor(Math.random()*TOPICS.length)];const df=Math.random()>.5?"Advanced":"Moderate";
  try{const r=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:`Generate a clinical dermatology/aesthetic medicine quiz question as JSON.
Topic: ${tp}
Difficulty: ${df}
Rules:
- Create a realistic case scenario with patient age, gender, skin type, history
- Provide exactly 3 answer options, only 1 correct
- Keep all text short - scenario under 200 chars, each option under 100 chars, explanation under 300 chars
- Use straight quotes only, no special characters, no newlines within strings
- correctIndex is 0, 1, or 2
Return ONLY this JSON, nothing else:
{"category":"${tp}","difficulty":"${df}","scenario":"case here","question":"question here","options":["A","B","C"],"correctIndex":0,"explanation":"explanation here"}`})});
    const data=await r.json();if(data.error)throw new Error(JSON.stringify(data));
    let txt=data.text||"";txt=txt.replace(/```json\s*/g,"").replace(/```/g,"").trim();txt=txt.replace(/[\x00-\x1F]/g," ");
    const jsonMatch=txt.match(/\{[\s\S]*\}/);if(!jsonMatch)throw new Error("No JSON");
    const q=JSON.parse(jsonMatch[0]);if(!q.question||!q.options||q.options.length<3)throw new Error("Invalid");
    return{date,cat:q.category||tp,diff:q.difficulty||df,scen:q.scenario||"",question:q.question,opts:q.options.slice(0,3),ci:typeof q.correctIndex==="number"?q.correctIndex:0,expl:q.explanation||"",answers:{},comments:[]}
  }catch(e){console.error("Quiz gen error:",e);return null}}

export default function App(){
  const[au,setAu]=useState(null);const[prof,setProf]=useState(null);const[scr,setScr]=useState("loading");const[pg,setPg]=useState("home");
  const[quizzes,setQuizzes]=useState([]);const[articles,setArticles]=useState([]);const[resources,setResources]=useState([]);const[videos,setVideos]=useState([]);const[forumPosts,setForumPosts]=useState([]);const[cases,setCases]=useState([]);const[allUsers,setAllUsers]=useState([]);
  const[selD,setSelD]=useState(ds(getIST()));const[selA,setSelA]=useState(null);const[selV,setSelV]=useState(null);const[toast,setToast]=useState(null);const[cmt,setCmt]=useState("");const[ld,setLd]=useState(false);const[aTab,setATab]=useState("stats");
  const[authMode,setAuthMode]=useState("signin");const[authEmail,setAuthEmail]=useState("");const[authPass,setAuthPass]=useState("");const[authName,setAuthName]=useState("");const[authBusy,setAuthBusy]=useState(false);const[authErr,setAuthErr]=useState("");
  const[pf,setPf]=useState({degree:"",clinic:"",address:""});const[edForm,setEdForm]=useState(null);
  // Forum/Cases new post state
  const[newForum,setNewForum]=useState(false);const[fpT,setFpT]=useState("");const[fpB,setFpB]=useState("");const[fpC,setFpC]=useState(TOPICS[0]);const[fpImgs,setFpImgs]=useState([]);const[fpUp,setFpUp]=useState(false);
  const[newCase,setNewCase]=useState(false);const[ccT,setCcT]=useState("");const[ccB,setCcB]=useState("");const[ccC,setCcC]=useState(TOPICS[0]);const[ccImgs,setCcImgs]=useState([]);const[ccUp,setCcUp]=useState(false);const[ccDiag,setCcDiag]=useState("");

  const sh=m=>setToast(m);const go=p=>{setPg(p);setSelA(null);setSelV(null);setEdForm(null)};
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(null),3000);return()=>clearTimeout(t)}},[toast]);

  const loadData=useCallback(async()=>{const[q,a,r,v,f,cs,u]=await Promise.all([fbGetAll("quizzes","date","desc"),fbGetAll("articles","date","desc"),fbGetAll("resources","order","asc"),fbGetAll("videos","order","asc"),fbGetAll("forum","createdAt","desc"),fbGetAll("cases","createdAt","desc"),fbGetAll("users","joined","desc")]);setQuizzes(q);setArticles(a);setResources(r);setVideos(v);setForumPosts(f);setCases(cs);setAllUsers(u)},[]);

  useEffect(()=>{const unsub=onAuthStateChanged(auth,async u=>{if(u){setAu(u);let p=await fbGet("users",u.uid);if(!p){const l=localStorage.getItem("sk_p_"+u.uid);if(l)p=JSON.parse(l)}if(p){setProf(p);setScr("main");loadData()}else{setPf({degree:"",clinic:"",address:""});setScr("setup")}}else{setAu(null);setProf(null);setScr("login")}});return()=>unsub()},[loadData]);

  const isAdm=prof&&ADMINS.includes(au?.email);const isPd=prof?.paid;const today=ds(getIST());const hr=getIST().getHours();
  const uName=prof?.name||au?.displayName||"Doctor";const uIni=(uName.replace(/^Dr\.?\s*/i,"").split(" ").map(w=>w[0]).join("").toUpperCase()||"D").slice(0,2);const uPhoto=au?.photoURL;
  const myAns=quizzes.reduce((a,q)=>{if(q.answers?.[au?.uid]!==undefined)a.push({correct:q.answers[au.uid]===q.ci});return a},[]);
  const totA=myAns.length;const corr=myAns.filter(a=>a.correct).length;const acc=totA?Math.round(corr/totA*100):0;

  // ═══ AUTH ═══
  const doGoogleLogin=async()=>{setAuthErr("");try{await signInWithPopup(auth,gProv)}catch(e){if(e.code!=="auth/popup-closed-by-user")setAuthErr("Failed")}};
  const doEmailSignup=async()=>{setAuthErr("");if(!authName.trim())return setAuthErr("Enter name");if(!authEmail.trim())return setAuthErr("Enter email");if(authPass.length<6)return setAuthErr("6+ chars");setAuthBusy(true);try{const c=await createUserWithEmailAndPassword(auth,authEmail,authPass);await updateProfile(c.user,{displayName:authName})}catch(e){setAuthErr(e.code==="auth/email-already-in-use"?"Email registered":"Failed")}setAuthBusy(false)};
  const doEmailSignin=async()=>{setAuthErr("");if(!authEmail.trim())return setAuthErr("Enter email");if(!authPass)return setAuthErr("Enter password");setAuthBusy(true);try{await signInWithEmailAndPassword(auth,authEmail,authPass)}catch(e){setAuthErr(e.code==="auth/invalid-credential"?"Wrong email/password":"Failed")}setAuthBusy(false)};
  const doForgot=async()=>{setAuthErr("");if(!authEmail.trim())return setAuthErr("Enter email");setAuthBusy(true);try{await sendPasswordResetEmail(auth,authEmail);sh("📧 Reset sent!");setAuthMode("signin")}catch{setAuthErr("Failed")}setAuthBusy(false)};
  const doLogout=async()=>{if(confirm("Sign out?"))await signOut(auth)};
  const savePf=async()=>{if(!pf.degree){sh("Degree required");return}const p={name:au.displayName||authName||"Doctor",email:au.email,photo:au.photoURL||"",degree:pf.degree,clinic:pf.clinic,address:pf.address,paid:false,joined:ds(getIST()),initials:uIni,totalCorrect:0,totalAnswered:0,streak:0};await fbSet("users",au.uid,p);localStorage.setItem("sk_p_"+au.uid,JSON.stringify(p));setProf(p);setScr("main");sh("Welcome to SKINARIO!");loadData()};

  // ═══ LIKE TOGGLE (works for any collection) ═══
  const toggleLike=async(colName,id,item,stateUpdater)=>{
    const likedBy=item.likedBy||[];const hasLiked=likedBy.includes(au.uid);
    const newLikedBy=hasLiked?likedBy.filter(u=>u!==au.uid):[...likedBy,au.uid];
    await fbSet(colName,id,{likedBy:newLikedBy,likes:newLikedBy.length});
    stateUpdater(p=>p.map(x=>x.id===id?{...x,likedBy:newLikedBy,likes:newLikedBy.length}:x));
  };

  // ═══ QUIZ COMMENT LIKE ═══
  const toggleCommentLike=async(quizId,qObj,cmtIdx)=>{
    const comments=[...(qObj.comments||[])];const c=comments[cmtIdx];
    const likedBy=c.likedBy||[];const hasLiked=likedBy.includes(au.uid);
    c.likedBy=hasLiked?likedBy.filter(u=>u!==au.uid):[...likedBy,au.uid];
    c.likes=(c.likedBy||[]).length;
    comments[cmtIdx]=c;
    await fbSet("quizzes",quizId,{comments});
    setQuizzes(p=>p.map(q=>q.id===quizId?{...q,comments}:q));
  };

  // ═══ QUIZ ═══
  const submitAnswer=async(qid,qObj,idx)=>{if(!au)return;const ok=idx===qObj.ci;const answers={...(qObj.answers||{}),[au.uid]:idx};await fbSet("quizzes",qid,{answers});const upd={totalAnswered:(prof.totalAnswered||0)+1,totalCorrect:(prof.totalCorrect||0)+(ok?1:0),streak:ok?(prof.streak||0)+1:0};await fbSet("users",au.uid,upd);setProf(p=>({...p,...upd}));setQuizzes(p=>p.map(q=>q.id===qid?{...q,answers}:q));sh(ok?"🎉 Correct!":"Answer recorded.")};
  const addComment=async(qid,qObj)=>{if(!cmt.trim())return;const c={n:uName,ini:uIni,txt:cmt,tm:getIST().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true}),uid:au.uid,likedBy:[],likes:0};const comments=[...(qObj.comments||[]),c];await fbSet("quizzes",qid,{comments});setQuizzes(p=>p.map(q=>q.id===qid?{...q,comments}:q));setCmt("")};
  const genQuiz=async()=>{if(quizzes.find(q=>q.date===today)){sh("Already exists!");return}setLd(true);const q=await genQuizAI(today);if(q){const id=await fbAdd("quizzes",q);if(id){setQuizzes(p=>[{id,...q},...p]);sh("Question live!")}}else sh("Failed");setLd(false)};

  // ═══ CONTENT ═══
  const saveContent=async(type)=>{const d=edForm.data;if(!d.title){sh("Title required");return}if(edForm.editing){await fbSet(type,d.id,d);sh("Updated!")}else{await fbAdd(type,{...d,order:Date.now()});sh("Created!")}setEdForm(null);loadData()};
  const deleteContent=async(type,id,name)=>{if(!confirm(`Delete "${name}"?`))return;await fbDel(type,id);sh("Deleted");loadData()};

  // ═══ FORUM POST ═══
  const postForum=async()=>{if(!fpT.trim())return;await fbAdd("forum",{author:uName,ini:uIni,uid:au.uid,photo:uPhoto||"",title:fpT,cat:fpC,body:fpB,images:fpImgs,likedBy:[],likes:0,replies:0,date:ds(getIST())});setFpT("");setFpB("");setFpImgs([]);setNewForum(false);sh("Posted!");loadData()};

  // ═══ CLINICAL CASE POST ═══
  const postCase=async()=>{if(!ccT.trim()){sh("Title required");return}if(!ccImgs.length){sh("Add at least 1 image");return}await fbAdd("cases",{author:uName,ini:uIni,uid:au.uid,photo:uPhoto||"",title:ccT,cat:ccC,body:ccB,diagnosis:ccDiag,images:ccImgs,likedBy:[],likes:0,comments:[],date:ds(getIST())});setCcT("");setCcB("");setCcImgs([]);setCcDiag("");setNewCase(false);sh("Case posted!");loadData()};

  // ═══ CASE COMMENT ═══
  const addCaseComment=async(caseId,caseObj,txt)=>{if(!txt.trim())return;const c={n:uName,ini:uIni,txt,tm:getIST().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true}),uid:au.uid,likedBy:[],likes:0};const comments=[...(caseObj.comments||[]),c];await fbSet("cases",caseId,{comments});setCases(p=>p.map(x=>x.id===caseId?{...x,comments}:x))};

  const leaderboard=allUsers.filter(u=>u.totalAnswered>0).sort((a,b)=>{const aA=a.totalAnswered?Math.round(a.totalCorrect/a.totalAnswered*100):0;const bA=b.totalAnswered?Math.round(b.totalCorrect/b.totalAnswered*100):0;return bA-aA||(b.streak||0)-(a.streak||0)}).slice(0,20);

  const W="1100px";const dates=Array.from({length:14},(_,i)=>{let d=new Date(getIST());d.setDate(d.getDate()-(13-i));return ds(d)});
  const qObj=quizzes.find(q=>q.date===selD);const uA=qObj?.answers?.[au?.uid];const isT=selD===today;const rev=!isT||hr>=21;const dd=Math.floor((new Date(today)-new Date(selD))/864e5);const canA=uA===undefined&&(isT||(dd<=3&&dd>0));

  if(scr==="loading")return(<div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui"}}><div style={{textAlign:"center"}}><Logo size={60}/><p style={{color:T.mute,marginTop:12}}>Loading...</p></div></div>);

  if(scr==="login")return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#f8f7f4,#fdf6e3 40%,#e1f5ee 70%,#f8f7f4)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"system-ui"}}>
      <Logo size={100}/><h1 style={{fontSize:"2.8rem",fontWeight:300,color:T.txt,marginTop:8,letterSpacing:6,fontFamily:"Georgia,serif"}}>SKINARIO</h1>
      <p style={{fontSize:".72rem",color:T.gold,letterSpacing:4,textTransform:"uppercase",margin:"6px 0 10px",fontWeight:600}}>{BRAND.tagline}</p>
      <p style={{color:T.txt2,fontSize:".92rem",textAlign:"center",maxWidth:440,lineHeight:1.7,marginBottom:28}}>Daily clinical quizzes, expert articles, resources, video masterclasses & a vibrant community of aesthetic medicine professionals.</p>
      <div style={{...T.card,width:"100%",maxWidth:400,padding:24}}>
        <h2 style={{color:T.txt,fontSize:"1.05rem",fontWeight:700,textAlign:"center",marginBottom:4}}>{authMode==="signin"?"Welcome back":authMode==="signup"?"Join SKINARIO":"Reset password"}</h2>
        <p style={{color:T.mute,fontSize:".78rem",textAlign:"center",marginBottom:16}}>{authMode==="signin"?"Sign in to continue":authMode==="signup"?"Create your account":"We'll send a reset link"}</p>
        {authMode!=="forgot"&&<><button onClick={doGoogleLogin} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,background:"#fff",color:"#333",border:"1px solid #ddd",padding:"11px",borderRadius:10,fontSize:".9rem",fontWeight:500,cursor:"pointer",width:"100%",fontFamily:"inherit"}}><svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Continue with Google</button>
        <div style={{display:"flex",alignItems:"center",gap:10,margin:"14px 0",color:T.mute,fontSize:".75rem"}}><div style={{flex:1,height:1,background:T.border}}/>or<div style={{flex:1,height:1,background:T.border}}/></div></>}
        {authMode==="signup"&&<input value={authName} onChange={e=>setAuthName(e.target.value)} placeholder="Full name (Dr. ...)" style={{...T.inp,marginBottom:10}}/>}
        <input value={authEmail} onChange={e=>setAuthEmail(e.target.value)} type="email" placeholder="Email address" style={{...T.inp,marginBottom:10}}/>
        {authMode!=="forgot"&&<input value={authPass} onChange={e=>setAuthPass(e.target.value)} type="password" placeholder="Password (6+ chars)" style={{...T.inp,marginBottom:10}} onKeyDown={e=>e.key==="Enter"&&(authMode==="signin"?doEmailSignin():doEmailSignup())}/>}
        {authErr&&<div style={{background:T.errBg,color:T.err,padding:"8px 12px",borderRadius:8,fontSize:".8rem",marginBottom:10}}>⚠ {authErr}</div>}
        <button onClick={authMode==="signin"?doEmailSignin:authMode==="signup"?doEmailSignup:doForgot} disabled={authBusy} style={{...T.btn,width:"100%",opacity:authBusy?.6:1}}>{authBusy?"Please wait...":authMode==="signin"?"Sign in":authMode==="signup"?"Create account":"Send reset email"}</button>
        <div style={{marginTop:12,textAlign:"center",fontSize:".8rem"}}>
          {authMode==="signin"&&<><span style={{color:T.mute}}>New here? </span><span onClick={()=>{setAuthMode("signup");setAuthErr("")}} style={{color:T.teal,cursor:"pointer",fontWeight:600}}>Create account</span><div style={{marginTop:5}}><span onClick={()=>{setAuthMode("forgot");setAuthErr("")}} style={{color:T.mute,cursor:"pointer",fontSize:".75rem"}}>Forgot password?</span></div></>}
          {authMode==="signup"&&<><span style={{color:T.mute}}>Have an account? </span><span onClick={()=>{setAuthMode("signin");setAuthErr("")}} style={{color:T.teal,cursor:"pointer",fontWeight:600}}>Sign in</span></>}
          {authMode==="forgot"&&<span onClick={()=>{setAuthMode("signin");setAuthErr("")}} style={{color:T.teal,cursor:"pointer",fontWeight:600}}>← Back to sign in</span>}
        </div>
      </div>
      <p style={{marginTop:20,fontSize:".6rem",color:T.light,letterSpacing:2,textTransform:"uppercase"}}>{BRAND.sub}</p>
    </div>);

  if(scr==="setup")return(
    <div style={{minHeight:"100vh",background:T.bg,padding:24,fontFamily:"system-ui",color:T.txt}}>
      <div style={{maxWidth:520,margin:"0 auto"}}><div style={{...T.card,borderLeft:"3px solid "+T.gold}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
          {uPhoto?<img src={uPhoto} style={{width:50,height:50,borderRadius:"50%",border:"2px solid "+T.teal}}/>:<div style={T.av(50,T.tealBg,T.teal)}>{uIni}</div>}
          <div><div style={{fontWeight:700,fontSize:"1.1rem"}}>{au?.displayName||authName||"Doctor"}</div><div style={{fontSize:".8rem",color:T.mute}}>{au?.email}</div></div>
        </div>
        <h2 style={{color:T.teal,fontSize:"1.15rem",fontWeight:700,marginBottom:16}}>Complete your profile</h2>
        {[["degree","Degree / Qualification *"],["clinic","Clinic Name"],["address","City, State"]].map(([k,l])=>
          <div key={k} style={{marginBottom:14}}><label style={{display:"block",fontSize:".78rem",color:T.teal,marginBottom:5,fontWeight:500}}>{l}</label><input value={pf[k]} onChange={e=>setPf(p=>({...p,[k]:e.target.value}))} placeholder={l.replace(" *","")} style={T.inp}/></div>)}
        <button onClick={savePf} style={{...T.btn,width:"100%",marginTop:8}}>Save & enter SKINARIO →</button>
      </div></div></div>);

  // ═══ MAIN NAV — added "Cases" section ═══
  const navs=[{id:"home",ic:"🏠",l:"Home"},{id:"quiz",ic:"🧠",l:"Quiz"},{id:"library",ic:"📚",l:"Library"},{id:"videos",ic:"🎥",l:"Videos"},{id:"cases",ic:"🔬",l:"Cases"},{id:"forum",ic:"💬",l:"Forum"},{id:"rank",ic:"🏆",l:"Rank"},{id:"me",ic:"👤",l:"Me"},...(isAdm?[{id:"admin",ic:"⚙️",l:"Admin"}]:[])];

  const AdminForm=({type,fields,onSave})=>{const d=edForm?.data||{};const set=(k,v)=>setEdForm(p=>({...p,data:{...p.data,[k]:v}}));
    return(<div style={{...T.card,borderLeft:"3px solid "+T.teal}}>
      <h4 style={{color:T.teal,fontWeight:700,marginBottom:12}}>{edForm?.editing?"Edit":"New"} {type}</h4>
      {fields.map(([k,l,tp])=><div key={k} style={{marginBottom:10}}><label style={{display:"block",fontSize:".75rem",color:T.teal,marginBottom:4}}>{l}</label>
        {tp==="textarea"?<textarea value={d[k]||""} onChange={e=>set(k,e.target.value)} style={T.txa}/>
        :tp==="select"?<select value={d[k]||""} onChange={e=>set(k,e.target.value)} style={T.inp}>{TOPICS.map(t=><option key={t} value={t}>{t}</option>)}<option value="General">General</option></select>
        :tp==="check"?<label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}><input type="checkbox" checked={!!d[k]} onChange={e=>set(k,e.target.checked)}/> {l}</label>
        :<input value={d[k]||""} onChange={e=>set(k,e.target.value)} style={T.inp}/>}</div>)}
      <div style={{display:"flex",gap:8}}><button onClick={onSave} style={T.btn}>{edForm?.editing?"Update":"Create"}</button><button onClick={()=>setEdForm(null)} style={T.btnO}>Cancel</button></div>
    </div>)};

  // ═══ CASE COMMENT INPUT (local state per case) ═══
  const CaseCmtInput=({caseId,caseObj})=>{const[txt,setTxt]=useState("");return(
    <div style={{display:"flex",gap:6,marginTop:10}}><input value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){addCaseComment(caseId,caseObj,txt);setTxt("")}}} placeholder="Your thoughts..." style={{...T.inp,borderRadius:20,padding:"9px 14px",fontSize:".82rem",flex:1}}/><button onClick={()=>{addCaseComment(caseId,caseObj,txt);setTxt("")}} style={{...T.btn,...T.btnSm}}>Post</button></div>
  )};

  return(
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"system-ui",color:T.txt}}>
      <div style={{position:"sticky",top:0,zIndex:100,background:"#ffffffee",backdropFilter:"blur(16px)",borderBottom:"1px solid "+T.border,padding:"6px 24px"}}>
        <div style={{maxWidth:W,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>go("home")}>
            <Logo size={36}/><div style={{fontSize:"1.15rem",fontWeight:300,color:T.txt,letterSpacing:4,fontFamily:"Georgia,serif"}}>SKINARIO</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:1}}>
            {navs.map(n=><button key={n.id} onClick={()=>go(n.id)} style={{background:pg===n.id?T.tealBg:"none",border:"none",color:pg===n.id?T.teal:T.mute,padding:"5px 9px",borderRadius:9,cursor:"pointer",fontSize:".6rem",fontFamily:"inherit",fontWeight:pg===n.id?600:400,display:"flex",flexDirection:"column",alignItems:"center",gap:1,minWidth:40}}><span style={{fontSize:".85rem"}}>{n.ic}</span>{n.l}</button>)}
            {uPhoto?<img src={uPhoto} onClick={()=>go("me")} style={{width:30,height:30,borderRadius:"50%",border:"2px solid "+T.tealBg,marginLeft:6,cursor:"pointer"}}/>:<div onClick={()=>go("me")} style={{...T.av(30,T.tealBg,T.teal),marginLeft:6,cursor:"pointer"}}>{uIni}</div>}
          </div>
        </div>
      </div>

      <div style={{maxWidth:W,margin:"0 auto",padding:"18px 24px"}}>

      {/* HOME */}
      {pg==="home"&&!selA&&<div>
        <div style={{...T.card,borderLeft:"3px solid "+T.gold,padding:24}}><div style={{display:"flex",alignItems:"center",gap:16,marginBottom:14}}>{uPhoto?<img src={uPhoto} style={{width:52,height:52,borderRadius:"50%",border:"2px solid "+T.teal}}/>:<div style={T.av(52,T.tealBg,T.teal)}>{uIni}</div>}<div><h2 style={{fontSize:"1.4rem",fontWeight:700,margin:0}}>Welcome, {uName.split(" ")[0]} 👋</h2><p style={{color:T.txt2,fontSize:".9rem",marginTop:3}}>Daily quizzes, clinical cases & community.</p></div></div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button onClick={()=>go("quiz")} style={T.btn}>🧠 Today's quiz</button><button onClick={()=>go("cases")} style={T.btnO}>🔬 Clinical cases</button><button onClick={()=>go("forum")} style={T.btnO}>💬 Forum</button></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,margin:"16px 0"}}>
          {[["🧠",totA,"Quizzes"],["✅",acc+"%","Accuracy"],["🔬",cases.length,"Cases"],["📚",resources.length,"PDFs"],["🎥",videos.length,"Videos"]].map(([i,v,l])=>
            <div key={l} style={{...T.card,textAlign:"center",padding:"12px 4px",marginBottom:0}}><div style={{fontSize:"1rem"}}>{i}</div><div style={{fontSize:"1.2rem",fontWeight:700,color:T.teal}}>{v}</div><div style={{fontSize:".55rem",color:T.mute,textTransform:"uppercase",marginTop:2}}>{l}</div></div>)}
        </div>
        <h3 style={{fontSize:"1.05rem",fontWeight:700,marginBottom:12}}>Latest articles</h3>
        {articles.length===0&&<p style={{color:T.mute}}>No articles yet. Admins can create them from Admin panel.</p>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {articles.slice(0,6).map(a=><div key={a.id} onClick={()=>setSelA(a)} style={{...T.card,cursor:"pointer",marginBottom:0}}>
            <div style={{display:"flex",gap:5,marginBottom:8}}><span style={T.tag(T.tealBg,T.teal)}>{a.cat||"General"}</span>{a.feat&&<span style={T.tag(T.goldBg,T.goldD)}>Featured</span>}</div>
            <h4 style={{fontSize:".95rem",fontWeight:600,lineHeight:1.4}}>{a.title}</h4>
            <p style={{fontSize:".78rem",color:T.txt2,marginTop:6,lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{a.body}</p>
            <p style={{fontSize:".72rem",color:T.mute,marginTop:6}}>{a.author||"Admin"} · {fD(a.date)}</p>
          </div>)}
        </div>
      </div>}
      {pg==="home"&&selA&&<div><button onClick={()=>setSelA(null)} style={{...T.btnO,...T.btnSm,marginBottom:14}}>← Back</button><div style={{...T.card,maxWidth:720}}><span style={T.tag(T.tealBg,T.teal)}>{selA.cat}</span><h2 style={{fontSize:"1.5rem",fontWeight:700,marginTop:10,lineHeight:1.35}}>{selA.title}</h2><p style={{fontSize:".82rem",color:T.mute,marginTop:8}}>{selA.author} · {fD(selA.date)}</p><div style={{marginTop:20,fontSize:"1rem",color:T.txt2,lineHeight:1.9,whiteSpace:"pre-wrap"}}>{selA.body}</div></div></div>}

      {/* QUIZ */}
      {pg==="quiz"&&<div>
        <div style={{display:"flex",gap:6,overflowX:"auto",padding:"4px 0 14px"}}>{dates.map(d=>{const dt=new Date(d+"T12:00:00");const sun=dt.getDay()===0;const on=d===selD;return<div key={d} onClick={()=>!sun&&setSelD(d)} style={{minWidth:52,padding:"8px 4px",textAlign:"center",borderRadius:10,border:`1.5px solid ${on?T.teal:T.border}`,cursor:sun?"not-allowed":"pointer",background:on?T.tealBg:"#fff",opacity:sun?.3:1}}><div style={{fontSize:".58rem",color:on?T.teal:T.mute,textTransform:"uppercase",fontWeight:on?600:400}}>{dN(d)}</div><div style={{fontSize:"1rem",fontWeight:700,color:on?T.teal:T.txt}}>{dt.getDate()}</div></div>})}</div>
        {ld&&<div style={{...T.card,textAlign:"center",padding:50}}><p style={{color:T.mute}}>⏳ Generating...</p></div>}
        {!ld&&!qObj&&<div style={{...T.card,textAlign:"center",padding:40}}>{selD===today?<><div style={{fontSize:"2rem",marginBottom:10}}>🔬</div><p style={{color:T.teal,fontWeight:600}}>Today's question</p><p style={{color:T.mute,fontSize:".88rem",margin:"8px 0 16px"}}>10 AM IST daily</p>{isAdm&&<button onClick={genQuiz} style={T.btn}>🤖 Generate now</button>}</>:<p style={{color:T.mute}}>No question for this date</p>}</div>}
        {!ld&&qObj&&<div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:16,alignItems:"start"}}>
          <div style={{...T.card,borderLeft:"3px solid "+T.teal}}>
            <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}><span style={{fontSize:".8rem",color:T.mute}}>📅 {fD(qObj.date)}</span>{isT&&hr<21&&<span style={T.tag(T.okBg,T.ok)}>● LIVE</span>}{rev&&!isT&&<span style={T.tag(T.errBg,T.err)}>Closed</span>}<span style={{fontSize:".72rem",color:T.mute,marginLeft:"auto"}}>{Object.keys(qObj.answers||{}).length} answered</span></div>
            <div style={{display:"flex",gap:6,marginBottom:12}}><span style={T.tag(T.tealBg,T.teal)}>{qObj.cat}</span><span style={T.tag(T.warnBg,T.warn)}>{qObj.diff}</span></div>
            {qObj.scen&&<div style={{background:T.bg,borderLeft:"3px solid "+T.gold,padding:"12px 16px",marginBottom:16,borderRadius:"0 10px 10px 0",fontSize:".9rem",color:T.txt2,lineHeight:1.65}}>{qObj.scen}</div>}
            <div style={{fontSize:"1.1rem",fontWeight:600,lineHeight:1.6,marginBottom:16}}>{qObj.question}</div>
            {qObj.opts.map((o,i)=>{const l="ABC"[i];const sr=uA!==undefined||(rev&&!canA);const co=sr&&i===qObj.ci;const wr=sr&&i===uA&&uA!==qObj.ci;
              return<div key={i} onClick={()=>canA&&submitAnswer(qObj.id,qObj,i)} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px 16px",background:co?T.okBg:wr?T.errBg:"#fff",border:`1.5px solid ${co?"#1a7d42":wr?"#c0392b":T.border}`,borderRadius:12,marginBottom:10,cursor:canA?"pointer":"default",opacity:!canA&&!sr?.5:1}}><div style={{...T.av(28,co?"#1a7d42":wr?"#c0392b":T.tealBg,co||wr?"#fff":T.teal),fontSize:".78rem",flexShrink:0}}>{l}</div><div style={{fontSize:".92rem",lineHeight:1.55}}>{o}</div></div>})}
            {uA!==undefined&&<p style={{color:uA===qObj.ci?T.ok:T.err,fontWeight:600,marginTop:10}}>{uA===qObj.ci?"✓ Correct!":"✗ Incorrect."}</p>}
            {((uA!==undefined&&rev)||(!canA&&rev&&dd>0))&&qObj.expl&&<div style={{background:T.goldBg,border:"1px solid #f0e6c8",borderRadius:12,padding:16,marginTop:12}}><div style={{color:T.goldD,fontWeight:700,marginBottom:8}}>💡 Explanation</div><div style={{fontSize:".88rem",color:T.txt2,lineHeight:1.75}} dangerouslySetInnerHTML={{__html:qObj.expl}}/></div>}
          </div>
          {/* Comments with LIKE buttons */}
          <div style={T.card}><div style={{fontSize:".88rem",color:T.teal,fontWeight:600,marginBottom:10}}>💬 Discussion ({qObj.comments?.length||0})</div>
            <div style={{maxHeight:380,overflowY:"auto"}}>{(qObj.comments||[]).map((x,i)=><div key={i} style={{padding:"8px 0",borderBottom:"1px solid "+T.border}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><div style={T.av(20,T.tealBg,T.teal)}>{x.ini}</div><b style={{fontSize:".78rem"}}>{x.n}</b><span style={{fontSize:".6rem",color:T.mute}}>{x.tm}</span></div>
              <div style={{fontSize:".82rem",color:T.txt2,paddingLeft:26,lineHeight:1.5}}>{x.txt}</div>
              <div style={{paddingLeft:26,marginTop:4}}><LikeBtn liked={(x.likedBy||[]).includes(au?.uid)} count={x.likes||0} onToggle={()=>toggleCommentLike(qObj.id,qObj,i)}/></div>
            </div>)}{!qObj.comments?.length&&<p style={{color:T.mute,fontSize:".8rem"}}>No comments yet.</p>}</div>
            <div style={{display:"flex",gap:6,marginTop:10}}><input value={cmt} onChange={e=>setCmt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addComment(qObj.id,qObj)} placeholder="Your thoughts..." style={{...T.inp,borderRadius:20,padding:"9px 14px",fontSize:".82rem",flex:1}}/><button onClick={()=>addComment(qObj.id,qObj)} style={{...T.btn,...T.btnSm}}>Post</button></div>
          </div>
        </div>}
      </div>}

      {/* LIBRARY */}
      {pg==="library"&&<div><h3 style={{fontSize:"1.15rem",fontWeight:700,marginBottom:14}}>📚 Resource library</h3>
        {resources.length===0&&<p style={{color:T.mute}}>No resources yet.</p>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:14}}>
          {resources.map(r=><div key={r.id} style={{...T.card,display:"flex",gap:14,alignItems:"center",marginBottom:0}}>
            <div style={{fontSize:"2rem"}}>{r.icon||"📄"}</div>
            <div style={{flex:1}}><h4 style={{fontSize:".9rem",fontWeight:600,lineHeight:1.3}}>{r.title||r.t}</h4><div style={{fontSize:".72rem",color:T.mute,marginTop:3}}>{r.pages?r.pages+"p · ":""}{r.size||""}</div>
              <div style={{marginTop:6}}>{r.free||isPd?<button onClick={()=>r.url?window.open(r.url,"_blank"):sh("No URL")} style={{...T.btn,...T.btnSm}}>📥 Download</button>:<button style={{...T.btnO,...T.btnSm,color:T.gold,borderColor:T.gold}}>🔒 Premium</button>}</div></div>
          </div>)}
        </div>
      </div>}

      {/* VIDEOS */}
      {pg==="videos"&&!selV&&<div><h3 style={{fontSize:"1.15rem",fontWeight:700,marginBottom:14}}>🎥 Video gallery</h3>
        {videos.length===0&&<p style={{color:T.mute}}>No videos yet.</p>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
          {videos.map(v=><div key={v.id} onClick={()=>setSelV(v)} style={{...T.card,cursor:"pointer",marginBottom:0}}>
            <div style={{height:100,borderRadius:10,background:"linear-gradient(135deg,#e1f5ee,#d0ede5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2.5rem",marginBottom:10,position:"relative"}}>{v.icon||"🎥"}{!v.free&&!isPd&&<div style={{position:"absolute",top:6,right:6,...T.tag(T.goldBg,T.goldD)}}>🔒</div>}<div style={{position:"absolute",bottom:6,right:6,fontSize:".65rem",background:"rgba(0,0,0,.6)",padding:"2px 6px",borderRadius:5,color:"#fff"}}>{v.dur||""}</div></div>
            <span style={T.tag(T.tealBg,T.teal)}>{v.cat||"General"}</span><h4 style={{fontSize:".9rem",fontWeight:600,marginTop:6,lineHeight:1.3}}>{v.title||v.t}</h4>
          </div>)}
        </div></div>}
      {pg==="videos"&&selV&&<div><button onClick={()=>setSelV(null)} style={{...T.btnO,...T.btnSm,marginBottom:14}}>← Back</button>
        <div style={{...T.card,maxWidth:720}}>{selV.embedUrl&&(selV.free||isPd)?<div style={{position:"relative",paddingBottom:"56.25%",height:0,borderRadius:12,overflow:"hidden",marginBottom:16}}><iframe src={selV.embedUrl} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:0}} allowFullScreen/></div>:<div style={{height:200,borderRadius:12,background:"linear-gradient(135deg,#e1f5ee,#c8ebe0)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>{selV.free||isPd?<p style={{color:T.teal}}>▶️ {selV.embedUrl?"Loading":"No URL set"}</p>:<div style={{textAlign:"center"}}><p style={{color:T.teal,fontWeight:600}}>🔒 Premium</p><button style={{...T.btnGold,marginTop:8}}>₹999/mo</button></div>}</div>}
          <h3 style={{fontWeight:700,fontSize:"1.2rem"}}>{selV.title||selV.t}</h3><p style={{color:T.mute,fontSize:".82rem",marginTop:4}}>{selV.dur}</p><p style={{color:T.txt2,marginTop:12,lineHeight:1.8}}>{selV.desc}</p></div>
      </div>}

      {/* ═══ CLINICAL CASES — NEW SECTION ═══ */}
      {pg==="cases"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div><h3 style={{fontSize:"1.15rem",fontWeight:700}}>🔬 Clinical cases</h3><p style={{color:T.mute,fontSize:".82rem",marginTop:2}}>Share cases with images for peer discussion</p></div>
          <button onClick={()=>setNewCase(!newCase)} style={T.btn}>{newCase?"Cancel":"+ Post case"}</button>
        </div>
        {newCase&&<div style={{...T.card,borderLeft:"3px solid "+T.gold}}>
          <input value={ccT} onChange={e=>setCcT(e.target.value)} placeholder="Case title (e.g. 'Unusual pigmentation pattern on forearm')" style={{...T.inp,marginBottom:10}}/>
          <select value={ccC} onChange={e=>setCcC(e.target.value)} style={{...T.inp,marginBottom:10}}>{TOPICS.map(t=><option key={t} value={t}>{t}</option>)}</select>
          <textarea value={ccB} onChange={e=>setCcB(e.target.value)} placeholder="Patient history, presentation, your observations..." rows={3} style={{...T.txa,marginBottom:10}}/>
          <input value={ccDiag} onChange={e=>setCcDiag(e.target.value)} placeholder="Your diagnosis / question for the community" style={{...T.inp,marginBottom:10}}/>
          <div style={{marginBottom:10}}><ImgUpload images={ccImgs} setImages={setCcImgs} uploading={ccUp} setUploading={setCcUp}/></div>
          <button onClick={postCase} style={T.btn}>Publish case</button>
        </div>}
        {cases.length===0&&!newCase&&<p style={{color:T.mute}}>No cases yet. Be the first to share a clinical case!</p>}
        {cases.map(cs=><div key={cs.id} style={T.card}>
          <div style={{display:"flex",gap:12}}>
            {cs.photo?<img src={cs.photo} style={{width:36,height:36,borderRadius:"50%"}}/>:<div style={T.av(36,T.tealBg,T.teal)}>{cs.ini||"?"}</div>}
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><b style={{fontSize:".88rem"}}>{cs.author}</b><span style={{fontSize:".65rem",color:T.mute}}>{fD(cs.date)}</span></div>
              <span style={{...T.tag(T.tealBg,T.teal),marginTop:4}}>{cs.cat}</span>
              <h4 style={{fontSize:"1rem",fontWeight:600,marginTop:6,lineHeight:1.4}}>{cs.title}</h4>
              <p style={{fontSize:".88rem",color:T.txt2,marginTop:4,lineHeight:1.6}}>{cs.body}</p>
              {cs.diagnosis&&<div style={{background:T.goldBg,borderLeft:"3px solid "+T.gold,padding:"8px 12px",marginTop:8,borderRadius:"0 8px 8px 0",fontSize:".85rem",color:T.goldD}}>💡 {cs.diagnosis}</div>}
              <ImgGallery images={cs.images}/>
              <div style={{display:"flex",gap:12,marginTop:10,alignItems:"center"}}>
                <LikeBtn liked={(cs.likedBy||[]).includes(au?.uid)} count={cs.likes||0} onToggle={()=>toggleLike("cases",cs.id,cs,setCases)}/>
                <span style={{fontSize:".75rem",color:T.mute}}>💬 {cs.comments?.length||0} comments</span>
              </div>
              {/* Case comments */}
              {(cs.comments||[]).length>0&&<div style={{marginTop:8,paddingLeft:10,borderLeft:"2px solid "+T.border}}>
                {cs.comments.map((x,i)=><div key={i} style={{padding:"5px 0",fontSize:".82rem"}}><b style={{color:T.txt}}>{x.n}</b> <span style={{color:T.mute,fontSize:".6rem"}}>{x.tm}</span><div style={{color:T.txt2}}>{x.txt}</div></div>)}
              </div>}
              <CaseCmtInput caseId={cs.id} caseObj={cs}/>
            </div>
          </div>
        </div>)}
      </div>}

      {/* FORUM with LIKES + IMAGES */}
      {pg==="forum"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><h3 style={{fontSize:"1.15rem",fontWeight:700}}>💬 Discussion forum</h3><button onClick={()=>setNewForum(!newForum)} style={T.btn}>{newForum?"Cancel":"+ New post"}</button></div>
        {newForum&&<div style={{...T.card,borderLeft:"3px solid "+T.teal}}>
          <input value={fpT} onChange={e=>setFpT(e.target.value)} placeholder="Title..." style={{...T.inp,marginBottom:10}}/>
          <select value={fpC} onChange={e=>setFpC(e.target.value)} style={{...T.inp,marginBottom:10}}>{TOPICS.map(t=><option key={t} value={t}>{t}</option>)}</select>
          <textarea value={fpB} onChange={e=>setFpB(e.target.value)} placeholder="Details..." rows={3} style={{...T.txa,marginBottom:10}}/>
          <div style={{marginBottom:10}}><ImgUpload images={fpImgs} setImages={setFpImgs} uploading={fpUp} setUploading={setFpUp}/></div>
          <button onClick={postForum} style={T.btn}>Publish</button>
        </div>}
        {forumPosts.length===0&&!newForum&&<p style={{color:T.mute}}>No posts yet.</p>}
        {forumPosts.map(p=><div key={p.id} style={T.card}>
          <div style={{display:"flex",gap:12}}>
            {p.photo?<img src={p.photo} style={{width:36,height:36,borderRadius:"50%"}}/>:<div style={T.av(36,T.tealBg,T.teal)}>{p.ini||"?"}</div>}
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><b style={{fontSize:".88rem"}}>{p.author}</b><span style={{fontSize:".65rem",color:T.mute}}>{fD(p.date)}</span></div>
              <span style={{...T.tag(T.tealBg,T.teal),marginTop:4}}>{p.cat}</span>
              <h4 style={{fontSize:"1rem",fontWeight:600,marginTop:6,lineHeight:1.4}}>{p.title}</h4>
              <p style={{fontSize:".88rem",color:T.txt2,marginTop:4,lineHeight:1.6}}>{p.body}</p>
              <ImgGallery images={p.images}/>
              <div style={{display:"flex",gap:12,marginTop:10,alignItems:"center"}}>
                <LikeBtn liked={(p.likedBy||[]).includes(au?.uid)} count={p.likes||0} onToggle={()=>toggleLike("forum",p.id,p,setForumPosts)}/>
                <span style={{fontSize:".75rem",color:T.mute}}>💬 {p.replies||0}</span>
              </div>
            </div>
          </div>
        </div>)}
      </div>}

      {/* RANK */}
      {pg==="rank"&&<div style={{...T.card,maxWidth:640}}><h3 style={{fontSize:"1.15rem",fontWeight:700,marginBottom:14}}>🏆 Leaderboard</h3>
        {leaderboard.length===0&&<p style={{color:T.mute}}>No scores yet.</p>}
        {leaderboard.map((u,i)=>{const uAcc=u.totalAnswered?Math.round(u.totalCorrect/u.totalAnswered*100):0;const isMe=u.id===au?.uid;
          return<div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:12,borderRadius:12,marginBottom:6,background:isMe?T.tealBg:"#fff",border:`1px solid ${isMe?T.teal:T.border}`}}>
            <div style={{width:28,textAlign:"center",fontWeight:700,color:i<3?["#FFD700","#888","#CD7F32"][i]:T.txt}}>{i<3?["🥇","🥈","🥉"][i]:i+1}</div>
            {u.photo?<img src={u.photo} style={{width:36,height:36,borderRadius:"50%"}}/>:<div style={T.av(36,isMe?T.teal:T.tealBg,isMe?"#fff":T.teal)}>{u.initials||"?"}</div>}
            <div style={{flex:1}}><div style={{fontWeight:600,fontSize:".88rem"}}>{u.name}{isMe?" (You)":""}</div><div style={{fontSize:".7rem",color:T.mute}}>{u.clinic||u.email}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:700,color:T.teal}}>{uAcc}%</div><div style={{fontSize:".65rem",color:T.mute}}>🔥{u.streak||0}d · {u.totalAnswered}Q</div></div>
          </div>})}
      </div>}

      {/* PROFILE */}
      {pg==="me"&&<div style={{maxWidth:640}}>
        <div style={{...T.card,textAlign:"center",padding:28}}>
          {uPhoto?<img src={uPhoto} style={{width:76,height:76,borderRadius:"50%",border:"3px solid "+T.teal,display:"block",margin:"0 auto 12px"}}/>:<div style={{...T.av(76,T.tealBg,T.teal),border:"3px solid "+T.teal,margin:"0 auto 12px",fontSize:"1.6rem"}}>{uIni}</div>}
          <div style={{fontSize:"1.4rem",fontWeight:700}}>{uName}</div><div style={{color:T.txt2,fontSize:".88rem",marginTop:3}}>{prof?.degree}</div><div style={{color:T.mute,fontSize:".8rem",marginTop:2}}>{au?.email}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,margin:"12px 0"}}>
          {[["Quizzes",totA],["Correct",corr],["Accuracy",acc+"%"],["Streak",prof?.streak||0]].map(([l,v])=><div key={l} style={{...T.card,textAlign:"center",padding:"12px 4px",marginBottom:0}}><div style={{fontSize:"1.2rem",fontWeight:700,color:T.teal}}>{v}</div><div style={{fontSize:".58rem",color:T.mute,textTransform:"uppercase"}}>{l}</div></div>)}
        </div>
        <div style={T.card}>
          {[["Email",au?.email],["Clinic",prof?.clinic],["Address",prof?.address],["Joined",prof?.joined?fD(prof.joined):"—"]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid "+T.border,fontSize:".88rem"}}><span style={{color:T.mute}}>{l}</span><span style={{fontWeight:500}}>{v||"—"}</span></div>)}
          <div style={{display:"flex",gap:10,marginTop:14}}>{!isPd&&<button onClick={()=>{const p={...prof,paid:true};setProf(p);fbSet("users",au.uid,{paid:true});sh("⭐ Premium!")}} style={T.btnGold}>⭐ Premium</button>}<button onClick={doLogout} style={{...T.btnO,color:T.err,borderColor:"#f0c0c0"}}>Sign out</button></div>
        </div>
      </div>}

      {/* ADMIN */}
      {pg==="admin"&&isAdm&&<div>
        <h3 style={{fontSize:"1.15rem",fontWeight:700,marginBottom:12}}>⚙️ Admin dashboard</h3>
        <div style={{display:"flex",gap:5,marginBottom:16,flexWrap:"wrap"}}>
          {[["stats","📊 Overview"],["quiz","🧠 Quiz"],["articles","📰 Articles"],["resources","📚 Resources"],["videos","🎥 Videos"],["users","👥 Users"]].map(([id,l])=><button key={id} onClick={()=>{setATab(id);setEdForm(null)}} style={{padding:"8px 14px",borderRadius:10,border:`1.5px solid ${aTab===id?T.teal:T.border}`,background:aTab===id?T.tealBg:"#fff",color:aTab===id?T.teal:T.mute,cursor:"pointer",fontSize:".8rem",fontWeight:aTab===id?600:400,fontFamily:"inherit"}}>{l}</button>)}
        </div>
        {aTab==="stats"&&<div style={T.card}><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>{[["Articles",articles.length],["Resources",resources.length],["Videos",videos.length],["Forum",forumPosts.length],["Cases",cases.length],["Quizzes",quizzes.length],["Users",allUsers.length]].map(([l,v])=><div key={l} style={{textAlign:"center",padding:14,background:T.bg,borderRadius:10}}><div style={{fontSize:"1.4rem",fontWeight:700,color:T.teal}}>{v}</div><div style={{fontSize:".6rem",color:T.mute,textTransform:"uppercase"}}>{l}</div></div>)}</div></div>}
        {aTab==="quiz"&&<div style={T.card}><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{quizzes.length} questions</span><button onClick={genQuiz} style={T.btn}>🤖 Generate today</button></div>
          {quizzes.map(q=><div key={q.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border}}><div><div style={{fontWeight:500,fontSize:".88rem"}}>{q.cat} — {q.diff}</div><div style={{fontSize:".72rem",color:T.mute}}>{fD(q.date)} · {Object.keys(q.answers||{}).length} answers</div></div><div style={{display:"flex",gap:4}}><button onClick={()=>{setSelD(q.date);go("quiz")}} style={{...T.btnO,...T.btnSm}}>View</button><button onClick={()=>deleteContent("quizzes",q.id,q.cat)} style={T.btnDanger}>Del</button></div></div>)}</div>}
        {aTab==="articles"&&<div style={T.card}>{edForm?.type==="articles"?<AdminForm type="Article" fields={[["title","Title"],["cat","Category","select"],["author","Author"],["date","Date (YYYY-MM-DD)"],["body","Content","textarea"],["feat","Featured","check"]]} onSave={()=>saveContent("articles")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{articles.length}</span><button onClick={()=>setEdForm({type:"articles",data:{date:today,author:uName,cat:TOPICS[0]},editing:false})} style={T.btn}>+ New</button></div>
          {articles.map(a=><div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border}}><div><div style={{fontWeight:500,fontSize:".88rem"}}>{a.title}</div><div style={{fontSize:".72rem",color:T.mute}}>{fD(a.date)}</div></div><div style={{display:"flex",gap:4}}><button onClick={()=>setEdForm({type:"articles",data:{...a},editing:true})} style={{...T.btnO,...T.btnSm}}>Edit</button><button onClick={()=>deleteContent("articles",a.id,a.title)} style={T.btnDanger}>Del</button></div></div>)}</>}</div>}
        {aTab==="resources"&&<div style={T.card}>{edForm?.type==="resources"?<AdminForm type="Resource" fields={[["title","Title"],["url","Download URL"],["pages","Pages"],["size","Size"],["icon","Emoji"],["free","Free","check"]]} onSave={()=>saveContent("resources")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{resources.length}</span><button onClick={()=>setEdForm({type:"resources",data:{icon:"📄",free:true},editing:false})} style={T.btn}>+ New</button></div>
          {resources.map(r=><div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border}}><div><div style={{fontWeight:500,fontSize:".88rem"}}>{r.icon||"📄"} {r.title||r.t}</div><div style={{fontSize:".72rem",color:T.mute}}>{r.free?"Free":"Premium"}</div></div><div style={{display:"flex",gap:4}}><button onClick={()=>setEdForm({type:"resources",data:{...r},editing:true})} style={{...T.btnO,...T.btnSm}}>Edit</button><button onClick={()=>deleteContent("resources",r.id,r.title||r.t)} style={T.btnDanger}>Del</button></div></div>)}</>}</div>}
        {aTab==="videos"&&<div style={T.card}>{edForm?.type==="videos"?<AdminForm type="Video" fields={[["title","Title"],["cat","Category","select"],["dur","Duration"],["desc","Description","textarea"],["embedUrl","Embed URL"],["icon","Emoji"],["free","Free","check"]]} onSave={()=>saveContent("videos")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{videos.length}</span><button onClick={()=>setEdForm({type:"videos",data:{icon:"🎥",free:true,cat:TOPICS[0]},editing:false})} style={T.btn}>+ New</button></div>
          {videos.map(v=><div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border}}><div><div style={{fontWeight:500,fontSize:".88rem"}}>{v.title||v.t}</div><div style={{fontSize:".72rem",color:T.mute}}>{v.cat} · {v.free?"Free":"Premium"}</div></div><div style={{display:"flex",gap:4}}><button onClick={()=>setEdForm({type:"videos",data:{...v},editing:true})} style={{...T.btnO,...T.btnSm}}>Edit</button><button onClick={()=>deleteContent("videos",v.id,v.title||v.t)} style={T.btnDanger}>Del</button></div></div>)}</>}</div>}
        {aTab==="users"&&<div style={T.card}><p style={{color:T.mute,fontSize:".82rem",marginBottom:10}}>{allUsers.length} users</p>
          {allUsers.map(u=>{const a2=u.totalAnswered?Math.round(u.totalCorrect/u.totalAnswered*100):0;return<div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid "+T.border}}>
            {u.photo?<img src={u.photo} style={{width:30,height:30,borderRadius:"50%"}}/>:<div style={T.av(30,T.tealBg,T.teal)}>{u.initials||"?"}</div>}
            <div style={{flex:1}}><div style={{fontSize:".85rem",fontWeight:500}}>{u.name} {ADMINS.includes(u.email)?<span style={T.tag(T.tealBg,T.teal)}>Admin</span>:""}</div><div style={{fontSize:".7rem",color:T.mute}}>{u.email}</div></div>
            <div style={{textAlign:"right",fontSize:".75rem"}}><div style={{color:T.teal,fontWeight:600}}>{a2}% · {u.totalAnswered||0}Q</div><div style={{color:T.mute}}>{u.paid?"⭐ Premium":"Free"}</div></div>
          </div>})}</div>}
      </div>}

      <div style={{textAlign:"center",padding:"22px 0",borderTop:"1px solid "+T.border,marginTop:20}}>
        <Logo size={28}/><div style={{fontSize:".65rem",color:T.light,letterSpacing:2,textTransform:"uppercase",marginTop:6}}>SKINARIO · <span style={{color:T.gold,fontWeight:600}}>{BRAND.sub}</span></div>
      </div>

      </div>
      {toast&&<div style={{position:"fixed",bottom:22,left:"50%",transform:"translateX(-50%)",padding:"11px 28px",background:T.teal,color:"#fff",borderRadius:12,fontSize:".9rem",zIndex:1000,boxShadow:"0 4px 20px rgba(13,107,110,.25)"}}>{toast}</div>}
    </div>);
}
