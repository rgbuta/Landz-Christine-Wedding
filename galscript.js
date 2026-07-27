// ========== 1. KEYS MO ==========
const firebaseConfig = {
  apiKey: "AIzaSyBi1K0V0xEduzsUVG6Tv9NhB25lgd52-KI",
  authDomain: "weddingevent1108.firebaseapp.com",
  projectId: "weddingevent1108",
  storageBucket: "weddingevent1108.firebasestorage.app",
  messagingSenderId: "626358670526",
  appId: "1:626358670526:web:d7d75e9cc47d0d991fbaef",
  measurementId: "G-347CH8QPYS"
};
const CLOUDINARY_CLOUD_NAME = "wotthrqc";
const CLOUDINARY_UPLOAD_PRESET = "weddingevent";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const postsCollection = collection(db, "wedding_posts");

// ========== 2. GLOBAL VARIABLES ==========
let currentGuestName = "";
let selectedFilesData = [];
let currentLightboxItems = [];
let currentLightboxIndex = 0;
let currentLightboxUploader = "";
let activePostElementForComment = null;
let isAdminMode = false;

window.onload = function() {
    const storedName = sessionStorage.getItem("weddingGuestName");
    if (storedName) {
        currentGuestName = storedName;
        document.getElementById("nameModal").classList.add("hidden");
        if (storedName === "Admin") activateAdminMode(); else deactivateAdminMode();
    } else {
        document.getElementById("nameModal").classList.remove("hidden");
    }
    loadPostsFromFirebase();
    setupEventListeners(); // ADD NATIN TO
};

function saveGuestName() {
    const input = document.getElementById("guestNameInput").value.trim();
    if (input === "") { alert("Please enter your name to continue!"); return; }
    currentGuestName = input;
    sessionStorage.setItem("weddingGuestName", currentGuestName);
    document.getElementById("nameModal").classList.add("hidden");
    deactivateAdminMode();
}

function promptAdminLoginFromModal() {
    let password = prompt("Enter admin passcode:");
    if (password === "weddingadmin2026") {
        currentGuestName = "Admin";
        sessionStorage.setItem("weddingGuestName", "Admin");
        document.getElementById("nameModal").classList.add("hidden");
        activateAdminMode();
        alert("Logged in as Admin successfully!");
    } else if (password!== null) alert("Incorrect passcode!");
}

function activateAdminMode() { isAdminMode = true; document.querySelectorAll('.post').forEach(post => post.classList.add("admin-mode-active")); }
function deactivateAdminMode() { isAdminMode = false; document.querySelectorAll('.post').forEach(post => post.classList.remove("admin-mode-active")); }

function triggerPhotoGallery() { document.getElementById("hiddenPhotoInput").click(); }
function triggerVideoGallery() { document.getElementById("hiddenVideoInput").click(); }

function handlePhotoSelection(event) {
    const files = event.target.files;
    if (files.length === 0) return;
    selectedFilesData = Array.from(files);
    const previewContainer = document.getElementById("thumbnailPreviewContainer");
    previewContainer.innerHTML = "";
    document.getElementById("selectedFilesCount").innerText = `Ready to upload (${files.length} photo${files.length > 1? 's' : ''})`;
    document.getElementById("pendingUploadCard").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: 'smooth' });
    selectedFilesData.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const thumb = document.createElement("img");
            thumb.src = e.target.result; thumb.className = "preview-thumb";
            previewContainer.appendChild(thumb);
        };
        reader.readAsDataURL(file);
    });
}

function handleVideoSelection(event) {
    const files = event.target.files;
    if (files.length === 0) return;
    selectedFilesData = Array.from(files);
    const previewContainer = document.getElementById("thumbnailPreviewContainer");
    previewContainer.innerHTML = "";
    document.getElementById("selectedFilesCount").innerText = `Ready to upload (1 video)`;
    document.getElementById("pendingUploadCard").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const reader = new FileReader();
    reader.onload = e => {
        const thumb = document.createElement("video");
        thumb.src = e.target.result; thumb.className = "preview-thumb-video";
        previewContainer.appendChild(thumb);
    };
    reader.readAsDataURL(files[0]);
}

function cancelUpload() {
    document.getElementById("pendingUploadCard").classList.add("hidden");
    document.getElementById("hiddenPhotoInput").value = "";
    document.getElementById("hiddenVideoInput").value = "";
    document.getElementById("mediaCaption").value = "";
    selectedFilesData = [];
}

async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', 'landz-wedding'); 
    
    document.getElementById("selectedFilesCount").innerText = `Uploading to Cloudinary...`;

    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, { 
            method: 'POST', 
            body: formData 
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message || "Cloudinary Upload Failed");
        }
        
        const data = await res.json();
        return { url: data.secure_url, public_id: data.public_id, type: file.type.startsWith('video')? 'video' : 'image' };
        
    } catch (error) {
        console.error("Upload Failed:", error);
        alert("Upload failed! \n\nReason: " + error.message + "\n\nCheck your internet and if preset is UNSIGNED");
        throw error;
    }
}

