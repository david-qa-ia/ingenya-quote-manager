import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { WorkspaceProvider } from './context/WorkspaceProvider';
import { PasswordResetView } from './components/PasswordResetView';
import { consumeRecoveryFromLocation } from './utils/passwordRecovery';

// SCRUM-126: a password recovery link opens the "new password" screen before anything else.
const recovery = consumeRecoveryFromLocation();
const reloadApp = () => window.location.replace(window.location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {recovery ? (
      <PasswordResetView recovery={recovery} onDone={reloadApp} />
    ) : (
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    )}
  </StrictMode>,
);
