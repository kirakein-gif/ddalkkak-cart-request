(function () {
  'use strict';

  if (!location.hostname.includes('s2b.kr')) {
    alert('이 진단 도구는 S2B 장바구니에서만 실행해 주세요.');
    return;
  }

  function safeText(el) {
    return String((el && (el.innerText || el.textContent)) || '').trim();
  }

  function short(value, max) {
    var s = String(value == null ? '' : value);
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  function attrs(el) {
    if (!el) return {};
    return {
      tag: (el.tagName || '').toLowerCase(),
      id: el.id || '',
      className: typeof el.className === 'string' ? short(el.className, 320) : '',
      type: el.type || '',
      name: el.name || '',
      value: typeof el.value !== 'undefined' ? String(el.value) : '',
      checked: typeof el.checked === 'boolean' ? el.checked : undefined,
      ariaLabel: el.getAttribute && (el.getAttribute('aria-label') || ''),
      title: el.getAttribute && (el.getAttribute('title') || ''),
      text: short(safeText(el), 280)
    };
  }

  function imageInfo(img) {
    return {
      src: short(img.src || '', 500),
      alt: img.alt || '',
      title: img.title || '',
      className: typeof img.className === 'string' ? short(img.className, 240) : ''
    };
  }

  function unique(arr) {
    return arr.filter(function (v, i) { return arr.indexOf(v) === i; });
  }

  function splitValues(text) {
    return text.split(/\t|\n/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 140);
  }

  function numericCandidates(text) {
    return unique((text.match(/[\d,]+(?:\.\d+)?\s*(?:원)?/g) || []).map(function(s){ return s.trim(); })).slice(0, 80);
  }

  function ancestorSnapshots(cb) {
    var result = [];
    var node = cb;
    for (var depth = 0; depth < 9 && node; depth += 1, node = node.parentElement) {
      var text = safeText(node);
      result.push({
        depth: depth,
        tag: (node.tagName || '').toLowerCase(),
        id: node.id || '',
        className: typeof node.className === 'string' ? short(node.className, 340) : '',
        textLength: text.length,
        hasShippingWord: /배송|운임|택배|무료|착불/.test(text),
        numericCandidates: numericCandidates(text),
        text: short(text, 3600)
      });
    }
    return result;
  }

  function chooseContainer(cb) {
    var node = cb;
    var candidates = [];
    for (var depth = 0; depth < 10 && node; depth += 1, node = node.parentElement) {
      var text = safeText(node);
      var nums = numericCandidates(text);
      if (text.length > 10 && text.length < 7000 && nums.length >= 1) {
        candidates.push({
          node: node,
          textLength: text.length,
          depth: depth,
          shippingScore: /배송|운임|택배|무료|착불/.test(text) ? 1 : 0
        });
      }
    }
    if (!candidates.length) return cb.parentElement || cb;
    candidates.sort(function(a,b){
      if (b.shippingScore !== a.shippingScore) return b.shippingScore - a.shippingScore;
      return a.textLength - b.textLength;
    });
    return candidates[0].node;
  }

  var checked = Array.prototype.slice.call(document.querySelectorAll('input[type=checkbox]:checked'));
  var products = [];

  checked.forEach(function (cb) {
    var container = chooseContainer(cb);
    if (!container) return;
    var text = safeText(container);

    var images = Array.prototype.slice.call(container.querySelectorAll('img')).map(imageInfo);
    var shippingImages = images.filter(function (img) {
      return /pay|ship|deliver|delivery|택배|배송|무료|착불/i.test([img.src,img.alt,img.title,img.className].join(' '));
    });

    var links = Array.prototype.slice.call(container.querySelectorAll('a')).map(attrs).filter(function (a) {
      return /배송|운임|택배|무료|착불|pay|ship|deliver/i.test([a.text,a.title,a.className,a.id].join(' '));
    });

    products.push({
      checkbox: attrs(cb),
      chosenContainer: {
        tag: (container.tagName || '').toLowerCase(),
        id: container.id || '',
        className: typeof container.className === 'string' ? short(container.className, 340) : '',
        text: short(text, 4600),
        splitValues: splitValues(text),
        numericCandidates: numericCandidates(text)
      },
      inputs: Array.prototype.slice.call(container.querySelectorAll('input')).map(attrs),
      buttons: Array.prototype.slice.call(container.querySelectorAll('button,input[type=button],input[type=submit]')).map(attrs),
      shippingImages: shippingImages,
      allImages: images.slice(0, 30),
      shippingLinks: links,
      tableRows: Array.prototype.slice.call(container.querySelectorAll('tr')).map(function (tr) {
        return short(safeText(tr), 1200);
      }).filter(Boolean).slice(0, 20),
      ancestorSnapshots: ancestorSnapshots(cb)
    });
  });

  var pageText = safeText(document.body);
  var report = {
    toolVersion: '1.0-s2b-shipping',
    pageHost: location.hostname,
    checkedCheckboxCount: checked.length,
    detectedCandidateCount: products.length,
    pageShippingSnippets: pageText.split('\n').map(function(s){return s.trim();}).filter(function(s){
      return /배송|운임|택배|무료|착불/.test(s);
    }).slice(0,80),
    products: products.slice(0, 10)
  };

  var json = JSON.stringify(report, null, 2);

  var old = document.getElementById('ddalkkak-diagnose-overlay');
  if (old) old.remove();

  var overlay = document.createElement('div');
  overlay.id = 'ddalkkak-diagnose-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:24px;font-family:Pretendard,Malgun Gothic,sans-serif;';

  var box = document.createElement('div');
  box.style.cssText = 'width:min(960px,96vw);max-height:90vh;background:#fff;border-radius:16px;box-shadow:0 22px 60px rgba(15,23,42,.3);padding:20px;display:flex;flex-direction:column;gap:12px;';

  var title = document.createElement('div');
  title.innerHTML = '<div style="font-size:13px;font-weight:800;color:#0f766e">S2B 배송비 진단</div><div style="font-size:22px;font-weight:850;color:#172033;margin-top:4px">진단정보가 준비되었습니다.</div><div style="font-size:13px;color:#667085;margin-top:5px">복사한 내용을 ChatGPT 대화에 그대로 붙여 주세요.</div>';

  var area = document.createElement('textarea');
  area.value = json;
  area.readOnly = true;
  area.style.cssText = 'width:100%;min-height:470px;resize:vertical;border:1px solid #d0d5dd;border-radius:10px;padding:12px;font:12px/1.55 Consolas,monospace;color:#344054;background:#f8fafc;';

  var actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';

  var copy = document.createElement('button');
  copy.textContent = '진단정보 복사';
  copy.style.cssText = 'border:0;border-radius:10px;background:#0f766e;color:#fff;font-weight:800;padding:11px 16px;cursor:pointer;';
  copy.onclick = function () {
    area.focus();
    area.select();
    var done = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(area.value).then(function () {
          copy.textContent = '복사되었습니다 ✓';
        }).catch(function () {
          document.execCommand('copy');
          copy.textContent = '복사되었습니다 ✓';
        });
        done = true;
      }
    } catch (_) {}
    if (!done) {
      try { document.execCommand('copy'); } catch (_) {}
      copy.textContent = '복사되었습니다 ✓';
    }
  };

  var close = document.createElement('button');
  close.textContent = '닫기';
  close.style.cssText = 'border:1px solid #d0d5dd;border-radius:10px;background:#fff;color:#344054;font-weight:800;padding:11px 16px;cursor:pointer;';
  close.onclick = function () { overlay.remove(); };

  actions.appendChild(close);
  actions.appendChild(copy);
  box.appendChild(title);
  box.appendChild(area);
  box.appendChild(actions);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
})();