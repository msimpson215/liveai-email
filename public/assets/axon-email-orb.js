/**
 * Live AI Dash Email — plate-on-Gmail-table popup helpers.
 * Gmail: images + links only. Conversation runs on liveai-email (Axon), not inside Google.
 */
(function (global) {
  var LAUNCH_PATH = '/launch.html';
  var PLATE_PATH = '/email-plate.html';
  var WIDTH = 450;
  var HEIGHT = 680;
  var WINDOW_NAME = 'axon_plate';

  function buildLaunchUrl(params, origin) {
    var base = (origin || (global.location && global.location.origin) || '') + LAUNCH_PATH;
    var q = new URLSearchParams();
    q.set('src', (params && params.src) || 'email');
    if (params && params.biz) q.set('biz', params.biz);
    if (params && params.tagline) q.set('tagline', params.tagline);
    return base + '?' + q.toString();
  }

  function buildPlateUrl(params, origin) {
    var base = (origin || (global.location && global.location.origin) || '') + PLATE_PATH;
    var q = new URLSearchParams();
    q.set('src', (params && params.src) || 'email');
    q.set('popup', '1');
    if (params && params.autostart) q.set('autostart', '1');
    if (params && params.biz) q.set('biz', params.biz);
    return base + '?' + q.toString();
  }

  function popupFeatures() {
    var left = Math.max(0, Math.round(((global.screen && global.screen.width) || 1200) - WIDTH) / 2);
    var top = Math.max(0, Math.round(((global.screen && global.screen.height) || 800) - HEIGHT) / 2);
    return (
      'popup=yes,width=' + WIDTH +
      ',height=' + HEIGHT +
      ',left=' + left +
      ',top=' + top +
      ',toolbar=no,menubar=no,location=no,status=no,resizable=yes,scrollbars=no'
    );
  }

  function centeredPopupFeatures() {
    return (
      'popup=yes,width=' + WIDTH +
      ',height=' + HEIGHT +
      ",left='+(screen.width-" + WIDTH + ")/2" +
      ",top='+(screen.height-" + HEIGHT + ")/2" +
      ',toolbar=no,menubar=no,location=no,status=no,resizable=yes,scrollbars=no'
    );
  }

  /** Opens the AI plate directly (best illusion over Gmail). */
  function openEmailOrb(params, origin) {
    var url = buildPlateUrl(params || {}, origin);
    return global.open(url, WINDOW_NAME, popupFeatures());
  }

  function javascriptHyperlink(params, origin) {
    var url = buildPlateUrl(params || {}, origin).replace(/'/g, '%27');
    return (
      "javascript:void(window.open('" +
      url +
      "','" +
      WINDOW_NAME +
      "'," +
      centeredPopupFeatures() +
      '))'
    );
  }

  function httpsHyperlink(params, origin) {
    return buildLaunchUrl(params || {}, origin);
  }

  global.AxonEmailOrb = {
    LAUNCH_PATH: LAUNCH_PATH,
    PLATE_PATH: PLATE_PATH,
    buildLaunchUrl: buildLaunchUrl,
    buildPlateUrl: buildPlateUrl,
    openEmailOrb: openEmailOrb,
    javascriptHyperlink: javascriptHyperlink,
    httpsHyperlink: httpsHyperlink
  };
})(typeof window !== 'undefined' ? window : this);
