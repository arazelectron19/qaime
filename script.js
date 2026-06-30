import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// Firebase məlumatların
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

// Cədvəli Sıra Nömrələri və Silmə Düyməsi ilə Ekrana Basmaq
function renderItems() {
    itemsBody.innerHTML = '';
    let grandTotal = 0;

    invoiceItems.forEach((item, index) => {
        const rowTotal = item.qty * item.price;
        grandTotal += rowTotal;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center row-index">${index + 1}</td>
            <td><input type="text" class="item-name" value="${item.name}" placeholder="Malın və ya xidmətin adı" data-index="${index}"></td>
            <td class="text-center"><input type="number" class="item-qty text-center" value="${item.qty}" data-index="${index}"></td>
            <td class="text-right"><input type="number" class="item-price text-right" value="${item.price}" data-index="${index}"></td>
            <td class="text-right font-medium">${rowTotal.toFixed(2)} AZN</td>
            <td class="text-center no-print">
                <button class="btn-delete-row" data-index="${index}">×</button>
            </td>
        `;
        itemsBody.appendChild(tr);
    });

    totalPriceView.textContent = grandTotal.toFixed(2);
    attachInputEvents();
}

function attachInputEvents() {
    document.querySelectorAll('.item-name').forEach(input => {
        input.addEventListener('input', (e) => {
            invoiceItems[e.target.dataset.index].name = e.target.value;
        });
    });

    document.querySelectorAll('.item-qty').forEach(input => {
        input.addEventListener('input', (e) => {
            invoiceItems[e.target.dataset.index].qty = Number(e.target.value) || 0;
            renderItems();
        });
    });

    document.querySelectorAll('.item-price').forEach(input => {
        input.addEventListener('input', (e) => {
            invoiceItems[e.target.dataset.index].price = Number(e.target.value) || 0;
            renderItems();
        });
    });

    // Sətir Silmə Hadisəsi
    document.querySelectorAll('.btn-delete-row').forEach(button => {
        button.addEventListener('click', (e) => {
            const indexToRemove = Number(e.target.dataset.index);
            // Əgər tək sətir qalıbsa, silmək əvəzinə içini təmizləsin
            if(invoiceItems.length === 1) {
                invoiceItems = [{ name: '', qty: 1, price: 0 }];
            } else {
                invoiceItems.splice(indexToRemove, 1);
            }
            renderItems();
        });
    });
}

btnAddItem.addEventListener('click', () => {
    invoiceItems.push({ name: '', qty: 1, price: 0 });
    renderItems();
});

// GÖZLƏMƏYƏ ALMA
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
            waitingListContainer.innerHTML = '<p style="font-size:12px; color:#9ca3af;">Gözləyən iş yoxdur.</p>';
            return;
        }

        querySnapshot.forEach((documentSnapshot) => {
            const data = documentSnapshot.data();
            const docId = documentSnapshot.id;

            const div = document.createElement('div');
            div.className = 'waiting-item';
            
            // İnformasiya bloku və sil düyməsini daxil edirik
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

            // "Sil" düyməsinə klik edəndə bazadan silmək (Silmə hadisəsi)
            div.querySelector('.btn-delete-waiting').addEventListener('click', async (e) => {
                e.stopPropagation(); // Üstdəki qaiməni yükləmə hadisəsinin işə düşməsini əngəlləyir
                
                const confirmDelete = confirm(`${data.customerName} adlı müştərinin qaiməsini gözləmədən silmək istədiyinizə əminsiniz?`);
                if (!confirmDelete) return;

                try {
                    // Firebase-dən sənədi silirik
                    await deleteDoc(doc(db, "waiting_invoices", docId));
                    
                    // Əgər silinən qaimə hal-hazırda ekranda açıqdırsa, ekranı da sıfırlasın
                    if (currentActiveDocId === docId) {
                        resetForm();
                    }
                    
                    alert("Qaimə gözləmə siyahısından silindi!");
                    fetchWaitingList(); // Siyahını yenilə
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