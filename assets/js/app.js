(() => {
  'use strict';

  const STORAGE_KEY = 'ddalkkak-cart-request-v3';
  const DEFAULT_PURPOSE = '유아 교육활동';
  const state = {
    items: [],
    purpose: DEFAULT_PURPOSE,
    sourceSite: ''
  };

  const $ = (id) => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    setupBookmarklet();
    bindEvents();

    const imported = readItemsFromHash();
    if (!imported) restoreDraft();

    $('purposeInput').value = state.purpose || DEFAULT_PURPOSE;
    render();

    if (imported) {
      showToast('장바구니 품목을 가져왔습니다.');
    }
  }

  function setupBookmarklet() {
    const extractorUrl = new URL('./cart-extract.js', location.href).href.split('#')[0].split('?')[0];
    const code =
      "javascript:(function(){" +
      "var old=document.getElementById('ddalkkak-cart-extractor');" +
      "if(old)old.remove();" +
      "var s=document.createElement('script');" +
      "s.id='ddalkkak-cart-extractor';" +
      "s.src='" + extractorUrl + "?t='+Date.now();" +
      "document.head.appendChild(s);" +
      "})();";
    $('bookmarkletBtn').href = code;
  }

  function bindEvents() {
    $('addRowBtn').addEventListener('click', addBlankItem);
    $('clearBtn').addEventListener('click', clearAll);
    $('chkAll').addEventListener('change', (e) => {
      state.items.forEach((item) => item.selected = e.target.checked);
      commitAndRender();
    });
    $('purposeInput').addEventListener('input', (e) => {
      state.purpose = e.target.value.trimStart();
      saveDraft();
      renderOutputs();
    });
    $('copySummaryBtn').addEventListener('click', () => copyText($('summaryText').textContent, '품의개요를 복사했습니다.'));
    $('copyCauseBtn').addEventListener('click', () => copyText($('causeText').textContent, '원인행위개요를 복사했습니다.'));
    $('exportExcelBtn').addEventListener('click', exportProposalExcel);
    $('exportCauseBtn').addEventListener('click', exportCauseExcel);
  }

  function readItemsFromHash() {
    const hash = location.hash.slice(1);
    if (!hash) return false;

    try {
      const parsed = JSON.parse(decodeURIComponent(hash));
      if (!Array.isArray(parsed)) throw new Error('invalid payload');

      state.items = parsed.map(normalizeItem).filter((item) => item.name);
      state.sourceSite = state.items[0]?.site || '';
      history.replaceState(null, '', location.pathname + location.search);
      saveDraft();
      return state.items.length > 0;
    } catch (error) {
      history.replaceState(null, '', location.pathname + location.search);
      showToast('가져온 장바구니 데이터를 읽지 못했습니다.', 'error');
      return false;
    }
  }

  function normalizeItem(item) {
    return {
      name: String(item?.name || '').trim(),
      spec: String(item?.spec || '').trim(),
      unit: String(item?.unit || '개').trim() || '개',
      qty: toPositiveNumber(item?.qty, 1),
      price: toNonNegativeNumber(item?.price, 0),
      selected: item?.selected !== false,
      site: String(item?.site || '').trim(),
      needsReview: Boolean(item?.needsReview)
    };
  }

  function toPositiveNumber(value, fallback) {
    const n = parseInt(String(value ?? '').replace(/,/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function toNonNegativeNumber(value, fallback) {
    const n = parseInt(String(value ?? '').replace(/,/g, ''), 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.items) || !saved.items.length) return;
      state.items = saved.items.map(normalizeItem);
      state.purpose = String(saved.purpose || DEFAULT_PURPOSE);
      state.sourceSite = String(saved.sourceSite || state.items[0]?.site || '');
      showToast('이전 작업을 복구했습니다.');
    } catch (_) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        items: state.items,
        purpose: state.purpose,
        sourceSite: state.sourceSite,
        savedAt: new Date().toISOString()
      }));
    } catch (_) {}
  }

  function render() {
    renderWorkspace();
    renderSummary();
    renderOutputs();
  }

  function renderWorkspace() {
    const hasItems = state.items.length > 0;
    $('emptyState').classList.toggle('hidden', hasItems);
    $('tableWrap').classList.toggle('hidden', !hasItems);
    $('installPanel').classList.toggle('hidden', hasItems);
    $('sourceText').textContent = hasItems
      ? (state.sourceSite ? state.sourceSite + '에서 가져온 품목입니다. 필요한 값은 바로 수정할 수 있습니다.' : '품목을 확인하고 필요한 값을 수정하세요.')
      : '장바구니에서 상품을 가져오면 여기에 표시됩니다.';

    const tbody = $('tbody');
    tbody.textContent = '';

    state.items.forEach((item, index) => {
      const tr = document.createElement('tr');
      if (item.needsReview) tr.classList.add('review-row');

      tr.appendChild(makeCheckboxCell(item, index));
      tr.appendChild(makeInputCell(item, index, 'name', 'text'));
      tr.appendChild(makeInputCell(item, index, 'spec', 'text'));
      tr.appendChild(makeInputCell(item, index, 'unit', 'text'));
      tr.appendChild(makeInputCell(item, index, 'qty', 'number'));
      tr.appendChild(makeInputCell(item, index, 'price', 'money'));

      const amount = document.createElement('td');
      amount.className = 'amount-cell';
      amount.textContent = formatWon(item.qty * item.price);
      if (item.needsReview) {
        const mark = document.createElement('span');
        mark.className = 'review-mark';
        mark.textContent = '확인';
        amount.appendChild(mark);
      }
      tr.appendChild(amount);

      const action = document.createElement('td');
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'delete-row';
      del.textContent = '✕';
      del.title = '삭제';
      del.addEventListener('click', () => {
        state.items.splice(index, 1);
        commitAndRender();
      });
      action.appendChild(del);
      tr.appendChild(action);

      tbody.appendChild(tr);
    });

    $('reviewNotice').classList.toggle('hidden', !state.items.some((item) => item.needsReview));
    const selected = state.items.filter((item) => item.selected);
    $('chkAll').checked = hasItems && selected.length === state.items.length;
  }

  function makeCheckboxCell(item, index) {
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = item.selected;
    input.setAttribute('aria-label', (index + 1) + '번째 항목 선택');
    input.addEventListener('change', () => {
      item.selected = input.checked;
      commitAndRender();
    });
    td.appendChild(input);
    return td;
  }

  function makeInputCell(item, index, field, type) {
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.className = 'cell-input' + (type === 'money' ? ' money' : '');
    input.value = type === 'money' ? formatNumber(item[field]) : item[field];

    input.addEventListener('change', () => {
      if (field === 'qty') {
        item.qty = toPositiveNumber(input.value, 1);
      } else if (field === 'price') {
        item.price = toNonNegativeNumber(input.value, 0);
        item.needsReview = false;
      } else {
        item[field] = input.value.trim();
      }
      commitAndRender();
    });

    td.appendChild(input);
    return td;
  }

  function renderSummary() {
    const selected = state.items.filter((item) => item.selected);
    const products = selected.filter((item) => !isShipping(item));
    const shipping = selected
      .filter(isShipping)
      .reduce((sum, item) => sum + item.qty * item.price, 0);
    const total = selected.reduce((sum, item) => sum + item.qty * item.price, 0);

    $('sumCount').textContent = products.length.toLocaleString('ko-KR') + '건';
    $('sumShipping').textContent = formatWon(shipping);
    $('sumTotal').textContent = formatWon(total);
  }

  function renderOutputs() {
    const selected = state.items.filter((item) => item.selected);
    const products = selected.filter((item) => !isShipping(item));
    const total = selected.reduce((sum, item) => sum + item.qty * item.price, 0);
    const purpose = (state.purpose || '').trim() || '○○○○';

    if (!products.length) {
      $('summaryText').textContent = '품목을 가져오면 자동으로 생성됩니다.';
      $('causeText').textContent = '품목을 가져오면 자동으로 생성됩니다.';
      return;
    }

    const firstName = products[0].name;
    const itemStr = products.length > 1 ? firstName + ' 외 ' + (products.length - 1) + '종' : firstName;
    const numAmount = '금' + total.toLocaleString('ko-KR') + '원';
    const korAmount = '금' + numToKorean(total) + '원';

    $('summaryText').textContent =
      purpose + '을 위한 물품구입(' + itemStr + ')\n\n' +
      purpose + '을 위한 물품을 구입하고자 합니다.\n' +
      ' 1. 품목: ' + itemStr + '\n' +
      ' 2. 금액: ' + numAmount + '(' + korAmount + ')';

    $('causeText').textContent =
      purpose + '을 위한 물품구입비 지급(' + itemStr + ')\n\n' +
      purpose + '을 위한 물품을 구입하고 대가를 지급하고자 합니다.\n' +
      ' 1. 품목: ' + itemStr + '\n' +
      ' 2. 금액: ' + numAmount + '(' + korAmount + ')';
  }

  function isShipping(item) {
    return item.unit === '식' || /배송비/.test(item.name);
  }

  function addBlankItem() {
    state.items.push({
      name: '직접입력 품목',
      spec: '',
      unit: '개',
      qty: 1,
      price: 0,
      selected: true,
      site: state.sourceSite,
      needsReview: true
    });
    commitAndRender();
    showToast('직접 입력 행을 추가했습니다.');
  }

  function clearAll() {
    if (!state.items.length) return;
    if (!confirm('현재 작업 중인 품목을 모두 지울까요?')) return;
    state.items = [];
    state.sourceSite = '';
    localStorage.removeItem(STORAGE_KEY);
    render();
    showToast('목록을 초기화했습니다.');
  }

  function commitAndRender() {
    saveDraft();
    render();
  }

  function selectedItemsOrWarn() {
    const selected = state.items.filter((item) => item.selected);
    if (!selected.length) {
      showToast('선택된 항목이 없습니다.', 'warn');
      return null;
    }
    if (selected.some((item) => item.needsReview)) {
      showToast('확인이 필요한 항목의 금액을 먼저 확인해 주세요.', 'warn');
    }
    return selected;
  }

  function exportProposalExcel() {
    const selected = selectedItemsOrWarn();
    if (!selected) return;
    if (!window.XLSX) {
      showToast('Excel 모듈을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.', 'error');
      return;
    }

    const data = selected.map((item) => ({
      '내용': item.name,
      '규격(옵션)': item.spec || '',
      '단위': item.unit || '개',
      '수량': item.qty,
      '예상단가': item.price
    }));

    downloadWorkbook(data, ['내용','규격(옵션)','단위','수량','예상단가'], '품목내역', '딸깍_품의서용_품목내역');
  }

  function exportCauseExcel() {
    const selected = selectedItemsOrWarn();
    if (!selected) return;
    if (!window.XLSX) {
      showToast('Excel 모듈을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.', 'error');
      return;
    }

    const data = selected.map((item) => ({
      '품명': item.name,
      '규격': item.spec || '',
      '수량': item.qty,
      '단위': item.unit || '개',
      '예상단가': item.price,
      '예상금액': item.qty * item.price,
      '용도': ''
    }));

    downloadWorkbook(data, ['품명','규격','수량','단위','예상단가','예상금액','용도'], '물품내역', '딸깍_원인행위용_물품내역');
  }

  function downloadWorkbook(data, headers, sheetName, filePrefix) {
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    ws['!cols'] = headers.map((header) => {
      if (header.includes('내용') || header.includes('품명')) return { wch: 42 };
      if (header.includes('규격') || header.includes('용도')) return { wch: 22 };
      return { wch: 12 };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filePrefix + '_' + dateStamp() + '.xlsx');
    showToast('Excel 파일을 만들었습니다.');
  }

  async function copyText(text, successMessage) {
    if (!text || text.includes('자동으로 생성됩니다')) {
      showToast('먼저 품목을 가져와 주세요.', 'warn');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      showToast(ok ? successMessage : '복사하지 못했습니다.', ok ? '' : 'error');
    }
  }

  function numToKorean(number) {
    const n = Math.max(0, Math.floor(Number(number) || 0));
    if (n === 0) return '영';

    const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    const small = ['', '십', '백', '천'];
    const big = ['', '만', '억', '조'];
    let value = n;
    let groupIndex = 0;
    let result = '';

    while (value > 0) {
      const group = value % 10000;
      if (group > 0) {
        let groupText = '';
        let g = group;
        let pos = 0;
        while (g > 0) {
          const d = g % 10;
          if (d > 0) groupText = digits[d] + small[pos] + groupText;
          g = Math.floor(g / 10);
          pos += 1;
        }
        result = groupText + big[groupIndex] + result;
      }
      value = Math.floor(value / 10000);
      groupIndex += 1;
    }
    return result;
  }

  function formatNumber(value) {
    return toNonNegativeNumber(value, 0).toLocaleString('ko-KR');
  }

  function formatWon(value) {
    return formatNumber(value) + '원';
  }

  function dateStamp() {
    const d = new Date();
    return d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0');
  }

  let toastTimer = null;
  function showToast(message, type = '') {
    const el = $('toast');
    el.textContent = message;
    el.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.className = 'toast';
    }, 2400);
  }
})();
