/* ==========================================================================
   RGB LENDING SYSTEM - COMPLETE SCRIPT ENGINE (Merged Part 1, Part 2 & Approval)
   ========================================================================== */

// Global State & Data Cache
let loanRecords = [];
let currentPaymentsArray = [];
let currentActiveFilter = 'ALL';
let currentSortOrder = 'asc'; // 'asc' or 'desc' for due date sorting
let privacyState = false; // Data masking state (false = visible, true = masked)
let pendingApplications = []; // Holds 'Pending Approval' loan applications

/* ==========================================================================
   1. UTILITY & TOAST ENGINE
   ========================================================================== */

function showToast(message, type = 'info') {
    let container = document.querySelector('.fb-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'fb-toast-container';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#1b4332';
    toast.style.cssText = `
        background: ${bgColor};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-weight: 600;
        font-size: 0.9rem;
        animation: fadeIn 0.3s ease;
    `;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* ==========================================================================
   2. DATE & URGENCY ENGINE
   ========================================================================== */

function getDaysDifference(dueDateStr) {
    if (!dueDateStr) return Infinity;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    
    if (isNaN(due.getTime())) return Infinity;
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function sortRecordsByDaysArray(recordsArray, order = 'asc') {
    return recordsArray.sort((a, b) => {
        // Always place paid loans at the bottom
        if (a.status === 'Paid' && b.status !== 'Paid') return 1;
        if (a.status !== 'Paid' && b.status === 'Paid') return -1;

        const daysA = getDaysDifference(a.dueDate);
        const daysB = getDaysDifference(b.dueDate);

        if (order === 'asc') {
            return daysA - daysB; // Overdue / Nearest due date first
        } else {
            return daysB - daysA; // Farthest due date first
        }
    });
}

function toggleSortByDays() {
    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    renderTable();
    showToast(`Inayos ang listahan ayon sa Due Date (${currentSortOrder.toUpperCase()})`, 'info');
}
window.toggleSortByDays = toggleSortByDays;

/* ==========================================================================
   3. AUTOMATIC CALCULATION & FIELD HANDLERS
   ========================================================================== */

function autoCalculateMonthlyInterest() {
    const amountInput = document.getElementById('formAmount');
    const interestInput = document.getElementById('formInterest');
    if (!amountInput || !interestInput) return;

    const amount = parseFloat(amountInput.value) || 0;
    const computedInterest = amount * 0.05; // Default 5% rate
    interestInput.value = computedInterest.toFixed(2);
}
window.autoCalculateMonthlyInterest = autoCalculateMonthlyInterest;

function autoCalculateDueDate() {
    const startInput = document.getElementById('formStartDate');
    const dueInput = document.getElementById('formDueDate');
    if (!startInput || !dueInput || !startInput.value) return;

    const startDate = new Date(startInput.value);
    if (isNaN(startDate.getTime())) return;

    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + 1);

    dueInput.value = dueDate.toISOString().slice(0, 10);
}
window.autoCalculateDueDate = autoCalculateDueDate;

function handleStatusFieldToggle() {
    const statusSelect = document.getElementById('formStatus');
    const dueInput = document.getElementById('formDueDate');
    if (!statusSelect || !dueInput) return;

    if (statusSelect.value === 'Paid') {
        dueInput.disabled = true;
        dueInput.style.backgroundColor = '#e2e8f0';
    } else {
        dueInput.disabled = false;
        dueInput.style.backgroundColor = '#ffffff';
    }
}
window.handleStatusFieldToggle = handleStatusFieldToggle;

/* ==========================================================================
   4. MODAL PARTIAL PAYMENT HISTORY ENGINE
   ========================================================================== */

function renderPaymentRows() {
    const container = document.getElementById('paymentRowsContainer');
    if (!container) return;

    container.innerHTML = '';
    currentPaymentsArray.forEach((p, index) => {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center;';
        row.innerHTML = `
            <input type="date" value="${p.date || ''}" onchange="updatePaymentData(${index}, 'date', this.value)" style="padding:4px; border:1px solid #cbd5e1; border-radius:4px;">
            <input type="number" value="${p.amount || 0}" step="50" onchange="updatePaymentData(${index}, 'amount', this.value)" placeholder="Amount" style="padding:4px; border:1px solid #cbd5e1; border-radius:4px; width: 100px;">
            <input type="text" value="${p.notes || ''}" onchange="updatePaymentData(${index}, 'notes', this.value)" placeholder="Notes/OR #" style="padding:4px; border:1px solid #cbd5e1; border-radius:4px; flex:1;">
            <button type="button" onclick="removePaymentRow(${index})" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">&times;</button>
        `;
        container.appendChild(row);
    });
}

function addNewPaymentRow() {
    const today = new Date().toISOString().slice(0, 10);
    currentPaymentsArray.push({ date: today, amount: 0, notes: '' });
    renderPaymentRows();
}
window.addNewPaymentRow = addNewPaymentRow;

function removePaymentRow(index) {
    currentPaymentsArray.splice(index, 1);
    renderPaymentRows();
}
window.removePaymentRow = removePaymentRow;

function updatePaymentData(index, field, value) {
    if (!currentPaymentsArray[index]) return;
    if (field === 'amount') {
        currentPaymentsArray[index][field] = parseFloat(value) || 0;
    } else {
        currentPaymentsArray[index][field] = value;
    }
}
window.updatePaymentData = updatePaymentData;

/* ==========================================================================
   5. AUTO STATUS SYNCHRONIZATION ENGINE
   ========================================================================== */

async function checkAndAutoUpdateStatuses() {
    if (!loanRecords.length) return;

    for (let record of loanRecords) {
        if (!record.id) continue;
        
        const totalPaid = (record.payments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const totalOwed = (parseFloat(record.amount) || 0) + (parseFloat(record.interest) || 0);
        const daysDiff = getDaysDifference(record.dueDate);

        let targetStatus = record.status;

        if (totalPaid >= totalOwed && totalOwed > 0) {
            targetStatus = 'Paid';
        } else if (daysDiff < 0) {
            targetStatus = 'Overdue';
        } else if (record.status === 'Overdue' && daysDiff >= 0) {
            targetStatus = 'In Progress';
        }

        if (targetStatus !== record.status) {
            record.status = targetStatus;
            await updateFirebaseRecord(record.id, { status: targetStatus });
        }
    }
}

/* ==========================================================================
   6. PRIVACY MASKING & FILTERS ENGINE
   ========================================================================== */

function togglePrivacyState() {
    privacyState = !privacyState;
    const btn = document.getElementById('btnPrivacyToggle');
    if (btn) {
        btn.innerHTML = privacyState 
            ? `<i class="fa-solid fa-eye"></i> Privacy: ON` 
            : `<i class="fa-solid fa-eye-slash"></i> Privacy: OFF`;
    }
    renderTable();
}
window.togglePrivacyState = togglePrivacyState;

function filterRecords(filterType, btnElement) {
    currentActiveFilter = filterType;
    document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    renderTable();
}
window.filterRecords = filterRecords;

function handleSearch() {
    renderTable();
}
window.handleSearch = handleSearch;

/* ==========================================================================
   7. TABLE RENDER ENGINE
   ========================================================================== */

function renderTable() {
    const tbody = document.getElementById('loanTableBody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

    // 1. Apply Status Filters
    let filtered = loanRecords.filter(r => {
        if (currentActiveFilter === 'ACTIVE') return r.status === 'In Progress' || r.status === 'Overdue';
        if (currentActiveFilter === 'Overdue') return r.status === 'Overdue';
        if (currentActiveFilter === 'Paid') return r.status === 'Paid';
        return true; // 'ALL'
    });

    // 2. Apply Search
    if (searchTerm) {
        filtered = filtered.filter(r => 
            (r.name && r.name.toLowerCase().includes(searchTerm)) ||
            (r.contact && r.contact.toLowerCase().includes(searchTerm))
        );
    }

    // 3. Apply Due Date Sorting
    sortRecordsByDaysArray(filtered, currentSortOrder);

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: #94a3b8;">
                    Walang nahanap na loan record.
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    filtered.forEach(r => {
        const daysDiff = getDaysDifference(r.dueDate);
        let urgencyBadge = '';

        if (r.status === 'Paid') {
            urgencyBadge = `<span style="color:#10b981; font-weight:700;"><i class="fa-solid fa-check-circle"></i> Fully Paid</span>`;
        } else if (daysDiff < 0) {
            urgencyBadge = `<span style="color:#ef4444; font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> Overdue by ${Math.abs(daysDiff)} day(s)</span>`;
        } else if (daysDiff === 0) {
            urgencyBadge = `<span style="color:#f59e0b; font-weight:700;"><i class="fa-solid fa-clock"></i> DUE TODAY!</span>`;
        } else {
            urgencyBadge = `<span style="color:#3b82f6; font-weight:600;">Due in ${daysDiff} day(s)</span>`;
        }

        const formattedAmount = privacyState ? '••••••' : `₱${(parseFloat(r.amount) || 0).toLocaleString(undefined, {minimumFractionDigits:2})}`;
        const formattedInterest = privacyState ? '••••••' : `₱${(parseFloat(r.interest) || 0).toLocaleString(undefined, {minimumFractionDigits:2})}`;

        let statusPillClass = 'in-progress';
        if (r.status === 'Overdue') statusPillClass = 'overdue';
        if (r.status === 'Paid') statusPillClass = 'paid';

        html += `
            <tr>
                <td style="font-weight:700; color:#1b4332;">${r.name || 'N/A'}</td>
                <td>${r.contact || 'N/A'}</td>
                <td>${formattedAmount}</td>
                <td>${formattedInterest}</td>
                <td>${r.startDate || 'N/A'}</td>
                <td>
                    <div>${r.dueDate || 'N/A'}</div>
                    <small>${urgencyBadge}</small>
                </td>
                <td><span class="status-pill ${statusPillClass}">${r.status}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn-sm-action btn-edit" onclick="openModal('edit', '${r.id}')" title="Edit Record"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-sm-action btn-delete" onclick="deleteLoanRecord('${r.id}')" title="Delete Record"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

/* ==========================================================================
   8. MODAL CONTROL & FORM HANDLERS
   ========================================================================== */

function openModal(mode, recordId = null) {
    const modal = document.getElementById('loanModal');
    const form = document.getElementById('loanForm');
    const title = document.getElementById('modalTitle');
    if (!modal || !form) return;

    form.reset();
    currentPaymentsArray = [];

    if (mode === 'edit' && recordId) {
        const record = loanRecords.find(r => r.id === recordId);
        if (record) {
            title.textContent = 'Edit Loan Record';
            document.getElementById('recordId').value = record.id;
            document.getElementById('formName').value = record.name || '';
            document.getElementById('formContact').value = record.contact || '';
            document.getElementById('formAmount').value = record.amount || 0;
            document.getElementById('formInterest').value = record.interest || 0;
            document.getElementById('formStartDate').value = record.startDate || '';
            document.getElementById('formDueDate').value = record.dueDate || '';
            document.getElementById('formStatus').value = record.status || 'In Progress';

            currentPaymentsArray = Array.isArray(record.payments) ? [...record.payments] : [];
        }
    } else {
        title.textContent = 'New Loan Record';
        document.getElementById('recordId').value = '';
        const today = new Date().toISOString().slice(0, 10);
        document.getElementById('formStartDate').value = today;
        autoCalculateDueDate();
    }

    handleStatusFieldToggle();
    renderPaymentRows();
    modal.style.display = 'flex';
}
window.openModal = openModal;

function closeModal() {
    const modal = document.getElementById('loanModal');
    if (modal) modal.style.display = 'none';
}
window.closeModal = closeModal;

async function handleFormSubmit(e) {
    e.preventDefault();

    const recordId = document.getElementById('recordId').value;
    const payload = {
        name: document.getElementById('formName').value.trim(),
        contact: document.getElementById('formContact').value.trim(),
        amount: parseFloat(document.getElementById('formAmount').value) || 0,
        interest: parseFloat(document.getElementById('formInterest').value) || 0,
        startDate: document.getElementById('formStartDate').value,
        dueDate: document.getElementById('formDueDate').value,
        status: document.getElementById('formStatus').value,
        payments: currentPaymentsArray
    };

    try {
        if (recordId) {
            await updateFirebaseRecord(recordId, payload);
            showToast('Matagumpay na na-update ang loan record!', 'success');
        } else {
            await addFirebaseRecord(payload);
            showToast('Bagong loan record ang naisumite!', 'success');
        }
        closeModal();
    } catch (err) {
        console.error("Save error:", err);
        showToast('Error sa pag-save: ' + err.message, 'error');
    }
}
window.handleFormSubmit = handleFormSubmit;

/* ==========================================================================
   9. CSV IMPORT ENGINE (Part 2 Integration)
   ========================================================================== */

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

/* ==========================================================================
   10. FIREBASE REAL-TIME CRUD & APPROVAL QUEUE ENGINE
   ========================================================================== */

// Main Active Loans Realtime Listener
function setupFirebaseRealtimeListener() {
    if (!window.db || !window.firestoreTools) return;

    const { collection, onSnapshot } = window.firestoreTools;
    onSnapshot(collection(window.db, "loan_records"), (snapshot) => {
        loanRecords = [];
        snapshot.forEach((doc) => {
            loanRecords.push({ id: doc.id, ...doc.data() });
        });

        checkAndAutoUpdateStatuses();
        renderTable();
    }, (error) => {
        console.error("Firestore Error:", error);
    });
}

// Pending Applications Realtime Listener
function setupApprovalRealtimeListener() {
    if (!window.db || !window.firestoreTools) return;

    const { collection, onSnapshot, query, where } = window.firestoreTools;
    const q = query(
        collection(window.db, "loan_applications"),
        where("status", "==", "Pending Approval")
    );

    onSnapshot(q, (snapshot) => {
        pendingApplications = [];
        snapshot.forEach((doc) => {
            pendingApplications.push({ id: doc.id, ...doc.data() });
        });

        updateApprovalBadgeCount();
        const approvalModal = document.getElementById('approvalModal');
        if (approvalModal && approvalModal.style.display === 'flex') {
            renderApprovalList();
        }
    }, (error) => {
        console.error("Error fetching approval applications:", error);
    });
}

function updateApprovalBadgeCount() {
    const badge = document.getElementById('approvalBadge');
    if (!badge) return;

    if (pendingApplications.length > 0) {
        badge.textContent = pendingApplications.length;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function openApprovalModal() {
    const modal = document.getElementById('approvalModal');
    if (modal) {
        modal.style.display = 'flex';
        renderApprovalList();
    }
}
window.openApprovalModal = openApprovalModal;

function closeApprovalModal() {
    const modal = document.getElementById('approvalModal');
    if (modal) modal.style.display = 'none';
}
window.closeApprovalModal = closeApprovalModal;

function renderApprovalList() {
    const container = document.getElementById('approvalApplicationsList');
    if (!container) return;

    if (pendingApplications.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px 10px; color: #64748b;">
                <i class="fa-solid fa-circle-check" style="font-size: 3rem; color: #52b788; margin-bottom: 10px;"></i>
                <h3>Walang Pending Applications</h3>
                <p>Lahat ng pumasok na loan application ay na-process na, boss!</p>
            </div>
        `;
        return;
    }

    let html = '';
    pendingApplications.forEach((app) => {
        const monthlyInt = (app.amount * 0.05).toFixed(2);
        
        html += `
            <div style="border: 1px solid #cbd5e1; border-radius: 10px; padding: 15px; margin-bottom: 15px; background: #f8fafc;">
                <div style="display:flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; margin-bottom: 10px;">
                    <div>
                        <h3 style="margin: 0; color: #1b4332;">${app.name}</h3>
                        <small style="color: #64748b;"><i class="fa-solid fa-phone"></i> ${app.contact} | Date: ${app.appliedDate || 'N/A'}</small>
                    </div>
                    <div>
                        <span style="background: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 0.85rem;">
                            ${app.loanType || 'Personal Loan'}
                        </span>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; font-size: 0.9rem; margin-bottom: 12px;">
                    <div><strong>Amount Requested:</strong> <span style="color:#1b4332; font-weight:700;">₱${parseFloat(app.amount).toLocaleString()}</span></div>
                    <div><strong>Loan Term:</strong> ${app.term} Month(s)</div>
                    <div><strong>Monthly Interest (5%):</strong> ₱${monthlyInt}</div>
                    <div><strong>Disbursement:</strong> ${app.disbursement} (${app.accountDetails})</div>
                </div>

                <!-- ID & Signature Previews -->
                <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 15px; background: #fff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="flex: 1; min-width: 200px;">
                        <span style="font-size: 0.8rem; font-weight:600; color: #475569; display:block; margin-bottom:4px;">Uploaded Valid ID:</span>
                        ${app.idImage ? `<img src="${app.idImage}" style="max-width: 100%; height: 120px; object-fit: contain; border-radius: 6px; border: 1px solid #cbd5e1; cursor:pointer;" onclick="window.open('${app.idImage}')" title="Click to view full size">` : '<p style="font-size:0.8rem; color:#ef4444;">No ID Attached</p>'}
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <span style="font-size: 0.8rem; font-weight:600; color: #475569; display:block; margin-bottom:4px;">Digital Signature:</span>
                        ${app.signatureImage ? `<img src="${app.signatureImage}" style="max-width: 100%; height: 120px; object-fit: contain; border-radius: 6px; border: 1px solid #cbd5e1; background:#fafafa; cursor:pointer;" onclick="window.open('${app.signatureImage}')" title="Click to view full size">` : '<p style="font-size:0.8rem; color:#ef4444;">No Signature Attached</p>'}
                    </div>
                </div>

                <!-- Actions: Approve / Reject -->
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="rejectLoanApplication('${app.id}')" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer;">
                        <i class="fa-solid fa-xmark"></i> Reject Application
                    </button>
                    <button onclick="approveLoanApplication('${app.id}')" style="background: #1b4332; color: white; border: none; padding: 8px 18px; border-radius: 6px; font-weight: 700; cursor: pointer;">
                        <i class="fa-solid fa-check"></i> Approve & Issue Loan
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Approve Application and Push to Active Loans
async function approveLoanApplication(appId) {
    const app = pendingApplications.find(a => a.id === appId);
    if (!app) return;

    if (!confirm(`Sigurado ka ba na ie-approve ang loan ni ${app.name} na nagkakahalaga ng ₱${app.amount}?`)) return;

    try {
        const { collection, addDoc, doc, updateDoc } = window.firestoreTools;

        const today = new Date();
        const dueDate = new Date();
        dueDate.setMonth(today.getMonth() + 1);

        const startDateStr = today.toISOString().slice(0, 10);
        const dueDateStr = dueDate.toISOString().slice(0, 10);

        const newActiveLoanRecord = {
            name: app.name,
            contact: app.contact,
            amount: parseFloat(app.amount),
            interest: parseFloat(app.amount) * 0.05,
            startDate: startDateStr,
            dueDate: dueDateStr,
            status: 'In Progress',
            payments: [],
            disbursement: app.disbursement || 'GCash',
            accountDetails: app.accountDetails || '',
            approvedDate: startDateStr
        };

        await addDoc(collection(window.db, "loan_records"), newActiveLoanRecord);

        const appRef = doc(window.db, "loan_applications", appId);
        await updateDoc(appRef, { status: "Approved" });

        showToast(`Approved na ang loan ni ${app.name}!`, 'success');

    } catch (err) {
        console.error("Error approving loan:", err);
        showToast("Nagka-error sa approval: " + err.message, 'error');
    }
}
window.approveLoanApplication = approveLoanApplication;

// Reject Application
async function rejectLoanApplication(appId) {
    const reason = prompt("Maglagay ng dahilan ng pag-reject (Optional):", "Incomplete requirements / Invalid ID");
    if (reason === null) return;

    try {
        const { doc, updateDoc } = window.firestoreTools;
        const appRef = doc(window.db, "loan_applications", appId);
        
        await updateDoc(appRef, { 
            status: "Rejected",
            rejectionReason: reason 
        });

        showToast("Na-reject ang application record, boss.", 'info');

    } catch (err) {
        console.error("Error rejecting application:", err);
        showToast("Nagka-error sa pag-reject: " + err.message, 'error');
    }
}
window.rejectLoanApplication = rejectLoanApplication;

// Standard Firebase Firestore Abstraction Helpers
async function addFirebaseRecord(recordData) {
    if (!window.db || !window.firestoreTools) return;
    const { collection, addDoc } = window.firestoreTools;
    return await addDoc(collection(window.db, "loan_records"), recordData);
}

async function updateFirebaseRecord(recordId, updateData) {
    if (!window.db || !window.firestoreTools) return;
    const { doc, updateDoc } = window.firestoreTools;
    const recordRef = doc(window.db, "loan_records", recordId);
    return await updateDoc(recordRef, updateData);
}

async function deleteLoanRecord(recordId) {
    if (!confirm("Sigurado ka bang gusto mong burahin ang loan record na ito?")) return;
    if (!window.db || !window.firestoreTools) return;
    
    try {
        const { doc, deleteDoc } = window.firestoreTools;
        const recordRef = doc(window.db, "loan_records", recordId);
        await deleteDoc(recordRef);
        showToast("Nabora na ang loan record.", 'info');
    } catch (err) {
        showToast("Error sa pag-delete: " + err.message, 'error');
    }
}
window.deleteLoanRecord = deleteLoanRecord;

function logout() {
    if (confirm("Gusto mo bang mag-logout, boss?")) {
        window.location.reload();
    }
}
window.logout = logout;

/* ==========================================================================
   11. SYSTEM BOOTSTRAP
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // Bind Filter Controls
    const btnAll = document.querySelector('.filter-all');
    const btnActive = document.querySelector('.filter-active');
    const btnOverdue = document.querySelector('.status-overdue');
    const btnPaid = document.querySelector('.status-paid');

    if (btnAll) btnAll.addEventListener('click', (e) => filterRecords('ALL', e.currentTarget));
    if (btnActive) btnActive.addEventListener('click', (e) => filterRecords('ACTIVE', e.currentTarget));
    if (btnOverdue) btnOverdue.addEventListener('click', (e) => filterRecords('Overdue', e.currentTarget));
    if (btnPaid) btnPaid.addEventListener('click', (e) => filterRecords('Paid', e.currentTarget));

    // Boot Firebase Listeners after SDK initialization
    setTimeout(() => {
        setupFirebaseRealtimeListener();
        setupApprovalRealtimeListener();
    }, 500);
});