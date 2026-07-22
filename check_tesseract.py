import os
import shutil
import pytesseract

print("Checking Tesseract in PATH:")
tess_path = shutil.which("tesseract")
print("which tesseract:", tess_path)

common_paths = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    r"D:\Program Files\Tesseract-OCR\tesseract.exe",
    r"E:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Users\puran\AppData\Local\Programs\Tesseract-OCR\tesseract.exe",
]
for path in common_paths:
    print(f"Path {path} exists:", os.path.exists(path))
