/**
 * RGB Lending System - Core Production Engine (Firebase Firestore Edition - FIXED & STABLE)
 * Updated with Dynamic Days & Due Date Sorting Engine
 */

let loanRecords = [];
let currentPaymentsArray = []; 
let currentActiveFilter = 'ALL';
let currentSortOrder = 'asc'; // 'asc' = Most Urgent/Overdue First, 'desc' = Farther Due Dates First
let privacyState = {
    totalOwed: true,
    totalInterest: true
};

// DOM Elements
const loginOverlay = document.getElementById('loginOverlay');
const mainContainer = document.getElementById('mainContainer');
const loanModal = document.getElementById('loanModal'); 
const loanForm = document.getElementById('loanForm');
const modalTitle = document.getElementById('modalTitle');
const btnUpdate = document.getElementById('btnUpdate');
const btnAddSubmit = document.getElementById('btnAddSubmit');
const searchInput = document.getElementById('searchInput');
const recordsTableBody = document.getElementById('recordsTableBody');

const totalOwedEl = document.getElementById('totalOwed');
const totalInterestEl = document.getElementById('totalInterest');
const totalCountEl = document.getElementById('totalCount');
const recordCountEl = document.getElementById('recordCount');

const amountField = document.getElementById('loanAmount');
const rateField = document.getElementById('interestRate');
const calculatedInterestField = document.getElementById('interestAmount');
const contactField = document.getElementById('borrowerContact');

// Toast Container Initialization
const toastContainer = document.createElement('div');
toastContainer.className = 'fb-toast-container';
document.body.appendChild(toastContainer);

// ==========================================
// DAYS CALCULATOR & SORTING HELPER ENGINE
// ==========================================

/**
 * Calculates days remaining or overdue for a given due date string (YYYY-MM-DD)
 * @param {string} dueDateStr 
 * @returns {number} Negative number = Overdue days, Positive = Days left, Infinity = Paid/No Date
 */
