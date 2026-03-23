# Frontend - Smart Fitness Tracker

React SPA for the Smart Fitness Tracker application.

## Features

- 📝 Workout submission form with multiple exercises
- 📊 Real-time workout processing status
- 🎯 Performance score display (DOTS, Wilks)
- 🔄 Live workflow execution tracking

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Axios** - HTTP client
- **React Router** - Client-side routing

## Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_GATEWAY_URL=http://localhost:8080
```

For production (Firebase Hosting):
```env
VITE_API_GATEWAY_URL=https://your-api-gateway.run.app
```

## Development

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:3000`

## Build

```bash
npm run build
```

Output will be in the `dist/` directory.

## Firebase Hosting Deployment

### 1. Install Firebase Tools

```bash
npm install -g firebase-tools
```

### 2. Login to Firebase

```bash
firebase login
```

### 3. Initialize Firebase

```bash
firebase init hosting
```

Configuration:
- Public directory: `dist`
- Configure as SPA: Yes
- Set up automatic builds: No

### 4. Build and Deploy

```bash
npm run build
firebase deploy --only hosting
```

## Project Structure

```
src/
├── api/              # API client functions
│   └── workout.ts    # Workout API endpoints
├── components/       # React components
│   ├── WorkoutForm.tsx
│   ├── WorkoutForm.css
│   ├── WorkoutStatus.tsx
│   └── WorkoutStatus.css
├── App.tsx          # Main app component
├── App.css          # App styles
├── main.tsx         # Entry point
└── index.css        # Global styles
```

## Features Explained

### Workout Submission
- Form validation for all required fields
- Support for multiple exercise types
- Optional RPE (Rate of Perceived Exertion) tracking
- Real-time submission to API Gateway

### Status Tracking
- Polls workflow execution status
- Shows current processing step
- Displays final results (DOTS, Wilks scores)
- Error handling and display

### UI/UX
- Responsive design
- Loading states
- Error messages
- Success confirmations

## Firebase Hosting Config

The `firebase.json` file should contain:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

This ensures the SPA routing works correctly.
