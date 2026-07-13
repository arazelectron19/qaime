import { db, collection, getDocs, query, orderBy } from "../firbase.js";
// Firebase-dən silmə funksiyalarını birbaşa rəsmi CDN-dən çəkirik
import { deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const archiveTbody = document.getElementById('archive-tbody');
const btnFilter = document.getElementById('btn-filter');
const btnClear = document.getElementById('btn-clear');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');

// Cədvəlin başlığındakı Əməliyyatlar sütununu tapırıq
const actionHeader = document.querySelector('table thead tr th:nth-child(4)');
if (actionHeader) {
    actionHeader.innerHTML = `<span id="th-delete-trigger" style="cursor:pointer; color:#ef4444; border-bottom:1px dashed #ef4444; padding-bottom:2px;">SİL</span>`;
}

let allInvoices = [];
let isSelectMode = false; // Seçim rejiminin aktiv olub-olmadığını izləyirik
let searchInput = null;   // Axtarış inputu üçün dəyişən

document.addEventListener('DOMContentLoaded', () => {
    flatpickr("#start-date", { locale: "az", dateFormat: "Y-m-d" });
    flatpickr("#end-date", { locale: "az", dateFormat: "Y-m-d" });
    
    initSearchInput(); // Axtarış qutusunu yaradırıq
    fetchArchiveList();
    initDeleteTrigger();
});

// "TƏMİZLƏ" DÜYMƏSİNİN YANINA MODERN AXTARIŞ QUTUSUNUN ƏLAVƏ EDİLMƏSİ
function initSearchInput() {
    const container = btnClear?.parentElement;
    if (!container) return;

    // Elementlərin yerinə tam sıxışması üçün boşluğu 5px edirik
    container.style.display = "flex";
    container.style.flexWrap = "nowrap";
    container.style.alignItems = "center";
    container.style.gap = "5px";

    searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'archive-search-input';
    searchInput.placeholder = 'Müştəri adı...';
    
    searchInput.style.cssText = `
        background: #0f172a;
        border: 1px solid #1e293b;
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 14px;
        outline: none;
        width: 150px;
        flex-shrink: 1;
        transition: border-color 0.2s, box-shadow 0.2s;
    `;

    searchInput.addEventListener('focus', () => {
        searchInput.style.borderColor = '#5bc0be';
        searchInput.style.boxShadow = '0 0 6px rgba(91, 192, 190, 0.3)';
    });
    searchInput.addEventListener('blur', () => {
        searchInput.style.borderColor = '#1e293b';
        searchInput.style.boxShadow = 'none';
    });

    searchInput.addEventListener('input', () => {
        applyAllFilters();
    });

    container.appendChild(searchInput);
}

async function fetchArchiveList() {
    archiveTbody.innerHTML = `
        <tr>
            <td colspan="4">
                <div class="loading-wrapper">
                    <div class="sharp-ring-loader"></div>
                </div>
            </td>
        </tr>
    `;

    try {
        let q = query(collection(db, "history_invoices"), orderBy("timestamp", "desc"));
        let snap = await getDocs(q);
        
        if(snap.empty) {
            q = query(collection(db, "invoices"), orderBy("timestamp", "desc"));
            snap = await getDocs(q);
        }

        archiveTbody.innerHTML = '';
        allInvoices = [];

        if (snap.empty) {
            archiveTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#9ca3af; padding: 25px;">Arxivdə heç bir sənəd tapılmadı.</td></tr>';
            return;
        }

        snap.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            data.id = docSnapshot.id;
            allInvoices.push(data);
        });

        renderArchiveTable(allInvoices);

    } catch (error) {
        console.error("Xəta:", error);
        archiveTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#ef4444; padding: 25px;">Məlumatlar gəlmədi. Firebase yollarını yoxlayın.</td></tr>';
    }
}

