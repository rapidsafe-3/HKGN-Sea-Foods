const firebaseConfig = {
    apiKey: "AIzaSyDcsHpGuV0nPHzxEHGBZu_fL_oCKHsW3ts",
    authDomain: "hkgn-sea-foods.firebaseapp.com",
    projectId: "hkgn-sea-foods",
    storageBucket: "hkgn-sea-foods.firebasestorage.app",
    messagingSenderId: "408485176936",
    appId: "1:408485176936:web:795f92a0a5a54d67243ddd"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let isDirty = false; 
let currentCustomerName = "";
let rowCount = 0;
let finalBillItems = []; 
let finalGrandTotal = 0;
let activeScreen = 'splash-screen'; 
let pendingTargetScreen = ''; 
let allPastBills = []; 
let currentViewedBillId = null; 

const fishOptionsList = [
    "Rohu", "Catla", "Seer Fish (Surmai)", "Pomfret", 
    "Mackerel (Bangda)", "Prawns", "Crab"
];

// Mark app as dirty if inputs change
document.addEventListener('input', (e) => {
    if (e.target.matches('input, select')) isDirty = true;
});

// Bypass CodePen Load Trap
setTimeout(() => {
    switchScreen('customer-screen');
}, 3500); 

// === CUSTOM TOASTER NOTIFICATIONS ===
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// === REAL-TIME DATABASE LISTENER ===
db.collection("bills").orderBy("date", "desc").onSnapshot((snapshot) => {
    allPastBills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Auto-refresh the screens if they are currently open
    if (activeScreen === 'history-screen') filterHistory();
    if (activeScreen === 'customer-screen') renderDashboard();
    
    // If we are looking at a specific receipt, refresh it to show updated status
    if (activeScreen === 'history-receipt-screen' && currentViewedBillId) {
        viewPastReceipt(currentViewedBillId);
    }
});

// === NEW: RENDER UNPAID DASHBOARD ===
function renderDashboard() {
    const unpaidList = document.getElementById('dashboard-unpaid-list');
    if(!unpaidList) return;

    // Treat anything without a status as 'unpaid'
    const unpaidBills = allPastBills.filter(bill => bill.status === 'unpaid' || !bill.status);

    if (unpaidBills.length === 0) {
        unpaidList.innerHTML = `<div style="text-align: center; color: #86868b; padding: 20px;">🎉 All bills are paid up!</div>`;
        return;
    }

    let html = '';
    unpaidBills.forEach(bill => {
        html += `
        <div class="card history-card" style="border-left: 5px solid #ff3b30 !important; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
            <div style="flex: 1;" onclick="viewPastReceipt('${bill.id}')">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <strong style="font-size: 16px;">${bill.clientName}</strong>
                    <span style="font-weight: bold; color: #000000;">₹${bill.total.toFixed(2)}</span>
                </div>
                <div style="font-size: 13px; color: #666;">
                    ${bill.date} • ${bill.items.length} items
                </div>
            </div>
            <!-- One Tap Mark Paid Button -->
            <button onclick="updateBillStatus('${bill.id}', 'paid')" style="margin-left: 15px; background: #34c759; color: white; border: none; padding: 8px 12px; border-radius: 8px; font-weight: bold; cursor: pointer;">
                MARK PAID
            </button>
        </div>
        `;
    });
    unpaidList.innerHTML = html;
}

// === NEW: UPDATE PAYMENT STATUS ===
async function updateBillStatus(billId, newStatus) {
    try {
        await db.collection("bills").doc(billId).update({ status: newStatus });
        const msg = newStatus === 'paid' ? "✅ Marked as PAID!" : "❌ Marked as UNPAID!";
        const toastType = newStatus === 'paid' ? 'success' : 'error';
        showToast(msg, toastType);
    } catch (e) {
        console.error("Error updating status: ", e);
        showToast("Error updating status", "error");
    }
}

// === SMART SCREEN NAVIGATION ===
function switchScreen(targetId) {
    const activeIsBilling = (activeScreen === 'main-app' || activeScreen === 'receipt-screen');
    const targetIsBilling = (targetId === 'main-app' || targetId === 'receipt-screen');
    
    if (isDirty && activeIsBilling && !targetIsBilling) {
        pendingTargetScreen = targetId; 
        document.getElementById('unsaved-warning').style.display = 'flex';
        return;
    }

    const allScreens = [
        'splash-screen', 'customer-screen', 'main-app', 
        'history-screen', 'profile-screen', 'receipt-screen', 
        'history-receipt-screen'
    ];

    allScreens.forEach(id => {
        const screen = document.getElementById(id);
        if(screen) {
            screen.style.display = 'none';
            screen.style.opacity = '0'; 
        }
    });

    const targetScreen = document.getElementById(targetId);
    if(targetScreen) {
        targetScreen.style.display = 'block';
        setTimeout(() => { targetScreen.style.opacity = '1'; }, 50);
        activeScreen = targetId;
    }

    const navBar = document.getElementById('bottom-nav');
    const backBtn = document.getElementById('backBtn');

    if(navBar) navBar.style.display = (targetId === 'customer-screen' || targetId === 'history-screen' || targetId === 'profile-screen') ? 'flex' : 'none';
    
    if(backBtn) {
        if (targetId === 'main-app' || targetId === 'receipt-screen' || targetId === 'history-receipt-screen') {
            backBtn.style.display = 'flex';
        } else {
            backBtn.style.display = 'none';
        }
    }

    if (targetId === 'history-screen') filterHistory();
    if (targetId === 'customer-screen') renderDashboard(); // Load unpaid bills

    // Update active state on bottom navigation icons
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    
    if (targetId === 'customer-screen' || targetId === 'main-app' || targetId === 'receipt-screen') {
        const homeBtn = document.getElementById('nav-home');
        if(homeBtn) homeBtn.classList.add('active');
    } else if (targetId === 'history-screen' || targetId === 'history-receipt-screen') {
        const historyBtn = document.getElementById('nav-history');
        if(historyBtn) historyBtn.classList.add('active');
    } else if (targetId === 'profile-screen') {
        const profileBtn = document.getElementById('nav-profile');
        if(profileBtn) profileBtn.classList.add('active');
    }
}

// === BACK BUTTON LOGIC ===
function goBack() {
    if (activeScreen === 'main-app') {
        switchScreen('customer-screen');
    } else if (activeScreen === 'receipt-screen') {
        switchScreen('main-app'); 
    } else if (activeScreen === 'history-receipt-screen') {
        switchScreen('history-screen'); 
    }
}

function startNewFromReceipt() {
    switchScreen('customer-screen'); 
}

function cancelLeave() {
    document.getElementById('unsaved-warning').style.display = 'none';
    pendingTargetScreen = ''; 
}

function discardAndLeave() {
    isDirty = false;
    document.getElementById('unsaved-warning').style.display = 'none';
    
    currentViewedBillId = null;
    currentCustomerName = "";
    document.getElementById('customerName').value = "";
    document.getElementById('items-container').innerHTML = "";
    rowCount = 0; 
    finalBillItems = [];
    finalGrandTotal = 0;

    switchScreen(pendingTargetScreen || 'customer-screen');
}

// === SAVE LOGIC ===
async function saveBill() {
    if (finalBillItems.length === 0) {
        showToast("Cannot save an empty bill.", "error");
        return;
    }

    const cleanItems = finalBillItems.map(item => ({
        fishName: item.fishName || "Unknown",
        weight: Number(item.weight) || 0,
        rate: Number(item.rate) || 0,
        balance: Number(item.balance) || 0,
        total: Number(item.total) || 0
    }));

    const billData = {
        clientName: currentCustomerName || "Unknown",
        date: new Date().toLocaleDateString('en-CA'),
        items: cleanItems,
        total: Number(finalGrandTotal) || 0,
        status: 'unpaid' // NEW BILLS ALWAYS DEFAULT TO UNPAID
    };

    try {
        if (currentViewedBillId) {
            // Keep existing status if we are just editing a bill
            const existingBill = allPastBills.find(b => b.id === currentViewedBillId);
            billData.status = existingBill ? (existingBill.status || 'unpaid') : 'unpaid';
            await db.collection("bills").doc(currentViewedBillId).update(billData);
        } else {
            await db.collection("bills").add(billData);
        }

        isDirty = false; 
        document.getElementById('unsaved-warning').style.display = 'none';
        showToast("Bill Saved Successfully!", "success");
        
        if (pendingTargetScreen) {
            switchScreen(pendingTargetScreen);
            pendingTargetScreen = '';
        }
    } catch (e) {
        console.error("Firebase Error: ", e);
        showToast("Error: " + e.message, "error"); 
    }
}

// === HISTORY TAB LOGIC (COLOR CODED) ===
function filterHistory() {
    const searchInput = document.getElementById('searchName');
    const nameInput = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const dateInput = document.getElementById('searchDate') ? document.getElementById('searchDate').value : '';
    const historyList = document.getElementById('history-list');
    
    if(!historyList) return;

    const filteredBills = allPastBills.filter(bill => {
        const matchName = bill.clientName.toLowerCase().includes(nameInput);
        const matchDate = dateInput ? bill.date === dateInput : true;
        return matchName && matchDate;
    });

    if (filteredBills.length === 0) {
        historyList.innerHTML = '<p style="text-align:center; padding: 20px; color: #666;">No bills found.</p>';
        return;
    }

    const today = new Date().toLocaleDateString('en-CA');
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toLocaleDateString('en-CA');

    const groupedBills = {};
    filteredBills.forEach(bill => {
        let dateLabel = bill.date;
        if (bill.date === today) dateLabel = "Today";
        else if (bill.date === yesterday) dateLabel = "Yesterday";
        
        if (!groupedBills[dateLabel]) groupedBills[dateLabel] = [];
        groupedBills[dateLabel].push(bill);
    });

    let html = '';
    for (const [dateLabel, bills] of Object.entries(groupedBills)) {
        html += `<div class="date-divider">${dateLabel}</div>`;
        bills.forEach((bill) => {
            
            // STATUS LOGIC
            const isPaid = bill.status === 'paid';
            const statusColor = isPaid ? '#34c759' : '#ff3b30'; // Green if paid, Red if unpaid
            const statusText = isPaid ? 'PAID' : 'UNPAID';

            html += `
            <div class="card history-card" onclick="viewPastReceipt('${bill.id}')" style="border-left: 5px solid ${statusColor} !important; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <strong style="font-size: 16px;">${bill.clientName}</strong>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span style="font-size: 11px; font-weight: bold; background: ${statusColor}20; color: ${statusColor}; padding: 2px 6px; border-radius: 4px;">${statusText}</span>
                            <span style="font-weight: bold; color: #000000;">₹${bill.total.toFixed(2)}</span>
                        </div>
                    </div>
                    <div style="font-size: 13px; color: #86868b;">
                        ${bill.items.map(item => item.fishName).join(', ')}
                    </div>
                </div>
                <div class="history-arrow" style="margin-left: 15px;">›</div>
            </div>
            `;
        });
    }
    historyList.innerHTML = html;
}

// === VIEW PAST RECEIPT ===
function viewPastReceipt(billId) {
    const bill = allPastBills.find(b => b.id === billId);
    if (!bill) return;

    currentViewedBillId = bill.id;
    currentCustomerName = bill.clientName; 

    document.getElementById('history-invDate').innerText = bill.date;
    document.getElementById('history-recName').innerText = bill.clientName;
    
    // Set Status Badge for Print
    const printStatus = document.getElementById('history-print-status');
    const isPaid = bill.status === 'paid';
    printStatus.innerText = isPaid ? "PAID" : "UNPAID DUE";
    printStatus.style.color = isPaid ? "#34c759" : "#ff3b30";
    printStatus.style.borderColor = isPaid ? "#34c759" : "#ff3b30";

    // Set Dynamic Status Buttons
    const btnContainer = document.getElementById('payment-btn-container');
    if (isPaid) {
        btnContainer.innerHTML = `<button onclick="updateBillStatus('${bill.id}', 'unpaid')" style="flex: 1; margin-top: 0; background: white; color: #ff3b30; border: 2px solid #ff3b30; padding: 16px; border-radius: 14px; font-weight: bold; font-size: 15px; cursor: pointer;">❌ MARK AS UNPAID</button>`;
    } else {
        btnContainer.innerHTML = `<button onclick="updateBillStatus('${bill.id}', 'paid')" style="flex: 1; margin-top: 0; background: #34c759; color: white; border: none; padding: 16px; border-radius: 14px; font-weight: bold; font-size: 15px; cursor: pointer;">✅ MARK AS PAID</button>`;
    }

    const receiptBody = document.getElementById('history-receiptBody');
    if(!receiptBody) return;
    receiptBody.innerHTML = '';
    
    bill.items.forEach((item, index) => {
        const tr = `<tr>
            <td>${index + 1}</td>
            <td>${item.fishName}</td>
            <td>${item.weight}</td>
            <td>₹${item.rate}</td>
            <td>₹${item.balance}</td>
            <td>₹${item.total.toFixed(2)}</td>
        </tr>`;
        receiptBody.innerHTML += tr;
    });

    document.getElementById('history-receiptGrandTotal').innerText = `₹${bill.total.toFixed(2)}`;
    document.getElementById('history-rupeesInWords').innerText = numberToWords(bill.total);

    document.getElementById('historyEditBtn').onclick = () => editPastBill(bill.id);
    document.getElementById('historyDeleteBtn').onclick = () => deletePastBill(bill.id);

    switchScreen('history-receipt-screen');
}

// === EDIT / DELETE LOGIC ===
function editPastBill(billId) {
    const bill = allPastBills.find(b => b.id === billId);
    if (!bill) return;

    currentCustomerName = bill.clientName;
    document.getElementById('customerName').value = currentCustomerName;
    document.getElementById('displayCustomerName').innerText = `Client: ${currentCustomerName}`;

    const container = document.getElementById('items-container');
    container.innerHTML = '';
    rowCount = 0;

    bill.items.forEach(item => {
        addNewItemRow();
        const row = document.getElementById(`item-row-${rowCount}`);
        row.querySelector('.fish-select').value = item.fishName;
        row.querySelector('.weight-input').value = item.weight;
        row.querySelector('.rate-input').value = item.rate;
        row.querySelector('.pending-input').value = item.balance;
    });

    calculateLiveBill();
    isDirty = false; 
    switchScreen('main-app'); 
}

async function deletePastBill(billId) {
    if (confirm("Are you sure you want to permanently delete this bill?")) {
        try {
            await db.collection("bills").doc(billId).delete();
            showToast("Bill deleted successfully!", "success");
            switchScreen('history-screen'); 
        } catch (error) {
            console.error("Error deleting bill: ", error);
            showToast("Error: " + error.message, "error");
        }
    }
}

// === BILLING LOGIC ===
function startBilling() {
    const nameInput = document.getElementById('customerName').value.trim();
    if (!nameInput) {
        showToast("Please enter the client's name.", "error");
        return;
    }
    
    currentCustomerName = nameInput;
    document.getElementById('displayCustomerName').innerText = `Client: ${currentCustomerName}`;

    if (rowCount === 0) {
        document.getElementById('items-container').innerHTML = '';
        addNewItemRow();
    }
    calculateLiveBill();
    switchScreen('main-app');
}

function getFishOptionsHTML() {
    let options = fishOptionsList.map(fish => `<option value="${fish}">${fish}</option>`).join('');
    options += `<option value="Custom...">+ Add Custom Fish...</option>`;
    return options;
}

function addNewItemRow() {
    rowCount++;
    const container = document.getElementById('items-container');
    const card = document.createElement('div');
    card.className = 'item-card';
    card.id = `item-row-${rowCount}`;
    
    card.innerHTML = `
        <button class="remove-btn" onclick="removeItemRow('${card.id}')">X Remove</button>
        <div class="form-group">
            <label>Select Fish</label>
            <select class="fish-select" onchange="handleFishSelection(this); calculateLiveBill()">
                ${getFishOptionsHTML()}
            </select>
        </div>
        <div class="form-group">
            <label>Weight (Kgs)</label>
            <input type="number" class="weight-input" step="0.1" placeholder="0.0" oninput="calculateLiveBill()">
        </div>
        <div class="form-group">
            <label>Rate per Kg (₹)</label>
            <input type="number" class="rate-input" placeholder="0.00" oninput="calculateLiveBill()">
        </div>
        <div class="form-group">
            <label>Balance (₹)</label>
            <input type="number" class="pending-input" placeholder="0.00" value="0" oninput="calculateLiveBill()">
        </div>
    `;
    container.appendChild(card);
}

function handleFishSelection(selectElement) {
    if (selectElement.value === "Custom...") {
        const newFishName = prompt("Enter the name of the new fish:");
        if (newFishName && newFishName.trim() !== "") {
            const formattedName = newFishName.trim();
            fishOptionsList.push(formattedName);
            const newOption = document.createElement('option');
            newOption.value = formattedName;
            newOption.text = formattedName;
            selectElement.insertBefore(newOption, selectElement.lastElementChild);
            selectElement.value = formattedName;
        } else {
            selectElement.selectedIndex = 0;
        }
    }
}

function removeItemRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.style.opacity = '0';
        setTimeout(() => {
            row.remove();
            calculateLiveBill(); 
        }, 250);
    }
}

