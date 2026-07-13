if (window.location.pathname.endsWith('index.html')) {
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname.replace('index.html', '');
    window.history.replaceState({}, document.title, cleanUrl);
}