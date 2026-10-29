# Progress

- 2026-10-20：修正掃 QR Code／輸入房號後未真正加入房間（hook 自動送 JOIN、輸入的暱稱帶入、加入後自動顯示房間名單；聲納魚雷切 ROOM 模式）；誰是間諜改接同一套 QR 房間。四款遊戲雙 context 實測通過（hooks/useMultiplayerRoom.ts、app/page.tsx、components/*/…Game.tsx、components/views/HomeView.tsx）
- 2026-10-29：誰是間諜改為每人一支手機：房主手機執行規則引擎（發詞、輪流描述、投票含平票 PK、判勝負），其他手機用 PeerJS 點對點連房主、只拿到自己的詞；支援房主／玩家重新整理後自動回房、斷線重連、掃碼新手機先填暱稱；大廳暫時隱藏阿瓦隆、魚雷、七大奇蹟。三個分頁實際點對點連線測過完整一局（lib/spyEngine.ts、hooks/useSpyPeerRoom.ts、components/spy/online/、components/lobby/GameLobbyView.tsx、app/page.tsx）
- 2026-10-29：推送 main 並由 Vercel 自動部署到 https://party-games-two-phi.vercel.app，正式站建房（PeerJS）確認可用
- 2026-10-29：多手機連線層抽成通用（hooks/usePeerRoom.ts、types/peerRoom.ts、components/room/），誰是間諜改用它；新增阿瓦隆多手機版（lib/avalonEngine.ts、components/avalon/online/，含湖中仙女、MINION 爪牙）與狼人殺「手機當法官」版（lib/werewolfEngine.ts、components/werewolf/，預言家／女巫／獵人／守衛、夜間推理與最佳偵探）；大廳重新上架阿瓦隆、新增狼人殺，房號前綴 SPY／AVA／WLF 自動導向。引擎腳本模擬整局通過，瀏覽器多分頁實際點對點跑過阿瓦隆第一輪與狼人殺一夜一天
- 2026-10-29：新增原創融合遊戲「圓桌狼人」（阿瓦隆＋狼人殺，5–10 人）：白天組隊出任務、任務成功的夜晚狼人報復殺人、預言家逐夜查驗、守衛／獵人／隱狼可選、死者仍可表決、好人三勝後狼人可最後獵殺預言家；大廳上架、房號 RTW- 導向（lib/roundtableEngine.ts、types/roundtableRoom.ts、components/roundtable/）。引擎模擬 18 個情境通過，瀏覽器 5 分頁實際連線跑到第 2 輪
- 2026-10-29：阿瓦隆任務失敗按鈕改成跟圓桌狼人一樣不變灰，好人按了只跳提示（components/avalon/online/AvalonRoomGame.tsx）
- 2026-10-29：修正無法離開房間：改用自訂確認視窗（App 內建瀏覽器會擋 window.confirm），離開後回大廳並清掉網址房號（components/room/PeerRoomScreen.tsx、app/page.tsx）
