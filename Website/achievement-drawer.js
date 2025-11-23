document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('achievement-toggle-btn');
    const panel = document.getElementById('achievement-panel');
    const ICON_TROPHY = '🏆';
    const ICON_MINIMIZE = '❌';

    if (toggleBtn && panel) {
        toggleBtn.addEventListener('click', () => {
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) {
                toggleBtn.textContent = ICON_MINIMIZE;
                toggleBtn.setAttribute('aria-label', 'Close achievements panel');
            } else {
                toggleBtn.textContent = ICON_TROPHY;
                toggleBtn.setAttribute('aria-label', 'Open achievements panel');
            }
        });
    }
});