let allLoansData = [];
let allPaymentsData = [];
let currentFilter = 'Pending';
let searchQuery = '';
let currentViewLoan = null;
let currentViewPayment = null;

// ========== EMAILJS CONFIG ==========
    const EMAILJS_PUBLIC_KEY = "lJatpfNPqsxZc2BgW";
    const EMAILJS_SERVICE_ID = "service_cmxyohi"; // Palitan mo ng Service ID mo sa EmailJS
const EMAILJS_TEMPLATE_APPROVED = "template_loan_approved";
const EMAILJS_TEMPLATE_REMINDER = "template_due_reminder";

emailjs.init(EMAILJS_PUBLIC_KEY);
// =====================================

// REMOVED: SENDGRID_API_KEY at SEMAPHORE_API_KEY

// NEW: PRODUCT PAYMENT RULES
const PRODUCT_PAYMENT_FREQ = {
    "Emer Loan": { type: "lumpsum", count: 1, interestType: "monthly" },
    "ATM Sangla": { type: "semi-monthly-fixed", count: 2, interestType: "semi-monthly" }, // 15th and 30th, half interest
    "Personal Loan": { type: "monthly", count: 1, interestType: "monthly" },
    "Salary Loan": { type: "monthly", count: 1, interestType: "monthly" }
};

// NEW: GET PAYMENT AMOUNT PER CYCLE
function getPaymentAmount(loan) {
    const freq = PRODUCT_PAYMENT_FREQ[loan.loanType] || PRODUCT_PAYMENT_FREQ["Personal Loan"];
    if (freq.type === "semi-monthly-fixed") {
        return loan.monthlyPayment / 2; // HATI SA 2
    }
    return loan.monthlyPayment;
}

// NEW: GET TOTAL PAYMENTS
function getTotalPayments(loanType, loanTermMonths) {
    const freq = PRODUCT_PAYMENT_FREQ[loanType] || PRODUCT_PAYMENT_FREQ["Personal Loan"];
    if (freq.type === "semi-monthly-fixed") {
        return loanTermMonths * 2; // 2 payments per month
    }
    if (freq.type === "lumpsum") {
        return 1;
    }
    return loanTermMonths; // monthly
}

// NEW: GET NEXT DUE DATE - FIXED 15TH AND 30TH
function getNextDueDate(startDate, loanType, paymentNumber) {
    const freq = PRODUCT_PAYMENT_FREQ[loanType] || PRODUCT_PAYMENT_FREQ["Personal Loan"];
    const start = new Date(startDate);

    if (freq.type === "semi-monthly-fixed") {
        const monthsToAdd = Math.floor(paymentNumber / 2);
        const isFifteenth = paymentNumber % 2 === 0; // even = 15th, odd = 30th
        let dueDate = new Date(start.getFullYear(), start.getMonth() + monthsToAdd, isFifteenth? 15 : 30);

        if (paymentNumber === 0) {
            if (start.getDate() > 15 && start.getDate() <= 30) {
                dueDate = new Date(start.getFullYear(), start.getMonth(), 30);
            }
            if (start.getDate() > 30) {
                dueDate = new Date(start.getFullYear(), start.getMonth() + 1, 15);
            }
        }
        return dueDate;

    } else if (freq.type === "lumpsum") {
        start.setDate(start.getDate() + 30);
        return start;
    } else {
        start.setMonth(start.getMonth() + paymentNumber + 1);
        return start;
    }
}

function formatPeso(amount) {
    return Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// HELPER: KUHA NG EMAIL NI BORROWER
async function getBorrowerEmail(userId) {
    try {
        const { doc, getDoc } = window.firestoreTools;
        const userSnap = await getDoc(doc(window.db, "borrower_users", userId));
        if(userSnap.exists()){
            return userSnap.data().email || null;
        }
    } catch(err) { console.error("Error getting email:", err); }
    return null;
}

// FIXED: GAWING GLOBAL
window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('active');
}

// DELETED: sendSMS via Semaphore

