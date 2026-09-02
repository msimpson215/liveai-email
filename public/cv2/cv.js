(function () {
  var btn = document.querySelector('.menu-btn');
  if (btn) {
    btn.addEventListener('click', function () {
      document.body.classList.toggle('nav-open');
    });
    document.addEventListener('click', function (e) {
      if (!document.body.classList.contains('nav-open')) return;
      if (e.target.closest('.site-header')) return;
      document.body.classList.remove('nav-open');
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('.clip-frame'), function (frame) {
    var video = frame.querySelector('.clip-player');
    if (!video) return;
    function waiting() { frame.classList.add('is-waiting'); }
    function ready() { frame.classList.remove('is-waiting'); }
    video.addEventListener('error', waiting);
    video.addEventListener('loadeddata', ready);
    var source = video.querySelector('source');
    if (source && source.getAttribute('src')) {
      fetch(source.getAttribute('src'), { method: 'HEAD' }).then(function (res) {
        if (!res.ok) waiting();
      }).catch(waiting);
    }
  });
})();
