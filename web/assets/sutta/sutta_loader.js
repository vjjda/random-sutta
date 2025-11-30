
// Auto-generated Sutta Loader
(function() {
    const files = [
  "an.js",
  "dn.js",
  "kn/bv.js",
  "kn/cnd.js",
  "kn/cp.js",
  "kn/dhp.js",
  "kn/iti.js",
  "kn/ja.js",
  "kn/kp.js",
  "kn/mil.js",
  "kn/mnd.js",
  "kn/ne.js",
  "kn/pe.js",
  "kn/ps.js",
  "kn/pv.js",
  "kn/snp.js",
  "kn/tha-ap.js",
  "kn/thag.js",
  "kn/thi-ap.js",
  "kn/thig.js",
  "kn/ud.js",
  "kn/vv.js",
  "mn.js",
  "sn.js"
];
    
    // 1. Lấy src hiện tại và bỏ query param (?v=...)
    const currentSrc = document.currentScript.src.split('?')[0];
    
    // 2. Thay thế tên file để ra thư mục books/
    const basePath = currentSrc.replace('sutta_loader.js', 'books/');
    
    files.forEach(file => {
        const script = document.createElement('script');
        script.src = basePath + file;
        script.async = false;
        document.head.appendChild(script);
    });
})();
