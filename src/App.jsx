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
const fDateRange=(start,end)=>{
  if(!start)return"";
  if(!end||end===start){const d=new Date(start+"T12:00:00");return d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}
  const ds=new Date(start+"T12:00:00"),de=new Date(end+"T12:00:00");
  if(ds.getFullYear()===de.getFullYear()&&ds.getMonth()===de.getMonth()){return`${ds.getDate()}–${de.getDate()} ${ds.toLocaleDateString("en-IN",{month:"short",year:"numeric"})}`}
  if(ds.getFullYear()===de.getFullYear()){return`${ds.toLocaleDateString("en-IN",{day:"numeric",month:"short"})} – ${de.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}`}
  return`${ds.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})} – ${de.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}`;
};
const dN=s=>{try{return new Date(s+"T12:00:00").toLocaleDateString("en-IN",{weekday:"short"})}catch{return""}};

const BRAND={name:"SKINARIO",tagline:"Professional Aesthetic & Cosmetology Community",sub:"By Absolute Institute",logo:"/skinario-logo.jpg"};

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

// ═══ BRAND LOGOS (inline SVG) ═══
const WaIcon=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488"/></svg>;
const XIcon=()=><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
const LiIcon=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>;

// ═══ SHARE BAR (WhatsApp, X, LinkedIn, Copy link, Save) ═══
const ShareBar=({title,url,description,itemId,itemType,currentUser,prof,onSaveToggle})=>{
  const[copied,setCopied]=useState(false);
  const shareText=`🔬 ${title} — read this on SKINARIO, the Professional Aesthetic & Cosmetology Community.`;
  const fullUrl=url||window.location.href;
  const enc=encodeURIComponent;
  const waUrl=`https://wa.me/?text=${enc(shareText+" 👉 "+fullUrl)}`;
  const twUrl=`https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(fullUrl)}`;
  const liUrl=`https://www.linkedin.com/sharing/share-offsite/?url=${enc(fullUrl)}`;
  const copyLink=async()=>{
    try{
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(()=>setCopied(false),2000);
    }catch{alert("Could not copy. URL: "+fullUrl)}
  };
  const saved=itemId&&itemType&&prof?.saved?.[itemType]?.includes(itemId);
  const btn={display:"inline-flex",alignItems:"center",gap:5,padding:"6px 11px",borderRadius:18,border:"1px solid "+T.border,background:"#fff",color:T.txt2,cursor:"pointer",fontSize:".75rem",fontFamily:"inherit",textDecoration:"none",fontWeight:500,lineHeight:1};
  return(<div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
    <span style={{fontSize:".72rem",color:T.mute,marginRight:2}}>Share:</span>
    <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{...btn,color:"#25D366",borderColor:"#25D36644"}} onClick={e=>e.stopPropagation()} title="Share on WhatsApp"><WaIcon/> WhatsApp</a>
    <a href={twUrl} target="_blank" rel="noopener noreferrer" style={{...btn,color:"#000",borderColor:"#00000033"}} onClick={e=>e.stopPropagation()} title="Share on X"><XIcon/> Post</a>
    <a href={liUrl} target="_blank" rel="noopener noreferrer" style={{...btn,color:"#0A66C2",borderColor:"#0A66C244"}} onClick={e=>e.stopPropagation()} title="Share on LinkedIn"><LiIcon/> LinkedIn</a>
    <button onClick={e=>{e.stopPropagation();copyLink()}} style={{...btn,color:copied?T.ok:T.txt2,borderColor:copied?T.ok:T.border}}>{copied?"✓ Copied!":"🔗 Copy"}</button>
    {itemId&&itemType&&onSaveToggle&&<button onClick={e=>{e.stopPropagation();onSaveToggle(itemType,itemId)}} style={{...btn,color:saved?T.gold:T.txt2,borderColor:saved?T.gold:T.border,fontWeight:saved?600:500}} title={saved?"Saved — click to unsave":"Save to your profile"}>{saved?"🔖 Saved":"🔖 Save"}</button>}
  </div>);
};

// ═══ COMMENT THREAD (reusable for articles/resources) ═══
const CommentThread=({collection,itemId,item,currentUser,uName,uIni,onUpdate})=>{
  const[txt,setTxt]=useState("");
  const comments=item.comments||[];
  const submit=async()=>{
    if(!txt.trim()||!currentUser)return;
    const c={n:uName,ini:uIni,txt,tm:getIST().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true}),uid:currentUser.uid,likedBy:[],likes:0};
    const updated=[...comments,c];
    await fbSet(collection,itemId,{comments:updated});
    onUpdate(itemId,updated);
    setTxt("");
  };
  const toggleCmtLike=async(idx)=>{
    if(!currentUser)return;
    const updated=[...comments];const c={...updated[idx]};
    const likedBy=c.likedBy||[];const has=likedBy.includes(currentUser.uid);
    c.likedBy=has?likedBy.filter(u=>u!==currentUser.uid):[...likedBy,currentUser.uid];
    c.likes=c.likedBy.length;
    updated[idx]=c;
    await fbSet(collection,itemId,{comments:updated});
    onUpdate(itemId,updated);
  };
  return(<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid "+T.border}}>
    <div style={{fontSize:".88rem",color:T.teal,fontWeight:600,marginBottom:10}}>💬 Discussion ({comments.length})</div>
    {comments.length===0&&<p style={{color:T.mute,fontSize:".82rem",marginBottom:10}}>No comments yet. Be the first!</p>}
    {comments.map((c,i)=><div key={i} style={{padding:"8px 0",borderBottom:"1px solid "+T.border}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><div style={T.av(22,T.tealBg,T.teal)}>{c.ini}</div><b style={{fontSize:".82rem"}}>{c.n}</b><span style={{fontSize:".62rem",color:T.mute}}>{c.tm}</span></div>
      <div style={{fontSize:".85rem",color:T.txt2,paddingLeft:28,lineHeight:1.5}}>{c.txt}</div>
      <div style={{paddingLeft:28,marginTop:4}}><LikeBtn liked={(c.likedBy||[]).includes(currentUser?.uid)} count={c.likes||0} onToggle={()=>toggleCmtLike(i)}/></div>
    </div>)}
    <div style={{display:"flex",gap:6,marginTop:10}}>
      <input value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Share your thoughts..." style={{...T.inp,borderRadius:20,padding:"9px 14px",fontSize:".82rem",flex:1}}/>
      <button onClick={submit} style={{...T.btn,...T.btnSm}}>Post</button>
    </div>
  </div>);
};

// ═══ MULTI-IMAGE UPLOAD (used in forum/cases) ═══
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

// ═══ ADMIN SINGLE-IMAGE FIELD (for cover/thumbnail in articles & resources) ═══
const AdminImgField=({value,onChange})=>{
  const fileRef=useRef();
  const[busy,setBusy]=useState(false);
  const handleFile=async(e)=>{
    const f=e.target.files?.[0];if(!f)return;
    setBusy(true);
    try{
      const path=`covers/${Date.now()}_${f.name}`;
      const sRef=ref(storage,path);
      await uploadBytes(sRef,f);
      const url=await getDownloadURL(sRef);
      onChange(url);
    }catch(err){console.error("Upload error:",err);alert("Upload failed")}
    setBusy(false);
    if(fileRef.current)fileRef.current.value="";
  };
  return(<div>
    {value&&<div style={{position:"relative",width:140,height:90,borderRadius:8,overflow:"hidden",border:"1px solid "+T.border,marginBottom:6}}>
      <img src={value} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
      <button onClick={()=>onChange("")} style={{position:"absolute",top:3,right:3,width:20,height:20,borderRadius:"50%",background:"rgba(0,0,0,.65)",color:"#fff",border:"none",fontSize:".65rem",cursor:"pointer"}}>✕</button>
    </div>}
    <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
    <button onClick={()=>fileRef.current?.click()} disabled={busy} style={{...T.btnO,...T.btnSm,opacity:busy?.5:1}}>{busy?"⏳ Uploading...":value?"🔄 Replace image":"📷 Upload image"}</button>
  </div>)
};

// ═══ ADMIN FORM (moved outside App to fix cursor focus bug) ═══
const AdminForm=({type,fields,edForm,setEdForm,onSave})=>{
  const d=edForm?.data||{};
  const set=(k,v)=>setEdForm(p=>({...p,data:{...p.data,[k]:v}}));
  return(<div style={{...T.card,borderLeft:"3px solid "+T.teal}}>
    <h4 style={{color:T.teal,fontWeight:700,marginBottom:12}}>{edForm?.editing?"Edit":"New"} {type}</h4>
    {fields.map(([k,l,tp,opts])=><div key={k} style={{marginBottom:10}}>
      <label style={{display:"block",fontSize:".75rem",color:T.teal,marginBottom:4}}>{l}</label>
      {tp==="textarea"?<textarea value={d[k]||""} onChange={e=>set(k,e.target.value)} style={T.txa}/>
      :tp==="select"?<select value={d[k]||""} onChange={e=>set(k,e.target.value)} style={T.inp}>{(opts||TOPICS).map(t=><option key={t} value={t}>{t}</option>)}{!opts&&<option value="General">General</option>}</select>
      :tp==="check"?<label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}><input type="checkbox" checked={!!d[k]} onChange={e=>set(k,e.target.checked)}/> {l}</label>
      :tp==="image"?<AdminImgField value={d[k]} onChange={url=>set(k,url)}/>
      :tp==="date"?<input type="date" value={d[k]||""} onChange={e=>set(k,e.target.value)} style={T.inp}/>
      :<input value={d[k]||""} onChange={e=>set(k,e.target.value)} style={T.inp}/>}
    </div>)}
    <div style={{display:"flex",gap:8}}><button onClick={onSave} style={T.btn}>{edForm?.editing?"Update":"Create"}</button><button onClick={()=>setEdForm(null)} style={T.btnO}>Cancel</button></div>
  </div>)
};

