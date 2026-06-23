import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#4f8cff',
          colorBgContainer: '#12192d',
          colorBgElevated: '#1a2340',
          borderRadius: 10,
          fontSize: 14,
        },
      }}
    >
      <App />
    </ConfigProvider>
  </StrictMode>,
)
