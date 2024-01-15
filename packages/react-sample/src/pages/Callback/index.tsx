import { useHandleSignInCallback } from '@slash-copilot/react';
import { useNavigate } from 'react-router-dom';

const Callback = () => {
  const navigate = useNavigate();
  const { isLoading } = useHandleSignInCallback(() => {
    navigate('/');
  });

  return isLoading ? <p>Redirecting...</p> : null;
};

export default Callback;
