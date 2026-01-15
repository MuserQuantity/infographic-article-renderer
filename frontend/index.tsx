import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ArticlesPage from './ArticlesPage';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const isArticlesRoute = window.location.pathname.startsWith('/articles');
root.render(
  <React.StrictMode>
    {isArticlesRoute ? <ArticlesPage /> : <App />}
  </React.StrictMode>
);
