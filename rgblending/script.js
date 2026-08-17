// ==========================================
// FIREBASE INITIALIZATION & MODULE IMPORTS
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDnlad9nhop6okzaTGiwpWUaVnmKSJYtQI",
    authDomain: "rgblending1124.firebaseapp.com",
    projectId: "rgblending1124",
    storageBucket: "rgblending1124.firebasestorage.app",
    messagingSenderId: "273189271408",
    appId: "1:273189271408:web:48a0f1d078d1f4c93d01b5",
    measurementId: "G-FXJ83ZDM5H"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ==========================================
// GLOBAL STATE VARIABLES
// ==========================================
let loanRecords = [];
let currentFilter = 'ALL';
let isPrivacyMode = true; 
let editingRecordId = null;
let currentModalPayments = []; // Isolated state for modal editing

// ==========================================
// FIREBASE AUTHENTICATION LOGIC
// ==========================================
async function handleLogin(event) {
    if (event) event.preventDefault();

    const emailInput = document.getElementById('username')?.value.trim();
    const passwordInput = document.getElementById('password')?.value.trim();

    if (!emailInput || !passwordInput) {
        showLoginError("Paki-lagay ang Email at Password, boss!");
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, emailInput, passwordInput);
    } catch (error) {
        console.error("Login Error:", error);
        showLoginError("Maling Email o Password, boss!");
    }
}

function showLoginError(msg) {
    const errorToast = document.getElementById('loginError');
    if (errorToast) {
        errorToast.innerText = msg;
        errorToast.style.display = 'block';
    } else {
        alert(msg);
    }
}

async function logout() {
    try {
        await signOut(auth);
        alert("Naka-logout ka na, boss!");
    } catch (error) {
        console.error("Logout Error:", error);
    }
}

onAuthStateChanged(auth, (user) => {
    const loginOverlay = document.getElementById('loginOverlay');
    const mainContainer = document.getElementById('mainContainer');

    if (user) {
        if (loginOverlay) loginOverlay.style.display = 'none';
        if (mainContainer) mainContainer.style.display = 'block';
        subscribeToFirestore();
    } else {
        if (loginOverlay) loginOverlay.style.display = 'flex';
        if (mainContainer) mainContainer.style.display = 'none';
    }
});

// ==========================================
// FIRESTORE REAL-TIME LISTENER
// ==========================================
function subscribeToFirestore() {
    const loanCollection = collection(db, "loanRecords");
    
    onSnapshot(loanCollection, (snapshot) => {
        loanRecords = [];
        snapshot.forEach((doc) => {
            loanRecords.push(doc.data());
        });
        
        renderTable();
        updateDashboardSummary();
        checkAndShowNotifications();
    }, (error) => {
        console.error("Firestore Subscription Error:", error);
    });
}

// ==========================================
// COMPUTATION & CORE UTILITIES
// ==========================================
function calculateTotals(record) {
    const principal = parseFloat(record.amount) || 0;
    const interestPercent = parseFloat(record.interest) || 0;
    const interestAmount = principal * (interestPercent / 100);
    const totalBalance = principal + interestAmount;

    let totalPaid = 0;
    if (record.payments && Array.isArray(record.payments)) {
        totalPaid = record.payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
    }

    const remainingBalance = Math.max(0, totalBalance - totalPaid);

    return { principal, interestAmount, totalBalance, totalPaid, remainingBalance };
}

function autoComputeStatus(record) {
    const totals = calculateTotals(record);
    const today = new Date().toISOString().split('T')[0];

    if (totals.remainingBalance <= 0) return 'Paid';
    if (record.dueDate && record.dueDate < today) return 'Overdue';
    return 'In-Progress';
}

function calculateDaysLeft(dueDateStr, isPaid = false) {
    if (!dueDateStr) return { text: '-', style: '' };
    if (isPaid) return { text: 'Paid Off', style: 'background: #27ae60; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75em; display: inline-block; margin-top: 3px;' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);

    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return { text: 'Due Today', style: 'background: #e67e22; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75em; display: inline-block; margin-top: 3px;' };
    } else if (diffDays > 0) {
        return { text: `${diffDays} day(s) left`, style: 'background: #27ae60; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75em; display: inline-block; margin-top: 3px;' };
    } else {
        return { text: `${Math.abs(diffDays)} day(s) overdue`, style: 'background: #c0392b; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75em; display: inline-block; margin-top: 3px;' };
    }
}

