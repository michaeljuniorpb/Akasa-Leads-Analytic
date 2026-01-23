
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Root element not found");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (err) {
  console.error("Mounting Error:", err);
  rootElement.innerHTML = `
    <div style="padding: 40px; text-align: center; font-family: sans-serif;">
      <h1 style="color: #ef4444;">Aplikasi Gagal Dimuat</h1>
      <p style="color: #64748b;">Silakan coba refresh halaman atau periksa koneksi internet Anda.</p>
    </div>
  `;
}
