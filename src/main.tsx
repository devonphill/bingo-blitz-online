import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router } from 'react-router-dom';
import './index.css';
import App from './App';
import { getNCMInstance } from './utils/NEWConnectionManager_SinglePointOfTruth';
import { supabase } from './integrations/supabase/client';

// Initialize NCM_SPOT with the Supabase client
getNCMInstance().initialize(supabase);

ReactDOM.render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
  document.getElementById('root')
);
