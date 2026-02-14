#!/usr/bin/env python3
"""
Dependency Installer for AI-Powered CRM Backend
This script installs all required dependencies.
"""

import subprocess
import sys
import os
from pathlib import Path

def install_dependencies():
    """Install dependencies from requirements.txt."""
    print("🔧 Installing AI-Powered CRM Backend Dependencies")
    print("=" * 50)
    
    # Find requirements.txt
    backend_dir = Path(__file__).parent.parent
    requirements_file = backend_dir / 'requirements.txt'
    
    if not requirements_file.exists():
        print(f"❌ requirements.txt not found at {requirements_file}")
        return False
    
    print(f"📋 Found requirements file: {requirements_file}")
    
    try:
        # Install dependencies
        print("📦 Installing packages...")
        result = subprocess.run([
            sys.executable, "-m", "pip", "install", "-r", str(requirements_file)
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ All dependencies installed successfully!")
            print("\nInstalled packages:")
            print(result.stdout)
            return True
        else:
            print("❌ Installation failed:")
            print(result.stderr)
            return False
            
    except Exception as e:
        print(f"❌ Installation error: {e}")
        return False

def upgrade_pip():
    """Upgrade pip to latest version."""
    print("🔄 Upgrading pip...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "pip"])
        print("✅ pip upgraded successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"⚠️  pip upgrade failed: {e}")
        return False

def main():
    """Main installation function."""
    print("Starting dependency installation...\n")
    
    # Upgrade pip first
    upgrade_pip()
    print()
    
    # Install dependencies
    if install_dependencies():
        print("\n🎉 Installation completed successfully!")
        print("\n🚀 Next steps:")
        print("   1. Run diagnostic: python diagnose_backend.py")
        print("   2. Start backend: python start_backend.py")
        print("   3. Or run directly: python ml_prediction_api.py")
    else:
        print("\n❌ Installation failed. Please check the error messages above.")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())