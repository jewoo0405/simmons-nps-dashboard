// 데이터 분석 엔진 — 채널별/유형별 NPS 집계 + Issue 랭킹

const CHANNELS = ['매장', '일반배송', '블랙배송', '상담', 'AS'];
const STORE_TYPES = ['직영갤러리', '맨션', '위탁백화점', 'N32', '직영백화점'];
const ISSUE_CATEGORIES = ['정책/가격', '제품/감성', '매장경험/응대', '상담', 'AS', '배송'];

const IMPROVEMENT_ACTIONS = {
  '정책/가격': {
    owner: 'CCC부 / 구매팀 / 영업전략팀',
    actions: [
      'AS 유상수리 및 수리비 산정 기준 적정성 검토',
      '모델 변경 위약금, 교환 기준 고객 안내 문구 표준화',
      '채널별 가격, 프로모션, 사은품 관련 고객 VOC 정기 공유 및 개선 요청',
      '가격 대비 제품 차별 가치 설명 콘텐츠 및 매장 교육 강화'
    ]
  },
  '제품/감성': {
    owner: '품질경영팀 / 구매팀 / 상품기획팀',
    actions: [
      '출고 전 냄새 저감 프로세스 — 일정 기간 에이징 후 출하',
      '원자재 및 반제품 소취 프로세스 시행',
      '매트리스 감성 A/S 절감 프로젝트 테스트 및 개선'
    ]
  },
  '매장경험/응대': {
    owner: '영업전략팀 / 고객경험팀',
    actions: [
      '제품, 프로모션, 정책 지식 교육 및 오안내 점검',
      '오안내, 업무누락 VOC 매장별 월간 피드백',
      '구매 전후 응대 기준 및 사후관리 프로세스 표준화',
      '매장환경, 진열, 체험 관련 반복 VOC 개선관리'
    ]
  },
  '상담': {
    owner: '고객경험팀 / CCC부',
    actions: [
      '감성 응대 교육 및 주간 Call QA 피드백 진행',
      '고자세, 기계적, 매뉴얼식 응대 사례 집중 코칭',
      '고객 요청 사항 해결 여부를 기준으로 상담 품질 관리'
    ]
  },
  'AS': {
    owner: 'CCC부',
    actions: [
      'AS 일정 지연·변경 시 고객 사전 안내 및 일정 관리 강화',
      '정상 판정 시 판정 근거 및 조치 결과 설명 강화'
    ]
  },
  '배송': {
    owner: '고객경험팀 / 배송물류',
    actions: [
      '설치 매니저 방문 예정 시간대 준수율 관리',
      '지연 발생 시 고객 사전 안내 프로세스 강화',
      '설치 후 소독·유의사항·마무리 서비스 이행 여부 점검'
    ]
  }
};

function analyzeAll(records) {
  // 1. 채널별 통계
  const channelStats = {};
  for (const ch of CHANNELS) {
    const recs = records.filter(r => r.channel === ch);
    channelStats[ch] = { ...NPS.calcNPS(recs), praiseRate: NPS.calcPraiseRate(recs), records: recs };
  }

  // 전체 통계
  const overallStats = { ...NPS.calcNPS(records), praiseRate: NPS.calcPraiseRate(records) };

  // 2. 매장 유형별 통계
  const storeTypeStats = {};
  const storeRecs = records.filter(r => r.channel === '매장');
  for (const st of STORE_TYPES) {
    const recs = storeRecs.filter(r => r.storeType === st);
    if (recs.length > 0) {
      storeTypeStats[st] = { ...NPS.calcNPS(recs), records: recs };
    }
  }
  // 매장유형 미분류
  const unclassifiedStore = storeRecs.filter(r => !r.storeType || !STORE_TYPES.includes(r.storeType));
  if (unclassifiedStore.length > 0) {
    storeTypeStats['기타매장'] = { ...NPS.calcNPS(unclassifiedStore), records: unclassifiedStore };
  }

  // 3. 비추천 VOC 분석 (채널별)
  const detractorVOC = {};
  for (const ch of CHANNELS) {
    const dRecs = records.filter(r => r.channel === ch && NPS.isDetractor(r.score));
    const negVOC = dRecs.filter(r => r.isNegVOC && r.voc);
    const otherVOC = dRecs.filter(r => !r.isNegVOC);

    // 이슈 카테고리별 집계
    const issueCounts = {};
    for (const cat of Object.keys(NPS.VOC_KEYWORDS)) {
      issueCounts[cat] = negVOC.filter(r => r.issueCategory === cat).length;
    }
    issueCounts['기타'] = negVOC.filter(r => r.issueCategory === '기타').length;

    detractorVOC[ch] = {
      total: dRecs.length,
      negVOC: negVOC,
      negCount: negVOC.length,
      otherCount: otherVOC.length,
      issueCounts,
      records: dRecs
    };
  }

  // 4. 전사 이슈 TOP 랭킹
  const allNegVOC = records.filter(r => NPS.isDetractor(r.score) && r.isNegVOC && r.voc);
  const issueRanking = {};
  for (const cat of [...Object.keys(NPS.VOC_KEYWORDS), '기타']) {
    issueRanking[cat] = allNegVOC.filter(r => r.issueCategory === cat);
  }
  const sortedIssues = Object.entries(issueRanking)
    .map(([cat, recs]) => ({ category: cat, count: recs.length, records: recs, pct: allNegVOC.length ? Math.round((recs.length / allNegVOC.length) * 1000) / 10 : 0 }))
    .sort((a, b) => b.count - a.count)
    .filter(i => i.count > 0);

  const top3Count = sortedIssues.slice(0, 3).reduce((s, i) => s + i.count, 0);
  const top3Pct = allNegVOC.length ? Math.round((top3Count / allNegVOC.length) * 1000) / 10 : 0;

  // 5. 월별 트렌드
  const monthlyTrend = {};
  const months = [...new Set(records.map(r => r.month).filter(Boolean))].sort((a,b)=>a-b);
  for (const ch of CHANNELS) {
    monthlyTrend[ch] = months.map(m => {
      const recs = records.filter(r => r.channel === ch && r.month === m);
      return { month: m, ...NPS.calcNPS(recs) };
    });
  }
  monthlyTrend['전체'] = months.map(m => {
    const recs = records.filter(r => r.month === m);
    return { month: m, ...NPS.calcNPS(recs) };
  });

  return {
    overallStats,
    channelStats,
    storeTypeStats,
    detractorVOC,
    issueRanking: sortedIssues,
    allNegVOC,
    top3Count,
    top3Pct,
    monthlyTrend,
    months,
    totalRecords: records.length
  };
}

window.Analyzer = { analyzeAll, CHANNELS, STORE_TYPES, ISSUE_CATEGORIES, IMPROVEMENT_ACTIONS };
