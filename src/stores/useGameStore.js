import { create } from 'zustand';

const useGameStore = create((set) => ({
  // === 狀態變數 (State) ===
  // 當前頁面: 'login' | 'lobby' | 'room'
  currentPage: 'login',
  
  // 玩家選擇的房間等級
  selectedRoom: null, 

  // 用戶資料 (暫存)
  user: null,

  // === 動作函式 (Actions) ===

  // 1. 🔥 設定當前頁面 (這是您剛剛報錯缺少的函式)
  setCurrentPage: (page) => set({ currentPage: page }),

  // 2. 登入：設定預設名稱與餘額，並跳轉到大廳
  login: (username) => set({ 
    user: { name: username, balance: 10000 },
    currentPage: 'lobby' 
  }),

  // 3. 進入房間：紀錄房號並跳轉
  enterRoom: (roomLevel) => set({ 
    currentPage: 'room', 
    selectedRoom: roomLevel 
  }),

  // 4. 退出房間：回到大廳，清空房號
  exitRoom: () => set({ 
    currentPage: 'lobby', 
    selectedRoom: null 
  }),

  // 5. 更新餘額：傳入正數加錢，負數扣錢 (比直接 setState 更安全)
  updateBalance: (amount) => set((state) => ({
    user: { 
      ...state.user, 
      balance: state.user.balance + amount 
    }
  })),

  // 6. 登出：清空使用者資料，回到登入頁
  logout: () => set({ 
    currentPage: 'login', 
    user: null,
    selectedRoom: null 
  }),
}));

export default useGameStore;