async function publishPost() {
    const caption = document.getElementById("mediaCaption").value.trim();
    if (selectedFilesData.length === 0) return;
    document.getElementById("btnPost").innerText = "Uploading...";
    document.getElementById("btnPost").disabled = true;

    const uploadedMedia = [];
    for(let file of selectedFilesData) {
        const uploaded = await uploadToCloudinary(file);
        uploadedMedia.push(uploaded);
    }

    await addDoc(postsCollection, {
        author: currentGuestName, caption: caption, media: uploadedMedia,
        likes: 0, likedBy: [], comments: [], timestamp: serverTimestamp()
    });
    cancelUpload();
    document.getElementById("btnPost").innerText = "Post";
    document.getElementById("btnPost").disabled = false;
}

function loadPostsFromFirebase() {
    const q = query(postsCollection, orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        const feed = document.getElementById("feed");
        feed.innerHTML = "";
        snapshot.forEach(docSnap => renderPost(docSnap.id, docSnap.data()));
        if(isAdminMode) document.querySelectorAll('.post').forEach(p => p.classList.add("admin-mode-active"));
    });
}

function renderPost(id, data) {
    const feed = document.getElementById("feed");
    const totalFiles = data.media.length; const isVideoPost = data.media[0]?.type === 'video';
    let gridClass = "grid-1"; if (!isVideoPost) { if (totalFiles === 2) gridClass = "grid-2"; else if (totalFiles === 3) gridClass = "grid-3"; else if (totalFiles >= 4) gridClass = "grid-4"; }
    let mediaHtml = ""; data.media.forEach((item,i) => { if(item.type === 'video') mediaHtml += `<video src="${item.url}" class="post-media-item" controls data-index="${i}"></video>`; else mediaHtml += `<img src="${item.url}" class="post-media-item" data-index="${i}">`; });
    const time = data.timestamp? new Date(data.timestamp.seconds * 1000).toLocaleString('en-PH') : "Just now";
    const isLiked = data.likedBy.includes(currentGuestName);
    const postHTML = `<div class="post" data-id="${id}" data-author="${escapeHtml(data.author)}"><div class="post-header"><div class="post-meta"><div class="author-name">${escapeHtml(data.author)}</div><div class="timestamp">${time}</div></div></div>${data.caption? `<div class="post-caption">${escapeHtml(data.caption)}</div>` : ''}<div class="media-grid ${gridClass}">${mediaHtml}</div><div class="post-stats"><span class="stat-likes">${data.likes} likes</span><span class="stat-comments" style="cursor: pointer;">${data.comments.length} comments</span></div><div class="post-actions"><button class="action-btn like-btn ${isLiked? 'liked' : ''}" data-id="${id}"><span>${isLiked? '❤️' : '🤍'}</span> <span class="like-label">${isLiked? 'Liked' : 'Like'}</span></button><button class="action-btn comment-btn"><span>💬</span> Comment</button></div><div class="admin-controls"><button class="admin-btn delete-btn" data-id="${id}">🗑️ Delete</button></div></div>`;
    feed.insertAdjacentHTML('beforeend', postHTML);
}

async function toggleLike(postId) {
    const postRef = doc(db, "wedding_posts", postId);
    const postSnap = await getDoc(postRef); const data = postSnap.data();
    const liked = data.likedBy.includes(currentGuestName);
    await updateDoc(postRef, { likes: liked? data.likes - 1 : data.likes + 1, likedBy: liked? data.likedBy.filter(n => n!== currentGuestName) : [...data.likedBy, currentGuestName] });
}

function openCommentModal(postElement) { activePostElementForComment = postElement; document.getElementById("commentModal").classList.add("active"); renderComments(); }
function closeCommentModal() { document.getElementById("commentModal").classList.remove("active"); activePostElementForComment = null; }
function handleModalCommentKey(event) { if (event.key === 'Enter') submitModalComment(); }

function renderComments(){
    if(!activePostElementForComment) return;
    const postId = activePostElementForComment.getAttribute('data-id');
    getDoc(doc(db, "wedding_posts", postId)).then(snap => {
        const data = snap.data();
        const modalCommentList = document.getElementById("modalCommentList");
        modalCommentList.innerHTML = data.comments.length === 0? `<div class="no-comments-yet">No comments yet. Be the first to comment!</div>` : '';
        data.comments.forEach(c => {
            modalCommentList.insertAdjacentHTML('beforeend', `<div class="comment-item"><div class="fb-comment-bubble"><span class="fb-comment-author">${escapeHtml(c.author)}</span><span class="fb-comment-text">${escapeHtml(c.text)}</span></div></div>`);
        });
    });
}

