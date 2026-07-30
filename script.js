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

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// DOM Elements
const travelsGrid = document.getElementById('travels-grid');
const mobileMenu = document.getElementById('mobile-menu');
const navLinks = document.getElementById('nav-links');

// Mobile Menu Toggle
if (mobileMenu && navLinks) {
    mobileMenu.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });
}

// Helper para i-force convert sa jpg si cloudinary
function getDisplayUrl(url) {
    if(!url) return '';
    // Kung.heic o ibang format, add natin.jpg sa dulo
    // Para auto convert ni cloudinary
    return url + '.jpg';
}

// Fetch and Display Travel Posts from Firestore
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

            const isVideo = data.mediaUrl && (
                data.mediaUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) ||
                data.mediaUrl.includes('/video/upload/')
            );

            let mediaHTML = '';
            if (data.mediaUrl) {
                if (isVideo) {
                    mediaHTML = `
                        <video controls style="width: 100%; height: 100%; object-fit: cover;">
                            <source src="${escapeHtml(data.mediaUrl)}" type="video/mp4">
                        </video>
                    `;
                } else {
                    // DITO YUNG BINAGO: ginamit natin getDisplayUrl
                    mediaHTML = `
                        <img src="${escapeHtml(getDisplayUrl(data.mediaUrl))}" alt="${escapeHtml(data.title || '')}" loading="lazy">
                    `;
                }
            }

            card.innerHTML = `
                <div class="gallery-img-wrapper">
                    ${data.countryTag? `<span class="country-tag">${escapeHtml(data.countryTag)}</span>` : ''}
                    ${mediaHTML}
                </div>
                <div class="gallery-content">
                    <h3>${escapeHtml(data.title || 'Untitled')}</h3>
                    <p>${escapeHtml(data.description || '')}</p>
                </div>
            `;

            travelsGrid.appendChild(card);
        });

    } catch (error) {
        console.error("Firestore Error:", error);
        travelsGrid.innerHTML = `<p style="color: #ef4444; text-align: center; grid-column: 1/-1;">Failed to load travel posts: ${escapeHtml(error.message)}</p>`;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
        return {'&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#039;'}[m];
    });
}

document.addEventListener('DOMContentLoaded', loadTravelPosts);
