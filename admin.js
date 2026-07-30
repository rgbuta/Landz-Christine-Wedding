// --- FIREBASE CONFIGURATION ---
// REPLACE THESE WITH YOUR ACTUAL KEYS FROM FIREBASE CONSOLE
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const auth = firebase.auth();

// --- CLOUDINARY CONFIGURATION ---
// Replace these with your details from your Cloudinary Dashboard
const CLOUDINARY_UPLOAD_PRESET = "myprofile";
const CLOUDINARY_CLOUD_NAME = "wotthrqc";

// DOM Elements
const loginSection = document.getElementById('login-section');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const travelForm = document.getElementById('travel-form');
const adminTravelsList = document.getElementById('admin-travels-list');
const cancelEditBtn = document.getElementById('cancel-edit');
const formTitle = document.getElementById('form-title');

// Auth State Observer
auth.onAuthStateChanged(user => {
    if (user) {
        loginSection.style.display = 'none';
        adminPanel.style.display = 'block';
        logoutBtn.style.display = 'block';
        fetchAdminTravels();
    } else {
        loginSection.style.display = 'block';
        adminPanel.style.display = 'none';
        logoutBtn.style.display = 'none';
    }
});

// Login Handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        alert("Login Failed: " + error.message);
    }
});

// Logout Handler
logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    auth.signOut();
});

// Cloudinary Upload Function
async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const statusEl = document.getElementById('upload-status');
    statusEl.innerText = "Uploading media to Cloudinary...";

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.secure_url) {
            statusEl.innerText = "Upload successful!";
            return data.secure_url;
        } else {
            throw new Error(data.error?.message || "Upload failed.");
        }
    } catch (error) {
        alert("Cloudinary Error: " + error.message);
        statusEl.innerText = "";
        return null;
    }
}

// Handle Form Submit (Add or Edit)
travelForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const travelId = document.getElementById('travel-id').value;
    const countryTag = document.getElementById('country-tag').value;
    const title = document.getElementById('travel-title').value;
    const description = document.getElementById('travel-desc').value;
    const mediaFileInput = document.getElementById('media-file');
    
    let mediaUrl = document.getElementById('media-url').value;

    if (mediaFileInput.files.length > 0) {
        const uploadedUrl = await uploadToCloudinary(mediaFileInput.files[0]);
        if (uploadedUrl) {
            mediaUrl = uploadedUrl;
        } else {
            return;
        }
    }

    if (!travelId && !mediaUrl) {
        alert("Please select an image or video file.");
        return;
    }

    const travelData = {
        countryTag,
        title,
        description,
        mediaUrl: mediaUrl || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (travelId) {
            // Update
            await db.collection('travels').doc(travelId).update(travelData);
            alert("Travel post updated successfully!");
        } else {
            // Create
            await db.collection('travels').add(travelData);
            alert("Travel post added successfully!");
        }
        resetForm();
        fetchAdminTravels();
    } catch (error) {
        alert("Error saving data: " + error.message);
    }
});

// Fetch Travels for Admin Panel Listing
async function fetchAdminTravels() {
    adminTravelsList.innerHTML = '<p>Loading items...</p>';
    try {
        const snapshot = await db.collection('travels').orderBy('createdAt', 'desc').get();
        adminTravelsList.innerHTML = '';

        if (snapshot.empty) {
            adminTravelsList.innerHTML = '<p>No travel entries found.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const row = document.createElement('div');
            row.className = 'travel-item-row';
            row.innerHTML = `
                <div>
                    <strong>${data.title}</strong> (${data.countryTag})
                </div>
                <div class="action-btns">
                    <button class="btn-edit" onclick="editTravel('${doc.id}', '${data.countryTag}', '${data.title}', '${data.description}', '${data.mediaUrl}')">Edit</button>
                    <button class="btn-delete" onclick="deleteTravel('${doc.id}')">Delete</button>
                </div>
            `;
            adminTravelsList.appendChild(row);
        });
    } catch (error) {
        console.error(error);
        adminTravelsList.innerHTML = '<p>Error loading posts.</p>';
    }
}

// Edit Travel Pre-fill
window.editTravel = function(id, countryTag, title, description, mediaUrl) {
    document.getElementById('travel-id').value = id;
    document.getElementById('country-tag').value = countryTag;
    document.getElementById('travel-title').value = title;
    document.getElementById('travel-desc').value = description;
    document.getElementById('media-url').value = mediaUrl;
    
    formTitle.innerText = "Edit Travel Post";
    document.getElementById('save-btn').innerText = "Update Post";
    cancelEditBtn.style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Delete Travel
window.deleteTravel = async function(id) {
    if (confirm("Are you sure you want to delete this travel item?")) {
        try {
            await db.collection('travels').doc(id).delete();
            alert("Deleted successfully!");
            fetchAdminTravels();
        } catch (error) {
            alert("Error deleting: " + error.message);
        }
    }
};

// Cancel Edit Mode
cancelEditBtn.addEventListener('click', resetForm);

function resetForm() {
    travelForm.reset();
    document.getElementById('travel-id').value = "";
    document.getElementById('media-url').value = "";
    document.getElementById('upload-status').innerText = "";
    formTitle.innerText = "Add New Travel Post";
    document.getElementById('save-btn').innerText = "Save Travel Post";
    cancelEditBtn.style.display = "none";
}