function calculateLiveBill() {
    const rows = document.querySelectorAll('.item-card'); 
    const tbody = document.getElementById('billBody');
    tbody.innerHTML = '';
    
    finalGrandTotal = 0;
    finalBillItems = []; 

    rows.forEach(row => {
        const fishName = row.querySelector('.fish-select').value;
        const weight = parseFloat(row.querySelector('.weight-input').value) || 0;
        const rate = parseFloat(row.querySelector('.rate-input').value) || 0;
        const balance = parseFloat(row.querySelector('.pending-input').value) || 0;
        
        if (weight > 0 && rate > 0) {
            const total = (weight * rate) + balance;
            finalGrandTotal += total;
            finalBillItems.push({ fishName, weight, rate, balance, total });
            
            const tr = `<tr>
                <td>${fishName}</td>
                <td>${weight}</td>
                <td>₹${rate}</td>
                <td>₹${balance}</td>
                <td>₹${total.toFixed(2)}</td>
            </tr>`;
            tbody.innerHTML += tr;
        }
    });

    document.getElementById('grandTotal').innerText = `₹${finalGrandTotal.toFixed(2)}`;
}

function generateBill() {
    if (finalBillItems.length === 0) {
        showToast("Add at least one item first.", "error");
        return;
    }

    const dateEl = document.getElementById('invDate');
    if(dateEl) dateEl.innerText = new Date().toLocaleDateString('en-CA');
    
    document.getElementById('recName').innerText = currentCustomerName;

    const receiptBody = document.getElementById('receiptBody');
    receiptBody.innerHTML = '';

    finalBillItems.forEach((item, index) => {
        const tr = `<tr>
            <td>${index + 1}</td>
            <td>${item.fishName}</td>
            <td>${item.weight}</td>
            <td>₹${item.rate}</td>
            <td>₹${item.balance}</td>
            <td>₹${item.total.toFixed(2)}</td>
        </tr>`;
        receiptBody.innerHTML += tr;
    });

    document.getElementById('receiptGrandTotal').innerText = `₹${finalGrandTotal.toFixed(2)}`;
    document.getElementById('rupeesInWords').innerText = numberToWords(finalGrandTotal);

    switchScreen('receipt-screen');
}