async function submitModalComment() {
    if (!activePostElementForComment) return;
    const input = document.getElementById("modalCommentInput");
    const text = input.value.trim();
    if (text === "") return;
    const postId = activePostElementForComment.getAttribute('data-id');
    const postRef = doc(db, "wedding_posts", postId);
    const postSnap = await getDoc(postRef); const data = postSnap.data();
    await updateDoc(postRef, { comments: [...data.comments, {author: currentGuestName, text: text, time: new Date()}] });
    input.value = "";
    renderComments();
}

async function deletePost(postId) { if (!isAdminMode) return alert("Unauthorized"); if (confirm("Delete this post?")) await deleteDoc(doc(db, "wedding_posts", postId)); }

function openLightbox(postElement, index) {
    currentLightboxUploader = postElement.getAttribute('data-author');
    const mediaElements = postElement.querySelectorAll('.media-grid.post-media-item');
    currentLightboxItems = Array.from(mediaElements).map(el => ({ url: el.src, type: el.tagName.toLowerCase() }));
    currentLightboxIndex = index;
    updateLightboxView();
    document.getElementById("lightboxModal").classList.add("active");
}

function updateLightboxView() {
    const imgEl = document.getElementById("lightboxImage");
    const vidEl = document.getElementById("lightboxVideo");
    const currentItem = currentLightboxItems[currentLightboxIndex];
    if (currentItem.type === 'video') { imgEl.style.display = 'none'; vidEl.style.display = 'block'; vidEl.src = currentItem.url; }
    else { vidEl.pause(); vidEl.style.display = 'none'; imgEl.style.display = 'block'; imgEl.src = currentItem.url; }
    document.getElementById("lightboxName").innerText = currentLightboxUploader;
    document.getElementById("lightboxCounter").innerText = `${currentLightboxIndex + 1} of ${currentLightboxItems.length}`;
    const prevBtn = document.querySelector('.lightbox-prev'); const nextBtn = document.querySelector('.lightbox-next');
    if (currentLightboxItems.length <= 1) { prevBtn.style.display = 'none'; nextBtn.style.display = 'none'; } else { prevBtn.style.display = 'flex'; nextBtn.style.display = 'flex'; }
}

function changeLightboxSlide(direction) {
    const vidEl = document.getElementById("lightboxVideo"); vidEl.pause();
    currentLightboxIndex += direction;
    if (currentLightboxIndex < 0) { currentLightboxIndex = currentLightboxItems.length - 1; }
    else if (currentLightboxIndex >= currentLightboxItems.length) { currentLightboxIndex = 0; }
    updateLightboxView();
}

function closeLightbox() { document.getElementById("lightboxVideo").pause(); document.getElementById("lightboxModal").classList.remove("active"); }
function escapeHtml(text) { const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }; return text.replace(/[&<>"']/g, function(m) { return map[m]; }); }

// ========== 3. EVENT LISTENERS - DITO NA LAHAT ==========
function setupEventListeners(){
    document.getElementById('continueBtn').addEventListener('click', saveGuestName);
    document.getElementById('adminLoginBtn').addEventListener('click', promptAdminLoginFromModal);
    document.getElementById('guestNameInput').addEventListener('keypress', e => { if(e.key === 'Enter') saveGuestName(); });

    document.getElementById('photoBtn').addEventListener('click', triggerPhotoGallery);
    document.getElementById('videoBtn').addEventListener('click', triggerVideoGallery);
    document.getElementById('hiddenPhotoInput').addEventListener('change', handlePhotoSelection);
    document.getElementById('hiddenVideoInput').addEventListener('change', handleVideoSelection);
    document.getElementById('cancelBtn').addEventListener('click', cancelUpload);
    document.getElementById('btnPost').addEventListener('click', publishPost);

    document.getElementById('closeCommentBtn').addEventListener('click', closeCommentModal);
    document.getElementById('sendCommentBtn').addEventListener('click', submitModalComment);
    document.getElementById('modalCommentInput').addEventListener('keypress', handleModalCommentKey);

    document.getElementById('closeLightboxBtn').addEventListener('click', closeLightbox);
    document.getElementById('prevSlideBtn').addEventListener('click', () => changeLightboxSlide(-1));
    document.getElementById('nextSlideBtn').addEventListener('click', () => changeLightboxSlide(1));

    // Delegate for dynamic posts
    document.getElementById('feed').addEventListener('click', e => {
        const post = e.target.closest('.post');
        if(e.target.closest('.like-btn')) toggleLike(e.target.closest('.like-btn').dataset.id);
        if(e.target.closest('.comment-btn')) openCommentModal(post);
        if(e.target.closest('.delete-btn')) deletePost(e.target.closest('.delete-btn').dataset.id);
        if(e.target.closest('.stat-comments')) openCommentModal(post);
        if(e.target.classList.contains('post-media-item')) openLightbox(post, parseInt(e.target.dataset.index));
    });
}