function getDaysDifference(dueDateStr) {
    if (!dueDateStr) return Infinity;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDateObj = new Date(dueDateStr);
    dueDateObj.setHours(0, 0, 0, 0);

    if (isNaN(dueDateObj.getTime())) return Infinity;

    const timeDiff = dueDateObj.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

/**
 * Sorts array of loan records based on remaining or overdue days
 * @param {Array} recordsArray 
 * @param {string} order - 'asc' (Most Urgent / Overdue first) or 'desc' (Farther due dates first)
 * @returns {Array} Sorted array
 */
function sortRecordsByDaysArray(recordsArray, order = 'asc') {
    return [...recordsArray].sort((a, b) => {
        // Paid records are placed at the bottom when sorting by urgency
        if (a.status === 'Paid' && b.status !== 'Paid') return 1;
        if (a.status !== 'Paid' && b.status === 'Paid') return -1;

        const daysA = getDaysDifference(a.dueDate);
        const daysB = getDaysDifference(b.dueDate);

        if (order === 'asc') {
            return daysA - daysB; // Overdue (-days) comes first, then 0 (due today), then positive days
        } else {
            return daysB - daysA; // Largest positive days first
        }
    });
}

/**
 * Public trigger to sort and re-render current view
 * @param {string} order - 'asc' or 'desc'
 */
function sortByDays(order = 'asc') {
    currentSortOrder = order;
    applyFiltersAndRender();
}
window.sortByDays = sortByDays;

/**
 * Toggles current sort order between ASC and DESC
 */
function toggleSortByDays() {
    currentSortOrder = (currentSortOrder === 'asc') ? 'desc' : 'asc';
    sortByDays(currentSortOrder);
}
window.toggleSortByDays = toggleSortByDays;


// Global UI Calculations & Toggles
function handleStatusFieldToggle() {
    const statusField = document.getElementById('paymentStatus');
    const dueDateField = document.getElementById('dueDate');
    
    if (!statusField || !dueDateField) return;
    
    if (statusField.value === 'Paid') {
        dueDateField.disabled = true;
        dueDateField.style.backgroundColor = '#e0e0e0';
        dueDateField.style.opacity = '0.6';
        dueDateField.style.cursor = 'not-allowed';
    } else {
        dueDateField.disabled = false;
        dueDateField.style.backgroundColor = '';
        dueDateField.style.opacity = '';
        dueDateField.style.cursor = '';
    }
}
window.handleStatusFieldToggle = handleStatusFieldToggle;

function autoCalculateMonthlyInterest() {
    if (!amountField || !rateField || !calculatedInterestField) return;
    const amount = parseFloat(amountField.value) || 0;
    const rate = parseFloat(rateField.value) || 0;
    const computedInterest = amount * (rate / 100);
    
    if (computedInterest > 0) {
        calculatedInterestField.value = "₱" + computedInterest.toLocaleString(undefined, {minimumFractionDigits: 2});
    } else {
        calculatedInterestField.value = "";
    }
}

function autoCalculateDueDate() {
    const startDateField = document.getElementById('startDate');
    const dueDateField = document.getElementById('dueDate');
    const statusField = document.getElementById('paymentStatus');
    
    if (!startDateField || !startDateField.value || !dueDateField || (statusField && statusField.value === 'Paid')) return;
    
    const releaseDate = new Date(startDateField.value);
    releaseDate.setMonth(releaseDate.getMonth() + 1);
    const year = releaseDate.getFullYear();
    const month = String(releaseDate.getMonth() + 1).padStart(2, '0');
    const day = String(releaseDate.getDate()).padStart(2, '0');

    dueDateField.value = `${year}-${month}-${day}`;
}

if (amountField && rateField) {
    amountField.addEventListener('input', autoCalculateMonthlyInterest);
    rateField.addEventListener('input', autoCalculateMonthlyInterest);
}

const startDateField = document.getElementById('startDate');
if (startDateField) {
    startDateField.addEventListener('change', autoCalculateDueDate);
}

const statusDropdown = document.getElementById('paymentStatus');
if (statusDropdown) {
    statusDropdown.addEventListener('change', handleStatusFieldToggle);
}

// Payment Sub-form Management
async function addNewPaymentRow() {
    const dateInput = document.getElementById('payDate');
    const amountInput = document.getElementById('payAmount');

    if (!dateInput || !dateInput.value || !amountInput || !amountInput.value || parseFloat(amountInput.value) <= 0) {
        alert('Mangyaring ilagay ang tamang Date at Amount ng bayad, boss.');
        return;
    }
    currentPaymentsArray.push({
        date: dateInput.value,
        amount: parseFloat(amountInput.value)
    });

    amountInput.value = '';
    renderPaymentHistoryInModal();
    
    const recordIdEl = document.getElementById('recordId');
    const recordId = recordIdEl ? String(recordIdEl.value).trim() : '';
    if (recordId) {
        const index = loanRecords.findIndex(r => String(r.id).trim() === recordId);
        if (index !== -1 && loanRecords[index].docId) {
            loanRecords[index].payments = [...currentPaymentsArray];
            await updateFirebaseRecord(loanRecords[index].docId, { payments: [...currentPaymentsArray] });
        }
    }
}
window.addNewPaymentRow = addNewPaymentRow;

async function removePaymentRow(index) {
    currentPaymentsArray.splice(index, 1);
    renderPaymentHistoryInModal();
    
    const recordIdEl = document.getElementById('recordId');
    const recordId = recordIdEl ? String(recordIdEl.value).trim() : '';
    if (recordId) {
        const loanIndex = loanRecords.findIndex(r => String(r.id).trim() === recordId);
        if (loanIndex !== -1 && loanRecords[loanIndex].docId) {
            loanRecords[loanIndex].payments = [...currentPaymentsArray];
            await updateFirebaseRecord(loanRecords[loanIndex].docId, { payments: [...currentPaymentsArray] });
        }
    }
}
window.removePaymentRow = removePaymentRow;

function renderPaymentHistoryInModal() {
    const container = document.getElementById('paymentHistoryListWrapper');
    if (!container) return;

    if (currentPaymentsArray.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#95a5a6; font-size:0.85em; padding:10px 0;">Walang nakatalang kasaysayan ng bayad.</div>`;
        return;
    }

    currentPaymentsArray.sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = '';
    currentPaymentsArray.forEach((pay, index) => {
        const itemRow = document.createElement('div');
        itemRow.style = "display:flex; justify-content:space-between; align-items:center; background:white; padding:6px 10px; border-radius:4px; margin-bottom:6px; border:1px solid #e0e0e0; font-size:0.85em;";
        itemRow.innerHTML = `
            <div>📅 <strong>${pay.date}</strong> &nbsp;|&nbsp; 💰 <span style="color:#27ae60; font-weight:bold;">₱${pay.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
            <button type="button" onclick="removePaymentRow(${index})" style="background:#e74c3c; color:white; padding:3px 8px; font-size:0.8em; border-radius:3px; border:none; cursor:pointer;">Burahin</button>
        `;
        container.appendChild(itemRow);
    });
}

// Protected Status Overrides Engine
async function checkAndAutoUpdateStatuses() {
    const today = new Date();
    today.setHours(0,0,0,0);

    for (let record of loanRecords) {
        const computedInterest = record.amount * (record.interest / 100);
        const totalDue = record.amount + computedInterest;
        const totalPaidSoFar = record.payments ? record.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
        const isFullyPaid = totalPaidSoFar >= totalDue;

        let newStatus = record.status;

        if (isFullyPaid) {
            if (record.status !== 'Paid') newStatus = 'Paid';
        } else {
            if (record.status === 'Paid') newStatus = 'In Progress';
            
            if (record.dueDate && newStatus !== 'In Progress' && newStatus !== 'Upcoming') {
                const dueDateObj = new Date(record.dueDate);
                dueDateObj.setHours(0,0,0,0);
                if (dueDateObj < today && newStatus !== 'Overdue') {
                    newStatus = 'Overdue';
                }
            }
        }

        if (newStatus !== record.status && record.docId) {
            record.status = newStatus;
            await updateFirebaseRecord(record.docId, { status: newStatus });
        }
    }
}

// Auth Handlers
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
}

