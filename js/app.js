// Safety net: if something unexpected throws (e.g. while handling a camera
// photo on a particular device), surface a visible message instead of the
// page silently freezing or going blank with no explanation.
window.addEventListener('error', function(ev){
  try {
    var el = document.getElementById('photoStatusMsg') || document.getElementById('statusMsg');
    if(el){
      el.textContent = 'Something went wrong processing that action. Your other entries are still here — please try again, and use a smaller/lower-quality photo if this keeps happening.';
      el.className = 'status-msg error';
    }
  } catch(e){}
});
window.addEventListener('unhandledrejection', function(ev){
  try {
    var el = document.getElementById('photoStatusMsg') || document.getElementById('statusMsg');
    if(el){
      el.textContent = 'Something went wrong processing that action. Your other entries are still here — please try again, and use a smaller/lower-quality photo if this keeps happening.';
      el.className = 'status-msg error';
    }
  } catch(e){}
});
(function(){

  var PCO_NO = 'P41732';

  var TERMS = [
    "Covers re-treatment of the pest species and areas listed above, if activity recurs under normal conditions; a follow-up fee is applicable.",
    "Excludes new infestations by a different pest, and conditions beyond our control (alterations, water damage, etc.).",
    "Notify us in writing within 14 days of any recurring activity to remain covered under this warranty.",
    "Void if unauthorised pest control products or other contractors are used in the treated area.",
    "Reasonable access must be given for re-treatment visits; failure to do so may void cover for that area.",
    "Non-transferable — applies only to the client and property named above."
  ];
  var termsListEl = document.getElementById('termsList');
  TERMS.forEach(function(t){
    var li = document.createElement('li');
    li.textContent = t;
    termsListEl.appendChild(li);
  });

  var WARRANTY_COVER_OPTIONS = [
    { id: 'cover_general', label: 'General Pest Control' },
    { id: 'cover_termites', label: 'Termites / WDI' },
    { id: 'cover_rodents', label: 'Rodents' },
    { id: 'cover_fumigation', label: 'Fumigation' },
    { id: 'cover_other', label: 'Other' }
  ];

  var ACTIVE_INGREDIENT_OPTIONS = [
    { id: 'ai_charlie_bait_box', label: 'Charlie Bait Box' },
    { id: 'ai_roach_dust', label: 'Roach Dust — Permethrin(Pyrethroid) 5g/kg (Reg. L4587)' },
    { id: 'ai_maxthor_turbo', label: 'Maxthor Turbo — Bifenthrin 100g/L; Imiprothrin 10g/l; Pyperonel Butoxide (Reg. L10023)' },
    { id: 'ai_sharda_roach_gel_bait', label: 'Sharda Roach Gel Bait — Imidacloprid 21,5g/kg (Reg. L10674)' },
    { id: 'ai_ctx_108', label: 'CTX 108 — Cypermethrin 10,0 g/ℓ TCMTB (Organosulphur compound) 8,0 g /ℓ (Reg. L7445)' },
    { id: 'ai_dominion', label: 'Dominion — Imidachloprid (chloronicotinyl) 350 g/ℓ (Reg. L9576)' },
    { id: 'ai_bombex', label: 'Bombex — Lambda-Sihalotrin 100g/l (Reg. L9435)' },
    { id: 'ai_nuvan', label: 'NuVan Aerosol — Dichlorvos (organophosphate) 124 g/kg, Aerosol Gas (Reg. L7410)' },
    { id: 'ai_prothor', label: 'Prothor — Imidacloprid 200g/L (Reg. L8794)' },
    { id: 'ai_ultrakill_rat_mouse_wax_blocks', label: 'Ultrakill Rat & Mouse Wax Blocks — Flocoumafen 0.05 g/kg (Reg. L9739)' },
    { id: 'ai_permadust', label: 'Permadust — Permethrin (Pyrethroid) 5g/kg & Piperonyl Butoxide (Synergist) 40g/kg (Reg. L7999, Act 36 of 1947)' }
  ];

  var todayField = document.getElementById('jobDate');
  var today = new Date();
  todayField.value = today.toISOString().slice(0,10);

  // ---------- Warranty auto-fill: Warranty No. mirrors Job No., End Date = Start Date + 3 months ----------
  var warrantyNoAuto = true;
  var warrantyEndAuto = true;
  var jobNoField = document.getElementById('jobNo');
  var warrantyNoField = document.getElementById('warrantyNo');
  var warrantyStartField = document.getElementById('warrantyStart');
  var warrantyEndField = document.getElementById('warrantyEnd');

  jobNoField.addEventListener('input', function(){
    if(warrantyNoAuto){
      warrantyNoField.value = jobNoField.value;
    }
  });
  warrantyNoField.addEventListener('input', function(){
    warrantyNoAuto = false;
  });

  function addMonthsToDateStr(dateStr, months){
    var d = new Date(dateStr + 'T00:00:00');
    if(isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0,10);
  }
  warrantyStartField.addEventListener('input', function(){
    if(warrantyEndAuto && warrantyStartField.value){
      warrantyEndField.value = addMonthsToDateStr(warrantyStartField.value, 3);
    }
  });
  warrantyStartField.addEventListener('change', function(){
    if(warrantyEndAuto && warrantyStartField.value){
      warrantyEndField.value = addMonthsToDateStr(warrantyStartField.value, 3);
    }
  });
  warrantyEndField.addEventListener('input', function(){
    warrantyEndAuto = false;
  });

  // ---------- Photos ----------
  var photos = { before: null, after: null };
  var extraPhotos = []; // array of dataURLs
  var MAX_EXTRA_PHOTOS = 8;
  var MAX_PHOTO_FILE_BYTES = 30 * 1024 * 1024; // 30MB raw camera file safety cap
  var photoBusy = false; // guards against double-tap firing overlapping reads

  function photoStatus(msg, cls){
    var el = document.getElementById('photoStatusMsg');
    if(!el) return;
    el.textContent = msg || '';
    el.className = 'status-msg' + (cls ? ' '+cls : '');
  }

  // Memory-safe resize: prefer createImageBitmap with built-in resize (decodes
  // straight to the target size instead of allocating a full-resolution bitmap
  // first) and fall back to the Image+canvas approach on older browsers.
  function readAndCompress(file, maxDim, quality, cb, errCb){
    if(!file){ if(errCb) errCb('No file selected.'); return; }
    if(!/^image\//.test(file.type)){
      if(errCb) errCb('That file is not a photo. Please try again.');
      return;
    }
    if(file.size > MAX_PHOTO_FILE_BYTES){
      if(errCb) errCb('That photo is too large (over 30MB). Try a lower camera quality setting.');
      return;
    }

    function finishFromCanvas(canvas){
      var dataUrl;
      try {
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      } catch(e){
        if(errCb) errCb('Could not process that photo on this device. Try a different photo.');
        return;
      }
      canvas.width = 0; canvas.height = 0; // release the pixel buffer promptly
      cb(dataUrl);
    }

    if(window.createImageBitmap){
      // Ask the browser to decode directly at (roughly) the target size —
      // avoids ever holding a full 12-48MP decoded bitmap in memory.
      createImageBitmap(file, { resizeWidth: maxDim, resizeHeight: maxDim, resizeQuality: 'medium' })
        .then(function(bitmap){
          try {
            var w = bitmap.width, h = bitmap.height;
            var scale = Math.min(1, maxDim / Math.max(w,h));
            var cw = Math.max(1, Math.round(w*scale)), ch = Math.max(1, Math.round(h*scale));
            var canvas = document.createElement('canvas');
            canvas.width = cw; canvas.height = ch;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0, cw, ch);
            bitmap.close();
            finishFromCanvas(canvas);
          } catch(e){
            if(errCb) errCb('Could not process that photo on this device. Try a different photo.');
          }
        })
        .catch(function(){
          // Some browsers (older Android WebViews, some HEIC files) can fail
          // createImageBitmap — fall back to the Image element path below.
          readAndCompressViaImage(file, maxDim, cb, errCb, finishFromCanvas);
        });
    } else {
      readAndCompressViaImage(file, maxDim, cb, errCb, finishFromCanvas);
    }
  }

  function readAndCompressViaImage(file, maxDim, cb, errCb, finishFromCanvas){
    var reader = new FileReader();
    var settled = false;
    var timeoutId = setTimeout(function(){
      if(settled) return;
      settled = true;
      if(errCb) errCb('That photo took too long to process. Try again or pick a smaller photo.');
    }, 20000);
    reader.onerror = function(){
      if(settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if(errCb) errCb('Could not read that photo. Please try again.');
    };
    reader.onload = function(e){
      if(settled) return;
      var img = new Image();
      img.onload = function(){
        if(settled) return;
        settled = true;
        clearTimeout(timeoutId);
        try {
          var w = img.width, h = img.height;
          var scale = Math.min(1, maxDim / Math.max(w,h));
          var cw = Math.max(1, Math.round(w*scale)), ch = Math.max(1, Math.round(h*scale));
          var canvas = document.createElement('canvas');
          canvas.width = cw; canvas.height = ch;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, cw, ch);
          img.src = '';
          finishFromCanvas(canvas);
        } catch(e2){
          if(errCb) errCb('Could not process that photo on this device. Try a different photo.');
        }
      };
      img.onerror = function(){
        if(settled) return;
        settled = true;
        clearTimeout(timeoutId);
        if(errCb) errCb('That photo format isn\'t supported on this device. Try taking the photo again.');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  window.triggerPhoto = function(slot){
    if(photoBusy) return;
    document.getElementById('file-'+slot).click();
  };
  window.removePhoto = function(slot){
    photos[slot] = null;
    document.getElementById('img-'+slot).style.display = 'none';
    document.getElementById('ph-'+slot+'-placeholder').style.display = 'block';
    document.getElementById('rm-'+slot).style.display = 'none';
    document.getElementById('file-'+slot).value = '';
    scheduleSaveDraft();
  };
  ['before','after'].forEach(function(slot){
    document.getElementById('file-'+slot).addEventListener('change', function(ev){
      var file = ev.target.files[0];
      if(!file) return;
      if(photoBusy){ ev.target.value = ''; return; }
      photoBusy = true;
      photoStatus('Processing photo…');
      readAndCompress(file, 1280, 0.72, function(dataUrl){
        photoBusy = false;
        photoStatus('');
        photos[slot] = dataUrl;
        var imgEl = document.getElementById('img-'+slot);
        imgEl.src = dataUrl;
        imgEl.style.display = 'block';
        document.getElementById('ph-'+slot+'-placeholder').style.display = 'none';
        document.getElementById('rm-'+slot).style.display = 'flex';
        scheduleSaveDraft();
      }, function(errMsg){
        photoBusy = false;
        photoStatus(errMsg, 'error');
        ev.target.value = '';
      });
    });
  });

  window.triggerExtraPhoto = function(){
    if(photoBusy) return;
    if(extraPhotos.length >= MAX_EXTRA_PHOTOS){
      photoStatus('You can add up to ' + MAX_EXTRA_PHOTOS + ' additional photos. Remove one to add another.', 'error');
      return;
    }
    document.getElementById('file-extra').click();
  };
  document.getElementById('file-extra').addEventListener('change', function(ev){
    var file = ev.target.files[0];
    if(!file) return;
    if(photoBusy){ ev.target.value = ''; return; }
    if(extraPhotos.length >= MAX_EXTRA_PHOTOS){
      photoStatus('You can add up to ' + MAX_EXTRA_PHOTOS + ' additional photos. Remove one to add another.', 'error');
      ev.target.value = '';
      return;
    }
    photoBusy = true;
    photoStatus('Processing photo…');
    readAndCompress(file, 1100, 0.68, function(dataUrl){
      photoBusy = false;
      photoStatus('');
      extraPhotos.push(dataUrl);
      renderExtraPhotos();
      scheduleSaveDraft();
    }, function(errMsg){
      photoBusy = false;
      photoStatus(errMsg, 'error');
    });
    ev.target.value = '';
  });
  function renderExtraPhotos(){
    var grid = document.getElementById('extraPhotosGrid');
    grid.innerHTML = '';
    extraPhotos.forEach(function(src, idx){
      var div = document.createElement('div');
      div.className = 'extra-thumb';
      div.innerHTML = '<img src="'+src+'"><button type="button" class="remove-x" onclick="removeExtraPhoto('+idx+')">&times;</button>';
      grid.appendChild(div);
    });
    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'add-extra-btn';
    addBtn.textContent = '+';
    addBtn.onclick = window.triggerExtraPhoto;
    grid.appendChild(addBtn);
  }
  window.removeExtraPhoto = function(idx){
    extraPhotos.splice(idx,1);
    renderExtraPhotos();
    scheduleSaveDraft();
  };

  // ---------- Signature pad ----------
  var canvas = document.getElementById('sigCanvas');
  var ctx = canvas.getContext('2d');
  var sigPlaceholder = document.getElementById('sigPlaceholder');
  var hasSignature = false;
  var drawing = false;
  var lastX, lastY;

  function resizeCanvas(){
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var prevData = hasSignature ? canvas.toDataURL() : null;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a2e22';
    if(prevData){
      var img = new Image();
      img.onload = function(){ ctx.drawImage(img,0,0,rect.width,rect.height); };
      img.src = prevData;
    }
  }
  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 50);

  function getPos(ev){
    var rect = canvas.getBoundingClientRect();
    var t = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }
  function startDraw(ev){
    ev.preventDefault();
    drawing = true;
    hasSignature = true;
    sigPlaceholder.style.display = 'none';
    var p = getPos(ev);
    lastX = p.x; lastY = p.y;
  }
  function moveDraw(ev){
    if(!drawing) return;
    ev.preventDefault();
    var p = getPos(ev);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastX = p.x; lastY = p.y;
  }
  function endDraw(ev){
    if(!drawing) return;
    drawing = false;
    document.getElementById('sigTimestamp').textContent = 'Signed ' + new Date().toLocaleString();
    scheduleSaveDraft();
  }
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', moveDraw);
  window.addEventListener('mouseup', endDraw);
  canvas.addEventListener('touchstart', startDraw, {passive:false});
  canvas.addEventListener('touchmove', moveDraw, {passive:false});
  canvas.addEventListener('touchend', endDraw);

  window.clearSignature = function(){
    var rect = canvas.getBoundingClientRect();
    ctx.clearRect(0,0,rect.width,rect.height);
    hasSignature = false;
    sigPlaceholder.style.display = 'flex';
    document.getElementById('sigTimestamp').textContent = '';
    scheduleSaveDraft();
  };


  // ---------- Autosave / crash-recovery draft ----------
  // Mobile browsers can reload this page out from under the user — most
  // often right after the native camera app takes over full-screen and the
  // OS reclaims the backgrounded tab's memory. When that happens all form
  // state used to be lost and the technician had to start the whole job
  // card over. This autosaves a draft to this device's local storage as
  // they work, and restores it the moment the page comes back.
  var DRAFT_KEY = 'purepest_jobcard_draft_v1';
  var DRAFT_FIELD_IDS = ['jobNo','jobDate','technician','clientName','contactNumber','vatNo','address',
    'areaTreated','workDescription','warrantyNo','warrantyStart','warrantyEnd','activeIngredientOther',
    'warrantyComments','signatoryName','confirmCheck'].concat(
      WARRANTY_COVER_OPTIONS.map(function(o){ return o.id; }),
      ACTIVE_INGREDIENT_OPTIONS.map(function(o){ return o.id; })
    );
  var saveDraftTimer = null;
  function scheduleSaveDraft(){
    if(saveDraftTimer) clearTimeout(saveDraftTimer);
    saveDraftTimer = setTimeout(saveDraftNow, 400);
  }
  function saveDraftNow(){
    try {
      var data = {
        fields: {},
        photos: photos,
        extraPhotos: extraPhotos,
        signatureDataUrl: hasSignature ? canvas.toDataURL('image/png') : null,
        sigTimestamp: document.getElementById('sigTimestamp').textContent,
        savedAt: Date.now()
      };
      DRAFT_FIELD_IDS.forEach(function(id){
        var el = document.getElementById(id);
        if(!el) return;
        data.fields[id] = (el.type === 'checkbox') ? el.checked : el.value;
      });
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch(e){
      // Storage full, disabled (private browsing) or unavailable — autosave
      // is best-effort only; the form still works normally without it.
    }
  }
  function clearDraft(){
    try { localStorage.removeItem(DRAFT_KEY); } catch(e){}
  }
  function restoreDraft(){
    var raw;
    try { raw = localStorage.getItem(DRAFT_KEY); } catch(e){ return; }
    if(!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch(e){ return; }
    if(!data) return;
    try {
      if(data.fields){
        Object.keys(data.fields).forEach(function(id){
          var el = document.getElementById(id);
          if(!el) return;
          if(el.type === 'checkbox'){ el.checked = !!data.fields[id]; }
          else { el.value = data.fields[id]; }
        });
        warrantyNoAuto = !!(jobNoField.value && warrantyNoField.value && jobNoField.value === warrantyNoField.value);
        warrantyEndAuto = false;
      }
      if(data.photos){
        ['before','after'].forEach(function(slot){
          var src = data.photos[slot];
          if(src){
            photos[slot] = src;
            var imgEl = document.getElementById('img-'+slot);
            imgEl.src = src;
            imgEl.style.display = 'block';
            document.getElementById('ph-'+slot+'-placeholder').style.display = 'none';
            document.getElementById('rm-'+slot).style.display = 'flex';
          }
        });
      }
      if(data.extraPhotos && data.extraPhotos.length){
        extraPhotos = data.extraPhotos.slice(0, MAX_EXTRA_PHOTOS);
        renderExtraPhotos();
      }
      if(data.signatureDataUrl){
        var img = new Image();
        img.onload = function(){
          var rect = canvas.getBoundingClientRect();
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          hasSignature = true;
          sigPlaceholder.style.display = 'none';
          if(data.sigTimestamp){ document.getElementById('sigTimestamp').textContent = data.sigTimestamp; }
        };
        img.src = data.signatureDataUrl;
      }
      var banner = document.getElementById('draftBanner');
      if(banner){ banner.style.display = 'flex'; }
    } catch(e){
      console.error('Could not restore saved draft:', e);
    }
  }
  window.dismissDraftBanner = function(){
    var banner = document.getElementById('draftBanner');
    if(banner){ banner.style.display = 'none'; }
  };
  document.addEventListener('input', scheduleSaveDraft);
  document.addEventListener('change', scheduleSaveDraft);
  restoreDraft();

  // ---------- Reset ----------
  window.resetForm = function(){
    if(!confirm('Start a new blank job card? Anything not downloaded will be lost.')) return;
    ['jobNo','technician','clientName','contactNumber','vatNo','address','areaTreated','workDescription',
     'warrantyNo','warrantyStart','warrantyEnd',
     'activeIngredientOther','warrantyComments',
     'signatoryName'].forEach(function(id){
      document.getElementById(id).value = '';
    });
    document.getElementById('jobDate').value = new Date().toISOString().slice(0,10);
    document.getElementById('confirmCheck').checked = false;
    warrantyNoAuto = true;
    warrantyEndAuto = true;
    WARRANTY_COVER_OPTIONS.forEach(function(o){ document.getElementById(o.id).checked = false; });
    ACTIVE_INGREDIENT_OPTIONS.forEach(function(o){ document.getElementById(o.id).checked = false; });
    removePhoto('before'); removePhoto('after');
    extraPhotos = []; renderExtraPhotos();
    clearSignature();
    document.getElementById('statusMsg').textContent = '';
    document.getElementById('statusMsg').className = 'status-msg';
    clearDraft();
    dismissDraftBanner();
    window.scrollTo({top:0, behavior:'smooth'});
  };

  // ---------- PDF generation ----------
  function val(id){ return document.getElementById(id).value.trim(); }

  function setStatus(msg, cls){
    var el = document.getElementById('statusMsg');
    el.textContent = msg;
    el.className = 'status-msg' + (cls ? ' '+cls : '');
  }

  window.generatePdf = async function(){
    var jobNo = val('jobNo');
    var jobDate = val('jobDate');
    var technician = val('technician');
    var clientName = val('clientName');
    var contactNumber = val('contactNumber');
    var vatNo = val('vatNo');
    var address = val('address');
    var areaTreated = val('areaTreated');
    var workDescription = val('workDescription');
    var warrantyNo = val('warrantyNo');
    var warrantyStart = val('warrantyStart');
    var warrantyEnd = val('warrantyEnd');
    var covers = WARRANTY_COVER_OPTIONS.filter(function(o){ return document.getElementById(o.id).checked; }).map(function(o){ return o.label; });
    var activeIngredients = ACTIVE_INGREDIENT_OPTIONS.filter(function(o){ return document.getElementById(o.id).checked; }).map(function(o){ return o.label; });
    var activeIngredientOther = val('activeIngredientOther');
    if(activeIngredientOther){ activeIngredients.push(activeIngredientOther); }
    var warrantyComments = val('warrantyComments');
    var signatoryName = val('signatoryName');
    var confirmed = document.getElementById('confirmCheck').checked;

    if(!clientName){ setStatus('Please enter the client name before generating the PDF.', 'error'); return; }
    if(!workDescription){ setStatus('Please describe the work performed before generating the PDF.', 'error'); return; }
    if(!hasSignature){ setStatus('The client needs to sign before the PDF can be generated.', 'error'); return; }
    if(!signatoryName){ setStatus('Please enter the name of the person signing.', 'error'); return; }
    if(!confirmed){ setStatus('Please tick the confirmation box before generating the PDF.', 'error'); return; }

    setStatus('Generating PDF…', '');
    document.getElementById('generateBtn').disabled = true;

    try {
      var signatureDataUrl = canvas.toDataURL('image/png');
      var pdfBlob = await buildPdf({
        jobNo: jobNo, jobDate: jobDate, technician: technician,
        clientName: clientName, contactNumber: contactNumber, vatNo: vatNo, address: address,
        areaTreated: areaTreated, workDescription: workDescription,
        photos: photos, extraPhotos: extraPhotos,
        warrantyNo: warrantyNo, warrantyStart: warrantyStart, warrantyEnd: warrantyEnd, covers: covers,
        activeIngredients: activeIngredients, warrantyComments: warrantyComments,
        signatureDataUrl: signatureDataUrl, signatoryName: signatoryName
      });

      var safeClient = (clientName || 'Client').replace(/[^a-z0-9]+/gi,'_').slice(0,30);
      var filename = 'JobCard_ServiceWarranty_' + safeClient + '_' + (jobDate || 'undated') + '.pdf';

      var downloads = (window.claude && window.claude.use) ? await window.claude.use('downloads') : null;
      if(downloads){
        try {
          await downloads.save({ filename: filename, data: pdfBlob });
          setStatus('PDF saved.', 'ok');
          clearDraft();
        } catch(err){
          if(err && err.code === 'declined'){
            setStatus('Save cancelled.', '');
          } else {
            setStatus('Could not save the file (' + (err && err.code ? err.code : 'unknown error') + ').', 'error');
          }
        }
      } else {
        // Not running inside Claude's artifact viewer (e.g. this page has been
        // self-hosted elsewhere) — fall back to a plain browser download.
        try {
          var blobUrl = URL.createObjectURL(pdfBlob);
          var a = document.createElement('a');
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function(){ URL.revokeObjectURL(blobUrl); }, 30000);
          setStatus('PDF saved.', 'ok');
          clearDraft();
        } catch(err2){
          setStatus('Could not save the file. Please try again.', 'error');
        }
      }

      // Also save this submission to Supabase (database row + uploaded
      // photos/PDF), if js/config.js has been filled in with real project
      // credentials. This never blocks or undoes the download above — the
      // technician already has their PDF either way.
      if(window.JobCardBackend && window.JobCardBackend.isConfigured()){
        try {
          await window.JobCardBackend.submit({
            jobNo: jobNo, jobDate: jobDate, technician: technician,
            clientName: clientName, contactNumber: contactNumber, vatNo: vatNo, address: address,
            areaTreated: areaTreated, workDescription: workDescription,
            photos: photos, extraPhotos: extraPhotos,
            warrantyNo: warrantyNo, warrantyStart: warrantyStart, warrantyEnd: warrantyEnd, covers: covers,
            activeIngredients: activeIngredients, warrantyComments: warrantyComments,
            signatureDataUrl: signatureDataUrl, signatoryName: signatoryName
          }, pdfBlob);
          setStatus('PDF saved, and synced to the office system.', 'ok');
        } catch(syncErr){
          console.error('Supabase sync failed:', syncErr);
          setStatus('PDF saved to this device, but could not sync to the office system — check your connection. Your downloaded PDF is safe either way.', 'error');
        }
      }
    } catch(e){
      console.error(e);
      setStatus('Something went wrong generating the PDF. Please try again.', 'error');
    } finally {
      document.getElementById('generateBtn').disabled = false;
    }
  };

  function wrapAndCount(doc, text, maxWidth){
    return doc.splitTextToSize(text || '-', maxWidth);
  }

  async function buildPdf(data){
    var jsPDFCtor = window.jspdf.jsPDF;
    var doc = new jsPDFCtor({ unit: 'mm', format: 'a4' });

    var PAGE_W = 210, PAGE_H = 297;
    var MARGIN = 17.64;
    var CONTENT_W = PAGE_W - 2*MARGIN;

    var GREEN = [30,138,60];
    var GREEN_DARK = [18,92,40];
    var GREEN_PALE = [234,246,236];
    var GREY_DARK = [43,43,43];
    var GREY_MID = [107,107,107];
    var GREY_LINE = [216,220,217];
    var GREY_FILL = [244,246,245];
    var LETTER_GREEN = [31,170,58];

    var y = MARGIN;
    var secNum = 1;

    function sectionBar(title){
      doc.setFillColor(GREEN[0],GREEN[1],GREEN[2]);
      doc.roundedRect(MARGIN, y, CONTENT_W, 7, 1, 1, 'F');
      doc.setTextColor(255,255,255);
      doc.setFont('helvetica','bold');
      doc.setFontSize(11);
      doc.text(String(secNum), MARGIN+4, y+4.9);
      doc.text(title, MARGIN+10, y+4.9);
      secNum += 1;
      y += 7 + 5;
    }
    function label(x, yy, txt){
      doc.setFont('helvetica','bold');
      doc.setFontSize(9);
      doc.setTextColor(GREEN_DARK[0],GREEN_DARK[1],GREEN_DARK[2]);
      doc.text(txt, x, yy);
    }
    function value(x, yy, txt, maxWidth){
      doc.setFont('helvetica','normal');
      doc.setFontSize(10);
      doc.setTextColor(GREY_DARK[0],GREY_DARK[1],GREY_DARK[2]);
      var lines = wrapAndCount(doc, txt || '-', maxWidth);
      doc.text(lines, x, yy);
      return lines.length;
    }
    function ensureRoom(need){
      if(y + need > PAGE_H - 24){
        doc.addPage();
        y = MARGIN;
      }
    }

    // Header
    try {
      doc.addImage(document.getElementById('letterheadLogo'), 'PNG', MARGIN, y-2, 38, 38*(638/1916));
    } catch(e){}
    doc.setFont('helvetica','bold');
    doc.setFontSize(15.5);
    doc.setTextColor(LETTER_GREEN[0],LETTER_GREEN[1],LETTER_GREEN[2]);
    doc.text('JOB CARD & SERVICE WARRANTY', PAGE_W - MARGIN, y+7, {align:'right'});
    doc.setFont('helvetica','italic');
    doc.setFontSize(9.5);
    doc.setTextColor(GREY_MID[0],GREY_MID[1],GREY_MID[2]);
    doc.text('Registered Pest Control Operator', PAGE_W - MARGIN, y+12.5, {align:'right'});
    y += 24;
    doc.setDrawColor(LETTER_GREEN[0],LETTER_GREEN[1],LETTER_GREEN[2]);
    doc.setLineWidth(0.9);
    doc.line(MARGIN, y, PAGE_W-MARGIN, y);
    y += 8;

    // 1. Job details
    sectionBar('JOB DETAILS');
    var col2x = MARGIN + CONTENT_W/2 + 4;
    label(MARGIN, y, 'Job No.'); value(MARGIN, y+4.6, data.jobNo, CONTENT_W/2 - 8);
    label(col2x, y, 'Date'); value(col2x, y+4.6, data.jobDate, CONTENT_W/2 - 8);
    y += 12;
    label(MARGIN, y, 'Technician'); value(MARGIN, y+4.6, data.technician, CONTENT_W);
    y += 13;

    // 2. Client details
    sectionBar('CLIENT DETAILS');
    label(MARGIN, y, 'Client Name'); value(MARGIN, y+4.6, data.clientName, CONTENT_W/2 - 8);
    label(col2x, y, 'Contact Number'); value(col2x, y+4.6, data.contactNumber, CONTENT_W/2 - 8);
    y += 12;
    if(data.vatNo){
      label(MARGIN, y, 'VAT No.'); value(MARGIN, y+4.6, data.vatNo, CONTENT_W/2 - 8);
      y += 12;
    }
    label(MARGIN, y, 'Site Address');
    var addrLines = wrapAndCount(doc, data.address || '-', CONTENT_W);
    y += 4.6;
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(GREY_DARK[0],GREY_DARK[1],GREY_DARK[2]);
    doc.text(addrLines, MARGIN, y);
    y += addrLines.length*4.6 + 8;

    // 3. Work performed
    sectionBar('WORK PERFORMED');
    label(MARGIN, y, 'Area / Pest Treated'); value(MARGIN, y+4.6, data.areaTreated, CONTENT_W);
    y += 11;
    label(MARGIN, y, 'Description of Work Done');
    y += 4.6;
    doc.setFillColor(GREY_FILL[0],GREY_FILL[1],GREY_FILL[2]);
    var descLines = wrapAndCount(doc, data.workDescription || '-', CONTENT_W - 6);
    var descBoxH = Math.max(descLines.length*4.4 + 6, 14);
    doc.roundedRect(MARGIN, y-4, CONTENT_W, descBoxH, 1.5, 1.5, 'F');
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(GREY_DARK[0],GREY_DARK[1],GREY_DARK[2]);
    doc.text(descLines, MARGIN+3, y+1);
    y += descBoxH + 6;

    // 4. Photos
    var hasPhotos = data.photos.before || data.photos.after || (data.extraPhotos && data.extraPhotos.length);
    if(hasPhotos){
      ensureRoom(70);
      sectionBar('PHOTOS');
      var pw = (CONTENT_W - 6)/2, ph = pw*0.72;
      if(data.photos.before){
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(GREY_MID[0],GREY_MID[1],GREY_MID[2]);
        doc.text('BEFORE', MARGIN, y);
        try { doc.addImage(data.photos.before, 'JPEG', MARGIN, y+1.5, pw, ph); } catch(e){}
      }
      if(data.photos.after){
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(GREY_MID[0],GREY_MID[1],GREY_MID[2]);
        doc.text('AFTER', MARGIN+pw+6, y);
        try { doc.addImage(data.photos.after, 'JPEG', MARGIN+pw+6, y+1.5, pw, ph); } catch(e){}
      }
      if(data.photos.before || data.photos.after){ y += ph + 9; }

      if(data.extraPhotos && data.extraPhotos.length){
        var perRow = 3;
        var gap = 4;
        var tw = (CONTENT_W - gap*(perRow-1))/perRow;
        var th = tw*0.75;
        for(var i=0;i<data.extraPhotos.length;i++){
          var col = i % perRow;
          if(col === 0){ ensureRoom(th+4); }
          var px = MARGIN + col*(tw+gap);
          try { doc.addImage(data.extraPhotos[i], 'JPEG', px, y, tw, th); } catch(e){}
          if(col === perRow-1 || i === data.extraPhotos.length-1){ y += th + gap; }
        }
        y += 4;
      }
    }

    // 5. Warranty details
    ensureRoom(38);
    sectionBar('WARRANTY DETAILS');
    var thirdX2 = MARGIN + CONTENT_W/3;
    var thirdX3 = MARGIN + 2*CONTENT_W/3;
    label(MARGIN, y, 'Warranty No.'); value(MARGIN, y+4.6, data.warrantyNo, CONTENT_W/3 - 6);
    label(thirdX2, y, 'Start Date'); value(thirdX2, y+4.6, data.warrantyStart, CONTENT_W/3 - 6);
    label(thirdX3, y, 'End Date'); value(thirdX3, y+4.6, data.warrantyEnd, CONTENT_W/3 - 6);
    y += 12;
    label(MARGIN, y, 'Warranty Covers');
    y += 5;
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(GREY_DARK[0],GREY_DARK[1],GREY_DARK[2]);
    var coversText = (data.covers && data.covers.length) ? data.covers.join('   •   ') : '-';
    var coverLines = wrapAndCount(doc, coversText, CONTENT_W);
    doc.text(coverLines, MARGIN, y);
    y += coverLines.length*4.6 + 8;

    ensureRoom(20);
    label(MARGIN, y, 'Active Ingredients');
    y += 5;
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(GREY_DARK[0],GREY_DARK[1],GREY_DARK[2]);
    if(data.activeIngredients && data.activeIngredients.length){
      data.activeIngredients.forEach(function(ai){
        var aiLines = wrapAndCount(doc, ai, CONTENT_W - 5);
        ensureRoom(aiLines.length*4.6 + 2);
        doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(GREY_DARK[0],GREY_DARK[1],GREY_DARK[2]);
        doc.text('•  ' + aiLines[0], MARGIN, y);
        y += 4.6;
        for(var ai_i=1; ai_i<aiLines.length; ai_i++){
          doc.text(aiLines[ai_i], MARGIN+5, y);
          y += 4.6;
        }
      });
    } else {
      doc.text('-', MARGIN, y);
      y += 4.6;
    }
    y += 4;

    doc.setFont('helvetica','normal'); doc.setFontSize(10);
    var commentLines = wrapAndCount(doc, data.warrantyComments || '-', CONTENT_W - 6);
    var commentBoxH = Math.max(commentLines.length*4.4 + 6, 14);
    ensureRoom(4.6 + commentBoxH + 8);
    label(MARGIN, y, 'Comments / Recommendations');
    y += 4.6;
    doc.setFillColor(GREY_FILL[0],GREY_FILL[1],GREY_FILL[2]);
    doc.roundedRect(MARGIN, y-4, CONTENT_W, commentBoxH, 1.5, 1.5, 'F');
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(GREY_DARK[0],GREY_DARK[1],GREY_DARK[2]);
    doc.text(commentLines, MARGIN+3, y+1);
    y += commentBoxH + 8;

    // 6. Warranty terms
    ensureRoom(45);
    sectionBar('WARRANTY TERMS & CONDITIONS');
    doc.setFillColor(GREEN_PALE[0],GREEN_PALE[1],GREEN_PALE[2]);
    var termLineH = 4.3;
    var maxW = CONTENT_W - 9;
    doc.setFont('helvetica','normal'); doc.setFontSize(8.2);
    var allWrapped = TERMS.map(function(line){ return doc.splitTextToSize(line, maxW - 4); });
    var totalLines = allWrapped.reduce(function(s,w){ return s + w.length; }, 0);
    var boxH = totalLines*termLineH + 6;
    doc.roundedRect(MARGIN, y-4, CONTENT_W, boxH, 1.5, 1.5, 'F');
    doc.setDrawColor(GREEN[0],GREEN[1],GREEN[2]);
    doc.setLineWidth(1);
    doc.line(MARGIN, y-4, MARGIN, y-4+boxH);
    var ty = y + 1;
    doc.setTextColor(GREY_DARK[0],GREY_DARK[1],GREY_DARK[2]);
    allWrapped.forEach(function(wrapped){
      doc.text('•  ' + wrapped[0], MARGIN+4, ty);
      ty += termLineH;
      for(var k=1;k<wrapped.length;k++){
        doc.text(wrapped[k], MARGIN+8, ty);
        ty += termLineH;
      }
    });
    y += boxH + 8;

    // 7. Sign-off
    ensureRoom(60);
    sectionBar('CLIENT SIGN-OFF');
    doc.setFillColor(GREEN_PALE[0],GREEN_PALE[1],GREEN_PALE[2]);
    var confirmLines = doc.splitTextToSize('Client confirmed the work above was carried out to their satisfaction on the date shown, and accepted the Warranty Terms & Conditions above.', CONTENT_W - 8);
    var confirmBoxH = confirmLines.length*4.2 + 5;
    doc.roundedRect(MARGIN, y-4, CONTENT_W, confirmBoxH, 1.5, 1.5, 'F');
    doc.setDrawColor(GREEN[0],GREEN[1],GREEN[2]);
    doc.setLineWidth(1);
    doc.line(MARGIN, y-4, MARGIN, y-4+confirmBoxH);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.setTextColor(GREY_DARK[0],GREY_DARK[1],GREY_DARK[2]);
    doc.text(confirmLines, MARGIN+4, y+0.5);
    y += confirmBoxH + 9;

    label(MARGIN, y, 'Signatory Name'); value(MARGIN, y+4.6, data.signatoryName, CONTENT_W/2);
    y += 11;
    label(MARGIN, y, 'Client Signature');
    y += 3;
    doc.setDrawColor(GREY_LINE[0],GREY_LINE[1],GREY_LINE[2]);
    doc.setLineWidth(0.6);
    var sigW = 70, sigH = 24;
    try { doc.addImage(data.signatureDataUrl, 'PNG', MARGIN, y, sigW, sigH); } catch(e){}
    doc.line(MARGIN, y+sigH+1, MARGIN+sigW, y+sigH+1);

    var pcoX = MARGIN + sigW + 16;
    label(pcoX, y-3, 'PCO Signature');
    var pcoSigH = 16, pcoSigW = pcoSigH*(176/96);
    try { doc.addImage(document.getElementById('pcoSig'), 'PNG', pcoX, y+2, pcoSigW, pcoSigH); } catch(e){}
    doc.line(pcoX, y+sigH+1, pcoX+Math.max(pcoSigW,45), y+sigH+1);
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    doc.setTextColor(GREY_MID[0],GREY_MID[1],GREY_MID[2]);
    doc.text('PCO No. ' + PCO_NO, pcoX, y+sigH+5);

    y += sigH + 14;

    // Footer
    var footY = PAGE_H - 16;
    try {
      var gW = 22, gH = gW*(114/300);
      doc.addImage(document.getElementById('govLogo'), 'PNG', PAGE_W/2 - gW/2, footY - gH - 3, gW, gH);
    } catch(e){}
    doc.setDrawColor(LETTER_GREEN[0],LETTER_GREEN[1],LETTER_GREEN[2]);
    doc.setLineWidth(1.2);
    doc.line(0, footY, PAGE_W, footY);
    doc.setFont('helvetica','italic');
    doc.setFontSize(8);
    doc.setTextColor(GREY_MID[0],GREY_MID[1],GREY_MID[2]);
    doc.text('PurePest Solutions', PAGE_W/2, footY+4.5, {align:'center'});

    doc.setProperties({ title: 'Job Card & Service Warranty - ' + (data.clientName || ''), subject: 'Job Card & Service Warranty', author: 'Pure Pest Solutions' });

    return doc.output('blob');
  }

})();
