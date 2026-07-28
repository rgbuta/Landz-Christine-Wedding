function toggleMenu() { document.getElementById("navMenu").classList.toggle("active"); }
function closeMenu() { document.getElementById("navMenu").classList.remove("active"); }

// Background Music
window.addEventListener('DOMContentLoaded', () => {
  const bgMusic = document.getElementById('bgMusic');
  bgMusic.volume = 0.5;
  bgMusic.play().catch(() => {
    document.body.addEventListener('click', () => { bgMusic.play(); }, { once: true });
  });
  loadMessages(); 
  loadGuests();
  setupMobileInputFix(); // fix sa pag scroll pag nag input
});

function toggleMusic() {
  const bgMusic = document.getElementById('bgMusic');
  const btn = document.getElementById('musicToggle');
  if (bgMusic.paused) { bgMusic.play(); btn.innerText = "🔇"; }
  else { bgMusic.pause(); btn.innerText = "🎵"; }
}

// COUNTDOWN
const weddingDate = new Date("NOVEMBER 8, 2026 10:00:00").getTime();
setInterval(()=>{
  let now = new Date().getTime(); let d = weddingDate - now;
  if(d > 0){
    document.getElementById("days").innerText = String(Math.floor(d/(1000*60*60*24))).padStart(2,'0');
    document.getElementById("hours").innerText = String(Math.floor((d%(1000*60*60*24))/(1000*60*60))).padStart(2,'0');
    document.getElementById("mins").innerText = String(Math.floor((d%(1000*60*60))/(1000*60))).padStart(2,'0');
    document.getElementById("secs").innerText = String(Math.floor((d%(1000*60))/1000)).padStart(2,'0');
  } else {
    document.getElementById("days").innerText = "00";
    document.getElementById("hours").innerText = "00";
    document.getElementById("mins").innerText = "00";
    document.getElementById("secs").innerText = "00";
  }
},1000);

// CAROUSEL
let currentSlide = 0;
const carousel = document.getElementById('carousel');
const items = document.querySelectorAll('.carousel-item');
const dotsContainer = document.getElementById('dots');

items.forEach((_, i) => {
  const dot = document.createElement('div');
  dot.classList.add('dot');
  if(i === 0) dot.classList.add('active');
  dot.onclick = () => goToSlide(i);
  dotsContainer.appendChild(dot);
});

function updateCarousel() {
  carousel.style.transform = `translateX(-${currentSlide * 100}%)`;
  items.forEach((item, i) => { item.classList.remove('active'); if(i === currentSlide) item.classList.add('active'); });
  document.querySelectorAll('.dot').forEach((dot, i) => { dot.classList.remove('active'); if(i === currentSlide) dot.classList.add('active'); });
}
function moveSlide(direction) { currentSlide = (currentSlide + direction + items.length) % items.length; updateCarousel(); }
function goToSlide(n) { currentSlide = n; updateCarousel(); }
setInterval(() => { moveSlide(1); }, 4000);

// GOOGLE SHEETS
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgP8koJWeTY8HTfi7JubRgmH-NnSvwAa9WCjmrWvS3YfkvFWOsualveXbSMy-4bW164g/exec";

// MESSAGE FORM
document.getElementById('messageForm').addEventListener('submit', e => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  btn.innerText = "Sending...";
  
  fetch(SCRIPT_URL, { 
    method: 'POST', 
    mode: 'no-cors',
    body: JSON.stringify({ 
      type: "message", 
      name: document.getElementById('msgName').value, 
      message: document.getElementById('msgText').value 
    })
  }).then(() => { 
    document.getElementById('msgSuccess').style.display = 'block'; 
    document.getElementById('messageForm').reset(); 
    setTimeout(()=>document.getElementById('msgSuccess').style.display='none', 3000);
    setTimeout(loadMessages, 1000); // delay para makasave muna sa sheet
    btn.disabled = false;
    btn.innerText = "Send Message";
  }).catch(err => {
    console.log(err);
    btn.disabled = false;
    btn.innerText = "Send Message";
  });
});