function handleLogin(e) {
    e.preventDefault();
    const userField = document.getElementById('username');
    const passField = document.getElementById('password');
    const errorDiv = document.getElementById('loginError');

    if (userField && passField && userField.value === 'admin' && passField.value === 'rgb123') {
        if (errorDiv) errorDiv.style.display = 'none';
        if (loginOverlay) loginOverlay.style.display = 'none';
        if (mainContainer) mainContainer.style.display = 'block';
        
        setupFirebaseRealtimeListener(); 
    } else {
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.textContent = 'Maling username o password, boss!';
        }
    }
}

function logout() {
    if (confirm('Sigurado ka bang nais mong mag-logout?')) {
        if (mainContainer) mainContainer.style.display = 'none';
        if (loginOverlay) loginOverlay.style.display = 'flex';
    }
}
window.logout = logout;

// Modal Configuration
function openModal(mode = 'add', recordId = null) {
    if (loanForm) loanForm.reset(); 
    
    currentPaymentsArray = [];
    const payDateInput = document.getElementById('payDate');
    if (payDateInput) payDateInput.value = new Date().toISOString().slice(0, 10);
    if (calculatedInterestField) calculatedInterestField.value = '';

    const hiddenIdInput = document.getElementById('recordId');
    if (hiddenIdInput) hiddenIdInput.value = '';

    if (mode === 'add') {
        if (modalTitle) modalTitle.textContent = 'Add New Loan Record';
        if (btnUpdate) btnUpdate.style.display = 'none';
        if (btnAddSubmit) btnAddSubmit.style.display = 'block';
        renderPaymentHistoryInModal();
    } else if (mode === 'edit') {
        if (modalTitle) modalTitle.textContent = 'Edit Loan Record';
        if (btnUpdate) btnUpdate.style.display = 'block';
        if (btnAddSubmit) btnAddSubmit.style.display = 'none';
        
        if (recordId) {
            if (hiddenIdInput) hiddenIdInput.value = String(recordId).trim();
            populateForm(String(recordId).trim()); 
        }
    }

    handleStatusFieldToggle();
    if (loanModal) loanModal.style.display = 'flex'; 
    document.body.style.overflow = 'hidden'; 
}
window.openModal = openModal;

function closeModal() {
    if (loanModal) loanModal.style.display = 'none';
    document.body.style.overflow = 'auto'; 
}
window.closeModal = closeModal;

window.addEventListener('click', function(e) {
    if (e.target === loanModal) closeModal();
});

// ==========================================
// FIREBASE FIRESTORE DATA CONTROLLERS
// ==========================================

