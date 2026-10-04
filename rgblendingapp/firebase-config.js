import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, onSnapshot, addDoc, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, getDocs, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDnlad9nhop6okzaTGiwpWUaVnmKSJYtQI",
    authDomain: "rgblending1124.firebaseapp.com",
    projectId: "rgblending1124",
    storageBucket: "rgblending1124.firebasestorage.app",
    messagingSenderId: "273189271408",
    appId: "1:273189271408:web:48a0f1d078d1f4c93d01b5",
    measurementId: "G-FXJ83ZDM5H"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

window.db = db;
window.auth = auth;
window.storage = storage;

window.firestoreTools = { collection, onSnapshot, addDoc, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, getDocs, orderBy, serverTimestamp };

window.authTools = { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendEmailVerification,
    sendPasswordResetEmail
};

window.storageTools = { ref, uploadBytes, getDownloadURL };

console.log("Firebase initialized successfully for rgblending1124.");
