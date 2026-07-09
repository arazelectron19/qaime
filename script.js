import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase məlumatların (Orijinal sazlamaların tam qorundu)
const firebaseConfig = {
    apiKey: "AIzaSyA6TGcnhFOErD5gd4XRNBjRjLucKVuphZY",
    authDomain: "qaime-77f63.firebaseapp.com",
    projectId: "qaime-77f63",
    storageBucket: "qaime-77f63.firebasestorage.app",
    messagingSenderId: "879558627020",
    appId: "1:879558627020:web:980a57009e3377eea67c69"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const itemsBody = document.getElementById('invoice-items-body');
const btnAddItem = document.getElementById('btn-add-item');
const customerInput = document.getElementById('customer-input');
const customerNameView = document.getElementById('customer-name-view');
const totalPriceView = document.getElementById('total-price-view');
const waitingListContainer = document.getElementById('waiting-list-container');

let invoiceItems = [{ name: '', qty: 1, price: 0 }];
let currentActiveDocId = null;

document.addEventListener('DOMContentLoaded', () => {
    renderItems();
    fetchWaitingList();
});

customerInput.addEventListener('input', (e) => {
    customerNameView.textContent = e.target.value || '_______________';
});

// CƏDVƏLİ SIRA NÖMRƏLƏRİ VƏ SÜRET HADİSƏLƏRİ İLƏ EKRANA BASMAQ
function renderItems() {
    itemsBody.innerHTML = '';
    let grandTotal = 0;

    invoiceItems.forEach((item, index) => {
        const rowTotal = item.qty * item.price;
        grandTotal += rowTotal;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center row-index">${index + 1}</td>
            <td>
                <input type="text" class="item-name" value="${item.name}" placeholder="Malın adı">
            </td>
            <td class="text-center">
                <input type="number" class="item-qty text-center" value="${item.qty}">
            </td>
            <td class="text-right">
                <input type="number" class="item-price text-right" value="${item.price}" step="0.01" placeholder="0.00">
            </td>
            <td class="text-right font-medium row-total-display">${rowTotal.toFixed(2)} AZN</td>
            <td class="text-center no-print">
                <button class="btn-delete-row">×</button>
            </td>
        `;

        // Cari sətirdəki elementləri seçirik
        const nameInput = tr.querySelector('.item-name');
        const qtyInput = tr.querySelector('.item-qty');
        const priceInput = tr.querySelector('.item-price');
        const rowTotalDisplay = tr.querySelector('.row-total-display');
        const btnDeleteRow = tr.querySelector('.btn-delete-row');

        // Malın adı dəyişəndə massivə anında yazır
        nameInput.addEventListener('input', (e) => {
            item.name = e.target.value;
        });

        // MİQDAR: Yazarkən ləngiməməsi üçün yalnız bu sətir və yekun dəyişir
        qtyInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value) || 0;
            item.qty = val;
            rowTotalDisplay.textContent = (item.qty * item.price).toFixed(2) + " AZN";
            fastCalculateTotal(); // Brauzeri dondurmadan yekun məbləği yeniləyir
        });

        // QİYMƏT: İlişmədən, nöqtə və rəqəmləri sərbəst yazmaq üçün sətir daxili hadisə
        priceInput.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            item.price = val;
            rowTotalDisplay.textContent = (item.qty * item.price).toFixed(2) + " AZN";
            fastCalculateTotal(); // Brauzeri dondurmadan yekun məbləği yeniləyir
        });

        // Klaviaturadan yazmağa başlayanda xanadakı lazımsız '0'-ı avtomatik silir
        qtyInput.addEventListener('focus', (e) => { if(e.target.value == '0') e.target.value = ''; });
        priceInput.addEventListener('focus', (e) => { if(e.target.value == '0') e.target.value = ''; });

        // Sətir Silmə Hadisəsi
        btnDeleteRow.addEventListener('click', () => {
            if(invoiceItems.length === 1) {
                invoiceItems = [{ name: '', qty: 1, price: 0 }];
            } else {
                invoiceItems.splice(index, 1);
            }
            renderItems(); // Silinmədə sıra nömrələri düzəlsin deyə tam yenilənir
        });

        itemsBody.appendChild(tr);
    });

    totalPriceView.textContent = grandTotal.toFixed(2);
}

// Dom elementlərini sarsıtmayan, klaviaturanın sürətinə çatacaq yüngül hesablama funksiyası
function fastCalculateTotal() {
    const total = invoiceItems.reduce((sum, item) => sum + (item.qty * item.price), 0);
    totalPriceView.textContent = total.toFixed(2);
}

btnAddItem.addEventListener('click', () => {
    invoiceItems.push({ name: '', qty: 1, price: 0 });
    renderItems();
});

// GÖZLƏMƏYƏ ALMA (YARATMA VƏ YENİLƏMƏ)
document.getElementById('btn-waiting').addEventListener('click', async () => {
    const customerName = customerInput.value.trim();
    if (!customerName) return alert("Zəhmət olmasa Usta və ya Müştəri adını daxil edin!");

    const data = {
        customerName: customerName,
        items: invoiceItems,
        status: "waiting",
        updatedAt: new Date()
    };

    try {
        if (currentActiveDocId) {
            const docRef = doc(db, "waiting_invoices", currentActiveDocId);
            await updateDoc(docRef, data);
            alert("Gözləyən qaimə yeniləndi!");
        } else {
            await addDoc(collection(db, "waiting_invoices"), data);
            alert("Qaimə gözləmə siyahısına alındı!");
        }
        resetForm();
        fetchWaitingList();
    } catch (error) {
        console.error("Xəta:", error);
    }
});

// GÖZLƏMƏ SİYAHISINI ÇƏKMƏK VƏ SİLMƏ FUNKSİYASI
async function fetchWaitingList() {
    waitingListContainer.innerHTML = `
        <div class="loading-wrapper">
            <div class="sharp-ring-loader"></div>
            <span class="loading-text">Yüklənir...</span>
        </div>
    `;
    try {
        const q = query(collection(db, "waiting_invoices"), where("status", "==", "waiting"));
        const querySnapshot = await getDocs(q);
        waitingListContainer.innerHTML = '';

        if(querySnapshot.empty) {
            waitingListContainer.innerHTML = '<p style="font-size:12px; color:#9ca3af; text-align:center;">Gözləyən iş yoxdur.</p>';
            return;
        }

        querySnapshot.forEach((documentSnapshot) => {
            const data = documentSnapshot.data();
            const docId = documentSnapshot.id;

            const div = document.createElement('div');
            div.className = 'waiting-item';
            
            div.innerHTML = `
                <div class="waiting-item-info" data-id="${docId}">
                    <p>${data.customerName}</p>
                    <span>${data.items.length} adda mal var</span>
                </div>
                <button class="btn-delete-waiting" data-id="${docId}">Sil</button>
            `;

            // Müştərinin adına klik edəndə qaiməni ekrana doldurmaq
            div.querySelector('.waiting-item-info').addEventListener('click', () => {
                currentActiveDocId = docId;
                customerInput.value = data.customerName;
                customerNameView.textContent = data.customerName;
                invoiceItems = data.items;
                renderItems();
            });

            // "Sil" düyməsinə klik edəndə Firebase-dən tamamilə silmək
            div.querySelector('.btn-delete-waiting').addEventListener('click', async (e) => {
                e.stopPropagation(); // Arxa plandakı sətir klikini bloklayır
                
                const confirmDelete = confirm(`${data.customerName} adlı müştərinin qaiməsini gözləmədən silmək istədiyinizə əminsiniz?`);
                if (!confirmDelete) return;

                try {
                    await deleteDoc(doc(db, "waiting_invoices", docId));
                    
                    if (currentActiveDocId === docId) {
                        resetForm();
                    }
                    
                    alert("Qaimə gözləmə siyahısından silindi!");
                    fetchWaitingList(); 
                } catch (err) {
                    console.error("Silərkən xəta baş verdi:", err);
                    alert("Xəta: Silmək mümkün olmadı.");
                }
            });

            waitingListContainer.appendChild(div);
        });
    } catch (error) {
        console.error("Xəta:", error);
    }
}

document.getElementById('btn-refresh').addEventListener('click', fetchWaitingList);
document.getElementById('btn-print').addEventListener('click', () => { window.print(); });

// PDF YÜKLƏMƏ
document.getElementById('btn-download').addEventListener('click', () => {
    const element = document.getElementById('printable-invoice');
    const customerName = customerInput.value.trim() || 'Qaime';
    const opt = {
        margin:       10,
        filename:     `Araz_Electron_${customerName}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().from(element).set(opt).save();
});

function resetForm() {
    customerInput.value = '';
    customerNameView.textContent = '_______________';
    invoiceItems = [{ name: '', qty: 1, price: 0 }];
    currentActiveDocId = null;
    renderItems();
}