function setupFirebaseRealtimeListener() {
    if (!window.db || !window.firestoreTools) {
        alert("⚠️ Hindi pa nakakonekta sa Firebase! Paki-check ang Firebase script sa dulo ng iyong HTML.");
        return;
    }
    const { collection, onSnapshot } = window.firestoreTools;
    const recordsCol = collection(window.db, "loan_records");

    onSnapshot(recordsCol, (snapshot) => {
        loanRecords = [];
        snapshot.forEach((docSnap) => {
            loanRecords.push({ docId: docSnap.id, ...docSnap.data() });
        });

        checkAndAutoUpdateStatuses();
        updateDashboard();
        applyFiltersAndRender();
        checkNotifications();
    }, (error) => {
        console.error("Firebase Sync Error:", error);
        alert("Error sa pag-connect sa Firebase: " + error.message);
    });
}

async function addFirebaseRecord(recordData) {
    if (!window.db || !window.firestoreTools) {
        alert("Error: Walang koneksyon sa Firebase DB.");
        return;
    }
    const { collection, addDoc } = window.firestoreTools;
    return await addDoc(collection(window.db, "loan_records"), recordData);
}

async function updateFirebaseRecord(docId, updatedFields) {
    if (!window.db || !window.firestoreTools) return;
    const { doc, updateDoc } = window.firestoreTools;
    const docRef = doc(window.db, "loan_records", docId);
    return await updateDoc(docRef, updatedFields);
}

async function deleteFirebaseRecord(docId) {
    if (!window.db || !window.firestoreTools) return;
    const { doc, deleteDoc } = window.firestoreTools;
    await deleteDoc(doc(window.db, "loan_records", docId));
}

function populateForm(id) {
    const record = loanRecords.find(r => String(r.id).trim() === String(id).trim());
    if (!record) return;

    if (document.getElementById('borrowerName')) document.getElementById('borrowerName').value = record.name;
    if (contactField) contactField.value = record.contact || ''; 
    if (document.getElementById('loanAmount')) document.getElementById('loanAmount').value = record.amount;
    if (document.getElementById('interestRate')) document.getElementById('interestRate').value = record.interest;
    if (document.getElementById('startDate')) document.getElementById('startDate').value = record.startDate;
    if (document.getElementById('dueDate')) document.getElementById('dueDate').value = record.dueDate;
    if (document.getElementById('paymentStatus')) document.getElementById('paymentStatus').value = record.status;
    
    currentPaymentsArray = record.payments ? [...record.payments] : [];
    
    autoCalculateMonthlyInterest();
    renderPaymentHistoryInModal();
    handleStatusFieldToggle();
}

// Global Form Submission Pipeline with Direct Feedback
async function handleLoanSubmit(e) {
    if (e) e.preventDefault();
    
    const borrowerNameEl = document.getElementById('borrowerName');
    const amountEl = document.getElementById('loanAmount');
    
    if (!borrowerNameEl || !borrowerNameEl.value.trim() || !amountEl || !amountEl.value) {
        alert('Mangyaring punan ang Borrower Name at Loan Amount, boss.');
        return false;
    }

    const recordId = document.getElementById('recordId').value ? String(document.getElementById('recordId').value).trim() : "";
    const selectedStatus = document.getElementById('paymentStatus').value;
    const borrowerName = borrowerNameEl.value.trim();
    const borrowerContactStr = contactField ? contactField.value.trim() : ''; 
    
    const recordData = {
        name: borrowerName,
        contact: borrowerContactStr || 'N/A', 
        amount: parseFloat(amountEl.value) || 0,
        interest: parseFloat(document.getElementById('interestRate').value) || 0,
        startDate: document.getElementById('startDate').value,
        dueDate: document.getElementById('dueDate').value, 
        status: selectedStatus,
        payments: [...currentPaymentsArray]
    };

    if (selectedStatus === 'Paid') {
        const computedInterest = recordData.amount * (recordData.interest / 100);
        const totalDue = recordData.amount + computedInterest;
        const totalPaidSoFar = recordData.payments.reduce((sum, p) => sum + p.amount, 0);
        
        if (totalPaidSoFar < totalDue) {
            const remainingBalance = totalDue - totalPaidSoFar;
            recordData.payments.push({
                date: new Date().toISOString().slice(0, 10),
                amount: remainingBalance
            });
        }
    }

    try {
        if (recordId !== "") {
            const existingRecord = loanRecords.find(r => String(r.id).trim() === recordId);
            if (existingRecord && existingRecord.docId) {
                recordData.id = recordId;
                await updateFirebaseRecord(existingRecord.docId, recordData);
                alert(`Salamat, boss! Matagumpay na na-update ang record ni ${borrowerName}.`);
            } else {
                alert(`Error: Hindi mahanap ang Record ID (${recordId}) sa memory, boss.`);
                return false;
            }
        } else {
            let nextNumber = 1;
            if (loanRecords.length > 0) {
                const ids = loanRecords.map(r => {
                    if (r.id && String(r.id).startsWith('ID-')) {
                        return parseInt(String(r.id).replace('ID-', '')) || 0;
                    }
                    return 0;
                });
                nextNumber = Math.max(...ids, 0) + 1;
            }
            recordData.id = 'ID-' + String(nextNumber).padStart(3, '0');
            await addFirebaseRecord(recordData);
            alert(`Salamat, boss! Matagumpay na naidagdag si ${borrowerName} sa Firebase Database.`);
        }
        closeModal();
    } catch (err) {
        console.error("Save Error:", err);
        alert("Nagka-error sa pag-save: " + err.message);
    }
    return false;
}

