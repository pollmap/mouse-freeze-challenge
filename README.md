# FREEZE! Mouse Freeze Challenge

마우스 제어 감각을 테스트하는 브라우저 미니게임입니다. 목표 시간에 맞춰 포인터를 멈추는 `Target Freeze`와 신호에 맞춰 움직임을 제어하는 `Red Light` 모드를 제공합니다.

## Stack

- Vite
- TypeScript
- Tailwind CSS
- Lucide icons

## Scripts

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run preview
```

## Gameplay

- `Target Freeze`: 랜덤 목표 시간이 정해지며, 타이머가 가려지는 마지막 구간에서 감각으로 멈춥니다.
- `Red Light`: 초록 신호에서는 움직여 점수를 채우고, 빨간 신호에서는 정지합니다.
- 기록은 브라우저 `localStorage`에 최근 5개만 저장됩니다.
