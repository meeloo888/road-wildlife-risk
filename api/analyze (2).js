const { riskScore } = require('../lib/score');

const PROMPT = `이 이미지는 도로 인접 구역을 찍은 열화상 사진이다(밝은 부분이 따뜻한 물체).
야생동물 로드킬 위험 평가를 위해 보이는 것만 근거로 JSON으로만 답하라. 추측하지 마라.
필드:
- is_thermal: 열화상이면 true
- road_type: paved_public(차선이나 연석이 있는 포장도로) |
  unpaved_or_private(비포장, 진입로, 잔디길) | none | unclear
- person_count: 사람 수(정수)
- animals: 보이는 모든 동물 목록(없으면 빈 배열)
  [{type: wild(사슴 등 야생동물)|domestic(개, 고양이 등)|unknown,
  size_in_frame: small|medium|large,
  position_vs_road: on_road|road_edge|near_road|separated_by_structure|no_road_visible,
  confidence: 0~1}]
- scene_summary: 장면 한 줄 설명
- uncertainty: 확신이 낮은 부분(없으면 빈 문자열)`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  // 시뮬레이션 모드: Gemini 호출 없이 입력된 항목으로 점수만 계산
  if (body.simulate) {
    return res.status(200).json({ result: body.simulate, risk: riskScore(body.simulate), simulated: true });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: '서버 설정(분석 키)이 되어 있지 않습니다.' });
  const primary = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  // 요청이 몰리면(503/429) 같은 모델로 재시도한 뒤 대체 모델로 넘어간다.
  const models = [primary, ...['gemini-3.6-flash', 'gemini-3.5-flash-lite'].filter(m => m !== primary)];
  const { image, mimeType } = body;
  if (!image || !mimeType) return res.status(400).json({ error: '이미지가 없습니다.' });

  const payload = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: image } }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let last = null;

  try {
    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: payload }
        );
        const data = await r.json();
        if (r.ok) {
          const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
          let result;
          try { result = JSON.parse(text); }
          catch { return res.status(502).json({ error: '분석 결과를 읽지 못했습니다.', raw: text }); }
          return res.status(200).json({ result, risk: riskScore(result), model });
        }
        last = { status: r.status, model, message: data?.error?.message || data };
        if (r.status === 503 || r.status === 429) { await sleep(1200); continue; } // 같은 모델 재시도
        break; // 그 밖의 오류는 다음 모델로
      }
    }
    return res.status(502).json({ error: '분석 오류', detail: last });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류', detail: String(e) });
  }
};