function shareBill(paperId = 'receiptPaper', btnId = 'shareBtn') {
    // Target the specific paper container, not the entire screen
    const receiptElement = document.getElementById(paperId);
    const shareBtn = document.getElementById(btnId);
    
    if(!receiptElement || !shareBtn) return;

    const originalText = shareBtn.innerHTML;
    shareBtn.innerHTML = "⏳ GENERATING IMAGE...";
    
    // html2canvas now only looks at receiptElement, ignoring screen buttons
    html2canvas(receiptElement, { 
        scale: 2, 
        useCORS: true,
        backgroundColor: "#ffffff" // Ensures white background
    }).then(canvas => {
        const fileName = `Invoice_${currentCustomerName || 'HKGN'}.png`;
        canvas.toBlob(blob => {
            const file = new File([blob], fileName, { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                navigator.share({ title: 'HKGN Sea Food Invoice', files: [file] })
                .then(() => { shareBtn.innerHTML = originalText; })
                .catch((error) => { shareBtn.innerHTML = originalText; fallbackDownload(canvas, fileName); });
            } else {
                shareBtn.innerHTML = originalText;
                fallbackDownload(canvas, fileName);
            }
        }, 'image/png');
    });
}

function fallbackDownload(canvas, fileName) {
    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// === NATIVE PRINT FUNCTION ===
function printReceipt(paperId) {
    // No new windows, no pop-ups. Just trigger the native print dialog.
    window.print();
}

function numberToWords(num) {
    if (num === 0) return "Zero Rupees Only";
    const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    function convertDigit(n) {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
        if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " and " + convertDigit(n % 100) : "");
        return "";
    }
    let words = "";
    let integerPart = Math.floor(num);
    if (integerPart >= 10000000) { words += convertDigit(Math.floor(integerPart / 10000000)) + " Crore "; integerPart %= 10000000; }
    if (integerPart >= 100000) { words += convertDigit(Math.floor(integerPart / 100000)) + " Lakh "; integerPart %= 100000; }
    if (integerPart >= 1000) { words += convertDigit(Math.floor(integerPart / 1000)) + " Thousand "; integerPart %= 1000; }
    if (integerPart > 0) { words += convertDigit(integerPart); }
    return words.trim() + " Rupees Only";
}