// RSVP FORM - WITH RADIO BUTTONS
document.getElementById('rsvpForm').addEventListener('submit', e => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  const name = document.getElementById('rsvpName').value.trim();
  const attending = document.querySelector('input[name="attending"]:checked');
  const guests = document.getElementById('rsvpGuests').value;

  if(!name ||!attending ||!guests){
    document.getElementById('rsvpError').style.display = 'block';
    setTimeout(()=>document.getElementById('rsvpError').style.display='none', 3000);
    return;
  }

  btn.disabled = true;
  btn.innerText = "Submitting...";

  fetch(SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify({
      type: "rsvp",
      name: name,
      attending: attending.value,
      guests: guests
    })
  }).then(() => {
    document.getElementById('rsvpSuccess').style.display = 'block';
    document.getElementById('rsvpForm').reset();
    setTimeout(()=>document.getElementById('rsvpSuccess').style.display='none', 3000);
    setTimeout(loadGuests, 1000); // delay para makasave muna
    btn.disabled = false;
    btn.innerText = "SUBMIT RSVP";
  }).catch(err => {
    console.log(err);
    btn.disabled = false;
    btn.innerText = "SUBMIT RSVP";
  });
});

// LOAD MESSAGES
function loadMessages() {
  fetch(SCRIPT_URL + "?type=messages")
  .then(res => res.json())
  .then(data => {
    if(!data || data.length === 0) {
      document.getElementById('messageWall').innerHTML = "<p>No messages yet. Be the first!</p>";
      return;
    }
    let html = ""; 
    data.reverse().forEach(msg => { 
      html += `
        <div class="message-card">
          <p class="message-text">"${msg.message}"</p>
          <p class="message-name">- ${msg.name}</p>
          <p class="message-date">${new Date(msg.time).toLocaleDateString('en-PH', {month: 'short', day: 'numeric', year: 'numeric'})}</p>
        </div>
      `; 
    });
    document.getElementById('messageWall').innerHTML = html; 
  }).catch(err => {
    console.log("Error loading messages:", err);
    document.getElementById('messageWall').innerHTML = "<p>Error loading messages.</p>";
  });
}

// LOAD GUESTS + TOTAL COUNT
function loadGuests() {
  fetch(SCRIPT_URL + "?type=rsvp")
  .then(res => res.json())
  .then(data => {
    const attending = data.filter(g => g.attending === "Yes");
    let guestListDiv = document.getElementById('guestList');
    let totalGuests = 0;

    if(attending.length === 0) {
      guestListDiv.innerHTML = "<p>No RSVPs yet.</p>";
    } else {
      let html = ""; 
      attending.reverse().forEach(guest => { 
        let guestCount = parseInt(guest.guests) || 1;
        totalGuests += guestCount;
        html += `
          <div class="guest-card">
            <span class="guest-name">${guest.name}</span>
            <span class="guest-count">${guestCount} Guest${guestCount > 1 ? 's' : ''}</span>
          </div>
        `; 
      });
      guestListDiv.innerHTML = html; 
    }
    
    if(document.getElementById('totalGuestCount')){
      document.getElementById('totalGuestCount').innerText = totalGuests;
    }
    
  }).catch(err => {
    console.log("Error loading guests:", err);
    document.getElementById('guestList').innerHTML = "<p>Error loading guests.</p>";
  });
}

// FIX: PAG NAG INPUT SA RSVP DI NA BABALIK SA TAAS
function setupMobileInputFix() {
  const rsvpInputs = document.querySelectorAll('#rsvpForm input, #rsvpForm textarea');
  rsvpInputs.forEach(input => {
    input.addEventListener('focus', function() {
      setTimeout(() => {
        this.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300); // hintay lumabas keyboard muna
    });
  });
}
