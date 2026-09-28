(function () {
  'use strict';

  if (location.hostname !== 'mall.kidkids.net') {
    alert('이 진단 도구는 키드키즈몰 장바구니에서만 실행해 주세요.');
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
      role: el.getAttribute && (el.getAttribute('role') || ''),
      href: el.href || '',
      text: short(safeText(el), 280)
    };
  }

  function unique(arr) {
    return arr.filter(function (v, i) { return arr.indexOf(v) === i; });
  }

  function prices(text) {
    return unique((String(text || '').match(/[\d,]+\s*원/g) || []).map(function(s){ return s.trim(); })).slice(0, 60);
  }

  function numbers(text) {
    return unique((String(text || '').match(/[\d,]+(?:\.\d+)?/g) || [])).slice(0, 80);
  }

  function looksQty(el) {
    var text = safeText(el);
    var value = typeof el.value !== 'undefined' ? String(el.value) : '';
    var meta = [
      el.id || '',
      typeof el.className === 'string' ? el.className : '',
      el.getAttribute && (el.getAttribute('aria-label') || ''),
      el.getAttribute && (el.getAttribute('title') || ''),
      el.getAttribute && (el.getAttribute('name') || ''),
      el.getAttribute && (el.getAttribute('role') || '')
    ].join(' ');
    return /수량|quantity|qty|count|amount|spinner|stepper/i.test(meta) ||
      /^\d{1,3}$/.test(text) ||
      /^\d{1,3}$/.test(value) ||
      /증가|감소|plus|minus|더하기|빼기/i.test(text + ' ' + meta);
  }

  function looksShipping(el) {
    var text = safeText(el);
    var meta = [
      el.id || '',
      typeof el.className === 'string' ? el.className : '',
      el.getAttribute && (el.getAttribute('title') || ''),
      el.getAttribute && (el.getAttribute('aria-label') || '')
    ].join(' ');
    return /배송|택배|shipping|delivery|ship|무료|착불/i.test(text + ' ' + meta);
  }

  function ancestorSnapshots(cb) {
    var result = [];
    var node = cb;
    for (var depth = 0; depth < 10 && node; depth += 1, node = node.parentElement) {
      var text = safeText(node);
      result.push({
        depth: depth,
        tag: (node.tagName || '').toLowerCase(),
        id: node.id || '',
        className: typeof node.className === 'string' ? short(node.className, 340) : '',
        textLength: text.length,
        prices: prices(text),
        text: short(text, 3200)
      });
    }
    return result;
  }

  function chooseContainer(cb) {
    var node = cb;
    var candidates = [];
    for (var depth = 0; depth < 10 && node; depth += 1, node = node.parentElement) {
      var text = safeText(node);
      var priceCount = prices(text).length;
      var controlCount = node.querySelectorAll ? node.querySelectorAll('input,button,select,a,[role="button"],[role="spinbutton"]').length : 0;
      if (text.length > 10 && text.length < 7000 && (priceCount >= 1 || controlCount >= 2)) {
        candidates.push({
          node: node,
          depth: depth,
          textLength: text.length,
          shippingScore: /배송|택배|무료|착불/.test(text) ? 1 : 0
        });
      }
    }
    if (!candidates.length) return cb.parentElement || cb;
    candidates.sort(function(a,b){
      if (a.depth !== b.depth) return a.depth - b.depth;
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
    var controls = Array.prototype.slice.call(
      container.querySelectorAll('input,button,select,a,[role="button"],[role="spinbutton"]')
    );

    products.push({
      checkbox: attrs(cb),
      chosenContainer: {
        tag: (container.tagName || '').toLowerCase(),
        id: container.id || '',
        className: typeof container.className === 'string' ? short(container.className, 340) : '',
        text: short(text, 4600),
        prices: prices(text),
        numericCandidates: numbers(text)
      },
      inputs: Array.prototype.slice.call(container.querySelectorAll('input')).map(attrs),
      selects: Array.prototype.slice.call(container.querySelectorAll('select')).map(function (el) {
        var data = attrs(el);
        data.selectedText = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex].text : '';
        return data;
      }),
      quantityControls: controls.filter(looksQty).map(attrs),
      shippingControls: controls.filter(looksShipping).map(attrs),
      buttons: Array.prototype.slice.call(container.querySelectorAll('button,[role="button"]')).map(attrs),
      links: Array.prototype.slice.call(container.querySelectorAll('a')).map(attrs).slice(0, 40),
      ancestorSnapshots: ancestorSnapshots(cb)
    });
  });

  var pageText = safeText(document.body);
  var report = {
    toolVersion: '1.0-kidkids',
    pageHost: location.hostname,
    pagePath: location.pathname,
    checkedCheckboxCount: checked.length,
    detectedCandidateCount: products.length,
    pageShippingSnippets: pageText.split('\n').map(function(s){return s.trim();}).filter(function(s){
      return /배송|택배|무료|착불/.test(s);
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
  title.innerHTML = '<div style="font-size:13px;font-weight:800;color:#7c3aed">키드키즈몰 장바구니 진단</div><div style="font-size:22px;font-weight:850;color:#172033;margin-top:4px">진단정보가 준비되었습니다.</div><div style="font-size:13px;color:#667085;margin-top:5px">복사한 내용을 ChatGPT 대화에 그대로 붙여 주세요.</div>';

  var area = document.createElement('textarea');
  area.value = json;
  area.readOnly = true;
  area.style.cssText = 'width:100%;min-height:470px;resize:vertical;border:1px solid #d0d5dd;border-radius:10px;padding:12px;font:12px/1.55 Consolas,monospace;color:#344054;background:#f8fafc;';

  var actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';

  var copy = document.createElement('button');
  copy.textContent = '진단정보 복사';
  copy.style.cssText = 'border:0;border-radius:10px;background:#7c3aed;color:#fff;font-weight:800;padding:11px 16px;cursor:pointer;';
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