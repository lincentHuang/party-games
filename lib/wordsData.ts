import { WordPair } from '@/types/game';

/**
 * 《誰是間諜》精選繁體中文預設題庫 (100+ 組)
 * 難度劃分：
 * - easy: 休閒特訓（簡單）- 特徵鮮明、好切入
 * - medium: 標準行動（中等）- 概念相似、細節有差異
 * - hard: 絕密諜影（困難）- 概念高度重疊、燒腦博弈
 */

export const DEFAULT_WORD_PAIRS: WordPair[] = [
  // ========== 美食與飲品 ==========
  { civilian: "可口可樂", spy: "百事可樂", difficulty: "easy", category: "美食飲品" },
  { civilian: "漢堡", spy: "三明治", difficulty: "easy", category: "美食飲品" },
  { civilian: "珍珠奶茶", spy: "布丁奶茶", difficulty: "easy", category: "美食飲品" },
  { civilian: "香蕉", spy: "芭蕉", difficulty: "easy", category: "美食飲品" },
  { civilian: "西瓜", spy: "哈密瓜", difficulty: "easy", category: "美食飲品" },
  { civilian: "火鍋", spy: "麻辣燙", difficulty: "easy", category: "美食飲品" },
  { civilian: "牛肉麵", spy: "炸醬麵", difficulty: "easy", category: "美食飲品" },
  { civilian: "炸雞", spy: "鹹酥雞", difficulty: "medium", category: "美食飲品" },
  { civilian: "水餃", spy: "鍋貼", difficulty: "medium", category: "美食飲品" },
  { civilian: "豆漿", spy: "米漿", difficulty: "medium", category: "美食飲品" },
  { civilian: "章魚燒", spy: "大阪燒", difficulty: "medium", category: "美食飲品" },
  { civilian: "滷肉飯", spy: "雞肉飯", difficulty: "medium", category: "美食飲品" },
  { civilian: "抹茶", spy: "綠茶", difficulty: "medium", category: "美食飲品" },
  { civilian: "冬瓜茶", spy: "青草茶", difficulty: "medium", category: "美食飲品" },
  { civilian: "小籠包", spy: "湯包", difficulty: "hard", category: "美食飲品" },
  { civilian: "烏龍茶", spy: "鐵觀音", difficulty: "hard", category: "美食飲品" },
  { civilian: "冬粉", spy: "米粉", difficulty: "hard", category: "美食飲品" },
  { civilian: "蔥油餅", spy: "抓餅", difficulty: "hard", category: "美食飲品" },
  { civilian: "拿鐵", spy: "卡布奇諾", difficulty: "hard", category: "美食飲品" },
  { civilian: "餛飩", spy: "抄手", difficulty: "hard", category: "美食飲品" },

  // ========== 生活日常與用品 ==========
  { civilian: "牙刷", spy: "電動牙刷", difficulty: "easy", category: "生活用品" },
  { civilian: "雨傘", spy: "雨衣", difficulty: "easy", category: "生活用品" },
  { civilian: "衛生紙", spy: "濕紙巾", difficulty: "easy", category: "生活用品" },
  { civilian: "太陽眼鏡", spy: "近視眼鏡", difficulty: "easy", category: "生活用品" },
  { civilian: "拖鞋", spy: "涼鞋", difficulty: "easy", category: "生活用品" },
  { civilian: "毛巾", spy: "浴巾", difficulty: "easy", category: "生活用品" },
  { civilian: "手錶", spy: "手環", difficulty: "medium", category: "生活用品" },
  { civilian: "洗髮精", spy: "沐浴乳", difficulty: "medium", category: "生活用品" },
  { civilian: "口罩", spy: "面罩", difficulty: "medium", category: "生活用品" },
  { civilian: "鉛筆", spy: "原子筆", difficulty: "medium", category: "生活用品" },
  { civilian: "保溫瓶", spy: "馬克杯", difficulty: "medium", category: "生活用品" },
  { civilian: "剪刀", spy: "美工刀", difficulty: "medium", category: "生活用品" },
  { civilian: "枕頭", spy: "抱枕", difficulty: "hard", category: "生活用品" },
  { civilian: "眉毛", spy: "睫毛", difficulty: "hard", category: "生活用品" },
  { civilian: "乳液", spy: "面霜", difficulty: "hard", category: "生活用品" },
  { civilian: "被套", spy: "床單", difficulty: "hard", category: "生活用品" },
  { civilian: "窗簾", spy: "百葉窗", difficulty: "hard", category: "生活用品" },
  { civilian: "耳機", spy: "耳塞", difficulty: "hard", category: "生活用品" },

  // ========== 科技與社群 ==========
  { civilian: "iPhone", spy: "Android", difficulty: "easy", category: "科技數位" },
  { civilian: "筆記型電腦", spy: "平板電腦", difficulty: "easy", category: "科技數位" },
  { civilian: "YouTube", spy: "TikTok", difficulty: "easy", category: "科技數位" },
  { civilian: "鍵盤", spy: "滑鼠", difficulty: "easy", category: "科技數位" },
  { civilian: "Instagram", spy: "Facebook", difficulty: "medium", category: "科技數位" },
  { civilian: "LINE", spy: "Messenger", difficulty: "medium", category: "科技數位" },
  { civilian: "行動電源", spy: "充電器", difficulty: "medium", category: "科技數位" },
  { civilian: "Wi-Fi", spy: "行動網路", difficulty: "medium", category: "科技數位" },
  { civilian: "Google", spy: "ChatGPT", difficulty: "medium", category: "科技數位" },
  { civilian: "螢幕截圖", spy: "拍照錄影", difficulty: "hard", category: "科技數位" },
  { civilian: "藍牙", spy: "紅外線", difficulty: "hard", category: "科技數位" },
  { civilian: "限時動態", spy: "貼文動態", difficulty: "hard", category: "科技數位" },
  { civilian: "語音通話", spy: "視訊通話", difficulty: "hard", category: "科技數位" },

  // ========== 娛樂與影視動漫 ==========
  { civilian: "電影院", spy: "劇院", difficulty: "easy", category: "娛樂動漫" },
  { civilian: "哆啦A夢", spy: "野比大雄", difficulty: "easy", category: "娛樂動漫" },
  { civilian: "名偵探柯南", spy: "金田一", difficulty: "easy", category: "娛樂動漫" },
  { civilian: "鬼滅之刃", spy: "咒術迴戰", difficulty: "easy", category: "娛樂動漫" },
  { civilian: "狼人殺", spy: "誰是間諜", difficulty: "medium", category: "娛樂動漫" },
  { civilian: "航海王", spy: "火影忍者", difficulty: "medium", category: "娛樂動漫" },
  { civilian: "漫威", spy: "DC", difficulty: "medium", category: "娛樂動漫" },
  { civilian: "密室逃脫", spy: "劇本殺", difficulty: "medium", category: "娛樂動漫" },
  { civilian: "皮卡丘", spy: "伊布", difficulty: "medium", category: "娛樂動漫" },
  { civilian: "間諜家家酒", spy: "暗殺教室", difficulty: "hard", category: "娛樂動漫" },
  { civilian: "脫口秀", spy: "相聲", difficulty: "hard", category: "娛樂動漫" },
  { civilian: "綜藝節目", spy: "真人秀", difficulty: "hard", category: "娛樂動漫" },
  { civilian: "單機遊戲", spy: "手遊連線", difficulty: "hard", category: "娛樂動漫" },

  // ========== 地點與交通 ==========
  { civilian: "腳踏車", spy: "摩托車", difficulty: "easy", category: "地點交通" },
  { civilian: "捷運", spy: "公車", difficulty: "easy", category: "地點交通" },
  { civilian: "高鐵", spy: "火車", difficulty: "easy", category: "地點交通" },
  { civilian: "飛機", spy: "直升機", difficulty: "easy", category: "地點交通" },
  { civilian: "夜市", spy: "老街", difficulty: "medium", category: "地點交通" },
  { civilian: "便利商店", spy: "全聯超市", difficulty: "medium", category: "地點交通" },
  { civilian: "百貨公司", spy: "購物中心", difficulty: "medium", category: "地點交通" },
  { civilian: "圖書館", spy: "書店", difficulty: "medium", category: "地點交通" },
  { civilian: "計程車", spy: "Uber", difficulty: "hard", category: "地點交通" },
  { civilian: "動物園", spy: "水族館", difficulty: "hard", category: "地點交通" },
  { civilian: "飯店", spy: "民宿", difficulty: "hard", category: "地點交通" },
  { civilian: "加油站", spy: "充電樁", difficulty: "hard", category: "地點交通" },

  // ========== 人物與職業 ==========
  { civilian: "警察", spy: "保安保全", difficulty: "easy", category: "人物職業" },
  { civilian: "醫生", spy: "護士", difficulty: "easy", category: "人物職業" },
  { civilian: "老師", spy: "教授", difficulty: "easy", category: "人物職業" },
  { civilian: "廚師", spy: "甜點師", difficulty: "medium", category: "人物職業" },
  { civilian: "外送員", spy: "快遞員", difficulty: "medium", category: "人物職業" },
  { civilian: "魔術師", spy: "催眠師", difficulty: "medium", category: "人物職業" },
  { civilian: "特工", spy: "臥底", difficulty: "hard", category: "人物職業" },
  { civilian: "記者", spy: "狗仔", difficulty: "hard", category: "人物職業" },
  { civilian: "演員", spy: "替身", difficulty: "hard", category: "人物職業" },
  { civilian: "網紅", spy: "實況主", difficulty: "hard", category: "人物職業" },

  // ========== 抽象概念與節慶 ==========
  { civilian: "新年春節", spy: "中秋節", difficulty: "easy", category: "抽象節慶" },
  { civilian: "萬聖節", spy: "聖誕節", difficulty: "easy", category: "抽象節慶" },
  { civilian: "愚人節", spy: "兒童節", difficulty: "medium", category: "抽象節慶" },
  { civilian: "情人節", spy: "七夕", difficulty: "medium", category: "抽象節慶" },
  { civilian: "暗戀", spy: "單戀", difficulty: "medium", category: "抽象節慶" },
  { civilian: "自信", spy: "自戀", difficulty: "medium", category: "抽象節慶" },
  { civilian: "嫉妒", spy: "吃醋", difficulty: "hard", category: "抽象節慶" },
  { civilian: "生氣", spy: "傲嬌", difficulty: "hard", category: "抽象節慶" },
  { civilian: "同情", spy: "可憐", difficulty: "hard", category: "抽象節慶" },
  { civilian: "理想", spy: "夢想", difficulty: "hard", category: "抽象節慶" }
];
