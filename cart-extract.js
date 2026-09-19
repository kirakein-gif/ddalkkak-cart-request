(function() {
  var host = location.hostname;
  var items = [];
  var site = '';

  // ── 쿠팡 ──────────────────────────────────────────
  function parseCoupang() {
    site = '쿠팡';
    var seen = {};
    document.querySelectorAll('input[type=checkbox]:checked').forEach(function(cb) {
      var container = cb.parentElement.parentElement.parentElement;
      var txt = container.innerText;
      var allP = txt.match(/([\d,]+)\s*원/g);
      if (!allP) return;
      var nm = txt.match(/^([\s\S]+?)옵션:/);
      var name = nm ? nm[1].trim() : (txt.match(/^([\s\S]+?)삭제/) ? txt.match(/^([\s\S]+?)삭제/)[1].trim() : '');
      if (!name) return;
      var sm = txt.match(/옵션:\s*([^\n]+)/);
      var sr = sm ? sm[1].trim() : '';
      var discM = txt.match(/\d+%\s*([\d,]+)\s*원/);
      var price = discM ? parseInt(discM[1].replace(/,/g, '')) : parseInt(allP[0].replace(/[^\d]/g, ''));
      if (!price) return;
      var spec = sr.replace(/,?\s*\d+개$/, '').trim();
      var seenKey = name + '|' + spec;
      if (seen[seenKey]) return;
      seen[seenKey] = true;
      items.push({ name: name, spec: spec, unit: '개', qty: 1, price: price, selected: true, site: site });
    });
    // 배송비
    var shipEl = Array.from(document.querySelectorAll('*')).find(function(el) {
      return el.children.length < 3 && el.innerText && el.innerText.trim().startsWith('총 배송비') && el.innerText.includes('원') && el.innerText.length < 30;
    });
    if (shipEl) {
      var sm2 = shipEl.innerText.match(/([\d,]+)\s*원/);
      var sp = sm2 ? parseInt(sm2[1].replace(/,/g, '')) : 0;
      if (sp > 0) items.push({ name: '배송비', spec: '', unit: '식', qty: 1, price: sp, selected: true, site: site });
    }
  }

  // ── G마켓 ──────────────────────────────────────────
  function parseGmarket() {
    site = 'G마켓';
    document.querySelectorAll('input[type=checkbox]:checked').forEach(function(cb) {
      if (cb.parentElement.parentElement.innerText.length > 0) return;
      var c = cb.parentElement.parentElement.parentElement;
      var t = c.innerText;
      if (!t.includes('상품명:')) return;
      var nm = t.match(/상품명:\n(.+?)\n/);
      var name = nm ? nm[1].trim() : '';
      if (!name) return;
      var blocks = t.split('구매할 상품 상세 정보');
      blocks.forEach(function(block) {
        if (!block.includes('상품 금액 :')) return;
        var op = block.match(/옵션선택 정보\n(.+?)\n/);
        var spec = op ? op[1].trim() : '';
        var qm = block.match(/상품 수\s+(\d+)\s+증가/);
        var qty = qm ? parseInt(qm[1]) : 1;
        var pm = block.match(/상품 금액 :\n([\d,]+)원/);
        var price = pm ? parseInt(pm[1].replace(/,/g, '')) : 0;
        if (!price) return;
        items.push({ name: name, spec: spec, unit: '개', qty: qty, price: price, selected: true, site: site });
      });
    });
    // 배송비
    var shipLi = Array.from(document.querySelectorAll('li')).find(function(el) {
      var t = el.innerText;
      return t.startsWith('배송비\n') && t.includes('원') && !t.includes('무료') && t.length < 15;
    });
    if (shipLi) {
      var sm = shipLi.innerText.match(/([\d,]+)원/);
      var sp = sm ? parseInt(sm[1].replace(/,/g, '')) : 0;
      if (sp > 0) items.push({ name: '배송비', spec: '', unit: '식', qty: 1, price: sp, selected: true, site: site });
    }
  }

  // ── 11번가 ──────────────────────────────────────────
  function parse11st() {
    site = '11번가';
    var bundleSeen = {};
    document.querySelectorAll('input[type=checkbox]:checked').forEach(function(cb) {
      var c = cb.parentElement.parentElement;
      var t = c.innerText;
      if (t.length < 100) return;
      var name = t.split('\n')[0].trim();
      if (!name) return;
      var op = t.match(/옵션\n(.+?)\n/);
      var spec = op ? op[1].trim() : '';
      var qm = t.match(/(\d+)쿠폰변경/);
      var qty = qm ? parseInt(qm[1]) : 1;
      var pm = t.match(/할인모음가\n([\d,]+)원/) || t.match(/판매가\n([\d,]+)원/);
      var price = pm ? Math.floor(parseInt(pm[1].replace(/,/g, '')) / qty) : 0;
      if (!price) return;
      items.push({ name: name, spec: spec, unit: '개', qty: qty, price: price, selected: true, site: site });
      // 배송비
      var grp = c.parentElement.parentElement.parentElement.parentElement;
      var hasBungle = grp.innerText.includes('묶음');
      if (hasBungle) {
        var grpId = grp.className + '|' + grp.id;
        if (!bundleSeen[grpId]) {
          bundleSeen[grpId] = true;
          var bm = grp.innerText.match(/묶음 배송비 ([\d,]+)원/);
          var ship = bm ? parseInt(bm[1].replace(/,/g, '')) : 0;
          if (ship > 0) items.push({ name: '배송비(묶음)', spec: '', unit: '식', qty: 1, price: ship, selected: true, site: site });
        }
      } else {
        var ind = t.match(/배송비\n\n도움말\n배송비\n\n([\d,]+)원/);
        var ship2 = ind ? parseInt(ind[1].replace(/,/g, '')) : 0;
        if (ship2 > 0) items.push({ name: '배송비', spec: '', unit: '식', qty: 1, price: ship2, selected: true, site: site });
      }
    });
  }

  // ── 이마트몰(SSG) ──────────────────────────────────────────
  function parseEmart() {
    site = '이마트몰';
    var NL = String.fromCharCode(10);
    var DEL = '상품 삭제';
    var PRICE = '판매가격';
    var QTY = '현재수량';
    var SEL = '상품선택';
    document.querySelectorAll('input[type=checkbox]:checked').forEach(function(cb) {
      var c2 = cb.parentElement.parentElement;
      if (c2.innerText.trim() !== SEL) return;
      var t = c2.parentElement.innerText;
      var delIdx = t.indexOf(DEL);
      if (delIdx < 0) return;
      var afterDel = t.substring(delIdx + DEL.length);
      var delLines = afterDel.split(NL).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
      var name = delLines[0] || '';
      if (!name) return;
      var priceIdx = t.indexOf(PRICE);
      if (priceIdx < 0) return;
      var afterPrice = t.substring(priceIdx + PRICE.length);
      var priceLines = afterPrice.split(NL).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
      var totalPrice = parseInt(priceLines[0].replace(/,/g, '')) || 0;
      if (!totalPrice) return;
      var qtyInput = c2.parentElement.querySelector('input[type=number]');
      var qty = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
      var price = Math.floor(totalPrice / qty);
      items.push({ name: name, spec: '', unit: '개', qty: qty, price: price, selected: true, site: site });
    });
    // 총 배송비
    var shipDl = Array.from(document.querySelectorAll('dl')).find(function(el) {
      return el.innerText.startsWith('배송비') && el.innerText.includes('+');
    });
    if (shipDl) {
      var dlTxt = shipDl.innerText;
      var plusIdx = dlTxt.indexOf('+');
      if (plusIdx > -1) {
        var afterPlus = dlTxt.substring(plusIdx + 1);
        var wonIdx = afterPlus.indexOf('원');
        var shipPrice = wonIdx > -1 ? parseInt(afterPlus.substring(0, wonIdx).replace(/,/g, '')) : 0;
        if (shipPrice > 0) items.push({ name: '배송비', spec: '', unit: '식', qty: 1, price: shipPrice, selected: true, site: site });
      }
    }
  }

  // ── S2B ──────────────────────────────────────────
  function parseS2B() {
    site = 'S2B';
    var NL = String.fromCharCode(10);
    var TAB = String.fromCharCode(9);
    var SKIP = ['S2B', '바이', '(주)', '모노트', '지오', '에듀', '비즈', '안나', '별하랑', '지영'];
    function isSkip(s) { for (var k = 0; k < SKIP.length; k++) { if (s.includes(SKIP[k])) return true; } return false; }
    document.querySelectorAll('input[type=checkbox]:checked').forEach(function(cb) {
      var c2 = cb.parentElement.parentElement;
      var t = c2.innerText;
      var lines = t.split(NL).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
      var name = ''; var spec = '';
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i].split(TAB)[0].trim();
        if (l.length < 2) continue;
        if (isSkip(l)) continue;
        if (l.charAt(4) === '-' && l.charAt(7) === '-') continue;
        if (l.replace(/[0-9,]/g, '').length === 0) continue;
        if (!name) { name = l; } else if (!spec) { spec = l; break; }
      }
      if (!name) return;
      var tabs = t.split(TAB).map(function(s) { return s.trim(); });
      var nums = [];
      for (var j = 0; j < tabs.length; j++) {
        var v = tabs[j].replace(/,/g, '');
        if (v.length >= 3 && v.replace(/[0-9]/g, '').length === 0) nums.push(parseInt(v));
      }
      var unitPrice = nums.length > 0 ? nums[0] : 0;
      var totalPrice = nums.length > 1 ? nums[1] : unitPrice;
      var shipPrice = nums.length > 2 ? nums[2] : 0;
      if (!unitPrice) return;
      var qty = totalPrice && unitPrice ? Math.round(totalPrice / unitPrice) : 1;
      items.push({ name: name, spec: spec, unit: '개', qty: qty, price: unitPrice, selected: true, site: site });
      if (shipPrice > 0) {
        items.push({ name: '배송비', spec: '', unit: '식', qty: 1, price: shipPrice, selected: true, site: site });
      } else {
        var imgs = c2.querySelectorAll('img');
        for (var k = 0; k < imgs.length; k++) {
          if (imgs[k].src.includes('btn_pay_03')) {
            items.push({ name: '배송비(직접입력)', spec: '', unit: '식', qty: 1, price: 3000, selected: true, site: site });
            break;
          }
        }
      }
    });
  }

  // ── 사이트 감지 ──────────────────────────────────────────
  if (host.includes('coupang.com')) {
    parseCoupang();
  } else if (host.includes('gmarket.co.kr') || host.includes('gmarket.com')) {
    parseGmarket();
  } else if (host.includes('11st.co.kr')) {
    parse11st();
  } else if (host.includes('ssg.com') || host.includes('emart.com')) {
    parseEmart();
  } else if (host.includes('s2b.kr')) {
    parseS2B();
  } else {
    alert('지원하지 않는 쇼핑몰입니다.\n지원: 쿠팡 / G마켓 / 11번가 / 이마트몰 / S2B');
    return;
  }

  if (!items.length) {
    alert('체크된 상품을 찾지 못했습니다.\n상품을 체크했는지 확인해주세요.');
    return;
  }

  var enc = encodeURIComponent(JSON.stringify(items));
  window.open('https://kirakein-gif.github.io/cart.html#' + enc, '_blank');
})();
