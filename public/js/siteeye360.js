(function () {
  const currentPage = document.body.dataset.page || 'home';

  document.querySelectorAll('.nav-btn, .brand-btn, .brand-overlay, .hotspot').forEach(function (btn) {
    if (btn.dataset.page === currentPage) {
      btn.classList.add('active');
      btn.setAttribute('aria-current', 'page');
    }
  });

})();
