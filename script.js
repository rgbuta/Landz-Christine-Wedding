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

// ITO YUNG SUSI: I-force natin si Cloudinary mag convert
function getDisplayUrl(url) {
    if(!url) return '';
    // f_auto = auto format. q_auto = auto quality
    // Ginagawa niyang.jpg or.webp depende sa browser mo
    return url.replace('/upload/', '/upload/f_auto,q_auto/');
}

async function loadTravelPosts() {
    if (!travelsGrid) return;
    travelsGrid.innerHTML = '<p style="color: #94a3b8; text-align: center; grid-column: 1/-1;">Loading travel posts...</p>';

    try {
        const snapshot = await db.collection('travels').orderBy('createdAt', 'desc').get();
        if (snapshot.empty) {
            travelsGrid.innerHTML = '<p style="color: #94a3b8; text-align: center; grid-column: 1/-1;">No travel posts found.</p>';
            return;
        }
        travelsGrid.innerHTML = '';

        snapshot.forEach(doc => {
            const data = doc.data();
            const card = document.createElement('div');
            card.className = 'gallery-card';
            
            const finalUrl = getDisplayUrl(data.mediaUrl);
            console.log("Final Image URL:", finalUrl); // Check mo sa F12

            let mediaHTML = '';
            if (data.mediaUrl) {
                mediaHTML = `<img src="${finalUrl}" alt="${data.title || ''}" loading="lazy">`;
            }

            card.innerHTML = `
                <div class="gallery-img-wrapper">
                    ${data.countryTag? `<span class="country-tag">${data.countryTag}</span>` : ''}
                    ${mediaHTML}
                </div>
                <div class="gallery-content">
                    <h3>${data.title || 'Untitled'}</h3>
                    <p>${data.description || ''}</p>
                </div>
            `;
            travelsGrid.appendChild(card);
        });

    } catch (error) {
        console.error("Firestore Error:", error);
    }
}
document.addEventListener('DOMContentLoaded', loadTravelPosts);
