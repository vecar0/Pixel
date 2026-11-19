# 등불지기 회색 상자 전투 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 그림 없이 색 상자만으로 리라의 공격·패링·회피·점프·히트스톱과 적 2종 + 간이 보스(무덤종)를 폰과 PC에서 플레이할 수 있게 만들어, 사용자가 "패링 손맛"을 확인할 수 있게 한다.

**Architecture:** 순수 시뮬레이션(`js/core/*`, DOM 없음, 60틱 고정)과 표현(`js/render.js`, `js/input.js`, `js/main.js`)을 분리. 시뮬레이션은 `tick(world, input)` 한 함수로 진행되고 Node에서 headless 테스트. 렌더는 world를 읽기만 한다.

**Tech Stack:** 순수 JS ES 모듈, Canvas 2D, WebAudio, Node 테스트(의존성 없음), Playwright(사전 설치됨) e2e.

**Spec:** `docs/superpowers/specs/2026-11-19-lantern-keeper-design.md` (6장 전투, 7장 조작, 11장 적·보스, 14장 성능, 15장 완료 기준)

## Global Constraints

- 고정 타임스텝 60틱/초. 모든 시간 값은 틱(f) 단위 정수.
- 내부 해상도 640×360, 가로 최대 780까지 확장, 정수 배율 nearest 확대.
- 빌드 도구·npm 의존성 없음. 테스트는 `node tests/sim.test.mjs`, `node tests/e2e.mjs`.
- 시뮬레이션 코드(`js/core/`)는 `window`/`document`/`performance` 사용 금지.
- 수치는 전부 `js/core/config.js` 한 곳에. 다른 파일에 매직 넘버 금지.
- 기존 NEON PAW 파일(`js/art.js data.js level.js sim.js render.js main.js input.js audio.js`)은 이 계획에서 삭제·교체. 저장 키 `lantern-keeper-v1`.
- UI 문구 한국어. 폰트 Galmuri(기존 `fonts/`).
- 카파시 원칙: 가장 단순한 구현, 작은 단위로 검증하며 진행, 추측성 일반화 금지.

## Review Focus

1. 스틱을 누른 채 패링 버튼 탭 (멀티터치) → 이동과 패링이 동시에 된다. (Task 6 e2e)
2. 한 프레임 안에 눌렀다 뗀 아주 짧은 탭 → 입력이 사라지지 않는다. (Task 6 e2e, Task 2 버퍼 테스트)
3. 탭 전환·백그라운드 후 복귀(거대한 dt) → 틱 폭주 없이 최대 5틱만 따라잡고 일시정지. (Task 5 테스트)
4. 히트스톱 중 누른 패링 → 버퍼에 남아 히트스톱 직후 실행. (Task 3 테스트)
5. 패링 중 등 뒤에서 맞는 공격 → 피격된다. (Task 3 테스트)

---

### Task 1: 설정값 + 테스트 하네스 + 옛 코드 정리

**Files:**
- Delete: `js/art.js js/data.js js/level.js js/sim.js js/render.js js/main.js js/input.js js/audio.js tests/sim.test.mjs tests/e2e.mjs tools/icon.html tools/sheet.html`
- Create: `js/core/config.js`, `tests/sim.test.mjs`, `tests/lib.mjs`
- Modify: `package.json` (name `lantern-keeper`, scripts `test`, `e2e`)

**Interfaces:**
- Produces: `export const CFG` (아래 값), `tests/lib.mjs`의 `test(name, fn)`, `eq(a,b,msg)`, `ok(cond,msg)`, `run()` (실패 시 exit 1)

