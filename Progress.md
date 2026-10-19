# Progress

- 2026-10-20：修正掃 QR Code／輸入房號後未真正加入房間（hook 自動送 JOIN、輸入的暱稱帶入、加入後自動顯示房間名單；聲納魚雷切 ROOM 模式）；誰是間諜改接同一套 QR 房間。四款遊戲雙 context 實測通過（hooks/useMultiplayerRoom.ts、app/page.tsx、components/*/…Game.tsx、components/views/HomeView.tsx）