window.handleLoanSubmit = handleLoanSubmit;

if (loanForm) {
    loanForm.onsubmit = handleLoanSubmit;
    loanForm.addEventListener('submit', handleLoanSubmit);
}

async function deleteRecord(id) {
    if (confirm('Sigurado ka bang nais mong burahin ang record na ito sa Firebase?')) {
        const record = loanRecords.find(r => String(r.id).trim() === String(id).trim());
        if (record && record.docId) {
            await deleteFirebaseRecord(record.docId);
            alert("Matagumpay na nabura ang record sa Firebase, boss!");
        }
    }
}
window.deleteRecord = deleteRecord;

// Rendering Pipeline
function renderTable(records) {
    if (!recordsTableBody) return;
    recordsTableBody.innerHTML = '';

    if (records.length === 0) {
        recordsTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:#7f8c8d;">Walang natagpuang record.</td></tr>`;
        if (recordCountEl) recordCountEl.textContent = '0 record(s) found';
        return;
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    records.forEach(record => {
        const tr = document.createElement('tr');
        const computedInterestAmount = record.amount * (record.interest / 100);
        const cleanStatusClass = record.status.toLowerCase().replace(/\s+/g, '').replace('-', '');
        const totalPaidSoFar = record.payments ? record.payments.reduce((sum, p) => sum + p.amount, 0) : 0;

        let historyHTML = '';
        if (record.payments && record.payments.length > 0) {
            const sortedPayments = [...record.payments].sort((a, b) => new Date(b.date) - new Date(a.date));
            sortedPayments.forEach(p => {
                historyHTML += `<div style="margin-bottom:4px; border-bottom:1px dashed #e0e0e0; padding-bottom:2px;">📅 ${p.date} - <span style="color:#27ae60; font-weight:bold;">₱${p.amount.toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>`;
            });
            historyHTML += `<div style="margin-top:6px; font-weight:bold; color:#2c3e50; font-size:0.95em;">Total Paid: ₱${totalPaidSoFar.toLocaleString(undefined, {minimumFractionDigits:2})}</div>`;
        } else {
            historyHTML = `<span style="color:#95a5a6; font-style:italic;">No payments recorded</span>`;
        }

        let dueDateDisplay = record.dueDate;
        if (record.status === 'Paid') {
            dueDateDisplay = `<span style="color:#7f8c8d; text-decoration: line-through;">${record.dueDate}</span> <br><small style="color:#27ae60; font-weight:bold;">(Settled)</small>`;
        } else if (record.dueDate) {
            const daysDiff = getDaysDifference(record.dueDate);

            if (daysDiff < 0) {
                const absDays = Math.abs(daysDiff);
                dueDateDisplay = `
                    <span class="highlight-overdue-date" style="display:block; text-align:center;">⚠️ ${record.dueDate}</span>
                    <small style="color:#e74c3c; font-weight:bold; display:block; text-align:center; margin-top:2px;">(${absDays} ${absDays === 1 ? 'day' : 'days'} Overdue)</small>
                `;
            } else if (daysDiff === 0) {
                dueDateDisplay = `
                    <span class="highlight-overdue-date" style="background-color:#fff3cd !important; color:#856404 !important; border-color:#ffeeba !important; display:block; text-align:center;">📅 ${record.dueDate}</span>
                    <small style="color:#856404; font-weight:bold; display:block; text-align:center; margin-top:2px;">(Due Today!)</small>
                `;
            } else {
                dueDateDisplay = `
                    <span style="font-weight:bold;">${record.dueDate}</span>
                    <small style="color:#2980b9; display:block; margin-top:2px;">(${daysDiff} ${daysDiff === 1 ? 'day' : 'days'} left)</small>
                `;
            }
        }

        tr.innerHTML = `
            <td data-label="Borrower Name & ID"><small style="opacity:0.7;">${record.id}</small><br><strong>${record.name}</strong> </td>
            <td data-label="Contact Number"><strong>${record.contact}</strong></td>
            <td data-label="Loan Amount (₱)">₱${record.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td data-label="Monthly Interest (%)">${record.interest}%</td>
            <td data-label="Month Interest Amount (₱)" style="color:#27ae60; font-weight:bold;">₱${computedInterestAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td data-label="Loan Released">${record.startDate}</td>
            <td data-label="Due Date">${dueDateDisplay}</td>
            <td data-label="Loan Status"><span class="status status-${cleanStatusClass}">${record.status}</span></td>
            <td data-label="Payment History & Notes" style="max-width:260px; font-size:0.82em; text-align:left; line-height:1.4;">${historyHTML}</td>
            <td data-label="Actions">
                <div style="display:flex; gap:5px; justify-content:center; width:100%;">
                    <button class="btn-edit" onclick="openModal('edit', '${record.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteRecord('${record.id}')">Del</button>
                </div>
            </td>
        `;
        recordsTableBody.appendChild(tr);
    });

    if (recordCountEl) recordCountEl.textContent = `${records.length} record(s) found`;
}

function updateDashboard() {
    let totalOwed = 0;
    let totalInterestRevenue = 0;

    loanRecords.forEach(r => {
        const computedInterest = r.amount * (r.interest / 100);
        const totalDue = r.amount + computedInterest;
        const totalPaid = r.payments ? r.payments.reduce((sum, p) => sum + p.amount, 0) : 0;

        if (r.status.trim().toLowerCase() !== 'paid') {
            const balanceLeft = totalDue - totalPaid;
            totalOwed += (balanceLeft > 0 ? balanceLeft : 0);
            totalInterestRevenue += computedInterest;
        }
    });
    const formattedOwed = '₱' + totalOwed.toLocaleString(undefined, {minimumFractionDigits: 2});
    const formattedInterest = '₱' + totalInterestRevenue.toLocaleString(undefined, {minimumFractionDigits: 2});

    if (totalOwedEl) {
        totalOwedEl.setAttribute('data-value', formattedOwed);
        totalOwedEl.textContent = privacyState.totalOwed ? "••••••" : formattedOwed;
    }
    
    if (totalInterestEl) {
        totalInterestEl.setAttribute('data-value', formattedInterest);
        totalInterestEl.textContent = privacyState.totalInterest ? "••••••" : formattedInterest;
    }

    if (totalCountEl) {
        totalCountEl.textContent = loanRecords.filter(r => r.status.trim().toLowerCase() !== 'paid').length;
    }
}

/**
 * Unified Filter, Search, Sort & Render Pipeline
 */
function applyFiltersAndRender() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const targetStatus = currentActiveFilter.trim().toLowerCase();

    // 1. Filter by status
    let result = loanRecords.filter(r => {
        const recordStatus = r.status.trim().toLowerCase();
        if (targetStatus === 'all') return true;
        if (targetStatus === 'active') return recordStatus !== 'paid';
        return recordStatus === targetStatus;
    });

    // 2. Filter by search query
    if (query) {
        result = result.filter(r => 
            r.name.toLowerCase().includes(query) || 
            r.id.toLowerCase().includes(query) ||
            r.status.toLowerCase().includes(query) ||
            (r.contact && r.contact.toLowerCase().includes(query)) 
        );
    }

    // 3. Sort by days/urgency
    const sortedResult = sortRecordsByDaysArray(result, currentSortOrder);

    // 4. Render to UI
    renderTable(sortedResult);
}

