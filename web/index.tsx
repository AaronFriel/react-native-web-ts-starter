import * as React from 'react';
import { AppRegistry } from 'react-native';

import App from './AppWrapper';

const rootEl = document.getElementById('react-root');

const render = () => (
  <App />
);

AppRegistry.registerComponent('nativeapp', () => render);
AppRegistry.runApplication('nativeapp', {
  rootTag: rootEl,
});
