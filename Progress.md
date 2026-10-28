# Progress

- 2026-10-20：修正掃 QR Code／輸入房號後未真正加入房間（hook 自動送 JOIN、輸入的暱稱帶入、加入後自動顯示房間名單；聲納魚雷切 ROOM 模式）；誰是間諜改接同一套 QR 房間。四款遊戲雙 context 實測通過（hooks/useMultiplayerRoom.ts、app/page.tsx、components/*/…Game.tsx、components/views/HomeView.tsx）
- 2026-10-29：誰是間諜改為每人一支手機：房主手機執行規則引擎（發詞、輪流描述、投票含平票 PK、判勝負），其他手機用 PeerJS 點對點連房主、只拿到自己的詞；支援房主／玩家重新整理後自動回房、斷線重連、掃碼新手機先填暱稱；大廳暫時隱藏阿瓦隆、魚雷、七大奇蹟。三個分頁實際點對點連線測過完整一局（lib/spyEngine.ts、hooks/useSpyPeerRoom.ts、components/spy/online/、components/lobby/GameLobbyView.tsx、app/page.tsx）