- [ ] **Step 1:** `CFG`를 스펙 값으로 작성. 필수 키:
  - `TICK=60, VIEW_W=640, VIEW_H=360, VIEW_W_MAX=780, GRAV=0.32(px/f²)`
  - `player: { speed: 2.5 (=150px/s), accelF:4, decelF:3, jumpMaxH:72, coyoteF:6, bufferF:8, hp:5, iframesHurt:60, w:14, h:40 }`
  - `attack: { dmg:[10,10,18], startupF:4, activeF:3, recoveryF:10, range:28 }`
  - `parry: { perfectF:6, normalF:12, whiffF:18, successRecoverF:4, reach:40, hitstopPerfect:8, hitstopNormal:3, lightPerfect:25, lightNormal:10 }`
  - `roll: { totalF:22, dist:96, iStart:2, iEnd:13, endLagF:6 }`
  - `poise: { perfect:0.25, normal:0.08, hit:0.02, stunF:180, regenDelayF:120, executeFrac:0.15 }`
  - `light: { max:100, perfect:25, normal:10, kill:3 }`, `ult: { dmg:60 }`
  - `enemy: { minTelegraphF:18, bossMinTelegraphF:14, multiHitGapF:16, maxAttackers:2 }`
  - `flask: { charges:3, useF:40, heal:2 }`
- [ ] **Step 2:** `tests/lib.mjs` 작성 + `tests/sim.test.mjs`에 `CFG.parry.perfectF===6`, `CFG.roll.iEnd-CFG.roll.iStart+1===12` 테스트.
- [ ] **Step 3:** `node tests/sim.test.mjs` → PASS 2건.
- [ ] **Step 4:** 커밋 `greybox: 설정값과 테스트 하네스, NEON PAW 코드 제거`.

### Task 2: 리라 이동·점프·공격·회피 (플레이어 상태기계)

**Files:**
- Create: `js/core/world.js` (월드 생성·tick 골격·지형 충돌), `js/core/player.js`
- Test: `tests/sim.test.mjs`

**Interfaces:**
- Produces:
  - `createWorld({ room:'arena'|'boss', seed?:number }) → World` — `World = { t, hitstop, player, enemies:[], projectiles:[], fx:[], events:[], solids:[{x,y,w,h}], camX, over:false }`
  - `tick(world, input)` — `input = { left, right, down, jumpHeld, jump, attack, parry, roll, ult, flask }` (마지막 다섯은 이번 틱에 *눌림* 이벤트, bool)
  - `EMPTY_INPUT` 상수
  - `player = { x, y, vx, vy, face:1|-1, onGround, hp, light, flasks, state, stateT, combo, iframes, buffer:{action, t} }`, `state ∈ 'idle'|'run'|'jump'|'attack'|'parry'|'roll'|'hurt'|'flask'|'ult'|'dead'`
  - `events`에 `{type:'attackHit'|'parry'|'hurt'|'kill'|'whiff', ...}` push (렌더·사운드용, 매 틱 초기화)
- [ ] **Step 1: 실패 테스트 작성**
  - `move: 오른쪽 60틱 → x 증가 ≥ 140px`
  - `jump: 점프 누르고 계속 홀드 → 최고 높이 66~72px`, `짧게 탭 → 최고 높이 < 40px`
  - `coyote: 발판 끝에서 떨어진 뒤 5틱째 점프 입력 → 점프됨`, `8틱째 → 안 됨`
  - `attack: 공격 3번 연속 → combo 0,1,2 순서, 각 타 판정이 startup 4틱 뒤 3틱 동안 존재`
  - `cancel: 공격 후딜(recovery) 중 roll 입력 → 같은 틱에 state==='roll'`
  - `roll: 22틱에 x 이동 90~100px, stateT 2~13틱만 invulnerable(player)===true`
  - `buffer: 공격 startup 중 parry 눌림 → 8틱 안에 행동 가능해지면 parry 실행; 9틱 이상 지나면 버려짐`
