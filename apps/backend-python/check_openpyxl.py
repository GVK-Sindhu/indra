import sys
import subprocess

print("Python executable:", sys.executable)
try:
    import openpyxl
    print("openpyxl is already installed!")
except ImportError:
    print("openpyxl is not installed. Installing it now...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "openpyxl"])
        import openpyxl
        print("openpyxl successfully installed and imported!")
    except Exception as e:
        print("Failed to install openpyxl:", str(e))
        sys.exit(1)
