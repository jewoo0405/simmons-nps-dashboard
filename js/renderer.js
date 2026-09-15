// 대시보드 렌더러 — 분석 결과를 DOM에 출력

let charts = {};

function npsClass(score) {
  if (score >= 70) return 'nps-high';
  if (score >= 40) return 'nps-mid';
  return 'nps-low';
}

function barColor(cat) {
  const map = {
    '정책/가격':     '#ef4444',
    '제품/감성':     '#f97316',
    '매장경험/응대': '#eab308',
    '상담':          '#7c3aed',
    'AS':            '#dc2626',
    '배송':          '#16a34a',
    '기타':          '#94a3b8'
  };
  return map[cat] || '#94a3b8';
}

// 차트 삭제 헬퍼
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

// 1. 요약 배너
function renderSummary(data) {
  const { overallStats } = data;
  document.getElementById('sum-total').textContent = overallStats.total.toLocaleString() + '건';
  document.getElementById('sum-nps').textContent = overallStats.nps > 0 ? '+' + overallStats.nps : overallStats.nps;
  document.getElementById('sum-detractor').textContent = overallStats.detractorRate + '%';
  document.getElementById('sum-neg-voc').textContent = data.allNegVOC.length + '건';
  document.getElementById('sum-top3').textContent = data.top3Pct + '%';

  // 기간 표시
  const months = data.months;
  if (months.length) {
    document.getElementById('period-label').textContent = `분석 기간: ${months[0]}월 ~ ${months[months.length-1]}월 (${months.length}개월)`;
  }
}

// 2. 채널별 카드
function renderChannelCards(channelStats) {
  const container = document.getElementById('channel-cards');
  container.innerHTML = '';
  const chColors = { '매장':'var(--ch-store)','일반배송':'var(--ch-delivery)','블랙배송':'var(--ch-black)','상담':'var(--ch-consult)','AS':'var(--ch-as)' };

  for (const ch of Analyzer.CHANNELS) {
    const s = channelStats[ch];
    if (!s) continue;
    const card = document.createElement('div');
    card.className = `channel-card ch-${ch}`;
    card.innerHTML = `
      <div class="ch-name">${ch}</div>
      <div class="nps-score ${npsClass(s.nps)}" style="font-size:28px;font-weight:900">${s.nps > 0 ? '+' : ''}${s.nps}</div>
      <div class="nps-label">NPS 점수</div>
      <div class="stats-row">
        <div class="stat-pill">
          <div class="val" style="color:var(--nps-promoter)">${s.promoterRate}%</div>
          <div class="lbl">추천자</div>
        </div>
        <div class="stat-pill">
          <div class="val" style="color:#374151">${s.passiveRate}%</div>
          <div class="lbl">중립</div>
        </div>
        <div class="stat-pill">
          <div class="val" style="color:var(--nps-detractor)">${s.detractorRate}%</div>
          <div class="lbl">비추천</div>
        </div>
      </div>
      <div style="margin-top:8px;font-size:11px;color:#6b7280">응답 ${s.total.toLocaleString()}건 · 칭찬 ${s.praiseRate}%</div>
    `;
    container.appendChild(card);
  }
}

