import { create } from 'zustand';

const useGameStore = create((set) => ({
  // 當前頁面: 'login' | 'lobby' | 'room'
  currentPage: 'login',
  
  // 玩家選擇的房間等級
  selectedRoom: null, 

  // 用戶資料 (暫存)
  user: null,

  // 動作
  login: (username) => set({ currentPage: 'lobby', user: { name: username, balance: 10000 } }),
  enterRoom: (roomLevel) => set({ currentPage: 'room', selectedRoom: roomLevel }),
  exitRoom: () => set({ currentPage: 'lobby', selectedRoom: null }),
  logout: () => set({ currentPage: 'login', user: null }),
}));

export default useGameStore;