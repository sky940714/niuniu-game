/* src/main.jsx */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'

// 引入全域樣式 (這行會讓背景變黑金)
import './styles/main.scss'

// 👇 新增這一行：引入 socket 設定檔，啟動連線！
import './socket';

ReactDOM.createRoot(document.getElementById('root')).render(
  // 開發遊戲時建議先註解掉 StrictMode，避免 Pixi 重複初始化
  // <React.StrictMode>
    <>
      <App />
      <InstallPrompt />
    </>
  // </React.StrictMode>,
)