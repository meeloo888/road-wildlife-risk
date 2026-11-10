// 로드킬 위험도 계산: Gemini가 읽은 항목 -> 코드가 규칙으로 점수 계산.
// 가중치는 팀이 정한 임의 설계값이며, 실제 충돌 확률이 아니다.
const BASE = { on_road: 70, road_edge: 50, near_road: 30, separated_by_structure: 10, no_road_visible: 5 };
const SIZE_BONUS = { large: 10, medium: 5, small: 0 };
const WILD_BONUS = 10;
const NON_PAVED_CAP = 15;

const POS_KO = { on_road: '도로 위', road_edge: '도로 가장자리', near_road: '도로 근처',
  separated_by_structure: '구조물로 분리됨', no_road_visible: '도로 안 보임' };

function scoreAnimal(a, roadType) {
  let s = BASE[a.position_vs_road] ?? 5;
  const notes = [`위치(${POS_KO[a.position_vs_road] || '미상'}) 기본 ${s}점`];
  if (roadType !== 'paved_public' && s > NON_PAVED_CAP) {
    s = NON_PAVED_CAP;
    notes.push(`공공 포장도로가 아니므로 ${NON_PAVED_CAP}점으로 제한`);
  }
  if (a.type === 'wild') { s += WILD_BONUS; notes.push(`야생동물 +${WILD_BONUS}`); }
  const sb = SIZE_BONUS[a.size_in_frame] ?? 0;
  if (sb) { s += sb; notes.push(`크기(${a.size_in_frame}) +${sb}`); }
  return { s, notes };
}

const ACTION = {
  high: '고위험: 운전자 경고(전광판/감속 안내) 즉시 작동 권고',
  medium: '중위험: 주의 안내 표시 및 모니터링 강화 권고',
  low: '저위험: 기록 및 모니터링 유지',
  none: '로드킬 보호 대상 야생동물 없음',
};

function riskScore(result) {
  const all = Array.isArray(result?.animals) ? result.animals : [];
  // 로드킬 방지 대상은 야생동물(및 종류 불명). 사람과 가축은 점수에서 제외.
  const targets = all.filter(a => a.type === 'wild' || a.type === 'unknown');
  const excluded = all.length - targets.length;
  if (targets.length === 0) {
    return { score: 0, level: 'none', action: ACTION.none, target_count: 0, excluded_count: excluded, reasons: [] };
  }
  const per = targets.map(a => scoreAnimal(a, result.road_type));
  const top = Math.max(...per.map(p => p.s));
  const topNotes = per.find(p => p.s === top).notes;
  const crowd = Math.min((targets.length - 1) * 5, 15);
  const reasons = [...topNotes];
  if (crowd) reasons.push(`여러 마리(${targets.length}마리) +${crowd}`);
  const score = Math.min(100, top + crowd);
  const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  return { score, level, action: ACTION[level], target_count: targets.length, excluded_count: excluded, reasons };
}

module.exports = { riskScore };