// NEW: SEND APPROVAL EMAIL VIA EMAILJS
async function sendApprovalEmail(loan) {
    const paymentPerCycle = getPaymentAmount(loan);
    const freqText = loan.loanType === 'ATM Sangla'? 'Every 15th & 30th' : 'Monthly';
    const dueDateFormatted = loan.dueDate? new Date(loan.dueDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A';
    const borrowerEmail = await getBorrowerEmail(loan.userId);

    if(!borrowerEmail) {
        alert("⚠️ Walang email si borrower: " + loan.applicantName);
        return;
    }

    const templateParams = {
        to_email: borrowerEmail,
        to_name: loan.applicantName,
        applicant_name: loan.applicantName,
        loan_type: loan.loanType,
        loan_amount: formatPeso(loan.loanAmount),
        due_date: dueDateFormatted,
        payment_amount: formatPeso(paymentPerCycle),
        frequency: freqText
    };

    console.log("📧 SENDING EMAIL WITH:", templateParams); // PARA MAKITA SA CONSOLE

    try {
        const res = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_APPROVED, templateParams);
        console.log("✅ EmailJS Response:", res);
        alert(`Status updated to Active! Email sent to ${borrowerEmail}`);
    } catch(err) {
        console.error("❌ FULL EMAIL ERROR:", err);
        alert("Error sending email: " + JSON.stringify(err));
        throw err;
    }
}
window.addEventListener('DOMContentLoaded', () => {
    const checkAuthInterval = setInterval(() => {
        if (window.auth) {
            clearInterval(checkAuthInterval);
            window.authTools.onAuthStateChanged(window.auth, user => {
                if (!user) { window.location.href = "admin-login.html"; }
                else {
                    loadLoanRecords();
                    loadPaymentApprovals();
                }
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

function loadPaymentApprovals() {
    if (!window.db ||!window.firestoreTools) return;
    const { collection, query, where, onSnapshot, orderBy } = window.firestoreTools;
    const paymentsRef = collection(window.db, "payments");
    const q = query(paymentsRef, where("status", "==", "For Review"), orderBy("submittedAt", "desc"));

    onSnapshot(q, (snapshot) => {
        allPaymentsData = [];
        snapshot.forEach(doc => { allPaymentsData.push({ id: doc.id,...doc.data() }); });
        console.log("✅ Payments for review:", allPaymentsData.length);
        updateCounts();
        if(currentFilter === 'payments') renderTable();
    }, (error) => {
        console.error("❌ Error loading payments:", error);
    });
}

function updateCounts() {
    document.getElementById('count-all').textContent = allLoansData.length;
    document.getElementById('count-pending').textContent = allLoansData.filter(l => l.status === 'Pending').length;
    document.getElementById('count-active').textContent = allLoansData.filter(l => l.status === 'Active').length;
    document.getElementById('count-rejected').textContent = allLoansData.filter(l => l.status === 'Rejected').length;
    document.getElementById('count-settled').textContent = allLoansData.filter(l => l.status === 'Settled').length;
    document.getElementById('count-payments').textContent = allPaymentsData.length;

    const today = new Date(); const in5Days = new Date(); in5Days.setDate(today.getDate() + 5);
    document.getElementById('count-upcoming').textContent = allLoansData.filter(l => l.status === 'Active' && l.dueDate && new Date(l.dueDate) <= in5Days && new Date(l.dueDate) >= today).length;
}

// FIXED: GAWING GLOBAL
window.filterLoans = function(filterType) {
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
        'payments': { title: 'Payment Approvals', desc: 'Mga payment na sinubmit ni borrower for verification.' },
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

// FIXED: GAWING GLOBAL
window.handleSearch = function() {
    searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('loans-table-body');
    const mobileContainer = document.getElementById('mobile-cards-container');
    const tableHead = document.getElementById('table-head');
    tbody.innerHTML = ''; mobileContainer.innerHTML = '';

    if(currentFilter === 'payments'){
        tableHead.innerHTML = `<tr><th>Borrower</th><th>Loan ID</th><th>Amount</th><th>Date Submitted</th><th>Proof</th><th>Status</th><th>Actions</th></tr>`;
        if(allPaymentsData.length === 0){
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>Walang payment for review.</p></div></td></tr>`;
            mobileContainer.innerHTML = `<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>Walang payment for review.</p></div>`;
            return;
        }
        allPaymentsData.forEach(payment => {
            const loan = allLoansData.find(l => l.id === payment.loanId);
            const borrower = loan? loan.applicantName : 'N/A';
            const contact = loan? loan.applicantContact : '';

            tbody.innerHTML += `<tr>
                <td><strong>${borrower}</strong><br><small style="color:var(--text-muted);">${contact}</small></td>
                <td>${payment.loanId.substring(0,8).toUpperCase()}</td>
                <td><strong>₱${formatPeso(payment.amount)}</strong></td>
                <td>${new Date(payment.submittedAt).toLocaleDateString('en-PH')}</td>
                <td><button class="btn-action btn-view" onclick="viewPaymentProof('${payment.id}')"><i class="fa-solid fa-image"></i> View Proof</button></td>
                <td><span class="status status-for_review"><i class="fa-solid fa-clock"></i> For Review</span></td>
                <td>
                    <button class="btn-action btn-approve" onclick="approvePayment('${payment.id}')"><i class="fa-solid fa-check"></i> Approve</button>
                    <button class="btn-action btn-reject" onclick="rejectPayment('${payment.id}')"><i class="fa-solid fa-xmark"></i> Reject</button>
                </td>
            </tr>`;

            mobileContainer.innerHTML += `<div class="loan-card">
                <div class="loan-card-header"><strong>${borrower}</strong> <span class="status status-for_review">For Review</span></div>
                <div class="loan-card-body">
                    <p><i class="fa-solid fa-phone"></i> ${contact}</p>
                    <p><i class="fa-solid fa-peso-sign"></i> <b>₱${formatPeso(payment.amount)}</b></p>
                    <p><i class="fa-solid fa-calendar"></i> Submitted: ${new Date(payment.submittedAt).toLocaleDateString('en-PH')}</p>
                    <p><i class="fa-solid fa-hashtag"></i> Loan: ${payment.loanId.substring(0,8).toUpperCase()}</p>
                </div>
                <div class="loan-card-actions">
                    <button class="btn-action btn-view" onclick="viewPaymentProof('${payment.id}')"><i class="fa-solid fa-image"></i> View Proof</button>
                    <button class="btn-action btn-approve" onclick="approvePayment('${payment.id}')"><i class="fa-solid fa-check"></i> Approve</button>
                    <button class="btn-action btn-reject" onclick="rejectPayment('${payment.id}')"><i class="fa-solid fa-xmark"></i> Reject</button>
                </div>
            </div>`;
        });
        return;
    }

    tableHead.innerHTML = `<tr><th>Borrower Name</th><th>Amount</th><th>Terms</th><th>Progress</th><th>Next Due</th><th>Last Payment</th><th>Status</th><th>Actions</th></tr>`;

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
        const totalPayments = getTotalPayments(loan.loanType, loan.loanTermMonths);
        const paidCount = loan.paidMonths || 0;
        const paymentPerCycle = getPaymentAmount(loan);
        const progress = `${paidCount} / ${totalPayments}`;
        const nextDueDate = getNextDueDate(loan.approvedAt || loan.appliedAt, loan.loanType, paidCount);
        const displayDueDate = loan.status === 'Active'? nextDueDate.toLocaleDateString('en-PH') : 'N/A';
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
        tbody.innerHTML += `<tr><td><strong>${displayName}</strong><br><small style="color:var(--text-muted);">${loan.applicantContact || ''}</small></td><td><strong>₱${formatPeso(displayAmount)}</strong></td><td>${loan.loanTermMonths} Mos</td><td><b>${progress}</b></td><td>₱${formatPeso(paymentPerCycle)}<br><small>${displayDueDate}</small></td><td>${lastPayment}</td><td>${statusBadge}</td><td>${actionsHtml}</td></tr>`;
        mobileContainer.innerHTML += `<div class="loan-card"><div class="loan-card-header"><strong>${displayName}</strong> ${statusBadge}</div><div class="loan-card-body"><p><i class="fa-solid fa-phone"></i> ${loan.applicantContact || 'N/A'}</p><p><i class="fa-solid fa-peso-sign"></i> <b>₱${formatPeso(displayAmount)}</b></p><p><i class="fa-solid fa-cash-register"></i> Due: ₱${formatPeso(paymentPerCycle)}</p><p><i class="fa-solid fa-calendar"></i> ${progress} | ${displayDueDate}</p></div><div class="loan-card-actions">${actionsHtml}</div></div>`;
    });
}

// FIXED: GAWING GLOBAL
window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick="switchTab('${tabName}')"]`).classList.add('active');
    document.getElementById('tab-details').style.display = tabName === 'details'? 'block' : 'none';
    document.getElementById('tab-payments').style.display = tabName === 'payments'? 'block' : 'none';
    if(tabName === 'payments' && currentViewLoan) { loadPaymentHistory(currentViewLoan.id, currentViewLoan); }
}

// FIXED: GAWING GLOBAL
window.viewDetails = async function(loan) {
    currentViewLoan = loan;
    const modal = document.getElementById('viewModal');
    const tabDetails = document.getElementById('tab-details');
    const disbursement = loan.disbursementDetails || {};
    let disburseText = disbursement.channel || 'N/A';
    if(disbursement.channel === 'Bank Transfer'){
        disburseText += ` - ${disbursement.bankName} | ${disbursement.accountName} | ${disbursement.accountNumber}`;
    } else {
        disburseText += ` - ${disbursement.accountName} | ${disbursement.accountNumber}`;
    }

    let userEmail = 'N/A';
    try {
        const { doc, getDoc } = window.firestoreTools;
        const userSnap = await getDoc(doc(window.db, "borrower_users", loan.userId));
        if(userSnap.exists()){
            userEmail = userSnap.data().email || 'N/A';
        }
    } catch(err) { console.error("Error getting user email:", err); }

    let idImageSection = '';
    if(loan.idImageUrl){
        idImageSection = `<div class="detail-item full-width"><label><i class="fa-solid fa-id-card"></i> Submitted Valid ID</label><div class="id-images"><img src="${loan.idImageUrl}" onclick="window.open(this.src)" alt="Submitted ID"></div><p style="font-size:0.75rem; color:var(--text-muted); margin-top:5px">Click image to view full size</p></div>`;
    } else {
        idImageSection = `<div class="detail-item full-width"><label><i class="fa-solid fa-id-card"></i> Submitted Valid ID</label><p style="color:#dc2626"><i class="fa-solid fa-triangle-exclamation"></i> No ID Uploaded</p></div>`;
    }

    const paymentPerCycle = getPaymentAmount(loan);
    const freqText = loan.loanType === 'ATM Sangla'? 'Every 15th & 30th' : 'Monthly';

    tabDetails.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item"><label>Borrower Name</label><p>${loan.applicantName || 'N/A'}</p></div>
            <div class="detail-item"><label>Contact</label><p>${loan.applicantContact || 'N/A'}</p></div>
            <div class="detail-item"><label>Email</label><p>${userEmail}</p></div>
            <div class="detail-item"><label>Address</label><p>${loan.applicantAddress || 'N/A'}</p></div>
            <div class="detail-item"><label>Loan Type</label><p>${loan.loanType || 'N/A'}</p></div>
            <div class="detail-item"><label>Loan Amount</label><p>₱${formatPeso(loan.loanAmount)}</p></div>
            <div class="detail-item"><label>Loan Term</label><p>${loan.loanTermMonths || 'N/A'} Months</p></div>
            <div class="detail-item"><label>Payment Per Cycle</label><p>₱${formatPeso(paymentPerCycle)}</p></div>
            <div class="detail-item"><label>Payment Frequency</label><p>${freqText}</p></div>
            <div class="detail-item"><label>Status</label><p>${loan.status}</p></div>
            <div class="detail-item full-width"><label>Disbursement</label><p style="background:#f8fafc; padding:10px; border-radius:8px">${disburseText}</p></div>
            ${idImageSection}
            <div class="detail-item full-width"><label><i class="fa-solid fa-signature"></i> Borrower Signature</label>${loan.signatureData?`<img src="${loan.signatureData}" style="border:2px dashed #ccc; max-width:300px; border-radius:8px; background:#fafafa">`:'<p>No signature</p>'}</div>
        </div>`;

    modal.classList.add('active');
    switchTab('details');
}

// FIXED: GAWING GLOBAL
window.closeModal = function() { document.getElementById('viewModal').classList.remove('active'); }

// FIXED: GAWING GLOBAL + WITH AUTO EMAIL
window.updateLoanStatus = async function(loanId, newStatus) {
    if (!confirm(`Sigurado ka bang gusto mong palitan ang status sa ${newStatus.toUpperCase()}?`)) return;
    try {
        const { doc, updateDoc, serverTimestamp } = window.firestoreTools;
        const loanRef = doc(window.db, "loan_applications", loanId);
        let updateData = { status: newStatus, updatedAt: serverTimestamp() };
        const loan = allLoansData.find(l => l.id === loanId);

        if(newStatus === 'Active'){
            const approvedDate = new Date();
            const firstDueDate = getNextDueDate(approvedDate, loan.loanType, 0);

            const pdfUrl = await generateAndUploadAgreement(loan);
            updateData.approvedAt = approvedDate.toISOString();
            updateData.dueDate = firstDueDate.toISOString();
            updateData.paidMonths = 0;
            updateData.latePenalty = 0;
            updateData.agreementPdfUrl = pdfUrl;
        }
        await updateDoc(loanRef, updateData);

        // AUTO SEND EMAIL PAG APPROVED
        if(newStatus === 'Active') {
            await sendApprovalEmail({...loan,...updateData});
            alert(`Status updated to ${newStatus}! Email sent to borrower.`);
        } else {
            alert(`Status updated to ${newStatus}!`);
        }
        closeModal();
    } catch (err) {
        alert("Failed to update status: " + err.message);
    }
}

async function generateAndUploadAgreement(loan) {
    try {
        const { jsPDF } = window.jspdf || {};
        if(!jsPDF) return "";

        const doc = new jsPDF({orientation: 'portrait', unit: 'mm', format: 'a4'});
        const today = new Date();
        const year = today.getFullYear();
        const paymentPerCycle = getPaymentAmount(loan);
        const freqText = loan.loanType === 'ATM Sangla'? 'Every 15th and 30th of the month' : 'Monthly';

        doc.setFontSize(16); doc.setFont("helvetica", "bold");
        doc.text("LOAN AGREEMENT", 105, 20, { align: "center" });
        doc.setFontSize(11); doc.setFont("helvetica", "normal");
        doc.text('"KASUNDUAN SA PAGPAHULAM"', 105, 26, { align: "center" });

        doc.setFontSize(10);
        doc.text(`This Loan Agreement is made and entered into this ___ day of _______, ${year} in Braulio E. Dujali, Davao del Norte, Philippines, by and between:`, 20, 40, {maxWidth: 170});

        let y = 52;
        doc.setFont("helvetica", "bold");
        doc.text("LENDER:", 20, y);
        doc.text("BORROWER:", 110, y);
        doc.setFont("helvetica", "normal");
        y+=6;
        doc.text("ROLANDO G. BUTA JR", 20, y);
        doc.text(loan.applicantName || '________________', 110, y);
        y+=6;
        doc.text("Address: B.E. DUJALI, DAVAO DEL NORTE", 20, y);
        doc.text(`Address: ${loan.applicantAddress || '________________'}`, 110, y);
        y+=6;
        doc.text("Contact No.: 09927221659", 20, y);
        doc.text(`Contact No.: ${loan.applicantContact || '________________'}`, 110, y);

        y+=12;
        doc.setFont("helvetica", "bold"); doc.text("1. LOAN AMOUNT / KANTIDAD SA HULAM", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        doc.text(`The Lender hereby lends to the Borrower the principal sum of ₱${formatPeso(loan.loanAmount)} Philippine Currency.`, 20, y, {maxWidth: 170});

        y+=18;
        doc.setFont("helvetica", "bold"); doc.text("2. INTEREST / TUBO", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        const interestText = loan.loanType === 'ATM Sangla'? '2.5% every 15th and 30th' : '5% monthly';
        doc.text(`The Borrower agrees to pay the Lender an interest rate of ${interestText} of the principal amount.`, 20, y, {maxWidth: 170});

        y+=12;
        doc.setFont("helvetica", "bold"); doc.text("3. TERM / PANAHON SA PAGBAYAD", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        const start = loan.approvedAt? new Date(loan.approvedAt).toLocaleDateString('en-PH') : '___';
        const end = loan.dueDate? new Date(loan.dueDate).toLocaleDateString('en-PH') : '___';
        doc.text(`The term of this loan shall be for a period of ${loan.loanTermMonths} months ONLY.`, 20, y, {maxWidth: 170});

        y+=18;
        doc.setFont("helvetica", "bold"); doc.text("4. PAYMENT SCHEDULE / ESKEDYUL SA BAYAD", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        doc.text(`Payment Amount: ₱${formatPeso(paymentPerCycle)} per cycle. Schedule: ${freqText}`, 20, y, {maxWidth: 170});

        y+=18;
        doc.setFont("helvetica", "bold"); doc.text("5. MODE OF PAYMENT", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        doc.text(`All payments shall be made in cash, GCash, or bank transfer to the Lender.`, 20, y, {maxWidth: 170});

        y+=30;
        doc.text("LENDER:", 25, y); doc.text("BORROWER:", 115, y); y+=5;
        doc.line(25, y, 90, y); doc.line(115, y, 180, y); y+=5;
        doc.text("Rolando G. Buta Jr.", 25, y);
        doc.text(loan.applicantName || '________________', 115, y);

        if(loan.signatureData) {
            try { doc.addImage(loan.signatureData, 'PNG', 115, y-15, 50, 15); } catch(e) {}
        }

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

// FIXED: GAWING GLOBAL
window.openPaymentModal = function(loan) {
    const paymentPerCycle = getPaymentAmount(loan);
    document.getElementById('paymentLoanDocId').value = loan.id;
    document.getElementById('paymentLoanId').textContent = loan.id.substring(0,8).toUpperCase();
    document.getElementById('paymentBorrowerName').value = loan.applicantName;
    document.getElementById('paymentMonthlyDue').value = `₱${formatPeso(paymentPerCycle)}`;
    document.getElementById('paymentAmount').value = Number(paymentPerCycle).toFixed(2);
    document.getElementById('paymentDate').valueAsDate = new Date();
    document.getElementById('paymentModal').classList.add('active');
}

// FIXED: GAWING GLOBAL
window.closePaymentModal = function() { document.getElementById('paymentModal').classList.remove('active'); }

// FIXED: GAWING GLOBAL
window.submitPayment = async function(event) {
    event.preventDefault();
    const loanId = document.getElementById('paymentLoanDocId').value;
    const amount = parseFloat(parseFloat(document.getElementById('paymentAmount').value).toFixed(2));
    const paymentDate = document.getElementById('paymentDate').value;
    const method = document.getElementById('paymentMethod').value;
    const remarks = document.getElementById('paymentRemarks').value;
    const loan = allLoansData.find(l => l.id === loanId);
    if(!loan) return alert("Loan not found");

    try {
        const { doc, updateDoc, collection, addDoc, serverTimestamp } = window.firestoreTools;
        const loanRef = doc(window.db, "loan_applications", loanId);
        const newPaidMonths = (loan.paidMonths || 0) + 1;
        const totalPayments = getTotalPayments(loan.loanType, loan.loanTermMonths);
        let newStatus = loan.status;
        if(newPaidMonths >= totalPayments){ newStatus = 'Settled'; }

        const nextDueDate = getNextDueDate(loan.approvedAt || loan.appliedAt, loan.loanType, newPaidMonths);

        await updateDoc(loanRef, {
            paidMonths: newPaidMonths,
            status: newStatus,
            lastPaymentDate: paymentDate,
            dueDate: nextDueDate.toISOString(),
            latePenalty: 0,
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
        let totalPaid = 0; let paymentsHtml = '';
        const totalPayments = getTotalPayments(loan.loanType, loan.loanTermMonths);
        const paymentPerCycle = getPaymentAmount(loan);

        if(snapshot.empty){ paymentsHtml = '<p style="text-align:center; color:var(--text-muted)">No payments recorded yet.</p>'; }
        else {
            let count = 0;
            snapshot.forEach(doc => {
                const p = doc.data();
                count++;
                totalPaid += Number(p.amount);
                const dueDate = getNextDueDate(loan.approvedAt || loan.appliedAt, loan.loanType, count-1);
                paymentsHtml += `<div class="payment-item"><div><p class="amount">₱${formatPeso(p.amount)}</p><p class="date">Payment #${count} - ${dueDate.toLocaleDateString('en-PH')} via ${p.method}</p></div></div>`;
            });
        }
        const totalLoan = paymentPerCycle * totalPayments;
        const remaining = totalLoan - totalPaid;
        document.getElementById('totalPaidText').textContent = `₱${formatPeso(totalPaid)} / ₱${formatPeso(totalLoan)}`;
        document.getElementById('remainingBalanceText').textContent = `Remaining Balance: ₱${formatPeso(remaining)}`;
        list.innerHTML = paymentsHtml;
    } catch(err){ console.error("Error loading payments:", err); list.innerHTML = `<p style="color:red; text-align:center">Error: ${err.message}</p>`; }
}

function loadReports() {
    const activeLoans = allLoansData.filter(l => l.status === 'Active');
    const settledLoans = allLoansData.filter(l => l.status === 'Settled');
    let totalCollected = 0; let totalOutstanding = 0;
    activeLoans.forEach(l => {
        const totalPayments = getTotalPayments(l.loanType, l.loanTermMonths);
        const paymentPerCycle = getPaymentAmount(l);
        const totalLoan = paymentPerCycle * totalPayments;
        const paid = paymentPerCycle * Number(l.paidMonths || 0);
        totalOutstanding += (totalLoan - paid);
    });
    settledLoans.forEach(l => {
        const totalPayments = getTotalPayments(l.loanType, l.loanTermMonths);
        const paymentPerCycle = getPaymentAmount(l);
        totalCollected += paymentPerCycle * totalPayments;
    });
    document.getElementById('report-collected').textContent = `₱${formatPeso(totalCollected)}`;
    document.getElementById('report-outstanding').textContent = `₱${formatPeso(totalOutstanding)}`;
    document.getElementById('report-active').textContent = activeLoans.length;
    const dueList = document.getElementById('due-list');
    const dueThisWeek = getDueThisWeekLoans();
    document.getElementById('report-due').textContent = dueThisWeek.length;
    if(dueThisWeek.length === 0){ dueList.innerHTML = '<p style="text-align:center; color:var(--text-muted)">No loans due this week.</p>'; return; }
    dueList.innerHTML = dueThisWeek.map(l => `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px"><div><p style="font-weight:700">${l.applicantName}</p><p style="font-size:0.85rem; color:var(--text-muted)">Due: ${new Date(l.dueDate).toLocaleDateString('en-PH')} | Amount: ₱${formatPeso(getPaymentAmount(l))}</p></div></div>`).join('');
}

function getDueThisWeekLoans() {
    const today = new Date(); const in7Days = new Date(); in7Days.setDate(today.getDate() + 7);
    return allLoansData.filter(l => l.status === 'Active' && l.dueDate && new Date(l.dueDate) <= in7Days && new Date(l.dueDate) >= today);
}

// NEW: SEND DUE REMINDER EMAILS
window.sendDueReminders = async function() {
    if(!confirm("Send Email reminders to all borrowers with due dates in the next 3 days?")) return;

    const today = new Date();
    today.setHours(0,0,0,0);
    const in3Days = new Date();
    in3Days.setDate(today.getDate() + 3);
    in3Days.setHours(23,59,59,999);

    const dueLoans = allLoansData.filter(l => {
        if(l.status!== 'Active' ||!l.dueDate) return false;
        const dueDate = new Date(l.dueDate);
        return dueDate >= today && dueDate <= in3Days;
    });

    if(dueLoans.length === 0){ alert("Wala pang loans na due in the next 3 days."); return; }

    let successCount = 0;
    let failCount = 0;
    const btn = document.getElementById('sendReminderBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending ${dueLoans.length} Emails...`;
    btn.disabled = true;

    for(const loan of dueLoans){
        try {
            const paymentPerCycle = getPaymentAmount(loan);
            const dueDateFormatted = new Date(loan.dueDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
            const borrowerEmail = await getBorrowerEmail(loan.userId);
            if(!borrowerEmail) { failCount++; continue; }

            const templateParams = {
                to_email: borrowerEmail,
                applicant_name: loan.applicantName,
                loan_type: loan.loanType,
                payment_amount: formatPeso(paymentPerCycle),
                due_date: dueDateFormatted
            };
            await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_REMINDER, templateParams);
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 700)); // delay para di ma-block

        } catch(err) {
            console.error("Email Failed for:", loan.applicantName, err);
            failCount++;
        }
    }

    btn.innerHTML = originalText;
    btn.disabled = false;
    alert(`Email Reminders Complete! \n\nSuccess: ${successCount}\nFailed: ${failCount}`);
}

// FIXED: GAWING GLOBAL
window.generateLoanAgreement = function() {
    if(!currentViewLoan) return alert("No loan selected. Please click 'View' first.");
    const loan = currentViewLoan;
    const { jsPDF } = window.jspdf || {};
    if(!jsPDF) return alert("PDF Library not loaded. Please refresh the page.");

    const paymentPerCycle = getPaymentAmount(loan);
    const freqText = loan.loanType === 'ATM Sangla'? 'Every 15th and 30th of the month' : 'Monthly';

    try {
        const doc = new jsPDF({orientation: 'portrait', unit: 'mm', format: 'a4'});
        const today = new Date();
        const year = today.getFullYear();

        doc.setFontSize(16); doc.setFont("helvetica", "bold");
        doc.text("LOAN AGREEMENT", 105, 20, { align: "center" });
        doc.setFontSize(11); doc.setFont("helvetica", "normal");
        doc.text('"KASUNDUAN SA PAGPAHULAM"', 105, 26, { align: "center" });

        doc.setFontSize(10);
        doc.text(`This Loan Agreement is made and entered into this ___ day of _______, ${year} in Braulio E. Dujali, Davao del Norte, Philippines, by and between:`, 20, 40, {maxWidth: 170});

        let y = 52;
        doc.setFont("helvetica", "bold");
        doc.text("LENDER:", 20, y);
        doc.text("BORROWER:", 110, y);
        doc.setFont("helvetica", "normal");
        y+=6;
        doc.text("ROLANDO G. BUTA JR", 20, y);
        doc.text(loan.applicantName || '________________', 110, y);
        y+=6;
        doc.text("Address: B.E. DUJALI, DAVAO DEL NORTE", 20, y);
        doc.text(`Address: ${loan.applicantAddress || '________________'}`, 110, y);
        y+=6;
        doc.text("Contact No.: 09927221659", 20, y);
        doc.text(`Contact No.: ${loan.applicantContact || '________________'}`, 110, y);

        y+=12; doc.setFont("helvetica", "bold"); doc.text("1. LOAN AMOUNT / KANTIDAD SA HULAM", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        doc.text(`The Lender hereby lends to the Borrower the principal sum of ₱${formatPeso(loan.loanAmount)} Philippine Currency.`, 20, y, {maxWidth: 170});

        y+=18; doc.setFont("helvetica", "bold"); doc.text("2. INTEREST / TUBO", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        const interestText = loan.loanType === 'ATM Sangla'? '2.5% every 15th and 30th' : '5% monthly';
        doc.text(`The Borrower agrees to pay the Lender an interest rate of ${interestText} of the principal amount.`, 20, y, {maxWidth: 170});

        y+=12; doc.setFont("helvetica", "bold"); doc.text("3. TERM / PANAHON SA PAGBAYAD", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        const start = loan.approvedAt? new Date(loan.approvedAt).toLocaleDateString('en-PH') : '___';
        const end = loan.dueDate? new Date(loan.dueDate).toLocaleDateString('en-PH') : '___';
        doc.text(`The term of this loan shall be for a period of ${loan.loanTermMonths} months ONLY.`, 20, y, {maxWidth: 170});

        y+=18; doc.setFont("helvetica", "bold"); doc.text("4. PAYMENT SCHEDULE / ESKEDYUL SA BAYAD", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        doc.text(`Payment Amount: ₱${formatPeso(paymentPerCycle)} per cycle. Schedule: ${freqText}`, 20, y, {maxWidth: 170});

        y+=30;
        doc.text("LENDER:", 25, y); doc.text("BORROWER:", 115, y); y+=5;
        doc.line(25, y, 90, y); doc.line(115, y, 180, y); y+=5;
        doc.text("Rolando G. Buta Jr.", 25, y);
        doc.text(loan.applicantName || '________________', 115, y);

        if(loan.signatureData) {
            try { doc.addImage(loan.signatureData, 'PNG', 115, y-15, 50, 15); } catch(e) {}
        }

        doc.save(`Loan_Agreement_${(loan.applicantName || 'Borrower').replace(/\s/g, '_')}.pdf`);
        alert("PDF Downloaded Successfully!");

    } catch(err) {
        console.error(err);
        alert("Failed to generate PDF: " + err.message);
    }
}

// FIXED: GAWING GLOBAL
window.viewPaymentProof = function(paymentId) {
    const payment = allPaymentsData.find(p => p.id === paymentId);
    if(!payment) return alert("Payment not found");
    currentViewPayment = payment;
    const loan = allLoansData.find(l => l.id === payment.loanId);
    const proofUrl = payment.proofUrl || '';

    document.getElementById('paymentProofContent').innerHTML = `
        <div class="detail-grid">
            <div class="detail-item"><label>Borrower</label><p>${loan? loan.applicantName : 'N/A'}</p></div>
            <div class="detail-item"><label>Amount</label><p>₱${formatPeso(payment.amount)}</p></div>
            <div class="detail-item"><label>Date Submitted</label><p>${new Date(payment.submittedAt).toLocaleString('en-PH')}</p></div>
            <div class="detail-item"><label>Loan ID</label><p>${payment.loanId.substring(0,8).toUpperCase()}</p></div>
            <div class="detail-item full-width"><label>Payment Proof</label>
                ${proofUrl
            ? `<img src="${proofUrl}" onerror="this.src='https://via.placeholder.com/600x400?text=Image+Not+Found'" onclick="window.open(this.src)" style="width:100%; max-height:400px; object-fit:contain; border:2px solid #e2e8f0; border-radius:8px; cursor:pointer">`
                    : `<p style="color:red; text-align:center; padding:2rem">No proof image uploaded</p>`
                }
            </div>
        </div>
    `;
    document.getElementById('paymentProofModal').classList.add('active');
}

// FIXED: GAWING GLOBAL
window.closePaymentProofModal = function() {
    document.getElementById('paymentProofModal').classList.remove('active');
    currentViewPayment = null;
}

// FIXED: GAWING GLOBAL
window.approvePayment = async function(paymentId = null) {
    const payment = paymentId? allPaymentsData.find(p => p.id === paymentId) : currentViewPayment;
    if(!payment) return alert("Payment not found");
    if(!confirm("Approve this payment?")) return;

    try {
        const { doc, updateDoc, serverTimestamp } = window.firestoreTools;
        const paymentRef = doc(window.db, "payments", payment.id);
        const loanRef = doc(window.db, "loan_applications", payment.loanId);
        const loan = allLoansData.find(l => l.id === payment.loanId);

        await updateDoc(paymentRef, { status: 'Paid', reviewedAt: serverTimestamp() });

        const newPaidMonths = (loan.paidMonths || 0) + 1;
        const totalPayments = getTotalPayments(loan.loanType, loan.loanTermMonths);
        let newLoanStatus = loan.status;
        if(newPaidMonths >= totalPayments){ newLoanStatus = 'Settled'; }

        const nextDueDate = getNextDueDate(loan.approvedAt || loan.appliedAt, loan.loanType, newPaidMonths);

        await updateDoc(loanRef, {
            paymentStatus: null,
            paidMonths: newPaidMonths,
            status: newLoanStatus,
            lastPaymentDate: new Date().toISOString().split('T')[0],
            dueDate: nextDueDate.toISOString(),
            latePenalty: 0,
            updatedAt: serverTimestamp()
        });

        const { collection, addDoc } = window.firestoreTools;
        await addDoc(collection(window.db, "loan_payments"), {
            loanId: payment.loanId,
            borrowerName: loan.applicantName,
            amount: Number(payment.amount),
            paymentDate: new Date().toISOString().split('T')[0],
            method: 'Online Payment',
            remarks: 'Approved via Payment Approval',
            createdAt: serverTimestamp()
        });

        alert("Payment Approved!");
        closePaymentProofModal();
    } catch(err) {
        alert("Error approving payment: " + err.message);
    }
}

// FIXED: GAWING GLOBAL
window.rejectPayment = async function(paymentId = null) {
    const payment = paymentId? allPaymentsData.find(p => p.id === paymentId) : currentViewPayment;
    if(!payment) return alert("Payment not found");
    if(!confirm("Reject this payment? Borrower will need to resubmit.")) return;

    try {
        const { doc, updateDoc, serverTimestamp } = window.firestoreTools;
        const paymentRef = doc(window.db, "payments", payment.id);
        const loanRef = doc(window.db, "loan_applications", payment.loanId);

        await updateDoc(paymentRef, { status: 'Rejected', reviewedAt: serverTimestamp() });

        await updateDoc(loanRef, {
            paymentStatus: null,
            updatedAt: serverTimestamp()
        });

        alert("Payment Rejected!");
        closePaymentProofModal();
    } catch(err) {
        alert("Error rejecting payment: " + err.message);
    }
}

// FIXED: GAWING GLOBAL
window.handleLogout = function() {
    if (confirm("Are you sure you want to logout?")) {
        window.auth.signOut().then(() => { window.location.href = "admin-login.html"; });
    }
}