function formatCurrency(num) {
    return '₱' + parseFloat(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ==========================================
// UI RENDERERS & DASHBOARD
// ==========================================
function renderTable() {
    const tbody = document.getElementById('recordsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';

    const filtered = loanRecords.filter(r => {
        const matchesSearch = (r.name || '').toLowerCase().includes(searchTerm) || 
                              (r.contact || '').toLowerCase().includes(searchTerm);
        
        const calculatedStatus = autoComputeStatus(r);
        const filterKey = currentFilter.toUpperCase();

        let matchesFilter = false;

        if (filterKey === 'ALL') {
            matchesFilter = true;
        } else if (filterKey === 'ACTIVE') {
            matchesFilter = (calculatedStatus === 'In-Progress' || calculatedStatus === 'Overdue');
        } else if (filterKey === 'OVERDUE') {
            matchesFilter = (calculatedStatus === 'Overdue');
        } else if (filterKey === 'PAID' || filterKey === 'SETTLED') {
            matchesFilter = (calculatedStatus === 'Paid');
        } else {
            matchesFilter = calculatedStatus.toUpperCase() === filterKey;
        }

        return matchesSearch && matchesFilter;
    });

    const countElem = document.getElementById('recordCount');
    if (countElem) countElem.innerText = `${filtered.length} record(s) found`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding: 20px;">Walang nakitang records, boss.</td></tr>`;
        return;
    }

    filtered.forEach(r => {
        const totals = calculateTotals(r);
        const calculatedStatus = autoComputeStatus(r);
        const isPaid = calculatedStatus === 'Paid';
        const daysLeftInfo = calculateDaysLeft(r.dueDate, isPaid);

        let statusBadgeClass = 'status-in-progress';
        if (calculatedStatus === 'Overdue') statusBadgeClass = 'status-overdue';
        if (calculatedStatus === 'Paid') statusBadgeClass = 'status-paid';

        let paymentsSummary = (r.payments || [])
            .map(p => `<span style="color:#27ae60;">📅 ${p.date}:</span> ${formatCurrency(p.amount)}`)
            .join('<br>') || '<span style="color:#95a5a6;">No payments recorded</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${r.name || ''}</strong><br><small style="color:#7f8c8d">${r.id}</small></td>
            <td>${r.contact || 'N/A'}</td>
            <td>${formatCurrency(totals.principal)}</td>
            <td>${r.interest}%</td>
            <td>${formatCurrency(totals.interestAmount)}</td>
            <td><strong>${formatCurrency(totals.totalBalance)}</strong></td>
            <td style="color:#27ae60;">${formatCurrency(totals.totalPaid)}</td>
            <td style="color:#e74c3c; font-weight:bold;">${formatCurrency(totals.remainingBalance)}</td>
            <td>
                <div><small>Start: ${r.startDate || '-'}</small></div>
                <div>Due: ${r.dueDate || '-'}</div>
                <span style="${daysLeftInfo.style}">${daysLeftInfo.text}</span>
            </td>
            <td><span class="badge ${statusBadgeClass}">${calculatedStatus}</span></td>
            <td><small>${paymentsSummary}</small></td>
            <td style="text-align: center;">
                <button class="btn-action edit" onclick="openModal('${r.id}')">✏️ Edit</button>
                <button class="btn-action delete" onclick="deleteRecord('${r.id}')">🗑️ Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateDashboardSummary() {
    let grandTotalPrincipal = 0;
    let grandTotalInterest = 0;
    let activeAccountsCount = 0;

    loanRecords.forEach(r => {
        const totals = calculateTotals(r);
        const currentStatus = autoComputeStatus(r);

        if (currentStatus !== 'Paid') {
            grandTotalPrincipal += totals.remainingBalance;
            grandTotalInterest += totals.interestAmount;
            activeAccountsCount++;
        }
    });

    const elOwed = document.getElementById('totalOwed');
    const elInterest = document.getElementById('totalInterest');
    const elCount = document.getElementById('totalCount');

    if (elOwed) {
        elOwed.setAttribute('data-value', formatCurrency(grandTotalPrincipal));
        elOwed.innerText = isPrivacyMode ? '••••••' : formatCurrency(grandTotalPrincipal);
    }
    if (elInterest) {
        elInterest.setAttribute('data-value', formatCurrency(grandTotalInterest));
        elInterest.innerText = isPrivacyMode ? '••••••' : formatCurrency(grandTotalInterest);
    }
    if (elCount) elCount.innerText = activeAccountsCount;
}

function togglePrivacy(elementId) {
    isPrivacyMode = !isPrivacyMode;
    const targetElem = document.getElementById(elementId);
    if (targetElem) {
        const actualValue = targetElem.getAttribute('data-value') || '₱0.00';
        targetElem.innerText = isPrivacyMode ? '••••••' : actualValue;
    }
}

function checkAndShowNotifications() {
    const today = new Date().toISOString().split('T')[0];
    const overdueList = loanRecords.filter(r => r.dueDate < today && autoComputeStatus(r) !== 'Paid');
    
    const notifBadge = document.getElementById('notifBadge');
    const notifPanelBadge = document.getElementById('notifPanelBadge');
    const notifBody = document.getElementById('notifBody');

    if (notifBadge) notifBadge.innerText = overdueList.length;
    if (notifPanelBadge) notifPanelBadge.innerText = overdueList.length;

    if (notifBody) {
        notifBody.innerHTML = '';
        if (overdueList.length === 0) {
            notifBody.innerHTML = '<p style="padding:15px; color:#7f8c8d; text-align:center;">Walang overdue loans sa ngayon, boss!</p>';
            return;
        }

        overdueList.forEach(r => {
            const totals = calculateTotals(r);
            const item = document.createElement('div');
            item.style.cssText = 'padding:10px; border-bottom:1px solid #eee; font-size:0.9em;';
            item.innerHTML = `
                <strong style="color:#c0392b;">${r.name}</strong> - Overdue (${r.dueDate})<br>
                Balance: <strong>${formatCurrency(totals.remainingBalance)}</strong>
            `;
            notifBody.appendChild(item);
        });
    }
}

function toggleNotifPanel() {
    const panel = document.getElementById('notifPanel');
    if (panel) panel.classList.toggle('hidden');
}

function filterRecords(type, element) {
    currentFilter = type;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (element) element.classList.add('active');
    renderTable();
}

// ==========================================
// MODAL & CRUD FIRESTORE OPERATIONS
// ==========================================
function openModal(mode = 'add') {
    const modal = document.getElementById('loanModal');
    const title = document.getElementById('modalTitle');
    const btnAdd = document.getElementById('btnAddSubmit');
    const btnUpdate = document.getElementById('btnUpdate');

    if (!modal) return;

    if (mode !== 'add') {
        editingRecordId = mode;
        if (title) title.innerText = 'Edit Loan Record';
        if (btnAdd) btnAdd.style.display = 'none';
        if (btnUpdate) btnUpdate.style.display = 'inline-block';

        const rec = loanRecords.find(r => r.id === mode);
        if (rec) {
            document.getElementById('recordId').value = rec.id || '';
            document.getElementById('borrowerName').value = rec.name || '';
            document.getElementById('borrowerContact').value = rec.contact || '';
            document.getElementById('loanAmount').value = rec.amount || 0;
            document.getElementById('interestRate').value = rec.interest || 0;
            document.getElementById('startDate').value = rec.startDate || '';
            document.getElementById('dueDate').value = rec.dueDate || '';
            if (document.getElementById('paymentStatus')) {
                document.getElementById('paymentStatus').value = rec.status || 'In-Progress';
            }

            currentModalPayments = rec.payments ? [...rec.payments] : [];
            calculateModalInterest();
            renderPaymentHistoryList(currentModalPayments);
        }
    } else {
        editingRecordId = null;
        currentModalPayments = [];
        if (title) title.innerText = 'Add New Loan Record';
        if (btnAdd) btnAdd.style.display = 'inline-block';
        if (btnUpdate) btnUpdate.style.display = 'none';

        document.getElementById('loanForm').reset();
        document.getElementById('interestAmount').value = '₱0.00';
        renderPaymentHistoryList([]);
    }

    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('loanModal');
    if (modal) modal.style.display = 'none';
    editingRecordId = null;
    currentModalPayments = [];
}

function calculateModalInterest() {
    const amount = parseFloat(document.getElementById('loanAmount')?.value) || 0;
    const rate = parseFloat(document.getElementById('interestRate')?.value) || 0;
    const interestAmt = amount * (rate / 100);
    
    const interestInput = document.getElementById('interestAmount');
    if (interestInput) interestInput.value = formatCurrency(interestAmt);
}

function renderPaymentHistoryList(payments = []) {
    const wrapper = document.getElementById('paymentHistoryListWrapper');
    if (!wrapper) return;
    
    wrapper.innerHTML = '';
    if (payments.length === 0) {
        wrapper.innerHTML = '<span style="color:#999; font-size:0.85em;">Walang naka-save na bayad.</span>';
        return;
    }

    payments.forEach((p, idx) => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; font-size:0.85em;';
        div.innerHTML = `
            <span>📅 ${p.date} - <strong>${formatCurrency(p.amount)}</strong></span>
            <button type="button" onclick="removeSinglePayment(${idx})" style="background:#e74c3c; color:white; border:none; padding:2px 6px; border-radius:3px; cursor:pointer;">&times;</button>
        `;
        wrapper.appendChild(div);
    });
}

function addNewPaymentRow() {
    const payDate = document.getElementById('payDate')?.value;
    const payAmount = parseFloat(document.getElementById('payAmount')?.value) || 0;

    if (!payDate || payAmount <= 0) {
        alert('Paki-lagay ang tamang petsa at halaga ng bayad, boss!');
        return;
    }

    currentModalPayments.push({ date: payDate, amount: payAmount });
    
    document.getElementById('payDate').value = '';
    document.getElementById('payAmount').value = '';

    renderPaymentHistoryList(currentModalPayments);
}

function removeSinglePayment(index) {
    currentModalPayments.splice(index, 1);
    renderPaymentHistoryList(currentModalPayments);
}

async function saveSingleRecordToFirebase(e) {
    e.preventDefault();

    const name = document.getElementById('borrowerName').value.trim();
    const contact = document.getElementById('borrowerContact').value.trim();
    const amount = parseFloat(document.getElementById('loanAmount').value) || 0;
    const interest = parseFloat(document.getElementById('interestRate').value) || 0;
    const startDate = document.getElementById('startDate').value;
    const dueDate = document.getElementById('dueDate').value;
    const manualStatus = document.getElementById('paymentStatus')?.value || 'In-Progress';

    const id = editingRecordId ? editingRecordId : 'RGB-' + Date.now();

    const recordData = {
        id,
        name,
        contact,
        amount,
        interest,
        startDate,
        dueDate,
        status: manualStatus,
        payments: currentModalPayments
    };

    recordData.status = autoComputeStatus(recordData);

    try {
        await setDoc(doc(db, "loanRecords", id), recordData);
        alert('Matagumpay na nai-save sa Firebase, boss!');
        closeModal();
    } catch (error) {
        console.error("Error saving document: ", error);
        alert('Nagkaroon ng error sa pag-save, boss.');
    }
}

async function deleteRecord(id) {
    if (confirm('Sigurado ka bang gusto mong burahin ang record na ito, boss?')) {
        try {
            await deleteDoc(doc(db, "loanRecords", id));
            alert('Nababura na ang record sa Firebase, boss!');
        } catch (error) {
            console.error("Error deleting document: ", error);
            alert('Failed to delete record.');
        }
    }
}

// ==========================================
// CSV EXPORT & IMPORT
// ==========================================
function exportToCSV() {
    if (loanRecords.length === 0) { alert('Walang data na pwedeng i-export.'); return; }
    
    let csvContent = "\uFEFF" + "ID,Borrower Name,Contact Number,Loan Amount,Interest Rate,Start Date,Due Date,Status,PaymentsJSON\r\n";
    
    loanRecords.forEach(r => {
        const paymentsEscaped = JSON.stringify(r.payments || []).replace(/"/g, '""');
        const cleanName = (r.name || '').replace(/"/g, '""');
        const cleanContact = (r.contact || 'N/A').replace(/"/g, '""');
        
        csvContent += `"${r.id}","${cleanName}","${cleanContact}",${r.amount},${r.interest},"${r.startDate}","${r.dueDate}","${r.status}","${paymentsEscaped}"\r\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); 
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `RGB_Lending_Backup_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
}

function parseFullCSVText(text) {
    let lines = [];
    let currentLine = [];
    let currentField = '';
    let insideQuotes = false;

    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < cleanText.length; i++) {
        let char = cleanText[i];
        let nextChar = cleanText[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentField += '"';
                i++; 
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            currentLine.push(currentField);
            currentField = '';
        } else if (char === '\n' && !insideQuotes) {
            currentLine.push(currentField);
            lines.push(currentLine);
            currentLine = [];
            currentField = '';
        } else {
            currentField += char;
        }
    }
    
    if (currentField || currentLine.length > 0) {
        currentLine.push(currentField);
        lines.push(currentLine);
    }

    return lines;
}

async function importCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const allParsedRows = parseFullCSVText(text);
        
        let importedCount = 0;
        let batch = writeBatch(db); 
        let batchOps = 0;

        for (let i = 1; i < allParsedRows.length; i++) {
            const columns = allParsedRows[i];
            if (columns.length < 8 || (columns.length === 1 && columns[0] === '')) continue;

            const id = columns[0].trim();
            const name = columns[1].trim();
            const contact = columns[2].trim(); 
            const amount = parseFloat(columns[3]) || 0;
            const interest = parseFloat(columns[4]) || 0;
            const startDate = columns[5].trim();
            const dueDate = columns[6].trim();
            const status = columns[7].trim();
            
            let payments = [];
            if (columns[8]) {
                try {
                    payments = JSON.parse(columns[8].trim());
                } catch(err) { payments = []; }
            }

            const docRef = doc(db, "loanRecords", id);
            batch.set(docRef, { id, name, contact, amount, interest, startDate, dueDate, status, payments });
            importedCount++;
            batchOps++;

            if (batchOps === 450) {
                await batch.commit();
                batch = writeBatch(db);
                batchOps = 0;
            }
        }

        if (importedCount > 0) {
            if (batchOps > 0) await batch.commit(); 
            alert(`Salamat, boss! Matagumpay na na-import ang ${importedCount} records papuntang Firebase!`);
        } else {
            alert('Maling CSV format ang na-upload, boss.');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
}

// ==========================================
// WINDOW EXPORTS
// ==========================================
window.handleLogin = handleLogin;
window.logout = logout;
window.openModal = openModal;
window.closeModal = closeModal;
window.addNewPaymentRow = addNewPaymentRow;
window.removeSinglePayment = removeSinglePayment;
window.deleteRecord = deleteRecord;
window.filterRecords = filterRecords;
window.togglePrivacy = togglePrivacy;
window.toggleNotifPanel = toggleNotifPanel;
window.exportToCSV = exportToCSV;
window.importCSV = importCSV;

// ==========================================
// EVENT LISTENERS INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const loanForm = document.getElementById('loanForm');
    if (loanForm) loanForm.addEventListener('submit', saveSingleRecordToFirebase);

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', renderTable);

    const loanAmountInput = document.getElementById('loanAmount');
    const interestRateInput = document.getElementById('interestRate');

    if (loanAmountInput) loanAmountInput.addEventListener('input', calculateModalInterest);
    if (interestRateInput) interestRateInput.addEventListener('input', calculateModalInterest);
});
