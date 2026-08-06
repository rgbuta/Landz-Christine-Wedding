let allLoansData = [];
let currentFilter = 'Pending';
let searchQuery = '';
let currentViewLoan = null;

const SEMAPHORE_API_KEY = "YOUR_SEMAPHORE_API_KEY";
const SEMAPHORE_SENDER = "RGBLEND";
const SENDGRID_API_KEY = "SG.YOUR_SENDGRID_API_KEY_HERE";
const FROM_EMAIL = "noreply@rgblending.com";
const FROM_NAME = "RGB Lending";

// HELPER PARA SA PERA MAY 2 DECIMALS
function formatPeso(amount) {
    return Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

window.addEventListener('DOMContentLoaded', () => {
    const checkAuthInterval = setInterval(() => {
        if (window.auth) {
            clearInterval(checkAuthInterval);
            window.authTools.onAuthStateChanged(window.auth, user => {
                if (!user) { window.location.href = "admin-login.html"; }
                else { loadLoanRecords(); }
            });
        }
    }, 100);
});

function loadLoanRecords() {
    if (!window.db ||!window.firestoreTools) return;
    const { collection, onSnapshot } = window.firestoreTools;
    const loansRef = collection(window.db, "loan_applications");
    onSnapshot(loansRef, (snapshot) => {
        allLoansData = [];
        snapshot.forEach(doc => { allLoansData.push({ id: doc.id,...doc.data() }); });
        updateCounts();
        renderTable();
    });
}

function updateCounts() {
    document.getElementById('count-all').textContent = allLoansData.length;
    document.getElementById('count-pending').textContent = allLoansData.filter(l => l.status === 'Pending').length;
    document.getElementById('count-active').textContent = allLoansData.filter(l => l.status === 'Active').length;
    document.getElementById('count-rejected').textContent = allLoansData.filter(l => l.status === 'Rejected').length;
    document.getElementById('count-settled').textContent = allLoansData.filter(l => l.status === 'Settled').length;
    const today = new Date(); const in5Days = new Date(); in5Days.setDate(today.getDate() + 5);
    document.getElementById('count-upcoming').textContent = allLoansData.filter(l => l.status === 'Active' && l.dueDate && new Date(l.dueDate) <= in5Days && new Date(l.dueDate) >= today).length;
}

function filterLoans(filterType) {
    currentFilter = filterType;
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${filterType.toLowerCase()}`).classList.add('active');

    if(filterType === 'reports') {
        document.getElementById('reports-section').style.display = 'block';
        document.getElementById('table-section').style.display = 'none';
        document.getElementById('current-view-title').textContent = 'Collection Reports';
        document.getElementById('current-view-desc').textContent = 'Overview ng collections at payments.';
        loadReports();
        if(window.innerWidth < 992) toggleSidebar();
        return;
    } else {
        document.getElementById('reports-section').style.display = 'none';
        document.getElementById('table-section').style.display = 'block';
    }

    const titleMap = {
        'Pending': { title: 'For Approval Loans', desc: 'Mga bagong loan applications na kailangan i-review.' },
        'all': { title: 'All Loan Records', desc: 'Lahat ng loan records sa system.' },
        'Active': { title: 'Active Loans', desc: 'Mga na-approve na loan na kasalukuyang binabayaran.' },
        'upcoming': { title: 'Upcoming Due Loans', desc: 'Mga active loan na 5 days na lang bago mag-due.' },
        'Settled': { title: 'Settled Loans', desc: 'Mga kumpletong nabayaran na loan.' },
        'Rejected': { title: 'Rejected Loans', desc: 'Mga tinanggihang loan application.' }
    };
    document.getElementById('current-view-title').textContent = titleMap[filterType].title;
    document.getElementById('current-view-desc').textContent = titleMap[filterType].desc;
    renderTable();
    if(window.innerWidth < 992) toggleSidebar();
}

function handleSearch() {
    searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('loans-table-body');
    const mobileContainer = document.getElementById('mobile-cards-container');
    tbody.innerHTML = ''; mobileContainer.innerHTML = '';
    let filtered = [];
    if (currentFilter === 'all') { filtered = allLoansData; }
    else if (currentFilter === 'upcoming') {
        const today = new Date(); const in5Days = new Date(); in5Days.setDate(today.getDate() + 5);
        filtered = allLoansData.filter(l => l.status === 'Active' && l.dueDate && new Date(l.dueDate) <= in5Days && new Date(l.dueDate) >= today);
    }
    else { filtered = allLoansData.filter(l => l.status === currentFilter); }
    if (searchQuery!== '') { filtered = filtered.filter(loan => (loan.applicantName || '').toLowerCase().includes(searchQuery)); }
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>Walang loan records sa kategoryang ito.</p></div></td></tr>`;
        mobileContainer.innerHTML = `<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>Walang loan records sa kategoryang ito.</p></div>`;
        return;
    }
    filtered.forEach(loan => {
        const displayName = loan.applicantName || 'Borrower';
        const displayAmount = loan.loanAmount || 0;
        const displayTerms = loan.loanTermMonths || 1;
        const displayDueDate = loan.dueDate? new Date(loan.dueDate).toLocaleDateString('en-PH') : 'N/A';
        const paidMonths = loan.paidMonths || 0;
        const progress = `${paidMonths} / ${displayTerms} months`;
        const lastPayment = loan.lastPaymentDate? new Date(loan.lastPaymentDate).toLocaleDateString('en-PH') : 'N/A';
        let statusBadge = '';
        if (loan.status === 'Pending') statusBadge = `<span class="status status-pending"><i class="fa-solid fa-clock"></i> Pending</span>`;
        else if (loan.status === 'Active') statusBadge = `<span class="status status-active"><i class="fa-solid fa-check"></i> Active</span>`;
        else if (loan.status === 'Rejected') statusBadge = `<span class="status status-rejected"><i class="fa-solid fa-xmark"></i> Rejected</span>`;
        else if (loan.status === 'Settled') statusBadge = `<span class="status status-settled"><i class="fa-solid fa-circle-check"></i> Settled</span>`;
        let actionsHtml = `<button class="btn-action btn-view" onclick='viewDetails(${JSON.stringify(loan).replace(/'/g, "&apos;")})'><i class="fa-solid fa-eye"></i> View</button>`;
        if (loan.status === 'Pending') {
            actionsHtml += `<button class="btn-action btn-approve" onclick="updateLoanStatus('${loan.id}', 'Active')"><i class="fa-solid fa-check"></i> Approve</button><button class="btn-action btn-reject" onclick="updateLoanStatus('${loan.id}', 'Rejected')"><i class="fa-solid fa-xmark"></i> Reject</button>`;
        } else if (loan.status === 'Active') {
            actionsHtml += `<button class="btn-action btn-settle" onclick='openPaymentModal(${JSON.stringify(loan).replace(/'/g, "&apos;")})'><i class="fa-solid fa-cash-register"></i> Record Payment</button><button class="btn-action btn-approve" style="background:#0ea5e9" onclick="updateLoanStatus('${loan.id}', 'Settled')"><i class="fa-solid fa-hand-holding-dollar"></i> Mark Settled</button>`;
        }
        tbody.innerHTML += `<tr><td><strong>${displayName}</strong><br><small style="color:var(--text-muted);">${loan.applicantContact || ''}</small></td><td><strong>₱${formatPeso(displayAmount)}</strong></td><td>${displayTerms} Mos</td><td><b>${progress}</b></td><td>${displayDueDate}</td><td>${lastPayment}</td><td>${statusBadge}</td><td>${actionsHtml}</td></tr>`;
        mobileContainer.innerHTML += `<div class="loan-card"><div class="loan-card-header"><strong>${displayName}</strong> ${statusBadge}</div><div class="loan-card-body"><p><i class="fa-solid fa-phone"></i> ${loan.applicantContact || 'N/A'}</p><p><i class="fa-solid fa-peso-sign"></i> <b>₱${formatPeso(displayAmount)}</b></p><p><i class="fa-solid fa-calendar"></i> ${progress} | Due: ${displayDueDate}</p><p><i class="fa-solid fa-clock"></i> Last Payment: ${lastPayment}</p></div><div class="loan-card-actions">${actionsHtml}</div></div>`;
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick="switchTab('${tabName}')"]`).classList.add('active');
    document.getElementById('tab-details').style.display = tabName === 'details'? 'block' : 'none';
    document.getElementById('tab-payments').style.display = tabName === 'payments'? 'block' : 'none';
    if(tabName === 'payments' && currentViewLoan) { loadPaymentHistory(currentViewLoan.id, currentViewLoan); }
}

function viewDetails(loan) {
    currentViewLoan = loan;
    const modal = document.getElementById('viewModal');
    const tabDetails = document.getElementById('tab-details');
    const disbursement = loan.disbursementDetails || {};
    let disburseText = disbursement.channel || 'N/A';
    if(disbursement.channel === 'Bank Transfer'){ disburseText += ` - ${disbursement.bankName} | ${disbursement.accountName} | ${disbursement.accountNumber}`; } else { disburseText += ` - ${disbursement.accountName} | ${disbursement.accountNumber}`; }
    
    tabDetails.innerHTML = `<div class="detail-grid"><div class="detail-item"><label>Borrower Name</label><p>${loan.applicantName || 'N/A'}</p></div><div class="detail-item"><label>Contact</label><p>${loan.applicantContact || 'N/A'}</p></div><div class="detail-item"><label>Email</label><p>${loan.applicantEmail || 'N/A'}</p></div><div class="detail-item"><label>Address</label><p>${loan.applicantAddress || 'N/A'}</p></div><div class="detail-item"><label>Loan Amount</label><p>₱${formatPeso(loan.loanAmount)}</p></div><div class="detail-item"><label>Loan Term</label><p>${loan.loanTermMonths || 'N/A'} Months</p></div><div class="detail-item"><label>Monthly Payment</label><p>₱${formatPeso(loan.monthlyPayment)}</p></div><div class="detail-item"><label>Disbursement</label><p>${disburseText}</p></div><div class="detail-item full-width"><label>Occupation</label><p>${loan.occupation || 'N/A'}</p></div></div><div style="margin-top:1rem"><h3 style="margin-bottom:1rem">Submitted ID Images</h3><div class="id-images">${loan.idImageUrl1?`<img src="${loan.idImageUrl1}" onclick="window.open(this.src)" alt="ID 1">`:''}${loan.idImageUrl2?`<img src="${loan.idImageUrl2}" onclick="window.open(this.src)" alt="ID 2">`:''}</div></div><div style="margin-top:1rem"><h3 style="margin-bottom:1rem">Borrower Signature</h3>${loan.signatureData?`<img src="${loan.signatureData}" style="border:1px solid #ccc; max-width:200px">`:'<p>No signature</p>'}</div>`;
    
    modal.classList.add('active');
    switchTab('details');
}

function closeModal() { document.getElementById('viewModal').classList.remove('active'); }

async function updateLoanStatus(loanId, newStatus) {
    if (!confirm(`Sigurado ka bang gusto mong palitan ang status sa ${newStatus.toUpperCase()}?`)) return;
    try {
        const { doc, updateDoc, serverTimestamp } = window.firestoreTools;
        const loanRef = doc(window.db, "loan_applications", loanId);
        let updateData = { status: newStatus, updatedAt: serverTimestamp() };
        
        if(newStatus === 'Active'){
            const loan = allLoansData.find(l => l.id === loanId);
            const startDate = new Date();
            const dueDate = new Date();
            dueDate.setMonth(startDate.getMonth() + (loan.loanTermMonths || 1));
            
            const pdfUrl = await generateAndUploadAgreement(loan);
            
            updateData.approvedAt = startDate.toISOString();
            updateData.dueDate = dueDate.toISOString();
            updateData.paidMonths = 0;
            updateData.agreementPdfUrl = pdfUrl;
        }
        await updateDoc(loanRef, updateData);
        alert(`Status updated to ${newStatus}!`);
        closeModal();
    } catch (err) {
        alert("Failed to update status: " + err.message);
    }
}

async function generateAndUploadAgreement(loan) {
    try {
        const { jsPDF } = window.jspdf;
        if(!jsPDF) throw new Error("jsPDF not loaded");

        const doc = new jsPDF();
        
        doc.setFontSize(18); doc.setFont("helvetica", "bold");
        doc.text("LOAN AGREEMENT", 105, 20, { align: "center" });
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text("RGB LENDING CORPORATION", 105, 27, { align: "center" });

        let y = 45;
        doc.text(`Borrower: ${loan.applicantName}`, 20, y); y+=6;
        doc.text(`Address: ${loan.applicantAddress}`, 20, y); y+=6;
        doc.text(`Contact: ${loan.applicantContact}`, 20, y); y+=6;
        doc.text(`Email: ${loan.applicantEmail}`, 20, y); y+=10;
        doc.text(`Loan Amount: ₱${formatPeso(loan.loanAmount)}`, 20, y); y+=6;
        doc.text(`Term: ${loan.loanTermMonths} Months`, 20, y); y+=6;
        doc.text(`Monthly Payment: ₱${formatPeso(loan.monthlyPayment)}`, 20, y); y+=6;
        doc.text(`Interest: 5% per month`, 20, y); y+=15;

        doc.text("LENDER:", 25, y); doc.text("BORROWER:", 115, y); y+=5;
        doc.line(25, y, 90, y); doc.line(115, y, 180, y); y+=5;
        doc.text("RGB Lending", 25, y); doc.text(loan.applicantName, 115, y);
        
        if(loan.signatureData) doc.addImage(loan.signatureData, 'PNG', 115, y+3, 50, 20);

        const pdfBlob = doc.output('blob');
        const { ref, uploadBytes, getDownloadURL } = window.storageTools;
        const storageRef = ref(window.storage, `agreements/${loan.id}.pdf`);
        const snapshot = await uploadBytes(storageRef, pdfBlob);
        const url = await getDownloadURL(snapshot.ref);
        return url;
    } catch(err) {
        console.error("PDF Error: ", err);
        return ""; 
    }
}

function openPaymentModal(loan) {
    document.getElementById('paymentLoanDocId').value = loan.id;
    document.getElementById('paymentLoanId').textContent = loan.id.substring(0,8).toUpperCase();
    document.getElementById('paymentBorrowerName').value = loan.applicantName;
    document.getElementById('paymentMonthlyDue').value = `₱${formatPeso(loan.monthlyPayment)}`; // FIX
    document.getElementById('paymentAmount').value = Number(loan.monthlyPayment).toFixed(2); // FIX: may .00
    document.getElementById('paymentDate').valueAsDate = new Date();
    document.getElementById('paymentModal').classList.add('active');
}

function closePaymentModal() { document.getElementById('paymentModal').classList.remove('active'); }

async function submitPayment(event) {
    event.preventDefault();
    const loanId = document.getElementById('paymentLoanDocId').value;
    const amount = parseFloat(parseFloat(document.getElementById('paymentAmount').value).toFixed(2)); // FIX: force 2 decimals
    const paymentDate = document.getElementById('paymentDate').value;
    const method = document.getElementById('paymentMethod').value;
    const remarks = document.getElementById('paymentRemarks').value;
    const loan = allLoansData.find(l => l.id === loanId);
    if(!loan) return alert("Loan not found");

    try {
        const { doc, updateDoc, collection, addDoc, serverTimestamp } = window.firestoreTools;
        const loanRef = doc(window.db, "loan_applications", loanId);
        const newPaidMonths = (loan.paidMonths || 0) + 1;
        let newStatus = loan.status;
        if(newPaidMonths >= loan.loanTermMonths){ newStatus = 'Settled'; }
        
        await updateDoc(loanRef, { 
            paidMonths: newPaidMonths, 
            status: newStatus, 
            lastPaymentDate: paymentDate, 
            updatedAt: serverTimestamp() 
        });
        
        await addDoc(collection(window.db, "loan_payments"), { 
            loanId: loanId, 
            borrowerName: loan.applicantName, 
            amount: amount, 
            paymentDate: paymentDate, 
            method: method, 
            remarks: remarks, 
            createdAt: serverTimestamp() 
        });
        
        alert("Payment recorded successfully!");
        closePaymentModal();
        
        if(currentViewLoan && currentViewLoan.id === loanId){
            loadPaymentHistory(loanId, loan);
        }
    } catch(err) { alert("Error recording payment: " + err.message); }
}

async function loadPaymentHistory(loanId, loan) {
    const list = document.getElementById('paymentHistoryList');
    list.innerHTML = '<p style="text-align:center; color:var(--text-muted)">Loading...</p>';
    try {
        const { collection, query, where, getDocs, orderBy } = window.firestoreTools;
        const q = query(collection(window.db, "loan_payments"), where("loanId", "==", loanId), orderBy("paymentDate", "desc"));
        const snapshot = await getDocs(q);
        let totalPaid = 0;
        let paymentsHtml = '';
        
        if(snapshot.empty){ 
            paymentsHtml = '<p style="text-align:center; color:var(--text-muted)">No payments recorded yet.</p>'; 
        } else {
            snapshot.forEach(doc => {
                const p = doc.data();
                totalPaid += Number(p.amount);
                paymentsHtml += `<div class="payment-item"><div><p class="amount">₱${formatPeso(p.amount)}</p><p class="date">${new Date(p.paymentDate).toLocaleDateString('en-PH')} via ${p.method}</p></div><div><p style="font-size:0.8rem; color:var(--text-muted)">${p.remarks || ''}</p></div></div>`; // FIX
            });
        }
        
        const totalLoan = Number(loan.monthlyPayment) * Number(loan.loanTermMonths);
        const remaining = totalLoan - totalPaid;
        document.getElementById('totalPaidText').textContent = `₱${formatPeso(totalPaid)} / ₱${formatPeso(totalLoan)}`; // FIX
        document.getElementById('remainingBalanceText').textContent = `Remaining Balance: ₱${formatPeso(remaining)}`; // FIX
        list.innerHTML = paymentsHtml;
    } catch(err){
        console.error("Error loading payments:", err);
        list.innerHTML = `<p style="color:red; text-align:center">Error: ${err.message}</p>`;
    }
}

function loadReports() {
    const activeLoans = allLoansData.filter(l => l.status === 'Active');
    const settledLoans = allLoansData.filter(l => l.status === 'Settled');
    let totalCollected = 0;
    let totalOutstanding = 0;
    activeLoans.forEach(l => {
        const totalLoan = Number(l.monthlyPayment) * Number(l.loanTermMonths);
        const paid = Number(l.monthlyPayment) * Number(l.paidMonths || 0);
        totalOutstanding += (totalLoan - paid);
    });
    settledLoans.forEach(l => { totalCollected += Number(l.monthlyPayment) * Number(l.loanTermMonths); });
    document.getElementById('report-collected').textContent = `₱${formatPeso(totalCollected)}`; // FIX
    document.getElementById('report-outstanding').textContent = `₱${formatPeso(totalOutstanding)}`; // FIX
    document.getElementById('report-active').textContent = activeLoans.length;
    const dueList = document.getElementById('due-list');
    const dueThisWeek = getDueThisWeekLoans();
    document.getElementById('report-due').textContent = dueThisWeek.length;
    if(dueThisWeek.length === 0){ dueList.innerHTML = '<p style="text-align:center; color:var(--text-muted)">No loans due this week.</p>'; return; }
    dueList.innerHTML = dueThisWeek.map(l => `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px"><div><p style="font-weight:700">${l.applicantName}</p><p style="font-size:0.85rem; color:var(--text-muted)">Due: ${new Date(l.dueDate).toLocaleDateString('en-PH')} | Amount: ₱${formatPeso(l.monthlyPayment)}</p></div><div><button onclick="sendEmailReminder('${l.id}')" class="btn-action btn-view" style="font-size:0.75rem; padding:4px 8px; background:#2563eb"><i class="fa-solid fa-envelope"></i> Email</button><button onclick="sendSMSReminder('${l.id}')" class="btn-action btn-settle" style="font-size:0.75rem; padding:4px 8px"><i class="fa-solid fa-paper-plane"></i> SMS</button></div></div>`).join(''); // FIX
}

function getDueThisWeekLoans() {
    const today = new Date(); const in7Days = new Date(); in7Days.setDate(today.getDate() + 7);
    return allLoansData.filter(l => l.status === 'Active' && l.dueDate && new Date(l.dueDate) <= in7Days && new Date(l.dueDate) >= today);
}

async function sendSMSReminder(loanId) {
    const loan = allLoansData.find(l => l.id === loanId);
    if(!loan) return alert("Loan not found");
    const dueDate = new Date(loan.dueDate).toLocaleDateString('en-PH');
    const amount = formatPeso(loan.monthlyPayment); // FIX
    const message = `Hi ${loan.applicantName}, reminder: Your loan payment of ₱${amount} is due on ${dueDate}. Please pay to avoid penalties. - RGB Lending`;
    if(!confirm(`Send SMS to ${loan.applicantContact}?`)) return;
    try {
        const res = await fetch(`https://api.semaphore.co/api/v4/messages?apikey=${SEMAPHORE_API_KEY}&number=${loan.applicantContact}&message=${encodeURIComponent(message)}&sendername=${SEMAPHORE_SENDER}`);
        if(res.ok) alert("SMS Sent!"); else alert("Failed to send SMS");
    } catch(err) { alert("Error: " + err.message); }
}

async function sendAllReminders() {
    const dueThisWeek = getDueThisWeekLoans();
    if(dueThisWeek.length === 0) return alert("No loans due this week");
    if(!confirm(`Send SMS reminders to ${dueThisWeek.length} borrowers?`)) return;
    let sent = 0;
    for(const loan of dueThisWeek){ await sendSMSReminder(loan.id); sent++; await new Promise(r => setTimeout(r, 1000)); }
    alert(`${sent} SMS reminders sent!`);
}

async function sendEmailReminder(loanId) {
    const loan = allLoansData.find(l => l.id === loanId);
    if(!loan) return alert("Loan not found");
    if(!loan.applicantEmail) return alert("Walang email address si " + loan.applicantName);
    const dueDate = new Date(loan.dueDate).toLocaleDateString('en-PH', {year: 'numeric', month: 'long', day: 'numeric'});
    const amount = formatPeso(loan.monthlyPayment); // FIX
    const subject = `Payment Reminder - Due on ${dueDate}`;
    const htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><h2 style="color:#1b4332;">RGB Lending</h2><p>Hi <b>${loan.applicantName}</b>,</p><p>This is a friendly reminder that your loan payment of <b>₱${amount}</b> is due on <b>${dueDate}</b>.</p><div style="background:#f0fdf4; padding:15px; border-radius:8px; margin:20px 0;"><p><b>Loan Details:</b></p><p>Monthly Due: ₱${amount}</p><p>Progress: ${loan.paidMonths || 0} / ${loan.loanTermMonths} months</p></div><p>Please pay on or before the due date to avoid penalties. Thank you!</p><p>Best regards,<br><b>RGB Lending Team</b></p></div>`;
    if(!confirm(`Send email to ${loan.applicantEmail}?`)) return;
    try {
        const res = await fetch("https://api.sendgrid.com/v3/mail/send", { method: "POST", headers: { "Authorization": `Bearer ${SENDGRID_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ personalizations: [{ to: [{ email: loan.applicantEmail }] }], from: { email: FROM_EMAIL, name: FROM_NAME }, subject: subject, content: [{ type: "text/html", value: htmlContent }] }) });
        if(res.status === 202) { alert("Email Sent Successfully!"); } else { const err = await res.text(); alert("Failed to send email: " + err); }
    } catch(err) { alert("Error sending email: " + err.message); }
}

