/* src/main.jsx */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// 引入全域樣式 (這行會讓背景變黑金)
import './styles/main.scss' 

ReactDOM.createRoot(document.getElementById('root')).render(
  // 開發遊戲時建議先註解掉 StrictMode，避免 Pixi 重複初始化
  // <React.StrictMode>
    <App />
  // </React.StrictMode>,
)