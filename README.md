# Silicon Photonics Laser Coupling Simulator

An interactive, animated educational simulator explaining the 8-step process of transmitting a 1310 nm laser through a grating coupler and adiabatic taper into a silicon waveguide.

## Files Included
- `index.html` - The webpage structure and layout.
- `styles.css` - Custom glassmorphic styling and layout styles.
- `app.js` - Main animation loop, physics calculations, and interactive controllers.
- `server_debug.py` - A simple python-based web server script.

## How to Run Locally

### Option 1: Direct File Open
You can open `index.html` directly in any modern browser (like Google Chrome, Safari, or Microsoft Edge) by double-clicking it. Note that fonts are loaded from Google Fonts and require an active internet connection.

### Option 2: Running a Local Web Server (Recommended)
Running through a local web server prevents browser CORS restrictions and enables full telemetry/error logging locally.

1. Open your terminal or command prompt.
2. Navigate to the project directory.
3. Run the local Python server:
   ```bash
   python3 server_debug.py
   ```
4. Open your web browser and go to:
   ```
   http://localhost:8080
   ```
5. Choose between **Movie** mode (automatic progression) and **Study** mode (interactive parameter adjustments).