- [ ] **Step 2:** `node tests/sim.test.mjs` → 위 테스트 FAIL.
- [ ] **Step 3:** `player.js`에 `updatePlayer(world, input)`, `invulnerable(p) → bool`, `attackBox(p) → {x,y,w,h}|null` 구현. 지형은 AABB 축 분리 충돌(바닥 + 발판 2개). 가변 점프는 버튼을 떼면 `vy`를 절반으로.
- [ ] **Step 4:** 테스트 PASS.
- [ ] **Step 5:** 커밋 `greybox: 리라 이동·점프·공격·회피·입력 버퍼`.

### Task 3: 패링·피격·히트스톱·자세 게이지·빛 게이지

**Files:**
- Create: `js/core/combat.js`
- Modify: `js/core/world.js` (히트스톱 동안 시뮬레이션 정지, 입력 버퍼는 유지)
- Test: `tests/sim.test.mjs`

**Interfaces:**
- Consumes: Task 2 `player`, `attackBox`, `invulnerable`
- Produces:
  - 적 공격 히트박스 표현 `hitbox = { owner, x,y,w,h, dmg, parryable:bool, id }` — 적이 `world.hitboxes`에 매 틱 넣음 (같은 `id`는 한 번만 판정)
  - `resolveEnemyHit(world, hitbox) → 'perfect'|'normal'|'hit'|'ignored'`
  - `damageEnemy(world, enemy, dmg, poiseFrac)` — 체력·자세 감소, 0이면 kill 이벤트 + 빛 +3
  - 적 공통 필드: `{ hp, maxHp, poise (0..1), poiseMax?:bool, stunT, x,y,w,h, face }`
- [ ] **Step 1: 실패 테스트** (테스트용 더미 적: 고정 위치에서 지정 틱에 히트박스를 내는 `makeDummy({ hitAtT, parryable, fromBehind })`)
  - `perfect: 히트 1틱 전 패링 → 결과 perfect, hp 그대로, light +25, world.hitstop===8`
  - `perfect 경계: 판정 6틱째 맞음 → perfect, 7틱째 → normal(light +10, hitstop 3), 13틱째 → hit(hp -1)`
  - `whiff: 아무것도 안 막은 패링 → 18틱 동안 parry 재입력 무시`
  - `success recover: 성공 후 4틱 뒤 parry 재입력 → 새 패링 시작`
  - `multi: 한 패링 창 안에 히트박스 2개 → 둘 다 막힘`
  - `unparryable: parryable:false를 패링 → hp -1`
  - `behind: 등 뒤 히트박스를 패링 → hp -1`  *(Review Focus 5)*
  - `hitstop buffer: 히트스톱 중 parry 눌림 → 히트스톱 끝난 첫 틱에 실행`  *(Review Focus 4)*
  - `iframes: 피격 후 60틱 동안 추가 피해 없음`
  - `poise: 완벽 패링 4번 → 엘리트 더미 stunT===180, 그로기 중 공격 → maxHp*0.15 피해`
  - `ult: light 100에서 ult → 범위 내 적 60 피해, light 0, 시전 중 피해 없음`
  - `flask: flask → 40틱 뒤 hp +2(최대 5), flasks -1, 0개면 무시`
- [ ] **Step 2:** FAIL 확인.
- [ ] **Step 3:** 구현. 패링 판정은 "히트박스가 리라와 겹친 틱에 리라 state==='parry'이고 parry stateT ≤ 12 이고 히트박스가 리라 정면(`sign(hb.cx - p.x) === p.face`)"일 때. 완벽/일반은 stateT로 구분. 완벽 패링한 투사체는 `vx *= -1.5`, `owner='player'`로 반사.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** 커밋 `greybox: 패링·히트스톱·자세·빛·필살·기름병`.

### Task 4: 적 2종 + 간이 보스 무덤종 + 공격 토큰

**Files:**
- Create: `js/core/enemies.js`, `js/core/boss.js`
- Modify: `js/core/world.js` (`room:'arena'`: 이끼 망자 3 + 등불 나방 2, 웨이브 2개 / `room:'boss'`: 무덤종)
- Test: `tests/sim.test.mjs`

