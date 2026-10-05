import '@fontsource-variable/inter/opsz.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './index.css';
import { Capacitor } from '@capacitor/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ConfigErrorScreen } from './components/common/ConfigErrorScreen';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

// Native shells serve the app from the device, so the API origin must be baked in at build time.
const missingApiUrl = Capacitor.isNativePlatform() && !import.meta.env.VITE_API_URL;

createRoot(container).render(<StrictMode>{missingApiUrl ? <ConfigErrorScreen /> : <App />}</StrictMode>);
