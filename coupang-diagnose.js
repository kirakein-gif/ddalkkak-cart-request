(function () {
  'use strict';

  if (!location.hostname.includes('coupang.com')) {
    alert('이 진단 도구는 쿠팡 장바구니에서만 실행해 주세요.');
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
      className: typeof el.className === 'string' ? short(el.className, 260) : '',
      type: el.type || '',
      name: el.name || '',
      value: typeof el.value !== 'undefined' ? String(el.value) : '',
      checked: typeof el.checked === 'boolean' ? el.checked : undefined,
      ariaLabel: el.getAttribute && (el.getAttribute('aria-label') || ''),
      title: el.getAttribute && (el.getAttribute('title') || ''),
      role: el.getAttribute && (el.getAttribute('role') || ''),
      dataTestId: el.getAttribute && (el.getAttribute('data-testid') || ''),
      text: short(safeText(el), 220)
    };
  }

  function unique(arr) {
    return arr.filter(function (v, i) { return arr.indexOf(v) === i; });
  }

  function findProductContainer(cb) {
    var node = cb;
    var best = null;
    for (var i = 0; i < 8 && node; i += 1, node = node.parentElement) {
      var text = safeText(node);
      var deleteCount = (text.match(/삭제/g) || []).length;
      var priceCount = (text.match(/[\d,]+\s*원/g) || []).length;
      if (deleteCount === 1 && priceCount >= 1 && text.length < 5000 &&
          !/품절임박|남은 상품이 있어요|로켓배송 상품들/.test((text.split('\n')[0] || ''))) {
        if (!best || text.length < safeText(best).length) best = node;
      }
    }
    return best;
  }

  function quantityCandidates(container) {
    var out = [];
    Array.prototype.slice.call(container.querySelectorAll('*')).forEach(function (el) {
      if (out.length >= 60) return;
      var text = safeText(el);
      var meta = [
        el.id || '',
        typeof el.className === 'string' ? el.className : '',
        el.getAttribute && (el.getAttribute('aria-label') || ''),
        el.getAttribute && (el.getAttribute('title') || ''),
        el.getAttribute && (el.getAttribute('name') || ''),
        el.getAttribute && (el.getAttribute('role') || ''),
        el.getAttribute && (el.getAttribute('data-testid') || '')
      ].join(' ');
      var val = typeof el.value !== 'undefined' ? String(el.value) : '';
      var looksQty = /수량|quantity|qty|count|amount/i.test(meta) ||
        /^\d{1,3}$/.test(text) ||
        /^\d{1,3}$/.test(val) ||
        /증가|감소|plus|minus/i.test(text + ' ' + meta);
      if (looksQty) out.push(attrs(el));
    });
    return out;
  }

  var checked = Array.prototype.slice.call(document.querySelectorAll('input[type=checkbox]:checked'));
  var products = [];

  checked.forEach(function (cb) {
    var container = findProductContainer(cb);
    if (!container) return;

    var text = safeText(container);
    var prices = unique((text.match(/[\d,]+\s*원/g) || []));
    var inputs = Array.prototype.slice.call(container.querySelectorAll('input')).map(attrs);
    var selects = Array.prototype.slice.call(container.querySelectorAll('select')).map(function (el) {
      var data = attrs(el);
      data.selectedText = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex].text : '';
      return data;
    });
    var buttons = Array.prototype.slice.call(container.querySelectorAll('button')).map(attrs).filter(function (b) {
      return /수량|quantity|qty|증가|감소|plus|minus/i.test(
        [b.text,b.ariaLabel,b.title,b.className,b.id,b.name].join(' ')
      ) || /^\d{1,3}$/.test(b.text);
    });

    products.push({
      checkbox: attrs(cb),
      container: {
        tag: (container.tagName || '').toLowerCase(),
        id: container.id || '',
        className: typeof container.className === 'string' ? short(container.className, 300) : '',
        text: short(text, 3500)
      },
      prices: prices,
      inputs: inputs,
      selects: selects,
      quantityButtons: buttons,
      quantityCandidates: quantityCandidates(container)
    });
  });

  var report = {
    toolVersion: '1.0',
    pageHost: location.hostname,
    checkedCheckboxCount: checked.length,
    detectedProductCount: products.length,
    products: products.slice(0, 8)
  };

  var json = JSON.stringify(report, null, 2);

  var old = document.getElementById('ddalkkak-diagnose-overlay');
  if (old) old.remove();

  var overlay = document.createElement('div');
  overlay.id = 'ddalkkak-diagnose-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:24px;font-family:Pretendard,Malgun Gothic,sans-serif;';

  var box = document.createElement('div');
  box.style.cssText = 'width:min(860px,96vw);max-height:90vh;background:#fff;border-radius:16px;box-shadow:0 22px 60px rgba(15,23,42,.3);padding:20px;display:flex;flex-direction:column;gap:12px;';

  var title = document.createElement('div');
  title.innerHTML = '<div style="font-size:13px;font-weight:800;color:#b45309">쿠팡 수량 진단</div><div style="font-size:22px;font-weight:850;color:#172033;margin-top:4px">진단정보가 준비되었습니다.</div><div style="font-size:13px;color:#667085;margin-top:5px">복사한 내용을 ChatGPT 대화에 그대로 붙여 주세요.</div>';

  var area = document.createElement('textarea');
  area.value = json;
  area.readOnly = true;
  area.style.cssText = 'width:100%;min-height:430px;resize:vertical;border:1px solid #d0d5dd;border-radius:10px;padding:12px;font:12px/1.55 Consolas,monospace;color:#344054;background:#f8fafc;';

  var actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';

  var copy = document.createElement('button');
  copy.textContent = '진단정보 복사';
  copy.style.cssText = 'border:0;border-radius:10px;background:#d97706;color:#fff;font-weight:800;padding:11px 16px;cursor:pointer;';
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