**Interfaces:**
- Consumes: Task 3 히트박스 규격, `damageEnemy`
- Produces:
  - `ENEMY_DEFS = { ghoul:{hp:30,...attacks}, moth:{hp:12,...}, bellBoss:{hp:600, poise:true,...} }` — 각 공격 `{ name, telegraphF, activeF, recoverF, dmg, parryable, hits?:number }`
  - `spawnEnemy(world, kind, x, y) → enemy`, `updateEnemies(world)`
  - 공격 토큰: `world.attackTokens` 최대 `CFG.enemy.maxAttackers` 개, 보스는 토큰 무관
- 무덤종 간이 패턴 (페이즈 1만, 2페이즈는 체력 50%에서 텔레그래프 −4f만 적용):
  - 종 휘두르기: telegraph 24f, parryable, dmg 1
  - 2연 휘두르기: telegraph 20f, 타 간격 16f, parryable
  - 내려찍기 충격파: telegraph 30f, 바닥을 따라 퍼지는 투사체, **parryable:false** (점프·회피로 회피), dmg 2
- [ ] **Step 1: 실패 테스트**
  - `data: 모든 일반 적 공격 telegraphF ≥ 18, 보스 ≥ 14 (2페이즈 적용 후 포함)`
  - `token: 이끼 망자 3마리가 리라 옆에 붙어도 동시에 telegraph 중인 수 ≤ 2`
  - `offscreen: 카메라 밖(가로 640 밖) 적은 공격을 시작하지 않음`
  - `ghoul: 리라 근처에서 텔레그래프 → 정해진 틱에 히트박스 생성`
  - `moth: 공중 대기 → 텔레그래프 18f → 리라 방향 직선 돌진`
  - `boss gap: 2연 휘두르기 두 타 사이 ≥ 16틱`
  - `shockwave: 충격파를 패링 → hp -2, 점프로 넘으면 피해 없음`
  - `bot: 완벽 패링만 하는 봇(히트박스 도착 2틱 전 parry)으로 arena 클리어 시 hp 5 유지` (패링 타이밍 일관성 검증)
- [ ] **Step 2:** FAIL 확인.
- [ ] **Step 3:** 구현. 적 AI는 상태 `approach → telegraph → active → recover → cooldown` 하나의 공용 루프 + 종별 이동 함수.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** 커밋 `greybox: 이끼 망자·등불 나방·무덤종 + 공격 토큰`.

### Task 5: 화면 — 고정 스텝 루프, 회색 상자 렌더, HUD, 사운드

**Files:**
- Create: `js/main.js`, `js/render.js`, `js/sfx.js`, `js/loop.js`
- Modify: `index.html` (title `등불지기`), `css/style.css`, `manifest.webmanifest` (name `등불지기`)
- Test: `tests/sim.test.mjs` (loop만)

**Interfaces:**
- Consumes: `createWorld`, `tick`, `EMPTY_INPUT`, world 필드 전체
- Produces: `stepLoop(acc, dtMs, stepFn) → newAcc` (loop.js, 순수 함수: 누적 시간에서 16.67ms마다 stepFn 호출, **한 번에 최대 5틱**, 초과분 버림), `window.__lk = { world, mode, setRoom(name) }` (e2e용)
- 렌더 규칙 (회색 상자):
  - 리라: 흰 상자, 상태별 색 테두리 (공격 노랑, 패링 주황, 회피 하늘색, 무적이면 반투명)
  - 적: 회색 상자, **텔레그래프 중 흰색 깜빡**, parryable:false 공격은 **붉은 테두리 + 붉은 깜빡**
  - 히트박스 디버그 표시 토글 (`?debug=1`)
  - 완벽 패링: 주황 원형 섬광 + 화면 흔들림 4px/8f, 일반 패링: 작은 섬광
  - HUD: 하트 5, 빛 게이지 바, 기름병 수, 보스 체력+자세 바, 하단 "완벽 패링 N" 카운터