function renderArchiveTable(dataArray) {
    archiveTbody.innerHTML = '';

    if (dataArray.length === 0) {
        archiveTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#9ca3af; padding: 25px;">Axtarışa uyğun sənəd tapılmadı.</td></tr>';
        return;
    }

    dataArray.forEach((data) => {
        let dateStr = "---";
        if (data.timestamp) {
            const t = data.timestamp.toDate();
            dateStr = t.toLocaleDateString('az-AZ') + " " + t.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
        }

        const tr = document.createElement('tr');
        tr.setAttribute('data-id', data.id);
        
        tr.innerHTML = `
            <td class="date-cell" style="display: flex; align-items: center; gap: 10px;">
                <label class="custom-checkbox-wrapper" style="display: ${isSelectMode ? 'inline-flex' : 'none'};">
                    <input type="checkbox" class="archive-select-checkbox" data-id="${data.id}">
                    <span class="checkmark"></span>
                </label>
                <span class="date-text">${dateStr}</span>
            </td>
            <td style="font-weight: 700;">${data.customerName || 'Naməlum Müştəri'}</td>
            <td style="text-align: right; font-weight: bold; color: #5bc0be;">${Number(data.totalAmount || 0).toFixed(2)} AZN</td>
            <td style="text-align: center; position: relative;">
                <div class="action-cell-buttons">
                    <button class="btn-download">Yüklə (PDF)</button>
                    <button class="btn-print-row">Çap Et</button>
                    <button class="btn-delete-archive">Sil</button>
                </div>
            </td>
        `;

        tr.querySelector('.btn-download').addEventListener('click', () => { exportToPDF(data, dateStr); });
        tr.querySelector('.btn-print-row').addEventListener('click', () => { printInvoice(data, dateStr); });

        const btnDelete = tr.querySelector('.btn-delete-archive');
        const actionCell = tr.querySelector('.action-cell-buttons');

        btnDelete.addEventListener('click', () => {
            btnDelete.style.display = 'none';

            const confirmBox = document.createElement('div');
            confirmBox.className = 'archive-confirm-box';
            confirmBox.innerHTML = `
                <span>Silinsin?</span>
                <button class="btn-yes">Bəli</button>
                <button class="btn-no">Xeyr</button>
            `;

            confirmBox.querySelector('.btn-yes').addEventListener('click', async () => {
                try {
                    await deleteDoc(doc(db, "history_invoices", data.id)).catch(async () => {
                        await deleteDoc(doc(db, "invoices", data.id));
                    });
                    
                    tr.remove();
                    allInvoices = allInvoices.filter(inv => inv.id !== data.id);
                    
                    if(allInvoices.length === 0) {
                        archiveTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#9ca3af; padding: 25px;">Arxivdə heç bir sənəd tapılmadı.</td></tr>';
                    }
                } catch (err) {
                    alert("Silərkən xəta baş verdi!");
                    console.error(err);
                }
            });

            confirmBox.querySelector('.btn-no').addEventListener('click', () => {
                confirmBox.remove();
                btnDelete.style.display = 'inline-block';
            });

            actionCell.appendChild(confirmBox);
        });

        archiveTbody.appendChild(tr);
    });
}

// HƏM TARİX, HƏM DƏ AXTARIŞ FİLTRİNİ BİRGƏ İŞLƏDƏN FUNKSİYA
function applyAllFilters() {
    const startVal = startDateInput.value;
    const endVal = endDateInput.value;
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : "";

    let filtered = allInvoices.filter(invoice => {
        // 1. Tarix Filtri yoxlanışı
        if (startVal || endVal) {
            if (!invoice.timestamp) return false;
            const checkDate = invoice.timestamp.toDate().toISOString().split('T')[0];
            if (startVal && endVal && (checkDate < startVal || checkDate > endVal)) return false;
            if (startVal && !endVal && checkDate < startVal) return false;
            if (!startVal && endVal && checkDate > endVal) return false;
        }

        // 2. Canlı Axtarış Filtri yoxlanışı
        if (searchVal) {
            const customerName = (invoice.customerName || 'naməlum müştəri').toLowerCase();
            if (!customerName.includes(searchVal)) return false;
        }

        return true;
    });

    renderArchiveTable(filtered);
}

