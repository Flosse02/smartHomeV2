import './style.css';

import { initTabs } from './lib/tabs.js';
import { updateWeather } from './components/weather.js';
import { updateDateTime } from './components/timedate.js';
import {mountGoogleCalendar} from "./components/calendar.js";

// --- Top info bar with time + weather
function mountInfoBar() {
  const elTime = document.getElementById('info-time');
  const elTemp = document.getElementById('info-temp');

  const clock = updateDateTime(elTime);
  console.log('Clock started', clock);

  // Get weather every 10 minutes
  updateWeather(elTemp);
  setInterval(() => updateWeather(elTemp), 10 * 60 * 1000);
}

function mountCalendar() {
  const target = document.getElementById('calendar-pane');
  mountGoogleCalendar(target);
}

// --- Boot everything fixed (top + bottom), then wire tabs for the upper pane
mountInfoBar();
mountCalendar();

// Tabs config:
// - Your HTML should have a bar with id="tabs-bar" and buttons with data-tab="photo|music|smart"
// - The upper content area should be a container with id="upper-pane"
initTabs({
  barSelector: '#tabs-bar',
  buttonSelector: '[data-tab]',
  activeAttr: 'data-active',
  mountTargetId: 'tabs-pane',
  defaultTab: 'photo',
  // Map tab name -> module path (ES dynamic import)
  views: {
    photo: () => import('./views/photo.js'),
    // music: () => import('../views/music.js'),
    // smart: () => import('../views/smart.js'),
  },
});