- 사운드 (`sfx.js`, WebAudio 합성): `play('parryPerfect'|'parryNormal'|'hit'|'hurt'|'swing'|'roll'|'kill')` — 완벽 패링은 높은 금속음 + 짧은 저음 펀치
- [ ] **Step 1: 실패 테스트** `loop: dt 1000ms 한 번 → stepFn 5회만`, `loop: dt 33.4ms → 2회` *(Review Focus 3)*
- [ ] **Step 2:** FAIL → `loop.js` 구현 → PASS.
- [ ] **Step 3:** `main.js`·`render.js`·`sfx.js` 구현. 화면 흐름: 타이틀(탭/Enter) → 아레나 → 클리어 시 "보스로" 버튼 → 보스 → 승리/패배 오버레이 + "다시"(즉시 재시작, 5초 이내). `visibilitychange` hidden이면 일시정지.
- [ ] **Step 4:** `node tools/shot.mjs . index.html /tmp/.../shot.png 1280 720` → errors `[]`, 스크린샷에 상자·HUD 보임(직접 확인).
- [ ] **Step 5:** 커밋 `greybox: 고정 스텝 루프·회색 상자 렌더·HUD·효과음`.

### Task 6: 입력 (터치 + 키보드) + e2e

**Files:**
- Create: `js/input.js`, `tests/e2e.mjs`
- Modify: `index.html` (터치 버튼: 공격·패링·회피·점프·필살·기름병 + 일시정지), `css/style.css` (7장 배치, 판정 영역은 보이는 원보다 30% 큼)

**Interfaces:**
- Produces: `class Input { constructor(canvasEl, touchRootEl); read() → input }` — `read()`는 Task 2의 input 형태를 반환하고 눌림 이벤트를 비움. 터치는 `pointerdown`에서 즉시 기록, 같은 프레임에 눌렀다 떼도 눌림 이벤트 유지.
- 키: A/D·←/→ 이동, W/Space 점프, J 공격, K 패링, L/Shift 회피, I 필살, Q 기름병, Esc 일시정지.
- [ ] **Step 1: e2e 작성** (Playwright, 기존 e2e의 로컬 서버 방식 재사용)
  - `PC: 타이틀 → Enter → mode==='play'`
  - `PC: D 홀드 900ms → player.x 증가`
  - `PC: K → 다음 프레임 player.state==='parry'`
  - `모바일(iPhone 13 가로, hasTouch): 스틱 영역 터치 홀드 + 패링 버튼 탭 동시에 → x 증가 && state==='parry' 관찰됨` *(Review Focus 1)*
  - `모바일: 패링 버튼 pointerdown→pointerup 사이 0ms → 다음 틱 parry 실행` *(Review Focus 2)*
  - `모바일 세로 뷰포트 → '가로로 돌려주세요' 보임`
  - `보스 방(__lk.setRoom('boss')) 3초 진행 → 콘솔 에러 0건, 스크린샷 저장`
- [ ] **Step 2:** `node tests/e2e.mjs` → FAIL (input 없음).
- [ ] **Step 3:** `input.js`, 터치 UI 구현.
- [ ] **Step 4:** `node tests/e2e.mjs` → 전부 PASS, `node tests/sim.test.mjs` → 전부 PASS.
- [ ] **Step 5:** 성능 확인: 보스방 + 적 8 + 파티클 300 장면에서 `tick`+렌더 평균 ms를 e2e에서 측정해 로그 (목표 ≤ 8ms, 초과 시 보고).
- [ ] **Step 6:** 커밋 `greybox: 터치·키보드 입력과 e2e` → 푸시.

---

## 이 계획에서 하지 않는 것 (다음 계획)

타이밍 보정 설정·측정 도우미, 런 구조(방 선택·각인·휴식·상점), 메타 진행, 지역 2~4, 그림(Higgsfield·forge·pixelfx), BGM. 회색 상자 손맛 승인 후 다음 계획으로.
