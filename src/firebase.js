// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBFaxZyhRvucfaZACl68SdNFb_CKPlkZBU",
  authDomain: "cosmexxtra-1b08e.firebaseapp.com",
  projectId: "cosmexxtra-1b08e",
  storageBucket: "cosmexxtra-1b08e.firebasestorage.app",
  messagingSenderId: "419443766419",
  appId: "1:419443766419:web:5ca9336401284094060966",
  measurementId: "G-VFV64K558B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);