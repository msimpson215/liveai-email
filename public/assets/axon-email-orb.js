/**
 * Live AI Dash Email — 236px transparent popup over Gmail (orb only).
 * Gmail: images + links only. Voice runs on liveai-email (Axon), not inside Google.
 */
(function (g) {
  var PLATE = '/email-plate.html';
  var LAUNCH = '/launch.html';
  var NAME = 'axon_plate';
  var W = 236;
  var H = 236;

  function plateUrl(params, origin) {
    var q = new URLSearchParams();
    q.set('src', (params && params.src) || 'email');
    q.set('popup', '1');
    return (origin || g.location.origin) + PLATE + '?' + q;
  }

  function launchUrl(params, origin) {
    var q = new URLSearchParams();
    q.set('src', (params && params.src) || 'email');
    return (origin || g.location.origin) + LAUNCH + '?' + q;
  }

  function features() {
    var l = Math.round(((g.screen.width || 1200) - W) / 2);
    var t = Math.round(((g.screen.height || 800) - H) / 2);
    return 'popup=yes,width=' + W + ',height=' + H + ',left=' + l + ',top=' + t +
      ',toolbar=no,menubar=no,location=no,status=no,resizable=no,scrollbars=no,directories=no';
  }

  function jsFeatures() {
    return 'popup=yes,width=' + W + ',height=' + H +
      ",left='+(screen.width-" + W + ")/2,top='+(screen.height-" + H + ")/2" +
      ',toolbar=no,menubar=no,location=no,status=no,resizable=no,scrollbars=no,directories=no';
  }

  function openEmailOrb(params, origin) {
    return g.open(plateUrl(params, origin), NAME, features());
  }

  g.AxonEmailOrb = {
    openEmailOrb: openEmailOrb,
    buildPlateUrl: plateUrl,
    buildLaunchUrl: launchUrl,
    httpsHyperlink: launchUrl,
    javascriptHyperlink: function (params, origin) {
      var u = plateUrl(params, origin).replace(/'/g, '%27');
      return "javascript:void(window.open('" + u + "','" + NAME + "'," + jsFeatures() + '))';
    }
  };
})(typeof window !== 'undefined' ? window : this);
