/**
 * Keeps the site at its designed size, like a real handheld: no pinch zoom,
 * no double-tap zoom, no Ctrl/Cmd + wheel or +/- zoom.
 * The viewport meta handles Android; iOS Safari ignores it, so block the
 * gesture and double-tap events here too.
 */
(() => {
  const stop = (e) => e.preventDefault();
  // iOS Safari pinch
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, stop, { passive: false });
  // two-finger pinch on browsers that send touch events
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  // double-tap zoom
  let lastTap = 0;
  document.addEventListener('touchend', (e) => {
    const now = e.timeStamp;
    if (now - lastTap < 350 && e.cancelable && !e.target.closest('input, select, textarea, a, button, label')) e.preventDefault();
    lastTap = now;
  }, { passive: false });
  document.addEventListener('dblclick', stop, { passive: false });
  // trackpad pinch and Ctrl/Cmd + wheel on desktop
  window.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { passive: false });
  // Ctrl/Cmd + plus, minus, zero
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '_', '0'].includes(e.key)) e.preventDefault();
  });
})();
