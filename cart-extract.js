(function () {
  'use strict';

  var EXTRACTOR_VERSION = '3.0.1';
  var scriptUrl = (document.currentScript && document.currentScript.src) || '';
  var appUrl = 'https://kirakein-gif.github.io/ddalkkak-cart-request/';
  try {
    if (scriptUrl) appUrl = new URL('./', scriptUrl).href.split('?')[0].split('#')[0];
  } catch (_) {}

  var host = location.hostname;
  var items = [];
  var site = '';

  function addItem(data) {
    if (!data || !String(data.name || '').trim()) return;
    var qty = parseInt(String(data.qty || 1).replace(/,/g, ''), 10);
    var price = parseInt(String(data.price || 0).replace(/,/g, ''), 10);
    items.push({
      name: String(data.name || '').trim(),
      spec: String(data.spec || '').trim(),
      unit: String(data.unit || '개').trim() || '개',
      qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      price: Number.isFinite(price) && price >= 0 ? price : 0,
      selected: true,
      site: site,
      extractorVersion: EXTRACTOR_VERSION,
      needsReview: Boolean(data.needsReview)
    });
  }

  function eachChecked(callback) {
    document.querySelectorAll('input[type=checkbox]:checked').forEach(function (cb) {
      try { callback(cb); } catch (_) {}
    });
  }

  function parseCoupang() {
    site = '쿠팡';
    var seen = {};

    eachChecked(function (cb) {
      var container = cb.parentElement && cb.parentElement.parentElement && cb.parentElement.parentElement.parentElement;
      if (!container) return;
      var txt = container.innerText || '';

      // 장바구니 그룹/안내 영역의 체크박스가 선택된 경우,
      // 상위 컨테이너에 여러 상품이 한꺼번에 들어 있어 첫 상품이 중복 추출될 수 있다.
      // 실제 상품 행은 보통 '삭제'가 1회만 나타나므로 다중 상품 컨테이너는 제외한다.
      var deleteCount = (txt.match(/삭제/g) || []).length;
      if (deleteCount > 1) return;

      // 쿠팡 상단의 품절임박/그룹 안내 문구는 상품명이 아니므로 제외한다.
      if (/품절임박|남은 상품이 있어요|로켓배송 상품들/.test(txt.split('\n')[0] || '')) return;

      var allP = txt.match(/([\d,]+)\s*원/g);
      if (!allP) return;

      var nm = txt.match(/^([\s\S]+?)옵션:/);
      var fallback = txt.match(/^([\s\S]+?)삭제/);
      var name = nm ? nm[1].trim() : (fallback ? fallback[1].trim() : '');
      if (!name) return;

      // 안내 배너가 실제 상품 컨테이너처럼 잡힌 경우 최종 상품명 단계에서 다시 제외한다.
      if (/품절임박|남은 상품이 있어요|로켓배송 상품들/.test(name)) return;

      var sm = txt.match(/옵션:\s*([^\n]+)/);
      var rawSpec = sm ? sm[1].trim() : '';
      var discM = txt.match(/\d+%\s*([\d,]+)\s*원/);
      var price = discM ? parseInt(discM[1].replace(/,/g, ''), 10) : parseInt(allP[0].replace(/[^\d]/g, ''), 10);
      if (!price) return;

      var spec = rawSpec.replace(/,?\s*\d+개$/, '').trim();
      var key = name + '|' + spec + '|' + price;
      if (seen[key]) return;
      seen[key] = true;

      addItem({ name: name, spec: spec, unit: '개', qty: 1, price: price });
    });

    var shipEl = Array.from(document.querySelectorAll('*')).find(function (el) {
      var t = el.innerText || '';
      return el.children.length < 3 && t.trim().startsWith('총 배송비') && t.includes('원') && t.length < 40;
    });
    if (shipEl) {
      var sm2 = shipEl.innerText.match(/([\d,]+)\s*원/);
      var shipping = sm2 ? parseInt(sm2[1].replace(/,/g, ''), 10) : 0;
      if (shipping > 0) addItem({ name: '배송비', unit: '식', qty: 1, price: shipping });
    }
  }

  function parseGmarket() {
    site = 'G마켓';

    eachChecked(function (cb) {
      var p2 = cb.parentElement && cb.parentElement.parentElement;
      if (!p2 || (p2.innerText || '').length > 0) return;
      var c = p2.parentElement;
      if (!c) return;
      var t = c.innerText || '';
      if (!t.includes('상품명:')) return;

      var nm = t.match(/상품명:\n(.+?)\n/);
      var name = nm ? nm[1].trim() : '';
      if (!name) return;

      t.split('구매할 상품 상세 정보').forEach(function (block) {
        if (!block.includes('상품 금액 :')) return;
        var op = block.match(/옵션선택 정보\n(.+?)\n/);
        var qm = block.match(/상품 수\s+(\d+)\s+증가/);
        var pm = block.match(/상품 금액 :\n([\d,]+)원/);
        var price = pm ? parseInt(pm[1].replace(/,/g, ''), 10) : 0;
        if (!price) return;
        addItem({
          name: name,
          spec: op ? op[1].trim() : '',
          unit: '개',
          qty: qm ? parseInt(qm[1], 10) : 1,
          price: price
        });
      });
    });

    var shipLi = Array.from(document.querySelectorAll('li')).find(function (el) {
      var t = el.innerText || '';
      return t.startsWith('배송비\n') && t.includes('원') && !t.includes('무료') && t.length < 20;
    });
    if (shipLi) {
      var sm = shipLi.innerText.match(/([\d,]+)원/);
      var shipping = sm ? parseInt(sm[1].replace(/,/g, ''), 10) : 0;
      if (shipping > 0) addItem({ name: '배송비', unit: '식', qty: 1, price: shipping });
    }
  }

  function parse11st() {
    site = '11번가';
    var bundleSeen = {};

    eachChecked(function (cb) {
      var c = cb.parentElement && cb.parentElement.parentElement;
      if (!c) return;
      var t = c.innerText || '';
      if (t.length < 100) return;

      var name = (t.split('\n')[0] || '').trim();
      if (!name) return;

      var op = t.match(/옵션\n(.+?)\n/);
      var qm = t.match(/(\d+)쿠폰변경/);
      var qty = qm ? parseInt(qm[1], 10) : 1;
      var pm = t.match(/할인모음가\n([\d,]+)원/) || t.match(/판매가\n([\d,]+)원/);
      var totalOrPrice = pm ? parseInt(pm[1].replace(/,/g, ''), 10) : 0;
      var price = totalOrPrice ? Math.floor(totalOrPrice / qty) : 0;
      if (!price) return;

      addItem({ name: name, spec: op ? op[1].trim() : '', unit: '개', qty: qty, price: price });

      var grp = c.parentElement && c.parentElement.parentElement && c.parentElement.parentElement.parentElement;
      if (!grp) return;
      var gt = grp.innerText || '';

      if (gt.includes('묶음')) {
        var groupKey = (grp.className || '') + '|' + (grp.id || '') + '|' + gt.slice(0, 80);
        if (bundleSeen[groupKey]) return;
        bundleSeen[groupKey] = true;

        var bm = gt.match(/묶음 배송비 ([\d,]+)원/);
        var bundledShipping = bm ? parseInt(bm[1].replace(/,/g, ''), 10) : 0;
        if (bundledShipping > 0) addItem({ name: '배송비(묶음)', unit: '식', qty: 1, price: bundledShipping });
      } else {
        var ind = t.match(/배송비\n\n도움말\n배송비\n\n([\d,]+)원/);
        var shipping = ind ? parseInt(ind[1].replace(/,/g, ''), 10) : 0;
        if (shipping > 0) addItem({ name: '배송비', unit: '식', qty: 1, price: shipping });
      }
    });
  }

  function parseEmart() {
    site = '이마트몰';
    var NL = String.fromCharCode(10);

    eachChecked(function (cb) {
      var p2 = cb.parentElement && cb.parentElement.parentElement;
      if (!p2 || (p2.innerText || '').trim() !== '상품선택') return;
      var c3 = p2.parentElement;
      if (!c3) return;

      var t = c3.innerText || '';
      var delIdx = t.indexOf('상품 삭제');
      var priceIdx = t.indexOf('판매가격');
      if (delIdx < 0 || priceIdx < 0) return;

      var nameLines = t.substring(delIdx + '상품 삭제'.length).split(NL).map(function (s) { return s.trim(); }).filter(Boolean);
      var priceLines = t.substring(priceIdx + '판매가격'.length).split(NL).map(function (s) { return s.trim(); }).filter(Boolean);
      var name = nameLines[0] || '';
      var totalPrice = parseInt(String(priceLines[0] || '').replace(/,/g, ''), 10) || 0;
      if (!name || !totalPrice) return;

      var qtyInput = c3.querySelector('input[type=number]');
      var qty = qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;
      addItem({ name: name, unit: '개', qty: qty, price: Math.floor(totalPrice / qty) });
    });

    var shipDl = Array.from(document.querySelectorAll('dl')).find(function (el) {
      var t = el.innerText || '';
      return t.startsWith('배송비') && t.includes('+');
    });
    if (shipDl) {
      var dlTxt = shipDl.innerText || '';
      var plusIdx = dlTxt.indexOf('+');
      var afterPlus = plusIdx > -1 ? dlTxt.substring(plusIdx + 1) : '';
      var wonIdx = afterPlus.indexOf('원');
      var shipping = wonIdx > -1 ? parseInt(afterPlus.substring(0, wonIdx).replace(/,/g, ''), 10) : 0;
      if (shipping > 0) addItem({ name: '배송비', unit: '식', qty: 1, price: shipping });
    }
  }

  function parseS2B() {
    site = 'S2B';
    var NL = String.fromCharCode(10);
    var TAB = String.fromCharCode(9);
    var skip = ['S2B', '바이', '(주)', '모노트', '지오', '에듀', '비즈', '안나', '별하랑', '지영'];

    function shouldSkip(s) {
      return skip.some(function (word) { return s.includes(word); });
    }

    eachChecked(function (cb) {
      var c2 = cb.parentElement && cb.parentElement.parentElement;
      if (!c2) return;

      var t = c2.innerText || '';
      var lines = t.split(NL).map(function (s) { return s.trim(); }).filter(Boolean);
      var name = '';
      var spec = '';

      for (var i = 0; i < lines.length; i += 1) {
        var line = lines[i].split(TAB)[0].trim();
        if (line.length < 2 || shouldSkip(line)) continue;
        if (line.charAt(4) === '-' && line.charAt(7) === '-') continue;
        if (line.replace(/[0-9,]/g, '').length === 0) continue;
        if (!name) name = line;
        else if (!spec) { spec = line; break; }
      }
      if (!name) return;

      var nums = t.split(TAB).map(function (s) { return s.trim(); }).map(function (s) {
        var v = s.replace(/,/g, '');
        return v.length >= 3 && v.replace(/[0-9]/g, '').length === 0 ? parseInt(v, 10) : null;
      }).filter(function (n) { return Number.isFinite(n); });

      var unitPrice = nums.length > 0 ? nums[0] : 0;
      var totalPrice = nums.length > 1 ? nums[1] : unitPrice;
      var shipping = nums.length > 2 ? nums[2] : 0;
      if (!unitPrice) return;

      var qty = totalPrice && unitPrice ? Math.max(1, Math.round(totalPrice / unitPrice)) : 1;
      addItem({ name: name, spec: spec, unit: '개', qty: qty, price: unitPrice });

      if (shipping > 0) {
        addItem({ name: '배송비', unit: '식', qty: 1, price: shipping });
      } else {
        var hasConditionalShipping = Array.from(c2.querySelectorAll('img')).some(function (img) {
          return (img.src || '').includes('btn_pay_03');
        });
        if (hasConditionalShipping) {
          addItem({ name: '배송비(확인 필요)', unit: '식', qty: 1, price: 0, needsReview: true });
        }
      }
    });
  }

  try {
    if (host.includes('coupang.com')) parseCoupang();
    else if (host.includes('gmarket.co.kr') || host.includes('gmarket.com')) parseGmarket();
    else if (host.includes('11st.co.kr')) parse11st();
    else if (host.includes('ssg.com') || host.includes('emart.com')) parseEmart();
    else if (host.includes('s2b.kr')) parseS2B();
    else {
      alert('지원하지 않는 쇼핑몰입니다.\n지원: 쿠팡 / G마켓 / 11번가 / 이마트몰 / S2B');
      return;
    }
  } catch (error) {
    alert('장바구니 분석 중 오류가 발생했습니다.\n쇼핑몰 화면이 변경되었을 수 있습니다.');
    return;
  }

  // 쿠팡 안내/그룹 배너가 어떤 DOM 구조로 들어오더라도 최종 전달 전에 한 번 더 제거한다.
  if (site === '쿠팡') {
    items = items.filter(function (item) {
      return !/품절임박|남은 상품이 있어요|로켓배송 상품들/.test(item.name || '');
    });
  }

  if (!items.length) {
    alert('체크된 상품을 찾지 못했습니다.\n상품을 체크했는지 확인해 주세요.');
    return;
  }

  var encoded = encodeURIComponent(JSON.stringify(items));
  window.open(appUrl + '#' + encoded, '_blank');
})();
