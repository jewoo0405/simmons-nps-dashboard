// VOC 키워드 기반 이슈 자동 분류 (시몬스 PPT 기준)

const VOC_KEYWORDS = {
  '정책/가격': [
    '가격','비싸','비용','위약금','프로모션','사은품','할인','수리비','AS비용',
    '유상','가격정책','채널별','부담','가격대비','고가','인터넷보다','백화점이','무상','보증','교환기준'
  ],
  '제품/감성': [
    '냄새','소음','파손','꺼짐','허리','통증','느낌','감성','품질','두통','소재',
    '프레임','발통','퀄리티','사용감','새제품냄새','본드','패브릭','규격','높이','사이즈','디자인'
  ],
  '매장경험/응대': [
    '오안내','전문지식','누락','편차','진열','체험','재촉','과잉홍보','사과','태도','말투',
    '응대','안내','설명','직원','매장','협소','청결','분위기','위치','주차','사적대화',
    '결제오류','배송오류','거짓','속아서','불쾌','외모로','판단','판매전후'
  ],
  '상담': [
    '공감','고자세','매뉴얼','해결미흡','상담사','기계적','요청사항','응대불만',
    '전화','콜','상담응대','공감부족'
  ],
  'AS': [
    'AS일정','일정지연','정상판정','조치결과','수리기사','방문','AS방문','연락없이',
    'AS지연','수리','기사','주말AS불가','AS비용'
  ],
  '배송': [
    '약속시간','설치','마무리','소독','배송기사','배송지연','예정시간','유의사항',
    '배송서비스','설치후','안내부족','준수','지연'
  ]
};

// 텍스트에서 이슈 분류 (복수 분류 가능, 최다 매칭 기준 1개 선택)
function classifyVOC(text) {
  if (!text || text.trim() === '') return '기타';

  const scores = {};
  const lowerText = text.toLowerCase();

  for (const [category, keywords] of Object.entries(VOC_KEYWORDS)) {
    scores[category] = 0;
    for (const kw of keywords) {
      if (lowerText.includes(kw.toLowerCase())) {
        scores[category]++;
      }
    }
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return '기타';

  // 최고 점수 카테고리 반환 (동점 시 배열 순서 우선)
  for (const [cat, score] of Object.entries(scores)) {
    if (score === maxScore) return cat;
  }
  return '기타';
}

// 비추천(0-6) 여부 판별
function isDetractor(score) { return score >= 0 && score <= 6; }
function isPassive(score)   { return score === 7 || score === 8; }
function isPromoter(score)  { return score >= 9 && score <= 10; }

// NPS 계산
function calcNPS(responses) {
  if (!responses.length) return { nps: 0, promoters: 0, passives: 0, detractors: 0, total: 0 };
  const total = responses.length;
  const promoters  = responses.filter(r => isPromoter(r.score)).length;
  const passives   = responses.filter(r => isPassive(r.score)).length;
  const detractors = responses.filter(r => isDetractor(r.score)).length;
  const nps = Math.round(((promoters - detractors) / total) * 100 * 10) / 10;
  return {
    nps,
    promoters,
    passives,
    detractors,
    total,
    promoterRate: Math.round((promoters / total) * 1000) / 10,
    passiveRate:  Math.round((passives  / total) * 1000) / 10,
    detractorRate: Math.round((detractors / total) * 1000) / 10
  };
}

// 채널별 칭찬응답률 계산
function calcPraiseRate(responses) {
  const praised = responses.filter(r => r.praised === true || r.praised === 'Y' || r.praised === 'y' || r.praised === '예' || r.praised === '칭찬').length;
  return responses.length ? Math.round((praised / responses.length) * 1000) / 10 : 0;
}

// 실질 부정 VOC 판별 (비추천 중 부정 키워드가 있는 경우)
function isNegativeVOC(text) {
  if (!text || text.trim() === '') return false;
  const positiveWords = ['만족','좋아요','칭찬','친절','감사','잘해주','최고','훌륭','빠르','깔끔','완벽','최상'];
  const ambiguous = ['사용전','공란','모름','판단','유보','아직','없음','해당없음',''];
  const lower = text.toLowerCase();
  if (positiveWords.some(w => lower.includes(w))) return false;
  if (ambiguous.some(w => lower.includes(w))) return false;
  return true;
}

window.NPS = { classifyVOC, isDetractor, isPassive, isPromoter, calcNPS, calcPraiseRate, isNegativeVOC, VOC_KEYWORDS };
