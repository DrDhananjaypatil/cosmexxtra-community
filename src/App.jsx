import { useState, useEffect, useCallback, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, addDoc, deleteDoc, serverTimestamp, where } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig={apiKey:"AIzaSyAzW8kouNGmK11tLIDftwlg5QEtffecYEM",authDomain:"skinario-369.firebaseapp.com",projectId:"skinario-369",storageBucket:"skinario-369.firebasestorage.app",messagingSenderId:"647411585151",appId:"1:647411585151:web:210827226e649d96b42f4a"};
const fbApp=initializeApp(firebaseConfig);const auth=getAuth(fbApp);const db=getFirestore(fbApp);const gProv=new GoogleAuthProvider();
const storage=getStorage(fbApp);
const ADMINS=["drjpatil@gmail.com","absoluteinstituteedu@gmail.com"];

// ═══ ROLE-BASED ACCESS CONTROL ═══
// Roles are stored on the user document under `role` field.
// Default if missing: regular user (no elevated permissions).
const ROLES={
  CONTENT_CONTRIBUTOR:"contentContributor",
  FORUM_MODERATOR:"forumModerator",
  ADMIN:"admin", // assigned via ADMINS email list or via user.role
};
// Display labels + badge colors for each role
const ROLE_DISPLAY={
  contentContributor:{label:"Content Contributor",bg:"#e8f5e9",fg:"#1b5e20",icon:"✍️"},
  forumModerator:{label:"Forum Moderator",bg:"#fff3e0",fg:"#bf360c",icon:"🛡️"},
  admin:{label:"Admin",bg:"#fce4ec",fg:"#880e4f",icon:"⚡"},
};
// Permission checks — use these everywhere instead of hardcoded role checks.
// User can be either the profile object or an email string for admin check.
function isAdminUser(userOrEmail){
  if(!userOrEmail)return false;
  if(typeof userOrEmail==="string")return ADMINS.includes(userOrEmail);
  if(userOrEmail.email&&ADMINS.includes(userOrEmail.email))return true;
  if(userOrEmail.role===ROLES.ADMIN)return true;
  return false;
}
function isContentContributor(u){return u?.role===ROLES.CONTENT_CONTRIBUTOR||isAdminUser(u)}
function isForumModerator(u){return u?.role===ROLES.FORUM_MODERATOR||isAdminUser(u)}
function hasAnyModRole(u){return u?.role&&Object.values(ROLES).includes(u.role)||isAdminUser(u)}

// ═══ CONTENT SUBMISSION TYPES — unified config for all 5 types ═══
// Each type defines: who can submit, target collection on approval, fields, image dims, label.
// This is the single source of truth. Forms + review UI + approval handler all read from here.
const SUBMISSION_TYPES={
  vendor_reward:{
    label:"Vendor Reward",
    icon:"🎁",
    color:"#785f1e",
    targetCollection:"rewards",
    openToAll:false, // only approved vendor partners (not in the normal submit flow)
    description:"Vendor-proposed reward offering for the SKINARIO rewards catalog.",
    imageHint:"Optional reward image (e.g. product photo, voucher graphic). 600×400 recommended.",
    imageKey:"image",
    imageRecommendedW:600,
    imageRecommendedH:400,
    fields:[
      {key:"title",label:"Reward title",required:true,placeholder:"e.g. 10% off any laser purchase"},
      {key:"desc",label:"Description",required:true,type:"textarea",rows:3,placeholder:"What does the doctor get, terms, limitations..."},
      {key:"fulfillment",label:"Fulfillment type",required:true,type:"select",options:["voucher","contact","manual"]},
      {key:"voucher",label:"Voucher code or instructions",required:false,placeholder:"e.g. SKINARIO10"},
      {key:"stock",label:"Stock limit (blank = unlimited)",required:false,type:"number"},
    ],
  },
  event:{
    label:"Event",
    icon:"📅",
    color:"#0d6b6e",
    targetCollection:"events",
    openToAll:true, // anyone signed in can submit
    description:"Conferences, workshops, webinars — relevant to aesthetic medicine.",
    imageHint:"Recommended banner size: 600×260 px (landscape)",
    imageKey:"banner", // saves uploaded image to this field name
    imageRecommendedW:600,
    imageRecommendedH:260,
    fields:[
      {key:"title",label:"Event title",required:true,placeholder:"e.g. Advanced Botox Masterclass 2026"},
      {key:"cat",label:"Category",required:true,type:"select",options:["Conference","Workshop","Masterclass","Webinar","Product Launch","Course Deadline","Other"]},
      {key:"date",label:"Start date",required:true,type:"date"},
      {key:"endDate",label:"End date (leave blank for single-day event)",required:false,type:"date"},
      {key:"time",label:"Time",required:false,placeholder:"e.g. 10:00 AM - 4:00 PM IST"},
      {key:"location",label:"Location",required:true,placeholder:"e.g. Hotel Sahara Star, Mumbai — or 'Online'"},
      {key:"organizer",label:"Organizer / Host",required:false,placeholder:"e.g. Absolute Institute"},
      {key:"body",label:"Description",required:true,type:"textarea",rows:4,placeholder:"What is this event about? Who should attend? What will they learn?"},
      {key:"speakers",label:"Speakers (comma-separated)",required:false,type:"textarea",rows:2,placeholder:"Dr. ABC, Dr. XYZ"},
      {key:"sponsor",label:"Sponsored by (leave blank if not sponsored)",required:false,placeholder:"e.g. Sun Pharma"},
      {key:"regType",label:"Registration type",required:false,type:"select",options:["internal","external"]},
      {key:"regUrl",label:"External registration URL (if regType is external)",required:false,placeholder:"https://..."},
      {key:"regCta",label:"CTA button text",required:false,placeholder:"e.g. Buy ticket, Register on Eventbrite"},
    ],
  },
  article:{
    label:"Article",
    icon:"📰",
    color:"#0d6b6e",
    targetCollection:"articles",
    openToAll:false, // Content Contributors only
    description:"Write or share an educational article on aesthetic medicine topics.",
    imageHint:"Recommended cover size: 1200×630 px (article hero)",
    imageKey:"cover",
    imageRecommendedW:1200,
    imageRecommendedH:630,
    fields:[
      {key:"title",label:"Title",required:true,placeholder:"e.g. Long-term outcomes of PDRN therapy"},
      {key:"subtitle",label:"Subtitle / Tagline (optional, shown below title in italic)",required:false,placeholder:"A 5-year follow-up study"},
      {key:"cat",label:"Category",required:true,type:"select",options:["Botox","Fillers","Threads","PDRN","Lasers","Hair","Body","Skincare","Pigmentation","Acne","General"]},
      {key:"author",label:"Author name",required:true,placeholder:"e.g. Dr. Dhananjay Patil, MD"},
      {key:"authorAffiliation",label:"Author affiliation",required:false,placeholder:"e.g. Absolute Institute of Aesthetic Medicine, Pune"},
      {key:"date",label:"Publication date",required:false,type:"date"},
      {key:"abstract",label:"Abstract / Summary (optional — boxed italic intro)",required:false,type:"textarea",rows:3,placeholder:"2-3 sentence summary of the article"},
      {key:"blocks",label:"Article body",required:true,type:"blocks"},
      {key:"refs",label:"References (optional)",required:false,type:"textarea",rows:3,placeholder:"List references — one per line"},
      {key:"authorBio",label:"Author bio (optional — shown at end of article)",required:false,type:"textarea",rows:2,placeholder:"Short bio about you"},
    ],
  },
  video:{
    label:"Video",
    icon:"🎥",
    color:"#c8a84e",
    targetCollection:"videos",
    openToAll:false,
    description:"Share an educational YouTube video.",
    imageHint:"Thumbnail is fetched automatically from YouTube",
    imageKey:"",
    imageRecommendedW:0,
    imageRecommendedH:0,
    fields:[
      {key:"title",label:"Video title",required:true,placeholder:"e.g. Step-by-step PDO thread placement"},
      {key:"cat",label:"Category",required:true,type:"select",options:["Botox","Fillers","Threads","PDRN","Lasers","Hair","Body","Skincare","Pigmentation","Acne","General"]},
      {key:"embedUrl",label:"YouTube URL",required:true,placeholder:"https://www.youtube.com/watch?v=... (any YouTube URL format)"},
      {key:"dur",label:"Duration (optional)",required:false,placeholder:"e.g. 12:34"},
      {key:"desc",label:"Description",required:false,type:"textarea",rows:3,placeholder:"What does this video cover? Why is it valuable?"},
    ],
  },
  ad:{
    label:"Advertisement",
    icon:"📢",
    color:"#bf6a00",
    targetCollection:"ads",
    openToAll:false, // Content Contributors only — to prevent spam
    description:"Promote courses, services, or institute offerings. Will display as 'Sponsored' to users.",
    imageHint:"Recommended banner size: 600×340 px (landscape ad)",
    imageKey:"image",
    imageRecommendedW:600,
    imageRecommendedH:340,
    fields:[
      {key:"title",label:"Title",required:true,placeholder:"e.g. Master Botox in 3 days — Absolute Institute"},
      {key:"adType",label:"Ad type",required:true,type:"select",options:["external","internal"]},
      {key:"desc",label:"Short description (shown in sidebar card)",required:true,type:"textarea",rows:2,placeholder:"One sentence hook"},
      {key:"url",label:"Click-through URL",required:true,placeholder:"https://..."},
      {key:"tag",label:"Category tag",required:false,placeholder:"e.g. Course, Pharma, Institute"},
      {key:"body",label:"Full description (only for internal-page ads)",required:false,type:"textarea",rows:4,placeholder:"Detailed content for the internal landing page"},
      {key:"cta",label:"CTA button text (optional)",required:false,placeholder:"e.g. Visit website, Register now"},
      {key:"contact",label:"Contact info (optional, for internal-page ads)",required:false,placeholder:"e.g. info@absolute.com / +91 9876543210"},
      {key:"expiry",label:"Expiry date (leave blank for no expiry)",required:false,type:"date"},
    ],
  },
  news:{
    label:"News Item",
    icon:"📰",
    color:"#c5392a",
    targetCollection:"news",
    openToAll:false, // Content Contributors only
    description:"Share aesthetic medicine industry news — product launches, regulatory updates, conference recaps.",
    imageHint:"Recommended thumbnail: 600×400 px (3:2 ratio)",
    imageKey:"image",
    imageRecommendedW:600,
    imageRecommendedH:400,
    fields:[
      {key:"title",label:"News headline",required:true,placeholder:"e.g. FDA approves new biostimulator filler"},
      {key:"cat",label:"Topic",required:true,type:"select",options:["Botox","Fillers","Threads","PDRN","Lasers","Hair","Body","Skincare","Pigmentation","Acne","Industry","Regulatory","General"]},
      {key:"body",label:"Brief summary",required:false,type:"textarea",rows:3,placeholder:"1-2 sentence summary"},
      {key:"url",label:"Source link",required:true,placeholder:"https://... — where users can read the full article"},
    ],
  },
};

// Helper: who is allowed to submit a given content type?
function canSubmitType(typeKey, user, profile) {
  if (!user) return false;
  if (isAdminUser(user.email || user)) return true; // admins always can
  const cfg = SUBMISSION_TYPES[typeKey];
  if (!cfg) return false;
  if (cfg.openToAll) return true;
  // Restricted: Content Contributor or higher
  return profile?.role === ROLES.CONTENT_CONTRIBUTOR || profile?.role === ROLES.FORUM_MODERATOR;
}

// ═══ TIER SYSTEM — sticky badges based on lifetime points ═══
const TIERS=[
  {id:"beginner",label:"Beginner",min:0,max:499,color:"#888",bg:"#f0f0f0"},
  {id:"contributor",label:"Contributor",min:500,max:1999,color:"#0d6b6e",bg:"#e1f5ee"},
  {id:"pro",label:"Pro",min:2000,max:4999,color:"#785f1e",bg:"#fdf6e3"},
  {id:"expert",label:"Expert",min:5000,max:9999,color:"#7a3e9a",bg:"#f3e8ff"},
  {id:"master",label:"Master",min:10000,max:Infinity,color:"#b91c1c",bg:"#fef2f2"}
];
function getTier(points){
  const p=points||0;
  return TIERS.find(t=>p>=t.min&&p<=t.max)||TIERS[0];
}

// ═══ ACTION-BASED POINTS SPEC (per locked spec) ═══
// Each action has: points awarded, daily cap (0 = no cap), human label
const ACTION_POINTS={
  // ── Community contributions (high value — real content effort) ──
  forum_post:        {points:50, cap:0,  label:"Forum post created"},      // new forum discussion
  case_post:         {points:50, cap:0,  label:"Clinical case posted"},     // new clinical case
  article_publish:   {points:50, cap:0,  label:"Article submitted"},        // article submission for review
  video_submit:      {points:10, cap:0,  label:"Video submitted"},           // video/masterclass submission
  resource_submit:   {points:10, cap:0,  label:"Resource uploaded"},         // library resource upload
  // ── Engagement (lower value, daily-capped to prevent farming) ──
  forum_comment:     {points:5,  cap:5,  label:"Forum comment",   minChars:20},
  share_unique:      {points:1,  cap:5,  label:"Sharing content"},
  // ── Future placeholders ──
  qa_answer:         {points:1,  cap:5,  label:"Q&A answer"},
  qa_marked_best:    {points:1,  cap:0,  label:"Q&A marked best"},
  case_reply:        {points:1,  cap:5,  label:"Case reply marked helpful"},
  forum_upvoted:     {points:1,  cap:0,  label:"Comment upvoted"},
  profile_complete:  {points:5,  cap:0,  label:"Profile completion (one-time)"},
  invite_success:    {points:5,  cap:0,  label:"Successful invite"},
  referral_bonus:    {points:100,cap:0,  label:"Referral bonus"},  // awarded when YOUR referred friend answers their first quiz
};

// Returns today's IST date as YYYY-MM-DD — used as the key for daily-cap tracking
function todayIST_YMD(){
  const ist=new Date(Date.now()+5.5*60*60*1000);
  return ist.toISOString().split("T")[0];
}
// Generates a stable, readable referral code from the user's name + a short hash of their uid.
// Format: NAME-XXXX (e.g. "DHANANJAY-7K2P"). Uppercase, no spaces, safe for URLs.
function genReferralCode(name,uid){
  const namePart=(name||"USER").replace(/^Dr\.?\s*/i,"").trim().split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g,"").slice(0,8)||"USER";
  // Short deterministic hash from uid so the code is stable across re-generation
  let hash=0;
  for(let i=0;i<uid.length;i++){hash=((hash<<5)-hash+uid.charCodeAt(i))|0}
  const hashPart=Math.abs(hash).toString(36).toUpperCase().slice(0,4).padStart(4,"0");
  return `${namePart}-${hashPart}`;
}
const TOPICS=["Botox & Neurotoxins","Dermal Fillers","Threads","PDRN & Polynucleotides","Peptides & Skin Boosters","Chemical Peels","Laser & Energy Devices","Hair Restoration","Body Contouring","Anti-Aging & Regenerative","Skincare Science","Pigmentation & Melasma","Acne & Scars","Practice Management"];

// ═══ CONSENT TEMPLATE CATALOG ═══
// Two-level structure: category → sub-procedures. Each sub-procedure carries
// procedure-specific risk content. The legal framework (boilerplate clauses
// around DPDP, governing law, dispute resolution) lives in CONSENT_BOILERPLATE.
//
// IMPORTANT: This is v1 generic content meant to be iterated after legal review.
// Doctors must review with their own counsel before clinical use. The PDF
// includes prominent disclaimers stating exactly this.
const CONSENT_PROCEDURES = {
  "Injectables": {
    icon: "💉",
    procedures: {
      "Botulinum Toxin (Botox / Dysport / Xeomin)": {
        description: "Intramuscular injection of botulinum toxin Type A for temporary reduction of muscle activity to soften dynamic wrinkles (forehead, glabella, crow's feet) or treat conditions such as masseter hypertrophy, hyperhidrosis, or migraine.",
        commonRisks: ["Pain, redness, or bruising at injection site", "Headache or flu-like symptoms (usually within 24-48 hours)", "Temporary muscle weakness near injection site", "Asymmetry of result"],
        seriousRisks: ["Eyelid or eyebrow ptosis (drooping) — typically resolves in 2-12 weeks", "Diplopia (double vision) — rare", "Difficulty swallowing or breathing — extremely rare, requires immediate medical attention", "Allergic reaction (anaphylaxis is extremely rare)"],
        contraindications: ["Pregnancy or breastfeeding", "Neuromuscular disorders (myasthenia gravis, Lambert-Eaton syndrome, ALS)", "Active infection at injection site", "Known hypersensitivity to botulinum toxin or excipients"],
        aftercare: ["Avoid lying down for 4 hours post-procedure", "Avoid strenuous exercise for 24 hours", "Avoid rubbing or massaging the treated area for 24 hours", "Avoid heat exposure (sauna, hot yoga) for 24 hours", "Results begin in 3-5 days; full effect by 14 days"],
        duration: "Effects typically last 3-4 months. Touch-up may be needed at 2 weeks if asymmetry occurs.",
      },
      "Dermal Fillers (Hyaluronic Acid)": {
        description: "Injection of hyaluronic acid-based dermal filler for soft tissue augmentation, including lip enhancement, cheek volumization, tear trough correction, or nasolabial fold reduction.",
        commonRisks: ["Pain, redness, swelling, or bruising at injection site", "Temporary lumpiness or asymmetry", "Tenderness for 1-3 days"],
        seriousRisks: ["Vascular occlusion leading to skin necrosis — requires immediate intervention with hyaluronidase", "Blindness (extremely rare but reported with periocular injection)", "Infection or abscess formation", "Granuloma or persistent nodule formation", "Tyndall effect (bluish discoloration)", "Migration of product"],
        contraindications: ["Pregnancy or breastfeeding", "Active skin infection or inflammation at site", "Known hypersensitivity to hyaluronic acid or lidocaine", "Bleeding disorders or anticoagulant therapy (relative)", "Autoimmune disease (relative)"],
        aftercare: ["Avoid strenuous exercise for 24-48 hours", "Avoid extreme heat or cold for 24 hours", "Avoid alcohol for 24 hours", "Avoid dental procedures for 2 weeks", "Mild swelling and bruising may persist 3-7 days"],
        duration: "Results typically last 6-18 months depending on product and area treated. Hyaluronidase available for reversal if needed.",
      },
      "Biostimulators (Sculptra / Radiesse / Profhilo)": {
        description: "Injection of collagen-stimulating biomaterials (poly-L-lactic acid, calcium hydroxylapatite, or stabilized hyaluronic acid) to gradually restore volume and stimulate the patient's own collagen.",
        commonRisks: ["Injection-site pain, bruising, swelling", "Temporary palpable nodules", "Asymmetry"],
        seriousRisks: ["Late-onset nodule formation (months after injection)", "Vascular occlusion (rare but possible)", "Granuloma formation", "Persistent firmness or lumps requiring dissolution attempts"],
        contraindications: ["Pregnancy or breastfeeding", "Active skin infection at site", "Known hypersensitivity to product components", "Autoimmune disease", "Keloid tendency (relative)"],
        aftercare: ["Massage the treated area as instructed (typically 5-5-5 rule)", "Avoid strenuous exercise for 24 hours", "Drink adequate water", "Results emerge gradually over 6-12 weeks"],
        duration: "Results develop progressively over 8-12 weeks and last 12-24 months. Multiple sessions usually required.",
      },
      "Mesotherapy / Skin Boosters": {
        description: "Superficial intradermal injections of vitamins, antioxidants, hyaluronic acid, or peptide formulations to improve skin texture, hydration, and quality.",
        commonRisks: ["Injection-site redness, swelling, bruising", "Mild stinging during procedure", "Temporary papules"],
        seriousRisks: ["Allergic reaction to injected substance", "Infection if sterility is compromised", "Skin discoloration (transient)", "Persistent nodules"],
        contraindications: ["Pregnancy or breastfeeding", "Active skin infection", "Known hypersensitivity to any constituent", "Coagulopathy"],
        aftercare: ["Avoid makeup for 12-24 hours", "Avoid heat, sauna, intense exercise for 24 hours", "Gentle skincare for 48 hours", "Series of treatments typically needed for best results"],
        duration: "Effects build over a series of 3-6 sessions. Maintenance every 3-6 months.",
      },
    },
  },
  "Threads": {
    icon: "🧵",
    procedures: {
      "PDO Mono Threads": {
        description: "Insertion of polydioxanone (PDO) smooth threads under the skin to stimulate collagen production and improve skin quality and tightness.",
        commonRisks: ["Pain, bruising, swelling at insertion sites", "Visible thread ends (typically resolve in days)", "Temporary asymmetry"],
        seriousRisks: ["Thread extrusion or migration", "Infection at insertion sites", "Persistent dimpling or puckering", "Damage to underlying structures (vessels, nerves)", "Granuloma formation"],
        contraindications: ["Pregnancy or breastfeeding", "Active skin infection or inflammation", "Coagulopathy or anticoagulant therapy", "Autoimmune disease", "Keloid tendency", "Body dysmorphic disorder"],
        aftercare: ["Avoid facial movements like wide yawning, chewing tough food for 1-2 weeks", "Sleep on back with head elevated for 5-7 days", "No facials, massage, or dental work for 2 weeks", "Avoid strenuous exercise for 1 week"],
        duration: "Threads dissolve over 6-8 months. Collagen stimulation effect lasts 12-18 months.",
      },
      "PDO Cog / Barbed Threads (Lifting)": {
        description: "Insertion of barbed polydioxanone threads to mechanically lift sagging tissue in the mid-face, jawline, neck, or other areas.",
        commonRisks: ["Pain, bruising, swelling at insertion and exit points", "Dimpling or visible thread tracks", "Asymmetry", "Numbness or altered sensation"],
        seriousRisks: ["Thread breakage, migration, or extrusion", "Persistent dimpling requiring intervention", "Infection or abscess", "Nerve damage (motor or sensory)", "Vascular injury", "Inadequate lift or over-correction", "Skin necrosis (very rare)"],
        contraindications: ["Pregnancy or breastfeeding", "Active skin infection", "Coagulopathy or anticoagulant therapy", "Autoimmune disease", "Keloid tendency", "Very thin skin", "Severe skin laxity not amenable to threads"],
        aftercare: ["Avoid extreme facial movements (wide smile, yawning, chewing tough food) for 2-3 weeks", "Sleep on back, head elevated for 7-10 days", "No facials, massage, or dental procedures for 3 weeks", "Avoid strenuous exercise for 2 weeks", "Avoid pressure on treated areas"],
        duration: "Initial lift visible immediately. Threads dissolve over 6-9 months. Collagen stimulation maintains result for 12-18 months.",
      },
    },
  },
  "Energy Devices": {
    icon: "⚡",
    procedures: {
      "Q-Switched Nd:YAG Laser": {
        description: "Application of Q-switched neodymium-doped yttrium aluminum garnet laser energy for pigmentation, tattoo removal, or skin rejuvenation (laser toning).",
        commonRisks: ["Redness, mild swelling, warmth post-treatment", "Temporary darkening of pigmented lesions before clearing", "Mild discomfort during treatment"],
        seriousRisks: ["Post-inflammatory hyperpigmentation (PIH) — especially in Indian skin types IV-VI", "Hypopigmentation (loss of pigment)", "Paradoxical worsening of pigmentation", "Blistering or scarring (rare with appropriate parameters)", "Whitish discoloration (frosting) if energy too high"],
        contraindications: ["Pregnancy", "Active skin infection or open wounds in area", "Recent sun exposure or tanning", "Use of photosensitizing medications", "History of keloid or hypertrophic scarring (relative)", "Untreated melasma without proper protocol"],
        aftercare: ["Strict broad-spectrum sunscreen SPF 50+ daily for at least 4 weeks", "Avoid sun exposure", "Gentle skincare; no actives (retinoids, AHAs) for 5-7 days", "Cool compresses for redness", "Multiple sessions required (typically 6-10 spaced 2-4 weeks apart)"],
        duration: "Treatment series varies by indication. Maintenance sessions usually needed.",
      },
      "Fractional CO2 Laser Resurfacing": {
        description: "Ablative fractional carbon dioxide laser treatment for skin resurfacing, scar revision, or photodamage. Creates microscopic columns of thermal injury to stimulate dermal remodeling.",
        commonRisks: ["Significant redness, swelling lasting 5-14 days", "Pinpoint bleeding immediately post-procedure", "Peeling and crusting 3-7 days", "Itching during healing", "Acneiform eruptions during healing"],
        seriousRisks: ["Post-inflammatory hyperpigmentation (significant risk in Indian skin types IV-VI)", "Hypopigmentation (potentially permanent)", "Prolonged erythema (months)", "Infection (bacterial, herpetic, fungal)", "Scarring or hypertrophic scar", "Ectropion if treated too close to eyelids", "Demarcation lines"],
        contraindications: ["Pregnancy", "Active herpes infection (HSV prophylaxis required even with history)", "Active acne or skin infection", "Recent isotretinoin use (6-12 months washout recommended)", "Recent sun exposure or tan", "History of keloid scarring (relative, with caution)", "Connective tissue disease"],
        aftercare: ["Strict aftercare regimen — gentle cleansing, occlusive moisturizer (per protocol)", "Antiviral prophylaxis if indicated", "Strict sun avoidance and SPF 50+ for 8-12 weeks minimum", "Avoid active skincare ingredients (retinoids, AHAs, BHAs) for 4 weeks", "Expect downtime of 7-14 days with social downtime"],
        duration: "Significant results from a single treatment. May need 1-3 treatments. Final results emerge over 3-6 months.",
      },
      "Pico Laser": {
        description: "Picosecond-domain laser treatment for pigmentation, tattoo removal, or skin rejuvenation. Delivers ultra-short pulses with photoacoustic effect.",
        commonRisks: ["Mild redness, swelling post-treatment", "Pinpoint bleeding for tattoo removal", "Mild discomfort during treatment", "Temporary darkening of target lesions"],
        seriousRisks: ["Post-inflammatory hyperpigmentation (lower risk than Q-switched but still possible in dark skin)", "Hypopigmentation", "Blistering at high settings", "Scarring (rare)", "Paradoxical pigmentation"],
        contraindications: ["Pregnancy", "Active skin infection", "Recent sun exposure", "Use of photosensitizing medications", "Tanned skin"],
        aftercare: ["SPF 50+ daily for 4 weeks minimum", "Avoid sun exposure", "Gentle skincare, avoid actives for 5 days", "Series of 4-8 sessions typically required"],
        duration: "Multiple sessions required. Results visible over the treatment series.",
      },
      "IPL (Intense Pulsed Light)": {
        description: "Broadband non-coherent light treatment for vascular lesions, pigmentation, photodamage, and hair reduction.",
        commonRisks: ["Redness, mild swelling for 24-48 hours", "Temporary darkening of pigmented spots (peppering effect) before sloughing", "Mild discomfort during treatment"],
        seriousRisks: ["Post-inflammatory hyperpigmentation (significant risk in Indian skin types IV-VI)", "Hypopigmentation", "Blistering or burns if energy is too high or skin is tanned", "Scarring", "Worsening of melasma if used inappropriately"],
        contraindications: ["Pregnancy", "Skin type V-VI (caution; many practitioners avoid IPL)", "Recent tan or sun exposure", "Photosensitizing medications", "Active infection or open wounds", "Melasma (relative)"],
        aftercare: ["Strict sun protection SPF 50+ for at least 4 weeks", "Avoid heat (sauna, hot tubs) for 48 hours", "Gentle skincare; no actives for 5 days", "Typically 4-6 sessions spaced 4 weeks apart"],
        duration: "Maintenance sessions every 6-12 months may be needed.",
      },
      "Radiofrequency (Monopolar/Bipolar/Fractional RF)": {
        description: "Application of radiofrequency energy to heat dermal tissue, stimulating collagen contraction and neocollagenesis for skin tightening or remodeling.",
        commonRisks: ["Redness, warmth, mild swelling lasting hours to 1-2 days", "Mild discomfort during treatment"],
        seriousRisks: ["Burns or blistering if energy excessive or coupling inadequate", "Fat atrophy in treatment area (rare)", "Persistent erythema", "Temporary numbness or dysesthesia", "Inadequate response (no improvement)"],
        contraindications: ["Pregnancy", "Pacemaker or implanted electronic devices", "Metal implants in treatment area", "Active skin infection", "Recent fillers in treatment area (relative — wait 2 weeks)"],
        aftercare: ["Cool compresses if needed", "Gentle skincare and SPF", "Normal activities can usually resume immediately", "Series of 3-6 sessions typically; results progressive"],
        duration: "Results develop over 2-6 months. Maintenance every 12-18 months.",
      },
      "HIFU (High-Intensity Focused Ultrasound)": {
        description: "Focused ultrasound delivered to specific depths in the dermis and subdermal tissue to create thermal coagulation points that stimulate tissue tightening over weeks to months.",
        commonRisks: ["Discomfort during treatment (can be significant in bony areas)", "Mild redness or swelling for 24-48 hours", "Tenderness or aching for several days", "Temporary numbness"],
        seriousRisks: ["Nerve injury (motor) — typically transient but rarely persistent", "Skin burns or linear erythema if depth/energy mis-set", "Inadequate response", "Bruising"],
        contraindications: ["Pregnancy", "Active skin infection or open wounds", "Cystic acne in treatment area", "Implants (fillers, threads) in treatment area (relative)", "Metallic implants in face"],
        aftercare: ["Normal activities resumed same day", "Mild tenderness may persist 1-2 weeks", "Gentle skincare", "Results develop over 2-3 months and continue improving up to 6 months"],
        duration: "Results last 12-18 months. Single treatment typically; may repeat at 12 months.",
      },
    },
  },
  "Chemical Peels": {
    icon: "🧪",
    procedures: {
      "Superficial Chemical Peel (Glycolic / Lactic / Mandelic / Salicylic)": {
        description: "Application of superficial chemical peeling agent to exfoliate stratum corneum and improve skin texture, pigmentation, or mild acne.",
        commonRisks: ["Stinging or burning during application", "Mild redness lasting hours to 1-2 days", "Light flaking 2-5 days post-peel", "Dryness"],
        seriousRisks: ["Post-inflammatory hyperpigmentation (significant risk in Indian skin types IV-VI)", "Hypopigmentation", "Persistent erythema", "Contact dermatitis or allergic reaction", "Worsening of melasma if not done properly", "Crusting or scab formation"],
        contraindications: ["Pregnancy (relative, depends on agent)", "Active skin infection (herpes, bacterial, fungal)", "Recent isotretinoin (6-month washout typical)", "Recent sun exposure or tan", "Open wounds or eczema in treatment area", "Use of retinoids or actives within 5-7 days"],
        aftercare: ["Strict SPF 50+ daily for 4 weeks", "Gentle cleanser and bland moisturizer", "Avoid active ingredients (retinoids, AHAs, scrubs) for 5-7 days", "Do not pick or peel flaking skin", "Series of 4-6 peels spaced 2-4 weeks apart for best results"],
        duration: "Cumulative effect over series. Maintenance every 1-3 months.",
      },
      "Medium-Depth Chemical Peel (TCA 15-35%)": {
        description: "Application of trichloroacetic acid (TCA) peel reaching the papillary dermis, used for pigmentation, fine lines, photodamage, or superficial acne scars.",
        commonRisks: ["Significant stinging or burning during procedure", "Frosting (whitening) during application", "Redness and swelling for 3-5 days", "Bronze appearance and peeling for 5-10 days", "Itching during healing"],
        seriousRisks: ["Post-inflammatory hyperpigmentation (HIGH risk in Indian skin)", "Hypopigmentation (can be permanent)", "Scarring or textural changes", "Infection (bacterial, herpetic)", "Demarcation lines at treatment borders", "Prolonged erythema (weeks to months)"],
        contraindications: ["Pregnancy", "Skin types V-VI (relative, requires very experienced practitioner)", "Recent isotretinoin (6-12 month washout)", "Active infection (herpes prophylaxis required)", "Recent sun exposure", "Keloid tendency", "Connective tissue disease"],
        aftercare: ["Strict aftercare protocol — moisturization, gentle cleansing", "Antiviral prophylaxis if indicated", "Strict sun avoidance and SPF 50+ for 8-12 weeks", "Do NOT pick or peel skin manually", "Social downtime of 5-10 days expected", "Avoid active skincare for 4 weeks"],
        duration: "Single treatment usually. May repeat at 6-12 months if needed.",
      },
    },
  },
  "Hair Restoration": {
    icon: "💇",
    procedures: {
      "PRP for Hair Loss": {
        description: "Injection of autologous platelet-rich plasma into the scalp to stimulate hair follicles and improve hair density.",
        commonRisks: ["Injection-site pain, bruising, swelling", "Temporary scalp tenderness for 1-3 days", "Mild headache post-procedure"],
        seriousRisks: ["Infection at injection sites (rare with sterile technique)", "Inadequate response (variable response rates documented in literature)", "Transient shedding 2-4 weeks post-procedure (typically resolves)", "Allergic reaction to anticoagulant used in tube"],
        contraindications: ["Active scalp infection or inflammation", "Bleeding disorders or anticoagulant therapy", "Active scalp psoriasis or seborrheic dermatitis", "Pregnancy or breastfeeding (relative)", "Severe systemic illness", "Recent corticosteroid use systemically"],
        aftercare: ["No hair wash for 24 hours", "Avoid strenuous exercise for 24 hours", "Avoid heat (sauna, hair dryers on high) for 48 hours", "Series of 3-6 sessions spaced 4 weeks apart", "Maintenance every 3-6 months"],
        duration: "Response variable. Initial results in 3-4 months. Best assessed at 6 months. Maintenance ongoing.",
      },
      "GFC (Growth Factor Concentrate) for Hair": {
        description: "Injection of growth factor concentrate derived from autologous blood into the scalp to promote hair growth.",
        commonRisks: ["Injection-site pain, bruising, swelling", "Mild scalp tenderness for 1-3 days", "Mild headache"],
        seriousRisks: ["Infection at injection sites", "Inadequate response", "Transient shedding", "Reaction to processing chemicals"],
        contraindications: ["Active scalp infection", "Bleeding disorders or anticoagulants", "Active scalp dermatoses", "Pregnancy or breastfeeding (relative)", "Severe systemic illness"],
        aftercare: ["No hair wash for 24 hours", "Avoid strenuous exercise for 24 hours", "Avoid heat for 48 hours", "Typically 4-6 sessions spaced 4 weeks apart"],
        duration: "Results emerge in 3-6 months. Maintenance ongoing.",
      },
      "Hair Transplant (FUE)": {
        description: "Surgical follicular unit extraction and transplantation to areas of hair loss.",
        commonRisks: ["Pain and swelling for 3-7 days", "Crusting at donor and recipient sites", "Temporary shock loss of native hair (1-3 months)", "Numbness or tingling at sites for weeks to months", "Bruising"],
        seriousRisks: ["Infection at donor or recipient sites", "Folliculitis", "Visible scarring at donor area (typically dot-like)", "Poor graft survival or low yield", "Unnatural appearance (hairline design issues, density issues)", "Cyst formation", "Persistent numbness"],
        contraindications: ["Active scalp infection or scalp disease", "Bleeding disorders or anticoagulant therapy (relative)", "Inadequate donor area", "Unrealistic patient expectations", "Active alopecia areata or scarring alopecia (without specialist input)", "Significant medical comorbidities"],
        aftercare: ["Detailed post-op instructions including head positioning, washing protocol, sleeping position", "Antibiotics and analgesics as prescribed", "Avoid alcohol, smoking for 1 week", "No strenuous activity or swimming for 2 weeks", "Final results visible at 12-18 months"],
        duration: "Transplanted hair is permanent. Final density and appearance at 12-18 months.",
      },
    },
  },
  "Skin Surgery & Other": {
    icon: "🩹",
    procedures: {
      "Cyst / Lipoma / Skin Tag Excision": {
        description: "Minor surgical excision of benign skin lesions under local anesthesia.",
        commonRisks: ["Pain at site, bruising, swelling", "Bleeding during or after procedure", "Temporary discomfort during healing"],
        seriousRisks: ["Scarring (every excision leaves a scar; size and quality variable)", "Infection at surgical site", "Recurrence of lesion (especially with incomplete cyst excision)", "Hematoma formation", "Hyper- or hypopigmentation of scar", "Keloid or hypertrophic scar (especially in predisposed individuals)", "Nerve injury if near sensory nerve"],
        contraindications: ["Active infection at site", "Bleeding disorders or anticoagulant therapy (relative)", "Keloid history (relative — informed consent essential)", "Pregnancy (relative — non-urgent excisions deferred)"],
        aftercare: ["Wound care as instructed; keep dry for 24-48 hours", "Antibiotics if prescribed", "Suture removal as scheduled (typically 5-14 days depending on location)", "Sun protection of scar for 6-12 months", "Scar massage and silicone gel may be recommended"],
        duration: "Healing 2-4 weeks. Scar maturation 6-18 months.",
      },
      "Cautery / Radiofrequency Lesion Removal": {
        description: "Use of electrocautery or radiofrequency to remove DPN, syringoma, milia, skin tags, seborrheic keratosis, or similar benign lesions.",
        commonRisks: ["Discomfort during procedure (despite topical anesthesia)", "Mild redness and crusting 5-10 days", "Pinpoint bleeding"],
        seriousRisks: ["Post-inflammatory hyperpigmentation (HIGH risk in Indian skin types IV-VI)", "Hypopigmentation (can be permanent)", "Scarring or pitted/atrophic scars", "Infection", "Recurrence of lesions"],
        contraindications: ["Active skin infection", "Pacemaker (for monopolar devices)", "Bleeding disorders", "Recent isotretinoin (relative)", "Keloid tendency"],
        aftercare: ["Topical antibiotic ointment as instructed", "Strict sun protection SPF 50+ for 8-12 weeks", "Do not pick scabs", "Multiple sessions often needed for DPN/syringoma"],
        duration: "Healing 1-2 weeks. Final pigmentation outcome at 3-6 months.",
      },
      "Microneedling / Dermaroller / Dermapen": {
        description: "Mechanical creation of microscopic skin punctures to stimulate collagen production and improve scars, texture, or pigmentation.",
        commonRisks: ["Redness and mild swelling for 24-72 hours", "Mild pinpoint bleeding during procedure", "Temporary tightness or sensitivity"],
        seriousRisks: ["Post-inflammatory hyperpigmentation in dark skin", "Infection (HSV reactivation possible)", "Tram-track scarring with aggressive technique", "Worsening of melasma if done incorrectly", "Granuloma if topicals are pushed through skin inappropriately"],
        contraindications: ["Active acne or skin infection", "Active herpes infection", "Pregnancy (relative for facial)", "Anticoagulant therapy (relative)", "Keloid tendency", "Use of isotretinoin (relative)"],
        aftercare: ["Use only bland skincare for 48 hours", "SPF 50+ daily for 2 weeks minimum", "Avoid active ingredients (retinoids, AHAs) for 5-7 days", "Avoid heat, exercise, makeup for 24 hours", "Series of 3-6 sessions spaced 4 weeks apart"],
        duration: "Cumulative effect. Maintenance every 6-12 months.",
      },
    },
  },
};

const CONSENT_DISCLAIMER_TEXT = `IMPORTANT — TEMPLATE FOR EDUCATIONAL REFERENCE ONLY

This document is a starting template based on common Indian aesthetic medicine consent practice. It is NOT a substitute for legal advice or a finished consent form. Before using this document with patients, the treating practitioner MUST:

1. Review the content with a qualified medical lawyer familiar with Indian medical malpractice law and the Digital Personal Data Protection Act, 2023.
2. Customize the content based on specific procedure protocols, individual patient circumstances, and current clinical guidelines.
3. Verify compliance with applicable State Medical Council requirements and professional standards.
4. Update language to reflect current case law and regulatory developments.

This template is provided by SKINARIO as a community educational resource. Liability for clinical use rests entirely with the treating practitioner and their clinic. SKINARIO and its affiliates make no warranty as to the legal adequacy of this template for any specific use.`;


// ═══ CONSENT LANGUAGES ═══
// Supported languages for consent generation. English-source body with selective
// translation of common boilerplate phrases. Medical, procedure, and legal terms
// are kept in English (universally understood in Indian clinical practice).
const CONSENT_LANGUAGES = [
  { code: "en", label: "English",  nativeLabel: "English",   rtl: false },
  { code: "hi", label: "Hindi",    nativeLabel: "हिंदी",       rtl: false },
  { code: "mr", label: "Marathi",  nativeLabel: "मराठी",      rtl: false },
  { code: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી",      rtl: false },
  { code: "bn", label: "Bengali",  nativeLabel: "বাংলা",       rtl: false },
  { code: "ta", label: "Tamil",    nativeLabel: "தமிழ்",       rtl: false },
  { code: "te", label: "Telugu",   nativeLabel: "తెలుగు",      rtl: false },
];

// Translation map for boilerplate sentences and section headings.
// Strict policy: medical, procedural, and statute names remain in English regardless.
// These translations have been written by hand based on standard medical-Hindi/Marathi/etc.
// Please have a native speaker verify before clinical use.
const CONSENT_I18N = {
  // Section headings (1-13 in numbered order)
  "h_patient_info":     { en:"Patient Identification", hi:"रोगी की पहचान", mr:"रुग्णाची ओळख", gu:"દર્દીની ઓળખ", bn:"রোগীর পরিচয়", ta:"நோயாளி அடையாளம்", te:"రోగి గుర్తింపు" },
  "h_procedure_desc":   { en:"Description of the Procedure", hi:"प्रक्रिया का विवरण", mr:"प्रक्रियेचे वर्णन", gu:"પ્રક્રિયાનું વર્ણન", bn:"পদ্ধতির বিবরণ", ta:"செயல்முறை விளக்கம்", te:"విధాన వివరణ" },
  "h_risks":            { en:"Risks, Side Effects, and Complications", hi:"जोखिम, दुष्प्रभाव और जटिलताएँ", mr:"धोके, दुष्परिणाम आणि गुंतागुंत", gu:"જોખમો, આડઅસરો અને જટિલતાઓ", bn:"ঝুঁকি, পার্শ্বপ্রতিক্রিয়া এবং জটিলতা", ta:"அபாயங்கள், பக்க விளைவுகள் மற்றும் சிக்கல்கள்", te:"ప్రమాదాలు, దుష్ప్రభావాలు మరియు సంక్లిష్టతలు" },
  "h_contra":           { en:"Contraindications and Medical History Disclosure", hi:"विपरीत संकेत और चिकित्सा इतिहास का खुलासा", mr:"विरोधी संकेत आणि वैद्यकीय इतिहासाचा खुलासा", gu:"વિરોધાભાસ અને તબીબી ઇતિહાસનો ખુલાસો", bn:"বিরোধী ইঙ্গিত এবং চিকিৎসা ইতিহাস প্রকাশ", ta:"முரண்பாடுகள் மற்றும் மருத்துவ வரலாறு வெளிப்படுத்துதல்", te:"వ్యతిరేక సూచనలు మరియు వైద్య చరిత్ర వెల్లడి" },
  "h_alternatives":     { en:"Alternatives and Decision to Proceed", hi:"विकल्प और आगे बढ़ने का निर्णय", mr:"पर्याय आणि पुढे जाण्याचा निर्णय", gu:"વિકલ્પો અને આગળ વધવાનો નિર્ણય", bn:"বিকল্প এবং এগিয়ে যাওয়ার সিদ্ধান্ত", ta:"மாற்று வழிகள் மற்றும் தொடர முடிவு", te:"ప్రత్యామ్నాయాలు మరియు కొనసాగించాలనే నిర్ణయం" },
  "h_photo":            { en:"Photography, Documentation, and Academic Use", hi:"फोटोग्राफी, दस्तावेज़ीकरण और शैक्षिक उपयोग", mr:"छायाचित्रण, दस्तऐवजीकरण आणि शैक्षणिक वापर", gu:"ફોટોગ્રાફી, દસ્તાવેજીકરણ અને શૈક્ષણિક ઉપયોગ", bn:"ফটোগ্রাফি, ডকুমেন্টেশন এবং একাডেমিক ব্যবহার", ta:"புகைப்படம், ஆவணப்படுத்தல் மற்றும் கல்வி பயன்பாடு", te:"ఫోటోగ్రఫీ, డాక్యుమెంటేషన్ మరియు విద్యా ఉపయోగం" },
  "h_dpdp":             { en:"Data Protection Notice (DPDP Act, 2023)", hi:"डेटा संरक्षण सूचना (DPDP Act, 2023)", mr:"डेटा संरक्षण सूचना (DPDP Act, 2023)", gu:"ડેટા સંરક્ષણ સૂચના (DPDP Act, 2023)", bn:"ডেটা সুরক্ষা বিজ্ঞপ্তি (DPDP Act, 2023)", ta:"தரவு பாதுகாப்பு அறிவிப்பு (DPDP Act, 2023)", te:"డేటా రక్షణ నోటీసు (DPDP Act, 2023)" },
  "h_cost":             { en:"Cost and Payment", hi:"शुल्क और भुगतान", mr:"शुल्क आणि देयक", gu:"ખર્ચ અને ચૂકવણી", bn:"খরচ এবং অর্থপ্রদান", ta:"செலவு மற்றும் கட்டணம்", te:"ఖర్చు మరియు చెల్లింపు" },
  "h_aftercare":        { en:"Post-Procedure Care", hi:"प्रक्रिया के बाद की देखभाल", mr:"प्रक्रियेनंतरची काळजी", gu:"પ્રક્રિયા પછીની સંભાળ", bn:"পদ্ধতির পরের যত্ন", ta:"செயல்முறைக்கு பிந்தைய பராமரிப்பு", te:"విధానం తర్వాత సంరక్షణ" },
  "h_patient_concern":  { en:"Patient's Specific Concern / Expected Outcome", hi:"रोगी की विशिष्ट चिंता / अपेक्षित परिणाम", mr:"रुग्णाची विशिष्ट चिंता / अपेक्षित परिणाम", gu:"દર્દીની વિશિષ્ટ ચિંતા / અપેક્ષિત પરિણામ", bn:"রোগীর নির্দিষ্ট উদ্বেগ / প্রত্যাশিত ফলাফল", ta:"நோயாளியின் குறிப்பிட்ட கவலை / எதிர்பார்க்கப்படும் முடிவு", te:"రోగి యొక్క నిర్దిష్ట ఆందోళన / ఆశించిన ఫలితం" },
  "patient_concern_intro": { en:"The patient has specifically expressed the following concerns and expectations regarding this procedure. The treating doctor has discussed and aligned the treatment plan accordingly:", hi:"रोगी ने इस प्रक्रिया के संबंध में निम्नलिखित चिंताएँ और अपेक्षाएँ विशेष रूप से व्यक्त की हैं। उपचार करने वाले डॉक्टर ने उपचार योजना पर तदनुसार चर्चा की है और सामंजस्य स्थापित किया है:", mr:"रुग्णाने या प्रक्रियेबाबत खालील चिंता आणि अपेक्षा विशेषतः व्यक्त केल्या आहेत. उपचार करणाऱ्या डॉक्टरांनी त्यानुसार उपचार योजनेवर चर्चा केली आहे आणि ती जुळवली आहे:", gu:"દર્દીએ આ પ્રક્રિયા સંબંધિત નીચે મુજબની ચિંતાઓ અને અપેક્ષાઓ ખાસ વ્યક્ત કરી છે. સારવાર કરનાર ડોક્ટરે તે મુજબ સારવાર યોજનાની ચર્ચા કરી છે અને તેને સંરેખિત કર્યું છે:", bn:"রোগী এই পদ্ধতি সম্পর্কে নিম্নলিখিত উদ্বেগ এবং প্রত্যাশা বিশেষভাবে প্রকাশ করেছেন। চিকিৎসাকারী ডাক্তার সেই অনুযায়ী চিকিৎসা পরিকল্পনা নিয়ে আলোচনা করেছেন এবং সারিবদ্ধ করেছেন:", ta:"நோயாளி இந்த செயல்முறை குறித்து பின்வரும் கவலைகளையும் எதிர்பார்ப்புகளையும் குறிப்பாக வெளிப்படுத்தியுள்ளார். சிகிச்சை அளிக்கும் மருத்துவர் அதற்கேற்ப சிகிச்சை திட்டத்தை விவாதித்து சீரமைத்துள்ளார்:", te:"రోగి ఈ విధానం గురించి ఈ క్రింది ఆందోళనలు మరియు అంచనాలను ప్రత్యేకంగా వ్యక్తం చేశారు. చికిత్స చేస్తున్న వైద్యుడు అదే విధంగా చికిత్స ప్రణాళికను చర్చించి సర్దుబాటు చేశారు:" },
  "h_authorization":    { en:"Authorization and Consent", hi:"प्राधिकरण और सहमति", mr:"प्राधिकरण आणि संमती", gu:"અધિકૃતતા અને સંમતિ", bn:"অনুমোদন এবং সম্মতি", ta:"அதிகாரம் மற்றும் சம்மதம்", te:"అధికారం మరియు అంగీకారం" },
  "h_withdraw":         { en:"Right to Withdraw Consent", hi:"सहमति वापस लेने का अधिकार", mr:"संमती मागे घेण्याचा अधिकार", gu:"સંમતિ પાછી ખેંચવાનો અધિકાર", bn:"সম্মতি প্রত্যাহার করার অধিকার", ta:"சம்மதத்தை திரும்பப் பெறும் உரிமை", te:"అంగీకారాన్ని ఉపసంహరించుకునే హక్కు" },
  "h_translation":      { en:"Translation (if applicable)", hi:"अनुवाद (यदि लागू हो)", mr:"भाषांतर (लागू असल्यास)", gu:"અનુવાદ (જો લાગુ હોય)", bn:"অনুবাদ (যদি প্রযোজ্য হয়)", ta:"மொழிபெயர்ப்பு (பொருந்தினால்)", te:"అనువాదం (వర్తిస్తే)" },
  "h_signatures":       { en:"Signatures", hi:"हस्ताक्षर", mr:"स्वाक्षरी", gu:"સહીઓ", bn:"স্বাক্ষর", ta:"கையொப்பங்கள்", te:"సంతకాలు" },
  // Common phrases
  "title_main":         { en:"INFORMED CONSENT FOR", hi:"सूचित सहमति पत्र —", mr:"सूचित संमती पत्र —", gu:"સૂચિત સંમતિ પત્ર —", bn:"অবহিত সম্মতি পত্র —", ta:"தகவலறிந்த சம்மதம் —", te:"తెలియజేయబడిన అంగీకారం —" },
  "informed_lang":      { en:"I have been informed, in the language I best understand, that:", hi:"मुझे उस भाषा में सूचित किया गया है जो मैं सबसे अच्छी तरह समझता/समझती हूँ कि:", mr:"मला मी सर्वोत्तम समजते त्या भाषेत खालीलप्रमाणे सूचित करण्यात आले आहे:", gu:"મને હું શ્રેષ્ઠ સમજુ છું તે ભાષામાં નીચે મુજબ જાણ કરવામાં આવી છે:", bn:"আমাকে আমি সবচেয়ে ভালো বুঝি এমন ভাষায় জানানো হয়েছে যে:", ta:"நான் சிறப்பாக புரிந்து கொள்ளும் மொழியில் எனக்கு பின்வருமாறு தெரிவிக்கப்பட்டுள்ளது:", te:"నేను బాగా అర్థం చేసుకునే భాషలో నాకు ఈ క్రింది విషయాలు తెలియజేయబడ్డాయి:" },
  "no_guarantee":       { en:"I understand that the practice of medicine is not an exact science and that no guarantee, warranty, or assurance has been given to me about the outcome of this procedure.", hi:"मैं समझता/समझती हूँ कि चिकित्सा अभ्यास एक सटीक विज्ञान नहीं है और इस प्रक्रिया के परिणाम के बारे में मुझे कोई गारंटी, वारंटी या आश्वासन नहीं दिया गया है।", mr:"मला समजते की वैद्यकीय सराव हे अचूक विज्ञान नाही आणि या प्रक्रियेच्या परिणामाबद्दल मला कोणतीही हमी, वॉरंटी किंवा आश्वासन देण्यात आलेले नाही.", gu:"હું સમજું છું કે દવાનો અભ્યાસ ચોક્કસ વિજ્ઞાન નથી અને આ પ્રક્રિયાના પરિણામ વિશે મને કોઈ ગેરંટી, વોરંટી અથવા ખાતરી આપવામાં આવી નથી.", bn:"আমি বুঝি যে চিকিৎসার অনুশীলন একটি নির্ভুল বিজ্ঞান নয় এবং এই পদ্ধতির ফলাফল সম্পর্কে আমাকে কোনো গ্যারান্টি, ওয়ারেন্টি বা আশ্বাস দেওয়া হয়নি।", ta:"மருத்துவம் ஒரு துல்லியமான அறிவியல் அல்ல என்றும், இந்த செயல்முறையின் விளைவு குறித்து எனக்கு எந்த உத்தரவாதமும் வழங்கப்படவில்லை என்றும் நான் புரிந்து கொள்கிறேன்.", te:"వైద్యం ఖచ్చితమైన శాస్త్రం కాదని, ఈ విధానం ఫలితం గురించి నాకు ఎటువంటి హామీ ఇవ్వబడలేదని నేను అర్థం చేసుకున్నాను." },
  "common_risks":       { en:"Common, generally short-term risks:", hi:"सामान्य, अल्पकालिक जोखिम:", mr:"सामान्य, अल्पकालीन धोके:", gu:"સામાન્ય, ટૂંકા ગાળાના જોખમો:", bn:"সাধারণ, স্বল্পমেয়াদী ঝুঁকি:", ta:"பொதுவான, பொதுவாக குறுகியகால அபாயங்கள்:", te:"సాధారణ, స్వల్పకాలిక ప్రమాదాలు:" },
  "serious_risks":      { en:"Less common but potentially serious risks:", hi:"कम सामान्य लेकिन गंभीर जोखिम:", mr:"कमी सामान्य परंतु संभाव्य गंभीर धोके:", gu:"ઓછા સામાન્ય પણ સંભવિત ગંભીર જોખમો:", bn:"কম সাধারণ কিন্তু সম্ভাব্য গুরুতর ঝুঁকি:", ta:"குறைவான பொதுவான ஆனால் கடுமையான அபாயங்கள்:", te:"తక్కువ సాధారణ కానీ తీవ్రమైన ప్రమాదాలు:" },
  "i_confirm_disclosed": { en:"I confirm that I have disclosed to my treating doctor any of the following that apply to me:", hi:"मैं पुष्टि करता/करती हूँ कि मैंने अपने उपचार करने वाले डॉक्टर को निम्नलिखित में से जो भी मुझ पर लागू होते हैं, उनकी जानकारी दी है:", mr:"मी पुष्टी करतो/करते की मला लागू असलेले खालीलपैकी कोणतेही माझ्या उपचार करणाऱ्या डॉक्टरांना सांगितले आहे:", gu:"હું પુષ્ટિ કરું છું કે મેં મારા સારવાર કરનાર ડોક્ટરને નીચે મુજબ જે મને લાગુ પડે છે તે જાહેર કર્યું છે:", bn:"আমি নিশ্চিত করছি যে আমার চিকিৎসাকারী ডাক্তারের কাছে নিম্নলিখিত যা আমার ক্ষেত্রে প্রযোজ্য তা প্রকাশ করেছি:", ta:"எனக்கு பொருந்தும் பின்வரும் எதையும் என் சிகிச்சை அளிக்கும் மருத்துவருக்கு வெளிப்படுத்தியுள்ளேன் என நான் உறுதிப்படுத்துகிறேன்:", te:"నాకు వర్తించే క్రింది వాటిని నేను నా చికిత్స చేస్తున్న వైద్యుడికి వెల్లడించానని నేను నిర్ధారిస్తున్నాను:" },
  "alternatives_text":  { en:"The treating doctor has explained available alternatives to this procedure, including the option of not proceeding. I have had adequate opportunity to ask questions, and I have decided to proceed with the procedure of my own free will.", hi:"उपचार करने वाले डॉक्टर ने इस प्रक्रिया के उपलब्ध विकल्पों की व्याख्या की है, जिसमें आगे न बढ़ने का विकल्प भी शामिल है। मुझे प्रश्न पूछने का पर्याप्त अवसर मिला है, और मैंने अपनी स्वतंत्र इच्छा से प्रक्रिया के साथ आगे बढ़ने का निर्णय लिया है।", mr:"उपचार करणाऱ्या डॉक्टरांनी या प्रक्रियेच्या उपलब्ध पर्यायांची, पुढे न जाण्याच्या पर्यायासह, स्पष्टीकरण दिले आहे. मला प्रश्न विचारण्याची पुरेशी संधी मिळाली आहे, आणि मी माझ्या स्वेच्छेने प्रक्रिया पुढे चालू ठेवण्याचा निर्णय घेतला आहे.", gu:"સારવાર કરનાર ડોક્ટરે આ પ્રક્રિયા માટેના વિકલ્પોની, આગળ ન વધવાના વિકલ્પ સહિત, સમજૂતી આપી છે. મને પ્રશ્નો પૂછવાની પૂરતી તક મળી છે, અને મેં મારી સ્વતંત્ર ઇચ્છાથી પ્રક્રિયા સાથે આગળ વધવાનો નિર્ણય લીધો છે.", bn:"চিকিৎসাকারী ডাক্তার এই পদ্ধতির বিকল্পগুলি, এগিয়ে না যাওয়ার বিকল্প সহ, ব্যাখ্যা করেছেন। আমি প্রশ্ন জিজ্ঞাসা করার পর্যাপ্ত সুযোগ পেয়েছি, এবং আমি আমার স্বাধীন ইচ্ছায় পদ্ধতির সাথে এগিয়ে যাওয়ার সিদ্ধান্ত নিয়েছি।", ta:"சிகிச்சை அளிக்கும் மருத்துவர் இந்த செயல்முறைக்கான மாற்று வழிகளை, தொடராமல் இருக்கும் வழியையும் சேர்த்து, விளக்கியுள்ளார். கேள்விகள் கேட்க எனக்கு போதுமான வாய்ப்பு கிடைத்துள்ளது, மற்றும் என் சொந்த சுதந்திரமான விருப்பத்தின் பேரில் செயல்முறையை தொடர முடிவு செய்துள்ளேன்.", te:"చికిత్స చేస్తున్న వైద్యుడు ఈ విధానానికి ప్రత్యామ్నాయాలను, కొనసాగించకుండా ఉండే ఎంపికతో సహా, వివరించారు. ప్రశ్నలు అడిగే తగిన అవకాశం నాకు ఉంది, మరియు నేను నా స్వేచ్ఛతో విధానంతో ముందుకు సాగాలని నిర్ణయించుకున్నాను." },
  "photo_consent":      { en:"I consent to pre-, intra-, and post-procedure photographs being taken for clinical documentation. Such photographs may be used for academic, scientific, or teaching purposes, provided that my identity is not disclosed and reasonable confidentiality is maintained.", hi:"मैं नैदानिक दस्तावेज़ीकरण के लिए प्रक्रिया से पहले, उसके दौरान और बाद की तस्वीरें लेने की सहमति देता/देती हूँ। ऐसी तस्वीरों का उपयोग शैक्षणिक, वैज्ञानिक या शिक्षण उद्देश्यों के लिए किया जा सकता है, बशर्ते कि मेरी पहचान उजागर न की जाए और उचित गोपनीयता बनाए रखी जाए।", mr:"मी क्लिनिकल दस्तऐवजीकरणासाठी प्रक्रियेपूर्वी, दरम्यान आणि नंतर छायाचित्रे घेण्यास संमती देतो/देते. अशा छायाचित्रांचा वापर शैक्षणिक, वैज्ञानिक किंवा शिक्षणाच्या उद्देशाने केला जाऊ शकतो, परंतु माझी ओळख उघड केली जाणार नाही आणि योग्य गोपनीयता राखली जाईल.", gu:"હું ક્લિનિકલ દસ્તાવેજીકરણ માટે પ્રક્રિયા પહેલા, દરમિયાન અને પછી તસવીરો લેવાની સંમતિ આપું છું. આવી તસવીરોનો ઉપયોગ શૈક્ષણિક, વૈજ્ઞાનિક અથવા શિક્ષણ હેતુ માટે કરી શકાય છે, જો કે મારી ઓળખ જાહેર ન કરવામાં આવે અને યોગ્ય ગોપનીયતા જાળવવામાં આવે.", bn:"আমি ক্লিনিক্যাল ডকুমেন্টেশনের জন্য পদ্ধতির আগে, চলাকালীন এবং পরে ফটো তোলার সম্মতি দিচ্ছি। এই ধরনের ফটো শিক্ষামূলক, বৈজ্ঞানিক বা শিক্ষাদানের উদ্দেশ্যে ব্যবহার করা যেতে পারে, যদি আমার পরিচয় প্রকাশ না করা হয় এবং যুক্তিসঙ্গত গোপনীয়তা বজায় রাখা হয়।", ta:"மருத்துவ ஆவணப்படுத்தலுக்காக செயல்முறைக்கு முன், போது மற்றும் பின் புகைப்படங்கள் எடுக்க நான் சம்மதிக்கிறேன். அத்தகைய புகைப்படங்கள் கல்வி, அறிவியல் அல்லது கற்பித்தல் நோக்கங்களுக்காக பயன்படுத்தப்படலாம், என் அடையாளம் வெளியிடப்படாமலும், நியாயமான ரகசியம் பேணப்பட்டும் இருந்தால்.", te:"క్లినికల్ డాక్యుమెంటేషన్ కోసం విధానం ముందు, మధ్యలో మరియు తర్వాత ఫోటోలు తీయడానికి నేను అంగీకరిస్తున్నాను. ఇటువంటి ఫోటోలను విద్యా, శాస్త్రీయ లేదా బోధనా ప్రయోజనాల కోసం ఉపయోగించవచ్చు, నా గుర్తింపు వెల్లడి కానంతవరకు మరియు సహేతుకమైన గోప్యత పాటించబడినంతవరకు." },
  "withdraw_text":      { en:"I understand that I may withdraw this consent at any time before the procedure begins by communicating my decision verbally or in writing to the treating doctor or clinic staff. Once the procedure has commenced, withdrawal may be limited by clinical safety considerations.", hi:"मैं समझता/समझती हूँ कि मैं प्रक्रिया शुरू होने से पहले किसी भी समय अपना निर्णय उपचार करने वाले डॉक्टर या क्लिनिक स्टाफ को मौखिक या लिखित रूप में बताकर इस सहमति को वापस ले सकता/सकती हूँ। प्रक्रिया शुरू होने के बाद, नैदानिक सुरक्षा कारणों से वापसी सीमित हो सकती है।", mr:"मला समजते की प्रक्रिया सुरू होण्यापूर्वी कोणत्याही वेळी मी माझा निर्णय उपचार करणाऱ्या डॉक्टरांना किंवा क्लिनिक स्टाफला तोंडी किंवा लेखी कळवून ही संमती मागे घेऊ शकतो/शकते. प्रक्रिया सुरू झाल्यानंतर, क्लिनिकल सुरक्षेच्या कारणामुळे मागे घेणे मर्यादित असू शकते.", gu:"હું સમજું છું કે પ્રક્રિયા શરૂ થાય તે પહેલાં કોઈપણ સમયે હું મારો નિર્ણય સારવાર કરનાર ડોક્ટર અથવા ક્લિનિક સ્ટાફને મૌખિક અથવા લેખિતમાં જણાવીને આ સંમતિ પાછી ખેંચી શકું છું. પ્રક્રિયા શરૂ થયા પછી, ક્લિનિકલ સલામતીના કારણોને લીધે પાછી ખેંચવી મર્યાદિત હોઈ શકે છે.", bn:"আমি বুঝি যে পদ্ধতি শুরু হওয়ার আগে যেকোনো সময়ে আমি চিকিৎসাকারী ডাক্তার বা ক্লিনিক স্টাফকে মৌখিকভাবে বা লিখিতভাবে আমার সিদ্ধান্ত জানিয়ে এই সম্মতি প্রত্যাহার করতে পারি। পদ্ধতি শুরু হওয়ার পরে, ক্লিনিক্যাল সুরক্ষার কারণে প্রত্যাহার সীমিত হতে পারে।", ta:"செயல்முறை தொடங்குவதற்கு முன் எந்த நேரத்திலும் என் முடிவை சிகிச்சை அளிக்கும் மருத்துவர் அல்லது கிளினிக் ஊழியர்களுக்கு வாய்மொழியாகவோ அல்லது எழுத்தில் தெரிவித்து இந்த சம்மதத்தை திரும்பப் பெறலாம் என நான் புரிந்து கொள்கிறேன். செயல்முறை தொடங்கிய பின், மருத்துவ பாதுகாப்பு காரணங்களால் திரும்பப் பெறுவது வரம்புக்குட்படலாம்.", te:"విధానం ప్రారంభమయ్యే ముందు ఎప్పుడైనా చికిత్స చేస్తున్న వైద్యుడికి లేదా క్లినిక్ సిబ్బందికి నా నిర్ణయాన్ని మౌఖికంగా లేదా రాతపూర్వకంగా తెలియజేయడం ద్వారా ఈ అంగీకారాన్ని ఉపసంహరించుకోవచ్చని నేను అర్థం చేసుకున్నాను. విధానం ప్రారంభమైన తర్వాత, క్లినికల్ భద్రతా కారణాల వలన ఉపసంహరణ పరిమితం కావచ్చు." },
  // Form field labels
  "lbl_name":           { en:"Name", hi:"नाम", mr:"नाव", gu:"નામ", bn:"নাম", ta:"பெயர்", te:"పేరు" },
  "lbl_age":            { en:"Age", hi:"उम्र", mr:"वय", gu:"ઉંમર", bn:"বয়স", ta:"வயது", te:"వయస్సు" },
  "lbl_sex":            { en:"Sex", hi:"लिंग", mr:"लिंग", gu:"લિંગ", bn:"লিঙ্গ", ta:"பாலினம்", te:"లింగం" },
  "lbl_mobile":         { en:"Mobile", hi:"मोबाइल", mr:"मोबाइल", gu:"મોબાઈલ", bn:"মোবাইল", ta:"மொபைல்", te:"మొబైల్" },
  "lbl_patient_id":     { en:"Patient ID", hi:"रोगी आईडी", mr:"रुग्ण आयडी", gu:"દર્દી આઈડી", bn:"রোগী আইডি", ta:"நோயாளி ஐடி", te:"రోగి ID" },
  "lbl_address":        { en:"Address", hi:"पता", mr:"पत्ता", gu:"સરનામું", bn:"ঠিকানা", ta:"முகவரி", te:"చిరునామా" },
  "lbl_phone":          { en:"Phone", hi:"फ़ोन", mr:"फोन", gu:"ફોન", bn:"ফোন", ta:"தொலைபேசி", te:"ఫోన్" },
  "lbl_email":          { en:"Email", hi:"ईमेल", mr:"ईमेल", gu:"ઈમેલ", bn:"ইমেইল", ta:"மின்னஞ்சல்", te:"ఈమెయిల్" },
  "lbl_diagnosis":      { en:"Relevant medical diagnosis", hi:"प्रासंगिक चिकित्सा निदान", mr:"संबंधित वैद्यकीय निदान", gu:"સંબંધિત તબીબી નિદાન", bn:"প্রাসঙ্গিক চিকিৎসা নির্ণয়", ta:"தொடர்புடைய மருத்துவ நோய் கண்டறிதல்", te:"సంబంధిత వైద్య నిర్ధారణ" },
  "lbl_procedure":      { en:"Procedure to be performed", hi:"की जाने वाली प्रक्रिया", mr:"करण्यात येणारी प्रक्रिया", gu:"કરવામાં આવનાર પ્રક્રિયા", bn:"সম্পাদিত হবে এমন পদ্ধতি", ta:"செய்யப்பட வேண்டிய செயல்முறை", te:"నిర్వహించబడే విధానం" },
  "lbl_treatment_area": { en:"Area / site to be treated", hi:"उपचार किया जाने वाला क्षेत्र / स्थान", mr:"उपचार करण्यात येणारे क्षेत्र / स्थान", gu:"સારવાર કરવામાં આવનાર વિસ્તાર / સ્થાન", bn:"চিকিৎসার এলাকা / স্থান", ta:"சிகிச்சை அளிக்கப்பட வேண்டிய பகுதி / இடம்", te:"చికిత్స చేయవలసిన ప్రాంతం / స్థలం" },
  "lbl_date":           { en:"Date", hi:"दिनांक", mr:"दिनांक", gu:"તારીખ", bn:"তারিখ", ta:"தேதி", te:"తేదీ" },
  "lbl_expected":       { en:"Expected results and timeline", hi:"अपेक्षित परिणाम और समय-सीमा", mr:"अपेक्षित परिणाम आणि कालावधी", gu:"અપેક્ષિત પરિણામો અને સમય રેખા", bn:"প্রত্যাশিত ফলাফল এবং সময়রেখা", ta:"எதிர்பார்க்கப்படும் முடிவுகள் மற்றும் காலவரிசை", te:"ఆశించిన ఫలితాలు మరియు కాలక్రమం" },
  "lbl_translator":     { en:"Was translation to the patient's preferred language required?", hi:"क्या रोगी की पसंदीदा भाषा में अनुवाद की आवश्यकता थी?", mr:"रुग्णाच्या पसंतीच्या भाषेत भाषांतर आवश्यक होते का?", gu:"દર્દીની પસંદગીની ભાષામાં અનુવાદ જરૂરી હતો?", bn:"রোগীর পছন্দের ভাষায় অনুবাদ প্রয়োজন ছিল?", ta:"நோயாளியின் விருப்பமான மொழியில் மொழிபெயர்ப்பு தேவைப்பட்டதா?", te:"రోగి ఇష్టమైన భాషలోకి అనువాదం అవసరమైందా?" },
  "lbl_yes_no":         { en:"YES / NO", hi:"हाँ / नहीं", mr:"होय / नाही", gu:"હા / ના", bn:"হ্যাঁ / না", ta:"ஆம் / இல்லை", te:"అవును / కాదు" },
  "lbl_translator_name":{ en:"Name of translator (if any)", hi:"अनुवादक का नाम (यदि कोई हो)", mr:"भाषांतरकाराचे नाव (असल्यास)", gu:"અનુવાદકનું નામ (જો કોઈ હોય)", bn:"অনুবাদকের নাম (যদি থাকে)", ta:"மொழிபெயர்ப்பாளர் பெயர் (ஏதேனும் இருந்தால்)", te:"అనువాదకుని పేరు (ఏదైనా ఉంటే)" },
  "lbl_relationship":   { en:"Relationship to patient", hi:"रोगी के साथ संबंध", mr:"रुग्णाशी नाते", gu:"દર્દી સાથેનો સંબંધ", bn:"রোগীর সাথে সম্পর্ক", ta:"நோயாளியுடன் உறவு", te:"రోగితో సంబంధం" },
  "lbl_patient_sig":    { en:"Patient / Authorized Representative", hi:"रोगी / अधिकृत प्रतिनिधि", mr:"रुग्ण / अधिकृत प्रतिनिधी", gu:"દર્દી / અધિકૃત પ્રતિનિધિ", bn:"রোগী / অনুমোদিত প্রতিনিধি", ta:"நோயாளி / அங்கீகரிக்கப்பட்ட பிரதிநிதி", te:"రోగి / అధికారిక ప్రతినిధి" },
  "lbl_doctor_sig":     { en:"Treating Doctor", hi:"उपचार करने वाले डॉक्टर", mr:"उपचार करणारे डॉक्टर", gu:"સારવાર કરનાર ડોક્ટર", bn:"চিকিৎসাকারী ডাক্তার", ta:"சிகிச்சை அளிக்கும் மருத்துவர்", te:"చికిత్స చేస్తున్న వైద్యుడు" },
  "lbl_witness":        { en:"Witness", hi:"गवाह", mr:"साक्षीदार", gu:"સાક્ષી", bn:"সাক্ষী", ta:"சாட்சி", te:"సాక్షి" },
  "lbl_initial_here":   { en:"Initial here if you agree:", hi:"यदि आप सहमत हैं तो यहाँ आद्याक्षर लिखें:", mr:"तुम्ही सहमत असल्यास येथे आद्याक्षर लिहा:", gu:"જો તમે સંમત છો તો અહીં આદ્યાક્ષર લખો:", bn:"আপনি যদি সম্মত হন তবে এখানে প্রাথমিক অক্ষর লিখুন:", ta:"நீங்கள் ஒப்புக்கொண்டால் இங்கே முதலெழுத்து இடுக:", te:"మీరు అంగీకరిస్తే ఇక్కడ ఆద్యక్షరాలు రాయండి:" },
  // Beta translation notice (top of vernacular versions)
  "translation_notice": { en:"", hi:"यह दस्तावेज़ का अनुवाद किया गया है। मूल अंग्रेज़ी संस्करण कानूनी रूप से बाध्यकारी है। यदि कुछ अस्पष्ट हो तो कृपया अपने डॉक्टर से चर्चा करें।", mr:"हे दस्तऐवज भाषांतरित केले आहे. मूळ इंग्रजी आवृत्ती कायदेशीरदृष्ट्या बंधनकारक आहे. काही अस्पष्ट असल्यास कृपया तुमच्या डॉक्टरांशी चर्चा करा.", gu:"આ દસ્તાવેજનો અનુવાદ કરવામાં આવ્યો છે. મૂળ અંગ્રેજી સંસ્કરણ કાનૂની રીતે બંધનકર્તા છે. જો કંઈ અસ્પષ્ટ હોય તો કૃપા કરીને તમારા ડોક્ટર સાથે ચર્ચા કરો.", bn:"এই নথিটি অনূদিত হয়েছে। মূল ইংরেজি সংস্করণ আইনি বাধ্যতামূলক। যদি কিছু অস্পষ্ট হয় তবে দয়া করে আপনার ডাক্তারের সাথে আলোচনা করুন।", ta:"இந்த ஆவணம் மொழிபெயர்க்கப்பட்டுள்ளது. மூல ஆங்கில பதிப்பு சட்டப்பூர்வமாக கட்டுப்படுத்தும். ஏதேனும் தெளிவில்லாமல் இருந்தால் உங்கள் மருத்துவருடன் கலந்துரையாடவும்.", te:"ఈ పత్రం అనువదించబడింది. అసలు ఆంగ్ల వెర్షన్ చట్టబద్ధంగా కట్టుబడి ఉంటుంది. ఏదైనా అస్పష్టంగా ఉంటే దయచేసి మీ వైద్యుడితో చర్చించండి." },
};

// Tiny translate helper: tr(key, langCode) returns translated string with English fallback
const tr = (key, lang) => {
  const entry = CONSENT_I18N[key];
  if (!entry) return "";
  return entry[lang] || entry.en || "";
};


// ═══ ACCOUNT TYPES ═══
const ACCOUNT_TYPES=[
  {id:"doctor",   label:"Doctor",          icon:"🩺", desc:"Practicing physician — dermatologists, aesthetic doctors, cosmetologists"},
  {id:"brand",    label:"Brand / Pharma",  icon:"💊", desc:"Pharmaceutical, injectable, or skincare brand — Allergan, Galderma, Sun Pharma, etc."},
  {id:"vendor",   label:"Vendor / Distributor", icon:"🏭", desc:"Equipment, machines, consumables, or product distributors for aesthetic clinics"},
  {id:"institute",label:"Institute",        icon:"🏛️", desc:"Medical college, aesthetic academy, training center, or hospital"},
];
// Backward compat: old accounts with accountType="pharma" treated as "brand" in UI
const normalizeAccountType=(t)=>t==="pharma"?"brand":t;

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
const VENDOR_CATEGORIES=["Laser & Energy Devices","RF / HIFU Devices","Microneedling & DermaPen","Cryotherapy Equipment","Consumables & Disposables","Skincare & Post-procedure Products","Clinic Management Software","Medical Furniture & Equipment","Distribution / Import-Export","Training Equipment","Other"];
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
// Canonical site URL — used for share links so they always point at skinario.app
// regardless of which mirror domain the user is currently browsing on.
const SITE_URL="https://skinario.app";

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
const ShareBar=({title,url,description,itemId,itemType,currentUser,prof,onSaveToggle,onShare})=>{
  const[copied,setCopied]=useState(false);
  const shareText=`🔬 ${title} — read this on SKINARIO, the Professional Aesthetic & Cosmetology Community.`;
  const fullUrl=url||SITE_URL;
  const enc=encodeURIComponent;
  const waUrl=`https://wa.me/?text=${enc(shareText+" 👉 "+fullUrl)}`;
  const twUrl=`https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(fullUrl)}`;
  const liUrl=`https://www.linkedin.com/sharing/share-offsite/?url=${enc(fullUrl)}`;
  // Fire share-points callback once per share (parent enforces uniqueness/caps)
  const fireShare=(via)=>{if(onShare)onShare(via,itemType,itemId)};
  const copyLink=async()=>{
    try{
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(()=>setCopied(false),2000);
      fireShare("copy");
    }catch{alert("Could not copy. URL: "+fullUrl)}
  };
  const saved=itemId&&itemType&&prof?.saved?.[itemType]?.includes(itemId);
  const btn={display:"inline-flex",alignItems:"center",gap:5,padding:"6px 11px",borderRadius:18,border:"1px solid "+T.border,background:"#fff",color:T.txt2,cursor:"pointer",fontSize:".75rem",fontFamily:"inherit",textDecoration:"none",fontWeight:500,lineHeight:1};
  return(<div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
    <span style={{fontSize:".72rem",color:T.mute,marginRight:2}}>Share:</span>
    <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{...btn,color:"#25D366",borderColor:"#25D36644"}} onClick={e=>{e.stopPropagation();fireShare("whatsapp")}} title="Share on WhatsApp"><WaIcon/> WhatsApp</a>
    <a href={twUrl} target="_blank" rel="noopener noreferrer" style={{...btn,color:"#000",borderColor:"#00000033"}} onClick={e=>{e.stopPropagation();fireShare("x")}} title="Share on X"><XIcon/> Post</a>
    <a href={liUrl} target="_blank" rel="noopener noreferrer" style={{...btn,color:"#0A66C2",borderColor:"#0A66C244"}} onClick={e=>{e.stopPropagation();fireShare("linkedin")}} title="Share on LinkedIn"><LiIcon/> LinkedIn</a>
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

const CommentThread=({collection,itemId,item,currentUser,uName,uIni,uPhoto,allUsers,onUpdate,onAfterPost,sendEmail})=>{
  const[txt,setTxt]=useState("");
  const comments=item.comments||[];
  const submit=async()=>{
    if(!txt.trim()||!currentUser)return;
    const trimmedTxt=txt;
    const c={n:uName,ini:uIni,txt,tm:getIST().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true}),uid:currentUser.uid,likedBy:[],likes:0};
    const updated=[...comments,c];
    const ok=await fbSet(collection,itemId,{comments:updated});
    if(!ok){
      // Write failed (permissions, network, etc.). Don't update UI or send notifications.
      alert("Couldn't post your comment. Please try again — if it keeps failing, the page may need a refresh.");
      return;
    }
    onUpdate(itemId,updated);
    // Notify the author of the original post (if not self)
    if(item.uid&&item.uid!==currentUser.uid){
      const linkTypeMap={articles:"article",cases:"case",videos:"video",forum:"forum",events:"event"};
      createNotif({toUid:item.uid,fromUid:currentUser.uid,fromName:uName,fromIni:uIni,fromPhoto:uPhoto,type:"comment",text:`commented on your ${linkTypeMap[collection]||"post"}`,linkType:linkTypeMap[collection],linkId:itemId,linkLabel:item.title||"your post"});
      // Email reply notification — fire and forget, respects recipient prefs
      if(sendEmail&&allUsers){
        const author=allUsers.find(u=>u.id===item.uid);
        if(author?.email){
          sendEmail("reply",author.email,{
            name:author.name,
            replierName:uName,
            contentType:linkTypeMap[collection]||"post",
            contentTitle:item.title||"your post",
            snippet:txt,
          },author.emailPreferences);
        }
      }
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
    if(onAfterPost)onAfterPost(trimmedTxt,collection,itemId);
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

// ═══ MARKDOWN UTILITIES ═══
// Renders simple markdown: **bold**, *italic*, ## headers, - lists, 1. numbered lists.
// CRITICAL: escapes HTML first to prevent XSS — never trust user input.
const escapeHtml=(s)=>String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

function renderMarkdownToHtml(src){
  if(!src)return "";
  // 1. Escape HTML first
  let html=escapeHtml(src);
  // 2. Process line-by-line for block-level (headers, lists, blockquotes)
  const lines=html.split(/\r?\n/);
  const out=[];
  let inUl=false, inOl=false, inBq=false;
  const closeLists=()=>{
    if(inUl){out.push("</ul>");inUl=false}
    if(inOl){out.push("</ol>");inOl=false}
  };
  const closeBq=()=>{if(inBq){out.push("</blockquote>");inBq=false}};
  for(let raw of lines){
    const line=raw;
    // Header (## )
    if(/^##\s+/.test(line)){
      closeLists();closeBq();
      out.push("<h3 style=\"font-size:1.05rem;font-weight:700;margin:14px 0 6px;line-height:1.3\">"+line.replace(/^##\s+/,"")+"</h3>");
      continue;
    }
    // Blockquote (> )
    if(/^&gt;\s+/.test(line)){
      closeLists();
      if(!inBq){out.push("<blockquote style=\"margin:8px 0;padding:8px 14px;border-left:3px solid #c8a84e;background:#fdf6e3;color:#785f1e;font-style:italic;border-radius:0 6px 6px 0\">");inBq=true}
      out.push(line.replace(/^&gt;\s+/,"")+"<br/>");
      continue;
    }
    // Bullet (- )
    if(/^-\s+/.test(line)){
      closeBq();
      if(inOl){out.push("</ol>");inOl=false}
      if(!inUl){out.push("<ul style=\"margin:6px 0;padding-left:22px\">");inUl=true}
      out.push("<li style=\"margin:2px 0\">"+line.replace(/^-\s+/,"")+"</li>");
      continue;
    }
    // Numbered (1. )
    if(/^\d+\.\s+/.test(line)){
      closeBq();
      if(inUl){out.push("</ul>");inUl=false}
      if(!inOl){out.push("<ol style=\"margin:6px 0;padding-left:22px\">");inOl=true}
      out.push("<li style=\"margin:2px 0\">"+line.replace(/^\d+\.\s+/,"")+"</li>");
      continue;
    }
    // Blank line — close everything, paragraph spacing
    if(line.trim()===""){closeLists();closeBq();out.push("<br/>");continue}
    // Regular line
    closeLists();closeBq();
    out.push(line+"<br/>");
  }
  closeLists();closeBq();
  let joined=out.join("");
  // 3. Inline formatting (order matters — most specific first)
  joined=joined.replace(/\*\*([^*\n]+?)\*\*/g,"<b>$1</b>");
  joined=joined.replace(/(^|[\s>(])\*([^*\n]+?)\*(?=[\s.,;:!?)<]|$)/g,"$1<i>$2</i>");
  // Highlight ==text== → yellow mark
  joined=joined.replace(/==([^=\n]+?)==/g,"<mark style=\"background:#fff176;padding:1px 3px;border-radius:3px\">$1</mark>");
  // Underline __text__
  joined=joined.replace(/__([^_\n]+?)__/g,"<u>$1</u>");
  // Strikethrough ~~text~~
  joined=joined.replace(/~~([^~\n]+?)~~/g,"<s>$1</s>");
  // Inline code `text`
  joined=joined.replace(/`([^`\n]+?)`/g,"<code style=\"background:#f0f0f0;padding:1px 5px;border-radius:4px;font-family:monospace;font-size:.9em\">$1</code>");
  return joined;
}

// ═══ MARKDOWN VIEW — renders a markdown string as HTML safely ═══
const MarkdownView=({text,style={}})=>{
  if(!text)return null;
  return <div style={{lineHeight:1.6,wordBreak:"break-word",...style}} dangerouslySetInnerHTML={{__html:renderMarkdownToHtml(text)}}/>;
};

// ═══ MARKDOWN EDITOR — textarea + toolbar + preview ═══
const MarkdownEditor=({value,onChange,placeholder,rows=4,style={}})=>{
  const taRef=useRef(null);
  const[preview,setPreview]=useState(false);
  // Wrap selected text or insert at cursor
  const wrap=(before,after="")=>{
    const ta=taRef.current;if(!ta)return;
    const s=ta.selectionStart,e=ta.selectionEnd;
    const sel=value.substring(s,e);
    const next=value.substring(0,s)+before+sel+after+value.substring(e);
    onChange(next);
    // Restore selection after React re-renders
    setTimeout(()=>{ta.focus();const pos=s+before.length+sel.length;ta.setSelectionRange(pos,pos)},0);
  };
  // Insert at start of current line
  const prefix=(p)=>{
    const ta=taRef.current;if(!ta)return;
    const s=ta.selectionStart;
    // Find start of current line
    const before=value.substring(0,s);
    const lineStart=before.lastIndexOf("\n")+1;
    const next=value.substring(0,lineStart)+p+value.substring(lineStart);
    onChange(next);
    setTimeout(()=>{ta.focus();const pos=s+p.length;ta.setSelectionRange(pos,pos)},0);
  };
  // Keyboard shortcuts
  const onKey=(e)=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="b"){e.preventDefault();wrap("**","**")}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="i"){e.preventDefault();wrap("*","*")}
  };
  const btnStyle={padding:"4px 9px",fontSize:".75rem",fontWeight:600,background:"#fff",border:"1px solid "+T.border,borderRadius:5,cursor:"pointer",fontFamily:"inherit",color:T.txt,lineHeight:1};
  return(<div style={{...style}}>
    {/* Toolbar */}
    <div style={{display:"flex",gap:4,marginBottom:6,flexWrap:"wrap",alignItems:"center"}}>
      <button type="button" onClick={()=>wrap("**","**")} title="Bold (Ctrl+B)" style={{...btnStyle,fontWeight:900}}>B</button>
      <button type="button" onClick={()=>wrap("*","*")} title="Italic (Ctrl+I)" style={{...btnStyle,fontStyle:"italic"}}>I</button>
      <button type="button" onClick={()=>wrap("__","__")} title="Underline" style={{...btnStyle,textDecoration:"underline"}}>U</button>
      <button type="button" onClick={()=>wrap("~~","~~")} title="Strikethrough" style={{...btnStyle,textDecoration:"line-through"}}>S</button>
      <button type="button" onClick={()=>wrap("==","==")} title="Highlight" style={{...btnStyle,background:"#fff176",border:"1px solid #f9a825"}}>H</button>
      <button type="button" onClick={()=>wrap("`","`")} title="Inline code" style={{...btnStyle,fontFamily:"monospace",background:"#f0f0f0"}}>`code`</button>
      <div style={{width:1,height:18,background:T.border,margin:"0 2px"}}/>
      <button type="button" onClick={()=>prefix("## ")} title="Heading" style={btnStyle}>H2</button>
      <button type="button" onClick={()=>prefix("- ")} title="Bullet list" style={btnStyle}>• List</button>
      <button type="button" onClick={()=>prefix("1. ")} title="Numbered list" style={btnStyle}>1. List</button>
      <button type="button" onClick={()=>prefix("> ")} title="Blockquote / callout" style={{...btnStyle,borderLeft:"3px solid #c8a84e",color:"#785f1e"}}>❝ Quote</button>
      <div style={{flex:1}}/>
      <button type="button" onClick={()=>setPreview(!preview)} title="Toggle preview" style={{...btnStyle,background:preview?T.tealBg:"#fff",color:preview?T.teal:T.txt,fontWeight:preview?700:600}}>{preview?"✏️ Edit":"👁 Preview"}</button>
    </div>
    {/* Editor or preview */}
    {preview?
      <div style={{minHeight:rows*22,padding:"10px 12px",background:"#fff",border:"1px solid "+T.border,borderRadius:8,fontSize:".9rem"}}>
        {value?<MarkdownView text={value}/>:<span style={{color:T.mute,fontStyle:"italic"}}>(nothing to preview)</span>}
      </div>
      :
      <textarea ref={taRef} value={value} onChange={e=>onChange(e.target.value)} onKeyDown={onKey} placeholder={placeholder} rows={rows} style={{width:"100%",padding:"10px 12px",border:"1px solid "+T.border,borderRadius:8,fontSize:".9rem",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
    }
    {/* Hint */}
    <div style={{fontSize:".68rem",color:T.mute,marginTop:4,lineHeight:1.4}}>
      Tip: use <b>**bold**</b>, <i>*italic*</i>, <code style={{background:T.bg,padding:"0 4px",borderRadius:3}}>## Header</code>, <code style={{background:T.bg,padding:"0 4px",borderRadius:3}}>- bullet</code>, <code style={{background:T.bg,padding:"0 4px",borderRadius:3}}>1. number</code>
    </div>
  </div>);
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

// ═══ BLOCK FORMATTING TOOLBAR ═══
// Mini toolbar used inside each text block of the BlockEditor.
// onWrap(before, after) — wraps selected text with markdown syntax
// onPrefix(prefix) — inserts prefix at start of current line
const BlockFmtBar=({onWrap,onPrefix})=>{
  const b={padding:"3px 7px",fontSize:".7rem",fontWeight:600,background:"#fff",border:"1px solid "+T.border,borderRadius:4,cursor:"pointer",fontFamily:"inherit",color:T.txt,lineHeight:1,marginBottom:0};
  return(
    <div style={{display:"flex",gap:3,flexWrap:"wrap",alignItems:"center",padding:"4px 0",borderBottom:"1px dashed "+T.border,marginBottom:4}}>
      <button type="button" onClick={()=>onWrap("**","**")} title="Bold (Ctrl+B)" style={{...b,fontWeight:900}}>B</button>
      <button type="button" onClick={()=>onWrap("*","*")} title="Italic (Ctrl+I)" style={{...b,fontStyle:"italic"}}>I</button>
      <button type="button" onClick={()=>onWrap("__","__")} title="Underline" style={{...b,textDecoration:"underline"}}>U</button>
      <button type="button" onClick={()=>onWrap("~~","~~")} title="Strikethrough" style={{...b,textDecoration:"line-through"}}>S</button>
      <button type="button" onClick={()=>onWrap("==","==")} title="Highlight in yellow" style={{...b,background:"#fff176",border:"1px solid #f9a825",padding:"3px 8px"}}>H</button>
      <button type="button" onClick={()=>onWrap("`","`")} title="Inline code" style={{...b,fontFamily:"monospace",background:"#f0f0f0",fontSize:".68rem"}}>code</button>
      <div style={{width:1,height:14,background:T.border,margin:"0 1px"}}/>
      <button type="button" onClick={()=>onPrefix("- ")} title="Bullet list" style={b}>• List</button>
      <button type="button" onClick={()=>onPrefix("1. ")} title="Numbered list" style={b}>1.</button>
      <button type="button" onClick={()=>onPrefix("> ")} title="Blockquote / callout" style={{...b,borderLeft:"2px solid #c8a84e",color:"#785f1e"}}>❝</button>
    </div>
  );
};

// ═══ BLOCK EDITOR ═══
// A content editor where each "block" is either text, a heading, or an image.
// Used in article creation/editing. Stores as an array of block objects.
// Block schema: {type:"text"|"heading"|"image", content?:string, url?:string, caption?:string}

const BlockEditor = ({ blocks, onChange, uploadPath = "article-blocks" }) => {
  const [uploading, setUploading] = useState({});  // {blockIdx: true/false}

  const updateBlock = (idx, patch) => {
    const next = blocks.map((b, i) => i === idx ? { ...b, ...patch } : b);
    onChange(next);
  };
  const addBlock = (afterIdx, type) => {
    const newBlock = type === "image"
      ? { type: "image", url: "", caption: "" }
      : type === "heading"
      ? { type: "heading", content: "" }
      : { type: "text", content: "" };
    const next = [...blocks];
    next.splice(afterIdx + 1, 0, newBlock);
    onChange(next);
  };
  const removeBlock = (idx) => {
    onChange(blocks.filter((_, i) => i !== idx));
  };
  const moveBlock = (idx, dir) => {
    const next = [...blocks];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    onChange(next);
  };
  const uploadImage = async (idx, file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5 MB"); return; }
    setUploading(u => ({ ...u, [idx]: true }));
    try {
      const path = `${uploadPath}/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      const sRef = ref(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      updateBlock(idx, { url });
    } catch (e) {
      console.error("block image upload failed:", e);
      alert("Upload failed — check your connection and try again.");
    } finally {
      setUploading(u => ({ ...u, [idx]: false }));
    }
  };

  const btnBase = {
    padding: "3px 9px", fontSize: ".7rem", fontFamily: "inherit",
    border: "1px solid " + T.border, borderRadius: 5, cursor: "pointer",
    background: "#fff", color: T.txt, fontWeight: 600,
  };
  const AddBlockBar = ({ afterIdx }) => (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "6px 0", opacity: 0.7 }}
      onMouseEnter={e => e.currentTarget.style.opacity = "1"}
      onMouseLeave={e => e.currentTarget.style.opacity = "0.7"}>
      <button type="button" onClick={() => addBlock(afterIdx, "text")} style={{ ...btnBase, color: T.teal, borderColor: T.teal }}>+ Paragraph</button>
      <button type="button" onClick={() => addBlock(afterIdx, "heading")} style={{ ...btnBase, color: T.gold, borderColor: T.gold }}>+ Heading</button>
      <button type="button" onClick={() => addBlock(afterIdx, "image")} style={{ ...btnBase, color: "#7a3e9a", borderColor: "#7a3e9a" }}>📷 Image</button>
    </div>
  );

  return (
    <div style={{ border: "1px solid " + T.border, borderRadius: 10, overflow: "hidden" }}>
      {/* Toolbar hint */}
      <div style={{ padding: "8px 14px", background: T.bg, borderBottom: "1px solid " + T.border, fontSize: ".7rem", color: T.mute }}>
        📝 Block editor — add paragraphs, headings, and images in any order. Use ↑↓ to reorder.
      </div>

      {blocks.length === 0 && (
        <div style={{ padding: "24px", textAlign: "center", color: T.mute, fontSize: ".84rem" }}>
          No content yet. Add your first block below.
        </div>
      )}

      {/* Add bar before first block */}
      <AddBlockBar afterIdx={-1} />

      {blocks.map((block, idx) => (
        <div key={idx}>
          {/* Block wrapper */}
          <div style={{ position: "relative", padding: "10px 14px 10px 42px", borderTop: "1px solid " + T.border, background: "#fff" }}>
            {/* Left: block type indicator */}
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 36, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: block.type === "image" ? "#f4eeff" : block.type === "heading" ? "#fffbea" : "#f0fbfa", borderRight: "1px solid " + T.border }}>
              <span style={{ fontSize: ".85rem" }}>{block.type === "image" ? "🖼" : block.type === "heading" ? "H" : "¶"}</span>
            </div>

            {/* Right: controls */}
            <div style={{ position: "absolute", top: 8, right: 10, display: "flex", gap: 3 }}>
              <button type="button" onClick={() => moveBlock(idx, -1)} disabled={idx === 0} style={{ ...btnBase, padding: "2px 6px", opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
              <button type="button" onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1} style={{ ...btnBase, padding: "2px 6px", opacity: idx === blocks.length - 1 ? 0.3 : 1 }}>↓</button>
              <button type="button" onClick={() => removeBlock(idx)} style={{ ...btnBase, padding: "2px 6px", color: T.err, borderColor: T.err }}>✕</button>
            </div>

            {/* Content area */}
            {block.type === "text" && (
              <div style={{paddingRight:70}}>
                {/* Mini formatting toolbar */}
                <BlockFmtBar
                  onWrap={(b,a)=>{
                    const ta=document.getElementById(`block-ta-${idx}`);
                    if(!ta)return;
                    const s=ta.selectionStart,e=ta.selectionEnd;
                    const sel=(block.content||"").substring(s,e);
                    const next=(block.content||"").substring(0,s)+b+sel+a+(block.content||"").substring(e);
                    updateBlock(idx,{content:next});
                    setTimeout(()=>{ta.focus();const p=s+b.length+sel.length;ta.setSelectionRange(p,p)},0);
                  }}
                  onPrefix={(p)=>{
                    const ta=document.getElementById(`block-ta-${idx}`);
                    if(!ta)return;
                    const s=ta.selectionStart;
                    const before=(block.content||"").substring(0,s);
                    const lineStart=before.lastIndexOf("\n")+1;
                    const next=(block.content||"").substring(0,lineStart)+p+(block.content||"").substring(lineStart);
                    updateBlock(idx,{content:next});
                    setTimeout(()=>{ta.focus();const pos=s+p.length;ta.setSelectionRange(pos,pos)},0);
                  }}
                />
                <textarea
                  id={`block-ta-${idx}`}
                  value={block.content || ""}
                  onChange={e => updateBlock(idx, { content: e.target.value })}
                  onKeyDown={e=>{
                    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="b"){e.preventDefault();
                      const ta=e.target;const s=ta.selectionStart,en=ta.selectionEnd;const sel=(block.content||"").substring(s,en);
                      const next=(block.content||"").substring(0,s)+"**"+sel+"**"+(block.content||"").substring(en);
                      updateBlock(idx,{content:next});setTimeout(()=>{ta.focus();const p=s+2+sel.length;ta.setSelectionRange(p,p)},0);
                    }
                    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="i"){e.preventDefault();
                      const ta=e.target;const s=ta.selectionStart,en=ta.selectionEnd;const sel=(block.content||"").substring(s,en);
                      const next=(block.content||"").substring(0,s)+"*"+sel+"*"+(block.content||"").substring(en);
                      updateBlock(idx,{content:next});setTimeout(()=>{ta.focus();const p=s+1+sel.length;ta.setSelectionRange(p,p)},0);
                    }
                  }}
                  placeholder="Write paragraph text here..."
                  rows={4}
                  style={{ width: "100%", border: "none", outline: "none", resize: "vertical", fontFamily: "Georgia, serif", fontSize: "1rem", lineHeight: 1.65, color: T.txt, background: "transparent", boxSizing: "border-box", marginTop:4 }}
                />
              </div>
            )}
            {block.type === "heading" && (
              <input
                value={block.content || ""}
                onChange={e => updateBlock(idx, { content: e.target.value })}
                placeholder="Section heading..."
                style={{ width: "100%", border: "none", outline: "none", fontFamily: "Georgia, serif", fontSize: "1.2rem", fontWeight: 700, color: T.txt, background: "transparent", paddingRight: 70, boxSizing: "border-box" }}
              />
            )}
            {block.type === "image" && (
              <div style={{ paddingRight: 70 }}>
                {block.url ? (
                  <div style={{ marginBottom: 8 }}>
                    <img src={block.url} alt={block.caption || ""} style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 6, display: "block", objectFit: "contain" }} />
                    <button type="button" onClick={() => updateBlock(idx, { url: "" })} style={{ ...btnBase, marginTop: 6, fontSize: ".68rem", color: T.err }}>Remove image</button>
                  </div>
                ) : (
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: "inline-block", padding: "8px 16px", background: "#f4eeff", border: "1px dashed #7a3e9a", borderRadius: 6, cursor: "pointer", fontSize: ".82rem", color: "#7a3e9a", fontWeight: 600 }}>
                      {uploading[idx] ? "⏳ Uploading..." : "📷 Click to upload image"}
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(idx, f); }} disabled={uploading[idx]} />
                    </label>
                  </div>
                )}
                <input
                  value={block.caption || ""}
                  onChange={e => updateBlock(idx, { caption: e.target.value })}
                  placeholder="Caption (optional — e.g. Fig 1: Post-inflammatory hyperpigmentation of the axilla)"
                  style={{ width: "100%", border: "none", borderBottom: "1px solid " + T.border, outline: "none", fontSize: ".82rem", color: T.txt2, fontStyle: "italic", background: "transparent", padding: "4px 0", boxSizing: "border-box" }}
                />
              </div>
            )}
          </div>

          {/* Add bar after each block */}
          <AddBlockBar afterIdx={idx} />
        </div>
      ))}
    </div>
  );
};

// ═══ BLOCK RENDERER ═══
// Renders an article's blocks array in the detail view.
// Each block type renders with appropriate styling for the editorial layout.
const BlockRenderer = ({ blocks, style = {} }) => {
  if (!blocks || blocks.length === 0) return null;
  return (
    <div style={{ lineHeight: 1.65, wordBreak: "break-word", ...style }}>
      {blocks.map((block, idx) => {
        if (block.type === "heading") {
          return (
            <h2 key={idx} style={{ fontSize: "1.25rem", fontWeight: 700, color: T.txt, marginTop: idx === 0 ? 0 : 28, marginBottom: 12, fontFamily: "Georgia, 'Times New Roman', serif" }}>
              {block.content}
            </h2>
          );
        }
        if (block.type === "image") {
          return (
            <figure key={idx} style={{ margin: "24px 0", textAlign: "center" }}>
              <img src={block.url} alt={block.caption || ""} style={{ maxWidth: "100%", borderRadius: 8, boxShadow: "0 2px 12px rgba(0,0,0,0.10)", display: "inline-block" }} />
              {block.caption && (
                <figcaption style={{ fontSize: ".82rem", color: T.txt2, fontStyle: "italic", marginTop: 8, lineHeight: 1.5 }}>
                  {block.caption}
                </figcaption>
              )}
            </figure>
          );
        }
        // Default: text block — render with MarkdownView for bold/italic/lists
        return <MarkdownView key={idx} text={block.content || ""} style={{ fontSize: "1.05rem", color: T.txt, fontFamily: "Georgia, 'Times New Roman', serif", marginBottom: 16 }} />;
      })}
    </div>
  );
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
      :tp==="markdown"?<MarkdownEditor value={d[k]||""} onChange={v=>set(k,v)} placeholder="" rows={6}/>
      :tp==="blocks"?<BlockEditor blocks={Array.isArray(d[k])?d[k]:[]} onChange={v=>set(k,v)}/>
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
async function fbSet(c,id,data){try{await setDoc(doc(db,c,id),{...data,updatedAt:serverTimestamp()},{merge:true});return true}catch(e){console.error(`[fbSet] failed: ${c}/${id}`,e,"data keys:",Object.keys(data));return false}}
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

// ═══ VIEW TRACKER ═══
// Wraps a content card and fires onView() once when the card has been
// 50%+ visible for 800ms — that's a real "read", not a scroll-past.
// Per-session deduplication via sessionStorage so refreshes don't inflate counts.
// ═══ ROLE APPLICATION CARD (user-facing on Me page) ═══
function RoleApplicationCard({ T, prof, myPending, myLatest, ROLES, ROLE_DISPLAY, submitRoleApplication, getTier, TIERS }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState("");
  const [reason, setReason] = useState("");
  const [experience, setExperience] = useState("");

  // Already applied & pending — show status, no form
  if (myPending) {
    const rd = ROLE_DISPLAY[myPending.requestedRole] || { label: myPending.requestedRole, icon: "📋" };
    return (
      <div style={{...T.card, padding: 18, marginBottom: 14, borderLeft: "3px solid " + T.gold}}>
        <h4 style={{fontSize: ".95rem", fontWeight: 700, margin: 0, marginBottom: 8}}>📨 Application under review</h4>
        <p style={{fontSize: ".82rem", color: T.txt2, lineHeight: 1.55, marginBottom: 0}}>
          Your application for <b>{rd.icon} {rd.label}</b> is pending admin review. We'll notify you soon.
        </p>
      </div>
    );
  }

  // Recently rejected — show note, but allow reapplying
  const recentlyRejected = myLatest && myLatest.status === "rejected" && (Date.now() - (myLatest.reviewedAt||0)) < 30*86400000;

  if (!open) {
    return (
      <div style={{...T.card, padding: 18, marginBottom: 14, borderLeft: "3px solid " + T.teal, background: "linear-gradient(135deg, #fff, " + T.tealBg + "33)"}}>
        <h4 style={{fontSize: ".95rem", fontWeight: 700, margin: 0, marginBottom: 6, display: "flex", alignItems: "center", gap: 8}}>🛡️ Help shape SKINARIO</h4>
        <p style={{fontSize: ".82rem", color: T.txt2, lineHeight: 1.55, marginBottom: 12}}>
          Apply to be a <b>Content Contributor</b> (publish articles, share videos) or <b>Forum Moderator</b> (help keep discussions healthy). Roles are unpaid recognition for top contributors.
        </p>
        {recentlyRejected && (
          <div style={{padding: "8px 12px", background: T.bg, borderRadius: 6, fontSize: ".74rem", color: T.txt2, marginBottom: 10}}>
            Your previous application was declined. You can reapply with more details.
          </div>
        )}
        <button onClick={() => setOpen(true)} style={{...T.btnO, padding: "8px 16px", fontSize: ".82rem"}}>Apply for a role →</button>
      </div>
    );
  }

  const isForumMod = picked === ROLES.FORUM_MODERATOR;
  const isDoctor = prof?.accountType === "doctor";
  const blockedForumMod = isForumMod && !isDoctor;

  return (
    <div style={{...T.card, padding: 18, marginBottom: 14, borderLeft: "3px solid " + T.teal}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14}}>
        <h4 style={{fontSize: ".95rem", fontWeight: 700, margin: 0}}>🛡️ Apply for a role</h4>
        <button onClick={() => {setOpen(false); setPicked(""); setReason(""); setExperience("")}} style={{background: "none", border: "none", fontSize: "1rem", color: T.mute, cursor: "pointer"}}>✕</button>
      </div>

      <label style={{display: "block", fontSize: ".7rem", color: T.teal, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1}}>Which role? <span style={{color: T.err}}>*</span></label>
      <div style={{display: "flex", flexDirection: "column", gap: 6, marginBottom: 12}}>
        <label style={{padding: "10px 12px", border: `1px solid ${picked===ROLES.CONTENT_CONTRIBUTOR?T.teal:T.border}`, borderRadius: 8, cursor: "pointer", background: picked===ROLES.CONTENT_CONTRIBUTOR?T.tealBg:"#fff"}}>
          <div style={{display: "flex", alignItems: "center", gap: 8}}>
            <input type="radio" name="role" value={ROLES.CONTENT_CONTRIBUTOR} checked={picked===ROLES.CONTENT_CONTRIBUTOR} onChange={e=>setPicked(e.target.value)}/>
            <span style={{fontWeight: 600, fontSize: ".88rem"}}>✍️ Content Contributor</span>
          </div>
          <div style={{fontSize: ".74rem", color: T.txt2, marginTop: 4, paddingLeft: 22, lineHeight: 1.55}}>Submit articles, videos, news items. All submissions are admin-reviewed before publishing. Open to all account types.</div>
        </label>
        <label style={{padding: "10px 12px", border: `1px solid ${picked===ROLES.FORUM_MODERATOR?T.teal:T.border}`, borderRadius: 8, cursor: isDoctor ? "pointer" : "not-allowed", opacity: isDoctor ? 1 : 0.5, background: picked===ROLES.FORUM_MODERATOR?T.tealBg:"#fff"}}>
          <div style={{display: "flex", alignItems: "center", gap: 8}}>
            <input type="radio" name="role" value={ROLES.FORUM_MODERATOR} checked={picked===ROLES.FORUM_MODERATOR} onChange={e=>setPicked(e.target.value)} disabled={!isDoctor}/>
            <span style={{fontWeight: 600, fontSize: ".88rem"}}>🛡️ Forum Moderator</span>
            {!isDoctor && <span style={{fontSize: ".68rem", color: T.mute, marginLeft: 4}}>(doctors only)</span>}
          </div>
          <div style={{fontSize: ".74rem", color: T.txt2, marginTop: 4, paddingLeft: 22, lineHeight: 1.55}}>Flag or soft-delete inappropriate forum posts and cases. Doctors only — to prevent commercial conflicts.</div>
        </label>
      </div>

      {blockedForumMod && (
        <div style={{padding: "8px 10px", background: "#fce4ec", borderLeft: "3px solid #c2185b", borderRadius: "0 6px 6px 0", fontSize: ".74rem", color: "#880e4f", marginBottom: 12}}>
          Forum Moderator role is restricted to doctor accounts.
        </div>
      )}

      <label style={{display: "block", fontSize: ".7rem", color: T.teal, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1}}>Why are you applying? <span style={{color: T.err}}>*</span></label>
      <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="What motivates you to contribute? What value will you bring?" rows={3} style={{...T.txa, marginBottom: 12, fontSize: ".88rem"}}/>

      <label style={{display: "block", fontSize: ".7rem", color: T.teal, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1}}>Relevant experience (optional)</label>
      <textarea value={experience} onChange={e=>setExperience(e.target.value)} placeholder="Areas of expertise, publications, conferences, training, etc." rows={2} style={{...T.txa, marginBottom: 14, fontSize: ".88rem"}}/>

      <button disabled={!picked || blockedForumMod || !reason.trim()} onClick={async() => {
        const result = await submitRoleApplication(picked, reason, experience);
        if (result.ok) {
          setOpen(false); setPicked(""); setReason(""); setExperience("");
        }
      }} style={{...((!picked || blockedForumMod || !reason.trim()) ? T.btnO : T.btn), padding: "10px 20px", fontSize: ".85rem", opacity: (!picked || blockedForumMod || !reason.trim()) ? 0.5 : 1, cursor: (!picked || blockedForumMod || !reason.trim()) ? "not-allowed" : "pointer"}}>📨 Submit application</button>
    </div>
  );
}

// ═══ MANUAL ROLE ASSIGNMENT (admin-only widget) ═══
// ═══ UNIFIED SUBMISSION FORM (handles all 5 content types) ═══
function SubmissionForm({ typeKey, cfg, T, storage, ref, uploadBytes, getDownloadURL, submitContent, onSuccess, sh }) {
  const [formData, setFormData] = useState({});
  const [coverImage, setCoverImage] = useState("");
  const [imageDims, setImageDims] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const setField = (key, val) => setFormData(prev => ({...prev, [key]: val}));

  const handleImageUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      // Read dimensions for preview/guidance
      const dims = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({w: img.naturalWidth, h: img.naturalHeight});
        img.onerror = () => resolve(null);
        img.src = URL.createObjectURL(f);
      });
      setImageDims(dims);

      const path = `submissions/${typeKey}/${Date.now()}_${f.name}`;
      const sRef = ref(storage, path);
      await uploadBytes(sRef, f);
      const url = await getDownloadURL(sRef);
      setCoverImage(url);
      sh("Image uploaded");
    } catch (err) {
      console.error(err);
      sh("Upload failed");
    }
    if (e.target) e.target.value = "";
    setUploading(false);
  };

  const dimsMatch = imageDims && cfg.imageRecommendedW > 0 &&
    Math.abs(imageDims.w - cfg.imageRecommendedW) < 50 &&
    Math.abs(imageDims.h - cfg.imageRecommendedH) < 30;
  const dimsRatioMatch = imageDims && cfg.imageRecommendedW > 0 &&
    Math.abs((imageDims.w / imageDims.h) - (cfg.imageRecommendedW / cfg.imageRecommendedH)) < 0.1;

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const result = await submitContent(typeKey, formData, coverImage);
    if (result.ok) {
      setFormData({}); setCoverImage(""); setImageDims(null);
      if (onSuccess) onSuccess();
    } else if (result.error) {
      sh(result.error);
    }
    setSubmitting(false);
  };

  return (
    <div>
      <div style={{padding: "12px 14px", background: T.tealBg, borderLeft: "3px solid " + T.teal, borderRadius: "0 8px 8px 0", marginBottom: 16, fontSize: ".82rem", color: T.txt2, lineHeight: 1.55}}>
        <div style={{fontWeight: 600, color: T.teal, marginBottom: 4}}>{cfg.icon} Submitting: {cfg.label}</div>
        {cfg.description}
      </div>

      {cfg.fields.map(field => {
        const val = formData[field.key] || "";
        return (
          <div key={field.key} style={{marginBottom: 14}}>
            <label style={{display: "block", fontSize: ".7rem", color: T.teal, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1}}>
              {field.label} {field.required && <span style={{color: T.err}}>*</span>}
            </label>
            {field.type === "textarea" ? (
              <textarea value={val} onChange={e => setField(field.key, e.target.value)} placeholder={field.placeholder || ""} rows={field.rows || 3} style={{...T.txa, fontSize: ".88rem", lineHeight: 1.55}}/>
            ) : field.type === "blocks" ? (
              <BlockEditor blocks={Array.isArray(formData[field.key]) ? formData[field.key] : []} onChange={v => setField(field.key, v)}/>
            ) : field.type === "select" ? (
              <select value={val} onChange={e => setField(field.key, e.target.value)} style={T.inp}>
                <option value="">— select —</option>
                {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : field.type === "date" ? (
              <input type="date" value={val} onChange={e => setField(field.key, e.target.value)} style={T.inp}/>
            ) : (
              <input type="text" value={val} onChange={e => setField(field.key, e.target.value)} placeholder={field.placeholder || ""} style={T.inp}/>
            )}
          </div>
        );
      })}

      {/* Image upload — only if type expects one */}
      {cfg.imageRecommendedW > 0 && (
        <div style={{marginBottom: 16}}>
          <label style={{display: "block", fontSize: ".7rem", color: T.teal, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1}}>
            Cover image / Poster
          </label>
          <div style={{padding: "8px 12px", background: T.bg, borderRadius: 6, fontSize: ".78rem", color: T.txt2, marginBottom: 10, lineHeight: 1.55}}>
            <b>📐 {cfg.imageHint}</b><br/>
            <span style={{fontSize: ".72rem", color: T.mute}}>Tip: You can generate a poster of this exact size using ChatGPT, DALL-E, or Canva.</span>
          </div>

          {coverImage ? (
            <div style={{marginBottom: 8}}>
              <div style={{position: "relative", width: "100%", maxWidth: 360, borderRadius: 8, overflow: "hidden", border: "1px solid " + T.border}}>
                <img src={coverImage} style={{width: "100%", display: "block"}}/>
                <button onClick={() => {setCoverImage(""); setImageDims(null)}} style={{position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,.6)", color: "#fff", border: "none", fontSize: ".8rem", cursor: "pointer"}}>✕</button>
              </div>
              {imageDims && (
                <div style={{marginTop: 6, fontSize: ".75rem", color: dimsMatch ? T.ok : dimsRatioMatch ? T.gold : T.warn}}>
                  Uploaded: {imageDims.w}×{imageDims.h} px
                  {dimsMatch && " — perfect match ✓"}
                  {!dimsMatch && dimsRatioMatch && " — correct aspect ratio, larger size (ok)"}
                  {!dimsMatch && !dimsRatioMatch && ` — recommended is ${cfg.imageRecommendedW}×${cfg.imageRecommendedH}. It may not display optimally.`}
                </div>
              )}
            </div>
          ) : null}

          <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} style={{fontSize: ".8rem"}}/>
          {uploading && <span style={{marginLeft: 8, fontSize: ".75rem", color: T.mute}}>Uploading...</span>}
        </div>
      )}

      <div style={{display: "flex", gap: 10, marginTop: 18, paddingTop: 14, borderTop: "1px solid " + T.border}}>
        <button onClick={handleSubmit} disabled={submitting || uploading} style={{...T.btn, padding: "10px 22px", opacity: submitting ? 0.6 : 1}}>
          {submitting ? "Submitting..." : `📨 Submit ${cfg.label}`}
        </button>
      </div>

      <p style={{marginTop: 10, fontSize: ".72rem", color: T.mute, fontStyle: "italic", lineHeight: 1.5}}>
        💡 Your submission goes to admin for review. You'll get a notification once it's approved or if changes are needed.
      </p>
    </div>
  );
}

function ManualRoleAssign({ allUsers, assignRole, T, ROLES, ROLE_DISPLAY }) {
  const [search, setSearch] = useState("");
  const [pickedUser, setPickedUser] = useState(null);
  const [pickedRole, setPickedRole] = useState("");
  const [reason, setReason] = useState("");
  const matches = search.trim().length >= 2
    ? allUsers.filter(u => {
        const q = search.toLowerCase();
        return (u.name||"").toLowerCase().includes(q) || (u.email||"").toLowerCase().includes(q);
      }).slice(0, 8)
    : [];
  return (
    <div>
      {!pickedUser ? (
        <>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search user by name or email..." style={{...T.inp,marginBottom:8}}/>
          {matches.length > 0 && <div style={{border:"1px solid "+T.border,borderRadius:8,overflow:"hidden"}}>
            {matches.map(u => <div key={u.id} onClick={()=>{setPickedUser(u);setSearch("")}} style={{padding:"8px 12px",borderBottom:"1px solid "+T.border,cursor:"pointer",fontSize:".82rem",display:"flex",alignItems:"center",gap:10}}>
              {u.photo ? <img src={u.photo} style={{width:28,height:28,borderRadius:"50%",objectFit:"cover"}}/> : <div style={T.av(28,T.tealBg,T.teal)}>{u.initials||"?"}</div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600}}>{u.name}</div>
                <div style={{fontSize:".68rem",color:T.mute}}>{u.email} · {u.accountType||"?"}{u.role?` · current: ${ROLE_DISPLAY[u.role]?.label||u.role}`:""}</div>
              </div>
            </div>)}
          </div>}
        </>
      ) : (
        <div style={{padding:12,background:T.bg,borderRadius:8,marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}>
            <div>
              <div style={{fontWeight:600,fontSize:".88rem"}}>{pickedUser.name}</div>
              <div style={{fontSize:".7rem",color:T.mute}}>{pickedUser.email} · {pickedUser.accountType||"?"}{pickedUser.role?` · current: ${ROLE_DISPLAY[pickedUser.role]?.label||pickedUser.role}`:""}</div>
            </div>
            <button onClick={()=>{setPickedUser(null);setPickedRole("");setReason("")}} style={{...T.btnO,padding:"4px 10px",fontSize:".75rem"}}>Cancel</button>
          </div>
          <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Assign role</label>
          <select value={pickedRole} onChange={e=>setPickedRole(e.target.value)} style={{...T.inp,marginBottom:8}}>
            <option value="">— pick a role —</option>
            <option value={ROLES.CONTENT_CONTRIBUTOR}>✍️ Content Contributor</option>
            <option value={ROLES.FORUM_MODERATOR}>🛡️ Forum Moderator (doctors only)</option>
          </select>
          {pickedRole === ROLES.FORUM_MODERATOR && pickedUser.accountType !== "doctor" && (
            <div style={{padding:"8px 10px",background:"#fce4ec",borderLeft:"3px solid #c2185b",borderRadius:"0 6px 6px 0",fontSize:".74rem",color:"#880e4f",marginBottom:8}}>
              ⚠️ Forum Moderator is intended for doctors only. This user is a <b>{pickedUser.accountType}</b> — conflict of interest risk.
            </div>
          )}
          <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason for assignment (logged in audit trail)" style={{...T.inp,marginBottom:8}}/>
          <button disabled={!pickedRole} onClick={async()=>{
            if(!pickedRole)return;
            if(confirm(`Assign ${ROLE_DISPLAY[pickedRole]?.label||pickedRole} role to ${pickedUser.name}?`)){
              await assignRole(pickedUser.id, pickedUser.name, pickedRole, reason);
              setPickedUser(null); setPickedRole(""); setReason("");
            }
          }} style={{...(pickedRole?T.btn:T.btnO),padding:"8px 16px",fontSize:".82rem",opacity:pickedRole?1:.5,cursor:pickedRole?"pointer":"not-allowed"}}>Assign role</button>
        </div>
      )}
    </div>
  );
}

// ═══ FADE IN ON SCROLL — used by landing page ═══
function FadeIn({ children, delay = 0, style = {} }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => setVisible(true), delay);
            obs.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <div
      ref={ref}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.8s ease-out, transform 0.8s ease-out",
      }}
    >
      {children}
    </div>
  );
}

// ═══ COUNT UP ANIMATION — used for community size stat ═══
function CountUp({ to, duration = 2000, suffix = "", style = {} }) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!ref.current || started) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started) {
            setStarted(true);
            const start = Date.now();
            const tick = () => {
              const elapsed = Date.now() - start;
              const progress = Math.min(elapsed / duration, 1);
              // Ease out cubic
              const eased = 1 - Math.pow(1 - progress, 3);
              setValue(Math.floor(eased * to));
              if (progress < 1) requestAnimationFrame(tick);
            };
            tick();
            obs.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to, duration, started]);
  return <span ref={ref} style={style}>{value}{suffix}</span>;
}

function ViewTracker({ trackingKey, onView, children, style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !trackingKey) return;
    const sessionKey = `sk_vt_${trackingKey}`;
    if (sessionStorage.getItem(sessionKey)) return;
    let timer = null;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            timer = setTimeout(() => {
              if (sessionStorage.getItem(sessionKey)) return;
              sessionStorage.setItem(sessionKey, "1");
              onView && onView();
              obs.disconnect();
            }, 800);
          } else if (timer) {
            clearTimeout(timer);
            timer = null;
          }
        });
      },
      { threshold: [0, 0.5, 1] }
    );
    obs.observe(ref.current);
    return () => {
      obs.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [trackingKey, onView]);
  return <div ref={ref} style={style}>{children}</div>;
}

// ═══ INSTAGRAM POST GENERATOR ═══
// Renders a 1080x1080 Canvas with the content title + branding, lets admin
// download the image + copy the caption for manual Instagram posting.
// Single-template design across content types — type shown via badge color/label.
// ═══ INSTAGRAM POST GENERATOR ═══
// Magazine-cover layout: full-bleed background image with text overlay.
// Image sources:
//   - Articles: item.cover
//   - Cases: item.images[0]
//   - Videos: YouTube thumbnail (auto-extracted from embed URL)
//   - News: item.image / item.urlToImage
//   - Quizzes: call /api/quiz-image to AI-generate, then cache on the quiz doc
const IGPostGenerator = ({ item, type, onClose, onQuizImageCached }) => {
  const canvasRef = useRef(null);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [bgImageUrl, setBgImageUrl] = useState(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [imageError, setImageError] = useState("");

  const typeMeta = {
    article: { label: "ARTICLE", icon: "📰", color: "#4a1f3d", tags: ["#article", "#clinicalreading"] },
    quiz:    { label: "DAILY QUIZ", icon: "🧠", color: "#0d6b6e", tags: ["#dailyquiz", "#clinicaltest"] },
    case:    { label: "CLINICAL CASE", icon: "🔬", color: "#a08030", tags: ["#clinicalcase", "#peerlearning"] },
    video:   { label: "VIDEO", icon: "🎥", color: "#7a3e9a", tags: ["#videomasterclass", "#cme"] },
    news:    { label: "NEWS", icon: "📡", color: "#c0392b", tags: ["#aestheticnews", "#industry"] },
  };
  const meta = typeMeta[type] || typeMeta.article;

  // Extract YouTube video ID for thumbnail
  const youtubeThumb = (url) => {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? `https://img.youtube.com/vi/${m[1]}/maxresdefault.jpg` : null;
  };

  // Resolve image source based on content type
  useEffect(() => {
    setImageError("");
    setBgImageUrl(null);
    if (type === "article" && item.cover) {
      setBgImageUrl(item.cover);
    } else if (type === "case" && item.images?.[0]) {
      setBgImageUrl(item.images[0]);
    } else if (type === "video") {
      const yt = youtubeThumb(item.embedUrl);
      if (yt) setBgImageUrl(yt);
    } else if (type === "news" && (item.image || item.urlToImage)) {
      setBgImageUrl(item.image || item.urlToImage);
    } else if (type === "quiz") {
      // Quizzes have no inherent image. We could generate one with AI ($0.04/quiz)
      // but at the current scale that's premature optimization. Fall back to the
      // branded gradient design — the text-on-cream layout still looks editorial.
      // To enable AI generation later: uncomment the fetch block and ensure
      // /api/quiz-image is deployed.
      //
      // if (item.igImageUrl) {
      //   setBgImageUrl(item.igImageUrl);
      // } else {
      //   setLoadingImage(true);
      //   fetch("/api/quiz-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: item.cat, difficulty: item.diff }) })
      //     .then(r => r.json())
      //     .then(data => {
      //       if (data.ok && data.imageBase64) {
      //         const url = "data:image/png;base64," + data.imageBase64;
      //         setBgImageUrl(url);
      //         if (onQuizImageCached) onQuizImageCached(item.id, data.imageBase64);
      //       } else { setImageError(data.error || "Generation failed"); }
      //       setLoadingImage(false);
      //     })
      //     .catch(err => { setImageError(err.message || "Network error"); setLoadingImage(false); });
      // }
      setBgImageUrl(null); // use branded fallback
    }
  }, [item, type, onQuizImageCached]);

  // Caption (same as before — pre-fills editor)
  const captionLines = [
    `${meta.icon} ${meta.label} on SKINARIO`,
    "",
    item.title || item.question || "",
    "",
    item.author || item.submitterName ? `By ${item.author || item.submitterName}` : "",
    "",
    "Daily clinical learning for aesthetic & cosmetology doctors in India.",
    "",
    "Read more at skinario.app",
    "",
    "#aestheticmedicine #cosmetology #indiandoctors #medicaleducation " + meta.tags.join(" "),
  ].filter((l) => l !== null).join("\n");
  const [caption, setCaption] = useState(captionLines);

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const SIZE = 1080;
    canvas.width = SIZE;
    canvas.height = SIZE;

    const drawCanvas = (bgImg) => {
      // 1. Background — image (cropped center-cover) or branded gradient fallback
      if (bgImg) {
        // Cover-fit the image
        const imgAspect = bgImg.width / bgImg.height;
        let sw, sh, sx, sy;
        if (imgAspect > 1) {
          // Wider than tall — crop sides
          sh = bgImg.height;
          sw = bgImg.height;
          sx = (bgImg.width - sw) / 2;
          sy = 0;
        } else {
          // Taller than wide — crop top/bottom
          sw = bgImg.width;
          sh = bgImg.width;
          sx = 0;
          sy = (bgImg.height - sh) / 2;
        }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, SIZE, SIZE);
      } else {
        // Fallback: branded gradient
        const bgGrad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
        bgGrad.addColorStop(0, "#faf3e7");
        bgGrad.addColorStop(0.5, "#f5ede2");
        bgGrad.addColorStop(1, "#faecda");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, SIZE, SIZE);
      }

      // 2. Dark gradient overlay (bottom-heavy) for text readability
      const overlay = ctx.createLinearGradient(0, 0, 0, SIZE);
      overlay.addColorStop(0, "rgba(74, 31, 61, 0.15)");
      overlay.addColorStop(0.45, "rgba(74, 31, 61, 0.35)");
      overlay.addColorStop(1, "rgba(74, 31, 61, 0.92)");
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, SIZE, SIZE);

      // 3. Type badge — top-left
      const drawRoundRect = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      };
      ctx.fillStyle = meta.color;
      ctx.font = "700 28px 'Helvetica Neue', Arial, sans-serif";
      const badgeText = `${meta.icon}  ${meta.label}`;
      const badgeWidth = ctx.measureText(badgeText).width + 56;
      drawRoundRect(60, 60, badgeWidth, 56, 28);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(badgeText, 88, 60 + 28);

      // 4. Title — wrapped, white, large serif, anchored from bottom
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 64px Georgia, serif";
      ctx.textBaseline = "top";
      const titleText = item.title || item.question || "Untitled";
      const maxWidth = SIZE - 120;
      const lineHeight = 78;
      const words = titleText.split(" ");
      const lines = [];
      let current = "";
      for (const word of words) {
        const test = current ? current + " " + word : word;
        if (ctx.measureText(test).width > maxWidth) {
          if (current) lines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);
      const cappedLines = lines.slice(0, 6);
      // Place title so its last line sits ~250px from bottom (above the brand band)
      const titleTotalH = cappedLines.length * lineHeight;
      const titleStartY = SIZE - 260 - titleTotalH;
      cappedLines.forEach((line, i) => {
        // Add subtle shadow for readability against busy backgrounds
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 8;
        ctx.fillText(line, 60, titleStartY + i * lineHeight);
      });
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      // 5. Author/date line — gold, italic
      const authorBits = [];
      if (item.author || item.submitterName) authorBits.push("By " + (item.author || item.submitterName));
      if (item.date) {
        try {
          authorBits.push(new Date(item.date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }));
        } catch {}
      }
      if (authorBits.length) {
        ctx.fillStyle = "#c8a84e";
        ctx.font = "italic 26px Georgia, serif";
        ctx.fillText(authorBits.join(" · "), 60, SIZE - 240);
      }

      // 6. Bottom brand band
      const bandY = SIZE - 140;
      ctx.fillStyle = "#4a1f3d";
      ctx.fillRect(0, bandY, SIZE, 140);
      ctx.fillStyle = "#faf3e7";
      ctx.font = "300 52px Georgia, serif";
      ctx.textBaseline = "middle";
      ctx.fillText("S K I N A R I O", 60, bandY + 48);
      ctx.fillStyle = "#c8a84e";
      ctx.font = "700 16px 'Helvetica Neue', Arial, sans-serif";
      ctx.fillText("LEARN · DISCUSS · LEAD THE FIELD", 60, bandY + 98);
      ctx.fillStyle = "#c8a84e";
      ctx.font = "600 28px 'Helvetica Neue', Arial, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("skinario.app", SIZE - 60, bandY + 70);
      ctx.textAlign = "left";

      // Export
      try {
        setImageDataUrl(canvas.toDataURL("image/png"));
      } catch (err) {
        // CORS tainted — happens if image came from a non-CORS source
        console.error("Canvas export failed (CORS):", err);
        setImageError("Image source blocks download. Try a different image or use the AI generator.");
      }
    };

    if (bgImageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => drawCanvas(img);
      img.onerror = () => {
        console.warn("Background image failed to load, using fallback");
        drawCanvas(null);
      };
      img.src = bgImageUrl;
    } else {
      drawCanvas(null);
    }
  }, [item, type, bgImageUrl]);

  const handleDownload = () => {
    if (!imageDataUrl) return;
    const a = document.createElement("a");
    const filename = `skinario_${type}_${(item.title || item.question || "post").slice(0, 30).replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.png`;
    a.href = imageDataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = caption;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
      document.body.removeChild(ta);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 14, maxWidth: 920, width: "100%", maxHeight: "92vh", overflow: "auto", padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, borderBottom: "1px solid #e8e6e0", paddingBottom: 12 }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>📸 Instagram post</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#999" }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="ig-grid">
          <div>
            <div style={{ fontSize: ".7rem", color: "#999", marginBottom: 6, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
              Preview (1080 × 1080)
              {loadingImage && <span style={{ marginLeft: 8, color: "#0d6b6e" }}>⏳ Generating image...</span>}
            </div>
            <div style={{ background: "#f4f1ea", borderRadius: 10, overflow: "hidden", aspectRatio: "1 / 1", position: "relative" }}>
              <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
              {loadingImage && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.85)", fontSize: ".88rem", color: "#0d6b6e", fontWeight: 600 }}>
                  ⏳ Generating AI image...
                </div>
              )}
            </div>
            {imageError && (
              <div style={{ marginTop: 8, padding: "8px 12px", background: "#fde8e8", borderLeft: "3px solid #c0392b", borderRadius: "0 6px 6px 0", fontSize: ".74rem", color: "#c0392b", lineHeight: 1.5 }}>
                ⚠️ {imageError}
              </div>
            )}
            <button onClick={handleDownload} disabled={!imageDataUrl || loadingImage} style={{ width: "100%", marginTop: 10, padding: "12px 18px", background: loadingImage ? "#ccc" : "#0d6b6e", color: "#fff", border: "none", borderRadius: 999, fontSize: ".88rem", fontWeight: 600, cursor: loadingImage ? "wait" : "pointer" }}>⬇️ Download image</button>
          </div>

          <div>
            <div style={{ fontSize: ".7rem", color: "#999", marginBottom: 6, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>Caption (editable)</div>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={14} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e8e6e0", fontSize: ".82rem", fontFamily: "inherit", lineHeight: 1.5, resize: "vertical", boxSizing: "border-box" }} />
            <button onClick={handleCopyCaption} disabled={!caption} style={{ width: "100%", marginTop: 10, padding: "12px 18px", background: copied ? "#1a7d42" : "#4a1f3d", color: "#fff", border: "none", borderRadius: 999, fontSize: ".88rem", fontWeight: 600, cursor: "pointer", transition: "background .15s" }}>{copied ? "✓ Copied!" : "📋 Copy caption"}</button>

            <div style={{ marginTop: 14, padding: "10px 12px", background: "#fdf6e3", borderLeft: "3px solid #c8a84e", borderRadius: "0 8px 8px 0", fontSize: ".74rem", lineHeight: 1.6, color: "#555" }}>
              <b>How to post:</b><br/>
              1. Click <b>Download image</b><br/>
              2. Click <b>Copy caption</b><br/>
              3. Open Instagram → New post → upload the image<br/>
              4. Paste the caption → Publish
            </div>
          </div>
        </div>

        <style>{`@media(max-width:680px){.ig-grid{grid-template-columns:1fr !important}}`}</style>
      </div>
    </div>
  );
};

export default function App(){
  const[au,setAu]=useState(null);const[prof,setProf]=useState(null);const[scr,setScr]=useState("loading");const[pg,setPg]=useState("home");
  const[publicQuiz,setPublicQuiz]=useState(null);
  const[publicQuizLoading,setPublicQuizLoading]=useState(false);
  const[welcomeSeen,setWelcomeSeen]=useState(()=>localStorage.getItem("sk_welcome")==="1");
  const[quizzes,setQuizzes]=useState([]);const[articles,setArticles]=useState([]);const[resources,setResources]=useState([]);const[videos,setVideos]=useState([]);const[forumPosts,setForumPosts]=useState([]);const[cases,setCases]=useState([]);const[allUsers,setAllUsers]=useState([]);
  const[selD,setSelD]=useState(ds(getIST()));const[selA,setSelA]=useState(null);const[selV,setSelV]=useState(null);const[selU,setSelU]=useState(null);const[toast,setToast]=useState(null);const[cmt,setCmt]=useState("");const[ld,setLd]=useState(false);const[aTab,setATab]=useState("stats");
  const[profileReturnPg,setProfileReturnPg]=useState("home"); // where to go when "Back" clicked on profile page
  const[authMode,setAuthMode]=useState("signin");const[authEmail,setAuthEmail]=useState("");const[authPass,setAuthPass]=useState("");const[authName,setAuthName]=useState("");const[authBusy,setAuthBusy]=useState(false);const[authErr,setAuthErr]=useState("");
  const[pf,setPf]=useState({accountType:"",country:"India",internationalCouncil:"",city:"",region:"",name:"",mobile:"",degree:"",council:"",regNumber:"",clinic:"",address:"",visibility:"public",companyName:"",brandCategory:"",vendorCategory:"",gstNumber:"",contactPerson:"",website:"",instituteName:"",instituteType:"",directorName:""});const[edForm,setEdForm]=useState(null);const[setupStep,setSetupStep]=useState(0);const[setupErr,setSetupErr]=useState("");
  // Forum/Cases new post state
  const[newForum,setNewForum]=useState(false);const[fpT,setFpT]=useState("");const[fpC,setFpC]=useState(TOPICS[0]);
  const[fpBlocks,setFpBlocks]=useState([]); // block editor for forum post body (replaces fpB + fpImgs)
  const[newCase,setNewCase]=useState(false);const[ccT,setCcT]=useState("");const[ccB,setCcB]=useState("");const[ccC,setCcC]=useState(TOPICS[0]);const[ccImgs,setCcImgs]=useState([]);const[ccUp,setCcUp]=useState(false);const[ccDiag,setCcDiag]=useState("");const[ccHistory,setCcHistory]=useState("");const[ccTreatment,setCcTreatment]=useState("");const[ccOutcome,setCcOutcome]=useState("");

  // KNOWN_PAGES must match every page condition the app actually renders.
  // If you add a new page (`pg==="xyz"&&...` block), add "xyz" here too.
  const KNOWN_PAGES=["home","me","quiz","library","forum","cases","rewards","submit","rank","events","videos","admin","profile","ad","consent"];
  const sh=m=>setToast(m);const go=p=>{const safe=KNOWN_PAGES.includes(p)?p:"home";setPg(safe);setSelA(null);setSelV(null);setSelAd(null);setSelE(null);setSelU(null);setSelFP(null);setSelCs(null);setEdForm(null)};
  // ═══ VIEW PROFILE — open any user's profile page ═══
  const viewProfile=(uid)=>{
    if(!uid)return;
    const u=allUsers.find(x=>x.id===uid);
    if(!u)return;
    setSelU(u);
    setProfileReturnPg(pg); // remember where we came from
    setPg("profile");
    window.scrollTo(0,0);
    // If current user is admin, load this profile's points history
    setProfileLedger([]);
    if(isAdminUser(au?.email)){
      (async()=>{
        try{
          const qy=query(fbCol("pointsActivity"),where("uid","==",uid),limit(500));
          const snap=await getDocs(qy);
          const rows=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt||b.updatedAt||0)-(a.createdAt||a.updatedAt||0));
          setProfileLedger(rows);
        }catch(err){console.error("profile ledger error:",err)}
      })();
    }
  };
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(null),3000);return()=>clearTimeout(t)}},[toast]);

  const[ads,setAds]=useState([]);
  const[newsPosts,setNewsPosts]=useState([]); // admin-curated news
  const[research,setResearch]=useState([]); // PubMed papers, fetched on demand
  const[researchLoading,setResearchLoading]=useState(false);
  const[fdaAlerts,setFdaAlerts]=useState([]);
  const[trials,setTrials]=useState([]);
  const[industryNews,setIndustryNews]=useState([]);
  const[industryNewsConfigured,setIndustryNewsConfigured]=useState(true);
  const[newsFeedsLoading,setNewsFeedsLoading]=useState(false);
  const[rewards,setRewards]=useState([]);
  const[redemptions,setRedemptions]=useState([]);
  const[vendorApplications,setVendorApplications]=useState([]); // vendor proposals + approved partners
  const[vrImage,setVrImage]=useState(""); // vendor reward proposal: uploaded image URL
  const[vrUploading,setVrUploading]=useState(false);
  const[myLedger,setMyLedger]=useState([]); // current user's points-earning history
  const[igPost,setIgPost]=useState(null); // {item, type} when admin opens IG post generator
  const[profileLedger,setProfileLedger]=useState([]); // viewed user's ledger (admin only)
  const[rankMonth,setRankMonth]=useState(todayIST_YMD().slice(0,7)); // selected month for monthly leaderboard
  const[roleApplications,setRoleApplications]=useState([]);
  const[moderationLog,setModerationLog]=useState([]);
  const[submissions,setSubmissions]=useState([]);
  const[submitType,setSubmitType]=useState("");
  const[notifs,setNotifs]=useState([]);
  const[notifsOpen,setNotifsOpen]=useState(false);
  const[moreOpen,setMoreOpen]=useState(false); // overflow nav dropdown
  const[mentionMatches,setMentionMatches]=useState([]);
  const[announceTitle,setAnnounceTitle]=useState("");
  const[newsTitle,setNewsTitle]=useState("");
  const[newsBody,setNewsBody]=useState("");
  const[newsUrl,setNewsUrl]=useState("");
  const[newsCat,setNewsCat]=useState("");
  const[newsImage,setNewsImage]=useState("");
  // Rewards admin state
  const[rwTitle,setRwTitle]=useState("");
  const[rwDesc,setRwDesc]=useState("");
  const[rwImage,setRwImage]=useState("");
  const[rwPartner,setRwPartner]=useState("");
  const[rwCost,setRwCost]=useState("");
  const[rwStock,setRwStock]=useState("");
  const[rwInstructions,setRwInstructions]=useState("");
  const[rwCategory,setRwCategory]=useState("");
  const[rwExpiry,setRwExpiry]=useState("");
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
  const[selFP,setSelFP]=useState(null); // selected forum post for detail view
  const[selCs,setSelCs]=useState(null); // selected clinical case for detail view
  // ═══ CONSENT GENERATOR STATE ═══
  const[consentCat,setConsentCat]=useState(""); // selected category
  const[consentProc,setConsentProc]=useState(""); // selected sub-procedure (or "custom")
  const[consentCustomProc,setConsentCustomProc]=useState(""); // free-text if "custom"
  const[consentClinicName,setConsentClinicName]=useState("");
  const[consentClinicAddress,setConsentClinicAddress]=useState("");
  const[consentClinicPhone,setConsentClinicPhone]=useState("");
  const[consentClinicLogo,setConsentClinicLogo]=useState(""); // data URL from file input
  const[consentDoctorName,setConsentDoctorName]=useState("");
  const[consentDoctorReg,setConsentDoctorReg]=useState(""); // registration number
  const[consentGenerating,setConsentGenerating]=useState(false);
  // Patient details (all optional — can be left blank for blank template)
  const[consentPatientName,setConsentPatientName]=useState("");
  const[consentPatientAge,setConsentPatientAge]=useState("");
  const[consentPatientSex,setConsentPatientSex]=useState("");
  const[consentPatientMobile,setConsentPatientMobile]=useState("");
  const[consentPatientId,setConsentPatientId]=useState("");
  const[consentPatientConcern,setConsentPatientConcern]=useState(""); // optional free-text — patient's specific concern / desired outcome
  // Language: en, hi, mr, gu, bn, ta, te
  const[consentLanguage,setConsentLanguage]=useState("en");
  const[consentUseLetterhead,setConsentUseLetterhead]=useState(false); // if true, skip clinic header — leave space for printed letterhead
  // Preview modal state
  const[consentPreview,setConsentPreview]=useState(null); // {vernacularHtml?, englishHtml, procName, langCode}
  const[consentHistory,setConsentHistory]=useState([]); // current user's consent generation history (metadata only — no PHI)
  const[allConsents,setAllConsents]=useState([]); // admin view: ALL consent generations across all users
  const[refCopied,setRefCopied]=useState(false); // brief "Copied!" feedback for referral link

  // ═══ REFERRAL PAYOUT CHECK ═══
  // Each user pays THEMSELVES the referral bonus for friends they've referred
  // (Firestore rules don't allow writing another user's points field directly,
  // so the payout happens from the REFERRER's own session, not the referred user's).
  // Runs once when profile + allUsers are both loaded. Finds anyone who:
  //   1. Was referred by me (referredBy === my referralCode)
  //   2. Has qualified (referralBonusPaid===true, set when they answered their first quiz)
  //   3. Hasn't been counted yet (no matching doc in my referralsPaidFor array)
  const checkReferralPayouts=useCallback(async()=>{
    if(!au?.uid||!prof?.referralCode||!allUsers.length)return;
    const alreadyPaidFor=prof.referralsPaidFor||[]; // array of referred uids already paid out
    const qualifiedReferrals=allUsers.filter(u=>
      u.referredBy===prof.referralCode &&
      u.referralBonusPaid &&
      u.id!==au.uid &&
      !alreadyPaidFor.includes(u.id)
    );
    if(qualifiedReferrals.length===0)return;
    try{
      const fresh=await fbGet("users",au.uid);
      const basePoints=fresh?.points||prof.points||0;
      const basePaidFor=fresh?.referralsPaidFor||[];
      const newPaidFor=[...basePaidFor];
      let totalBonus=0;
      for(const ref of qualifiedReferrals){
        if(newPaidFor.includes(ref.id))continue; // race-condition guard
        newPaidFor.push(ref.id);
        totalBonus+=100;
        // Audit log entry (referred user's uid in the doc id keeps it unique)
        await fbSet("referrals",`${au.uid}_${ref.id}`,{
          referrerUid:au.uid,referrerName:prof.name||"",
          referredUid:ref.id,referredName:ref.name||"",
          referralCode:prof.referralCode,bonusPaid:true,paidAt:Date.now(),
        }).catch(()=>{});
        // Points ledger entry for "earning history"
        await fbSet("pointsActivity",`${au.uid}_referral_${ref.id}`,{
          uid:au.uid,date:todayIST_YMD(),action:"referral_bonus",
          label:`Referral bonus — ${ref.name||"a doctor"} joined and answered their first quiz`,
          pointsEarned:100,createdAt:Date.now(),
        }).catch(()=>{});
      }
      if(totalBonus>0){
        await fbSet("users",au.uid,{points:basePoints+totalBonus,referralsPaidFor:newPaidFor});
        setProf(p=>({...p,points:basePoints+totalBonus,referralsPaidFor:newPaidFor}));
        sh(`🎉 +${totalBonus} pts — ${qualifiedReferrals.length} of your referrals just qualified!`);
      }
    }catch(e){console.error("referral payout check failed:",e)}
  },[au?.uid,prof?.referralCode,prof?.referralsPaidFor,prof?.points,prof?.name,allUsers]);
  useEffect(()=>{checkReferralPayouts()},[checkReferralPayouts]);

  // Load my consent history when entering consent page
  const loadMyConsentHistory=useCallback(async()=>{
    if(!au?.uid)return;
    try{
      const qy=query(fbCol("consentGenerationLog"),where("uid","==",au.uid),limit(100));
      const snap=await getDocs(qy);
      const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
      rows.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      setConsentHistory(rows);
    }catch(err){console.error("consent history load failed:",err)}
  },[au?.uid]);
  // Load ALL consents (admin only)
  const loadAllConsents=useCallback(async()=>{
    if(!au?.email||!ADMINS.includes(au.email))return;
    try{
      // No where filter — admin sees all
      const qy=query(fbCol("consentGenerationLog"),limit(500));
      const snap=await getDocs(qy);
      const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
      rows.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      setAllConsents(rows);
    }catch(err){console.error("all-consents load failed:",err)}
  },[au?.email]);
  useEffect(()=>{if(pg==="consent")loadMyConsentHistory()},[pg,loadMyConsentHistory]);
  useEffect(()=>{if(pg==="admin"&&aTab==="consents")loadAllConsents()},[pg,aTab,loadAllConsents]);
  // Pre-fill clinic/doctor info from saved profile fields when entering consent page.
  // Uses BOTH old-style names (clinic, regNumber, name) and consent-specific names
  // (clinicName, doctorRegNumber, doctorName) — falls back to registration data.
  useEffect(()=>{
    if(pg!=="consent"||!prof)return;
    if(!consentClinicName)setConsentClinicName(prof.clinicName||prof.clinic||"");
    if(!consentClinicAddress)setConsentClinicAddress(prof.clinicAddress||prof.address||"");
    if(!consentClinicPhone)setConsentClinicPhone(prof.clinicPhone||prof.mobile||"");
    if(!consentDoctorName)setConsentDoctorName(prof.doctorName||prof.name||"");
    if(!consentDoctorReg)setConsentDoctorReg(prof.doctorRegNumber||prof.regNumber||"");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pg,prof]);
  const loadData=useCallback(async()=>{const[q,a,r,v,f,cs,u,ad,ev,n,rw,rd,ra,ml,sub,va]=await Promise.all([fbGetAll("quizzes","date","desc",500),fbGetAll("articles","date","desc",300),fbGetAll("resources","order","asc"),fbGetAll("videos","order","asc"),fbGetAll("forum","createdAt","desc",500),fbGetAll("cases","createdAt","desc",500),fbGetAll("users","joined","desc",2000),fbGetAll("ads","createdAt","desc"),fbGetAll("events","date","asc",200),fbGetAll("news","createdAt","desc",30),fbGetAll("rewards","createdAt","desc",100),fbGetAll("redemptions","createdAt","desc",200),fbGetAll("roleApplications","createdAt","desc",100),fbGetAll("moderationLog","createdAt","desc",200),fbGetAll("submissions","createdAt","desc",200),fbGetAll("vendorApplications","createdAt","desc",100)]);setQuizzes(q);setArticles(a);setResources(r);setVideos(v);setForumPosts(f);setCases(cs);setAllUsers(u);setAds(ad);setEvents(ev);setNewsPosts(n);setRewards(rw);setRedemptions(rd);setRoleApplications(ra);setModerationLog(ml);setSubmissions(sub);setVendorApplications(va)},[]);

  // Load current user's points-earning history from pointsActivity ledger.
  // Uses where(uid) so the list query satisfies security rules (can't list others' docs).
  const loadMyLedger=useCallback(async()=>{
    if(!au?.uid)return;
    try{
      const qy=query(fbCol("pointsActivity"),where("uid","==",au.uid),limit(500));
      const snap=await getDocs(qy);
      const mine=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt||b.updatedAt||0)-(a.createdAt||a.updatedAt||0));
      setMyLedger(mine);
    }catch(err){console.error("loadMyLedger error:",err);setMyLedger([])}
  },[au]);

  useEffect(()=>{const unsub=onAuthStateChanged(auth,async u=>{if(u){setAu(u);let p=await fbGet("users",u.uid);if(!p){const l=localStorage.getItem("sk_p_"+u.uid);if(l)p=JSON.parse(l)}if(p){
    // Backfill referral code for existing users created before this feature shipped
    if(!p.referralCode){
      const code=genReferralCode(p.name||"USER",u.uid);
      try{await fbSet("users",u.uid,{referralCode:code});p={...p,referralCode:code}}catch(e){console.warn("referral code backfill failed:",e)}
    }
    setProf(p);setScr("main");loadData()
  }else{setPf({accountType:"",country:"India",internationalCouncil:"",city:"",region:"",name:au?.displayName||"",mobile:"",degree:"",council:"",regNumber:"",clinic:"",address:"",visibility:"public",companyName:"",brandCategory:"",contactPerson:"",website:"",instituteName:"",instituteType:"",directorName:""});setSetupStep(0);setSetupErr("");setScr("setup")}}else{setAu(null);setProf(null);setScr("landing")}});return()=>unsub()},[loadData]);

  // Load the current user's points ledger once authenticated
  useEffect(()=>{if(au?.uid)loadMyLedger()},[au,loadMyLedger]);

  // ═══ Fetch latest quiz for landing page preview (unauthenticated users) ═══
  useEffect(()=>{
    if(scr!=="landing")return;
    setPublicQuizLoading(true);
    // Use direct Firestore client SDK call — quizzes are now publicly readable per rules
    (async()=>{
      try{
        const{getDocs:gd,query:qy,orderBy:ob,limit:lm,collection:col}=await import("firebase/firestore");
        const q=qy(col(db,"quizzes"),ob("date","desc"),lm(1));
        const snap=await gd(q);
        if(!snap.empty){
          const d=snap.docs[0];
          setPublicQuiz({id:d.id,...d.data()});
        }
      }catch(err){
        console.error("Public quiz fetch error:",err);
      }finally{
        setPublicQuizLoading(false);
      }
    })();
  },[scr]);

  // ═══ Fetch PubMed research papers (cached in sessionStorage for 6 hours) ═══
  useEffect(()=>{
    if(scr!=="main")return;
    const cached=sessionStorage.getItem("sk_research");
    if(cached){
      try{
        const{items,ts}=JSON.parse(cached);
        if(Date.now()-ts<6*60*60*1000){setResearch(items);return}
      }catch{}
    }
    setResearchLoading(true);
    fetch("/api/research")
      .then(r=>r.json())
      .then(data=>{
        if(data.ok&&Array.isArray(data.items)){
          setResearch(data.items);
          sessionStorage.setItem("sk_research",JSON.stringify({items:data.items,ts:Date.now()}));
        }
      })
      .catch(e=>console.error("Research fetch error:",e))
      .finally(()=>setResearchLoading(false));
  },[scr]);

  // ═══ Fetch FDA alerts + Clinical trials + Industry news (cached 6 hours) ═══
  useEffect(()=>{
    if(scr!=="main")return;
    const cached=sessionStorage.getItem("sk_newsfeeds");
    if(cached){
      try{
        const{fda,trials:t,industry,industryConfigured,ts}=JSON.parse(cached);
        if(Date.now()-ts<6*60*60*1000){
          setFdaAlerts(fda||[]);
          setTrials(t||[]);
          setIndustryNews(industry||[]);
          if(typeof industryConfigured==="boolean")setIndustryNewsConfigured(industryConfigured);
          return;
        }
      }catch{}
    }
    setNewsFeedsLoading(true);
    Promise.all([
      fetch("/api/fda-alerts").then(r=>r.json()).catch(e=>({ok:false,error:e.message,items:[]})),
      fetch("/api/clinical-trials").then(r=>r.json()).catch(e=>({ok:false,error:e.message,items:[]})),
      fetch("/api/industry-news").then(r=>r.json()).catch(e=>({ok:false,error:e.message,items:[]})),
    ]).then(([fdaRes,trialsRes,industryRes])=>{
      const fda=fdaRes?.items||[];
      const t=trialsRes?.items||[];
      const industry=industryRes?.items||[];
      const industryConfigured=industryRes?.configured!==false;
      setFdaAlerts(fda);
      setTrials(t);
      setIndustryNews(industry);
      setIndustryNewsConfigured(industryConfigured);
      sessionStorage.setItem("sk_newsfeeds",JSON.stringify({fda,trials:t,industry,industryConfigured,ts:Date.now()}));
    }).catch(e=>console.error("News feeds fetch error:",e))
    .finally(()=>setNewsFeedsLoading(false));
  },[scr]);

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

  // Close "More" dropdown when clicking outside
  useEffect(()=>{
    if(!moreOpen)return;
    const handler=(e)=>{
      if(e.target.closest('[data-more-dropdown]'))return;
      if(e.target.closest('[data-more-btn]'))return;
      setMoreOpen(false);
    };
    setTimeout(()=>document.addEventListener("click",handler),0);
    return()=>document.removeEventListener("click",handler);
  },[moreOpen]);

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
      const found=forumPosts.find(p=>p.id===forumId);
      if(found){setPg("forum");setSelFP(found);window.history.replaceState({},"",window.location.pathname)}
      else{setPg("forum");window.history.replaceState({},"",window.location.pathname)}
    }else if(params.get("case")&&cases.length){
      const caseId=params.get("case");
      const found=cases.find(c=>c.id===caseId);
      if(found){setPg("cases");setSelCs(found);window.history.replaceState({},"",window.location.pathname)}
      else{setPg("cases");window.history.replaceState({},"",window.location.pathname)}
    }
  },[scr,articles,videos,forumPosts,events,ads,quizzes,cases]);

  const isAdm=prof&&ADMINS.includes(au?.email);const isPd=prof?.paid;const today=ds(getIST());const hr=getIST().getHours();
  const uName=prof?.name||au?.displayName||"Doctor";const uIni=(uName.replace(/^Dr\.?\s*/i,"").split(" ").map(w=>w[0]).join("").toUpperCase()||"D").slice(0,2);const uPhoto=au?.photoURL;
  // ═══ PHARMA = sponsor only, can't post clinical content ═══
  const isPharma=prof?.accountType==="pharma"||prof?.accountType==="brand";
  const isVendor=prof?.accountType==="vendor";
  const isVendorOrBrand=isPharma||isVendor;
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
    if(pf.accountType==="pharma"||pf.accountType==="brand"){
      if(!pf.companyName?.trim()){setSetupErr("Company name is required");return}
      if(!pf.brandCategory){setSetupErr("Pick a brand category");return}
      if(!pf.contactPerson?.trim()){setSetupErr("Contact person is required");return}
    }
    if(pf.accountType==="vendor"){
      if(!pf.companyName?.trim()){setSetupErr("Company name is required");return}
      if(!pf.vendorCategory){setSetupErr("Pick a vendor category");return}
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
    // ═══ REFERRAL: generate this user's own unique code + capture who referred them ═══
    const myReferralCode=genReferralCode(pf.name||"USER",au.uid);
    const urlParams=new URLSearchParams(window.location.search);
    let refCodeFromUrl=(urlParams.get("ref")||"").trim().toUpperCase();
    if(refCodeFromUrl===myReferralCode)refCodeFromUrl=""; // block self-referral
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
      referralCode:myReferralCode,
      referredBy:refCodeFromUrl||"",
      referralBonusPaid:false, // flips true once referrer is paid (after this user's first correct quiz)
      // Type-specific
      ...(pf.accountType==="doctor"?{
        degree:pf.degree,
        regNumber:pf.regNumber.trim(),
        clinic:pf.clinic.trim(),
        address:pf.address?.trim()||"",
        // India-specific OR international-specific council
        ...(pf.country==="India"?{council:pf.council}:{internationalCouncil:pf.internationalCouncil.trim(),city:pf.city.trim(),region:pf.region?.trim()||""})
      }:{}),
      ...(pf.accountType==="pharma"||pf.accountType==="brand"?{companyName:pf.companyName.trim(),brandCategory:pf.brandCategory,contactPerson:pf.contactPerson.trim(),website:pf.website?.trim()||"",address:pf.address?.trim()||""}:{}),
      ...(pf.accountType==="vendor"?{companyName:pf.companyName.trim(),vendorCategory:pf.vendorCategory,contactPerson:pf.contactPerson.trim(),gstNumber:pf.gstNumber?.trim()||"",website:pf.website?.trim()||"",address:pf.address?.trim()||""}:{}),
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
    // Fire welcome email (non-blocking) — sandbox domain until custom domain set up
    sendEmail("welcome",au.email,{name:p.name,accountType:p.accountType});
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
  // ═══ AWARD POINTS — central helper with daily-cap enforcement ═══
  // Returns {awarded: number, capped: boolean}.
  // Schema: pointsActivity/{userId}_{date}_{actionType}
  // Document: { uid, date, action, count, pointsEarned, updatedAt }
  // Uses a unique key system so it's safe to call this many times — only the
  // first N calls per day (where N = action's cap) actually award points.
  // Optional uniqueKey: for actions where "uniqueness" matters (e.g. share_unique
  // per item) — prevents double-counting the same share.
  const awardPoints=async(actionType,uniqueKey)=>{
    if(!au||!prof)return{awarded:0,capped:false};
    const spec=ACTION_POINTS[actionType];
    if(!spec){console.warn("Unknown action type:",actionType);return{awarded:0,capped:false}}
    const date=todayIST_YMD();
    const docId=`${au.uid}_${date}_${actionType}`;
    try{
      const existing=await fbGet("pointsActivity",docId);
      const currentCount=existing?.count||0;
      const currentUnique=existing?.uniqueKeys||[];
      // Uniqueness check (e.g. only one share-credit per item)
      if(uniqueKey&&currentUnique.includes(uniqueKey)){
        return{awarded:0,capped:false,duplicate:true};
      }
      // Cap check
      if(spec.cap>0&&currentCount>=spec.cap){
        sh(`✋ You've hit today's points cap for "${spec.label}". Keep contributing — your points reset at midnight.`);
        return{awarded:0,capped:true};
      }
      // Award points
      const points=spec.points;
      const newCount=currentCount+1;
      const newUnique=uniqueKey?[...currentUnique,uniqueKey]:currentUnique;
      await fbSet("pointsActivity",docId,{
        uid:au.uid,
        date,
        action:actionType,
        count:newCount,
        pointsEarned:(existing?.pointsEarned||0)+points,
        uniqueKeys:newUnique,
        updatedAt:Date.now(),
      });
      // Add to user's running total — read fresh from Firestore to avoid stale-state wipes
      let basePoints=prof.points||0;
      let baseMonthly=prof.monthlyPoints||{};
      try{
        const fresh=await fbGet("users",au.uid);
        if(fresh){
          basePoints=fresh.points||0;
          baseMonthly=fresh.monthlyPoints||{};
        }
      }catch(err){console.error("fresh read failed in awardPoints:",err)}
      const newTotal=basePoints+points;
      const mKey=todayIST_YMD().slice(0,7);
      const curM=baseMonthly[mKey]||0;
      const newMonthly={...baseMonthly,[mKey]:curM+points};
      await fbSet("users",au.uid,{points:newTotal,monthlyPoints:newMonthly});
      setProf(p=>({...p,points:newTotal,monthlyPoints:newMonthly}));
      loadMyLedger();
      // Show cap-warning toast on last allowed point
      if(spec.cap>0&&newCount===spec.cap){
        sh(`+${points} pt for "${spec.label}" — that's the last one for today! 🎯`);
      }else{
        sh(`+${points} pt: ${spec.label}`);
      }
      return{awarded:points,capped:false};
    }catch(err){
      console.error("awardPoints error:",err);
      return{awarded:0,capped:false,error:err.message};
    }
  };

  // Wrapper for share actions — awards points with uniqueKey to prevent
  // double-counting the same item across WhatsApp/X/LinkedIn/Copy.
  const handleShare=(via,itemType,itemId)=>{
    if(!itemId||!itemType||!au)return;
    const uniqueKey=`${itemType}_${itemId}`;
    awardPoints("share_unique",uniqueKey);
  };

  // ═══ REWARDS REDEMPTION ═══
  // Generates a unique-ish 8-char alphanumeric voucher code
  const genVoucherCode=()=>{
    const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // skip 0/O/1/I for readability
    let c="SK-";
    for(let i=0;i<8;i++)c+=chars[Math.floor(Math.random()*chars.length)];
    return c;
  };

  // Spendable points = lifetime earned - lifetime redeemed
  const spendablePoints=Math.max(0,(prof?.points||0)-(prof?.redeemedPoints||0));

  // Core redemption function — atomic check + deduct + create receipt
  // ═══ MODERATION AUDIT LOG ═══
  // Every privileged action (role change, content moderation) writes here.
  // This is non-negotiable: without it, you can't investigate problems or reverse mistakes.
  // ═══ EMAIL NOTIFICATIONS ═══
  // Fire-and-forget — emails should never block the UI or fail loudly.
  // Respects the recipient's emailPreferences (if set).
  const sendEmail=async(type,to,data,recipientPrefs=null)=>{
    if(!to||!to.includes("@"))return; // silently skip invalid addresses
    // Check recipient preferences — if they opted out of this type, don't send
    const prefKey={welcome:"welcome",submission_approved:"submissions",submission_rejected:"submissions",reply:"replies"}[type];
    if(recipientPrefs&&prefKey&&recipientPrefs[prefKey]===false)return;
    try{
      const r=await fetch("/api/send-email",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({type,to,data}),
      });
      const j=await r.json();
      if(!j.ok&&j.error){console.warn("Email send failed:",type,j.error)}
    }catch(err){
      console.warn("Email request error:",err.message);
    }
  };

  const logModerationAction=async(action,details={})=>{
    if(!au)return;
    try{
      await fbAdd("moderationLog",{
        actorUid:au.uid,
        actorName:uName,
        actorEmail:au.email||"",
        actorRole:isAdminUser(au.email)?"admin":(prof?.role||"user"),
        action,
        ...details,
        createdAt:Date.now(),
        date:ds(getIST()),
      });
    }catch(err){console.error("audit log error:",err)}
  };

  // ═══ ROLE MANAGEMENT (admin only) ═══
  const assignRole=async(targetUserId,targetUserName,newRole,reason="")=>{
    if(!isAdminUser(au?.email)){sh("Only admins can change roles");return}
    if(!targetUserId)return;
    try{
      const target=await fbGet("users",targetUserId);
      const oldRole=target?.role||null;
      await fbSet("users",targetUserId,{role:newRole||null});
      await logModerationAction("role_assign",{
        targetUid:targetUserId,
        targetName:targetUserName,
        oldRole,
        newRole:newRole||null,
        reason,
      });
      sh(newRole?`✅ ${targetUserName} promoted to ${ROLE_DISPLAY[newRole]?.label||newRole}`:`✅ ${targetUserName}'s role removed`);
      loadData();
    }catch(err){console.error("assignRole error:",err);sh("Role change failed")}
  };

  // ═══ ROLE APPLICATION SUBMISSION (any signed-in user) ═══
  const submitRoleApplication=async(requestedRole,reason,experience)=>{
    if(!au||!prof)return{ok:false};
    if(!requestedRole||!reason.trim()){sh("Please fill in all required fields");return{ok:false}}
    // Prevent duplicate pending applications
    const existing=roleApplications.find(a=>a.uid===au.uid&&a.status==="pending");
    if(existing){sh("You already have a pending application — please wait for review");return{ok:false}}
    try{
      await fbAdd("roleApplications",{
        uid:au.uid,
        userName:uName,
        userEmail:au.email,
        accountType:prof.accountType||"unknown",
        requestedRole,
        reason:reason.trim(),
        experience:experience.trim(),
        currentTier:getTier(prof.points||0).label,
        currentPoints:prof.points||0,
        status:"pending", // pending | approved | rejected
        createdAt:Date.now(),
        date:ds(getIST()),
      });
      sh("📨 Application submitted! You'll hear from us soon.");
      loadData();
      return{ok:true};
    }catch(err){console.error("submitRoleApplication error:",err);sh("Submission failed");return{ok:false}}
  };

  // ═══ APPLICATION REVIEW (admin only) ═══
  const reviewApplication=async(appId,decision,note="")=>{
    if(!isAdminUser(au?.email)){sh("Admin only");return}
    const app=roleApplications.find(a=>a.id===appId);
    if(!app)return;
    try{
      await fbSet("roleApplications",appId,{
        status:decision, // "approved" | "rejected"
        reviewedAt:Date.now(),
        reviewerUid:au.uid,
        reviewerName:uName,
        reviewNote:note,
      });
      // If approved, assign the role
      if(decision==="approved"){
        await assignRole(app.uid,app.userName,app.requestedRole,`Approved application #${appId}`);
      }
      await logModerationAction("application_review",{
        applicationId:appId,
        applicantUid:app.uid,
        applicantName:app.userName,
        requestedRole:app.requestedRole,
        decision,
        note,
      });
      sh(`Application ${decision}`);
      loadData();
    }catch(err){console.error("reviewApplication error:",err);sh("Review failed")}
  };

  // ═══ CONTENT SUBMISSION SYSTEM ═══
  // User submits content → goes into 'submissions' collection with status:"pending"
  // Admin/Moderator reviews → on approve, data is copied to target collection (events/articles/etc.)
  // Pattern handles all 5 types uniformly via SUBMISSION_TYPES config.

  const submitContent=async(typeKey,formData,coverImage)=>{
    if(!au||!prof)return{ok:false,error:"Not signed in"};
    if(!canSubmitType(typeKey,au,prof))return{ok:false,error:"You don't have permission to submit this type"};
    const cfg=SUBMISSION_TYPES[typeKey];
    if(!cfg)return{ok:false,error:"Unknown content type"};
    // Validate required fields
    for(const f of cfg.fields){
      if(f.required&&!(formData[f.key]||"").toString().trim()){
        return{ok:false,error:`"${f.label}" is required`};
      }
    }
    // Cross-field validation: event end date must be ≥ start date
    if(typeKey==="event"&&formData.endDate&&formData.date&&formData.endDate<formData.date){
      return{ok:false,error:"End date must be on or after start date"};
    }
    try{
      await fbAdd("submissions",{
        type:typeKey,
        submitterUid:au.uid,
        submitterName:uName,
        submitterEmail:au.email,
        submitterAccountType:prof.accountType||"unknown",
        submitterRole:prof.role||null,
        data:formData,
        coverImage:coverImage||"",
        status:"pending", // pending | approved | rejected
        createdAt:Date.now(),
        date:ds(getIST()),
      });
      sh(`📨 ${cfg.label} submitted! You'll hear from admin once reviewed.`);
      // Award points based on submission type
      const pointMap={
        article:"article_publish",
        video:"video_submit",
        resource:"resource_submit",
      };
      if(pointMap[typeKey]){
        await awardPoints(pointMap[typeKey]);
      }
      loadData();
      return{ok:true};
    }catch(err){
      console.error("submitContent error:",err);
      sh("Submission failed — please try again");
      return{ok:false,error:err.message};
    }
  };

  const approveSubmission=async(submissionId,edits=null)=>{
    if(!isAdminUser(au?.email)){sh("Admin only");return}
    const sub=submissions.find(s=>s.id===submissionId);
    if(!sub){sh("Submission not found");return}
    const cfg=SUBMISSION_TYPES[sub.type];
    if(!cfg){sh("Unknown content type");return}
    try{
      // Build the final data — merge submission with any admin edits
      const finalData=edits?{...sub.data,...edits}:sub.data;
      // Build the doc to insert into the target collection
      const targetDoc={
        ...finalData,
        // Submitter metadata (always tracked)
        authorUid:sub.submitterUid,
        authorAccountType:sub.submitterAccountType,
        submitterName:sub.submitterName,
        // Engagement fields
        likedBy:[],
        likes:0,
        comments:[],
        views:0,
        date:finalData.date||ds(getIST()),
        createdAt:Date.now(),
        submittedVia:"user-submission",
        sourceSubmissionId:submissionId,
      };
      // Place uploaded image into the correct field name for this content type
      if(sub.coverImage&&cfg.imageKey){
        targetDoc[cfg.imageKey]=sub.coverImage;
      }
      // For articles, the form has its own `author` field — keep it; otherwise use submitter name
      if(sub.type!=="article"||!finalData.author){
        targetDoc.author=sub.submitterName;
      }
      // Special handling for ads (no comments/likes structure)
      if(sub.type==="ad"){
        delete targetDoc.likedBy;delete targetDoc.likes;delete targetDoc.comments;
        targetDoc.active=true; // approved ads go live immediately
      }
      // Special handling for events — regType defaults to internal if not set
      if(sub.type==="event"&&!targetDoc.regType){
        targetDoc.regType="internal";
      }
      // Special handling for vendor_reward — creates a reward doc with vendor metadata
      if(sub.type==="vendor_reward"){
        // Admin must set the point cost via edits before approving
        const pointCost=parseInt(finalData.pointCost);
        if(!pointCost||pointCost<=0){
          sh("⚠️ Set a point cost first (use edit, enter pointCost)");return;
        }
        // Rebuild as a reward doc (the rewards collection has different schema)
        const stockNum=parseInt(finalData.stock)||0;
        const rewardDoc={
          title:finalData.title,
          desc:finalData.desc,
          partner:sub.data.vendorName||sub.submitterName,
          vendorId:sub.data.vendorId||sub.submitterUid,
          vendorName:sub.data.vendorName||sub.submitterName,
          pointCost,
          stock:stockNum,
          category:finalData.category||"Partner Offer",
          instructions:finalData.voucher||"",
          fulfillmentType:finalData.fulfillment||"manual",
          voucherCode:finalData.voucher||"",
          image:sub.coverImage||"",
          active:true,
          timesRedeemed:0,
          createdAt:Date.now(),
          date:ds(getIST()),
          sourceSubmissionId:submissionId,
        };
        const newId=await fbAdd("rewards",rewardDoc);
        await fbSet("submissions",submissionId,{
          status:"approved",
          reviewedAt:Date.now(),
          reviewedBy:au.email,
          publishedId:newId,
        });
        createNotif({
          toUid:sub.submitterUid,fromUid:au.uid,fromName:uName,fromIni:uIni,fromPhoto:uPhoto,
          type:"announcement",
          text:`approved your reward proposal "${(finalData.title||"").slice(0,40)}"`,
        });
        const submitter=allUsers.find(u=>u.id===sub.submitterUid);
        if(submitter?.email||sub.submitterEmail){
          sendEmail("submission_approved",submitter?.email||sub.submitterEmail,{
            name:sub.submitterName,
            contentType:"vendor reward",
            title:finalData.title||"",
          },submitter?.emailPreferences);
        }
        sh(`✅ Reward published to catalog`);
        loadData();
        return;
      }
      // Insert into target collection
      const newId=await fbAdd(cfg.targetCollection,targetDoc);
      // Update submission status
      await fbSet("submissions",submissionId,{
        status:"approved",
        reviewedAt:Date.now(),
        reviewerUid:au.uid,
        reviewerName:uName,
        publishedId:newId,
      });
      // Log + notify
      await logModerationAction("submission_approved",{
        submissionId,
        type:sub.type,
        submitterUid:sub.submitterUid,
        submitterName:sub.submitterName,
        publishedId:newId,
      });
      createNotif({
        toUid:sub.submitterUid,
        fromUid:au.uid,
        fromName:uName,
        fromIni:uIni,
        fromPhoto:uPhoto,
        type:"announcement",
        text:`approved your ${cfg.label} submission "${(finalData.title||"").slice(0,40)}"`,
      });
      // Email notification — find submitter's email and prefs
      const submitter=allUsers.find(u=>u.id===sub.submitterUid);
      if(submitter?.email||sub.submitterEmail){
        sendEmail("submission_approved",submitter?.email||sub.submitterEmail,{
          name:sub.submitterName,
          contentType:sub.type,
          title:finalData.title||"",
        },submitter?.emailPreferences);
      }
      sh(`✅ Approved & published as ${cfg.label}`);
      loadData();
    }catch(err){
      console.error("approveSubmission error:",err);
      sh("Approval failed");
    }
  };

  const rejectSubmission=async(submissionId,reason)=>{
    if(!isAdminUser(au?.email)){sh("Admin only");return}
    const sub=submissions.find(s=>s.id===submissionId);
    if(!sub)return;
    try{
      await fbSet("submissions",submissionId,{
        status:"rejected",
        reviewedAt:Date.now(),
        reviewerUid:au.uid,
        reviewerName:uName,
        rejectionReason:reason||"",
      });
      await logModerationAction("submission_rejected",{
        submissionId,
        type:sub.type,
        submitterUid:sub.submitterUid,
        submitterName:sub.submitterName,
        reason,
      });
      createNotif({
        toUid:sub.submitterUid,
        fromUid:au.uid,
        fromName:uName,
        fromIni:uIni,
        fromPhoto:uPhoto,
        type:"announcement",
        text:`reviewed your submission — see status on your Me page`,
      });
      // Email notification with rejection reason
      const submitter=allUsers.find(u=>u.id===sub.submitterUid);
      if(submitter?.email||sub.submitterEmail){
        sendEmail("submission_rejected",submitter?.email||sub.submitterEmail,{
          name:sub.submitterName,
          contentType:sub.type,
          title:sub.data?.title||"",
          reason:reason||"",
        },submitter?.emailPreferences);
      }
      sh("Submission rejected");
      loadData();
    }catch(err){
      console.error("rejectSubmission error:",err);
      sh("Rejection failed");
    }
  };

  const redeemReward=async(reward)=>{
    if(!au||!prof){sh("Please log in first");return}
    if(!reward||!reward.active){sh("This reward is not available");return}
    if((reward.stock||0)<=0){sh("Sorry — out of stock");return}
    const cost=reward.pointCost||0;
    if(cost<=0){sh("Invalid reward — contact admin");return}
    if(spendablePoints<cost){sh(`You need ${cost-spendablePoints} more points to redeem this`);return}
    if(!confirm(`Redeem "${reward.title}" for ${cost} points?\n\nYou'll get a voucher code to use with ${reward.partner||"the partner"}.\n\nThis action can't be undone.`))return;

    // Re-fetch the latest reward to avoid race conditions on stock
    const fresh=await fbGet("rewards",reward.id);
    if(!fresh||!fresh.active||(fresh.stock||0)<=0){sh("This reward was just claimed by someone else");loadData();return}

    const code=genVoucherCode();
    try{
      // 1. Decrement stock
      await fbSet("rewards",reward.id,{stock:(fresh.stock||0)-1,timesRedeemed:(fresh.timesRedeemed||0)+1});
      // 2. Create redemption record
      const redemptionId=await fbAdd("redemptions",{
        uid:au.uid,
        userName:uName,
        userEmail:au.email,
        rewardId:reward.id,
        rewardTitle:reward.title,
        partner:reward.partner||"",
        pointCost:cost,
        code,
        status:"pending", // pending → fulfilled → completed
        instructions:reward.instructions||"",
        redeemedAt:Date.now(),
        date:ds(getIST()),
      });
      // 3. Update user's redeemed total
      const newRedeemed=(prof.redeemedPoints||0)+cost;
      await fbSet("users",au.uid,{redeemedPoints:newRedeemed});
      setProf(p=>({...p,redeemedPoints:newRedeemed}));
      // 4. If this is a vendor reward, email the vendor with redemption details
      if(reward.vendorId){
        const vendor=allUsers.find(u=>u.id===reward.vendorId);
        if(vendor?.email){
          // Construct message based on fulfillment type
          const ft=reward.fulfillmentType||"manual";
          const doctorContact=ft==="contact"?`\n\nDoctor's contact: ${au.email}`:"";
          const voucherInfo=ft==="voucher"?`\n\nVoucher code shared with doctor: ${reward.voucherCode||code}`:"";
          sendEmail("submission_approved",vendor.email,{
            name:vendor.name||reward.vendorName||"Partner",
            contentType:"redemption",
            title:`${uName} redeemed "${reward.title}"${doctorContact}${voucherInfo}`,
          },vendor.emailPreferences);
        }
      }
      sh(`✅ Redeemed! Your code: ${code}`);
      loadData();
      return{code,redemptionId};
    }catch(err){
      console.error("Redemption error:",err);
      sh("Redemption failed — please try again");
    }
  };

  const recomputeAllPoints=async()=>{
    if(!confirm("Recompute ALL users' total points from scratch.\n\n• Quiz history: 10pt Easy / 20pt Moderate / 30pt Hard per correct answer\n• Action points: forum comments, case posts, shares (from ledger)\n• EXCLUDES backfill and quiz ledger entries (those would double-count)\n\nUsers with no answered quizzes are LEFT UNCHANGED.\nStreak bonuses are NOT retroactive.\n\nContinue?"))return;
    sh("⏳ Recomputing... please wait");
    try{
      // Build a map: userId -> { points, totalAnswered, totalCorrect }
      const userStats={};
      // 1. Read all quizzes and tally correct answers per user
      quizzes.forEach(q=>{
        // Fix the buggy condition: properly check for ci undefined
        if(!q.answers||typeof q.ci!=="number")return;
        const diff=q.diff||"Easy";
        const pointsForCorrect=diff==="Hard"?30:diff==="Moderate"?20:10;
        Object.entries(q.answers).forEach(([uid,answerIdx])=>{
          if(!userStats[uid])userStats[uid]={points:0,totalAnswered:0,totalCorrect:0};
          userStats[uid].totalAnswered++;
          if(answerIdx===q.ci){
            userStats[uid].totalCorrect++;
            userStats[uid].points+=pointsForCorrect;
          }
        });
      });
      // 2. Read pointsActivity ledger and add ONLY action points (forum, cases, shares).
      // CRITICAL: skip `legacy_backfill` entries — those were a snapshot of pre-ledger
      // quiz points and would double-count if added to the freshly-computed quiz totals.
      // The quiz answers in step 1 already represent that history correctly.
      try{
        const ledgerQy=query(fbCol("pointsActivity"),limit(5000));
        const ledgerSnap=await getDocs(ledgerQy);
        ledgerSnap.docs.forEach(d=>{
          const e=d.data();
          if(!e.uid||typeof e.pointsEarned!=="number")return;
          // Skip backfill and quiz entries — quiz_correct is already counted in step 1 via quiz answers
          if(e.action==="legacy_backfill"||e.action==="quiz_correct")return;
          if(!userStats[e.uid])userStats[e.uid]={points:0,totalAnswered:0,totalCorrect:0};
          userStats[e.uid].points+=e.pointsEarned;
        });
      }catch(err){console.error("ledger read in recompute failed:",err);sh("⚠️ Could not read ledger; aborting recompute to avoid wiping action points");return}
      // 3. Save back to each user (only update users we have stats for — never zero out)
      const updates=Object.entries(userStats);
      let success=0,failed=0;
      for(const[uid,stats]of updates){
        try{
          await fbSet("users",uid,{points:stats.points,totalAnswered:stats.totalAnswered,totalCorrect:stats.totalCorrect});
          success++;
        }catch(e){failed++}
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

  // ═══ ONE-TIME BACKFILL: seed the ledger with current points as "this month" ═══
  // Safe to run multiple times — uses a fixed doc ID per user+month so re-running
  // overwrites instead of duplicating. Only for the case where the points system
  // started this month and all current points belong to the current month.
  const backfillLedgerThisMonth=async()=>{
    if(!isAdminUser(au?.email)){sh("Admin only");return}
    const monthKey=todayIST_YMD().slice(0,7); // e.g. "2026-05"
    // Backfill anyone with points who isn't an admin (matches who appears on the leaderboard).
    // Don't require accountType==="doctor" strictly — older accounts may lack the field.
    const eligible=allUsers.filter(u=>(u.points||0)>0&&!isExcludedFromLeaderboard(u));
    if(!confirm(`Backfill the points ledger for ${eligible.length} users?\n\nThis sets each user's "${monthKey}" monthly points equal to their CURRENT total, so the monthly leaderboard works immediately.\n\nSafe to run again (won't duplicate). Only do this if the points system started this month.\n\nContinue?`))return;
    let done=0,failed=0;
    for(const u of eligible){
      try{
        const docId=`${u.id}_backfill_${monthKey}`;
        await fbSet("pointsActivity",docId,{
          uid:u.id,
          date:todayIST_YMD(),
          month:monthKey,
          action:"legacy_backfill",
          label:`Points earned in ${monthKey}`,
          pointsEarned:u.points||0,
          createdAt:Date.now(),
          backfill:true,
        });
        // Also set monthlyPoints on the user doc (this is what the leaderboard reads,
        // since users can't read each other's pointsActivity entries)
        const monthlyPoints={...(u.monthlyPoints||{}),[monthKey]:u.points||0};
        await fbSet("users",u.id,{monthlyPoints});
        done++;
      }catch(e){failed++;console.error("backfill error for",u.id,e)}
    }
    sh(`✅ Backfilled ${done} users${failed>0?` (${failed} failed)`:""}`);
    await loadData();
    loadMyLedger();
  };

  // ═══ RECOVERY: restore each user's lifetime points from their May 2026 monthly total ═══
  // Use this when recompute has corrupted lifetime totals but monthlyPoints["2026-05"] is intact.
  // Only valid because all points were earned in May 2026 (per user confirmation).
  // Idempotent — safe to re-run.
  const restorePointsFromMay=async()=>{
    if(!isAdminUser(au?.email)){sh("Admin only");return}
    const sourceMonth="2026-05";
    const eligible=allUsers.filter(u=>{
      const v=(u.monthlyPoints||{})[sourceMonth];
      return typeof v==="number"&&v>0;
    });
    if(!confirm(`Restore lifetime points for ${eligible.length} users from their ${sourceMonth} monthly totals?\n\nFor each user: sets points = monthlyPoints["${sourceMonth}"].\nUse this to recover from a broken recompute.\nAll points are assumed to be from May (per your earlier confirmation).\n\nSafe to re-run. Continue?`))return;
    sh("⏳ Restoring... please wait");
    let done=0,failed=0;
    for(const u of eligible){
      try{
        const val=u.monthlyPoints[sourceMonth];
        await fbSet("users",u.id,{points:val});
        if(u.id===au.uid)setProf(p=>({...p,points:val}));
        done++;
      }catch(e){failed++;console.error("restore error for",u.id,e)}
    }
    await loadData();
    sh(`✅ Restored ${done} users${failed>0?` (${failed} failed)`:""}`);
  };

  // ═══ RECOVERY: rebuild MY points by summing my own pointsActivity ledger ═══
  // Use when restore-from-May can't help (no monthlyPoints field) but the user has
  // action-point ledger entries. Reads only current user's ledger.
  // Excludes backfill entries (those represent total-at-backfill-time, not a separate event).
  const recoverMyPointsFromLedger=async()=>{
    if(!au?.uid)return;
    try{
      const qy=query(fbCol("pointsActivity"),where("uid","==",au.uid),limit(2000));
      const snap=await getDocs(qy);
      const rows=snap.docs.map(d=>d.data());
      // Sum all entries except backfill (which is a snapshot, not an addition)
      const sum=rows.filter(e=>e.action!=="legacy_backfill"&&typeof e.pointsEarned==="number")
                    .reduce((s,e)=>s+e.pointsEarned,0);
      const backfillEntry=rows.find(e=>e.action==="legacy_backfill");
      const baseFromBackfill=backfillEntry?backfillEntry.pointsEarned:0;
      const total=sum+baseFromBackfill;
      if(!confirm(`Recover your points to ${total}?\n\nBreakdown:\n• Action ledger sum: ${sum}\n• Backfill snapshot: ${baseFromBackfill}\n\nThis writes ${total} to your points field. Continue?`))return;
      await fbSet("users",au.uid,{points:total});
      setProf(p=>({...p,points:total}));
      sh(`✅ Your points restored to ${total}`);
      await loadData();
    }catch(err){
      console.error("recoverMyPointsFromLedger error:",err);
      sh("❌ Recovery failed: "+(err.message||"check console"));
    }
  };

  // ═══ CONSENT TEMPLATE GENERATOR ═══
  // Builds a .doc file (HTML-based Word document) for the selected procedure
  // and triggers download. Rate-limited per user per day; admin can grant
  // bonus credits. Logs each generation to consentGenerationLog for audit.
  // ═══ CONSENT TEMPLATE GENERATOR ═══
  // Builds HTML content for the chosen procedure + language. When language ≠ English,
  // builds BOTH the vernacular and English versions and shows both in the preview modal.
  // Preview modal lets the user download as .doc or print to PDF.
  const generateConsent = async () => {
    if (!au || !prof) { sh("Please sign in"); return; }

    // Resolve procedure
    let procName = "";
    let procData = null;
    if (consentProc === "__custom__") {
      procName = consentCustomProc.trim();
      if (!procName) { sh("Please enter the procedure name"); return; }
    } else if (consentCat && consentProc && CONSENT_PROCEDURES[consentCat]?.procedures?.[consentProc]) {
      procName = consentProc;
      procData = CONSENT_PROCEDURES[consentCat].procedures[consentProc];
    } else {
      sh("Please select a procedure");
      return;
    }

    if (!consentClinicName.trim()) { sh("Please enter clinic name"); return; }
    if (!consentDoctorName.trim()) { sh("Please enter doctor name"); return; }

    // Rate limit
    // Admins bypass entirely (their own platform — no point limiting themselves)
    // Doctors: 2 free per day, then credits
    const isAdminUser = ADMINS.includes(au.email);
    const DAILY_FREE_LIMIT = 2;
    const todayKey = todayIST_YMD();
    const todaysCount = (prof.consentGenerations || {})[todayKey] || 0;
    const credits = prof.consentCredits || 0;
    if (!isAdminUser && todaysCount >= DAILY_FREE_LIMIT && credits <= 0) {
      const userChoice = confirm(
        "You've used your " + DAILY_FREE_LIMIT + " free consent generations for today.\n\n" +
        "Two options to continue:\n" +
        "1. Wait until tomorrow (limit resets at midnight IST)\n" +
        "2. Request more credits — free during beta!\n\n" +
        "Click OK to message Dr. Dhananjay Patil on WhatsApp, or Cancel to wait."
      );
      if (!userChoice) return;
      // WhatsApp link with pre-filled message
      const waMessage = encodeURIComponent(
        "Hi Dr. Patil, I'd like more consent template credits on SKINARIO. My account: " + (au.email || au.uid)
      );
      window.open("https://wa.me/918390200008?text=" + waMessage, "_blank");
      return;
    }

    setConsentGenerating(true);

    try {
      // Shared inputs
      const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
      const safe = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const logoHtml = consentClinicLogo ? `<img src="${consentClinicLogo}" style="max-height:60px;max-width:160px;display:block;" />` : "";

      const description = procData?.description || `The ${procName} procedure has been explained to me, including its purpose, technique, and expected outcomes.`;
      const commonRisks = procData?.commonRisks || ["Procedure-site discomfort, redness, or swelling", "Bruising or transient inflammation", "Variable individual response"];
      const seriousRisks = procData?.seriousRisks || ["Infection or delayed healing", "Allergic reaction (rare)", "Suboptimal aesthetic outcome requiring additional treatment"];
      const contraindications = procData?.contraindications || ["Pregnancy or breastfeeding", "Active infection at treatment site", "Known allergy to any product used", "Bleeding disorders or anticoagulant use", "Autoimmune disease (relative)"];
      const aftercare = procData?.aftercare || ["Follow all post-procedure instructions provided", "Avoid sun exposure as advised", "Contact clinic immediately if unexpected symptoms occur", "Attend all scheduled follow-up appointments"];
      const duration = procData?.duration || "Results, longevity, and number of sessions vary by individual and will be discussed at consultation.";

      // Pre-fill patient fields if user entered them
      const patientName = consentPatientName.trim();
      const patientAge = consentPatientAge.trim();
      const patientSex = consentPatientSex.trim();
      const patientMobile = consentPatientMobile.trim();
      const patientId = consentPatientId.trim();
      const patientConcern = consentPatientConcern.trim();
      const hasConcern = patientConcern.length > 0;
      // Helper to render a field that's either filled or has an underline
      const fld = (val, minWidth) => val ? `<strong>${safe(val)}</strong>` : `<span class="underline" style="min-width:${minWidth || 200}pt;"></span>`;

      // ═══ HTML BUILDER (parameterized by language + render mode) ═══
      // forDownload=false → preview (full red warnings, top + footer)
      // forDownload=true  → downloaded file (no red warnings; small neutral footer)
      // useLetterhead=true → skip clinic header block, add top spacer (~80mm)
      //                     for doctor to print on their letterhead
      const useLetterhead = !!consentUseLetterhead;
      const buildHtml = (langCode, forDownload = false) => {
        const T_ = (key) => tr(key, langCode);
        const isVern = langCode !== "en";
        const langLabel = CONSENT_LANGUAGES.find(l => l.code === langCode)?.label || "English";
        // Section numbering — if patient concern is present, section 6 is the concern
        // and everything after shifts +1. Use sec(n) to print the number for the Nth
        // base section (1-13 in the original numbering).
        const concernShift = hasConcern ? 1 : 0;
        const sec = (baseNum) => baseNum <= 5 ? baseNum : (baseNum + concernShift);

        // Margins: standard A4 doc has 25mm top/left/right, 20mm bottom.
        // When letterhead toggle is on, increase top to 75mm so the doctor's
        // pre-printed letterhead has room (typical letterhead height is 50-70mm).
        const topMargin = useLetterhead ? "75mm" : "25mm";
        const css = `
          @page { size: A4; margin: ${topMargin} 25mm 20mm 25mm; }
          body { font-family: 'Cambria', 'Georgia', serif; font-size: 11pt; line-height: 1.55; color: #222; margin: 0; padding: 0; }
          h1 { font-size: 16pt; text-align: center; margin: 4pt 0; }
          h2 { font-size: 12pt; margin: 14pt 0 6pt 0; padding-bottom: 3pt; border-bottom: 1px solid #888; }
          h3 { font-size: 11pt; margin: 10pt 0 4pt 0; }
          .clinic-header { display: table; width: 100%; margin-bottom: 8pt; }
          .clinic-left { display: table-cell; vertical-align: middle; }
          .clinic-right { display: table-cell; text-align: right; vertical-align: middle; font-size: 9pt; color: #555; }
          .clinic-name { font-size: 14pt; font-weight: bold; }
          .clinic-meta { font-size: 9pt; color: #555; }
          .letterhead-spacer { height: 60mm; border-bottom: 1px dotted #ccc; margin-bottom: 10pt; }
          .disclaimer { color: #c0392b; font-size: 9pt; font-style: italic; border: 1px solid #c0392b; padding: 8pt; margin-bottom: 14pt; background: #fff5f3; }
          .translation-notice { color: #856404; font-size: 9pt; border: 1px solid #ffc107; padding: 8pt; margin-bottom: 14pt; background: #fff8e1; }
          .field { margin: 4pt 0; }
          .underline { display: inline-block; min-width: 200pt; border-bottom: 1px solid #555; height: 12pt; }
          ul { margin: 4pt 0 6pt 24pt; padding: 0; }
          li { margin: 2pt 0; }
          .sig-row { display: table; width: 100%; margin-top: 20pt; }
          .sig-cell { display: table-cell; width: 50%; padding: 10pt; vertical-align: top; font-size: 10pt; }
          .sig-line { border-top: 1px solid #333; margin-top: 30pt; padding-top: 4pt; }
          .small { font-size: 9pt; color: #555; }
          .footer-disclaimer { color: #c0392b; font-size: 8pt; font-style: italic; text-align: center; margin-top: 30pt; padding-top: 6pt; border-top: 1px dashed #c0392b; }
          .footer-neutral { color: #888; font-size: 7.5pt; text-align: center; margin-top: 24pt; padding-top: 4pt; border-top: 1px solid #e0e0e0; }
        `;

        const translationNotice = isVern && T_("translation_notice")
          ? `<div class="translation-notice"><strong>📝</strong> ${safe(T_("translation_notice"))}</div>`
          : "";

        return `
<!DOCTYPE html>
<html lang="${langCode}" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" /><title>Consent — ${safe(procName)}${isVern ? ` (${langLabel})` : ""}</title><style>${css}</style></head>
<body>

${useLetterhead
  ? `<div class="letterhead-spacer">&nbsp;</div>`
  : `<div class="clinic-header">
  <div class="clinic-left">
    ${logoHtml}
    <div class="clinic-name">${safe(consentClinicName)}</div>
    ${consentClinicAddress ? `<div class="clinic-meta">${safe(consentClinicAddress)}</div>` : ""}
    ${consentClinicPhone ? `<div class="clinic-meta">Tel: ${safe(consentClinicPhone)}</div>` : ""}
  </div>
  <div class="clinic-right">
    ${T_("lbl_date")}: <span class="underline" style="min-width:80pt;">&nbsp;${safe(today)}&nbsp;</span>
  </div>
</div>`}

${translationNotice}

${forDownload ? "" : `<div class="disclaimer">
  <strong>IMPORTANT — TEMPLATE FOR EDUCATIONAL REFERENCE.</strong>
  This document was generated by an AI-assisted template tool and has NOT been reviewed by legal counsel.
  Verify with a qualified medical-legal advisor before clinical use. This red notice and the footer below are
  shown only in this preview — the downloaded file does NOT include them, so the patient will not see them.
</div>`}

<h1>${T_("title_main")} ${safe(procName.toUpperCase())}</h1>

<h2>1. ${T_("h_patient_info")}</h2>
<div class="field">${T_("lbl_name")}: ${fld(patientName, 280)}</div>
<div class="field">${T_("lbl_age")}: ${fld(patientAge, 60)} &nbsp;&nbsp; ${T_("lbl_sex")}: ${fld(patientSex, 60)} &nbsp;&nbsp; ${T_("lbl_patient_id")}: ${fld(patientId, 80)}</div>
<div class="field">${T_("lbl_address")}: <span class="underline" style="min-width:380pt;"></span></div>
<div class="field">${T_("lbl_mobile")}: ${fld(patientMobile, 120)} &nbsp;&nbsp; ${T_("lbl_email")}: <span class="underline" style="min-width:160pt;"></span></div>
<div class="field">${T_("lbl_diagnosis")}: <span class="underline" style="min-width:280pt;"></span></div>
<div class="field">${T_("lbl_procedure")}: <strong>${safe(procName)}</strong></div>
<div class="field">${T_("lbl_treatment_area")}: <span class="underline" style="min-width:300pt;"></span></div>

<h2>2. ${T_("h_procedure_desc")}</h2>
<p>${T_("informed_lang")}</p>
<p>${safe(description)}</p>
<p><strong>${T_("lbl_expected")}:</strong> ${safe(duration)}</p>

<h2>3. ${T_("h_risks")}</h2>
<p>${T_("no_guarantee")}</p>
<h3>${T_("common_risks")}</h3>
<ul>${commonRisks.map(r => `<li>${safe(r)}</li>`).join("")}</ul>
<h3>${T_("serious_risks")}</h3>
<ul>${seriousRisks.map(r => `<li>${safe(r)}</li>`).join("")}</ul>

<h2>4. ${T_("h_contra")}</h2>
<p>${T_("i_confirm_disclosed")}</p>
<ul>${contraindications.map(c => `<li>${safe(c)}</li>`).join("")}</ul>

<h2>5. ${T_("h_alternatives")}</h2>
<p>${T_("alternatives_text")}</p>

${hasConcern ? `<h2>6. ${T_("h_patient_concern")}</h2>
<p>${T_("patient_concern_intro")}</p>
<div style="border-left: 3px solid #c8a84e; padding: 6pt 10pt; background: #fdf8eb; font-style: italic; margin: 6pt 0;">${safe(patientConcern)}</div>` : ""}

<h2>${sec(6)}. ${T_("h_photo")}</h2>
<p>${T_("photo_consent")}</p>
<p>${T_("lbl_initial_here")} __________</p>

<h2>${sec(7)}. ${T_("h_dpdp")}</h2>
<p>For the purposes of the Digital Personal Data Protection Act, 2023, I acknowledge the following:</p>
<ul>
  <li><strong>Data Fiduciary:</strong> ${safe(consentClinicName)}${consentClinicAddress ? `, ${safe(consentClinicAddress)}` : ""}.</li>
  <li><strong>Purpose:</strong> My personal data and clinical information (including identifiers, medical history, photographs, and treatment records) are being collected solely for the purposes of (a) providing medical care, (b) maintaining clinical records as required by applicable law and medical council regulations, and (c) communication regarding my treatment and follow-up.</li>
  <li><strong>Retention:</strong> Records will be retained for the period required under applicable medical record-keeping rules, typically a minimum of three years from the date of last consultation, and longer where law or clinical prudence requires.</li>
  <li><strong>Sharing:</strong> My data will not be shared with third parties except (i) where required by law, regulatory authority, or court order; (ii) where necessary for emergency medical care; or (iii) where I have provided separate written consent for a specific disclosure.</li>
  <li><strong>My rights:</strong> I have the right to access my data, request correction of inaccuracies, and withdraw my consent for any non-essential use of my data (academic publication, anonymized teaching, etc.) at any time by writing to the data fiduciary at the address above.</li>
  <li><strong>Grievance:</strong> Concerns regarding the processing of my personal data may be raised in writing to the data fiduciary above, who shall respond within a reasonable period.</li>
</ul>

<h2>${sec(8)}. ${T_("h_cost")}</h2>
<p>I have been informed about the cost of the procedure, the number of sessions or treatment packages (if applicable), and the schedule of payment. I agree to the same.</p>

<h2>${sec(9)}. ${T_("h_aftercare")}</h2>
<p>I understand that strict adherence to pre- and post-procedure instructions is essential. The key aftercare instructions include:</p>
<ul>${aftercare.map(a => `<li>${safe(a)}</li>`).join("")}</ul>

<h2>${sec(10)}. ${T_("h_authorization")}</h2>
<p>I, ${fld(patientName, 260)}, having read and understood the contents of this consent form (translated where necessary into the language I best understand), and having had the opportunity to ask all relevant questions, voluntarily authorize <strong>Dr. ${safe(consentDoctorName)}</strong>${consentDoctorReg ? ` (Reg. No.: ${safe(consentDoctorReg)})` : ""} and his/her designated medical and support staff to perform the procedure of <strong>${safe(procName)}</strong> on me.</p>
<p>I authorize the treating doctor to administer any local, topical, or appropriate emergency treatment that may be required during the procedure for my safety.</p>
<p>I acknowledge that no guarantee has been made about the result of this procedure, and I release the treating doctor, the clinic, and their staff from any liability arising from outcomes that are within the recognized scope of risks disclosed above, provided due care and skill have been exercised.</p>

<h2>${sec(11)}. ${T_("h_withdraw")}</h2>
<p>${T_("withdraw_text")}</p>

<h2>${sec(12)}. ${T_("h_translation")}</h2>
<div class="field">${T_("lbl_translator")} &nbsp; ${T_("lbl_yes_no")}</div>
<div class="field">${T_("lbl_translator_name")}: <span class="underline" style="min-width:260pt;"></span></div>
<div class="field">${T_("lbl_relationship")}: <span class="underline" style="min-width:200pt;"></span></div>

<h2>${sec(13)}. ${T_("h_signatures")}</h2>

<div class="sig-row">
  <div class="sig-cell">
    <div class="sig-line">${T_("lbl_patient_sig")}</div>
    <div class="small">${T_("lbl_name")}: ${patientName ? safe(patientName) : "____________________________"}</div>
    <div class="small">${T_("lbl_date")}: ____________ &nbsp; Time: ____________</div>
  </div>
  <div class="sig-cell">
    <div class="sig-line">${T_("lbl_doctor_sig")}</div>
    <div class="small">${T_("lbl_name")}: Dr. ${safe(consentDoctorName)}</div>
    ${consentDoctorReg ? `<div class="small">Registration No.: ${safe(consentDoctorReg)}</div>` : ""}
    <div class="small">${T_("lbl_date")}: ____________ &nbsp; Time: ____________</div>
  </div>
</div>

<div class="sig-row">
  <div class="sig-cell">
    <div class="sig-line">${T_("lbl_witness")} 1</div>
    <div class="small">${T_("lbl_name")}: ____________________________</div>
    <div class="small">${T_("lbl_address")} / ${T_("lbl_relationship")}: ____________________________</div>
  </div>
  <div class="sig-cell">
    <div class="sig-line">${T_("lbl_witness")} 2</div>
    <div class="small">${T_("lbl_name")}: ____________________________</div>
    <div class="small">${T_("lbl_address")} / ${T_("lbl_relationship")}: ____________________________</div>
  </div>
</div>

${forDownload
  ? `<div class="footer-neutral">Template generated using SKINARIO — reviewed by treating practitioner before use.</div>`
  : `<div class="footer-disclaimer">
  This template was generated using SKINARIO's consent template tool as an educational starting point.
  It is NOT a substitute for legal advice. The treating practitioner is responsible for legal adequacy
  and clinical specificity. — Generated ${safe(today)}. <strong>(This red footer is preview-only and will NOT appear in the downloaded file.)</strong>
</div>`}

</body>
</html>`;
      };

      // Preview HTML (red warnings visible) — what's shown in the modal
      const englishHtmlPreview = buildHtml("en", false);
      const vernacularHtmlPreview = consentLanguage !== "en" ? buildHtml(consentLanguage, false) : null;
      // Download HTML (clean) — what gets saved to disk / printed
      const englishHtmlDownload = buildHtml("en", true);
      const vernacularHtmlDownload = consentLanguage !== "en" ? buildHtml(consentLanguage, true) : null;

      // Open preview modal — pass both versions:
      //   *Preview is shown in iframe (with red warnings as a doctor reminder)
      //   *Download uses the clean version (no red warnings, looks professional)
      setConsentPreview({
        englishHtml: englishHtmlPreview,
        vernacularHtml: vernacularHtmlPreview,
        englishHtmlDownload: englishHtmlDownload,
        vernacularHtmlDownload: vernacularHtmlDownload,
        langCode: consentLanguage,
        procName,
      });

      // Persist rate-limit state
      // Admins: don't track usage or consume credits (unlimited access by design)
      // Doctors: increment daily count; if over free limit, deduct one credit
      let newGenerations = prof.consentGenerations || {};
      let newCredits = credits;
      if (!isAdminUser) {
        newGenerations = { ...(prof.consentGenerations || {}), [todayKey]: todaysCount + 1 };
        if (todaysCount >= DAILY_FREE_LIMIT) newCredits = Math.max(0, credits - 1);
        await fbSet("users", au.uid, {
          consentGenerations: newGenerations,
          consentCredits: newCredits,
        });
        setProf((p) => ({ ...p, consentGenerations: newGenerations, consentCredits: newCredits }));
      }

      // Audit log
      try {
        const logId = `${au.uid}_${Date.now()}`;
        await fbSet("consentGenerationLog", logId, {
          uid: au.uid,
          email: au.email || "",
          name: prof.name || "",
          procedure: procName,
          category: consentCat || "(custom)",
          clinicName: consentClinicName,
          language: consentLanguage,
          isCustomProcedure: consentProc === "__custom__",
          usedCredit: !isAdminUser && todaysCount >= DAILY_FREE_LIMIT,
          isAdminGeneration: isAdminUser,
          createdAt: Date.now(),
        });
      } catch (logErr) {
        console.warn("consent log failed (non-fatal):", logErr);
      }

      sh("✅ Consent template ready — preview below");
      // Refresh history list so the new entry shows
      loadMyConsentHistory();
    } catch (err) {
      console.error("consent generation failed:", err);
      sh("❌ Generation failed: " + (err.message || "unknown error"));
    } finally {
      setConsentGenerating(false);
    }
  };


  const submitAnswer=async(qid,qObj,idx)=>{
    if(!au)return;
    const ok=idx===qObj.ci;
    const answers={...(qObj.answers||{}),[au.uid]:idx};
    const writeOk=await fbSet("quizzes",qid,{answers});
    if(!writeOk){
      // Write failed — Firestore rules or network issue.
      // Don't award points or update streak since the answer wasn't persisted.
      sh("❌ Could not save your answer. Check your connection and try again.");
      return;
    }
    // ═══ SAME-DAY POINTS RULE ═══
    // Points are only awarded if the user answers ON THE DAY the quiz was published.
    // Back-answering old quizzes is allowed (educational value), but no points.
    // qObj.date is the publish date in YYYY-MM-DD IST format.
    const todayKey=todayIST_YMD();
    const isSameDay=qObj.date===todayKey;
    // ═══ DIFFICULTY-WEIGHTED POINTS ═══
    let pointsEarned=0;
    if(ok&&isSameDay){
      pointsEarned=qObj.diff==="Hard"?30:qObj.diff==="Moderate"?20:10;
    }
    // SAFETY: read fresh user doc from Firestore before computing newTotal.
    // Prevents stale-state wipes if prof.points was temporarily 0 in memory.
    let basePoints=prof.points||0;
    let baseMonthly=prof.monthlyPoints||{};
    let baseAnswered=prof.totalAnswered||0;
    let baseCorrect=prof.totalCorrect||0;
    let baseStreak=prof.streak||0;
    try{
      const fresh=await fbGet("users",au.uid);
      if(fresh){
        basePoints=fresh.points||0;
        baseMonthly=fresh.monthlyPoints||{};
        baseAnswered=fresh.totalAnswered||0;
        baseCorrect=fresh.totalCorrect||0;
        baseStreak=fresh.streak||0;
      }
    }catch(err){console.error("fresh read failed, using local state:",err)}
    // ─── STREAK LOGIC ────────────────────────────────────────────────────────
    // Rules:
    //   1. Correct answer on today's quiz → streak +1
    //   2. Wrong answer on today's quiz  → streak stays (no increment, no reset)
    //   3. Sunday is a rest day — if today is Monday and doctor answers correctly,
    //      the streak is NOT penalised for the Sunday gap (we skip Sunday in the chain)
    //   4. Back-answering old quizzes → streak unchanged
    //
    // We DO NOT auto-decrement streak on missed days (no daily cron).
    // Streak is only ever written here, so it reflects consecutive answer days.
    const newStreak = (ok && isSameDay) ? baseStreak + 1 : baseStreak;
    // Streak bonus: +50 every 7 days of correct answers
    let streakBonus = 0;
    if (ok && isSameDay && newStreak > 0 && newStreak % 7 === 0) { streakBonus = 50; }
    const totalEarned=pointsEarned+streakBonus;
    const monthKey=todayIST_YMD().slice(0,7);
    const curMonthly=baseMonthly[monthKey]||0;
    const upd={
      totalAnswered:baseAnswered+1,
      totalCorrect:baseCorrect+(ok?1:0),
      streak:newStreak,
      points:basePoints+totalEarned,
      monthlyPoints:{...baseMonthly,[monthKey]:curMonthly+totalEarned},
    };
    await fbSet("users",au.uid,upd);
    setProf(p=>({...p,...upd}));
    setQuizzes(p=>p.map(q=>q.id===qid?{...q,answers}:q));
    // ═══ LEDGER: log this quiz point grant to pointsActivity ═══
    // Enables earning history + future monthly leaderboards.
    // Unique docId per user+quiz so re-renders never double-log.
    if(totalEarned>0){
      try{
        const date=todayIST_YMD();
        const ledgerId=`${au.uid}_quiz_${qid}`;
        await fbSet("pointsActivity",ledgerId,{
          uid:au.uid,
          date,
          action:"quiz_correct",
          label:`Quiz: ${(qObj.q||"question").slice(0,50)}`,
          pointsEarned:totalEarned,
          quizId:qid,
          difficulty:qObj.diff||"Easy",
          streakBonus,
          createdAt:Date.now(),
        });
        // Refresh this user's ledger in local state
        loadMyLedger();
      }catch(err){console.error("ledger log error:",err)}
    }
    // ═══ REFERRAL: mark THIS user as having completed their qualifying first quiz ═══
    // (Points go to the REFERRER, but Firestore rules don't allow writing another
    // user's doc — so we just flag readiness here; the referrer's own client pays
    // itself the bonus next time they load their profile. See checkReferralPayouts().)
    if(ok&&prof.referredBy&&!prof.referralBonusPaid&&baseCorrect===0){
      try{
        await fbSet("users",au.uid,{referralBonusPaid:true,referralQualifiedAt:Date.now()});
        setProf(p=>({...p,referralBonusPaid:true,referralQualifiedAt:Date.now()}));
      }catch(refErr){console.error("referral qualification flag failed:",refErr)}
    }
    if(ok){
      if(!isSameDay){sh(`🎉 Correct! (No points — this quiz was from ${qObj.date}; only today's quiz earns points)`)}
      else if(streakBonus>0){sh(`🎉 Correct! +${pointsEarned} points • 🔥 ${newStreak}-day streak bonus +${streakBonus}!`)}
      else{sh(`🎉 Correct! +${pointsEarned} points`)}
    }else{
      if(!isSameDay){sh(`Answer recorded. (No points — this quiz was from ${qObj.date}; only today's quiz earns points)`)}
      else{sh("Answer recorded. Try again tomorrow!")}
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
  const postForum=async()=>{
    if(!fpT.trim())return;
    // Extract images from blocks for backward-compat (card preview, lightbox)
    const images=fpBlocks.filter(b=>b.type==="image"&&b.url).map(b=>b.url);
    // Build plain-text body for search/preview from text blocks
    const body=fpBlocks.filter(b=>b.type==="text"||b.type==="heading").map(b=>b.content||"").join("\n\n");
    await fbAdd("forum",{author:uName,ini:uIni,uid:au.uid,photo:uPhoto||"",title:fpT,cat:fpC,body,blocks:fpBlocks,images,likedBy:[],likes:0,replies:0,date:ds(getIST())});
    setFpT("");setFpBlocks([]);setNewForum(false);sh("Posted!");loadData();
    await awardPoints("forum_post");
  };

  // ═══ CLINICAL CASE POST ═══
  const postCase=async()=>{if(!ccT.trim()){sh("Title required");return}if(!ccImgs.length){sh("Add at least 1 image");return}await fbAdd("cases",{author:uName,ini:uIni,uid:au.uid,photo:uPhoto||"",title:ccT,cat:ccC,body:ccB,history:ccHistory,treatment:ccTreatment,outcome:ccOutcome,diagnosis:ccDiag,images:ccImgs,likedBy:[],likes:0,comments:[],date:ds(getIST())});setCcT("");setCcB("");setCcImgs([]);setCcDiag("");setCcHistory("");setCcTreatment("");setCcOutcome("");setNewCase(false);sh("Case posted!");loadData();await awardPoints("case_post")};

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
  // ═══ LEADERBOARD EXCLUSIONS ═══
  // Admins and (future) moderators earn points normally but don't appear on
  // the public leaderboard or Rising Stars. This keeps the ranking fair and
  // credible for actual community members.
  // To add moderators later: extend this function to check a `role` field
  // (e.g. u.role==="moderator") or a `hideFromLeaderboard` flag on the user doc.
  const isExcludedFromLeaderboard=(u)=>{
    if(!u||!u.email)return false;
    if(ADMINS.includes(u.email))return true;
    if(u.role==="moderator")return true; // future support — harmless until you set role on a user
    if(u.hideFromLeaderboard===true)return true; // future support for ad-hoc exclusions
    return false;
  };
  const leaderboard=allUsers
    .filter(u=>!isExcludedFromLeaderboard(u))
    // Qualify if EITHER answered 5+ quizzes (quiz-focused users)
    // OR earned 50+ points through any means (community contributors).
    // This way action-only users (forum/cases/shares) appear too.
    .filter(u=>(u.totalAnswered||0)>=MIN_Q_FOR_RANK||(u.points||0)>=50)
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
    .filter(u=>!isExcludedFromLeaderboard(u))
    .filter(u=>(u.totalAnswered||0)>0&&(u.totalAnswered||0)<MIN_Q_FOR_RANK)
    .sort((a,b)=>(b.totalAnswered||0)-(a.totalAnswered||0));

  // ═══ MONTHLY LEADERBOARD ═══
  // Reads user.monthlyPoints[month] (written on each point grant + backfill).
  // Available months = union of all months present across users, newest first.
  const availableMonths=(()=>{
    const set=new Set();
    allUsers.forEach(u=>{if(u.monthlyPoints)Object.keys(u.monthlyPoints).forEach(m=>set.add(m))});
    set.add(todayIST_YMD().slice(0,7)); // always include current month
    return Array.from(set).sort().reverse();
  })();
  const monthlyLeaderboard=allUsers
    .filter(u=>!isExcludedFromLeaderboard(u))
    .map(u=>({...u,monthScore:(u.monthlyPoints||{})[rankMonth]||0}))
    .filter(u=>u.monthScore>0)
    .sort((a,b)=>b.monthScore-a.monthScore)
    .slice(0,20);
  const monthLabel=(m)=>{try{const[y,mo]=m.split("-");return new Date(y,mo-1).toLocaleDateString("en-US",{month:"long",year:"numeric"})}catch{return m}};

  const W="1400px";const dates=Array.from({length:14},(_,i)=>{let d=new Date(getIST());d.setDate(d.getDate()-(13-i));return ds(d)});
  const qObj=quizzes.find(q=>q.date===selD);const uA=qObj?.answers?.[au?.uid];const isT=selD===today;const rev=!isT||hr>=21;const dd=Math.floor((new Date(today)-new Date(selD))/864e5);const canA=uA===undefined&&(isT||(dd<=3&&dd>0));
  // ═══ Quiz view tracking — once per quiz per session ═══
  useEffect(()=>{
    if(!qObj||!au)return;
    if(qObj.uid===au.uid)return; // don't count owner
    const k=`sk_qv_${qObj.id}`;
    if(sessionStorage.getItem(k))return;
    sessionStorage.setItem(k,"1");
    const newCount=(qObj.views||0)+1;
    fbSet("quizzes",qObj.id,{views:newCount}).catch(()=>{});
    setQuizzes(prev=>prev.map(x=>x.id===qObj.id?{...x,views:newCount}:x));
  },[qObj?.id,au?.uid]);

  if(scr==="loading")return(<div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui"}}><div style={{textAlign:"center"}}><Logo size={60}/><p style={{color:T.mute,marginTop:12}}>Loading...</p></div></div>);

  // ═══ WELCOME SCREEN (shown once before landing — fits screen, click anywhere to enter) ═══
  if((scr==="login"||scr==="landing")&&!welcomeSeen)return(
    <div onClick={()=>{localStorage.setItem("sk_welcome","1");setWelcomeSeen(true)}} style={{height:"100vh",width:"100vw",background:"#f5ede2",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontFamily:"system-ui",overflow:"hidden",position:"relative"}} title="Click to enter">
      <picture style={{display:"flex",alignItems:"center",justifyContent:"center",width:"100%",height:"100%"}}>
        <source media="(max-width: 768px)" srcSet="/welcome-mobile.png"/>
        <img src="/welcome-desktop.png" alt="Welcome to SKINARIO — click to enter" style={{maxWidth:"100%",maxHeight:"100%",width:"auto",height:"auto",objectFit:"contain",display:"block"}}/>
      </picture>
      <div style={{position:"absolute",bottom:24,right:24,background:"rgba(74,31,61,0.92)",color:"#fff",padding:"10px 22px",borderRadius:999,fontSize:".85rem",fontWeight:600,zIndex:5,pointerEvents:"none",boxShadow:"0 4px 14px rgba(0,0,0,0.2)"}}>👆 Click anywhere to enter</div>
    </div>
  );

  // ═══ PUBLIC LANDING PAGE (SKINARIO Brand: cream / burgundy / gold) ═══
  // Hero pattern: text-left + doctor-image-right (matches brand poster style).
  // Place a 1600x1000 PNG named "landing-hero.png" in public/ (with the doctor + phone mockup).
  // If not present, image gracefully fails and section still works on text-only side.
  if(scr==="landing")return(
    <div style={{minHeight:"100vh",fontFamily:"system-ui",color:"#3a2333",background:"#faf3e7"}}>

      {/* ═══ TOP NAV ═══ */}
      <div style={{position:"sticky",top:0,zIndex:50,background:"rgba(250,243,231,0.92)",backdropFilter:"blur(10px)",borderBottom:"1px solid rgba(200,168,78,0.2)"}}>
        <div style={{maxWidth:1240,margin:"0 auto",padding:"14px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <Logo size={42}/>
            <div>
              <div style={{fontSize:"1.1rem",fontWeight:300,letterSpacing:4,fontFamily:"Georgia,serif",color:"#4a1f3d"}}>SKINARIO</div>
              <div style={{fontSize:".55rem",color:"#c8a84e",letterSpacing:3,textTransform:"uppercase",fontWeight:700,marginTop:2}}>Professional Aesthetic Community</div>
            </div>
          </div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <button onClick={()=>setScr("login")} style={{background:"transparent",border:"1px solid rgba(74,31,61,0.3)",color:"#4a1f3d",fontSize:".82rem",cursor:"pointer",padding:"9px 20px",fontWeight:600,fontFamily:"inherit",borderRadius:999,letterSpacing:.5}}>Sign in</button>
            <button onClick={()=>{setAuthMode("signup");setScr("login")}} style={{background:"#4a1f3d",border:"1px solid #4a1f3d",color:"#f5ede2",fontSize:".82rem",cursor:"pointer",padding:"9px 22px",fontWeight:700,fontFamily:"inherit",borderRadius:999,letterSpacing:.5,boxShadow:"0 2px 10px rgba(74,31,61,0.15)"}}>Join free</button>
          </div>
        </div>
      </div>

      {/* ═══ HERO — text left, doctor image right (matches brand poster) ═══ */}
      <section style={{position:"relative",overflow:"hidden",background:"linear-gradient(135deg,#faf3e7 0%,#f5ede2 50%,#faecda 100%)"}}>
        {/* Decorative gold arc behind doctor image */}
        <svg viewBox="0 0 600 600" style={{position:"absolute",right:"-10%",top:"5%",width:"55%",maxWidth:700,opacity:0.18,pointerEvents:"none"}}>
          <path d="M 300 30 Q 530 30 530 300 Q 530 570 300 570" fill="none" stroke="#c8a84e" strokeWidth="2"/>
          <path d="M 300 80 Q 480 80 480 300 Q 480 520 300 520" fill="none" stroke="#c8a84e" strokeWidth="1.5"/>
        </svg>

        {/* Subtle botanical / molecular pattern on left */}
        <svg viewBox="0 0 200 200" style={{position:"absolute",left:"-5%",top:"15%",width:"15%",opacity:0.15,pointerEvents:"none"}}>
          <circle cx="50" cy="50" r="3" fill="#c8a84e"/>
          <circle cx="100" cy="100" r="3" fill="#c8a84e"/>
          <circle cx="150" cy="150" r="3" fill="#c8a84e"/>
          <circle cx="100" cy="40" r="3" fill="#c8a84e"/>
          <circle cx="40" cy="120" r="3" fill="#c8a84e"/>
          <line x1="50" y1="50" x2="100" y2="100" stroke="#c8a84e" strokeWidth="1"/>
          <line x1="100" y1="100" x2="150" y2="150" stroke="#c8a84e" strokeWidth="1"/>
          <line x1="100" y1="40" x2="100" y2="100" stroke="#c8a84e" strokeWidth="1"/>
          <line x1="40" y1="120" x2="100" y2="100" stroke="#c8a84e" strokeWidth="1"/>
        </svg>

        <div style={{maxWidth:1240,margin:"0 auto",padding:"40px 28px 60px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:40,alignItems:"center",position:"relative",zIndex:2}} className="hero-grid">

          {/* LEFT — Text content */}
          <div style={{paddingTop:30,paddingBottom:30}}>
            <FadeIn>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
                <div style={{height:1,width:36,background:"#c8a84e"}}/>
                <span style={{fontSize:".7rem",color:"#c8a84e",letterSpacing:3,textTransform:"uppercase",fontWeight:700}}>For verified doctors</span>
              </div>
            </FadeIn>

            <FadeIn delay={100}>
              <h1 style={{fontSize:"clamp(2.4rem, 5vw, 4rem)",fontWeight:300,fontFamily:"Georgia,serif",margin:0,marginBottom:12,lineHeight:1.05}}>
                <span style={{color:"#4a1f3d"}}>Welcome to</span><br/>
                <span style={{color:"#4a1f3d",letterSpacing:4,fontWeight:400}}>SKINARIO</span>
              </h1>
            </FadeIn>

            <FadeIn delay={200}>
              <div style={{height:1,width:80,background:"#c8a84e",margin:"22px 0 22px"}}/>
            </FadeIn>

            <FadeIn delay={250}>
              <p style={{fontSize:"clamp(1rem, 1.6vw, 1.2rem)",color:"#5a3a4d",lineHeight:1.65,marginBottom:18,fontWeight:400}}>
                Your professional space to <b style={{color:"#4a1f3d"}}>learn, grow, and connect</b> with aesthetic experts across India.
              </p>
            </FadeIn>

            <FadeIn delay={350}>
              <p style={{fontSize:".95rem",color:"#7a5a6d",lineHeight:1.7,marginBottom:24}}>
                Daily clinical quizzes, peer case discussions, expert articles, video masterclasses & a vibrant community of aesthetic medicine professionals.
              </p>
            </FadeIn>

            <FadeIn delay={450}>
              <div style={{display:"flex",alignItems:"center",gap:18,marginBottom:32,flexWrap:"wrap"}}>
                {["Learn","Evolve","Connect","Lead"].map((w,i)=>(
                  <div key={w} style={{display:"flex",alignItems:"center",gap:18}}>
                    <span style={{fontSize:".78rem",color:"#c8a84e",letterSpacing:3,textTransform:"uppercase",fontWeight:700}}>{w}</span>
                    {i<3&&<span style={{width:5,height:5,borderRadius:"50%",background:"#c8a84e"}}/>}
                  </div>
                ))}
              </div>
            </FadeIn>

            <FadeIn delay={550}>
              <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"center"}}>
                <button onClick={()=>{setAuthMode("signup");setScr("login")}} style={{background:"#4a1f3d",color:"#f5ede2",border:"none",padding:"15px 34px",fontSize:".95rem",fontWeight:700,letterSpacing:1.5,cursor:"pointer",fontFamily:"inherit",borderRadius:999,transition:"all .25s",display:"flex",alignItems:"center",gap:10,boxShadow:"0 4px 20px rgba(74,31,61,0.2)"}} onMouseEnter={e=>{e.currentTarget.style.background="#5a2347";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 28px rgba(74,31,61,0.3)"}} onMouseLeave={e=>{e.currentTarget.style.background="#4a1f3d";e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 4px 20px rgba(74,31,61,0.2)"}}>GET STARTED <span style={{fontSize:"1.1rem"}}>→</span></button>
                <div style={{fontSize:".78rem",color:"#7a5a6d",lineHeight:1.5}}>Elevate your practice.<br/>Empower your patients.</div>
              </div>
            </FadeIn>
          </div>

          {/* RIGHT — Hero image (doctor + phone mockup) */}
          <FadeIn delay={300}>
            <div style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center",minHeight:520}}>
              {/* Image with graceful fallback to elegant SVG illustration */}
              <img src="/landing-hero.png" alt="SKINARIO — Aesthetic medicine community" id="sk-hero-img"
                style={{maxWidth:"100%",height:"auto",maxHeight:600,objectFit:"contain",filter:"drop-shadow(0 20px 40px rgba(74,31,61,0.15))",position:"relative",zIndex:2}}
                onLoad={e=>{const ph=document.getElementById("sk-hero-fallback");if(ph)ph.style.display="none"}}
                onError={e=>{e.currentTarget.style.display="none";const ph=document.getElementById("sk-hero-fallback");if(ph)ph.style.display="flex"}}
              />
              {/* Elegant SVG fallback — shown if landing-hero.png is missing */}
              <div id="sk-hero-fallback" style={{display:"none",position:"absolute",inset:0,alignItems:"center",justifyContent:"center",flexDirection:"column",gap:30}}>
                {/* Decorative concentric circles with gradient */}
                <svg viewBox="0 0 400 400" style={{width:"75%",maxWidth:400,height:"auto",filter:"drop-shadow(0 12px 30px rgba(74,31,61,0.1))"}}>
                  <defs>
                    <radialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#c8a84e" stopOpacity="0.15"/>
                      <stop offset="70%" stopColor="#c8a84e" stopOpacity="0.05"/>
                      <stop offset="100%" stopColor="#c8a84e" stopOpacity="0"/>
                    </radialGradient>
                    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#d4b558"/>
                      <stop offset="50%" stopColor="#c8a84e"/>
                      <stop offset="100%" stopColor="#a88a3a"/>
                    </linearGradient>
                  </defs>
                  {/* Glow background */}
                  <circle cx="200" cy="200" r="190" fill="url(#ringGlow)"/>
                  {/* Outer decorative rings */}
                  <circle cx="200" cy="200" r="170" fill="none" stroke="url(#goldGrad)" strokeWidth="1.5" opacity="0.6"/>
                  <circle cx="200" cy="200" r="155" fill="none" stroke="url(#goldGrad)" strokeWidth="1" opacity="0.4"/>
                  <circle cx="200" cy="200" r="140" fill="none" stroke="url(#goldGrad)" strokeWidth="0.75" opacity="0.25"/>
                  {/* Central card — phone mockup style */}
                  <rect x="135" y="100" width="130" height="220" rx="18" fill="#4a1f3d" stroke="url(#goldGrad)" strokeWidth="2"/>
                  <rect x="142" y="120" width="116" height="180" rx="6" fill="#faf3e7"/>
                  {/* Inside phone — abstract content rows */}
                  <text x="200" y="142" textAnchor="middle" fontSize="9" fill="#4a1f3d" fontFamily="Georgia,serif" fontWeight="600">SKINARIO</text>
                  <line x1="155" y1="150" x2="245" y2="150" stroke="#c8a84e" strokeWidth="0.5" opacity="0.5"/>
                  {/* Quiz card preview */}
                  <rect x="152" y="160" width="96" height="38" rx="4" fill="#fff" stroke="#c8a84e" strokeWidth="0.5"/>
                  <rect x="158" y="166" width="32" height="3" rx="1" fill="#c8a84e"/>
                  <rect x="158" y="174" width="60" height="2.5" rx="1" fill="#4a1f3d"/>
                  <rect x="158" y="180" width="48" height="2.5" rx="1" fill="#4a1f3d" opacity="0.6"/>
                  <rect x="218" y="174" width="20" height="14" rx="2" fill="#4a1f3d"/>
                  {/* Article card preview */}
                  <rect x="152" y="206" width="96" height="38" rx="4" fill="#fff" stroke="#c8a84e" strokeWidth="0.5"/>
                  <rect x="158" y="212" width="40" height="3" rx="1" fill="#c8a84e"/>
                  <rect x="158" y="220" width="56" height="2.5" rx="1" fill="#4a1f3d"/>
                  <rect x="158" y="226" width="44" height="2.5" rx="1" fill="#4a1f3d" opacity="0.6"/>
                  <rect x="218" y="220" width="20" height="14" rx="2" fill="#c8a84e" opacity="0.3"/>
                  {/* Masterclass card preview */}
                  <rect x="152" y="252" width="96" height="38" rx="4" fill="#fff" stroke="#c8a84e" strokeWidth="0.5"/>
                  <rect x="158" y="258" width="50" height="3" rx="1" fill="#c8a84e"/>
                  <rect x="158" y="266" width="62" height="2.5" rx="1" fill="#4a1f3d"/>
                  <rect x="158" y="272" width="36" height="2.5" rx="1" fill="#4a1f3d" opacity="0.6"/>
                  <rect x="218" y="266" width="20" height="14" rx="2" fill="#4a1f3d" opacity="0.4"/>
                  {/* Decorative orbiting dots */}
                  <circle cx="200" cy="30" r="4" fill="url(#goldGrad)"/>
                  <circle cx="370" cy="200" r="4" fill="url(#goldGrad)"/>
                  <circle cx="200" cy="370" r="4" fill="url(#goldGrad)"/>
                  <circle cx="30" cy="200" r="4" fill="url(#goldGrad)"/>
                  <circle cx="320" cy="80" r="2.5" fill="#c8a84e" opacity="0.6"/>
                  <circle cx="80" cy="320" r="2.5" fill="#c8a84e" opacity="0.6"/>
                  <circle cx="320" cy="320" r="2.5" fill="#c8a84e" opacity="0.6"/>
                  <circle cx="80" cy="80" r="2.5" fill="#c8a84e" opacity="0.6"/>
                </svg>
                <div style={{textAlign:"center",maxWidth:280}}>
                  <div style={{fontSize:".68rem",color:"#c8a84e",letterSpacing:3,textTransform:"uppercase",fontWeight:700,marginBottom:8}}>Premium · Curated · Trusted</div>
                  <div style={{fontSize:".78rem",color:"#7a5a6d",lineHeight:1.6,fontStyle:"italic"}}>A space designed for aesthetic medicine professionals.</div>
                </div>
              </div>
              {/* Trust badge — always shown, sits over either image or fallback */}
              <div style={{position:"absolute",bottom:30,right:0,background:"#4a1f3d",color:"#f5ede2",padding:"14px 20px",borderRadius:"50%",width:120,height:120,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",boxShadow:"0 8px 24px rgba(74,31,61,0.25)",border:"2px solid #c8a84e",zIndex:3}}>
                <div>
                  <div style={{fontSize:"1.2rem",marginBottom:4}}>✓</div>
                  <div style={{fontSize:".68rem",fontWeight:700,letterSpacing:1,lineHeight:1.3}}>Trusted.<br/>Curated.<br/>For Doctors.</div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>

        {/* Features row — 5 icon cards at bottom of hero (matches Image 3) */}
        <div style={{maxWidth:1240,margin:"0 auto",padding:"0 28px 40px",position:"relative",zIndex:2}}>
          <FadeIn delay={650}>
            <div style={{background:"rgba(255,255,255,0.7)",backdropFilter:"blur(8px)",borderRadius:16,padding:"24px 20px",border:"1px solid rgba(200,168,78,0.25)",boxShadow:"0 4px 24px rgba(74,31,61,0.06)"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:16}}>
                {[
                  {icon:"🧠",title:"Daily Quizzes",desc:"Sharpen your clinical knowledge daily"},
                  {icon:"📰",title:"Expert Articles",desc:"Evidence-based insights from industry experts"},
                  {icon:"📚",title:"Resources",desc:"Curated content for your practice"},
                  {icon:"🎥",title:"Video Masterclasses",desc:"Learn from world-class aesthetic experts"},
                  {icon:"💬",title:"Vibrant Community",desc:"Connect, discuss & grow with peers"},
                ].map((f,i)=>(
                  <div key={i} style={{textAlign:"center",padding:"6px 4px"}}>
                    <div style={{fontSize:"1.8rem",marginBottom:8,filter:"sepia(0.3)"}}>{f.icon}</div>
                    <div style={{fontSize:".68rem",fontWeight:700,color:"#4a1f3d",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{f.title}</div>
                    <div style={{fontSize:".74rem",color:"#7a5a6d",lineHeight:1.5}}>{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section style={{background:"#4a1f3d",padding:"50px 28px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#c8a84e,transparent)"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#c8a84e,transparent)"}}/>
        <div style={{maxWidth:1100,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:30,textAlign:"center",position:"relative"}}>
          <FadeIn>
            <div>
              <div style={{fontSize:"2.6rem",fontFamily:"Georgia,serif",color:"#c8a84e",fontWeight:300,marginBottom:6}}><CountUp to={100} suffix="+"/></div>
              <div style={{fontSize:".7rem",color:"rgba(245,237,226,0.75)",letterSpacing:2,textTransform:"uppercase",fontWeight:600}}>Verified Doctors</div>
            </div>
          </FadeIn>
          <FadeIn delay={150}>
            <div>
              <div style={{fontSize:"2.6rem",fontFamily:"Georgia,serif",color:"#c8a84e",fontWeight:300,marginBottom:6}}><CountUp to={14}/></div>
              <div style={{fontSize:".7rem",color:"rgba(245,237,226,0.75)",letterSpacing:2,textTransform:"uppercase",fontWeight:600}}>Clinical Topics</div>
            </div>
          </FadeIn>
          <FadeIn delay={300}>
            <div>
              <div style={{fontSize:"2.6rem",fontFamily:"Georgia,serif",color:"#c8a84e",fontWeight:300,marginBottom:6}}><CountUp to={365}/></div>
              <div style={{fontSize:".7rem",color:"rgba(245,237,226,0.75)",letterSpacing:2,textTransform:"uppercase",fontWeight:600}}>Days of Daily Quizzes</div>
            </div>
          </FadeIn>
          <FadeIn delay={450}>
            <div>
              <div style={{fontSize:"2.6rem",fontFamily:"Georgia,serif",color:"#c8a84e",fontWeight:300,marginBottom:6}}>∞</div>
              <div style={{fontSize:".7rem",color:"rgba(245,237,226,0.75)",letterSpacing:2,textTransform:"uppercase",fontWeight:600}}>Peer Knowledge</div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ THE SKINARIO DIFFERENCE — editorial 3 columns ═══ */}
      <section style={{background:"#faf3e7",padding:"90px 28px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <FadeIn>
            <div style={{textAlign:"center",marginBottom:60}}>
              <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:16}}>
                <div style={{height:1,width:30,background:"#c8a84e"}}/>
                <span style={{fontSize:".7rem",color:"#c8a84e",letterSpacing:3,textTransform:"uppercase",fontWeight:700}}>Why SKINARIO</span>
                <div style={{height:1,width:30,background:"#c8a84e"}}/>
              </div>
              <h2 style={{fontSize:"clamp(1.8rem, 3.5vw, 2.6rem)",fontFamily:"Georgia,serif",fontWeight:300,margin:0,color:"#4a1f3d",lineHeight:1.3}}>Built by doctors. For the doctors<br/>shaping aesthetics.</h2>
            </div>
          </FadeIn>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:40}}>
            {[
              {num:"01",title:"Sharpen Your Clinical Edge",desc:"Daily AI-curated quizzes across Botox, fillers, threads, lasers, PDRN and more. Earn points, climb tiers, build a streak.",icon:"🧠"},
              {num:"02",title:"Real Cases, Real Peers",desc:"Share challenging aesthetic cases with verified doctors. Get clinical input from peers across India. Anonymous, peer-reviewed, evidence-based.",icon:"💬"},
              {num:"03",title:"Stay Ahead of the Field",desc:"PubMed research, FDA alerts, clinical trials, industry news — curated for aesthetic medicine. One feed, all sources.",icon:"🔬"},
            ].map((item,i)=>(
              <FadeIn key={i} delay={i*150}>
                <div style={{background:"#fff",padding:"32px 28px",borderRadius:14,border:"1px solid rgba(200,168,78,0.25)",height:"100%",position:"relative",transition:"all .3s",boxShadow:"0 2px 16px rgba(74,31,61,0.04)"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 12px 30px rgba(74,31,61,0.1)";e.currentTarget.style.borderColor="rgba(200,168,78,0.5)"}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 2px 16px rgba(74,31,61,0.04)";e.currentTarget.style.borderColor="rgba(200,168,78,0.25)"}}>
                  <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:16}}>
                    <div style={{fontSize:"3rem",fontFamily:"Georgia,serif",color:"#c8a84e",fontWeight:300,lineHeight:1}}>{item.num}</div>
                    <div style={{fontSize:"1.8rem",filter:"sepia(0.4)"}}>{item.icon}</div>
                  </div>
                  <h3 style={{fontSize:"1.25rem",fontFamily:"Georgia,serif",fontWeight:500,margin:0,marginBottom:12,color:"#4a1f3d"}}>{item.title}</h3>
                  <p style={{fontSize:".88rem",color:"#7a5a6d",lineHeight:1.7,margin:0}}>{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ QUIZ PREVIEW — burgundy card on cream ═══ */}
      <section style={{background:"linear-gradient(180deg,#faf3e7,#f5ede2)",padding:"90px 28px"}}>
        <div style={{maxWidth:760,margin:"0 auto"}}>
          <FadeIn>
            <div style={{textAlign:"center",marginBottom:40}}>
              <div style={{fontSize:".7rem",color:"#c8a84e",letterSpacing:3,textTransform:"uppercase",fontWeight:700,marginBottom:12}}>Today's Clinical Quiz</div>
              <h2 style={{fontSize:"clamp(1.6rem, 3vw, 2.2rem)",fontFamily:"Georgia,serif",fontWeight:300,margin:0,color:"#4a1f3d"}}>A real question from our community</h2>
              <div style={{height:1,width:60,background:"#c8a84e",margin:"20px auto 0"}}/>
            </div>
          </FadeIn>

          {publicQuizLoading&&<div style={{textAlign:"center",padding:60,color:"#888"}}>Loading today's quiz...</div>}

          {publicQuiz&&<FadeIn>
            <div style={{background:"#4a1f3d",borderRadius:14,padding:"36px 32px",position:"relative",overflow:"hidden",boxShadow:"0 12px 40px rgba(74,31,61,0.18)"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#c8a84e,#d4b558,#c8a84e)"}}/>
              <div style={{display:"flex",gap:10,marginBottom:22,flexWrap:"wrap"}}>
                {publicQuiz.cat&&<span style={{padding:"4px 12px",border:"1px solid rgba(200,168,78,0.5)",borderRadius:999,fontSize:".7rem",color:"#c8a84e",letterSpacing:1.5,textTransform:"uppercase",fontWeight:600}}>{publicQuiz.cat}</span>}
                {publicQuiz.diff&&<span style={{padding:"4px 12px",border:"1px solid rgba(245,237,226,0.25)",borderRadius:999,fontSize:".7rem",color:"rgba(245,237,226,0.7)",letterSpacing:1.5,textTransform:"uppercase",fontWeight:600}}>{publicQuiz.diff}</span>}
              </div>
              <h3 style={{fontSize:"clamp(1.1rem, 2vw, 1.35rem)",fontFamily:"Georgia,serif",fontWeight:400,color:"#f5ede2",lineHeight:1.55,marginBottom:24,margin:0}}>{publicQuiz.question||publicQuiz.q}</h3>
              <div style={{display:"flex",flexDirection:"column",gap:9,marginTop:24,marginBottom:28}}>
                {(publicQuiz.options||publicQuiz.opts||[]).map((opt,i)=>(
                  <div key={i} onClick={()=>{setAuthMode("signup");setScr("login")}} style={{padding:"14px 18px",borderRadius:8,border:"1px solid rgba(245,237,226,0.15)",background:"rgba(245,237,226,0.04)",cursor:"pointer",fontSize:".9rem",color:"rgba(245,237,226,0.9)",transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="#c8a84e";e.currentTarget.style.background="rgba(200,168,78,0.12)";e.currentTarget.style.transform="translateX(4px)"}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(245,237,226,0.15)";e.currentTarget.style.background="rgba(245,237,226,0.04)";e.currentTarget.style.transform="translateX(0)"}}>
                    <span style={{color:"#c8a84e",fontWeight:700,marginRight:14,fontFamily:"Georgia,serif"}}>{String.fromCharCode(65+i)}</span>{opt}
                  </div>
                ))}
              </div>
              <div style={{textAlign:"center",paddingTop:22,borderTop:"1px solid rgba(245,237,226,0.1)"}}>
                <div style={{fontSize:".78rem",color:"#c8a84e",letterSpacing:2,textTransform:"uppercase",fontWeight:700,marginBottom:14}}>✦ Members only ✦</div>
                <div style={{fontSize:".88rem",color:"rgba(245,237,226,0.75)",marginBottom:18,lineHeight:1.6}}>Sign up to reveal the correct answer, see the clinical explanation, and start earning points.</div>
                <button onClick={()=>{setAuthMode("signup");setScr("login")}} style={{background:"#c8a84e",color:"#4a1f3d",border:"none",padding:"13px 30px",fontSize:".88rem",fontWeight:700,letterSpacing:1,cursor:"pointer",fontFamily:"inherit",borderRadius:999,transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.background="#d4b558";e.currentTarget.style.transform="translateY(-1px)"}} onMouseLeave={e=>{e.currentTarget.style.background="#c8a84e";e.currentTarget.style.transform=""}}>REVEAL ANSWER →</button>
              </div>
            </div>
          </FadeIn>}

          {!publicQuiz&&!publicQuizLoading&&<div style={{background:"#fff",borderRadius:14,padding:60,textAlign:"center",color:"#7a5a6d",border:"1px solid rgba(200,168,78,0.25)"}}>
            <div style={{fontSize:"2rem",marginBottom:14,color:"#c8a84e"}}>✦</div>
            A new clinical quiz is published every day. Sign up to start your streak.
          </div>}
        </div>
      </section>

      {/* ═══ TESTIMONIAL — large quote on cream ═══ */}
      <section style={{background:"#faf3e7",padding:"80px 28px",borderTop:"1px solid rgba(200,168,78,0.2)",borderBottom:"1px solid rgba(200,168,78,0.2)"}}>
        <div style={{maxWidth:780,margin:"0 auto",textAlign:"center"}}>
          <FadeIn>
            <div style={{fontSize:"4.5rem",fontFamily:"Georgia,serif",color:"#c8a84e",lineHeight:1,marginBottom:0,opacity:0.7}}>&ldquo;</div>
            <blockquote style={{fontSize:"clamp(1.15rem, 2.2vw, 1.55rem)",fontFamily:"Georgia,serif",fontWeight:300,fontStyle:"italic",color:"#4a1f3d",lineHeight:1.6,margin:"0 0 26px"}}>
              SKINARIO has become my five-minute morning ritual. The case discussions are gold —
              real peers, real complications, real solutions. It's how I stay sharp between conferences.
            </blockquote>
            <div style={{height:1,width:80,background:"#c8a84e",margin:"0 auto 16px"}}/>
            <div style={{fontSize:".78rem",color:"#c8a84e",letterSpacing:3,textTransform:"uppercase",fontWeight:700}}>Aesthetic Practitioner · Pune</div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section style={{background:"linear-gradient(135deg,#4a1f3d,#5a2347)",padding:"90px 28px",textAlign:"center",position:"relative",overflow:"hidden"}}>
        <svg viewBox="0 0 600 200" style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:"80%",opacity:0.1,pointerEvents:"none"}}>
          <path d="M 0 100 Q 150 0 300 100 T 600 100" fill="none" stroke="#c8a84e" strokeWidth="1.5"/>
          <path d="M 0 120 Q 150 20 300 120 T 600 120" fill="none" stroke="#c8a84e" strokeWidth="1"/>
        </svg>
        <div style={{maxWidth:680,margin:"0 auto",position:"relative",zIndex:2}}>
          <FadeIn>
            <div style={{fontSize:".7rem",color:"#c8a84e",letterSpacing:4,textTransform:"uppercase",fontWeight:700,marginBottom:18}}>Join the community</div>
            <h2 style={{fontSize:"clamp(2rem, 4.5vw, 3rem)",fontFamily:"Georgia,serif",fontWeight:300,letterSpacing:1,color:"#f5ede2",lineHeight:1.2,margin:0,marginBottom:20}}>Your peers are<br/>already inside.</h2>
            <p style={{fontSize:"1rem",color:"rgba(245,237,226,0.8)",lineHeight:1.8,marginBottom:34,maxWidth:480,margin:"0 auto 34px"}}>
              Free for verified medical practitioners. Sign up with Google in 30 seconds.
            </p>
            <button onClick={()=>{setAuthMode("signup");setScr("login")}} style={{background:"#c8a84e",color:"#4a1f3d",border:"none",padding:"16px 42px",fontSize:"1rem",fontWeight:700,letterSpacing:1.5,cursor:"pointer",fontFamily:"inherit",borderRadius:999,transition:"all .2s",boxShadow:"0 8px 24px rgba(200,168,78,0.25)"}} onMouseEnter={e=>{e.currentTarget.style.background="#d4b558";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 12px 30px rgba(200,168,78,0.4)"}} onMouseLeave={e=>{e.currentTarget.style.background="#c8a84e";e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 8px 24px rgba(200,168,78,0.25)"}}>BECOME A MEMBER →</button>
            <p style={{marginTop:22,fontSize:".82rem",color:"rgba(245,237,226,0.6)"}}>Already inside? <span onClick={()=>setScr("login")} style={{color:"#c8a84e",cursor:"pointer",textDecoration:"underline",fontWeight:600}}>Sign in</span></p>
          </FadeIn>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{background:"#3a172f",padding:"36px 28px",textAlign:"center"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{fontSize:".82rem",color:"#c8a84e",letterSpacing:4,fontFamily:"Georgia,serif",fontWeight:300}}>SKINARIO</div>
          <div style={{fontSize:".66rem",color:"rgba(245,237,226,0.55)",letterSpacing:2,textTransform:"uppercase",marginTop:6,fontWeight:600}}>By Absolute Institute · India</div>
          <div style={{height:1,width:60,background:"rgba(200,168,78,0.3)",margin:"22px auto"}}/>
          <p style={{fontSize:".7rem",color:"rgba(245,237,226,0.45)",lineHeight:1.7,margin:0,maxWidth:500,marginInline:"auto"}}>A professional community for licensed medical practitioners only.</p>
        </div>
      </footer>

      {/* Mobile responsive grid override + animation styles */}
      <style>{`@media (max-width: 760px){.hero-grid{grid-template-columns: 1fr !important; gap: 20px !important;}}`}</style>
    </div>
  );



  if(scr==="login")return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#f8f7f4,#fdf6e3 40%,#e1f5ee 70%,#f8f7f4)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"system-ui"}}>
      <Logo size={100}/><h1 style={{fontSize:"2.8rem",fontWeight:300,color:T.txt,marginTop:8,letterSpacing:6,fontFamily:"Georgia,serif"}}>SKINARIO</h1>
      <p style={{fontSize:".72rem",color:T.gold,letterSpacing:4,textTransform:"uppercase",margin:"6px 0 10px",fontWeight:600}}>{BRAND.tagline}</p>
      <p style={{color:T.teal,fontSize:"1.1rem",textAlign:"center",fontFamily:"Georgia,serif",fontStyle:"italic",margin:"4px 0 12px",letterSpacing:.5}}>Learn. Discuss. Lead the field.</p>
      <p style={{color:T.txt2,fontSize:".88rem",textAlign:"center",maxWidth:440,lineHeight:1.7,marginBottom:28}}>Daily clinical quizzes, expert articles, video masterclasses and a vibrant community of aesthetic medicine professionals.</p>
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
      <p onClick={()=>setScr("landing")} style={{marginTop:16,fontSize:".78rem",color:T.teal,cursor:"pointer",fontWeight:500,textDecoration:"underline"}}>← Back to landing</p>
      <p style={{marginTop:14,fontSize:".6rem",color:T.light,letterSpacing:2,textTransform:"uppercase"}}>{BRAND.sub}</p>
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

          {/* ═══ BRAND / PHARMA FIELDS ═══ */}
          {(pf.accountType==="brand"||pf.accountType==="pharma")&&<>
            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Country <span style={{color:T.err}}>*</span></label>
            <select value={pf.country} onChange={e=>setPf(p=>({...p,country:e.target.value}))} style={{...T.inp,marginBottom:12}}>
              {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Company / Brand Name <span style={{color:T.err}}>*</span></label>
            <input value={pf.companyName} onChange={e=>setPf(p=>({...p,companyName:e.target.value}))} placeholder="e.g. Sun Pharma Aesthetics, Galderma India" style={{...T.inp,marginBottom:12}}/>

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

          {/* ═══ VENDOR / DISTRIBUTOR FIELDS ═══ */}
          {pf.accountType==="vendor"&&<>
            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Country <span style={{color:T.err}}>*</span></label>
            <select value={pf.country} onChange={e=>setPf(p=>({...p,country:e.target.value}))} style={{...T.inp,marginBottom:12}}>
              {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Company Name <span style={{color:T.err}}>*</span></label>
            <input value={pf.companyName} onChange={e=>setPf(p=>({...p,companyName:e.target.value}))} placeholder="e.g. Cynosure India, MedTech Distributors" style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Vendor Category <span style={{color:T.err}}>*</span></label>
            <select value={pf.vendorCategory} onChange={e=>setPf(p=>({...p,vendorCategory:e.target.value}))} style={{...T.inp,marginBottom:12}}>
              <option value="">— Select —</option>{VENDOR_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Contact Person Name <span style={{color:T.err}}>*</span></label>
            <input value={pf.contactPerson} onChange={e=>setPf(p=>({...p,contactPerson:e.target.value}))} placeholder="Your name / partnership contact" style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>GST Number (optional)</label>
            <input value={pf.gstNumber} onChange={e=>setPf(p=>({...p,gstNumber:e.target.value.toUpperCase()}))} placeholder="e.g. 27AABCU9603R1ZX" style={{...T.inp,marginBottom:12,fontFamily:"monospace"}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Website (optional)</label>
            <input value={pf.website} onChange={e=>setPf(p=>({...p,website:e.target.value}))} placeholder="https://yourcompany.com" style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Address (City, State)</label>
            <input value={pf.address} onChange={e=>setPf(p=>({...p,address:e.target.value}))} placeholder="e.g. Mumbai, Maharashtra" style={{...T.inp,marginBottom:12}}/>
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
  // ─── NAV CONFIG ───────────────────────────────────────────────────────────
  // Primary (always visible): Home, Quiz, Forum, Cases, Me
  // Overflow ("⋯ More" dropdown): Library, Videos, Events, Rank, Consent, Admin
  const primaryNavs=[
    {id:"home",ic:"🏠",l:"Home"},
    {id:"quiz",ic:"🧠",l:"Quiz"},
    {id:"forum",ic:"💬",l:"Forum"},
    {id:"cases",ic:"🔬",l:"Cases"},
    {id:"me",ic:"👤",l:"Me"},
  ];
  const overflowNavs=[
    {id:"library",ic:"📚",l:"Library"},
    {id:"videos",ic:"🎥",l:"Videos"},
    {id:"events",ic:"📅",l:"Events"},
    {id:"vendors",ic:"🏭",l:"Vendors"},
    {id:"rank",ic:"🏆",l:"Rank"},
    {id:"consent",ic:"📋",l:"Consent"},
    ...(isAdm?[{id:"admin",ic:"⚙️",l:"Admin"}]:[]),
  ];
  // Check if current page is in overflow (so More button highlights)
  const overflowActive=overflowNavs.some(n=>n.id===pg);

  return(
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"system-ui",color:T.txt}}>
      <style>{`.nav-more-row:hover{background:#f5fafa}.nav-more-row:hover *{color:#0d6b6e}`}</style>
      <div style={{position:"sticky",top:0,zIndex:100,background:"#ffffffee",backdropFilter:"blur(16px)",borderBottom:"1px solid "+T.border,padding:"6px 24px"}}>
        <div style={{maxWidth:W,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          {/* Logo + wordmark */}
          <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>go("home")}>
            <Logo size={36}/><div style={{fontSize:"1.15rem",fontWeight:300,color:T.txt,letterSpacing:4,fontFamily:"Georgia,serif"}}>SKINARIO</div>
          </div>

          {/* Primary nav + overflow + notifications + avatar */}
          <div style={{display:"flex",alignItems:"center",gap:1}}>
            {/* Primary nav buttons — always visible */}
            {primaryNavs.map(n=><button key={n.id} onClick={()=>go(n.id)} style={{background:pg===n.id?T.tealBg:"none",border:"none",color:pg===n.id?T.teal:T.mute,padding:"5px 9px",borderRadius:9,cursor:"pointer",fontSize:".6rem",fontFamily:"inherit",fontWeight:pg===n.id?600:400,display:"flex",flexDirection:"column",alignItems:"center",gap:1,minWidth:40}}>
              <span style={{fontSize:".85rem"}}>{n.ic}</span>{n.l}
            </button>)}

            {/* ⋯ More — overflow nav dropdown */}
            <div style={{position:"relative"}}>
              <button data-more-btn onClick={()=>{setMoreOpen(o=>!o);setNotifsOpen(false)}} style={{background:moreOpen||overflowActive?T.tealBg:"none",border:"none",color:moreOpen||overflowActive?T.teal:T.mute,padding:"5px 9px",borderRadius:9,cursor:"pointer",fontSize:".6rem",fontFamily:"inherit",fontWeight:moreOpen||overflowActive?600:400,display:"flex",flexDirection:"column",alignItems:"center",gap:1,minWidth:40}}>
                <span style={{fontSize:".95rem",lineHeight:1,letterSpacing:.5}}>☰</span>More
              </button>
              {moreOpen&&<div data-more-dropdown style={{position:"absolute",top:"calc(100% + 8px)",right:0,minWidth:160,background:"#fff",borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",border:"1px solid "+T.border,zIndex:500,overflow:"hidden",padding:"6px 0"}}>
                {/* Profile row at top */}
                <div onClick={()=>{go("me");setMoreOpen(false)}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",cursor:"pointer",borderBottom:"1px solid "+T.border,marginBottom:4}} className="nav-more-row">
                  <div style={{width:32,height:32,borderRadius:"50%",overflow:"hidden",background:T.teal,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:".88rem",flexShrink:0}}>
                    {prof?.photo?<img src={prof.photo} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:uIni}
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:".82rem",color:T.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{prof?.name||"My Profile"}</div>
                    <div style={{fontSize:".68rem",color:T.mute}}>View profile →</div>
                  </div>
                </div>
                {/* Overflow nav items */}
                {overflowNavs.map(n=><button key={n.id} onClick={()=>{go(n.id);setMoreOpen(false)}} style={{width:"100%",background:pg===n.id?T.tealBg:"none",border:"none",borderLeft:pg===n.id?"3px solid "+T.teal:"3px solid transparent",color:pg===n.id?T.teal:T.txt,padding:"9px 16px",cursor:"pointer",fontSize:".84rem",fontFamily:"inherit",fontWeight:pg===n.id?600:400,display:"flex",alignItems:"center",gap:10,textAlign:"left"}}>
                  <span style={{fontSize:"1rem",width:20,textAlign:"center"}}>{n.ic}</span>{n.l}
                </button>)}
                {/* Notification count in overflow */}
                {(()=>{const unread=notifs.filter(n=>!n.read).length;return unread>0?<div onClick={()=>{setMoreOpen(false);setNotifsOpen(true)}} style={{padding:"9px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontSize:".84rem",color:T.err,fontWeight:600,borderTop:"1px solid "+T.border,marginTop:4}}>
                  <span style={{width:20,textAlign:"center"}}>🔔</span>Notifications <span style={{marginLeft:"auto",background:"#dc3545",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:".7rem"}}>{unread>9?"9+":unread}</span>
                </div>:null})()}
              </div>}
            </div>

            {/* 🔔 Notifications bell */}
            {(()=>{const unread=notifs.filter(n=>!n.read).length;return(<div style={{position:"relative",marginLeft:4}}>
              <button onClick={()=>{setNotifsOpen(o=>!o);setMoreOpen(false)}} style={{background:notifsOpen?T.tealBg:"none",border:"none",padding:"5px 9px",borderRadius:9,cursor:"pointer",fontSize:".85rem",position:"relative"}} title="Notifications">
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
              <p style={{color:T.txt2,fontSize:".9rem",marginTop:3,fontStyle:"italic",letterSpacing:.3}}>Learn. Discuss. Lead the field.</p>
            </div>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button onClick={()=>go("quiz")} style={T.btn}>🧠 Today's quiz</button>
            <button onClick={()=>go("events")} style={T.btnO}>📅 Events</button>
            <button onClick={()=>go("cases")} style={T.btnO}>🔬 Clinical cases</button>
            <button onClick={()=>go("forum")} style={T.btnO}>💬 Forum</button>
            {(()=>{const aType=prof?.accountType||"";const showConsent=isAdm||aType==="doctor"||aType===""||aType===undefined;return showConsent?<button onClick={()=>go("consent")} style={{background:"#fdf6e3",color:"#785f1e",border:"1.5px solid #c8a84e",borderRadius:8,padding:"9px 18px 9px 28px",fontSize:".88rem",fontWeight:500,fontFamily:"inherit",cursor:"pointer",position:"relative",overflow:"hidden"}}><span style={{position:"absolute",top:3,left:6,fontSize:".52rem",background:"#c8a84e",color:"#fff",padding:"1px 6px",borderRadius:5,fontWeight:700,letterSpacing:.6}}>NEW</span>📋 Generate consent</button>:null;})()}
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:8,margin:"16px 0"}}>
          {/* Quiz + Accuracy — single column, stacked top/bottom */}
          <div onClick={()=>go("quiz")} style={{...T.card,padding:0,marginBottom:0,cursor:"pointer",overflow:"hidden",transition:"transform .12s,box-shadow .12s",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 16px rgba(0,0,0,0.08)"}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)"}}>
            {/* Top: quiz count */}
            <div style={{textAlign:"center",padding:"8px 4px 6px",borderBottom:"1px solid "+T.border,background:"#f0fbfa"}}>
              <div style={{fontSize:".8rem"}}>🧠</div>
              <div style={{fontSize:"1.1rem",fontWeight:700,color:T.teal,lineHeight:1}}>{totA}</div>
              <div style={{fontSize:".48rem",color:T.mute,textTransform:"uppercase",letterSpacing:.5,marginTop:1}}>Quizzes</div>
            </div>
            {/* Bottom: accuracy */}
            <div style={{textAlign:"center",padding:"6px 4px 8px"}}>
              <div style={{fontSize:".8rem"}}>✅</div>
              <div style={{fontSize:"1.1rem",fontWeight:700,color:T.teal,lineHeight:1}}>{acc}%</div>
              <div style={{fontSize:".48rem",color:T.mute,textTransform:"uppercase",letterSpacing:.5,marginTop:1}}>Accuracy</div>
            </div>
          </div>
          {/* Redeem — gold highlight */}
          <div onClick={()=>go("rewards")} style={{...T.card,textAlign:"center",padding:"12px 4px",marginBottom:0,cursor:"pointer",transition:"transform .12s,box-shadow .12s",borderLeft:"3px solid "+T.gold,background:"linear-gradient(135deg,"+T.goldBg+"55,#fff)",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 16px rgba(200,168,78,0.22)"}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:"1rem"}}>🏆</div>
            <div style={{fontSize:"1.2rem",fontWeight:700,color:T.gold}}>{spendablePoints}</div>
            <div style={{fontSize:".52rem",color:T.gold,textTransform:"uppercase",letterSpacing:1,fontWeight:700}}>Redeem →</div>
          </div>
          {/* Articles */}
          {[["📰",articles.length,"Articles",()=>{go("home");setTimeout(()=>document.getElementById("featured-articles")?.scrollIntoView({behavior:"smooth",block:"start"}),200);}],["🔬",cases.length,"Cases",()=>go("cases")],["💬",forumPosts.length,"Forum",()=>go("forum")],["🎥",videos.length,"Videos",()=>go("videos")],["📚",resources.length,"Library",()=>go("library")]].map(([ic,ct,lb,fn])=>
            <div key={lb} onClick={fn} style={{...T.card,textAlign:"center",padding:"12px 4px",marginBottom:0,cursor:"pointer",transition:"transform .12s,box-shadow .12s",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 16px rgba(0,0,0,0.08)"}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)"}}>
              <div style={{fontSize:"1rem"}}>{ic}</div>
              <div style={{fontSize:"1.2rem",fontWeight:700,color:T.teal}}>{ct}</div>
              <div style={{fontSize:".52rem",color:T.mute,textTransform:"uppercase",letterSpacing:.5}}>{lb}</div>
            </div>)}
          {/* Submit Content — earn points by contributing */}
          <div onClick={()=>go("me")} style={{...T.card,textAlign:"center",padding:"12px 4px",marginBottom:0,cursor:"pointer",transition:"transform .12s,box-shadow .12s",background:"linear-gradient(135deg,"+T.tealBg+"88,#fff)",borderLeft:"2px solid "+T.teal,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 16px rgba(13,107,110,0.15)"}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:"1rem"}}>✍️</div>
            <div style={{fontSize:".72rem",fontWeight:700,color:T.teal,lineHeight:1.2,marginTop:2}}>Submit</div>
            <div style={{fontSize:".52rem",color:T.teal,textTransform:"uppercase",letterSpacing:.5,marginTop:2}}>Content</div>
          </div>
        </div>

        {/* ═══ QUICK-ACCESS NEWS BUTTONS ═══
            Each button smooth-scrolls to its corresponding section below.
            Section IDs: sk-trials, sk-industry, sk-research, sk-fda */}
        {(()=>{
          const scrollTo=(id)=>{const el=document.getElementById(id);if(el)el.scrollIntoView({behavior:"smooth",block:"start"})};
          const btns=[
            {id:"sk-industry", icon:"📰",label:"Industry News",   desc:"Aesthetic medicine", color:"#bf6a00",bg:"#fff8e1"},
            {id:"sk-trials",   icon:"🧪",label:"Clinical Trials", desc:"Recruiting now",     color:"#0d6b6e",bg:"#e1f5ee"},
            {id:"sk-research", icon:"🔬",label:"Latest Research", desc:"PubMed papers",      color:"#7a3e9a",bg:"#f3e8ff"},
            {id:"sk-fda",      icon:"⚠️",label:"FDA Alerts",      desc:"Safety updates",     color:"#c5392a",bg:"#fce8e6"},
          ];
          return(<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:14}}>
            {btns.map(b=><div key={b.id} onClick={()=>scrollTo(b.id)} style={{...T.card,padding:"14px 12px",cursor:"pointer",borderLeft:"3px solid "+b.color,display:"flex",alignItems:"center",gap:10,marginBottom:0,transition:"all .15s",boxShadow:"0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 16px rgba(0,0,0,0.08)";e.currentTarget.style.borderLeftColor=b.color}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)"}}>
              <div style={{width:38,height:38,borderRadius:10,background:b.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.2rem",flexShrink:0}}>{b.icon}</div>
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontSize:".82rem",fontWeight:700,color:T.txt,lineHeight:1.2,marginBottom:2}}>{b.label}</div>
                <div style={{fontSize:".66rem",color:T.mute,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{b.desc}</div>
              </div>
            </div>)}
          </div>);
        })()}

        {/* ═══ FEATURED FORUM ═══
            Hybrid: posts manually marked feat=true rank first, then auto-pick by
            engagement score from the last 14 days. Top 4 total. */}
        {(()=>{
          const FOURTEEN_DAYS=14*24*60*60*1000;
          const cutoff=Date.now()-FOURTEEN_DAYS;
          // Engagement score: likes + (replies × 2) — reward discussion more than passive likes
          const scoreOf=p=>(p.likes||0)+((p.comments?.length||p.replies||0)*2);
          // Eligible: must have title + body and either be marked featured OR posted within 14 days
          const recent=forumPosts.filter(p=>{
            if(!p||!p.title)return false;
            const ts=new Date(p.date||p.createdAt||0).getTime();
            return p.feat||ts>=cutoff;
          });
          const eligible=recent.sort((a,b)=>{
            // Manual featured posts always rank first
            if((b.feat?1:0)!==(a.feat?1:0))return (b.feat?1:0)-(a.feat?1:0);
            // Then by engagement score descending
            const sDiff=scoreOf(b)-scoreOf(a);
            if(sDiff!==0)return sDiff;
            // Tiebreaker: more recent first
            const da=new Date(a.date||a.createdAt||0).getTime();
            const db=new Date(b.date||b.createdAt||0).getTime();
            return db-da;
          }).slice(0,4);
          if(eligible.length<2)return null;
          return(<div style={{...T.card,padding:18,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <h3 style={{fontSize:"1.05rem",fontWeight:700,margin:0}}>💬 Featured Forum</h3>
              <span onClick={(e)=>{e.stopPropagation();go("forum")}} style={{fontSize:".78rem",color:T.teal,fontWeight:600,cursor:"pointer"}}>Browse all →</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
              {eligible.map(p=>{
                const replyCount=p.comments?.length||p.replies||0;
                return(<div key={p.id} onClick={()=>{go("forum");setTimeout(()=>{setSelFP(p);window.scrollTo(0,0)},50)}} style={{background:"#fff",borderRadius:10,overflow:"hidden",border:"1px solid "+T.border,cursor:"pointer",transition:"all .15s",display:"flex",flexDirection:"column"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 20px rgba(0,0,0,0.07)"}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}>
                  {/* Image if available, else colored band so card has visual presence */}
                  {p.images?.length>0?
                    <div style={{aspectRatio:"16/10",overflow:"hidden",background:T.bg,position:"relative"}}>
                      <img src={p.images[0]} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={e=>{e.currentTarget.style.display="none"}}/>
                      {p.feat&&<div style={{position:"absolute",top:6,left:6,background:T.gold,color:"#fff",fontSize:".6rem",padding:"2px 7px",borderRadius:10,fontWeight:700,letterSpacing:.5}}>★ FEATURED</div>}
                    </div>
                    :
                    <div style={{aspectRatio:"16/10",background:"linear-gradient(135deg,"+T.tealBg+","+T.goldBg+")",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                      <div style={{fontSize:"2rem",opacity:.6}}>💬</div>
                      {p.feat&&<div style={{position:"absolute",top:6,left:6,background:T.gold,color:"#fff",fontSize:".6rem",padding:"2px 7px",borderRadius:10,fontWeight:700,letterSpacing:.5}}>★ FEATURED</div>}
                    </div>
                  }
                  <div style={{padding:12,flex:1,display:"flex",flexDirection:"column"}}>
                    {p.cat&&<div style={{fontSize:".64rem",color:T.teal,fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",marginBottom:5}}>{p.cat}</div>}
                    <div style={{fontSize:".88rem",fontWeight:600,color:T.txt,lineHeight:1.35,marginBottom:6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",flex:1}}>{p.title}</div>
                    <div style={{fontSize:".68rem",color:T.mute}}>{p.author||"Anonymous"} · ❤️ {p.likes||0} · 💬 {replyCount}</div>
                  </div>
                </div>);
              })}
            </div>
          </div>);
        })()}

        {/* ═══ CONSENT TEMPLATE PROMO BANNER ═══
            Shown to doctors / unset accountType. Dismissed once clicked. */}
        {(()=>{
          const aType=prof?.accountType||"";
          const canSeeConsent=isAdm||aType==="doctor"||aType===""||aType===undefined;
          if(!canSeeConsent)return null;
          return(
            <div onClick={()=>go("consent")} style={{...T.card,padding:"12px 18px",marginBottom:14,background:"linear-gradient(135deg,"+T.tealBg+"88,"+T.goldBg+"44)",borderLeft:"3px solid "+T.teal,display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,cursor:"pointer",flexWrap:"wrap"}} onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 18px rgba(0,0,0,0.07)"}} onMouseLeave={e=>{e.currentTarget.style.boxShadow=""}}>
              <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
                <div style={{fontSize:"1.6rem",flexShrink:0}}>📋</div>
                <div style={{minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:3}}>
                    <span style={{fontSize:".62rem",background:T.teal,color:"#fff",padding:"2px 8px",borderRadius:10,fontWeight:700,letterSpacing:.5}}>NEW</span>
                    <div style={{fontSize:".92rem",fontWeight:700,color:T.teal}}>Consent Template Generator</div>
                  </div>
                  <div style={{fontSize:".76rem",color:T.txt2,lineHeight:1.5}}>
                    Generate professional informed consent forms for 22+ procedures. Botox, fillers, threads, peels, lasers and more. Word + PDF · 7 languages · DPDP-compliant.
                  </div>
                </div>
              </div>
              <div style={{fontSize:".8rem",color:T.teal,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>Try free →</div>
            </div>
          );
        })()}

        {/* ═══ FEATURED ARTICLES ═══
            Shows 3-4 articles with quality covers. Only renders if 2+ qualify. */}
        {(()=>{
          const eligible=articles.filter(a=>a&&a.cover&&a.title).sort((a,b)=>{
            // Featured first, then by date desc
            if((b.feat?1:0)!==(a.feat?1:0))return (b.feat?1:0)-(a.feat?1:0);
            const da=new Date(a.date||a.createdAt||0).getTime();
            const db=new Date(b.date||b.createdAt||0).getTime();
            return db-da;
          }).slice(0,4);
          if(eligible.length<2)return null;
          return(<div style={{...T.card,padding:18,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <h3 id="featured-articles" style={{fontSize:"1.05rem",fontWeight:700,margin:0}}>📰 Featured Articles</h3>
              <span onClick={()=>go("library")} style={{fontSize:".78rem",color:T.teal,fontWeight:600,cursor:"pointer"}}>Explore all →</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
              {eligible.map(a=><div key={a.id} onClick={()=>{setSelA(a);window.scrollTo(0,0)}} style={{background:"#fff",borderRadius:10,overflow:"hidden",border:"1px solid "+T.border,cursor:"pointer",transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 20px rgba(0,0,0,0.07)"}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}>
                <div style={{aspectRatio:"16/10",overflow:"hidden",background:T.bg}}>
                  <img src={a.cover} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={e=>{e.currentTarget.style.display="none"}}/>
                </div>
                <div style={{padding:12}}>
                  {a.cat&&<div style={{fontSize:".64rem",color:T.gold,fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",marginBottom:5}}>{a.cat}</div>}
                  <div style={{fontSize:".88rem",fontWeight:600,color:T.txt,lineHeight:1.35,marginBottom:6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{a.title}</div>
                  <div style={{fontSize:".68rem",color:T.mute}}>{a.author||"SKINARIO Editorial"}{a.date?` · ${a.date}`:""}</div>
                </div>
              </div>)}
            </div>
          </div>);
        })()}

        {/* ═══ FEATURED CASES ═══ */}
        {(()=>{
          const eligible=cases.filter(c=>c&&c.images&&c.images.length>0&&c.title).slice(0,3);
          if(eligible.length<2)return null;
          return(<div style={{...T.card,padding:18,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <h3 style={{fontSize:"1.05rem",fontWeight:700,margin:0}}>🔬 Real Cases from the Community</h3>
              <span onClick={()=>go("cases")} style={{fontSize:".78rem",color:T.teal,fontWeight:600,cursor:"pointer"}}>View all cases →</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
              {eligible.map(c=><div key={c.id} onClick={()=>go("cases")} style={{background:"#fff",borderRadius:10,overflow:"hidden",border:"1px solid "+T.border,cursor:"pointer",transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 20px rgba(0,0,0,0.07)"}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}>
                <div style={{aspectRatio:"4/3",overflow:"hidden",background:T.bg,position:"relative"}}>
                  <img src={c.images[0]} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                  {c.images.length>1&&<div style={{position:"absolute",bottom:6,right:6,background:"rgba(0,0,0,0.65)",color:"#fff",fontSize:".62rem",padding:"2px 7px",borderRadius:10,fontWeight:600}}>+{c.images.length-1}</div>}
                </div>
                <div style={{padding:12}}>
                  {c.cat&&<div style={{fontSize:".64rem",color:T.teal,fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",marginBottom:5}}>{c.cat}</div>}
                  <div style={{fontSize:".88rem",fontWeight:600,color:T.txt,lineHeight:1.35,marginBottom:6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{c.title}</div>
                  <div style={{fontSize:".68rem",color:T.mute}}>by {c.author||"Anonymous"} · 💬 {(c.comments||[]).length}</div>
                </div>
              </div>)}
            </div>
          </div>);
        })()}

        {/* ═══ FEATURED VIDEOS ═══ */}
        {(()=>{
          const eligible=videos.filter(v=>v&&v.title&&(v.thumb||v.url)).slice(0,3);
          if(eligible.length<2)return null;
          return(<div style={{...T.card,padding:18,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <h3 style={{fontSize:"1.05rem",fontWeight:700,margin:0}}>🎥 Featured Masterclasses</h3>
              <span onClick={()=>go("videos")} style={{fontSize:".78rem",color:T.teal,fontWeight:600,cursor:"pointer"}}>All videos →</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
              {eligible.map(v=><div key={v.id} onClick={()=>{setSelV(v);go("videos")}} style={{background:"#fff",borderRadius:10,overflow:"hidden",border:"1px solid "+T.border,cursor:"pointer",transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 20px rgba(0,0,0,0.07)"}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}>
                <div style={{aspectRatio:"16/9",overflow:"hidden",background:"#1a1a1a",position:"relative"}}>
                  {v.thumb&&<img src={v.thumb} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>}
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <div style={{width:48,height:48,borderRadius:"50%",background:"rgba(255,255,255,0.95)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",color:"#1a1a1a"}}>▶</div>
                  </div>
                </div>
                <div style={{padding:12}}>
                  {v.cat&&<div style={{fontSize:".64rem",color:"#c5392a",fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",marginBottom:5}}>{v.cat}</div>}
                  <div style={{fontSize:".88rem",fontWeight:600,color:T.txt,lineHeight:1.35,marginBottom:6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{v.title}</div>
                  <div style={{fontSize:".68rem",color:T.mute}}>{v.duration||"Masterclass"}</div>
                </div>
              </div>)}
            </div>
          </div>);
        })()}

        {/* ═══ INDUSTRY NEWS, FDA ALERTS, RESEARCH, TRIALS — 4 SECTIONS ═══ */}
        {(()=>{
          const isAdmin=ADMINS.includes(au?.email);

          // Topic → color mapping (used for research circles)
          const topicColor=(t)=>{
            const map={"Botox & Neurotoxins":["#fce8e6","#c5392a"],"Dermal Fillers":["#e3f2fd","#1565c0"],"Threads":["#f3e5f5","#6a1b9a"],"PDRN & Polynucleotides":["#e1f5ee","#0d6b6e"],"Peptides & Skin Boosters":["#fff3e0","#bf360c"],"Chemical Peels":["#fce4ec","#880e4f"],"Laser & Energy Devices":["#fff8e1","#bf6a00"],"Hair Restoration":["#efebe9","#4e342e"],"Body Contouring":["#e8eaf6","#283593"],"Anti-Aging & Regenerative":["#e8f5e9","#1b5e20"],"Skincare Science":["#f1f8e9","#33691e"],"Pigmentation & Melasma":["#fce4ec","#ad1457"],"Acne & Scars":["#ede7f6","#311b92"],"Practice Management":["#eceff1","#37474f"]};
            return map[t]||[T.tealBg,T.teal];
          };
          const placeholderFor=(cat)=>{const[bg,fg]=topicColor(cat);return{bg,fg}};

          // Whether to show each section
          const hasIndustry=industryNews.length>0;
          const hasFda=fdaAlerts.length>0;
          const hasResearch=research.length>0||newsPosts.length>0;
          const hasTrials=trials.length>0;
          const anyContent=hasIndustry||hasFda||hasResearch||hasTrials;
          if(!anyContent&&!researchLoading&&!newsFeedsLoading&&!isAdmin)return null;

          return(<>

            {/* ═════════ INDUSTRY NEWS ═════════ */}
            {(hasIndustry||(isAdmin&&!industryNewsConfigured))&&<div id="sk-industry" style={{...T.card,padding:18,marginBottom:14,scrollMarginTop:80}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
                <h3 style={{fontSize:"1.05rem",fontWeight:700,margin:0}}>📰 Industry News</h3>
                <span style={{fontSize:".7rem",color:T.mute}}>From aesthetic medicine news sources</span>
              </div>
              {!industryNewsConfigured&&isAdmin&&<div style={{padding:"10px 12px",background:T.warnBg,borderLeft:"3px solid "+T.warn,borderRadius:"0 6px 6px 0",fontSize:".75rem",color:T.txt2,lineHeight:1.55,marginBottom:12}}>
                ⚙️ <b>Industry news inactive.</b> Sign up free at <a href="https://newsdata.io" target="_blank" rel="noopener noreferrer" style={{color:T.teal}}>newsdata.io</a>, then add <code style={{background:"#fff",padding:"1px 6px",borderRadius:4,fontSize:".7rem"}}>NEWSDATA_API_KEY</code> to Vercel environment variables.
              </div>}
              {hasIndustry&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:10}}>
                {industryNews.slice(0,6).map((n,i)=><a key={i} href={n.url||"#"} target="_blank" rel="noopener noreferrer"
                  style={{display:"block",textDecoration:"none",color:"inherit",borderRadius:10,overflow:"hidden",border:"1px solid "+T.border,background:"#fff",transition:"all .15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=T.teal;e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.06)"}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}
                >
                  {n.image?
                    <div style={{height:110,overflow:"hidden",background:"#f4f1ea"}}><img src={n.image} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={e=>{e.currentTarget.style.display="none"}}/></div>
                    :<div style={{height:80,background:T.tealBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.8rem"}}>📰</div>
                  }
                  <div style={{padding:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                      {n.region==="India"&&<span style={{padding:"2px 7px",borderRadius:10,fontSize:".62rem",fontWeight:700,background:"#fff4e0",color:"#bf6a00",letterSpacing:.3}}>🇮🇳 INDIA</span>}
                    </div>
                    <div style={{fontSize:".88rem",fontWeight:600,color:T.txt,lineHeight:1.35,marginBottom:6,display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{n.title}</div>
                    <div style={{fontSize:".68rem",color:T.mute,fontStyle:"italic"}}>{n.source||"News source"}{n.pubdate?` · ${n.pubdate}`:""}</div>
                  </div>
                </a>)}
              </div>}
            </div>}

            {/* ═════════ CLINICAL TRIALS ═════════ */}
            {hasTrials&&<div id="sk-trials" style={{...T.card,padding:18,marginBottom:14,borderLeft:"3px solid "+T.teal,scrollMarginTop:80}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
                <h3 style={{fontSize:"1.05rem",fontWeight:700,margin:0}}>🧪 Active Clinical Trials</h3>
                <span style={{fontSize:".7rem",color:T.mute}}>Recruiting now on ClinicalTrials.gov</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {trials.slice(0,6).map((t,i)=><a key={t.nctId||i} href={t.url} target="_blank" rel="noopener noreferrer"
                  style={{display:"flex",gap:12,padding:"12px 14px",borderRadius:10,border:"1px solid "+T.border,textDecoration:"none",color:"inherit",background:"#fff",transition:"all .15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=T.teal;e.currentTarget.style.background=T.tealBg+"22"}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background="#fff"}}
                >
                  <div style={{width:48,height:48,borderRadius:8,background:T.tealBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem",flexShrink:0}}>{t.icon||"🧪"}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:5,marginBottom:5,flexWrap:"wrap"}}>
                      {t.status&&<span style={{padding:"2px 8px",borderRadius:10,fontSize:".64rem",fontWeight:700,background:t.status==="RECRUITING"?"#e8f5e9":T.bg,color:t.status==="RECRUITING"?"#1b5e20":T.mute}}>{t.status.replace(/_/g," ")}</span>}
                      {t.phase&&<span style={{padding:"2px 8px",borderRadius:10,fontSize:".64rem",fontWeight:600,background:T.bg,color:T.mute}}>{t.phase}</span>}
                      {t.condition&&<span style={{padding:"2px 8px",borderRadius:10,fontSize:".64rem",fontWeight:600,background:T.tealBg,color:T.teal}}>{t.condition}</span>}
                    </div>
                    <div style={{fontSize:".86rem",fontWeight:600,color:T.txt,lineHeight:1.4,marginBottom:4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{t.title}</div>
                    <div style={{fontSize:".68rem",color:T.mute,fontStyle:"italic"}}>{t.sponsor||"ClinicalTrials.gov"}{t.country?` · ${t.country}`:""}{t.startDate?` · Started ${t.startDate}`:""} · {t.nctId} →</div>
                  </div>
                </a>)}
              </div>
            </div>}

            {/* ═════════ LATEST RESEARCH + EDITORIAL ═════════ */}
            {(hasResearch||researchLoading)&&<div id="sk-research" style={{...T.card,padding:18,marginBottom:14,scrollMarginTop:80}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
                <h3 style={{fontSize:"1.05rem",fontWeight:700,margin:0}}>🔬 Latest Research</h3>
                <span style={{fontSize:".7rem",color:T.mute}}>Peer-reviewed papers from PubMed</span>
              </div>
              {researchLoading&&!hasResearch&&<div style={{textAlign:"center",padding:30,color:T.mute,fontSize:".88rem"}}>
                <div style={{fontSize:"1.4rem",marginBottom:6}}>📡</div>Fetching latest research...
              </div>}

              {/* Editorial admin posts — full article cards */}
              {newsPosts.length>0&&<div style={{display:"grid",gridTemplateColumns:newsPosts.slice(0,3).length===1?"1fr":"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginBottom:research.length>0?14:0}}>
                {newsPosts.slice(0,3).map(n=>{const ph=placeholderFor(n.cat||"News");return(
                  <a key={n.id} href={n.url||"#"} target={n.url?"_blank":"_self"} rel="noopener noreferrer"
                    onClick={e=>{
                      if(!n.url){e.preventDefault();return}
                      const newCount=(n.views||0)+1;
                      fbSet("news",n.id,{views:newCount});
                      setNewsPosts(prev=>prev.map(x=>x.id===n.id?{...x,views:newCount}:x));
                    }}
                    style={{display:"block",textDecoration:"none",color:"inherit",borderRadius:12,overflow:"hidden",border:"1px solid "+T.border,background:"#fff",transition:"all .15s",cursor:n.url?"pointer":"default"}}
                    onMouseEnter={e=>{if(n.url){e.currentTarget.style.borderColor=T.teal;e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 4px 14px rgba(0,0,0,0.08)"}}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}
                  >
                    {n.image?
                      <div style={{height:130,background:"#f4f1ea",overflow:"hidden"}}><img src={n.image} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/></div>
                    :
                      <div style={{height:110,background:ph.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:4}}>
                        <div style={{fontSize:"2.2rem",lineHeight:1,opacity:.9}}>📰</div>
                        <div style={{fontSize:".62rem",color:ph.fg,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase"}}>{n.cat||"SKINARIO News"}</div>
                      </div>
                    }
                    <div style={{padding:"12px 14px"}}>
                      <div style={{display:"flex",gap:5,marginBottom:6,flexWrap:"wrap"}}>
                        {n.cat&&<span style={T.tag(T.tealBg,T.teal)}>{n.cat}</span>}
                        <span style={T.tag(T.goldBg,T.goldD)}>📰 Editorial</span>
                      </div>
                      <div style={{fontSize:".95rem",fontWeight:600,color:T.txt,lineHeight:1.4,marginBottom:n.body?5:0}}>{n.title}</div>
                      {n.body&&<div style={{fontSize:".78rem",color:T.txt2,lineHeight:1.5,marginBottom:6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{n.body}</div>}
                      <div style={{fontSize:".68rem",color:T.mute,marginTop:6,paddingTop:6,borderTop:"1px solid "+T.border}}>SKINARIO Editorial · {fD(n.date)}{(n.views||0)>0?` · 👁️ ${n.views}`:""}{n.url&&" · Read →"}</div>
                    </div>
                  </a>
                )})}
              </div>}

              {/* Research papers — upgraded rows */}
              {research.length>0&&<>
                {newsPosts.length>0&&<div style={{fontSize:".7rem",color:T.mute,fontWeight:600,letterSpacing:1.2,textTransform:"uppercase",marginBottom:10,paddingTop:6,borderTop:"1px dashed "+T.border}}>🔬 Latest peer-reviewed research</div>}
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {research.slice(0,4).map(r=>{const[cBg,cFg]=topicColor(r.topic);return(
                    <a key={r.pmid} href={r.url} target="_blank" rel="noopener noreferrer"
                      style={{display:"flex",gap:14,padding:"12px 14px",borderRadius:10,border:"1px solid "+T.border,textDecoration:"none",color:"inherit",background:"#fff",transition:"all .15s"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=T.teal;e.currentTarget.style.background=T.tealBg+"22"}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background="#fff"}}
                    >
                      <div style={{width:56,height:56,borderRadius:"50%",background:cBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.6rem",flexShrink:0}}>{r.icon||"🔬"}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5,flexWrap:"wrap"}}>
                          <span style={{padding:"2px 8px",borderRadius:10,fontSize:".66rem",fontWeight:600,background:cBg,color:cFg}}>{r.topic}</span>
                          <span style={T.tag(T.bg,T.mute)}>🔬 PubMed</span>
                        </div>
                        <div style={{fontSize:".88rem",fontWeight:600,color:T.txt,lineHeight:1.4,marginBottom:4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{r.title}</div>
                        <div style={{fontSize:".7rem",color:T.mute,fontStyle:"italic"}}>{r.journal}{r.authors?` · ${r.authors}`:""}{r.pubdate?` · ${r.pubdate}`:""} · Read on PubMed →</div>
                      </div>
                    </a>
                  )})}
                </div>
              </>}
            </div>}

            {/* ═════════ FDA ALERTS ═════════ */}
            {hasFda&&<div id="sk-fda" style={{...T.card,padding:18,marginBottom:14,borderLeft:"3px solid #c2185b",scrollMarginTop:80}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
                <h3 style={{fontSize:"1.05rem",fontWeight:700,margin:0,color:"#880e4f"}}>🚨 FDA Alerts</h3>
                <span style={{fontSize:".7rem",color:T.mute}}>Drug & device recalls relevant to aesthetic medicine</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {fdaAlerts.slice(0,6).map((a,i)=><a key={i} href={a.url||"#"} target="_blank" rel="noopener noreferrer"
                  style={{display:"flex",gap:12,padding:"12px 14px",borderRadius:10,border:"1px solid #f8bbd0",background:"#fff",textDecoration:"none",color:"inherit",transition:"all .15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.background="#fce4ec"}}
                  onMouseLeave={e=>{e.currentTarget.style.background="#fff"}}
                >
                  <div style={{width:44,height:44,borderRadius:8,background:"#fce4ec",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem",flexShrink:0}}>{a.icon||"⚠️"}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:5,marginBottom:5,flexWrap:"wrap"}}>
                      {a.severity&&<span style={{padding:"2px 8px",borderRadius:10,fontSize:".64rem",fontWeight:700,background:"#fce4ec",color:"#880e4f"}}>Class {a.severity.replace(/[^IVX]/g,"")||a.severity}</span>}
                      <span style={{padding:"2px 8px",borderRadius:10,fontSize:".64rem",fontWeight:600,background:T.bg,color:T.mute}}>{a.type==="device_recall"?"Device":"Drug"}</span>
                    </div>
                    <div style={{fontSize:".86rem",fontWeight:600,color:T.txt,lineHeight:1.4,marginBottom:4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{a.title}</div>
                    {a.reason&&<div style={{fontSize:".74rem",color:T.txt2,lineHeight:1.5,marginBottom:4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{a.reason}</div>}
                    <div style={{fontSize:".68rem",color:T.mute,fontStyle:"italic"}}>{a.firm||"FDA"}{a.pubdate?` · ${a.pubdate}`:""} · View on FDA.gov →</div>
                  </div>
                </a>)}
              </div>
            </div>}

            {!anyContent&&!researchLoading&&!newsFeedsLoading&&isAdmin&&<div style={{...T.card,textAlign:"center",padding:30,color:T.txt2,fontSize:".84rem",lineHeight:1.55,marginBottom:14}}>
              <div style={{fontSize:"2rem",marginBottom:8}}>📰</div>
              <div style={{fontWeight:600,color:T.txt,marginBottom:6}}>All news feeds are empty</div>
              <div style={{fontSize:".78rem"}}>
                Check that <code style={{background:T.bg,padding:"1px 6px",borderRadius:4,fontSize:".74rem"}}>/api/research</code>, <code style={{background:T.bg,padding:"1px 6px",borderRadius:4,fontSize:".74rem"}}>/api/fda-alerts</code>, <code style={{background:T.bg,padding:"1px 6px",borderRadius:4,fontSize:".74rem"}}>/api/clinical-trials</code>, and <code style={{background:T.bg,padding:"1px 6px",borderRadius:4,fontSize:".74rem"}}>/api/industry-news</code> are all deployed. Try opening each URL directly to test.
              </div>
            </div>}

          </>);
        })()}

        {/* Testimonials section removed — will be added back when 3+ real quotes are collected
            from the community via direct outreach. Don't use placeholder/fake quotes here. */}

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
            .me-grid { grid-template-columns: 1fr !important; }
            .leaderboard-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>}
      {pg==="home"&&selA&&<div>
        <button onClick={()=>setSelA(null)} style={{...T.btnO,...T.btnSm,marginBottom:14}}>← Back</button>
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 360px",gap:20,alignItems:"start"}} className="article-grid">
          <div style={{minWidth:0}}>{/* MAIN ARTICLE COLUMN */}
        <ViewTracker trackingKey={`articles_${selA.id}`} onView={()=>{if(selA.authorUid===au?.uid||selA.uid===au?.uid)return;const newCount=(selA.views||0)+1;fbSet("articles",selA.id,{views:newCount});setArticles(prev=>prev.map(x=>x.id===selA.id?{...x,views:newCount}:x));setSelA(p=>({...p,views:newCount}))}}>
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

            {/* Article body — new articles use blocks[], old ones use body string */}
            {selA.blocks && selA.blocks.length > 0
              ? <BlockRenderer blocks={selA.blocks} style={{fontSize:"1.05rem",color:T.txt,fontFamily:"Georgia, 'Times New Roman', serif"}}/>
              : <MarkdownView text={selA.body} style={{fontSize:"1.05rem",color:T.txt,fontFamily:"Georgia, 'Times New Roman', serif"}}/>
            }

            {/* References */}
            {selA.refs&&<div style={{marginTop:32,paddingTop:18,borderTop:"1px solid "+T.border}}>
              <div style={{fontSize:".7rem",color:T.teal,fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>References</div>
              <div style={{fontSize:".82rem",color:T.txt2,lineHeight:1.75,whiteSpace:"pre-wrap",fontFamily:"Georgia, serif"}}>{selA.refs}</div>
            </div>}

            {/* Engagement */}
            <div style={{display:"flex",alignItems:"center",gap:12,marginTop:28,paddingTop:18,borderTop:"1px solid "+T.border,flexWrap:"wrap"}}>
              <LikeBtn liked={(selA.likedBy||[]).includes(au?.uid)} count={selA.likes||0} onToggle={()=>{toggleLike("articles",selA.id,selA,setArticles);setSelA(p=>{const lb=p.likedBy||[];const has=lb.includes(au.uid);const nlb=has?lb.filter(u=>u!==au.uid):[...lb,au.uid];return{...p,likedBy:nlb,likes:nlb.length}})}}/>
              <ShareBar title={selA.title} url={`${SITE_URL}/?article=${selA.id}`} description={selA.body?.slice(0,120)} itemId={selA.id} itemType="articles" currentUser={au} prof={prof} onSaveToggle={toggleSave} onShare={handleShare}/>
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

            <CommentThread collection="articles" itemId={selA.id} item={selA} currentUser={au} uName={uName} uIni={uIni} uPhoto={uPhoto} allUsers={allUsers} sendEmail={sendEmail} onUpdate={(id,comments)=>{setArticles(p=>p.map(x=>x.id===id?{...x,comments}:x));setSelA(p=>({...p,comments}))}}/>
          </div>
        </article>
        </ViewTracker>
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
        <div style={{display:"flex",gap:6,overflowX:"auto",padding:"4px 0 14px"}}>{dates.map(d=>{const dt=new Date(d+"T12:00:00");const on=d===selD;const hasQuiz=quizzes.some(q=>q.date===d);return<div key={d} onClick={()=>setSelD(d)} style={{minWidth:52,padding:"8px 4px",textAlign:"center",borderRadius:10,border:`1.5px solid ${on?T.teal:T.border}`,cursor:"pointer",background:on?T.tealBg:"#fff",opacity:hasQuiz?1:.45}}><div style={{fontSize:".58rem",color:on?T.teal:T.mute,textTransform:"uppercase",fontWeight:on?600:400}}>{dN(d)}</div><div style={{fontSize:"1rem",fontWeight:700,color:on?T.teal:T.txt}}>{dt.getDate()}</div></div>})}</div>
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
            {!isT&&<div style={{background:T.warnBg,borderLeft:"3px solid "+T.warn,padding:"10px 14px",marginBottom:14,borderRadius:"0 8px 8px 0",fontSize:".82rem",color:T.warn,lineHeight:1.5}}>
              📚 <b>Review mode</b> — this quiz was published on {fD(qObj.date)}. You can still answer it for learning, but <b>no points are awarded</b> for past quizzes. Only today's quiz earns points.
            </div>}
            <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}><span style={{fontSize:".8rem",color:T.mute}}>📅 {fD(qObj.date)}</span>{isT&&hr<21&&<span style={T.tag(T.okBg,T.ok)}>● LIVE</span>}{rev&&!isT&&<span style={T.tag(T.errBg,T.err)}>Closed</span>}<span style={{fontSize:".72rem",color:T.mute,marginLeft:"auto"}}>{Object.keys(qObj.answers||{}).length} answered</span></div>
            <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}><span style={T.tag(T.tealBg,T.teal)}>{qObj.cat}</span><span style={T.tag(T.warnBg,T.warn)}>{qObj.diff}</span>{(qObj.views||0)>0&&<span style={{fontSize:".72rem",color:T.mute}}>👁️ {qObj.views} {qObj.views===1?"view":"views"}</span>}{Object.keys(qObj.answers||{}).length>0&&<span style={{fontSize:".72rem",color:T.mute}}>✏️ {Object.keys(qObj.answers).length} answered</span>}</div>
            {qObj.scen&&<div style={{background:T.bg,borderLeft:"3px solid "+T.gold,padding:"12px 16px",marginBottom:16,borderRadius:"0 10px 10px 0",fontSize:".9rem",color:T.txt2,lineHeight:1.65}}>{qObj.scen}</div>}
            <div style={{fontSize:"1.1rem",fontWeight:600,lineHeight:1.6,marginBottom:16}}>{qObj.question}</div>
            {qObj.opts.map((o,i)=>{const l="ABC"[i];const sr=uA!==undefined||(rev&&!canA);const co=sr&&i===qObj.ci;const wr=sr&&i===uA&&uA!==qObj.ci;
              return<div key={i} onClick={()=>canA&&submitAnswer(qObj.id,qObj,i)} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px 16px",background:co?T.okBg:wr?T.errBg:"#fff",border:`1.5px solid ${co?"#1a7d42":wr?"#c0392b":T.border}`,borderRadius:12,marginBottom:10,cursor:canA?"pointer":"default",opacity:!canA&&!sr?.5:1}}><div style={{...T.av(28,co?"#1a7d42":wr?"#c0392b":T.tealBg,co||wr?"#fff":T.teal),fontSize:".78rem",flexShrink:0}}>{l}</div><div style={{fontSize:".92rem",lineHeight:1.55}}>{o}</div></div>})}
            {uA!==undefined&&<p style={{color:uA===qObj.ci?T.ok:T.err,fontWeight:600,marginTop:10}}>{uA===qObj.ci?"✓ Correct!":"✗ Incorrect."}</p>}
            {((uA!==undefined&&rev)||(!canA&&rev&&dd>0))&&qObj.expl&&<div style={{background:T.goldBg,border:"1px solid #f0e6c8",borderRadius:12,padding:16,marginTop:12}}><div style={{color:T.goldD,fontWeight:700,marginBottom:8}}>💡 Explanation</div><div style={{fontSize:".88rem",color:T.txt2,lineHeight:1.75}} dangerouslySetInnerHTML={{__html:qObj.expl}}/></div>}
            <div style={{display:"flex",alignItems:"center",gap:12,marginTop:14,paddingTop:12,borderTop:"1px solid "+T.border,flexWrap:"wrap"}}>
              <LikeBtn liked={(qObj.likedBy||[]).includes(au?.uid)} count={qObj.likes||0} onToggle={()=>toggleLike("quizzes",qObj.id,qObj,setQuizzes)}/>
              <ShareBar title={`SKINARIO Daily Quiz: ${qObj.cat} (${qObj.diff})`} url={`${SITE_URL}/?quiz=${qObj.id}`} description={qObj.question?.slice(0,120)} itemId={qObj.id} itemType="quizzes" currentUser={au} prof={prof} onSaveToggle={toggleSave} onShare={handleShare}/>
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
              {r.url&&<ShareBar title={r.title||r.t} url={r.url} description={`Resource from SKINARIO: ${r.title||r.t}`} itemId={r.id} itemType="resources" currentUser={au} prof={prof} onSaveToggle={toggleSave} onShare={handleShare}/>}
            </div>
            <CommentThread collection="resources" itemId={r.id} item={r} currentUser={au} uName={uName} uIni={uIni} uPhoto={uPhoto} allUsers={allUsers} sendEmail={sendEmail} onUpdate={(id,comments)=>setResources(p=>p.map(x=>x.id===id?{...x,comments}:x))}/>
          </div>)}
        </div>
      </div>}

      {/* VIDEOS */}
      {/* ═══ VENDOR DIRECTORY PAGE ═══
          Public-facing directory of approved brands and vendors.
          Doctors can browse by category, see company profiles, visit websites. */}
      {pg==="vendors"&&(()=>{
        const [vendorFilter,setVendorFilter]=useState("all");
        const [vendorSearch,setVendorSearch]=useState("");
        const [selVendor,setSelVendor]=useState(null);

        // Approved vendor/brand users + those with approved vendorApplications
        const approvedVendorUids=new Set(vendorApplications.filter(a=>a.status==="approved").map(a=>a.uid));
        const vendorUsers=allUsers.filter(u=>{
          const aType=u.accountType||"";
          return (aType==="vendor"||aType==="brand"||aType==="pharma")&&(u.verified||approvedVendorUids.has(u.id));
        });

        const categories=["all",...new Set(vendorUsers.map(u=>u.vendorCategory||u.brandCategory||"Other").filter(Boolean))];

        const filtered=vendorUsers.filter(u=>{
          const cat=u.vendorCategory||u.brandCategory||"";
          const matchCat=vendorFilter==="all"||cat===vendorFilter;
          const matchSearch=!vendorSearch||(u.companyName||u.name||"").toLowerCase().includes(vendorSearch.toLowerCase());
          return matchCat&&matchSearch;
        });

        if(selVendor){
          const va=vendorApplications.find(a=>a.uid===selVendor.id);
          const vRewards=rewards.filter(r=>r.vendorId===selVendor.id&&r.active!==false);
          return(<div>
            <button onClick={()=>setSelVendor(null)} style={{...T.btnO,...T.btnSm,marginBottom:16}}>← Back to vendors</button>
            <div style={{...T.card,padding:24,marginBottom:14}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:18,flexWrap:"wrap",marginBottom:16}}>
                {selVendor.photo?<img src={selVendor.photo} alt="" style={{width:72,height:72,borderRadius:10,objectFit:"cover",border:"1px solid "+T.border}}/>
                :<div style={{width:72,height:72,borderRadius:10,background:T.tealBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.8rem"}}>🏭</div>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"1.3rem",fontWeight:700,color:T.txt,marginBottom:4}}>{selVendor.companyName||selVendor.name}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                    <span style={{fontSize:".72rem",padding:"2px 10px",borderRadius:10,background:T.tealBg,color:T.teal,fontWeight:600}}>
                      {selVendor.accountType==="vendor"?"🏭 Vendor":"💊 Brand / Pharma"}
                    </span>
                    {(selVendor.vendorCategory||selVendor.brandCategory)&&<span style={{fontSize:".72rem",padding:"2px 10px",borderRadius:10,background:T.bg,color:T.txt2}}>{selVendor.vendorCategory||selVendor.brandCategory}</span>}
                    {selVendor.country&&<span style={{fontSize:".72rem",padding:"2px 10px",borderRadius:10,background:T.bg,color:T.txt2}}>📍 {selVendor.country}</span>}
                  </div>
                  {selVendor.address&&<div style={{fontSize:".82rem",color:T.txt2,marginBottom:4}}>📍 {selVendor.address}</div>}
                  {selVendor.website&&<a href={selVendor.website} target="_blank" rel="noopener noreferrer" style={{fontSize:".82rem",color:T.teal,textDecoration:"none"}}>🌐 {selVendor.website.replace(/^https?:\/\//,"")}</a>}
                </div>
              </div>
              {va?.offerings&&<div style={{padding:"12px 14px",background:T.bg,borderRadius:8,fontSize:".88rem",color:T.txt,lineHeight:1.6,marginBottom:12}}>
                <div style={{fontSize:".68rem",fontWeight:600,color:T.mute,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>About</div>
                {va.offerings}
              </div>}
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:8}}>
                {selVendor.contactPerson&&<div style={{fontSize:".82rem",color:T.txt2}}>👤 {selVendor.contactPerson}</div>}
                {selVendor.email&&<a href={`mailto:${selVendor.email}`} style={{fontSize:".82rem",color:T.teal,textDecoration:"none"}}>✉️ {selVendor.email}</a>}
              </div>
            </div>
            {vRewards.length>0&&<div style={T.card}>
              <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:12}}>🎁 Rewards offered by this partner</h4>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>
                {vRewards.map(r=><div key={r.id} style={{padding:14,background:T.bg,borderRadius:8,border:"1px solid "+T.border}}>
                  {r.image&&<img src={r.image} alt="" style={{width:"100%",height:100,objectFit:"cover",borderRadius:6,marginBottom:8}}/>}
                  <div style={{fontSize:".88rem",fontWeight:600,marginBottom:4}}>{r.title}</div>
                  <div style={{fontSize:".72rem",color:T.mute,marginBottom:8,lineHeight:1.5}}>{r.description?.slice(0,100)}</div>
                  <div style={{fontSize:".78rem",fontWeight:700,color:T.gold}}>{r.pointCost} pts to redeem</div>
                </div>)}
              </div>
            </div>}
          </div>);
        }

        return(<div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <h3 style={{fontSize:"1.15rem",fontWeight:700,margin:0}}>🏭 Vendor & Brand Directory</h3>
            <div style={{fontSize:".78rem",color:T.mute}}>{filtered.length} partner{filtered.length!==1?"s":""}</div>
          </div>

          {/* Search + filter */}
          <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
            <input value={vendorSearch} onChange={e=>setVendorSearch(e.target.value)} placeholder="Search by company name..." style={{...T.inp,flex:1,minWidth:180}}/>
            <select value={vendorFilter} onChange={e=>setVendorFilter(e.target.value)} style={{...T.inp,minWidth:160}}>
              {categories.map(c=><option key={c} value={c}>{c==="all"?"All categories":c}</option>)}
            </select>
          </div>

          {filtered.length===0?<div style={{...T.card,padding:"40px 20px",textAlign:"center",color:T.mute}}>
            No vendors found matching your search.
          </div>:
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
            {filtered.map(u=>{
              const va=vendorApplications.find(a=>a.uid===u.id);
              const vRewardCount=rewards.filter(r=>r.vendorId===u.id&&r.active!==false).length;
              return(<div key={u.id} onClick={()=>setSelVendor(u)} style={{...T.card,cursor:"pointer",transition:"transform .12s,box-shadow .12s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 18px rgba(0,0,0,0.09)"}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                  {u.photo?<img src={u.photo} alt="" style={{width:44,height:44,borderRadius:8,objectFit:"cover",border:"1px solid "+T.border,flexShrink:0}}/>
                  :<div style={{width:44,height:44,borderRadius:8,background:T.tealBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.2rem",flexShrink:0}}>{u.accountType==="vendor"?"🏭":"💊"}</div>}
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:".92rem",fontWeight:700,color:T.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.companyName||u.name}</div>
                    <div style={{fontSize:".7rem",color:T.mute}}>{u.vendorCategory||u.brandCategory||""}</div>
                  </div>
                </div>
                {va?.offerings&&<p style={{fontSize:".78rem",color:T.txt2,lineHeight:1.5,margin:"0 0 8px",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{va.offerings}</p>}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8}}>
                  <span style={{fontSize:".68rem",padding:"2px 8px",borderRadius:8,background:u.accountType==="vendor"?T.tealBg:T.goldBg,color:u.accountType==="vendor"?T.teal:T.gold,fontWeight:600}}>
                    {u.accountType==="vendor"?"Vendor":"Brand"}
                  </span>
                  {vRewardCount>0&&<span style={{fontSize:".68rem",color:T.mute}}>🎁 {vRewardCount} reward{vRewardCount!==1?"s":""}</span>}
                </div>
              </div>);
            })}
          </div>}
        </div>);
      })()}

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
        <ViewTracker trackingKey={`videos_${selV.id}`} onView={()=>{if(selV.authorUid===au?.uid||selV.uid===au?.uid)return;const newCount=(selV.views||0)+1;fbSet("videos",selV.id,{views:newCount});setVideos(prev=>prev.map(x=>x.id===selV.id?{...x,views:newCount}:x));setSelV(p=>({...p,views:newCount}))}}>
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
            <ShareBar title={selV.title||selV.t} url={`${SITE_URL}/?video=${selV.id}`} description={selV.desc?.slice(0,120)} itemId={selV.id} itemType="videos" currentUser={au} prof={prof} onSaveToggle={toggleSave} onShare={handleShare}/>
          </div>
          <CommentThread collection="videos" itemId={selV.id} item={selV} currentUser={au} uName={uName} uIni={uIni} uPhoto={uPhoto} allUsers={allUsers} sendEmail={sendEmail} onUpdate={(id,comments)=>{setVideos(p=>p.map(x=>x.id===id?{...x,comments}:x));setSelV(p=>({...p,comments}))}}/>
        </div>
        </ViewTracker>
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
              <ShareBar title={selAd.title} url={`${SITE_URL}/?ad=${selAd.id}`} description={selAd.desc?.slice(0,120)} itemId={selAd.id} itemType="ads" currentUser={au} prof={prof} onSaveToggle={toggleSave} onShare={handleShare}/>
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
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button onClick={()=>{setSubmitType("event");go("submit")}} style={{...T.btn,padding:"7px 14px",fontSize:".82rem"}}>📨 Submit event</button>
              {isAdm&&<button onClick={()=>{setATab("events");go("admin")}} style={T.btnO}>⚙️ Manage</button>}
            </div>
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
                <ShareBar title={selE.title} url={`${SITE_URL}/?event=${selE.id}`} description={selE.body?.slice(0,120)} itemId={selE.id} itemType="events" currentUser={au} prof={prof} onSaveToggle={toggleSave} onShare={handleShare}/>
              </div>
              <CommentThread collection="events" itemId={selE.id} item={selE} currentUser={au} uName={uName} uIni={uIni} uPhoto={uPhoto} allUsers={allUsers} sendEmail={sendEmail} onUpdate={(id,comments)=>{setEvents(p=>p.map(x=>x.id===id?{...x,comments}:x));setSelE(p=>({...p,comments}))}}/>
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
              <div style={{marginBottom:12}}><MarkdownEditor value={ccHistory} onChange={setCcHistory} placeholder="Patient demographics, chief complaint, duration of symptoms, relevant past history..." rows={3}/></div>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>💊 Treatment given</label>
              <div style={{marginBottom:12}}><MarkdownEditor value={ccTreatment} onChange={setCcTreatment} placeholder="Medications prescribed, procedures performed, dosage, duration..." rows={3}/></div>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>📈 Outcome</label>
              <div style={{marginBottom:12}}><MarkdownEditor value={ccOutcome} onChange={setCcOutcome} placeholder="Response to treatment, follow-up findings, current status..." rows={2}/></div>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>💡 Discussion question</label>
              <input value={ccDiag} onChange={e=>setCcDiag(e.target.value)} placeholder="What's your differential? Any thoughts on management?" style={{...T.inp,marginBottom:14}}/>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Additional notes</label>
              <div style={{marginBottom:4}}><MarkdownEditor value={ccB} onChange={setCcB} placeholder="Any additional context (optional)..." rows={2}/></div>
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
        {/* ═══ CASE DETAIL VIEW — when a case is selected ═══ */}
        {selCs&&(()=>{
          const cs=cases.find(x=>x.id===selCs.id)||selCs;
          return(<div>
            <button onClick={()=>setSelCs(null)} style={{...T.btnO,...T.btnSm,marginBottom:14}}>← Back to cases</button>
            <ViewTracker trackingKey={`cases_${cs.id}`} onView={()=>{if(cs.uid===au?.uid)return;const newCount=(cs.views||0)+1;fbSet("cases",cs.id,{views:newCount});setCases(prev=>prev.map(x=>x.id===cs.id?{...x,views:newCount}:x))}}>
              <div style={{...T.card,padding:0,overflow:"hidden"}}>
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
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    {cs.photo?<img src={cs.photo} onClick={()=>viewProfile(cs.uid)} style={{width:36,height:36,borderRadius:"50%",cursor:"pointer"}}/>:<div onClick={()=>viewProfile(cs.uid)} style={{...T.av(36,T.tealBg,T.teal),cursor:"pointer"}}>{cs.ini||"?"}</div>}
                    <div style={{flex:1}}>
                      <b onClick={()=>viewProfile(cs.uid)} style={{fontSize:".88rem",cursor:"pointer"}}>{cs.author}</b>
                      <div style={{fontSize:".7rem",color:T.mute}}>{fD(cs.date)}</div>
                    </div>
                    <span style={T.tag(T.tealBg,T.teal)}>{cs.cat}</span>
                  </div>
                  <h3 style={{fontSize:"1.2rem",fontWeight:700,lineHeight:1.35,marginBottom:14}}>{cs.title}</h3>
                  {cs.history&&<div style={{marginBottom:14}}>
                    <div style={{fontSize:".68rem",color:T.teal,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:5}}>📝 History & Presentation</div>
                    <MarkdownView text={cs.history} style={{fontSize:".9rem",color:T.txt2}}/>
                  </div>}
                  {cs.treatment&&<div style={{marginBottom:14}}>
                    <div style={{fontSize:".68rem",color:T.teal,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:5}}>💊 Treatment Given</div>
                    <MarkdownView text={cs.treatment} style={{fontSize:".9rem",color:T.txt2}}/>
                  </div>}
                  {cs.outcome&&<div style={{marginBottom:14}}>
                    <div style={{fontSize:".68rem",color:T.teal,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:5}}>📈 Outcome</div>
                    <MarkdownView text={cs.outcome} style={{fontSize:".9rem",color:T.txt2}}/>
                  </div>}
                  {cs.body&&<div style={{marginBottom:14}}>
                    <MarkdownView text={cs.body} style={{fontSize:".9rem",color:T.txt2}}/>
                  </div>}
                  {cs.diagnosis&&<div style={{background:T.goldBg,borderLeft:"3px solid "+T.gold,padding:"12px 16px",marginBottom:14,borderRadius:"0 10px 10px 0"}}>
                    <div style={{fontSize:".68rem",color:T.goldD,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>💡 Discussion</div>
                    <div style={{fontSize:".95rem",color:T.txt,lineHeight:1.6,fontWeight:500}}>{cs.diagnosis}</div>
                  </div>}
                  <div style={{display:"flex",alignItems:"center",gap:12,paddingTop:12,borderTop:"1px solid "+T.border,flexWrap:"wrap"}}>
                    <LikeBtn liked={(cs.likedBy||[]).includes(au?.uid)} count={cs.likes||0} onToggle={()=>toggleLike("cases",cs.id,cs,setCases)}/>
                    <span style={{fontSize:".75rem",color:T.mute}}>💬 {cs.comments?.length||0} comments</span>
                    {(cs.views||0)>0&&<span style={{fontSize:".75rem",color:T.mute}}>👁️ {cs.views} views</span>}
                    <ShareBar title={cs.title} url={`${SITE_URL}/?case=${cs.id}`} description={(cs.history||cs.body||"").slice(0,120)} itemId={cs.id} itemType="cases" currentUser={au} prof={prof} onSaveToggle={toggleSave} onShare={handleShare}/>
                  </div>
                  {(cs.comments||[]).length>0&&<div style={{marginTop:12,paddingLeft:10,borderLeft:"2px solid "+T.border}}>
                    {cs.comments.map((x,i)=><div key={i} style={{padding:"6px 0",fontSize:".85rem"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}><div style={T.av(20,T.tealBg,T.teal)}>{x.ini}</div><b style={{color:T.txt,fontSize:".82rem"}}>{x.n}</b><span style={{color:T.mute,fontSize:".62rem"}}>{x.tm}</span></div>
                      <div style={{color:T.txt2,paddingLeft:26,lineHeight:1.5}}>{renderTextWithMentions(x.txt)}</div>
                    </div>)}
                  </div>}
                  <CaseCmtInput caseId={cs.id} caseObj={cs} addCaseComment={addCaseComment} allUsers={allUsers}/>
                </div>
              </div>
            </ViewTracker>
          </div>);
        })()}

        {/* ═══ CASE CARD GRID — browse mode ═══ */}
        {!selCs&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
          {cases.map(cs=>{
            const replyCount=cs.comments?.length||0;
            return(<div key={cs.id} onClick={()=>{setSelCs(cs);window.scrollTo(0,0)}} style={{...T.card,padding:0,overflow:"hidden",cursor:"pointer",transition:"all .15s",boxShadow:"0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 22px rgba(0,0,0,0.07)"}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)"}}>
              {cs.images?.length>0?<div style={{width:"100%",aspectRatio:"4/3",overflow:"hidden",background:"#f4f1ea",position:"relative"}}>
                <img src={cs.images[0]} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                {cs.images.length>1&&<div style={{position:"absolute",bottom:6,right:6,background:"rgba(0,0,0,0.65)",color:"#fff",fontSize:".62rem",padding:"2px 7px",borderRadius:10,fontWeight:600}}>+{cs.images.length-1}</div>}
              </div>:<div style={{width:"100%",aspectRatio:"4/3",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2rem",color:T.mute}}>🔬</div>}
              <div style={{padding:14}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                  <span style={T.tag(T.tealBg,T.teal)}>{cs.cat}</span>
                </div>
                <h4 style={{fontSize:".98rem",fontWeight:700,lineHeight:1.35,marginBottom:8,color:T.txt,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{cs.title}</h4>
                {cs.history&&<p style={{fontSize:".78rem",color:T.txt2,lineHeight:1.5,marginBottom:10,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{cs.history.replace(/[*#-]/g,"").slice(0,120)}</p>}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:10,borderTop:"1px solid "+T.border,gap:8,flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0,flex:1}}>
                    {cs.photo?<img src={cs.photo} style={{width:22,height:22,borderRadius:"50%",flexShrink:0}}/>:<div style={{...T.av(22,T.tealBg,T.teal),fontSize:".6rem",flexShrink:0}}>{cs.ini||"?"}</div>}
                    <span style={{fontSize:".7rem",color:T.mute,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cs.author}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10,fontSize:".7rem",color:T.mute,flexShrink:0}}>
                    <span>❤️ {cs.likes||0}</span>
                    <span>💬 {replyCount}</span>
                    {(cs.views||0)>0&&<span>👁️ {cs.views}</span>}
                  </div>
                </div>
              </div>
            </div>);
          })}
        </div>}
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
            <div style={{marginBottom:14}}>
              <BlockEditor blocks={fpBlocks} onChange={setFpBlocks} uploadPath="forum-blocks"/>
              <div style={{fontSize:".7rem",color:T.mute,marginTop:6,lineHeight:1.5}}>
                Add paragraphs and drop clinical photos inline anywhere in your post.
              </div>
            </div>
            <button onClick={postForum} disabled={!fpT.trim()} style={{...T.btn,opacity:fpT.trim()?1:.5}}>Publish discussion</button>
          </div>}

          {/* Category filter chips */}
          {totalPosts>0&&<div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:14,flexWrap:"wrap"}}>
            {[["all","🌐 All",totalPosts],...TOPICS.map(t=>[t,t,forumPosts.filter(p=>p.cat===t).length])].filter(([id,l,n])=>id==="all"||n>0).map(([id,l,n])=><button key={id} onClick={()=>setATab("fc_"+id)} style={{padding:"7px 14px",borderRadius:20,border:`1.5px solid ${forumFilter===id?T.teal:T.border}`,background:forumFilter===id?T.tealBg:"#fff",color:forumFilter===id?T.teal:T.mute,cursor:"pointer",fontSize:".78rem",fontWeight:forumFilter===id?600:400,fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>{l} <span style={{opacity:.6}}>{n}</span></button>)}
          </div>}

          {/* Posts feed */}
          {filtered.length===0&&!newForum&&<div style={{...T.card,textAlign:"center",padding:50}}><div style={{fontSize:"2.4rem",marginBottom:8}}>💬</div><p style={{color:T.mute,fontSize:".95rem"}}>{forumFilter==="all"?"No discussions yet. Be the first to start one!":`No posts in "${forumFilter}" category yet.`}</p></div>}

          {/* ═══ DETAIL VIEW — when a post is selected ═══ */}
          {selFP&&(()=>{
            const p=forumPosts.find(x=>x.id===selFP.id)||selFP;
            const hasImg=p.images?.length>0;
            const isHot=(p.likes||0)>=3;
            return(<div>
              <button onClick={()=>setSelFP(null)} style={{...T.btnO,...T.btnSm,marginBottom:14}}>← Back to discussions</button>
              <ViewTracker trackingKey={`forum_${p.id}`} onView={()=>{if(p.uid===au?.uid)return;const newCount=(p.views||0)+1;fbSet("forum",p.id,{views:newCount});setForumPosts(prev=>prev.map(x=>x.id===p.id?{...x,views:newCount}:x))}}>
                <div style={{...T.card,padding:0,overflow:"hidden",marginBottom:0}}>
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
                    <h3 style={{fontSize:"1.3rem",fontWeight:700,lineHeight:1.35,marginBottom:10,color:T.txt}}>{p.title}</h3>
                    {/* Render blocks (new posts) or plain body (old posts) */}
                    {p.blocks?.length>0
                      ? <div style={{marginBottom:14}}><BlockRenderer blocks={p.blocks} style={{fontSize:".95rem",color:T.txt}}/></div>
                      : p.body&&<div style={{fontSize:".95rem",color:T.txt2,marginBottom:14}}><MarkdownView text={p.body}/></div>
                    }
                    <div style={{display:"flex",alignItems:"center",gap:12,paddingTop:12,borderTop:"1px solid "+T.border,flexWrap:"wrap"}}>
                      <LikeBtn liked={(p.likedBy||[]).includes(au?.uid)} count={p.likes||0} onToggle={()=>toggleLike("forum",p.id,p,setForumPosts)}/>
                      <span style={{fontSize:".78rem",color:T.mute,display:"flex",alignItems:"center",gap:4}}>💬 {p.comments?.length||0} {p.comments?.length===1?"reply":"replies"}</span>
                      {(p.views||0)>0&&<span style={{fontSize:".78rem",color:T.mute,display:"flex",alignItems:"center",gap:4}}>👁️ {p.views}</span>}
                      <ShareBar title={p.title} url={`${SITE_URL}/?forum=${p.id}`} description={p.body?.slice(0,120)} itemId={p.id} itemType="forum" currentUser={au} prof={prof} onSaveToggle={toggleSave} onShare={handleShare}/>
                    </div>
                    <CommentThread collection="forum" itemId={p.id} item={p} currentUser={au} uName={uName} uIni={uIni} uPhoto={uPhoto} allUsers={allUsers} sendEmail={sendEmail} onUpdate={(id,comments)=>setForumPosts(prev=>prev.map(x=>x.id===id?{...x,comments,replies:comments.length}:x))} onAfterPost={(text)=>{if(text.trim().length>=20)awardPoints("forum_comment")}}/>
                  </div>
                </div>
              </ViewTracker>
            </div>);
          })()}

          {/* ═══ CARD GRID — browse mode ═══ */}
          {!selFP&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
          {filtered.map(p=>{
            const hasImg=p.images?.length>0;
            const isHot=(p.likes||0)>=3;
            const replyCount=p.comments?.length||0;
            return(<div key={p.id} onClick={()=>{setSelFP(p);window.scrollTo(0,0)}} style={{...T.card,padding:0,overflow:"hidden",marginBottom:0,cursor:"pointer",transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 22px rgba(0,0,0,0.07)"}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}>
              {hasImg&&<div style={{width:"100%",aspectRatio:"16/9",overflow:"hidden",background:"#f4f1ea",position:"relative"}}>
                <img src={p.images[0]} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                {p.images.length>1&&<div style={{position:"absolute",bottom:6,right:6,background:"rgba(0,0,0,0.65)",color:"#fff",fontSize:".62rem",padding:"2px 7px",borderRadius:10,fontWeight:600}}>+{p.images.length-1}</div>}
              </div>}
              <div style={{padding:16}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={T.tag(T.tealBg,T.teal)}>{p.cat}</span>
                  {isHot&&<span style={T.tag(T.warnBg,T.warn)}>🔥</span>}
                </div>
                <h4 style={{fontSize:"1rem",fontWeight:700,lineHeight:1.35,marginBottom:8,color:T.txt,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{p.title}</h4>
                {p.body&&<p style={{fontSize:".82rem",color:T.txt2,lineHeight:1.55,marginBottom:10,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{p.body.replace(/[*#-]/g,"").slice(0,140)}</p>}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:10,borderTop:"1px solid "+T.border,gap:8,flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0,flex:1}}>
                    {p.photo?<img src={p.photo} style={{width:22,height:22,borderRadius:"50%",flexShrink:0}}/>:<div style={{...T.av(22,T.tealBg,T.teal),fontSize:".6rem",flexShrink:0}}>{p.ini||"?"}</div>}
                    <span style={{fontSize:".7rem",color:T.mute,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.author}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10,fontSize:".7rem",color:T.mute,flexShrink:0}}>
                    <span>❤️ {p.likes||0}</span>
                    <span>💬 {replyCount}</span>
                    <span>👁️ {p.views||0}</span>
                  </div>
                </div>
              </div>
            </div>);
          })}
          </div>}
        </div>);
      })()}

      {/* RANK */}
      {pg==="rank"&&<div style={{maxWidth:1100}}>
        {/* ═══ HEADER (compact) ═══ */}
        <div style={{...T.card,padding:18,background:"linear-gradient(135deg,#fff,"+T.goldBg+"55)",borderLeft:"3px solid "+T.gold,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:240}}>
            <h3 style={{fontSize:"1.2rem",fontWeight:700,margin:0}}>🏆 SKINARIO Leaderboard</h3>
            <p style={{color:T.txt2,fontSize:".82rem",marginTop:5,marginBottom:0,lineHeight:1.5}}>Compete with peers across India based on knowledge and consistency.</p>
          </div>
          {/* Personal points + Redeem CTA — only for doctor accounts */}
          {prof?.accountType==="doctor"&&<div onClick={()=>go("rewards")} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"#fff",borderRadius:10,border:"1px solid "+T.gold+"55",cursor:"pointer",transition:"all .15s",flexShrink:0}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 4px 14px rgba(0,0,0,0.08)"}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:".62rem",color:T.mute,letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>Available to redeem</div>
              <div style={{fontSize:"1.2rem",fontWeight:700,color:T.gold,lineHeight:1}}>{spendablePoints}</div>
            </div>
            <div style={{...T.btn,padding:"7px 14px",fontSize:".76rem",whiteSpace:"nowrap"}}>🎁 Redeem</div>
          </div>}
        </div>

        {/* ═══ EXPLAINER ROW: How points + Tier system side-by-side ═══ */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:10,marginBottom:14}} className="rank-explainer-grid">

        {/* ═══ COLLAPSIBLE: How points work ═══ */}
        <div style={{...T.card,marginBottom:0,padding:0,overflow:"hidden"}}>
          <div onClick={()=>setShowPoints(!showPoints)} style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0,flex:1}}>
              <span style={{fontSize:".95rem",fontWeight:600,whiteSpace:"nowrap"}}>💯 How points work</span>
              {!showPoints&&<span style={{fontSize:".72rem",color:T.mute,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>10–30pt quiz · +50 streak · 50pt case/article/forum · 10pt video/library</span>}
            </div>
            <span style={{fontSize:".85rem",color:T.mute,transition:"transform .2s",transform:showPoints?"rotate(180deg)":"rotate(0deg)",display:"inline-block"}}>▾</span>
          </div>
          {showPoints&&<div style={{padding:"4px 16px 16px",borderTop:"1px solid "+T.border}}>
            <p style={{fontSize:".74rem",color:T.mute,fontWeight:600,textTransform:"uppercase",letterSpacing:1,margin:"14px 0 8px"}}>Daily Quiz</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:14}}>
              {[["10 pts","Easy question"],["20 pts","Moderate question"],["30 pts","Hard question"],["+50 pts","Every 7-day streak"]].map(([v,l])=>
                <div key={l} style={{padding:"10px 12px",background:T.bg,borderRadius:8}}>
                  <div style={{fontSize:"1.1rem",fontWeight:700,color:T.gold,marginBottom:2}}>{v}</div>
                  <div style={{fontSize:".74rem",color:T.txt2}}>{l}</div>
                </div>)}
            </div>
            <p style={{fontSize:".74rem",color:T.mute,fontWeight:600,textTransform:"uppercase",letterSpacing:1,margin:"14px 0 8px"}}>Content Contribution</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:14}}>
              {[["50 pts","Clinical case posted"],["50 pts","Article submitted"],["50 pts","Forum discussion"],["10 pts","Video submitted"],["10 pts","Resource uploaded"]].map(([v,l])=>
                <div key={l} style={{padding:"10px 12px",background:T.tealBg+"55",borderRadius:8,border:"1px solid "+T.teal+"33"}}>
                  <div style={{fontSize:"1.1rem",fontWeight:700,color:T.teal,marginBottom:2}}>{v}</div>
                  <div style={{fontSize:".74rem",color:T.txt2}}>{l}</div>
                </div>)}
            </div>
            <p style={{fontSize:".75rem",color:T.txt2,lineHeight:1.55,marginBottom:0}}>Answer daily quizzes to earn quiz points. Contribute clinical cases, articles, videos, and forum discussions to earn content points. Streak bonuses fire every 7 consecutive correct answers.</p>
          </div>}
        </div>

        {/* ═══ COLLAPSIBLE: Tier system ═══ */}
        <div style={{...T.card,marginBottom:0,padding:0,overflow:"hidden"}}>
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

        </div>{/* end explainer grid */}

        {/* Leaderboards: All-time + Monthly side by side */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:14,marginBottom:14}} className="leaderboard-grid">

        {/* All-time Leaderboard */}
        <div style={{...T.card,padding:18,marginBottom:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <h4 style={{fontSize:".95rem",fontWeight:700,margin:0}}>🏆 All-Time Top {Math.min(leaderboard.length,20)}</h4>
            <span style={{fontSize:".7rem",color:T.mute}}>5+ Q or 50+ pts</span>
          </div>

          {/* Admin-only notice — visible only to admins so they understand they're filtered out */}
          {ADMINS.includes(au?.email)&&<div style={{padding:"8px 12px",background:T.bg,borderLeft:"3px solid "+T.mute,borderRadius:"0 6px 6px 0",marginBottom:12,fontSize:".74rem",color:T.txt2,lineHeight:1.55}}>
            🛡️ <b>Admins are hidden</b> from the public leaderboard for fairness.
          </div>}

          {leaderboard.length===0&&<div style={{textAlign:"center",padding:30,color:T.mute,fontSize:".88rem"}}>
            <div style={{fontSize:"2rem",marginBottom:6}}>🌱</div>
            No qualified rankings yet. Users need 5+ quizzes or 50+ points to appear.
          </div>}

          {leaderboard.map((u,i)=>{const uAcc=u.totalAnswered?Math.round(u.totalCorrect/u.totalAnswered*100):0;const isMe=u.id===au?.uid;
            return<div key={u.id} onClick={()=>viewProfile(u.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:10,marginBottom:6,background:isMe?T.tealBg:"#fff",border:`1px solid ${isMe?T.teal:T.border}`,cursor:"pointer"}}>
              <div style={{width:28,textAlign:"center",fontWeight:700,fontSize:i<3?"1.2rem":".9rem",color:i<3?["#d4a017","#888","#a0703a"][i]:T.txt2}}>{i<3?["🥇","🥈","🥉"][i]:`#${i+1}`}</div>
              {u.photo?<img src={u.photo} style={{width:34,height:34,borderRadius:"50%",objectFit:"cover"}}/>:<div style={T.av(34,isMe?T.teal:T.tealBg,isMe?"#fff":T.teal)}>{u.initials||"?"}</div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:".86rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}{isMe?" (You)":""}</div>
                <div style={{fontSize:".68rem",color:T.mute,display:"flex",gap:5,flexWrap:"wrap"}}>
                  <span>{uAcc}%</span><span>·</span><span>{u.totalAnswered||0}Q</span>
                  {(u.streak||0)>0&&<><span>·</span><span style={{color:T.gold}}>🔥{u.streak}d</span></>}
                </div>
              </div>
              <div style={{textAlign:"right",minWidth:48}}>
                <div style={{fontWeight:700,color:T.teal,fontSize:"1rem",lineHeight:1}}>{u.points||0}</div>
                <div style={{fontSize:".58rem",color:T.mute,letterSpacing:.5,textTransform:"uppercase"}}>pts</div>
              </div>
            </div>})}
        </div>

        {/* Monthly Leaderboard */}
        <div style={{...T.card,padding:18,marginBottom:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:8,flexWrap:"wrap"}}>
            <h4 style={{fontSize:".95rem",fontWeight:700,margin:0}}>📅 Monthly Top {Math.min(monthlyLeaderboard.length,20)}</h4>
            <select value={rankMonth} onChange={e=>setRankMonth(e.target.value)} style={{...T.inp,padding:"4px 8px",fontSize:".74rem",width:"auto",cursor:"pointer"}}>
              {availableMonths.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>

          {monthlyLeaderboard.length===0&&<div style={{textAlign:"center",padding:30,color:T.mute,fontSize:".88rem"}}>
            <div style={{fontSize:"2rem",marginBottom:6}}>📅</div>
            No points earned in {monthLabel(rankMonth)} yet.
          </div>}

          {monthlyLeaderboard.map((u,i)=>{const isMe=u.id===au?.uid;
            return<div key={u.id} onClick={()=>viewProfile(u.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:10,marginBottom:6,background:isMe?T.goldBg+"66":"#fff",border:`1px solid ${isMe?T.gold:T.border}`,cursor:"pointer"}}>
              <div style={{width:28,textAlign:"center",fontWeight:700,fontSize:i<3?"1.2rem":".9rem",color:i<3?["#d4a017","#888","#a0703a"][i]:T.txt2}}>{i<3?["🥇","🥈","🥉"][i]:`#${i+1}`}</div>
              {u.photo?<img src={u.photo} style={{width:34,height:34,borderRadius:"50%",objectFit:"cover"}}/>:<div style={T.av(34,isMe?T.gold:T.goldBg,isMe?"#fff":T.goldD)}>{u.initials||"?"}</div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:".86rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}{isMe?" (You)":""}</div>
                <div style={{fontSize:".68rem",color:T.mute}}>{monthLabel(rankMonth)}</div>
              </div>
              <div style={{textAlign:"right",minWidth:48}}>
                <div style={{fontWeight:700,color:T.gold,fontSize:"1rem",lineHeight:1}}>{u.monthScore}</div>
                <div style={{fontSize:".58rem",color:T.mute,letterSpacing:.5,textTransform:"uppercase"}}>pts</div>
              </div>
            </div>})}
        </div>

        </div>{/* end leaderboard grid */}

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
        // ═══ SUSPICION SIGNALS (admin-only) ═══
        // Multiple rules; user is "suspicious" if ANY hit. Each rule contributes a reason
        // string so admin sees WHY. Tunable thresholds based on the same-day quiz rule.
        const suspicionReasons=(()=>{
          if(!isAdmin||isMe)return[]; // admin-only, never on own profile
          const reasons=[];
          const total=u.totalAnswered||0;
          const pts=u.points||0;
          // Rule 1: back-answer farming (lots of quizzes, almost no points)
          if(total>=5&&pts/total<3){
            reasons.push(`Low points-per-quiz ratio (${pts} pts / ${total} answers = ${(pts/total).toFixed(1)} per quiz). Suggests back-answering old quizzes.`);
          }
          // Rule 2: implausibly perfect accuracy on 8+ quizzes
          if(total>=8&&acc2===100){
            reasons.push(`100% accuracy across ${total} quizzes. Statistically unlikely without pattern-exploitation or back-answering with hindsight.`);
          }
          // Rule 3: new account with heavy activity
          try{
            const joinedDate=new Date(u.joined+"T00:00:00");
            const ageHours=(Date.now()-joinedDate.getTime())/(1000*60*60);
            if(ageHours<48&&total>=6){
              reasons.push(`Joined ${Math.round(ageHours)}h ago but already answered ${total} quizzes. Only one quiz published per day — this implies heavy back-answering.`);
            }
          }catch{}
          return reasons;
        })();
        const isSuspicious=suspicionReasons.length>0;

        return(<div style={{maxWidth:780}}>
          <button onClick={()=>{setSelU(null);setPg(profileReturnPg||"home")}} style={{...T.btnO,...T.btnSm,marginBottom:14}}>← Back</button>

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
                    {u.role&&ROLE_DISPLAY[u.role]&&<span style={{padding:"3px 9px",borderRadius:12,fontSize:".7rem",fontWeight:700,letterSpacing:.5,background:ROLE_DISPLAY[u.role].bg,color:ROLE_DISPLAY[u.role].fg}}>{ROLE_DISPLAY[u.role].icon} {ROLE_DISPLAY[u.role].label}</span>}
                    {u.verified&&<span title="Verified by SKINARIO admin" style={{fontSize:"1.1rem",color:"#1d9bf0"}}>✓</span>}
                    {u.regFlagged&&isAdmin&&<span style={T.tag(T.errBg,T.err)} title={u.regFlagReason}>🚩 Flagged</span>}
                    {isSuspicious&&<span style={T.tag(T.errBg,T.err)} title="Pattern matches gaming behavior — see details below">⚠️ Suspicious activity</span>}
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
            {(u.accountType==="pharma"||u.accountType==="brand")&&<div style={{...T.card,marginBottom:14}}>
              <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:14}}>💊 Brand / Pharma Details</h4>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14}}>
                {u.companyName&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Company</div><div style={{fontSize:".88rem",color:T.txt}}>{u.companyName}</div></div>}
                {u.brandCategory&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Category</div><div style={{fontSize:".88rem",color:T.txt}}>{u.brandCategory}</div></div>}
                {u.contactPerson&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Contact</div><div style={{fontSize:".88rem",color:T.txt}}>{u.contactPerson}</div></div>}
                {u.country&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Country</div><div style={{fontSize:".88rem",color:T.txt}}>{u.country}</div></div>}
                {u.website&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Website</div><a href={u.website} target="_blank" rel="noopener noreferrer" style={{fontSize:".88rem",color:T.teal,textDecoration:"none"}}>{u.website.replace(/^https?:\/\//,"")} →</a></div>}
              </div>
            </div>}

            {/* Vendor-specific details */}
            {u.accountType==="vendor"&&<div style={{...T.card,marginBottom:14}}>
              <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:14}}>🏭 Vendor Details</h4>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14}}>
                {u.companyName&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Company</div><div style={{fontSize:".88rem",color:T.txt}}>{u.companyName}</div></div>}
                {u.vendorCategory&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Category</div><div style={{fontSize:".88rem",color:T.txt}}>{u.vendorCategory}</div></div>}
                {u.contactPerson&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Contact</div><div style={{fontSize:".88rem",color:T.txt}}>{u.contactPerson}</div></div>}
                {u.gstNumber&&<div><div style={{fontSize:".68rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>GST</div><div style={{fontSize:".88rem",color:T.txt,fontFamily:"monospace"}}>{u.gstNumber}</div></div>}
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

            {/* Suspicion details — admin-only, only when signals fire */}
            {isSuspicious&&<div style={{...T.card,marginBottom:14,background:T.errBg,borderLeft:"3px solid "+T.err}}>
              <h4 style={{fontSize:".88rem",fontWeight:700,marginBottom:8,color:T.err}}>⚠️ Suspicious Activity Detected</h4>
              <p style={{fontSize:".78rem",color:T.txt2,lineHeight:1.55,marginBottom:10}}>This user's profile matches one or more gaming patterns. Review the signals below and decide on any action (warn, contact, or use manual points adjustment). Not all flagged users are bad actors — review context first.</p>
              <ul style={{paddingLeft:18,margin:0,fontSize:".82rem",color:T.txt,lineHeight:1.6}}>
                {suspicionReasons.map((r,i)=><li key={i} style={{marginBottom:6}}>{r}</li>)}
              </ul>
              <div style={{fontSize:".7rem",color:T.mute,marginTop:10,paddingTop:10,borderTop:"1px solid "+T.border}}>
                💡 Only visible to admins. The user does not see this flag.
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

            {/* ═══ ADMIN: this user's points history ═══ */}
            {/* Show for any non-admin user — accountType might be missing/different on older accounts */}
            {isAdmin&&!isMe&&<div style={{...T.card,marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
                <h4 style={{fontSize:".95rem",fontWeight:700,margin:0}}>📊 Points history (admin view)</h4>
                <span style={{fontSize:".72rem",color:T.mute}}>{u.points||0} total · {profileLedger.reduce((s,e)=>s+(e.pointsEarned||0),0)} logged</span>
              </div>
              {profileLedger.length===0?
                <p style={{fontSize:".82rem",color:T.mute,fontStyle:"italic"}}>No logged history yet (points earned before logging started won't appear, but the total above is accurate).</p>
              :<div style={{display:"flex",flexDirection:"column",gap:6}}>
                {profileLedger.slice(0,20).map(e=>{
                  const meta={quiz_correct:{icon:"🧠",color:T.teal},forum_comment:{icon:"💬",color:"#7a3e9a"},case_post:{icon:"🔬",color:T.gold},share_unique:{icon:"🔗",color:"#0d6b6e"},legacy_backfill:{icon:"📅",color:T.mute}}[e.action]||{icon:"⭐",color:T.mute};
                  const label=e.label||e.action;
                  return(<div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:T.bg,borderRadius:8}}>
                    <div style={{fontSize:"1rem",width:24,textAlign:"center"}}>{meta.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:".8rem",fontWeight:500,color:T.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</div>
                      <div style={{fontSize:".64rem",color:T.mute}}>
                        {(() => {
                          const ts = e.createdAt || e.updatedAt;
                          if (ts) {
                            try {
                              return new Date(ts).toLocaleString("en-IN", {
                                day: "2-digit", month: "short", year: "2-digit",
                                hour: "2-digit", minute: "2-digit", second: "2-digit",
                                hour12: true
                              });
                            } catch { return e.date; }
                          }
                          return e.date;
                        })()}
                        {e.action ? ` · ${e.action}` : ""}
                      </div>
                    </div>
                    <div style={{fontSize:".85rem",fontWeight:700,color:meta.color}}>+{e.pointsEarned}</div>
                  </div>);
                })}
                {profileLedger.length>20&&<div style={{fontSize:".7rem",color:T.mute,textAlign:"center",marginTop:6}}>Showing 20 of {profileLedger.length}</div>}
              </div>}

              {/* ═══ MANUAL POINTS ADJUSTMENT (admin) ═══ */}
              <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid "+T.border}}>
                <div style={{fontSize:".82rem",fontWeight:600,color:T.err,marginBottom:6}}>⚠️ Manual points adjustment</div>
                <p style={{fontSize:".72rem",color:T.txt2,lineHeight:1.5,marginBottom:8}}>Use sparingly — for correcting gaming exploits or one-off issues. The new value REPLACES the lifetime total. Also updates this month's monthlyPoints proportionally so leaderboards reconcile.</p>
                <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                  <input id={`adj-${u.id}`} type="number" placeholder={`Current: ${u.points||0}`} style={{...T.inp,width:140,padding:"6px 10px",fontSize:".82rem"}}/>
                  <button onClick={async()=>{
                    const newVal=parseInt(document.getElementById(`adj-${u.id}`).value);
                    if(isNaN(newVal)||newVal<0){sh("Enter a valid non-negative number");return}
                    if(!confirm(`Set ${u.name}'s lifetime points to ${newVal}? (Currently ${u.points||0})`))return;
                    try{
                      const monthKey=todayIST_YMD().slice(0,7);
                      const curMonthly=(u.monthlyPoints||{})[monthKey]||0;
                      // Cap monthly at the new total — if newVal < curMonthly, monthly drops to newVal
                      const newMonthly=Math.min(curMonthly,newVal);
                      const monthlyPoints={...(u.monthlyPoints||{}),[monthKey]:newMonthly};
                      await fbSet("users",u.id,{points:newVal,monthlyPoints});
                      // Log the adjustment to the ledger for audit trail
                      const adjId=`${u.id}_adj_${Date.now()}`;
                      await fbSet("pointsActivity",adjId,{
                        uid:u.id,
                        date:todayIST_YMD(),
                        month:monthKey,
                        action:"admin_adjustment",
                        label:`Admin set total to ${newVal} (was ${u.points||0})`,
                        pointsEarned:newVal-(u.points||0),
                        createdAt:Date.now(),
                        adminUid:au.uid,
                      });
                      sh(`✅ ${u.name}: ${u.points||0} → ${newVal}`);
                      document.getElementById(`adj-${u.id}`).value="";
                      await loadData();
                    }catch(err){console.error("adjustment failed:",err);sh("❌ Adjustment failed")}
                  }} style={{...T.btnDanger,padding:"6px 14px",fontSize:".78rem"}}>Set new total</button>
                </div>
              </div>

              {/* ═══ CONSENT CREDIT GRANT (admin) ═══ */}
              <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid "+T.border}}>
                <div style={{fontSize:".82rem",fontWeight:600,color:T.teal,marginBottom:6}}>📋 Consent template credits</div>
                <p style={{fontSize:".72rem",color:T.txt2,lineHeight:1.5,marginBottom:8}}>
                  Current balance: <b>{u.consentCredits||0}</b> credits.
                  Users get 2 free generations per day. Use credits for overflow / paid usage.
                  Today's usage: {(u.consentGenerations||{})[todayIST_YMD()]||0}.
                </p>
                <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                  <input id={`cred-${u.id}`} type="number" placeholder="Add credits (e.g. 10)" style={{...T.inp,width:160,padding:"6px 10px",fontSize:".82rem"}}/>
                  <button onClick={async()=>{
                    const add=parseInt(document.getElementById(`cred-${u.id}`).value);
                    if(isNaN(add)||add<=0){sh("Enter a positive number");return}
                    if(!confirm(`Grant ${add} consent credits to ${u.name}? (Current: ${u.consentCredits||0})`))return;
                    try{
                      const newCredits=(u.consentCredits||0)+add;
                      await fbSet("users",u.id,{consentCredits:newCredits});
                      sh(`✅ +${add} credits → ${newCredits} total`);
                      document.getElementById(`cred-${u.id}`).value="";
                      await loadData();
                    }catch(err){console.error("credit grant failed:",err);sh("❌ Grant failed")}
                  }} style={{...T.btn,padding:"6px 14px",fontSize:".78rem"}}>Grant credits</button>
                </div>
              </div>
            </div>}
          </>}
        </div>);
      })()}

      {/* PROFILE */}
      {/* ═══ REWARDS PAGE — browse catalog + see your redemptions ═══ */}
      {/* ═══ SUBMIT CONTENT PAGE ═══ */}
      {pg==="submit"&&<div style={{maxWidth:760}}>
        <div style={{...T.card,padding:22,background:"linear-gradient(135deg,#fff,"+T.tealBg+"55)",borderLeft:"3px solid "+T.teal,marginBottom:16}}>
          <h2 style={{fontSize:"1.4rem",fontWeight:700,margin:0,display:"flex",alignItems:"center",gap:8}}>📨 Submit Content</h2>
          <p style={{color:T.txt2,fontSize:".88rem",marginTop:6,lineHeight:1.55,marginBottom:0}}>
            Share events, articles, videos, ads, or news with the SKINARIO community.
            Submissions are reviewed by admins before going live.
          </p>
        </div>

        {/* Type picker — show what each user is allowed to submit */}
        {!submitType&&<div style={T.card}>
          <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:12}}>What do you want to submit?</h4>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:10}}>
            {Object.entries(SUBMISSION_TYPES).map(([key,cfg])=>{
              const allowed=canSubmitType(key,au,prof);
              return(<div key={key} onClick={()=>{if(allowed)setSubmitType(key)}} style={{padding:14,borderRadius:10,border:`1.5px solid ${allowed?T.border:T.border}`,background:allowed?"#fff":T.bg,cursor:allowed?"pointer":"not-allowed",opacity:allowed?1:0.5,transition:"all .15s"}} onMouseEnter={e=>{if(allowed){e.currentTarget.style.borderColor=T.teal;e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.06)"}}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                  <span style={{fontSize:"1.4rem"}}>{cfg.icon}</span>
                  <span style={{fontWeight:600,fontSize:".95rem",color:T.txt}}>{cfg.label}</span>
                </div>
                <div style={{fontSize:".78rem",color:T.txt2,lineHeight:1.5,marginBottom:8}}>{cfg.description}</div>
                {!allowed&&<div style={{fontSize:".7rem",color:T.warn,fontWeight:600,padding:"4px 8px",background:T.warnBg,borderRadius:6,display:"inline-block"}}>🔒 Content Contributor role required</div>}
                {allowed&&cfg.openToAll&&<div style={{fontSize:".68rem",color:T.ok,fontWeight:600}}>✓ Open to all members</div>}
                {allowed&&!cfg.openToAll&&<div style={{fontSize:".68rem",color:T.teal,fontWeight:600}}>✓ You have access</div>}
              </div>);
            })}
          </div>
          {!prof?.role&&!isAdminUser(au?.email)&&<div style={{marginTop:14,padding:"10px 12px",background:T.bg,borderRadius:8,fontSize:".78rem",color:T.txt2,lineHeight:1.55}}>
            💡 To submit ads, news, articles, or videos, apply for the <b>Content Contributor</b> role from your <span onClick={()=>go("me")} style={{color:T.teal,fontWeight:600,cursor:"pointer",textDecoration:"underline"}}>Me page</span>. Events are open to everyone.
          </div>}
        </div>}

        {/* Form for selected type */}
        {submitType&&SUBMISSION_TYPES[submitType]&&<div style={T.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,paddingBottom:14,borderBottom:"1px solid "+T.border}}>
            <h4 style={{fontSize:"1rem",fontWeight:700,margin:0}}>{SUBMISSION_TYPES[submitType].icon} New {SUBMISSION_TYPES[submitType].label}</h4>
            <button onClick={()=>setSubmitType("")} style={{...T.btnO,padding:"6px 14px",fontSize:".82rem"}}>← Back</button>
          </div>
          <SubmissionForm
            typeKey={submitType}
            cfg={SUBMISSION_TYPES[submitType]}
            T={T}
            storage={storage}
            ref={ref}
            uploadBytes={uploadBytes}
            getDownloadURL={getDownloadURL}
            submitContent={submitContent}
            sh={sh}
            onSuccess={()=>setSubmitType("")}
          />
        </div>}

        {/* My Submissions */}
        {(()=>{
          const mine=submissions.filter(s=>s.submitterUid===au?.uid);
          if(mine.length===0)return null;
          return(<div style={{...T.card,marginTop:16}}>
            <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>📋 My submissions ({mine.length})</h4>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {mine.map(s=>{const cfg=SUBMISSION_TYPES[s.type]||{label:s.type,icon:"📄"};const statusColor={pending:T.warn,approved:T.ok,rejected:T.err}[s.status]||T.mute;const statusBg={pending:T.warnBg,approved:T.okBg,rejected:T.errBg}[s.status]||T.bg;return(
                <div key={s.id} style={{padding:"10px 12px",border:"1px solid "+T.border,borderRadius:8,background:"#fff"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:200}}>
                      <div style={{fontSize:".88rem",fontWeight:600,marginBottom:3}}>{cfg.icon} {s.data?.title||"Untitled"}</div>
                      <div style={{fontSize:".7rem",color:T.mute}}>{cfg.label} · {fD(s.date)}</div>
                      {s.status==="rejected"&&s.rejectionReason&&<div style={{fontSize:".78rem",color:T.txt2,marginTop:6,padding:"6px 10px",background:T.errBg,borderRadius:6,borderLeft:"3px solid "+T.err}}>
                        <b>Rejected:</b> {s.rejectionReason}
                      </div>}
                    </div>
                    <span style={{padding:"3px 9px",borderRadius:10,fontSize:".66rem",fontWeight:700,letterSpacing:.5,textTransform:"uppercase",background:statusBg,color:statusColor,flexShrink:0}}>{s.status||"pending"}</span>
                  </div>
                </div>
              );})}
            </div>
          </div>);
        })()}
      </div>}

      {pg==="rewards"&&<div style={{maxWidth:780}}>
        <div style={{...T.card,padding:22,background:"linear-gradient(135deg,#fff,"+T.goldBg+"55)",borderLeft:"3px solid "+T.gold,marginBottom:16}}>
          <h2 style={{fontSize:"1.4rem",fontWeight:700,margin:0,display:"flex",alignItems:"center",gap:8}}>🎁 Rewards</h2>
          <p style={{color:T.txt2,fontSize:".88rem",marginTop:6,lineHeight:1.55,marginBottom:14}}>Redeem your SKINARIO points for vouchers from our partners — courses, products, events, and more. Each voucher is redeemable directly with the partner.</p>
          {prof?.accountType==="doctor"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
            <div style={{padding:14,background:"#fff",borderRadius:10,border:"1px solid "+T.border}}>
              <div style={{fontSize:".66rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Spendable</div>
              <div style={{fontSize:"1.4rem",fontWeight:700,color:T.teal}}>{spendablePoints} pts</div>
            </div>
            <div style={{padding:14,background:"#fff",borderRadius:10,border:"1px solid "+T.border}}>
              <div style={{fontSize:".66rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Earned (lifetime)</div>
              <div style={{fontSize:"1.4rem",fontWeight:700,color:T.txt}}>{prof?.points||0} pts</div>
            </div>
            <div style={{padding:14,background:"#fff",borderRadius:10,border:"1px solid "+T.border}}>
              <div style={{fontSize:".66rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Redeemed</div>
              <div style={{fontSize:"1.4rem",fontWeight:700,color:T.gold}}>{prof?.redeemedPoints||0} pts</div>
            </div>
          </div>}
          <p style={{fontSize:".7rem",color:T.mute,marginTop:10,lineHeight:1.55}}>💡 Your tier stays based on earned points — redeeming never demotes you.</p>
        </div>

        {/* Available rewards */}
        <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:10}}>Available rewards</h4>
        {rewards.filter(r=>r.active&&(r.stock||0)>0).length===0?
          <div style={{...T.card,textAlign:"center",padding:40,color:T.mute,fontSize:".88rem",marginBottom:16}}>
            <div style={{fontSize:"2.4rem",marginBottom:8}}>🎁</div>
            No rewards available right now. Check back soon — new rewards are added regularly.
          </div>
        :
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12,marginBottom:24}}>
            {rewards.filter(r=>r.active&&(r.stock||0)>0).map(r=>{
              const canAfford=spendablePoints>=(r.pointCost||0);
              return(<div key={r.id} style={{...T.card,padding:0,overflow:"hidden",marginBottom:0,position:"relative"}}>
                {r.image?
                  <div style={{height:130,overflow:"hidden",background:"#f4f1ea"}}><img src={r.image} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/></div>
                  :<div style={{height:90,background:T.goldBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2.6rem"}}>🎁</div>
                }
                <div style={{padding:14}}>
                  <div style={{display:"flex",gap:5,marginBottom:6,flexWrap:"wrap"}}>
                    {r.category&&<span style={T.tag(T.tealBg,T.teal)}>{r.category}</span>}
                    <span style={T.tag(T.goldBg,T.goldD)}>{r.partner}</span>
                    {r.vendorId&&<span style={{...T.tag(T.tealBg,T.teal),fontSize:".62rem"}}>✓ Verified Partner</span>}
                  </div>
                  <div style={{fontSize:".95rem",fontWeight:600,color:T.txt,lineHeight:1.35,marginBottom:6}}>{r.title}</div>
                  {r.desc&&<div style={{fontSize:".78rem",color:T.txt2,lineHeight:1.5,marginBottom:8,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{r.desc}</div>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginTop:10,paddingTop:10,borderTop:"1px solid "+T.border}}>
                    <div>
                      <div style={{fontSize:"1.05rem",fontWeight:700,color:T.gold,lineHeight:1}}>⭐ {r.pointCost} pts</div>
                      <div style={{fontSize:".65rem",color:T.mute,marginTop:3}}>{r.stock||0} left{r.expiry?` · Expires ${fD(r.expiry)}`:""}</div>
                    </div>
                    <button onClick={()=>redeemReward(r)} disabled={!canAfford||prof?.accountType!=="doctor"} style={{...(canAfford&&prof?.accountType==="doctor"?T.btn:T.btnO),padding:"8px 14px",fontSize:".82rem",opacity:canAfford&&prof?.accountType==="doctor"?1:.55,cursor:canAfford&&prof?.accountType==="doctor"?"pointer":"not-allowed"}}>{prof?.accountType!=="doctor"?"Doctors only":canAfford?"Redeem":`Need ${r.pointCost-spendablePoints} more`}</button>
                  </div>
                </div>
              </div>);
            })}
          </div>
        }

        {/* ═══ MY EARNING HISTORY (points ledger) ═══ */}
        {prof?.accountType==="doctor"&&myLedger.length>0&&(()=>{
          // Friendly labels per action type
          const actionMeta={
            quiz_correct:{icon:"🧠",color:T.teal},
            forum_comment:{icon:"💬",color:"#7a3e9a"},
            case_post:{icon:"🔬",color:T.gold},
            share_unique:{icon:"🔗",color:"#0d6b6e"},
            article_publish:{icon:"📰",color:T.gold},
            profile_complete:{icon:"✅",color:T.ok},
          };
          const shown=myLedger.slice(0,15);
          const totalLogged=myLedger.reduce((s,e)=>s+(e.pointsEarned||0),0);
          return(<div style={{...T.card,padding:18,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
              <h4 style={{fontSize:".95rem",fontWeight:700,margin:0}}>📈 How you earned your points</h4>
              <span style={{fontSize:".72rem",color:T.mute}}>{totalLogged} pts logged</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {shown.map(e=>{
                const meta=actionMeta[e.action]||{icon:"⭐",color:T.mute};
                const label=e.label||({quiz_correct:"Quiz answered correctly",forum_comment:"Forum comment",case_post:"Case posted",share_unique:"Shared content",article_publish:"Article published",profile_complete:"Profile completed"}[e.action]||e.action);
                return(<div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:T.bg,borderRadius:8}}>
                  <div style={{fontSize:"1rem",width:24,textAlign:"center",flexShrink:0}}>{meta.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:".82rem",fontWeight:500,color:T.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</div>
                    <div style={{fontSize:".66rem",color:T.mute}}>
                      {(() => {
                        const ts = e.createdAt || e.updatedAt;
                        if (ts) {
                          try {
                            return new Date(ts).toLocaleString("en-IN", {
                              day: "2-digit", month: "short",
                              hour: "2-digit", minute: "2-digit",
                              hour12: true
                            });
                          } catch { return e.date; }
                        }
                        return e.date;
                      })()}
                      {e.streakBonus>0?` · 🔥 +${e.streakBonus} streak bonus`:""}
                    </div>
                  </div>
                  <div style={{fontSize:".88rem",fontWeight:700,color:meta.color,flexShrink:0}}>+{e.pointsEarned}</div>
                </div>);
              })}
            </div>
            {myLedger.length>15&&<div style={{fontSize:".72rem",color:T.mute,textAlign:"center",marginTop:10}}>Showing 15 most recent of {myLedger.length} entries</div>}
            <div style={{fontSize:".68rem",color:T.mute,marginTop:10,paddingTop:10,borderTop:"1px solid "+T.border,lineHeight:1.5}}>
              💡 History tracks points from this update onward. Points earned before may not all appear here, but your total balance is always accurate.
            </div>
          </div>);
        })()}

        {/* My redemption history */}
        {(()=>{
          const myRedemptions=redemptions.filter(r=>r.uid===au?.uid);
          if(myRedemptions.length===0)return null;
          return(<div style={{...T.card,padding:18}}>
            <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:14}}>📜 My redemptions ({myRedemptions.length})</h4>
            {myRedemptions.map(rd=><div key={rd.id} style={{padding:"12px 14px",borderRadius:10,border:"1px solid "+T.border,marginBottom:8,background:rd.status==="fulfilled"?T.okBg+"44":"#fff"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontSize:".88rem",fontWeight:600,marginBottom:3}}>{rd.rewardTitle}</div>
                  <div style={{fontSize:".72rem",color:T.mute,marginBottom:6}}>{rd.partner} · {fD(rd.date)} · {rd.pointCost} pts</div>
                  <div style={{fontSize:".82rem",fontFamily:"monospace",fontWeight:700,color:T.gold,padding:"6px 12px",background:"#fff",borderRadius:6,display:"inline-block",border:"1.5px dashed "+T.gold,marginBottom:8,letterSpacing:1}}>{rd.code}</div>
                  {rd.instructions&&<div style={{fontSize:".75rem",color:T.txt2,lineHeight:1.55,padding:"8px 10px",background:T.bg,borderRadius:6,marginTop:4}}>📋 <b>How to redeem:</b> {rd.instructions}</div>}
                </div>
                <span style={{fontSize:".7rem",fontWeight:700,padding:"3px 9px",borderRadius:10,background:rd.status==="fulfilled"?T.okBg:rd.status==="pending"?T.warnBg:T.bg,color:rd.status==="fulfilled"?T.ok:rd.status==="pending"?T.warn:T.mute,textTransform:"uppercase",letterSpacing:.5,flexShrink:0}}>{rd.status||"pending"}</span>
              </div>
            </div>)}
          </div>);
        })()}
      </div>}

      {pg==="me"&&<div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 340px",gap:18,alignItems:"start"}} className="me-grid">

        {/* ═══ MAIN COLUMN: Profile + Saved Items ═══ */}
        <div style={{minWidth:0}}>

        {/* ═══ POINTS + REDEEM PILL — only for doctor accounts (other types don't earn quiz points) ═══ */}
        {!editingProfile&&prof?.accountType==="doctor"&&<div onClick={()=>go("rewards")} style={{...T.card,padding:"12px 16px",marginBottom:12,borderLeft:"3px solid "+T.gold,background:"linear-gradient(135deg,"+T.goldBg+"55,#fff)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,cursor:"pointer",transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 4px 14px rgba(0,0,0,0.07)"}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}>
          <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
            <div style={{fontSize:"1.5rem"}}>🏆</div>
            <div>
              <div style={{fontSize:".7rem",color:T.mute,letterSpacing:1,textTransform:"uppercase",fontWeight:600,marginBottom:2}}>Available to redeem</div>
              <div style={{fontSize:"1.3rem",fontWeight:700,color:T.gold,lineHeight:1}}>{spendablePoints} <span style={{fontSize:".7rem",color:T.mute,fontWeight:500}}>pts</span></div>
              <div style={{fontSize:".64rem",color:T.mute,marginTop:2}}>{prof?.points||0} earned lifetime</div>
            </div>
          </div>
          <div style={{fontSize:".82rem",color:T.teal,fontWeight:600,whiteSpace:"nowrap"}}>Redeem rewards →</div>
        </div>}

        {/* ═══ CONSENT TEMPLATE GENERATOR — doctor-only quick link ═══ */}
        {/* Consent tile: show to doctors + admins + accounts with no accountType set (older accounts).
            Explicitly hide from institute/vendor/moderator accounts. */}
        {!editingProfile&&(()=>{
          const aType=prof?.accountType||"";
          const showConsent=isAdm||aType==="doctor"||aType===""||aType===undefined;
          if(!showConsent)return null;
          return(<div onClick={()=>go("consent")} style={{...T.card,padding:"12px 16px",marginBottom:12,borderLeft:"3px solid "+T.teal,background:"linear-gradient(135deg,"+T.tealBg+"55,#fff)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,cursor:"pointer",transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 4px 14px rgba(0,0,0,0.07)"}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}>
          <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
            <div style={{fontSize:"1.5rem"}}>📋</div>
            <div>
              <div style={{fontSize:".7rem",color:T.mute,letterSpacing:1,textTransform:"uppercase",fontWeight:600,marginBottom:2}}>Tools</div>
              <div style={{fontSize:"1rem",fontWeight:700,color:T.teal,lineHeight:1.2}}>Consent Template Generator</div>
              <div style={{fontSize:".68rem",color:T.mute,marginTop:2}}>Generate procedure-specific consent forms · 2 free per day</div>
            </div>
          </div>
          <div style={{fontSize:".82rem",color:T.teal,fontWeight:600,whiteSpace:"nowrap"}}>Open →</div>
        </div>);
        })()}

        {/* ═══ REFERRAL CARD ═══
            Every user gets a unique code. Sharing it earns 100 pts when the
            referred friend signs up AND answers their first quiz correctly. */}
        {!editingProfile&&prof?.referralCode&&(()=>{
          const referralLink=`${SITE_URL}/?ref=${prof.referralCode}`;
          const myReferralCount=(prof.referralsPaidFor||[]).length;
          const copyLink=()=>{
            navigator.clipboard.writeText(referralLink).then(()=>{
              setRefCopied(true);
              setTimeout(()=>setRefCopied(false),2000);
            }).catch(()=>sh("Could not copy — please copy manually"));
          };
          return(<div style={{...T.card,padding:"16px",marginBottom:12,borderLeft:"3px solid "+T.gold,background:"linear-gradient(135deg,"+T.goldBg+"40,#fff)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{fontSize:"1.4rem"}}>🎁</div>
              <div>
                <div style={{fontSize:"1rem",fontWeight:700,color:T.txt,lineHeight:1.2}}>Refer a friend, earn 100 points</div>
                <div style={{fontSize:".72rem",color:T.mute,marginTop:2}}>You earn 100 pts once your friend signs up and answers their first quiz</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:180,padding:"9px 12px",background:"#fff",border:"1px solid "+T.border,borderRadius:8,fontSize:".82rem",color:T.txt2,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{referralLink}</div>
              <button onClick={copyLink} style={{...T.btn,padding:"9px 16px",fontSize:".82rem",background:refCopied?"#1a7d42":T.gold,whiteSpace:"nowrap"}}>{refCopied?"✓ Copied!":"📋 Copy link"}</button>
              <button onClick={()=>{
                const waMsg=encodeURIComponent(`Join me on SKINARIO — a community platform for aesthetic medicine doctors in India. Daily quizzes, clinical cases, forum discussions, and more.\n\n${referralLink}`);
                window.open(`https://wa.me/?text=${waMsg}`,"_blank");
              }} style={{...T.btnO,padding:"9px 14px",fontSize:".82rem",whiteSpace:"nowrap"}}>💬 WhatsApp</button>
            </div>
            {myReferralCount>0&&<div style={{marginTop:10,fontSize:".76rem",color:T.gold,fontWeight:600}}>🎉 {myReferralCount} successful {myReferralCount===1?"referral":"referrals"} · +{myReferralCount*100} pts earned</div>}
          </div>);
        })()}

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
          {(editPf.accountType==="pharma"||editPf.accountType==="brand")&&<>
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

          {/* Vendor fields */}
          {editPf.accountType==="vendor"&&<>
            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Country</label>
            <select value={editPf.country} onChange={e=>setEditPf(p=>({...p,country:e.target.value}))} style={{...T.inp,marginBottom:12}}>
              {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Company name <span style={{color:T.err}}>*</span></label>
            <input value={editPf.companyName||""} onChange={e=>setEditPf(p=>({...p,companyName:e.target.value}))} style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Vendor category <span style={{color:T.err}}>*</span></label>
            <select value={editPf.vendorCategory||""} onChange={e=>setEditPf(p=>({...p,vendorCategory:e.target.value}))} style={{...T.inp,marginBottom:12}}>
              <option value="">— Select —</option>{VENDOR_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Contact person <span style={{color:T.err}}>*</span></label>
            <input value={editPf.contactPerson||""} onChange={e=>setEditPf(p=>({...p,contactPerson:e.target.value}))} style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>GST Number (optional)</label>
            <input value={editPf.gstNumber||""} onChange={e=>setEditPf(p=>({...p,gstNumber:e.target.value.toUpperCase()}))} placeholder="e.g. 27AABCU9603R1ZX" style={{...T.inp,marginBottom:12,fontFamily:"monospace"}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Website (optional)</label>
            <input value={editPf.website||""} onChange={e=>setEditPf(p=>({...p,website:e.target.value}))} placeholder="https://" style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Address (City, State)</label>
            <input value={editPf.address||""} onChange={e=>setEditPf(p=>({...p,address:e.target.value}))} style={{...T.inp,marginBottom:12}}/>
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
              if(e.accountType==="pharma"||e.accountType==="brand"){
                if(!e.companyName?.trim()){setEditErr("Company name required");return}
                if(!e.brandCategory){setEditErr("Brand category required");return}
                if(!e.contactPerson?.trim()){setEditErr("Contact person required");return}
              }
              if(e.accountType==="vendor"){
                if(!e.companyName?.trim()){setEditErr("Company name required");return}
                if(!e.vendorCategory){setEditErr("Vendor category required");return}
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
                ...(e.accountType==="pharma"||e.accountType==="brand"?{companyName:e.companyName.trim(),brandCategory:e.brandCategory,contactPerson:e.contactPerson.trim(),website:e.website?.trim()||"",address:e.address?.trim()||""}:{}),
                ...(e.accountType==="vendor"?{companyName:e.companyName.trim(),vendorCategory:e.vendorCategory,contactPerson:e.contactPerson.trim(),gstNumber:e.gstNumber?.trim()||"",website:e.website?.trim()||"",address:e.address?.trim()||""}:{}),
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
        <div style={{...T.card,padding:22,position:"relative"}}>
            {/* Top row: Edit button aligned right */}
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
              <button onClick={()=>{
                setEditPf({
                  name:prof?.name||"",mobile:prof?.mobile||"",accountType:prof?.accountType||"",country:prof?.country||"India",
                  degree:prof?.degree||"",council:prof?.council||"",internationalCouncil:prof?.internationalCouncil||"",
                  regNumber:prof?.regNumber||"",clinic:prof?.clinic||"",address:prof?.address||"",city:prof?.city||"",region:prof?.region||"",
                  visibility:prof?.visibility||"public",companyName:prof?.companyName||"",brandCategory:prof?.brandCategory||"",
                  vendorCategory:prof?.vendorCategory||"",gstNumber:prof?.gstNumber||"",
                  contactPerson:prof?.contactPerson||"",website:prof?.website||"",instituteName:prof?.instituteName||"",
                  instituteType:prof?.instituteType||"",directorName:prof?.directorName||"",bio:prof?.bio||""
                });
                setEditingProfile(true);
                setEditErr("");
              }} style={{...T.btnO,...T.btnSm}}>✏️ Edit</button>
            </div>
            {/* Profile photo + info centered */}
            <div style={{textAlign:"center"}}>
              {uPhoto?<img src={uPhoto} style={{width:76,height:76,borderRadius:"50%",border:"3px solid "+T.teal,display:"block",margin:"0 auto 12px"}}/>:<div style={{...T.av(76,T.tealBg,T.teal),border:"3px solid "+T.teal,margin:"0 auto 12px",fontSize:"1.6rem"}}>{uIni}</div>}
              <div style={{fontSize:"1.4rem",fontWeight:700}}>{uName}</div>
              <div style={{color:T.txt2,fontSize:".88rem",marginTop:3}}>{prof?.degree||prof?.companyName||prof?.instituteName||"—"}</div>
              <div style={{color:T.mute,fontSize:".8rem",marginTop:2}}>{au?.email}</div>
              {prof?.accountType&&<div style={{marginTop:8}}><span style={T.tag(T.tealBg,T.teal)}>{ACCOUNT_TYPES.find(t=>t.id===prof.accountType)?.icon} {ACCOUNT_TYPES.find(t=>t.id===prof.accountType)?.label}</span></div>}
            </div>
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
        </div>

        {/* ═══ RIGHT COLUMN: Submit + Vendor + Email + Role ═══ */}
        <div style={{minWidth:0}}>
        {/* ═══ SUBMIT CONTENT — direct type buttons ═══
            Each type button navigates straight to its form, skipping the intermediate "pick a type" page. */}
        {!editingProfile&&(()=>{
          const isAdminU=isAdminUser(au?.email);
          // Use canSubmitType for permission logic — it's the single source of truth (used everywhere else).
          // It returns true if: openToAll, OR user is admin, OR user has Content Contributor / Forum Moderator role.
          const hasContribRole=canSubmitType("article",au,prof); // any restricted type — they share the same permission rule
          // Types in order. Each: { key, icon, label, desc, canUse }
          const types=[
            {key:"event",   icon:"📅", label:"Event",     desc:"Conference, workshop, webinar", canUse:canSubmitType("event",au,prof)},
            {key:"article", icon:"📰", label:"Article",   desc:"Educational article",            canUse:canSubmitType("article",au,prof)},
            {key:"video",   icon:"🎥", label:"Video",     desc:"Masterclass or tutorial",        canUse:canSubmitType("video",au,prof)},
            {key:"news",    icon:"📢", label:"News",      desc:"Industry news, CDSCO, FDA",      canUse:canSubmitType("news",au,prof)},
            {key:"ad",      icon:"📌", label:"Ad",        desc:"Sponsored placement",            canUse:canSubmitType("ad",au,prof)},
          ];
          return(<div style={{...T.card,padding:14,marginBottom:14,borderLeft:"3px solid "+T.gold,background:"linear-gradient(135deg,#fff,"+T.goldBg+"33)"}}>
            <div style={{fontSize:".88rem",fontWeight:700,marginBottom:4,display:"flex",alignItems:"center",gap:6}}>📨 Submit to SKINARIO</div>
            <div style={{fontSize:".72rem",color:T.txt2,marginBottom:10,lineHeight:1.5}}>
              Pick what you want to submit:
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {types.map(t=>{
                const locked=!t.canUse;
                return(<button key={t.key}
                  onClick={()=>{
                    if(locked){
                      // Don't navigate; show toast hint
                      if(t.key==="ad"){sh("Ads require admin role");return}
                      sh("This type needs Content Contributor role. Apply below ↓");
                      return;
                    }
                    setSubmitType(t.key);go("submit");
                  }}
                  style={{
                    display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
                    background:locked?T.bg:"#fff",
                    border:"1px solid "+(locked?T.border:T.gold),
                    borderRadius:8,cursor:"pointer",fontFamily:"inherit",textAlign:"left",
                    opacity:locked?.6:1,transition:"all .15s"
                  }}
                  onMouseEnter={e=>{if(!locked){e.currentTarget.style.background=T.goldBg+"44";e.currentTarget.style.transform="translateX(2px)"}}}
                  onMouseLeave={e=>{if(!locked){e.currentTarget.style.background="#fff";e.currentTarget.style.transform=""}}}
                  title={locked?(t.key==="ad"?"Admin only":"Apply for Content Contributor role"):`Submit a new ${t.label}`}
                >
                  <div style={{fontSize:"1.2rem",width:28,textAlign:"center",flexShrink:0}}>{t.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:".84rem",fontWeight:600,color:locked?T.mute:T.txt,display:"flex",alignItems:"center",gap:6}}>
                      {t.label} {locked&&<span style={{fontSize:".62rem",color:T.mute,fontWeight:500}}>🔒 locked</span>}
                    </div>
                    <div style={{fontSize:".7rem",color:T.mute,lineHeight:1.4}}>{t.desc}</div>
                  </div>
                  {!locked&&<span style={{color:T.gold,fontSize:".9rem",flexShrink:0}}>→</span>}
                </button>);
              })}
            </div>
            {!hasContribRole&&!isAdminU&&<div style={{fontSize:".7rem",color:T.txt2,marginTop:10,padding:"8px 10px",background:T.bg,borderRadius:6,lineHeight:1.5}}>
              💡 Want to submit articles, videos, or news? Apply for the <b>Content Contributor</b> role below.
            </div>}
          </div>);
        })()}

        {/* ═══ VENDOR REWARD PARTNER SECTION (only for vendor accounts) ═══ */}
        {(prof?.accountType==="vendor"||prof?.accountType==="brand"||prof?.accountType==="pharma")&&(()=>{
          // Find this vendor's application
          const myApp=vendorApplications.find(a=>a.uid===au?.uid);
          const status=myApp?.status||"none"; // none | pending | approved | rejected
          const myRewards=rewards.filter(r=>r.vendorId===au?.uid);
          const myRedemptions=redemptions.filter(rd=>{
            const r=rewards.find(x=>x.id===rd.rewardId);
            return r&&r.vendorId===au?.uid;
          });

          if(status==="none"){
            return(<div style={{...T.card,padding:18,marginBottom:14,borderLeft:"3px solid "+T.gold}}>
              <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:8,display:"flex",alignItems:"center",gap:8}}>🏢 Become a Reward Partner</h4>
              <p style={{fontSize:".85rem",color:T.txt2,lineHeight:1.6,marginBottom:14}}>
                Offer your products, vouchers, or services as rewards on SKINARIO. Doctors redeem with their points — you get qualified leads and brand exposure.
              </p>
              <ul style={{fontSize:".82rem",color:T.txt2,paddingLeft:20,marginBottom:14,lineHeight:1.7}}>
                <li><b>Free participation</b> for early partners (paid annually later)</li>
                <li><b>You propose rewards</b>, admin approves and sets point cost</li>
                <li><b>Get notified</b> via email when doctors redeem</li>
                <li><b>You fulfill</b> via voucher code, contact share, or admin help</li>
              </ul>
              <button onClick={async()=>{
                const company=prompt("Your company name (will be shown on rewards):",prof?.companyName||prof?.name||"");
                if(!company)return;
                const offerings=prompt("Briefly describe what you offer (e.g. 'Premium cosmetic devices', 'Aesthetic training courses'):");
                if(!offerings)return;
                try{
                  await fbAdd("vendorApplications",{
                    uid:au.uid,email:au.email,
                    companyName:company,
                    contactName:prof.name||"",
                    contactEmail:au.email,
                    offerings,
                    status:"pending",
                    createdAt:Date.now(),
                  });
                  sh("📨 Application submitted! Admin will review.");
                  loadData();
                }catch(err){console.error(err);sh("Application failed")}
              }} style={{...T.btn,padding:"9px 18px",fontSize:".88rem"}}>Apply to become a partner →</button>
            </div>);
          }

          if(status==="pending"){
            return(<div style={{...T.card,padding:18,marginBottom:14,borderLeft:"3px solid "+T.warn,background:T.warnBg+"22"}}>
              <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:6}}>⏳ Vendor application pending</h4>
              <p style={{fontSize:".82rem",color:T.txt2,lineHeight:1.6}}>Your application to become a SKINARIO Reward Partner is being reviewed. You'll be notified once approved (usually within 48 hours).</p>
            </div>);
          }

          if(status==="rejected"){
            return(<div style={{...T.card,padding:18,marginBottom:14,borderLeft:"3px solid "+T.err,background:"#ffeeee"}}>
              <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:6}}>Application not approved</h4>
              <p style={{fontSize:".82rem",color:T.txt2,lineHeight:1.6,marginBottom:8}}>Your vendor application was not approved.</p>
              {myApp.reviewReason&&<p style={{fontSize:".78rem",color:T.txt2,padding:"8px 12px",background:"#fff",borderRadius:6,fontStyle:"italic"}}>Admin note: "{myApp.reviewReason}"</p>}
            </div>);
          }

          // Approved — show propose form + their rewards
          return(<div style={{...T.card,padding:18,marginBottom:14,borderLeft:"3px solid "+T.teal}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
              <h4 style={{fontSize:".95rem",fontWeight:700,display:"flex",alignItems:"center",gap:8,margin:0}}>✓ Reward Partner · <span style={{color:T.teal}}>{myApp.companyName}</span></h4>
              <span style={{fontSize:".7rem",color:T.mute}}>{myRewards.length} active · {myRedemptions.length} redemptions</span>
            </div>

            {/* Propose new reward */}
            <details style={{marginBottom:14,padding:"10px 12px",background:T.bg,borderRadius:8}}>
              <summary style={{cursor:"pointer",fontSize:".88rem",fontWeight:600}}>+ Propose a new reward offering</summary>
              <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:10}}>
                <input id="vr-title" placeholder="Title (e.g. '10% off any Cynosure equipment')" style={T.inp}/>
                <textarea id="vr-desc" placeholder="Describe what the doctor gets, terms, limitations..." style={T.txa} rows={3}/>

                {/* Image upload */}
                <div>
                  <label style={{fontSize:".78rem",color:T.txt2,fontWeight:600,display:"block",marginBottom:6}}>Reward image (optional, 600×400 recommended)</label>
                  {vrImage&&<div style={{marginBottom:6}}>
                    <img src={vrImage} alt="" style={{maxWidth:200,maxHeight:130,borderRadius:6,border:"1px solid "+T.border,display:"block"}}/>
                    <button type="button" onClick={()=>setVrImage("")} style={{...T.btnO,...T.btnSm,marginTop:4,fontSize:".72rem"}}>✕ Remove image</button>
                  </div>}
                  <input type="file" accept="image/*" disabled={vrUploading} onChange={async(e)=>{
                    const f=e.target.files?.[0];if(!f)return;
                    if(f.size>5*1024*1024){sh("Image must be under 5MB");return}
                    setVrUploading(true);
                    try{
                      const path=`rewards/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
                      const sRef=ref(storage,path);
                      await uploadBytes(sRef,f);
                      const url=await getDownloadURL(sRef);
                      setVrImage(url);
                      sh("✓ Image uploaded");
                    }catch(err){
                      console.error("vr upload error:",err);
                      sh("Upload failed: "+(err.message||"check console"));
                    }
                    setVrUploading(false);
                    e.target.value="";
                  }} style={{fontSize:".82rem"}}/>
                  {vrUploading&&<div style={{fontSize:".72rem",color:T.mute,marginTop:4}}>⏳ Uploading...</div>}
                </div>

                <select id="vr-fulfillment" style={T.inp} defaultValue="voucher">
                  <option value="voucher">Voucher code (we'll provide a code)</option>
                  <option value="contact">Contact info (doctor's email shared with us)</option>
                  <option value="manual">Manual (admin coordinates fulfillment)</option>
                </select>
                <input id="vr-voucher" placeholder="(If voucher type) Voucher code or instructions" style={T.inp}/>
                <input id="vr-stock" type="number" placeholder="Stock limit (e.g. 50). Leave blank for unlimited." style={T.inp}/>
                <p style={{fontSize:".74rem",color:T.mute,lineHeight:1.5}}>Admin will set the points cost and approve before this appears in the rewards catalog. You'll be notified by email.</p>
                <button onClick={async()=>{
                  const title=document.getElementById("vr-title").value.trim();
                  const desc=document.getElementById("vr-desc").value.trim();
                  const fulfillment=document.getElementById("vr-fulfillment").value;
                  const voucher=document.getElementById("vr-voucher").value.trim();
                  const stock=parseInt(document.getElementById("vr-stock").value)||0;
                  if(!title){sh("Title required");return}
                  if(!desc){sh("Description required");return}
                  try{
                    await fbAdd("submissions",{
                      type:"vendor_reward",
                      submitterUid:au.uid,
                      submitterName:myApp.companyName,
                      submitterEmail:au.email,
                      submitterAccountType:"vendor",
                      data:{title,desc,fulfillment,voucher,stock,vendorId:au.uid,vendorName:myApp.companyName},
                      coverImage:vrImage||"",
                      status:"pending",
                      createdAt:Date.now(),
                      date:ds(getIST()),
                    });
                    sh("📨 Reward proposed! Admin will review and set point cost.");
                    document.getElementById("vr-title").value="";
                    document.getElementById("vr-desc").value="";
                    document.getElementById("vr-voucher").value="";
                    document.getElementById("vr-stock").value="";
                    setVrImage("");
                    loadData();
                  }catch(err){console.error(err);sh("Submission failed")}
                }} style={{...T.btn,padding:"9px 18px",fontSize:".85rem"}}>Submit proposal →</button>
              </div>
            </details>

            {/* My active rewards */}
            {myRewards.length>0&&<div>
              <div style={{fontSize:".78rem",fontWeight:700,marginBottom:8,color:T.txt2}}>My active rewards</div>
              {myRewards.map(r=><div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:T.bg,borderRadius:6,marginBottom:6,gap:8,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:".85rem",fontWeight:600}}>{r.title}</div>
                  <div style={{fontSize:".7rem",color:T.mute}}>{r.pointCost} pts · {r.timesRedeemed||0} redeemed · {r.stock>0?`${r.stock} left`:"unlimited"}</div>
                </div>
                <span style={{...T.tag(r.active?T.tealBg:T.warnBg,r.active?T.teal:T.warn)}}>{r.active?"Active":"Disabled"}</span>
              </div>)}
            </div>}

            {/* Recent redemptions */}
            {myRedemptions.length>0&&<div style={{marginTop:14}}>
              <div style={{fontSize:".78rem",fontWeight:700,marginBottom:8,color:T.txt2}}>Recent redemptions (last {Math.min(myRedemptions.length,5)})</div>
              {myRedemptions.slice(0,5).map(rd=>{
                const r=rewards.find(x=>x.id===rd.rewardId);
                return(<div key={rd.id} style={{padding:"8px 10px",background:T.bg,borderRadius:6,marginBottom:6,fontSize:".78rem"}}>
                  <div style={{fontWeight:600}}>{r?.title||"(deleted reward)"}</div>
                  <div style={{color:T.mute,fontSize:".7rem"}}>{rd.userName} ({rd.userEmail}) · {fD(rd.date||"")}</div>
                </div>);
              })}
            </div>}
          </div>);
        })()}

        {/* ═══ EMAIL PREFERENCES ═══ */}
        {!editingProfile&&(()=>{
          const prefs=prof?.emailPreferences||{welcome:true,submissions:true,replies:true,weeklyDigest:true};
          const updatePref=async(key,value)=>{
            const newPrefs={...prefs,[key]:value};
            const newProf={...prof,emailPreferences:newPrefs};
            try{
              await fbSet("users",au.uid,{emailPreferences:newPrefs});
              setProf(newProf);
              sh(`Email preference updated`);
            }catch(err){
              console.error("Pref update failed:",err);
              sh("Update failed");
            }
          };
          return(<details style={{...T.card,padding:0,marginBottom:14}}>
            <summary style={{padding:"14px 16px",cursor:"pointer",listStyle:"none",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div>
                <div style={{fontSize:".92rem",fontWeight:700}}>📧 Email notifications</div>
                <div style={{fontSize:".74rem",color:T.mute,marginTop:2}}>Control what we email you about</div>
              </div>
              <span style={{fontSize:".75rem",color:T.teal,fontWeight:600}}>Configure ↓</span>
            </summary>
            <div style={{padding:"4px 16px 18px",borderTop:"1px solid "+T.border}}>
              {[
                {key:"submissions",label:"My submission updates",desc:"When your event/article/video/ad/news is approved or needs changes",disabled:false},
                {key:"replies",label:"Replies to my posts",desc:"When someone comments on your forum post, case, or article",disabled:false},
                {key:"weeklyDigest",label:"Weekly digest",desc:"Every Sunday: top quiz, hot discussions, new events (coming soon)",disabled:true},
              ].map(item=><label key={item.key} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"10px 0",borderBottom:"1px solid "+T.border,cursor:item.disabled?"not-allowed":"pointer",opacity:item.disabled?0.6:1}}>
                <input type="checkbox" checked={prefs[item.key]!==false} disabled={item.disabled} onChange={e=>!item.disabled&&updatePref(item.key,e.target.checked)} style={{marginTop:3,width:16,height:16,cursor:item.disabled?"not-allowed":"pointer",accentColor:T.teal}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:".86rem",fontWeight:600,color:T.txt}}>{item.label}{item.disabled&&<span style={{fontSize:".68rem",color:T.mute,fontWeight:400,marginLeft:8}}>(not yet active)</span>}</div>
                  <div style={{fontSize:".74rem",color:T.txt2,lineHeight:1.5,marginTop:3}}>{item.desc}</div>
                </div>
              </label>)}
              <div style={{padding:"10px 12px",marginTop:10,background:T.bg,borderRadius:6,fontSize:".72rem",color:T.txt2,lineHeight:1.55}}>
                💡 Welcome and password reset emails are always sent — they're essential to your account. You can unsubscribe from everything else here.
              </div>
            </div>
          </details>);
        })()}

        {/* ═══ ROLE APPLICATION CARD (visible only if no role yet & no pending app) ═══ */}
        {!editingProfile&&!prof?.role&&!isAdminUser(au?.email)&&(()=>{
          const myPending=roleApplications.find(a=>a.uid===au?.uid&&a.status==="pending");
          const myLatest=roleApplications.filter(a=>a.uid===au?.uid).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0];
          return(<RoleApplicationCard
            T={T}
            prof={prof}
            myPending={myPending}
            myLatest={myLatest}
            ROLES={ROLES}
            ROLE_DISPLAY={ROLE_DISPLAY}
            submitRoleApplication={submitRoleApplication}
            getTier={getTier}
            TIERS={TIERS}
          />);
        })()}

        {/* If user already has a role, show their badge prominently */}
        {!editingProfile&&prof?.role&&ROLE_DISPLAY[prof.role]&&<div style={{...T.card,padding:18,marginBottom:14,borderLeft:"3px solid "+(ROLE_DISPLAY[prof.role].fg||T.gold)}}>
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <span style={{fontSize:"1.6rem"}}>{ROLE_DISPLAY[prof.role].icon}</span>
            <div>
              <div style={{fontSize:".7rem",color:T.mute,letterSpacing:1.2,textTransform:"uppercase",fontWeight:600}}>Your role</div>
              <div style={{fontSize:"1.1rem",fontWeight:700,color:ROLE_DISPLAY[prof.role].fg}}>{ROLE_DISPLAY[prof.role].label}</div>
            </div>
          </div>
        </div>}

        </div>

      </div>}

      {/* ADMIN */}
      {pg==="admin"&&isAdm&&<div>
        <h3 style={{fontSize:"1.15rem",fontWeight:700,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
          <span>⚙️ Admin dashboard</span>
          {aTab!=="stats"&&<button onClick={()=>setATab("stats")} style={{...T.btnO,padding:"6px 14px",fontSize:".78rem",fontWeight:600}}>← Back to Overview</button>}
        </h3>
        <div style={{position:"sticky",top:0,zIndex:30,background:T.bg,padding:"10px 0",marginBottom:16,marginInline:-12,paddingInline:12,borderBottom:"1px solid "+T.border}}>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {[["stats","📊 Overview"],["quiz","🧠 Quiz"],["articles","📰 Articles"],["resources","📚 Resources"],["videos","🎥 Videos"],["events","📅 Events"],["forum","💬 Forum"],["cases","🔬 Cases"],["ads","📢 Ads"],["news","📰 News"],["rewards","🎁 Rewards"],["vendors","🏢 Vendors"],["roles","🛡️ Roles"],["submissions","📥 Submissions"],["announce","📣 Announce"],["consents","📋 Consents"],["referrals","🎁 Referrals"],["users","👥 Users"]].map(([id,l])=><button key={id} onClick={()=>{setATab(id);setEdForm(null);window.scrollTo({top:0,behavior:"smooth"})}} style={{padding:"8px 14px",borderRadius:10,border:`1.5px solid ${aTab===id?T.teal:T.border}`,background:aTab===id?T.tealBg:"#fff",color:aTab===id?T.teal:T.mute,cursor:"pointer",fontSize:".8rem",fontWeight:aTab===id?600:400,fontFamily:"inherit"}}>{l}</button>)}
          </div>
        </div>
        {aTab==="stats"&&<><div style={T.card}><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>{[["Articles",articles.length],["Resources",resources.length],["Videos",videos.length],["Forum",forumPosts.length],["Cases",cases.length],["Quizzes",quizzes.length],["Users",allUsers.length],["Events",events.length],["Ads",ads.length]].map(([l,v])=><div key={l} style={{textAlign:"center",padding:14,background:T.bg,borderRadius:10}}><div style={{fontSize:"1.4rem",fontWeight:700,color:T.teal}}>{v}</div><div style={{fontSize:".6rem",color:T.mute,textTransform:"uppercase"}}>{l}</div></div>)}</div></div>
          {/* ═══ ANALYTICS — top viewed content ═══ */}
          <div style={{...T.card,marginTop:14}}>
            <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:10}}>📈 Top viewed content</h4>
            <p style={{fontSize:".78rem",color:T.txt2,marginBottom:14,lineHeight:1.55}}>What's getting the most eyeballs across SKINARIO. Helps you understand what doctors actually read.</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
              {[
                ["📰 Articles",articles,"title"],
                ["🎥 Videos",videos,"title"],
                ["🔬 Cases",cases,"title"],
                ["💬 Forum",forumPosts,"title"],
                ["📰 News",newsPosts,"title"],
                ["🧠 Quizzes",quizzes,"cat"]
              ].map(([label,arr,titleKey])=>{
                const top3=[...arr].sort((a,b)=>(b.views||0)-(a.views||0)).slice(0,3).filter(x=>(x.views||0)>0);
                return<div key={label} style={{padding:12,background:T.bg,borderRadius:10}}>
                  <div style={{fontSize:".82rem",fontWeight:600,marginBottom:8,color:T.txt}}>{label}</div>
                  {top3.length===0?<div style={{fontSize:".74rem",color:T.mute,fontStyle:"italic"}}>No views yet</div>:
                  top3.map((item,i)=><div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"5px 0",borderBottom:i<top3.length-1?"1px solid "+T.border:"none"}}>
                    <span style={{fontSize:".7rem",color:T.gold,fontWeight:700,flexShrink:0}}>#{i+1}</span>
                    <div style={{flex:1,fontSize:".74rem",color:T.txt2,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item[titleKey]||item.question||"Untitled"}</div>
                    <span style={{fontSize:".7rem",color:T.teal,fontWeight:600,flexShrink:0}}>👁️ {item.views}</span>
                  </div>)}
                </div>;
              })}
            </div>
          </div>

          {/* ═══ ADMIN TOOLS ═══ */}
          <div style={{...T.card,marginTop:14}}>
            <h4 style={{fontSize:".95rem",fontWeight:700,marginBottom:10}}>🛠️ Admin Tools</h4>

            {/* RECOVERY: restore from May totals (use after a broken recompute) */}
            <div style={{padding:"12px 14px",background:"#fff4f4",borderLeft:"3px solid "+T.err,borderRadius:"0 8px 8px 0",marginBottom:10}}>
              <div style={{fontSize:".88rem",fontWeight:600,marginBottom:4}}>🩹 Restore points from May 2026 totals</div>
              <p style={{fontSize:".78rem",color:T.txt2,lineHeight:1.55,marginBottom:10}}>
                For each user, sets their lifetime points equal to <code>monthlyPoints["2026-05"]</code>.
                Use this when lifetime totals are wrong but May monthly totals look right.
                All points are assumed to be from May 2026. Safe to re-run.
              </p>
              <button onClick={restorePointsFromMay} style={{...T.btn,padding:"9px 18px",fontSize:".85rem",background:T.err}}>🩹 Restore from May totals</button>
            </div>

            {/* Personal recovery — for admin/users with no monthlyPoints field */}
            <div style={{padding:"12px 14px",background:"#f0e4ff",borderLeft:"3px solid #7a3e9a",borderRadius:"0 8px 8px 0",marginBottom:10}}>
              <div style={{fontSize:".88rem",fontWeight:600,marginBottom:4}}>🧮 Recover my points from ledger</div>
              <p style={{fontSize:".78rem",color:T.txt2,lineHeight:1.55,marginBottom:10}}>
                Sums YOUR own <code>pointsActivity</code> ledger entries (action points + any backfill snapshot) and sets your <code>points</code> to that total. Use this when restore-from-May can't help because your account has no monthly data.
              </p>
              <button onClick={recoverMyPointsFromLedger} style={{...T.btn,padding:"9px 18px",fontSize:".85rem",background:"#7a3e9a"}}>🧮 Recover my points</button>
            </div>

            {/* SEED MONTHLY (kept — useful for one-time backfill on first launch) */}
            <div style={{padding:"12px 14px",background:T.tealBg+"66",borderLeft:"3px solid "+T.teal,borderRadius:"0 8px 8px 0",marginBottom:10}}>
              <div style={{fontSize:".88rem",fontWeight:600,marginBottom:4}}>📅 Seed monthly leaderboard (one-time)</div>
              <p style={{fontSize:".78rem",color:T.txt2,lineHeight:1.55,marginBottom:10}}>Creates a ledger entry for each doctor equal to their current points, dated this month. Run this ONCE so the monthly leaderboard shows correct totals immediately. Only valid because the points system started this month. Safe to re-run (won't duplicate).</p>
              <button onClick={backfillLedgerThisMonth} style={{...T.btn,padding:"9px 18px",fontSize:".85rem",background:T.teal}}>📅 Seed this month's ledger</button>
            </div>

            {/* RECOMPUTE — INTENTIONALLY HIDDEN
                The old recompute function has caused data corruption (lost quizzes = lost points).
                Until quiz history is reliable enough to rebuild totals from, don't use this.
                Code is preserved for reference; UI removed to prevent accidental damage.
                If you genuinely need to recompute from quiz answers, uncomment below. */}
            {/*
            <div style={{padding:"12px 14px",background:T.goldBg,borderLeft:"3px solid "+T.gold,borderRadius:"0 8px 8px 0",marginBottom:10}}>
              <div style={{fontSize:".88rem",fontWeight:600,marginBottom:4}}>♻️ Recompute leaderboard points</div>
              <p style={{fontSize:".78rem",color:T.txt2,lineHeight:1.55,marginBottom:10}}>Reads every user's quiz answer history and recalculates their points using the difficulty-weighted system (10pt Easy, 20pt Moderate, 30pt Hard). Run this ONCE after launching the new scoring system to fairly assign points to existing users. Streak bonuses are not retroactive.</p>
              <button onClick={recomputeAllPoints} style={{...T.btn,padding:"9px 18px",fontSize:".85rem"}}>♻️ Recompute all points now</button>
            </div>
            */}
          </div>
        </>}
        {aTab==="quiz"&&<div style={T.card}>{edForm?.type==="quizzes"?<AdminForm type="Quiz sponsor" edForm={edForm} setEdForm={setEdForm} fields={[["sponsored","Mark as sponsored quiz","check"],["sponsor","Sponsor name (e.g. 'Sun Pharma')"],["sponsorLogo","Sponsor logo","image"],["sponsorUrl","Sponsor URL (optional — makes name clickable)"]]} onSave={()=>saveContent("quizzes")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{quizzes.length} questions</span><button onClick={genQuiz} style={T.btn}>🤖 Generate today</button></div>
          {quizzes.map(q=><div key={q.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border,gap:10}}><div style={{flex:1,minWidth:0}}><div style={{fontWeight:500,fontSize:".88rem"}}>{q.cat} — {q.diff} {q.sponsored&&<span style={{...T.tag(T.goldBg,T.goldD),marginLeft:6}}>📢 {q.sponsor||"Sponsored"}</span>}</div><div style={{fontSize:".72rem",color:T.mute}}>{fD(q.date)} · {Object.keys(q.answers||{}).length} answers · ❤️ {q.likes||0}</div></div><div style={{display:"flex",gap:4}}><button onClick={()=>{setSelD(q.date);go("quiz")}} style={{...T.btnO,...T.btnSm}}>View</button><button onClick={()=>setIgPost({item:q,type:"quiz"})} style={{...T.btnO,...T.btnSm}} title="Generate Instagram post">📸 IG</button><button onClick={()=>setEdForm({type:"quizzes",data:{...q},editing:true})} style={{...T.btnO,...T.btnSm}}>📢 Sponsor</button><button onClick={()=>deleteContent("quizzes",q.id,q.cat)} style={T.btnDanger}>Del</button></div></div>)}</>}</div>}
        {aTab==="articles"&&<div style={T.card}>{edForm?.type==="articles"?<AdminForm type="Article" edForm={edForm} setEdForm={setEdForm} fields={[["title","Title"],["subtitle","Subtitle / Tagline (italic, shown below title — optional)"],["cat","Category","select"],["author","Author name (e.g. 'Dr. Dhananjay Patil, MD')"],["authorPhoto","Author profile photo","image"],["authorAffiliation","Author affiliation (e.g. 'Absolute Institute of Aesthetic Medicine, Pune')"],["date","Publication date","date"],["cover","Cover image","image"],["abstract","Abstract / Summary (italic boxed quote — optional)","textarea"],["blocks","Article body (block editor — add paragraphs, headings, images)","blocks"],["refs","References (optional)","textarea"],["authorBio","Author bio (shown at end of article — optional)","textarea"],["sponsored","Sponsored content (paid editorial)","check"],["sponsor","Sponsored by — brand name (e.g. 'Sun Pharma') — only if Sponsored is checked"],["sponsorLogo","Sponsor logo","image"],["sponsorUrl","Sponsor website URL (optional — makes sponsor name clickable)"],["feat","Featured","check"]]} onSave={()=>saveContent("articles")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{articles.length}</span><button onClick={()=>setEdForm({type:"articles",data:{date:today,author:uName,cat:TOPICS[0]},editing:false})} style={T.btn}>+ New</button></div>
          {articles.map(a=><div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border}}><div style={{display:"flex",gap:10,alignItems:"center"}}>{a.cover&&<img src={a.cover} style={{width:50,height:36,objectFit:"cover",borderRadius:6}}/>}<div><div style={{fontWeight:500,fontSize:".88rem"}}>{a.title}</div><div style={{fontSize:".72rem",color:T.mute}}>{fD(a.date)}</div></div></div><div style={{display:"flex",gap:4}}><button onClick={()=>setIgPost({item:a,type:"article"})} style={{...T.btnO,...T.btnSm}} title="Generate Instagram post">📸 IG</button><button onClick={()=>setEdForm({type:"articles",data:{...a},editing:true})} style={{...T.btnO,...T.btnSm}}>Edit</button><button onClick={()=>deleteContent("articles",a.id,a.title)} style={T.btnDanger}>Del</button></div></div>)}</>}</div>}
        {aTab==="resources"&&<div style={T.card}>{edForm?.type==="resources"?<AdminForm type="Resource" edForm={edForm} setEdForm={setEdForm} fields={[["title","Title"],["url","Download URL"],["pages","Pages"],["size","Size"],["icon","Emoji (fallback)"],["thumb","Thumbnail image","image"],["free","Free","check"]]} onSave={()=>saveContent("resources")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{resources.length}</span><button onClick={()=>setEdForm({type:"resources",data:{icon:"📄",free:true},editing:false})} style={T.btn}>+ New</button></div>
          {resources.map(r=><div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border}}><div style={{display:"flex",gap:10,alignItems:"center"}}>{r.thumb?<img src={r.thumb} style={{width:36,height:36,objectFit:"cover",borderRadius:6}}/>:<span style={{fontSize:"1.4rem"}}>{r.icon||"📄"}</span>}<div><div style={{fontWeight:500,fontSize:".88rem"}}>{r.title||r.t}</div><div style={{fontSize:".72rem",color:T.mute}}>{r.free?"Free":"Premium"}</div></div></div><div style={{display:"flex",gap:4}}><button onClick={()=>setEdForm({type:"resources",data:{...r},editing:true})} style={{...T.btnO,...T.btnSm}}>Edit</button><button onClick={()=>deleteContent("resources",r.id,r.title||r.t)} style={T.btnDanger}>Del</button></div></div>)}</>}</div>}
        {aTab==="videos"&&<div style={T.card}>{edForm?.type==="videos"?<AdminForm type="Video" edForm={edForm} setEdForm={setEdForm} fields={[["title","Title"],["cat","Category","select"],["dur","Duration (e.g. '12:34')"],["desc","Description","textarea"],["embedUrl","YouTube/Vimeo URL (paste any format — share link, watch URL, or embed URL)"],["icon","Emoji thumbnail"],["free","Free","check"]]} onSave={()=>saveContent("videos")}/>
          :<><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{color:T.mute}}>{videos.length}</span><button onClick={()=>setEdForm({type:"videos",data:{icon:"🎥",free:true,cat:TOPICS[0]},editing:false})} style={T.btn}>+ New</button></div>
          {videos.map(v=><div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border}}><div><div style={{fontWeight:500,fontSize:".88rem"}}>{v.title||v.t}</div><div style={{fontSize:".72rem",color:T.mute}}>{v.cat} · {v.free?"Free":"Premium"}</div></div><div style={{display:"flex",gap:4}}><button onClick={()=>setIgPost({item:v,type:"video"})} style={{...T.btnO,...T.btnSm}} title="Generate Instagram post">📸 IG</button><button onClick={()=>setEdForm({type:"videos",data:{...v},editing:true})} style={{...T.btnO,...T.btnSm}}>Edit</button><button onClick={()=>deleteContent("videos",v.id,v.title||v.t)} style={T.btnDanger}>Del</button></div></div>)}</>}</div>}
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
                  {p.feat&&<span style={T.tag(T.goldBg,T.goldD)}>★ FEATURED</span>}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:4}}>
              <button onClick={async()=>{
                const newFeat=!p.feat;
                await fbSet("forum",p.id,{feat:newFeat});
                setForumPosts(prev=>prev.map(x=>x.id===p.id?{...x,feat:newFeat}:x));
                sh(newFeat?"⭐ Marked as Featured":"Removed from Featured");
              }} style={{...T.btnO,...T.btnSm,...(p.feat?{background:T.gold,color:"#fff",borderColor:T.gold}:{})}}>{p.feat?"★ Unfeature":"☆ Feature"}</button>
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
              <button onClick={()=>setIgPost({item:cs,type:"case"})} style={{...T.btnO,...T.btnSm}} title="Generate Instagram post">📸 IG</button>
              <button onClick={()=>setEdForm({type:"cases",data:{...cs},editing:true})} style={{...T.btnO,...T.btnSm}}>Edit</button>
              <button onClick={()=>deleteContent("cases",cs.id,cs.title)} style={T.btnDanger}>Del</button>
            </div>
          </div>)}</>}</div>}

        {/* ═══ ANNOUNCEMENTS ADMIN — broadcast notifications to all users ═══ */}
        {aTab==="news"&&<div style={T.card}>
          <h4 style={{fontSize:"1rem",fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:8}}>📰 News & Industry Updates</h4>
          <p style={{fontSize:".82rem",color:T.txt2,marginBottom:18,lineHeight:1.55}}>Post news, regulatory updates, conference announcements, or industry insights. Items here appear in the "Latest research & news" section on the home page, mixed with auto-fetched PubMed papers.</p>

          <div style={{padding:"14px 18px",background:T.tealBg,borderLeft:"3px solid "+T.teal,borderRadius:"0 8px 8px 0",marginBottom:20}}>
            <div style={{fontSize:".7rem",color:T.teal,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>📝 Compose news item</div>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Headline <span style={{color:T.err}}>*</span></label>
            <input value={newsTitle} onChange={e=>setNewsTitle(e.target.value)} placeholder="e.g. FDA approves new biostimulator filler for facial volume" style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Topic</label>
            <select value={newsCat} onChange={e=>setNewsCat(e.target.value)} style={{...T.inp,marginBottom:12}}>
              <option value="">— Select topic —</option>
              {TOPICS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Brief summary</label>
            <textarea value={newsBody} onChange={e=>setNewsBody(e.target.value)} placeholder="Optional — 1-2 sentences. If blank, only headline shows." rows={3} style={{...T.txa,marginBottom:12,fontSize:".9rem",lineHeight:1.6}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>External link (where users go when they click)</label>
            <input value={newsUrl} onChange={e=>setNewsUrl(e.target.value)} placeholder="https://..." style={{...T.inp,marginBottom:12}}/>

            <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Cover image (optional — smart placeholder shows if blank)</label>
            <div style={{marginBottom:12}}>
              {newsImage?<div style={{position:"relative",width:"100%",maxWidth:280,height:130,borderRadius:8,overflow:"hidden",border:"1px solid "+T.border,marginBottom:8}}>
                <img src={newsImage} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                <button onClick={()=>setNewsImage("")} style={{position:"absolute",top:6,right:6,width:24,height:24,borderRadius:"50%",background:"rgba(0,0,0,.6)",color:"#fff",border:"none",fontSize:".7rem",cursor:"pointer"}}>✕</button>
              </div>:null}
              <input type="file" accept="image/*" onChange={async e=>{
                const f=e.target.files?.[0];
                if(!f)return;
                try{
                  const path=`news/${Date.now()}_${f.name}`;
                  const sRef=ref(storage,path);
                  await uploadBytes(sRef,f);
                  const url=await getDownloadURL(sRef);
                  setNewsImage(url);
                  sh("Image uploaded");
                }catch(err){sh("Upload failed");console.error(err)}
                if(e.target)e.target.value="";
              }} style={{fontSize:".8rem"}}/>
            </div>

            <button onClick={async()=>{
              if(!newsTitle.trim()){sh("Headline required");return}
              await fbAdd("news",{
                title:newsTitle.trim(),
                body:newsBody.trim(),
                url:newsUrl.trim(),
                cat:newsCat||"",
                image:newsImage||"",
                source:"admin",
                createdAt:Date.now(),
                date:ds(getIST()),
                author:uName,
              });
              setNewsTitle("");setNewsBody("");setNewsUrl("");setNewsCat("");setNewsImage("");
              loadData();
              sh("📰 News posted!");
            }} style={{...T.btn,padding:"10px 20px"}}>📰 Publish news item</button>
          </div>

          <h5 style={{fontSize:".88rem",fontWeight:700,marginBottom:10}}>Recent news posts ({newsPosts.length})</h5>
          {newsPosts.length===0&&<p style={{color:T.mute,fontSize:".84rem"}}>No news posted yet.</p>}
          {newsPosts.map(n=><div key={n.id} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:"1px solid "+T.border,alignItems:"flex-start"}}>
            {n.image?<img src={n.image} style={{width:60,height:60,borderRadius:8,objectFit:"cover",flexShrink:0,border:"1px solid "+T.border}}/>:<div style={{width:60,height:60,borderRadius:8,background:T.tealBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem",flexShrink:0,border:"1px solid "+T.border}}>📰</div>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:".88rem",fontWeight:600,marginBottom:3}}>{n.title}</div>
              {n.cat&&<span style={T.tag(T.tealBg,T.teal)}>{n.cat}</span>}
              <div style={{fontSize:".7rem",color:T.mute,marginTop:4}}>{fD(n.date)} · by {n.author||"admin"}{(n.views||0)>0?` · 👁️ ${n.views} clicks`:""}</div>
            </div>
            <div style={{display:"flex",gap:4,flexShrink:0}}>
              <button onClick={()=>setIgPost({item:n,type:"news"})} style={{...T.btnO,...T.btnSm}} title="Generate Instagram post">📸 IG</button>
              <button onClick={async()=>{if(confirm("Delete this news item?")){await fbDel("news",n.id);loadData();sh("Deleted")}}} style={{...T.btnDanger,...T.btnSm}}>Delete</button>
            </div>
          </div>)}
        </div>}

        {aTab==="rewards"&&<div>
          {/* ═══ COMPOSE NEW REWARD ═══ */}
          <div style={{...T.card,marginBottom:14}}>
            <h4 style={{fontSize:"1rem",fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:8}}>🎁 Rewards Catalog</h4>
            <p style={{fontSize:".82rem",color:T.txt2,marginBottom:18,lineHeight:1.55}}>Add rewards from partners (Pharma, Institutes, Event organizers). Doctors redeem points for vouchers. Partners deduct the value at their checkout. <b>You don't pay anything</b> — partners eat the discount.</p>

            <div style={{padding:"14px 18px",background:T.tealBg,borderLeft:"3px solid "+T.teal,borderRadius:"0 8px 8px 0",marginBottom:14}}>
              <div style={{fontSize:".7rem",color:T.teal,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>📝 Add new reward</div>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Reward title <span style={{color:T.err}}>*</span></label>
              <input value={rwTitle} onChange={e=>setRwTitle(e.target.value)} placeholder="e.g. ₹500 off Botox Masterclass" style={{...T.inp,marginBottom:10}}/>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Partner / Brand <span style={{color:T.err}}>*</span></label>
              <input value={rwPartner} onChange={e=>setRwPartner(e.target.value)} placeholder="e.g. Absolute Institute" style={{...T.inp,marginBottom:10}}/>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div>
                  <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Point cost <span style={{color:T.err}}>*</span></label>
                  <input type="number" value={rwCost} onChange={e=>setRwCost(e.target.value)} placeholder="200" style={T.inp}/>
                </div>
                <div>
                  <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Stock (count)</label>
                  <input type="number" value={rwStock} onChange={e=>setRwStock(e.target.value)} placeholder="10" style={T.inp}/>
                </div>
              </div>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Category (optional)</label>
              <input value={rwCategory} onChange={e=>setRwCategory(e.target.value)} placeholder="e.g. Course, Product, Event, Service" style={{...T.inp,marginBottom:10}}/>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Description</label>
              <textarea value={rwDesc} onChange={e=>setRwDesc(e.target.value)} placeholder="What this reward includes — 1-2 sentences." rows={2} style={{...T.txa,marginBottom:10}}/>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Redemption instructions for the doctor</label>
              <textarea value={rwInstructions} onChange={e=>setRwInstructions(e.target.value)} placeholder="e.g. Email this code to partner@absolute.com OR show at registration desk OR enter at checkout" rows={2} style={{...T.txa,marginBottom:10}}/>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Expires on (optional)</label>
              <input type="date" value={rwExpiry} onChange={e=>setRwExpiry(e.target.value)} style={{...T.inp,marginBottom:10}}/>

              <label style={{display:"block",fontSize:".7rem",color:T.teal,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Cover image (optional)</label>
              <div style={{marginBottom:12}}>
                {rwImage?<div style={{position:"relative",width:"100%",maxWidth:240,height:120,borderRadius:8,overflow:"hidden",border:"1px solid "+T.border,marginBottom:8}}>
                  <img src={rwImage} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  <button onClick={()=>setRwImage("")} style={{position:"absolute",top:6,right:6,width:24,height:24,borderRadius:"50%",background:"rgba(0,0,0,.6)",color:"#fff",border:"none",fontSize:".7rem",cursor:"pointer"}}>✕</button>
                </div>:null}
                <input type="file" accept="image/*" onChange={async e=>{
                  const f=e.target.files?.[0];if(!f)return;
                  try{const path=`rewards/${Date.now()}_${f.name}`;const sRef=ref(storage,path);await uploadBytes(sRef,f);const url=await getDownloadURL(sRef);setRwImage(url);sh("Image uploaded");}
                  catch(err){sh("Upload failed");console.error(err)}
                  if(e.target)e.target.value="";
                }} style={{fontSize:".8rem"}}/>
              </div>

              <button onClick={async()=>{
                if(!rwTitle.trim()){sh("Title required");return}
                if(!rwPartner.trim()){sh("Partner name required");return}
                const cost=parseInt(rwCost);
                if(!cost||cost<=0){sh("Point cost must be a positive number");return}
                const stock=parseInt(rwStock)||0;
                await fbAdd("rewards",{
                  title:rwTitle.trim(),
                  partner:rwPartner.trim(),
                  desc:rwDesc.trim(),
                  pointCost:cost,
                  stock,
                  category:rwCategory.trim(),
                  instructions:rwInstructions.trim(),
                  image:rwImage||"",
                  expiry:rwExpiry||"",
                  active:true,
                  timesRedeemed:0,
                  createdAt:Date.now(),
                  date:ds(getIST()),
                });
                setRwTitle("");setRwDesc("");setRwPartner("");setRwCost("");setRwStock("");setRwCategory("");setRwInstructions("");setRwImage("");setRwExpiry("");
                loadData();
                sh("🎁 Reward added!");
              }} style={{...T.btn,padding:"10px 20px"}}>🎁 Add to catalog</button>
            </div>

            {/* Existing rewards list */}
            <h5 style={{fontSize:".88rem",fontWeight:700,marginBottom:10}}>Active rewards ({rewards.filter(r=>r.active).length}) · All ({rewards.length})</h5>
            {rewards.length===0&&<p style={{color:T.mute,fontSize:".84rem"}}>No rewards yet. Add your first one above.</p>}
            {rewards.map(r=><div key={r.id} style={{display:"flex",gap:12,padding:"12px 0",borderBottom:"1px solid "+T.border,alignItems:"flex-start",opacity:r.active?1:.5}}>
              {r.image?<img src={r.image} style={{width:64,height:64,borderRadius:8,objectFit:"cover",flexShrink:0,border:"1px solid "+T.border}}/>:<div style={{width:64,height:64,borderRadius:8,background:T.goldBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.6rem",flexShrink:0}}>🎁</div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:".9rem",fontWeight:600,marginBottom:3}}>{r.title}{!r.active&&<span style={{color:T.mute,marginLeft:6,fontSize:".75rem",fontWeight:400}}>(inactive)</span>}</div>
                <div style={{fontSize:".75rem",color:T.txt2,marginBottom:4}}>{r.partner}{r.category?` · ${r.category}`:""}</div>
                <div style={{display:"flex",gap:10,fontSize:".72rem",color:T.mute,flexWrap:"wrap"}}>
                  <span style={{color:T.gold,fontWeight:600}}>⭐ {r.pointCost} pts</span>
                  <span>📦 {r.stock||0} in stock</span>
                  {(r.timesRedeemed||0)>0&&<span>🔥 {r.timesRedeemed} redeemed</span>}
                  {r.expiry&&<span>📅 Expires {fD(r.expiry)}</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button onClick={async()=>{await fbSet("rewards",r.id,{active:!r.active});loadData();sh(r.active?"Disabled":"Activated")}} style={{...T.btnO,...T.btnSm}}>{r.active?"Disable":"Enable"}</button>
                <button onClick={async()=>{if(confirm(`Delete "${r.title}"? This won't refund anyone who already redeemed it.`)){await fbDel("rewards",r.id);loadData();sh("Deleted")}}} style={{...T.btnDanger,...T.btnSm}}>Delete</button>
              </div>
            </div>)}
          </div>

          {/* ═══ REDEMPTION QUEUE ═══ */}
          <div style={T.card}>
            <h4 style={{fontSize:"1rem",fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:8}}>📋 Redemption Queue</h4>
            <p style={{fontSize:".78rem",color:T.txt2,marginBottom:14,lineHeight:1.55}}>Doctor redemptions. Mark as <b>fulfilled</b> once the partner has confirmed the voucher was honored. Doctors keep their points reservation regardless of fulfillment status.</p>
            {redemptions.length===0&&<p style={{color:T.mute,fontSize:".84rem"}}>No redemptions yet.</p>}
            {redemptions.map(rd=><div key={rd.id} style={{padding:"12px 14px",borderRadius:10,border:"1px solid "+T.border,marginBottom:8,background:rd.status==="fulfilled"?T.okBg:rd.status==="pending"?T.warnBg+"33":T.bg}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontSize:".88rem",fontWeight:600,marginBottom:3}}>{rd.rewardTitle}</div>
                  <div style={{fontSize:".75rem",color:T.txt2,marginBottom:3}}>👤 {rd.userName} · {rd.userEmail}</div>
                  <div style={{fontSize:".72rem",color:T.mute}}>{rd.partner} · {fD(rd.date)} · {rd.pointCost} pts</div>
                  <div style={{fontSize:".78rem",fontFamily:"monospace",fontWeight:700,color:T.gold,marginTop:6,padding:"4px 10px",background:"#fff",borderRadius:6,display:"inline-block",border:"1px dashed "+T.gold}}>{rd.code}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:5,flexShrink:0}}>
                  <span style={{fontSize:".7rem",fontWeight:700,padding:"3px 9px",borderRadius:10,background:rd.status==="fulfilled"?T.okBg:rd.status==="pending"?T.warnBg:T.bg,color:rd.status==="fulfilled"?T.ok:rd.status==="pending"?T.warn:T.mute,textTransform:"uppercase",letterSpacing:.5}}>{rd.status||"pending"}</span>
                  {rd.status!=="fulfilled"&&<button onClick={async()=>{await fbSet("redemptions",rd.id,{status:"fulfilled",fulfilledAt:Date.now()});loadData();sh("Marked fulfilled")}} style={{...T.btn,...T.btnSm}}>✓ Mark fulfilled</button>}
                </div>
              </div>
            </div>)}
          </div>
        </div>}

        {aTab==="vendors"&&<div>
          <div style={{...T.card,marginBottom:14}}>
            <h4 style={{fontSize:"1rem",fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:8}}>🏢 Vendor Partners</h4>
            <p style={{fontSize:".82rem",color:T.txt2,lineHeight:1.55,marginBottom:0}}>
              Vendors who have applied to offer rewards. Approve to let them propose offerings. Their reward proposals appear in the Submissions tab with type "vendor_reward".
            </p>
          </div>

          {(()=>{
            const pending=vendorApplications.filter(a=>a.status==="pending");
            const approved=vendorApplications.filter(a=>a.status==="approved");
            const rejected=vendorApplications.filter(a=>a.status==="rejected");

            return(<>
              {/* Pending applications */}
              <h5 style={{fontSize:".88rem",fontWeight:700,marginBottom:10}}>⏳ Pending applications ({pending.length})</h5>
              {pending.length===0?<p style={{color:T.mute,fontSize:".82rem",marginBottom:16}}>No pending applications.</p>:
                pending.map(va=><div key={va.id} style={{...T.card,marginBottom:10,borderLeft:"3px solid "+T.warn}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:240}}>
                      <div style={{fontSize:".95rem",fontWeight:700,marginBottom:4}}>{va.companyName}</div>
                      <div style={{fontSize:".78rem",color:T.txt2,marginBottom:6}}>{va.contactName} · {va.contactEmail}</div>
                      <div style={{fontSize:".82rem",color:T.txt,padding:"8px 10px",background:T.bg,borderRadius:6,marginBottom:8}}><b>Offerings:</b> {va.offerings}</div>
                      <div style={{fontSize:".7rem",color:T.mute}}>Applied {fD(new Date(va.createdAt).toISOString().slice(0,10))}</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      <button onClick={async()=>{
                        try{
                          await fbSet("vendorApplications",va.id,{status:"approved",approvedAt:Date.now(),approvedBy:au.email});
                          sh("✅ Vendor approved");
                          // Email vendor
                          sendEmail("submission_approved",va.contactEmail,{
                            name:va.contactName,
                            contentType:"vendor",
                            title:`${va.companyName} approved as Reward Partner`,
                          });
                          loadData();
                        }catch(err){console.error(err);sh("Approval failed")}
                      }} style={{...T.btn,...T.btnSm,fontSize:".75rem"}}>✓ Approve</button>
                      <button onClick={async()=>{
                        const reason=prompt("Reason for rejection (will be shown to vendor):");
                        if(!reason)return;
                        try{
                          await fbSet("vendorApplications",va.id,{status:"rejected",reviewReason:reason,rejectedAt:Date.now()});
                          sh("Application rejected");
                          loadData();
                        }catch(err){console.error(err);sh("Rejection failed")}
                      }} style={{...T.btnO,...T.btnSm,fontSize:".75rem"}}>✕ Reject</button>
                    </div>
                  </div>
                </div>)
              }

              {/* Approved partners */}
              <h5 style={{fontSize:".88rem",fontWeight:700,marginBottom:10,marginTop:18}}>✓ Approved partners ({approved.length})</h5>
              {approved.length===0?<p style={{color:T.mute,fontSize:".82rem",marginBottom:16}}>No approved partners yet.</p>:
                approved.map(va=>{
                  const vrewards=rewards.filter(r=>r.vendorId===va.uid);
                  const vredemptions=redemptions.filter(rd=>{
                    const r=rewards.find(x=>x.id===rd.rewardId);
                    return r&&r.vendorId===va.uid;
                  });
                  return(<div key={va.id} style={{...T.card,marginBottom:10,borderLeft:"3px solid "+T.teal}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                      <div>
                        <div style={{fontSize:".92rem",fontWeight:700}}>{va.companyName}</div>
                        <div style={{fontSize:".74rem",color:T.mute}}>{va.contactName} · {va.contactEmail} · {vrewards.length} rewards · {vredemptions.length} redemptions</div>
                      </div>
                      <button onClick={async()=>{
                        if(!confirm(`Suspend ${va.companyName}? Their rewards will stay active until you disable them in the Rewards tab.`))return;
                        await fbSet("vendorApplications",va.id,{status:"pending"});
                        sh("Vendor moved back to pending");
                        loadData();
                      }} style={{...T.btnO,...T.btnSm,fontSize:".72rem"}}>Suspend</button>
                    </div>
                  </div>);
                })
              }

              {rejected.length>0&&<>
                <h5 style={{fontSize:".88rem",fontWeight:700,marginBottom:10,marginTop:18,color:T.mute}}>Rejected ({rejected.length})</h5>
                {rejected.map(va=><div key={va.id} style={{padding:"8px 12px",background:T.bg,borderRadius:6,marginBottom:6,fontSize:".78rem",color:T.mute}}>
                  <b>{va.companyName}</b> · {va.contactEmail}
                  {va.reviewReason&&<div style={{fontStyle:"italic",fontSize:".74rem",marginTop:2}}>Reason: {va.reviewReason}</div>}
                </div>)}
              </>}
            </>);
          })()}
        </div>}

        {aTab==="roles"&&<div>
          <div style={{...T.card,marginBottom:14}}>
            <h4 style={{fontSize:"1rem",fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:8}}>🛡️ Roles & Moderators</h4>
            <p style={{fontSize:".82rem",color:T.txt2,marginBottom:14,lineHeight:1.55}}>
              Manage who can publish content (Content Contributors) and moderate community discussion (Forum Moderators).
              Every role change and moderator action is logged in the audit trail below.
            </p>
            <div style={{padding:"12px 14px",background:T.tealBg,borderLeft:"3px solid "+T.teal,borderRadius:"0 8px 8px 0",fontSize:".78rem",color:T.txt2,lineHeight:1.6}}>
              <b>Role guide:</b><br/>
              ✍️ <b>Content Contributor</b> — Can submit articles, videos, news (admin reviews before publishing). Open to all account types. Attribution is shown to readers.<br/>
              🛡️ <b>Forum Moderator</b> — Can flag/soft-delete forum posts &amp; cases. <b>Doctors only</b> — to prevent commercial conflicts.<br/>
              ⚡ <b>Admin</b> — Full access. Set via email allowlist in code.
            </div>
          </div>

          {/* PENDING APPLICATIONS QUEUE */}
          {(()=>{
            const pending=roleApplications.filter(a=>a.status==="pending");
            if(pending.length===0)return null;
            return(<div style={{...T.card,marginBottom:14,borderLeft:"3px solid "+T.gold}}>
              <h5 style={{fontSize:".95rem",fontWeight:700,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>📨 Pending Applications ({pending.length})</h5>
              {pending.map(app=>{
                const rd=ROLE_DISPLAY[app.requestedRole]||{label:app.requestedRole,bg:T.bg,fg:T.txt};
                const isForumModRole=app.requestedRole===ROLES.FORUM_MODERATOR;
                const isDoctor=app.accountType==="doctor";
                const conflictWarning=isForumModRole&&!isDoctor;
                return<div key={app.id} style={{padding:14,border:"1px solid "+T.border,borderRadius:10,marginBottom:10,background:"#fff"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap",marginBottom:8}}>
                    <div style={{flex:1,minWidth:220}}>
                      <div style={{fontWeight:600,fontSize:".95rem",marginBottom:3}}>{app.userName}</div>
                      <div style={{fontSize:".72rem",color:T.mute,marginBottom:6}}>{app.userEmail} · {app.accountType} · {app.currentPoints} pts · {app.currentTier}</div>
                      <span style={{display:"inline-block",padding:"3px 9px",borderRadius:10,fontSize:".7rem",fontWeight:700,background:rd.bg,color:rd.fg,marginBottom:8}}>{rd.icon} Wants: {rd.label}</span>
                    </div>
                    <div style={{fontSize:".7rem",color:T.mute,flexShrink:0}}>{fD(app.date)}</div>
                  </div>
                  {conflictWarning&&<div style={{padding:"8px 10px",background:"#fce4ec",borderLeft:"3px solid #c2185b",borderRadius:"0 6px 6px 0",fontSize:".74rem",color:"#880e4f",marginBottom:10}}>
                    ⚠️ <b>Conflict warning:</b> Forum Moderator role is intended for doctors only. This applicant is a <b>{app.accountType}</b> — approving may create conflict of interest issues.
                  </div>}
                  {app.reason&&<div style={{fontSize:".82rem",color:T.txt,lineHeight:1.55,marginBottom:6}}><b>Why:</b> {app.reason}</div>}
                  {app.experience&&<div style={{fontSize:".82rem",color:T.txt,lineHeight:1.55,marginBottom:10}}><b>Experience:</b> {app.experience}</div>}
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <button onClick={async()=>{
                      const note=prompt("Optional note (visible only to admins):","");
                      if(note===null)return;
                      await reviewApplication(app.id,"approved",note||"");
                    }} style={{...T.btn,padding:"8px 16px",fontSize:".82rem"}}>✓ Approve & promote</button>
                    <button onClick={async()=>{
                      const note=prompt("Reason for rejection (kept private):","");
                      if(note===null)return;
                      await reviewApplication(app.id,"rejected",note||"");
                    }} style={{...T.btnDanger,padding:"8px 16px",fontSize:".82rem"}}>✗ Reject</button>
                    <button onClick={()=>viewProfile(app.uid)} style={{...T.btnO,padding:"8px 16px",fontSize:".82rem"}}>View profile →</button>
                  </div>
                </div>;
              })}
            </div>);
          })()}

          {/* CURRENT MODERATORS */}
          <div style={{...T.card,marginBottom:14}}>
            <h5 style={{fontSize:".95rem",fontWeight:700,marginBottom:12}}>Current moderators & contributors</h5>
            {(()=>{
              const mods=allUsers.filter(u=>u.role&&Object.values(ROLES).includes(u.role));
              if(mods.length===0)return<p style={{color:T.mute,fontSize:".84rem"}}>No moderators yet. Approve applications above to start building your team.</p>;
              return mods.map(u=>{
                const rd=ROLE_DISPLAY[u.role]||{label:u.role,bg:T.bg,fg:T.txt};
                return<div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid "+T.border}}>
                  {u.photo?<img src={u.photo} style={{width:38,height:38,borderRadius:"50%",objectFit:"cover"}}/>:<div style={T.av(38,T.tealBg,T.teal)}>{u.initials||"?"}</div>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontWeight:600,fontSize:".88rem"}}>{u.name}</span>
                      <span style={{padding:"2px 8px",borderRadius:10,fontSize:".66rem",fontWeight:700,background:rd.bg,color:rd.fg}}>{rd.icon} {rd.label}</span>
                    </div>
                    <div style={{fontSize:".7rem",color:T.mute}}>{u.email} · {u.accountType||"unknown"}</div>
                  </div>
                  <button onClick={async()=>{
                    if(confirm(`Remove ${u.name}'s ${rd.label} role?\n\nThey'll keep all their earned points and content.`)){
                      const reason=prompt("Reason (logged in audit trail):","")||"";
                      await assignRole(u.id,u.name,null,reason);
                    }
                  }} style={{...T.btnDanger,...T.btnSm}}>Remove role</button>
                </div>;
              });
            })()}
          </div>

          {/* MANUAL ROLE ASSIGNMENT */}
          <div style={{...T.card,marginBottom:14}}>
            <h5 style={{fontSize:".95rem",fontWeight:700,marginBottom:6}}>Manual role assignment</h5>
            <p style={{fontSize:".78rem",color:T.txt2,marginBottom:12,lineHeight:1.55}}>Assign a role to any user without an application. Use sparingly — applications are the cleaner path.</p>
            <ManualRoleAssign allUsers={allUsers} assignRole={assignRole} T={T} ROLES={ROLES} ROLE_DISPLAY={ROLE_DISPLAY}/>
          </div>

          {/* AUDIT LOG */}
          <div style={T.card}>
            <h5 style={{fontSize:".95rem",fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:8}}>📜 Audit log</h5>
            <p style={{fontSize:".78rem",color:T.txt2,marginBottom:12,lineHeight:1.55}}>Every role change and moderator action is recorded here. Recent {moderationLog.length} entries.</p>
            {moderationLog.length===0&&<p style={{color:T.mute,fontSize:".84rem"}}>No actions logged yet.</p>}
            {moderationLog.slice(0,30).map(log=><div key={log.id} style={{padding:"8px 12px",borderBottom:"1px solid "+T.border,fontSize:".78rem",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:200}}>
                <div style={{color:T.txt}}>
                  <b>{log.actorName}</b> ({log.actorRole}) → <span style={{color:T.teal,fontWeight:600}}>{log.action}</span>
                  {log.targetName&&<> on <b>{log.targetName}</b></>}
                  {log.applicantName&&<> for <b>{log.applicantName}</b></>}
                </div>
                <div style={{color:T.mute,fontSize:".7rem",marginTop:3}}>
                  {log.oldRole&&log.newRole&&`${ROLE_DISPLAY[log.oldRole]?.label||log.oldRole} → ${ROLE_DISPLAY[log.newRole]?.label||log.newRole}`}
                  {log.oldRole&&!log.newRole&&`${ROLE_DISPLAY[log.oldRole]?.label||log.oldRole} → removed`}
                  {!log.oldRole&&log.newRole&&`Assigned: ${ROLE_DISPLAY[log.newRole]?.label||log.newRole}`}
                  {log.decision&&` · Decision: ${log.decision}`}
                  {log.reason&&` · "${log.reason}"`}
                  {log.note&&` · "${log.note}"`}
                </div>
              </div>
              <div style={{fontSize:".68rem",color:T.mute,flexShrink:0}}>{fD(log.date)}</div>
            </div>)}
          </div>
        </div>}

        {aTab==="submissions"&&<div>
          <div style={{...T.card,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:240}}>
                <h4 style={{fontSize:"1rem",fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:8}}>📥 Submission Review Queue</h4>
                <p style={{fontSize:".82rem",color:T.txt2,lineHeight:1.55,marginBottom:0}}>
                  User-submitted content waiting for review. Approving publishes it to the appropriate section.
                  Rejecting notifies the submitter with your reason.
                </p>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                <button onClick={loadData} style={{...T.btnO,padding:"6px 14px",fontSize:".78rem"}}>↻ Reload</button>
                <span style={{fontSize:".68rem",color:T.mute}}>Total fetched: {submissions.length}</span>
              </div>
            </div>
            {submissions.length===0&&<div style={{marginTop:14,padding:"10px 14px",background:T.warnBg,borderLeft:"3px solid "+T.warn,borderRadius:"0 6px 6px 0",fontSize:".78rem",color:T.txt2,lineHeight:1.55}}>
              ⚠️ <b>No submissions visible.</b> If users have submitted content but you don't see anything here, possible causes: (1) Firestore rules may not include the <code style={{background:"#fff",padding:"1px 5px",borderRadius:3,fontSize:".74rem"}}>submissions</code> collection — publish the latest rules. (2) Open browser DevTools console (F12) and look for <code style={{background:"#fff",padding:"1px 5px",borderRadius:3,fontSize:".74rem"}}>permission-denied</code> errors. (3) Click ↻ Reload above.
            </div>}
          </div>

          {/* Filter by status */}
          {(()=>{
            const pending=submissions.filter(s=>s.status==="pending");
            const reviewed=submissions.filter(s=>s.status!=="pending");

            return(<>
              {/* PENDING */}
              <div style={{...T.card,marginBottom:14,borderLeft:"3px solid "+T.gold}}>
                <h5 style={{fontSize:".95rem",fontWeight:700,marginBottom:12}}>⏳ Pending review ({pending.length})</h5>
                {pending.length===0&&<p style={{color:T.mute,fontSize:".84rem"}}>Nothing waiting. Submissions from users will appear here.</p>}
                {pending.map(sub=>{
                  const cfg=SUBMISSION_TYPES[sub.type]||{label:sub.type,icon:"📄",color:T.teal};
                  return(<div key={sub.id} style={{padding:14,border:"1px solid "+T.border,borderRadius:10,marginBottom:10,background:"#fff"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:12}}>
                      <div style={{flex:1,minWidth:240}}>
                        <div style={{display:"flex",gap:6,marginBottom:6,flexWrap:"wrap",alignItems:"center"}}>
                          <span style={{padding:"3px 10px",borderRadius:10,fontSize:".7rem",fontWeight:700,background:T.tealBg,color:cfg.color}}>{cfg.icon} {cfg.label}</span>
                          <span style={{fontSize:".7rem",color:T.mute}}>by <b style={{color:T.txt2}}>{sub.submitterName}</b> ({sub.submitterAccountType})</span>
                        </div>
                        <div style={{fontSize:"1rem",fontWeight:600,color:T.txt,lineHeight:1.4,marginBottom:6}}>{sub.data?.title||"Untitled"}</div>
                        {sub.coverImage&&<img src={sub.coverImage} style={{maxWidth:300,maxHeight:160,borderRadius:8,border:"1px solid "+T.border,marginBottom:8,display:"block"}}/>}
                        <div style={{fontSize:".78rem",color:T.txt2,lineHeight:1.6}}>
                          {Object.entries(sub.data||{}).filter(([k,v])=>k!=="title"&&v).map(([k,v])=>{
                            const fieldDef=cfg.fields?.find(f=>f.key===k);
                            const label=fieldDef?.label||k;
                            return<div key={k} style={{marginBottom:4}}><b style={{color:T.txt}}>{label}:</b> {typeof v==="string"?v.slice(0,300)+(v.length>300?"...":""):String(v)}</div>;
                          })}
                        </div>
                        <div style={{fontSize:".7rem",color:T.mute,marginTop:8,paddingTop:8,borderTop:"1px dashed "+T.border}}>
                          Submitted {fD(sub.date)} · {sub.submitterEmail}
                        </div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",paddingTop:10,borderTop:"1px solid "+T.border,alignItems:"center"}}>
                      {sub.type==="vendor_reward"?
                        // Vendor reward needs pointCost — show inline input + custom approve
                        <>
                          <label style={{fontSize:".78rem",color:T.txt2,fontWeight:600,whiteSpace:"nowrap"}}>Set point cost:</label>
                          <input id={`pc-${sub.id}`} type="number" placeholder="e.g. 500" min="1" defaultValue={sub.data?.pointCost||""} style={{...T.inp,width:120,padding:"6px 10px",fontSize:".82rem"}}/>
                          <button onClick={async()=>{
                            const pc=parseInt(document.getElementById(`pc-${sub.id}`).value);
                            if(!pc||pc<=0){sh("Enter a valid point cost first");return}
                            // Pass pointCost via edits — approveSubmission merges this into finalData
                            await approveSubmission(sub.id,{pointCost:pc});
                          }} style={{...T.btn,padding:"8px 16px",fontSize:".82rem"}}>✓ Set cost & approve</button>
                          <button onClick={async()=>{
                            const reason=prompt("Why are you rejecting? (visible to submitter):","");
                            if(reason===null)return;
                            await rejectSubmission(sub.id,reason);
                          }} style={{...T.btnDanger,padding:"8px 16px",fontSize:".82rem"}}>✗ Reject</button>
                        </>
                      :
                        // All other submission types — original buttons
                        <>
                          <button onClick={async()=>{
                            if(confirm(`Approve & publish this ${cfg.label}?`)){
                              await approveSubmission(sub.id);
                            }
                          }} style={{...T.btn,padding:"8px 16px",fontSize:".82rem"}}>✓ Approve & publish</button>
                          <button onClick={async()=>{
                            const reason=prompt("Why are you rejecting? (visible to submitter):","");
                            if(reason===null)return;
                            await rejectSubmission(sub.id,reason);
                          }} style={{...T.btnDanger,padding:"8px 16px",fontSize:".82rem"}}>✗ Reject</button>
                          <button onClick={()=>viewProfile(sub.submitterUid)} style={{...T.btnO,padding:"8px 16px",fontSize:".82rem"}}>View submitter →</button>
                        </>
                      }
                    </div>
                  </div>);
                })}
              </div>

              {/* REVIEWED (recent history) */}
              {reviewed.length>0&&<div style={T.card}>
                <h5 style={{fontSize:".95rem",fontWeight:700,marginBottom:12}}>📜 Recent reviews ({reviewed.length})</h5>
                {reviewed.slice(0,15).map(sub=>{
                  const cfg=SUBMISSION_TYPES[sub.type]||{label:sub.type,icon:"📄"};
                  const statusColor={approved:T.ok,rejected:T.err}[sub.status]||T.mute;
                  const statusBg={approved:T.okBg,rejected:T.errBg}[sub.status]||T.bg;
                  return(<div key={sub.id} style={{padding:"8px 12px",borderBottom:"1px solid "+T.border,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:200}}>
                      <div style={{fontSize:".84rem",color:T.txt}}>
                        {cfg.icon} <b>{sub.data?.title||"Untitled"}</b>
                      </div>
                      <div style={{fontSize:".7rem",color:T.mute,marginTop:2}}>
                        {cfg.label} · {sub.submitterName} · reviewed by {sub.reviewerName||"admin"}
                        {sub.rejectionReason&&<> · "{sub.rejectionReason}"</>}
                      </div>
                    </div>
                    <span style={{padding:"2px 8px",borderRadius:10,fontSize:".64rem",fontWeight:700,letterSpacing:.5,textTransform:"uppercase",background:statusBg,color:statusColor,flexShrink:0}}>{sub.status}</span>
                  </div>);
                })}
              </div>}
            </>);
          })()}
        </div>}

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

        {aTab==="consents"&&<div style={T.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
            <div>
              <h3 style={{fontSize:"1rem",fontWeight:700,margin:0}}>📋 Consent Generation Log</h3>
              <p style={{color:T.mute,fontSize:".78rem",margin:"3px 0 0 0"}}>{allConsents.length} total generations across all users</p>
            </div>
            <button onClick={loadAllConsents} style={{...T.btnO,...T.btnSm}}>🔄 Refresh</button>
          </div>
          <div style={{padding:"8px 10px",background:T.tealBg+"33",borderLeft:"3px solid "+T.teal,borderRadius:"0 6px 6px 0",marginBottom:12,fontSize:".74rem",color:T.txt2,lineHeight:1.5}}>
            🔐 <b>Privacy note:</b> No patient names or clinical details are logged. Each entry records only: procedure type, language, doctor's clinic name, and timestamp.
          </div>
          {allConsents.length===0?
            <div style={{padding:"40px 12px",textAlign:"center",color:T.mute,fontSize:".82rem"}}>No consent generations yet.</div>
          :
            <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:600,overflowY:"auto"}}>
              {allConsents.map(h=>{
                const ts=h.createdAt?new Date(h.createdAt):null;
                const tsLabel=ts?ts.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"2-digit",hour:"2-digit",minute:"2-digit",hour12:true}):"";
                const langLabel=CONSENT_LANGUAGES.find(l=>l.code===h.language)?.label||"English";
                return(<div key={h.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:"#fafafa",borderRadius:6,border:"1px solid "+T.border,fontSize:".82rem",gap:10,flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,color:T.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.procedure||"(unknown)"} <span style={{fontWeight:400,color:T.mute,fontSize:".74rem"}}>· {langLabel}</span></div>
                    <div style={{fontSize:".72rem",color:T.mute,marginTop:2,display:"flex",gap:8,flexWrap:"wrap"}}>
                      <span>👤 {h.name||"(unnamed)"}</span>
                      <span>· {h.email||"(no email)"}</span>
                      {h.clinicName&&<span>· 🏥 {h.clinicName}</span>}
                      {h.usedCredit&&<span style={{color:T.gold,fontWeight:600}}>· 💳 credit</span>}
                      {h.isCustomProcedure&&<span>· custom</span>}
                    </div>
                  </div>
                  <div style={{fontSize:".72rem",color:T.mute,whiteSpace:"nowrap"}}>{tsLabel}</div>
                </div>);
              })}
            </div>
          }
        </div>}

        {/* ═══ ADMIN: REFERRALS TAB ═══
            Built entirely from allUsers (already loaded) — no extra Firestore reads.
            Shows every user with their referral code, who they referred, and payout status. */}
        {aTab==="referrals"&&(()=>{
          // Build referral pairs: for each user with referredBy set, find the referrer
          const referralPairs=allUsers
            .filter(u=>u.referredBy)
            .map(u=>{
              const referrer=allUsers.find(r=>r.referralCode===u.referredBy);
              return{
                referredId:u.id,referredName:u.name||"(unnamed)",referredEmail:u.email||"",
                referredJoined:u.joined||"",qualified:!!u.referralBonusPaid,
                referrerId:referrer?.id||null,referrerName:referrer?.name||"(code not found — possibly old/invalid)",
                referrerPaid:referrer?(referrer.referralsPaidFor||[]).includes(u.id):false,
                code:u.referredBy,
              };
            })
            .sort((a,b)=>(b.referredJoined||"").localeCompare(a.referredJoined||""));

          // Leaderboard: top referrers by successful (paid) referral count
          const referrerCounts={};
          allUsers.forEach(u=>{
            const paidCount=(u.referralsPaidFor||[]).length;
            if(paidCount>0)referrerCounts[u.id]={name:u.name||"(unnamed)",email:u.email||"",count:paidCount,code:u.referralCode||""};
          });
          const topReferrers=Object.values(referrerCounts).sort((a,b)=>b.count-a.count);

          const totalReferred=referralPairs.length;
          const totalQualified=referralPairs.filter(p=>p.qualified).length;
          const totalPaidOut=topReferrers.reduce((s,r)=>s+r.count,0)*100;

          return(<div>
            {/* Summary stats */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
              <div style={{...T.card,textAlign:"center",padding:16,marginBottom:0}}>
                <div style={{fontSize:"1.6rem",fontWeight:700,color:T.teal}}>{totalReferred}</div>
                <div style={{fontSize:".72rem",color:T.mute,textTransform:"uppercase",letterSpacing:.5}}>Total referred signups</div>
              </div>
              <div style={{...T.card,textAlign:"center",padding:16,marginBottom:0}}>
                <div style={{fontSize:"1.6rem",fontWeight:700,color:"#1a7d42"}}>{totalQualified}</div>
                <div style={{fontSize:".72rem",color:T.mute,textTransform:"uppercase",letterSpacing:.5}}>Qualified (answered 1st quiz)</div>
              </div>
              <div style={{...T.card,textAlign:"center",padding:16,marginBottom:0}}>
                <div style={{fontSize:"1.6rem",fontWeight:700,color:T.gold}}>{totalPaidOut}</div>
                <div style={{fontSize:".72rem",color:T.mute,textTransform:"uppercase",letterSpacing:.5}}>Total points paid out</div>
              </div>
              <div style={{...T.card,textAlign:"center",padding:16,marginBottom:0}}>
                <div style={{fontSize:"1.6rem",fontWeight:700,color:T.txt}}>{topReferrers.length}</div>
                <div style={{fontSize:".72rem",color:T.mute,textTransform:"uppercase",letterSpacing:.5}}>Active referrers</div>
              </div>
            </div>

            {/* Top referrers leaderboard */}
            {topReferrers.length>0&&<div style={{...T.card,marginBottom:16}}>
              <h3 style={{fontSize:"1rem",fontWeight:700,marginBottom:12}}>🏆 Top Referrers</h3>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {topReferrers.slice(0,10).map((r,i)=>(
                  <div key={r.email} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:i<3?T.goldBg+"40":T.bg,borderRadius:8,border:i<3?"1px solid "+T.gold+"44":"none"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                      <span style={{fontSize:".82rem",fontWeight:700,color:i===0?T.gold:T.mute,width:20}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</span>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:".84rem",fontWeight:600,color:T.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
                        <div style={{fontSize:".68rem",color:T.mute}}>{r.email} · code: {r.code}</div>
                      </div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:".92rem",fontWeight:700,color:T.teal}}>{r.count} referral{r.count!==1?"s":""}</div>
                      <div style={{fontSize:".68rem",color:T.gold}}>+{r.count*100} pts</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>}

            {/* Full referral ledger */}
            <div style={T.card}>
              <h3 style={{fontSize:"1rem",fontWeight:700,marginBottom:12}}>📋 Referral Ledger — who invited whom</h3>
              {referralPairs.length===0?
                <div style={{padding:"30px 12px",textAlign:"center",color:T.mute,fontSize:".84rem"}}>No referrals yet.</div>
              :
                <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:560,overflowY:"auto"}}>
                  {referralPairs.map(p=>(
                    <div key={p.referredId} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:T.bg,borderRadius:8,gap:10,flexWrap:"wrap"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
                        <div style={{minWidth:0}}>
                          <div style={{fontSize:".82rem",color:T.txt}}>
                            <b>{p.referrerName}</b> <span style={{color:T.mute}}>invited</span> <b>{p.referredName}</b>
                          </div>
                          <div style={{fontSize:".68rem",color:T.mute,marginTop:2}}>{p.referredEmail} · joined {p.referredJoined} · code: {p.code}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <span style={{fontSize:".68rem",fontWeight:600,padding:"3px 9px",borderRadius:6,background:p.qualified?"#e8f5e9":"#fff3cd",color:p.qualified?"#1a7d42":"#856404"}}>
                          {p.qualified?"✓ Qualified":"⏳ Pending 1st quiz"}
                        </span>
                        {p.qualified&&<span style={{fontSize:".68rem",fontWeight:600,padding:"3px 9px",borderRadius:6,background:p.referrerPaid?T.tealBg:"#f8d7da",color:p.referrerPaid?T.teal:"#721c24"}}>
                          {p.referrerPaid?"💰 Paid":"⚠️ Not yet paid"}
                        </span>}
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>
          </div>);
        })()}

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

      {/* ═══ CONSENT TEMPLATE GENERATOR PAGE ═══ */}
      {pg==="consent"&&(()=>{
        const isDoctor=prof?.accountType==="doctor"||ADMINS.includes(au?.email);
        if(!au||!prof){
          return(<div style={{maxWidth:560,margin:"40px auto",textAlign:"center",padding:"40px 24px",background:"#fff",borderRadius:14,border:"1px solid "+T.border}}>
            <div style={{fontSize:"2.4rem",marginBottom:10}}>🔒</div>
            <h3 style={{fontSize:"1.2rem",fontWeight:700,marginBottom:8}}>Sign in to use Consent Templates</h3>
            <p style={{color:T.txt2,fontSize:".9rem",lineHeight:1.6,marginBottom:18}}>The consent template generator is available to registered SKINARIO doctors.</p>
            <button onClick={()=>go("home")} style={{...T.btn,padding:"9px 20px",fontSize:".85rem"}}>Go to home</button>
          </div>);
        }
        if(!isDoctor){
          return(<div style={{maxWidth:620,margin:"40px auto",padding:"30px 24px",background:"#fff",borderRadius:14,border:"1px solid "+T.border}}>
            <h3 style={{fontSize:"1.2rem",fontWeight:700,marginBottom:10}}>Available to doctors only</h3>
            <p style={{color:T.txt2,fontSize:".9rem",lineHeight:1.65,marginBottom:14}}>The consent template generator is currently available only to verified doctor accounts. If you are a practicing physician, please update your account type in your profile or contact admin for verification.</p>
            <button onClick={()=>go("me")} style={{...T.btnO,padding:"9px 20px",fontSize:".85rem"}}>Go to my profile</button>
          </div>);
        }

        const todayKey=todayIST_YMD();
        const todaysCount=(prof.consentGenerations||{})[todayKey]||0;
        const credits=prof.consentCredits||0;
        const DAILY_FREE=2; // free generations per day for non-admin doctors
        const isAdminUser=ADMINS.includes(au?.email);
        const dailyExhausted=!isAdminUser && todaysCount>=DAILY_FREE;
        const cats=Object.keys(CONSENT_PROCEDURES);
        const proceduresForCat=consentCat?CONSENT_PROCEDURES[consentCat]?.procedures||{}:{};
        const subProcedures=Object.keys(proceduresForCat);
        const selectedProc=consentProc&&consentProc!=="__custom__"?proceduresForCat[consentProc]:null;

        return(<div style={{maxWidth:880,margin:"0 auto"}}>
          {/* Header */}
          <div style={{...T.card,padding:22,background:"linear-gradient(135deg,#fff,"+T.tealBg+"55)",borderLeft:"3px solid "+T.teal,marginBottom:16}}>
            <h2 style={{fontSize:"1.4rem",fontWeight:700,margin:0,display:"flex",alignItems:"center",gap:8}}>📋 Consent Template Generator</h2>
            <p style={{color:T.txt2,fontSize:".88rem",lineHeight:1.55,marginTop:8,marginBottom:0}}>
              Generate a procedure-specific informed consent template as an editable Word document.
              Fill in your clinic details once, choose a procedure, download. Customize and have reviewed by your legal counsel before clinical use.
            </p>
          </div>

          {/* Status / rate-limit card */}
          <div style={{...T.card,padding:16,marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <div>
              <div style={{fontSize:".82rem",fontWeight:600,color:T.txt}}>Today's usage</div>
              <div style={{fontSize:".76rem",color:T.txt2,marginTop:3}}>
                {isAdminUser
                  ? <span style={{color:T.teal,fontWeight:600}}>⭐ Admin — unlimited generations</span>
                  : <>
                      {todaysCount>=DAILY_FREE
                        ? `Used all ${DAILY_FREE} free generations today. `
                        : `${DAILY_FREE-todaysCount} of ${DAILY_FREE} free generations remaining today. `}
                      {credits>0&&<span style={{color:T.gold,fontWeight:600}}>+{credits} bonus credits available.</span>}
                    </>}
              </div>
            </div>
            {dailyExhausted&&credits<=0&&<div style={{padding:"6px 12px",background:T.errBg,color:T.err,borderRadius:8,fontSize:".74rem",fontWeight:600}}>Daily limit reached</div>}
          </div>

          {/* Pricing card — only visible to non-admin doctors */}
          {!isAdminUser&&<div style={{...T.card,padding:18,marginBottom:16,background:"linear-gradient(135deg,#fff,"+T.goldBg+"55)",borderLeft:"3px solid "+T.gold,position:"relative",overflow:"hidden"}}>
            {/* FREE-during-beta corner ribbon */}
            <div style={{position:"absolute",top:14,right:-32,transform:"rotate(35deg)",background:"#1a7d42",color:"#fff",padding:"4px 36px",fontSize:".64rem",fontWeight:700,letterSpacing:1.2,boxShadow:"0 2px 6px rgba(0,0,0,0.15)"}}>FREE IN BETA</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:".74rem",fontWeight:700,color:T.gold,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>⭐ Unlimited Plan</div>
                <div style={{fontSize:"1rem",fontWeight:700,marginBottom:4}}>Generate as many consent templates as you need</div>
                <div style={{fontSize:".78rem",color:T.txt2,lineHeight:1.5}}>
                  No daily limits · All procedures · All 7 languages · Word + PDF · DPDP-compliant
                </div>
              </div>
              <div style={{textAlign:"right",paddingTop:16}}>
                <div style={{fontSize:".82rem",color:T.mute,textDecoration:"line-through"}}>₹999/mo</div>
                <div style={{fontSize:"1.4rem",fontWeight:800,color:T.mute,textDecoration:"line-through",lineHeight:1}}>₹299<span style={{fontSize:".74rem",fontWeight:500}}>/mo</span></div>
                <div style={{fontSize:"1rem",fontWeight:800,color:"#1a7d42",marginTop:4,lineHeight:1}}>FREE</div>
                <div style={{fontSize:".62rem",color:T.mute,fontWeight:600,marginTop:2}}>limited beta</div>
              </div>
            </div>
            <button onClick={()=>{
              const waMessage=encodeURIComponent("Hi Dr. Patil, please activate my free beta access to the Unlimited consent template plan on SKINARIO. My account: "+(au.email||au.uid));
              window.open("https://wa.me/918390200008?text="+waMessage,"_blank");
            }} style={{...T.btn,marginTop:14,padding:"11px 20px",fontSize:".88rem",fontWeight:600,width:"100%",background:"#1a7d42"}}>
              💬 WhatsApp to activate (free during beta)
            </button>
            <div style={{fontSize:".68rem",color:T.mute,marginTop:8,textAlign:"center",lineHeight:1.55}}>
              Pricing shown is post-beta target rate. During beta, message us and we'll activate your unlimited access at no charge while we build the payment gateway.
            </div>
          </div>}

          {/* Disclaimer */}
          <div style={{...T.card,padding:14,marginBottom:16,background:"#fff5f3",borderLeft:"3px solid "+T.err}}>
            <div style={{fontSize:".8rem",color:T.err,fontWeight:700,marginBottom:6}}>⚠️ Educational Template — Not Legal Advice</div>
            <p style={{fontSize:".76rem",color:T.txt2,lineHeight:1.55,margin:0}}>
              This tool generates a starting template using general aesthetic medicine consent practice and current Indian regulatory requirements (including DPDP Act, 2023).
              The generated document is <b>not a substitute for legal advice</b> and must be reviewed by a qualified medical-legal advisor before use with patients. The red disclaimer block at the top of the generated document is removable in Word after you complete your own review.
            </p>
          </div>

          {/* Form */}
          <div style={{...T.card,padding:22}}>
            <h3 style={{fontSize:"1rem",fontWeight:700,marginBottom:14}}>1. Select the procedure</h3>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}} className="consent-grid">
              <div>
                <label style={{display:"block",fontSize:".74rem",color:T.mute,fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Category</label>
                <select value={consentCat} onChange={e=>{setConsentCat(e.target.value);setConsentProc("");setConsentCustomProc("")}} style={{...T.inp,width:"100%",padding:"9px 12px"}}>
                  <option value="">— Choose category —</option>
                  {cats.map(c=><option key={c} value={c}>{CONSENT_PROCEDURES[c].icon||""} {c}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:"block",fontSize:".74rem",color:T.mute,fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Sub-procedure</label>
                <select value={consentProc} onChange={e=>{setConsentProc(e.target.value);if(e.target.value!=="__custom__")setConsentCustomProc("")}} disabled={!consentCat} style={{...T.inp,width:"100%",padding:"9px 12px",opacity:consentCat?1:.55}}>
                  <option value="">— Choose procedure —</option>
                  {subProcedures.map(p=><option key={p} value={p}>{p}</option>)}
                  {consentCat&&<option value="__custom__">+ Other (enter manually)</option>}
                </select>
              </div>
            </div>

            {consentProc==="__custom__"&&<div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:".74rem",color:T.mute,fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Custom procedure name</label>
              <input value={consentCustomProc} onChange={e=>setConsentCustomProc(e.target.value)} placeholder="e.g. Laser Genesis" style={{...T.inp,width:"100%",padding:"9px 12px"}}/>
              <div style={{fontSize:".72rem",color:T.mute,marginTop:4}}>For custom procedures, generic risk and aftercare wording is used. Review and edit carefully.</div>
            </div>}

            {selectedProc&&<div style={{padding:"10px 14px",background:T.tealBg+"55",borderRadius:8,marginBottom:14,fontSize:".78rem",color:T.txt2,lineHeight:1.55}}>
              <div style={{fontWeight:600,color:T.teal,marginBottom:4}}>About this procedure:</div>
              {selectedProc.description}
            </div>}

            <h3 style={{fontSize:"1rem",fontWeight:700,marginBottom:6,marginTop:6}}>2. Patient details <span style={{fontSize:".74rem",color:T.mute,fontWeight:400}}>(optional)</span></h3>
            <p style={{fontSize:".74rem",color:T.txt2,marginBottom:10,lineHeight:1.5}}>Pre-fill the patient's details here, or leave blank to print a generic template that the patient fills by hand.</p>

            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:10,marginBottom:10}} className="consent-grid">
              <div>
                <label style={{display:"block",fontSize:".7rem",color:T.mute,fontWeight:600,marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Patient name</label>
                <input value={consentPatientName} onChange={e=>setConsentPatientName(e.target.value)} placeholder="e.g. Priya Sharma" style={{...T.inp,width:"100%",padding:"8px 10px",fontSize:".88rem"}}/>
              </div>
              <div>
                <label style={{display:"block",fontSize:".7rem",color:T.mute,fontWeight:600,marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Age</label>
                <input value={consentPatientAge} onChange={e=>setConsentPatientAge(e.target.value)} placeholder="e.g. 32" style={{...T.inp,width:"100%",padding:"8px 10px",fontSize:".88rem"}}/>
              </div>
              <div>
                <label style={{display:"block",fontSize:".7rem",color:T.mute,fontWeight:600,marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Sex</label>
                <select value={consentPatientSex} onChange={e=>setConsentPatientSex(e.target.value)} style={{...T.inp,width:"100%",padding:"8px 10px",fontSize:".88rem"}}>
                  <option value="">—</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}} className="consent-grid">
              <div>
                <label style={{display:"block",fontSize:".7rem",color:T.mute,fontWeight:600,marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Mobile number</label>
                <input value={consentPatientMobile} onChange={e=>setConsentPatientMobile(e.target.value)} placeholder="e.g. +91 98765 43210" style={{...T.inp,width:"100%",padding:"8px 10px",fontSize:".88rem"}}/>
              </div>
              <div>
                <label style={{display:"block",fontSize:".7rem",color:T.mute,fontWeight:600,marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Patient ID (optional)</label>
                <input value={consentPatientId} onChange={e=>setConsentPatientId(e.target.value)} placeholder="e.g. SC-2026-0123" style={{...T.inp,width:"100%",padding:"8px 10px",fontSize:".88rem"}}/>
              </div>
            </div>

            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:".7rem",color:T.mute,fontWeight:600,marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Patient's specific concern / expected outcome <span style={{textTransform:"none",letterSpacing:0,fontWeight:400,color:T.mute}}>(optional)</span></label>
              <textarea value={consentPatientConcern} onChange={e=>setConsentPatientConcern(e.target.value)} rows={3} placeholder="e.g. Patient wants subtle softening of glabellar lines, prefers natural look, does not desire complete freeze. Has noticed asymmetry — wants left side addressed." style={{...T.inp,width:"100%",padding:"8px 10px",fontSize:".84rem",fontFamily:"inherit",lineHeight:1.5,resize:"vertical",boxSizing:"border-box"}}/>
              <div style={{fontSize:".7rem",color:T.mute,marginTop:4,lineHeight:1.5}}>If filled, this text appears verbatim as a dedicated section in the consent form (helps document patient intent and scope). Leave blank for a generic template.</div>
            </div>

            <h3 style={{fontSize:"1rem",fontWeight:700,marginBottom:6,marginTop:6}}>3. Language</h3>
            <p style={{fontSize:".74rem",color:T.txt2,marginBottom:8,lineHeight:1.5}}>
              Choose the language the patient is most comfortable with. Non-English versions are auto-generated alongside an English copy. Medical, procedure, and legal terms are kept in English to preserve clinical accuracy.
            </p>
            <select value={consentLanguage} onChange={e=>setConsentLanguage(e.target.value)} style={{...T.inp,width:"100%",padding:"9px 12px",marginBottom:14}}>
              {CONSENT_LANGUAGES.map(l=><option key={l.code} value={l.code}>{l.label} {l.code!=="en"&&`(${l.nativeLabel})`}</option>)}
            </select>

            <h3 style={{fontSize:"1rem",fontWeight:700,marginBottom:14,marginTop:6}}>4. Clinic information</h3>

            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:".74rem",color:T.mute,fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Clinic name *</label>
              <input value={consentClinicName} onChange={e=>setConsentClinicName(e.target.value)} placeholder="e.g. Sunshine Aesthetic Clinic" style={{...T.inp,width:"100%",padding:"9px 12px"}}/>
            </div>

            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:".74rem",color:T.mute,fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Clinic address</label>
              <input value={consentClinicAddress} onChange={e=>setConsentClinicAddress(e.target.value)} placeholder="e.g. 12 MG Road, Pune 411001" style={{...T.inp,width:"100%",padding:"9px 12px"}}/>
            </div>

            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:".74rem",color:T.mute,fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Clinic phone (optional)</label>
              <input value={consentClinicPhone} onChange={e=>setConsentClinicPhone(e.target.value)} placeholder="e.g. +91 98765 43210" style={{...T.inp,width:"100%",padding:"9px 12px"}}/>
            </div>

            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:".74rem",color:T.mute,fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Clinic logo (optional, PNG/JPG)</label>
              <input type="file" accept="image/png,image/jpeg" onChange={e=>{
                const f=e.target.files?.[0];
                if(!f){setConsentClinicLogo("");return}
                if(f.size>500000){sh("Logo too large — please use an image under 500 KB");return}
                const r=new FileReader();
                r.onload=()=>setConsentClinicLogo(r.result);
                r.readAsDataURL(f);
              }} style={{fontSize:".84rem"}}/>
              {consentClinicLogo&&<div style={{marginTop:8}}>
                <img src={consentClinicLogo} alt="Logo preview" style={{maxHeight:60,maxWidth:160,border:"1px solid "+T.border,borderRadius:4,padding:4}}/>
                <button onClick={()=>setConsentClinicLogo("")} style={{...T.btnO,...T.btnSm,marginLeft:10}}>Remove logo</button>
              </div>}
            </div>

            {/* Letterhead toggle — when printing on pre-printed letterhead, skip header */}
            <div style={{marginBottom:14,padding:"10px 14px",background:T.bg,borderRadius:8,border:"1px solid "+T.border}}>
              <label style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer"}}>
                <input type="checkbox" checked={consentUseLetterhead} onChange={e=>setConsentUseLetterhead(e.target.checked)} style={{marginTop:3,flexShrink:0}}/>
                <div>
                  <div style={{fontSize:".84rem",fontWeight:600,color:T.txt}}>Print on my clinic letterhead</div>
                  <div style={{fontSize:".72rem",color:T.txt2,marginTop:3,lineHeight:1.55}}>
                    Tick this if your clinic uses pre-printed letterhead paper. The document will leave a blank area at the top (~6 cm) and skip the auto-generated clinic header, so your letterhead has room to show through.
                  </div>
                </div>
              </label>
            </div>

            <h3 style={{fontSize:"1rem",fontWeight:700,marginBottom:14,marginTop:6}}>5. Treating doctor</h3>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}} className="consent-grid">
              <div>
                <label style={{display:"block",fontSize:".74rem",color:T.mute,fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Doctor name *</label>
                <input value={consentDoctorName} onChange={e=>setConsentDoctorName(e.target.value)} placeholder="e.g. Dhananjay Patil" style={{...T.inp,width:"100%",padding:"9px 12px"}}/>
              </div>
              <div>
                <label style={{display:"block",fontSize:".74rem",color:T.mute,fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Registration number</label>
                <input value={consentDoctorReg} onChange={e=>setConsentDoctorReg(e.target.value)} placeholder="e.g. MMC-12345" style={{...T.inp,width:"100%",padding:"9px 12px"}}/>
              </div>
            </div>

            <button onClick={()=>{
              // Save clinic/doctor info to user profile for next time
              fbSet("users",au.uid,{
                clinicName:consentClinicName,
                clinicAddress:consentClinicAddress,
                clinicPhone:consentClinicPhone,
                doctorName:consentDoctorName,
                doctorRegNumber:consentDoctorReg,
              }).catch(()=>{});
              generateConsent();
            }} disabled={consentGenerating||(dailyExhausted&&credits<=0)} style={{
              ...T.btn,
              width:"100%",
              padding:"13px 24px",
              fontSize:".95rem",
              fontWeight:600,
              marginTop:8,
              opacity:(consentGenerating||(dailyExhausted&&credits<=0))?.55:1,
              cursor:(consentGenerating||(dailyExhausted&&credits<=0))?"not-allowed":"pointer",
            }}>
              {consentGenerating?"⏳ Generating...":dailyExhausted&&credits<=0?"Daily limit reached":"📄 Generate & Preview"}
            </button>

            <div style={{fontSize:".7rem",color:T.mute,marginTop:10,lineHeight:1.5}}>
              You'll see a preview before downloading. From the preview you can save as <b>Word (.doc)</b> or <b>PDF</b> (via your browser's print dialog).
              {credits>0&&" Bonus credits will only be used after your daily free generation."}
            </div>
          </div>

          {/* ═══ MY CONSENT HISTORY ═══
              Shows metadata only — no patient names, mobiles, or concern text are
              persisted to Firestore. Doctor uses this for audit/recall purposes
              ("did I generate one for procedure X recently?"). Patient-specific
              records should be kept by the clinic itself, not on SKINARIO. */}
          <div style={{...T.card,padding:18,marginTop:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
              <h3 style={{fontSize:"1rem",fontWeight:700,margin:0}}>📜 My consent history</h3>
              <span style={{fontSize:".68rem",color:T.mute}}>{consentHistory.length} {consentHistory.length===1?"generation":"generations"}</span>
            </div>
            <div style={{fontSize:".72rem",color:T.txt2,marginBottom:12,lineHeight:1.5,padding:"8px 10px",background:T.tealBg+"33",borderRadius:6,borderLeft:"3px solid "+T.teal}}>
              🔐 <b>Privacy note:</b> Only metadata is saved (procedure, date, language, your clinic name). Patient names, mobiles, and specific concerns are NEVER stored on SKINARIO — they exist only in the document you downloaded.
            </div>
            {consentHistory.length===0?
              <div style={{padding:"20px 12px",textAlign:"center",color:T.mute,fontSize:".82rem"}}>No consent forms generated yet. Your history will appear here.</div>
            :
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {consentHistory.slice(0,20).map(h=>{
                  const ts=h.createdAt?new Date(h.createdAt):null;
                  const tsLabel=ts?ts.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"2-digit",hour:"2-digit",minute:"2-digit",hour12:true}):"";
                  const langLabel=CONSENT_LANGUAGES.find(l=>l.code===h.language)?.label||"English";
                  return(<div key={h.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"#fafafa",borderRadius:6,border:"1px solid "+T.border,fontSize:".82rem",gap:10,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,color:T.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.procedure||"(unknown)"}</div>
                      <div style={{fontSize:".7rem",color:T.mute,marginTop:2}}>
                        {tsLabel} · {langLabel}{h.usedCredit?" · 💳 credit used":""}{h.isCustomProcedure?" · custom":""}
                      </div>
                    </div>
                  </div>);
                })}
                {consentHistory.length>20&&<div style={{fontSize:".7rem",color:T.mute,textAlign:"center",marginTop:6}}>Showing 20 most recent of {consentHistory.length}</div>}
              </div>
            }
          </div>

          <style>{`@media(max-width:540px){.consent-grid{grid-template-columns:1fr !important}}`}</style>
        </div>);
      })()}

      <div style={{textAlign:"center",padding:"22px 0",borderTop:"1px solid "+T.border,marginTop:20}}>
        <Logo size={28}/><div style={{fontSize:".65rem",color:T.light,letterSpacing:2,textTransform:"uppercase",marginTop:6}}>SKINARIO · <span style={{color:T.gold,fontWeight:600}}>{BRAND.sub}</span></div>
      </div>

      {/* SAFETY FALLBACK — if pg is somehow an unknown value, show this instead of blank */}
      {!KNOWN_PAGES.includes(pg)&&<div style={{maxWidth:520,margin:"40px auto",padding:"30px 24px",textAlign:"center",background:"#fff",borderRadius:14,border:"1px solid "+T.border}}>
        <div style={{fontSize:"2.4rem",marginBottom:10}}>🤔</div>
        <h3 style={{fontSize:"1.1rem",fontWeight:700,marginBottom:6}}>Lost your way?</h3>
        <p style={{color:T.txt2,fontSize:".88rem",lineHeight:1.6,marginBottom:18}}>The page you were on is no longer available. Let's get you back home.</p>
        <button onClick={()=>go("home")} style={{...T.btn,padding:"9px 20px",fontSize:".85rem"}}>← Go to home</button>
      </div>}

      </div>
      {toast&&<div style={{position:"fixed",bottom:22,left:"50%",transform:"translateX(-50%)",padding:"11px 28px",background:T.teal,color:"#fff",borderRadius:12,fontSize:".9rem",zIndex:1000,boxShadow:"0 4px 20px rgba(13,107,110,.25)"}}>{toast}</div>}
      {igPost&&<IGPostGenerator item={igPost.item} type={igPost.type} onClose={()=>setIgPost(null)} onQuizImageCached={async(quizId,b64)=>{
        try{
          // Convert base64 to Blob, upload to Storage, save URL on quiz doc.
          // Storing the raw base64 on Firestore would risk hitting the 1MB doc limit.
          const binary=atob(b64);
          const len=binary.length;
          const bytes=new Uint8Array(len);
          for(let i=0;i<len;i++)bytes[i]=binary.charCodeAt(i);
          const blob=new Blob([bytes],{type:"image/png"});
          const path=`quiz-ig-images/${quizId}.png`;
          const sRef=ref(storage,path);
          await uploadBytes(sRef,blob);
          const url=await getDownloadURL(sRef);
          await fbSet("quizzes",quizId,{igImageUrl:url});
          setQuizzes(prev=>prev.map(q=>q.id===quizId?{...q,igImageUrl:url}:q));
        }catch(err){console.error("cache quiz image failed:",err)}
      }}/>}

      {/* ═══ CONSENT PREVIEW MODAL ═══ */}
      {consentPreview && (() => {
        const isVern = consentPreview.langCode !== "en";
        const langLabel = CONSENT_LANGUAGES.find(l => l.code === consentPreview.langCode)?.label || "English";
        // Use the iframe srcdoc trick to render the HTML safely
        const downloadAs = (html, kind, suffix) => {
          const filename = `consent_${consentPreview.procName.replace(/[^a-z0-9]+/gi,"_").toLowerCase().slice(0,40)}_${suffix}_${todayIST_YMD()}.doc`;
          const blob = new Blob(["\ufeff", html], { type: "application/msword" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        };
        const printAsPdf = (html) => {
          // Open new window with HTML and trigger print dialog (user can Save as PDF)
          const w = window.open("", "_blank");
          if (!w) { sh("Pop-up blocked — please allow pop-ups for this site"); return; }
          w.document.open();
          w.document.write(html);
          w.document.close();
          // Give it a moment to render before printing
          setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 400);
        };
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center", padding:18 }} onClick={() => setConsentPreview(null)}>
            <div style={{ background:"#fff", borderRadius:14, maxWidth:1100, width:"100%", height:"90vh", display:"flex", flexDirection:"column", overflow:"hidden" }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", borderBottom:"1px solid "+T.border, gap:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                  <h3 style={{ fontSize:"1.05rem", fontWeight:700, margin:0 }}>📋 Preview & Download</h3>
                  <span style={{ fontSize:".74rem", color:T.mute }}>{consentPreview.procName}</span>
                </div>
                <button onClick={() => setConsentPreview(null)} style={{ background:"none", border:"none", fontSize:"1.4rem", cursor:"pointer", color:"#999", padding:"4px 8px" }}>✕</button>
              </div>

              {/* Body — two-pane if vernacular, single-pane if English-only */}
              <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>
                {isVern && (
                  <div style={{ flex:1, display:"flex", flexDirection:"column", borderRight:"1px solid "+T.border, minWidth:0 }}>
                    <div style={{ padding:"10px 14px", background:"#fff8e1", borderBottom:"1px solid "+T.border, fontSize:".82rem", fontWeight:600, color:"#856404", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                      <span>🌐 {langLabel} version</span>
                      <span style={{ display:"flex", gap:6 }}>
                        <button onClick={() => downloadAs(consentPreview.vernacularHtmlDownload, "word", langLabel.toLowerCase())} style={{ ...T.btnO, padding:"5px 12px", fontSize:".74rem" }}>⬇️ Word</button>
                        <button onClick={() => printAsPdf(consentPreview.vernacularHtmlDownload)} style={{ ...T.btn, padding:"5px 12px", fontSize:".74rem" }}>🖨 PDF</button>
                      </span>
                    </div>
                    <iframe title="Vernacular preview" srcDoc={consentPreview.vernacularHtml} style={{ flex:1, border:"none", width:"100%", background:"#fff" }}/>
                  </div>
                )}
                <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
                  <div style={{ padding:"10px 14px", background:T.tealBg+"66", borderBottom:"1px solid "+T.border, fontSize:".82rem", fontWeight:600, color:T.teal, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                    <span>📄 English version {isVern && <span style={{ fontWeight:400, color:T.mute, fontSize:".74rem" }}> · legally binding original</span>}</span>
                    <span style={{ display:"flex", gap:6 }}>
                      <button onClick={() => downloadAs(consentPreview.englishHtmlDownload, "word", "english")} style={{ ...T.btnO, padding:"5px 12px", fontSize:".74rem" }}>⬇️ Word</button>
                      <button onClick={() => printAsPdf(consentPreview.englishHtmlDownload)} style={{ ...T.btn, padding:"5px 12px", fontSize:".74rem" }}>🖨 PDF</button>
                    </span>
                  </div>
                  <iframe title="English preview" srcDoc={consentPreview.englishHtml} style={{ flex:1, border:"none", width:"100%", background:"#fff" }}/>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding:"10px 18px", borderTop:"1px solid "+T.border, background:"#faf9f5", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                <div style={{ fontSize:".72rem", color:T.txt2, lineHeight:1.5 }}>
                  <b>📥 Downloaded copy is clean</b> — the red warnings above appear in this preview only. The Word/PDF file the patient sees has NO red disclaimers, just a small neutral footer line.
                  {isVern && <> Both language versions can be printed for the patient's records.</>}
                </div>
                <button onClick={() => setConsentPreview(null)} style={{ ...T.btn, padding:"7px 16px", fontSize:".82rem" }}>Done</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>);
}
