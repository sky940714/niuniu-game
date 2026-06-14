import { create } from 'zustand';

const useGameStore = create((set, get) => ({
  // --- 狀態變數 ---
  currentPage: 'login',
  selectedRoom: null,
  user: null,
  isMaintenance: false,

  // --- 動作函式 ---
  setCurrentPage: (page) => set({ currentPage: page }),

  login: (username, balance) => set({ 
    user: { name: username, balance: balance || 10000 },
    currentPage: 'lobby' 
  }),

  reLogin: (userData) => {
    console.log("🔄 執行 reLogin 恢復狀態:", userData);
    set({
      user: { 
        name: userData.username, 
        balance: userData.balance,
        referral_code: userData.referral_code 
      },
      currentPage: 'lobby'
    });
  },

  logout: () => {
    console.log("🚫 執行登出");
    localStorage.removeItem('prestige_token');
    set({ currentPage: 'login', user: null, selectedRoom: null });
  },

  // --- 房間控制 (優化重點) ---
  enterRoom: (roomLevel) => {
    const { user } = get();
    // 🛡️ 安全檢查：如果進入房間時發現沒有 user 資料，強制阻斷
    if (!user) {
      console.error("❌ 進入房間失敗：找不到使用者資料");
      set({ currentPage: 'login' });
      return;
    }

    console.log(`🚪 進入房間: ${roomLevel} (玩家: ${user.name})`);
    set({ 
      currentPage: 'room', 
      selectedRoom: roomLevel 
    });
  },

  exitRoom: () => {
    set({ 
      currentPage: 'lobby', 
      selectedRoom: null 
    });
  },

  updateBalance: (amount) => set((state) => {
    if (!state.user) return state;
    return { user: { ...state.user, balance: state.user.balance + amount } };
  }),

  // 直接設定餘額（用於從 socket 同步最新值）
  setUserBalance: (balance) => set((state) => {
    if (!state.user) return state;
    return { user: { ...state.user, balance } };
  }),

  setMaintenanceMode: (enabled) => set({ isMaintenance: !!enabled }),
}));

export default useGameStore;