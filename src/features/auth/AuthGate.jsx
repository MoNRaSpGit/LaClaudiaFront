import AppBootScreen from './components/AppBootScreen';
import LoginCard from './components/LoginCard';
import { useAuthGateController } from './model/useAuthGateController';

function AuthGate({ children }) {
  const { state, actions } = useAuthGateController();

  if (state.phase === 'booting') {
    return <AppBootScreen message={state.bootMessage} />;
  }

  if (state.phase === 'login' || state.phase === 'authenticating') {
    return (
        <LoginCard
        username={state.username}
        password={state.password}
        rememberCredentials={state.rememberCredentials}
        error={state.error}
        backendReady={state.backendReady}
        isAuthenticating={state.phase === 'authenticating'}
        onUsernameChange={actions.setUsername}
        onPasswordChange={actions.setPassword}
          onRememberCredentialsChange={actions.setRememberCredentials}
          onSubmit={actions.submitLogin}
          onQuickOperarioLogin={actions.quickLoginOperario}
        />
      );
  }

  return children({
    user: state.user,
    onLogout: actions.logout
  });
}

export default AuthGate;
