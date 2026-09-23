(function () {
  'use strict';

  if (!(location.hostname.includes('gmarket.co.kr') || location.hostname.includes('gmarket.com'))) {
    alert('이 진단 도구는 G마켓 장바구니에서만 실행해 주세요.');
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
      className: typeof el.className === 'string' ? short(el.className, 300) : '',
      type: el.type || '',
      name: el.name || '',
      value: typeof el.value !== 'undefined' ? String(el.value) : '',
      checked: typeof el.checked === 'boolean' ? el.checked : undefined,
      ariaLabel: el.getAttribute && (el.getAttribute('aria-label') || ''),
      title: el.getAttribute && (el.getAttribute('title') || ''),
      role: el.getAttribute && (el.getAttribute('role') || ''),
      dataTestId: el.getAttribute && (el.getAttribute('data-testid') || ''),
      text: short(safeText(el), 260)
    };
  }

  function unique(arr) {
    return arr.filter(function (v, i) { return arr.indexOf(v) === i; });
  }

  function looksLikeQuantity(el) {
    var text = safeText(el);
    var value = typeof el.value !== 'undefined' ? String(el.value) : '';
    var meta = [
      el.id || '',
      typeof el.className === 'string' ? el.className : '',
      el.getAttribute && (el.getAttribute('aria-label') || ''),
      el.getAttribute && (el.getAttribute('title') || ''),
      el.getAttribute && (el.getAttribute('name') || ''),
      el.getAttribute && (el.getAttribute('role') || ''),
      el.getAttribute && (el.getAttribute('data-testid') || '')
    ].join(' ');
    return /수량|quantity|qty|count|amount|spinner|stepper/i.test(meta) ||
      /^\d{1,3}$/.test(text) ||
      /^\d{1,3}$/.test(value) ||
      /증가|감소|plus|minus|더하기|빼기/i.test(text + ' ' + meta);
  }

  function ancestors(cb) {
    var result = [];
    var node = cb;
    for (var depth = 0; depth < 9 && node; depth += 1, node = node.parentElement) {
      var text = safeText(node);
      result.push({
        depth: depth,
        tag: (node.tagName || '').toLowerCase(),
        id: node.id || '',
        className: typeof node.className === 'string' ? short(node.className, 320) : '',
        textLength: text.length,
        prices: unique(text.match(/[\d,]+\s*원/g) || []),
        text: short(text, 2600)
      });
    }
    return result;
  }

  function chooseContainer(cb) {
    var node = cb;
    var candidates = [];
    for (var depth = 0; depth < 10 && node; depth += 1, node = node.parentElement) {
      var text = safeText(node);
      var priceCount = (text.match(/[\d,]+\s*원/g) || []).length;
      var controlCount = node.querySelectorAll ? node.querySelectorAll('input,button,select').length : 0;
      if (priceCount >= 1 && controlCount >= 1 && text.length > 10 && text.length < 6000) {
        candidates.push({node:node, textLength:text.length, depth:depth});
      }
    }
    if (!candidates.length) return cb.parentElement || cb;
    candidates.sort(function(a,b){ return a.textLength - b.textLength; });
    return candidates[0].node;
  }

  var checked = Array.prototype.slice.call(document.querySelectorAll('input[type=checkbox]:checked'));
  var products = [];

  checked.forEach(function (cb) {
    var container = chooseContainer(cb);
    if (!container) return;
    var text = safeText(container);

    var controls = Array.prototype.slice.call(container.querySelectorAll('input,button,select,[role="button"],[role="spinbutton"]'));
    var qtyCandidates = controls.filter(looksLikeQuantity).map(attrs);

    var allInputs = Array.prototype.slice.call(container.querySelectorAll('input')).map(attrs);
    var allSelects = Array.prototype.slice.call(container.querySelectorAll('select')).map(function (el) {
      var data = attrs(el);
      data.selectedText = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex].text : '';
      return data;
    });
    var buttons = Array.prototype.slice.call(container.querySelectorAll('button,[role="button"]')).map(attrs).filter(function (b) {
      return looksLikeQuantity({
        id:b.id,
        className:b.className,
        value:b.value,
        getAttribute:function(name){
          if(name==='aria-label') return b.ariaLabel;
          if(name==='title') return b.title;
          if(name==='name') return b.name;
          if(name==='role') return b.role;
          if(name==='data-testid') return b.dataTestId;
          return '';
        },
        innerText:b.text,
        textContent:b.text
      });
    });

    products.push({
      checkbox: attrs(cb),
      chosenContainer: {
        tag: (container.tagName || '').toLowerCase(),
        id: container.id || '',
        className: typeof container.className === 'string' ? short(container.className, 320) : '',
        text: short(text, 3800),
        prices: unique(text.match(/[\d,]+\s*원/g) || [])
      },
      inputs: allInputs,
      selects: allSelects,
      quantityControls: qtyCandidates,
      quantityButtons: buttons,
      ancestorSnapshots: ancestors(cb)
    });
  });

  var report = {
    toolVersion: '1.0-gmarket',
    pageHost: location.hostname,
    checkedCheckboxCount: checked.length,
    detectedCandidateCount: products.length,
    products: products.slice(0, 10)
  };

  var json = JSON.stringify(report, null, 2);

  var old = document.getElementById('ddalkkak-diagnose-overlay');
  if (old) old.remove();

  var overlay = document.createElement('div');
  overlay.id = 'ddalkkak-diagnose-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:24px;font-family:Pretendard,Malgun Gothic,sans-serif;';

  var box = document.createElement('div');
  box.style.cssText = 'width:min(920px,96vw);max-height:90vh;background:#fff;border-radius:16px;box-shadow:0 22px 60px rgba(15,23,42,.3);padding:20px;display:flex;flex-direction:column;gap:12px;';

  var title = document.createElement('div');
  title.innerHTML = '<div style="font-size:13px;font-weight:800;color:#1d4ed8">G마켓 수량 진단</div><div style="font-size:22px;font-weight:850;color:#172033;margin-top:4px">진단정보가 준비되었습니다.</div><div style="font-size:13px;color:#667085;margin-top:5px">복사한 내용을 ChatGPT 대화에 그대로 붙여 주세요.</div>';

  var area = document.createElement('textarea');
  area.value = json;
  area.readOnly = true;
  area.style.cssText = 'width:100%;min-height:450px;resize:vertical;border:1px solid #d0d5dd;border-radius:10px;padding:12px;font:12px/1.55 Consolas,monospace;color:#344054;background:#f8fafc;';

  var actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';

  var copy = document.createElement('button');
  copy.textContent = '진단정보 복사';
  copy.style.cssText = 'border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:800;padding:11px 16px;cursor:pointer;';
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