/*
 * One consistent icon set (24x24 grid, 1.8 stroke, round caps) kept in the project
 * so no extra dependency is needed. Paths follow the open Lucide/Feather geometry style.
 * Usage: <Icon name="cart" size={20} />  (decorative by default; pass `label` to expose it).
 */
const P = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>,
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  cart: <><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></>,
  search: <><circle cx="11" cy="11" r="7.5" /><path d="m21 21-4.3-4.3" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  locate: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  heart: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
  plus: <path d="M5 12h14M12 5v14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  checkCircle: <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  moreVertical: <><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>,
  user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.35 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.08 9.92a16 16 0 0 0 6 6l1.29-1.27a2 2 0 0 1 2.11-.45c.9.34 1.84.57 2.8.69A2 2 0 0 1 22 16.92Z" /></>,
  store: <><path d="M4 10v10h16V10" /><path d="m2 10 2-6h16l2 6Z" /><path d="M9 20v-5h6v5" /></>,
  sliders: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  trash: <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />,
  arrowRight: <path d="M5 12h14m-7-7 7 7-7 7" />,
  arrowLeft: <path d="M19 12H5m7 7-7-7 7-7" />,
  layoutGrid: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></>,
  layoutCompact: <><rect x="3" y="3" width="5" height="5" rx="1.2" /><rect x="9.5" y="3" width="5" height="5" rx="1.2" /><rect x="16" y="3" width="5" height="5" rx="1.2" /><rect x="3" y="9.5" width="5" height="5" rx="1.2" /><rect x="9.5" y="9.5" width="5" height="5" rx="1.2" /><rect x="16" y="9.5" width="5" height="5" rx="1.2" /><rect x="3" y="16" width="5" height="5" rx="1.2" /><rect x="9.5" y="16" width="5" height="5" rx="1.2" /><rect x="16" y="16" width="5" height="5" rx="1.2" /></>,
  layoutList: <><rect x="3" y="4" width="18" height="6" rx="2" /><rect x="3" y="14" width="18" height="6" rx="2" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  users: <><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="8" r="3.5" /><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.7a3.5 3.5 0 0 1 0 6.6" /></>,
  chat: <><path d="M20.5 11.2c0 4.1-3.8 7.3-8.5 7.3-1.1 0-2.1-.2-3-.5L4.2 20l1.3-3.7C4.2 15.2 3.5 13.3 3.5 11.2 3.5 7.1 7.3 3.9 12 3.9s8.5 3.2 8.5 7.3Z" /><path d="M8.6 11.8c.9 1.3 2 1.9 3.4 1.9s2.5-.6 3.4-1.9" /><path d="M9.2 8.9h.01M14.8 8.9h.01" /></>,
  smile: <><circle cx="12" cy="12" r="9.5" /><path d="M8 14.2c1.1 1.6 2.4 2.4 4 2.4s2.9-.8 4-2.4" /><path d="M9 9.6h.01M15 9.6h.01" strokeWidth="2.6" /></>,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  laptop: <><rect x="4" y="4" width="16" height="12" rx="1.5" /><path d="M2 20h20l-2-4H4l-2 4Z" /></>,
  arrowUp: <path d="M12 19V5m-7 7 7-7 7 7" />,
  arrowDown: <path d="M12 5v14m7-7-7 7-7-7" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  alert: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4M12 17h.01" /></>,
  compass: <><circle cx="12" cy="12" r="10" /><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" /></>,
  package: <><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>,
  chips: <><path d="M7 3h10l1.5 18h-13L7 3Z" /><path d="m7.4 6 9.2 2M7 17h10" /><circle cx="10" cy="12" r=".55" /><circle cx="14.5" cy="13.5" r=".55" /><circle cx="11.5" cy="15" r=".55" /></>,
  drink: <><path d="M9 3h6v3l1.2 1.6-.8 12.1A2 2 0 0 1 13.4 21h-2.8a2 2 0 0 1-2-2.3L7.8 7.6 9 6V3Z" /><path d="M8.2 9h7.6M10 3v3" /></>,
  apple: <><path d="M12 8c-2.5-2.2-6.3-.4-6.3 3.9 0 4.7 2.8 8.1 5 8.1.7 0 .9-.4 1.3-.4s.6.4 1.3.4c2.2 0 5-3.4 5-8.1C18.3 7.6 14.5 5.8 12 8Z" /><path d="M12 7c-.2-2 1-3.8 3.2-4.5M12 7c-1.7-1.5-3.3-1.8-5-.9" /></>,
  carrot: <><path d="M7 8c3.1-1.6 7.3.2 8.2 3.3.8 2.6-2.4 6.5-7.7 9.3-.4.2-.9-.1-.8-.6L9 15l-3.7 2.3c-.5.3-1-.2-.7-.7L7 13l-3.8 2.3c-.4.3-.9-.2-.7-.7C4 11.5 5.4 9.2 7 8Z" /><path d="M9 8c-.5-2.1-.1-4 1.5-5M11 7c1.3-1.8 3-2.4 5-1.8M12 8c2-1 3.8-.9 5.3.5" /></>,
  candy: <><path d="m5 7 4 1-1-4 4 2 4-2-1 4 4 1-3 3 3 3-4 1 1 4-4-2-4 2 1-4-4-1 3-3-3-3Z" /><path d="m9 9 6 6m0-6-6 6" /></>,
  bread: <><path d="M4 11c0-3.9 3.6-7 8-7s8 3.1 8 7v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7Z" /><path d="M8 9v3M12 8v4M16 9v3" /></>,
  meat: <><path d="M7.4 4.2c1.8-1.1 3.6.1 4.8 1.4l5.6 5.7a4.5 4.5 0 0 1-6.4 6.4L5.7 12c-2.2-2.2-1.7-5.5 1.7-7.8Z" /><circle cx="17.9" cy="17.8" r="1.1" /><path d="M4.4 18.5 7 16M3 21l2-2" /></>,
  milk: <><path d="M8 3h8v3l3 3v12H5V9l3-3V3Z" /><path d="M8 6h8M5 10h14M10 3v3M9 14h6v4H9z" /></>,
  spray: <><path d="M9 7h7l2 3v11H7V9l2-2Z" /><path d="M10 7V4h6l2 2h3M18 4l2-2M9 12h7" /></>,
  toothbrush: <><path d="M6 4h12M8 4v4M11 4v4M14 4v4M17 4v4" /><path d="M12 8v12a2 2 0 0 1-4 0V8M8 13h4" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20" />,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
  bell: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />,
  trendDown: <path d="m22 17-8.5-8.5-5 5L2 7M16 17h6v-6" />,
  trendUp: <path d="m22 7-8.5 8.5-5-5L2 17M16 7h6v6" />,
  tag: <><path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42Z" /><circle cx="7.5" cy="7.5" r=".6" /></>,
  link: <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />,
  navigation: <path d="m3 11 19-9-9 19-2-8-8-2z" />,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  chart: <path d="M3 3v18h18M19 9l-5 5-4-4-3 3" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  refresh: <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5" />,
  sparkles: <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM5 3v4M3 5h4M19 17v4M17 19h4" />,
  ruler: <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0ZM14.5 12.5l2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2" />,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  send: <path d="m22 2-7 20-4-9-9-4Zm0 0L11 13" />,
  bug: <><path d="M8 2l1.9 1.9M16 2l-1.9 1.9M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6ZM12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" /></>,
  shield: <><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" /><path d="m9 12 2 2 4-4" /></>,
  lightbulb: <><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4" /></>,
  info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>,
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" /></>,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></>,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></>,
  palette: <><circle cx="13.5" cy="6.5" r=".6" /><circle cx="17.5" cy="10.5" r=".6" /><circle cx="8.5" cy="7.5" r=".6" /><circle cx="6.5" cy="12.5" r=".6" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.04-.23-.29-.38-.63-.38-1.02 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9Z" /></>,
  pencil: <><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></>,
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  settings: <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>,
  external: <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />,
  database: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0" /></>,
  reply: <path d="M9 17 4 12l5-5M20 18v-2a4 4 0 0 0-4-4H4" />,
  keyboard: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" /></>,
  panelLeft: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" /></>,
  zap: <path d="M13 2 3 14h9l-1 8 10-12h-9z" />,
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />,
  wallet: <><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>,
  badgeCheck: <><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" /></>,
  crown: <><defs><linearGradient id="nt-crown-gold" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fff3b0" /><stop offset=".5" stopColor="#f5b83a" /><stop offset="1" stopColor="#c07a12" /></linearGradient></defs><path d="m3.2 18.2-1.3-9.6 5.5 4.5L12 4.4l4.6 8.7 5.5-4.5-1.3 9.6z" fill="url(#nt-crown-gold)" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><path d="M3.5 21h17" /><circle cx="12" cy="4" r="1.2" fill="#fff6cf" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
  server: <><rect x="2" y="3" width="20" height="8" rx="2" /><rect x="2" y="13" width="20" height="8" rx="2" /><path d="M6 7h.01M6 17h.01" /></>,
};

export default function Icon({ name, size = 20, strokeWidth = 1.8, className = "", label, ...rest }) {
  const body = P[name];
  if (!body) return null;
  return (
    <svg
      className={`nt-icon ${className}`}
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false"
      {...rest}
    >
      {body}
    </svg>
  );
}

export const hasIcon = (name) => typeof name === "string" && name in P;