if (searchInput) {
    searchInput.addEventListener('input', applyFiltersAndRender);
}

function filterRecords(statusType, currentButton) {
    currentActiveFilter = statusType;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (currentButton) {
        currentButton.classList.add('active');
    }

    applyFiltersAndRender();
}
window.filterRecords = filterRecords;

// Security Display Toggles
function togglePrivacy(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const eyeBtn = element.nextElementSibling;
    const realValue = element.getAttribute('data-value') || "₱0.00";

    if (privacyState[elementId]) {
        element.textContent = realValue;
        privacyState[elementId] = false;
        element.style.letterSpacing = "normal";
        if (eyeBtn) {
            eyeBtn.textContent = "🙈"; 
            eyeBtn.title = "Hide";
        }
    } else {
        element.textContent = "••••••";
        privacyState[elementId] = true;
        element.style.letterSpacing = "2px";
        if (eyeBtn) {
            eyeBtn.textContent = "👁️";
            eyeBtn.title = "Show";
        }
    }
}
window.togglePrivacy = togglePrivacy;

// Notification Board Subsystems
function checkNotifications() {
    const toggleBtn = document.getElementById('notifToggle');
    const bodyContainer = document.getElementById('notifBody');
    if (!toggleBtn || !bodyContainer) return;

    const urgentRecords = loanRecords.filter(r => r.status === 'Overdue' || r.status === 'Upcoming');
    
    if (urgentRecords.length > 0) {
        toggleBtn.classList.add('show');
        if (document.getElementById('notifBadge')) document.getElementById('notifBadge').textContent = urgentRecords.length;
        if (document.getElementById('notifPanelBadge')) document.getElementById('notifPanelBadge').textContent = urgentRecords.length;
        
        bodyContainer.innerHTML = '';
        urgentRecords.forEach(r => {
            const item = document.createElement('div');
            item.className = `notif-item ${r.status.toLowerCase().replace('-', '')}`;
            item.onclick = function() { openModal('edit', r.id); toggleNotifPanel(); };
            item.innerHTML = `<div class="notif-name">${r.name}</div><div class="notif-details">Status: <strong>${r.status}</strong><br>Due: <span>${r.dueDate}</span></div>`;
            bodyContainer.appendChild(item);
        });
    } else {
        toggleBtn.classList.remove('show');
    }
}

