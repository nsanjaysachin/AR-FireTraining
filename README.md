# SafeSphere AR — Real-World Fire Extinguisher Training Demo

SafeSphere is an interactive Augmented Reality (AR) fire-emergency training prototype designed for university and educational demonstrations. It combines real-world spatial tracking, computer-vision hand tracking (MediaPipe Hands), physical PASS firefighting protocols, procedural fire simulation, and objective performance scoring.

---

## 🚒 Core Sequence

SafeSphere guides the trainee through the real-world emergency response sequence:
$$\text{REAL ENVIRONMENT} \longrightarrow \text{ANCHORED EXTINGUISHER} \longrightarrow \text{PHYSICAL REACH} \longrightarrow \text{GRAB} \longrightarrow \text{APPROACH} \longrightarrow \text{AIM} \longrightarrow \text{SQUEEZE} \longrightarrow \text{EXTINGUISH} \longrightarrow \text{EVALUATION}$$

---

## 🛠️ Architecture & Technology Stack

| Layer | Technology | Function |
| :--- | :--- | :--- |
| **3D Rendering** | Three.js (r182) | Procedural PBR models, dynamic lighting, contact shadows, particle engines |
| **AR World Tracking** | WebXR & Camera Pass-Through | Device camera stream, persistent 6DoF spatial anchors, mobile gyroscope integration |
| **Hand Tracking** | MediaPipe Hands | 21 3D joint landmark detection, hysteresis pinch/grasp recognition |
| **Audio Synthesizer** | Web Audio API | Zero-dependency procedural synthesis: fire crackle, high-pressure gas hiss, metal pin clink, victory chime |
| **State Machine** | Modular ES6 Training Engine | 10-stage lifecycle, PASS enforcement, collision detection, suppression physics |
| **UI HUD** | Vanilla CSS Glassmorphism | Emergency HUD, PASS checklist, live suppression gauges, evaluation report card |
| **Dev Environment** | Vite | Rapid hot-module replacement and production bundling |

---

## 📌 Key System Features

### 1. Spatial World Tracking & Persistent Anchors
- **Pass-Through AR Mode**: Feeds the device's actual camera stream directly beneath the WebGL transparent scene.
- **Stable World Anchor**: Once the fire extinguisher and fire source are placed in the environment, their world-space poses remain anchored. Moving or panning the camera does **not** move the objects.
- **Dynamic Repositioning**: The user can press **"📍 Reposition Anchor"** at any time to re-anchor the scenario in front of their current viewpoint.
- **WebXR Compatibility**: Supports native WebXR `immersive-ar` with hit-testing on supported Android Chrome devices.

### 2. Natural Hand Interaction & Computer Vision
- **MediaPipe Hands Integration**: Tracks 21 3D hand landmarks in real-time from the camera feed.
- **Intentional Grab Detection**: Uses calibrated distance between thumb tip (landmark 4) and index tip (landmark 8) with hysteresis thresholds (`grabThreshold = 0.065`, `releaseThreshold = 0.098`) to eliminate tracking flutter.
- **Reach Radius Enforcement**: The extinguisher handle defines a 28 cm interaction zone. The user must physically reach the handle before a grab is accepted.
- **Visual Hover Feedback**: The handle halo glows green when within range and shows the real-time palm reticle.
- **Stable Grip Offset**: Attaches the extinguisher to the hand with smooth lerp/slerp filtering.
- **Labeled Simulator Fallback**: If the webcam is unavailable or in automated test environments, the UI clearly displays the `3D SIMULATOR` badge, enabling interactive mouse/touch controls without falsely claiming live camera tracking.

### 3. Realistic Fire Extinguisher Model
- **Cylinder Body**: Red glossy powder coat with a canvas-generated silk-screen PASS instruction decal, rating plate (2A:10B:C), and inspection markings.
- **Working Pressure Gauge**: Calibrated brass gauge with needle positioned in the green operating pressure range (0.8–1.2 MPa).
- **Squeeze Lever**: Black steel lever that pivots downwards realistically upon squeeze activation.
- **Safety Pin & Tamper Seal**: Stainless steel ring with yellow plastic inspection ribbon. Squeezing is physically locked until the pin is pulled.
- **Discharge Hose & Conical Nozzle**: Flexible reinforced hose curving forward with collimator aiming alignment beam.

