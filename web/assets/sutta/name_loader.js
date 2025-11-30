
// Auto-generated Name Loader
(function() {
    const files = [
  "an-name.js",
  "arv-name.js",
  "avs-name.js",
  "bv-name.js",
  "cnd-name.js",
  "cp-name.js",
  "d-name.js",
  "da-name.js",
  "da-ot-name.js",
  "dhp-name.js",
  "divy-name.js",
  "dn-name.js",
  "gdhp-name.js",
  "iti-name.js",
  "ja-name.js",
  "kp-name.js",
  "lal-name.js",
  "lzh-dharani-name.js",
  "lzh-ssnp-name.js",
  "lzh-svk-name.js",
  "ma-name.js",
  "mil-name.js",
  "mn-name.js",
  "mnd-name.js",
  "ne-name.js",
  "pdhp-name.js",
  "pe-name.js",
  "ps-name.js",
  "pv-name.js",
  "sf-name.js",
  "sn-name.js",
  "snp-name.js",
  "tha-ap-name.js",
  "thag-name.js",
  "thi-ap-name.js",
  "thig-name.js",
  "ud-name.js",
  "uv-name.js",
  "uvs-name.js",
  "vv-name.js",
  "ybs-name.js"
];
    // UPDATED: Script này ở assets/sutta/name_loader.js
    // Data files ở assets/sutta/names/*.js
    // -> thay 'name_loader.js' thành 'names/'
    const basePath = document.currentScript.src.replace('name_loader.js', 'names/');
    
    files.forEach(file => {
        const script = document.createElement('script');
        script.src = basePath + file;
        script.async = false;
        document.head.appendChild(script);
    });
})();