function toggleNotifPanel() {
    const panel = document.getElementById('notifPanel');
    if (panel) panel.classList.toggle('hidden');
}
window.toggleNotifPanel = toggleNotifPanel;

// Portability Exports (CSV Export)
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
window.exportToCSV = exportToCSV;

// CSV Import Handler
function importCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split(/\r\n|\n/);
        let importedCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^",]*))/g;
            let matches = [];
            let match;
            while ((match = regex.exec(line)) !== null) {
                let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
                matches.push(val);
                if (regex.lastIndex === match.index) regex.lastIndex++;
            }

            if (matches.length >= 8) {
                let rawPayments = [];
                if (matches[8]) {
                    try { rawPayments = JSON.parse(matches[8]); } catch (err) { rawPayments = []; }
                }

                const importedRecord = {
                    id: matches[0] || ('ID-' + String(i).padStart(3, '0')),
                    name: matches[1] || 'Unknown',
                    contact: matches[2] || 'N/A',
                    amount: parseFloat(matches[3]) || 0,
                    interest: parseFloat(matches[4]) || 0,
                    startDate: matches[5] || '',
                    dueDate: matches[6] || '',
                    status: matches[7] || 'In Progress',
                    payments: rawPayments
                };

                await addFirebaseRecord(importedRecord);
                importedCount++;
            }
        }

        if (importedCount > 0) {
            alert(`Salamat, boss! Matagumpay na na-import ang ${importedCount} records diretso sa Firebase Database.`);
        } else {
            alert('Maling CSV format ang na-upload, boss.');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
}
window.importCSV = importCSV;

// System Setup Orchestration
document.addEventListener("DOMContentLoaded", () => {
    const btnAll = document.querySelector('.filter-all');
    const btnActive = document.querySelector('.filter-active');
    const btnOverdue = document.querySelector('.status-overdue');
    const btnPaid = document.querySelector('.status-paid');

    if (btnAll) btnAll.addEventListener('click', (e) => filterRecords('ALL', e.currentTarget));
    if (btnActive) btnActive.addEventListener('click', (e) => filterRecords('ACTIVE', e.currentTarget));
    if (btnOverdue) btnOverdue.addEventListener('click', (e) => filterRecords('Overdue', e.currentTarget));
    if (btnPaid) btnPaid.addEventListener('click', (e) => filterRecords('Paid', e.currentTarget));

    if (loginOverlay && loginOverlay.style.display === 'none') {
        setupFirebaseRealtimeListener();
    }
});