### 4. PASS Training Protocol & Fire Suppression
- **P — Pull the Pin**: Disengages the safety pin. Squeezing before pulling alerts the trainee with a warning tone.
- **A — Aim at the Base**: Evaluates nozzle vector intersection with the fuel base (height < 0.45 m). Aiming at smoke yields minimal suppression.
- **S — Squeeze the Handle**: Depresses the lever, activates high-pressure powder particles, and plays pressurized gas hiss audio.
- **S — Sweep Side to Side**: Tracks horizontal sweep angular velocity across the fire base. Sweeping grants a 1.45× suppression bonus!
- **Realistic Smolder & Reignition**: If the trainee stops spraying prematurely, lingering embers can smolder and reignite if left unattended.

### 5. Objective Performance Evaluation & Scoring
Generates a comprehensive session report card:
- **Total completion time** & **Pickup reaction time**
- **PASS sequence adherence checks** (P, A, S, S individual badges)
- **Spray accuracy percentage** (time on target base vs wasted discharge)
- **Sweeping cadence score**
- **Standoff distance adherence** (1.8 m – 2.5 m recommended)
- **Aim corrections count**
- **Transparent 100-Point Score Formula**
- **Actionable, tailored improvement tips**

---

## 🧪 Acceptance Test Suite (10-Point Verification)

SafeSphere includes an automated diagnostic runner and an interactive in-browser diagnostic modal (`TEST 1` through `TEST 10`):

| Test ID | Test Name | Verification Method | Status |
| :---: | :--- | :--- | :---: |
| **TEST 1** | **Anchor Stability** | Displaces camera by +1.5m X / +0.8m Z. Verifies object world coordinates remain fixed ($\Delta < 0.001\text{m}$). | **PASS** |
| **TEST 2** | **Grab Range** | Reaches from 1.5m away (rejected); reaches from 0.05m (accepted within $r=0.28\text{m}$). | **PASS** |
| **TEST 3** | **Natural Movement** | Moves hand pose. Verifies object tracks hand while preserving calibrated grip offset ($\Delta < 0.05\text{m}$). | **PASS** |
| **TEST 4** | **Aiming Precision** | Points nozzle 90° away from fire. Verifies fire health does not decrease (0% suppression). | **PASS** |
| **TEST 5** | **Suppression Decay** | Aims at fire base and sprays. Verifies health diminishes continuously ($100\% \to 98.2\% \to 93.0\%$) instead of disappearing instantly. | **PASS** |
| **TEST 6** | **World-Space Release** | Releases extinguisher. Verifies it returns to `WORLD_ANCHORED` state at release position. | **PASS** |
| **TEST 7** | **Completion & Report** | Extinguishes fire. Verifies session metrics, score (0–100), and tips are accurately computed and displayed. | **PASS** |
| **TEST 8** | **Failure Recovery** | Simulates hand tracking loss and camera interruption. Verifies UI displays clear guidance without exceptions. | **PASS** |
| **TEST 9** | **Repeatability** | Restarts scenario. Verifies extinguisher, fire ($100\%$), spray, and PASS checklist reset cleanly with zero residual corruption. | **PASS** |
| **TEST 10** | **Device Diagnostics** | Inspects WebXR support, `getUserMedia` camera pass-through, and device orientation sensors. | **PASS** |

To run the verification suite via Node CLI:
```bash
node test-runner.js
```

---

## 🚀 Quickstart & Run Instructions

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Access in Browser
- **Desktop / Laptop**: Open `http://localhost:5173/` in Google Chrome, Microsoft Edge, or Safari.
- **Mobile AR (Real Camera & Hand Tracking)**: Connect your phone to the same Wi-Fi network and navigate to the Network URL displayed in the terminal (e.g. `http://<YOUR-IP>:5173/`).

### 3. Controls & Hotkeys
- **Mouse Drag**: Orbit/pan view in desktop preview.
- **W / A / S / D**: Walk around the scene in desktop preview.
- **Spacebar**: Squeeze / release extinguisher lever.
- **P**: Pull safety pin.
- **R**: Reposition scenario anchor.

---

## ⚠️ Safety & Compliance Disclaimer

> [!NOTE]
> SafeSphere is an educational academic demonstration prototype. It is designed to illustrate PASS protocols and AR interaction mechanics. It does not replace hands-on certified firefighting qualifications or NFPA-10 professional standards. In a real emergency, prioritize evacuation and alert certified emergency responders.
