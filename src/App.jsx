import React from 'react';
import { BoardProvider } from './store/BoardContext';
import { Board } from './components/Canvas/Board';
import { MainMenu } from './components/UI/MainMenu';
import { PropertiesBar, ZoomControl } from './components/UI/PropertiesBar';
import './index.css';

function App() {
  return (
    <BoardProvider>
      <div className="app-shell">
        <Board />
        <MainMenu />
        <PropertiesBar />
        <ZoomControl />
      </div>
    </BoardProvider>
  );
}

export default App;
