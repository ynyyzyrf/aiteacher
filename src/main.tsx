import React from 'react';
import { createRoot } from 'react-dom/client';
import { Home } from './Home';
import { Classroom } from './Classroom';
import { useLearningRoom } from './useLearningRoom';
import './style.css';
function App() {
  const room = useLearningRoom();
  return room.view === 'classroom' && room.lesson ? <Classroom room={room}/> : <Home room={room}/>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
