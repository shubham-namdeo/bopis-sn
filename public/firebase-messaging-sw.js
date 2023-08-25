// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');


// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp({
    apiKey: "AIzaSyAq-jeG6dy8y2O6p_RYKk_MpkfTZ97GF_Q",
    authDomain: "hotwax-digital-commerce.firebaseapp.com",
    databaseURL: "https://hotwax-digital-commerce.firebaseio.com",
    projectId: "hotwax-digital-commerce",
    storageBucket: "hotwax-digital-commerce.appspot.com",
    messagingSenderId: "211268342110",
    appId: "1:211268342110:web:6fa33f0d16129925c27fcf"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {    
    
   console.log(
      '[firebase-messaging-sw.js] Received background message ',
      payload
    );
    // Customize notification here
    const notificationTitle = payload.data.title;
    const notificationOptions = {
      body: payload.data.body,
      icon: '/img/icons/msapplication-icon-144x144.png',
      data: {
        click_action: 'http://localhost:8100'
      }
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
    
    const broadcast = new BroadcastChannel('FB_BG_MESSAGES');
    broadcast.postMessage(payload);
  });

  self.addEventListener('notificationclick', event => {
    event.notification.close();
  
    console.log("======event.notification========", event.notification);
    const deepLink = event.notification.data.click_action; 
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(windowClients => {
        // Check if the app window is already open
        for (let client of windowClients) {
          if (client.url === deepLink && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If the app window is not open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(deepLink);
        }
      })
    );
  });
  