// Excel 파싱 및 컬럼 자동 매핑

const COLUMN_ALIASES = {
  date:      ['날짜','일자','date','응답일','조사일','접수일'],
  channel:   ['채널','channel','구분','유형','분류'],
  storeType: ['매장유형','매장구분','store','스토어','점포유형','직영','갤러리','매장타입'],
  score:     ['점수','nps','nps점수','만족도점수','score','추천점수','NPS점수'],
  praised:   ['칭찬','칭찬여부','praise','칭찬응답','긍정'],
  voc:       ['voc','voc내용','고객의견','의견','내용','불만','코멘트','comment','고객코멘트','상세내용'],
  month:     ['월','month','기간']
};

const CHANNEL_ALIASES = {
  '매장':    ['매장','store','갤러리','직영','위탁','쇼룸'],
  '일반배송': ['일반배송','일반','배송','delivery','일반배달'],
  '블랙배송': ['블랙배송','블랙','black','블랙딜리버리','프리미엄배송'],
  '상담':    ['상담','cs','콜센터','상담센터','contact','전화','인바운드'],
  'AS':      ['as','a/s','애프터서비스','수리','after service','AS','서비스']
};

const STORE_TYPE_ALIASES = {
  '직영갤러리': ['직영갤러리','갤러리','직영','gallery'],
  '맨션':      ['맨션','mansion'],
  '위탁백화점': ['위탁백화점','위탁','백화점','department'],
  'N32':       ['n32','N32','엔32'],
  '직영백화점': ['직영백화점','직영dept']
};

function normalizeColumn(header, aliases) {
  const h = (header || '').toLowerCase().replace(/\s/g,'');
  for (const [key, vals] of Object.entries(aliases)) {
    if (vals.some(v => h.includes(v.toLowerCase().replace(/\s/g,'')))) return key;
  }
  return null;
}

function normalizeChannel(val) {
  if (!val) return null;
  const v = String(val).toLowerCase().replace(/\s/g,'');
  for (const [ch, aliases] of Object.entries(CHANNEL_ALIASES)) {
    if (aliases.some(a => v.includes(a.toLowerCase()))) return ch;
  }
  return String(val).trim();
}

function normalizeStoreType(val) {
  if (!val) return null;
  const v = String(val).toLowerCase().replace(/\s/g,'');
  for (const [st, aliases] of Object.entries(STORE_TYPE_ALIASES)) {
    if (aliases.some(a => v.includes(a.toLowerCase()))) return st;
  }
  return String(val).trim() || null;
}

// XLSX 워크북에서 첫 번째 시트 파싱
function parseExcel(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rows.length < 2) throw new Error('데이터가 부족합니다. 헤더 행과 데이터 행이 필요합니다.');

  const headers = rows[0].map(h => String(h));
  const colMap = {};

  headers.forEach((h, i) => {
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (!colMap[field] && normalizeColumn(h, { [field]: aliases })) {
        colMap[field] = i;
      }
    }
  });

  // score 컬럼 필수 체크
  if (colMap.score === undefined) {
    // 숫자 데이터가 많은 컬럼을 score로 추정
    const numCounts = headers.map((_, ci) => {
      return rows.slice(1).filter(r => !isNaN(parseFloat(r[ci])) && r[ci] !== '').length;
    });
    const maxIdx = numCounts.indexOf(Math.max(...numCounts));
    if (Math.max(...numCounts) > 0) colMap.score = maxIdx;
  }

  const records = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(c => c === '' || c === null || c === undefined)) continue;

    const scoreRaw = colMap.score !== undefined ? row[colMap.score] : null;
    const score = parseFloat(scoreRaw);
    if (isNaN(score) || score < 0 || score > 10) continue; // 유효하지 않은 점수 제외

    const rawChannel = colMap.channel !== undefined ? row[colMap.channel] : '';
    const rawDate    = colMap.date    !== undefined ? row[colMap.date]    : '';
    const rawVoc     = colMap.voc     !== undefined ? row[colMap.voc]     : '';
    const rawStore   = colMap.storeType !== undefined ? row[colMap.storeType] : '';
    const rawPraised = colMap.praised !== undefined ? row[colMap.praised] : '';
    const rawMonth   = colMap.month   !== undefined ? row[colMap.month]   : '';

    // 날짜에서 월 추출
    let month = null;
    if (rawMonth) {
      month = parseInt(rawMonth);
    } else if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d)) month = d.getMonth() + 1;
      else {
        const m = String(rawDate).match(/(\d{1,2})월/);
        if (m) month = parseInt(m[1]);
      }
    }

    const channel   = normalizeChannel(rawChannel) || '기타';
    const storeType = normalizeStoreType(rawStore);
    const voc       = String(rawVoc).trim();
    const praiseVal = String(rawPraised).trim();
    const praised   = ['y','예','칭찬','yes','true','1'].includes(praiseVal.toLowerCase());
    const issueCategory = NPS.classifyVOC(voc);
    const isNeg = NPS.isDetractor(score) ? NPS.isNegativeVOC(voc) : false;

    records.push({ date: String(rawDate), month, channel, storeType, score, praised, voc, issueCategory, isNegVOC: isNeg });
  }

  return { records, colMap, headers, totalRows: rows.length - 1 };
}

window.Parser = { parseExcel, normalizeChannel, normalizeStoreType, COLUMN_ALIASES, CHANNEL_ALIASES, STORE_TYPE_ALIASES };
