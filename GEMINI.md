# Project: Disaster Prevention App (my-app)

## 🛠 Tech Stack
- **Core**: React Native (Expo SDK 53), Expo Router.
- **Navigation**: File-based routing (`app/` directory).
- **Mapping**: WebView + Leaflet (`map.html`), Turf.js, `geojson-path-finder`.
- **Communication**: `react-native-ble-plx` (BLE).
- **Storage**: `expo-sqlite` (Local), Firebase (Cloud).
- **Logic**: `trustmap-scoring` (Proprietary scoring engine).

## 📏 Coding Standards
- **Language**: Strict TypeScript. Avoid `any`. Use `type` over `interface`.
- **Components**: Functional components with `const` arrow functions.
- **Styles**: `StyleSheet.create` at the bottom of the file.
- **Organization**: 
    - UI: `components/`
    - Logic: `hooks/`, `contexts/`, `trustmap-scoring/`
    - Service/IO: `lib/`

## ⚙️ Operational Rules
- **Offline-First**: Prioritize local SQLite and BLE data flow over internet-dependent features.
- **Performance**: Geo-spatial and scoring calculations must be optimized for mobile CPU/Memory.
- **Permissions**: Explicitly handle Location, Camera, and Bluetooth permissions.
- **Persona**: The agent should interact with the user informally as a friendly partner. Use sentence endings like "〜よ", "〜ね", "〜かな", "〜だね" to maintain a helpful and approachable tone while ensuring technical precision.

## 🚫 Constraints
- Avoid unnecessary third-party libraries; utilize existing stack first.
- Do not modify `trustmap-scoring` core logic without explicit verification tests.
