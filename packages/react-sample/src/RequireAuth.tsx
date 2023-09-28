import { useLogto } from '@slash-copilot/react';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import { redirectUrl } from './consts';

const RequireAuth = () => {
  const { isAuthenticated, isLoading, signIn } = useLogto();

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      void signIn(redirectUrl);
    }
  }, [isAuthenticated, isLoading, signIn]);

  return isAuthenticated ? <Outlet /> : <p>Not authenticated</p>;
};

export default RequireAuth;
