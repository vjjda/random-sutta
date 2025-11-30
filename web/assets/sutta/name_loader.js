
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
    // Script này nằm tại assets/sutta/name_loader.js
    // basePath sẽ trỏ vào assets/sutta/names/
    const basePath = document.currentScript.src.replace('name_loader.js', 'names/');
    
    files.forEach(file => {
        const script = document.createElement('script');
        // file đã chứa relative path (vd: "kn/dhp-name.js" hoặc "mn-name.js")
        // nên nối vào basePath là chuẩn: ".../names/kn/dhp-name.js"
        script.src = basePath + file;
        script.async = false;
        document.head.appendChild(script);
    });
})();