// 3. 종합 테이블
function renderTable(channelStats, overallStats) {
  const tbody = document.getElementById('channel-tbody');
  tbody.innerHTML = '';

  for (const ch of Analyzer.CHANNELS) {
    const s = channelStats[ch];
    if (!s) continue;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:700;text-align:left">${ch}</td>
      <td>${s.total.toLocaleString()}</td>
      <td style="color:var(--nps-promoter);font-weight:700">${s.promoters.toLocaleString()}</td>
      <td style="color:var(--nps-promoter)">${s.promoterRate}%</td>
      <td style="color:var(--nps-detractor);font-weight:700">${s.detractors.toLocaleString()}</td>
      <td style="color:var(--nps-detractor)">${s.detractorRate}%</td>
      <td>${s.passives.toLocaleString()}</td>
      <td>${s.passiveRate}%</td>
      <td><span class="nps-badge ${npsClass(s.nps)}">${s.nps > 0 ? '+' : ''}${s.nps}점</span></td>
    `;
    tbody.appendChild(tr);
  }

  // 전체 합계 행
  const tot = document.getElementById('channel-total-row');
  tot.innerHTML = `
    <td style="text-align:left">누적 전체</td>
    <td>${overallStats.total.toLocaleString()}</td>
    <td>${overallStats.promoters.toLocaleString()}</td>
    <td>${overallStats.promoterRate}%</td>
    <td>${overallStats.detractors.toLocaleString()}</td>
    <td>${overallStats.detractorRate}%</td>
    <td>${overallStats.passives.toLocaleString()}</td>
    <td>${overallStats.passiveRate}%</td>
    <td>${overallStats.nps > 0 ? '+' : ''}${overallStats.nps}점</td>
  `;
}

// 4. 비추천 VOC 패널 (채널별)
function renderDetractorPanels(channelStats, detractorVOC) {
  const container = document.getElementById('detractor-panels');
  container.innerHTML = '';

  for (const ch of Analyzer.CHANNELS) {
    const cs = channelStats[ch];
    const dv = detractorVOC[ch];
    if (!cs) continue;

    const maxIssue = Object.values(dv.issueCounts).length ? Math.max(...Object.values(dv.issueCounts), 1) : 1;

    const issueHTML = Object.entries(dv.issueCounts)
      .filter(([,c]) => c > 0)
      .sort(([,a],[,b]) => b - a)
      .map(([cat, cnt]) => `
        <div class="issue-bar">
          <span class="name">${cat}</span>
          <div class="bar-wrap"><div class="bar-fill" style="width:${Math.round(cnt/maxIssue*100)}%;background:${barColor(cat)}"></div></div>
          <span class="cnt">${cnt}건</span>
        </div>
      `).join('');

    const samples = dv.negVOC.slice(0, 4).map(r => `
      <div class="voc-sample">
        <span class="cat-tag">${r.issueCategory}</span>${r.voc.length > 60 ? r.voc.slice(0,60)+'…' : r.voc}
      </div>
    `).join('');

    const panel = document.createElement('div');
    panel.className = 'voc-panel';
    panel.innerHTML = `
      <h3>${ch} 비추천 현황</h3>
      <div class="sub">응답 ${cs.total.toLocaleString()}건 · 비추천 ${cs.detractors}건(${cs.detractorRate}%)</div>
      <div class="counts">
        <div class="count-box recommend"><div class="num" style="color:#16a34a">${cs.promoters}</div><div class="lbl">추천 ${cs.promoterRate}%</div></div>
        <div class="count-box passive"><div class="num" style="color:#a16207">${cs.passives}</div><div class="lbl">중립 ${cs.passiveRate}%</div></div>
        <div class="count-box detract"><div class="num" style="color:#b91c1c">${cs.detractors}</div><div class="lbl">비추천 ${cs.detractorRate}%</div></div>
      </div>
      <div style="font-size:12px;font-weight:700;margin-bottom:8px;color:#374151">
        실질 부정 VOC <span style="color:#ef4444">${dv.negCount}건</span> / 그 외 ${dv.otherCount}건
      </div>
      <div class="issue-bar-list">${issueHTML || '<span style="color:#94a3b8;font-size:12px">분류된 VOC 없음</span>'}</div>
      ${samples ? `<div style="font-size:12px;font-weight:700;margin:10px 0 6px">주요 비추천 VOC</div><div class="voc-sample-list">${samples}</div>` : ''}
    `;
    container.appendChild(panel);
  }
}

// 5. 이슈 랭킹
function renderIssueRanking(issueRanking, allNegVOC) {
  const container = document.getElementById('issue-ranking');
  container.innerHTML = '';

  if (!issueRanking.length) {
    container.innerHTML = '<div style="color:#94a3b8;padding:20px">분류된 이슈가 없습니다.</div>';
    return;
  }

  issueRanking.slice(0, 6).forEach((issue, idx) => {
    const rank = idx + 1;
    const snippets = issue.records.slice(0, 3).map(r =>
      `<div class="snippet">· ${r.voc.length > 45 ? r.voc.slice(0,45)+'…' : r.voc}</div>`
    ).join('');

    const card = document.createElement('div');
    card.className = `issue-card rank-${rank}`;
    card.innerHTML = `
      <div class="issue-rank-num">${rank}</div>
      <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:4px">${rank}순위</div>
      <h4>${issue.category}</h4>
      <div><span class="count-big">${issue.count}건</span> <span class="pct">(${issue.pct}%)</span></div>
      <div class="voc-snippets">${snippets}</div>
    `;
    container.appendChild(card);
  });

  // 집중도 표시
  const top3 = issueRanking.slice(0, 3);
  const top3Count = top3.reduce((s, i) => s + i.count, 0);
  const top3Pct = allNegVOC.length ? Math.round(top3Count / allNegVOC.length * 1000) / 10 : 0;
  document.getElementById('top3-focus').textContent = `TOP 3 이슈가 실질 부정 VOC의 ${top3Pct}% 차지 (${top3Count}건 / 전체 ${allNegVOC.length}건)`;
}

// 6. 개선 Action 테이블
function renderActionTable(issueRanking) {
  const tbody = document.getElementById('action-tbody');
  tbody.innerHTML = '';
  const actions = Analyzer.IMPROVEMENT_ACTIONS;

  issueRanking.slice(0, 6).forEach((issue, idx) => {
    const rank = idx + 1;
    const info = actions[issue.category] || { owner: 'CCC부', actions: ['개선 방향 검토 필요'] };
    const actionItems = info.actions.map(a => `<li>${a}</li>`).join('');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="rank-cell" style="font-size:22px;font-weight:900;color:${rank<=3?'#ef4444':'#64748b'}">${rank}</td>
      <td><div class="issue-name">${issue.category}</div></td>
      <td class="count-cell">${issue.count}건</td>
      <td class="pct-cell">${issue.pct}%</td>
      <td><div class="owner-tag">${info.owner}</div></td>
      <td><ul class="action-list">${actionItems}</ul></td>
    `;
    tbody.appendChild(tr);
  });
}

