/**
 * Share links point at a viewer page, not at the file.
 *
 * Someone handing over artwork will paste whatever the Share button gave them,
 * so these rewrite the common ones to the address that actually returns the
 * image. Anything unrecognised is passed through untouched.
 */

function directImageUrl(url) {
  const host = url.hostname.toLowerCase()

  if (host.endsWith('drive.google.com')) {
    const id = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get('id')
    if (id) return new URL(`https://drive.google.com/uc?export=download&id=${id}`)
  }
  if (host.endsWith('dropbox.com')) {
    const direct = new URL(url.href)
    direct.searchParams.set('dl', '1')
    return direct
  }
  if (host === 'github.com') {
    return new URL(`https://raw.githubusercontent.com${url.pathname.replace('/blob/', '/')}`)
  }
  return url
}

/**
 * The server is about to make an outbound request because someone pasted a
 * link, so the obvious abuses are refused: anything that is not http(s), and
 * anything pointing at the machine itself or the private network around it.
 */
function refuseInternal(url) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https links.')
  const host = url.hostname.toLowerCase()
  const internal =
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host === '[::1]' ||
    /^(0|10|127)\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  if (internal) throw new Error('That link points inside the server.')
  return url
}

export { directImageUrl, refuseInternal }