async function sendAllEmailReminders() {
    const dueThisWeek = getDueThisWeekLoans().filter(l => l.applicantEmail);
    if(dueThisWeek.length === 0) return alert("No loans due this week with email addresses");
    if(!confirm(`Send email reminders to ${dueThisWeek.length} borrowers?`)) return;
    let sent = 0;
    for(const loan of dueThisWeek){ await sendEmailReminder(loan.id); sent++; await new Promise(r => setTimeout(r, 1000)); }
    alert(`${sent} Email reminders sent!`);
}

async function generateLoanAgreement() {
    if(!currentViewLoan) return alert("No loan selected");
    const loan = currentViewLoan;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.text("LOAN AGREEMENT", 105, 20, { align: "center" });
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("RGB LENDING CORPORATION", 105, 27, { align: "center" });
    let y = 45; doc.setFontSize(10);
    doc.text(`Borrower: ${loan.applicantName}`, 20, y); y+=6;
    doc.text(`Address: ${loan.applicantAddress}`, 20, y); y+=6;
    doc.text(`Contact: ${loan.applicantContact}`, 20, y); y+=10;
    doc.text(`Loan Amount: ₱${formatPeso(loan.loanAmount)}`, 20, y); y+=6; // FIX
    doc.text(`Term: ${loan.loanTermMonths} Months`, 20, y); y+=6;
    doc.text(`Monthly: ₱${formatPeso(loan.monthlyPayment)}`, 20, y); y+=15; // FIX
    doc.text("LENDER:", 25, y); doc.text("BORROWER:", 115, y); y+=5;
    doc.line(25, y, 90, y); doc.line(115, y, 180, y); y+=5;
    doc.text("RGB Lending", 25, y); doc.text(loan.applicantName, 115, y);
    if(loan.signatureData) doc.addImage(loan.signatureData, 'PNG', 115, y+3, 50, 20);
    doc.save(`Loan_Agreement_${loan.applicantName.replace(/\s/g, '_')}.pdf`);
}

function handleLogout() {
    if (confirm("Are you sure you want to logout?")) {
        window.auth.signOut().then(() => { window.location.href = "admin-login.html"; });
    }
}