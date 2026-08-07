let allLoansData = [];
let allPaymentsData = [];
let currentFilter = 'Pending';
let searchQuery = '';
let currentViewLoan = null;
let currentViewPayment = null;

const SENDGRID_API_KEY = "";
const SEMAPHORE_API_KEY = "";

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

function handleSearch() {
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

    tableHead.innerHTML = `<tr><th>Borrower Name</th><th>Amount</th><th>Terms</th><th>Progress</th><th>Due Date</th><th>Last Payment</th><th>Status</th><th>Actions</th></tr>`;

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

async function viewDetails(loan) {
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

    tabDetails.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item"><label>Borrower Name</label><p>${loan.applicantName || 'N/A'}</p></div>
            <div class="detail-item"><label>Contact</label><p>${loan.applicantContact || 'N/A'}</p></div>
            <div class="detail-item"><label>Email</label><p>${userEmail}</p></div>
            <div class="detail-item"><label>Address</label><p>${loan.applicantAddress || 'N/A'}</p></div>
            <div class="detail-item"><label>Loan Amount</label><p>₱${formatPeso(loan.loanAmount)}</p></div>
            <div class="detail-item"><label>Loan Term</label><p>${loan.loanTermMonths || 'N/A'} Months</p></div>
            <div class="detail-item"><label>Monthly Payment</label><p>₱${formatPeso(loan.monthlyPayment)}</p></div>
            <div class="detail-item"><label>Status</label><p>${loan.status}</p></div>
            <div class="detail-item full-width"><label>Disbursement</label><p style="background:#f8fafc; padding:10px; border-radius:8px">${disburseText}</p></div>
            ${idImageSection}
            <div class="detail-item full-width"><label><i class="fa-solid fa-signature"></i> Borrower Signature</label>${loan.signatureData?`<img src="${loan.signatureData}" style="border:2px dashed #ccc; max-width:300px; border-radius:8px; background:#fafafa">`:'<p>No signature</p>'}</div>
        </div>`;

    modal.classList.add('active');
    switchTab('details');
}

function closeModal() { document.getElementById('viewModal').classList.remove('active'); }

// FIXED: FIRST DUE = APPROVED + 1 MONTH
async function updateLoanStatus(loanId, newStatus) {
    if (!confirm(`Sigurado ka bang gusto mong palitan ang status sa ${newStatus.toUpperCase()}?`)) return;
    try {
        const { doc, updateDoc, serverTimestamp } = window.firestoreTools;
        const loanRef = doc(window.db, "loan_applications", loanId);
        let updateData = { status: newStatus, updatedAt: serverTimestamp() };

        if(newStatus === 'Active'){
            const loan = allLoansData.find(l => l.id === loanId);
            const approvedDate = new Date();
            const firstDueDate = new Date(approvedDate);
            firstDueDate.setMonth(approvedDate.getMonth() + 1); // +1 MONTH LANG
            
            const pdfUrl = await generateAndUploadAgreement(loan);
            updateData.approvedAt = approvedDate.toISOString();
            updateData.dueDate = firstDueDate.toISOString();
            updateData.paidMonths = 0;
            updateData.latePenalty = 0;
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
        const { jsPDF } = window.jspdf || {};
        if(!jsPDF) {
            console.error("jsPDF not loaded");
            return "";
        }
        
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
        
        y+=12;
        doc.setFont("helvetica", "bold"); doc.text("1. LOAN AMOUNT / KANTIDAD SA HULAM", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        doc.text(`The Lender hereby lends to the Borrower, and the Borrower hereby borrows from the Lender, the principal sum of ₱${formatPeso(loan.loanAmount)} Philippine Currency, receipt of which is hereby acknowledged by the Borrower.`, 20, y, {maxWidth: 170});

        y+=18;
        doc.setFont("helvetica", "bold"); doc.text("2. INTEREST / TUBO", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        doc.text(`The Borrower agrees to pay the Lender a monthly interest rate of 5% of the principal amount.`, 20, y, {maxWidth: 170});

        y+=12;
        doc.setFont("helvetica", "bold"); doc.text("3. TERM / PANAHON SA PAGBAYAD", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        const start = loan.approvedAt ? new Date(loan.approvedAt).toLocaleDateString('en-PH') : '___';
        const end = loan.dueDate ? new Date(loan.dueDate).toLocaleDateString('en-PH') : '___';
        doc.text(`The term of this loan shall be for a period of ${loan.loanTermMonths} months ONLY, commencing on ${start} and ending on ${end}`, 20, y, {maxWidth: 170});

        y+=18;
        doc.setFont("helvetica", "bold"); doc.text("4. PAYMENT SCHEDULE / ESKEDYUL SA BAYAD", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        doc.text(`The Borrower shall pay the Lender according to the following schedule: Monthly`, 20, y, {maxWidth: 170});

        y+=12;
        doc.setFont("helvetica", "bold"); doc.text("5. MODE OF PAYMENT", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        doc.text(`All payments shall be made in cash, GCash, or bank transfer to the Lender. Official receipt or proof of payment shall be provided.`, 20, y, {maxWidth: 170});

        y+=18;
        doc.setFont("helvetica", "bold"); doc.text("6. DEFAULT / DILI PAGBAYAD", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        doc.text(`Should the Borrower default or fail to pay the full amount within the term, the Lender shall have the right to demand full payment and may take legal action. The Borrower shall be liable for attorney's fees, litigation expenses, and other costs of collection. And a 300 pesos for the late payment penalty.`, 20, y, {maxWidth: 170});

        y+=30;
        doc.setFont("helvetica", "bold"); doc.text("7. ENTIRE AGREEMENT", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        doc.text(`This Agreement constitutes the entire agreement between the parties and supersedes all prior agreements. Any modification must be in writing and signed by both parties.`, 20, y, {maxWidth: 170});

        y+=20;
        doc.text(`IN WITNESS WHEREOF, the parties have hereunto set their hands this ___ day of ___________ ${year}.`, 20, y, {maxWidth: 170});
        
        y+=25;
        doc.text("LENDER:", 25, y); doc.text("BORROWER:", 115, y); y+=5;
        doc.line(25, y, 90, y); doc.line(115, y, 180, y); y+=5;
        doc.text("Rolando G. Buta Jr.", 25, y); 
        doc.text(loan.applicantName || '________________', 115, y);
        y+=5; doc.setFontSize(8);
        doc.text("(Signature over Printed Name)", 25, y); 
        doc.text("(Signature over Printed Name)", 115, y);
        y+=5;
        doc.text("Date: ___________", 25, y); 
        doc.text("Date: ___________", 115, y);
        
        if(loan.signatureData) {
            try {
                doc.addImage(loan.signatureData, 'PNG', 115, y-15, 50, 15);
            } catch(e) { console.log("Signature add failed", e) }
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

function openPaymentModal(loan) {
    document.getElementById('paymentLoanDocId').value = loan.id;
    document.getElementById('paymentLoanId').textContent = loan.id.substring(0,8).toUpperCase();
    document.getElementById('paymentBorrowerName').value = loan.applicantName;
    document.getElementById('paymentMonthlyDue').value = `₱${formatPeso(loan.monthlyPayment)}`;
    document.getElementById('paymentAmount').value = Number(loan.monthlyPayment).toFixed(2);
    document.getElementById('paymentDate').valueAsDate = new Date();
    document.getElementById('paymentModal').classList.add('active');
}

function closePaymentModal() { document.getElementById('paymentModal').classList.remove('active'); }

// FIXED: AUTO +1 MONTH DUE DATE + RESET PENALTY
async function submitPayment(event) {
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
        let newStatus = loan.status;
        if(newPaidMonths >= loan.loanTermMonths){ newStatus = 'Settled'; }

        const currentDue = new Date(loan.dueDate);
        const nextDueDate = new Date(currentDue);
        nextDueDate.setMonth(currentDue.getMonth() + 1); // +1 MONTH

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
        if(snapshot.empty){ paymentsHtml = '<p style="text-align:center; color:var(--text-muted)">No payments recorded yet.</p>'; }
        else {
            snapshot.forEach(doc => {
                const p = doc.data();
                totalPaid += Number(p.amount);
                paymentsHtml += `<div class="payment-item"><div><p class="amount">₱${formatPeso(p.amount)}</p><p class="date">${new Date(p.paymentDate).toLocaleDateString('en-PH')} via ${p.method}</p></div><div><p style="font-size:0.8rem; color:var(--text-muted)">${p.remarks || ''}</p></div></div>`;
            });
        }
        const totalLoan = Number(loan.monthlyPayment) * Number(loan.loanTermMonths);
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
        const totalLoan = Number(l.monthlyPayment) * Number(l.loanTermMonths);
        const paid = Number(l.monthlyPayment) * Number(l.paidMonths || 0);
        totalOutstanding += (totalLoan - paid);
    });
    settledLoans.forEach(l => { totalCollected += Number(l.monthlyPayment) * Number(l.loanTermMonths); });
    document.getElementById('report-collected').textContent = `₱${formatPeso(totalCollected)}`;
    document.getElementById('report-outstanding').textContent = `₱${formatPeso(totalOutstanding)}`;
    document.getElementById('report-active').textContent = activeLoans.length;
    const dueList = document.getElementById('due-list');
    const dueThisWeek = getDueThisWeekLoans();
    document.getElementById('report-due').textContent = dueThisWeek.length;
    if(dueThisWeek.length === 0){ dueList.innerHTML = '<p style="text-align:center; color:var(--text-muted)">No loans due this week.</p>'; return; }
    dueList.innerHTML = dueThisWeek.map(l => `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px"><div><p style="font-weight:700">${l.applicantName}</p><p style="font-size:0.85rem; color:var(--text-muted)">Due: ${new Date(l.dueDate).toLocaleDateString('en-PH')} | Amount: ₱${formatPeso(l.monthlyPayment)}</p></div></div>`).join('');
}

function getDueThisWeekLoans() {
    const today = new Date(); const in7Days = new Date(); in7Days.setDate(today.getDate() + 7);
    return allLoansData.filter(l => l.status === 'Active' && l.dueDate && new Date(l.dueDate) <= in7Days && new Date(l.dueDate) >= today);
}

function generateLoanAgreement() {
    if(!currentViewLoan) return alert("No loan selected. Please click 'View' first.");
    const loan = currentViewLoan;
    const { jsPDF } = window.jspdf || {};

    if(!jsPDF) {
        alert("PDF Library not loaded. Please refresh the page.");
        return;
    }

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
        doc.text(`The Lender hereby lends to the Borrower, and the Borrower hereby borrows from the Lender, the principal sum of ₱${formatPeso(loan.loanAmount)} Philippine Currency, receipt of which is hereby acknowledged by the Borrower.`, 20, y, {maxWidth: 170});

        y+=18; doc.setFont("helvetica", "bold"); doc.text("2. INTEREST / TUBO", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        doc.text(`The Borrower agrees to pay the Lender a monthly interest rate of 5% of the principal amount.`, 20, y, {maxWidth: 170});

        y+=12; doc.setFont("helvetica", "bold"); doc.text("3. TERM / PANAHON SA PAGBAYAD", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        const start = loan.approvedAt? new Date(loan.approvedAt).toLocaleDateString('en-PH') : '___';
        const end = loan.dueDate? new Date(loan.dueDate).toLocaleDateString('en-PH') : '___';
        doc.text(`The term of this loan shall be for a period of ${loan.loanTermMonths} months ONLY, commencing on ${start} and ending on ${end}`, 20, y, {maxWidth: 170});

        y+=18; doc.setFont("helvetica", "bold"); doc.text("4. PAYMENT SCHEDULE / ESKEDYUL SA BAYAD", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        doc.text(`The Borrower shall pay the Lender according to the following schedule: Monthly`, 20, y, {maxWidth: 170});

        y+=12; doc.setFont("helvetica", "bold"); doc.text("5. MODE OF PAYMENT", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        doc.text(`All payments shall be made in cash, GCash, or bank transfer to the Lender. Official receipt or proof of payment shall be provided.`, 20, y, {maxWidth: 170});

        y+=18; doc.setFont("helvetica", "bold"); doc.text("6. DEFAULT / DILI PAGBAYAD", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        doc.text(`Should the Borrower default or fail to pay the full amount within the term, the Lender shall have the right to demand full payment and may take legal action. The Borrower shall be liable for attorney's fees, litigation expenses, and other costs of collection. And a 300 pesos for the late payment penalty.`, 20, y, {maxWidth: 170});

        y+=30; doc.setFont("helvetica", "bold"); doc.text("7. ENTIRE AGREEMENT", 20, y);
        doc.setFont("helvetica", "normal"); y+=6;
        doc.text(`This Agreement constitutes the entire agreement between the parties and supersedes all prior agreements. Any modification must be in writing and signed by both parties.`, 20, y, {maxWidth: 170});

        y+=20;
        doc.text(`IN WITNESS WHEREOF, the parties have hereunto set their hands this ___ day of ___________ ${year}.`, 20, y, {maxWidth: 170});

        y+=25;
        doc.text("LENDER:", 25, y); doc.text("BORROWER:", 115, y); y+=5;
        doc.line(25, y, 90, y); doc.line(115, y, 180, y); y+=5;
        doc.text("Rolando G. Buta Jr.", 25, y);
        doc.text(loan.applicantName || '________________', 115, y);
        y+=5; doc.setFontSize(8);
        doc.text("(Signature over Printed Name)", 25, y);
        doc.text("(Signature over Printed Name)", 115, y);
        y+=5;
        doc.text("Date: ___________", 25, y);
        doc.text("Date: ___________", 115, y);

        if(loan.signatureData) {
            try {
                doc.addImage(loan.signatureData, 'PNG', 115, y-15, 50, 15);
            } catch(e) { console.log("Signature add failed", e) }
        }

        doc.save(`Loan_Agreement_${(loan.applicantName || 'Borrower').replace(/\s/g, '_')}.pdf`);
        alert("PDF Downloaded Successfully!");

    } catch(err) {
        console.error(err);
        alert("Failed to generate PDF: " + err.message);
    }
}

// PAYMENT APPROVAL FUNCTIONS
function viewPaymentProof(paymentId) {
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

function closePaymentProofModal() {
    document.getElementById('paymentProofModal').classList.remove('active');
    currentViewPayment = null;
}

// FIXED: AUTO +1 MONTH DUE DATE PAG APPROVE
async function approvePayment(paymentId = null) {
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
        let newLoanStatus = loan.status;
        if(newPaidMonths >= loan.loanTermMonths){ newLoanStatus = 'Settled'; }

        const currentDue = new Date(loan.dueDate);
        const nextDueDate = new Date(currentDue);
        nextDueDate.setMonth(currentDue.getMonth() + 1); // +1 MONTH

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

async function rejectPayment(paymentId = null) {
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

function handleLogout() {
    if (confirm("Are you sure you want to logout?")) {
        window.auth.signOut().then(() => { window.location.href = "admin-login.html"; });
    }
}