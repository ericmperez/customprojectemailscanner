#!/usr/bin/env python3
"""
Simple web server to serve the licitaciones dashboard
Usage: python3 simple-server.py
"""

import http.server
import socketserver
import os
import webbrowser
from pathlib import Path

# Configuration
PORT = 8000
DASHBOARD_FILE = "simple-dashboard.html"

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_GET(self):
        if self.path == '/' or self.path == '':
            self.path = f'/{DASHBOARD_FILE}'
        return super().do_GET()

def main():
    # Change to the script directory
    os.chdir(Path(__file__).parent)
    
    # Check if dashboard file exists
    if not os.path.exists(DASHBOARD_FILE):
        print(f"❌ Error: {DASHBOARD_FILE} not found!")
        return
    
    # Start server
    with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
        print(f"🎯 Licitaciones Dashboard Server")
        print(f"📡 Serving at: http://localhost:{PORT}")
        print(f"📱 Dashboard: http://localhost:{PORT}/{DASHBOARD_FILE}")
        print(f"🔄 Press Ctrl+C to stop")
        
        # Try to open browser automatically
        try:
            webbrowser.open(f"http://localhost:{PORT}")
        except:
            pass
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Dashboard server stopped")

if __name__ == "__main__":
    main()