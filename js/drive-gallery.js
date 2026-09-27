window.DriveGallery = (function () {
  "use strict";

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function thumbUrl(id, size) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${size}`;
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cbName =
        "__dgCb_" + Math.random().toString(36).slice(2);

      const script = document.createElement("script");
      let settled = false;

      function cleanup() {
        delete window[cbName];
        script.remove();
      }

      window[cbName] = function (data) {
        if (settled) return;

        settled = true;
        cleanup();

        console.log("DriveGallery: Apps Script response:", data);

        resolve(data);
      };

      script.onerror = function () {
        if (settled) return;

        settled = true;
        cleanup();

        reject(
          new Error(
            "فشل تحميل Google Apps Script عبر JSONP"
          )
        );
      };

      const separator =
        url.indexOf("?") >= 0 ? "&" : "?";

      script.src =
        url +
        separator +
        "callback=" +
        encodeURIComponent(cbName);

      console.log(
        "DriveGallery: requesting:",
        script.src
      );

      document.body.appendChild(script);

      setTimeout(() => {
        if (settled) return;

        settled = true;
        cleanup();

        reject(
          new Error(
            "انتهت مهلة الاتصال بـ Google Apps Script بعد 10 ثوانٍ"
          )
        );
      }, 10000);
    });
  }

  async function loadItems(pageFolderId, scriptUrl) {

    if (!pageFolderId) {
      throw new Error("DRIVE_FOLDER_ID غير موجود");
    }

    if (!scriptUrl) {
      throw new Error("DRIVE_SCRIPT_URL غير موجود");
    }

    const separator =
      scriptUrl.indexOf("?") >= 0 ? "&" : "?";

    const url =
      scriptUrl +
      separator +
      "folderId=" +
      encodeURIComponent(pageFolderId);

    console.log(
      "DriveGallery: folder ID:",
      pageFolderId
    );

    console.log(
      "DriveGallery: Apps Script URL:",
      url
    );

    const data = await jsonp(url);

    if (!data) {
      throw new Error(
        "Google Apps Script أعاد استجابة فارغة"
      );
    }

    if (data.error) {
      throw new Error(
        "Google Apps Script Error: " +
        data.error
      );
    }

    if (!Array.isArray(data.files)) {
      throw new Error(
        "الاستجابة لا تحتوي على files[]"
      );
    }

    console.log(
      "DriveGallery: عدد الملفات:",
      data.files.length
    );

    return data.files.map(function (f) {

      if (!f.id) {
        console.warn(
          "DriveGallery: ملف بدون ID:",
          f
        );
      }

      return {
        id: f.id,
        type: f.type === "video"
          ? "video"
          : "photo",

        thumb: f.id
          ? thumbUrl(f.id, 800)
          : "",

        full: f.id
          ? thumbUrl(f.id, 1600)
          : "",

        caption: f.caption || ""
      };
    });
  }

  function ensureLightbox() {

    let box =
      document.getElementById("dgLightbox");

    if (box) return box;

    box = document.createElement("div");

    box.id = "dgLightbox";
    box.className = "lightbox";
    box.hidden = true;

    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");

    box.innerHTML =
      '<button class="x" type="button" aria-label="Close">×</button>' +
      '<figure id="dgFig"></figure>';

    document.body.appendChild(box);

    const fig =
      box.querySelector("#dgFig");

    const xBtn =
      box.querySelector(".x");

    function close() {
      box.hidden = true;
      fig.innerHTML = "";
    }

    box.addEventListener("click", function (e) {

      if (
        e.target === box ||
        e.target === xBtn
      ) {
        close();
      }

    });

    document.addEventListener(
      "keydown",
      function (e) {

        if (
          e.key === "Escape" &&
          !box.hidden
        ) {
          close();
        }

      }
    );

    box._open = function (item) {

      if (item.type === "video") {

        fig.innerHTML =
          `<iframe
            src="https://drive.google.com/file/d/${encodeURIComponent(item.id)}/preview"
            allow="autoplay"
            style="
              width:min(1100px,92vw);
              height:min(70vh,620px);
              border:0;
              border-radius:22px;
              box-shadow:0 30px 70px -30px rgba(20,23,58,.6);
            ">
          </iframe>`;

      } else {

        fig.innerHTML =
          `<img
            src="${esc(item.full)}"
            alt=""
            style="
              max-width:92vw;
              max-height:75vh;
              object-fit:contain;
              border-radius:22px;
              display:block;
            ">`;
      }

      const cap =
        document.createElement("figcaption");

      cap.textContent =
        item.caption || "";

      fig.appendChild(cap);

      box.hidden = false;

      xBtn.focus();
    };

    return box;
  }

  const ICONS = {

    photo:
      '<rect x="3" y="5" width="18" height="14" rx="2"/>' +
      '<circle cx="9" cy="11" r="2"/>' +
      '<path d="M21 16l-5-5-8 8"/>',

    video:
      '<circle cx="12" cy="12" r="9"/>' +
      '<path d="M10 8.5l6 3.5-6 3.5z"/>'
  };

  async function tryRender(
    containerEl,
    folderId,
    scriptUrl,
    spans,
    colors
  ) {

    console.log(
      "DriveGallery: tryRender بدأ"
    );

    if (!containerEl) {
      console.error(
        "DriveGallery: containerEl غير موجود"
      );
      return false;
    }

    if (!folderId) {
      console.error(
        "DriveGallery: folderId غير موجود"
      );
      return false;
    }

    if (!scriptUrl) {
      console.error(
        "DriveGallery: scriptUrl غير موجود"
      );
      return false;
    }

    let items;

    try {

      items =
        await loadItems(
          folderId,
          scriptUrl
        );

    } catch (e) {

      console.error(
        "DriveGallery: فشل جلب الملفات",
        e
      );

      return false;
    }

    if (!items.length) {

      console.warn(
        "DriveGallery: Google Drive لم يُرجع أي ملفات"
      );

      return false;
    }

    const SPANS =
      spans && spans.length
        ? spans
        : [6, 6, 3, 6, 3];

    const COLORS =
      colors && colors.length
        ? colors
        : [
            "#6D4BFF",
            "#FF4D8D",
            "#16B8E0",
            "#FF9A1F",
            "#10C38B"
          ];

    ensureLightbox();

    containerEl.innerHTML =
      items
        .map(function (it, i) {

          const span =
            SPANS[i % SPANS.length];

          const c =
            COLORS[i % COLORS.length];

          return `
            <button
              class="b-tile"
              type="button"
              data-i="${i}"
              style="--span:${span};--c:${c}"
            >

              ${
                it.thumb
                  ? `
                    <img
                      src="${esc(it.thumb)}"
                      alt=""
                      loading="lazy"
                      style="
                        width:100%;
                        height:100%;
                        object-fit:cover;
                        display:block;
                      "
                    >
                  `
                  : `
                    <span
                      class="gorb"
                      style="--sz:64px"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        ${ICONS[it.type]}
                      </svg>
                    </span>
                  `
              }

              ${
                it.type === "video"
                  ? `
                    <span class="play">
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        ${ICONS.video}
                      </svg>
                    </span>
                  `
                  : ""
              }

              ${
                it.caption
                  ? `
                    <span class="cap">
                      ${esc(it.caption)}
                    </span>
                  `
                  : ""
              }

            </button>
          `;
        })
        .join("");

    const box =
      document.getElementById(
        "dgLightbox"
      );

    containerEl
      .querySelectorAll(
        "button.b-tile"
      )
      .forEach(function (b) {

        b.addEventListener(
          "click",
          function () {

            const index =
              Number(b.dataset.i);

            box._open(
              items[index]
            );

          }
        );

      });

    console.log(
      "DriveGallery: تم عرض",
      items.length,
      "ملف"
    );

    return true;
  }

  return {
    tryRender
  };

})();
