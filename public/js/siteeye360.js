(function () {
  const currentPage = document.body.dataset.page || 'home';

  document.querySelectorAll('.nav-btn, .brand-btn, .hotspot').forEach(function (btn) {
    if (btn.dataset.page === currentPage) {
      btn.classList.add('active');
      btn.setAttribute('aria-current', 'page');
    }
  });

  const canvaArt = document.getElementById('canva-art');
  if (canvaArt && canvaArt.complete && canvaArt.naturalWidth === 0) {
    canvaArt.addEventListener('error', function () {
      window.location.replace('/overview.html');
    }, { once: true });
  }

  if (currentPage !== 'home') return;

  const panel = document.getElementById('alert-panel');
  const device = document.getElementById('device-unit');
  const mount = document.getElementById('mount-slot');
  const statusText = document.getElementById('alert-status-text');

  if (!panel || !device || !mount) return;

  let mounted = false;
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  function setMounted(state) {
    mounted = state;
    panel.classList.toggle('mounted', mounted);
    mount.classList.toggle('mounted', mounted);
    device.classList.toggle('mounted', mounted);
    device.classList.toggle('in-mount', mounted);

    if (mounted) {
      device.style.position = 'absolute';
      device.style.left = '50%';
      device.style.top = '50%';
      device.style.transform = 'translate(-50%, -50%)';
      device.style.cursor = 'default';
      mount.appendChild(device);
      statusText.textContent = 'Alert active — LED flashing';
    } else {
      device.style.position = '';
      device.style.left = '';
      device.style.top = '';
      device.style.transform = '';
      device.style.cursor = 'grab';
      document.querySelector('.mount-demo').insertBefore(device, mount);
      statusText.textContent = 'Seat in mount to activate';
    }
  }

  function isOverMount(rect) {
    const mountRect = mount.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (
      cx > mountRect.left &&
      cx < mountRect.right &&
      cy > mountRect.top &&
      cy < mountRect.bottom
    );
  }

  function onPointerDown(e) {
    if (mounted) {
      setMounted(false);
      return;
    }
    dragging = true;
    device.classList.add('dragging');
    const rect = device.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    device.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging || mounted) return;
    device.style.position = 'fixed';
    device.style.left = e.clientX - offsetX + 'px';
    device.style.top = e.clientY - offsetY + 'px';
    device.style.zIndex = '200';

    const rect = device.getBoundingClientRect();
    mount.classList.toggle('highlight', isOverMount(rect));
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    device.classList.remove('dragging');
    device.releasePointerCapture(e.pointerId);

    const rect = device.getBoundingClientRect();
    mount.classList.remove('highlight');

    if (isOverMount(rect)) {
      setMounted(true);
    } else {
      device.style.position = '';
      device.style.left = '';
      device.style.top = '';
      device.style.zIndex = '';
    }
  }

  device.addEventListener('pointerdown', onPointerDown);
  device.addEventListener('pointermove', onPointerMove);
  device.addEventListener('pointerup', onPointerUp);
  device.addEventListener('pointercancel', onPointerUp);

  mount.addEventListener('click', function () {
    if (!mounted) setMounted(true);
  });
})();
