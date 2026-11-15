// yuusef.com/epk — film grain, same as the main site.
(function grain() {
  const c = document.getElementById("grain");
  if (!c) return;
  const ctx = c.getContext("2d"), img = ctx.createImageData(c.width, c.height);
  function frame() {
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    ctx.putImageData(img, 0, 0);
  }
  frame();
  const still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!still) setInterval(frame, 90);
})();
