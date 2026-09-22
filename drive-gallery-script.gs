/* ==========================================================================
   سكريبت جوجل آبس (Google Apps Script) — بديل عن Google Cloud + مفتاح API
   ---------------------------------------------------------------------
   وظيفته: يستقبل ID فولدر صفحة، ويرجّع بصيغة JSON كل الصور والفيديوهات
   الموجودة داخل فولدرات الفعاليات التي بداخله (فولدر صفحة ← فولدرات فعاليات
   ← صور/فيديوهات)، بدون أي حاجة لمفتاح Drive API أو مشروع Google Cloud.

   طريقة التركيب (مرة واحدة فقط، ولا تحتاج أي خبرة برمجة):
   1) افتح https://script.google.com ← مشروع جديد (New project).
   2) امسح الكود الافتراضي، والصق هذا الكود كاملاً بدلاً منه.
   3) من الأعلى: Deploy ← New deployment ← اختر النوع Web app.
      - Execute as: Me (حسابك أنت)
      - Who has access: Anyone
      ثم اضغط Deploy، وامنح الأذونات المطلوبة عند طلبها.
   4) انسخ الرابط الذي ينتهي بـ /exec — هذا هو DRIVE_SCRIPT_URL الذي
      تلصقه في كل صفحات الموقع (نفس الرابط يُستخدم في كل الصفحات).
   5) فولدر كل صفحة على درايف لازم يكون Share ← Anyone with the link
      (Viewer) حتى تظهر الصور والفيديوهات في المتصفح — هذه الخطوة فقط
      هي الوحيدة الخاصة بالمشاركة، ولا علاقة لها بهذا السكريبت.

   لو عدّلت الكود لاحقًا، لازم تعمل Deploy ← Manage deployments ←
   تعديل (القلم) ← Version: New version ← Deploy، وإلا التعديل مش هيتفعل.
   ========================================================================== */

function doGet(e) {
  var folderId = e.parameter.folderId;
  if (!folderId) {
    return jsonOutput({ error: "missing folderId" });
  }
  try {
    var pageFolder = DriveApp.getFolderById(folderId);
    var items = [];
    var eventFolders = pageFolder.getFolders();

    while (eventFolders.hasNext()) {
      var eventFolder = eventFolders.next();
      var files = eventFolder.getFiles();
      while (files.hasNext()) {
        var file = files.next();
        var mime = file.getMimeType();
        var isImage = mime.indexOf("image/") === 0;
        var isVideo = mime.indexOf("video/") === 0;
        if (!isImage && !isVideo) continue;

        items.push({
          id: file.getId(),
          type: isVideo ? "video" : "photo",
          caption: (file.getDescription() || "").trim() || eventFolder.getName(),
          created: file.getDateCreated().getTime()
        });
      }
    }

    items.sort(function (a, b) { return a.created - b.created; });
    return jsonOutput({ files: items });
  } catch (err) {
    return jsonOutput({ error: String(err) });
  }
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
