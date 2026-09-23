(function () {
  'use strict';

  var EXTRACTOR_VERSION = '3.0.17';
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

  function showToast(message) {
    var old = document.getElementById('ddalkkak-extractor-toast');
    if (old) old.remove();

    var toast = document.createElement('div');
    toast.id = 'ddalkkak-extractor-toast';
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.right = '24px';
    toast.style.bottom = '24px';
    toast.style.zIndex = '2147483647';
    toast.style.maxWidth = '420px';
    toast.style.padding = '14px 18px';
    toast.style.borderRadius = '12px';
    toast.style.background = '#92400e';
    toast.style.color = '#fff';
    toast.style.fontFamily = 'Pretendard, "Malgun Gothic", sans-serif';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '700';
    toast.style.lineHeight = '1.5';
    toast.style.boxShadow = '0 12px 28px rgba(15,23,42,.22)';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    toast.style.transition = 'opacity .2s ease, transform .2s ease';
    toast.style.pointerEvents = 'none';

    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      setTimeout(function () { toast.remove(); }, 220);
    }, 2600);
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

      // 쿠팡은 실제 장바구니 수량을 .cart-quantity-input 의 value에 보관한다.
      // 화면에 표시되는 큰 금액은 해당 행의 수량 전체 금액이므로 수량으로 나눠 단가를 복원한다.
      var qtyInput = container.querySelector('input.cart-quantity-input') ||
        container.querySelector('input[class*="cart-quantity-input"]');
      var qty = qtyInput ? parseInt(String(qtyInput.value || '').replace(/,/g, ''), 10) : 1;
      if (!Number.isFinite(qty) || qty < 1) qty = 1;

      var discM = txt.match(/\d+%\s*([\d,]+)\s*원/);
      var lineTotal = discM ? parseInt(discM[1].replace(/,/g, ''), 10) : parseInt(allP[0].replace(/[^\d]/g, ''), 10);
      if (!lineTotal) return;

      var price = qty > 1 ? Math.round(lineTotal / qty) : lineTotal;
      var needsReview = qty > 1 && (lineTotal % qty !== 0);

      var spec = rawSpec.replace(/,?\s*\d+개$/, '').trim();
      var key = name + '|' + spec + '|' + qty + '|' + price;
      if (seen[key]) return;
      seen[key] = true;

      addItem({ name: name, spec: spec, unit: '개', qty: qty, price: price, needsReview: needsReview });
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
    var seen = {};

    eachChecked(function (cb) {
      // 판매자 전체 선택 체크박스가 아니라 실제 상품 체크박스만 처리한다.
      var item = cb.closest ? cb.closest('.item') : null;
      if (!item) return;

      var t = item.innerText || '';
      if (!t.includes('상품명:') || !t.includes('상품 금액')) return;

      var nm = t.match(/상품명:\s*\n?([^\n]+)/);
      var name = nm ? nm[1].trim() : '';
      if (!name) return;

      var op = t.match(/옵션선택 정보\s*\n([^\n]+)/);
      var spec = op ? op[1].trim() : '';

      // G마켓 새 장바구니는 실제 수량을 input.item_qty_count.value 에 보관한다.
      var qtyInput = item.querySelector('input.item_qty_count') ||
        item.querySelector('input[title="상품수량"]') ||
        item.querySelector('input[type="number"]');
      var qty = qtyInput ? parseInt(String(qtyInput.value || '').replace(/,/g, ''), 10) : 1;
      if (!Number.isFinite(qty) || qty < 1) qty = 1;

      // 상품 금액은 해당 행의 수량 전체 금액이므로 수량으로 나눠 단가를 복원한다.
      var pm = t.match(/상품 금액\s*:\s*\n?([\d,]+)원/);
      var lineTotal = pm ? parseInt(pm[1].replace(/,/g, ''), 10) : 0;
      if (!lineTotal) return;

      var price = qty > 1 ? Math.round(lineTotal / qty) : lineTotal;
      var needsReview = qty > 1 && (lineTotal % qty !== 0);

      var key = (cb.id || '') + '|' + name + '|' + spec + '|' + qty + '|' + lineTotal;
      if (seen[key]) return;
      seen[key] = true;

      addItem({
        name: name,
        spec: spec,
        unit: '개',
        qty: qty,
        price: price,
        needsReview: needsReview
      });
    });

    // 기존 G마켓 배송비 표시 형식도 계속 지원한다.
    Array.from(document.querySelectorAll('li')).forEach(function (el) {
      var t = el.innerText || '';
      if (!t.startsWith('배송비') || !t.includes('원') || t.includes('무료')) return;
      if (t.length > 60) return;
      var sm = t.match(/배송비\s*([\d,]+)원/) || t.match(/([\d,]+)원/);
      var shipping = sm ? parseInt(sm[1].replace(/,/g, ''), 10) : 0;
      if (shipping > 0) addItem({ name: '배송비', unit: '식', qty: 1, price: shipping });
    });
  }

  function parse11st() {
    site = '11번가';
    var bundleSeen = {};

    eachChecked(function (cb) {
      // 비로그인 11번가는 실제 상품이 li.s_cart_prd 안에 있고,
      // 수량은 input.input_count_modify(value)로 제공한다.
      // 로그인 화면과의 호환을 위해 기존 부모 탐색/텍스트 방식도 fallback으로 유지한다.
      var c = cb.closest ? cb.closest('li.s_cart_prd') : null;
      if (!c) c = cb.parentElement && cb.parentElement.parentElement;
      if (!c) return;

      var t = c.innerText || '';
      if (t.length < 100) return;

      var name = (t.split('\n')[0] || '').trim();
      if (!name) return;

      var op = t.match(/옵션\n(.+?)\n/);

      var qty = 0;
      var qtyInput = c.querySelector && (
        c.querySelector('input.input_count_modify') ||
        c.querySelector('input[title="수량"]') ||
        c.querySelector('input[name^="qty_"]')
      );
      if (qtyInput) {
        qty = parseInt(String(qtyInput.value || '').replace(/,/g, ''), 10);
      }

      if (!Number.isFinite(qty) || qty < 1) {
        var qtyButton = c.querySelector && c.querySelector('button.btn_count_modify[title="수량변경"]');
        if (qtyButton) {
          qty = parseInt(String(qtyButton.innerText || qtyButton.textContent || '').replace(/,/g, ''), 10);
        }
      }

      if (!Number.isFinite(qty) || qty < 1) {
        var qm = t.match(/(\d+)쿠폰변경/);
        qty = qm ? parseInt(qm[1], 10) : 1;
      }

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
    var selectedData = [];

    eachChecked(function (cb) {
      // S2B 상품 체크박스 value 자체에 상품/가격/배송 조건이 JSON으로 들어 있다.
      if (cb.id !== 'chk[]') return;

      var data;
      try {
        data = JSON.parse(String(cb.value || ''));
      } catch (_) {
        return;
      }

      if (!data || !data.goods_name || !data.estimate_amt) return;

      var rnum = String(data.rnum || '').trim();
      var qtyInput = rnum ? document.querySelector('input[name="f_estimate_quantity' + rnum + '"]') : null;
      var qty = qtyInput
        ? parseInt(String(qtyInput.value || '').replace(/,/g, ''), 10)
        : parseInt(String(data.estimate_quantity || '1').replace(/,/g, ''), 10);
      if (!Number.isFinite(qty) || qty < 1) qty = 1;

      var unitPrice = parseInt(String(data.estimate_amt || '0').replace(/,/g, ''), 10);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) return;

      var unit = String(data.credit_str || '개').trim() || '개';
      var spec = String(data.size || '').trim();

      addItem({
        name: String(data.goods_name || '').trim(),
        spec: spec,
        unit: unit,
        qty: qty,
        price: unitPrice
      });

      selectedData.push(data);
    });

    // S2B가 선택 상품과 조건부무료/묶음배송 규칙까지 계산해 둔 최종 배송비를 그대로 사용한다.
    // 직접 상품별 배송비를 다시 합산하면 조건부무료 및 묶음배송 Y/N에서 오차가 생길 수 있다.
    var totalFeeEl = document.getElementById('tot_fee');
    var totalFee = totalFeeEl
      ? parseInt(String(totalFeeEl.value || totalFeeEl.innerText || '0').replace(/[^0-9-]/g, ''), 10)
      : NaN;

    if (Number.isFinite(totalFee) && totalFee > 0) {
      addItem({ name: '배송비', unit: '식', qty: 1, price: totalFee });
    } else if (!Number.isFinite(totalFee) && selectedData.some(function (data) {
      return parseInt(String(data.delivery_fee || '0').replace(/,/g, ''), 10) > 0 ||
        String(data.delivery_fee_kind || '') === '3';
    })) {
      addItem({
        name: '배송비(확인 필요)',
        spec: 'S2B 최종 배송비 확인',
        unit: '식',
        qty: 1,
        price: 0,
        needsReview: true
      });
    }
  }

  function consolidateShippingItems() {
    var shippingItems = items.filter(function (item) {
      return /배송비/.test(item.name || '');
    });
    if (shippingItems.length <= 1) return;

    var total = shippingItems.reduce(function (sum, item) {
      return sum + ((parseInt(item.price, 10) || 0) * (parseInt(item.qty, 10) || 1));
    }, 0);
    var needsReview = shippingItems.some(function (item) { return item.needsReview; });

    items = items.filter(function (item) {
      return !/배송비/.test(item.name || '');
    });
    items.push({
      name: needsReview ? '배송비(합계·확인 필요)' : '배송비',
      spec: shippingItems.length + '건 합산',
      unit: '식',
      qty: 1,
      price: total,
      selected: true,
      site: site,
      extractorVersion: EXTRACTOR_VERSION,
      needsReview: needsReview
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
    showToast('선택된 상품을 찾지 못했습니다. 장바구니에서 상품을 체크한 뒤 다시 실행해 주세요.');
    return;
  }

  consolidateShippingItems();

  var encoded = encodeURIComponent(JSON.stringify(items));
  window.open(appUrl + '#' + encoded, '_blank');
})();
