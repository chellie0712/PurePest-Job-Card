// Supabase client + job card submission.
//
// This file expects window.SUPABASE_CONFIG to be set by js/config.js (see
// js/config.example.js for the template — copy it to js/config.js and fill
// in your project's URL + anon key; js/config.js is gitignored so you never
// commit real credentials).
//
// If config.js is missing or still has placeholder values, submission is
// silently skipped — the form still works as a pure PDF generator, it just
// won't save anything to Supabase. This makes local development without a
// Supabase project set up still work.

(function () {
  var cfg = window.SUPABASE_CONFIG || {};
  var isConfigured = cfg.url && cfg.anonKey && cfg.url.indexOf('YOUR-PROJECT') === -1;

  var client = null;
  if (isConfigured && window.supabase && window.supabase.createClient) {
    client = window.supabase.createClient(cfg.url, cfg.anonKey);
  }

  window.JobCardBackend = {
    isConfigured: function () {
      return !!client;
    },

    // Uploads one dataURL (image or PDF) to a Storage bucket and returns its
    // public URL, or null if nothing to upload.
    uploadDataUrl: async function (bucket, path, dataUrl, contentType) {
      if (!client || !dataUrl) return null;
      var res = await fetch(dataUrl);
      var blob = await res.blob();
      var { error } = await client.storage.from(bucket).upload(path, blob, {
        contentType: contentType || blob.type || 'application/octet-stream',
        upsert: true
      });
      if (error) throw error;
      var { data } = client.storage.from(bucket).getPublicUrl(path);
      return data && data.publicUrl ? data.publicUrl : null;
    },

    // Uploads the whole job card: photos, signature and the generated PDF to
    // Storage, then inserts one row into the job_cards table with the form
    // fields plus the resulting file URLs. Throws on failure — the caller
    // decides how to tell the technician (the download itself already
    // succeeded by the time this runs, so a failure here should never be
    // treated as "the job card is lost").
    submit: async function (data, pdfBlob) {
      if (!client) return { skipped: true };

      var jobKey = (data.jobNo || 'nojob').replace(/[^a-zA-Z0-9_-]+/g, '_') + '_' + Date.now();

      var photoBeforeUrl = data.photos && data.photos.before
        ? await this.uploadDataUrl('job-card-photos', jobKey + '/before.jpg', data.photos.before, 'image/jpeg')
        : null;
      var photoAfterUrl = data.photos && data.photos.after
        ? await this.uploadDataUrl('job-card-photos', jobKey + '/after.jpg', data.photos.after, 'image/jpeg')
        : null;

      var extraPhotoUrls = [];
      if (data.extraPhotos && data.extraPhotos.length) {
        for (var i = 0; i < data.extraPhotos.length; i++) {
          var url = await this.uploadDataUrl('job-card-photos', jobKey + '/extra-' + i + '.jpg', data.extraPhotos[i], 'image/jpeg');
          if (url) extraPhotoUrls.push(url);
        }
      }

      var signatureUrl = data.signatureDataUrl
        ? await this.uploadDataUrl('job-card-photos', jobKey + '/signature.png', data.signatureDataUrl, 'image/png')
        : null;

      var pdfDataUrl = await new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.readAsDataURL(pdfBlob);
      });
      var pdfUrl = await this.uploadDataUrl('job-card-pdfs', jobKey + '.pdf', pdfDataUrl, 'application/pdf');

      var row = {
        job_no: data.jobNo || null,
        job_date: data.jobDate || null,
        technician: data.technician || null,
        client_name: data.clientName,
        contact_number: data.contactNumber || null,
        vat_no: data.vatNo || null,
        address: data.address || null,
        area_treated: data.areaTreated || null,
        work_description: data.workDescription,
        warranty_no: data.warrantyNo || null,
        warranty_start: data.warrantyStart || null,
        warranty_end: data.warrantyEnd || null,
        covers: data.covers || [],
        active_ingredients: data.activeIngredients || [],
        warranty_comments: data.warrantyComments || null,
        signatory_name: data.signatoryName,
        confirmed: true,
        photo_before_url: photoBeforeUrl,
        photo_after_url: photoAfterUrl,
        extra_photo_urls: extraPhotoUrls,
        signature_url: signatureUrl,
        pdf_url: pdfUrl
      };

      var { error } = await client.from('job_cards').insert(row);
      if (error) throw error;
      return { skipped: false, ok: true };
    }
  };
})();
