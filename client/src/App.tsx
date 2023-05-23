import React, { FC } from 'react';
import Login from './components/login';
import WalletProvider from './providers/wallet';

require('./App.css');

const App: FC = () => {
  return (
    <WalletProvider>
      <Login />
    </WalletProvider>
  );
};

export default App;