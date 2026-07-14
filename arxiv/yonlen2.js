if (window.location.pathname.endsWith('arxiv.html')) {
    // arxiv.html hissəsini silərək linki sadəcə /arxiv/ edirik
    const cleanUrl = window.location.pathname.replace('arxiv.html', '');
    window.history.replaceState({ path: 'arxiv.html' }, document.title, cleanUrl);
}