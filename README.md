# Subatom + TypeScript

Build fast, reliable, and production-ready backend applications with **Subatom**.

## 🌐 Documentation

- **Subatom Documentation:** https://subatomjs.dev
- **Subatom Infer:** https://infer.subatomjs.dev
- **Subatom Pulse:** https://pulse.subatomjs.dev

---

## 🚀 Features

1. Auto-generated API documentation available at the `/docs` URL
2. Runtime schema validation
3. Fast TypeScript backend framework
4. Modern HTTP methods
5. Pre-configured Redis, ORM, database, Vitest, and ESLint support
6. Fast and reliable architecture

---

## 🛠️ Getting Started

### Install dependencies

```bash
npm install
```

### Development

```bash
npm run build
npm run dev
```

### Start the application

```bash
npm start
```

Or, if your project provides a preview script:

```bash
npm run preview
```

---

## 🧪 Testing

Run the test suite with:

```bash
npm run test
```

### Test Coverage

To generate test coverage:

```bash
npm run test:coverage
```

## Résumé multipart API

`POST /api/v1/resume/upload-resume` and
`PATCH /api/v1/resume/update-resume/:resumeId` use a fixed multipart contract,
which Swagger UI exposes as four upload controls:

| Multipart field | Cardinality | Referenced from JSON body |
| --- | --- | --- |
| `avatar` | One image | Stored directly as the résumé avatar |
| `certificateFiles` | Array | `certifications.certificates.*.certificateContent.fileIndex` |
| `publicationFiles` | Array | `publications.publications.*.publicationReference[].fileIndex` |
| `achievementFiles` | Array | `awardsAndAchievements.achievements[].documents[].fileIndex` |

`fileIndex` is zero-based within its own multipart field. For example, the
first file selected under `publicationFiles` is referenced with
`{ "fileIndex": 0, "title": "Paper" }`.

---

## 🧰 Tech Stack

| Technology | Configuration |
|---|---|
| Language | TypeScript |
| ORM | mongoose |
| Database | mongodb |
| Framework | Subatom |
| Schema Validator | Subatom Infer |
| Caching | Redis |
| Linting | ESLint |
| Testing | Vitest + V8 |
| WebSocket Connection | Subatom Pulse |

---

## 📁 Ideal Folder Structure

```text
Subatom_Server/
├── public/                 # Static assets served directly at runtime
├── scripts/                # Runtime scripts and shell files
├── tests/                  # Test cases
├── src/
│   ├── config/             # Server configuration files
│   ├── controllers/        # Route controllers
│   ├── routes/             # Route handlers
│   ├── schema/             # Runtime validation using Subatom Infer
│   ├── models/             # Database schemas
│   ├── redis/              # Redis cache configuration
│   ├── utils/              # Utility functions and helpers
│   ├── middlewares/        # Application middlewares
│   ├── web-socket/         # Subatom Pulse WebSocket connection
│   └── server.ts           # Register routes and middleware
├── .gitignore              # Git ignored files
├── main.ts                 # Main application entry point
├── eslint.config.mts       # ESLint configuration
├── package.json             # Project dependencies and scripts
├── subatom.config.ts       # Subatom server configuration
└── vitest.config.ts        # Vitest configuration
```

> **Note:** Some directories and configuration files may not be present depending on the options selected during project creation.

---

## 🌐 Deployment

To build the application for production, run:

```bash
npm run build
```

This generates a production-ready `dist` folder.

You can deploy the resulting application using your preferred Node.js hosting platform.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

Please visit the project's GitHub repository to:

- Report bugs
- Request features
- Submit pull requests
- Improve documentation

---

## 📄 License

This project is licensed under the **MIT License**.

See the `LICENSE` file for more information.

---

## ⚡ Built with Subatom

This project was generated using **Subatom**.

- 🌐 https://subatomjs.dev
- 🧩 https://infer.subatomjs.dev
- ⚡ https://pulse.subatomjs.dev
