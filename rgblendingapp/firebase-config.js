import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    onSnapshot, 
    addDoc, 
    doc, 
    setDoc,
    getDoc,
    updateDoc, 
    deleteDoc, 
    query, 
    where,
    getDocs,
    orderBy,          // DAGDAG TO
    serverTimestamp   // DAGDAG TO
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// DAGDAG: FIREBASE STORAGE
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Your Firebase Config Credentials
const firebaseConfig = {
    apiKey: "AIzaSyDnlad9nhop6okzaTGiwpWUaVnmKSJYtQI",
    authDomain: "rgblending1124.firebaseapp.com",
    projectId: "rgblending1124",
    storageBucket: "rgblending1124.firebasestorage.app",
    messagingSenderId: "273189271408",
    appId: "1:273189271408:web:48a0f1d078d1f4c93d01b5",
    measurementId: "G-FXJ83ZDM5H"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app); // INIT STORAGE

// Make instances globally available
window.db = db;
window.auth = auth;
window.storage = storage; // EXPOSE STORAGE

// Expose Firestore Tools
window.firestoreTools = { 
    collection, 
    onSnapshot, 
    addDoc, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where,
    getDocs,
    orderBy,         // DAGDAG TO
    serverTimestamp  // DAGDAG TO
};

// Expose Auth Tools
window.authTools = { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
};

// Expose Storage Tools
window.storageTools = {
    ref,
    uploadBytes,
    getDownloadURL
};

console.log("Firebase initialized successfully for rgblending1124.");