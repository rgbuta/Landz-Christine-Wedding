// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCemGkC9X-qGXP85yfOHWAaA_U8I8svYu0",
  authDomain: "myprofile1124.firebaseapp.com",
  projectId: "myprofile1124",
  storageBucket: "myprofile1124.firebasestorage.app",
  messagingSenderId: "317629844028",
  appId: "1:317629844028:web:98eae3b815e89012e7d139",
  measurementId: "G-2KEP28KTLR"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

const travelsGrid = document.getElementById('travels-grid');

function getDisplayUrl(url) {
    if(!url) return '';
    return url.replace('/upload/', '/upload/f_auto,q_auto/');
}

async function loadTravelPosts() {
    if (!travelsGrid) return;
    travelsGrid.innerHTML = 'Loading...';

    try {
        const snapshot = await db.collection('travels').orderBy('createdAt', 'desc').get();
        travelsGrid.innerHTML = '';

        snapshot.forEach(doc => {
            const data = doc.data();
            const finalUrl = getDisplayUrl(data.mediaUrl);
            
            const card = document.createElement('div');
            card.style.cssText = 'border:1px solid red; margin:10px; padding:10px;'; // para makita natin yung box
            card.className = 'gallery-card';
            
            // IPAPAKITA NATIN YUNG URL PARA MA-TEST
            card.innerHTML = `
                <p style="font-size:10px; word-break:break-all;">URL: ${finalUrl}</p>
                <div class="gallery-img-wrapper">
                    ${data.countryTag? `<span class="country-tag">${data.countryTag}</span>` : ''}
                    <img src="${finalUrl}" alt="${data.title || ''}" style="width:100%; height:200px; object-fit:cover; border:2px solid blue;">
                </div>
                <div class="gallery-content">
                    <h3>${data.title || 'Untitled'}</h3>
                    <p>${data.description || ''}</p>
                </div>
            `;
            travelsGrid.appendChild(card);
        });

    } catch (error) {
        travelsGrid.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
}
document.addEventListener('DOMContentLoaded', loadTravelPosts);
