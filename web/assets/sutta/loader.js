// Path: web/assets/sutta/loader.js

// Auto-generated Loader
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
    const basePath = document.currentScript.src.replace('loader.js', 'books/');
    
    files.forEach(file => {
        const script = document.createElement('script');
        script.src = basePath + file;
        script.async = false;
        document.head.appendChild(script);
    });
})();
