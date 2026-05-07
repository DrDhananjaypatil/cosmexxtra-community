import { useState, useEffect, useCallback, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig={apiKey:"AIzaSyAzW8kouNGmK11tLIDftwlg5QEtffecYEM",authDomain:"skinario-369.firebaseapp.com",projectId:"skinario-369",storageBucket:"skinario-369.firebasestorage.app",messagingSenderId:"647411585151",appId:"1:647411585151:web:210827226e649d96b42f4a"};
const fbApp=initializeApp(firebaseConfig);const auth=getAuth(fbApp);const db=getFirestore(fbApp);const gProv=new GoogleAuthProvider();
const storage=getStorage(fbApp);
const ADMINS=["drjpatil@gmail.com","absoluteinstituteedu@gmail.com"];

// ═══ TIER SYSTEM — sticky badges based on lifetime points ═══
const TIERS=[
  {id:"beginner",label:"Beginner",min:0,max:49,color:"#888",bg:"#f0f0f0"},
  {id:"contributor",label:"Contributor",min:50,max:199,color:"#0d6b6e",bg:"#e1f5ee"},
  {id:"pro",label:"Pro",min:200,max:499,color:"#785f1e",bg:"#fdf6e3"},
  {id:"expert",label:"Expert",min:500,max:999,color:"#7a3e9a",bg:"#f3e8ff"},
  {id:"master",label:"Master",min:1000,max:Infinity,color:"#b91c1c",bg:"#fef2f2"}
];
function getTier(points){
  const p=points||0;
  return TIERS.find(t=>p>=t.min&&p<=t.max)||TIERS[0];
}
const TOPICS=["Botox & Neurotoxins","Dermal Fillers","Threads","PDRN & Polynucleotides","Peptides & Skin Boosters","Chemical Peels","Laser & Energy Devices","Hair Restoration","Body Contouring","Anti-Aging & Regenerative","Skincare Science","Pigmentation & Melasma","Acne & Scars","Practice Management"];

// ═══ ACCOUNT TYPES ═══
const ACCOUNT_TYPES=[
  {id:"doctor",label:"Doctor",icon:"🩺",desc:"Practicing physician — derms, aesthetic doctors, cosmetologists"},
  {id:"institute",label:"Institute",icon:"🏛️",desc:"Medical college, aesthetic academy, training center, hospital"},
  {id:"pharma",label:"Pharma / Brand",icon:"🏢",desc:"Pharmaceutical, device, or skincare company"}
];

// ═══ MEDICAL DEGREES (alphabetized) ═══
const DEGREES=["MBBS","BAMS","BHMS","BDS","BUMS","MD - Dermatology","MD - General Medicine","MS - Surgery","DDV (Diploma in Dermatology)","DNB - Dermatology","Diploma in Aesthetic Medicine","Diploma in Cosmetology","Fellowship in Aesthetic Medicine","Fellowship in Cosmetology","Other"];

// ═══ COUNTRIES — India default + top markets for aesthetic medicine ═══
const COUNTRIES=[
  "India",
  "United Arab Emirates",
  "Saudi Arabia",
  "Qatar",
  "Kuwait",
  "Oman",
  "Bahrain",
  "Singapore",
  "Malaysia",
  "Thailand",
  "Indonesia",
  "Philippines",
  "Vietnam",
  "Sri Lanka",
  "Bangladesh",
  "Nepal",
  "Pakistan",
  "United Kingdom",
  "United States",
  "Canada",
  "Australia",
  "New Zealand",
  "South Africa",
  "Nigeria",
  "Kenya",
  "Egypt",
  "Turkey",
  "Brazil",
  "Mexico",
  "Other"
];

// ═══ INDIAN MEDICAL COUNCILS ═══
const COUNCILS=["NMC (National Medical Commission)","SMC - Maharashtra","SMC - Karnataka","SMC - Tamil Nadu","SMC - Andhra Pradesh","SMC - Telangana","SMC - Gujarat","SMC - Delhi","SMC - West Bengal","SMC - Kerala","SMC - Rajasthan","SMC - Uttar Pradesh","SMC - Madhya Pradesh","SMC - Punjab","SMC - Haryana","SMC - Bihar","SMC - Odisha","SMC - Other","CCH (Central Council of Homoeopathy)","CCIM (Central Council of Indian Medicine)","DCI (Dental Council of India)","Other"];

// ═══ INSTITUTE TYPES ═══
const INSTITUTE_TYPES=["Medical College","Aesthetic Academy / Training Center","Hospital","Skin Clinic Chain","Beauty / Cosmetology School","Other"];

// ═══ PHARMA / BRAND CATEGORIES ═══
const BRAND_CATEGORIES=["Pharmaceutical","Aesthetic Devices","Cosmeceuticals / Skincare","Injectables (Toxin/Filler)","Threads","Energy Devices (Laser/RF/HIFU)","Distributor / Retailer","Other"];
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

// ═══ NORMALIZE VIDEO URL — accepts any YouTube/Vimeo format and returns proper embed URL ═══
const normalizeVideoUrl=(url)=>{
  if(!url)return"";
  url=url.trim();
  // Already an embed URL — pass through
  if(url.includes("/embed/")||url.includes("player.vimeo.com"))return url.split("?")[0];
  // youtu.be/VIDEOID or youtu.be/VIDEOID?si=...
  let m=url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if(m)return`https://www.youtube.com/embed/${m[1]}`;
  // youtube.com/watch?v=VIDEOID
  m=url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if(m)return`https://www.youtube.com/embed/${m[1]}`;
  // youtube.com/shorts/VIDEOID
  m=url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if(m)return`https://www.youtube.com/embed/${m[1]}`;
  // vimeo.com/12345
  m=url.match(/vimeo\.com\/(\d+)/);
  if(m)return`https://player.vimeo.com/video/${m[1]}`;
  // Already a direct .mp4 or other valid URL — return as-is
  return url;
};

// ═══ EXTRACT THUMBNAIL URL from any YouTube embed URL ═══
const getVideoThumbnail=(embedUrl)=>{
  if(!embedUrl)return null;
  // Match YouTube embed format: youtube.com/embed/VIDEOID
  const m=embedUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if(m)return`https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`;
  // Vimeo doesn't expose thumbnails without an API call — return null and use fallback UI
  return null;
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
// ═══ RENDER COMMENT TEXT — highlights @mentions in teal ═══
const renderTextWithMentions=(text)=>{
  if(!text)return text;
  const parts=text.split(/(@[a-zA-Z][a-zA-Z0-9._]{1,30})/g);
  return parts.map((p,i)=>p.startsWith("@")?<span key={i} style={{color:T.teal,fontWeight:600,background:T.tealBg,padding:"1px 5px",borderRadius:4}}>{p}</span>:p);
};

// ═══ MENTION INPUT — input with @ autocomplete dropdown ═══
const MentionInput=({value,onChange,onSubmit,placeholder,allUsers,style})=>{
  const[matches,setMatches]=useState([]);
  const[selIdx,setSelIdx]=useState(0);
  const inputRef=useRef();
  const handleChange=(e)=>{
    const v=e.target.value;
    onChange(v);
    // Detect @ trigger at cursor position
    const cur=e.target.selectionStart;
    const before=v.slice(0,cur);
    const m=before.match(/@([a-zA-Z][a-zA-Z0-9._]{0,30})$/);
    if(m&&allUsers){
      const search=m[1].toLowerCase();
      const filtered=allUsers.filter(u=>{
        const n=(u.name||"").replace(/^Dr\.?\s*/i,"").toLowerCase();
        return n.includes(search)||n.split(" ").some(w=>w.startsWith(search));
      }).slice(0,5);
      setMatches(filtered);setSelIdx(0);
    }else{
      setMatches([]);
    }
  };
  const insertMention=(user)=>{
    const handle=(user.name||"").replace(/^Dr\.?\s*/i,"").split(" ")[0];
    const v=value;
    const cur=inputRef.current?.selectionStart||v.length;
    const before=v.slice(0,cur);
    const after=v.slice(cur);
    const newBefore=before.replace(/@([a-zA-Z][a-zA-Z0-9._]{0,30})$/,`@${handle} `);
    onChange(newBefore+after);
    setMatches([]);
    setTimeout(()=>inputRef.current?.focus(),10);
  };
  const handleKey=(e)=>{
    if(matches.length){
      if(e.key==="ArrowDown"){e.preventDefault();setSelIdx(i=>(i+1)%matches.length)}
      else if(e.key==="ArrowUp"){e.preventDefault();setSelIdx(i=>(i-1+matches.length)%matches.length)}
      else if(e.key==="Enter"||e.key==="Tab"){e.preventDefault();insertMention(matches[selIdx])}
      else if(e.key==="Escape"){setMatches([])}
    }else if(e.key==="Enter"&&onSubmit){onSubmit()}
  };
  return(<div style={{position:"relative",flex:1}}>
    <input ref={inputRef} value={value} onChange={handleChange} onKeyDown={handleKey} placeholder={placeholder} style={style}/>
    {matches.length>0&&<div style={{position:"absolute",bottom:"calc(100% + 4px)",left:0,right:0,background:"#fff",border:"1px solid "+T.border,borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.12)",zIndex:200,maxHeight:240,overflowY:"auto"}}>
      <div style={{padding:"5px 10px",fontSize:".66rem",color:T.mute,letterSpacing:1,textTransform:"uppercase",fontWeight:600,borderBottom:"1px solid "+T.border}}>Mention</div>
      {matches.map((u,i)=><div key={u.id} onMouseDown={(e)=>{e.preventDefault();insertMention(u)}} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",cursor:"pointer",background:i===selIdx?T.tealBg:"#fff",fontSize:".82rem"}}>
        {u.photo?<img src={u.photo} style={{width:26,height:26,borderRadius:"50%",objectFit:"cover"}}/>:<div style={T.av(26,T.tealBg,T.teal)}>{u.initials||"?"}</div>}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:500,color:T.txt,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.name}</div>
          {u.degree&&<div style={{fontSize:".7rem",color:T.mute,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.degree}</div>}
        </div>
      </div>)}
    </div>}
  </div>);
};

const CommentThread=({collection,itemId,item,currentUser,uName,uIni,uPhoto,allUsers,onUpdate})=>{
  const[txt,setTxt]=useState("");
  const comments=item.comments||[];
  const submit=async()=>{
    if(!txt.trim()||!currentUser)return;
    const c={n:uName,ini:uIni,txt,tm:getIST().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true}),uid:currentUser.uid,likedBy:[],likes:0};
    const updated=[...comments,c];
    await fbSet(collection,itemId,{comments:updated});
    onUpdate(itemId,updated);
    // Notify the author of the original post (if not self)
    if(item.uid&&item.uid!==currentUser.uid){
      const linkTypeMap={articles:"article",cases:"case",videos:"video",forum:"forum",events:"event"};
      createNotif({toUid:item.uid,fromUid:currentUser.uid,fromName:uName,fromIni:uIni,fromPhoto:uPhoto,type:"comment",text:`commented on your ${linkTypeMap[collection]||"post"}`,linkType:linkTypeMap[collection],linkId:itemId,linkLabel:item.title||"your post"});
    }
    // Notify any @mentioned users
    const mentioned=parseMentions(txt,allUsers||[]);
    mentioned.forEach(u=>{
      if(u.id!==currentUser.uid&&u.id!==item.uid){
        const linkTypeMap={articles:"article",cases:"case",videos:"video",forum:"forum",events:"event"};
        createNotif({toUid:u.id,fromUid:currentUser.uid,fromName:uName,fromIni:uIni,fromPhoto:uPhoto,type:"mention",text:`mentioned you in a comment`,linkType:linkTypeMap[collection],linkId:itemId,linkLabel:item.title||"a post"});
      }
    });
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
    // Notify the comment author when liked
    if(!has&&c.uid&&c.uid!==currentUser.uid){
      createNotif({toUid:c.uid,fromUid:currentUser.uid,fromName:uName,fromIni:uIni,fromPhoto:uPhoto,type:"like",text:`liked your comment`,linkType:({articles:"article",cases:"case",videos:"video",forum:"forum",events:"event"})[collection]||"",linkId:itemId,linkLabel:item.title||""});
    }
  };
  return(<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid "+T.border}}>
    <div style={{fontSize:".88rem",color:T.teal,fontWeight:600,marginBottom:10}}>💬 Discussion ({comments.length})</div>
    {comments.length===0&&<p style={{color:T.mute,fontSize:".82rem",marginBottom:10}}>No comments yet. Be the first!</p>}
    {comments.map((c,i)=><div key={i} style={{padding:"8px 0",borderBottom:"1px solid "+T.border}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><div style={T.av(22,T.tealBg,T.teal)}>{c.ini}</div><b style={{fontSize:".82rem"}}>{c.n}</b><span style={{fontSize:".62rem",color:T.mute}}>{c.tm}</span></div>
      <div style={{fontSize:".85rem",color:T.txt2,paddingLeft:28,lineHeight:1.5}}>{renderTextWithMentions(c.txt)}</div>
      <div style={{paddingLeft:28,marginTop:4}}><LikeBtn liked={(c.likedBy||[]).includes(currentUser?.uid)} count={c.likes||0} onToggle={()=>toggleCmtLike(i)}/></div>
    </div>)}
    <div style={{display:"flex",gap:6,marginTop:10,position:"relative"}}>
      <MentionInput value={txt} onChange={setTxt} onSubmit={submit} placeholder="Share your thoughts... (use @name to mention)" allUsers={allUsers} style={{...T.inp,borderRadius:20,padding:"9px 14px",fontSize:".82rem",width:"100%"}}/>
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

// ═══ ADMIN VIDEO FIELD (direct upload .mp4 to Firebase Storage) ═══
const AdminVideoField=({value,onChange})=>{
  const fileRef=useRef();
  const[busy,setBusy]=useState(false);
  const[progress,setProgress]=useState(0);
  const handleFile=async(e)=>{
    const f=e.target.files?.[0];if(!f)return;
    // Sanity check on file size — warn at 200MB
    if(f.size>200*1024*1024){
      if(!confirm(`This file is ${(f.size/1024/1024).toFixed(1)}MB. Large files cost more to host and stream. Continue?`)){
        if(fileRef.current)fileRef.current.value="";
        return;
      }
    }
    setBusy(true);setProgress(0);
    try{
      const path=`videos/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const sRef=ref(storage,path);
      // Simulate progress for UX (uploadBytes doesn't provide progress; uploadBytesResumable does but more complex)
      const interval=setInterval(()=>setProgress(p=>Math.min(p+5,90)),300);
      await uploadBytes(sRef,f);
      clearInterval(interval);setProgress(100);
      const url=await getDownloadURL(sRef);
      onChange(url);
    }catch(err){console.error("Video upload error:",err);alert("Upload failed: "+err.message)}
    setBusy(false);setProgress(0);
    if(fileRef.current)fileRef.current.value="";
  };
  const isDirectVideo=value&&!value.includes("youtube.com")&&!value.includes("vimeo.com")&&!value.includes("youtu.be");
  return(<div>
    {value&&isDirectVideo&&<div style={{position:"relative",borderRadius:8,overflow:"hidden",border:"1px solid "+T.border,marginBottom:8,background:"#000"}}>
      <video src={value} controls style={{width:"100%",maxHeight:200,display:"block"}}/>
      <button onClick={()=>onChange("")} style={{position:"absolute",top:6,right:6,width:24,height:24,borderRadius:"50%",background:"rgba(0,0,0,.75)",color:"#fff",border:"none",fontSize:".75rem",cursor:"pointer",zIndex:2}}>✕</button>
    </div>}
    <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/ogg" onChange={handleFile} style={{display:"none"}}/>
    <button onClick={()=>fileRef.current?.click()} disabled={busy} style={{...T.btnO,...T.btnSm,opacity:busy?.5:1}}>{busy?`⏳ Uploading ${progress}%...`:value&&isDirectVideo?"🔄 Replace video":"📤 Upload video file (.mp4)"}</button>
    <p style={{fontSize:".68rem",color:T.mute,marginTop:6,lineHeight:1.5}}>For premium content. ⚠️ Large videos increase hosting costs — prefer YouTube/Vimeo embed for free content.</p>
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
      :tp==="videofile"?<AdminVideoField value={d[k]} onChange={url=>set(k,url)}/>
      :tp==="date"?<input type="date" value={d[k]||""} onChange={e=>set(k,e.target.value)} style={T.inp}/>
      :<input value={d[k]||""} onChange={e=>set(k,e.target.value)} style={T.inp}/>}
    </div>)}
    <div style={{display:"flex",gap:8}}><button onClick={onSave} style={T.btn}>{edForm?.editing?"Update":"Create"}</button><button onClick={()=>setEdForm(null)} style={T.btnO}>Cancel</button></div>
  </div>)
};

// ═══ CASE COMMENT INPUT (moved outside App to fix cursor focus bug) ═══
const CaseCmtInput=({caseId,caseObj,addCaseComment,allUsers})=>{
  const[txt,setTxt]=useState("");
  const submit=()=>{addCaseComment(caseId,caseObj,txt);setTxt("")};
  return(<div style={{display:"flex",gap:6,marginTop:10,position:"relative"}}>
    <MentionInput value={txt} onChange={setTxt} onSubmit={submit} placeholder="Your thoughts... (use @name to mention)" allUsers={allUsers} style={{...T.inp,borderRadius:20,padding:"9px 14px",fontSize:".82rem",width:"100%"}}/>
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

// ═══ NOTIFICATION CREATOR — creates a notif if recipient ≠ sender ═══
async function createNotif({toUid,fromUid,fromName,fromIni,fromPhoto,type,text,linkType,linkId,linkLabel}){
  if(!toUid||!fromUid||toUid===fromUid)return; // never notify yourself
  await fbAdd("notifications",{
    toUid,fromUid,fromName:fromName||"Someone",fromIni:fromIni||"?",fromPhoto:fromPhoto||"",
    type, // "comment" | "like" | "mention" | "reply" | "event_reminder"
    text:text||"",
    linkType:linkType||"", // "article" | "case" | "video" | "forum" | "event" | "quiz"
    linkId:linkId||"",
    linkLabel:linkLabel||"",
    read:false
  });
}

// ═══ PARSE @MENTIONS from text — returns array of matched users ═══
function parseMentions(text,allUsers){
  if(!text||!allUsers)return[];
  // Match @firstname or @first.last patterns
  const matches=[...text.matchAll(/@([a-zA-Z][a-zA-Z0-9._]{1,30})/g)];
  if(!matches.length)return[];
  const mentioned=[];
  matches.forEach(m=>{
    const handle=m[1].toLowerCase();
    // Try matching against user names: "Dr. Sharma Patil" → "sharma" or "sharmapatil" or "sharma.patil"
    const found=allUsers.find(u=>{
      const cleanName=(u.name||"").replace(/^Dr\.?\s*/i,"").toLowerCase();
      const collapsed=cleanName.replace(/\s+/g,"");
      const dotted=cleanName.replace(/\s+/g,".");
      const firstWord=cleanName.split(" ")[0];
      return handle===collapsed||handle===dotted||handle===firstWord;
    });
    if(found&&!mentioned.find(x=>x.id===found.id))mentioned.push(found);
  });
  return mentioned;
}

// ═══ FORMAT relative time (just now, 5m ago, 2h ago, 3d ago) ═══
function relTime(ts){
  if(!ts)return"";
  const t=ts.seconds?ts.seconds*1000:typeof ts==="number"?ts:Date.parse(ts);
  if(isNaN(t))return"";
  const diff=Date.now()-t;
  const mins=Math.floor(diff/60000);
  if(mins<1)return"just now";
  if(mins<60)return`${mins}m ago`;
  const hrs=Math.floor(mins/60);
  if(hrs<24)return`${hrs}h ago`;
  const days=Math.floor(hrs/24);
  if(days<7)return`${days}d ago`;
  return new Date(t).toLocaleDateString("en-IN",{day:"numeric",month:"short"});
}

async function genQuizAI(date){
  try{
    const r=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"}});
    const data=await r.json();
    if(!data.ok||!data.quiz){
      console.error("Quiz gen error:",data.error||"Unknown error",data);
      return null;
    }
    const q=data.quiz;
    if(!q.question||!q.opts||q.opts.length<3){console.error("Invalid quiz shape:",q);return null}
    return{date,cat:q.cat,diff:q.diff,scen:q.scen||"",question:q.question,opts:q.opts.slice(0,3),ci:typeof q.ci==="number"?q.ci:0,expl:q.expl||"",answers:{},comments:[]}
  }catch(e){console.error("Quiz gen error:",e);return null}}

export default function App(){
  const[au,setAu]=useState(null);const[prof,setProf]=useState(null);const[scr,setScr]=useState("loading");const[pg,setPg]=useState("home");
  const[welcomeSeen,setWelcomeSeen]=useState(()=>localStorage.getItem("sk_welcome")==="1");
  const[quizzes,setQuizzes]=useState([]);const[articles,setArticles]=useState([]);const[resources,setResources]=useState([]);const[videos,setVideos]=useState([]);const[forumPosts,setForumPosts]=useState([]);const[cases,setCases]=useState([]);const[allUsers,setAllUsers]=useState([]);
  const[selD,setSelD]=useState(ds(getIST()));const[selA,setSelA]=useState(null);const[selV,setSelV]=useState(null);const[selU,setSelU]=useState(null);const[toast,setToast]=useState(null);const[cmt,setCmt]=useState("");const[ld,setLd]=useState(false);const[aTab,setATab]=useState("stats");
  const[authMode,setAuthMode]=useState("signin");const[authEmail,setAuthEmail]=useState("");const[authPass,setAuthPass]=useState("");const[authName,setAuthName]=useState("");const[authBusy,setAuthBusy]=useState(false);const[authErr,setAuthErr]=useState("");
  const[pf,setPf]=useState({accountType:"",country:"India",internationalCouncil:"",city:"",region:"",name:"",mobile:"",degree:"",council:"",regNumber:"",clinic:"",address:"",visibility:"public",companyName:"",brandCategory:"",contactPerson:"",website:"",instituteName:"",instituteType:"",directorName:""});const[edForm,setEdForm]=useState(null);const[setupStep,setSetupStep]=useState(0);const[setupErr,setSetupErr]=useState("");
  // Forum/Cases new post state
  const[newForum,setNewForum]=useState(false);const[fpT,setFpT]=useState("");const[fpB,setFpB]=useState("");const[fpC,setFpC]=useState(TOPICS[0]);const[fpImgs,setFpImgs]=useState([]);const[fpUp,setFpUp]=useState(false);
  const[newCase,setNewCase]=useState(false);const[ccT,setCcT]=useState("");const[ccB,setCcB]=useState("");const[ccC,setCcC]=useState(TOPICS[0]);const[ccImgs,setCcImgs]=useState([]);const[ccUp,setCcUp]=useState(false);const[ccDiag,setCcDiag]=useState("");const[ccHistory,setCcHistory]=useState("");const[ccTreatment,setCcTreatment]=useState("");const[ccOutcome,setCcOutcome]=useState("");

  const sh=m=>setToast(m);const go=p=>{setPg(p);setSelA(null);setSelV(null);setSelAd(null);setSelE(null);setSelU(null);setEdForm(null)};
  // ═══ VIEW PROFILE — open any user's profile page ═══
  const viewProfile=(uid)=>{
    if(!uid)return;
    const u=allUsers.find(x=>x.id===uid);
    if(!u)return;
    setSelU(u);
    setPg("profile");
    window.scrollTo(0,0);
  };
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(null),3000);return()=>clearTimeout(t)}},[toast]);

  const[ads,setAds]=useState([]);
  const[notifs,setNotifs]=useState([]);
  const[notifsOpen,setNotifsOpen]=useState(false);
  const[mentionMatches,setMentionMatches]=useState([]);
  const[announceTitle,setAnnounceTitle]=useState("");
  const[announceText,setAnnounceText]=useState("");
  const[announceLinkType,setAnnounceLinkType]=useState("");
  const[announceLinkId,setAnnounceLinkId]=useState("");
  const[broadcastList,setBroadcastList]=useState([]);
  const[announceBusy,setAnnounceBusy]=useState(false);
  const[articleLimit,setArticleLimit]=useState(6);
  const[videoFilter,setVideoFilter]=useState("all");
  const[videoSearch,setVideoSearch]=useState("");
  const[editingProfile,setEditingProfile]=useState(false);
  const[editPf,setEditPf]=useState({});
  const[editErr,setEditErr]=useState("");
  const[showPoints,setShowPoints]=useState(false);
  const[showTiers,setShowTiers]=useState(false);
  const[events,setEvents]=useState([]);
  const[selAd,setSelAd]=useState(null);
  const[selE,setSelE]=useState(null);
  const loadData=useCallback(async()=>{const[q,a,r,v,f,cs,u,ad,ev]=await Promise.all([fbGetAll("quizzes","date","desc"),fbGetAll("articles","date","desc"),fbGetAll("resources","order","asc"),fbGetAll("videos","order","asc"),fbGetAll("forum","createdAt","desc"),fbGetAll("cases","createdAt","desc"),fbGetAll("users","joined","desc"),fbGetAll("ads","createdAt","desc"),fbGetAll("events","date","asc",200)]);setQuizzes(q);setArticles(a);setResources(r);setVideos(v);setForumPosts(f);setCases(cs);setAllUsers(u);setAds(ad);setEvents(ev)},[]);

  useEffect(()=>{const unsub=onAuthStateChanged(auth,async u=>{if(u){setAu(u);let p=await fbGet("users",u.uid);if(!p){const l=localStorage.getItem("sk_p_"+u.uid);if(l)p=JSON.parse(l)}if(p){setProf(p);setScr("main");loadData()}else{setPf({accountType:"",country:"India",internationalCouncil:"",city:"",region:"",name:au?.displayName||"",mobile:"",degree:"",council:"",regNumber:"",clinic:"",address:"",visibility:"public",companyName:"",brandCategory:"",contactPerson:"",website:"",instituteName:"",instituteType:"",directorName:""});setSetupStep(0);setSetupErr("");setScr("setup")}}else{setAu(null);setProf(null);setScr("login")}});return()=>unsub()},[loadData]);

  // ═══ NOTIFICATIONS LOADER — fetches current user's notifications + broadcast announcements ═══
  useEffect(()=>{
    if(!au)return;
    const fetchNotifs=async()=>{
      try{
        const q=query(fbCol("notifications"),orderBy("createdAt","desc"),limit(50));
        const snap=await getDocs(q);
        const all=snap.docs.map(d=>({id:d.id,...d.data()}));
        // Personal notifications: addressed to this user
        const personal=all.filter(n=>n.toUid===au.uid);
        // Broadcast announcements: visible to everyone, read state tracked in user's prof.readBroadcasts
        const readBroadcasts=prof?.readBroadcasts||[];
        const broadcasts=all.filter(n=>n.broadcast===true).map(n=>({...n,read:readBroadcasts.includes(n.id)}));
        // Merge and sort by createdAt desc
        const merged=[...personal,...broadcasts].sort((a,b)=>{
          const at=a.createdAt?.seconds||0,bt=b.createdAt?.seconds||0;
          return bt-at;
        }).slice(0,30);
        setNotifs(merged);
      }catch(e){console.log("notifs",e)}
    };
    fetchNotifs();
    const interval=setInterval(fetchNotifs,30000);
    return()=>clearInterval(interval);
  },[au,prof?.readBroadcasts]);

  // Click outside to close notification dropdown
  useEffect(()=>{
    if(!notifsOpen)return;
    const handler=(e)=>{
      // If click is on the bell button or inside the dropdown, ignore
      if(e.target.closest('[title="Notifications"]'))return;
      if(e.target.closest('[data-notif-dropdown]'))return;
      setNotifsOpen(false);
    };
    setTimeout(()=>document.addEventListener("click",handler),0);
    return()=>document.removeEventListener("click",handler);
  },[notifsOpen]);

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
  // ═══ PHARMA = sponsor only, can't post clinical content ═══
  const isPharma=prof?.accountType==="pharma";
  const myAns=quizzes.reduce((a,q)=>{if(q.answers?.[au?.uid]!==undefined)a.push({correct:q.answers[au.uid]===q.ci});return a},[]);
  const totA=myAns.length;const corr=myAns.filter(a=>a.correct).length;const acc=totA?Math.round(corr/totA*100):0;

  // ═══ AUTH ═══
  const doGoogleLogin=async()=>{setAuthErr("");try{await signInWithPopup(auth,gProv)}catch(e){if(e.code!=="auth/popup-closed-by-user")setAuthErr("Failed")}};
  const doEmailSignup=async()=>{setAuthErr("");if(!authName.trim())return setAuthErr("Enter name");if(!authEmail.trim())return setAuthErr("Enter email");if(authPass.length<6)return setAuthErr("6+ chars");setAuthBusy(true);try{const c=await createUserWithEmailAndPassword(auth,authEmail,authPass);await updateProfile(c.user,{displayName:authName})}catch(e){setAuthErr(e.code==="auth/email-already-in-use"?"Email registered":"Failed")}setAuthBusy(false)};
  const doEmailSignin=async()=>{setAuthErr("");if(!authEmail.trim())return setAuthErr("Enter email");if(!authPass)return setAuthErr("Enter password");setAuthBusy(true);try{await signInWithEmailAndPassword(auth,authEmail,authPass)}catch(e){setAuthErr(e.code==="auth/invalid-credential"?"Wrong email/password":"Failed")}setAuthBusy(false)};
  const doForgot=async()=>{setAuthErr("");if(!authEmail.trim())return setAuthErr("Enter email");setAuthBusy(true);try{await sendPasswordResetEmail(auth,authEmail);sh("📧 Reset sent!");setAuthMode("signin")}catch{setAuthErr("Failed")}setAuthBusy(false)};
  const doLogout=async()=>{if(confirm("Sign out?")){localStorage.removeItem("sk_welcome");setWelcomeSeen(false);await signOut(auth)}};
  const savePf=async()=>{
    setSetupErr("");
    // Validate by account type
    if(!pf.accountType){setSetupErr("Pick your account type to continue");return}
    if(!pf.name?.trim()){setSetupErr("Name is required");return}
    if(!pf.mobile?.trim()){setSetupErr("Mobile number is required");return}
    if(!pf.country){setSetupErr("Country is required");return}
    if(pf.accountType==="doctor"){
      if(!pf.degree){setSetupErr("Degree is required");return}
      // India uses dropdown, others use free-text
      if(pf.country==="India"){
        if(!pf.council){setSetupErr("Medical council is required");return}
      }else{
        if(!pf.internationalCouncil?.trim()){setSetupErr("Medical council/board name is required");return}
        if(!pf.city?.trim()){setSetupErr("City is required");return}
      }
      if(!pf.regNumber?.trim()){setSetupErr("Registration number is required");return}
      if(!pf.clinic?.trim()){setSetupErr("Clinic name is required");return}
    }
    if(pf.accountType==="pharma"){
      if(!pf.companyName?.trim()){setSetupErr("Company name is required");return}
      if(!pf.brandCategory){setSetupErr("Pick a brand category");return}
      if(!pf.contactPerson?.trim()){setSetupErr("Contact person is required");return}
    }
    if(pf.accountType==="institute"){
      if(!pf.instituteName?.trim()){setSetupErr("Institute name is required");return}
      if(!pf.instituteType){setSetupErr("Pick an institute type");return}
      if(!pf.directorName?.trim()){setSetupErr("Director / principal name is required");return}
    }

    // ═══ MCI / international DUPLICATE CHECK (for doctors) ═══
    let regFlagged=false;
    if(pf.accountType==="doctor"&&pf.regNumber){
      const cleaned=pf.regNumber.replace(/\s+/g,"").toLowerCase();
      const councilToCheck=pf.country==="India"?pf.council:pf.internationalCouncil;
      const dup=allUsers.find(u=>u.accountType==="doctor"&&u.regNumber&&u.regNumber.replace(/\s+/g,"").toLowerCase()===cleaned&&((u.country==="India"&&u.council===councilToCheck)||(u.country!=="India"&&u.internationalCouncil===councilToCheck))&&u.id!==au.uid);
      if(dup){
        regFlagged=true;
        await fbSet("users",dup.id,{regFlagged:true,regFlagReason:"Duplicate registration number detected. Match against another account."});
      }
    }

    const initials=(pf.name||"D").replace(/^Dr\.?\s*/i,"").split(" ").map(w=>w[0]||"").join("").toUpperCase().slice(0,2)||"D";
    const isInternational=pf.country!=="India";
    const p={
      name:pf.name.trim(),
      email:au.email,
      mobile:pf.mobile.trim(),
      photo:au.photoURL||"",
      country:pf.country,
      isInternational,
      accountType:pf.accountType,
      visibility:pf.visibility||"public",
      verified:false,
      regFlagged,
      regFlagReason:regFlagged?"Duplicate registration number detected. Please verify or correct it.":"",
      paid:false,
      joined:ds(getIST()),
      initials,
      totalCorrect:0,totalAnswered:0,streak:0,points:0,
      // Type-specific
      ...(pf.accountType==="doctor"?{
        degree:pf.degree,
        regNumber:pf.regNumber.trim(),
        clinic:pf.clinic.trim(),
        address:pf.address?.trim()||"",
        // India-specific OR international-specific council
        ...(pf.country==="India"?{council:pf.council}:{internationalCouncil:pf.internationalCouncil.trim(),city:pf.city.trim(),region:pf.region?.trim()||""})
      }:{}),
      ...(pf.accountType==="pharma"?{companyName:pf.companyName.trim(),brandCategory:pf.brandCategory,contactPerson:pf.contactPerson.trim(),website:pf.website?.trim()||"",address:pf.address?.trim()||""}:{}),
      ...(pf.accountType==="institute"?{instituteName:pf.instituteName.trim(),instituteType:pf.instituteType,directorName:pf.directorName.trim(),address:pf.address?.trim()||"",website:pf.website?.trim()||""}:{})
    };
    await fbSet("users",au.uid,p);
    localStorage.setItem("sk_p_"+au.uid,JSON.stringify(p));
    setProf(p);
    setScr("main");
    if(regFlagged){
      sh("⚠️ Welcome — but your registration number was flagged. Please review your profile.");
    }else{
      sh("Welcome to SKINARIO!");
    }
    loadData();
  };

  // ═══ LIKE TOGGLE (works for any collection) ═══
  // ═══ VIEW COUNT TRACKING ═══
  // Increments view count when user opens a content item. Per-session deduplication
  // (using sessionStorage) so refreshes don't inflate counts. Owner views don't count.
  const bumpView=async(colName,id,item,stateUpdater)=>{
    if(!id||!item)return;
    if(item.uid&&item.uid===au?.uid)return; // Don't count owner views
    const sessionKey=`sk_v_${colName}_${id}`;
    if(sessionStorage.getItem(sessionKey))return; // Already counted this session
    sessionStorage.setItem(sessionKey,"1");
    const newCount=(item.views||0)+1;
    try{
      await fbSet(colName,id,{views:newCount});
      if(stateUpdater)stateUpdater(prev=>prev.map(x=>x.id===id?{...x,views:newCount}:x));
    }catch(e){/* silent fail — don't disrupt UX for a view count */}
  };

  const toggleLike=async(colName,id,item,stateUpdater)=>{
    const likedBy=item.likedBy||[];const hasLiked=likedBy.includes(au.uid);
    const newLikedBy=hasLiked?likedBy.filter(u=>u!==au.uid):[...likedBy,au.uid];
    await fbSet(colName,id,{likedBy:newLikedBy,likes:newLikedBy.length});
    stateUpdater(p=>p.map(x=>x.id===id?{...x,likedBy:newLikedBy,likes:newLikedBy.length}:x));
    // Notify the author when liked (not on unlike)
    if(!hasLiked&&item.uid&&item.uid!==au.uid){
      const linkTypeMap={articles:"article",cases:"case",videos:"video",forum:"forum",events:"event",quizzes:"quiz",ads:"ad",resources:"resource"};
      createNotif({toUid:item.uid,fromUid:au.uid,fromName:uName,fromIni:uIni,fromPhoto:uPhoto,type:"like",text:`liked your ${linkTypeMap[colName]||"post"}`,linkType:linkTypeMap[colName],linkId:id,linkLabel:item.title||"your post"});
    }
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
  // ═══ RECOMPUTE POINTS for all users from quiz history ═══
  // Admin-only, run once after deploying new scoring system to fairly assign points to existing users.
  const recomputeAllPoints=async()=>{
    if(!confirm("This will recompute ALL users' points from their quiz answer history. It rewards 1pt (Easy), 2pt (Moderate), 3pt (Hard) per correct answer. Streak bonuses are NOT retroactive (no way to know historical streak order). Continue?"))return;
    sh("⏳ Recomputing... please wait");
    try{
      // Build a map: userId -> { points, totalAnswered, totalCorrect }
      const userStats={};
      // Read all quizzes (we already have them in `quizzes` state)
      quizzes.forEach(q=>{
        if(!q.answers||!q.ci===undefined)return;
        const diff=q.diff||"Easy";
        const pointsForCorrect=diff==="Hard"?3:diff==="Moderate"?2:1;
        Object.entries(q.answers).forEach(([uid,answerIdx])=>{
          if(!userStats[uid])userStats[uid]={points:0,totalAnswered:0,totalCorrect:0};
          userStats[uid].totalAnswered++;
          if(answerIdx===q.ci){
            userStats[uid].totalCorrect++;
            userStats[uid].points+=pointsForCorrect;
          }
        });
      });
      // Save back to each user
      const updates=Object.entries(userStats);
      let success=0,failed=0;
      for(const[uid,stats]of updates){
        try{
          await fbSet("users",uid,{points:stats.points,totalAnswered:stats.totalAnswered,totalCorrect:stats.totalCorrect});
          success++;
        }catch(e){failed++}
      }
      // Also update users with no answers — set points to 0 (in case they had stale data)
      for(const u of allUsers){
        if(!userStats[u.id]){
          try{await fbSet("users",u.id,{points:0});}catch{}
        }
      }
      // Update local current user if affected
      if(userStats[au.uid]){
        setProf(p=>({...p,...userStats[au.uid]}));
      }
      loadData();
      sh(`✅ Recomputed ${success} users${failed>0?` (${failed} failed)`:""}`);
    }catch(e){
      sh("❌ Recompute failed: "+e.message);
    }
  };

  const submitAnswer=async(qid,qObj,idx)=>{
    if(!au)return;
    const ok=idx===qObj.ci;
    const answers={...(qObj.answers||{}),[au.uid]:idx};
    await fbSet("quizzes",qid,{answers});
    // ═══ DIFFICULTY-WEIGHTED POINTS ═══
    let pointsEarned=0;
    if(ok){
      pointsEarned=qObj.diff==="Hard"?3:qObj.diff==="Moderate"?2:1;
    }
    const newStreak=ok?(prof.streak||0)+1:0;
    // Streak bonus: +5 every 7 consecutive days
    let streakBonus=0;
    if(ok&&newStreak>0&&newStreak%7===0){streakBonus=5}
    const totalEarned=pointsEarned+streakBonus;
    const upd={
      totalAnswered:(prof.totalAnswered||0)+1,
      totalCorrect:(prof.totalCorrect||0)+(ok?1:0),
      streak:newStreak,
      points:(prof.points||0)+totalEarned
    };
    await fbSet("users",au.uid,upd);
    setProf(p=>({...p,...upd}));
    setQuizzes(p=>p.map(q=>q.id===qid?{...q,answers}:q));
    if(ok){
      if(streakBonus>0){sh(`🎉 Correct! +${pointsEarned} points • 🔥 ${newStreak}-day streak bonus +${streakBonus}!`)}
      else{sh(`🎉 Correct! +${pointsEarned} points`)}
    }else{
      sh("Answer recorded. Try again tomorrow!");
    }
  };
  const addComment=async(qid,qObj)=>{if(!cmt.trim())return;const c={n:uName,ini:uIni,txt:cmt,tm:getIST().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true}),uid:au.uid,likedBy:[],likes:0};const comments=[...(qObj.comments||[]),c];await fbSet("quizzes",qid,{comments});setQuizzes(p=>p.map(q=>q.id===qid?{...q,comments}:q));setCmt("")};
  const genQuiz=async()=>{if(quizzes.find(q=>q.date===today)){sh("Already exists!");return}setLd(true);const q=await genQuizAI(today);if(q){const id=await fbAdd("quizzes",q);if(id){setQuizzes(p=>[{id,...q},...p]);sh("Question live!")}}else sh("Failed");setLd(false)};

  // ═══ CONTENT ═══
  const saveContent=async(type)=>{
    let d={...edForm.data};
    if(!d.title){sh("Title required");return}
    // Auto-normalize embed URLs for videos (and ad video field) so admins can paste any YouTube format
    if(d.embedUrl&&!d.embedUrl.includes("firebasestorage")&&!d.embedUrl.includes("storage.googleapis"))d.embedUrl=normalizeVideoUrl(d.embedUrl);
    if(d.video&&!d.video.includes("firebasestorage")&&!d.video.includes("storage.googleapis"))d.video=normalizeVideoUrl(d.video);
    if(edForm.editing){await fbSet(type,d.id,d);sh("Updated!")}else{await fbAdd(type,{...d,order:Date.now()});sh("Created!")}
    setEdForm(null);loadData()
  };
  const deleteContent=async(type,id,name)=>{if(!confirm(`Delete "${name}"?`))return;await fbDel(type,id);sh("Deleted");loadData()};

  // ═══ FORUM POST ═══
  const postForum=async()=>{if(!fpT.trim())return;await fbAdd("forum",{author:uName,ini:uIni,uid:au.uid,photo:uPhoto||"",title:fpT,cat:fpC,body:fpB,images:fpImgs,likedBy:[],likes:0,replies:0,date:ds(getIST())});setFpT("");setFpB("");setFpImgs([]);setNewForum(false);sh("Posted!");loadData()};

  // ═══ CLINICAL CASE POST ═══
  const postCase=async()=>{if(!ccT.trim()){sh("Title required");return}if(!ccImgs.length){sh("Add at least 1 image");return}await fbAdd("cases",{author:uName,ini:uIni,uid:au.uid,photo:uPhoto||"",title:ccT,cat:ccC,body:ccB,history:ccHistory,treatment:ccTreatment,outcome:ccOutcome,diagnosis:ccDiag,images:ccImgs,likedBy:[],likes:0,comments:[],date:ds(getIST())});setCcT("");setCcB("");setCcImgs([]);setCcDiag("");setCcHistory("");setCcTreatment("");setCcOutcome("");setNewCase(false);sh("Case posted!");loadData()};

  // ═══ CASE COMMENT ═══
  const addCaseComment=async(caseId,caseObj,txt)=>{
    if(!txt.trim())return;
    const c={n:uName,ini:uIni,txt,tm:getIST().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true}),uid:au.uid,likedBy:[],likes:0};
    const comments=[...(caseObj.comments||[]),c];
    await fbSet("cases",caseId,{comments});
    setCases(p=>p.map(x=>x.id===caseId?{...x,comments}:x));
    // Notify case author
    if(caseObj.uid&&caseObj.uid!==au.uid){
      createNotif({toUid:caseObj.uid,fromUid:au.uid,fromName:uName,fromIni:uIni,fromPhoto:uPhoto,type:"comment",text:"commented on your case",linkType:"case",linkId:caseId,linkLabel:caseObj.title});
    }
    // Notify mentions
    const mentioned=parseMentions(txt,allUsers);
    mentioned.forEach(u=>{
      if(u.id!==au.uid&&u.id!==caseObj.uid){
        createNotif({toUid:u.id,fromUid:au.uid,fromName:uName,fromIni:uIni,fromPhoto:uPhoto,type:"mention",text:"mentioned you in a case discussion",linkType:"case",linkId:caseId,linkLabel:caseObj.title});
      }
    });
  };

  const MIN_Q_FOR_RANK=5;
  const leaderboard=allUsers
    .filter(u=>(u.totalAnswered||0)>=MIN_Q_FOR_RANK)
    .sort((a,b)=>{
      // Primary: points
      const pDiff=(b.points||0)-(a.points||0);
      if(pDiff!==0)return pDiff;
      // Tiebreaker 1: accuracy
      const aAcc=a.totalAnswered?a.totalCorrect/a.totalAnswered:0;
      const bAcc=b.totalAnswered?b.totalCorrect/b.totalAnswered:0;
      if(bAcc!==aAcc)return bAcc-aAcc;
      // Tiebreaker 2: streak
      return(b.streak||0)-(a.streak||0);
    })
    .slice(0,20);
  const risingStars=allUsers
    .filter(u=>(u.totalAnswered||0)>0&&(u.totalAnswered||0)<MIN_Q_FOR_RANK)
    .sort((a,b)=>(b.totalAnswered||0)-(a.totalAnswered||0));

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
    <div style={{minHeight:"100vh",background:T.bg,padding:"24px 18px",fontFamily:"system-ui",color:T.txt}}>
      <div style={{maxWidth:560,margin:"0 auto"}}>

        {/* Logo + welcome */}
        <div style={{textAlign:"center",marginBottom:20}}>
          <Logo size={50}/>
          <h1 style={{fontSize:"1.4rem",fontWeight:300,color:T.txt,letterSpacing:4,fontFamily:"Georgia,serif",marginTop:6}}>SKINARIO</h1>
          <p style={{color:T.mute,fontSize:".82rem",marginTop:4}}>Cosmetology &amp; Aesthetic Community</p>
        </div>

        {/* Step indicator */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:18}}>
          {[0,1].map(i=><div key={i} style={{width:setupStep===i?28:8,height:8,borderRadius:4,background:setupStep>=i?T.teal:T.border,transition:"all .2s"}}/>)}
        </div>

        {/* ═══ STEP 0: Pick account type ═══ */}
        {setupStep===0&&<div style={{...T.card,padding:24}}>
          <h2 style={{fontSize:"1.15rem",fontWeight:700,marginBottom:6,color:T.txt}}>Welcome! Pick your account type</h2>
          <p style={{color:T.txt2,fontSize:".88rem",marginBottom:20,lineHeight:1.5}}>This helps us tailor SKINARIO for you. You can&apos;t change it later, so pick carefully.</p>

          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {ACCOUNT_TYPES.map(t=><button key={t.id} onClick={()=>setPf(p=>({...p,accountType:t.id}))} style={{textAlign:"left",padding:"14px 16px",border:`2px solid ${pf.accountType===t.id?T.teal:T.border}`,background:pf.accountType===t.id?T.tealBg:"#fff",borderRadius:12,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"flex-start",gap:14,transition:"all .15s"}}>
              <div style={{fontSize:"1.8rem",lineHeight:1}}>{t.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:".96rem",color:T.txt,marginBottom:3}}>{t.label}</div>
                <div style={{fontSize:".78rem",color:T.txt2,lineHeight:1.45}}>{t.desc}</div>
              </div>
              {pf.accountType===t.id&&<div style={{color:T.teal,fontSize:"1.1rem",fontWeight:700}}>✓</div>}
            </button>)}
          </div>

          <button onClick={()=>{
            if(!pf.accountType){setSetupErr("Pick an account type to continue");return}
            setSetupErr("");setSetupStep(1);
          }} style={{...T.btn,width:"100%",marginTop:18,padding:"12px 20px",opacity:pf.accountType?1:.5}}>Continue →</button>
          {setupErr&&<div style={{color:T.err,fontSize:".82rem",marginTop:10,textAlign:"center"}}>⚠️ {setupErr}</div>}
        </div>}

        {/* ═══ STEP 1: Type-specific form ═══ */}
        {setupStep===1&&<div style={{...T.card,padding:24}}>
          <button onClick={()=>{setSetupStep(0);setSetupErr("")}} style={{background:"none",border:"none",color:T.mute,fontSize:".82rem",cursor:"pointer",marginBottom:14,padding:0,fontFamily:"inherit"}}>← Back</button>

          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18,paddingBottom:14,borderBottom:"1px solid "+T.border}}>
            {uPhoto?<img src={uPhoto} style={{width:46,height:46,borderRadius:"50%",border:"2px solid "+T.tealBg}}/>:<div style={T.av(46,T.tealBg,T.teal)}>{uIni}</div>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:".66rem",color:T.gold,letterSpacing:1.5,textTransform:"uppercase",fontWeight:700,marginBottom:2}}>{ACCOUNT_TYPES.find(t=>t.id===pf.accountType)?.icon} {ACCOUNT_TYPES.find(t=>t.id===pf.accountType)?.label}</div>
              <div style={{fontSize:".82rem",color:T.txt2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{au?.email}</div>
            </div>
          </div>

          {/* COMMON FIELDS — name + mobile for everyone */}
          <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Full Name <span style={{color:T.err}}>*</span></label>
          <input value={pf.name} onChange={e=>setPf(p=>({...p,name:e.target.value}))} placeholder={pf.accountType==="doctor"?"e.g. Dr. Dhananjay Patil":pf.accountType==="institute"?"Your name (registered with institute)":"Your name"} style={{...T.inp,marginBottom:12}}/>

          <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Mobile <span style={{color:T.err}}>*</span></label>
          <input value={pf.mobile} onChange={e=>setPf(p=>({...p,mobile:e.target.value.replace(/[^0-9+\- ]/g,"")}))} placeholder="+91 98765 43210" style={{...T.inp,marginBottom:12}}/>

          {/* ═══ DOCTOR-SPECIFIC FIELDS ═══ */}
          {pf.accountType==="doctor"&&<>
            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Country <span style={{color:T.err}}>*</span></label>
            <select value={pf.country} onChange={e=>setPf(p=>({...p,country:e.target.value,council:"",internationalCouncil:""}))} style={{...T.inp,marginBottom:12}}>
              {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Primary Degree <span style={{color:T.err}}>*</span></label>
            <select value={pf.degree} onChange={e=>setPf(p=>({...p,degree:e.target.value}))} style={{...T.inp,marginBottom:12}}>
              <option value="">— Select —</option>{DEGREES.map(d=><option key={d} value={d}>{d}</option>)}
            </select>

            {/* India: dropdown of councils. Other countries: free-text council name + city/region */}
            {pf.country==="India"?<>
              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Medical Council <span style={{color:T.err}}>*</span></label>
              <select value={pf.council} onChange={e=>setPf(p=>({...p,council:e.target.value}))} style={{...T.inp,marginBottom:12}}>
                <option value="">— Select —</option>{COUNCILS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </>:<>
              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Medical Council / Board <span style={{color:T.err}}>*</span></label>
              <input value={pf.internationalCouncil} onChange={e=>setPf(p=>({...p,internationalCouncil:e.target.value}))} placeholder="e.g. GMC (UK), DHA (Dubai), Singapore Medical Council" style={{...T.inp,marginBottom:12}}/>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div>
                  <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>City <span style={{color:T.err}}>*</span></label>
                  <input value={pf.city} onChange={e=>setPf(p=>({...p,city:e.target.value}))} placeholder="e.g. Dubai" style={T.inp}/>
                </div>
                <div>
                  <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>State / Region</label>
                  <input value={pf.region} onChange={e=>setPf(p=>({...p,region:e.target.value}))} placeholder="e.g. Greater London" style={T.inp}/>
                </div>
              </div>
            </>}

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Registration / License Number <span style={{color:T.err}}>*</span></label>
            <input value={pf.regNumber} onChange={e=>setPf(p=>({...p,regNumber:e.target.value}))} placeholder={pf.country==="India"?"Your council registration number":"Your medical license number"} style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Clinic / Practice Name <span style={{color:T.err}}>*</span></label>
            <input value={pf.clinic} onChange={e=>setPf(p=>({...p,clinic:e.target.value}))} placeholder="e.g. Absolute Aesthetic Clinic" style={{...T.inp,marginBottom:12}}/>

            {pf.country==="India"&&<>
              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>City, State (optional)</label>
              <input value={pf.address} onChange={e=>setPf(p=>({...p,address:e.target.value}))} placeholder="e.g. Pune, Maharashtra" style={{...T.inp,marginBottom:12}}/>
            </>}
          </>}

          {/* ═══ PHARMA-SPECIFIC FIELDS ═══ */}
          {pf.accountType==="pharma"&&<>
            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Country <span style={{color:T.err}}>*</span></label>
            <select value={pf.country} onChange={e=>setPf(p=>({...p,country:e.target.value}))} style={{...T.inp,marginBottom:12}}>
              {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Company / Brand Name <span style={{color:T.err}}>*</span></label>
            <input value={pf.companyName} onChange={e=>setPf(p=>({...p,companyName:e.target.value}))} placeholder="e.g. Sun Pharma Aesthetics" style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Brand Category <span style={{color:T.err}}>*</span></label>
            <select value={pf.brandCategory} onChange={e=>setPf(p=>({...p,brandCategory:e.target.value}))} style={{...T.inp,marginBottom:12}}>
              <option value="">— Select —</option>{BRAND_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Contact Person Name <span style={{color:T.err}}>*</span></label>
            <input value={pf.contactPerson} onChange={e=>setPf(p=>({...p,contactPerson:e.target.value}))} placeholder="Person handling SKINARIO partnerships" style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Website (optional)</label>
            <input value={pf.website} onChange={e=>setPf(p=>({...p,website:e.target.value}))} placeholder="https://yourcompany.com" style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Address (optional)</label>
            <input value={pf.address} onChange={e=>setPf(p=>({...p,address:e.target.value}))} placeholder="City, State" style={{...T.inp,marginBottom:12}}/>
          </>}

          {/* ═══ INSTITUTE-SPECIFIC FIELDS ═══ */}
          {pf.accountType==="institute"&&<>
            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Country <span style={{color:T.err}}>*</span></label>
            <select value={pf.country} onChange={e=>setPf(p=>({...p,country:e.target.value}))} style={{...T.inp,marginBottom:12}}>
              {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Institute Name <span style={{color:T.err}}>*</span></label>
            <input value={pf.instituteName} onChange={e=>setPf(p=>({...p,instituteName:e.target.value}))} placeholder="e.g. Absolute Institute of Aesthetic Medicine" style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Institute Type <span style={{color:T.err}}>*</span></label>
            <select value={pf.instituteType} onChange={e=>setPf(p=>({...p,instituteType:e.target.value}))} style={{...T.inp,marginBottom:12}}>
              <option value="">— Select —</option>{INSTITUTE_TYPES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Director / Principal Name <span style={{color:T.err}}>*</span></label>
            <input value={pf.directorName} onChange={e=>setPf(p=>({...p,directorName:e.target.value}))} placeholder="Head of institute" style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Website (optional)</label>
            <input value={pf.website} onChange={e=>setPf(p=>({...p,website:e.target.value}))} placeholder="https://yourinstitute.com" style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Address (optional)</label>
            <input value={pf.address} onChange={e=>setPf(p=>({...p,address:e.target.value}))} placeholder="City, State" style={{...T.inp,marginBottom:12}}/>
          </>}

          {/* ═══ PROFILE VISIBILITY (everyone) ═══ */}
          <div style={{padding:"14px 16px",background:T.bg,borderRadius:10,marginTop:6,marginBottom:14}}>
            <div style={{fontSize:".72rem",color:T.teal,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Profile Visibility</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[
                {id:"public",icon:"🌐",label:"Public",desc:"Other doctors can see your profile"},
                {id:"private",icon:"🔒",label:"Private",desc:"Only you and admins can see your profile details"}
              ].map(opt=><label key={opt.id} style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",padding:"8px 10px",borderRadius:8,border:`1.5px solid ${pf.visibility===opt.id?T.teal:"transparent"}`,background:pf.visibility===opt.id?"#fff":"transparent"}}>
                <input type="radio" name="visibility" checked={pf.visibility===opt.id} onChange={()=>setPf(p=>({...p,visibility:opt.id}))} style={{marginTop:3}}/>
                <div>
                  <div style={{fontSize:".88rem",fontWeight:500,color:T.txt}}>{opt.icon} {opt.label}</div>
                  <div style={{fontSize:".74rem",color:T.txt2,marginTop:1}}>{opt.desc}</div>
                </div>
              </label>)}
            </div>
          </div>

          {setupErr&&<div style={{color:T.err,fontSize:".84rem",marginBottom:10,padding:"8px 12px",background:T.errBg,borderRadius:8}}>⚠️ {setupErr}</div>}

          <button onClick={savePf} style={{...T.btn,width:"100%",padding:"12px 20px",fontSize:".95rem"}}>Complete signup →</button>
          <p style={{fontSize:".7rem",color:T.mute,marginTop:10,textAlign:"center",lineHeight:1.5}}>By signing up you agree to use SKINARIO professionally and respectfully. You can edit additional details (bio, photo, social links) anytime from your profile.</p>
        </div>}
      </div>
    </div>);

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

            {/* 🔔 Notifications bell */}
            {(()=>{const unread=notifs.filter(n=>!n.read).length;return(<div style={{position:"relative",marginLeft:6}}>
              <button onClick={()=>setNotifsOpen(o=>!o)} style={{background:notifsOpen?T.tealBg:"none",border:"none",padding:"5px 9px",borderRadius:9,cursor:"pointer",fontSize:".85rem",position:"relative"}} title="Notifications">
                🔔
                {unread>0&&<span style={{position:"absolute",top:1,right:1,minWidth:16,height:16,borderRadius:8,background:"#dc3545",color:"#fff",fontSize:".58rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px",border:"2px solid #fff"}}>{unread>9?"9+":unread}</span>}
              </button>
              {/* Notification dropdown */}
              {notifsOpen&&<div data-notif-dropdown style={{position:"absolute",top:"calc(100% + 8px)",right:-10,width:340,maxHeight:480,background:"#fff",borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",border:"1px solid "+T.border,zIndex:500,overflow:"hidden",display:"flex",flexDirection:"column"}}>
                <div style={{padding:"12px 16px",borderBottom:"1px solid "+T.border,display:"flex",justifyContent:"space-between",alignItems:"center",background:T.bg}}>
                  <div style={{fontWeight:700,fontSize:".92rem"}}>🔔 Notifications</div>
                  {unread>0&&<button onClick={async()=>{
                    // Mark personal notifs as read in their docs
                    const personalUnread=notifs.filter(n=>!n.read&&!n.broadcast);
                    await Promise.all(personalUnread.map(n=>fbSet("notifications",n.id,{read:true})));
                    // Mark broadcasts as read by appending their IDs to user's readBroadcasts list
                    const broadcastUnread=notifs.filter(n=>!n.read&&n.broadcast);
                    if(broadcastUnread.length){
                      const newReadBroadcasts=[...(prof?.readBroadcasts||[]),...broadcastUnread.map(b=>b.id)];
                      await fbSet("users",au.uid,{readBroadcasts:newReadBroadcasts});
                      setProf(p=>({...p,readBroadcasts:newReadBroadcasts}));
                    }
                    setNotifs(p=>p.map(n=>({...n,read:true})));
                  }} style={{background:"none",border:"none",color:T.teal,fontSize:".74rem",cursor:"pointer",fontWeight:500,fontFamily:"inherit"}}>Mark all read</button>}
                </div>
                <div style={{flex:1,overflowY:"auto"}}>
                  {notifs.length===0?<div style={{padding:30,textAlign:"center",color:T.mute,fontSize:".85rem"}}><div style={{fontSize:"2rem",marginBottom:6}}>🔕</div>No notifications yet.<div style={{fontSize:".72rem",marginTop:4}}>You'll see comments, likes, and mentions here.</div></div>
                  :notifs.map(n=><div key={n.id} onClick={async()=>{
                    if(!n.read){
                      if(n.broadcast){
                        const newReadBroadcasts=[...(prof?.readBroadcasts||[]),n.id];
                        await fbSet("users",au.uid,{readBroadcasts:newReadBroadcasts});
                        setProf(p=>({...p,readBroadcasts:newReadBroadcasts}));
                      }else{
                        await fbSet("notifications",n.id,{read:true});
                      }
                      setNotifs(p=>p.map(x=>x.id===n.id?{...x,read:true}:x));
                    }
                    // Navigate to source
                    if(n.linkType==="article"){const a=articles.find(x=>x.id===n.linkId);if(a){setSelA(a);go("home")}}
                    else if(n.linkType==="case"){go("cases")}
                    else if(n.linkType==="video"){const v=videos.find(x=>x.id===n.linkId);if(v){setSelV(v);go("videos")}}
                    else if(n.linkType==="forum"){go("forum")}
                    else if(n.linkType==="event"){const e=events.find(x=>x.id===n.linkId);if(e){setSelE(e);go("events")}}
                    else if(n.linkType==="quiz"){go("quiz")}
                    setNotifsOpen(false);
                  }} style={{padding:"12px 14px",borderBottom:"1px solid "+T.border,cursor:"pointer",background:n.read?"#fff":(n.type==="announcement"?"#fdf6e3":"#fef9ef"),borderLeft:n.type==="announcement"?"3px solid "+T.gold:"none",display:"flex",gap:10,alignItems:"flex-start"}}>
                    {n.type==="announcement"?<div style={{...T.av(36,T.goldBg,T.goldD),flexShrink:0,fontSize:"1.1rem"}}>📣</div>:n.fromPhoto?<img src={n.fromPhoto} style={{width:36,height:36,borderRadius:"50%",objectFit:"cover",flexShrink:0}}/>:<div style={{...T.av(36,T.tealBg,T.teal),flexShrink:0}}>{n.fromIni}</div>}
                    <div style={{flex:1,minWidth:0}}>
                      {n.type==="announcement"?<>
                        <div style={{fontSize:".68rem",color:T.goldD,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>📣 Announcement{n.fromName?` from ${n.fromName}`:""}</div>
                        {n.title&&<div style={{fontSize:".88rem",fontWeight:600,color:T.txt,marginBottom:3,lineHeight:1.35}}>{n.title}</div>}
                        <div style={{fontSize:".82rem",color:T.txt2,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{n.text}</div>
                      </>:<>
                        <div style={{fontSize:".82rem",lineHeight:1.4}}><b>{n.fromName}</b> <span style={{color:T.txt2}}>{n.text}</span></div>
                        {n.linkLabel&&<div style={{fontSize:".74rem",color:T.mute,marginTop:2,fontStyle:"italic",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>"{n.linkLabel}"</div>}
                      </>}
                      <div style={{fontSize:".68rem",color:T.mute,marginTop:3,display:"flex",gap:6,alignItems:"center"}}>
                        <span style={{fontSize:".7rem"}}>{n.type==="like"?"❤️":n.type==="comment"?"💬":n.type==="mention"?"@":n.type==="reply"?"↩️":n.type==="announcement"?"📣":"🔔"}</span>
                        <span>{relTime(n.createdAt)}</span>
                        {!n.read&&<span style={{width:6,height:6,borderRadius:"50%",background:n.type==="announcement"?T.gold:T.teal,marginLeft:"auto"}}/>}
                      </div>
                    </div>
                  </div>)}
                </div>
              </div>}
            </div>)})()}

            {uPhoto?<img src={uPhoto} onClick={()=>go("me")} style={{width:30,height:30,borderRadius:"50%",border:"2px solid "+T.tealBg,marginLeft:6,cursor:"pointer"}}/>:<div onClick={()=>go("me")} style={{...T.av(30,T.tealBg,T.teal),marginLeft:6,cursor:"pointer"}}>{uIni}</div>}
          </div>
        </div>
      </div>

      <div style={{maxWidth:W,margin:"0 auto",padding:"18px 24px"}}>

      {/* HOME */}
      {pg==="home"&&!selA&&<div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 360px",gap:20,alignItems:"start"}} className="home-grid">
        <div style={{minWidth:0}}>{/* MAIN COLUMN */}
        {/* Complete-your-profile banner — shown if user is on legacy schema (no accountType) */}
        {prof&&!prof.accountType&&<div style={{...T.card,borderLeft:"3px solid "+T.gold,background:T.goldBg,padding:18,marginBottom:14,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{fontSize:"1.6rem"}}>🎯</div>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:".95rem",fontWeight:600,color:T.txt,marginBottom:3}}>Complete your profile</div>
            <div style={{fontSize:".82rem",color:T.txt2,lineHeight:1.55}}>SKINARIO has been upgraded with new account types and country support. Add your details so other doctors can find you and you appear in the directory.</div>
          </div>
          <button onClick={()=>{
            // Pre-fill edit form with current profile
            setEditPf({
              name:prof?.name||"",
              mobile:prof?.mobile||"",
              accountType:prof?.accountType||"",
              country:prof?.country||"India",
              degree:prof?.degree||"",
              council:prof?.council||"",
              internationalCouncil:prof?.internationalCouncil||"",
              regNumber:prof?.regNumber||"",
              clinic:prof?.clinic||"",
              address:prof?.address||"",
              city:prof?.city||"",
              region:prof?.region||"",
              visibility:prof?.visibility||"public",
              companyName:prof?.companyName||"",
              brandCategory:prof?.brandCategory||"",
              contactPerson:prof?.contactPerson||"",
              website:prof?.website||"",
              instituteName:prof?.instituteName||"",
              instituteType:prof?.instituteType||"",
              directorName:prof?.directorName||"",
              bio:prof?.bio||""
            });
            setEditingProfile(true);
            setEditErr("");
            go("me");
            window.scrollTo(0,0);
          }} style={{...T.btn,padding:"10px 18px",fontSize:".85rem",background:"linear-gradient(135deg,"+T.gold+","+T.goldD+")"}}>Complete now →</button>
        </div>}

        <div style={{...T.card,borderLeft:"3px solid "+T.gold,padding:24}}>
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:14,flexWrap:"wrap"}}>
            {uPhoto?<img src={uPhoto} style={{width:52,height:52,borderRadius:"50%",border:"2px solid "+T.teal}}/>:<div style={T.av(52,T.tealBg,T.teal)}>{uIni}</div>}
            <div style={{flex:1,minWidth:200}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <h2 style={{fontSize:"1.4rem",fontWeight:700,margin:0}}>Welcome, {uName.split(" ")[0]} 👋</h2>
                {prof?.accountType==="doctor"&&(()=>{const t=getTier(prof?.points||0);if(t.id==="beginner")return null;return<span style={{padding:"3px 9px",borderRadius:12,fontSize:".7rem",fontWeight:700,letterSpacing:.5,background:t.bg,color:t.color,whiteSpace:"nowrap"}}>{t.label}</span>;})()}
              </div>
              <p style={{color:T.txt2,fontSize:".9rem",marginTop:3}}>Daily quizzes, clinical cases & community.</p>
            </div>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button onClick={()=>go("quiz")} style={T.btn}>🧠 Today's quiz</button><button onClick={()=>go("events")} style={T.btnO}>📅 Events</button><button onClick={()=>go("cases")} style={T.btnO}>🔬 Clinical cases</button><button onClick={()=>go("forum")} style={T.btnO}>💬 Forum</button></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,margin:"16px 0"}}>
          {[
            ["🧠",totA,"Quizzes",()=>go("quiz")],
            ["✅",acc+"%","Accuracy",()=>go("rank")],
            ["⭐",prof?.points||0,"Points",()=>go("rank")],
            ["🔬",cases.length,"Cases",()=>go("cases")],
            ["💬",forumPosts.length,"Forum",()=>go("forum")],
            ["🎥",videos.length,"Videos",()=>go("videos")]
          ].map(([i,v,l,onClick])=>
            <div key={l} onClick={onClick} style={{...T.card,textAlign:"center",padding:"12px 4px",marginBottom:0,cursor:"pointer",transition:"transform .1s, box-shadow .1s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 4px 14px rgba(0,0,0,0.05)"}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}><div style={{fontSize:"1rem"}}>{i}</div><div style={{fontSize:"1.2rem",fontWeight:700,color:T.teal}}>{v}</div><div style={{fontSize:".55rem",color:T.mute,textTransform:"uppercase",marginTop:2}}>{l}</div></div>)}
        </div>
        <h3 style={{fontSize:"1.05rem",fontWeight:700,marginBottom:12}}>Latest articles</h3>
        {articles.length===0&&<p style={{color:T.mute}}>No articles yet. Admins can create them from Admin panel.</p>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {articles.slice(0,articleLimit).map(a=><div key={a.id} onClick={()=>{setSelA(a);bumpView("articles",a.id,a,setArticles)}} style={{...T.card,cursor:"pointer",marginBottom:0,overflow:"hidden",padding:0,position:"relative"}}>
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
                <div style={{display:"flex",gap:8,fontSize:".7rem",color:T.mute,flexShrink:0}}><span>❤️ {a.likes||0}</span><span>💬 {a.comments?.length||0}</span>{(a.views||0)>0&&<span>👁️ {a.views}</span>}</div>
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
            (prof?.saved?.videos||[]).forEach(id=>{const v=videos.find(x=>x.id===id);if(v)items.push({icon:"🎥",label:"Video",title:v.title||v.t,onClick:()=>{go("videos");setSelV(v)},thumb:getVideoThumbnail(v.embedUrl)})});
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

            <CommentThread collection="articles" itemId={selA.id} item={selA} currentUser={au} uName={uName} uIni={uIni} uPhoto={uPhoto} allUsers={allUsers} onUpdate={(id,comments)=>{setArticles(p=>p.map(x=>x.id===id?{...x,comments}:x));setSelA(p=>({...p,comments}))}}/>
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
              (prof?.saved?.videos||[]).forEach(id=>{const v=videos.find(x=>x.id===id);if(v)items.push({icon:"🎥",label:"Video",title:v.title||v.t,onClick:()=>{go("videos");setSelV(v)},thumb:getVideoThumbnail(v.embedUrl)})});
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
        {!ld&&qObj&&<div className="quiz-grid" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 340px",gap:16,alignItems:"start"}}>
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
          <style>{`
            @media (max-width: 900px) {
              .quiz-grid { grid-template-columns: 1fr !important; }
            }
          `}</style>
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
            <CommentThread collection="resources" itemId={r.id} item={r} currentUser={au} uName={uName} uIni={uIni} uPhoto={uPhoto} allUsers={allUsers} onUpdate={(id,comments)=>setResources(p=>p.map(x=>x.id===id?{...x,comments}:x))}/>
          </div>)}
        </div>
      </div>}

      {/* VIDEOS */}
      {pg==="videos"&&!selV&&(()=>{
        const q=videoSearch.trim().toLowerCase();
        const filtered=videos.filter(v=>{
          if(videoFilter!=="all"&&v.cat!==videoFilter)return false;
          if(q){
            const t=(v.title||v.t||"").toLowerCase();
            const d=(v.desc||"").toLowerCase();
            const c=(v.cat||"").toLowerCase();
            if(!t.includes(q)&&!d.includes(q)&&!c.includes(q))return false;
          }
          return true;
        });
        // Build category counts dynamically — only show categories that actually have videos
        const catCounts={};
        videos.forEach(v=>{const c=v.cat||"General";catCounts[c]=(catCounts[c]||0)+1});
        const sortedCats=Object.entries(catCounts).sort((a,b)=>b[1]-a[1]);

        return(<div>
          {/* Hero header with stats */}
          <div style={{...T.card,padding:22,background:"linear-gradient(135deg,#fff,"+T.tealBg+"55)",borderLeft:"3px solid "+T.teal,marginBottom:14}}>
            <h2 style={{fontSize:"1.4rem",fontWeight:700,margin:0,display:"flex",alignItems:"center",gap:8}}>🎥 Video Library</h2>
            <p style={{color:T.txt2,fontSize:".88rem",marginTop:6,maxWidth:560,lineHeight:1.55}}>Curated educational videos on aesthetic procedures, techniques, and case studies.</p>
            <div style={{display:"flex",gap:14,marginTop:10,fontSize:".75rem",color:T.mute}}>
              <span><b style={{color:T.teal,fontSize:".9rem"}}>{videos.length}</b> videos</span>
              <span><b style={{color:T.teal,fontSize:".9rem"}}>{sortedCats.length}</b> categories</span>
              <span><b style={{color:T.teal,fontSize:".9rem"}}>{videos.filter(v=>v.free).length}</b> free</span>
            </div>
          </div>

          {/* Search bar */}
          <div style={{position:"relative",marginBottom:12}}>
            <input value={videoSearch} onChange={e=>setVideoSearch(e.target.value)} placeholder="🔍 Search videos by title, description, or category..." style={{...T.inp,padding:"11px 16px 11px 16px",fontSize:".88rem"}}/>
            {videoSearch&&<button onClick={()=>setVideoSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",fontSize:"1rem",color:T.mute,cursor:"pointer",padding:4}}>✕</button>}
          </div>

          {/* Category filter chips */}
          {sortedCats.length>0&&<div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:14,flexWrap:"wrap"}}>
            <button onClick={()=>setVideoFilter("all")} style={{padding:"7px 14px",borderRadius:20,border:`1.5px solid ${videoFilter==="all"?T.teal:T.border}`,background:videoFilter==="all"?T.tealBg:"#fff",color:videoFilter==="all"?T.teal:T.mute,cursor:"pointer",fontSize:".78rem",fontWeight:videoFilter==="all"?600:400,fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>🎬 All <span style={{opacity:.6}}>{videos.length}</span></button>
            {sortedCats.map(([cat,count])=><button key={cat} onClick={()=>setVideoFilter(cat)} style={{padding:"7px 14px",borderRadius:20,border:`1.5px solid ${videoFilter===cat?T.teal:T.border}`,background:videoFilter===cat?T.tealBg:"#fff",color:videoFilter===cat?T.teal:T.mute,cursor:"pointer",fontSize:".78rem",fontWeight:videoFilter===cat?600:400,fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>{cat} <span style={{opacity:.6}}>{count}</span></button>)}
          </div>}

          {/* Empty states */}
          {videos.length===0&&<div style={{...T.card,textAlign:"center",padding:40}}><div style={{fontSize:"2.4rem",marginBottom:8}}>🎥</div><p style={{color:T.mute}}>No videos yet.</p></div>}
          {videos.length>0&&filtered.length===0&&<div style={{...T.card,textAlign:"center",padding:40}}>
            <div style={{fontSize:"2.4rem",marginBottom:8}}>🔍</div>
            <p style={{color:T.mute,fontSize:".9rem"}}>No videos match your search{videoFilter!=="all"?` in "${videoFilter}"`:""}.</p>
            <button onClick={()=>{setVideoSearch("");setVideoFilter("all")}} style={{...T.btnO,...T.btnSm,marginTop:10}}>Clear filters</button>
          </div>}

          {/* Grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
            {filtered.map(v=>{const thumb=getVideoThumbnail(v.embedUrl);return(<div key={v.id} onClick={()=>{setSelV(v);bumpView("videos",v.id,v,setVideos)}} style={{...T.card,cursor:"pointer",marginBottom:0,padding:0,overflow:"hidden"}}>
              <div style={{height:160,position:"relative",background:thumb?"#000":"linear-gradient(135deg,#e1f5ee,#d0ede5)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                {thumb?<img src={thumb} alt={v.title||v.t} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={(e)=>{e.target.style.display="none"}}/>:<span style={{fontSize:"2.5rem"}}>{v.icon||"🎥"}</span>}
                {thumb&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.15)",transition:"background 0.2s"}}>
                  <div style={{width:54,height:54,borderRadius:"50%",background:"rgba(0,0,0,0.78)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(0,0,0,0.35)"}}>
                    <div style={{width:0,height:0,borderLeft:"16px solid #fff",borderTop:"10px solid transparent",borderBottom:"10px solid transparent",marginLeft:4}}/>
                  </div>
                </div>}
                {!v.free&&!isPd&&<div style={{position:"absolute",top:8,right:8,...T.tag(T.goldBg,T.goldD),fontWeight:600}}>🔒 Premium</div>}
                {v.dur&&<div style={{position:"absolute",bottom:8,right:8,fontSize:".7rem",background:"rgba(0,0,0,0.78)",padding:"3px 8px",borderRadius:4,color:"#fff",fontWeight:500}}>{v.dur}</div>}
              </div>
              <div style={{padding:14}}>
                <span style={T.tag(T.tealBg,T.teal)}>{v.cat||"General"}</span>
                <h4 style={{fontSize:".95rem",fontWeight:600,marginTop:8,lineHeight:1.35}}>{v.title||v.t}</h4>
                {v.desc&&<p style={{fontSize:".75rem",color:T.txt2,marginTop:6,lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{v.desc}</p>}
                <div style={{display:"flex",gap:12,marginTop:8,fontSize:".72rem",color:T.mute}}><span>❤️ {v.likes||0}</span><span>💬 {v.comments?.length||0}</span>{(v.views||0)>0&&<span>👁️ {v.views}</span>}</div>
              </div>
            </div>)})}
          </div>
        </div>);
      })()}
      {pg==="videos"&&selV&&<div><button onClick={()=>setSelV(null)} style={{...T.btnO,...T.btnSm,marginBottom:14}}>← Back</button>
        <div style={{...T.card,maxWidth:720}}>{(()=>{
          const videoSrc=selV.videoFile||selV.embedUrl;
          const isDirect=videoSrc&&(videoSrc.includes("firebasestorage")||videoSrc.includes("storage.googleapis")||/\.(mp4|webm|ogg|mov)(\?|$)/i.test(videoSrc));
          const canPlay=videoSrc&&(selV.free||isPd);
          if(canPlay&&isDirect)return(<div style={{position:"relative",paddingBottom:"56.25%",height:0,borderRadius:12,overflow:"hidden",marginBottom:16,background:"#000"}}><video src={videoSrc} controls style={{position:"absolute",top:0,left:0,width:"100%",height:"100%"}}/></div>);
          if(canPlay)return(<div style={{position:"relative",paddingBottom:"56.25%",height:0,borderRadius:12,overflow:"hidden",marginBottom:16}}><iframe src={videoSrc} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:0}} allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"/></div>);
          if(!videoSrc)return(<div style={{height:200,borderRadius:12,background:"linear-gradient(135deg,#e1f5ee,#c8ebe0)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}><p style={{color:T.teal}}>▶️ No video URL set</p></div>);
          // Premium gate
          return(<div style={{height:200,borderRadius:12,background:"linear-gradient(135deg,#e1f5ee,#c8ebe0)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}><div style={{textAlign:"center"}}><p style={{color:T.teal,fontWeight:600}}>🔒 Premium</p><button style={{...T.btnGold,marginTop:8}}>₹999/mo</button></div></div>);
        })()}
          <h3 style={{fontWeight:700,fontSize:"1.2rem"}}>{selV.title||selV.t}</h3><p style={{color:T.mute,fontSize:".82rem",marginTop:4}}>{selV.dur}</p><p style={{color:T.txt2,marginTop:12,lineHeight:1.8}}>{selV.desc}</p>
          <div style={{display:"flex",alignItems:"center",gap:12,marginTop:16,paddingTop:14,borderTop:"1px solid "+T.border,flexWrap:"wrap"}}>
            <LikeBtn liked={(selV.likedBy||[]).includes(au?.uid)} count={selV.likes||0} onToggle={()=>{toggleLike("videos",selV.id,selV,setVideos);setSelV(p=>{const lb=p.likedBy||[];const has=lb.includes(au.uid);const nlb=has?lb.filter(u=>u!==au.uid):[...lb,au.uid];return{...p,likedBy:nlb,likes:nlb.length}})}}/>
            <ShareBar title={selV.title||selV.t} url={`${window.location.origin}/?video=${selV.id}`} description={selV.desc?.slice(0,120)} itemId={selV.id} itemType="videos" currentUser={au} prof={prof} onSaveToggle={toggleSave}/>
          </div>
          <CommentThread collection="videos" itemId={selV.id} item={selV} currentUser={au} uName={uName} uIni={uIni} uPhoto={uPhoto} allUsers={allUsers} onUpdate={(id,comments)=>{setVideos(p=>p.map(x=>x.id===id?{...x,comments}:x));setSelV(p=>({...p,comments}))}}/>
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
              return<div key={e.id} onClick={()=>{setSelE(e);bumpView("events",e.id,e,setEvents)}} style={{...T.card,cursor:"pointer",marginBottom:0,padding:0,overflow:"hidden",opacity:isPast?.85:1}}>
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
                    {(e.views||0)>0&&<div style={{marginTop:4,color:T.mute,fontSize:".7rem"}}>👁️ {e.views} views</div>}
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
              <CommentThread collection="events" itemId={selE.id} item={selE} currentUser={au} uName={uName} uIni={uIni} uPhoto={uPhoto} allUsers={allUsers} onUpdate={(id,comments)=>{setEvents(p=>p.map(x=>x.id===id?{...x,comments}:x));setSelE(p=>({...p,comments}))}}/>
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
            {isPharma?<div style={{padding:"10px 14px",background:T.goldBg,border:"1px solid "+T.gold+"55",borderRadius:8,fontSize:".82rem",color:T.goldD,maxWidth:280}}>📢 Pharma accounts can sponsor cases & content. Contact us at <a href="mailto:partnerships@skinario.com" style={{color:T.goldD,fontWeight:600}}>partnerships@skinario.com</a>.</div>
            :<button onClick={()=>setNewCase(true)} style={{...T.btn,padding:"13px 26px",fontSize:".95rem",background:"linear-gradient(135deg,"+T.gold+","+T.goldD+")"}}>📋 Post a new case</button>}
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
              <div style={{position:"relative",background:"#f4f1ea",borderRadius:10,overflow:"hidden",cursor:"zoom-in",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>{const v=document.createElement("div");v.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:20px";const im=document.createElement("img");im.src=cs.images[0];im.style.cssText="max-width:95%;max-height:95%;border-radius:8px";v.appendChild(im);v.onclick=()=>v.remove();document.body.appendChild(v)}}>
                <img src={cs.images[0]} style={{width:"100%",maxHeight:600,objectFit:"contain",display:"block"}}/>
                <div style={{position:"absolute",bottom:8,right:8,background:"rgba(0,0,0,0.55)",color:"#fff",padding:"3px 9px",borderRadius:4,fontSize:".62rem",letterSpacing:.5,fontWeight:500,pointerEvents:"none"}}>🔍 Click to enlarge</div>
              </div>
            :<div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:6,scrollSnapType:"x mandatory"}}>
              {cs.images.map((url,i)=><div key={i} style={{flexShrink:0,width:cs.images.length===2?"calc(50% - 4px)":300,height:cs.images.length===2?340:300,background:"#f4f1ea",borderRadius:10,scrollSnapAlign:"start",cursor:"zoom-in",position:"relative",overflow:"hidden"}} onClick={()=>{const v=document.createElement("div");v.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:20px";const im=document.createElement("img");im.src=url;im.style.cssText="max-width:95%;max-height:95%;border-radius:8px";v.appendChild(im);v.onclick=()=>v.remove();document.body.appendChild(v)}}>
                <img src={url} style={{width:"100%",height:"100%",objectFit:"contain",display:"block"}}/>
                <div style={{position:"absolute",bottom:6,right:6,background:"rgba(0,0,0,0.55)",color:"#fff",padding:"2px 7px",borderRadius:3,fontSize:".58rem",fontWeight:500,pointerEvents:"none"}}>🔍 {i+1}/{cs.images.length}</div>
              </div>)}
            </div>}
          </div>}

          <div style={{padding:18}}>
            {/* Author + meta */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              {cs.photo?<img src={cs.photo} onClick={()=>viewProfile(cs.uid)} style={{width:36,height:36,borderRadius:"50%",cursor:"pointer"}}/>:<div onClick={()=>viewProfile(cs.uid)} style={{...T.av(36,T.tealBg,T.teal),cursor:"pointer"}}>{cs.ini||"?"}</div>}
              <div style={{flex:1}}>
                <b onClick={()=>viewProfile(cs.uid)} style={{fontSize:".88rem",cursor:"pointer"}}>{cs.author}</b>
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
              <LikeBtn liked={(cs.likedBy||[]).includes(au?.uid)} count={cs.likes||0} onToggle={()=>{toggleLike("cases",cs.id,cs,setCases);bumpView("cases",cs.id,cs,setCases)}}/>
              <span style={{fontSize:".75rem",color:T.mute}}>💬 {cs.comments?.length||0} comments</span>
              {(cs.views||0)>0&&<span style={{fontSize:".75rem",color:T.mute}}>👁️ {cs.views} views</span>}
              <ShareBar title={cs.title} url={`${window.location.origin}/?case=${cs.id}`} description={(cs.history||cs.body||"").slice(0,120)} itemId={cs.id} itemType="cases" currentUser={au} prof={prof} onSaveToggle={toggleSave}/>
            </div>

            {/* Comments */}
            {(cs.comments||[]).length>0&&<div style={{marginTop:12,paddingLeft:10,borderLeft:"2px solid "+T.border}}>
              {cs.comments.map((x,i)=><div key={i} style={{padding:"6px 0",fontSize:".85rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}><div style={T.av(20,T.tealBg,T.teal)}>{x.ini}</div><b style={{color:T.txt,fontSize:".82rem"}}>{x.n}</b><span style={{color:T.mute,fontSize:".62rem"}}>{x.tm}</span></div>
                <div style={{color:T.txt2,paddingLeft:26,lineHeight:1.5}}>{renderTextWithMentions(x.txt)}</div>
              </div>)}
            </div>}
            <CaseCmtInput caseId={cs.id} caseObj={cs} addCaseComment={addCaseComment} allUsers={allUsers}/>
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
              {isPharma?<div style={{padding:"10px 14px",background:T.goldBg,border:"1px solid "+T.gold+"55",borderRadius:8,fontSize:".82rem",color:T.goldD,maxWidth:280}}>📢 Pharma accounts can sponsor discussions. Reach out to <a href="mailto:partnerships@skinario.com" style={{color:T.goldD,fontWeight:600}}>partnerships@skinario.com</a>.</div>
              :<button onClick={()=>setNewForum(!newForum)} style={{...T.btn,padding:"12px 26px",fontSize:".92rem"}}>{newForum?"Cancel":"✏️ Start a discussion"}</button>}
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
            {/* Hero image — single posters/photos display full image, never cropped */}
            {hasImg&&(p.images.length===1?
              <div style={{width:"100%",background:"#f4f1ea",cursor:"zoom-in",position:"relative",display:"flex",justifyContent:"center",alignItems:"center"}} onClick={()=>{const v=document.createElement("div");v.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:20px";const im=document.createElement("img");im.src=p.images[0];im.style.cssText="max-width:95%;max-height:95%;border-radius:8px";v.appendChild(im);v.onclick=()=>v.remove();document.body.appendChild(v)}}>
                <img src={p.images[0]} style={{width:"100%",maxHeight:640,objectFit:"contain",display:"block"}}/>
                <div style={{position:"absolute",bottom:8,right:8,background:"rgba(0,0,0,0.55)",color:"#fff",padding:"3px 9px",borderRadius:4,fontSize:".62rem",letterSpacing:.5,fontWeight:500,pointerEvents:"none"}}>🔍 Click to enlarge</div>
              </div>
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
                {p.photo?<img src={p.photo} onClick={()=>viewProfile(p.uid)} style={{width:42,height:42,borderRadius:"50%",border:"2px solid "+T.tealBg,cursor:"pointer"}}/>:<div onClick={()=>viewProfile(p.uid)} style={{...T.av(42,T.tealBg,T.teal),border:"2px solid "+T.tealBg,cursor:"pointer"}}>{p.ini||"?"}</div>}
                <div style={{flex:1}}>
                  <b onClick={()=>viewProfile(p.uid)} style={{fontSize:".92rem",color:T.txt,cursor:"pointer"}}>{p.author}</b>
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
                <LikeBtn liked={(p.likedBy||[]).includes(au?.uid)} count={p.likes||0} onToggle={()=>{toggleLike("forum",p.id,p,setForumPosts);bumpView("forum",p.id,p,setForumPosts)}}/>
                <span style={{fontSize:".78rem",color:T.mute,display:"flex",alignItems:"center",gap:4}}>💬 {p.comments?.length||0} {p.comments?.length===1?"reply":"replies"}</span>
                {(p.views||0)>0&&<span style={{fontSize:".78rem",color:T.mute,display:"flex",alignItems:"center",gap:4}}>👁️ {p.views}</span>}
                <ShareBar title={p.title} url={`${window.location.origin}/?forum=${p.id}`} description={p.body?.slice(0,120)} itemId={p.id} itemType="forum" currentUser={au} prof={prof} onSaveToggle={toggleSave}/>
              </div>

              {/* Comment thread */}
              <CommentThread collection="forum" itemId={p.id} item={p} currentUser={au} uName={uName} uIni={uIni} uPhoto={uPhoto} allUsers={allUsers} onUpdate={(id,comments)=>setForumPosts(prev=>prev.map(x=>x.id===id?{...x,comments,replies:comments.length}:x))}/>
            </div>
          </div>)})}
          </div>
        </div>);
      })()}

      {/* RANK */}
      {pg==="rank"&&<div style={{maxWidth:680}}>
        {/* ═══ HEADER (compact) ═══ */}
        <div style={{...T.card,padding:18,background:"linear-gradient(135deg,#fff,"+T.goldBg+"55)",borderLeft:"3px solid "+T.gold,marginBottom:10}}>
          <h3 style={{fontSize:"1.2rem",fontWeight:700,margin:0}}>🏆 SKINARIO Leaderboard</h3>
          <p style={{color:T.txt2,fontSize:".82rem",marginTop:5,lineHeight:1.5}}>Compete with peers across India based on knowledge and consistency.</p>
        </div>

        {/* ═══ COLLAPSIBLE: How points work ═══ */}
        <div style={{...T.card,marginBottom:8,padding:0,overflow:"hidden"}}>
          <div onClick={()=>setShowPoints(!showPoints)} style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0,flex:1}}>
              <span style={{fontSize:".95rem",fontWeight:600,whiteSpace:"nowrap"}}>💯 How points work</span>
              {!showPoints&&<span style={{fontSize:".72rem",color:T.mute,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>1pt easy · 2pt mod · 3pt hard · +5 streak</span>}
            </div>
            <span style={{fontSize:".85rem",color:T.mute,transition:"transform .2s",transform:showPoints?"rotate(180deg)":"rotate(0deg)",display:"inline-block"}}>▾</span>
          </div>
          {showPoints&&<div style={{padding:"4px 16px 16px",borderTop:"1px solid "+T.border}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginTop:14}}>
              <div style={{padding:"10px 12px",background:T.bg,borderRadius:8}}>
                <div style={{fontSize:"1.1rem",fontWeight:700,color:T.gold,marginBottom:2}}>1 pt</div>
                <div style={{fontSize:".74rem",color:T.txt2}}>Easy question</div>
              </div>
              <div style={{padding:"10px 12px",background:T.bg,borderRadius:8}}>
                <div style={{fontSize:"1.1rem",fontWeight:700,color:T.gold,marginBottom:2}}>2 pts</div>
                <div style={{fontSize:".74rem",color:T.txt2}}>Moderate question</div>
              </div>
              <div style={{padding:"10px 12px",background:T.bg,borderRadius:8}}>
                <div style={{fontSize:"1.1rem",fontWeight:700,color:T.gold,marginBottom:2}}>3 pts</div>
                <div style={{fontSize:".74rem",color:T.txt2}}>Hard question</div>
              </div>
              <div style={{padding:"10px 12px",background:T.goldBg,borderRadius:8,border:"1px solid "+T.gold+"55"}}>
                <div style={{fontSize:"1.1rem",fontWeight:700,color:T.goldD,marginBottom:2}}>+5 pts</div>
                <div style={{fontSize:".74rem",color:T.txt2}}>Every 7-day streak</div>
              </div>
            </div>
            <p style={{fontSize:".75rem",color:T.txt2,lineHeight:1.55,marginTop:12,marginBottom:0}}>Points come from answering daily quizzes correctly. Harder questions are worth more. Maintain a daily streak for bonus points every week.</p>
          </div>}
        </div>

        {/* ═══ COLLAPSIBLE: Tier system ═══ */}
        <div style={{...T.card,marginBottom:14,padding:0,overflow:"hidden"}}>
          <div onClick={()=>setShowTiers(!showTiers)} style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0,flex:1}}>
              <span style={{fontSize:".95rem",fontWeight:600,whiteSpace:"nowrap"}}>🎖️ Tier system</span>
              {!showTiers&&prof?.accountType==="doctor"&&(()=>{
                const myPts=prof?.points||0;
                const myTier=getTier(myPts);
                const nextTier=TIERS.find(t=>t.min>myPts);
                if(!nextTier)return<span style={{fontSize:".72rem",color:T.gold,fontWeight:600,whiteSpace:"nowrap"}}>🏅 Top tier reached</span>;
                const remaining=nextTier.min-myPts;
                return<span style={{fontSize:".72rem",color:T.mute,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><span style={{color:myTier.color,fontWeight:600}}>{myTier.label}</span> · {remaining} pts to <span style={{color:nextTier.color,fontWeight:600}}>{nextTier.label}</span></span>;
              })()}
            </div>
            <span style={{fontSize:".85rem",color:T.mute,transition:"transform .2s",transform:showTiers?"rotate(180deg)":"rotate(0deg)",display:"inline-block"}}>▾</span>
          </div>
          {showTiers&&<div style={{padding:"4px 16px 16px",borderTop:"1px solid "+T.border}}>
            <p style={{fontSize:".75rem",color:T.txt2,lineHeight:1.55,marginTop:12,marginBottom:12}}>Tiers are earned through accumulated points. Once you reach a tier, you keep it forever — no demotion. Higher tiers display as a badge next to your name.</p>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {TIERS.map(t=>{
                const isMyTier=prof?.accountType==="doctor"&&getTier(prof?.points||0).id===t.id;
                return<div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",borderRadius:8,background:isMyTier?t.bg:"transparent",border:`1px solid ${isMyTier?t.color:T.border}`}}>
                  <span style={{padding:"2px 8px",borderRadius:10,fontSize:".66rem",fontWeight:700,letterSpacing:.5,background:t.bg,color:t.color,minWidth:80,textAlign:"center"}}>{t.label}</span>
                  <span style={{fontSize:".78rem",color:T.txt}}>{t.min}{t.max===Infinity?"+":` – ${t.max}`} points</span>
                  {isMyTier&&<span style={{marginLeft:"auto",fontSize:".7rem",color:t.color,fontWeight:600}}>← You</span>}
                </div>
              })}
            </div>
          </div>}
        </div>

        {/* Top 20 Leaderboard */}
        <div style={{...T.card,padding:18,marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <h4 style={{fontSize:".95rem",fontWeight:700,margin:0}}>🏆 Top {Math.min(leaderboard.length,20)}</h4>
            <span style={{fontSize:".7rem",color:T.mute}}>Min {MIN_Q_FOR_RANK} questions to qualify</span>
          </div>

          {leaderboard.length===0&&<div style={{textAlign:"center",padding:30,color:T.mute,fontSize:".88rem"}}>
            <div style={{fontSize:"2rem",marginBottom:6}}>🌱</div>
            No qualified rankings yet. Doctors need to answer {MIN_Q_FOR_RANK} questions to appear here.
          </div>}

          {leaderboard.map((u,i)=>{const uAcc=u.totalAnswered?Math.round(u.totalCorrect/u.totalAnswered*100):0;const isMe=u.id===au?.uid;
            return<div key={u.id} onClick={()=>viewProfile(u.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:10,marginBottom:6,background:isMe?T.tealBg:"#fff",border:`1px solid ${isMe?T.teal:T.border}`,cursor:"pointer"}}>
              <div style={{width:32,textAlign:"center",fontWeight:700,fontSize:i<3?"1.3rem":".95rem",color:i<3?["#d4a017","#888","#a0703a"][i]:T.txt2}}>{i<3?["🥇","🥈","🥉"][i]:`#${i+1}`}</div>
              {u.photo?<img src={u.photo} style={{width:38,height:38,borderRadius:"50%",objectFit:"cover"}}/>:<div style={T.av(38,isMe?T.teal:T.tealBg,isMe?"#fff":T.teal)}>{u.initials||"?"}</div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:".9rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6}}>{u.name}{isMe?" (You)":""}{(()=>{const t=getTier(u.points||0);if(t.id==="beginner")return null;return<span style={{padding:"1px 6px",borderRadius:8,fontSize:".58rem",fontWeight:700,letterSpacing:.5,background:t.bg,color:t.color}}>{t.label}</span>;})()}</div>
                <div style={{fontSize:".7rem",color:T.mute,display:"flex",gap:6,flexWrap:"wrap"}}>
                  <span>{uAcc}% accuracy</span>
                  <span>·</span>
                  <span>{u.totalAnswered||0}Q</span>
                  {(u.streak||0)>0&&<><span>·</span><span style={{color:T.gold}}>🔥{u.streak}d</span></>}
                </div>
              </div>
              <div style={{textAlign:"right",minWidth:60}}>
                <div style={{fontWeight:700,color:T.teal,fontSize:"1.05rem",lineHeight:1}}>{u.points||0}</div>
                <div style={{fontSize:".62rem",color:T.mute,letterSpacing:1,textTransform:"uppercase"}}>points</div>
              </div>
            </div>})}
        </div>

        {/* Rising Stars (newcomers below the threshold) */}
        {risingStars.length>0&&<div style={{...T.card,padding:18}}>
          <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:6}}>🌟 Rising Stars</h4>
          <p style={{fontSize:".78rem",color:T.txt2,marginBottom:12,lineHeight:1.55}}>Doctors building their score. Once they hit {MIN_Q_FOR_RANK} questions, they'll appear in the main leaderboard.</p>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {risingStars.map(u=>{const isMe=u.id===au?.uid;const remaining=MIN_Q_FOR_RANK-(u.totalAnswered||0);return<div key={u.id} onClick={()=>viewProfile(u.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,background:isMe?T.tealBg:"transparent",border:`1px solid ${isMe?T.teal:T.border}`,cursor:"pointer"}}>
              {u.photo?<img src={u.photo} style={{width:30,height:30,borderRadius:"50%",objectFit:"cover"}}/>:<div style={T.av(30,T.tealBg,T.teal)}>{u.initials||"?"}</div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:".84rem",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}{isMe?" (You)":""}</div>
                <div style={{fontSize:".7rem",color:T.mute}}>{u.totalCorrect||0}/{u.totalAnswered} correct · {remaining} more to qualify</div>
              </div>
              <div style={{fontSize:".75rem",color:T.gold,fontWeight:600}}>{u.points||0}pt</div>
            </div>})}
          </div>
        </div>}

        {/* Where am I if I'm a rising star? Helpful nudge */}
        {prof&&(prof.totalAnswered||0)<MIN_Q_FOR_RANK&&<div style={{...T.card,padding:14,marginTop:14,background:T.goldBg,borderLeft:"3px solid "+T.gold}}>
          <div style={{fontSize:".82rem",color:T.txt}}>💡 You've answered <b>{prof.totalAnswered||0}</b> of {MIN_Q_FOR_RANK} questions needed to enter the main leaderboard. <span style={{color:T.teal,cursor:"pointer",fontWeight:600}} onClick={()=>go("quiz")}>Take today's quiz →</span></div>
        </div>}
      </div>}

      {/* ═══ PUBLIC PROFILE PAGE — view any user's profile ═══ */}
      {pg==="profile"&&selU&&(()=>{
        const u=selU;
        const isMe=u.id===au?.uid;
        const isAdmin=ADMINS.includes(au?.email);
        const acc=ACCOUNT_TYPES.find(t=>t.id===u.accountType);
        const isPrivate=u.visibility==="private";
        // If profile is private and viewer isn't owner or admin, show locked state
        const canSee=isMe||isAdmin||!isPrivate;
        const acc2=u.totalAnswered?Math.round(u.totalCorrect/u.totalAnswered*100):0;

        return(<div style={{maxWidth:780}}>
          <button onClick={()=>setSelU(null)} style={{...T.btnO,...T.btnSm,marginBottom:14}}>← Back</button>

          {/* HERO HEADER */}
          <div style={{...T.card,padding:0,overflow:"hidden",marginBottom:14}}>
            <div style={{height:90,background:"linear-gradient(135deg,"+T.tealBg+","+T.goldBg+")"}}/>
            <div style={{padding:"0 24px 22px",marginTop:-44,position:"relative"}}>
              <div style={{display:"flex",alignItems:"flex-end",gap:18,flexWrap:"wrap"}}>
                {u.photo?<img src={u.photo} style={{width:96,height:96,borderRadius:"50%",border:"4px solid #fff",objectFit:"cover",boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}/>:<div style={{...T.av(96,T.tealBg,T.teal),border:"4px solid #fff",fontSize:"2rem",boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}>{u.initials||"?"}</div>}
                <div style={{flex:1,minWidth:200,paddingBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                    <h2 style={{fontSize:"1.4rem",fontWeight:700,margin:0}}>{u.name}</h2>
                    {u.accountType==="doctor"&&(()=>{const t=getTier(u.points||0);if(t.id==="beginner")return null;return<span style={{padding:"3px 9px",borderRadius:12,fontSize:".7rem",fontWeight:700,letterSpacing:.5,background:t.bg,color:t.color}}>{t.label}</span>;})()}
                    {u.verified&&<span title="Verified by SKINARIO admin" style={{fontSize:"1.1rem",color:"#1d9bf0"}}>✓</span>}
                    {u.regFlagged&&isAdmin&&<span style={T.tag(T.errBg,T.err)} title={u.regFlagReason}>🚩 Flagged</span>}
                    {acc&&<span style={T.tag(T.tealBg,T.teal)}>{acc.icon} {acc.label}</span>}
                  </div>
                  {u.degree&&<div style={{fontSize:".88rem",color:T.txt2,fontStyle:"italic"}}>{u.degree}</div>}
                  {u.companyName&&<div style={{fontSize:".88rem",color:T.txt2,fontStyle:"italic"}}>{u.brandCategory}</div>}
                  {u.instituteName&&<div style={{fontSize:".88rem",color:T.txt2,fontStyle:"italic"}}>{u.instituteType}</div>}
                  <div style={{fontSize:".75rem",color:T.mute,marginTop:6}}>Joined {fD(u.joined)}</div>
                </div>
                {isMe&&<button onClick={()=>{go("me")}} style={{...T.btnO,padding:"8px 16px",fontSize:".82rem"}}>✏️ Edit profile</button>}
              </div>
            </div>
          </div>

          {/* PRIVATE LOCKED STATE — when non-admin views a private profile */}
          {!canSee&&<div style={{...T.card,textAlign:"center",padding:36}}>
            <div style={{fontSize:"2.4rem",marginBottom:8}}>🔒</div>
            <h3 style={{fontSize:"1rem",fontWeight:600,marginBottom:6}}>This profile is private</h3>
            <p style={{color:T.txt2,fontSize:".88rem",lineHeight:1.55,maxWidth:380,margin:"0 auto"}}>{u.name?.split(" ")[0]||"This user"} has chosen to keep their profile private. Only basic info is visible.</p>
          </div>}

          {/* PUBLIC PROFILE CONTENT */}
          {canSee&&<>
            {/* Doctor-specific details */}
            {u.accountType==="doctor"&&<div style={{...T.card,marginBottom:14}}>
              <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:14}}>🩺 Practice Details</h4>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14}}>
                {u.clinic&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Clinic</div><div style={{fontSize:".88rem",color:T.txt}}>{u.clinic}</div></div>}
                {u.country&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Country</div><div style={{fontSize:".88rem",color:T.txt}}>{u.country}</div></div>}
                {(u.address||u.city)&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Location</div><div style={{fontSize:".88rem",color:T.txt}}>{u.address||(u.city+(u.region?", "+u.region:""))}</div></div>}
                {(isMe||isAdmin)&&u.regNumber&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Registration</div><div style={{fontSize:".88rem",color:T.txt}}>{u.council||u.internationalCouncil} · <span style={{fontFamily:"monospace"}}>{u.regNumber}</span></div></div>}
              </div>
              {/* Bio if filled */}
              {u.bio&&<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid "+T.border}}>
                <div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:5}}>About</div>
                <div style={{fontSize:".9rem",color:T.txt2,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{u.bio}</div>
              </div>}
            </div>}

            {/* Pharma-specific details */}
            {u.accountType==="pharma"&&<div style={{...T.card,marginBottom:14}}>
              <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:14}}>🏢 Company Details</h4>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14}}>
                {u.companyName&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Company</div><div style={{fontSize:".88rem",color:T.txt}}>{u.companyName}</div></div>}
                {u.brandCategory&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Category</div><div style={{fontSize:".88rem",color:T.txt}}>{u.brandCategory}</div></div>}
                {u.contactPerson&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Contact</div><div style={{fontSize:".88rem",color:T.txt}}>{u.contactPerson}</div></div>}
                {u.country&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Country</div><div style={{fontSize:".88rem",color:T.txt}}>{u.country}</div></div>}
                {u.website&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Website</div><a href={u.website} target="_blank" rel="noopener noreferrer" style={{fontSize:".88rem",color:T.teal,textDecoration:"none"}}>{u.website.replace(/^https?:\/\//,"")} →</a></div>}
              </div>
            </div>}

            {/* Institute-specific details */}
            {u.accountType==="institute"&&<div style={{...T.card,marginBottom:14}}>
              <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:14}}>🏛️ Institute Details</h4>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14}}>
                {u.instituteName&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Institute</div><div style={{fontSize:".88rem",color:T.txt}}>{u.instituteName}</div></div>}
                {u.instituteType&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Type</div><div style={{fontSize:".88rem",color:T.txt}}>{u.instituteType}</div></div>}
                {u.directorName&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Director</div><div style={{fontSize:".88rem",color:T.txt}}>{u.directorName}</div></div>}
                {u.country&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Country</div><div style={{fontSize:".88rem",color:T.txt}}>{u.country}</div></div>}
                {u.website&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Website</div><a href={u.website} target="_blank" rel="noopener noreferrer" style={{fontSize:".88rem",color:T.teal,textDecoration:"none"}}>{u.website.replace(/^https?:\/\//,"")} →</a></div>}
              </div>
            </div>}

            {/* Contact info — only visible to self or admin (private fields) */}
            {(isMe||isAdmin)&&<div style={{...T.card,marginBottom:14,background:T.bg,borderLeft:"3px solid "+T.gold}}>
              <h4 style={{fontSize:".88rem",fontWeight:700,marginBottom:10}}>🔒 Contact Info <span style={{fontSize:".7rem",color:T.mute,fontWeight:400,marginLeft:6}}>(private — visible only to {isMe?"you":"admin"})</span></h4>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10,fontSize:".85rem"}}>
                {u.email&&<div><span style={{color:T.mute}}>Email:</span> <span style={{color:T.txt}}>{u.email}</span></div>}
                {u.mobile&&<div><span style={{color:T.mute}}>Mobile:</span> <span style={{color:T.txt}}>{u.mobile}</span></div>}
              </div>
            </div>}

            {/* Stats — for doctors only */}
            {u.accountType==="doctor"&&<div style={{...T.card,marginBottom:14}}>
              <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:14}}>📊 Activity</h4>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                <div style={{textAlign:"center",padding:14,background:T.bg,borderRadius:10}}>
                  <div style={{fontSize:"1.4rem",fontWeight:700,color:T.teal}}>{u.points||0}</div>
                  <div style={{fontSize:".62rem",color:T.mute,textTransform:"uppercase",letterSpacing:1}}>Points</div>
                </div>
                <div style={{textAlign:"center",padding:14,background:T.bg,borderRadius:10}}>
                  <div style={{fontSize:"1.4rem",fontWeight:700,color:T.teal}}>{u.totalAnswered||0}</div>
                  <div style={{fontSize:".62rem",color:T.mute,textTransform:"uppercase",letterSpacing:1}}>Quizzes</div>
                </div>
                <div style={{textAlign:"center",padding:14,background:T.bg,borderRadius:10}}>
                  <div style={{fontSize:"1.4rem",fontWeight:700,color:T.teal}}>{acc2}%</div>
                  <div style={{fontSize:".62rem",color:T.mute,textTransform:"uppercase",letterSpacing:1}}>Accuracy</div>
                </div>
                <div style={{textAlign:"center",padding:14,background:T.bg,borderRadius:10}}>
                  <div style={{fontSize:"1.4rem",fontWeight:700,color:T.gold}}>🔥{u.streak||0}</div>
                  <div style={{fontSize:".62rem",color:T.mute,textTransform:"uppercase",letterSpacing:1}}>Streak</div>
                </div>
              </div>
            </div>}

            {/* Admin verification controls */}
            {isAdmin&&!isMe&&<div style={{...T.card,marginBottom:14,background:"#fff8e1",borderLeft:"3px solid "+T.gold}}>
              <h4 style={{fontSize:".88rem",fontWeight:700,marginBottom:8}}>⚙️ Admin Tools</h4>
              {u.regFlagged&&<div style={{padding:"10px 12px",background:T.errBg,borderRadius:8,marginBottom:10,fontSize:".82rem",color:T.err}}>🚩 <b>Flagged:</b> {u.regFlagReason}</div>}
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {!u.verified?<button onClick={async()=>{
                  if(!confirm(`Mark ${u.name} as verified? They'll get a blue check.`))return;
                  await fbSet("users",u.id,{verified:true,regFlagged:false,regFlagReason:""});
                  setSelU(p=>({...p,verified:true,regFlagged:false,regFlagReason:""}));
                  loadData();
                  sh("✓ Verified!");
                }} style={{...T.btn,padding:"8px 16px",fontSize:".82rem"}}>✓ Mark verified</button>
                :<button onClick={async()=>{
                  if(!confirm(`Remove verification from ${u.name}?`))return;
                  await fbSet("users",u.id,{verified:false});
                  setSelU(p=>({...p,verified:false}));
                  loadData();
                }} style={{...T.btnO,padding:"8px 16px",fontSize:".82rem"}}>Remove ✓</button>}
                {u.regFlagged&&<button onClick={async()=>{
                  if(!confirm(`Clear the duplicate flag on ${u.name}?`))return;
                  await fbSet("users",u.id,{regFlagged:false,regFlagReason:""});
                  setSelU(p=>({...p,regFlagged:false,regFlagReason:""}));
                  loadData();
                  sh("Flag cleared");
                }} style={{...T.btnO,padding:"8px 16px",fontSize:".82rem"}}>Clear flag</button>}
              </div>
            </div>}
          </>}
        </div>);
      })()}

      {/* PROFILE */}
      {pg==="me"&&<div style={{maxWidth:640}}>

        {/* ═══ EDITABLE PROFILE SECTION ═══ */}
        {editingProfile?<div style={{...T.card,borderLeft:"3px solid "+T.gold,padding:22}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <h3 style={{fontSize:"1.05rem",fontWeight:700,margin:0}}>✏️ Edit your profile</h3>
            <button onClick={()=>{setEditingProfile(false);setEditErr("")}} style={{background:"none",border:"none",fontSize:"1rem",color:T.mute,cursor:"pointer"}}>✕</button>
          </div>

          <p style={{fontSize:".82rem",color:T.txt2,marginBottom:18,lineHeight:1.55}}>Update your details so other doctors can find you and you appear in the directory.</p>

          {/* Account type — only editable if not yet set */}
          {!prof?.accountType&&<>
            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Account type <span style={{color:T.err}}>*</span></label>
            <select value={editPf.accountType} onChange={e=>setEditPf(p=>({...p,accountType:e.target.value}))} style={{...T.inp,marginBottom:12}}>
              <option value="">— Select —</option>
              {ACCOUNT_TYPES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
            </select>
          </>}

          {/* Common fields */}
          <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Full name <span style={{color:T.err}}>*</span></label>
          <input value={editPf.name} onChange={e=>setEditPf(p=>({...p,name:e.target.value}))} style={{...T.inp,marginBottom:12}}/>

          <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Mobile <span style={{color:T.err}}>*</span></label>
          <input value={editPf.mobile} onChange={e=>setEditPf(p=>({...p,mobile:e.target.value.replace(/[^0-9+\- ]/g,"")}))} placeholder="+91 98765 43210" style={{...T.inp,marginBottom:12}}/>

          {/* Doctor fields */}
          {editPf.accountType==="doctor"&&<>
            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Country</label>
            <select value={editPf.country} onChange={e=>setEditPf(p=>({...p,country:e.target.value,council:"",internationalCouncil:""}))} style={{...T.inp,marginBottom:12}}>
              {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Degree <span style={{color:T.err}}>*</span></label>
            <select value={editPf.degree} onChange={e=>setEditPf(p=>({...p,degree:e.target.value}))} style={{...T.inp,marginBottom:12}}>
              <option value="">— Select —</option>{DEGREES.map(d=><option key={d} value={d}>{d}</option>)}
            </select>

            {editPf.country==="India"?<>
              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Medical council <span style={{color:T.err}}>*</span></label>
              <select value={editPf.council} onChange={e=>setEditPf(p=>({...p,council:e.target.value}))} style={{...T.inp,marginBottom:12}}>
                <option value="">— Select —</option>{COUNCILS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </>:<>
              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Medical council / board <span style={{color:T.err}}>*</span></label>
              <input value={editPf.internationalCouncil} onChange={e=>setEditPf(p=>({...p,internationalCouncil:e.target.value}))} placeholder="e.g. GMC, DHA, Singapore Medical Council" style={{...T.inp,marginBottom:12}}/>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div><label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>City <span style={{color:T.err}}>*</span></label>
                <input value={editPf.city} onChange={e=>setEditPf(p=>({...p,city:e.target.value}))} style={T.inp}/></div>
                <div><label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>State / region</label>
                <input value={editPf.region} onChange={e=>setEditPf(p=>({...p,region:e.target.value}))} style={T.inp}/></div>
              </div>
            </>}

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Registration / license number <span style={{color:T.err}}>*</span></label>
            <input value={editPf.regNumber} onChange={e=>setEditPf(p=>({...p,regNumber:e.target.value}))} style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Clinic / practice <span style={{color:T.err}}>*</span></label>
            <input value={editPf.clinic} onChange={e=>setEditPf(p=>({...p,clinic:e.target.value}))} style={{...T.inp,marginBottom:12}}/>

            {editPf.country==="India"&&<>
              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>City, state (optional)</label>
              <input value={editPf.address} onChange={e=>setEditPf(p=>({...p,address:e.target.value}))} placeholder="e.g. Pune, Maharashtra" style={{...T.inp,marginBottom:12}}/>
            </>}
          </>}

          {/* Pharma fields */}
          {editPf.accountType==="pharma"&&<>
            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Country</label>
            <select value={editPf.country} onChange={e=>setEditPf(p=>({...p,country:e.target.value}))} style={{...T.inp,marginBottom:12}}>
              {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Company / brand name <span style={{color:T.err}}>*</span></label>
            <input value={editPf.companyName} onChange={e=>setEditPf(p=>({...p,companyName:e.target.value}))} style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Brand category <span style={{color:T.err}}>*</span></label>
            <select value={editPf.brandCategory} onChange={e=>setEditPf(p=>({...p,brandCategory:e.target.value}))} style={{...T.inp,marginBottom:12}}>
              <option value="">— Select —</option>{BRAND_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Contact person <span style={{color:T.err}}>*</span></label>
            <input value={editPf.contactPerson} onChange={e=>setEditPf(p=>({...p,contactPerson:e.target.value}))} style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Website (optional)</label>
            <input value={editPf.website} onChange={e=>setEditPf(p=>({...p,website:e.target.value}))} placeholder="https://" style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Address (optional)</label>
            <input value={editPf.address} onChange={e=>setEditPf(p=>({...p,address:e.target.value}))} style={{...T.inp,marginBottom:12}}/>
          </>}

          {/* Institute fields */}
          {editPf.accountType==="institute"&&<>
            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Country</label>
            <select value={editPf.country} onChange={e=>setEditPf(p=>({...p,country:e.target.value}))} style={{...T.inp,marginBottom:12}}>
              {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Institute name <span style={{color:T.err}}>*</span></label>
            <input value={editPf.instituteName} onChange={e=>setEditPf(p=>({...p,instituteName:e.target.value}))} style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Institute type <span style={{color:T.err}}>*</span></label>
            <select value={editPf.instituteType} onChange={e=>setEditPf(p=>({...p,instituteType:e.target.value}))} style={{...T.inp,marginBottom:12}}>
              <option value="">— Select —</option>{INSTITUTE_TYPES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Director / principal <span style={{color:T.err}}>*</span></label>
            <input value={editPf.directorName} onChange={e=>setEditPf(p=>({...p,directorName:e.target.value}))} style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Website (optional)</label>
            <input value={editPf.website} onChange={e=>setEditPf(p=>({...p,website:e.target.value}))} placeholder="https://" style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Address (optional)</label>
            <input value={editPf.address} onChange={e=>setEditPf(p=>({...p,address:e.target.value}))} style={{...T.inp,marginBottom:12}}/>
          </>}

          {/* Bio (optional, for everyone) */}
          <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Bio (optional)</label>
          <textarea value={editPf.bio} onChange={e=>setEditPf(p=>({...p,bio:e.target.value}))} placeholder="A short bio shown on your profile" rows={3} style={{...T.txa,marginBottom:14}}/>

          {/* Visibility */}
          <div style={{padding:"12px 14px",background:T.bg,borderRadius:10,marginBottom:14}}>
            <div style={{fontSize:".7rem",color:T.teal,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>Profile visibility</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {[["public","🌐 Public"],["private","🔒 Private"]].map(([id,l])=>
                <label key={id} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"5px 10px",borderRadius:6,border:`1.5px solid ${editPf.visibility===id?T.teal:"transparent"}`,background:editPf.visibility===id?"#fff":"transparent"}}>
                  <input type="radio" checked={editPf.visibility===id} onChange={()=>setEditPf(p=>({...p,visibility:id}))}/>
                  <span style={{fontSize:".84rem"}}>{l}</span>
                </label>)}
            </div>
          </div>

          {editErr&&<div style={{color:T.err,fontSize:".84rem",padding:"8px 12px",background:T.errBg,borderRadius:8,marginBottom:12}}>⚠️ {editErr}</div>}

          <div style={{display:"flex",gap:10}}>
            <button onClick={async()=>{
              setEditErr("");
              const e=editPf;
              if(!e.accountType){setEditErr("Account type required");return}
              if(!e.name?.trim()){setEditErr("Name required");return}
              if(!e.mobile?.trim()){setEditErr("Mobile required");return}
              if(e.accountType==="doctor"){
                if(!e.degree){setEditErr("Degree required");return}
                if(e.country==="India"&&!e.council){setEditErr("Medical council required");return}
                if(e.country!=="India"&&!e.internationalCouncil?.trim()){setEditErr("Council/board required");return}
                if(e.country!=="India"&&!e.city?.trim()){setEditErr("City required");return}
                if(!e.regNumber?.trim()){setEditErr("Registration number required");return}
                if(!e.clinic?.trim()){setEditErr("Clinic required");return}
              }
              if(e.accountType==="pharma"){
                if(!e.companyName?.trim()){setEditErr("Company name required");return}
                if(!e.brandCategory){setEditErr("Brand category required");return}
                if(!e.contactPerson?.trim()){setEditErr("Contact person required");return}
              }
              if(e.accountType==="institute"){
                if(!e.instituteName?.trim()){setEditErr("Institute name required");return}
                if(!e.instituteType){setEditErr("Institute type required");return}
                if(!e.directorName?.trim()){setEditErr("Director name required");return}
              }
              const initials=(e.name||"D").replace(/^Dr\.?\s*/i,"").split(" ").map(w=>w[0]||"").join("").toUpperCase().slice(0,2)||"D";
              const updated={
                name:e.name.trim(),
                mobile:e.mobile.trim(),
                accountType:e.accountType,
                country:e.country,
                isInternational:e.country!=="India",
                visibility:e.visibility||"public",
                bio:e.bio?.trim()||"",
                initials,
                ...(e.accountType==="doctor"?{
                  degree:e.degree,
                  regNumber:e.regNumber.trim(),
                  clinic:e.clinic.trim(),
                  address:e.address?.trim()||"",
                  ...(e.country==="India"?{council:e.council,internationalCouncil:"",city:"",region:""}:{internationalCouncil:e.internationalCouncil.trim(),city:e.city.trim(),region:e.region?.trim()||"",council:""})
                }:{}),
                ...(e.accountType==="pharma"?{companyName:e.companyName.trim(),brandCategory:e.brandCategory,contactPerson:e.contactPerson.trim(),website:e.website?.trim()||"",address:e.address?.trim()||""}:{}),
                ...(e.accountType==="institute"?{instituteName:e.instituteName.trim(),instituteType:e.instituteType,directorName:e.directorName.trim(),address:e.address?.trim()||"",website:e.website?.trim()||""}:{})
              };
              await fbSet("users",au.uid,updated);
              const newProf={...prof,...updated};
              setProf(newProf);
              localStorage.setItem("sk_p_"+au.uid,JSON.stringify(newProf));
              setEditingProfile(false);
              loadData();
              sh("✅ Profile updated!");
            }} style={T.btn}>💾 Save changes</button>
            <button onClick={()=>{setEditingProfile(false);setEditErr("")}} style={T.btnO}>Cancel</button>
          </div>
        </div>:<>
          {/* Read-only profile card with Edit button */}
          <div style={{...T.card,textAlign:"center",padding:28,position:"relative"}}>
            <button onClick={()=>{
              setEditPf({
                name:prof?.name||"",mobile:prof?.mobile||"",accountType:prof?.accountType||"",country:prof?.country||"India",
                degree:prof?.degree||"",council:prof?.council||"",internationalCouncil:prof?.internationalCouncil||"",
                regNumber:prof?.regNumber||"",clinic:prof?.clinic||"",address:prof?.address||"",city:prof?.city||"",region:prof?.region||"",
                visibility:prof?.visibility||"public",companyName:prof?.companyName||"",brandCategory:prof?.brandCategory||"",
                contactPerson:prof?.contactPerson||"",website:prof?.website||"",instituteName:prof?.instituteName||"",
                instituteType:prof?.instituteType||"",directorName:prof?.directorName||"",bio:prof?.bio||""
              });
              setEditingProfile(true);
              setEditErr("");
            }} style={{...T.btnO,...T.btnSm,position:"absolute",top:14,right:14}}>✏️ Edit</button>
            {uPhoto?<img src={uPhoto} style={{width:76,height:76,borderRadius:"50%",border:"3px solid "+T.teal,display:"block",margin:"0 auto 12px"}}/>:<div style={{...T.av(76,T.tealBg,T.teal),border:"3px solid "+T.teal,margin:"0 auto 12px",fontSize:"1.6rem"}}>{uIni}</div>}
            <div style={{fontSize:"1.4rem",fontWeight:700}}>{uName}</div>
            <div style={{color:T.txt2,fontSize:".88rem",marginTop:3}}>{prof?.degree||prof?.companyName||prof?.instituteName||"—"}</div>
            <div style={{color:T.mute,fontSize:".8rem",marginTop:2}}>{au?.email}</div>
            {prof?.accountType&&<div style={{marginTop:8}}><span style={T.tag(T.tealBg,T.teal)}>{ACCOUNT_TYPES.find(t=>t.id===prof.accountType)?.icon} {ACCOUNT_TYPES.find(t=>t.id===prof.accountType)?.label}</span></div>}
          </div>
        </>}
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
          {[["stats","📊 Overview"],["quiz","🧠 Quiz"],["articles","📰 Articles"],["resources","📚 Resources"],["videos","🎥 Videos"],["events","📅 Events"],["forum","💬 Forum"],["cases","🔬 Cases"],["ads","📢 Ads"],["announce","📣 Announce"],["users","👥 Users"]].map(([id,l])=><button key={id} onClick={()=>{setATab(id);setEdForm(null)}} style={{padding:"8px 14px",borderRadius:10,border:`1.5px solid ${aTab===id?T.teal:T.border}`,background:aTab===id?T.tealBg:"#fff",color:aTab===id?T.teal:T.mute,cursor:"pointer",fontSize:".8rem",fontWeight:aTab===id?600:400,fontFamily:"inherit"}}>{l}</button>)}
        </div>
        {aTab==="stats"&&<><div style={T.card}><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>{[["Articles",articles.length],["Resources",resources.length],["Videos",videos.length],["Forum",forumPosts.length],["Cases",cases.length],["Quizzes",quizzes.length],["Users",allUsers.length],["Events",events.length],["Ads",ads.length]].map(([l,v])=><div key={l} style={{textAlign:"center",padding:14,background:T.bg,borderRadius:10}}><div style={{fontSize:"1.4rem",fontWeight:700,color:T.teal}}>{v}</div><div style={{fontSize:".6rem",color:T.mute,textTransform:"uppercase"}}>{l}</div></div>)}</div></div>
          {/* Admin tools */}
          <div style={{...T.card,marginTop:14}}>
            <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:10}}>🛠️ Admin Tools</h4>
            <div style={{padding:"12px 14px",background:T.goldBg,borderLeft:"3px solid "+T.gold,borderRadius:"0 8px 8px 0",marginBottom:10}}>
              <div style={{fontSize:".88rem",fontWeight:600,marginBottom:4}}>♻️ Recompute leaderboard points</div>
              <p style={{fontSize:".78rem",color:T.txt2,lineHeight:1.55,marginBottom:10}}>Reads every user's quiz answer history and recalculates their points using the difficulty-weighted system (1pt Easy, 2pt Moderate, 3pt Hard). Run this ONCE after launching the new scoring system to fairly assign points to existing users. Streak bonuses are not retroactive.</p>
              <button onClick={recomputeAllPoints} style={{...T.btn,padding:"9px 18px",fontSize:".85rem"}}>♻️ Recompute all points now</button>
            </div>
          </div>
        </>}
        {aTab==="quiz"&&<div style={T.card}>{edForm?.type==="quizzes"?<AdminForm type="Quiz sponsor" edForm={edForm} setEdForm={setEdForm} fields={[["sponsored","Mark as sponsored quiz","check"],["sponsor","Sponsor name (e.g. 'Sun Pharma')"],["sponsorLogo","Sponsor logo","image"],["sponsorUrl","Sponsor URL (optional — makes name clickable)"]]} onSave={()=>saveContent("quizzes")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{quizzes.length} questions</span><button onClick={genQuiz} style={T.btn}>🤖 Generate today</button></div>
          {quizzes.map(q=><div key={q.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border,gap:10}}><div style={{flex:1,minWidth:0}}><div style={{fontWeight:500,fontSize:".88rem"}}>{q.cat} — {q.diff} {q.sponsored&&<span style={{...T.tag(T.goldBg,T.goldD),marginLeft:6}}>📢 {q.sponsor||"Sponsored"}</span>}</div><div style={{fontSize:".72rem",color:T.mute}}>{fD(q.date)} · {Object.keys(q.answers||{}).length} answers · ❤️ {q.likes||0}</div></div><div style={{display:"flex",gap:4}}><button onClick={()=>{setSelD(q.date);go("quiz")}} style={{...T.btnO,...T.btnSm}}>View</button><button onClick={()=>setEdForm({type:"quizzes",data:{...q},editing:true})} style={{...T.btnO,...T.btnSm}}>📢 Sponsor</button><button onClick={()=>deleteContent("quizzes",q.id,q.cat)} style={T.btnDanger}>Del</button></div></div>)}</>}</div>}
        {aTab==="articles"&&<div style={T.card}>{edForm?.type==="articles"?<AdminForm type="Article" edForm={edForm} setEdForm={setEdForm} fields={[["title","Title"],["subtitle","Subtitle / Tagline (italic, shown below title — optional)"],["cat","Category","select"],["author","Author name (e.g. 'Dr. Dhananjay Patil, MD')"],["authorPhoto","Author profile photo","image"],["authorAffiliation","Author affiliation (e.g. 'Absolute Institute of Aesthetic Medicine, Pune')"],["date","Publication date","date"],["cover","Cover image","image"],["abstract","Abstract / Summary (italic boxed quote — optional)","textarea"],["body","Article body","textarea"],["refs","References (optional)","textarea"],["authorBio","Author bio (shown at end of article — optional)","textarea"],["sponsored","Sponsored content (paid editorial)","check"],["sponsor","Sponsored by — brand name (e.g. 'Sun Pharma') — only if Sponsored is checked"],["sponsorLogo","Sponsor logo","image"],["sponsorUrl","Sponsor website URL (optional — makes sponsor name clickable)"],["feat","Featured","check"]]} onSave={()=>saveContent("articles")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{articles.length}</span><button onClick={()=>setEdForm({type:"articles",data:{date:today,author:uName,cat:TOPICS[0]},editing:false})} style={T.btn}>+ New</button></div>
          {articles.map(a=><div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border}}><div style={{display:"flex",gap:10,alignItems:"center"}}>{a.cover&&<img src={a.cover} style={{width:50,height:36,objectFit:"cover",borderRadius:6}}/>}<div><div style={{fontWeight:500,fontSize:".88rem"}}>{a.title}</div><div style={{fontSize:".72rem",color:T.mute}}>{fD(a.date)}</div></div></div><div style={{display:"flex",gap:4}}><button onClick={()=>setEdForm({type:"articles",data:{...a},editing:true})} style={{...T.btnO,...T.btnSm}}>Edit</button><button onClick={()=>deleteContent("articles",a.id,a.title)} style={T.btnDanger}>Del</button></div></div>)}</>}</div>}
        {aTab==="resources"&&<div style={T.card}>{edForm?.type==="resources"?<AdminForm type="Resource" edForm={edForm} setEdForm={setEdForm} fields={[["title","Title"],["url","Download URL"],["pages","Pages"],["size","Size"],["icon","Emoji (fallback)"],["thumb","Thumbnail image","image"],["free","Free","check"]]} onSave={()=>saveContent("resources")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{resources.length}</span><button onClick={()=>setEdForm({type:"resources",data:{icon:"📄",free:true},editing:false})} style={T.btn}>+ New</button></div>
          {resources.map(r=><div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border}}><div style={{display:"flex",gap:10,alignItems:"center"}}>{r.thumb?<img src={r.thumb} style={{width:36,height:36,objectFit:"cover",borderRadius:6}}/>:<span style={{fontSize:"1.4rem"}}>{r.icon||"📄"}</span>}<div><div style={{fontWeight:500,fontSize:".88rem"}}>{r.title||r.t}</div><div style={{fontSize:".72rem",color:T.mute}}>{r.free?"Free":"Premium"}</div></div></div><div style={{display:"flex",gap:4}}><button onClick={()=>setEdForm({type:"resources",data:{...r},editing:true})} style={{...T.btnO,...T.btnSm}}>Edit</button><button onClick={()=>deleteContent("resources",r.id,r.title||r.t)} style={T.btnDanger}>Del</button></div></div>)}</>}</div>}
        {aTab==="videos"&&<div style={T.card}>{edForm?.type==="videos"?<AdminForm type="Video" edForm={edForm} setEdForm={setEdForm} fields={[["title","Title"],["cat","Category","select"],["dur","Duration (e.g. '12:34')"],["desc","Description","textarea"],["embedUrl","YouTube/Vimeo URL (paste any format — share link, watch URL, or embed URL)"],["icon","Emoji thumbnail"],["free","Free","check"]]} onSave={()=>saveContent("videos")}/>
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

        {/* ═══ ANNOUNCEMENTS ADMIN — broadcast notifications to all users ═══ */}
        {aTab==="announce"&&<div style={T.card}>
          <h4 style={{fontSize:"1rem",fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:8}}>📣 Send Announcement to All Users</h4>
          <p style={{fontSize:".82rem",color:T.txt2,marginBottom:18,lineHeight:1.55}}>Broadcasts a notification to every registered user on SKINARIO. They'll see it in their 🔔 bell with a gold accent. Use sparingly — too many announcements train users to ignore them.</p>

          <div style={{padding:"14px 18px",background:T.goldBg,borderLeft:"3px solid "+T.gold,borderRadius:"0 8px 8px 0",marginBottom:20}}>
            <div style={{fontSize:".7rem",color:T.goldD,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>📋 Compose announcement</div>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Headline (optional)</label>
            <input value={announceTitle} onChange={e=>setAnnounceTitle(e.target.value)} placeholder="e.g. 'New course launching next week'" style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Message <span style={{color:T.err}}>*</span></label>
            <textarea value={announceText} onChange={e=>setAnnounceText(e.target.value)} placeholder="What do you want to tell everyone?" rows={4} style={{...T.txa,marginBottom:12,fontSize:".9rem",lineHeight:1.6}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Link to (optional — clicking the notification will navigate here)</label>
            <div style={{display:"grid",gridTemplateColumns:"160px 1fr",gap:8,marginBottom:14}}>
              <select value={announceLinkType} onChange={e=>{setAnnounceLinkType(e.target.value);setAnnounceLinkId("")}} style={T.inp}>
                <option value="">No link</option>
                <option value="article">Article</option>
                <option value="event">Event</option>
                <option value="case">Cases page</option>
                <option value="forum">Forum page</option>
                <option value="quiz">Quiz page</option>
              </select>
              {(announceLinkType==="article"||announceLinkType==="event")&&<select value={announceLinkId} onChange={e=>setAnnounceLinkId(e.target.value)} style={T.inp}>
                <option value="">— Select —</option>
                {announceLinkType==="article"&&articles.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}
                {announceLinkType==="event"&&events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}
              </select>}
            </div>

            <button onClick={async()=>{
              if(!announceText.trim()){sh("Message required");return}
              if((announceLinkType==="article"||announceLinkType==="event")&&!announceLinkId){sh("Pick the linked item or remove link");return}
              setAnnounceBusy(true);
              try{
                let linkLabel="";
                if(announceLinkType==="article"&&announceLinkId){const a=articles.find(x=>x.id===announceLinkId);if(a)linkLabel=a.title}
                if(announceLinkType==="event"&&announceLinkId){const e=events.find(x=>x.id===announceLinkId);if(e)linkLabel=e.title}
                await fbAdd("notifications",{
                  broadcast:true,
                  type:"announcement",
                  title:announceTitle.trim(),
                  text:announceText.trim(),
                  fromUid:au.uid,
                  fromName:uName,
                  fromIni:uIni,
                  fromPhoto:uPhoto||"",
                  linkType:announceLinkType||"",
                  linkId:announceLinkId||"",
                  linkLabel,
                  toUid:"all"
                });
                sh("📣 Announcement sent to all users!");
                setAnnounceTitle("");setAnnounceText("");setAnnounceLinkType("");setAnnounceLinkId("");
                const all=await fbGetAll("notifications","createdAt","desc",100);
                setBroadcastList(all.filter(n=>n.broadcast===true));
              }catch(e){sh("Failed: "+e.message)}
              setAnnounceBusy(false);
            }} disabled={announceBusy||!announceText.trim()} style={{...T.btn,padding:"11px 22px",opacity:(announceBusy||!announceText.trim())?.5:1}}>{announceBusy?"⏳ Sending...":"📣 Send to All Users"}</button>
          </div>

          {/* Past announcements */}
          <div style={{marginTop:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <h4 style={{fontSize:".88rem",fontWeight:700,margin:0}}>📜 Past announcements</h4>
              <button onClick={async()=>{const all=await fbGetAll("notifications","createdAt","desc",100);setBroadcastList(all.filter(n=>n.broadcast===true))}} style={{...T.btnO,...T.btnSm}}>↻ Refresh</button>
            </div>
            {broadcastList.length===0?<p style={{color:T.mute,fontSize:".82rem",padding:"12px 0"}}>No announcements sent yet. Or click ↻ Refresh to load.</p>
            :broadcastList.map(b=><div key={b.id} style={{padding:"10px 14px",background:T.bg,borderLeft:"3px solid "+T.gold,borderRadius:"0 8px 8px 0",marginBottom:8,display:"flex",justifyContent:"space-between",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                {b.title&&<div style={{fontWeight:600,fontSize:".88rem",marginBottom:2}}>{b.title}</div>}
                <div style={{fontSize:".82rem",color:T.txt2,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{b.text}</div>
                <div style={{fontSize:".7rem",color:T.mute,marginTop:4,display:"flex",gap:10,flexWrap:"wrap"}}>
                  <span>{relTime(b.createdAt)}</span>
                  {b.fromName&&<span>by {b.fromName}</span>}
                  {b.linkLabel&&<span style={{fontStyle:"italic"}}>→ "{b.linkLabel}"</span>}
                </div>
              </div>
              <button onClick={async()=>{
                if(!confirm("Delete this announcement? Users who saw it will no longer see it in their bell."))return;
                await fbDel("notifications",b.id);
                setBroadcastList(p=>p.filter(x=>x.id!==b.id));
                sh("Deleted");
              }} style={T.btnDanger}>Del</button>
            </div>)}
          </div>
        </div>}

        {aTab==="users"&&<div style={T.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <p style={{color:T.mute,fontSize:".82rem",margin:0}}>{allUsers.length} users · click to view profile</p>
            <p style={{color:T.mute,fontSize:".75rem",margin:0}}>🚩 {allUsers.filter(u=>u.regFlagged).length} flagged · ✓ {allUsers.filter(u=>u.verified).length} verified</p>
          </div>
          {allUsers.map(u=>{const a2=u.totalAnswered?Math.round(u.totalCorrect/u.totalAnswered*100):0;const acc=ACCOUNT_TYPES.find(t=>t.id===u.accountType);return<div key={u.id} onClick={()=>viewProfile(u.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 8px",borderBottom:"1px solid "+T.border,cursor:"pointer",borderRadius:6,...(u.regFlagged?{background:T.errBg+"55"}:{})}}>
            {u.photo?<img src={u.photo} style={{width:34,height:34,borderRadius:"50%",objectFit:"cover"}}/>:<div style={T.av(34,T.tealBg,T.teal)}>{u.initials||"?"}</div>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:".88rem",fontWeight:500,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                {u.name||"Unnamed"}
                {u.verified&&<span title="Verified" style={{color:"#1d9bf0"}}>✓</span>}
                {ADMINS.includes(u.email)&&<span style={T.tag(T.tealBg,T.teal)}>Admin</span>}
                {u.regFlagged&&<span style={T.tag(T.errBg,T.err)}>🚩</span>}
                {acc&&<span style={T.tag(T.bg,T.mute)}>{acc.icon} {acc.label}</span>}
              </div>
              <div style={{fontSize:".7rem",color:T.mute}}>{u.email} · {u.country||"—"}</div>
            </div>
            <div style={{textAlign:"right",fontSize:".72rem"}}>
              {u.accountType==="doctor"&&<div style={{color:T.teal,fontWeight:600}}>{u.points||0} pts · {a2}%</div>}
              <div style={{color:T.mute}}>{u.paid?"⭐ Premium":"Free"}</div>
            </div>
          </div>})}
        </div>}
      </div>}

      <div style={{textAlign:"center",padding:"22px 0",borderTop:"1px solid "+T.border,marginTop:20}}>
        <Logo size={28}/><div style={{fontSize:".65rem",color:T.light,letterSpacing:2,textTransform:"uppercase",marginTop:6}}>SKINARIO · <span style={{color:T.gold,fontWeight:600}}>{BRAND.sub}</span></div>
      </div>

      </div>
      {toast&&<div style={{position:"fixed",bottom:22,left:"50%",transform:"translateX(-50%)",padding:"11px 28px",background:T.teal,color:"#fff",borderRadius:12,fontSize:".9rem",zIndex:1000,boxShadow:"0 4px 20px rgba(13,107,110,.25)"}}>{toast}</div>}
    </div>);
}
