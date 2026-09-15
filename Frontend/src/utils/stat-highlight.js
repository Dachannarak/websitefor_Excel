/* อัตโนมัติกำหนด data-has="1|0" ให้ .stat-box
 * เมื่อตัวเลขใน .stat-n เปลี่ยน */
(function initStatHighlight() {
    if (typeof window === "undefined") return;

    const mark = () => {
        document.querySelectorAll(".stat-box").forEach((box) => {
          // หา .stat-n ข้างในเก็บตัวเลข
          const numEl = box.querySelector(".stat-n");
          if (!numEl) {
            box.setAttribute("data-has", "0");
            return;
          }

          // ดึงตัวเลขออก 
          const text = numEl.textContent || "";
          const value = parseInt(text.replace(/[^0-9]/g, ""), 10);

          // ใส่ data-has
          const hasValue = value > 0 ? "1" : "0";
          box.setAttribute("data-has", hasValue);
        });
     };

     const start = () => {
        mark();

        // ใช้ MutationObserver เฝ้าดู DOM เมื่อตัวเลขเปลี่ยน
        if (window.__statHighlightObserver) {
            window.__statHighlightObserver.disconnect();
        }

        window.__statHighlightObserver = new MutationObserver(mark);
        window.__statHighlightObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
        });  
     };

     // เรียก start เมื่อ DOM พร้อม
     if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
     } else {
        start();
     }
})();