function initDeleteTrigger() {
    const trigger = document.getElementById('th-delete-trigger');
    const filterBtnContainer = btnClear?.parentElement;
    
    if (!trigger || !filterBtnContainer) return;

    let btnSelectAll = document.getElementById('btn-select-all-dynamic');
    let btnBulkDelete = document.getElementById('btn-bulk-delete') || document.getElementById('btn-bulk-delete-dynamic');
    
    if (btnSelectAll) btnSelectAll.remove();
    if (btnBulkDelete) btnBulkDelete.remove();

    btnSelectAll = document.createElement('button');
    btnSelectAll.id = 'btn-select-all-dynamic';
    btnSelectAll.textContent = 'Hamısını Seç';
    
    // Düymənin enini 120px edirik, daxili boşluğunu yığırıq və fontunu 12px edirik ki mətnlər yerləşsin
    btnSelectAll.style.cssText = "background-color: #0f2d2a; color: #5bc0be; border: 1px solid #5bc0be; padding: 6px 0; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px; display: none; transition: background 0.2s; white-space: nowrap; flex-shrink: 0; width: 120px; text-align: center; box-sizing: border-box;";
    
    const bulkActionWrapper = document.createElement('div');
    bulkActionWrapper.id = 'bulk-action-wrapper';
    bulkActionWrapper.style.cssText = "display: none; vertical-align: middle; flex-shrink: 0;";

    btnBulkDelete = document.createElement('button');
    btnBulkDelete.id = 'btn-bulk-delete';
    btnBulkDelete.textContent = 'Sil';
    // Sil düyməsinin enini 80px-ə endiririk
    btnBulkDelete.style.cssText = "background-color: #3b141a; color: #ef4444; border: 1px solid #ef4444; padding: 6px 0; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px; transition: background 0.2s; width: 80px; text-align: center; flex-shrink: 0; box-sizing: border-box;";

    bulkActionWrapper.appendChild(btnBulkDelete);
    filterBtnContainer.appendChild(btnSelectAll);
    filterBtnContainer.appendChild(bulkActionWrapper);

    // HƏR BİR CHECKBOX DƏYİŞƏNDƏ "HAMISINI SEÇ" DÜYMƏSİNİN MƏTNİNİ YENİLƏYƏN FUNKSİYA
    function updateSelectAllButtonText() {
        const checkboxes = document.querySelectorAll('.archive-select-checkbox');
        if (checkboxes.length === 0) return;
        
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        if (allChecked) {
            btnSelectAll.textContent = 'Seçimi Ləğv Et';
        } else {
            btnSelectAll.textContent = 'Hamısını Seç';
        }
    }

    trigger.addEventListener('click', () => {
        const wrappers = document.querySelectorAll('.custom-checkbox-wrapper');
        const checkboxes = document.querySelectorAll('.archive-select-checkbox');
        
        if (!isSelectMode) {
            isSelectMode = true;
            trigger.textContent = "BAĞLA ✕";
            
            wrappers.forEach(wrap => wrap.style.display = 'inline-flex');
            btnSelectAll.style.display = 'inline-block';
            bulkActionWrapper.style.display = 'inline-flex';

            // Checkboxlara tək-tək kliklənmə hadisəsini dinləyirik
            checkboxes.forEach(cb => {
                cb.removeEventListener('change', updateSelectAllButtonText);
                cb.addEventListener('change', updateSelectAllButtonText);
            });
            updateSelectAllButtonText();
        } else {
            isSelectMode = false;
            trigger.textContent = "SİL";
            
            wrappers.forEach(wrap => wrap.style.display = 'none');
            checkboxes.forEach(cb => cb.checked = false);
            btnSelectAll.textContent = 'Hamısını Seç';
            btnSelectAll.style.display = 'none';
            bulkActionWrapper.style.display = 'none';
            resetBulkDeleteButton();
        }
    });

    btnSelectAll.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.archive-select-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);

        if (allChecked) {
            checkboxes.forEach(cb => cb.checked = false);
            btnSelectAll.textContent = 'Hamısını Seç';
        } else {
            checkboxes.forEach(cb => cb.checked = true);
            btnSelectAll.textContent = 'Seçimi Ləğv Et';
        }
    });

    function resetBulkDeleteButton() {
        bulkActionWrapper.innerHTML = '';
        bulkActionWrapper.appendChild(btnBulkDelete);
        btnBulkDelete.style.display = 'inline-block';
    }

    btnBulkDelete.addEventListener('click', () => {
        const checkedBoxes = document.querySelectorAll('.archive-select-checkbox:checked');
        
        if (checkedBoxes.length === 0) {
            alert("Zəhmət olmasa silmək istədiyiniz qaimələri sol tərəfdən işarələyin!");
            return;
        }

        btnBulkDelete.style.display = 'none';

        const confirmContainer = document.createElement('div');
        // Təsdiq panelinin enini düymə ilə eyni (80px) saxlayırıq
        confirmContainer.style.cssText = "display: flex; align-items: center; justify-content: center; gap: 4px; background: #1e1b29; border: 1px solid #ef4444; padding: 4px; border-radius: 6px; width: 80px; box-sizing: border-box; flex-shrink: 0;";
        confirmContainer.innerHTML = `
            <button class="btn-bulk-yes" style="background: #ef4444; color: #fff; border: none; padding: 4px 0; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px; flex: 1; text-align: center; white-space: nowrap;">Bəli</button>
            <button class="btn-bulk-no" style="background: #27272a; color: #a1a1aa; border: 1px solid #3f3f46; padding: 4px 0; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px; flex: 1; text-align: center; white-space: nowrap;">Xeyr</button>
        `;

        confirmContainer.querySelector('.btn-bulk-yes').addEventListener('click', async () => {
            const currentChecked = document.querySelectorAll('.archive-select-checkbox:checked');
            if (currentChecked.length === 0) return;

            confirmContainer.innerHTML = `<span style="color: #ef4444; font-size: 11px; font-weight: bold; white-space: nowrap;">...</span>`;

            const deletePromises = Array.from(currentChecked).map(async (cb) => {
                const id = cb.getAttribute('data-id');
                return deleteDoc(doc(db, "history_invoices", id)).catch(async () => {
                    await deleteDoc(doc(db, "invoices", id));
                }).then(() => {
                    const tr = document.querySelector(`tr[data-id="${id}"]`);
                    if (tr) tr.remove();
                    allInvoices = allInvoices.filter(inv => inv.id !== id);
                });
            });

            Promise.all(deletePromises).then(() => {
                isSelectMode = false;
                trigger.textContent = "SİL";
                btnSelectAll.textContent = 'Hamısını Seç';
                
                btnSelectAll.style.display = 'none';
                bulkActionWrapper.style.display = 'none';
                resetBulkDeleteButton();
                
                const wrappers = document.querySelectorAll('.custom-checkbox-wrapper');
                wrappers.forEach(wrap => wrap.style.display = 'none');

                if (allInvoices.length === 0) {
                    archiveTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#9ca3af; padding: 25px;">Arxivdə heç bir sənəd tapılmadı.</td></tr>';
                }
            }).catch(err => {
                alert("Silmə zamanı xəta!");
                console.error(err);
                resetBulkDeleteButton();
            });
        });

        confirmContainer.querySelector('.btn-bulk-no').addEventListener('click', () => {
            resetBulkDeleteButton();
        });

        bulkActionWrapper.appendChild(confirmContainer);
    });
}

