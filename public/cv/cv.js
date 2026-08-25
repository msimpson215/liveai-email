(function () {
  var btn = document.querySelector('.menu-btn');
  if (!btn) return;
  btn.addEventListener('click', function () {
    document.body.classList.toggle('nav-open');
  });
  document.addEventListener('click', function (e) {
    if (!document.body.classList.contains('nav-open')) return;
    if (e.target.closest('.site-header')) return;
    document.body.classList.remove('nav-open');
  });
})();
