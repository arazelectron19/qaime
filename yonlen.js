// Əgər linkin sonunda index.html varsa, onu təhlükəsiz şəkildə silirik
if (window.location.pathname.endsWith('index.html')) {
    // Qovluq adını qorumaq üçün yalnız index.html hissəsini təmizləyirik
    const cleanUrl = window.location.pathname.replace('index.html', '');
    window.history.replaceState({}, document.title, cleanUrl);
}