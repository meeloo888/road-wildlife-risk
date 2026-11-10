# 야생동물 로드킬 위험도 PoC

열화상 사진을 올리면 Gemini가 항목(야생동물 여부, 도로와의 위치, 크기 등)을 읽고,
코드가 규칙으로 로드킬 위험도(0~100)를 계산하는 학습 없는 개념 검증(PoC)입니다.

## 구조
- `index.html` 화면(사진 분석 / 시뮬레이션 / 검증 결과 / 한계와 출처)
- `api/analyze.js` Vercel 서버 함수(Gemini 호출, API 키는 서버에서만 사용)
- `lib/score.js` 위험도 계산 규칙(가중치는 임의 설계값)

## 배포(Vercel)
환경 변수: `GEMINI_API_KEY`(필수), `GEMINI_MODEL`(선택, 기본 gemini-3.8-flash). 키는 절대 커밋하지 않습니다.

## 한계
도로 위 야생동물 열화상 사진을 확보하지 못했습니다. 점수는 충돌 확률이 아닌 규칙 기반 지표입니다.

## 출처
WSDOT Thermal Dataset (olddataset3), Roboflow Universe, CC BY 4.0
https://universe.roboflow.com/wsdot-thermal-dataset-oyzwe/olddataset3
