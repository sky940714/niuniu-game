import React from 'react';
import LoginForm from '../components/GameUI/LoginForm'; 

const Login = () => {
  return (
    <div style={styles.pageWrapper}>
      <LoginForm />
    </div>
  );
};

const styles = {
  pageWrapper: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  }
};

export default Login;