// ═══ CASE COMMENT INPUT (moved outside App to fix cursor focus bug) ═══
const CaseCmtInput=({caseId,caseObj,addCaseComment})=>{
  const[txt,setTxt]=useState("");
  const submit=()=>{addCaseComment(caseId,caseObj,txt);setTxt("")};
  return(<div style={{display:"flex",gap:6,marginTop:10}}>
    <input value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Your thoughts..." style={{...T.inp,borderRadius:20,padding:"9px 14px",fontSize:".82rem",flex:1}}/>
    <button onClick={submit} style={{...T.btn,...T.btnSm}}>Post</button>
  </div>)
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
  try{const r=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:`Generate a clinical aesthetic and cosmetology medicine quiz question as JSON.
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
  const[welcomeSeen,setWelcomeSeen]=useState(()=>localStorage.getItem("sk_welcome")==="1");
  const[quizzes,setQuizzes]=useState([]);const[articles,setArticles]=useState([]);const[resources,setResources]=useState([]);const[videos,setVideos]=useState([]);const[forumPosts,setForumPosts]=useState([]);const[cases,setCases]=useState([]);const[allUsers,setAllUsers]=useState([]);
  const[selD,setSelD]=useState(ds(getIST()));const[selA,setSelA]=useState(null);const[selV,setSelV]=useState(null);const[toast,setToast]=useState(null);const[cmt,setCmt]=useState("");const[ld,setLd]=useState(false);const[aTab,setATab]=useState("stats");
  const[authMode,setAuthMode]=useState("signin");const[authEmail,setAuthEmail]=useState("");const[authPass,setAuthPass]=useState("");const[authName,setAuthName]=useState("");const[authBusy,setAuthBusy]=useState(false);const[authErr,setAuthErr]=useState("");
  const[pf,setPf]=useState({degree:"",clinic:"",address:""});const[edForm,setEdForm]=useState(null);
  // Forum/Cases new post state
  const[newForum,setNewForum]=useState(false);const[fpT,setFpT]=useState("");const[fpB,setFpB]=useState("");const[fpC,setFpC]=useState(TOPICS[0]);const[fpImgs,setFpImgs]=useState([]);const[fpUp,setFpUp]=useState(false);
  const[newCase,setNewCase]=useState(false);const[ccT,setCcT]=useState("");const[ccB,setCcB]=useState("");const[ccC,setCcC]=useState(TOPICS[0]);const[ccImgs,setCcImgs]=useState([]);const[ccUp,setCcUp]=useState(false);const[ccDiag,setCcDiag]=useState("");const[ccHistory,setCcHistory]=useState("");const[ccTreatment,setCcTreatment]=useState("");const[ccOutcome,setCcOutcome]=useState("");

  const sh=m=>setToast(m);const go=p=>{setPg(p);setSelA(null);setSelV(null);setSelAd(null);setSelE(null);setEdForm(null)};
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(null),3000);return()=>clearTimeout(t)}},[toast]);

  const[ads,setAds]=useState([]);
  const[articleLimit,setArticleLimit]=useState(6);
  const[events,setEvents]=useState([]);
  const[selAd,setSelAd]=useState(null);
  const[selE,setSelE]=useState(null);
  const loadData=useCallback(async()=>{const[q,a,r,v,f,cs,u,ad,ev]=await Promise.all([fbGetAll("quizzes","date","desc"),fbGetAll("articles","date","desc"),fbGetAll("resources","order","asc"),fbGetAll("videos","order","asc"),fbGetAll("forum","createdAt","desc"),fbGetAll("cases","createdAt","desc"),fbGetAll("users","joined","desc"),fbGetAll("ads","createdAt","desc"),fbGetAll("events","date","asc",200)]);setQuizzes(q);setArticles(a);setResources(r);setVideos(v);setForumPosts(f);setCases(cs);setAllUsers(u);setAds(ad);setEvents(ev)},[]);

  useEffect(()=>{const unsub=onAuthStateChanged(auth,async u=>{if(u){setAu(u);let p=await fbGet("users",u.uid);if(!p){const l=localStorage.getItem("sk_p_"+u.uid);if(l)p=JSON.parse(l)}if(p){setProf(p);setScr("main");loadData()}else{setPf({degree:"",clinic:"",address:""});setScr("setup")}}else{setAu(null);setProf(null);setScr("login")}});return()=>unsub()},[loadData]);

  // ═══ DEEP-LINK: open shared article/video/forum/event/ad/quiz from URL ═══
  useEffect(()=>{
    if(scr!=="main")return;
    const params=new URLSearchParams(window.location.search);
    const articleId=params.get("article");
    const videoId=params.get("video");
    const forumId=params.get("forum");
    const eventId=params.get("event");
    const adId=params.get("ad");
    const quizId=params.get("quiz");
    if(articleId&&articles.length){
      const found=articles.find(a=>a.id===articleId);
      if(found){setPg("home");setSelA(found);window.history.replaceState({},"",window.location.pathname)}
      else{sh("Article not found");window.history.replaceState({},"",window.location.pathname)}
    }else if(videoId&&videos.length){
      const found=videos.find(v=>v.id===videoId);
      if(found){setPg("videos");setSelV(found);window.history.replaceState({},"",window.location.pathname)}
      else{sh("Video not found");window.history.replaceState({},"",window.location.pathname)}
    }else if(eventId&&events.length){
      const found=events.find(e=>e.id===eventId);
      if(found){setPg("events");setSelE(found);window.history.replaceState({},"",window.location.pathname)}
      else{sh("Event not found");window.history.replaceState({},"",window.location.pathname)}
    }else if(adId&&ads.length){
      const found=ads.find(a=>a.id===adId);
      if(found&&found.adType==="internal"){setPg("ad");setSelAd(found);window.history.replaceState({},"",window.location.pathname)}
      else{window.history.replaceState({},"",window.location.pathname)}
    }else if(quizId&&quizzes.length){
      const found=quizzes.find(q=>q.id===quizId);
      if(found){setPg("quiz");setSelD(found.date);window.history.replaceState({},"",window.location.pathname)}
      else{sh("Quiz not found");window.history.replaceState({},"",window.location.pathname)}
    }else if(forumId&&forumPosts.length){
      setPg("forum");window.history.replaceState({},"",window.location.pathname);
    }else if(params.get("case")&&cases.length){
      setPg("cases");window.history.replaceState({},"",window.location.pathname);
    }
  },[scr,articles,videos,forumPosts,events,ads,quizzes,cases]);

  const isAdm=prof&&ADMINS.includes(au?.email);const isPd=prof?.paid;const today=ds(getIST());const hr=getIST().getHours();
  const uName=prof?.name||au?.displayName||"Doctor";const uIni=(uName.replace(/^Dr\.?\s*/i,"").split(" ").map(w=>w[0]).join("").toUpperCase()||"D").slice(0,2);const uPhoto=au?.photoURL;
  const myAns=quizzes.reduce((a,q)=>{if(q.answers?.[au?.uid]!==undefined)a.push({correct:q.answers[au.uid]===q.ci});return a},[]);
  const totA=myAns.length;const corr=myAns.filter(a=>a.correct).length;const acc=totA?Math.round(corr/totA*100):0;

  // ═══ AUTH ═══
  const doGoogleLogin=async()=>{setAuthErr("");try{await signInWithPopup(auth,gProv)}catch(e){if(e.code!=="auth/popup-closed-by-user")setAuthErr("Failed")}};
  const doEmailSignup=async()=>{setAuthErr("");if(!authName.trim())return setAuthErr("Enter name");if(!authEmail.trim())return setAuthErr("Enter email");if(authPass.length<6)return setAuthErr("6+ chars");setAuthBusy(true);try{const c=await createUserWithEmailAndPassword(auth,authEmail,authPass);await updateProfile(c.user,{displayName:authName})}catch(e){setAuthErr(e.code==="auth/email-already-in-use"?"Email registered":"Failed")}setAuthBusy(false)};
  const doEmailSignin=async()=>{setAuthErr("");if(!authEmail.trim())return setAuthErr("Enter email");if(!authPass)return setAuthErr("Enter password");setAuthBusy(true);try{await signInWithEmailAndPassword(auth,authEmail,authPass)}catch(e){setAuthErr(e.code==="auth/invalid-credential"?"Wrong email/password":"Failed")}setAuthBusy(false)};
  const doForgot=async()=>{setAuthErr("");if(!authEmail.trim())return setAuthErr("Enter email");setAuthBusy(true);try{await sendPasswordResetEmail(auth,authEmail);sh("📧 Reset sent!");setAuthMode("signin")}catch{setAuthErr("Failed")}setAuthBusy(false)};
  const doLogout=async()=>{if(confirm("Sign out?")){localStorage.removeItem("sk_welcome");setWelcomeSeen(false);await signOut(auth)}};
  const savePf=async()=>{if(!pf.degree){sh("Degree required");return}const p={name:au.displayName||authName||"Doctor",email:au.email,photo:au.photoURL||"",degree:pf.degree,clinic:pf.clinic,address:pf.address,paid:false,joined:ds(getIST()),initials:uIni,totalCorrect:0,totalAnswered:0,streak:0};await fbSet("users",au.uid,p);localStorage.setItem("sk_p_"+au.uid,JSON.stringify(p));setProf(p);setScr("main");sh("Welcome to SKINARIO!");loadData()};

  // ═══ LIKE TOGGLE (works for any collection) ═══
  const toggleLike=async(colName,id,item,stateUpdater)=>{
    const likedBy=item.likedBy||[];const hasLiked=likedBy.includes(au.uid);
    const newLikedBy=hasLiked?likedBy.filter(u=>u!==au.uid):[...likedBy,au.uid];
    await fbSet(colName,id,{likedBy:newLikedBy,likes:newLikedBy.length});
    stateUpdater(p=>p.map(x=>x.id===id?{...x,likedBy:newLikedBy,likes:newLikedBy.length}:x));
  };

  // ═══ SAVE / BOOKMARK TOGGLE (per-user, stored on user profile) ═══
  const toggleSave=async(itemType,itemId)=>{
    if(!au||!prof)return;
    const saved=prof.saved||{};
    const list=saved[itemType]||[];
    const has=list.includes(itemId);
    const newList=has?list.filter(x=>x!==itemId):[...list,itemId];
    const newSaved={...saved,[itemType]:newList};
    await fbSet("users",au.uid,{saved:newSaved});
    setProf(p=>({...p,saved:newSaved}));
    sh(has?"Removed from saved":"🔖 Saved to your profile");
  };

  // ═══ RSVP for events ═══
  const toggleRsvp=async(ev)=>{
    if(!au)return;
    const attendees=ev.attendees||[];
    const has=attendees.find(a=>a.uid===au.uid);
    const newAttendees=has?attendees.filter(a=>a.uid!==au.uid):[...attendees,{uid:au.uid,name:uName,ini:uIni,photo:uPhoto||"",joined:ds(getIST())}];
    await fbSet("events",ev.id,{attendees:newAttendees});
    setEvents(p=>p.map(x=>x.id===ev.id?{...x,attendees:newAttendees}:x));
    if(selE?.id===ev.id)setSelE(p=>({...p,attendees:newAttendees}));
    sh(has?"RSVP cancelled":"✓ You're going!");
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
  const postCase=async()=>{if(!ccT.trim()){sh("Title required");return}if(!ccImgs.length){sh("Add at least 1 image");return}await fbAdd("cases",{author:uName,ini:uIni,uid:au.uid,photo:uPhoto||"",title:ccT,cat:ccC,body:ccB,history:ccHistory,treatment:ccTreatment,outcome:ccOutcome,diagnosis:ccDiag,images:ccImgs,likedBy:[],likes:0,comments:[],date:ds(getIST())});setCcT("");setCcB("");setCcImgs([]);setCcDiag("");setCcHistory("");setCcTreatment("");setCcOutcome("");setNewCase(false);sh("Case posted!");loadData()};

  // ═══ CASE COMMENT ═══
  const addCaseComment=async(caseId,caseObj,txt)=>{if(!txt.trim())return;const c={n:uName,ini:uIni,txt,tm:getIST().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true}),uid:au.uid,likedBy:[],likes:0};const comments=[...(caseObj.comments||[]),c];await fbSet("cases",caseId,{comments});setCases(p=>p.map(x=>x.id===caseId?{...x,comments}:x))};

  const leaderboard=allUsers.filter(u=>u.totalAnswered>0).sort((a,b)=>{const aA=a.totalAnswered?Math.round(a.totalCorrect/a.totalAnswered*100):0;const bA=b.totalAnswered?Math.round(b.totalCorrect/b.totalAnswered*100):0;return bA-aA||(b.streak||0)-(a.streak||0)}).slice(0,20);

  const W="1400px";const dates=Array.from({length:14},(_,i)=>{let d=new Date(getIST());d.setDate(d.getDate()-(13-i));return ds(d)});
  const qObj=quizzes.find(q=>q.date===selD);const uA=qObj?.answers?.[au?.uid];const isT=selD===today;const rev=!isT||hr>=21;const dd=Math.floor((new Date(today)-new Date(selD))/864e5);const canA=uA===undefined&&(isT||(dd<=3&&dd>0));

  if(scr==="loading")return(<div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui"}}><div style={{textAlign:"center"}}><Logo size={60}/><p style={{color:T.mute,marginTop:12}}>Loading...</p></div></div>);

  // ═══ WELCOME SCREEN (shown once before login — fits screen, click anywhere to enter) ═══
  if(scr==="login"&&!welcomeSeen)return(
    <div onClick={()=>{localStorage.setItem("sk_welcome","1");setWelcomeSeen(true)}} style={{height:"100vh",width:"100vw",background:"#f5ede2",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontFamily:"system-ui",overflow:"hidden",position:"relative"}} title="Click to enter">
      <picture style={{display:"flex",alignItems:"center",justifyContent:"center",width:"100%",height:"100%"}}>
        <source media="(max-width: 768px)" srcSet="/welcome-mobile.png"/>
        <img src="/welcome-desktop.png" alt="Welcome to SKINARIO — click to enter" style={{maxWidth:"100%",maxHeight:"100%",width:"auto",height:"auto",objectFit:"contain",display:"block"}}/>
      </picture>
      <div style={{position:"absolute",bottom:24,right:24,background:"rgba(74,31,61,0.92)",color:"#fff",padding:"10px 22px",borderRadius:999,fontSize:".85rem",fontWeight:600,zIndex:5,pointerEvents:"none",boxShadow:"0 4px 14px rgba(0,0,0,0.2)"}}>👆 Click anywhere to enter</div>
    </div>
  );

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
  const navs=[{id:"home",ic:"🏠",l:"Home"},{id:"quiz",ic:"🧠",l:"Quiz"},{id:"library",ic:"📚",l:"Library"},{id:"videos",ic:"🎥",l:"Videos"},{id:"events",ic:"📅",l:"Events"},{id:"cases",ic:"🔬",l:"Cases"},{id:"forum",ic:"💬",l:"Forum"},{id:"rank",ic:"🏆",l:"Rank"},{id:"me",ic:"👤",l:"Me"},...(isAdm?[{id:"admin",ic:"⚙️",l:"Admin"}]:[])];

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
      {pg==="home"&&!selA&&<div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 360px",gap:20,alignItems:"start"}} className="home-grid">
        <div style={{minWidth:0}}>{/* MAIN COLUMN */}
        <div style={{...T.card,borderLeft:"3px solid "+T.gold,padding:24}}><div style={{display:"flex",alignItems:"center",gap:16,marginBottom:14}}>{uPhoto?<img src={uPhoto} style={{width:52,height:52,borderRadius:"50%",border:"2px solid "+T.teal}}/>:<div style={T.av(52,T.tealBg,T.teal)}>{uIni}</div>}<div><h2 style={{fontSize:"1.4rem",fontWeight:700,margin:0}}>Welcome, {uName.split(" ")[0]} 👋</h2><p style={{color:T.txt2,fontSize:".9rem",marginTop:3}}>Daily quizzes, clinical cases & community.</p></div></div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button onClick={()=>go("quiz")} style={T.btn}>🧠 Today's quiz</button><button onClick={()=>go("events")} style={T.btnO}>📅 Events</button><button onClick={()=>go("cases")} style={T.btnO}>🔬 Clinical cases</button><button onClick={()=>go("forum")} style={T.btnO}>💬 Forum</button></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,margin:"16px 0"}}>
          {[["🧠",totA,"Quizzes"],["✅",acc+"%","Accuracy"],["🔬",cases.length,"Cases"],["📚",resources.length,"PDFs"],["🎥",videos.length,"Videos"]].map(([i,v,l])=>
            <div key={l} style={{...T.card,textAlign:"center",padding:"12px 4px",marginBottom:0}}><div style={{fontSize:"1rem"}}>{i}</div><div style={{fontSize:"1.2rem",fontWeight:700,color:T.teal}}>{v}</div><div style={{fontSize:".55rem",color:T.mute,textTransform:"uppercase",marginTop:2}}>{l}</div></div>)}
        </div>
        <h3 style={{fontSize:"1.05rem",fontWeight:700,marginBottom:12}}>Latest articles</h3>
        {articles.length===0&&<p style={{color:T.mute}}>No articles yet. Admins can create them from Admin panel.</p>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {articles.slice(0,articleLimit).map(a=><div key={a.id} onClick={()=>setSelA(a)} style={{...T.card,cursor:"pointer",marginBottom:0,overflow:"hidden",padding:0,position:"relative"}}>
            {a.cover&&<img src={a.cover} style={{width:"100%",height:140,objectFit:"cover"}}/>}
            {a.sponsored&&<div style={{position:"absolute",top:8,right:8,background:"rgba(168,128,48,0.95)",color:"#fff",padding:"3px 9px",borderRadius:4,fontSize:".58rem",letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,zIndex:2}}>Sponsored</div>}
            <div style={{padding:18}}>
              <div style={{display:"flex",gap:5,marginBottom:8}}><span style={T.tag(T.tealBg,T.teal)}>{a.cat||"General"}</span>{a.feat&&<span style={T.tag(T.goldBg,T.goldD)}>Featured</span>}</div>
              <h4 style={{fontSize:"1rem",fontWeight:700,lineHeight:1.35,fontFamily:"Georgia, serif"}}>{a.title}</h4>
              <p style={{fontSize:".78rem",color:T.txt2,marginTop:6,lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{a.body}</p>
              {/* Byline with author photo — under the article info */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10,paddingTop:10,borderTop:"1px solid "+T.border}}>
                {a.authorPhoto?<img src={a.authorPhoto} style={{width:28,height:28,borderRadius:"50%",objectFit:"cover",border:"1.5px solid "+T.tealBg}}/>:<div style={{...T.av(28,T.tealBg,T.teal),fontSize:".62rem"}}>{(a.author||"?").replace(/^Dr\.?\s*/i,"").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)}</div>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:".74rem",fontWeight:600,color:T.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.sponsored&&a.sponsor?<>by {a.sponsor}</>:a.author||"Admin"}</div>
                  <div style={{fontSize:".66rem",color:T.mute}}>{fD(a.date)}</div>
                </div>
                <div style={{display:"flex",gap:8,fontSize:".7rem",color:T.mute,flexShrink:0}}><span>❤️ {a.likes||0}</span><span>💬 {a.comments?.length||0}</span></div>
              </div>
            </div>
          </div>)}
        </div>
        {articles.length>articleLimit&&<div style={{textAlign:"center",marginTop:18}}>
          <button onClick={()=>setArticleLimit(p=>p+6)} style={{...T.btnO,padding:"11px 28px"}}>Load more articles ({articles.length-articleLimit} remaining) ↓</button>
        </div>}
        </div>{/* END MAIN COLUMN */}

        {/* ═══ RIGHT SIDEBAR ═══ */}
        <aside style={{minWidth:0,display:"flex",flexDirection:"column",gap:14}} className="home-sidebar">

          {/* Saved items widget */}
          {(()=>{
            const items=[];
            (prof?.saved?.articles||[]).forEach(id=>{const a=articles.find(x=>x.id===id);if(a)items.push({icon:"📰",label:a.cat||"Article",title:a.title,onClick:()=>setSelA(a),thumb:a.cover})});
            (prof?.saved?.videos||[]).forEach(id=>{const v=videos.find(x=>x.id===id);if(v)items.push({icon:"🎥",label:"Video",title:v.title||v.t,onClick:()=>{go("videos");setSelV(v)},thumb:null})});
            (prof?.saved?.resources||[]).forEach(id=>{const r=resources.find(x=>x.id===id);if(r)items.push({icon:r.icon||"📚",label:"Resource",title:r.title||r.t,onClick:()=>go("library"),thumb:r.thumb})});
            (prof?.saved?.forum||[]).forEach(id=>{const f=forumPosts.find(x=>x.id===id);if(f)items.push({icon:"💬",label:"Forum",title:f.title,onClick:()=>go("forum"),thumb:null})});
            return(<div style={{...T.card,marginBottom:0,padding:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:items.length?12:0}}>
                <h4 style={{fontSize:".95rem",fontWeight:700,margin:0,display:"flex",alignItems:"center",gap:6}}>🔖 Continue reading</h4>
                {items.length>0&&<span onClick={()=>go("me")} style={{fontSize:".74rem",color:T.teal,cursor:"pointer",fontWeight:500}}>All →</span>}
              </div>
              {items.length===0?<p style={{color:T.mute,fontSize:".82rem",margin:"6px 0 0",lineHeight:1.55}}>Save articles, videos & posts with the 🔖 button to read them later.</p>
              :items.slice(0,5).map((it,i)=><div key={i} onClick={it.onClick} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 0",borderBottom:i<Math.min(items.length,5)-1?"1px solid "+T.border:"none",cursor:"pointer"}}>
                {it.thumb?<img src={it.thumb} style={{width:70,height:70,borderRadius:8,objectFit:"cover",flexShrink:0}}/>:<div style={{width:70,height:70,borderRadius:8,background:"linear-gradient(135deg,"+T.goldBg+","+T.tealBg+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.6rem",flexShrink:0}}>{it.icon}</div>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:".62rem",color:T.gold,textTransform:"uppercase",fontWeight:600,letterSpacing:1,marginBottom:3}}>{it.label}</div>
                  <div style={{fontSize:".88rem",fontWeight:500,lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{it.title}</div>
                </div>
              </div>)}
            </div>)
          })()}

          {/* Sponsored / Ads widget */}
          {(()=>{
            const today=new Date();
            const liveAds=ads.filter(a=>a.active!==false&&(!a.expiry||new Date(a.expiry)>=today));
            if(!liveAds.length)return null;
            // Random selection so users see different ads on each visit
            const showAds=[...liveAds].sort(()=>Math.random()-0.5).slice(0,2);
            return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
              {showAds.map(ad=><div key={ad.id} style={{...T.card,marginBottom:0,padding:0,overflow:"hidden",cursor:"pointer"}} onClick={async()=>{await fbSet("ads",ad.id,{clicks:(ad.clicks||0)+1});if(ad.adType==="internal"){setPg("ad");setSelAd(ad);window.scrollTo(0,0)}else if(ad.url){window.open(ad.url,"_blank")}}}>
                <div style={{position:"relative"}}>
                  {ad.image&&<img src={ad.image} style={{width:"100%",height:200,objectFit:"cover",display:"block"}}/>}
                  <span style={{position:"absolute",top:8,left:8,background:"rgba(0,0,0,0.65)",color:"#fff",padding:"3px 10px",borderRadius:4,fontSize:".62rem",letterSpacing:1.5,textTransform:"uppercase",fontWeight:600}}>Sponsored</span>
                </div>
                <div style={{padding:"14px 18px"}}>
                  {ad.tag&&<div style={{fontSize:".68rem",color:T.gold,textTransform:"uppercase",fontWeight:600,letterSpacing:1,marginBottom:5}}>{ad.tag}</div>}
                  <div style={{fontSize:"1rem",fontWeight:600,lineHeight:1.4,marginBottom:5}}>{ad.title}</div>
                  {ad.desc&&<div style={{fontSize:".82rem",color:T.txt2,lineHeight:1.6}}>{ad.desc}</div>}
                </div>
              </div>)}
            </div>)
          })()}

          {/* Trending discussions widget */}
          {(()=>{
            const sevenDaysAgo=new Date();sevenDaysAgo.setDate(sevenDaysAgo.getDate()-7);
            const trending=[...forumPosts]
              .filter(p=>{try{return new Date(p.date)>=sevenDaysAgo}catch{return false}})
              .sort((a,b)=>(b.likes||0)-(a.likes||0))
              .slice(0,4);
            const display=trending.length?trending:forumPosts.slice(0,4);
            if(!display.length)return null;
            return(<div style={{...T.card,marginBottom:0,padding:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <h4 style={{fontSize:".95rem",fontWeight:700,margin:0,display:"flex",alignItems:"center",gap:6}}>🔥 Trending now</h4>
                <span onClick={()=>go("forum")} style={{fontSize:".74rem",color:T.teal,cursor:"pointer",fontWeight:500}}>All →</span>
              </div>
              {display.map((p,i)=><div key={p.id} onClick={()=>go("forum")} style={{padding:"10px 0",borderBottom:i<display.length-1?"1px solid "+T.border:"none",cursor:"pointer"}}>
                <div style={{fontSize:".62rem",color:T.teal,textTransform:"uppercase",fontWeight:600,letterSpacing:1,marginBottom:4}}>{p.cat||"General"}</div>
                <div style={{fontSize:".88rem",fontWeight:500,lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",marginBottom:5}}>{p.title}</div>
                <div style={{display:"flex",gap:12,fontSize:".72rem",color:T.mute}}><span>❤️ {p.likes||0}</span><span>{p.author?p.author.split(" ")[0]:"User"}</span></div>
              </div>)}
            </div>)
          })()}

          {/* Upcoming events widget */}
          {(()=>{
            const todayStr=ds(getIST());
            const upcoming=events.filter(e=>e.date&&((e.endDate||e.date)>=todayStr)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
            if(!upcoming.length)return null;
            return(<div style={{...T.card,marginBottom:0,padding:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <h4 style={{fontSize:".95rem",fontWeight:700,margin:0,display:"flex",alignItems:"center",gap:6}}>📅 Upcoming events</h4>
                <span onClick={()=>go("events")} style={{fontSize:".74rem",color:T.teal,cursor:"pointer",fontWeight:500}}>All →</span>
              </div>
              {upcoming.map((e,i)=>{const dt=new Date(e.date+"T12:00:00");const day=dt.getDate();const mo=dt.toLocaleDateString("en-IN",{month:"short"}).toUpperCase();const multiDay=e.endDate&&e.endDate!==e.date;const endDay=multiDay?new Date(e.endDate+"T12:00:00").getDate():null;return<div key={e.id} onClick={()=>{setSelE(e);go("events");setSelE(e)}} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 0",borderBottom:i<upcoming.length-1?"1px solid "+T.border:"none",cursor:"pointer"}}>
                <div style={{minWidth:60,height:64,borderRadius:10,background:T.tealBg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0,border:"1px solid "+T.teal+"33"}}>
                  <div style={{fontSize:".62rem",color:T.teal,fontWeight:700,letterSpacing:1}}>{mo}</div>
                  <div style={{fontSize:multiDay?"1rem":"1.5rem",fontWeight:700,color:T.teal,lineHeight:1}}>{multiDay?`${day}-${endDay}`:day}</div>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:".62rem",color:T.gold,textTransform:"uppercase",fontWeight:600,letterSpacing:1,marginBottom:3}}>{e.cat||"Event"}</div>
                  <div style={{fontSize:".88rem",fontWeight:500,lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{e.title}</div>
                  {e.location&&<div style={{fontSize:".72rem",color:T.mute,marginTop:3}}>📍 {e.location}</div>}
                </div>
              </div>})}
            </div>)
          })()}

        </aside>
        {/* ═══ END RIGHT SIDEBAR ═══ */}

        <style>{`
          @media (max-width: 900px) {
            .home-grid { grid-template-columns: 1fr !important; }
            .home-sidebar { order: 2; }
          }
        `}</style>
      </div>}
      {pg==="home"&&selA&&<div>
        <button onClick={()=>setSelA(null)} style={{...T.btnO,...T.btnSm,marginBottom:14}}>← Back</button>
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 360px",gap:20,alignItems:"start"}} className="article-grid">
          <div style={{minWidth:0}}>{/* MAIN ARTICLE COLUMN */}
        <article style={{...T.card,overflow:"hidden",padding:0,background:"#fff",margin:0}}>
          {/* Cover image */}
          {selA.cover&&<img src={selA.cover} style={{width:"100%",maxHeight:380,objectFit:"cover",display:"block"}}/>}

          <div style={{padding:"32px 36px",maxWidth:780,margin:"0 auto"}}>
            {/* Sponsored disclosure banner */}
            {selA.sponsored&&<div style={{background:T.goldBg,border:"1px solid #f0e6c8",borderRadius:8,padding:"10px 14px",marginBottom:18,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              {selA.sponsorLogo&&<img src={selA.sponsorLogo} style={{height:32,maxWidth:90,objectFit:"contain"}}/>}
              <div style={{flex:1,minWidth:140}}>
                <div style={{fontSize:".62rem",color:T.goldD,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:2}}>Sponsored content</div>
                <div style={{fontSize:".82rem",color:T.txt}}>This article is sponsored by {selA.sponsorUrl?<a href={selA.sponsorUrl} target="_blank" rel="noopener noreferrer" style={{color:T.goldD,fontWeight:600,textDecoration:"underline"}}>{selA.sponsor}</a>:<b>{selA.sponsor}</b>}</div>
              </div>
            </div>}

            {/* Category & Featured */}
            <div style={{display:"flex",gap:6,marginBottom:14,alignItems:"center"}}>
              <span style={{...T.tag(T.tealBg,T.teal),fontSize:".68rem",letterSpacing:1.5,textTransform:"uppercase",fontWeight:700}}>{selA.cat||"General"}</span>
              {selA.feat&&<span style={T.tag(T.goldBg,T.goldD)}>★ Featured</span>}
            </div>

            {/* Title — international journal style: serif, large, generous line height */}
            <h1 style={{fontSize:"2rem",fontWeight:700,lineHeight:1.25,marginBottom:14,color:T.txt,fontFamily:"Georgia, 'Times New Roman', serif",letterSpacing:"-0.01em"}}>{selA.title}</h1>

            {/* Subtitle / abstract teaser if exists */}
            {selA.subtitle&&<p style={{fontSize:"1.1rem",color:T.txt2,lineHeight:1.5,fontStyle:"italic",marginBottom:18,fontFamily:"Georgia, serif"}}>{selA.subtitle}</p>}

            {/* AUTHOR BYLINE — journal paper style with profile photo */}
            <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",borderTop:"1px solid "+T.border,borderBottom:"1px solid "+T.border,marginBottom:24}}>
              {selA.authorPhoto?<img src={selA.authorPhoto} alt={selA.author} style={{width:54,height:54,borderRadius:"50%",border:"2px solid "+T.tealBg,objectFit:"cover"}}/>
              :<div style={{...T.av(54,T.tealBg,T.teal),fontSize:"1.1rem",border:"2px solid "+T.tealBg}}>{(selA.author||"?").replace(/^Dr\.?\s*/i,"").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)}</div>}
              <div style={{flex:1}}>
                <div style={{fontSize:".95rem",fontWeight:700,color:T.txt,letterSpacing:".01em"}}>{selA.author||"Unknown Author"}</div>
                {selA.authorAffiliation&&<div style={{fontSize:".78rem",color:T.txt2,marginTop:2,fontStyle:"italic"}}>{selA.authorAffiliation}</div>}
                <div style={{fontSize:".72rem",color:T.mute,marginTop:3,letterSpacing:".5px"}}>Published {fD(selA.date)}</div>
              </div>
            </div>

            {/* ABSTRACT — journal-style boxed abstract if present */}
            {selA.abstract&&<div style={{background:T.bg,borderLeft:"3px solid "+T.gold,padding:"18px 22px",marginBottom:24,borderRadius:"0 8px 8px 0"}}>
              <div style={{fontSize:".7rem",color:T.goldD,fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Abstract</div>
              <p style={{fontSize:".92rem",color:T.txt2,lineHeight:1.75,fontFamily:"Georgia, serif",fontStyle:"italic",margin:0}}>{selA.abstract}</p>
            </div>}

            {/* Article body */}
            <div style={{fontSize:"1.05rem",color:T.txt,lineHeight:1.85,whiteSpace:"pre-wrap",fontFamily:"Georgia, 'Times New Roman', serif"}}>{selA.body}</div>

            {/* References */}
            {selA.refs&&<div style={{marginTop:32,paddingTop:18,borderTop:"1px solid "+T.border}}>
              <div style={{fontSize:".7rem",color:T.teal,fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>References</div>
              <div style={{fontSize:".82rem",color:T.txt2,lineHeight:1.75,whiteSpace:"pre-wrap",fontFamily:"Georgia, serif"}}>{selA.refs}</div>
            </div>}

            {/* Engagement */}
            <div style={{display:"flex",alignItems:"center",gap:12,marginTop:28,paddingTop:18,borderTop:"1px solid "+T.border,flexWrap:"wrap"}}>
              <LikeBtn liked={(selA.likedBy||[]).includes(au?.uid)} count={selA.likes||0} onToggle={()=>{toggleLike("articles",selA.id,selA,setArticles);setSelA(p=>{const lb=p.likedBy||[];const has=lb.includes(au.uid);const nlb=has?lb.filter(u=>u!==au.uid):[...lb,au.uid];return{...p,likedBy:nlb,likes:nlb.length}})}}/>
              <ShareBar title={selA.title} url={`${window.location.origin}/?article=${selA.id}`} description={selA.body?.slice(0,120)} itemId={selA.id} itemType="articles" currentUser={au} prof={prof} onSaveToggle={toggleSave}/>
            </div>

            {/* Author bio block at end (if authorBio present) */}
            {selA.authorBio&&<div style={{marginTop:24,padding:18,background:T.bg,borderRadius:10,display:"flex",gap:14,alignItems:"flex-start"}}>
              {selA.authorPhoto?<img src={selA.authorPhoto} style={{width:48,height:48,borderRadius:"50%",objectFit:"cover",flexShrink:0}}/>:<div style={{...T.av(48,T.tealBg,T.teal),flexShrink:0}}>{(selA.author||"?").replace(/^Dr\.?\s*/i,"").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)}</div>}
              <div>
                <div style={{fontSize:".7rem",color:T.mute,letterSpacing:1.5,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>About the author</div>
                <div style={{fontSize:".88rem",fontWeight:600,color:T.txt,marginBottom:4}}>{selA.author}</div>
                <div style={{fontSize:".82rem",color:T.txt2,lineHeight:1.6}}>{selA.authorBio}</div>
              </div>
            </div>}

            <CommentThread collection="articles" itemId={selA.id} item={selA} currentUser={au} uName={uName} uIni={uIni} onUpdate={(id,comments)=>{setArticles(p=>p.map(x=>x.id===id?{...x,comments}:x));setSelA(p=>({...p,comments}))}}/>
          </div>
        </article>
          </div>{/* END MAIN ARTICLE COLUMN */}

          {/* ═══ ARTICLE PAGE SIDEBAR ═══ */}
          <aside style={{minWidth:0,display:"flex",flexDirection:"column",gap:14,position:"sticky",top:80}} className="article-sidebar">

            {/* Related articles widget */}
            {(()=>{
              const others=articles.filter(a=>a.id!==selA.id);
              const sameCategory=others.filter(a=>a.cat===selA.cat).sort((a,b)=>(b.likes||0)-(a.likes||0))[0];
              const popular=others.filter(a=>a.id!==sameCategory?.id).sort((a,b)=>(b.likes||0)-(a.likes||0))[0];
              const recent=others.filter(a=>a.id!==sameCategory?.id&&a.id!==popular?.id).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
              const related=[sameCategory,popular,recent].filter(Boolean);
              if(!related.length)return null;
              const labels=["More in "+(selA.cat||"this topic"),"Popular","Recent"];
              return(<div style={{...T.card,marginBottom:0,padding:18}}>
                <h4 style={{fontSize:".95rem",fontWeight:700,margin:"0 0 14px",display:"flex",alignItems:"center",gap:6}}>📰 Related reading</h4>
                {related.map((a,i)=><div key={a.id} onClick={()=>{setSelA(a);window.scrollTo(0,0)}} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"12px 0",borderBottom:i<related.length-1?"1px solid "+T.border:"none",cursor:"pointer"}}>
                  {a.cover?<img src={a.cover} style={{width:90,height:90,objectFit:"cover",borderRadius:8,flexShrink:0}}/>:<div style={{width:90,height:90,borderRadius:8,background:"linear-gradient(135deg,"+T.tealBg+","+T.goldBg+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.8rem",flexShrink:0}}>📰</div>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:".62rem",color:T.gold,textTransform:"uppercase",fontWeight:600,letterSpacing:1,marginBottom:4}}>{labels[i]}</div>
                    <div style={{fontSize:".92rem",fontWeight:600,lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden",fontFamily:"Georgia, serif",marginBottom:5}}>{a.title}</div>
                    <div style={{fontSize:".7rem",color:T.mute,display:"flex",gap:10}}><span>❤️ {a.likes||0}</span><span>💬 {a.comments?.length||0}</span></div>
                  </div>
                </div>)}
              </div>)
            })()}

            {/* Saved items widget */}
            {(()=>{
              const items=[];
              (prof?.saved?.articles||[]).forEach(id=>{const a=articles.find(x=>x.id===id);if(a&&a.id!==selA.id)items.push({icon:"📰",label:a.cat||"Article",title:a.title,onClick:()=>{setSelA(a);window.scrollTo(0,0)},thumb:a.cover})});
              (prof?.saved?.videos||[]).forEach(id=>{const v=videos.find(x=>x.id===id);if(v)items.push({icon:"🎥",label:"Video",title:v.title||v.t,onClick:()=>{go("videos");setSelV(v)},thumb:null})});
              (prof?.saved?.resources||[]).forEach(id=>{const r=resources.find(x=>x.id===id);if(r)items.push({icon:r.icon||"📚",label:"Resource",title:r.title||r.t,onClick:()=>go("library"),thumb:r.thumb})});
              if(!items.length)return null;
              return(<div style={{...T.card,marginBottom:0,padding:18}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <h4 style={{fontSize:".95rem",fontWeight:700,margin:0,display:"flex",alignItems:"center",gap:6}}>🔖 Continue reading</h4>
                  <span onClick={()=>go("me")} style={{fontSize:".74rem",color:T.teal,cursor:"pointer",fontWeight:500}}>All →</span>
                </div>
                {items.slice(0,4).map((it,i)=><div key={i} onClick={it.onClick} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 0",borderBottom:i<Math.min(items.length,4)-1?"1px solid "+T.border:"none",cursor:"pointer"}}>
                  {it.thumb?<img src={it.thumb} style={{width:70,height:70,borderRadius:8,objectFit:"cover",flexShrink:0}}/>:<div style={{width:70,height:70,borderRadius:8,background:"linear-gradient(135deg,"+T.goldBg+","+T.tealBg+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.6rem",flexShrink:0}}>{it.icon}</div>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:".62rem",color:T.gold,textTransform:"uppercase",fontWeight:600,letterSpacing:1,marginBottom:3}}>{it.label}</div>
                    <div style={{fontSize:".88rem",fontWeight:500,lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{it.title}</div>
                  </div>
                </div>)}
              </div>)
            })()}

            {/* Upcoming events widget */}
            {(()=>{
              const todayStr=ds(getIST());
              const upcoming=events.filter(e=>e.date&&((e.endDate||e.date)>=todayStr)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
              if(!upcoming.length)return null;
              return(<div style={{...T.card,marginBottom:0,padding:18}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <h4 style={{fontSize:".95rem",fontWeight:700,margin:0,display:"flex",alignItems:"center",gap:6}}>📅 Upcoming events</h4>
                  <span onClick={()=>go("events")} style={{fontSize:".74rem",color:T.teal,cursor:"pointer",fontWeight:500}}>All →</span>
                </div>
                {upcoming.map((e,i)=>{const dt=new Date(e.date+"T12:00:00");const day=dt.getDate();const mo=dt.toLocaleDateString("en-IN",{month:"short"}).toUpperCase();const multiDay=e.endDate&&e.endDate!==e.date;const endDay=multiDay?new Date(e.endDate+"T12:00:00").getDate():null;return<div key={e.id} onClick={()=>{setSelE(e);go("events");setSelE(e)}} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 0",borderBottom:i<upcoming.length-1?"1px solid "+T.border:"none",cursor:"pointer"}}>
                  <div style={{minWidth:60,height:64,borderRadius:10,background:T.tealBg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0,border:"1px solid "+T.teal+"33"}}>
                    <div style={{fontSize:".62rem",color:T.teal,fontWeight:700,letterSpacing:1}}>{mo}</div>
                    <div style={{fontSize:multiDay?"1rem":"1.5rem",fontWeight:700,color:T.teal,lineHeight:1}}>{multiDay?`${day}-${endDay}`:day}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:".62rem",color:T.gold,textTransform:"uppercase",fontWeight:600,letterSpacing:1,marginBottom:3}}>{e.cat||"Event"}</div>
                    <div style={{fontSize:".88rem",fontWeight:500,lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{e.title}</div>
                    {e.location&&<div style={{fontSize:".72rem",color:T.mute,marginTop:3}}>📍 {e.location}</div>}
                  </div>
                </div>})}
              </div>)
            })()}

            {/* Sponsored ads widget */}
            {(()=>{
              const today=new Date();
              const liveAds=ads.filter(a=>a.active!==false&&(!a.expiry||new Date(a.expiry)>=today));
              if(!liveAds.length)return null;
              const showAds=[...liveAds].sort(()=>Math.random()-0.5).slice(0,1);
              return(<div style={{display:"flex",flexDirection:"column",gap:10}}>
                {showAds.map(ad=><div key={ad.id} style={{...T.card,marginBottom:0,padding:0,overflow:"hidden",cursor:"pointer"}} onClick={async()=>{await fbSet("ads",ad.id,{clicks:(ad.clicks||0)+1});if(ad.adType==="internal"){setPg("ad");setSelAd(ad);window.scrollTo(0,0)}else if(ad.url){window.open(ad.url,"_blank")}}}>
                  <div style={{position:"relative"}}>
                    {ad.image&&<img src={ad.image} style={{width:"100%",height:200,objectFit:"cover",display:"block"}}/>}
                    <span style={{position:"absolute",top:8,left:8,background:"rgba(0,0,0,0.65)",color:"#fff",padding:"3px 10px",borderRadius:4,fontSize:".62rem",letterSpacing:1.5,textTransform:"uppercase",fontWeight:600}}>Sponsored</span>
                  </div>
                  <div style={{padding:"14px 18px"}}>
                    {ad.tag&&<div style={{fontSize:".68rem",color:T.gold,textTransform:"uppercase",fontWeight:600,letterSpacing:1,marginBottom:5}}>{ad.tag}</div>}
                    <div style={{fontSize:"1rem",fontWeight:600,lineHeight:1.4,marginBottom:5}}>{ad.title}</div>
                    {ad.desc&&<div style={{fontSize:".82rem",color:T.txt2,lineHeight:1.6}}>{ad.desc}</div>}
                  </div>
                </div>)}
              </div>)
            })()}

          </aside>
          {/* ═══ END SIDEBAR ═══ */}

          <style>{`
            @media (max-width: 900px) {
              .article-grid { grid-template-columns: 1fr !important; }
              .article-sidebar { position: static !important; }
            }
          `}</style>
        </div>
      </div>}

      {/* QUIZ */}
      {pg==="quiz"&&<div>
        <div style={{display:"flex",gap:6,overflowX:"auto",padding:"4px 0 14px"}}>{dates.map(d=>{const dt=new Date(d+"T12:00:00");const sun=dt.getDay()===0;const on=d===selD;return<div key={d} onClick={()=>!sun&&setSelD(d)} style={{minWidth:52,padding:"8px 4px",textAlign:"center",borderRadius:10,border:`1.5px solid ${on?T.teal:T.border}`,cursor:sun?"not-allowed":"pointer",background:on?T.tealBg:"#fff",opacity:sun?.3:1}}><div style={{fontSize:".58rem",color:on?T.teal:T.mute,textTransform:"uppercase",fontWeight:on?600:400}}>{dN(d)}</div><div style={{fontSize:"1rem",fontWeight:700,color:on?T.teal:T.txt}}>{dt.getDate()}</div></div>})}</div>
        {ld&&<div style={{...T.card,textAlign:"center",padding:50}}><p style={{color:T.mute}}>⏳ Generating...</p></div>}
        {!ld&&!qObj&&<div style={{...T.card,textAlign:"center",padding:40}}>{selD===today?<><div style={{fontSize:"2rem",marginBottom:10}}>🔬</div><p style={{color:T.teal,fontWeight:600}}>Today's question</p><p style={{color:T.mute,fontSize:".88rem",margin:"8px 0 16px"}}>10 AM IST daily</p>{isAdm&&<button onClick={genQuiz} style={T.btn}>🤖 Generate now</button>}</>:<p style={{color:T.mute}}>No question for this date</p>}</div>}
        {!ld&&qObj&&<div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:16,alignItems:"start"}}>
          <div style={{...T.card,borderLeft:"3px solid "+T.teal,padding:0,overflow:"hidden"}}>
            {/* Sponsored quiz banner */}
            {qObj.sponsored&&qObj.sponsor&&<div style={{background:"linear-gradient(135deg,"+T.goldBg+","+T.tealBg+")",borderBottom:"1px solid "+T.border,padding:"10px 18px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              {qObj.sponsorLogo&&<img src={qObj.sponsorLogo} style={{height:32,maxWidth:90,objectFit:"contain"}}/>}
              <div style={{flex:1,minWidth:140}}>
                <div style={{fontSize:".62rem",color:T.goldD,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:1}}>Today's quiz powered by</div>
                <div style={{fontSize:".88rem",color:T.txt,fontWeight:600}}>{qObj.sponsorUrl?<a href={qObj.sponsorUrl} target="_blank" rel="noopener noreferrer" style={{color:T.txt,textDecoration:"none"}}>{qObj.sponsor} →</a>:qObj.sponsor}</div>
              </div>
            </div>}
            <div style={{padding:20}}>
            <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}><span style={{fontSize:".8rem",color:T.mute}}>📅 {fD(qObj.date)}</span>{isT&&hr<21&&<span style={T.tag(T.okBg,T.ok)}>● LIVE</span>}{rev&&!isT&&<span style={T.tag(T.errBg,T.err)}>Closed</span>}<span style={{fontSize:".72rem",color:T.mute,marginLeft:"auto"}}>{Object.keys(qObj.answers||{}).length} answered</span></div>
            <div style={{display:"flex",gap:6,marginBottom:12}}><span style={T.tag(T.tealBg,T.teal)}>{qObj.cat}</span><span style={T.tag(T.warnBg,T.warn)}>{qObj.diff}</span></div>
            {qObj.scen&&<div style={{background:T.bg,borderLeft:"3px solid "+T.gold,padding:"12px 16px",marginBottom:16,borderRadius:"0 10px 10px 0",fontSize:".9rem",color:T.txt2,lineHeight:1.65}}>{qObj.scen}</div>}
            <div style={{fontSize:"1.1rem",fontWeight:600,lineHeight:1.6,marginBottom:16}}>{qObj.question}</div>
            {qObj.opts.map((o,i)=>{const l="ABC"[i];const sr=uA!==undefined||(rev&&!canA);const co=sr&&i===qObj.ci;const wr=sr&&i===uA&&uA!==qObj.ci;
              return<div key={i} onClick={()=>canA&&submitAnswer(qObj.id,qObj,i)} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px 16px",background:co?T.okBg:wr?T.errBg:"#fff",border:`1.5px solid ${co?"#1a7d42":wr?"#c0392b":T.border}`,borderRadius:12,marginBottom:10,cursor:canA?"pointer":"default",opacity:!canA&&!sr?.5:1}}><div style={{...T.av(28,co?"#1a7d42":wr?"#c0392b":T.tealBg,co||wr?"#fff":T.teal),fontSize:".78rem",flexShrink:0}}>{l}</div><div style={{fontSize:".92rem",lineHeight:1.55}}>{o}</div></div>})}
            {uA!==undefined&&<p style={{color:uA===qObj.ci?T.ok:T.err,fontWeight:600,marginTop:10}}>{uA===qObj.ci?"✓ Correct!":"✗ Incorrect."}</p>}
            {((uA!==undefined&&rev)||(!canA&&rev&&dd>0))&&qObj.expl&&<div style={{background:T.goldBg,border:"1px solid #f0e6c8",borderRadius:12,padding:16,marginTop:12}}><div style={{color:T.goldD,fontWeight:700,marginBottom:8}}>💡 Explanation</div><div style={{fontSize:".88rem",color:T.txt2,lineHeight:1.75}} dangerouslySetInnerHTML={{__html:qObj.expl}}/></div>}
            <div style={{display:"flex",alignItems:"center",gap:12,marginTop:14,paddingTop:12,borderTop:"1px solid "+T.border,flexWrap:"wrap"}}>
              <LikeBtn liked={(qObj.likedBy||[]).includes(au?.uid)} count={qObj.likes||0} onToggle={()=>toggleLike("quizzes",qObj.id,qObj,setQuizzes)}/>
              <ShareBar title={`SKINARIO Daily Quiz: ${qObj.cat} (${qObj.diff})`} url={`${window.location.origin}/?quiz=${qObj.id}`} description={qObj.question?.slice(0,120)} itemId={qObj.id} itemType="quizzes" currentUser={au} prof={prof} onSaveToggle={toggleSave}/>
            </div>
            </div>
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(380px,1fr))",gap:14}}>
          {resources.map(r=><div key={r.id} style={{...T.card,marginBottom:0}}>
            <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
              {r.thumb?<img src={r.thumb} style={{width:60,height:60,borderRadius:8,objectFit:"cover"}}/>:<div style={{fontSize:"2rem"}}>{r.icon||"📄"}</div>}
              <div style={{flex:1}}>
                <h4 style={{fontSize:".9rem",fontWeight:600,lineHeight:1.3}}>{r.title||r.t}</h4>
                <div style={{fontSize:".72rem",color:T.mute,marginTop:3}}>{r.pages?r.pages+"p · ":""}{r.size||""}</div>
                <div style={{marginTop:6}}>{r.free||isPd?<button onClick={()=>r.url?window.open(r.url,"_blank"):sh("No URL")} style={{...T.btn,...T.btnSm}}>📥 Download</button>:<button style={{...T.btnO,...T.btnSm,color:T.gold,borderColor:T.gold}}>🔒 Premium</button>}</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginTop:12,paddingTop:12,borderTop:"1px solid "+T.border,flexWrap:"wrap"}}>
              <LikeBtn liked={(r.likedBy||[]).includes(au?.uid)} count={r.likes||0} onToggle={()=>toggleLike("resources",r.id,r,setResources)}/>
              <span style={{fontSize:".75rem",color:T.mute}}>💬 {r.comments?.length||0}</span>
              {r.url&&<ShareBar title={r.title||r.t} url={r.url} description={`Resource from SKINARIO: ${r.title||r.t}`} itemId={r.id} itemType="resources" currentUser={au} prof={prof} onSaveToggle={toggleSave}/>}
            </div>
            <CommentThread collection="resources" itemId={r.id} item={r} currentUser={au} uName={uName} uIni={uIni} onUpdate={(id,comments)=>setResources(p=>p.map(x=>x.id===id?{...x,comments}:x))}/>
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
            <div style={{display:"flex",gap:10,marginTop:8,fontSize:".7rem",color:T.mute}}><span>❤️ {v.likes||0}</span><span>💬 {v.comments?.length||0}</span></div>
          </div>)}
        </div></div>}
      {pg==="videos"&&selV&&<div><button onClick={()=>setSelV(null)} style={{...T.btnO,...T.btnSm,marginBottom:14}}>← Back</button>
        <div style={{...T.card,maxWidth:720}}>{selV.embedUrl&&(selV.free||isPd)?<div style={{position:"relative",paddingBottom:"56.25%",height:0,borderRadius:12,overflow:"hidden",marginBottom:16}}><iframe src={selV.embedUrl} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:0}} allowFullScreen/></div>:<div style={{height:200,borderRadius:12,background:"linear-gradient(135deg,#e1f5ee,#c8ebe0)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>{selV.free||isPd?<p style={{color:T.teal}}>▶️ {selV.embedUrl?"Loading":"No URL set"}</p>:<div style={{textAlign:"center"}}><p style={{color:T.teal,fontWeight:600}}>🔒 Premium</p><button style={{...T.btnGold,marginTop:8}}>₹999/mo</button></div>}</div>}
          <h3 style={{fontWeight:700,fontSize:"1.2rem"}}>{selV.title||selV.t}</h3><p style={{color:T.mute,fontSize:".82rem",marginTop:4}}>{selV.dur}</p><p style={{color:T.txt2,marginTop:12,lineHeight:1.8}}>{selV.desc}</p>
          <div style={{display:"flex",alignItems:"center",gap:12,marginTop:16,paddingTop:14,borderTop:"1px solid "+T.border,flexWrap:"wrap"}}>
            <LikeBtn liked={(selV.likedBy||[]).includes(au?.uid)} count={selV.likes||0} onToggle={()=>{toggleLike("videos",selV.id,selV,setVideos);setSelV(p=>{const lb=p.likedBy||[];const has=lb.includes(au.uid);const nlb=has?lb.filter(u=>u!==au.uid):[...lb,au.uid];return{...p,likedBy:nlb,likes:nlb.length}})}}/>
            <ShareBar title={selV.title||selV.t} url={`${window.location.origin}/?video=${selV.id}`} description={selV.desc?.slice(0,120)} itemId={selV.id} itemType="videos" currentUser={au} prof={prof} onSaveToggle={toggleSave}/>
          </div>
          <CommentThread collection="videos" itemId={selV.id} item={selV} currentUser={au} uName={uName} uIni={uIni} onUpdate={(id,comments)=>{setVideos(p=>p.map(x=>x.id===id?{...x,comments}:x));setSelV(p=>({...p,comments}))}}/>
        </div>
      </div>}

      {/* ═══ AD DETAIL PAGE (internal-type ads) ═══ */}
      {pg==="ad"&&selAd&&<div>
        <button onClick={()=>{setSelAd(null);go("home")}} style={{...T.btnO,...T.btnSm,marginBottom:14}}>← Back</button>
        <div style={{...T.card,maxWidth:760,padding:0,overflow:"hidden"}}>
          {selAd.image&&<img src={selAd.image} style={{width:"100%",maxHeight:340,objectFit:"cover",display:"block"}}/>}
          <div style={{padding:24}}>
            <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center"}}>
              <span style={{background:"rgba(0,0,0,0.55)",color:"#fff",padding:"3px 10px",borderRadius:4,fontSize:".62rem",letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>Sponsored</span>
              {selAd.tag&&<span style={T.tag(T.goldBg,T.goldD)}>{selAd.tag}</span>}
            </div>
            <h2 style={{fontSize:"1.6rem",fontWeight:700,marginBottom:6,lineHeight:1.3}}>{selAd.title}</h2>
            {selAd.desc&&<p style={{fontSize:".95rem",color:T.txt2,lineHeight:1.6,marginBottom:14}}>{selAd.desc}</p>}
            {selAd.body&&<div style={{fontSize:".95rem",color:T.txt2,lineHeight:1.8,whiteSpace:"pre-wrap",marginBottom:18}}>{selAd.body}</div>}
            {selAd.gallery?.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10,marginBottom:18}}>
              {selAd.gallery.map((url,i)=><img key={i} src={url} style={{width:"100%",height:140,objectFit:"cover",borderRadius:8}}/>)}
            </div>}
            {selAd.video&&<div style={{position:"relative",paddingBottom:"56.25%",height:0,borderRadius:12,overflow:"hidden",marginBottom:18}}><iframe src={selAd.video} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:0}} allowFullScreen/></div>}
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:8}}>
              {selAd.url&&<a href={selAd.url} target="_blank" rel="noopener noreferrer" style={{...T.btn,display:"inline-block",textDecoration:"none"}} onClick={async()=>{await fbSet("ads",selAd.id,{visits:(selAd.visits||0)+1})}}>{selAd.cta||"Visit website"} →</a>}
              {selAd.brochure&&<a href={selAd.brochure} target="_blank" rel="noopener noreferrer" style={{...T.btnO,display:"inline-block",textDecoration:"none"}}>📄 Download brochure</a>}
            </div>
            {selAd.contact&&<div style={{marginTop:18,padding:14,background:T.bg,borderRadius:10,fontSize:".85rem",color:T.txt2}}><b style={{color:T.txt}}>Contact:</b> {selAd.contact}</div>}
            <div style={{display:"flex",alignItems:"center",gap:12,marginTop:18,paddingTop:14,borderTop:"1px solid "+T.border,flexWrap:"wrap"}}>
              <LikeBtn liked={(selAd.likedBy||[]).includes(au?.uid)} count={selAd.likes||0} onToggle={()=>{toggleLike("ads",selAd.id,selAd,setAds);setSelAd(p=>{const lb=p.likedBy||[];const has=lb.includes(au.uid);const nlb=has?lb.filter(u=>u!==au.uid):[...lb,au.uid];return{...p,likedBy:nlb,likes:nlb.length}})}}/>
              <ShareBar title={selAd.title} url={`${window.location.origin}/?ad=${selAd.id}`} description={selAd.desc?.slice(0,120)} itemId={selAd.id} itemType="ads" currentUser={au} prof={prof} onSaveToggle={toggleSave}/>
            </div>
          </div>
        </div>
      </div>}

      {/* ═══ EVENTS PAGE ═══ */}
      {pg==="events"&&!selE&&(()=>{
        const todayStr=ds(getIST());
        const upcoming=events.filter(e=>e.date&&((e.endDate||e.date)>=todayStr)).sort((a,b)=>a.date.localeCompare(b.date));
        const past=events.filter(e=>e.date&&(e.endDate||e.date)<todayStr).sort((a,b)=>b.date.localeCompare(a.date));
        const evTab=aTab.startsWith("ev_")?aTab.replace("ev_",""):"upcoming";
        const list=evTab==="upcoming"?upcoming:evTab==="past"?past:upcoming;
        return(<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
            <div><h3 style={{fontSize:"1.3rem",fontWeight:700,margin:0}}>📅 Events</h3><p style={{color:T.mute,fontSize:".85rem",marginTop:3}}>Conferences, workshops, webinars & masterclasses</p></div>
            {isAdm&&<button onClick={()=>{setATab("events");go("admin")}} style={T.btnO}>⚙️ Manage events</button>}
          </div>
          <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
            {[["upcoming","Upcoming",upcoming.length],["past","Past events",past.length]].map(([id,l,n])=><button key={id} onClick={()=>setATab("ev_"+id)} style={{padding:"7px 14px",borderRadius:10,border:`1.5px solid ${evTab===id?T.teal:T.border}`,background:evTab===id?T.tealBg:"#fff",color:evTab===id?T.teal:T.mute,cursor:"pointer",fontSize:".82rem",fontWeight:evTab===id?600:400,fontFamily:"inherit"}}>{l} ({n})</button>)}
          </div>
          {list.length===0&&<div style={{...T.card,textAlign:"center",padding:40}}><div style={{fontSize:"2rem",marginBottom:8}}>📅</div><p style={{color:T.mute}}>{evTab==="upcoming"?"No upcoming events. Check back soon!":"No past events yet."}</p></div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
            {list.map(e=>{const dt=new Date(e.date+"T12:00:00");const day=dt.getDate();const mo=dt.toLocaleDateString("en-IN",{month:"short"}).toUpperCase();const isPast=e.date<todayStr;const attending=(e.attendees||[]).find(a=>a.uid===au?.uid);const multiDay=e.endDate&&e.endDate!==e.date;const endDt=multiDay?new Date(e.endDate+"T12:00:00"):null;const endDay=multiDay?endDt.getDate():null;const endMo=multiDay?endDt.toLocaleDateString("en-IN",{month:"short"}).toUpperCase():null;const sameMonth=multiDay&&dt.getMonth()===endDt.getMonth();
              return<div key={e.id} onClick={()=>setSelE(e)} style={{...T.card,cursor:"pointer",marginBottom:0,padding:0,overflow:"hidden",opacity:isPast?.85:1}}>
                {e.banner?<img src={e.banner} style={{width:"100%",height:140,objectFit:"cover"}}/>:<div style={{height:140,background:"linear-gradient(135deg,"+T.tealBg+","+T.goldBg+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"3rem"}}>📅</div>}
                <div style={{padding:16}}>
                  <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8}}>
                    {multiDay?<div style={{minWidth:78,padding:"6px 8px",borderRadius:8,background:T.tealBg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:"1px solid "+T.teal+"33"}}>
                      {sameMonth?<>
                        <div style={{fontSize:".55rem",color:T.teal,fontWeight:700,letterSpacing:1}}>{mo}</div>
                        <div style={{fontSize:"1rem",fontWeight:700,color:T.teal,lineHeight:1.1}}>{day}–{endDay}</div>
                      </>:<>
                        <div style={{fontSize:".75rem",fontWeight:700,color:T.teal,lineHeight:1.1}}>{mo} {day}</div>
                        <div style={{fontSize:".55rem",color:T.mute,letterSpacing:1,margin:"1px 0"}}>TO</div>
                        <div style={{fontSize:".75rem",fontWeight:700,color:T.teal,lineHeight:1.1}}>{endMo} {endDay}</div>
                      </>}
                    </div>:<div style={{minWidth:50,height:54,borderRadius:8,background:T.tealBg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:"1px solid "+T.teal+"33"}}>
                      <div style={{fontSize:".58rem",color:T.teal,fontWeight:700,letterSpacing:1}}>{mo}</div>
                      <div style={{fontSize:"1.3rem",fontWeight:700,color:T.teal,lineHeight:1}}>{day}</div>
                    </div>}
                    <div style={{flex:1,minWidth:0}}>
                      <span style={T.tag(T.goldBg,T.goldD)}>{e.cat||"Event"}</span>
                      <h4 style={{fontSize:"1rem",fontWeight:600,marginTop:6,lineHeight:1.35}}>{e.title}</h4>
                    </div>
                  </div>
                  <div style={{fontSize:".78rem",color:T.txt2,lineHeight:1.6}}>
                    {e.time&&<div>🕐 {e.time}</div>}
                    {e.location&&<div>📍 {e.location}</div>}
                    {e.attendees?.length>0&&<div style={{marginTop:6,color:T.teal,fontWeight:500}}>👥 {e.attendees.length} attending{attending?" · You're going":""}</div>}
                  </div>
                  {e.sponsor&&<div style={{display:"flex",alignItems:"center",gap:8,marginTop:10,paddingTop:10,borderTop:"1px dashed "+T.border}}>
                    {e.sponsorLogo&&<img src={e.sponsorLogo} style={{height:24,maxWidth:60,objectFit:"contain"}}/>}
                    <span style={{fontSize:".68rem",color:T.mute}}>Sponsored by <b style={{color:T.txt2}}>{e.sponsor}</b></span>
                  </div>}
                </div>
              </div>})}
          </div>
        </div>);
      })()}

      {/* ═══ EVENT DETAIL ═══ */}
      {pg==="events"&&selE&&(()=>{
        const dt=new Date(selE.date+"T12:00:00");const day=dt.getDate();const mo=dt.toLocaleDateString("en-IN",{month:"long"});const wd=dt.toLocaleDateString("en-IN",{weekday:"long"});
        const isPast=(selE.endDate||selE.date)<ds(getIST());
        const attending=(selE.attendees||[]).find(a=>a.uid===au?.uid);
        return(<div>
          <button onClick={()=>setSelE(null)} style={{...T.btnO,...T.btnSm,marginBottom:14}}>← Back to events</button>
          <div style={{...T.card,maxWidth:760,padding:0,overflow:"hidden"}}>
            {selE.banner&&<img src={selE.banner} style={{width:"100%",maxHeight:340,objectFit:"cover",display:"block"}}/>}
            <div style={{padding:24}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
                <span style={T.tag(T.goldBg,T.goldD)}>{selE.cat||"Event"}</span>
                {isPast&&<span style={T.tag(T.errBg,T.err)}>Past event</span>}
              </div>
              <h2 style={{fontSize:"1.6rem",fontWeight:700,marginBottom:14,lineHeight:1.3}}>{selE.title}</h2>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,padding:14,background:T.bg,borderRadius:10,marginBottom:18}}>
                <div><div style={{fontSize:".68rem",color:T.mute,textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>Date</div><div style={{fontSize:".88rem",fontWeight:600}}>{selE.endDate&&selE.endDate!==selE.date?fDateRange(selE.date,selE.endDate):`${wd}, ${mo} ${day}`}</div></div>
                {selE.time&&<div><div style={{fontSize:".68rem",color:T.mute,textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>Time</div><div style={{fontSize:".88rem",fontWeight:600}}>{selE.time}</div></div>}
                {selE.location&&<div><div style={{fontSize:".68rem",color:T.mute,textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>Location</div><div style={{fontSize:".88rem",fontWeight:600}}>{selE.location}</div></div>}
                {selE.organizer&&<div><div style={{fontSize:".68rem",color:T.mute,textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>Organizer</div><div style={{fontSize:".88rem",fontWeight:600}}>{selE.organizer}</div></div>}
              </div>
              {selE.body&&<div style={{fontSize:".95rem",color:T.txt2,lineHeight:1.8,whiteSpace:"pre-wrap",marginBottom:18}}>{selE.body}</div>}
              {selE.speakers&&<div style={{marginBottom:18}}><div style={{fontSize:".82rem",color:T.teal,fontWeight:600,marginBottom:6}}>Speakers</div><div style={{fontSize:".9rem",color:T.txt2,lineHeight:1.7}}>{selE.speakers}</div></div>}
              {selE.sponsor&&<div style={{display:"flex",alignItems:"center",gap:14,padding:14,background:T.goldBg,borderRadius:10,marginBottom:18,border:"1px solid #f0e6c8"}}>
                {selE.sponsorLogo&&<img src={selE.sponsorLogo} style={{height:40,maxWidth:120,objectFit:"contain"}}/>}
                <div><div style={{fontSize:".7rem",color:T.goldD,letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>Sponsored by</div><div style={{fontSize:"1rem",fontWeight:600,color:T.txt}}>{selE.sponsor}</div></div>
              </div>}

              {/* Registration */}
              {!isPast&&<div style={{padding:16,background:T.tealBg,borderRadius:12,marginBottom:14}}>
                {selE.regType==="external"&&selE.regUrl?<>
                  <p style={{fontSize:".88rem",color:T.teal,marginBottom:10,fontWeight:500}}>Registration via partner site:</p>
                  <a href={selE.regUrl} target="_blank" rel="noopener noreferrer" style={{...T.btn,display:"inline-block",textDecoration:"none"}}>{selE.regCta||"Register now"} →</a>
                </>:<>
                  <p style={{fontSize:".88rem",color:T.teal,marginBottom:10,fontWeight:500}}>{attending?"You're registered for this event!":"Will you attend?"}</p>
                  <button onClick={()=>toggleRsvp(selE)} style={attending?{...T.btnO,color:T.err,borderColor:"#f0c0c0"}:T.btn}>{attending?"✓ Cancel RSVP":"📌 I'll attend"}</button>
                </>}
              </div>}

              {/* Attendees */}
              {selE.attendees?.length>0&&<div style={{marginBottom:14}}>
                <div style={{fontSize:".82rem",color:T.teal,fontWeight:600,marginBottom:8}}>👥 {selE.attendees.length} attending</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {selE.attendees.slice(0,12).map((a,i)=>a.photo?<img key={i} src={a.photo} title={a.name} style={{width:32,height:32,borderRadius:"50%",border:"2px solid "+T.tealBg}}/>:<div key={i} title={a.name} style={T.av(32,T.tealBg,T.teal)}>{a.ini}</div>)}
                  {selE.attendees.length>12&&<div style={{...T.av(32,T.bg,T.mute),fontSize:".7rem"}}>+{selE.attendees.length-12}</div>}
                </div>
              </div>}

              {/* Like + share */}
              <div style={{display:"flex",alignItems:"center",gap:12,marginTop:18,paddingTop:14,borderTop:"1px solid "+T.border,flexWrap:"wrap"}}>
                <LikeBtn liked={(selE.likedBy||[]).includes(au?.uid)} count={selE.likes||0} onToggle={()=>{toggleLike("events",selE.id,selE,setEvents);setSelE(p=>{const lb=p.likedBy||[];const has=lb.includes(au.uid);const nlb=has?lb.filter(u=>u!==au.uid):[...lb,au.uid];return{...p,likedBy:nlb,likes:nlb.length}})}}/>
                <ShareBar title={selE.title} url={`${window.location.origin}/?event=${selE.id}`} description={selE.body?.slice(0,120)} itemId={selE.id} itemType="events" currentUser={au} prof={prof} onSaveToggle={toggleSave}/>
              </div>
              <CommentThread collection="events" itemId={selE.id} item={selE} currentUser={au} uName={uName} uIni={uIni} onUpdate={(id,comments)=>{setEvents(p=>p.map(x=>x.id===id?{...x,comments}:x));setSelE(p=>({...p,comments}))}}/>
            </div>
          </div>
        </div>);
      })()}

      {/* ═══ CLINICAL CASES ═══ */}
      {pg==="cases"&&<div>
        {/* Header with prominent CTA */}
        <div style={{...T.card,padding:24,background:"linear-gradient(135deg,#fff,"+T.goldBg+"77)",borderLeft:"3px solid "+T.gold,marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:14}}>
            <div>
              <h3 style={{fontSize:"1.4rem",fontWeight:700,margin:0}}>🔬 Clinical Cases</h3>
              <p style={{color:T.txt2,fontSize:".88rem",marginTop:6,maxWidth:560}}>Share interesting cases with images for peer discussion. Get insights from colleagues across India.</p>
              <div style={{display:"flex",gap:14,marginTop:10,fontSize:".75rem",color:T.mute}}>
                <span><b style={{color:T.teal,fontSize:".9rem"}}>{cases.length}</b> cases shared</span>
                <span><b style={{color:T.teal,fontSize:".9rem"}}>{cases.reduce((s,c)=>s+(c.comments?.length||0),0)}</b> discussions</span>
              </div>
            </div>
            <button onClick={()=>setNewCase(true)} style={{...T.btn,padding:"13px 26px",fontSize:".95rem",background:"linear-gradient(135deg,"+T.gold+","+T.goldD+")"}}>📋 Post a new case</button>
          </div>
        </div>

        {/* MODAL — case posting form opens as overlay */}
        {newCase&&<div onClick={(e)=>{if(e.target===e.currentTarget)setNewCase(false)}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1500,display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"40px 20px",backdropFilter:"blur(4px)"}}>
          <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:640,boxShadow:"0 12px 48px rgba(0,0,0,0.25)",overflow:"hidden",animation:"slideIn 0.25s ease-out"}}>
            {/* Modal header */}
            <div style={{padding:"18px 24px",background:"linear-gradient(135deg,"+T.goldBg+","+T.tealBg+")",borderBottom:"1px solid "+T.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <h3 style={{fontSize:"1.1rem",fontWeight:700,margin:0,color:T.txt}}>📋 New Clinical Case</h3>
                <p style={{fontSize:".78rem",color:T.txt2,margin:"3px 0 0"}}>Fill in what's relevant — only title and image are required</p>
              </div>
              <button onClick={()=>setNewCase(false)} style={{background:"rgba(255,255,255,0.6)",border:"none",width:32,height:32,borderRadius:"50%",cursor:"pointer",fontSize:"1rem",color:T.txt2,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>

            {/* Modal body */}
            <div style={{padding:24,maxHeight:"65vh",overflowY:"auto"}}>
              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Title <span style={{color:T.err}}>*</span></label>
              <input value={ccT} onChange={e=>setCcT(e.target.value)} placeholder="e.g. 'Unusual pigmentation pattern on forearm'" style={{...T.inp,marginBottom:14,fontSize:".95rem"}}/>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Category</label>
              <select value={ccC} onChange={e=>setCcC(e.target.value)} style={{...T.inp,marginBottom:14}}>{TOPICS.map(t=><option key={t} value={t}>{t}</option>)}</select>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Clinical images <span style={{color:T.err}}>*</span></label>
              <div style={{marginBottom:16,padding:12,background:T.bg,borderRadius:10}}><ImgUpload images={ccImgs} setImages={setCcImgs} uploading={ccUp} setUploading={setCcUp}/></div>

              <div style={{padding:"12px 14px",background:T.bg,borderRadius:8,marginBottom:14,fontSize:".75rem",color:T.txt2,lineHeight:1.5}}>💡 The fields below are optional — fill in what's relevant for your case. You can always edit later.</div>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>📝 History &amp; presentation</label>
              <textarea value={ccHistory} onChange={e=>setCcHistory(e.target.value)} placeholder="Patient demographics, chief complaint, duration of symptoms, relevant past history..." rows={3} style={{...T.txa,marginBottom:12}}/>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>💊 Treatment given</label>
              <textarea value={ccTreatment} onChange={e=>setCcTreatment(e.target.value)} placeholder="Medications prescribed, procedures performed, dosage, duration..." rows={3} style={{...T.txa,marginBottom:12}}/>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>📈 Outcome</label>
              <textarea value={ccOutcome} onChange={e=>setCcOutcome(e.target.value)} placeholder="Response to treatment, follow-up findings, current status..." rows={2} style={{...T.txa,marginBottom:12}}/>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>💡 Discussion question</label>
              <input value={ccDiag} onChange={e=>setCcDiag(e.target.value)} placeholder="What's your differential? Any thoughts on management?" style={{...T.inp,marginBottom:14}}/>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Additional notes</label>
              <textarea value={ccB} onChange={e=>setCcB(e.target.value)} placeholder="Any additional context (optional)..." rows={2} style={{...T.txa,marginBottom:4}}/>
            </div>

            {/* Modal footer */}
            <div style={{padding:"14px 24px",borderTop:"1px solid "+T.border,background:T.bg,display:"flex",justifyContent:"flex-end",gap:10}}>
              <button onClick={()=>setNewCase(false)} style={T.btnO}>Cancel</button>
              <button onClick={postCase} style={T.btn}>📋 Publish case</button>
            </div>
          </div>
          <style>{`
            @keyframes slideIn { from { transform: translateY(-20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
          `}</style>
        </div>}

        {cases.length===0&&!newCase&&<div style={{...T.card,textAlign:"center",padding:48}}><div style={{fontSize:"2.4rem",marginBottom:8}}>🔬</div><p style={{color:T.mute,fontSize:".95rem"}}>No cases yet. Be the first to share a clinical case!</p></div>}
        {cases.map(cs=><div key={cs.id} style={{...T.card,padding:0,overflow:"hidden"}}>
          {/* IMAGES AT TOP — full image (no cropping) for clinical accuracy */}
          {cs.images?.length>0&&<div style={{padding:14,paddingBottom:0}}>
            {cs.images.length===1?
              <div style={{position:"relative",background:"#f4f1ea",borderRadius:10,overflow:"hidden",cursor:"zoom-in",height:380,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>{const v=document.createElement("div");v.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:20px";const im=document.createElement("img");im.src=cs.images[0];im.style.cssText="max-width:95%;max-height:95%;border-radius:8px";v.appendChild(im);v.onclick=()=>v.remove();document.body.appendChild(v)}}>
                <img src={cs.images[0]} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",display:"block"}}/>
                <div style={{position:"absolute",bottom:8,right:8,background:"rgba(0,0,0,0.55)",color:"#fff",padding:"3px 9px",borderRadius:4,fontSize:".62rem",letterSpacing:.5,fontWeight:500,pointerEvents:"none"}}>🔍 Click to enlarge</div>
              </div>
            :<div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:6,scrollSnapType:"x mandatory"}}>
              {cs.images.map((url,i)=><div key={i} style={{flexShrink:0,width:cs.images.length===2?"calc(50% - 4px)":300,height:cs.images.length===2?320:280,background:"#f4f1ea",borderRadius:10,scrollSnapAlign:"start",cursor:"zoom-in",position:"relative",overflow:"hidden"}} onClick={()=>{const v=document.createElement("div");v.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:20px";const im=document.createElement("img");im.src=url;im.style.cssText="max-width:95%;max-height:95%;border-radius:8px";v.appendChild(im);v.onclick=()=>v.remove();document.body.appendChild(v)}}>
                <img src={url} style={{width:"100%",height:"100%",objectFit:"contain",display:"block"}}/>
                <div style={{position:"absolute",bottom:6,right:6,background:"rgba(0,0,0,0.55)",color:"#fff",padding:"2px 7px",borderRadius:3,fontSize:".58rem",fontWeight:500,pointerEvents:"none"}}>🔍 {i+1}/{cs.images.length}</div>
              </div>)}
            </div>}
          </div>}

          <div style={{padding:18}}>
            {/* Author + meta */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              {cs.photo?<img src={cs.photo} style={{width:36,height:36,borderRadius:"50%"}}/>:<div style={T.av(36,T.tealBg,T.teal)}>{cs.ini||"?"}</div>}
              <div style={{flex:1}}>
                <b style={{fontSize:".88rem"}}>{cs.author}</b>
                <div style={{fontSize:".7rem",color:T.mute}}>{fD(cs.date)}</div>
              </div>
              <span style={T.tag(T.tealBg,T.teal)}>{cs.cat}</span>
            </div>

            {/* Title */}
            <h3 style={{fontSize:"1.2rem",fontWeight:700,lineHeight:1.35,marginBottom:14}}>{cs.title}</h3>

            {/* Structured sections — only render if filled */}
            {cs.history&&<div style={{marginBottom:14}}>
              <div style={{fontSize:".68rem",color:T.teal,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:5}}>📝 History & Presentation</div>
              <div style={{fontSize:".9rem",color:T.txt2,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{cs.history}</div>
            </div>}
            {cs.treatment&&<div style={{marginBottom:14}}>
              <div style={{fontSize:".68rem",color:T.teal,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:5}}>💊 Treatment Given</div>
              <div style={{fontSize:".9rem",color:T.txt2,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{cs.treatment}</div>
            </div>}
            {cs.outcome&&<div style={{marginBottom:14}}>
              <div style={{fontSize:".68rem",color:T.teal,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:5}}>📈 Outcome</div>
              <div style={{fontSize:".9rem",color:T.txt2,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{cs.outcome}</div>
            </div>}
            {cs.body&&<div style={{marginBottom:14}}>
              <div style={{fontSize:".9rem",color:T.txt2,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{cs.body}</div>
            </div>}

            {/* Discussion question — gold-tinted callout */}
            {cs.diagnosis&&<div style={{background:T.goldBg,borderLeft:"3px solid "+T.gold,padding:"12px 16px",marginBottom:14,borderRadius:"0 10px 10px 0"}}>
              <div style={{fontSize:".68rem",color:T.goldD,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>💡 Discussion</div>
              <div style={{fontSize:".95rem",color:T.txt,lineHeight:1.6,fontWeight:500}}>{cs.diagnosis}</div>
            </div>}

            {/* Engagement bar */}
            <div style={{display:"flex",alignItems:"center",gap:12,paddingTop:12,borderTop:"1px solid "+T.border,flexWrap:"wrap"}}>
              <LikeBtn liked={(cs.likedBy||[]).includes(au?.uid)} count={cs.likes||0} onToggle={()=>toggleLike("cases",cs.id,cs,setCases)}/>
              <span style={{fontSize:".75rem",color:T.mute}}>💬 {cs.comments?.length||0} comments</span>
              <ShareBar title={cs.title} url={`${window.location.origin}/?case=${cs.id}`} description={(cs.history||cs.body||"").slice(0,120)} itemId={cs.id} itemType="cases" currentUser={au} prof={prof} onSaveToggle={toggleSave}/>
            </div>

            {/* Comments */}
            {(cs.comments||[]).length>0&&<div style={{marginTop:12,paddingLeft:10,borderLeft:"2px solid "+T.border}}>
              {cs.comments.map((x,i)=><div key={i} style={{padding:"6px 0",fontSize:".85rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}><div style={T.av(20,T.tealBg,T.teal)}>{x.ini}</div><b style={{color:T.txt,fontSize:".82rem"}}>{x.n}</b><span style={{color:T.mute,fontSize:".62rem"}}>{x.tm}</span></div>
                <div style={{color:T.txt2,paddingLeft:26,lineHeight:1.5}}>{x.txt}</div>
              </div>)}
            </div>}
            <CaseCmtInput caseId={cs.id} caseObj={cs} addCaseComment={addCaseComment}/>
          </div>
        </div>)}
      </div>}

      {/* FORUM */}
      {pg==="forum"&&(()=>{
        const forumFilter=aTab.startsWith("fc_")?aTab.replace("fc_",""):"all";
        const filtered=forumFilter==="all"?forumPosts:forumPosts.filter(p=>p.cat===forumFilter);
        const totalPosts=forumPosts.length;
        const totalLikes=forumPosts.reduce((s,p)=>s+(p.likes||0),0);
        const activeAuthors=new Set(forumPosts.map(p=>p.uid)).size;
        return(<div>
          {/* Forum header with stats */}
          <div style={{...T.card,padding:24,background:"linear-gradient(135deg,#fff,"+T.tealBg+"55)",borderLeft:"3px solid "+T.teal,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:14}}>
              <div>
                <h2 style={{fontSize:"1.6rem",fontWeight:700,margin:0,display:"flex",alignItems:"center",gap:8}}>💬 Community Forum</h2>
                <p style={{color:T.txt2,fontSize:".88rem",marginTop:6}}>Share insights, ask questions, learn from peers across India.</p>
                <div style={{display:"flex",gap:18,marginTop:12,flexWrap:"wrap"}}>
                  <div><span style={{fontSize:"1.2rem",fontWeight:700,color:T.teal}}>{totalPosts}</span> <span style={{fontSize:".72rem",color:T.mute,textTransform:"uppercase",letterSpacing:1}}>discussions</span></div>
                  <div><span style={{fontSize:"1.2rem",fontWeight:700,color:T.teal}}>{activeAuthors}</span> <span style={{fontSize:".72rem",color:T.mute,textTransform:"uppercase",letterSpacing:1}}>contributors</span></div>
                  <div><span style={{fontSize:"1.2rem",fontWeight:700,color:T.teal}}>{totalLikes}</span> <span style={{fontSize:".72rem",color:T.mute,textTransform:"uppercase",letterSpacing:1}}>likes</span></div>
                </div>
              </div>
              <button onClick={()=>setNewForum(!newForum)} style={{...T.btn,padding:"12px 26px",fontSize:".92rem"}}>{newForum?"Cancel":"✏️ Start a discussion"}</button>
            </div>
          </div>

          {/* New post form */}
          {newForum&&<div style={{...T.card,borderLeft:"3px solid "+T.gold}}>
            <h4 style={{fontSize:".95rem",fontWeight:700,color:T.gold,marginBottom:12}}>✏️ New discussion</h4>
            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:500,textTransform:"uppercase",letterSpacing:1}}>Title</label>
            <input value={fpT} onChange={e=>setFpT(e.target.value)} placeholder="What's on your mind?" style={{...T.inp,marginBottom:12,fontSize:"1rem"}}/>
            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:500,textTransform:"uppercase",letterSpacing:1}}>Category</label>
            <select value={fpC} onChange={e=>setFpC(e.target.value)} style={{...T.inp,marginBottom:12}}>{TOPICS.map(t=><option key={t} value={t}>{t}</option>)}</select>
            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:500,textTransform:"uppercase",letterSpacing:1}}>Your post</label>
            <textarea value={fpB} onChange={e=>setFpB(e.target.value)} placeholder="Share your question, insight, or experience..." rows={5} style={{...T.txa,marginBottom:12,fontSize:".95rem",lineHeight:1.6}}/>
            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:500,textTransform:"uppercase",letterSpacing:1}}>Add images (optional)</label>
            <div style={{marginBottom:14,padding:12,background:T.bg,borderRadius:10}}><ImgUpload images={fpImgs} setImages={setFpImgs} uploading={fpUp} setUploading={setFpUp}/></div>
            <button onClick={postForum} style={T.btn}>Publish discussion</button>
          </div>}

          {/* Category filter chips */}
          {totalPosts>0&&<div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:14,flexWrap:"wrap"}}>
            {[["all","🌐 All",totalPosts],...TOPICS.map(t=>[t,t,forumPosts.filter(p=>p.cat===t).length])].filter(([id,l,n])=>id==="all"||n>0).map(([id,l,n])=><button key={id} onClick={()=>setATab("fc_"+id)} style={{padding:"7px 14px",borderRadius:20,border:`1.5px solid ${forumFilter===id?T.teal:T.border}`,background:forumFilter===id?T.tealBg:"#fff",color:forumFilter===id?T.teal:T.mute,cursor:"pointer",fontSize:".78rem",fontWeight:forumFilter===id?600:400,fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>{l} <span style={{opacity:.6}}>{n}</span></button>)}
          </div>}

          {/* Posts feed */}
          {filtered.length===0&&!newForum&&<div style={{...T.card,textAlign:"center",padding:50}}><div style={{fontSize:"2.4rem",marginBottom:8}}>💬</div><p style={{color:T.mute,fontSize:".95rem"}}>{forumFilter==="all"?"No discussions yet. Be the first to start one!":`No posts in "${forumFilter}" category yet.`}</p></div>}

          <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {filtered.map(p=>{const hasImg=p.images?.length>0;const isHot=(p.likes||0)>=3;return(<div key={p.id} style={{...T.card,padding:0,overflow:"hidden",marginBottom:0}}>
            {/* Hero image — same big layout as articles */}
            {hasImg&&(p.images.length===1?
              <img src={p.images[0]} style={{width:"100%",maxHeight:380,objectFit:"cover",display:"block",cursor:"pointer"}} onClick={()=>{const v=document.createElement("div");v.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:20px";const im=document.createElement("img");im.src=p.images[0];im.style.cssText="max-width:95%;max-height:95%;border-radius:8px";v.appendChild(im);v.onclick=()=>v.remove();document.body.appendChild(v)}}/>
              :<div style={{display:"flex",gap:4,maxHeight:340,overflow:"hidden"}}>
                <img src={p.images[0]} style={{flex:2,height:340,objectFit:"cover",cursor:"pointer"}} onClick={()=>{const v=document.createElement("div");v.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:20px";const im=document.createElement("img");im.src=p.images[0];im.style.cssText="max-width:95%;max-height:95%;border-radius:8px";v.appendChild(im);v.onclick=()=>v.remove();document.body.appendChild(v)}}/>
                <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>
                  {p.images.slice(1,3).map((url,i)=><div key={i} style={{flex:1,position:"relative",cursor:"pointer"}} onClick={()=>{const v=document.createElement("div");v.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:20px";const im=document.createElement("img");im.src=url;im.style.cssText="max-width:95%;max-height:95%;border-radius:8px";v.appendChild(im);v.onclick=()=>v.remove();document.body.appendChild(v)}}>
                    <img src={url} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    {i===1&&p.images.length>3&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:"1.1rem",fontWeight:600}}>+{p.images.length-3} more</div>}
                  </div>)}
                </div>
              </div>
            )}

            <div style={{padding:22}}>
              {/* Author + meta */}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                {p.photo?<img src={p.photo} style={{width:42,height:42,borderRadius:"50%",border:"2px solid "+T.tealBg}}/>:<div style={{...T.av(42,T.tealBg,T.teal),border:"2px solid "+T.tealBg}}>{p.ini||"?"}</div>}
                <div style={{flex:1}}>
                  <b style={{fontSize:".92rem",color:T.txt}}>{p.author}</b>
                  <div style={{fontSize:".72rem",color:T.mute,display:"flex",alignItems:"center",gap:6}}>
                    <span>{fD(p.date)}</span>
                    <span>·</span>
                    <span style={T.tag(T.tealBg,T.teal)}>{p.cat}</span>
                    {isHot&&<span style={T.tag(T.warnBg,T.warn)}>🔥 Hot</span>}
                  </div>
                </div>
              </div>

              {/* Title */}
              <h3 style={{fontSize:"1.3rem",fontWeight:700,lineHeight:1.35,marginBottom:10,color:T.txt}}>{p.title}</h3>

              {/* Body */}
              {p.body&&<p style={{fontSize:".95rem",color:T.txt2,lineHeight:1.75,whiteSpace:"pre-wrap",marginBottom:14}}>{p.body}</p>}

              {/* Engagement bar */}
              <div style={{display:"flex",alignItems:"center",gap:12,paddingTop:12,borderTop:"1px solid "+T.border,flexWrap:"wrap"}}>
                <LikeBtn liked={(p.likedBy||[]).includes(au?.uid)} count={p.likes||0} onToggle={()=>toggleLike("forum",p.id,p,setForumPosts)}/>
                <span style={{fontSize:".78rem",color:T.mute,display:"flex",alignItems:"center",gap:4}}>💬 {p.replies||0} replies</span>
                <ShareBar title={p.title} url={`${window.location.origin}/?forum=${p.id}`} description={p.body?.slice(0,120)} itemId={p.id} itemType="forum" currentUser={au} prof={prof} onSaveToggle={toggleSave}/>
              </div>
            </div>
          </div>)})}
          </div>
        </div>);
      })()}

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

        {/* SAVED ITEMS */}
        {(prof?.saved&&Object.values(prof.saved).some(arr=>arr?.length>0))&&<div style={T.card}>
          <h3 style={{fontSize:"1rem",fontWeight:700,marginBottom:12,color:T.gold}}>🔖 Saved items</h3>
          {prof.saved.articles?.length>0&&<div style={{marginBottom:14}}>
            <div style={{fontSize:".78rem",color:T.mute,fontWeight:600,marginBottom:6,textTransform:"uppercase"}}>Articles ({prof.saved.articles.length})</div>
            {prof.saved.articles.map(id=>{const a=articles.find(x=>x.id===id);return a?<div key={id} onClick={()=>{go("home");setSelA(a)}} style={{padding:"8px 10px",borderRadius:8,background:T.bg,marginBottom:5,cursor:"pointer",fontSize:".85rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>{a.title}</span><span style={{fontSize:".7rem",color:T.mute}}>→</span></div>:null})}
          </div>}
          {prof.saved.videos?.length>0&&<div style={{marginBottom:14}}>
            <div style={{fontSize:".78rem",color:T.mute,fontWeight:600,marginBottom:6,textTransform:"uppercase"}}>Videos ({prof.saved.videos.length})</div>
            {prof.saved.videos.map(id=>{const v=videos.find(x=>x.id===id);return v?<div key={id} onClick={()=>{go("videos");setSelV(v)}} style={{padding:"8px 10px",borderRadius:8,background:T.bg,marginBottom:5,cursor:"pointer",fontSize:".85rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>{v.title||v.t}</span><span style={{fontSize:".7rem",color:T.mute}}>→</span></div>:null})}
          </div>}
          {prof.saved.resources?.length>0&&<div style={{marginBottom:14}}>
            <div style={{fontSize:".78rem",color:T.mute,fontWeight:600,marginBottom:6,textTransform:"uppercase"}}>Resources ({prof.saved.resources.length})</div>
            {prof.saved.resources.map(id=>{const r=resources.find(x=>x.id===id);return r?<div key={id} onClick={()=>go("library")} style={{padding:"8px 10px",borderRadius:8,background:T.bg,marginBottom:5,cursor:"pointer",fontSize:".85rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>{r.title||r.t}</span><span style={{fontSize:".7rem",color:T.mute}}>→</span></div>:null})}
          </div>}
          {prof.saved.forum?.length>0&&<div>
            <div style={{fontSize:".78rem",color:T.mute,fontWeight:600,marginBottom:6,textTransform:"uppercase"}}>Forum posts ({prof.saved.forum.length})</div>
            {prof.saved.forum.map(id=>{const f=forumPosts.find(x=>x.id===id);return f?<div key={id} onClick={()=>go("forum")} style={{padding:"8px 10px",borderRadius:8,background:T.bg,marginBottom:5,cursor:"pointer",fontSize:".85rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>{f.title}</span><span style={{fontSize:".7rem",color:T.mute}}>→</span></div>:null})}
          </div>}
        </div>}
      </div>}

      {/* ADMIN */}
      {pg==="admin"&&isAdm&&<div>
        <h3 style={{fontSize:"1.15rem",fontWeight:700,marginBottom:12}}>⚙️ Admin dashboard</h3>
        <div style={{display:"flex",gap:5,marginBottom:16,flexWrap:"wrap"}}>
          {[["stats","📊 Overview"],["quiz","🧠 Quiz"],["articles","📰 Articles"],["resources","📚 Resources"],["videos","🎥 Videos"],["events","📅 Events"],["forum","💬 Forum"],["cases","🔬 Cases"],["ads","📢 Ads"],["users","👥 Users"]].map(([id,l])=><button key={id} onClick={()=>{setATab(id);setEdForm(null)}} style={{padding:"8px 14px",borderRadius:10,border:`1.5px solid ${aTab===id?T.teal:T.border}`,background:aTab===id?T.tealBg:"#fff",color:aTab===id?T.teal:T.mute,cursor:"pointer",fontSize:".8rem",fontWeight:aTab===id?600:400,fontFamily:"inherit"}}>{l}</button>)}
        </div>
        {aTab==="stats"&&<div style={T.card}><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>{[["Articles",articles.length],["Resources",resources.length],["Videos",videos.length],["Forum",forumPosts.length],["Cases",cases.length],["Quizzes",quizzes.length],["Users",allUsers.length],["Events",events.length],["Ads",ads.length]].map(([l,v])=><div key={l} style={{textAlign:"center",padding:14,background:T.bg,borderRadius:10}}><div style={{fontSize:"1.4rem",fontWeight:700,color:T.teal}}>{v}</div><div style={{fontSize:".6rem",color:T.mute,textTransform:"uppercase"}}>{l}</div></div>)}</div></div>}
        {aTab==="quiz"&&<div style={T.card}>{edForm?.type==="quizzes"?<AdminForm type="Quiz sponsor" edForm={edForm} setEdForm={setEdForm} fields={[["sponsored","Mark as sponsored quiz","check"],["sponsor","Sponsor name (e.g. 'Sun Pharma')"],["sponsorLogo","Sponsor logo","image"],["sponsorUrl","Sponsor URL (optional — makes name clickable)"]]} onSave={()=>saveContent("quizzes")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{quizzes.length} questions</span><button onClick={genQuiz} style={T.btn}>🤖 Generate today</button></div>
          {quizzes.map(q=><div key={q.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border,gap:10}}><div style={{flex:1,minWidth:0}}><div style={{fontWeight:500,fontSize:".88rem"}}>{q.cat} — {q.diff} {q.sponsored&&<span style={{...T.tag(T.goldBg,T.goldD),marginLeft:6}}>📢 {q.sponsor||"Sponsored"}</span>}</div><div style={{fontSize:".72rem",color:T.mute}}>{fD(q.date)} · {Object.keys(q.answers||{}).length} answers · ❤️ {q.likes||0}</div></div><div style={{display:"flex",gap:4}}><button onClick={()=>{setSelD(q.date);go("quiz")}} style={{...T.btnO,...T.btnSm}}>View</button><button onClick={()=>setEdForm({type:"quizzes",data:{...q},editing:true})} style={{...T.btnO,...T.btnSm}}>📢 Sponsor</button><button onClick={()=>deleteContent("quizzes",q.id,q.cat)} style={T.btnDanger}>Del</button></div></div>)}</>}</div>}
        {aTab==="articles"&&<div style={T.card}>{edForm?.type==="articles"?<AdminForm type="Article" edForm={edForm} setEdForm={setEdForm} fields={[["title","Title"],["subtitle","Subtitle / Tagline (italic, shown below title — optional)"],["cat","Category","select"],["author","Author name (e.g. 'Dr. Dhananjay Patil, MD')"],["authorPhoto","Author profile photo","image"],["authorAffiliation","Author affiliation (e.g. 'Absolute Institute of Aesthetic Medicine, Pune')"],["date","Publication date","date"],["cover","Cover image","image"],["abstract","Abstract / Summary (italic boxed quote — optional)","textarea"],["body","Article body","textarea"],["refs","References (optional)","textarea"],["authorBio","Author bio (shown at end of article — optional)","textarea"],["sponsored","Sponsored content (paid editorial)","check"],["sponsor","Sponsored by — brand name (e.g. 'Sun Pharma') — only if Sponsored is checked"],["sponsorLogo","Sponsor logo","image"],["sponsorUrl","Sponsor website URL (optional — makes sponsor name clickable)"],["feat","Featured","check"]]} onSave={()=>saveContent("articles")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{articles.length}</span><button onClick={()=>setEdForm({type:"articles",data:{date:today,author:uName,cat:TOPICS[0]},editing:false})} style={T.btn}>+ New</button></div>
          {articles.map(a=><div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border}}><div style={{display:"flex",gap:10,alignItems:"center"}}>{a.cover&&<img src={a.cover} style={{width:50,height:36,objectFit:"cover",borderRadius:6}}/>}<div><div style={{fontWeight:500,fontSize:".88rem"}}>{a.title}</div><div style={{fontSize:".72rem",color:T.mute}}>{fD(a.date)}</div></div></div><div style={{display:"flex",gap:4}}><button onClick={()=>setEdForm({type:"articles",data:{...a},editing:true})} style={{...T.btnO,...T.btnSm}}>Edit</button><button onClick={()=>deleteContent("articles",a.id,a.title)} style={T.btnDanger}>Del</button></div></div>)}</>}</div>}
        {aTab==="resources"&&<div style={T.card}>{edForm?.type==="resources"?<AdminForm type="Resource" edForm={edForm} setEdForm={setEdForm} fields={[["title","Title"],["url","Download URL"],["pages","Pages"],["size","Size"],["icon","Emoji (fallback)"],["thumb","Thumbnail image","image"],["free","Free","check"]]} onSave={()=>saveContent("resources")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{resources.length}</span><button onClick={()=>setEdForm({type:"resources",data:{icon:"📄",free:true},editing:false})} style={T.btn}>+ New</button></div>
          {resources.map(r=><div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border}}><div style={{display:"flex",gap:10,alignItems:"center"}}>{r.thumb?<img src={r.thumb} style={{width:36,height:36,objectFit:"cover",borderRadius:6}}/>:<span style={{fontSize:"1.4rem"}}>{r.icon||"📄"}</span>}<div><div style={{fontWeight:500,fontSize:".88rem"}}>{r.title||r.t}</div><div style={{fontSize:".72rem",color:T.mute}}>{r.free?"Free":"Premium"}</div></div></div><div style={{display:"flex",gap:4}}><button onClick={()=>setEdForm({type:"resources",data:{...r},editing:true})} style={{...T.btnO,...T.btnSm}}>Edit</button><button onClick={()=>deleteContent("resources",r.id,r.title||r.t)} style={T.btnDanger}>Del</button></div></div>)}</>}</div>}
        {aTab==="videos"&&<div style={T.card}>{edForm?.type==="videos"?<AdminForm type="Video" edForm={edForm} setEdForm={setEdForm} fields={[["title","Title"],["cat","Category","select"],["dur","Duration"],["desc","Description","textarea"],["embedUrl","Embed URL"],["icon","Emoji"],["free","Free","check"]]} onSave={()=>saveContent("videos")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{videos.length}</span><button onClick={()=>setEdForm({type:"videos",data:{icon:"🎥",free:true,cat:TOPICS[0]},editing:false})} style={T.btn}>+ New</button></div>
          {videos.map(v=><div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border}}><div><div style={{fontWeight:500,fontSize:".88rem"}}>{v.title||v.t}</div><div style={{fontSize:".72rem",color:T.mute}}>{v.cat} · {v.free?"Free":"Premium"}</div></div><div style={{display:"flex",gap:4}}><button onClick={()=>setEdForm({type:"videos",data:{...v},editing:true})} style={{...T.btnO,...T.btnSm}}>Edit</button><button onClick={()=>deleteContent("videos",v.id,v.title||v.t)} style={T.btnDanger}>Del</button></div></div>)}</>}</div>}
        {aTab==="events"&&<div style={T.card}>{edForm?.type==="events"?<AdminForm type="Event" edForm={edForm} setEdForm={setEdForm} fields={[["title","Event title"],["cat","Category","select",["Conference","Workshop","Masterclass","Webinar","Product Launch","Course Deadline","Other"]],["date","Start date","date"],["endDate","End date (leave blank for single-day event)","date"],["time","Time (e.g. '10:00 AM - 4:00 PM IST')"],["location","Location (or 'Online')"],["organizer","Organizer / Host"],["banner","Banner image","image"],["body","Description","textarea"],["speakers","Speakers (comma-separated)","textarea"],["sponsor","Sponsored by (e.g. 'Sun Pharma') — leave blank if not sponsored"],["sponsorLogo","Sponsor logo image","image"],["regType","Registration type","select",["internal","external"]],["regUrl","External registration URL (if regType is external)"],["regCta","CTA button text (e.g. 'Buy ticket', 'Register on Eventbrite')"]]} onSave={()=>saveContent("events")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{events.length} events</span><button onClick={()=>setEdForm({type:"events",data:{cat:"Conference",regType:"internal"},editing:false})} style={T.btn}>+ New event</button></div>
          {events.length===0&&<p style={{color:T.mute,fontSize:".85rem",padding:"12px 0"}}>No events yet. Click "+ New event" to add your first event.</p>}
          {events.map(e=>{const isPast=e.date<ds(getIST());return<div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border,gap:10}}><div style={{display:"flex",gap:10,alignItems:"center",flex:1,minWidth:0}}>{e.banner?<img src={e.banner} style={{width:60,height:42,objectFit:"cover",borderRadius:6}}/>:<div style={{width:60,height:42,background:T.bg,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center"}}>📅</div>}<div style={{flex:1,minWidth:0}}><div style={{fontWeight:500,fontSize:".88rem"}}>{e.title}</div><div style={{fontSize:".7rem",color:T.mute,display:"flex",gap:8,flexWrap:"wrap"}}><span style={T.tag(isPast?T.errBg:T.okBg,isPast?T.err:T.ok)}>{isPast?"Past":"Upcoming"}</span><span>{e.cat}</span><span>{e.date}</span><span>👥 {e.attendees?.length||0}</span></div></div></div><div style={{display:"flex",gap:4}}><button onClick={()=>setEdForm({type:"events",data:{...e},editing:true})} style={{...T.btnO,...T.btnSm}}>Edit</button><button onClick={()=>deleteContent("events",e.id,e.title)} style={T.btnDanger}>Del</button></div></div>})}</>}</div>}
        {aTab==="ads"&&<div style={T.card}>{edForm?.type==="ads"?<AdminForm type="Ad" edForm={edForm} setEdForm={setEdForm} fields={[["title","Title (e.g. 'Advanced Botox Course')"],["adType","Ad type","select",["external","internal"]],["desc","Short description (shown in sidebar)","textarea"],["image","Banner image (recommended 600x340)","image"],["url","Click-through URL (for external ads OR 'Visit website' button on internal pages)"],["tag","Category tag (e.g. Course, Pharma, Institute)"],["body","Full description (only for internal-page ads)","textarea"],["video","Video embed URL (only for internal-page ads, optional)"],["brochure","Brochure download URL (only for internal-page ads, optional)"],["contact","Contact info (only for internal-page ads, optional)"],["cta","CTA button text (default: 'Visit website')"],["expiry","Expiry date (leave blank for no expiry)","date"],["active","Active (uncheck to pause without deleting)","check"]]} onSave={()=>saveContent("ads")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div><span style={{color:T.mute}}>{ads.length} ads · {ads.filter(a=>a.active!==false&&(!a.expiry||new Date(a.expiry)>=new Date())).length} live</span></div><button onClick={()=>setEdForm({type:"ads",data:{active:true,tag:"Course",adType:"external",cta:"Visit website"},editing:false})} style={T.btn}>+ New ad</button></div>
          {ads.length===0&&<p style={{color:T.mute,fontSize:".85rem",padding:"12px 0"}}>No ads yet. Click "+ New ad" to add your first sponsored placement. Ads appear in the home page sidebar.</p>}
          {ads.map(ad=>{const expired=ad.expiry&&new Date(ad.expiry)<new Date();const live=ad.active!==false&&!expired;return<div key={ad.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border,gap:10}}><div style={{display:"flex",gap:10,alignItems:"center",flex:1,minWidth:0}}>{ad.image?<img src={ad.image} style={{width:60,height:42,objectFit:"cover",borderRadius:6}}/>:<div style={{width:60,height:42,background:T.bg,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",color:T.mute}}>📢</div>}<div style={{flex:1,minWidth:0}}><div style={{fontWeight:500,fontSize:".88rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ad.title}</div><div style={{fontSize:".7rem",color:T.mute,display:"flex",gap:8,flexWrap:"wrap"}}><span style={T.tag(live?T.okBg:T.errBg,live?T.ok:T.err)}>{live?"● Live":expired?"Expired":"Paused"}</span><span style={T.tag(T.tealBg,T.teal)}>{ad.adType==="internal"?"📄 Page":"🔗 Link"}</span><span>{ad.tag||"—"}</span><span>👆 {ad.clicks||0} clicks</span>{ad.expiry&&<span>Until {ad.expiry}</span>}</div></div></div><div style={{display:"flex",gap:4}}><button onClick={()=>setEdForm({type:"ads",data:{...ad},editing:true})} style={{...T.btnO,...T.btnSm}}>Edit</button><button onClick={()=>deleteContent("ads",ad.id,ad.title)} style={T.btnDanger}>Del</button></div></div>})}</>}</div>}

        {/* ═══ FORUM ADMIN — moderate user discussions ═══ */}
        {aTab==="forum"&&<div style={T.card}>{edForm?.type==="forum"?<AdminForm type="Forum post" edForm={edForm} setEdForm={setEdForm} fields={[["title","Title"],["cat","Category","select"],["body","Body","textarea"],["author","Author name (display only)"]]} onSave={()=>saveContent("forum")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{forumPosts.length} posts</span><span style={{fontSize:".75rem",color:T.mute}}>Posts are created by users — admins can edit (moderate) or delete</span></div>
          {forumPosts.length===0&&<p style={{color:T.mute,fontSize:".85rem",padding:"12px 0"}}>No forum posts yet.</p>}
          {forumPosts.map(p=><div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border,gap:10}}>
            <div style={{display:"flex",gap:10,alignItems:"center",flex:1,minWidth:0}}>
              {p.images?.[0]?<img src={p.images[0]} style={{width:50,height:42,objectFit:"cover",borderRadius:6,flexShrink:0}}/>:p.photo?<img src={p.photo} style={{width:42,height:42,borderRadius:"50%",flexShrink:0}}/>:<div style={{...T.av(42,T.tealBg,T.teal),flexShrink:0}}>{p.ini||"?"}</div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:500,fontSize:".88rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</div>
                <div style={{fontSize:".7rem",color:T.mute,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={T.tag(T.tealBg,T.teal)}>{p.cat}</span>
                  <span>by {p.author}</span>
                  <span>{fD(p.date)}</span>
                  <span>❤️ {p.likes||0}</span>
                  <span>💬 {p.replies||0}</span>
                  {p.images?.length>0&&<span>🖼 {p.images.length}</span>}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:4}}>
              <button onClick={()=>setEdForm({type:"forum",data:{...p},editing:true})} style={{...T.btnO,...T.btnSm}}>Edit</button>
              <button onClick={()=>deleteContent("forum",p.id,p.title)} style={T.btnDanger}>Del</button>
            </div>
          </div>)}</>}</div>}

        {/* ═══ CASES ADMIN — moderate clinical cases ═══ */}
        {aTab==="cases"&&<div style={T.card}>{edForm?.type==="cases"?<AdminForm type="Clinical case" edForm={edForm} setEdForm={setEdForm} fields={[["title","Title"],["cat","Category","select"],["history","History & Presentation","textarea"],["treatment","Treatment Given","textarea"],["outcome","Outcome","textarea"],["diagnosis","Discussion question"],["body","Additional notes","textarea"],["author","Author name (display only)"]]} onSave={()=>saveContent("cases")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{cases.length} cases</span><span style={{fontSize:".75rem",color:T.mute}}>Cases are posted by users — admins can edit or delete inappropriate content</span></div>
          {cases.length===0&&<p style={{color:T.mute,fontSize:".85rem",padding:"12px 0"}}>No clinical cases posted yet.</p>}
          {cases.map(cs=><div key={cs.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border,gap:10}}>
            <div style={{display:"flex",gap:10,alignItems:"center",flex:1,minWidth:0}}>
              {cs.images?.[0]?<img src={cs.images[0]} style={{width:50,height:42,objectFit:"cover",borderRadius:6,flexShrink:0}}/>:<div style={{width:50,height:42,background:T.bg,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>🔬</div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:500,fontSize:".88rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cs.title}</div>
                <div style={{fontSize:".7rem",color:T.mute,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={T.tag(T.tealBg,T.teal)}>{cs.cat}</span>
                  <span>by {cs.author}</span>
                  <span>{fD(cs.date)}</span>
                  <span>❤️ {cs.likes||0}</span>
                  <span>💬 {cs.comments?.length||0}</span>
                  <span>🖼 {cs.images?.length||0}</span>
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:4}}>
              <button onClick={()=>setEdForm({type:"cases",data:{...cs},editing:true})} style={{...T.btnO,...T.btnSm}}>Edit</button>
              <button onClick={()=>deleteContent("cases",cs.id,cs.title)} style={T.btnDanger}>Del</button>
            </div>
          </div>)}</>}</div>}
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