function buildInvoiceHTML(data, dateStr) {
    let itemsHTML = '';
    if (data.items && data.items.length > 0) {
        data.items.forEach((item, index) => {
            itemsHTML += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px 5px; text-align: center; font-size: 13px;">${index + 1}</td>
                    <td style="padding: 10px 5px; text-align: left; font-size: 13px;">${item.name || '---'}</td>
                    <td style="padding: 10px 5px; text-align: center; font-size: 13px;">${item.qty}</td>
                    <td style="padding: 10px 5px; text-align: right; font-size: 13px;">${Number(item.price).toFixed(2)}</td>
                    <td style="padding: 10px 5px; text-align: right; font-weight: 700; font-size: 13px;">${(item.qty * item.price).toFixed(2)}</td>
                </tr>`;
        });
    }

    return `
        <div style="padding: 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #000; background: #fff; min-height: 842px; position: relative; box-sizing: border-box;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 45px;">
                <tr>
                    <td style="vertical-align: top; width: 50%;">
                        <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; letter-spacing: 0.5px; color: #000;">SATIŞ QAİMƏSİ</h1>
                        <div style="font-size: 10px; color: #666; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">KİMƏ (MÜŞTƏRİ):</div>
                        <div style="font-size: 15px; font-weight: 700; border-bottom: 1px solid #1e293b; padding-bottom: 4px; width: 260px; word-wrap: break-word;">
                            ${data.customerName || '_______________'}
                        </div>
                        <div style="font-size: 12px; color: #444; margin-top: 10px;">
                            <strong>Tarix:</strong> ${dateStr}
                        </div>
                    </td>
                    <td style="text-align: right; vertical-align: top; width: 50%; font-size: 12px; line-height: 1.5; color: #444;">
                        <div style="font-size: 19px; font-weight: 800; color: #000; margin-bottom: 4px; letter-spacing: 0.5px;">ARAZ ELECTRON</div>
                        <div style="font-size: 11px; color: #666; margin-bottom: 6px;">Elektronika və Texniki Dəstək Xidmətləri</div>
                        <div>📍 Beyləqan r. Magistral yol</div>
                        <div>🌐 arazelectron.com</div>
                        <div>✉️ info@arazelectron.com</div>
                        <div>📞 +994505946771</div>
                    </td>
                </tr>
            </table>

            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="border-bottom: 1.5px solid #1e293b;">
                        <th style="padding: 8px 5px; text-align: center; font-size: 11px; font-weight: 700; width: 5%;">#</th>
                        <th style="padding: 8px 5px; text-align: left; font-size: 11px; font-weight: 700; width: 50%;">MƏHSULUN ADI</th>
                        <th style="padding: 8px 5px; text-align: center; font-size: 11px; font-weight: 700; width: 15%;">MİQDAR</th>
                        <th style="padding: 8px 5px; text-align: right; font-size: 11px; font-weight: 700; width: 15%;">QİYMƏT</th>
                        <th style="padding: 8px 5px; text-align: right; font-size: 11px; font-weight: 700; width: 15%;">CƏMİ</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>

            <table style="width: 100%; border-collapse: collapse; margin-top: 50px;">
                <tr>
                    <td style="vertical-align: middle; width: 50%;">
                        <img src="../mohur.png" alt="Möhür" style="width: 120px; height: auto; opacity: 0.95;" onerror="this.style.display='none';">
                    </td>
                    <td style="text-align: right; vertical-align: middle; width: 50%;">
                        <span style="font-size: 15px; color: #333;">Yekun Ödəniş:</span>
                        <span style="font-size: 22px; font-weight: 800; color: #000; margin-left: 10px;">
                            ${Number(data.totalAmount || 0).toFixed(2)} AZN
                        </span>
                    </td>
                </tr>
            </table>

            <div style="text-align: center; font-size: 11px; color: #555; margin-top: 90px; font-weight: 600; width: 100%;">
                Araz Electron bizi seçdiyiniz üçün təşəkkür edir!
            </div>
        </div>
    `;
}

function exportToPDF(data, dateStr) {
    const element = document.createElement('div');
    element.innerHTML = buildInvoiceHTML(data, dateStr);
    html2pdf().from(element).save(`qaime-${data.customerName || 'arxiv'}.pdf`);
}

function printInvoice(data, dateStr) {
    const printContainer = document.createElement('div');
    printContainer.id = 'dynamic-print-zone';
    printContainer.innerHTML = buildInvoiceHTML(data, dateStr);
    document.body.appendChild(printContainer);

    window.print();
    printContainer.remove();
}

// "FİLTRLƏ" DÜYMƏSİNƏ KLİKLƏYƏNDƏ TARİXİ AKTİV EDİR
btnFilter.addEventListener('click', () => {
    applyAllFilters();
});

btnClear.addEventListener('click', () => {
    startDateInput.value = '';
    endDateInput.value = '';
    if (searchInput) searchInput.value = '';
    isSelectMode = false;
    
    const trigger = document.getElementById('th-delete-trigger');
    if (trigger) trigger.textContent = "SİL";
    
    const wrappers = document.querySelectorAll('.custom-checkbox-wrapper');
    const checkboxes = document.querySelectorAll('.archive-select-checkbox');
    wrappers.forEach(wrap => wrap.style.display = 'none');
    checkboxes.forEach(cb => cb.checked = false);
    
    const btnSelectAll = document.getElementById('btn-select-all-dynamic');
    if (btnSelectAll) {
        btnSelectAll.textContent = 'Hamısını Seç';
        btnSelectAll.style.display = 'none';
    }
    
    const bulkActionWrapper = document.getElementById('bulk-action-wrapper');
    if (bulkActionWrapper) bulkActionWrapper.style.display = 'none';
    
    const mainDeleteBtn = document.getElementById('btn-bulk-delete');
    const actionWrap = document.getElementById('bulk-action-wrapper');
    if (actionWrap && mainDeleteBtn) {
        actionWrap.innerHTML = '';
        actionWrap.appendChild(mainDeleteBtn);
        mainDeleteBtn.style.display = 'inline-block';
        actionWrap.style.display = 'none';
    }
    
    renderArchiveTable(allInvoices);
});