// 7. 월별 트렌드 차트
function renderTrendChart(monthlyTrend, months) {
  destroyChart('trendChart');
  if (!months.length) return;

  const ctx = document.getElementById('trendChart').getContext('2d');
  const colors = {
    '매장': '#2563eb', '일반배송': '#16a34a', '블랙배송': '#1e293b',
    '상담': '#7c3aed', 'AS': '#dc2626', '전체': '#c9a84c'
  };

  const datasets = Analyzer.CHANNELS.map(ch => ({
    label: ch,
    data: (monthlyTrend[ch] || []).map(m => m.nps),
    borderColor: colors[ch],
    backgroundColor: colors[ch] + '20',
    borderWidth: 2,
    tension: 0.3,
    pointRadius: 4
  }));

  charts['trendChart'] = new Chart(ctx, {
    type: 'line',
    data: { labels: months.map(m => m + '월'), datasets },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { title: { display: true, text: 'NPS 점수' } }
      }
    }
  });
}

// 8. 이슈 비중 도넛 차트
function renderIssueDonut(issueRanking) {
  destroyChart('issueDonut');
  if (!issueRanking.length) return;

  const ctx = document.getElementById('issueDonut').getContext('2d');
  const top6 = issueRanking.slice(0, 6);

  charts['issueDonut'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: top6.map(i => i.category),
      datasets: [{
        data: top6.map(i => i.count),
        backgroundColor: top6.map(i => barColor(i.category)),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { position: 'right' },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed}건 (${ctx.dataset.data.reduce((a,b)=>a+b,0) > 0 ? Math.round(ctx.parsed/ctx.dataset.data.reduce((a,b)=>a+b,0)*1000)/10 : 0}%)` } }
      }
    }
  });
}

// 9. 채널별 NPS 비교 막대
function renderChannelBar(channelStats) {
  destroyChart('channelBar');
  const ctx = document.getElementById('channelBar').getContext('2d');
  const chs = Analyzer.CHANNELS.filter(c => channelStats[c]);

  charts['channelBar'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chs,
      datasets: [
        { label: '추천자 %', data: chs.map(c => channelStats[c].promoterRate), backgroundColor: '#22c55e80', borderColor: '#22c55e', borderWidth: 1 },
        { label: '비추천자 %', data: chs.map(c => channelStats[c].detractorRate), backgroundColor: '#ef444480', borderColor: '#ef4444', borderWidth: 1 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { position: 'top' } },
      scales: { y: { title: { display: true, text: '비율 (%)' }, max: 100 } }
    }
  });
}

// 전체 렌더링 진입점
function renderAll(data) {
  renderSummary(data);
  renderChannelCards(data.channelStats);
  renderTable(data.channelStats, data.overallStats);
  renderDetractorPanels(data.channelStats, data.detractorVOC);
  renderIssueRanking(data.issueRanking, data.allNegVOC);
  renderActionTable(data.issueRanking);
  renderTrendChart(data.monthlyTrend, data.months);
  renderIssueDonut(data.issueRanking);
  renderChannelBar(data.channelStats);

  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('uploadSection').style.display = 'none';
}

window.Renderer = { renderAll };
