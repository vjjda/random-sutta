
// Auto-generated Name Loader
(function() {
    const files = [
  "an-name.js",
  "dn-name.js",
  "kn/bv-name.js",
  "kn/cnd-name.js",
  "kn/cp-name.js",
  "kn/dhp-name.js",
  "kn/iti-name.js",
  "kn/ja-name.js",
  "kn/kp-name.js",
  "kn/mil-name.js",
  "kn/mnd-name.js",
  "kn/ne-name.js",
  "kn/pe-name.js",
  "kn/ps-name.js",
  "kn/pv-name.js",
  "kn/snp-name.js",
  "kn/tha-ap-name.js",
  "kn/thag-name.js",
  "kn/thi-ap-name.js",
  "kn/thig-name.js",
  "kn/ud-name.js",
  "kn/vv-name.js",
  "mn-name.js",
  "sn-name.js"
];
    
    // 1. Lấy src hiện tại và bỏ query param (?v=...)
    const currentSrc = document.currentScript.src.split('?')[0];
    
    // 2. Thay thế tên file để ra thư mục names/
    const basePath = currentSrc.replace('name_loader.js', 'names/');
    
    files.forEach(file => {
        const script = document.createElement('script');
        script.src = basePath + file;
        script.async = false;
        document.head.appendChild(script);
    });
})();
