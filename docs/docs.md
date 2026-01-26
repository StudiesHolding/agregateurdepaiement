src/
│
├── app.js
├── server.js
│
├── config/
│   ├── database.js
│   ├── env.js
│   └── providers.js
│
├── modules/
│   └── payments/
│       ├── payment.controller.js
│       ├── payment.service.js
│       ├── routing.service.js
│       ├── webhook.controller.js
│       │
│       ├── providers/
│       │   ├── stripe.adapter.js
│       │   ├── cinetpay.adapter.js
│       │   ├── maviance.adapter.js
│       │   └── kkiapay.adapter.js
│       │
│       └── payment.repository.js
│
├── routes/
│   └── payments.routes.js
│
└── utils/
    ├── httpClient.js
    ├── logger.js
    └── crypto.js