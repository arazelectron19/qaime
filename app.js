import { 
    db, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy, 
    serverTimestamp 
} from "./firbase.js"; // (.js uzantısı mütləq əlavə olunmalıdır)

// Firebase funksiyalarını rəsmi CDN-dən tam şəkildə çəkirik (deleteDoc və doc bura əlavə edildi!)
import { where, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const itemsBody = document.getElementById('invoice-items-body');
const btnAddItem = document.getElementById('btn-add-item');
const customerInput = document.getElementById('customer-input');
const totalPriceView = document.getElementById('total-price-view');
const waitingListContainer = document.getElementById('waiting-list-container');

let invoiceItems = [{ name: '', qty: 1, price: 0 }];
let currentActiveDocId = null;

document.addEventListener('DOMContentLoaded', () => {
    renderItems();
    fetchWaitingList();
});

function renderItems() {
    itemsBody.innerHTML = '';
    let grandTotal = 0;

    invoiceItems.forEach((item, index) => {
        const rowTotal = item.qty * item.price;
        grandTotal += rowTotal;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center; font-weight: bold; color: #a5b4fc; padding-top:14px;">${index + 1}</td>
            <td><input type="text" class="item-name" value="${item.name || ''}" placeholder="Məhsulun adı"></td>
            <td><input type="number" class="item-qty text-center" value="${item.qty}"></td>
            <td><input type="number" class="item-price text-right" value="${item.price || ''}" step="0.01" placeholder="0.00"></td>
            <td style="text-align: right; font-weight: 600; padding-top:14px; min-width:80px;" class="row-total-display">${rowTotal.toFixed(2)} AZN</td>
            <td><button class="btn-delete-row">×</button></td>
        `;

        const nameInput = tr.querySelector('.item-name');
        const qtyInput = tr.querySelector('.item-qty');
        const priceInput = tr.querySelector('.item-price');
        const rowTotalDisplay = tr.querySelector('.row-total-display');
        const btnDeleteRow = tr.querySelector('.btn-delete-row');

        nameInput.addEventListener('input', (e) => { item.name = e.target.value; });

        qtyInput.addEventListener('input', (e) => {
            item.qty = parseInt(e.target.value) || 0;
            const newTotal = item.qty * item.price;
            rowTotalDisplay.textContent = newTotal.toFixed(2) + " AZN";
            fastCalculateTotal();
        });

        priceInput.addEventListener('input', (e) => {
            item.price = parseFloat(e.target.value) || 0;
            const newTotal = item.qty * item.price;
            rowTotalDisplay.textContent = newTotal.toFixed(2) + " AZN";
            fastCalculateTotal();
        });

        qtyInput.addEventListener('focus', (e) => { if(e.target.value == '0') e.target.value = ''; });
        priceInput.addEventListener('focus', (e) => { if(e.target.value == '0') e.target.value = ''; });

        btnDeleteRow.addEventListener('click', () => {
            if(invoiceItems.length === 1) {
                invoiceItems = [{ name: '', qty: 1, price: 0 }];
            } else {
                invoiceItems.splice(index, 1);
            }
            renderItems();
        });

        itemsBody.appendChild(tr);
    });

    totalPriceView.textContent = grandTotal.toFixed(2);
}

function fastCalculateTotal() {
    const total = invoiceItems.reduce((sum, item) => sum + (item.qty * item.price), 0);
    totalPriceView.textContent = total.toFixed(2);
}

btnAddItem.addEventListener('click', () => {
    invoiceItems.push({ name: '', qty: 1, price: 0 });
    renderItems();
});

function prepareOfficialPrintPage() {
    const pdfCustomerName = document.getElementById('pdf-customer-name');
    const pdfItemsBody = document.getElementById('pdf-items-body');
    const pdfTotalPrice = document.getElementById('pdf-total-price');

    pdfCustomerName.textContent = customerInput.value.trim() || '_______________';
    pdfItemsBody.innerHTML = '';
    
    let grandTotal = 0;
    invoiceItems.forEach((item, index) => {
        const rowTotal = item.qty * item.price;
        grandTotal += rowTotal;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center;">${index + 1}</td>
            <td style="text-align: left;">${item.name || '---'}</td>
            <td style="text-align: center;">${item.qty}</td>
            <td style="text-align: right;">${item.price.toFixed(2)}</td>
            <td style="text-align: right; font-weight: 800; font-size: 14px;">${rowTotal.toFixed(2)}</td>
        `;
        pdfItemsBody.appendChild(tr);
    });

    pdfTotalPrice.textContent = grandTotal.toFixed(2) + " AZN";
}

document.getElementById('btn-download').addEventListener('click', async () => {
    prepareOfficialPrintPage();
    const element = document.getElementById('official-print-page');
    const customerName = customerInput.value.trim() || 'Qaime';

    const opt = {
        margin:       15,
        filename:     `Araz_Electron_${customerName}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    await addInvoiceToArchive('print');
    html2pdf().from(element).set(opt).save().catch(err => console.error("PDF Xətası:", err));
});

document.getElementById('btn-print').addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    prepareOfficialPrintPage();
    await addInvoiceToArchive('print');
    window.print();
});

document.getElementById('btn-waiting').addEventListener('click', async () => {
    const customerName = customerInput.value.trim();
    if (!customerName) return alert("Zəhmət olmasa Müştəri adını daxil edin!");

    const data = {
        customerName: customerName,
        items: invoiceItems,
        status: "waiting",
        updatedAt: new Date()
    };

    try {
        if (currentActiveDocId) {
            await updateDoc(doc(db, "waiting_invoices", currentActiveDocId), data);
            alert("Qaimə yeniləndi!");
        } else {
            await addDoc(collection(db, "waiting_invoices"), data);
            alert("Qaimə gözləməyə alındı!");
        }
        resetForm();
        fetchWaitingList();
    } catch (e) { console.error("Firebase Xətası:", e); }
});

async function fetchWaitingList() {
    waitingListContainer.innerHTML = '<div class="loading-wrapper"><div class="sharp-ring-loader"></div></div>';
    try {
        const q = query(collection(db, "waiting_invoices"), where("status", "==", "waiting"));
        const snap = await getDocs(q);
        waitingListContainer.innerHTML = '';

        if(snap.empty) {
            waitingListContainer.innerHTML = '<p style="font-size:12px; color:#9ca3af; text-align:center;">Gözləyən iş yoxdur.</p>';
            return;
        }

        snap.forEach((documentSnapshot) => {
            const data = documentSnapshot.data();
            const docId = documentSnapshot.id;
            const div = document.createElement('div');
            div.className = 'waiting-item';
            div.innerHTML = `
                <div style="flex:1;" class="info-area">
                    <strong style="color:#ffffff;">${data.customerName}</strong>
                    <span style="display:block; font-size:11px; color:#a5b4fc; margin-top:2px;">${data.items.length} məhsul</span>
                </div>
                <div class="action-area" style="display:flex; align-items:center;">
                    <button class="btn-delete-waiting">Sil</button>
                </div>
            `;

            div.addEventListener('click', (e) => {
                if(e.target.closest('.btn-delete-waiting') || e.target.closest('.waiting-item-confirm-box')) return;
                currentActiveDocId = docId;
                customerInput.value = data.customerName;
                invoiceItems = data.items;
                renderItems();
            });

            const btnDelete = div.querySelector('.btn-delete-waiting');
            const actionArea = div.querySelector('.action-area');

            btnDelete.addEventListener('click', (e) => {
                e.stopPropagation();
                
                btnDelete.style.display = 'none';
                
                const confirmBox = document.createElement('div');
                confirmBox.className = 'waiting-item-confirm-box';
                confirmBox.innerHTML = `
                    <span>Silinsin?</span>
                    <button class="btn-confirm-yes" style="background:#ef4444; color:#fff; border:none; padding:3px 8px; margin:0 3px; cursor:pointer; border-radius:3px;">Bəli</button>
                    <button class="btn-confirm-no" style="background:#4b5563; color:#fff; border:none; padding:3px 8px; margin:0 3px; cursor:pointer; border-radius:3px;">Xeyr</button>
                `;

                // BƏLİ DÜYMƏSİ - İndi tam işləkdir!
                confirmBox.querySelector('.btn-confirm-yes').addEventListener('click', async (eSub) => {
                    eSub.stopPropagation();
                    try {
                        // Firebase-dən silirik
                        await deleteDoc(doc(db, "waiting_invoices", docId));
                        
                        // Əgər silinən sənəd hazırda ekranda redaktə edilirsə, formanı təmizləyirik
                        if (currentActiveDocId === docId) resetForm();
                        
                        // Siyahını yeniləyirik
                        fetchWaitingList();
                    } catch (err) {
                        console.error("Silmə xətası:", err);
                        alert("Silmək mümkün olmadı!");
                    }
                });

                confirmBox.querySelector('.btn-confirm-no').addEventListener('click', (eSub) => {
                    eSub.stopPropagation();
                    confirmBox.remove();
                    btnDelete.style.display = 'block';
                });

                actionArea.appendChild(confirmBox);
            });

            waitingListContainer.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

document.getElementById('btn-refresh').addEventListener('click', fetchWaitingList);

function resetForm() {
    customerInput.value = '';
    invoiceItems = [{ name: '', qty: 1, price: 0 }];
    currentActiveDocId = null;
    renderItems();
}

async function addInvoiceToArchive(actionType) {
    try {
        const customerName = customerInput.value.trim() || 'Naməlum Müştəri';
        if (invoiceItems.length === 0) return;

        let total = invoiceItems.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0);

        await addDoc(collection(db, "history_invoices"), {
            customerName: customerName,
            items: invoiceItems,
            totalAmount: total.toFixed(2),
            action: actionType,
            timestamp: serverTimestamp()
        });
        console.log("Qaimə uğurla arxivləndi.");
    } catch (e) {
        console.error("Arxivləmə zamanı xəta: ", e);
    }
}