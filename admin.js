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

// --- CLOUDINARY CONFIG ---
const cloudName = "wotthrqc";
const uploadPreset = "myprofile";

// UPLOAD FUNCTION - FORCE CONVERT TO JPG
async function uploadToCloudinary(file) {
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", "travelandz");
    formData.append("format", "jpg"); // ITO ANG SUSI: Force convert to JPG

    try {
        const response = await fetch(url, {
            method: "POST",
            body: formData
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error.message || "Upload failed");
        }

        console.log("Upload Success:", data.secure_url);
        return data.secure_url; // Dapat.jpg na yung dulo nito
    } catch (error) {
        console.error("Cloudinary upload error:", error);
        throw error;
    }
}

// FORM SUBMIT
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('travelForm');
    if(form){
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = document.getElementById('mediaInput').files[0];
            const title = document.getElementById('title').value;
            const description = document.getElementById('description').value;
            const countryTag = document.getElementById('countryTag').value;

            if (!file) return alert("Please select a file");
            if (!title) return alert("Please enter a title");

            try {
                alert("Uploading...");
                const mediaUrl = await uploadToCloudinary(file);

                // Save to Firestore
                await db.collection("travels").add({
                    title: title,
                    description: description,
                    countryTag: countryTag,
                    mediaUrl: mediaUrl,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                alert("Upload Success!");
                form.reset();
                location.reload();
            } catch (err) {
                alert("Upload Failed: " + err.message);
            }
        });
    }
});
